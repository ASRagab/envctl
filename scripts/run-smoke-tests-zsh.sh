#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    envctl Smoke Tests (Zsh)${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# Check if Docker is available
if ! command -v docker &>/dev/null; then
  echo -e "${RED}❌ Docker is not installed or not available${NC}"
  echo "Please install Docker to run smoke tests."
  exit 1
fi

# Check if Docker daemon is running
if ! docker info &>/dev/null; then
  echo -e "${RED}❌ Docker daemon is not running${NC}"
  echo "Please start Docker daemon."
  exit 1
fi

echo -e "${YELLOW}🔧 Building Docker image for Zsh smoke tests...${NC}"

# Build the Docker image
if docker build -f docker/Dockerfile.smoke-test-zsh -t envctl-smoke-test-zsh .; then
  echo -e "${GREEN}✓ Docker image built successfully${NC}"
else
  echo -e "${RED}❌ Failed to build Docker image${NC}"
  exit 1
fi

echo
echo -e "${YELLOW}🚀 Running smoke tests with Zsh shell...${NC}"
echo

# Run the smoke tests
if docker run --rm envctl-smoke-test-zsh; then
  echo
  echo -e "${GREEN}🎉 All Zsh smoke tests passed!${NC}"
  echo -e "${GREEN}✓ Your envctl package works with Zsh${NC}"
else
  echo
  echo -e "${RED}❌ Some Zsh smoke tests failed${NC}"
  echo -e "${RED}Please check the output above and fix any issues${NC}"
  exit 1
fi

echo
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}      Zsh Smoke Test Complete${NC}"
echo -e "${BLUE}========================================${NC}"
