# Leyline Deployment Guide

Complete guide for deploying Leyline services to Kubernetes.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Scripts Overview](#scripts-overview)
3. [Deployment Workflow](#deployment-workflow)
4. [Common Tasks](#common-tasks)
5. [Troubleshooting](#troubleshooting)

## Quick Start

### First Time Setup

```bash
# 1. Ensure you're connected to your cluster
kubectl cluster-info

# 2. Run initial setup
npm run k8s:setup

# 3. Deploy initial version
npm run k8s:deploy:all latest
```

### Deploy a New Version

```bash
# Deploy API with version v1.2.0
./scripts/deploy-k8s.sh api v1.2.0

# Deploy Landing with version v1.2.0
./scripts/deploy-k8s.sh landing v1.2.0

# Deploy both at once
./scripts/deploy-k8s.sh all v1.2.0
```

## Scripts Overview

### Deployment Scripts

| Script | Purpose | Example |
|--------|---------|---------|
| `k8s-setup.sh` | Initial cluster setup | `npm run k8s:setup` |
| `deploy-k8s.sh` | Build, push, and deploy | `./scripts/deploy-k8s.sh api v1.0.0` |
| `k8s-utils.sh` | Utility commands | `./scripts/k8s-utils.sh logs api` |
| `push-api-ecr.sh` | Build and push API image | `./scripts/push-api-ecr.sh v1.0.0` |
| `push-landing-ecr.sh` | Build and push Landing image | `./scripts/push-landing-ecr.sh v1.0.0` |

### NPM Scripts

```bash
# Setup
npm run k8s:setup

# Deploy
npm run k8s:deploy:api v1.0.0
npm run k8s:deploy:landing v1.0.0
npm run k8s:deploy:all v1.0.0

# Rollback
npm run k8s:rollback:api
npm run k8s:rollback:landing

# Docker push only
npm run docker:push:api v1.0.0
npm run docker:push:landing v1.0.0
```

## Deployment Workflow

### Standard Release Process

```bash
# 1. Bump version in code and commit
git tag v1.2.0
git push origin v1.2.0

# 2. Build and deploy API
./scripts/deploy-k8s.sh api v1.2.0

# 3. Build and deploy Landing
./scripts/deploy-k8s.sh landing v1.2.0

# 4. Monitor deployment
./scripts/k8s-utils.sh status
./scripts/k8s-utils.sh logs api
```

### Hotfix Process

```bash
# 1. Build and push image only
./scripts/push-api-ecr.sh v1.2.1

# 2. Deploy without rebuilding
./scripts/deploy-k8s.sh api v1.2.1 --skip-build

# 3. Verify
./scripts/k8s-utils.sh status api
```

### Rollback Process

```bash
# Automatic rollback to previous version
./scripts/deploy-k8s.sh api latest --rollback

# Or using npm script
npm run k8s:rollback:api
```

## Common Tasks

### Check Status

```bash
# All services
./scripts/k8s-utils.sh status

# Specific service
./scripts/k8s-utils.sh status api
```

### View Logs

```bash
# Stream logs
./scripts/k8s-utils.sh logs api

# Or directly with kubectl
kubectl logs -f deployment/leyline-api
```

### Restart Service

```bash
./scripts/k8s-utils.sh restart api
```

### Scale Service

```bash
# Scale to 3 replicas
./scripts/k8s-utils.sh scale api 3

# Scale down to 1
./scripts/k8s-utils.sh scale api 1
```

### Port Forward (Local Testing)

```bash
# Forward API to localhost:3001
./scripts/k8s-utils.sh port-forward api

# Forward Landing to localhost:3000
./scripts/k8s-utils.sh port-forward landing
```

### Open Shell in Pod

```bash
./scripts/k8s-utils.sh shell api
```

### View Recent Events

```bash
./scripts/k8s-utils.sh events
```

## Environment Configuration

### Setting up Secrets

```bash
# Create secret for database
kubectl create secret generic leyline-secrets \
  --from-literal=database-url='postgresql://user:pass@host:5432/db' \
  --from-literal=jwt-secret='your-jwt-secret' \
  --from-literal=api-key='your-api-key'

# View secrets (values are base64 encoded)
kubectl get secrets

# Update a secret
kubectl delete secret leyline-secrets
kubectl create secret generic leyline-secrets \
  --from-literal=database-url='new-url'
```

### Updating Environment Variables

Edit the deployment files in `k8s/` directory and apply changes:

```bash
kubectl apply -f k8s/api-deployment.yaml
kubectl rollout restart deployment/leyline-api
```

## Troubleshooting

### Pod Crashes / CrashLoopBackOff

```bash
# Check pod status
./scripts/k8s-utils.sh pods

# View logs
./scripts/k8s-utils.sh logs api

# Describe pod for events
kubectl describe pod <pod-name>

# Check if image exists
aws ecr describe-images \
  --repository-name leyline-api \
  --region us-west-1
```

### Image Pull Errors

```bash
# Re-authenticate with ECR
aws ecr get-login-password --region us-west-1 | \
  docker login --username AWS --password-stdin \
  394802158542.dkr.ecr.us-west-1.amazonaws.com

# Verify image exists
docker pull 394802158542.dkr.ecr.us-west-1.amazonaws.com/leyline-api:v1.0.0
```

### Service Not Accessible

```bash
# Check service and endpoints
kubectl get svc leyline-api
kubectl get endpoints leyline-api

# Test with port-forward
./scripts/k8s-utils.sh port-forward api
curl http://localhost:3001/health

# Check ingress
kubectl get ingress
kubectl describe ingress leyline-ingress
```

### Database Connection Issues

```bash
# Verify secrets exist
kubectl get secrets

# Check secret values (base64 encoded)
kubectl get secret leyline-secrets -o yaml

# Test connection from pod
./scripts/k8s-utils.sh shell api
# Inside pod:
env | grep DATABASE
```

### High Memory/CPU Usage

```bash
# Check resource usage
kubectl top pods

# Check resource limits
kubectl describe deployment leyline-api

# Scale up if needed
./scripts/k8s-utils.sh scale api 3
```

## Monitoring

### Basic Monitoring

```bash
# Watch pod status
kubectl get pods -w

# Monitor deployments
kubectl get deployments -w

# View resource usage
kubectl top pods
kubectl top nodes
```

### Rollout Status

```bash
# Check rollout progress
kubectl rollout status deployment/leyline-api

# View rollout history
kubectl rollout history deployment/leyline-api

# Pause/Resume rollout
kubectl rollout pause deployment/leyline-api
kubectl rollout resume deployment/leyline-api
```

## Best Practices

1. **Always use semantic versioning** (v1.2.3) for production deployments
2. **Tag git commits** with version before deploying
3. **Test in staging** environment first
4. **Monitor logs** during and after deployment
5. **Set appropriate resource limits** in deployment manifests
6. **Use secrets** for sensitive data
7. **Keep rollback plan ready** - know the last working version
8. **Document changes** in release notes
9. **Run health checks** after deployment
10. **Communicate** with team before production deployments

## Release Checklist

- [ ] Code reviewed and merged
- [ ] Tests passing
- [ ] Version bumped and tagged in git
- [ ] Changelog updated
- [ ] Staging deployment successful
- [ ] Database migrations applied (if any)
- [ ] Environment variables configured
- [ ] Secrets updated (if needed)
- [ ] Team notified of deployment
- [ ] Production deployment completed
- [ ] Health checks verified
- [ ] Logs monitored for errors
- [ ] Performance metrics checked
- [ ] Rollback plan confirmed

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [AWS ECR Documentation](https://docs.aws.amazon.com/ecr/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)

## Support

For issues or questions:
- Check logs: `./scripts/k8s-utils.sh logs <service>`
- View events: `./scripts/k8s-utils.sh events`
- Check status: `./scripts/k8s-utils.sh status`
- Review this documentation and `k8s/README.md`
