#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NAMESPACE="default"

# Navigate to monorepo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="${MONOREPO_ROOT}/../infra"
cd "$MONOREPO_ROOT"

echo -e "${YELLOW}================================${NC}"
echo -e "${YELLOW}Leyline K8s Initial Setup${NC}"
echo -e "${YELLOW}================================${NC}"
echo ""

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

# Create namespace if it doesn't exist
echo -e "${BLUE}[1/3] Creating namespace (if needed)...${NC}"
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Install Helm charts
echo -e "${BLUE}[2/3] Installing Helm charts...${NC}"

for service in api app landing; do
    CHART_DIR="${INFRA_DIR}/charts/${service}"
    if [ -d "$CHART_DIR" ]; then
        echo -e "${YELLOW}  Installing ${service}...${NC}"
        helm upgrade --install ${service} ${CHART_DIR} --namespace ${NAMESPACE}
        echo -e "${GREEN}  ${service} installed${NC}"
    else
        echo -e "${RED}  Chart not found: ${CHART_DIR}${NC}"
    fi
done

# Show status
echo -e "${BLUE}[3/3] Verifying deployments...${NC}"
echo ""

echo -e "Helm releases:"
helm list -n ${NAMESPACE}
echo ""

echo -e "Deployments:"
kubectl get deployments -n ${NAMESPACE}
echo ""

echo -e "Services:"
kubectl get services -n ${NAMESPACE}

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Ensure Terraform has provisioned secrets (leyline-api-database, leyline-api-secrets)"
echo ""
echo "2. Deploy a new version:"
echo "   ./scripts/deploy-k8s.sh api v1.0.0"
echo "   ./scripts/deploy-k8s.sh app v1.0.0"
echo "   ./scripts/deploy-k8s.sh landing v1.0.0"
echo ""
echo "3. Check pod status:"
echo "   kubectl get pods -n ${NAMESPACE}"
