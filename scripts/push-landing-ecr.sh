#!/bin/bash
set -e

# Configuration
AWS_REGION="us-west-1"
AWS_ACCOUNT_ID="394802158542"
ECR_REPO="leyline-landing"
IMAGE_NAME="leyline-landing"

# Get the tag from argument or default to 'latest'
TAG="${1:-latest}"

# Full ECR URI
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Building and pushing ${IMAGE_NAME}:${TAG} to ECR...${NC}"

# Navigate to monorepo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$MONOREPO_ROOT"

echo -e "${GREEN}[1/4] Authenticating Docker with ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_URI}

echo -e "${GREEN}[2/4] Building Docker image...${NC}"
docker build -t ${IMAGE_NAME}:${TAG} -f apps/landing/Dockerfile .

echo -e "${GREEN}[3/4] Tagging image for ECR...${NC}"
docker tag ${IMAGE_NAME}:${TAG} ${ECR_URI}:${TAG}

# Also tag as latest if we're pushing a specific version
if [ "$TAG" != "latest" ]; then
    docker tag ${IMAGE_NAME}:${TAG} ${ECR_URI}:latest
fi

echo -e "${GREEN}[4/4] Pushing image to ECR...${NC}"
docker push ${ECR_URI}:${TAG}

if [ "$TAG" != "latest" ]; then
    docker push ${ECR_URI}:latest
fi

echo -e "${GREEN}Successfully pushed ${ECR_URI}:${TAG}${NC}"
echo ""
echo "Image URI: ${ECR_URI}:${TAG}"
