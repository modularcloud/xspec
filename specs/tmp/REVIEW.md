# Review — specs/SPEC.md — Phase 10 jump-back over SPEC-PROBLEMS (13.5's reach and environmental outcomes), round 2

## Critical
- [C1] **13.5 ¶3 (obstructed area) and 14.22: a command that creates no lock file runs without exclusivity, and its outcome is undefined once the obstruction clears.** 13.5 says that where `.xspec` holds a non-directory, "acquisition creates none and refuses nothing, and the command modifies nothing, the obstructed graph-data path failing `build`'s validations (14.22)". That holds only if the obstruction is still there at the gate. The same section has the command go on through the hold seam and a second discovery, and then validate "the workspace … current once it holds exclusivity".

  **Deterministic staging:**
  1. Start `rename … --test-hold h` while `.xspec` is a plain file.
  2. Replace that file with an empty directory.
  3. Start a second mutating command. It finds no lock, so it acquires `.xspec/lock`.
  4. Delete `h`.

  The first command's gate now passes, and it rewrites sources and appends to the journal without exclusivity, concurrently with the second. Two statements break: the sentence's own "modifies nothing", and ¶2's MUST ("while one holds exclusivity, every other run … MUST fail promptly"). No report and no exit code are defined for a command that acquired nothing but then meets a passing gate. So SPEC-PROBLEMS' second decision (what a mutating command reports when exclusivity cannot be established for an environmental reason) is still open for this case.

  14.22 has a related conflict. It requires that "every other writing command judges the paths its own writes would produce, before modifying anything". `.xspec/lock` is one of a mutating command's write paths, so that rule contradicts "refuses nothing" unless the lock path is carved out.

  **Needed:**
  - a defined outcome for a command that created no lock file, consistent with 12.0's precedence and testable through the seam (for example, it makes no write whatever the gate later finds, and reports a stated error);
  - that 14.22 carve-out.
- [C2] **13.5 ¶3 (release) contradicts the stop rules of 13.5 ¶5, 14.24 and 14.25.** Under 13.5 ¶3, every command "ending normally — completed, refused, or failed alike, at acquisition included — deletes the lock file it created, and the area's directory too when its acquisition brought that into existence". The stop rules say otherwise:
  - a command stopped by a write failure is "attempting no later one" (14.24) and "makes no later one" (13.5 ¶5);
  - one stopped by a read failure is "attempting nothing further" (14.25).

  14.24 counts a removal as a write, and its last sentence itself anticipates a refused deletion at release. Both rules therefore cannot hold for any write or read failure met after acquisition. They also collide at acquisition, where release removes an area directory that acquisition created before the refused write.

  So the state a stopped command leaves is not derivable: the stop rules say the lock (and a fresh `.xspec/`) stays, while the release rule says it is gone. That state is exactly what T13.5-7 pins by byte-compare.

  **Needed:** state that release's deletions follow every normal ending, a stop included. Then exempt them by name from "no later one" and "nothing further" (13.5 ¶5, 14.24, 14.25).
- [C3] **13.5 ¶3 (leftover replacement) contradicts "leave no trace" and the spec's modify-nothing statements.** Acquisition replaces any leftover, and release then deletes the replacement, so after any command that acquired, the leftover is gone. Leftovers include:
  - a killed holder's lock;
  - one carried in by a copy or by version control;
  - any foreign occupant of `.xspec/lock`, a directory and its content included.

  Yet the same paragraph concludes "so acquisition and release leave no trace and a command that modifies nothing leaves the workspace as it found it". The refusal and failure paths of mutating commands also promise to modify nothing:
  - 6.4: rename refuses "before modifying anything";
  - 10.1: a corrupt session is reported "modifying nothing";
  - 10.7: an unresolvable baseline fails "modifying nothing";
  - 13.5: a hold file that cannot be created fails the command "without modifying anything";
  - 14: refusal coordinates are pre-operation "since a refused operation modifies nothing".

  Separately, acquisition's own creation of `.xspec/lock` (and possibly `.xspec/`) comes before every "before modifying anything" point (6.4, and the seam in 13.5). Nothing says that lock writes fall outside "modify". So a refused `rename` on a workspace that holds a leftover has two contradictory specified end states, and TEST-SPEC cannot derive the whole-tree comparisons it makes on these paths.

  **Needed:** one statement that places acquisition's and release's writes outside those modify-nothing statements, and that names the removal of a replaced leftover as the one lasting change such a command makes (or whatever end state is intended).

## Important
- [I1] **6.6: the preview equivalence now fails on environmental acquisition failures.** 6.6 says a preview "is refused exactly when — reporting what, and exiting as — the real operation would be refused, and succeeds exactly when the real operation would proceed". It exempts only "the mutual-exclusion refusal of 13.5" as applying to the real operation alone. After this refinement, acquisition writes `.xspec/lock` before every check (13.5). That makes the real operation exit 2 at acquisition (14.24 or 14.25), before any validation, in cases such as:
  - a root or `.xspec/` that the invoker cannot write;
  - a leftover lock it cannot read or replace.

  In those cases the preview acquires nothing, so it reports the refusal (exit 1) or succeeds (exit 0). Before this refinement, workspace writes came only after validation, so the equivalence held there; read literally, it is now false. T6.6 tests that derive "preview refused ⇔ operation refused" need the boundary stated.

  **Needed:** extend the exemption to every outcome of acquisition: the busy refusal, and acquisition's read and write failures.
- [I2] **13.5 ¶3: "this machine" carries normative weight but has no observable definition.** Two rules combine here:
  - the leftover rule makes a lock "created on another machine" a leftover that acquisition replaces;
  - the gap that MAY refuse covers only a recorded identifier "reused after the holder ended, or seen from a container or sandbox with its own process list".

  Take a lock written on another machine that shares the workspace's directory, whose recorded identifier happens to name a live local process. It MUST be replaced. A product can honor that only by recording an identity for the machine, and the spec defines none.

  The obvious proxies contradict ¶2's stated reach. Take a host name: a container that shares the host's process list but has its own host name is, under ¶2, a run "in any environment" on "that machine". Two processes there can share one process list yet differ in host name. A product keying on host name would therefore replace a live holder's lock and break the exclusion MUST. The cross-machine clause also has no E2E route in a single-machine harness.

  **Needed:** define the boundary observably, for example by the process list the acquiring process sees. Then fold into the gap a recorded identifier that names a live process of that list, whatever wrote the lock. This is consistent with the ruling's accepted "reused-process-number gap" and its "no coordination across machines". Alternatively, state what identifies a machine.

## Optional
- [O1] **13.5 ¶2 and 14.26: the exclusion and the busy code need qualifying.**
  - The MUST names 14.26 without qualification ("every other run … MUST fail … with the usage error of 14.26"). But syntax-class and configuration errors come before acquisition (12.0), and a live holder's lock that the acquirer cannot read yields 14.25.
  - A terminated holder's leftover that the acquirer may not replace blocks it with 14.24, despite "MUST NOT block … but for one gap".
  - In the other direction, 14.26 is defined as a refusal "because another holds the workspace's exclusivity — a lock file whose holder still runs". That definition does not cover the gap's refusals, where no holder runs.

  Consider "every other run that reaches acquisition", allowing acquisition's 14.24 and 14.25 outcomes, and widening 14.26 to cover the gap.
- [O2] **13.5 ¶3: when exclusivity ends.** The text says "Exclusivity ends when the holding command's process terminates", but release deletes the lock before the process exits. A command started in that interval acquires the lock, which the literal text forbids. Say that exclusivity ends at release or at termination, whichever comes first.
- [O3] **Hygiene around the new transient class.**
  - 13.4 ("every one but the lock file (below) is suitable for committing", and "Files are classified:") leaves the `--test-hold` file unclassified, though it too is a file xspec writes.
  - 7.3 describes the area as holding graph data "beside the journal (6.1) and review sessions (10.1)" and omits the lock.
  - 12.0's determinism bullet ("All output, generated files, and stored data are byte-deterministic") does not point to the exemption 13.4 gives lock content.
- [O4] **13.5 ¶1 (as applied in c4724be): nested roots.** In "Workspaces sharing one — a root inside another, a source both discover — are not isolated", a root inside another is not itself a shared file. Nested workspaces whose discovery and writes are disjoint share no file, so the preceding sentence's isolation MUST covers them. Say whether nesting alone forfeits isolation.
- [O5] **11.6 lock bullet and 13.4: who may delete a leftover.** 11.6 says an external tool "never creates or edits" the lock, while 13.4 permits manual deletion while no mutating command runs. Say whether an external tool may delete a blocking leftover. Consider also requiring the busy refusal's message to name that remedy, since a gap refusal is otherwise indistinguishable from a live holder.
- [O6] **Modularity SHOULD (round 1's deferred O1).** It is still unmet, at roughly 250 KB in one file. Modules can keep their section numbers, so moving self-contained parts out need not shift TEST-SPEC's citations. Examples of such parts are 6.5's text rules, 10.5–10.6's strategies and 14.20's well-formedness detail; the command contracts stay in SPEC.md.
