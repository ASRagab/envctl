#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  envctl Smoke Tests (Docker Compose)${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# Check if Docker Compose is available
if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null 2>&1; then
  echo -e "${RED}❌ Docker Compose is not installed or not available${NC}"
  echo "Please install Docker Compose to run smoke tests."
  exit 1
fi

# Use docker-compose if available, otherwise use docker compose
if command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
else
  COMPOSE_CMD="docker compose"
fi

echo -e "${YELLOW}🔧 Building and running smoke tests with Docker Compose...${NC}"

# Run smoke tests
if ${COMPOSE_CMD} -f docker-compose.smoke-test.yml run --rm smoke-test; then
  echo
  echo -e "${GREEN}🎉 All smoke tests passed!${NC}"
  echo -e "${GREEN}✓ Your envctl package is ready for release${NC}"
else
  echo
  echo -e "${RED}❌ Some smoke tests failed${NC}"
  echo -e "${RED}Please check the output above and fix any issues${NC}"
  exit 1
fi

echo
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}        Smoke Test Complete${NC}"
echo -e "${BLUE}========================================${NC}"
