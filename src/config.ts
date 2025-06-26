// src/config.ts
import path from 'path'
import os from 'os'
import { Config } from './types'

export const getConfig = (): Config => {
  const configDir = path.join(os.homedir(), '.envctl')
  return {
    configDir,
    profilesDir: path.join(configDir, 'profiles'),
    stateFile: path.join(configDir, 'state.json'),
  }
}
