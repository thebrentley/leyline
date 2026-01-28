#!/bin/bash
set -e

# Configuration
AWS_REGION="us-west-1"
AWS_ACCOUNT_ID="394802158542"
NAMESPACE="default"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Navigate to monorepo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$MONOREPO_ROOT"

# Usage function
usage() {
    echo "Usage: $0 <service> <version> [options]"
    echo ""
    echo "Arguments:"
    echo "  service     Service to deploy: api, landing, or all"
    echo "  version     Version tag (e.g., v1.0.0, latest)"
    echo ""
    echo "Options:"
    echo "  --skip-build    Skip building and pushing Docker image"
    echo "  --dry-run       Show what would be deployed without applying"
    echo "  --rollback      Rollback to previous deployment"
    echo ""
    echo "Examples:"
    echo "  $0 api v1.0.0"
    echo "  $0 landing latest --skip-build"
    echo "  $0 all v1.2.0"
    echo "  $0 api v1.0.0 --rollback"
    exit 1
}

# Parse arguments
if [ $# -lt 2 ]; then
    usage
fi

SERVICE="$1"
VERSION="$2"
SKIP_BUILD=false
DRY_RUN=false
ROLLBACK=false

# Parse optional flags
shift 2
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --rollback)
            ROLLBACK=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            ;;
    esac
done

# Validate service
if [[ "$SERVICE" != "api" && "$SERVICE" != "landing" && "$SERVICE" != "all" ]]; then
    echo -e "${RED}Error: Service must be 'api', 'landing', or 'all'${NC}"
    usage
fi

# Function to build and push image
build_and_push() {
    local service=$1
    local version=$2

    echo -e "${BLUE}[BUILD] Building and pushing ${service}:${version}...${NC}"

    if [ "$service" = "api" ]; then
        ./scripts/push-api-ecr.sh "$version"
    elif [ "$service" = "landing" ]; then
        ./scripts/push-landing-ecr.sh "$version"
    fi
}

# Function to rollback deployment
rollback_deployment() {
    local service=$1
    local deployment_name="leyline-${service}"

    echo -e "${YELLOW}[ROLLBACK] Rolling back ${deployment_name}...${NC}"
    kubectl rollout undo deployment/${deployment_name} -n ${NAMESPACE}
    kubectl rollout status deployment/${deployment_name} -n ${NAMESPACE}
    echo -e "${GREEN}✓ Rollback completed for ${deployment_name}${NC}"
}

# Function to deploy service
deploy_service() {
    local service=$1
    local version=$2
    local ecr_repo="leyline-${service}"
    local image_uri="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ecr_repo}:${version}"
    local deployment_name="leyline-${service}"

    echo -e "${BLUE}[DEPLOY] Deploying ${service} version ${version}...${NC}"

    # Update the image in the deployment
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY-RUN] Would update ${deployment_name} to ${image_uri}${NC}"
    else
        # Set the new image
        kubectl set image deployment/${deployment_name} \
            ${service}=${image_uri} \
            -n ${NAMESPACE} \
            --record

        # Wait for rollout to complete
        echo -e "${YELLOW}Waiting for rollout to complete...${NC}"
        kubectl rollout status deployment/${deployment_name} -n ${NAMESPACE}

        # Verify deployment
        echo -e "${GREEN}✓ Deployment completed successfully${NC}"
        kubectl get pods -l app=${deployment_name} -n ${NAMESPACE}
    fi
}

# Function to show deployment info
show_deployment_info() {
    local service=$1
    local deployment_name="leyline-${service}"

    echo -e "${BLUE}[INFO] Current ${service} deployment:${NC}"
    kubectl get deployment ${deployment_name} -n ${NAMESPACE} -o wide
    echo ""
    echo -e "${BLUE}[INFO] Rollout history:${NC}"
    kubectl rollout history deployment/${deployment_name} -n ${NAMESPACE}
}

# Main deployment logic
echo -e "${YELLOW}================================${NC}"
echo -e "${YELLOW}Leyline Kubernetes Deployment${NC}"
echo -e "${YELLOW}================================${NC}"
echo ""
echo -e "Service:   ${GREEN}${SERVICE}${NC}"
echo -e "Version:   ${GREEN}${VERSION}${NC}"
echo -e "Namespace: ${GREEN}${NAMESPACE}${NC}"
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

# Check if connected to cluster
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Not connected to a Kubernetes cluster${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Connected to cluster${NC}"
echo ""

# Handle rollback
if [ "$ROLLBACK" = true ]; then
    if [ "$SERVICE" = "all" ]; then
        rollback_deployment "api"
        rollback_deployment "landing"
    else
        rollback_deployment "$SERVICE"
    fi
    exit 0
fi

# Build and push images
if [ "$SKIP_BUILD" = false ]; then
    if [ "$SERVICE" = "all" ]; then
        build_and_push "api" "$VERSION"
        build_and_push "landing" "$VERSION"
    else
        build_and_push "$SERVICE" "$VERSION"
    fi
else
    echo -e "${YELLOW}Skipping build step${NC}"
fi

echo ""

# Deploy services
if [ "$SERVICE" = "all" ]; then
    deploy_service "api" "$VERSION"
    echo ""
    deploy_service "landing" "$VERSION"
else
    deploy_service "$SERVICE" "$VERSION"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Deployment Summary${NC}"
echo -e "${GREEN}================================${NC}"
echo ""

# Show deployment info
if [ "$SERVICE" = "all" ]; then
    show_deployment_info "api"
    echo ""
    show_deployment_info "landing"
else
    show_deployment_info "$SERVICE"
fi

echo ""
echo -e "${GREEN}✓ Deployment completed successfully!${NC}"
echo ""
echo "To check logs, run:"
if [ "$SERVICE" = "all" ]; then
    echo "  kubectl logs -f deployment/leyline-api -n ${NAMESPACE}"
    echo "  kubectl logs -f deployment/leyline-landing -n ${NAMESPACE}"
else
    echo "  kubectl logs -f deployment/leyline-${SERVICE} -n ${NAMESPACE}"
fi
