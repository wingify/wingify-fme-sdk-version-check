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
const notifySlack_1 = __importDefault(require("../utils/notifySlack"));
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
    const lower = patch === undefined
        ? `${major}.${minor}.0`
        : `${major}.${minor}.${patch}`;
    const upper = patch === undefined
        ? `${major + 1}.0.0`
        : `${major}.${minor + 1}.0`;
    return `>=${lower} <${upper}`;
}
/**
 * Inspect a `composer.json` file and, if `vwo/vwo-fme-php-sdk` is present
 * in either `require` or `require-dev`, compare its constraint against
 * the latest Packagist version.
 */
async function detectPhp(file) {
    // read the composer.json file
    const jsonRaw = fs_1.default.readFileSync(file, "utf8");
    // parse the composer.json file
    const json = JSON.parse(jsonRaw);
    // extract the version constraint for vwo/vwo-fme-php-sdk
    const requireDeps = json.require || {};
    const requireDevDeps = json["require-dev"] || {};
    const versionSpecRaw = requireDeps["vwo/vwo-fme-php-sdk"] ||
        requireDevDeps["vwo/vwo-fme-php-sdk"];
    if (!versionSpecRaw)
        return;
    // normalize Composer tilde constraints so that our semver-based
    // comparison uses Composer semantics (e.g. "~1.5" -> ">=1.5.0 <2.0.0")
    const versionSpec = composerTildeToRange(versionSpecRaw);
    // fetch the latest version of the SDK
    const latest = await (0, fetchLatest_1.default)("php");
    if (!latest) {
        console.log(`PHP SDK detected (current ${versionSpec}) but latest version could not be fetched`);
        return;
    }
    // compare the version constraint with the latest version
    if ((0, versionCompare_1.default)(versionSpec, latest)) {
        const repoFull = process.env.GITHUB_REPOSITORY;
        const repoShort = repoFull?.includes("/") ? repoFull.split("/")[1] : repoFull ?? "this repository";
        const githubServer = process.env.GITHUB_SERVER_URL ?? "https://github.com";
        const workflowRunLine = repoFull
            ? `\n\nFor more details, refer to the latest workflow run: ${githubServer}/${repoFull}/actions`
            : "";
        const message = `<!here> ⚠️ SDK Version Check Failed

The PHP FME SDK version currently used in *${repoShort}* is not up to date.

• File: \`${file}\`
• Current version: \`${versionSpecRaw}\`
• Latest available version: \`${latest}\`

Please update the SDK to the latest version to maintain compatibility and stability.${workflowRunLine}`;
        console.log(message);
        await (0, notifySlack_1.default)(message);
        return;
    }
    console.log(`PHP SDK up to date (${versionSpecRaw})`);
}
exports.default = detectPhp;
