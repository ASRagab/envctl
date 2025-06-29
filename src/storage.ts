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

  private getSessionId(): string {
    // Universal approach: Use shell PID + SHLVL combination
    // The key insight: shell commands and Node.js CLI have parent-child relationship
    // Shell creates backup with shell's PPID, but Node.js CLI should use shell's PID
    // Solution: Node.js CLI uses its PPID (which is shell's PID) as the session base

    const shellPid = process.ppid || 0 // Node.js CLI's PPID = Shell's PID
    const shlvl = process.env.SHLVL || '1'

    // Add terminal context if available for additional uniqueness
    // Handle Docker environment where Node.js might not inherit TERM properly
    let terminalContext = ''
    if (process.env.TERM_PROGRAM) {
      terminalContext = `-${process.env.TERM_PROGRAM}`
    } else if (process.env.SSH_TTY) {
      terminalContext = '-ssh'
    } else if (process.env.TERM) {
      terminalContext = `-${process.env.TERM.split('-')[0]}` // e.g., "xterm" from "xterm-256color"
    } else if (shlvl === '2') {
      // In Docker/containerized environments, SHLVL=2 often means TERM=dumb
      // This handles the case where shell sees TERM=dumb but Node.js sees undefined
      terminalContext = '-dumb'
    }

    return `${shellPid}-${shlvl}${terminalContext}`
  }

  private get sessionBackupFilePath(): string {
    const sessionId = this.getSessionId()
    return path.join(this.config.configDir, `backup-${sessionId}.env`)
  }

  private isSessionActive = (sessionId: string): boolean => {
    try {
      // Extract shell PID from session ID (format: shellPid-shlvl-terminalContext)
      const parts = sessionId.split('-')
      const shellPid = parseInt(parts[0], 10)

      if (isNaN(shellPid)) return false

      // Use kill -0 to check if shell process exists (doesn't actually kill)
      process.kill(shellPid, 0)
      return true
    } catch {
      // If we can't signal the process, it's not active
      return false
    }
  }

  private cleanupOrphanedBackups = async (): Promise<void> => {
    try {
      const files = await fs.readdir(this.config.configDir)
      const backupFiles = files.filter((file) => file.startsWith('backup-') && file.endsWith('.env'))

      for (const file of backupFiles) {
        const sessionId = file.replace('backup-', '').replace('.env', '')

        // Skip current session
        if (sessionId === this.getSessionId()) continue

        // Check file age - don't clean up files less than 5 minutes old
        // This prevents cleaning up active sessions from different processes
        const filePath = path.join(this.config.configDir, file)
        try {
          const stats = await fs.stat(filePath)
          const fileAge = Date.now() - stats.mtime.getTime()
          const fiveMinutes = 5 * 60 * 1000

          if (fileAge < fiveMinutes) {
            continue // Skip recent files
          }
        } catch {
          // If we can't stat the file, skip it
          continue
        }

        // Check if session is still active
        if (!this.isSessionActive(sessionId)) {
          await fs.remove(filePath)
        }
      }
    } catch {
      // Ignore cleanup errors - they shouldn't break normal operations
    }
  }

  private get backupFilePath(): string {
    return this.sessionBackupFilePath
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
    await this.ensureDirectories()
    await this.cleanupOrphanedBackups()

    // Only check the current session - strict session awareness
    if (await fs.pathExists(this.backupFilePath)) {
      const content = await fs.readFile(this.backupFilePath, 'utf-8')
      const lines = content.split('\n')

      const firstLine = lines[0]?.trim()
      if (firstLine?.startsWith('# envctl-profile:')) {
        const profileName = firstLine.replace('# envctl-profile:', '').trim()
        return profileName
      }

      return 'unknown'
    }

    // No profile loaded in current session
    return null
  }

  saveBackup = async (variables: Record<string, string>): Promise<void> => {
    await this.ensureDirectories()
    await this.cleanupOrphanedBackups()

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
    await this.cleanupOrphanedBackups()

    if (await fs.pathExists(this.backupFilePath)) {
      await fs.remove(this.backupFilePath)
    }
  }

  listActiveSessions = async (): Promise<Array<{ sessionId: string; profileName: string }>> => {
    await this.ensureDirectories()
    await this.cleanupOrphanedBackups()

    const sessions: Array<{ sessionId: string; profileName: string }> = []

    try {
      const files = await fs.readdir(this.config.configDir)
      const backupFiles = files.filter((file) => file.startsWith('backup-') && file.endsWith('.env'))

      for (const file of backupFiles) {
        const sessionId = file.replace('backup-', '').replace('.env', '')

        try {
          const filePath = path.join(this.config.configDir, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const lines = content.split('\n')
          const firstLine = lines[0]?.trim()

          let profileName: string = 'unknown' // Default to unknown
          if (firstLine?.startsWith('# envctl-profile:')) {
            profileName = firstLine.replace('# envctl-profile:', '').trim()
          }

          // Only add sessions that have content (skip empty files)
          if (content.trim()) {
            sessions.push({ sessionId, profileName })
          }
        } catch {
          // Skip files we can't read
        }
      }
    } catch {
      // Return empty array if we can't read the directory
    }

    return sessions
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
