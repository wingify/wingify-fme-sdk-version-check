# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-11

### Added

- **Initial public version** of the Wingify SDK Version Check GitHub Action.
- **Supported SDKs**:
  - Node.js: `vwo-fme-node-sdk`
  - Java: `vwo-fme-java-sdk`
  - PHP: `vwo/vwo-fme-php-sdk`
  - Go: `github.com/wingify/vwo-fme-go-sdk`
  - Ruby: `vwo-fme-ruby-sdk`
  - .NET: `VWO.FME.Sdk`
- **Core behavior**:
  - Scans for `package.json`, `pom.xml`, `composer.json`, `go.mod`, `Gemfile`, and `*.csproj`.
  - Detects use of the above SDKs.
  - Fetches the latest version from the appropriate registry (npm, Maven Central, Packagist, Go proxy, RubyGems, NuGet).
  - Understands version ranges:
    - npm-style ranges (e.g. `^1.4.0`, `~1.4.0`)
    - Ruby `~>` pessimistic constraints (e.g. `~> 1.4`, `~> 1.4.0`)
  - Logs whether each SDK is effectively up to date with the latest release.
