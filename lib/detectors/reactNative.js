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
 * Inspect a `package.json` file and, if `vwo-fme-react-native-sdk` or
 * `wingify-fme-react-native-sdk` is present, compare the declared version/range
 * against the latest npm release.
 */
async function detectReactNative(file) {
    if (!file.endsWith("package.json"))
        return;
    const pkgRaw = fs_1.default.readFileSync(file, "utf8");
    let pkg;
    try {
        pkg = JSON.parse(pkgRaw);
    }
    catch {
        return;
    }
    let versionSpec;
    let packageName;
    for (const packageName_ of constants_1.SDK_PACKAGE.REACT_NATIVE) {
        versionSpec =
            pkg.dependencies?.[packageName_] ||
                pkg.devDependencies?.[packageName_] ||
                pkg.peerDependencies?.[packageName_];
        if (versionSpec) {
            packageName = packageName_;
            break;
        }
    }
    if (!versionSpec || !packageName)
        return;
    const latest = await (0, fetchLatest_1.default)(constants_1.LANG.REACT_NATIVE);
    if (!latest) {
        (0, reportSdk_1.logLatestFetchFailed)("React Native", versionSpec);
        return;
    }
    if ((0, versionCompare_1.default)(versionSpec, latest)) {
        await (0, reportSdk_1.reportOutdatedSdk)({
            sdkLabel: constants_1.SDK_LABEL.REACT_NATIVE,
            file,
            currentVersion: versionSpec,
            latest,
        });
        return;
    }
    (0, reportSdk_1.logSdkUpToDate)("React Native", versionSpec);
}
exports.default = detectReactNative;
