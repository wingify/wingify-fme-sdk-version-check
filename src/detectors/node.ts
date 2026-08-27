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
 * Inspect a `package.json` file and, if `vwo-fme-node-sdk` or `wingify-fme-node-sdk` is present,
 * compare the declared version/range against the latest npm release.
 */
async function detectNode(file: string): Promise<void> {
  const pkgRaw = fs.readFileSync(file, "utf8");
  const pkg = JSON.parse(pkgRaw) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  // Check for both vwo and wingify packages
  let versionSpec: string | undefined;
  let packageName: string | undefined;

  for (const packageName_ of SDK_PACKAGE.NODE) {
    versionSpec =
      pkg.dependencies?.[packageName_] ||
      pkg.devDependencies?.[packageName_];
    
    if (versionSpec) {
      packageName = packageName_;
      break;
    }
  }

  if (!versionSpec || !packageName) return;

  const latest = await fetchLatest(LANG.NODE);
  if (!latest) {
    logLatestFetchFailed("Node", versionSpec);
    return;
  }

  if (isOutdated(versionSpec, latest)) {
    await reportOutdatedSdk({
      sdkLabel: SDK_LABEL.NODE,
      file,
      currentVersion: versionSpec,
      latest,
    });
    return;
  }

  logSdkUpToDate("Node", versionSpec);
}

export default detectNode;
