// The module channel's stagings (TEST-SPEC §7.6 *Placement*, H-1, H-2, H-8,
// H-11, C-2, S-3, S-7; SPEC 7.6 *Package and installation*, *Reach*).
// Harness machinery only: this module never imports product code, never
// loads a file of a package as a module or names one by its path as a
// channel (H-2), and runs no product. The one process it starts is a
// Node.js release E-1 provisions, asked which names it resolves to its own
// built-in modules.
//
// TEST-SPEC §7.6's Placement rule: the product's package directory, exactly
// as distributed — nothing installed into it afterwards, never a
// development tree (H-2) — is installed by placement alone, with no
// package-manager run, install step, or network access, under a name `N` of
// 7.6's grammar outside its exclusions, in a fresh staging whose ancestors
// H-1 has verified; every staging meets Reach's four conditions, and where a
// condition fails 7.6 promises nothing and no arm asserts anything there.
// This module makes those stagings for every test of 7.6 (P-17 and P-18
// among them):
//
// - The package directory (`modulePackageDirectory`; C-2, H-8), checked
//   before anything is staged. None given: every body of 7.6 fails there as
//   a diagnosed assertion failure (`HarnessAssertionError`, declining
//   shrinking), the module channel counting as part of the product, its
//   diagnosis naming the executable — the binding's command line — beside
//   which none is given, as every product-facing body's diagnosis names the
//   absent artifact when no product is installed (H-8; S-7's no-product
//   sweep, test/self/s7-red-green-sweep.test.ts). Given,
//   it must be an absolute path — never resolved against the working
//   directory, as helpers/node-releases.ts refuses a relative
//   XSPEC_NODE_RELEASES_DIR — naming a directory. On the built product's
//   binding (`missingFilesFailDiagnosed`, helpers/subprocess.ts) a path
//   that does not exist is its missing product, failing diagnosed likewise;
//   on any other binding (S-7's stub, a stand-in) it is a harness error.
//   The directory is read once, entry by entry, never written and never
//   followed below its root: a plain file by its bytes and mode, a
//   directory by its mode, a symbolic link by its target. An entry of
//   another kind is a harness error, and so — the conservative choice, H-2
//   forbidding a development tree, whose installed dependencies would
//   resolve inside a placed copy — is an entry named `node_modules`, of any
//   kind, at its root: a distribution carries none and a development tree
//   does (a distribution bundling dependencies there is refused too).
// - The manifest's name (`readManifestName`; T7.6-4(a), T7-9(d)): read by
//   parsing the directory's `package.json` and nothing else, under the
//   strict reading below. A manifest that is absent, no readable plain
//   file, not well-formed, or holding no string `name` gives none, and the
//   reading says why.
// - N (`moduleNameGrammarProblem`, `moduleNameExclusion`,
//   `verifyModuleName`; SPEC 7.6): `name` or `@scope/name`, each a
//   non-empty run of lowercase ASCII letters, digits, `-`, `.`, and `_`
//   beginning with a letter or digit, the whole at most 214 characters;
//   never a name in the `@types` scope or an `@typescript` name beginning
//   `lib-`; and, on a runtime arm, never a name one of the arm's releases
//   resolves to a built-in module, the release itself asked
//   (`require("node:module").isBuiltin`, run through the subprocess driver
//   under its own hang guard), so the answer is that release's: `fs` is
//   refused, `test` (built in only as `node:test`) admitted. The canonical
//   N (`canonicalModuleName`) is the first of two fixed, unscoped, dot-free
//   names that differs from the name the manifest gives, so the canonical
//   install is an aliased one whatever the package calls itself.
// - Stagings (`ModuleStaging`): each a fresh directory under the OS
//   temporary directory, its physical path used throughout, H-1's ancestor
//   half verified as it is made (`verifyStagingIsolation`,
//   helpers/staging-isolation.ts, under the staging mode `module-channel`)
//   and again, with a Node.js run's exact environment, working directory,
//   and release executables, wherever a driver asks before a run
//   (`verifyIsolation`). The three project kinds (`stageProject`): an
//   ES-module project, its `package.json` holding `"type": "module"`; a
//   CommonJS project whose `package.json` holds no `type`; and one with no
//   `package.json`.
// - Placements (`place`, `placeCanonical`): a copy at `node_modules/N` in a
//   holding directory the caller names — the importing file's own or an
//   ancestor, never itself named `node_modules` — or a symbolic link there
//   to a copy elsewhere in the staging under no `node_modules`. Each copy is
//   made entry by entry (helpers/tree-copy.ts: bytes and modes kept, links
//   as links), given the package directory's own mode, and read back equal
//   to the package as read before anything was staged. No staging write
//   lands in a placed copy afterwards (H-2: nothing installed into it).
// - Reach (`verifyReach`), checked on the finished staging before any tool
//   runs, for each importing file: physical naming (the file named by its
//   physical path, the path each tool is given); the holding directory the
//   file's own or an ancestor along that path, the placement in place;
//   nothing nearer (with `S`, `D`, and `T` as SPEC 7.6 defines them); no
//   self-reference (no manifest in the file's directory or an ancestor
//   giving a `name` that, each backslash read as `/`, is empty, `N`, or
//   `N`'s scope, with or without one trailing `/`); and well-formed
//   manifests. Where the caller declares them, it confirms the project kind
//   and that nothing but the placement is installed in the staging
//   (`alone`: the canonical placement's "nothing else installed").
// - The strict manifest reading (`readManifestStrictly`,
//   `judgeManifestBytes`; Reach's well-formed manifests): a readable plain
//   file — a symbolic link to one followed, anything else never opened —
//   holding, as UTF-8 with no byte-order mark, a JSON object that repeats no
//   member name (in any object it holds, the conservative reading), whose
//   `name` and `type` members, where present, are strings, and none of whose
//   strings, member names included, escapes a lone surrogate.
// - Every failure but the two diagnosed ones is a `HarnessStagingError` of
//   mode `module-channel` (helpers/permissions.ts) raised before any tool
//   runs: a harness error (H-11), never a pass, a product failure, or a skip
//   (H-9). A misuse of this module (a path that is no staging-relative path
//   of names) is a plain `Error`. Each examination is a harness step under
//   its own guard (TEST-SPEC S-3, helpers/step-guards.ts).

import { Buffer } from "node:buffer";
import type { Stats } from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fail } from "./assertions.js";
import type { NodeRelease } from "./node-releases.js";
import type { StagingMode } from "./permissions.js";
import { HarnessStagingError } from "./permissions.js";
import type { StagedNodeRun } from "./staging-isolation.js";
import {
  NODE_MODULES_NAME,
  PACKAGE_MANIFEST_NAME,
  verifyStagingIsolation,
} from "./staging-isolation.js";
import { guardStep } from "./step-guards.js";
import type { ProductBinding, RunResult } from "./subprocess.js";
import { rethrowHarnessError, runProduct } from "./subprocess.js";
import { copyTreeBytes } from "./tree-copy.js";

/** The staging mode every refusal of this module names. */
const MODE: StagingMode = "module-channel";

/** The prefix of every staging's directory under the OS temporary one. */
export const MODULE_STAGING_PREFIX = "xspec-module-staging-";

/** 7.6's limit on N's length, in characters. */
export const MODULE_NAME_MAX_LENGTH = 214;

/**
 * The canonical N's candidates (module header): fixed, unscoped, dot-free
 * names of 7.6's grammar, built in on no release, differing from `xspec`,
 * the executable's name, and from the names S-7's stub package and the
 * committed stand-ins give. The first differing from the manifest's name is
 * the canonical N.
 */
export const CANONICAL_MODULE_NAMES: readonly [string, string] = [
  "staged-config-module",
  "staged-config-module-alias",
];

const LF = String.fromCodePoint(0x0a);
const BACKSLASH = String.fromCodePoint(0x5c);
const BYTE_ORDER_MARK = String.fromCodePoint(0xfeff);

/** One of N's segments: 7.6's run of characters (module header). */
const NAME_SEGMENT = /^[a-z0-9][a-z0-9._-]*$/;

/** TEST-SPEC §7.6's Placement rule, closing a placement's refusal. */
const PLACEMENT_RULE =
  "the package directory, exactly as given, is installed by placement " +
  "alone — a copy at node_modules/N, or a symbolic link there to a copy " +
  "elsewhere in the staging under no node_modules — in a holding directory " +
  "that is the importing file's own or an ancestor and is not itself named " +
  "node_modules, under a name N of 7.6's grammar outside its exclusions " +
  "(TEST-SPEC §7.6 Placement; SPEC 7.6 Package and installation)";

/** Reach's rule, closing a refusal of a finished staging. */
const REACH_RULE =
  "every staging of the module channel meets Reach's four conditions — " +
  "nothing nearer, no self-reference, physical naming, and well-formed " +
  "manifests — before any tool runs: where a condition fails, 7.6 promises " +
  "nothing and no arm asserts anything there, so a staging failing one is a " +
  "harness defect, never a pass, a product failure, or a skip (TEST-SPEC " +
  "§7.6 Placement, H-11, H-9; SPEC 7.6 Reach)";

/** H-1's verification as it applies to the module channel's stagings. */
const ISOLATION_RULE =
  "an arm staging the defineConfig module runs only once the harness has " +
  "verified, under the environment TypeScript and Node.js run in — " +
  "TypeScript's current directory inside the staging, Node.js run with no " +
  "NODE_PATH and a fresh HOME — that no ancestor of the staging root holds a " +
  "package.json or a node_modules entry and that none of Node.js's global " +
  "module folders holds a package, an unmet precondition a harness error, " +
  "never a pass, a product failure, or a skip (TEST-SPEC H-1, H-11, H-9; " +
  "SPEC 7.6)";

/** The package directory's rule, closing a refusal of one. */
const PACKAGE_RULE =
  "the module channel is given the product's package directory beside the " +
  "executable as an absolute path naming a directory that holds exactly " +
  "what the package's distribution carries — plain files, directories, and " +
  "symbolic links, nothing installed into it, never a development tree " +
  "(an entry named node_modules at its root is refused as one) — which the " +
  "harness copies and never writes into (TEST-SPEC H-2, C-2, H-8; SPEC 7.6)";

// ---------------------------------------------------------------------------
// Arms and N
// ---------------------------------------------------------------------------

/**
 * What a staging serves: a type-checking arm (TypeScript's one route, on
 * which a built-in name is no exclusion), or a runtime arm on the releases
 * it runs (Node.js's routes, on which a name one of them resolves to a
 * built-in module is excluded).
 */
export type ModuleArm =
  | { readonly kind: "type-checking" }
  | { readonly kind: "runtime"; readonly releases: readonly NodeRelease[] };

/** The type-checking arm. */
export const TYPE_CHECKING_ARM: ModuleArm = Object.freeze({
  kind: "type-checking",
});

/** The runtime arm on `releases` (at least one). */
export function runtimeArm(releases: readonly NodeRelease[]): ModuleArm {
  if (releases.length === 0) {
    throw new Error(
      "module channel: a runtime arm runs on at least one Node.js release",
    );
  }
  return Object.freeze({ kind: "runtime", releases: [...releases] });
}

/**
 * Why `name` is not a name of 7.6's grammar (module header), or null when it
 * is one. Its exclusions are {@link moduleNameExclusion}'s and, on a runtime
 * arm, {@link builtInNamesOn}'s.
 */
export function moduleNameGrammarProblem(name: string): string | null {
  if (name.length > MODULE_NAME_MAX_LENGTH) {
    return (
      `is ${String(name.length)} characters long, past 7.6's limit of ` +
      `${String(MODULE_NAME_MAX_LENGTH)}`
    );
  }
  const segments = name.startsWith("@")
    ? splitScoped(name)
    : { scope: undefined, name };
  if (segments === undefined) {
    return "is a scope with no name after it: a scoped name is @scope/name";
  }
  if (segments.scope !== undefined && !NAME_SEGMENT.test(segments.scope)) {
    return `has the scope ${JSON.stringify(segments.scope)}, ${SEGMENT_RULE}`;
  }
  if (!NAME_SEGMENT.test(segments.name)) {
    return segments.scope === undefined
      ? `is ${SEGMENT_RULE}`
      : `has the name ${JSON.stringify(segments.name)} after its scope, ` +
          SEGMENT_RULE;
  }
  return null;
}

const SEGMENT_RULE =
  "not a non-empty run of lowercase ASCII letters, digits, -, ., and _ " +
  "beginning with a letter or digit (SPEC 7.6)";

/** `@scope/name` split at its first `/`, or undefined where it has none. */
function splitScoped(
  name: string,
): { readonly scope: string; readonly name: string } | undefined {
  const slash = name.indexOf("/");
  if (slash < 0) return undefined;
  return { scope: name.slice(1, slash), name: name.slice(slash + 1) };
}

/**
 * Which of 7.6's exclusions for every arm `name` falls under, or null: a
 * name in the `@types` scope, or an `@typescript` name beginning `lib-`.
 */
export function moduleNameExclusion(name: string): string | null {
  if (name.startsWith("@types/")) {
    return (
      "is a name in the @types scope, which TypeScript reserves for " +
      "declaration packages (SPEC 7.6)"
    );
  }
  if (name.startsWith("@typescript/lib-")) {
    return (
      "is a name in the @typescript scope beginning lib-, the form under " +
      "which TypeScript looks up replacements for its libraries (SPEC 7.6)"
    );
  }
  return null;
}

/** The canonical N for a package whose manifest gives `manifestName`. */
export function canonicalModuleName(manifestName: string | undefined): string {
  const [first, second] = CANONICAL_MODULE_NAMES;
  return manifestName === first ? second : first;
}

/**
 * Which of `names` — each a name of 7.6's grammar — `release` resolves to
 * one of its own built-in modules (module header), the release itself
 * asked: one run of it, through the subprocess driver under its own hang
 * guard, with no `NODE_OPTIONS` or `NODE_PATH`, evaluating
 * `require("node:module").isBuiltin` over the names, which reports exactly
 * the names `require` and `import` resolve to a built-in without the
 * `node:` scheme. A run that fails or answers otherwise than one boolean
 * per name leaves the exclusion unverified: `HarnessStagingError`.
 */
export async function builtInNamesOn(
  release: NodeRelease,
  names: readonly string[],
  context: string,
): Promise<ReadonlySet<string>> {
  for (const name of names) {
    const problem = moduleNameGrammarProblem(name);
    if (problem !== null) {
      throw new Error(
        `module channel: ${JSON.stringify(name)} ${problem}; only names of ` +
          `7.6's grammar are put to a release (${context})`,
      );
    }
  }
  const unverified = (detail: string): HarnessStagingError =>
    new HarnessStagingError(
      MODE,
      release.executable,
      `${context}: whether the Node.js release ${release.version} resolves ` +
        `${describeNames(names)} to built-in modules is unverified — ` +
        `${detail}; a runtime arm never stages a name its release resolves ` +
        `to a built-in module (TEST-SPEC §7.6 Placement; SPEC 7.6)`,
    );
  // The names are of 7.6's grammar, so their JSON spelling is a plain
  // string literal in the evaluated script.
  const script =
    `process.stdout.write(JSON.stringify(${JSON.stringify(names)}` +
    `.map((name) => require("node:module").isBuiltin(name))));`;
  const binding: ProductBinding = {
    label:
      `the Node.js release ${release.version} (${release.executable}), ` +
      `asked which names it resolves to built-in modules`,
    command: release.executable,
    requiredFiles: [release.executable],
  };
  let result: RunResult;
  try {
    result = await runProduct(binding, {
      cwd: os.tmpdir(),
      argv: ["--eval", script],
      env: { NODE_OPTIONS: undefined, NODE_PATH: undefined },
    });
  } catch (error) {
    rethrowHarnessError(error);
    throw unverified(`its run failed (${describeError(error)})`);
  }
  if (result.exitCode !== 0 || result.signal !== null || result.stderr !== "") {
    throw unverified(
      `its run ended with exit code ${String(result.exitCode)} and signal ` +
        `${String(result.signal)}, standard error ` +
        JSON.stringify(result.stderr.slice(0, 400)),
    );
  }
  let answers: unknown;
  try {
    answers = JSON.parse(result.stdout);
  } catch (error) {
    throw unverified(
      `its answer ${JSON.stringify(result.stdout.slice(0, 400))} is not ` +
        `JSON (${describeError(error)})`,
    );
  }
  if (
    !Array.isArray(answers) ||
    answers.length !== names.length ||
    !answers.every((answer) => typeof answer === "boolean")
  ) {
    throw unverified(
      `its answer ${JSON.stringify(result.stdout.slice(0, 400))} is not ` +
        `one boolean per name`,
    );
  }
  return new Set(names.filter((_name, index) => answers[index] === true));
}

/**
 * Verify that `name` is a name of 7.6's grammar outside its exclusions for
 * `arm` (module header): on every arm, no `@types` name and no
 * `@typescript/lib-` name; on a runtime arm, no name any of its releases
 * resolves to a built-in module, each release asked. Resolves when it is;
 * throws `HarnessStagingError` naming the rule it breaks otherwise.
 */
export async function verifyModuleName(
  name: string,
  arm: ModuleArm,
  context: string,
): Promise<void> {
  const refused = (detail: string): HarnessStagingError =>
    new HarnessStagingError(
      MODE,
      name,
      `${context}: the name ${JSON.stringify(name)} ${detail}; ` +
        PLACEMENT_RULE,
    );
  const problem = moduleNameGrammarProblem(name);
  if (problem !== null) throw refused(problem);
  const exclusion = moduleNameExclusion(name);
  if (exclusion !== null) throw refused(exclusion);
  if (arm.kind !== "runtime") return;
  const builtIn: string[] = [];
  for (const release of arm.releases) {
    const names = await builtInNamesOn(release, [name], context);
    if (names.has(name)) builtIn.push(release.version);
  }
  if (builtIn.length > 0) {
    throw refused(
      `is a name the Node.js release${builtIn.length === 1 ? "" : "s"} ` +
        `${builtIn.join(", ")} resolve${builtIn.length === 1 ? "s" : ""} ` +
        `to a built-in module, which a runtime arm never stages (SPEC 7.6: ` +
        `excluded from Node.js's resolution and the runtime contract)`,
    );
  }
}

/** Names, for a diagnosis. */
function describeNames(names: readonly string[]): string {
  const shown = names.slice(0, 5).map((name) => JSON.stringify(name));
  return names.length > 5
    ? `${shown.join(", ")}, and ${String(names.length - 5)} more`
    : shown.join(", ");
}

// ---------------------------------------------------------------------------
// The strict manifest reading
// ---------------------------------------------------------------------------

/**
 * A manifest read strictly (module header): well-formed, with its top-level
 * members as JSON gives them, or not, with what makes it so.
 */
export type ManifestReading =
  | {
      readonly wellFormed: true;
      readonly members: Readonly<Record<string, unknown>>;
    }
  | { readonly wellFormed: false; readonly problem: string };

/**
 * Judge a manifest's bytes strictly (module header): UTF-8 with no
 * byte-order mark, a JSON object, no member name repeated in any object it
 * holds, no string (member names included) escaping a lone surrogate, and
 * `name` and `type`, where present, strings.
 */
export function judgeManifestBytes(bytes: Uint8Array): ManifestReading {
  const refused = (problem: string): ManifestReading => ({
    wellFormed: false,
    problem,
  });
  let text: string;
  try {
    // `fatal`: an ill-formed sequence throws; `ignoreBOM`: a byte-order mark
    // is kept, so that it is seen and refused.
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    return refused("is not UTF-8");
  }
  if (text.startsWith(BYTE_ORDER_MARK)) {
    return refused("begins with a byte-order mark");
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return refused(`is not JSON (${describeError(error)})`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return refused(`holds ${describeJsonKind(value)}, not a JSON object`);
  }
  // JSON.parse has accepted the text, so the scan reads a valid document.
  const scanned = scanJsonStrings(text);
  if (scanned !== null) return refused(scanned);
  const members = value as Readonly<Record<string, unknown>>;
  for (const member of ["name", "type"]) {
    if (Object.hasOwn(members, member) && typeof members[member] !== "string") {
      return refused(
        `holds a ${JSON.stringify(member)} member that is ` +
          `${describeJsonKind(members[member])}, not a string`,
      );
    }
  }
  return { wellFormed: true, members };
}

/**
 * Read the manifest at `file` strictly (module header): undefined where no
 * entry occupies the path; else its reading, a manifest that is no readable
 * plain file (a symbolic link to one followed) refused unopened.
 */
export async function readManifestStrictly(
  file: string,
): Promise<ManifestReading | undefined> {
  const refused = (problem: string): ManifestReading => ({
    wellFormed: false,
    problem,
  });
  let stats: Stats;
  try {
    stats = await fsp.lstat(file);
  } catch (error) {
    if (isAbsence(error)) return undefined;
    return refused(`cannot be examined (${describeError(error)})`);
  }
  if (stats.isSymbolicLink()) {
    try {
      stats = await fsp.stat(file);
    } catch (error) {
      return refused(
        `is a symbolic link reaching nothing readable ` +
          `(${describeError(error)})`,
      );
    }
  }
  if (!stats.isFile()) {
    return refused(`is ${entryKind(stats)}, not a readable plain file`);
  }
  let bytes: Buffer;
  try {
    bytes = await fsp.readFile(file);
  } catch (error) {
    return refused(`cannot be read (${describeError(error)})`);
  }
  return judgeManifestBytes(bytes);
}

const QUOTE = 0x22;
const BACKSLASH_CODE = 0x5c;
const COLON = 0x3a;
const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;
const OPEN_BRACKET = 0x5b;
const CLOSE_BRACKET = 0x5d;
const LETTER_U = 0x75;

/** JSON's whitespace: tab, line feed, carriage return, and space. */
function isJsonWhitespace(code: number): boolean {
  return code === 0x09 || code === 0x0a || code === 0x0d || code === 0x20;
}

/** JSON's two-character escapes, each by its letter's code. */
const SIMPLE_ESCAPES: ReadonlyMap<number, string> = new Map([
  [QUOTE, String.fromCodePoint(QUOTE)],
  [BACKSLASH_CODE, BACKSLASH],
  [0x2f, "/"],
  [0x62, String.fromCodePoint(0x08)],
  [0x66, String.fromCodePoint(0x0c)],
  [0x6e, String.fromCodePoint(0x0a)],
  [0x72, String.fromCodePoint(0x0d)],
  [0x74, String.fromCodePoint(0x09)],
]);

/**
 * Scan a JSON text JSON.parse has accepted for what it lets through (module
 * header): a member name repeated in one object, compared as decoded, and a
 * string escaping a lone surrogate. The first found, or null.
 */
function scanJsonStrings(text: string): string | null {
  // One entry per open container: an object's member names, null for an
  // array.
  const containers: (Set<string> | null)[] = [];
  let index = 0;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code !== QUOTE) {
      if (code === OPEN_BRACE) containers.push(new Set());
      else if (code === OPEN_BRACKET) containers.push(null);
      else if (code === CLOSE_BRACE || code === CLOSE_BRACKET) {
        containers.pop();
      }
      index += 1;
      continue;
    }
    const string = readJsonString(text, index);
    if (string.loneSurrogate !== undefined) {
      return (
        `holds a string escaping the lone surrogate U+` +
        string.loneSurrogate.toString(16).toUpperCase().padStart(4, "0")
      );
    }
    let next = string.end;
    while (next < text.length && isJsonWhitespace(text.charCodeAt(next))) {
      next += 1;
    }
    const names = containers[containers.length - 1];
    if (text.charCodeAt(next) === COLON && names instanceof Set) {
      if (names.has(string.value)) {
        return `repeats the member name ${JSON.stringify(string.value)} in one object`;
      }
      names.add(string.value);
    }
    index = string.end;
  }
  return null;
}

/**
 * The JSON string opening at `start` (its quote): its decoded value, the
 * index past its closing quote, and the first lone surrogate it escapes —
 * a high surrogate's escape not followed at once by a low surrogate's, or a
 * low surrogate's escape not preceded by a high one's.
 */
function readJsonString(
  text: string,
  start: number,
): {
  readonly value: string;
  readonly end: number;
  readonly loneSurrogate: number | undefined;
} {
  const parts: string[] = [];
  let lone: number | undefined;
  let index = start + 1;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code === QUOTE) {
      return { value: parts.join(""), end: index + 1, loneSurrogate: lone };
    }
    if (code !== BACKSLASH_CODE) {
      parts.push(text.charAt(index));
      index += 1;
      continue;
    }
    const letter = text.charCodeAt(index + 1);
    if (letter !== LETTER_U) {
      parts.push(SIMPLE_ESCAPES.get(letter) ?? "");
      index += 2;
      continue;
    }
    const unit = Number.parseInt(text.slice(index + 2, index + 6), 16);
    index += 6;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      if (
        text.charCodeAt(index) === BACKSLASH_CODE &&
        text.charCodeAt(index + 1) === LETTER_U
      ) {
        const low = Number.parseInt(text.slice(index + 2, index + 6), 16);
        if (low >= 0xdc00 && low <= 0xdfff) {
          parts.push(String.fromCharCode(unit, low));
          index += 6;
          continue;
        }
      }
      lone ??= unit;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      lone ??= unit;
    }
    parts.push(String.fromCharCode(unit));
  }
  return { value: parts.join(""), end: text.length, loneSurrogate: lone };
}

/**
 * The name a package's manifest gives (module header): `name`, exactly as
 * spelled, where its `package.json` reads as a well-formed manifest holding
 * a string `name`; otherwise undefined, `detail` saying why.
 */
export interface ManifestName {
  readonly name: string | undefined;
  /** Why the manifest gives no name; empty where it gives one. */
  readonly detail: string;
}

/**
 * Read the name the manifest of the package directory `packageDir` gives
 * (T7.6-4(a), T7-9(d); module header): by parsing its `package.json` and
 * nothing else, strictly. One harness step under its own guard.
 */
export async function readManifestName(
  packageDir: string,
): Promise<ManifestName> {
  const file = path.join(packageDir, PACKAGE_MANIFEST_NAME);
  const reading = await guardStep(
    `reading the name the manifest ${file} gives (readManifestName)`,
    () => readManifestStrictly(file),
  );
  if (reading === undefined) {
    return { name: undefined, detail: `${file} is absent` };
  }
  if (!reading.wellFormed) {
    return { name: undefined, detail: `${file} ${reading.problem}` };
  }
  const name = reading.members["name"];
  return typeof name === "string"
    ? { name, detail: "" }
    : { name: undefined, detail: `${file} holds no name member` };
}

// ---------------------------------------------------------------------------
// The package directory
// ---------------------------------------------------------------------------

/** One entry of a package directory as read, never followed. */
export type PackageEntry =
  | { readonly kind: "file"; readonly mode: number; readonly bytes: Buffer }
  | { readonly kind: "directory"; readonly mode: number }
  | { readonly kind: "symlink"; readonly target: Buffer };

/**
 * A package directory, or a copy of one, as read (module header): the
 * directory's own permission bits, and each entry below it by its relative
 * path's exact bytes (`/`-separated, latin1-encoded), in byte order.
 */
export interface PackageTree {
  readonly mode: number;
  readonly entries: ReadonlyMap<string, PackageEntry>;
}

/** The package directory a binding gives, checked (module header). */
export interface PackageDirectory {
  /** The directory, exactly as the binding gives it. */
  readonly path: string;
  /** What it held when checked. */
  readonly tree: PackageTree;
  /** The name its manifest gives ({@link readManifestName}). */
  readonly manifestName: ManifestName;
}

/**
 * The package directory `binding` gives beside its executable, checked
 * before anything is staged (module header; TEST-SPEC H-2, H-8, C-2). None
 * given — and, on the built product's binding, a path that does not exist
 * — is H-8's missing product: a diagnosed assertion failure declining
 * shrinking, nothing staged. A relative path, a path naming no directory
 * on any other binding, anything but a directory, an unreadable one, an
 * entry of another kind than a plain file, a directory, or a symbolic link,
 * and an entry named `node_modules` at its root (the development tree) are
 * `HarnessStagingError`s. Never writes into it.
 */
export async function modulePackageDirectory(
  binding: ProductBinding,
  context: string,
): Promise<PackageDirectory> {
  const given = binding.packageDir;
  if (given === undefined) {
    const executable = [binding.command, ...(binding.prefixArgs ?? [])];
    fail(
      `${context}: ${binding.label}: no package directory is given beside ` +
        `the executable (${executable.join(" ")}) — the module channel ` +
        `counts as part of the product, ` +
        `so every test of 7.6 fails here, diagnosed (TEST-SPEC H-8, C-2; ` +
        `H-2's module channel). Give the directory ` +
        `.github/scripts/pack-package.sh prints as XSPEC_PACKAGE_DIR ` +
        `(AGENTS.md). Nothing was staged.`,
      { shrinkable: false },
    );
  }
  const refused = (detail: string): HarnessStagingError =>
    new HarnessStagingError(
      MODE,
      given,
      `${context}: ${binding.label}: the package directory ` +
        `${JSON.stringify(given)} ${detail}; ${PACKAGE_RULE}`,
    );
  if (!path.isAbsolute(given)) {
    throw refused(
      "is not an absolute path: a package directory is never resolved " +
        "against the working directory",
    );
  }
  const examined = await guardStep(
    `examining the package directory ${given} (${context})`,
    async () => {
      try {
        return { stats: await fsp.stat(given) };
      } catch (error) {
        return { error };
      }
    },
  );
  if ("error" in examined) {
    if (
      isAbsence(examined.error) &&
      binding.missingFilesFailDiagnosed === true
    ) {
      fail(
        `${context}: ${binding.label}: the package directory ${given} does ` +
          `not exist (${describeError(examined.error)}) — the product's ` +
          `package is not installed beside it, so every test of 7.6 fails ` +
          `here, diagnosed (TEST-SPEC H-8). Pack it with ` +
          ".github/scripts/pack-package.sh after `npm run build` " +
          `(AGENTS.md). Nothing was staged.`,
        { shrinkable: false },
      );
    }
    throw refused(
      isAbsence(examined.error)
        ? `does not exist (${describeError(examined.error)}): only the ` +
            `built product's missing package is H-8's diagnosed missing ` +
            `product, and any other binding's is a defect in the harness`
        : `cannot be examined (${describeError(examined.error)})`,
    );
  }
  if (!examined.stats.isDirectory()) {
    throw refused(`is ${entryKind(examined.stats)}, not a directory`);
  }
  const tree = await readPackageTree(given, context, refused, {
    refuseInstalled: true,
  });
  return Object.freeze({
    path: given,
    tree,
    manifestName: Object.freeze(await readManifestName(given)),
  });
}

/**
 * Read the package directory, or copy, at `root` (module header): its own
 * mode, and every entry below it, never followed. An entry of another kind
 * than a plain file, a directory, or a symbolic link, a failed read, and —
 * with `refuseInstalled` — an entry named `node_modules` at its root, of
 * any kind, are `refused`. One harness step under its own guard.
 */
export async function readPackageTree(
  root: string,
  context: string,
  refused: (detail: string) => HarnessStagingError,
  options: { readonly refuseInstalled?: boolean } = {},
): Promise<PackageTree> {
  return guardStep(
    `reading the package tree at ${root} (${context})`,
    async () => {
      const entries = new Map<string, PackageEntry>();
      let mode: number;
      try {
        mode = (await fsp.stat(root)).mode & 0o7777;
      } catch (error) {
        throw refused(`cannot be examined (${describeError(error)})`);
      }
      const walk = async (
        directory: Buffer,
        relative: Buffer,
      ): Promise<void> => {
        let names: Buffer[];
        try {
          names = await fsp.readdir(directory, { encoding: "buffer" });
        } catch (error) {
          throw refused(
            `holds the directory ${directory.toString()} that cannot be ` +
              `listed (${describeError(error)})`,
          );
        }
        names.sort(Buffer.compare);
        for (const name of names) {
          const childRelative =
            relative.length === 0
              ? name
              : Buffer.concat([relative, Buffer.from("/"), name]);
          const child = Buffer.concat([directory, Buffer.from("/"), name]);
          const shown = childRelative.toString();
          if (
            options.refuseInstalled === true &&
            relative.length === 0 &&
            name.equals(Buffer.from(NODE_MODULES_NAME))
          ) {
            throw refused(
              `holds an entry named ${NODE_MODULES_NAME} at its root — a ` +
                `development tree's installed dependencies, which would ` +
                `resolve inside a placed copy; a distribution carries none ` +
                `(TEST-SPEC H-2: never a development tree)`,
            );
          }
          let stats: Stats;
          try {
            stats = await fsp.lstat(child);
          } catch (error) {
            throw refused(
              `holds ${shown}, which cannot be examined ` +
                `(${describeError(error)})`,
            );
          }
          const key = childRelative.toString("latin1");
          if (stats.isSymbolicLink()) {
            entries.set(key, {
              kind: "symlink",
              target: await fsp.readlink(child, { encoding: "buffer" }),
            });
          } else if (stats.isDirectory()) {
            entries.set(key, { kind: "directory", mode: stats.mode & 0o7777 });
            await walk(child, childRelative);
          } else if (stats.isFile()) {
            let bytes: Buffer;
            try {
              bytes = await fsp.readFile(child);
            } catch (error) {
              throw refused(
                `holds the file ${shown}, which cannot be read ` +
                  `(${describeError(error)})`,
              );
            }
            entries.set(key, {
              kind: "file",
              mode: stats.mode & 0o7777,
              bytes,
            });
          } else {
            throw refused(
              `holds ${shown}, ${entryKind(stats)} — neither a plain file, a ` +
                `directory, nor a symbolic link, which no distribution carries`,
            );
          }
        }
      };
      await walk(Buffer.from(root), Buffer.alloc(0));
      return Object.freeze({ mode, entries });
    },
  );
}

/**
 * How `actual` differs from `expected` (two package trees): the first few
 * differences — an entry added, removed, or changed in kind, mode, bytes,
 * or target, or the directory's own mode — or null where they are equal.
 */
export function describeTreeDifference(
  expected: PackageTree,
  actual: PackageTree,
): string | null {
  const differences: string[] = [];
  if (expected.mode !== actual.mode) {
    differences.push(
      `the directory's own mode is ${octal(actual.mode)}, not ` +
        octal(expected.mode),
    );
  }
  const keys = [
    ...new Set([...expected.entries.keys(), ...actual.entries.keys()]),
  ];
  keys.sort((left, right) =>
    Buffer.compare(Buffer.from(left, "latin1"), Buffer.from(right, "latin1")),
  );
  for (const key of keys) {
    const shown = Buffer.from(key, "latin1").toString();
    const was = expected.entries.get(key);
    const is = actual.entries.get(key);
    if (was === undefined) differences.push(`${shown} is added`);
    else if (is === undefined) differences.push(`${shown} is missing`);
    else {
      const change = describeEntryChange(was, is);
      if (change !== null) differences.push(`${shown} ${change}`);
    }
  }
  if (differences.length === 0) return null;
  const shown = differences.slice(0, 5).join("; ");
  return differences.length > 5
    ? `${shown}; and ${String(differences.length - 5)} more`
    : shown;
}

/** How one entry changed, or null where it did not. */
function describeEntryChange(
  was: PackageEntry,
  is: PackageEntry,
): string | null {
  if (was.kind !== is.kind) return `is a ${is.kind}, not a ${was.kind}`;
  if (was.kind === "symlink" && is.kind === "symlink") {
    return was.target.equals(is.target)
      ? null
      : `links to ${JSON.stringify(is.target.toString())}, not ` +
          JSON.stringify(was.target.toString());
  }
  if (was.kind === "directory" && is.kind === "directory") {
    return was.mode === is.mode
      ? null
      : `has mode ${octal(is.mode)}, not ${octal(was.mode)}`;
  }
  if (was.kind === "file" && is.kind === "file") {
    if (was.mode !== is.mode) {
      return `has mode ${octal(is.mode)}, not ${octal(was.mode)}`;
    }
    return was.bytes.equals(is.bytes)
      ? null
      : `holds ${String(is.bytes.length)} bytes differing from the ` +
          `${String(was.bytes.length)} read before`;
  }
  return null;
}

function octal(mode: number): string {
  return `0${mode.toString(8).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Stagings
// ---------------------------------------------------------------------------

/**
 * The three project kinds (module header; SPEC 7.6 Covered setups): an
 * ES-module project, its `package.json` holding `"type": "module"`; a
 * CommonJS project whose `package.json` holds no `type` member; and a
 * CommonJS project with no `package.json` at all.
 */
export type ProjectKind = "es-module" | "commonjs" | "no-manifest";

/** Every project kind, in TEST-SPEC §7.6's order. */
export const PROJECT_KINDS: readonly ProjectKind[] = [
  "es-module",
  "commonjs",
  "no-manifest",
];

/** The manifest a project kind's directory holds, or undefined for none. */
function projectManifest(kind: ProjectKind): string | undefined {
  switch (kind) {
    case "es-module":
      return `${JSON.stringify({ type: "module" }, null, 2)}${LF}`;
    case "commonjs":
      return `${JSON.stringify({})}${LF}`;
    case "no-manifest":
      return undefined;
  }
}

/** A copy at `node_modules/N`, or a symbolic link there to a copy. */
export type PlacementForm = "copy" | "symlink";

/** One placement a staging is asked for ({@link ModuleStaging.place}). */
export interface PlacementRequest {
  /** N: a name of 7.6's grammar outside its exclusions for `arm`. */
  readonly name: string;
  /** The holding directory, staging-relative (`""` for the root). */
  readonly holdingDir: string;
  /** The arm the staging serves ({@link ModuleArm}). */
  readonly arm: ModuleArm;
  /** A copy (the default), or a symbolic link to a copy at `copyDir`. */
  readonly form?: PlacementForm;
  /**
   * For a symbolic-link placement: where its copy lies, staging-relative,
   * under no `node_modules` — `placed-copies/copy-<k>` unless given.
   */
  readonly copyDir?: string;
}

/** A placement made ({@link ModuleStaging.place}). */
export interface Placement {
  /** N. */
  readonly name: string;
  /** The holding directory, absolute and physical. */
  readonly holdingDir: string;
  /** `<holdingDir>/node_modules/N`. */
  readonly path: string;
  readonly form: PlacementForm;
  /** The copy: `path` itself, or the directory a symbolic link reaches. */
  readonly copy: string;
}

/** One importing file's staging, as Reach is checked on it. */
export interface ReachStaging {
  /** The importing file, staging-relative, by its physical path. */
  readonly importingFile: string;
  /** The placement its import reaches. */
  readonly placement: Placement;
  /** The project kind the staging declares, confirmed where given. */
  readonly project?: ProjectKind;
  /**
   * Whether nothing but `placement` is installed in the staging (the
   * canonical placement's "nothing else installed"), confirmed where set.
   */
  readonly alone?: boolean;
}

/** {@link ModuleStaging.create}'s options. */
export interface ModuleStagingOptions {
  /**
   * The directory the staging is made in: the OS temporary directory unless
   * given — a self-test's probe directory alone gives one.
   */
  readonly parent?: string;
}

/**
 * A fresh staging of the module channel (module header): made only once
 * the binding's package directory is checked, at its physical path, its
 * ancestors verified by H-1; placements, the three project kinds, and Reach
 * checked on the finished staging. Dispose of it once its arm is done.
 */
export class ModuleStaging {
  /** The staging's root: absolute and physical. */
  readonly root: string;
  /** The package directory placed here, as checked. */
  readonly package: PackageDirectory;
  /** Leads every diagnosis: the arm the staging serves. */
  readonly context: string;
  readonly #placements: Placement[] = [];
  #copies = 0;
  #disposed = false;

  private constructor(root: string, pkg: PackageDirectory, context: string) {
    this.root = root;
    this.package = pkg;
    this.context = context;
  }

  /**
   * Check `binding`'s package directory ({@link modulePackageDirectory}:
   * none given fails diagnosed, before anything is staged), then make a
   * fresh staging under the OS temporary directory (or `options.parent`),
   * at its physical path, and verify H-1's ancestor half on it. A failed
   * verification removes the staging and throws `HarnessStagingError`.
   */
  static async create(
    binding: ProductBinding,
    context: string,
    options: ModuleStagingOptions = {},
  ): Promise<ModuleStaging> {
    const pkg = await modulePackageDirectory(binding, context);
    const parent = options.parent ?? os.tmpdir();
    const made = await guardStep(
      `creating a fresh module-channel staging under ${parent} (${context})`,
      () => fsp.mkdtemp(path.join(parent, MODULE_STAGING_PREFIX)),
    );
    try {
      const root = await guardStep(
        `reading the physical path of the staging ${made} (${context})`,
        () => fsp.realpath(made),
      );
      const staging = new ModuleStaging(root, pkg, context);
      await staging.verifyIsolation();
      return staging;
    } catch (error) {
      await removeTree(made, context);
      throw error;
    }
  }

  /** The canonical N for this staging's package ({@link canonicalModuleName}). */
  get canonicalName(): string {
    return canonicalModuleName(this.package.manifestName.name);
  }

  /**
   * The absolute path of `rel`, a staging-relative path of names separated
   * by `/` (`""` or `"."` for the root); anything else is a usage error.
   */
  path(rel: string): string {
    if (rel === "" || rel === ".") return this.root;
    const names = rel.split("/");
    if (
      path.isAbsolute(rel) ||
      names.some((name) => name === "" || name === "." || name === "..")
    ) {
      throw new Error(
        `module channel: ${JSON.stringify(rel)} is no staging-relative path ` +
          `of names separated by / (${this.context})`,
      );
    }
    return path.join(this.root, ...names);
  }

  /** Write `contents` at `rel`, never over an entry, creating its parents. */
  async writeFile(rel: string, contents: string | Uint8Array): Promise<string> {
    const target = this.path(rel);
    this.#refuseInsidePlacement(target, "the file");
    await guardStep(`writing ${target} (${this.context})`, async () => {
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.writeFile(target, contents, { flag: "wx" });
    });
    return target;
  }

  /** Make the directory `rel`, and its parents. */
  async makeDirectory(rel: string): Promise<string> {
    const target = this.path(rel);
    this.#refuseInsidePlacement(target, "the directory");
    await guardStep(`making the directory ${target} (${this.context})`, () =>
      fsp.mkdir(target, { recursive: true }),
    );
    return target;
  }

  /**
   * Make a symbolic link at `rel` to `targetRel`, both staging-relative, the
   * link naming its target's absolute path, so it never reaches outside the
   * staging.
   */
  async link(rel: string, targetRel: string): Promise<string> {
    const at = this.path(rel);
    const target = this.path(targetRel);
    this.#refuseInsidePlacement(at, "the symbolic link");
    await guardStep(
      `linking ${at} to ${target} (${this.context})`,
      async () => {
        await fsp.mkdir(path.dirname(at), { recursive: true });
        await fsp.symlink(target, at);
      },
    );
    return at;
  }

  /**
   * Stage a project of `kind` in the directory `rel` (module header): its
   * `package.json` for an ES-module or a CommonJS project, none for the
   * third kind. Returns the directory's absolute path.
   */
  async stageProject(rel: string, kind: ProjectKind): Promise<string> {
    const directory = this.path(rel);
    this.#refuseInsidePlacement(directory, "the project directory");
    const manifest = projectManifest(kind);
    await guardStep(
      `staging ${kind} project at ${directory} (${this.context})`,
      async () => {
        await fsp.mkdir(directory, { recursive: true });
        if (manifest !== undefined) {
          await fsp.writeFile(
            path.join(directory, PACKAGE_MANIFEST_NAME),
            manifest,
            { flag: "wx" },
          );
        }
      },
    );
    return directory;
  }

  /**
   * Place the package directory under `request.name` in the holding
   * directory `request.holdingDir` (module header): N verified for the arm
   * ({@link verifyModuleName}), a copy made entry by entry at
   * `node_modules/N`, or at `copyDir` with a symbolic link to it at
   * `node_modules/N`, each copy read back equal to the package as checked.
   * A holding directory named `node_modules`, a copy under one, an occupied
   * path, and a copy that differs are `HarnessStagingError`s.
   */
  async place(request: PlacementRequest): Promise<Placement> {
    const form = request.form ?? "copy";
    const holdingDir = this.path(request.holdingDir);
    const placementPath = path.join(
      holdingDir,
      NODE_MODULES_NAME,
      ...request.name.split("/"),
    );
    const context = `${this.context}, placing the package at ${placementPath}`;
    await verifyModuleName(request.name, request.arm, context);
    const refused = (detail: string): HarnessStagingError =>
      new HarnessStagingError(
        MODE,
        placementPath,
        `${context}: ${detail}; ${PLACEMENT_RULE}`,
      );
    if (path.basename(holdingDir) === NODE_MODULES_NAME) {
      throw refused(
        `the holding directory ${holdingDir} is itself named ` +
          `${NODE_MODULES_NAME}, a directory TypeScript's lookup and ` +
          `require's skip`,
      );
    }
    this.#refuseInsidePlacement(holdingDir, "the holding directory");
    if (form === "copy" && request.copyDir !== undefined) {
      throw new Error(
        `module channel: copyDir names where a symbolic-link placement's ` +
          `copy lies; a copy placement lies at node_modules/N (${context})`,
      );
    }
    let copy = placementPath;
    if (form === "symlink") {
      this.#copies += 1;
      const copyRel =
        request.copyDir ?? `placed-copies/copy-${String(this.#copies)}`;
      if (copyRel.split("/").includes(NODE_MODULES_NAME)) {
        throw refused(
          `the copy a symbolic-link placement reaches, ${copyRel}, lies ` +
            `under a directory named ${NODE_MODULES_NAME}: it lies elsewhere ` +
            `in the staging, under no ${NODE_MODULES_NAME}`,
        );
      }
      copy = this.path(copyRel);
      this.#refuseInsidePlacement(copy, "the linked copy");
    }
    const occupied = await guardStep(
      `making room for ${placementPath} (${context})`,
      async () => {
        await fsp.mkdir(path.dirname(placementPath), { recursive: true });
        await fsp.mkdir(path.dirname(copy), { recursive: true });
        const taken: string[] = [];
        for (const target of new Set([placementPath, copy])) {
          if ((await lstatOrAbsent(target)) !== undefined) taken.push(target);
        }
        return taken;
      },
    );
    if (occupied.length > 0) {
      throw refused(`${occupied.join(" and ")} is occupied already`);
    }
    await this.#copyPackageTo(copy, context, refused);
    if (form === "symlink") {
      await guardStep(`linking ${placementPath} to ${copy} (${context})`, () =>
        fsp.symlink(copy, placementPath),
      );
    }
    const placement: Placement = Object.freeze({
      name: request.name,
      holdingDir,
      path: placementPath,
      form,
      copy,
    });
    this.#placements.push(placement);
    return placement;
  }

  /**
   * The canonical placement (TEST-SPEC §7.6 Placement): a copy at
   * `node_modules/N` in the holding directory `holdingDir` — the importing
   * file's own — N {@link canonicalName}.
   */
  async placeCanonical(holdingDir: string, arm: ModuleArm): Promise<Placement> {
    return this.place({ name: this.canonicalName, holdingDir, arm });
  }

  /**
   * Verify H-1's isolation of the staging (helpers/staging-isolation.ts):
   * its ancestor half, and, given a Node.js run's exact environment,
   * working directory, and release executables, its global half.
   */
  async verifyIsolation(run?: StagedNodeRun): Promise<void> {
    await verifyStagingIsolation({
      root: this.root,
      role: "the module channel's staging",
      context: this.context,
      mode: MODE,
      rule: ISOLATION_RULE,
      ...(run === undefined ? {} : { run }),
    });
  }

  /** Remove the staging, its placements included; idempotent. */
  async dispose(): Promise<void> {
    if (this.#disposed) return;
    this.#disposed = true;
    await removeTree(this.root, this.context);
  }

  /** Copy the package directory to the new directory `destination`. */
  async #copyPackageTo(
    destination: string,
    context: string,
    refused: (detail: string) => HarnessStagingError,
  ): Promise<void> {
    await guardStep(`creating ${destination} (${context})`, () =>
      fsp.mkdir(destination),
    );
    await copyTreeBytes(
      Buffer.from(this.package.path),
      Buffer.from(destination),
    );
    await guardStep(
      `giving ${destination} the package directory's mode (${context})`,
      () => fsp.chmod(destination, this.package.tree.mode),
    );
    const copied = await readPackageTree(destination, context, (detail) =>
      refused(`the copy at ${destination} ${detail}`),
    );
    const difference = describeTreeDifference(this.package.tree, copied);
    if (difference !== null) {
      throw refused(
        `the copy at ${destination} differs from the package directory ` +
          `${this.package.path} as read before anything was staged: ` +
          difference,
      );
    }
  }

  /** Refuse a staging write at or below a placement or its copy (H-2). */
  #refuseInsidePlacement(target: string, what: string): void {
    for (const placement of this.#placements) {
      for (const placed of new Set([placement.path, placement.copy])) {
        if (target === placed || target.startsWith(`${placed}${path.sep}`)) {
          throw new HarnessStagingError(
            MODE,
            target,
            `${this.context}: ${what} ${target} lies in the placed copy ` +
              `${placed}: nothing is installed into the package directory, ` +
              `exactly as distributed, after its placement (TEST-SPEC H-2, ` +
              `§7.6 Placement)`,
          );
        }
      }
    }
  }

  /**
   * Verify Reach's four conditions for one importing file on the finished
   * staging, before any tool runs (module header): physical naming, the
   * placement in place in a holding directory that is the file's own or an
   * ancestor along its physical path, nothing nearer, no self-reference,
   * and well-formed manifests; and, where `reach` declares them, the project
   * kind and that nothing but the placement is installed in the staging.
   * Resolves when every one holds; throws `HarnessStagingError` naming the
   * first that fails. One harness step under its own guard.
   */
  async verifyReach(reach: ReachStaging): Promise<void> {
    const importingFile = this.path(reach.importingFile);
    const refused = (detail: string): HarnessStagingError =>
      new HarnessStagingError(
        MODE,
        importingFile,
        `${this.context}: the staging of the importing file ${importingFile} ` +
          `${detail}; ${REACH_RULE}`,
      );
    await guardStep(
      `verifying Reach for ${importingFile} (${this.context})`,
      async () => {
        await verifyPlacementReached(importingFile, reach.placement, refused);
        await verifyNothingNearer(importingFile, reach.placement, refused);
        await verifyManifests(
          importingFile,
          reach.placement.name,
          reach.project,
          refused,
        );
        if (reach.alone === true) {
          await this.#verifyAlone(reach.placement, refused);
        }
      },
    );
  }

  /**
   * The canonical placement's "nothing else installed" (module header):
   * within the staging, read without following a link or entering a placed
   * copy, the only entry named `node_modules` is the placement's holding
   * directory's, holding the placement alone (a scoped one, its scope's
   * directory holding it alone).
   */
  async #verifyAlone(
    placement: Placement,
    refused: (detail: string) => HarnessStagingError,
  ): Promise<void> {
    const expected = path.join(placement.holdingDir, NODE_MODULES_NAME);
    const skipped = new Set(
      this.#placements.flatMap((placed) => [placed.path, placed.copy]),
    );
    const found: string[] = [];
    const walk = async (directory: string): Promise<void> => {
      for (const entry of await fsp.readdir(directory, {
        withFileTypes: true,
      })) {
        const child = path.join(directory, entry.name);
        if (skipped.has(child)) continue;
        if (entry.name === NODE_MODULES_NAME) found.push(child);
        if (entry.isDirectory()) await walk(child);
      }
    };
    await walk(this.root);
    const others = found.filter((entry) => entry !== expected);
    if (others.length > 0) {
      throw refused(
        `is declared to have nothing but its placement ${placement.path} ` +
          `installed, yet ${describePaths(others)} ${others.length === 1 ? "is an entry" : "are entries"} named ` +
          `${NODE_MODULES_NAME} too (TEST-SPEC §7.6 Placement: nothing ` +
          `else installed anywhere TypeScript or Node.js looks)`,
      );
    }
    const scoped = placement.name.startsWith("@")
      ? splitScoped(placement.name)
      : undefined;
    const levels: [string, string][] =
      scoped === undefined
        ? [[expected, placement.name]]
        : [
            [expected, `@${scoped.scope}`],
            [path.join(expected, `@${scoped.scope}`), scoped.name],
          ];
    for (const [directory, only] of levels) {
      const names = (await fsp.readdir(directory)).sort();
      if (names.length !== 1 || names[0] !== only) {
        throw refused(
          `is declared to have nothing but its placement ${placement.path} ` +
            `installed, yet ${directory} holds ${JSON.stringify(names)} ` +
            `(TEST-SPEC §7.6 Placement: nothing else installed anywhere ` +
            `TypeScript or Node.js looks)`,
        );
      }
    }
  }
}

/**
 * Physical naming, and the placement in place (module header): the
 * importing file a plain file named by its physical path; the holding
 * directory the file's own or an ancestor along that path, not itself
 * named `node_modules`; the placement a directory there, or a symbolic link
 * reaching its copy, a directory under no `node_modules`.
 */
async function verifyPlacementReached(
  importingFile: string,
  placement: Placement,
  refused: (detail: string) => HarnessStagingError,
): Promise<void> {
  let physical: string;
  try {
    physical = await fsp.realpath(importingFile);
  } catch (error) {
    throw refused(
      `fails physical naming: the file's physical path cannot be read ` +
        `(${describeError(error)})`,
    );
  }
  if (physical !== importingFile) {
    throw refused(
      `fails physical naming: the path given reaches the file through a ` +
        `symbolic link, its physical path being ${physical} — TypeScript is ` +
        `given the importing file by its physical path, and Node.js loads it ` +
        `by that path (SPEC 7.6 Reach)`,
    );
  }
  const stats = await fsp.lstat(importingFile);
  if (!stats.isFile()) {
    throw refused(
      `fails physical naming: it is ${entryKind(stats)}, not a plain file`,
    );
  }
  const directory = path.dirname(importingFile);
  const holding = placement.holdingDir;
  if (directory !== holding && !directory.startsWith(`${holding}${path.sep}`)) {
    throw refused(
      `has the placement ${placement.path} in the holding directory ` +
        `${holding}, which is neither the importing file's directory nor one ` +
        `of its ancestors along its physical path (SPEC 7.6 Package and ` +
        `installation)`,
    );
  }
  if (path.basename(holding) === NODE_MODULES_NAME) {
    throw refused(
      `has its holding directory ${holding} named ${NODE_MODULES_NAME} ` +
        `(SPEC 7.6 Package and installation)`,
    );
  }
  const placed = await lstatOrAbsent(placement.path);
  if (placement.form === "copy") {
    if (placed?.isDirectory() !== true) {
      throw refused(
        `has no copy of the package at its placement ${placement.path} ` +
          `(${placed === undefined ? "absent" : entryKind(placed)})`,
      );
    }
    return;
  }
  if (placed?.isSymbolicLink() !== true) {
    throw refused(
      `has no symbolic link at its placement ${placement.path} ` +
        `(${placed === undefined ? "absent" : entryKind(placed)})`,
    );
  }
  const reached = await fsp.realpath(placement.path).catch(() => undefined);
  const copy = await fsp.realpath(placement.copy).catch(() => undefined);
  if (
    reached === undefined ||
    reached !== copy ||
    !(await fsp.stat(reached)).isDirectory() ||
    reached.split(path.sep).includes(NODE_MODULES_NAME)
  ) {
    throw refused(
      `has its placement ${placement.path} reach ${String(reached)}, not ` +
        `its copy ${placement.copy}, a directory under no ` +
        `${NODE_MODULES_NAME} (SPEC 7.6 Package and installation)`,
    );
  }
}

/**
 * Nothing nearer (SPEC 7.6 Reach): in the holding directory, no entry but
 * the placement occupies a path beginning `node_modules/S.`; in every
 * directory from the importing file's own up to, excluding, the holding
 * directory, none occupies `node_modules/N` or `node_modules/D`, or a path
 * beginning `node_modules/S.` or `node_modules/T.`.
 */
async function verifyNothingNearer(
  importingFile: string,
  placement: Placement,
  refused: (detail: string) => HarnessStagingError,
): Promise<void> {
  const names = lookupNamesOf(placement.name);
  const nearer: string[] = [];
  const holdingModules = path.join(placement.holdingDir, NODE_MODULES_NAME);
  for (const entry of await entriesBeginning(
    holdingModules,
    names.s,
    refused,
  )) {
    if (entry !== placement.path) nearer.push(entry);
  }
  let directory = path.dirname(importingFile);
  while (directory !== placement.holdingDir) {
    const modules = path.join(directory, NODE_MODULES_NAME);
    for (const exact of [placement.name, names.d]) {
      const entry = path.join(modules, ...exact.split("/"));
      if ((await lstatOrAbsent(entry)) !== undefined) nearer.push(entry);
    }
    nearer.push(...(await entriesBeginning(modules, names.s, refused)));
    nearer.push(...(await entriesBeginning(modules, names.t, refused)));
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  if (nearer.length > 0) {
    throw refused(
      `fails Reach's nothing-nearer condition for N ` +
        `${JSON.stringify(placement.name)} (S ${JSON.stringify(names.s)}, D ` +
        `${JSON.stringify(names.d)}, T ${JSON.stringify(names.t)}): ` +
        `${describePaths(nearer)} ${nearer.length === 1 ? "lies" : "lie"} ` +
        `nearer than the placement ${placement.path}`,
    );
  }
}

/**
 * `S`, `D`, and `T` for N (SPEC 7.6 Reach): `S` N cut before the first `.`
 * of its last segment; `D` the name under which TypeScript looks up
 * declarations for N (`@types/N`, `@types/scope__name` for `@scope/name`);
 * `T` `D` cut the same way.
 */
function lookupNamesOf(name: string): {
  readonly s: string;
  readonly d: string;
  readonly t: string;
} {
  const scoped = name.startsWith("@") ? splitScoped(name) : undefined;
  const s =
    scoped === undefined
      ? cutAtDot(name)
      : `@${scoped.scope}/${cutAtDot(scoped.name)}`;
  const typed = scoped === undefined ? name : `${scoped.scope}__${scoped.name}`;
  return { s, d: `@types/${typed}`, t: `@types/${cutAtDot(typed)}` };
}

/** A segment cut before its first `.`, or the segment where it has none. */
function cutAtDot(segment: string): string {
  const dot = segment.indexOf(".");
  return dot < 0 ? segment : segment.slice(0, dot);
}

/**
 * The entries of the `node_modules` directory `modules` whose paths begin
 * `node_modules/<prefix>.` (a scoped prefix read inside its scope's
 * directory), each as an absolute path. An absent directory holds none; a
 * listing failing otherwise leaves the condition unverified.
 */
async function entriesBeginning(
  modules: string,
  prefix: string,
  refused: (detail: string) => HarnessStagingError,
): Promise<string[]> {
  const scoped = prefix.startsWith("@") ? splitScoped(prefix) : undefined;
  const directory =
    scoped === undefined ? modules : path.join(modules, `@${scoped.scope}`);
  const start = `${scoped === undefined ? prefix : scoped.name}.`;
  let names: string[];
  try {
    names = await fsp.readdir(directory);
  } catch (error) {
    if (isAbsence(error)) return [];
    throw refused(
      `leaves Reach's nothing-nearer condition unverified: ${directory} ` +
        `cannot be listed (${describeError(error)})`,
    );
  }
  return names
    .filter((name) => name.startsWith(start))
    .sort()
    .map((name) => path.join(directory, name));
}

/**
 * Well-formed manifests and no self-reference (SPEC 7.6 Reach), and the
 * declared project kind: every `package.json` in the importing file's
 * directory or one of its ancestors, up to the filesystem root, read
 * strictly, none giving a `name` read as N or a leading part of it; the
 * nearest one deciding the project kind.
 */
async function verifyManifests(
  importingFile: string,
  name: string,
  project: ProjectKind | undefined,
  refused: (detail: string) => HarnessStagingError,
): Promise<void> {
  let nearest: { readonly file: string; readonly type: unknown } | undefined;
  let directory = path.dirname(importingFile);
  for (;;) {
    const file = path.join(directory, PACKAGE_MANIFEST_NAME);
    const reading = await readManifestStrictly(file);
    if (reading !== undefined) {
      if (!reading.wellFormed) {
        throw refused(
          `fails Reach's well-formed-manifests condition: the manifest ` +
            `${file} ${reading.problem} — every package.json in the ` +
            `importing file's directory or one of its ancestors is a ` +
            `readable file holding, as UTF-8 with no byte-order mark, a JSON ` +
            `object that repeats no member name, whose name and type ` +
            `members, where present, are strings, and none of whose strings ` +
            `escapes a lone surrogate`,
        );
      }
      const given = reading.members["name"];
      if (typeof given === "string" && readsAsLeadingPart(given, name)) {
        throw refused(
          `fails Reach's no-self-reference condition: the manifest ${file} ` +
            `gives the name ${JSON.stringify(given)}, which TypeScript or ` +
            `Node.js reads as ${JSON.stringify(name)} or a leading part of it`,
        );
      }
      nearest ??= { file, type: reading.members["type"] };
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  if (project === undefined) return;
  const found =
    nearest === undefined
      ? "no package.json in the importing file's directory or an ancestor"
      : `the nearest package.json, ${nearest.file}, holding ` +
        (nearest.type === undefined
          ? "no type member"
          : `the type ${JSON.stringify(nearest.type)}`);
  const holds =
    project === "es-module"
      ? nearest !== undefined && nearest.type === "module"
      : project === "commonjs"
        ? nearest !== undefined && nearest.type === undefined
        : nearest === undefined;
  if (!holds) {
    throw refused(
      `is declared ${PROJECT_KIND_DESCRIPTIONS[project]}, yet it has ${found}`,
    );
  }
}

/** Each project kind as its staging declares it. */
const PROJECT_KIND_DESCRIPTIONS: Readonly<Record<ProjectKind, string>> = {
  "es-module":
    'an ES-module project, its nearest package.json holding "type": "module"',
  commonjs: "a CommonJS project whose nearest package.json has no type member",
  "no-manifest": "a project with no package.json at all",
};

/**
 * Whether TypeScript or Node.js reads a manifest's `name` as N or a leading
 * part of it (SPEC 7.6 Reach): each backslash read as `/`, it is empty, or
 * is N or N's scope (`@scope` for `@scope/name`) with or without one
 * trailing `/`.
 */
function readsAsLeadingPart(given: string, name: string): boolean {
  const read = given.split(BACKSLASH).join("/");
  const leading = [name];
  const scoped = name.startsWith("@") ? splitScoped(name) : undefined;
  if (scoped !== undefined) leading.push(`@${scoped.scope}`);
  return (
    read === "" || leading.some((part) => read === part || read === `${part}/`)
  );
}

/**
 * Remove a staging, a read-only directory a copy kept made writable first
 * where the removal needs it. One harness step under its own guard.
 */
async function removeTree(directory: string, context: string): Promise<void> {
  await guardStep(
    `removing the module-channel staging ${directory} (${context})`,
    async () => {
      try {
        await fsp.rm(directory, {
          recursive: true,
          force: true,
          maxRetries: 2,
        });
      } catch {
        await makeDirectoriesWritable(Buffer.from(directory));
        await fsp.rm(directory, {
          recursive: true,
          force: true,
          maxRetries: 2,
        });
      }
    },
  );
}

/** Best-effort: give every directory under `directory` owner access. */
async function makeDirectoriesWritable(directory: Buffer): Promise<void> {
  await fsp.chmod(directory, 0o700).catch(() => undefined);
  const names = await fsp
    .readdir(directory, { encoding: "buffer" })
    .catch(() => [] as Buffer[]);
  for (const name of names) {
    const child = Buffer.concat([directory, Buffer.from("/"), name]);
    const stats = await fsp.lstat(child).catch(() => undefined);
    if (stats?.isDirectory() === true) await makeDirectoriesWritable(child);
  }
}

/** `lstat` of `entry`, or undefined where it is absent. */
async function lstatOrAbsent(entry: string): Promise<Stats | undefined> {
  try {
    return await fsp.lstat(entry);
  } catch (error) {
    if (isAbsence(error)) return undefined;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Diagnoses
// ---------------------------------------------------------------------------

/** Paths, for a diagnosis: the first few. */
function describePaths(paths: readonly string[]): string {
  const shown = paths.slice(0, 5).join(", ");
  return paths.length > 5
    ? `${shown}, and ${String(paths.length - 5)} more`
    : shown;
}

/** A JSON value's kind, for a diagnosis. */
function describeJsonKind(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "object") return "an object";
  return `a ${typeof value}`;
}

/** Whether a failed examination failed for want of the entry. */
function isAbsence(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}

/** A filesystem entry's kind, for a diagnosis. */
function entryKind(stats: Stats): string {
  if (stats.isSymbolicLink()) return "a symbolic link";
  if (stats.isDirectory()) return "a directory";
  if (stats.isFile()) return "a plain file";
  if (stats.isFIFO()) return "a FIFO";
  if (stats.isSocket()) return "a socket";
  if (stats.isBlockDevice()) return "a block device";
  if (stats.isCharacterDevice()) return "a character device";
  return "an entry of another kind";
}

/** An error, for a diagnosis: its code where it has one, else its message. */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    return typeof code === "string"
      ? `${code}: ${error.message}`
      : `${error.name}: ${error.message}`;
  }
  return String(error);
}
