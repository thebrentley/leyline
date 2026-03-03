# Build stage
FROM node:20 AS builder

WORKDIR /app

# Copy the mobile app
COPY apps/mobile ./

# Install dependencies directly in the app directory
RUN npm install --legacy-peer-deps

# Build the web application with production env vars
ENV EXPO_PUBLIC_API_URL=https://api.mtgleyline.com/api
RUN npx expo export --platform web

# Production stage
FROM nginx:alpine

# Copy the built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/mobile/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
