"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PYTHON_REQUIREMENT_NAME_RE = exports.FALLBACK_REPO_DISPLAY_NAME = exports.DEFAULT_GITHUB_SERVER_URL = exports.ENV = exports.GO_PROXY_TIMEOUT_MS = exports.REGISTRY_URL = exports.SCAN_IGNORE = exports.MANIFEST_GLOBS = exports.MANIFEST = exports.SDK_LABEL = exports.ANDROID_MAVEN_COORDS = exports.IOS_SPM_PACKAGE_IDENTITIES = exports.IOS_SPM_REPO_URL_RE = exports.IOS_SPM_REPO_URLS = exports.SDK_PACKAGE = exports.LANG = void 0;
/**
 * Shared identifiers, package names, registry URLs, and environment
 * variable names used across detectors and utilities.
 */
/** Language keys passed to `fetchLatest`. */
exports.LANG = {
    NODE: "node",
    RUBY: "ruby",
    PHP: "php",
    JAVA: "java",
    GO: "go",
    DOTNET: "dotnet",
    PYTHON: "python",
    ANDROID: "android",
    IOS: "ios",
    REACT_NATIVE: "react-native",
    REACT: "react",
    FLUTTER: "flutter",
};
/** Package / artifact names as they appear in each ecosystem. */
exports.SDK_PACKAGE = {
    NODE: ["vwo-fme-node-sdk", "wingify-fme-node-sdk"],
    JAVA: ["vwo-fme-java-sdk", "wingify-fme-java-sdk"],
    PHP: ["vwo/vwo-fme-php-sdk", "wingify/wingify-fme-php-sdk"],
    /** Short module name matched inside `go.mod` require lines. */
    GO: ["vwo-fme-go-sdk", "wingify-fme-go-sdk"],
    RUBY: ["vwo-fme-ruby-sdk", "wingify-fme-ruby-sdk"],
    DOTNET: ["VWO.FME.Sdk", "Wingify.FME.Sdk"],
    PYTHON: ["vwo-fme-python-sdk", "wingify-fme-python-sdk"],
    ANDROID: ["vwo-fme-android-sdk", "wingify-fme-android-sdk"],
    /** CocoaPods pod names for the iOS SDK. */
    IOS: ["VWO-FME", "Wingify-FME"],
    /** npm package names for the React Native SDK. */
    REACT_NATIVE: ["vwo-fme-react-native-sdk", "wingify-fme-react-native-sdk"],
    REACT: ["vwo-fme-react-sdk", "wingify-fme-react-sdk"],
    /** pub.dev package names for the Flutter SDK. */
    FLUTTER: ["vwo_fme_flutter_sdk", "wingify_fme_flutter_sdk"],
};
/** Swift Package Manager repository URLs for the iOS SDK. */
exports.IOS_SPM_REPO_URLS = [
    "https://github.com/wingify/vwo-fme-ios-sdk",
    "https://github.com/wingify/wingify-fme-ios-sdk",
];
/** Matches Wingify FME iOS SPM repository URLs in manifests. */
exports.IOS_SPM_REPO_URL_RE = /github\.com[:/]wingify\/(?:vwo|wingify)-fme-ios-sdk/i;
/** `Package.resolved` identity values for the iOS SDK (remoteSourceControl pins). */
exports.IOS_SPM_PACKAGE_IDENTITIES = [
    "vwo-fme-ios-sdk",
    "wingify-fme-ios-sdk",
];
/** Maven coordinates for the Android SDK artifacts on Maven Central. */
exports.ANDROID_MAVEN_COORDS = [
    { group: "com.vwo.sdk", artifact: exports.SDK_PACKAGE.ANDROID[0] },
    { group: "com.wingify.sdk", artifact: exports.SDK_PACKAGE.ANDROID[1] },
];
/** Human-readable labels used in Slack outdated-SDK messages. */
exports.SDK_LABEL = {
    NODE: "Node",
    JAVA: "Java",
    PHP: "PHP",
    GO: "Go",
    RUBY: "Ruby",
    DOTNET: "DotNet",
    PYTHON: "Python",
    ANDROID: "Android",
    IOS: "iOS",
    REACT_NATIVE: "React Native",
    REACT: "React",
    FLUTTER: "Flutter",
};
/** Manifest file names / suffixes discovered by the scanner. */
exports.MANIFEST = {
    PACKAGE_JSON: "package.json",
    POM_XML: "pom.xml",
    COMPOSER_JSON: "composer.json",
    GO_MOD: "go.mod",
    GEMFILE: "Gemfile",
    CSPROJ: ".csproj",
    REQUIREMENTS_TXT: "requirements.txt",
    BUILD_GRADLE: "build.gradle",
    BUILD_GRADLE_KTS: "build.gradle.kts",
    LIBS_VERSIONS_TOML: "libs.versions.toml",
    PODFILE: "Podfile",
    PODFILE_LOCK: "Podfile.lock",
    PACKAGE_SWIFT: "Package.swift",
    PACKAGE_RESOLVED: "Package.resolved",
    PBXPROJ: "project.pbxproj",
    PUBSPEC_YAML: "pubspec.yaml",
};
/** Glob patterns used to locate manifests across the repository. */
exports.MANIFEST_GLOBS = [
    `**/${exports.MANIFEST.PACKAGE_JSON}`,
    `**/${exports.MANIFEST.POM_XML}`,
    `**/${exports.MANIFEST.COMPOSER_JSON}`,
    `**/${exports.MANIFEST.GO_MOD}`,
    `**/${exports.MANIFEST.GEMFILE}`,
    `**/*${exports.MANIFEST.CSPROJ}`,
    `**/${exports.MANIFEST.REQUIREMENTS_TXT}`,
    `**/${exports.MANIFEST.BUILD_GRADLE_KTS}`,
    `**/${exports.MANIFEST.BUILD_GRADLE}`,
    `**/${exports.MANIFEST.LIBS_VERSIONS_TOML}`,
    `**/${exports.MANIFEST.PODFILE}`,
    `**/${exports.MANIFEST.PODFILE_LOCK}`,
    `**/${exports.MANIFEST.PACKAGE_SWIFT}`,
    `**/${exports.MANIFEST.PACKAGE_RESOLVED}`,
    `**/*/*.xcodeproj/${exports.MANIFEST.PBXPROJ}`,
    `**/*.xcodeproj/${exports.MANIFEST.PBXPROJ}`,
    `**/${exports.MANIFEST.PUBSPEC_YAML}`,
];
/** Directories skipped while scanning for manifests. */
exports.SCAN_IGNORE = [
    "**/node_modules/**",
    "**/.venv/**",
    "**/venv/**",
    "**/__pypackages__/**",
];
/** Registry endpoints that expose the latest published SDK version. */
exports.REGISTRY_URL = {
    NODE: [
        `https://registry.npmjs.org/${exports.SDK_PACKAGE.NODE[0]}/latest`,
        `https://registry.npmjs.org/${exports.SDK_PACKAGE.NODE[1]}/latest`
    ],
    RUBY: [
        `https://rubygems.org/api/v1/gems/${exports.SDK_PACKAGE.RUBY[0]}.json`,
        `https://rubygems.org/api/v1/gems/${exports.SDK_PACKAGE.RUBY[1]}.json`
    ],
    PHP: [
        `https://repo.packagist.org/p2/${exports.SDK_PACKAGE.PHP[0]}.json`,
        `https://repo.packagist.org/p2/${exports.SDK_PACKAGE.PHP[1]}.json`
    ],
    JAVA: [
        `https://repo1.maven.org/maven2/com/vwo/sdk/${exports.SDK_PACKAGE.JAVA[0]}/maven-metadata.xml`,
        `https://repo1.maven.org/maven2/com/wingify/sdk/${exports.SDK_PACKAGE.JAVA[1]}/maven-metadata.xml`
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
        `https://pypi.org/pypi/${exports.SDK_PACKAGE.PYTHON[0]}/json`,
        `https://pypi.org/pypi/${exports.SDK_PACKAGE.PYTHON[1]}/json`
    ],
    ANDROID: [
        `https://repo1.maven.org/maven2/com/vwo/sdk/${exports.SDK_PACKAGE.ANDROID[0]}/maven-metadata.xml`,
        `https://repo1.maven.org/maven2/com/wingify/sdk/${exports.SDK_PACKAGE.ANDROID[1]}/maven-metadata.xml`,
    ],
    IOS: [
        `https://trunk.cocoapods.org/api/v1/pods/${exports.SDK_PACKAGE.IOS[0]}`,
        `https://trunk.cocoapods.org/api/v1/pods/${exports.SDK_PACKAGE.IOS[1]}`,
        "https://api.github.com/repos/wingify/vwo-fme-ios-sdk/releases/latest",
        "https://api.github.com/repos/wingify/wingify-fme-ios-sdk/releases/latest",
    ],
    REACT_NATIVE: [
        `https://registry.npmjs.org/${exports.SDK_PACKAGE.REACT_NATIVE[0]}/latest`,
        `https://registry.npmjs.org/${exports.SDK_PACKAGE.REACT_NATIVE[1]}/latest`,
    ],
    REACT: [
        `https://registry.npmjs.org/${exports.SDK_PACKAGE.REACT[0]}/latest`,
        `https://registry.npmjs.org/${exports.SDK_PACKAGE.REACT[1]}/latest`,
    ],
    FLUTTER: [
        `https://pub.dev/api/packages/${exports.SDK_PACKAGE.FLUTTER[0]}`,
        `https://pub.dev/api/packages/${exports.SDK_PACKAGE.FLUTTER[1]}`,
    ],
};
/** Timeout applied only to the Go module proxy request. */
exports.GO_PROXY_TIMEOUT_MS = 10000;
exports.ENV = {
    DEBUG: "DEBUG",
    GITHUB_REPOSITORY: "GITHUB_REPOSITORY",
    GITHUB_SERVER_URL: "GITHUB_SERVER_URL",
    SLACK_NOTIFICATIONS_BOT_TOKEN: "SLACK_NOTIFICATIONS_BOT_TOKEN",
    SLACK_BOT_TOKEN: "SLACK_BOT_TOKEN",
    CHANNEL_ID: "CHANNEL_ID",
    SLACK_CHANNEL: "SLACK_CHANNEL",
};
exports.DEFAULT_GITHUB_SERVER_URL = "https://github.com";
/** Fallback name used in Slack copy when `GITHUB_REPOSITORY` is unset. */
exports.FALLBACK_REPO_DISPLAY_NAME = "this repository";
/**
 * Matches a `vwo-fme-python-sdk` / `vwo_fme_python_sdk` or `wingify-fme-python-sdk` / `wingify_fme_python_sdk` requirement line,
 * including optional extras such as `vwo-fme-python-sdk[dev]`.
 */
exports.PYTHON_REQUIREMENT_NAME_RE = /^(?:vwo|wingify)[-_]fme[-_]python[-_]sdk(?!-)(?:\[[^\]]*\])?/i;
