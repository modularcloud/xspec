// TEMPORARY (FIX_PLAN Task 37 Windows-leg probe; removed in the next commit):
// a copy of the scratch stand-in t9j2_37/relinv.mjs, never part of the harness.
// Usage: node zz-t9j2-37-relinv.mjs <mode> <binJs> <argv...>
// Spawns the real built product (binJs) with the invocation's argv, cwd,
// environment, and stdin; stderr passes through; stdout is captured whole.
// Where stdout parses as an inventory document (one JSON object carrying
// graphData, journal, and sessions), `lock` is set to ".xspec/lock" when
// absent (the inventory-lock stand-in's insertion), then the mode's one
// deviation is applied — to every answer whose `root` is not "." (a run
// away from the workspace root) unless the mode says "every answer" — and
// the document is re-serialized (two-space JSON, trailing newline). The exit
// code (or signal) is the product's.
// Modes:
//   lock         nothing further (the conforming reference)
//   rellock      lock relativized to the working directory (<root>/.xspec/lock)
//   relall       every path member relativized: sources, derived, recorded,
//                graphData, journal.path, sessions, lock
//   relgraph     graphData relativized
//   relsources   sources[].path relativized
//   relderived   derived[] source/module/markdown relativized
//   relrecorded  recorded[] relativized
//   reljournal   journal.path relativized
//   relsessions  sessions[] relativized
//   relconfig    configuration.specs[].globs relativized
//   cwdjournal   journal.occupied false (occupancy judged against the cwd)
//   cwdsessions  sessions [] (the session directory listed against the cwd)
//   cwdrecorded  recorded [] (the record read against the cwd)
//   vacuous      every answer: recorded [], journal unoccupied, sessions []
//   nomarkdown   every answer: derived[].markdown null
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const MODES = [
  "lock",
  "rellock",
  "relall",
  "relgraph",
  "relsources",
  "relderived",
  "relrecorded",
  "reljournal",
  "relsessions",
  "relconfig",
  "cwdjournal",
  "cwdsessions",
  "cwdrecorded",
  "vacuous",
  "nomarkdown",
];
const [mode, binJs, ...argv] = process.argv.slice(2);
if (!MODES.includes(mode) || typeof binJs !== "string") {
  process.stderr.write(`relinv: bad mode or binJs: ${String(mode)}\n`);
  process.exit(99);
}
const child = spawnSync(process.execPath, [binJs, ...argv], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["inherit", "pipe", "inherit"],
  maxBuffer: 1024 * 1024 * 1024,
});
if (child.error) {
  process.stderr.write(`relinv: spawn failed: ${String(child.error)}\n`);
  process.exit(98);
}
let out = child.stdout ?? Buffer.alloc(0);
let doc;
try {
  doc = JSON.parse(out.toString("utf8"));
} catch {
  doc = undefined;
}
const isInventory =
  doc !== null &&
  typeof doc === "object" &&
  !Array.isArray(doc) &&
  Object.hasOwn(doc, "graphData") &&
  Object.hasOwn(doc, "journal") &&
  Object.hasOwn(doc, "sessions");
if (isInventory) {
  if (!Object.hasOwn(doc, "lock")) doc.lock = ".xspec/lock";
  const away = typeof doc.root === "string" && doc.root !== ".";
  const rel = (p) => (typeof p === "string" ? `${doc.root}/${p}` : p);
  const everyAnswer = mode === "vacuous" || mode === "nomarkdown";
  if (away || everyAnswer) {
    const all = mode === "relall";
    if (mode === "rellock" || all) doc.lock = rel(doc.lock);
    if (mode === "relgraph" || all) doc.graphData = rel(doc.graphData);
    if (mode === "relsources" || all) {
      doc.sources = doc.sources.map((s) => ({ ...s, path: rel(s.path) }));
    }
    if (mode === "relderived" || all) {
      doc.derived = doc.derived.map((d) => ({
        ...d,
        source: rel(d.source),
        module: d.module === null ? null : rel(d.module),
        markdown: d.markdown === null ? null : rel(d.markdown),
      }));
    }
    if ((mode === "relrecorded" || all) && Array.isArray(doc.recorded)) {
      doc.recorded = doc.recorded.map(rel);
    }
    if (mode === "reljournal" || all) {
      doc.journal = { ...doc.journal, path: rel(doc.journal.path) };
    }
    if (mode === "relsessions" || all) doc.sessions = doc.sessions.map(rel);
    if (mode === "relconfig") {
      doc.configuration = {
        ...doc.configuration,
        specs: doc.configuration.specs.map((g) => ({
          ...g,
          globs: g.globs.map(rel),
        })),
      };
    }
    if (mode === "cwdjournal")
      doc.journal = { ...doc.journal, occupied: false };
    if (mode === "cwdsessions") doc.sessions = [];
    if (mode === "cwdrecorded") doc.recorded = [];
    if (mode === "vacuous") {
      doc.recorded = [];
      doc.journal = { ...doc.journal, occupied: false };
      doc.sessions = [];
    }
    if (mode === "nomarkdown") {
      doc.derived = doc.derived.map((d) => ({ ...d, markdown: null }));
    }
  }
  out = Buffer.from(`${JSON.stringify(doc, null, 2)}\n`, "utf8");
}
let offset = 0;
while (offset < out.length) {
  try {
    offset += fs.writeSync(1, out, offset, out.length - offset);
  } catch (error) {
    if (error && error.code === "EAGAIN") continue;
    throw error;
  }
}
if (child.signal) {
  process.kill(process.pid, child.signal);
}
process.exit(child.status ?? 70);
