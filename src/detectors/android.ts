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
import { ANDROID_MAVEN_COORDS, LANG, SDK_LABEL, SDK_PACKAGE } from "../constants";

type ResolvedSdk = { versionSpec: string; coordinate: string };

/** Strip Gradle/Kotlin comments from a single line (best-effort). */
function stripLineComment(line: string): string {
  const withoutBlock = line.replace(/\/\*[\s\S]*?\*\//g, "");
  const hash = withoutBlock.indexOf("#");
  const slash = withoutBlock.indexOf("//");
  let cut = withoutBlock.length;
  if (hash !== -1) cut = Math.min(cut, hash);
  if (slash !== -1) cut = Math.min(cut, slash);
  return withoutBlock.slice(0, cut);
}

function readGradleProperties(dir: string): Record<string, string> {
  const props: Record<string, string> = {};
  const filePath = path.join(dir, "gradle.properties");
  if (!fs.existsSync(filePath)) return props;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = stripLineComment(line).trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    props[key] = value;
  }
  return props;
}

/** Collect `gradle.properties` from the manifest directory up to the repo root. */
function collectGradleProperties(manifestDir: string): Record<string, string> {
  const merged: Record<string, string> = {};
  let dir = manifestDir;
  const root = path.resolve(".");

  while (dir === root || dir.startsWith(root + path.sep)) {
    Object.assign(merged, readGradleProperties(dir));
    if (dir === root) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return merged;
}

/** Read `ext { ... }` / `set("key", "value")` assignments from Gradle build files. */
function collectGradleExtAssignments(manifestDir: string): Record<string, string> {
  const assignments: Record<string, string> = {};
  let dir = manifestDir;
  const root = path.resolve(".");

  while (dir === root || dir.startsWith(root + path.sep)) {
    for (const name of ["build.gradle", "build.gradle.kts"]) {
      const filePath = path.join(dir, name);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, "utf8");
      const extBlock = content.match(/ext\s*\{([^}]*)\}/s)?.[1] ?? "";
      const block = extBlock || content;

      for (const m of block.matchAll(
        /(?:^|[\s;])([A-Za-z_][\w.]*)\s*=\s*['"]([^'"]+)['"]/gm,
      )) {
        assignments[m[1]] = m[2];
      }
      for (const m of content.matchAll(
        /set\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/g,
      )) {
        assignments[m[1]] = m[2];
      }
    }
    if (dir === root) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return assignments;
}

function resolveGradleVersionToken(
  raw: string,
  manifestDir: string,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^[\d.]+[+\-]?$/.test(trimmed) || semverLikeRange(trimmed)) {
    return trimmed;
  }

  const propMatch =
    trimmed.match(/^\$\{([^}]+)\}$/) ?? trimmed.match(/^\$([A-Za-z_][\w.]*)$/);
  if (!propMatch) return trimmed;

  const key = propMatch[1].trim();
  const props = collectGradleProperties(manifestDir);
  const ext = collectGradleExtAssignments(manifestDir);
  const resolved = props[key] ?? ext[key];
  return resolved?.trim() ?? null;
}

function semverLikeRange(spec: string): boolean {
  return (
    /^[\^~>=<]/.test(spec) ||
    spec.includes(",") ||
    spec.startsWith("[") ||
    spec.startsWith("(")
  );
}

function parseVersionCatalog(content: string): {
  versions: Record<string, string>;
  libraries: Record<string, { module?: string; group?: string; name?: string; version?: string; versionRef?: string }>;
} {
  const versions: Record<string, string> = {};
  const libraries: Record<
    string,
    {
      module?: string;
      group?: string;
      name?: string;
      version?: string;
      versionRef?: string;
    }
  > = {};

  const lines = content.split(/\r?\n/);
  let section: "versions" | "libraries" | null = null;
  let currentLib: string | null = null;
  let libBuffer = "";

  const flushLibrary = () => {
    if (!currentLib) return;
    const entry = libBuffer.trim();
    libraries[currentLib] = parseLibraryEntry(entry, versions);
    currentLib = null;
    libBuffer = "";
  };

  for (const line of lines) {
    const trimmed = stripLineComment(line).trim();
    if (!trimmed) continue;

    if (trimmed === "[versions]") {
      flushLibrary();
      section = "versions";
      continue;
    }
    if (trimmed === "[libraries]") {
      flushLibrary();
      section = "libraries";
      continue;
    }
    if (trimmed.startsWith("[")) {
      flushLibrary();
      section = null;
      continue;
    }

    if (section === "versions") {
      const m = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*["']?([^"']+)["']?$/);
      if (m) versions[m[1]] = m[2].trim();
      continue;
    }

    if (section === "libraries") {
      const oneLine = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
      if (oneLine && !oneLine[2].startsWith("{")) {
        libraries[oneLine[1]] = parseLibraryEntry(oneLine[2], versions);
        continue;
      }

      const blockStart = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*\{/);
      if (blockStart) {
        flushLibrary();
        currentLib = blockStart[1];
        libBuffer = trimmed.slice(trimmed.indexOf("{") + 1);
        if (trimmed.endsWith("}")) {
          libBuffer = libBuffer.slice(0, -1);
          flushLibrary();
        }
        continue;
      }

      if (currentLib) {
        libBuffer += " " + trimmed;
        if (trimmed.endsWith("}")) {
          libBuffer = libBuffer.slice(0, -1);
          flushLibrary();
        }
      }
    }
  }
  flushLibrary();

  return { versions, libraries };
}

function parseLibraryEntry(
  entry: string,
  versions: Record<string, string>,
): {
  module?: string;
  group?: string;
  name?: string;
  version?: string;
  versionRef?: string;
} {
  const result: {
    module?: string;
    group?: string;
    name?: string;
    version?: string;
    versionRef?: string;
  } = {};

  const moduleMatch = entry.match(/module\s*=\s*["']([^"']+)["']/);
  if (moduleMatch) result.module = moduleMatch[1];

  const groupMatch = entry.match(/group\s*=\s*["']([^"']+)["']/);
  if (groupMatch) result.group = groupMatch[1];

  const nameMatch = entry.match(/name\s*=\s*["']([^"']+)["']/);
  if (nameMatch) result.name = nameMatch[1];

  const versionMatch = entry.match(/version\s*=\s*["']([^"']+)["']/);
  if (versionMatch) result.version = versionMatch[1];

  const versionRefMatch = entry.match(/version\.ref\s*=\s*["']([^"']+)["']/);
  if (versionRefMatch) {
    result.versionRef = versionRefMatch[1];
    result.version = versions[versionRefMatch[1]];
  }

  return result;
}

function coordinateMatches(
  group: string,
  artifact: string,
  coord: { group: string; artifact: string },
): boolean {
  return group === coord.group && artifact === coord.artifact;
}

function findInGradleBuild(
  content: string,
  manifestDir: string,
): ResolvedSdk | null {
  // A catalog alias such as `implementation(libs.vwo.fme)` does not contain
  // the version. That version is declared in `libs.versions.toml`, which is
  // scanned on its own. Resolving the alias here would report both files.
  for (const coord of ANDROID_MAVEN_COORDS) {
    const g = coord.group.replace(/\./g, "\\.");
    const a = coord.artifact;

    const inline = new RegExp(
      `['"](${g}):(${a}):([^'"]+)['"]`,
      "g",
    );
    for (const m of content.matchAll(inline)) {
      const resolved = resolveGradleVersionToken(m[3], manifestDir);
      if (resolved) {
        return {
          versionSpec: resolved,
          coordinate: `${coord.group}:${coord.artifact}`,
        };
      }
    }

    const mapGroovy = new RegExp(
      `group:\\s*['"]${g}['"][^\\n]*name:\\s*['"]${a}['"][^\\n]*version:\\s*['"]([^'"]+)['"]`,
      "gs",
    );
    const mapKt = new RegExp(
      `group\\s*=\\s*"${g}"[^\\n]*name\\s*=\\s*"${a}"[^\\n]*version\\s*=\\s*"([^"]+)"`,
      "gs",
    );

    for (const re of [mapGroovy, mapKt]) {
      const match = re.exec(content);
      if (match) {
        const resolved = resolveGradleVersionToken(match[1], manifestDir);
        if (resolved) {
          return {
            versionSpec: resolved,
            coordinate: `${coord.group}:${coord.artifact}`,
          };
        }
      }
    }
  }

  return null;
}

function findInVersionCatalog(
  content: string,
  _manifestDir: string,
): ResolvedSdk | null {
  const { versions, libraries } = parseVersionCatalog(content);

  for (const entry of Object.values(libraries)) {
    let group: string | undefined;
    let artifact: string | undefined;
    let versionSpec: string | undefined;

    if (entry.module) {
      const parts = entry.module.split(":");
      if (parts.length >= 2) {
        group = parts[0];
        artifact = parts[1];
        versionSpec = entry.version ?? parts[2];
        if (entry.versionRef && !versionSpec) {
          versionSpec = versions[entry.versionRef];
        }
      }
    } else {
      group = entry.group;
      artifact = entry.name;
      versionSpec = entry.version;
      if (entry.versionRef && !versionSpec) {
        versionSpec = versions[entry.versionRef];
      }
    }

    if (!group || !artifact || !versionSpec) continue;

    for (const coord of ANDROID_MAVEN_COORDS) {
      if (coordinateMatches(group, artifact, coord)) {
        return {
          versionSpec,
          coordinate: `${coord.group}:${coord.artifact}`,
        };
      }
    }
  }

  for (const artifact of SDK_PACKAGE.ANDROID) {
    const key = versions[artifact];
    if (key) {
      const coord = ANDROID_MAVEN_COORDS.find((c) => c.artifact === artifact);
      if (coord) {
        return {
          versionSpec: key,
          coordinate: `${coord.group}:${coord.artifact}`,
        };
      }
    }
  }

  return null;
}

/**
 * Inspect Android build manifests for the Wingify FME Android SDK.
 *
 * An inline version in `build.gradle` or `build.gradle.kts` is reported on
 * that file. A catalog alias such as `implementation(libs.vwo.fme)` is
 * reported only from `libs.versions.toml`, where the version is written.
 */
async function detectAndroid(file: string): Promise<void> {
  const content = fs.readFileSync(file, "utf8");
  const manifestDir = path.dirname(path.resolve(file));

  let resolved: ResolvedSdk | null = null;

  if (file.endsWith("libs.versions.toml")) {
    resolved = findInVersionCatalog(content, manifestDir);
  } else if (file.endsWith("build.gradle.kts") || file.endsWith("build.gradle")) {
    resolved = findInGradleBuild(content, manifestDir);
  }

  if (!resolved) return;

  const latest = await fetchLatest(LANG.ANDROID);
  if (!latest) {
    logLatestFetchFailed("Android", resolved.versionSpec);
    return;
  }

  if (isOutdated(resolved.versionSpec, latest)) {
    await reportOutdatedSdk({
      sdkLabel: SDK_LABEL.ANDROID,
      file,
      currentVersion: resolved.versionSpec,
      latest,
    });
    return;
  }

  logSdkUpToDate("Android", resolved.versionSpec);
}

export default detectAndroid;
