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
/** Strip Gradle/Kotlin comments from a single line (best-effort). */
function stripLineComment(line) {
    const withoutBlock = line.replace(/\/\*[\s\S]*?\*\//g, "");
    const hash = withoutBlock.indexOf("#");
    const slash = withoutBlock.indexOf("//");
    let cut = withoutBlock.length;
    if (hash !== -1)
        cut = Math.min(cut, hash);
    if (slash !== -1)
        cut = Math.min(cut, slash);
    return withoutBlock.slice(0, cut);
}
function readGradleProperties(dir) {
    const props = {};
    const filePath = path_1.default.join(dir, "gradle.properties");
    if (!fs_1.default.existsSync(filePath))
        return props;
    const lines = fs_1.default.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = stripLineComment(line).trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1)
            continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        props[key] = value;
    }
    return props;
}
/** Collect `gradle.properties` from the manifest directory up to the repo root. */
function collectGradleProperties(manifestDir) {
    const merged = {};
    let dir = manifestDir;
    const root = path_1.default.resolve(".");
    while (dir === root || dir.startsWith(root + path_1.default.sep)) {
        Object.assign(merged, readGradleProperties(dir));
        if (dir === root)
            break;
        const parent = path_1.default.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return merged;
}
/** Read `ext { ... }` / `set("key", "value")` assignments from Gradle build files. */
function collectGradleExtAssignments(manifestDir) {
    const assignments = {};
    let dir = manifestDir;
    const root = path_1.default.resolve(".");
    while (dir === root || dir.startsWith(root + path_1.default.sep)) {
        for (const name of ["build.gradle", "build.gradle.kts"]) {
            const filePath = path_1.default.join(dir, name);
            if (!fs_1.default.existsSync(filePath))
                continue;
            const content = fs_1.default.readFileSync(filePath, "utf8");
            const extBlock = content.match(/ext\s*\{([^}]*)\}/s)?.[1] ?? "";
            const block = extBlock || content;
            for (const m of block.matchAll(/(?:^|[\s;])([A-Za-z_][\w.]*)\s*=\s*['"]([^'"]+)['"]/gm)) {
                assignments[m[1]] = m[2];
            }
            for (const m of content.matchAll(/set\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/g)) {
                assignments[m[1]] = m[2];
            }
        }
        if (dir === root)
            break;
        const parent = path_1.default.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return assignments;
}
function resolveGradleVersionToken(raw, manifestDir) {
    const trimmed = raw.trim();
    if (!trimmed)
        return null;
    if (/^[\d.]+[+\-]?$/.test(trimmed) || semverLikeRange(trimmed)) {
        return trimmed;
    }
    const propMatch = trimmed.match(/^\$\{([^}]+)\}$/) ?? trimmed.match(/^\$([A-Za-z_][\w.]*)$/);
    if (!propMatch)
        return trimmed;
    const key = propMatch[1].trim();
    const props = collectGradleProperties(manifestDir);
    const ext = collectGradleExtAssignments(manifestDir);
    const resolved = props[key] ?? ext[key];
    return resolved?.trim() ?? null;
}
function semverLikeRange(spec) {
    return (/^[\^~>=<]/.test(spec) ||
        spec.includes(",") ||
        spec.startsWith("[") ||
        spec.startsWith("("));
}
function parseVersionCatalog(content) {
    const versions = {};
    const libraries = {};
    const lines = content.split(/\r?\n/);
    let section = null;
    let currentLib = null;
    let libBuffer = "";
    const flushLibrary = () => {
        if (!currentLib)
            return;
        const entry = libBuffer.trim();
        libraries[currentLib] = parseLibraryEntry(entry, versions);
        currentLib = null;
        libBuffer = "";
    };
    for (const line of lines) {
        const trimmed = stripLineComment(line).trim();
        if (!trimmed)
            continue;
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
            if (m)
                versions[m[1]] = m[2].trim();
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
function parseLibraryEntry(entry, versions) {
    const result = {};
    const moduleMatch = entry.match(/module\s*=\s*["']([^"']+)["']/);
    if (moduleMatch)
        result.module = moduleMatch[1];
    const groupMatch = entry.match(/group\s*=\s*["']([^"']+)["']/);
    if (groupMatch)
        result.group = groupMatch[1];
    const nameMatch = entry.match(/name\s*=\s*["']([^"']+)["']/);
    if (nameMatch)
        result.name = nameMatch[1];
    const versionMatch = entry.match(/version\s*=\s*["']([^"']+)["']/);
    if (versionMatch)
        result.version = versionMatch[1];
    const versionRefMatch = entry.match(/version\.ref\s*=\s*["']([^"']+)["']/);
    if (versionRefMatch) {
        result.versionRef = versionRefMatch[1];
        result.version = versions[versionRefMatch[1]];
    }
    return result;
}
function coordinateMatches(group, artifact, coord) {
    return group === coord.group && artifact === coord.artifact;
}
function findVersionCatalogFiles(manifestDir) {
    const found = [];
    let dir = manifestDir;
    const root = path_1.default.resolve(".");
    while (dir === root || dir.startsWith(root + path_1.default.sep)) {
        for (const rel of [
            "gradle/libs.versions.toml",
            "libs.versions.toml",
            "gradle/version-catalog/libs.versions.toml",
        ]) {
            const candidate = path_1.default.join(dir, rel);
            if (fs_1.default.existsSync(candidate))
                found.push(candidate);
        }
        if (dir === root)
            break;
        const parent = path_1.default.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    return found;
}
/** Gradle turns `vwo-fme-android-sdk` into `libs.vwo.fme.android.sdk`. */
function catalogAliasToTomlKey(alias) {
    return alias.replace(/\./g, "-");
}
function resolveLibraryEntryVersion(entry, versions) {
    if (entry.version)
        return entry.version;
    if (entry.versionRef)
        return versions[entry.versionRef];
    return undefined;
}
function findViaVersionCatalogAlias(content, manifestDir) {
    const aliasMatches = content.matchAll(/\blibs\.([a-z][a-z0-9.]*)/gi);
    const catalogPaths = findVersionCatalogFiles(manifestDir);
    if (catalogPaths.length === 0)
        return null;
    for (const m of aliasMatches) {
        const tomlKey = catalogAliasToTomlKey(m[1]);
        for (const catalogPath of catalogPaths) {
            const catalogContent = fs_1.default.readFileSync(catalogPath, "utf8");
            const { versions, libraries } = parseVersionCatalog(catalogContent);
            const entry = libraries[tomlKey];
            if (!entry)
                continue;
            let group;
            let artifact;
            if (entry.module) {
                const parts = entry.module.split(":");
                group = parts[0];
                artifact = parts[1];
            }
            else {
                group = entry.group;
                artifact = entry.name;
            }
            const versionSpec = resolveLibraryEntryVersion(entry, versions);
            if (!group || !artifact || !versionSpec)
                continue;
            for (const coord of constants_1.ANDROID_MAVEN_COORDS) {
                if (coordinateMatches(group, artifact, coord)) {
                    return {
                        versionSpec,
                        coordinate: `${coord.group}:${coord.artifact}`,
                    };
                }
            }
        }
    }
    return null;
}
function findInGradleBuild(content, manifestDir) {
    const viaAlias = findViaVersionCatalogAlias(content, manifestDir);
    if (viaAlias)
        return viaAlias;
    for (const coord of constants_1.ANDROID_MAVEN_COORDS) {
        const g = coord.group.replace(/\./g, "\\.");
        const a = coord.artifact;
        const inline = new RegExp(`['"](${g}):(${a}):([^'"]+)['"]`, "g");
        for (const m of content.matchAll(inline)) {
            const resolved = resolveGradleVersionToken(m[3], manifestDir);
            if (resolved) {
                return {
                    versionSpec: resolved,
                    coordinate: `${coord.group}:${coord.artifact}`,
                };
            }
        }
        const mapGroovy = new RegExp(`group:\\s*['"]${g}['"][^\\n]*name:\\s*['"]${a}['"][^\\n]*version:\\s*['"]([^'"]+)['"]`, "gs");
        const mapKt = new RegExp(`group\\s*=\\s*"${g}"[^\\n]*name\\s*=\\s*"${a}"[^\\n]*version\\s*=\\s*"([^"]+)"`, "gs");
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
function findInVersionCatalog(content, _manifestDir) {
    const { versions, libraries } = parseVersionCatalog(content);
    for (const entry of Object.values(libraries)) {
        let group;
        let artifact;
        let versionSpec;
        if (entry.module) {
            const parts = entry.module.split(":");
            if (parts.length >= 2) {
                group = parts[0];
                artifact = parts[1];
                versionSpec = entry.version ?? parts[2];
            }
        }
        else {
            group = entry.group;
            artifact = entry.name;
            versionSpec = entry.version;
            if (entry.versionRef && !versionSpec) {
                versionSpec = versions[entry.versionRef];
            }
        }
        if (!group || !artifact || !versionSpec)
            continue;
        for (const coord of constants_1.ANDROID_MAVEN_COORDS) {
            if (coordinateMatches(group, artifact, coord)) {
                return {
                    versionSpec,
                    coordinate: `${coord.group}:${coord.artifact}`,
                };
            }
        }
    }
    for (const artifact of constants_1.SDK_PACKAGE.ANDROID) {
        const key = versions[artifact];
        if (key) {
            const coord = constants_1.ANDROID_MAVEN_COORDS.find((c) => c.artifact === artifact);
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
 * Inspect Android build manifests (`build.gradle`, `build.gradle.kts`,
 * `libs.versions.toml`) for Wingify FME Android SDK dependencies and compare
 * them with Maven Central metadata.
 */
async function detectAndroid(file) {
    const content = fs_1.default.readFileSync(file, "utf8");
    const manifestDir = path_1.default.dirname(path_1.default.resolve(file));
    let resolved = null;
    if (file.endsWith("libs.versions.toml")) {
        resolved = findInVersionCatalog(content, manifestDir);
    }
    else if (file.endsWith("build.gradle.kts") || file.endsWith("build.gradle")) {
        resolved = findInGradleBuild(content, manifestDir);
    }
    if (!resolved)
        return;
    const latest = await (0, fetchLatest_1.default)(constants_1.LANG.ANDROID);
    if (!latest) {
        (0, reportSdk_1.logLatestFetchFailed)("Android", resolved.versionSpec);
        return;
    }
    if ((0, versionCompare_1.default)(resolved.versionSpec, latest)) {
        await (0, reportSdk_1.reportOutdatedSdk)({
            sdkLabel: constants_1.SDK_LABEL.ANDROID,
            file,
            currentVersion: resolved.versionSpec,
            latest,
        });
        return;
    }
    (0, reportSdk_1.logSdkUpToDate)("Android", resolved.versionSpec);
}
exports.default = detectAndroid;
