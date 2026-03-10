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
 * Inspect a `package.json` file and, if `vwo-fme-node-sdk` is present,
 * compare the declared version/range against the latest npm release.
 */
async function detectNode(file) {
    // read the package.json file
    const pkgRaw = fs_1.default.readFileSync(file, "utf8");
    // parse the package.json file
    const pkg = JSON.parse(pkgRaw);
    // extract the version constraint for vwo-fme-node-sdk
    const versionSpec = pkg.dependencies?.["vwo-fme-node-sdk"] ||
        pkg.devDependencies?.["vwo-fme-node-sdk"];
    // if the version constraint is not found, return
    if (!versionSpec)
        return;
    // fetch the latest version of the SDK
    const latest = await (0, fetchLatest_1.default)("node");
    // compare the version constraint with the latest version
    if ((0, versionCompare_1.default)(versionSpec, latest)) {
        const repoFull = process.env.GITHUB_REPOSITORY;
        const repoShort = repoFull?.includes("/") ? repoFull.split("/")[1] : repoFull ?? "this repository";
        const githubServer = process.env.GITHUB_SERVER_URL ?? "https://github.com";
        const workflowRunLine = repoFull
            ? `\n\nFor more details, refer to the latest workflow run: ${githubServer}/${repoFull}/actions`
            : "";
        const message = `<!here> ⚠️ SDK Version Check Failed

The Node FME SDK version currently used in *${repoShort}* is not up to date.

• File: \`${file}\`
• Current version: \`${versionSpec}\`
• Latest available version: \`${latest}\`

Please update the SDK to the latest version to maintain compatibility and stability.${workflowRunLine}`;
        console.log(message);
        await (0, notifySlack_1.default)(message);
        return;
    }
    console.log(`Node SDK up to date -- (${versionSpec})`);
}
exports.default = detectNode;
