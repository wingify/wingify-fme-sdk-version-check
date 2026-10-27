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
function readPackageJson(packageJsonPath) {
    try {
        return JSON.parse(fs_1.default.readFileSync(packageJsonPath, "utf8"));
    }
    catch {
        return null;
    }
}
function packageJsonDeclaresReactNativeSdk(packageJsonPath) {
    const pkg = readPackageJson(packageJsonPath);
    if (!pkg)
        return false;
    for (const packageName of constants_1.SDK_PACKAGE.REACT_NATIVE) {
        if (pkg.dependencies?.[packageName] ||
            pkg.devDependencies?.[packageName] ||
            pkg.peerDependencies?.[packageName]) {
            return true;
        }
    }
    return false;
}
/** Standard React Native app layout (`package.json` + `ios/` sibling folder). */
function packageJsonIsReactNativeApp(packageJsonPath) {
    const pkg = readPackageJson(packageJsonPath);
    if (!pkg)
        return false;
    return Boolean(pkg.dependencies?.["react-native"] ||
        pkg.devDependencies?.["react-native"]);
}
/** Whether `manifestPath` is part of the iOS native tree for a React Native app root. */
function isManifestInReactNativeIosTree(manifestPath, rnProjectRoot) {
    const iosDir = path_1.default.join(rnProjectRoot, "ios");
    if (manifestPath === iosDir ||
        manifestPath.startsWith(`${iosDir}${path_1.default.sep}`)) {
        return true;
    }
    // Some apps keep `package.json` inside `ios/` next to `Podfile.lock`.
    if (path_1.default.basename(rnProjectRoot) === "ios") {
        return (manifestPath === rnProjectRoot ||
            manifestPath.startsWith(`${rnProjectRoot}${path_1.default.sep}`));
    }
    return false;
}
function isCocoaPodsManifestBase(base) {
    return base === constants_1.MANIFEST.PODFILE || base === constants_1.MANIFEST.PODFILE_LOCK;
}
/**
 * CocoaPods manifests generated for React Native (lockfile lists the RN pod;
 * `Podfile` often only calls `use_react_native!`).
 */
function isReactNativeCocoaPodsManifestContent(content, base) {
    if (base !== constants_1.MANIFEST.PODFILE && base !== constants_1.MANIFEST.PODFILE_LOCK) {
        return false;
    }
    for (const packageName of constants_1.SDK_PACKAGE.REACT_NATIVE) {
        if (content.includes(packageName)) {
            return true;
        }
    }
    if (base === constants_1.MANIFEST.PODFILE &&
        /\buse_react_native!|\bprepare_react_native_project!/.test(content)) {
        return true;
    }
    return false;
}
/**
 * React Native apps ship native iOS deps under `{app}/ios/`; version checks for
 * those projects use `package.json` only (see `detectReactNative`).
 */
function isReactNativeIosManifest(file, content) {
    const manifestPath = path_1.default.resolve(file);
    const manifestDir = path_1.default.dirname(manifestPath);
    const base = path_1.default.basename(file);
    // React Native handling applies only to CocoaPods files, not SPM / Xcode manifests.
    if (!isCocoaPodsManifestBase(base)) {
        return false;
    }
    if (content &&
        isReactNativeCocoaPodsManifestContent(content, base)) {
        return true;
    }
    // e.g. `react-native/package.json` + `react-native/ios/Podfile.lock`
    if (path_1.default.basename(manifestDir) === "ios") {
        const appPackageJson = path_1.default.join(path_1.default.dirname(manifestDir), constants_1.MANIFEST.PACKAGE_JSON);
        if (fs_1.default.existsSync(appPackageJson)) {
            if (packageJsonIsReactNativeApp(appPackageJson) ||
                packageJsonDeclaresReactNativeSdk(appPackageJson)) {
                return true;
            }
        }
    }
    let dir = manifestDir;
    const repoRoot = path_1.default.resolve(process.cwd());
    for (;;) {
        const packageJsonPath = path_1.default.join(dir, constants_1.MANIFEST.PACKAGE_JSON);
        if (fs_1.default.existsSync(packageJsonPath) &&
            packageJsonDeclaresReactNativeSdk(packageJsonPath) &&
            isManifestInReactNativeIosTree(manifestPath, dir)) {
            return true;
        }
        if (dir === repoRoot)
            break;
        const parent = path_1.default.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return false;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** Read a resolved CocoaPods version from `Podfile.lock` in the same directory. */
function versionFromPodfileLock(manifestDir, podName) {
    const lockPath = path_1.default.join(manifestDir, "Podfile.lock");
    if (!fs_1.default.existsSync(lockPath))
        return null;
    const lock = fs_1.default.readFileSync(lockPath, "utf8");
    const re = new RegExp(String.raw `- ${escapeRegExp(podName)} \(([^)\s]+)\)`);
    const match = lock.match(re);
    return match?.[1]?.trim() ?? null;
}
function normalizeSwiftPackageRequirement(raw) {
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    const fromMatch = trimmed.match(/from\s*:\s*["']([^"']+)["']/i);
    if (fromMatch) {
        return `>=${fromMatch[1].trim()}`;
    }
    const exactMatch = trimmed.match(/exact\s*:\s*["']([^"']+)["']/i);
    if (exactMatch) {
        return exactMatch[1].trim();
    }
    const upToNextMajor = trimmed.match(/upToNextMajor(?:Version)?\s*\(\s*from\s*:\s*["']([^"']+)["']\s*\)/i);
    if (upToNextMajor) {
        const base = upToNextMajor[1].trim();
        const major = Number(base.split(".")[0]);
        if (!Number.isNaN(major)) {
            return `>=${base} <${major + 1}.0.0`;
        }
        return `>=${base}`;
    }
    const upToNextMinor = trimmed.match(/upToNextMinor(?:Version)?\s*\(\s*from\s*:\s*["']([^"']+)["']\s*\)/i);
    if (upToNextMinor) {
        const base = upToNextMinor[1].trim();
        const parts = base.split(".").map((p) => Number(p));
        if (parts.length >= 2 && !parts.some((n) => Number.isNaN(n))) {
            const [major, minor] = parts;
            return `>=${base} <${major}.${minor + 1}.0`;
        }
        return `>=${base}`;
    }
    if (/^[\d.]+[+\-]?$/.test(trimmed) || trimmed.includes("~>")) {
        return trimmed;
    }
    return null;
}
function findInPodfile(content, manifestDir) {
    for (const podName of constants_1.SDK_PACKAGE.IOS) {
        const re = new RegExp(String.raw `pod\s+['"]${escapeRegExp(podName)}['"]` +
            String.raw `(?:\s*,\s*['"]([^'"]+)['"])?`, "i");
        const match = content.match(re);
        if (!match)
            continue;
        const inlineVersion = match[1]?.trim();
        const versionSpec = inlineVersion || versionFromPodfileLock(manifestDir, podName) || ">=0.0.0";
        return { versionSpec, label: podName };
    }
    return null;
}
function findInPodfileLock(content) {
    for (const podName of constants_1.SDK_PACKAGE.IOS) {
        const re = new RegExp(String.raw `- ${escapeRegExp(podName)} \(([^)\s]+)\)`);
        const match = content.match(re);
        if (match) {
            return { versionSpec: match[1].trim(), label: podName };
        }
    }
    return null;
}
function findInPackageSwift(content) {
    if (!constants_1.IOS_SPM_REPO_URL_RE.test(content))
        return null;
    const packageBlocks = content.matchAll(/\.package\s*\(\s*url:\s*["']([^"']+)["']\s*,([^)]*)\)/gs);
    for (const block of packageBlocks) {
        const url = block[1];
        if (!constants_1.IOS_SPM_REPO_URL_RE.test(url))
            continue;
        const requirement = block[2];
        const normalized = normalizeSwiftPackageRequirement(requirement);
        if (normalized) {
            return { versionSpec: normalized, label: url };
        }
    }
    return null;
}
function isWingifyIosSpmPin(pin) {
    const location = pin.location ?? "";
    if (constants_1.IOS_SPM_REPO_URL_RE.test(location))
        return true;
    const identity = (pin.identity ?? "").toLowerCase();
    return constants_1.IOS_SPM_PACKAGE_IDENTITIES.some((id) => identity === id);
}
function findInPackageResolved(content) {
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch {
        return null;
    }
    const pins = parsed?.pins;
    if (!Array.isArray(pins))
        return null;
    for (const pin of pins) {
        const typed = pin;
        if (!isWingifyIosSpmPin(typed))
            continue;
        const version = typed.state?.version?.trim();
        if (version) {
            const label = typed.location?.trim() || typed.identity || "vwo-fme-ios-sdk";
            return { versionSpec: version, label };
        }
    }
    return null;
}
/** Xcode SPM lockfile beside an `.xcodeproj` (when Xcode has resolved packages). */
function packageResolvedBesideXcodeproj(pbxprojFile) {
    const xcodeprojDir = path_1.default.dirname(path_1.default.resolve(pbxprojFile));
    if (!xcodeprojDir.endsWith(".xcodeproj"))
        return null;
    const resolvedPath = path_1.default.join(xcodeprojDir, "project.xcworkspace", "xcshareddata", "swiftpm", constants_1.MANIFEST.PACKAGE_RESOLVED);
    return fs_1.default.existsSync(resolvedPath) ? resolvedPath : null;
}
function versionFromPackageResolvedAt(filePath) {
    const content = fs_1.default.readFileSync(filePath, "utf8");
    return findInPackageResolved(content)?.versionSpec ?? null;
}
function versionFromSpmLockfile(file, manifestDir, manifestBase) {
    if (manifestBase === constants_1.MANIFEST.PBXPROJ) {
        const beside = packageResolvedBesideXcodeproj(file);
        if (beside)
            return versionFromPackageResolvedAt(beside);
    }
    const sibling = path_1.default.join(manifestDir, constants_1.MANIFEST.PACKAGE_RESOLVED);
    if (fs_1.default.existsSync(sibling)) {
        return versionFromPackageResolvedAt(sibling);
    }
    return null;
}
function formatConstraintOnlyDisplay(constraintSpec) {
    const minRange = constraintSpec.match(/^>=([\d.]+)\s*(<.+)$/);
    if (minRange) {
        return `${minRange[1]} minimum (SPM ${minRange[2].trim()})`;
    }
    const minOnly = constraintSpec.match(/^>=([\d.]+)$/);
    if (minOnly) {
        return `${minOnly[1]} minimum`;
    }
    return constraintSpec;
}
function formatSpmVersionDisplay(constraintSpec, lockedVersion) {
    if (!lockedVersion)
        return formatConstraintOnlyDisplay(constraintSpec);
    const normalizedConstraint = constraintSpec.trim();
    if (lockedVersion === normalizedConstraint ||
        semverEquivalent(lockedVersion, normalizedConstraint)) {
        return lockedVersion;
    }
    if (normalizedConstraint.includes("<") || normalizedConstraint.includes(">")) {
        return `${lockedVersion} (SPM constraint ${normalizedConstraint})`;
    }
    return lockedVersion;
}
function semverEquivalent(a, b) {
    const coercedA = a.match(/^[\d.]+/)?.[0];
    const coercedB = b.match(/^[\d.]+/)?.[0];
    return Boolean(coercedA && coercedB && coercedA === coercedB);
}
function isSpmManifestBase(base) {
    return (base === constants_1.MANIFEST.PBXPROJ ||
        base === constants_1.MANIFEST.PACKAGE_SWIFT ||
        base === constants_1.MANIFEST.PACKAGE_RESOLVED);
}
/**
 * Version to compare against registry latest for SPM manifests.
 * Uses the lock pin when present; otherwise the declared minimum / exact version,
 * not whether a semver range would still admit the latest release.
 */
function spmVersionForComparison(constraintSpec, lockedVersion) {
    if (lockedVersion)
        return lockedVersion;
    const minFromRange = constraintSpec.match(/^>=([\d.]+)/)?.[1];
    if (minFromRange)
        return minFromRange;
    const trimmed = constraintSpec.trim();
    if (/^[\d.]+$/.test(trimmed))
        return trimmed;
    return constraintSpec;
}
function findInPbxproj(content) {
    const refBlocks = content.matchAll(/repositoryURL\s*=\s*"([^"]+)";\s*requirement\s*=\s*\{([^}]*)\}/gs);
    for (const block of refBlocks) {
        const url = block[1];
        if (!constants_1.IOS_SPM_REPO_URL_RE.test(url))
            continue;
        const requirement = block[2];
        const kind = requirement.match(/kind\s*=\s*(\w+)/)?.[1];
        const minimumVersion = requirement
            .match(/minimumVersion\s*=\s*([\d.]+)/)?.[1]
            ?.trim();
        const exactVersion = requirement
            .match(/version\s*=\s*([\d.]+)/)?.[1]
            ?.trim();
        if (kind === "exactVersion" && exactVersion) {
            return { versionSpec: exactVersion, label: url };
        }
        if (minimumVersion) {
            if (kind === "upToNextMajorVersion") {
                const parts = minimumVersion.split(".").map((p) => Number(p));
                const major = parts[0];
                if (!Number.isNaN(major)) {
                    return {
                        versionSpec: `>=${minimumVersion} <${major + 1}.0.0`,
                        label: url,
                    };
                }
            }
            if (kind === "upToNextMinorVersion") {
                const parts = minimumVersion.split(".").map((p) => Number(p));
                if (parts.length >= 2 && !parts.some((n) => Number.isNaN(n))) {
                    const [major, minor] = parts;
                    return {
                        versionSpec: `>=${minimumVersion} <${major}.${minor + 1}.0`,
                        label: url,
                    };
                }
            }
            return { versionSpec: `>=${minimumVersion}`, label: url };
        }
    }
    return null;
}
/**
 * Inspect iOS dependency manifests (`Podfile`, `Podfile.lock`, `Package.swift`,
 * `Package.resolved`, `project.pbxproj`) for Wingify FME iOS SDK dependencies
 * and compare them with CocoaPods trunk metadata.
 */
async function detectIos(file) {
    const content = fs_1.default.readFileSync(file, "utf8");
    if (isReactNativeIosManifest(file, content))
        return;
    const manifestDir = path_1.default.dirname(path_1.default.resolve(file));
    const base = path_1.default.basename(file);
    // Report Xcode SPM pins via `project.pbxproj` (constraint + optional lockfile).
    if (base === constants_1.MANIFEST.PACKAGE_RESOLVED &&
        file.includes(`${path_1.default.sep}xcshareddata${path_1.default.sep}swiftpm${path_1.default.sep}`)) {
        return;
    }
    let resolved = null;
    if (base === "Podfile") {
        resolved = findInPodfile(content, manifestDir);
    }
    else if (base === "Podfile.lock") {
        resolved = findInPodfileLock(content);
    }
    else if (base === "Package.swift") {
        resolved = findInPackageSwift(content);
    }
    else if (base === "Package.resolved") {
        resolved = findInPackageResolved(content);
    }
    else if (base === "project.pbxproj") {
        resolved = findInPbxproj(content);
    }
    if (!resolved)
        return;
    const constraintSpec = resolved.versionSpec;
    const lockedVersion = base === constants_1.MANIFEST.PBXPROJ || base === constants_1.MANIFEST.PACKAGE_SWIFT
        ? versionFromSpmLockfile(file, manifestDir, base)
        : null;
    const displaySpec = formatSpmVersionDisplay(constraintSpec, lockedVersion);
    const comparePrimary = isSpmManifestBase(base)
        ? spmVersionForComparison(constraintSpec, lockedVersion)
        : (lockedVersion ?? constraintSpec);
    const latest = await (0, fetchLatest_1.default)(constants_1.LANG.IOS);
    if (!latest) {
        (0, reportSdk_1.logLatestFetchFailed)("iOS", displaySpec);
        return;
    }
    const outdated = (0, versionCompare_1.default)(comparePrimary, latest);
    if (outdated) {
        await (0, reportSdk_1.reportOutdatedSdk)({
            sdkLabel: constants_1.SDK_LABEL.IOS,
            file,
            currentVersion: displaySpec,
            latest,
        });
        return;
    }
    (0, reportSdk_1.logSdkUpToDate)("iOS", displaySpec);
}
exports.default = detectIos;
