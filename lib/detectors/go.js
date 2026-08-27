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
const fetchLatest_1 = __importDefault(require("../utils/fetchLatest"));
const versionCompare_1 = __importDefault(require("../utils/versionCompare"));
const reportSdk_1 = require("../utils/reportSdk");
const constants_1 = require("../constants");
/**
 * Inspect a `go.mod` file and, if the module path for the Go SDK is present,
 * compare the required version against the latest version available from
 * the Go module proxy.
 */
async function detectGo(file) {
    try {
        const gomod = fs_1.default.readFileSync(file, "utf8");
        // Check for both vwo and wingify packages
        let lineMatch;
        let packageName;
        for (const packageName_ of constants_1.SDK_PACKAGE.GO) {
            lineMatch = gomod
                .split("\n")
                .find((line) => line.includes(packageName_));
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
        const latest = await (0, fetchLatest_1.default)(constants_1.LANG.GO);
        if (!latest) {
            (0, reportSdk_1.logLatestFetchFailed)("Go", versionSpec);
            return;
        }
        if ((0, versionCompare_1.default)(versionSpec, latest)) {
            await (0, reportSdk_1.reportOutdatedSdk)({
                sdkLabel: constants_1.SDK_LABEL.GO,
                file,
                currentVersion: versionSpec,
                latest,
            });
            return;
        }
        (0, reportSdk_1.logSdkUpToDate)("Go", versionSpec);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`Go detector failed for ${file}: ${message}`);
    }
}
exports.default = detectGo;
