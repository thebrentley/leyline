#!/bin/bash
set -e

# Configuration
NAMESPACE="default"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Usage function
usage() {
    echo "Kubernetes Utility Commands"
    echo ""
    echo "Usage: $0 <command> [service]"
    echo ""
    echo "Commands:"
    echo "  status [service]      Show status of deployments and pods"
    echo "  logs <service>        Stream logs from service"
    echo "  restart <service>     Restart a service"
    echo "  scale <service> <n>   Scale service to n replicas"
    echo "  describe <service>    Describe deployment"
    echo "  pods                  List all pods"
    echo "  events                Show recent events"
    echo "  port-forward <svc>    Port forward to local machine"
    echo "  shell <pod>           Open shell in pod"
    echo "  delete <service>      Delete a deployment"
    echo ""
    echo "Services: api, landing"
    echo ""
    echo "Examples:"
    echo "  $0 status"
    echo "  $0 logs api"
    echo "  $0 restart landing"
    echo "  $0 scale api 3"
    echo "  $0 port-forward api"
    exit 1
}

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

# Parse command
if [ $# -lt 1 ]; then
    usage
fi

COMMAND="$1"
SERVICE="${2:-}"

# Convert service to deployment name
get_deployment_name() {
    local svc=$1
    if [[ "$svc" == "api" || "$svc" == "landing" ]]; then
        echo "leyline-${svc}"
    else
        echo "$svc"
    fi
}

# Commands
case $COMMAND in
    status)
        echo -e "${BLUE}Deployments:${NC}"
        if [ -n "$SERVICE" ]; then
            DEPLOYMENT=$(get_deployment_name "$SERVICE")
            kubectl get deployment ${DEPLOYMENT} -n ${NAMESPACE} -o wide
            echo ""
            echo -e "${BLUE}Pods:${NC}"
            kubectl get pods -l app=${DEPLOYMENT} -n ${NAMESPACE}
            echo ""
            echo -e "${BLUE}Rollout History:${NC}"
            kubectl rollout history deployment/${DEPLOYMENT} -n ${NAMESPACE}
        else
            kubectl get deployments -n ${NAMESPACE} -l 'app in (leyline-api,leyline-landing)' -o wide
            echo ""
            echo -e "${BLUE}Pods:${NC}"
            kubectl get pods -n ${NAMESPACE} -l 'app in (leyline-api,leyline-landing)'
            echo ""
            echo -e "${BLUE}Services:${NC}"
            kubectl get services -n ${NAMESPACE} -l 'app in (leyline-api,leyline-landing)'
        fi
        ;;

    logs)
        if [ -z "$SERVICE" ]; then
            echo -e "${RED}Error: Service required${NC}"
            usage
        fi
        DEPLOYMENT=$(get_deployment_name "$SERVICE")
        echo -e "${BLUE}Streaming logs from ${DEPLOYMENT}...${NC}"
        kubectl logs -f deployment/${DEPLOYMENT} -n ${NAMESPACE}
        ;;

    restart)
        if [ -z "$SERVICE" ]; then
            echo -e "${RED}Error: Service required${NC}"
            usage
        fi
        DEPLOYMENT=$(get_deployment_name "$SERVICE")
        echo -e "${YELLOW}Restarting ${DEPLOYMENT}...${NC}"
        kubectl rollout restart deployment/${DEPLOYMENT} -n ${NAMESPACE}
        kubectl rollout status deployment/${DEPLOYMENT} -n ${NAMESPACE}
        echo -e "${GREEN}✓ Restart completed${NC}"
        ;;

    scale)
        if [ -z "$SERVICE" ] || [ -z "$3" ]; then
            echo -e "${RED}Error: Service and replica count required${NC}"
            usage
        fi
        DEPLOYMENT=$(get_deployment_name "$SERVICE")
        REPLICAS="$3"
        echo -e "${YELLOW}Scaling ${DEPLOYMENT} to ${REPLICAS} replicas...${NC}"
        kubectl scale deployment/${DEPLOYMENT} --replicas=${REPLICAS} -n ${NAMESPACE}
        kubectl rollout status deployment/${DEPLOYMENT} -n ${NAMESPACE}
        echo -e "${GREEN}✓ Scaling completed${NC}"
        kubectl get deployment ${DEPLOYMENT} -n ${NAMESPACE}
        ;;

    describe)
        if [ -z "$SERVICE" ]; then
            echo -e "${RED}Error: Service required${NC}"
            usage
        fi
        DEPLOYMENT=$(get_deployment_name "$SERVICE")
        kubectl describe deployment/${DEPLOYMENT} -n ${NAMESPACE}
        ;;

    pods)
        echo -e "${BLUE}All Pods:${NC}"
        kubectl get pods -n ${NAMESPACE}
        ;;

    events)
        echo -e "${BLUE}Recent Events:${NC}"
        kubectl get events -n ${NAMESPACE} --sort-by='.lastTimestamp' | tail -20
        ;;

    port-forward)
        if [ -z "$SERVICE" ]; then
            echo -e "${RED}Error: Service required${NC}"
            usage
        fi
        if [ "$SERVICE" = "api" ]; then
            PORT=3001
        elif [ "$SERVICE" = "landing" ]; then
            PORT=3000
        else
            echo -e "${RED}Error: Unknown service${NC}"
            exit 1
        fi
        DEPLOYMENT=$(get_deployment_name "$SERVICE")
        echo -e "${BLUE}Port forwarding ${DEPLOYMENT} to localhost:${PORT}...${NC}"
        echo -e "${YELLOW}Access at: http://localhost:${PORT}${NC}"
        echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
        kubectl port-forward deployment/${DEPLOYMENT} ${PORT}:${PORT} -n ${NAMESPACE}
        ;;

    shell)
        if [ -z "$SERVICE" ]; then
            echo -e "${RED}Error: Pod name or service required${NC}"
            usage
        fi
        # If it's a service name, get a pod from that deployment
        if [[ "$SERVICE" == "api" || "$SERVICE" == "landing" ]]; then
            DEPLOYMENT=$(get_deployment_name "$SERVICE")
            POD=$(kubectl get pods -l app=${DEPLOYMENT} -n ${NAMESPACE} -o jsonpath='{.items[0].metadata.name}')
        else
            POD=$SERVICE
        fi
        echo -e "${BLUE}Opening shell in ${POD}...${NC}"
        kubectl exec -it ${POD} -n ${NAMESPACE} -- /bin/sh
        ;;

    delete)
        if [ -z "$SERVICE" ]; then
            echo -e "${RED}Error: Service required${NC}"
            usage
        fi
        DEPLOYMENT=$(get_deployment_name "$SERVICE")
        echo -e "${RED}WARNING: This will delete the ${DEPLOYMENT} deployment${NC}"
        read -p "Are you sure? (yes/no) " -r
        if [[ $REPLY == "yes" ]]; then
            kubectl delete deployment/${DEPLOYMENT} -n ${NAMESPACE}
            kubectl delete service/${DEPLOYMENT} -n ${NAMESPACE}
            echo -e "${GREEN}✓ Deleted ${DEPLOYMENT}${NC}"
        else
            echo -e "${YELLOW}Cancelled${NC}"
        fi
        ;;

    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        usage
        ;;
esac
