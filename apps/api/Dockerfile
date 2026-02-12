# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace setup
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci --workspace=@leyline/api --workspace=@leyline/shared

# Copy source files
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Build shared package first, then API
RUN npm run build --workspace=@leyline/shared
RUN npm run build --workspace=@leyline/api

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy node_modules from builder (hoisted by npm workspaces)
COPY --from=builder /app/node_modules ./node_modules

# Copy workspace-level node_modules (non-hoisted packages)
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Copy built assets
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy package.json files for proper module resolution
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json

# Expose port
EXPOSE 3001

# Run the application
CMD ["node", "apps/api/dist/main"]
