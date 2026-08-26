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
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const fetchLatest_1 = __importDefault(require("../utils/fetchLatest"));
const versionCompare_1 = __importDefault(require("../utils/versionCompare"));
const reportSdk_1 = require("../utils/reportSdk");
const constants_1 = require("../constants");
/**
 * Inspect a `requirements.txt` file and, if `vwo-fme-python-sdk` is listed,
 * compare the declared constraint against the latest PyPI release.
 */
async function detectPython(file) {
    const raw = fs_1.default.readFileSync(file, "utf8");
    const match = raw
        .split(/\r?\n/)
        .map((l) => l.replace(/#.*$/, "").trim())
        .find((l) => constants_1.PYTHON_REQUIREMENT_NAME_RE.test(l));
    if (!match)
        return;
    const versionSpecRaw = match.replace(constants_1.PYTHON_REQUIREMENT_NAME_RE, "").trim();
    // Strip leading operators for display only (e.g. "==1.2.3" → "1.2.3").
    const versionSpecDisplay = versionSpecRaw.replace(/^[=!<>~^]+/, "").trim();
    // Normalize pip pins (`==` / `===`) and comma-separated constraints
    // into a space-separated spec that `semver` can parse.
    const versionSpec = versionSpecRaw
        .replace(/^===/, "=")
        .replace(/^==/, "=")
        .replace(/,(?=\s*\S)/g, " ")
        .trim();
    const latest = await (0, fetchLatest_1.default)(constants_1.LANG.PYTHON);
    if (!latest) {
        (0, reportSdk_1.logLatestFetchFailed)("Python", versionSpecDisplay || "(unpinned)");
        return;
    }
    if ((0, versionCompare_1.default)(versionSpec, latest)) {
        await (0, reportSdk_1.reportOutdatedSdk)({
            sdkLabel: constants_1.SDK_LABEL.PYTHON,
            file: path_1.default.basename(file),
            currentVersion: versionSpecDisplay || "(unpinned)",
            latest,
        });
        return;
    }
    (0, reportSdk_1.logSdkUpToDate)("Python", versionSpecDisplay || "unpinned");
}
exports.default = detectPython;
