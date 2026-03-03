#!/bin/bash
set -e

# Configuration
REGISTRY="registry.digitalocean.com/leyline"
NAMESPACE="default"
INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../infra"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Navigate to monorepo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$MONOREPO_ROOT"

# Usage function
usage() {
    echo "Usage: $0 <service> <version> [options]"
    echo ""
    echo "Arguments:"
    echo "  service     Service to deploy: api, app, landing, or all"
    echo "  version     Version tag (e.g., v1.0.0, latest)"
    echo ""
    echo "Options:"
    echo "  --skip-build    Skip building and pushing Docker image"
    echo "  --dry-run       Show what would be deployed without applying"
    echo "  --rollback      Rollback to previous deployment"
    echo ""
    echo "Examples:"
    echo "  $0 api v1.0.0"
    echo "  $0 app latest --skip-build"
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
if [[ "$SERVICE" != "api" && "$SERVICE" != "app" && "$SERVICE" != "landing" && "$SERVICE" != "all" ]]; then
    echo -e "${RED}Error: Service must be 'api', 'app', 'landing', or 'all'${NC}"
    usage
fi

# Function to build and push image
build_and_push() {
    local service=$1
    local version=$2

    echo -e "${BLUE}[BUILD] Building and pushing ${service}:${version}...${NC}"
    ./scripts/push-${service}.sh "$version"
}

# Function to rollback deployment
rollback_deployment() {
    local service=$1
    local release_name="leyline-${service}"

    echo -e "${YELLOW}[ROLLBACK] Rolling back ${release_name}...${NC}"
    helm rollback ${release_name} -n ${NAMESPACE}
    echo -e "${GREEN}Rollback completed for ${release_name}${NC}"
}

# Function to deploy service via Helm
deploy_service() {
    local service=$1
    local version=$2
    local chart_dir="${INFRA_DIR}/charts/${service}"
    local release_name="leyline-${service}"
    local image_uri="${REGISTRY}/leyline-${service}"

    echo -e "${BLUE}[DEPLOY] Deploying ${service} version ${version}...${NC}"

    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY-RUN] Would upgrade ${release_name} with image ${image_uri}:${version}${NC}"
        helm upgrade --install ${release_name} ${chart_dir} \
            --namespace ${NAMESPACE} \
            --set image.tag="${version}" \
            --dry-run
    else
        helm upgrade --install ${release_name} ${chart_dir} \
            --namespace ${NAMESPACE} \
            --set image.tag="${version}"

        echo -e "${YELLOW}Waiting for rollout to complete...${NC}"
        kubectl rollout status deployment/${release_name} -n ${NAMESPACE}
        echo -e "${GREEN}Deployment completed successfully${NC}"
    fi
}

# Function to show deployment info
show_deployment_info() {
    local service=$1
    local release_name="leyline-${service}"

    echo -e "${BLUE}[INFO] Current ${service} deployment:${NC}"
    kubectl get deployment ${release_name} -n ${NAMESPACE} -o wide
    echo ""
    echo -e "${BLUE}[INFO] Helm release:${NC}"
    helm status ${release_name} -n ${NAMESPACE} --short 2>/dev/null || true
}

# Main deployment logic
echo -e "${YELLOW}================================${NC}"
echo -e "${YELLOW}Leyline Kubernetes Deployment${NC}"
echo -e "${YELLOW}================================${NC}"
echo ""
echo -e "Service:   ${GREEN}${SERVICE}${NC}"
echo -e "Version:   ${GREEN}${VERSION}${NC}"
echo -e "Namespace: ${GREEN}${NAMESPACE}${NC}"
echo -e "Registry:  ${GREEN}${REGISTRY}${NC}"
echo ""

ALL_SERVICES=("api" "app" "landing")

# Check prerequisites
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

if ! command -v helm &> /dev/null; then
    echo -e "${RED}Error: helm is not installed${NC}"
    exit 1
fi

if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}Error: Not connected to a Kubernetes cluster${NC}"
    exit 1
fi

echo -e "${GREEN}Connected to cluster${NC}"
echo ""

# Handle rollback
if [ "$ROLLBACK" = true ]; then
    if [ "$SERVICE" = "all" ]; then
        for svc in "${ALL_SERVICES[@]}"; do
            rollback_deployment "$svc"
        done
    else
        rollback_deployment "$SERVICE"
    fi
    exit 0
fi

# Build and push images
if [ "$SKIP_BUILD" = false ]; then
    if [ "$SERVICE" = "all" ]; then
        for svc in "${ALL_SERVICES[@]}"; do
            build_and_push "$svc" "$VERSION"
        done
    else
        build_and_push "$SERVICE" "$VERSION"
    fi
else
    echo -e "${YELLOW}Skipping build step${NC}"
fi

echo ""

# Deploy services
if [ "$SERVICE" = "all" ]; then
    for svc in "${ALL_SERVICES[@]}"; do
        deploy_service "$svc" "$VERSION"
        echo ""
    done
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
    for svc in "${ALL_SERVICES[@]}"; do
        show_deployment_info "$svc"
        echo ""
    done
else
    show_deployment_info "$SERVICE"
fi

echo ""
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo ""
echo "To check logs, run:"
if [ "$SERVICE" = "all" ]; then
    for svc in "${ALL_SERVICES[@]}"; do
        echo "  kubectl logs -f deployment/leyline-${svc} -n ${NAMESPACE}"
    done
else
    echo "  kubectl logs -f deployment/leyline-${SERVICE} -n ${NAMESPACE}"
fi
