#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import * as readline from 'readline'
import { EnvManager } from './env-manager'

const program = new Command()
const envManager = new EnvManager()

// Helper functions
const success = (message: string) => console.log(chalk.green(`✓ ${message}`))
const error = (message: string) => console.log(chalk.red(`✗ ${message}`))
const info = (message: string) => console.log(chalk.blue(`ℹ ${message}`))
const warn = (message: string) => console.log(chalk.yellow(`⚠ ${message}`))

program.name('envctl').description('Environment variable context manager').version('x.x.x')

program
  .command('create')
  .description('Create a new profile')
  .argument('<profile>', 'Profile name')
  .action(async (profile: string) => {
    try {
      await envManager.createProfile(profile)
      success(`Created profile '${profile}'`)
    } catch (err) {
      error((err as Error).message)
      process.exit(1)
    }
  })

program
  .command('add')
  .description('Add/update environment variable(s)')
  .argument('<profile>', 'Profile name')
  .argument('[keyvalue...]', 'KEY=VALUE pairs')
  .option('-f, --file <path>', 'Load variables from file')
  .action(async (profile: string, keyvalues?: string[], options?: { file?: string }) => {
    try {
      if (options?.file) {
        const count = await envManager.addVariablesFromFile(profile, options.file)
        success(`Added ${count} variables from '${options.file}' to profile '${profile}'`)
      } else if (keyvalues && keyvalues.length > 0) {
        const processedVars: Record<string, string> = {}
        const duplicateKeys: string[] = []

        for (const keyvalue of keyvalues) {
          if (!keyvalue.includes('=')) {
            error(`Invalid format for '${keyvalue}'. Use KEY=VALUE`)
            process.exit(1)
          }
          const [key, ...valueParts] = keyvalue.split('=')
          const value = valueParts.join('=')
          if (!key) {
            error(`Invalid format for '${keyvalue}'. Key cannot be empty`)
            process.exit(1)
          }

          if (processedVars[key] !== undefined) {
            // If key is a duplicate, add it to duplicateKeys if it's not already there
            if (!duplicateKeys.includes(key)) {
              duplicateKeys.push(key)
            }
          }

          processedVars[key] = value
        }

        for (const [key, value] of Object.entries(processedVars)) {
          await envManager.addVariable(profile, key, value)
        }

        const addedKeys = Object.keys(processedVars)

        if (addedKeys.length === 1) {
          success(`Added ${addedKeys[0]} to profile '${profile}'`)
        } else {
          success(`Added ${addedKeys.length} variables (${addedKeys.join(', ')}) to profile '${profile}'`)
        }

        if (duplicateKeys.length > 0) {
          warn(`Duplicate keys detected: ${duplicateKeys.join(', ')} (used last value for each)`)
        }
      } else {
        error('Either provide KEY=VALUE pairs or use --file option')
        process.exit(1)
      }
    } catch (err) {
      error((err as Error).message)
      process.exit(1)
    }
  })

program
  .command('remove')
  .description('Remove environment variable')
  .argument('<profile>', 'Profile name')
  .argument('<key>', 'Variable key to remove')
  .action(async (profile: string, key: string) => {
    try {
      await envManager.removeVariable(profile, key)
      success(`Removed ${key} from profile '${profile}'`)
    } catch (err) {
      error((err as Error).message)
      process.exit(1)
    }
  })

program
  .command('load')
  .description('Load profile into current session (reloads if same profile already loaded)')
  .argument('<profile>', 'Profile name')
  .action(async (profile: string) => {
    try {
      const commands = await envManager.loadProfile(profile)
      console.log(commands)
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('unload')
  .description('Unload current profile')
  .action(async () => {
    try {
      const result = await envManager.unloadProfile()
      console.log(result.commands)
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('switch')
  .description('Switch to a different profile (unload current + load new)')
  .argument('<profile>', 'Profile name to switch to')
  .action(async (profile: string) => {
    try {
      const result = await envManager.switchProfile(profile)
      console.log(result.commands)
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`)
      process.exit(1)
    }
  })

program
  .command('status')
  .description('Show current profile status')
  .action(async () => {
    try {
      const status = await envManager.getStatus()

      // Current session status
      if (status.currentSession.profileName) {
        info(
          `Current session: ${chalk.cyan(status.currentSession.profileName)} (${status.currentSession.variableCount} variables)`,
        )
      } else {
        info('Current session: No profile loaded')
      }

      // Other sessions status
      if (status.otherSessions.length > 0) {
        console.log()
        info('Other active sessions:')
        status.otherSessions.forEach((session) => {
          const profileDisplay = session.profileName ? chalk.cyan(session.profileName) : chalk.gray('no profile')
          const sessionDisplay = chalk.yellow(session.sessionId)
          console.log(`  Session ${sessionDisplay}: ${profileDisplay}`)
        })
      }

      // Summary
      if (status.totalSessions > 1) {
        console.log()
        info(`Total active sessions: ${status.totalSessions}`)
      }
    } catch (err) {
      error((err as Error).message)
      process.exit(1)
    }
  })

program
  .command('list')
  .description('List profiles or variables in profile')
  .argument('[profile]', 'Profile name (optional)')
  .option('-s, --sessions', 'Show session information for loaded profiles')
  .action(async (profile?: string, options?: { sessions?: boolean }) => {
    try {
      if (profile) {
        const profileData = await envManager.getProfile(profile)
        if (!profileData) {
          error(`Profile '${profile}' does not exist`)
          process.exit(1)
        }

        console.log(chalk.cyan(`Variables in profile '${profile}':`))
        if (Object.keys(profileData.variables).length === 0) {
          info('No variables defined')
        } else {
          for (const [key, value] of Object.entries(profileData.variables)) {
            console.log(`  ${chalk.yellow(key)}=${value}`)
          }
        }
      } else {
        const profiles = await envManager.listProfiles()
        if (profiles.length === 0) {
          info('No profiles found')
        } else {
          console.log(chalk.cyan('Available profiles:'))
          for (const p of profiles) {
            let status = ''
            if (p.isLoaded) {
              if (options?.sessions && p.loadedInSessions) {
                const sessionList = p.loadedInSessions.map((s) => chalk.yellow(s)).join(', ')
                status = chalk.green(` (loaded in sessions: ${sessionList})`)
              } else {
                status = chalk.green(' (loaded)')
              }
            }
            console.log(`  ${chalk.yellow(p.name)} (${p.variableCount} variables)${status}`)
          }
        }
      }
    } catch (err) {
      error((err as Error).message)
      process.exit(1)
    }
  })

program
  .command('delete')
  .description('Delete a profile')
  .argument('<profile>', 'Profile name')
  .action(async (profile: string) => {
    try {
      await envManager.deleteProfile(profile)
      success(`Deleted profile '${profile}'`)
    } catch (err) {
      error((err as Error).message)
      process.exit(1)
    }
  })

program
  .command('export')
  .description('Export profile to stdout')
  .argument('<profile>', 'Profile name')
  .action(async (profile: string) => {
    try {
      const exported = await envManager.exportProfile(profile)
      console.log(exported)
    } catch (err) {
      error((err as Error).message)
      process.exit(1)
    }
  })

program
  .command('setup')
  .description('Install shell integration functions')
  .action(async () => {
    try {
      const result = await envManager.setupShellIntegration()
      success('Shell integration installed successfully!')
      info(`Integration script: ${result.integrationFile}`)
      info(`Added to: ${result.rcFile}`)
      info('')
      info('Available functions:')
      info('  envctl-load <profile>   (or: ecl <profile>)')
      info('  envctl-unload           (or: ecu)')
      info('  envctl-switch <profile> (or: ecsw <profile>)')
      info('  envctl status           (or: ecs)')
      info('  envctl list             (or: ecls)')
      info('')
      warn(`Please restart your shell or run: source ${result.rcFile}`)
    } catch (err) {
      error((err as Error).message)
      process.exit(1)
    }
  })

program
  .command('unsetup')
  .description('Remove shell integration and optionally all envctl data')
  .option('--all', 'Remove all envctl data including profiles (WARNING: destructive)')
  .option('--force', 'Skip confirmation prompts (for non-interactive use)')
  .action(async (options?: { all?: boolean; force?: boolean }) => {
    try {
      if (options?.all) {
        console.log(chalk.yellow('⚠ WARNING: This will remove ALL envctl data including:'))
        console.log('  - All profiles and their environment variables')
        console.log('  - Shell integration functions')
        console.log('  - Configuration files')
        console.log('')

        // Check if we need confirmation
        let shouldProceed = false

        if (options?.force) {
          // Force flag bypasses confirmation
          shouldProceed = true
        } else if (!process.stdin.isTTY) {
          // Non-interactive environment (CI/automated scripts)
          console.log(chalk.red('✗ Cannot proceed: This is a destructive operation'))
          console.log('  In non-interactive environments, use --force to confirm')
          console.log('  Example: envctl unsetup --all --force')
          process.exit(1)
        } else {
          // Interactive confirmation
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
          })

          try {
            const answer = await new Promise<string>((resolve) => {
              rl.question(chalk.yellow('Are you sure you want to proceed? Type "yes" to confirm: '), resolve)
            })

            shouldProceed = answer.toLowerCase() === 'yes'

            if (!shouldProceed) {
              console.log(chalk.blue('ℹ Operation cancelled.'))
              process.exit(0)
            }
          } finally {
            rl.close()
          }
        }

        if (shouldProceed) {
          const shellResult = await envManager.unsetupShellIntegration()
          const dataResult = await envManager.cleanupAllData()

          const allRemoved = [...shellResult.removed, ...dataResult.removed]

          if (allRemoved.length > 0) {
            success('Complete cleanup completed!')
            info('Removed:')
            allRemoved.forEach((item) => info(`  - ${item}`))
          } else {
            info('No envctl data found to remove')
          }
        }
      } else {
        // Just remove shell integration (no confirmation needed)
        const result = await envManager.unsetupShellIntegration()

        if (result.removed.length > 0) {
          success('Shell integration removed successfully!')
          info('Removed:')
          result.removed.forEach((item) => info(`  - ${item}`))
          info('')
          warn(`Please restart your shell or run: source ${result.rcFile}`)
          info('')
          info('Your profiles and data are still available.')
          info('Use "envctl unsetup --all" to remove everything.')
        } else {
          info('No shell integration found to remove')
        }
      }
    } catch (err) {
      error((err as Error).message)
      process.exit(1)
    }
  })

// Debug command to show session info - temporarily disabled
/*
program
  .command('debug-session')
  .description('Debug session ID generation (for troubleshooting)')
  .action(async () => {
    try {
      const { Storage } = await import('./storage')
      
      const storage = new Storage()
      
      console.log('=== Debug: Session Information ===')
      console.log(`Node.js PID: ${process.pid}`)
      console.log(`Node.js PPID: ${process.ppid}`)
      console.log(`SHLVL: ${process.env.SHLVL}`)
      console.log(`TERM: ${process.env.TERM}`)
      console.log(`TERM_PROGRAM: ${process.env.TERM_PROGRAM}`)
      console.log(`SSH_TTY: ${process.env.SSH_TTY}`)
      
      const sessionId = storage['getSessionId']()
      console.log(`Generated Session ID: ${sessionId}`)
      
      const backupPath = storage['sessionBackupFilePath']
      console.log(`Expected backup file: ${backupPath}`)
      
      // Check if backup file exists
      const fs = require('fs-extra')
      const configDir = storage['config'].configDir
      const files = await fs.readdir(configDir).catch(() => [])
      const backupFiles = files.filter((f: string) => f.startsWith('backup-') && f.endsWith('.env'))
      console.log(`Actual backup files: ${backupFiles.join(', ') || 'none'}`)
      
      // Debug getCurrentlyLoadedProfile
      console.log('\n=== Debug: getCurrentlyLoadedProfile ===')
      const fileExists = await fs.pathExists(backupPath)
      console.log(`Backup file exists: ${fileExists}`)
      
      if (fileExists) {
        const content = await fs.readFile(backupPath, 'utf-8')
        console.log(`Backup file content: ${JSON.stringify(content)}`)
        const lines = content.split('\n')
        console.log(`First line: ${JSON.stringify(lines[0])}`)
        const firstLine = lines[0]?.trim()
        console.log(`First line trimmed: ${JSON.stringify(firstLine)}`)
        console.log(`Starts with profile marker: ${firstLine?.startsWith('# envctl-profile:')}`)
        if (firstLine?.startsWith('# envctl-profile:')) {
          const profileName = firstLine.replace('# envctl-profile:', '').trim()
          console.log(`Extracted profile name: ${JSON.stringify(profileName)}`)
        }
      }
      
      const currentProfile = await storage.getCurrentlyLoadedProfile()
      console.log(`getCurrentlyLoadedProfile result: ${JSON.stringify(currentProfile)}`)
      
      // Debug isSessionActive
      console.log('\n=== Debug: isSessionActive ===')
      console.log(`Testing if session ${sessionId} is active...`)
      const isActive = storage['isSessionActive'](sessionId)
      console.log(`isSessionActive result: ${isActive}`)
      
      // Test PID 1 specifically
      console.log(`Testing if PID 1 is active...`)
      try {
        process.kill(1, 0)
        console.log(`PID 1 signal test: SUCCESS (process exists)`)
      } catch (error) {
        console.log(`PID 1 signal test: FAILED (${error})`)
      }
      
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })
*/

program.parse()

if (!process.argv.slice(2).length) {
  program.outputHelp()
}
