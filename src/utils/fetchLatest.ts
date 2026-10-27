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
 * - android -> Maven Central (AAR artifacts)
 * - ios     -> CocoaPods trunk, GitHub releases (SPM source repos)
 * - react-native -> npm (vwo-fme-react-native-sdk / wingify-fme-react-native-sdk)
 * - react        -> npm (vwo-fme-react-sdk / wingify-fme-react-sdk)
 * - flutter      -> pub.dev (vwo_fme_flutter_sdk / wingify_fme_flutter_sdk)
 *
 * Returns `null` when the SDK is unknown or the registry query fails.
 */
async function fetchLatest(lang: Lang): Promise<string | null> {
  try {
    if (lang === LANG.NODE || lang === LANG.REACT_NATIVE) {
      const urls =
        lang === LANG.NODE ? REGISTRY_URL.NODE : REGISTRY_URL.REACT_NATIVE;
      for (const url of urls) {
        try {
          const res = await axios.get(url);
          return res.data.version as string;
        } catch {
          continue;
        }
      }
      return null;
    }

    if (lang === LANG.RUBY) {
      // Try both vwo and wingify packages
      for (const url of REGISTRY_URL.RUBY) {
        try {
          const res = await axios.get(url);
          return res.data.version as string;
        } catch (err) {
          // Continue to next URL if this one fails
          continue;
        }
      }
      return null;
    }

    if (lang === LANG.PHP) {
      // Try both vwo and wingify packages
      for (let i = 0; i < REGISTRY_URL.PHP.length; i++) {
        try {
          const res = await axios.get(REGISTRY_URL.PHP[i]);
          const packages = res.data.packages?.[SDK_PACKAGE.PHP[i]];
          if (Array.isArray(packages) && packages.length > 0) {
            // Packagist p2 responses list versions newest-first.
            return packages[0].version as string;
          }
        } catch (err) {
          // Continue to next URL if this one fails
          continue;
        }
      }
      return null;
    }

    if (lang === LANG.JAVA) {
      // Try both vwo and wingify packages
      for (const url of REGISTRY_URL.JAVA) {
        try {
          const res = await axios.get(url, { responseType: "text" });

          const xml = String(res.data);
          const release = xml.match(/<release>\s*([^<\s]+)\s*<\/release>/)?.[1];
          const latest = xml.match(/<latest>\s*([^<\s]+)\s*<\/latest>/)?.[1];

          // Prefer `<release>` (last non-snapshot) over `<latest>`.
          const version = (release || latest || null) as string | null;
          if (version) return version;
        } catch (err) {
          // Continue to next URL if this one fails
          continue;
        }
      }
      return null;
    }

    if (lang === LANG.GO) {
      // Try both vwo and wingify packages
      for (const url of REGISTRY_URL.GO) {
        try {
          const res = await axios.get(url, {
            timeout: GO_PROXY_TIMEOUT_MS,
          });
          return (res.data.Version as string) || null;
        } catch (err) {
          // Continue to next URL if this one fails
          continue;
        }
      }
      return null;
    }

    if (lang === LANG.DOTNET) {
      // Try both vwo and wingify packages
      for (const url of REGISTRY_URL.DOTNET) {
        try {
          const res = await axios.get(url);
          const versions = res.data?.versions as string[] | undefined;
          if (Array.isArray(versions) && versions.length > 0) {
            // NuGet's flat-container index lists versions in ascending order.
            return versions[versions.length - 1];
          }
        } catch (err) {
          // Continue to next URL if this one fails
          continue;
        }
      }
      return null;
    }

    if (lang === LANG.ANDROID) {
      for (const url of REGISTRY_URL.ANDROID) {
        try {
          const res = await axios.get(url, { responseType: "text" });
          const xml = String(res.data);
          const release = xml.match(/<release>\s*([^<\s]+)\s*<\/release>/)?.[1];
          const latest = xml.match(/<latest>\s*([^<\s]+)\s*<\/latest>/)?.[1];
          const version = (release || latest || null) as string | null;
          if (version) return version;
        } catch {
          continue;
        }
      }
      return null;
    }

    if (lang === LANG.IOS) {
      const candidates: string[] = [];
      for (const url of REGISTRY_URL.IOS) {
        try {
          const res = await axios.get(url);

          if (url.includes("api.github.com")) {
            const tag = (res.data?.tag_name as string | undefined)?.replace(
              /^v/i,
              "",
            );
            if (tag && semver.coerce(tag)) {
              candidates.push(semver.coerce(tag)!.version);
            }
            continue;
          }

          const versions = res.data?.versions as { name: string }[] | undefined;
          if (!Array.isArray(versions) || versions.length === 0) continue;

          const highest =
            versions
              .map((v) => v.name)
              .filter((name) => semver.coerce(name))
              .sort((a, b) =>
                semver.compare(semver.coerce(a)!, semver.coerce(b)!),
              )
              .pop() ?? null;

          if (highest) candidates.push(highest);
        } catch {
          continue;
        }
      }

      if (candidates.length === 0) return null;

      return candidates.sort((a, b) =>
        semver.compare(semver.coerce(a)!, semver.coerce(b)!),
      )[candidates.length - 1];
    }

    if (lang === LANG.PYTHON) {
      // Try both vwo and wingify packages
      for (const url of REGISTRY_URL.PYTHON) {
        try {
          const res = await axios.get(url);
          const releases = res.data?.releases as
            Record<string, unknown> | undefined;
          if (!releases || typeof releases !== "object") continue;

          // Pick the highest coercible semver key rather than trusting `info.version`,
          // which can lag behind the releases map for some packages.
          const highestKey =
            Object.keys(releases)
              .filter((k) => semver.coerce(k))
              .sort((a, b) =>
                semver.compare(semver.coerce(a)!, semver.coerce(b)!),
              )
              .pop() ?? null;

          if (highestKey) return highestKey;
        } catch (err) {
          // Continue to next URL if this one fails
          continue;
        }
      }
      return null;
    }

    if (lang === LANG.REACT) {
      const candidates: string[] = [];
      for (const url of REGISTRY_URL.REACT) {
        try {
          const res = await axios.get(url);
          const version = res.data?.version as string | undefined;
          if (version && semver.coerce(version)) {
            candidates.push(version);
          }
        } catch {
          continue;
        }
      }

      if (candidates.length === 0) return null;

      return candidates.sort((a, b) =>
        semver.compare(semver.coerce(a)!, semver.coerce(b)!),
      )[candidates.length - 1];
    }

    if (lang === LANG.FLUTTER) {
      const candidates: string[] = [];
      for (const url of REGISTRY_URL.FLUTTER) {
        try {
          const res = await axios.get(url);
          const version = res.data?.latest?.version as string | undefined;
          if (version && semver.coerce(version)) {
            candidates.push(version);
          }
        } catch {
          continue;
        }
      }

      if (candidates.length === 0) return null;

      return candidates.sort((a, b) =>
        semver.compare(semver.coerce(a)!, semver.coerce(b)!),
      )[candidates.length - 1];
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
