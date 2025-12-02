# File: Dockerfile

FROM node:20-bookworm-slim AS base

# openssl will be a required package if base is updated to 18.16+ due to node:*-slim base distro change
# https://github.com/prisma/prisma/issues/19729#issuecomment-1591270599
# Install ffmpeg
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
    ffmpeg \
    tini \
    openssl \
    ca-certificates \
    && apt-get autoclean \
    && apt-get autoremove \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
FROM base AS dependencies

WORKDIR /usr/app

# Add Python and build tools to compile native modules
RUN apt-get update \
    && apt-get install --no-install-recommends -y \
    python3 \
    python-is-python3 \
    build-essential \
    && apt-get autoclean \
    && apt-get autoremove \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm ci --omit=dev
RUN cp -R node_modules /usr/app/prod_node_modules

RUN npm ci

FROM dependencies AS builder

COPY . .

# Run tsc build
RUN npm run prisma:generate
RUN npm run build

# Only keep what's necessary to run
FROM base AS runner

WORKDIR /usr/app

# Copy built application
COPY --from=builder /usr/app/dist ./dist
# Copy production dependencies
COPY --from=dependencies /usr/app/prod_node_modules ./node_modules
# Copy Prisma client (needed at runtime)
COPY --from=builder /usr/app/node_modules/.prisma/client ./node_modules/.prisma/client
# Copy Prisma CLI (needed for migrations at runtime)
COPY --from=builder /usr/app/node_modules/prisma ./node_modules/prisma
# Copy Prisma schema and migrations (needed for migrate deploy)
COPY --from=builder /usr/app/schema.prisma ./schema.prisma
COPY --from=builder /usr/app/migrations ./migrations

# Create data directory
RUN mkdir -p /data

ARG COMMIT_HASH=unknown
ARG BUILD_DATE=unknown

ENV DATA_DIR=/data
ENV NODE_ENV=production
ENV COMMIT_HASH=$COMMIT_HASH
ENV BUILD_DATE=$BUILD_DATE
ENV ENV_FILE=/config

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["tini", "--"]

CMD ["node", "--enable-source-maps", "dist/scripts/migrate-and-start.js"]
