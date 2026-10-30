// The H-7 traceability map (TEST-SPEC 0 H-7; checked by S-1,
// test/self/s1-traceability.test.ts): the harness's machine-readable record
// mapping every implemented product-facing test (the registry, ./index.ts)
// to the SPEC.md passage(s) it covers.
//
// Passage-key vocabulary (H-7 fixes it):
//
//   "preamble"          SPEC.md's unnumbered document preamble (the content
//                       between the title and `## 1.`).
//   "<major>.<minor>"   a numbered subsection heading (`### 4.5 …`).
//   "<major>"           a numbered section's own body text outside its
//                       subsections. Per H-7 exactly sections 3, 4, 5, 7, 8,
//                       9, 10, 11, 14, and 15 carry requirements there (for
//                       3, 14, and 15 — which have no subsections — the key
//                       spans the whole section body); sections 1, 2, 6, 12,
//                       and 13 carry no requirements outside their
//                       subsections and are covered through them.
//
// Construction (what to maintain when tests change):
//
// - Home passage: a test's TEST-SPEC section mirrors SPEC.md's numbering, so
//   `T<sec>-<n>` maps to passage `<sec>` (`T7-1` → "7", `T4.5-3` → "4.5").
//   TEST-SPEC's combined heading §5.1–5.2 spans two SPEC.md passages: its one
//   test T5.2-1 exercises node kinds, edge kinds, and the project-wide graph
//   over spec and code groups, so it maps to "5", "5.1", and "5.2".
//   TEST-SPEC 11.1 (`xspec query`) keeps the legacy `T11-<n>` IDs, so
//   T11-1..T11-7's home passage is "11.1", not the section-11 body.
// - "11": SPEC.md 11's own body text — the five query surfaces and their
//   JSON-only contract (a single JSON document as the only output form, with
//   or without `--json`) — is asserted for `query` by the per-subcommand
//   both-forms arms of T11-1..T11-5 (section-11.ts's §11-preamble helper),
//   so those five carry "11" beside their home "11.1". Its remaining clauses
//   are cross-references asserted at their home passages (11.2's
//   availability contract; 13.3's gated reads, whose sweeps include
//   `query`).
// - Section 16's property tests (P-*) have no SPEC.md section 16; each maps
//   to the passages whose invariants it asserts per its TEST-SPEC entry.
// - "14": SPEC.md 14 defines the validation conditions and the refusal
//   reasons, so a test asserting a numbered condition (14.x) or a stable
//   refusal code covers passage "14" wherever it lives. TEST-SPEC 14 names
//   primary tests per condition, "not exhaustive; the H-7 map is the
//   complete record", so the rule reaches every registered test, not only
//   those 14's index names. As applied, "14" is on each test whose body
//   asserts:
//   (a) a numbered condition's finding — in a report, an answer, or an
//       error document, by count, location, identities, or stable code, or
//       by the exit and the explicitly unavailable datum it brings —
//       staging premises and gates included (T12.0-13's premise 14.19,
//       T11.4-2's and T11.5-2's gates, T12.0-14's premise configuration
//       error, T13.4-3's premise `inventory`);
//   (b) a stable refusal code;
//   (c) a numbered condition's absence, where the test stages the
//       condition and asserts that a surface does not report it (the
//       inventory beside a staged 14.19, T11.6-2, and beside a garbage
//       journal and garbage session files, no 14.13 or 14.21, T11.6-3;
//       every syntax-class twin's invalid configuration answered with the
//       plain usage error, never 14.14, T11-2 and T11-4 among them), or
//       where its title names the absence as an asserted outcome: at the
//       condition's boundary (T3-1's fenced bytes, 14.16 and 14.20; T4-4's
//       type-only imports, 14.8 and 14.18; T10.1-3's non-session files,
//       T10.7-3's unresolvable baseline, and P-9's sessions, 14.21;
//       T13.4-4's directories at derived paths, 14.22), or in a clean
//       state the condition would contradict (T6.4-7's and T6.5-3's
//       `check` with no staleness, 14.10; T6.5-9's fresh identifiers, no
//       14.15; T6.5-11's rewritten call, no 14.11);
//   (d) the code-less form 14 gives a review-operation refusal — no
//       stable code, `locations` empty, `path` `null` — where that form is
//       the test's subject: T10.7-14. The other refusal sites running the
//       same shared check (support.ts `expectReviewRefusal`: T10.1-2,
//       T10.1-6, T10.3-2, T10.7-1, T10.7-9, T10.7-10, T10.7-15, T12.7-1,
//       T14-6) assert it as a cross-reference to T10.7-14's assertion,
//       which puts no "14" on them (T10.1-6's, T10.7-1's, T10.7-15's, and
//       T12.7-1's "14" stand for their numbered conditions, T14-6's for its
//       stable codes).
//   A condition named only as staging context, as a cross-reference to
//   another test's assertion, or in the diagnostic of a generic clean
//   outcome (`build` or `check` exit 0, findings []) puts no "14" on a
//   test: a move's clean `check` naming 14.10 in its diagnostic is the
//   operation's postcondition, covered by its home passage. Tests whose
//   titles cite no condition but whose bodies assert one carry "14" too:
//   T2.6-3 and T8-5 (14.12 policy findings), T6.3-4 (its premise's
//   validation findings, unreported behind the baseline error), T11-4 (the
//   syntax-class twins, never 14.14), T11.3-1 (14.19 with its stable code,
//   T5.7-4's findings), T12.0-9 and T12.0-14 (the 14.14 configuration
//   error with its stable code), P-1 (14.2/14.4 rejections), and P-7
//   (14.12 findings). TEST-SPEC 14's per-condition record is carried here
//   at H-7's passage granularity, the T7-1..T7.5-1 range resolved to the
//   entries that assert a condition (T7-5 and T7.4-2 assert none) and the
//   refusal reasons' staging record (T14-7's) to its eight tests: T6.4-3,
//   T6.5-4, T6.5-6, T6.5-16, T6.5-17, T6.5-20, T6.5-21, and T6.6-3. The
//   tests whose titles cite a condition and that carry no "14", each for
//   its reason:
//   - T4.5-7: its 14.15 cross-references T4-2's import-type arms; its body
//     asserts a clean `build` and `check`, no edges, and untouched bytes,
//     naming no condition.
//   - T6.5-2: its 14.20 is the staging's well-formedness (every composed
//     form derives, judged by S-9) and the premise of its compiled-Markdown
//     compare; the move's outcome is asserted byte-exactly.
//   - T6.5-15: its 14.20 cites the grammar 6.5's joint-removal rule follows
//     (where an ESM block begins); its body asserts bytes, preview edits,
//     and clean outcomes.
//   - T6.5-19: its 14.20 says why derivability does not decide 6.5's
//     in-section exclusion; its body asserts bytes, offsets, and clean
//     outcomes.
//   - P-8: its 2.7/14.20 boundaries name where its mutations land; it
//     asserts termination, exit classes, whole JSON documents, and that a
//     failing `build` modifies nothing, never a condition's finding.
// - Alias entries: TEST-SPEC's pointer-only tests are not separately
//   implemented, so their coverage rides on the implementing tests —
//   T12.0-10's rename/move and baseline arms ride on T6.4-4/T6.5-5 and
//   T6.3-4, putting "12.0" on those three (no longer alias-only: its
//   gated-read, masking (a spec source's id and a code source's unit),
//   spelled-not-defined, kind-check, past-the-gate, and within-class-2
//   precedence arms are implemented as the registered T12.0-10, which
//   carries its own entry below); T12.1-2 ("T7.5-6") puts "12.1" on T7.5-6; T13.4-7 ("T7-6")
//   puts "13.4" on T7-6.
// - "preamble": per H-7's own citation, T12.0-11 (git is read-only) and
//   T12.0-12 (git-less operation) cover the preamble's git contract; its
//   no-network clause is enforced at CI level (E-1), which needs no map
//   entry.
// - Other cross-section keys mirror TEST-SPEC's stated coverage: T1.2-3
//   asserts the root exclusions of 8.1/8.2; T7.4-2 asserts the required-set
//   restrictions of 8.1 via coverage runs; T10.2-1 asserts 12.0's
//   argument-value rule on the item IDs it observes — each a well-formed
//   argument value naming its item as `review show`'s operand; T10.7-12
//   asserts 1.7's review-payload half of the two-range-presenting-outputs
//   rule (the code-impact scope's named-unit construct range; TEST-SPEC 1.7
//   delegates it there from T1.7-1/T1.7-2); T10.7-13 asserts 10.4's
//   current-identity presentation of a recorded node — its (c) arm's `d`
//   targets and context presented under a journaled rename's new identity —
//   and 12.7's coverage-attribute and tag-set value forms on the metadata
//   pair; T10.7-14 asserts 12.7's findings-only form of a refused operation
//   and the finding form it holds; T10.7-15 asserts 13.3's refresh, placed
//   past every outcome a `review` subcommand meets — stale graph data left
//   stale by each outcome, `check`'s unit form after it, and refreshed
//   before a performed `split`'s session write and past `list`'s
//   corruptions, the unit form gone — and 13.3's gate ahead of the recorded
//   baseline, the session directory's examination and listing, and an item
//   ID, the given baseline's resolution ahead of the gate; and section 10's
//   body (the review mechanism/strategy split and the three built-in
//   strategies) is exercised by T10.5-1, T10.6-1 (generation per strategy),
//   T10.7-1 (strategy selection at `create`), and T10.7-4 (coverage
//   sessions).
//
// A passage listed for a test is asserted by that test; the map lists each
// test's primary passage(s), not every rule it touches in passing. S-1 fails
// on: an H-7 key no test maps to; a mapped key that is no H-7 key of the
// current SPEC.md; a map entry whose test is not implemented; an implemented
// product-facing test missing here (domain = registry, both directions).

/**
 * SPEC.md sections whose own body text outside their subsections carries
 * requirements — the body-text passage keys of the H-7 universe (H-7 fixes
 * the list; S-1 derives the rest of the universe from SPEC.md's headings).
 */
export const SPEC_BODY_TEXT_KEY_SECTIONS: readonly number[] = [
  3, 4, 5, 7, 8, 9, 10, 11, 14, 15,
];

/**
 * The H-7 map: implemented product-facing test ID → SPEC.md passage keys in
 * document order. Domain: exactly the registry (S-1-checked).
 */
export const H7_TRACEABILITY: Readonly<Record<string, readonly string[]>> = {
  "T1.1-1": ["1.1"],
  "T1.1-2": ["1.1"],
  "T1.1-3": ["1.1"],
  "T1.2-1": ["1.2"],
  "T1.2-2": ["1.2"],
  "T1.2-3": ["1.2", "8.1", "8.2"],
  "T1.3-1": ["1.3", "14"],
  "T1.3-2": ["1.3", "14"],
  "T1.3-3": ["1.3", "14"],
  "T1.3-4": ["1.3", "14"],
  "T1.3-5": ["1.3", "14"],
  "T1.3-6": ["1.3", "14"],
  "T1.3-7": ["1.3", "11.1", "11.4"],
  "T1.4-1": ["1.4", "14"],
  "T1.4-2": ["1.4"],
  "T1.4-3": ["1.4"],
  "T1.4-4": ["1.4", "14"],
  // T1.4-5: 1.4's identifier test by characters at the release and language
  // level 14.20 fixes (the "14" key), through dot access in both kinds of
  // source (2.4), the generated module's dot-accessible and quoted
  // properties (4.1), and a section move's conversion to imported form in
  // 6.4's fallback spellings (6.4, 6.5).
  "T1.4-5": ["1.4", "2.4", "4.1", "6.4", "6.5", "14"],
  "T1.5-1": ["1.5"],
  // T1.5-2: 14.19 over spec and code paths and their 12.0/12.7
  // presentations; its code-group arms' occurrence records (5.7, 11.3),
  // `source` explicitly unavailable over an invalid path (11.2), and the
  // findings at `check` as at `build` (12.2); its located arm's 14.1 at the
  // opening-tag range of 11.4.
  "T1.5-2": [
    "1.5",
    "5.7",
    "11.2",
    "11.3",
    "11.4",
    "12.0",
    "12.2",
    "12.7",
    "14",
  ],
  "T1.5-3": ["1.5"],
  "T1.6-1": ["1.6"],
  "T1.6-2": ["1.6"],
  "T1.6-3": ["1.6"],
  "T1.6-4": ["1.6"],
  "T1.6-5": ["1.6", "14"],
  "T1.7-1": ["1.7"],
  "T1.7-2": ["1.7", "4.6"],
  "T2.1-1": ["2.1"],
  // T2.1-2: its case-only arm's byte-wise, case-sensitive suffix test
  // (12.0); its root-re-entering arm's `d` entry recording no occurrence
  // (5.7, 11.3's `occurrences --file`), its own 14.5 beside the import's
  // 14.15 (11.2's per-spelling resolution), and the import's target
  // explicitly unavailable in `view` (11.2, 11.4).
  "T2.1-2": ["2.1", "2.4", "5.7", "11.2", "11.3", "11.4", "12.0", "14"],
  // T2.1-3: its chain rooted at a colliding identifier, resolving nowhere
  // (2.4, 11.2), recording no occurrence (5.7, 11.3's `occurrences
  // --file`).
  "T2.1-3": ["2.1", "2.4", "5.7", "11.2", "11.3", "14"],
  "T2.1-4": ["2.1"],
  "T2.1-5": ["2.1", "14"],
  "T2.1-6": ["2.1", "1.6", "3", "11.4", "14"],
  "T2.2-1": ["2.2"],
  "T2.2-2": ["2.2"],
  "T2.2-3": ["2.2"],
  "T2.2-4": ["2.2"],
  "T2.2-5": ["2.2"],
  "T2.3-1": ["2.3"],
  "T2.3-2": ["2.3"],
  "T2.3-3": ["2.3", "2.4", "2.7", "3", "5.7", "11.2", "11.4", "14"],
  "T2.4-1": ["2.4"],
  // T2.4-2: its numeric-literal and parenthesized index arms recording no
  // occurrence (5.7, 11.3's `occurrences --file`), the answer on the
  // failing workspace carrying the file's 14.8 (11.2).
  "T2.4-2": ["2.4", "5.7", "11.2", "11.3", "14"],
  "T2.4-3": ["2.4", "14"],
  "T2.4-4": ["2.4", "14"],
  "T2.4-5": ["2.4", "1.4", "2.1", "4.5", "5.7", "11.3", "14"],
  "T2.5-1": ["2.5"],
  // T2.5-2: its excluded-as-a-target-only arm's covering paths through a
  // `coverage="none"` boundary node and an ignored intermediate, per mode
  // (8: roots alone barred from coverage paths).
  "T2.5-2": ["2.5", "8"],
  "T2.5-3": ["2.5", "2.4", "2.7", "14"],
  "T2.6-1": ["2.6"],
  "T2.6-2": ["2.6"],
  "T2.6-3": ["2.6", "14"],
  "T2.7-1": ["2.7", "14", "11.2", "11.4"],
  "T2.7-2": ["2.7"],
  "T2.7-3": ["2.7", "14"],
  "T2.7-4": ["2.7", "14", "3", "1.4", "11.2", "11.4"],
  "T3-1": ["3", "14"],
  "T3-2": ["3"],
  "T3-3": ["3"],
  "T3-4": ["3"],
  "T3-5": ["3"],
  "T3-6": ["3"],
  "T3-7": ["3", "2.1", "2.7", "1.6", "11.4"],
  "T4-1": ["4"],
  // T4-2: 4's import rules and module-linking forms, its import-type arms
  // carrying 4.5's "an import type is no type-level reference" (T4.5-7
  // defers here), its no-other-construct arm a file move's rewrite (6.5)
  // and preview edits (6.6) over the constructs naming no module, and its
  // case arms the byte-wise, case-sensitive suffix and derived-name tests
  // (12.0, 13.4).
  "T4-2": ["4", "2.1", "2.4", "4.5", "5.7", "6.5", "6.6", "12.0", "13.4", "14"],
  "T4-3": ["4"],
  // T4-4: 4's type-only imports, their bindings type-level names; its mixed
  // arms a call through a type-only `text` binding — no spec module's
  // `text` call, its ordinary argument outside 4.5's sanctioned uses
  // (14.18) — recording no occurrence (5.7) in the answer `occurrences
  // --file` gives on the failing workspace (11.2).
  "T4-4": ["4", "4.5", "5.7", "11.2", "14"],
  "T4-5": ["4", "2.1", "2.4", "4.5", "5.7", "11.2", "14"],
  // T4-6: 4's module-linking forms and spec module imports wherever each
  // stands, each failing file's 14.15 at the declaration's own characters
  // (1.7); its nested `text` binding the module's `text` export (4.3),
  // declared in the scope of the function enclosing it (4.5), the call's
  // `embeds` edge attributed to that unit (4.6) and its occurrence record
  // (5.7) read through `occurrences` (11.3).
  "T4-6": ["4", "1.7", "4.3", "4.5", "4.6", "5.7", "11.3", "14"],
  "T4.1-1": ["4.1"],
  "T4.1-2": ["4.1"],
  "T4.1-3": ["4.1"],
  "T4.2-1": ["4.2"],
  "T4.2-2": ["4.2"],
  "T4.2-3": ["4.2"],
  "T4.2-4": ["4.2"],
  "T4.3-1": ["4.3"],
  "T4.3-2": ["4.3", "2.4", "4.5", "5.7", "11.2", "11.3", "14"],
  "T4.4-1": ["4.4", "14", "1.5", "5.7", "11.2", "11.3", "12.7"],
  "T4.4-2": ["4.4"],
  "T4.5-1": ["4.5"],
  "T4.5-2": ["4.5"],
  "T4.5-3": ["4.5", "2.4", "5.7", "11.2", "11.3", "14"],
  "T4.5-4": ["4.5", "2.4", "5.7", "14"],
  "T4.5-5": ["4.5", "14"],
  "T4.5-6": ["4.5"],
  "T4.5-7": ["4.5"],
  // T4.5-8: its type-only side carries 4's type-only imports, a binding
  // introduced type-only a type-level name that no value-level declaration
  // collides with (2.4's "the import's binding being value-level (4)").
  "T4.5-8": ["4.5", "1.7", "2.1", "2.4", "4", "5.7", "14"],
  "T4.5-9": ["4.5", "2.4", "5.7", "11.2", "14"],
  // T4.5-10: 4.5's scope of an import declaration — the file's at top
  // level, a nested one's the innermost function, class static block, or
  // namespace or module declaration enclosing it, never a block's —
  // resolved as the language's scoping question (2.4), the scopes nested
  // in it included; each rooted marker's `references` edge, and the
  // `embeds` edge of a call through a nested `text` binding (4.3),
  // attributed to its enclosing unit or file (4.6), and its occurrence
  // record (5.7), the source's range pinned (1.7), read through
  // `occurrences` (11.3), which answers on the failing workspaces too
  // (11.2); the cross-scope collisions (condition 15) and the invisible
  // `text` binding's unsanctioned use (condition 18) are 14's findings.
  "T4.5-10": ["4.5", "1.7", "2.4", "4.3", "4.6", "5.7", "11.2", "11.3", "14"],
  // T4.5-11: 4.5's and 2.4's collisions in an import's own scope — a
  // function's scope holding its parameters, an inner scope's declaration
  // shadowing instead, an enclosing scope's colliding with nothing, two
  // imports colliding whatever scope each declares the identifier in, each
  // binding its own scope's chains and callees — read as the language's
  // scoping question (2.4), a type-only import's binding colliding with no
  // non-import declaration (4); the collision (condition 15, every
  // colliding declaration located by its own characters as 1.7 reads one),
  // the unresolved chains beside it (condition 7, at the span each
  // occurrence would occupy, 5.7), and a node argument of a call no spec
  // module's `text` binds (condition 18) are 14's findings, read through
  // `occurrences` (11.3) on the failing workspace (11.2) beside the records
  // of chains and calls its own scope's import binds (5.7); a valid
  // staging's `references` edge, or a spec module `text` call's `embeds`
  // edge (4.3), attributed to its enclosing unit or file (4.6).
  "T4.5-11": [
    "4.5",
    "1.7",
    "2.4",
    "4",
    "4.3",
    "4.6",
    "5.7",
    "11.2",
    "11.3",
    "14",
  ],
  "T4.6-1": ["4.6"],
  "T4.6-2": ["4.6"],
  // T4.6-3: its one-file and declaration-file arms' occurrence records
  // (5.7, `occurrences`, 11.3) pin each attributed unit's own range (1.7);
  // its single-casing controls the byte-wise, case-sensitive file-name test
  // of 4.6's declaration-file rule (12.0).
  "T4.6-3": ["4.5", "4.6", "1.7", "2.4", "5.7", "11.3", "12.0", "12.2", "14"],
  "T4.6-4": ["4.6"],
  "T5.2-1": ["5", "5.1", "5.2"],
  "T5.3-1": ["5.3", "14"],
  "T5.3-2": ["5.3", "14"],
  "T5.4-1": ["5.4"],
  "T5.4-2": ["5.4"],
  "T5.5-1": ["5.5"],
  "T5.5-2": ["5.5"],
  "T5.5-3": ["5.5"],
  "T5.5-4": ["5.5"],
  "T5.5-5": ["5.5"],
  "T5.5-6": ["5.5"],
  // T5.5-7: 5.5's framing, each lure's edit categorized by `impact --base`
  // (5.6: `changed`, `metadata-changed`).
  "T5.5-7": ["5.5", "5.6"],
  "T5.6-1": ["5.6"],
  "T5.6-2": ["5.6"],
  "T5.6-3": ["5.6"],
  "T5.6-4": ["5.6"],
  "T5.6-5": ["5.6"],
  "T5.6-6": ["5.6"],
  "T5.7-1": ["5.7"],
  "T5.7-2": ["5.7", "1.4", "2.7", "14"],
  "T5.7-3": ["5.7"],
  "T5.7-4": ["5.7", "2.1", "2.4", "4", "4.4", "4.5", "11.2", "14"],
  "T6.1-1": ["6.1"],
  "T6.1-2": ["6.1"],
  "T6.1-3": ["6.1", "12.7", "13.3", "14"],
  "T6.2-1": ["6.2"],
  "T6.2-2": ["6.2"],
  "T6.2-3": ["6.2"],
  "T6.2-4": ["6.2"],
  "T6.3-1": ["6.3"],
  "T6.3-2": ["6.3"],
  "T6.3-3": ["6.3"],
  "T6.3-4": ["6.3", "10.7", "12.0", "12.7", "14"],
  "T6.3-5": ["6.3", "10.7", "12.0"],
  "T6.3-6": ["6.3", "10.7", "12.0", "12.7", "13.4", "14"],
  "T6.4-1": ["6.4"],
  "T6.4-2": ["6.4", "1.4", "2.4", "2.7"],
  "T6.4-3": ["6.4", "1.4", "14", "12.0", "12.7"],
  "T6.4-4": ["6.4", "12.0", "14"],
  "T6.4-5": ["6.4"],
  // T6.4-6: its refused-writes arm — refused writes among `build`'s
  // validations (13.3), the file-form move's mirrored precondition (6.5),
  // and the condition-22 finding form-exact (12.7).
  "T6.4-6": ["6.4", "6.5", "12.7", "13.3", "14"],
  "T6.4-7": ["6.4", "14"],
  "T6.5-1": ["6.5", "6.6", "6.4", "2.1", "12.7", "4", "4.5"],
  "T6.5-2": ["6.5", "3"],
  "T6.5-3": ["6.5", "14"],
  // T6.5-4: its single-casing arm's byte-wise, case-sensitive extension
  // test, `specs/B.MDX` lacking `.mdx` (12.0).
  "T6.5-4": ["6.5", "1.4", "7.1", "12.0", "14"],
  "T6.5-5": ["6.5", "12.0", "12.7", "14"],
  "T6.5-6": ["6.5", "6.6", "12.7", "14"],
  "T6.5-7": ["6.5", "6.4", "3", "2.7", "4.5"],
  "T6.5-8": ["6.5", "6.4", "2.1", "3"],
  "T6.5-9": ["6.5", "2.1", "2.4", "4", "4.5", "6.4", "3", "11.4", "14"],
  "T6.5-10": ["6.5", "6.4", "6.6", "2.1", "3", "5.7"],
  "T6.5-11": ["6.5", "4.3", "4.5", "4.6", "5.7", "6.6", "12.7", "14"],
  "T6.5-12": ["6.5", "6.4", "3"],
  "T6.5-13": [
    "6.5",
    "6.4",
    "6.6",
    "6.2",
    "3",
    "5.5",
    "5.6",
    "1.6",
    "11.4",
    "12.7",
  ],
  "T6.5-14": ["6.5", "6.4", "2.1", "3", "5.5", "5.6"],
  "T6.5-15": ["6.5", "3", "2.1", "6.6", "12.7"],
  "T6.5-16": ["6.5", "6.2", "3", "2.1", "1.7", "5.7", "14", "12.7"],
  "T6.5-17": ["6.5", "14", "11.4", "12.7", "2.1", "3"],
  "T6.5-18": [
    "6.5",
    "4",
    "4.3",
    "4.5",
    "4.6",
    "2.1",
    "3",
    "5.7",
    "6.6",
    "12.7",
  ],
  "T6.5-19": ["6.5", "6.4", "6.6", "6.2", "3", "5.5", "1.6", "12.7"],
  "T6.5-20": ["6.5", "4", "13.4", "13.1", "13.2", "7.3", "14", "12.7"],
  "T6.5-21": ["6.5", "13.4", "7", "7.2", "7.3", "13.2", "6.6", "14", "12.7"],
  "T6.5-22": ["6.5", "2.1", "4", "4.5", "14", "12.7"],
  "T6.5-23": [
    "6.5",
    "1.4",
    "3",
    "4",
    "4.6",
    "5.2",
    "6.4",
    "6.6",
    "11.1",
    "12.7",
    "14",
  ],
  // T6.5-24: 6.5's eligibility of a held binding for a moved spelling —
  // visible at the occurrence, a nested import's binding within its own
  // scope alone (4.5), resolved as the language's scoping question (2.4),
  // and timely, a statement enclosing a nested declaration never standing
  // between — and, where none is eligible, the declaration added at an
  // admissible offset under 6.5's line discipline and (c)'s nested
  // declaration removed with the whitespace-only line it leaves, both by
  // 3's terminators — asserted over the rewritten file's bytes, the
  // preview's edits and the performed-operation document (6.6, 12.7), and
  // each spelling's `references` or `embeds` edge (5.2) from its enclosing
  // unit or file (4.6) through `query edges` (11.1); its "14" the nested
  // import declarations' well-formedness, never 14.20, asserted by the
  // clean premise `build` and the judged post-move bytes (T14-12 places it
  // here).
  "T6.5-24": [
    "6.5",
    "2.4",
    "3",
    "4.5",
    "4.6",
    "5.2",
    "6.6",
    "11.1",
    "12.7",
    "14",
  ],
  // T6.5-25: 6.5's kept statement-body declaration — its bindings unused,
  // no removal reported for it (6.6) — and the declaration added at the one
  // line-start admissible offset under 6.5's line discipline (3's
  // terminators), asserted over the rewritten file's bytes, the preview's
  // edits, and the performed-operation document (12.7); the marker rooted at
  // the declaration, which binds in the scope holding its statement (4.5),
  // its `references` edge (5.2) from the file or `f` (4.6) through `query
  // edges` (11.1) before the move and after it; its "14" the statement-body
  // declarations' well-formedness, never 14.20, asserted by the clean
  // premise `build` and `check` and the judged post-move bytes (T14-12
  // places it here).
  "T6.5-25": ["6.5", "3", "4.5", "4.6", "5.2", "6.6", "11.1", "12.7", "14"],
  // T6.5-26: 6.5's TypeScript removal extents — the declaration deleted
  // from its first decorator or modifier where it carries any, the line it
  // empties dropped with its terminator (3), nothing beyond that extent
  // changed — asserted over the rewritten file's bytes, composed with the
  // marker's prefix rewrite (6.4), the preview's `import-removal` and
  // `reference-rewrite` edits (6.6), and the performed-operation document
  // (12.7); (f)'s and (h)'s nested declarations binding in `f`'s scope
  // (4.5), the marker's `references` edge (5.2) from `src/c.ts#f` (4.6)
  // through `query edges` (11.1); its "14" the decorated, modified, and
  // nested declarations' well-formedness, never 14.20, asserted by the
  // clean premise `build` and `check` and the judged post-move bytes
  // (T14-12 places it here).
  "T6.5-26": [
    "6.5",
    "3",
    "4.5",
    "4.6",
    "5.2",
    "6.4",
    "6.6",
    "11.1",
    "12.7",
    "14",
  ],
  "T6.6-2": ["6.6"],
  "T6.6-3": ["6.6", "6.5", "12.7", "14"],
  "T6.6-4": ["6.6", "6.5", "12.7"],
  "T6.6-5": ["6.6", "13.2", "13.3"],
  "T6.6-6": ["6.6", "14"],
  "T6.6-7": ["6.6", "12.0", "14"],
  "T6.7-1": ["6.7", "14"],
  // T7-1: its name-casing probe the byte-wise, case-sensitive comparison of
  // the configuration entry's name (12.0: paths compare byte-wise and
  // case-sensitively, no case folding).
  "T7-1": ["7", "14", "12.6", "12.0"],
  "T7-2": ["7", "2.4", "7.4", "11.6", "14"],
  "T7-3": ["7", "7.1", "7.2", "14"],
  "T7-4": ["7", "2.4", "11.6", "14"],
  "T7-5": ["7"],
  // T7-6: its single-casing arms the byte-wise, case-sensitive name tests
  // of 13.4's source exclusion (12.0: no case folding), each discovered
  // code source listed in `inventory`'s `sources` with its group
  // membership (11.6).
  "T7-6": ["7", "11.6", "12.0", "13.4", "14"],
  // T7-7: its arm (b) the both-groups rule of 7.2 met on a built workspace,
  // and `version` answering beside the staged configuration error (12.6),
  // as T7-1's occupancy arms do.
  "T7-7": ["7", "7.2", "12.6", "14"],
  // T7-8: every staged run asserted never `read-failure` beside a staged
  // refusal its discovery must not meet — 14.25's absence at the read
  // scope's boundary, rule (c); its twin compares and outcomes are 7's.
  "T7-8": ["7", "14"],
  // T7-9: (a)'s twin compares are 7's reading of the specifier as a static
  // string literal spelled as written (2.4), its single-casing arm read
  // byte-wise with no case folding (12.0); (b)'s scanner-rejected escapes,
  // the file not well-formed (14.20), each answered with the 12.7 error
  // document carrying 14.14's stable code; (c)'s twin compares are 7's —
  // the specifier never resolved, read, or loaded, whatever it designates
  // — its sealed directory staging a refused read (14.25) the product must
  // not meet, that condition's absence, rule (c); (d)'s installs are 7's
  // (no command's outcome depends, through the import, on the module or on
  // whether a project installed it) and 7.6's (no name is privileged: the
  // trap and the FIFO manifest staged under `trap`, `xspec`, and the name
  // the package's manifest gives, read as T7.6-4(a) reads it), its
  // representative commands' outcomes T7-8's.
  "T7-9": ["7", "2.4", "7.6", "12.0", "12.7", "14"],
  // T7-10: (a)'s clean outcomes and (b)'s findings are 7's (the rules of 4
  // and 14.15 reach the configuration only where a configured group — here
  // a code group, 7.2 — discovers it, the configuration staying valid),
  // 4's (a spec module import's binding and target, and a relative
  // specifier designating a derived-file path: a `.xspec.` name or a path
  // under `.xspec/`, 13.4, or the Markdown emit destination emission
  // enables, 7.3), and 4.5's (the call, a value-level use it does not
  // sanction, 14.18); each finding located byte-exactly (1.7) — by the
  // import range of 11.4, or at the call — `path` null (12.7); `inventory`
  // listing the configuration among its sources in that code group
  // (11.6); the control's whole-file location answering `query edges
  // --from` (11.1). (c)'s consequences of a discovered configuration's
  // findings: the failing `build` modifying nothing (12.1); the gated reads
  // reporting exactly its findings, exit 1, modifying nothing (13.3); the
  // file move refused over the configuration's designation of the
  // destination's would-be emit path (6.5's `refused-invalid-destination`)
  // and, in the converse, refused as an invalid workspace (6.4's
  // precondition, which 6.5 shares) while undiscovered its preview lists
  // no edit in the configuration (6.6) and the move leaves it unrewritten
  // (6.5); and a baseline whose discovered configuration fails validation
  // failing `impact --base` and `review create --base` as the code-less
  // usage error (6.3, 12.0), `review create` writing no session (10.7).
  "T7-10": [
    "7",
    "1.7",
    "4",
    "4.5",
    "6.3",
    "6.4",
    "6.5",
    "6.6",
    "7.2",
    "7.3",
    "10.7",
    "11.1",
    "11.4",
    "11.6",
    "12.0",
    "12.1",
    "12.7",
    "13.3",
    "13.4",
    "14",
  ],
  // T7.1-1: its wrong-case extension arm the byte-wise, case-sensitive
  // extension test (12.0: no case folding), and `inventory`'s `derived`
  // entry for the file without `.mdx` (11.6), `module` and `markdown` null
  // since such a file generates and emits nothing (13.1).
  "T7.1-1": ["7.1", "11.6", "12.0", "13.1", "14"],
  "T7.2-1": ["7.2", "14"],
  // T7.3-1: its single-casing `outDir` spellings, compared byte-wise with
  // no case folding (12.0), valid beside the graph-data area's bar.
  "T7.3-1": ["7.3", "12.0", "14"],
  "T7.4-1": ["7.4", "14"],
  "T7.4-2": ["7.4", "8.1"],
  // T7.5-1: its selector-glob arms 7's outside-root decision by spelling
  // alone, met on a policy selector's `files` glob.
  "T7.5-1": ["7.5", "7", "14"],
  // T7.5-2: its twice-spelled edge one edge (5.2: duplicate declarations
  // collapse to a single edge), so one finding.
  "T7.5-2": ["7.5", "5.2", "14"],
  "T7.5-3": ["7.5", "14"],
  // T7.5-4: its inside-root spelling's `.` segment matching nothing (7).
  "T7.5-4": ["7.5", "7", "14"],
  "T7.5-5": ["7.5", "14"],
  "T7.5-6": ["7.5", "12.1", "14"],
  // T7.6-1: 7.6's type contract for the module's declared exports, in
  // every covered setup, read from TypeScript's listing for T7.6-2(d)'s
  // file, a configuration staged valid under 7 (a premise of the staging,
  // asserted of no product), so it carries 7.6 alone.
  "T7.6-1": ["7.6"],
  // T7.6-2: 7.6's type contract for valid configurations, in every
  // covered setup; the files are 7's declarative form, staged valid
  // under 7, 7.3, 7.4, and 7.5 (a premise of the staging, asserted of no
  // product), so it carries 7.6 alone.
  "T7.6-2": ["7.6"],
  // T7.6-3: 7.6's type contract for shape violations, in every covered
  // setup, each arm paired with T7.6-2(a)'s file type-checking; the arms
  // are (a) with violations of 7.6's type-error class applied (breaches of
  // 7's, 7.4's, and 7.5's rules, a premise of the staging, asserted of no
  // product), so it carries 7.6 alone.
  "T7.6-3": ["7.6"],
  // T7.6-4: 7.6's installation rules and Reach — copy, symbolic-link, and
  // aliased installs alike, N across 7.6's grammar, the holding directory
  // read along the physical path, other packages installed — through runs
  // of T7.6-1, T7.6-2(a) with T7.6-3's unknown-top-level-key arm, and
  // T7.6-6's exports and identity under each placement; its files are 7's
  // declarative form staged valid under 7 (a premise of the staging,
  // asserted of no product), so it carries 7.6 alone.
  "T7.6-4": ["7.6"],
  // T7.6-5: 7.6's Reach — the cases its four conditions leave open: an
  // ancestor manifest giving an unrelated name, ancestor manifests whose
  // types differ from the nearest one's, and a nearest manifest typed
  // "commonjs" — and its Covered setups' reading of a project's kind,
  // through runs of T7.6-1, T7.6-2(a) with T7.6-3's unknown-top-level-key
  // arm, and T7.6-6's exports and identity beside the canonical placement;
  // its files are 7's declarative form staged valid under 7 (a premise of
  // the staging, asserted of no product), so it carries 7.6 alone.
  "T7.6-5": ["7.6"],
  // T7.6-6: 7.6's runtime contract (Runtime, through Reach's routes) for
  // the module's exports and defineConfig's return, on every release E-1
  // provisions along each of Node.js's routes; it stages no configuration
  // and asserts no other passage, so it carries 7.6 alone.
  "T7.6-6": ["7.6"],
  // T7.6-7: 7.6's runtime contract's effect clause (Runtime), in runs of
  // T7.6-6's shape on every release E-1 provisions along each of Node.js's
  // routes: the runs' output, writes, process state, and FIFOs, each
  // absence paired with defineConfig returning its argument, its network
  // clause the environment's (E-1); it stages no configuration and asserts
  // no other passage, so it carries 7.6 alone.
  "T7.6-7": ["7.6"],
  "T8-1": ["8"],
  "T8-2": ["8"],
  "T8-3": ["8"],
  "T8-4": ["8"],
  "T8-5": ["8", "14"],
  "T8.1-1": ["8.1"],
  "T8.2-1": ["8.2"],
  "T9-1": ["9"],
  "T9.1-1": ["9.1"],
  "T9.2-1": ["9.2"],
  "T9.2-2": ["9.2"],
  "T9.2-3": ["9.2"],
  "T9.2-4": ["9.2"],
  "T9.2-5": ["9.2"],
  "T9.3-1": ["9.3"],
  "T9.3-2": ["9.3"],
  "T9.3-3": ["9.3"],
  "T10.1-1": ["10.1"],
  "T10.1-2": ["10.1"],
  "T10.1-3": ["10.1", "14"],
  "T10.1-4": ["10.1", "14"],
  "T10.1-5": ["10.1", "14"],
  "T10.1-6": [
    "10.1",
    "6.3",
    "10.7",
    "11.6",
    "12.2",
    "13.3",
    "13.4",
    "13.5",
    "14",
  ],
  "T10.2-1": ["10.2", "12.0"],
  // T10.2-2: 10.4's recorded-state rules behind its re-derivation arms'
  // entries — T10.5-8's d, in item (3)'s scope though its baseline state
  // lacks it, recorded absent with the explicit absent marker, and
  // T10.4-7(a)'s d2, joined at the re-derivation of x's `updated` resolve,
  // recorded present in x's `current` once that resolve records against the
  // item as re-derived (its absence from x's `baseline` is 10.2's own rule).
  "T10.2-2": ["10.2", "10.4"],
  "T10.2-3": ["10.2"],
  // T10.2-4: 10.5's new items added with current state, behind its
  // re-derivation arm — T10.5-5's newly visited p.q's `current`, written at
  // the re-derivation that adds its item and reported as so recorded.
  "T10.2-4": ["10.2", "10.5"],
  "T10.3-1": ["10.3"],
  "T10.3-2": ["10.3"],
  "T10.4-1": ["10.4"],
  "T10.4-2": ["10.4"],
  "T10.4-3": ["10.4"],
  "T10.4-4": ["10.4"],
  "T10.4-5": ["10.4"],
  "T10.4-6": ["10.4"],
  "T10.4-7": ["10.4"],
  "T10.4-8": ["10.4"],
  "T10.5-1": ["10", "10.5"],
  "T10.5-2": ["10.5"],
  "T10.5-3": ["10.5"],
  "T10.5-4": ["10.5"],
  "T10.5-5": ["10.5"],
  "T10.5-6": ["10.5"],
  // T10.5-7: 9.2's impact edges, `embeds` as well as `references`, behind
  // its two code-impact items (echo transitively impacted through its
  // embeds edge, show directly), and 10.7's payload rule behind the root
  // item's byte-asserted scope text, the scope node's own text.
  "T10.5-7": ["10.5", "9.2", "10.7"],
  // T10.5-8: 10.2's and 10.4's recorded-state rules behind item (3)'s
  // `baseline` entries — fixed from the recorded baseline graph, the
  // subtree-coherence item's relevant hashes per scope node, and d, in its
  // scope when it entered though the baseline graph lacks it, presented
  // absent with the explicit absent marker — and 10.7's payload rule behind
  // item (3)'s byte-asserted scope text, the root's subtree text.
  "T10.5-8": ["10.5", "10.2", "10.4", "10.7"],
  // T10.5-9: 10.4's recorded-state and presentation rules behind the
  // items' `current` entries — the relevant hashes at creation, the
  // deleted A.B.C's explicit absent marker — and every deleted node
  // presented absent under its baseline identity mapped forward through
  // the journal; 10.6's audit scope behind the audit contrast (the node
  // and all its current descendants); and 10.7's payload rule behind the
  // texts byte-asserted against `query node`'s in `export`, `show`, and
  // `next --json`.
  "T10.5-9": ["10.5", "10.4", "10.6", "10.7"],
  "T10.6-1": ["10", "10.6"],
  "T10.6-2": ["10.6"],
  "T10.6-3": ["10.6"],
  // T10.7-1: 12.0's syntax class behind the foreign `--strategy` values,
  // each answered with the plain usage error without loading configuration
  // (byte-identical on the invalid- and missing-configuration twins), and
  // 12.7's plain usage error (`code` and `path` `null`) and findings order
  // (the case pair's two condition-21 findings by concerned path bytes).
  "T10.7-1": ["10", "10.1", "10.7", "12.0", "12.7", "13.4", "14"],
  "T10.7-2": ["10.7"],
  "T10.7-3": ["10.7", "14"],
  "T10.7-4": ["10", "10.7"],
  "T10.7-5": ["10.7", "14"],
  "T10.7-6": ["10.7"],
  "T10.7-7": ["10.7"],
  "T10.7-8": ["10.7"],
  "T10.7-9": ["10.7", "10.4", "10.5"],
  "T10.7-10": ["10.7"],
  "T10.7-11": ["10.7"],
  "T10.7-12": ["1.7", "10.7"],
  "T10.7-13": ["10.7", "10.4", "12.7"],
  "T10.7-14": ["10.7", "12.7", "14"],
  "T10.7-15": ["10.7", "13.3", "14"],
  "T11-1": ["11", "11.1"],
  // T11-2: its node-kind arms' file in two spec groups — valid, a member of
  // each group, its nodes listed once (7.1).
  "T11-2": ["11", "11.1", "1.4", "7.1", "12.0", "12.7", "14"],
  "T11-3": ["11", "11.1"],
  "T11-4": ["11", "11.1", "12.0", "12.7", "14"],
  "T11-5": ["11", "11.1"],
  "T11-6": ["11.1", "4.6", "12.0"],
  "T11-7": ["11.1"],
  "T11.2-1": ["11.2", "14"],
  "T11.2-2": ["11.2", "14"],
  "T11.2-3": ["11.2", "14"],
  "T11.2-4": ["11.2", "14"],
  "T11.2-5": ["11.2", "14"],
  // T11.2-6: its unreadable-emit-directory arms assert 12.0's order — the
  // judgement's read failure met at the read it refuses, past every
  // argument check of the surfaces of 11.2 and of the gated reads — and
  // pin the error documents' `code` and `path` (12.7), `read-failure` at
  // `out` or below it and the plain usage error's `null`s; its passing-side
  // arms' 14.12 and 14.21 ride "14".
  "T11.2-6": ["11.2", "13.3", "13.4", "12.0", "12.7", "14"],
  "T11.2-7": ["11.2", "14"],
  "T11.3-1": ["11.3", "14"],
  "T11.3-2": ["11.3", "14"],
  "T11.3-3": ["11.3", "1.4", "12.0", "12.7", "14"],
  "T11.3-4": ["11.3"],
  "T11.4-1": ["11.4", "14"],
  "T11.4-2": ["11.4", "14"],
  "T11.4-3": ["11.4", "2.6", "12.7", "14"],
  "T11.4-4": ["11.4", "11.2", "2.1", "1.6", "7.2", "12.7", "14"],
  "T11.4-5": ["11.4", "14"],
  "T11.4-6": ["11.4", "14"],
  "T11.5-1": ["11.5"],
  "T11.5-2": ["11.5", "14"],
  "T11.5-3": ["11.5", "12.0", "12.7", "14"],
  // T11.6-1: its member-invariance arm asserts 1.5 for the inventory — every
  // path but the anchoring workspace-relative whatever the working
  // directory — the arm T1.5-1's inventory clause cross-references, so "1.5"
  // joins the home passage.
  "T11.6-1": ["11.6", "1.5"],
  // T11.6-2: every answer asserts findings [] beside the staged 14.19
  // sources — an inventory answer carries no finding but condition 23's,
  // the others reported where their conditions assign them (11.6) — so
  // "14" joins the home passage; 7.1/7.3/7.4/7.5/13.1/12.0/12.7 are
  // carriage context with home coverage at T7.1-*/T7.3-*/T7.4-*/T7.5-*/
  // T13.1-*/T12.0-*/T12.7-* — the invalid-path `.mdx` arms
  // (`specs/a'b.mdx`; Linux leg, a non-UTF-8 name in the marked byte form)
  // and the `files` selector forms (a capture referenced across a rule's
  // `from` and `to`, T7.5-4's inside-root `./` spelling, each reported
  // verbatim; 7's spelling rule with home coverage at T7-*) included.
  "T11.6-2": ["11.6", "14"],
  // T11.6-3: the occupancy and listing arms assert findings [] beside a
  // garbage journal and garbage session files — no 14.13, no 14.21 from the
  // inventory (11.6) — and its lock-path area arms assert T10.1-6's
  // condition-23 finding where `.xspec` holds no directory (14.23), so "14"
  // joins the home passage; 13.3/13.1/6.1/10.1/12.7 are carriage context
  // with home coverage at T13.3-*/T13.1-*/T6.1-*/T10.1-*/T12.7-*, as are
  // its lock-path arms' 13.4/13.5 (the transient lock path, its leftovers,
  // the held and the killed `rename`; nothing read below an area path
  // holding no directory) at T13.4-*/T13.5-*/T10.1-6, and the order
  // fixture's resolved configuration (7.1–7.5) at T7.*-*.
  "T11.6-3": ["11.6", "14"],
  // T11.6-4: asserts numbered conditions — the premise build's
  // every-family multiset, the passing-side arm's `check` 14.12 and 14.21
  // beside the finding-free inventory (T11.2-6's stagings), and the
  // condition-23 finding (TEST-SPEC 14's primary-test record lists T11.6-4
  // under 14.23) — so "14" joins the home passage; 14.14/12.7/13.3/12.1
  // are carriage context with home coverage at T7-*/T12.7-*/T13.3-*/
  // T12.1-*, as are the passing-side arm's `check` report (12.2), its
  // forbidden rule (7.5), and its corrupt session (10.1) at T12.2-*/
  // T7.5-*/T10.1-*.
  "T11.6-4": ["11.6", "14"],
  "T12.0-1": ["12.0"],
  "T12.0-2": ["12.0", "14"],
  "T12.0-3": ["12.0", "14"],
  "T12.0-4": ["12.0"],
  // T12.0-5: its positive side of the backslash asserts the condition-19
  // finding over a spec-group path 7.1 bars the backslash from (so "7.1"
  // and "14") and the backslash as a literal `--file` pattern byte (7);
  // its `move` arms, run from `specs/`, assert both forms' resulting
  // trees byte-exact — the relocated file, the created target file, and
  // the origin as the section form's deletion leaves it (6.5);
  // 11.3-11.5 are carriage context with home coverage at T11.3-*/T11.4-*/
  // T11.5-*.
  "T12.0-5": ["12.0", "12.7", "13.5", "6.4", "6.5", "7", "7.1", "14"],
  "T12.0-6": ["12.0"],
  "T12.0-7": ["12.0"],
  "T12.0-8": ["12.0"],
  "T12.0-9": ["12.0", "14"],
  // T12.0-10: its spelled-not-defined arms assert 11.2's line between a
  // spelled identity and a defined one (a duplicated or orphaned spelling
  // passes the id check; a braced or valueless `id` spells nothing), and
  // its synopsis-mismatch rows `move`'s two forms told apart by operand
  // spelling (6.5); its premise and gated reports pin numbered conditions
  // ("14").
  "T12.0-10": [
    "12.0",
    "1.4",
    "10.1",
    "10.7",
    "11.1",
    "11.2",
    "11.3",
    "11.4",
    "11.5",
    "6.5",
    "6.6",
    "7",
    "12.7",
    "14",
  ],
  "T12.0-11": ["preamble", "12.0"],
  "T12.0-12": ["preamble", "12.0"],
  // T12.0-13: its premise pins exactly one 14.19 with its stable code, and
  // the `view`, `at`, `occurrences`, and `rename` answers carry it, so "14"
  // joins the home passage; its `rename specs/a#b.mdx x y` arm asserts
  // 6.4's parse-local old-ID existence (a spelled bearer in the invalid-path
  // file passes the argument checks) and its invalid-workspace refusal
  // (exit 1, nothing modified), so "6.4" joins too; 11.2-11.5/12.7/6.5 are
  // carriage context with home coverage at T11.2-3/T11.3-*/T11.4-*/
  // T11.5-*/T12.7-*/T6.5-*.
  "T12.0-13": ["12.0", "6.4", "14"],
  // T12.0-14: the grammar arms assert `ids --file`'s restriction (12.3),
  // `build`'s flag set (12.1), the session name `-a` and its file (10.1),
  // `review create` and `resolve --note` (10.7), `--kinds` list values
  // (11.1), the `--config` path's directory as the root (7), and the
  // error document (12.7); the `--config` arm's premise asserts the
  // missing configuration's 14.14 error with its stable code (14).
  "T12.0-14": [
    "12.0",
    "12.3",
    "12.1",
    "10.1",
    "10.7",
    "11.1",
    "7",
    "12.7",
    "14",
  ],
  // T12.0-15: the human-form reports of `build`, `check`, and the gated
  // reads, each decoded and compared with its `--json` twin's findings —
  // every finding's stable code, locations, concerned path, and identities
  // ("14") — and 12.0's marked byte form of a non-UTF-8 path in them; the
  // fixtures' own outcomes (12.1, 12.2, 13.3, 14.19) are carriage context
  // with home coverage at T14-11, T12.2-2, T1.5-2, and T13.3-3. The
  // `rename`/`move` family's performed reports carry the applied mapping
  // ("6.4": a successful rename's report; "6.5": a move's, as rename's),
  // decoded and compared with the form-exact performed-operation document,
  // and its refused real operations every refusal finding's stable code
  // and concerned data ("14"), the invalid-workspace refusal's findings
  // each under its own condition's code (6.4). The `impact` family's human
  // reports carry each category with its attribution ("5.6", "9.1"), each
  // impacted location under its group ("9.2"), and the collapsed chains,
  // deleted nodes under their baseline identities, and witness edges and
  // paths of the output ("9.3"), decoded and compared with the `--json`
  // twin's; the baselines' reconstruction (9, 6.3) is carriage context
  // with home coverage at T9-1 and T6.3-*. The `review` family's human
  // `list` and `status` reports carry every session's name, strategy, and
  // item counts by stored status or its corruption, and every item's id,
  // kind, scope, status, and blocked state with the totals by status, in
  // the orders 10.7 fixes for the report itself ("10.7"), decoded and
  // compared with the `--json` twin's; its human `next` and `show` reports
  // carry the item returned or the session's full resolution, and the full
  // item with its text payload ("10.7": `show` reports every field of 10.2
  // plus the payload of `next --json`, which `next`'s human form does not
  // owe), decoded and compared with the `--json` twin's; its refusals —
  // T10.7-1's refused `create`s, the corruption reported in a refusal's
  // place among them (a name matching corrupt sessions ignoring ASCII case
  // alone naming each, "10.1"), T10.7-9's refused `split`s, and T10.7-10's
  // refused `resolve`, each refusal one finding ("10.7") — render as
  // precisely as findings, every refusal finding's code and concerned data
  // compared ("14"); and its subcommands naming each corrupt session of
  // T10.1-4 report the corruption ("10.1"), the condition-21 finding's
  // code and concerned path compared ("14"); the stagings' sessions,
  // resolutions, splits, and invalidation (10.3–10.6) and the payload's
  // contents (10.2, 10.4, 1.6, 1.7) are carriage context with home
  // coverage at T10.7-1, T10.7-5 through T10.7-10, and T10.1-4 (T10.7-7
  // and T10.7-8 cite the payload's contents under "10.7" alone, as this
  // entry does). The `coverage` family's human reports carry every
  // profile's counts, node identities, covering paths, and ignored nodes'
  // reasons, the reasons in the order 8.2 fixes for the report itself
  // ("8.2"); the `ids` family's human listings carry every entry, an empty
  // one included, and its IDs or tree, in the orders 12.3 fixes for the
  // report itself ("12.3"); and the `show` family's human reports carry the
  // full 12.4 enumeration ("12.4") — each decoded and compared with the
  // `--json` twin's; the fixtures' own coverage (8, 8.1) and the texts and
  // hashes the enumeration carries (1.6, 1.7, 5.5) are carriage context
  // with home coverage at T8.2-1, T12.3-1, and T12.4-1. The exit-2
  // family's human errors leave standard output empty, their standard-error
  // message carrying the stable code and concerned path the `--json` twin's
  // error document carries ("12.0", "14"): T12.7-3's configuration errors
  // in every concerned-path form (the anchoring forms, 11.6, and the
  // configuration search, 7, carriage context with home coverage at
  // T12.7-3, T11.6-1, and T7-1); T6.3-6's journal errors at a given
  // baseline, the resolution's usage error carrying condition 13's code and
  // path ("6.3"); T13.5-2's busy refusals while its command 1 holds, each
  // refused promptly, modifying nothing ("13.5"); and T14-10's exit-2
  // stagings, 14.25's read failures and the configuration errors, journal
  // errors, and acquisition's write failure its stagings meet, each with
  // its code and concerned path ("14"; its given baselines' journal errors
  // "6.3", its acquisition stagings "13.5"), the refused objects' routes —
  // the discovery and upward search (7), the anchoring forms (11.6), the
  // session directory (10.1), and the gate's reads (13.3) — carriage
  // context with home coverage at T14-10, T7-1, T11.6-1, T10.1-1, and
  // T13.3-1; and T14-9's exit-2 stagings, 14.24's write failures at every
  // concerned path, each with its code and concerned path ("14"; its
  // held commands and acquisition's writes "13.5"), and the plain usage
  // errors of its precedence clause, asserted for neither (its given
  // baselines "6.3"; its hold file "13.5"), the refused writes' routes —
  // the per-command write order (13.5), the refresh (13.3), a
  // regeneration's derived files (12.1, 13.1, 13.2) — carriage context
  // with home coverage at T14-9, T13.5-7, T13.3-2, and T12.1-3. Every
  // passage the family asserts is cited.
  "T12.0-15": [
    "12.0",
    "14",
    "6.4",
    "6.5",
    "5.6",
    "9.1",
    "9.2",
    "9.3",
    "10.1",
    "10.7",
    "8.2",
    "12.3",
    "12.4",
    "6.3",
    "13.5",
  ],
  // T12.0-16: byte order over the separating pair U+FF21/U+1F600 on 12.7's
  // tag sets and findings order, 11.4's and 12.3's file orders, 11.6's
  // inventory lists, and 5.7's occurrence order; its (c) arms pin the
  // condition-5, -9, -10, and -12 findings by code ("14"); its (d) arms the
  // preview's `mapping`, `files`, and delta directions (6.6) and the
  // performed rename's applied mapping (6.4); its (e) arms the item orders
  // of path-blocks, audit, and coverage sessions as `status` and `export`
  // present them (10.5, 10.6, 10.7); and its (f) arms the shortest-path
  // tie-break of a covering path (8.2), an impact witness (9.3), and a
  // `reachable` witness (11.1). 7.4/7.5's set reading, 12.2's `check`,
  // 13.1/13.2's derived paths, 13.3's deleted graph data, and 6.3's
  // baseline are carriage context with home coverage at
  // T7.4-*/T7.5-*/T12.2-*/T13.1-*/T13.3-*/T6.3-*.
  "T12.0-16": [
    "12.0",
    "12.7",
    "11.4",
    "11.6",
    "12.3",
    "5.7",
    "6.4",
    "6.6",
    "10.5",
    "10.6",
    "10.7",
    "8.2",
    "9.3",
    "11.1",
    "14",
  ],
  "T12.1-1": ["12.1"],
  "T12.1-3": ["12.1"],
  "T12.1-4": ["12.1", "14"],
  "T12.2-1": ["12.2"],
  "T12.2-2": ["12.2", "14"],
  "T12.2-3": ["12.2", "14"],
  "T12.2-4": ["12.2", "13.3", "14", "7.5", "12.1"],
  "T12.3-1": ["12.3"],
  "T12.3-2": ["12.3"],
  "T12.4-1": ["12.4"],
  "T12.5-1": ["12.5"],
  "T12.6-1": ["12.6"],
  "T12.6-2": ["12.6", "14"],
  // T12.7-1: asserts the finding form over the staged conditions (14.1,
  // 14.3, 14.9, 14.11, 14.12, 14.19) and their stable codes, so "14" joins
  // the home passage; a review refusal's code-less form (`code` null,
  // `locations` [], `path` null) runs T10.7-14's shared check, rule (d)'s
  // cross-reference; 11.2-11.6/10.7 are carriage context with home
  // coverage at T11.2-*/T11.3-*/T11.4-*/T11.6-*/T10.7-*.
  "T12.7-1": ["12.7", "14"],
  // T12.7-2: asserts the staged conditions (14.1, 14.3, 14.5, 14.9, 14.12,
  // 14.15, 14.19) ordered by code and the refusal reasons in 14's listed
  // order, so "14" joins the home passage; 13.3 (the gated read),
  // 11.3-11.6, 12.6, 6.5/6.6, and 7.3 are carriage context with home
  // coverage at T13.3-*/T11.*/T12.6-*/T6.5-*/T6.6-*/T11.6-2.
  "T12.7-2": ["12.7", "14"],
  // T12.7-3: asserts the error document's stable codes — the 14.14
  // configuration error's, 14.13's `journal-error` at a given baseline's
  // resolution, 14.24's `write-failure`, 14.25's `read-failure`, and
  // 14.26's `workspace-busy` — so "14" joins the home passage; 12.0
  // (JSON-in-effect, stream separation, stderr diagnostics) and 11.6 (the
  // anchoring form) are carriage context with home coverage at
  // T12.0-2/T11.6-1, 7's configuration location/validity at T7-*, 13.5's
  // exclusion (the busy arm's held `rename`) at T13.5-2, 6.3's journal
  // read at a given baseline at T6.3-6, and 10.7's JSON-only `export` at
  // T10.7-*.
  "T12.7-3": ["12.7", "14"],
  "T13.1-1": ["13.1"],
  "T13.1-2": ["13.1"],
  "T13.2-1": ["13.2"],
  "T13.3-1": ["13.3"],
  "T13.3-2": ["13.3", "11.6", "14"],
  "T13.3-3": ["13.3", "14"],
  "T13.3-4": ["13.3"],
  // T13.3-5 (never stale: (a) tampered graph data, (b) added sources, (c) a
  // changed journal): beside its home passage, 5.4 and 5.5 for (c)'s root
  // ownHash, which the journal's deletion changes — `b`'s canonical
  // identity entering the root's own content — asserted against the one
  // reported before the deletion; 11.6 for `inventory`'s `recorded`, read
  // without refresh and asserted a list at exit 0 or the unavailability
  // marker at exit 1, and (b)'s twin's `recorded` naming the added spec
  // source's derived files; and 13.4 for the removal rule deciding which
  // recorded paths' occupants `check` reports in the recorded-file form in
  // (a) and for (c)'s per-file set, what a `build` on a copy of the state
  // leaves; "14" for condition 10's unit, per-file, and recorded-file forms
  // in `check`'s verdicts and 14.23's unavailable datum (rule (a)). 12.2
  // and 12.0 are carriage context with home coverage at T12.2-* and
  // T12.0-*; (b)'s premises — the added source changing a read's answer,
  // its module among the stale derived paths — are staging context, with
  // home coverage at T12.3-*, T11.3-*, and T13.1-*.
  "T13.3-5": ["13.3", "5.4", "5.5", "11.6", "13.4", "14"],
  "T13.4-1": ["13.4"],
  "T13.4-2": ["13.4"],
  "T13.4-3": ["13.4", "14"],
  // T13.4-4: its directory arms assert 14.22's boundary — a directory at a
  // derived path holding nothing xspec discovers or generates is replaced
  // (`build` exits 0, `check` clean), never refused, 14.22 reaching only a
  // directory component of a discovered source's or another derived path
  // (home coverage at T13.4-6/T13.4-9/T13.4-10) — so "14" joins the home
  // passage; its 12.1 citation is carriage context (every arm a success
  // path).
  "T13.4-4": ["13.4", "14"],
  // T13.4-5: its identity arm's reads present every recorded node — items'
  // payload nodes, their recorded states' node entries, the audit
  // session's decomposition — under its current identity, mapped forward
  // through the journal (10.4), the `rename` and `move` before them writing
  // no session file (13.4); the operations' journaling is a cross-reference
  // to T6.1-1's assertion, and 6.4's, 6.5's, and 13.5's write sets are
  // carriage context with home coverage at T6.4-*/T6.5-*/T13.5-*.
  "T13.4-5": ["13.4", "10.4"],
  "T13.4-6": ["13.4", "13.3", "14"],
  // T13.4-8's 6.5/7.3/13.1/13.2 citations are carriage context with home
  // coverage at T6.5-*/T7.3-1/T13.1-*/T13.2-1; no numbered condition is
  // asserted (success paths only).
  "T13.4-8": ["13.4"],
  // T13.4-9 asserts 13.4's relation between derived paths through condition
  // 22 (14) at `build`, `check`, and the gate's `ids` (13.3); (e)'s
  // `inventory` read (11.6), 7.3's emission settings, and 13.1/13.2's
  // derived paths are carriage context with home coverage at
  // T11.6-3/T7.3-1/T13.1-*/T13.2-1.
  "T13.4-9": ["13.4", "13.3", "14"],
  // T13.4-10 asserts 13.4's rebuild-obstructing orphans through condition
  // 22 and condition 10's recorded-file form with its manual-deletion
  // correction (14), `build`'s refusal modifying nothing (12.1), `check`'s
  // recorded-file verification (12.2), and 13.5's exception to rerunning
  // `build` — the orphans 13.4 leaves for manual deletion; 7.3's emission
  // settings, 13.2's emit paths, and the twin's graph-data deletion (13.3)
  // are carriage context with home coverage at T7.3-1/T13.2-1/T13.3-2.
  "T13.4-10": ["13.4", "12.1", "12.2", "13.5", "14"],
  // T13.4-11 asserts `build`'s removal of recorded derived files no longer
  // generated (12.1) and `check`'s recorded-file verification (12.2) through
  // condition 10's recorded-file form (14); the record (13.3), 7.2's code
  // group, and 7.3's emission settings are carriage context with home
  // coverage at T13.3-*/T7-*/T7.3-1.
  "T13.4-11": ["13.4", "12.1", "12.2", "14"],
  // T13.4-12 asserts 13.4's transient lock path through condition 10's and
  // condition 22's absence at `check` (its title names both), 14.25's read
  // failure at the lock path with its stable code, and condition 23's
  // absence beside an unreadable leftover (14); its `inventory` reads
  // (11.6), refreshing reads (13.3), the preview's answer fixed by no state
  // of the lock path (6.6, home coverage at T6.6-3(a)), the dead run's entry
  // a kill leaves (13.5, T13.5-3), and the manual remedy's next `rename`
  // (13.5's acquisition, T13.5-10(a)) are carriage context.
  "T13.4-12": ["13.4", "14"],
  // T13.4-13 asserts 13.4's catch-all occupant clauses with a FIFO: 7's at
  // the configuration path (condition 14), the journal's and a session's
  // (conditions 13 and 21; 10.1's corrupt session), the session directory's
  // and the area's own (10.1, 11.6; conditions 22 and 23 through T10.1-6's
  // sweeps), the inventory's occupancy and session listing (11.6), the
  // surfaces of 11.2 answering beside the journal's condition and beside a
  // write path's, the gate's refusal at `ids` (13.3), a derived file's path
  // stale and replaced and a recorded one reported and removed (13.4;
  // condition 10's per-file and recorded-file forms), a write path's
  // directory component (condition 22), a move's destination and its
  // components (6.5's refused-destination-exists and
  // refused-invalid-destination, rule (b)), and the hold path's failed
  // creation (13.5's usage error) — rule (a)'s "14". The `rename`'s
  // invalid-workspace refusal (6.4), the error document's form (12.7),
  // `version` (12.6), `impact --base c1`'s baseline resolution (6.3),
  // acquisition's write failure (13.5), 7.3's emission settings and 13.2's
  // emit paths, and `build`'s success paths (12.1) are carriage context
  // with home coverage at
  // T6.4-*/T12.7-3/T12.6-*/T10.1-6/T13.5-10/T7.3-1/T13.2-1/T13.4-4.
  "T13.4-13": [
    "13.4",
    "6.5",
    "7",
    "10.1",
    "11.2",
    "11.6",
    "13.3",
    "13.5",
    "14",
  ],
  "T13.5-1": ["13.5"],
  "T13.5-2": ["13.5", "14"],
  "T13.5-3": ["13.5", "14"],
  "T13.5-4": ["13.5", "14"],
  "T13.5-5": ["13.5"],
  "T13.5-6": ["13.5"],
  "T13.5-7": [
    "13.5",
    "14",
    "12.0",
    "12.7",
    "6.4",
    "6.5",
    "6.6",
    "6.7",
    "6.2",
    "6.1",
    "13.3",
    "13.4",
    "10.7",
  ],
  "T13.5-8": ["13.5", "13.3", "6.3", "6.4", "6.5", "6.6", "12.0", "14"],
  // T13.5-9 asserts 13.5's reach — every other run on the machine against
  // the held workspace refused at acquisition, in any environment, from any
  // working directory, through any path to the root, by any user who can
  // write it, modifying nothing, the holder's entry untouched and alone —
  // and the stable codes of those refusals: `workspace-busy`, and for the
  // second user `write-failure` or `read-failure` (14). The session
  // staging, the twins' outcomes, and the holder's completion are carriage
  // context with home coverage at T10.7-* and T13.5-2.
  "T13.5-9": ["13.5", "14"],
  // T13.5-10(d) asserts 12.0 beside 13.5: its determinism arms' diagnostics
  // byte-identical (no entry or absolute path named), and its unbuilt arm's
  // acquisition preceding the session check of `resolve` and `split`. Its
  // (h) asserts 13.3 and 6.6 beside 13.5: with `.xspec` unlistable — past
  // acquisition condition 23's state, never a read failure — each real
  // operation proceeds (6.6) and its refresh or finishing regeneration
  // writes graph data in that state (13.3).
  "T13.5-10": ["13.5", "13.4", "13.3", "12.0", "6.6", "14"],
  // T13.5-11 asserts release (13.5) and the stable codes of its endings —
  // the busy refusal's `workspace-busy`, (c)'s `read-failure`, and (a)'s
  // failures' `read-failure`, `configuration-error`, and `write-failure` —
  // and the absence of a write failure where release's deletion is refused
  // (14); and, after T13.5-7's `build` and refreshing reads refused at their
  // writes, which acquire nothing, `.xspec/lock` absent all the same: no
  // write but acquisition and release touches the lock path (13.4). The
  // outcomes of the endings it observes — each command's success, its usage
  // errors (12.0), the refusals of 6.4, 6.5, 10.7, 13.3, and 14.21, the
  // rediscovery's failures (7.2), acquisition's own, and the states T13.5-7's
  // refused writes leave — are carriage context with home coverage at the
  // tests (a) names (T13.5-12, T13.5-10, T13.5-7).
  "T13.5-11": ["13.5", "13.4", "14"],
  // T13.5-12 asserts 13.5's rediscovery: each change made during a hold met
  // by the second discovery — a created or deleted source, the origin file,
  // a file both groups match, a directory made unlistable — and the order
  // 12.0 fixes for what it meets: the configuration error past acquisition
  // and the hold file's errors, before the unknown-ID usage error, and the
  // unknown-file usage error (`code` `null`) judged over the sources it
  // fixed; the stable codes `configuration-error` and `read-failure` of its
  // endings, and no `read-failure` for a source deleted during the hold
  // (14); and, as its arms' premise, a twin's `rename` rewriting the `d`
  // reference and the TypeScript marker it is given to `A.a2` in place
  // (6.4). The audit session's scope (10.6), the configuration error's
  // rule (7.2), and the twins' outcomes are carriage context with home
  // coverage at T10.6-*, T7-*, and T6.4-*.
  "T13.5-12": ["13.5", "12.0", "6.4", "14"],
  // T13.5-13 asserts 13.5's exclusion among overlapping acquisitions — at
  // most one of the runs started together acquiring, the others refused,
  // modifying nothing; the one success's and the serial successes' outcomes
  // a twin's; `.xspec/lock` absent, an empty `.xspec` the one residue — and
  // the busy refusal's stable code `workspace-busy` at `.xspec/lock` (14).
  // The operations' own outcomes (6.4, 10.6, 10.7), the 13.3 refresh a
  // `review create` makes on the unbuilt workspace, and the twins'
  // byte-determinism (12.0) are carriage context with home coverage at
  // T6.4-*, T10.6-*, T10.7-*, T13.3-*, and T12.0-*.
  "T13.5-13": ["13.5", "14"],
  // T14-1: the reporting contract (home "14") with, on its two pairs, the
  // gate's report at `ids` — exactly the findings a `build` would now
  // report, a journal error or a refused write beside a source validation
  // error, answering nothing and modifying nothing (13.3) — and each
  // pair's findings form-exact in 12.7's order, a path condition's
  // concerned path beside `locations` [] (12.7); its human reports (12.0's
  // information parity) are context with home coverage at T12.0-1.
  "T14-1": ["14", "12.7", "13.3"],
  "T14-2": ["14", "2.4", "4.5"],
  "T14-3": ["14"],
  // T14-4: the reporter matrix, home "14" alone — the surfaces it reads
  // each condition's reporters from (13.3's gated reads, 11.2's and 11.6's
  // answers, 10.7's review reports, 6.6's previews, and 6.3's given
  // baseline, whose journal error is the exit-2 error document) are
  // context, with home coverage at their own sections' tests, which its
  // TEST-SPEC entry cites (T13.3-3, T11.2-6, T11.6-4, T10.1-5, and T6.3-6
  // among them).
  "T14-4": ["14"],
  // T14-5: its single-casing arm's byte-wise, case-sensitive suffix test of
  // 14.20's grammar selection, `src/x.TSX` lacking `.tsx` (12.0: no case
  // folding).
  "T14-5": ["14", "12.0"],
  // T14-6: 12.7 (the JSON report form pinning `code`) and 12.0 (the exit-2
  // error document carriage) are context with home coverage at
  // T12.7-*/T12.0-*, 13.5's exclusion (the 14.26 arm's held `rename`,
  // staged as T13.5-2 stages it) at T13.5-2, and 6.3's given baseline (the
  // baseline arm's `impact --base`, whose journal error is the exit-2 error
  // document, staged as T6.3-6(a) stages it) at T6.3-6, as T14-4's entry
  // takes it; the review refusal's form — no location, no concerned path —
  // is T10.7-14's assertion run through the shared check (rule (d) above).
  "T14-6": ["14"],
  // T14-7: 6.4/6.5/5.3 (the staged operations and the cycle rule),
  // 12.7/12.0 (report carriage; 12.0's unknown-identity usage error on an
  // invalid-path identity, home T11-6), 1.5 (the identity form 14 restates
  // over invalid paths), 5.7/11.4 (the occurrence span and the import
  // range the located sets are read in), and 5.2 (the one edge behind a
  // `d` array spelling one target twice, whose two entries the twice-
  // spelled cycle arms locate) are context with home coverage at
  // T6.4-*/T6.5-*/T5.3-1/T12.7-*/T12.0-*/T11-6/T1.5-*/T5.7-*/T11.4-*/T2.2-3;
  // the home passage "14" also carries the invalid-workspace arm's
  // asserted numbered condition (14.5).
  "T14-7": ["14"],
  // T14-8: 5.7/11.4 (the embedding container span and the byte
  // classification it keeps exact; the occurrence spans and the import
  // range the twice-spelled cycles' locations are read in) and 12.7 (the
  // finding form's location order) are context with home coverage at
  // T5.7-2/T11.4-6/T12.7-*; 2.1 and 5.3 (the staged cycles) have home
  // coverage at T2.1-5/T5.3-*, 2.1's two imports binding one module under
  // different names (the twice-spelled cycles' `B2` beside `B`) at T2.1-3,
  // and 5.2 (the one edge behind a twice-spelled `d` array or two
  // embeddings of one target, whose spellings the twice-spelled cycles
  // locate) at T2.2-3. The home passage "14" carries the asserted numbered
  // conditions (14.3, 14.15, 14.9, 14.6, 14.12).
  "T14-8": ["14"],
  // T14-9: the 14.24 contract (home "14") with the exit classes and the
  // error document it asserts (12.0, 12.7), the refreshing reads whose
  // graph-data write is refused (13.3), and the seam-held stagings, the
  // hold-file usage error, the pinned "nothing written" states, and
  // acquisition's refused writes concerning the lock path or the area's own
  // path (13.5); the given baselines' plain usage error — an unresolvable
  // ref, and git data refused — met before the gate and so the refresh,
  // graph data left stale (6.3, 12.0, 13.3); 6.4/6.5/10.7/11.6 (the staged
  // operations, the area naming), 12.1 (the regenerations owing a Markdown
  // file's creation or an orphaned one's removal), and 13.4 (the occupant
  // deleted by hand before recovery) are context with home coverage at
  // T6.4-*/T6.5-*/T10.7-*/T11.6-*/T13.5-7/T13.4-12.
  "T14-9": ["14", "6.3", "12.0", "12.7", "13.3", "13.5"],
  // T14-10: the 14.25 contract (home "14": conditions 20, 13, 21, 14, 10,
  // 23 and the read-failure usage error) with the exit classes, the read
  // order, and the syntax-class precedence it asserts (12.0), the error
  // document (12.7), a given baseline's resolution meeting the refused
  // journal read as its usage error and refused git data leaving the
  // baseline unreadable, a plain usage error (6.3), the corrupt-session
  // reports of `review status`/`list` and the gate's report ending `review
  // list` before its listing (10.7), the per-file availability and masking
  // of the refused source and the surfaces' finding-free answers beside the
  // journal's condition (11.2), `at`'s unavailable resolution on it (11.5),
  // the inventory's journal, session, and record answers (11.6), the gated
  // and refreshing reads over the unreadable journal and graph data (13.3),
  // and arm (i)'s refused reads at acquisition concerning the lock path and
  // at the second discovery of a held mutating command, each stopping the
  // command with nothing modified (13.5); arm (k)'s upward search from the
  // working directory, stopping at it refused rather than walking on, and
  // arm (l)(iii)'s `--config` path, its refused kind read never missing or
  // invalid configuration (7), each concerned in its anchoring form (11.6);
  // and `version`, loading no configuration, answering beside the refused
  // configuration and from the refused working directory (12.6);
  // 6.6/14.14's staged surfaces are context with home coverage at
  // T6.6-6/T12.7-3.
  "T14-10": [
    "14",
    "6.3",
    "7",
    "10.7",
    "11.2",
    "11.5",
    "11.6",
    "12.0",
    "12.6",
    "12.7",
    "13.3",
    "13.5",
  ],
  // T14-11: the per-condition range rules (home "14") with the byte-offset
  // convention they use (1.7), the `d`-entry, marker, `text(...)` call, and
  // embedding-container spans (5.7) — a trailing comma's `d={[BASE.a,]}`
  // valid, its one occurrence spanning `BASE.a` — the attribute,
  // opening-tag, and import ranges (11.4), and the per-spelling resolution
  // inside a repeated `d` with the occurrence it records (11.2);
  // 2.4/2.7/4.5's staged forms, and 4's module-linking forms whose 14.15
  // ranges arms (j) and (x) pin, are context with home coverage at
  // T2.4-*/T2.7-*/T4.5-* and T4-2, as are the embedding form (2.3, T2.3-*),
  // the aliased `text` binding (4, 4.3, T5.7-2), and the trailing-comma
  // arm's one `depends` edge (2.2, T2.2-1).
  "T14-11": ["14", "1.4", "1.6", "1.7", "2.4", "2.7", "5.7", "11.2", "11.4"],
  // T14-12 asserts the well-formedness contract of 14.20 (the "14" key)
  // through the ordinary outcomes of well-formed files: the import
  // collision (2.1), the container, attribute, and export forms (2.7), the
  // marker's attribution and edge in a code file (4.5, 4.6), the
  // occurrence it records (5.7), and the availability contract of the
  // consulted surfaces (11.2, 11.3, 11.4).
  "T14-12": [
    "14",
    "1.4",
    "1.7",
    "2.1",
    "2.7",
    "4.5",
    "4.6",
    "5.7",
    "7",
    "11.2",
    "11.3",
    "11.4",
  ],
  "T15-1": ["15"],
  "P-1": ["1.4", "2.6", "14"],
  "P-2": ["2.3", "2.7", "3"],
  "P-3": ["1.6", "3"],
  "P-4": ["5.5"],
  "P-5": ["6.2", "6.4", "6.5", "2.1"],
  "P-6": ["6.3", "9.1"],
  "P-7": ["7", "7.5", "14"],
  "P-8": ["12.0", "12.1"],
  "P-9": ["10.1", "10.4", "10.7", "14"],
  "P-10": ["6.1", "13.5"],
  "P-11": ["11.2", "11.4", "12.7"],
  "P-12": ["5.7", "11.5"],
  "P-13": ["7.4", "8", "8.1", "8.2"],
  // P-14 asserts 14.25's absence rule — a source vanished between a
  // command's discovery (for a mutating command, its rediscovery under
  // exclusivity, 13.5) and its content read, removed or relocated since
  // discovery, reads as undiscovered: never a `read-failure` for it, never
  // condition 20 for it at offset 0 (14; TEST-SPEC §14's index lists P-14
  // under 14.25) — and, for a read naming it, the unknown-file usage error
  // with it absent, exit 2, `code` null (12.0; 11.4, 11.5). The reads' own
  // answers (11.1, 11.3, 12.3), and the outcomes of `build`, `check`, the
  // `rename`, and `review create` driven alone (12.1, 12.2, 6.4, 10.7) —
  // their output and the files they leave — are compared with the
  // product's quiescent ones, carriage context with home coverage at
  // T11-*, T11.3-*, T12.3-*, T12.1-*, T12.2-*, T6.4-*, and T10.7-*.
  "P-14": ["11.4", "11.5", "12.0", "13.5", "14"],
  "P-15": ["13.4", "13.5"],
  // P-16 asserts 10.5's path-blocks derivation over random histories — its
  // items' kinds, scope sets, contexts, origins, blocking, and order — with
  // 5.6's originating nodes as each origin's ground, 9.2's impacted code
  // over impact edges in either graph as the code-impact items' ground,
  // identities mapped through the journal suffix (6.3), and every scope
  // node compared as a canonical identity and presented under its current
  // identity and presence (10.4).
  "P-16": ["5.6", "6.3", "9.2", "10.4", "10.5"],
  // P-17: 7.6's installation rules and Reach over drawn names, placement
  // forms, holding directories, covered setups, releases, and routes,
  // through runs of T7.6-1, T7.6-2(a) with T7.6-3's unknown-top-level-key
  // arm, and T7.6-6's exports and identity; its files are 7's declarative
  // form staged valid under 7 (a premise of the staging, asserted of no
  // product), so it carries 7.6 alone.
  "P-17": ["7.6"],
  // P-18: 7.6's type contract over drawn configurations — valid ones
  // type-checking in a drawn covered setup, each paired with a mutant
  // holding one drawn violation of 7.6's type-error class failing to
  // type-check there; its draws are 7's declarative form staged valid under
  // 7, 7.3, 7.4, and 7.5, and its mutants breaches of those rules (premises
  // of the staging, asserted of no product), so it carries 7.6 alone.
  "P-18": ["7.6"],
  // P-19 asserts 7's reading of the configuration's import: its specifier
  // any static string literal (2.4), read as spelled and never interpreted,
  // resolved, or loaded, so that every answer and every generated file is
  // its twin's. Its commands' clean outcomes (12.1, 12.2, 12.3, 11.6) are
  // the twin's staging premises, home coverage at T12.1-*, T12.2-*, T12.3-*,
  // and T11.6-*.
  "P-19": ["2.4", "7"],
};
