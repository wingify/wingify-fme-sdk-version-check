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

import axios from "axios";
import semver from "semver";
import {
  GO_PROXY_TIMEOUT_MS,
  LANG,
  Lang,
  REGISTRY_URL,
  SDK_PACKAGE,
} from "../constants";

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
async function fetchLatest(lang: Lang): Promise<string | null> {
  try {
    if (lang === LANG.NODE) {
      const res = await axios.get(REGISTRY_URL.NODE);
      return res.data.version as string;
    }

    if (lang === LANG.RUBY) {
      const res = await axios.get(REGISTRY_URL.RUBY);
      return res.data.version as string;
    }

    if (lang === LANG.PHP) {
      const res = await axios.get(REGISTRY_URL.PHP);
      const packages = res.data.packages?.[SDK_PACKAGE.PHP];
      if (Array.isArray(packages) && packages.length > 0) {
        // Packagist p2 responses list versions newest-first.
        return packages[0].version as string;
      }
      return null;
    }

    if (lang === LANG.JAVA) {
      const res = await axios.get(REGISTRY_URL.JAVA, { responseType: "text" });

      const xml = String(res.data);
      const release = xml.match(/<release>\s*([^<\s]+)\s*<\/release>/)?.[1];
      const latest = xml.match(/<latest>\s*([^<\s]+)\s*<\/latest>/)?.[1];

      // Prefer `<release>` (last non-snapshot) over `<latest>`.
      return (release || latest || null) as string | null;
    }

    if (lang === LANG.GO) {
      const res = await axios.get(REGISTRY_URL.GO, {
        timeout: GO_PROXY_TIMEOUT_MS,
      });
      return (res.data.Version as string) || null;
    }

    if (lang === LANG.DOTNET) {
      const res = await axios.get(REGISTRY_URL.DOTNET);
      const versions = res.data?.versions as string[] | undefined;
      if (Array.isArray(versions) && versions.length > 0) {
        // NuGet's flat-container index lists versions in ascending order.
        return versions[versions.length - 1];
      }
      return null;
    }

    if (lang === LANG.PYTHON) {
      const res = await axios.get(REGISTRY_URL.PYTHON);
      const releases = res.data?.releases as
        Record<string, unknown> | undefined;
      if (!releases || typeof releases !== "object") return null;

      // Pick the highest coercible semver key rather than trusting `info.version`,
      // which can lag behind the releases map for some packages.
      const highestKey =
        Object.keys(releases)
          .filter((k) => semver.coerce(k))
          .sort((a, b) => semver.compare(semver.coerce(a)!, semver.coerce(b)!))
          .pop() ?? null;

      return highestKey;
    }

    return null;
  } catch (err: unknown) {
    console.log(
      `Failed to fetch latest version for ${lang}: ${formatHttpError(err)}`,
    );
    return null;
  }
}

function formatHttpError(err: unknown): string {
  const axiosLike = err as {
    response?: { status?: number; statusText?: string };
    message?: string;
  };
  const status = axiosLike?.response?.status;
  const statusText = axiosLike?.response?.statusText;
  const message = axiosLike?.message || "unknown error";
  return status ? `${status} ${statusText || ""}`.trim() : message;
}

export default fetchLatest;
