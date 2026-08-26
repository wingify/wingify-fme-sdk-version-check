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
exports.logLatestFetchFailed = logLatestFetchFailed;
exports.logSdkUpToDate = logSdkUpToDate;
exports.reportOutdatedSdk = reportOutdatedSdk;
const constants_1 = require("../constants");
const notifySlack_1 = __importDefault(require("./notifySlack"));
/**
 * Log that an SDK is present but its latest version could not be resolved.
 */
function logLatestFetchFailed(sdkName, versionSpec) {
    console.log(`${sdkName} SDK detected (current ${versionSpec}) but latest version could not be fetched`);
}
/**
 * Log that the declared constraint already covers the latest release.
 */
function logSdkUpToDate(sdkName, versionSpec) {
    console.log(`${sdkName} SDK up to date (${versionSpec})`);
}
/**
 * Build the outdated-SDK Slack/console message, print it, and notify Slack.
 *
 * Repo name and workflow-run URL are taken from GitHub Actions env vars
 * when this action runs inside a workflow.
 */
async function reportOutdatedSdk(params) {
    const message = buildOutdatedMessage(params);
    console.log(message);
    await (0, notifySlack_1.default)(message);
}
function buildOutdatedMessage(params) {
    const repoFull = process.env[constants_1.ENV.GITHUB_REPOSITORY];
    const repoShort = repoFull?.includes("/")
        ? repoFull.split("/")[1]
        : (repoFull ?? constants_1.FALLBACK_REPO_DISPLAY_NAME);
    const githubServer = process.env[constants_1.ENV.GITHUB_SERVER_URL] ?? constants_1.DEFAULT_GITHUB_SERVER_URL;
    const workflowRunLine = repoFull
        ? `\n\nFor more details, refer to the latest workflow run: ${githubServer}/${repoFull}/actions`
        : "";
    return `<!here> ⚠️ SDK Version Check Failed

The ${params.sdkLabel} FME SDK version currently used in *${repoShort}* is not up to date.

• File: \`${params.file}\`
• Current version: \`${params.currentVersion}\`
• Latest available version: \`${params.latest}\`

Please update the SDK to the latest version to maintain compatibility and stability.${workflowRunLine}`;
}
