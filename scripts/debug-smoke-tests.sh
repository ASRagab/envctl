#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   envctl Smoke Test Debug Mode${NC}"
echo -e "${BLUE}========================================${NC}"
echo

# Check if Docker Compose is available
if ! command -v docker-compose &>/dev/null && ! docker compose version &>/dev/null 2>&1; then
  echo -e "${RED}❌ Docker Compose is not installed or not available${NC}"
  echo "Please install Docker Compose to run debug mode."
  exit 1
fi

# Use docker-compose if available, otherwise use docker compose
if command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
else
  COMPOSE_CMD="docker compose"
fi

echo -e "${YELLOW}🔧 Building debug environment...${NC}"

# Build the image first
${COMPOSE_CMD} -f docker-compose.smoke-test.yml build smoke-test-debug

echo
echo -e "${YELLOW}🚀 Starting interactive debug environment...${NC}"
echo -e "${BLUE}ℹ  You can now run smoke tests manually or debug issues${NC}"
echo -e "${BLUE}ℹ  Available commands:${NC}"
echo -e "${BLUE}   - ./scripts/smoke-test.sh          # Run full smoke test suite${NC}"
echo -e "${BLUE}   - envctl --help                    # Test CLI availability${NC}"
echo -e "${BLUE}   - envctl setup                     # Set up shell integration${NC}"
echo -e "${BLUE}   - source ~/.envctl-integration.sh  # Load shell functions${NC}"
echo -e "${BLUE}   - envctl-load <profile>            # Test profile loading${NC}"
echo -e "${BLUE}   - exit                             # Exit debug session${NC}"
echo

# Run interactive debug session
${COMPOSE_CMD} -f docker-compose.smoke-test.yml run --rm smoke-test-debug

echo
echo -e "${GREEN}✓ Debug session completed${NC}"
