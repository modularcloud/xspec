# SPEC problems

## 2026-10-15 — SPEC 10.5: which `changed` nodes besides the visited node N a path-blocks item takes in is undecided (Phase 6 TEST-SPEC review, refinement 10, items C1(c) and I1)

**Where.** 10.5's path-blocks generators. Review item C1(c) asks TEST-SPEC.md to assert origin sets. Item I1 asks for an oracle property over review generation (10.4–10.7), as P-6 and P-13 have for impact and coverage. Both need 10.5 to fix three set memberships it leaves open. Each open point has two readings, and the two give different output on common edits. TEST-SPEC.md cannot pin either one without adding a requirement.

**(a) Skipped nodes beneath a `parent-consistency` item's branches.** Item 2 gives the item for a non-root ancestor A the origin "the changed branches' `changed` nodes". It does not say which nodes those are:

- only the visited node N that each branch leads to, or
- every `changed` node in the branch, including N's own `changed` descendants that the skipping rule passes over.

Item 1 decides the same question for `subtree-coherence`: its origin is "the `changed` nodes in scope", skipped nodes included. Item 2's own clauses read a branch both ways. "each entering as one context node, A's child on that branch" and the `blockedBy` clause's "when the child is the branch's changed node" (singular) read a branch as the path from A down to one N. "the union of changed branches" fits A's child subtrees equally.

The case it decides is common: adding a child C to a section B nested under a non-root section A. B and C are both `changed` (5.6: the parent's own content changes with its new child), so B is visited and C is skipped. A's item has origin `{B}` on the path reading and `{B, C}` on the subtree reading. Every origin node contributes a before/after pair of own text to the item's payload (10.7), so `show`, `next --json`, and `export` differ between the readings.

**(b) Descendants deleted since the baseline, in a visited N's scope and origin.** Item 1's scope is "N and all descendants", and its origin is "the `changed` nodes in scope". For an N present in the current graph, 10.5 does not say which descendants count:

- the ones N has now, or
- also the ones it had at the baseline and has since lost to deletion. Each of those is `changed` and skipped, because the deletion changed its parent's own content.

The case it decides is common: deleting a child section D from a section P whose ancestors are unchanged. P is visited. Its item's scope and origin either include D, absent and carrying its baseline text (10.7), or they do not. If they do not, the deleted text appears in no item of the session, because P's own text excises its children (1.6). A deleted root, the one deleted node a generator visits, can only have baseline descendants, so its scope must reach back to the baseline or a deleted file's sections enter no item. 10.5 does not say whether the same reach applies to a present N. The answer also decides how (a)'s subtree reading treats deleted nodes.

**(c) Minor, same pass: whose changes a `dependency-consistency` or `code-impact` origin collects.** Both origins are "the originating nodes (5.6) of the targets' changes". Take a target whose effectiveHash or subtreeHash changed for one reason, such as an upstream or descendant edit. It is also `metadata-changed` by a `coverage` or `tags` edit that changes neither hash (5.6). 10.5 does not say which changes count:

- every category the target carries, which puts the target itself in the origin, or
- only the hash change that qualifies the target, which does not.

This is rarer than (a) and (b), but an oracle generator that draws tag edits meets it.

**What TEST-SPEC.md does meanwhile.** Its origin arms are staged so that every reading agrees:

- T10.5-1's skipped node lies beneath a top-level N, so no `parent-consistency` item spans it.
- No arm of T10.5-1, T10.5-7, or T10.5-8 deletes a node or edits a target's `coverage` or `tags`.

The property I1 asks for is deferred until 10.5 settles (a) to (c), because its oracle must decide all three on a large share of its draws.
