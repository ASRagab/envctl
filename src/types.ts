
export interface Profile {
  name: string;
  variables: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnvState {
  currentProfile?: string;
  backup?: Record<string, string | undefined>;
}

export interface Config {
  profilesDir: string;
  stateFile: string;
  configDir: string;
}
