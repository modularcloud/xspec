// CONF-VALID conformer fixture (CERTIFICATIONS.md §CONF-VALID; TEST-SPEC 17
// C-1/C-2). A harness-owned executable product implementing §CONF-VALID's
// Scope with the simplest conforming behavior — driven only through the C-2
// executable/workspace binding, never importing product code (the product and
// the harness are distinct programs; this fixture is part of the harness).
//
// Scope implemented (see CERTIFICATIONS.md §CONF-VALID):
// - Workspaces with one configured spec group of one or more `.mdx` sources
//   whose sections carry `id` and `tags` props (multi-file included); no
//   imports, embeddings, `d` props, code groups, `markdown`, `coverage`,
//   `policy`, or git.
// - `build` with the error reporting of SPEC 14 for conditions 14.1–14.4 —
//   and 14.17 as T1.3-6's invalid-form arms stage it (a repeated `id`
//   attribute, a braced `id={"x"}` value, and the valueless bare name
//   `<S id>`) — file, location, condition identity with its stable code,
//   14.2's statement of the expected form, exit codes per SPEC 12.0.
// - `query node` / `query nodes` (with `--tag`) reporting identity, tags,
//   and metadataHash — the scoped query surface; source ranges ride along in
//   the natural SPEC 11 row shape, and a root node's tags and coverage
//   attribute are both reported as absent (SPEC 11.1, 5.5: the tags `null`,
//   the coverage attribute omitted). `query` is JSON-only (SPEC 12.0, 11): its
//   answers, its gated findings report on a workspace failing `build`'s
//   validations (13.3), and its usage errors are JSON with or without
//   `--json`.
// - Arguments are read under SPEC 12.0's universal invocation grammar
//   (`readInvocation`; CERTIFICATIONS.md preamble) — flag tokens anywhere,
//   before the command word included; a value-taking flag taking the whole
//   next token, its arity fixed by name for every command (`FLAG_ARITY`), so
//   `build --test-hold --json` reads `--json` as `--test-hold`'s value and
//   leaves JSON out of effect; `--` ending flag reading; the remaining
//   tokens matching the synopsis exactly (`checkSynopsis`). With JSON in
//   effect every exit-2 error prints the 12.7 error document: `code` and
//   `path` null for a plain usage error, `configuration-error` and SPEC 14's
//   concerned path for 14.14. Every syntax-class check (12.0) — `--tag`'s
//   well-formedness (11.1), `--coverage`'s vocabulary, `--file`'s
//   outside-root rule, a `<node>` spelling's one `#` — precedes loading
//   configuration, and the gated reads' argument checks precede the
//   invalid-workspace report (12.0, 13.3). An invocation outside the scope —
//   any other product command, `query`'s other subcommands, or `query
//   nodes`' `--group`, `--file`, and `--coverage` filters — is refused
//   loudly (exit 70) once every syntax-class check it can decide has passed.
// - Contracts under certification: SPEC 1.3, SPEC 1.4 with its exact
//   character classes, SPEC 2.6 tag splitting, and the masking rules of
//   SPEC 14.1/14.17 over 14.2 (a section spelling no identity — `id`
//   missing, repeated, or in invalid value form — masks condition 2 for its
//   immediate children; everything else reports normally).
//
// Key mechanisms:
// - Sources are scanned by a hand-rolled MDX-lite lexer: `<S>`/`<Spec>` tags
//   with quoted `id`/`tags` attribute values taken as their raw characters.
//   Deliberately no stock MDX parser: the 1.4 matrix stages raw control
//   bytes, exotic whitespace, and boundary code points inside attribute
//   values, and those must reach segment/tag validation (14.4) — never
//   surface as parse errors (14.20). That mis-staging hazard is exactly what
//   §CONF-VALID certifies against.
// - The lexer parses attribute occurrences per element, braced values
//   (`name={...}`, balanced with string awareness) included: a repeated prop
//   name, or an `id`/`tags` value not in quoted static-string form (braced
//   or valueless), is condition 17 (SPEC 2.4, 2.7, 14.17) — well-formed MDX,
//   so never 14.20 — and an `id` so afflicted spells no identity: never
//   condition 1 (SPEC 14.1), and it masks condition 2 for its immediate
//   children exactly as a missing `id` does (SPEC 14.2; T1.3-6's
//   invalid-form arms). Unknown prop *names* stay ignored: sections in the
//   accepted workspace shapes carry `id`/`tags` props only (Scope).
// - Validation (SPEC 1.3/1.4, conditions 14.1–14.4) walks sections in
//   document order. The structural rule compares segment sequences — a child
//   ID's segments are its parent ID's segments plus exactly one more — so an
//   empty segment is a 1.4 violation (14.4), never a structural one:
//   `<S id="">` is one (empty) top-level segment and `a.` → `a..b` nests by
//   exactly one segment per level (T1.4-1's staging).
// - SPEC 1.4's alphabet, exactly: beyond `.`, `#`, the whitespace and
//   control classes, and the forbidden names, a segment or tag containing
//   `"`, `'`, `\`, or `&`, or U+2028 or U+2029 (1.4's quote-and-escape
//   bullet; neither code point is whitespace or a control character, so
//   neither splits a tag), or U+FFFD is invalid (14.4). Attribute values are
//   read verbatim (SPEC 2.4): no escape sequence or character reference is
//   interpreted, so `id="a\u002Eb"` is a one-segment ID containing `\`
//   and `id="a&#46;b"` one containing `&` — condition 4, never the
//   two-segment ID `a.b` — and `tags="x\u0079"` a tag containing `\`.
// - Findings carry SPEC 14's exact per-condition ranges (byte offsets,
//   SPEC 1.7), one location per offending construct (12.7): 14.1 at the
//   section's opening tag (the opening-tag range of 11.4 — a self-closing
//   section's self-closing tag); 14.2 at the section's `id` attribute; 14.3
//   as one finding per duplicated spelling in a file, locating every
//   bearer's `id` attribute, no representative chosen; 14.4 as one finding
//   per offending `id` or `tags` attribute, however many of its segments or
//   tokens violate 1.4, located at that attribute; and 14.17 as one finding
//   per invalid prop, a repeated prop locating every attribute spelling the
//   name and a braced or valueless value its own attribute alone. An
//   attribute's range is its own characters, the attribute range of 11.4:
//   its name through the last character of its value (the closing quote or
//   brace), or the bare name where it spells no value. Every report thus
//   lands within its construct's window and never on a sibling construct.
// - Tag sets (`query node`/`query nodes`; the set form of SPEC 12.7): tags
//   in byte order — UTF-8 bytes, not UTF-16 code units — duplicates
//   collapsed, `[]` for a tagless section. A root node carries no tags
//   (SPEC 5.5), and its tags are reported as absent (11.1) — `null`, the
//   12.7 spelling of a datum whose absence its defining section states,
//   never `[]` — while the internal model keeps its empty tag set for the
//   metadataHash and the `--tag` filter (`reportedTags`).
// - `build` writes nothing: the scope observes validation and the query
//   surface only, and every query recomputes from the sources, so reads need
//   no stored graph data.
// - metadataHash: SHA-256 over the node's collapsed, sorted tag set (its
//   `d` set is always empty and its coverage attribute default in this
//   scope, SPEC 5.5) — so 2.6-equivalent spellings hash identically and a
//   `tags` value yielding zero tokens hashes as the omitted prop (T2.6-1,
//   T2.6-2).
//
// Determinism (SPEC 12.0): no wall clock, no randomness, no absolute paths
// in any output; all JSON is serialized with byte-sorted keys.
//
// Deviation seam: runXspec(argv, cwd, options) assigns `options` onto the
// module-level `deviations` switches (all off = this conformer). Each
// VIOL-VALID-* violator entry is a bin-<name>.mjs passing exactly one switch,
// consumed in the 1.4 validity classification below — tag *splitting*
// (SPEC 2.6) stays on the exact 1.4 whitespace class for every fixture
// (§VIOL-VALID-WIDE deviates validity, not splitting). Landed switches:
// `acceptNonWhitespaceControls` (§VIOL-VALID-CTRL, bin-ctrl.mjs, CERT-09) in
// `valueViolation`'s control branch; `widenValidityWhitespace`
// (§VIOL-VALID-WIDE, bin-wide.mjs, CERT-10) in `valueViolation`'s whitespace
// branch — U+00A0 and U+0085, exactly, treated as whitespace for 1.4
// validity only; `acceptLineSeparators` (§VIOL-VALID-SEP, bin-sep.mjs) in
// `valueViolation`'s U+2028/U+2029 branch — 1.4's bar on the two code points
// not enforced, every other clause of the quote-and-escape bullet kept.

import { createHash } from "node:crypto";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Outcome carriers
// ---------------------------------------------------------------------------

/**
 * Usage or configuration error (SPEC 12.0 exit 2): the message is stderr
 * content; with JSON output in effect the 12.7 error document is the
 * entire stdout. `code`/`path` are the error finding's stable code and
 * concerned path — set for configuration errors (14.14:
 * `configuration-error` plus the concerned path, SPEC 14), `null` for plain
 * usage errors (SPEC 12.7, 14).
 */
class UsageError extends Error {
  /** @param {string} message
   *  @param {{ code?: string | null, path?: string | null }} [finding] */
  constructor(message, { code = null, path = null } = {}) {
    super(message);
    this.code = code;
    this.path = path;
  }
}

/**
 * An invocation outside this fixture's scope (CERTIFICATIONS.md
 * §CONF-VALID) that a conforming product would answer — another product
 * command, another `query` subcommand, or a `query nodes` filter no
 * in-scope observation uses. Refused loudly with an exit code outside the
 * 12.0 partition (as a crash is, below), so a test reaching it fails on its
 * exit-code assertion with the cause on stderr — never on a fabricated
 * answer or a false usage error.
 */
class ScopeError extends Error {}

/** Findings (SPEC 12.0 exit 1): a findings report on stdout. */
class FindingsError extends Error {
  /** @param {readonly Finding[]} findings */
  constructor(findings) {
    super("findings");
    this.findings = findings;
  }
}

/**
 * A finding located in one source file: one byte range per offending
 * construct (SPEC 12.7, 14), serialized in range order.
 *
 * @typedef {{ condition: string, message: string, file: string,
 *             locations: { start: number, end: number }[] }} Finding
 */

// ---------------------------------------------------------------------------
// Canonical JSON (sorted keys, SPEC 12.0)
// ---------------------------------------------------------------------------

/** @param {unknown} value @returns {unknown} */
function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep(
        /** @type {Record<string, unknown>} */ (value)[key],
      );
    }
    return sorted;
  }
  return value;
}

/** One canonical serializer for emitted JSON. */
function canonicalJson(value) {
  return JSON.stringify(sortKeysDeep(value));
}

function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Whether anything (file, directory, or symlink) occupies the path. */
async function pathOccupied(absPath) {
  try {
    await fsp.lstat(absPath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Configuration (SPEC 7): upward search + declarative literal parse
// ---------------------------------------------------------------------------

const CONFIG_NAME = "xspec.config.ts";

/**
 * A located configuration file's concerned path in the anchoring form of
 * SPEC 11.6, as SPEC 14 reports a configuration error's: identified
 * relative to the invocation working directory, the working directory and
 * the workspace root (the file's directory, 7) entering as physical paths
 * with every symbolic link among their components resolved, the file as its
 * own name under the root so spelled — the segments ascending to the
 * nearest common ancestor spelled `..`, then the descending segments,
 * `/`-joined; the platform's absolute form only where no relative path
 * exists (11.6).
 */
async function anchoringPath(cwd, configPath) {
  const physicalCwd = await fsp.realpath(cwd);
  const physicalRoot = await fsp.realpath(path.dirname(configPath));
  const relative = path.relative(physicalCwd, physicalRoot);
  const name = path.basename(configPath);
  if (relative === "") return name;
  if (path.isAbsolute(relative)) return path.join(relative, name);
  return [...relative.split(path.sep), name].join("/");
}

async function findConfigPath(cwd, configFlag) {
  if (configFlag !== undefined) {
    const abs = path.resolve(cwd, configFlag);
    if (!(await pathOccupied(abs))) {
      throw new UsageError(
        `configuration file not found: --config ${configFlag}`,
        // A `--config` path nothing occupies — the one concerned path no
        // physical resolution can spell — is reported as the argument value
        // exactly as given (SPEC 14, 12.0).
        { code: "configuration-error", path: configFlag },
      );
    }
    return abs;
  }
  let dir = path.resolve(cwd);
  for (;;) {
    const candidate = path.join(dir, CONFIG_NAME);
    if (await pathOccupied(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new UsageError(
        `configuration error: no ${CONFIG_NAME} found by upward search from the working directory`,
        // Missing configuration with no `--config`: the concerned path is
        // the directory the failed search started from, spelled "." (14).
        { code: "configuration-error", path: "." },
      );
    }
    dir = parent;
  }
}

/**
 * Parse the declarative configuration (SPEC 7): exactly an import of
 * `defineConfig` from "xspec" (optionally aliased) and a default export of
 * one call whose sole argument is statically literal. Returns the argument
 * as data. Any other form is a configuration error (SPEC 14.14, exit 2).
 */
function parseConfigSource(text) {
  const importMatch =
    /import\s*\{\s*defineConfig(?:\s+as\s+([A-Za-z_$][\w$]*))?\s*\}\s*from\s*(["'])xspec\2\s*;?/.exec(
      text,
    );
  if (!importMatch) {
    throw new UsageError(
      'configuration error: xspec.config.ts must import { defineConfig } from "xspec" (SPEC 7, 14.14)',
    );
  }
  const binding = importMatch[1] ?? "defineConfig";
  const callMatch = new RegExp(
    `export\\s+default\\s+${binding.replace(/\$/g, "\\$")}\\s*\\(`,
  ).exec(text);
  if (!callMatch) {
    throw new UsageError(
      "configuration error: xspec.config.ts must default-export one defineConfig(...) call (SPEC 7, 14.14)",
    );
  }
  const parser = new LiteralParser(text, callMatch.index + callMatch[0].length);
  const value = parser.parseValue();
  parser.skipWs();
  if (parser.text[parser.pos] !== ")") {
    throw new UsageError(
      "configuration error: the defineConfig argument must be one static literal (SPEC 7, 14.14)",
    );
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new UsageError(
      "configuration error: defineConfig takes an object literal (SPEC 7)",
    );
  }
  return value;
}

/** Recursive-descent parser for the static-literal subset of SPEC 7. */
class LiteralParser {
  constructor(text, pos) {
    this.text = text;
    this.pos = pos;
  }

  fail(what) {
    throw new UsageError(
      `configuration error: ${what} at offset ${String(this.pos)} (SPEC 7, 14.14)`,
    );
  }

  skipWs() {
    while (this.pos < this.text.length && /\s/.test(this.text[this.pos]))
      this.pos += 1;
  }

  parseValue() {
    this.skipWs();
    const c = this.text[this.pos];
    if (c === "{") return this.parseObject();
    if (c === "[") return this.parseArray();
    if (c === '"' || c === "'") return this.parseString();
    if (this.text.startsWith("true", this.pos)) {
      this.pos += 4;
      return true;
    }
    if (this.text.startsWith("false", this.pos)) {
      this.pos += 5;
      return false;
    }
    return this.fail("expected an object, array, string, or boolean literal");
  }

  parseObject() {
    this.pos += 1; // "{"
    const obj = {};
    this.skipWs();
    if (this.text[this.pos] === "}") {
      this.pos += 1;
      return obj;
    }
    for (;;) {
      this.skipWs();
      let key;
      const c = this.text[this.pos];
      if (c === '"' || c === "'") {
        key = this.parseString();
      } else {
        const match = /^[A-Za-z_$][\w$]*/.exec(this.text.slice(this.pos));
        if (!match) this.fail("expected an object key");
        key = match[0];
        this.pos += key.length;
      }
      this.skipWs();
      if (this.text[this.pos] !== ":")
        this.fail("expected ':' after an object key");
      this.pos += 1;
      obj[key] = this.parseValue();
      this.skipWs();
      if (this.text[this.pos] === ",") {
        this.pos += 1;
        this.skipWs();
        if (this.text[this.pos] === "}") {
          this.pos += 1;
          return obj;
        }
        continue;
      }
      if (this.text[this.pos] === "}") {
        this.pos += 1;
        return obj;
      }
      this.fail("expected ',' or '}' in an object literal");
    }
  }

  parseArray() {
    this.pos += 1; // "["
    const arr = [];
    this.skipWs();
    if (this.text[this.pos] === "]") {
      this.pos += 1;
      return arr;
    }
    for (;;) {
      arr.push(this.parseValue());
      this.skipWs();
      if (this.text[this.pos] === ",") {
        this.pos += 1;
        this.skipWs();
        if (this.text[this.pos] === "]") {
          this.pos += 1;
          return arr;
        }
        continue;
      }
      if (this.text[this.pos] === "]") {
        this.pos += 1;
        return arr;
      }
      this.fail("expected ',' or ']' in an array literal");
    }
  }

  parseString() {
    const quote = this.text[this.pos];
    this.pos += 1;
    let out = "";
    while (this.pos < this.text.length) {
      const c = this.text[this.pos];
      if (c === quote) {
        this.pos += 1;
        return out;
      }
      if (c === "\\") {
        const next = this.text[this.pos + 1];
        if (next === undefined) break;
        if (next === "n") out += "\n";
        else if (next === "t") out += "\t";
        else if (next === "r") out += "\r";
        else out += next;
        this.pos += 2;
        continue;
      }
      out += c;
      this.pos += 1;
    }
    return this.fail("unterminated string literal");
  }
}

/**
 * Load and validate the configuration; returns the workspace root and the
 * spec groups. The in-scope shape is one spec group of glob strings
 * (CERTIFICATIONS.md §CONF-VALID); `specs` is required (SPEC 7).
 */
async function loadConfig(cwd, configFlag) {
  const configPath = await findConfigPath(cwd, configFlag);
  try {
    return await parseAndValidateConfig(configPath);
  } catch (error) {
    // Every defect found while reading, parsing, or validating the located
    // configuration is a configuration error (SPEC 14.14): its error finding
    // carries the stable code and the concerned configuration file in the
    // anchoring form (SPEC 14, 12.7).
    if (error instanceof UsageError && error.code === null) {
      error.code = "configuration-error";
      error.path = await anchoringPath(cwd, configPath);
    }
    throw error;
  }
}

/** The post-location half of {@link loadConfig}: read, parse, validate. */
async function parseAndValidateConfig(configPath) {
  let text;
  try {
    text = await fsp.readFile(configPath, "utf8");
  } catch (error) {
    throw new UsageError(
      `configuration error: cannot read ${CONFIG_NAME}: ${error.message}`,
    );
  }
  const data = parseConfigSource(text);
  const specs = data.specs;
  if (
    specs === undefined ||
    specs === null ||
    typeof specs !== "object" ||
    Array.isArray(specs)
  ) {
    throw new UsageError(
      "configuration error: `specs` is required and must be a map of groups (SPEC 7)",
    );
  }
  /** @type {Record<string, string[]>} */
  const groups = {};
  for (const [name, globs] of Object.entries(specs)) {
    if (!Array.isArray(globs) || globs.some((g) => typeof g !== "string")) {
      throw new UsageError(
        `configuration error: spec group ${name} must be a list of glob strings (SPEC 7.1)`,
      );
    }
    for (const glob of globs) {
      if (glob.startsWith("/") || glob.split("/").includes("..")) {
        throw new UsageError(
          `configuration error: pattern ${glob} resolves outside the workspace root (SPEC 7, 14.14)`,
        );
      }
    }
    groups[name] = globs;
  }
  return { root: path.dirname(configPath), groups };
}

// ---------------------------------------------------------------------------
// Glob matching (SPEC 7): `*`, `?`, `**`, literals, dot rule, case-sensitive
// ---------------------------------------------------------------------------

const segmentRegexCache = new Map();

function globSegmentRegex(patternSegment) {
  let regex = segmentRegexCache.get(patternSegment);
  if (regex === undefined) {
    let source = "^";
    for (const ch of patternSegment) {
      if (ch === "*") source += "[^/]*";
      else if (ch === "?") source += "[^/]";
      else source += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
    regex = new RegExp(source + "$");
    segmentRegexCache.set(patternSegment, regex);
  }
  return regex;
}

function globSegmentMatches(patternSegment, pathSegment) {
  // Dot rule (SPEC 7): a path segment beginning with `.` is matched only by
  // a pattern segment written with a leading `.`.
  if (pathSegment.startsWith(".") && !patternSegment.startsWith("."))
    return false;
  return globSegmentRegex(patternSegment).test(pathSegment);
}

function globMatches(pattern, relPath) {
  const patternSegments = pattern.split("/");
  const pathSegments = relPath.split("/");
  const match = (pi, si) => {
    if (pi === patternSegments.length) return si === pathSegments.length;
    const ps = patternSegments[pi];
    if (ps === "**") {
      if (match(pi + 1, si)) return true;
      // `**` spans whole segments but is not written with a leading dot, so
      // it never consumes a dot segment (SPEC 7).
      if (si < pathSegments.length && !pathSegments[si].startsWith(".")) {
        return match(pi, si + 1);
      }
      return false;
    }
    if (si >= pathSegments.length) return false;
    if (!globSegmentMatches(ps, pathSegments[si])) return false;
    return match(pi + 1, si + 1);
  };
  return match(0, 0);
}

// ---------------------------------------------------------------------------
// Discovery (SPEC 7, 13.4): walk plain files, never following symlinks
// ---------------------------------------------------------------------------

async function walkPlainFiles(rootAbs, relPrefix = "") {
  /** @type {string[]} */
  const files = [];
  let entries;
  try {
    entries = await fsp.readdir(path.join(rootAbs, relPrefix), {
      withFileTypes: true,
    });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const rel = relPrefix === "" ? entry.name : `${relPrefix}/${entry.name}`;
    if (entry.isSymbolicLink()) continue; // never discovered, never traversed
    if (entry.isDirectory()) {
      files.push(...(await walkPlainFiles(rootAbs, rel)));
    } else if (entry.isFile()) {
      files.push(rel);
    }
  }
  return files;
}

/** Derived files are never sources (SPEC 13.4). */
function isDerivedPath(rel) {
  const base = rel.split("/").at(-1) ?? rel;
  return (
    base.includes(".xspec.") || rel === ".xspec" || rel.startsWith(".xspec/")
  );
}

async function discoverSources(root, groups) {
  const all = (await walkPlainFiles(root)).sort();
  const discovered = [];
  for (const rel of all) {
    if (isDerivedPath(rel)) continue;
    const matched = Object.values(groups).some((globs) =>
      globs.some((glob) => globMatches(glob, rel)),
    );
    if (matched) discovered.push(rel);
  }
  return discovered;
}

// ---------------------------------------------------------------------------
// SPEC 1.4 character classes and value validity; SPEC 2.6 tag splitting
// ---------------------------------------------------------------------------

/**
 * SPEC 1.4's whitespace class for *validity*, exactly: U+0009–U+000D and
 * U+0020; no other code point (U+00A0, U+0085, U+2028, and U+2029 included)
 * belongs to it. The VIOL-VALID-WIDE deviation switch
 * (`widenValidityWhitespace`, CERT-10) hooks into this class's *enforcement*
 * in `valueViolation` — validity classification only, never `splitTags`
 * below.
 */
function isValidityWhitespace(codePoint) {
  return (codePoint >= 0x0009 && codePoint <= 0x000d) || codePoint === 0x0020;
}

/**
 * The valid boundary code points SPEC 1.4 excludes from both character
 * classes and bars by no rule, exactly: U+00A0 (no-break space) and U+0085
 * (next line) — TEST-SPEC T1.4-2's. Under `widenValidityWhitespace`
 * (§VIOL-VALID-WIDE, bin-wide.mjs) they are treated as whitespace for 1.4
 * validity, so segments and tags containing them are rejected with 14.4.
 * U+2028 and U+2029 belong to neither class either, but 1.4's
 * quote-and-escape bullet bars them in every fixture but §VIOL-VALID-SEP's
 * (`LINE_SEPARATOR_CODE_POINTS` below), so neither is a boundary here.
 */
const WIDE_BOUNDARY_CODE_POINTS = new Set([0x00a0, 0x0085]);

/**
 * SPEC 1.4's control-character class, exactly: U+0000–U+001F and U+007F. The
 * VIOL-VALID-CTRL deviation switch (CERT-09) hooks into the *enforcement* of
 * this class in `valueViolation` (non-whitespace members only).
 */
function isValidityControl(codePoint) {
  return codePoint <= 0x001f || codePoint === 0x007f;
}

/** The forbidden segment names of SPEC 1.4, all five (exact strings). */
const FORBIDDEN_NAMES = new Set([
  "$",
  "__proto__",
  "prototype",
  "constructor",
  "then",
]);

/**
 * The quote, escape, and character-reference characters SPEC 1.4 excludes
 * from segments and tags — `"`, `'`, `\`, `&` — so that every segment and
 * tag is spelled verbatim in every form (SPEC 2.4, 2.7, 6.4).
 */
const QUOTE_ESCAPE_REFERENCE_CHARACTERS = new Set(['"', "'", "\\", "&"]);

/**
 * U+2028 (LINE SEPARATOR) and U+2029 (PARAGRAPH SEPARATOR), which the same
 * bullet of SPEC 1.4 bars from segments and tags. Neither belongs to the
 * whitespace or the control class (SPEC 1.4), so neither splits a tag
 * (`splitTags` below): a tag containing either is kept whole, then rejected
 * in `valueViolation` — accepted there under `acceptLineSeparators`
 * (§VIOL-VALID-SEP, bin-sep.mjs), still kept whole.
 */
const LINE_SEPARATOR_CODE_POINTS = new Map([
  [0x2028, "LINE SEPARATOR"],
  [0x2029, "PARAGRAPH SEPARATOR"],
]);

function codePointName(codePoint) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * SPEC 1.4 validity of one segment or tag value: the reason it is invalid,
 * or null when valid. The two roles differ in exactly one rule: a tag MAY
 * contain `.`. `switches` are the deviation switches the judgement applies:
 * the invocation's (`deviations`) for every value a source spells, none for
 * an argument value judged by the syntax class (`--tag`, 11.1) — so each
 * violator deviates in sources alone and reads its arguments exactly as the
 * conformer does.
 *
 * @param {string} value
 * @param {"segment" | "tag"} role
 * @param {Record<string, boolean | undefined>} [switches]
 * @returns {string | null}
 */
function valueViolation(value, role, switches = deviations) {
  if (value.length === 0) {
    return `the ${role} is empty (SPEC 1.4: segments are non-empty)`;
  }
  if (FORBIDDEN_NAMES.has(value)) {
    return `the ${role} is the forbidden name ${JSON.stringify(value)} (SPEC 1.4)`;
  }
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (character === "." && role === "segment") {
      return 'the segment contains "." (SPEC 1.4)';
    }
    if (character === "#") {
      return `the ${role} contains "#" (SPEC 1.4)`;
    }
    // §VIOL-VALID-WIDE (bin-wide.mjs): under `widenValidityWhitespace` the
    // boundary code points U+00A0 and U+0085 are treated as whitespace for
    // 1.4 validity — segments and tags containing them are rejected with 14.4.
    // Validity classification only: `splitTags` below stays on the literal
    // 1.4 whitespace class, and every other classification is unchanged.
    if (
      isValidityWhitespace(codePoint) ||
      (switches.widenValidityWhitespace &&
        WIDE_BOUNDARY_CODE_POINTS.has(codePoint))
    ) {
      return `the ${role} contains the whitespace character ${codePointName(codePoint)} (SPEC 1.4)`;
    }
    // §VIOL-VALID-CTRL (bin-ctrl.mjs): under `acceptNonWhitespaceControls`
    // the control rule is not enforced for code points outside the whitespace
    // class. The whitespace branch above runs first, so exactly U+0000–U+0008,
    // U+000E–U+001F, and U+007F are accepted; whitespace characters remain
    // rejected in segments, and `splitTags` below is untouched.
    if (isValidityControl(codePoint) && !switches.acceptNonWhitespaceControls) {
      return `the ${role} contains the control character ${codePointName(codePoint)} (SPEC 1.4)`;
    }
    // The quote, escape, and character-reference characters (SPEC 1.4):
    // attribute values are read verbatim (SPEC 2.4), so an escape- or
    // reference-spelled value is a value containing `\` or `&` — condition
    // 4, never its interpreted spelling.
    if (QUOTE_ESCAPE_REFERENCE_CHARACTERS.has(character)) {
      return `the ${role} contains the quote, escape, or character-reference character ${JSON.stringify(character)} (SPEC 1.4)`;
    }
    // U+2028 and U+2029, barred by the same bullet of SPEC 1.4 though in
    // neither the whitespace nor the control class: condition 4, one finding
    // per offending attribute, exactly as for the characters above.
    // §VIOL-VALID-SEP (bin-sep.mjs): under `acceptLineSeparators` this one
    // clause of the bullet is not enforced, so a segment or tag containing
    // either code point is accepted. The quote, escape, and
    // character-reference characters stay barred by the branch above, and
    // neither code point joins the whitespace class: `splitTags` below still
    // keeps a tag containing either whole.
    if (
      LINE_SEPARATOR_CODE_POINTS.has(codePoint) &&
      !switches.acceptLineSeparators
    ) {
      return `the ${role} contains ${codePointName(codePoint)} (${LINE_SEPARATOR_CODE_POINTS.get(codePoint)}), barred by the quote-and-escape bullet (SPEC 1.4)`;
    }
    // U+FFFD (REPLACEMENT CHARACTER), which no argument value carries (SPEC
    // 1.4, 12.0): only a literal U+FFFD in the source bytes reaches here —
    // an undecodable byte is 14.20 (`analyzeFile` decodes fatally).
    if (codePoint === 0xfffd) {
      return `the ${role} contains U+FFFD (REPLACEMENT CHARACTER) (SPEC 1.4)`;
    }
  }
  return null;
}

/**
 * SPEC 2.6 tag splitting: tags are split on runs of 1.4 whitespace, and
 * leading/trailing whitespace is ignored — so no token is ever empty or
 * contains whitespace. Deliberately on the literal 1.4 whitespace class (not
 * `isValidityWhitespace`): §VIOL-VALID-WIDE deviates validity classification
 * only, and tag splitting stays unchanged in every fixture.
 */
function splitTags(value) {
  const tokens = [];
  let current = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    const isSplitter =
      (codePoint >= 0x0009 && codePoint <= 0x000d) || codePoint === 0x0020;
    if (isSplitter) {
      if (current !== "") {
        tokens.push(current);
        current = "";
      }
    } else {
      current += character;
    }
  }
  if (current !== "") tokens.push(current);
  return tokens;
}

/** Byte order of two strings: their UTF-8 bytes (SPEC 12.0). */
function compareBytes(a, b) {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/**
 * The tag set of a `tags` value (SPEC 2.6) in the set form of SPEC 12.7:
 * tags in byte order — UTF-8 bytes, never UTF-16 code units (the two orders
 * differ between a BMP character above the surrogate range and an astral
 * one) — duplicates collapsed, `[]` when tagless.
 */
function collapsedTags(tagsRaw) {
  if (tagsRaw === undefined) return [];
  return [...new Set(splitTags(tagsRaw))].sort(compareBytes);
}

// ---------------------------------------------------------------------------
// Byte offsets (SPEC 1.7: ranges and locations are byte offsets)
// ---------------------------------------------------------------------------

/**
 * Map string (code-unit) indices to UTF-8 byte offsets. ASCII sources take
 * the identity fast path; the general path handles multi-byte content
 * (T1.4-2's boundary code points, P-1's generated values).
 */
function byteOffsetMapper(text, byteLength) {
  if (byteLength === text.length) return (i) => i;
  const offsets = new Array(text.length + 1);
  let bytes = 0;
  let i = 0;
  while (i < text.length) {
    offsets[i] = bytes;
    const code = text.codePointAt(i);
    const units = code > 0xffff ? 2 : 1;
    if (units === 2) offsets[i + 1] = bytes;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    i += units;
  }
  offsets[text.length] = bytes;
  return (index) => offsets[index];
}

// ---------------------------------------------------------------------------
// MDX-lite parsing: `<S>`/`<Spec>` sections with quoted `id`/`tags` values
// ---------------------------------------------------------------------------

/** Inter-attribute whitespace inside a tag (the SPEC 1.4 class). */
const TAG_WHITESPACE = new Set(["\t", "\n", "\v", "\f", "\r", " "]);

/**
 * Scan a braced attribute value (`name={...}`) starting at its `{`: balanced
 * braces with string-literal awareness (quotes and backslash escapes), enough
 * for any static-expression spelling such as `{"x"}`. Returns the index just
 * past the closing `}`, or -1 when unterminated. The braced form is
 * well-formed MDX — its content is never inspected: whatever it holds, the
 * value is not in quoted static-string form (condition 17, SPEC 2.4, 2.7).
 */
function scanBracedAttributeValue(text, start) {
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'") {
      i += 1;
      while (i < text.length && text[i] !== c) {
        i += text[i] === "\\" ? 2 : 1;
      }
      if (i >= text.length) return -1;
      i += 1;
      continue;
    }
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
  return -1;
}

/**
 * Parse one source file into a section tree with exact string-index ranges.
 * Attribute values are the raw characters between their quotes — control
 * bytes, line terminators, and boundary code points included — so 1.4
 * validity, never parseability, is what their content decides. Per element,
 * every attribute is kept in tag order with its own range (`attributes`, the
 * attribute range of SPEC 11.4), attribute occurrences are counted, and value
 * forms classified: a repeated prop name or a non-quoted-static `id`/`tags`
 * value is recorded on the node as an `invalidProps` entry (condition 17,
 * SPEC 2.7 — well-formed MDX, so never a parse failure; a value-form entry
 * carrying its offending attribute's range), an `id` so afflicted spells no
 * identity (`id` null, `idMissing` false — condition 17, never condition 1),
 * and a wholly absent `id` is `idMissing` (condition 1). Returns
 * { root, sections, failure } where `failure` is null or { at, message }
 * (an unparseable source, SPEC 14.20 — masking the conditions inside).
 */
function parseMdx(text) {
  const root = {
    isRoot: true,
    id: null,
    tagsRaw: undefined,
    parent: null,
    children: [],
    openStart: 0,
    openEnd: 0,
    closeStart: text.length,
    closeEnd: text.length,
  };
  const sections = [];
  const stack = [root];
  let i = 0;
  /** @type {{ at: number, message: string } | null} */
  let failure = null;
  const fail20 = (at, message) => {
    failure = { at, message };
  };
  while (i < text.length) {
    if (text[i] !== "<") {
      i += 1;
      continue;
    }
    const close = /^<\/(S|Spec)\s*>/.exec(text.slice(i));
    if (close) {
      const node = stack.at(-1);
      if (node === root) {
        fail20(i, "closing tag without an open section");
        return { root, sections, failure };
      }
      node.closeStart = i;
      node.closeEnd = i + close[0].length;
      stack.pop();
      i = node.closeEnd;
      continue;
    }
    const open = /^<(S|Spec)(?=[\s/>])/.exec(text.slice(i));
    if (!open) {
      i += 1;
      continue;
    }
    const node = {
      isRoot: false,
      id: null,
      idMissing: false,
      tagsRaw: undefined,
      /** @type {{ start: number, end: number } | null} */
      idAttr: null,
      /** @type {{ start: number, end: number } | null} */
      tagsAttr: null,
      /** @type {{ name: string, start: number, end: number }[]} */
      attributes: [],
      /** @type {{ name: string, kind: "repeated" | "value-form",
       *            attribute: { start: number, end: number } | null }[]} */
      invalidProps: [],
      parent: stack.at(-1),
      children: [],
      openStart: i,
      openEnd: -1,
      closeStart: -1,
      closeEnd: -1,
      selfClosing: false,
    };
    let j = i + open[0].length;
    /** @type {Map<string, number>} */
    const occurrences = new Map();
    let idValue;
    let tagsValue;
    let idAttr;
    let tagsAttr;
    for (;;) {
      while (j < text.length && TAG_WHITESPACE.has(text[j])) j += 1;
      if (j >= text.length) {
        fail20(i, "unterminated section tag");
        return { root, sections, failure };
      }
      if (text[j] === ">") {
        j += 1;
        break;
      }
      if (text[j] === "/" && text[j + 1] === ">") {
        node.selfClosing = true;
        j += 2;
        break;
      }
      const attrStart = j;
      const attr = /^[A-Za-z][\w-]*/.exec(text.slice(j));
      if (!attr) {
        fail20(j, "malformed attribute in a section tag");
        return { root, sections, failure };
      }
      const name = attr[0];
      j += name.length;
      /** @type {"quoted" | "braced" | "valueless"} */
      let form = "valueless";
      let value;
      if (text[j] === "=") {
        j += 1;
        const quote = text[j];
        if (quote === '"' || quote === "'") {
          const valueStart = j + 1;
          const end = text.indexOf(quote, valueStart);
          if (end === -1) {
            fail20(j, "unterminated attribute value");
            return { root, sections, failure };
          }
          value = text.slice(valueStart, end);
          form = "quoted";
          j = end + 1;
        } else if (quote === "{") {
          const end = scanBracedAttributeValue(text, j);
          if (end === -1) {
            fail20(j, "unterminated braced attribute value");
            return { root, sections, failure };
          }
          form = "braced";
          j = end;
        } else {
          fail20(j, "malformed attribute value in a section tag");
          return { root, sections, failure };
        }
      }
      // The attribute's own characters, the attribute range of SPEC 11.4:
      // its name through the last character of its value (the closing quote
      // or brace), or the bare name where it spells no value — where every
      // attribute condition on it is located (SPEC 14; T14-11).
      const range = { start: attrStart, end: j };
      node.attributes.push({ name, start: range.start, end: range.end });
      const count = (occurrences.get(name) ?? 0) + 1;
      occurrences.set(name, count);
      // A repeated prop, defined or unknown, is condition 17 (SPEC 2.7) —
      // one violation per prop name, however many further repeats, located
      // at every attribute spelling the name (`validateSections`).
      if (count === 2) {
        node.invalidProps.push({ name, kind: "repeated", attribute: null });
      }
      // An `id`/`tags` value not in quoted static-string form — braced or
      // valueless — is condition 17 (SPEC 2.4, 2.7), located at its own
      // attribute alone. Unknown prop names stay ignored: out of the accepted
      // workspace shapes (§CONF-VALID Scope).
      if ((name === "id" || name === "tags") && count === 1) {
        if (form === "quoted") {
          if (name === "id") {
            idValue = value;
            idAttr = range;
          } else {
            tagsValue = value;
            tagsAttr = range;
          }
        } else {
          node.invalidProps.push({
            name,
            kind: "value-form",
            attribute: range,
          });
        }
      }
    }
    // Spelled identity (SPEC 11.2): exactly one quoted-static `id` spells
    // one; a repeated or invalid-form `id` spells none — condition 17, never
    // condition 1 (SPEC 14.1) — and only a wholly absent `id` is condition 1.
    const idInvalid = node.invalidProps.some((entry) => entry.name === "id");
    node.id = idInvalid ? null : (idValue ?? null);
    node.idAttr = node.id === null ? null : idAttr;
    node.idMissing = !idInvalid && idValue === undefined;
    node.tagsRaw = node.invalidProps.some((entry) => entry.name === "tags")
      ? undefined
      : tagsValue;
    node.tagsAttr = node.tagsRaw === undefined ? null : tagsAttr;
    node.openEnd = j;
    if (node.selfClosing) {
      node.closeStart = node.openEnd;
      node.closeEnd = node.openEnd;
      node.parent.children.push(node);
      sections.push(node);
      i = j;
      continue;
    }
    node.parent.children.push(node);
    sections.push(node);
    stack.push(node);
    i = j;
  }
  if (stack.length !== 1) {
    fail20(Math.max(0, text.length - 1), "unclosed section tag");
  }
  return { root, sections, failure };
}

// ---------------------------------------------------------------------------
// Validation (SPEC 1.3, 1.4, 2.6; conditions 14.1–14.4 with 14.2's masking)
// ---------------------------------------------------------------------------

/** Segments of a declared ID: `.` is structural (SPEC 1.3). */
function segmentsOf(id) {
  return id.split(".");
}

/**
 * Validate one parsed file's sections in document order. Every finding
 * carries SPEC 14's exact range for its condition, one per offending
 * construct (SPEC 14: file, location, condition identity; 12.7; SPEC 1.7
 * byte offsets): 14.1 the section's opening tag, the opening-tag range of
 * 11.4; 14.2 the section's `id` attribute; 14.3 — one finding per
 * duplicated spelling, no representative chosen — every bearer's `id`
 * attribute; 14.4 the offending `id` or `tags` attribute (T14-11); 14.17 a
 * repeated prop's every attribute spelling the name, or a braced or
 * valueless value's own attribute. An attribute is located by its own
 * characters, the attribute range of 11.4 — so every finding falls within
 * its construct's window and never on a sibling.
 *
 * @returns {Finding[]}
 */
function validateSections(rel, sections, byteOf) {
  /** @type {Finding[]} */
  const findings = [];
  /** A string-index range as its byte range (SPEC 1.7). */
  const bytesOf = (range) => ({
    start: byteOf(range.start),
    end: byteOf(range.end),
  });
  /**
   * Each spelled identity's bearers — their `id` attributes, in document
   * order — for condition 14.3, reported once the file is walked.
   *
   * @type {Map<string, { start: number, end: number }[]>}
   */
  const bearers = new Map();
  for (const node of sections) {
    // Condition 14.17 (SPEC 2.7): a repeated prop, or an `id`/`tags` value
    // not in quoted static-string form — one finding per violation. A
    // repeated prop locates every attribute spelling the name, in tag order;
    // a braced or valueless value its own attribute alone (SPEC 14). An `id`
    // so afflicted spells no identity: never condition 1 (SPEC 14.1), its
    // own segment/structural/duplicate checks cannot run, and its immediate
    // children's structural checks are masked below exactly as under a
    // missing `id` (SPEC 14.2).
    for (const invalid of node.invalidProps) {
      const offending =
        invalid.kind === "repeated"
          ? node.attributes.filter(
              (attribute) => attribute.name === invalid.name,
            )
          : [invalid.attribute];
      findings.push({
        condition: "14.17",
        message:
          invalid.kind === "repeated"
            ? `invalid prop: the ${JSON.stringify(invalid.name)} prop is repeated — no prop name may occur more than once on one element (SPEC 2.7)`
            : `invalid prop: the ${JSON.stringify(invalid.name)} value must be a static string literal in quoted attribute form (SPEC 2.4, 2.7)`,
        file: rel,
        locations: offending.map(bytesOf),
      });
    }
    if (node.idMissing) {
      // Condition 14.1 (SPEC 1.3): a non-root section without `id`, located
      // at its opening tag — the opening-tag range of 11.4, a self-closing
      // section's self-closing tag (SPEC 14). Its own structural and segment
      // checks need an ID and cannot run; its immediate children's
      // structural checks are masked below (SPEC 14.2).
      findings.push({
        condition: "14.1",
        message:
          "missing id: every non-root section must carry an `id` prop (SPEC 1.3)",
        file: rel,
        locations: [bytesOf({ start: node.openStart, end: node.openEnd })],
      });
    } else if (node.id !== null) {
      const segments = segmentsOf(node.id);
      // Condition 14.4 (SPEC 1.4): one finding per offending `id` attribute,
      // however many of its segments violate 1.4 (SPEC 14 — a descendant
      // spelling a malformed ancestor segment as its own prefix reports in
      // its own attribute too), located at the attribute's own characters
      // (T14-11), never at the whole construct.
      const segmentViolations = segments.flatMap((segment) => {
        const violation = valueViolation(segment, "segment");
        return violation === null
          ? []
          : [`segment ${JSON.stringify(segment)}: ${violation}`];
      });
      if (segmentViolations.length > 0) {
        findings.push({
          condition: "14.4",
          message: `invalid id ${JSON.stringify(node.id)}: ${segmentViolations.join("; ")}`,
          file: rel,
          locations: [bytesOf(node.idAttr)],
        });
      }
      // Condition 14.2 (SPEC 1.3): the child ID equals the parent ID plus
      // exactly one segment, compared as segment sequences (an empty segment
      // is a 1.4 matter, not a structural one), located at the section's
      // `id` attribute (SPEC 14). A top-level section is checked against the
      // empty prefix: exactly one segment. Masking (SPEC 14.2): for the
      // immediate children of a section spelling no identity — `id` missing
      // (condition 1), repeated, or in invalid value form (condition 17) —
      // the parent's condition masks this one; their other conditions, and
      // this condition for their own children, report normally. Every such
      // parent has `id` null here, so one test covers all three cases.
      const parent = node.parent;
      if (parent.isRoot || parent.id !== null) {
        const parentSegments = parent.isRoot ? [] : segmentsOf(parent.id);
        const structural =
          segments.length === parentSegments.length + 1 &&
          parentSegments.every((segment, index) => segments[index] === segment);
        if (!structural) {
          findings.push({
            condition: "14.2",
            message: parent.isRoot
              ? `invalid structural id ${JSON.stringify(node.id)}: a top-level section's id ` +
                `is exactly one segment — checked against the empty prefix (SPEC 1.3)`
              : `invalid structural id ${JSON.stringify(node.id)}: a child id equals its ` +
                `parent's id plus "." plus exactly one segment — expected the form ` +
                `"${parent.id}.<segment>" (SPEC 1.3)`,
            file: rel,
            locations: [bytesOf(node.idAttr)],
          });
        }
      }
      // Condition 14.3 (SPEC 1.3): IDs unique within a source file. Every
      // section spelling an identity bears it; the duplicates are reported
      // after the walk, one finding per spelling (below).
      const spelled = bearers.get(node.id);
      if (spelled === undefined) {
        bearers.set(node.id, [node.idAttr]);
      } else {
        spelled.push(node.idAttr);
      }
    }
    // Condition 14.4 for tags (SPEC 1.4, 2.6): every token of the 2.6 split
    // follows the segment rules with `.` allowed. Zero tokens behave as an
    // omitted prop and validate nothing. One finding per offending `tags`
    // attribute, however many tokens violate, located at the attribute.
    if (node.tagsRaw !== undefined) {
      const tokenViolations = splitTags(node.tagsRaw).flatMap((token) => {
        const violation = valueViolation(token, "tag");
        return violation === null
          ? []
          : [`tag ${JSON.stringify(token)}: ${violation}`];
      });
      if (tokenViolations.length > 0) {
        findings.push({
          condition: "14.4",
          message: `invalid tags ${JSON.stringify(node.tagsRaw)}: ${tokenViolations.join("; ")} (SPEC 2.6)`,
          file: rel,
          locations: [bytesOf(node.tagsAttr)],
        });
      }
    }
  }
  // Condition 14.3 (SPEC 1.3, 14): several sections jointly violate
  // uniqueness — one finding per duplicated spelling, carrying a location for
  // every bearer, its `id` attribute, in document order; no representative is
  // chosen. Uniqueness is per file: the same ID in two files is valid.
  for (const [id, attributes] of bearers) {
    if (attributes.length < 2) continue;
    findings.push({
      condition: "14.3",
      message: `duplicate id ${JSON.stringify(id)}: ids are unique within a source file (SPEC 1.3)`,
      file: rel,
      locations: attributes.map(bytesOf),
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Workspace model: nodes with identity, sourceRange, tags, metadataHash
// ---------------------------------------------------------------------------

/**
 * metadataHash (SPEC 5.5, scoped): a deterministic digest of the node's
 * collapsed, sorted tag set — its `d` set is always empty and its coverage
 * attribute default in this scope — so 2.6-equivalent `tags` spellings hash
 * identically and zero-token values hash as the omitted prop.
 */
function metadataHashOf(tags) {
  return sha256Hex(`metadata:${canonicalJson(tags)}`);
}

/**
 * Analyze one source file: findings (14.20 masks the file's insides), plus
 * the file's nodes — root first, then sections in document order — when it
 * parsed.
 */
function analyzeFile(rel, bytes) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return {
      findings: [
        {
          condition: "14.20",
          message: `unparseable source: ${rel} is not valid UTF-8 (SPEC 1.6, 14.20)`,
          file: rel,
          locations: [{ start: 0, end: Math.min(1, bytes.length) }],
        },
      ],
      nodes: [],
    };
  }
  if (text.startsWith("\uFEFF")) {
    return {
      findings: [
        {
          condition: "14.20",
          message: `unparseable source: ${rel} begins with a byte-order mark (SPEC 1.6, 14.20)`,
          file: rel,
          locations: [{ start: 0, end: 3 }],
        },
      ],
      nodes: [],
    };
  }
  const byteOf = byteOffsetMapper(text, bytes.length);
  const parsed = parseMdx(text);
  if (parsed.failure !== null) {
    // An unparseable file masks the conditions inside itself (SPEC 14).
    const at = byteOf(Math.min(parsed.failure.at, text.length));
    return {
      findings: [
        {
          condition: "14.20",
          message: `unparseable source: ${parsed.failure.message} (SPEC 14.20)`,
          file: rel,
          locations: [{ start: at, end: Math.min(at + 1, bytes.length) }],
        },
      ],
      nodes: [],
    };
  }
  const findings = validateSections(rel, parsed.sections, byteOf);
  const nodes = [];
  // A root carries no tags (SPEC 5.5): its empty internal tag set feeds the
  // metadataHash and the `--tag` filter, while its reported tags datum is
  // absent (`reportedTags`, SPEC 11.1).
  const rootTags = collapsedTags(undefined);
  nodes.push({
    identity: rel,
    isRoot: true,
    sourceRange: { start: 0, end: bytes.length },
    tags: rootTags,
    metadataHash: metadataHashOf(rootTags),
  });
  for (const section of parsed.sections) {
    if (section.id === null) continue; // only reachable alongside findings
    const tags = collapsedTags(section.tagsRaw);
    nodes.push({
      identity: `${rel}#${section.id}`,
      isRoot: false,
      sourceRange: {
        start: byteOf(section.openStart),
        end: byteOf(section.closeEnd),
      },
      tags,
      metadataHash: metadataHashOf(tags),
    });
  }
  return { findings, nodes };
}

/**
 * Load the workspace: configuration, discovery, and every discovered
 * source's analysis. Files in byte order of workspace-relative path, nodes
 * within a file in document order (root first) — deterministic (SPEC 12.0).
 */
async function loadWorkspace(cwd, configFlag) {
  const config = await loadConfig(cwd, configFlag);
  const rels = await discoverSources(config.root, config.groups);
  /** @type {Finding[]} */
  const findings = [];
  const nodes = [];
  /** Discovered files whose parse failed (14.20): masked within. */
  const unparseable = new Set();
  for (const rel of rels) {
    const bytes = await fsp.readFile(path.join(config.root, rel));
    const analyzed = analyzeFile(rel, bytes);
    findings.push(...analyzed.findings);
    nodes.push(...analyzed.nodes);
    if (analyzed.findings.some((finding) => finding.condition === "14.20")) {
      unparseable.add(rel);
    }
  }
  return { config, discovered: new Set(rels), unparseable, findings, nodes };
}

// ---------------------------------------------------------------------------
// Commands (SPEC 12.0 conventions; the §CONF-VALID surface)
// ---------------------------------------------------------------------------

// SPEC 14's stable code tokens by condition ordinal ("14.N" → token). The
// JSON report carries the token string alone (SPEC 12.7, 14); the ordinal
// orders findings and is no part of the value. Only the conditions this
// conformer's scope reports appear.
const CODE_TOKENS = {
  14.1: "missing-id",
  14.2: "invalid-structural-id",
  14.3: "duplicate-id",
  14.4: "invalid-segment-or-tag",
  14.17: "invalid-prop",
  "14.20": "unparseable-source",
};

/** A condition's ordinal (the `N` of `14.N`), ordering findings (SPEC 12.7). */
function conditionOrdinal(condition) {
  return Number(condition.slice(3));
}

/**
 * The pinned findings order (SPEC 12.7): by code (numbered conditions in
 * numeric order), then locations element-wise (file path bytes, range start,
 * range end; a proper prefix first), then concerned path (null first), then
 * identities, then message — over this conformer's all-located findings the
 * live dimensions are ordinal, locations, and message.
 */
function compareFindingDocs(a, b) {
  const byOrdinal =
    conditionOrdinal(a.internalCondition) -
    conditionOrdinal(b.internalCondition);
  if (byOrdinal !== 0) return byOrdinal;
  const shared = Math.min(a.locations.length, b.locations.length);
  for (let i = 0; i < shared; i += 1) {
    const byFile = Buffer.compare(
      Buffer.from(a.locations[i].file, "utf8"),
      Buffer.from(b.locations[i].file, "utf8"),
    );
    if (byFile !== 0) return byFile;
    if (a.locations[i].range.start !== b.locations[i].range.start) {
      return a.locations[i].range.start - b.locations[i].range.start;
    }
    if (a.locations[i].range.end !== b.locations[i].range.end) {
      return a.locations[i].range.end - b.locations[i].range.end;
    }
  }
  if (a.locations.length !== b.locations.length) {
    return a.locations.length - b.locations.length;
  }
  return Buffer.compare(
    Buffer.from(a.message, "utf8"),
    Buffer.from(b.message, "utf8"),
  );
}

/**
 * The findings report in the 12.7 form: one `{"code", "message",
 * "locations", "path", "identities"}` per finding — every condition this
 * scope reports locates in source, so `locations` carries one `{"file",
 * "range"}` per offending construct, ordered by range start, then range end
 * (one file per finding), and `path` is null — in the pinned findings order,
 * findings identical in every member collapsed to one (SPEC 12.7).
 */
function findingsDoc(findings) {
  const docs = findings.map((finding) => ({
    code: CODE_TOKENS[finding.condition],
    message: finding.message,
    locations: [...finding.locations]
      .sort((a, b) => a.start - b.start || a.end - b.end)
      .map((range) => ({ file: finding.file, range })),
    path: null,
    identities: [],
    internalCondition: finding.condition,
  }));
  docs.sort(compareFindingDocs);
  const collapsed = [];
  for (const doc of docs) {
    const previous = collapsed[collapsed.length - 1];
    if (previous !== undefined && compareFindingDocs(previous, doc) === 0) {
      continue;
    }
    collapsed.push(doc);
  }
  return {
    findings: collapsed.map(
      ({ code, message, locations, path, identities }) => ({
        code,
        message,
        locations,
        path,
        identities,
      }),
    ),
  };
}

function emitFindings(io, json, findings) {
  if (json) {
    io.stdout(canonicalJson(findingsDoc(findings)) + "\n");
  } else {
    io.stdout(
      findings
        .map(
          (finding) =>
            `${finding.file}: ${finding.condition}: ${finding.message}\n`,
        )
        .join(""),
    );
  }
}

// ---------------------------------------------------------------------------
// Invocation grammar (SPEC 12.0)
// ---------------------------------------------------------------------------

const REPLACEMENT_CHARACTER = String.fromCodePoint(0xfffd);

/**
 * Every flag of every command with its arity, fixed by name (SPEC 12.0): 1
 * for a flag taking the whole next token as its value, 0 for one taking
 * none — the flags the synopses and defining sections name (6, 8, 9, 10.7,
 * 11, 12, 13.5). A `--` token naming no flag of any command takes no value.
 */
const FLAG_ARITY = new Map([
  ["--json", 0],
  ["--preview", 0],
  ["--tree", 0],
  ["--text", 0],
  ["--check", 0],
  ["--unreferenced", 0],
  ["--config", 1],
  ["--test-hold", 1],
  ["--file", 1],
  ["--to", 1],
  ["--from", 1],
  ["--kinds", 1],
  ["--group", 1],
  ["--tag", 1],
  ["--coverage", 1],
  ["--base", 1],
  ["--strategy", 1],
  ["--name", 1],
  ["--status", 1],
  ["--note", 1],
]);

/** Every command of the product (12). */
const PRODUCT_COMMANDS = new Set([
  "build",
  "check",
  "ids",
  "show",
  "coverage",
  "impact",
  "review",
  "query",
  "occurrences",
  "view",
  "at",
  "inventory",
  "rename",
  "move",
  "version",
]);

/**
 * The commands whose every surface is JSON-only (SPEC 12.0: 11's `query`,
 * `occurrences`, `view`, `at`, and `inventory`; 12.6's `version`) — beside
 * 10.7's `review export`, a subcommand's surface.
 */
const JSON_ONLY_COMMANDS = new Set([
  "query",
  "occurrences",
  "view",
  "at",
  "inventory",
  "version",
]);

/**
 * Whether the invoked surface — the command word and, for `review`, its
 * subcommand, both among the non-flag tokens (12.0) — is JSON-only, a single
 * JSON document its only output form with or without `--json` (12.0).
 */
function isJsonOnlySurface(words) {
  const [command, subcommand] = words;
  return (
    JSON_ONLY_COMMANDS.has(command) ||
    (command === "review" && subcommand === "export")
  );
}

/**
 * The synopses this fixture judges (SPEC 11.1, 12.1): `build`'s and each
 * `query` subcommand's — the flags the synopsis names beside the globals
 * `--json` and `--config` (12.0), the flags it requires, its operand count,
 * whether this fixture serves it, and the named flags it does not serve.
 * Every syntax-class check (12.0) runs before any scope refusal, so an
 * unserved subcommand or flag is refused loudly (ScopeError, exit 70) only
 * once the arguments match its synopsis — a usage error is never masked by
 * a scope refusal. Every other product command is refused once the checks
 * the arguments alone decide for every command have passed.
 * @typedef {{ flags: readonly string[], required?: readonly string[],
 *             operands: number, served: boolean,
 *             unservedFlags?: readonly string[] }} Synopsis
 * @type {Synopsis}
 */
const BUILD_SYNOPSIS = { flags: [], operands: 0, served: true };

/** @type {Map<string, Synopsis>} */
const QUERY_SYNOPSES = new Map([
  ["node", { flags: [], operands: 1, served: true }],
  [
    "nodes",
    {
      flags: ["--group", "--file", "--tag", "--coverage"],
      operands: 0,
      served: true,
      unservedFlags: ["--group", "--file", "--coverage"],
    },
  ],
  [
    "edges",
    { flags: ["--from", "--to", "--kinds"], operands: 0, served: false },
  ],
  ["subtree", { flags: [], operands: 1, served: false }],
  ["ancestors", { flags: [], operands: 1, served: false }],
  [
    "reachable",
    {
      flags: ["--from", "--to", "--kinds"],
      required: ["--from", "--to"],
      operands: 0,
      served: false,
    },
  ],
]);

/**
 * An argument value is malformed when it is not valid UTF-8 or contains
 * U+FFFD (SPEC 12.0); Node decodes argv lossily, an ill-formed byte arriving
 * as U+FFFD, so the one test covers both.
 */
function isMalformedValue(value) {
  return value.includes(REPLACEMENT_CHARACTER);
}

/**
 * Read the arguments under the grammar of SPEC 12.0: flag tokens anywhere —
 * before the command word, between it and its operands, or after them — a
 * value-taking flag taking the whole next token, whatever it looks like, and
 * `--` ending flag reading (dropped; every later token a non-flag token).
 * Returns the flags (name to value, `true` for a flag taking none), the
 * remaining non-flag tokens in order — the command, `query`'s subcommand,
 * then the operands — whether a `--json` token was read as a flag (never as
 * another flag's value), and the first syntax-class error met that the
 * arguments decide for every command alike, if any.
 */
function readInvocation(argv) {
  const flags = new Map();
  const words = [];
  let json = false;
  let error = null;
  const note = (message) => {
    if (error === null) error = message;
  };
  let flagsEnded = false;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!flagsEnded && token === "--") {
      flagsEnded = true;
      continue;
    }
    if (!flagsEnded && token.startsWith("--")) {
      if (token === "--json") json = true;
      if (flags.has(token)) {
        note(
          `repeated flag ${token}: a flag may be given at most once (SPEC 12.0)`,
        );
      }
      if (FLAG_ARITY.get(token) === 1) {
        if (i + 1 >= argv.length) {
          note(`flag ${token} lacks its value (SPEC 12.0)`);
          flags.set(token, true);
        } else {
          i += 1;
          const value = argv[i];
          if (isMalformedValue(value)) {
            note(
              `malformed value for ${token}: not valid UTF-8, or containing U+FFFD (SPEC 12.0)`,
            );
          }
          flags.set(token, value);
        }
      } else {
        if (!FLAG_ARITY.has(token)) note(`unknown flag ${token} (SPEC 12.0)`);
        flags.set(token, true);
      }
      continue;
    }
    if (isMalformedValue(token)) {
      note(
        "malformed argument: not valid UTF-8, or containing U+FFFD (SPEC 12.0)",
      );
    }
    words.push(token);
  }
  return { flags, words, json, error };
}

/**
 * The synopsis checks of SPEC 12.0's syntax class for `build` or one
 * `query` subcommand (`spelled`): every flag given is one it accepts — its
 * synopsis's, or the global `--json` and `--config` (`--test-hold` belongs
 * to the mutating commands alone, 13.5) — the operands match its synopsis
 * in number, and its required flags are given.
 */
function checkSynopsis(spelled, synopsis, flags, operands) {
  for (const name of flags.keys()) {
    if (
      name !== "--json" &&
      name !== "--config" &&
      !synopsis.flags.includes(name)
    ) {
      throw new UsageError(`unknown flag ${name} for ${spelled} (SPEC 12.0)`);
    }
  }
  if (operands.length < synopsis.operands) {
    throw new UsageError(`${spelled}: missing operand (SPEC 12.0)`);
  }
  if (operands.length > synopsis.operands) {
    throw new UsageError(
      `surplus operand ${operands[synopsis.operands]}: ${spelled} takes ${String(synopsis.operands)} operand(s) (SPEC 12.0)`,
    );
  }
  for (const name of synopsis.required ?? []) {
    if (!flags.has(name)) {
      throw new UsageError(
        `${spelled}: missing required flag ${name} (SPEC 11.1, 12.0)`,
      );
    }
  }
}

/** No deviation switch: the argument checks of every fixture alike. */
const NO_DEVIATIONS = Object.freeze({});

/**
 * `query nodes --tag`'s acceptance (SPEC 11.1): syntactic, whatever the
 * workspace contains — a spelling no tag can have under 1.4 (empty, or
 * containing whitespace, `"`, `#`, …) is a malformed value, a usage error
 * of the syntax class (12.0). Judged by 1.4's exact classes in every
 * fixture (`NO_DEVIATIONS`): the violators deviate in sources alone.
 */
function checkTagValue(value) {
  const violation = valueViolation(value, "tag", NO_DEVIATIONS);
  if (violation !== null) {
    throw new UsageError(
      `query nodes: malformed --tag value ${JSON.stringify(value)}: ${violation}, so no tag is so spelled (SPEC 11.1, 12.0)`,
    );
  }
}

/** `query nodes --coverage`'s vocabulary (SPEC 11.1). */
const COVERAGE_VALUES = new Set(["required", "none"]);

/**
 * A `--coverage` value outside its fixed vocabulary is an invalid flag
 * value of the syntax class (SPEC 11.1, 12.0).
 */
function checkCoverageValue(value) {
  if (!COVERAGE_VALUES.has(value)) {
    throw new UsageError(
      `query nodes: invalid --coverage value ${JSON.stringify(value)}: expected required or none (SPEC 11.1, 12.0)`,
    );
  }
}

/**
 * A `--file` pattern's outside-root rule (SPEC 7, 11.1), decided by its
 * spelling alone — an invalid flag value of 12.0's syntax class: reading
 * its `/`-separated segments from a depth of zero, a `..` segment lowers
 * the depth, a `.`, empty, or `**` segment leaves it, and every other
 * segment raises it; a leading `/` or a depth falling below zero lies
 * outside the root.
 */
function checkFileGlob(flag, value) {
  let depth = 0;
  let outside = value.startsWith("/");
  for (const segment of value.split("/")) {
    if (outside) break;
    if (segment === "..") {
      depth -= 1;
      outside = depth < 0;
    } else if (segment !== "." && segment !== "" && segment !== "**") {
      depth += 1;
    }
  }
  if (outside) {
    throw new UsageError(
      `invalid ${flag} value ${JSON.stringify(value)}: the pattern lies outside the workspace root (SPEC 7, 11.1, 12.0)`,
    );
  }
}

/**
 * A `<node>` spelling's syntax (SPEC 1.5, 12.0): at most one `#` is
 * well-formed — no identity contains one in path or id — so a spelling
 * with more is a malformed value, judged from the argument alone, before
 * configuration is loaded. Returns the path part.
 */
function nodePathOf(value) {
  const parts = value.split("#");
  if (parts.length > 2) {
    throw new UsageError(
      `query node: malformed node identity ${JSON.stringify(value)}: more than one "#" (SPEC 1.5, 12.0)`,
    );
  }
  return parts[0];
}

/** `xspec build` (SPEC 12.1, scoped): validate; write nothing. */
async function commandBuild(io, cwd, flags, json) {
  const workspace = await loadWorkspace(cwd, flags.get("--config"));
  if (workspace.findings.length > 0) {
    throw new FindingsError(workspace.findings);
  }
  if (json) {
    io.stdout(canonicalJson(findingsDoc([])) + "\n");
  }
  return 0;
}

/**
 * The tags datum a node's query answer reports (SPEC 11.1): a section's tag
 * set in the set form of 12.7 (`[]` when tagless), and, for a root node,
 * the stated absence — 11.1 reports a root's tags and coverage attribute
 * both as absent (a root carries no tags, 5.5), and 12.7 spells a datum
 * whose absence its defining section states as `null`, never `[]` (a
 * tagless *section*'s value). Only the reported datum is absent: the
 * internal model keeps a root's empty tag set, so its metadataHash is
 * computed from empty inputs (5.5) and no `--tag` filter selects it (11.1).
 */
function reportedTags(node) {
  return node.isRoot ? null : node.tags;
}

/**
 * The scoped query-surface document for one node (SPEC 11.1): a root's tags
 * `null` and its coverage attribute omitted — both absent for roots.
 */
function nodeDoc(node) {
  const doc = {
    identity: node.identity,
    sourceRange: node.sourceRange,
    tags: reportedTags(node),
    hashes: { metadataHash: node.metadataHash },
  };
  if (!node.isRoot) doc.coverage = "required";
  return doc;
}

/**
 * One `query nodes` row (SPEC 11.1: tags and coverage attribute both absent
 * for roots — the tags `null`, the coverage attribute omitted).
 */
function nodeRow(node) {
  const row = {
    identity: node.identity,
    sourceRange: node.sourceRange,
    tags: reportedTags(node),
  };
  if (!node.isRoot) row.coverage = "required";
  return row;
}

/**
 * `xspec query node <node>` (SPEC 11.1, scoped). `query` is JSON-only (12.0,
 * 11): a single JSON document is its only output form. The identity is
 * judged parse-local against the named file, identically on valid and
 * failing workspaces (12.0): its path a discovered source (every discovered
 * file is a spec source in scope, its group one spec group), its `id` among
 * the file's spelled identities (11.2) — an unparseable named file masking
 * the check (14.20) — and an unknown identity is a usage error, exit 2,
 * whatever findings the workspace carries. Only then does a workspace
 * failing `build`'s validations report exactly those findings and exit 1
 * without answering (13.3).
 */
async function commandQueryNode(io, cwd, flags, spelling) {
  const file = nodePathOf(spelling);
  const workspace = await loadWorkspace(cwd, flags.get("--config"));
  const named =
    workspace.discovered.has(file) &&
    (workspace.unparseable.has(file) ||
      workspace.nodes.some((candidate) => candidate.identity === spelling));
  if (!named) {
    throw new UsageError(
      `query node: unknown node identity ${JSON.stringify(spelling)}: no discovered spec source spells it (SPEC 11.1, 11.2, 12.0)`,
    );
  }
  if (workspace.findings.length > 0) {
    throw new FindingsError(workspace.findings);
  }
  const node = workspace.nodes.find(
    (candidate) => candidate.identity === spelling,
  );
  if (node === undefined) {
    throw new Error(`no node ${spelling} on a finding-free workspace`);
  }
  io.stdout(canonicalJson(nodeDoc(node)) + "\n");
  return 0;
}

/**
 * `xspec query nodes [--tag <t>]` (SPEC 11.1, scoped), JSON-only (12.0, 11).
 * The value spellings 11.1 fixes for its flags — `--tag`'s well-formedness,
 * `--coverage`'s vocabulary, `--file`'s outside-root rule — are of the
 * syntax class (12.0), decided before configuration is loaded and before
 * this fixture refuses the filters it does not serve (`--group`, `--file`,
 * `--coverage`). A well-formed tag no node carries matches nothing (11.1).
 */
async function commandQueryNodes(io, cwd, flags) {
  if (flags.has("--tag")) checkTagValue(flags.get("--tag"));
  if (flags.has("--coverage")) checkCoverageValue(flags.get("--coverage"));
  if (flags.has("--file")) checkFileGlob("--file", flags.get("--file"));
  for (const flag of QUERY_SYNOPSES.get("nodes").unservedFlags) {
    if (flags.has(flag)) {
      throw new ScopeError(
        `query nodes ${flag} is outside this fixture's scope (CERTIFICATIONS.md §CONF-VALID: query nodes with the --tag filter alone)`,
      );
    }
  }
  const workspace = await loadWorkspace(cwd, flags.get("--config"));
  if (workspace.findings.length > 0) {
    throw new FindingsError(workspace.findings);
  }
  const tag = flags.get("--tag");
  const rows = workspace.nodes
    .filter((node) => tag === undefined || node.tags.includes(tag))
    .map(nodeRow);
  io.stdout(canonicalJson({ nodes: rows }) + "\n");
  return 0;
}

// ---------------------------------------------------------------------------
// Entry: deviation seam + dispatch
// ---------------------------------------------------------------------------

/**
 * Deviation switches (CERTIFICATIONS.md §VIOL-VALID-*), all off in the
 * conformer. Each violator's bin-<name>.mjs threads exactly one switch
 * through runXspec's `options`:
 *   - `acceptNonWhitespaceControls` (§VIOL-VALID-CTRL, bin-ctrl.mjs):
 *     consumed in `valueViolation` — non-whitespace control characters are
 *     accepted in segments and tags.
 *   - `widenValidityWhitespace` (§VIOL-VALID-WIDE, bin-wide.mjs): consumed
 *     in `valueViolation` — U+00A0 and U+0085, exactly, are treated as
 *     whitespace for 1.4 validity, so segments and tags containing them are
 *     rejected with 14.4; tag splitting is unchanged.
 *   - `acceptLineSeparators` (§VIOL-VALID-SEP, bin-sep.mjs): consumed in
 *     `valueViolation` — 1.4's bar on U+2028 and U+2029 is not enforced, so
 *     segments and tags containing either are accepted; `"`, `'`, `\`, and
 *     `&` stay barred, and tag splitting is unchanged.
 * Each applies to the values sources spell alone: no switch reads the
 * arguments, and the one argument check judging 1.4 (`query nodes --tag`,
 * `checkTagValue`) passes `NO_DEVIATIONS`, so every violator reads its
 * invocation exactly as the conformer does (SPEC 12.0).
 */
let deviations = {};

/**
 * Run one xspec invocation. Returns the exit code (SPEC 12.0 partition).
 * `options` is the seam through which each violator fixture's bin-<name>.mjs
 * entry threads exactly one deviation switch (the conformer's bin.mjs passes
 * none).
 */
export async function runXspec(argv, cwd, options = {}) {
  deviations = options;
  const io = {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  };
  return await dispatchCommand(io, cwd, argv);
}

/**
 * Read one invocation under the grammar of SPEC 12.0, dispatch it, and map
 * its outcome to 12.0's codes. Every syntax-class error is decided from the
 * arguments alone, before configuration is loaded and before any of this
 * fixture's scope refusals (12.0): first the checks the arguments decide for
 * every command alike — unknown, repeated, or valueless flags and malformed
 * values (`readInvocation`) — then the command and `query`'s subcommand,
 * then the synopsis (`checkSynopsis`) and the served flags' value spellings.
 */
async function dispatchCommand(io, cwd, argv) {
  const invocation = readInvocation(argv);
  const [command, ...operands] = invocation.words;
  // JSON output is in effect when a `--json` token is read as a flag — not
  // as another flag's value — or when the invoked surface is JSON-only
  // (SPEC 12.0): `query` among the served ones (11), so its every answer,
  // gated report, and usage error is JSON, with or without `--json`. It
  // governs error delivery even when the arguments are the error.
  const jsonInEffect = invocation.json || isJsonOnlySurface(invocation.words);
  try {
    if (invocation.error !== null) throw new UsageError(invocation.error);
    if (command === undefined) {
      throw new UsageError("expected a command (SPEC 12.0)");
    }
    if (!PRODUCT_COMMANDS.has(command)) {
      throw new UsageError(
        `unknown command ${command} (SPEC 12.0; this fixture's surface is build, query node, and query nodes, CERTIFICATIONS.md §CONF-VALID)`,
      );
    }
    let spelled = command;
    let synopsis = BUILD_SYNOPSIS;
    let rest = operands;
    if (command === "query") {
      const [subcommand, ...subcommandOperands] = operands;
      if (subcommand === undefined) {
        throw new UsageError("query: missing subcommand (SPEC 11.1, 12.0)");
      }
      synopsis = QUERY_SYNOPSES.get(subcommand);
      if (synopsis === undefined) {
        throw new UsageError(
          `query: unknown subcommand ${subcommand} (SPEC 11.1, 12.0)`,
        );
      }
      spelled = `query ${subcommand}`;
      rest = subcommandOperands;
    } else if (command !== "build") {
      throw new ScopeError(
        `the ${command} command is outside this fixture's surface: build, query node, and query nodes alone (CERTIFICATIONS.md §CONF-VALID)`,
      );
    }
    checkSynopsis(spelled, synopsis, invocation.flags, rest);
    if (!synopsis.served) {
      throw new ScopeError(
        `${spelled} is outside this fixture's scope (CERTIFICATIONS.md §CONF-VALID: query node and query nodes alone)`,
      );
    }
    const { flags } = invocation;
    switch (spelled) {
      case "build":
        return await commandBuild(io, cwd, flags, jsonInEffect);
      case "query node":
        return await commandQueryNode(io, cwd, flags, rest[0]);
      case "query nodes":
        return await commandQueryNodes(io, cwd, flags);
      default:
        throw new Error(`no handler for the served surface ${spelled}`);
    }
  } catch (error) {
    if (error instanceof UsageError) {
      // Usage/configuration errors (SPEC 12.0): the message is stderr
      // content in both output forms. With JSON output in effect the single
      // 12.7 error document — {"error": …} holding one finding form, its
      // stable code and concerned path for a configuration error, null/null
      // for a plain usage error — is the entire stdout; without it, stdout
      // stays empty. The output form never changes the exit code or the
      // standard-error content.
      if (jsonInEffect) {
        io.stdout(
          canonicalJson({
            error: {
              code: error.code,
              message: error.message,
              locations: [],
              path: error.path,
              identities: [],
            },
          }) + "\n",
        );
      }
      io.stderr(`xspec: ${error.message}\n`);
      return 2;
    }
    if (error instanceof FindingsError) {
      emitFindings(io, jsonInEffect, error.findings);
      return 1;
    }
    if (error instanceof ScopeError) {
      // Outside this fixture's scope (CERTIFICATIONS.md §CONF-VALID):
      // refused loudly, outside the 12.0 partition — never answered, never
      // misreported as a usage error.
      io.stderr(`xspec: fixture scope error: ${error.message}\n`);
      return 70;
    }
    // A crash is a fixture bug: exit outside the 12.0 partition so every
    // exit-code assertion fails loudly and the diagnosis carries the stack.
    io.stderr(
      `xspec: internal fixture error: ${error?.stack ?? String(error)}\n`,
    );
    return 70;
  }
}
