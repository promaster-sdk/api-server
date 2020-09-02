FROM node:12.18

WORKDIR /app
COPY lib/ ./lib
COPY package.json yarn.lock ./
RUN yarn install --production

CMD ["node", "./lib/server/server"]