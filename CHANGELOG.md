# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased](https://github.com/promaster-sdk/api-server/compare/v3.4.0...master)

## [3.4.0](https://github.com/promaster-sdk/api-server/compare/v3.3.0...v3.4.0)

- Remove graphql-tools #43

## [3.3.0](https://github.com/promaster-sdk/api-server/compare/v3.2.0...v3.3.0)

- Upgrade graphql-tools #42
- Upgrade typescript and open-telemetry #41
- Fix await #40

## [3.2.0](https://github.com/promaster-sdk/api-server/compare/v3.1.0...v3.2.0)

- Add support to disable graphiql, GRAPHIQL_ENABLE = false, defaults to true=enabled

## [3.1.0](https://github.com/promaster-sdk/api-server/compare/v3.0.3...v3.1.0)

- Upgrade open telemetry [#35](https://github.com/promaster-sdk/api-server/pull/35)

## [3.0.3](https://github.com/promaster-sdk/api-server/compare/v3.0.1...v3.0.3)

- Bugfix size module (#29)
- Never cache a 404 response #27

## [3.0.1](https://github.com/promaster-sdk/api-server/compare/v3.0.0...v3.0.1)

### Fixed

- Amended magicloud.group.definition to work correctly.

## [3.0.0](https://github.com/promaster-sdk/api-server/compare/v2.5.1...v3.0.0)

### Changed

- GraphQL Client API: For tables that have the same name but not the same columns, create a generated unique name per product. See PR [#25](https://github.com/promaster-sdk/api-server/pull/25).

## [2.5.1](https://github.com/promaster-sdk/api-server/compare/v2.4.1...v2.5.1)

- NOTE: that 2.5.0 release was skipped by mistake

### Added

- Add a publish complete hook to publish middleware. See PR [#24](https://github.com/promaster-sdk/api-server/pull/24).

## [2.4.1](https://github.com/promaster-sdk/api-server/compare/v2.4.0...v2.4.1)

### Fixed

- Fix content type. See PR [#22](https://github.com/promaster-sdk/api-server/pull/22).

## [2.4.0](https://github.com/promaster-sdk/api-server/compare/v2.3.1...v2.4.0)

### Added

- Set `INIT_OTEL` to false by default. See PR [#21](https://github.com/promaster-sdk/api-server/pull/21).

### Fixed

- Bugfix, recieving database id that is not an uuid will cause parsing to throw: Cannot read property 'databaseId' of undefined. See PR [#20](https://github.com/promaster-sdk/api-server/pull/20).

## [v2.3.1](https://github.com/promaster-sdk/api-server/compare/v2.3.0...v2.3.1) - 2021-05-14

### Fixed

- Adjusted rest/v3 to allow table magicloud.group.definition. This is how it was done in the old Rest API

## [v2.3.0](https://github.com/promaster-sdk/api-server/compare/v2.2.4...v2.3.0) - 2021-05-10

### Fixed

- Simplify and document conditions for save parameter #18. See PR [#18](https://github.com/promaster-sdk/api-server/pull/18).

### Added

- Added flag to enable/disable pruning. See PR [#17](https://github.com/promaster-sdk/api-server/pull/17).

## [v2.2.5](https://github.com/promaster-sdk/api-server/compare/v2.2.4...v2.2.5) - 2021-03-12

### Fixed

- Move @types/ dependencies to devDependencies

## [v2.2.4](https://github.com/promaster-sdk/api-server/compare/v2.2.3...v2.2.4) - 2021-02-08

### Fixed

- Add verification of token back.

## [v2.2.3](https://github.com/promaster-sdk/api-server/compare/v2.2.2...v2.2.3) - 2021-02-08

### Added

- node fs promise instead of fs with promisify

## [v2.2.2](https://github.com/promaster-sdk/api-server/compare/v2.2.1...v2.2.2) - 2021-02-08

### Added

- FilesInParallel for publish middleware
- More spans for OpenTelemetry for publish middleware

## [v2.2.1](https://github.com/promaster-sdk/api-server/compare/v2.2.0...v2.2.1) - 2021-02-08

### Added

- More spans for publish api.

## [v2.2.0](https://github.com/promaster-sdk/api-server/compare/v2.1.1...v2.2.0) - 2021-02-08

### Added

- Optional OpenTelemetry.

## [v2.1.1](https://github.com/promaster-sdk/api-server/compare/v2.1.0...v2.1.1) - 2020-12-11

### Fixed

- Fix blank column names, see PR #12.

## [v2.1.0](https://github.com/promaster-sdk/api-server/compare/v1.4.0...v2.1.0) - 2020-11-12

### Added

- GraphQL Client API: Parameters for texts.

## [v1.4.0](https://github.com/promaster-sdk/api-server/compare/v1.3.1...v1.4.0) - 2019-10-01

### Added

- GraphQL Client API: Support models module.

## [v1.3.1](https://github.com/promaster-sdk/api-server/compare/v1.3.0...v1.3.1) - 2019-09-27

### Fixed

- GraphQL Client API: Invalid name transactionId changed to tx.

## [v1.3.0](https://github.com/promaster-sdk/api-server/compare/v1.2.0...v1.3.0) - 2019-09-27

### Added

- GraphQL Client API: Support for plug-in schemas per module, implement properties and sound module plug-ins. See PR [#5](https://github.com/promaster-sdk/api-server/pull/5).

## [v1.2.0](https://github.com/promaster-sdk/api-server/compare/v1.1.2...v1.2.0) - 2019-09-22

### Added

- A lot of improvements for Client GrahQL API. See PR [#4](https://github.com/promaster-sdk/api-server/pull/4).

## [v1.1.2](https://github.com/promaster-sdk/api-server/compare/v1.1.1...v1.1.2) - 2019-09-20

### Fixed

- Fix base url and generation of marker list not being correct for graphql.

## [v1.1.1](https://github.com/promaster-sdk/api-server/compare/v1.1.0...v1.1.1) - 2019-09-20

### Fixed

- Proper export of GraphQL API.

## [v1.1.0](https://github.com/promaster-sdk/api-server/compare/v1.0.1...v1.1.0) - 2019-09-20

### Added

- Initial version of Client GraphQL API. See PR [#2](https://github.com/promaster-sdk/api-server/pull/2).

## [v1.0.1](https://github.com/promaster-sdk/api-server/compare/v1.0.0...v1.0.1) - 2019-04-18

### Fixed

- Add missing types entry to package.json.

## v1.0.0 - 2019-04-18

### Added

- Initial release!
