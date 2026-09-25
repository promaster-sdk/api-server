FROM node:24.9.0 AS builder
WORKDIR /app
RUN npm install -g corepack@0.36.0 && corepack enable
COPY src src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.settings.json ./
RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM node:24.9.0 AS deps
WORKDIR /app
RUN npm install -g corepack@0.36.0 && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM node:24.9.0-slim

WORKDIR /app
COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/lib/ ./lib

CMD ["node", "./lib/server/server"]
