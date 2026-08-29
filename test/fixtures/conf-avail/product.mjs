// CONF-AVAIL conformer fixture (CERTIFICATIONS.md §CONF-AVAIL; TEST-SPEC 17
// C-1/C-2). A harness-owned executable product implementing §CONF-AVAIL's
// Scope with the simplest conforming behavior — driven only through the C-2
// executable/workspace binding, never importing product code (the product and
// the harness are distinct programs; this fixture is part of the harness).
//
// Scope implemented (see CERTIFICATIONS.md §CONF-AVAIL):
// - Workspaces of configured spec groups of `.mdx` sources at valid-UTF-8,
//   `#`-free workspace-relative paths — imports (2.1), `d` props, and
//   `{text(...)}` embeddings as the in-scope fixtures stage them; no code
//   groups, `markdown`, `coverage`, `policy`, or git.
// - Command surface: `view`, with and without `--text` — the bare
//   whole-domain form (neither operands nor `--file`: every discovered spec
//   source viewed, 11.4) and the operand and `--file` forms — and
//   `occurrences` — the bare unrestricted form (the entire discovered set,
//   11.3) and `--file`/`--to` — each answering in the form-exact 12.7
//   document forms. `at` (the 11.2 preamble's third surface) is NOT served:
//   no in-scope staging drives it (the scope's stated staging constraint).
// - Contracts under certification: the availability rules of 11.2 —
//   parse-local structure and positional trees (a section inside an invalid
//   non-section element parenting to the innermost enclosing SECTION
//   construct, 11.4), spelled-identity definedness (exactly one quoted
//   static `id`), the chain conditions (spelling, well-formedness,
//   structural conformance inherited through the positional section
//   enclosure; uniqueness constraining the section's OWN spelled identity
//   alone), interpreted tags and coverage, resolution through defined
//   identities (a reference resolves exactly when it names exactly one
//   target whose own node identity is defined — never a picked bearer,
//   never an unavailable target), whole-value expansion poisoning with own
//   and subtree text per the rules of 3 (1.6; emission out of scope), and
//   removal classification by syntactic form; occurrence records per
//   5.7/11.3 with `source` withheld as ONE datum where undefined; the
//   `--file` domain restriction and `--to` selection of 11.3; the raw
//   attribute and import data of 11.4; findings per 11.2/14 with stable
//   codes and located ranges for the staged conditions (14.1, 14.3, 14.4,
//   14.5, 14.6, 14.9, 14.15, 14.16, 14.17); and the exit discipline of 11.2
//   (any finding or explicitly-unavailable datum in the emitted answer →
//   exit 1 with the full answer still emitted; complete and finding-free →
//   exit 0). Graph data and refresh behavior are out of scope: the two
//   commands read sources and write NOTHING.
//
// Key mechanisms:
// - Configuration, glob matching, and discovery are ports of the CONF-MD /
//   CONF-DISC fixtures' machinery (SPEC 7): patterns resolve relative to the
//   configuration file's directory; `*`, `?`, `**`, the dot-segment rule,
//   byte-wise case-sensitive matching, every other character a literal;
//   discovery walks plain files (symbolic links never discovered, never
//   traversed) and applies the 13.4 derived-path exclusion.
// - Sources are scanned by an MDX-lite parser for exactly the scope's
//   constructs: spec-module import declarations at MDX ESM block positions
//   (file start, after a blank line, or continuing a run of import lines —
//   an `import` line inside a paragraph is prose, never a declaration),
//   `<S>`/`<Spec>` sections (paired and self-closing) with every spelled
//   attribute recorded `{name, range, text}` in tag order (quoted, braced,
//   valueless, and spread forms alike), invalid non-section elements
//   (`<div>`, `<em>`, …: 14.16 — no view node, content preserved
//   byte-for-byte, sections inside them parenting to the innermost
//   enclosing SECTION construct), MDX comments `{/* … */}`, and
//   `{text(...)}` embeddings (local string and external property-chain
//   forms). Unbalanced or malformed construct syntax is 14.20 (masking the
//   file's other conditions; the file contributes no view).
// - Identity (11.2): a section SPELLS an identity exactly when exactly one
//   `id` attribute occurs on its tag with a quoted static-string value —
//   repeated (agreeing or not), braced, and valueless forms spell none
//   (14.17; absence alone is 14.1). A node identity is DEFINED exactly when
//   the file's path is valid and every section of its positional chain
//   (itself and each enclosing section) spells a well-formed (1.4),
//   structurally conformant (1.3; masked where the parent spells none)
//   identity, and the section's OWN spelled identity is spelled by no other
//   section of the file (uniqueness contests spelled identities only —
//   duplication is not a chain condition, and an invalid `id` form contests
//   nothing). Roots: identity is the workspace-relative path.
// - Resolution (11.2): a local spelling names the sections of its own file
//   spelling exactly that identity; an external spelling names them through
//   a valid default-binding import's resolved target (an empty chain names
//   the target's root). The reference resolves exactly when it names
//   exactly one target whose own node identity is defined; it then records
//   an occurrence (5.7) — `file`, its own `range` (the string literal
//   quotes included for a local `d` entry, the property chain's characters
//   for an external one, the whole braced container for an embedding),
//   `kind`, `source` (the enclosing section's `{identity, range}` or the
//   unavailability marker where 11.2 leaves that identity undefined — one
//   datum, never null, never a picked bearer), and `target`. A
//   non-resolving spelling records nothing and is reported by its finding
//   (14.5 for `d`, 14.6 for `text(...)`, located at the reference).
// - Cycles (5.3, 14.9): strongly connected components over the recorded
//   reference edges (self-loops included); one finding per cycle, locating
//   every participating reference spelling.
// - Text (11.2, 1.6, 3): own and subtree text ride the CONF-MD fixture's
//   attributed line-model compile — removals (import declarations by FORM,
//   section tags, MDX comments) deleted in place, embedding containers
//   replaced by their targets' subtree texts, and a line that contained
//   non-whitespace in the source but is left empty or whitespace-only
//   purely by removals dropped with its terminator. A value is defined
//   exactly when every embedding its expansion transitively reaches
//   records an occurrence and the recursion re-enters no node already
//   being expanded — one unresolved spelling or one cycle on the expansion
//   path poisons the WHOLE value (the unavailability marker; partial
//   expansion never occurs). Same-file embedding targets close before
//   their embeddings in every staged fixture; a self, enclosing, or
//   forward same-file target is always poisoned (cycle or staging outside
//   the scope), so its fabricated empty expansion is never read.
// - Emission (12.0, 12.7): both commands are JSON-only — one JSON document
//   is the entire stdout, with or without `--json`, serialized with
//   byte-sorted keys; findings carry exactly {"code", "message",
//   "locations", "path", "identities"} with SPEC 14's stable tokens, in the
//   pinned 12.7 order with identical findings collapsed; the exit code is
//   computed from the pre-serialization document (findings present, or any
//   unavailability marker in the answer → 1; else 0) so the datum-form
//   deviations below change bytes, never exits.
//
// Determinism (SPEC 12.0): no wall clock, no randomness, no absolute paths
// in any output; files in byte order of workspace-relative path; all JSON
// serialized with byte-sorted keys.
//
// Deviation seam: runXspec(argv, cwd, options) assigns `options` onto the
// module-level `deviations` switches (all off = this conformer). Each
// VIOL-AVAIL-* violator entry is a bin-<name>.mjs passing exactly one
// switch, consumed at the hook points pinned below:
//   - §VIOL-AVAIL-NULLMARKER (bin-nullmarker.mjs): `nullMarkers`, consumed
//     in `materializeValue` — the single serialization point every emitted
//     document passes through — carrying every undefined datum as `null` in
//     place of {"unavailable": true}. Which data are undefined, all defined
//     values, findings, exit codes, and every other member are unchanged
//     (the exit scan reads the pre-serialization document).
//   - §VIOL-AVAIL-OMIT (bin-omit.mjs): `omitNullMembers`, consumed in
//     `materializeValue` — every object member whose value would be the
//     stated `null` is absent from the emitted document. Members with
//     plain, marker, or list values, which findings exist, and exit codes
//     are unchanged.
//   - §VIOL-AVAIL-NOFILE (bin-nofile.mjs): `ignoreFileRestriction`,
//     consumed in `commandOccurrences`' domain computation — the `--file`
//     flag and its argument are still accepted as specified, but the
//     consulted domain is the entire discovered set, exactly as with the
//     flag absent; `--to` selection, `view`, and every other behavior are
//     unchanged.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// Outcome carriers and deviation switches
// ---------------------------------------------------------------------------

/**
 * Usage or configuration error (SPEC 12.0 exit 2): message on stderr; the
 * served surfaces are JSON-only, so the single 12.7 error document is the
 * entire stdout whenever one of them errs (12.0). `code`/`path` are the
 * error finding's stable code and concerned path — set for configuration
 * errors (14.14), `null` for plain usage errors (SPEC 12.7).
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

/** See the module header for the three switches and their hook points. */
let deviations = {};

// ---------------------------------------------------------------------------
// The unavailability marker (SPEC 12.7) as an in-memory sentinel
// ---------------------------------------------------------------------------

/**
 * The one in-memory sentinel every undefined datum is carried as until
 * serialization. Reference-compared (`value === UNAVAILABLE`), so no data
 * value can collide with it; `materializeValue` renders it as the literal
 * 12.7 marker — or as `null` under §VIOL-AVAIL-NULLMARKER's switch.
 */
const UNAVAILABLE = Object.freeze({ unavailableSentinel: true });

/** Whether the pre-serialization document carries any unavailable datum. */
function containsUnavailable(value) {
  if (value === UNAVAILABLE) return true;
  if (Array.isArray(value)) return value.some(containsUnavailable);
  if (value !== null && typeof value === "object") {
    return Object.values(value).some(containsUnavailable);
  }
  return false;
}

/**
 * Render a document value for emission: byte-sorted keys (SPEC 12.0
 * determinism), the marker sentinel as the literal 12.7 form. The two
 * datum-form deviation switches hook exactly here (module header):
 * `nullMarkers` (§VIOL-AVAIL-NULLMARKER) carries the sentinel as `null`;
 * `omitNullMembers` (§VIOL-AVAIL-OMIT) drops every object member whose
 * rendered value is `null` (list elements are never members and stay).
 */
function materializeValue(value) {
  if (value === UNAVAILABLE) {
    return deviations.nullMarkers ? null : { unavailable: true };
  }
  if (Array.isArray(value)) return value.map(materializeValue);
  if (value !== null && typeof value === "object") {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const rendered = materializeValue(value[key]);
      if (rendered === null && deviations.omitNullMembers) continue;
      out[key] = rendered;
    }
    return out;
  }
  return value;
}

/** Serialize one emitted document (the entire stdout, SPEC 12.0). */
function renderDocument(doc) {
  return JSON.stringify(materializeValue(doc)) + "\n";
}

// ---------------------------------------------------------------------------
// Configuration (SPEC 7): upward search + declarative literal parse
// ---------------------------------------------------------------------------

const CONFIG_NAME = "xspec.config.ts";

/**
 * The anchoring form of SPEC 11.6/14 for a path identified relative to the
 * invocation working directory (used by configuration-error findings).
 */
function anchoringPath(cwd, absPath) {
  const rel = path.relative(path.resolve(cwd), absPath);
  if (rel === "") return ".";
  return rel.split(path.sep).join("/");
}

async function pathOccupied(absPath) {
  try {
    await fsp.lstat(absPath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function findConfigPath(cwd, configFlag) {
  if (configFlag !== undefined) {
    const abs = path.resolve(cwd, configFlag);
    if (!(await pathOccupied(abs))) {
      throw new UsageError(
        `configuration file not found: --config ${configFlag}`,
        { code: "configuration-error", path: anchoringPath(cwd, abs) },
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
 * spec groups. The in-scope shape (CERTIFICATIONS.md §CONF-AVAIL) is spec
 * groups of glob strings and nothing else — no `code`, `markdown`,
 * `coverage`, or `policy` keys; anything else is refused loudly as a
 * configuration error rather than half-implemented (SPEC 7, 14.14).
 */
async function loadConfig(cwd, configFlag) {
  const configPath = await findConfigPath(cwd, configFlag);
  let text;
  try {
    text = await fsp.readFile(configPath, "utf8");
  } catch (error) {
    throw new UsageError(
      `configuration error: cannot read ${CONFIG_NAME}: ${error.message}`,
      { code: "configuration-error", path: anchoringPath(cwd, configPath) },
    );
  }
  const data = parseConfigSource(text);
  for (const key of Object.keys(data)) {
    if (key !== "specs") {
      throw new UsageError(
        `configuration error: the key ${JSON.stringify(key)} is unknown or outside this fixture's scope (CERTIFICATIONS.md §CONF-AVAIL; SPEC 7, 14.14)`,
      );
    }
  }
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

/** Byte-order comparison of workspace-relative paths (SPEC 12.7). */
function compareRelBytes(a, b) {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

async function discoverSources(root, groups) {
  const all = (await walkPlainFiles(root)).sort(compareRelBytes);
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
// SPEC 1.4 character classes, value validity, and tag splitting (SPEC 2.6)
// ---------------------------------------------------------------------------

/** SPEC 1.4's whitespace class, exactly: U+0009–U+000D and U+0020. */
function isValidityWhitespace(codePoint) {
  return (codePoint >= 0x0009 && codePoint <= 0x000d) || codePoint === 0x0020;
}

/** SPEC 1.4's control-character class, exactly: U+0000–U+001F and U+007F. */
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
 * SPEC 1.4 validity of one segment or tag value: invalid on emptiness, a
 * forbidden name, `.` (segments only), `#`, whitespace, or a control
 * character. Returns true exactly when valid.
 *
 * @param {string} value
 * @param {"segment" | "tag"} role
 */
function isValidValue(value, role) {
  if (value.length === 0) return false;
  if (FORBIDDEN_NAMES.has(value)) return false;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (character === "." && role === "segment") return false;
    if (character === "#") return false;
    if (isValidityWhitespace(codePoint)) return false;
    if (isValidityControl(codePoint)) return false;
  }
  return true;
}

/** A spelled identity's segments (split on `.`; segments never contain it). */
function identitySegments(spelling) {
  return spelling.split(".");
}

/** Whether every segment of a spelled identity is 1.4-valid. */
function isWellFormedIdentity(spelling) {
  return identitySegments(spelling).every((segment) =>
    isValidValue(segment, "segment"),
  );
}

/**
 * SPEC 2.6 tag splitting: tags split on runs of 1.4 whitespace with
 * leading/trailing whitespace ignored, then collapse to a sorted set.
 */
function splitTags(value) {
  const tokens = [];
  let current = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (isValidityWhitespace(codePoint)) {
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

// ---------------------------------------------------------------------------
// Line model (SPEC 3) and byte offsets (SPEC 1.7)
// ---------------------------------------------------------------------------

/** The drop rule's whitespace class: exactly SPEC 1.4's (no deviation here). */
function isDropWhitespaceCode(code) {
  return (code >= 0x0009 && code <= 0x000d) || code === 0x0020;
}

/** True when `text` is empty or consists only of drop-rule whitespace. */
function isWhitespaceOnlyForDrop(text) {
  for (let i = 0; i < text.length; i += 1) {
    if (!isDropWhitespaceCode(text.charCodeAt(i))) return false;
  }
  return true;
}

/**
 * The line terminator starting at `index`, or null: U+000D U+000A is one
 * terminator, a lone U+000A one, a lone U+000D one (SPEC 3).
 */
function terminatorAt(text, index) {
  const code = text.charCodeAt(index);
  if (code === 0x000a) return "\n";
  if (code === 0x000d) {
    if (text.charCodeAt(index + 1) === 0x000a) return "\r\n";
    return "\r";
  }
  return null;
}

/**
 * Map string (code-unit) indices to UTF-8 byte offsets (SPEC 1.7). ASCII
 * sources take the identity fast path; the multi-byte prose prefixes of the
 * staged fixtures take the general path.
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
// MDX-lite parser: imports, sections with full attribute records, invalid
// elements, comments, `{text(...)}` embeddings
// ---------------------------------------------------------------------------

/** Inter-attribute whitespace inside a tag (the SPEC 1.4 class, verbatim). */
const TAG_WHITESPACE = new Set(["\t", "\n", "\v", "\f", "\r", " "]);

const EMBED_OPEN_RE = /^\{[ \t]*text[ \t]*\(/;
const IDENTIFIER_RE = /^[$_\p{L}][$_\p{L}\p{N}]*/u;
const ATTR_NAME_RE = /^[A-Za-z][A-Za-z0-9_-]*/;

/**
 * Parse one source file. Returns
 * `{ root, sections, elements, imports, comments, embeds, pieces, failure }`:
 *   - `root`/`sections`: the positional section tree — per section the
 *     construct extents (open/close tag index ranges, self-closing flag),
 *     the positional SECTION parent (invalid element frames are skipped:
 *     SPEC 11.4's innermost-enclosing-section parenting), and every spelled
 *     attribute in tag order as `{name, form, value, start, end, valueStart}`
 *     (name `null` for a spread attribute; `form` one of "quoted", "braced",
 *     "none", "spread");
 *   - `elements`: each invalid non-section element's whole construct extent
 *     (14.16 — content preserved byte-for-byte, no view node);
 *   - `imports`: each declaration at an MDX ESM block position with its
 *     extent, default-binding identifier (or null), binding-form validity,
 *     and specifier;
 *   - `comments`: each MDX comment container's extent;
 *   - `embeds`: each `{text(...)}` container with its extent, reference, and
 *     owning section (or root);
 *   - `pieces`: the whole file in document order as content / removal /
 *     embed pieces for the SPEC 3 compile (invalid elements' tags are
 *     CONTENT — they match no removal rule's form);
 *   - `failure`: null, or `{ at, message }` (14.20 — an unparseable source,
 *     masking the conditions inside).
 */
function parseMdx(text) {
  const root = {
    isRoot: true,
    parent: null,
    children: [],
    attrs: [],
    openStart: 0,
    openEnd: 0,
    closeStart: text.length,
    closeEnd: text.length,
    selfClosing: false,
  };
  const sections = [];
  const elements = [];
  const imports = [];
  const comments = [];
  const embeds = [];
  const pieces = [];
  /** Frames: sections and invalid elements interleaved (proper nesting). */
  const frames = [{ kind: "section", node: root }];
  /** @type {{ at: number, message: string } | null} */
  let failure = null;
  let i = 0;
  let contentStart = 0;
  // The MDX ESM block rule (SPEC 2.1; the FP-094 lesson): an `import` line
  // is a declaration only at a block position — file start, after a blank
  // line, or continuing a run of import declarations — and only at top
  // level. `importRunUntil` marks the line start reached by consuming a
  // declaration plus its terminator.
  let importRunUntil = -1;

  const innermostSection = () => {
    for (let f = frames.length - 1; f >= 0; f -= 1) {
      if (frames[f].kind === "section") return frames[f].node;
    }
    return root;
  };
  const flushContent = (end) => {
    if (end > contentStart) {
      pieces.push({
        kind: "content",
        text: text.slice(contentStart, end),
        owner: innermostSection(),
      });
    }
  };
  const result = () => ({
    root,
    sections,
    elements,
    imports,
    comments,
    embeds,
    pieces,
    failure,
  });
  const fail20 = (at, message) => {
    failure = { at, message };
  };

  /** Whether `i` is a line start whose PREVIOUS line is blank. */
  const afterBlankLine = (index) => {
    if (index === 0) return true;
    // The character(s) before `index` must be a terminator; then the line
    // before that terminator must be empty or whitespace-only.
    let lineEnd = index - 1;
    if (text[lineEnd] === "\n" && text[lineEnd - 1] === "\r") lineEnd -= 1;
    if (text[lineEnd] !== "\n" && text[lineEnd] !== "\r") return false;
    let lineStart = lineEnd;
    while (
      lineStart > 0 &&
      text[lineStart - 1] !== "\n" &&
      text[lineStart - 1] !== "\r"
    ) {
      lineStart -= 1;
    }
    return isWhitespaceOnlyForDrop(text.slice(lineStart, lineEnd));
  };

  /** Scan a tag's attribute region; record entries when `record` given. */
  const scanAttributes = (start, record) => {
    let j = start;
    for (;;) {
      while (j < text.length && TAG_WHITESPACE.has(text[j])) j += 1;
      if (j >= text.length) return { end: -1, selfClosing: false, at: j };
      if (text[j] === ">") return { end: j + 1, selfClosing: false, at: j };
      if (text[j] === "/" && text[j + 1] === ">") {
        return { end: j + 2, selfClosing: true, at: j };
      }
      if (text[j] === "{") {
        // A spread attribute (SPEC 2.7): its `name` is structurally absent
        // and its source text is the whole braced construct.
        const scanned = scanBracedValue(j);
        if (scanned === null) return { end: -1, selfClosing: false, at: j };
        record?.push({
          name: null,
          form: "spread",
          value: undefined,
          start: j,
          end: scanned.end,
          valueStart: j + 1,
        });
        j = scanned.end;
        continue;
      }
      const attr = ATTR_NAME_RE.exec(text.slice(j));
      if (!attr) return { end: -1, selfClosing: false, at: j };
      const name = attr[0];
      const nameStart = j;
      j += name.length;
      if (text[j] !== "=") {
        // Valueless bare-name attribute: the entry is the name alone.
        record?.push({
          name,
          form: "none",
          value: undefined,
          start: nameStart,
          end: j,
          valueStart: j,
        });
        continue;
      }
      j += 1;
      const open = text[j];
      if (open === '"' || open === "'") {
        const valueStart = j + 1;
        const end = text.indexOf(open, valueStart);
        if (end === -1) return { end: -1, selfClosing: false, at: j };
        record?.push({
          name,
          form: "quoted",
          value: text.slice(valueStart, end),
          start: nameStart,
          end: end + 1,
          valueStart,
        });
        j = end + 1;
        continue;
      }
      if (open === "{") {
        const scanned = scanBracedValue(j);
        if (scanned === null) return { end: -1, selfClosing: false, at: j };
        record?.push({
          name,
          form: "braced",
          value: text.slice(j + 1, scanned.end - 1),
          start: nameStart,
          end: scanned.end,
          valueStart: j + 1,
        });
        j = scanned.end;
        continue;
      }
      return { end: -1, selfClosing: false, at: j };
    }
  };

  /** Quote-aware brace scan from an opening `{`; returns { end } or null. */
  const scanBracedValue = (start) => {
    let depth = 0;
    let k = start;
    for (;;) {
      if (k >= text.length) return null;
      const c = text[k];
      if (c === '"' || c === "'") {
        const end = text.indexOf(c, k + 1);
        if (end === -1) return null;
        k = end + 1;
        continue;
      }
      if (c === "{") depth += 1;
      else if (c === "}") {
        depth -= 1;
        if (depth === 0) return { end: k + 1 };
      }
      k += 1;
    }
  };

  /** Parse one import declaration at `start`; returns record or null. */
  const parseImportAt = (start) => {
    let j = start + "import".length;
    const skipSpaces = () => {
      while (text[j] === " " || text[j] === "\t") j += 1;
    };
    const readString = () => {
      const q = text[j];
      if (q !== '"' && q !== "'") return null;
      const end = text.indexOf(q, j + 1);
      if (end === -1) return null;
      const value = text.slice(j + 1, end);
      if (/[\r\n]/.test(value)) return null;
      j = end + 1;
      return value;
    };
    skipSpaces();
    let defaultName = null;
    let hasNamed = false;
    let hasNamespace = false;
    let sideEffect = false;
    if (text[j] === '"' || text[j] === "'") {
      sideEffect = true; // side-effect-only form: no binding clause at all
    } else {
      const readClause = () => {
        if (text[j] === "{") {
          const close = text.indexOf("}", j);
          if (close === -1) return false;
          if (/[\r\n]/.test(text.slice(j, close))) return false;
          hasNamed = true;
          j = close + 1;
          return true;
        }
        if (text[j] === "*") {
          j += 1;
          skipSpaces();
          if (!text.startsWith("as", j)) return false;
          j += 2;
          skipSpaces();
          const ident = IDENTIFIER_RE.exec(text.slice(j));
          if (!ident) return false;
          hasNamespace = true;
          j += ident[0].length;
          return true;
        }
        const ident = IDENTIFIER_RE.exec(text.slice(j));
        if (!ident || ident[0] === "from") return false;
        defaultName = ident[0];
        j += ident[0].length;
        return true;
      };
      if (!readClause()) return null;
      skipSpaces();
      if (text[j] === ",") {
        j += 1;
        skipSpaces();
        if (!readClause()) return null;
        skipSpaces();
      }
      if (!text.startsWith("from", j)) return null;
      j += "from".length;
      skipSpaces();
    }
    const specifier = readString();
    if (specifier === null) return null;
    if (text[j] === ";") j += 1;
    return {
      start,
      end: j,
      name: defaultName,
      // The 2.1 form is a SINGLE default binding: any named clause,
      // namespace clause, or side-effect-only spelling is an invalid
      // binding form (14.15) — the declaration is still listed (11.4).
      formValid: defaultName !== null && !hasNamed && !hasNamespace,
      sideEffect,
      specifier,
    };
  };

  while (i < text.length) {
    const ch = text[i];
    const atLineStart = i === 0 || text[i - 1] === "\n" || text[i - 1] === "\r";
    if (
      ch === "i" &&
      atLineStart &&
      frames.length === 1 &&
      /^import[ \t"'{*]/.test(text.slice(i, i + 8)) &&
      (i === importRunUntil || afterBlankLine(i))
    ) {
      const declaration = parseImportAt(i);
      if (declaration === null) {
        fail20(i, "malformed import declaration at an ESM block position");
        return result();
      }
      flushContent(i);
      imports.push(declaration);
      pieces.push({
        kind: "removal",
        text: text.slice(declaration.start, declaration.end),
      });
      i = declaration.end;
      contentStart = i;
      const terminator = terminatorAt(text, i);
      importRunUntil = terminator === null ? -1 : i + terminator.length;
      continue;
    }
    if (ch === "<") {
      const closeSection = /^<\/(S|Spec)[ \t\r\n\v\f]*>/.exec(text.slice(i));
      if (closeSection) {
        const frame = frames[frames.length - 1];
        if (frame.kind !== "section" || frame.node.isRoot) {
          fail20(i, "closing section tag without a matching open section");
          return result();
        }
        flushContent(i);
        frame.node.closeStart = i;
        frame.node.closeEnd = i + closeSection[0].length;
        pieces.push({ kind: "removal", text: closeSection[0] });
        frames.pop();
        i = frame.node.closeEnd;
        contentStart = i;
        continue;
      }
      const openSection = /^<(S|Spec)(?=[ \t\r\n\v\f/>])/.exec(text.slice(i));
      if (openSection) {
        flushContent(i);
        /** @type {object[]} */
        const attrs = [];
        const scanned = scanAttributes(i + openSection[0].length, attrs);
        if (scanned.end === -1) {
          fail20(scanned.at, "malformed or unterminated section tag");
          return result();
        }
        const node = {
          isRoot: false,
          parent: innermostSection(),
          children: [],
          attrs,
          openStart: i,
          openEnd: scanned.end,
          closeStart: scanned.selfClosing ? scanned.end : -1,
          closeEnd: scanned.selfClosing ? scanned.end : -1,
          selfClosing: scanned.selfClosing,
        };
        node.parent.children.push(node);
        sections.push(node);
        pieces.push({ kind: "removal", text: text.slice(i, scanned.end) });
        if (!scanned.selfClosing) frames.push({ kind: "section", node });
        i = scanned.end;
        contentStart = i;
        continue;
      }
      const closeElement = /^<\/([A-Za-z][A-Za-z0-9]*)[ \t\r\n\v\f]*>/.exec(
        text.slice(i),
      );
      if (closeElement) {
        const frame = frames[frames.length - 1];
        if (frame.kind !== "element" || frame.name !== closeElement[1]) {
          fail20(i, `mismatched closing tag </${closeElement[1]}>`);
          return result();
        }
        // The element's whole construct is one invalid construct (14.16):
        // located by its finding, no view entry, and CONTENT to the compile
        // (it matches no removal rule's form) — so its tags stay in the
        // pending content run, preserved byte-for-byte.
        elements.push({ start: frame.start, end: i + closeElement[0].length });
        frames.pop();
        i += closeElement[0].length;
        continue;
      }
      const openElement = /^<([A-Za-z][A-Za-z0-9]*)(?=[ \t\r\n\v\f/>])/.exec(
        text.slice(i),
      );
      if (openElement) {
        const scanned = scanAttributes(i + openElement[0].length, null);
        if (scanned.end === -1) {
          fail20(scanned.at, "malformed or unterminated element tag");
          return result();
        }
        if (scanned.selfClosing) {
          elements.push({ start: i, end: scanned.end });
        } else {
          frames.push({ kind: "element", name: openElement[1], start: i });
        }
        i = scanned.end;
        continue;
      }
      i += 1; // a plain `<` is ordinary content in this scope
      continue;
    }
    if (ch === "{") {
      if (text.startsWith("{/*", i)) {
        const end = text.indexOf("*/}", i + 3);
        if (end === -1) {
          fail20(i, "unterminated MDX comment");
          return result();
        }
        flushContent(i);
        comments.push({ start: i, end: end + 3 });
        pieces.push({ kind: "removal", text: text.slice(i, end + 3) });
        i = end + 3;
        contentStart = i;
        continue;
      }
      const embedMatch = EMBED_OPEN_RE.exec(text.slice(i));
      if (embedMatch) {
        let j = i + embedMatch[0].length;
        const skipWs = () => {
          while (j < text.length && TAG_WHITESPACE.has(text[j])) j += 1;
        };
        skipWs();
        let ref;
        const q = text[j];
        if (q === '"' || q === "'") {
          const end = text.indexOf(q, j + 1);
          if (end === -1) {
            fail20(j, "unterminated text(...) string argument");
            return result();
          }
          ref = { form: "local", id: text.slice(j + 1, end) };
          j = end + 1;
        } else {
          const ident = IDENTIFIER_RE.exec(text.slice(j));
          if (!ident) {
            fail20(j, "malformed text(...) argument");
            return result();
          }
          const binding = ident[0];
          j += binding.length;
          const segments = [];
          for (;;) {
            if (text[j] === ".") {
              const seg = IDENTIFIER_RE.exec(text.slice(j + 1));
              if (!seg) {
                fail20(j, "malformed property chain in text(...)");
                return result();
              }
              segments.push(seg[0]);
              j += 1 + seg[0].length;
              continue;
            }
            if (text[j] === "[") {
              const qq = text[j + 1];
              if (qq !== '"' && qq !== "'") {
                fail20(j, "malformed computed access in text(...)");
                return result();
              }
              const end = text.indexOf(qq, j + 2);
              if (end === -1 || text[end + 1] !== "]") {
                fail20(j, "malformed computed access in text(...)");
                return result();
              }
              segments.push(text.slice(j + 2, end));
              j = end + 2;
              continue;
            }
            break;
          }
          ref = { form: "external", binding, segments };
        }
        skipWs();
        if (text[j] !== ")") {
          fail20(j, "text(...) takes exactly one argument");
          return result();
        }
        j += 1;
        skipWs();
        if (text[j] !== "}") {
          fail20(j, "unterminated text(...) expression container");
          return result();
        }
        j += 1;
        flushContent(i);
        const embed = {
          start: i,
          end: j,
          ref,
          owner: innermostSection(),
          target: null,
        };
        embeds.push(embed);
        pieces.push({
          kind: "embed",
          text: text.slice(i, j),
          owner: embed.owner,
          embed,
        });
        i = j;
        contentStart = i;
        continue;
      }
      i += 1; // a stray `{` is ordinary content in this scope
      continue;
    }
    i += 1;
  }
  flushContent(text.length);
  if (frames.length !== 1) {
    const frame = frames[frames.length - 1];
    fail20(
      Math.max(0, text.length - 1),
      frame.kind === "section" ? "unclosed section tag" : "unclosed element",
    );
  }
  return result();
}

// ---------------------------------------------------------------------------
// `d` reference parsing (SPEC 2.2 — resolution and occurrence positions)
// ---------------------------------------------------------------------------

/**
 * Parse a braced `d` value's body (offsets relative to the body): a single
 * static reference or an array literal of them, each a string literal
 * (local form — the occurrence spans the literal, quotes included) or a
 * property chain rooted at an import binding (external form — the
 * occurrence spans the chain's characters). Returns the reference list with
 * per-reference `exprStart`/`exprEnd`, or null when malformed.
 */
function parseDReferences(body) {
  let j = 0;
  const skipWs = () => {
    while (j < body.length && TAG_WHITESPACE.has(body[j])) j += 1;
  };
  const parseOne = () => {
    const exprStart = j;
    const q = body[j];
    if (q === '"' || q === "'") {
      const end = body.indexOf(q, j + 1);
      if (end === -1) return null;
      const id = body.slice(j + 1, end);
      j = end + 1;
      return { form: "local", id, exprStart, exprEnd: j };
    }
    const ident = IDENTIFIER_RE.exec(body.slice(j));
    if (!ident) return null;
    const binding = ident[0];
    j += binding.length;
    const segments = [];
    for (;;) {
      if (body[j] === ".") {
        const seg = IDENTIFIER_RE.exec(body.slice(j + 1));
        if (!seg) return null;
        segments.push(seg[0]);
        j += 1 + seg[0].length;
        continue;
      }
      if (body[j] === "[") {
        const qq = body[j + 1];
        if (qq !== '"' && qq !== "'") return null;
        const end = body.indexOf(qq, j + 2);
        if (end === -1 || body[end + 1] !== "]") return null;
        segments.push(body.slice(j + 2, end));
        j = end + 2;
        continue;
      }
      break;
    }
    return { form: "external", binding, segments, exprStart, exprEnd: j };
  };
  const refs = [];
  skipWs();
  if (body[j] === "[") {
    j += 1;
    skipWs();
    if (body[j] === "]") {
      j += 1; // `d={[]}`: no dependencies (SPEC 2.2)
    } else {
      for (;;) {
        const ref = parseOne();
        if (ref === null) return null;
        refs.push(ref);
        skipWs();
        if (body[j] === ",") {
          j += 1;
          skipWs();
          continue;
        }
        if (body[j] === "]") {
          j += 1;
          break;
        }
        return null;
      }
    }
  } else {
    const ref = parseOne();
    if (ref === null) return null;
    refs.push(ref);
  }
  skipWs();
  return j >= body.length ? refs : null;
}

// ---------------------------------------------------------------------------
// Import specifier resolution (SPEC 2.1)
// ---------------------------------------------------------------------------

/** Import specifier → designated source path, or null where form defines none. */
function resolveImportTarget(fromRel, specifier) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return null;
  if (!specifier.endsWith(".xspec")) return null;
  const joined = path.posix.normalize(
    path.posix.join(path.posix.dirname(fromRel), specifier),
  );
  if (joined === ".." || joined.startsWith("../")) return null;
  return joined.slice(0, -".xspec".length) + ".mdx";
}

// ---------------------------------------------------------------------------
// Workspace analysis: identities, interpreted data, findings, occurrences
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
  14.5: "unknown-dependency",
  14.6: "unknown-text-target",
  14.8: "invalid-argument",
  14.9: "cycle",
  14.15: "invalid-import",
  14.16: "invalid-construct",
  14.17: "invalid-prop",
  "14.20": "unparseable-source",
};

/** Analyze one discovered source's bytes into a file record. */
function analyzeFile(rel, bytes) {
  const base = {
    rel,
    bytes,
    text: "",
    byteOf: (index) => index,
    parsed: null,
    /** spelling → sections spelling it (uniqueness + resolution). */
    idMap: new Map(),
    /** binding identifier → target rel (valid default imports only). */
    bindings: new Map(),
    /** per-section derived data (Map section → info). */
    info: new Map(),
    failure: null,
  };
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return {
      ...base,
      failure: { at: 0, message: `${rel} is not valid UTF-8 (SPEC 1.6)` },
    };
  }
  if (text.charCodeAt(0) === 0xfeff) {
    return {
      ...base,
      failure: {
        at: 0,
        message: `${rel} begins with a byte-order mark (SPEC 1.6)`,
      },
    };
  }
  const byteOf = byteOffsetMapper(text, bytes.length);
  const parsed = parseMdx(text);
  if (parsed.failure !== null) {
    return { ...base, text, byteOf, failure: parsed.failure };
  }
  return { ...base, text, byteOf, parsed };
}

/** A byte range for a string-index range of one record, clamped. */
function byteRange(record, startIndex, endIndex) {
  const clamp = (index) => Math.max(0, Math.min(index, record.text.length));
  return {
    start: record.byteOf(clamp(startIndex)),
    end: record.byteOf(clamp(endIndex)),
  };
}

/**
 * Load and analyze the whole workspace: discovery, per-file parse,
 * identity/interpreted-data computation, import resolution, reference
 * resolution with occurrence records, and every finding of the scope's
 * condition set. Reads sources only; writes nothing (graph data and refresh
 * behavior are out of CONF-AVAIL scope).
 */
async function loadWorkspace(cwd, configFlag) {
  const config = await loadConfig(cwd, configFlag);
  const rels = await discoverSources(config.root, config.groups);
  /** @type {{condition: string, message: string, locations: {file: string, range: {start: number, end: number}}[]}[]} */
  const findings = [];
  const files = new Map();
  for (const rel of rels) {
    const bytes = await fsp.readFile(path.join(config.root, ...rel.split("/")));
    files.set(rel, analyzeFile(rel, bytes));
  }

  const addFinding = (condition, message, locations) => {
    findings.push({ condition, message, locations });
  };

  // --- Pass 1: per-file structure — attributes, spelled identities,
  // interpreted tags/coverage, invalid elements, imports.
  for (const record of files.values()) {
    if (record.failure !== null) {
      addFinding(
        "14.20",
        `unparseable source: ${record.failure.message} (SPEC 14.20)`,
        [
          {
            file: record.rel,
            range: byteRange(record, record.failure.at, record.failure.at + 1),
          },
        ],
      );
      continue;
    }
    const { parsed } = record;
    const attrRange = (attr) => byteRange(record, attr.start, attr.end);
    const constructRange = (node) =>
      byteRange(record, node.openStart, node.closeEnd);

    for (const element of parsed.elements) {
      addFinding(
        "14.16",
        "invalid construct: a non-section element is not a recognized construct — content preserved, no view entry (SPEC 11.2, 11.4, 14.16)",
        [
          {
            file: record.rel,
            range: byteRange(record, element.start, element.end),
          },
        ],
      );
    }

    for (const section of parsed.sections) {
      const info = {
        spelled: null,
        wellFormed: false,
        conformant: true,
        unique: true,
        defined: false,
        tags: [],
        coverage: "required",
        dRefs: [],
      };
      record.info.set(section, info);

      // Identity spelling (SPEC 11.2): exactly one `id` attribute with a
      // quoted static-string value spells; every other shape spells none.
      const idAttrs = section.attrs.filter((attr) => attr.name === "id");
      if (idAttrs.length === 0) {
        addFinding(
          "14.1",
          "missing id: every section must spell an identity via an `id` prop (SPEC 1.3, 14.1)",
          [{ file: record.rel, range: constructRange(section) }],
        );
      } else if (idAttrs.length > 1) {
        addFinding(
          "14.17",
          "invalid prop: `id` is repeated — a section spells an identity via exactly one quoted static `id` (SPEC 2.7, 11.2, 14.17)",
          idAttrs.map((attr) => ({ file: record.rel, range: attrRange(attr) })),
        );
      } else if (idAttrs[0].form !== "quoted") {
        addFinding(
          "14.17",
          "invalid prop: `id` must carry a quoted static-string value (SPEC 2.7, 11.2, 14.17)",
          [{ file: record.rel, range: attrRange(idAttrs[0]) }],
        );
      } else {
        info.spelled = idAttrs[0].value;
        info.wellFormed = isWellFormedIdentity(info.spelled);
        if (!info.wellFormed) {
          addFinding(
            "14.4",
            `invalid segment: the spelled identity ${JSON.stringify(info.spelled)} carries an invalid segment (SPEC 1.4, 14.4)`,
            [{ file: record.rel, range: attrRange(idAttrs[0]) }],
          );
        }
      }

      // Interpreted tags (SPEC 2.6, 11.2): plain list, or unavailable.
      const tagAttrs = section.attrs.filter((attr) => attr.name === "tags");
      if (tagAttrs.length > 1) {
        info.tags = UNAVAILABLE;
        addFinding(
          "14.17",
          "invalid prop: `tags` is repeated (SPEC 2.7, 14.17)",
          tagAttrs.map((attr) => ({
            file: record.rel,
            range: attrRange(attr),
          })),
        );
      } else if (tagAttrs.length === 1 && tagAttrs[0].form !== "quoted") {
        info.tags = UNAVAILABLE;
        addFinding(
          "14.17",
          "invalid prop: `tags` must carry a quoted static-string value (SPEC 2.7, 14.17)",
          [{ file: record.rel, range: attrRange(tagAttrs[0]) }],
        );
      } else if (tagAttrs.length === 1) {
        const tokens = splitTags(tagAttrs[0].value);
        let valid = true;
        for (const token of tokens) {
          if (!isValidValue(token, "tag")) {
            valid = false;
            addFinding(
              "14.4",
              `invalid tag: ${JSON.stringify(token)} is not a valid tag (SPEC 1.4, 2.6, 14.4)`,
              [{ file: record.rel, range: attrRange(tagAttrs[0]) }],
            );
          }
        }
        info.tags = valid ? [...new Set(tokens)].sort() : UNAVAILABLE;
      }

      // Interpreted coverage (SPEC 2.5, 11.2): "required"/"none", or
      // unavailable (any repeated, malformed, or invalid-valued spelling —
      // condition 17 in every case, never 14.4).
      const coverageAttrs = section.attrs.filter(
        (attr) => attr.name === "coverage",
      );
      if (coverageAttrs.length > 1) {
        info.coverage = UNAVAILABLE;
        addFinding(
          "14.17",
          "invalid prop: `coverage` is repeated (SPEC 2.7, 14.17)",
          coverageAttrs.map((attr) => ({
            file: record.rel,
            range: attrRange(attr),
          })),
        );
      } else if (coverageAttrs.length === 1) {
        const attr = coverageAttrs[0];
        if (attr.form !== "quoted") {
          info.coverage = UNAVAILABLE;
          addFinding(
            "14.17",
            "invalid prop: `coverage` must carry a quoted static-string value (SPEC 2.5, 2.7, 14.17)",
            [{ file: record.rel, range: attrRange(attr) }],
          );
        } else if (attr.value !== "required" && attr.value !== "none") {
          info.coverage = UNAVAILABLE;
          addFinding(
            "14.17",
            `invalid prop: ${JSON.stringify(attr.value)} is not a coverage value — "required" or "none" (SPEC 2.5, 14.17)`,
            [{ file: record.rel, range: attrRange(attr) }],
          );
        } else {
          info.coverage = attr.value;
        }
      }

      // `d` (SPEC 2.2): braced static reference(s); other shapes are
      // invalid prop usage / invalid arguments, never dependencies.
      const dAttrs = section.attrs.filter((attr) => attr.name === "d");
      if (dAttrs.length > 1) {
        addFinding(
          "14.17",
          "invalid prop: `d` is repeated (SPEC 2.7, 14.17)",
          dAttrs.map((attr) => ({ file: record.rel, range: attrRange(attr) })),
        );
      } else if (dAttrs.length === 1 && dAttrs[0].form !== "braced") {
        addFinding(
          "14.17",
          "invalid prop: `d` must carry a braced expression value (SPEC 2.2, 2.7, 14.17)",
          [{ file: record.rel, range: attrRange(dAttrs[0]) }],
        );
      } else if (dAttrs.length === 1) {
        const refs = parseDReferences(dAttrs[0].value);
        if (refs === null) {
          addFinding(
            "14.8",
            "invalid argument: the `d` value is not a static reference or an array literal of static references (SPEC 2.2, 2.4, 14.8)",
            [{ file: record.rel, range: attrRange(dAttrs[0]) }],
          );
        } else {
          info.dRefs = refs.map((ref) => ({
            ...ref,
            range: byteRange(
              record,
              dAttrs[0].valueStart + ref.exprStart,
              dAttrs[0].valueStart + ref.exprEnd,
            ),
          }));
        }
      }

      // Unknown props and spread attributes (SPEC 2.7, 14.17): one finding
      // per afflicted prop name per element; one per spread entry.
      const KNOWN = new Set(["id", "d", "tags", "coverage"]);
      const unknownByName = new Map();
      for (const attr of section.attrs) {
        if (attr.name === null) {
          addFinding(
            "14.17",
            "invalid prop: a spread attribute is not a recognized prop form (SPEC 2.7, 14.17)",
            [{ file: record.rel, range: attrRange(attr) }],
          );
          continue;
        }
        if (KNOWN.has(attr.name)) continue;
        const list = unknownByName.get(attr.name) ?? [];
        list.push(attr);
        unknownByName.set(attr.name, list);
      }
      for (const [name, attrs] of unknownByName) {
        addFinding(
          "14.17",
          `invalid prop: ${JSON.stringify(name)} is not a recognized prop (SPEC 2.7, 14.17)`,
          attrs.map((attr) => ({ file: record.rel, range: attrRange(attr) })),
        );
      }
    }

    // Structural conformance (SPEC 1.3, 14.2), masked where the positional
    // section parent spells no identity.
    for (const section of parsed.sections) {
      const info = record.info.get(section);
      if (info.spelled === null) continue;
      const parent = section.parent;
      if (parent.isRoot) {
        if (identitySegments(info.spelled).length !== 1) {
          info.conformant = false;
        }
      } else {
        const parentSpelled = record.info.get(parent).spelled;
        if (parentSpelled === null) continue; // masked (SPEC 14.2)
        const prefix = `${parentSpelled}.`;
        if (
          !info.spelled.startsWith(prefix) ||
          info.spelled.slice(prefix.length).includes(".") ||
          info.spelled.length === prefix.length
        ) {
          info.conformant = false;
        }
      }
      if (!info.conformant) {
        addFinding(
          "14.2",
          `invalid structural id: ${JSON.stringify(info.spelled)} does not extend its parent's spelled identity by exactly one segment (SPEC 1.3, 14.2)`,
          [{ file: record.rel, range: constructRange(section) }],
        );
      }
    }

    // Uniqueness (SPEC 11.2, 14.3): spelled identities only — one finding
    // per duplicated spelling, locating EVERY bearer; every bearer's own
    // identity is undefined (no winner), while descendants judge their own
    // spelling alone (duplication is not a chain condition).
    for (const section of parsed.sections) {
      const info = record.info.get(section);
      if (info.spelled === null) continue;
      const list = record.idMap.get(info.spelled) ?? [];
      list.push(section);
      record.idMap.set(info.spelled, list);
    }
    for (const [spelling, bearers] of record.idMap) {
      if (bearers.length < 2) continue;
      for (const bearer of bearers) record.info.get(bearer).unique = false;
      addFinding(
        "14.3",
        `duplicate id: ${JSON.stringify(spelling)} is spelled by ${String(bearers.length)} sections of ${record.rel} (SPEC 1.3, 14.3)`,
        bearers.map((bearer) => ({
          file: record.rel,
          range: constructRange(bearer),
        })),
      );
    }

    // Definedness (SPEC 11.2): the chain conditions — every section of the
    // positional chain spells a well-formed, structurally conformant
    // identity — plus the section's own uniqueness.
    for (const section of parsed.sections) {
      const info = record.info.get(section);
      let chainOk = info.unique;
      for (let node = section; !node.isRoot; node = node.parent) {
        const chainInfo = record.info.get(node);
        if (
          chainInfo.spelled === null ||
          !chainInfo.wellFormed ||
          !chainInfo.conformant
        ) {
          chainOk = false;
          break;
        }
      }
      info.defined = chainOk;
    }

    // Imports (SPEC 2.1, 11.4): every declaration is listed; the resolved
    // target turns on specifier form and discovery ALONE (binding validity
    // notwithstanding); one 14.15 per invalid declaration. Only a valid
    // single-default-binding declaration with a resolved target defines a
    // spec-module binding for the file's external references.
    for (const declaration of parsed.imports) {
      const targetRel = resolveImportTarget(record.rel, declaration.specifier);
      const resolved =
        targetRel !== null && files.has(targetRel) ? targetRel : null;
      declaration.resolvedTarget = resolved;
      if (!declaration.formValid || resolved === null) {
        addFinding(
          "14.15",
          `invalid import: the declaration does not bind a single default import of a discovered spec source (${JSON.stringify(declaration.specifier)}) (SPEC 2.1, 14.15)`,
          [
            {
              file: record.rel,
              range: byteRange(record, declaration.start, declaration.end),
            },
          ],
        );
      }
      if (
        declaration.formValid &&
        resolved !== null &&
        !record.bindings.has(declaration.name)
      ) {
        record.bindings.set(declaration.name, resolved);
      }
    }
  }

  // --- Node identities (for records and answers): rel for roots,
  // `rel#spelling` for defined sections, the marker otherwise. Paths are
  // valid throughout the scope (valid UTF-8, `#`-free).
  const nodeIdentity = (record, node) => {
    if (node.isRoot) return record.rel;
    const info = record.info.get(node);
    return info.defined ? `${record.rel}#${info.spelled}` : UNAVAILABLE;
  };

  // --- Pass 2: reference resolution (SPEC 11.2) and occurrence records
  // (SPEC 5.7). A reference resolves exactly when it names exactly one
  // target whose own node identity is defined; a non-resolving spelling
  // records nothing (never an unavailable target) and is reported by its
  // finding at the reference.
  const resolveRef = (record, ref) => {
    if (ref.form === "local") {
      const candidates = record.idMap.get(ref.id) ?? [];
      if (candidates.length !== 1) return null;
      const node = candidates[0];
      if (!record.info.get(node).defined) return null;
      return { record, node };
    }
    const targetRel = record.bindings.get(ref.binding);
    if (targetRel === undefined) return null;
    const target = files.get(targetRel);
    if (target === undefined || target.failure !== null) return null;
    if (ref.segments.length === 0)
      return { record: target, node: target.parsed.root };
    const candidates = target.idMap.get(ref.segments.join(".")) ?? [];
    if (candidates.length !== 1) return null;
    const node = candidates[0];
    if (!target.info.get(node).defined) return null;
    return { record: target, node };
  };

  /** @type {object[]} every recorded occurrence, in file/document order. */
  const records = [];
  for (const record of files.values()) {
    if (record.failure !== null) continue;
    const fileRecords = [];
    for (const section of record.parsed.sections) {
      const info = record.info.get(section);
      for (const ref of info.dRefs) {
        const resolved = resolveRef(record, ref);
        if (resolved === null) {
          addFinding(
            "14.5",
            "unknown dependency: the `d` reference does not name exactly one target with a defined identity (SPEC 2.2, 11.2, 14.5)",
            [{ file: record.rel, range: ref.range }],
          );
          continue;
        }
        fileRecords.push({
          file: record.rel,
          range: ref.range,
          kind: "depends",
          sourceNode: section,
          sourceRecord: record,
          targetNode: resolved.node,
          targetRecord: resolved.record,
        });
      }
    }
    for (const embed of record.parsed.embeds) {
      const resolved = resolveRef(record, embed.ref);
      if (resolved === null) {
        // The finding's one location is EXACTLY the full braced container —
        // the span the occurrence would occupy (SPEC 14, 5.7).
        addFinding(
          "14.6",
          "unknown text target: the text(...) reference does not name exactly one target with a defined identity (SPEC 2.3, 11.2, 14.6)",
          [
            {
              file: record.rel,
              range: byteRange(record, embed.start, embed.end),
            },
          ],
        );
        continue;
      }
      embed.target = resolved;
      fileRecords.push({
        file: record.rel,
        range: byteRange(record, embed.start, embed.end),
        kind: "embeds",
        sourceNode: embed.owner,
        sourceRecord: record,
        targetNode: resolved.node,
        targetRecord: resolved.record,
      });
    }
    fileRecords.sort(
      (a, b) => a.range.start - b.range.start || a.range.end - b.range.end,
    );
    records.push(...fileRecords);
  }

  // --- Cycles (SPEC 5.3, 14.9): strongly connected components over the
  // recorded reference edges — one finding per cycle (a self-loop, or an
  // SCC of two or more nodes), locating every participating reference
  // spelling in file/range order.
  {
    const nodeKeys = new Map();
    const keyOf = (rec, node) => {
      let map = nodeKeys.get(rec);
      if (map === undefined) {
        map = new Map();
        nodeKeys.set(rec, map);
      }
      let key = map.get(node);
      if (key === undefined) {
        key = { rec, node };
        map.set(node, key);
      }
      return key;
    };
    const adjacency = new Map();
    const edges = records.map((occurrence) => {
      const from = keyOf(occurrence.sourceRecord, occurrence.sourceNode);
      const to = keyOf(occurrence.targetRecord, occurrence.targetNode);
      const list = adjacency.get(from) ?? [];
      list.push(to);
      adjacency.set(from, list);
      return { from, to, occurrence };
    });
    // Tarjan's SCC over the touched nodes.
    const index = new Map();
    const low = new Map();
    const onStack = new Set();
    const stack = [];
    const sccOf = new Map();
    let counter = 0;
    let sccCount = 0;
    const strongConnect = (v) => {
      index.set(v, counter);
      low.set(v, counter);
      counter += 1;
      stack.push(v);
      onStack.add(v);
      for (const w of adjacency.get(v) ?? []) {
        if (!index.has(w)) {
          strongConnect(w);
          low.set(v, Math.min(low.get(v), low.get(w)));
        } else if (onStack.has(w)) {
          low.set(v, Math.min(low.get(v), index.get(w)));
        }
      }
      if (low.get(v) === index.get(v)) {
        const members = [];
        for (;;) {
          const w = stack.pop();
          onStack.delete(w);
          members.push(w);
          if (w === v) break;
        }
        for (const member of members) sccOf.set(member, sccCount);
        sccCount += 1;
      }
    };
    const allKeys = new Set();
    for (const edge of edges) {
      allKeys.add(edge.from);
      allKeys.add(edge.to);
    }
    for (const key of allKeys) {
      if (!index.has(key)) strongConnect(key);
    }
    const cyclic = new Map();
    for (const edge of edges) {
      const same = sccOf.get(edge.from) === sccOf.get(edge.to);
      const cycleEdge =
        edge.from === edge.to || (same && sccSize(sccOf, edge.from) > 1);
      if (!cycleEdge) continue;
      const scc = sccOf.get(edge.from);
      const list = cyclic.get(scc) ?? [];
      list.push(edge.occurrence);
      cyclic.set(scc, list);
    }
    for (const participants of cyclic.values()) {
      const locations = participants
        .map((occurrence) => ({
          file: occurrence.file,
          range: occurrence.range,
        }))
        .sort(
          (a, b) =>
            compareRelBytes(a.file, b.file) ||
            a.range.start - b.range.start ||
            a.range.end - b.range.end,
        );
      addFinding(
        "14.9",
        "cycle: the reference spellings below form a dependency cycle (SPEC 5.3, 14.9)",
        locations,
      );
    }
  }

  return { config, files, findings, records, nodeIdentity };
}

/** The size of a key's SCC (helper for the cycle pass above). */
function sccSize(sccOf, key) {
  const target = sccOf.get(key);
  let size = 0;
  for (const value of sccOf.values()) {
    if (value === target) size += 1;
  }
  return size;
}

// ---------------------------------------------------------------------------
// Attributed compilation (SPEC 3 + 1.6) and expansion definedness (11.2)
// ---------------------------------------------------------------------------

/** Whether `owner` is `node` or one of its descendants. */
function ownerWithin(owner, node) {
  for (let n = owner; n !== null && n !== undefined; n = n.parent) {
    if (n === node) return true;
  }
  return false;
}

/** The subtree text of `node` over an atom list (SPEC 1.6). */
function textOfSubtreeAtoms(atoms, node) {
  let out = "";
  for (const atom of atoms) {
    if (ownerWithin(atom.owner, node)) out += atom.text;
  }
  return out;
}

/** The own text of `node` over an atom list (SPEC 1.6). */
function textOfOwnAtoms(atoms, node) {
  let out = "";
  for (const atom of atoms) {
    if (atom.owner === node) out += atom.text;
  }
  return out;
}

/**
 * Compile one parsed file to attributed output atoms per SPEC 3 — the
 * CONF-MD fixture's line model with ownership tracked per atom.
 * `expansionFor(piece, atoms)` supplies each embedding's expansion (the
 * target's compiled subtree text; the empty string where no complete
 * expansion exists — read only from poisoned nodes' values, which are
 * emitted as the marker, never these bytes). It receives the running atom
 * list, whose finalized lines a same-file backward target's subtree is
 * read from (the target closed on an earlier line, so its atoms are final
 * by the time its embedding compiles — true of every staged fixture).
 */
function compileAttributed(record, expansionFor) {
  const atoms = [];
  let survivors = [];
  let sourceHadNonWhitespace = false;
  let expansionContributed = false;

  const finalizeLine = (terminator, terminatorOwner) => {
    let remaining = "";
    for (const survivor of survivors) remaining += survivor.text;
    const dropped =
      sourceHadNonWhitespace &&
      !expansionContributed &&
      isWhitespaceOnlyForDrop(remaining);
    if (!dropped) {
      for (const survivor of survivors) {
        if (survivor.text !== "") atoms.push(survivor);
      }
      if (terminator !== "") {
        atoms.push({ text: terminator, owner: terminatorOwner });
      }
    }
    survivors = [];
    sourceHadNonWhitespace = false;
    expansionContributed = false;
  };

  const consumeSourceChunk = (chunk, owner) => {
    if (chunk.length === 0) return;
    survivors.push({ text: chunk, owner });
    if (!isWhitespaceOnlyForDrop(chunk)) sourceHadNonWhitespace = true;
  };

  for (const piece of record.parsed.pieces) {
    if (piece.kind === "content") {
      const text = piece.text;
      let start = 0;
      let i = 0;
      while (i < text.length) {
        const code = text.charCodeAt(i);
        if (code !== 0x0a && code !== 0x0d) {
          i += 1;
          continue;
        }
        const terminator = terminatorAt(text, i);
        if (terminator === null) {
          i += 1;
          continue;
        }
        consumeSourceChunk(text.slice(start, i), piece.owner);
        finalizeLine(terminator, piece.owner);
        i += terminator.length;
        start = i;
      }
      consumeSourceChunk(text.slice(start), piece.owner);
    } else {
      // The construct's own characters are source characters of the current
      // logical line: their non-whitespace counts for "contained
      // non-whitespace in the source". They are deleted — internal
      // terminators included.
      if (!isWhitespaceOnlyForDrop(piece.text)) sourceHadNonWhitespace = true;
      if (piece.kind === "embed") {
        const expansion = expansionFor(piece, atoms);
        if (expansion.length > 0) {
          survivors.push({ text: expansion, owner: piece.owner });
          expansionContributed = true;
        }
      }
    }
  }
  finalizeLine("", record.parsed.root);
  return atoms;
}

/**
 * Per-workspace text engine: expansion definedness (the poisoning rules of
 * SPEC 11.2 — a value is defined exactly when every embedding its expansion
 * transitively reaches records an occurrence and the recursion re-enters no
 * node already being expanded) plus the attributed compile per file.
 * Returns per-node own/subtree text datums (a byte-exact string or the
 * unavailability sentinel).
 */
function buildTextEngine(ws) {
  // subtreeExpansionOk, memoized tri-state: can `node`'s subtree be fully
  // expanded? A re-entry while computing is a cycle: poisoned.
  const subtreeMemo = new Map();
  const subtreeExpansionOk = (record, node) => {
    const memo = subtreeMemo.get(node);
    if (memo === "computing") return false;
    if (memo !== undefined) return memo;
    subtreeMemo.set(node, "computing");
    let ok = true;
    for (const embed of record.parsed.embeds) {
      if (!ownerWithin(embed.owner, node)) continue;
      if (embed.target === null) {
        ok = false;
        break;
      }
      if (!subtreeExpansionOk(embed.target.record, embed.target.node)) {
        ok = false;
        break;
      }
    }
    subtreeMemo.set(node, ok);
    return ok;
  };
  const ownExpansionOk = (record, node) => {
    for (const embed of record.parsed.embeds) {
      if (embed.owner !== node) continue;
      if (embed.target === null) return false;
      if (!subtreeExpansionOk(embed.target.record, embed.target.node)) {
        return false;
      }
    }
    return true;
  };

  // Per-file attributed compile, memoized. Cross-file expansions compile
  // the target's file first; a same-file target must close before its
  // embedding (true of every staged fixture) — a self, enclosing, forward,
  // or cross-file-cyclic target yields no expansion, and such an embedding
  // is always poisoned (its owner's values are the marker), so the
  // fabricated bytes are never read (module header).
  const compiled = new Map();
  const inProgress = new Set();
  const compileFile = (rel) => {
    const memo = compiled.get(rel);
    if (memo !== undefined) return memo;
    if (inProgress.has(rel)) return null; // cross-file cycle: poisoned
    inProgress.add(rel);
    const record = ws.files.get(rel);
    const result = compileAttributed(record, (piece, runningAtoms) => {
      const target = piece.embed.target;
      if (target === null) return "";
      if (target.record.rel === rel) {
        // A same-file target must have closed on an earlier line for its
        // atoms to be final in the running list; a self, enclosing, or
        // forward target yields no expansion and is always poisoned.
        if (!(target.node.closeEnd <= piece.embed.start)) return "";
        return textOfSubtreeAtoms(runningAtoms, target.node);
      }
      const targetAtoms = compileFile(target.record.rel);
      if (targetAtoms === null) return "";
      return textOfSubtreeAtoms(targetAtoms, target.node);
    });
    inProgress.delete(rel);
    compiled.set(rel, result);
    return result;
  };

  return {
    textsFor(record) {
      if (record.failure !== null) return null;
      const atoms = compileFile(record.rel) ?? [];
      const texts = new Map();
      const nodes = [record.parsed.root, ...record.parsed.sections];
      for (const node of nodes) {
        texts.set(node, {
          ownText: ownExpansionOk(record, node)
            ? textOfOwnAtoms(atoms, node)
            : UNAVAILABLE,
          subtreeText: subtreeExpansionOk(record, node)
            ? textOfSubtreeAtoms(atoms, node)
            : UNAVAILABLE,
        });
      }
      return texts;
    },
  };
}

// ---------------------------------------------------------------------------
// Findings documents (SPEC 12.7, 14)
// ---------------------------------------------------------------------------

/** A condition's ordinal (the `N` of `14.N`), ordering findings (SPEC 12.7). */
function conditionOrdinal(condition) {
  return Number(condition.slice(3));
}

/**
 * The pinned findings order (SPEC 12.7): by code (numbered conditions in
 * numeric order — this scope reports no refusal or code-less findings),
 * then locations element-wise (file path bytes, range start, range end; a
 * proper prefix first), then concerned path (null before any path), then
 * identities, then message — this scope's identities are always empty.
 */
function compareFindingDocs(a, b) {
  const byOrdinal =
    conditionOrdinal(a.internalCondition) -
    conditionOrdinal(b.internalCondition);
  if (byOrdinal !== 0) return byOrdinal;
  const shared = Math.min(a.locations.length, b.locations.length);
  for (let i = 0; i < shared; i += 1) {
    const byFile = compareRelBytes(a.locations[i].file, b.locations[i].file);
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
  if ((a.path === null) !== (b.path === null)) return a.path === null ? -1 : 1;
  if (a.path !== null && b.path !== null) {
    const byPath = compareRelBytes(a.path, b.path);
    if (byPath !== 0) return byPath;
  }
  return Buffer.compare(
    Buffer.from(a.message, "utf8"),
    Buffer.from(b.message, "utf8"),
  );
}

/**
 * Render internal findings as the 12.7 `findings` array value: one
 * `{"code", "message", "locations", "path", "identities"}` per finding —
 * every scope condition locates in source, so `path` is null and
 * `locations` non-empty, each finding's locations already in file/range
 * order — in the pinned order, identical findings collapsed to one.
 */
function findingsValue(findings) {
  const docs = findings.map((finding) => ({
    code: CODE_TOKENS[finding.condition],
    message: finding.message,
    locations: finding.locations.map((location) => ({
      file: location.file,
      range: { start: location.range.start, end: location.range.end },
    })),
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
  return collapsed.map(({ code, message, locations, path: p, identities }) => ({
    code,
    message,
    locations,
    path: p,
    identities,
  }));
}

/**
 * The findings of a consulted domain (SPEC 11.2, 11.3, 11.4): a finding
 * accompanies exactly the answers whose domain includes a file it locates
 * in (every scope condition is located; a cross-file finding accompanies
 * when any participant's file is in the domain).
 */
function domainFindings(ws, domain) {
  return ws.findings.filter((finding) =>
    finding.locations.some((location) => domain.has(location.file)),
  );
}

// ---------------------------------------------------------------------------
// Argument parsing (SPEC 12.0)
// ---------------------------------------------------------------------------

/**
 * Parse flags per command. `flagSpec` maps flag names to "bool" | "value";
 * unknown and repeated flags are usage errors (SPEC 12.0).
 */
function parseArgs(argv, flagSpec, positionalRange) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const kind = flagSpec[arg];
      if (kind === undefined)
        throw new UsageError(`unknown flag ${arg} (SPEC 12.0)`);
      if (Object.hasOwn(flags, arg)) {
        throw new UsageError(
          `repeated flag ${arg}: a flag may be given at most once (SPEC 12.0)`,
        );
      }
      if (kind === "bool") {
        flags[arg] = true;
      } else {
        const value = argv[i + 1];
        if (value === undefined)
          throw new UsageError(`missing value for ${arg} (SPEC 12.0)`);
        flags[arg] = value;
        i += 1;
      }
    } else {
      positionals.push(arg);
    }
  }
  const [min, max] = positionalRange;
  if (positionals.length < min || positionals.length > max) {
    throw new UsageError(
      `expected ${min === max ? String(min) : `${String(min)}-${String(max)}`} argument(s), got ${String(positionals.length)} (SPEC 12.0)`,
    );
  }
  return { flags, positionals };
}

// ---------------------------------------------------------------------------
// `xspec view` (SPEC 11.4)
// ---------------------------------------------------------------------------

/**
 * One per-file view (SPEC 11.4, 12.7): `{"file", "root", "imports",
 * "occurrences", "comments"}` — the full positional tree with per-node
 * identity/tags/coverage datums (and own/subtree text under `--text`),
 * every import declaration, the file's own occurrence records, and the
 * comment ranges, all in document order.
 */
function fileViewDoc(ws, record, fileRecords, texts) {
  const { parsed } = record;
  const nodeDoc = (node) => {
    const doc = {
      identity: ws.nodeIdentity(record, node),
      range: node.isRoot
        ? { start: 0, end: record.byteOf(record.text.length) }
        : byteRange(record, node.openStart, node.closeEnd),
      opening: node.isRoot
        ? null
        : byteRange(record, node.openStart, node.openEnd),
      closing:
        node.isRoot || node.selfClosing
          ? null
          : byteRange(record, node.closeStart, node.closeEnd),
      attributes: node.attrs.map((attr) => ({
        name: attr.name,
        range: byteRange(record, attr.start, attr.end),
        text: record.text.slice(attr.start, attr.end),
      })),
      tags: node.isRoot ? null : record.info.get(node).tags,
      coverage: node.isRoot ? null : record.info.get(node).coverage,
      children: node.children.map(nodeDoc),
    };
    if (texts !== null) {
      const nodeTexts = texts.get(node);
      doc.ownText = nodeTexts.ownText;
      doc.subtreeText = nodeTexts.subtreeText;
    }
    return doc;
  };
  return {
    file: record.rel,
    root: nodeDoc(parsed.root),
    imports: parsed.imports.map((declaration) => ({
      range: byteRange(record, declaration.start, declaration.end),
      name: declaration.name,
      target:
        declaration.resolvedTarget === null
          ? UNAVAILABLE
          : declaration.resolvedTarget,
    })),
    occurrences: fileRecords.map((occurrence) => occurrenceDoc(ws, occurrence)),
    comments: parsed.comments.map((comment) =>
      byteRange(record, comment.start, comment.end),
    ),
  };
}

/** One occurrence record in the 12.7 form (SPEC 5.7, 11.2). */
function occurrenceDoc(ws, occurrence) {
  const sourceIdentity = ws.nodeIdentity(
    occurrence.sourceRecord,
    occurrence.sourceNode,
  );
  return {
    file: occurrence.file,
    range: { start: occurrence.range.start, end: occurrence.range.end },
    kind: occurrence.kind,
    // Source: the graph node `{identity, range}` — or the unavailability
    // marker where 11.2 leaves that identity undefined: identity and range
    // withheld together as ONE datum, never a picked bearer, never null.
    source:
      sourceIdentity === UNAVAILABLE
        ? UNAVAILABLE
        : {
            identity: sourceIdentity,
            range: occurrence.sourceNode.isRoot
              ? {
                  start: 0,
                  end: occurrence.sourceRecord.byteOf(
                    occurrence.sourceRecord.text.length,
                  ),
                }
              : byteRange(
                  occurrence.sourceRecord,
                  occurrence.sourceNode.openStart,
                  occurrence.sourceNode.closeEnd,
                ),
          },
    target: ws.nodeIdentity(occurrence.targetRecord, occurrence.targetNode),
  };
}

async function commandView(io, cwd, argv) {
  const { flags, positionals } = parseArgs(
    argv,
    {
      "--json": "bool",
      "--config": "value",
      "--text": "bool",
      "--file": "value",
    },
    [0, Number.POSITIVE_INFINITY],
  );
  if (positionals.length > 0 && flags["--file"] !== undefined) {
    throw new UsageError(
      "`view` takes `<file>` operands or `--file`, not both (SPEC 11.4, 12.0)",
    );
  }
  const ws = await loadWorkspace(cwd, flags["--config"]);
  const discovered = [...ws.files.keys()];

  // The requested files (SPEC 11.4): operands assert membership in the
  // discovered spec-source domain and form a set; `--file` is a set
  // restriction over the domain; neither means the whole domain.
  let requested;
  if (positionals.length > 0) {
    const set = new Set();
    for (const operand of positionals) {
      if (!ws.files.has(operand)) {
        throw new UsageError(
          `unknown file: ${operand} is not a discovered spec source (SPEC 11.4, 12.0)`,
        );
      }
      set.add(operand);
    }
    requested = discovered.filter((rel) => set.has(rel));
  } else if (flags["--file"] !== undefined) {
    requested = discovered.filter((rel) => globMatches(flags["--file"], rel));
  } else {
    requested = discovered;
  }

  // The consulted domain (SPEC 11.4): the requested files — plus, exactly
  // under `--text`, the files of resolved targets reachable through
  // occurrence-recording embeddings (expansion consults them).
  const domain = new Set(requested);
  if (flags["--text"]) {
    for (;;) {
      let grew = false;
      for (const occurrence of ws.records) {
        if (occurrence.kind !== "embeds") continue;
        if (!domain.has(occurrence.file)) continue;
        const targetRel = occurrence.targetRecord.rel;
        if (!domain.has(targetRel)) {
          domain.add(targetRel);
          grew = true;
        }
      }
      if (!grew) break;
    }
  }

  const textEngine = flags["--text"] ? buildTextEngine(ws) : null;
  const views = [];
  for (const rel of requested) {
    const record = ws.files.get(rel);
    if (record.failure !== null) continue; // no view; the 14.20 accompanies
    const fileRecords = ws.records.filter(
      (occurrence) => occurrence.file === rel,
    );
    const texts = textEngine === null ? null : textEngine.textsFor(record);
    views.push(fileViewDoc(ws, record, fileRecords, texts));
  }
  const doc = {
    findings: findingsValue(domainFindings(ws, domain)),
    views,
  };
  const exitCode = doc.findings.length > 0 || containsUnavailable(doc) ? 1 : 0;
  io.stdout(renderDocument(doc));
  return exitCode;
}

// ---------------------------------------------------------------------------
// `xspec occurrences` (SPEC 11.3)
// ---------------------------------------------------------------------------

async function commandOccurrences(io, cwd, argv) {
  const { flags } = parseArgs(
    argv,
    {
      "--json": "bool",
      "--config": "value",
      "--file": "value",
      "--to": "value",
    },
    [0, 0],
  );
  const ws = await loadWorkspace(cwd, flags["--config"]);

  // The consulted domain (SPEC 11.3): the entire discovered set, or the
  // discovered files the `--file` glob admits. §VIOL-AVAIL-NOFILE
  // (bin-nofile.mjs, `ignoreFileRestriction`) hooks exactly here: the flag
  // and its argument are accepted as specified, but the consulted domain is
  // the entire discovered set, exactly as with the flag absent — the
  // enumeration and the findings accompanying it follow that widened
  // domain; `--to` selection and `view` are unchanged.
  const restriction =
    deviations.ignoreFileRestriction === true ? undefined : flags["--file"];
  const domain = new Set(
    restriction === undefined
      ? ws.files.keys()
      : [...ws.files.keys()].filter((rel) => globMatches(restriction, rel)),
  );

  // The enumeration: the domain files' records, in occurrence order (5.7:
  // file path bytes, then range start, then range end), selected by `--to`
  // where given (acceptance is syntactic: an empty selection is an answer).
  let selected = ws.records.filter((occurrence) => domain.has(occurrence.file));
  if (flags["--to"] !== undefined) {
    selected = selected.filter((occurrence) => {
      const target = ws.nodeIdentity(
        occurrence.targetRecord,
        occurrence.targetNode,
      );
      return target === flags["--to"];
    });
  }
  selected = [...selected].sort(
    (a, b) =>
      compareRelBytes(a.file, b.file) ||
      a.range.start - b.range.start ||
      a.range.end - b.range.end,
  );

  const doc = {
    findings: findingsValue(domainFindings(ws, domain)),
    occurrences: selected.map((occurrence) => occurrenceDoc(ws, occurrence)),
  };
  const exitCode = doc.findings.length > 0 || containsUnavailable(doc) ? 1 : 0;
  io.stdout(renderDocument(doc));
  return exitCode;
}

// ---------------------------------------------------------------------------
// Entry: deviation seam + dispatch
// ---------------------------------------------------------------------------

/**
 * Run one xspec invocation. Returns the exit code (SPEC 12.0 partition).
 * `options` is the seam through which each violator fixture's bin-<name>.mjs
 * entry threads exactly one deviation switch (the conformer's bin.mjs passes
 * none); see the `deviations` doc in the module header for where
 * §VIOL-AVAIL-NULLMARKER, §VIOL-AVAIL-OMIT, and §VIOL-AVAIL-NOFILE hook.
 */
export async function runXspec(argv, cwd, options = {}) {
  deviations = options;
  const io = {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  };
  return await dispatchCommand(io, cwd, argv);
}

/** Dispatch one parsed invocation and map its outcome to SPEC 12.0's codes. */
async function dispatchCommand(io, cwd, argv) {
  const command = argv[0];
  // The served surfaces are JSON-only (SPEC 11): JSON output is in effect
  // for them whatever the arguments, so their usage errors emit the single
  // 12.7 error document; an unknown command emits it only under `--json`.
  const jsonInEffect =
    command === "view" || command === "occurrences" || argv.includes("--json");
  try {
    const rest = argv.slice(1);
    switch (command) {
      case "view":
        return await commandView(io, cwd, rest);
      case "occurrences":
        return await commandOccurrences(io, cwd, rest);
      default:
        throw new UsageError(
          `unknown command ${String(command)} (SPEC 12.0; this fixture's surface is view and occurrences, CERTIFICATIONS.md §CONF-AVAIL)`,
        );
    }
  } catch (error) {
    if (error instanceof UsageError) {
      // Usage/configuration errors (SPEC 12.0): the message is stderr
      // content; with JSON output in effect the single 12.7 error document
      // — {"error": …} holding one finding form — is the entire stdout.
      if (jsonInEffect) {
        io.stdout(
          renderDocument({
            error: {
              code: error.code,
              message: error.message,
              locations: [],
              path: error.path,
              identities: [],
            },
          }),
        );
      }
      io.stderr(`xspec: ${error.message}\n`);
      return 2;
    }
    // A crash is a fixture bug: exit outside the 12.0 partition so every
    // exit-code assertion fails loudly and the diagnosis carries the stack.
    io.stderr(
      `xspec: internal fixture error: ${error?.stack ?? String(error)}\n`,
    );
    return 70;
  }
}
