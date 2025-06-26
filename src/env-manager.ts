import { Profile, EnvState } from './types'
import { Storage } from './storage'

export class EnvManager {
  private storage: Storage

  constructor() {
    this.storage = new Storage()
  }

  async createProfile(name: string): Promise<void> {
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

  async addVariable(profileName: string, key: string, value: string): Promise<void> {
    const profile = await this.storage.loadProfile(profileName)
    if (!profile) {
      throw new Error(`Profile '${profileName}' does not exist`)
    }

    profile.variables[key] = value
    profile.updatedAt = new Date()

    await this.storage.saveProfile(profile)
  }

  async addVariablesFromFile(profileName: string, filePath: string): Promise<number> {
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

  async removeVariable(profileName: string, key: string): Promise<void> {
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

  async loadProfile(profileName: string): Promise<void> {
    const profile = await this.storage.loadProfile(profileName)
    if (!profile) {
      throw new Error(`Profile '${profileName}' does not exist`)
    }

    const state = await this.storage.loadState()
    if (state.currentProfile) {
      throw new Error(`Profile '${state.currentProfile}' is already loaded. Unload it first.`)
    }

    // Backup current environment
    const backup: Record<string, string | undefined> = {}
    for (const key of Object.keys(profile.variables)) {
      backup[key] = process.env[key]
    }

    // Load new environment
    for (const [key, value] of Object.entries(profile.variables)) {
      process.env[key] = value
    }

    // Save state
    await this.storage.saveState({
      currentProfile: profileName,
      backup,
    })
  }

  async unloadProfile(): Promise<string> {
    const state = await this.storage.loadState()
    if (!state.currentProfile) {
      throw new Error('No profile is currently loaded')
    }

    const profileName = state.currentProfile

    // Restore environment
    if (state.backup) {
      for (const [key, originalValue] of Object.entries(state.backup)) {
        if (originalValue === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = originalValue
        }
      }
    }

    // Clear state
    await this.storage.saveState({})

    return profileName
  }

  async getStatus(): Promise<{ currentProfile?: string; variableCount?: number }> {
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

  async listProfiles(): Promise<Array<{ name: string; isLoaded: boolean; variableCount: number }>> {
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

  async getProfile(name: string): Promise<Profile | null> {
    return await this.storage.loadProfile(name)
  }

  async deleteProfile(name: string): Promise<void> {
    const state = await this.storage.loadState()
    if (state.currentProfile === name) {
      throw new Error(`Cannot delete profile '${name}' while it is loaded. Unload it first.`)
    }

    const deleted = await this.storage.deleteProfile(name)
    if (!deleted) {
      throw new Error(`Profile '${name}' does not exist`)
    }
  }

  async exportProfile(name: string): Promise<string> {
    const profile = await this.storage.loadProfile(name)
    if (!profile) {
      throw new Error(`Profile '${name}' does not exist`)
    }

    return Object.entries(profile.variables)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')
  }

  async generateShellCommands(profileName: string): Promise<string> {
    const profile = await this.storage.loadProfile(profileName)
    if (!profile) {
      throw new Error(`Profile '${profileName}' does not exist`)
    }

    const state = await this.storage.loadState()
    if (state.currentProfile) {
      throw new Error(`Profile '${state.currentProfile}' is already loaded. Unload it first.`)
    }

    // Generate backup commands for current environment
    const backupCommands: string[] = []
    const setCommands: string[] = []

    for (const key of Object.keys(profile.variables)) {
      // Save current value
      backupCommands.push(`export ENVCTL_BACKUP_${key}="$${key}"`)
    }

    // Generate set commands
    for (const [key, value] of Object.entries(profile.variables)) {
      setCommands.push(`export ${key}="${value}"`)
    }

    // Save state (this still needs to be done by the CLI)
    await this.storage.saveState({
      currentProfile: profileName,
      backup: {}, // We'll track this differently for shell approach
    })

    return [...backupCommands, ...setCommands].join('\n')
  }

  async generateUnloadCommands(): Promise<{ commands: string; profileName: string }> {
    const state = await this.storage.loadState()
    if (!state.currentProfile) {
      throw new Error('No profile is currently loaded')
    }

    const profile = await this.storage.loadProfile(state.currentProfile)
    if (!profile) {
      throw new Error(`Profile '${state.currentProfile}' not found`)
    }

    const commands: string[] = []

    // Restore environment variables
    for (const key of Object.keys(profile.variables)) {
      commands.push(`if [ -n "\${ENVCTL_BACKUP_${key}+x}" ]; then`)
      commands.push(`  export ${key}="\$ENVCTL_BACKUP_${key}"`)
      commands.push(`  unset ENVCTL_BACKUP_${key}`)
      commands.push(`else`)
      commands.push(`  unset ${key}`)
      commands.push(`fi`)
    }

    // Clear state
    await this.storage.saveState({})

    return {
      commands: commands.join('\n'),
      profileName: state.currentProfile,
    }
  }

  async setupShellIntegration(): Promise<{ rcFile: string; integrationFile: string }> {
    const os = await import('os')
    const path = await import('path')
    const fs = await import('fs-extra')

    const homeDir = os.homedir()
    const shell = process.env.SHELL || ''

    // Determine the appropriate RC file
    let rcFile: string
    if (shell.includes('zsh')) {
      rcFile = path.join(homeDir, '.zshrc')
    } else if (shell.includes('bash')) {
      rcFile = path.join(homeDir, '.bashrc')
    } else if (shell.includes('fish')) {
      rcFile = path.join(homeDir, '.config', 'fish', 'config.fish')
    } else {
      // Default to .bashrc
      rcFile = path.join(homeDir, '.bashrc')
    }

    // Copy shell integration script to home directory
    const integrationFile = path.join(homeDir, '.envctl-integration.sh')

    // Get the shell integration script content
    const scriptPath = path.join(__dirname, '..', 'shell-integration.sh')

    let scriptContent: string
    if (await fs.pathExists(scriptPath)) {
      scriptContent = await fs.readFile(scriptPath, 'utf-8')
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

# Aliases for convenience
alias ecl='envctl-load'
alias ecu='envctl-unload'
alias ecs='envctl status'
alias ecls='envctl list'
`
    }

    // Write the integration script
    await fs.writeFile(integrationFile, scriptContent)
    await fs.chmod(integrationFile, 0o755)

    // Check if the source line already exists
    const sourceLine = `source ~/.envctl-integration.sh`
    let rcContent = ''

    if (await fs.pathExists(rcFile)) {
      rcContent = await fs.readFile(rcFile, 'utf-8')
    }

    if (!rcContent.includes(sourceLine)) {
      // Add the source line
      const newContent = rcContent + '\n# envctl shell integration\n' + sourceLine + '\n'
      await fs.writeFile(rcFile, newContent)
    }

    return { rcFile, integrationFile }
  }
}
