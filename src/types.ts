export interface Profile {
  name: string
  variables: Record<string, string>
  createdAt: Date
  updatedAt: Date
}

export interface Config {
  profilesDir: string
  configDir: string
}
