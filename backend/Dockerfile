FROM node:24-bookworm-slim AS build

WORKDIR /app
# Prisma client generation parses the datasource configuration but does not connect.
# Keep this build-only value out of the runtime stage; deployment injects the real URL.
ENV DATABASE_URL="sqlserver://localhost:1433;database=Sapling Global;user=build;password=build-only-not-a-secret;encrypt=true;trustServerCertificate=true"
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

COPY backend backend
RUN npm run --workspace backend prisma:generate \
    && npm run --workspace backend build \
    && npm prune --omit=dev --omit=optional

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/node_modules ./backend/node_modules
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
COPY --from=build --chown=node:node /app/backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /app/backend/prisma ./backend/prisma

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "backend/dist/main.js"]
