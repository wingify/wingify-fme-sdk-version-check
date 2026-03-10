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
const notifySlack_1 = __importDefault(require("../utils/notifySlack"));
/**
 * Inspect a `requirements.txt` file and, if `vwo-fme-python-sdk` is listed,
 * compare the declared constraint against the latest PyPI release.
 */
async function detectPython(file) {
    const raw = fs_1.default.readFileSync(file, "utf8");
    // Find the vwo-fme-python-sdk entry, stripping inline comments
    const match = raw
        .split(/\r?\n/)
        .map((l) => l.replace(/#.*$/, "").trim())
        .find((l) => /^vwo[-_]fme[-_]python[-_]sdk(?!-)(?:\[[^\]]*\])?/i.test(l));
    if (!match)
        return;
    // Extract the raw version spec (e.g. "==1.2.3", ">=1.0,<2.0")
    const versionSpecRaw = match
        .replace(/^vwo[-_]fme[-_]python[-_]sdk(?!-)(?:\[[^\]]*\])?/i, "")
        .trim();
    // Strip leading operators for display purposes only (e.g. "==1.2.3" → "1.2.3")
    const versionSpecDisplay = versionSpecRaw.replace(/^[=!<>~^]+/, "").trim();
    // Normalize pip `==x.y.z` → `=x.y.z` for semver comparison
    const versionSpec = versionSpecRaw
        .replace(/^===/, "=")
        .replace(/^==/, "=")
        .replace(/,(?=\s*\S)/g, " ")
        .trim();
    const latest = await (0, fetchLatest_1.default)("python");
    if (!latest) {
        console.log(`Python SDK detected (current ${versionSpecDisplay || "(unpinned)"}) but latest version could not be fetched`);
        return;
    }
    if ((0, versionCompare_1.default)(versionSpec, latest)) {
        const repoFull = process.env.GITHUB_REPOSITORY;
        const repoShort = repoFull?.includes("/") ? repoFull.split("/")[1] : repoFull ?? "this repository";
        const githubServer = process.env.GITHUB_SERVER_URL ?? "https://github.com";
        const workflowRunLine = repoFull
            ? `\n\nFor more details, refer to the latest workflow run: ${githubServer}/${repoFull}/actions`
            : "";
        const message = `<!here> ⚠️ SDK Version Check Failed

The Python FME SDK version currently used in *${repoShort}* is not up to date.

• File: \`${path_1.default.basename(file)}\`
• Current version: \`${versionSpecDisplay || "(unpinned)"}\`
• Latest available version: \`${latest}\`

Please update the SDK to the latest version to maintain compatibility and stability.${workflowRunLine}`;
        console.log(message);
        await (0, notifySlack_1.default)(message);
        return;
    }
    console.log(`Python SDK up to date (${versionSpecDisplay || "unpinned"})`);
}
exports.default = detectPython;
