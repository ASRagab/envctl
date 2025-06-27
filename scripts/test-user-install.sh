#!/bin/bash

# Test script to validate user installation experience
# This simulates the exact process a user goes through when installing from npm

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  User Installation Experience Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# Clean up any previous test artifacts
echo -e "${YELLOW}Cleaning up previous test artifacts...${NC}"
rm -f *.tgz
npm uninstall -g @twelvehart/envctl 2>/dev/null || true

# Build the project
echo -e "${YELLOW}Building project...${NC}"
npm run build

# Create package (simulate npm publish)
echo -e "${YELLOW}Creating package tarball...${NC}"
npm pack

# Get the package filename
PACKAGE_FILE=$(ls *.tgz)
echo -e "${GREEN}✓${NC} Created package: ${PACKAGE_FILE}"

# Install globally (simulate user installation)
echo -e "${YELLOW}Installing package globally (simulating user experience)...${NC}"
npm install -g "./${PACKAGE_FILE}"

# Test basic functionality
echo -e "${YELLOW}Testing installed CLI...${NC}"

# Test 1: Basic help command
if envctl --help >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} CLI help works"
else
  echo -e "${RED}✗${NC} CLI help failed"
  exit 1
fi

# Test 2: Basic command (should catch missing dependencies)
if envctl list >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Basic commands work"
else
  echo -e "${RED}✗${NC} Basic commands failed - likely missing production dependency"
  exit 1
fi

# Test 3: Create a test profile
if envctl create test-install >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Profile creation works"
else
  echo -e "${RED}✗${NC} Profile creation failed"
  exit 1
fi

# Test 4: Add variable
if envctl add test-install TEST_VAR=test_value >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Variable addition works"
else
  echo -e "${RED}✗${NC} Variable addition failed"
  exit 1
fi

# Test 5: Setup shell integration
if envctl setup >/dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Shell integration setup works"
else
  echo -e "${RED}✗${NC} Shell integration setup failed"
  exit 1
fi

# Cleanup test profile
envctl delete test-install >/dev/null 2>&1 || true
envctl unsetup >/dev/null 2>&1 || true

# Uninstall
echo -e "${YELLOW}Cleaning up installation...${NC}"
npm uninstall -g @twelvehart/envctl
rm -f "${PACKAGE_FILE}"

echo
echo -e "${GREEN}🎉 All user installation tests passed!${NC}"
echo -e "${BLUE}The package can be safely installed by users.${NC}" 