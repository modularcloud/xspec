# SPEC problems

## 2026-10-09 — SPEC 13.5: no mechanism can exclude every process operating on a workspace while 13.4 and T13.5-1 keep the exclusion out of the workspace (Phase 10 re-descent, FIX_PLAN Task 23; compliance finding C11)

**What the documents require.**

- SPEC 13.5 says: "All state is workspace-local". The mutating commands "are mutually exclusive per workspace: while one runs, another MUST fail promptly — without waiting for the holder's exclusivity to end — with a usage error (12.0), modifying nothing". It also says: "Exclusivity ends when the holding command's process terminates, normally or abnormally; a terminated holder MUST NOT block later commands." Nothing limits the exclusion by user, environment, or host.
- SPEC 13.4 says: "Every file xspec writes is a plain file suitable for committing". It sorts every such file into one of two classes. Derived files can be rebuilt by `xspec build`, and graph data is byte-deterministic (12.0). Durable files are the journal and the sessions. A lock entry fits neither class.
- TEST-SPEC T13.5-1 requires the "workspace byte-identical while held". The harness takes a snapshot of the whole root while the command waits at the hold seam: the entry set, kinds, file bytes, and link targets. It compares that snapshot with one taken before the invocation. T13.5-7 speaks of "the product's exclusivity mechanism, wherever in the workspace it keeps state". Under T13.5-1, that can only be state that leaves no byte trace.
- IMPLEMENTATION requires Node.js core APIs, "no platform-specific code paths", and no new runtime dependency without a spec-grounded reason. Node.js core has no advisory file locking.

**What the product does, and the gap.** The lock is a file at `os.tmpdir()/xspec-<uid>-<first 32 hex digits of SHA-256(realpath(root))>.lock`. It records the holder's process ID, so a dead holder's lock counts as stale. Reproduced at `5a85136`:

- `rename specs/A.mdx a a2 --test-hold <file>` is held under `TMPDIR=A`.
- Meanwhile `rename specs/A.mdx g g2` under `TMPDIR=B` exits 0, and both renames are journaled.
- The same second command under `TMPDIR=A` is refused with exit 2.

Processes of different users never see each other's locks. The lock name carries the uid, and on Windows and macOS each user has their own temporary directory anyway.

**Why no design meets all four.**

1. **No shared location outside the workspace.** The workspace is the only place that every process operating on it shares. Every location outside it is chosen by something other than the workspace:
   - `os.tmpdir()` follows TMPDIR, TMP, and TEMP, and is per-user on Windows and macOS. A home directory is per-user.
   - A fixed system path such as `/tmp` is platform-specific. It is also sticky, so no user can take over another user's stale lock there: user A's killed command would block user B, which breaks 13.5's other MUST.
   - Any mechanism outside the workspace stops at a host, container, or mount-namespace boundary. A workspace can cross that boundary through a bind mount or a network filesystem.
2. **No trace-free lock inside the workspace.** State inside the workspace that leaves no byte trace needs OS advisory locking (flock, fcntl, or LockFileEx) on a file that already exists. Node.js core has none. Getting it means a native addon: a new runtime dependency with builds per platform.
3. **A lock entry inside the workspace fails T13.5-1.** The conventional design is a lock file or directory created on acquisition, like git's `index.lock`. That is a file xspec writes outside 13.4's two classes. It also appears in T13.5-1's while-held snapshot, so the test fails.
4. **A loopback port is possible but fragile, and was not attempted.** One portable, non-file mechanism exists in Node.js core: a loopback TCP port derived from the workspace's canonical path, with a handshake that tells a holder of this workspace apart from a foreign listener or another workspace's holder. It makes mutation depend on things outside the workspace:
   - Loopback networking. Without it, no mutating command can run at all; CI's network-off stage brings `lo` up with `|| true`.
   - Free ports. Foreign listeners, OS-reserved ranges, and collisions can all take the port.
   - A holder answering promptly while its main thread is busy.

   It also reaches only one network namespace. "Fail promptly" and "MUST NOT interfere" would then hold only most of the time. That is not a conservative choice.
5. **Liveness ends at the host.** "A terminated holder MUST NOT block" is judged from a process table, which belongs to one host or one PID namespace. A recorded process ID means nothing on another host. So even a lock inside the workspace cannot honor both "every process operating on the workspace" and "a terminated holder never blocks" when several hosts share the workspace. 13.5's reach needs a bound under any reading.

**Decision needed.** SPEC 13.5 should state how far its exclusion reaches. It should also say what a mutating command reports when exclusivity cannot be established for an environmental reason. These options are not exhaustive:

- (a) **Scope the exclusion** to the mutating commands one user runs on one host with one temporary directory. The present mechanism conforms, and TEST-SPEC needs no change. "All state is workspace-local" should then say that the exclusion's coordination is not workspace state.
- (b) **Keep the exclusion's state in the workspace.** Acquisition would create a transient lock entry, for example under `.xspec/`. The entry exists only while a mutating command runs, or after one is killed. Several documents would change:
  - 13.4 would name the entry as neither derived nor durable, and never committed.
  - 11.6 and 13.3 would place it.
  - TEST-SPEC T13.5-1 would exempt it. The other 13.5 tests' whole-tree compares would need the same review.

  This reaches every process on the host that can write the workspace. It is still bound to the host, because liveness is (point 5).
- (c) **Require a host-wide non-file mechanism** (point 4), and specify its failure mode.

**What the product does meanwhile.** The lock stays in the temporary directory. The commit that records this entry handles an unusable lock location: the temporary directory missing, not a directory, unwritable, or full, or the lock's path held by something that is not a plain file. Such a location is now a 12.0 usage error: exit 2, `code` null, nothing modified. That is how 13.5 treats a hold file that cannot be created. Before this change, every mutating command exited 70 in that case, which is outside 12.0's exit partition. SPEC names no such case, so the ruling should confirm the choice. FIX_PLAN Task 23a holds the rest of Task 23 until the ruling.
