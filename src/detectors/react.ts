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

/**
 * Dependency maps written by npm, Yarn, pnpm, and Bun.
 * npm `install` and `yarn add` both record the SDK in `package.json`.
 */
const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

type PackageJson = {
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
  /** npm version overrides. */
  overrides?: unknown;
  /** Yarn selective dependency resolutions. */
  resolutions?: unknown;
  pnpm?: { overrides?: unknown };
};

type PnpmCatalogs = {
  defaultCatalog: Record<string, string>;
  named: Record<string, Record<string, string>>;
};

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/** Strip an unquoted YAML `#` comment. */
function stripYamlComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if (ch === "#" && !inSingle && !inDouble) return line.slice(0, i);
  }
  return line;
}

/**
 * Read the default `catalog` and named `catalogs` from a pnpm workspace file.
 * Versions declared as `catalog:` / `catalog:<name>` in package.json live here,
 * the same way a Gradle version catalog lives outside `build.gradle`.
 */
function parsePnpmCatalogs(content: string): PnpmCatalogs {
  const defaultCatalog: Record<string, string> = {};
  const named: Record<string, Record<string, string>> = {};

  let section: "catalog" | "catalogs" | null = null;
  let namedKey: string | null = null;
  let namedIndent = -1;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = stripYamlComment(rawLine);
    if (!line.trim()) continue;

    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    const kv = /^([^:#][^:]*):\s*(.*)$/.exec(trimmed);
    if (!kv) continue;

    const key = unquote(kv[1].trim());
    const value = unquote(kv[2].trim());

    if (indent === 0) {
      namedKey = null;
      namedIndent = -1;
      if (key === "catalog") section = "catalog";
      else if (key === "catalogs") section = "catalogs";
      else section = null;
      continue;
    }

    if (section === "catalog" && value) {
      defaultCatalog[key] = value;
      continue;
    }

    if (section !== "catalogs") continue;

    if (!value) {
      namedKey = key;
      namedIndent = indent;
      named[key] = named[key] ?? {};
      continue;
    }

    if (namedKey && indent > namedIndent) {
      named[namedKey][key] = value;
    }
  }

  return { defaultCatalog, named };
}

/** Resolve `catalog:` / `catalog:<name>` from the nearest `pnpm-workspace.yaml`. */
function resolveCatalogVersion(
  manifestDir: string,
  packageName: string,
  catalogName: string,
): string | null {
  let dir = manifestDir;
  const root = path.resolve(".");

  while (dir === root || dir.startsWith(root + path.sep)) {
    const filePath = path.join(dir, "pnpm-workspace.yaml");
    if (fs.existsSync(filePath)) {
      const parsed = parsePnpmCatalogs(fs.readFileSync(filePath, "utf8"));
      const table = catalogName
        ? parsed.named[catalogName]
        : parsed.defaultCatalog;
      const spec = table?.[packageName]?.trim();
      if (spec) return spec;
    }

    if (dir === root) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

/**
 * Turn a package.json version field into a comparable semver spec.
 * Git, file, and workspace links have no registry version and are skipped.
 */
function normalizeVersionSpec(
  spec: string,
  packageName: string,
  manifestDir: string,
): string | null {
  const trimmed = spec.trim();
  if (!trimmed || trimmed.startsWith("$")) return null;

  if (/^(workspace|file|link|portal):/i.test(trimmed)) return null;
  if (/^(git\+|github:|gitlab:|bitbucket:|https?:)/i.test(trimmed)) return null;

  const catalog = /^catalog:(.*)$/.exec(trimmed);
  if (catalog) {
    return resolveCatalogVersion(manifestDir, packageName, catalog[1].trim());
  }

  const npmAlias = /^npm:[^@\s]+@(.+)$/.exec(trimmed);
  if (npmAlias) return npmAlias[1].trim();

  return trimmed;
}

function dependencySpec(
  section: Record<string, unknown> | undefined,
  packageName: string,
): string | null {
  const raw = section?.[packageName];
  return typeof raw === "string" ? raw : null;
}

/** Depth-first search of npm overrides / Yarn resolutions / pnpm overrides. */
function findOverrideSpec(value: unknown, packageName: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const leaf = key.split("/").pop() ?? key;
    if (leaf === packageName && typeof child === "string") return child;

    if (child && typeof child === "object") {
      const nested = findOverrideSpec(child, packageName);
      if (nested) return nested;
    }
  }

  return null;
}

function findInPackageJson(
  pkg: PackageJson,
  manifestDir: string,
): string | null {
  for (const sectionName of DEPENDENCY_SECTIONS) {
    const section = pkg[sectionName];
    for (const packageName of SDK_PACKAGE.REACT) {
      const raw = dependencySpec(section, packageName);
      if (!raw) continue;
      const spec = normalizeVersionSpec(raw, packageName, manifestDir);
      if (spec) return spec;
    }
  }

  const overrideSources = [pkg.overrides, pkg.resolutions, pkg.pnpm?.overrides];
  for (const source of overrideSources) {
    if (!source) continue;
    for (const packageName of SDK_PACKAGE.REACT) {
      const raw = findOverrideSpec(source, packageName);
      if (!raw) continue;
      const spec = normalizeVersionSpec(raw, packageName, manifestDir);
      if (spec) return spec;
    }
  }

  return null;
}

/**
 * Inspect a `package.json` for the Wingify FME React SDK.
 *
 * npm and Yarn (and pnpm / Bun) all declare the dependency in `package.json`.
 * The detector checks every dependency map, npm `overrides`, Yarn `resolutions`,
 * pnpm overrides, and pnpm catalog references in `pnpm-workspace.yaml`.
 */
async function detectReact(file: string): Promise<void> {
  if (!file.endsWith("package.json")) return;

  let pkg: PackageJson;
  try {
    pkg = JSON.parse(fs.readFileSync(file, "utf8")) as PackageJson;
  } catch {
    return;
  }

  const versionSpec = findInPackageJson(pkg, path.dirname(path.resolve(file)));
  if (!versionSpec) return;

  const latest = await fetchLatest(LANG.REACT);
  if (!latest) {
    logLatestFetchFailed("React", versionSpec);
    return;
  }

  if (isOutdated(versionSpec, latest)) {
    await reportOutdatedSdk({
      sdkLabel: SDK_LABEL.REACT,
      file,
      currentVersion: versionSpec,
      latest,
    });
    return;
  }

  logSdkUpToDate("React", versionSpec);
}

export default detectReact;
