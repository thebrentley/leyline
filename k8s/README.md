# Kubernetes Deployment Guide

This directory contains Kubernetes manifests and deployment scripts for the Leyline application.

## Prerequisites

- `kubectl` installed and configured
- AWS CLI configured with access to ECR
- Docker installed for building images
- Access to the Kubernetes cluster

## Quick Start

### 1. Initial Setup

Run the setup script to create the initial deployments:

```bash
npm run k8s:setup
# or
./scripts/k8s-setup.sh
```

This will:
- Create the namespace (if needed)
- Deploy the API and Landing services
- Optionally configure the Ingress

### 2. Deploy a New Version

To deploy a specific version:

```bash
# Deploy API
./scripts/deploy-k8s.sh api v1.0.0

# Deploy Landing
./scripts/deploy-k8s.sh landing v1.0.0

# Deploy both
./scripts/deploy-k8s.sh all v1.0.0
```

Or using npm scripts:

```bash
npm run k8s:deploy:api v1.0.0
npm run k8s:deploy:landing v1.0.0
npm run k8s:deploy:all v1.0.0
```

### 3. Skip Building (Deploy Only)

If the image is already built and pushed to ECR:

```bash
./scripts/deploy-k8s.sh api v1.0.0 --skip-build
```

### 4. Dry Run

Preview what would be deployed without applying changes:

```bash
./scripts/deploy-k8s.sh api v1.0.0 --dry-run
```

### 5. Rollback

Rollback to the previous deployment:

```bash
./scripts/deploy-k8s.sh api latest --rollback
# or
npm run k8s:rollback:api
```

## Deployment Files

### api-deployment.yaml
- Deployment for the API service
- Service exposing port 3001
- Configured with health checks
- 2 replicas by default

### landing-deployment.yaml
- Deployment for the Landing page
- Service exposing port 3000
- Configured with health checks
- 2 replicas by default

### ingress.yaml
- Ingress configuration for routing
- Configured for:
  - `leyline.com` → Landing
  - `www.leyline.com` → Landing
  - `api.leyline.com` → API
- TLS/SSL configuration with cert-manager

## Environment Variables

Update the deployment files to add your environment variables:

```yaml
env:
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: leyline-secrets
      key: database-url
```

### Creating Secrets

```bash
kubectl create secret generic leyline-secrets \
  --from-literal=database-url='postgresql://...' \
  --from-literal=api-key='your-api-key'
```

## Monitoring

### Check Deployment Status

```bash
kubectl get deployments -n default
kubectl get pods -n default
kubectl get services -n default
```

### View Logs

```bash
# API logs
kubectl logs -f deployment/leyline-api -n default

# Landing logs
kubectl logs -f deployment/leyline-landing -n default

# Specific pod
kubectl logs -f <pod-name> -n default
```

### Check Rollout History

```bash
kubectl rollout history deployment/leyline-api -n default
kubectl rollout history deployment/leyline-landing -n default
```

### Describe Resources

```bash
kubectl describe deployment/leyline-api -n default
kubectl describe pod <pod-name> -n default
```

## Scaling

### Manual Scaling

```bash
kubectl scale deployment/leyline-api --replicas=3 -n default
```

### Auto-scaling

Create a HorizontalPodAutoscaler:

```bash
kubectl autoscale deployment/leyline-api \
  --cpu-percent=70 \
  --min=2 \
  --max=10 \
  -n default
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl get pods -n default

# View pod events
kubectl describe pod <pod-name> -n default

# Check logs
kubectl logs <pod-name> -n default
```

### Image Pull Errors

Ensure ECR authentication is configured:

```bash
aws ecr get-login-password --region us-west-1 | \
  docker login --username AWS --password-stdin \
  394802158542.dkr.ecr.us-west-1.amazonaws.com
```

### Service Not Accessible

```bash
# Check service endpoints
kubectl get endpoints -n default

# Port forward for testing
kubectl port-forward svc/leyline-api 3001:3001 -n default
```

## Best Practices

1. **Always tag with semantic versions** instead of `latest` for production
2. **Test in staging** before deploying to production
3. **Use `--dry-run`** to verify changes before applying
4. **Monitor rollout** status after deployment
5. **Keep rollback ready** - know the last working version
6. **Set resource limits** to prevent resource exhaustion
7. **Use secrets** for sensitive data, never commit them

## Complete Deployment Workflow

```bash
# 1. Build and test locally
npm run build:api
npm run test

# 2. Build and push Docker image with version tag
./scripts/push-api-ecr.sh v1.2.0

# 3. Deploy to Kubernetes
./scripts/deploy-k8s.sh api v1.2.0

# 4. Monitor the deployment
kubectl rollout status deployment/leyline-api -n default

# 5. Verify it's working
kubectl get pods -n default
kubectl logs -f deployment/leyline-api -n default

# 6. If issues occur, rollback
./scripts/deploy-k8s.sh api v1.2.0 --rollback
```

## Production Checklist

Before deploying to production:

- [ ] Code reviewed and merged to main
- [ ] Tests passing
- [ ] Version tagged in git
- [ ] Docker image built and pushed to ECR
- [ ] Environment variables configured
- [ ] Secrets created in cluster
- [ ] Resource limits set appropriately
- [ ] Health checks configured
- [ ] Monitoring and alerting set up
- [ ] Backup plan in place
- [ ] Rollback procedure tested

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [AWS ECR Documentation](https://docs.aws.amazon.com/ecr/)
