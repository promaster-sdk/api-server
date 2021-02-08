FROM node:14.15.4 AS builder
WORKDIR /app
COPY src src
COPY package.json yarn.lock tsconfig.json tsconfig.settings.json ./
RUN yarn install
RUN yarn run build

FROM node:14.15.4

WORKDIR /app
COPY --from=builder /app/lib/ ./lib
COPY package.json yarn.lock ./
RUN yarn install --production

CMD ["node", "./lib/server/server"]