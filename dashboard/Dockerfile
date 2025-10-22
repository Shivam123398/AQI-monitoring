# Dashboard Dockerfile (multi-stage, Next.js standalone)
# Base image
FROM node:20-alpine AS base
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci

# Build stage
FROM deps AS build
# Build-time public env for Next.js
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# Copy source
COPY . .
# Build Next.js (requires next.config.js to have output: 'standalone')
RUN npm run build

# Production runner
FROM node:20-alpine AS runner
ENV NODE_ENV=production
# Bind to all interfaces to allow Docker port mapping
ENV HOST=0.0.0.0
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
# Copy Next standalone server and static assets
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Expose port and run server
EXPOSE 3000
CMD ["node", "server.js"]
