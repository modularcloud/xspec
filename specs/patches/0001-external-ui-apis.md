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
2. **Nested structure inline with the MDX** — per-document structural data tied to exact byte positions in the source text. Partially present (per-node source ranges); gap: no single document view, and no positions for the constructs inside a node's text (imports, embeddings, dependency references).
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
- Constructs that record no edge produce no occurrence (unused import bindings, type-only bindings, shadowed identifiers, dynamic references — which are validation errors anyway).
- Occurrence data is unavailable for a file masked as unparseable, consistent with existing masking behavior.
- Ordering is deterministic: by file path (byte order), then by range start, then by range end, with a stated tiebreak for identical ranges.

### 2. Source ranges for code

Amend the source-range concept (currently: "code locations carry no source range"):

- Every code location gains a source range: for a named code unit, the construct's own characters (analogous to a section's construct range); for a whole-file location, the entire file (analogous to a root node). Document-order-disambiguated units (`path#unit@N`) each carry their own occurrence's range.
- Everywhere the specification outputs a graph node with a source range, a code location now qualifies — in particular in occurrence enumeration (change 1), `query` results that return code locations, and review payloads that present code-location scopes.
- TypeScript reference occurrences (markers, `text(...)` calls) carry the range of the referencing expression itself, distinct from the enclosing unit's range.

### 3. Whole-document structural view

A query surface returns, for one spec source file, everything needed to overlay structure on the raw MDX bytes in a single call:

- the root node and the full section tree in document order — each node with identity, source range, tags, coverage attribute, and (on request) own and subtree text;
- every spec-module import declaration with its source range, binding name, and resolved target file;
- every reference occurrence in the file (change 1), positioned in document order;
- enough per-construct positional data that an external tool can resolve any byte position in the file to the innermost enclosing section and, when the position lies within a reference occurrence, to that occurrence and its target — without re-parsing the MDX. Whether position resolution is additionally offered as its own query (file + offset in, node/occurrence out) is a refinement decision; the resolution outcome itself is required.

The view is defined for a discovered, parseable spec source; unknown files are usage errors and unparseable files report their validation errors, consistent with existing conventions.

### 4. Workspace inventory

A query surface reports the machine-readable shape of the workspace, so an external editor never edits files xspec owns and never misses files xspec reads:

- the workspace root and the configuration file's path (workspace-relative, per existing path conventions);
- the resolved configuration view: spec and code groups with their glob lists and kinds, Markdown emission state and destinations, coverage profile names and definitions, policy rule names;
- every discovered source file with its group memberships;
- the derived-file map: per source file, the generated module and companion paths and the Markdown emit destination (when enabled), plus any other recorded derived paths;
- the durable files: the journal path and existing review-session files.

The inventory contains no environment-dependent content and no absolute paths, consistent with existing determinism and security conventions.

### 5. Structured diagnostics

Sharpen the validation-error contract so an external tool can render findings inline:

- Every reported error condition carries a stable machine-readable code identifying which numbered condition of the validation-errors section it is.
- Every error that locates inside a source file carries the file and a source range (byte offsets) for the offending construct, at the precision the condition allows; conditions without an in-source location (configuration errors, path-level conditions, journal and session conditions) carry the file or path they concern.
- The JSON report form presents these fields for every finding, preserving the existing requirements that all conditions are reported together and that JSON carries the same information as the human report.

### 6. Refactoring previews

`rename` and `move` gain a preview mode that performs the full validation and planning of the real operation and reports, without modifying anything:

- the complete identity mapping the operation would journal;
- every file the operation would rewrite, with the occurrences (ranges in current, pre-operation coordinates) it would rewrite in each, including import additions and removals in the move case and, in the file-move case, the file relocation itself;
- the derived files that would be regenerated as a consequence.

A preview succeeds exactly when the real operation would proceed and is refused exactly when — and reporting what — the real operation would refuse, with the same exit-code classification. A preview writes nothing (no sources, no journal, no derived files, no graph data) and is therefore a non-mutating command under the concurrency rules, safe to run while readers run. Preview output is byte-deterministic.

### 7. Machine-interface identification

- A surface reports the product's version and a machine-interface version in JSON, so an external tool can detect compatibility before relying on output shapes. Output remains deterministic for a given product build.
- The specification states that the JSON document shapes of the machine-facing surfaces are part of the product's contract: shape changes are product behavior changes, not free implementation detail.

## Existing surfaces relied on, unchanged

Dependency visualization and change overlays already rest on: `query node`/`nodes`/`edges`/`subtree`/`ancestors`/`reachable`; `ids --tree`; `show`; the four hashes; `impact --json` (change categories, impacted code, witness paths); `coverage --json`; `review … --json` self-contained payloads; universal `--json` and exit-code conventions; write atomicity, mutating-command exclusivity, and read-time graph refresh. This proposal adds to that surface; it removes or alters none of it beyond the amendments stated above.

## Compatibility and rigor notes

- All additions obey the existing global conventions: single-JSON-document output, same-information JSON, byte-determinism, byte-wise ordering and comparison, workspace-relative paths, the exit-code partition, and configuration-error precedence.
- New surfaces are reads (or, for previews, validated no-op plans); none introduces new durable state, none writes through any new path, and none weakens the security posture of test seams — exposed data is workspace-local content only.
- Range data added for code and occurrences follows the existing byte-offset range convention so consumers handle one range model everywhere.
