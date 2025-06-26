import { Profile } from './types'
import { Storage } from './storage'
import os from 'os'
import path from 'path'
import fs from 'fs-extra'

// Interface for testable dependencies
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

  loadProfile = async (profileName: string): Promise<void> => {
    const profile = await this.storage.loadProfile(profileName)
    if (!profile) {
      throw new Error(`Profile '${profileName}' does not exist`)
    }

    const state = await this.storage.loadState()
    if (state.currentProfile) {
      throw new Error(`Profile '${state.currentProfile}' is already loaded. Unload it first.`)
    }

    // Backup current environment - only variables that actually exist
    const backup: Record<string, string> = {}
    for (const key of Object.keys(profile.variables)) {
      if (process.env[key] !== undefined) {
        backup[key] = process.env[key]!
      }
    }

    // Save backup to file
    await this.storage.saveBackup(backup)

    // Load new environment
    for (const [key, value] of Object.entries(profile.variables)) {
      process.env[key] = value
    }

    // Save state (no longer need to store backup in state)
    await this.storage.saveState({
      currentProfile: profileName,
    })
  }

  unloadProfile = async (): Promise<string> => {
    const state = await this.storage.loadState()
    if (!state.currentProfile) {
      throw new Error('No profile is currently loaded')
    }

    const profileName = state.currentProfile
    const profile = await this.storage.loadProfile(profileName)
    if (!profile) {
      throw new Error(`Profile '${profileName}' not found`)
    }

    // Load backup from file
    const backup = await this.storage.loadBackup()

    // Restore environment - smart restore logic
    for (const key of Object.keys(profile.variables)) {
      if (key in backup) {
        // Variable existed before - restore original value
        process.env[key] = backup[key]
      } else {
        // Variable didn't exist before - remove it completely
        delete process.env[key]
      }
    }

    // Clear backup file and state
    await this.storage.clearBackup()
    await this.storage.saveState({})

    return profileName
  }

  switchProfile = async (profileName: string): Promise<{ from?: string; to: string }> => {
    const state = await this.storage.loadState()
    let fromProfile: string | undefined

    // If a profile is currently loaded, unload it first
    if (state.currentProfile) {
      fromProfile = await this.unloadProfile()
    }

    // Load the new profile
    await this.loadProfile(profileName)

    return fromProfile !== undefined ? { from: fromProfile, to: profileName } : { to: profileName }
  }

  getStatus = async (): Promise<{ currentProfile?: string; variableCount?: number }> => {
    const state = await this.storage.loadState()

    if (!state.currentProfile) {
      return {}
    }

    const profile = await this.storage.loadProfile(state.currentProfile)
    return {
      currentProfile: state.currentProfile,
      variableCount: profile ? Object.keys(profile.variables).length : 0,
    }
  }

  listProfiles = async (): Promise<Array<{ name: string; isLoaded: boolean; variableCount: number }>> => {
    const profiles = await this.storage.listProfiles()
    const state = await this.storage.loadState()

    const result = []
    for (const name of profiles) {
      const profile = await this.storage.loadProfile(name)
      result.push({
        name,
        isLoaded: state.currentProfile === name,
        variableCount: profile ? Object.keys(profile.variables).length : 0,
      })
    }

    return result.sort((a, b) => a.name.localeCompare(b.name))
  }

  getProfile = async (name: string): Promise<Profile | null> => {
    return await this.storage.loadProfile(name)
  }

  deleteProfile = async (name: string): Promise<void> => {
    const state = await this.storage.loadState()
    if (state.currentProfile === name) {
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

  generateShellCommands = async (profileName: string): Promise<string> => {
    const profile = await this.storage.loadProfile(profileName)
    if (!profile) {
      throw new Error(`Profile '${profileName}' does not exist`)
    }

    const state = await this.storage.loadState()
    if (state.currentProfile) {
      throw new Error(`Profile '${state.currentProfile}' is already loaded. Unload it first.`)
    }

    // Generate backup commands for current environment - only if variables exist
    const backupCommands: string[] = []
    const setCommands: string[] = []

    for (const key of Object.keys(profile.variables)) {
      // Save current value only if it exists
      backupCommands.push(`[ -n "\${${key}+x}" ] && echo "${key}=$${key}" >> ~/.envctl/backup.env`)
    }

    // Generate set commands
    for (const [key, value] of Object.entries(profile.variables)) {
      setCommands.push(`export ${key}="${value}"`)
    }

    // Save state
    await this.storage.saveState({
      currentProfile: profileName,
    })

    return [...backupCommands, ...setCommands].join('\n')
  }

  generateUnloadCommands = async (): Promise<{ commands: string; profileName: string }> => {
    const state = await this.storage.loadState()
    if (!state.currentProfile) {
      throw new Error('No profile is currently loaded')
    }

    const profile = await this.storage.loadProfile(state.currentProfile)
    if (!profile) {
      throw new Error(`Profile '${state.currentProfile}' not found`)
    }

    const commands: string[] = []

    // Restore environment variables from backup file
    for (const key of Object.keys(profile.variables)) {
      commands.push(`if grep -q "^${key}=" ~/.envctl/backup.env 2>/dev/null; then`)
      commands.push(`  export ${key}="$(grep "^${key}=" ~/.envctl/backup.env | cut -d'=' -f2-)"`)
      commands.push(`else`)
      commands.push(`  unset ${key}`)
      commands.push(`fi`)
    }

    // Remove backup file
    commands.push('rm -f ~/.envctl/backup.env')

    // Clear state
    await this.storage.saveState({})

    return {
      commands: commands.join('\n'),
      profileName: state.currentProfile,
    }
  }

  generateSwitchCommands = async (profileName: string): Promise<{ commands: string; from?: string; to: string }> => {
    const newProfile = await this.storage.loadProfile(profileName)
    if (!newProfile) {
      throw new Error(`Profile '${profileName}' does not exist`)
    }

    const state = await this.storage.loadState()
    let fromProfile: string | undefined
    const commands: string[] = []

    // If a profile is currently loaded, generate unload commands first
    if (state.currentProfile) {
      fromProfile = state.currentProfile
      const currentProfile = await this.storage.loadProfile(state.currentProfile)
      if (!currentProfile) {
        throw new Error(`Current profile '${state.currentProfile}' not found`)
      }

      // Restore environment variables from backup file for current profile
      for (const key of Object.keys(currentProfile.variables)) {
        commands.push(`if grep -q "^${key}=" ~/.envctl/backup.env 2>/dev/null; then`)
        commands.push(`  export ${key}="$(grep "^${key}=" ~/.envctl/backup.env | cut -d'=' -f2-)"`)
        commands.push(`else`)
        commands.push(`  unset ${key}`)
        commands.push(`fi`)
      }

      // Remove old backup file
      commands.push('rm -f ~/.envctl/backup.env')
    }

    // Generate backup commands for new profile - only if variables exist
    for (const key of Object.keys(newProfile.variables)) {
      // Save current value only if it exists
      commands.push(`[ -n "\${${key}+x}" ] && echo "${key}=$${key}" >> ~/.envctl/backup.env`)
    }

    // Generate set commands for new profile
    for (const [key, value] of Object.entries(newProfile.variables)) {
      commands.push(`export ${key}="${value}"`)
    }

    // Save new state
    await this.storage.saveState({
      currentProfile: profileName,
    })

    return fromProfile !== undefined
      ? { commands: commands.join('\n'), from: fromProfile, to: profileName }
      : { commands: commands.join('\n'), to: profileName }
  }

  setupShellIntegration = async (): Promise<{ rcFile: string; integrationFile: string }> => {
    const homeDir = this.deps.os.homedir()
    const shell = process.env['SHELL'] || ''

    // Determine the appropriate RC file
    let rcFile: string
    if (shell.includes('zsh')) {
      rcFile = this.deps.path.join(homeDir, '.zshrc')
    } else if (shell.includes('bash')) {
      rcFile = this.deps.path.join(homeDir, '.bashrc')
    } else if (shell.includes('fish')) {
      rcFile = this.deps.path.join(homeDir, '.config', 'fish', 'config.fish')
    } else {
      // Default to .bashrc
      rcFile = this.deps.path.join(homeDir, '.bashrc')
    }

    // Copy shell integration script to home directory
    const integrationFile = this.deps.path.join(homeDir, '.envctl-integration.sh')

    // Get the shell integration script content
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
    commands=$(envctl load --shell "$1" 2>/dev/null)
    if [ $? -eq 0 ]; then
        eval "$commands"
        echo "✓ Loaded profile '$1'"
    else
        echo "✗ Failed to load profile '$1'"
        envctl load --shell "$1"  # Show the error
        return 1
    fi
}

# Function to unload current profile
envctl-unload() {
    local commands
    commands=$(envctl unload --shell 2>/dev/null)
    if [ $? -eq 0 ]; then
        eval "$commands"
        echo "✓ Unloaded profile"
    else
        echo "✗ Failed to unload profile"
        envctl unload --shell  # Show the error
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
    commands=$(envctl switch --shell "$1" 2>/dev/null)
    if [ $? -eq 0 ]; then
        eval "$commands"
        echo "✓ Switched to profile '$1'"
    else
        echo "✗ Failed to switch to profile '$1'"
        envctl switch --shell "$1"  # Show the error
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

    // Write the integration script
    await this.deps.fs.writeFile(integrationFile, scriptContent)
    await this.deps.fs.chmod(integrationFile, 0o755)

    // Check if the source line already exists
    const sourceLine = `source ~/.envctl-integration.sh`
    let rcContent = ''

    if (await this.deps.fs.pathExists(rcFile)) {
      rcContent = await this.deps.fs.readFile(rcFile, 'utf-8')
    }

    if (!rcContent.includes(sourceLine)) {
      // Add the source line
      const newContent = `${rcContent}\n# envctl shell integration\n${sourceLine}\n`
      await this.deps.fs.writeFile(rcFile, newContent)
    }

    return { rcFile, integrationFile }
  }

  unsetupShellIntegration = async (): Promise<{ rcFile: string; integrationFile: string; removed: string[] }> => {
    const homeDir = this.deps.os.homedir()
    const shell = process.env['SHELL'] || ''

    // Determine the appropriate RC file (same logic as setup)
    let rcFile: string
    if (shell.includes('zsh')) {
      rcFile = this.deps.path.join(homeDir, '.zshrc')
    } else if (shell.includes('bash')) {
      rcFile = this.deps.path.join(homeDir, '.bashrc')
    } else if (shell.includes('fish')) {
      rcFile = this.deps.path.join(homeDir, '.config', 'fish', 'config.fish')
    } else {
      // Default to .bashrc
      rcFile = this.deps.path.join(homeDir, '.bashrc')
    }

    const integrationFile = this.deps.path.join(homeDir, '.envctl-integration.sh')
    const removed: string[] = []

    // Remove integration file
    if (await this.deps.fs.pathExists(integrationFile)) {
      await this.deps.fs.remove(integrationFile)
      removed.push(integrationFile)
    }

    // Remove lines from RC file
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

    // First unload any current profile
    try {
      const state = await this.storage.loadState()
      if (state.currentProfile) {
        await this.unloadProfile()
        removed.push('Unloaded current profile')
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
