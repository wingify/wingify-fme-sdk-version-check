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
 * Inspect a `Gemfile` and, if `vwo-fme-ruby-sdk` or `wingify-fme-ruby-sdk` is declared,
 * compare the Ruby-style version constraint against the latest
 * RubyGems release.
 */
async function detectRuby(file) {
    const gemfile = fs_1.default.readFileSync(file, "utf8");
    // Check for both vwo and wingify packages
    let versionSpec;
    let packageName;
    for (const packageName_ of constants_1.SDK_PACKAGE.RUBY) {
        const gemPattern = new RegExp(String.raw `gem\s+['"]` +
            packageName_ +
            String.raw `['"][^'\n"]*['"]([^'"]+)['"]`);
        const match = gemfile.match(gemPattern);
        if (match) {
            packageName = packageName_;
            versionSpec = match[1].trim();
            break;
        }
    }
    if (!versionSpec || !packageName)
        return;
    const latest = await (0, fetchLatest_1.default)(constants_1.LANG.RUBY);
    if (!latest) {
        (0, reportSdk_1.logLatestFetchFailed)("Ruby", versionSpec);
        return;
    }
    if ((0, versionCompare_1.default)(versionSpec, latest)) {
        await (0, reportSdk_1.reportOutdatedSdk)({
            sdkLabel: constants_1.SDK_LABEL.RUBY,
            file,
            currentVersion: versionSpec,
            latest,
        });
        return;
    }
    (0, reportSdk_1.logSdkUpToDate)("Ruby", versionSpec);
}
exports.default = detectRuby;
