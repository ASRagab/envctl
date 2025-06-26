import fs from 'fs-extra'
import path from 'path'
import { Profile, EnvState, Config } from './types'
import { getConfig } from './config'

export class Storage {
  private config: Config

  constructor() {
    this.config = getConfig()
    // Don't await in constructor, ensure directories when needed
  }

  private async ensureDirectories(): Promise<void> {
    await fs.ensureDir(this.config.configDir)
    await fs.ensureDir(this.config.profilesDir)
  }

  async saveProfile(profile: Profile): Promise<void> {
    await this.ensureDirectories()
    const profilePath = path.join(this.config.profilesDir, `${profile.name}.json`)
    await fs.writeJson(profilePath, profile, { spaces: 2 })
  }

  async loadProfile(name: string): Promise<Profile | null> {
    await this.ensureDirectories()
    const profilePath = path.join(this.config.profilesDir, `${name}.json`)

    if (!(await fs.pathExists(profilePath))) {
      return null
    }

    return await fs.readJson(profilePath)
  }

  async deleteProfile(name: string): Promise<boolean> {
    await this.ensureDirectories()
    const profilePath = path.join(this.config.profilesDir, `${name}.json`)

    if (!(await fs.pathExists(profilePath))) {
      return false
    }

    await fs.remove(profilePath)
    return true
  }

  async listProfiles(): Promise<string[]> {
    await this.ensureDirectories()
    const files = await fs.readdir(this.config.profilesDir)
    return files.filter((file) => file.endsWith('.json')).map((file) => path.basename(file, '.json'))
  }

  async saveState(state: EnvState): Promise<void> {
    await this.ensureDirectories()
    await fs.writeJson(this.config.stateFile, state, { spaces: 2 })
  }

  async loadState(): Promise<EnvState> {
    await this.ensureDirectories()
    if (!(await fs.pathExists(this.config.stateFile))) {
      return {}
    }

    return await fs.readJson(this.config.stateFile)
  }

  async parseEnvFile(filePath: string): Promise<Record<string, string>> {
    const content = await fs.readFile(filePath, 'utf-8')
    const variables: Record<string, string> = {}

    for (const line of content.split('\n')) {
      const trimmedLine = line.trim()

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue
      }

      const equalIndex = trimmedLine.indexOf('=')
      if (equalIndex === -1) {
        continue
      }

      const key = trimmedLine.substring(0, equalIndex).trim()
      const value = trimmedLine.substring(equalIndex + 1).trim()

      // Remove quotes if present
      variables[key] = value.replace(/^["']|["']$/g, '')
    }

    return variables
  }
}
