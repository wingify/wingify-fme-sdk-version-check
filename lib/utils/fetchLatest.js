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
const axios_1 = __importDefault(require("axios"));
const semver_1 = __importDefault(require("semver"));
/**
 * Resolve the latest published version of a Wingify SDK for the given language.
 *
 * Each language is backed by its ecosystem's registry:
 * - node   -> npm
 * - ruby   -> RubyGems
 * - php    -> Packagist
 * - java   -> Maven Central
 * - go     -> Go module proxy
 * - dotnet -> NuGet
 * - python -> PyPI
 *
 * Returns `null` when the SDK is unknown or the registry query fails.
 */
async function fetchLatest(lang) {
    try {
        // Node (npm)
        if (lang === "node") {
            const res = await axios_1.default.get("https://registry.npmjs.org/vwo-fme-node-sdk/latest");
            return res.data.version;
        }
        // Ruby (RubyGems)
        if (lang === "ruby") {
            const res = await axios_1.default.get("https://rubygems.org/api/v1/gems/vwo-fme-ruby-sdk.json");
            return res.data.version;
        }
        // PHP (Packagist)
        if (lang === "php") {
            const res = await axios_1.default.get("https://repo.packagist.org/p2/vwo/vwo-fme-php-sdk.json");
            const packages = res.data.packages?.["vwo/vwo-fme-php-sdk"];
            if (Array.isArray(packages) && packages.length > 0) {
                return packages[0].version;
            }
            return null;
        }
        // Java (Maven Central)
        if (lang === "java") {
            const res = await axios_1.default.get("https://repo1.maven.org/maven2/com/vwo/sdk/vwo-fme-java-sdk/maven-metadata.xml", { responseType: "text" });
            const xml = String(res.data);
            const release = xml.match(/<release>\s*([^<\s]+)\s*<\/release>/)?.[1];
            const latest = xml.match(/<latest>\s*([^<\s]+)\s*<\/latest>/)?.[1];
            return (release || latest || null);
        }
        // Go (Go module proxy)
        if (lang === "go") {
            const res = await axios_1.default.get("https://proxy.golang.org/github.com/wingify/vwo-fme-go-sdk/@latest", { timeout: 10000 });
            return res.data.Version || null;
        }
        // .NET (NuGet)
        if (lang === "dotnet") {
            const res = await axios_1.default.get("https://api.nuget.org/v3-flatcontainer/vwo.fme.sdk/index.json");
            const versions = res.data?.versions;
            if (Array.isArray(versions) && versions.length > 0) {
                return versions[versions.length - 1];
            }
            return null;
        }
        // Python (PyPI)
        if (lang === "python") {
            const res = await axios_1.default.get("https://pypi.org/pypi/vwo-fme-python-sdk/json");
            const releases = res.data?.releases;
            if (!releases || typeof releases !== "object")
                return null;
            const highestKey = Object.keys(releases)
                .filter((k) => semver_1.default.coerce(k))
                .sort((a, b) => semver_1.default.compare(semver_1.default.coerce(a), semver_1.default.coerce(b)))
                .pop() ?? null;
            return highestKey;
        }
        return null;
    }
    catch (err) {
        const status = err?.response?.status;
        const statusText = err?.response?.statusText;
        const message = err?.message || "unknown error";
        console.log(`Failed to fetch latest version for ${lang}: ${status ? `${status} ${statusText || ""}`.trim() : message}`);
        return null;
    }
}
exports.default = fetchLatest;
