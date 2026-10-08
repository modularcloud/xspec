// TEST-SPEC §14 (validation errors: the reporting contract) — SUITE-49:
// T14-1 … T14-8 and T14-11 (T14-9 and T14-10, the Linux-leg 14.24/14.25
// tests, live in section-14-ii.ts).
//
// Sections 1–13 exercise each numbered condition in its home context; these
// are the reporting-contract tests: multi-error completeness with
// file/location/correction information (T14-1), the unresolved-reference
// conditions 14.5/14.6/14.7 plus the consumer-side type error, and the
// escape-spelled forms read verbatim (T14-2),
// masking by unparseable files and by configuration errors (T14-3), the
// reporter matrix — which of `build`/`check`/`review`/the machine-interface
// surfaces reports which condition (T14-4) — grammar selection by file
// name (T14-5), the stable-code contract — each of the 23 conditions'
// exact token as the finding's `code`, `null` where 14 assigns none
// (T14-6) — the refusal-reason contract: each stable refusal code with
// its concerned file, range, or identity, every applicable reason together,
// and the invalid-workspace refusal reporting numbered findings alone
// (T14-7) — and the location-cardinality contract: a condition several
// constructs jointly violate is one finding locating every participant,
// each in its containing file, in the pinned within-finding location order
// (T14-8) — and the per-condition range contract: each located condition's
// range byte-exact per SPEC 14's rule, against offsets precomputed from the
// staged bytes (T14-11).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes findings through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// Conservative operationalizations (noted per H-3/H-4):
// - "states a correction-oriented message" (T14-1): wording is free, so the
//   assertion is information presence — every finding carries a non-empty
//   human message, beside the file and location the same SPEC 14 sentence
//   demands; which phrasing counts as correction-oriented is not
//   machine-decidable (H-3). (14.2's assertable "expected form" statement is
//   T1.3-2's subject, and T14-4's 14.2 sweep row's at every reporter the
//   row reaches — the sweep bullet below.)
// - MDX-staged conditions locate within the offending element's byte window:
//   every plausible attribution point — the reference expression, the prop,
//   the element itself — lies inside it, and every other staged construct
//   lies outside the end-widened window, so a finding attributed to the
//   wrong construct fails. Code-file conditions use the offending
//   statement's own window (the section-4 convention, support.ts byteWindow).
// - 14.20 locations (T14-3, T14-5): T14-3's malformed MDX is `d={]}`, and
//   its entry pins that file's one location — the zero-length range at the
//   offset of the `]` (SPEC 14's syntax-failure rule: the prefix through
//   `d={` begins a well-formed file), precomputed from the staged bytes as
//   T14-11 and T14-12 pin theirs. For T14-3's other three unparseable files
//   and T14-5's `.mts` arm, "the parse-failure location is reported" fixes
//   presence alone, so those arms assert the finding names the file and
//   carries a location, never a window (T14-11 pins a byte-order mark's
//   and an encoding failure's offsets in its own fixtures).
// - check-side condition counts are exact, 14.10 included, like the
//   `build`-side counts (`build` cannot observe 14.10, SPEC 14.10, 12.1):
//   on a workspace failing `build`'s validations `check` reports 14.10 in
//   its two whatever-validity forms alone — the unreadable-record unit
//   form (14.23) and the recorded-file form — the mismatch forms, per file
//   and graph data, being undetectable and unreported there (SPEC 14.10,
//   13.3). Judged per staging, neither whatever-validity form exists:
//   T14-1's, T14-3's, and the sweep's never-built workspaces hold no
//   record (a failing `build` writes nothing, 12.1), and the pre-built
//   stagings — the sweep's journal entry, T14-4's failing-workspace 14.21
//   row — leave the record readable with every recorded path still
//   generated. So a product reporting phantom staleness beside the staged
//   conditions fails.
// - T14-4's 14.14 row: the 14.14 entry routes it through every command "as a
//   usage error (12.0), not a finding", so its both-reporters assertion is
//   the exit-2 contract (empty stdout under `--json`, stderr naming the
//   configuration) for `build` and `check` alike, never a findings row.
// - T14-4's 14.3 row tolerates one finding for the duplication or one per
//   occurrence (the T1.3-5 operationalization) — every reported finding
//   must carry 14.3 and locate in the staged file, no range checked (the
//   row's concern, next bullet). SPEC 14 fixes one 14.3 finding locating
//   every bearer at its `id` attribute; TEST-SPEC assigns that cardinality
//   to T14-8 and the exact ranges to T14-11 (its §14 preamble), which
//   assert them strictly (the T14-8 and T14-11 bullets below).
// - T14-4 stages each sweep condition in its minimal home form; per-condition
//   breadth belongs to the home-section tests (TEST-SPEC §14 preamble names
//   them). The sweep asserts reporter membership — the staged condition is
//   reported by `build` and by `check` — and, on each of its own rows,
//   identifies the staged condition's concern at every reporter the row
//   reaches (TEST-SPEC's error-assertion rule; SPEC 14, 12.7; `SweepConcern`):
//   a located row's finding locates in its staged file, every location
//   there (`specs/a.mdx`, or `src/app.ts` for 14.7, 14.11, and 14.18), the
//   14.11 finding's `identities` exactly bravo's root identity (the module
//   whose `text` it calls), and the 14.2 finding's message stating the
//   expected form, the correction SPEC 14.2 requires (T1.3-2's
//   `expectedFormMention` reading): any statement of the form for the
//   child of `p` exhibits the parent prefix `p.`, which the offending `q.r`
//   does not contain — matched where no ASCII letter or digit precedes it,
//   so a word such as "help." does not count; a path row's finding carries
//   its concerned path with `locations` `[]` — `.xspec/journal` (14.13),
//   `specs/a#b.mdx` (14.19), `out` (14.22), at the gated read too. Exact
//   ranges stay T14-11's, and the home rows (below) keep reporter
//   membership alone, their locations their home tests'. The dedicated
//   arms identify theirs likewise: every 14.10 finding a concerned path
//   with `locations` `[]`, `specs/a.md` among the paths; the 14.12 finding
//   the edge T12.2-4 pins by `identities`, `locations` `[]`, `path` null;
//   the 14.23 arm's findings (and `check`'s unit form) the graph-data area
//   `.xspec`. Their condition-10 findings also carry the correction SPEC
//   14.10 requires: every finding of the 14.10 arm, per file and unit form
//   alike, and the 14.23 arm's unit form instruct rebuilding (support.ts
//   assertFindingInstructsRebuilding: the message names `build`), neither
//   staging holding a recorded file that obstructs a rebuild write — the
//   one form instructed to be deleted manually instead.
// - T14-4's 14.21 arm asserts matrix membership — exit 1 with /corrupt/i on
//   stdout, the T10.1-4 operationalization — for one subcommand naming the
//   session (`review status`) and for `review list`; the all-subcommands
//   breadth and the fields-level list contract are T10.1-4's subject. The
//   failing-workspace half likewise asserts membership alone — `check`
//   reports 14.21 beside the gate's findings while `build`, `review status`,
//   and `review list` report exactly the gate's findings (the `--json`
//   findings report of the refusing reads, 12.7/13.3) — the every-subcommand
//   breadth, modifies-nothing compares, and bytes-untouched assertions being
//   T10.1-5's subject.
// - T14-4's 14.23 arm asserts reporter membership by exact condition counts:
//   `inventory` (the scoped `decodeInventoryFindings` decode) and a
//   `rename --preview` each carry exactly the one condition-23 finding;
//   `check` reports exactly one condition-10 finding (the unit form — so
//   never 14.23, never a per-file finding beside it on the freshly built,
//   otherwise clean workspace), each of the three findings concerning the
//   graph-data area `.xspec` with `locations` `[]`, the unit form
//   instructing rebuilding (SPEC 14.10: "one finding either way,
//   instructing rebuilding"); a refreshing read (`query nodes`) and `build`
//   exit 0. Depth — `recorded`/`delta` unavailability, record discipline,
//   replacement — is T11.6-4's, T6.6-6's, T12.2-2's, and T13.3-2's subject.
// - T14-4's 14.14 row includes `version`: exit 0 with a single JSON document
//   as its entire stdout (12.6 is JSON-only) on the same invalid
//   configuration that makes `build`/`check` exit 2 — the never-`version`
//   membership; the byte-identity and document-form depth is T12.6-1/2's.
// - T14-4's availability rows (SPEC 11.2): each sweep condition's finding
//   accompanies the answers of the surfaces whose domain can hold its staged
//   file — `occurrences`, `view`, and `at <file> 0` for a spec-source
//   staging (offset 0 is always a within-file offset of the non-empty staged
//   files; resolution is total, 11.5), `occurrences` alone for a code-source
//   one (14.7/14.11/14.18 locate in code sources alone; `view`'s and `at`'s
//   domains hold spec sources only) — each answer decoded through the
//   form-exact 12.7 document decoders (so the full answer member is emitted
//   beside the findings) at exit 1, its findings counted exactly like the
//   `build` side and their concern identified as there (these surfaces
//   never report 14.10, which is `check`'s alone). 14.13 and 14.22 are
//   instead the findings of no domain file: one gated read (`query nodes`)
//   reports exactly the staged finding, its concerned path identified, at
//   exit 1 (the 13.3 gate; the six-read breadth and modifies-nothing
//   compares are T13.3-3's), while the three
//   surfaces answer finding-free at exit 0 over the staged valid spec
//   source. Per-surface semantics depth is T11.2-*..T11.5-*'s subject.
// - T14-4 also sweeps the home tests' 14.16 and 14.20 stagings as further
//   sweep entries — reporter membership by exact counts, the pinned
//   locations and offsets staying the home tests' own subject: T2.3-3's
//   (section-2.2-2.3.ts's exported `T2_3_3_INVALID_STAGINGS`, its five
//   invalid containers, and `T2_3_3_UNPARSEABLE_STAGING`, each the record
//   its home arm stages, adapted by `homeStagingRow`), T2.7-1's
//   (section-2.7.ts's exported `T2_7_1_FOREIGN_14_16_STAGINGS`, its four
//   foreign constructs of condition 16, and `T2_7_1_CONTAINER_ARM` and
//   `T2_7_1_FRAGMENT_ARM`, adapted the same way), T2.7-4's (section-2.7.ts's
//   exported `T2_7_4_EXPRESSION_ARM`, its expression beside a comment, and
//   `T2_7_4_UNPARSEABLE_STAGINGS`, its six unparseable forms, adapted the
//   same way), and T14-12's (section-14-iii.ts's exported
//   `T14_12_REPORTER_STAGINGS`: `export { nope }` and the early-error
//   containers under their S-9 allowances, the six unparseable spec
//   sources' records declared unparseable, the two unparseable `.ts`
//   sources); the `.ts` entries are code-source rows (`occurrences` alone).
//   The home rows precede T14-12's, in the clause's order.
// - T14-6 stages each condition via its primary test's fixture — the same
//   minimal home-form stagings T14-4 sweeps, plus the five specially
//   reported conditions' stagings (14.10, 14.12, 14.14, 14.21, 14.23),
//   hoisted below and shared with T14-4's dedicated arms — and reads it
//   from ONE stated reporter of T14-4's matrix: `build` for every
//   both-reporter condition, `check` for 14.10/14.12/14.21, the exit-2
//   error document for 14.14, `inventory` for 14.23. Its assertion is the
//   code value alone: at least one finding, every finding carrying the
//   staged condition's exact token — sound because every staging stages
//   exactly one condition (T14-4 pins the counts; 14.3's per-occurrence
//   tolerance and several stale files under 14.10 both collapse into
//   "every finding carries the one staged token"). Count precision,
//   reporter breadth, and the concern data of these identical stagings
//   (locations' files, concerned paths, identities) and their correction
//   information (14.2's expected form, 14.10's rebuild instruction) stay
//   T14-4's and the home tests' subject; the `code`-null arms mirror
//   T12.7-3's plain-usage-error and T12.7-1's review-refusal stagings, per
//   T14-6's own citations.
// - T14-7 stages the refusal reasons via the home fixtures — T6.4-3's and
//   T6.5-4's exported staging and case tables (TEST-SPEC §14 preamble: the
//   refusal reasons are staged at T6.4-3, T6.5-4, T6.5-6, T6.6-3) — and
//   asserts the reporting contract alone: exit 1, the form-exact 12.7
//   findings-only report, the exact finding multiset (one finding per
//   applicable reason, none beside), and each finding's stable code with
//   its concerned file/range/identity. The modifies-nothing compares,
//   journal discipline, and preview equivalence stay the home tests'
//   subject (T6.4-3, T6.5-4, T6.6-3), save the link-and-target compare of
//   T6.5-4's symbolic-link arms, T14-7's own clause (the re-descent arms,
//   below). "Locating every colliding bearer"
//   is asserted every-participant strict (support.ts
//   assertFindingLocatesExactly, honoring a case's declared complete
//   bearer set, `locatedAtEach`): T6.4-3's exported two-bearer
//   prefix-replacement arm — rename `a`→`b` over `a`/`a.c` beside
//   `b`/`b.c` — is one `refused-id-collision` finding whose location set
//   is exactly `b` then `b.c` (12.7's within-finding order, the enclosing
//   bearer's location start-bounded before its child's construct, path
//   null), a product locating the first alone failing; T14-7's own
//   collision arms declare their one remaining bearer the same way — the
//   section move's occupant `keep.mv`, the control rename's `a.sib` —
//   exactly one location, none beside. The home table's dependency-cycle
//   location stays SOME-quantified (support.ts
//   assertFindingMentionsLocation): "the would-be cycle's full path" is
//   asserted there as the participating `d` spelling. The home table's
//   would-be spec import cycle (T6.5-4's, the home note) — both
//   participating imports ones the move would add, existing in no
//   pre-operation coordinates — declares its complete participant set
//   every-participant strict (`locatedAtEach`): each added import by the
//   reference spelling the move roots at its binding, the moved node's
//   `d={"keep"}` and `user`'s `d={"mv"}`, both in `specs/A.mdx`, exactly
//   those two in 12.7's within-finding order, path null; T14-7's own spec
//   import cycle — `B` imports `A`, and `user` in `A` references the
//   moved `x` in local form, its rewrite adding `B`'s import to `A` —
//   declares the complete participant set every-participant strict
//   (`locatedAtEach`): `B`'s existing import declaration by its own
//   characters and that local reference's spelling (5.7), never a range
//   for the import that does not yet exist. The remaining
//   every-participant cardinality contract is T14-8's subject.
//   SPEC 14 lists exactly eleven refusal reasons — the two it lists
//   last, refused-invalid-rewrite and refused-moved-import, are
//   T6.5-16's and T6.5-17's subjects, and refused-exposed-derived-file,
//   listed just before them, is T6.5-21's — and no
//   unresolvable-reference reason exists
//   (its retired code is unknown to the form-exact decode, S-5), so no
//   arm stages one. The
//   exact self-move's modifies-nothing and journal discipline are staged
//   at its home (T6.5-6); T14-7 asserts the identity-unchanged rename and
//   the exact self-move of either form for their `identities` — the
//   unchanged identity as the sole element, the bare `<new-file>` for the
//   file form (its entry) — every identity-pinned reason's `identities`
//   being asserted exact (support.ts assertRefusalIdentities).
//   T14-7's own stagings add what no home table stages: the two command
//   lines the entry spells for refused-invalid-id, each run in its home
//   workspace after the home table's loop — `rename specs/A.mdx a a.then`
//   (the new ID misplaced as well as invalid, so refused-structural-parent
//   beside it fails) and `move specs/A.mdx#x 'specs/B.mdx#x y'` (`x`
//   holding `x.sub`) — each `identities` exactly the new identity, no
//   prefix-produced identity beside it (14: intrinsic form only; the note
//   above runIntrinsicInvalidIdArm); the plain file as
//   a directory component of the destination path itself (the other
//   destination-side directory-component case of 6.5 beside T6.5-4's
//   derived-path arm — refused-invalid-destination, never 14.22); the
//   destination spellings `./a.mdx` for the origin `a.mdx`, `specs//b.mdx`,
//   and `specs/../specs/b.mdx`, in the file form and as a section form's
//   target path — each naming an occupied path were it normalized, refused
//   refused-invalid-destination alone concerning the path as spelled,
//   occupancy being judged in discovered-path form alone (14, 6.5, 12.0);
//   the spec import cycle's complete located participant set (above); the
//   both-collide-and-cycle section move (every applicable reason together,
//   never only the first found); and the invalid-workspace refusal with
//   the rename staged to ALSO collide — the control arm on the valid twin
//   pins the staged-to-collide premise (exactly the collision refusal),
//   then the broken workspace reports the validation findings alone. No
//   report carries a code outside 14's list: the form-exact decode admits
//   only 14's codes (forms.ts, S-5), so an unlisted code fails as an H-3
//   form failure before any count, and the exact multiset excludes every
//   listed code beside the staged reasons — asserted on every arm.
//   The refined arms (TEST-SPEC T14-7's closing clauses): refused-invalid-
//   rewrite and refused-moved-import are re-asserted over T6.5-16's and
//   T6.5-17's exported arm tables (the home-tables note above T14-7's
//   registration) — staged under the home configuration, the entry's exact
//   ranges as the complete bearer set (path null with it), `identities`
//   the entry's, every beside reason's concern derived from the operands;
//   identities over invalid paths — `specs/new.txt#x y` and
//   `specs/new.txt#p` beside refused-invalid-destination, each a plain
//   string over the path as spelled defining no node (`query node` on it
//   exit 2, 12.0's unknown identity); and the spec import cycle's sibling
//   arm — the chain `d={C.foo}` carried into `B` while `C` imports `B` —
//   locating `C`'s existing import and the chain's spelling in `A`, the
//   located set the spellings rooted at the added binding whether or not
//   their characters change (14, 6.5, 5.7, 1.5, 12.0).
//   The re-descent arms (TEST-SPEC T14-7's refused-invalid-destination and
//   refused-exposed-derived-file clauses): T6.5-4's symbolic-link arms — a
//   link to a directory at a component of the destination path and of a
//   created target file's path (the shared table's inside-root entries,
//   `MOVE_LINK_INSIDE_CASES`, and the exported outside-root staging) and
//   of the `outDir` emit destination (the derived-path arm's exported link
//   sibling) — each refused-invalid-destination alone, never 14.22, inside
//   a compare of the link and its target (`assertLinkAndTargetUnchanged`:
//   the root narrowed to the link entry and an inside target's tree, an
//   outside target compared on its own) — the one modifies-nothing compare
//   T14-7 owns, the link and its target byte-identical after each refusal
//   being T14-7's own clause; T6.5-4's barred path characters through
//   `MOVE_REFUSAL_CASES`; T6.5-20's derived-path relations and
//   module-linking designation over its exported table
//   (`d20RefusedStagings`, `runD20RefusedStaging`), each move exactly one
//   refused-invalid-destination finding concerning the destination as
//   spelled; and refused-exposed-derived-file over T6.5-21's
//   (`D21_REFUSED_STAGINGS`, `runD21RefusedStaging`) — `path` the
//   origin's emit destination, `identities` `[]`, the two-reason move's
//   refused-invalid-destination beside it. Every expectation stating a
//   `path` also asserts `locations` `[]`: a reason concerning a path
//   carries it as the finding's `path` with `locations` `[]` (14, 12.7).
// - T14-8 owns the every-participant strictness the home tests SOME-quantify
//   (T1.3-5's per-occurrence, T2.1-3's and T4-2's per-import, and T2.1-5's
//   per-file tolerance, T5.3-1's file-dimension binding, T14-7's cycle
//   mentions-location — its collision arms are every-participant strict,
//   above): exact finding counts and an index-wise per-participant
//   assertion — exactly one location per participating construct, each
//   within its construct's byte window (the module-header window
//   convention). Participant sequences are declared in the 12.7
//   within-finding order — document order within one file,
//   file-path-byte order across files — so the index-wise assertion also
//   pins "file bytes, then start, then end" value-wise, beside the
//   form-exact decoder's enforcement of that order on every decoded finding
//   (forms.ts, S-5-guarded); no staged pair of participants shares file and
//   start, so the end tiebreak stays decoder-enforced. The no-occurrence
//   embedding spelling's container range is byte-EXACT, no end-widening:
//   SPEC 14 pins the full braced container, opening brace through closing
//   brace — the span its occurrence would occupy (5.7) — keeping T11.4-6's
//   byte classification exact. The cross-file dependency cycle necessarily
//   co-stages the mutual-import spec import cycle (the T5.3-1 rationale: a
//   cross-file `depends` edge needs an external reference, external
//   references need imports, so A→B→A needs mutual imports); its report is
//   exactly two 14.9 findings, told apart by their located participants —
//   the reference spellings (element windows) vs the import declarations
//   (import windows), disjoint by construction — while the pure
//   mutual-import staging (bindings unused, so no dependency edge exists,
//   SPEC 2.1) isolates the import cycle as exactly one 14.9 finding.
// - T14-11 pins ranges byte-EXACT, no end-widening: every offset is the
//   UTF-8 byte length of the staged text before the pinned construct
//   (`assemble`/`pin`), fixtures carrying a multibyte character before it so
//   a character-indexed or line/column report fails; per arm the condition
//   multiset is exact and each condition's complete location lists are
//   compared as a multiset (order among same-condition findings is 12.7's
//   ordering contract, T12.7-*'s subject). TS declaration forms are staged
//   without `;` so "own characters" is unambiguous, while the dynamic
//   `import()`, the marker, the `text(...)` call, and the optional-chain
//   statement carry a `;` the range must exclude. The 14.20 arms pin the
//   offsets SPEC 14 fixes — 0 for a byte-order mark and a refused read, the
//   first undecodable byte, the longest well-formed-prefix length — where
//   T14-5 and T14-3's files other than its `d={]}` file assert presence
//   alone; the refused-read arm is a
//   permission staging (E-1), Linux leg, run last. `d={}` and
//   `d={ /* c */ }` are condition 20 (SPEC 2.7, 14.20: an attribute value
//   admits no empty expression), never 14.8 — the one zero-length range at
//   the offset of the closing brace, the prefix before `}` beginning some
//   well-formed file — and are staged `mdx.unparseable` (the stock grammar
//   rejects both, `unexpected-empty-expression`, its position the byte
//   after the opening brace: the rule's offset for `d={}` alone). The
//   refined `d`-value ranges (p)–(t) follow the occurrence-span rule of
//   SPEC 14 (5.7) over a module imported as `BASE`: `(BASE.a)` with its
//   parentheses, a comma sequence whole, `BASE.missing` alone past a block
//   comment and past U+00A0, U+FEFF, U+1680, and U+3000, a spread entry
//   with its `...`, and the elisions of one array literal as one finding
//   at the whole literal. The colliding-declaration forms (u) stage
//   T4.5-8's shared table (`T4_5_8_FURTHER_LOCATED_FORMS`, section-4.5.ts),
//   one code file per form beside its import; the encoding forms (v) stage
//   SPEC 14's four ill-formed byte sequences as exact bytes, a spec and a
//   code source each, pinning the first ill-formed byte's offset
//   zero-length — never the byte at which a decoder notices, never a
//   one-byte range. The module-linking forms (x) stage the 14.15 forms
//   beyond (j)'s, one code file each: `export import X = require(…)` from
//   `import`, two import types from `import` through the closing
//   parenthesis of the argument list (a `typeof` before and a qualifier or
//   type arguments after excluded), and a string-named module declaration
//   whole and, past a leading `export`, from `declare`.

import { Buffer } from "node:buffer";
import * as path from "node:path";
import type {
  Finding,
  GraphEdge,
  Mention,
} from "../../helpers/adapters/index.js";
import {
  CONDITION_CODE_TOKENS,
  GRAPH_DATA_AREA_PATH,
  assertReportMentions,
  corruptGraphDataShapeBlind,
  decodeAtReport,
  decodeEdgesReport,
  decodeFindingsReport,
  decodeInventoryFindings,
  decodeOccurrencesReport,
  decodePreviewReport,
  decodeViewFilesReport,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import {
  stageReadRefusalOfDirectory,
  stageReadRefusalOfFile,
  stageWriteRefusalUnder,
} from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import { StagedMdx, stagedMdx } from "../../helpers/staged-mdx.js";
import { StagedTs, stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import {
  assertCompileErrorAt,
  assertNoCompileErrors,
  ConsumerProject,
} from "../../helpers/tooling.js";
import type {
  InitialFileContents,
  WorkspaceDecl,
} from "../../helpers/workspace.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  RENAME_REFUSAL_CASES,
  RENAME_REFUSAL_CONFIG,
  RENAME_REFUSAL_FILES,
} from "./section-6.4.js";
import type { SameScopeDeclarationArm } from "./section-4.5.js";
import { T4_5_8_FURTHER_LOCATED_FORMS } from "./section-4.5.js";
import {
  T2_3_3_INVALID_STAGINGS,
  T2_3_3_UNPARSEABLE_STAGING,
} from "./section-2.2-2.3.js";
import { T2_4_2_UNPARSEABLE_STAGINGS } from "./section-2.4.js";
import {
  T2_7_1_CONTAINER_ARM,
  T2_7_1_FOREIGN_14_16_STAGINGS,
  T2_7_1_FRAGMENT_ARM,
  T2_7_3_SPREAD_UNPARSEABLE_STAGING,
  T2_7_4_EXPRESSION_ARM,
  T2_7_4_UNPARSEABLE_STAGINGS,
} from "./section-2.7.js";
import type { UnparseableArm } from "./section-14-iii.js";
import {
  T14_12_REPORTER_STAGINGS,
  T14_12_UNPARSEABLE_ARMS,
} from "./section-14-iii.js";
import type { R16Location, R16RefusedArm } from "./section-6.5-iii.js";
import {
  A13_FOURTH_STAGED,
  M17_REFUSED_ARMS,
  R16_CONFIG,
  R16_REFUSED_ARMS,
} from "./section-6.5-iii.js";
import type { RefusalExpectation } from "./section-6.5.js";
import {
  MOVE_DERIVED_LINK_CASE,
  MOVE_DERIVED_LINK_COMPONENT,
  MOVE_DERIVED_LINK_FILES,
  MOVE_DERIVED_PATH_CASE,
  MOVE_DERIVED_PATH_CONFIG,
  MOVE_DERIVED_PATH_FILES,
  MOVE_LINK_COMPONENT,
  MOVE_LINK_INSIDE_CASES,
  MOVE_LINK_OUTSIDE_CASES,
  MOVE_LINK_OUTSIDE_FILES,
  MOVE_REFUSAL_CASES,
  MOVE_REFUSAL_CONFIG,
  MOVE_REFUSAL_FILES,
  stageMoveDerivedLinkComponent,
  stageMoveLinkOutsideComponent,
  stageMoveRefusalOccupants,
  V4_SOLO_SOURCE,
} from "./section-6.5.js";
import {
  D21_REFUSED_STAGINGS,
  d20RefusedStagings,
  runD20RefusedStaging,
  runD21RefusedStaging,
} from "./section-6.5-iv.js";
import {
  POLICY_HI_SOURCE,
  POLICY_LO_SOURCE,
  T12_2_4_VIOLATION_IDENTITIES,
  VALID_A1_SOURCE,
} from "./section-12.1-12.2.js";
import { SELF_DEPENDS_STAGED } from "./section-5.1-5.3.js";
import type {
  BearerLocationExpectation,
  UnparseableStaging,
} from "./support.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertFindingConcernsPath,
  assertFindingIdentities,
  assertFindingInstructsRebuilding,
  assertFindingLocated,
  assertFindingLocatesExactly,
  assertFindingMentionsLocation,
  assertRefusalIdentities,
  assertSameJson,
  buildFindings,
  buildOk,
  byteWindow,
  expectConfigurationError,
  expectErrorDocument,
  expectExit,
  findingsInSourceOrder,
  runCli,
  runJson,
} from "./support.js";

// ---------------------------------------------------------------------------
// Shared fixture material and helpers
// ---------------------------------------------------------------------------

// Minimal declarative configuration (SPEC 7): exactly one spec group. A
// staged-source record (S-9; helpers/staged-ts.ts): most workspaces staging
// it follow their body's first product invocation, so it is judged before
// any product exists; the other stagings pass the record too.
const SPECS_ONLY_CONFIG = stagedTs(
  "T14-4/T14-6/T14-7/T14-8/T14-11 xspec.config.ts (one spec group, specs/**/*.mdx)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

// One spec group plus one code group (SPEC 7.2): TypeScript files under
// `src/` are discovered code sources, so `build` analyzes their spec-module
// usage (4, 4.5). A staged-source record (S-9), as SPECS_ONLY_CONFIG is:
// T14-4's and T14-6's code-source sweep entries and T14-11's code arms stage
// it after their bodies' first invocations; T14-1's, T14-2's, and T14-3's
// first workspaces pass the record too.
const SPEC_AND_CODE_CONFIG = stagedTs(
  "T14-4/T14-6/T14-11 xspec.config.ts (one spec group and the code group app, src/**/*.ts)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`,
);

// One spec group plus an unknown top-level key (SPEC 7, 14.14) — the
// canonical valid configuration with exactly one defect, so the error is
// attributable to it (the T7-2 attribution discipline): T14-3's
// configuration-error arm and the 14.14 staging T14-4's and T14-6's arms
// share (BOGUS_KEY_DECL), each workspace following its body's first
// invocation — a staged-source record (S-9).
const BOGUS_KEY_CONFIG = stagedTs(
  "T14-3/T14-4/T14-6 xspec.config.ts (one spec group and the unknown top-level key bogus, 14.14)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  bogus: true
})
`,
);

/** One spec group over `specs/`, Markdown emission on or off (SPEC 7, 7.3). */
function markdownConfig(emit: boolean): string {
  return `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: ${String(emit)} }
})
`;
}

/**
 * `markdownConfig(true)` as a staged-source record (S-9): the stale
 * workspace's configuration (STALE_DECL), which T14-6 stages after its
 * body's first invocation (T14-4's first workspace passes it too).
 */
const MARKDOWN_EMIT_CONFIG = stagedTs(
  "T14-6 xspec.config.ts (one spec group, Markdown emission on: the stale workspace, 14.10)",
  markdownConfig(true),
);

/** Stage a fresh workspace with the given entries, run `body`, dispose (H-1). */
async function withWorkspace<T>(
  decl: WorkspaceDecl,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create(decl);
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Run `check --json` expecting findings: exit 1 (findings are exit-1
 * outcomes, SPEC 12.0, 12.2; H-5) with exactly one JSON document as the
 * entire stdout, decoded as the findings report (H-3).
 */
async function checkFindings(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<readonly Finding[]> {
  const result = await expectExit(
    product,
    workspace,
    ["check", "--json"],
    1,
    `${context} — \`check\` exits 1 on any finding (SPEC 12.2, 12.0)`,
  );
  return decodeFindingsReport(parseJsonStdout(result, context), context)
    .findings;
}

/**
 * Run a JSON-only surface (or a `--json` invocation) expecting the exact
 * exit code (H-5) with exactly one JSON document as the entire stdout (SPEC
 * 12.0), returned parsed for the form-exact decoders — the counterpart of
 * support.ts `runJson` for answers that carry findings and therefore exit 1
 * with the full answer document still emitted (SPEC 11.2, 11.6, 6.6).
 */
async function runJsonExpecting(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  exitCode: number,
  context: string,
): Promise<unknown> {
  const result = await expectExit(product, workspace, argv, exitCode, context);
  return parseJsonStdout(result, context);
}

/**
 * Resolve the unique finding carrying `condition` (the caller has already
 * pinned the condition multiset, so a miss here is a diagnosed count defect).
 */
function findingOf(
  findings: readonly Finding[],
  condition: string,
  context: string,
): Finding {
  const matching = findings.filter(
    (finding) => finding.condition === condition,
  );
  if (matching.length !== 1) {
    fail(
      `${context}: expected exactly one condition-${condition} finding ` +
        `(SPEC 14); got ${String(matching.length)} among ` +
        JSON.stringify(findings.map((finding) => finding.condition)),
    );
  }
  return matching[0]!;
}

// 0xFF can occur in no valid UTF-8 sequence; everything else in the file is
// valid bytes, so 14.20 is the file's only reportable condition.
function withInvalidUtf8Byte(prefix: string, suffix: string): Uint8Array {
  return Buffer.concat([
    Buffer.from(prefix, "utf8"),
    Buffer.from([0xff]),
    Buffer.from(suffix, "utf8"),
  ]);
}

// A UTF-8 byte-order mark: a source beginning with it is unparseable
// (SPEC 1.6, 14.20). The workspace builder writes string contents with BOMs
// kept (S-2).
const BOM = "\u{FEFF}";

// The TSX-only construct shared by T14-3 (in a `.ts` file: fails 14.20) and
// T14-5 (in a `.tsx` file: parses; in an `.mts` file: fails 14.20). A JSX
// fragment is valid TSX and no plain-TypeScript production: in the plain
// grammar `<>` begins a type assertion with an empty type — a parse error
// wherever it appears.
const TSX_ONLY_STATEMENT = "const view = <>markup</>;";

// ---------------------------------------------------------------------------
// T14-1 — actionable and complete reporting
// ---------------------------------------------------------------------------

// Several independent error conditions across files, every fixture pure
// ASCII and assembled as prefix + offending construct + suffix so each
// finding's location window is precomputed from the parts' byte lengths.

// specs/one.mdx — 14.1: a non-root section without `id`.
const T14_1_ONE_PREFIX = '<S id="ok1">\nValid sibling.\n</S>\n\n';
const T14_1_ONE_CONSTRUCT = "<S>\nMissing id.\n</S>";

// specs/two.mdx — 14.4: an invalid segment (whitespace inside).
const T14_1_TWO_PREFIX = '<S id="ok2">\nValid sibling.\n</S>\n\n';
const T14_1_TWO_CONSTRUCT = '<S id="two seg">\nInvalid segment.\n</S>';

// specs/three.mdx — 14.5 and 14.6 in one file ("not only the first" within a
// file): an unresolved local `d` reference and an unresolved local `text`
// target, each in its own element.
const T14_1_THREE_PREFIX =
  "Preamble prose keeps the offending constructs off offset zero.\n\n";
const T14_1_THREE_D_CONSTRUCT =
  '<S id="t1" d={"absent.dep"}>\nUnknown dependency target.\n</S>';
const T14_1_THREE_MID = "\n\n";
const T14_1_THREE_TEXT_CONSTRUCT =
  '<S id="t2">\nUnknown text target:\n\n{text("absent.text")}\n</S>';

// specs/four.mdx — 14.16: a JSX element other than `<S>`/`<Spec>`.
const T14_1_FOUR_PREFIX = '<S id="ok4">\nValid sibling.\n</S>\n\n';
const T14_1_FOUR_CONSTRUCT = "<div>Not a section.</div>";

// src/five.ts — 14.7: an unresolved TypeScript marker (the import target
// `specs/ok.mdx` is valid, so the reference is the file's only defect).
const T14_1_FIVE_PREFIX = 'import OK from "../specs/ok.xspec";\n\n';
const T14_1_FIVE_CONSTRUCT = "OK.absent;";

const T14_1_FILES: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": SPEC_AND_CODE_CONFIG,
  "specs/ok.mdx": '<S id="present">\nA resolvable target.\n</S>\n',
  "specs/one.mdx": `${T14_1_ONE_PREFIX}${T14_1_ONE_CONSTRUCT}\n`,
  "specs/two.mdx": `${T14_1_TWO_PREFIX}${T14_1_TWO_CONSTRUCT}\n`,
  "specs/three.mdx":
    T14_1_THREE_PREFIX +
    T14_1_THREE_D_CONSTRUCT +
    T14_1_THREE_MID +
    T14_1_THREE_TEXT_CONSTRUCT +
    "\n",
  "specs/four.mdx": `${T14_1_FOUR_PREFIX}${T14_1_FOUR_CONSTRUCT}\n`,
  "src/five.ts": `${T14_1_FIVE_PREFIX}${T14_1_FIVE_CONSTRUCT}\n`,
};

/** Where each staged condition must be located (module-header windows). */
const T14_1_EXPECTED: readonly {
  readonly condition: string;
  readonly file: string;
  readonly window: { readonly start: number; readonly end: number };
}[] = [
  {
    condition: "14.1",
    file: "specs/one.mdx",
    window: byteWindow(T14_1_ONE_PREFIX, T14_1_ONE_CONSTRUCT),
  },
  {
    condition: "14.4",
    file: "specs/two.mdx",
    window: byteWindow(T14_1_TWO_PREFIX, T14_1_TWO_CONSTRUCT),
  },
  {
    condition: "14.5",
    file: "specs/three.mdx",
    window: byteWindow(T14_1_THREE_PREFIX, T14_1_THREE_D_CONSTRUCT),
  },
  {
    condition: "14.6",
    file: "specs/three.mdx",
    window: byteWindow(
      T14_1_THREE_PREFIX + T14_1_THREE_D_CONSTRUCT + T14_1_THREE_MID,
      T14_1_THREE_TEXT_CONSTRUCT,
    ),
  },
  {
    condition: "14.16",
    file: "specs/four.mdx",
    window: byteWindow(T14_1_FOUR_PREFIX, T14_1_FOUR_CONSTRUCT),
  },
  {
    condition: "14.7",
    file: "src/five.ts",
    window: byteWindow(T14_1_FIVE_PREFIX, T14_1_FIVE_CONSTRUCT),
  },
];

/** The T14-1 report contract over one command's findings. */
function assertCompleteReport(
  findings: readonly Finding[],
  context: string,
): void {
  assertConditionCounts(
    findings,
    { "14.1": 1, "14.4": 1, "14.5": 1, "14.6": 1, "14.7": 1, "14.16": 1 },
    `${context} — every staged condition is reported, not only the first, ` +
      `across files and within one file (SPEC 14)`,
  );
  for (const expected of T14_1_EXPECTED) {
    const finding = findingOf(findings, expected.condition, context);
    assertFindingLocated(
      finding,
      { file: expected.file, window: expected.window },
      `${context}: the ${expected.condition} finding identifies its file ` +
        `and location (SPEC 14)`,
    );
    if (finding.message.trim() === "") {
      fail(
        `${context}: the ${expected.condition} finding must state a ` +
          `correction-oriented message — information presence, not wording ` +
          `(SPEC 14; H-3); got a blank message`,
      );
    }
  }
}

const T14_1 = defineProductTest({
  id: "T14-1",
  title:
    "a workspace seeded with several independent error conditions across files: `build` and `check` report each of them (not only the first), and every report identifies file and location and states a correction-oriented message — information presence, not wording (SPEC 14)",
  run: async (product) => {
    await withWorkspace({ files: T14_1_FILES }, async (workspace) => {
      const buildContext =
        "T14-1 `build --json` over six independent conditions in five files";
      assertCompleteReport(
        await buildFindings(product, workspace, buildContext),
        buildContext,
      );
      const checkContext =
        "T14-1 `check --json` over the same workspace (counted exactly, " +
        "14.10 included: never built, so no record; see the module header)";
      assertCompleteReport(
        await checkFindings(product, workspace, checkContext),
        checkContext,
      );
    });
  },
});

// ---------------------------------------------------------------------------
// T14-2 — unresolved references, plus the consumer-side type error
// ---------------------------------------------------------------------------

// Initial, fully valid staging: `build` succeeds, so a prior valid
// generation of specs/base.xspec.ts exists — the state the type-error facet
// is asserted in (a later failing `build` modifies nothing, SPEC 12.1). The
// base module holds `login` beside `b1`: the node the escape-spelled marker
// below would name if its spelling were interpreted (SPEC 2.4), and the
// property TypeScript reads that marker as (4.5) — so the prior valid
// generation exports it and the marker is no type error.
const T14_2_INITIAL_FILES: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": SPEC_AND_CODE_CONFIG,
  "specs/base.mdx": [
    '<S id="b1">',
    "Base behavior.",
    "</S>",
    "",
    '<S id="login">',
    "The node an interpreted escape spelling would name.",
    "</S>",
    "",
  ].join("\n"),
  "specs/ref.mdx": [
    'import BASE from "./base.xspec"',
    "",
    '<S id="r1" d={BASE.b1}>',
    "Valid dependency.",
    "</S>",
    "",
  ].join("\n"),
  "src/app.ts": [
    'import BASE, { text } from "../specs/base.xspec";',
    "",
    "BASE.b1;",
    "text(BASE.b1);",
    "",
  ].join("\n"),
};

// The edits staging the unresolved references, prefix + construct exact.
const T14_2_REF_PREFIX = 'import BASE from "./base.xspec"\n\n';
const T14_2_REF_D_CONSTRUCT =
  '<S id="r1" d={BASE.nodep}>\nUnknown dependency target.\n</S>';
const T14_2_REF_MID = "\n\n";
const T14_2_REF_TEXT_CONSTRUCT =
  '<S id="r2">\nUnknown text target:\n\n{text("notext")}\n</S>';

// The escape spelling: the ten characters `lo\u0067in` as they stand in the
// source (the doubled backslash keeps the `\` in the harness's own string).
// Read verbatim (SPEC 2.4), the literal's value contains `\` and names no
// identity (1.4); interpreted, it would spell `login`.
const T14_2_ESCAPED_LOGIN = "lo\\u0067in";

// The escape-spelled local `d` reference after the node `login` its
// interpreted value would name (T2.4-5's premise): a product resolving the
// interpreted spelling reports nothing for it and fails the 14.5 count.
const T14_2_REF_LOGIN_CONSTRUCT =
  '<S id="login">\nThe local node an interpreted escape spelling would name.\n</S>';
const T14_2_REF_ESCAPED_CONSTRUCT =
  `<S id="r3" d={"${T14_2_ESCAPED_LOGIN}"}>\n` +
  "Escape-spelled local dependency.\n</S>";

const T14_2_APP_PREFIX =
  'import BASE, { text } from "../specs/base.xspec";\n\n';
const T14_2_APP_MARKER = "BASE.nomark;";
const T14_2_APP_CALL = "text(BASE.nocall);";

// A second consumer file: the escape-free control `BASE.login` (resolving,
// no finding) followed by the escape-spelled marker `BASE.lo\u0067in` — a
// chain segment carrying a Unicode escape spells a name containing `\`,
// which no segment contains (SPEC 2.4), so the marker resolves nowhere
// (14.7). TypeScript reads the escaped identifier as `login`, which the
// generated module exports, so the file type-checks clean: 14.7's type-error
// clause holds only for a spelling free of escape sequences.
const T14_2_ESCAPED_PREFIX =
  'import BASE from "../specs/base.xspec";\n\nBASE.login;\n';
const T14_2_ESCAPED_MARKER = `BASE.${T14_2_ESCAPED_LOGIN};`;

// The six unresolved reference forms, staged into specs/ref.mdx after the
// initial build — a staged-source record: judged before any product exists
// (S-9, test/self/s9-staged-sources.test.ts).
const T14_2_REF_BROKEN = stagedMdx(
  "T14-2 specs/ref.mdx with every unresolved reference form",
  T14_2_REF_PREFIX +
    T14_2_REF_D_CONSTRUCT +
    T14_2_REF_MID +
    T14_2_REF_TEXT_CONSTRUCT +
    T14_2_REF_MID +
    T14_2_REF_LOGIN_CONSTRUCT +
    T14_2_REF_MID +
    T14_2_REF_ESCAPED_CONSTRUCT +
    "\n",
);

// The two consumer files staged after the initial build — staged-source
// records (S-9; helpers/staged-ts.ts), judged before any product exists.
const T14_2_APP_BROKEN = stagedTs(
  "T14-2 src/app.ts with the unresolved marker and text call",
  `${T14_2_APP_PREFIX}${T14_2_APP_MARKER}\n${T14_2_APP_CALL}\n`,
);
const T14_2_ESCAPED_BROKEN = stagedTs(
  "T14-2 src/escaped.ts with the escape-free control and the escape-spelled marker",
  `${T14_2_ESCAPED_PREFIX}${T14_2_ESCAPED_MARKER}\n`,
);

const T14_2 = defineProductTest({
  id: "T14-2",
  title:
    'a `d` reference, a `text(...)` target, and a TypeScript marker and `text` call that do not resolve are 14.5, 14.6, and 14.7 respectively, each locating its reference; the TypeScript case is also a type error against the generated module, asserted while a prior valid generation exists; escape-spelled forms are unresolved likewise, read verbatim — `d={"lo\\u0067in"}` is 14.5 and the marker `BASE.lo\\u0067in` is 14.7 beside the node `login` their interpreted spellings would name, the marker no type error (SPEC 14.5, 14.6, 14.7, 4.1, 2.4)',
  run: async (product) => {
    await withWorkspace({ files: T14_2_INITIAL_FILES }, async (workspace) => {
      // Prior valid generation: the modules specs/base.xspec.ts and
      // specs/ref.xspec.ts exist after this build (SPEC 13.1).
      await buildOk(
        product,
        workspace,
        "T14-2 initial `build` (staging: a prior valid generation must " +
          "exist for the type-error facet, SPEC 12.1, 13.1)",
      );

      // Break every reference form: external `d`, local `text(...)`, the
      // escape-spelled local `d`, and the TypeScript forms (marker; `text`
      // call; escape-spelled marker).
      await workspace.file("specs/ref.mdx", T14_2_REF_BROKEN);
      await workspace.file("src/app.ts", T14_2_APP_BROKEN);
      await workspace.file("src/escaped.ts", T14_2_ESCAPED_BROKEN);

      const context = "T14-2 `build --json` over the six unresolved references";
      const findings = await buildFindings(product, workspace, context);
      assertConditionCounts(
        findings,
        { "14.5": 2, "14.6": 1, "14.7": 3 },
        `${context} — an unresolved \`d\` reference is 14.5 (the external ` +
          `\`BASE.nodep\` and the escape-spelled local \`"lo\\u0067in"\`, ` +
          `read verbatim, SPEC 2.4), an unresolved \`text(...)\` target is ` +
          `14.6, and each unresolved TypeScript reference (marker; \`text\` ` +
          `call; the escape-spelled marker \`BASE.lo\\u0067in\`) is 14.7 ` +
          `(SPEC 14.5–14.7)`,
      );
      const [dependencyFinding, escapedDependencyFinding] =
        findingsInSourceOrder(findings, "14.5");
      assertFindingLocated(
        dependencyFinding!,
        {
          file: "specs/ref.mdx",
          window: byteWindow(T14_2_REF_PREFIX, T14_2_REF_D_CONSTRUCT),
        },
        `${context}: the 14.5 finding`,
      );
      assertFindingLocated(
        findingOf(findings, "14.6", context),
        {
          file: "specs/ref.mdx",
          window: byteWindow(
            T14_2_REF_PREFIX + T14_2_REF_D_CONSTRUCT + T14_2_REF_MID,
            T14_2_REF_TEXT_CONSTRUCT,
          ),
        },
        `${context}: the 14.6 finding`,
      );
      assertFindingLocated(
        escapedDependencyFinding!,
        {
          file: "specs/ref.mdx",
          window: byteWindow(
            T14_2_REF_PREFIX +
              T14_2_REF_D_CONSTRUCT +
              T14_2_REF_MID +
              T14_2_REF_TEXT_CONSTRUCT +
              T14_2_REF_MID +
              T14_2_REF_LOGIN_CONSTRUCT +
              T14_2_REF_MID,
            T14_2_REF_ESCAPED_CONSTRUCT,
          ),
        },
        `${context}: the escape-spelled \`d\` reference's 14.5 finding — ` +
          `\`"lo\\u0067in"\` is read verbatim, never as \`login\` (SPEC 2.4)`,
      );
      const [markerFinding, callFinding, escapedMarkerFinding] =
        findingsInSourceOrder(findings, "14.7");
      assertFindingLocated(
        markerFinding!,
        {
          file: "src/app.ts",
          window: byteWindow(T14_2_APP_PREFIX, T14_2_APP_MARKER),
        },
        `${context}: the marker's 14.7 finding`,
      );
      assertFindingLocated(
        callFinding!,
        {
          file: "src/app.ts",
          window: byteWindow(
            `${T14_2_APP_PREFIX}${T14_2_APP_MARKER}\n`,
            T14_2_APP_CALL,
          ),
        },
        `${context}: the \`text\` call's 14.7 finding`,
      );
      assertFindingLocated(
        escapedMarkerFinding!,
        {
          file: "src/escaped.ts",
          window: byteWindow(T14_2_ESCAPED_PREFIX, T14_2_ESCAPED_MARKER),
        },
        `${context}: the escape-spelled marker's 14.7 finding — ` +
          `\`BASE.lo\\u0067in\` spells a segment containing \`\\\` and ` +
          `resolves nowhere (SPEC 2.4), never the node \`login\``,
      );

      // The type-error facet: the failed build modified nothing (SPEC
      // 12.1), so the prior valid generation persists — against it, each
      // unresolved TypeScript reference is a type error at the reference
      // (SPEC 14.7: "this is also a type error against the generated
      // module").
      const project = await ConsumerProject.load({
        rootDir: workspace.root,
        rootFiles: ["src/app.ts"],
      });
      assertCompileErrorAt(
        project,
        project.locate("src/app.ts", T14_2_APP_MARKER, {
          charOffset: "BASE.".length,
        }),
        {},
        "T14-2 the unresolved marker must be a TypeScript type error " +
          "against the generated module (SPEC 14.7, 4.1)",
      );
      assertCompileErrorAt(
        project,
        project.locate("src/app.ts", T14_2_APP_CALL, {
          charOffset: "text(BASE.".length,
        }),
        {},
        "T14-2 the unresolved `text` argument must be a TypeScript type " +
          "error against the generated module (SPEC 14.7, 4.1)",
      );

      // The escape-spelled marker is no type error: 14.7's type-error
      // clause holds only for a spelling free of escape sequences (SPEC
      // 14.7, 2.4) — TypeScript reads `BASE.lo\u0067in` as `BASE.login`,
      // which the prior valid generation exports, so the consumer file
      // holding it (and the escape-free control) compiles clean.
      const escapedProject = await ConsumerProject.load({
        rootDir: workspace.root,
        rootFiles: ["src/escaped.ts"],
      });
      assertNoCompileErrors(
        escapedProject,
        "T14-2 the escape-spelled marker `BASE.lo\\u0067in` must be no " +
          "type error against the generated module — TypeScript reads the " +
          "escaped identifier as `login`, which the prior valid generation " +
          "exports; 14.7's type-error clause holds only for a spelling free " +
          "of escape sequences (SPEC 14.7, 2.4)",
      );
    });
  },
});

// ---------------------------------------------------------------------------
// T14-3 — masking: unparseable files and configuration errors
// ---------------------------------------------------------------------------

// Four unparseable files (SPEC 14.20), each containing a would-be condition
// that must stay masked, plus otherwise-valid files referencing into them.
// The exact condition multiset is the masking assertion: any leaked in-file
// condition, and any reference reported as something other than unresolved,
// breaks it.

// Malformed MDX, `d={]}` (TEST-SPEC T14-3): the element holding the
// referenced id `bm1` carries a `d` attribute whose braces hold `]`, which
// begins no expression, so the file fails to parse there and only there —
// the would-be 14.4 (`worse name`) before it is masked, and references
// targeting `bm1` (an id that would exist) are unresolved. The one location
// is SPEC 14's zero-length range at the offset of the `]` (T14-11, T14-12's
// arm (u)): the prefix through `d={` begins a well-formed file. The offset
// is pinned from the staged bytes (`assemble`/`pin`, T14-11's fixture
// notation, below); the stock parser (S-9) rejects the text at that same
// byte, and completing the prefix as `d={"x"}>` derives.
const T14_3_BROKEN_MDX_FILE = "specs/brokenmdx.mdx";
const T14_3_BROKEN_MDX = assemble([
  '<S id="worse name">\n',
  "A would-be invalid segment (14.4), masked by the parse failure.\n",
  "</S>\n",
  "\n",
  '<S id="bm1" d={',
  pin(""),
  "]}>\n",
  "The target id the references aim at; the file never parses.\n",
  "</S>\n",
]);

// Malformed TypeScript in a `.ts` file: the TSX-only construct (the grammar
// selected by any name but `.tsx` is plain TypeScript, SPEC 14.20). The
// would-be invalid import (14.15) above it is masked.
const T14_3_BROKEN_TS = [
  'import { S } from "./nonsense.xspec";',
  TSX_ONLY_STATEMENT,
  "",
].join("\n");

const T14_3_FILES: WorkspaceDecl = {
  // S-9: the sources 14.20 declares unparseable — the three MDX sources, and
  // the TypeScript one (a TSX-only construct in a `.ts` file).
  mdx: {
    unparseable: [T14_3_BROKEN_MDX_FILE, "specs/badutf8.mdx", "specs/bom.mdx"],
  },
  ts: { unparseable: ["src/brokents.ts"] },
  files: {
    "xspec.config.ts": SPEC_AND_CODE_CONFIG,
    [T14_3_BROKEN_MDX_FILE]: T14_3_BROKEN_MDX.text,
    "src/brokents.ts": T14_3_BROKEN_TS,
    "specs/badutf8.mdx": withInvalidUtf8Byte(
      "<S>\nA would-be missing id (14.1), masked; the invalid byte: ",
      " ends parsing.\n</S>\n",
    ),
    "specs/bom.mdx":
      BOM + '<S id="also bad">\nA would-be 14.4, masked by the BOM.\n</S>\n',
    "specs/refs.mdx": [
      'import BROKEN from "./brokenmdx.xspec"',
      "",
      '<S id="rf1" d={BROKEN.bm1}>',
      "Dependency reference into the unparseable file.",
      "</S>",
      "",
      '<S id="rf2">',
      "Text reference into the unparseable file:",
      "",
      "{text(BROKEN.bm1)}",
      "</S>",
      "",
    ].join("\n"),
    "src/refs.ts": [
      'import BROKEN from "../specs/brokenmdx.xspec";',
      "",
      "BROKEN.bm1;",
      "",
    ].join("\n"),
    "specs/refs2.mdx": [
      'import BAD from "./badutf8.xspec"',
      'import BOMED from "./bom.xspec"',
      "",
      '<S id="rg1" d={BAD.u1}>',
      "Reference into the invalid-UTF-8 file.",
      "</S>",
      "",
      '<S id="rg2" d={BOMED.m1}>',
      "Reference into the BOM file.",
      "</S>",
      "",
    ].join("\n"),
  },
};

const T14_3_UNPARSEABLE_FILES: readonly string[] = [
  T14_3_BROKEN_MDX_FILE,
  "src/brokents.ts",
  "specs/badutf8.mdx",
  "specs/bom.mdx",
];

/** The T14-3 masking contract over one command's findings. */
function assertMaskingReport(
  findings: readonly Finding[],
  context: string,
): void {
  // The exact multiset: one 14.20 per unparseable file, one unresolved
  // reference per staged reference into them — and nothing from inside the
  // unparseable files (the masked would-be 14.1/14.4/14.15 must not leak).
  assertConditionCounts(
    findings,
    { "14.20": 4, "14.5": 3, "14.6": 1, "14.7": 1 },
    `${context} — each unparseable file is one 14.20, its in-file ` +
      `conditions are masked, and every reference into it reports as ` +
      `unresolved (SPEC 14, 14.20, 14.5–14.7)`,
  );
  for (const file of T14_3_UNPARSEABLE_FILES) {
    const matching = findings.filter((finding) =>
      finding.locations.some((location) => location.file === file),
    );
    if (matching.length !== 1 || matching[0]!.condition !== "14.20") {
      fail(
        `${context}: expected exactly one finding naming ` +
          `${JSON.stringify(file)}, carrying condition 14.20 (SPEC 14.20; ` +
          `everything inside an unparseable file is masked, SPEC 14); got ` +
          JSON.stringify(
            matching.map(({ condition, message }) => ({ condition, message })),
          ),
      );
    }
    if (file === T14_3_BROKEN_MDX_FILE) {
      // `d={]}`: TEST-SPEC T14-3 pins the one location — SPEC 14's
      // zero-length range at the offset of the `]`, computed from the
      // staged bytes (the module header).
      const failure = T14_3_BROKEN_MDX.ranges[0]!;
      assertSameJson(
        matching[0]!.locations.map((location) => ({
          file: location.file,
          range: { start: location.range.start, end: location.range.end },
        })),
        [{ file, range: failure }],
        `${context}: the 14.20 finding for ${file} carries exactly one ` +
          `location, the zero-length range at the offset of the \`]\` in ` +
          `\`d={]}\` (byte ${String(failure.start)}): the prefix through ` +
          `\`d={\` begins a well-formed file, no expression begins with ` +
          `\`]\` (SPEC 14, 14.20, 1.7, 12.7)`,
      );
      continue;
    }
    // "The parse-failure location is reported": presence for the other
    // three files, per the module header.
    assertFindingLocated(
      matching[0]!,
      { file },
      `${context}: the 14.20 finding for ${file} reports the parse-failure ` +
        `location (SPEC 14.20)`,
    );
  }
  const filesOf = (condition: string): string[] =>
    findings
      .filter((finding) => finding.condition === condition)
      .map((finding) => {
        const file = finding.locations[0]?.file;
        return typeof file === "string" ? file : "<no location>";
      })
      .sort();
  assertSameJson(
    filesOf("14.5"),
    ["specs/refs.mdx", "specs/refs2.mdx", "specs/refs2.mdx"],
    `${context} — the unresolved \`d\` references are the three staged ` +
      `references into the unparseable files (SPEC 14, 14.5)`,
  );
  assertSameJson(
    filesOf("14.6"),
    ["specs/refs.mdx"],
    `${context} — the unresolved \`text(...)\` target is the staged ` +
      `reference into the malformed MDX file (SPEC 14, 14.6)`,
  );
  assertSameJson(
    filesOf("14.7"),
    ["src/refs.ts"],
    `${context} — the unresolved TypeScript marker is the staged reference ` +
      `into the malformed MDX file (SPEC 14, 14.7)`,
  );
}

// The configuration-error arm: an unknown top-level key (SPEC 7, 14.14)
// beside sources that are themselves invalid. The arm's workspace follows
// the body's first invocations, so its configuration and sources are
// staged-source records (S-9, test/self/s9-staged-sources.test.ts), the
// malformed source declared unparseable.
const T14_3_CONFIG_ARM_FILES: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": BOGUS_KEY_CONFIG,
  "specs/invalid.mdx": stagedMdx(
    "T14-3 configuration-error arm specs/invalid.mdx (a missing id, never analyzed)",
    "<S>\nMissing id (14.1), never analyzed.\n</S>\n",
  ),
  "specs/broken.mdx": stagedMdx(
    "T14-3 configuration-error arm specs/broken.mdx (an unclosed element, never analyzed)",
    '<S id="x">\nUnclosed element (14.20), never analyzed.\n',
    "unparseable",
  ),
};

const T14_3 = defineProductTest({
  id: "T14-3",
  title:
    "an unparseable file (14.20 — malformed MDX, `d={]}`, its zero-length range at the offset of the `]`; a TSX-only construct in a `.ts` file; invalid UTF-8; BOM) masks conditions inside itself, every reference into it from other files reports as unresolved (14.5-14.7), and the parse-failure location is reported; a configuration error suppresses all source analysis — only 14.14 is reported (exit 2) even with invalid sources present (SPEC 14, 14.20, 14.14)",
  timeoutMs: 180_000,
  run: async (product) => {
    await withWorkspace(T14_3_FILES, async (workspace) => {
      const buildContext =
        "T14-3 `build --json` over four unparseable files and the " +
        "references into them";
      assertMaskingReport(
        await buildFindings(product, workspace, buildContext),
        buildContext,
      );
      const checkContext =
        "T14-3 `check --json` over the same workspace (counted exactly, " +
        "14.10 included: never built, so no record; see the module header)";
      assertMaskingReport(
        await checkFindings(product, workspace, checkContext),
        checkContext,
      );
    });

    // Configuration-error arm: 14.14 precedes all source analysis — exit 2,
    // empty stdout under --json (no findings report at all), stderr naming
    // the configuration — for `build` and `check` alike, with invalid
    // sources present.
    await withWorkspace(
      { files: T14_3_CONFIG_ARM_FILES },
      async (workspace) => {
        await expectConfigurationError(
          product,
          workspace,
          ["build"],
          "T14-3 `build` under a configuration error with invalid sources " +
            "present — only 14.14 is reported, as a usage error suppressing " +
            "all source analysis (SPEC 14.14, 14, 12.0)",
        );
        await expectConfigurationError(
          product,
          workspace,
          ["check"],
          "T14-3 `check` under the same configuration error — the " +
            "suppression holds for every command (SPEC 14.14, 14, 12.0)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T14-4 — reporter matrix
// ---------------------------------------------------------------------------

/**
 * What a sweep row's staged condition must identify at every reporter the
 * row reaches (TEST-SPEC.md's error-assertion rule: the report identifies
 * the file/location/correction information SPEC 14 requires; SPEC 14,
 * 12.7) — identification, never exact ranges, which stay T14-11's:
 * - `located`: a condition that locates in source — every finding carries
 *   a location, every location in the staged `file`; `identities`, where
 *   given, the finding's exact `identities` (14.11's foreign module);
 *   `expectedFormMention`, where given, a mention every finding's message
 *   carries: the expected form SPEC 14.2 has the error state (the 14.2
 *   row's parent prefix, T1.3-2's `expectedFormMention` reading);
 * - `concerned-path`: a condition without an in-source location — every
 *   finding's 12.7 `path` is exactly `path` (workspace-relative) and its
 *   `locations` are `[]`;
 * - `home-test`: a home test's staging swept for reporter membership
 *   alone, its locations and offsets staying its home test's subject.
 */
type SweepConcern =
  | {
      readonly kind: "located";
      readonly file: string;
      readonly identities?: readonly string[];
      /**
       * What every statement of the expected form exhibits (SPEC 14.2:
       * "the error states the expected form"), where the staging admits
       * an implementation-independent substring the offending ID does not
       * contain: for a child of parent `P`, the parent prefix `P.` (SPEC
       * 1.3; T1.3-2's `expectedFormMention` reading).
       */
      readonly expectedFormMention?: Mention;
    }
  | { readonly kind: "concerned-path"; readonly path: string }
  | { readonly kind: "home-test" };

// One minimal staging per both-reporter condition (the sweep of the T14-4
// text: "every other condition reported by both `build` and `check`").
interface SweepEntry {
  readonly condition: string;
  readonly label: string;
  readonly decl: WorkspaceDecl;
  /** Extra staging that must run before the assertions (e.g. a prior build). */
  readonly prepare?: (
    product: ProductBinding,
    workspace: TestWorkspace,
  ) => Promise<void>;
  /**
   * The staged condition's concern, asserted on every finding at every
   * reporter the row reaches (`assertSweepFindings`): stated on each of
   * the sweep's own rows — `located` in the staged file (the 14.2 row's
   * with the expected form's mention, overriding `specArm`'s default), or
   * `concerned-path` — and `home-test` on the home rows, whose locations
   * their home tests assert.
   */
  readonly concern: SweepConcern;
  /**
   * This sweep's tolerance, set on the 14.3 row alone: accept one finding
   * for the staged defect or one per occurrence (the T1.3-5
   * operationalization), every finding carrying the condition and
   * locating in the staged file (the row's `located` concern; no range
   * checked). SPEC 14 fixes one 14.3 finding locating every bearer at its
   * `id` attribute; TEST-SPEC assigns that cardinality to T14-8 and the
   * exact ranges to T14-11, which assert them strictly.
   */
  readonly perOccurrenceTolerated?: boolean;
  /**
   * Which machine-interface answers the staged condition accompanies (the
   * T14-4 availability rows; SPEC 11.2, module header): a spec-source
   * staging accompanies all three of `occurrences`/`view`/`at <file> 0`; a
   * code-source staging accompanies `occurrences` alone (`view`'s and
   * `at`'s domains hold spec sources only, 11.4/11.5); the conditions of no
   * domain file (14.13, 14.22) accompany none of them — they are instead
   * reported by the gated reads (13.3), probed via `query nodes`, while the
   * three surfaces answer finding-free at exit 0 over `file`, the staging's
   * valid spec source.
   */
  readonly answers:
    | { readonly kind: "spec-source"; readonly file: string }
    | { readonly kind: "code-source" }
    | { readonly kind: "no-domain-file"; readonly file: string };
}

/**
 * Shorthand: a specs-only workspace whose one source stages the condition —
 * a staged-source record carrying its own S-9 declaration, beside the
 * configuration's record (every sweep workspace but T14-6's first follows
 * its body's first invocation; the table is converted uniformly). Every
 * condition staged this way locates in source, so the row's concern is a
 * location in its one staged file, `specs/a.mdx`.
 */
function specArm(
  condition: string,
  label: string,
  source: StagedMdx,
): SweepEntry {
  return {
    condition,
    label,
    decl: {
      files: { "xspec.config.ts": SPECS_ONLY_CONFIG, "specs/a.mdx": source },
    },
    concern: { kind: "located", file: "specs/a.mdx" },
    answers: { kind: "spec-source", file: "specs/a.mdx" },
  };
}

// The code arms' valid spec source (a staged-source record, S-9).
const CODE_ARM_SPEC_SOURCE = stagedMdx(
  "T14-4/T14-6 specs/s.mdx (the code arms' valid spec source n1: the sweep's 14.7 and 14.18 entries)",
  '<S id="n1">\nCode-referenced behavior.\n</S>\n',
);

/**
 * Shorthand: a valid spec plus one code file staging the condition — a
 * staged-source record (S-9; helpers/staged-ts.ts), as the spec arms' are.
 * The condition locates in that code file, `src/app.ts` (the row's
 * concern).
 */
function codeArm(
  condition: string,
  label: string,
  source: StagedTs,
): SweepEntry {
  return {
    condition,
    label,
    decl: {
      files: {
        "xspec.config.ts": SPEC_AND_CODE_CONFIG,
        "specs/s.mdx": CODE_ARM_SPEC_SOURCE,
        "src/app.ts": source,
      },
    },
    concern: { kind: "located", file: "src/app.ts" },
    answers: { kind: "code-source" },
  };
}

/**
 * A home test's spec-source staging, as its home module exports it: the file
 * staging the condition and every source the home arm stages, the
 * configuration excluded — `UnparseableStaging`'s shape (support.ts), which
 * passes as is.
 */
interface HomeSpecStaging {
  /** The workspace-relative path of the file staging the condition. */
  readonly file: string;
  /**
   * Every source the home arm stages, the configuration excluded: each MDX
   * source the staged-source record its home module registers (S-9).
   */
  readonly files: Readonly<Record<string, InitialFileContents>>;
}

/**
 * Adapter: one home test's 14.16 or 14.20 spec-source staging as a sweep row
 * (TEST-SPEC T14-4: "Among the matrix's stagings: … the 14.16 and 14.20 arms
 * of T2.3-3, T2.7-1, T2.7-4, and T14-12 (all three surfaces for their
 * spec-source stagings)"). The row stages the home arm's very sources, never
 * re-spelled here, beside this module's specs-only configuration record (the
 * home modules stage the same text), and probes all three surfaces over the
 * staged file. T14-4's and T14-6's sweeps stage every row after their
 * bodies' first invocations, so the staged file must be the record its home
 * module registers, under the declaration the condition implies: declared
 * unparseable for a 14.20 row, and derivable — well-formed, or under named
 * early-error allowances — for a 14.16 row, a finding of a file that parses
 * (14.20). Checked at load: a mismatch is a harness defect. The row's
 * concern is `home-test`: reporter membership alone, the staging's
 * locations and offsets staying its home test's subject.
 */
function homeStagingRow(
  condition: "14.16" | "14.20",
  label: string,
  staging: HomeSpecStaging,
): SweepEntry {
  const staged = staging.files[staging.file];
  const unparseable = condition === "14.20";
  if (
    !(staged instanceof StagedMdx) ||
    (staged.mdx === "unparseable") !== unparseable ||
    "xspec.config.ts" in staging.files
  ) {
    throw new Error(
      `T14-4/T14-6 sweep: the home staging ${JSON.stringify(label)} must ` +
        `stage ${staging.file} as a staged-source record ` +
        `${unparseable ? "declared unparseable" : "declared derivable"} ` +
        `(S-9; condition ${condition}), beside no configuration of its own`,
    );
  }
  return {
    condition,
    label,
    decl: {
      files: { "xspec.config.ts": SPECS_ONLY_CONFIG, ...staging.files },
    },
    concern: { kind: "home-test" },
    answers: { kind: "spec-source", file: staging.file },
  };
}

// The sources the sweep shares with the dedicated arms below, staged-source
// records (S-9): the minimal valid source a1 — the journal-error and
// symbolic-link entries' spec source and the ground of VALID_SPECS_DECL,
// BOGUS_KEY_DECL, and READ_REFUSAL_DECL — and specs/a.mdx without an id,
// the missing-ID entry's source, which T14-4's 14.21 arm also re-stages
// on its just-rebuilt workspace (the failing side).
const VALID_A1_BEHAVIOR = stagedMdx(
  "T14-4/T14-6 specs/a.mdx (the minimal valid source a1: the sweep's journal-error and symbolic-link entries; the 14.21, 14.23, and 14.14 arms' workspaces; T14-6's 14.25 and code-null arms)",
  '<S id="a1">\nValid behavior.\n</S>\n',
);
const ID_LESS_A_SOURCE = stagedMdx(
  "T14-4/T14-6 specs/a.mdx without an id (the sweep's missing-ID entry, 14.1; re-staged after the build by T14-4's 14.21 arm, its failing workspace)",
  "<S>\nNo id.\n</S>\n",
);

const GARBAGE_JOURNAL_LINE =
  "?? harness-injected garbage: not a journal entry ??\n";

const SWEEP_ENTRIES: readonly SweepEntry[] = [
  specArm("14.1", "missing ID", ID_LESS_A_SOURCE),
  {
    ...specArm(
      "14.2",
      "invalid structural ID",
      stagedMdx(
        "T14-4/T14-6 sweep specs/a.mdx (14.2, invalid structural ID)",
        [
          '<S id="p">',
          "Parent.",
          "",
          '<S id="q.r">',
          "A child whose ID does not extend the parent's.",
          "</S>",
          "</S>",
          "",
        ].join("\n"),
      ),
    ),
    // The error states the expected form (SPEC 14.2): any statement of it
    // for the child of `p` — `p.<segment>`, a corrected ID such as `p.r` —
    // exhibits the parent prefix `p.` (T1.3-2's `expectedFormMention`
    // reading), which the offending `q.r` cannot satisfy. The prefix is
    // short, so it counts only where no ASCII letter or digit precedes it:
    // a word ending in `p` before a full stop ("help.", "step.") states no
    // form.
    concern: {
      kind: "located",
      file: "specs/a.mdx",
      expectedFormMention: /(?<![0-9A-Za-z])p\./,
    },
  },
  {
    ...specArm(
      "14.3",
      "duplicate ID within a file",
      stagedMdx(
        "T14-4/T14-6 sweep specs/a.mdx (14.3, duplicate ID within a file)",
        [
          '<S id="dup">',
          "First occurrence.",
          "</S>",
          "",
          '<S id="dup">',
          "Second occurrence.",
          "</S>",
          "",
        ].join("\n"),
      ),
    ),
    perOccurrenceTolerated: true,
  },
  specArm(
    "14.4",
    "invalid segment",
    stagedMdx(
      "T14-4/T14-6 sweep specs/a.mdx (14.4, invalid segment)",
      '<S id="bad name">\nInvalid segment.\n</S>\n',
    ),
  ),
  specArm(
    "14.5",
    "unknown dependency",
    stagedMdx(
      "T14-4/T14-6 sweep specs/a.mdx (14.5, unknown dependency)",
      '<S id="a" d={"nope"}>\nUnknown dependency target.\n</S>\n',
    ),
  ),
  specArm(
    "14.6",
    "unknown text target",
    stagedMdx(
      "T14-4/T14-6 sweep specs/a.mdx (14.6, unknown text target)",
      '<S id="a">\nBody:\n\n{text("nada")}\n</S>\n',
    ),
  ),
  codeArm(
    "14.7",
    "unknown TypeScript reference",
    stagedTs(
      "T14-4/T14-6 sweep src/app.ts (14.7, unknown TypeScript reference)",
      ['import SPEC from "../specs/s.xspec";', "", "SPEC.missing;", ""].join(
        "\n",
      ),
    ),
  ),
  specArm(
    "14.8",
    "invalid argument",
    stagedMdx(
      "T14-4/T14-6 sweep specs/a.mdx (14.8, invalid argument)",
      '<S id="a" d={42}>\nNon-static dependency value.\n</S>\n',
    ),
  ),
  specArm("14.9", "dependency cycle", SELF_DEPENDS_STAGED),
  {
    condition: "14.11",
    label: "cross-module text call",
    decl: {
      files: {
        "xspec.config.ts": SPEC_AND_CODE_CONFIG,
        "specs/alpha.mdx": stagedMdx(
          "T14-4/T14-6 sweep specs/alpha.mdx (14.11, cross-module text call)",
          '<S id="first">\nAlpha behavior.\n</S>\n',
        ),
        "specs/bravo.mdx": stagedMdx(
          "T14-4/T14-6 sweep specs/bravo.mdx (14.11, cross-module text call)",
          '<S id="second">\nBravo behavior.\n</S>\n',
        ),
        "src/app.ts": stagedTs(
          "T14-4/T14-6 sweep src/app.ts (14.11, cross-module text call)",
          [
            'import ALPHA from "../specs/alpha.xspec";',
            'import { text as textB } from "../specs/bravo.xspec";',
            "",
            "textB(ALPHA.first);",
            "",
          ].join("\n"),
        ),
      },
    },
    // Located at the call in the code source; its `identities` hold exactly
    // the foreign module — the root identity of bravo, whose `text` export
    // `textB` is (SPEC 14.11, 1.5, 12.7).
    concern: {
      kind: "located",
      file: "src/app.ts",
      identities: ["specs/bravo.mdx"],
    },
    answers: { kind: "code-source" },
  },
  {
    condition: "14.13",
    label: "journal error",
    decl: {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/a.mdx": VALID_A1_BEHAVIOR,
      },
    },
    prepare: async (product, workspace) => {
      await buildOk(
        product,
        workspace,
        "section-14 (journal error) staging `build` (SPEC 12.1; the " +
          "staging is shared by T14-4's sweep and T14-6's)",
      );
      await workspace.file(".xspec/journal", GARBAGE_JOURNAL_LINE);
    },
    // A journal condition carries the journal's path (SPEC 14, 14.13, 12.7).
    concern: { kind: "concerned-path", path: ".xspec/journal" },
    answers: { kind: "no-domain-file", file: "specs/a.mdx" },
  },
  specArm(
    "14.15",
    "invalid import",
    stagedMdx(
      "T14-4/T14-6 sweep specs/a.mdx (14.15, invalid import)",
      [
        'import X from "./missing.xspec"',
        "",
        '<S id="a">',
        "The import designates no discovered spec source.",
        "</S>",
        "",
      ].join("\n"),
    ),
  ),
  specArm(
    "14.16",
    "invalid construct",
    stagedMdx(
      "T14-4/T14-6 sweep specs/a.mdx (14.16, invalid construct)",
      '<S id="a">\nBody.\n</S>\n\n<div>Not a section.</div>\n',
    ),
  ),
  specArm(
    "14.17",
    "invalid prop",
    stagedMdx(
      "T14-4/T14-6 sweep specs/a.mdx (14.17, invalid prop)",
      '<S id="a" bogus="1">\nUnknown prop.\n</S>\n',
    ),
  ),
  codeArm(
    "14.18",
    "unsupported node usage",
    stagedTs(
      "T14-4/T14-6 sweep src/app.ts (14.18, unsupported node usage)",
      [
        'import SPEC from "../specs/s.xspec";',
        "",
        "const alias = SPEC.n1;",
        "",
      ].join("\n"),
    ),
  ),
  {
    condition: "14.19",
    label: "invalid source path",
    decl: {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/a#b.mdx": stagedMdx(
          "T14-4/T14-6 sweep specs/a#b.mdx (14.19, invalid source path)",
          '<S id="a">\nValid content, invalid path.\n</S>\n',
        ),
      },
    },
    // The `#`-containing path is valid UTF-8, so the file is nameable by an
    // argument value: it keeps its parse-local view, every node identity in
    // it explicitly unavailable, its condition-19 finding accompanying every
    // answer whose consulted domain includes it (SPEC 11.2, 11.4, 11.5). A
    // path-level condition: the finding carries the offending path itself
    // (SPEC 14, 14.19, 12.7).
    concern: { kind: "concerned-path", path: "specs/a#b.mdx" },
    answers: { kind: "spec-source", file: "specs/a#b.mdx" },
  },
  // S-9: the one entry source the document declares unparseable.
  specArm(
    "14.20",
    "unparseable source",
    stagedMdx(
      "T14-4/T14-6 sweep specs/a.mdx (14.20, unparseable source)",
      '<S id="x">\nUnclosed element.\n',
      "unparseable",
    ),
  ),
  {
    condition: "14.22",
    label: "symbolic link in a write path",
    decl: {
      files: {
        "xspec.config.ts": stagedTs(
          "T14-4/T14-6 sweep xspec.config.ts (14.22, Markdown emission into outDir out, a symbolic link)",
          `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true, outDir: "out" }
})
`,
        ),
        "specs/a.mdx": VALID_A1_BEHAVIOR,
      },
      dirs: ["real-out"],
      symlinks: { out: "real-out" },
    },
    // The concerned path is the offending component's workspace-relative
    // path, the link `out` (SPEC 14, 14.22, 12.7).
    concern: { kind: "concerned-path", path: "out" },
    answers: { kind: "no-domain-file", file: "specs/a.mdx" },
  },
  // The home tests' 14.16 and 14.20 arms (TEST-SPEC T14-4: "Among the
  // matrix's stagings: … the 14.16 and 14.20 arms of T2.3-3, T2.7-1,
  // T2.7-4, and T14-12 (all three surfaces for their spec-source
  // stagings)"), each staged by its home module and swept here for
  // reporter membership: `build`, `check`, and the surfaces whose domain
  // holds the staged file, each finding counted exactly as the home arm
  // counts it — one per staging — the locations and offsets staying the
  // home tests' subject (each row's concern is `home-test`, unlike the own
  // rows above, whose concern the sweep asserts). In the clause's order:
  // T2.3-3's five invalid containers (one 14.16 each) and
  // `{text("a") text("b")}` (14.20), through `homeStagingRow`.
  ...T2_3_3_INVALID_STAGINGS.map(({ arm, file, source }): SweepEntry =>
    homeStagingRow("14.16", arm, { file, files: { [file]: source } }),
  ),
  homeStagingRow(
    "14.20",
    `T2.3-3 ${T2_3_3_UNPARSEABLE_STAGING.name}`,
    T2_3_3_UNPARSEABLE_STAGING,
  ),
  // T2.7-1's (it has no 14.20 arm): the foreign element, the expression
  // container, the export statement, and the foreign element carrying an
  // attribute value expression (one 14.16 each; its 14.8 control
  // `<S id="x" d={1}>` reports no condition 16 and stays out), then the
  // section spelled inside an expression container and the fragment (one
  // 14.16 each).
  ...T2_7_1_FOREIGN_14_16_STAGINGS.map(({ arm, file, source }): SweepEntry =>
    homeStagingRow("14.16", `T2.7-1 ${arm.name}`, {
      file,
      files: { [file]: source },
    }),
  ),
  ...[T2_7_1_CONTAINER_ARM, T2_7_1_FRAGMENT_ARM].map(
    ({ name, file, source }): SweepEntry =>
      homeStagingRow("14.16", `T2.7-1 ${name}`, {
        file,
        files: { [file]: source },
      }),
  ),
  // T2.7-4's: the expression beside a comment, `{/* a */ 1}` (one 14.16;
  // its comment forms report no finding and stay out), then its six
  // unparseable forms — U+0085, U+200B, and U+180E between braces, `{// c`
  // U+2028 or U+2029 `}` U+000A `}`, and `{// c}` with no later `}` (one
  // 14.20 each, masking the file).
  homeStagingRow("14.16", `T2.7-4 ${T2_7_4_EXPRESSION_ARM.name}`, {
    file: T2_7_4_EXPRESSION_ARM.file,
    files: { [T2_7_4_EXPRESSION_ARM.file]: T2_7_4_EXPRESSION_ARM.source },
  }),
  ...T2_7_4_UNPARSEABLE_STAGINGS.map((staging): SweepEntry =>
    homeStagingRow("14.20", `T2.7-4 ${staging.name}`, staging),
  ),
  // Then T14-12's: the early-error forms under their S-9 allowances, the
  // unparseable spec sources declared so (`occurrences` alone for the `.ts`
  // arms, 14.20 in a code source).
  ...T14_12_REPORTER_STAGINGS.map((staging): SweepEntry => ({
    condition: staging.condition,
    label: staging.label,
    decl: staging.decl,
    concern: { kind: "home-test" },
    answers: staging.answers,
  })),
];

// ---------------------------------------------------------------------------
// Stagings shared by T14-4's dedicated reporter arms and T14-6's stable-code
// sweep — one per specially-reported condition, each the minimal
// primary-fixture form of the TEST-SPEC 14 preamble's per-condition record
// ---------------------------------------------------------------------------

// 14.10 (T12.2-2's fixture): build, then edit the source — Markdown emission
// on, so the emitted file's bytes are the compiled source and the staged
// staleness is certainly detectable. Every workspace of the decls below
// but T14-4's first follows its body's first invocation, so each `.mdx`
// entry is a staged-source record (S-9) — here T12.2-2's own valid a1
// source, byte-identical, by import — and so is each configuration (here
// `markdownConfig(true)`'s record).
const STALE_DECL: WorkspaceDecl = {
  files: {
    "xspec.config.ts": MARKDOWN_EMIT_CONFIG,
    "specs/a.mdx": VALID_A1_SOURCE,
  },
};
// The post-build edit of specs/a.mdx is a staged-source record (S-9: judged
// before any product exists by test/self/s9-staged-sources.test.ts, since
// S-7's sweep never reaches a staging that follows a product invocation).
const STALE_EDIT = stagedMdx(
  "T14-4/T14-6 specs/a.mdx edited after the build (the stale workspace, 14.10)",
  '<S id="a1">\nAlpha behavior, edited.\n</S>\n',
);

// 14.12 (T7.5-2's fixture): one forbidden rule, one violating dependence —
// its two sources T12.2-2's policy family's records, byte-identical, by
// import.
const POLICY_DECL: WorkspaceDecl = {
  files: {
    "xspec.config.ts": stagedTs(
      "T14-4/T14-6 xspec.config.ts (the policy workspace: groups hi and lo, the forbidden rule no-hi-to-lo, 14.12)",
      `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    hi: ["hi/**/*.mdx"],
    lo: ["lo/**/*.mdx"]
  },
  policy: [
    {
      name: "no-hi-to-lo",
      type: "forbidden",
      from: { group: "hi" },
      to: { group: "lo" }
    }
  ]
})
`,
    ),
    "hi/H.mdx": POLICY_HI_SOURCE,
    "lo/L.mdx": POLICY_LO_SOURCE,
  },
};

// A minimal valid workspace (one spec group, one valid source): the ground
// the 14.21/14.23 corruptions — and T14-6's code-null arms — are staged on.
const VALID_SPECS_DECL: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPECS_ONLY_CONFIG,
    "specs/a.mdx": VALID_A1_BEHAVIOR,
  },
};

// 14.21 (T10.1-4's fixture): a session file that cannot be parsed.
const GARBAGE_SESSION_PATH = ".xspec/reviews/bad.json";
const GARBAGE_SESSION_CONTENT = "{ this is not a parseable session";

// 14.14 (the T7-2 attribution discipline, as in T14-3's configuration arm):
// the canonical valid configuration plus one unknown top-level key, so the
// error is attributable to that one defect, beside a valid source — the
// configuration BOGUS_KEY_CONFIG, the record T14-3's arm stages too.
const BOGUS_KEY_DECL: WorkspaceDecl = {
  files: {
    "xspec.config.ts": BOGUS_KEY_CONFIG,
    "specs/a.mdx": VALID_A1_BEHAVIOR,
  },
};

/**
 * One availability-surface probe (SPEC 11.2, 11.3–11.5): the invocation
 * paired with the form-exact 12.7 document decode, so asserting the decoded
 * findings also asserts the full answer member is emitted beside them.
 */
interface AvailabilityProbe {
  readonly what: string;
  readonly argv: readonly string[];
  readonly findingsOf: (doc: unknown, context: string) => readonly Finding[];
}

/** `occurrences` alone — the one surface whose domain holds code sources. */
const OCCURRENCES_PROBE: AvailabilityProbe = {
  what: "`occurrences`",
  argv: ["occurrences"],
  findingsOf: (doc, context) => decodeOccurrencesReport(doc, context).findings,
};

/**
 * All three surfaces over one staged spec source. `at` probes offset 0 — a
 * within-file offset of every (non-empty) staged file; resolution is total
 * over the file (11.5), so the answer never turns on the offset choice.
 */
function availabilityProbes(file: string): readonly AvailabilityProbe[] {
  return [
    OCCURRENCES_PROBE,
    {
      what: "`view`",
      argv: ["view"],
      findingsOf: (doc, context) =>
        decodeViewFilesReport(doc, context).findings,
    },
    {
      what: `\`at ${file} 0\``,
      argv: ["at", file, "0"],
      findingsOf: (doc, context) => decodeAtReport(doc, context).findings,
    },
  ];
}

/**
 * Assert a finding of a condition without an in-source location identifies
 * its concern (SPEC 14: such a condition carries the file or path it
 * concerns; 12.7: that path is the finding's `path`, and its `locations`
 * are empty): `path` exactly the workspace-relative `concernedPath`,
 * `locations` `[]`. `where` names the row or arm and the reporter; `cited`
 * the SPEC sections the failure cites.
 */
function assertConcernedPathAlone(
  finding: Finding,
  concernedPath: string,
  where: string,
  cited: string,
): void {
  assertFindingConcernsPath(
    finding,
    concernedPath,
    `${where} — a condition without an in-source location carries the ` +
      `path it concerns (${cited})`,
  );
  assertSameJson(
    finding.locations,
    [],
    `${where} — a condition without an in-source location carries no ` +
      `location: \`locations\` [] (${cited})`,
  );
}

/**
 * Assert a sweep row's concern (`SweepConcern`) on each of `findings`, every
 * one carrying the staged condition (the caller's count assertion passed):
 * a `located` row's finding locates in the staged file, every location
 * there — exact ranges stay T14-11's — with 14.11's `identities` exactly the
 * foreign module, and the 14.2 row's message stating the expected form (its
 * `expectedFormMention`; SPEC 14, 14.2) at whichever reporter `where`
 * names; a `concerned-path` row's finding carries its path with
 * `locations` `[]`; a `home-test` row's concern is its home test's subject.
 */
function assertSweepConcern(
  findings: readonly Finding[],
  entry: SweepEntry,
  where: string,
): void {
  const { concern, condition } = entry;
  if (concern.kind === "home-test") return;
  const cited = `SPEC 14, ${condition}, 12.7`;
  for (const finding of findings) {
    if (concern.kind === "concerned-path") {
      assertConcernedPathAlone(finding, concern.path, where, cited);
      continue;
    }
    assertFindingLocated(
      finding,
      { file: concern.file },
      `${where} — condition ${condition} locates in source: the finding ` +
        `carries a location, every location in the staged file ` +
        `${concern.file} (exact ranges: T14-11; ${cited})`,
    );
    if (concern.identities !== undefined) {
      assertFindingIdentities(
        finding,
        concern.identities,
        `${where} — condition ${condition}'s \`identities\` hold exactly ` +
          `the foreign module, the root identity (1.5) of the spec module ` +
          `whose \`text\` export is called (${cited})`,
      );
    }
    if (concern.expectedFormMention !== undefined) {
      assertReportMentions(
        finding.message,
        [concern.expectedFormMention],
        `${where} — condition ${condition}'s error states the expected ` +
          `form, the correction SPEC 14 requires of it (SPEC 14, 14.2: ` +
          `"the error states the expected form"): any statement of the ` +
          `form for the staged child exhibits its parent's prefix (T1.3-2's ` +
          `reading)`,
      );
    }
  }
}

/**
 * One reporter's sweep assertion — `build`, `check`, the gated read, and
 * the availability surfaces alike: the staged condition counted exactly
 * (the 14.3 row under its tolerance), then the row's concern on every
 * finding (`assertSweepConcern`: TEST-SPEC.md's error-assertion rule; SPEC
 * 14, 12.7). `where` names the row and the reporter, `rationale` the
 * count's claim; the count's failure reads `where — rationale`.
 */
function assertSweepFindings(
  findings: readonly Finding[],
  entry: SweepEntry,
  where: string,
  rationale: string,
): void {
  const context = `${where} — ${rationale}`;
  if (entry.perOccurrenceTolerated) {
    const conditions = findings.map((finding) => finding.condition);
    if (
      findings.length < 1 ||
      findings.length > 2 ||
      conditions.some((condition) => condition !== entry.condition)
    ) {
      fail(
        `${context}: expected the staged ${entry.label} to report condition ` +
          `${entry.condition} — one finding for the defect, or one per ` +
          `occurrence: this sweep's tolerance (the T1.3-5 ` +
          `operationalization); SPEC 14's single finding locating every ` +
          `bearer is T14-8's to assert — got ${JSON.stringify(conditions)}`,
      );
    }
  } else {
    assertConditionCounts(findings, { [entry.condition]: 1 }, context);
  }
  assertSweepConcern(findings, entry, where);
}

const T14_4 = defineProductTest({
  id: "T14-4",
  title:
    "the reporter matrix: 14.10 and 14.12 reported by `check` only (a stale workspace `build`s successfully by regenerating; a policy-violating workspace `build`s successfully); 14.21 reported by `check`, by `review` subcommands naming the session, and by `review list` — not by `build`, and on a workspace failing `build`'s validations by `check` alone, beside the gate's findings; 14.23 reported by `inventory` and `rename`/`move` previews only — `check` reports the state as 14.10's unit form, and `build` and the refreshing reads never do; 14.14 as the every-command usage error — never `version`; 14.13 and 14.22 reported by `build`, `check`, and the gated reads, yet accompanying no `occurrences`/`view`/`at` answer; every other condition reported by both `build` and `check`, and as a domain file's finding accompanying the answers of each of `occurrences`/`view`/`at` whose domain can hold its staged file — all three for a spec-source staging, `occurrences` alone for a code-source one (SPEC 14, 12.1, 12.2, 10.1, 13.3, 11.2, 11.3-11.6, 6.6, 12.6)",
  timeoutMs: 480_000,
  run: async (product) => {
    // --- 14.10: check-only. A stale workspace `build`s successfully by
    // regenerating (STALE_DECL: Markdown emission on, so the staged
    // staleness is certainly detectable).
    await withWorkspace(STALE_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-4 (14.10) staging `build` (SPEC 12.1)",
      );
      await workspace.file("specs/a.mdx", STALE_EDIT);
      const context = "T14-4 (14.10) `check --json` on the stale workspace";
      const findings = await checkFindings(product, workspace, context);
      if (
        findings.length === 0 ||
        findings.some((finding) => finding.condition !== "14.10")
      ) {
        fail(
          `${context}: staleness is the workspace's only staged error ` +
            `condition, so \`check\` reports at least one finding and ` +
            `every finding is 14.10 (SPEC 12.2, 14.10); got ` +
            JSON.stringify(findings.map((finding) => finding.condition)),
        );
      }
      // Each finding concerns a path — a stale derived file's, or the
      // graph-data area for the unit form — locates nothing in source, and
      // instructs rebuilding: no recorded file is staged, so none obstructs
      // a rebuild write (the one form whose correction is its manual
      // deletion instead); the edited source's emitted Markdown,
      // specs/a.md, is among the concerned paths (SPEC 14, 14.10, 13.2,
      // 12.7).
      for (const finding of findings) {
        if (finding.path === null) {
          fail(
            `${context}: a condition-10 finding has no in-source location ` +
              `and carries the derived path (or the graph-data area) it ` +
              `concerns as its 12.7 \`path\`; got null (message: ` +
              `${JSON.stringify(finding.message)}) (SPEC 14, 14.10, 12.7)`,
          );
        }
        assertSameJson(
          finding.locations,
          [],
          `${context} — a condition-10 finding has no in-source location: ` +
            `\`locations\` [] (SPEC 14, 14.10, 12.7)`,
        );
        assertFindingInstructsRebuilding(
          finding,
          `${context} — the finding concerning ` +
            `${JSON.stringify(finding.path)}: no recorded file obstructs a ` +
            `rebuild write here, so every condition-10 finding, per file ` +
            `and unit form alike, instructs rebuilding (SPEC 14, 14.10)`,
        );
      }
      if (!findings.some((finding) => finding.path === "specs/a.md")) {
        fail(
          `${context}: the edited specs/a.mdx's emitted Markdown, ` +
            `specs/a.md, no longer matches what the current source ` +
            `generates, so a per-file finding concerning it is among the ` +
            `findings (SPEC 14, 14.10, 13.2, 12.7); got the paths ` +
            JSON.stringify(findings.map((finding) => finding.path)),
        );
      }
      await expectExit(
        product,
        workspace,
        ["build"],
        0,
        "T14-4 (14.10) `build` on the stale workspace — `build` cannot " +
          "observe staleness because it regenerates every derived file: " +
          "14.10 is reported by `check` only (SPEC 14.10, 12.1)",
      );
      await expectExit(
        product,
        workspace,
        ["check"],
        0,
        "T14-4 (14.10) `check` after the rebuild — the successful " +
          "`build` resolved the staleness by regenerating (SPEC 12.1, 14.10)",
      );
    });

    // --- 14.12: check-only. A policy-violating workspace `build`s
    // successfully; `check` reports the violation (POLICY_DECL).
    await withWorkspace(POLICY_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-4 (14.12) `build` over the policy-violating workspace — " +
          "policy violations are `check` findings, and `build` succeeds " +
          "and regenerates regardless (SPEC 14.12, 12.1, 7.5)",
      );
      const policyContext = "T14-4 (14.12) `check --json`";
      const policyFindings = await checkFindings(
        product,
        workspace,
        policyContext,
      );
      assertConditionCounts(
        policyFindings,
        { "14.12": 1 },
        "T14-4 (14.12) `check` reports the one violating edge — the " +
          "freshly built workspace stages nothing else (SPEC 14.12, 12.2)",
      );
      // The violation identifies its edge by `identities` alone — the edge
      // T12.2-4 pins: no in-source location, no concerned path (SPEC 14,
      // 14.12, 12.7).
      const violation = policyFindings[0]!;
      assertFindingIdentities(
        violation,
        T12_2_4_VIOLATION_IDENTITIES,
        `${policyContext} — the violated rule's name and the edge's source ` +
          `identity, kind token, and target identity, in order (SPEC 14, ` +
          `14.12, 12.7)`,
      );
      assertSameJson(
        violation.locations,
        [],
        `${policyContext} — the offending entity is a graph edge, not a ` +
          `spelling: \`locations\` [] (SPEC 14, 14.12, 12.7)`,
      );
      if (violation.path !== null) {
        fail(
          `${policyContext}: a policy finding concerns no path — \`path\` ` +
            `null (SPEC 14, 14.12, 12.7); got ` +
            JSON.stringify(violation.path),
        );
      }
    });

    // --- 14.21: reported by `check`, by `review` subcommands naming the
    // session, and by `review list` — not by `build` (VALID_SPECS_DECL plus
    // the garbage session file).
    await withWorkspace(VALID_SPECS_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-4 (14.21) staging `build` (SPEC 12.1)",
      );
      await workspace.file(GARBAGE_SESSION_PATH, GARBAGE_SESSION_CONTENT);
      await expectExit(
        product,
        workspace,
        ["build"],
        0,
        "T14-4 (14.21) `build` beside the corrupt session — `build` does " +
          "not read sessions, so 14.21 is not its finding (SPEC 14.21)",
      );
      assertConditionCounts(
        await checkFindings(product, workspace, "T14-4 (14.21) `check --json`"),
        { "14.21": 1 },
        "T14-4 (14.21) `check` reports the one corrupt session — the " +
          "just-rebuilt workspace stages nothing else (SPEC 14.21, 12.2)",
      );
      for (const argv of [
        ["review", "status", "bad"],
        ["review", "list"],
      ] as const) {
        const context = `T14-4 (14.21) \`${argv.join(" ")}\``;
        const result = await runCli(product, workspace, argv);
        assertExitCode(
          result,
          1,
          `${context} — a review subcommand naming a corrupt session, and ` +
            `\`review list\` reporting one, exit 1 (SPEC 14.21, 10.1, ` +
            `10.7, 12.0)`,
        );
        assertReportMentions(
          result,
          [/corrupt/i],
          `${context} — the report identifies the session as corrupt ` +
            `(SPEC 10.1/14.21 vocabulary; findings are standard-output ` +
            `content, 12.0; information presence, never exact wording, H-3)`,
        );
      }

      // On a workspace failing `build`'s validations, 14.21 is reported
      // by `check` alone, beside the gate's findings: no session is read
      // on the failing side, so the gated `review` reads report exactly
      // the gate's findings — the validation errors, no condition-21
      // finding beside them (SPEC 14.21, 13.3, 10.1; membership only, the
      // module header — the every-subcommand breadth, modifies-nothing
      // compares, and bytes-untouched assertions are T10.1-5's).
      await workspace.file("specs/a.mdx", ID_LESS_A_SOURCE);
      assertConditionCounts(
        await buildFindings(
          product,
          workspace,
          "T14-4 (14.21, failing workspace) `build --json`",
        ),
        { "14.1": 1 },
        "T14-4 (14.21, failing workspace) `build` reports the validation " +
          "error alone — `build` does not read sessions, so 14.21 is " +
          "never its finding (SPEC 14.21, 12.1)",
      );
      assertConditionCounts(
        await checkFindings(
          product,
          workspace,
          "T14-4 (14.21, failing workspace) `check --json`",
        ),
        { "14.1": 1, "14.21": 1 },
        "T14-4 (14.21, failing workspace) `check` reports 14.21 beside " +
          "the failing workspace's other findings — the validation error " +
          "and the corrupt session together, counted exactly: 14.10's " +
          "mismatch forms go unreported on the failing workspace, whose " +
          "record stays readable with every recorded path still generated " +
          "(SPEC 14.21, 12.2, 14.10; module header)",
      );
      for (const argv of [
        ["review", "status", "bad", "--json"],
        ["review", "list", "--json"],
      ] as const) {
        const context = `T14-4 (14.21, failing workspace) \`${argv.join(" ")}\``;
        const result = await expectExit(
          product,
          workspace,
          argv,
          1,
          `${context} — on a workspace failing \`build\`'s validations a ` +
            `gated read reports the gate's findings and exits 1 without ` +
            `answering (SPEC 13.3, 12.0)`,
        );
        assertConditionCounts(
          decodeFindingsReport(parseJsonStdout(result, context), context)
            .findings,
          { "14.1": 1 },
          `${context} — exactly the gate's findings: no session file is ` +
            `read on a failing workspace, so no condition-21 finding is ` +
            `reported beside them — on this workspace 14.21 is \`check\`'s ` +
            `alone (SPEC 14.21, 13.3, 10.1; depth: T10.1-5)`,
        );
      }
    });

    // --- 14.23: reported by `inventory` and `rename`/`move` previews only —
    // `check` reports the state as 14.10's unit form, and `build` and the
    // refreshing reads never do: the rebuild replaces the record; the reads
    // leave it unconsulted (SPEC 14.23, 14.10, 13.3, 11.6, 6.6; membership
    // by exact counts per the module header — depth: T11.6-4, T6.6-6,
    // T12.2-2, T13.3-2). Staged on VALID_SPECS_DECL.
    await withWorkspace(VALID_SPECS_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-4 (14.23) staging `build` — the corruption applies to a " +
          "record the product itself wrote (SPEC 12.1, 13.3; H-3)",
      );
      await corruptGraphDataShapeBlind(workspace.root, "T14-4 (14.23)");

      // Each reporter's one finding — 14.23's, and `check`'s 14.10 unit
      // form — concerns the graph-data area, `.xspec`, never a path inside
      // it (the record's layout is unenumerated), and locates nothing in
      // source; `check`'s unit form instructs rebuilding (SPEC 14, 14.23,
      // 14.10, 11.6, 13.3, 12.7).
      const inventoryContext = "T14-4 (14.23) `inventory`";
      const inventoryFindings = decodeInventoryFindings(
        await runJsonExpecting(
          product,
          workspace,
          ["inventory"],
          1,
          `${inventoryContext} — the condition-23 finding accompanies ` +
            `the answer and the invocation exits 1 (SPEC 14.23, 11.6)`,
        ),
        inventoryContext,
      );
      assertConditionCounts(
        inventoryFindings,
        { "14.23": 1 },
        `${inventoryContext} — the unreadable record is the inventory ` +
          `answer's one finding on the otherwise clean workspace (SPEC ` +
          `14.23, 11.6)`,
      );
      assertConcernedPathAlone(
        inventoryFindings[0]!,
        GRAPH_DATA_AREA_PATH,
        inventoryContext,
        "SPEC 14, 14.23, 11.6, 12.7",
      );

      const previewContext =
        "T14-4 (14.23) `rename specs/a.mdx a1 a2 --preview --json`";
      const previewFindings = decodePreviewReport(
        await runJsonExpecting(
          product,
          workspace,
          ["rename", "specs/a.mdx", "a1", "a2", "--preview", "--json"],
          1,
          `${previewContext} — the condition-23 finding accompanies the ` +
            `answer and the invocation exits 1 (SPEC 14.23, 6.6)`,
        ),
        previewContext,
      ).findings;
      assertConditionCounts(
        previewFindings,
        { "14.23": 1 },
        `${previewContext} — the preview consults the record for its ` +
          `delta, so the otherwise valid plan's report carries exactly ` +
          `the condition-23 finding (SPEC 14.23, 6.6; the delta's ` +
          `unavailability and the plan's completeness are T6.6-6's)`,
      );
      assertConcernedPathAlone(
        previewFindings[0]!,
        GRAPH_DATA_AREA_PATH,
        previewContext,
        "SPEC 14, 14.23, 11.6, 12.7",
      );

      const unitContext = "T14-4 (14.23) `check --json`";
      const unitFindings = await checkFindings(product, workspace, unitContext);
      assertConditionCounts(
        unitFindings,
        { "14.10": 1 },
        "T14-4 (14.23) `check` reports the state as staleness — exactly " +
          "one condition-10 finding, the unit form: never 14.23, never " +
          "the mismatch form or a per-file finding beside it on the " +
          "freshly built, otherwise clean workspace (SPEC 14.23, 14.10; " +
          "depth: T12.2-2)",
      );
      assertConcernedPathAlone(
        unitFindings[0]!,
        GRAPH_DATA_AREA_PATH,
        `${unitContext} (14.10's unit form)`,
        "SPEC 14, 14.10, 11.6, 12.7",
      );
      assertFindingInstructsRebuilding(
        unitFindings[0]!,
        `${unitContext} (14.10's unit form) — the record that cannot be ` +
          `read is reported as staleness's one unit-form finding, ` +
          `instructing rebuilding (SPEC 14, 14.10, 14.23)`,
      );

      await expectExit(
        product,
        workspace,
        ["query", "nodes"],
        0,
        "T14-4 (14.23) `query nodes` on the corrupt-record state — the " +
          "refreshing reads never report 14.23: they leave the record " +
          "unconsulted and answer finding-free, exit 0 (SPEC 14.23, 13.3; " +
          "depth: T13.3-2)",
      );

      await expectExit(
        product,
        workspace,
        ["build"],
        0,
        "T14-4 (14.23) `build` on the corrupt-record state — `build` " +
          "never reports 14.23: its rebuild replaces the record (SPEC " +
          "14.23, 12.1)",
      );
      await expectExit(
        product,
        workspace,
        ["check"],
        0,
        "T14-4 (14.23) `check` after the rebuild — the successful " +
          "`build` replaced the unreadable state (SPEC 14.23, 12.1, 13.3)",
      );
    });

    // --- 14.14: reported by `build` and `check` alike — as the
    // every-command usage error of its entry (exit 2, not a finding).
    // Staged on BOGUS_KEY_DECL.
    await withWorkspace(BOGUS_KEY_DECL, async (workspace) => {
      await expectConfigurationError(
        product,
        workspace,
        ["build"],
        "T14-4 (14.14) `build` under an unknown configuration key " +
          "(SPEC 14.14, 7, 12.0)",
      );
      await expectConfigurationError(
        product,
        workspace,
        ["check"],
        "T14-4 (14.14) `check` under the same configuration (SPEC 14.14, " +
          "7, 12.0)",
      );

      // Never `version`: it loads no configuration, so configuration-error
      // precedence cannot reach it — on the same invalid configuration
      // that makes `build`/`check` exit 2, `version` answers at exit 0
      // with a single JSON document as its entire stdout (12.6 is
      // JSON-only). Membership only; the byte-identity and document-form
      // depth is T12.6-1/2's.
      const versionContext =
        "T14-4 (14.14) `version` under the same invalid configuration";
      parseJsonStdout(
        await expectExit(
          product,
          workspace,
          ["version"],
          0,
          `${versionContext} — \`version\` loads no configuration and ` +
            `cannot fail for workspace or configuration reasons: 14.14 is ` +
            `delivered by every command that loads configuration, never ` +
            `\`version\` (SPEC 12.6, 14.14)`,
        ),
        `${versionContext} — a JSON-only surface: a single JSON document ` +
          `is its only output form, with or without --json (SPEC 12.6, 12.0)`,
      );
    });

    // --- Every other condition: reported by both `build` and `check`, and
    // per its staging's kind by the machine-interface answers (SPEC 11.2;
    // the availability rows of the module header). 14.13 and 14.22 instead
    // ride the gated reads and accompany no such answer. At every reporter
    // an own row's concern is identified too (assertSweepFindings,
    // SweepConcern; SPEC 14, 12.7).
    for (const entry of SWEEP_ENTRIES) {
      await withWorkspace(entry.decl, async (workspace) => {
        await entry.prepare?.(product, workspace);
        const buildContext = `T14-4 (${entry.label}) \`build --json\``;
        assertSweepFindings(
          await buildFindings(product, workspace, buildContext),
          entry,
          buildContext,
          `condition ${entry.condition} is a \`build\` finding, counted ` +
            `exactly (\`build\` cannot observe 14.10; SPEC 14, 12.1)`,
        );
        const checkContext = `T14-4 (${entry.label}) \`check --json\``;
        assertSweepFindings(
          await checkFindings(product, workspace, checkContext),
          entry,
          checkContext,
          `condition ${entry.condition} is a \`check\` finding, counted ` +
            `exactly, 14.10 included (see the module header; SPEC 14, ` +
            `12.2, 14.10)`,
        );

        if (entry.answers.kind === "no-domain-file") {
          // Reported by the gated reads (SPEC 13.3: the gate is over every
          // finding a `build` would report — journal errors and refused
          // writes alike), probed via one read; the six-read breadth and
          // modifies-nothing compares are T13.3-3's.
          const gatedContext = `T14-4 (${entry.label}) \`query nodes\``;
          assertSweepFindings(
            decodeFindingsReport(
              await runJsonExpecting(
                product,
                workspace,
                ["query", "nodes"],
                1,
                `${gatedContext} — a gated read on the failing workspace ` +
                  `reports the gate's findings and exits 1 without ` +
                  `answering (SPEC 13.3, 12.0)`,
              ),
              gatedContext,
            ).findings,
            entry,
            gatedContext,
            `condition ${entry.condition} is the gated reads' finding, ` +
              `exactly as a \`build\`'s (SPEC 13.3, 14; depth: T13.3-3)`,
          );
          // ...yet accompanying no `occurrences`/`view`/`at` answer: the
          // condition is the finding of no domain file — the journal and a
          // write-path component are never domain files — so these
          // surfaces answer finding-free at exit 0 over the staged valid
          // spec source (SPEC 11.2; depth: T11.2-6).
          for (const probe of availabilityProbes(entry.answers.file)) {
            const context = `T14-4 (${entry.label}) ${probe.what}`;
            assertConditionCounts(
              probe.findingsOf(
                await runJson(
                  product,
                  workspace,
                  probe.argv,
                  `${context} — a complete, finding-free answer exits 0 ` +
                    `whatever journal or write-path state the workspace ` +
                    `holds (SPEC 11.2)`,
                ),
                context,
              ),
              {},
              `${context} — condition ${entry.condition} is the finding of ` +
                `no domain file, so it accompanies no answer of this ` +
                `surface (SPEC 11.2, 14; depth: T11.2-6)`,
            );
          }
          return;
        }

        // A domain file's finding accompanies the answers of each surface
        // whose domain can hold its staged file: all three for a
        // spec-source staging; `occurrences` alone for a code-source one —
        // 14.7/14.11/14.18 locate in code sources alone, and `view`'s and
        // `at`'s domains hold spec sources only (SPEC 11.2, 11.3-11.5;
        // depth: T11.2-5).
        const probes =
          entry.answers.kind === "spec-source"
            ? availabilityProbes(entry.answers.file)
            : [OCCURRENCES_PROBE];
        for (const probe of probes) {
          const context = `T14-4 (${entry.label}) ${probe.what}`;
          assertSweepFindings(
            probe.findingsOf(
              await runJsonExpecting(
                product,
                workspace,
                probe.argv,
                1,
                `${context} — an answer carrying any finding exits 1 with ` +
                  `the full answer document still emitted (SPEC 11.2)`,
              ),
              context,
            ),
            entry,
            context,
            `condition ${entry.condition} is a domain file's finding and ` +
              `accompanies the answer, counted exactly (these surfaces ` +
              `never report 14.10, which is \`check\`'s alone; SPEC 11.2, ` +
              `11.3-11.5, 14)`,
          );
        }
      });
    }
  },
});

// ---------------------------------------------------------------------------
// T14-5 — grammar selection by file name
// ---------------------------------------------------------------------------

// One named unit holding a dependency marker, a `text(...)` call, and the
// TSX-only construct. The same bytes serve the `.tsx` arm (parses as TSX,
// SPEC 14.20) and the `.mts` arm (any name but `.tsx` selects plain
// TypeScript — the fragment fails 14.20 exactly as T14-3's `.ts` arm does).
const T14_5_UNIT_SOURCE = [
  'import SPEC, { text } from "../specs/U.xspec";',
  "",
  "function render(): void {",
  "  SPEC.t1;",
  "  text(SPEC.t2);",
  `  ${TSX_ONLY_STATEMENT}`,
  "  void view;",
  "}",
  "",
].join("\n");

// Both arms' spec source: the `.mts` arm follows the `.tsx` arm's
// invocations, so it is a staged-source record (S-9), staged by both.
const T14_5_SPEC_SOURCE = stagedMdx(
  "T14-5 specs/U.mdx (the .tsx and .mts arms' spec source: the marker target t1 and the embedded target t2)",
  [
    '<S id="t1">',
    "Marker target.",
    "</S>",
    "",
    '<S id="t2">',
    "Embedded target.",
    "</S>",
    "",
  ].join("\n"),
);

function codeGroupConfig(glob: string): string {
  return `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["${glob}"]
  }
})
`;
}

// The `.mts` arm's configuration and code file follow the `.tsx` arm's
// invocations, so they are staged-source records (S-9; helpers/staged-ts.ts):
// the configuration `codeGroupConfig("src/**/*.mts")`'s record, and the
// shared unit's bytes declared unparseable under the plain-TypeScript
// grammar the `.mts` name selects (14.20). The `.tsx` arm, the body's first
// workspace, stages the plain constants.
const T14_5_MTS_CONFIG = stagedTs(
  "T14-5 xspec.config.ts (one spec group and the code group app over src/**/*.mts)",
  codeGroupConfig("src/**/*.mts"),
);
const T14_5_MTS_SOURCE = stagedTs(
  "T14-5 src/view.mts (the TSX-only unit under a plain-TypeScript name)",
  T14_5_UNIT_SOURCE,
  "unparseable",
);

const T14_5 = defineProductTest({
  id: "T14-5",
  title:
    "a code-group file named `.tsx` holding a TSX-only construct inside a named unit with a dependency marker and a `text(...)` call: `build` succeeds — `.tsx` parses as TSX — and the marker's `references` edge and the call's `embeds` edge attribute to that unit per 4.6; the same construct in a code-group `.mts` file fails 14.20 identically — any name but `.tsx` selects plain TypeScript (SPEC 14.20, 4.6)",
  run: async (product) => {
    // Positive arm: `.tsx` parses as TSX, and both edges are recorded and
    // attributed to the enclosing named unit.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": codeGroupConfig("src/**/*.tsx"),
          "specs/U.mdx": T14_5_SPEC_SOURCE,
          "src/view.tsx": T14_5_UNIT_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T14-5 `build` over the `.tsx` code file — the file name selects " +
            "the TSX grammar, so the fragment parses (SPEC 14.20)",
        );
        const referencesLabel =
          "T14-5 `query edges --kinds references` after the `.tsx` build";
        assertEdgeSetEqual(
          decodeEdgesReport(
            await runJson(
              product,
              workspace,
              ["query", "edges", "--kinds", "references"],
              referencesLabel,
            ),
            referencesLabel,
          ),
          [
            {
              from: "src/view.tsx#render",
              to: "specs/U.mdx#t1",
              kind: "references",
            },
          ],
          "T14-5 the marker's `references` edge is recorded and attributed " +
            "to the enclosing named unit of the `.tsx` file (SPEC 4.6, 4.5)",
        );
        const embedsLabel =
          "T14-5 `query edges --kinds embeds` after the `.tsx` build";
        assertEdgeSetEqual(
          decodeEdgesReport(
            await runJson(
              product,
              workspace,
              ["query", "edges", "--kinds", "embeds"],
              embedsLabel,
            ),
            embedsLabel,
          ),
          [
            {
              from: "src/view.tsx#render",
              to: "specs/U.mdx#t2",
              kind: "embeds",
            },
          ],
          "T14-5 the `text(...)` call's `embeds` edge is recorded and " +
            "attributed to the same named unit (SPEC 4.6, 4.3)",
        );
      },
    );

    // Negative arm: the same bytes in a code-group file named `.mts` fail
    // 14.20 identically — discriminating against products keying
    // specifically on `.ts` (the `.ts` direction itself is T14-3's).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": T14_5_MTS_CONFIG,
          "specs/U.mdx": T14_5_SPEC_SOURCE,
          // S-9: any name but `.tsx` selects plain TypeScript, so the
          // TSX-only construct is unparseable here (14.20) — the record's
          // declaration.
          "src/view.mts": T14_5_MTS_SOURCE,
        },
      },
      async (workspace) => {
        const context = "T14-5 `build --json` over the `.mts` code file";
        const findings = await buildFindings(product, workspace, context);
        assertConditionCounts(
          findings,
          { "14.20": 1 },
          `${context} — any name but \`.tsx\` selects plain TypeScript, so ` +
            `the fragment is a parse failure and everything inside the ` +
            `file is masked (SPEC 14.20, 14)`,
        );
        assertFindingLocated(
          findingOf(findings, "14.20", context),
          { file: "src/view.mts" },
          `${context}: the 14.20 finding names the file and reports the ` +
            `parse-failure location (SPEC 14.20)`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T14-6 — stable codes
// ---------------------------------------------------------------------------

/**
 * The 1-based SPEC 14 ordinal of a `"14.N"` condition identity (the sweep
 * entries' vocabulary). A malformed identity is a harness defect, not a
 * product failure — hence a plain error, never `fail` (H-8 taxonomy).
 */
function conditionOrdinal(condition: string): number {
  const ordinal = Number(condition.slice("14.".length));
  if (
    !condition.startsWith("14.") ||
    !Number.isInteger(ordinal) ||
    ordinal < 1 ||
    ordinal > CONDITION_CODE_TOKENS.length
  ) {
    throw new Error(
      `section-14 harness defect: no SPEC 14 condition ${JSON.stringify(condition)} exists`,
    );
  }
  return ordinal;
}

/**
 * The T14-6 per-condition assertion: at least one finding, and EVERY finding
 * carries the staged condition's exact stable code token as its `code` —
 * strict string equality against the harness-pinned SPEC 14 token table
 * (model.ts CONDITION_CODE_TOKENS: index N-1 holds condition 14.N's token).
 * The form-exact decode already admits only known tokens or null (S-5), so
 * with this equality an omitted, misspelled, null, wrong-condition, or
 * numeral-decorated code fails even where exit class and located
 * information are right (SPEC 14, 12.7; T14-6). Every T14-6 staging stages
 * exactly one condition, so "every finding" is the whole report.
 */
function assertExactCodeToken(
  findings: readonly Finding[],
  ordinal: number,
  context: string,
): void {
  const token = CONDITION_CODE_TOKENS[ordinal - 1];
  if (token === undefined) {
    throw new Error(
      `section-14 harness defect: no SPEC 14 condition ${String(ordinal)} exists`,
    );
  }
  if (findings.length === 0) {
    fail(
      `${context}: the staged condition ${String(ordinal)} must be reported — with ` +
        `its finding absent altogether, the stable-code assertion is absent ` +
        `with it (SPEC 14; T14-6 is a positive identity check); got an ` +
        `empty findings array`,
    );
  }
  for (const finding of findings) {
    if (finding.code !== token) {
      fail(
        `${context}: the finding must carry condition ${String(ordinal)}'s stable ` +
          `code — the exact token ${JSON.stringify(token)} as its \`code\` member, ` +
          `the token string alone, the ordinal numeral no part of the value ` +
          `(SPEC 14, 12.7); got ${JSON.stringify(finding.code)} (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
  }
}

/** Assert a code-less finding: `code` null where SPEC 14 assigns none. */
function assertCodeNull(finding: Finding, why: string, context: string): void {
  if (finding.code !== null) {
    fail(
      `${context}: ${why} carries no stable code — \`code\` is null where ` +
        `14 assigns none (SPEC 14, 12.7); got ${JSON.stringify(finding.code)} ` +
        `(message: ${JSON.stringify(finding.message)})`,
    );
  }
}

// The environment refusals of 14.24/14.25 are staged by permission removal
// (E-1), the Linux leg's discipline: elsewhere the arms are not staged (the
// NU3_STAGED pattern of section-11.5); the Windows subset (E-6) selects
// T14-6 nowhere.
const ENVIRONMENT_REFUSALS_STAGED = process.platform === "linux";

// 14.25 (T14-10 (g)'s fixture): a directory the discovery of SPEC 7 lists,
// under the glob `specs/**/*.mdx`, holding a valid source — staged unlistable
// with search permission kept (its entry reachable by name; nonexistence is
// never staged as a refusal, 14.25).
const UNLISTABLE_DIR = "specs/sub";
const READ_REFUSAL_DECL: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPECS_ONLY_CONFIG,
    "specs/a.mdx": VALID_A1_BEHAVIOR,
    [`${UNLISTABLE_DIR}/b.mdx`]: stagedMdx(
      "T14-6 specs/sub/b.mdx (the 14.25 arm's valid source under the unlistable directory)",
      '<S id="b1">\nValid behavior.\n</S>\n',
    ),
  },
};

const T14_6 = defineProductTest({
  id: "T14-6",
  title:
    "stable codes: for each of the 25 conditions, staged via its primary test's fixture and read from its stated reporter: conditions 1–23 carry the exact token 14 lists (`missing-id` … `unreadable-record`) as the `code` of their finding in the JSON report form, and conditions 24 and 25 — usage errors, never findings — carry `write-failure` and `read-failure` as the `code` of the exit-2 error document, appearing in no findings array (environment refusals staged by permission removal, Linux leg) — the value is the token string alone, the ordinal numeral no part of it — so a product omitting or misspelling a code fails even where exit class and located information are right; a plain usage error and a review-operation refusal carry no stable code — `code` null (SPEC 14, 12.7, 12.0)",
  timeoutMs: 300_000,
  run: async (product) => {
    // --- The 18 conditions `build` reports, staged as T14-4 sweeps them
    // (their minimal primary-fixture forms) and read from `build --json` —
    // a stated reporter for every one of them: "every other condition
    // reported by both `build` and `check`", 14.13/14.22 "by both `build`
    // and `check` and by the gated reads" (T14-4's matrix).
    for (const entry of SWEEP_ENTRIES) {
      const ordinal = conditionOrdinal(entry.condition);
      await withWorkspace(entry.decl, async (workspace) => {
        await entry.prepare?.(product, workspace);
        const context = `T14-6 (${entry.label}) \`build --json\``;
        assertExactCodeToken(
          await buildFindings(product, workspace, context),
          ordinal,
          `${context} — condition ${entry.condition}'s stable code, read ` +
            `from \`build\``,
        );
      });
    }

    // --- 14.10 `stale-output`: `check` is its sole reporter (SPEC 14.10).
    await withWorkspace(STALE_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-6 (14.10) staging `build` (SPEC 12.1)",
      );
      await workspace.file("specs/a.mdx", STALE_EDIT);
      const context = "T14-6 (14.10) `check --json` on the stale workspace";
      assertExactCodeToken(
        await checkFindings(product, workspace, context),
        10,
        `${context} — staleness is the only staged condition, so every ` +
          `finding carries its code`,
      );
    });

    // --- 14.12 `policy-violation`: `check` only (SPEC 14.12), on the
    // freshly built policy-violating workspace.
    await withWorkspace(POLICY_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-6 (14.12) staging `build` (SPEC 12.1, 14.12: `build` succeeds " +
          "regardless of policy)",
      );
      const context = "T14-6 (14.12) `check --json`";
      assertExactCodeToken(
        await checkFindings(product, workspace, context),
        12,
        context,
      );
    });

    // --- 14.14 `configuration-error`: delivered by every configuration-
    // loading command as the exit-2 usage error; its JSON report form is
    // the error document, whose one finding carries the stable code
    // (SPEC 14.14, 12.0, 12.7).
    await withWorkspace(BOGUS_KEY_DECL, async (workspace) => {
      const context =
        "T14-6 (14.14) `build --json` under the unknown-key configuration";
      const result = await expectExit(
        product,
        workspace,
        ["build", "--json"],
        2,
        `${context} — a configuration error is an exit-2 usage error ` +
          `(SPEC 14.14, 12.0)`,
      );
      assertExactCodeToken(
        [expectErrorDocument(result, context)],
        14,
        `${context} — the error document's finding`,
      );
    });

    // --- 14.21 `corrupt-session`: `check` (a stated reporter beside the
    // `review` subcommands naming the session and `review list`, SPEC
    // 14.21), on the freshly built workspace plus the garbage session.
    await withWorkspace(VALID_SPECS_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-6 (14.21) staging `build` (SPEC 12.1)",
      );
      await workspace.file(GARBAGE_SESSION_PATH, GARBAGE_SESSION_CONTENT);
      const context = "T14-6 (14.21) `check --json` beside the corrupt session";
      assertExactCodeToken(
        await checkFindings(product, workspace, context),
        21,
        context,
      );
    });

    // --- 14.23 `unreadable-record`: `inventory` (a stated reporter beside
    // the `rename`/`move` previews, SPEC 14.23) — the finding accompanies
    // the answer with its stable code, exit 1; the corruption applies to a
    // record the product itself wrote (H-3).
    await withWorkspace(VALID_SPECS_DECL, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-6 (14.23) staging `build` (SPEC 12.1, 13.3; H-3)",
      );
      await corruptGraphDataShapeBlind(workspace.root, "T14-6 (14.23)");
      const context = "T14-6 (14.23) `inventory`";
      assertExactCodeToken(
        decodeInventoryFindings(
          await runJsonExpecting(
            product,
            workspace,
            ["inventory"],
            1,
            `${context} — the condition-23 finding accompanies the answer ` +
              `with its stable code and the invocation exits 1 (SPEC 14.23, ` +
              `11.6)`,
          ),
          context,
        ),
        23,
        context,
      );
    });

    // --- 14.24 `write-failure` and 14.25 `read-failure`: usage errors,
    // never findings (SPEC 14.24, 14.25, 12.0) — each carries its stable
    // code as the exit-2 error document's `code`, in no findings array
    // (12.7). Both are environment refusals staged by permission removal
    // alone (E-1, Linux leg): the harness verifies each staging on itself
    // before the product runs and reports an ineffective one — a privileged
    // runner — as a harness error, never a pass or a skip (H-9, H-11).
    if (ENVIRONMENT_REFUSALS_STAGED) {
      // 14.24, T14-9 (f)'s staging: a stale workspace whose graph-data area
      // `.xspec` is unwritable — `build` (14.24's first-listed reporter)
      // regenerates the derived files under the writable `specs/` and is
      // refused at its graph-data write, whatever its write order: the
      // command stops at the refused write and exits 2 (12.0: met only at
      // the write it refuses, after every check and validation — the stale
      // workspace passes them all).
      await withWorkspace(STALE_DECL, async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T14-6 (14.24) staging `build` (SPEC 12.1)",
        );
        await workspace.file("specs/a.mdx", STALE_EDIT);
        const staging = await stageWriteRefusalUnder(
          path.join(workspace.root, ".xspec"),
        );
        try {
          const context =
            "T14-6 (14.24) `build --json` with `.xspec` unwritable on the " +
            "stale workspace";
          const result = await expectExit(
            product,
            workspace,
            ["build", "--json"],
            2,
            `${context} — a write the environment refuses is a usage ` +
              `error, exit 2, never a finding (SPEC 14.24, 12.0)`,
          );
          assertExactCodeToken(
            [expectErrorDocument(result, context)],
            24,
            `${context} — the error document's finding`,
          );
        } finally {
          await staging.restore();
        }
      });

      // 14.25, T14-10 (g)'s staging: a directory discovery lists, staged
      // unlistable — every command that loads the configuration exits 2
      // with the error document at the read (14.25: reported by every
      // command making the read); `build` is the representative.
      await withWorkspace(READ_REFUSAL_DECL, async (workspace) => {
        const staging = await stageReadRefusalOfDirectory(
          path.join(workspace.root, UNLISTABLE_DIR),
        );
        try {
          const context =
            "T14-6 (14.25) `build --json` with `specs/sub` unlistable";
          const result = await expectExit(
            product,
            workspace,
            ["build", "--json"],
            2,
            `${context} — a read the environment refuses is a usage ` +
              `error, exit 2, never a finding (SPEC 14.25, 12.0)`,
          );
          assertExactCodeToken(
            [expectErrorDocument(result, context)],
            25,
            `${context} — the error document's finding`,
          );
        } finally {
          await staging.restore();
        }
      });
    }

    // --- `code` null: a plain usage error (T12.7-3's staging — an unknown
    // command, the error determined by the invocation's syntax alone)
    // describes the invocation the consuming tool composed and carries no
    // stable code (SPEC 14, 12.0).
    await withWorkspace(VALID_SPECS_DECL, async (workspace) => {
      const context =
        "T14-6 (plain usage error) `definitely-not-a-command --json`";
      const result = await expectExit(
        product,
        workspace,
        ["definitely-not-a-command", "--json"],
        2,
        `${context} — an unknown command is a plain usage error (SPEC 12.0)`,
      );
      assertCodeNull(
        expectErrorDocument(result, context),
        "a plain usage error",
        context,
      );
    });

    // --- `code` null: a review-operation refusal (T12.7-1's staging —
    // `create` with an existing session's exact name, refused per SPEC
    // 10.1/10.7; the audit strategy needs no git).
    await withWorkspace(VALID_SPECS_DECL, async (workspace) => {
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "s"],
        0,
        "T14-6 (review refusal) staging `review create --strategy audit " +
          "--name s` — the first creation succeeds on the valid workspace " +
          "(SPEC 10.1, 10.6)",
      );
      const context =
        "T14-6 (review refusal) `review create --strategy audit --name s " +
        "--json` again";
      const result = await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "s", "--json"],
        1,
        `${context} — \`create\` with an existing session's exact name is ` +
          `refused: exit 1, a refused review operation (SPEC 10.1, 10.7, ` +
          `12.0)`,
      );
      const findings = decodeFindingsReport(
        parseJsonStdout(
          result,
          `${context} — a refused operation's report is the findings-only ` +
            `document {"findings": […]} (SPEC 12.7)`,
        ),
        context,
      ).findings;
      if (findings.length === 0) {
        fail(
          `${context}: the refusal must be reported as at least one ` +
            `finding — an exit-1 refusal with an empty findings array ` +
            `reports nothing (SPEC 10.7, 12.7, 14)`,
        );
      }
      for (const finding of findings) {
        assertCodeNull(finding, "a review-operation refusal", context);
      }
    });
  },
});

// ---------------------------------------------------------------------------
// T14-7 — refusal reasons
// ---------------------------------------------------------------------------

/**
 * The T14-7 reporting contract over one refused invocation (SPEC 14, 12.7):
 * run with `--json`, assert exit 1 exactly (refusals are findings in the
 * exit-code partition, SPEC 12.0; H-5), decode stdout as the form-exact 12.7
 * findings-only report (H-3), assert the exact finding multiset — one
 * finding per applicable reason (or per staged numbered condition, for the
 * invalid-workspace refusal), never only the first found, none beside — and
 * assert each expected finding's concerned file/range/identity (the
 * SOME-quantified location of the home operationalization; module header)
 * or, where the case declares its complete bearer set (`locatedAtEach`),
 * exactly that set — every colliding bearer or would-be cycle participant,
 * none beside (SPEC 14); a
 * reason concerning a path (`path` stated) carries it as the finding's
 * `path` with `locations` `[]` (SPEC 14, 12.7). The modifies-nothing
 * compares are the home tests' subject (T6.4-3, T6.5-4); the symbolic-link
 * arms' link-and-target compare wraps this contract
 * (`assertLinkAndTargetUnchanged`). Per-reason concern lookup is by counting key, total because a
 * refusal report never carries two findings of one reason (SPEC 14: one
 * finding per reason). No report carries a code outside 14's list: the
 * form-exact decode admits only 14's codes (forms.ts KNOWN_CODE_TOKENS —
 * the 25 condition tokens and the eleven refusal reasons), so an unlisted
 * code, the retired `refused-unresolvable-reference` included, fails as an
 * H-3 form failure before any count, and the exact multiset excludes every
 * listed code beside the expected ones.
 */
async function assertRefusalReport(
  product: ProductBinding,
  workspace: TestWorkspace,
  argv: readonly string[],
  expected: RefusalExpectation | readonly RefusalExpectation[],
  context: string,
): Promise<void> {
  const expectations: readonly RefusalExpectation[] = Array.isArray(expected)
    ? expected
    : [expected];
  const command = argv.join(" ");
  const result = await expectExit(
    product,
    workspace,
    [...argv, "--json"],
    1,
    `${context}: \`${command} --json\` — a refusal is a validation failure, ` +
      `exit 1 (SPEC 6.4, 6.5, 12.0)`,
  );
  const findings = decodeFindingsReport(
    parseJsonStdout(result, `${context}: \`${command} --json\``),
    `${context}: \`${command} --json\` — a refused operation's report is ` +
      `the form-exact 12.7 findings-only report (SPEC 12.7, H-3)`,
  ).findings;
  const counts: Record<string, number> = {};
  for (const expectation of expectations) {
    counts[expectation.finding] = (counts[expectation.finding] ?? 0) + 1;
  }
  assertConditionCounts(
    findings,
    counts,
    `${context}: every applicable reason reports together, one finding per ` +
      `reason — never only the first found — and none beside the staged ` +
      `one(s), each carrying its exact stable code (SPEC 14, 12.7)`,
  );
  for (const expectation of expectations) {
    const finding = findings.find(
      (candidate) =>
        (candidate.condition ?? candidate.code ?? "(code-less)") ===
        expectation.finding,
    );
    if (finding === undefined) {
      fail(
        `${context}: no reported finding carries ` +
          `${JSON.stringify(expectation.finding)} (SPEC 14, 12.7)`,
      );
    }
    if (expectation.locatedAt !== undefined) {
      assertFindingMentionsLocation(
        finding,
        expectation.locatedAt,
        `${context}: the ${expectation.finding} finding's concerned construct`,
      );
    }
    if (expectation.locatedAtEach !== undefined) {
      assertFindingLocatesExactly(
        finding,
        expectation.locatedAtEach,
        `${context}: the ${expectation.finding} finding's complete ` +
          `located-bearer set — every colliding bearer or would-be cycle ` +
          `participant, none beside`,
      );
    }
    assertRefusalIdentities(
      finding,
      expectation.finding,
      expectation.identities,
      `${context}: the ${expectation.finding} finding's concerned identity`,
    );
    if (expectation.path !== undefined) {
      assertFindingConcernsPath(
        finding,
        expectation.path,
        `${context}: the ${expectation.finding} finding's concerned path`,
      );
      if (finding.locations.length !== 0) {
        fail(
          `${context}: the ${expectation.finding} finding concerns a path, ` +
            `so it carries that path as its \`path\` with \`locations\` [] ` +
            `(SPEC 14, 12.7); got ` +
            JSON.stringify(
              finding.locations.map((location) => ({
                file: renderPathValue(location.file),
                range: location.range,
              })),
            ),
        );
      }
    }
  }
}

/**
 * The link and its target byte-identical around one refusal (TEST-SPEC
 * T14-7, over T6.5-4's symbolic-link arms): the workspace root narrowed to
 * the link itself — an entry recording its kind and verbatim target bytes,
 * never followed (snapshot.ts) — and, where the link resolves inside the
 * root, every entry of its target directory, the ancestors of both kept as
 * bare directory entries and every other entry pruned; a target outside the
 * root is compared on its own around that narrowed compare, since no view
 * of the root can see a write landing there (SPEC 6.5, 13.4).
 */
async function assertLinkAndTargetUnchanged(
  workspace: TestWorkspace,
  link: string,
  action: () => Promise<void>,
  context: string,
): Promise<void> {
  const kind = await workspace.kind(link);
  if (kind !== "symlink") {
    fail(
      `${context}: staging premise — ${link} is the symbolic link T6.5-4's ` +
        `link-component staging put there, untouched since by every ` +
        `refused operation and by the premise \`build\`, which neither ` +
        `traverses nor replaces it (SPEC 6.5: a refused operation modifies ` +
        `nothing; 7, 13.4); found ${kind}`,
    );
  }
  const linkPath = workspace.path(link);
  const target = path.resolve(
    path.dirname(linkPath),
    await workspace.linkTarget(link),
  );
  const fromRoot = path.relative(workspace.root, target);
  const insideTarget =
    fromRoot !== "" && !fromRoot.startsWith("..") && !path.isAbsolute(fromRoot)
      ? fromRoot.split(path.sep).join("/")
      : null;
  const kept = (rel: string): boolean =>
    rel === link ||
    link.startsWith(`${rel}/`) ||
    (insideTarget !== null &&
      (rel === insideTarget ||
        insideTarget.startsWith(`${rel}/`) ||
        rel.startsWith(`${insideTarget}/`)));
  const narrowed = (): Promise<void> =>
    assertLeavesUnchanged(
      workspace.root,
      action,
      `${context}: the symbolic link ${link} and its target stay ` +
        `byte-identical — nothing written through or over the link (SPEC ` +
        `6.5, 13.4; TEST-SPEC T14-7)`,
      { exclude: (bytes) => !kept(Buffer.from(bytes).toString("utf8")) },
    );
  if (insideTarget !== null) {
    await narrowed();
    return;
  }
  await assertLeavesUnchanged(
    target,
    narrowed,
    `${context}: the target directory of the symbolic link ${link}, ` +
      `outside the workspace root, stays byte-identical — nothing written ` +
      `through the link (SPEC 6.5, 13.4; TEST-SPEC T14-7)`,
  );
}

// The destination-path directory-component staging (the other
// destination-side directory-component case of SPEC 6.5, beside T6.5-4's
// derived-path arm): the plain file `specs/blocked` occupies a
// workspace-relative directory component of the destination path
// `specs/blocked/Out.mdx`. The occupant matches no configured glob (no
// `.mdx`) and lies under no current source's write path, so the premise
// `build` passes and the refusal is the move's own —
// refused-invalid-destination concerning the destination path, never 14.22
// (SPEC 6.5, 14.22, 14). Soundness: without the occupant the identical move
// succeeds and creates `specs/blocked/Out.mdx` (writes create missing
// directories, 13.4) — component occupancy is the arm's sole defect.
const T14_7_COMPONENT_OCCUPANT = "specs/blocked";
const T14_7_COMPONENT_DEST = "specs/blocked/Out.mdx";
const T14_7_COMPONENT_FILES: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": SPECS_ONLY_CONFIG,
  "specs/Src.mdx": V4_SOLO_SOURCE,
  [T14_7_COMPONENT_OCCUPANT]: "not a directory\n",
};

// The every-applicable-reason staging: a section move staged to BOTH collide
// and create a dependency cycle. `mv` carries `d={"keep"}` and the move
// `specs/M.mdx#mv` → `specs/M.mdx#keep.mv` would make it `keep`'s child — a
// dependency on its own ancestor, a cycle (SPEC 5.3, 6.5) — while the
// occupant child already identified `keep.mv` remains after the removal (the
// vacated set is exactly the moved subtree's IDs, here `mv` alone), so the
// prefix-replaced new ID collides (SPEC 6.5). Each reason's applicability
// reads on its own terms (SPEC 14): both findings, never only the first.
const T14_7_MULTI_FILE = "specs/M.mdx";
const T14_7_MULTI_SOURCE = [
  '<S id="keep">',
  "Keep holder text.",
  "",
  '<S id="keep.mv">',
  "Occupant child text.",
  "</S>",
  "</S>",
  "",
  '<S id="mv" d={"keep"}>',
  "Moved candidate text.",
  "</S>",
  "",
].join("\n");

// The staged source (S-9: every T14-7 workspace after the first follows the
// body's first invocations — a staged-source record, made from the string
// the windows below are computed from).
const T14_7_MULTI_STAGED = stagedMdx(
  "T14-7 every-applicable-reason arm specs/M.mdx (keep holding the occupant keep.mv; mv depending on keep)",
  T14_7_MULTI_SOURCE,
);

// The remaining colliding bearer's whole construct — the collision's
// complete bearer set (SPEC 14: every colliding bearer; the occupant is the
// one ID remaining after the removal that the new ID collides with, so the
// finding locates it exactly, none beside — the moved section bears `mv`,
// not `keep.mv`) — and the dependency cycle's participating reference
// spelling (the home operationalization of "locating the would-be cycle's
// full path").
const T14_7_OCCUPANT_CONSTRUCT = '<S id="keep.mv">\nOccupant child text.\n</S>';
const T14_7_OCCUPANT_WINDOW = byteWindow(
  T14_7_MULTI_SOURCE.slice(
    0,
    T14_7_MULTI_SOURCE.indexOf(T14_7_OCCUPANT_CONSTRUCT),
  ),
  T14_7_OCCUPANT_CONSTRUCT,
);
const T14_7_CYCLE_SPELLING = 'd={"keep"}';
const T14_7_CYCLE_WINDOW = byteWindow(
  T14_7_MULTI_SOURCE.slice(0, T14_7_MULTI_SOURCE.indexOf(T14_7_CYCLE_SPELLING)),
  T14_7_CYCLE_SPELLING,
);

// The invalid-workspace staging: rename `a.mid` → `a.sib` is staged to
// collide with the remaining `a.sib` bearer (the control arm pins that
// premise on the valid twin), and `specs/Bad.mdx` is then broken with an
// unresolved `d` reference (14.5) — the workspace failing `build`'s
// validations through a file the rename's arguments never touch, while the
// usage-error argument checks still pass (the origin file exists and spells
// `a.mid`, SPEC 6.4, 12.0).
const T14_7_RENAME_FILE = "specs/R.mdx";
const T14_7_RENAME_SOURCE = [
  '<S id="a">',
  "Holder text.",
  "",
  '<S id="a.mid">',
  "Mid text.",
  "</S>",
  "",
  '<S id="a.sib">',
  "Sib text.",
  "</S>",
  "</S>",
  "",
].join("\n");
const T14_7_SIB_CONSTRUCT = '<S id="a.sib">\nSib text.\n</S>';
const T14_7_SIB_WINDOW = byteWindow(
  T14_7_RENAME_SOURCE.slice(
    0,
    T14_7_RENAME_SOURCE.indexOf(T14_7_SIB_CONSTRUCT),
  ),
  T14_7_SIB_CONSTRUCT,
);
const T14_7_RENAME_STAGED = stagedMdx(
  "T14-7 invalid-workspace arm specs/R.mdx (a holding a.mid and a.sib)",
  T14_7_RENAME_SOURCE,
);
const T14_7_BAD_FILE = "specs/Bad.mdx";
const T14_7_BAD_VALID = stagedMdx(
  "T14-7 invalid-workspace arm specs/Bad.mdx (the valid twin: bad, before its unresolved dependency target is staged)",
  '<S id="bad">\nBad-file text, valid for the control arm.\n</S>\n',
);
// The invalid twin is staged after the control arm's invocations — a
// staged-source record (S-9, test/self/s9-staged-sources.test.ts), as are
// the arm's initial sources (the workspace follows the body's first
// invocations).
const T14_7_BAD_INVALID = stagedMdx(
  "T14-7 specs/Bad.mdx with an unresolved dependency target (the invalid-workspace arm)",
  '<S id="bad" d={"nope"}>\nUnresolved dependency target.\n</S>\n',
);

// The destination-spelling staging (T14-7's own; SPEC 14, 6.5, 12.0):
// occupancy is judged at a path in discovered-path form alone, so a
// destination spelled with a `.`, `..`, or empty segment — `./a.mdx` for the
// origin `a.mdx` (the self-move by spelling), `specs//b.mdx`, and
// `specs/../specs/b.mdx`, each naming an occupied path were it normalized —
// is refused-invalid-destination alone, concerning the path as spelled:
// never refused-destination-exists, never refused-identity-unchanged (the
// exact one-entry multiset excludes both), and never performed (exit 1). The
// root-level origin `a.mdx` needs a root-level glob (SPEC 7.1: any glob list,
// every match `.mdx`). The section form's target path so spelled is refused
// alike; its `<new-id>` `z` collides with nothing anywhere, so no second
// reason could apply even to a product normalizing the spelling. The arm's
// workspace follows the body's first invocations, so its configuration is
// a staged-source record (S-9; helpers/staged-ts.ts).
const T14_7_SPELLING_CONFIG = stagedTs(
  "T14-7 destination-spelling arm xspec.config.ts (the root-level glob *.mdx beside specs/**/*.mdx)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["*.mdx", "specs/**/*.mdx"]
  }
})
`,
);
const T14_7_SPELLING_ORIGIN = "a.mdx";
const T14_7_SPELLING_FILES: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": T14_7_SPELLING_CONFIG,
  [T14_7_SPELLING_ORIGIN]: stagedMdx(
    "T14-7 destination-spelling arm a.mdx (the root-level origin x)",
    '<S id="x">\nX text.\n</S>\n',
  ),
  "specs/b.mdx": A13_FOURTH_STAGED,
};
const T14_7_SPELLED_DESTINATIONS: readonly string[] = [
  "./a.mdx",
  "specs//b.mdx",
  "specs/../specs/b.mdx",
];

// The spec-import-cycle location staging (T14-7's own; SPEC 14, 6.5, 5.7):
// `B` imports `A` (the declaration `b`'s external reference to `keep` uses),
// and `user`, a section of `A` outside the moved subtree, references `x` in
// local form. Moving `x` into `B` rewrites that reference to `B`'s external
// form, which needs a binding of `B`'s module `A` lacks — the rewrite adds
// `B`'s import to `A`, closing the cycle A → B → A. The refusal locates the
// would-be cycle's full path in pre-operation coordinates: `B`'s existing
// import declaration by its own characters, and the import the move would
// add — existing in no pre-operation source — by the one reference spelling
// whose rewrite requires it (its occurrence span, the reference's own
// expression, 5.7), never a range for the import that does not yet exist.
// Bearers in 12.7's within-finding order: `specs/A.mdx` precedes
// `specs/B.mdx` by path bytes. No dependency cycle arises beside it (`user`
// → `x`, `b` → `keep`), so the finding is the report's only one.
const T14_7_CYCLE_A = "specs/A.mdx";
const T14_7_CYCLE_B = "specs/B.mdx";
const T14_7_CYCLE_A_SOURCE = [
  '<S id="keep">',
  "Keep text.",
  "</S>",
  "",
  '<S id="x">',
  "X text.",
  "</S>",
  "",
  '<S id="user" d={"x"}>',
  "User text.",
  "</S>",
  "",
].join("\n");
const T14_7_IMPORT_DECLARATION = 'import A from "./A.xspec"';
const T14_7_CYCLE_B_SOURCE = stagedMdx(
  "T14-7 import-cycle arm specs/B.mdx (b importing A for keep)",
  [
    T14_7_IMPORT_DECLARATION,
    "",
    '<S id="b" d={A.keep}>',
    "B text.",
    "</S>",
    "",
  ].join("\n"),
);
const T14_7_CYCLE_A_STAGED = stagedMdx(
  "T14-7 import-cycle arm specs/A.mdx (keep, x, and user referencing x in local form)",
  T14_7_CYCLE_A_SOURCE,
);
const T14_7_LOCAL_REFERENCE = 'd={"x"}';
const T14_7_LOCAL_REFERENCE_WINDOW = byteWindow(
  T14_7_CYCLE_A_SOURCE.slice(
    0,
    T14_7_CYCLE_A_SOURCE.indexOf(T14_7_LOCAL_REFERENCE),
  ),
  T14_7_LOCAL_REFERENCE,
);
const T14_7_IMPORT_DECLARATION_WINDOW = byteWindow(
  "",
  T14_7_IMPORT_DECLARATION,
);

// refused-invalid-rewrite and refused-moved-import, via the home tables
// (TEST-SPEC T14-7: T6.5-16, T6.5-17). T14-7 re-asserts the reporting
// contract alone over T6.5-16's and T6.5-17's exported refused arms, each
// staged under the home module's configuration: exit 1, the form-exact
// report, the exact code multiset — the arm's own reason plus every reason
// the entry pins beside it, one finding each — and the arm's finding
// located exactly, every pinned location within its own 1.7 range and none
// beside, in 12.7's within-finding order: the moved section's construct in
// the origin file and, for an addition no offset admits, every reference
// spelling rooted at its binding (refused-invalid-rewrite, `identities` the
// concerned files' paths in byte order); each moved import declaration by
// the import range of 11.4 (refused-moved-import, `identities` empty) —
// `path` null for both, a refusal locating in source concerning no path
// (SPEC 14, 12.7). The S-9 probes of the would-be texts and the
// modifies-nothing compares stay the home tests' subject.
//
// T6.5-16's one arm reported beside `refused-id-collision` is left to its
// home, which asserts that collision's concern data itself: its one
// colliding bearer, the target's `p.n`, located within the bearer's byte
// window, none beside, `path` null, and its `identities` exactly
// `["specs/b.mdx#p.n"]` (the arm's `besideCollision`, read by
// `r16AssertFinding`; SPEC 14, 1.5); T14-7 asserts the collision's located
// bearers and identities over T6.4-3's, T6.5-4's, and its own stagings.
// Every other beside reason's concern follows from the operands alone
// (`besideExpectation`).
const T14_7_INVALID_REWRITE_ARMS: readonly R16RefusedArm[] =
  R16_REFUSED_ARMS.filter(
    (arm) => !(arm.beside ?? []).includes("refused-id-collision"),
  );

/**
 * A home arm's pinned locations as T14-7's complete bearer set: each 1.7
 * range its own window — one location within it, none beside, index-wise in
 * 12.7's order (support.ts assertFindingLocatesExactly, which asserts `path`
 * null with it).
 */
function pinnedBearers(
  locations: readonly R16Location[],
): BearerLocationExpectation[] {
  return locations.map(({ file, start, end }) => ({
    file,
    window: { start, end },
  }));
}

/**
 * The expectation of a reason a home arm pins beside its own (SPEC 14: every
 * applicable reason reports together, one finding per reason), its concern
 * read off the operands as 14 spells it: `refused-invalid-id` concerns the
 * new identity — the `<target-file>#<new-id>` operand verbatim;
 * `refused-missing-target-parent` the target-parent identity — `<new-id>`
 * minus its final segment over the target file; `refused-invalid-destination`
 * the destination path, asserted where the entry pins it (`besidePath`).
 */
function besideExpectation(
  code: string,
  argv: readonly string[],
  besidePath: Readonly<Record<string, string>> | undefined,
): RefusalExpectation {
  const destination = argv[2] ?? "";
  const hash = destination.indexOf("#");
  const targetFile = destination.slice(0, hash);
  const newId = destination.slice(hash + 1);
  switch (code) {
    case "refused-invalid-id":
      return { finding: code, identities: [destination] };
    case "refused-missing-target-parent":
      return {
        finding: code,
        identities: [`${targetFile}#${newId.slice(0, newId.lastIndexOf("."))}`],
      };
    case "refused-invalid-destination": {
      const path = besidePath?.[code];
      return path === undefined ? { finding: code } : { finding: code, path };
    }
    default:
      throw new Error(
        `harness defect: T14-7 states no expectation for the beside reason ` +
          `${JSON.stringify(code)} of a home arm (SPEC 14)`,
      );
  }
}

/** refused-invalid-rewrite over T6.5-16's exported refused arms (the note above). */
async function runT147InvalidRewriteArms(
  product: ProductBinding,
): Promise<void> {
  for (const arm of T14_7_INVALID_REWRITE_ARMS) {
    const context = `T14-7 refused-invalid-rewrite (T6.5-16 ${arm.key})`;
    await withWorkspace(
      { files: { "xspec.config.ts": R16_CONFIG, ...arm.files } },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          `${context}: staging \`build\` — the pre-move workspace valid, ` +
            `every staged file well-formed (the T6.5-16 protocol)`,
        );
        await assertRefusalReport(
          product,
          workspace,
          arm.argv,
          [
            {
              finding: "refused-invalid-rewrite",
              locatedAtEach: pinnedBearers(arm.locations),
              identities: arm.identities,
            },
            ...(arm.beside ?? []).map((code) =>
              besideExpectation(code, arm.argv, arm.besidePath),
            ),
          ],
          `${context} — ${arm.summary}`,
        );
      },
    );
  }
}

/** refused-moved-import over T6.5-17's exported refused arms (the note above). */
async function runT147MovedImportArms(product: ProductBinding): Promise<void> {
  for (const arm of M17_REFUSED_ARMS) {
    const context = `T14-7 refused-moved-import (T6.5-17 ${arm.key})`;
    await withWorkspace(
      { files: { "xspec.config.ts": R16_CONFIG, ...arm.files } },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          `${context}: staging \`build\` — the pre-move workspace valid, ` +
            `the section's ESM block deriving inside it (the T6.5-17 protocol)`,
        );
        await assertRefusalReport(
          product,
          workspace,
          arm.argv,
          [
            {
              finding: "refused-moved-import",
              locatedAtEach: pinnedBearers(arm.locations),
              identities: [],
            },
            ...(arm.beside ?? []).map((code) =>
              besideExpectation(code, arm.argv, undefined),
            ),
          ],
          `${context} — ${arm.summary}`,
        );
      },
    );
  }
}

// The two command lines T14-7 spells for refused-invalid-id (TEST-SPEC
// T14-7: "`identities` exactly `["specs/A.mdx#a.then"]` for `rename
// specs/A.mdx a a.then` and `["specs/B.mdx#x y"]` for `move specs/A.mdx#x
// 'specs/B.mdx#x y'`, the invalid ID spelled verbatim; intrinsic form only";
// SPEC 14, 1.3, 1.4, 6.4, 6.5). Each runs in its home workspace after the
// home table's loop: every refusal there modifies nothing (T6.4-3's and
// T6.5-4's compares), so each arm sees the workspace as staged, and a
// product performing either operation fails the arm's exit assertion first.
// The shared case tables stay untouched, so T6.4-3, T6.5-4, and T6.6-3 do
// not change.
// - The rename makes T6.4-3's top-level `a` (holding `a.mid`, with child
//   `a.mid.kid`, and `a.sib`) the two-segment `a.then`: intrinsically
//   invalid (the forbidden name `then`, 1.4) and misplaced at once (a
//   top-level section's ID has exactly one segment, 1.3). SPEC 14 evaluates
//   the position check only over intrinsically valid IDs, so the report is
//   refused-invalid-id alone, never refused-structural-parent beside it —
//   the home table's `rename specs/A.mdx a.mid a.then` keeps `a.then` under
//   `a`, so it cannot tell — and it concerns the new identity alone, no
//   identity the prefix replacement produces (`a.then.mid`,
//   `a.then.mid.kid`, `a.then.sib`) beside it.
// - The move carries T6.5-4's `x`, holding `x.sub`, into `specs/B.mdx`
//   (holding `b` and `y`) as `x y`, one whitespace-bearing segment (1.4):
//   its target parent is the file root, it collides with nothing, `x` and
//   `x.sub` carry no references (no cycle), and refused-invalid-rewrite is
//   evaluated only over an intrinsically valid new ID — so the report is
//   refused-invalid-id alone, its `identities` exactly the new identity,
//   never the prefix-produced `specs/B.mdx#x y.sub` (SPEC 14: no produced
//   identity reports separately). The last operand is one argv element
//   holding a space (the entry's quotes are shell quoting).
// assertRefusalReport's exact one-entry multiset and exact `identities`
// compare give both arms their teeth. Each arm's premise — the descendants
// whose produced identities it asserts absent — is checked against the home
// fixture's staged bytes (never the live workspace, which only a product
// could have changed); a fixture no longer staging them is a harness defect.

/** One spelled refused-invalid-id command line (the note above). */
interface IntrinsicInvalidIdArm {
  /** The command line as T14-7 spells it, for diagnoses. */
  readonly spelled: string;
  readonly argv: readonly string[];
  /** The one expected `identities` entry: the new identity, verbatim. */
  readonly identity: string;
  /** The home fixture's file holding the renamed or moved section. */
  readonly origin: string;
  /** Constructs the home fixture must stage inside that section. */
  readonly descendants: readonly string[];
  readonly reason: string;
}

const T14_7_INTRINSIC_RENAME_ARM: IntrinsicInvalidIdArm = {
  spelled: "rename specs/A.mdx a a.then",
  argv: ["rename", "specs/A.mdx", "a", "a.then"],
  identity: "specs/A.mdx#a.then",
  origin: "specs/A.mdx",
  descendants: ['<S id="a.mid">', '<S id="a.mid.kid">', '<S id="a.sib">'],
  reason:
    "the top-level `a` renamed to the two-segment `a.then`, intrinsically " +
    "invalid (the forbidden name `then`, 1.4) and structurally misplaced " +
    "(1.3) at once — refused-invalid-id alone, never " +
    "refused-structural-parent beside it, concerning the new identity " +
    "alone: no prefix-produced `a.then.mid`, `a.then.mid.kid`, or " +
    "`a.then.sib`",
};

const T14_7_INTRINSIC_MOVE_ARM: IntrinsicInvalidIdArm = {
  spelled: "move specs/A.mdx#x 'specs/B.mdx#x y'",
  argv: ["move", "specs/A.mdx#x", "specs/B.mdx#x y"],
  identity: "specs/B.mdx#x y",
  origin: "specs/A.mdx",
  descendants: ['<S id="x.sub">'],
  reason:
    "`x`, holding `x.sub`, moved into `specs/B.mdx` as the " +
    "whitespace-bearing `x y` (1.4) — refused-invalid-id alone, concerning " +
    "the new identity alone: never the prefix-produced `specs/B.mdx#x y.sub`",
};

/** A staged file's bytes as text, for the arms' premise checks. */
function stagedFileText(contents: InitialFileContents | undefined): string {
  if (contents === undefined) return "";
  const source =
    contents instanceof StagedMdx || contents instanceof StagedTs
      ? contents.source
      : contents;
  return typeof source === "string"
    ? source
    : Buffer.from(source).toString("utf8");
}

/**
 * One spelled refused-invalid-id command line (the note above), in its home
 * workspace after the home table's loop: exit 1, the form-exact 12.7
 * report, exactly one finding — refused-invalid-id — whose `identities` is
 * exactly the new identity, the invalid ID spelled verbatim (SPEC 14).
 * `files` is the home fixture's staged file map, the premise's ground.
 */
async function runIntrinsicInvalidIdArm(
  product: ProductBinding,
  workspace: TestWorkspace,
  files: Readonly<Record<string, InitialFileContents>>,
  arm: IntrinsicInvalidIdArm,
): Promise<void> {
  const staged = stagedFileText(files[arm.origin]);
  for (const construct of arm.descendants) {
    if (!staged.includes(construct)) {
      throw new Error(
        `harness defect: T14-7's \`${arm.spelled}\` arm needs the home ` +
          `fixture's ${arm.origin} to stage ${construct} inside the ` +
          `section the operation renames or moves — the produced identity ` +
          `it asserts absent — and the fixture no longer does`,
      );
    }
  }
  await assertRefusalReport(
    product,
    workspace,
    arm.argv,
    { finding: "refused-invalid-id", identities: [arm.identity] },
    `T14-7 \`${arm.spelled}\` (${arm.reason}; TEST-SPEC T14-7: ` +
      `"refused-invalid-id (concerning the new identity alone — ` +
      `\`identities\` exactly [${JSON.stringify(arm.identity)}] … the ` +
      `invalid ID spelled verbatim; intrinsic form only — a structurally ` +
      `misplaced but intrinsically valid new ID reports ` +
      `\`refused-structural-parent\` alone, never both)"; SPEC 14, 1.3, 1.4)`,
  );
}

// The invalid-path identity staging (T14-7's own; SPEC 14, 1.5, 12.0,
// 12.7): `specs/new.txt` — an absent path lacking `.mdx`, no valid
// destination (6.5, 14.19) — as a section move's target file. A refusal's
// identities are spellings in 1.5's form over the would-be operation,
// carried whatever the path's validity and defining no node: `move
// specs/A.mdx#x 'specs/new.txt#x y'` reports refused-invalid-destination
// (`path` the destination as spelled) beside refused-invalid-id with
// `identities` exactly `["specs/new.txt#x y"]`, the invalid ID verbatim;
// `move specs/A.mdx#x specs/new.txt#p.y` reports refused-invalid-destination
// beside refused-missing-target-parent with `["specs/new.txt#p"]`, the
// absent file bearing no `p`. Each identity is a plain string over the path
// as spelled (12.7), defining no node: `query node` on it is 12.0's
// unknown-identity usage error, exit 2 — `specs/new.txt` a path in no
// configured group (T11-6). No further reason applies — `x y` and `p.y`
// collide with nothing in an absent file, no cycle arises, the would-be
// text is judged only under an intrinsically valid `<new-id>` with an
// insertion point (6.5), and the origin's deletion leaves `keep` well-formed
// — so each report is exactly its two findings.
const T14_7_INVALID_PATH_ORIGIN = "specs/A.mdx";
const T14_7_INVALID_PATH = "specs/new.txt";
const T14_7_INVALID_PATH_FILES: Readonly<Record<string, InitialFileContents>> =
  {
    "xspec.config.ts": SPECS_ONLY_CONFIG,
    [T14_7_INVALID_PATH_ORIGIN]: stagedMdx(
      "T14-7 invalid-path arm specs/A.mdx (keep and x)",
      '<S id="keep">\nKeep text.\n</S>\n\n<S id="x">\nX text.\n</S>\n',
    ),
  };

/** One identity over the invalid path: the `<new-id>` moved to, the reason concerning the identity, and the identity itself. */
interface InvalidPathArm {
  readonly newId: string;
  readonly identity: string;
  readonly beside: RefusalExpectation;
  readonly reason: string;
}

const T14_7_INVALID_PATH_ARMS: readonly InvalidPathArm[] = [
  {
    newId: "x y",
    identity: `${T14_7_INVALID_PATH}#x y`,
    beside: {
      finding: "refused-invalid-id",
      identities: [`${T14_7_INVALID_PATH}#x y`],
    },
    reason:
      "an invalid ID over the absent, extension-less path — " +
      "refused-invalid-id concerning `specs/new.txt#x y`, the invalid ID " +
      "spelled verbatim, beside refused-invalid-destination",
  },
  {
    newId: "p.y",
    identity: `${T14_7_INVALID_PATH}#p`,
    beside: {
      finding: "refused-missing-target-parent",
      identities: [`${T14_7_INVALID_PATH}#p`],
    },
    reason:
      "a missing target parent over the absent, extension-less path — " +
      "refused-missing-target-parent concerning `specs/new.txt#p`, the " +
      "absent file bearing no `p`, beside refused-invalid-destination",
  },
];

/** Identities over invalid paths (the staging note above). */
async function runT147InvalidPathArms(product: ProductBinding): Promise<void> {
  await withWorkspace(
    { files: T14_7_INVALID_PATH_FILES },
    async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-7 invalid-path staging `build` over the valid workspace " +
          "(`specs/new.txt` absent)",
      );
      for (const arm of T14_7_INVALID_PATH_ARMS) {
        const destination = `${T14_7_INVALID_PATH}#${arm.newId}`;
        await assertRefusalReport(
          product,
          workspace,
          ["move", `${T14_7_INVALID_PATH_ORIGIN}#x`, destination],
          [
            arm.beside,
            {
              finding: "refused-invalid-destination",
              path: T14_7_INVALID_PATH,
            },
          ],
          `T14-7 move (identities over an invalid path, \`${destination}\`: ` +
            `${arm.reason}; the identity a spelling in 1.5's form over the ` +
            `would-be operation, carried whatever its path's validity)`,
        );
        const result = await expectExit(
          product,
          workspace,
          ["query", "node", arm.identity, "--json"],
          2,
          `T14-7 \`query node ${arm.identity}\` — the refusal's identity is a ` +
            `plain string over the path as spelled, defining no node: 12.0's ` +
            `unknown-identity usage error, exit 2 — \`${T14_7_INVALID_PATH}\` ` +
            `a path in no configured group (SPEC 14, 1.5, 12.0, 12.7; T11-6)`,
        );
        expectErrorDocument(
          result,
          `T14-7 \`query node ${arm.identity} --json\` — under --json, the ` +
            `exit-2 error document is the entire stdout (SPEC 12.0, 12.7, H-5)`,
        );
      }
    },
  );
}

// The sibling spec-import-cycle staging (T14-7's own; SPEC 14, 6.5, 5.7):
// `A` imports a third module `specs/C.mdx` as `C`, the moved section `x`
// carries `d={C.foo}`, and `C` imports `B` (its `foo` referencing `B.bar`).
// Moving `x` into `B` roots that chain at a binding of `C`'s module `B`
// lacks — the rewrite adds `C`'s import to `B`, closing the cycle B → C →
// B. The finding locates `C`'s existing import of `B` by its own characters
// and the chain's spelling in `A` (pre-operation coordinates, inside the
// moved text): the located set is the spellings rooted at the added
// binding, independent of whether each appears as a `reference-rewrite` —
// a product choosing `C` as the fresh identifier would rewrite nothing
// there, and the spelling is located all the same. 12.7's within-finding
// order: `specs/A.mdx` before `specs/C.mdx` by path bytes. Nothing else
// applies: `x` collides with nothing in `B`, no dependency cycle arises
// (`x` → `foo` → `bar`), and the origin's deletion — `C`'s import, its
// only use moved away, removed with its emptied block — leaves `A`
// well-formed, so the finding is the report's only one.
const T14_7_SIBLING_A = "specs/A.mdx";
const T14_7_SIBLING_B = "specs/B.mdx";
const T14_7_SIBLING_C = "specs/C.mdx";
const T14_7_SIBLING_CHAIN = "d={C.foo}";
const T14_7_SIBLING_A_SOURCE = [
  'import C from "./C.xspec"',
  "",
  '<S id="keep">',
  "Keep text.",
  "</S>",
  "",
  `<S id="x" ${T14_7_SIBLING_CHAIN}>`,
  "X text.",
  "</S>",
  "",
].join("\n");
const T14_7_SIBLING_B_SOURCE = stagedMdx(
  "T14-7 sibling import-cycle arm specs/B.mdx (bar)",
  ['<S id="bar">', "Bar text.", "</S>", ""].join("\n"),
);
const T14_7_SIBLING_C_IMPORT = 'import B from "./B.xspec"';
const T14_7_SIBLING_C_SOURCE = stagedMdx(
  "T14-7 sibling import-cycle arm specs/C.mdx (foo importing B for bar)",
  [
    T14_7_SIBLING_C_IMPORT,
    "",
    '<S id="foo" d={B.bar}>',
    "Foo text.",
    "</S>",
    "",
  ].join("\n"),
);
const T14_7_SIBLING_A_STAGED = stagedMdx(
  "T14-7 sibling import-cycle arm specs/A.mdx (x carrying d={C.foo} beside keep)",
  T14_7_SIBLING_A_SOURCE,
);
const T14_7_SIBLING_CHAIN_WINDOW = byteWindow(
  T14_7_SIBLING_A_SOURCE.slice(
    0,
    T14_7_SIBLING_A_SOURCE.indexOf(T14_7_SIBLING_CHAIN),
  ),
  T14_7_SIBLING_CHAIN,
);
const T14_7_SIBLING_C_IMPORT_WINDOW = byteWindow("", T14_7_SIBLING_C_IMPORT);

/** The spec import cycle's sibling arm (the staging note above). */
async function runT147SiblingCycleArm(product: ProductBinding): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [T14_7_SIBLING_A]: T14_7_SIBLING_A_STAGED,
        [T14_7_SIBLING_B]: T14_7_SIBLING_B_SOURCE,
        [T14_7_SIBLING_C]: T14_7_SIBLING_C_SOURCE,
      },
    },
    async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-7 sibling import-cycle staging `build` over the valid " +
          "workspace (`A` imports `C`, `C` imports `B`, `x` references " +
          "`C.foo`)",
      );
      await assertRefusalReport(
        product,
        workspace,
        ["move", `${T14_7_SIBLING_A}#x`, `${T14_7_SIBLING_B}#x`],
        {
          finding: "refused-cycle",
          locatedAtEach: [
            { file: T14_7_SIBLING_A, window: T14_7_SIBLING_CHAIN_WINDOW },
            { file: T14_7_SIBLING_C, window: T14_7_SIBLING_C_IMPORT_WINDOW },
          ],
        },
        "T14-7 move (spec import cycle, the sibling arm: carrying `x` with " +
          "`d={C.foo}` from A into B, where A imports C and C imports B — " +
          "the chain rooted at a binding of C's module B lacks, the added " +
          "import closing B → C → B; the finding locates C's existing " +
          "import of B and the chain's spelling in A, exactly those two, " +
          "though a product choosing `C` as the fresh identifier would " +
          "rewrite nothing there)",
      );
    },
  );
}

// T6.5-4's symbolic-link arms beyond the shared table's inside-root entries
// (TEST-SPEC T14-7's refused-invalid-destination clause: a link to a
// directory at a component of the destination path, of a created target
// file's path, and of the `outDir` emit destination, the link and its
// target byte-identical after each refusal): the outside-root staging —
// `specs/sub` a link to an empty directory beside the workspace root, both
// forms — and the derived-path arm's link sibling — `mdout/new`, the emit
// destination's directory component, a link to `linked/` — each staged
// through T6.5-4's exported fixture and protocol (the link staged before
// the premise `build`, which passes), each refused-invalid-destination
// alone concerning the destination path, never 14.22, inside the
// link-and-target compare. The shared table's inside-root entries
// (`MOVE_LINK_INSIDE_CASES`) get the same compare in T14-7's table loop.

/** The outside-root link staging and the derived-path link sibling (the note above). */
async function runT147LinkArms(product: ProductBinding): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": MOVE_REFUSAL_CONFIG,
        ...MOVE_LINK_OUTSIDE_FILES,
      },
    },
    async (workspace) => {
      await stageMoveLinkOutsideComponent(workspace);
      await buildOk(
        product,
        workspace,
        "T14-7 outside-root link staging `build` (the T6.5-4 protocol) — " +
          "the link specs/sub is never discovered nor traversed and lies " +
          "under no current source's write path, so each refusal below is " +
          "the move's own",
      );
      for (const { argv, expected, reason } of MOVE_LINK_OUTSIDE_CASES) {
        const context = `T14-7 move (${reason})`;
        await assertLinkAndTargetUnchanged(
          workspace,
          MOVE_LINK_COMPONENT,
          () =>
            assertRefusalReport(product, workspace, argv, expected, context),
          context,
        );
      }
    },
  );
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": MOVE_DERIVED_PATH_CONFIG,
        ...MOVE_DERIVED_LINK_FILES,
      },
    },
    async (workspace) => {
      await stageMoveDerivedLinkComponent(workspace);
      await buildOk(
        product,
        workspace,
        "T14-7 derived-path link sibling `build` (the T6.5-4 protocol) — " +
          "the link mdout/new lies under no current source's write path, " +
          "so the refusal below is the move's own",
      );
      const context = `T14-7 move (${MOVE_DERIVED_LINK_CASE.reason})`;
      await assertLinkAndTargetUnchanged(
        workspace,
        MOVE_DERIVED_LINK_COMPONENT,
        () =>
          assertRefusalReport(
            product,
            workspace,
            MOVE_DERIVED_LINK_CASE.argv,
            MOVE_DERIVED_LINK_CASE.expected,
            context,
          ),
        context,
      );
    },
  );
}

// refused-invalid-destination over T6.5-20's derived-path relations and
// module-linking designation (TEST-SPEC T14-7: "and so do T6.5-4's barred
// path characters and T6.5-20's derived-path relations and module-linking
// designation" — the barred characters reach T14-7 through
// MOVE_REFUSAL_CASES), staged through T6.5-20's exported table and staging
// code (`d20RefusedStagings`, `runD20RefusedStaging`: the companion legs
// read as the home test reads them, each staging before any build or after
// its premise `build` as the home test stages it) — each refused move
// exactly one refused-invalid-destination finding concerning the
// destination as spelled (the section form's target file), `locations`
// `[]`, nothing beside, never 14.22. The modifies-nothing compares stay the
// home test's subject.

/** T6.5-20's refused stagings under T14-7's reporting contract (the note above). */
async function runT147DerivedPathRelationArms(
  product: ProductBinding,
): Promise<void> {
  for (const staging of await d20RefusedStagings(product, "T14-7 (T6.5-20)")) {
    await runD20RefusedStaging(
      product,
      staging,
      `T14-7 move (T6.5-20 ${staging.key})`,
      (workspace, move, context) =>
        assertRefusalReport(
          product,
          workspace,
          move.argv,
          { finding: "refused-invalid-destination", path: move.path },
          `${context} — refused-invalid-destination alone, concerning the ` +
            `destination as spelled, never 14.22`,
        ),
    );
  }
}

// refused-exposed-derived-file over T6.5-21's refused stagings (TEST-SPEC
// T14-7: `path` the origin's emit destination, `locations` `[]`,
// `identities` `[]`), staged through T6.5-21's exported table and staging
// code (`D21_REFUSED_STAGINGS`, `runD21RefusedStaging`): (a) after its
// premise `build` — the file-form move, then the two-reason move reporting
// refused-invalid-destination (T6.5-4's barred `'`, `path` the destination
// as spelled) beside it — and (b) before any build, each move's findings
// exactly the table's, `identities` stated exactly where 14 pins them.

/** T6.5-21's refused stagings under T14-7's reporting contract (the note above). */
async function runT147ExposedDerivedFileArms(
  product: ProductBinding,
): Promise<void> {
  for (const staging of D21_REFUSED_STAGINGS) {
    await runD21RefusedStaging(
      product,
      staging,
      `T14-7 move (T6.5-21 ${staging.key})`,
      (workspace, move, context) =>
        assertRefusalReport(
          product,
          workspace,
          move.argv,
          move.findings.map((expected): RefusalExpectation =>
            expected.identities === undefined
              ? { finding: expected.code, path: expected.path }
              : {
                  finding: expected.code,
                  path: expected.path,
                  identities: expected.identities,
                },
          ),
          context,
        ),
    );
  }
}

const T14_7 = defineProductTest({
  id: "T14-7",
  title:
    "refusal reasons: staged refusals asserting each stable code with its concerned file, range, or identity — refused-invalid-id concerning the invalid identity — its identities exactly the one 1.5 identity over the destination file, the invalid ID spelled verbatim, no prefix-produced identity beside it: `[\"specs/A.mdx#a.then\"]` for `rename specs/A.mdx a a.then` (the top-level `a`, holding `a.mid` and `a.sib`, made the two-segment `a.then`, no refused-structural-parent beside it) and `[\"specs/B.mdx#x y\"]` for `move specs/A.mdx#x 'specs/B.mdx#x y'` (`x` holding `x.sub`, never `specs/B.mdx#x y.sub`) (intrinsic form only: a structurally misplaced but intrinsically valid new ID reports refused-structural-parent alone, never both); refused-identity-unchanged reported alone by an identity-unchanged rename and by the exact self-move of either form, no collision or occupied-destination reason beside it, its identities the unchanged identity as the sole element — the bare `<new-file>` root identity for the file form; refused-id-collision locating every colliding bearer — the location set exactly the colliding bearers, two in T6.4-3's prefix-replacement arm, `b` and `b.c`, a product locating the first alone failing — its identities exactly the located bearers' identities in location order; refused-structural-parent and refused-missing-target-parent concerning the violated and the target-parent identity, each the sole identities element; refused-cycle locating the would-be cycle's full path in pre-operation coordinates — a dependency cycle's participating `d` spelling; a spec import cycle's existing import declaration by its own characters and, for the import the move would add, the local reference spelling whose rewrite requires it, exactly those two, never a range for the import that does not yet exist; refused-destination-exists concerning the occupied path, the section form's non-spec-source occupant included — occupancy judged in discovered-path form alone: a destination spelled `./a.mdx` for the origin `a.mdx`, `specs//b.mdx`, or `specs/../specs/b.mdx`, each naming an occupied path were it normalized, is refused-invalid-destination alone concerning the path as spelled, never reported occupied, and a section-form target path so spelled likewise; refused-missing-target-parent concerning the target-parent identity; refused-invalid-destination concerning the destination path — the destination-side directory-component cases reporting this code, never 14.22: a plain file staged as a directory component of the destination path and, in the derived-path arm, of the destination's `outDir` emit destination, and in T6.5-4's symbolic-link arms a link to a directory at a component of the destination path, of a created target file's path, and of the `outDir` emit destination, the link and its target byte-identical after each refusal — and so do T6.5-4's barred path characters and T6.5-20's derived-path relations and module-linking designation, over T6.5-20's exported refused stagings; refused-exposed-derived-file over T6.5-21's exported refused stagings — `path` the origin's emit destination, `locations` `[]`, `identities` `[]`, the two-reason move's refused-invalid-destination beside it; every reason concerning a path carrying it as the finding's `path` with `locations` `[]`; the eleven reasons 14 lists (refused-exposed-derived-file, refused-invalid-rewrite, and refused-moved-import, T6.5-21's, T6.5-16's, and T6.5-17's subjects, included) are the whole refusal vocabulary — a code 14 does not list never appears in any report, the form-exact decode admitting only 14's codes (no unresolvable-reference reason exists); every applicable reason reports together, one finding per reason — a section move staged to both collide and create a dependency cycle reports both findings, never only the first; the invalid-workspace refusal reports the workspace's numbered findings alone — a rename staged to also collide on a workspace failing validation reports the validation findings only, exit 1, no refusal reason evaluated or reported beside them; refused-invalid-rewrite and refused-moved-import re-asserted over T6.5-16's and T6.5-17's exported arms — the former locating the moved construct and, for an addition no offset admits, the spellings rooted at its binding, its identities the concerned files' paths in byte order; the latter locating each moved declaration by the import range of 11.4, its identities empty — `path` null for both, every reason the entry pins beside reported together; identities over invalid paths: `move specs/A.mdx#x 'specs/new.txt#x y'` reports refused-invalid-destination (`path` `specs/new.txt`) beside refused-invalid-id with identities exactly `[\"specs/new.txt#x y\"]`, and `move specs/A.mdx#x specs/new.txt#p.y` refused-invalid-destination beside refused-missing-target-parent with `[\"specs/new.txt#p\"]` — each a plain string over the path as spelled, defining no node: `query node` on it is a usage error, exit 2; and the spec import cycle's sibling arm — `A` imports a third module `C`, the moved text carries `d={C.foo}`, `C` imports `B` — locating `C`'s existing import of `B` and the chain's spelling in `A`, the located set the spellings rooted at the added binding, independent of whether each appears as a reference-rewrite (SPEC 14, 6.4, 6.5, 4, 5.3, 5.7, 1.5, 7, 11.4, 12.0, 12.7, 13.4)",
  timeoutMs: 300_000,
  run: async (product) => {
    // --- The rename reasons, staged via T6.4-3's exported fixture: the
    // 1.4-invalid new IDs (refused-invalid-id concerning the invalid
    // identity), the identity-unchanged rename (alone — the exact one-entry
    // multiset holds no collision reason beside it, SPEC 6.4), the two
    // collisions — the single-bearer arm locating the remaining bearer;
    // the two-bearer prefix-replacement arm, one refused-id-collision
    // finding whose location set is exactly `b` then `b.c`, the case's
    // declared complete bearer set (SPEC 14: every colliding bearer — a
    // product locating the first alone fails) — and the structurally
    // misplaced but intrinsically valid new IDs (refused-structural-parent
    // alone, never refused-invalid-id beside it — the same exact-multiset
    // teeth; SPEC 14 "intrinsic form only").
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": RENAME_REFUSAL_CONFIG,
          ...RENAME_REFUSAL_FILES,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T14-7 rename-reason staging `build` (the T6.4-3 protocol)",
        );
        for (const { argv, expected, reason } of RENAME_REFUSAL_CASES) {
          await assertRefusalReport(
            product,
            workspace,
            argv,
            expected,
            `T14-7 rename (${reason})`,
          );
        }
        // The spelled `rename specs/A.mdx a a.then` (the note above
        // runIntrinsicInvalidIdArm): refused-invalid-id alone, never
        // refused-structural-parent beside it, no produced identity.
        await runIntrinsicInvalidIdArm(
          product,
          workspace,
          RENAME_REFUSAL_FILES,
          T14_7_INTRINSIC_RENAME_ARM,
        );
      },
    );

    // --- The move reasons, staged via T6.5-4's exported fixture: the two
    // cycle arms (the spec-import arm locating exactly the two reference
    // spellings rooted at its added imports' bindings, the dependency arm
    // the participating `d` spelling), the destination occupants — the
    // section form's non-spec-source occupants included, the out-of-group
    // `.mdx` occupant refusing under both applicable reasons — the
    // 1.4-invalid new IDs, the cross-file collision, the missing and
    // within-subtree target parents, and the invalid destinations, T6.5-4's
    // barred path characters and its inside-root symbolic-link arms among
    // them — each link arm inside the link-and-target compare (TEST-SPEC
    // T14-7: the link and its target byte-identical after each refusal;
    // SPEC 6.5, 14).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": MOVE_REFUSAL_CONFIG,
          ...MOVE_REFUSAL_FILES,
        },
      },
      async (workspace) => {
        // Occupants before the premise `build`, which must still pass
        // (T6.5-4's staging note).
        await stageMoveRefusalOccupants(workspace);
        await buildOk(
          product,
          workspace,
          "T14-7 move-reason staging `build` (occupants staged before it; " +
            "the T6.5-4 protocol)",
        );
        for (const kase of MOVE_REFUSAL_CASES) {
          const context = `T14-7 move (${kase.reason})`;
          const report = (): Promise<void> =>
            assertRefusalReport(
              product,
              workspace,
              kase.argv,
              kase.expected,
              context,
            );
          if (MOVE_LINK_INSIDE_CASES.includes(kase)) {
            await assertLinkAndTargetUnchanged(
              workspace,
              MOVE_LINK_COMPONENT,
              report,
              context,
            );
          } else {
            await report();
          }
        }
        // The spelled `move specs/A.mdx#x 'specs/B.mdx#x y'` (the note
        // above runIntrinsicInvalidIdArm): refused-invalid-id alone, its
        // identities never holding the prefix-produced `x y.sub`.
        await runIntrinsicInvalidIdArm(
          product,
          workspace,
          MOVE_REFUSAL_FILES,
          T14_7_INTRINSIC_MOVE_ARM,
        );
      },
    );

    // --- refused-invalid-destination, the derived-path directory-component
    // case, staged via T6.5-4's exported derived-path fixture: the
    // otherwise-valid destination's `outDir` emit destination has its
    // directory component occupied by a plain file lying under no current
    // source's write path — refused concerning the destination path, never
    // 14.22 (SPEC 6.5, 7.3, 13.1, 13.2, 14).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": MOVE_DERIVED_PATH_CONFIG,
          ...MOVE_DERIVED_PATH_FILES,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T14-7 derived-path staging `build` — the occupant lies under no " +
            "current source's write path (T6.5-4's derived-path arm), so " +
            "the refusal below is the move's own",
        );
        await assertRefusalReport(
          product,
          workspace,
          MOVE_DERIVED_PATH_CASE.argv,
          MOVE_DERIVED_PATH_CASE.expected,
          `T14-7 move (${MOVE_DERIVED_PATH_CASE.reason})`,
        );
      },
    );

    // --- refused-invalid-destination over T6.5-4's remaining symbolic-link
    // arms (the link-arm note): the outside-root staging and the
    // derived-path arm's link sibling at the `outDir` emit destination's
    // component — never 14.22, the link and its target byte-identical after
    // each refusal (SPEC 6.5, 7, 13.4, 14).
    await runT147LinkArms(product);

    // --- refused-invalid-destination, the destination-path
    // directory-component case (T14-7's own staging; the fixture note): a
    // plain file occupies a directory component of the destination path
    // itself — refused concerning the destination path, never 14.22 (the
    // exact one-entry multiset excludes a condition-22 finding beside it;
    // SPEC 6.5, 14.22, 14).
    await withWorkspace({ files: T14_7_COMPONENT_FILES }, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-7 destination-component staging `build` — the plain-file " +
          "occupant matches no glob and lies under no current source's " +
          "write path, so the workspace passes `build`'s validations",
      );
      await assertRefusalReport(
        product,
        workspace,
        ["move", "specs/Src.mdx", T14_7_COMPONENT_DEST],
        {
          finding: "refused-invalid-destination",
          path: T14_7_COMPONENT_DEST,
        },
        "T14-7 move (destination-path directory component occupied by a " +
          "plain file — refused-invalid-destination concerning the " +
          "destination path, never 14.22)",
      );
    });

    // --- Every applicable reason together: the both-collide-and-cycle
    // section move (the fixture note) reports both findings, never only the
    // first found — the exact two-entry multiset with each reason's
    // concerned participant (SPEC 14, 6.5, 5.3).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [T14_7_MULTI_FILE]: T14_7_MULTI_STAGED,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T14-7 multi-reason staging `build` over the valid workspace",
        );
        await assertRefusalReport(
          product,
          workspace,
          ["move", `${T14_7_MULTI_FILE}#mv`, `${T14_7_MULTI_FILE}#keep.mv`],
          [
            {
              finding: "refused-id-collision",
              locatedAt: {
                file: T14_7_MULTI_FILE,
                window: T14_7_OCCUPANT_WINDOW,
              },
              locatedAtEach: [
                { file: T14_7_MULTI_FILE, window: T14_7_OCCUPANT_WINDOW },
              ],
              identities: [`${T14_7_MULTI_FILE}#keep.mv`],
            },
            {
              finding: "refused-cycle",
              locatedAt: {
                file: T14_7_MULTI_FILE,
                window: T14_7_CYCLE_WINDOW,
              },
            },
          ],
          "T14-7 move (staged to both collide — `keep.mv` present in the " +
            "target file, remaining after the removal — and create a " +
            "dependency cycle — the moved node depends on `keep`, its " +
            "would-be ancestor: both findings, never only the first)",
        );
      },
    );

    // --- refused-invalid-destination alone for a destination spelled with a
    // `.`, `..`, or empty segment (the spelling fixture note): each spelling
    // names an occupied path were it normalized — the origin itself for
    // `./a.mdx`, the discovered `specs/b.mdx` for the other two — yet
    // occupancy is judged in discovered-path form alone, so the exact
    // one-entry multiset holds no refused-destination-exists and no
    // refused-identity-unchanged beside it, the concerned path the
    // destination as spelled; the section form's target path so spelled
    // likewise (SPEC 14, 6.5, 12.0).
    await withWorkspace({ files: T14_7_SPELLING_FILES }, async (workspace) => {
      await buildOk(
        product,
        workspace,
        "T14-7 destination-spelling staging `build` (a root-level origin " +
          "under a root-level glob beside `specs/b.mdx`)",
      );
      for (const spelled of T14_7_SPELLED_DESTINATIONS) {
        await assertRefusalReport(
          product,
          workspace,
          ["move", T14_7_SPELLING_ORIGIN, spelled],
          { finding: "refused-invalid-destination", path: spelled },
          `T14-7 move (file form; destination spelled \`${spelled}\` — no ` +
            "discovered path carries a `.`, `..`, or empty segment: " +
            "refused-invalid-destination alone, concerning the path as " +
            "spelled, never reported occupied)",
        );
        await assertRefusalReport(
          product,
          workspace,
          ["move", `${T14_7_SPELLING_ORIGIN}#x`, `${spelled}#z`],
          { finding: "refused-invalid-destination", path: spelled },
          `T14-7 move (section form; target path spelled \`${spelled}\` — ` +
            "refused-invalid-destination alone, concerning the target file " +
            "path as spelled, never reported occupied)",
        );
      }
    });

    // --- refused-cycle locating a would-be spec import cycle's full path
    // (the import-cycle fixture note): the existing import declaration by
    // its own characters and, for the import the move would add, the local
    // reference spelling whose rewrite requires it — exactly those two
    // participants, in 12.7's within-finding order, never a range for the
    // import that does not yet exist, path null (SPEC 14, 6.5, 5.7, 12.7).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [T14_7_CYCLE_A]: T14_7_CYCLE_A_STAGED,
          [T14_7_CYCLE_B]: T14_7_CYCLE_B_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T14-7 import-cycle staging `build` over the valid workspace " +
            "(`B` imports `A`; `user` references `x` in local form)",
        );
        await assertRefusalReport(
          product,
          workspace,
          ["move", `${T14_7_CYCLE_A}#x`, `${T14_7_CYCLE_B}#x`],
          {
            finding: "refused-cycle",
            locatedAtEach: [
              { file: T14_7_CYCLE_A, window: T14_7_LOCAL_REFERENCE_WINDOW },
              { file: T14_7_CYCLE_B, window: T14_7_IMPORT_DECLARATION_WINDOW },
            ],
          },
          "T14-7 move (spec import cycle: carrying `x` from A into B, where " +
            "B imports A and `user` references `x` locally — the rewrite " +
            "adds B's import to A, closing the cycle; the finding locates " +
            "B's existing import declaration and that local reference's " +
            "spelling, exactly those two, never the import that does not " +
            "yet exist)",
        );
      },
    );

    // --- refused-cycle over the sibling spec-import-cycle arm (the sibling
    // staging note): the chain `C.foo` carried into `B`, `C` importing `B`
    // — the finding locates `C`'s existing import and the chain's spelling
    // in `A`, the spellings rooted at the added binding whether or not any
    // character of theirs changes (SPEC 14, 6.5, 5.7).
    await runT147SiblingCycleArm(product);

    // --- refused-invalid-destination over T6.5-20's derived-path relations
    // and module-linking designation (the T6.5-20 note): every refused move
    // of its exported table exactly one finding concerning the destination
    // as spelled, `locations` `[]`, never 14.22 (SPEC 6.5, 4, 14).
    await runT147DerivedPathRelationArms(product);

    // --- refused-exposed-derived-file over T6.5-21's refused stagings (the
    // T6.5-21 note): `path` the origin's emit destination, `locations` `[]`,
    // `identities` `[]` — the two-reason move's refused-invalid-destination
    // reported beside it (SPEC 6.5, 13.4, 14, 12.7).
    await runT147ExposedDerivedFileArms(product);

    // --- refused-invalid-rewrite and refused-moved-import, re-asserted over
    // T6.5-16's and T6.5-17's exported arms (the home-tables note): the
    // moved construct and the spellings rooted at an addition no offset
    // admits, `identities` the concerned files' paths in byte order; each
    // moved declaration by the import range of 11.4, `identities` empty —
    // `path` null for both, every reason pinned beside reported together
    // (SPEC 14, 6.5, 11.4, 12.7).
    await runT147InvalidRewriteArms(product);
    await runT147MovedImportArms(product);

    // --- Identities over invalid paths (the invalid-path staging note):
    // `specs/new.txt#x y` and `specs/new.txt#p`, each carried as a plain
    // string over the path as spelled beside refused-invalid-destination,
    // defining no node — `query node` on it exit 2 (SPEC 14, 1.5, 12.0,
    // 12.7).
    await runT147InvalidPathArms(product);

    // --- The invalid-workspace refusal: the control arm on the valid twin
    // pins the staged-to-collide premise (exactly the collision refusal),
    // then the broken workspace — an unresolved `d` in a file the rename
    // never touches — reports the workspace's numbered findings alone: the
    // one located 14.5 finding, exit 1, no refusal reason evaluated or
    // reported beside it (SPEC 6.4, 14).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [T14_7_RENAME_FILE]: T14_7_RENAME_STAGED,
          [T14_7_BAD_FILE]: T14_7_BAD_VALID,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T14-7 invalid-workspace staging `build` over the valid twin",
        );
        await assertRefusalReport(
          product,
          workspace,
          ["rename", T14_7_RENAME_FILE, "a.mid", "a.sib"],
          {
            finding: "refused-id-collision",
            locatedAt: { file: T14_7_RENAME_FILE, window: T14_7_SIB_WINDOW },
            locatedAtEach: [
              { file: T14_7_RENAME_FILE, window: T14_7_SIB_WINDOW },
            ],
            identities: [`${T14_7_RENAME_FILE}#a.sib`],
          },
          "T14-7 rename control (the valid twin: the rename is staged to " +
            "collide with the remaining `a.sib` bearer — the premise the " +
            "invalid-workspace arm rides)",
        );
        // The exact self-move of either form reports
        // refused-identity-unchanged alone — no collision reason beside it
        // (SPEC 6.4: the after-removal check collides with nothing) and no
        // refused-destination-exists for the file form (SPEC 14: the origin
        // path itself is the one occupant that reason never reports) — its
        // `identities` the unchanged identity in 1.5's form over the
        // destination: `<target-file>#<id>` for the section form, the bare
        // `<new-file>`, its root identity, for the file form (SPEC 14).
        await assertRefusalReport(
          product,
          workspace,
          ["move", `${T14_7_RENAME_FILE}#a.mid`, `${T14_7_RENAME_FILE}#a.mid`],
          {
            finding: "refused-identity-unchanged",
            identities: [`${T14_7_RENAME_FILE}#a.mid`],
          },
          "T14-7 move (the exact section-form self-move — " +
            "refused-identity-unchanged alone, its identities the unchanged " +
            "`<target-file>#<id>` identity)",
        );
        await assertRefusalReport(
          product,
          workspace,
          ["move", T14_7_RENAME_FILE, T14_7_RENAME_FILE],
          {
            finding: "refused-identity-unchanged",
            identities: [T14_7_RENAME_FILE],
          },
          "T14-7 move (the exact file-form self-move — " +
            "refused-identity-unchanged alone, never " +
            "refused-destination-exists beside it, its identities the bare " +
            "`<new-file>` root identity)",
        );
        await workspace.file(T14_7_BAD_FILE, T14_7_BAD_INVALID);
        await assertRefusalReport(
          product,
          workspace,
          ["rename", T14_7_RENAME_FILE, "a.mid", "a.sib"],
          {
            finding: "14.5",
            locatedAt: { file: T14_7_BAD_FILE },
          },
          "T14-7 rename (invalid workspace: the same rename, still staged " +
            "to collide, reports the workspace's numbered findings alone — " +
            "the one 14.5 finding located in specs/Bad.mdx, no refusal " +
            "reason evaluated or reported beside it)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T14-8 — location cardinality
// ---------------------------------------------------------------------------

/**
 * One expected participant of a jointly violated condition: its containing
 * file and its construct's byte window (the module-header window
 * convention). Participant sequences are declared in the 12.7
 * within-finding location order — document order within one file,
 * file-path-byte order across files — so the index-wise assertions below
 * also pin that order value-wise.
 */
interface ParticipantExpectation {
  readonly file: string;
  readonly window: { readonly start: number; readonly end: number };
}

/**
 * Whether a finding's locations match a participant sequence index-wise:
 * exactly one location per participant, each in the participant's file
 * within its window. Boolean — the W1 cycle arm classifies its two 14.9
 * findings with it; `assertFindingLocatesParticipants` is the diagnosed
 * form.
 */
function locationsMatchParticipants(
  finding: Finding,
  participants: readonly ParticipantExpectation[],
): boolean {
  return (
    finding.locations.length === participants.length &&
    finding.locations.every((location, index) => {
      const expected = participants[index]!;
      return (
        location.file === expected.file &&
        location.range.start >= expected.window.start &&
        location.range.end <= expected.window.end
      );
    })
  );
}

/**
 * Assert one finding locates EVERY participant and nothing else (SPEC 14's
 * location-cardinality rule — the every-participant strictness T14-8 owns;
 * no SOME-quantified tolerance): exactly one location per participating
 * construct, index-wise in the declared order, each in its containing file
 * within its construct's byte window; and, locating in source, the finding
 * concerns no path (12.7: `path` null for located conditions).
 */
function assertFindingLocatesParticipants(
  finding: Finding,
  participants: readonly ParticipantExpectation[],
  context: string,
): void {
  if (finding.locations.length !== participants.length) {
    fail(
      `${context}: one finding carries a location for every participating ` +
        `construct — no representative chosen, none beside (SPEC 14, 12.7); ` +
        `expected exactly ${String(participants.length)} location(s), got ` +
        `${String(finding.locations.length)}: ` +
        `${JSON.stringify(finding.locations)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
  participants.forEach((expected, index) => {
    const location = finding.locations[index]!;
    if (
      location.file !== expected.file ||
      location.range.start < expected.window.start ||
      location.range.end > expected.window.end
    ) {
      fail(
        `${context}: location[${String(index)}] must locate its participant ` +
          `in ${JSON.stringify(expected.file)} within the construct's byte ` +
          `window [${String(expected.window.start)}, ` +
          `${String(expected.window.end)}] (SPEC 14: each participant located ` +
          `in the file containing it; 12.7 orders locations by file bytes, ` +
          `then start, then end — the declared participant order); got ` +
          `${JSON.stringify(finding.locations)} (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
  });
  if (finding.path !== null) {
    fail(
      `${context}: a located condition's finding concerns no path — ` +
        `\`path\` null (SPEC 12.7, 14); got ${JSON.stringify(finding.path)} ` +
        `(message: ${JSON.stringify(finding.message)})`,
    );
  }
}

// Triple-duplicated ID (SPEC 14.3, 14): three bearers of `dup`, each a
// structurally valid top-level section (one segment against the empty
// prefix), so the duplication is the workspace's only condition — one
// condition-3 finding with three locations, one per bearer, no
// representative chosen (a product reporting only the later bearers, or one
// finding per occurrence, fails the exact cardinality).
const T14_8_DUP_FILE = "specs/Dup.mdx";
const T14_8_DUP_BEARERS: readonly string[] = [
  '<S id="dup">\nFirst bearer text.\n</S>',
  '<S id="dup">\nSecond bearer text.\n</S>',
  '<S id="dup">\nThird bearer text.\n</S>',
];
const T14_8_DUP_SOURCE = `${T14_8_DUP_BEARERS.join("\n\n")}\n`;
const T14_8_DUP_PARTICIPANTS: readonly ParticipantExpectation[] =
  T14_8_DUP_BEARERS.map((construct, index) => ({
    file: T14_8_DUP_FILE,
    window: byteWindow(
      T14_8_DUP_BEARERS.slice(0, index)
        .map((bearer) => `${bearer}\n\n`)
        .join(""),
      construct,
    ),
  }));

// Import-binding collision (SPEC 2.1, 14.15): two imports binding `A`, each
// individually valid (single default binding designating a discovered spec
// source; an unused binding is valid and records no edges), so the
// collision is the file's only condition — one condition-15 finding locating
// every colliding declaration, the first included.
const T14_8_COL_FILE = "specs/Col.mdx";
const T14_8_COL_IMPORTS: readonly string[] = [
  'import A from "./One.xspec"',
  'import A from "./Two.xspec"',
];
// S-9: two imports binding one identifier — an early error 14.20 admits,
// the named allowance; the workspace follows the body's first invocation,
// so its sources are staged-source records.
const T14_8_COL_SOURCE = stagedMdx(
  "T14-8 import-binding collision arm specs/Col.mdx (two imports binding A)",
  [
    ...T14_8_COL_IMPORTS,
    "",
    '<S id="col">',
    "Collision-file body text.",
    "</S>",
    "",
  ].join("\n"),
  { allowances: ["duplicate-import-binding"] },
);
const T14_8_ONE_SOURCE = stagedMdx(
  "T14-8 import-binding collision arm specs/One.mdx (the first import's target)",
  '<S id="one">\nTarget one text.\n</S>\n',
);
const T14_8_TWO_SOURCE = stagedMdx(
  "T14-8 import-binding collision arm specs/Two.mdx (the second import's target)",
  '<S id="two">\nTarget two text.\n</S>\n',
);
const T14_8_COL_PARTICIPANTS: readonly ParticipantExpectation[] =
  T14_8_COL_IMPORTS.map((declaration, index) => ({
    file: T14_8_COL_FILE,
    window: byteWindow(
      T14_8_COL_IMPORTS.slice(0, index)
        .map((line) => `${line}\n`)
        .join(""),
      declaration,
    ),
  }));

// Cross-file dependency cycle a→b→a with its unavoidable mutual-import spec
// import cycle (the module-header note): exactly two 14.9 findings — the
// dependency cycle's full path rendered as every participating reference
// spelling's location (the `d`-bearing elements, one per file), the import
// cycle's as every participating import declaration's — told apart by which
// disjoint windows their locations fall in.
const T14_8_CYC_A_FILE = "specs/CycA.mdx";
const T14_8_CYC_B_FILE = "specs/CycB.mdx";
const T14_8_CYC_A_IMPORT = 'import B from "./CycB.xspec"';
const T14_8_CYC_A_ELEMENT = '<S id="a" d={B.b}>\nCycle A behavior text.\n</S>';
const T14_8_CYC_B_IMPORT = 'import A from "./CycA.xspec"';
const T14_8_CYC_B_ELEMENT = '<S id="b" d={A.a}>\nCycle B behavior text.\n</S>';
const T14_8_CYC_FILES: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": SPECS_ONLY_CONFIG,
  [T14_8_CYC_A_FILE]: stagedMdx(
    "T14-8 cross-file dependency cycle arm specs/CycA.mdx (a depending on B.b)",
    `${T14_8_CYC_A_IMPORT}\n\n${T14_8_CYC_A_ELEMENT}\n`,
  ),
  [T14_8_CYC_B_FILE]: stagedMdx(
    "T14-8 cross-file dependency cycle arm specs/CycB.mdx (b depending on A.a)",
    `${T14_8_CYC_B_IMPORT}\n\n${T14_8_CYC_B_ELEMENT}\n`,
  ),
};
const T14_8_CYC_SPELLING_PARTICIPANTS: readonly ParticipantExpectation[] = [
  {
    file: T14_8_CYC_A_FILE,
    window: byteWindow(`${T14_8_CYC_A_IMPORT}\n\n`, T14_8_CYC_A_ELEMENT),
  },
  {
    file: T14_8_CYC_B_FILE,
    window: byteWindow(`${T14_8_CYC_B_IMPORT}\n\n`, T14_8_CYC_B_ELEMENT),
  },
];
const T14_8_CYC_IMPORT_PARTICIPANTS: readonly ParticipantExpectation[] = [
  { file: T14_8_CYC_A_FILE, window: byteWindow("", T14_8_CYC_A_IMPORT) },
  { file: T14_8_CYC_B_FILE, window: byteWindow("", T14_8_CYC_B_IMPORT) },
];

// Pure spec import cycle (SPEC 2.1: invalid even when no requirement-level
// dependency cycle exists): mutual imports whose bindings are never used —
// valid individually, recording no edges — so the import cycle is the
// workspace's only condition, one condition-9 finding locating every
// participating import declaration.
const T14_8_IMP_A_FILE = "specs/ImpA.mdx";
const T14_8_IMP_B_FILE = "specs/ImpB.mdx";
const T14_8_IMP_A_IMPORT = 'import B from "./ImpB.xspec"';
const T14_8_IMP_B_IMPORT = 'import A from "./ImpA.xspec"';
const T14_8_IMP_FILES: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": SPECS_ONLY_CONFIG,
  [T14_8_IMP_A_FILE]: stagedMdx(
    "T14-8 pure import cycle arm specs/ImpA.mdx (importing ImpB, the binding unused)",
    `${T14_8_IMP_A_IMPORT}\n\n<S id="ia">\nImport-cycle A text, binding unused.\n</S>\n`,
  ),
  [T14_8_IMP_B_FILE]: stagedMdx(
    "T14-8 pure import cycle arm specs/ImpB.mdx (importing ImpA, the binding unused)",
    `${T14_8_IMP_B_IMPORT}\n\n<S id="ib">\nImport-cycle B text, binding unused.\n</S>\n`,
  ),
};
const T14_8_IMP_PARTICIPANTS: readonly ParticipantExpectation[] = [
  { file: T14_8_IMP_A_FILE, window: byteWindow("", T14_8_IMP_A_IMPORT) },
  { file: T14_8_IMP_B_FILE, window: byteWindow("", T14_8_IMP_B_IMPORT) },
];

// No-occurrence MDX embedding spelling (SPEC 14, 14.6, 5.7): a local
// `text(...)` embedding whose target resolves to nothing records no
// occurrence, so its condition-6 finding's range is the FULL braced
// container, opening brace through closing brace — the span its occurrence
// would occupy — byte-exact (prose on both sides keeps the container off
// the file's ends, so an end-widened or line-granular range fails).
const T14_8_EMB_FILE = "specs/Emb.mdx";
const T14_8_EMB_PREFIX = '<S id="emb">\nProse before the embedding.\n\n';
const T14_8_EMB_CONTAINER = '{text("emb.nope")}';
const T14_8_EMB_SOURCE = stagedMdx(
  "T14-8 no-occurrence embedding arm specs/Emb.mdx (an unresolved local text(...) between prose)",
  `${T14_8_EMB_PREFIX}${T14_8_EMB_CONTAINER}\n\nProse after keeps the container off the file end.\n</S>\n`,
);
const T14_8_EMB_RANGE = {
  start: Buffer.byteLength(T14_8_EMB_PREFIX, "utf8"),
  end:
    Buffer.byteLength(T14_8_EMB_PREFIX, "utf8") +
    Buffer.byteLength(T14_8_EMB_CONTAINER, "utf8"),
};

// Policy finding (SPEC 7.5, 14.12, 12.7): one forbidden rule over the spec
// group and one `depends` edge between its nodes — `build` never evaluates
// policy, so the premise build passes and `check` reports exactly the one
// violation, locations `[]`, path `null`, its context identities alone in
// 14.12's contractual order. The arm's workspace follows the body's first
// invocations, so its configuration is a staged-source record (S-9;
// helpers/staged-ts.ts).
const T14_8_POLICY_CONFIG = stagedTs(
  "T14-8 policy arm xspec.config.ts (the forbidden rule no-spec-deps over the group main)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  policy: [
    {
      name: "no-spec-deps",
      type: "forbidden",
      from: { group: "main" },
      to: { group: "main" }
    }
  ]
})
`,
);
const T14_8_POL_FILE = "specs/Pol.mdx";
const T14_8_POL_SOURCE = stagedMdx(
  "T14-8 policy arm specs/Pol.mdx (p depending on a under the no-spec-deps rule)",
  [
    '<S id="a">',
    "Policy target text.",
    "</S>",
    "",
    '<S id="p" d={"a"}>',
    "Policy source text.",
    "</S>",
    "",
  ].join("\n"),
);

const T14_8 = defineProductTest({
  id: "T14-8",
  title:
    "location cardinality: a condition several constructs jointly violate is one finding locating every participant, each in its containing file — a triple-duplicated ID is one condition-3 finding with three locations, one per bearer, no representative chosen; an import-binding collision is one condition-15 finding locating every colliding declaration; a cross-file dependency cycle is one condition-9 finding locating its full path — every participating reference spelling — beside exactly one further condition-9 finding locating the co-staged spec import cycle's every participating import declaration, a pure mutual-import cycle with unused bindings reporting exactly that one finding; a no-occurrence MDX embedding spelling's condition-6 finding has the full braced container as its byte-exact range, the span its occurrence would occupy, keeping T11.4-6's byte classification exact; a policy finding carries locations [], path null, its context identities alone; location order within a finding is file bytes, then start, then end (SPEC 14, 12.7, 5.7, 5.3, 2.1, 14.12)",
  timeoutMs: 180_000,
  run: async (product) => {
    // --- Triple-duplicated ID → one 14.3 finding with three locations.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [T14_8_DUP_FILE]: T14_8_DUP_SOURCE,
        },
      },
      async (workspace) => {
        const context = "T14-8 `build --json` over a triple-duplicated ID";
        const findings = await buildFindings(product, workspace, context);
        assertConditionCounts(
          findings,
          { "14.3": 1 },
          `${context} — the duplication is ONE finding (one condition the ` +
            `three bearers jointly violate), never one per occurrence, and ` +
            `the workspace's only condition (SPEC 14, 14.3)`,
        );
        assertFindingLocatesParticipants(
          findingOf(findings, "14.3", context),
          T14_8_DUP_PARTICIPANTS,
          `${context}: the condition-3 finding locates every bearer`,
        );
      },
    );

    // --- Import-binding collision → one 14.15 finding locating every
    // colliding declaration.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [T14_8_COL_FILE]: T14_8_COL_SOURCE,
          "specs/One.mdx": T14_8_ONE_SOURCE,
          "specs/Two.mdx": T14_8_TWO_SOURCE,
        },
      },
      async (workspace) => {
        const context = "T14-8 `build --json` over an import-binding collision";
        const findings = await buildFindings(product, workspace, context);
        assertConditionCounts(
          findings,
          { "14.15": 1 },
          `${context} — the collision is ONE finding (one condition the two ` +
            `declarations jointly violate) and the workspace's only ` +
            `condition: each import is individually valid, unused bindings ` +
            `included (SPEC 2.1, 14, 14.15)`,
        );
        assertFindingLocatesParticipants(
          findingOf(findings, "14.15", context),
          T14_8_COL_PARTICIPANTS,
          `${context}: the condition-15 finding locates every colliding ` +
            `declaration — the first included`,
        );
      },
    );

    // --- Cross-file dependency cycle → one 14.9 finding locating every
    // participating reference spelling, beside the one 14.9 finding locating
    // the unavoidable import cycle's every participating import declaration.
    await withWorkspace({ files: T14_8_CYC_FILES }, async (workspace) => {
      const context =
        "T14-8 `build --json` over a cross-file dependency cycle (with its " +
        "unavoidable mutual-import spec import cycle)";
      const findings = await buildFindings(product, workspace, context);
      assertConditionCounts(
        findings,
        { "14.9": 2 },
        `${context} — two distinct condition-9 violations are present (the ` +
          `dependency cycle; the spec import cycle), each ONE finding — ` +
          `never merged, never split per file or per rotation (SPEC 5.3, ` +
          `2.1, 14, 14.9)`,
      );
      const dependencyMatches = findings.filter((finding) =>
        locationsMatchParticipants(finding, T14_8_CYC_SPELLING_PARTICIPANTS),
      );
      const importMatches = findings.filter((finding) =>
        locationsMatchParticipants(finding, T14_8_CYC_IMPORT_PARTICIPANTS),
      );
      if (dependencyMatches.length !== 1 || importMatches.length !== 1) {
        fail(
          `${context}: of the two 14.9 findings, exactly one must locate ` +
            `the dependency cycle's full path — every participating ` +
            `reference spelling, one location per \`d\`-bearing element in ` +
            `its containing file — and exactly one must locate every ` +
            `participating import declaration (SPEC 14, 5.3, 2.1, 12.7; the ` +
            `windows are disjoint by construction); got ` +
            `${String(dependencyMatches.length)} spelling-located and ` +
            `${String(importMatches.length)} import-located among ` +
            `${JSON.stringify(findings)}`,
        );
      }
      assertFindingLocatesParticipants(
        dependencyMatches[0]!,
        T14_8_CYC_SPELLING_PARTICIPANTS,
        `${context}: the dependency-cycle finding`,
      );
      assertFindingLocatesParticipants(
        importMatches[0]!,
        T14_8_CYC_IMPORT_PARTICIPANTS,
        `${context}: the import-cycle finding`,
      );
    });

    // --- Pure spec import cycle → exactly one 14.9 finding locating every
    // participating import declaration.
    await withWorkspace({ files: T14_8_IMP_FILES }, async (workspace) => {
      const context =
        "T14-8 `build --json` over a pure mutual-import spec import cycle " +
        "(bindings unused, so no dependency edge exists)";
      const findings = await buildFindings(product, workspace, context);
      assertConditionCounts(
        findings,
        { "14.9": 1 },
        `${context} — the import cycle is the workspace's only condition ` +
          `and ONE finding (SPEC 2.1, 14, 14.9)`,
      );
      assertFindingLocatesParticipants(
        findingOf(findings, "14.9", context),
        T14_8_IMP_PARTICIPANTS,
        `${context}: the condition-9 finding locates every participating ` +
          `import declaration`,
      );
    });

    // --- No-occurrence MDX embedding spelling → the 14.6 finding's range is
    // the full braced container, byte-exact.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [T14_8_EMB_FILE]: T14_8_EMB_SOURCE,
        },
      },
      async (workspace) => {
        const context =
          "T14-8 `build --json` over a no-occurrence MDX embedding spelling";
        const findings = await buildFindings(product, workspace, context);
        assertConditionCounts(
          findings,
          { "14.6": 1 },
          `${context} — the unresolving local \`text(...)\` target is the ` +
            `workspace's only condition (SPEC 14.6)`,
        );
        const finding = findingOf(findings, "14.6", context);
        assertSameJson(
          finding.locations,
          [{ file: T14_8_EMB_FILE, range: T14_8_EMB_RANGE }],
          `${context}: the condition-6 finding's one location is the FULL ` +
            `braced container, opening brace through closing brace — the ` +
            `span its occurrence would occupy — byte-exact (SPEC 14, 5.7; ` +
            `keeping T11.4-6's byte classification exact)`,
        );
        if (finding.path !== null) {
          fail(
            `${context}: a located condition's finding concerns no path — ` +
              `\`path\` null (SPEC 12.7, 14); got ` +
              `${JSON.stringify(finding.path)}`,
          );
        }
      },
    );

    // --- Policy finding → locations [], path null, context identities alone.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": T14_8_POLICY_CONFIG,
          [T14_8_POL_FILE]: T14_8_POL_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T14-8 policy staging `build` — build never evaluates policy " +
            "(SPEC 7.5, 12.1), so the premise build passes",
        );
        const context =
          "T14-8 `check --json` over the one forbidden `depends` edge";
        const findings = await checkFindings(product, workspace, context);
        assertConditionCounts(
          findings,
          { "14.12": 1 },
          `${context} — the forbidden rule's one violation (the sole ` +
            `depends/embeds/references edge between "main" nodes) is the ` +
            `freshly built workspace's only finding (SPEC 7.5, 14.12)`,
        );
        assertSameJson(
          findings.map((finding) => ({
            locations: finding.locations,
            path: finding.path,
            identities: finding.identities,
          })),
          [
            {
              locations: [],
              path: null,
              identities: [
                "no-spec-deps",
                `${T14_8_POL_FILE}#p`,
                "depends",
                `${T14_8_POL_FILE}#a`,
              ],
            },
          ],
          `${context}: a policy finding, constraining an edge rather than ` +
            `any file's content, carries no in-source locations and ` +
            `concerns no path — \`locations\` [], \`path\` null — its ` +
            `context identities alone, in order the violated rule's name ` +
            `and the edge's source identity, kind token, and target ` +
            `identity (SPEC 14.12, 12.7)`,
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T14-11 — per-condition ranges, byte-exact
// ---------------------------------------------------------------------------

// Every fixture below is assembled from exactly known parts (`assemble`), and
// every pinned offset is the UTF-8 byte length of the text before the pinned
// part — never a string index: the shared preamble and the 14.20 fixtures put
// a multibyte character (`é`) before the pinned construct, so a product
// reporting character indices or line/column pairs fails. Ranges are asserted
// byte-EXACT — no end-widening: the module-header window convention is set
// aside here, since SPEC 14 fixes each condition's range.

/** A part of a fixture whose exact byte range the arm pins (`pin`). */
interface PinnedPart {
  readonly pin: string;
}

/** Mark a fixture part as pinned; `pin("")` pins a zero-length range. */
function pin(text: string): PinnedPart {
  return { pin: text };
}

/** A fixture text with the byte range of each pinned part, in part order. */
interface AssembledFixture {
  readonly text: string;
  readonly ranges: readonly { readonly start: number; readonly end: number }[];
}

/**
 * Concatenate the parts; each pinned part's range is [bytes before it, bytes
 * through it) over the assembled UTF-8 text (SPEC 1.7: zero-based byte
 * offsets, start-inclusive, end-exclusive).
 */
function assemble(parts: readonly (string | PinnedPart)[]): AssembledFixture {
  let text = "";
  const ranges: { start: number; end: number }[] = [];
  for (const part of parts) {
    if (typeof part === "string") {
      text += part;
      continue;
    }
    const start = Buffer.byteLength(text, "utf8");
    text += part.pin;
    ranges.push({ start, end: Buffer.byteLength(text, "utf8") });
  }
  return { text, ranges };
}

/** One pinned location: a file and its exact `{start, end}` (SPEC 12.7). */
interface ExactLocation {
  readonly file: string;
  readonly range: { readonly start: number; readonly end: number };
}

/** The pinned ranges of `fixture` (by pin index) as locations in `file`. */
function located(
  file: string,
  fixture: AssembledFixture,
  ...indices: readonly number[]
): readonly ExactLocation[] {
  return indices.map((index) => {
    const range = fixture.ranges[index];
    if (range === undefined) {
      throw new Error(
        `T14-11 fixture ${file} pins no part #${String(index)} (harness bug)`,
      );
    }
    return { file, range };
  });
}

/** A finding whose condition and complete location list are pinned. */
interface ExactFindingExpectation {
  readonly condition: string;
  readonly locations: readonly ExactLocation[];
}

/** One range-rule arm: a workspace whose `build --json` findings are pinned. */
interface RangeRuleCase {
  /** The arm's letter (diagnostics). */
  readonly arm: string;
  /** The SPEC 14 range rule under test (diagnostics). */
  readonly rule: string;
  /** The configuration, a staged-source record (S-9) as `files`' entries are. */
  readonly config: StagedTs;
  /**
   * The sources beside the configuration, every one a staged-source record
   * carrying its own S-9 declaration — an `.mdx` entry an MDX record, a code
   * source a TypeScript record, 14.20's declared forms declared unparseable:
   * every arm's workspace but (a)'s follows the body's first invocation,
   * (a)'s converted uniformly, the (w) arms' records registered by their
   * home modules.
   */
  readonly files: Readonly<Record<string, InitialFileContents>>;
  /** Every staged finding, with its complete location list. */
  readonly expected: readonly ExactFindingExpectation[];
}

/** A valid section every MDX fixture opens with — `ok` is a resolvable target. */
const T14_11_PREAMBLE = '<S id="ok">\nTarget: café.\n</S>\n\n';

/**
 * The spec source the code-file arms import: `a`, `a.b`, and `b` resolve —
 * a staged-source record (S-9), also the refined `d`-value arms' imported
 * `specs/BASE.mdx` and arm (o)'s readable source.
 */
const T14_11_A_MDX = stagedMdx(
  "T14-11 specs/A.mdx (the imported module: a, a.b, and b; arms (d), (j), (l), (u), and (o), and arms (p)-(t)'s specs/BASE.mdx)",
  '<S id="a">\nA.\n<S id="a.b">\nA.b.\n</S>\n</S>\n\n<S id="b">\nB.\n</S>\n',
);

// (a) 14.5 — an unresolved entry of a `d` array literal: the entry's own
// expression, its quotes included, no bracket, comma, or whitespace.
const T14_11_D_ENTRY = assemble([
  T14_11_PREAMBLE,
  '<S id="a" d={["ok", ',
  pin('"absent"'),
  "]}>\nUnknown second entry.\n</S>\n",
]);

// (b) 14.8 — a non-array braced `d` value: the expression the braces enclose,
// the braces excluded.
const T14_11_D_IDENT = assemble([
  T14_11_PREAMBLE,
  '<S id="a" d={',
  pin("foo"),
  "}>\nA dynamic d value.\n</S>\n",
]);

// (c) 14.20 — braces enclosing no expression: an attribute value admits no
// empty expression (SPEC 2.7), so `d={}` and `d={ /* c */ }` are not
// well-formed MDX — condition 20, never 14.8 — the one zero-length range at
// the offset of the closing brace (the prefix before `}` begins some
// well-formed file: `d={1}` continues either).
const T14_11_D_EMPTY = assemble([
  T14_11_PREAMBLE,
  '<S id="a" d={',
  pin(""),
  "}>\nAn empty d value.\n</S>\n",
]);
const T14_11_D_COMMENT_ONLY = assemble([
  T14_11_PREAMBLE,
  '<S id="a" d={ /* c */ ',
  pin(""),
  "}>\nA comment-only d value.\n</S>\n",
]);

// (d) 14.8 — a non-static bare reference in expression-statement position:
// the statement's expression, exclusive of the `;`.
const T14_11_OPTIONAL_CHAIN = assemble([
  'import SPEC from "../specs/A.xspec"\n\n',
  pin("SPEC?.a"),
  ";\n",
]);

// (e) 14.2 — each bearer's `id` attribute: a two-segment top-level ID and a
// level-skipping child, one finding each.
const T14_11_STRUCTURAL = assemble([
  T14_11_PREAMBLE,
  "<S ",
  pin('id="top.two"'),
  '>\nTwo segments at top level.\n</S>\n\n<S id="p">\n<S ',
  pin('id="p.q.r"'),
  ">\nSkips a level.\n</S>\n</S>\n",
]);

// (f) 14.3 — one finding locating each bearer's `id` attribute.
const T14_11_DUPLICATE = assemble([
  T14_11_PREAMBLE,
  "<S ",
  pin('id="dup"'),
  ">\nFirst bearer.\n</S>\n\n<S ",
  pin('id="dup"'),
  ">\nSecond bearer.\n</S>\n",
]);

// (g) 14.4 — one finding per violating attribute, each at the attribute: the
// parent's `id`, the child's own `id` (spelling the malformed segment as its
// prefix), and a `tags` attribute.
const T14_11_SEGMENT_TAG = assemble([
  T14_11_PREAMBLE,
  "<S ",
  pin('id="a b"'),
  ">\n<S ",
  pin('id="a b.c"'),
  '>\nChild of a malformed segment.\n</S>\n</S>\n\n<S id="t" ',
  pin('tags="bad#tag"'),
  ">\nA malformed tag.\n</S>\n",
]);

// (h) 14.17 per form — a repeated prop locating every attribute spelling the
// name, an unknown prop, a spread attribute (its whole braced construct), and
// an invalid `coverage` value, each at the attribute's own characters.
const T14_11_INVALID_PROP = assemble([
  T14_11_PREAMBLE,
  "<S ",
  pin('id="rep"'),
  " ",
  pin('id="rep2"'),
  '>\nRepeated id.\n</S>\n\n<S id="unk" ',
  pin('wibble="x"'),
  '>\nUnknown prop.\n</S>\n\n<S id="spr" ',
  pin("{...extra}"),
  '>\nSpread attribute.\n</S>\n\n<S id="cov" ',
  pin('coverage="maybe"'),
  ">\nInvalid coverage value.\n</S>\n",
]);

// (i) 14.1 — the section's opening tag, its own characters alone.
const T14_11_MISSING_ID = assemble([
  T14_11_PREAMBLE,
  pin('<S coverage="none">'),
  "\nMissing id.\n</S>\n",
]);

// (j) 14.15 per form: an import declaration (the second of an MDX file's two,
// alone), an export declaration, and `import X = require(…)` by their own
// characters — each staged without `;`, so "own characters" is unambiguous —
// a dynamic `import()` by its call expression (its `;` excluded), and the
// colliding non-import declaration by the construct binding the name — the
// variable declarator `SPEC = 1`, the `const` statement excluded — beside the
// import declaration it collides with (T4.5-8). The chains rooted at the
// collided identifier are unresolved (14.7, SPEC 2.4): the marker by its bare
// chain exclusive of the `;`, the `text(...)` call callee through closing
// parenthesis (5.7) — `a` and `b` exist, so a product ignoring the collision
// resolves them and reports nothing.
const T14_11_IMPORT_MDX = assemble([
  'import A from "./A.xspec"\n',
  pin('import NOPE from "./Missing.xspec"'),
  '\n\n<S id="b" d={A.a}>\nUses A.\n</S>\n',
]);
const T14_11_EXPORT_TS = assemble([
  "const before = 1\n\n",
  pin('export * from "../specs/A.xspec"'),
  "\n",
]);
const T14_11_REQUIRE_TS = assemble([
  "const before = 1\n\n",
  pin('import X = require("../specs/A.xspec")'),
  "\n",
]);
const T14_11_DYNAMIC_TS = assemble([
  "const before = 1\n\n",
  pin('import("../specs/A.xspec")'),
  ";\n",
]);
const T14_11_COLLISION_TS = assemble([
  pin('import SPEC, { text } from "../specs/A.xspec"'),
  "\n\nconst ",
  pin("SPEC = 1"),
  "\n\n",
  pin("SPEC.a"),
  ";\n",
  pin("text(SPEC.b)"),
  ";\n",
]);

// (k) 14.16 per form: an element from the first character of its opening tag
// through the last of its closing tag, a self-closing element its own tag, a
// fragment from `<>` through `</>` (an invalid element, SPEC 2.7; T2.7-1),
// an expression container brace through brace, an export statement whole.
const T14_11_CONSTRUCTS = assemble([
  T14_11_PREAMBLE,
  pin("<div>Not a section.</div>"),
  "\n\n",
  pin("<br />"),
  "\n\n",
  pin("<>Fragment.</>"),
  "\n\n",
  pin("{1 + 1}"),
  "\n\n",
  pin("export const x = 1"),
  "\n",
]);

// (l) 14.18: a node binding's identifier extended by the longest static chain
// it roots at the offending use (`a.b` exists, so nothing else reports); a
// `text` binding passed to another function, its identifier alone.
const T14_11_USAGE_TS = assemble([
  'import SPEC, { text } from "../specs/A.xspec"\n\n' +
    "declare function f(x: unknown): void\n\nconst n = ",
  pin("SPEC.a.b"),
  "\n\nf(",
  pin("text"),
  ")\n",
]);

// (m) 14.20's one zero-length range at the failure's offset: 0 for a
// byte-order mark; for an encoding failure the offset of the first byte at
// which UTF-8 decoding fails — a valid 5-byte prefix (`Café`: four characters,
// five bytes) then 0xFF; for a syntax failure the byte length of the longest
// whole-character prefix with which some well-formed file begins — an MDX file
// ending inside an unclosed section (the whole file such a prefix: its byte
// length, past the multibyte `é`) and the TypeScript file `let x = ;` (the
// prefix `let x = `: 8) — never past the file's length.
const T14_11_BOM_MDX = assemble([
  pin(""),
  `${BOM}<S id="bom">\nA byte-order mark.\n</S>\n`,
]);
const T14_11_ENCODING_PREFIX = "Café";
const T14_11_ENCODING_MDX = withInvalidUtf8Byte(
  T14_11_ENCODING_PREFIX,
  '\n<S id="enc">\nBody.\n</S>\n',
);
const T14_11_ENCODING_OFFSET = Buffer.byteLength(
  T14_11_ENCODING_PREFIX,
  "utf8",
);
const T14_11_UNCLOSED_MDX = assemble([
  '<S id="open">\nEnds inside an unclosed section: café.\n',
  pin(""),
]);
const T14_11_SYNTAX_TS = assemble(["let x = ", pin(""), ";\n"]);

// (p)–(t) The refined `d`-value ranges (the occurrence-span rule of SPEC 14,
// 5.7) over a module imported as `BASE` — `T14_11_A_MDX`, whose `a` and `b`
// resolve and whose `missing` does not. Each fixture opens with the import
// and the preamble, so the multibyte `é` precedes every pinned construct.
const T14_11_BASE = "specs/BASE.mdx";
const T14_11_BASE_IMPORT = 'import BASE from "./BASE.xspec"\n\n';
const NBSP = String.fromCodePoint(0xa0); // U+00A0 — ECMAScript whitespace
const ZWNBSP = String.fromCodePoint(0xfeff); // U+FEFF — inside the file, so no byte-order mark

// (p) 14.8 — `d={(BASE.a)}`: the expression the braces enclose, first token
// through last, so the parentheses are included (parentheses join no static
// chain, SPEC 2.4).
const T14_11_D_PAREN = assemble([
  T14_11_BASE_IMPORT,
  T14_11_PREAMBLE,
  '<S id="p" d={',
  pin("(BASE.a)"),
  "}>\nA parenthesized chain.\n</S>\n",
]);

// (q) 14.8 — `d={BASE.a, BASE.b}`: a comma sequence is one expression
// (SPEC 14.20), located whole — never two references.
const T14_11_D_COMMA = assemble([
  T14_11_BASE_IMPORT,
  T14_11_PREAMBLE,
  '<S id="q" d={',
  pin("BASE.a, BASE.b"),
  "}>\nA comma sequence.\n</S>\n",
]);

// (r) 14.5 — the unresolved expression alone: the braces, and the whitespace
// and comment between them and the expression, excluded — a block comment
// with ASCII whitespace, U+00A0 on each side, U+FEFF before it, and U+1680
// and U+3000 each on each side (ECMAScript whitespace, SPEC 1.4: its space
// separators Unicode 15.1's, 14.20; T5.7-2), the last four shifting the
// pinned start by their own byte lengths (2, 3, 3, and 3), so a product
// bounding the expression by ASCII or Latin-1 whitespace alone, or
// counting characters, fails the arm.
const OGHAM_SPACE = String.fromCodePoint(0x1680); // U+1680 — a Unicode 15.1 space separator (Zs)
const IDEOGRAPHIC_SPACE = String.fromCodePoint(0x3000); // U+3000 — a Unicode 15.1 space separator (Zs)
const T14_11_D_TRIVIA = assemble([
  T14_11_BASE_IMPORT,
  T14_11_PREAMBLE,
  '<S id="m1" d={ /* c */ ',
  pin("BASE.missing"),
  ' }>\nA block comment before the reference.\n</S>\n\n<S id="m2" d={' + NBSP,
  pin("BASE.missing"),
  NBSP + '}>\nU+00A0 on each side.\n</S>\n\n<S id="m3" d={' + ZWNBSP,
  pin("BASE.missing"),
  '}>\nU+FEFF before the reference.\n</S>\n\n<S id="m4" d={' + OGHAM_SPACE,
  pin("BASE.missing"),
  OGHAM_SPACE +
    '}>\nU+1680 on each side.\n</S>\n\n<S id="m5" d={' +
    IDEOGRAPHIC_SPACE,
  pin("BASE.missing"),
  IDEOGRAPHIC_SPACE + "}>\nU+3000 on each side.\n</S>\n",
]);

// (s) 14.8 — a spread entry `d={[...BASE.a]}`: `...BASE.a`, the `...`
// included, no bracket.
const T14_11_D_SPREAD = assemble([
  T14_11_BASE_IMPORT,
  T14_11_PREAMBLE,
  '<S id="s" d={[',
  pin("...BASE.a"),
  "]}>\nA spread entry.\n</S>\n",
]);

// (t) 14.8 — the elisions of one array literal as one finding at the whole
// literal, brackets included, however many holes; two literals, two findings
// (the resolving entries beside the holes report nothing).
const T14_11_D_ELISIONS = assemble([
  T14_11_BASE_IMPORT,
  T14_11_PREAMBLE,
  '<S id="e1" d={',
  pin("[BASE.a, , , BASE.b]"),
  '}>\nTwo holes.\n</S>\n\n<S id="e2" d={',
  pin("[, BASE.b]"),
  "}>\nOne hole.\n</S>\n",
]);

// (u) 14.15 — a colliding non-import declaration by the construct binding
// the name, per form, as 1.7 reads one (T4.5-8's shared stagings,
// `T4_5_8_FURTHER_LOCATED_FORMS`): `let SPEC;` at `SPEC` alone (a declarator
// without initializer is its name), `const { SPEC } = o` at `{ SPEC } = o`
// (the binding pattern through its initializer, the `const` statement
// excluded), `@dec class SPEC {}` from its `@` (a decorator list is part of
// the class it decorates), and `export class SPEC {}` from `class` (the
// leading `export` excluded) — each in its own code file beside the import
// declaration it collides with, located by its own characters (staged
// without `;`, as in (j)), the chains the collided identifier roots
// unresolved (14.7, SPEC 2.4): the marker by its bare chain exclusive of
// the `;`, the `text(...)` call callee through closing parenthesis (5.7) —
// `a` and `b` exist, so a product ignoring the collision resolves them and
// reports nothing. A form's supporting declaration (`declare const o`,
// `declare function dec`) precedes its colliding line and binds no `SPEC`.
function collisionFixture(form: SameScopeDeclarationArm): AssembledFixture {
  const at = form.line.indexOf(form.construct);
  if (at === -1) {
    throw new Error(
      `T14-11 (u) fixture broke: the located construct must occur within ` +
        `the declaration line (${form.name}) — fix ` +
        `T4_5_8_FURTHER_LOCATED_FORMS in section-4.5.ts (harness bug)`,
    );
  }
  return assemble([
    pin('import SPEC, { text } from "../specs/A.xspec"'),
    "\n\n",
    form.line.slice(0, at),
    pin(form.construct),
    form.line.slice(at + form.construct.length),
    "\n\n",
    pin("SPEC.a"),
    ";\n",
    pin("text(SPEC.b)"),
    ";\n",
  ]);
}

/**
 * The (u) forms as the code files of one workspace, `src/collide-<key>.ts`,
 * each staged as a staged-source record (S-9; arm (u) follows the body's
 * first invocation).
 */
const T14_11_COLLISION_FILES = Object.entries(T4_5_8_FURTHER_LOCATED_FORMS).map(
  ([key, form]) => {
    const file = `src/collide-${key}.ts`;
    const fixture = collisionFixture(form);
    return {
      file,
      fixture,
      source: stagedTs(
        `T14-11 (u) ${file} (the ${key} form beside its import)`,
        fixture.text,
      ),
    };
  },
);

// (v) 14.20's encoding offset — the byte length of the file's longest
// well-formed UTF-8 prefix: the offset of the first byte of the first
// ill-formed sequence, whether it is malformed or truncated by the file's
// end, never a later byte at which a decoder notices it, and — like every
// 14.20 range — zero-length. The five sequences SPEC 14 names, staged as
// exact bytes in a spec source and in a code source alike (SPEC 1.6: a
// source of either kind that is not valid UTF-8 is unparseable): a valid
// 5-byte prefix then `FF` — `Café` (`43 61 66 C3 A9`), then a byte no UTF-8
// sequence holds; arm (m) stages the same form as `specs/enc.mdx` — locates
// 5; `41 E2 82 41` — a three-byte sequence cut short, the second `41` where
// a decoder notices — 1; `C0 80` — an overlong encoding of U+0000 — 0;
// `ED A0 80` — the surrogate code point U+D800 — 0; `41 E2 82` truncated by
// the end of the file — 1. A decoder accepting overlong or surrogate
// encodings decodes such a file and reports nothing; one reporting where it
// resynchronizes locates a later byte. The whole file is masked (14.20), so
// no other finding stands beside. The pins are the document's own numbers:
// computing them with a decoder would import the judgement under test.
interface EncodingForm {
  /** The file basename (`specs/<name>.mdx` and `src/<name>.ts`). */
  readonly name: string;
  /** The file's exact bytes. */
  readonly bytes: readonly number[];
  /** The byte length of the longest well-formed UTF-8 prefix (SPEC 14). */
  readonly offset: number;
}
const T14_11_ENCODING_FORMS: readonly EncodingForm[] = [
  { name: "prefix", bytes: [0x43, 0x61, 0x66, 0xc3, 0xa9, 0xff], offset: 5 },
  { name: "cut", bytes: [0x41, 0xe2, 0x82, 0x41], offset: 1 },
  { name: "overlong", bytes: [0xc0, 0x80], offset: 0 },
  { name: "surrogate", bytes: [0xed, 0xa0, 0x80], offset: 0 },
  { name: "eof", bytes: [0x41, 0xe2, 0x82], offset: 1 },
];

/**
 * Each encoding form as a spec source and as a code source, its pin located:
 * each a staged-source record declared unparseable (S-9; arm (v) follows the
 * body's first invocation) — the spec source an MDX record, the code source
 * a TypeScript record.
 */
const T14_11_ENCODING_FILES = T14_11_ENCODING_FORMS.flatMap((form) =>
  [`specs/${form.name}.mdx`, `src/${form.name}.ts`].map((file) => ({
    file,
    contents: file.endsWith(".mdx")
      ? stagedMdx(
          `T14-11 (v) ${file} (the ${form.name} encoding form)`,
          Uint8Array.from(form.bytes),
          "unparseable",
        )
      : stagedTs(
          `T14-11 (v) ${file} (the ${form.name} encoding form)`,
          Uint8Array.from(form.bytes),
          "unparseable",
        ),
    location: { file, range: { start: form.offset, end: form.offset } },
  })),
);

// (w) The syntax-failure offsets other tests pin, re-asserted the same way
// (TEST-SPEC T14-11's closing clause: "the syntax-failure offsets of T2.3-3,
// T2.4-2, T2.7-3, T2.7-4, and T14-12 asserted the same way"). Each home
// module exports its staging — the very bytes its own arm drives, never
// re-spelled here (`UnparseableStaging`, support.ts) — and T14-11 runs
// `build --json` over it as one more range-rule arm: exactly one finding,
// 14.20, `path` null, its one location the zero-length range at the offset
// SPEC 14's rule fixes — the byte length of the longest whole-character
// prefix with which some well-formed file begins, never a line/column pair
// and never past the file's length. The stagings: T2.3-3's
// `{text("a") text("b")}` at the second `text`; T2.4-2's TypeScript-only
// forms in a spec source — `d={BASE.auth!}` at its closing brace,
// `{text(BASE.auth!)}` at its closing parenthesis, and the `as` forms at the
// offset of `as`; T2.7-3's spread attribute `{...a, b}` at its comma;
// T2.7-4's comment-grammar failures — U+0085 and U+200B between braces at
// the code point, `{// c` U+2028/U+2029 `}` U+000A `}` at the first `}`,
// and `{// c}` with no later `}` at the file's byte length; and T14-12's
// negative arms — `010` and `09` in a `.ts` file at the second digit, the
// spread's comma, an ESM block's statement at the `const` line's start,
// import attributes at `with`, `d={]}` at the `]`, `{text(}` at its `}`,
// and an unbalanced `{text("a")` at the file's byte length. Every spec
// source is the staged-source record its home module registers — the
// failing one declared unparseable (S-9) — staged here under that very
// declaration, as in its home arm (the (w) workspaces follow this body's
// earlier invocations); a code-source staging's failing file is likewise
// the TypeScript record its home module registers, declared unparseable
// (`reassertedCase` confirms each staging's failing file is a record so
// declared, at load); the configuration is this module's record for the
// staging's kind (the home modules stage the same text).

/** T14-12's arm as an `UnparseableStaging`: its sources beside the configuration. */
function t1412Staging(arm: UnparseableArm): UnparseableStaging {
  return {
    name: `(${arm.arm}) ${arm.name} (T14-12)`,
    kind: arm.kind,
    file: arm.file,
    files: Object.fromEntries(
      Object.entries(arm.files).filter(([file]) => file !== "xspec.config.ts"),
    ),
    offset: arm.offset,
  };
}

/** Every re-asserted staging, in the order of T14-11's closing clause. */
const T14_11_REASSERTED_STAGINGS: readonly UnparseableStaging[] = [
  T2_3_3_UNPARSEABLE_STAGING,
  ...T2_4_2_UNPARSEABLE_STAGINGS,
  T2_7_3_SPREAD_UNPARSEABLE_STAGING,
  ...T2_7_4_UNPARSEABLE_STAGINGS,
  ...T14_12_UNPARSEABLE_ARMS.map(t1412Staging),
];

/** One re-asserted staging as a range-rule arm: `{14.20: 1}` at its offset. */
function reassertedCase(
  index: number,
  staging: UnparseableStaging,
): RangeRuleCase {
  const { kind, file, files, offset } = staging;
  // S-9: the failing file is a staged-source record declared unparseable —
  // an MDX record for a spec-source staging, a TypeScript record for a
  // code-source one — so the workspace declares nothing beside it.
  const failing = files[file];
  const declared =
    kind === "code-source"
      ? failing instanceof StagedTs && failing.ts === "unparseable"
      : failing instanceof StagedMdx && failing.mdx === "unparseable";
  if (!declared) {
    throw new Error(
      `T14-11 (w): the re-asserted staging ${JSON.stringify(staging.name)} ` +
        `stages its failing ${kind} ${file} as something other than a ` +
        `staged-source record declared unparseable (S-9)`,
    );
  }
  return {
    arm: `w.${String(index)}`,
    rule: `14.20 — a syntax-failure offset another test pins, re-asserted: ${staging.name}`,
    config: kind === "code-source" ? SPEC_AND_CODE_CONFIG : SPECS_ONLY_CONFIG,
    files,
    expected: [
      {
        condition: "14.20",
        locations: [{ file, range: { start: offset, end: offset } }],
      },
    ],
  };
}

const T14_11_REASSERTED_CASES: readonly RangeRuleCase[] =
  T14_11_REASSERTED_STAGINGS.map((staging, index) =>
    reassertedCase(index + 1, staging),
  );

// (x) 14.15 per form, the module-linking forms beyond (j)'s (SPEC 4, 14):
// `export import X = require(…)` from `import` — the leading `export` and
// the space separating it excluded, as 1.7 excludes one; an import type
// from `import` through the closing parenthesis of its argument list, in
// two type positions — `typeof import(…).default`, the `typeof` before it
// and the `.default` qualifier after it excluded, and `import(…).T<number>`,
// the `.T` qualifier and the type arguments excluded; and a string-named
// module declaration by its own characters — `declare module "…" { }`
// whole, `declare` included, and `export declare module "…" { }` from
// `declare`, the leading `export` excluded (1.7). Each form stands alone in
// its own code file, staged without `;` as in (j), after a declaration
// holding the multibyte `é`, so a product counting characters misplaces
// every range. Every specifier designates the discovered spec source
// `specs/A.mdx`, so the form alone is the defect (an import declaration is
// the only form through which a TypeScript file consumes a spec module,
// SPEC 4). TypeScript's complaints about these files — a relative ambient
// module name, an `export` modifier on an ambient module declaration — are
// post-parse checks, so each file is well-formed (14.20), its one finding
// 14.15's.
const T14_11_LINKING_LEAD = 'const before = "café"\n\n';
const T14_11_LINKING_FORMS: readonly {
  readonly file: string;
  readonly form: string;
  readonly fixture: AssembledFixture;
}[] = [
  {
    file: "src/export-require.ts",
    form: "export import X = require of the spec module, located from import",
    fixture: assemble([
      T14_11_LINKING_LEAD + "export ",
      pin('import X = require("../specs/A.xspec")'),
      "\n",
    ]),
  },
  {
    file: "src/typeof-import.ts",
    form: "the import type typeof import(…).default, located import through the argument list",
    fixture: assemble([
      T14_11_LINKING_LEAD + "type D = typeof ",
      pin('import("../specs/A.xspec")'),
      ".default\n",
    ]),
  },
  {
    file: "src/qualified-import.ts",
    form: "the import type import(…).T<number>, located import through the argument list",
    fixture: assemble([
      T14_11_LINKING_LEAD + "type G = ",
      pin('import("../specs/A.xspec")'),
      ".T<number>\n",
    ]),
  },
  {
    file: "src/module.ts",
    form: "declare module of the spec module, located whole",
    fixture: assemble([
      T14_11_LINKING_LEAD,
      pin('declare module "../specs/A.xspec" { }'),
      "\n",
    ]),
  },
  {
    file: "src/export-module.ts",
    form: "export declare module of the spec module, located from declare",
    fixture: assemble([
      T14_11_LINKING_LEAD + "export ",
      pin('declare module "../specs/A.xspec" { }'),
      "\n",
    ]),
  },
];

/**
 * The (x) forms as the code files of one workspace, each a staged-source
 * record (S-9; arm (x) follows the body's first invocation).
 */
const T14_11_LINKING_FILES = T14_11_LINKING_FORMS.map(
  ({ file, form, fixture }) => ({
    file,
    fixture,
    source: stagedTs(`T14-11 (x) ${file} (${form})`, fixture.text),
  }),
);

const T14_11_SPEC = "specs/A.mdx";
const T14_11_CODE = "src/app.ts";

const T14_11_CASES: readonly RangeRuleCase[] = [
  {
    arm: "a",
    rule: "14.5 — an unresolved `d` array entry: the entry's own expression alone",
    config: SPECS_ONLY_CONFIG,
    files: {
      [T14_11_SPEC]: stagedMdx(
        "T14-11 (a) specs/A.mdx (an unresolved d array entry)",
        T14_11_D_ENTRY.text,
      ),
    },
    expected: [
      { condition: "14.5", locations: located(T14_11_SPEC, T14_11_D_ENTRY, 0) },
    ],
  },
  {
    arm: "b",
    rule: "14.8 — `d={foo}`: the expression the braces enclose, braces excluded",
    config: SPECS_ONLY_CONFIG,
    files: {
      [T14_11_SPEC]: stagedMdx(
        "T14-11 (b) specs/A.mdx (d={foo})",
        T14_11_D_IDENT.text,
      ),
    },
    expected: [
      { condition: "14.8", locations: located(T14_11_SPEC, T14_11_D_IDENT, 0) },
    ],
  },
  {
    arm: "c",
    rule: "14.20 — `d={}` and `d={ /* c */ }`: not well-formed MDX, the zero-length range at the closing brace, never 14.8",
    config: SPECS_ONLY_CONFIG,
    // S-9: an attribute value admits no empty expression (SPEC 2.7, 14.20);
    // the stock grammar rejects both (`unexpected-empty-expression`) — the
    // records are declared unparseable.
    files: {
      "specs/empty.mdx": stagedMdx(
        "T14-11 (c) specs/empty.mdx (d={})",
        T14_11_D_EMPTY.text,
        "unparseable",
      ),
      "specs/comment-only.mdx": stagedMdx(
        "T14-11 (c) specs/comment-only.mdx (d={ /* c */ })",
        T14_11_D_COMMENT_ONLY.text,
        "unparseable",
      ),
    },
    expected: [
      {
        condition: "14.20",
        locations: located("specs/empty.mdx", T14_11_D_EMPTY, 0),
      },
      {
        condition: "14.20",
        locations: located("specs/comment-only.mdx", T14_11_D_COMMENT_ONLY, 0),
      },
    ],
  },
  {
    arm: "d",
    rule: "14.8 — `SPEC?.a;`: the statement's expression, exclusive of the `;`",
    config: SPEC_AND_CODE_CONFIG,
    files: {
      [T14_11_SPEC]: T14_11_A_MDX,
      [T14_11_CODE]: stagedTs(
        "T14-11 (d) src/app.ts (SPEC?.a — a non-static bare reference)",
        T14_11_OPTIONAL_CHAIN.text,
      ),
    },
    expected: [
      {
        condition: "14.8",
        locations: located(T14_11_CODE, T14_11_OPTIONAL_CHAIN, 0),
      },
    ],
  },
  {
    arm: "e",
    rule: "14.2 — each bearer's `id` attribute, one finding per bearer",
    config: SPECS_ONLY_CONFIG,
    files: {
      [T14_11_SPEC]: stagedMdx(
        "T14-11 (e) specs/A.mdx (a two-segment top-level ID and a level-skipping child)",
        T14_11_STRUCTURAL.text,
      ),
    },
    expected: [
      {
        condition: "14.2",
        locations: located(T14_11_SPEC, T14_11_STRUCTURAL, 0),
      },
      {
        condition: "14.2",
        locations: located(T14_11_SPEC, T14_11_STRUCTURAL, 1),
      },
    ],
  },
  {
    arm: "f",
    rule: "14.3 — one finding locating each bearer's `id` attribute",
    config: SPECS_ONLY_CONFIG,
    files: {
      [T14_11_SPEC]: stagedMdx(
        "T14-11 (f) specs/A.mdx (two bearers of dup)",
        T14_11_DUPLICATE.text,
      ),
    },
    expected: [
      {
        condition: "14.3",
        locations: located(T14_11_SPEC, T14_11_DUPLICATE, 0, 1),
      },
    ],
  },
  {
    arm: "g",
    rule: "14.4 — one finding per violating `id` or `tags` attribute, at the attribute",
    config: SPECS_ONLY_CONFIG,
    files: {
      [T14_11_SPEC]: stagedMdx(
        "T14-11 (g) specs/A.mdx (malformed id segments and a malformed tag)",
        T14_11_SEGMENT_TAG.text,
      ),
    },
    expected: [0, 1, 2].map((index) => ({
      condition: "14.4",
      locations: located(T14_11_SPEC, T14_11_SEGMENT_TAG, index),
    })),
  },
  {
    arm: "h",
    rule: "14.17 per form — a repeated prop at every attribute spelling the name; an unknown prop, a spread attribute, and an invalid `coverage` value at the attribute",
    config: SPECS_ONLY_CONFIG,
    files: {
      [T14_11_SPEC]: stagedMdx(
        "T14-11 (h) specs/A.mdx (a repeated, an unknown, a spread, and an invalid coverage prop)",
        T14_11_INVALID_PROP.text,
      ),
    },
    expected: [
      {
        condition: "14.17",
        locations: located(T14_11_SPEC, T14_11_INVALID_PROP, 0, 1),
      },
      ...[2, 3, 4].map((index) => ({
        condition: "14.17",
        locations: located(T14_11_SPEC, T14_11_INVALID_PROP, index),
      })),
    ],
  },
  {
    arm: "i",
    rule: "14.1 — the section's opening tag",
    config: SPECS_ONLY_CONFIG,
    files: {
      [T14_11_SPEC]: stagedMdx(
        "T14-11 (i) specs/A.mdx (a section without an id)",
        T14_11_MISSING_ID.text,
      ),
    },
    expected: [
      {
        condition: "14.1",
        locations: located(T14_11_SPEC, T14_11_MISSING_ID, 0),
      },
    ],
  },
  {
    arm: "j",
    rule: "14.15 per form — declarations by their own characters, a dynamic `import()` by its call expression, a colliding declarator beside its import (14.7 for the chains it roots)",
    config: SPEC_AND_CODE_CONFIG,
    files: {
      [T14_11_SPEC]: T14_11_A_MDX,
      "specs/B.mdx": stagedMdx(
        "T14-11 (j) specs/B.mdx (an import of a missing module beside A's)",
        T14_11_IMPORT_MDX.text,
      ),
      "src/exp.ts": stagedTs(
        "T14-11 (j) src/exp.ts (export * from the spec module)",
        T14_11_EXPORT_TS.text,
      ),
      "src/req.ts": stagedTs(
        "T14-11 (j) src/req.ts (import X = require of the spec module)",
        T14_11_REQUIRE_TS.text,
      ),
      "src/dyn.ts": stagedTs(
        "T14-11 (j) src/dyn.ts (a dynamic import() of the spec module)",
        T14_11_DYNAMIC_TS.text,
      ),
      "src/collide.ts": stagedTs(
        "T14-11 (j) src/collide.ts (a colliding const declarator beside its import)",
        T14_11_COLLISION_TS.text,
      ),
    },
    expected: [
      {
        condition: "14.15",
        locations: located("specs/B.mdx", T14_11_IMPORT_MDX, 0),
      },
      {
        condition: "14.15",
        locations: located("src/exp.ts", T14_11_EXPORT_TS, 0),
      },
      {
        condition: "14.15",
        locations: located("src/req.ts", T14_11_REQUIRE_TS, 0),
      },
      {
        condition: "14.15",
        locations: located("src/dyn.ts", T14_11_DYNAMIC_TS, 0),
      },
      {
        condition: "14.15",
        locations: located("src/collide.ts", T14_11_COLLISION_TS, 0, 1),
      },
      {
        condition: "14.7",
        locations: located("src/collide.ts", T14_11_COLLISION_TS, 2),
      },
      {
        condition: "14.7",
        locations: located("src/collide.ts", T14_11_COLLISION_TS, 3),
      },
    ],
  },
  {
    arm: "k",
    rule: "14.16 per form — an element through its closing tag, a self-closing tag, a fragment `<>` through `</>`, an expression container brace through brace, an export statement whole",
    config: SPECS_ONLY_CONFIG,
    files: {
      [T14_11_SPEC]: stagedMdx(
        "T14-11 (k) specs/A.mdx (the five invalid construct forms)",
        T14_11_CONSTRUCTS.text,
      ),
    },
    expected: [0, 1, 2, 3, 4].map((index) => ({
      condition: "14.16",
      locations: located(T14_11_SPEC, T14_11_CONSTRUCTS, index),
    })),
  },
  {
    arm: "l",
    rule: "14.18 — the binding's identifier extended by the longest static chain it roots; a `text` binding alone",
    config: SPEC_AND_CODE_CONFIG,
    files: {
      [T14_11_SPEC]: T14_11_A_MDX,
      [T14_11_CODE]: stagedTs(
        "T14-11 (l) src/app.ts (the node binding's chain SPEC.a.b and a text binding passed on)",
        T14_11_USAGE_TS.text,
      ),
    },
    expected: [0, 1].map((index) => ({
      condition: "14.18",
      locations: located(T14_11_CODE, T14_11_USAGE_TS, index),
    })),
  },
  {
    arm: "m",
    rule: "14.20 — one zero-length range at the failure's offset: a byte-order mark, an encoding failure, an MDX and a TypeScript syntax failure",
    config: SPEC_AND_CODE_CONFIG,
    // S-9: the four sources are 14.20's declared-unparseable forms — the
    // three MDX sources' records and the TypeScript one's declared so.
    files: {
      "specs/bom.mdx": stagedMdx(
        "T14-11 (m) specs/bom.mdx (a byte-order mark)",
        T14_11_BOM_MDX.text,
        "unparseable",
      ),
      "specs/enc.mdx": stagedMdx(
        "T14-11 (m) specs/enc.mdx (an invalid byte after a valid 5-byte prefix)",
        T14_11_ENCODING_MDX,
        "unparseable",
      ),
      "specs/open.mdx": stagedMdx(
        "T14-11 (m) specs/open.mdx (ends inside an unclosed section)",
        T14_11_UNCLOSED_MDX.text,
        "unparseable",
      ),
      "src/bad.ts": stagedTs(
        "T14-11 (m) src/bad.ts (let x = ; — a TypeScript syntax failure)",
        T14_11_SYNTAX_TS.text,
        "unparseable",
      ),
    },
    expected: [
      {
        condition: "14.20",
        locations: located("specs/bom.mdx", T14_11_BOM_MDX, 0),
      },
      {
        condition: "14.20",
        locations: [
          {
            file: "specs/enc.mdx",
            range: {
              start: T14_11_ENCODING_OFFSET,
              end: T14_11_ENCODING_OFFSET,
            },
          },
        ],
      },
      {
        condition: "14.20",
        locations: located("specs/open.mdx", T14_11_UNCLOSED_MDX, 0),
      },
      {
        condition: "14.20",
        locations: located("src/bad.ts", T14_11_SYNTAX_TS, 0),
      },
    ],
  },
  {
    arm: "p",
    rule: "14.8 — `d={(BASE.a)}`: the enclosed expression first token through last, its parentheses included",
    config: SPECS_ONLY_CONFIG,
    files: {
      [T14_11_BASE]: T14_11_A_MDX,
      [T14_11_SPEC]: stagedMdx(
        "T14-11 (p) specs/A.mdx (d={(BASE.a)})",
        T14_11_D_PAREN.text,
      ),
    },
    expected: [
      { condition: "14.8", locations: located(T14_11_SPEC, T14_11_D_PAREN, 0) },
    ],
  },
  {
    arm: "q",
    rule: "14.8 — `d={BASE.a, BASE.b}`: the whole comma sequence, one expression",
    config: SPECS_ONLY_CONFIG,
    files: {
      [T14_11_BASE]: T14_11_A_MDX,
      [T14_11_SPEC]: stagedMdx(
        "T14-11 (q) specs/A.mdx (d={BASE.a, BASE.b})",
        T14_11_D_COMMA.text,
      ),
    },
    expected: [
      { condition: "14.8", locations: located(T14_11_SPEC, T14_11_D_COMMA, 0) },
    ],
  },
  {
    arm: "r",
    rule: "14.5 — `BASE.missing` alone: the braces and the whitespace and comment between them and the expression excluded, U+00A0, U+FEFF, U+1680, and U+3000 spelled there likewise",
    config: SPECS_ONLY_CONFIG,
    files: {
      [T14_11_BASE]: T14_11_A_MDX,
      [T14_11_SPEC]: stagedMdx(
        "T14-11 (r) specs/A.mdx (BASE.missing past a block comment, U+00A0, U+FEFF, U+1680, and U+3000)",
        T14_11_D_TRIVIA.text,
      ),
    },
    expected: [0, 1, 2, 3, 4].map((index) => ({
      condition: "14.5",
      locations: located(T14_11_SPEC, T14_11_D_TRIVIA, index),
    })),
  },
  {
    arm: "s",
    rule: "14.8 — a spread entry `d={[...BASE.a]}`: `...BASE.a`, the `...` included",
    config: SPECS_ONLY_CONFIG,
    files: {
      [T14_11_BASE]: T14_11_A_MDX,
      [T14_11_SPEC]: stagedMdx(
        "T14-11 (s) specs/A.mdx (d={[...BASE.a]})",
        T14_11_D_SPREAD.text,
      ),
    },
    expected: [
      {
        condition: "14.8",
        locations: located(T14_11_SPEC, T14_11_D_SPREAD, 0),
      },
    ],
  },
  {
    arm: "t",
    rule: "14.8 — elisions: one finding per array literal at the whole literal, brackets included, however many holes",
    config: SPECS_ONLY_CONFIG,
    files: {
      [T14_11_BASE]: T14_11_A_MDX,
      [T14_11_SPEC]: stagedMdx(
        "T14-11 (t) specs/A.mdx (two array literals with elisions)",
        T14_11_D_ELISIONS.text,
      ),
    },
    expected: [0, 1].map((index) => ({
      condition: "14.8",
      locations: located(T14_11_SPEC, T14_11_D_ELISIONS, index),
    })),
  },
  {
    arm: "u",
    rule: "14.15 — a colliding non-import declaration by the construct binding the name, per form: `let SPEC;` at `SPEC`, `const { SPEC } = o` at `{ SPEC } = o`, `@dec class SPEC {}` from `@`, `export class SPEC {}` from `class`, each beside its import (14.7 for the chains it roots)",
    config: SPEC_AND_CODE_CONFIG,
    files: {
      [T14_11_SPEC]: T14_11_A_MDX,
      ...Object.fromEntries(
        T14_11_COLLISION_FILES.map((entry) => [entry.file, entry.source]),
      ),
    },
    expected: T14_11_COLLISION_FILES.flatMap((entry) => [
      {
        condition: "14.15",
        locations: located(entry.file, entry.fixture, 0, 1),
      },
      { condition: "14.7", locations: located(entry.file, entry.fixture, 2) },
      { condition: "14.7", locations: located(entry.file, entry.fixture, 3) },
    ]),
  },
  {
    arm: "v",
    rule: "14.20 — an encoding failure's zero-length range at the first byte of the first ill-formed sequence: a valid 5-byte prefix then `FF` → 5, `41 E2 82 41` → 1, `C0 80` → 0, `ED A0 80` → 0, `41 E2 82` at the file's end → 1, a spec and a code source alike",
    config: SPEC_AND_CODE_CONFIG,
    // S-9: every source here is invalid UTF-8, 14.20's declared form — each
    // spec source's and each code source's record declared unparseable
    // (T14_11_ENCODING_FILES).
    files: Object.fromEntries(
      T14_11_ENCODING_FILES.map((entry) => [entry.file, entry.contents]),
    ),
    expected: T14_11_ENCODING_FILES.map((entry) => ({
      condition: "14.20",
      locations: [entry.location],
    })),
  },
  ...T14_11_REASSERTED_CASES,
  {
    arm: "x",
    rule: "14.15 per form — `export import X = require(…)` from `import`, its leading `export` excluded; an import type `import` through the closing parenthesis of its argument list, a `typeof` before it and a qualifier or type arguments after it excluded; a string-named module declaration by its own characters, `declare` included, a leading `export` excluded",
    config: SPEC_AND_CODE_CONFIG,
    files: {
      [T14_11_SPEC]: T14_11_A_MDX,
      ...Object.fromEntries(
        T14_11_LINKING_FILES.map((entry) => [entry.file, entry.source]),
      ),
    },
    expected: T14_11_LINKING_FILES.map((entry) => ({
      condition: "14.15",
      locations: located(entry.file, entry.fixture, 0),
    })),
  },
];

/**
 * The T14-11 contract over one arm's findings: the exact condition multiset
 * (one finding per offending construct — 14.4's and 14.17's per-attribute
 * cardinality, 14.3's one finding); every finding concerning no path (12.7:
 * located conditions carry `path` null); and, per condition, the complete
 * location lists compared as a multiset — each list in 12.7's within-finding
 * order, each range `{"start", "end"}` exactly the pinned bytes (1.7). Order
 * among same-condition findings is 12.7's ordering contract, not this
 * test's, so the lists are sorted before comparison.
 */
function assertExactRanges(
  findings: readonly Finding[],
  expected: readonly ExactFindingExpectation[],
  context: string,
): void {
  const counts: Record<string, number> = {};
  for (const expectation of expected) {
    counts[expectation.condition] = (counts[expectation.condition] ?? 0) + 1;
  }
  assertConditionCounts(
    findings,
    counts,
    `${context} — the staged conditions, one finding per offending ` +
      `construct and none beside (SPEC 14)`,
  );
  for (const finding of findings) {
    if (finding.path !== null) {
      fail(
        `${context}: a finding locating in source concerns no path — \`path\` ` +
          `is null for located conditions (SPEC 12.7, 14); got ` +
          `${JSON.stringify(finding.path)} on the condition-` +
          `${String(finding.condition)} finding (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
  }
  const byJson = (a: unknown, b: unknown): number => {
    const left = JSON.stringify(a);
    const right = JSON.stringify(b);
    return left < right ? -1 : left > right ? 1 : 0;
  };
  for (const condition of new Set(expected.map((e) => e.condition))) {
    const want = expected
      .filter((expectation) => expectation.condition === condition)
      .map((expectation) => expectation.locations)
      .sort(byJson);
    const got = findings
      .filter((finding) => finding.condition === condition)
      .map((finding) =>
        finding.locations.map((location) => ({
          file: location.file,
          range: { start: location.range.start, end: location.range.end },
        })),
      )
      .sort(byJson);
    assertSameJson(
      got,
      want,
      `${context}: the condition-${condition} finding(s) locate exactly the ` +
        `pinned byte ranges — every offending construct, each by the range ` +
        `SPEC 14 fixes for the condition, \`{"start", "end"}\` as zero-based ` +
        `byte offsets, end-exclusive (SPEC 14, 1.7, 12.7)`,
    );
  }
}

/** One range-rule arm: `build --json` over its workspace, findings pinned. */
async function runRangeRuleArm(
  product: ProductBinding,
  kase: RangeRuleCase,
): Promise<void> {
  const context = `T14-11 (${kase.arm}) ${kase.rule}`;
  await withWorkspace(
    { files: { "xspec.config.ts": kase.config, ...kase.files } },
    async (workspace) => {
      const findings = await buildFindings(
        product,
        workspace,
        `${context} — \`build --json\` exits 1 with the findings report ` +
          `(SPEC 12.0, 12.7)`,
      );
      assertExactRanges(findings, kase.expected, context);
    },
  );
}

// (n) Per-spelling resolution inside a repeated `d` (SPEC 11.2): the 14.17
// repetition locates both `d` attributes; the resolving entry records one
// occurrence spanning its own expression; the unresolved entry is one 14.5
// finding at its expression.
const T14_11_REPEATED_D = assemble([
  T14_11_PREAMBLE,
  '<S id="r" ',
  pin('d={"ok"}'),
  " ",
  pin('d={"absent"}'),
  ">\nRepeated d.\n</S>\n",
]);

/**
 * The expression a `d={…}` attribute's braces enclose: after the three ASCII
 * bytes `d={`, before the one-byte closing brace (SPEC 14, 5.7).
 */
function enclosedExpression(attribute: {
  readonly start: number;
  readonly end: number;
}): { start: number; end: number } {
  return { start: attribute.start + 3, end: attribute.end - 1 };
}

// Arm (n)'s source, staged after the table's arms' invocations (a
// staged-source record, S-9).
const T14_11_REPEATED_D_STAGED = stagedMdx(
  "T14-11 (n) specs/A.mdx (a repeated d, one entry resolving)",
  T14_11_REPEATED_D.text,
);

async function runRepeatedDependencyArm(
  product: ProductBinding,
): Promise<void> {
  const context =
    "T14-11 (n) per-spelling resolution inside a repeated `d` (SPEC 11.2)";
  const file = T14_11_SPEC;
  const attributes = located(file, T14_11_REPEATED_D, 0, 1);
  const resolving = enclosedExpression(attributes[0]!.range);
  const unresolved = enclosedExpression(attributes[1]!.range);
  const expected: readonly ExactFindingExpectation[] = [
    { condition: "14.17", locations: attributes },
    { condition: "14.5", locations: [{ file, range: unresolved }] },
  ];
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [file]: T14_11_REPEATED_D_STAGED,
      },
    },
    async (workspace) => {
      const buildContext = `${context} — \`build --json\``;
      assertExactRanges(
        await buildFindings(product, workspace, buildContext),
        expected,
        buildContext,
      );
      const occurrencesContext = `${context} — \`occurrences\``;
      const report = decodeOccurrencesReport(
        await runJsonExpecting(
          product,
          workspace,
          ["occurrences"],
          1,
          `${occurrencesContext} exits 1: the answer carries the domain ` +
            `file's findings (SPEC 11.2, 12.0)`,
        ),
        occurrencesContext,
      );
      assertExactRanges(report.findings, expected, occurrencesContext);
      assertSameJson(
        report.occurrences.map(({ file: recorded, range, kind, target }) => ({
          file: recorded,
          range: { start: range.start, end: range.end },
          kind,
          target,
        })),
        [{ file, range: resolving, kind: "depends", target: `${file}#ok` }],
        `${occurrencesContext}: exactly one occurrence — the resolving ` +
          `entry's, spanning its own expression, kind depends, target ` +
          `${file}#ok — the unresolved entry recording none (SPEC 11.2, 5.7)`,
      );
    },
  );
}

// (o) 14.20 for a refused read (SPEC 14.25): the zero-length range at offset
// 0. A permission-based staging (E-1): Linux leg only, run last (the
// NU3_STAGED pattern of section-11.5.ts; the runner must be unprivileged).
const T14_11_REFUSAL_STAGED = process.platform === "linux";

// Arm (o)'s refused file (a staged-source record, S-9: the arm follows the
// body's earlier invocations).
const T14_11_REFUSED_SOURCE = stagedMdx(
  "T14-11 (o) specs/R.mdx (the source staged unreadable)",
  '<S id="r">\nRefused content.\n</S>\n',
);

async function runRefusedReadArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-11 (o) 14.20 for a refused read: the zero-length range at offset 0 " +
    "(SPEC 14.25; Linux leg, E-1)";
  const file = "specs/R.mdx";
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [T14_11_SPEC]: T14_11_A_MDX,
        [file]: T14_11_REFUSED_SOURCE,
      },
    },
    async (workspace) => {
      const staging = await stageReadRefusalOfFile(workspace.path(file));
      try {
        const findings = await buildFindings(
          product,
          workspace,
          `${context} — \`build --json\``,
        );
        assertExactRanges(
          findings,
          [
            {
              condition: "14.20",
              locations: [{ file, range: { start: 0, end: 0 } }],
            },
          ],
          context,
        );
      } finally {
        await staging.restore();
      }
    },
  );
}

const T14_11 = defineProductTest({
  id: "T14-11",
  title:
    "per-condition ranges: byte-precise fixtures against precomputed offsets, one arm per range rule of SPEC 14 beyond T14-8's — `d` value expressions (an array entry alone, `d={foo}`'s enclosed expression, `(BASE.a)` with its parentheses, a comma sequence whole, `BASE.missing` alone past a block comment and past U+00A0/U+FEFF/U+1680/U+3000, a spread entry with its `...`, the elisions of one array literal as one finding at the whole literal — two literals, two findings), `d={}` and `d={ /* c */ }` as 14.20 at the closing brace (never 14.8), a non-static bare reference exclusive of its `;`, the attribute conditions 14.2/14.3/14.4/14.17 at the attribute's own characters (one finding per violating attribute; a repeated prop locating every spelling), 14.1's opening tag, 14.15's declaration forms (`export import X = require(…)` from `import`, its `export` excluded), import types (`import` through the closing parenthesis of the argument list — `typeof import(…).default` and `import(…).T<number>`, the `typeof`, qualifier, and type arguments excluded), string-named module declarations (`declare module` whole, `export declare module` from `declare`), and colliding declarations (the declarator `SPEC = 1`, `let SPEC;` at `SPEC`, `const { SPEC } = o` at `{ SPEC } = o`, `@dec class SPEC {}` from `@`, `export class SPEC {}` from `class`), 14.16's construct forms (a fragment `<>` through `</>` included), 14.18's chain-extended binding, 14.20's zero-length offsets (a byte-order mark; an encoding failure at the first byte of the first ill-formed sequence — a valid 5-byte prefix then `FF` → 5, `41 E2 82 41` and `41 E2 82` at the file's end → 1, `C0 80` and `ED A0 80` → 0 — in a spec and a code source alike; syntax — its own two forms and, re-asserted the same way, the offsets T2.3-3, T2.4-2, T2.7-3, T2.7-4, and T14-12 pin; and — Linux leg — a refused read), and a repeated `d`'s per-spelling resolution — every range exact, never a line/column pair (SPEC 14, 1.4, 1.6, 1.7, 2.4, 4, 5.7, 11.2, 11.4, 12.7)",
  run: async (product) => {
    for (const kase of T14_11_CASES) {
      await runRangeRuleArm(product, kase);
    }
    await runRepeatedDependencyArm(product);
    if (T14_11_REFUSAL_STAGED) {
      await runRefusedReadArm(product);
    }
  },
});

/** TEST-SPEC §14 T14-1…T14-8 and T14-11, in canonical ID order (SUITE-49). */
export const section14ValidationTests: readonly ProductTestEntry[] = [
  T14_1,
  T14_2,
  T14_3,
  T14_4,
  T14_5,
  T14_6,
  T14_7,
  T14_8,
  T14_11,
];
