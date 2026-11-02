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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const fetchLatest_1 = __importDefault(require("../utils/fetchLatest"));
const versionCompare_1 = __importDefault(require("../utils/versionCompare"));
const reportSdk_1 = require("../utils/reportSdk");
const constants_1 = require("../constants");
const PUBSPEC_DEP_SECTIONS = [
    "dependencies",
    "dev_dependencies",
    "dependency_overrides",
];
/** Strip YAML comments from a line (best-effort). */
function stripYamlComment(line) {
    const hash = line.indexOf("#");
    if (hash === -1)
        return line;
    return line.slice(0, hash);
}
/**
 * Parse `dependencies`, `dev_dependencies`, and `dependency_overrides` from
 * `pubspec.yaml`.
 */
function parsePubspecDependencySections(content) {
    const deps = {};
    const lines = content.split(/\r?\n/);
    let section = null;
    let currentPkg = null;
    for (const rawLine of lines) {
        const line = stripYamlComment(rawLine);
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        const topLevel = /^([a-z_][\w]*):\s*(.*)$/.exec(line);
        if (topLevel && !/^\s/.test(line)) {
            section = topLevel[1];
            currentPkg = null;
            continue;
        }
        if (!section ||
            !PUBSPEC_DEP_SECTIONS.includes(section)) {
            continue;
        }
        const pkgInline = /^  ([a-z][a-z0-9_]*):\s*(.+)$/.exec(line);
        if (pkgInline) {
            currentPkg = pkgInline[1];
            const value = pkgInline[2].trim();
            if (value) {
                deps[currentPkg] = value.replace(/^["']|["']$/g, "").trim();
                currentPkg = null;
            }
            continue;
        }
        const pkgBlockStart = /^  ([a-z][a-z0-9_]*):\s*$/.exec(line);
        if (pkgBlockStart) {
            currentPkg = pkgBlockStart[1];
            continue;
        }
        if (currentPkg) {
            const sdkOnly = /^ {4,}sdk:\s*.+$/.exec(line);
            if (sdkOnly) {
                currentPkg = null;
                continue;
            }
            const versionLine = /^ {4,}version:\s*(.+)$/.exec(line);
            if (versionLine) {
                deps[currentPkg] = versionLine[1]
                    .trim()
                    .replace(/^["']|["']$/g, "")
                    .trim();
                currentPkg = null;
            }
        }
    }
    return deps;
}
/** Resolved package versions from the `packages:` section of `pubspec.lock`. */
function parsePubspecLockPackages(content) {
    const deps = {};
    const lines = content.split(/\r?\n/);
    let inPackages = false;
    let currentPkg = null;
    for (const rawLine of lines) {
        const line = stripYamlComment(rawLine);
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        const topLevel = /^([a-z_][\w]*):\s*$/.exec(line);
        if (topLevel && !/^\s/.test(line)) {
            inPackages = topLevel[1] === "packages";
            currentPkg = null;
            continue;
        }
        if (!inPackages)
            continue;
        const pkgStart = /^  ([a-z][a-z0-9_]*):\s*$/.exec(line);
        if (pkgStart) {
            currentPkg = pkgStart[1];
            continue;
        }
        if (currentPkg) {
            const versionLine = /^ {4,}version:\s*(.+)$/.exec(line);
            if (versionLine) {
                deps[currentPkg] = versionLine[1]
                    .trim()
                    .replace(/^["']|["']$/g, "")
                    .trim();
                currentPkg = null;
            }
        }
    }
    return deps;
}
function versionFromPubspecLock(manifestDir, packageName) {
    const lockPath = path_1.default.join(manifestDir, "pubspec.lock");
    if (!fs_1.default.existsSync(lockPath))
        return null;
    const lockContent = fs_1.default.readFileSync(lockPath, "utf8");
    return parsePubspecLockPackages(lockContent)[packageName] ?? null;
}
function findInPubspecYaml(content) {
    const deps = parsePubspecDependencySections(content);
    for (const packageName of constants_1.SDK_PACKAGE.FLUTTER) {
        const versionSpec = deps[packageName];
        if (!versionSpec)
            continue;
        if (versionSpec === "sdk" ||
            versionSpec.startsWith("path:") ||
            versionSpec.startsWith("git:") ||
            versionSpec === "{") {
            continue;
        }
        return versionSpec;
    }
    return null;
}
function findFlutterPackageInPubspec(content) {
    const deps = parsePubspecDependencySections(content);
    for (const packageName of constants_1.SDK_PACKAGE.FLUTTER) {
        if (deps[packageName])
            return packageName;
    }
    return null;
}
/**
 * Inspect `pubspec.yaml` for Wingify FME Flutter SDK dependencies and compare
 * them with pub.dev releases.
 */
async function detectFlutter(file) {
    if (!file.endsWith("pubspec.yaml"))
        return;
    const content = fs_1.default.readFileSync(file, "utf8");
    const packageName = findFlutterPackageInPubspec(content);
    if (!packageName)
        return;
    const constraintSpec = findInPubspecYaml(content);
    if (!constraintSpec)
        return;
    const manifestDir = path_1.default.dirname(path_1.default.resolve(file));
    const lockedVersion = versionFromPubspecLock(manifestDir, packageName);
    const constraintDisplay = constraintSpec.replace(/^v/i, "").trim();
    const displaySpec = lockedVersion && lockedVersion !== constraintDisplay
        ? `${lockedVersion} (constraint ${constraintDisplay})`
        : lockedVersion ?? constraintDisplay;
    const latest = await (0, fetchLatest_1.default)(constants_1.LANG.FLUTTER);
    if (!latest) {
        (0, reportSdk_1.logLatestFetchFailed)("Flutter", displaySpec);
        return;
    }
    const comparePrimary = lockedVersion ?? constraintDisplay;
    const outdated = (0, versionCompare_1.default)(comparePrimary, latest) ||
        (lockedVersion != null && (0, versionCompare_1.default)(constraintDisplay, latest));
    if (outdated) {
        await (0, reportSdk_1.reportOutdatedSdk)({
            sdkLabel: constants_1.SDK_LABEL.FLUTTER,
            file,
            currentVersion: displaySpec,
            latest,
        });
        return;
    }
    (0, reportSdk_1.logSdkUpToDate)("Flutter", displaySpec);
}
exports.default = detectFlutter;
