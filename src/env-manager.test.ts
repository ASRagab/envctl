import { EnvManager } from './env-manager'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'

describe('EnvManager', () => {
  let envManager: EnvManager
  let tempDir: string
  let originalEnv: Record<string, string | undefined>

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `envctl-test-${Date.now()}`)

    // Mock the config to use our temp directory
    jest.doMock('./config', () => ({
      getConfig: () => ({
        configDir: tempDir,
        profilesDir: path.join(tempDir, 'profiles'),
        stateFile: path.join(tempDir, 'state.json'),
      }),
    }))

    // Create the EnvManager after mocking
    const { EnvManager: MockedEnvManager } = await import('./env-manager')
    envManager = new MockedEnvManager()

    // Backup original environment
    originalEnv = { ...process.env }
  })

  afterEach(async () => {
    // Restore original environment
    if (originalEnv) {
      Object.keys(process.env).forEach((key) => {
        if (!(key in originalEnv)) {
          delete process.env[key]
        }
      })
      Object.assign(process.env, originalEnv)
    }

    // Clean up temp files
    try {
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir)
      }
    } catch {
      // Ignore cleanup errors
    }
    jest.resetModules()
  })

  describe('createProfile', () => {
    it('should create a new profile', async () => {
      await envManager.createProfile('test-profile')

      const profile = await envManager.getProfile('test-profile')
      expect(profile).toBeTruthy()
      expect(profile?.name).toBe('test-profile')
      expect(profile?.variables).toEqual({})
    })

    it('should throw error if profile already exists', async () => {
      await envManager.createProfile('test-profile')

      await expect(envManager.createProfile('test-profile')).rejects.toThrow("Profile 'test-profile' already exists")
    })
  })

  describe('addVariable', () => {
    beforeEach(async () => {
      await envManager.createProfile('test-profile')
    })

    it('should add a variable to profile', async () => {
      await envManager.addVariable('test-profile', 'TEST_VAR', 'test-value')

      const profile = await envManager.getProfile('test-profile')
      expect(profile?.variables.TEST_VAR).toBe('test-value')
    })

    it('should update existing variable', async () => {
      await envManager.addVariable('test-profile', 'TEST_VAR', 'old-value')
      await envManager.addVariable('test-profile', 'TEST_VAR', 'new-value')

      const profile = await envManager.getProfile('test-profile')
      expect(profile?.variables.TEST_VAR).toBe('new-value')
    })

    it('should add multiple variables in sequence', async () => {
      await envManager.addVariable('test-profile', 'VAR1', 'value1')
      await envManager.addVariable('test-profile', 'VAR2', 'value2')
      await envManager.addVariable('test-profile', 'VAR3', 'value3')

      const profile = await envManager.getProfile('test-profile')
      expect(profile?.variables).toEqual({
        VAR1: 'value1',
        VAR2: 'value2',
        VAR3: 'value3',
      })
    })

    it('should handle variables with special characters in values', async () => {
      await envManager.addVariable('test-profile', 'DATABASE_URL', 'postgresql://user:pass@host:5432/db')
      await envManager.addVariable('test-profile', 'SPECIAL_VAR', 'value with spaces and = signs')

      const profile = await envManager.getProfile('test-profile')
      expect(profile?.variables.DATABASE_URL).toBe('postgresql://user:pass@host:5432/db')
      expect(profile?.variables.SPECIAL_VAR).toBe('value with spaces and = signs')
    })

    it('should handle duplicate keys by taking the last value', async () => {
      // Simulate what the CLI does with duplicate keys
      await envManager.addVariable('test-profile', 'DATABASE_URL', 'first-value')
      await envManager.addVariable('test-profile', 'API_KEY', 'secret123')
      await envManager.addVariable('test-profile', 'DATABASE_URL', 'second-value')
      await envManager.addVariable('test-profile', 'DATABASE_URL', 'final-value')

      const profile = await envManager.getProfile('test-profile')
      expect(profile?.variables.DATABASE_URL).toBe('final-value')
      expect(profile?.variables.API_KEY).toBe('secret123')
    })

    it('should handle multiple duplicate keys correctly', async () => {
      // Simulate adding variables with multiple different keys being duplicated
      await envManager.addVariable('test-profile', 'KEY1', 'value1-first')
      await envManager.addVariable('test-profile', 'KEY2', 'value2-first')
      await envManager.addVariable('test-profile', 'KEY3', 'value3-only')
      await envManager.addVariable('test-profile', 'KEY1', 'value1-second')
      await envManager.addVariable('test-profile', 'KEY2', 'value2-second')
      await envManager.addVariable('test-profile', 'KEY1', 'value1-final')

      const profile = await envManager.getProfile('test-profile')
      expect(profile?.variables.KEY1).toBe('value1-final')
      expect(profile?.variables.KEY2).toBe('value2-second')
      expect(profile?.variables.KEY3).toBe('value3-only')
    })

    it('should throw error if profile does not exist', async () => {
      await expect(envManager.addVariable('nonexistent', 'TEST_VAR', 'test-value')).rejects.toThrow(
        "Profile 'nonexistent' does not exist",
      )
    })
  })

  describe('addVariablesFromFile', () => {
    let envFilePath: string

    beforeEach(async () => {
      await envManager.createProfile('test-profile')
      envFilePath = path.join(tempDir, 'test.env')
    })

    it('should import variables from .env file', async () => {
      const envContent = `# Test environment file
DATABASE_URL=postgresql://localhost/test
API_KEY=secret123
NODE_ENV=development

# Another variable
DEBUG=true`

      await fs.writeFile(envFilePath, envContent)

      const count = await envManager.addVariablesFromFile('test-profile', envFilePath)
      expect(count).toBe(4)

      const profile = await envManager.getProfile('test-profile')
      expect(profile?.variables).toEqual({
        DATABASE_URL: 'postgresql://localhost/test',
        API_KEY: 'secret123',
        NODE_ENV: 'development',
        DEBUG: 'true',
      })
    })

    it('should handle quoted values correctly', async () => {
      const envContent = `API_KEY="quoted value"
SECRET='single quoted'
UNQUOTED=no quotes`

      await fs.writeFile(envFilePath, envContent)

      await envManager.addVariablesFromFile('test-profile', envFilePath)

      const profile = await envManager.getProfile('test-profile')
      expect(profile?.variables).toEqual({
        API_KEY: 'quoted value',
        SECRET: 'single quoted',
        UNQUOTED: 'no quotes',
      })
    })

    it('should throw error if profile does not exist', async () => {
      await fs.writeFile(envFilePath, 'TEST=value')

      await expect(envManager.addVariablesFromFile('nonexistent', envFilePath)).rejects.toThrow(
        "Profile 'nonexistent' does not exist",
      )
    })
  })

  describe('removeVariable', () => {
    beforeEach(async () => {
      await envManager.createProfile('test-profile')
      await envManager.addVariable('test-profile', 'TEST_VAR', 'test-value')
    })

    it('should remove a variable from profile', async () => {
      await envManager.removeVariable('test-profile', 'TEST_VAR')

      const profile = await envManager.getProfile('test-profile')
      expect(profile?.variables).not.toHaveProperty('TEST_VAR')
    })

    it('should throw error if variable does not exist', async () => {
      await expect(envManager.removeVariable('test-profile', 'NONEXISTENT')).rejects.toThrow(
        "Variable 'NONEXISTENT' not found in profile 'test-profile'",
      )
    })

    it('should throw error if profile does not exist', async () => {
      await expect(envManager.removeVariable('nonexistent', 'TEST_VAR')).rejects.toThrow(
        "Profile 'nonexistent' does not exist",
      )
    })
  })

  describe('loadProfile and unloadProfile', () => {
    beforeEach(async () => {
      await envManager.createProfile('test-profile')
      await envManager.addVariable('test-profile', 'TEST_VAR', 'test-value')
      await envManager.addVariable('test-profile', 'API_KEY', 'secret123')
    })

    it('should generate correct shell commands for loading', async () => {
      const commands = await envManager.loadProfile('test-profile')

      // Should include backup file creation with profile marker
      expect(commands).toContain('echo "# envctl-profile:test-profile" > ~/.envctl/backup.env')
      // Should include backup commands for existing variables
      expect(commands).toContain('[ -n "${TEST_VAR+x}" ] && echo "TEST_VAR=$TEST_VAR" >> ~/.envctl/backup.env')
      expect(commands).toContain('[ -n "${API_KEY+x}" ] && echo "API_KEY=$API_KEY" >> ~/.envctl/backup.env')
      // Should include export commands
      expect(commands).toContain('export TEST_VAR="test-value"')
      expect(commands).toContain('export API_KEY="secret123"')
    })

    it('should generate reload commands when same profile already loaded', async () => {
      // Simulate profile being loaded by creating backup file
      const { getConfig } = await import('./config')
      const config = getConfig()
      const backupFile = path.join(config.configDir, 'backup.env')
      await fs.ensureDir(config.configDir)
      await fs.writeFile(backupFile, '# envctl-profile:test-profile\nTEST_VAR=old-value\n')

      const commands = await envManager.loadProfile('test-profile')

      // Should include unload commands first
      expect(commands).toContain('if grep -q "^TEST_VAR=" ~/.envctl/backup.env 2>/dev/null; then')
      expect(commands).toContain('export TEST_VAR="$(grep "^TEST_VAR=" ~/.envctl/backup.env | cut -d\'=\' -f2-)"')
      expect(commands).toContain('unset TEST_VAR')
      // Then load commands
      expect(commands).toContain('echo "# envctl-profile:test-profile" > ~/.envctl/backup.env')
      expect(commands).toContain('export TEST_VAR="test-value"')
    })

    it('should throw error if trying to load different profile when one already loaded', async () => {
      // Simulate different profile being loaded
      const { getConfig } = await import('./config')
      const config = getConfig()
      const backupFile = path.join(config.configDir, 'backup.env')
      await fs.ensureDir(config.configDir)
      await fs.writeFile(backupFile, '# envctl-profile:other-profile\n')

      await expect(envManager.loadProfile('test-profile')).rejects.toThrow(
        "Profile 'other-profile' is already loaded. Use 'envctl switch test-profile' to switch profiles.",
      )
    })

    it('should generate unload commands correctly', async () => {
      // Simulate profile being loaded
      const { getConfig } = await import('./config')
      const config = getConfig()
      const backupFile = path.join(config.configDir, 'backup.env')
      await fs.ensureDir(config.configDir)
      await fs.writeFile(
        backupFile,
        '# envctl-profile:test-profile\nTEST_VAR=original-value\nAPI_KEY=original-secret\n',
      )

      const result = await envManager.unloadProfile()

      expect(result.profileName).toBe('test-profile')
      expect(result.commands).toContain('if grep -q "^TEST_VAR=" ~/.envctl/backup.env 2>/dev/null; then')
      expect(result.commands).toContain(
        'export TEST_VAR="$(grep "^TEST_VAR=" ~/.envctl/backup.env | cut -d\'=\' -f2-)"',
      )
      expect(result.commands).toContain('if grep -q "^API_KEY=" ~/.envctl/backup.env 2>/dev/null; then')
      expect(result.commands).toContain('export API_KEY="$(grep "^API_KEY=" ~/.envctl/backup.env | cut -d\'=\' -f2-)"')
      expect(result.commands).toContain('rm -f ~/.envctl/backup.env')
    })

    it('should throw error if trying to unload when no profile loaded', async () => {
      await expect(envManager.unloadProfile()).rejects.toThrow('No profile is currently loaded')
    })

    it('should throw error if profile does not exist', async () => {
      await expect(envManager.loadProfile('nonexistent')).rejects.toThrow("Profile 'nonexistent' does not exist")
    })

    it('should handle unknown profile unload', async () => {
      // Simulate backup file without profile marker
      const { getConfig } = await import('./config')
      const config = getConfig()
      const backupFile = path.join(config.configDir, 'backup.env')
      await fs.ensureDir(config.configDir)
      await fs.writeFile(backupFile, 'TEST_VAR=some-value\n')

      const result = await envManager.unloadProfile()

      expect(result.profileName).toBe('unknown')
      expect(result.commands).toBe('rm -f ~/.envctl/backup.env')
    })
  })

  describe('exportProfile', () => {
    beforeEach(async () => {
      await envManager.createProfile('test-profile')
      await envManager.addVariable('test-profile', 'DATABASE_URL', 'postgresql://localhost/test')
      await envManager.addVariable('test-profile', 'API_KEY', 'secret123')
    })

    it('should export profile in correct format', async () => {
      const exported = await envManager.exportProfile('test-profile')

      expect(exported).toContain('DATABASE_URL=postgresql://localhost/test')
      expect(exported).toContain('API_KEY=secret123')
    })

    it('should throw error if profile does not exist', async () => {
      await expect(envManager.exportProfile('nonexistent')).rejects.toThrow("Profile 'nonexistent' does not exist")
    })
  })

  describe('deleteProfile', () => {
    beforeEach(async () => {
      await envManager.createProfile('test-profile')
    })

    it('should delete a profile', async () => {
      await envManager.deleteProfile('test-profile')

      const profile = await envManager.getProfile('test-profile')
      expect(profile).toBeNull()
    })

    it('should throw error if trying to delete loaded profile', async () => {
      await envManager.addVariable('test-profile', 'TEST_VAR', 'value')

      // Simulate profile being loaded by creating backup file
      const { getConfig } = await import('./config')
      const config = getConfig()
      const backupFile = path.join(config.configDir, 'backup.env')
      await fs.ensureDir(config.configDir)
      await fs.writeFile(backupFile, '# envctl-profile:test-profile\nTEST_VAR=old-value\n')

      await expect(envManager.deleteProfile('test-profile')).rejects.toThrow(
        "Cannot delete profile 'test-profile' while it is loaded. Unload it first.",
      )
    })

    it('should throw error if profile does not exist', async () => {
      await expect(envManager.deleteProfile('nonexistent')).rejects.toThrow("Profile 'nonexistent' does not exist")
    })
  })

  describe('listProfiles', () => {
    it('should list all profiles with correct status', async () => {
      await envManager.createProfile('profile1')
      await envManager.createProfile('profile2')
      await envManager.addVariable('profile1', 'TEST_VAR', 'value')

      // Simulate profile1 being loaded by creating backup file
      const { getConfig } = await import('./config')
      const config = getConfig()
      const backupFile = path.join(config.configDir, 'backup.env')
      await fs.ensureDir(config.configDir)
      await fs.writeFile(backupFile, '# envctl-profile:profile1\nTEST_VAR=old-value\n')

      const profiles = await envManager.listProfiles()

      expect(profiles).toHaveLength(2)
      expect(profiles.find((p) => p.name === 'profile1')).toEqual({
        name: 'profile1',
        isLoaded: true,
        variableCount: 1,
      })
      expect(profiles.find((p) => p.name === 'profile2')).toEqual({
        name: 'profile2',
        isLoaded: false,
        variableCount: 0,
      })
    })

    it('should return empty array when no profiles exist', async () => {
      const profiles = await envManager.listProfiles()
      expect(profiles).toEqual([])
    })
  })

  describe('getStatus', () => {
    it('should return empty status when no profile loaded', async () => {
      const status = await envManager.getStatus()
      expect(status).toEqual({})
    })

    it('should return correct status when profile loaded', async () => {
      await envManager.createProfile('test-profile')
      await envManager.addVariable('test-profile', 'TEST_VAR', 'value')

      // Simulate profile being loaded by creating backup file
      const { getConfig } = await import('./config')
      const config = getConfig()
      const backupFile = path.join(config.configDir, 'backup.env')
      await fs.ensureDir(config.configDir)
      await fs.writeFile(backupFile, '# envctl-profile:test-profile\nTEST_VAR=old-value\n')

      const status = await envManager.getStatus()
      expect(status).toEqual({
        currentProfile: 'test-profile',
        variableCount: 1,
      })
    })
  })

  describe('switchProfile', () => {
    beforeEach(async () => {
      await envManager.createProfile('profile-a')
      await envManager.addVariable('profile-a', 'PROFILE_A_VAR', 'value-a')
      await envManager.addVariable('profile-a', 'SHARED_VAR', 'from-a')

      await envManager.createProfile('profile-b')
      await envManager.addVariable('profile-b', 'PROFILE_B_VAR', 'value-b')
      await envManager.addVariable('profile-b', 'SHARED_VAR', 'from-b')
    })

    it('should generate switch commands when no profile is loaded', async () => {
      const result = await envManager.switchProfile('profile-a')

      expect(result.from).toBeUndefined()
      expect(result.to).toBe('profile-a')
      expect(result.commands).toContain('export PROFILE_A_VAR="value-a"')
      expect(result.commands).toContain('export SHARED_VAR="from-a"')
      expect(result.commands).toContain('echo "# envctl-profile:profile-a" > ~/.envctl/backup.env')
      expect(result.commands).toContain(
        '[ -n "${PROFILE_A_VAR+x}" ] && echo "PROFILE_A_VAR=$PROFILE_A_VAR" >> ~/.envctl/backup.env',
      )
      expect(result.commands).toContain(
        '[ -n "${SHARED_VAR+x}" ] && echo "SHARED_VAR=$SHARED_VAR" >> ~/.envctl/backup.env',
      )
    })

    it('should generate switch commands when profile is already loaded', async () => {
      // Simulate profile-a being loaded
      const { getConfig } = await import('./config')
      const config = getConfig()
      const backupFile = path.join(config.configDir, 'backup.env')
      await fs.ensureDir(config.configDir)
      await fs.writeFile(backupFile, '# envctl-profile:profile-a\nPROFILE_A_VAR=old-value\n')

      const result = await envManager.switchProfile('profile-b')

      expect(result.from).toBe('profile-a')
      expect(result.to).toBe('profile-b')

      // Should contain unload commands for profile-a
      expect(result.commands).toContain('if grep -q "^PROFILE_A_VAR=" ~/.envctl/backup.env')
      expect(result.commands).toContain('if grep -q "^SHARED_VAR=" ~/.envctl/backup.env')

      // Should contain load commands for profile-b
      expect(result.commands).toContain('export PROFILE_B_VAR="value-b"')
      expect(result.commands).toContain('export SHARED_VAR="from-b"')
      expect(result.commands).toContain('echo "# envctl-profile:profile-b" > ~/.envctl/backup.env')
    })

    it('should handle switching to the same profile (reload)', async () => {
      // Simulate profile-a being loaded
      const { getConfig } = await import('./config')
      const config = getConfig()
      const backupFile = path.join(config.configDir, 'backup.env')
      await fs.ensureDir(config.configDir)
      await fs.writeFile(backupFile, '# envctl-profile:profile-a\nPROFILE_A_VAR=old-value\n')

      const result = await envManager.switchProfile('profile-a')

      expect(result.from).toBe('profile-a')
      expect(result.to).toBe('profile-a')

      // Should contain reload commands (unload then load)
      expect(result.commands).toContain('if grep -q "^PROFILE_A_VAR=" ~/.envctl/backup.env')
      expect(result.commands).toContain('export PROFILE_A_VAR="value-a"')
      expect(result.commands).toContain('echo "# envctl-profile:profile-a" > ~/.envctl/backup.env')
    })

    it('should throw error if target profile does not exist', async () => {
      await expect(envManager.switchProfile('nonexistent')).rejects.toThrow("Profile 'nonexistent' does not exist")
    })

    it('should handle switch from unknown profile', async () => {
      // Simulate backup file without profile marker (unknown profile)
      const { getConfig } = await import('./config')
      const config = getConfig()
      const backupFile = path.join(config.configDir, 'backup.env')
      await fs.ensureDir(config.configDir)
      await fs.writeFile(backupFile, 'SOME_VAR=some-value\n')

      const result = await envManager.switchProfile('profile-a')

      expect(result.from).toBe('unknown')
      expect(result.to).toBe('profile-a')
      expect(result.commands).toContain('export PROFILE_A_VAR="value-a"')
      expect(result.commands).toContain('echo "# envctl-profile:profile-a" > ~/.envctl/backup.env')
    })
  })

  describe('setupShellIntegration', () => {
    let originalShell: string | undefined
    let mockHomeDir: string
    let testEnvManager: EnvManager

    beforeEach(async () => {
      originalShell = process.env.SHELL
      mockHomeDir = path.join(tempDir, 'home')

      await fs.ensureDir(mockHomeDir)

      // Create test EnvManager with mocked dependencies
      testEnvManager = new (await import('./env-manager')).EnvManager({
        os: {
          ...os,
          homedir: () => mockHomeDir,
        },
        path,
        fs,
      })
    })

    afterEach(() => {
      if (originalShell !== undefined) {
        process.env.SHELL = originalShell
      } else {
        delete process.env.SHELL
      }
    })

    it('should setup shell integration for zsh', async () => {
      process.env.SHELL = '/bin/zsh'

      const result = await testEnvManager.setupShellIntegration()

      expect(result.rcFile).toBe(path.join(mockHomeDir, '.zshrc'))
      expect(result.integrationFile).toBe(path.join(mockHomeDir, '.envctl-integration.sh'))

      // Check that integration file was created
      expect(await fs.pathExists(result.integrationFile)).toBe(true)

      // Check that content includes the required functions
      const content = await fs.readFile(result.integrationFile, 'utf-8')
      expect(content).toContain('envctl-load()')
      expect(content).toContain('envctl-unload()')
      expect(content).toContain('envctl-switch()')
      expect(content).toContain('alias ecl=')
      expect(content).toContain('alias ecu=')
      expect(content).toContain('alias ecsw=')
    })

    it('should setup shell integration for bash', async () => {
      process.env.SHELL = '/bin/bash'

      const result = await testEnvManager.setupShellIntegration()

      expect(result.rcFile).toBe(path.join(mockHomeDir, '.bashrc'))
      expect(result.integrationFile).toBe(path.join(mockHomeDir, '.envctl-integration.sh'))
    })

    it('should handle existing RC file and avoid duplicate entries', async () => {
      process.env.SHELL = '/bin/bash'

      const rcFile = path.join(mockHomeDir, '.bashrc')

      // Create existing RC file
      await fs.writeFile(rcFile, '# existing content\nexport PATH=/usr/local/bin:$PATH\n')

      await testEnvManager.setupShellIntegration()
      const content1 = await fs.readFile(rcFile, 'utf-8')

      // Should add the source line
      expect(content1).toContain('source ~/.envctl-integration.sh')

      // Run setup again
      await testEnvManager.setupShellIntegration()
      const content2 = await fs.readFile(rcFile, 'utf-8')

      // Should not duplicate the source line
      const sourceLines = content2.split('\n').filter((line) => line.includes('source ~/.envctl-integration.sh'))
      expect(sourceLines).toHaveLength(1)
    })
  })

  describe('unsetupShellIntegration', () => {
    let originalShell: string | undefined
    let mockHomeDir: string
    let testEnvManager: EnvManager

    beforeEach(async () => {
      originalShell = process.env.SHELL
      mockHomeDir = path.join(tempDir, 'home')

      await fs.ensureDir(mockHomeDir)

      // Create test EnvManager with mocked dependencies
      testEnvManager = new (await import('./env-manager')).EnvManager({
        os: {
          ...os,
          homedir: () => mockHomeDir,
        },
        path,
        fs,
      })
    })

    afterEach(() => {
      if (originalShell !== undefined) {
        process.env.SHELL = originalShell
      } else {
        delete process.env.SHELL
      }
    })

    it('should remove shell integration files and RC file lines', async () => {
      process.env.SHELL = '/bin/zsh'

      // First setup integration
      await testEnvManager.setupShellIntegration()

      const rcFile = path.join(mockHomeDir, '.zshrc')
      const integrationFile = path.join(mockHomeDir, '.envctl-integration.sh')

      // Verify files were created
      expect(await fs.pathExists(integrationFile)).toBe(true)
      const rcContent = await fs.readFile(rcFile, 'utf-8')
      expect(rcContent).toContain('# envctl shell integration')
      expect(rcContent).toContain('source ~/.envctl-integration.sh')

      // Now unsetup
      const result = await testEnvManager.unsetupShellIntegration()

      expect(result.rcFile).toBe(rcFile)
      expect(result.integrationFile).toBe(integrationFile)
      expect(result.removed).toContain(integrationFile)
      expect(result.removed).toContain(`${rcFile} (removed envctl lines)`)

      // Verify files were removed/cleaned
      expect(await fs.pathExists(integrationFile)).toBe(false)
      const cleanedRcContent = await fs.readFile(rcFile, 'utf-8')
      expect(cleanedRcContent).not.toContain('# envctl shell integration')
      expect(cleanedRcContent).not.toContain('source ~/.envctl-integration.sh')
    })

    it('should handle case where integration file does not exist', async () => {
      process.env.SHELL = '/bin/bash'

      const result = await testEnvManager.unsetupShellIntegration()

      expect(result.removed).toHaveLength(0)
    })

    it('should preserve other content in RC file', async () => {
      process.env.SHELL = '/bin/bash'

      const rcFile = path.join(mockHomeDir, '.bashrc')

      // Create RC file with existing content
      const existingContent = `# My custom bashrc
export PATH=/usr/local/bin:$PATH
alias ll='ls -la'

# Some other config
export EDITOR=vim`

      await fs.writeFile(rcFile, existingContent)

      // Setup integration
      await testEnvManager.setupShellIntegration()

      // Verify integration was added
      let rcContent = await fs.readFile(rcFile, 'utf-8')
      expect(rcContent).toContain('# envctl shell integration')
      expect(rcContent).toContain('source ~/.envctl-integration.sh')
      expect(rcContent).toContain('export PATH=/usr/local/bin:$PATH')

      // Unsetup
      await testEnvManager.unsetupShellIntegration()

      // Verify envctl lines removed but other content preserved
      rcContent = await fs.readFile(rcFile, 'utf-8')
      expect(rcContent).not.toContain('# envctl shell integration')
      expect(rcContent).not.toContain('source ~/.envctl-integration.sh')
      expect(rcContent).toContain('export PATH=/usr/local/bin:$PATH')
      expect(rcContent).toContain('alias ll=')
      expect(rcContent).toContain('export EDITOR=vim')
    })

    it('should handle case where RC file does not exist', async () => {
      process.env.SHELL = '/bin/bash'

      // Create only the integration file
      const integrationFile = path.join(mockHomeDir, '.envctl-integration.sh')
      await fs.writeFile(integrationFile, 'test content')

      const result = await testEnvManager.unsetupShellIntegration()

      expect(result.removed).toContain(integrationFile)
      expect(result.removed).toHaveLength(1) // Only integration file removed
    })
  })

  describe('cleanupAllData', () => {
    it('should remove all envctl data and unload current profile', async () => {
      // Create some test data
      await envManager.createProfile('test-profile')
      await envManager.addVariable('test-profile', 'TEST_VAR', 'value')

      // Simulate profile being loaded by creating backup file
      const { getConfig } = await import('./config')
      const config = getConfig()
      const backupFile = path.join(config.configDir, 'backup.env')
      await fs.ensureDir(config.configDir)
      await fs.writeFile(backupFile, '# envctl-profile:test-profile\nTEST_VAR=old-value\n')

      // Verify profile is loaded
      const statusBefore = await envManager.getStatus()
      expect(statusBefore.currentProfile).toBe('test-profile')

      // Cleanup all data
      const result = await envManager.cleanupAllData()

      expect(result.removed).toContain("Unloaded current profile 'test-profile'")
      expect(result.removed.length).toBeGreaterThan(1) // Should have unloaded message + config dir
      expect(result.removed.some((item) => item.includes(tempDir))).toBe(true)

      // Verify data is gone
      const profiles = await envManager.listProfiles()
      expect(profiles).toHaveLength(0)

      const status = await envManager.getStatus()
      expect(status.currentProfile).toBeUndefined()
    })

    it('should handle case where no data exists', async () => {
      const result = await envManager.cleanupAllData()

      // Should not error, might remove config dir if it exists
      expect(result.removed.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle case where profile is corrupted', async () => {
      // Create a corrupted backup file referencing a non-existent profile
      const { getConfig } = await import('./config')
      const config = getConfig()
      const backupFile = path.join(config.configDir, 'backup.env')
      await fs.ensureDir(config.configDir)
      await fs.writeFile(backupFile, '# envctl-profile:nonexistent-profile\nTEST_VAR=some-value\n')

      // Should not throw error even with corrupted backup file
      const result = await envManager.cleanupAllData()

      expect(result.removed.length).toBeGreaterThan(0)
      expect(result.removed.some((item) => item.includes(tempDir))).toBe(true)
    })
  })

  describe('getShellRcFile', () => {
    it('should detect zsh shell correctly', () => {
      const manager = envManager
      // Access private method using bracket notation for testing
      const rcFile = (
        manager as unknown as { getShellRcFile: (homeDir: string, shell: string) => string }
      ).getShellRcFile('/home/user', '/usr/bin/zsh')

      expect(rcFile).toBe('/home/user/.zshrc')
    })

    it('should detect bash shell correctly', () => {
      const manager = envManager
      const rcFile = (
        manager as unknown as { getShellRcFile: (homeDir: string, shell: string) => string }
      ).getShellRcFile('/home/user', '/bin/bash')

      expect(rcFile).toBe('/home/user/.bashrc')
    })

    it('should detect fish shell correctly', () => {
      const manager = envManager
      const rcFile = (
        manager as unknown as { getShellRcFile: (homeDir: string, shell: string) => string }
      ).getShellRcFile('/home/user', '/usr/bin/fish')

      expect(rcFile).toBe('/home/user/.config/fish/config.fish')
    })

    it('should default to bashrc for unknown shells', () => {
      const manager = envManager
      const rcFile = (
        manager as unknown as { getShellRcFile: (homeDir: string, shell: string) => string }
      ).getShellRcFile('/home/user', '/usr/bin/unknown-shell')

      expect(rcFile).toBe('/home/user/.bashrc')
    })

    it('should default to bashrc when shell is empty', () => {
      const manager = envManager
      const rcFile = (
        manager as unknown as { getShellRcFile: (homeDir: string, shell: string) => string }
      ).getShellRcFile('/home/user', '')

      expect(rcFile).toBe('/home/user/.bashrc')
    })
  })
})
