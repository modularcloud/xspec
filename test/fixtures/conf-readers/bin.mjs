#!/usr/bin/env node
// CONF-READERS conformer executable (CERTIFICATIONS.md §CONF-READERS).
// CONF-READERS' scope is CONF-CORE's workspaces, behavior, and command
// surface as P-10 drives them, on valid workspaces — `build` and CONF-CORE's
// read commands as its readers, `rename`, file-form `move`, and the mutating
// `review` subcommands as its mutating commands, readers acquiring nothing
// and writing nothing at the lock path (13.4), acquisition judging the lock
// directory as CONF-CORE's does — so this entry runs the CONF-CORE product
// deviation-free (../conf-core/product.mjs). The certification runner drives
// it exactly as it drives the built product — an executable/workspace
// binding and nothing else (TEST-SPEC C-2). Its one in-scope test is P-10:
// it sits with a conformer of its own because P-10's kills past the hold
// have no deterministic outcome under VIOL-CORE-EARLYRELEASE, so P-10 could
// not join CONF-CORE's in-scope set (CERTIFICATIONS.md, C-1).
import { runXspec } from "../conf-core/product.mjs";

const code = await runXspec(process.argv.slice(2), process.cwd(), {});
process.exit(code);
