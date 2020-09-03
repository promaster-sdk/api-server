FROM node:12.18 AS builder
WORKDIR /app
COPY src src
COPY package.json yarn.lock tsconfig.json tsconfig.settings.json ./
RUN yarn install
RUN yarn run build

FROM node:12.18

WORKDIR /app
COPY --from=builder /app/lib/ ./lib
COPY package.json yarn.lock ./
RUN yarn install --production

CMD ["node", "./lib/server/server"]