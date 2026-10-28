// CONF-CORE conformer fixture (CERTIFICATIONS.md §CONF-CORE; TEST-SPEC 17
// C-1/C-2). A harness-owned executable product implementing §CONF-CORE's
// Scope with the simplest conforming behavior — driven only through the C-2
// executable/workspace binding, never importing product code (the product and
// the harness are distinct programs; this fixture is part of the harness).
// The CONF-RACE conformer (CERTIFICATIONS.md §CONF-RACE: CONF-CORE's
// workspaces, behavior, and command surface, as T13.5-13 drives them) is this
// module run deviation-free from an executable of its own,
// `../conf-race/bin.mjs`, and its violator VIOL-RACE-LISTFIRST one switch of
// it (`listBeforeEntry`, below); likewise the CONF-READERS conformer (as P-10
// drives them; `../conf-readers/bin.mjs`), its violator VIOL-READERS-CLAIM
// one switch (`readersHoldClaims`), and the CONF-LEFTOVER conformer (as P-15
// drives them; `../conf-leftover/bin.mjs`), its violators
// VIOL-LEFTOVER-FOLLOWLINK, -DOTNAMES, and -BYTENAMES one switch each
// (`followLinksAtRemoval`, `hideDotNames`, `namesAsText`).
//
// Scope implemented (see CERTIFICATIONS.md §CONF-CORE):
// - Workspaces with one configured spec group of `.mdx` sources without
//   imports, embeddings, `d` props, or tags; no `markdown`, `coverage`, or
//   `policy` keys; no git; and no code group but in T13.5-8's workspaces,
//   as its wrong-kind and first-discovery arms stage one — code groups are
//   parsed and their sources discovered, each an edgeless whole-file code
//   location judged on 14.20's accepting side alone (its content never
//   read), recorded in graph data by path.
// - Configuration and discovery (SPEC 7, 12.0, 13.5), each met before
//   acquisition and reported in 12.7's error document: an unknown key in
//   the configuration's top-level object, and a file both a spec glob and
//   a code glob match, the configuration error of 14.14 concerning the
//   configuration file; a refused listing of a directory discovery lists,
//   the read failure of 14.25 concerning that directory; and a mutating
//   command's second discovery once exclusivity is held — the sources every
//   later check and read consults — reporting either error it meets there.
// - `build`; the 13.3 read commands per 12.0 (`check` with no findings on
//   valid state, `ids`, `show`, `query`, `coverage` reporting zero profiles,
//   the `review` read subcommands; `impact --base` without git is the exit-2
//   unreadable-baseline case of SPEC 6.3/12.0, its resolution reading the
//   current journal first, a journal error there the exit-2 error document's
//   `journal-error` concerning `.xspec/journal` — resolveBaseline).
// - `rename` and file-form `move` with journal append (SPEC 6.1, 6.2),
//   their argument checks of 12.0 (a nonexistent old ID or origin file, and
//   a wrong-kind origin — a discovered code source — each a usage error) and
//   valid-workspace precondition (6.4, 6.5) judged after acquisition, the
//   hold, and the second discovery; `move`'s section form only to its
//   argument checks — a nonexistent origin ID a usage error, exit 2, after
//   acquisition and the hold — a performable section move lying outside
//   this surface (exit 70); `rename --preview` only as
//   T13.5-8's non-mutating boundary drives it — the refused form (a
//   nonexistent old ID's usage error) acquiring nothing and creating no
//   hold file (SPEC 6.6), `--test-hold` beside `--preview` the
//   syntax-class usage error of 12.0 — a performable preview lying outside
//   this surface (a fixture scope error, exit 70).
// - Validation within scope: the one condition each in-scope failing
//   workspace stages — a journal error (SPEC 14.13: a line that is no entry,
//   or a journal path occupied by anything but a plain file), its finding
//   concerning `.xspec/journal` with `locations` [] (journalFindings), and a
//   spec source beginning with a byte-order mark (SPEC 14.20, 1.6), its
//   finding the zero-length range at offset 0 (SPEC 14) — is detected and
//   reported, beside any other finding, by `build`, `check`, the gate of
//   13.3, and the precondition of `rename`/`move`, exit 1, nothing written
//   (loadGraph); a given baseline's resolution (`review create --base`,
//   `impact --base`) reads the current journal first and fails on a journal
//   error as the exit-2 usage error carrying its code and concerned path
//   (SPEC 6.3; resolveBaseline).
// - `review` with the `audit` strategy (SPEC 10.6) through `create`,
//   `resolve`, `split`, and the read subcommands, including read-time
//   invalidation over the recorded state of SPEC 10.4, and — on a workspace
//   whose graph data is stale but whose sources are valid — the SPEC 13.3
//   refresh a mutating `review` subcommand performs after the hold, past
//   every outcome 10.7 orders before it, and before its session write,
//   writing graph data byte-identical to what `build` writes (T13.5-1's
//   stale-workspace arm, T10.1-1); a run one of those outcomes turns back
//   refreshes nothing (10.7: stale graph data stays stale).
// - SPEC 13.4 durable protection and SPEC 13.5 in full, `--test-hold`
//   included: acquisition follows the configuration's load and the first
//   discovery, and acquisition and the hold precede the second discovery
//   and every later check — the argument checks of 12.0, baseline
//   resolution (6.3), the gate and refresh of 13.3, and the operation's own
//   validation (T13.5-8) — so the seam engages on an invocation a later
//   check refuses or the gate turns back.
//
// Key mechanisms:
// - Invocation grammar (SPEC 12.0; CERTIFICATIONS.md preamble): the
//   arguments are read once, before dispatch (readInvocation) — flag tokens
//   anywhere, a value-taking flag taking the whole next token (arity fixed
//   by name across commands, FLAG_ARITY), `--` ending flag reading — and the
//   remaining tokens must match the command's synopsis exactly (SYNOPSES,
//   QUERY_SYNOPSES, REVIEW_SYNOPSES). Every syntax-class error is decided
//   from the arguments alone, before configuration is loaded and before any
//   acquisition or hold; a flag, command, or form outside this fixture's
//   surface is refused (exit 70) only after those checks. JSON output is in
//   effect when a `--json` token is read as a flag, or on a JSON-only
//   surface (`query`, `review export`; isJsonOnlySurface) with or without
//   `--json`; it then carries every answer, every findings report, and
//   every exit-2 error — the 12.7 error document, its `code` and `path`
//   `configuration-error` and SPEC 14's concerned path for a configuration
//   error, `journal-error` and `.xspec/journal` for a journal error failing
//   a given baseline's resolution, `null`/`null` for a plain usage error
//   (UsageError).
// - Discovery (SPEC 7, 13.4, 14.25; see discover): a walk from the
//   workspace root listing only directories some configured glob can reach
//   into — never the graph-data area `.xspec`, whose files no group holds
//   (13.4) — never following or traversing a symbolic link; a listing the
//   environment refuses is `read-failure` concerning that directory, one
//   found absent lists nothing. Every command that loads the configuration
//   discovers before any error consulting configuration or discovery
//   (12.0); a mutating command discovers once before acquisition and again
//   once it holds exclusivity, past the hold, the second discovery's
//   sources fixing what every later check and read consults (runMutating).
// - Exclusivity (SPEC 13.5): the lock directory `.xspec/lock` under the
//   graph-data area, transient (13.4); see acquireExclusivity. Acquisition
//   examines `.xspec` and the lock path without following a link — anything
//   but a directory at `.xspec`, or anything but a directory or a plain file
//   at the lock path, obstructs (`write-failure`, 14.24), and a plain file
//   at the lock path is a leftover, removed — brings the area's directory
//   and the lock directory into existence where absent, adds the run's entry
//   (an empty plain file named `<pid>-<16 random hex digits>`), lists the
//   lock directory, and judges each other plain file in that form by the
//   identifier its name records: one this process's process list (`/proc`)
//   lists, other than its own, refuses (`workspace-busy`, 14.26, concerning
//   `.xspec/lock`) with nothing removed; otherwise every leftover goes — a
//   directory with all it holds, a symbolic link itself, a FIFO unopened, no
//   content read, names handled as the bytes listed. A refused read or write
//   there is `read-failure` or `write-failure` (14.25, 14.24) concerning
//   `.xspec/lock` (`.xspec` for the area's own path). Release, on every
//   normal end — acquisition's own failures included — deletes the entry,
//   then the lock directory, then the area's directory where this
//   acquisition created it, each only once it holds nothing else, reading
//   nothing; a killed run leaves its entry, a leftover the next acquisition
//   removes once the run's identifier is no longer listed. Concurrent
//   acquisitions tolerate one another's creations and deletions (the
//   overlapping acquisitions of CONF-RACE's scope).
// - `--test-hold` (SPEC 13.5): immediately after acquiring exclusivity and
//   before modifying anything, an empty file is created at the given path
//   with O_EXCL (anything already there — a symbolic link included — fails
//   the command exit 2 without modifying anything); the command proceeds
//   only once that file has been deleted.
// - 13.3 refresh (SPEC 13.3, 10.7): a mutating `review` subcommand, after the
//   hold and once every outcome 10.7 orders past the gate has passed — the
//   session read, `create`'s session-directory examination, the item check,
//   and the refusals of a blocked item and of an unsplittable one — just
//   before its session write, compares the stored graph data against the
//   current sources (the recorded derived-file paths excluded) and rewrites
//   stale graph data alone, exactly as `build` writes it — see
//   refreshStaleGraphData; a run those outcomes turn back writes nothing.
//   `rename` and `move` regenerate every derived file at their end instead
//   (SPEC 6.4, 6.5).
// - Atomic visibility (SPEC 13.5): every derived and durable write goes
//   through a temp file in the target's directory renamed over the target,
//   so a concurrent reader observes prior content, complete new content, or
//   absence-before-first-write — never a partial file. Temp names carry
//   `.xspec.` and a leading dot, so they are never discovered (SPEC 7, 13.4).
// - Hashes: SHA-256 over own-content framing and child structure only —
//   never over identities — so journaled renames and moves are hash-pure by
//   construction (SPEC 6.2) and any text edit changes the edited node's
//   subtreeHash (SPEC 5.5's in-scope observable).
// - Journal (SPEC 6.1): one JSON entry per line, appended only by `rename`
//   and `move`; recorded review-node identities are mapped forward through
//   the journal suffix appended since their recording (SPEC 6.3, 10.4), so
//   reads present recorded nodes under current identities. Its validation
//   (14.13, journalFindings) is one of `build`'s, made wherever they are
//   (loadGraph) and first by a given baseline's resolution (resolveBaseline).
// - Reads never write (SPEC 10.4, 13.3, 13.4): every read command computes
//   its answer from the sources and stored files in memory and writes
//   nothing — durable files are touched only by their owning commands.
// - Audit review (SPEC 10.4, 10.5, 10.6, 10.7; rederive, auditDerivation,
//   reviewResolve): one derivation places every item a session gains —
//   `create` derives the empty session, an `updated` resolve re-derives it,
//   and `split` records its decomposition (the original's kind and scope
//   node), removes the original, and ends by re-deriving it. The derivation
//   runs with the recorded decompositions applied (a decomposed item never
//   added back, its per-child items and the scope node's
//   `parent-consistency` item in its place, recursively, over the children
//   the node has now), matches existing items by kind and scope node —
//   identities mapped forward through the journal (10.4) — each match
//   keeping its `id`, status, note, and recorded state and taking the
//   generated scope, context, origin, and reason, adds the rest with
//   current state, and blocks each generated item by its child sections'
//   items, a decomposed one's replaced by all items of its decomposition;
//   every item the original of a `split` blocked is blocked by all items of
//   its decomposition. `resolve` sets the status and the note (none without
//   `--note`), re-derives first where the status is `updated`, and then
//   assigns the item its current context set as `context` and records its
//   state (10.4). Reads present an item's current context set as its
//   `context` — the generator's, or, for an item no longer generated, the
//   context last assigned — every recorded node under its current identity,
//   and an absent node's text from the most recent graph state that
//   contained it among those under which the item was derived or resolved
//   (10.7's provenance rule; archiveTexts).
//
// Determinism (SPEC 12.0): no wall clock, no randomness, no absolute paths
// in any output, generated file, or stored data — the lock directory's
// entries aside, coordination state outside 12.0's determinism whose random
// names no output carries (13.4) — and all JSON is serialized with
// byte-sorted keys (SPEC 13.4).

import { createHash, randomBytes } from "node:crypto";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

// ---------------------------------------------------------------------------
// Outcome carriers
// ---------------------------------------------------------------------------

/**
 * Usage or configuration error (SPEC 12.0 exit 2): the message is stderr
 * content; with JSON output in effect the 12.7 error document is the
 * entire stdout. `code`/`path` are the error finding's stable code and
 * concerned path — set for configuration errors (14.14:
 * `configuration-error` plus the concerned path, SPEC 14) and for
 * acquisition's write failure, read failure, and busy refusal (14.24–14.26:
 * `write-failure`, `read-failure`, `workspace-busy`, concerning
 * `.xspec/lock`, or `.xspec` for the area's own path; SPEC 13.5,
 * acquireExclusivity), for discovery's read failure (14.25: `read-failure`
 * concerning the directory whose listing was refused; discover), and for a
 * journal error failing a given baseline's resolution (14.13:
 * `journal-error` concerning `.xspec/journal`, SPEC 6.3; resolveBaseline),
 * `null` for plain usage errors (SPEC 12.7, 14), the hold-file error of 13.5
 * and the unreadable baseline of 6.3 among them. This scope reports no other
 * write or read failure (14.24, 14.25).
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

/** Findings (SPEC 12.0 exit 1): a findings report on stdout. */
class FindingsError extends Error {
  /** @param {readonly Finding[]} findings */
  constructor(findings) {
    super("findings");
    this.findings = findings;
  }
}

/**
 * A refused operation (SPEC 12.0 exit 1: refused rename/move, refused
 * review operations). SPEC pins no report content for refusals; the message
 * goes to stdout as the report.
 */
class RefusalError extends Error {}

/**
 * An invocation outside this fixture's certified surface (CERTIFICATIONS.md
 * §CONF-CORE): refused loudly with exit 70 — outside the 12.0 partition —
 * never answered and never misreported as a usage error, so a test driving
 * it fails on the fixture side rather than passing vacuously.
 */
class FixtureScopeError extends Error {}

/**
 * @typedef {{ condition: string, message: string, file?: string,
 *             location?: { start: number, end: number } }} Finding
 */

// ---------------------------------------------------------------------------
// Canonical JSON (sorted keys, SPEC 12.0/13.4)
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

/** One canonical serializer for stored and emitted JSON. */
function canonicalJson(value) {
  return JSON.stringify(sortKeysDeep(value));
}

function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Atomic file writes (SPEC 13.5 atomic visibility; 13.4 occupant replacement)
// ---------------------------------------------------------------------------

let tmpCounter = 0;

/**
 * Write via a temp file in the target's directory renamed over the target:
 * the path holds prior state or the complete new content at every moment.
 * The temp name starts with `.` and contains `.xspec.`, so it is never
 * discovered as a source even mid-write (SPEC 7 dot rule, 13.4 exclusion).
 */
async function writeFileAtomic(absPath, data) {
  await fsp.mkdir(path.dirname(absPath), { recursive: true });
  const tmp = path.join(
    path.dirname(absPath),
    `.xspec.tmp-${String(process.pid)}-${String(tmpCounter++)}`,
  );
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, absPath);
}

/**
 * VIOL-CORE-PARTIALWRITE (CERTIFICATIONS.md): the sustained strict-prefix
 * interval. Long relative to a concurrent reader's polling cadence (T13.5-5
 * polls about once a millisecond), short against every command and test
 * budget (helpers/subprocess.ts bounds, the per-test watchdogs).
 */
const PARTIAL_WRITE_INTERVAL_MS = 50;

/**
 * VIOL-CORE-PARTIALWRITE (CERTIFICATIONS.md): non-atomic derived-file write.
 * The target path itself first receives a strict prefix of the new content
 * (written in place, truncating), holds it for the sustained interval above,
 * and only then receives the remainder, completing the content. The path is
 * never unlinked, so a concurrent reader observes the partial file — never
 * absence — and after the call resolves the path holds the complete bytes
 * (each completed command still leaves the conformer's final state). Used
 * through derivedWriter() alone — regenerate() and refreshStaleGraphData() —
 * under the `partialDerivedWrites` deviation: derived files only — durable
 * files (journal, sessions, sources) keep the conformer's atomic writes
 * everywhere.
 */
async function writeFilePartialThenComplete(absPath, data) {
  const bytes = Buffer.from(data);
  if (bytes.length === 0) {
    // Empty content has no strict prefix; write atomically. (Unreachable for
    // this fixture's derived files, which are all non-empty.)
    await writeFileAtomic(absPath, data);
    return;
  }
  await fsp.mkdir(path.dirname(absPath), { recursive: true });
  const prefix = bytes.subarray(0, Math.floor(bytes.length / 2));
  await fsp.writeFile(absPath, prefix);
  await sleep(PARTIAL_WRITE_INTERVAL_MS);
  await fsp.appendFile(absPath, bytes.subarray(prefix.length));
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
 * The workspace root of this invocation's successful configuration
 * resolution, or null before one succeeds (module state; each bin*.mjs entry
 * runs exactly one invocation per process). Consumed only by the
 * VIOL-CORE-CHATTYREADS deviation in runXspec, which appends its fixed
 * journal line once a `check` has returned exit 0 or 1: `check` resolves its
 * configuration via loadConfig before it can reach either outcome, so the
 * root is always set by the time that deviation consults it.
 */
let lastResolvedRoot = null;

/**
 * Load and validate the configuration; returns the workspace root, the spec
 * groups, and the code groups, with the invocation's working directory and
 * the configuration file's path (a configuration error discovery meets
 * concerns that file, 14.14). The in-scope shape is one spec group, no
 * other key but, in T13.5-8's workspaces alone, `code`
 * (CERTIFICATIONS.md §CONF-CORE); `specs` is required (SPEC 7). Every
 * failure is a configuration error (14.14), its error finding carrying
 * `configuration-error` and SPEC 14's concerned path.
 *
 * VIOL-CORE-READERENTRY (CERTIFICATIONS.md, `readersAddEntries`): once the
 * configuration is loaded, `build` and the read commands add their own
 * entry where a lock directory stands (addReaderEntry).
 *
 * VIOL-READERS-CLAIM (CERTIFICATIONS.md, `readersHoldClaims`): once the
 * configuration file is located — before it is read — `build` and the read
 * commands each add a claim to the lock directory and dwell
 * (holdReaderClaim), releasing it as they end (runXspec).
 */
async function loadConfig(cwd, configFlag) {
  const configPath = await findConfigPath(cwd, configFlag);
  if (deviations.readersHoldClaims && buildOrReadInvocation) {
    await holdReaderClaim(path.dirname(configPath));
  }
  let groups;
  try {
    groups = await readConfigGroups(configPath);
  } catch (error) {
    // Every defect found while reading, parsing, or validating the located
    // configuration is a configuration error (SPEC 14.14 — a refused read of
    // the file's content included, 14.25): its error finding carries the
    // stable code and the concerned configuration file in the anchoring
    // form (SPEC 14, 12.7).
    if (error instanceof UsageError && error.code === null) {
      error.code = "configuration-error";
      error.path = await anchoringPath(cwd, configPath);
    }
    throw error;
  }
  const root = path.dirname(configPath);
  lastResolvedRoot = root;
  if (deviations.readersAddEntries && buildOrReadInvocation) {
    await addReaderEntry(root);
  }
  return { root, ...groups, cwd, configPath };
}

/**
 * The top-level keys SPEC 7 defines: `specs` and, in T13.5-8's workspaces,
 * `code` are served; `markdown`, `coverage`, and `policy` lie outside
 * §CONF-CORE's workspaces — refused loudly (exit 70), never half-read —
 * and every other key is unknown, a configuration error (14.14), as
 * T13.5-8's acquisition-after arm stages it (CERTIFICATIONS.md §CONF-CORE's
 * staging constraint: a configuration made invalid by an unknown key in its
 * top-level object).
 */
const SERVED_CONFIG_KEYS = new Set(["specs", "code"]);
const UNSERVED_CONFIG_KEYS = new Set(["markdown", "coverage", "policy"]);

/**
 * Validate one group map (SPEC 7.1 spec groups, 7.2 code groups — one glob
 * grammar on both sides): each group a list of glob strings, none spelling
 * a pattern outside the workspace root.
 */
function validatedGroups(map, kind, section) {
  if (map === null || typeof map !== "object" || Array.isArray(map)) {
    throw new UsageError(
      `configuration error: \`${kind === "spec" ? "specs" : "code"}\` must be a map of groups (SPEC ${section})`,
    );
  }
  /** @type {Record<string, string[]>} */
  const groups = {};
  for (const [name, globs] of Object.entries(map)) {
    if (!Array.isArray(globs) || globs.some((g) => typeof g !== "string")) {
      throw new UsageError(
        `configuration error: ${kind} group ${name} must be a list of glob strings (SPEC ${section})`,
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
  return groups;
}

/**
 * The post-location half of {@link loadConfig}: read, parse, and validate
 * the located configuration file; returns its spec groups and code groups
 * (none where `code` is absent, SPEC 7).
 */
async function readConfigGroups(configPath) {
  let text;
  try {
    text = await fsp.readFile(configPath, "utf8");
  } catch (error) {
    throw new UsageError(
      `configuration error: cannot read ${CONFIG_NAME}: ${error.message}`,
    );
  }
  const data = parseConfigSource(text);
  const keys = Object.keys(data);
  for (const key of keys) {
    if (!SERVED_CONFIG_KEYS.has(key) && !UNSERVED_CONFIG_KEYS.has(key)) {
      throw new UsageError(
        `configuration error: unknown key ${JSON.stringify(key)} in the configuration's top-level object (SPEC 7, 14.14)`,
      );
    }
  }
  for (const key of keys) {
    if (UNSERVED_CONFIG_KEYS.has(key)) {
      throw new FixtureScopeError(
        `the configuration key ${key} lies outside this fixture's workspaces (§CONF-CORE: no markdown, coverage, or policy keys)`,
      );
    }
  }
  if (data.specs === undefined) {
    throw new UsageError(
      "configuration error: `specs` is required and must be a map of groups (SPEC 7)",
    );
  }
  return {
    specGroups: validatedGroups(data.specs, "spec", "7.1"),
    codeGroups:
      data.code === undefined ? {} : validatedGroups(data.code, "code", "7.2"),
  };
}

// ---------------------------------------------------------------------------
// Glob matching (SPEC 7): `*`, `?`, `**`, literals, dot rule, case-sensitive
// ---------------------------------------------------------------------------

const segmentRegexCache = new Map();

function segmentRegex(patternSegment) {
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

function segmentMatches(patternSegment, pathSegment) {
  // Dot rule (SPEC 7): a path segment beginning with `.` is matched only by
  // a pattern segment written with a leading `.`.
  if (pathSegment.startsWith(".") && !patternSegment.startsWith("."))
    return false;
  return segmentRegex(patternSegment).test(pathSegment);
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
    if (!segmentMatches(ps, pathSegments[si])) return false;
    return match(pi + 1, si + 1);
  };
  return match(0, 0);
}

// ---------------------------------------------------------------------------
// Discovery (SPEC 7, 13.4, 14.14, 14.25): walk plain files, never following
// symlinks
// ---------------------------------------------------------------------------

/**
 * Whether `pattern` can match a path below the directory whose
 * workspace-relative segments are `dirSegments` (SPEC 7: `**` spans whole
 * segments, none included, but never a segment beginning with `.`; any
 * other pattern segment matches one path segment, a dot segment only where
 * the pattern segment is written with a leading `.`) — so discovery lists
 * exactly the directories some configured glob can reach into.
 */
function globReachesBelow(pattern, dirSegments) {
  const patternSegments = pattern.split("/");
  const reach = (pi, si) => {
    if (si === dirSegments.length) return pi < patternSegments.length;
    if (pi === patternSegments.length) return false;
    const ps = patternSegments[pi];
    if (ps === "**") {
      if (reach(pi + 1, si)) return true;
      return !dirSegments[si].startsWith(".") && reach(pi, si + 1);
    }
    return segmentMatches(ps, dirSegments[si]) && reach(pi + 1, si + 1);
  };
  return reach(0, 0);
}

/** Derived files are never sources (SPEC 13.4). */
function isDerivedPath(rel) {
  const base = rel.split("/").at(-1) ?? rel;
  return (
    base.includes(".xspec.") || rel === ".xspec" || rel.startsWith(".xspec/")
  );
}

/** Whether a configured group of `groups` matches `rel` (SPEC 7). */
function groupsMatch(groups, rel) {
  return Object.values(groups).some((globs) =>
    globs.some((glob) => globMatches(glob, rel)),
  );
}

/**
 * Discover the workspace's sources (SPEC 7, 13.4) under a loaded
 * configuration: returns `{ spec, code }`, the discovered spec-group and
 * code-group files' workspace-relative paths, each list sorted. The walk
 * starts at the workspace root and lists only directories some configured
 * glob — of either kind — can reach into (globReachesBelow), never the
 * graph-data area's own path `.xspec` (no file under it belongs to any
 * group, 13.4 — so neither the lock directory nor the session directory is
 * ever listed here, whatever occupies them); a symbolic link is never
 * discovered or traversed, and a derived path is no source (isDerivedPath).
 * A listing the environment refuses is the read failure of 14.25, a usage
 * error concerning that directory's workspace-relative path (exit 2, the
 * command stopping at it — T14-10(g), T13.5-8's acquisition-after arm,
 * T13.5-12(e)); a directory found absent, removed since its parent was
 * listed, lists nothing (14.25: nonexistence is never a read failure). A
 * discovered file both a spec glob and a code glob match is a
 * configuration error (7.2, 14.14) concerning the configuration file in
 * the anchoring form (14, 12.7) — met here, when the command discovers its
 * sources (14.14), so before acquisition at a mutating command's first
 * discovery and after the hold at its second (13.5; T13.5-8, T13.5-12(d)).
 * Code sources are edgeless whole-file code locations judged on 14.20's
 * accepting side alone (§CONF-CORE), so their content is never read.
 */
async function discover(config) {
  const globs = [
    ...Object.values(config.specGroups).flat(),
    ...Object.values(config.codeGroups).flat(),
  ];
  /** @type {string[]} */
  const files = [];
  const walk = async (rel, segments) => {
    let entries;
    try {
      entries = await fsp.readdir(
        rel === "" ? config.root : path.join(config.root, rel),
        { withFileTypes: true },
      );
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return;
      if (!isSystemError(error)) throw error;
      const concerned = rel === "" ? "." : rel;
      throw new UsageError(
        `read failure: cannot list the directory ${concerned} (${error.code}; SPEC 7, 14.25)`,
        { code: CODE_TOKENS["14.25"], path: concerned },
      );
    }
    for (const entry of entries) {
      const childRel = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isSymbolicLink()) continue; // never discovered, never traversed
      if (entry.isDirectory()) {
        if (childRel === AREA_REL) continue;
        const childSegments = [...segments, entry.name];
        if (globs.some((glob) => globReachesBelow(glob, childSegments))) {
          await walk(childRel, childSegments);
        }
      } else if (entry.isFile()) {
        files.push(childRel);
      }
    }
  };
  if (globs.some((glob) => globReachesBelow(glob, []))) await walk("", []);
  files.sort();
  /** @type {string[]} */
  const spec = [];
  /** @type {string[]} */
  const code = [];
  for (const rel of files) {
    if (isDerivedPath(rel)) continue;
    const specMatched = groupsMatch(config.specGroups, rel);
    const codeMatched = groupsMatch(config.codeGroups, rel);
    if (specMatched && codeMatched) {
      throw new UsageError(
        `configuration error: ${rel} is matched by both a spec group and a code group (SPEC 7.2, 14.14)`,
        {
          code: "configuration-error",
          path: await anchoringPath(config.cwd, config.configPath),
        },
      );
    }
    if (specMatched) spec.push(rel);
    else if (codeMatched) code.push(rel);
  }
  return { spec, code };
}

// ---------------------------------------------------------------------------
// MDX-lite parsing (SPEC 1, 2.7-lite): sections, ids, byte ranges
// ---------------------------------------------------------------------------

const WHITESPACE = new Set(["\t", "\n", "\v", "\f", "\r", " "]);
const FORBIDDEN_SEGMENTS = new Set([
  "$",
  "__proto__",
  "prototype",
  "constructor",
  "then",
]);

function isWhitespaceOnly(text) {
  for (const ch of text) {
    if (!WHITESPACE.has(ch)) return false;
  }
  return true;
}

function segmentValid(segment) {
  if (segment.length === 0) return false;
  if (FORBIDDEN_SEGMENTS.has(segment)) return false;
  for (const ch of segment) {
    if (ch === "." || ch === "#") return false;
    if (WHITESPACE.has(ch)) return false;
    const code = ch.codePointAt(0);
    if (code <= 0x1f || code === 0x7f) return false;
  }
  return true;
}

/**
 * Map string (code-unit) indices to UTF-8 byte offsets. In-scope sources are
 * ASCII, where the identity applies; the general path stays correct.
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

/**
 * Parse one source file into a section tree with exact ranges.
 * Returns { root, sections, findings } where each section carries
 * { id, parent, children, openStart, openEnd, closeStart, closeEnd,
 *   idValueStart, idValueEnd } as string indices.
 */
function parseMdx(text, rel) {
  /** @type {Finding[]} */
  const findings = [];
  const root = {
    id: null,
    isRoot: true,
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
  const fail20 = (at, message) => {
    findings.push({
      condition: "14.20",
      message: `unparseable source: ${message}`,
      file: rel,
      location: { start: at, end: at + 1 },
    });
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
        return { root, sections, findings };
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
      id: null,
      parent: stack.at(-1),
      children: [],
      openStart: i,
      openEnd: -1,
      closeStart: -1,
      closeEnd: -1,
      idValueStart: -1,
      idValueEnd: -1,
    };
    let j = i + open[0].length;
    let selfClosing = false;
    for (;;) {
      while (j < text.length && WHITESPACE.has(text[j])) j += 1;
      if (j >= text.length) {
        fail20(i, "unterminated section tag");
        return { root, sections, findings };
      }
      if (text[j] === ">") {
        j += 1;
        break;
      }
      if (text[j] === "/" && text[j + 1] === ">") {
        selfClosing = true;
        j += 2;
        break;
      }
      const attr = /^[A-Za-z][\w-]*/.exec(text.slice(j));
      if (!attr) {
        fail20(j, "malformed attribute in a section tag");
        return { root, sections, findings };
      }
      const name = attr[0];
      j += name.length;
      let value;
      let valueStart = -1;
      let valueEnd = -1;
      if (text[j] === "=") {
        j += 1;
        const quote = text[j];
        if (quote !== '"' && quote !== "'") {
          fail20(j, "section props in this scope are quoted string literals");
          return { root, sections, findings };
        }
        valueStart = j + 1;
        const end = text.indexOf(quote, valueStart);
        if (end === -1) {
          fail20(j, "unterminated attribute value");
          return { root, sections, findings };
        }
        value = text.slice(valueStart, end);
        valueEnd = end;
        j = end + 1;
      }
      if (name === "id" && value !== undefined) {
        node.id = value;
        node.idValueStart = valueStart;
        node.idValueEnd = valueEnd;
      }
    }
    node.openEnd = j;
    if (selfClosing) {
      node.closeStart = node.openEnd;
      node.closeEnd = node.openEnd;
      node.selfClosing = true;
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
    fail20(text.length - 1, "unclosed section tag");
  }
  return { root, sections, findings };
}

/** Structural, uniqueness, and 1.4 validation (SPEC 1.3, 1.4; 14.1–14.4). */
function validateSections(rel, sections) {
  /** @type {Finding[]} */
  const findings = [];
  const seen = new Set();
  for (const node of sections) {
    const location = { start: node.openStart, end: node.openEnd };
    if (node.id === null || node.id === undefined) {
      findings.push({
        condition: "14.1",
        message:
          "missing id: every non-root section must have an `id` (SPEC 1.3)",
        file: rel,
        location,
      });
      continue;
    }
    const segments = node.id.split(".");
    for (const segment of segments) {
      if (!segmentValid(segment)) {
        findings.push({
          condition: "14.4",
          message: `invalid segment ${JSON.stringify(segment)} in id ${JSON.stringify(node.id)} (SPEC 1.4)`,
          file: rel,
          location,
        });
      }
    }
    // Structural rule (SPEC 1.3). A non-root parent lacking its own id
    // masks this condition for its immediate children (SPEC 14.2).
    const parentIsRoot = node.parent.isRoot === true;
    const parentId = node.parent.id;
    if (parentIsRoot || typeof parentId === "string") {
      const expectedPrefix = parentIsRoot ? "" : `${parentId}.`;
      const structural =
        node.id.startsWith(expectedPrefix) &&
        node.id.length > expectedPrefix.length &&
        !node.id.slice(expectedPrefix.length).includes(".");
      if (!structural) {
        findings.push({
          condition: "14.2",
          message:
            `invalid structural id ${JSON.stringify(node.id)}: expected the parent id ` +
            `${parentIsRoot ? "(top level)" : JSON.stringify(parentId)} plus "." plus exactly one segment (SPEC 1.3)`,
          file: rel,
          location,
        });
      }
    }
    if (seen.has(node.id)) {
      findings.push({
        condition: "14.3",
        message: `duplicate id ${JSON.stringify(node.id)} within ${rel} (SPEC 1.3)`,
        file: rel,
        location,
      });
    }
    seen.add(node.id);
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Text computation (SPEC 3 removal + line-drop; 1.6 own/subtree text)
// ---------------------------------------------------------------------------

/** Lines with terminators per SPEC 3's line model (CRLF, lone LF, lone CR). */
function splitLines(text) {
  const lines = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "\r") {
      const end = text[i + 1] === "\n" ? i + 2 : i + 1;
      lines.push({ start, contentEnd: i, end });
      start = end;
      i = end;
    } else if (c === "\n") {
      lines.push({ start, contentEnd: i, end: i + 1 });
      start = i + 1;
      i += 1;
    } else {
      i += 1;
    }
  }
  if (start < text.length) {
    lines.push({ start, contentEnd: text.length, end: text.length });
  }
  return lines;
}

/**
 * Compute the document-order kept text pieces, each attributed to its
 * innermost containing node, applying tag removal and the line-drop rule
 * (SPEC 3). Returns [{ owner, text }] in document order.
 */
function computeTextPieces(text, parsed) {
  const removals = [];
  for (const node of parsed.sections) {
    if (node.selfClosing) {
      removals.push([node.openStart, node.openEnd]);
    } else {
      removals.push([node.openStart, node.openEnd]);
      removals.push([node.closeStart, node.closeEnd]);
    }
  }
  removals.sort((a, b) => a[0] - b[0]);

  const ownerAt = (pos) => {
    let owner = parsed.root;
    for (;;) {
      const child = owner.children.find(
        (candidate) =>
          !candidate.selfClosing &&
          pos >= candidate.openEnd &&
          pos < candidate.closeStart,
      );
      if (!child) return owner;
      owner = child;
    }
  };

  const pieces = [];
  for (const line of splitLines(text)) {
    // Kept intervals of the line's content after exact removal.
    const kept = [];
    let cursor = line.start;
    let hadRemoval = false;
    for (const [rs, re] of removals) {
      if (re <= line.start || rs >= line.contentEnd) continue;
      hadRemoval = true;
      const clippedStart = Math.max(rs, line.start);
      if (clippedStart > cursor) kept.push([cursor, clippedStart]);
      cursor = Math.max(cursor, Math.min(re, line.contentEnd));
    }
    if (cursor < line.contentEnd) kept.push([cursor, line.contentEnd]);
    const remainder = kept.map(([a, b]) => text.slice(a, b)).join("");
    // Line-drop rule (SPEC 3): a line left empty or whitespace-only purely
    // by removals is dropped together with its terminator.
    if (hadRemoval && isWhitespaceOnly(remainder)) continue;
    for (const [a, b] of kept) {
      if (b > a)
        pieces.push({ owner: ownerAt(a), pos: a, text: text.slice(a, b) });
    }
    if (line.end > line.contentEnd) {
      pieces.push({
        owner: ownerAt(line.contentEnd),
        pos: line.contentEnd,
        text: text.slice(line.contentEnd, line.end),
      });
    }
  }
  return pieces;
}

// ---------------------------------------------------------------------------
// Graph model: nodes with identities, texts, ranges, hashes; contains edges
// ---------------------------------------------------------------------------

/**
 * Build the file model: nodes (root first, then sections in document order)
 * with identity, sourceRange (bytes), ownText, subtreeText, and hashes.
 */
function buildFileModel(rel, text, byteLength, parsed) {
  const byteOf = byteOffsetMapper(text, byteLength);
  const pieces = computeTextPieces(text, parsed);

  const descendsFrom = (node, ancestor) => {
    for (let n = node; n !== null; n = n.parent ?? null) {
      if (n === ancestor) return true;
    }
    return false;
  };

  const allNodes = [parsed.root, ...parsed.sections];
  const metadataHash = sha256Hex("metadata none");
  for (const node of allNodes) {
    node.identity = node === parsed.root ? rel : `${rel}#${node.id}`;
    node.ownText = pieces
      .filter((piece) => piece.owner === node)
      .map((piece) => piece.text)
      .join("");
    node.subtreeText = pieces
      .filter((piece) => descendsFrom(piece.owner, node))
      .map((piece) => piece.text)
      .join("");
    node.sourceRange =
      node === parsed.root
        ? { start: 0, end: byteLength }
        : { start: byteOf(node.openStart), end: byteOf(node.closeEnd) };
  }
  // Hashes bottom-up: own content framing (length-prefixed runs and child
  // markers interleaved at their document positions, never identities —
  // SPEC 5.4/6.2 purity), then structural subtree/effective hashes.
  const hashNode = (node) => {
    for (const child of node.children) hashNode(child);
    const events = [
      ...pieces
        .filter((piece) => piece.owner === node)
        .map((piece) => ({
          pos: piece.pos,
          frame: `R${String(Buffer.byteLength(piece.text, "utf8"))}:${piece.text}`,
        })),
      ...node.children.map((child) => ({ pos: child.openStart, frame: "C;" })),
    ].sort((a, b) => a.pos - b.pos);
    node.ownHash = sha256Hex(
      `own ${events.map((event) => event.frame).join("")}`,
    );
    node.subtreeHash = sha256Hex(
      `subtree ${node.ownHash}${node.children.map((child) => child.subtreeHash).join("")}`,
    );
    node.effectiveHash = sha256Hex(
      `effective ${node.ownHash}${node.children.map((child) => child.effectiveHash).join("")}`,
    );
    node.metadataHash = metadataHash;
  };
  hashNode(parsed.root);
  return { rel, root: parsed.root, sections: parsed.sections, nodes: allNodes };
}

/**
 * Load the workspace graph over the sources a discovery yielded (`discovery`,
 * from discover), making `build`'s validations (SPEC 12.1, 14): parse and
 * validate the spec sources — one found absent when its content is read,
 * removed or relocated since discovery, reading as undiscovered (SPEC
 * 14.25) — the code sources entering as edgeless whole-file code locations,
 * by path alone (§CONF-CORE), and then the journal's validation (14.13,
 * journalFindings), its findings reported beside the sources' (SPEC 14:
 * each condition reported, not only the first). Throws FindingsError (exit
 * 1) when validation fails — `build` reports the errors and writes nothing
 * (12.1), the gate of 13.3 turns back every gated read and mutating `review`
 * subcommand (13.3), and the valid-workspace precondition of `rename`/`move`
 * refuses (6.4, 6.5), each modifying nothing. `check`, which reports the
 * journal's findings beside its own staleness and session findings (12.2),
 * makes the journal's validation itself (`judgeJournal: false`).
 */
async function loadGraph(root, discovery, { judgeJournal = true } = {}) {
  /** @type {Finding[]} */
  const findings = [];
  const files = [];
  for (const rel of discovery.spec) {
    if (!rel.endsWith(".mdx")) {
      findings.push({
        condition: "14.19",
        message: `invalid source path: spec-group files must have the .mdx extension (SPEC 7.1): ${rel}`,
        file: rel,
      });
      continue;
    }
    if (rel.includes("#")) {
      findings.push({
        condition: "14.19",
        message: `invalid source path: a discovered source path must not contain '#' (SPEC 1.5): ${rel}`,
        file: rel,
      });
      continue;
    }
    let bytes;
    try {
      bytes = await fsp.readFile(path.join(root, rel));
    } catch (error) {
      // SPEC 14.25: a discovered source found absent when its content is
      // read — removed or relocated since discovery (13.5), by a `move`
      // running beside this command among others (TEST-SPEC P-10's readers)
      // — reads as undiscovered, as though discovery had not yielded it.
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") continue;
      throw error;
    }
    let text;
    try {
      // A leading byte-order mark is kept (ignoreBOM), so it is seen below
      // as the unparseable-source condition it is (SPEC 1.6, 14.20) rather
      // than silently stripped by the decoder's default.
      text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        bytes,
      );
    } catch {
      findings.push({
        condition: "14.20",
        message: `unparseable source: not valid UTF-8 (SPEC 1.6): ${rel}`,
        file: rel,
        location: { start: 0, end: 1 },
      });
      continue;
    }
    if (text.charCodeAt(0) === 0xfeff) {
      findings.push({
        condition: "14.20",
        message: `unparseable source: begins with a byte-order mark (SPEC 1.6): ${rel}`,
        file: rel,
        // One zero-length range at the failure's offset — 0 for a byte-order
        // mark (SPEC 14; CERTIFICATIONS.md §CONF-CORE's staging constraint).
        location: { start: 0, end: 0 },
      });
      continue;
    }
    const parsed = parseMdx(text, rel);
    findings.push(...parsed.findings);
    if (parsed.findings.length > 0) continue; // 14.20 masks conditions inside
    findings.push(...validateSections(rel, parsed.sections));
    files.push({ rel, text, bytes, parsed });
  }
  if (judgeJournal) findings.push(...(await journalFindings(root)));
  if (findings.length > 0) throw new FindingsError(findings);

  const models = files.map((file) =>
    buildFileModel(file.rel, file.text, file.bytes.length, file.parsed),
  );
  const byIdentity = new Map();
  for (const model of models) {
    for (const node of model.nodes) byIdentity.set(node.identity, node);
  }
  return {
    root,
    files: models,
    /** The discovered code sources' paths: edgeless whole-file locations. */
    code: discovery.code,
    byIdentity,
    /** Document index of a node within its file (root = 0). */
    docIndex(node) {
      const model = models.find((candidate) => candidate.nodes.includes(node));
      return model ? model.nodes.indexOf(node) : 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Derived files: generated modules + graph data (SPEC 13.1, 13.3, 13.4)
// ---------------------------------------------------------------------------

const GRAPH_DATA_REL = ".xspec/graph.json";

function modulePathFor(rel) {
  return rel.replace(/\.mdx$/, ".xspec.ts");
}

function moduleContent(model) {
  const data = {};
  for (const node of model.nodes) {
    data[node.identity] = { subtreeText: node.subtreeText };
  }
  return (
    `// Generated by xspec from ${model.rel}. DO NOT EDIT.\n` +
    `// CONF-CORE certification fixture module (SPEC 13.1: content beyond\n` +
    `// path, byte-determinism, write discipline, and atomicity is out of\n` +
    `// this fixture's certified scope).\n` +
    `const DATA = ${canonicalJson(data)};\n` +
    `const SPEC: unknown = DATA;\n` +
    `export default SPEC;\n` +
    `export function text(node: unknown): string {\n` +
    `  void node;\n` +
    `  throw new Error("not supported by the CONF-CORE fixture");\n` +
    `}\n`
  );
}

/** Derived-file paths as `build` records them: the modules generated now. */
function currentDerivedPaths(graph) {
  return graph.files.map((model) => modulePathFor(model.rel)).sort();
}

/**
 * Graph data exactly as `build` writes it (SPEC 13.3, 13.4): per-file
 * section ids, node hashes, and source ranges, the discovered code sources'
 * whole-file locations by path (`code`), plus the recorded derived-file
 * paths — the paths generated now or, for the 13.3 refresh, the stored
 * record left unchanged (`derived`).
 */
function graphDataContent(graph, derived = currentDerivedPaths(graph)) {
  const filesData = {};
  for (const model of graph.files) {
    const nodes = {};
    for (const node of model.nodes) {
      nodes[node.identity] = {
        hashes: {
          effectiveHash: node.effectiveHash,
          metadataHash: node.metadataHash,
          ownHash: node.ownHash,
          subtreeHash: node.subtreeHash,
        },
        sourceRange: [node.sourceRange.start, node.sourceRange.end],
      };
    }
    filesData[model.rel] = {
      ids: model.sections.map((section) => section.id),
      nodes,
    };
  }
  return canonicalJson({ code: graph.code, derived, files: filesData }) + "\n";
}

async function readRecordedDerived(root) {
  try {
    const parsed = JSON.parse(
      await fsp.readFile(path.join(root, GRAPH_DATA_REL), "utf8"),
    );
    if (Array.isArray(parsed?.derived)) {
      return parsed.derived.filter(
        (entry) =>
          typeof entry === "string" &&
          entry.split("/").at(-1)?.includes(".xspec."),
      );
    }
  } catch {
    // Missing or unreadable graph data reads as no recorded derived paths.
  }
  return [];
}

/**
 * The writer every derived-file write goes through — regenerate() and the
 * 13.3 refresh (refreshStaleGraphData) are this fixture's only derived-file
 * writers; durable files (journal, sessions, sources) are written atomically
 * everywhere.
 *
 * VIOL-CORE-PARTIALWRITE (CERTIFICATIONS.md): derived-file writes are not
 * atomic in their observable effect — while a derived file is being written,
 * its path holds a strict prefix of the new content for a sustained interval,
 * long relative to a concurrent reader's polling cadence, before the
 * complete content appears (see writeFilePartialThenComplete). Switching the
 * writer here deviates every derived write — generated modules and graph
 * data — and nothing else: durable files are unaffected, orphan removal and
 * each command's completed final bytes are unchanged.
 */
function derivedWriter() {
  return deviations.partialDerivedWrites
    ? writeFilePartialThenComplete
    : writeFileAtomic;
}

/**
 * Regenerate every derived file exactly as `build` writes it: modules per
 * source, orphan removal via the recorded derived paths, graph data
 * (SPEC 12.1, 13.3, 13.4). Rename and move finish with this same
 * regeneration (SPEC 6.4, 6.5).
 */
async function regenerate(graph) {
  const write = derivedWriter();
  const recorded = await readRecordedDerived(graph.root);
  const current = new Set(graph.files.map((model) => modulePathFor(model.rel)));
  for (const orphan of recorded) {
    if (!current.has(orphan)) {
      await fsp.rm(path.join(graph.root, orphan), { force: true });
    }
  }
  for (const model of graph.files) {
    await write(
      path.join(graph.root, modulePathFor(model.rel)),
      moduleContent(model),
    );
  }
  await write(path.join(graph.root, GRAPH_DATA_REL), graphDataContent(graph));
}

/**
 * The stored graph data as the 13.3 refresh consults it: `missing` (no
 * file), `unreadable` (present but not readable as a record, SPEC 14.23 — a
 * state refresh neither repairs nor replaces), or `readable` with its exact
 * bytes and its recorded derived-file paths.
 */
async function readGraphDataRecord(root) {
  let text;
  try {
    text = await fsp.readFile(path.join(root, GRAPH_DATA_REL), "utf8");
  } catch (error) {
    return { state: error.code === "ENOENT" ? "missing" : "unreadable" };
  }
  try {
    const parsed = JSON.parse(text);
    if (
      Array.isArray(parsed?.derived) &&
      parsed.derived.every((entry) => typeof entry === "string") &&
      typeof parsed.files === "object" &&
      parsed.files !== null
    ) {
      return { state: "readable", text, derived: parsed.derived };
    }
  } catch {
    // Not JSON: not readable as a record.
  }
  return { state: "unreadable" };
}

/**
 * The 13.3 refresh of stale graph data, as a mutating `review` subcommand
 * performs it (CERTIFICATIONS.md §CONF-CORE Scope: "on a workspace whose
 * graph data is stale but whose sources are valid … the 13.3 refresh a
 * mutating `review` subcommand performs after the hold, past every outcome
 * 10.7 orders before it, and before its session write, writing graph data
 * byte-identical to what `build` writes (13.3, T10.1-1), as T13.5-1's
 * stale-workspace arm observes it"). The subcommand's operation calls it —
 * runMutating hands it over — just before the session write, once every
 * outcome 10.7 orders past the gate has passed, so a run one of them turns
 * back never reaches it (SPEC 10.7: stale graph data stays stale). Graph
 * data is stale when it is missing or does not match the current sources —
 * a comparison from which the recorded derived-file paths are excluded — and
 * is then rewritten exactly as `build` writes it, except that no module is
 * generated or removed and the recorded derived-file paths are left
 * unchanged (SPEC 13.3); nothing else is written. Current graph data is
 * refreshed by nothing (its bytes untouched), and a record that exists but
 * cannot be read (SPEC 14.23) is neither repaired nor replaced. `graph` is
 * the current sources' graph as the gate of 13.3 loaded it (runMutating's
 * `judgeWorkspace`): an invalid workspace reported its findings there, before
 * anything is written (SPEC 13.3, 12.0), so the refresh only ever writes.
 */
async function refreshStaleGraphData(config, graph) {
  const record = await readGraphDataRecord(config.root);
  if (record.state === "unreadable") return;
  const content = graphDataContent(
    graph,
    record.state === "readable" ? record.derived : undefined,
  );
  if (record.state === "readable" && record.text === content) return;
  await derivedWriter()(path.join(config.root, GRAPH_DATA_REL), content);
}

// ---------------------------------------------------------------------------
// Journal (SPEC 6.1, 6.3): append-only JSON lines; forward identity mapping
// ---------------------------------------------------------------------------

const JOURNAL_REL = ".xspec/journal";

async function readJournal(root) {
  const abs = path.join(root, JOURNAL_REL);
  let stats;
  try {
    stats = await fsp.lstat(abs);
  } catch (error) {
    if (error.code === "ENOENT")
      return { entries: [], lineCount: 0, plain: true, exists: false };
    throw error;
  }
  if (!stats.isFile()) {
    // A journal path occupied by anything other than a plain file is a
    // journal error (SPEC 13.4, 14.13) — never read.
    return { entries: [], lineCount: 0, plain: false, exists: true };
  }
  const text = await fsp.readFile(abs, "utf8");
  const lines = text
    .split("\n")
    .filter((line, index, all) => !(line === "" && index === all.length - 1));
  const entries = lines.map((line) => {
    try {
      const entry = JSON.parse(line);
      if (entry && (entry.kind === "rename" || entry.kind === "move"))
        return entry;
    } catch {
      // Malformed entries surface as journal errors (14.13, journalFindings);
      // mapping skips them.
    }
    return null;
  });
  return { entries, lineCount: lines.length, plain: true, exists: true };
}

/**
 * The journal's validation (SPEC 14.13; 6.1, 13.4): one of `build`'s
 * validations (12.1), so made wherever they are — by `build`, by the gate of
 * 13.3 over every gated read and mutating `review` subcommand, and by the
 * valid-workspace precondition of `rename`/`move` (6.4, 6.5), each through
 * loadGraph, and by `check` (12.2) — and first by a given baseline's
 * resolution (6.3, resolveBaseline). A journal path occupied by anything
 * other than a plain file (13.4) is one finding, the journal never read;
 * otherwise every line readJournal reads as no entry — not a JSON object of
 * the `rename` or `move` kind — is one, naming its line (14.13). Each
 * concerns the journal path, `.xspec/journal`, and has no in-source location
 * (SPEC 14: `locations` [], `path` the journal path; T6.1-3). An absent
 * journal is empty (6.1) and meets none. The line VIOL-CORE-CHATTYREADS'
 * `check` appends (CHATTY_READ_ENTRY) reads as an entry — a rename mapping
 * nothing — so it meets none either and gates nothing (CERTIFICATIONS.md
 * §VIOL-CORE-CHATTYREADS).
 * @returns {Promise<Finding[]>}
 */
async function journalFindings(root) {
  const journal = await readJournal(root);
  if (!journal.plain) {
    return [
      {
        condition: "14.13",
        message: `journal error: ${JOURNAL_REL} is occupied by something other than a plain file (SPEC 13.4)`,
        file: JOURNAL_REL,
      },
    ];
  }
  /** @type {Finding[]} */
  const findings = [];
  journal.entries.forEach((entry, index) => {
    if (entry === null) {
      findings.push({
        condition: "14.13",
        message: `journal error: malformed entry on line ${String(index + 1)} of ${JOURNAL_REL}`,
        file: JOURNAL_REL,
      });
    }
  });
  return findings;
}

/**
 * A given baseline's resolution (SPEC 6.3) — `impact --base` (9) and `review
 * create --base` (10.7) — in this git-less scope, where it never resolves:
 * it reads the current journal before any other cause can fail it (6.3,
 * 12.0), and a journal error there (14.13, journalFindings), whatever its
 * form, fails it as the usage error carrying condition 13's stable code and
 * concerned path — the exit-2 error document's `code` `journal-error`,
 * `path` `.xspec/journal`, `locations` [] (12.7), one error however many
 * lines offend, never the gate's finding (6.3: a given baseline is never so
 * masked); otherwise the ref cannot be read, the configuration file lying in
 * no repository — the plain usage error of 6.3, `code` and `path` null.
 * Never made at workspace load: `review create` resolves its baseline among
 * runMutating's `judgeArguments`, past acquisition and the hold (13.5;
 * T13.5-8), and `impact`, which acquires nothing, at the same point, past
 * its configuration and discovery (commandImpact).
 */
async function resolveBaseline(root, ref) {
  const findings = await journalFindings(root);
  if (findings.length > 0) {
    throw new UsageError(
      `cannot resolve the baseline ${ref}: its resolution reads the current journal first, and that journal has a journal error (journal-error, ${JOURNAL_REL}) — ${findings.map((finding) => finding.message).join("; ")} (SPEC 6.3, 14.13)`,
      { code: CODE_TOKENS["14.13"], path: JOURNAL_REL },
    );
  }
  throw new UsageError(
    `cannot read the baseline ${ref}: the workspace has no git repository (SPEC 6.3, 12.0)`,
  );
}

/**
 * Append one entry to the journal (SPEC 6.1), atomic in its observable
 * effect (13.5): the journal's prior bytes and the new line are written to a
 * temporary file renamed over the journal (writeFileAtomic), so the path
 * holds its prior state — absence included — or the complete new content at
 * every moment, never the empty file an in-place append's creation exposes
 * before its write lands (TEST-SPEC P-10's polling reader observes the
 * journal). The conformer appends only under exclusivity (13.5), so the
 * read and the replacement race no other append; VIOL-CORE-CHATTYREADS'
 * `check` appends outside it, where a line a concurrent append overwrites
 * changes none of that violator's outcomes (its `check` modifies the
 * journal either way).
 */
async function appendJournal(root, entry) {
  const abs = path.join(root, JOURNAL_REL);
  let prior = Buffer.alloc(0);
  try {
    prior = await fsp.readFile(abs);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await writeFileAtomic(
    abs,
    Buffer.concat([prior, Buffer.from(canonicalJson(entry) + "\n")]),
  );
}

/** Map an identity forward through journal entries (SPEC 6.3, 10.4). */
function mapIdentityForward(identity, entries) {
  let current = identity;
  for (const entry of entries) {
    if (entry === null) continue;
    if (entry.kind === "rename") {
      const prefix = `${entry.path}#${entry.from}`;
      if (current === prefix) current = `${entry.path}#${entry.to}`;
      else if (current.startsWith(`${prefix}.`)) {
        current = `${entry.path}#${entry.to}` + current.slice(prefix.length);
      }
    } else if (entry.kind === "move") {
      if (current === entry.from) current = entry.to;
      else if (current.startsWith(`${entry.from}#`))
        current = entry.to + current.slice(entry.from.length);
    }
  }
  return current;
}

// ---------------------------------------------------------------------------
// Workspace exclusivity (SPEC 13.5): the lock directory `.xspec/lock`
// ---------------------------------------------------------------------------

/** The graph-data area's own path and the lock path (SPEC 11.6, 13.4, 13.5). */
const AREA_REL = ".xspec";
const LOCK_REL = ".xspec/lock";

/**
 * This conformer's entry form (SPEC 13.5: a plain file whose name records
 * the acquiring process's identifier and distinguishes the run, in a form
 * otherwise left open): `<identifier>-<16 lowercase hex digits>`, the digits
 * drawn at random for each run, so no other run's entry ever bears the name
 * even where two runs' processes share an identifier (separate
 * process-identifier namespaces, TEST-SPEC T13.5-10(f)). Entries are empty.
 * Their names are coordination state outside 12.0's determinism (13.4), and
 * no diagnostic names one.
 */
const ENTRY_NAME = /^([1-9][0-9]*)-[0-9a-f]{16}$/;

function newEntryName() {
  return `${String(process.pid)}-${randomBytes(8).toString("hex")}`;
}

/**
 * The identifier a lock-directory name records in this conformer's entry
 * form, judged on the name's bytes (a name that is not ASCII matches
 * nothing), or `null` where it is in no such form.
 */
function recordedIdentifier(nameBytes) {
  const match = ENTRY_NAME.exec(nameBytes.toString("latin1"));
  return match === null ? null : Number(match[1]);
}

/**
 * How many times one acquisition examines afresh after a concurrent run's
 * creation or deletion moved a path under it (an `EEXIST`, `ENOENT`, or
 * `ENOTDIR` of a creation; the lock directory vanishing before the listing).
 * Each retry follows another run's release or creation, so overlapping
 * acquisitions settle long before this bound; reaching it is a fixture
 * crash (exit 70), never a product outcome.
 */
const ACQUISITION_ATTEMPTS = 64;

/** Creation errors that mean a concurrent run moved a path: examine again. */
const RACED_CREATION = new Set(["EEXIST", "ENOENT", "ENOTDIR"]);

/**
 * The acquiring process's process list (SPEC 13.5: a run is alive on this
 * machine when the identifier its entry records is listed there) as a
 * judge: the numeric entries of `/proc` — processes, never threads, those of
 * this process's own process-identifier namespace where `/proc` is mounted
 * for it — read once per acquisition, and only when a name records an
 * identifier. Where `/proc` cannot be listed or does not list this process
 * itself, a signal-0 probe stands in (`EPERM`: listed).
 */
async function processListJudge() {
  let names = [];
  try {
    names = await fsp.readdir("/proc");
  } catch {
    // No process list to read: the probe below stands in.
  }
  const listed = new Set();
  for (const name of names) {
    if (/^[1-9][0-9]*$/.test(name)) listed.add(Number(name));
  }
  if (!listed.has(process.pid)) return pidAlive;
  return (pid) => listed.has(pid);
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/** Whether `error` is a filesystem error Node reports for a system call. */
function isSystemError(error) {
  return (
    error instanceof Error &&
    typeof error.code === "string" &&
    typeof error.syscall === "string"
  );
}

/**
 * Acquisition's write failure (14.24) or read failure (14.25) — a usage
 * error concerning `concerned`: the lock path, or `.xspec` for the area's
 * own path (SPEC 14). The message names the step and the error's code alone,
 * never an absolute path or an entry's name (12.0 determinism; TEST-SPEC
 * T13.5-10(d)'s determinism arms). Anything but a system error is a fixture
 * crash, rethrown as itself.
 */
function acquisitionFailure(kind, concerned, what, error) {
  if (!isSystemError(error)) return error;
  const condition = kind === "write" ? "14.24" : "14.25";
  return new UsageError(
    `${kind} failure at acquisition: cannot ${what} (${error.code}; SPEC 13.5, ${condition})`,
    { code: CODE_TOKENS[condition], path: concerned },
  );
}

const OCCUPANT_KINDS = {
  file: "a plain file",
  symlink: "a symbolic link",
  other: "an occupant that is neither a directory nor a plain file",
};

/**
 * An obstruction acquisition does not remove (SPEC 13.5, 13.4): the area's
 * own path holding anything but a directory, or the lock path anything but
 * a directory or a plain file — the write failure of 14.24 concerning that
 * path, the occupant left for manual deletion.
 */
function acquisitionObstructed(concerned, kind) {
  return new UsageError(
    `write failure at acquisition: ${concerned} is occupied by ${OCCUPANT_KINDS[kind]}, which acquisition does not remove — delete it manually while no mutating command runs (SPEC 13.5, 13.4, 14.24)`,
    { code: CODE_TOKENS["14.24"], path: concerned },
  );
}

/** The busy refusal of 14.26, concerning the lock path. */
function workspaceBusy() {
  return new UsageError(
    `workspace busy: an entry in the lock directory ${LOCK_REL} records an identifier this machine's process list lists, so another run holds exclusivity in this workspace (SPEC 13.5, 14.26)`,
    { code: CODE_TOKENS["14.26"], path: LOCK_REL },
  );
}

/**
 * The kind of `abs`'s occupant, examined without following a link:
 * `absent`, `directory`, `file`, `symlink`, or `other`. A refused
 * examination throws the system error.
 */
async function occupantKind(abs) {
  let stats;
  try {
    stats = await fsp.lstat(abs);
  } catch (error) {
    if (error?.code === "ENOENT") return "absent";
    throw error;
  }
  if (stats.isDirectory()) return "directory";
  if (stats.isFile()) return "file";
  if (stats.isSymbolicLink()) return "symlink";
  return "other";
}

/** `dir`'s child `name` as a byte path: names are handled as listed. */
function childPath(dir, name) {
  return Buffer.concat([dir, Buffer.from("/"), name]);
}

/** A deletion of release: refused or not, it changes no outcome (13.5). */
async function deleteQuietly(deletion) {
  try {
    await deletion();
  } catch {
    // SPEC 13.5, 14.24: a deletion the environment refuses at release
    // changes no outcome and is no write failure; one finding nothing,
    // interference's doing, likewise.
  }
}

/**
 * Acquire workspace exclusivity (SPEC 13.5) in the lock directory
 * `.xspec/lock`: establish this run's entry (establishEntry), list the lock
 * directory, and judge it (judgeLockDirectory) — refused by a live run's
 * entry, else removing every leftover. Returns `{ release }`: release
 * deletes this run's entry, then the lock directory, then the area's
 * directory where this acquisition created it — each deletion succeeding
 * only where the directory then holds nothing else, so release reads
 * nothing — and every deletion refused or finding nothing changes no
 * outcome. Acquisition's own failures release before they throw (13.5: a
 * command failed at acquisition releases), so the caller releases only
 * what an acquisition returned.
 */
async function acquireExclusivity(root) {
  const areaAbs = path.join(root, AREA_REL);
  const lockAbs = path.join(root, LOCK_REL);
  /** What this acquisition brought into existence or found, for release. */
  const held = { createdArea: false, lockDirectory: false, entry: null };
  const release = async () => {
    if (held.entry !== null) {
      const entry = path.join(lockAbs, held.entry);
      await deleteQuietly(() => fsp.unlink(entry));
    }
    if (held.lockDirectory) await deleteQuietly(() => fsp.rmdir(lockAbs));
    if (held.createdArea) await deleteQuietly(() => fsp.rmdir(areaAbs));
  };
  try {
    if (deviations.listBeforeEntry) {
      // VIOL-RACE-LISTFIRST (CERTIFICATIONS.md): the listing that judges the
      // lock directory comes before this run's entry is added.
      await acquireListingFirst(areaAbs, lockAbs, held);
      return { release };
    }
    for (let attempt = 1; ; attempt += 1) {
      if (attempt > ACQUISITION_ATTEMPTS) {
        throw new Error(
          `acquisition did not settle in ${String(ACQUISITION_ATTEMPTS)} attempts`,
        );
      }
      if (!(await establishEntry(areaAbs, lockAbs, held))) continue;
      let names;
      try {
        names = await listNames(Buffer.from(lockAbs));
      } catch (error) {
        if (error?.code !== "ENOENT") {
          throw acquisitionFailure(
            "read",
            LOCK_REL,
            `list the lock directory ${LOCK_REL}`,
            error,
          );
        }
        // Interference (13.5): the lock directory, this run's entry with
        // it, is gone since the entry was added — examine afresh.
        held.entry = null;
        held.lockDirectory = false;
        continue;
      }
      await judgeLockDirectory(Buffer.from(lockAbs), names, held.entry);
      return { release };
    }
  } catch (error) {
    await release();
    throw error;
  }
}

/**
 * One pass of acquisition's establishment (SPEC 13.5): the area's own path
 * examined — anything but a directory, a symbolic link included, obstructs
 * (write failure concerning `.xspec`); the lock path examined — a plain file
 * there is a leftover, removed, and anything but a directory or a plain file
 * obstructs (write failure concerning `.xspec/lock`); the area's directory
 * and the lock directory brought into existence where absent; then this
 * run's entry added. Returns false where a concurrent run's creation or
 * deletion moved a path under it, or a leftover plain file at the lock path
 * was removed, so that the caller examines afresh; records in `held` what
 * release must delete.
 */
async function establishEntry(areaAbs, lockAbs, held) {
  let area;
  try {
    area = await occupantKind(areaAbs);
  } catch (error) {
    throw acquisitionFailure("read", AREA_REL, `examine ${AREA_REL}`, error);
  }
  if (area === "absent") {
    try {
      await fsp.mkdir(areaAbs);
    } catch (error) {
      if (RACED_CREATION.has(error?.code)) return false;
      throw acquisitionFailure(
        "write",
        AREA_REL,
        `create the graph-data area ${AREA_REL}`,
        error,
      );
    }
    // Only the run that created the area's directory deletes it (13.5).
    held.createdArea = true;
  } else if (area !== "directory") {
    throw acquisitionObstructed(AREA_REL, area);
  }
  let lock;
  try {
    lock = await occupantKind(lockAbs);
  } catch (error) {
    throw acquisitionFailure("read", LOCK_REL, `examine ${LOCK_REL}`, error);
  }
  if (lock === "file") {
    // A plain file at the lock path is a leftover, which acquisition
    // removes (13.5) — its content unread.
    try {
      await fsp.unlink(lockAbs);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        let now = "file";
        try {
          now = await occupantKind(lockAbs);
        } catch {
          // The refusal below stands.
        }
        // Still the plain file: the refusal stands (14.24); anything else
        // there is a concurrent run's doing — examine afresh.
        if (now === "file") {
          throw acquisitionFailure(
            "write",
            LOCK_REL,
            `remove the leftover plain file at ${LOCK_REL}`,
            error,
          );
        }
      }
    }
    return false;
  }
  if (lock === "absent") {
    try {
      await fsp.mkdir(lockAbs);
    } catch (error) {
      if (RACED_CREATION.has(error?.code)) return false;
      throw acquisitionFailure(
        "write",
        LOCK_REL,
        `create the lock directory ${LOCK_REL}`,
        error,
      );
    }
  } else if (lock !== "directory") {
    throw acquisitionObstructed(LOCK_REL, lock);
  }
  held.lockDirectory = true;
  const name = newEntryName();
  try {
    const handle = await fsp.open(path.join(lockAbs, name), "wx");
    await handle.close();
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      // The lock directory vanished: a concurrent run's release deleted it
      // once emptied — examine afresh.
      held.lockDirectory = false;
      return false;
    }
    throw acquisitionFailure(
      "write",
      LOCK_REL,
      `add this run's entry to the lock directory ${LOCK_REL}`,
      error,
    );
  }
  held.entry = name;
  return true;
}

/**
 * Judge the lock directory's listing (SPEC 13.5): each name but this run's
 * own entry examined for its kind alone; a plain file whose name records an
 * identifier in this conformer's entry form — other than the acquiring
 * process's own — that the process list lists is a live run's entry (or one
 * in 13.5's gap), refusing acquisition with the busy error of 14.26 before
 * anything is removed or any other directory listed; failing one, every
 * leftover — everything else in the lock directory — is removed
 * (removeLeftover). No file's content is read.
 *
 * VIOL-CORE-NOLOCK (CERTIFICATIONS.md, `noMutualExclusion`): a live run's
 * entry does not refuse acquisition — every entry whose recorded identifier
 * the process list lists is left in place, unaltered, the other leftovers
 * removed, and acquisition proceeds, so mutating commands never exclude one
 * another; entries, the hold file, leftover removal, acquisition's write and
 * read failures, and release are unchanged.
 *
 * VIOL-CORE-STALELOCK (CERTIFICATIONS.md, `staleLockBlocks`): abnormal
 * termination does not end exclusivity — any entry, a plain file named in
 * this conformer's entry form, refuses acquisition by its presence alone,
 * whatever identifier its name records, so a killed run's entry refuses
 * every later mutating command while it stands; the removal of every
 * leftover that is no entry, and release, are unchanged.
 */
async function judgeLockDirectory(lockBytes, names, ownName) {
  await removeLeftovers(await judgeListing(lockBytes, names, ownName));
}

/**
 * The judgment half of judgeLockDirectory: each listed name but `ownName`
 * (`null` where this run has no entry yet: VIOL-RACE-LISTFIRST's listing)
 * examined for its kind and judged — a live run's entry refusing acquisition
 * with the busy error of 14.26 before anything is removed — and the
 * leftovers returned, unremoved, for removeLeftovers.
 */
async function judgeListing(lockBytes, names, ownName) {
  const own = ownName === null ? null : Buffer.from(ownName);
  const leftovers = [];
  let listed = null;
  for (const name of names) {
    if (own !== null && name.equals(own)) continue;
    const abs = childPath(lockBytes, name);
    let kind;
    try {
      kind = await occupantKind(abs);
    } catch (error) {
      throw acquisitionFailure(
        "read",
        LOCK_REL,
        `examine an occupant of the lock directory ${LOCK_REL}`,
        error,
      );
    }
    // Gone since the listing: a concurrent run's release or removal.
    if (kind === "absent") continue;
    const identifier = kind === "file" ? recordedIdentifier(name) : null;
    if (identifier !== null) {
      if (deviations.staleLockBlocks) throw workspaceBusy();
      if (identifier !== process.pid) {
        listed ??= await processListJudge();
        if (listed(identifier)) {
          if (deviations.noMutualExclusion) continue;
          throw workspaceBusy();
        }
      }
    }
    leftovers.push({ abs, kind });
  }
  return leftovers;
}

/** Remove the leftovers a judged listing found (removeLeftover, in order). */
async function removeLeftovers(leftovers) {
  for (const leftover of leftovers) {
    await removeLeftover(leftover.abs, leftover.kind);
  }
}

/**
 * VIOL-RACE-LISTFIRST's sustained interval between its listing and its
 * entry's addition: long against the spread of runs started together —
 * T13.5-13's held arm starts four at once, whose acquisition points this
 * conformer spreads over 14–38 ms unloaded and 75–140 ms with six busy
 * loops on four cores (measured for FIX_PLAN Task 32) — yet far short of
 * every hang guard the arm sets (60 s for a run to exit or hold).
 */
const LIST_FIRST_INTERVAL_MS = 3000;

/**
 * Acquisition under VIOL-RACE-LISTFIRST (CERTIFICATIONS.md,
 * `listBeforeEntry`): it judges the lock directory before adding its entry —
 * it lists the lock directory, a missing area or lock directory (or
 * anything but a directory at the lock path, examined without following a
 * link) holding nothing there, never a refused read; is refused by another
 * live run's entry there (14.26), as the conformer is (judgeListing); and
 * otherwise, after LIST_FIRST_INTERVAL_MS, establishes its entry as the
 * conformer does (establishEntry: the area's and the lock path's occupants
 * examined — an obstruction the conformer's write failure, a plain file at
 * the lock path a leftover removed — the area's directory and the lock
 * directory brought into existence where absent, examined afresh where a
 * concurrent run moved a path), removes the leftovers its listing found,
 * and acquires, never listing again. A single deviation: 13.5's order of
 * acquisition's addition and listing inverted; the liveness judgment,
 * leftover removal, the hold seam, and release are unchanged. Runs started
 * together each list within the others' intervals, before any has added
 * its entry, so none finds a live run's entry and each acquires.
 */
async function acquireListingFirst(areaAbs, lockAbs, held) {
  const lockBytes = Buffer.from(lockAbs);
  let kind;
  try {
    kind = await occupantKind(lockBytes);
  } catch (error) {
    // The area's own path holds no directory: nothing listed there, the
    // establishment below meeting the occupant as the conformer's does.
    if (error?.code !== "ENOTDIR") {
      throw acquisitionFailure("read", LOCK_REL, `examine ${LOCK_REL}`, error);
    }
    kind = "absent";
  }
  let names = [];
  if (kind === "directory") {
    try {
      names = await fsp.readdir(lockBytes, { encoding: "buffer" });
    } catch (error) {
      // Gone since it was examined: a concurrent run's release.
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") {
        throw acquisitionFailure(
          "read",
          LOCK_REL,
          `list the lock directory ${LOCK_REL}`,
          error,
        );
      }
    }
  }
  const leftovers = await judgeListing(lockBytes, names, null);
  await sleep(LIST_FIRST_INTERVAL_MS);
  for (let attempt = 1; ; attempt += 1) {
    if (attempt > ACQUISITION_ATTEMPTS) {
      throw new Error(
        `acquisition did not settle in ${String(ACQUISITION_ATTEMPTS)} attempts`,
      );
    }
    if (await establishEntry(areaAbs, lockAbs, held)) break;
  }
  await removeLeftovers(leftovers);
}

/**
 * Remove one leftover (SPEC 13.5): a directory with all it holds, at every
 * depth — listed, each occupant examined and removed, then the emptied
 * directory — and anything else by unlinking it: a symbolic link itself,
 * never its target; a FIFO unopened; a plain file unread, whatever its mode.
 * Names are the bytes the filesystem lists, whatever their first byte and
 * whether or not they are valid UTF-8 (listNames). A removal finding nothing
 * is done; a refused listing or examination is the read failure of 14.25, a
 * refused removal the write failure of 14.24, each concerning the lock path.
 *
 * VIOL-LEFTOVER-FOLLOWLINK (CERTIFICATIONS.md, `followLinksAtRemoval`): the
 * removal of a symbolic link to a directory — at the lock directory's top
 * level or at any depth below it — follows the link: everything the
 * targeted directory holds is removed through the link, recursing as into
 * a directory, at every depth (removeHeldContent), and then the link itself
 * is unlinked, the targeted directory left in place, empty. A link to a
 * file, a dangling link, and every other leftover are removed as the
 * conformer removes them; the deletion through the link (a write that
 * traverses a link, 13.4) is that single deviation itself.
 */
async function removeLeftover(abs, kind) {
  if (kind === "directory") {
    if (!(await removeHeldContent(abs))) return;
    try {
      await fsp.rmdir(abs);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw acquisitionFailure(
        "write",
        LOCK_REL,
        `remove a leftover directory in ${LOCK_REL}`,
        error,
      );
    }
    return;
  }
  if (
    deviations.followLinksAtRemoval &&
    kind === "symlink" &&
    (await linksToDirectory(abs))
  ) {
    await removeHeldContent(abs);
  }
  try {
    await fsp.unlink(abs);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw acquisitionFailure(
      "write",
      LOCK_REL,
      `remove a leftover in ${LOCK_REL}`,
      error,
    );
  }
}

/**
 * Remove everything the directory at `abs` holds — listed (listNames), each
 * occupant examined without following a link and removed (removeLeftover) —
 * leaving the directory itself. Returns false where the directory is gone
 * before its listing (`ENOENT`), a concurrent run's removal: nothing to do.
 */
async function removeHeldContent(abs) {
  let names;
  try {
    names = await listNames(abs);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw acquisitionFailure(
      "read",
      LOCK_REL,
      `list a leftover directory in ${LOCK_REL}`,
      error,
    );
  }
  for (const name of names) {
    const child = childPath(abs, name);
    let childKind;
    try {
      childKind = await occupantKind(child);
    } catch (error) {
      throw acquisitionFailure(
        "read",
        LOCK_REL,
        `examine an occupant of a leftover directory in ${LOCK_REL}`,
        error,
      );
    }
    if (childKind !== "absent") await removeLeftover(child, childKind);
  }
  return true;
}

/**
 * VIOL-LEFTOVER-FOLLOWLINK's test (removeLeftover): whether the symbolic
 * link at `abs` resolves to a directory, judged through the link (`stat`,
 * which follows it). A dangling link, a loop, or a refused examination is
 * no link to a directory: removed as the conformer removes it.
 */
async function linksToDirectory(abs) {
  try {
    return (await fsp.stat(abs)).isDirectory();
  } catch {
    return false;
  }
}

/** The first byte of a name a dot-hiding listing hides: `.`. */
const DOT_BYTE = 0x2e;

/**
 * List a directory acquisition judges or removes — the lock directory, or a
 * leftover directory in it (SPEC 13.5) — as the names the filesystem lists,
 * byte for byte: every name, whatever its first byte and whether or not it
 * is valid UTF-8, so that every leftover is removed. A refused listing
 * throws the system error.
 *
 * VIOL-LEFTOVER-DOTNAMES (CERTIFICATIONS.md, `hideDotNames`): the listing
 * hides names beginning with `.`, as glob-style enumeration does by default,
 * so a leftover so named is never removed. One in the lock directory itself
 * stays, with all below it, and the run acquires as the conformer's does,
 * its release then leaving the lock directory, whose deletion the
 * environment refuses while it holds that leftover (13.5: a refusal that
 * changes no outcome); one in a directory acquisition lists to remove
 * leaves that directory unemptied, its removal refused — the write failure
 * of 14.24 concerning the lock path (removeLeftover), the run attempting no
 * later removal and its release leaving the lock directory standing.
 *
 * VIOL-LEFTOVER-BYTENAMES (CERTIFICATIONS.md, `namesAsText`): the listing
 * decodes names as UTF-8 text, each ill-formed sequence decoded to U+FFFD,
 * and every later examination and removal addresses a leftover by its
 * decoded name (re-encoded, as a text path is) — so one whose name is not
 * valid UTF-8 is addressed by a name that designates nothing, the
 * examination finding nothing there taken for done, as the conformer takes
 * a leftover gone since the listing, and it stays, with the consequences
 * VIOL-LEFTOVER-DOTNAMES' hidden names have. Every other name is unchanged
 * by the round trip.
 */
async function listNames(dirBytes) {
  if (deviations.namesAsText) {
    const decoded = await fsp.readdir(dirBytes, { encoding: "utf8" });
    return decoded.map((name) => Buffer.from(name, "utf8"));
  }
  const names = await fsp.readdir(dirBytes, { encoding: "buffer" });
  if (deviations.hideDotNames) {
    return names.filter((name) => name[0] !== DOT_BYTE);
  }
  return names;
}

/**
 * `--test-hold` seam (SPEC 13.5): create an empty file at the path —
 * creation fails if anything, a symbolic link included, already exists —
 * then proceed only once that file has been deleted. Runs immediately after
 * acquiring exclusivity and before modifying anything.
 */
async function holdAtSeam(holdPath, cwd) {
  const abs = path.resolve(cwd, holdPath);
  if (deviations.holdThroughLink) {
    // VIOL-CORE-HOLDLINK (CERTIFICATIONS.md): hold-file creation follows a
    // symbolic link at the hold path — the path's occupancy is judged
    // through the link (`stat`, which follows it), so a dangling link reads
    // as nothing there, and the empty hold file is created at the link's
    // target (O_CREAT without O_EXCL, which follows the link: a write
    // through it), the run then proceeding only once the hold path, judged
    // through the link, holds nothing. A single deviation: a link to an
    // existing file or directory reads as occupied through the link, so its
    // creation falls to the conformer's below and fails there with the
    // seam's usage error as the conformer's does, and a path holding no
    // link is judged alike on both sides.
    let throughLink = true;
    try {
      await fsp.stat(abs);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      throughLink = false;
    }
    if (!throughLink) {
      const created = await fsp.open(
        abs,
        fsp.constants.O_WRONLY | fsp.constants.O_CREAT,
      );
      await created.close();
      for (;;) {
        try {
          await fsp.stat(abs);
        } catch (error) {
          if (error.code === "ENOENT") return;
          throw error;
        }
        await sleep(15);
      }
    }
  }
  const handle = await fsp.open(abs, "wx"); // O_CREAT|O_EXCL: symlinks fail too
  await handle.close();
  for (;;) {
    try {
      await fsp.lstat(abs);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    await sleep(15);
  }
}

// ---------------------------------------------------------------------------
// Review sessions (SPEC 10): storage, audit strategy, invalidation, payloads
// ---------------------------------------------------------------------------

const REVIEWS_REL = ".xspec/reviews";
const SESSION_NAME = /^[A-Za-z0-9._-]+$/;
const STORED_STATUSES = new Set([
  "unresolved",
  "updated",
  "no-change",
  "skipped",
]);
const RESOLVE_STATUSES = new Set(["updated", "no-change", "skipped"]);
const ITEM_KINDS = new Set([
  "subtree-coherence",
  "parent-consistency",
  "dependency-consistency",
  "metadata-consistency",
  "code-impact",
  "uncovered-requirement",
]);

function sessionNameValid(name) {
  return SESSION_NAME.test(name) && !name.startsWith(".");
}

function sessionRel(name) {
  return `${REVIEWS_REL}/${name}.json`;
}

/** List stored session names (files directly under .xspec/reviews). */
async function listSessionNames(root) {
  let entries;
  try {
    entries = await fsp.readdir(path.join(root, REVIEWS_REL), {
      withFileTypes: true,
    });
  } catch {
    return [];
  }
  const names = [];
  for (const entry of entries) {
    if (!entry.name.endsWith(".json")) continue;
    const name = entry.name.slice(0, -".json".length);
    if (!sessionNameValid(name)) continue; // any other file there is not a session
    names.push(name);
  }
  return names.sort();
}

/**
 * Load a session. Returns { state: "missing" } (unknown session, exit 2),
 * { state: "corrupt" } (SPEC 14.21, exit 1), or { state: "ok", session }.
 */
async function loadSession(root, name) {
  if (!sessionNameValid(name)) return { state: "invalid-name" };
  const abs = path.join(root, sessionRel(name));
  let stats;
  try {
    stats = await fsp.lstat(abs);
  } catch (error) {
    if (error.code === "ENOENT") return { state: "missing" };
    throw error;
  }
  if (!stats.isFile()) return { state: "corrupt" }; // not a plain file (13.4)
  let session;
  try {
    session = JSON.parse(await fsp.readFile(abs, "utf8"));
  } catch {
    return { state: "corrupt" };
  }
  if (!sessionInvariantsHold(session, name)) return { state: "corrupt" };
  return { state: "ok", session };
}

function sessionInvariantsHold(session, name) {
  if (session === null || typeof session !== "object" || Array.isArray(session))
    return false;
  if (session.name !== name) return false;
  if (typeof session.strategy !== "string" || session.strategy.length === 0)
    return false;
  if (!Number.isInteger(session.nextId) || session.nextId < 1) return false;
  if (!Array.isArray(session.items) || !Array.isArray(session.decompositions))
    return false;
  const ids = new Set();
  for (const item of session.items) {
    if (item === null || typeof item !== "object") return false;
    if (typeof item.id !== "string" || item.id.length === 0 || ids.has(item.id))
      return false;
    ids.add(item.id);
    if (!ITEM_KINDS.has(item.kind)) return false;
    if (
      !STORED_STATUSES.has(item.status) &&
      // VIOL-CORE-PERSISTREADS (CERTIFICATIONS.md): the deviating product
      // itself persists `invalidated` stored statuses, so its session model
      // admits them on load — reporting its own written state corrupt
      // (14.21) would be a second behavioral difference beyond the one
      // deviation. With the deviation off, the conformer's stored-status
      // set is unchanged.
      !(deviations.persistReadInvalidation && item.status === "invalidated")
    ) {
      return false;
    }
    if (typeof item.reason !== "string" || item.reason.length === 0)
      return false;
    if (typeof item.scopeRoot !== "string") return false;
    if (!Number.isInteger(item.journalAt) || item.journalAt < 0) return false;
    for (const key of [
      "scopeNodes",
      "contextNodes",
      "originNodes",
      "blockedBy",
    ]) {
      if (
        !Array.isArray(item[key]) ||
        item[key].some((v) => typeof v !== "string")
      )
        return false;
    }
    if (!recordedStateWellFormed(item.baseline)) return false;
    if (!recordedStateWellFormed(item.current)) return false;
    if (!provenanceWellFormed(item.provenance)) return false;
  }
  // The recorded decompositions well-formed (SPEC 10.1, 10.7): each the
  // original's kind and scope node, its spelling's journal position beside
  // it (reviewSplit).
  for (const entry of session.decompositions) {
    if (
      entry === null ||
      typeof entry !== "object" ||
      entry.kind !== "subtree-coherence" ||
      typeof entry.scope !== "string" ||
      !Number.isInteger(entry.journalAt) ||
      entry.journalAt < 0
    ) {
      return false;
    }
  }
  for (const item of session.items) {
    if (item.blockedBy.some((id) => !ids.has(id))) return false;
  }
  // blockedBy acyclic (SPEC 10.1): no item transitively blocks itself.
  const byId = new Map(session.items.map((item) => [item.id, item]));
  const marks = new Map();
  const cyclic = (id) => {
    const mark = marks.get(id);
    if (mark === "done") return false;
    if (mark === "visiting") return true;
    marks.set(id, "visiting");
    for (const dep of byId.get(id).blockedBy) {
      if (cyclic(dep)) return true;
    }
    marks.set(id, "done");
    return false;
  };
  for (const item of session.items) {
    if (cyclic(item.id)) return false;
  }
  // At most one item per kind and scope node (SPEC 10.1).
  const kindScope = new Set();
  for (const item of session.items) {
    const key = `${item.kind} ${item.scopeRoot} ${String(item.journalAt)}`;
    if (kindScope.has(key)) return false;
    kindScope.add(key);
  }
  return true;
}

/**
 * A recorded state's form (recordState): its nodes, its recorded context
 * set, and their journal position.
 */
function recordedStateWellFormed(state) {
  return (
    state !== null &&
    typeof state === "object" &&
    Number.isInteger(state.journalAt) &&
    state.journalAt >= 0 &&
    state.nodes !== null &&
    typeof state.nodes === "object" &&
    !Array.isArray(state.nodes) &&
    Array.isArray(state.context) &&
    state.context.every((spelling) => typeof spelling === "string")
  );
}

/**
 * An item's text archive's form (archiveTexts): a text per node, keyed by
 * spellings at the archive's own journal position.
 */
function provenanceWellFormed(provenance) {
  return (
    provenance !== null &&
    typeof provenance === "object" &&
    Number.isInteger(provenance.journalAt) &&
    provenance.journalAt >= 0 &&
    provenance.texts !== null &&
    typeof provenance.texts === "object" &&
    !Array.isArray(provenance.texts) &&
    Object.values(provenance.texts).every((text) => typeof text === "string")
  );
}

async function writeSession(root, session) {
  await writeFileAtomic(
    path.join(root, sessionRel(session.name)),
    canonicalJson(session) + "\n",
  );
}

/** Relevant hashes per item kind (SPEC 10.4), by node role. */
function relevantHashes(kind, role, node) {
  if (kind === "subtree-coherence") {
    return role === "scope"
      ? { metadataHash: node.metadataHash, subtreeHash: node.subtreeHash }
      : {};
  }
  if (kind === "parent-consistency") {
    if (role === "scope")
      return { metadataHash: node.metadataHash, ownHash: node.ownHash };
    if (role === "context") return { subtreeHash: node.subtreeHash };
  }
  return {};
}

/**
 * Record the relevant state of an item against the current graph (SPEC
 * 10.4): relevant hashes per kind and presence for every scope, context, and
 * origin node, an absent node's hashes the absent marker; the texts 10.7's
 * provenance rule presents are archived apart (archiveTexts). Keys are the
 * item's spellings as they stand, and the state carries their journal
 * position (`journalAt`, the item's at recording): lookups map them forward
 * through the journal suffix appended since then, so a state keeps its
 * meaning when the item later takes newer spellings (adoptGenerated,
 * assignCurrentContext).
 */
function recordState(item, graph, journalEntries) {
  const suffix = journalEntries.slice(item.journalAt);
  /** @type {Record<string, unknown>} */
  const nodes = {};
  const record = (spelling, role) => {
    const mapped = mapIdentityForward(spelling, suffix);
    const node = graph.byIdentity.get(mapped);
    if (node === undefined) {
      nodes[spelling] = { hashes: "absent", present: false };
      return;
    }
    nodes[spelling] = {
      hashes: relevantHashes(item.kind, role, node),
      present: true,
    };
  };
  for (const spelling of item.scopeNodes) record(spelling, "scope");
  for (const spelling of item.contextNodes) record(spelling, "context");
  for (const spelling of item.originNodes) record(spelling, "origin");
  // The context nodes so recorded form the item's recorded context set
  // (SPEC 10.4), kept apart from its `context` as later assigned.
  return { context: [...item.contextNodes], journalAt: item.journalAt, nodes };
}

/**
 * Read-time invalidation (SPEC 10.4): a resolved item is stale when its
 * recorded state differs from the current graph — a recorded hash changed,
 * a node's presence changed in either direction, or its current context set
 * differs from its recorded context set. Computed on read, never persisted.
 * The recorded spellings map forward from the state's own journal position
 * (recordState), and each recorded hash — those of its node's role
 * (relevantHashes) — is compared with the node's current value of the hash
 * it names.
 */
function isStale(item, graph, journalEntries) {
  const recordedSuffix = journalEntries.slice(item.current.journalAt);
  for (const [spelling, state] of Object.entries(item.current.nodes)) {
    const mapped = mapIdentityForward(spelling, recordedSuffix);
    const node = graph.byIdentity.get(mapped);
    const present = node !== undefined;
    if (present !== state.present) return true; // presence changed either way
    if (!present) continue; // absent then and now: no invalidation (10.4)
    for (const [hashName, value] of Object.entries(
      state.hashes === "absent" ? {} : state.hashes,
    )) {
      if (node[hashName] !== value) return true;
    }
  }
  // Context-set comparison (SPEC 10.4): the item's current context set
  // (currentContextSet) against its recorded context set, the context nodes
  // its `current` state records.
  const currentSet = new Set(currentContextSet(item, graph, journalEntries));
  const recordedSet = new Set(
    item.current.context.map((spelling) =>
      mapIdentityForward(spelling, recordedSuffix),
    ),
  );
  return (
    currentSet.size !== recordedSet.size ||
    [...currentSet].some((identity) => !recordedSet.has(identity))
  );
}

/**
 * The context set the audit generator (with recorded decompositions)
 * assigns to this item against the current workspace, or null when the
 * generators no longer produce it (its `context` as last assigned then being
 * its current context set, SPEC 10.4).
 */
function generatorContext(item, graph, journalSuffix) {
  const mappedScope = mapIdentityForward(item.scopeRoot, journalSuffix);
  const node = graph.byIdentity.get(mappedScope);
  if (node === undefined) return null;
  if (item.kind === "subtree-coherence") {
    return ancestorChain(node).map((ancestor) => ancestor.identity);
  }
  if (item.kind === "parent-consistency") {
    return node.children.map((child) => child.identity);
  }
  return null;
}

/**
 * An item's current context set (SPEC 10.4), as current identities: the
 * context the generator assigns it against the current workspace
 * (generatorContext), or, for an item the generators no longer produce, its
 * `context` as last assigned — by `create`, a re-derivation, a `split`, or a
 * resolve — mapped forward through the journal. Reads present it as the
 * item's `context` (itemPayload), invalidation compares it with the recorded
 * context set (isStale), and a resolve assigns it (assignCurrentContext).
 */
function currentContextSet(item, graph, journalEntries) {
  const suffix = journalEntries.slice(item.journalAt);
  return (
    generatorContext(item, graph, suffix) ??
    item.contextNodes.map((spelling) => mapIdentityForward(spelling, suffix))
  );
}

/**
 * Assign an item its current context set as `context` (SPEC 10.4: resolving
 * an item does so, then records — an `updated` resolve once its
 * re-derivation is done, against the item as re-derived): the item's
 * spellings move to the current journal position, its scope, origin, and
 * `reason` kept as last assigned and its `context` the current identities
 * currentContextSet names; its `baseline`, `current`, and text archive keep
 * theirs, each carrying its own position (recordState, archiveTexts).
 */
function assignCurrentContext(item, graph, journal) {
  const suffix = journal.entries.slice(item.journalAt);
  const context = currentContextSet(item, graph, journal.entries);
  const forward = (spelling) => mapIdentityForward(spelling, suffix);
  item.journalAt = journal.lineCount;
  item.scopeRoot = forward(item.scopeRoot);
  item.scopeNodes = item.scopeNodes.map(forward);
  item.originNodes = item.originNodes.map(forward);
  item.contextNodes = context;
}

/** Proper ancestors, nearest first, ending at the file root (SPEC 10.6). */
function ancestorChain(node) {
  const chain = [];
  for (let n = node.parent ?? null; n !== null; n = n.parent ?? null) {
    chain.push(n);
  }
  return chain;
}

/**
 * VIOL-CORE-PERSISTREADS (CERTIFICATIONS.md): the collector for the items
 * whose read-time invalidation the current review read computes — non-null
 * exactly while a deviating `status`/`next`/`show`/`export` body runs (see
 * withReadInvalidationPersistence), null everywhere else, so conformer
 * paths and mutating commands never collect anything.
 */
let staleComputedDuringRead = null;

/**
 * VIOL-CORE-PERSISTREADS (CERTIFICATIONS.md): run one review read body
 * (report emission included), collecting every resolved item whose recorded
 * state the read computes as differing from the current graph (SPEC 10.4),
 * then rewrite exactly those items' stored statuses to `invalidated` in the
 * session file. The report is computed and emitted before anything is
 * rewritten, so streams and exit code stay byte-identical to the
 * conformer's — only the session file's bytes deviate. A read that computes
 * no invalidation writes nothing (a session with no stale resolution stays
 * byte-identical). With the deviation off, the body runs untouched.
 */
async function withReadInvalidationPersistence(root, session, body) {
  if (!deviations.persistReadInvalidation) return await body();
  const stale = new Set();
  staleComputedDuringRead = stale;
  let code;
  try {
    code = await body();
  } finally {
    staleComputedDuringRead = null;
  }
  if (stale.size > 0) {
    for (const item of stale) item.status = "invalidated";
    await writeSession(root, session);
  }
  return code;
}

/** Effective status on read: stored status with invalidation applied. */
function effectiveStatus(item, graph, journalEntries) {
  if (
    RESOLVE_STATUSES.has(item.status) &&
    isStale(item, graph, journalEntries)
  ) {
    // VIOL-CORE-PERSISTREADS (CERTIFICATIONS.md): this is the one place the
    // fixture computes that a resolved item's recorded state differs from
    // the current graph (isStale has no other caller), so a deviating read
    // collects exactly the items whose invalidation it computed.
    staleComputedDuringRead?.add(item);
    return "invalidated";
  }
  return item.status;
}

/** Whether the item is blocked (SPEC 10.3): any blocker not resolved. */
function isBlocked(item, session, graph, journalEntries) {
  const byId = new Map(
    session.items.map((candidate) => [candidate.id, candidate]),
  );
  return item.blockedBy.some((id) => {
    const blocker = byId.get(id);
    return (
      blocker === undefined ||
      !RESOLVE_STATUSES.has(effectiveStatus(blocker, graph, journalEntries))
    );
  });
}

/**
 * Item order for reads (SPEC 10.6 audit order with 10.5's absent-node rule):
 * scope-node file path (byte order), then document order within the file;
 * present scope nodes first, absent ones after, by identity then item id.
 */
function orderedItems(session, graph, journalEntries) {
  const keyed = session.items.map((item) => {
    const mapped = mapIdentityForward(
      item.scopeRoot,
      journalEntries.slice(item.journalAt),
    );
    const node = graph.byIdentity.get(mapped);
    const file = mapped.includes("#")
      ? mapped.slice(0, mapped.indexOf("#"))
      : mapped;
    return {
      item,
      mappedScope: mapped,
      key: [
        file,
        node === undefined ? 1 : 0,
        node === undefined
          ? mapped
          : String(graph.docIndex(node)).padStart(9, "0"),
        item.kind === "subtree-coherence" ? 0 : 1,
        item.id,
      ],
    };
  });
  keyed.sort((a, b) => {
    for (let i = 0; i < a.key.length; i += 1) {
      const av = a.key[i];
      const bv = b.key[i];
      if (av < bv) return -1;
      if (av > bv) return 1;
    }
    return 0;
  });
  return keyed;
}

/**
 * A node's text value as an item of `kind` presents it in `role` (SPEC
 * 10.7): scope text is the scope root's subtree text for subtree-coherence
 * and the scope node's own text for parent-consistency; context text is own
 * text for an ancestor chain (subtree-coherence) and subtree text otherwise
 * (a parent-consistency item's children).
 */
function presentedText(kind, role, node) {
  if (kind === "subtree-coherence") {
    return role === "scope" ? node.subtreeText : node.ownText;
  }
  return role === "scope" ? node.ownText : node.subtreeText;
}

/**
 * Archive, in the item's `provenance`, the text each of its present scope and
 * context nodes holds under the current graph (SPEC 10.7's provenance rule),
 * wherever a mutating subcommand derives or resolves the item: as it enters
 * the session (its baseline state, rederive), at each derivation producing
 * it (rederive: `create`, an `updated` resolve's re-derivation, and the one
 * `split` ends with), and at each resolve (reviewResolve). A node absent now
 * keeps the text archived when last present, so an absent node presents its
 * value in the most recent of those graph states that contained it, and a
 * node contained in none has no text (archivedTextOf). The archive's keys are
 * spellings at its own journal position, all moved to the current one here.
 */
function archiveTexts(item, graph, journal) {
  /** @type {Record<string, string>} */
  const texts = {};
  if (item.provenance !== undefined) {
    const archived = journal.entries.slice(item.provenance.journalAt);
    for (const [spelling, text] of Object.entries(item.provenance.texts)) {
      texts[mapIdentityForward(spelling, archived)] = text;
    }
  }
  const suffix = journal.entries.slice(item.journalAt);
  const archive = (spelling, role) => {
    const identity = mapIdentityForward(spelling, suffix);
    const node = graph.byIdentity.get(identity);
    if (node !== undefined)
      texts[identity] = presentedText(item.kind, role, node);
  };
  for (const spelling of item.scopeNodes) archive(spelling, "scope");
  for (const spelling of item.contextNodes) archive(spelling, "context");
  item.provenance = { journalAt: journal.lineCount, texts };
}

/**
 * The text the item's archive (archiveTexts) holds for the node whose current
 * identity is `identity` — SPEC 10.7's provenance rule for an absent node —
 * its spellings mapped forward from the archive's own journal position, or
 * undefined where no graph state the item was derived or resolved under
 * contained that node among the item's nodes.
 */
function archivedTextOf(item, identity, journalEntries) {
  const suffix = journalEntries.slice(item.provenance.journalAt);
  for (const [spelling, text] of Object.entries(item.provenance.texts)) {
    if (mapIdentityForward(spelling, suffix) === identity) return text;
  }
  return undefined;
}

/**
 * Present an item's node in a payload (SPEC 10.7): NodeState shape, the node
 * named by its current identity (10.4) — a present node with its source range
 * and its text read from the current graph, an absent one with its archived
 * text (archivedTextOf), none where the archive holds none.
 */
function nodeState(item, identity, role, graph, journalEntries) {
  const node = graph.byIdentity.get(identity);
  if (node === undefined) {
    const archivedText = archivedTextOf(item, identity, journalEntries);
    const state = { node: identity, present: false };
    if (typeof archivedText === "string") state.text = archivedText;
    return state;
  }
  return {
    node: identity,
    present: true,
    sourceRange: { end: node.sourceRange.end, start: node.sourceRange.start },
    text: presentedText(item.kind, role, node),
  };
}

/**
 * A recorded state (recordState) as reads present it (SPEC 10.2: as
 * recorded, its nodes presented per 10.4): every recorded node, and the
 * recorded context set, under its current identity — each spelling mapped
 * forward from the state's own journal position.
 */
function presentedState(state, journalEntries) {
  const suffix = journalEntries.slice(state.journalAt);
  /** @type {Record<string, unknown>} */
  const nodes = {};
  for (const [spelling, entry] of Object.entries(state.nodes)) {
    nodes[mapIdentityForward(spelling, suffix)] = entry;
  }
  return {
    context: state.context.map((spelling) =>
      mapIdentityForward(spelling, suffix),
    ),
    nodes,
  };
}

/**
 * The full item payload of `next --json`, `show`, and `export` (SPEC 10.7):
 * its `context` the item's current context set (10.4: computed, never
 * persisted, so context-set invalidation waits for no re-derivation), its
 * scope, origin, `reason`, and `blockedBy` as last assigned, every node
 * under its current identity.
 */
function itemPayload(item, session, graph, journalEntries) {
  const scope = mapIdentityForward(
    item.scopeRoot,
    journalEntries.slice(item.journalAt),
  );
  const payload = {
    baseline: presentedState(item.baseline, journalEntries),
    blocked: isBlocked(item, session, graph, journalEntries),
    blockedBy: [...item.blockedBy],
    context: currentContextSet(item, graph, journalEntries).map((identity) =>
      nodeState(item, identity, "context", graph, journalEntries),
    ),
    current: presentedState(item.current, journalEntries),
    id: item.id,
    kind: item.kind,
    origin: [],
    reason: item.reason,
    scope: nodeState(item, scope, "scope", graph, journalEntries),
    status: effectiveStatus(item, graph, journalEntries),
  };
  if (typeof item.note === "string") payload.note = item.note;
  return payload;
}

/** An item's key: its kind and scope node (SPEC 10.1, 10.5). */
function itemKey(kind, identity) {
  return `${kind} ${identity}`;
}

/**
 * The current identities of the scope nodes whose `subtree-coherence` item
 * the session records as decomposed (SPEC 10.7), each recorded scope mapped
 * forward through the journal appended since its recording: decomposition
 * matching compares canonical identities, never spellings (10.4).
 */
function decomposedIdentities(session, journal) {
  return new Set(
    session.decompositions.map((entry) =>
      mapIdentityForward(entry.scope, journal.entries.slice(entry.journalAt)),
    ),
  );
}

/**
 * The items standing for a node's `subtree-coherence` item (SPEC 10.5,
 * 10.7), as keys (itemKey), given the decomposed scope nodes' identities
 * (decomposedIdentities): the item itself, or, where it is recorded as
 * decomposed, all items of its decomposition — one `subtree-coherence` item
 * per child subtree the node has now, each itself replaced by its
 * decomposition where one is recorded, recursively, then the node's
 * `parent-consistency` item.
 */
function standInOf(decomposed) {
  const standIn = (node) =>
    decomposed.has(node.identity)
      ? [
          ...node.children.flatMap(standIn),
          itemKey("parent-consistency", node.identity),
        ]
      : [itemKey("subtree-coherence", node.identity)];
  return standIn;
}

/**
 * The audit derivation (SPEC 10.6) over the current graph with the session's
 * recorded decompositions applied (10.5, 10.7; `decomposed`, from
 * decomposedIdentities): for each node, files in discovery order and nodes
 * in document order, its `subtree-coherence` item — scope: the node and all
 * its current descendants; context: its ancestor chain; origin empty — or,
 * where that item is recorded as decomposed, the node's `parent-consistency`
 * item in its place — scope: the node, reviewed against its own text;
 * context: its children — audit generating every node's item, so this walk
 * over every node yields each item of every decomposition (standInOf) once.
 * Each item is blocked by its child sections' items (10.6) — a
 * `parent-consistency` item by those child items (10.7) — a decomposed
 * child's item replaced by all items of its decomposition, recursively
 * (10.5, 10.7). Blocking thus points from each item to items scoped strictly
 * below its scope node, so it stays acyclic (10.1). Returns the generated
 * items keyed by kind and current scope identity (itemKey), each with its
 * `blockers` as keys.
 */
function auditDerivation(graph, decomposed) {
  const standIn = standInOf(decomposed);
  const generated = new Map();
  for (const model of graph.files) {
    for (const node of model.nodes) {
      const blockers = node.children.flatMap(standIn);
      if (decomposed.has(node.identity)) {
        generated.set(itemKey("parent-consistency", node.identity), {
          blockers,
          contextNodes: node.children.map((child) => child.identity),
          kind: "parent-consistency",
          reason: `split: review the own text of ${node.identity} against its child subtrees (SPEC 10.7)`,
          scopeNodes: [node.identity],
          scopeRoot: node.identity,
        });
      } else {
        generated.set(itemKey("subtree-coherence", node.identity), {
          blockers,
          contextNodes: ancestorChain(node).map(
            (ancestor) => ancestor.identity,
          ),
          kind: "subtree-coherence",
          reason: `audit: review the subtree rooted at ${node.identity} (SPEC 10.6)`,
          scopeNodes: [node.identity, ...descendantIdentities(node)],
          scopeRoot: node.identity,
        });
      }
    }
  }
  return generated;
}

function descendantIdentities(node) {
  const identities = [];
  for (const child of node.children) {
    identities.push(child.identity, ...descendantIdentities(child));
  }
  return identities;
}

// ---------------------------------------------------------------------------
// Output helpers (SPEC 12.0 streams)
// ---------------------------------------------------------------------------

/** Byte order of two identity strings (SPEC 12.0: strings compare bytewise). */
function compareIdentityBytes(a, b) {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function emitDoc(io, json, doc, humanLines) {
  if (json) {
    io.stdout(canonicalJson(doc) + "\n");
  } else {
    io.stdout(humanLines.map((line) => `${line}\n`).join(""));
  }
}

/** JSON-only commands (SPEC 11 `query`, 10.7 `export`). */
function emitJsonOnly(io, doc) {
  io.stdout(canonicalJson(doc) + "\n");
}

// SPEC 14's stable code tokens by condition ordinal ("14.N" → token). The
// JSON report carries the token string alone (SPEC 12.7, 14); the ordinal
// orders findings and is no part of the value. Only the conditions this
// conformer's scope reports appear: its findings' conditions — the journal
// error among them, which a given baseline's resolution reports in the
// exit-2 error document of 12.7 instead (SPEC 6.3; resolveBaseline) — and
// acquisition's write failure, read failure, and busy refusal (14.24–14.26,
// SPEC 13.5), which arrive in that document alone, never as findings
// (acquireExclusivity).
const CODE_TOKENS = {
  14.1: "missing-id",
  14.2: "invalid-structural-id",
  14.3: "duplicate-id",
  14.4: "invalid-segment-or-tag",
  "14.10": "stale-output",
  14.13: "journal-error",
  14.19: "invalid-source-path",
  "14.20": "unparseable-source",
  14.21: "corrupt-session",
  14.24: "write-failure",
  14.25: "read-failure",
  14.26: "workspace-busy",
};

/** A condition's ordinal (the `N` of `14.N`), ordering findings (SPEC 12.7). */
function conditionOrdinal(condition) {
  return Number(condition.slice(3));
}

/**
 * The pinned findings order (SPEC 12.7): by code (numbered conditions in
 * numeric order), then locations element-wise (file path bytes, range start,
 * range end; a proper prefix first), then concerned path (null before any
 * path, byte-wise otherwise), then identities, then message — this scope's
 * identities are always empty, so the remaining dimensions decide.
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
  if ((a.path === null) !== (b.path === null)) return a.path === null ? -1 : 1;
  if (a.path !== null && b.path !== null) {
    const byPath = Buffer.compare(
      Buffer.from(a.path, "utf8"),
      Buffer.from(b.path, "utf8"),
    );
    if (byPath !== 0) return byPath;
  }
  return Buffer.compare(
    Buffer.from(a.message, "utf8"),
    Buffer.from(b.message, "utf8"),
  );
}

/**
 * The findings report in the 12.7 form: one `{"code", "message",
 * "locations", "path", "identities"}` per finding. A finding carrying an
 * in-source location (the located conditions of this scope) locates the
 * offending construct with `path` null; a path-level finding (14.10, 14.13,
 * 14.19, 14.21) carries the file or path it concerns with `locations` empty.
 * Findings are emitted in the pinned order, identical findings collapsed to
 * one (SPEC 12.7).
 */
function findingsDoc(findings) {
  const docs = findings.map((finding) => ({
    code: CODE_TOKENS[finding.condition],
    message: finding.message,
    locations:
      finding.location === undefined
        ? []
        : [
            {
              file: finding.file,
              range: {
                start: finding.location.start,
                end: finding.location.end,
              },
            },
          ],
    path: finding.location === undefined ? (finding.file ?? null) : null,
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
            `${finding.file ?? "workspace"}: ${finding.condition}: ${finding.message}\n`,
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

/** Every command of the product (SPEC 12). */
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
 * The synopses of this fixture's surface (§CONF-CORE; SPEC 12.1–12.4, 8.2,
 * 9, 6.4, 6.5) — each naming the flags it accepts beside the globals
 * `--json` and `--config` (12.0), the flags it requires, its least and most
 * operand counts, whether it is a mutating command (13.5: `rename`, `move`,
 * and the mutating `review` subcommands, which alone accept `--test-hold`,
 * excluded under `--preview`, 6.6), and the named flags this fixture does
 * not serve. Every syntax-class check of 12.0 precedes every scope refusal:
 * an unserved flag, a `move` preview or section form, and a product command
 * outside the surface are refused loudly (FixtureScopeError, exit 70) only
 * once the arguments match the synopsis and the value spellings the
 * arguments alone decide have passed — a usage error is never masked by a
 * scope refusal.
 * @typedef {{ flags: readonly string[], required?: readonly string[],
 *             operands: readonly [number, number], mutating?: boolean,
 *             unservedFlags?: readonly string[] }} Synopsis
 * @type {Map<string, Synopsis>}
 */
const SYNOPSES = new Map([
  ["build", { flags: [], operands: [0, 0] }],
  ["check", { flags: [], operands: [0, 0] }],
  [
    "ids",
    {
      flags: ["--tree", "--file", "--unreferenced"],
      operands: [0, 0],
      unservedFlags: ["--tree", "--file", "--unreferenced"],
    },
  ],
  ["show", { flags: [], operands: [1, 1] }],
  ["coverage", { flags: ["--check"], operands: [0, 1] }],
  ["impact", { flags: ["--base"], required: ["--base"], operands: [0, 0] }],
  ["rename", { flags: ["--preview"], operands: [3, 3], mutating: true }],
  ["move", { flags: ["--preview"], operands: [2, 2], mutating: true }],
]);

/**
 * `query`'s subcommands (SPEC 11.1): `query edges` is served in its
 * unfiltered form alone, `query nodes` likewise.
 * @type {Map<string, Synopsis>}
 */
const QUERY_SYNOPSES = new Map([
  ["node", { flags: [], operands: [1, 1] }],
  [
    "nodes",
    {
      flags: ["--group", "--file", "--tag", "--coverage"],
      operands: [0, 0],
      unservedFlags: ["--group", "--file", "--tag", "--coverage"],
    },
  ],
  [
    "edges",
    {
      flags: ["--from", "--to", "--kinds"],
      operands: [0, 0],
      unservedFlags: ["--from", "--to", "--kinds"],
    },
  ],
  ["subtree", { flags: [], operands: [1, 1] }],
  ["ancestors", { flags: [], operands: [1, 1] }],
  [
    "reachable",
    {
      flags: ["--from", "--to", "--kinds"],
      required: ["--from", "--to"],
      operands: [0, 0],
    },
  ],
]);

/**
 * `review`'s subcommands (SPEC 10.7): `create`, `resolve`, and `split`
 * mutating (13.5), the others reads.
 * @type {Map<string, Synopsis>}
 */
const REVIEW_SYNOPSES = new Map([
  [
    "create",
    {
      flags: ["--base", "--strategy", "--coverage", "--name"],
      required: ["--name"],
      operands: [0, 0],
      mutating: true,
    },
  ],
  ["list", { flags: [], operands: [0, 0] }],
  ["status", { flags: [], operands: [1, 1] }],
  ["next", { flags: [], operands: [1, 1] }],
  ["show", { flags: [], operands: [2, 2] }],
  ["split", { flags: [], operands: [2, 2], mutating: true }],
  [
    "resolve",
    {
      flags: ["--status", "--note"],
      required: ["--status"],
      operands: [2, 2],
      mutating: true,
    },
  ],
  ["export", { flags: [], operands: [1, 1] }],
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
 * remaining non-flag tokens in order — the command, the subcommand of
 * `query` or `review`, then the operands — whether a `--json` token was read
 * as a flag (never as another flag's value), and the first syntax-class
 * error met that the arguments decide for every command alike, if any.
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
 * The synopsis checks of SPEC 12.0's syntax class for one command or
 * subcommand (`spelled`): every flag given is one it accepts — its
 * synopsis's, the global `--json` and `--config`, or, for a mutating
 * command, `--test-hold` (13.5), which `--preview` excludes (6.6) — the
 * operands match its synopsis in number, and its required flags are given.
 */
function checkSynopsis(spelled, synopsis, flags, operands) {
  for (const name of flags.keys()) {
    if (name === "--json" || name === "--config") continue;
    if (synopsis.flags.includes(name)) continue;
    if (name === "--test-hold" && synopsis.mutating === true) continue;
    throw new UsageError(
      name === "--test-hold"
        ? `unknown flag --test-hold for ${spelled}: the seam belongs to the mutating commands alone (SPEC 13.5, 12.0)`
        : `unknown flag ${name} for ${spelled} (SPEC 12.0)`,
    );
  }
  if (flags.has("--test-hold") && flags.has("--preview")) {
    throw new UsageError(
      "--test-hold is excluded under --preview: a preview acquires no exclusivity and takes no seam (SPEC 6.6, 12.0)",
    );
  }
  const [least, most] = synopsis.operands;
  if (operands.length < least) {
    throw new UsageError(`${spelled}: missing operand (SPEC 12.0)`);
  }
  if (operands.length > most) {
    throw new UsageError(
      `surplus operand ${operands[most]}: ${spelled} takes at most ${String(most)} operand(s) (SPEC 12.0)`,
    );
  }
  for (const name of synopsis.required ?? []) {
    if (!flags.has(name)) {
      throw new UsageError(
        `${spelled}: missing required flag ${name} (SPEC 12.0)`,
      );
    }
  }
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
 * The code points SPEC 1.4 bars from every segment and tag beside its
 * whitespace and control classes: `"`, `#`, `&`, `'`, `\`, U+2028, U+2029,
 * and U+FFFD — spelled as code points, never as escapes.
 */
const BARRED_TAG_CODE_POINTS = new Set([
  0x22, 0x23, 0x26, 0x27, 0x5c, 0x2028, 0x2029, 0xfffd,
]);

function codePointName(codePoint) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * `query nodes --tag`'s acceptance (SPEC 11.1): syntactic, whatever the
 * workspace contains — a spelling no tag can have under 1.4 (a tag follows
 * the rules of an ID segment, except that it MAY contain `.`) is a
 * malformed value, a usage error of the syntax class (12.0): empty, a
 * forbidden name, or containing a whitespace or control character (1.4's
 * classes exactly: U+0009–U+000D and U+0020; U+0000–U+001F and U+007F) or a
 * barred code point.
 */
function checkTagValue(value) {
  let violation = null;
  if (value.length === 0) {
    violation = "it is empty";
  } else if (FORBIDDEN_NAMES.has(value)) {
    violation = `it is the forbidden name ${JSON.stringify(value)}`;
  } else {
    for (const character of value) {
      const codePoint = character.codePointAt(0);
      if (codePoint <= 0x20 || codePoint === 0x7f) {
        violation = `it contains the whitespace or control character ${codePointName(codePoint)}`;
        break;
      }
      if (BARRED_TAG_CODE_POINTS.has(codePoint)) {
        violation = `it contains the barred character ${codePointName(codePoint)}`;
        break;
      }
    }
  }
  if (violation !== null) {
    throw new UsageError(
      `query nodes: malformed --tag value ${JSON.stringify(value)}: ${violation}, so no tag is so spelled (SPEC 1.4, 11.1, 12.0)`,
    );
  }
}

/** `query nodes --coverage`'s vocabulary (SPEC 11.1). */
const COVERAGE_VALUES = new Set(["required", "none"]);

/**
 * A `--file` pattern's outside-root rule (SPEC 7, 11.1, 12.3), decided by
 * its spelling alone — an invalid flag value of 12.0's syntax class:
 * reading its `/`-separated segments from a depth of zero, a `..` segment
 * lowers the depth, a `.`, empty, or `**` segment leaves it, and every other
 * segment raises it; a leading `/` or a depth falling below zero lies
 * outside the root.
 */
function checkFileGlob(spelled, value) {
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
      `${spelled}: invalid --file value ${JSON.stringify(value)}: the pattern lies outside the workspace root (SPEC 7, 11.1, 12.0)`,
    );
  }
}

/**
 * A `<node>` or `<graph-node>` spelling's syntax (SPEC 1.5, 12.0) — and
 * `move`'s operands, split alike (6.5): at most one `#` is well-formed, no
 * identity containing one in path, id, or unit, so a spelling with more is
 * a malformed value, judged from the argument alone.
 */
function checkIdentitySpelling(spelled, value) {
  if (value.split("#").length > 2) {
    throw new UsageError(
      `${spelled}: malformed identity ${JSON.stringify(value)}: more than one "#" (SPEC 1.5, 12.0)`,
    );
  }
}

/** The four edge kinds (SPEC 5): `query edges --kinds`' vocabulary (11.1). */
const EDGE_KINDS = new Set(["contains", "depends", "embeds", "references"]);

/**
 * The three dependency edge kinds: `query reachable --kinds`' vocabulary,
 * `contains` an invalid flag value there (SPEC 11.1).
 */
const DEPENDENCY_KINDS = new Set(["depends", "embeds", "references"]);

/**
 * A `--kinds` list (SPEC 11.1, 12.0): comma-separated elements drawn from
 * the command's vocabulary; an empty element — a leading, trailing, or
 * doubled comma — or one outside the vocabulary is an invalid flag value of
 * the syntax class.
 */
function checkKinds(spelled, value, vocabulary) {
  for (const element of value.split(",")) {
    if (!vocabulary.has(element)) {
      throw new UsageError(
        `${spelled}: invalid --kinds value ${JSON.stringify(value)}: ${element === "" ? "an empty element" : `${JSON.stringify(element)} is outside its vocabulary`} (SPEC 11.1, 12.0)`,
      );
    }
  }
}

/** A session name outside the form of SPEC 10.1: a syntax-class error. */
function checkSessionNameForm(spelled, name) {
  if (!sessionNameValid(name)) {
    throw new UsageError(
      `${spelled}: invalid session name ${JSON.stringify(name)} (SPEC 10.1, 12.0)`,
    );
  }
}

/**
 * The value spellings of SPEC 12.0's syntax class that a fixed vocabulary, a
 * spelling rule, or a co-occurrence rule decides, for the invoked command
 * or subcommand (`spelled`) — judged from the arguments alone, before
 * configuration is loaded and before any acquisition or hold (12.0, 13.5),
 * the unserved flags' values included, so that no scope refusal masks a
 * usage error. `review create`'s and `review resolve`'s remaining flag
 * rules (10.7) are judged in their handlers, likewise before configuration
 * is loaded.
 */
function checkValueSpellings(spelled, flags, operands) {
  switch (spelled) {
    case "ids":
      if (flags.has("--file")) checkFileGlob(spelled, flags.get("--file"));
      return;
    case "show":
    case "query node":
    case "query subtree":
    case "query ancestors":
      checkIdentitySpelling(spelled, operands[0]);
      return;
    case "query nodes":
      if (flags.has("--tag")) checkTagValue(flags.get("--tag"));
      if (
        flags.has("--coverage") &&
        !COVERAGE_VALUES.has(flags.get("--coverage"))
      ) {
        throw new UsageError(
          `query nodes: invalid --coverage value ${JSON.stringify(flags.get("--coverage"))}: expected required or none (SPEC 11.1, 12.0)`,
        );
      }
      if (flags.has("--file")) checkFileGlob(spelled, flags.get("--file"));
      return;
    case "query edges":
    case "query reachable":
      for (const flag of ["--from", "--to"]) {
        if (flags.has(flag)) {
          checkIdentitySpelling(`${spelled} ${flag}`, flags.get(flag));
        }
      }
      if (flags.has("--kinds")) {
        checkKinds(
          spelled,
          flags.get("--kinds"),
          spelled === "query edges" ? EDGE_KINDS : DEPENDENCY_KINDS,
        );
      }
      return;
    case "move":
      for (const operand of operands) checkIdentitySpelling(spelled, operand);
      // Operands are classified by spelling alone: one spelling a
      // `<file>#<id>` pair beside one spelling a file matches neither
      // synopsis (SPEC 6.5, 12.0).
      if (operands[0].includes("#") !== operands[1].includes("#")) {
        throw new UsageError(
          "move: the operands mix the file form and the section form, matching neither synopsis (SPEC 6.5, 12.0)",
        );
      }
      return;
    case "review status":
    case "review next":
    case "review show":
    case "review split":
    case "review resolve":
    case "review export":
      checkSessionNameForm(spelled, operands[0]);
      return;
    default:
      return;
  }
}

/**
 * Refuse a flag a served synopsis names but this fixture does not serve —
 * called only once the syntax-class checks have passed (12.0).
 */
function refuseUnservedFlags(spelled, synopsis, flags) {
  for (const flag of synopsis.unservedFlags ?? []) {
    if (flags.has(flag)) {
      throw new FixtureScopeError(
        `${spelled} ${flag} is outside this fixture's certified surface (§CONF-CORE: ${spelled} in its unfiltered form alone)`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Mutating-command scaffold: exclusivity, hold seam, operation, release
// ---------------------------------------------------------------------------

/**
 * VIOL-CORE-EARLYRELEASE (CERTIFICATIONS.md): the sustained interval a run
 * dwells after releasing at its hold point, before the rest of the command.
 * Long relative to the time the rest of a run otherwise takes (a lifted
 * `rename`, `move`, or mutating `review` subcommand here exits some 30–45
 * ms after the lift, the hold file's 15 ms polling included), so it
 * dominates the lift-to-exit span T13.5-3's past-the-hold arm spreads its
 * kills across; short against every bound a run it lengthens meets (the
 * subprocess driver's 30 s hang guard, the 15 s bound of the 13.5 tests'
 * foreground runs, each test's budget — S-3).
 */
const EARLY_RELEASE_DWELL_MS = 1000;

/**
 * Run a mutating command (SPEC 13.5): configuration and the first
 * discovery, then workspace exclusivity, then the `--test-hold` seam, then
 * the second discovery, then the checks a command judges ahead of its
 * operation, in the order 12.0 and 13.5 fix — first the
 * usage-class argument checks of 12.0 and baseline resolution, 6.3
 * (`judgeArguments`: each judged from what it consults — the origin file
 * and its kind among the discovered sources, the session directory, the
 * configuration, the current journal and the absent repository
 * (resolveBaseline) — identically on valid and failing workspaces, so they
 * precede source validation), then, over the sources the second discovery
 * fixed and the journal, the gate of 13.3 binding the mutating `review`
 * subcommands or the valid-workspace precondition of `rename`/`move`,
 * 6.4/6.5 (`judgeWorkspace`, `build`'s validations through loadGraph; its
 * result, the loaded graph included, is what the operation and the refresh
 * act on) — then the operation (`operate`, given the second discovery as
 * well, whose sources a finishing regeneration reads, and the refresh of
 * 13.3 over the graph the gate loaded): its own outcomes and writes, a
 * mutating `review` subcommand (`refreshesGraphData`) meeting first every
 * outcome 10.7 orders past the gate — the session read, `create`'s
 * session-directory examination, the item check, and the refusals of a
 * blocked item and of an unsplittable one — and only past all of them
 * refreshing, just before its session write, so a run they turn back
 * refreshes nothing (10.7: stale graph data stays stale); exclusivity ends
 * with the command — released as every normal end
 * comes (completion, refusal, and failure alike; an acquisition that fails
 * releases before it throws), while a killed process leaves its entry, a
 * leftover the next acquisition removes once its identifier is no longer
 * listed (acquireExclusivity).
 * The first discovery (discover) meets, before acquisition, the
 * configuration error of a file both groups match and a refused listing
 * (14.14, 14.25; T13.5-8's acquisition-after arms), so those precede
 * acquisition's outcomes; nothing later consults its sources but
 * VIOL-CORE-EARLYREFRESH's foresight and early refresh, which judge the
 * workspace as it stands before acquisition (foreseeSessionWrite). The
 * second, once exclusivity is held — past the hold — fixes the sources
 * every later check and read consults, meeting either error there, after
 * acquisition's and the hold file's errors and before every other (13.5,
 * 12.0; T13.5-12(d), (e)).
 * Acquisition and the hold precede the second discovery and every later
 * check (SPEC 13.5; T13.5-8), so an invocation a later check refuses or the
 * gate turns back creates the hold file too and exits with its own outcome
 * only after the hold's deletion, having written nothing. Acquisition, the
 * hold, the second discovery, the two judged phases, and the refresh are
 * each position-independent so that one deviation can move one of them —
 * the refresh a closure the operation calls (`refreshBeforeSessionWrite`),
 * and a mutating `review` subcommand's operation, which only reads and
 * judges before that call, runnable up to it alone (foreseeSessionWrite).
 */
async function runMutating(
  cwd,
  configFlag,
  holdFlag,
  operate,
  {
    refreshesGraphData = false,
    judgeArguments = async () => {},
    judgeWorkspace,
  },
) {
  const config = await loadConfig(cwd, configFlag);
  // The first discovery (SPEC 13.5: a mutating command acquires once its
  // configuration is loaded and its sources discovered): the configuration
  // error and read failures it meets precede acquisition's outcomes (12.0).
  const firstDiscovery = await discover(config);
  // The 13.3 refresh of stale graph data (CERTIFICATIONS.md §CONF-CORE Scope:
  // "the 13.3 refresh a mutating `review` subcommand performs after the
  // hold, past every outcome 10.7 orders before it, and before its session
  // write, writing graph data byte-identical to what `build` writes"): only
  // the mutating `review` subcommands refresh — `rename` and file-form
  // `move` finish with a full regeneration instead (SPEC 6.4, 6.5) — and
  // the conformer runs it through the operation (`proceed` below hands it
  // over), after exclusivity is acquired and the hold has been released,
  // once every outcome 10.7 orders past the gate has passed, just before the
  // session write, over the graph the gate loaded; a run those outcomes turn
  // back never calls it. The closure is position-independent so that one
  // deviation can move it.
  const refreshIfStale = async (graph) => {
    if (refreshesGraphData) await refreshStaleGraphData(config, graph);
  };
  let refreshBeforeSessionWrite = refreshIfStale;
  // Workspace exclusivity (SPEC 13.5), acquired at the conformer's position
  // below — before the hold and every later check — and released in the
  // `finally` below as every normal end comes; an acquisition that fails
  // releases on its own before it throws, so `lock` stays the no-op.
  // VIOL-CORE-NOLOCK and VIOL-CORE-STALELOCK deviate inside acquisition's
  // judgment of the lock directory (judgeLockDirectory).
  let lock = { release: async () => {} };
  const acquire = async () => {
    lock = await acquireExclusivity(config.root);
  };
  const holdIfRequested = async () => {
    if (holdFlag === undefined) return;
    try {
      await holdAtSeam(holdFlag, cwd);
    } catch (error) {
      if (error instanceof UsageError) throw error;
      throw new UsageError(
        `cannot create the hold file: ${error.message} (SPEC 13.5, 12.0)`,
      );
    }
  };
  // The second discovery (SPEC 13.5): holding exclusivity, past the hold,
  // the command discovers its sources again — the sources every later check
  // and read consults, a configuration error or read failure it meets
  // reported there (discover) — so the workspace it judges and rewrites is
  // the one current once it holds exclusivity.
  const rediscover = async () => await discover(config);
  // The two judged phases over a discovery's sources, in 12.0's order: the
  // argument checks and baseline resolution, then the gate or precondition.
  const judge = async (discovery) => {
    await judgeArguments(config, discovery);
    return await judgeWorkspace(config, discovery);
  };
  // Everything that follows the judged checks, in the conformer's order: the
  // operation's own outcomes and writes, handed the refresh of 13.3 over the
  // graph the gate loaded — which a mutating `review` subcommand calls only
  // once every outcome 10.7 orders past the gate has passed, just before its
  // session write, so a run they turn back writes nothing (10.7, 13.5).
  const proceed = async (judged, discovery) =>
    await operate(config, judged, discovery, async () => {
      await refreshBeforeSessionWrite(judged.graph);
    });
  if (deviations.refreshBeforeExclusivity && refreshesGraphData) {
    // VIOL-CORE-EARLYREFRESH (CERTIFICATIONS.md): the 13.3 refresh a
    // mutating `review` subcommand performs on a stale workspace runs here,
    // before workspace exclusivity is acquired — before acquisition and the
    // hold — so stale graph data is rewritten before the hold file is
    // created, "wherever the subcommand's later checks, judged on the
    // workspace as it stands then, let it reach its session write; a run
    // they turn back refreshes nothing, early or late, as the conformer's
    // does (10.7: stale graph data stays stale)". The foresight
    // (foreseeSessionWrite) judges, reading alone, every outcome the run
    // meets ahead of its session write — acquisition's and the hold file's,
    // the argument checks of 12.0 and baseline resolution (6.3), the gate of
    // 13.3, and the outcomes 10.7 orders past it — over the workspace as it
    // stands now, the first discovery's sources standing for the second's;
    // where none turns the run back, the refresh runs here, over the graph
    // the foreseen gate loaded, and the one the operation makes before its
    // session write (below) becomes a no-op, so the refresh runs exactly
    // once, at this position. A run the foresight turns back refreshes
    // nothing here and keeps the conformer's refresh, which it reaches only
    // should the workspace have changed by then to let it through. Everything
    // else — acquisition; the hold file created after exclusivity and before
    // every other write (the session write, `rename`/`move`'s edits, journal
    // appends, the finishing regeneration of 6.4/6.5); every check and its
    // outcome; the refresh's own bytes — is exactly the conformer's
    // behavior, and a workspace whose graph data is current is refreshed by
    // nothing, where the deviation is unobservable — as is a workspace
    // failing `build`'s validations, which the foreseen gate turns back, so
    // the refresh writes nothing early or late (SPEC 13.3), the gate's
    // findings, like every usage error, reported only after acquisition and
    // the hold, at the conformer's position below (T13.5-8's
    // failing-workspace arms).
    const foreseen = await foreseeSessionWrite(
      config,
      cwd,
      holdFlag,
      firstDiscovery,
      judge,
      operate,
    );
    if (foreseen !== null) {
      await refreshIfStale(foreseen);
      refreshBeforeSessionWrite = async () => {};
    }
  }
  try {
    await acquire();
    if (deviations.lateHold) {
      // VIOL-CORE-LATEHOLD (CERTIFICATIONS.md): the hold seam engages late —
      // the command acquires exclusivity where 13.5 places it (above: once
      // configuration is loaded and sources discovered, before every later
      // check), but creates its hold file only once the unknown and
      // wrong-kind names and files of the usage class and baseline
      // resolution, its journal read included (12.0, 6.3: `judgeArguments`,
      // resolveBaseline), have passed, its second discovery (13.5)
      // preceding them, instead of immediately after acquiring. A single
      // deviation: the seam's place moved past those
      // checks and no further; the gate and refresh of 13.3, the item check,
      // the valid-workspace precondition of rename/move (6.4, 6.5), the
      // operation's own validation, and every modification still follow the
      // hold as 13.5 orders them, acquisition's outcomes — the busy refusal
      // and its write and read failures — still precede every check, and
      // the hold file still precedes every write. Observable exactly where
      // such a check refuses: the invocation exits 2 with that usage error,
      // having acquired and released (the `finally` below) but created no
      // hold file, `--test-hold` or not; an invocation passing those checks
      // — every performable one, and every one the gate, the item check, or
      // the precondition turns back — holds and proceeds or is refused
      // exactly as the conformer's does (T13.5-8: its five seam-ordering
      // arms those checks refuse fail — the baseline's beside a garbage
      // journal line among them, its journal read refusing it; every other
      // arm is conforming).
      const discovery = await rediscover();
      await judgeArguments(config, discovery);
      await holdIfRequested();
      return await proceed(await judgeWorkspace(config, discovery), discovery);
    }
    if (deviations.writesBeforeHold) {
      // VIOL-CORE-EARLYWRITE (CERTIFICATIONS.md): the mutating command
      // performs its workspace modifications before creating the hold file —
      // it acquires exclusivity (above, unchanged), completes the operation's
      // writes (the 13.3 refresh of stale graph data and the journal append
      // included), then creates the hold file, waits for its deletion, and
      // exits normally with the operation's outcome. The second discovery
      // (13.5), the argument checks of 12.0, baseline resolution (6.3), the
      // gate of 13.3 and the outcomes 10.7 orders past it (the refresh among
      // the writes they gate, made just before the session write), and the
      // valid-workspace precondition of rename/move (6.4, 6.5) are judged
      // after acquisition and before the writes they gate, as the conformer
      // judges them, while the exit they refuse with is deferred as the
      // writes' completion is: an invocation they refuse creates the hold
      // file having written nothing, waits for its deletion, and only then
      // exits with its error. The hold seam's own
      // semantics (empty file, occupied path fails exit 2) and everything
      // else are exactly the conformer's behavior.
      let code;
      try {
        const discovery = await rediscover();
        code = await proceed(await judge(discovery), discovery);
      } catch (error) {
        if (!isRefusedOutcome(error)) throw error;
        await holdIfRequested();
        throw error;
      }
      await holdIfRequested();
      return code;
    }
    await holdIfRequested();
    if (deviations.releaseAtHold) {
      // VIOL-CORE-EARLYRELEASE (CERTIFICATIONS.md): the run releases at its
      // hold point instead of as it ends — once its hold is lifted (above),
      // or, without the seam, straight after acquiring — deleting its
      // entry, then the emptied lock directory and an emptied area
      // directory its acquisition created, as release does (13.5); it then
      // dwells for EARLY_RELEASE_DWELL_MS and proceeds with the rest of the
      // command exactly as the conformer does, outside exclusivity,
      // releasing nothing further (the `finally` below finds the no-op). A
      // single deviation: 13.5's release point (as the command ends, after
      // its last write) moved to the hold point; acquisition, the hold file
      // — its creation failing on an occupied path, the run then ending at
      // once with the conformer's release — every check, every write and
      // its order, and every run's outcome are unchanged.
      const early = lock;
      lock = { release: async () => {} };
      await early.release();
      await sleep(EARLY_RELEASE_DWELL_MS);
    }
    const discovery = await rediscover();
    return await proceed(await judge(discovery), discovery);
  } finally {
    await lock.release();
  }
}

/**
 * Whether an error is one of the outcomes a check or validation refuses an
 * invocation with (SPEC 12.0: a usage error, exit 2; findings or a refused
 * operation, exit 1) — as opposed to a fixture crash.
 */
function isRefusedOutcome(error) {
  return (
    error instanceof UsageError ||
    error instanceof FindingsError ||
    error instanceof RefusalError
  );
}

/**
 * The stop VIOL-CORE-EARLYREFRESH's foresight puts at the session write
 * (foreseeSessionWrite): thrown by its stand-in for the refresh closure a
 * mutating `review` subcommand's operation calls just before writing its
 * session, so the operation stops there, its session never written.
 */
class SessionWriteReached extends Error {}

/**
 * VIOL-CORE-EARLYREFRESH's foresight (CERTIFICATIONS.md
 * §VIOL-CORE-EARLYREFRESH: the refresh runs before exclusivity is acquired
 * "wherever the subcommand's later checks, judged on the workspace as it
 * stands then, let it reach its session write; a run they turn back
 * refreshes nothing, early or late, as the conformer's does (10.7: stale
 * graph data stays stale)"): whether a mutating `review` subcommand's run,
 * judged before acquisition on the workspace and the invocation as they
 * stand, reaches its session write. Every outcome it meets ahead of that
 * write is judged by reading alone, in the conformer's order (12.0, 10.7):
 * acquisition's (acquisitionForeseenRefused: an obstruction, a live run's
 * entry, a refused examination or listing — 14.24, 14.26, 14.25) and the
 * hold file's (anything at the `--test-hold` path, 13.5); then, over
 * `discovery` — the first discovery's sources, which the second finds on
 * the workspace as it stands — the argument checks of 12.0 and baseline
 * resolution, 6.3, and the gate of 13.3 (`judge`); then the outcomes 10.7
 * orders past the gate — the session read, `create`'s session-directory
 * examination, the item check, and the refusals — met by the operation
 * itself (`operate`), run up to its session write and stopped there by the
 * closure it calls in the refresh's place (SessionWriteReached). The
 * operation reads, judges, and builds its session in memory before that
 * call, so the foresight writes nothing and emits nothing; a write the
 * environment would refuse — acquisition's creations, the hold file's — is
 * met only at that write (12.0), never foreseen. Returns the graph the
 * foreseen gate loaded where the run reaches its session write, else null:
 * an outcome turning it back — a usage error, findings, a refusal, a scope
 * error, or a system error — refreshes nothing early, the run meeting it at
 * the conformer's position once it has acquired and held; anything else is
 * a fixture crash, rethrown.
 */
async function foreseeSessionWrite(
  config,
  cwd,
  holdFlag,
  discovery,
  judge,
  operate,
) {
  let judged;
  try {
    if (await acquisitionForeseenRefused(config.root)) return null;
    if (
      holdFlag !== undefined &&
      (await occupantKind(path.resolve(cwd, holdFlag))) !== "absent"
    ) {
      return null;
    }
    judged = await judge(discovery);
    await operate(config, judged, discovery, async () => {
      throw new SessionWriteReached();
    });
  } catch (error) {
    if (error instanceof SessionWriteReached) return judged.graph;
    if (
      isRefusedOutcome(error) ||
      error instanceof FixtureScopeError ||
      isSystemError(error)
    ) {
      return null;
    }
    throw error;
  }
  throw new Error(
    "a mutating review subcommand's operation returned without reaching its session write",
  );
}

/**
 * VIOL-CORE-EARLYREFRESH's foresight of acquisition (foreseeSessionWrite):
 * whether acquireExclusivity, judged by reading alone on the workspace as
 * it stands, refuses the run — the area's own path holding anything but a
 * directory, or the lock path anything but a directory or a plain file (an
 * obstruction acquisition does not remove, 14.24), or the lock directory's
 * listing holding a live run's entry (the busy refusal of 14.26,
 * judgeListing; this run has added no entry, so one recording its own
 * identifier is a leftover, as acquisition judges one). A missing area or
 * lock directory, which acquisition brings into existence, and a plain file
 * at the lock path, a leftover it removes, refuse nothing here; a refused
 * examination or listing (14.25) throws, as acquisition's does. Nothing is
 * created or removed.
 */
async function acquisitionForeseenRefused(root) {
  const area = await occupantKind(path.join(root, AREA_REL));
  if (area === "absent") return false;
  if (area !== "directory") return true;
  const lockAbs = path.join(root, LOCK_REL);
  const lock = await occupantKind(lockAbs);
  if (lock === "absent" || lock === "file") return false;
  if (lock !== "directory") return true;
  const lockBytes = Buffer.from(lockAbs);
  await judgeListing(lockBytes, await listNames(lockBytes), null);
  return false;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function commandBuild(io, cwd, { flags }) {
  const config = await loadConfig(cwd, flags["--config"]);
  const discovery = await discover(config);
  // VIOL-CORE-BUILDWAIT (CERTIFICATIONS.md, `buildWaitsForHolders`): `build`
  // waits out other runs' exclusivity once its sources are discovered —
  // where a mutating command acquires (SPEC 13.5) — before anything is
  // parsed.
  if (deviations.buildWaitsForHolders) await awaitNoLiveHolder(config.root);
  const graph = await loadGraph(config.root, discovery);
  await regenerate(graph);
  // A `build` report's defined content is findings alone, so a successful
  // build's JSON document is the findings report of 12.7 with none:
  // `{"findings": []}` (SPEC 12.7, 12.0).
  emitDoc(io, flags["--json"] === true, findingsDoc([]), ["build: ok"]);
  return 0;
}

async function commandCheck(io, cwd, { flags }) {
  const config = await loadConfig(cwd, flags["--config"]);
  // `build`'s validations (SPEC 12.2): the sources' through loadGraph, the
  // journal's (14.13, journalFindings) made here — reported beside the
  // sources' findings where those fail, as `build` reports them, and beside
  // the staleness and session findings below otherwise.
  let graph;
  try {
    graph = await loadGraph(config.root, await discover(config), {
      judgeJournal: false,
    });
  } catch (error) {
    if (!(error instanceof FindingsError)) throw error;
    throw new FindingsError([
      ...error.findings,
      ...(await journalFindings(config.root)),
    ]);
  }
  /** @type {Finding[]} */
  const findings = [];
  // 14.10: derived files content-identical to what the current sources
  // generate; no recorded derived file at a no-longer-generated path.
  const expected = new Map(
    graph.files.map((model) => [
      modulePathFor(model.rel),
      moduleContent(model),
    ]),
  );
  expected.set(GRAPH_DATA_REL, graphDataContent(graph));
  for (const [rel, content] of expected) {
    let actual = null;
    try {
      actual = await fsp.readFile(path.join(graph.root, rel), "utf8");
    } catch {
      actual = null;
    }
    if (actual !== content) {
      findings.push({
        condition: "14.10",
        message: `stale generated output: ${rel} does not match what the current sources generate; run \`xspec build\``,
        file: rel,
      });
    }
  }
  for (const orphan of await readRecordedDerived(graph.root)) {
    if (
      !expected.has(orphan) &&
      (await pathOccupied(path.join(graph.root, orphan)))
    ) {
      findings.push({
        condition: "14.10",
        message: `stale generated output: recorded derived file ${orphan} is no longer generated; run \`xspec build\``,
        file: orphan,
      });
    }
  }
  // 14.13: journal well-formed and replayable (journalFindings).
  findings.push(...(await journalFindings(config.root)));
  // 14.21: review sessions not internally corrupt.
  for (const name of await listSessionNames(config.root)) {
    const loaded = await loadSession(config.root, name);
    if (loaded.state === "corrupt") {
      findings.push({
        condition: "14.21",
        message: `corrupt review session: ${name} (SPEC 10.1)`,
        file: sessionRel(name),
      });
    }
  }
  if (findings.length > 0) {
    emitFindings(io, flags["--json"] === true, findings);
    return 1;
  }
  emitDoc(io, flags["--json"] === true, { findings: [] }, ["check: ok"]);
  return 0;
}

async function commandIds(io, cwd, { flags }) {
  const config = await loadConfig(cwd, flags["--config"]);
  const graph = await loadGraph(config.root, await discover(config));
  const doc = {
    files: graph.files.map((model) => ({
      file: model.rel,
      ids: model.sections.map((section) => section.id),
    })),
  };
  emitDoc(
    io,
    flags["--json"] === true,
    doc,
    graph.files.flatMap((model) => [
      model.rel,
      ...model.sections.map((s) => `  ${s.id}`),
    ]),
  );
  return 0;
}

function nodeReportDoc(node) {
  return {
    edges: {
      incoming:
        node.parent && node.parent.identity !== undefined
          ? [
              {
                from: node.parent.identity,
                kind: "contains",
                to: node.identity,
              },
            ]
          : [],
      outgoing: node.children.map((child) => ({
        from: node.identity,
        kind: "contains",
        to: child.identity,
      })),
    },
    hashes: {
      effectiveHash: node.effectiveHash,
      metadataHash: node.metadataHash,
      ownHash: node.ownHash,
      subtreeHash: node.subtreeHash,
    },
    identity: node.identity,
    ownText: node.ownText,
    sourceRange: { end: node.sourceRange.end, start: node.sourceRange.start },
    subtreeText: node.subtreeText,
    tags: [],
  };
}

/**
 * A read 13.3 gates (`show`, `query`, the `review` reads; SPEC 12.0, 13.3):
 * configuration and discovery — whose configuration error and read
 * failures precede every error consulting them (12.0) — then the read's
 * argument checks (`judgeArguments`, given the discovered sources) — each
 * judged from what it consults, identically on valid and failing
 * workspaces, so that a usage-error argument exits 2 whatever findings the
 * workspace carries (12.0) — and only then the gate: `build`'s validations
 * over the discovered sources and the journal (loadGraph), a failing
 * workspace's findings reported, exit 1, in place of the answer (13.3).
 */
async function loadGatedRead(cwd, flags, judgeArguments) {
  const config = await loadConfig(cwd, flags["--config"]);
  const discovery = await discover(config);
  await judgeArguments(config, discovery);
  return { config, graph: await loadGraph(config.root, discovery) };
}

/**
 * The identity checks of a gated read's `<node>` and `<graph-node>`
 * arguments (SPEC 12.0), each judged parse-locally against the named file
 * as 6.4 judges the old ID (judgeOriginFile): the path must be a discovered
 * spec source — a bare path naming its file's root (1.5) — and an `id` must
 * be among the file's spelled identities (11.2, spelledSectionsOf), an
 * unparseable named file masking the check, so that the gate then reports
 * (exit 1). A discovered code source's path names a code location, which
 * the reads of this surface never name (§CONF-CORE: code groups only in
 * T13.5-8's workspaces, whose arms drive no such read): refused loudly
 * (exit 70), never answered. Each spelling holds at most one `#`, a
 * syntax-class check already passed (checkValueSpellings).
 */
function judgeNodeIdentities(identities) {
  return async (config, discovery) => {
    for (const identity of identities) {
      const hash = identity.indexOf("#");
      const file = hash === -1 ? identity : identity.slice(0, hash);
      if (discovery.code.includes(file)) {
        throw new FixtureScopeError(
          `${identity} names a code location, which this fixture's reads never name (§CONF-CORE)`,
        );
      }
      if (!discovery.spec.includes(file)) {
        throw new UsageError(
          `unknown node ${identity}: ${file} is not a discovered source (SPEC 11.1, 12.0)`,
        );
      }
      if (hash === -1) continue;
      const id = identity.slice(hash + 1);
      const sections = await spelledSectionsOf(config.root, file);
      if (sections !== null && !sections.some((node) => node.id === id)) {
        throw new UsageError(
          `unknown node ${identity}: no section of ${file} spells the id ${id} (SPEC 11.2, 12.0)`,
        );
      }
    }
  };
}

/**
 * The node an identity names in the graph a gated read loaded — present,
 * the read's argument checks having passed over the same files ahead of
 * the gate (judgeNodeIdentities): on a workspace passing the gate, the
 * spelled identities and the graph's agree.
 */
function requireNode(graph, identity) {
  const node = graph.byIdentity.get(identity);
  if (node === undefined) {
    throw new Error(
      `fixture invariant: ${identity} passed the argument checks but is absent from the loaded graph`,
    );
  }
  return node;
}

async function commandShow(io, cwd, { flags, positionals }) {
  const { graph } = await loadGatedRead(
    cwd,
    flags,
    judgeNodeIdentities([positionals[0]]),
  );
  const doc = nodeReportDoc(requireNode(graph, positionals[0]));
  emitDoc(io, flags["--json"] === true, doc, [canonicalJson(doc)]);
  return 0;
}

function nodeRow(node) {
  return {
    identity: node.identity,
    sourceRange: { end: node.sourceRange.end, start: node.sourceRange.start },
    tags: [],
  };
}

/**
 * `query`'s served subcommands (SPEC 11.1), the subcommand and its operands
 * read under 12.0's grammar by dispatchCommand: `query edges` and `query
 * nodes` in their unfiltered forms alone (refuseUnservedFlags).
 */
async function commandQuery(io, cwd, sub, { flags, positionals }) {
  // The identities the invocation names, judged ahead of the gate (12.0):
  // `reachable`'s two required `<graph-node>` flags, or the `<node>` operand
  // of `node`, `subtree`, and `ancestors` — `nodes` and `edges`, served
  // unfiltered alone, name none (their synopses admit no operand).
  const { graph } = await loadGatedRead(
    cwd,
    flags,
    judgeNodeIdentities(
      sub === "reachable" ? [flags["--from"], flags["--to"]] : positionals,
    ),
  );
  if (sub === "nodes" && graph.code.length > 0) {
    // Every discovered code source is a graph node (SPEC 5.1, 4.6) this
    // answer would list; code groups lie in T13.5-8's workspaces alone,
    // whose arms drive no `query` (§CONF-CORE) — refused loudly, never
    // answered without them.
    throw new FixtureScopeError(
      "query nodes over a workspace with code sources lies outside this fixture's surface (§CONF-CORE)",
    );
  }
  const allNodes = graph.files.flatMap((model) => model.nodes);
  if (sub === "node") {
    emitJsonOnly(io, nodeReportDoc(requireNode(graph, positionals[0])));
    return 0;
  }
  if (sub === "nodes") {
    emitJsonOnly(io, { nodes: allNodes.map(nodeRow) });
    return 0;
  }
  if (sub === "subtree") {
    const node = requireNode(graph, positionals[0]);
    const nodes = [
      node,
      ...descendantIdentities(node).map((identity) =>
        graph.byIdentity.get(identity),
      ),
    ];
    emitJsonOnly(io, { nodes: nodes.map(nodeRow) });
    return 0;
  }
  if (sub === "ancestors") {
    const node = requireNode(graph, positionals[0]);
    emitJsonOnly(io, { nodes: ancestorChain(node).map(nodeRow) });
    return 0;
  }
  if (sub === "edges") {
    const edges = allNodes.flatMap((node) =>
      node.children.map((child) => ({
        from: node.identity,
        kind: "contains",
        to: child.identity,
      })),
    );
    emitJsonOnly(io, { edges });
    return 0;
  }
  // reachable: dependency kinds only; this scope has no dependency edges.
  // Both flags are required by the synopsis (checkSynopsis, SPEC 11.1,
  // 12.0), their identities judged ahead of the gate (above); `--kinds`,
  // its vocabulary judged with the value spellings (checkValueSpellings),
  // selects among dependency kinds, of which this scope's graph holds no
  // edge.
  requireNode(graph, flags["--from"]);
  requireNode(graph, flags["--to"]);
  emitJsonOnly(io, { reachable: false });
  return 0;
}

async function commandCoverage(io, cwd, { flags, positionals }) {
  const config = await loadConfig(cwd, flags["--config"]);
  // Discovery precedes every error consulting configuration (12.0): a
  // refused listing reports before an unknown profile does (T14-10(g)).
  const discovery = await discover(config);
  if (positionals.length === 1) {
    // `coverage <name>` (SPEC 8.2): this scope configures no profile, so
    // every name is an unknown profile — a usage error judged against the
    // configuration, ahead of the gate of 13.3 (12.0).
    throw new UsageError(
      `unknown coverage profile ${positionals[0]}: no profile is configured (SPEC 8.2, 12.0)`,
    );
  }
  await loadGraph(config.root, discovery); // reads answer per current sources
  emitDoc(io, flags["--json"] === true, { profiles: [] }, [
    "coverage: 0 profiles configured",
  ]);
  return 0;
}

async function commandImpact(io, cwd, { flags }) {
  // `--base` is required by the synopsis (checkSynopsis, SPEC 9, 12.0).
  // Configuration and discovery precede the baseline, which consults the
  // workspace (12.0), and its resolution precedes the gate of 13.3 (12.0),
  // never reached in this git-less scope: the current journal read first, a
  // journal error failing it as the usage error carrying condition 13's
  // code and concerned path, otherwise a baseline that cannot be read or
  // reconstructed, a plain usage error (SPEC 6.3, 12.0; resolveBaseline).
  const config = await loadConfig(cwd, flags["--config"]);
  await discover(config);
  await resolveBaseline(config.root, flags["--base"]);
  throw new Error(
    "fixture invariant: a baseline resolved in this git-less scope (resolveBaseline always fails)",
  );
}

// --- rename / move (SPEC 6.4, 6.5) ---

/**
 * The argument checks of `rename` and `move` over the origin file (SPEC 6.4,
 * 6.5, 12.0) — runMutating's `judgeArguments`, over the sources a discovery
 * yielded (the second, past the hold; a preview's one): the file must be a
 * discovered spec source — a discovered code source is a wrong-kind origin
 * and any other path an unknown file, each a usage error, exit 2, judged
 * like existence before any content question (6.4) — and, where an ID is
 * given (`rename`'s old ID, the section form of `move`'s origin ID), the ID
 * must exist, judged parse-locally over the origin file's spelled
 * identities (11.2): it exists exactly when a section of the file spells
 * it, and an unparseable origin file masks the check — the precondition
 * then reports the file's finding, exit 1. Consulting the discovered paths
 * and the origin file alone, the checks are judged identically on valid and
 * failing workspaces and precede source validation (12.0): T13.5-8's
 * excluded `rename specs/A.mdx a b` on the failing workspace passes them.
 */
function judgeOriginFile(file, oldId, section) {
  return async (config, discovery) => {
    if (discovery.code.includes(file)) {
      throw new UsageError(
        `wrong-kind origin ${file}: a discovered code source, not a spec source (SPEC ${section}, 12.0)`,
      );
    }
    if (!discovery.spec.includes(file)) {
      throw new UsageError(
        `unknown file ${file}: not a discovered spec source (SPEC ${section}, 12.0)`,
      );
    }
    if (oldId === undefined) return;
    const sections = await spelledSectionsOf(config.root, file);
    if (sections !== null && !sections.some((node) => node.id === oldId)) {
      throw new UsageError(
        `unknown id ${oldId} in ${file} (SPEC ${section}, 12.0)`,
      );
    }
  };
}

/**
 * The sections a discovered source spells, parsed locally (SPEC 11.2), or
 * null where the file is an invalid source path or unparseable — the
 * conditions loadGraph reports for it (14.19, 14.20), masking every check
 * judged over its content (12.0). The decode keeps a leading byte-order mark
 * (ignoreBOM) so that it masks as the 14.20 condition it is, as in loadGraph.
 */
async function spelledSectionsOf(root, rel) {
  if (!rel.endsWith(".mdx") || rel.includes("#")) return null;
  const bytes = await fsp.readFile(path.join(root, rel));
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    return null;
  }
  if (text.charCodeAt(0) === 0xfeff) return null;
  const parsed = parseMdx(text, rel);
  return parsed.findings.length > 0 ? null : parsed.sections;
}

async function commandRename(io, cwd, { flags, positionals }) {
  const [file, oldId, newId] = positionals;
  if (flags["--preview"] === true) {
    return await previewRename(cwd, flags, file, oldId, newId);
  }
  // The checks judged ahead of the operation, in 12.0's order: first the
  // argument checks of 12.0 (runMutating's `judgeArguments`: an unknown or
  // wrong-kind file or an unknown old id a usage error, exit 2, judged over
  // the discovered sources and parse-locally over the origin file —
  // judgeOriginFile), then the valid-workspace precondition of 6.4
  // (`judgeWorkspace`: `build`'s validations over the sources the second
  // discovery fixed and the journal, loadGraph, findings exit 1, nothing
  // written); the origin file and its old-id bearer are then read off the
  // loaded graph — both exist, the argument checks having passed over the
  // same file, or the precondition has already reported the file.
  const judgeWorkspace = async (config, discovery) => {
    const graph = await loadGraph(config.root, discovery);
    const model = graph.files.find((candidate) => candidate.rel === file);
    const target = model?.sections.find((section) => section.id === oldId);
    if (model === undefined || target === undefined) {
      throw new Error(
        `fixture invariant: ${file}#${oldId} passed the argument checks but is absent from the loaded graph`,
      );
    }
    return { graph, model, target };
  };
  return await runMutating(
    cwd,
    flags["--config"],
    flags["--test-hold"],
    async (config, { model, target }, discovery) => {
      // Validation (SPEC 6.4): new id valid, differs, collides with nothing,
      // structural parent rules remain satisfied.
      const refusal = (message) => new RefusalError(message);
      if (newId === oldId)
        throw refusal(
          `rename refused: the new id equals the old id (SPEC 6.4)`,
        );
      const segments = newId.split(".");
      if (!segments.every(segmentValid)) {
        throw refusal(
          `rename refused: invalid new id ${JSON.stringify(newId)} (SPEC 1.4, 6.4)`,
        );
      }
      const parentId = target.parent.id ?? null;
      const expectedPrefix = parentId === null ? "" : `${parentId}.`;
      const structural =
        newId.startsWith(expectedPrefix) &&
        newId.length > expectedPrefix.length &&
        !newId.slice(expectedPrefix.length).includes(".");
      if (!structural) {
        throw refusal(
          `rename refused: ${JSON.stringify(newId)} violates the structural parent rules at its position (SPEC 1.3, 6.4)`,
        );
      }
      const rewrittenOf = (id) =>
        id === oldId
          ? newId
          : id.startsWith(`${oldId}.`)
            ? newId + id.slice(oldId.length)
            : id;
      const survivingIds = new Set(
        model.sections.map((section) => rewrittenOf(section.id)),
      );
      if (survivingIds.size !== model.sections.length) {
        throw refusal(
          `rename refused: ${JSON.stringify(newId)} collides with an existing id (SPEC 6.4)`,
        );
      }
      // Minimal in-place edits: rewrite the affected id attribute values,
      // descending by offset so earlier offsets stay valid (SPEC 6.4).
      const edits = model.sections
        .filter(
          (section) =>
            section.id === oldId || section.id.startsWith(`${oldId}.`),
        )
        .map((section) => ({
          start: section.idValueStart,
          end: section.idValueEnd,
          replacement: rewrittenOf(section.id),
        }))
        .sort((a, b) => b.start - a.start);
      let text = await fsp.readFile(path.join(config.root, file), "utf8");
      for (const edit of edits) {
        text =
          text.slice(0, edit.start) + edit.replacement + text.slice(edit.end);
      }
      await writeFileAtomic(path.join(config.root, file), text);
      await appendJournal(config.root, {
        from: oldId,
        kind: "rename",
        path: file,
        to: newId,
      });
      // Finishing regeneration exactly as `build` (SPEC 6.4), over the
      // sources the second discovery fixed (SPEC 13.5).
      const regenerated = await loadGraph(config.root, discovery);
      await regenerate(regenerated);
      // The applied mapping in the performed-operation form of 12.7 (SPEC
      // 6.4): exactly {"findings", "mapping"} — `findings` [] and `mapping`
      // one {"from", "to"} per mapped identity, the renamed node and its
      // descendants by prefix replacement, ordered by `from` bytes.
      const mapping = model.sections
        .filter(
          (section) =>
            section.id === oldId || section.id.startsWith(`${oldId}.`),
        )
        .map((section) => ({
          from: `${file}#${section.id}`,
          to: `${file}#${rewrittenOf(section.id)}`,
        }))
        .sort((a, b) => compareIdentityBytes(a.from, b.from));
      emitDoc(io, flags["--json"] === true, { findings: [], mapping }, [
        `rename: ${file} ${oldId} -> ${newId}`,
      ]);
      return 0;
    },
    { judgeArguments: judgeOriginFile(file, oldId, "6.4"), judgeWorkspace },
  );
}

/**
 * `rename --preview` (SPEC 6.6), within this fixture's surface only as
 * T13.5-8's non-mutating boundary drives it (CERTIFICATIONS.md §CONF-CORE).
 * A preview is a non-mutating command under 13.5: it acquires no workspace
 * exclusivity, creates no hold file, and does not take the acquisition-tied
 * seam — `--test-hold` beside `--preview` is a usage error of the syntax
 * class (SPEC 12.0), judged from the arguments alone by checkSynopsis,
 * before configuration is loaded — and it is
 * refused exactly as the real operation would be (6.6): the real rename's
 * argument checks of 12.0 (judgeOriginFile: a nonexistent or wrong-kind
 * origin file or a nonexistent old ID, 6.4) exit 2 at once, modifying
 * nothing, judged as the real operation judges them — after configuration
 * and its one discovery, ahead of the valid-workspace precondition of 6.4,
 * so on valid and failing workspaces alike (12.0) — and only then the
 * precondition over the discovered sources (findings, exit 1). A preview of a performable rename lies outside this surface and is
 * refused loudly, outside the 12.0 partition, never answered.
 */
async function previewRename(cwd, flags, file, oldId, newId) {
  const config = await loadConfig(cwd, flags["--config"]);
  const discovery = await discover(config);
  await judgeOriginFile(file, oldId, "6.4")(config, discovery);
  await loadGraph(config.root, discovery);
  throw new FixtureScopeError(
    `rename --preview of a performable operation (${file} ${oldId} -> ${newId}) lies outside this fixture's certified surface (§CONF-CORE)`,
  );
}

/**
 * `move`'s section form (SPEC 6.5), within this fixture's surface only to
 * its argument checks, as T13.5-8's acquisition-first arms drive it (`move
 * specs/A.mdx#nope specs/B.mdx#x`; CERTIFICATIONS.md §CONF-CORE): a
 * mutating command like the file form — the first discovery, acquisition,
 * the hold, and the second discovery first — whose argument checks of 12.0
 * judge the origin pair as rename's judge its file and old ID
 * (judgeOriginFile: a nonexistent or wrong-kind origin file, or a
 * nonexistent origin ID, a usage error, exit 2, an unparseable origin file
 * masking the ID check), followed by the valid-workspace precondition
 * (findings, exit 1). A section move those checks admit — performable, or
 * refused by its own validation — lies outside this surface: refused loudly
 * (exit 70), never performed or answered. The target operand takes part in
 * no check here; every outcome it decides is a refusal (6.5).
 */
async function moveSection(cwd, flags, origin, target) {
  const hash = origin.indexOf("#");
  const file = origin.slice(0, hash);
  const id = origin.slice(hash + 1);
  return await runMutating(
    cwd,
    flags["--config"],
    flags["--test-hold"],
    async () => {
      throw new FixtureScopeError(
        `a section move its argument checks and precondition admit (${origin} -> ${target}) lies outside this fixture's certified surface (§CONF-CORE: the section form only to its argument checks)`,
      );
    },
    {
      judgeArguments: judgeOriginFile(file, id, "6.5"),
      judgeWorkspace: async (config, discovery) => ({
        graph: await loadGraph(config.root, discovery),
      }),
    },
  );
}

async function commandMove(io, cwd, { flags, positionals }) {
  const [oldPath, newPath] = positionals;
  // Every preview is outside this fixture's certified scope
  // (CERTIFICATIONS.md §CONF-CORE: `rename --preview` alone, as T13.5-8
  // drives it) — refused loudly only once the syntax-class checks of 12.0
  // have passed (dispatchCommand: each operand holds at most one `#`, the
  // two operands spell one form, and `--test-hold` beside `--preview` is a
  // usage error), so no scope refusal masks a usage error.
  if (flags["--preview"] === true) {
    throw new FixtureScopeError(
      "move --preview lies outside this fixture's certified surface (§CONF-CORE scope)",
    );
  }
  // The operands spell one form (checkValueSpellings): `<file>#<id>` pairs
  // are the section form.
  if (oldPath.includes("#"))
    return await moveSection(cwd, flags, oldPath, newPath);
  // The checks judged ahead of the operation, in 12.0's order: first the
  // argument check of 12.0 (runMutating's `judgeArguments`: an unknown or
  // wrong-kind origin file a usage error, exit 2, judged over the discovered
  // sources — judgeOriginFile), then the valid-workspace precondition of
  // 6.5 (`judgeWorkspace`: `build`'s validations over the sources the second
  // discovery fixed and the journal, loadGraph, findings exit 1, nothing
  // written).
  const judgeWorkspace = async (config, discovery) => ({
    graph: await loadGraph(config.root, discovery),
  });
  return await runMutating(
    cwd,
    flags["--config"],
    flags["--test-hold"],
    async (config, { graph }, discovery) => {
      const refusal = (message) => new RefusalError(message);
      if (await pathOccupied(path.join(config.root, newPath))) {
        throw refusal(
          `move refused: the destination ${newPath} already exists (SPEC 6.5)`,
        );
      }
      if (!newPath.endsWith(".mdx")) {
        throw refusal(
          `move refused: the destination must have the .mdx extension (SPEC 6.5, 14.19)`,
        );
      }
      // A destination no spec group matches, or a code group matches as
      // well (a configuration error, 14.14), would not be a valid discovered
      // spec source after the move: refused-invalid-destination (6.5).
      if (
        !groupsMatch(config.specGroups, newPath) ||
        groupsMatch(config.codeGroups, newPath) ||
        isDerivedPath(newPath)
      ) {
        throw refusal(
          `move refused: ${newPath} would not be a valid discovered spec source after the move (SPEC 6.5)`,
        );
      }
      await fsp.mkdir(path.dirname(path.join(config.root, newPath)), {
        recursive: true,
      });
      await fsp.rename(
        path.join(config.root, oldPath),
        path.join(config.root, newPath),
      );
      await appendJournal(config.root, {
        from: oldPath,
        kind: "move",
        to: newPath,
      });
      // Finishing regeneration exactly as `build` (SPEC 6.5, 6.4), over the
      // sources the second discovery fixed (SPEC 13.5), the relocation
      // applied.
      const relocated = {
        spec: discovery.spec
          .map((rel) => (rel === oldPath ? newPath : rel))
          .sort(),
        code: discovery.code,
      };
      const regenerated = await loadGraph(config.root, relocated);
      await regenerate(regenerated);
      // The applied mapping in the performed-operation form of 12.7 (SPEC
      // 6.5): one pair per node of the moved file — the root's bare-path
      // pair (old path to new) and every section, its ID kept and its file
      // part changed — ordered by `from` bytes (the bare path a proper
      // prefix of every `<path>#<id>` identity, so it sorts first).
      const moved = graph.files.find((model) => model.rel === oldPath);
      const mapping = [
        { from: oldPath, to: newPath },
        ...moved.sections.map((section) => ({
          from: `${oldPath}#${section.id}`,
          to: `${newPath}#${section.id}`,
        })),
      ].sort((a, b) => compareIdentityBytes(a.from, b.from));
      emitDoc(io, flags["--json"] === true, { findings: [], mapping }, [
        `move: ${oldPath} -> ${newPath}`,
      ]);
      return 0;
    },
    {
      judgeArguments: judgeOriginFile(oldPath, undefined, "6.5"),
      judgeWorkspace,
    },
  );
}

// --- review (SPEC 10) ---

async function requireSession(root, name) {
  const loaded = await loadSession(root, name);
  if (loaded.state === "invalid-name") {
    throw new UsageError(
      `invalid session name ${JSON.stringify(name)} (SPEC 10.1, 12.0)`,
    );
  }
  if (loaded.state === "missing") {
    throw new UsageError(`unknown session ${name} (SPEC 10.1, 12.0)`);
  }
  if (loaded.state === "corrupt") {
    throw new FindingsError([
      {
        condition: "14.21",
        message: `corrupt review session: ${name} (SPEC 10.1, 14.21)`,
        file: sessionRel(name),
      },
    ]);
  }
  return loaded.session;
}

function requireItem(session, itemId) {
  const item = session.items.find((candidate) => candidate.id === itemId);
  if (item === undefined) {
    throw new UsageError(
      `unknown review item ${itemId} in session ${session.name} (SPEC 12.0)`,
    );
  }
  return item;
}

async function reviewCreate(io, cwd, { flags }) {
  // The flag rules of 10.7 — of 12.0's syntax class, judged from the
  // arguments alone, before configuration is loaded and before acquisition
  // and the hold: `--name` (required by the synopsis, checkSynopsis) in the
  // form of 10.1, exactly one of `--base`, `--strategy audit`, and
  // `--coverage`, and `--strategy`'s vocabulary.
  const name = flags["--name"];
  if (!sessionNameValid(name)) {
    throw new UsageError(
      `invalid session name ${JSON.stringify(name)} (SPEC 10.1, 12.0)`,
    );
  }
  const modes = ["--base", "--strategy", "--coverage"].filter(
    (flag) => flags[flag] !== undefined,
  );
  if (modes.length !== 1) {
    throw new UsageError(
      "review create requires exactly one of --base, --strategy audit, or --coverage (SPEC 10.7, 12.0)",
    );
  }
  if (flags["--strategy"] !== undefined && flags["--strategy"] !== "audit") {
    throw new UsageError(
      `unknown strategy ${flags["--strategy"]} (SPEC 10.7, 12.0)`,
    );
  }
  // The checks judged ahead of the operation, in 12.0's order: first
  // baseline resolution (SPEC 6.3) and the profile name under `--coverage`
  // (SPEC 7.4, 12.0) — runMutating's `judgeArguments`, consulting the
  // current journal, the workspace's absent repository, and the
  // configuration, judged after acquisition and the hold and before the
  // gate and refresh of 13.3 (SPEC 13.5, 12.0; T13.5-8's baseline arms); in
  // this git-less scope the resolution reads the journal first — a journal
  // error there the exit-2 `journal-error` concerning `.xspec/journal`,
  // never the gate's finding — and otherwise no ref can be read — the exit-2
  // unreadable-baseline case of 6.3, as `impact --base` is (resolveBaseline)
  // — and no coverage profile is configured — then the gate of 13.3
  // (`judgeWorkspace`, judgeGate): `build`'s validations over the current
  // sources and the journal, findings exit 1. The operation then meets the
  // examination of the session directory (10.7) and only past it refreshes
  // and writes the session.
  const judgeArguments = async (config) => {
    if (flags["--base"] !== undefined) {
      await resolveBaseline(config.root, flags["--base"]);
    }
    if (flags["--coverage"] !== undefined) {
      throw new UsageError(
        `unknown coverage profile ${flags["--coverage"]} (SPEC 12.0)`,
      );
    }
  };
  return await runMutating(
    cwd,
    flags["--config"],
    flags["--test-hold"],
    async (config, { graph }, _discovery, refreshBeforeSessionWrite) => {
      // The examination of the session directory (SPEC 10.7: the outcome
      // `create` meets past the gate), within this scope its create-time
      // restriction (SPEC 10.1): a name matching an existing session's name
      // ignoring ASCII case is refused, writing nothing (10.7: stale graph
      // data stays stale).
      const existing = await listSessionNames(config.root);
      if (
        existing.some(
          (candidate) => candidate.toLowerCase() === name.toLowerCase(),
        )
      ) {
        throw new RefusalError(
          `review create refused: a session named ${name} already exists (SPEC 10.1, 10.7)`,
        );
      }
      const journal = await readJournal(config.root);
      const session = {
        decompositions: [],
        items: [],
        name,
        nextId: 1,
        strategy: "audit",
      };
      // The audit strategy's items (SPEC 10.6), as the derivation of the
      // empty session (rederive): one `subtree-coherence` item per node,
      // each blocked by its child sections' items, so leaves are unblocked
      // and review is bottom-up, each entering with current state (10.2).
      rederive(session, graph, journal);
      // Past every outcome 10.7 orders before it: the refresh of 13.3 where
      // graph data is stale, then the session file, once, last (SPEC 10.7,
      // 13.5).
      await refreshBeforeSessionWrite();
      await writeSession(config.root, session);
      emitDoc(io, flags["--json"] === true, { name, ok: true }, [
        `review: created session ${name} (${String(session.items.length)} items)`,
      ]);
      return 0;
    },
    { judgeArguments, judgeWorkspace: judgeGate, refreshesGraphData: true },
  );
}

/**
 * The workspace check of a mutating `review` subcommand (runMutating's
 * `judgeWorkspace`): exactly the gate of 13.3 — `build`'s validations over
 * the sources the second discovery fixed and the journal (loadGraph: source
 * validation errors and journal errors alike), findings exit 1, no session
 * file read (SPEC 13.3, 13.5, 12.0, 10.7); the subcommand's own outcomes
 * (10.7: the session read, `create`'s session-directory examination, the
 * item check, and the refusals) follow it, in the operation, and the refresh
 * of 13.3 follows them, just before the session write.
 */
async function judgeGate(config, discovery) {
  return { graph: await loadGraph(config.root, discovery) };
}

/**
 * The argument check of the `review` subcommands naming a session, ahead of
 * the gate — `resolve` and `split` (runMutating's `judgeArguments`) and the
 * reads `status`, `next`, `show`, and `export` (loadGatedRead's) — per SPEC
 * 12.0: a session name is judged against the session directory,
 * identically on valid and failing workspaces, before the invalid-workspace
 * report of 13.3: the name must
 * name a session file in the directory — a usage error, exit 2, otherwise;
 * its form (10.1) is of 12.0's syntax class, judged from the arguments
 * alone before configuration is loaded (checkValueSpellings), so the form
 * test here never refuses. The session file itself is read only past the
 * gate (requireSession) — for the mutating subcommands ahead of the refresh,
 * which follows every outcome 10.7 orders past the gate — where its
 * corruption is reported (13.3, 14.21) and an item id judged (12.0: "Two
 * usage-class checks run past the gate, each turning on a session's content,
 * where 10.7 orders them: an item ID, and a session's recorded baseline"; no
 * session of this scope records one). T13.5-8's held `review resolve` on the
 * failing workspace names an existing session, so it passes here and holds
 * ahead of the gate.
 */
function judgeSessionName(name) {
  return async (config) => {
    if (!sessionNameValid(name)) {
      throw new UsageError(
        `invalid session name ${JSON.stringify(name)} (SPEC 10.1, 12.0)`,
      );
    }
    if (!(await listSessionNames(config.root)).includes(name)) {
      throw new UsageError(`unknown session ${name} (SPEC 10.1, 12.0)`);
    }
  };
}

async function reviewResolve(io, cwd, { flags, positionals }) {
  const [name, itemId] = positionals;
  // `--status`'s vocabulary (10.7): of 12.0's syntax class, judged before
  // configuration is loaded and before acquisition and the hold — the flag
  // itself required by the synopsis (checkSynopsis), the session name's
  // form judged by checkValueSpellings.
  const status = flags["--status"];
  if (!RESOLVE_STATUSES.has(status)) {
    throw new UsageError(
      `--status accepts updated, no-change, and skipped; got ${String(status)} (SPEC 10.7, 12.0)`,
    );
  }
  return await runMutating(
    cwd,
    flags["--config"],
    flags["--test-hold"],
    async (config, { graph }, _discovery, refreshBeforeSessionWrite) => {
      // The outcomes 10.7 orders past the gate, in its order, each ending
      // the subcommand writing nothing (10.7: stale graph data stays stale):
      // the session read (its corruption, 14.21), the item check (an
      // unknown item ID, 12.0), and the refusal of a blocked item, judged
      // against the current workspace (10.3, 10.4).
      const session = await requireSession(config.root, name);
      const item = requireItem(session, itemId);
      const journal = await readJournal(config.root);
      if (isBlocked(item, session, graph, journal.entries)) {
        throw new RefusalError(
          `review resolve refused: item ${itemId} is blocked (SPEC 10.3, 10.7)`,
        );
      }
      // `resolve` replaces the item's status, note, and recorded state
      // (SPEC 10.7): the note is the `--note` text, an earlier note removed
      // when `--note` is not given.
      item.status = status;
      if (flags["--note"] === undefined) delete item.note;
      else item.note = flags["--note"];
      // An `updated` resolve re-derives the session first (SPEC 10.5), the
      // item, where still generated, taking the generated scope, context,
      // origin, and reason (rederive); then — for every resolve, against the
      // item as re-derived where it was — the item is assigned its current
      // context set as `context` and its relevant state is recorded, the
      // context nodes so recorded forming its recorded context set, which is
      // thus the context a read of the same workspace presents (10.4).
      if (status === "updated") {
        rederive(session, graph, journal);
      }
      assignCurrentContext(item, graph, journal);
      item.current = recordState(item, graph, journal.entries);
      archiveTexts(item, graph, journal);
      // Past all of them: the refresh of 13.3 where graph data is stale,
      // then the session file, once, last (SPEC 10.7, 13.5).
      await refreshBeforeSessionWrite();
      await writeSession(config.root, session);
      emitDoc(io, flags["--json"] === true, { ok: true }, [
        `review: resolved ${itemId} as ${status}`,
      ]);
      return 0;
    },
    {
      judgeArguments: judgeSessionName(name),
      judgeWorkspace: judgeGate,
      refreshesGraphData: true,
    },
  );
}

/**
 * Derive the session against the current workspace (SPEC 10.5's rules, which
 * hold for every strategy, over audit's generator, 10.6; auditDerivation) —
 * the derivation `create` makes of the empty session, and the re-derivation
 * an `updated` resolve triggers and every `split` ends with (10.5, 10.7).
 * The generator runs with the session's recorded decompositions applied, so
 * an item recorded as decomposed is never added back, its decomposition —
 * over the children its scope node has now — standing in its place. A
 * generated item whose kind and scope node match an existing item, the
 * existing item's scope mapped forward through the journal (10.4), is that
 * item: it keeps its `id`, status, note, and recorded state and takes the
 * generated scope, context, origin, and `reason` (adoptGenerated) — `split`'s
 * decomposition items among them (10.7) — so 10.4 alone, against the
 * recorded state, decides whether it then reads `invalidated`. Every other
 * generated item is added with current state (10.2), in generation order,
 * under the next item `id` (never one reused). `blockedBy` is recomputed for
 * every generated item, any reference to a decomposed item replaced by all
 * items of its decomposition; items no longer generated remain and keep their
 * fields, `blockedBy` included. Each generated item's present scope and
 * context nodes have their texts archived under the derivation's graph state
 * (archiveTexts; 10.7's provenance rule). Returns the session's item for each
 * generated key.
 */
function rederive(session, graph, journal) {
  const generated = auditDerivation(
    graph,
    decomposedIdentities(session, journal),
  );
  const existing = new Map();
  for (const item of session.items) {
    const mapped = mapIdentityForward(
      item.scopeRoot,
      journal.entries.slice(item.journalAt),
    );
    existing.set(itemKey(item.kind, mapped), item);
  }
  const produced = new Map();
  for (const [key, spec] of generated) {
    let item = existing.get(key);
    if (item === undefined) {
      item = {
        baseline: null,
        blockedBy: [],
        contextNodes: spec.contextNodes,
        current: null,
        id: `i${String(session.nextId)}`,
        journalAt: journal.lineCount,
        kind: spec.kind,
        originNodes: [],
        reason: spec.reason,
        scopeNodes: spec.scopeNodes,
        scopeRoot: spec.scopeRoot,
        status: "unresolved",
      };
      session.nextId += 1;
      // `baseline` is fixed as the item enters a session without a baseline
      // — the current graph at that moment — and `current` is recorded at
      // creation the same way (SPEC 10.2, 10.4).
      const recorded = recordState(item, graph, journal.entries);
      item.baseline = recorded;
      item.current = recorded;
      session.items.push(item);
    } else {
      adoptGenerated(item, spec, journal);
    }
    archiveTexts(item, graph, journal);
    produced.set(key, item);
  }
  for (const [key, spec] of generated) {
    produced.get(key).blockedBy = spec.blockers.map(
      (blocker) => produced.get(blocker).id,
    );
  }
  return produced;
}

/**
 * A kept item taking a generated item's scope, context, origin, and `reason`
 * (SPEC 10.5, 10.7) — the scope node it already has, under its current
 * identity — while keeping its `id`, status, note, and recorded state, as
 * every item a derivation matches does (rederive): its spellings move to the
 * current journal position, the fields it takes naming current identities,
 * and its `baseline`, `current`, and text archive keep theirs, each carrying
 * its own position (recordState, archiveTexts), so the move changes no
 * recorded node, presence, hash, or recorded context set (10.4: a context it
 * takes reads against the one recorded, as a resolve left it, and a node
 * joining it has no recorded presence until a resolve records it).
 */
function adoptGenerated(item, spec, journal) {
  item.journalAt = journal.lineCount;
  item.scopeRoot = spec.scopeRoot;
  item.scopeNodes = spec.scopeNodes;
  item.contextNodes = spec.contextNodes;
  item.originNodes = [];
  item.reason = spec.reason;
}

async function reviewSplit(io, cwd, { flags, positionals }) {
  const [name, itemId] = positionals;
  return await runMutating(
    cwd,
    flags["--config"],
    flags["--test-hold"],
    async (config, { graph }, _discovery, refreshBeforeSessionWrite) => {
      // The outcomes 10.7 orders past the gate, in its order, each ending
      // the subcommand writing nothing (10.7: stale graph data stays stale):
      // the session read (its corruption, 14.21), the item check (an
      // unknown item ID, 12.0), and the refusal of an item of another kind
      // or of one whose scope root has no children, judged against the
      // current workspace (10.5).
      const session = await requireSession(config.root, name);
      const original = requireItem(session, itemId);
      const journal = await readJournal(config.root);
      const suffix = journal.entries.slice(original.journalAt);
      const mappedScope = mapIdentityForward(original.scopeRoot, suffix);
      const scopeNode = graph.byIdentity.get(mappedScope);
      if (
        original.kind !== "subtree-coherence" ||
        scopeNode === undefined ||
        scopeNode.children.length === 0
      ) {
        throw new RefusalError(
          "review split refused: only a subtree-coherence item whose scope root has children can be split (SPEC 10.7)",
        );
      }
      // The decomposition (SPEC 10.7) — the original's kind and scope node,
      // under its current identity, with that spelling's journal position —
      // is recorded durably and governs the re-derivation `split` ends with
      // (10.5). The original leaves the session, its `id` never reused (the
      // next item `id` only grows).
      session.decompositions.push({
        journalAt: journal.lineCount,
        kind: original.kind,
        scope: mappedScope,
      });
      session.items = session.items.filter((item) => item !== original);
      // The decomposition's items: one `subtree-coherence` item per child
      // subtree the scope root has, each replaced by its own decomposition
      // where one is recorded — its items standing in for it, recursively —
      // plus the scope root's `parent-consistency` item (10.7; standInOf).
      const decomposition = standInOf(decomposedIdentities(session, journal))(
        scopeNode,
      );
      // The re-derivation `split` ends with (10.5, 10.7): it adds each item
      // of the decomposition not already in the session, with current
      // state; one that already exists is that item, keeping its `id`,
      // status, note, and recorded state and taking the decomposition's
      // scope, context, origin (empty in an audit session), and reason, as
      // every item the re-derivation matches takes the generated ones, so
      // `split` in an audit session reuses the children's existing items;
      // and it recomputes `blockedBy` for every generated item against the
      // current graph — a per-child item blocked by its child sections'
      // items (10.6), the `parent-consistency` item by the per-child items
      // or the items standing in for them, and each item the original
      // blocked by all items of the decomposition in its place — so blocking
      // stays acyclic (10.1). Items no longer generated keep their
      // `blockedBy` (10.5); any of them the original blocked becomes blocked
      // by all items of the decomposition (below).
      const produced = rederive(session, graph, journal);
      const decompositionIds = decomposition.map((key) => produced.get(key).id);
      for (const item of session.items) {
        if (item.blockedBy.includes(original.id)) {
          item.blockedBy = [
            ...item.blockedBy.filter((id) => id !== original.id),
            ...decompositionIds.filter((id) => !item.blockedBy.includes(id)),
          ];
        }
      }
      // Past all of them: the refresh of 13.3 where graph data is stale,
      // then the session file, once, last (SPEC 10.7, 13.5).
      await refreshBeforeSessionWrite();
      await writeSession(config.root, session);
      emitDoc(io, flags["--json"] === true, { ok: true }, [
        `review: split ${itemId} into ${String(decompositionIds.length)} items`,
      ]);
      return 0;
    },
    {
      judgeArguments: judgeSessionName(name),
      judgeWorkspace: judgeGate,
      refreshesGraphData: true,
    },
  );
}

async function reviewList(io, cwd, { flags }) {
  const config = await loadConfig(cwd, flags["--config"]);
  // 13.3: reads validate sources.
  await loadGraph(config.root, await discover(config));
  const sessions = [];
  let anyCorrupt = false;
  for (const name of await listSessionNames(config.root)) {
    const loaded = await loadSession(config.root, name);
    if (loaded.state !== "ok") {
      sessions.push({ corrupt: true, name });
      anyCorrupt = true;
      continue;
    }
    // Counts from stored statuses, without read-time invalidation (10.7).
    const counts = {
      invalidated: 0,
      "no-change": 0,
      skipped: 0,
      unresolved: 0,
      updated: 0,
    };
    for (const item of loaded.session.items) counts[item.status] += 1;
    sessions.push({
      corrupt: false,
      counts,
      name,
      strategy: loaded.session.strategy,
    });
  }
  const doc = { sessions };
  emitDoc(
    io,
    flags["--json"] === true,
    doc,
    sessions.map((entry) =>
      entry.corrupt
        ? `${entry.name}: corrupt`
        : `${entry.name}: ${entry.strategy}`,
    ),
  );
  return anyCorrupt ? 1 : 0;
}

async function reviewStatus(io, cwd, { flags, positionals }) {
  const { config, graph } = await loadGatedRead(
    cwd,
    flags,
    judgeSessionName(positionals[0]),
  );
  const session = await requireSession(config.root, positionals[0]);
  const journal = await readJournal(config.root);
  return await withReadInvalidationPersistence(config.root, session, () => {
    const totals = {
      invalidated: 0,
      "no-change": 0,
      skipped: 0,
      unresolved: 0,
      updated: 0,
    };
    const rows = orderedItems(session, graph, journal.entries).map(
      ({ item, mappedScope }) => {
        const status = effectiveStatus(item, graph, journal.entries);
        totals[status] += 1;
        return {
          blocked: isBlocked(item, session, graph, journal.entries),
          id: item.id,
          kind: item.kind,
          scope: mappedScope,
          status,
        };
      },
    );
    const doc = { items: rows, totals };
    emitDoc(
      io,
      flags["--json"] === true,
      doc,
      rows.map(
        (row) =>
          `${row.id} ${row.kind} ${row.scope} ${row.status}${row.blocked ? " (blocked)" : ""}`,
      ),
    );
    return 0;
  });
}

async function reviewNext(io, cwd, { flags, positionals }) {
  const { config, graph } = await loadGatedRead(
    cwd,
    flags,
    judgeSessionName(positionals[0]),
  );
  const session = await requireSession(config.root, positionals[0]);
  const journal = await readJournal(config.root);
  return await withReadInvalidationPersistence(config.root, session, () => {
    const next = orderedItems(session, graph, journal.entries).find(
      ({ item }) => {
        const status = effectiveStatus(item, graph, journal.entries);
        return (
          (status === "unresolved" || status === "invalidated") &&
          !isBlocked(item, session, graph, journal.entries)
        );
      },
    );
    const doc =
      next === undefined
        ? { fullyResolved: true }
        : {
            fullyResolved: false,
            item: itemPayload(next.item, session, graph, journal.entries),
          };
    emitDoc(io, flags["--json"] === true, doc, [
      next === undefined
        ? "review: fully resolved"
        : `review: next is ${next.item.id}`,
      ...(next === undefined ? [] : [canonicalJson(doc)]),
    ]);
    return 0;
  });
}

async function reviewShow(io, cwd, { flags, positionals }) {
  const { config, graph } = await loadGatedRead(
    cwd,
    flags,
    judgeSessionName(positionals[0]),
  );
  const session = await requireSession(config.root, positionals[0]);
  const item = requireItem(session, positionals[1]);
  const journal = await readJournal(config.root);
  return await withReadInvalidationPersistence(config.root, session, () => {
    const doc = itemPayload(item, session, graph, journal.entries);
    emitDoc(io, flags["--json"] === true, doc, [canonicalJson(doc)]);
    return 0;
  });
}

async function reviewExport(io, cwd, { flags, positionals }) {
  const { config, graph } = await loadGatedRead(
    cwd,
    flags,
    judgeSessionName(positionals[0]),
  );
  const session = await requireSession(config.root, positionals[0]);
  const journal = await readJournal(config.root);
  return await withReadInvalidationPersistence(config.root, session, () => {
    // A single JSON document is export's only output form (SPEC 10.7), the
    // recorded decompositions among its contents, each scope node under its
    // current identity (10.4).
    emitJsonOnly(io, {
      creationParameters: null,
      decompositions: session.decompositions.map((entry) => ({
        kind: entry.kind,
        scope: mapIdentityForward(
          entry.scope,
          journal.entries.slice(entry.journalAt),
        ),
      })),
      items: orderedItems(session, graph, journal.entries).map(({ item }) =>
        itemPayload(item, session, graph, journal.entries),
      ),
      name: session.name,
      strategy: session.strategy,
    });
    return 0;
  });
}

/**
 * `review`'s subcommands (SPEC 10.7), the subcommand and its operands read
 * under 12.0's grammar by dispatchCommand.
 */
async function commandReview(io, cwd, sub, args) {
  switch (sub) {
    case "create":
      return await reviewCreate(io, cwd, args);
    case "resolve":
      return await reviewResolve(io, cwd, args);
    case "split":
      return await reviewSplit(io, cwd, args);
    case "list":
      return await reviewList(io, cwd, args);
    case "status":
      return await reviewStatus(io, cwd, args);
    case "next":
      return await reviewNext(io, cwd, args);
    case "show":
      return await reviewShow(io, cwd, args);
    case "export":
      return await reviewExport(io, cwd, args);
    default:
      throw new Error(`no handler for the review subcommand ${sub}`);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Deviation switches active for this invocation (CERTIFICATIONS.md
 * VIOL-CORE-* violators and VIOL-RACE-LISTFIRST). Set once per invocation by
 * runXspec from its `options` argument; with no switch set, every code path
 * behaves as the conformer. Module state is safe here: each bin*.mjs entry
 * runs exactly one invocation per process.
 *
 * - `noMutualExclusion` (VIOL-CORE-NOLOCK): a live run's entry does not
 *   refuse acquisition — acquisition adds its entry and lists the lock
 *   directory, leaves every entry whose recorded identifier the process
 *   list lists in place, unaltered, removes the other leftovers, and
 *   acquires, so mutating commands never exclude one another; see
 *   judgeLockDirectory.
 * - `lateHold` (VIOL-CORE-LATEHOLD): the hold seam engages late — a
 *   mutating command acquires exclusivity where 13.5 places it, but creates
 *   its hold file only once its second discovery and then the unknown and
 *   wrong-kind names and files of the usage class and baseline resolution,
 *   its journal read included (12.0, 6.3), have passed, instead of
 *   immediately after acquiring; the
 *   gate and refresh of 13.3, the item check, the valid-workspace
 *   precondition of rename/move (6.4, 6.5), and every modification still
 *   follow the hold; an invocation those checks refuse exits 2 having
 *   acquired and released but created no hold file; see runMutating.
 * - `writesBeforeHold` (VIOL-CORE-EARLYWRITE): a mutating command performs
 *   its workspace modifications before creating the hold file; see
 *   runMutating.
 * - `refreshBeforeExclusivity` (VIOL-CORE-EARLYREFRESH): the 13.3 refresh a
 *   mutating `review` subcommand performs on a stale workspace runs before
 *   workspace exclusivity is acquired, so stale graph data is rewritten
 *   before the hold file is created — wherever the run's later checks,
 *   judged on the workspace as it stands then, let it reach its session
 *   write; a run they turn back refreshes nothing, early or late, as the
 *   conformer's does (10.7); the hold file is still created after
 *   exclusivity and before every other write; see runMutating and
 *   foreseeSessionWrite.
 * - `staleLockBlocks` (VIOL-CORE-STALELOCK): abnormal termination does not
 *   end exclusivity — any entry in the conformer's entry form refuses
 *   acquisition by its presence alone, whatever identifier its name
 *   records, so a killed run's entry refuses every later mutating command
 *   while it stands; leftovers that are no entry are still removed, and
 *   release is unchanged; see judgeLockDirectory.
 * - `partialDerivedWrites` (VIOL-CORE-PARTIALWRITE): derived-file writes
 *   expose a sustained strict-prefix interval before the complete content
 *   appears; durable files are unaffected; see regenerate.
 * - `chattyReads` (VIOL-CORE-CHATTYREADS): `check` modifies the journal —
 *   each `check` invocation that is not refused as a usage or configuration
 *   error (exit 2) appends one fixed line to `.xspec/journal`, creating the
 *   file when absent (checkInvocation); `build`, every other read command,
 *   mutating commands, and the entries `rename`/`move` append are
 *   unchanged; see runXspec.
 * - `persistReadInvalidation` (VIOL-CORE-PERSISTREADS): review reads persist
 *   read-time invalidation — when `status`, `next`, `show`, or `export`
 *   computes that a resolved item's recorded state differs from the current
 *   graph (SPEC 10.4), it rewrites that item's stored status to
 *   `invalidated` in the session file; reads over sessions with no stale
 *   resolution write nothing (`review list` computes no invalidation and is
 *   unchanged, as are the mutating subcommands); see
 *   withReadInvalidationPersistence.
 * - `holdThroughLink` (VIOL-CORE-HOLDLINK): hold-file creation follows a
 *   symbolic link at the hold path — occupancy judged through the link, so
 *   a dangling link reads as nothing there and the empty hold file is
 *   created at the link's target, the run proceeding only once the hold
 *   path, judged through the link, holds nothing; a link to an existing
 *   file or directory reads as occupied, failing with the conformer's usage
 *   error; see holdAtSeam.
 * - `releaseAtHold` (VIOL-CORE-EARLYRELEASE): a run releases at its hold
 *   point instead of as it ends — once its hold is lifted, or, without the
 *   seam, straight after acquiring — then dwells for a sustained interval
 *   and proceeds with the rest of the command outside exclusivity,
 *   releasing nothing further; see runMutating.
 * - `readersAddEntries` (VIOL-CORE-READERENTRY): while a directory — never a
 *   symbolic link to one — occupies the lock path, `build` and the read
 *   commands each add to it an entry of their own, in this conformer's
 *   entry form recording the reader's own process identifier, and leave it
 *   there as they end; they list no lock directory, judge no entry, and are
 *   refused by none; see addReaderEntry.
 * - `buildWaitsForHolders` (VIOL-CORE-BUILDWAIT): `build` waits out other
 *   runs' exclusivity — once its configuration is loaded and its sources
 *   discovered, while a directory occupies the lock path and its listing
 *   holds an entry of another run alive on this machine (judged as
 *   acquisition judges one), it lists again at a polling interval, and
 *   proceeds as the conformer does once none stands; anything else at the
 *   lock path, nothing there, and a refused listing hold it back from
 *   nothing; it writes nothing at the lock path, and the read commands are
 *   unchanged; see awaitNoLiveHolder.
 * - `listBeforeEntry` (VIOL-RACE-LISTFIRST, the CONF-RACE conformer's one
 *   violator — that conformer runs this module deviation-free from
 *   `../conf-race/bin.mjs`): acquisition judges the lock directory before
 *   adding its entry — it lists the lock directory (a missing area or lock
 *   directory holding nothing), is refused by another live run's entry
 *   there as the conformer is, and otherwise, after a sustained interval,
 *   adds its entry, removes the leftovers its listing found, and acquires,
 *   never listing again; see acquireListingFirst.
 * - `readersHoldClaims` (VIOL-READERS-CLAIM, the CONF-READERS conformer's
 *   one violator — that conformer runs this module deviation-free from
 *   `../conf-readers/bin.mjs`): `build` and the read commands each hold a
 *   claim while they run — having located the configuration file, each
 *   adds an entry of its own in this conformer's entry form (the area's
 *   directory and the lock directory brought into existence where absent,
 *   nothing added where either path holds anything else), dwells for a
 *   sustained interval, proceeds as the conformer does, and as it ends
 *   deletes the entry, the emptied lock directory, and an emptied area
 *   directory it created; acquisition judges a reader's entry as any run's,
 *   a live reader's refusing it (14.26); see holdReaderClaim.
 * - `followLinksAtRemoval` (VIOL-LEFTOVER-FOLLOWLINK, one of the
 *   CONF-LEFTOVER conformer's three violators — that conformer runs this
 *   module deviation-free from `../conf-leftover/bin.mjs`): acquisition's
 *   removal of a leftover symbolic link to a directory, at any depth,
 *   follows the link — everything the targeted directory holds removed
 *   through it, at every depth, then the link itself, the targeted
 *   directory left in place, empty; see removeLeftover.
 * - `hideDotNames` (VIOL-LEFTOVER-DOTNAMES, CONF-LEFTOVER's): acquisition's
 *   listings — of the lock directory and of each directory it removes —
 *   hide names beginning with `.`, so a leftover so named is never removed;
 *   see listNames.
 * - `namesAsText` (VIOL-LEFTOVER-BYTENAMES, CONF-LEFTOVER's): acquisition's
 *   listings decode names as UTF-8 text (U+FFFD for each ill-formed
 *   sequence) and its examinations and removals address each leftover by
 *   its decoded name, so a leftover whose name is not valid UTF-8 is never
 *   removed; see listNames.
 */
let deviations = {};

/**
 * Whether this invocation is `build` or a read command
 * (isBuildOrReadInvocation), set once by runXspec before dispatch (module
 * state; each bin*.mjs entry runs exactly one invocation per process).
 * Consumed only by the VIOL-CORE-READERENTRY and VIOL-READERS-CLAIM
 * deviations in loadConfig.
 */
let buildOrReadInvocation = false;

/**
 * Whether this invocation is `check` — its command word, the first non-flag
 * token of the invocation read under 12.0's grammar (readInvocation's
 * `words`), exactly as dispatchCommand identifies it — set once by runXspec
 * before dispatch (module state; each bin*.mjs entry runs exactly one
 * invocation per process). Consumed only by the VIOL-CORE-CHATTYREADS
 * deviation in runXspec, which deviates on `check` alone (CERTIFICATIONS.md:
 * `build`, every other read command, and the mutating commands are
 * unchanged under it).
 */
let checkInvocation = false;

/**
 * The invocations VIOL-CORE-READERENTRY and VIOL-READERS-CLAIM
 * (CERTIFICATIONS.md) deviate on — `build` and the read commands of SPEC
 * 13.3 (for `review`, exactly the read subcommands; the mutating
 * `create`/`resolve`/`split` are unchanged, as are `rename` and `move` and
 * their previews). The command and subcommand are the first two non-flag
 * tokens of the invocation read under 12.0's grammar (readInvocation's
 * `words`), exactly as dispatchCommand identifies them, so no switch reads
 * anything of argv beyond what the conformer reads.
 */
const BUILD_AND_READ_COMMANDS = new Set([
  "build",
  "check",
  "ids",
  "show",
  "query",
  "coverage",
  "impact",
]);
const REVIEW_READ_SUBCOMMANDS = new Set([
  "list",
  "status",
  "next",
  "show",
  "export",
]);

function isBuildOrReadInvocation(words) {
  const [command, subcommand] = words;
  if (BUILD_AND_READ_COMMANDS.has(command)) return true;
  return command === "review" && REVIEW_READ_SUBCOMMANDS.has(subcommand);
}

/**
 * VIOL-CORE-READERENTRY (CERTIFICATIONS.md, `readersAddEntries`): `build` or
 * a read command, once its configuration is located and loaded — the
 * workspace root known (loadConfig) — adds an entry of its own to the lock
 * directory where a directory, never a symbolic link to one, occupies the
 * lock path (the area's own path a directory too, so the write traverses no
 * link): an empty plain file named in this conformer's entry form
 * (newEntryName: the reader's own process identifier and random digits),
 * created exclusively, and left there as the reader ends — a dead run's
 * leftover once the reader has exited, which a mutating command's
 * acquisition removes as any leftover, though one meeting the reader still
 * running refuses on its entry as on any live run's (judgeLockDirectory,
 * unchanged). The reader lists no lock directory, judges no entry, and is
 * refused by none: where nothing, or anything but a directory, is at the
 * lock path, or the environment refuses the creation, it adds nothing and
 * proceeds as the conformer does. At most one entry per invocation.
 */
let readerEntryAdded = false;

async function addReaderEntry(root) {
  if (readerEntryAdded) return;
  readerEntryAdded = true;
  try {
    const area = await fsp.lstat(path.join(root, AREA_REL));
    if (!area.isDirectory()) return;
    const lockAbs = path.join(root, LOCK_REL);
    const lock = await fsp.lstat(lockAbs);
    if (!lock.isDirectory()) return;
    const handle = await fsp.open(path.join(lockAbs, newEntryName()), "wx");
    await handle.close();
  } catch {
    // Nothing at the lock path, or a creation the environment refused: the
    // reader adds nothing (the deviation's own precondition).
  }
}

/**
 * VIOL-READERS-CLAIM (CERTIFICATIONS.md, `readersHoldClaims`): the sustained
 * interval a reader's claim stands before the reader proceeds — long
 * relative to the span from a reader's start to the acquisition of a
 * mutating command started once that reader is confirmed running (65–92 ms
 * measured on an idle 4-core machine, the held command's hold file bounding
 * its acquisition), yet far short of every hang guard a run it lengthens
 * meets (S-3; the driver's 30 s default, P-10's included).
 */
const READER_CLAIM_DWELL_MS = 3000;

/** The claim this invocation holds, once added; null where none stands. */
let readerClaim = null;
let readerClaimTried = false;

/**
 * VIOL-READERS-CLAIM (CERTIFICATIONS.md, `readersHoldClaims`): `build` or a
 * read command, having located its configuration file (loadConfig, before
 * reading it), adds to the lock directory an entry of its own — an empty
 * plain file named in this conformer's entry form (newEntryName: the
 * reader's own process identifier and random digits), created exclusively —
 * where the area's own path and the lock path each hold a directory or
 * nothing, the area's directory and the lock directory brought into
 * existence where absent, as acquisition brings them (SPEC 13.5); where
 * either holds anything else, or the environment refuses an examination or
 * a creation, it adds nothing (and removes a directory it created for the
 * claim). A concurrent creation or deletion moving a path under it is
 * examined afresh, bounded as acquisition is. It then dwells for
 * READER_CLAIM_DWELL_MS and proceeds as the conformer does; as it ends,
 * releaseReaderClaim deletes the claim as release deletes an entry. The
 * reader lists no lock directory, judges no entry, removes no leftover, and
 * is refused by none; acquisition judges its entry as any run's — one whose
 * reader is alive refuses (14.26; judgeLockDirectory, unchanged).
 */
async function holdReaderClaim(root) {
  if (readerClaimTried) return;
  readerClaimTried = true;
  const areaAbs = path.join(root, AREA_REL);
  const lockAbs = path.join(root, LOCK_REL);
  let createdArea = false;
  let createdLock = false;
  const undo = async () => {
    if (createdLock) await deleteQuietly(() => fsp.rmdir(lockAbs));
    if (createdArea) await deleteQuietly(() => fsp.rmdir(areaAbs));
  };
  try {
    for (let attempt = 1; attempt <= ACQUISITION_ATTEMPTS; attempt += 1) {
      const area = await occupantKind(areaAbs);
      if (area === "absent") {
        try {
          await fsp.mkdir(areaAbs);
          createdArea = true;
        } catch (error) {
          if (RACED_CREATION.has(error?.code)) continue;
          throw error;
        }
      } else if (area !== "directory") {
        break;
      }
      const lock = await occupantKind(lockAbs);
      if (lock === "absent") {
        try {
          await fsp.mkdir(lockAbs);
          createdLock = true;
        } catch (error) {
          if (RACED_CREATION.has(error?.code)) continue;
          throw error;
        }
      } else if (lock !== "directory") {
        break;
      }
      const entryAbs = path.join(lockAbs, newEntryName());
      try {
        const handle = await fsp.open(entryAbs, "wx");
        await handle.close();
      } catch (error) {
        if (RACED_CREATION.has(error?.code)) {
          createdLock = false;
          continue;
        }
        throw error;
      }
      readerClaim = { entryAbs, lockAbs, areaAbs, createdArea };
      break;
    }
  } catch {
    // An examination or a creation the environment refused: no claim.
  }
  if (readerClaim === null) await undo();
  await sleep(READER_CLAIM_DWELL_MS);
}

/**
 * VIOL-READERS-CLAIM: as the reader ends (runXspec, every normal end), its
 * claim is released as release deletes an entry (SPEC 13.5): the entry,
 * then the lock directory where it then holds nothing else, then the
 * area's directory where the claim brought it into existence and it then
 * holds nothing else — each deletion refused or finding nothing changing
 * no outcome. A reader killed leaves its entry, a dead run's leftover.
 */
async function releaseReaderClaim() {
  const claim = readerClaim;
  if (claim === null) return;
  readerClaim = null;
  await deleteQuietly(() => fsp.unlink(claim.entryAbs));
  await deleteQuietly(() => fsp.rmdir(claim.lockAbs));
  if (claim.createdArea) await deleteQuietly(() => fsp.rmdir(claim.areaAbs));
}

/**
 * VIOL-CORE-BUILDWAIT (CERTIFICATIONS.md, `buildWaitsForHolders`): `build`,
 * its configuration loaded and its sources discovered — where a mutating
 * command acquires (SPEC 13.5; commandBuild, between discover and
 * loadGraph) — waits out
 * other runs' exclusivity: while a live holder stands (liveHolderStands) it
 * looks again every BUILD_WAIT_POLL_MS, and once none stands it proceeds as
 * the conformer does. It adds no entry, removes nothing, writes nothing at
 * the lock path (SPEC 13.4), and is refused by nothing.
 */
const BUILD_WAIT_POLL_MS = 50;

async function awaitNoLiveHolder(root) {
  while (await liveHolderStands(root)) await sleep(BUILD_WAIT_POLL_MS);
}

/**
 * Whether, for VIOL-CORE-BUILDWAIT's `build`, a live holder stands: a
 * directory — never a symbolic link to one — occupies the lock path (the
 * area's own path a directory too, as acquisition requires), and its
 * listing holds an entry of another run alive on this machine: a plain file
 * whose name records, in this conformer's entry form, an identifier other
 * than this process's own that its process list lists — judged as
 * acquisition judges one (judgeLockDirectory: recordedIdentifier,
 * processListJudge). Anything else at the lock path or nothing there, and a
 * listing or examination the environment refuses, mean none stands.
 */
async function liveHolderStands(root) {
  const lockAbs = path.join(root, LOCK_REL);
  try {
    if ((await occupantKind(path.join(root, AREA_REL))) !== "directory") {
      return false;
    }
    if ((await occupantKind(lockAbs)) !== "directory") return false;
    const lockBytes = Buffer.from(lockAbs);
    const names = await fsp.readdir(lockBytes, { encoding: "buffer" });
    let listed = null;
    for (const name of names) {
      const identifier = recordedIdentifier(name);
      if (identifier === null || identifier === process.pid) continue;
      if ((await occupantKind(childPath(lockBytes, name))) !== "file") continue;
      listed ??= await processListJudge();
      if (listed(identifier)) return true;
    }
    return false;
  } catch {
    // A listing or examination the environment refused: nothing holds
    // `build` back (the deviation's own precondition).
    return false;
  }
}

/**
 * VIOL-CORE-CHATTYREADS (CERTIFICATIONS.md): the one fixed line a `check`
 * appends, through appendJournal exactly as real entries are (canonicalJson
 * of this object — fixed bytes every time, so T6.1-2-style determinism
 * holds). Deliberately well-formed under this fixture's own journal reader —
 * a rename entry whose empty path/from/to can never match an identity (every
 * identity is `<rel>#<id>` with a non-empty file part), so it maps nothing —
 * keeping every journal consumer (`check`'s 14.13 integrity scan, identity
 * mapping, review reads) behaving exactly as the conformer, graph data and
 * every other derived byte independent of how many such lines the journal
 * holds (13.4): only the journal's bytes deviate, which is the deviation.
 * The journal's one validation (journalFindings, 14.13) — made by `check`,
 * `build`, the gate of 13.3, the precondition of `rename`/`move`, and a
 * given baseline's resolution — must keep reading the line so, neither an
 * identity mapping (5.4) nor a malformed entry (14.13), or the violator's
 * passing sides break (CERTIFICATIONS.md §VIOL-CORE-CHATTYREADS: no later
 * command is gated by it, 13.3).
 */
const CHATTY_READ_ENTRY = {
  deviation: "VIOL-CORE-CHATTYREADS",
  from: "",
  kind: "rename",
  path: "",
  to: "",
};

/**
 * Run one xspec invocation. Returns the exit code (SPEC 12.0 partition).
 * `io` writes the streams; `options` is the seam through which each violator
 * fixture's bin-<name>.mjs entry threads exactly one deviation switch (the
 * conformer's bin.mjs passes none).
 */
export async function runXspec(argv, cwd, options = {}) {
  deviations = options;
  const io = {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
  };
  const invocation = readInvocation(argv);
  buildOrReadInvocation = isBuildOrReadInvocation(invocation.words);
  checkInvocation = invocation.words[0] === "check";
  const code = await dispatchCommand(io, cwd, invocation);
  // VIOL-READERS-CLAIM (CERTIFICATIONS.md): a reader's claim, where one
  // stands, is released as the reader ends — every normal end, since
  // dispatchCommand returns from every outcome (holdReaderClaim).
  await releaseReaderClaim();
  if (deviations.chattyReads && checkInvocation && (code === 0 || code === 1)) {
    // VIOL-CORE-CHATTYREADS (CERTIFICATIONS.md): `check` alone appends —
    // `build`, every other read command, and the mutating commands append
    // nothing under this switch — after its own work, a clean report (exit
    // 0) and a findings report (exit 1) alike, against the root it actually
    // resolved (set by loadConfig on every path that reaches either outcome;
    // the null guard covers only would-be fixture bugs). A `check` refused
    // as a usage or configuration error (exit 2) appends nothing — e.g. an
    // unknown flag, `--test-hold` among them (12.0, 13.5), an extra
    // operand, or an invalid configuration — and neither does a fixture
    // scope error or crash (exit 70), outside the 12.0 partition.
    if (lastResolvedRoot !== null) {
      await appendJournal(lastResolvedRoot, CHATTY_READ_ENTRY);
    }
  }
  return code;
}

/**
 * Dispatch one invocation read under the grammar of SPEC 12.0
 * (readInvocation) and map its outcome to 12.0's codes. Every syntax-class
 * error is decided from the arguments alone, before configuration is loaded
 * and before any acquisition or hold (12.0, 13.5): first the checks the
 * arguments decide for every command alike — unknown, repeated, or
 * valueless flags and malformed values (readInvocation) — then the command
 * and the subcommand of `query` or `review`, then the synopsis
 * (checkSynopsis) and the value spellings (checkValueSpellings); only then
 * is anything refused as outside this fixture's scope (exit 70).
 */
async function dispatchCommand(io, cwd, invocation) {
  const [command, ...operands] = invocation.words;
  // JSON output is in effect when a `--json` token is read as a flag — not
  // as another flag's value — or when the invoked surface is JSON-only
  // (SPEC 12.0): `query` and `review export` among the served ones (11,
  // 10.7), so their every answer, gated report (13.3), and usage error is
  // JSON, with or without `--json`. It governs error delivery even when the
  // arguments are themselves the error.
  const jsonInEffect = invocation.json || isJsonOnlySurface(invocation.words);
  try {
    if (invocation.error !== null) throw new UsageError(invocation.error);
    if (command === undefined) {
      throw new UsageError("expected a command (SPEC 12.0)");
    }
    if (!PRODUCT_COMMANDS.has(command)) {
      throw new UsageError(`unknown command ${command} (SPEC 12.0)`);
    }
    let spelled = command;
    let synopsis = SYNOPSES.get(command);
    let subcommand;
    let rest = operands;
    const subcommands =
      command === "query"
        ? QUERY_SYNOPSES
        : command === "review"
          ? REVIEW_SYNOPSES
          : undefined;
    if (subcommands !== undefined) {
      [subcommand, ...rest] = operands;
      if (subcommand === undefined) {
        throw new UsageError(`${command}: missing subcommand (SPEC 12.0)`);
      }
      synopsis = subcommands.get(subcommand);
      if (synopsis === undefined) {
        throw new UsageError(
          `${command}: unknown subcommand ${subcommand} (SPEC ${command === "query" ? "11.1" : "10.7"}, 12.0)`,
        );
      }
      spelled = `${command} ${subcommand}`;
    } else if (synopsis === undefined) {
      throw new FixtureScopeError(
        `the ${command} command is outside this fixture's certified surface (§CONF-CORE)`,
      );
    }
    checkSynopsis(spelled, synopsis, invocation.flags, rest);
    checkValueSpellings(spelled, invocation.flags, rest);
    refuseUnservedFlags(spelled, synopsis, invocation.flags);
    const args = {
      flags: Object.fromEntries(invocation.flags),
      positionals: rest,
    };
    switch (command) {
      case "build":
        return await commandBuild(io, cwd, args);
      case "check":
        return await commandCheck(io, cwd, args);
      case "ids":
        return await commandIds(io, cwd, args);
      case "show":
        return await commandShow(io, cwd, args);
      case "query":
        return await commandQuery(io, cwd, subcommand, args);
      case "coverage":
        return await commandCoverage(io, cwd, args);
      case "impact":
        return await commandImpact(io, cwd, args);
      case "rename":
        return await commandRename(io, cwd, args);
      case "move":
        return await commandMove(io, cwd, args);
      case "review":
        return await commandReview(io, cwd, subcommand, args);
      default:
        throw new Error(`no handler for the served command ${command}`);
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
    if (error instanceof RefusalError) {
      // Refused operations are exit-1 findings outcomes (SPEC 12.0); the
      // refusal report is stdout content, with no pinned wording.
      if (jsonInEffect) {
        io.stdout(canonicalJson({ refused: error.message }) + "\n");
      } else {
        io.stdout(`${error.message}\n`);
      }
      return 1;
    }
    if (error instanceof FixtureScopeError) {
      // Outside this fixture's scope (CERTIFICATIONS.md §CONF-CORE): refused
      // loudly, outside the 12.0 partition — never answered, never
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
