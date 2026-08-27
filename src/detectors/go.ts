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
import fetchLatest from "../utils/fetchLatest";
import isOutdated from "../utils/versionCompare";
import {
  logLatestFetchFailed,
  logSdkUpToDate,
  reportOutdatedSdk,
} from "../utils/reportSdk";
import { LANG, SDK_LABEL, SDK_PACKAGE } from "../constants";

/**
 * Inspect a `go.mod` file and, if the module path for the Go SDK is present,
 * compare the required version against the latest version available from
 * the Go module proxy.
 */
async function detectGo(file: string): Promise<void> {
  try {
    const gomod = fs.readFileSync(file, "utf8");

    // Check for both vwo and wingify packages
    let lineMatch: string | undefined;
    let packageName: string | undefined;

    for (const packageName_ of SDK_PACKAGE.GO) {
      lineMatch = gomod
        .split("\n")
        .find((line: string) => line.includes(packageName_));
      
      if (lineMatch) {
        packageName = packageName_;
        break;
      }
    }

    if (!lineMatch || !packageName) {
      console.log(`Go SDK not found in ${file}`);
      return;
    }

    const parts = lineMatch.trim().split(/\s+/);
    const versionSpec = parts[parts.length - 1];

    const latest = await fetchLatest(LANG.GO);
    if (!latest) {
      logLatestFetchFailed("Go", versionSpec);
      return;
    }

    if (isOutdated(versionSpec, latest)) {
      await reportOutdatedSdk({
        sdkLabel: SDK_LABEL.GO,
        file,
        currentVersion: versionSpec,
        latest,
      });
      return;
    }

    logSdkUpToDate("Go", versionSpec);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`Go detector failed for ${file}: ${message}`);
  }
}

export default detectGo;
