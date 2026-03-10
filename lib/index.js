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
/**
 * Entrypoint for the GitHub Action.
 *
 * - Scans the repository for language-specific manifest files.
 * - For each manifest, invokes the matching detector.
 * - Each detector logs whether the corresponding Wingify SDK is up to date.
 */
async function run() {
    // scan the repository for language-specific manifest files
    const files = await (0, scanner_1.default)();
    if (process.env.DEBUG === "true") {
        console.log(`wingify-sdk-version-check: found ${files.length} manifest(s)`);
        for (const f of files)
            console.log(`- ${f}`);
    }
    for (const file of files) {
        // detect the language of the file and invoke the corresponding detector
        if (file.endsWith("package.json")) {
            await (0, node_1.default)(file);
        }
        // detect Java
        if (file.endsWith("pom.xml")) {
            await (0, java_1.default)(file);
        }
        // detect PHP
        if (file.endsWith("composer.json")) {
            await (0, php_1.default)(file);
        }
        // detect Go
        if (file.endsWith("go.mod")) {
            await (0, go_1.default)(file);
        }
        // detect Ruby
        if (file.endsWith("Gemfile")) {
            await (0, ruby_1.default)(file);
        }
        // detect .NET
        if (file.endsWith(".csproj")) {
            await (0, dotnet_1.default)(file);
        }
        // detect Python
        if (file.endsWith("requirements.txt")) {
            await (0, python_1.default)(file);
        }
    }
}
// if the action fails, log an error and exit with a non-zero code
run().catch((err) => {
    console.error("Wingify SDK Version Check failed:", err);
    process.exitCode = 1;
});
