// CERTIFICATIONS.md fixture products: the fixture manifest (TEST-SPEC 17
// C-1, C-2). Each fixture is a harness-owned executable under test/fixtures/,
// driven by the certification runner through the identical ProductBinding
// shape as the built product — an executable/workspace binding and nothing
// else (C-2), so certifying and testing use one code path and fixtures are
// invocable in CI without network or a build step (plain Node ESM programs).
//
// CERTIFICATION_FIXTURES lists every CERTIFICATIONS.md fixture in document
// order: each conformer with its in-scope test IDs and each violator with the
// IDs it certifies, verbatim from the document. The whole-document C-1 gate
// (certification-document.test.ts) asserts this manifest equals the parsed
// document, and every per-fixture verification (certification.test.ts) is
// generated from it — so a fixture entering the document without wiring here,
// or wired here without being exercised, fails loudly instead of letting
// certification pass while silently covering less.

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProductBinding } from "../helpers/subprocess.js";

const fixturesRoot = path.resolve(
  fileURLToPath(new URL("../fixtures", import.meta.url)),
);

/** Binding for a plain-Node fixture executable under test/fixtures/. */
function nodeFixtureBinding(label: string, relBin: string): ProductBinding {
  const bin = path.join(fixturesRoot, relBin);
  return {
    label,
    command: process.execPath,
    prefixArgs: [bin],
    requiredFiles: [bin],
  };
}

/**
 * One CERTIFICATIONS.md violator: its conformer plus exactly one specified
 * behavioral deviation.
 */
export interface CertificationViolator {
  /** The document's `### VIOL-…` heading name. */
  readonly name: string;
  /** Fresh C-2 binding for the violator's executable. */
  readonly binding: () => ProductBinding;
  /** The tests the violator certifies, verbatim from CERTIFICATIONS.md. */
  readonly certifies: readonly string[];
}

/** One CERTIFICATIONS.md conformer entry with its violators. */
export interface CertificationConformer {
  /** The document's `## CONF-…` heading name. */
  readonly name: string;
  /** Fresh C-2 binding for the conformer's executable. */
  readonly binding: () => ProductBinding;
  /** The entry's in-scope tests, verbatim from CERTIFICATIONS.md. */
  readonly inScope: readonly string[];
  /** The conformer's violators, in document order. */
  readonly violators: readonly CertificationViolator[];
}

function conformer(
  name: string,
  relBin: string,
  inScope: readonly string[],
  violators: readonly CertificationViolator[],
): CertificationConformer {
  return {
    name,
    binding: () => nodeFixtureBinding(`${name} conformer`, relBin),
    inScope,
    violators,
  };
}

function violator(
  name: string,
  relBin: string,
  certifies: readonly string[],
): CertificationViolator {
  return {
    name,
    binding: () => nodeFixtureBinding(`${name} violator`, relBin),
    certifies,
  };
}

/**
 * Every CERTIFICATIONS.md fixture, in document order (C-1: "for each fixture
 * in specs/CERTIFICATIONS.md"). Deviation summaries are inlined per violator;
 * the document's entries are authoritative.
 */
export const CERTIFICATION_FIXTURES: readonly CertificationConformer[] = [
  // CONF-CORE (§CONF-CORE): operational core — exclusion seam, journal,
  // durable files, review reads.
  conformer(
    "CONF-CORE",
    "conf-core/bin.mjs",
    [
      "T6.1-2",
      "T10.4-5",
      "T13.4-5",
      "T13.5-1",
      "T13.5-2",
      "T13.5-3",
      "T13.5-4",
      "T13.5-5",
    ],
    [
      // VIOL-CORE-NOLOCK: mutating commands do not exclude one another — the
      // hold file is still created before any modification and honored, but
      // a second mutating command started while another runs or is held
      // proceeds normally instead of failing with the usage error of SPEC
      // 13.5/12.0.
      violator("VIOL-CORE-NOLOCK", "conf-core/bin-nolock.mjs", ["T13.5-2"]),
      // VIOL-CORE-EARLYWRITE: a mutating command performs its workspace
      // modifications before creating the hold file — it acquires
      // exclusivity, completes the operation's writes (journal append
      // included), then creates the hold file, waits for its deletion, and
      // exits normally.
      violator("VIOL-CORE-EARLYWRITE", "conf-core/bin-earlywrite.mjs", [
        "T13.5-1",
        "T13.5-4",
      ]),
      // VIOL-CORE-EARLYREFRESH: the 13.3 refresh a mutating `review`
      // subcommand performs on a stale workspace runs before workspace
      // exclusivity is acquired, so stale graph data is rewritten before the
      // hold file is created — one ordering rule of 13.5 (the hold precedes
      // every modification, the refresh included) broken for the refresh
      // alone; the hold file is still created after exclusivity and before
      // every other write, and a workspace whose graph data is current is
      // refreshed by nothing.
      violator("VIOL-CORE-EARLYREFRESH", "conf-core/bin-earlyrefresh.mjs", [
        "T13.5-1",
      ]),
      // VIOL-CORE-STALELOCK: workspace exclusivity is not released by
      // abnormal termination — after a mutating command's process is killed,
      // every later mutating command in that workspace is refused with the
      // usage error of SPEC 13.5/12.0. Normal completion still releases.
      violator("VIOL-CORE-STALELOCK", "conf-core/bin-stalelock.mjs", [
        "T13.5-3",
      ]),
      // VIOL-CORE-PARTIALWRITE: derived-file writes are not atomic in their
      // observable effect — while a derived file is being written, its path
      // holds a strict prefix of the new content for a sustained interval
      // (long relative to a concurrent reader's polling cadence) before the
      // complete content appears. Durable files are unaffected.
      violator("VIOL-CORE-PARTIALWRITE", "conf-core/bin-partialwrite.mjs", [
        "T13.5-5",
      ]),
      // VIOL-CORE-CHATTYREADS: `build` and the read commands modify the
      // journal — each such invocation that is not refused as a usage or
      // configuration error (exit 2) appends one fixed line to
      // `.xspec/journal`, creating the file when absent. Mutating commands,
      // and the entries `rename`/`move` append, are unchanged.
      violator("VIOL-CORE-CHATTYREADS", "conf-core/bin-chattyreads.mjs", [
        "T13.4-5",
      ]),
      // VIOL-CORE-PERSISTREADS: review reads persist read-time invalidation —
      // when `status`, `next`, `show`, or `export` computes that a resolved
      // item's recorded state differs from the current graph (SPEC 10.4), it
      // rewrites that item's stored status to `invalidated` in the session
      // file. Reads over sessions with no stale resolution write nothing.
      violator("VIOL-CORE-PERSISTREADS", "conf-core/bin-persistreads.mjs", [
        "T10.4-5",
      ]),
    ],
  ),
  // CONF-VALID (§CONF-VALID): segment and tag validity — `build` with the
  // 14.1–14.4 error reporting and `query node`/`query nodes` reporting
  // identity, tags, and metadataHash, over `.mdx` workspaces whose sections
  // carry `id`/`tags` props.
  conformer(
    "CONF-VALID",
    "conf-valid/bin.mjs",
    [
      "T1.3-1",
      "T1.3-2",
      "T1.3-3",
      "T1.3-4",
      "T1.3-5",
      "T1.3-6",
      "T1.4-1",
      "T1.4-2",
      "T1.4-4",
      "T2.6-1",
      "T2.6-2",
      "P-1",
    ],
    [
      // VIOL-VALID-CTRL: the control-character rule of SPEC 1.4 is not
      // enforced for code points outside the whitespace class — segments and
      // tags containing U+0000–U+0008, U+000E–U+001F, or U+007F are accepted
      // as valid. Whitespace characters (U+0009–U+000D, U+0020) remain
      // rejected in segments, and tag splitting is unchanged.
      violator("VIOL-VALID-CTRL", "conf-valid/bin-ctrl.mjs", [
        "T1.4-1",
        "T1.4-4",
        "P-1",
      ]),
      // VIOL-VALID-WIDE: U+00A0, U+0085, and U+2028 are treated as
      // whitespace for SPEC 1.4 validity — a segment or tag containing any
      // of them is rejected with 14.4. Tag splitting and all other
      // classifications are unchanged.
      violator("VIOL-VALID-WIDE", "conf-valid/bin-wide.mjs", [
        "T1.4-2",
        "T1.4-4",
        "P-1",
      ]),
    ],
  ),
  // CONF-MD (§CONF-MD): Markdown compilation — `build` with byte-exact
  // Markdown output per SPEC 3 (removal, replacement, the line-drop rule,
  // line terminators, the parse-not-pattern grammar boundary), `query node`
  // reporting own and subtree text (SPEC 1.6), `check` exiting 0 and
  // `query nodes`/`query edges` reporting no node and no edge for
  // construct-like bytes inside fences and code spans (T3-1's
  // grammar-boundary arm), and the emission scope of SPEC 7.3, over
  // spec-group workspaces with imports, embeddings, comments, mixed line
  // terminators, fenced code blocks and inline code spans carrying
  // construct-like bytes, and the full 2.7 prop set.
  conformer(
    "CONF-MD",
    "conf-md/bin.mjs",
    ["T3-1", "T3-2", "T3-3", "T3-4", "T3-5", "T3-6", "P-2", "P-3"],
    [
      // VIOL-MD-CLASS: the line-drop rule classifies U+00A0, U+0085, and
      // U+2028 as whitespace when deciding whether a line is left empty or
      // whitespace-only — consistently in Markdown output and, through SPEC
      // 1.6, in own and subtree text. A line left holding only those code
      // points after removals is dropped with its terminator.
      violator("VIOL-MD-CLASS", "conf-md/bin-class.mjs", ["T3-3", "P-2"]),
      // VIOL-MD-CR: a lone U+000D is not recognized as a line terminator by
      // the line model of SPEC 3 — consistently in Markdown output and,
      // through SPEC 1.6, in own and subtree text. CRLF and lone U+000A
      // remain terminators; a lone U+000D is an ordinary in-line character.
      violator("VIOL-MD-CR", "conf-md/bin-cr.mjs", ["T3-4", "P-2"]),
    ],
  ),
  // CONF-DISC (§CONF-DISC): configuration-driven discovery — `build` and
  // `ids` as the observation of the discovered set, over the glob semantics
  // of SPEC 7 (byte-wise case-sensitive matching, the dot-segment rule,
  // every character outside `*`/`?`/`**` a literal), discovery's refusal to
  // follow symbolic links, and the source exclusion of SPEC 13.4, with
  // 14.14 for outside-root patterns and 14.15 for import errors.
  conformer(
    "CONF-DISC",
    "conf-disc/bin.mjs",
    ["T7-4", "T7-5", "T7-6"],
    [
      // VIOL-DISC-DIALECT: glob patterns are interpreted in a common dialect
      // in which `[ ]` bracket expressions and `{ }` brace alternations are
      // active metacharacters, instead of the literals SPEC 7 requires. `*`,
      // `?`, `**`, case sensitivity, and the dot-segment rule are unchanged.
      violator("VIOL-DISC-DIALECT", "conf-disc/bin-dialect.mjs", ["T7-4"]),
      // VIOL-DISC-SYMLINK: discovery follows symbolic links to existing
      // files — a symbolic link to an existing file, at a workspace-relative
      // path a spec-group glob matches, is discovered as a source (read
      // through the link). Broken links remain ignored, and symbolic links
      // to directories remain untraversed, so discovery still terminates
      // (T7-5 fails by assertion, not by hang).
      violator("VIOL-DISC-SYMLINK", "conf-disc/bin-symlink.mjs", ["T7-5"]),
      // VIOL-DISC-DERIVED: discovery does not apply the source exclusion of
      // SPEC 13.4 — a path whose file name contains `.xspec.`, a file under
      // `.xspec/`, or a file at an enabled Markdown emit destination, when
      // matched by a spec-group glob, is treated as an ordinary match. Glob
      // semantics, the dot-segment rule, link behavior, 14.19 for
      // non-`.mdx` matches, and the import and empty-map rules are
      // unchanged.
      violator("VIOL-DISC-DERIVED", "conf-disc/bin-derived.mjs", ["T7-6"]),
    ],
  ),
  // CONF-AVAIL (§CONF-AVAIL): availability answers and JSON datum forms —
  // `view` (with and without `--text`) and `occurrences` over spec-only
  // `.mdx` workspaces, answering in the form-exact 12.7 document forms with
  // the three-state datums (plain value / stated `null` / the unavailability
  // marker), the 11.2 availability rules (spelled-identity definedness,
  // chain conditions, resolution through defined identities, whole-value
  // expansion poisoning, removal classification by form), occurrence
  // records per SPEC 5.7/11.3, the `--file`/`--to` domain rules of 11.3,
  // the raw attribute and import data of 11.4, findings with stable codes
  // for the staged conditions, and the 11.2 exit discipline.
  conformer(
    "CONF-AVAIL",
    "conf-avail/bin.mjs",
    ["T11.2-2", "T11.2-4", "T11.3-4", "T11.4-1", "T11.4-3", "T11.4-4"],
    [
      // VIOL-AVAIL-NULLMARKER: the unavailability marker is never emitted —
      // every datum the rules of SPEC 11.2 leave undefined is carried as
      // `null` in place of {"unavailable": true} (12.7). Which data are
      // undefined, all defined values, findings, exit codes, and every
      // other document member are unchanged.
      violator("VIOL-AVAIL-NULLMARKER", "conf-avail/bin-nullmarker.mjs", [
        "T11.2-2",
        "T11.2-4",
        "T11.4-3",
        "T11.4-4",
      ]),
      // VIOL-AVAIL-OMIT: `null`-valued members are omitted — every member
      // whose value an answer would carry as the stated `null` (12.7) is
      // absent from the emitted document (a viewed root's `tags` and
      // `coverage` and a located finding's `path` among them). Members with
      // plain, marker, or list values, which findings exist, and exit codes
      // are unchanged.
      violator("VIOL-AVAIL-OMIT", "conf-avail/bin-omit.mjs", [
        "T11.2-2",
        "T11.2-4",
        "T11.4-1",
        "T11.4-3",
        "T11.4-4",
      ]),
      // VIOL-AVAIL-NOFILE: `occurrences` does not apply the `--file`
      // restriction — the flag and its argument checks behave as specified
      // (11.3), but the consulted domain is the entire discovered set,
      // exactly as with the flag absent. `--to` selection, `view`, and
      // every other behavior are unchanged.
      violator("VIOL-AVAIL-NOFILE", "conf-avail/bin-nofile.mjs", ["T11.3-4"]),
    ],
  ),
];
