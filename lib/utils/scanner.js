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
const fast_glob_1 = __importDefault(require("fast-glob"));
/**
 * Discover manifest files in the current repository that may reference
 * a Wingify SDK.
 *
 * This is intentionally language-agnostic and only cares about common
 * dependency/manifest filenames.
 */
async function scanRepo() {
    const files = await (0, fast_glob_1.default)([
        "**/package.json",
        "**/pom.xml",
        "**/composer.json",
        "**/go.mod",
        "**/Gemfile",
        "**/*.csproj",
        "**/requirements.txt",
    ], {
        ignore: [
            "**/node_modules/**",
            "**/.venv/**",
            "**/venv/**",
            "**/__pypackages__/**",
        ],
    });
    return files;
}
exports.default = scanRepo;
