# Backend Dockerfile (multi-stage, Debian-based for Prisma OpenSSL 3 compatibility)
FROM node:20-bullseye-slim AS base
WORKDIR /app

# Install OS deps for Prisma and certs
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates bash \
  && rm -rf /var/lib/apt/lists/*

# Dependencies stage
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci && npx prisma generate

# Build stage
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production runtime
FROM node:20-bullseye-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# Ensure runtime has required libs
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates bash \
  && rm -rf /var/lib/apt/lists/*

# Copy node_modules (includes Prisma engines), prisma schema, and built app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY package*.json ./

EXPOSE 3000

# Use Prisma db push to create tables if migrations are absent (hackathon-friendly)
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
