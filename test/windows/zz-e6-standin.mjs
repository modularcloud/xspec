// TEMPORARY (Phase 9 FIX_PLAN Task 48): the scratch stand-in of the task,
// committed only for one Windows CI run (zz-e6-exclusion-standin.test.ts)
// and removed by the next commit — never part of the harness.
// Usage: node zz-e6-standin.mjs <mode> <binJs> <argv...>
// Models SPEC 13.5's lock directory around the built product (which keeps
// its own lock in the temporary folder): an acquiring invocation (rename and
// move other than --preview, review create/resolve/split) creates `.xspec`
// where absent, removes a plain file at `.xspec/lock`, creates the lock
// directory where absent, adds its entry `<pid>-<16 hex>` (empty), lists the
// lock directory, refuses with the 14.26 usage error (exit 2; under --json
// the error document on stdout) when another entry's recorded pid is alive
// (process.kill(pid, 0)), else removes every other occupant and runs the
// product (stdio inherited, so a held product holds this process too); on
// the product's exit (and on a refusal) it releases: deletes its entry, the
// lock directory when empty, and `.xspec` when it created it and it is empty.
// Modes (one deviation each):
//   conform    the model above
//   noentry    no lock directory model at all (as the built product)
//   alive      every other entry judged alive
//   dead       every other entry judged dead (never refuses)
//   noremove   leftovers never removed
//   keep       no release on any normal end
//   keepmove   no release after a file-form `move` that completes
//   keepcreate no release after `review create`
//   keepresolve no release after `review resolve`
//   wrongcode  the busy document's code null
//   wrongpath  the busy document's path ".xspec"
//   slowbusy   a busy refusal waits 40 s before exiting
//   busywrite  a busy refusal writes `stray.txt` at the root first
//   alivefirst the first rename refuses as alive (state: $E6_STANDIN_STATE)
//   adopt      a dead leftover is kept as the run's own entry (none added)
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [mode, binJs, ...argv] = process.argv.slice(2);
const cmd = argv[0];
const sub = argv[1];
const json = argv.includes("--json");
const preview = argv.includes("--preview");
const acquiring =
  ((cmd === "rename" || cmd === "move") && !preview) ||
  (cmd === "review" && ["create", "resolve", "split"].includes(sub));
const fileMove =
  cmd === "move" && !preview && argv[1] !== undefined && !argv[1].includes("#");

function findRoot() {
  let dir = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(dir, "xspec.config.ts"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function alive(pid) {
  if (mode === "alive") return true;
  if (mode === "dead") return false;
  if (mode === "alivefirst" && cmd === "rename") {
    const state = process.env.E6_STANDIN_STATE;
    if (state !== undefined && !fs.existsSync(state)) {
      fs.writeFileSync(state, "refused once\n");
      return true;
    }
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

const root = acquiring && mode !== "noentry" ? findRoot() : null;
let area = null;
let lockDir = null;
let own = null;
let createdArea = false;

function release() {
  if (own === null) return;
  try {
    fs.unlinkSync(own);
  } catch {}
  try {
    fs.rmdirSync(lockDir);
  } catch {}
  if (createdArea) {
    try {
      fs.rmdirSync(area);
    } catch {}
  }
}

if (root !== null) {
  area = path.join(root, ".xspec");
  lockDir = path.join(area, "lock");
  try {
    fs.mkdirSync(area);
    createdArea = true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  let stats = null;
  try {
    stats = fs.lstatSync(lockDir);
  } catch {}
  if (stats !== null && stats.isFile()) fs.unlinkSync(lockDir);
  try {
    fs.mkdirSync(lockDir);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  const name = `${process.pid}-${randomBytes(8).toString("hex")}`;
  own = path.join(lockDir, name);
  fs.writeFileSync(own, "", { flag: "wx" });
  const others = fs.readdirSync(lockDir).filter((other) => other !== name);
  const live = others.filter((other) => {
    const match = /^([0-9]+)-/.exec(other);
    return (
      match !== null &&
      Number(match[1]) !== process.pid &&
      alive(Number(match[1]))
    );
  });
  if (live.length > 0) {
    if (mode === "busywrite")
      fs.writeFileSync(path.join(root, "stray.txt"), "x");
    if (mode === "slowbusy")
      spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 40000)"]);
    release();
    if (json) {
      const doc = {
        error: {
          code: mode === "wrongcode" ? null : "workspace-busy",
          message: "stand-in: the workspace is busy",
          locations: [],
          path: mode === "wrongpath" ? ".xspec" : ".xspec/lock",
          identities: [],
        },
      };
      process.stdout.write(JSON.stringify(doc) + "\n");
    }
    process.stderr.write("stand-in: the workspace is busy\n");
    process.exit(2);
  }
  if (mode === "adopt" && others.length === 1) {
    fs.unlinkSync(own);
    own = path.join(lockDir, others[0]);
  } else if (mode !== "noremove") {
    for (const other of others) {
      fs.rmSync(path.join(lockDir, other), { recursive: true, force: true });
    }
  }
}

const result = spawnSync(process.execPath, [binJs, ...argv], {
  stdio: "inherit",
});
const code = result.status ?? 70;
const keep =
  mode === "keep" ||
  (mode === "keepmove" && fileMove && code === 0) ||
  (mode === "keepcreate" && cmd === "review" && sub === "create") ||
  (mode === "keepresolve" && cmd === "review" && sub === "resolve");
if (!keep) release();
process.exit(code);
