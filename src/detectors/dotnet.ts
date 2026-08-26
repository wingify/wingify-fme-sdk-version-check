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
 * Inspect a `.csproj` file and, if the `VWO.FME.Sdk` or `Wingify.FME.Sdk` package reference is present,
 * compare its version (or range) with the latest version published to NuGet.
 */
async function detectDotnet(file: string): Promise<void> {
  const xml = fs.readFileSync(file, "utf8");

  // Check for both vwo and wingify packages
  let versionSpec: string | null = null;
  let packageName: string | undefined;

  for (const packageName_ of SDK_PACKAGE.DOTNET) {
    const includeAttr = `Include="${packageName_}"`;
    const pkgIndex = xml.indexOf(includeAttr);
    
    if (pkgIndex !== -1) {
      packageName = packageName_;
      const after = xml.slice(pkgIndex);

      // Support both attribute form (`Version="…"`) and nested `<Version>` elements.
      const attrMatch = after.match(/Version="([^"]+)"/);
      if (attrMatch) {
        versionSpec = attrMatch[1].trim();
        break;
      } else {
        const nestedMatch = after.match(/<Version>\s*([^<]+)\s*<\/Version>/);
        if (nestedMatch) {
          versionSpec = nestedMatch[1].trim();
          break;
        }
      }
    }
  }

  if (!versionSpec || !packageName) return;

  const latest = await fetchLatest(LANG.DOTNET);
  if (!latest) {
    logLatestFetchFailed(".NET", versionSpec);
    return;
  }

  if (isOutdated(versionSpec, latest)) {
    await reportOutdatedSdk({
      sdkLabel: SDK_LABEL.DOTNET,
      file,
      currentVersion: versionSpec,
      latest,
    });
    return;
  }

  logSdkUpToDate(".NET", versionSpec);
}

export default detectDotnet;
