# Leyline Landing Page (Alpha)

A static landing page for Leyline featuring an MTG 1v1 battlefield visualization.

## Features

- Fancy hero page with MTG board space visualization
- Login/Signup CTAs
- Alpha badge indicator
- Brand-consistent design with Leyline guidelines
- Responsive layout

## Getting Started

```bash
# Install dependencies
npm install

# Copy the environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3002](http://localhost:3002) with your browser.

## Environment Variables

- `NEXT_PUBLIC_APP_URL` - The URL for the main app (default: `http://localhost:8081` for local, `https://app.mtgleyline.com` for production)

## Design

This landing page follows the Leyline brand guidelines:
- Purple color palette (#7C3AED, #8B5CF6, #A78BFA, #C4B5FD)
- Dark background theme
- System font stack
- Gradient effects for premium feel
- Leyline logo with glow effect

Inspired by modern SaaS landing pages with MTG-themed elements.

## Deployment

### Docker Build & Push

Build and push the Docker image to ECR:

```bash
# From monorepo root
npm run docker:push:landing

# Or directly
./scripts/push-landing-ecr.sh

# With a specific tag
./scripts/push-landing-ecr.sh v1.0.0
```

### Kubernetes Deployment

The Helm chart is located at `../../infra/charts/landing/`

Deploy to Kubernetes:

```bash
# From monorepo root
cd infra

# Install/upgrade the landing chart
helm upgrade --install leyline-landing ./charts/landing \
  --namespace default \
  --values ./charts/landing/values.yaml

# Check deployment status
kubectl get pods -l app.kubernetes.io/name=leyline-landing
kubectl get ingress
```

### Configuration

Update the following in `infra/charts/landing/values.yaml` before deploying:
- ECR image tag (if not using `latest`)
- AWS certificate ARN for HTTPS
- AWS subnet IDs for ALB
- Domain name (mtgleyline.com)

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Lucide React icons
- Docker + Kubernetes (AWS EKS)
- AWS ALB for ingress
