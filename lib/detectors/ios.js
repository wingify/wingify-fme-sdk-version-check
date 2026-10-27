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
        const location = pin?.location ?? "";
        if (!constants_1.IOS_SPM_REPO_URL_RE.test(location))
            continue;
        const state = pin?.state;
        const version = state?.version?.trim();
        if (version) {
            return { versionSpec: version, label: location };
        }
    }
    return null;
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
    const manifestDir = path_1.default.dirname(path_1.default.resolve(file));
    const base = path_1.default.basename(file);
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
    const latest = await (0, fetchLatest_1.default)(constants_1.LANG.IOS);
    if (!latest) {
        (0, reportSdk_1.logLatestFetchFailed)("iOS", resolved.versionSpec);
        return;
    }
    if ((0, versionCompare_1.default)(resolved.versionSpec, latest)) {
        await (0, reportSdk_1.reportOutdatedSdk)({
            sdkLabel: constants_1.SDK_LABEL.IOS,
            file,
            currentVersion: resolved.versionSpec,
            latest,
        });
        return;
    }
    (0, reportSdk_1.logSdkUpToDate)("iOS", resolved.versionSpec);
}
exports.default = detectIos;
