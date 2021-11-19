# @promaster-sdk/api-server

[![npm version][version-image]][version-url]
[![build][build-image]][build-url]
[![code style: prettier][prettier-image]][prettier-url]
[![MIT license][license-image]][license-url]

Promaster API server reference implementation

## Overview

A Promaster API server has two end-points, one that recieves files from promaster-edit (Publish API), and one that serves data to front-end applications (Client API). This repo contain a stand-alone server that implements both end-points, and middlewares that can be embedded as part of your own server.

### Publish API

The Publish API is called by promaster-edit to recieve published files and therefore has to be implemented according to the specification [documented at the promaster documentation site](https://docs.promaster.se/publish-api). A server that implements the Publish API can be built in any language or platform as long as it adheres to this specfication. The Publish API persists the received filed (to disk or other cache) so they can later be served by the Client API. The middleware in this repo contains a reference implementation of the Publish API in typescript/javascript.

### Client API

The Client API serves the data from the files recieved via the Publish API to a client application (which will often be a selection software). This package has a reference implementation of the REST API [documented at the promaster documentation site](https://docs.promaster.se/client-rest-api/) in javascript/typescript. However, the shape of a Client API can of course be anything that the client application requires and can be written in any language or platform.

## How to install

```bash
yarn add @promaster-sdk/api-server
```

## How to use the stand-alone server

```bash
node lib/server.js
```

The server can be configured with environment variables as, see the [config schema](src/server/config.ts) for all settings..

## How to use the middlewares

The implementations in this package are exported as Koa middlewares. If you are using Koa, you can install and use these middlewares in your own server to make it become a Promaster Publish API target and also a Promater Client API server.

### Publish API

The example below will mount the Publish API middleware on the `/publish` endpoint and store published files in the `/files` folder. The middleware will create the folder if it does not exist:

```typescript
import * as Koa from "koa";
import * as mount from "koa-mount";
import { createPublishApiMiddleware } from "@promaster-sdk/api-server";

const app = new Koa();
const publishApi = createPublishApiMiddleware(
    () => "/files",
    undefined: string, // prefix?: string - If the middleware is mounted on a subpath
    50, // readFilesInParallel: number - Max parallel read requests
    true, // pruneFiles = true - If files should be deleted when not referenced by any marker files
  (databaseId) => {
    console.log(`Publish for database ${databaseId} complete.`);
    return Promise.resolve();
  }), // onPublishComplete: (databaseId: string) => Promise<void> =  - Register callback for when a database publish has been completed;
app.use(mount("/publish", publishApi));
```

### Client REST API

This repo has a reference implementation of a REST API that can serve the files recieved by the Publish API to front-end clients. How the clients call the API is [documented at the promaster documentation site](https://docs.promaster.se/client-rest-api).

> NOTE: This is only a reference implementation, you can write your own Client API that suits the need of your application. For example you may need an authentication solution, or want to only serve parts of the data.

The Koa middleware for the Client REST API can be embedded into your existing Koa application like this:

```js
import * as Koa from "koa";
import * as mount from "koa-mount";
import { createClientRestMiddleware } from "@promaster-sdk/api-server";

const app = new Koa();
const clientRestApi = createClientRestMiddleware(
  () => "/files",
  () => "http://myserver/"
);
app.use(mount("/rest", clientRestApi));
```

### Client GraphQL API

This repo has an implementation of a GraphQL API that can serve the files recieved by the Publish API to front-end clients. The schema is determined dynamically from the tables available in hte published files which makes it possible to generate types from the schema that corresponds to the tables.

> NOTE: This is only a reference implementation, you can write your own Client API that suits the need of your application. For example you may need an authentication solution, or want to only serve parts of the data.

The Koa middleware for the Client GraphQL API can be embedded into your existing Koa application like this:

```js
import * as Koa from "koa";
import * as mount from "koa-mount";
import { createClientRestMiddleware } from "@promaster-sdk/api-server";

const app = new Koa();
const clientGraphQLApi = createClientGraphQLMiddleware(
  () => "/files",
  () => "http://myserver/"
);
app.use(mount("/graphql", clientGraphQLApi));
```

## Open Telemetry

The server has support for OpenTelemetry which can be enabled with the `OTEL_ENABLE` environment variable.

```bash
OTEL_ENABLE=true
```

When enables, you can use the [standard environment variables](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/sdk-environment-variables.md#general-sdk-configuration) to configure open telemetry:

- `OTEL_RESOURCE_ATTRIBUTES`
- `OTEL_SERVICE_NAME`
- `OTEL_LOG_LEVEL`
- `OTEL_PROPAGATORS`
- `OTEL_TRACES_SAMPLER`
- `OTEL_TRACES_SAMPLER_ARG`

For example to set the service name and use verbose diagnostics logging:

```bash
OTEL_SERVICE_NAME=my-api-server
OTEL_LOG_LEVEL=verbose
```

By default, `OTEL_TRACES_SAMPLER` is set to `parentbased_always_on` which means tracing will be used if the parent passes the headers to enable it.

## How to develop

Clone the repo and run:

```bash
cat << EOF > .env
PUBLISH_AUTHORIZATION=mytoken
EOF
yarn start
```

In promaster-edit, register a new server on port 4500 with an authorization header value of `mytoken`. Publish once to the this server, then you can try the Client API at `http://localhost:4500/rest/v3/markers`.

## How to publish to local server

If you are developing a new API server and want promaster to publish to it you can expose your local server on the internet using [ngrok](https://ngrok.com/).

Install ngrok CLI tool and then start it with this commmand:

```
ngrok http 4500
```

- This should give you a temporary public URL that sends traffic to `localhost:4500`.
- The URL will be something like `http://xxxxxxx.ngrok.io`.
- In promaster-edit under the publish area, create an API server with this URL.
- You can now publish to this API server and the data will be sent to `localhost:4500`.

## How to publish new version

```bash
# We should always publish both to npm and dockerhub at the same time with the same version
# First publish a new package version to npm
yarn publish
# You should be promted for your desired version by the above command
# To build and push to dockerhub, replace <version> in the below commands with
# the version you entered for the above command
# NOTE: Need to have this repo as current working dir
# First build locally
docker build -t dividab/promaster-public-api:<version> .
# And then push to dockerhub
docker push dividab/promaster-public-api:<version>
```

[version-image]: https://img.shields.io/npm/v/@promaster-sdk/api-server.svg?style=flat
[version-url]: https://www.npmjs.com/package/@promaster-sdk/api-server
[build-image]: https://github.com/promaster-sdk/api-server/workflows/Build/badge.svg
[build-url]: https://github.com/promaster-sdk/api-server/actions?query=workflow%3ABuild+branch%3Amaster
[license-image]: https://img.shields.io/github/license/promaster-sdk/api-server.svg?style=flat
[license-url]: https://opensource.org/licenses/MIT
[prettier-image]: https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat
[prettier-url]: https://github.com/prettier/prettier
