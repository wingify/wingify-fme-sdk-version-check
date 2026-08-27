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
const constants_1 = require("../constants");
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
        if (lang === constants_1.LANG.NODE) {
            // Try both vwo and wingify packages
            for (const url of constants_1.REGISTRY_URL.NODE) {
                try {
                    const res = await axios_1.default.get(url);
                    return res.data.version;
                }
                catch (err) {
                    // Continue to next URL if this one fails
                    continue;
                }
            }
            return null;
        }
        if (lang === constants_1.LANG.RUBY) {
            // Try both vwo and wingify packages
            for (const url of constants_1.REGISTRY_URL.RUBY) {
                try {
                    const res = await axios_1.default.get(url);
                    return res.data.version;
                }
                catch (err) {
                    // Continue to next URL if this one fails
                    continue;
                }
            }
            return null;
        }
        if (lang === constants_1.LANG.PHP) {
            // Try both vwo and wingify packages
            for (let i = 0; i < constants_1.REGISTRY_URL.PHP.length; i++) {
                try {
                    const res = await axios_1.default.get(constants_1.REGISTRY_URL.PHP[i]);
                    const packages = res.data.packages?.[constants_1.SDK_PACKAGE.PHP[i]];
                    if (Array.isArray(packages) && packages.length > 0) {
                        // Packagist p2 responses list versions newest-first.
                        return packages[0].version;
                    }
                }
                catch (err) {
                    // Continue to next URL if this one fails
                    continue;
                }
            }
            return null;
        }
        if (lang === constants_1.LANG.JAVA) {
            // Try both vwo and wingify packages
            for (const url of constants_1.REGISTRY_URL.JAVA) {
                try {
                    const res = await axios_1.default.get(url, { responseType: "text" });
                    const xml = String(res.data);
                    const release = xml.match(/<release>\s*([^<\s]+)\s*<\/release>/)?.[1];
                    const latest = xml.match(/<latest>\s*([^<\s]+)\s*<\/latest>/)?.[1];
                    // Prefer `<release>` (last non-snapshot) over `<latest>`.
                    const version = (release || latest || null);
                    if (version)
                        return version;
                }
                catch (err) {
                    // Continue to next URL if this one fails
                    continue;
                }
            }
            return null;
        }
        if (lang === constants_1.LANG.GO) {
            // Try both vwo and wingify packages
            for (const url of constants_1.REGISTRY_URL.GO) {
                try {
                    const res = await axios_1.default.get(url, {
                        timeout: constants_1.GO_PROXY_TIMEOUT_MS,
                    });
                    return res.data.Version || null;
                }
                catch (err) {
                    // Continue to next URL if this one fails
                    continue;
                }
            }
            return null;
        }
        if (lang === constants_1.LANG.DOTNET) {
            // Try both vwo and wingify packages
            for (const url of constants_1.REGISTRY_URL.DOTNET) {
                try {
                    const res = await axios_1.default.get(url);
                    const versions = res.data?.versions;
                    if (Array.isArray(versions) && versions.length > 0) {
                        // NuGet's flat-container index lists versions in ascending order.
                        return versions[versions.length - 1];
                    }
                }
                catch (err) {
                    // Continue to next URL if this one fails
                    continue;
                }
            }
            return null;
        }
        if (lang === constants_1.LANG.PYTHON) {
            // Try both vwo and wingify packages
            for (const url of constants_1.REGISTRY_URL.PYTHON) {
                try {
                    const res = await axios_1.default.get(url);
                    const releases = res.data?.releases;
                    if (!releases || typeof releases !== "object")
                        continue;
                    // Pick the highest coercible semver key rather than trusting `info.version`,
                    // which can lag behind the releases map for some packages.
                    const highestKey = Object.keys(releases)
                        .filter((k) => semver_1.default.coerce(k))
                        .sort((a, b) => semver_1.default.compare(semver_1.default.coerce(a), semver_1.default.coerce(b)))
                        .pop() ?? null;
                    if (highestKey)
                        return highestKey;
                }
                catch (err) {
                    // Continue to next URL if this one fails
                    continue;
                }
            }
            return null;
        }
        return null;
    }
    catch (err) {
        console.log(`Failed to fetch latest version for ${lang}: ${formatHttpError(err)}`);
        return null;
    }
}
function formatHttpError(err) {
    const axiosLike = err;
    const status = axiosLike?.response?.status;
    const statusText = axiosLike?.response?.statusText;
    const message = axiosLike?.message || "unknown error";
    return status ? `${status} ${statusText || ""}`.trim() : message;
}
exports.default = fetchLatest;
