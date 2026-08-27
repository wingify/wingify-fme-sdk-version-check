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
 * Inspect a `Gemfile` and, if `vwo-fme-ruby-sdk` or `wingify-fme-ruby-sdk` is declared,
 * compare the Ruby-style version constraint against the latest
 * RubyGems release.
 */
async function detectRuby(file: string): Promise<void> {
  const gemfile = fs.readFileSync(file, "utf8");

  // Check for both vwo and wingify packages
  let versionSpec: string | undefined;
  let packageName: string | undefined;

  for (const packageName_ of SDK_PACKAGE.RUBY) {
    const gemPattern = new RegExp(
      String.raw`gem\s+['"]` +
        packageName_ +
        String.raw`['"][^'\n"]*['"]([^'"]+)['"]`,
    );
    const match = gemfile.match(gemPattern);

    if (match) {
      packageName = packageName_;
      versionSpec = match[1].trim();
      break;
    }
  }

  if (!versionSpec || !packageName) return;

  const latest = await fetchLatest(LANG.RUBY);
  if (!latest) {
    logLatestFetchFailed("Ruby", versionSpec);
    return;
  }

  if (isOutdated(versionSpec, latest)) {
    await reportOutdatedSdk({
      sdkLabel: SDK_LABEL.RUBY,
      file,
      currentVersion: versionSpec,
      latest,
    });
    return;
  }

  logSdkUpToDate("Ruby", versionSpec);
}

export default detectRuby;
