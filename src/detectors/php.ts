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

/** Converts Composer `~` constraints into a semver range for version comparison. */
function composerTildeToRange(spec: string): string {
  const m = spec.match(/^~\s*([0-9]+)\.([0-9]+)(?:\.([0-9]+))?$/);
  if (!m) return spec;

  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = m[3] !== undefined ? Number(m[3]) : undefined;

  const lower =
    patch === undefined ? `${major}.${minor}.0` : `${major}.${minor}.${patch}`;

  const upper =
    patch === undefined ? `${major + 1}.0.0` : `${major}.${minor + 1}.0`;

  return `>=${lower} <${upper}`;
}

/** Scans `composer.json` for the FME PHP SDK, compares to Packagist latest, and reports. */
async function detectPhp(file: string): Promise<void> {
  const jsonRaw = fs.readFileSync(file, "utf8");
  const json = JSON.parse(jsonRaw) as {
    require?: Record<string, string>;
    "require-dev"?: Record<string, string>;
  };

  const requireDeps = json.require || {};
  const requireDevDeps = json["require-dev"] || {};

  // Check for both vwo and wingify packages
  let versionSpecRaw: string | undefined;
  let packageName: string | undefined;

  for (const packageName_ of SDK_PACKAGE.PHP) {
    versionSpecRaw =
      requireDeps[packageName_] || requireDevDeps[packageName_];
    
    if (versionSpecRaw) {
      packageName = packageName_;
      break;
    }
  }

  if (!versionSpecRaw || !packageName) return;

  // Normalize Composer `~` so comparison uses Composer semantics
  // (e.g. "~1.5" -> ">=1.5.0 <2.0.0") rather than npm's `~`.
  const versionSpec = composerTildeToRange(versionSpecRaw);

  const latest = await fetchLatest(LANG.PHP);
  if (!latest) {
    logLatestFetchFailed("PHP", versionSpec);
    return;
  }

  if (isOutdated(versionSpec, latest)) {
    await reportOutdatedSdk({
      sdkLabel: SDK_LABEL.PHP,
      file,
      currentVersion: versionSpecRaw,
      latest,
    });
    return;
  }

  logSdkUpToDate("PHP", versionSpecRaw);
}

export default detectPhp;
