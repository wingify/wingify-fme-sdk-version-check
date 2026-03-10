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
const semver_1 = __importDefault(require("semver"));
/**
 * Helper for computing the next major version boundary.
 *
 * Example: 1 -> "2.0.0"
 */
function incMajor(major) {
    return `${major + 1}.0.0`;
}
/**
 * Helper for computing the next minor version boundary within a major.
 *
 * Example: (1, 4) -> "1.5.0"
 */
function incMinor(major, minor) {
    return `${major}.${minor + 1}.0`;
}
/**
 * Convert Ruby/Bundler "pessimistic" version constraints (`~>` or bare `~`) into a
 * semver-compatible range that `semver` can reason about.
 *
 * Examples:
 * - `~> 1.4` / `~ 1.4`   -> ">=1.4.0 <2.0.0"
 * - `~> 1.4.0`           -> ">=1.4.0 <1.5.0"
 * - `~> 1.4.2`           -> ">=1.4.2 <1.5.0"
 *
 * Additional comma-separated constraints are preserved and combined.
 */
function rubyPessimisticToSemverRange(spec) {
    // Allow multiple constraints like: "~> 1.4", ">= 1.4.2"
    const parts = spec
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    const converted = [];
    for (const p of parts) {
        // Match both ~> and ~ (Bundler allows ~ as shorthand; npm semver would treat ~ differently)
        const m = p.match(/^~>?\s*([0-9]+)(?:\.([0-9]+))?(?:\.([0-9]+))?$/);
        if (!m) {
            converted.push(p);
            continue;
        }
        const major = Number(m[1]);
        const minor = m[2] !== undefined ? Number(m[2]) : undefined;
        const patch = m[3] !== undefined ? Number(m[3]) : undefined;
        // Lower bound: coerce to 3-part semver
        const lower = minor === undefined
            ? `${major}.0.0`
            : patch === undefined
                ? `${major}.${minor}.0`
                : `${major}.${minor}.${patch}`;
        // Upper bound:
        // - "~> X"       -> <(X+1).0.0
        // - "~> X.Y"     -> <(X+1).0.0
        // - "~> X.Y.Z"   -> <X.(Y+1).0
        const upper = minor === undefined
            ? incMajor(major)
            : patch === undefined
                ? incMajor(major)
                : incMinor(major, minor);
        converted.push(`>=${lower}`);
        converted.push(`<${upper}`);
    }
    // semver ANDs constraints when separated by spaces
    return converted.join(" ");
}
/**
 * Convert Maven/NuGet-style bracket ranges into a semver-compatible range.
 *
 * Examples:
 * - "[1.0,2.0)"  -> ">=1.0.0 <2.0.0"
 * - "[1.0,)"     -> ">=1.0.0"
 * - "(,2.0]"     -> "<=2.0.0"
 * - "[1.0]"      -> "1.0.0"
 *
 * If the spec does not match the expected pattern, `null` is returned.
 */
function bracketRangeToSemverRange(spec) {
    const trimmed = spec.trim();
    if (!/^[\[\(].*[\]\)]$/.test(trimmed))
        return null;
    const startInclusive = trimmed.startsWith("[");
    const endInclusive = trimmed.endsWith("]");
    // Strip the outer brackets/parentheses
    const inner = trimmed.slice(1, -1);
    const [rawStart, rawEnd] = inner.split(",", 2);
    const pieces = [];
    const start = rawStart?.trim();
    const end = rawEnd?.trim();
    if (start) {
        const coerced = semver_1.default.coerce(start);
        if (!coerced)
            return null;
        pieces.push(`${startInclusive ? ">=" : ">"}` + coerced.version);
    }
    if (end) {
        const coerced = semver_1.default.coerce(end);
        if (!coerced)
            return null;
        pieces.push(`${endInclusive ? "<=" : "<"}` + coerced.version);
    }
    // Single fixed version like "[1.0]"
    if (!start && !end)
        return null;
    return pieces.join(" ");
}
/**
 * Convert a loose "at least" spec like "1.5.0+" into a semver range ">=1.5.0".
 *
 * Note: This `+` suffix is not standard semver and not NuGet's canonical syntax
 * (NuGet typically uses bracket ranges like "[1.5.0,)"), but it shows up in the wild.
 */
function plusSuffixToSemverRange(spec) {
    const trimmed = spec.trim();
    if (!trimmed.endsWith("+"))
        return null;
    const base = trimmed.slice(0, -1).trim();
    if (!base)
        return null;
    const coerced = semver_1.default.coerce(base);
    if (!coerced)
        return null;
    return `>=${coerced.version}`;
}
/**
 * Determine if a dependency spec is effectively outdated compared to the latest version.
 *
 * - If `currentSpec` is a range (e.g. ^1.37.0, ~1.2, >=1.0.0 <2.0.0), we consider it:
 *   - up to date if the latest version satisfies that range
 *   - outdated if latest is strictly greater than the range minimum yet still outside the range
 *     (e.g. caret blocked by a major bump)
 *   - up to date if latest is below what the range requires (registry behind the constraint)
 *
 * - If `currentSpec` is a concrete version, we fall back to a simple semver comparison.
 */
function isOutdated(currentSpec, latest) {
    if (!latest)
        return false;
    const latestSemver = semver_1.default.coerce(latest);
    if (!latestSemver)
        return false;
    // Ruby-specific: translate `~>` or bare `~` (e.g. "~1.4") into Bundler-style semver ranges
    const isRubyTilde = currentSpec.includes("~>") || /^~\s*[0-9]/.test(currentSpec.trim());
    const rubyNormalized = isRubyTilde
        ? rubyPessimisticToSemverRange(currentSpec)
        : currentSpec;
    // Non-standard but common: "1.2.3+" meaning ">=1.2.3"
    const maybePlusRange = rubyNormalized.trim().endsWith("+")
        ? plusSuffixToSemverRange(rubyNormalized) ?? rubyNormalized
        : rubyNormalized;
    // Maven/NuGet-style bracket ranges (used in Java/.NET) into semver ranges
    const maybeBracketRange = maybePlusRange.trim().startsWith("[") || maybePlusRange.trim().startsWith("(")
        ? bracketRangeToSemverRange(maybePlusRange) ?? maybePlusRange
        : maybePlusRange;
    const range = semver_1.default.validRange(maybeBracketRange);
    if (range) {
        if (semver_1.default.satisfies(latestSemver, range)) {
            return false;
        }
        const minVersion = semver_1.default.minVersion(range);
        if (!minVersion) {
            return false;
        }
        if (semver_1.default.lt(latestSemver, minVersion)) {
            return false;
        }
        return semver_1.default.gt(latestSemver, minVersion);
    }
    const currentSemver = semver_1.default.coerce(currentSpec);
    if (!currentSemver)
        return false;
    return semver_1.default.lt(currentSemver, latestSemver);
}
exports.default = isOutdated;
