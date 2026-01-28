# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/mobile/package*.json ./apps/mobile/

# Install dependencies
RUN npm ci

# Copy source files
COPY apps/mobile ./apps/mobile

# Build the web application with production env vars
WORKDIR /app/apps/mobile
ENV EXPO_PUBLIC_API_URL=https://api.mtgleyline.com/api
RUN npm install && npx expo export --platform web

# Production stage
FROM nginx:alpine

# Copy the built files from builder
COPY --from=builder /app/apps/mobile/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/mobile/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
