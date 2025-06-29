#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Function to print test status
print_test() {
  local test_name="$1"
  local status="$2"
  local message="$3"

  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  if [[ ${status} == "PASS" ]]; then
    echo -e "${GREEN}✓ PASS${NC}: ${test_name}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    if [[ -n ${message} ]]; then
      echo -e "  ${BLUE}→${NC} ${message}"
    fi
  else
    echo -e "${RED}✗ FAIL${NC}: ${test_name}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    if [[ -n ${message} ]]; then
      echo -e "  ${YELLOW}→${NC} ${message}"
    fi
  fi
}

# Function to check if variable is set in current environment
check_var() {
  local var_name="$1"
  local expected_value="$2"
  local actual_value="${!var_name}"

  if [[ ${actual_value} == ${expected_value} ]]; then
    return 0
  else
    return 1
  fi
}

# Function to check if variable is unset
check_var_unset() {
  local var_name="$1"
  if [ -z "${!var_name}" ]; then
    return 0
  else
    return 1
  fi
}

# Function to run command and capture both stdout and exit code
run_cmd() {
  local cmd="$1"
  local output
  local exit_code

  output=$(eval "$cmd" 2>&1)
  exit_code=$?

  echo "$output"
  return $exit_code
}

# Function to test direct shell command output (new for streamlined behavior)
test_shell_commands() {
  local profile="$1"
  local test_name="$2"

  # Test that load command outputs shell commands
  local load_output
  load_output=$(envctl load "$profile" 2>/dev/null)
  if echo "$load_output" | grep -q "export.*="; then
    print_test "$test_name: shell command output" "PASS" "Load command outputs shell commands"
    return 0
  else
    print_test "$test_name: shell command output" "FAIL" "Load command should output shell commands"
    return 1
  fi
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  envctl Comprehensive Smoke Tests${NC}"
echo -e "${BLUE}   (Updated for Streamlined Behavior)${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# Test 1: Basic CLI availability
echo -e "${YELLOW}Testing basic CLI availability...${NC}"
if envctl --help >/dev/null 2>&1; then
  print_test "CLI availability" "PASS" "envctl command is available"
else
  print_test "CLI availability" "FAIL" "envctl command not found"
  exit 1
fi

# Test 1.5: Validate proper user installation simulation
echo -e "${YELLOW}Validating user installation simulation...${NC}"
# Check that we're using the globally installed version, not local dev version
ENVCTL_PATH=$(which envctl)
if [[ $ENVCTL_PATH == "/usr/local/bin/envctl" ]]; then
  print_test "Global installation path" "PASS" "Using globally installed envctl"
else
  print_test "Global installation path" "FAIL" "envctl path: $ENVCTL_PATH"
fi

# Verify no development artifacts remain
if [ ! -d "/app/node_modules" ] && [ ! -d "/app/dist" ] && [ ! -d "/app/src" ]; then
  print_test "Development cleanup" "PASS" "Development files properly cleaned up"
else
  print_test "Development cleanup" "FAIL" "Development files still present"
fi

# Test 1.7: Test new streamlined behavior - direct command output
echo -e "${YELLOW}Testing streamlined shell command behavior...${NC}"
# Create a test profile first
if run_cmd "envctl create streamline-test" >/dev/null 2>&1 && run_cmd "envctl add streamline-test TEST_VAR=test_value" >/dev/null 2>&1; then
  # Test that commands always output shell commands (no --shell flag needed)
  load_output=$(envctl load streamline-test 2>/dev/null || true)
  if echo "$load_output" | grep -q "export TEST_VAR=" && echo "$load_output" | grep -q "backup.env"; then
    print_test "Streamlined load behavior" "PASS" "Load command always outputs shell commands"
  else
    print_test "Streamlined load behavior" "FAIL" "Load should output shell commands without --shell flag"
  fi

  # Clean up the test profile
  run_cmd "envctl delete streamline-test" >/dev/null 2>&1 || true
else
  print_test "Streamlined test setup" "FAIL" "Could not create test profile"
fi

# Test 2: Shell integration setup
echo -e "${YELLOW}Testing shell integration setup...${NC}"
if envctl setup >/dev/null 2>&1; then
  print_test "Shell integration setup" "PASS" "Setup completed successfully"

  # Source the integration
  if [ -f ~/.envctl-integration.sh ]; then
    source ~/.envctl-integration.sh 2>/dev/null || true
    if type envctl-load >/dev/null 2>&1; then
      print_test "Shell functions availability" "PASS" "Shell functions loaded"
    else
      print_test "Shell functions availability" "FAIL" "Shell functions not available"
    fi
  else
    print_test "Integration file creation" "FAIL" "Integration file not created"
  fi
else
  print_test "Shell integration setup" "FAIL" "Setup failed"
fi

# Test 3: Profile creation
echo -e "${YELLOW}Testing profile management...${NC}"
profiles_to_test=("dev" "staging" "production" "test-profile")

for profile in "${profiles_to_test[@]}"; do
  if run_cmd "envctl create $profile" >/dev/null 2>&1; then
    print_test "Create profile: $profile" "PASS"
  else
    print_test "Create profile: $profile" "FAIL"
  fi
done

# Test 4: Variable addition
echo -e "${YELLOW}Testing variable management...${NC}"

# Add individual variables
test_vars=(
  "dev:DATABASE_URL=postgresql://localhost/dev_db"
  "dev:API_KEY=dev_secret_123"
  "dev:NODE_ENV=development"
  "dev:DEBUG=true"
  "staging:DATABASE_URL=postgresql://staging-host/staging_db"
  "staging:API_KEY=staging_secret_456"
  "staging:NODE_ENV=staging"
  "production:DATABASE_URL=postgresql://prod-host/prod_db"
  "production:API_KEY=prod_secret_789"
  "production:NODE_ENV=production"
)

for var in "${test_vars[@]}"; do
  profile="${var%%:*}"
  keyvalue="${var#*:}"
  if run_cmd "envctl add $profile $keyvalue" >/dev/null 2>&1; then
    print_test "Add variable: $profile ($keyvalue)" "PASS"
  else
    print_test "Add variable: $profile ($keyvalue)" "FAIL"
  fi
done

# Test multiple key-value pairs at once
echo -e "${YELLOW}Testing multiple key-value pairs addition...${NC}"

# Test adding multiple variables to a new profile
if run_cmd "envctl create multi-test" >/dev/null 2>&1; then
  # Add multiple variables in a single command
  if run_cmd "envctl add multi-test VAR1=value1 VAR2=value2 VAR3=value3" >/dev/null 2>&1; then
    print_test "Add multiple variables at once" "PASS"

    # Verify all variables were added
    list_output=$(run_cmd "envctl list multi-test")
    if echo "$list_output" | grep -q "VAR1=value1" && echo "$list_output" | grep -q "VAR2=value2" && echo "$list_output" | grep -q "VAR3=value3"; then
      print_test "Multiple variables verification" "PASS" "All variables added correctly"
    else
      print_test "Multiple variables verification" "FAIL" "Not all variables were added"
    fi
  else
    print_test "Add multiple variables at once" "FAIL"
  fi

  # Test with special characters in multiple variables
  if run_cmd "envctl add multi-test 'URL=https://api.example.com/v1' 'CONFIG=key=value&flag=true' 'PATH=/usr/local/bin:/usr/bin'" >/dev/null 2>&1; then
    print_test "Multiple variables with special chars" "PASS"
  else
    print_test "Multiple variables with special chars" "FAIL"
  fi

  # Test mixed single and multiple additions work together
  if run_cmd "envctl add multi-test SINGLE_VAR=single_value" >/dev/null 2>&1; then
    if run_cmd "envctl add multi-test BATCH1=batch1 BATCH2=batch2" >/dev/null 2>&1; then
      print_test "Mixed single and multiple additions" "PASS"
    else
      print_test "Mixed single and multiple additions" "FAIL"
    fi
  else
    print_test "Mixed single and multiple additions" "FAIL"
  fi

  # Test duplicate key handling
  if run_cmd "envctl add multi-test DUP_KEY=first_value DUP_KEY=second_value DUP_KEY=final_value" >/dev/null 2>&1; then
    print_test "Duplicate key handling" "PASS"

    # Verify the last value was used
    list_output=$(run_cmd "envctl list multi-test")
    if echo "$list_output" | grep -q "DUP_KEY=final_value"; then
      print_test "Duplicate key last value verification" "PASS" "Last value correctly used"
    else
      print_test "Duplicate key last value verification" "FAIL" "Expected final_value"
    fi
  else
    print_test "Duplicate key handling" "FAIL"
  fi

  # Test multiple different duplicate keys
  if run_cmd "envctl add multi-test KEY_A=first KEY_B=first KEY_A=second KEY_C=only KEY_B=final" >/dev/null 2>&1; then
    print_test "Multiple duplicate keys handling" "PASS"

    # Verify all final values are correct
    list_output=$(run_cmd "envctl list multi-test")
    if echo "$list_output" | grep -q "KEY_A=second" && echo "$list_output" | grep -q "KEY_B=final" && echo "$list_output" | grep -q "KEY_C=only"; then
      print_test "Multiple duplicate keys verification" "PASS" "All final values correct"
    else
      print_test "Multiple duplicate keys verification" "FAIL" "Values don't match expected"
    fi
  else
    print_test "Multiple duplicate keys handling" "FAIL"
  fi
else
  print_test "Create multi-test profile" "FAIL"
fi

# Test 5: File-based variable addition
echo -e "${YELLOW}Testing file-based variable addition...${NC}"

# Create test .env file
cat >/tmp/test.env <<EOF
# Test environment file
FILE_BASED_VAR1=value1
FILE_BASED_VAR2=value2
SPECIAL_CHARS="value with spaces and = signs"
MULTILINE_VAR=line1
# Comment line
EMPTY_LINE_TEST=after_empty_line
EOF

if run_cmd "envctl add test-profile -f /tmp/test.env" >/dev/null 2>&1; then
  print_test "Add variables from file" "PASS"
else
  print_test "Add variables from file" "FAIL"
fi

# Test 6: Profile listing and content verification
echo -e "${YELLOW}Testing profile listing and content...${NC}"

# Test profile listing
if run_cmd "envctl list" | grep -q "dev"; then
  print_test "List profiles" "PASS" "Profiles are listed correctly"
else
  print_test "List profiles" "FAIL" "Profile listing failed"
fi

# Test individual profile content
if run_cmd "envctl list dev" | grep -q "DATABASE_URL"; then
  print_test "List profile variables" "PASS" "Profile variables displayed"
else
  print_test "List profile variables" "FAIL" "Profile variables not displayed"
fi

# Test 7: Profile loading with shell integration
echo -e "${YELLOW}Testing profile loading and shell integration...${NC}"

# Set some initial environment variables to test backup/restore
export ORIGINAL_VAR="original_value"
export DATABASE_URL="will_be_overridden"

# Test loading via shell integration function
if type envctl-load >/dev/null 2>&1; then
  # Load dev profile
  if envctl-load dev >/dev/null 2>&1; then
    print_test "Load profile via shell function" "PASS"

    # Verify environment variables are set
    if check_var "DATABASE_URL" "postgresql://localhost/dev_db"; then
      print_test "Environment variable set correctly" "PASS" "DATABASE_URL has correct value"
    else
      print_test "Environment variable set correctly" "FAIL" "DATABASE_URL: expected 'postgresql://localhost/dev_db', got '${DATABASE_URL}'"
    fi

    if check_var "NODE_ENV" "development"; then
      print_test "Multiple variables set" "PASS" "NODE_ENV has correct value"
    else
      print_test "Multiple variables set" "FAIL" "NODE_ENV: expected 'development', got '${NODE_ENV}'"
    fi

    # Verify original variable is preserved
    if check_var "ORIGINAL_VAR" "original_value"; then
      print_test "Original variables preserved" "PASS" "Non-conflicting variables preserved"
    else
      print_test "Original variables preserved" "FAIL" "Original variable lost"
    fi

  else
    print_test "Load profile via shell function" "FAIL"
  fi
else
  print_test "Shell function availability" "FAIL" "envctl-load function not available"
fi

# Test 8: Profile status
echo -e "${YELLOW}Testing profile status...${NC}"
status_output=$(run_cmd "envctl status")
if echo "${status_output}" | grep -q "Currently loaded: dev"; then
  print_test "Profile status reporting" "PASS" "Status shows correct loaded profile"
else
  print_test "Profile status reporting" "FAIL" "Status output: $status_output"
fi

# Test 8.5: Profile reload behavior (new streamlined feature)
echo -e "${YELLOW}Testing profile reload behavior...${NC}"
if type envctl-load >/dev/null 2>&1; then
  # Try loading the same profile again (should work - reload)
  if envctl-load dev >/dev/null 2>&1; then
    print_test "Profile reload via shell function" "PASS" "Can reload same profile"

    # Verify environment is still correct after reload
    if check_var "DATABASE_URL" "postgresql://localhost/dev_db"; then
      print_test "Reload preserves environment" "PASS" "Environment preserved after reload"
    else
      print_test "Reload preserves environment" "FAIL" "Environment changed after reload"
    fi
  else
    print_test "Profile reload via shell function" "FAIL" "Should allow reloading same profile"
  fi

  # Test direct command reload behavior
  load_output=$(envctl load dev 2>/dev/null || true)
  if echo "$load_output" | grep -q "export.*=" && [ $? -eq 0 ]; then
    print_test "Profile reload via direct command" "PASS" "Direct reload command works"
  else
    print_test "Profile reload via direct command" "FAIL" "Direct reload should work"
  fi
else
  print_test "Shell function availability for reload test" "FAIL" "envctl-load function not available"
fi

# Test 8.7: Stateless backup file validation (new architecture)
echo -e "${YELLOW}Testing stateless backup file approach...${NC}"
# Check that backup file exists and contains profile marker
if [ -f ~/.envctl/backup.env ]; then
  if grep -q "# envctl-profile:dev" ~/.envctl/backup.env; then
    print_test "Backup file profile marker" "PASS" "Backup file contains correct profile marker"
  else
    print_test "Backup file profile marker" "FAIL" "Backup file missing profile marker"
  fi

  # Check that backup file contains actual variable backups
  if grep -q "=" ~/.envctl/backup.env; then
    print_test "Backup file contains variables" "PASS" "Backup file stores original variables"
  else
    print_test "Backup file contains variables" "FAIL" "Backup file should contain variable backups"
  fi
else
  print_test "Backup file exists" "FAIL" "Backup file should exist when profile is loaded"
fi

# Test 9: Profile switching
echo -e "${YELLOW}Testing profile switching...${NC}"
if type envctl-switch >/dev/null 2>&1; then
  if envctl-switch staging >/dev/null 2>&1; then
    print_test "Profile switching" "PASS"

    # Verify new environment
    if check_var "DATABASE_URL" "postgresql://staging-host/staging_db"; then
      print_test "Switch updates variables" "PASS" "DATABASE_URL updated correctly"
    else
      print_test "Switch updates variables" "FAIL" "DATABASE_URL: expected staging value, got '${DATABASE_URL}'"
    fi

    if check_var "NODE_ENV" "staging"; then
      print_test "Switch updates all variables" "PASS" "NODE_ENV updated correctly"
    else
      print_test "Switch updates all variables" "FAIL" "NODE_ENV: expected 'staging', got '${NODE_ENV}'"
    fi
  else
    print_test "Profile switching" "FAIL"
  fi
fi

# Test 10: Profile export
echo -e "${YELLOW}Testing profile export...${NC}"
export_output=$(run_cmd "envctl export dev")
if echo "${export_output}" | grep -q "DATABASE_URL=postgresql://localhost/dev_db"; then
  print_test "Profile export" "PASS" "Export contains correct variables"
else
  print_test "Profile export" "FAIL" "Export output doesn't match expected format"
fi

# Test 11: Variable removal
echo -e "${YELLOW}Testing variable removal...${NC}"
if run_cmd "envctl remove dev DEBUG" >/dev/null 2>&1; then
  print_test "Variable removal" "PASS"

  # Verify variable was removed
  list_output=$(run_cmd "envctl list dev")
  if echo "$list_output" | grep -q "DEBUG="; then
    print_test "Variable removal verification" "FAIL" "Variable still present after removal"
  else
    print_test "Variable removal verification" "PASS" "Variable successfully removed"
  fi
else
  print_test "Variable removal" "FAIL"
fi

# Test 12: Profile unloading
echo -e "${YELLOW}Testing profile unloading...${NC}"
if type envctl-unload >/dev/null 2>&1; then
  if envctl-unload >/dev/null 2>&1; then
    print_test "Profile unloading" "PASS"

    # Check that no profile is loaded
    status_output=$(run_cmd "envctl status")
    if echo "$status_output" | grep -q "No profile currently loaded"; then
      print_test "Unload status verification" "PASS" "Status shows no profile loaded"
    else
      print_test "Unload status verification" "FAIL" "Status: $status_output"
    fi

    # Verify environment restoration (DATABASE_URL should be restored to original value)
    if check_var "DATABASE_URL" "will_be_overridden"; then
      print_test "Environment restoration" "PASS" "Original DATABASE_URL value restored"
    else
      print_test "Environment restoration" "FAIL" "DATABASE_URL: expected 'will_be_overridden', got '${DATABASE_URL}'"
    fi

    # Verify backup file is removed (stateless cleanup)
    if [ ! -f ~/.envctl/backup.env ]; then
      print_test "Backup file cleanup" "PASS" "Backup file removed after unload"
    else
      print_test "Backup file cleanup" "FAIL" "Backup file should be removed after unload"
    fi

  else
    print_test "Profile unloading" "FAIL"
  fi
fi

# Test 13: Error handling
echo -e "${YELLOW}Testing error handling...${NC}"

# Test loading non-existent profile via shell function
if ! run_cmd "envctl-load nonexistent" >/dev/null 2>&1; then
  print_test "Error handling: non-existent profile (shell function)" "PASS" "Correctly fails on non-existent profile"
else
  print_test "Error handling: non-existent profile (shell function)" "FAIL" "Should fail on non-existent profile"
fi

# Test loading non-existent profile via direct command (should also fail)
if ! run_cmd "envctl load nonexistent" >/dev/null 2>&1; then
  print_test "Error handling: non-existent profile (direct)" "PASS" "Direct command correctly fails on non-existent profile"
else
  print_test "Error handling: non-existent profile (direct)" "FAIL" "Direct command should fail on non-existent profile"
fi

# Test creating duplicate profile
if ! run_cmd "envctl create dev" >/dev/null 2>&1; then
  print_test "Error handling: duplicate profile" "PASS" "Correctly prevents duplicate profile creation"
else
  print_test "Error handling: duplicate profile" "FAIL" "Should prevent duplicate profile creation"
fi

# Test removing non-existent variable
if ! run_cmd "envctl remove dev NONEXISTENT_VAR" >/dev/null 2>&1; then
  print_test "Error handling: non-existent variable" "PASS" "Correctly fails on non-existent variable"
else
  print_test "Error handling: non-existent variable" "FAIL" "Should fail on non-existent variable"
fi

# Test 14: Edge cases
echo -e "${YELLOW}Testing edge cases...${NC}"

# Test variable with special characters
if run_cmd "envctl add test-profile 'SPECIAL_VAR=value with spaces and = signs'" >/dev/null 2>&1; then
  print_test "Special characters in values" "PASS"
else
  print_test "Special characters in values" "FAIL"
fi

# Test empty value
if run_cmd "envctl add test-profile EMPTY_VAR=" >/dev/null 2>&1; then
  print_test "Empty variable value" "PASS"
else
  print_test "Empty variable value" "FAIL"
fi

# Test 15: Profile deletion
echo -e "${YELLOW}Testing profile deletion...${NC}"

# First ensure no profile is loaded
envctl-unload >/dev/null 2>&1 || true

# Test deleting profiles (including multi-test profile)
all_profiles=("${profiles_to_test[@]}" "multi-test")
for profile in "${all_profiles[@]}"; do
  if run_cmd "envctl delete $profile" >/dev/null 2>&1; then
    print_test "Delete profile: $profile" "PASS"
  else
    print_test "Delete profile: $profile" "FAIL"
  fi
done

# Test 16: Cleanup verification
echo -e "${YELLOW}Testing cleanup verification...${NC}"
profile_list=$(run_cmd "envctl list")
if echo "${profile_list}" | grep -q "No profiles found"; then
  print_test "Profile cleanup verification" "PASS" "All profiles successfully deleted"
else
  print_test "Profile cleanup verification" "FAIL" "Some profiles remain: ${profile_list}"
fi

# Test 17: Shell integration cleanup
echo -e "${YELLOW}Testing shell integration cleanup...${NC}"
if run_cmd "envctl unsetup" >/dev/null 2>&1; then
  print_test "Shell integration cleanup" "PASS"
else
  print_test "Shell integration cleanup" "FAIL"
fi

# Clean up test files
rm -f /tmp/test.env

# Final results
echo
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}           Test Results Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"

if [[ ${TESTS_FAILED} -eq 0 ]]; then
  echo -e "${GREEN}🎉 All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed.${NC}"
  exit 1
fi
