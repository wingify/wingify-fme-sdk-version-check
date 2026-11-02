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
/**
 * Dependency maps written by npm, Yarn, pnpm, and Bun.
 * npm `install` and `yarn add` both record the SDK in `package.json`.
 */
const DEPENDENCY_SECTIONS = [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
];
function unquote(value) {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1).trim();
    }
    return trimmed;
}
/** Strip an unquoted YAML `#` comment. */
function stripYamlComment(line) {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === "'" && !inDouble)
            inSingle = !inSingle;
        else if (ch === '"' && !inSingle)
            inDouble = !inDouble;
        else if (ch === "#" && !inSingle && !inDouble)
            return line.slice(0, i);
    }
    return line;
}
/**
 * Read the default `catalog` and named `catalogs` from a pnpm workspace file.
 * Versions declared as `catalog:` / `catalog:<name>` in package.json live here,
 * the same way a Gradle version catalog lives outside `build.gradle`.
 */
function parsePnpmCatalogs(content) {
    const defaultCatalog = {};
    const named = {};
    let section = null;
    let namedKey = null;
    let namedIndent = -1;
    for (const rawLine of content.split(/\r?\n/)) {
        const line = stripYamlComment(rawLine);
        if (!line.trim())
            continue;
        const indent = line.length - line.trimStart().length;
        const trimmed = line.trim();
        const kv = /^([^:#][^:]*):\s*(.*)$/.exec(trimmed);
        if (!kv)
            continue;
        const key = unquote(kv[1].trim());
        const value = unquote(kv[2].trim());
        if (indent === 0) {
            namedKey = null;
            namedIndent = -1;
            if (key === "catalog")
                section = "catalog";
            else if (key === "catalogs")
                section = "catalogs";
            else
                section = null;
            continue;
        }
        if (section === "catalog" && value) {
            defaultCatalog[key] = value;
            continue;
        }
        if (section !== "catalogs")
            continue;
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
function resolveCatalogVersion(manifestDir, packageName, catalogName) {
    let dir = manifestDir;
    const root = path_1.default.resolve(".");
    while (dir === root || dir.startsWith(root + path_1.default.sep)) {
        const filePath = path_1.default.join(dir, "pnpm-workspace.yaml");
        if (fs_1.default.existsSync(filePath)) {
            const parsed = parsePnpmCatalogs(fs_1.default.readFileSync(filePath, "utf8"));
            const table = catalogName
                ? parsed.named[catalogName]
                : parsed.defaultCatalog;
            const spec = table?.[packageName]?.trim();
            if (spec)
                return spec;
        }
        if (dir === root)
            break;
        const parent = path_1.default.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return null;
}
/**
 * Turn a package.json version field into a comparable semver spec.
 * Git, file, and workspace links have no registry version and are skipped.
 */
function normalizeVersionSpec(spec, packageName, manifestDir) {
    const trimmed = spec.trim();
    if (!trimmed || trimmed.startsWith("$"))
        return null;
    if (/^(workspace|file|link|portal):/i.test(trimmed))
        return null;
    if (/^(git\+|github:|gitlab:|bitbucket:|https?:)/i.test(trimmed))
        return null;
    const catalog = /^catalog:(.*)$/.exec(trimmed);
    if (catalog) {
        return resolveCatalogVersion(manifestDir, packageName, catalog[1].trim());
    }
    const npmAlias = /^npm:[^@\s]+@(.+)$/.exec(trimmed);
    if (npmAlias)
        return npmAlias[1].trim();
    return trimmed;
}
function dependencySpec(section, packageName) {
    const raw = section?.[packageName];
    return typeof raw === "string" ? raw : null;
}
/** Depth-first search of npm overrides / Yarn resolutions / pnpm overrides. */
function findOverrideSpec(value, packageName) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return null;
    for (const [key, child] of Object.entries(value)) {
        const leaf = key.split("/").pop() ?? key;
        if (leaf === packageName && typeof child === "string")
            return child;
        if (child && typeof child === "object") {
            const nested = findOverrideSpec(child, packageName);
            if (nested)
                return nested;
        }
    }
    return null;
}
function findInPackageJson(pkg, manifestDir) {
    for (const sectionName of DEPENDENCY_SECTIONS) {
        const section = pkg[sectionName];
        for (const packageName of constants_1.SDK_PACKAGE.REACT) {
            const raw = dependencySpec(section, packageName);
            if (!raw)
                continue;
            const spec = normalizeVersionSpec(raw, packageName, manifestDir);
            if (spec)
                return spec;
        }
    }
    const overrideSources = [pkg.overrides, pkg.resolutions, pkg.pnpm?.overrides];
    for (const source of overrideSources) {
        if (!source)
            continue;
        for (const packageName of constants_1.SDK_PACKAGE.REACT) {
            const raw = findOverrideSpec(source, packageName);
            if (!raw)
                continue;
            const spec = normalizeVersionSpec(raw, packageName, manifestDir);
            if (spec)
                return spec;
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
async function detectReact(file) {
    if (!file.endsWith("package.json"))
        return;
    let pkg;
    try {
        pkg = JSON.parse(fs_1.default.readFileSync(file, "utf8"));
    }
    catch {
        return;
    }
    const versionSpec = findInPackageJson(pkg, path_1.default.dirname(path_1.default.resolve(file)));
    if (!versionSpec)
        return;
    const latest = await (0, fetchLatest_1.default)(constants_1.LANG.REACT);
    if (!latest) {
        (0, reportSdk_1.logLatestFetchFailed)("React", versionSpec);
        return;
    }
    if ((0, versionCompare_1.default)(versionSpec, latest)) {
        await (0, reportSdk_1.reportOutdatedSdk)({
            sdkLabel: constants_1.SDK_LABEL.REACT,
            file,
            currentVersion: versionSpec,
            latest,
        });
        return;
    }
    (0, reportSdk_1.logSdkUpToDate)("React", versionSpec);
}
exports.default = detectReact;
