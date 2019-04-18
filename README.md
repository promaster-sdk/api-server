# @promaster-sdk/api-server

[![npm version][version-image]][version-url]
[![travis build][travis-image]][travis-url]
[![code style: prettier][prettier-image]][prettier-url]
[![MIT license][license-image]][license-url]

Promaster API server reference implementation

## Overview

A Promaster API server has two end-points, one that recieves files from promaster-edit (Publish API), and one that serves data to front-end applications (Client API). This repo both contain a stand-alone server that implements both end-points, and middlewares that can be embedded as part of your own server.

### Publish API

The Publish API is called by promaster-edit to recieve published files and therefore has to be implemented according to the specification [documented at the promaster documentation site](https://docs.promaster.se/publish-api). A server that implements the Publish API can be built in any language or platform as long as it adheres to this specfication. The Publish API persists the received filed (to disk or other cache) so they can later be served by the Client API. The middleware in this repo contains a reference implementation of the Publish API in typescript/javascript.

### Client API

The Client API serves the data from the files recieved via the Publish API to a client application (which will often be a selection software). This package has a reference implementation of the REST API [documented at the promaster documentation site](https://docs.promaster.se/client-rest-api/) in javascript/typescript. However, the shape of a Client API can of course be anything that the client application requires and can be written in any language or platform.

## How to install

```
yarn add @promaster/api-server
```

## How to use the stand-alone server

```
node lib/server.js
```

The server can be configured with environment variables as, see the [config schema](src/server/config.ts) for all settings..

## How to develop

Clone the repo and run:

```bash
cat << EOF > .env
PUBLISH_AUTHORIZATION=mytoken
EOF
yarn start
```

In promaster-edit, register a new server on port 4500 with an authorization header value of `mytoken`. Publish once to the this server, then you can try the Client API at `http://localhost:4500/rest/v3/markers`.

## How to use the middlewares

The implementations in this package are exported as Koa middlewares. If you are using Koa, you can install and use these middlewares in your own server to make it become a Promaster Publish API target and also a Promater Client API server.

### Publish API

The Koa middleware for the Publish API can be embedded into your existing Koa application.

The example below will mount the Publish API middleware on the `/publish` endpoint and store published files in the `/files` folder. The middleware will create the folder if it does not exist:

```typescript
import * as Koa from "koa";
import * as mount from "koa-mount";
import { createPublishApiMiddleware } from "@promaster/api-server";

const app = new Koa();
const publishApi = createPublishApiMiddleware(getFilesDir);
app.use(mount("/publish", publishApi));

function getFilesDir(ctx: Koa.Context): string {
  return "/files";
}
```

### Client REST API

This repo has a reference implementation of a REST API that can serve the files recieved by the Publish API to front-end clients. How the clients call the API is [documented in full at the promaster documentation site](https://docs.promaster.se/client-rest-api).

> NOTE: This is only a reference implementation, you can write your own REST API that suits the need of your application. For example you may need an authentication solution, or want to only serve parts of the data.

The Koa middleware for the Client REST API can be embedded into your existing Koa application like this:

```js
import * as Koa from "koa";
import * as mount from "koa-mount";
import { createClientRestMiddleware } from "@promaster/api-server";

const app = new Koa();
const clientRestApi = createClientRestMiddleware(getFilesDir, getBaseUrl);
app.use(mount("/rest", clientRestApi));

function getFilesDir(ctx: Koa.Context): string {
  return "/files";
}

function getBaseUrl(ctx: Koa.Context): string {
  return "http://myserver/";
}
```

[version-image]: https://img.shields.io/npm/v/@promaster-sdk/api-server.svg?style=flat
[version-url]: https://www.npmjs.com/package/@promaster-sdk/api-server
[travis-image]: https://travis-ci.com/promaster-sdk/api-server.svg?branch=master&style=flat
[travis-url]: https://travis-ci.com/promaster-sdk/api-server
[license-image]: https://img.shields.io/github/license/promaster-sdk/api-server.svg?style=flat
[license-url]: https://opensource.org/licenses/MIT
[prettier-image]: https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat
[prettier-url]: https://github.com/prettier/prettier
