#!/bin/bash
set -e

# Configuration
REGISTRY="registry.digitalocean.com/leyline"
IMAGE_NAME="leyline-landing"

# Get the tag from argument or default to 'latest'
TAG="${1:-latest}"

# Full registry URI
IMAGE_URI="${REGISTRY}/${IMAGE_NAME}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Building and pushing ${IMAGE_NAME}:${TAG} to DOCR...${NC}"

# Navigate to monorepo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$MONOREPO_ROOT"

echo -e "${GREEN}[1/4] Authenticating Docker with DOCR...${NC}"
doctl registry login

echo -e "${GREEN}[2/3] Building linux/amd64 image...${NC}"
docker buildx build --platform linux/amd64 \
    -t ${IMAGE_URI}:${TAG} \
    ${TAG:+$([ "$TAG" != "latest" ] && echo "-t ${IMAGE_URI}:latest")} \
    -f apps/landing/Dockerfile \
    --push .

echo -e "${GREEN}[3/3] Pushed to DOCR.${NC}"

echo -e "${GREEN}Successfully pushed ${IMAGE_URI}:${TAG}${NC}"
echo ""
echo "Image URI: ${IMAGE_URI}:${TAG}"
