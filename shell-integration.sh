#!/bin/bash
# envctl Shell Integration
# Add to your ~/.bashrc or ~/.zshrc:
# source /path/to/this/shell-integration.sh

# Function to load a profile
envctl-load() {
  if [[ -z $1 ]]; then
    echo "Usage: envctl-load <profile>"
    return 1
  fi

  local commands
  commands=$(envctl load "$1" 2>/dev/null)
  if [[ $? -eq 0 ]]; then
    eval "${commands}"
    echo "✓ Loaded profile '$1'"
  else
    echo "✗ Failed to load profile '$1'"
    envctl load "$1" # Show the error
    return 1
  fi
}

# Function to unload current profile
envctl-unload() {
  local commands
  commands=$(envctl unload 2>/dev/null)
  if [[ $? -eq 0 ]]; then
    eval "${commands}"
    echo "✓ Unloaded profile"
  else
    echo "✗ Failed to unload profile"
    envctl unload # Show the error
    return 1
  fi
}

# Function to switch profiles
envctl-switch() {
  if [[ -z $1 ]]; then
    echo "Usage: envctl-switch <profile>"
    return 1
  fi

  local commands
  commands=$(envctl switch "$1" 2>/dev/null)
  if [[ $? -eq 0 ]]; then
    eval "${commands}"
    echo "✓ Switched to profile '$1'"
  else
    echo "✗ Failed to switch to profile '$1'"
    envctl switch "$1" # Show the error
    return 1
  fi
}

# Aliases for convenience
alias ecl='envctl-load'
alias ecu='envctl-unload'
alias ecsw='envctl-switch'
alias ecs='envctl status'
alias ecls='envctl list'
