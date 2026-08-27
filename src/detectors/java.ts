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
 * Inspect a `pom.xml` and, if the `vwo-fme-java-sdk` or `wingify-fme-java-sdk` dependency is present,
 * compare its version (or range) with the latest version reported by
 * Maven Central metadata.
 */
async function detectJava(file: string): Promise<void> {
  const xml = fs.readFileSync(file, "utf8");

  // Check for both vwo and wingify packages
  let versionSpec: string | undefined;
  let packageName: string | undefined;

  for (const packageName_ of SDK_PACKAGE.JAVA) {
    const artifactTag = `<artifactId>${packageName_}</artifactId>`;
    const depIndex = xml.indexOf(artifactTag);
    
    if (depIndex !== -1) {
      packageName = packageName_;
      // Version is expected after the matching `<artifactId>` in the same dependency block.
      const after = xml.slice(depIndex);
      const versionMatch = after.match(/<version>\s*([^<]+)\s*<\/version>/);
      
      if (versionMatch) {
        versionSpec = versionMatch[1].trim();
        break;
      }
    }
  }

  if (!versionSpec || !packageName) return;

  const latest = await fetchLatest(LANG.JAVA);
  if (!latest) {
    logLatestFetchFailed("Java", versionSpec);
    return;
  }

  if (isOutdated(versionSpec, latest)) {
    await reportOutdatedSdk({
      sdkLabel: SDK_LABEL.JAVA,
      file,
      currentVersion: versionSpec,
      latest,
    });
    return;
  }

  logSdkUpToDate("Java", versionSpec);
}

export default detectJava;
