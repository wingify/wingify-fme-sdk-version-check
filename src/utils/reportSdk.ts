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

import {
  DEFAULT_GITHUB_SERVER_URL,
  ENV,
  FALLBACK_REPO_DISPLAY_NAME,
} from "../constants";
import notifySlack from "./notifySlack";

/**
 * Log that an SDK is present but its latest version could not be resolved.
 */
export function logLatestFetchFailed(
  sdkName: string,
  versionSpec: string,
): void {
  console.log(
    `${sdkName} SDK detected (current ${versionSpec}) but latest version could not be fetched`,
  );
}

/**
 * Log that the declared constraint already covers the latest release.
 */
export function logSdkUpToDate(sdkName: string, versionSpec: string): void {
  console.log(`${sdkName} SDK up to date (${versionSpec})`);
}

/**
 * Build the outdated-SDK Slack/console message, print it, and notify Slack.
 *
 * Repo name and workflow-run URL are taken from GitHub Actions env vars
 * when this action runs inside a workflow.
 */
export async function reportOutdatedSdk(params: {
  sdkLabel: string;
  file: string;
  currentVersion: string;
  latest: string;
}): Promise<void> {
  const message = buildOutdatedMessage(params);
  console.log(message);
  await notifySlack(message);
}

function buildOutdatedMessage(params: {
  sdkLabel: string;
  file: string;
  currentVersion: string;
  latest: string;
}): string {
  const repoFull = process.env[ENV.GITHUB_REPOSITORY];
  const repoShort = repoFull?.includes("/")
    ? repoFull.split("/")[1]!
    : (repoFull ?? FALLBACK_REPO_DISPLAY_NAME);
  const githubServer =
    process.env[ENV.GITHUB_SERVER_URL] ?? DEFAULT_GITHUB_SERVER_URL;
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
