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

import fs from "fs";
import path from "path";
import fetchLatest from "../utils/fetchLatest";
import isOutdated from "../utils/versionCompare";
import {
  logLatestFetchFailed,
  logSdkUpToDate,
  reportOutdatedSdk,
} from "../utils/reportSdk";
import {
  IOS_SPM_PACKAGE_IDENTITIES,
  IOS_SPM_REPO_URL_RE,
  LANG,
  MANIFEST,
  SDK_LABEL,
  SDK_PACKAGE,
} from "../constants";

type ResolvedSdk = { versionSpec: string; label: string };

type PackageJsonDeps = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

/** Loads and parses `package.json`; returns null when the file is missing or invalid. */
function readPackageJson(packageJsonPath: string): PackageJsonDeps | null {
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as PackageJsonDeps;
  } catch {
    return null;
  }
}

/** Checks whether `package.json` declares a React Native FME SDK dependency. */
function packageJsonDeclaresReactNativeSdk(packageJsonPath: string): boolean {
  const pkg = readPackageJson(packageJsonPath);
  if (!pkg) return false;

  for (const packageName of SDK_PACKAGE.REACT_NATIVE) {
    if (
      pkg.dependencies?.[packageName] ||
      pkg.devDependencies?.[packageName] ||
      pkg.peerDependencies?.[packageName]
    ) {
      return true;
    }
  }

  return false;
}

/** Checks whether `package.json` depends on `react-native` (standard RN app layout). */
function packageJsonIsReactNativeApp(packageJsonPath: string): boolean {
  const pkg = readPackageJson(packageJsonPath);
  if (!pkg) return false;

  return Boolean(
    pkg.dependencies?.["react-native"] ||
      pkg.devDependencies?.["react-native"],
  );
}

/** Checks whether `manifestPath` lives under the `ios/` folder for `rnProjectRoot`. */
function isManifestInReactNativeIosTree(
  manifestPath: string,
  rnProjectRoot: string,
): boolean {
  const iosDir = path.join(rnProjectRoot, "ios");
  if (
    manifestPath === iosDir ||
    manifestPath.startsWith(`${iosDir}${path.sep}`)
  ) {
    return true;
  }

  // Some apps keep `package.json` inside `ios/` next to `Podfile.lock`.
  if (path.basename(rnProjectRoot) === "ios") {
    return (
      manifestPath === rnProjectRoot ||
      manifestPath.startsWith(`${rnProjectRoot}${path.sep}`)
    );
  }

  return false;
}

/** Checks whether `base` is a CocoaPods manifest name (`Podfile` or `Podfile.lock`). */
function isCocoaPodsManifestBase(base: string): boolean {
  return base === MANIFEST.PODFILE || base === MANIFEST.PODFILE_LOCK;
}

/** Detects React Native CocoaPods content (RN pods or `use_react_native!` in `Podfile`). */
function isReactNativeCocoaPodsManifestContent(
  content: string,
  base: string,
): boolean {
  if (base !== MANIFEST.PODFILE && base !== MANIFEST.PODFILE_LOCK) {
    return false;
  }

  for (const packageName of SDK_PACKAGE.REACT_NATIVE) {
    if (content.includes(packageName)) {
      return true;
    }
  }

  if (
    base === MANIFEST.PODFILE &&
    /\buse_react_native!|\bprepare_react_native_project!/.test(content)
  ) {
    return true;
  }

  return false;
}

/** Skips native iOS manifests that belong to a React Native app (handled via `package.json`). */
function isReactNativeIosManifest(file: string, content?: string): boolean {
  const manifestPath = path.resolve(file);
  const manifestDir = path.dirname(manifestPath);
  const base = path.basename(file);

  // React Native handling applies only to CocoaPods files, not SPM / Xcode manifests.
  if (!isCocoaPodsManifestBase(base)) {
    return false;
  }

  if (
    content &&
    isReactNativeCocoaPodsManifestContent(content, base)
  ) {
    return true;
  }

  // e.g. `react-native/package.json` + `react-native/ios/Podfile.lock`
  if (path.basename(manifestDir) === "ios") {
    const appPackageJson = path.join(path.dirname(manifestDir), MANIFEST.PACKAGE_JSON);
    if (fs.existsSync(appPackageJson)) {
      if (
        packageJsonIsReactNativeApp(appPackageJson) ||
        packageJsonDeclaresReactNativeSdk(appPackageJson)
      ) {
        return true;
      }
    }
  }

  let dir = manifestDir;
  const repoRoot = path.resolve(process.cwd());

  for (;;) {
    const packageJsonPath = path.join(dir, MANIFEST.PACKAGE_JSON);
    if (
      fs.existsSync(packageJsonPath) &&
      packageJsonDeclaresReactNativeSdk(packageJsonPath) &&
      isManifestInReactNativeIosTree(manifestPath, dir)
    ) {
      return true;
    }

    if (dir === repoRoot) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return false;
}

/** Escapes regex metacharacters in `value` for use in a `RegExp` pattern. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Looks up the resolved version of `podName` in a sibling `Podfile.lock`. */
function versionFromPodfileLock(
  manifestDir: string,
  podName: string,
): string | null {
  const lockPath = path.join(manifestDir, "Podfile.lock");
  if (!fs.existsSync(lockPath)) return null;

  const lock = fs.readFileSync(lockPath, "utf8");
  const re = new RegExp(
    String.raw`- ${escapeRegExp(podName)} \(([^)\s]+)\)`,
  );
  const match = lock.match(re);
  return match?.[1]?.trim() ?? null;
}

/** Converts a `Package.swift` SPM requirement string into a semver-style spec. */
function normalizeSwiftPackageRequirement(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fromMatch = trimmed.match(/from\s*:\s*["']([^"']+)["']/i);
  if (fromMatch) {
    return `>=${fromMatch[1].trim()}`;
  }

  const exactMatch = trimmed.match(/exact\s*:\s*["']([^"']+)["']/i);
  if (exactMatch) {
    return exactMatch[1].trim();
  }

  const upToNextMajor = trimmed.match(
    /upToNextMajor(?:Version)?\s*\(\s*from\s*:\s*["']([^"']+)["']\s*\)/i,
  );
  if (upToNextMajor) {
    const base = upToNextMajor[1].trim();
    const major = Number(base.split(".")[0]);
    if (!Number.isNaN(major)) {
      return `>=${base} <${major + 1}.0.0`;
    }
    return `>=${base}`;
  }

  const upToNextMinor = trimmed.match(
    /upToNextMinor(?:Version)?\s*\(\s*from\s*:\s*["']([^"']+)["']\s*\)/i,
  );
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

/** Finds a Wingify iOS pod in `Podfile` and resolves its version from the file or lock. */
function findInPodfile(content: string, manifestDir: string): ResolvedSdk | null {
  for (const podName of SDK_PACKAGE.IOS) {
    const re = new RegExp(
      String.raw`pod\s+['"]${escapeRegExp(podName)}['"]` +
        String.raw`(?:\s*,\s*['"]([^'"]+)['"])?`,
      "i",
    );
    const match = content.match(re);
    if (!match) continue;

    const inlineVersion = match[1]?.trim();
    const versionSpec =
      inlineVersion || versionFromPodfileLock(manifestDir, podName) || ">=0.0.0";

    return { versionSpec, label: podName };
  }

  return null;
}

/** Finds a Wingify iOS pod entry and its resolved version in `Podfile.lock`. */
function findInPodfileLock(content: string): ResolvedSdk | null {
  for (const podName of SDK_PACKAGE.IOS) {
    const re = new RegExp(
      String.raw`- ${escapeRegExp(podName)} \(([^)\s]+)\)`,
    );
    const match = content.match(re);
    if (match) {
      return { versionSpec: match[1].trim(), label: podName };
    }
  }

  return null;
}

/** Finds the Wingify FME Swift package and its version constraint in `Package.swift`. */
function findInPackageSwift(content: string): ResolvedSdk | null {
  if (!IOS_SPM_REPO_URL_RE.test(content)) return null;

  const packageBlocks = content.matchAll(
    /\.package\s*\(\s*url:\s*["']([^"']+)["']\s*,([^)]*)\)/gs,
  );

  for (const block of packageBlocks) {
    const url = block[1];
    if (!IOS_SPM_REPO_URL_RE.test(url)) continue;

    const requirement = block[2];
    const normalized = normalizeSwiftPackageRequirement(requirement);
    if (normalized) {
      return { versionSpec: normalized, label: url };
    }
  }

  return null;
}

/** Checks whether an SPM pin points at the Wingify FME iOS package. */
function isWingifyIosSpmPin(pin: {
  location?: string;
  identity?: string;
}): boolean {
  const location = pin.location ?? "";
  if (IOS_SPM_REPO_URL_RE.test(location)) return true;

  const identity = (pin.identity ?? "").toLowerCase();
  return IOS_SPM_PACKAGE_IDENTITIES.some((id) => identity === id);
}

/** Reads the pinned Wingify iOS SDK version from `Package.resolved` JSON. */
function findInPackageResolved(content: string): ResolvedSdk | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  const pins = (parsed as { pins?: unknown })?.pins;
  if (!Array.isArray(pins)) return null;

  for (const pin of pins) {
    const typed = pin as {
      location?: string;
      identity?: string;
      state?: { version?: string };
    };
    if (!isWingifyIosSpmPin(typed)) continue;

    const version = typed.state?.version?.trim();
    if (version) {
      const label = typed.location?.trim() || typed.identity || "vwo-fme-ios-sdk";
      return { versionSpec: version, label };
    }
  }

  return null;
}

/** Returns the path to `Package.resolved` inside the `.xcodeproj` workspace, if it exists. */
function packageResolvedBesideXcodeproj(pbxprojFile: string): string | null {
  const xcodeprojDir = path.dirname(path.resolve(pbxprojFile));
  if (!xcodeprojDir.endsWith(".xcodeproj")) return null;

  const resolvedPath = path.join(
    xcodeprojDir,
    "project.xcworkspace",
    "xcshareddata",
    "swiftpm",
    MANIFEST.PACKAGE_RESOLVED,
  );
  return fs.existsSync(resolvedPath) ? resolvedPath : null;
}

/** Loads `Package.resolved` at `filePath` and returns the Wingify SDK pin version. */
function versionFromPackageResolvedAt(filePath: string): string | null {
  const content = fs.readFileSync(filePath, "utf8");
  return findInPackageResolved(content)?.versionSpec ?? null;
}

/** Finds the nearest `Package.resolved` and returns the locked Wingify SDK version. */
function versionFromSpmLockfile(
  file: string,
  manifestDir: string,
  manifestBase: string,
): string | null {
  if (manifestBase === MANIFEST.PBXPROJ) {
    const beside = packageResolvedBesideXcodeproj(file);
    if (beside) return versionFromPackageResolvedAt(beside);
  }

  const sibling = path.join(manifestDir, MANIFEST.PACKAGE_RESOLVED);
  if (fs.existsSync(sibling)) {
    return versionFromPackageResolvedAt(sibling);
  }

  return null;
}

/** Formats an SPM version constraint for logs when no lockfile pin is available. */
function formatConstraintOnlyDisplay(constraintSpec: string): string {
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

/** Builds the version string shown in reports from SPM constraint and lock pin. */
function formatSpmVersionDisplay(
  constraintSpec: string,
  lockedVersion: string | null,
): string {
  if (!lockedVersion) return formatConstraintOnlyDisplay(constraintSpec);

  const normalizedConstraint = constraintSpec.trim();
  if (
    lockedVersion === normalizedConstraint ||
    semverEquivalent(lockedVersion, normalizedConstraint)
  ) {
    return lockedVersion;
  }

  if (normalizedConstraint.includes("<") || normalizedConstraint.includes(">")) {
    return `${lockedVersion} (SPM constraint ${normalizedConstraint})`;
  }

  return lockedVersion;
}

/** Treats two version strings as equal when their leading numeric segments match. */
function semverEquivalent(a: string, b: string): boolean {
  const coercedA = a.match(/^[\d.]+/)?.[0];
  const coercedB = b.match(/^[\d.]+/)?.[0];
  return Boolean(coercedA && coercedB && coercedA === coercedB);
}

/** Checks whether `base` is an Xcode or SwiftPM manifest handled as SPM. */
function isSpmManifestBase(base: string): boolean {
  return (
    base === MANIFEST.PBXPROJ ||
    base === MANIFEST.PACKAGE_SWIFT ||
    base === MANIFEST.PACKAGE_RESOLVED
  );
}

/** Picks the version to compare with the registry for SPM (lock pin, else minimum/exact). */
function spmVersionForComparison(
  constraintSpec: string,
  lockedVersion: string | null,
): string {
  if (lockedVersion) return lockedVersion;

  const minFromRange = constraintSpec.match(/^>=([\d.]+)/)?.[1];
  if (minFromRange) return minFromRange;

  const trimmed = constraintSpec.trim();
  if (/^[\d.]+$/.test(trimmed)) return trimmed;

  return constraintSpec;
}

/** Finds Wingify SPM package references and version rules in `project.pbxproj`. */
function findInPbxproj(content: string): ResolvedSdk | null {
  const refBlocks = content.matchAll(
    /repositoryURL\s*=\s*"([^"]+)";\s*requirement\s*=\s*\{([^}]*)\}/gs,
  );

  for (const block of refBlocks) {
    const url = block[1];
    if (!IOS_SPM_REPO_URL_RE.test(url)) continue;

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

/** Scans an iOS manifest for the FME SDK, compares it to the latest release, and reports. */
async function detectIos(file: string): Promise<void> {
  const content = fs.readFileSync(file, "utf8");
  if (isReactNativeIosManifest(file, content)) return;

  const manifestDir = path.dirname(path.resolve(file));
  const base = path.basename(file);

  // Report Xcode SPM pins via `project.pbxproj` (constraint + optional lockfile).
  if (
    base === MANIFEST.PACKAGE_RESOLVED &&
    file.includes(`${path.sep}xcshareddata${path.sep}swiftpm${path.sep}`)
  ) {
    return;
  }

  let resolved: ResolvedSdk | null = null;

  if (base === "Podfile") {
    resolved = findInPodfile(content, manifestDir);
  } else if (base === "Podfile.lock") {
    resolved = findInPodfileLock(content);
  } else if (base === "Package.swift") {
    resolved = findInPackageSwift(content);
  } else if (base === "Package.resolved") {
    resolved = findInPackageResolved(content);
  } else if (base === "project.pbxproj") {
    resolved = findInPbxproj(content);
  }

  if (!resolved) return;

  const constraintSpec = resolved.versionSpec;
  const lockedVersion =
    base === MANIFEST.PBXPROJ || base === MANIFEST.PACKAGE_SWIFT
      ? versionFromSpmLockfile(file, manifestDir, base)
      : null;
  const displaySpec = formatSpmVersionDisplay(constraintSpec, lockedVersion);
  const comparePrimary = isSpmManifestBase(base)
    ? spmVersionForComparison(constraintSpec, lockedVersion)
    : (lockedVersion ?? constraintSpec);

  const latest = await fetchLatest(LANG.IOS);
  if (!latest) {
    logLatestFetchFailed("iOS", displaySpec);
    return;
  }

  const outdated = isOutdated(comparePrimary, latest);

  if (outdated) {
    await reportOutdatedSdk({
      sdkLabel: SDK_LABEL.IOS,
      file,
      currentVersion: displaySpec,
      latest,
    });
    return;
  }

  logSdkUpToDate("iOS", displaySpec);
}

export default detectIos;
