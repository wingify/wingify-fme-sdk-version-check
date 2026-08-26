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
const fetchLatest_1 = __importDefault(require("../utils/fetchLatest"));
const versionCompare_1 = __importDefault(require("../utils/versionCompare"));
const reportSdk_1 = require("../utils/reportSdk");
const constants_1 = require("../constants");
/**
 * Convert Composer-style tilde constraints (`~`) into a semver range
 * that reflects Composer semantics rather than npm's.
 *
 * Composer:
 * - `~1.5`   -> ">=1.5.0 <2.0.0"
 * - `~1.5.0` -> ">=1.5.0 <1.6.0"
 *
 * For any spec that does not match this simple tilde pattern, the
 * original string is returned unchanged.
 */
function composerTildeToRange(spec) {
    const m = spec.match(/^~\s*([0-9]+)\.([0-9]+)(?:\.([0-9]+))?$/);
    if (!m)
        return spec;
    const major = Number(m[1]);
    const minor = Number(m[2]);
    const patch = m[3] !== undefined ? Number(m[3]) : undefined;
    const lower = patch === undefined ? `${major}.${minor}.0` : `${major}.${minor}.${patch}`;
    const upper = patch === undefined ? `${major + 1}.0.0` : `${major}.${minor + 1}.0`;
    return `>=${lower} <${upper}`;
}
/**
 * Inspect a `composer.json` file and, if `vwo/vwo-fme-php-sdk` or `wingify/wingify-fme-php-sdk` is present
 * in either `require` or `require-dev`, compare its constraint against
 * the latest Packagist version.
 */
async function detectPhp(file) {
    const jsonRaw = fs_1.default.readFileSync(file, "utf8");
    const json = JSON.parse(jsonRaw);
    const requireDeps = json.require || {};
    const requireDevDeps = json["require-dev"] || {};
    // Check for both vwo and wingify packages
    let versionSpecRaw;
    let packageName;
    for (const packageName_ of constants_1.SDK_PACKAGE.PHP) {
        versionSpecRaw =
            requireDeps[packageName_] || requireDevDeps[packageName_];
        if (versionSpecRaw) {
            packageName = packageName_;
            break;
        }
    }
    if (!versionSpecRaw || !packageName)
        return;
    // Normalize Composer `~` so comparison uses Composer semantics
    // (e.g. "~1.5" -> ">=1.5.0 <2.0.0") rather than npm's `~`.
    const versionSpec = composerTildeToRange(versionSpecRaw);
    const latest = await (0, fetchLatest_1.default)(constants_1.LANG.PHP);
    if (!latest) {
        (0, reportSdk_1.logLatestFetchFailed)("PHP", versionSpec);
        return;
    }
    if ((0, versionCompare_1.default)(versionSpec, latest)) {
        await (0, reportSdk_1.reportOutdatedSdk)({
            sdkLabel: constants_1.SDK_LABEL.PHP,
            file,
            currentVersion: versionSpecRaw,
            latest,
        });
        return;
    }
    (0, reportSdk_1.logSdkUpToDate)("PHP", versionSpecRaw);
}
exports.default = detectPhp;
