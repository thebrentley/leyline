# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace setup
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci --workspace=@decktutor/api --workspace=@decktutor/shared

# Copy source files
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# Build shared package first, then API
RUN npm run build --workspace=@decktutor/shared
RUN npm run build --workspace=@decktutor/api

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy node_modules from builder (includes all dependencies)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Copy built assets
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Set NODE_PATH to include workspace node_modules
ENV NODE_PATH=/app/node_modules:/app/apps/api/node_modules

# Expose port
EXPOSE 3001

# Run the application
CMD ["node", "apps/api/dist/main"]
