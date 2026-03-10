## GitHub Action - Wingify Feature Experimentation SDK Version Check

This GitHub Action scans a repository for Wingify Feature Management (FME) SDKs in multiple languages and reports whether they are up to date with the latest released versions. When an SDK is outdated, it logs a detailed message and posts the same message to Slack (if configured).

### Supported SDKs

- **Node.js**: `vwo-fme-node-sdk`
- **Java**: `vwo-fme-java-sdk`
- **PHP**: `vwo/vwo-fme-php-sdk`
- **Go**: `github.com/wingify/vwo-fme-go-sdk`
- **Ruby**: `vwo-fme-ruby-sdk`
- **.NET**: `VWO.FME.Sdk`
- **Python**: `vwo-fme-python-sdk`

### How it works

- **Scans** the repository for common manifest files:
  - `package.json`, `pom.xml`, `composer.json`, `go.mod`, `Gemfile`, `*.csproj`, `requirements.txt`
- **Detects** whether any of the supported Wingify SDKs are declared.
- **Fetches** the latest version of each SDK from the matching package registry (npm, Maven Central, Packagist, Go module proxy, RubyGems, NuGet, PyPI).
- **Compares** the current version or version range in the repo with the latest release.
- **Logs** whether each detected SDK is up to date or outdated.
- **Notifies** Slack when an SDK is outdated (optional; see environment variables below).

### Usage

Add a workflow in the consuming repository:

```yaml
name: Wingify SDK version check

on:
  workflow_dispatch:
  schedule:
    - cron: "0 3 * * *"

jobs:
  check-sdk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check Wingify SDK versions
        uses: wingify/wingify-sdk-version-check@main
        env:
          SLACK_NOTIFICATIONS_BOT_TOKEN: ${{ secrets.SLACK_NOTIFICATIONS_BOT_TOKEN }}
          CHANNEL_ID: ${{ secrets.CHANNEL_ID }}
```

### Environment variables

- **`SLACK_NOTIFICATIONS_BOT_TOKEN`** (or `SLACK_BOT_TOKEN`): Slack bot token used to send notifications via `chat.postMessage`.
- **`CHANNEL_ID`** (or `SLACK_CHANNEL`): Slack channel ID where notifications should be posted.
- **`DEBUG`**: Set to `true` to log every manifest file the scanner finds.

Slack notifications are sent only when an SDK is outdated. If the token or channel is missing, the action still completes and only writes logs.

### Output

When an SDK is **up to date**, the action prints a line like:

- `Node SDK up to date (^1.2.0)`
- `Java SDK up to date (1.3.0)`

When an SDK is **outdated**, it prints a Slack-formatted message that includes the file, the current constraint, the latest version, and a link to the workflow run. That same message is posted to Slack when credentials are configured.

### Version range handling

- **npm / Packagist / Go / .NET / Python**:
  - If you declare a **range** that already allows the latest version
    (e.g. `^1.18.0` with latest `1.20.0`), the SDK is treated as **up to date**.
  - If you pin a specific version (e.g. `1.18.0`) and a newer compatible
    version exists (e.g. `1.20.0`), it is treated as **outdated**.
- **PHP (`composer.json`)**:
  - Composer `~` constraints are interpreted with Composer semantics:
    - `~1.5` → `>=1.5.0 <2.0.0`
    - `~1.5.0` → `>=1.5.0 <1.6.0`
- **Ruby (`Gemfile`)**:
  - The Ruby `~>` ("pessimistic") operator is mapped to a semver range:
    - `~> 1.4` → `>=1.4.0 <2.0.0`
    - `~> 1.4.0` → `>=1.4.0 <1.5.0`
  - If the latest gem version falls inside that range, it is **up to date**.
- **Java (`pom.xml`) / .NET (`.csproj`)**:
  - Maven/NuGet bracket ranges such as `[1.0,2.0)` and `1.5.0+` are converted
    to semver ranges before comparison.
- **Python (`requirements.txt`)**:
  - Pip pins (`==1.2.3`) and comma-separated constraints (`>=1.0,<2.0`) are
    normalized before comparison. An unpinned requirement is treated as
    covering the latest version.

### Local development

- **Build the action** (TypeScript → bundled JS):

  ```bash
  npm install
  npm run build
  ```

  This compiles `src/**/*.ts` to `lib/` and produces a single bundled `dist/index.js`
  that is used as the GitHub Action entrypoint (see `action.yml`).

## Contributing

We welcome contributions to improve this SDK! Please read our [contributing guidelines](https://github.com/wingify/wingify-fme-sdk-version-check/blob/main/CONTRIBUTING.md) before submitting a PR.

## Code of Conduct

Our [Code of Conduct](https://github.com/wingify/wingify-fme-sdk-version-check/blob/main/CODE_OF_CONDUCT.md) outlines expectations for all contributors and maintainers.

## License

[Apache License, Version 2.0](https://github.com/wingify/wingify-fme-sdk-version-check/blob/main/LICENSE)

Copyright 2026 Wingify Software Pvt. Ltd.
