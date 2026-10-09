# Review — specs/SPEC.md — Phase 10 jump-back over SPEC-PROBLEMS.md (how far 13.5's exclusion reaches), iteration 5

The logged problem is resolved in substance. 13.5 now bounds the exclusion to one machine, defined by a process-identifier namespace. It keeps the state in `.xspec/lock`, which 13.4 classes as transient, 11.6 and 12.7 report, and 14.26 codes. Acquisition failures from the environment or from obstructions are named 14.24 and 14.25, so the engineer's provisional "exit 2, `code` null" choice is superseded. TEST-SPEC still has to follow: T13.5-1's byte-identical hold snapshot, and the whole-tree compares of the other 13.5 tests, must allow for `.xspec/lock`, and for `.xspec/` when acquisition creates it. That is downstream cascade, not a SPEC defect. The findings below concern the new text.

## Critical

- [C1] **13.5: the spec does not say whether acquisitions on one machine are atomic with respect to each other, and the interference rule covers a racing acquisition. Two mutating runs on one machine can therefore both proceed, or the guarantee cannot be implemented, depending on how 13.5 is read.**

  **The texts in tension.**
  - The headline: the mutating commands "are mutually exclusive per workspace among the processes of one machine … so concurrency on one machine never loses a journal append or a resolution".
  - The operative MUST binds only runs that arrive while a hold already stands: "while one holds exclusivity, every other run … that reaches acquisition … MUST fail there promptly".
  - Interference: "once anything but its release removes the lock file its acquisition created from its path, or alters it — a command on another machine replacing it, a manual deletion during the hold (13.4), or anything else — the hold excludes no run from then on, even on its own machine".

  Nothing says acquisition is atomic, or that one run's acquisition may not remove or alter a lock file that another run's acquisition created.

  **Case (a): runs race where no lock file stands.** Two runs reach acquisition at the same moment. Whichever creates the lock file second replaces the first run's lock file. That is "anything but its release" removing or altering it, so it voids the first run's hold. The second run arrived before any hold stood, so the MUST never bound it. Read this way, a mechanism that creates the lock by overwriting conforms, and both runs proceed and can lose an append. That contradicts "mutually exclusive" and "never loses a journal append".

  **Case (b): runs race on one leftover.** Each run judges the same leftover (13.5: "which acquisition replaces"). One run replaces it and creates its own lock file. The other then removes that fresh lock file, believing it is still the leftover. The leftover rule never says whether this is permitted (it is interference under "anything else"), or forbidden (the remover reached acquisition while a hold stood).
  - If forbidden, the requirement is unimplementable in the chosen design. The lock is a plain file at a fixed path, and every other occupant is a leftover or an obstruction (13.5). Removal from a fixed path cannot be made conditional on the occupant the remover examined, and SPEC-PROBLEMS point 2 already establishes that no advisory locking is available. Some race in replacement is therefore unavoidable.
  - If permitted, the spec states no such limit for the same machine. The listed limits are the gap and external interference.

  **Why it matters.** Phase 10 cannot tell from the text whether lock creation must be exclusive, or how strong a takeover the spec requires. Phase 6 cannot tell whether "never loses a journal append" holds for mutating commands started together (P-10-style schedules).

  **Fix.**
  - State that among runs on one machine that reach acquisition while no lock file stands at the path, at most one acquires. Creation never replaces an occupant, and the others meet the winner's lock file (14.26).
  - Say that a same-machine acquisition counts as interference only within the named residual below.
  - For runs that each judged the same leftover, either require that at most one acquires, or name the residual beside the gap. For example: a replacement may remove a lock file that another run created after this run judged the leftover, and the hold so removed counts as interfered with.
  - Then qualify "never loses a journal append" to match. Requiring a race-free replacement here is ambiguity-for-the-Driver: under the plain-file design it appears unimplementable, and the residual is a limit of option B beyond those the Developer was shown, so the Driver should judge whether naming it needs the Developer.

## Important

- [I1] **14.25 contradicts 13.5 for refused reads inside a leftover directory at the lock path.**
  - **13.5:** a leftover directory at `.xspec/lock` is replaced "a directory with all it holds". "A read or write of acquisition the environment refuses — of the area's own occupant, the lock file, or a leftover it replaces — is likewise the read or write failure of 14.25 or 14.24, met at acquisition".
  - **14.25:** a refused read "of anything under the area other than those durable paths, the session directory, and the lock file (below), is the state of condition 23". Its later list of reads that are condition 25 names only "the lock file and, at acquisition, the area's own occupant (13.5)".

  **The conflict.** To replace a leftover directory, acquisition must list a nested directory such as `.xspec/lock/d`. That path lies under the area but is not "the lock file", so 14.25 sends a refused listing of it to condition 23. 13.5 sends the same read to a 14.25 usage error with code `read-failure`. Condition 23's state has no defined meaning at acquisition, so a test author reading 14.25 cannot derive the outcome that 13.5 states. The "— except at acquisition (13.5) —" qualifier attaches only to the area's own occupant.

  **Fix.** In both places in 14.25, extend the carve-out and the condition-25 list to "the lock file's path and everything a leftover there holds". Alternatively, attach the "except at acquisition" qualifier to every read under the area.

## Optional

- [O1] **12.0's precedence sentence does not account for 13.5's rediscovery.**
  - **12.0:** "A configuration error (14.14) precedes every other error of exit class 2 … for a mutating command, first the acquisition and hold-file errors of 13.5".
  - **13.5:** a mutating command rediscovers its sources while holding exclusivity, "a configuration error it meets reported there (14.14)". The hold seam engages "before the second discovery".

  A configuration error that first appears at the rediscovery, such as a file created after the first discovery that both a spec group and a code group match, therefore follows acquisition and the hold seam. The two can conflict only in a race, so nothing deterministic contradicts 12.0. Still, the sentence is inexact. Suggest adding: "save a configuration error the rediscovery of 13.5 meets, which follows them".

- [O2] **Acquisition's reads are unpinned, so some unreadable leftovers have two conforming outcomes.** 13.5 pins that "an empty plain file or any directory records none" and so must be replaced (outside the gap). A refused read at acquisition, however, is 14.25, and the spec never says which reads acquisition makes.

  Take an empty plain file the acquirer cannot read, or an empty directory it cannot list, at `.xspec/lock`. A product that judges emptiness without reading content replaces the occupant and proceeds. One that reads first stops with 14.25 and exit 2. Both outcomes conform. The empty file is the simplest leftover a test can stage, because the lock's format is opaque (13.4), so a test that combines it with permission removal cannot pin an outcome.

  Suggest pinning one rule: acquisition reads the content of every plain file at the lock path and lists every directory it replaces, or else replaces identifier-less occupants without reading them. Alternatively, state the latitude so that TEST-SPEC avoids that staging.

- [O3] **SPEC.md remains a single 253 KB file with no modules.** This is against the PROCESS.md SHOULD to break loosely coupled components into their own modules. Candidates are 10 (Review), 11 (Query Surfaces), and 6.5's move contract. The point is recorded for completeness only: the Drivers of rounds 1, 2, and 4 deferred it as out of scope for this problems-file refinement.
