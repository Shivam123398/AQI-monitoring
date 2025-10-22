# Scripts Dockerfile for seeding (multi-stage minimal)
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# Install only what we need for scripts
COPY backend/prisma ./prisma
RUN npm init -y \
 && npm install --no-audit --no-fund @prisma/client@^5.7.1 prisma@^5.7.1 @faker-js/faker@^8 tsx@^4.7.0 \
 && npx prisma generate

# Copy scripts
COPY scripts ./scripts

ENV NODE_ENV=production
# Create schema (db push) first, then seed
CMD sh -c "npx prisma db push && npx tsx scripts/seed.ts"
