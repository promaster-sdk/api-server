FROM node:24.9.0 AS builder
WORKDIR /app
RUN corepack enable
COPY src src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.settings.json ./
RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM node:24.9.0-slim

WORKDIR /app
RUN corepack enable
COPY --from=builder /app/lib/ ./lib
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

CMD ["node", "./lib/server/server"]
