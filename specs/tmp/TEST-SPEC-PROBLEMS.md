# TEST-SPEC problems

## 2026-10-15 — P-12: against the conforming read path, P-12 no longer fits its 600 s hang guard with margin

**Where:** TEST-SPEC.md §16 P-12 ("for every file and every offset 0…byte
length, `at`'s resolution … equals the resolution computed from that file's
`view` document alone") with E-5 ("a test whose result varies there is flaky,
a harness defect"); its harness implementation
`test/suite/registry/section-16-p12.ts` — `timeoutMs: 600_000` ("Wall-clock
hang guard only"), `runs: 3` at the 3 fixed seeds, and the exhaustive
per-offset sweep: 1339 `at` invocations over the 9 CI-pinned trials, each a
separate product process. The product constraint is SPEC 13.3 with 11.2.

**What changed in the product:** SPEC 13.3 — "Read results never come from
stale data"; on a workspace passing `build`'s validations, graph data that
"does not match the current sources and configuration" (a comparison of
content) is refreshed by `at`, `query`, and the other reads before they
answer. The product's store-backed fast path answered `query` and `at` from
stored graph data whose recorded inputs (the configuration's, journal's, and
sources' hashes and a recorded configuration parse) matched the current
bytes. The compliance determination at `6694886` found it unsound (findings
B10 and B11: a hand-edited store keeping its recorded inputs was served as
current, and a recorded parse stood in for the configuration's own
validation, skipping a 14.14 configuration error). FIX_PLAN Task 7 retired
it at this entry's commit: every `at` now parses and validates the
configuration with the TypeScript compiler API (SPEC 7, 14.14;
IMPLEMENTATION.md), loads the MDX toolchain, analyzes the workspace,
derives what `build` would write, and compares — once per process.

**Measurements** (Claude Code sandbox, 4 vCPU, Node 22.22.0, quiet; P-12
alone under AGENTS.md's unprivileged recipe, fixed seeds; P-12 passed in
every run):

| Product | P-12 test time (wall) | `at` per invocation |
|---|---|---|
| fast path (`3bb3df8`) | 257.1 s (264.6 s) | ~190 ms |
| fast path retired | 550.6 s (558.9 s) — 92% of the guard | ~440 ms |
| retired, plus the sound saving landed with it (the configuration's syntax check reads a no-emit single-file program's diagnostics instead of `ts.transpileModule`'s) | 476.7 s (483.8 s) — 79% of the guard | ~365 ms |

(Per-invocation figures: medians of interleaved runs of each build on a
two-file spec workspace with a current store.)

What remains is process start and module loading, which no sound change
reaches by more than a few tens of milliseconds: Node's start ~35 ms; the
TypeScript compiler's load ~120 ms (one 9 MB CommonJS file, read,
compile-cache restored, evaluated — needed by the configuration parse and,
for P-12's drawn imports and references, by the analysis); the MDX toolchain
(unified, remark-mdx, micromark, acorn) ~75 ms and the product's modules
~35 ms; the configuration parse ~20 ms; analysis, derivation, and comparison
~55 ms. IMPLEMENTATION.md fixes compilation with `tsc` and the TypeScript
compiler API for parsing the configuration. A shortcut that answers
without the derivation reintroduces B10/B11: content equality cannot be
established without it, and a recorded digest or build fingerprint narrows
the exposure without closing it.

**CI and loaded runs:** with the fast path, CI's `suite-linux` ran P-12 in
150 s (run 1274), 147.1 s (1287), 209.6 s (1284), 254.5 s (1285), and
269.6 s (1286) — 0.57–1.05 times the quiet local 257.1 s; the local full
run at `6694886`, under load from concurrent runs, took 327 s (1.27
times). Scaled from 476.7 s:
~272–500 s in CI at the observed ratios, ~606 s in a loaded local full run,
and ~667 s at the ~1.4 times a quiet local run that CI has shown for other
tests — past the guard. Observed with the fast path retired (this entry's
commit `5a4617c`, CI run 1288): `suite-linux` ran P-12 in 492.3 s — 82% of
the guard, 1.03 times the quiet local 476.7 s — passing, every other test
passing too (127 files, 4818 tests, in 1986.08 s).

**Why it is a test-system problem:** P-12's subject is the at ≡ view
equivalence and occurrence order, not latency, and its 600 s is a hang
guard. Against a conforming product the test now spends 79% of that guard
on a quiet machine, so its verdict depends on machine load — flaky by E-5,
a harness defect — and the product has no sound way back under it.

**Possible resolutions (for the TEST-SPEC owner):** raise P-12's hang guard
in proportion to the sweep (its cost is linear in the 1339 invocations — at
least 1200 s for the ~1.4 and loaded-run factors above with margin); or
shrink the sweep at the fixed seeds (fewer or smaller trials, or a sampled
rather than exhaustive offset set per trial, T11.5-1 keeping its exhaustive
single-file derivability anchor); or both.
