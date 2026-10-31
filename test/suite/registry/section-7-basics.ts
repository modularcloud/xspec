// TEST-SPEC §7 basics (configuration location, declarative form, keys;
// validation on a built workspace) — SUITE-26: T7-1…T7-3 and T7-7.
// Discovery (T7-4…T7-6) and the §7.1–7.5 tests belong to later tasks
// (SUITE-27…SUITE-29), not this module.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes reports through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 7: projects are configured by `xspec.config.ts`, located by upward
// search for that name from the working directory or by the global
// `--config <path>` option (a filesystem path resolved against the working
// directory, 12.0); the configuration file's directory is the workspace
// root. The configuration is declarative — exactly an import of
// `defineConfig` (optionally aliased) whose module specifier is any static
// string literal, and a default export of one call to that binding with a
// statically literal argument; anything else is a configuration error
// (14.14), reported by every command at configuration load as a usage error
// (exit 2), before all source analysis.
// `specs` is required; `code`, `markdown`, `coverage`, and `policy` are
// optional with defined omission semantics; empty `coverage`/`policy` lists
// equal omission; unknown keys anywhere in the argument are 14.14, as is a
// value of the wrong shape — 14.14's "otherwise invalid group shape" (7.1,
// 7.2, 7.4, 7.5: `specs` and `code` are maps of named groups, each a list
// of glob strings; `coverage` and `policy` are lists).
//
// Conservative operationalizations (noted per H-3/H-4):
// - 14.14 contract: `expectConfigurationError` (shared, ./support.ts) — run
//   with `--json`, exit 2 exactly, stdout exactly the single 12.7 error
//   document carrying the stable code `configuration-error` and a concerned
//   path (12.0/12.7, H-5), and a standard-error message matching /config/i —
//   the actionable configuration-error message must identify the
//   configuration as the failing subject, and any phrasing naming either
//   the file (`xspec.config.ts`) or the condition ("configuration",
//   "config…") qualifies; wording is otherwise free (H-3).
// - T7-1 "no configuration reachable": the workspace is a fresh unique
//   temporary directory (H-1) whose filesystem ancestors (the OS temp
//   directory and its parents) hold no `xspec.config.ts`, so the upward
//   search exhausts without a hit — H-1's ancestor precondition, verified
//   before the arm runs (`assertSelfContainedRoot`,
//   helpers/self-contained-root.ts: no ancestor of the root holding an
//   entry of that name, and the root inside no git working tree), an unmet
//   one a harness error, never a pass or a product failure.
// - T7-1 `--config` naming a nonexistent file: run from the location
//   fixture's root, whose own `xspec.config.ts` the upward search would
//   find, naming `alt/missing.config.ts` — absent, beside `alt/`'s valid
//   configuration — so a product falling back to the search, or to a
//   configuration near the named path, builds and exits 0, and a product
//   classing the failed `--config` as a plain usage error reports `code`
//   and `path` null (T12.7-3). The concerned path is asserted exactly as
//   the argument spells it: zero ascent segments, two descending ones, no
//   `.` segment — already 11.6's canonical form (the sibling-directory
//   ascent spelling is T12.7-3's arm); a whole-root snapshot compare around
//   the invocation pins that nothing is written (SPEC 12.1).
// - T7-1 occupancy (SPEC 7: the upward search stops at the nearest directory
//   holding an entry named `xspec.config.ts`, whatever occupies it, and the
//   occupant is read only when it is a plain file; a directory or a symbolic
//   link, whatever it targets, is missing or invalid configuration, 14.14,
//   never read through): one workspace with a valid root configuration and
//   two working directories beneath it, `dirocc/` holding an empty directory
//   named `xspec.config.ts` and `linkocc/` a symbolic link of that name to
//   the valid root configuration itself — so a product skipping the
//   occupant, or following the link, loads a valid configuration and exits
//   0. "Every command but `version`" is operationalized as the complete
//   command set of SPEC 12 with `review` and `query` by every subcommand
//   (26 invocations), each spelled syntactically complete so that no
//   syntax-class usage error, reported without loading configuration (12.0),
//   can precede the configuration load; every invocation is pinned to exit
//   2 with the error document's finding — `configuration-error`, locations
//   [], the concerned path the occupied entry itself in 11.6's anchoring
//   form: `xspec.config.ts` from its own directory, never `../xspec.config.ts`
//   (the valid file above) and never the link's target. The same set names
//   each entry through `--config` from the root (`dirocc/xspec.config.ts`,
//   `linkocc/xspec.config.ts`: the path as given, already canonical, so the
//   two conventions of T12.7-3 coincide). `version` answers exit 0 from both
//   working directories (12.6), a whole-root compare brackets the sweeps
//   (12.1), and the premise — the root configuration valid, discovering
//   `specs/A.mdx` — is driven last (`ids` regenerates graph data, 13.3) so
//   the sweeps observe a tree holding no derived file or graph data.
// - T7-1 name casing (SPEC 7, 12.0: the search stops at an entry named
//   `xspec.config.ts`, and names compare byte-wise and case-sensitively, no
//   case folding): the valid canonical configuration and `specs/A.mdx` at
//   the root, and beneath it the working directory `sub/` holding one
//   entry, the plain file `XSPEC.config.ts` holding `)` — no well-formed
//   TypeScript (a staged-source record declared unparseable, 14.20) and
//   matched by no group's glob — and no entry named `xspec.config.ts`. The
//   search passes `sub/` and loads the root's configuration: `build` and
//   then `check`, each run from `sub/`, exit 0; a product matching the name
//   case-insensitively, or finding the file through a case-insensitive
//   filesystem lookup, reads `)` and exits 2 with 14.14. The fixture holds
//   one casing alone, so it stages identically on any filesystem; its
//   staging is verified before the first run by listing `sub/` — exactly
//   the one entry, its name compared byte-wise, a plain file — never by
//   looking `xspec.config.ts` up, which a case-insensitive filesystem
//   answers with the `XSPEC.config.ts` entry itself. One shared code path
//   (`runT71ConfigNameCasingProbe`): the registered body runs it last, and
//   the Windows leg reruns it (E-6, test/windows/e6-subset.test.ts), where
//   no case-sensitive filesystem masks a product resolving the name through
//   filesystem lookups.
// - T7-2 single-deviation staging: every invalid fixture is the valid
//   canonical configuration with exactly one deviation, so the refusal is
//   attributable to the arm's malformation and nothing else.
// - T7-2 import modifiers (SPEC 7): four arms — `import type { … }`,
//   `import { type … }`, `import defer { … }`, and an import carrying
//   `with { type: "json" }` — each the canonical configuration with only
//   its import line changed. Every one is a text TypeScript 5.9.3 accepts
//   both as module code and as script code, so each record is declared
//   well-formed (S-9; the same four texts are vectors of
//   test/self/s9-typescript-well-formedness.test.ts) and the refusal is the
//   declarative form's (14.14), never a parse failure's; a product reading
//   the binding loosely loads each and builds (exit 0), failing the
//   exit-code assertion.
// - T7-2's import arms never vary the import's module specifier: SPEC 7
//   accepts any static string literal there, so an import from a specifier
//   other than `"xspec"` is valid — T7-9's subject (its single-casing
//   `"XSPEC"` among T7-9(a)'s spellings), never a T7-2 refusal.
// - T7-2's further form arms (SPEC 7: a literal set of strings and the two
//   booleans, non-computed identifier or string-literal keys, one call
//   whose sole argument is statically literal): `markdown: { emit: true,
//   outDir: null }` and a profile's `targetTags: null`, one arm each —
//   `null` lies outside 7's literal set, though `inventory` reports unset
//   members as `null` (12.7) — each fixture valid with the member omitted
//   (the profile's target and boundary the unambiguous group `main`), so a
//   product reading `null` as an omitted member loads it and builds (exit
//   0); `defineConfig()` and `defineConfig({…}, {})`, the second's first
//   argument the canonical configuration, so a product reading the first
//   argument alone loads it; and the numeric-literal key
//   `specs: { 1: ["specs/*.mdx"] }`, spelled as TEST-SPEC spells it (its
//   glob, like the canonical one, matches the staged `specs/A.mdx`), which
//   TypeScript admits and a product reading keys loosely takes for a group
//   named `1`. Every one is a text TypeScript 5.9.3 accepts both as module
//   code and as script code, so each record is declared well-formed (S-9)
//   and the refusal is the declarative form's (14.14), never a parse
//   failure's.
// - T7-2's wrapped forms and call variants (SPEC 7: the file consists of
//   exactly the import and a default export of one call to that binding
//   whose sole argument is statically literal — no other statement or
//   expression form, comments alone permitted beside them): nine arms, one
//   each, every one the canonical configuration with one deviation — the
//   call wrapped (`export default defineConfig({…}) satisfies object`,
//   `export default (defineConfig({…}))`, and `export default
//   defineConfig({…})!`), the argument wrapped (`defineConfig({…} as
//   const)`, `defineConfig(({…}))`), a value inside it wrapped (`markdown:
//   { emit: true as boolean }`, the fixture valid with `emit: true`, and
//   `specs: ({…})`), and the call spelled with syntax outside 7's list
//   (`defineConfig<object>({…})`, carrying type arguments, and
//   `defineConfig?.({…})`, an optional call). Every one is a text
//   TypeScript 5.9.3 accepts both as module code and as script code, so
//   each record is declared well-formed (S-9) and the refusal is the
//   declarative form's (14.14), never a parse failure's; a product
//   skipping TypeScript's outer expressions (parentheses, type assertions,
//   `satisfies`, and non-null assertions) before reading the form, or
//   reading a call by its callee and arguments alone, loads each and
//   builds (exit 0), failing the exit-code assertion.
// - T7-2's binding forms (SPEC 7: exactly an import of `defineConfig`,
//   optionally aliased; 2.4: every configuration literal, an import name
//   spelled as a string literal included, is read verbatim): the
//   string-literal import name, `import { "defineConfig" as d } from
//   "xspec"` with `export default d({…})` over the canonical argument, is
//   that import, aliased — it loads, and `inventory`'s `configuration` is
//   byte-identical to its identifier-named twin's, `import { defineConfig
//   as d } from "xspec"`, the same file but for the name's quotes
//   (compared as the comments arm compares, below; `bindingFormConfig`
//   composes both). Refused, one arm each (14.14, exit 2): its
//   escape-spelled twin, the same file with the name's `C` written as the
//   hexadecimal escape of U+0043 (backslash, `x43`; the backslash built
//   from `BACKSLASH`, and the spelling checked at module load), which,
//   read verbatim, imports no `defineConfig`; and a default import
//   (`import defineConfig from "xspec"`), a namespace import (`import * as
//   X from "xspec"` with `export default X.defineConfig({…})`), an extra
//   default binding (`import d, { defineConfig } from "xspec"`), and an
//   extra named binding (`import { defineConfig, other } from "xspec"`),
//   each the canonical configuration with only its import line — and, for
//   the namespace import, the callee — changed. Every one of these texts
//   is accepted by TypeScript 5.9.3 both as module code and as script code,
//   so each record is declared well-formed (S-9) and a refusal is the
//   declarative form's (14.14), never a parse failure's. A product reading
//   identifier import names alone refuses the string-literal name and
//   fails `build`'s exit code; one reading the binding loosely — decoding
//   the name's escape, or taking any import that binds or reaches
//   `defineConfig` for the import of it — loads a refused text and builds
//   (exit 0), failing the exit-code assertion.
// - T7-2's statement forms (SPEC 7: exactly an import of `defineConfig` and
//   a default export of one call to that binding, no other statement form):
//   TypeScript's two CommonJS-interop statements, one arm each, every one
//   the canonical configuration with one deviation — an export assignment,
//   `export = defineConfig({…})` beside `import { defineConfig } from
//   "xspec"`, which is no default export, and an import assignment, `import
//   defineConfig = require("xspec")` beside `export default
//   defineConfig({…})`, which binds the module itself and, like the default
//   and namespace imports, imports no `defineConfig`. Each is a text
//   TypeScript 5.9.3 accepts both as module code and as script code, so
//   each record is declared well-formed (S-9) and the refusal is the
//   declarative form's (14.14), never a parse failure's; a product taking
//   an export assignment for a default export, or an import assignment for
//   an import of `defineConfig`, loads it and builds (exit 0), failing the
//   exit-code assertion.
// - T7-2's statement order (SPEC 7 fixes which statements the file holds,
//   never their order; an import binds its name throughout its module, so
//   a call spelled before it calls that binding): the canonical
//   configuration's two statements exchanged, `export default
//   defineConfig({…})` first and `import { defineConfig } from "xspec"`
//   after it — a text TypeScript 5.9.3 accepts both as module code and as
//   script code — loads: `build` and then `check` exit 0, and `inventory`'s
//   `configuration` is byte-identical to its import-first twin's, the
//   canonical file itself (compared as the comments arm compares, below).
//   `twoStatementConfig` composes both orders from the same two statements,
//   and a module-load self-check pins the import-first order to the
//   canonical text, so the two files differ in the statements' order
//   alone. A product requiring the import first refuses the file and fails
//   `build`'s exit code.
// - T7-2 string-literal keys arm: "both groups discover their globs' files"
//   is observed as the spec group's exact `ids` listing plus whole-graph
//   edge-set equality carrying the code file's marker edge (T7-3's
//   contrapositive: an undiscovered code file sources no edge); "resolve"
//   is observed as the quoted-name coverage profile's covered/uncovered
//   rows (counts and ignored composition stay T8.2-1's subject, the
//   section-8 discipline) and as the policy selector's violation reported
//   per the SPEC 14.12 contract — identities in order the rule name and the
//   offending edge's source, kind token, and target; `locations` [], `path`
//   `null`.
// - T7-3 "the unfiltered `query edges` list carries no edge from it":
//   asserted as exact whole-graph edge-set equality — the minimal fixture's
//   complete edge set is spec-forced (SPEC 5.1–5.2: one contains edge per
//   parent/child pair and nothing else), so an edge sourced at the
//   undiscovered `.ts` file, or any other stray edge, fails the equality.
// - T7-3 "no `.md` is written for any source": after `build`, a full
//   recursive scan of the workspace tree outside the graph-data area finds
//   no file whose name ends in `.md` (stronger than probing the default
//   next-to-source destinations: emission anywhere would fail it). The scan
//   walks by exact name bytes (snapshot keys), so a directory whose name is
//   not valid UTF-8 is reached, never misnamed, and it leaves `.xspec/` out:
//   graph data there bears names the product chooses, a `.md` suffix
//   included (SPEC 13.3: its layout "deliberately unenumerated"), and no
//   emit destination lies in the area (7.3), so nothing there is emitted
//   Markdown (H-4).
// - T7-3 `--from` unknown: exit 2 with the single 12.7 error document as
//   the entire stdout (SPEC 11: `query` is a JSON-only surface, so JSON
//   output is in effect without `--json`, and 12.0 makes an exit-2 error
//   emit the error document) and a non-empty stderr diagnostic (12.0: usage
//   error messages are standard-error content). This usage error is not a
//   14.14, so no /config/i duty applies.
// - T7-3 value shapes: seven fixtures — TEST-SPEC's "one arm each" over a
//   spec group and a code group valued by a single string, a glob list
//   holding `true`, `coverage` and `policy` given as `{}`, and `specs` and
//   `code` given as lists — each SPECS_ONLY_CONFIG with one shape deviation
//   the declarative form of 7 admits, so the refusal is 14.14's
//   non-conformance (an invalid group shape), never a form error (T7-2).
//   The `[true]` fixture matches no staged file: a product tolerating it
//   (dropping or stringifying the element) discovers no source and builds
//   anyway — a group matching no files is valid (7) — so exit 0 still
//   discriminates it.
// - every `expectConfigRefused` arm (T7-2, T7-3): the finding's concerned
//   path is exactly `xspec.config.ts` — the file the upward search found,
//   in 11.6's anchoring form relative to the invocation working directory,
//   the workspace root (SPEC 14, 12.7) — its locations [] (a configuration
//   condition carries the file it concerns, no source range; 14), and a
//   whole-root snapshot compare around the invocation pins that nothing is
//   written (12.1).
// - T7-2 verbatim literals (SPEC 7, 2.4): the escape spellings are built
//   from the backslash's code point (`BACKSLASH`), never written as an
//   escape in harness source, which would interpret it. "Matching no
//   discovered file, discovering zero sources" is observed twice — the
//   inventory's `sources` (discovery reported directly, no source parsed,
//   11.6) and `ids`'s file listing, both exactly empty — beside the
//   inventory's resolved configuration view carrying the glob and, in the
//   group-name arm, the group name as spelled (the six escape characters
//   included), so a product interpreting the escape fails on the
//   reported spelling as well as on the file it then discovers. "Resolves"
//   for the escape-spelled target is the profile's reported rows: with the
//   boundary the same group, the target set is the group's one leaf,
//   uncovered (8.1, 8.2); the `target: "product"` twin differs in that one
//   value alone and is refused as an unknown group (7.4, 14.14).
// - T7-2 keys and enumerated values read as spelled (SPEC 7, 2.4; the
//   spellings 7.6's covered-file bar cites), an identifier key's alike:
//   `specs` with its `s` written as the hexadecimal escape of U+0073 as a
//   string-literal top-level key, and as the Unicode escape of U+0073 as an
//   identifier one; `direct` with its `d` written as the hexadecimal escape
//   of U+0064 as a profile's `mode`; `ab` with its `b` written as the
//   hexadecimal (string literal) or Unicode (identifier) escape of U+0062
//   as a group key beside `ab`; and the verbatim group name keyed as an
//   identifier. Each spelling is built from `BACKSLASH` and pinned at
//   module load (`checkedEscapeSpelling`: one backslash, then the escape's
//   text, which designates the character it replaces, and the spelling
//   with it decoded), and each composed file is checked to hold the
//   backslashes its spellings bring and no other. The refused top-level-key
//   and `mode` arms (`SPELLED_KEY_VIOLATIONS`, and the first row of
//   `SPELLED_IDENTIFIER_KEY_VIOLATIONS`) are each the canonical
//   configuration — for `mode`, the `targetTags: null` row's valid twin —
//   with the one escape as its deviation, valid with it decoded
//   (`canonicalWithSpecsKey`, pinned to the canonical text for the plain
//   key), so a product decoding escapes loads each and builds (exit 0).
//   The identifier-keyed group name is the group-name arm above with its
//   key an identifier: refused under `target: "product"` (the table's
//   second row; a product decoding every escape loads it, one decoding the
//   identifier alone refuses its resolving twin) and resolving under the
//   escape spelling, observed alike (`expectVerbatimGroupNameResolves`).
//   "Two groups, no key repeated — it loads, `inventory` reporting both,
//   each discovering its own glob's file" is observed after `build` exits
//   0 as `inventory`'s `configuration.specs`, exactly `ab` (`a/*.mdx`) and
//   the escape-spelled key's group (`b/*.mdx`) named as spelled, in
//   configuration order, and its `sources`, exactly `a/A.mdx` a member of
//   `ab` alone and `b/B.mdx` of the other alone, in byte order of path
//   (11.6), over the minimal sources a and b (`expectTwoSpelledGroups`); a
//   product decoding the escape reads the key `ab` twice and refuses the
//   file (14.14), failing `build`'s exit code.
// - T7-2 encoding: the non-UTF-8 fixture carries its one invalid byte
//   (0xFF) inside a trailing line comment, so the decoded text is a valid
//   configuration and the encoding is the sole defect; the BOM fixture is
//   the canonical text prefixed by EF BB BF. Both are staged as bytes
//   (records whose source is a byte array), never as strings.
// - T7-2 repeated keys: 14.14 whatever TypeScript's own diagnosis of the
//   repetition (SPEC 7) — the arms pin the 14.14 contract alone, so a
//   product reporting it through a compiler diagnostic and one detecting
//   it itself pass alike, while one taking the last member loads and
//   builds (exit 0).
// - T7-2 comments (SPEC 7: comments are permitted anywhere and contribute
//   nothing): one commented file holds line and block comments at every
//   position TEST-SPEC lists — before the import, inside the import
//   declaration between each two of its tokens (spelled as TEST-SPEC
//   spells it, its line comment after `from` putting the module specifier
//   on the next line), inside the argument between keys and inside the
//   glob list, and after the export — and at others besides (after the
//   import, after the glob list, after everything); its twin is the same
//   file with every comment removed. The commented file is declared
//   well-formed (S-9). A product reading the import declaration by its
//   tokens' adjacency, or a line at a time, refuses the commented file and
//   fails `build`'s exit code.
// - T7-2 comments, the string-literal import name, and statement order:
//   "inventory's `configuration` byte-identical to its comment-free twin's"
//   (to its identifier-named twin's, to its import-first twin's) is
//   compared as the `configuration` member of each `inventory --json`
//   document (form-decoded first), as values and as serializations — member
//   order included (`configurationViewOf`, after `build` loads the file and,
//   for the statement-order arm, `check` exits 0, and
//   `assertConfigurationViewsIdentical`).
// - T7-3 U+FFFD names: the character is staged as the validly encoded code
//   point EF BF BD between two letters — a spec group's and a code group's
//   string-literal key, a profile name, a rule name — so 14.14's name rule,
//   never the encoding rule, is at stake; each fixture is otherwise valid.
// - T7-7 validation on a built workspace (SPEC 7, 7.2, 14.14: the
//   configuration path's occupant and the sources discovered are judged as
//   they stand at each invocation, whatever graph data records): one
//   workspace declaration (`T7_7_WORKSPACE`) — `specs/A.mdx` under the spec
//   group `main` (`specs/**/*.mdx`), `src/impl.ts` under the code group
//   `app` (`src/**/*`), and the spec group `inner` (`src/**/*.mdx`)
//   matching no file, so the spec and code globs overlap on no path
//   occupied at the build — staged afresh for each arm and built there
//   (exit 0, graph data left current), then staged: (a) the root's
//   `xspec.config.ts` deleted and replaced by a symbolic link to a plain
//   file holding its byte-identical content, the link's target spelled
//   relative to the root — `config/linked.config.ts`, inside the workspace
//   at a path no group matches, and separately `../outside/linked.config.ts`,
//   outside it, in the workspace's own temporary directory
//   (`stageBesideRoot`); (b) `src/x.mdx` created, matched by `inner` and
//   `app` alike. Each staging is verified first (H-9): the root entry a
//   symbolic link storing the target as spelled and resolving to it, the
//   target a plain file holding the configuration's bytes — an ineffective
//   staging a harness error; nothing at `src/x.mdx` before it is created —
//   a staging premise over a tree the product has built, so an occupant is
//   a diagnosed failure. From the root, each of `build`, `check`, `ids` and
//   `occurrences` (a read of each family 13.3 names: the gated reads, and
//   the reads answering from the current sources per 11.2), `inventory`,
//   `rename specs/A.mdx a a2 --preview`, and `rename specs/A.mdx a a2` is
//   held under `--json` to the 14.14 contract (`expectConfigurationError`)
//   with the error document's one finding exactly `code`
//   `configuration-error`, `path` `xspec.config.ts` — the path the upward
//   search found, whatever occupies it, in 11.6's anchoring form (SPEC 14;
//   T12.7-3) — and `locations` [] (an unlocated condition); a whole-root
//   snapshot compare around each run pins that nothing is modified, the
//   link among the compared entries (its stored target) and, inside the
//   root, its target — H-6's classification: around the `rename`, a
//   mutating command's run, the lock path alone is left out; around every
//   other command it is compared like any path — the outside target's
//   directory is compared around each run too, and `.xspec/lock` is
//   asserted absent once each run has ended. `version --json` answers exit
//   0 last (12.6: it consults no configuration). The unstaged twin, driven
//   first on a workspace of its own staged and built alike, is the premise
//   that gives the exit 2s their meaning: `check --json` exit 0 with the
//   finding-free report (graph data current), then the `rename --preview`
//   and the `rename` each exit 0 — the operation the arms drive is one
//   succeeding on the unstaged twin. A product reading the configuration
//   through the link loads the valid configuration and answers, and one
//   reusing a recorded configuration parse while the configuration's bytes
//   and its recorded sources' hashes match never meets the file both
//   groups match: each fails an exit-code assertion.
// - Staged-source records (TEST-SPEC S-9's before-any-product clause;
//   helpers/staged-mdx.ts): every `.mdx` file a body stages in a workspace
//   created after its first product invocation — `expectConfigRefused`'s
//   one staging site (serving every arm, the first included), T7-1's
//   no-configuration, occupancy, and name-casing workspaces, T7-2's and
//   T7-3's later arms, T7-7's arm workspaces (each created after the
//   unstaged twin's invocations) and arm (b)'s `src/x.mdx` — is a ledger
//   record, judged by test/self/s9-staged-sources.test.ts before any
//   product exists: `src/x.mdx` is declared well-formed MDX alone, the
//   configuration error its double match makes preceding all source
//   analysis (SPEC 14), as section-13.5.ts's `src/both.mdx`. The minimal
//   `mdxSection("a")` and `mdxSection("b")` sources are staged
//   byte-identically by this module, section-7-discovery.ts,
//   section-7.1-7.3.ts, and (the `a`) section-7.4-7.5.ts, so each is ONE
//   record, exported from here and named with every staging test in ID
//   order and every path. T7-1's first workspace (`LOCATION_FILES`)
//   precedes any invocation and stays plain; T7-7's first, its unstaged
//   twin, stages the same records as its arms.
// - TypeScript staged-source records (TEST-SPEC S-9's TypeScript and
//   timing clauses; helpers/staged-ts.ts): every configuration file and
//   code source a body stages in a workspace created after its first
//   product invocation — `expectConfigRefused`'s one staging site (serving
//   every arm of every refused-configuration table, the first included:
//   `refusedConfigArms` makes one record per row at module load), T7-1's
//   occupancy and name-casing workspaces, T7-2's and T7-3's later arms,
//   T7-7's arm workspaces and arm (a)'s inside link target — is a ledger
//   record carrying its S-9 declaration (T7-2's syntax-error and encoding
//   arms and T7-1's `XSPEC.config.ts` holding `)` unparseable, 14.20;
//   every other well-formed), judged by test/self/s9-staged-sources.test.ts
//   before any product exists. The canonical `SPECS_ONLY_CONFIG` is one
//   record wherever it is staged, `LOCATION_FILES` included; so is T7-7's
//   configuration (`T7_7_CONFIG`), at `xspec.config.ts` and at the inside
//   link target, its text the bytes the outside target is written with
//   beyond the root.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { GraphEdge } from "../../helpers/adapters/index.js";
import {
  decodeCoverageReport,
  decodeEdgesReport,
  decodeFindingsReport,
  decodeIdsReport,
  decodeInventoryDocument,
  decodeVersionDocument,
} from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  bytesEqual,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { assertLockPathAbsent } from "../../helpers/lock-state.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import {
  assertSnapshotsEqual,
  displaySnapshotPath,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import { assertSelfContainedRoot } from "../../helpers/self-contained-root.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import { type StagedTs, stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { runProduct, summarizeResult } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type {
  InitialFileContents,
  WorkspaceDecl,
} from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertEdgeSetEqual,
  assertSameJson,
  buildOk,
  expectConfigurationError,
  expectErrorDocument,
  expectExit,
  expectFindingFreeReport,
  REPLACEMENT_CHARACTER,
  runJson,
  stageBesideRoot,
} from "./support.js";

// ---------------------------------------------------------------------------
// Shared fixture material
// ---------------------------------------------------------------------------

/** A minimal single-section source: one node `<id>` under the file root. */
function mdxSection(id: string): string {
  return `<S id="${id}">\nText for ${id}.\n</S>\n`;
}

// The minimal sources the §7 modules stage in workspaces created after a
// body's first product invocation (module header): byte-identical wherever
// they are staged — `mdxSection("a")` at `specs/A.mdx` here (and at
// `a/A.mdx`, T7-2's keys read as spelled) and in section-7-discovery.ts,
// section-7.1-7.3.ts, section-7.4-7.5.ts (T7.4-1, T7.5-1; T7.5-2 at
// `lo/BASE.mdx` alone; T7.5-5 also at `tgt/a.mdx`), and section-12.6.ts
// (T12.6-1, T12.6-2: the version workspaces' minimal source, the same
// bytes); `mdxSection("b")` at `specs/sub/B.mdx` (T7-3, T7-6, T7.3-1),
// `b/B.mdx` (T7-2's keys read as spelled), and
// `specs2/B.mdx` (T7-4) — so each is ONE staged-source record, named with
// every staging test in ID order and every path; the other modules import
// them (section-7.4-7.5.ts and section-12.6.ts the `a` alone).
export const SECTION_A_SOURCE = stagedMdx(
  "T7-1/T7-2/T7-3/T7-4/T7-6/T7-7/T7.1-1/T7.3-1/T7.4-1/T7.5-1/T7.5-2/T7.5-5/T12.6-1/T12.6-2 specs/A.mdx (the minimal section a; T7-2's a/A.mdx; T7.5-2's lo/BASE.mdx; T7.5-5's tgt/a.mdx)",
  mdxSection("a"),
);
export const SECTION_B_SOURCE = stagedMdx(
  "T7-2/T7-3/T7-4/T7-6/T7.3-1 the minimal section b (specs/sub/B.mdx; T7-2's b/B.mdx; T7-4's specs2/B.mdx)",
  mdxSection("b"),
);

// The canonical valid configuration (SPEC 7): exactly one spec group, no
// optional keys. Every T7-2 violation below is this file with one deviation.
// A staged-source record (module header): T7-1's occupancy and name-casing
// workspaces, T7-2's statement-order arm (the import-first twin), and T7-3's
// omission arms stage it in workspaces created after a product invocation;
// T7-1's first workspace passes the record too, and T7-2's encoding arms
// compose their bytes from its text.
const SPECS_ONLY_CONFIG = stagedTs(
  "T7-1/T7-2/T7-3 xspec.config.ts (the canonical configuration: exactly one spec group, no optional keys)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

/**
 * A configuration record's text: every configuration this module composes
 * from is a string; anything else is a defect of the module's fixtures.
 */
function configText(record: StagedTs): string {
  if (typeof record.source !== "string") {
    throw new Error(
      `${record.name}: the staged configuration must be a string (the ` +
        "module composes text, never bytes)",
    );
  }
  return record.source;
}

/** A refused-configuration arm (T7-2, T7-3): its label and its record. */
interface RefusedConfigArm {
  readonly label: string;
  readonly config: StagedTs;
}

/**
 * An arm table's rows as refused-configuration arms, each configuration a
 * staged-source record made at module load from its row — the expression
 * moved, never re-spelled — named `<TEST-ID> xspec.config.ts (<label>)` and
 * carrying the row's S-9 declaration: unparseable (14.20) where TEST-SPEC
 * declares it so, else well-formed. `expectConfigRefused` stages every arm
 * in a workspace created after the body's first product invocation, the
 * first arm's excepted (S-9's timing clause; module header).
 */
function refusedConfigArms(
  testId: string,
  rows: readonly {
    readonly label: string;
    readonly config: string;
    /** S-9: TEST-SPEC declares this configuration unparseable (14.20). */
    readonly unparseable?: true;
  }[],
): readonly RefusedConfigArm[] {
  return rows.map((row) => ({
    label: row.label,
    config: stagedTs(
      `${testId} xspec.config.ts (${row.label})`,
      row.config,
      row.unparseable === true ? "unparseable" : "well-formed",
    ),
  }));
}

/** Stage a fresh workspace, run `body`, dispose (H-1). */
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
 * Stage a workspace whose only defect is the given configuration — a
 * staged-source record carrying its S-9 declaration (unparseable for
 * T7-2's syntax-error and encoding arms, 14.20; else well-formed), since
 * every arm but a body's first is staged after a product invocation (S-9's
 * timing clause) — and assert `build --json` refuses it per 14.14. The
 * staged source file is valid and matched by every fixture's
 * `specs/**\/*.mdx` glob (or, where the deviation replaces that glob, by
 * nothing — a group matching no files is valid, SPEC 7), so a product that
 * wrongly accepts the configuration proceeds to a successful build (exit
 * 0) and fails the exit-code assertion — never exits 2 for a side reason.
 * Beyond the shared 14.14 contract (`expectConfigurationError`), the
 * finding is pinned to the configuration file: its concerned path is
 * exactly `xspec.config.ts` — the file the upward search found, in the
 * anchoring form of 11.6 relative to the invocation working directory,
 * here the workspace root, so the bare name (SPEC 14, 12.7) — and its
 * locations are [] (a configuration condition carries the file it
 * concerns, no source range; SPEC 14); a whole-root snapshot compare
 * around the invocation pins that a build failing at configuration load
 * writes nothing (SPEC 12.1).
 */
async function expectConfigRefused(
  product: ProductBinding,
  config: StagedTs,
  context: string,
): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": config,
        "specs/A.mdx": SECTION_A_SOURCE,
      },
    },
    async (workspace) => {
      const before = await snapshotDirectory(workspace.root);
      const result = await expectConfigurationError(
        product,
        workspace,
        ["build"],
        context,
      );
      const finding = expectErrorDocument(result, context);
      assertSameJson(
        {
          code: finding.code,
          path: finding.path,
          locations: finding.locations.map((location) => location.file),
        },
        {
          code: "configuration-error",
          path: "xspec.config.ts",
          locations: [],
        },
        `${context}: the error document's one finding carries the stable ` +
          `code "configuration-error", locations [] (a configuration ` +
          `condition carries the file it concerns, never a source range), ` +
          `and as its concerned path the configuration file the upward ` +
          `search found, in the anchoring form of 11.6 relative to the ` +
          `invocation working directory — the workspace root, so exactly ` +
          `"xspec.config.ts" (SPEC 14, 12.7, 11.6)`,
      );
      assertSnapshotsEqual(
        before,
        await snapshotDirectory(workspace.root),
        `${context}: a build failing at configuration load modifies ` +
          `nothing (SPEC 12.1, 12.0) — no derived file or graph data ` +
          `appears anywhere under the root`,
      );
    },
  );
}

// ---------------------------------------------------------------------------
// T7-1 — configuration location
// ---------------------------------------------------------------------------

// Two complete projects in one tree: the root configuration (found by upward
// search) discovers specs/A.mdx; the alternative configuration at
// alt/xspec.config.ts — same text, so its identical glob resolves relative
// to *its* directory (SPEC 7: the configuration file's directory is the
// workspace root) — discovers alt/specs/B.mdx as `specs/B.mdx`. The two
// listings differ in both file and ID, so which configuration served a run
// is unambiguous.
const LOCATION_FILES: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": SPECS_ONLY_CONFIG,
  "specs/A.mdx": mdxSection("a"),
  "alt/xspec.config.ts": SPECS_ONLY_CONFIG,
  "alt/specs/B.mdx": mdxSection("b"),
};

// The nested working directories: `nested/inner` for the upward-search run
// (two levels below the root configuration), `nested` for the --config run
// (so the relative --config path resolves correctly only against the
// working directory: against the workspace root or the search result it
// names a nonexistent file).
const SEARCH_CWD = "nested/inner";
const OVERRIDE_CWD = "nested";
const OVERRIDE_CONFIG_ARG = "../alt/xspec.config.ts";
// The nonexistent --config path, run from the workspace root: two
// descending segments, no `.` segment — the argument's own spelling is
// already the canonical anchoring form (SPEC 11.6), so the concerned path is
// asserted exactly as given (SPEC 14; T12.7-3).
const MISSING_CONFIG_ARG = "alt/missing.config.ts";

// --- T7-1 occupancy (SPEC 7, 14.14) ---------------------------------------

// A valid configuration at the root discovers specs/A.mdx; beneath it, two
// working directories each hold an entry named `xspec.config.ts` that is not
// a plain file: OCCUPANCY_DIR_CWD's is an empty directory, OCCUPANCY_LINK_CWD's
// a symbolic link to the valid root configuration itself. SPEC 7: the upward
// search stops at the nearest directory holding an entry of that name —
// whatever occupies it — and the occupant is read only when it is a plain
// file; any other occupant is missing or invalid configuration (14.14), never
// read through. The discriminating structure: a product skipping a non-file
// entry and continuing upward finds the valid root configuration and exits 0;
// a product following the link loads that same valid configuration and exits
// 0 (rooted at the link's directory or at the root, either way exit 0) —
// both fail the exit-2 assertion, and a product reporting the file above
// (`../xspec.config.ts`) or the link's target fails the concerned-path pin.
const OCCUPANCY_DIR_CWD = "dirocc";
const OCCUPANCY_LINK_CWD = "linkocc";
const OCCUPANT_NAME = "xspec.config.ts";
const OCCUPANCY_DIR_ENTRY = `${OCCUPANCY_DIR_CWD}/${OCCUPANT_NAME}`;
const OCCUPANCY_LINK_ENTRY = `${OCCUPANCY_LINK_CWD}/${OCCUPANT_NAME}`;
const OCCUPANCY_WORKSPACE: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPECS_ONLY_CONFIG,
    "specs/A.mdx": SECTION_A_SOURCE,
  },
  dirs: [OCCUPANCY_DIR_ENTRY],
  // The link's target is spelled relative to the link's own directory: the
  // valid configuration one level up.
  symlinks: { [OCCUPANCY_LINK_ENTRY]: `../${OCCUPANT_NAME}` },
};

// Every command but `version` (SPEC 14 condition 14 is reported by every
// command that loads the configuration; 12.6: `version` loads none), `review`
// and `query` by every subcommand, each spelled syntactically complete — its
// required operands and flags present, every value well-formed and inside its
// fixed vocabulary — so that no syntax-class usage error, which 12.0 reports
// without loading configuration, can precede the configuration load. The
// operands name nothing that must exist: a configuration error precedes every
// other exit-2 error consulting the configuration or the workspace (12.0), so
// an unknown node, session, item, profile, or baseline is never reached; the
// mutating commands (`review create`, `review split`, `review resolve`,
// `rename`, `move`) fail before acquisition and modify nothing (12.0, 13.5).
// The driver appends `--json`.
const EVERY_LOADING_COMMAND: readonly (readonly string[])[] = [
  ["build"],
  ["check"],
  ["ids"],
  ["show", "specs/A.mdx#a"],
  ["coverage"],
  ["impact", "--base", "HEAD"],
  ["review", "create", "--strategy", "audit", "--name", "s"],
  ["review", "list"],
  ["review", "status", "s"],
  ["review", "next", "s"],
  ["review", "show", "s", "i1"],
  ["review", "split", "s", "i1"],
  ["review", "resolve", "s", "i1", "--status", "updated"],
  ["review", "export", "s"],
  ["query", "node", "specs/A.mdx#a"],
  ["query", "nodes"],
  ["query", "edges"],
  ["query", "subtree", "specs/A.mdx#a"],
  ["query", "ancestors", "specs/A.mdx#a"],
  ["query", "reachable", "--from", "specs/A.mdx#a", "--to", "specs/A.mdx#a"],
  ["occurrences"],
  ["view"],
  ["at", "specs/A.mdx", "0"],
  ["inventory"],
  ["rename", "specs/A.mdx", "a", "b"],
  ["move", "specs/A.mdx", "specs/B.mdx"],
];

interface OccupancySweep {
  /** Workspace-relative working directory, or "." for the root. */
  readonly cwd: string;
  /** The `--config` value, spelled as given; absent for the upward search. */
  readonly configArg?: string;
  /** The concerned path 14 pins: the occupied entry, in 11.6's form. */
  readonly expectedPath: string;
  /** What occupies the entry, for the diagnosis. */
  readonly occupant: string;
}

/**
 * Drive every configuration-loading command from `sweep.cwd` (naming the
 * entry through `--config` when `sweep.configArg` is given) and assert each
 * reports 14.14 concerning exactly `sweep.expectedPath`: exit 2, the error
 * document's one finding carrying the stable code `configuration-error`,
 * locations [] (an unlocated condition), and as its concerned path the
 * occupied entry itself in the anchoring form of 11.6 — for the search, the
 * working directory's own `xspec.config.ts`; for `--config`, the path as
 * given, which from the root is already canonical (SPEC 14, 12.7; T12.7-3) —
 * never the valid file above it and never what the link targets.
 */
async function sweepOccupiedConfiguration(
  product: ProductBinding,
  workspace: TestWorkspace,
  sweep: OccupancySweep,
): Promise<void> {
  const cwd = sweep.cwd === "." ? workspace.root : workspace.path(sweep.cwd);
  const where =
    sweep.cwd === "."
      ? "the workspace root"
      : `the working directory ${sweep.cwd}`;
  for (const command of EVERY_LOADING_COMMAND) {
    const argv =
      sweep.configArg === undefined
        ? command
        : [...command, "--config", sweep.configArg];
    const label =
      `T7-1 \`${argv.join(" ")} --json\` run from ${where} ` +
      `(${sweep.occupant})`;
    const result = await expectConfigurationError(
      product,
      workspace,
      argv,
      `${label} — the ${sweep.configArg === undefined ? "upward search stops at the nearest directory holding an entry named xspec.config.ts, whatever occupies it, and the" : "named path's"} ` +
        `occupant is read only when it is a plain file: a directory or a ` +
        `symbolic link, whatever it targets, is missing or invalid ` +
        `configuration, never read through — reported by every command but ` +
        `version at configuration load (SPEC 7, 14.14, 12.0)`,
      cwd,
    );
    const finding = expectErrorDocument(result, label);
    assertSameJson(
      {
        code: finding.code,
        path: finding.path,
        locations: finding.locations.map((location) => location.file),
      },
      {
        code: "configuration-error",
        path: sweep.expectedPath,
        locations: [],
      },
      `${label}: the error document's one finding carries the stable code ` +
        `"configuration-error", locations [] (an unlocated condition), and ` +
        `as its concerned path the occupied entry itself in the anchoring ` +
        `form of 11.6 — ${JSON.stringify(sweep.expectedPath)} — never the ` +
        `valid configuration above it (../xspec.config.ts) and never the ` +
        `link's target (SPEC 14, 12.7, 7; T12.7-3)`,
    );
  }
}

/**
 * T7-1's occupancy arms (SPEC 7, 14.14): the directory and the symbolic-link
 * occupants found by the upward search from their own directories, then each
 * named through `--config` from the root; `version` answering beside them
 * (12.6); a whole-root compare around all of it (12.1); and, last — so the
 * arms observe a tree holding no graph data or derived file — the premise
 * that the root configuration is valid and discovers specs/A.mdx, without
 * which every exit 2 above would be vacuous.
 */
async function runOccupancyArms(product: ProductBinding): Promise<void> {
  await withWorkspace(OCCUPANCY_WORKSPACE, async (workspace) => {
    // Staging self-check (H-9): an ineffective staging is a harness error,
    // never a pass and never a diagnosed product failure.
    const stagedKinds: readonly (readonly [string, "dir" | "symlink"])[] = [
      [OCCUPANCY_DIR_ENTRY, "dir"],
      [OCCUPANCY_LINK_ENTRY, "symlink"],
    ];
    for (const [rel, expected] of stagedKinds) {
      const kind = await workspace.kind(rel);
      if (kind !== expected) {
        throw new Error(
          `T7-1 harness staging: expected a ${expected} at ${rel}, found ` +
            `${kind} — the occupancy arms cannot run (H-9)`,
        );
      }
    }

    const before = await snapshotDirectory(workspace.root);
    const sweeps: readonly OccupancySweep[] = [
      {
        cwd: OCCUPANCY_DIR_CWD,
        expectedPath: OCCUPANT_NAME,
        occupant: "the working directory's xspec.config.ts is a directory",
      },
      {
        cwd: OCCUPANCY_LINK_CWD,
        expectedPath: OCCUPANT_NAME,
        occupant:
          "the working directory's xspec.config.ts is a symbolic link to " +
          "the valid root configuration",
      },
      {
        cwd: ".",
        configArg: OCCUPANCY_DIR_ENTRY,
        expectedPath: OCCUPANCY_DIR_ENTRY,
        occupant: "--config names a directory",
      },
      {
        cwd: ".",
        configArg: OCCUPANCY_LINK_ENTRY,
        expectedPath: OCCUPANCY_LINK_ENTRY,
        occupant:
          "--config names a symbolic link to the valid root configuration",
      },
    ];
    for (const sweep of sweeps) {
      await sweepOccupiedConfiguration(product, workspace, sweep);
    }

    // `version` loads no configuration (SPEC 12.6): from either occupied
    // working directory it answers, exit 0, the version document decoded
    // form-exact — the occupant is met only by a configuration load.
    for (const cwd of [OCCUPANCY_DIR_CWD, OCCUPANCY_LINK_CWD]) {
      const versionLabel = `T7-1 \`version --json\` run from the working directory ${cwd} (its xspec.config.ts occupied)`;
      const versionRun = await runProduct(product, {
        cwd: workspace.path(cwd),
        argv: ["version", "--json"],
      });
      assertExitCode(
        versionRun,
        0,
        `${versionLabel} — version consults no configuration, so the ` +
          `occupied entry is never met: exit 0 with its answer (SPEC 12.6, ` +
          `14.14)`,
      );
      decodeVersionDocument(
        parseJsonStdout(versionRun, versionLabel),
        versionLabel,
      );
    }

    assertSnapshotsEqual(
      before,
      await snapshotDirectory(workspace.root),
      `T7-1 occupancy sweeps: a command failing at configuration load ` +
        `modifies nothing (SPEC 12.1, 12.0) — no derived file, graph data, ` +
        `session, or hold file appears anywhere under the root, the ` +
        `occupants and the valid configuration are byte-untouched`,
    );

    // The premise, last: the root configuration is valid and discovers
    // specs/A.mdx — the configuration a product skipping the occupant, or
    // reading through the link, would have loaded (module header).
    const premiseLabel =
      "T7-1 occupancy premise: `ids --json` run from the workspace root";
    const premise = decodeIdsReport(
      await runJson(product, workspace, ["ids", "--json"], premiseLabel),
      premiseLabel,
    );
    assertSameJson(
      premise.files,
      [{ file: "specs/A.mdx", ids: ["a"] }],
      `${premiseLabel}: the root configuration is valid and discovers ` +
        `specs/A.mdx (SPEC 7) — the occupancy arms' exit-2 answers are ` +
        `meaningful only because a product reading past the occupant would ` +
        `have found this configuration and exited 0`,
    );
  });
}

// --- T7-1 name casing (SPEC 7, 12.0) ----------------------------------------

// The single-casing probe's working directory beneath the valid root
// configuration, and its one entry: a plain file whose name differs from
// `xspec.config.ts` in ASCII case alone (module header).
const NAME_CASING_CWD = "sub";
const NAME_CASING_ENTRY_NAME = "XSPEC.config.ts";
const NAME_CASING_ENTRY = `${NAME_CASING_CWD}/${NAME_CASING_ENTRY_NAME}`;
// `)` alone: no well-formed TypeScript (TEST-SPEC T7-1), so a product
// reading the entry meets a configuration error (14.14, 14.20) and exits 2.
// A staged-source record declared unparseable (module header): T7-1's body
// stages it after its first product invocation, and the Windows leg's rerun
// (E-6) and S-7's sweeps stage the same record.
const NAME_CASING_ENTRY_SOURCE = stagedTs(
  "T7-1 sub/XSPEC.config.ts (the name-casing probe's plain file holding `)`: no well-formed TypeScript, matched by no group's glob)",
  ")",
  "unparseable",
);
const NAME_CASING_WORKSPACE: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPECS_ONLY_CONFIG,
    "specs/A.mdx": SECTION_A_SOURCE,
    [NAME_CASING_ENTRY]: NAME_CASING_ENTRY_SOURCE,
  },
};

/**
 * T7-1's single-casing probe as one shared code path: run last by the
 * registered T7-1 body on the suite leg and rerun verbatim by the Windows
 * leg (TEST-SPEC E-6; test/windows/e6-subset.test.ts). The configuration
 * entry's name is compared byte-wise and case-sensitively (SPEC 7, 12.0):
 * beneath the valid root configuration, the working directory `sub/` holds
 * the plain file `XSPEC.config.ts` (`)`, no well-formed TypeScript) and no
 * entry named `xspec.config.ts`, so the upward search passes it and loads
 * the root's configuration — `build` and then `check`, each run from
 * `sub/`, exit 0. A product matching the name case-insensitively, or
 * finding the file through a case-insensitive filesystem lookup, reads it
 * and exits 2 with 14.14. The fixture stages one casing alone, so it stages
 * identically on any filesystem.
 */
export async function runT71ConfigNameCasingProbe(
  product: ProductBinding,
): Promise<void> {
  await withWorkspace(NAME_CASING_WORKSPACE, async (workspace) => {
    // Staging self-check (H-9): `sub/` holds exactly the one entry, its name
    // byte-wise `XSPEC.config.ts`, a plain file — read by listing the
    // directory, never by looking `xspec.config.ts` up, which a
    // case-insensitive filesystem answers with this very entry. An
    // ineffective staging is a harness error, never a pass or a diagnosed
    // product failure.
    const entries = await workspace.readdirNames(NAME_CASING_CWD);
    const kind = await workspace.kind(NAME_CASING_ENTRY);
    if (
      entries.length !== 1 ||
      entries[0] !== NAME_CASING_ENTRY_NAME ||
      kind !== "file"
    ) {
      throw new Error(
        `T7-1 harness staging: expected ${NAME_CASING_CWD}/ to hold exactly ` +
          `one entry, the plain file ${NAME_CASING_ENTRY_NAME}; found ` +
          `${JSON.stringify(entries)} (${NAME_CASING_ENTRY}: ${kind}) — the ` +
          `name-casing probe cannot run (H-9)`,
      );
    }
    for (const command of ["build", "check"] as const) {
      const label =
        `T7-1 \`${command}\` run from ${NAME_CASING_CWD}/ (its one entry ` +
        `the plain file ${NAME_CASING_ENTRY_NAME} holding \`)\`; the ` +
        `single-casing probe, rerun on the Windows leg per E-6)`;
      const result = await runProduct(product, {
        cwd: workspace.path(NAME_CASING_CWD),
        argv: [command],
      });
      assertExitCode(
        result,
        0,
        `${label} — the configuration entry's name is compared byte-wise ` +
          `and case-sensitively (SPEC 7, 12.0): ${NAME_CASING_ENTRY_NAME} is ` +
          `no entry named xspec.config.ts, so the upward search passes ` +
          `${NAME_CASING_CWD}/ and loads the root's valid configuration; a ` +
          `product matching the name case-insensitively, or finding the ` +
          `file through a case-insensitive filesystem lookup, reads \`)\` — ` +
          `no well-formed TypeScript — and exits 2 with 14.14`,
      );
    }
  });
}

const T7_1 = defineProductTest({
  id: "T7-1",
  title:
    "configuration location: upward search from a nested working " +
    "directory; --config, resolved against the working directory, " +
    "overrides the search; no configuration reachable is a configuration " +
    "error — by a failed upward search, and by --config naming a " +
    "nonexistent file, never a plain usage error; occupancy — the search " +
    "stops at the nearest entry named xspec.config.ts whatever occupies " +
    "it, and a found or named entry that is a directory or a symbolic " +
    "link is 14.14 for every command but version, the concerned path that " +
    "entry, never read through; the entry's name compared byte-wise and " +
    "case-sensitively — a plain file XSPEC.config.ts holding `)` in a " +
    "working directory beneath the valid root configuration is passed by " +
    "the search, which loads the root's configuration, `build` and then " +
    "`check` run from there exiting 0 (a single-casing probe, rerun on the " +
    "Windows leg, E-6) (SPEC 7, 12.0, 12.6, 12.7, 14.14)",
  run: async (product) => {
    await withWorkspace(
      { files: LOCATION_FILES, dirs: [SEARCH_CWD] },
      async (workspace) => {
        // Upward search: from nested/inner the nearest (and only)
        // xspec.config.ts on the upward path is the workspace root's.
        const searchLabel = `T7-1 \`ids --json\` run from ${SEARCH_CWD}`;
        const searchRun = await runProduct(product, {
          cwd: workspace.path(SEARCH_CWD),
          argv: ["ids", "--json"],
        });
        assertExitCode(
          searchRun,
          0,
          `${searchLabel} — the configuration is located by upward search ` +
            `for xspec.config.ts from the working directory (SPEC 7)`,
        );
        const searchReport = decodeIdsReport(
          parseJsonStdout(searchRun, searchLabel),
          searchLabel,
        );
        assertSameJson(
          searchReport.files,
          [{ file: "specs/A.mdx", ids: ["a"] }],
          `${searchLabel}: the upward search finds the root configuration, ` +
            `whose directory is the workspace root — the listing carries ` +
            `exactly its sources, by workspace-relative path (SPEC 7, ` +
            `12.3, 1.5)`,
        );

        // --config override: the upward search from `nested` would find the
        // root configuration (source A); the named configuration must win
        // (source B), and its relative path must resolve against the
        // working directory (SPEC 12.0) — resolved anywhere else it names
        // no file.
        const overrideLabel =
          `T7-1 \`ids --json --config ${OVERRIDE_CONFIG_ARG}\` run from ` +
          OVERRIDE_CWD;
        const overrideRun = await runProduct(product, {
          cwd: workspace.path(OVERRIDE_CWD),
          argv: ["ids", "--json", "--config", OVERRIDE_CONFIG_ARG],
        });
        assertExitCode(
          overrideRun,
          0,
          `${overrideLabel} — --config <path> is a filesystem path ` +
            `resolved against the working directory (SPEC 12.0) and ` +
            `overrides the upward search (SPEC 7)`,
        );
        const overrideReport = decodeIdsReport(
          parseJsonStdout(overrideRun, overrideLabel),
          overrideLabel,
        );
        assertSameJson(
          overrideReport.files,
          [{ file: "specs/B.mdx", ids: ["b"] }],
          `${overrideLabel}: the named configuration wins over the one the ` +
            `upward search would find, and its own directory (alt/) is the ` +
            `workspace root — the listing carries alt/specs/B.mdx as ` +
            `specs/B.mdx and nothing of the root project (SPEC 7, 12.0)`,
        );

        // --config naming a nonexistent file: missing configuration, a
        // configuration error (SPEC 14.14) — never a plain usage error and
        // never a fallback. Run from the root, whose own xspec.config.ts the
        // upward search would find, naming alt/missing.config.ts — absent,
        // beside alt/'s valid configuration — so a product falling back to
        // the search, or to a configuration near the named path, builds and
        // exits 0 (module header). The error document's finding carries the
        // stable code, locations [] (an unlocated condition, SPEC 14), and
        // the concerned path: the path --config names, in the anchoring
        // form of 11.6 — spelled here exactly as given (SPEC 14, 12.7; the
        // sibling-directory ascent spelling is T12.7-3's arm). A build
        // failing at configuration load modifies nothing (SPEC 12.1):
        // whole-root compare around the run.
        const missingLabel =
          `T7-1 \`build --config ${MISSING_CONFIG_ARG} --json\` run from ` +
          `the workspace root (--config naming a nonexistent file)`;
        const beforeMissing = await snapshotDirectory(workspace.root);
        const missingRun = await expectConfigurationError(
          product,
          workspace,
          ["build", "--config", MISSING_CONFIG_ARG],
          missingLabel,
        );
        const missingFinding = expectErrorDocument(missingRun, missingLabel);
        assertSameJson(
          {
            code: missingFinding.code,
            path: missingFinding.path,
            locations: missingFinding.locations.map(
              (location) => location.file,
            ),
          },
          {
            code: "configuration-error",
            path: MISSING_CONFIG_ARG,
            locations: [],
          },
          `${missingLabel}: --config naming a nonexistent file is missing ` +
            `configuration (SPEC 14.14) — the error document's one finding ` +
            `carries the stable code "configuration-error", locations [] ` +
            `(an unlocated condition), and as its concerned path the path ` +
            `--config names, in the anchoring form of 11.6 relative to the ` +
            `invocation working directory (SPEC 14, 12.7; T12.7-3) — never ` +
            `a plain usage error's null code and path, and never "." (the ` +
            `failed-upward-search spelling, reserved for no --config given)`,
        );
        assertSnapshotsEqual(
          beforeMissing,
          await snapshotDirectory(workspace.root),
          `${missingLabel}: a build failing at configuration load modifies ` +
            `nothing (SPEC 12.1, 12.0) — the configurations at the root and ` +
            `beside the named path are never consulted, so no derived file ` +
            `or graph data appears anywhere under the root`,
        );
      },
    );

    // No configuration reachable: a fresh temporary workspace with no
    // xspec.config.ts anywhere on the upward path (module header; H-1's
    // precondition verified first) — a configuration error, not a crash and
    // not an empty success.
    await withWorkspace(
      { files: { "specs/A.mdx": SECTION_A_SOURCE } },
      async (workspace) => {
        await assertSelfContainedRoot(
          product,
          workspace.root,
          "T7-1 (no configuration reachable by upward search)",
        );
        await expectConfigurationError(
          product,
          workspace,
          ["build"],
          "T7-1 `build --json` with no xspec.config.ts reachable by upward " +
            "search and no --config",
        );
      },
    );

    // Occupancy: a found or named xspec.config.ts that is a directory or a
    // symbolic link (SPEC 7, 14.14; helpers above).
    await runOccupancyArms(product);

    // Name casing: a plain file XSPEC.config.ts beneath the valid root
    // configuration is no entry named xspec.config.ts (SPEC 7, 12.0) — the
    // single-casing probe the Windows leg reruns (E-6; helpers above).
    await runT71ConfigNameCasingProbe(product);
  },
});

// ---------------------------------------------------------------------------
// T7-2 — declarative form
// ---------------------------------------------------------------------------

// Verbatim spellings (SPEC 7, 2.4: configuration literals are static string
// literals read exactly as spelled). Every escape spelling this module
// stages is built from the backslash's code point, so that its characters
// reach the staged file exactly — a template literal would itself interpret
// a backslash escape — and this source spells no escape (the header's
// verbatim-literal note).
const BACKSLASH = String.fromCodePoint(0x5c);

// Binding forms (SPEC 7: exactly an import of `defineConfig`, optionally
// aliased; 2.4; module header): the canonical configuration imported under
// the alias `d`, its import name spelled `importName` — the identifier
// `defineConfig` (the identifier-named twin), the string literal
// `"defineConfig"` (that import, aliased: it loads), or that string literal
// with the name's `C` written as the hexadecimal escape of U+0043 (read
// verbatim, it imports no `defineConfig`: refused, FORM_VIOLATIONS). The
// three files differ in the import name's spelling alone.
function bindingFormConfig(importName: string): string {
  return `import { ${importName} as d } from "xspec"

export default d({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;
}
const STRING_IMPORT_NAME = '"defineConfig"';
const ESCAPE_SPELLED_IMPORT_NAME = `"define${BACKSLASH}x43onfig"`;

// The module-load self-check of the escape-spelled import name: it holds
// exactly one backslash, followed by `x43`, and with that one escape decoded
// (U+0043 is `C`) it is the string-literal import name — so the refused file
// differs from the loading one in that escape alone, and no escape was
// decoded or lost on its way to the staged text. A mismatch is a harness
// error thrown at load, never a product verdict.
if (
  ESCAPE_SPELLED_IMPORT_NAME.split(BACKSLASH).length !== 2 ||
  ESCAPE_SPELLED_IMPORT_NAME.indexOf(`${BACKSLASH}x43`) !== '"define'.length ||
  ESCAPE_SPELLED_IMPORT_NAME.replace(
    `${BACKSLASH}x43`,
    String.fromCodePoint(0x43),
  ) !== STRING_IMPORT_NAME ||
  bindingFormConfig(ESCAPE_SPELLED_IMPORT_NAME).split(BACKSLASH).length !== 2
) {
  throw new Error(
    "T7-2 fixture self-check: the escape-spelled import name must be the " +
      'string literal "defineConfig" with its C written as the hexadecimal ' +
      "escape of U+0043 — one backslash, then x43, after define — and its " +
      "configuration must hold that backslash alone (module header); got " +
      JSON.stringify(ESCAPE_SPELLED_IMPORT_NAME),
  );
}

// Each fixture is SPECS_ONLY_CONFIG with exactly one deviation (module
// header). SPEC 7: the file MUST consist of exactly an import of
// `defineConfig` (optionally aliased) whose module specifier is any static
// string literal, and a default export of one call to that binding whose
// sole argument is statically literal — object literals with non-computed
// identifier or string-literal keys, array literals, static string
// literals, and the boolean literals; no other statement or expression
// form, no spread, no computed value. The rows follow TEST-SPEC's order: a
// syntax error, the missing import, extra statements, each non-literal
// argument form, the `null` literal, a non-call default export, a call
// without a sole argument, a numeric-literal key, the wrapped forms and
// call variants, the refused binding forms, the import's modifiers, and the
// statement forms. The escape-spelled import name's valid twin is the
// string-literal import name's file (`bindingFormConfig`, loaded by the
// body), the escape its one deviation. No row varies the specifier: any
// static string literal is valid there (SPEC 7), T7-9's subject.
const FORM_VIOLATIONS = refusedConfigArms("T7-2", [
  {
    label: "not well-formed TypeScript — a syntax error (unclosed braces)",
    unparseable: true,
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
`,
  },
  {
    label: "missing defineConfig import",
    config: `export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label: "extra statements beside the import and the default export",
    config: `import { defineConfig } from "xspec"

const extra = true

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label: "non-literal argument: a spread in the object literal",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  ...{},
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label: "non-literal argument: a computed key",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    ["main"]: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label:
      "non-literal argument: a template literal where a static string " +
      "belongs",
    config: [
      'import { defineConfig } from "xspec"',
      "",
      "export default defineConfig({",
      "  specs: {",
      "    main: [`specs/**/*.mdx`]",
      "  }",
      "})",
      "",
    ].join("\n"),
  },
  {
    label:
      "non-literal argument: an identifier reference (undefined) where a " +
      "literal belongs",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: [undefined]
  }
})
`,
  },
  {
    label: "non-literal argument: a function call producing the value",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/".concat("**/*.mdx")]
  }
})
`,
  },
  {
    label:
      "non-literal argument: a number literal where a boolean is expected " +
      "(markdown.emit)",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: 1 }
})
`,
  },
  // A `null` literal lies outside 7's literal set, though `inventory`
  // reports unset members as `null` (12.7): each fixture is valid with the
  // member omitted (module header).
  {
    label:
      "a null literal outside the literal set: markdown: { emit: true, " +
      "outDir: null }",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true, outDir: null }
})
`,
  },
  {
    label:
      "a null literal outside the literal set: a coverage profile's " +
      "targetTags: null",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "p",
      target: "main",
      targetTags: null,
      boundary: "main",
      mode: "direct"
    }
  ]
})
`,
  },
  {
    label:
      "a default export that is not one call to the binding: the bare " +
      "argument object",
    config: `import { defineConfig } from "xspec"

export default {
  specs: {
    main: ["specs/**/*.mdx"]
  }
}
`,
  },
  {
    label:
      "a default export that is not one call to the binding: the uncalled " +
      "defineConfig reference",
    config: `import { defineConfig } from "xspec"

export default defineConfig
`,
  },
  // One call whose sole argument is statically literal (SPEC 7): no
  // argument at all, and a second argument beside an otherwise valid first
  // (module header).
  {
    label: "a call without a sole argument: defineConfig()",
    config: `import { defineConfig } from "xspec"

export default defineConfig()
`,
  },
  {
    label:
      "a call without a sole argument: defineConfig({…}, {}), its first " +
      "argument an otherwise valid configuration",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
}, {})
`,
  },
  // Keys are non-computed identifiers or string literals (SPEC 7): a
  // numeric-literal key, which TypeScript admits, spelled as TEST-SPEC
  // spells it (module header).
  {
    label: 'a numeric-literal key: specs: { 1: ["specs/*.mdx"] }',
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: { 1: ["specs/*.mdx"] }
})
`,
  },
  // Wrapped forms and call variants (SPEC 7: exactly the import and a
  // default export of one call to that binding whose sole argument is
  // statically literal — no other statement or expression form): the call
  // wrapped, the argument wrapped, a value inside it wrapped, and the call
  // spelled with syntax outside 7's list — nine well-formed texts, one arm
  // each (module header).
  {
    label:
      "the call wrapped: export default defineConfig({…}) satisfies object",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
}) satisfies object
`,
  },
  {
    label: "the call wrapped: export default (defineConfig({…}))",
    config: `import { defineConfig } from "xspec"

export default (defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
}))
`,
  },
  {
    label:
      "the call wrapped: export default defineConfig({…})!, a non-null " +
      "assertion",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})!
`,
  },
  {
    label: "the argument wrapped: defineConfig({…} as const)",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
} as const)
`,
  },
  {
    label: "the argument wrapped: defineConfig(({…}))",
    config: `import { defineConfig } from "xspec"

export default defineConfig(({
  specs: {
    main: ["specs/**/*.mdx"]
  }
}))
`,
  },
  {
    label:
      "a value inside the argument wrapped: markdown: { emit: true as " +
      "boolean }",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true as boolean }
})
`,
  },
  {
    label: "a value inside the argument wrapped: specs: ({…})",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: ({
    main: ["specs/**/*.mdx"]
  })
})
`,
  },
  {
    label:
      "the call spelled outside 7's list: export default " +
      "defineConfig<object>({…}), carrying type arguments",
    config: `import { defineConfig } from "xspec"

export default defineConfig<object>({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label:
      "the call spelled outside 7's list: export default " +
      "defineConfig?.({…}), an optional call",
    config: `import { defineConfig } from "xspec"

export default defineConfig?.({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  // Binding forms (SPEC 7: exactly an import of `defineConfig`, optionally
  // aliased; 2.4): the escape-spelled string-literal import name, read
  // verbatim, imports no `defineConfig`; a default import, a namespace
  // import, an extra default binding, and an extra named binding are no
  // import of exactly `defineConfig` — five well-formed texts, one arm each
  // (module header).
  {
    label:
      "an escape-spelled string-literal import name: import { " +
      '"defineConfig" as d } from "xspec" with the name' +
      "'s C written as the hexadecimal escape of U+0043 — read verbatim, " +
      "it imports no defineConfig (2.4)",
    config: bindingFormConfig(ESCAPE_SPELLED_IMPORT_NAME),
  },
  {
    label: 'a default import: import defineConfig from "xspec"',
    config: `import defineConfig from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label:
      'a namespace import: import * as X from "xspec" with export default ' +
      "X.defineConfig({…})",
    config: `import * as X from "xspec"

export default X.defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label: 'an extra default binding: import d, { defineConfig } from "xspec"',
    config: `import d, { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label:
      'an extra named binding: import { defineConfig, other } from "xspec"',
    config: `import { defineConfig, other } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  // The import carries no `type` or `defer` modifier and no import
  // attributes (SPEC 7): four well-formed texts (module header).
  {
    label:
      'a type-only import clause: import type { defineConfig } from "xspec"',
    config: `import type { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label:
      'a type-only import specifier: import { type defineConfig } from "xspec"',
    config: `import { type defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label: 'a deferred import: import defer { defineConfig } from "xspec"',
    config: `import defer { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label:
      "import attributes: " +
      'import { defineConfig } from "xspec" with { type: "json" }',
    config: `import { defineConfig } from "xspec" with { type: "json" }

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  // Statement forms (SPEC 7: exactly an import of `defineConfig` and a
  // default export of one call to that binding, no other statement form):
  // TypeScript's two CommonJS-interop statements — an export assignment,
  // which is no default export, and an import assignment, which binds the
  // module itself and imports no `defineConfig` — two well-formed texts,
  // one arm each (module header).
  {
    label:
      "a statement form: an export assignment, export = " +
      'defineConfig({…}) beside import { defineConfig } from "xspec" — no ' +
      "default export",
    config: `import { defineConfig } from "xspec"

export = defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label:
      "a statement form: an import assignment, import defineConfig = " +
      'require("xspec") beside export default defineConfig({…}) — it ' +
      "binds the module itself, importing no defineConfig",
    config: `import defineConfig = require("xspec")

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
]);

// The valid arm: an aliased defineConfig import (SPEC 7: optionally aliased).
const ALIASED_CONFIG = stagedTs(
  "T7-2 xspec.config.ts (aliased defineConfig import)",
  `import { defineConfig as makeConfig } from "xspec"

export default makeConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
);

// The valid binding form (SPEC 7, 2.4; module header): the string-literal
// import name spelling `defineConfig` is that import, aliased, and loads
// alike with its identifier-named twin, the same file but for the name's
// quotes (`bindingFormConfig`). Records made at module load: T7-2 stages
// both after a product invocation (S-9's timing clause).
const STRING_IMPORT_NAME_CONFIG = stagedTs(
  'T7-2 xspec.config.ts (binding forms: a string-literal import name, import { "defineConfig" as d } from "xspec")',
  bindingFormConfig(STRING_IMPORT_NAME),
);
const IDENTIFIER_IMPORT_NAME_CONFIG = stagedTs(
  'T7-2 xspec.config.ts (binding forms: the identifier-named twin, import { defineConfig as d } from "xspec")',
  bindingFormConfig("defineConfig"),
);

// Statement order (SPEC 7 fixes which statements the file holds, never
// their order; an import binds its name throughout its module, so a call
// spelled before it calls that binding; module header): the canonical
// configuration's two statements, the default export first and the import
// after it. `twoStatementConfig` composes a file from the two statements in
// the order given, one blank line between them; the import-first order is
// the canonical text itself (`SPECS_ONLY_CONFIG`, the twin the body
// compares against), so the two files differ in the statements' order
// alone. A record made at module load: T7-2 stages it after a product
// invocation (S-9's timing clause).
const CANONICAL_IMPORT_STATEMENT = 'import { defineConfig } from "xspec"';
const CANONICAL_EXPORT_STATEMENT = `export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})`;
function twoStatementConfig(first: string, second: string): string {
  return `${first}

${second}
`;
}
const STATEMENT_ORDER_CONFIG = stagedTs(
  'T7-2 xspec.config.ts (statement order: export default defineConfig({…}) followed by import { defineConfig } from "xspec")',
  twoStatementConfig(CANONICAL_EXPORT_STATEMENT, CANONICAL_IMPORT_STATEMENT),
);

// The module-load self-check of the statement-order pair: the import-first
// composition is the canonical configuration byte for byte, and the
// export-first file holds the same two statements in the other order — so
// the arm's one deviation from its twin is the order. A mismatch is a
// harness error thrown at load, never a product verdict.
if (
  twoStatementConfig(CANONICAL_IMPORT_STATEMENT, CANONICAL_EXPORT_STATEMENT) !==
    configText(SPECS_ONLY_CONFIG) ||
  configText(STATEMENT_ORDER_CONFIG).indexOf(CANONICAL_IMPORT_STATEMENT) <=
    configText(STATEMENT_ORDER_CONFIG).indexOf(CANONICAL_EXPORT_STATEMENT)
) {
  throw new Error(
    "T7-2 fixture self-check: the statement-order arm must be the canonical " +
      "configuration's import and default export exchanged — the " +
      "import-first composition equal to the canonical text, the " +
      "export-first file holding the default export before the import " +
      "(module header); got " +
      JSON.stringify(configText(STATEMENT_ORDER_CONFIG)),
  );
}

// The string-literal keys arm (SPEC 7: the statically literal argument's
// object literals carry "non-computed identifier or string-literal keys"):
// a spec group and a code group whose names are not TypeScript identifiers
// ("my-group", "test-code") have only the string-literal spelling — a
// product accepting identifier keys alone refuses a valid configuration no
// other spelling can declare. The quoted names are referenced from every
// place group names resolve that this arm asserts: the coverage profile's
// `target` and `boundary` (both unambiguous, so their kinds are inferred,
// SPEC 7.4) and both policy selectors (SPEC 7.5).
const QUOTED_KEYS_CONFIG = stagedTs(
  "T7-2 xspec.config.ts (string-literal keys)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    "my-group": ["specs/**/*.mdx"]
  },
  code: {
    "test-code": ["src/**/*.ts"]
  },
  coverage: [
    {
      name: "quoted",
      target: "my-group",
      boundary: "test-code",
      mode: "direct"
    }
  ],
  policy: [
    {
      name: "no-internal-deps",
      type: "forbidden",
      from: { group: "my-group" },
      to: { group: "my-group" }
    }
  ]
})
`,
);

// The quoted-keys workspace: the spec group's file holds two leaves — `a`,
// covered through the code marker's references edge, and `p`, depending
// locally on `a` (SPEC 2.2's string form) — and the code group's file holds
// one top-level marker, so its code location is the file itself (SPEC 4.5,
// 4.6; the T8-3 shape).
const QUOTED_KEYS_FILES: Readonly<Record<string, InitialFileContents>> = {
  "xspec.config.ts": QUOTED_KEYS_CONFIG,
  "specs/A.mdx": stagedMdx(
    "T7-2 string-literal keys specs/A.mdx",
    `<S id="a">
Covered leaf.
</S>

<S id="p" d={"a"}>
Dependent leaf.
</S>
`,
  ),
  "src/impl.ts": stagedTs(
    "T7-2 src/impl.ts (string-literal keys)",
    `import SPEC from "../specs/A.xspec";

SPEC.a;
`,
  ),
};

// The quoted-keys fixture's complete edge set (SPEC 5.1–5.2, 2.2, 4.5).
// Whole-graph equality makes both discovery observations exact: the spec
// group's nodes carry their contains/depends edges, the code group's marker
// its references edge — an undiscovered src/impl.ts would drop it (T7-3's
// contrapositive) — and nothing stray exists. The depends edge doubles as
// the policy premise: both its endpoints are "my-group" nodes, so the
// forbidden rule below has exactly one violation to report.
const QUOTED_KEYS_EDGES: readonly GraphEdge[] = [
  { from: "specs/A.mdx", to: "specs/A.mdx#a", kind: "contains" },
  { from: "specs/A.mdx", to: "specs/A.mdx#p", kind: "contains" },
  { from: "specs/A.mdx#p", to: "specs/A.mdx#a", kind: "depends" },
  { from: "src/impl.ts", to: "specs/A.mdx#a", kind: "references" },
];

// Verbatim literals (SPEC 7, 2.4: configuration literals are static string
// literals read exactly as spelled). The escape spellings below are built
// from the backslash's code point (`BACKSLASH`, defined with T7-2's binding
// forms above) so the six characters reach the staged file exactly — a
// template literal would itself interpret a backslash-u escape (the
// header's verbatim-literal note).

// A glob spelled with the six-character escape of `*` (backslash, `u002A`)
// is read as those characters: it names only a file literally so called,
// so with `specs/A.mdx` the sole source the group discovers nothing — valid,
// a group matching no files being valid (7). A product interpreting the
// escape reads `specs/*.mdx`, discovers `specs/A.mdx`, and fails the empty
// listings and the inventory's verbatim glob.
const VERBATIM_GLOB = `specs/${BACKSLASH}u002A.mdx`;
const VERBATIM_GLOB_CONFIG = stagedTs(
  "T7-2 xspec.config.ts (verbatim glob)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["${VERBATIM_GLOB}"]
  }
})
`,
);

// A group name spelled with the escape of `u` (`prod`, backslash, `u0075`,
// `ct`) names a group whose spelling contains a backslash: a profile's
// `target: "product"` is then an unknown group (14.14, SPEC 7.4) while the
// same escape spelling resolves. `boundary` carries the verbatim spelling
// in both fixtures, so the profile's target is their only difference.
// `groupKey` spells the group's key: the string literal here, and the
// identifier `prod`, backslash, `u0075`, `ct` in the identifier-key arms
// below (SPEC 7, 2.4: an identifier key is read as spelled too).
const VERBATIM_GROUP_NAME = `prod${BACKSLASH}u0075ct`;
const VERBATIM_GROUP_STRING_KEY = `"${VERBATIM_GROUP_NAME}"`;
function verbatimNameConfig(groupKey: string, target: string): string {
  return `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    ${groupKey}: ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "verbatim",
      target: "${target}",
      boundary: "${VERBATIM_GROUP_NAME}",
      mode: "direct"
    }
  ]
})
`;
}

// The two verbatim-name fixtures, records made at module load: T7-2 stages
// both after a product invocation (S-9's timing clause).
const VERBATIM_NAME_UNKNOWN_TARGET_CONFIG = stagedTs(
  'T7-2 xspec.config.ts (verbatim group name: a profile\'s target "product")',
  verbatimNameConfig(VERBATIM_GROUP_STRING_KEY, "product"),
);
const VERBATIM_NAME_CONFIG = stagedTs(
  "T7-2 xspec.config.ts (verbatim group name: the target spelled as the group's key)",
  verbatimNameConfig(VERBATIM_GROUP_STRING_KEY, VERBATIM_GROUP_NAME),
);

// Keys and enumerated values read as spelled (SPEC 7, 2.4; the spellings
// 7.6's covered-file bar cites; module header): a key or an enumerated
// value spelled with an escape is read as its characters, as every
// configuration literal is, and an identifier key alike — its characters
// as spelled, where TypeScript decodes an identifier's Unicode escapes.
// Each spelling below holds one escape, built from `BACKSLASH` so that this
// source spells none, and is pinned at module load.

/**
 * An escape spelling pinned at module load (T7-2; module header): `spelled`
 * holds exactly one backslash, followed by `escapeText` — `x` and two
 * hexadecimal digits, or `u` and four — which designates `character`, and
 * with that one escape decoded the spelling is `decoded`. So a staged file
 * differs from its decoded twin in that escape alone, and no escape was
 * decoded or lost on its way to the staged text. A mismatch is a harness
 * error thrown at load, never a product verdict.
 */
function checkedEscapeSpelling(
  spelled: string,
  escapeText: string,
  character: string,
  decoded: string,
): string {
  const sequence = `${BACKSLASH}${escapeText}`;
  if (
    !/^(?:x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4})$/.test(escapeText) ||
    String.fromCodePoint(Number.parseInt(escapeText.slice(1), 16)) !==
      character ||
    spelled.split(BACKSLASH).length !== 2 ||
    !spelled.includes(sequence) ||
    spelled.replace(sequence, character) !== decoded
  ) {
    throw new Error(
      `T7-2 fixture self-check: ${JSON.stringify(spelled)} must hold ` +
        `exactly one backslash, followed by ${escapeText} (an escape of ` +
        `${JSON.stringify(character)}), and decode to ` +
        `${JSON.stringify(decoded)} (module header)`,
    );
  }
  return spelled;
}

// The string-literal spellings: the top-level key `"specs"` with its `s`
// written as the hexadecimal escape of U+0073 (backslash, `x73`); the
// `mode` value `"direct"` with its `d` written as that of U+0064
// (backslash, `x64`); and the group key `"ab"` with its `b` written as that
// of U+0062 (backslash, `x62`), distinct as spelled from `"ab"`.
const ESCAPED_SPECS_STRING_KEY = checkedEscapeSpelling(
  `"${BACKSLASH}x73pecs"`,
  "x73",
  "s",
  '"specs"',
);
const ESCAPED_DIRECT_MODE = checkedEscapeSpelling(
  `"${BACKSLASH}x64irect"`,
  "x64",
  "d",
  '"direct"',
);
const ESCAPED_AB_STRING_KEY = checkedEscapeSpelling(
  `"a${BACKSLASH}x62"`,
  "x62",
  "b",
  '"ab"',
);
// The identifier twins: the keys `specs` and `ab` with their `s` and `b`
// written as the Unicode escapes of U+0073 and U+0062 (backslash, `u0073`;
// backslash, `u0062`), and the verbatim group name keyed as an identifier
// (`prod`, backslash, `u0075`, `ct`).
const ESCAPED_SPECS_IDENTIFIER = checkedEscapeSpelling(
  `${BACKSLASH}u0073pecs`,
  "u0073",
  "s",
  "specs",
);
const ESCAPED_AB_IDENTIFIER = checkedEscapeSpelling(
  `a${BACKSLASH}u0062`,
  "u0062",
  "b",
  "ab",
);
const VERBATIM_GROUP_IDENTIFIER_KEY = checkedEscapeSpelling(
  VERBATIM_GROUP_NAME,
  "u0075",
  "u",
  "product",
);

/** The canonical configuration with its top-level key spelled `key`. */
function canonicalWithSpecsKey(key: string): string {
  return `import { defineConfig } from "xspec"

export default defineConfig({
  ${key}: {
    main: ["specs/**/*.mdx"]
  }
})
`;
}

// The refused string-literal arms (14.14, exit 2), one each, every file the
// canonical configuration — for `mode`, the `targetTags: null` row's valid
// twin, a profile over `main` — with one escape as its deviation, valid
// with that escape decoded, so a product decoding escapes loads it and
// builds (exit 0). Read as spelled, the top-level key is no `specs` (an
// unknown key, `specs` then missing) and the `mode` value is no mode.
const SPELLED_KEY_VIOLATIONS = refusedConfigArms("T7-2", [
  {
    label:
      'keys read as spelled: a top-level string-literal key "specs" with ' +
      "its s written as the hexadecimal escape of U+0073 — an unknown key, " +
      "specs then missing",
    config: canonicalWithSpecsKey(ESCAPED_SPECS_STRING_KEY),
  },
  {
    label:
      "enumerated values read as spelled: a coverage profile with mode " +
      '"direct", its d written as the hexadecimal escape of U+0064 — no ' +
      "mode",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "p",
      target: "main",
      boundary: "main",
      mode: ${ESCAPED_DIRECT_MODE}
    }
  ]
})
`,
  },
]);

// The refused identifier twins (14.14, exit 2), one each: the canonical
// configuration with its top-level identifier key `specs` written with the
// escape of its `s` — read as spelled, an unknown key, `specs` then missing
// — and the verbatim group name keyed as an identifier under a profile
// whose `target: "product"` names no configured group, its resolving twin
// (`IDENTIFIER_NAME_CONFIG`) differing in that target alone.
const SPELLED_IDENTIFIER_KEY_VIOLATIONS = refusedConfigArms("T7-2", [
  {
    label:
      "identifier keys read as spelled: a top-level identifier key specs " +
      "with its s written as the Unicode escape of U+0073 — an unknown " +
      "key, specs then missing",
    config: canonicalWithSpecsKey(ESCAPED_SPECS_IDENTIFIER),
  },
  {
    label:
      "identifier keys read as spelled: a spec group keyed by the " +
      "identifier product with its u written as the Unicode escape of " +
      'U+0075 — a profile target "product" names no configured group',
    config: verbatimNameConfig(VERBATIM_GROUP_IDENTIFIER_KEY, "product"),
  },
]);

// The identifier-keyed group named by a target spelled as its key — a
// record made at module load: T7-2 stages it after a product invocation
// (S-9's timing clause).
const IDENTIFIER_NAME_CONFIG = stagedTs(
  "T7-2 xspec.config.ts (identifier keys read as spelled: a spec group keyed by the identifier product with its u written as the Unicode escape of U+0075, the target spelled as its key)",
  verbatimNameConfig(VERBATIM_GROUP_IDENTIFIER_KEY, VERBATIM_GROUP_NAME),
);

// Keys distinct as spelled (SPEC 7, 2.4): the spec groups keyed `ab` and its
// escape-spelled twin — string literals, or identifiers — are two groups,
// no key repeated, each globbing its own directory over one minimal source
// there (`expectTwoSpelledGroups`); a product decoding the escape reads the
// key `ab` twice and refuses the file (14.14). Records made at module load:
// T7-2 stages both after a product invocation (S-9's timing clause).
function twoSpelledGroupsConfig(firstKey: string, secondKey: string): string {
  return `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    ${firstKey}: ["a/*.mdx"],
    ${secondKey}: ["b/*.mdx"]
  }
})
`;
}
const STRING_KEYS_TWO_GROUPS_CONFIG = stagedTs(
  'T7-2 xspec.config.ts (keys read as spelled: the string-literal group keys "ab" and "ab" with its b written as the hexadecimal escape of U+0062)',
  twoSpelledGroupsConfig('"ab"', ESCAPED_AB_STRING_KEY),
);
const IDENTIFIER_KEYS_TWO_GROUPS_CONFIG = stagedTs(
  "T7-2 xspec.config.ts (identifier keys read as spelled: the group keys ab and ab with its b written as the Unicode escape of U+0062)",
  twoSpelledGroupsConfig("ab", ESCAPED_AB_IDENTIFIER),
);

// The module-load self-check of the composed files: the canonical
// composition with the plain key is the canonical text byte for byte, so
// each top-level-key arm differs from it in the key's spelling alone; and
// each file holds the backslashes its spellings bring and no other — one in
// each refused arm but the identifier-keyed group's, two there (its key
// and its boundary), three in its resolving twin, and one in each
// two-group file. A mismatch is a harness error thrown at load, never a
// product verdict.
const SPELLED_KEY_BACKSLASHES = [
  ...SPELLED_KEY_VIOLATIONS.map((arm) => arm.config),
  ...SPELLED_IDENTIFIER_KEY_VIOLATIONS.map((arm) => arm.config),
  IDENTIFIER_NAME_CONFIG,
  STRING_KEYS_TWO_GROUPS_CONFIG,
  IDENTIFIER_KEYS_TWO_GROUPS_CONFIG,
].map((config) => configText(config).split(BACKSLASH).length - 1);
if (
  canonicalWithSpecsKey("specs") !== configText(SPECS_ONLY_CONFIG) ||
  JSON.stringify(SPELLED_KEY_BACKSLASHES) !==
    JSON.stringify([1, 1, 1, 2, 3, 1, 1])
) {
  throw new Error(
    "T7-2 fixture self-check: the canonical composition with the plain " +
      "top-level key must be the canonical text, and the files of the keys " +
      "read as spelled must hold 1, 1, 1, 2, 3, 1, and 1 backslashes " +
      "(module header); got " +
      JSON.stringify(SPELLED_KEY_BACKSLASHES),
  );
}

/**
 * A verbatim group name resolving (T7-2's group-name arms; module header):
 * `config` — the spec group keyed `prod`, backslash, `u0075`, `ct`, as a
 * string literal or as an identifier, its profile's target and boundary
 * spelled as that key is — staged beside the minimal source; `build` loads
 * it (exit 0), `inventory` names the group as spelled, and the profile's
 * rows show its target resolved: with the boundary the same group, the
 * target set is the group's one leaf, uncovered (8.1, 8.2).
 */
async function expectVerbatimGroupNameResolves(
  product: ProductBinding,
  config: StagedTs,
  label: string,
): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": config,
        "specs/A.mdx": SECTION_A_SOURCE,
      },
    },
    async (workspace) => {
      await buildOk(
        product,
        workspace,
        `${label}: ` +
          "`build` — the profile's target and boundary, spelled as the " +
          "group's key is, resolve (SPEC 7, 2.4, 7.4)",
      );
      const inventoryLabel = `${label} ` + "`inventory --json`";
      const inventory = decodeInventoryDocument(
        await runJson(
          product,
          workspace,
          ["inventory", "--json"],
          inventoryLabel,
        ),
        inventoryLabel,
      );
      assertSameJson(
        inventory.configuration.specs.map((group) => group.name),
        [VERBATIM_GROUP_NAME],
        `${inventoryLabel}: the group is named as spelled — eleven ` +
          `characters, the six of the escape included — never the ` +
          `interpreted "product" (SPEC 7, 2.4, 11.6)`,
      );
      const coverageLabel = `${label} ` + "`coverage --json`";
      const coverage = decodeCoverageReport(
        await runJson(
          product,
          workspace,
          ["coverage", "--json"],
          coverageLabel,
        ),
        coverageLabel,
      );
      assertSameJson(
        coverage.profiles.map((row) => ({
          name: row.name,
          covered: row.covered.map((entry) => entry.identity),
          uncovered: [...row.uncovered].sort(),
        })),
        [{ name: "verbatim", covered: [], uncovered: ["specs/A.mdx#a"] }],
        `${coverageLabel}: the profile resolved its target — the ` +
          `group's one leaf is its target set, uncovered under a ` +
          `boundary sourcing no edge into it (SPEC 7, 2.4, 7.4, 8.1, 8.2)`,
      );
    },
  );
}

/**
 * Keys distinct as spelled (T7-2; module header): `config` — the spec
 * groups keyed `ab` (`a/*.mdx`) and its escape-spelled twin (`b/*.mdx`),
 * whose name as spelled is `secondName` — staged beside the minimal sources
 * `a/A.mdx` and `b/B.mdx`; `build` loads it (exit 0), and `inventory --json`
 * reports both groups in configuration order, the second named as spelled,
 * and each source a member of its own glob's group alone, in byte order of
 * path (11.6).
 */
async function expectTwoSpelledGroups(
  product: ProductBinding,
  config: StagedTs,
  secondName: string,
  label: string,
): Promise<void> {
  await withWorkspace(
    {
      files: {
        "xspec.config.ts": config,
        "a/A.mdx": SECTION_A_SOURCE,
        "b/B.mdx": SECTION_B_SOURCE,
      },
    },
    async (workspace) => {
      await buildOk(
        product,
        workspace,
        `${label}: ` +
          "`build` — two groups, no key repeated: the configuration loads " +
          "(SPEC 7, 2.4)",
      );
      const inventoryLabel = `${label} ` + "`inventory --json`";
      const inventory = decodeInventoryDocument(
        await runJson(
          product,
          workspace,
          ["inventory", "--json"],
          inventoryLabel,
        ),
        inventoryLabel,
      );
      assertSameJson(
        inventory.configuration.specs,
        [
          { name: "ab", globs: ["a/*.mdx"] },
          { name: secondName, globs: ["b/*.mdx"] },
        ],
        `${inventoryLabel}: both groups are reported in configuration ` +
          `order, the escape-spelled key's group named as spelled — ` +
          `${JSON.stringify(secondName)} as a JSON string, the escape's ` +
          `characters included — never the decoded "ab" (SPEC 7, 2.4, 11.6)`,
      );
      assertSameJson(
        inventory.sources,
        [
          { path: "a/A.mdx", groups: [{ name: "ab", kind: "spec" }] },
          { path: "b/B.mdx", groups: [{ name: secondName, kind: "spec" }] },
        ],
        `${inventoryLabel}: each group discovers its own glob's file — ` +
          `a/A.mdx a member of "ab" alone and b/B.mdx of the ` +
          `escape-spelled key's group alone, in byte order of path ` +
          `(SPEC 7, 7.1, 11.6)`,
      );
    },
  );
}

// Encoding (SPEC 7: the file's bytes MUST be valid UTF-8 and MUST NOT begin
// with a byte-order mark; either violation is 14.14). The non-UTF-8 fixture
// is the canonical configuration plus one trailing line comment holding the
// byte 0xFF, valid in no UTF-8 sequence: a product decoding leniently (0xFF
// → U+FFFD) sees the valid configuration and a comment contributing nothing,
// loads, and builds (exit 0). The BOM fixture is the canonical text prefixed
// by EF BB BF, which TypeScript tooling strips silently, so a product
// reading through the compiler alone loads it too.
const NON_UTF8_CONFIG = stagedTs(
  "T7-2 xspec.config.ts (encoding: the byte 0xFF inside a trailing line comment)",
  Buffer.concat([
    Buffer.from(configText(SPECS_ONLY_CONFIG), "utf8"),
    Buffer.from("// ", "utf8"),
    Buffer.from([0xff]),
    Buffer.from("\n", "utf8"),
  ]),
  "unparseable",
);
const BOM_CONFIG = stagedTs(
  "T7-2 xspec.config.ts (encoding: a leading byte-order mark)",
  Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from(configText(SPECS_ONLY_CONFIG), "utf8"),
  ]),
  "unparseable",
);

// Object-literal keys and names (SPEC 7, 14.14): a key repeated within one
// object literal — an identifier key and a string-literal key spelling the
// same name included, whatever TypeScript's own diagnosis of the
// repetition — and an empty spec group, code group, profile, or rule name
// (`""`), one arm each. Every fixture is otherwise valid: each repeated
// member is a valid group, the empty-named code group stands beside the
// valid spec group `main` (its glob matching no staged file — a group
// matching no files is valid, 7), and the empty-named profile and rule
// reference the existing unambiguous group `main`, so the repetition or
// the empty name is the only defect.
const KEY_AND_NAME_VIOLATIONS = refusedConfigArms("T7-2", [
  {
    label: "repeated key: `specs` twice within the top-level object literal",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label:
      "repeated key: an identifier key and a string-literal key spelling " +
      "the same group name within `specs`",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    product: ["specs/**/*.mdx"],
    "product": ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label: 'empty name: a spec group ""',
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    "": ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label: 'empty name: a code group ""',
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    "": ["src/**/*.ts"]
  }
})
`,
  },
  {
    label: 'empty name: a coverage profile whose name is ""',
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "",
      target: "main",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`,
  },
  {
    label: 'empty name: a policy rule whose name is ""',
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  policy: [
    {
      name: "",
      type: "forbidden",
      from: { group: "main" },
      to: { group: "main" }
    }
  ]
})
`,
  },
]);

// Comments (SPEC 7: permitted anywhere, contributing nothing). The commented
// fixture places line and block comments before the import, inside the
// import declaration between each two of its tokens, after it, before the
// first key, between keys, inside the glob list (after a glob and between
// two globs), after the list, after the export, and after everything; its
// twin is the same configuration with every comment removed. The import
// declaration is spelled as TEST-SPEC T7-2 spells it: `/* c */` between
// `import` and `{`, `{` and `defineConfig`, `defineConfig` and `}`, and `}`
// and `from`; `// c` after `from`, its line feed putting the module
// specifier `"xspec"` on the next line; and `/* c */` after the specifier.
// Two globs and a `markdown` key give the "between" positions something to
// stand between (`docs/` matches nothing: valid, 7).
const COMMENT_FREE_CONFIG = stagedTs(
  "T7-2 xspec.config.ts (comment-free twin)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: [
      "specs/**/*.mdx",
      "docs/**/*.mdx"
    ]
  },
  markdown: { emit: false }
})
`,
);
const COMMENTED_CONFIG = stagedTs(
  "T7-2 xspec.config.ts (comments)",
  `// a line comment before the import
/* a block comment
   before the import */
import /* c */ { /* c */ defineConfig /* c */ } /* c */ from // c
"xspec" /* c */ // after the import

export default defineConfig({
  // before the first key
  specs: {
    main: [
      "specs/**/*.mdx", // after a glob
      /* between two globs */ "docs/**/*.mdx"
    ] /* after the glob list */
  }, // after a key
  /* between keys */
  markdown: { emit: false }
}) // after the export
/* after everything */
`,
);

/**
 * The resolved configuration view under `config` (T7-2's comments,
 * string-literal import name, and statement-order arms; module header):
 * `config` staged as `xspec.config.ts` beside the minimal source in a fresh
 * workspace, `build` required to load it (exit 0) — then, where `check` is
 * asked for (the statement-order arm), `check` required to exit 0 too — and
 * the `configuration` member of `inventory --json` returned as reported,
 * the document form-decoded first.
 */
async function configurationViewOf(
  product: ProductBinding,
  config: StagedTs,
  label: string,
  options: { readonly check?: true } = {},
): Promise<unknown> {
  return await withWorkspace(
    {
      files: {
        "xspec.config.ts": config,
        "specs/A.mdx": SECTION_A_SOURCE,
      },
    },
    async (workspace) => {
      await buildOk(
        product,
        workspace,
        `${label}: ` + "`build` — the configuration loads (SPEC 7)",
      );
      if (options.check === true) {
        await expectExit(
          product,
          workspace,
          ["check"],
          0,
          `${label}: ` +
            "`check` after the build — the configuration loads, and the " +
            "freshly built workspace yields no finding (SPEC 7, 12.0)",
        );
      }
      const inventoryLabel = `${label} ` + "`inventory --json`";
      const raw = await runJson(
        product,
        workspace,
        ["inventory", "--json"],
        inventoryLabel,
      );
      decodeInventoryDocument(raw, inventoryLabel);
      return (raw as { readonly configuration: unknown }).configuration;
    },
  );
}

/**
 * Two resolved configuration views byte-identical (module header): equal
 * as values and as serializations, member order included.
 */
function assertConfigurationViewsIdentical(
  actual: unknown,
  twin: unknown,
  context: string,
): void {
  assertSameJson(actual, twin, context);
  if (JSON.stringify(actual) !== JSON.stringify(twin)) {
    fail(
      `${context}; the members are equal as values but serialize ` +
        `differently (member order): ${JSON.stringify(actual)} vs ` +
        JSON.stringify(twin),
    );
  }
}

const T7_2 = defineProductTest({
  id: "T7-2",
  title:
    "declarative form: a syntax error, a missing defineConfig import, a " +
    "type or defer modifier or import attributes on that import, extra " +
    "statements, each non-literal argument form, a " +
    "null literal (markdown's outDir, a profile's targetTags), a non-call " +
    "default export, a call without a sole argument (defineConfig(), " +
    "defineConfig({…}, {})), a numeric-literal key, the call, its " +
    "argument, or a value inside it wrapped (satisfies object, " +
    "parentheses, a non-null assertion, as const, as boolean), the call " +
    "spelled with type arguments or as an optional call, an escape-spelled " +
    "string-literal import name, a default or namespace import, an extra " +
    "default or named binding, an export assignment (export = " +
    "defineConfig({…})), and an import assignment (import defineConfig = " +
    'require("xspec")) are configuration errors (14.14, exit 2); an ' +
    "aliased defineConfig import is valid, and so is a string-literal " +
    "import name spelling defineConfig, read verbatim (2.4) — it loads, " +
    "inventory's configuration byte-identical to its identifier-named " +
    "twin's; the default export may precede the import — it loads, build " +
    "and check exit 0, inventory's configuration byte-identical to its " +
    "import-first twin's; " +
    "string-literal group-name keys are part of the accepted form — they " +
    "load, discover, and resolve in a coverage profile and a policy " +
    "selector (SPEC 7, 7.4, 7.5, 8); literals are read verbatim — an " +
    "escape-spelled glob matches nothing and an escape-spelled group name " +
    "is named only by the same spelling (2.4); keys and enumerated values " +
    "are read as spelled, an identifier key alike — an escape-spelled " +
    "top-level key, a string literal or an identifier, is an unknown key " +
    "(specs then missing) and an escape-spelled mode no mode, each a " +
    "configuration error, while keys distinct only as spelled (ab and its " +
    "escape-spelled twin, string literals or identifiers) load as two " +
    "groups, each discovering its own glob's file, and an escape-spelled " +
    "identifier group key is named only by the same spelling (2.4); a " +
    "non-UTF-8 file, a " +
    "byte-order mark, a repeated key, and an empty spec group, code " +
    "group, profile, or rule name are configuration errors; comments " +
    "anywhere, inside the import declaration between each two of its " +
    "tokens included, contribute nothing (inventory's configuration " +
    "byte-identical to the comment-free twin's)",
  run: async (product) => {
    for (const arm of FORM_VIOLATIONS) {
      await expectConfigRefused(product, arm.config, `T7-2 (${arm.label})`);
    }

    await withWorkspace(
      {
        files: {
          "xspec.config.ts": ALIASED_CONFIG,
          "specs/A.mdx": SECTION_A_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T7-2 (aliased defineConfig import): `build` accepts the " +
            "configuration — the import binding is optionally aliased " +
            "(SPEC 7)",
        );
        const label = "T7-2 (aliased defineConfig import) `ids --json`";
        const report = decodeIdsReport(
          await runJson(product, workspace, ["ids", "--json"], label),
          label,
        );
        assertSameJson(
          report.files,
          [{ file: "specs/A.mdx", ids: ["a"] }],
          `${label}: the aliased configuration took effect — its spec ` +
            `group drives discovery (SPEC 7)`,
        );
      },
    );

    // Binding forms (SPEC 7, 2.4): the string-literal import name spelling
    // `defineConfig` is that import, aliased — it loads, and the inventory's
    // resolved `configuration` view is byte-identical to its
    // identifier-named twin's (compared as the comments arm compares). Its
    // escape-spelled twin and the other binding forms are FORM_VIOLATIONS
    // rows, refused above.
    const stringImportNameView = await configurationViewOf(
      product,
      STRING_IMPORT_NAME_CONFIG,
      'T7-2 (binding forms: the string-literal import name, import { "defineConfig" as d } from "xspec" — that import, aliased, read verbatim)',
    );
    const identifierImportNameView = await configurationViewOf(
      product,
      IDENTIFIER_IMPORT_NAME_CONFIG,
      'T7-2 (binding forms: the identifier-named twin, import { defineConfig as d } from "xspec")',
    );
    assertConfigurationViewsIdentical(
      stringImportNameView,
      identifierImportNameView,
      "T7-2 (binding forms): `inventory`'s `configuration` member under the " +
        'string-literal import name, import { "defineConfig" as d } from ' +
        '"xspec", is byte-identical to its identifier-named twin' +
        "'s — the name, read verbatim, spells defineConfig, so the import " +
        "is that import, aliased (SPEC 7, 2.4, 11.6)",
    );

    // Statement order (SPEC 7 fixes which statements the file holds, never
    // their order): the default export spelled before the import loads —
    // `build` and `check` exit 0 — and the inventory's resolved
    // `configuration` view is byte-identical to its import-first twin's,
    // the canonical file's (compared as the comments arm compares). The
    // statement forms are FORM_VIOLATIONS rows, refused above.
    const exportFirstView = await configurationViewOf(
      product,
      STATEMENT_ORDER_CONFIG,
      'T7-2 (statement order: export default defineConfig({…}) followed by import { defineConfig } from "xspec")',
      { check: true },
    );
    const importFirstView = await configurationViewOf(
      product,
      SPECS_ONLY_CONFIG,
      "T7-2 (statement order: the import-first twin, the canonical " +
        "configuration)",
    );
    assertConfigurationViewsIdentical(
      exportFirstView,
      importFirstView,
      "T7-2 (statement order): `inventory`'s `configuration` member under " +
        "the configuration whose default export precedes its import is " +
        "byte-identical to its import-first twin's — an import binds its " +
        "name throughout its module, and SPEC 7 fixes which statements the " +
        "file holds, never their order (SPEC 7, 11.6)",
    );

    // String-literal group-name keys are part of the accepted form (SPEC 7):
    // the quoted-key groups load, discover, and resolve in a coverage
    // profile and in a policy selector.
    await withWorkspace({ files: QUOTED_KEYS_FILES }, async (workspace) => {
      // Loads without error: a product accepting identifier keys alone
      // refuses this configuration (14.14, exit 2) and fails here. The
      // staged policy violation cannot fail the build — build never
      // evaluates policy (SPEC 7.5, 12.1).
      await buildOk(
        product,
        workspace,
        "T7-2 (string-literal keys): `build` — a spec group and a code " +
          'group under string-literal keys ("my-group", "test-code") whose ' +
          "names are not TypeScript identifiers load without error (SPEC 7)",
      );

      // Both groups discover their globs' files.
      const idsLabel = "T7-2 (string-literal keys) `ids --json`";
      const ids = decodeIdsReport(
        await runJson(product, workspace, ["ids", "--json"], idsLabel),
        idsLabel,
      );
      assertSameJson(
        ids.files,
        [{ file: "specs/A.mdx", ids: ["a", "p"] }],
        `${idsLabel}: the "my-group" spec group discovered its glob's file ` +
          `(SPEC 7, 7.1)`,
      );
      const edgesLabel =
        "T7-2 (string-literal keys) `query edges` (unfiltered)";
      const edges = decodeEdgesReport(
        await runJson(product, workspace, ["query", "edges"], edgesLabel),
        edgesLabel,
      );
      assertEdgeSetEqual(
        edges,
        QUOTED_KEYS_EDGES,
        `${edgesLabel}: the complete edge set carries the references edge ` +
          `sourced at src/impl.ts — the "test-code" code group discovered ` +
          `its glob's file (SPEC 7, 7.2, 4.5; an undiscovered code file ` +
          `sources no edge, as T7-3 asserts) — and nothing stray`,
      );

      // The names resolve in a coverage profile: target "my-group" with
      // boundary "test-code" reports its coverage (SPEC 7.4, 8).
      const coverageLabel = "T7-2 (string-literal keys) `coverage --json`";
      const coverage = decodeCoverageReport(
        await runJson(
          product,
          workspace,
          ["coverage", "--json"],
          coverageLabel,
        ),
        coverageLabel,
      );
      const profile = coverage.profiles.find((row) => row.name === "quoted");
      if (profile === undefined) {
        fail(
          `${coverageLabel}: the report must carry profile "quoted" — its ` +
            `target "my-group" and boundary "test-code" resolve to the ` +
            `string-literal-keyed groups (SPEC 7, 7.4, 8.2); got profiles ` +
            `${JSON.stringify(coverage.profiles.map((row) => row.name))}`,
        );
      }
      assertSameJson(
        profile.covered.map((row) => ({
          identity: row.identity,
          path: row.path,
        })),
        [{ identity: "specs/A.mdx#a", path: ["src/impl.ts", "specs/A.mdx#a"] }],
        `${coverageLabel} profile quoted: the "test-code" boundary's ` +
          `references edge covers \`a\` over the path [code location, ` +
          `target] — both quoted names resolved (SPEC 7.4, 8, 8.2)`,
      );
      assertSameJson(
        [...profile.uncovered].sort(),
        ["specs/A.mdx#p"],
        `${coverageLabel} profile quoted: \`p\`, with no boundary edge into ` +
          `it, is uncovered — the target set is the quoted spec group's ` +
          `leaves (SPEC 7.4, 8.1, 8.2)`,
      );

      // The name resolves in a policy selector: { group: "my-group" }
      // matches the group's nodes (SPEC 7.5) — the staged depends edge,
      // both endpoints "my-group" nodes (premise pinned by the edge-set
      // equality above), is the forbidden rule's one violation.
      const checkLabel = "T7-2 (string-literal keys) `check --json`";
      const checkResult = await expectExit(
        product,
        workspace,
        ["check", "--json"],
        1,
        `${checkLabel} — the forbidden rule's selectors match through the ` +
          `string-literal group name, so the depends edge violates it and ` +
          `check exits 1 (SPEC 7.5, 14.12, 12.0)`,
      );
      const checkFindings = decodeFindingsReport(
        parseJsonStdout(checkResult, checkLabel),
        checkLabel,
      ).findings;
      assertConditionCounts(checkFindings, { "14.12": 1 }, checkLabel);
      assertSameJson(
        checkFindings.map((finding) => ({
          locations: finding.locations,
          path: finding.path,
          identities: finding.identities,
        })),
        [
          {
            locations: [],
            path: null,
            identities: [
              "no-internal-deps",
              "specs/A.mdx#p",
              "depends",
              "specs/A.mdx#a",
            ],
          },
        ],
        `${checkLabel}: the one policy finding names the rule and the ` +
          `offending edge — identities in order rule name, source, kind ` +
          `token, target; no in-source locations, no concerned path ` +
          `(SPEC 7.5, 14.12, 12.7): { group: "my-group" } matched the ` +
          `quoted group's nodes`,
      );
    });

    // Verbatim literals (SPEC 7, 2.4): the glob spelled with the escape of
    // `*` is read as its characters — the inventory reports it as spelled
    // and its group discovers nothing.
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": VERBATIM_GLOB_CONFIG,
          "specs/A.mdx": SECTION_A_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T7-2 (verbatim glob): `build` — the escape-spelled glob names " +
            "no file, and a group matching no files is valid, discovery " +
            "yielding zero sources (SPEC 7, 2.4)",
        );
        const inventoryLabel = "T7-2 (verbatim glob) `inventory --json`";
        const inventory = decodeInventoryDocument(
          await runJson(
            product,
            workspace,
            ["inventory", "--json"],
            inventoryLabel,
          ),
          inventoryLabel,
        );
        assertSameJson(
          inventory.configuration.specs,
          [{ name: "main", globs: [VERBATIM_GLOB] }],
          `${inventoryLabel}: the configured glob is reported as spelled — ` +
            `thirteen characters, the six of the escape included — never ` +
            `the interpreted "specs/*.mdx" (SPEC 7, 2.4, 11.6)`,
        );
        assertSameJson(
          inventory.sources,
          [],
          `${inventoryLabel}: the verbatim glob matches no discovered ` +
            `file — specs/A.mdx is not "specs/${BACKSLASH}u002A.mdx" — so ` +
            `the group discovers zero sources (SPEC 7, 2.4)`,
        );
        const idsLabel = "T7-2 (verbatim glob) `ids --json`";
        const ids = decodeIdsReport(
          await runJson(product, workspace, ["ids", "--json"], idsLabel),
          idsLabel,
        );
        assertSameJson(
          ids.files,
          [],
          `${idsLabel}: zero discovered spec sources list zero files ` +
            `(SPEC 7, 2.4, 12.3)`,
        );
      },
    );

    // A group name spelled with the escape of `u` names a group whose
    // spelling contains a backslash: a profile's target spelled `product`
    // is an unknown group (14.14), the escape spelling resolves.
    await expectConfigRefused(
      product,
      VERBATIM_NAME_UNKNOWN_TARGET_CONFIG,
      'T7-2 (verbatim group name: a profile\'s target "product" names no ' +
        "configured group — the group's spelling contains a backslash)",
    );
    await expectVerbatimGroupNameResolves(
      product,
      VERBATIM_NAME_CONFIG,
      "T7-2 (verbatim group name)",
    );

    // Keys and enumerated values are read as spelled too (SPEC 7, 2.4): a
    // string-literal top-level key and a profile's `mode` spelled with an
    // escape are refused (14.14) — no `specs`, and no mode — while the
    // keys "ab" and its escape-spelled twin declare two groups that load,
    // each discovering its own glob's file.
    for (const arm of SPELLED_KEY_VIOLATIONS) {
      await expectConfigRefused(product, arm.config, `T7-2 (${arm.label})`);
    }
    await expectTwoSpelledGroups(
      product,
      STRING_KEYS_TWO_GROUPS_CONFIG,
      // The name as spelled: the characters between its delimiters (2.4).
      ESCAPED_AB_STRING_KEY.slice(1, -1),
      'T7-2 (keys read as spelled: the string-literal group keys "ab" and ' +
        "its escape-spelled twin)",
    );

    // Identifier keys are read as spelled alike (SPEC 7, 2.4): the top-level
    // identifier key `specs` with its `s` so escaped, and the verbatim group
    // name keyed as an identifier under a profile targeting `product`, are
    // refused (14.14); the identifier keys `ab` and its escape-spelled twin
    // declare two groups that load; and the identifier-keyed group is named
    // by a target spelled as its key.
    for (const arm of SPELLED_IDENTIFIER_KEY_VIOLATIONS) {
      await expectConfigRefused(product, arm.config, `T7-2 (${arm.label})`);
    }
    await expectTwoSpelledGroups(
      product,
      IDENTIFIER_KEYS_TWO_GROUPS_CONFIG,
      ESCAPED_AB_IDENTIFIER,
      "T7-2 (identifier keys read as spelled: the group keys ab and its " +
        "escape-spelled twin)",
    );
    await expectVerbatimGroupNameResolves(
      product,
      IDENTIFIER_NAME_CONFIG,
      "T7-2 (identifier keys read as spelled: the group keyed by the " +
        "identifier spelling, the target spelled as its key)",
    );

    // Encoding (SPEC 7, 14.14): bytes that are not valid UTF-8; a
    // byte-order mark.
    await expectConfigRefused(
      product,
      NON_UTF8_CONFIG,
      "T7-2 (encoding: the byte 0xFF inside a trailing line comment — the " +
        "file's bytes are not valid UTF-8)",
    );
    await expectConfigRefused(
      product,
      BOM_CONFIG,
      "T7-2 (encoding: the file begins with a byte-order mark)",
    );

    // Object-literal keys and names (SPEC 7, 14.14): repeated keys, empty
    // names — each 14.14, exit 2.
    for (const arm of KEY_AND_NAME_VIOLATIONS) {
      await expectConfigRefused(product, arm.config, `T7-2 (${arm.label})`);
    }

    // Comments (SPEC 7): the commented configuration — comments inside the
    // import declaration between each two of its tokens included — loads,
    // and the inventory's resolved `configuration` view is byte-identical to
    // its comment-free twin's — compared as the member's serialization,
    // member order and spellings included.
    const commented = await configurationViewOf(
      product,
      COMMENTED_CONFIG,
      "T7-2 (comments)",
    );
    const commentFree = await configurationViewOf(
      product,
      COMMENT_FREE_CONFIG,
      "T7-2 (comment-free twin)",
    );
    assertConfigurationViewsIdentical(
      commented,
      commentFree,
      "T7-2 (comments): `inventory`'s `configuration` member under the " +
        "commented configuration is byte-identical to the comment-free " +
        "twin's — line and block comments before the import, inside the " +
        "import declaration between each two of its tokens (import /* c */ " +
        "{ /* c */ defineConfig /* c */ } /* c */ from // c, a line feed, " +
        '"xspec" /* c */), after it, between keys, inside the glob list, ' +
        "and after the export contribute nothing (SPEC 7, 11.6)",
    );
  },
});

// ---------------------------------------------------------------------------
// T7-3 — keys
// ---------------------------------------------------------------------------

// 14.14 arms: `specs` missing, and an unknown key at each defined position —
// top level, in `markdown`, in a profile, in a rule, and in a selector. In
// every unknown-key fixture the surrounding configuration is valid (existing
// unambiguous group references, all required fields present, permitted
// literal values), so the unknown key is the only defect.
const KEY_VIOLATIONS = refusedConfigArms("T7-3", [
  {
    label: "`specs` missing",
    config: `import { defineConfig } from "xspec"

export default defineConfig({})
`,
  },
  {
    label: "unknown key at top level",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  extra: true
})
`,
  },
  {
    label: "unknown key in `markdown`",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  markdown: { emit: true, extra: true }
})
`,
  },
  {
    label: "unknown key in a coverage profile",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"],
    aux: ["aux/**/*.mdx"]
  },
  coverage: [
    {
      name: "p",
      target: "main",
      boundary: "aux",
      mode: "direct",
      extra: true
    }
  ]
})
`,
  },
  {
    label: "unknown key in a policy rule",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"],
    aux: ["aux/**/*.mdx"]
  },
  policy: [
    {
      name: "r",
      type: "forbidden",
      from: { group: "main" },
      to: { group: "aux" },
      extra: true
    }
  ]
})
`,
  },
  {
    label: "unknown key in a selector",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"],
    aux: ["aux/**/*.mdx"]
  },
  policy: [
    {
      name: "r",
      type: "forbidden",
      from: { group: "main", extra: true },
      to: { group: "aux" }
    }
  ]
})
`,
  },
]);

// Value shapes (SPEC 7, 7.1, 7.2; 14.14: a configuration that does not
// conform, an otherwise invalid group shape) — TEST-SPEC T7-3's "one arm
// each": seven fixtures, every one SPECS_ONLY_CONFIG with exactly one shape
// deviation, so the refusal is attributable to it alone. Each deviating
// value is admitted by the declarative form of 7 (a static string literal,
// the boolean literal `true`, an object or array literal — never a T7-2
// form error) and excluded by the shapes 7.1, 7.2, 7.4, and 7.5 prescribe:
// a group's value is a list of globs, a glob is a string, `coverage` and
// `policy` are lists, and `specs` and `code` are maps of named groups —
// discriminating a product that reads the declarative form loosely,
// accepting whatever its own loader tolerates.
const VALUE_SHAPE_VIOLATIONS = refusedConfigArms("T7-3", [
  {
    label: "a spec group whose value is a single string rather than a list",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: "specs/**/*.mdx"
  }
})
`,
  },
  {
    label: "a code group whose value is a single string rather than a list",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    impl: "src/**/*.ts"
  }
})
`,
  },
  {
    label: "a glob list holding a non-string element ([true])",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: [true]
  }
})
`,
  },
  {
    label: "`coverage` given as an object rather than a list ({})",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: {}
})
`,
  },
  {
    label: "`policy` given as an object rather than a list ({})",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  policy: {}
})
`,
  },
  {
    label: "`specs` given as a list rather than a map of groups",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: ["specs/**/*.mdx"]
})
`,
  },
  {
    label: "`code` given as a list rather than a map of groups",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: ["src/**/*.ts"]
})
`,
  },
]);

// `code` omitted: a marker-bearing TypeScript file that WOULD be a valid
// code source (a spec module import plus a marker recording a `references`
// edge, SPEC 4.5) — so a product that wrongly discovers `.ts` files without
// a `code` key records an edge from it and fails the edge-set equality.
const MARKER_TS = stagedTs(
  "T7-3 src/impl.ts (code omitted: the marker-bearing file)",
  `import SPEC from "../specs/A.xspec"

export function impl(): void {
  SPEC.a
}
`,
);

// The complete edge set of the `code`-omitted fixture (SPEC 5.1–5.2): one
// contains edge from A.mdx's root to its only section — and nothing sourced
// at the undiscovered src/impl.ts.
const CODE_OMITTED_EDGES: readonly GraphEdge[] = [
  { from: "specs/A.mdx", to: "specs/A.mdx#a", kind: "contains" },
];

// `policy` omitted / empty lists: two spec groups joined by one depends edge
// (external-form d prop, SPEC 2.2) — the edge T7.5-2's forbidden rule
// (from group product to group other) would flag if the rule existed.
const TWO_GROUP_CONFIG = stagedTs(
  "T7-3 xspec.config.ts (policy omitted: two spec groups)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    product: ["specs/product/**/*.mdx"],
    other: ["specs/other/**/*.mdx"]
  }
})
`,
);

const EMPTY_LISTS_CONFIG = stagedTs(
  "T7-3 xspec.config.ts (empty coverage and policy lists)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    product: ["specs/product/**/*.mdx"],
    other: ["specs/other/**/*.mdx"]
  },
  coverage: [],
  policy: []
})
`,
);

const PRODUCT_MDX = stagedMdx(
  "T7-3 specs/product/P.mdx",
  `import O from "../other/O.xspec"

<S id="p" d={O.o}>
Product behavior depending on other.
</S>
`,
);

const OTHER_MDX = stagedMdx("T7-3 specs/other/O.mdx", mdxSection("o"));

const VIOLATING_EDGE_FILES: Readonly<Record<string, InitialFileContents>> = {
  "specs/product/P.mdx": PRODUCT_MDX,
  "specs/other/O.mdx": OTHER_MDX,
};

/** The depends edge the omitted/empty policy would have forbidden. */
const WOULD_VIOLATE_EDGE: readonly GraphEdge[] = [
  { from: "specs/product/P.mdx#p", to: "specs/other/O.mdx#o", kind: "depends" },
];

/** The graph-data area's exact path bytes: `.xspec` at the root (SPEC 13.3). */
const GRAPH_DATA_AREA_BYTES = Buffer.from(".xspec", "latin1");

/**
 * Every entry of the workspace tree outside the graph-data area that is not
 * a directory, as snapshot keys — each entry's exact relative path bytes,
 * `/`-separated, one latin1 character per byte (helpers/snapshot.ts) — in
 * bytewise order. The tree is walked by exact name bytes
 * (`snapshotDirectory`), so a directory whose name is not valid UTF-8 is
 * reached and listed under, never misnamed; directories are recursed into,
 * never listed, and every other entry — a symbolic link included, never
 * followed — is listed. The graph-data area, the root's `.xspec`, is pruned
 * whole, so no key equal to `.xspec` or beginning with `.xspec/` is ever
 * listed: graph data lives there at paths the product chooses (SPEC 13.3:
 * its layout "deliberately unenumerated"; 7.3: "unenumerated paths"), so any
 * name may occur there, a `.md` suffix included, and no emit destination
 * lies in the area (7.3: an `outDir` of `.xspec` or beginning with `.xspec/`
 * is a configuration error), so nothing under it is emitted Markdown — its
 * content and names are opaque to the harness (H-4).
 */
async function listFilesOutsideGraphDataArea(
  workspace: TestWorkspace,
): Promise<string[]> {
  const snapshot = await snapshotDirectory(workspace.root, {
    exclude: (rel) => Buffer.compare(rel, GRAPH_DATA_AREA_BYTES) === 0,
  });
  const keys: string[] = [];
  for (const [key, entry] of snapshot.entries) {
    if (entry.kind !== "dir") keys.push(key);
  }
  // A latin1 key's UTF-16 code units are its bytes, so the default string
  // sort orders the whole paths bytewise.
  return keys.sort();
}

/**
 * Assert the depends edge the omitted/empty rule would flag exists — the
 * fixture premise of the `policy` arms; without it "check reports no policy
 * findings" would be vacuous.
 */
async function assertViolatingEdgePresent(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  const label = `${context} \`query edges --kinds depends\` (fixture premise)`;
  const depends = decodeEdgesReport(
    await runJson(
      product,
      workspace,
      ["query", "edges", "--kinds", "depends"],
      label,
    ),
    label,
  );
  assertEdgeSetEqual(
    depends,
    WOULD_VIOLATE_EDGE,
    `${label}: the depends edge the absent forbidden rule (T7.5-2's shape: ` +
      `from group product to group other) would flag is present — the ` +
      `no-findings assertion below is not vacuous (SPEC 2.2, 7.5)`,
  );
}

// Names containing U+FFFD (SPEC 7, 14.14; 12.0: no argument value carries
// the character, and configured names are named in arguments): a spec
// group, a code group, a profile, and a rule, one arm each. The character
// is staged as its validly encoded code point (EF BF BD) between two
// letters, so 14.14's name rule — never the encoding rule — is at stake;
// each group key takes the string-literal form (U+FFFD is no identifier
// character), the code group stands beside the valid spec group `main`
// (its glob matching no staged file — valid, 7), and the profile and rule
// reference the existing unambiguous group `main`, so the name is each
// fixture's only defect. A product not checking names loads each and
// builds (exit 0).
const REPLACEMENT_NAME_VIOLATIONS = refusedConfigArms("T7-3", [
  {
    label: "a spec group named with U+FFFD",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    "a${REPLACEMENT_CHARACTER}b": ["specs/**/*.mdx"]
  }
})
`,
  },
  {
    label: "a code group named with U+FFFD",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    "c${REPLACEMENT_CHARACTER}d": ["src/**/*.ts"]
  }
})
`,
  },
  {
    label: "a coverage profile named with U+FFFD",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "p${REPLACEMENT_CHARACTER}q",
      target: "main",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`,
  },
  {
    label: "a policy rule named with U+FFFD",
    config: `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  policy: [
    {
      name: "r${REPLACEMENT_CHARACTER}s",
      type: "forbidden",
      from: { group: "main" },
      to: { group: "main" }
    }
  ]
})
`,
  },
]);

const T7_3 = defineProductTest({
  id: "T7-3",
  title:
    "keys: specs is required; omitted code/markdown/coverage/policy mean " +
    "no code groups, no emission, zero profiles, and no policy findings; " +
    "empty coverage/policy lists equal omission; unknown keys at every " +
    "position, values of the wrong shape (a group valued by a single " +
    "string, a glob list holding true, coverage/policy given as objects, " +
    "specs/code given as lists), and a spec group, a code group, a " +
    "profile, or a rule named with U+FFFD are configuration errors (SPEC " +
    "7, 7.1, 7.2, 14.14)",
  run: async (product) => {
    // (a) `specs` missing and the unknown-key matrix — each 14.14, exit 2.
    for (const arm of KEY_VIOLATIONS) {
      await expectConfigRefused(product, arm.config, `T7-3 (${arm.label})`);
    }

    // (a′) value shapes — each 14.14, exit 2, the configuration file named
    // and nothing written (SPEC 7, 7.1, 7.2; 14.14).
    for (const arm of VALUE_SHAPE_VIOLATIONS) {
      await expectConfigRefused(product, arm.config, `T7-3 (${arm.label})`);
    }

    // (a″) names containing U+FFFD — a spec group, a code group, a
    // profile, a rule — each 14.14, exit 2 (SPEC 7, 14.14).
    for (const arm of REPLACEMENT_NAME_VIOLATIONS) {
      await expectConfigRefused(product, arm.config, `T7-3 (${arm.label})`);
    }

    // (b) `code` omitted — no code groups: the marker-bearing .ts file is
    // undiscovered, no edge is sourced at it, and naming it in --from is
    // unknown (exit 2; SPEC 7, 11).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": SECTION_A_SOURCE,
          "src/impl.ts": MARKER_TS,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T7-3 (code omitted): `build` — with no code groups the " +
            "marker-bearing src/impl.ts is no source, so nothing validates " +
            "or analyzes it (SPEC 7)",
        );
        const edgesLabel = "T7-3 (code omitted) `query edges` (unfiltered)";
        const edges = decodeEdgesReport(
          await runJson(product, workspace, ["query", "edges"], edgesLabel),
          edgesLabel,
        );
        assertEdgeSetEqual(
          edges,
          CODE_OMITTED_EDGES,
          `${edgesLabel}: the complete edge list carries no edge from the ` +
            `undiscovered src/impl.ts — omitting the code key means no ` +
            `code groups (SPEC 7, 4.5, 5.2)`,
        );
        const fromLabel =
          "T7-3 (code omitted) `query edges --from src/impl.ts`";
        const fromResult = await expectExit(
          product,
          workspace,
          ["query", "edges", "--from", "src/impl.ts"],
          2,
          `${fromLabel} — a path in no configured group is unknown, a ` +
            `usage error (SPEC 11, 12.0)`,
        );
        expectErrorDocument(
          fromResult,
          `${fromLabel} — query's single JSON document is its only output ` +
            `form, so JSON output is in effect without --json and the ` +
            `exit-2 error document is the entire stdout (SPEC 11, 12.0, ` +
            `12.7, H-5)`,
        );
        if (fromResult.stderrBytes.length === 0) {
          fail(
            `${fromLabel}: the usage error must be a standard-error ` +
              `diagnostic (SPEC 12.0); stderr is empty — ` +
              summarizeResult(fromResult),
          );
        }
      },
    );

    // (c) `markdown` omitted — no emission for any source (SPEC 7.3; T3-6).
    // The whole tree outside the graph-data area is listed by exact name
    // bytes, and each listed key judged by its bytes: `.md` is ASCII, so the
    // latin1 key's `endsWith` is a byte-wise suffix test. Graph data under
    // `.xspec/` is never judged — its names are the product's choice and no
    // emit destination lies there (SPEC 13.3, 7.3;
    // `listFilesOutsideGraphDataArea`); keys are rendered for the diagnosis
    // alone (`displaySnapshotPath`).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": SECTION_A_SOURCE,
          "specs/sub/B.mdx": SECTION_B_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(product, workspace, "T7-3 (markdown omitted): `build`");
        const files = await listFilesOutsideGraphDataArea(workspace);
        assertSameJson(
          files.filter((key) => key.endsWith(".md")).map(displaySnapshotPath),
          [],
          "T7-3 (markdown omitted): after `build`, no file anywhere in the " +
            "workspace tree outside the graph-data area `.xspec/` has a .md " +
            "name — omitting the markdown key means no Markdown emission " +
            "for any source, and no emit destination lies in the " +
            "graph-data area (SPEC 7, 7.3, 13.3; full file list outside " +
            `\`.xspec/\`: ${JSON.stringify(files.map(displaySnapshotPath))})`,
        );
      },
    );

    // (d) `coverage` omitted — zero profiles reported, exit 0 (SPEC 7, 8.2).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": SPECS_ONLY_CONFIG,
          "specs/A.mdx": SECTION_A_SOURCE,
        },
      },
      async (workspace) => {
        await buildOk(product, workspace, "T7-3 (coverage omitted): `build`");
        const label = "T7-3 (coverage omitted) `coverage --json`";
        const report = decodeCoverageReport(
          await runJson(product, workspace, ["coverage", "--json"], label),
          label,
        );
        assertSameJson(
          report.profiles,
          [],
          `${label}: omitting the coverage key means no profiles — the ` +
            `report carries zero profiles and the command exits 0 ` +
            `(SPEC 7, 8.2)`,
        );
      },
    );

    // (e) `policy` omitted — no rules: `check` over the would-violate edge
    // reports no policy findings and exits 0 (SPEC 7, 7.5).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": TWO_GROUP_CONFIG,
          ...VIOLATING_EDGE_FILES,
        },
      },
      async (workspace) => {
        await buildOk(product, workspace, "T7-3 (policy omitted): `build`");
        await assertViolatingEdgePresent(
          product,
          workspace,
          "T7-3 (policy omitted)",
        );
        await expectExit(
          product,
          workspace,
          ["check"],
          0,
          "T7-3 (policy omitted): `check` — with the rule omitted there " +
            "are no policy rules, so the edge yields no finding and check " +
            "exits 0 (SPEC 7, 7.5, 14.12)",
        );
      },
    );

    // (f) `coverage: []` and `policy: []` — valid, equivalent to omission:
    // zero profiles reported, no policy findings (SPEC 7).
    await withWorkspace(
      {
        files: {
          "xspec.config.ts": EMPTY_LISTS_CONFIG,
          ...VIOLATING_EDGE_FILES,
        },
      },
      async (workspace) => {
        await buildOk(
          product,
          workspace,
          "T7-3 (empty lists): `build` — coverage: [] and policy: [] are " +
            "valid configuration (SPEC 7)",
        );
        const label = "T7-3 (empty lists) `coverage --json`";
        const report = decodeCoverageReport(
          await runJson(product, workspace, ["coverage", "--json"], label),
          label,
        );
        assertSameJson(
          report.profiles,
          [],
          `${label}: coverage: [] is equivalent to omitting the key — ` +
            `zero profiles reported, exit 0 (SPEC 7, 8.2)`,
        );
        await assertViolatingEdgePresent(
          product,
          workspace,
          "T7-3 (empty lists)",
        );
        await expectExit(
          product,
          workspace,
          ["check"],
          0,
          "T7-3 (empty lists): `check` — policy: [] is equivalent to " +
            "omitting the key: no rules, no policy findings, exit 0 " +
            "(SPEC 7, 7.5)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T7-7 — validation on a built workspace
// ---------------------------------------------------------------------------

// The workspace every T7-7 arm is staged on, and its unstaged twin (module
// header): `specs/A.mdx` under the spec group `main`, `src/impl.ts` under
// the code group `app`, and the spec group `inner`, globbing `src/**/*.mdx`,
// matching no file — the spec and code globs overlap on no path occupied at
// the build (TEST-SPEC T7-7(b)). Staged-source records (module header):
// every arm workspace is created after the body's first product invocation,
// the twin's, and arm (a) stages the configuration's bytes at its link
// targets too — inside the root through `file()`, outside it as the
// record's text.
const T7_7_CONFIG = stagedTs(
  "T7-7 xspec.config.ts (the built workspace's configuration: the spec groups main over specs/**/*.mdx and inner over src/**/*.mdx beside the code group app over src/**/*, overlapping on no path occupied at the build; also arm (a)'s inside link target config/linked.config.ts, and its outside one's bytes)",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"],
    inner: ["src/**/*.mdx"]
  },
  code: {
    app: ["src/**/*"]
  }
})
`,
);
const T7_7_CODE_SOURCE = stagedTs(
  "T7-7 src/impl.ts (the built workspace's one code source, matched by the code group app alone)",
  "export const impl = 1\n",
);
// Arm (b)'s file, created after the build at a path both `inner` and `app`
// match: a valid single-section source carrying an ID unique in its
// workspace, so the overlap is the arm's one defect — a product missing it
// proceeds past configuration load (to exit 0, or a finding's exit 1,
// whatever it makes of the file) and fails the exit-code assertion either
// way, never exiting 2 for a side reason (module header; T7.2-1's decoys
// likewise).
const T7_7_DOUBLY_MATCHED_SOURCE = stagedMdx(
  "T7-7 src/x.mdx (arm (b)'s file, created after the build at a path both the spec group inner and the code group app match)",
  mdxSection("x"),
);

const T7_7_CONFIG_PATH = "xspec.config.ts";
const T7_7_DOUBLY_MATCHED_PATH = "src/x.mdx";
const T7_7_WORKSPACE: WorkspaceDecl = {
  files: {
    [T7_7_CONFIG_PATH]: T7_7_CONFIG,
    "specs/A.mdx": SECTION_A_SOURCE,
    "src/impl.ts": T7_7_CODE_SOURCE,
  },
};

// Arm (a)'s link targets, each a plain file holding the configuration's
// bytes: inside the workspace at a path no group matches, and outside it —
// in the workspace's own temporary directory, the root's parent
// (`stageBesideRoot`), disposed with it. Each link stores its target
// relative to the link's directory, the root.
const T7_7_INSIDE_TARGET = "config/linked.config.ts";
const T7_7_OUTSIDE_DIR = "outside";
const T7_7_OUTSIDE_TARGET = `${T7_7_OUTSIDE_DIR}/linked.config.ts`;

// The operation the arms' `rename --preview` and `rename` name: one
// succeeding on the unstaged twin, which asserts it (module header).
const T7_7_RENAME: readonly string[] = ["rename", "specs/A.mdx", "a", "a2"];
const T7_7_RENAME_PREVIEW: readonly string[] = [...T7_7_RENAME, "--preview"];

// The commands each arm drives from the root (TEST-SPEC T7-7): `build`,
// `check`, a read of each family 13.3 names — `ids` (the gated reads) and
// `occurrences` (the reads answering from the current sources, 11.2) —
// `inventory`, the preview, and the operation itself. The driver appends
// `--json`.
const T7_7_COMMANDS: readonly (readonly string[])[] = [
  ["build"],
  ["check"],
  ["ids"],
  ["occurrences"],
  ["inventory"],
  T7_7_RENAME_PREVIEW,
  T7_7_RENAME,
];

/** One T7-7 staging on the built workspace. */
interface T77Arm {
  /** What the arm stages, for every diagnosis. */
  readonly label: string;
  /**
   * Stage the arm on the built workspace. Returns the absolute directory
   * beyond the root holding the arm's link target — compared around each
   * run beside the root — or `undefined` when the arm stages nothing
   * outside the root.
   */
  readonly stage: (
    workspace: TestWorkspace,
    context: string,
  ) => Promise<string | undefined>;
}

/**
 * Arm (a)'s staging: the root's `xspec.config.ts` deleted and replaced by a
 * symbolic link storing `linkTarget`, which must resolve to the plain file
 * at `targetAbs`, already holding the configuration's bytes. Verified
 * before the sweep (H-9): the root entry a symbolic link storing
 * `linkTarget` and resolving to `targetAbs`, a plain file holding exactly
 * the configuration's bytes — an ineffective staging is a harness error,
 * never a pass or a diagnosed product failure.
 */
async function replaceConfigurationByLink(
  workspace: TestWorkspace,
  linkTarget: string,
  targetAbs: string,
  context: string,
): Promise<void> {
  await fsp.unlink(workspace.path(T7_7_CONFIG_PATH));
  await workspace.symlink(T7_7_CONFIG_PATH, linkTarget);
  const problems: string[] = [];
  const kind = await workspace.kind(T7_7_CONFIG_PATH);
  if (kind !== "symlink") {
    problems.push(`${T7_7_CONFIG_PATH} is ${kind}, no symbolic link`);
  } else {
    const stored = await workspace.linkTarget(T7_7_CONFIG_PATH);
    if (stored !== linkTarget) {
      problems.push(`the link stores ${JSON.stringify(stored)}`);
    }
    const resolved = await fsp.realpath(workspace.path(T7_7_CONFIG_PATH));
    if (resolved !== (await fsp.realpath(targetAbs))) {
      problems.push(`the link resolves to ${resolved}`);
    }
  }
  if (!(await fsp.lstat(targetAbs)).isFile()) {
    problems.push("the target is no plain file");
  } else if (
    !bytesEqual(await fsp.readFile(targetAbs), configText(T7_7_CONFIG))
  ) {
    problems.push("the target holds bytes other than the configuration's");
  }
  if (problems.length > 0) {
    throw new Error(
      `${context} — harness staging: expected ${T7_7_CONFIG_PATH} to be a ` +
        `symbolic link storing ${JSON.stringify(linkTarget)} and resolving ` +
        `to the plain file ${targetAbs}, which holds the configuration's ` +
        `bytes; ${problems.join("; ")} — the arm cannot run (H-9)`,
    );
  }
}

/** T7-7's arms, each on a freshly built workspace of its own (module header). */
const T7_7_ARMS: readonly T77Arm[] = [
  {
    label:
      `(a) ${T7_7_CONFIG_PATH} replaced by a symbolic link to ` +
      `${T7_7_INSIDE_TARGET}, inside the workspace at a path no group ` +
      `matches, holding its byte-identical content`,
    stage: async (workspace, context) => {
      await workspace.file(T7_7_INSIDE_TARGET, T7_7_CONFIG);
      await replaceConfigurationByLink(
        workspace,
        T7_7_INSIDE_TARGET,
        workspace.path(T7_7_INSIDE_TARGET),
        context,
      );
      return undefined;
    },
  },
  {
    label:
      `(a) ${T7_7_CONFIG_PATH} replaced by a symbolic link to ` +
      `../${T7_7_OUTSIDE_TARGET}, outside the workspace, holding its ` +
      `byte-identical content`,
    stage: async (workspace, context) => {
      await stageBesideRoot(workspace, {
        [T7_7_OUTSIDE_TARGET]: configText(T7_7_CONFIG),
      });
      await replaceConfigurationByLink(
        workspace,
        `../${T7_7_OUTSIDE_TARGET}`,
        path.join(workspace.tempRoot, T7_7_OUTSIDE_TARGET),
        context,
      );
      return path.join(workspace.tempRoot, T7_7_OUTSIDE_DIR);
    },
  },
  {
    label:
      `(b) ${T7_7_DOUBLY_MATCHED_PATH} created, a path both the spec group ` +
      `inner (src/**/*.mdx) and the code group app (src/**/*) match`,
    stage: async (workspace, context) => {
      // A staging premise over a tree the product has built: nothing
      // occupies the path, the globs overlapping on no path occupied at the
      // build — an occupant is a diagnosed failure.
      const kind = await workspace.kind(T7_7_DOUBLY_MATCHED_PATH);
      if (kind !== "absent") {
        fail(
          `${context}: staging premise — nothing occupies ` +
            `${T7_7_DOUBLY_MATCHED_PATH} after the build, the spec and code ` +
            `globs overlapping on no path occupied at it (TEST-SPEC ` +
            `T7-7(b)); found ${kind}`,
        );
      }
      await workspace.file(
        T7_7_DOUBLY_MATCHED_PATH,
        T7_7_DOUBLY_MATCHED_SOURCE,
      );
      return undefined;
    },
  },
];

/**
 * T7-7's unstaged twin (module header): the arms' workspace, built alike and
 * staged with nothing — `check --json` reports the finding-free report
 * (graph data current), and the `rename --preview` and the `rename` the
 * arms drive each exit 0: the operation is one succeeding on the unstaged
 * twin, so an arm's exit 2 is its staging's alone.
 */
async function runT77UnstagedTwin(product: ProductBinding): Promise<void> {
  await withWorkspace(T7_7_WORKSPACE, async (workspace) => {
    const context = "T7-7 unstaged twin (the arms' workspace, nothing staged)";
    await buildOk(
      product,
      workspace,
      `${context}: \`build\` — the workspace is valid (SPEC 7, 12.1)`,
    );
    await expectFindingFreeReport(
      product,
      workspace,
      ["check", "--json"],
      `${context}: \`check --json\` after the \`build\` — no finding, so ` +
        `graph data is current (SPEC 12.2, 13.3)`,
    );
    for (const argv of [T7_7_RENAME_PREVIEW, T7_7_RENAME]) {
      await expectExit(
        product,
        workspace,
        [...argv, "--json"],
        0,
        `${context}: \`${argv.join(" ")} --json\` — the operation the arms ` +
          `drive succeeds on the unstaged twin (TEST-SPEC T7-7; SPEC 6.4, ` +
          `6.6), so each arm's exit 2 is its staging's alone`,
      );
    }
  });
}

/**
 * One T7-7 arm (module header): a fresh workspace built (exit 0, graph data
 * left current), the arm staged, and each command of `T7_7_COMMANDS` run
 * from the root under `--json`, held to the 14.14 contract with the error
 * document's one finding exactly `code` `configuration-error`, `path`
 * `xspec.config.ts`, `locations` []; nothing modified around each run — the
 * whole root compared, H-6's classification applied, and the directory
 * holding an outside link target beside it — and `.xspec/lock` absent once
 * each has ended; `version --json` exit 0 last.
 */
async function runT77Arm(product: ProductBinding, arm: T77Arm): Promise<void> {
  await withWorkspace(T7_7_WORKSPACE, async (workspace) => {
    const context = `T7-7 ${arm.label}`;
    await buildOk(
      product,
      workspace,
      `${context}: the \`build\` the arm is staged after — the workspace ` +
        `valid, its graph data left current (TEST-SPEC T7-7)`,
    );
    const outsideDir = await arm.stage(workspace, context);
    for (const argv of T7_7_COMMANDS) {
      const label = `${context}: \`${argv.join(" ")} --json\` run from the workspace root`;
      const before = await snapshotDirectory(workspace.root);
      const outsideBefore =
        outsideDir === undefined
          ? undefined
          : await snapshotDirectory(outsideDir);
      const result = await expectConfigurationError(
        product,
        workspace,
        argv,
        `${label} — 7 and 14.14 bind every command that loads the ` +
          `configuration in every workspace state, a built one whose graph ` +
          `data is current included: the configuration path's occupant and ` +
          `the sources discovered are judged as they stand at the ` +
          `invocation (SPEC 7, 7.2, 14.14, 12.0)`,
      );
      const finding = expectErrorDocument(result, label);
      assertSameJson(
        {
          code: finding.code,
          path: finding.path,
          locations: finding.locations.map((location) => location.file),
        },
        {
          code: "configuration-error",
          path: T7_7_CONFIG_PATH,
          locations: [],
        },
        `${label}: the error document's one finding carries the stable code ` +
          `"configuration-error", locations [] (an unlocated condition), ` +
          `and as its concerned path the path the upward search found, ` +
          `whatever occupies it, in the anchoring form of 11.6 relative to ` +
          `the invocation working directory — exactly "xspec.config.ts" ` +
          `(SPEC 14, 12.7, 7; T12.7-3)`,
      );
      assertSnapshotsEqual(
        before,
        await snapshotDirectory(workspace.root),
        `${label}: nothing is modified (SPEC 12.0, 12.1, 13.3; H-6) — no ` +
          `source, derived file, or graph data changes, and the ` +
          `configuration's entry, what it stores, and every target under ` +
          `the root stay byte-identical`,
      );
      if (outsideDir !== undefined && outsideBefore !== undefined) {
        assertSnapshotsEqual(
          outsideBefore,
          await snapshotDirectory(outsideDir),
          `${label}: the link's target outside the workspace stays ` +
            `byte-identical (TEST-SPEC T7-7)`,
        );
      }
      await assertLockPathAbsent(
        workspace.root,
        `${label}: once it has ended (SPEC 12.0: the configuration error ` +
          `precedes acquisition; 13.5)`,
      );
    }
    const versionLabel = `${context}: \`version --json\` run from the workspace root`;
    const versionRun = await runProduct(product, {
      cwd: workspace.root,
      argv: ["version", "--json"],
    });
    assertExitCode(
      versionRun,
      0,
      `${versionLabel} — version consults no configuration, so the staged ` +
        `configuration error is never met: exit 0 with its answer (SPEC ` +
        `12.6, 14.14)`,
    );
    decodeVersionDocument(
      parseJsonStdout(versionRun, versionLabel),
      versionLabel,
    );
  });
}

const T7_7 = defineProductTest({
  id: "T7-7",
  title:
    "validation on a built workspace: 7 and 14.14 bind every command that " +
    "loads the configuration on a workspace whose graph data is current — " +
    "(a) the root's xspec.config.ts replaced after a `build` by a symbolic " +
    "link to a file holding its byte-identical content, the target inside " +
    "the workspace at a path no group matches and separately outside it; " +
    "(b) src/x.mdx created after a `build` at a path both a spec group " +
    "(src/**/*.mdx) and a code group (src/**/*) match, the globs " +
    "overlapping on no path occupied at the build — in each, `build`, " +
    "`check`, `ids`, `occurrences`, `inventory`, `rename --preview`, and " +
    "`rename` of an operation succeeding on the unstaged twin each exit 2 " +
    "with the error document, code configuration-error, path " +
    "xspec.config.ts, nothing modified, `.xspec/lock` absent afterwards, " +
    "the link and its target byte-identical; `version` exits 0 (SPEC 7, " +
    "7.2, 12.6, 12.7, 14.14)",
  run: async (product) => {
    // The premise first: the operation the arms drive succeeds on the
    // unstaged twin, whose built graph data is current.
    await runT77UnstagedTwin(product);
    for (const arm of T7_7_ARMS) {
      await runT77Arm(product, arm);
    }
  },
});

/**
 * TEST-SPEC §7 basics T7-1…T7-3 and T7-7, in canonical ID order
 * (SUITE-26).
 */
export const section7BasicsTests: readonly ProductTestEntry[] = [
  T7_1,
  T7_2,
  T7_3,
  T7_7,
];
