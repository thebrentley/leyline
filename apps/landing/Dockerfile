# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./
COPY apps/landing/package.json ./apps/landing/

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source files
COPY apps/landing ./apps/landing

# Build the application with production env vars
WORKDIR /app/apps/landing
ENV NEXT_PUBLIC_APP_URL=https://app.mtgleyline.com
RUN yarn build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV production
ENV NEXT_PUBLIC_APP_URL https://app.mtgleyline.com

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy the standalone output and static files
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/landing/public ./apps/landing/public

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/landing/server.js"]
