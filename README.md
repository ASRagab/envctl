# envctl

A environment variable context manager for development workflows. Easily create, manage, and switch between different sets of environment variables.

## 🔄 **Streamlined Workflow**

envctl uses a **simple, transparent approach**: environment commands like `load`, `unload`, and `switch` output shell commands that you execute with `eval`. This means:

```bash
# See what will happen
envctl load dev

# Execute it when you're ready
eval "$(envctl load dev)"

# Or use the convenient shell functions (installed via `envctl setup`)
envctl-load dev  # Same as eval "$(envctl load dev)"
```

## Features

- ✅ Create and manage multiple environment variable profiles/contexts
- ✅ Add variables directly via CLI or import from files
- ✅ Load and unload profiles with proper environment restoration
- ✅ **Smart reload**: Loading the same profile again refreshes it seamlessly
- ✅ Remove and update individual variables
- ✅ Export profiles for sharing or backup
- ✅ **Streamlined workflow**: All commands output shell commands directly
- ✅ No folder structure dependency (unlike direnv)

## Installation

### From npm

```bash
npm install -g @twelvehart/envctl
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
eval "$(envctl load dev)"

# Switch to a different profile
eval "$(envctl switch staging)"

# Unload a profile
eval "$(envctl unload)"
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
pnpm install

# Build the project
pnpm run build

# Link globally for local testing
pnpm link --global

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
envctl add dev DATABASE_URL=postgresql://localhost/mydb API_KEY=secret123 NODE_ENV=development

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

# Reload the same profile (refreshes environment - no need to unload first!)
envctl-load dev

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

### `envctl add <profile> <KEY=VALUE> [KEY=VALUE...]`

Add or update environment variable(s) in a profile. You can add multiple variables at once.

```bash
# Add a single variable
envctl add dev DATABASE_URL=postgresql://localhost/mydb

# Add multiple variables at once
envctl add dev DATABASE_URL=postgresql://localhost/mydb API_PORT=3000 NODE_ENV=development

# Mix and match - add as many as you need
envctl add production DATABASE_URL=postgresql://prod-host/db API_KEY=prod-secret DEBUG=false

# Duplicate keys are handled intelligently - last value wins
envctl add dev DATABASE_URL=first_value DATABASE_URL=final_value API_KEY=secret
# Result: DATABASE_URL=final_value, API_KEY=secret (with warning about duplicate)
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

**Duplicate Key Handling:**

When adding multiple variables, if you provide the same key more than once, envctl will use the last value and warn you about the duplication:

```bash
# This command has duplicate DATABASE_URL keys
envctl add dev DATABASE_URL=first API_KEY=secret DATABASE_URL=final

# Output:
# ✓ Added 2 variables (DATABASE_URL, API_KEY) to profile 'dev'
# ⚠ Duplicate keys detected: DATABASE_URL (used last value for each)

# Result: DATABASE_URL=final, API_KEY=secret
```

This behavior ensures you always get predictable results while being informed about potential mistakes.

### `envctl remove <profile> <key>`

Remove an environment variable from a profile.

```bash
envctl remove dev API_KEY
```

### `envctl load <profile>`

Load a profile into the current shell session. This command outputs shell commands that you can execute with `eval`:

- Backup current values of variables that will be overwritten
- Set all variables from the profile
- **Smart reload**: If the same profile is already loaded, it will refresh it instead of throwing an error

```bash
# Output shell commands for loading
envctl load dev

# Execute the commands to actually load the profile
eval "$(envctl load dev)"

# Reload the same profile (refreshes environment)
eval "$(envctl load dev)"  # This works - no need to unload first!
```

### `envctl unload`

Unload the currently loaded profile and restore the previous environment. This command outputs shell commands:

```bash
# Output shell commands for unloading
envctl unload

# Execute the commands to actually unload the profile
eval "$(envctl unload)"
```

### `envctl switch <profile>`

Switch to a different profile in one command. This command outputs shell commands that will unload the current profile (if any) and load the new one.

```bash
# Output shell commands for switching
envctl switch staging

# Execute the commands to actually switch
eval "$(envctl switch staging)"

# Switch when no profile is currently loaded (just loads the profile)
eval "$(envctl switch dev)"
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

### Streamlined Shell Integration

envctl uses a **streamlined approach** where all environment-affecting commands output shell commands that you execute with `eval`. This ensures:

- **Predictable behavior**: Commands always work the same way
- **Maximum compatibility**: Works with any shell and environment

### Environment Management

- **Loading**: When you load a profile, envctl generates shell commands that backup current values of environment variables to `~/.envctl/backup.env`, then set the new values.
- **Unloading**: When you unload, it generates commands that restore original values from the backup file (or unset variables that weren't previously set).
- **Stateless Design**: No persistent state files - the backup file serves as both backup storage and state indicator.
- **Smart Reload**: Loading the same profile again refreshes it by restoring from backup first, then setting new values.

### File Storage

- Profiles are stored in `~/.envctl/profiles/` as JSON files
- Each profile contains metadata (creation/update times) and the environment variables
- **Backup file** (`~/.envctl/backup.env`) serves dual purpose:
  - Contains original environment variable values for restoration
  - Includes profile marker (`# envctl-profile:name`) to track what's loaded
- **No state.json**: Stateless design eliminates state synchronization issues

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
envctl-load project-alpha
cd alpha && npm start

envctl-unload
envctl-load project-beta
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

### envctl's Streamlined Design

- ✅ **Transparent operation**: See exactly what shell commands will be executed
- ✅ **No hidden state**: Stateless design eliminates synchronization issues
- ✅ **Smart reload**: Load the same profile multiple times without errors
- ✅ **Shell agnostic**: Works with bash, zsh, fish, and any POSIX shell
- ✅ **Predictable behavior**: Commands always work the same way

## Development

This project uses **pnpm** (version 10.0.0 or higher) as the package manager and requires **Node.js 18+**. Make sure you have both installed:

```bash
# Install pnpm globally if you haven't already
npm install -g pnpm@latest

# Install dependencies
pnpm install

# Run in development mode
pnpm run dev

# Build
pnpm run build

# Run tests
pnpm test

# Run smoke tests (comprehensive integration tests)
pnpm run smoke-test

# Test user installation experience (important for catching dependency issues)
pnpm run test:user-install
```

### Smoke Testing

For comprehensive testing in isolated Docker environments, see [SMOKE-TESTS.md](SMOKE-TESTS.md).

Quick smoke test commands:

```bash
# Run full smoke test suite
pnpm run smoke-test

# Debug mode for interactive testing
pnpm run smoke-test:debug

# Using Docker Compose
pnpm run smoke-test:compose
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT
