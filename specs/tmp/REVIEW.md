# Review — specs/TEST-SPEC.md — re-align with SPEC.md 6b79462..7f9ac70 (13.5's lock directory in the workspace, 14.26 `workspace-busy`, rediscovery under exclusivity, the transient file class)

## Critical

- [C1] **14.26 `workspace-busy` is untested, and busy refusals assert only the exit class** (§13.5 T13.5-2, T13.5-8; §14 index, T14-4, T14-6; §12.7 T12.7-3). SPEC 13.5, 14.26, 12.0, and 12.7 now give the busy refusal a stable code and a concerned path: exit 2, the error document's `code` `"workspace-busy"` and `path` `".xspec/lock"`, reported by the refused mutating command alone and "never by `check` or any other command". T13.5-2 asserts "exit 2" and T13.5-8's exclusion-first arm "the exclusion usage error, exit 2". Neither runs with JSON in effect, so the preamble's rule to assert the exact code wherever §14 assigns one cannot be applied. T14-6 still iterates "each of the 25 conditions" and names only 24 and 25 as error-document codes. T14-4's reporter matrix and §14's primary-test index stop at 14.25. T12.7-3 lists the error-document variants without the busy one. The missing assertion removes a requirement. Needed:
  - JSON-in-effect arms in T13.5-2 for each mutating command (`rename`, `move`, `review create`/`resolve`/`split`), each asserting the whole error document;
  - T14-6 extended to 26 conditions, with `workspace-busy` as an error-document code;
  - a T14-4 row: delivered only by the refused mutator, and carried by nothing that `check`, `inventory`, a preview, or a read command run during a hold reports;
  - the busy variant in T12.7-3, and the 14.26 entry in §14's index.

- [C2] **The held-state and graph-data comparisons contradict SPEC 13.4 and 13.5** (§13.5 T13.5-1, T13.5-8; §13.3 T13.3-2 and its reusers). While a run holds exclusivity, a conforming product keeps its entry in `.xspec/lock/`, and keeps `.xspec` itself when acquisition created it. SPEC 13.5: "Acquisition then adds to the lock directory an entry of its own … the lock directory and the area's directory coming into existence where absent".
  - Failing assertions: T13.5-1 asserts "workspace byte-identical while held" in its basic arm and "graph data, and every other workspace file, is byte-identical to its pre-invocation state" in its stale-workspace arm. T13.5-8's seam-ordering arms assert "the workspace byte-identical while held". Each fails against every conforming product.
  - Graph-data definition: T13.3-2 defines graph data operationally as "every path under `.xspec/` except the durable `.xspec/journal` and `.xspec/reviews/`". That definition is reused by T6.6-5, T6.6-6, T12.2-2's missing arm, T13.4-3, T13.4-10, every "graph data byte-unchanged" comparison (T13.5-1's seam neutrality and T13.5-7 among them), and the staging set of T14-10(f). It still includes the lock path. SPEC 13.4 now classes the lock path as transient: "neither derived nor durable, and no graph data", bearing "on no comparison of graph data … and on no record". SPEC 14.25 also removes refused reads under it from condition 23.
  - Fix: exclude `.xspec/lock` and everything under it from the graph-data path set and from every while-held snapshot. Also exclude `.xspec` when it was absent before the invocation. In place of the exemption, assert positively that while held the lock directory holds exactly one entry, a plain file, and that nothing else has changed.

- [C3] **T13.5-3 requires a takeover in a state where SPEC 13.5 permits refusal** (§13.5 T13.5-3; §16 P-10).
  - The rule: SPEC 13.5 says "A leftover MUST NOT block later commands … but for one gap". That gap covers an entry whose recorded identifier "is still listed in the acquiring process's process list, live or terminated — its run's process terminated but still listed, the identifier reused after that run ended …". Such an entry "MAY refuse acquisitions".
  - The defect: T13.5-3 reads "Kill a held mutating command; a subsequent mutating command succeeds (a terminated holder never blocks)". It does not require terminating every process of the held invocation. Nor does it require collecting the killed process's exit before starting the next command. So it asserts success where a conforming product may refuse, because a killed process whose exit is uncollected is still listed. That adds a requirement, and it makes the test nondeterministic (E-5). The parenthetical also restates the old, absolute rule.
  - Fix:
    - Terminate the whole held invocation, collect its exit, and confirm that none of its processes is still listed before the next mutating command starts.
    - Assert the state in between: `.xspec/lock` holds exactly one plain file, the dead run's entry. Then assert its takeover: after the next command, `.xspec/lock` is absent.
    - Say how the gap's other arm, reuse of the identifier, is kept from making the test flaky. It cannot be prevented, only made negligible or detected and retried; record which approach the test takes.
  - P-10's kills inherit the same discipline wherever a later mutating command follows a kill.

- [C4] **How far the exclusion reaches is untested, so the defect that triggered this revisit still passes the suite** (§13.5 T13.5-2, T13.5-8; §16 P-10).
  - The rule: SPEC 13.5 requires every other run on the machine to fail promptly — "by any user who can write it, in any environment, through any path to its root directory, a symbolic link above the root or another mount of it included".
  - The gap: T13.5-2, T13.5-8, and P-10 start both runs with one user, one environment, and one path to the root. The Phase 10 report reproduced this product state: a `rename` held under one temporary-directory setting, and a second `rename` under another setting exiting 0, both journaled. That state passes every one of these tests.
  - Needed arms, each asserting that the second run is refused promptly, modifies nothing, and leaves the holder's entry untouched:
    - (a) a different environment: different temporary-directory, home, and runtime-directory variables, plus unrelated variables;
    - (b) a different working directory: a subdirectory, and a directory outside the root reaching it through `--config`;
    - (c) a different path to the root: through a symbolic link above it, and through a second mount of it;
    - (d) a different user who can write the workspace.
  - Constraint on the expected code: in (d), and wherever the environment refuses the second run a read or write that acquisition makes, 13.5 allows "the usage error of 14.26 — or of 14.25 or 14.24". An example is a lock directory the first user created with modes the second user cannot write into. These arms must therefore accept any of the three codes — exit 2, nothing modified, never success. Pinning `workspace-busy` alone would add a requirement.
  - How these stagings are made and placed in CI: [I2].

- [C5] **What acquisition does with the lock path and the graph-data area is untested** (§13.5; §13.4; §10.1 T10.1-6; §14 T14-9, T14-10). None of the following statements from SPEC 13.5, 13.4, 14.24, 14.25, and 10.1 has a test. Each is deterministic and needs no hold unless stated. Each is asserted for every mutating command, or for representatives under an argument that says why they suffice.
  - (a) **Obstruction.**
    - `.xspec` a plain file, a symbolic link (to a directory, and dangling), or another non-directory: exit 2, `write-failure`, path `.xspec`. The occupant stays, and nothing is written through a link. This is SPEC 10.1's new clause that such an area "fails every mutating command at acquisition first"; T10.1-6 runs only non-mutating commands on this staging.
    - `.xspec/lock` a symbolic link (to a directory, to a file, and dangling), or another occupant that is neither a directory nor a plain file (a FIFO, a socket): exit 2, `write-failure`, path `.xspec/lock`, with no hang. The occupant stays, and the link's target is untouched.
  - (b) **Leftover takeover.**
    - A plain file at `.xspec/lock`, including one with every permission removed, is removed and the command proceeds.
    - Inside the lock directory, these are removed: a directory tree; a symbolic link, removed itself while its target outside the area stays byte-identical; and a FIFO, removed without being opened, so no hang.
    - A dead run's entry, left by a holder that was killed and its exit collected, is removed. That holds when its permissions are removed (acquisition "reads no file's content"). It holds equally when the entry arrives in another workspace by copy or through version control (13.5: "created … for another workspace, as version control or a copy of the workspace carries it in").
    - After each takeover, `.xspec/lock` is absent once the command ends.
    - Constraint: no test may assert that a plain file of arbitrary name inside the lock directory is removed. 13.5 places only "a plain file at the lock path, or anything in the lock directory but a plain file" outside the gap, and the entry form is opaque.
  - (c) **A busy refusal removes nothing.** Junk that is not a plain file, staged beside a live holder's entry, stays put. The holder's entry stays byte-identical, name and content: "no leftover then removed"; "no acquisition or release removes or alters the entry of a run alive on its machine". After the holder releases, the next run removes the junk.
  - (d) **Acquisition's refused reads and writes, and their concerned paths.** Each case exits 2 promptly with nothing modified:
    - a lock directory that cannot be listed: `read-failure`, path `.xspec/lock`;
    - a subdirectory of the lock directory that holds a file and cannot be listed: `read-failure`, path `.xspec/lock` (14.25: "for the lock path's occupant or anything under it the lock path"), never the nested path;
    - a lock directory, or such a subdirectory, that refuses the write acquisition needs: `write-failure`, path `.xspec/lock`;
    - a read-only `.xspec` with no `lock`: `write-failure`, path `.xspec/lock`;
    - a read-only workspace root with no `.xspec`: `write-failure`, path `.xspec` (14.24: a write "producing the area's directory").

    T14-9 and T14-10 gain these rows in their concerned-path tables and reporter sets. T14-10's record of clauses that cannot be staged gains the kind read of the area's own occupant at acquisition.
  - (e) **The manual remedy** (13.4). After the obstructing occupant, or a `.xspec` that is not a directory, is deleted by hand, the next mutating command proceeds.
  - (f) **Interference** (13.5). If the holder's entry is deleted by hand during its hold, a further mutating run acquires rather than being refused: it fares "as the lock directory then decides".
  - (g) **The leftover that records the acquirer's own identifier.** The gap excludes "the acquiring process's own" identifier, so such a leftover must be taken over. It can only be staged where two runs can be given the same process identifier, for example two fresh process-identifier namespaces. Either stage it, or record it as not stageable with the reason, as T14-10 records its unstageable clauses. At present it is neither.

- [C6] **Release is untested** (§13.5 T13.5-1/2/7/8; §14 T14-9, T14-10).
  - The rules: SPEC 13.5 says "A command ending normally — completed, refused, or failed alike, at acquisition or at a refused write or read (14.24, 14.25) included — releases: it deletes its entry, then the lock directory when that holds nothing else, and the area's directory too when its acquisition brought that into existence and it then holds nothing else". It adds that "Release reads nothing" and that a deletion the environment refuses "changes no outcome and is no write failure" (14.24 likewise).
  - (a) **After every kind of ending.** Assert `.xspec/lock` absent after a successful run, a refused run (exit 1), and a run failed by a usage error (exit 2, the occupied-hold-path arm of T13.5-1 among them). After a busy-refused run, `.xspec/lock` holds exactly the holder's entry.
  - (b) **The area's directory.** On a workspace with no `.xspec`, a refused `rename` (for example, an unknown old ID) leaves no `.xspec`. A pre-existing empty `.xspec` survives the same run. A pre-existing empty `.xspec/lock` is removed.
  - (c) **Release after a stop.** Every arm of T13.5-7 and T14-9, plus a read failure met after acquisition, ends with the run's entry deleted, and a following mutating command is not refused.
    - T13.5-7(b) and T14-9's journal arm stage `.xspec` read-only. That refuses only release's deletion of the lock directory, so these arms must expect that empty directory to remain, with the outcome otherwise unchanged.
    - T13.5-7's claim that the exclusivity mechanism, "wherever in the workspace it keeps state, never meets the staging" is now false. The arm currently sets no expectation for this residue.
  - (d) **Release reads nothing.** Remove the lock directory's read permission during the hold. The command ends with its normal outcome, and `.xspec/lock` is gone. This fails a product that lists the directory before deleting it.
  - (e) **A refused release deletion.** Make the lock directory unwritable during the hold. The command ends with its normal outcome (exit 0, its normal output), reports no `write-failure`, and leaves its entry behind. Once permissions are restored, the next mutating command takes that entry over and succeeds.

- [C7] **Rediscovery under exclusivity is untested** (§13.5; §12.0 T12.0-10; §14 T14-10).
  - The rules:
    - SPEC 13.5: a run, while holding exclusivity, "discovers its sources again: that discovery fixes the sources every later check and read consults, a configuration error it meets reported there".
    - SPEC 12.0 places that configuration error "after the acquisition and hold-file errors, preceding the rest".
    - SPEC 14.25: a discovered source "found absent when its content is read, removed or relocated since discovery (13.5), included … reads as undiscovered".
  - Stageable through the seam: the hold engages "before the second discovery", so each of the following is deterministic. During the hold:
    - (a) create a spec source that references the renamed section: the `rename` rewrites it too;
    - (b) delete a source that references it: the operation completes without that source, with no read failure;
    - (c) create the origin file a `rename` names, absent when the command was invoked: the `rename` proceeds. Separately, delete an origin file that was present: exit 2, unknown file;
    - (d) create a file matched by both a spec group and a code group, with the invocation also naming an unknown old ID: exit 2, `configuration-error` rather than the unknown-ID usage error, nothing modified;
    - (e) make a discovered directory unlistable: `read-failure` at that directory, after which the run releases.
  - Commands with no seam: 14.25's found-absent clause still needs either a recorded residual or a robustness property. Such a property would delete or relocate sources while reads and builds repeat concurrently, and assert that the vanished file never causes a read failure or a crash, and that each answer equals either the answer with the file or the answer without it.

- [C8] **The inventory's `lock` member is untested** (§11.6 T11.6-3; §12.7 T12.7-2).
  - The rule: SPEC 11.6 adds a bullet, "Lock directory. The lock path (13.5), `.xspec/lock`, reported unconditionally: transient (13.4) and xspec's alone, with everything under it". It also reclassifies paths under the lock path out of "unattributed". SPEC 12.7 adds the `"lock"` member to the inventory document.
  - The gap: no T11.6 arm asserts the member. T11.6-3 covers only the graph-data area's unconditional report, and T12.7-2 defers the inventory's form to T11.6.
  - Needed: `lock` is exactly `".xspec/lock"` in each of these cases, with the inventory finding-free (exit 0) and nothing under the lock path listed in any other member:
    - before any build;
    - with `.xspec` absent, a plain file, or a symbolic link;
    - with a leftover present;
    - during a hold.

- [C9] **SPEC 6.6's acquisition boundary is tested only for the busy refusal** (§6.6 T6.6-2, T6.6-3).
  - The rule: SPEC 6.6 now states that "acquisition (13.5) and its every outcome — the mutual-exclusion refusal, and a read or write of acquisition the environment refuses (14.24, 14.25) — apply to the real operation only, the preview answering as the real operation would once holding exclusivity".
  - The gap: T6.6-3 covers only a preview run during another command's hold. Missing:
    - (a) With `.xspec/lock` obstructed (a symbolic link) or unwritable, a `--preview` answers exactly as on an unobstructed twin, while the real operation exits 2 with `write-failure`.
    - (b) With `.xspec` a plain file, the preview answers as the real operation would once holding exclusivity: the invalid-workspace refusal, exit 1, carrying T10.1-6's condition-22 finding at `.xspec`. The real operation exits 2 with `write-failure` at `.xspec`. The two results together pin the boundary.
    - (c) A preview leaves a leftover byte-untouched — a plain file at `.xspec/lock`, or junk in the lock directory — because it acquires nothing and so removes nothing. A product that runs acquisition for previews removes it.

- [C10] **That non-acquiring surfaces ignore the lock path is untested** (§13.3, §13.4, §12.2, §11.6; §14 T14-4).
  - The rules:
    - SPEC 13.4: the lock directory's "presence and content bear on no comparison of graph data (13.3, 14.10) and on no record (14.23)", and "No write but acquisition and release touches it".
    - SPEC 14.22: obstructions of acquisition's write paths are acquisition's write failures, never condition 22, and `check` and the gate judge exactly `build`'s write paths.
    - SPEC 7.3: graph data lies "beside" the lock directory, never under it.
  - The gap: only T13.5-4 touches this, and it runs only `check` during a live hold.
  - Needed: with a readable leftover in place — a dead run's entry, a plain file at the lock path, or a symbolic link, FIFO, or junk directory in or at it — these must hold:
    - `build` exits 0 and leaves the leftover byte-untouched;
    - `check` is clean, with neither condition 10's unit form nor condition 22;
    - a refreshing read answers without touching the leftover;
    - `inventory`'s `recorded` stays available and unchanged.

    Each check fails a product that treats the lock path as graph data, as a write path, or as part of the record.

- [C11] **SPEC 12.0's precedence around acquisition is untested** (§12.0 T12.0-10; §13.5 T13.5-8).
  - The rules: for a mutating command, SPEC 12.0 now orders errors as follows:
    1. the syntax class;
    2. the configuration error;
    3. discovery's read failures (acquisition follows loading and discovery);
    4. "the acquisition and hold-file errors of 13.5 — acquisition precedes every later check";
    5. the configuration error that only rediscovery meets;
    6. names, files, and the baseline.

    A write failure comes "after every check and validation but for acquisition's, which precedes them". The argument checks of `rename` and `move` precede source validation "unless a mutating command's acquisition fails first".
  - Why it is now testable: the busy refusal and acquisition's failures carry codes, so each boundary can be discriminated.
  - Needed arms, each run once with a live holder and once with an obstructed lock path instead:
    - `rename specs/A.mdx nope x` gives `workspace-busy` or `write-failure` respectively, never the unknown-ID error (`code` `null`);
    - `review create --base <unresolvable> --name n` gives the same, never the baseline error;
    - `review create --strategy audit --name n` on a failing workspace exits 2, never with the gate's exit 1 (T13.5-8 has only the busy half);
    - a surplus operand, an invalid configuration, and an unlistable discovered directory give, respectively, the syntax error (`code` `null`), `configuration-error`, and that directory's `read-failure` — never the busy or acquisition error;
    - a run whose `--test-hold` path is occupied while another run holds gives `workspace-busy`, never the hold-file usage error.

    T12.0-10 has none of these arms.

- [C12] **Overlapping acquisitions are untested** (§13.5; §16 P-10).
  - The rule: SPEC 13.5 says "of runs whose acquisitions overlap, at most one acquires — possibly none, the others refused (14.26)".
  - The gap: every exclusion test starts its second run only after the first already holds, and P-10 drives "one mutating command".
  - Needed: a property test that races several mutating commands started together, each with its own hold path, on built and on unbuilt workspaces. It asserts:
    - at no instant do two hold files exist;
    - every run either completes its operation or exits 2 with `workspace-busy`, modifying nothing;
    - zero successes are acceptable;
    - the journal lines equal the successful operations;
    - on an unbuilt workspace, an empty `.xspec` left behind is acceptable — 13.5's one stated residue — and nothing else is.
  - Wording to update: §13.5's opening line "All mutual-exclusion tests use the `--test-hold <path>` seam for determinism" needs an exception for this deliberately unsynchronized start.

- [C13] **Workspace isolation has no nested-root arm and no arm showing that exclusion stays within one workspace** (§13.5 T13.5-6; H-1).
  - The rule: SPEC 13.5 requires that "instances operating on different workspaces, one root inside another included, MUST NOT interfere with each other where the workspaces share no file". The exclusion holds "per workspace".
  - The gap: T13.5-6 drives two workspaces concurrently, with no hold and no nesting.
  - Needed: with one root inside another (disjoint globs, disjoint write paths), and likewise for sibling workspaces:
    - a mutating command held in either workspace leaves a mutating command in the other prompt and unrefused;
    - concurrent mutations in both workspaces equal serial runs.

    Workspaces that share a file carry no guarantee and need no test.

## Important

- [I1] **H-4 and H-6 should treat lock entries as opaque and outside determinism** (§0 H-4, H-6; §12.0 T12.0-7).
  - The rule: SPEC 13.4 says the entries' "names and content are coordination state, not stored data — opaque, and dependent on the machine and process that wrote them, outside the determinism of 12.0". SPEC 12.0 repeats it.
  - The problem: H-4 lists only journal-entry content and graph-data content as opaque. H-6 compares "written files … after normalizing nothing", and entries are written files.
  - Fix: state that no test pins entry names, entry content, or entry permissions. State also that determinism and twin comparisons exclude `.xspec/lock` wherever a leftover can survive, such as the residue of C6(c), the arm of C6(e), and post-kill states.

- [I2] **The new reach and process-identifier arms need staging rules and a place in CI** (§0 H-1, H-2; §18 E-1, E-2, E-3).
  - The problem: several arms need channels that H-2 does not grant — it lets tests control only "working directory, arguments, and environment":
    - C4(d)'s second user;
    - C4(c)'s second mount;
    - C5(g)'s shared process identifier;
    - C3's termination of a whole invocation.

    E-1 runs the product on the Linux leg as one unprivileged user, and E-2 keeps the local-only set empty.
  - What TEST-SPEC must say, for each such staging:
    - how it is made, and how the harness verifies it on itself before use, as T14-9 verifies its permission stagings — two distinct user identities that can both write the workspace, and two paths that are distinct mounts of one directory — so that an ineffective staging is a harness error, never a vacuous pass;
    - whether each arm runs in GitHub CI or is local-only, with the reason (E-2);
    - how machine-wide setup, such as an extra user or a mount, stays safe when several suite instances run in parallel (H-1, E-3).

## Optional

- [O1] TEST-SPEC's heading "13.4 Derived and durable files" no longer mirrors SPEC's "13.4 Derived, durable, and transient files", although the preamble promises a one-to-one mirror of sections.
- [O2] T12.0-9's exit-2 row still says "mutual-exclusion refusal". SPEC 12.0 now reads "a mutating command refused at acquisition, its workspace busy (13.5, 14.26)". Align the wording and cite 14.26.
- [O3] P-10's check "journal lines = successful `rename`/`move` operations" is ambiguous once a kill can land after the journal append. 13.5 makes the append the commit point, so such a run is identity-complete without exiting 0. While P-10 is reworked for C3 and C12, define which runs count, for example by whether the append is observable.
- [O4] Downstream note for the driver's notes: CERTIFICATIONS' CONF-CORE certifies "13.5 in full", and VIOL-CORE-STALELOCK describes the refusal as "the usage error of 13.5/12.0". Fixing C1–C3 will require re-grounding those entries: the conformer's exclusion now lives in `.xspec/lock`, the refusal carries the 14.26 code, and T13.5-3 gains its exit-collection discipline. The new negative and seam-routed lock arms (C5–C7, C12) are candidates for certification.
