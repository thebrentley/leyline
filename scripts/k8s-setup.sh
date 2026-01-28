#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

NAMESPACE="default"

# Navigate to monorepo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$MONOREPO_ROOT"

echo -e "${YELLOW}================================${NC}"
echo -e "${YELLOW}Leyline K8s Initial Setup${NC}"
echo -e "${YELLOW}================================${NC}"
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

# Create namespace if it doesn't exist
echo -e "${BLUE}[1/4] Creating namespace (if needed)...${NC}"
kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

# Apply API deployment
echo -e "${BLUE}[2/4] Applying API deployment...${NC}"
kubectl apply -f k8s/api-deployment.yaml -n ${NAMESPACE}

# Apply Landing deployment
echo -e "${BLUE}[3/4] Applying Landing deployment...${NC}"
kubectl apply -f k8s/landing-deployment.yaml -n ${NAMESPACE}

# Apply Ingress (optional)
echo -e "${BLUE}[4/4] Applying Ingress configuration...${NC}"
read -p "Do you want to apply the Ingress configuration? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    kubectl apply -f k8s/ingress.yaml -n ${NAMESPACE}
    echo -e "${GREEN}✓ Ingress configured${NC}"
else
    echo -e "${YELLOW}Skipping Ingress setup${NC}"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "Current deployments:"
kubectl get deployments -n ${NAMESPACE} -l 'app in (leyline-api,leyline-landing)'
echo ""
echo -e "Current services:"
kubectl get services -n ${NAMESPACE} -l 'app in (leyline-api,leyline-landing)'
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Configure your secrets (if needed):"
echo "   kubectl create secret generic leyline-secrets -n ${NAMESPACE} \\"
echo "     --from-literal=database-url='your-database-url'"
echo ""
echo "2. Deploy a new version:"
echo "   ./scripts/deploy-k8s.sh api v1.0.0"
echo "   ./scripts/deploy-k8s.sh landing v1.0.0"
echo ""
echo "3. Check pod status:"
echo "   kubectl get pods -n ${NAMESPACE}"
