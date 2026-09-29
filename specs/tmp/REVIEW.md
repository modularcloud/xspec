# Review — `specs/SPEC.md` — Phase 4 revisit for SPEC-PROBLEMS (unspellable file-form specifiers), round 4; the logged problem stays resolved (7.1, 14.19, 6.5 `refused-invalid-destination`; both grammars also accept U+2028/U+2029 in a string literal, so the barred set is sufficient)

## Critical

- [C1] **Markdown emitted under the graph-data area can collide with graph data, and no rule decides the outcome (7.3, 13.3, 13.4, 14.22, 14.24, 14.25, 6.5: contradiction, ambiguous behavior).**
  - 7.3 admits `outDir: ".xspec"` or `.xspec/…` (any non-empty segments other than `.` and `..`), and 11.6 relies on this: "a recorded derived path lying under the area is derived". Graph data lives under `.xspec/` at paths the implementation chooses and deliberately does not enumerate (13.3).
  - Round 3 made regeneration order-independent through three collision rules. All three cover module, companion, Markdown and source paths, and never graph data's:
    - 13.4's exception for "a module, companion, or Markdown path that is a directory component of a discovered source's path or of another such path";
    - 14.22's matching relation;
    - 6.5's destination vetting "against … every other derived path", meaning the paths of 13.1, 13.2 and 7.3.
  - No graph-data layout can avoid this: `outDir` segments and spec-source directory names can spell any name, so every graph-data path can be reached.
  - Example: graph data is kept in a file `.xspec/G`; `markdown: { emit: true, outDir: ".xspec" }`; a spec source `G/a.mdx` emits to `.xspec/G/a.md`, which needs `.xspec/G` to be a directory.
    - **First build.** `.xspec/G` does not exist yet, so the pre-write 14.22 judgement finds nothing, and the outcome depends on write order:
      - Markdown first: the graph-data write "replaces whatever exists at its path" (13.4). That is the directory, together with the Markdown just written into it.
      - Graph data first: the Markdown write meets a plain file where it needs a directory. 14.24 says that case "is 14.22 … never this condition", but 14.22 is judged only before any write.
    - **Later runs.** `build`, `check` and the 13.3 gate report 14.22 against xspec's own graph data. A refreshing read, which writes graph data only, replaces the directory that holds emitted Markdown.
  - Two stated guarantees therefore fail:
    - 13.4: "A completed regeneration's outcome is therefore independent of the order of its writes and removals".
    - 6.5: the finishing regeneration "cannot fail for any validation reason … whatever the order of its writes". A move whose destination emits under the area can hit the same collision, because the destination vetting looks only at the 13.1, 13.2 and 7.3 paths.
  - Separately, 14.25 assigns a refused read of Markdown under the area to two conditions:
    - condition 10: "a derived file's content or kind that `check` compares … the path stale";
    - condition 23: "anything under the area other than those durable paths and the session directory".
  - Needed: a contract decision. The simplest option makes an `outDir` equal to `.xspec`, or beginning with `.xspec/`, a configuration error (7.3, 14.14) and drops 11.6's sentence on derived paths under the area; this also ends the 14.25 overlap. The alternative keeps emission under the area and defines both the graph-data collision outcome and the 14.25 assignment.

- [C2] **An orphaned derived file can block the rebuild that 13.4 says resolves it (13.4 vs 14.22, with 12.1 and 13.3): contradiction.**
  - 13.4 says "a conflicted, corrupted, deleted, or orphaned derived file is correctly resolved by rebuilding (12.1)". Its only exception is an orphan the record never knew. 12.1 says rebuilding "removes recorded derived files that the current sources and configuration no longer generate".
  - 14.22, however, judges `build`'s write paths before any write, and those paths are the generated files and graph data only. So a directory component occupied by a non-directory refuses the build even when that occupant is a recorded orphan the same build would remove. A refused build "modifies nothing" (12.1), and the orphan stays.
  - Example A: default placement recorded `specs/A.md`. The configuration then sets `outDir: "specs/A.md"`, so `specs/A.mdx` now emits to `specs/A.md/specs/A.md`.
  - Example B: with `outDir: "out"`, deleting `specs/A.mdx` leaves the orphan `out/specs/A.md`. A new source `specs/A.md/B.mdx` then emits to `out/specs/A.md/B.md`.
  - In both examples, `build`, `check` and every gated read (13.3) report 14.22 until the orphan is deleted by hand.
  - Needed: one of two options.
    - Stop counting an occupant as an obstruction when it is a recorded derived file this regeneration removes. The removal then comes before the write that needs the directory, and 13.4's order-independence sentence and the 13.3 gate must be adjusted to match.
    - Or state this case as an exception to 13.4's claim that needs manual deletion, as the record-less orphan already does.

## Important

*none*

## Optional

- [O1] **14.10's recorded-file form:** it "compares the record against the set of generated paths and the discovered sources alone". The same entry reports only "an occupant `build` would remove (13.4), so neither a directory nor a discovered source", so the form also reads each recorded path's occupant: whether one exists, its kind, and whether a non-directory component lies above it. The word "alone" suggests nothing beyond the two sets is consulted. Suggested wording: "…the discovered sources, and the recorded paths' occupants — no generated content —".
- [O2] **13.4's removal rationale:** "the removal making no write: xspec writes only plain files". The same section has writes create directories ("A write brings the nonexistent workspace-relative directory components of its path into existence as directories"). The point intended is that no derived file is a directory. Suggested wording: "every derived file is a plain file".
