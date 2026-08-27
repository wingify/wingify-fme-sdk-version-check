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
const scanner_1 = __importDefault(require("./utils/scanner"));
const node_1 = __importDefault(require("./detectors/node"));
const java_1 = __importDefault(require("./detectors/java"));
const php_1 = __importDefault(require("./detectors/php"));
const go_1 = __importDefault(require("./detectors/go"));
const ruby_1 = __importDefault(require("./detectors/ruby"));
const dotnet_1 = __importDefault(require("./detectors/dotnet"));
const python_1 = __importDefault(require("./detectors/python"));
const constants_1 = require("./constants");
/**
 * Entrypoint for the GitHub Action.
 *
 * - Scans the repository for language-specific manifest files.
 * - For each manifest, invokes the matching detector.
 * - Each detector logs whether the corresponding Wingify SDK is up to date
 *   and posts a Slack notification when it is outdated.
 */
async function run() {
    const files = await (0, scanner_1.default)();
    if (process.env[constants_1.ENV.DEBUG] === "true") {
        console.log(`wingify-sdk-version-check: found ${files.length} manifest(s)`);
        for (const f of files)
            console.log(`- ${f}`);
    }
    for (const file of files) {
        if (file.endsWith(constants_1.MANIFEST.PACKAGE_JSON)) {
            await (0, node_1.default)(file);
        }
        if (file.endsWith(constants_1.MANIFEST.POM_XML)) {
            await (0, java_1.default)(file);
        }
        if (file.endsWith(constants_1.MANIFEST.COMPOSER_JSON)) {
            await (0, php_1.default)(file);
        }
        if (file.endsWith(constants_1.MANIFEST.GO_MOD)) {
            await (0, go_1.default)(file);
        }
        if (file.endsWith(constants_1.MANIFEST.GEMFILE)) {
            await (0, ruby_1.default)(file);
        }
        if (file.endsWith(constants_1.MANIFEST.CSPROJ)) {
            await (0, dotnet_1.default)(file);
        }
        if (file.endsWith(constants_1.MANIFEST.REQUIREMENTS_TXT)) {
            await (0, python_1.default)(file);
        }
    }
}
run().catch((err) => {
    console.error("Wingify SDK Version Check failed:", err);
    process.exitCode = 1;
});
