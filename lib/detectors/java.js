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
 * Inspect a `pom.xml` and, if the `vwo-fme-java-sdk` or `wingify-fme-java-sdk` dependency is present,
 * compare its version (or range) with the latest version reported by
 * Maven Central metadata.
 */
async function detectJava(file) {
    const xml = fs_1.default.readFileSync(file, "utf8");
    // Check for both vwo and wingify packages
    let versionSpec;
    let packageName;
    for (const packageName_ of constants_1.SDK_PACKAGE.JAVA) {
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
    if (!versionSpec || !packageName)
        return;
    const latest = await (0, fetchLatest_1.default)(constants_1.LANG.JAVA);
    if (!latest) {
        (0, reportSdk_1.logLatestFetchFailed)("Java", versionSpec);
        return;
    }
    if ((0, versionCompare_1.default)(versionSpec, latest)) {
        await (0, reportSdk_1.reportOutdatedSdk)({
            sdkLabel: constants_1.SDK_LABEL.JAVA,
            file,
            currentVersion: versionSpec,
            latest,
        });
        return;
    }
    (0, reportSdk_1.logSdkUpToDate)("Java", versionSpec);
}
exports.default = detectJava;
