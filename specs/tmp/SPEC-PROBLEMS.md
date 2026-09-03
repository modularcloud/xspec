# SPEC problems

## 2026-09-03 — 12.0's UTF-8 argument-value rule cannot be implemented as stated under IMPLEMENTATION.md: a valid U+FFFD and an invalid byte are indistinguishable in Node's argument vector

**Where:** SPEC.md §12.0 ("Argument values are interpreted as UTF-8; an
argument value that is not valid UTF-8 is a usage error") together with §1.4
(U+FFFD is neither whitespace nor control, so a legal segment/tag code point)
and the addressing rule of §12.0 (a `<node>`/`<file>` value names the
workspace file); IMPLEMENTATION.md ("Runs on Node.js, active LTS lines
(currently 22/24); no APIs beyond the oldest supported LTS, no
platform-specific code paths"; the cli entry point is a function
`(argv, cwd, stdout, stderr) → exit code` with the bin a trivial wrapper).
Product site: `src/cli/args.ts`, `isValidUtf8ArgumentValue` (its comment
states the trade-off). Raised by the Phase 10 compliance determination at
`a45fb26` (reviewer C, §12–15, gap 2).

**What happens:** Node materializes `process.argv` by decoding the OS
argument bytes as UTF-8 with U+FFFD substituted for every invalid sequence.
The genuine three-byte sequence `EF BF BD` (U+FFFD, valid UTF-8) and an
invalid byte such as `FF` therefore arrive as the same JavaScript string. The
product treats any U+FFFD as "not valid UTF-8" (usage error, exit 2). Reviewer
C's reproduction: a discovered spec source `specs/\u{FFFD}.mdx` is listed by
`ids` and `inventory` as a plain-string path, yet
`xspec show 'specs/�.mdx#u' --json` exits 2 with the error document
"argument 2 is not valid UTF-8 …" where SPEC 12.0 requires exit 0 with the
node; the same rejection hits every argument value (`rename` new IDs,
`--file` globs, `--config`/`--test-hold`, `--base`, session names). The
opposite direction is pinned by the harness: T12.0-5 stages the argument
`specs/` + `0xFF` + `A.mdx` as raw bytes in the OS argument vector (Linux leg,
via the driver's POSIX `sh` trampoline) and requires exit 2 as a usage error.

**Why no product change can clear it under the current documents:** after
Node's decoding, the two inputs are byte-identical strings; no portable Node
API exposes the raw argument bytes, and the one source that does
(`/proc/self/cmdline`) exists only on Linux — a platform-specific code path,
which IMPLEMENTATION.md forbids. Accepting U+FFFD instead would satisfy
reviewer C's case but make every invalid-byte argument a legal value: a
non-UTF-8 `rename` new ID, for example, would be applied as the U+FFFD
spelling rather than refused, violating 12.0 in the other direction (T12.0-5
happens to keep passing only because its decoded spelling names an
undiscovered file). Either implementation violates one half of the rule; the
pair is unimplementable as specified.

**Resolution needed (Driver's call):** either (a) amend SPEC 12.0 to define
argument values as the runtime's decoded strings, stating that a value
containing U+FFFD is treated as not valid UTF-8 (the product's current,
conservative behavior; the only observable cost is that an argument cannot
name a workspace path or ID that genuinely contains U+FFFD — such paths and
IDs remain valid sources and identities, reachable through `--file` globs
that avoid the character and listed by `ids`/`inventory`); or (b) amend
IMPLEMENTATION.md to permit a raw-argument-bytes read where the platform
provides one, with the decoded `process.argv` as the fallback elsewhere, and
say in SPEC 12.0 that the distinction holds only where the platform exposes
the raw bytes (then TEST-SPEC T12.0-5's Linux-leg arm stays as it is and a
positive U+FFFD arm can be added). Until resolved, the product keeps its
current behavior; `specs/tmp/FIX_PLAN.md` (Phase 10, 2026-09-03) excludes
this finding by reference to this entry.
