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
import { LANG, SDK_LABEL, SDK_PACKAGE } from "../constants";

const PUBSPEC_DEP_SECTIONS = [
  "dependencies",
  "dev_dependencies",
  "dependency_overrides",
] as const;

type PubspecDeps = Record<string, string>;

/** Strip YAML comments from a line (best-effort). */
function stripYamlComment(line: string): string {
  const hash = line.indexOf("#");
  if (hash === -1) return line;
  return line.slice(0, hash);
}

/**
 * Parse `dependencies`, `dev_dependencies`, and `dependency_overrides` from
 * `pubspec.yaml`.
 */
function parsePubspecDependencySections(content: string): PubspecDeps {
  const deps: PubspecDeps = {};
  const lines = content.split(/\r?\n/);

  let section: string | null = null;
  let currentPkg: string | null = null;

  for (const rawLine of lines) {
    const line = stripYamlComment(rawLine);
    const trimmed = line.trim();
    if (!trimmed) continue;

    const topLevel = /^([a-z_][\w]*):\s*(.*)$/.exec(line);
    if (topLevel && !/^\s/.test(line)) {
      section = topLevel[1];
      currentPkg = null;
      continue;
    }

    if (
      !section ||
      !PUBSPEC_DEP_SECTIONS.includes(
        section as (typeof PUBSPEC_DEP_SECTIONS)[number],
      )
    ) {
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
function parsePubspecLockPackages(content: string): PubspecDeps {
  const deps: PubspecDeps = {};
  const lines = content.split(/\r?\n/);

  let inPackages = false;
  let currentPkg: string | null = null;

  for (const rawLine of lines) {
    const line = stripYamlComment(rawLine);
    const trimmed = line.trim();
    if (!trimmed) continue;

    const topLevel = /^([a-z_][\w]*):\s*$/.exec(line);
    if (topLevel && !/^\s/.test(line)) {
      inPackages = topLevel[1] === "packages";
      currentPkg = null;
      continue;
    }

    if (!inPackages) continue;

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

function versionFromPubspecLock(
  manifestDir: string,
  packageName: string,
): string | null {
  const lockPath = path.join(manifestDir, "pubspec.lock");
  if (!fs.existsSync(lockPath)) return null;

  const lockContent = fs.readFileSync(lockPath, "utf8");
  return parsePubspecLockPackages(lockContent)[packageName] ?? null;
}

function findInPubspecYaml(content: string): string | null {
  const deps = parsePubspecDependencySections(content);

  for (const packageName of SDK_PACKAGE.FLUTTER) {
    const versionSpec = deps[packageName];
    if (!versionSpec) continue;

    if (
      versionSpec === "sdk" ||
      versionSpec.startsWith("path:") ||
      versionSpec.startsWith("git:") ||
      versionSpec === "{"
    ) {
      continue;
    }

    return versionSpec;
  }

  return null;
}

function findFlutterPackageInPubspec(content: string): string | null {
  const deps = parsePubspecDependencySections(content);
  for (const packageName of SDK_PACKAGE.FLUTTER) {
    if (deps[packageName]) return packageName;
  }
  return null;
}

/**
 * Inspect `pubspec.yaml` for Wingify FME Flutter SDK dependencies and compare
 * them with pub.dev releases.
 */
async function detectFlutter(file: string): Promise<void> {
  if (!file.endsWith("pubspec.yaml")) return;

  const content = fs.readFileSync(file, "utf8");
  const packageName = findFlutterPackageInPubspec(content);
  if (!packageName) return;

  const constraintSpec = findInPubspecYaml(content);
  if (!constraintSpec) return;

  const manifestDir = path.dirname(path.resolve(file));
  const lockedVersion = versionFromPubspecLock(manifestDir, packageName);

  const constraintDisplay = constraintSpec.replace(/^v/i, "").trim();
  const displaySpec =
    lockedVersion && lockedVersion !== constraintDisplay
      ? `${lockedVersion} (constraint ${constraintDisplay})`
      : lockedVersion ?? constraintDisplay;

  const latest = await fetchLatest(LANG.FLUTTER);
  if (!latest) {
    logLatestFetchFailed("Flutter", displaySpec);
    return;
  }

  const comparePrimary = lockedVersion ?? constraintDisplay;
  const outdated =
    isOutdated(comparePrimary, latest) ||
    (lockedVersion != null && isOutdated(constraintDisplay, latest));

  if (outdated) {
    await reportOutdatedSdk({
      sdkLabel: SDK_LABEL.FLUTTER,
      file,
      currentVersion: displaySpec,
      latest,
    });
    return;
  }

  logSdkUpToDate("Flutter", displaySpec);
}

export default detectFlutter;
