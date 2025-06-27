# envctl

A environment variable context manager for development workflows. Easily create, manage, and switch between different sets of environment variables.

## Features

- ✅ Create and manage multiple environment variable profiles/contexts
- ✅ Add variables directly via CLI or import from files
- ✅ Load and unload profiles with proper environment restoration
- ✅ Remove and update individual variables
- ✅ Export profiles for sharing or backup
- ✅ No folder structure dependency (unlike direnv)

## Installation

### From npm

```bash
npm install -g envctl
```

### Quick Setup (Recommended)

After installing, run the setup command to install shell integration:

```bash
envctl setup
```

This will:

- Install shell functions (`envctl-load`, `envctl-unload`, `envctl-switch`) to your shell
- Add convenient aliases (`ecl`, `ecu`, `ecsw`, `ecs`, `ecls`)
- Automatically detect your shell (.bashrc, .zshrc, etc.)
- Set up everything needed for seamless environment variable management

Then restart your shell or run:

```bash
source ~/.bashrc  # or ~/.zshrc for zsh users
```

### Manual Shell Integration (Alternative)

If you prefer manual setup or the automatic setup doesn't work:

**Option 1: Use eval (Quick method)**

```bash
# Load a profile
eval "$(envctl load --shell dev)"

# Switch to a different profile
eval "$(envctl switch --shell staging)"

# Unload a profile
eval "$(envctl unload --shell)"
```

**Option 2: Manual shell functions installation**

```bash
# Download the shell integration script
curl -o ~/.envctl-integration.sh https://raw.githubusercontent.com/ASRagab/envctl/main/shell-integration.sh

# Add to your ~/.bashrc or ~/.zshrc
echo 'source ~/.envctl-integration.sh' >> ~/.bashrc
source ~/.bashrc
```

### Local Development

```bash
# Clone or create the project
git clone <your-repo>
cd envctl

# Install dependencies
npm install

# Build the project
npm run build

# Link globally for local testing
npm link

# Now you can use envctl globally
envctl --help
```

## Quick Start

```bash
# Install envctl
npm install -g envctl

# Set up shell integration (one-time setup)
envctl setup

# Restart your shell or source your rc file
source ~/.bashrc  # or ~/.zshrc

# Create a new profile
envctl create dev

# Add some environment variables
envctl add dev DATABASE_URL=postgresql://localhost/mydb
envctl add dev API_KEY=secret123
envctl add dev NODE_ENV=development

# Or add from a .env file
envctl add dev -f .env

# Load the profile (using the convenient function)
envctl-load dev
# or use the short alias: ecl dev

# Check status
envctl status
# or: ecs

# List all profiles
envctl list
# or: ecls

# List variables in a profile
envctl list dev

# Switch to a different profile (unload current + load new)
envctl-switch production
# or: ecsw production

# Unload the profile (restores previous environment)
envctl-unload
# or: ecu

# Export profile for backup or sharing
envctl export dev > dev.env
```

## Commands

### `envctl create <profile>`

Create a new environment profile.

```bash
envctl create production
envctl create staging
envctl create dev
```

### `envctl add <profile> <KEY=VALUE>`

Add or update an environment variable in a profile.

```bash
envctl add dev DATABASE_URL=postgresql://localhost/mydb
envctl add dev API_PORT=3000
```

### `envctl add <profile> -f <file>`

Import environment variables from a file.

```bash
envctl add dev -f .env
envctl add production -f production.env
```

**File format:**

```env
# Comments are supported
DATABASE_URL=postgresql://localhost/mydb
API_KEY=secret123
NODE_ENV=development

# Empty lines are ignored
DEBUG=true
```

### `envctl remove <profile> <key>`

Remove an environment variable from a profile.

```bash
envctl remove dev API_KEY
```

### `envctl load <profile>`

Load a profile into the current shell session. This will:

- Backup current values of variables that will be overwritten
- Set all variables from the profile
- Mark the profile as currently loaded

```bash
envctl load dev
```

### `envctl unload`

Unload the currently loaded profile and restore the previous environment.

```bash
envctl unload
```

### `envctl switch <profile>`

Switch to a different profile in one command. This will unload the current profile (if any) and load the new one.

```bash
# Switch from current profile to staging
envctl switch staging

# Load a profile when none is currently loaded
envctl switch dev
```

### `envctl status`

Show which profile is currently loaded and how many variables it contains.

```bash
envctl status
# Output: Currently loaded: dev (5 variables)
```

### `envctl list [profile]`

List all profiles or show variables in a specific profile.

```bash
# List all profiles
envctl list

# List variables in a specific profile
envctl list dev
```

### `envctl export <profile>`

Export a profile in environment file format.

```bash
# Print to stdout
envctl export dev

# Save to file
envctl export dev > backup.env
```

### `envctl delete <profile>`

Delete a profile. Cannot delete a currently loaded profile.

```bash
envctl delete old-profile
```

### `envctl setup`

Install shell integration functions for seamless environment variable management.

```bash
envctl setup
```

This installs shell functions (`envctl-load`, `envctl-unload`, `envctl-switch`) and convenient aliases (`ecl`, `ecu`, `ecsw`, `ecs`, `ecls`) to your shell.

### `envctl unsetup [--all] [--force]`

Remove shell integration and optionally all envctl data.

```bash
# Remove only shell integration (keeps profiles and data)
envctl unsetup

# Remove everything including all profiles and data (WARNING: destructive)
envctl unsetup --all

# Remove everything without confirmation prompt (for CI/scripts)
envctl unsetup --all --force
```

**What `envctl unsetup` removes:**

- `~/.envctl-integration.sh` file
- Shell integration lines from your RC file (`.bashrc`, `.zshrc`, etc.)

**What `envctl unsetup --all` removes:**

- Everything from basic unsetup
- All profiles and environment variables
- Configuration directory (`~/.envctl/`)
- State and backup files

⚠️ **Warning:** The `--all` flag is destructive and cannot be undone. Use with caution.

> **Note:** The `--all` flag requires interactive confirmation unless `--force` is used. In non-interactive environments (CI/CD), use `--force` to bypass the confirmation prompt.

## How It Works

### Environment Management

- **Loading**: When you load a profile, envctl backs up the current values of any environment variables that will be overwritten to `~/.envctl/backup.env`, then sets the new values.
- **Unloading**: When you unload, it restores the original values from the backup file (or unsets variables that weren't previously set).
- **State Tracking**: The tool keeps track of what's currently loaded in `~/.envctl/state.json`.
- **Smart Backup**: Only variables that actually exist are backed up, ensuring clean environment restoration.

### File Storage

- Profiles are stored in `~/.envctl/profiles/` as JSON files
- Each profile contains metadata (creation/update times) and the environment variables
- State information is stored in `~/.envctl/state.json`
- Environment backup is stored in `~/.envctl/backup.env` (only when a profile is loaded)

### Cross-Platform

Works on Windows, macOS, and Linux. Uses the user's home directory for storing configuration.

## Use Cases

### Development Environments

```bash
# Create different environments for your project
envctl create local
envctl create staging
envctl create production

# Set up local development
envctl add local DATABASE_URL=postgresql://localhost/mydb
envctl add local REDIS_URL=redis://localhost:6379
envctl add local NODE_ENV=development
```

### API Keys and Secrets Management

```bash
# Different API keys for different environments
envctl create aws-dev
envctl add aws-dev AWS_ACCESS_KEY_ID=dev_key
envctl add aws-dev AWS_SECRET_ACCESS_KEY=dev_secret

envctl create aws-prod
envctl add aws-prod AWS_ACCESS_KEY_ID=prod_key
envctl add aws-prod AWS_SECRET_ACCESS_KEY=prod_secret
```

### Project-Specific Configurations

```bash
# Create project-specific profiles
envctl create project-alpha
envctl add project-alpha -f ./alpha/.env

envctl create project-beta
envctl add project-beta -f ./beta/.env

# Switch between projects
envctl load project-alpha
cd alpha && npm start

envctl unload
envctl load project-beta
cd ../beta && npm start
```

## Advantages Over Alternatives

### vs direnv

- ✅ No dependency on folder structure or `.envrc` files
- ✅ Manual control over when environments are loaded/unloaded
- ✅ Can switch between profiles anywhere in the filesystem
- ✅ Better for temporary environment switches

### vs export commands

- ✅ Automatic backup and restoration of previous environment
- ✅ Persistent storage of environment configurations
- ✅ Easy management of multiple environment sets
- ✅ No risk of permanently modifying your environment

### vs source .env

- ✅ Proper cleanup when switching environments
- ✅ No accumulation of environment variables
- ✅ Centralized management across projects

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run tests
npm test

# Run smoke tests (comprehensive integration tests)
npm run smoke-test
```

### Smoke Testing

For comprehensive testing in isolated Docker environments, see [SMOKE-TESTS.md](SMOKE-TESTS.md).

Quick smoke test commands:

```bash
# Run full smoke test suite
npm run smoke-test

# Debug mode for interactive testing
npm run smoke-test:debug

# Using Docker Compose
npm run smoke-test:compose
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT
