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
 * Inspect a `package.json` file and, if `vwo-fme-react-native-sdk` or
 * `wingify-fme-react-native-sdk` is present, compare the declared version/range
 * against the latest npm release.
 */
async function detectReactNative(file: string): Promise<void> {
  if (!file.endsWith("package.json")) return;

  const pkgRaw = fs.readFileSync(file, "utf8");
  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  try {
    pkg = JSON.parse(pkgRaw);
  } catch {
    return;
  }

  let versionSpec: string | undefined;
  let packageName: string | undefined;

  for (const packageName_ of SDK_PACKAGE.REACT_NATIVE) {
    versionSpec =
      pkg.dependencies?.[packageName_] ||
      pkg.devDependencies?.[packageName_] ||
      pkg.peerDependencies?.[packageName_];

    if (versionSpec) {
      packageName = packageName_;
      break;
    }
  }

  if (!versionSpec || !packageName) return;

  const latest = await fetchLatest(LANG.REACT_NATIVE);
  if (!latest) {
    logLatestFetchFailed("React Native", versionSpec);
    return;
  }

  if (isOutdated(versionSpec, latest)) {
    await reportOutdatedSdk({
      sdkLabel: SDK_LABEL.REACT_NATIVE,
      file,
      currentVersion: versionSpec,
      latest,
    });
    return;
  }

  logSdkUpToDate("React Native", versionSpec);
}

export default detectReactNative;
