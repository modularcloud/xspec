#!/usr/bin/env node
// VIOL-CORE-EARLYWRITE violator executable (CERTIFICATIONS.md
// §VIOL-CORE-EARLYWRITE). The CONF-CORE conformer with exactly one
// behavioral deviation: a mutating command given `--test-hold` performs its
// workspace modifications before creating the hold file — it acquires
// exclusivity, completes the operation's writes (journal append included),
// then creates the hold file (creation failing on an occupied path as 13.5
// states, the exit-2 refusal then following the completed writes), waits for
// its deletion, and exits normally, releasing as it ends. An invocation
// without `--test-hold` creates no hold file and behaves as the conformer's.
// The second discovery (13.5), the argument checks of 12.0, baseline
// resolution (6.3), the gate of 13.3 and the outcomes 10.7 orders past it,
// and the valid-workspace precondition of `rename`/`move` (6.4, 6.5) are
// judged after acquisition and before the writes they gate — the 13.3
// refresh among them, made just before the session write — while the exit
// they refuse with is deferred as the writes' completion is: an invocation
// they refuse creates the hold file having written nothing, waits for its
// deletion, and only then exits with its error. Certifies T13.5-1, T13.5-2,
// T13.5-4, and T13.5-8 (C-1): exactly those fail against this fixture; every
// other §CONF-CORE in-scope test passes.
import { runXspec } from "./product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {
  writesBeforeHold: true,
});
process.exit(code);
