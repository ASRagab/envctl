#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { EnvManager } from './env-manager'

const program = new Command()
const envManager = new EnvManager()

// Helper functions
const success = (message: string) => console.log(chalk.green('✓ ' + message))
const error = (message: string) => console.log(chalk.red('✗ ' + message))
const info = (message: string) => console.log(chalk.blue('ℹ ' + message))
const warn = (message: string) => console.log(chalk.yellow('⚠ ' + message))

program.name('envctl').description('Environment variable context manager').version('1.0.0')

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
  .description('Add/update environment variable')
  .argument('<profile>', 'Profile name')
  .argument('[keyvalue]', 'KEY=VALUE pair')
  .option('-f, --file <path>', 'Load variables from file')
  .action(async (profile: string, keyvalue?: string, options?: { file?: string }) => {
    try {
      if (options?.file) {
        const count = await envManager.addVariablesFromFile(profile, options.file)
        success(`Added ${count} variables from '${options.file}' to profile '${profile}'`)
      } else if (keyvalue) {
        if (!keyvalue.includes('=')) {
          error('Invalid format. Use KEY=VALUE')
          process.exit(1)
        }
        const [key, ...valueParts] = keyvalue.split('=')
        const value = valueParts.join('=')
        await envManager.addVariable(profile, key, value)
        success(`Added ${key} to profile '${profile}'`)
      } else {
        error('Either provide KEY=VALUE or use --file option')
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
  .description('Load profile into current session')
  .argument('<profile>', 'Profile name')
  .option('--shell', 'Output shell commands to source')
  .action(async (profile: string, options?: { shell?: boolean }) => {
    try {
      if (options?.shell) {
        const commands = await envManager.generateShellCommands(profile)
        console.log(commands)
      } else {
        await envManager.loadProfile(profile)
        success(`Loaded profile '${profile}'`)
        warn('Note: Environment variables are only set within this CLI process.')
        info('For shell integration, use: eval "$(envctl load --shell ' + profile + ')"')
        info("Or run 'envctl unload' to restore previous environment")
      }
    } catch (err) {
      if (options?.shell) {
        // In shell mode, output error to stderr so it doesn't interfere with eval
        console.error(`Error: ${(err as Error).message}`)
        process.exit(1)
      } else {
        error((err as Error).message)
        process.exit(1)
      }
    }
  })

program
  .command('unload')
  .description('Unload current profile')
  .option('--shell', 'Output shell commands to source')
  .action(async (options?: { shell?: boolean }) => {
    try {
      if (options?.shell) {
        const result = await envManager.generateUnloadCommands()
        console.log(result.commands)
      } else {
        const profileName = await envManager.unloadProfile()
        success(`Unloaded profile '${profileName}'`)
        warn('Note: Environment variables are only unset within this CLI process.')
        info('For shell integration, use: eval "$(envctl unload --shell)"')
      }
    } catch (err) {
      if (options?.shell) {
        // In shell mode, output error to stderr so it doesn't interfere with eval
        console.error(`Error: ${(err as Error).message}`)
        process.exit(1)
      } else {
        error((err as Error).message)
        process.exit(1)
      }
    }
  })

program
  .command('status')
  .description('Show current profile status')
  .action(async () => {
    try {
      const status = await envManager.getStatus()
      if (status.currentProfile) {
        info(`Currently loaded: ${chalk.cyan(status.currentProfile)} (${status.variableCount} variables)`)
      } else {
        info('No profile currently loaded')
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
  .action(async (profile?: string) => {
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
            const status = p.isLoaded ? chalk.green(' (loaded)') : ''
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
      info('  envctl-load <profile>  (or: ecl <profile>)')
      info('  envctl-unload          (or: ecu)')
      info('  envctl status          (or: ecs)')
      info('  envctl list            (or: ecls)')
      info('')
      warn('Please restart your shell or run: source ' + result.rcFile)
    } catch (err) {
      error((err as Error).message)
      process.exit(1)
    }
  })

// Parse command line arguments
program.parse()

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp()
}
