# 0001 — Foundational machine surfaces for an external spec UI

- **Type:** Improvement Proposal (IP)
- **Stage:** Proposed
- **Branch:** `claude/xspec-ui-apis-4df8fa` (harness-designated for this session; stands in for `patch/external-ui-apis`)

## Motivation

Developer plans an interactive UI on top of xspec: editing spec documents, visualizing requirement dependencies, seeing the nested requirement structure inline with the MDX text, and jumping between references. The UI itself lives outside the xspec product boundary — xspec stays headless — but xspec must expose the machine-consumable surfaces such an external interface needs to connect to it safely.

xspec's existing machine surface (`query`, universal `--json`, byte-deterministic output, requirement source ranges) covers set-level graph access well. It does not cover what an interactive editor additionally needs: exact source positions for every reference occurrence and for code, a single structural view of a document that maps onto its raw text, machine-readable knowledge of which files xspec owns, diagnostics precise enough to render inline, previews of identity-changing operations, and a way for an external tool to detect interface compatibility. This proposal adds those foundations.

Archival — Developer message (2026-07-31), verbatim:

> I want to create a UI for xspec. The idea is that you can edit specs and visualize their dependencies, see the nested structure inline with the MDX and jump between references etc. This won't necessarily be a part of the xspec spec itself but xspec needs to have the foundational apis to connect to this interface. what changes do you recommend to put in a patch in order to work toward this goal?

## Scope

The UI's needs map to product capabilities as follows:

1. **Dependency visualization** — complete graph data. Largely present (`query nodes`, `query edges`, hashes, impact categories); gap: code-location endpoints are not locatable in their files.
2. **Nested structure inline with the MDX** — per-document structural data tied to exact byte positions in the source text. Partially present (per-node source ranges); gap: no single document view, no positions for the constructs inside a node's text (imports, embeddings, dependency references, comments), and no decomposition of a section's range into its tags.
3. **Jumping between references** — per-occurrence positions for every reference, in spec sources and TypeScript sources, navigable in both directions (occurrence → target, node → incoming occurrences). Absent: edges collapse to sets with no occurrence positions, and code locations carry no source range.
4. **Safe external editing** — the UI edits source text; xspec supplies the safety net: machine-readable validation with precise positions, previews of `rename`/`move`, and a machine-readable inventory of which files are sources, derived, or durable. Partially present.

## Non-goals

Confirmed with Developer at triage:

- **No UI ships with xspec.** xspec remains headless; the complete interface remains the CLI, configuration, source syntax, generated modules, and workspace files (per GOALS).
- **No long-running service, watch, or push surface.** The connection point is the one-shot CLI: outputs are deterministic and reads are safe to run concurrently, so the UI re-invokes and re-queries as needed. A live surface, if the UI turns out to need one, is a separate future proposal (it would also touch the GOALS interface statement).
- **No structured content-mutation commands.** The UI owns text editing. xspec's only source-rewriting operations remain `rename` and `move` (extended here with previews); commands like "add dependency" or "set tags" are not added.
- **No analysis of unsaved editor content.** xspec reads the workspace as saved on disk; the UI validates on save.

## Proposed `SPEC.md` changes

The following describes the behaviors `SPEC.md` is to define, at the rigor `SPEC.md` requires (implementation-agnostic, blackbox-testable, deterministic, edge cases handled). Exact command and flag names, JSON field naming, and section placement are settled during spec refinement; the information contracts below are the requirement.

### 1. Reference occurrences

Introduce the concept of a **reference occurrence**: one textual spelling that records a dependency-kind edge — a `d` reference (each entry of a `d` array separately), an MDX `{text(...)}` embedding, a TypeScript `text(...)` call, or a TypeScript dependency marker. Each occurrence carries: the referencing file, its source range (byte offsets, per the existing range convention), its edge kind, its source graph node (requirement node or code location), and its resolved target's identity.

- Edges remain sets; occurrences are the positions behind them. Duplicate references that collapse to a single edge each remain distinct occurrences.
- A query surface enumerates occurrences, filterable at least by source file and by target node, so "find all references to this requirement, with positions" and "list every reference this file makes" are single calls. Incoming enumeration must accept any graph-node identity a reference can target (root nodes included).
- Constructs that record no edge produce no occurrence (unused import bindings, type-only bindings, shadowed identifiers, and reference spellings that are dynamic or do not resolve — the invalid ones are located by diagnostics instead, change 6).
- Availability follows change 4: occurrence positions and spellings are per-file, parse-local data — only a masked (unparseable) file loses them — while occurrence existence is resolution-dependent: a spelling that does not resolve to exactly one target records no edge and no occurrence. An occurrence inside a section whose identity change 4 leaves undefined keeps its position, kind, and resolved target, with its source-node identity explicitly unavailable.
- Ordering is deterministic: by file path (byte order), then by range start, then by range end. Distinct occurrences are distinct spellings occupying distinct spans, so identical ranges do not occur and this order is total; no further tiebreak exists.

### 2. Source ranges for code

Amend the source-range concept (currently: "code locations carry no source range"):

- Every code location gains a source range: for a named code unit, the construct's own characters (analogous to a section's construct range); for a whole-file location, the entire file (analogous to a root node). Document-order-disambiguated units (`path#unit@N`) each carry their own occurrence's range. Where one declaration derives several named units, each unit's range is the construct that binds its own name: a function- or class-valued variable declaration's range spans its own name through its initializer, not the enclosing multi-declaration statement, while the nested units a dotted namespace name derives share the single namespace declaration's range, which is the one construct binding them all.
- Everywhere the specification outputs a graph node with a source range, a code location now qualifies — in particular in occurrence enumeration (change 1), `query` results that return code locations, and review payloads that present code-location scopes.
- TypeScript reference occurrences (markers, `text(...)` calls) carry the range of the referencing expression itself, distinct from the enclosing unit's range.

### 3. Whole-document structural view

A query surface returns, for a spec source file, everything needed to overlay structure on the raw MDX bytes in a single call:

- the root node and the full section tree in document order. The tree is positional — defined by construct nesting alone — so it exists for every parseable file whatever findings the file carries (change 4). Each node carries its source range, its raw attribute spellings as parsed, and — each where defined, explicitly unavailable otherwise (change 4) — its node identity, tags, coverage attribute, and (on request) own and subtree text;
- for each non-root node, the decomposition of its construct range: the opening tag's range and the closing tag's range (a self-closing section has an opening-tag range only; a root node spans the whole file and has neither). An interactive consumer needs the tags separately from the content they enclose — to render a section header in place of its opening tag, hide or fold what a tag pair encloses, and land navigation on a section's tag rather than selecting its entire construct;
- every import declaration, valid or invalid, with its source range, its binding name where one is bound, and its resolved target file where specifier form and discovery define one — explicitly unavailable otherwise (change 4), with the invalidity itself a located finding of change 6;
- every reference occurrence in the file (change 1), positioned in document order;
- every MDX comment's source range. With tags, imports, comments, and embedding occurrences located, every construct that Markdown compilation removes is positioned, so on a finding-free file a consumer can classify each byte as annotation or content without re-parsing the MDX. On an imperfect file the classification is joint with change 6: spellings and constructs that produce no occurrence or view entry (change 4) are located by their findings' ranges, and the two surfaces together still position every removable construct;
- position resolution as a direct query: given the file and a byte offset, the innermost enclosing section and, when the offset lies within a reference occurrence, that occurrence and its resolved target. Resolution is by range containment and is total over the file: every within-file offset lies in the root's range, so bytes inside imports, comments, and content between sections resolve to the innermost section construct containing them — the root when none does; the offset equal to the file length (the caret position at end of file) resolves to the root; a greater offset is a usage error, per existing conventions. The same resolution must also be derivable from the view's data alone, so both index-building consumers and lightweight ones that keep no client-side index are served.

The view is defined for discovered spec sources: one file, a set restricted by the existing file-glob convention, or all of them — a multi-file request returns per-file views in one deterministic JSON document, so a consumer can index an entire workspace in a single invocation. A file named outside the discovered set is a usage error, per existing conventions.

### 4. Availability on imperfect workspaces

The structural surfaces of changes 1 and 3 exist to serve an editor while a person is mid-edit — when transiently invalid states (an unknown reference target, a failing file elsewhere in the workspace) are the norm, and exactly when the existing read commands refuse to answer. Their availability is therefore defined per file, from parsing alone, not gated on workspace-wide validity:

- Structure derived from one file's parse — the positional section tree (change 3), every construct's ranges and their decompositions, raw attribute and import spellings, comments, and reference-occurrence positions — remains available while other files are invalid and while the file itself carries findings of either level: resolution-level (unresolved references, cycle participation, and similar) and per-file structural (sections with missing, duplicate, or structurally invalid IDs; malformed segments; invalid props; invalid constructs) alike.
- Only an unparseable file (or content the existing masking rules already hide) loses its structural view; masking is per file, and the surfaces still answer for every other requested file.
- What findings make undefined is interpreted data, never structure. A section's node identity is defined exactly when its own `id` and each enclosing section's `id` are present and well-formed, each satisfies the structural-ID rules, and no other section of the file spells the same identity — duplicate spellings leave every bearer's identity undefined; no winner is picked. A section's interpreted tags and coverage attribute are defined exactly when its parsed props define them unambiguously (a repeated, malformed, or invalid-valued prop leaves the interpreted value undefined; the raw spelling is still reported). A section whose identity is undefined still occupies its tree position with its ranges and raw spellings, and the occurrences inside it keep their positions, kinds, and resolved targets, with their source-node identity undefined. Invalid constructs outside change 3's inventory (stray elements, expression containers, exports) get no view entry; their findings' ranges locate them (change 6).
- Data these rules or workspace-level resolution leave undefined — section and occurrence-source identities as above, an import's resolved target when specifier form or discovery defines none, expanded own and subtree text, hashes — is reported as explicitly unavailable wherever an answer would otherwise carry it: deterministically, never silently omitted, never fabricated from partial resolution.
- A reference occurrence, by contrast, never reports an unavailable target: a spelling that does not resolve to exactly one target — an unknown target, or an ambiguous one whose candidates' own identities are undefined — records no edge and therefore no occurrence, and its position reaches consumers through the diagnostics of change 6, which carry ranges. The two surfaces jointly locate every reference spelling, valid or invalid.
- Findings present in the answered files are reported alongside the answer, and the mapping onto the existing exit-code partition is: an invocation whose answer reports any finding or any explicitly-unavailable datum exits 1; a complete, finding-free answer exits 0; usage and configuration errors keep exit 2 and their existing precedence. The full answer document is emitted in the 0 and 1 cases alike — exit 1 signals imperfection and never withholds the answer.

Existing commands keep their current all-or-nothing read semantics; this availability contract governs the surfaces this proposal adds. Their relationship to stored graph data follows the same line: the query surfaces of changes 1 and 3 never answer from stale data — on a workspace that passes build validation they participate in read-time refresh through the existing path, exactly as the existing read commands do, and on a workspace that does not, their answers reflect the current sources and they modify nothing: no graph data, no derived files — just as a failed refresh modifies nothing today. The inventory of change 5 states its own relationship to stored state.

### 5. Workspace inventory

A query surface reports the machine-readable shape of the workspace, so an external editor never edits files xspec owns and never misses files xspec reads:

- how the resolved workspace root anchors to the invocation: the workspace root and the configuration file are identified relative to the invocation working directory — invocation input, exactly as existing conventions already treat `--config` resolution — and never as absolute paths. Configuration discovery thereby has one authority: a tool invoking xspec from an arbitrary directory can map the workspace-relative paths in every output to real files without re-implementing the upward search, which is an editing-safety requirement — a consumer that guesses the root wrong edits the wrong files;
- the resolved configuration view: spec and code groups with their glob lists and kinds, Markdown emission state and destinations, and coverage profiles and policy rules, each name with its full definition — the two reported at the same depth;
- every discovered source file with its group memberships;
- the derived-file map: per source file, the generated module and companion paths and the Markdown emit destination (when enabled), plus any other recorded derived paths;
- the durable files: the journal path and existing review-session files.

The inventory contains no absolute paths and no environment-dependent content beyond the invocation anchoring above (a function of the invocation, like `--config` resolution — not of the machine), consistent with existing determinism and security conventions. When the platform admits no relative path between the working directory and the workspace root (roots on different Windows drives), the anchoring is reported in the platform's absolute form — the one further case of the stated exception, still a pure function of invocation input.

Availability is unconditional: no part of the inventory requires parsing sources, so it answers whatever the sources' validity; configuration errors keep their existing precedence. Its content has three provenances, each reported as what it is: invocation, configuration, and discovery determine the anchoring, the configuration view, the discovered sources with their groups, and the per-source generated-module and Markdown-emit-destination paths (the destinations exist exactly while emission is enabled, per existing rules); recorded generation state supplies the remaining derived-file map entries — companion paths and any other recorded derived paths — reported as recorded, which can lag configuration until a rebuild and is empty before any generation has run; the filesystem supplies the durable entries — the journal path is fixed, and the review-session files are those present. The inventory reports recorded and durable state as it stands and never refreshes or writes anything.

### 6. Structured diagnostics

Sharpen the validation-error contract so an external tool can render findings inline:

- Every reported error condition carries a stable machine-readable code identifying which numbered condition of the validation-errors section it is.
- Every error that locates inside a source file carries the file and a source range (byte offsets) for the offending construct, at the precision the condition allows; conditions without an in-source location (configuration errors, path-level conditions, journal and session conditions) carry the file or path they concern.
- The JSON report form presents these fields for every finding, preserving the existing requirements that all conditions are reported together and that JSON carries the same information as the human report.
- Diagnostics are the locating surface for constructs that record nothing in the graph: an invalid, dynamic, or unresolved reference spelling has no occurrence (changes 1, 4), so its range reaches consumers here.

### 7. Refactoring previews

`rename` and `move` gain a preview mode that performs the full validation and planning of the real operation and reports, without modifying anything:

- the complete identity mapping the operation would journal;
- every file the operation would rewrite or relocate, with every edit the operation would make in it — each located by a range in current, pre-operation coordinates and classed by what it is. The classes cover everything the operations edit, not only reference occurrences: reference-occurrence rewrites (change 1's occurrences — `d` references, `text(...)` references, TypeScript markers); `id`-attribute rewrites (rename's and the section move's re-identification); import edits — specifier rewrites, import additions, and import removals; the section move's origin deletion, its target insertion point, and the self-closing-target-parent rewrite when one applies; and the file move's relocation of the file itself;
- the derived-file consequences, in both directions: the derived files that would be regenerated and the recorded derived files that would be removed as no longer generated — the old module path after a file move included.

A preview succeeds exactly when the real operation would proceed and is refused exactly when — and reporting what — the real operation would refuse, with the same exit-code classification. A preview writes nothing (no sources, no journal, no derived files, no graph data) and is therefore a non-mutating command under the concurrency rules, safe to run while readers run. Preview output is byte-deterministic.

### 8. Machine-interface identification

- A surface reports the product's version and a machine-interface version in JSON. Output remains deterministic for a given product build: both values are fixed per build, and the product version identifies the build.
- The machine-interface version's current value is stated in `SPEC.md` itself, and the surface reports exactly the stated value — observable against the specification in any single build, with no cross-build comparison needed.
- The stated value names the machine-facing JSON contract `SPEC.md` defines: the JSON output of the product's commands under the existing universal-JSON and same-information conventions, the surfaces this proposal adds included. Because those contracts and the version value live in the same document, a change to the machine-facing JSON contract is by construction a specification change, and the proposal making it updates the stated value in the same change. An external tool detects incompatibility by comparing the reported value with the value its own interface knowledge was built against.

## Existing surfaces relied on, unchanged

Dependency visualization and change overlays already rest on: `query node`/`nodes`/`edges`/`subtree`/`ancestors`/`reachable`; `ids --tree`; `show`; the four hashes; `impact --json` (change categories, impacted code, witness paths); `coverage --json`; `review … --json` self-contained payloads; universal `--json` and exit-code conventions; write atomicity, mutating-command exclusivity, and read-time graph refresh. This proposal adds to that surface; it removes or alters none of it beyond the amendments stated above.

## Compatibility and rigor notes

- All additions obey the existing global conventions: single-JSON-document output, same-information JSON, byte-determinism, byte-wise ordering and comparison, workspace-relative paths (change 5's invocation anchoring is the one stated exception, itself deterministic per invocation), the exit-code partition, and configuration-error precedence.
- The availability contract (change 4) is a deliberate, surface-scoped delta from the all-or-nothing read refusal of the existing commands, which keep their semantics unchanged; its refinement must stay deterministic and free of partial-resolution fabrication.
- New surfaces are reads (or, for previews, validated no-op plans); none introduces new durable state, none writes through any new path, and none weakens the security posture of test seams — exposed data is workspace-local content only.
- Range data added for code, occurrences, tag decompositions, and comments follows the existing byte-offset range convention so consumers handle one range model everywhere.
