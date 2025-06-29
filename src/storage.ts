import fs from 'fs-extra'
import path from 'path'
import { Profile, Config } from './types'
import { getConfig } from './config'

export class Storage {
  private config: Config

  constructor() {
    this.config = getConfig()
    // Don't await in constructor, ensure directories when needed
  }

  private ensureDirectories = async (): Promise<void> => {
    await fs.ensureDir(this.config.configDir)
    await fs.ensureDir(this.config.profilesDir)
  }

  private get backupFilePath(): string {
    return path.join(this.config.configDir, 'backup.env')
  }

  saveProfile = async (profile: Profile): Promise<void> => {
    await this.ensureDirectories()
    const profilePath = path.join(this.config.profilesDir, `${profile.name}.json`)
    await fs.writeJson(profilePath, profile, { spaces: 2 })
  }

  loadProfile = async (name: string): Promise<Profile | null> => {
    await this.ensureDirectories()
    const profilePath = path.join(this.config.profilesDir, `${name}.json`)

    if (!(await fs.pathExists(profilePath))) {
      return null
    }

    return await fs.readJson(profilePath)
  }

  deleteProfile = async (name: string): Promise<boolean> => {
    await this.ensureDirectories()
    const profilePath = path.join(this.config.profilesDir, `${name}.json`)

    if (!(await fs.pathExists(profilePath))) {
      return false
    }

    await fs.remove(profilePath)
    return true
  }

  listProfiles = async (): Promise<string[]> => {
    await this.ensureDirectories()
    const files = await fs.readdir(this.config.profilesDir)
    return files.filter((file) => file.endsWith('.json')).map((file) => path.basename(file, '.json'))
  }

  getCurrentlyLoadedProfile = async (): Promise<string | null> => {
    if (!(await fs.pathExists(this.backupFilePath))) {
      return null
    }

    const content = await fs.readFile(this.backupFilePath, 'utf-8')
    const lines = content.split('\n')

    const firstLine = lines[0]?.trim()
    if (firstLine?.startsWith('# envctl-profile:')) {
      return firstLine.replace('# envctl-profile:', '').trim()
    }

    return 'unknown'
  }

  saveBackup = async (variables: Record<string, string>): Promise<void> => {
    await this.ensureDirectories()

    if (Object.keys(variables).length === 0) {
      if (await fs.pathExists(this.backupFilePath)) {
        await fs.remove(this.backupFilePath)
      }
      return
    }

    const envContent = Object.entries(variables)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    await fs.writeFile(this.backupFilePath, `${envContent}\n`)
  }

  loadBackup = async (): Promise<Record<string, string>> => {
    await this.ensureDirectories()

    if (!(await fs.pathExists(this.backupFilePath))) {
      return {}
    }

    return await this.parseEnvFile(this.backupFilePath)
  }

  clearBackup = async (): Promise<void> => {
    await this.ensureDirectories()

    if (await fs.pathExists(this.backupFilePath)) {
      await fs.remove(this.backupFilePath)
    }
  }

  parseEnvFile = async (filePath: string): Promise<Record<string, string>> => {
    const content = await fs.readFile(filePath, 'utf-8')
    const variables: Record<string, string> = {}

    for (const line of content.split('\n')) {
      const trimmedLine = line.trim()

      if (trimmedLine.startsWith('# envctl-profile:')) {
        continue
      }

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue
      }

      const equalIndex = trimmedLine.indexOf('=')
      if (equalIndex === -1) {
        continue
      }

      const key = trimmedLine.substring(0, equalIndex).trim()
      const value = trimmedLine.substring(equalIndex + 1).trim()

      variables[key] = value.replace(/^["']|["']$/g, '')
    }

    return variables
  }
}
