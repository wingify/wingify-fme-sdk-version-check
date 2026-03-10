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

import scanRepo from "./utils/scanner";
import detectNode from "./detectors/node";
import detectJava from "./detectors/java";
import detectPhp from "./detectors/php";
import detectGo from "./detectors/go";
import detectRuby from "./detectors/ruby";
import detectDotnet from "./detectors/dotnet";
import detectPython from "./detectors/python";
import { ENV, MANIFEST } from "./constants";

/**
 * Entrypoint for the GitHub Action.
 *
 * - Scans the repository for language-specific manifest files.
 * - For each manifest, invokes the matching detector.
 * - Each detector logs whether the corresponding Wingify SDK is up to date
 *   and posts a Slack notification when it is outdated.
 */
async function run(): Promise<void> {
  const files = await scanRepo();

  if (process.env[ENV.DEBUG] === "true") {
    console.log(`wingify-sdk-version-check: found ${files.length} manifest(s)`);
    for (const f of files) console.log(`- ${f}`);
  }

  for (const file of files) {
    if (file.endsWith(MANIFEST.PACKAGE_JSON)) {
      await detectNode(file);
    }

    if (file.endsWith(MANIFEST.POM_XML)) {
      await detectJava(file);
    }

    if (file.endsWith(MANIFEST.COMPOSER_JSON)) {
      await detectPhp(file);
    }

    if (file.endsWith(MANIFEST.GO_MOD)) {
      await detectGo(file);
    }

    if (file.endsWith(MANIFEST.GEMFILE)) {
      await detectRuby(file);
    }

    if (file.endsWith(MANIFEST.CSPROJ)) {
      await detectDotnet(file);
    }

    if (file.endsWith(MANIFEST.REQUIREMENTS_TXT)) {
      await detectPython(file);
    }
  }
}

run().catch((err) => {
  console.error("Wingify SDK Version Check failed:", err);
  process.exitCode = 1;
});
