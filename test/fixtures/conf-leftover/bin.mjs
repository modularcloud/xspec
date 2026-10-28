#!/usr/bin/env node
// CONF-LEFTOVER conformer executable (CERTIFICATIONS.md §CONF-LEFTOVER).
// CONF-LEFTOVER's scope is CONF-CORE's workspaces, behavior, and mutating
// surface as P-15 drives them, on valid workspaces and without the seam —
// `build` establishing each draw's freshly built workspace and its
// leftover-free twin, CONF-CORE's `review` reads learning the items
// `resolve` and `split` name, and `rename`, file-form `move`, and `review
// create --strategy audit`, `resolve`, and `split` each run over a leftover
// tree in the lock directory — acquisition removing every leftover as
// CONF-CORE's does: a directory with all it holds, at every depth; a
// symbolic link itself, never its target; a FIFO unopened; a file unread;
// each name the bytes the filesystem lists, whatever its first byte and
// whether or not it is valid UTF-8. So this entry runs the CONF-CORE product
// deviation-free (../conf-core/product.mjs). The certification runner drives
// it exactly as it drives the built product — an executable/workspace
// binding and nothing else (TEST-SPEC C-2). Its one in-scope test is P-15:
// it sits with a conformer of its own because P-15's runs must complete
// promptly, and VIOL-CORE-EARLYRELEASE's unheld runs sit through its
// sustained interval, so P-15's outcome under that violator would turn on
// the promptness bound (CERTIFICATIONS.md, C-1).
import { runXspec } from "../conf-core/product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {});
process.exit(code);
