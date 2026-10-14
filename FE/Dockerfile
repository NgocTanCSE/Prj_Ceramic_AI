# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# Build the production bundle
RUN npm run build

# ── Stage 2: Serve (nginx multi-stage) ──────────────────────
FROM nginx:alpine AS runner

# Install wget for healthchecks
RUN apk add --no-cache wget

# Copy custom nginx config (with pid in /tmp for non-root)
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Ensure /run and /var/cache exist with correct ownership
RUN mkdir -p /run /var/cache/nginx /var/log/nginx && \
    chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx /run

# Run as the default nginx user (UID 101) from the base image
USER nginx

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
