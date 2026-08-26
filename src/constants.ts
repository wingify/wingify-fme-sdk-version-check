/**
 * Copyright 2026 Wingify Software Pvt. Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Shared identifiers, package names, registry URLs, and environment
 * variable names used across detectors and utilities.
 */

/** Language keys passed to `fetchLatest`. */
export const LANG = {
  NODE: "node",
  RUBY: "ruby",
  PHP: "php",
  JAVA: "java",
  GO: "go",
  DOTNET: "dotnet",
  PYTHON: "python",
} as const;

export type Lang = (typeof LANG)[keyof typeof LANG];

/** Package / artifact names as they appear in each ecosystem. */
export const SDK_PACKAGE = {
  NODE: ["vwo-fme-node-sdk", "wingify-fme-node-sdk"],
  JAVA: ["vwo-fme-java-sdk", "wingify-fme-java-sdk"],
  PHP: ["vwo/vwo-fme-php-sdk", "wingify/wingify-fme-php-sdk"],
  /** Short module name matched inside `go.mod` require lines. */
  GO: ["vwo-fme-go-sdk", "wingify-fme-go-sdk"],
  RUBY: ["vwo-fme-ruby-sdk", "wingify-fme-ruby-sdk"],
  DOTNET: ["VWO.FME.Sdk", "Wingify.FME.Sdk"],
  PYTHON: ["vwo-fme-python-sdk", "wingify-fme-python-sdk"],
} as const;

/** Human-readable labels used in Slack outdated-SDK messages. */
export const SDK_LABEL = {
  NODE: "Node",
  JAVA: "Java",
  PHP: "PHP",
  GO: "Go",
  RUBY: "Ruby",
  DOTNET: "DotNet",
  PYTHON: "Python",
} as const;

/** Manifest file names / suffixes discovered by the scanner. */
export const MANIFEST = {
  PACKAGE_JSON: "package.json",
  POM_XML: "pom.xml",
  COMPOSER_JSON: "composer.json",
  GO_MOD: "go.mod",
  GEMFILE: "Gemfile",
  CSPROJ: ".csproj",
  REQUIREMENTS_TXT: "requirements.txt",
} as const;

/** Glob patterns used to locate manifests across the repository. */
export const MANIFEST_GLOBS: string[] = [
  `**/${MANIFEST.PACKAGE_JSON}`,
  `**/${MANIFEST.POM_XML}`,
  `**/${MANIFEST.COMPOSER_JSON}`,
  `**/${MANIFEST.GO_MOD}`,
  `**/${MANIFEST.GEMFILE}`,
  `**/*${MANIFEST.CSPROJ}`,
  `**/${MANIFEST.REQUIREMENTS_TXT}`,
];

/** Directories skipped while scanning for manifests. */
export const SCAN_IGNORE: string[] = [
  "**/node_modules/**",
  "**/.venv/**",
  "**/venv/**",
  "**/__pypackages__/**",
];

/** Registry endpoints that expose the latest published SDK version. */
export const REGISTRY_URL = {
  NODE: [
    `https://registry.npmjs.org/${SDK_PACKAGE.NODE[0]}/latest`,
    `https://registry.npmjs.org/${SDK_PACKAGE.NODE[1]}/latest`
  ],
  RUBY: [
    `https://rubygems.org/api/v1/gems/${SDK_PACKAGE.RUBY[0]}.json`,
    `https://rubygems.org/api/v1/gems/${SDK_PACKAGE.RUBY[1]}.json`
  ],
  PHP: [
    `https://repo.packagist.org/p2/${SDK_PACKAGE.PHP[0]}.json`,
    `https://repo.packagist.org/p2/${SDK_PACKAGE.PHP[1]}.json`
  ],
  JAVA: [
    `https://repo1.maven.org/maven2/com/vwo/sdk/${SDK_PACKAGE.JAVA[0]}/maven-metadata.xml`,
    `https://repo1.maven.org/maven2/com/wingify/sdk/${SDK_PACKAGE.JAVA[1]}/maven-metadata.xml`
  ],
  GO: [
    "https://proxy.golang.org/github.com/wingify/vwo-fme-go-sdk/@latest",
    "https://proxy.golang.org/github.com/wingify/wingify-fme-go-sdk/@latest"
  ],
  DOTNET: [
    "https://api.nuget.org/v3-flatcontainer/vwo.fme.sdk/index.json",
    "https://api.nuget.org/v3-flatcontainer/wingify.fme.sdk/index.json"
  ],
  PYTHON: [
    `https://pypi.org/pypi/${SDK_PACKAGE.PYTHON[0]}/json`,
    `https://pypi.org/pypi/${SDK_PACKAGE.PYTHON[1]}/json`
  ],
} as const;

/** Timeout applied only to the Go module proxy request. */
export const GO_PROXY_TIMEOUT_MS = 10_000;

export const ENV = {
  DEBUG: "DEBUG",
  GITHUB_REPOSITORY: "GITHUB_REPOSITORY",
  GITHUB_SERVER_URL: "GITHUB_SERVER_URL",
  SLACK_NOTIFICATIONS_BOT_TOKEN: "SLACK_NOTIFICATIONS_BOT_TOKEN",
  SLACK_BOT_TOKEN: "SLACK_BOT_TOKEN",
  CHANNEL_ID: "CHANNEL_ID",
  SLACK_CHANNEL: "SLACK_CHANNEL",
} as const;

export const DEFAULT_GITHUB_SERVER_URL = "https://github.com";

/** Fallback name used in Slack copy when `GITHUB_REPOSITORY` is unset. */
export const FALLBACK_REPO_DISPLAY_NAME = "this repository";

/**
 * Matches a `vwo-fme-python-sdk` / `vwo_fme_python_sdk` or `wingify-fme-python-sdk` / `wingify_fme_python_sdk` requirement line,
 * including optional extras such as `vwo-fme-python-sdk[dev]`.
 */
export const PYTHON_REQUIREMENT_NAME_RE =
  /^(?:vwo|wingify)[-_]fme[-_]python[-_]sdk(?!-)(?:\[[^\]]*\])?/i;
