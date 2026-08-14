// TEST-SPEC §11.4 (`xspec view`) — SUITE-54: T11.4-1 through T11.4-5
// (T11.4-6 is the planned follow-up in this module).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), and rejects a product only via diagnosed
// assertion failures (H-8). SPEC 11: `view` is JSON-only — a single JSON
// document is its only output form, with or without `--json` — in the
// form-exact 12.7 document form (H-3), so every invocation below runs bare
// and its entire stdout decodes through `decodeViewReport`, which enforces
// the top level (`{"findings", "views"}` exactly), every per-file wrapper and
// node member (`{"identity", "range", "opening", "closing", "attributes",
// "tags", "coverage", "children"}`, the text members absent without
// `--text`), the three-state datum forms, and the pinned orders (per-file
// views by path bytes, children/attributes/imports/occurrences/comments in
// document order) over whatever the product emits.
//
// T11.4-1 — views and tree. One workspace, one bare `view` (neither operands
// nor `--file`), the whole document asserted:
//
// - Whole domain and order: every discovered spec source is viewed — a
//   section-less file included (a product viewing only files that hold
//   sections drops specs/sub/leaf.mdx and fails the exact file-list
//   compare) — as per-file views in byte order of workspace-relative path.
//   The staged names discriminate the collation: "specs/Zebra.mdx" (Z, 0x5A)
//   sorts before "specs/alpha.mdx" (a, 0x61) before "specs/sub/leaf.mdx"
//   (s, 0x73) by path bytes, while a case-folding or locale collation orders
//   alpha first and fails (the exact compare here; the decode's
//   strictly-ascending check besides).
// - Tree and decomposition (specs/Zebra.mdx, finding-free): the root and the
//   full positional section tree in document order — paired sections at
//   three depths, a self-closing leaf at depth three and another at depth
//   two, two top-level sections — per node the construct range and the
//   decomposition, byte-asserted against precomputed offsets composed by the
//   running-offset builder (SPEC 1.7: zero-based byte offsets,
//   start-inclusive end-exclusive; the multi-byte prefix shifts every later
//   offset so code-point, UTF-16, or line/column reporters fail): opening
//   AND closing tag ranges for paired sections, opening only — the whole
//   self-closing tag, equal to the construct range — for self-closing
//   sections, neither (both `null`) for the root, whose range is the entire
//   file.
// - Invalid-element parenting (specs/alpha.mdx): a section nested inside an
//   invalid non-section element parents to the INNERMOST enclosing section
//   construct — `wrap.mid.inner`, inside a `<div>` inside `wrap.mid` inside
//   `wrap`, parents to `wrap.mid` (never `wrap`, never the root: an
//   outermost-section or root parenting fails the exact tree compare and
//   would judge the ID against the wrong prefix) — and to the root when no
//   section encloses the element (`free`, inside a top-level `<em>`). The
//   enclosure is the one 11.2's chain conditions read: every staged identity
//   is spelled, well-formed, structurally conformant against its POSITIONAL
//   parent, and unique, so every identity datum is the plain expected
//   string — a product reading the invalid element as a chain member (its
//   spelled identity none) marks the nested section unavailable and fails
//   the compare — and the answer's findings are exactly the two 14.16s (a
//   mis-parenting product reports a phantom 14.2 and fails the count), each
//   located within its own element's construct window in specs/alpha.mdx,
//   the `<div>`'s finding ordered before the `<em>`'s (12.7: equal codes
//   order by locations; the windows are disjoint). The invalid elements get
//   NO view entry (SPEC 11.4: the invalid constructs of 14.16 get no view
//   entry — an extra node fails the tree compare).
// - Findings and exit: the two 14.16 findings ARE the staging-integrity pin
//   (no gate-reference `build` — see the certification note), and any
//   finding means exit 1 with the full answer still emitted (SPEC 11.2).
//   imports/occurrences/comments are asserted `[]` per file — nothing is
//   staged, and empty lists are `[]`, never `null` (SPEC 12.7).
//
// T11.4-2 — operands vs restriction (SPEC 11.4). One failing-on-purpose
// workspace, the whole sweep inside one modifies-nothing compare:
//
// - Staging (the `build --json` gate pins it before any arm, so every
//   domain-and-exit assertion below reads on staged ground): specs/dup.mdx
//   is finding-free with one section `solo` (the positive-control file the
//   set arm views); specs/bad.mdx holds exactly one 14.3 (a duplicate
//   `twin` pair); src/app.ts is a DISCOVERED code source holding exactly one
//   14.8 (the string-form `text("solo")` call, invalid in TypeScript by
//   form, SPEC 4.3) beside a resolving `SPEC.solo` marker; docs/note.mdx is
//   an on-disk, deliberately unparseable decoy in NO configured group (SPEC
//   7: discovery is controlled exclusively by configuration).
// - `<file>` operands assert membership in the DISCOVERED spec-source
//   domain: a file existing nowhere and the on-disk undiscovered decoy each
//   exit 2 as an unknown file (a product resolving operands against the
//   filesystem accepts the decoy and answers — or surfaces its 14.20 —
//   instead of erring); the discovered code source exits 2 as a wrong-kind
//   operand (12.0), its own 14.8 notwithstanding — the argument checks
//   precede answering (11.2, the T11.2-5 protocol), never exit 1 with the
//   file's findings.
// - `--file` is instead a set restriction over the domain: a glob matching
//   only the undiscovered decoy, one matching nothing at all, and the SAME
//   `src/app.ts` spelling that just erred as an operand each admit the
//   empty set — `{"findings": [], "views": []}`, exit 0, no unknown-file
//   usage error on this filter, whatever findings the workspace carries.
//   The only-code-sources arm is the sharp half (SPEC 11.4: the restriction
//   admits the discovered SPEC sources it matches, unlike 11.3's
//   spec-and-code-alike filter): a product reusing the occurrences filter
//   consults the finding-laden code file, carries its 14.8, and exits 1.
// - Combining `<file>` operands with `--file` — each part individually
//   valid — is a usage error, exit 2 (an intersecting or union product
//   answers instead).
// - The requested files form a set: the discovered specs/dup.mdx named
//   twice yields ONE view (the decode besides rejects a duplicated view
//   entry: per-file views are strictly ascending by path bytes), the
//   finding-free domain {dup} exiting 0 with an empty findings member while
//   bad.mdx and the code source stay failing — the domain is the requested
//   files (T11.2-5's ground riding as this arm's positive control). The
//   view's substance is pinned at identity level (root and child identity);
//   ranges, attributes, and interpreted values stay T11.4-1/-3's subject.
//
// T11.4-3 — attributes and per-node data (SPEC 11.4, 11.2, 2.7). One
// workspace, two files, two invocations:
//
// - specs/attrs.mdx, staged via the running-offset builder: a
//   five-attribute section tag `<S id="dup" id="dup" note="mystery"
//   {...extras} tags>` — a repeated `id` (BOTH entries listed), an unknown
//   prop, a spread attribute (its `name` structurally absent — the stated
//   `null` — its source text the whole braced construct), and a valueless
//   bare-name `tags` — and a second section `<S id="cov"
//   coverage={"none"}>`. The bare `view` asserts every attribute entry
//   `{name, range, text}` byte-exactly in tag order: inclusion is by form —
//   a product omitting an invalid form from the listing (or folding the
//   repeated pair to one entry) fails the exact attributes compare — while
//   each invalidity is a located finding beside the view: exactly five
//   14.17 (repeated `id`; unknown prop; spread attribute; valueless `tags`;
//   braced `coverage` — SPEC 2.7 assigns each), every finding located in
//   specs/attrs.mdx (file granularity; range precision is T14-8's), and
//   nothing else: no 14.1 (an invalid-form `id` is condition 17, never
//   condition 1), no 14.16 (a spread attribute is an attribute form of a
//   permitted section element, not an invalid construct), no 14.2/14.3
//   (`cov` and `ok` are unique and structurally conformant).
// - Per-node interpreted data ride the same tree compare, each datum
//   observed in every legitimate state (the full definedness matrix is
//   T11.2-2's home; this test carries each state once): identity — plain
//   (`cov`, `ok`, every root) and unavailable (the repeated-`id` bearer
//   spells none); tags — plain default `[]` (`cov`), plain `["solo"]`
//   (`ok`), the roots' stated `null`, and unavailable (the valueless
//   `tags`); coverage — plain default `"required"` (the five-attribute tag:
//   `coverage` is absent there, and an absent prop defines the default
//   whatever OTHER attributes the tag spells, SPEC 11.2), plain `"none"`
//   (`ok`), the roots' stated `null`, and unavailable (the braced
//   `coverage={"none"}` — quoted-static form required, 2.7).
// - specs/clean.mdx is finding-free (`<S id="ok" tags="solo"
//   coverage="none">`); the second invocation names it as a `<file>`
//   operand and asserts SPEC 11.4's root sentence sharply: a root's `tags`
//   and `coverage` are structurally absent — the stated `null`, never the
//   unavailability marker, NO finding and NO exit-1 consequence — so the
//   finding-free domain exits 0 with them `null` (a product reading the
//   structural absence as unavailability owes exit 1 per 11.2's
//   any-unavailable-datum rule and fails the exit compare; the bare
//   invocation exits 1 for the matrix file's findings and markers).
//
// T11.4-4 — imports (SPEC 11.4, 11.2, 2.1). One workspace, two files, one
// bare `view`, the imports member asserted as ONE exact list:
//
// - specs/imports.mdx opens with the six-declaration matrix, one declaration
//   per line at the very start of the file (the §2.1 staging discipline:
//   each offending statement is its own byte window), composed by the
//   running-offset builder: (1) a VALID single default binding
//   `import BÄSE from "./base.xspec"` — the bound identifier is multi-byte
//   (Ä: 2 bytes), so every later declaration's byte offset diverges from
//   code-point and UTF-16 counts (SPEC 1.7); (2) the side-effect-only, (3)
//   named-only (`{ part }`), and (4) namespace-only (`* as ns`) forms, each
//   with the SAME valid resolving specifier; (5) a valid-form default import
//   of the undiscovered `./typo.xspec`; (6) the bare specifier `base.xspec`
//   — not beginning `./`, so specifier form defines no target even though a
//   suffix-keyed resolver would land on the discovered specs/base.mdx.
// - Every declaration, valid and invalid, is listed with its range (SPEC
//   11.4): the exact six-entry compare fails a product that omits invalid
//   declarations from the listing or misplaces a byte.
// - The binding-name datum is the DEFAULT binding's identifier: plain
//   ("BÄSE", "TYPO", "BARE") where the declaration binds a default —
//   validly or not — and the stated `null`, never the unavailability marker
//   (the form-exact decode rejects a marker name outright), for the three
//   no-default forms; `part` and `ns` are named-clause and namespace
//   identifiers, never this datum (a product reporting either fails the
//   `null` compare).
// - The resolved-target datum turns on specifier form and discovery ALONE,
//   never on binding validity: the three invalid binding forms still carry
//   the plain target "specs/base.mdx" (name `null` beside a defined target
//   — the sharp cross-product cell against a product that marks every
//   datum of an invalid import unavailable), while `./typo.xspec`
//   (discovery defines none) and the bare specifier (form defines none)
//   each carry `{"unavailable": true}` literally — never `null` (the
//   decode rejects a `null` target outright).
// - Findings: exactly five 14.15 — one per invalid declaration, nothing
//   else (staging integrity rides the answer itself; no gate-reference
//   `build` — certification note below) — each located within its own
//   declaration's end-widened byte window in specs/imports.mdx (equal
//   codes order by locations, SPEC 12.7, so array position pins which
//   finding is which); any finding or explicitly-unavailable datum means
//   exit 1 with the full answer still emitted (SPEC 11.2).
// - specs/base.mdx (the import target: prose-only, finding-free) is viewed
//   too: imports/occurrences/comments `[]`, both files' root-only trees
//   byte-asserted, the roots' stated-null tags/coverage riding the decode.
//
// T11.4-5 — `--text` and the expansion domain (SPEC 11.4, 11.2, 1.6, 3,
// 12.0). Four workspaces, each staged failing on purpose and pinned by a
// `build --json` gate (T11.4-5 is NOT in CONF-AVAIL scope — certification
// note below — so the gate-reference build is free), then observed through
// operand-requested views:
//
// - The chain (A → B → C, X beyond the boundary): A imports B and embeds
//   B#b; B holds its own unresolved `d={"ghost"}` (14.5) and embeds C#c; C
//   imports X and holds the boundary spelling `{text(X.dup)}` — X spells
//   `dup` twice, every bearer undefined (SPEC 11.2), so the reference
//   records no occurrence (14.6) and X is NEVER consulted: the consulted
//   domain is the requested files plus exactly the files of resolved
//   targets reachable through occurrence-RECORDING embeddings (SPEC 11.4).
//   `view specs/A.mdx --text`: the domain is {A, B, C} — exactly B's 14.5
//   and C's 14.6 accompany (deep findings in consulted files never
//   requested) while X's 14.3, proven staged by the gate, accompanies
//   NOTHING (a product picking a winner among duplicate bearers, or
//   consulting import targets rather than resolved-embedding targets,
//   carries it and fails the exact multiset); A's view alone is served —
//   alpha poisoned (the boundary lies two hops down), the embedding-free
//   sibling and the root's own text defined and byte-exact per the rules of
//   3. Without `--text`, the same request consults A alone: findings `[]`,
//   exit 0 — A itself is finding-free, so the exit follows A's own findings
//   while B/C/X stay failing (a product consulting embedded targets without
//   `--text`, or reporting whole-workspace findings, fails both compares).
// - The cycle: entry.mdx embeds loop.mdx#l1, whose `{text("l1")}` re-enters
//   itself — the length-one embedding cycle (SPEC 5.3, 14.9), one finding,
//   one location: the participating container in loop.mdx. `view
//   specs/entry.mdx --text`: the cycle participant is consulted — the
//   entry's embedding resolves and records, whether or not any expansion
//   completes (SPEC 11.4) — so the 14.9 accompanies from a consulted file
//   never requested; start and the root's subtree text are poisoned, the
//   root's own text defined.
// - The masked file: main.mdx imports gone.xspec (valid — discovery, not
//   parseability, defines designation, SPEC 2.1) and embeds GONE.g, but
//   gone.mdx is unparseable (14.20): a masked file's sections spell no
//   defined identity, so the spelling records NO occurrence (main's
//   occurrence list is `[]`) and gone is never consulted by expansion —
//   `view specs/main.mdx --text` carries exactly main's own 14.6 (located
//   exactly at the braced container), never the 14.20. Requesting gone too
//   (`view specs/main.mdx specs/gone.mdx --text`) attaches the 14.20 — its
//   parse-failure finding accompanies only when itself requested — and gone
//   still contributes NO view: the views list stays [main]. The import
//   entry's target is the plain "specs/gone.mdx" both times.
// - The invalid path: `specs/vi#ew.mdx` is discovered and parseable; a bare
//   `<file>` operand is a whole path with no delimiter role for `#` (SPEC
//   12.0), so requesting it serves its full view: every identity — root
//   included — explicitly unavailable (no identity over an invalid path,
//   SPEC 11.2) while its text values are plain and byte-exact (expansion
//   definedness turns on occurrence-recording spellings alone — the file
//   holds none — never on identity definedness), the 14.19 accompanying
//   with no locations and the file as concerned path, exit 1.
//
// Certification (CERTIFICATIONS.md CONF-AVAIL): T11.4-1, T11.4-3, and
// T11.4-4 are IN scope (the fixture family lands with the
// certification-manifest task), so those bodies obey the scope's staging
// constraints exactly: spec-only workspaces of `.mdx` sources at valid-UTF-8
// `#`-free paths, imports as the fixtures stage them; every command driven
// is drawn from the enumerated surface — T11.4-1's and T11.4-4's bare
// whole-domain `view`s, T11.4-3's bare `view` plus one `<file>`-operand
// `view`, never `occurrences` or `at` — with NO gate-reference `build` (each
// answer's own findings member is the staging integrity) and NO snapshot
// compare (graph-data and refresh behavior are expressly out of CONF-AVAIL
// scope), and every staged condition drawn from the scope's stated set
// (T11.4-3 stages 14.17 alone; T11.4-4 stages 14.15 alone). T11.4-1's fixtures stage NO undefined datum — every
// node identity defined under 11.2's chain conditions, the invalid-element
// arm keeping every spelled identity defined — so its answers carry the
// unavailability marker nowhere: the marker-free ground
// VIOL-AVAIL-NULLMARKER's passing side stands on (nothing undefined, so the
// deviation touches nothing), while the stated `null`s the answers DO carry
// (each root's `tags`/`coverage`; `closing` on self-closing sections;
// `opening`/`closing` on roots) make the decode fail under VIOL-AVAIL-OMIT
// exactly as certified (`null` is never omission — decodeViewReport rejects
// the absent members). T11.4-3 is the per-node unavailability carrier the
// document names: under VIOL-AVAIL-NULLMARKER its identity, tags, and
// coverage unavailability arms read `null` where the test asserts the
// marker literally (a `null` identity fails the form-exact decode outright;
// `null` tags/coverage fail the tree compare against the expected marker);
// under VIOL-AVAIL-OMIT every stated-`null` member its answers carry (each
// root's `tags`/`coverage`, every finding's `null` path, the spread entry's
// `null` name) is absent and the decode rejects the omission, the exit-0
// operand arm asserting the root distinction directly; under
// VIOL-AVAIL-NOFILE it passes untouched — T11.4-3 drives `view` alone.
// T11.4-4 is the import-datum carrier VIOL-AVAIL-NULLMARKER's entry names:
// its two unresolved import targets (`./typo.xspec`, the bare specifier)
// read `null` under that deviation where the form-exact decode admits only
// a path value or the marker, so the decode itself rejects the answer;
// under VIOL-AVAIL-OMIT every stated-`null` member its answer carries (each
// root's `tags`/`coverage`, every finding's `null` path, the three
// no-default declarations' `null` name) is absent and the decode rejects
// the omission; under VIOL-AVAIL-NOFILE it passes untouched — T11.4-4
// drives `view` alone.
// T11.4-2 and T11.4-5 are NOT in scope: CERTIFICATIONS.md's Exclusions name
// the argument, spelling, and domain-and-exit matrices of the
// machine-interface surfaces (T11.2-5, T11.3-2/3, T11.4-2, T11.5-2) and
// T11.4-5's consultation-domain negatives — certified representatively
// through the shared machinery — so unlike their siblings they are free to
// drive the gate-reference `build` and the snapshot compare.

import { Buffer } from "node:buffer";
import type {
  Finding,
  OccurrenceRecord,
  SourceRange,
  ViewAttributeEntry,
  ViewImportEntry,
  ViewNode,
} from "../../helpers/adapters/index.js";
import { decodeViewReport } from "../../helpers/adapters/index.js";
import { fail, parseJsonStdout } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  expectAvailabilityUsageError,
  SPEC_AND_CODE_CONFIG,
  SPECS_ONLY_CONFIG,
} from "./section-11.2.js";
import {
  assertConditionCounts,
  assertFindingLocated,
  assertSameJson,
  buildFindings,
  expectExit,
  runJson,
} from "./support.js";

/**
 * Running byte-offset fixture assembler (the T5.7-2/T11.2-1 discipline):
 * `add` appends a segment and returns its byte range, and `attr` an
 * attribute segment as the expected `{name, range, text}` view entry (SPEC
 * 11.4: the source text is the attribute's own characters, so entry text =
 * segment), so every expected offset is composed from the same parts the
 * staged file is.
 */
class ByteFixture {
  private readonly parts: string[] = [];
  private bytes = 0;

  get pos(): number {
    return this.bytes;
  }

  get source(): string {
    return this.parts.join("");
  }

  add(segment: string): SourceRange {
    const start = this.bytes;
    this.parts.push(segment);
    this.bytes += Buffer.byteLength(segment, "utf8");
    return { start, end: this.bytes };
  }

  attr(name: string | null, text: string): ViewAttributeEntry {
    return { name, range: this.add(text), text };
  }
}

/** The 12.7 unavailability marker, as decoded (one-datum state). */
const UNAVAILABLE = { unavailable: true } as const;

/**
 * Fixture self-check (harness-side, before any product invocation): a
 * claimed byte range must slice the staged file's bytes to exactly the span
 * it claims. A failure here is a staging-arithmetic defect of the harness,
 * never a product failure.
 */
function sliceCheck(
  source: string,
  range: SourceRange,
  span: string,
  what: string,
): void {
  const actual = Buffer.from(source, "utf8")
    .subarray(range.start, range.end)
    .toString("utf8");
  if (actual !== span) {
    fail(
      `§11.4 fixture self-check — ${what}: the claimed byte range ` +
        `[${String(range.start)}, ${String(range.end)}) slices the staged ` +
        `bytes to ${JSON.stringify(actual)}, expected ` +
        `${JSON.stringify(span)} (a harness-side staging error, not a ` +
        `product failure)`,
    );
  }
}

// --- specs/Zebra.mdx — the decomposition ground (finding-free) ----------------
//
// Paired sections at three depths (top ⊃ top.one ⊃ top.one.deep's
// self-closing sibling shape below), a self-closing leaf at depth three
// (top.one.deep) and one at depth two (top.two), a second top-level section
// (side), and prose before, between, and after constructs. The multi-byte
// prefix (é: 2 bytes; è: 2 bytes; —: 3 bytes) shifts every later offset, so
// byte offsets diverge from code-point and UTF-16 counts (SPEC 1.7).

const ZEBRA_FILE = "specs/Zebra.mdx";

const Z = new ByteFixture();
Z.add("Prélude — Zèbre guard prose.\n\n");
const Z_TOP_OPEN = Z.add('<S id="top">');
Z.add("\nTop own text before.\n\n");
const Z_ONE_OPEN = Z.add('<S id="top.one">');
Z.add("\nOne text.\n\n");
const Z_DEEP_TAG = '<S id="top.one.deep" />';
const Z_DEEP_RANGE = Z.add(Z_DEEP_TAG);
Z.add("\nOne tail.\n");
const Z_ONE_CLOSE = Z.add("</S>");
const Z_ONE_RANGE: SourceRange = { start: Z_ONE_OPEN.start, end: Z.pos };
Z.add("\n\nBetween the children.\n\n");
const Z_TWO_TAG = '<S id="top.two" />';
const Z_TWO_RANGE = Z.add(Z_TWO_TAG);
Z.add("\nTop own text after.\n");
const Z_TOP_CLOSE = Z.add("</S>");
const Z_TOP_RANGE: SourceRange = { start: Z_TOP_OPEN.start, end: Z.pos };
Z.add("\n\n");
const Z_SIDE_OPEN = Z.add('<S id="side">');
Z.add("\nSide text.\n");
const Z_SIDE_CLOSE = Z.add("</S>");
const Z_SIDE_RANGE: SourceRange = { start: Z_SIDE_OPEN.start, end: Z.pos };
Z.add("\n");
const ZEBRA_SOURCE = Z.source;
const Z_ROOT_RANGE: SourceRange = { start: 0, end: Z.pos };

// --- specs/alpha.mdx — invalid-element parenting (two 14.16s) -----------------
//
// `wrap.mid.inner` sits inside a `<div>` inside `wrap.mid` inside `wrap`:
// its positional parent is the INNERMOST enclosing section construct,
// `wrap.mid`. `free` sits inside a top-level `<em>`: no section encloses it,
// so it parents to the root and its one-segment ID is checked against the
// empty prefix. Every spelled identity is well-formed, conformant against
// its positional parent, and unique, so the file's only findings are the two
// invalid elements' 14.16s — each element's WHOLE construct recorded as the
// byte window its finding's locations must fall within (located-range
// precision is T11.4-6/T14-8's business).

const ALPHA_FILE = "specs/alpha.mdx";

const AL = new ByteFixture();
AL.add("Alpha prose — enclosure guard.\n\n");
const AL_WRAP_OPEN = AL.add('<S id="wrap">');
AL.add("\nWrap own text.\n\n");
const AL_MID_OPEN = AL.add('<S id="wrap.mid">');
AL.add("\nMid text.\n");
const AL_DIV_START = AL.pos;
AL.add("<div>\n");
const AL_INNER_OPEN = AL.add('<S id="wrap.mid.inner">');
AL.add("\nInner text.\n");
const AL_INNER_CLOSE = AL.add("</S>");
const AL_INNER_RANGE: SourceRange = { start: AL_INNER_OPEN.start, end: AL.pos };
AL.add("\n</div>");
const AL_DIV_WINDOW: SourceRange = { start: AL_DIV_START, end: AL.pos };
AL.add("\n");
const AL_MID_CLOSE = AL.add("</S>");
const AL_MID_RANGE: SourceRange = { start: AL_MID_OPEN.start, end: AL.pos };
AL.add("\n");
const AL_WRAP_CLOSE = AL.add("</S>");
const AL_WRAP_RANGE: SourceRange = { start: AL_WRAP_OPEN.start, end: AL.pos };
AL.add("\n\n");
const AL_EM_START = AL.pos;
AL.add("<em>\n");
const AL_FREE_TAG = '<S id="free" />';
const AL_FREE_RANGE = AL.add(AL_FREE_TAG);
AL.add("\n</em>");
const AL_EM_WINDOW: SourceRange = { start: AL_EM_START, end: AL.pos };
AL.add("\n");
const ALPHA_SOURCE = AL.source;
const AL_ROOT_RANGE: SourceRange = { start: 0, end: AL.pos };

// --- specs/sub/leaf.mdx — a section-less file (root-only view) ----------------

const LEAF_FILE = "specs/sub/leaf.mdx";
const LEAF_SOURCE = "Only prose in this file — no section at all.\n";
const LEAF_ROOT_RANGE: SourceRange = {
  start: 0,
  end: Buffer.byteLength(LEAF_SOURCE, "utf8"),
};

// --- expected trees -----------------------------------------------------------

/**
 * The projection T11.4-1 pins per node (its named clauses): the identity
 * datum, the construct range (1.7), the range's decomposition — opening and
 * closing tag ranges, `null` where none exists — and the children in
 * document order. Raw attribute entries and interpreted tags/coverage stay
 * outside (T11.2-1 and T11.4-3 pin those); the form-exact decode has already
 * validated their presence and forms.
 */
interface TreeShape {
  readonly identity: string | { readonly unavailable: true };
  readonly range: SourceRange;
  readonly opening: SourceRange | null;
  readonly closing: SourceRange | null;
  readonly children: readonly TreeShape[];
}

function projectShape(node: ViewNode): TreeShape {
  return {
    identity: node.identity,
    range: node.range,
    opening: node.opening,
    closing: node.closing,
    children: node.children.map(projectShape),
  };
}

const ZEBRA_TREE: TreeShape = {
  identity: ZEBRA_FILE,
  range: Z_ROOT_RANGE,
  opening: null,
  closing: null,
  children: [
    {
      identity: `${ZEBRA_FILE}#top`,
      range: Z_TOP_RANGE,
      opening: Z_TOP_OPEN,
      closing: Z_TOP_CLOSE,
      children: [
        {
          identity: `${ZEBRA_FILE}#top.one`,
          range: Z_ONE_RANGE,
          opening: Z_ONE_OPEN,
          closing: Z_ONE_CLOSE,
          children: [
            {
              identity: `${ZEBRA_FILE}#top.one.deep`,
              range: Z_DEEP_RANGE,
              opening: Z_DEEP_RANGE,
              closing: null,
              children: [],
            },
          ],
        },
        {
          identity: `${ZEBRA_FILE}#top.two`,
          range: Z_TWO_RANGE,
          opening: Z_TWO_RANGE,
          closing: null,
          children: [],
        },
      ],
    },
    {
      identity: `${ZEBRA_FILE}#side`,
      range: Z_SIDE_RANGE,
      opening: Z_SIDE_OPEN,
      closing: Z_SIDE_CLOSE,
      children: [],
    },
  ],
};

const ALPHA_TREE: TreeShape = {
  identity: ALPHA_FILE,
  range: AL_ROOT_RANGE,
  opening: null,
  closing: null,
  children: [
    {
      identity: `${ALPHA_FILE}#wrap`,
      range: AL_WRAP_RANGE,
      opening: AL_WRAP_OPEN,
      closing: AL_WRAP_CLOSE,
      children: [
        {
          identity: `${ALPHA_FILE}#wrap.mid`,
          range: AL_MID_RANGE,
          opening: AL_MID_OPEN,
          closing: AL_MID_CLOSE,
          children: [
            {
              identity: `${ALPHA_FILE}#wrap.mid.inner`,
              range: AL_INNER_RANGE,
              opening: AL_INNER_OPEN,
              closing: AL_INNER_CLOSE,
              children: [],
            },
          ],
        },
      ],
    },
    {
      identity: `${ALPHA_FILE}#free`,
      range: AL_FREE_RANGE,
      opening: AL_FREE_RANGE,
      closing: null,
      children: [],
    },
  ],
};

const LEAF_TREE: TreeShape = {
  identity: LEAF_FILE,
  range: LEAF_ROOT_RANGE,
  opening: null,
  closing: null,
  children: [],
};

const EXPECTED_VIEWS: readonly {
  readonly file: string;
  readonly tree: TreeShape;
}[] = [
  { file: ZEBRA_FILE, tree: ZEBRA_TREE },
  { file: ALPHA_FILE, tree: ALPHA_TREE },
  { file: LEAF_FILE, tree: LEAF_TREE },
];

const T11_4_1 = defineProductTest({
  id: "T11.4-1",
  title:
    "with neither operands nor `--file`, one bare `view` (JSON-only, a single form-exact 12.7 document) serves every discovered spec source — a section-less file included — as per-file views in byte order of workspace-relative path (specs/Zebra.mdx < specs/alpha.mdx < specs/sub/leaf.mdx: 0x5A < 0x61 < 0x73, never a case-folding or locale collation); per file the root and the full positional section tree in document order, each node's construct range and decomposition byte-asserted against precomputed offsets behind a multi-byte prefix (SPEC 1.7): opening and closing tag ranges for paired sections at three depths, opening only — the whole self-closing tag, equal to the construct range — for self-closing sections, neither for the root, whose range is the entire file; a section nested inside an invalid `<div>` parents to the INNERMOST enclosing section construct (`wrap.mid`, never `wrap`, never the root — the enclosure 11.2's chain conditions read, so every staged identity stays a defined plain string) and a section inside a top-level `<em>` parents to the root, the invalid elements getting no view entry, exactly the two 14.16 findings accompanying (no phantom 14.2), each located within its own element's construct window, exit 1 with the full answer (SPEC 11.4, 11.2, 1.7, 12.7, 14)",
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline) — composed-range arithmetic
    // proven against the staged bytes before any product invocation.
    sliceCheck(ZEBRA_SOURCE, Z_TOP_OPEN, '<S id="top">', "top's opening tag");
    sliceCheck(ZEBRA_SOURCE, Z_TOP_CLOSE, "</S>", "top's closing tag");
    sliceCheck(
      ZEBRA_SOURCE,
      Z_ONE_OPEN,
      '<S id="top.one">',
      "top.one's opening tag",
    );
    sliceCheck(ZEBRA_SOURCE, Z_ONE_CLOSE, "</S>", "top.one's closing tag");
    sliceCheck(
      ZEBRA_SOURCE,
      Z_DEEP_RANGE,
      Z_DEEP_TAG,
      "top.one.deep's self-closing tag",
    );
    sliceCheck(
      ZEBRA_SOURCE,
      Z_TWO_RANGE,
      Z_TWO_TAG,
      "top.two's self-closing tag",
    );
    sliceCheck(
      ZEBRA_SOURCE,
      Z_SIDE_OPEN,
      '<S id="side">',
      "side's opening tag",
    );
    sliceCheck(ZEBRA_SOURCE, Z_SIDE_CLOSE, "</S>", "side's closing tag");
    sliceCheck(
      ALPHA_SOURCE,
      AL_DIV_WINDOW,
      '<div>\n<S id="wrap.mid.inner">\nInner text.\n</S>\n</div>',
      "the in-section invalid element's whole construct",
    );
    sliceCheck(
      ALPHA_SOURCE,
      AL_EM_WINDOW,
      '<em>\n<S id="free" />\n</em>',
      "the top-level invalid element's whole construct",
    );
    sliceCheck(
      ALPHA_SOURCE,
      AL_INNER_RANGE,
      '<S id="wrap.mid.inner">\nInner text.\n</S>',
      "wrap.mid.inner's whole construct",
    );
    sliceCheck(ALPHA_SOURCE, AL_FREE_RANGE, AL_FREE_TAG, "free's tag");

    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [ZEBRA_FILE]: ZEBRA_SOURCE,
        [ALPHA_FILE]: ALPHA_SOURCE,
        [LEAF_FILE]: LEAF_SOURCE,
      },
    });
    try {
      // The one invocation (CONF-AVAIL's enumerated surface: no
      // gate-reference `build`, no snapshot compare): the bare whole-domain
      // `view`. The answer carries alpha's two 14.16 findings, so exit 1
      // with the full answer still emitted (SPEC 11.2).
      const context = "T11.4-1 bare `view` (whole domain, no operands)";
      const result = await expectExit(
        product,
        workspace,
        ["view"],
        1,
        `${context} — the answer carries the two staged 14.16 findings, so ` +
          `the invocation exits 1 with the full document still emitted ` +
          `(SPEC 11.2, 11.4)`,
      );
      const report = decodeViewReport(
        parseJsonStdout(
          result,
          `${context} — a single JSON document is the only output form, ` +
            `with or without --json (SPEC 11)`,
        ),
        { text: false },
        context,
      );

      // Staging integrity rides the answer itself (no `build` gate): exactly
      // the two invalid elements' findings — one 14.16 per element, nothing
      // else. A product mis-parenting a nested section reports a phantom
      // 14.2 here; one reading the invalid element as a masking chain member
      // drops nothing observable here but fails the identity compare below.
      assertConditionCounts(
        report.findings,
        { "14.16": 2 },
        `${context}: the consulted domain's findings are exactly the two ` +
          `invalid-element findings — every staged identity is spelled, ` +
          `well-formed, conformant against its positional parent, and ` +
          `unique, so no 14.1/14.2/14.3/14.4 arises (SPEC 11.2, 11.4, 14)`,
      );
      const invalidElementFindings = report.findings.filter(
        (finding) => finding.condition === "14.16",
      );
      // The findings order is decode-enforced (12.7: equal codes order by
      // locations element-wise), and the two elements' windows are disjoint
      // with the `<div>` wholly before the `<em>`, so the array order pins
      // which finding is which.
      assertFindingLocated(
        invalidElementFindings[0]!,
        { file: ALPHA_FILE, window: AL_DIV_WINDOW },
        `${context} — the in-section \`<div>\`'s 14.16 locates within that ` +
          `element's construct in specs/alpha.mdx (SPEC 14, 12.7)`,
      );
      assertFindingLocated(
        invalidElementFindings[1]!,
        { file: ALPHA_FILE, window: AL_EM_WINDOW },
        `${context} — the top-level \`<em>\`'s 14.16 locates within that ` +
          `element's construct in specs/alpha.mdx (SPEC 14, 12.7)`,
      );

      // Whole domain, byte order: exactly the three discovered spec sources,
      // Zebra (0x5A) < alpha (0x61) < sub/leaf (0x73) — completeness (the
      // section-less leaf viewed) and collation in one compare.
      assertSameJson(
        report.views.map((view) => view.file),
        EXPECTED_VIEWS.map((view) => view.file),
        `${context}: every discovered spec source is viewed — the ` +
          `section-less file included — in byte order of ` +
          `workspace-relative path (SPEC 11.4, 12.7)`,
      );

      // Per file: the full positional section tree in document order, each
      // node's construct range and decomposition byte-exact; nothing else is
      // staged, so imports, occurrences, and comments are `[]` (never
      // `null`, SPEC 12.7).
      EXPECTED_VIEWS.forEach((expected, index) => {
        const view = report.views[index]!;
        assertSameJson(
          projectShape(view.root),
          expected.tree,
          `${context} — ${expected.file}: the root and the full positional ` +
            `section tree in document order, per node the construct range ` +
            `and its decomposition against precomputed byte offsets — ` +
            `opening and closing tag ranges for paired sections, opening ` +
            `only for self-closing, neither for the root — and every ` +
            `identity the defined plain string (SPEC 11.4, 11.2, 1.7)`,
        );
        assertSameJson(
          view.imports,
          [],
          `${context} — ${expected.file}: no import is staged, and an ` +
            `empty list is [], never null (SPEC 11.4, 12.7)`,
        );
        assertSameJson(
          view.occurrences,
          [],
          `${context} — ${expected.file}: no reference spelling is staged ` +
            `(SPEC 11.4, 5.7, 12.7)`,
        );
        assertSameJson(
          view.comments,
          [],
          `${context} — ${expected.file}: no MDX comment is staged (SPEC ` +
            `11.4, 12.7)`,
        );
      });
    } finally {
      await workspace.dispose();
    }
  },
});

// --- T11.4-2 — operands vs restriction ----------------------------------------
//
// The matrix ground (failing on purpose; module header): a finding-free spec
// source, a spec source with one 14.3, a discovered code source with one
// 14.8, and an on-disk decoy no configured group discovers.

const OV_DUP_FILE = "specs/dup.mdx";
const OV_DUP_SOURCE = ['<S id="solo">', "Solo text.", "</S>", ""].join("\n");

const OV_BAD_FILE = "specs/bad.mdx";
const OV_BAD_SOURCE = [
  '<S id="twin">',
  "Twin one.",
  "</S>",
  "",
  '<S id="twin">',
  "Twin two.",
  "</S>",
  "",
].join("\n");

const OV_CODE_FILE = "src/app.ts";
const OV_CODE_SOURCE = [
  'import SPEC, { text } from "../specs/dup.xspec";',
  "",
  "export function grab(): void {",
  "  SPEC.solo;",
  "}",
  "",
  "export function bad(): string {",
  '  return text("solo");',
  "}",
  "",
].join("\n");

const OV_DECOY_FILE = "docs/note.mdx";
const OV_DECOY_SOURCE = '<S id="trap">\nUnclosed on purpose.\n';

/** The workspace's complete finding multiset (the `build --json` gate). */
const OV_WORKSPACE_CONDITIONS: Readonly<Record<string, number>> = {
  "14.3": 1,
  "14.8": 1,
};

/**
 * The set arm's identity-level projection: the served view's substance is
 * pinned by node identities alone — the construct ranges, decompositions,
 * attribute entries, and interpreted values are T11.4-1's and T11.4-3's
 * subject (the form-exact decode has already enforced their presence and
 * forms).
 */
interface IdentityShape {
  readonly identity: string | { readonly unavailable: true };
  readonly children: readonly IdentityShape[];
}

function projectIdentities(node: ViewNode): IdentityShape {
  return {
    identity: node.identity,
    children: node.children.map(projectIdentities),
  };
}

const OV_DUP_IDENTITY_TREE: IdentityShape = {
  identity: OV_DUP_FILE,
  children: [{ identity: `${OV_DUP_FILE}#solo`, children: [] }],
};

const T11_4_2 = defineProductTest({
  id: "T11.4-2",
  title:
    '`<file>` operands assert membership in the DISCOVERED spec-source domain while `--file` is a set restriction over it: an undiscovered operand — a file existing nowhere, and an on-disk `docs/note.mdx` no configured group discovers — exits 2 as an unknown file, and a discovered code source exits 2 as a wrong-kind operand (12.0), its own staged 14.8 notwithstanding — the argument checks precede answering — each with the single 12.7 error document; the SAME `src/app.ts` spelling as a `--file` value instead admits the empty set — a glob matching only code sources, one matching the undiscovered on-disk decoy, and one matching nothing at all each answer `{"findings": [], "views": []}`, exit 0, no unknown-file usage error on this filter, whatever findings the workspace carries; combining `<file>` operands with `--file`, each part individually valid, exits 2; and the requested files form a set — the discovered `specs/dup.mdx` named twice yields ONE view, its finding-free domain exiting 0 with the root and section identities served while the rest of the workspace stays failing, no invocation of the sweep modifying anything (SPEC 11.4, 11.2, 12.0, 12.7, 7)',
  run: async (product) => {
    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPEC_AND_CODE_CONFIG,
        [OV_DUP_FILE]: OV_DUP_SOURCE,
        [OV_BAD_FILE]: OV_BAD_SOURCE,
        [OV_CODE_FILE]: OV_CODE_SOURCE,
        [OV_DECOY_FILE]: OV_DECOY_SOURCE,
      },
    });
    try {
      await assertLeavesUnchanged(
        workspace.root,
        async () => {
          // Gate reference and staging integrity (SPEC 12.1, 14): exactly
          // one 14.3 in bad.mdx and one 14.8 in the discovered code source,
          // nothing else — dup.mdx is finding-free and the decoy is in no
          // configured group, contributing nothing (SPEC 7: discovery is
          // controlled exclusively by configuration). Every domain-and-exit
          // assertion below reads on this staged ground.
          const gateContext =
            "T11.4-2 `build --json` (staging integrity: one 14.3 in " +
            "specs/bad.mdx, one 14.8 in src/app.ts; specs/dup.mdx " +
            "finding-free; the undiscovered docs/note.mdx contributes " +
            "nothing)";
          const gateFindings = await buildFindings(
            product,
            workspace,
            gateContext,
          );
          assertConditionCounts(
            gateFindings,
            OV_WORKSPACE_CONDITIONS,
            `${gateContext} — exactly the staged conditions (SPEC 14)`,
          );
          assertFindingLocated(
            gateFindings.find((finding) => finding.condition === "14.3")!,
            { file: OV_BAD_FILE },
            `${gateContext} — the duplicate \`twin\` pair locates every ` +
              `bearer, both in specs/bad.mdx (SPEC 14)`,
          );
          assertFindingLocated(
            gateFindings.find((finding) => finding.condition === "14.8")!,
            { file: OV_CODE_FILE },
            `${gateContext} — the string-form \`text("solo")\` call ` +
              `locates in the code source (SPEC 4.3, 14)`,
          );

          // --- `<file>` operands assert membership (SPEC 11.4, 12.0): an
          // undiscovered file is unknown — whether it exists nowhere or
          // sits on disk outside every configured group (a product
          // resolving operands against the filesystem accepts the decoy
          // and answers, or surfaces its 14.20, instead of erring) — and a
          // discovered code source is a wrong-kind operand, each exit 2
          // with the single 12.7 error document, the checks preceding
          // answering whatever findings the workspace or the named file
          // carries (SPEC 11.2, T11.2-5's protocol).
          await expectAvailabilityUsageError(
            product,
            workspace,
            ["view", "specs/Nope.mdx"],
            "T11.4-2 unknown `<file>` operand (a file existing nowhere) " +
              "on the failing workspace",
          );
          await expectAvailabilityUsageError(
            product,
            workspace,
            ["view", OV_DECOY_FILE],
            "T11.4-2 unknown `<file>` operand (docs/note.mdx exists on " +
              "disk but no configured group discovers it — membership is " +
              "in the DISCOVERED set, SPEC 7) on the failing workspace",
          );
          await expectAvailabilityUsageError(
            product,
            workspace,
            ["view", OV_CODE_FILE],
            "T11.4-2 wrong-kind `<file>` operand (src/app.ts is a " +
              "discovered CODE source, which has no structural view — " +
              "SPEC 11.4, 12.0), its own staged 14.8 notwithstanding: the " +
              "argument checks precede answering, never exit 1 with the " +
              "file's findings",
          );

          // --- `--file` restricts the domain (SPEC 11.4): a glob
          // admitting no discovered SPEC source admits the empty set — an
          // empty, finding-free answer, exit 0, no unknown-file usage
          // error on this filter, whatever findings the workspace
          // carries. The `src/app.ts` arm is the operand-vs-restriction
          // contrast in one spelling — the path that just erred as an
          // operand — and the sharp half of "only code sources": a
          // product reusing 11.3's spec-and-code-alike filter consults
          // the code file, carries its staged 14.8, and exits 1.
          for (const [glob, what] of [
            [
              "docs/*.mdx",
              "matching the on-disk but UNDISCOVERED docs/note.mdx — a " +
                "product globbing the filesystem consults the unparseable " +
                "decoy and answers nonempty",
            ],
            ["nosuch/**/*.mdx", "matching nothing at all"],
            [
              OV_CODE_FILE,
              "matching only a discovered CODE source — the restriction " +
                "admits the discovered SPEC sources it matches (SPEC " +
                "11.4), so the finding-laden src/app.ts is never " +
                "consulted, unlike 11.3's spec-and-code-alike filter",
            ],
          ] as const) {
            const context = `T11.4-2 \`view --file "${glob}"\` (${what})`;
            const report = decodeViewReport(
              await runJson(
                product,
                workspace,
                ["view", "--file", glob],
                `${context} — the glob admits the empty set: an empty, ` +
                  `finding-free answer exits 0, and no unknown-file usage ` +
                  `error exists on this filter, whatever findings the ` +
                  `workspace carries (SPEC 11.4, 11.2)`,
              ),
              { text: false },
              context,
            );
            assertSameJson(
              report.findings,
              [],
              `${context}: an empty consulted domain has no findings — ` +
                `the workspace's staged 14.3/14.8 are no domain file's ` +
                `findings here (SPEC 11.2, 11.4)`,
            );
            assertSameJson(
              report.views,
              [],
              `${context}: the empty set of views — an empty list is [], ` +
                `never null (SPEC 11.4, 12.7)`,
            );
          }

          // --- Combining `<file>` operands with `--file` is a usage
          // error, exit 2 (SPEC 11.4) — each part individually valid (the
          // operand is a discovered spec source; the glob matches
          // discovered spec sources), so an intersecting or union product
          // answers with views instead of erring.
          await expectAvailabilityUsageError(
            product,
            workspace,
            ["view", OV_DUP_FILE, "--file", "specs/*.mdx"],
            "T11.4-2 combining a `<file>` operand with `--file` (each " +
              "part individually valid — the combination itself is the " +
              "usage error, SPEC 11.4)",
          );

          // --- The requested files form a set (SPEC 11.4): a file named
          // twice yields one view. The decode besides rejects a
          // duplicated per-file entry (views strictly ascending by path
          // bytes). Domain {dup} is finding-free, so exit 0 with an empty
          // findings member while bad.mdx and the code source stay
          // failing — the domain is the requested files (T11.2-5's
          // ground, riding as this arm's positive control that the
          // workspace serves views at all: the empty answers above are
          // the filter's doing, not a product serving nothing).
          {
            const context =
              "T11.4-2 `view specs/dup.mdx specs/dup.mdx` (a discovered " +
              "file named twice)";
            const report = decodeViewReport(
              await runJson(
                product,
                workspace,
                ["view", OV_DUP_FILE, OV_DUP_FILE],
                `${context} — the requested files form a set with the ` +
                  `finding-free domain {specs/dup.mdx}, so exit 0 with ` +
                  `the full answer (SPEC 11.4, 11.2)`,
              ),
              { text: false },
              context,
            );
            assertSameJson(
              report.findings,
              [],
              `${context}: the domain's one file is finding-free — ` +
                `bad.mdx's 14.3 and the code source's 14.8 are no domain ` +
                `file's findings (SPEC 11.2, 11.4)`,
            );
            assertSameJson(
              report.views.map((view) => view.file),
              [OV_DUP_FILE],
              `${context}: ONE view — a file named twice yields one ` +
                `(SPEC 11.4)`,
            );
            assertSameJson(
              projectIdentities(report.views[0]!.root),
              OV_DUP_IDENTITY_TREE,
              `${context}: the served view is genuinely the named ` +
                `file's — the root and its one section, each identity ` +
                `the defined plain string (SPEC 11.4, 11.2, 1.5)`,
            );
          }
        },
        "T11.4-2 — no invocation of the sweep modifies anything: the gate " +
          "build fails writing nothing (SPEC 12.1) and on a failing " +
          "workspace these surfaces answer from current sources and write " +
          "nothing (SPEC 11.2; the no-write contract clauses live at " +
          "T11.2-1/T11.2-6)",
      );
    } finally {
      await workspace.dispose();
    }
  },
});

// --- T11.4-3 — attributes and per-node data -----------------------------------
//
// The staging ground (module header): specs/attrs.mdx carries the raw
// attribute matrix — the five-attribute tag and the braced-coverage tag,
// exactly five 14.17 — while specs/clean.mdx is finding-free with all three
// interpreted data plain. The multi-byte prose prefixes shift every later
// offset (SPEC 1.7: byte offsets, not code points or UTF-16 units).

const ATTRS_FILE = "specs/attrs.mdx";

const AT = new ByteFixture();
AT.add("Prélude — matrice d'attributs.\n\n");
const AT_DUP_START = AT.pos;
AT.add("<S ");
const AT_DUP_ID1 = AT.attr("id", 'id="dup"');
AT.add(" ");
const AT_DUP_ID2 = AT.attr("id", 'id="dup"');
AT.add(" ");
const AT_NOTE = AT.attr("note", 'note="mystery"');
AT.add(" ");
// The spread attribute (SPEC 2.7): `name` is structurally absent — the
// stated null — and the source text is its entire braced construct.
const AT_SPREAD = AT.attr(null, "{...extras}");
AT.add(" ");
const AT_TAGS = AT.attr("tags", "tags");
AT.add(">\nDup text.\n</S>");
const AT_DUP_RANGE: SourceRange = { start: AT_DUP_START, end: AT.pos };
AT.add("\n\n");
const AT_COV_START = AT.pos;
AT.add("<S ");
const AT_COV_ID = AT.attr("id", 'id="cov"');
AT.add(" ");
const AT_COV_COVERAGE = AT.attr("coverage", 'coverage={"none"}');
AT.add(">\nCov text.\n</S>");
const AT_COV_RANGE: SourceRange = { start: AT_COV_START, end: AT.pos };
AT.add("\n");
const ATTRS_SOURCE = AT.source;
const ATTRS_ROOT_RANGE: SourceRange = { start: 0, end: AT.pos };

const CLEAN_FILE = "specs/clean.mdx";

const CN = new ByteFixture();
CN.add("Épilogue — sol sans finding.\n\n");
const CN_OK_START = CN.pos;
CN.add("<S ");
const CN_OK_ID = CN.attr("id", 'id="ok"');
CN.add(" ");
const CN_OK_TAGS = CN.attr("tags", 'tags="solo"');
CN.add(" ");
const CN_OK_COVERAGE = CN.attr("coverage", 'coverage="none"');
CN.add(">\nOk text.\n</S>");
const CN_OK_RANGE: SourceRange = { start: CN_OK_START, end: CN.pos };
CN.add("\n");
const CLEAN_SOURCE = CN.source;
const CLEAN_ROOT_RANGE: SourceRange = { start: 0, end: CN.pos };

/**
 * The answer's exact accompanying findings (SPEC 11.2, 14) — doubling as
 * staging integrity (no `build` gate reference: CONF-AVAIL surface
 * constraint, module header). One 14.17 per afflicted prop name per element
 * (SPEC 2.7; T11.2-2's counting precedent): the repeated `id`, the unknown
 * prop, the spread attribute, the valueless `tags`, the braced `coverage` —
 * and nothing else (no 14.1, no 14.16, no 14.2/14.3; module header).
 */
const ATTRS_CONDITION_COUNTS: Readonly<Record<string, number>> = {
  "14.17": 5,
};

/**
 * T11.4-3's projection: the identity datum, the construct range, the raw
 * attribute entries (`{name, range, text}` — this test's own subject), and
 * the interpreted `tags`/`coverage` datums, per node. Tag-range
 * decompositions stay outside (T11.4-1 byte-asserts them; the form-exact
 * decode has already validated their presence and forms).
 */
interface AttributeDataShape {
  readonly identity: ViewNode["identity"];
  readonly range: SourceRange;
  readonly attributes: readonly ViewAttributeEntry[];
  readonly tags: ViewNode["tags"];
  readonly coverage: ViewNode["coverage"];
  readonly children: readonly AttributeDataShape[];
}

function projectAttributeData(node: ViewNode): AttributeDataShape {
  return {
    identity: node.identity,
    range: node.range,
    attributes: node.attributes.map((entry) => ({
      name: entry.name,
      range: entry.range,
      text: entry.text,
    })),
    tags: node.tags,
    coverage: node.coverage,
    children: node.children.map(projectAttributeData),
  };
}

// The complete expected trees (document order). Each root: identity defined
// (the path is valid), attributes [], tags/coverage the stated
// structural-absence null (SPEC 11.4, 12.7) — never the marker.
const ATTRS_TREE: AttributeDataShape = {
  identity: ATTRS_FILE,
  range: ATTRS_ROOT_RANGE,
  attributes: [],
  tags: null,
  coverage: null,
  children: [
    {
      // Repeated `id` spells no identity (SPEC 11.2) — explicitly
      // unavailable, never a picked value; BOTH raw entries listed in tag
      // order. `coverage` is absent on this tag, so its interpreted value
      // is the plain default "required" (an absent prop defines the
      // default whatever other attributes the tag spells), while the
      // valueless `tags` leaves the interpreted tags unavailable.
      identity: UNAVAILABLE,
      range: AT_DUP_RANGE,
      attributes: [AT_DUP_ID1, AT_DUP_ID2, AT_NOTE, AT_SPREAD, AT_TAGS],
      tags: UNAVAILABLE,
      coverage: "required",
      children: [],
    },
    {
      // The braced `coverage={"none"}` is not quoted-static form (SPEC
      // 2.7): interpreted coverage unavailable — never the braced value
      // read through — while the identity stays defined (tags/coverage
      // invalidity never undefines identity) and absent `tags` defines
      // the plain default [].
      identity: `${ATTRS_FILE}#cov`,
      range: AT_COV_RANGE,
      attributes: [AT_COV_ID, AT_COV_COVERAGE],
      tags: [],
      coverage: UNAVAILABLE,
      children: [],
    },
  ],
};

const CLEAN_TREE: AttributeDataShape = {
  identity: CLEAN_FILE,
  range: CLEAN_ROOT_RANGE,
  attributes: [],
  tags: null,
  coverage: null,
  children: [
    {
      identity: `${CLEAN_FILE}#ok`,
      range: CN_OK_RANGE,
      attributes: [CN_OK_ID, CN_OK_TAGS, CN_OK_COVERAGE],
      tags: ["solo"],
      coverage: "none",
      children: [],
    },
  ],
};

const T11_4_3 = defineProductTest({
  id: "T11.4-3",
  title:
    'raw attribute spellings as parsed, one entry per spelled attribute in tag order on the five-attribute tag `<S id="dup" id="dup" note="mystery" {...extras} tags>` — a repeated `id` (BOTH entries), an unknown prop, a spread attribute (its `name` structurally absent — the stated `null` — its source text the whole braced construct), a valueless bare-name `tags` — each entry\'s name, range, and source text byte-asserted against precomputed offsets behind a multi-byte prefix; inclusion is by form: every invalid form stays a listed entry, its invalidity a located finding beside the view, never a view omission — exactly five 14.17 (those four plus a braced `coverage={"none"}` on a second section), each located in the matrix file; per-node `identity`, `tags`, `coverage` each plain or explicitly unavailable per T11.2-2, every state carried once (identity unavailable on the repeated-`id` bearer; tags unavailable on the valueless `tags` beside its absent-prop default coverage "required"; coverage unavailable on the braced value beside its defined identity and default empty tags; all three plain in the sibling file); a root\'s `tags` and `coverage` are structurally absent — the stated `null`, never the unavailability marker, no finding and no exit-1 consequence: the finding-free specs/clean.mdx named as a `<file>` operand exits 0 with them `null`, the bare whole-domain view exiting 1 for the matrix file\'s findings and markers (SPEC 11.4, 11.2, 2.7, 12.7, 14; CERTIFICATIONS.md CONF-AVAIL in scope)',
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline) — composed-range arithmetic
    // proven against the staged bytes before any product invocation.
    for (const [entry, what] of [
      [AT_DUP_ID1, "the first repeated id spelling"],
      [AT_DUP_ID2, "the second repeated id spelling"],
      [AT_NOTE, "the unknown prop"],
      [AT_SPREAD, "the spread attribute's whole braced construct"],
      [AT_TAGS, "the valueless tags prop"],
      [AT_COV_ID, "the cov id"],
      [AT_COV_COVERAGE, "the braced coverage"],
    ] as const) {
      sliceCheck(ATTRS_SOURCE, entry.range, entry.text, what);
    }
    sliceCheck(
      ATTRS_SOURCE,
      AT_DUP_RANGE,
      '<S id="dup" id="dup" note="mystery" {...extras} tags>\nDup text.\n</S>',
      "the five-attribute construct",
    );
    sliceCheck(
      ATTRS_SOURCE,
      AT_COV_RANGE,
      '<S id="cov" coverage={"none"}>\nCov text.\n</S>',
      "the braced-coverage construct",
    );
    sliceCheck(ATTRS_SOURCE, ATTRS_ROOT_RANGE, ATTRS_SOURCE, "the matrix file");
    for (const [entry, what] of [
      [CN_OK_ID, "the ok id"],
      [CN_OK_TAGS, "the ok tags"],
      [CN_OK_COVERAGE, "the ok coverage"],
    ] as const) {
      sliceCheck(CLEAN_SOURCE, entry.range, entry.text, what);
    }
    sliceCheck(
      CLEAN_SOURCE,
      CN_OK_RANGE,
      '<S id="ok" tags="solo" coverage="none">\nOk text.\n</S>',
      "the clean construct",
    );
    sliceCheck(CLEAN_SOURCE, CLEAN_ROOT_RANGE, CLEAN_SOURCE, "the clean file");

    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [ATTRS_FILE]: ATTRS_SOURCE,
        [CLEAN_FILE]: CLEAN_SOURCE,
      },
    });
    try {
      // --- Invocation 1: the bare whole-domain `view` (CONF-AVAIL's
      // enumerated surface; no gate-reference `build`, no snapshot
      // compare). The answer carries the five 14.17 findings and the
      // explicitly-unavailable datums, so exit 1 with the full document
      // still emitted (SPEC 11.2).
      const context = "T11.4-3 bare `view` (whole domain: attrs + clean)";
      const result = await expectExit(
        product,
        workspace,
        ["view"],
        1,
        `${context} — the answer carries the staged 14.17 findings and ` +
          `explicitly-unavailable datums, so the invocation exits 1 with ` +
          `the full document still emitted (SPEC 11.2, 11.4)`,
      );
      const report = decodeViewReport(
        parseJsonStdout(
          result,
          `${context} — a single JSON document is the only output form, ` +
            `with or without --json (SPEC 11)`,
        ),
        { text: false },
        context,
      );

      // Staging integrity rides the answer itself (no `build` gate):
      // exactly one 14.17 per afflicted prop name per element, nothing
      // else — the invalidity is a located finding beside the view, never
      // a view omission (SPEC 11.4, 2.7, 14).
      assertConditionCounts(
        report.findings,
        ATTRS_CONDITION_COUNTS,
        `${context}: exactly five 14.17 accompany — the repeated id, the ` +
          `unknown prop, the spread attribute, the valueless tags, and ` +
          `the braced coverage (SPEC 2.7, 14) — and nothing masked or ` +
          `phantom reports: no 14.1 from the invalid-form id (condition ` +
          `17, never condition 1), no 14.16 for the spread attribute (an ` +
          `attribute form of a permitted section element, not an invalid ` +
          `construct), no 14.2/14.3 (cov and ok are unique and conformant)`,
      );
      for (const finding of report.findings) {
        assertFindingLocated(
          finding,
          { file: ATTRS_FILE },
          `${context} — every 14.17 locates in the matrix file (file ` +
            `granularity; range precision is T14-8's)`,
        );
      }

      // The whole domain in path-byte order, then each per-file tree with
      // its raw attribute entries and interpreted datums (module header).
      assertSameJson(
        report.views.map((view) => view.file),
        [ATTRS_FILE, CLEAN_FILE],
        `${context}: both discovered spec sources are viewed, in byte ` +
          `order of workspace-relative path (SPEC 11.4, 12.7)`,
      );
      assertSameJson(
        projectAttributeData(report.views[0]!.root),
        ATTRS_TREE,
        `${context} — ${ATTRS_FILE}: raw attribute spellings as parsed, ` +
          `one entry per spelled attribute in tag order — the repeated ` +
          `id's BOTH entries, the unknown prop, the spread attribute ` +
          `(name the stated null, text the whole braced construct), the ` +
          `valueless bare-name tags — each with byte-exact range and ` +
          `source text, none omitted for its invalidity (SPEC 11.4); ` +
          `per-node identity/tags/coverage per 11.2: the repeated-id ` +
          `bearer's identity and valueless-tags value explicitly ` +
          `unavailable beside its absent-prop default coverage ` +
          `"required", the braced-coverage value unavailable beside its ` +
          `defined identity and default empty tags, and the root's ` +
          `tags/coverage the stated null, never the marker (SPEC 12.7)`,
      );
      assertSameJson(
        projectAttributeData(report.views[1]!.root),
        CLEAN_TREE,
        `${context} — ${CLEAN_FILE}: the sibling file's section carries ` +
          `all three interpreted data plain (identity "ok", tags ` +
          `["solo"], coverage "none") with its three attribute entries ` +
          `byte-exact, and the root's tags/coverage stay the stated null ` +
          `(SPEC 11.4, 11.2, 12.7)`,
      );
      [ATTRS_FILE, CLEAN_FILE].forEach((file, index) => {
        const view = report.views[index]!;
        assertSameJson(
          [view.imports, view.occurrences, view.comments],
          [[], [], []],
          `${context} — ${file}: no import, reference spelling, or MDX ` +
            `comment is staged — empty lists are [], never null (SPEC ` +
            `11.4, 12.7)`,
        );
      });

      // --- Invocation 2: the finding-free file named as a `<file>`
      // operand (SPEC 11.4's root sentence, sharply): the root's
      // tags/coverage are structurally absent — the stated null, never
      // the unavailability marker — with NO finding and NO exit-1
      // consequence, so the finding-free domain {clean} exits 0 with the
      // full answer while the matrix file stays failing outside the
      // domain (SPEC 11.2, 11.4, 12.7).
      const cleanContext =
        "T11.4-3 `view specs/clean.mdx` (the finding-free file as a " +
        "`<file>` operand)";
      const cleanReport = decodeViewReport(
        await runJson(
          product,
          workspace,
          ["view", CLEAN_FILE],
          `${cleanContext} — a finding-free file's view exits 0 with the ` +
            `root's tags/coverage the stated null: structural absence ` +
            `carries no finding and no exit-1 consequence, unlike an ` +
            `explicitly-unavailable datum (SPEC 11.4, 11.2, 12.7)`,
        ),
        { text: false },
        cleanContext,
      );
      assertSameJson(
        cleanReport.findings,
        [],
        `${cleanContext}: the domain's one file is finding-free — the ` +
          `matrix file's 14.17s are no domain file's findings — and a ` +
          `root's stated-null tags/coverage contribute none (SPEC 11.2, ` +
          `11.4)`,
      );
      assertSameJson(
        cleanReport.views.map((view) => view.file),
        [CLEAN_FILE],
        `${cleanContext}: one per-file view — the requested file (SPEC 11.4)`,
      );
      assertSameJson(
        projectAttributeData(cleanReport.views[0]!.root),
        CLEAN_TREE,
        `${cleanContext}: the same tree as the whole-domain answer — the ` +
          `root's tags/coverage the stated null, never the unavailability ` +
          `marker, on the exit-0 side too (SPEC 11.4, 12.7)`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

// --- T11.4-4 — imports ----------------------------------------------------------
//
// The declaration matrix (module header): six imports, one per line, at the
// very start of specs/imports.mdx (the §2.1 staging discipline — every
// offending statement is its own byte window, and nothing precedes the first
// declaration), the valid first declaration's multi-byte bound identifier
// `BÄSE` (Ä: 2 bytes) shifting every later declaration's byte offset away
// from code-point and UTF-16 counts (SPEC 1.7). specs/base.mdx is the
// discovered, prose-only, finding-free import target; specs/typo.mdx exists
// nowhere.

const IMPORTS_FILE = "specs/imports.mdx";

const IMPORT_TARGET_FILE = "specs/base.mdx";
const IMPORT_TARGET_SOURCE = "Socle — cible d'import découverte.\n";
const IMPORT_TARGET_ROOT_RANGE: SourceRange = {
  start: 0,
  end: Buffer.byteLength(IMPORT_TARGET_SOURCE, "utf8"),
};

const IMP = new ByteFixture();
const IMP_VALID_TEXT = 'import BÄSE from "./base.xspec"';
const IMP_VALID = IMP.add(IMP_VALID_TEXT);
IMP.add("\n");
const IMP_SIDE_TEXT = 'import "./base.xspec"';
const IMP_SIDE = IMP.add(IMP_SIDE_TEXT);
IMP.add("\n");
const IMP_NAMED_TEXT = 'import { part } from "./base.xspec"';
const IMP_NAMED = IMP.add(IMP_NAMED_TEXT);
IMP.add("\n");
const IMP_NAMESPACE_TEXT = 'import * as ns from "./base.xspec"';
const IMP_NAMESPACE = IMP.add(IMP_NAMESPACE_TEXT);
IMP.add("\n");
const IMP_TYPO_TEXT = 'import TYPO from "./typo.xspec"';
const IMP_TYPO = IMP.add(IMP_TYPO_TEXT);
IMP.add("\n");
const IMP_BARE_TEXT = 'import BARE from "base.xspec"';
const IMP_BARE = IMP.add(IMP_BARE_TEXT);
IMP.add("\n\nProse après les imports — aucun autre construct en scène.\n");
const IMPORTS_SOURCE = IMP.source;
const IMPORTS_ROOT_RANGE: SourceRange = { start: 0, end: IMP.pos };

/**
 * The complete expected imports member, in document order (SPEC 11.4, 12.7):
 * every declaration, valid and invalid, listed with its byte-exact range;
 * `name` the default binding's identifier — plain where the declaration
 * binds a default, validly or not, and the stated `null` (never the
 * unavailability marker, never a named-clause or namespace identifier) for
 * the no-default forms; `target` the resolved file where specifier form and
 * discovery define one, `{"unavailable": true}` otherwise — never `null`.
 */
const EXPECTED_IMPORT_ENTRIES: readonly ViewImportEntry[] = [
  { range: IMP_VALID, name: "BÄSE", target: IMPORT_TARGET_FILE },
  { range: IMP_SIDE, name: null, target: IMPORT_TARGET_FILE },
  { range: IMP_NAMED, name: null, target: IMPORT_TARGET_FILE },
  { range: IMP_NAMESPACE, name: null, target: IMPORT_TARGET_FILE },
  { range: IMP_TYPO, name: "TYPO", target: UNAVAILABLE },
  { range: IMP_BARE, name: "BARE", target: UNAVAILABLE },
];

/**
 * The five invalid declarations in document order — also the answer's
 * findings order: the five 14.15 findings share one code, and equal codes
 * order by locations (SPEC 12.7), so array position pins which finding is
 * which. Each finding must fall within its own declaration's end-widened
 * byte window (the §2.1/byteWindow discipline: one byte of slack for a
 * line-granular location; the next declaration starts past the window).
 */
const INVALID_IMPORT_ARMS: readonly {
  readonly what: string;
  readonly range: SourceRange;
}[] = [
  { what: "the side-effect-only form", range: IMP_SIDE },
  { what: "the named-only form (`{ part }`)", range: IMP_NAMED },
  { what: "the namespace-only form (`* as ns`)", range: IMP_NAMESPACE },
  { what: "the undiscovered `./typo.xspec` target", range: IMP_TYPO },
  { what: "the bare specifier `base.xspec`", range: IMP_BARE },
];

// Root-only expected trees (neither file stages a section): identity the
// defined plain string (valid paths), range the whole file, no
// decomposition. The roots' stated-null tags/coverage and the attributes []
// ride the form-exact decode (T11.4-3 asserts the root distinction sharply).
const IMPORTS_TREE: TreeShape = {
  identity: IMPORTS_FILE,
  range: IMPORTS_ROOT_RANGE,
  opening: null,
  closing: null,
  children: [],
};

const IMPORT_TARGET_TREE: TreeShape = {
  identity: IMPORT_TARGET_FILE,
  range: IMPORT_TARGET_ROOT_RANGE,
  opening: null,
  closing: null,
  children: [],
};

const T11_4_4 = defineProductTest({
  id: "T11.4-4",
  title:
    'every import declaration, valid and invalid, is listed in the view\'s imports member with its byte-exact range in document order — a valid default binding whose multi-byte identifier `BÄSE` shifts every later byte offset away from code-point and UTF-16 counts, the side-effect-only, named-only (`{ part }`), and namespace-only (`* as ns`) forms each with the same valid resolving specifier, a valid-form default import of the undiscovered `./typo.xspec`, and the bare specifier `base.xspec` — the binding-name datum the DEFAULT binding\'s identifier: plain ("BÄSE", "TYPO", "BARE") where a default is bound, validly or not, and the stated `null` for the three no-default forms, never the unavailability marker and never a named-clause or namespace identifier; the resolved-target datum turning on specifier form and discovery ALONE: the invalid binding forms still carry the plain target "specs/base.mdx" (name `null` beside a defined target) while `./typo.xspec` (discovery defines none) and the bare specifier (form defines none — a suffix-keyed resolver notwithstanding) are each `{"unavailable": true}` literally, never `null`; each invalidity a located 14.15 finding beside the view — exactly five, one per invalid declaration, each within its own declaration\'s end-widened byte window — and any finding or explicitly-unavailable datum means exit 1 with the full answer still emitted (SPEC 11.4, 11.2, 2.1, 1.7, 12.7, 14; CERTIFICATIONS.md CONF-AVAIL in scope)',
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline) — composed-range arithmetic
    // proven against the staged bytes before any product invocation.
    for (const [range, span, what] of [
      [IMP_VALID, IMP_VALID_TEXT, "the valid default import"],
      [IMP_SIDE, IMP_SIDE_TEXT, "the side-effect-only import"],
      [IMP_NAMED, IMP_NAMED_TEXT, "the named-only import"],
      [IMP_NAMESPACE, IMP_NAMESPACE_TEXT, "the namespace-only import"],
      [IMP_TYPO, IMP_TYPO_TEXT, "the undiscovered-target import"],
      [IMP_BARE, IMP_BARE_TEXT, "the bare-specifier import"],
    ] as const) {
      sliceCheck(IMPORTS_SOURCE, range, span, what);
    }
    sliceCheck(
      IMPORTS_SOURCE,
      IMPORTS_ROOT_RANGE,
      IMPORTS_SOURCE,
      "the imports file",
    );

    const workspace = await TestWorkspace.create({
      files: {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        [IMPORT_TARGET_FILE]: IMPORT_TARGET_SOURCE,
        [IMPORTS_FILE]: IMPORTS_SOURCE,
      },
    });
    try {
      // The one invocation (CONF-AVAIL's enumerated surface: no
      // gate-reference `build`, no snapshot compare): the bare whole-domain
      // `view`. The answer carries the five 14.15 findings and the two
      // explicitly-unavailable targets, so exit 1 with the full document
      // still emitted (SPEC 11.2).
      const context = "T11.4-4 bare `view` (whole domain: base + imports)";
      const result = await expectExit(
        product,
        workspace,
        ["view"],
        1,
        `${context} — the answer carries the five staged 14.15 findings ` +
          `and two explicitly-unavailable import targets, so the ` +
          `invocation exits 1 with the full document still emitted (SPEC ` +
          `11.2, 11.4)`,
      );
      const report = decodeViewReport(
        parseJsonStdout(
          result,
          `${context} — a single JSON document is the only output form, ` +
            `with or without --json (SPEC 11)`,
        ),
        { text: false },
        context,
      );

      // Staging integrity rides the answer itself (no `build` gate):
      // exactly one 14.15 per invalid declaration, nothing else — the
      // valid default import is finding-free (an unused binding is valid,
      // SPEC 2.1), no binding collision is staged (five distinct
      // identifiers), and neither file spells a section (SPEC 11.4, 14).
      assertConditionCounts(
        report.findings,
        { "14.15": 5 },
        `${context}: exactly five 14.15 accompany — the side-effect-only, ` +
          `named-only, and namespace-only binding forms, the undiscovered ` +
          `./typo.xspec target, and the bare specifier (SPEC 2.1, 14) — ` +
          `and nothing else: the valid default import contributes none, ` +
          `and no other condition is staged`,
      );
      report.findings.forEach((finding, index) => {
        const arm = INVALID_IMPORT_ARMS[index]!;
        assertFindingLocated(
          finding,
          {
            file: IMPORTS_FILE,
            window: { start: arm.range.start, end: arm.range.end + 1 },
          },
          `${context} — the 14.15 for ${arm.what} locates within that ` +
            `declaration's own byte window in specs/imports.mdx (equal ` +
            `codes order by locations, so findings arrive in declaration ` +
            `order; SPEC 14, 12.7)`,
        );
      });

      // Both discovered spec sources are viewed, in byte order of
      // workspace-relative path ("specs/base.mdx" < "specs/imports.mdx").
      assertSameJson(
        report.views.map((view) => view.file),
        [IMPORT_TARGET_FILE, IMPORTS_FILE],
        `${context}: both discovered spec sources are viewed, in byte ` +
          `order of workspace-relative path (SPEC 11.4, 12.7)`,
      );
      const targetView = report.views[0]!;
      const importsView = report.views[1]!;

      // The subject compare: the imports member is exactly the six-entry
      // list — every declaration, valid and invalid, with its byte-exact
      // range, the binding-name datum plain or the stated null, and the
      // resolved-target datum plain or the literal unavailability marker
      // (SPEC 11.4, 11.2, 12.7; module header).
      assertSameJson(
        importsView.imports,
        EXPECTED_IMPORT_ENTRIES,
        `${context} — ${IMPORTS_FILE}: every import declaration, valid ` +
          `and invalid, listed with its range in document order; name the ` +
          `default binding's identifier ("BÄSE"/"TYPO"/"BARE") or the ` +
          `stated null for the side-effect-only, named-only, and ` +
          `namespace-only forms — never the marker, never part/ns; target ` +
          `the resolved specs/base.mdx wherever specifier form and ` +
          `discovery define one — binding validity notwithstanding — and ` +
          `the literal unavailability marker for ./typo.xspec and the ` +
          `bare specifier, never null (SPEC 11.4, 11.2, 2.1, 12.7)`,
      );

      // The rest of each per-file view: root-only trees byte-asserted;
      // nothing else staged, so occurrences/comments (and the target's
      // imports) are [] — empty lists are [], never null (SPEC 12.7).
      assertSameJson(
        projectShape(importsView.root),
        IMPORTS_TREE,
        `${context} — ${IMPORTS_FILE}: a section-less file's view is the ` +
          `root alone, its identity the defined plain string, its range ` +
          `the whole file (SPEC 11.4, 11.2, 1.7)`,
      );
      assertSameJson(
        [importsView.occurrences, importsView.comments],
        [[], []],
        `${context} — ${IMPORTS_FILE}: no reference spelling or MDX ` +
          `comment is staged — empty lists are [], never null (SPEC 11.4, ` +
          `12.7)`,
      );
      assertSameJson(
        projectShape(targetView.root),
        IMPORT_TARGET_TREE,
        `${context} — ${IMPORT_TARGET_FILE}: the prose-only import ` +
          `target's view is the root alone (SPEC 11.4, 1.7)`,
      );
      assertSameJson(
        [targetView.imports, targetView.occurrences, targetView.comments],
        [[], [], []],
        `${context} — ${IMPORT_TARGET_FILE}: no import, reference ` +
          `spelling, or MDX comment is staged — empty lists are [], never ` +
          `null (SPEC 11.4, 12.7)`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

// --- T11.4-5 — `--text` and the expansion domain ------------------------------
//
// Module header holds the narrative; the constants below stage the four
// workspaces with the running-offset builder so every expected offset and
// every expected text value is composed from the same parts the staged files
// are (expected own/subtree text hand-derived per the rules of 3, the
// T11.2-4 discipline: the import line and every tag-only line are left empty
// purely by removals and drop WITH their terminators — a straddling
// closing-tag line's drop eats the enclosing contribution's terminator —
// while originally-blank lines stay).

/**
 * The projection T11.4-5 pins per node under `--text`: the identity datum,
 * the construct range (1.7), and the own/subtree text datums — each a
 * byte-exact string or the unavailability marker (T11.2-4's matrix) — plus
 * tree shape. Attribute entries and interpreted tags/coverage stay at their
 * home tests (T11.4-1/-3); the form-exact decode has validated their forms.
 */
interface TextTreeShape {
  readonly identity: ViewNode["identity"];
  readonly range: SourceRange;
  readonly ownText: string | { readonly unavailable: true };
  readonly subtreeText: string | { readonly unavailable: true };
  readonly children: readonly TextTreeShape[];
}

function projectTextShape(node: ViewNode): TextTreeShape {
  return {
    identity: node.identity,
    range: node.range,
    ownText: node.ownText!,
    subtreeText: node.subtreeText!,
    children: node.children.map(projectTextShape),
  };
}

/** An offending construct's byte window: its range, end-widened by one. */
function widened(range: SourceRange): { start: number; end: number } {
  return { start: range.start, end: range.end + 1 };
}

/** The one finding of a condition — counts asserted beforehand. */
function findingByCondition(
  findings: readonly Finding[],
  condition: string,
  context: string,
): Finding {
  const matches = findings.filter((finding) => finding.condition === condition);
  if (matches.length !== 1) {
    fail(
      `${context}: expected exactly one ${condition} finding, got ` +
        `${String(matches.length)}`,
    );
  }
  return matches[0]!;
}

/** A window check for one located finding (SPEC 14 location cardinality). */
interface LocatedWindow {
  readonly file: string;
  readonly window: { readonly start: number; readonly end: number };
}

/**
 * Assert a located finding's concern: `path` null (a located condition, SPEC
 * 12.7), exactly one location per offending construct (SPEC 14's cardinality
 * rule), each — in 12.7 location order, which the decode has already
 * enforced — lying in its expected file with its range inside the offending
 * construct's byte window.
 */
function assertFindingWindows(
  finding: Finding,
  expected: readonly LocatedWindow[],
  context: string,
): void {
  assertSameJson(
    finding.path,
    null,
    `${context} — a located condition's concerned path is null (SPEC 12.7)`,
  );
  if (finding.locations.length !== expected.length) {
    fail(
      `${context}: expected exactly ${String(expected.length)} location(s) — ` +
        `one per offending construct (SPEC 14) — got ` +
        `${String(finding.locations.length)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
  expected.forEach((want, index) => {
    const location = finding.locations[index]!;
    if (location.file !== want.file) {
      fail(
        `${context}: location ${String(index)} must lie in ` +
          `${JSON.stringify(want.file)}, got ` +
          `${JSON.stringify(location.file)} (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
    if (
      location.range.start < want.window.start ||
      location.range.end > want.window.end
    ) {
      fail(
        `${context}: location ${String(index)} ` +
          `[${String(location.range.start)}, ${String(location.range.end)}) ` +
          `must fall within the offending construct's byte window ` +
          `[${String(want.window.start)}, ${String(want.window.end)}] ` +
          `(message: ${JSON.stringify(finding.message)})`,
      );
    }
  });
}

/**
 * Assert a non-recording MDX embedding spelling's finding exactly: stable
 * code `unknown-text-target`, ONE location whose range is EXACTLY the full
 * braced container — the span its occurrence would occupy (SPEC 14, 5.7) —
 * `path` null.
 */
function assertUnresolvedEmbedding(
  finding: Finding,
  expected: { readonly file: string; readonly range: SourceRange },
  context: string,
): void {
  assertSameJson(
    { code: finding.code, locations: finding.locations, path: finding.path },
    {
      code: "unknown-text-target",
      locations: [{ file: expected.file, range: expected.range }],
      path: null,
    },
    `${context} — the non-recording embedding spelling is located by its ` +
      `finding: stable code unknown-text-target, its one location's range ` +
      `EXACTLY the full braced container — the span its occurrence would ` +
      `occupy (SPEC 14, 5.7, 12.7)`,
  );
}

// --- the chain workspace: A → B → C, X beyond the boundary --------------------

const XDA_FILE = "specs/A.mdx";
const XDA = new ByteFixture();
XDA.add("Ärm — the requested head.\n\n");
const XDA_IMPORT_TEXT = 'import B from "./B.xspec"';
const XDA_IMPORT_RANGE = XDA.add(XDA_IMPORT_TEXT);
XDA.add("\n\n");
const XDA_ALPHA_START = XDA.pos;
XDA.add('<S id="alpha">\nAlpha head.\n\n');
const XDA_EMBED_TEXT = "{text(B.b)}";
const XDA_EMBED_RANGE = XDA.add(XDA_EMBED_TEXT);
XDA.add("\n</S>");
const XDA_ALPHA_RANGE: SourceRange = { start: XDA_ALPHA_START, end: XDA.pos };
XDA.add("\n\n");
const XDA_PLAIN_START = XDA.pos;
XDA.add('<S id="plain">\nPlain line.\n</S>');
const XDA_PLAIN_RANGE: SourceRange = { start: XDA_PLAIN_START, end: XDA.pos };
XDA.add("\n");
const XDA_SOURCE = XDA.source;
const XDA_ROOT_RANGE: SourceRange = { start: 0, end: XDA.pos };

const XDB_FILE = "specs/B.mdx";
const XDB = new ByteFixture();
XDB.add("Bäck — first hop, own finding.\n\n");
XDB.add('import C from "./C.xspec"');
XDB.add("\n\n");
const XDB_B_START = XDB.pos;
XDB.add('<S id="b" d={"ghost"}>');
const XDB_B_OPEN_END = XDB.pos;
XDB.add("\nB head.\n\n{text(C.c)}\n</S>\n");
const XDB_SOURCE = XDB.source;

const XDC_FILE = "specs/C.mdx";
const XDC = new ByteFixture();
XDC.add("Çay — second hop, the boundary.\n\n");
XDC.add('import X from "./X.xspec"');
XDC.add("\n\n");
XDC.add('<S id="c">\nC head.\n\n');
const XDC_BOUNDARY_TEXT = "{text(X.dup)}";
const XDC_BOUNDARY_RANGE = XDC.add(XDC_BOUNDARY_TEXT);
XDC.add("\n</S>\n");
const XDC_SOURCE = XDC.source;

const XDX_FILE = "specs/X.mdx";
const XDX = new ByteFixture();
XDX.add("Xîlo — never consulted.\n\n");
const XDX_DUP1_START = XDX.pos;
XDX.add('<S id="dup">\nFirst twin.\n</S>');
const XDX_DUP1_RANGE: SourceRange = { start: XDX_DUP1_START, end: XDX.pos };
XDX.add("\n\n");
const XDX_DUP2_START = XDX.pos;
XDX.add('<S id="dup">\nSecond twin.\n</S>');
const XDX_DUP2_RANGE: SourceRange = { start: XDX_DUP2_START, end: XDX.pos };
XDX.add("\n");
const XDX_SOURCE = XDX.source;

// The chain workspace's COMPLETE findings multiset — the gate's staging
// premise: X's duplicate pair (one 14.3 locating both bearers), B's
// unresolved `d` (14.5), C's non-recording boundary spelling (14.6). A is
// finding-free (the no-`--text` arm's ground).
const XD_WORKSPACE_CONDITIONS: Readonly<Record<string, number>> = {
  "14.3": 1,
  "14.5": 1,
  "14.6": 1,
};

// A's expected text values (rules of 3): the root's own text is defined —
// title line + its blank + the dropped import line's blank successor + the
// between-construct blank (each closing-tag line's drop eats the root's
// terminator) — while alpha (holding the embedding whose expansion reaches
// the boundary two hops down) and the root's subtree text are poisoned.
const XDA_ROOT_OWN = "Ärm — the requested head.\n\n\n\n";
const XDA_PLAIN_TEXT = "Plain line.\n";

const XDA_TEXT_TREE: TextTreeShape = {
  identity: XDA_FILE,
  range: XDA_ROOT_RANGE,
  ownText: XDA_ROOT_OWN,
  subtreeText: UNAVAILABLE,
  children: [
    {
      identity: `${XDA_FILE}#alpha`,
      range: XDA_ALPHA_RANGE,
      ownText: UNAVAILABLE,
      subtreeText: UNAVAILABLE,
      children: [],
    },
    {
      identity: `${XDA_FILE}#plain`,
      range: XDA_PLAIN_RANGE,
      ownText: XDA_PLAIN_TEXT,
      subtreeText: XDA_PLAIN_TEXT,
      children: [],
    },
  ],
};

const XDA_IDENTITY_TREE: IdentityShape = {
  identity: XDA_FILE,
  children: [
    { identity: `${XDA_FILE}#alpha`, children: [] },
    { identity: `${XDA_FILE}#plain`, children: [] },
  ],
};

const XDA_IMPORTS: readonly ViewImportEntry[] = [
  { range: XDA_IMPORT_RANGE, name: "B", target: XDB_FILE },
];
// A's one embedding resolves (b's identity is defined) and records — with
// and without `--text` alike: resolution is never flag-dependent.
const XDA_OCCURRENCES: readonly OccurrenceRecord[] = [
  {
    file: XDA_FILE,
    range: XDA_EMBED_RANGE,
    kind: "embeds",
    source: { identity: `${XDA_FILE}#alpha`, range: XDA_ALPHA_RANGE },
    target: `${XDB_FILE}#b`,
  },
];

// --- the cycle workspace: entry → loop, loop self-embeds ----------------------

const CYE_FILE = "specs/entry.mdx";
const CYE = new ByteFixture();
CYE.add("Öse — the cycle's entry.\n\n");
const CYE_IMPORT_TEXT = 'import LOOP from "./loop.xspec"';
const CYE_IMPORT_RANGE = CYE.add(CYE_IMPORT_TEXT);
CYE.add("\n\n");
const CYE_START_START = CYE.pos;
CYE.add('<S id="start">\nStart head.\n\n');
const CYE_EMBED_TEXT = "{text(LOOP.l1)}";
const CYE_EMBED_RANGE = CYE.add(CYE_EMBED_TEXT);
CYE.add("\n</S>");
const CYE_START_RANGE: SourceRange = { start: CYE_START_START, end: CYE.pos };
CYE.add("\n");
const CYE_SOURCE = CYE.source;
const CYE_ROOT_RANGE: SourceRange = { start: 0, end: CYE.pos };

const CYL_FILE = "specs/loop.mdx";
const CYL = new ByteFixture();
CYL.add("Løkke — the self-embedding participant.\n\n");
CYL.add('<S id="l1">\nLoop head.\n\n');
const CYL_SELF_TEXT = '{text("l1")}';
const CYL_SELF_RANGE = CYL.add(CYL_SELF_TEXT);
CYL.add("\n</S>\n");
const CYL_SOURCE = CYL.source;

// entry's root own text: title + its blank + the dropped import line's blank
// successor; nothing after the one section (its closing-tag line's drop eats
// the root's terminator).
const CYE_ROOT_OWN = "Öse — the cycle's entry.\n\n\n";

const CYE_TEXT_TREE: TextTreeShape = {
  identity: CYE_FILE,
  range: CYE_ROOT_RANGE,
  ownText: CYE_ROOT_OWN,
  subtreeText: UNAVAILABLE,
  children: [
    {
      identity: `${CYE_FILE}#start`,
      range: CYE_START_RANGE,
      ownText: UNAVAILABLE,
      subtreeText: UNAVAILABLE,
      children: [],
    },
  ],
};

const CYE_IMPORTS: readonly ViewImportEntry[] = [
  { range: CYE_IMPORT_RANGE, name: "LOOP", target: CYL_FILE },
];
const CYE_OCCURRENCES: readonly OccurrenceRecord[] = [
  {
    file: CYE_FILE,
    range: CYE_EMBED_RANGE,
    kind: "embeds",
    source: { identity: `${CYE_FILE}#start`, range: CYE_START_RANGE },
    target: `${CYL_FILE}#l1`,
  },
];

// --- the masked workspace: main → gone (unparseable) --------------------------

const MKM_FILE = "specs/main.mdx";
const MKM = new ByteFixture();
MKM.add("Måne — the masked target's requester.\n\n");
const MKM_IMPORT_TEXT = 'import GONE from "./gone.xspec"';
const MKM_IMPORT_RANGE = MKM.add(MKM_IMPORT_TEXT);
MKM.add("\n\n");
const MKM_M_START = MKM.pos;
MKM.add('<S id="m">\nMain head.\n\n');
const MKM_EMBED_TEXT = "{text(GONE.g)}";
const MKM_EMBED_RANGE = MKM.add(MKM_EMBED_TEXT);
MKM.add("\n</S>");
const MKM_M_RANGE: SourceRange = { start: MKM_M_START, end: MKM.pos };
MKM.add("\n");
const MKM_SOURCE = MKM.source;
const MKM_ROOT_RANGE: SourceRange = { start: 0, end: MKM.pos };

const MK_GONE_FILE = "specs/gone.mdx";
// Unparseable MDX (14.20): an unclosed section tag (the T11.2-1 staging).
const MK_GONE_SOURCE = '<S id="g">\nNever closed.\n';

const MKM_ROOT_OWN = "Måne — the masked target's requester.\n\n\n";

const MKM_TEXT_TREE: TextTreeShape = {
  identity: MKM_FILE,
  range: MKM_ROOT_RANGE,
  ownText: MKM_ROOT_OWN,
  subtreeText: UNAVAILABLE,
  children: [
    {
      identity: `${MKM_FILE}#m`,
      range: MKM_M_RANGE,
      ownText: UNAVAILABLE,
      subtreeText: UNAVAILABLE,
      children: [],
    },
  ],
};

// The import's resolved target turns on specifier form and discovery ALONE:
// gone.mdx is discovered, so the entry carries the plain path even while the
// file is unparseable and the embedding into it records nothing.
const MKM_IMPORTS: readonly ViewImportEntry[] = [
  { range: MKM_IMPORT_RANGE, name: "GONE", target: MK_GONE_FILE },
];

// --- the invalid-path workspace: specs/vi#ew.mdx ------------------------------

const IP_FILE = "specs/vi#ew.mdx";
const IPF = new ByteFixture();
IPF.add("Vïew — invalid path, intact view.\n\n");
const IP_H_START = IPF.pos;
IPF.add('<S id="h">\nHash line.\n</S>');
const IP_H_RANGE: SourceRange = { start: IP_H_START, end: IPF.pos };
IPF.add("\n");
const IP_SOURCE = IPF.source;
const IP_ROOT_RANGE: SourceRange = { start: 0, end: IPF.pos };

// The file holds no embedding, so every text value is defined and byte-exact
// even though no node of the file has a defined identity: expansion
// definedness turns on occurrence-recording spellings alone (SPEC 11.2).
const IP_H_TEXT = "Hash line.\n";
const IP_ROOT_OWN = "Vïew — invalid path, intact view.\n\n";
const IP_ROOT_SUBTREE = IP_ROOT_OWN + IP_H_TEXT;

const IP_TEXT_TREE: TextTreeShape = {
  identity: UNAVAILABLE,
  range: IP_ROOT_RANGE,
  ownText: IP_ROOT_OWN,
  subtreeText: IP_ROOT_SUBTREE,
  children: [
    {
      identity: UNAVAILABLE,
      range: IP_H_RANGE,
      ownText: IP_H_TEXT,
      subtreeText: IP_H_TEXT,
      children: [],
    },
  ],
};

const T11_4_5 = defineProductTest({
  id: "T11.4-5",
  title:
    "with `--text` each node carries own and subtree text per T11.2-4, and the consulted domain is the requested files plus exactly the files of resolved targets reachable through occurrence-RECORDING embeddings: requesting ONLY A, whose embeddings reach B and C transitively, accompanies exactly B's 14.5 and C's 14.6 — deep findings lying in consulted files never requested — while the boundary spelling `{text(X.dup)}` (X's duplicate pair proven staged by the `build --json` gate) records no occurrence and consults NO further file: X's 14.3 accompanies nothing, no winner resolved through; a self-embedding cycle reached from a requested entry file accompanies its one 14.9 located in the consulted-but-never-requested participant, whether or not any expansion completes, poisoning the entry's reaching values; a masked file is never consulted by expansion — the spelling naming into it records no occurrence (an empty occurrence list), the blocking 14.6 lying in the requester at exactly the braced container — its 14.20 accompanying only when itself requested, and the unparseable requested file then contributing NO view (the views list stays [main]); an invalid-path requested file (`specs/vi#ew.mdx` — a bare `<file>` operand is a whole path, `#` having no delimiter role, 12.0) keeps its view: identities unavailable, text values plain and byte-exact, the 14.19 carrying no locations and the file as concerned path; without `--text`, requesting A consults A alone — findings `[]`, exit 0, the exit following A's own findings while B/C/X stay failing (SPEC 11.4, 11.2, 1.6, 3, 2.1, 5.3, 12.0, 12.7, 14)",
  run: async (product) => {
    // Fixture self-checks (T5.7-2 discipline): composed ranges sliced back
    // out of the staged bytes before any product invocation.
    sliceCheck(
      XDA_SOURCE,
      XDA_IMPORT_RANGE,
      XDA_IMPORT_TEXT,
      "A's import declaration",
    );
    sliceCheck(
      XDA_SOURCE,
      XDA_EMBED_RANGE,
      XDA_EMBED_TEXT,
      "A's embedding container",
    );
    sliceCheck(
      XDA_SOURCE,
      XDA_ALPHA_RANGE,
      '<S id="alpha">\nAlpha head.\n\n{text(B.b)}\n</S>',
      "alpha's whole construct",
    );
    sliceCheck(
      XDA_SOURCE,
      XDA_PLAIN_RANGE,
      '<S id="plain">\nPlain line.\n</S>',
      "plain's whole construct",
    );
    sliceCheck(
      XDB_SOURCE,
      { start: XDB_B_START, end: XDB_B_OPEN_END },
      '<S id="b" d={"ghost"}>',
      "b's opening tag",
    );
    sliceCheck(
      XDC_SOURCE,
      XDC_BOUNDARY_RANGE,
      XDC_BOUNDARY_TEXT,
      "the boundary embedding container",
    );
    sliceCheck(
      XDX_SOURCE,
      XDX_DUP1_RANGE,
      '<S id="dup">\nFirst twin.\n</S>',
      "the first dup bearer",
    );
    sliceCheck(
      XDX_SOURCE,
      XDX_DUP2_RANGE,
      '<S id="dup">\nSecond twin.\n</S>',
      "the second dup bearer",
    );
    sliceCheck(
      CYE_SOURCE,
      CYE_EMBED_RANGE,
      CYE_EMBED_TEXT,
      "entry's embedding container",
    );
    sliceCheck(
      CYE_SOURCE,
      CYE_START_RANGE,
      '<S id="start">\nStart head.\n\n{text(LOOP.l1)}\n</S>',
      "start's whole construct",
    );
    sliceCheck(
      CYL_SOURCE,
      CYL_SELF_RANGE,
      CYL_SELF_TEXT,
      "the self-embedding container",
    );
    sliceCheck(
      MKM_SOURCE,
      MKM_EMBED_RANGE,
      MKM_EMBED_TEXT,
      "main's embedding container",
    );
    sliceCheck(
      MKM_SOURCE,
      MKM_M_RANGE,
      '<S id="m">\nMain head.\n\n{text(GONE.g)}\n</S>',
      "m's whole construct",
    );
    sliceCheck(
      IP_SOURCE,
      IP_H_RANGE,
      '<S id="h">\nHash line.\n</S>',
      "h's whole construct",
    );

    // --- The chain workspace: transitive consultation, the boundary, and
    // the no-`--text` contrast.
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [XDA_FILE]: XDA_SOURCE,
          [XDB_FILE]: XDB_SOURCE,
          [XDC_FILE]: XDC_SOURCE,
          [XDX_FILE]: XDX_SOURCE,
        },
      });
      try {
        // The staging gate: the workspace's COMPLETE findings multiset —
        // X's 14.3 proven staged (so its absence from the view answers below
        // is a real negative observation), B's 14.5 and C's 14.6 located,
        // and nothing else anywhere (A finding-free).
        const gateContext =
          "T11.4-5 staging gate (`build --json`, the chain workspace)";
        const gateFindings = await buildFindings(
          product,
          workspace,
          gateContext,
        );
        assertConditionCounts(
          gateFindings,
          XD_WORKSPACE_CONDITIONS,
          `${gateContext}: exactly the staged conditions — X's duplicate ` +
            `pair (14.3), B's unresolved d reference (14.5), C's ` +
            `non-recording boundary spelling (14.6) — and A finding-free ` +
            `(SPEC 14)`,
        );
        assertFindingWindows(
          findingByCondition(gateFindings, "14.3", gateContext),
          [
            { file: XDX_FILE, window: widened(XDX_DUP1_RANGE) },
            { file: XDX_FILE, window: widened(XDX_DUP2_RANGE) },
          ],
          `${gateContext} — the duplicate-id finding locates EVERY bearer ` +
            `of \`dup\` in specs/X.mdx (SPEC 14)`,
        );
        assertFindingWindows(
          findingByCondition(gateFindings, "14.5", gateContext),
          [
            {
              file: XDB_FILE,
              window: { start: XDB_B_START, end: XDB_B_OPEN_END + 1 },
            },
          ],
          `${gateContext} — the unresolved d reference is located within ` +
            `the opening tag spelling it, in specs/B.mdx (SPEC 14)`,
        );
        assertUnresolvedEmbedding(
          findingByCondition(gateFindings, "14.6", gateContext),
          { file: XDC_FILE, range: XDC_BOUNDARY_RANGE },
          gateContext,
        );

        // `view specs/A.mdx --text`: the consulted domain is {A, B, C} —
        // B's and C's findings accompany while X's 14.3 accompanies
        // NOTHING — and A's view alone is served, its text datums pinned.
        const textContext =
          "T11.4-5 `view specs/A.mdx --text` (requesting only the chain head)";
        const textResult = await expectExit(
          product,
          workspace,
          ["view", XDA_FILE, "--text"],
          1,
          `${textContext} — consulted-domain findings and poisoned text ` +
            `values accompany, so exit 1 with the full answer (SPEC 11.2)`,
        );
        const textReport = decodeViewReport(
          parseJsonStdout(
            textResult,
            `${textContext} — a single JSON document is the only output ` +
              `form, with or without --json (SPEC 11)`,
          ),
          { text: true },
          textContext,
        );
        assertConditionCounts(
          textReport.findings,
          { "14.5": 1, "14.6": 1 },
          `${textContext}: the consulted domain is {A, B, C} — exactly B's ` +
            `14.5 and C's 14.6 accompany (deep findings in consulted files ` +
            `never requested) and X's 14.3 accompanies NOTHING: the ` +
            `boundary spelling records no occurrence, so no further file ` +
            `is consulted (SPEC 11.4, 11.2, 14)`,
        );
        assertFindingWindows(
          findingByCondition(textReport.findings, "14.5", textContext),
          [
            {
              file: XDB_FILE,
              window: { start: XDB_B_START, end: XDB_B_OPEN_END + 1 },
            },
          ],
          `${textContext} — B's own finding accompanies from a consulted ` +
            `file never requested (SPEC 11.4, 14)`,
        );
        assertUnresolvedEmbedding(
          findingByCondition(textReport.findings, "14.6", textContext),
          { file: XDC_FILE, range: XDC_BOUNDARY_RANGE },
          `${textContext} — the blocking finding lies in a file already ` +
            `consulted (SPEC 11.4)`,
        );
        assertSameJson(
          textReport.views.map((view) => view.file),
          [XDA_FILE],
          `${textContext}: the requested files alone are viewed — ` +
            `consultation never adds views (SPEC 11.4)`,
        );
        const aTextView = textReport.views[0]!;
        assertSameJson(
          projectTextShape(aTextView.root),
          XDA_TEXT_TREE,
          `${textContext} — A's tree with text datums: alpha's own/subtree ` +
            `text EXACTLY the unavailability marker (the boundary lies two ` +
            `hops down; partial expansion never occurs), the embedding-free ` +
            `sibling and the root's own text defined and byte-exact, the ` +
            `root's subtree text poisoned (SPEC 11.2, 1.6, 3)`,
        );
        assertSameJson(
          aTextView.imports,
          XDA_IMPORTS,
          `${textContext} — A's import declaration with range, default ` +
            `binding, and resolved target (SPEC 11.4)`,
        );
        assertSameJson(
          aTextView.occurrences,
          XDA_OCCURRENCES,
          `${textContext} — A's one embedding resolves and records: file, ` +
            `range, kind, defined source, target (SPEC 5.7, 11.2)`,
        );
        assertSameJson(
          aTextView.comments,
          [],
          `${textContext} — no MDX comment is staged (SPEC 12.7)`,
        );

        // Without `--text`, requesting A consults A alone: B's findings
        // absent, findings `[]`, and the exit follows A's own findings —
        // none, so exit 0 while B/C/X stay failing.
        const bareContext =
          "T11.4-5 `view specs/A.mdx` (no --text: A consults A alone)";
        const bareResult = await expectExit(
          product,
          workspace,
          ["view", XDA_FILE],
          0,
          `${bareContext} — the consulted domain is the requested files ` +
            `alone: A is finding-free and its answer carries no ` +
            `explicitly-unavailable datum, so exit 0 whatever findings ` +
            `B/C/X carry (SPEC 11.4, 11.2)`,
        );
        const bareReport = decodeViewReport(
          parseJsonStdout(
            bareResult,
            `${bareContext} — a single JSON document is the only output ` +
              `form (SPEC 11)`,
          ),
          { text: false },
          bareContext,
        );
        assertSameJson(
          bareReport.findings,
          [],
          `${bareContext}: B's findings are absent — the empty findings ` +
            `member is [], never null (SPEC 11.4, 12.7)`,
        );
        assertSameJson(
          bareReport.views.map((view) => view.file),
          [XDA_FILE],
          `${bareContext} — one per-file view: the requested file (SPEC 11.4)`,
        );
        const aBareView = bareReport.views[0]!;
        assertSameJson(
          projectIdentities(aBareView.root),
          XDA_IDENTITY_TREE,
          `${bareContext} — A's tree served in full (the decode has already ` +
            `rejected any text member: absent without the flag, SPEC 12.7)`,
        );
        assertSameJson(
          aBareView.imports,
          XDA_IMPORTS,
          `${bareContext} — the import entry is flag-independent (SPEC 11.4)`,
        );
        assertSameJson(
          aBareView.occurrences,
          XDA_OCCURRENCES,
          `${bareContext} — the embedding's occurrence record is ` +
            `flag-independent: resolution never turns on --text (SPEC 5.7, ` +
            `11.2)`,
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- The cycle workspace: a consulted participant's 14.9.
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [CYE_FILE]: CYE_SOURCE,
          [CYL_FILE]: CYL_SOURCE,
        },
      });
      try {
        const gateContext =
          "T11.4-5 staging gate (`build --json`, the cycle workspace)";
        const gateFindings = await buildFindings(
          product,
          workspace,
          gateContext,
        );
        assertConditionCounts(
          gateFindings,
          { "14.9": 1 },
          `${gateContext}: the length-one embedding cycle is the ` +
            `workspace's ONLY condition — entry is finding-free (SPEC 5.3, ` +
            `14)`,
        );
        assertFindingWindows(
          findingByCondition(gateFindings, "14.9", gateContext),
          [{ file: CYL_FILE, window: widened(CYL_SELF_RANGE) }],
          `${gateContext} — the cycle locates its full path in source: the ` +
            `one participating reference spelling, the self-embedding ` +
            `container in specs/loop.mdx (SPEC 14)`,
        );

        const context =
          "T11.4-5 `view specs/entry.mdx --text` (the cycle participant is consulted)";
        const result = await expectExit(
          product,
          workspace,
          ["view", CYE_FILE, "--text"],
          1,
          `${context} — the consulted participant's cycle finding and ` +
            `poisoned text values accompany, so exit 1 with the full ` +
            `answer (SPEC 11.2)`,
        );
        const report = decodeViewReport(
          parseJsonStdout(
            result,
            `${context} — a single JSON document is the only output form ` +
              `(SPEC 11)`,
          ),
          { text: true },
          context,
        );
        assertConditionCounts(
          report.findings,
          { "14.9": 1 },
          `${context}: the entry's embedding resolves and records, so the ` +
            `cycle participant is consulted — whether or not any expansion ` +
            `completes — and its 14.9 accompanies from a consulted file ` +
            `never requested (SPEC 11.4, 14)`,
        );
        assertFindingWindows(
          findingByCondition(report.findings, "14.9", context),
          [{ file: CYL_FILE, window: widened(CYL_SELF_RANGE) }],
          `${context} — the cycle's finding lies in ` +
            `consulted-but-never-requested specs/loop.mdx (SPEC 11.4, 14)`,
        );
        assertSameJson(
          report.views.map((view) => view.file),
          [CYE_FILE],
          `${context}: the requested file alone is viewed (SPEC 11.4)`,
        );
        const entryView = report.views[0]!;
        assertSameJson(
          projectTextShape(entryView.root),
          CYE_TEXT_TREE,
          `${context} — one embedding cycle on the expansion path poisons ` +
            `the whole value: start's own/subtree text and the root's ` +
            `subtree text EXACTLY the unavailability marker, the root's ` +
            `own text defined and byte-exact (SPEC 11.2, 1.6, 3)`,
        );
        assertSameJson(
          entryView.imports,
          CYE_IMPORTS,
          `${context} — entry's import declaration (SPEC 11.4)`,
        );
        assertSameJson(
          entryView.occurrences,
          CYE_OCCURRENCES,
          `${context} — entry's embedding into the participant resolves ` +
            `and records (SPEC 5.7, 11.2)`,
        );
        assertSameJson(
          entryView.comments,
          [],
          `${context} — no MDX comment is staged (SPEC 12.7)`,
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- The masked workspace: never consulted by expansion; a requested
    // unparseable file contributes no view.
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [MKM_FILE]: MKM_SOURCE,
          [MK_GONE_FILE]: MK_GONE_SOURCE,
        },
      });
      try {
        const gateContext =
          "T11.4-5 staging gate (`build --json`, the masked workspace)";
        const gateFindings = await buildFindings(
          product,
          workspace,
          gateContext,
        );
        assertConditionCounts(
          gateFindings,
          { "14.6": 1, "14.20": 1 },
          `${gateContext}: gone.mdx is unparseable (14.20) and the ` +
            `spelling naming into it reports as unresolved (14.6) — ` +
            `nothing else (SPEC 14)`,
        );
        assertUnresolvedEmbedding(
          findingByCondition(gateFindings, "14.6", gateContext),
          { file: MKM_FILE, range: MKM_EMBED_RANGE },
          gateContext,
        );
        assertFindingLocated(
          findingByCondition(gateFindings, "14.20", gateContext),
          { file: MK_GONE_FILE },
          `${gateContext} — the parse-failure finding locates in ` +
            `specs/gone.mdx (SPEC 14)`,
        );

        // Requesting main alone: gone is never consulted by expansion — no
        // spelling resolves into a masked file — so its 14.20 does NOT
        // accompany; the blocking 14.6 lies in the requester itself.
        const soloContext =
          "T11.4-5 `view specs/main.mdx --text` (the masked file is never consulted)";
        const soloResult = await expectExit(
          product,
          workspace,
          ["view", MKM_FILE, "--text"],
          1,
          `${soloContext} — main's own finding and poisoned text values ` +
            `accompany, so exit 1 with the full answer (SPEC 11.2)`,
        );
        const soloReport = decodeViewReport(
          parseJsonStdout(
            soloResult,
            `${soloContext} — a single JSON document is the only output ` +
              `form (SPEC 11)`,
          ),
          { text: true },
          soloContext,
        );
        assertConditionCounts(
          soloReport.findings,
          { "14.6": 1 },
          `${soloContext}: exactly main's own 14.6 — the masked file's ` +
            `14.20 accompanies only when itself requested, and no spelling ` +
            `consults it by expansion (SPEC 11.4, 11.2, 14)`,
        );
        assertUnresolvedEmbedding(
          findingByCondition(soloReport.findings, "14.6", soloContext),
          { file: MKM_FILE, range: MKM_EMBED_RANGE },
          soloContext,
        );
        assertSameJson(
          soloReport.views.map((view) => view.file),
          [MKM_FILE],
          `${soloContext}: one per-file view (SPEC 11.4)`,
        );
        const soloView = soloReport.views[0]!;
        assertSameJson(
          projectTextShape(soloView.root),
          MKM_TEXT_TREE,
          `${soloContext} — the non-recording spelling poisons m's ` +
            `own/subtree text and the root's subtree text, the root's own ` +
            `text defined and byte-exact (SPEC 11.2, 1.6, 3)`,
        );
        assertSameJson(
          soloView.imports,
          MKM_IMPORTS,
          `${soloContext} — the import entry's target is the plain ` +
            `"specs/gone.mdx": discovery, not parseability, defines it ` +
            `(SPEC 11.4, 2.1)`,
        );
        assertSameJson(
          soloView.occurrences,
          [],
          `${soloContext} — the spelling naming into the masked file ` +
            `records NO occurrence: an empty list, never null (SPEC 11.2, ` +
            `5.7, 12.7)`,
        );
        assertSameJson(
          soloView.comments,
          [],
          `${soloContext} — no MDX comment is staged (SPEC 12.7)`,
        );

        // Requesting gone too: its parse-failure finding now accompanies —
        // and the unparseable requested file contributes NO view.
        const bothContext =
          "T11.4-5 `view specs/main.mdx specs/gone.mdx --text` (the masked file requested)";
        const bothResult = await expectExit(
          product,
          workspace,
          ["view", MKM_FILE, MK_GONE_FILE, "--text"],
          1,
          `${bothContext} — findings accompany, so exit 1 with the full ` +
            `answer (SPEC 11.2)`,
        );
        const bothReport = decodeViewReport(
          parseJsonStdout(
            bothResult,
            `${bothContext} — a single JSON document is the only output ` +
              `form (SPEC 11)`,
          ),
          { text: true },
          bothContext,
        );
        assertConditionCounts(
          bothReport.findings,
          { "14.6": 1, "14.20": 1 },
          `${bothContext}: the parse-failure finding accompanies exactly ` +
            `when its file is itself requested (SPEC 11.4, 14)`,
        );
        assertUnresolvedEmbedding(
          findingByCondition(bothReport.findings, "14.6", bothContext),
          { file: MKM_FILE, range: MKM_EMBED_RANGE },
          bothContext,
        );
        assertFindingLocated(
          findingByCondition(bothReport.findings, "14.20", bothContext),
          { file: MK_GONE_FILE },
          `${bothContext} — the parse-failure finding locates in ` +
            `specs/gone.mdx (SPEC 14)`,
        );
        assertSameJson(
          bothReport.views.map((view) => view.file),
          [MKM_FILE],
          `${bothContext}: an unparseable requested file contributes NO ` +
            `view — the views list stays [specs/main.mdx] (SPEC 11.4, 11.2)`,
        );
        assertSameJson(
          projectTextShape(bothReport.views[0]!.root),
          MKM_TEXT_TREE,
          `${bothContext} — main's view is unchanged beside the requested ` +
            `masked file (SPEC 11.4)`,
        );
      } finally {
        await workspace.dispose();
      }
    }

    // --- The invalid-path workspace: a requested 14.19 file keeps its view.
    {
      const workspace = await TestWorkspace.create({
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          [IP_FILE]: IP_SOURCE,
        },
      });
      try {
        const gateContext =
          "T11.4-5 staging gate (`build --json`, the invalid-path workspace)";
        const gateFindings = await buildFindings(
          product,
          workspace,
          gateContext,
        );
        assertConditionCounts(
          gateFindings,
          { "14.19": 1 },
          `${gateContext}: the '#'-containing path is the workspace's ONLY ` +
            `condition — the file itself parses (SPEC 14.19)`,
        );
        const gate19 = findingByCondition(gateFindings, "14.19", gateContext);
        assertSameJson(
          { code: gate19.code, locations: gate19.locations, path: gate19.path },
          { code: "invalid-source-path", locations: [], path: IP_FILE },
          `${gateContext} — a path-level condition carries no in-source ` +
            `location, the file as concerned path (SPEC 14, 12.7)`,
        );

        const context =
          "T11.4-5 `view specs/vi#ew.mdx --text` (an invalid-path requested file keeps its view)";
        const result = await expectExit(
          product,
          workspace,
          ["view", IP_FILE, "--text"],
          1,
          `${context} — the condition-19 finding and the unavailable ` +
            `identities accompany, so exit 1 with the full answer (SPEC ` +
            `11.2)`,
        );
        const report = decodeViewReport(
          parseJsonStdout(
            result,
            `${context} — a single JSON document is the only output form ` +
              `(SPEC 11)`,
          ),
          { text: true },
          context,
        );
        assertConditionCounts(
          report.findings,
          { "14.19": 1 },
          `${context}: the condition-19 finding accompanies every answer ` +
            `whose consulted domain includes the file (SPEC 11.2, 14)`,
        );
        const view19 = findingByCondition(report.findings, "14.19", context);
        assertSameJson(
          { code: view19.code, locations: view19.locations, path: view19.path },
          { code: "invalid-source-path", locations: [], path: IP_FILE },
          `${context} — stable code invalid-source-path, no locations, the ` +
            `file as concerned path (SPEC 14, 12.7)`,
        );
        assertSameJson(
          report.views.map((view) => view.file),
          [IP_FILE],
          `${context}: a bare <file> operand is a whole path — '#' has no ` +
            `delimiter role — naming the discovered file of that invalid ` +
            `path, whose view is served (SPEC 12.0, 11.4)`,
        );
        const ipView = report.views[0]!;
        assertSameJson(
          projectTextShape(ipView.root),
          IP_TEXT_TREE,
          `${context} — structure is parse-local: the tree and byte-exact ` +
            `ranges are served with every identity — root included — ` +
            `EXACTLY the unavailability marker (no identity over an ` +
            `invalid path) while every text value is defined and ` +
            `byte-exact: expansion definedness turns on ` +
            `occurrence-recording spellings alone (SPEC 11.2, 1.6, 3)`,
        );
        assertSameJson(
          [ipView.imports, ipView.occurrences, ipView.comments],
          [[], [], []],
          `${context} — no import, reference spelling, or MDX comment is ` +
            `staged: empty lists are [], never null (SPEC 11.4, 12.7)`,
        );
      } finally {
        await workspace.dispose();
      }
    }
  },
});

export const section114Tests: readonly ProductTestEntry[] = [
  T11_4_1,
  T11_4_2,
  T11_4_3,
  T11_4_4,
  T11_4_5,
];
