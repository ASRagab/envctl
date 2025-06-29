import { Profile } from './types'
import { Storage } from './storage'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'

interface Dependencies {
  os: typeof os
  path: typeof path
  fs: typeof fs
}

export class EnvManager {
  private storage: Storage
  private deps: Dependencies

  constructor(deps?: Partial<Dependencies>) {
    this.storage = new Storage()
    this.deps = {
      os,
      path,
      fs,
      ...deps,
    }
  }

  private getShellRcFile = (homeDir: string, shell: string): string => {
    // Extract shell name from path (e.g., '/usr/bin/zsh' -> 'zsh')
    const shellName = shell.split('/').pop() || ''

    switch (shellName) {
      case 'zsh':
        return this.deps.path.join(homeDir, '.zshrc')
      case 'bash':
        return this.deps.path.join(homeDir, '.bashrc')
      case 'fish':
        return this.deps.path.join(homeDir, '.config', 'fish', 'config.fish')
      default:
        return this.deps.path.join(homeDir, '.bashrc')
    }
  }

  createProfile = async (name: string): Promise<void> => {
    const existing = await this.storage.loadProfile(name)
    if (existing) {
      throw new Error(`Profile '${name}' already exists`)
    }

    const profile: Profile = {
      name,
      variables: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.storage.saveProfile(profile)
  }

  addVariable = async (profileName: string, key: string, value: string): Promise<void> => {
    const profile = await this.storage.loadProfile(profileName)
    if (!profile) {
      throw new Error(`Profile '${profileName}' does not exist`)
    }

    profile.variables[key] = value
    profile.updatedAt = new Date()

    await this.storage.saveProfile(profile)
  }

  addVariablesFromFile = async (profileName: string, filePath: string): Promise<number> => {
    const profile = await this.storage.loadProfile(profileName)
    if (!profile) {
      throw new Error(`Profile '${profileName}' does not exist`)
    }

    const variables = await this.storage.parseEnvFile(filePath)

    Object.assign(profile.variables, variables)
    profile.updatedAt = new Date()

    await this.storage.saveProfile(profile)
    return Object.keys(variables).length
  }

  removeVariable = async (profileName: string, key: string): Promise<void> => {
    const profile = await this.storage.loadProfile(profileName)
    if (!profile) {
      throw new Error(`Profile '${profileName}' does not exist`)
    }

    if (!(key in profile.variables)) {
      throw new Error(`Variable '${key}' not found in profile '${profileName}'`)
    }

    delete profile.variables[key]
    profile.updatedAt = new Date()

    await this.storage.saveProfile(profile)
  }

  loadProfile = async (profileName: string): Promise<string> => {
    const profile = await this.storage.loadProfile(profileName)
    if (!profile) {
      throw new Error(`Profile '${profileName}' does not exist`)
    }

    const currentlyLoaded = await this.storage.getCurrentlyLoadedProfile()

    if (currentlyLoaded === profileName) {
      return await this.reloadCurrentProfile(profileName, profile)
    }

    if (currentlyLoaded && currentlyLoaded !== profileName) {
      throw new Error(
        `Profile '${currentlyLoaded}' is already loaded. Use 'envctl switch ${profileName}' to switch profiles.`,
      )
    }

    return await this.generateLoadCommands(profileName, profile)
  }

  private reloadCurrentProfile = async (profileName: string, profile: Profile): Promise<string> => {
    const commands: string[] = []

    // First, restore from backup (unload current state)
    for (const key of Object.keys(profile.variables)) {
      commands.push(`if grep -q "^${key}=" ~/.envctl/backup.env 2>/dev/null; then`)
      commands.push(`  export ${key}="$(grep "^${key}=" ~/.envctl/backup.env | cut -d'=' -f2-)"`)
      commands.push(`else`)
      commands.push(`  unset ${key}`)
      commands.push(`fi`)
    }

    // Then create fresh backup and load new values
    commands.push(`echo "# envctl-profile:${profileName}" > ~/.envctl/backup.env`)

    for (const key of Object.keys(profile.variables)) {
      commands.push(`[ -n "\${${key}+x}" ] && echo "${key}=$${key}" >> ~/.envctl/backup.env`)
    }

    for (const [key, value] of Object.entries(profile.variables)) {
      commands.push(`export ${key}="${value}"`)
    }

    return commands.join('\n')
  }

  private generateLoadCommands = async (profileName: string, profile: Profile): Promise<string> => {
    const backupCommands: string[] = []
    const setCommands: string[] = []

    // Create backup file with profile marker
    const createBackupCommand = `echo "# envctl-profile:${profileName}" > ~/.envctl/backup.env`

    for (const key of Object.keys(profile.variables)) {
      backupCommands.push(`[ -n "\${${key}+x}" ] && echo "${key}=$${key}" >> ~/.envctl/backup.env`)
    }

    for (const [key, value] of Object.entries(profile.variables)) {
      setCommands.push(`export ${key}="${value}"`)
    }

    return [createBackupCommand, ...backupCommands, ...setCommands].join('\n')
  }

  unloadProfile = async (): Promise<{ commands: string; profileName: string }> => {
    const currentlyLoaded = await this.storage.getCurrentlyLoadedProfile()
    if (!currentlyLoaded) {
      throw new Error('No profile is currently loaded')
    }

    // Handle unknown profile case
    if (currentlyLoaded === 'unknown') {
      const commands = `rm -f ~/.envctl/backup.env`
      return { commands, profileName: 'unknown' }
    }

    const profile = await this.storage.loadProfile(currentlyLoaded)
    if (!profile) {
      throw new Error(`Profile '${currentlyLoaded}' not found`)
    }

    const commands: string[] = []

    for (const key of Object.keys(profile.variables)) {
      commands.push(`if grep -q "^${key}=" ~/.envctl/backup.env 2>/dev/null; then`)
      commands.push(`  export ${key}="$(grep "^${key}=" ~/.envctl/backup.env | cut -d'=' -f2-)"`)
      commands.push(`else`)
      commands.push(`  unset ${key}`)
      commands.push(`fi`)
    }

    commands.push('rm -f ~/.envctl/backup.env')

    return {
      commands: commands.join('\n'),
      profileName: currentlyLoaded,
    }
  }

  switchProfile = async (profileName: string): Promise<{ commands: string; from?: string; to: string }> => {
    const newProfile = await this.storage.loadProfile(profileName)
    if (!newProfile) {
      throw new Error(`Profile '${profileName}' does not exist`)
    }

    const currentlyLoaded = await this.storage.getCurrentlyLoadedProfile()

    if (!currentlyLoaded) {
      // No profile loaded - just load the new one
      const commands = await this.generateLoadCommands(profileName, newProfile)
      return { commands, to: profileName }
    }

    if (currentlyLoaded === profileName) {
      // Same profile - just reload it
      const commands = await this.reloadCurrentProfile(profileName, newProfile)
      return { commands, from: profileName, to: profileName }
    }

    // Different profile - unload current and load new
    const commands: string[] = []

    // Only try to unload if we know what profile is loaded
    if (currentlyLoaded !== 'unknown') {
      const currentProfile = await this.storage.loadProfile(currentlyLoaded)

      if (currentProfile) {
        // Unload current profile
        for (const key of Object.keys(currentProfile.variables)) {
          commands.push(`if grep -q "^${key}=" ~/.envctl/backup.env 2>/dev/null; then`)
          commands.push(`  export ${key}="$(grep "^${key}=" ~/.envctl/backup.env | cut -d'=' -f2-)"`)
          commands.push(`else`)
          commands.push(`  unset ${key}`)
          commands.push(`fi`)
        }
      }
    }

    // Load new profile
    commands.push(`echo "# envctl-profile:${profileName}" > ~/.envctl/backup.env`)

    for (const key of Object.keys(newProfile.variables)) {
      commands.push(`[ -n "\${${key}+x}" ] && echo "${key}=$${key}" >> ~/.envctl/backup.env`)
    }

    for (const [key, value] of Object.entries(newProfile.variables)) {
      commands.push(`export ${key}="${value}"`)
    }

    return { commands: commands.join('\n'), from: currentlyLoaded, to: profileName }
  }

  getStatus = async (): Promise<{ currentProfile?: string; variableCount?: number }> => {
    const currentlyLoaded = await this.storage.getCurrentlyLoadedProfile()

    if (!currentlyLoaded) {
      return {}
    }

    // Handle unknown profile (backup exists but no profile marker)
    if (currentlyLoaded === 'unknown') {
      return { currentProfile: 'unknown', variableCount: 0 }
    }

    const profile = await this.storage.loadProfile(currentlyLoaded)
    return {
      currentProfile: currentlyLoaded,
      variableCount: profile ? Object.keys(profile.variables).length : 0,
    }
  }

  listProfiles = async (): Promise<Array<{ name: string; isLoaded: boolean; variableCount: number }>> => {
    const profiles = await this.storage.listProfiles()
    const currentlyLoaded = await this.storage.getCurrentlyLoadedProfile()

    const result = []
    for (const name of profiles) {
      const profile = await this.storage.loadProfile(name)
      result.push({
        name,
        isLoaded: currentlyLoaded === name,
        variableCount: profile ? Object.keys(profile.variables).length : 0,
      })
    }

    return result.sort((a, b) => a.name.localeCompare(b.name))
  }

  getProfile = async (name: string): Promise<Profile | null> => {
    return await this.storage.loadProfile(name)
  }

  deleteProfile = async (name: string): Promise<void> => {
    const currentlyLoaded = await this.storage.getCurrentlyLoadedProfile()
    if (currentlyLoaded === name) {
      throw new Error(`Cannot delete profile '${name}' while it is loaded. Unload it first.`)
    }

    const deleted = await this.storage.deleteProfile(name)
    if (!deleted) {
      throw new Error(`Profile '${name}' does not exist`)
    }
  }

  exportProfile = async (name: string): Promise<string> => {
    const profile = await this.storage.loadProfile(name)
    if (!profile) {
      throw new Error(`Profile '${name}' does not exist`)
    }

    return Object.entries(profile.variables)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')
  }

  setupShellIntegration = async (): Promise<{ rcFile: string; integrationFile: string }> => {
    const homeDir = this.deps.os.homedir()
    const shell = process.env['SHELL'] || ''
    const rcFile = this.getShellRcFile(homeDir, shell)
    const integrationFile = this.deps.path.join(homeDir, '.envctl-integration.sh')
    const scriptPath = this.deps.path.join(__dirname, '..', 'shell-integration.sh')

    let scriptContent: string
    if (await this.deps.fs.pathExists(scriptPath)) {
      scriptContent = await this.deps.fs.readFile(scriptPath, 'utf-8')
    } else {
      // Fallback: embedded script content
      scriptContent = `#!/bin/bash
# envctl Shell Integration
# Auto-generated by envctl setup

# Function to load a profile
envctl-load() {
    if [ -z "$1" ]; then
        echo "Usage: envctl-load <profile>"
        return 1
    fi
    
    local commands
    commands=$(envctl load "$1" 2>/dev/null)
    if [ $? -eq 0 ]; then
        eval "$commands"
        echo "✓ Loaded profile '$1'"
    else
        echo "✗ Failed to load profile '$1'"
        envctl load "$1"  # Show the error
        return 1
    fi
}

# Function to unload current profile
envctl-unload() {
    local commands
    commands=$(envctl unload 2>/dev/null)
    if [ $? -eq 0 ]; then
        eval "$commands"
        echo "✓ Unloaded profile"
    else
        echo "✗ Failed to unload profile"
        envctl unload  # Show the error
        return 1
    fi
}

# Function to switch profiles
envctl-switch() {
    if [ -z "$1" ]; then
        echo "Usage: envctl-switch <profile>"
        return 1
    fi
    
    local commands
    commands=$(envctl switch "$1" 2>/dev/null)
    if [ $? -eq 0 ]; then
        eval "$commands"
        echo "✓ Switched to profile '$1'"
    else
        echo "✗ Failed to switch to profile '$1'"
        envctl switch "$1"  # Show the error
        return 1
    fi
}

# Aliases for convenience
alias ecl='envctl-load'
alias ecu='envctl-unload'
alias ecs='envctl status'
alias ecls='envctl list'
alias ecsw='envctl-switch'
`
    }

    await this.deps.fs.writeFile(integrationFile, scriptContent)
    await this.deps.fs.chmod(integrationFile, 0o755)

    const sourceLine = `source ~/.envctl-integration.sh`
    let rcContent = ''

    if (await this.deps.fs.pathExists(rcFile)) {
      rcContent = await this.deps.fs.readFile(rcFile, 'utf-8')
    }

    if (!rcContent.includes(sourceLine)) {
      const newContent = `${rcContent}\n# envctl shell integration\n${sourceLine}\n`
      await this.deps.fs.writeFile(rcFile, newContent)
    }

    return { rcFile, integrationFile }
  }

  unsetupShellIntegration = async (): Promise<{ rcFile: string; integrationFile: string; removed: string[] }> => {
    const homeDir = this.deps.os.homedir()
    const shell = process.env['SHELL'] || ''
    const rcFile = this.getShellRcFile(homeDir, shell)
    const integrationFile = this.deps.path.join(homeDir, '.envctl-integration.sh')
    const removed: string[] = []

    if (await this.deps.fs.pathExists(integrationFile)) {
      await this.deps.fs.remove(integrationFile)
      removed.push(integrationFile)
    }

    if (await this.deps.fs.pathExists(rcFile)) {
      const rcContent = await this.deps.fs.readFile(rcFile, 'utf-8')
      const lines = rcContent.split('\n')

      // Filter out envctl-related lines
      const filteredLines = lines.filter((line) => {
        const trimmed = line.trim()
        return !(trimmed === '# envctl shell integration' || trimmed === 'source ~/.envctl-integration.sh')
      })

      // Only write back if we actually removed something
      if (filteredLines.length !== lines.length) {
        await this.deps.fs.writeFile(rcFile, filteredLines.join('\n'))
        removed.push(`${rcFile} (removed envctl lines)`)
      }
    }

    return { rcFile, integrationFile, removed }
  }

  cleanupAllData = async (): Promise<{ removed: string[] }> => {
    const { getConfig } = await import('./config')

    const config = getConfig()
    const removed: string[] = []

    try {
      const currentlyLoaded = await this.storage.getCurrentlyLoadedProfile()
      if (currentlyLoaded) {
        const result = await this.unloadProfile()
        // Execute the unload commands in our process (this is cleanup, so it's okay)
        // Note: In a real cleanup scenario, we'd just remove the files directly
        removed.push(`Unloaded current profile '${result.profileName}'`)
      }
    } catch {
      // Ignore errors - profile might not exist or be corrupted
    }

    // Remove entire config directory
    if (await this.deps.fs.pathExists(config.configDir)) {
      await this.deps.fs.remove(config.configDir)
      removed.push(config.configDir)
    }

    // Remove backup file (backup.env is stored in the config directory, so it should be removed with the config dir)
    // But let's check for it separately in case it exists elsewhere
    const backupFile = this.deps.path.join(config.configDir, 'backup.env')
    if (await this.deps.fs.pathExists(backupFile)) {
      await this.deps.fs.remove(backupFile)
      removed.push(backupFile)
    }

    return { removed }
  }
}
