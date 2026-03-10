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
import path from "path";
import fetchLatest from "../utils/fetchLatest";
import isOutdated from "../utils/versionCompare";
import {
  logLatestFetchFailed,
  logSdkUpToDate,
  reportOutdatedSdk,
} from "../utils/reportSdk";
import { LANG, PYTHON_REQUIREMENT_NAME_RE, SDK_LABEL } from "../constants";

/**
 * Inspect a `requirements.txt` file and, if `vwo-fme-python-sdk` is listed,
 * compare the declared constraint against the latest PyPI release.
 */
async function detectPython(file: string): Promise<void> {
  const raw = fs.readFileSync(file, "utf8");

  const match = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, "").trim())
    .find((l) => PYTHON_REQUIREMENT_NAME_RE.test(l));

  if (!match) return;

  const versionSpecRaw = match.replace(PYTHON_REQUIREMENT_NAME_RE, "").trim();

  // Strip leading operators for display only (e.g. "==1.2.3" → "1.2.3").
  const versionSpecDisplay = versionSpecRaw.replace(/^[=!<>~^]+/, "").trim();

  // Normalize pip pins (`==` / `===`) and comma-separated constraints
  // into a space-separated spec that `semver` can parse.
  const versionSpec = versionSpecRaw
    .replace(/^===/, "=")
    .replace(/^==/, "=")
    .replace(/,(?=\s*\S)/g, " ")
    .trim();

  const latest = await fetchLatest(LANG.PYTHON);
  if (!latest) {
    logLatestFetchFailed("Python", versionSpecDisplay || "(unpinned)");
    return;
  }

  if (isOutdated(versionSpec, latest)) {
    await reportOutdatedSdk({
      sdkLabel: SDK_LABEL.PYTHON,
      file: path.basename(file),
      currentVersion: versionSpecDisplay || "(unpinned)",
      latest,
    });
    return;
  }

  logSdkUpToDate("Python", versionSpecDisplay || "unpinned");
}

export default detectPython;
