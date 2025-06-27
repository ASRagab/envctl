# envctl Smoke Testing

This document describes the comprehensive smoke testing setup for `envctl`, designed to verify that the tool works correctly in isolated environments and can be safely deployed.

## Overview

The smoke testing setup provides:

- **Isolated Docker Environment**: Tests run in clean containers with no external dependencies
- **Shell Integration Testing**: Verifies that shell functions work correctly with environment variable management
- **Comprehensive Test Coverage**: Tests all major functionality including profile management, variable handling, and shell state verification
- **CI/CD Integration**: Automated testing in GitHub Actions with Docker-in-Docker support
- **Cross-Platform Compatibility**: Tests across different Node.js versions and shell environments

## Test Architecture

### Components

1. **docker/Dockerfile.smoke-test**: Creates isolated testing environment with Node.js and shell integration
2. **scripts/smoke-test.sh**: Comprehensive test script that exercises all functionality
3. **Docker Compose**: Provides easy local testing and debugging capabilities
4. **GitHub Actions**: Automated CI/CD pipeline with matrix testing
5. **Helper Scripts**: Convenience scripts for running tests locally

### What Gets Tested

#### Core Functionality

- ✅ CLI availability and basic commands
- ✅ Profile creation, deletion, and listing
- ✅ Environment variable addition, removal, and modification
- ✅ File-based variable import (.env files)
- ✅ Profile export functionality

#### Shell Integration

- ✅ Shell integration setup (`envctl setup`)
- ✅ Shell function availability (`envctl-load`, `envctl-unload`, `envctl-switch`)
- ✅ Environment variable loading and shell state verification
- ✅ Profile switching with proper environment restoration
- ✅ Profile unloading with original environment restoration

#### Error Handling

- ✅ Non-existent profile handling
- ✅ Duplicate profile prevention
- ✅ Invalid variable operations
- ✅ Proper error messages and exit codes

#### Edge Cases

- ✅ Variables with special characters and spaces
- ✅ Empty variable values
- ✅ Complex environment restoration scenarios
- ✅ Shell integration cleanup

## Running Smoke Tests

### Prerequisites

- Docker installed and running
- Docker Compose (optional, for compose-based testing)

### Local Testing

#### Option 1: Direct Docker (Recommended)

```bash
# Build and run smoke tests (Node.js 18, Bash)
./scripts/run-smoke-tests.sh

# Test with specific Node.js versions
./scripts/run-smoke-tests-node18.sh
./scripts/run-smoke-tests-node20.sh
./scripts/run-smoke-tests-node22.sh

# Test with specific shell
./scripts/run-smoke-tests-zsh.sh
```

This script will:

1. Build the Docker image
2. Run the complete smoke test suite
3. Report results with colored output
4. Clean up resources

#### Option 2: Docker Compose

```bash
# Run with Docker Compose
./scripts/run-smoke-tests-compose.sh

# Or directly
docker-compose -f docker-compose.smoke-test.yml run --rm smoke-test
```

#### Option 3: Debug Mode

For interactive testing and debugging:

```bash
# Start interactive debug environment
./scripts/debug-smoke-tests.sh

# Or directly
docker-compose -f docker-compose.smoke-test.yml run --rm smoke-test-debug
```

In debug mode, you can:

- Run individual test commands
- Inspect the environment state
- Debug shell integration issues
- Test specific scenarios manually

### Manual Test Commands

Inside the debug environment, you can run:

```bash
# Full smoke test suite
/smoke-test.sh

# Individual commands
envctl --help
envctl setup
source ~/.envctl-integration.sh
envctl create test-profile
envctl add test-profile TEST_VAR=test_value
envctl-load test-profile
echo $TEST_VAR  # Should show "test_value"
envctl status
envctl-unload
```

## CI/CD Integration

### GitHub Actions

The repository includes automated smoke testing via GitHub Actions (`.github/workflows/smoke-test.yml`):

#### Main Smoke Test Job

- Runs on every push and pull request
- Tests with Node.js 18 in Ubuntu environment
- Builds Docker image and runs full test suite

#### Compatibility Testing

- **Node.js Compatibility**: Tests with Node.js 18, 20, and 22
- **Shell Compatibility**: Tests with both Bash and Zsh
- **Matrix Testing**: Runs all combinations automatically

#### Triggering CI Tests

Tests run automatically on:

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches
- Manual workflow dispatch

### Setting Up in Your Repository

1. The GitHub Actions workflow is already configured
2. Tests will run automatically on repository events
3. View results in the "Actions" tab of your GitHub repository

## Test Structure

### Test Categories

The smoke test script is organized into these categories:

1. **Basic CLI Tests** (Tests 1-2)
   - CLI availability
   - Shell integration setup

2. **Profile Management Tests** (Tests 3, 15-16)
   - Profile creation and deletion
   - Profile listing and verification

3. **Variable Management Tests** (Tests 4-6, 11)
   - Variable addition and removal
   - File-based imports
   - Content verification

4. **Shell Integration Tests** (Tests 7-12)
   - Profile loading and environment verification
   - Profile switching
   - Profile unloading and restoration
   - Status reporting

5. **Error Handling Tests** (Test 13)
   - Non-existent profiles
   - Invalid operations
   - Proper error responses

6. **Edge Case Tests** (Test 14)
   - Special characters
   - Empty values
   - Complex scenarios

### Test Output

The test runner provides colored output:

- 🟢 **PASS**: Test succeeded
- 🔴 **FAIL**: Test failed
- 🟡 **INFO**: Additional context
- 🔵 **SECTION**: Test category headers

Example output:

```
========================================
  envctl Comprehensive Smoke Tests
========================================

Testing basic CLI availability...
✓ PASS: CLI availability
  → envctl command is available

Testing shell integration setup...
✓ PASS: Shell integration setup
  → Setup completed successfully
✓ PASS: Shell functions availability
  → Shell functions loaded

...

========================================
           Test Results Summary
========================================
Total Tests: 25
Passed: 25
Failed: 0
🎉 All tests passed!
```

## Troubleshooting

### Common Issues

#### Docker Build Failures

```bash
# Clean Docker cache and rebuild
docker system prune -f
docker build -f docker/Dockerfile.smoke-test -t envctl-smoke-test . --no-cache
```

#### Permission Issues

```bash
# Make scripts executable
chmod +x scripts/*.sh
```

#### Shell Integration Not Working

```bash
# Debug shell integration in interactive mode
./scripts/debug-smoke-tests.sh

# Inside container, check:
envctl setup
ls -la ~/.envctl-integration.sh
source ~/.envctl-integration.sh
type envctl-load
```

#### Environment Variable Issues

```bash
# Check environment state manually
export TEST_VAR=original
envctl create test
envctl add test TEST_VAR=new_value
envctl-load test
echo "Current: $TEST_VAR"  # Should be "new_value"
envctl-unload
echo "Restored: $TEST_VAR"  # Should be "original"
```

### Debugging Failed Tests

1. **Use Debug Mode**: Start interactive environment to investigate
2. **Check Specific Commands**: Run individual envctl commands to isolate issues
3. **Verify Environment State**: Check that environment variables are set/unset correctly
4. **Review Test Output**: Look for specific error messages in the test output
5. **Check Docker Logs**: Review container logs for additional context

## Extending Tests

### Adding New Test Cases

To add new test cases to the smoke test suite:

1. Edit `scripts/smoke-test.sh`
2. Add your test in the appropriate section
3. Use the `print_test` function for consistent output
4. Include both positive and negative test cases
5. Verify environment state after operations

Example:

```bash
# Test new functionality
echo -e "${YELLOW}Testing new feature...${NC}"
if run_cmd "envctl new-command" > /dev/null 2>&1; then
    print_test "New command works" "PASS"
else
    print_test "New command works" "FAIL"
fi
```

### Modifying Docker Environment

To change the testing environment:

1. Edit `docker/Dockerfile.smoke-test` for base environment changes
2. Edit `docker-compose.smoke-test.yml` for runtime configuration
3. Update GitHub Actions workflow for CI changes

## Integration with Development Workflow

### Pre-Release Testing

Before releasing:

```bash
# Run full smoke test suite
./scripts/run-smoke-tests.sh

# Test in debug mode if needed
./scripts/debug-smoke-tests.sh
```

### Adding to Git Hooks

Add to `.git/hooks/pre-push`:

```bash
#!/bin/bash
echo "Running smoke tests before push..."
./scripts/run-smoke-tests.sh
```

### Package.json Integration

The package.json includes smoke test scripts:

```bash
npm run smoke-test          # Run smoke tests (Node.js 18, Bash)
npm run smoke-test:debug    # Debug mode
npm run smoke-test:compose  # Docker Compose version
npm run smoke-test:node18   # Test with Node.js 18
npm run smoke-test:node20   # Test with Node.js 20
npm run smoke-test:node22   # Test with Node.js 22
npm run smoke-test:zsh      # Test with Zsh shell
```

This comprehensive smoke testing setup ensures that `envctl` works reliably across different environments and use cases, providing confidence for releases and deployments.
