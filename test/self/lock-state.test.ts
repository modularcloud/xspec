// Self-checks for the held-state comparison and the lock-state assertions
// (helpers/lock-state.ts; TEST-SPEC 17 preamble: internal self-tests cover
// harness machinery certification does not exercise; TEST-SPEC §13.5's
// preamble, H-4, H-6; CERTIFICATIONS.md: CONF-CORE's justification — both
// halves of the held-state comparison — VIOL-CORE-READERENTRY's note, and
// the Exclusions entry for T13.5-9 through T13.5-12 and T13.4-12: one
// machinery for every held inspection and every lock-path inclusion). Over
// synthetic trees, no product run: the harness itself writes what a held
// run's acquisition would — `.xspec/lock` holding a plain-file entry — and
// checks, each failure a diagnosed `HarnessAssertionError`, each misuse a
// plain error:
//
// - the count half: an entry present (its name bytes, content, and mode
//   returned), absent, or doubled; the lock path missing or no directory; a
//   directory, a symbolic link (to a directory or to a plain file, never
//   followed), or a FIFO in the lock directory counted as no entry, failing
//   beside the entries unless the harness staged it;
// - the byte half: a change to `.xspec/graph.json`, to another path in
//   `.xspec`, to a source, or under a nested root's lock path caught — the
//   root's lock path alone excluded, never the area whole; `.xspec` itself
//   accepted as new only where the baseline had none; a baseline retaken
//   during the hold; the lock path never walked, so a directory there the
//   harness cannot list fails the count half, diagnosed, never the walk;
// - occupants the harness staged in the lock directory (a dead run's entry
//   copied in, a directory, a FIFO, a link) counted apart from entries and
//   required in place, a change or a removal caught;
// - a mode-0o000 entry read through H-4's grant, its mode restored; an
//   entry's identity across a span (name and content, its mode aside); the
//   lock directory's only entry; two runs' entries named apart;
// - the lock path absent; the lock path holding exactly a given tree;
// - the inclusion check around a command acquiring nothing.
//
// The Linux leg's (FIFOs, names that are not valid UTF-8, permission
// removals). The mode-0o000 entry's refused read and the `-wx` directory's
// refused listing are verified on this process before they are relied on,
// so those two tests fail as root by design (CAP_DAC_OVERRIDE reads and
// lists through any mode), never passing vacuously (E-1, H-11).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import type { LockEntry, StagedLeftover } from "../helpers/lock-staging.js";
import {
  copyEntryIn,
  stageLeftover,
  verifyContentReadRefused,
} from "../helpers/lock-staging.js";
import type { LockPathContents } from "../helpers/lock-state.js";
import {
  assertEntriesNamedApart,
  assertEntryUnchanged,
  assertHeldState,
  assertLockDirectoryEntries,
  assertLockPathAbsent,
  assertLockPathAsCaptured,
  assertLockPathHolds,
  assertLockPathUntouchedAround,
  assertOnlyEntry,
  captureLockPath,
} from "../helpers/lock-state.js";
import { snapshotDirectory } from "../helpers/snapshot.js";
import { TestWorkspace } from "../helpers/workspace.js";

const ascii = (text: string): Buffer => Buffer.from(text, "latin1");
const bytes = (...values: number[]): Buffer => Buffer.from(values);
const hex = (value: Uint8Array): string => Buffer.from(value).toString("hex");
/** An entry's name that is not valid UTF-8: 0xFF never occurs in UTF-8. */
const ODD_NAME = bytes(0x72, 0x75, 0x6e, 0xff, 0x31);
/** Its rendering in a diagnosis, as a regular-expression source. */
const ODD_SHOWN = `"\\.xspec/lock/<bytes ${hex(ODD_NAME)}>"`;
/** Opaque entry content: a NUL, 0xFF, a truncated two-byte sequence. */
const OPAQUE = bytes(0x00, 0xff, 0xc3, 0x28, 0x0a);

/** A built workspace's files: a source, and graph data and a journal. */
const BUILT: Readonly<Record<string, string>> = {
  "specs/a.txt": "source\n",
  ".xspec/graph.json": '{"g":1}\n',
  ".xspec/journal": "j\n",
};

/** A directory holding a file, a FIFO, and a link to an outside directory. */
const LEFTOVER_TREE = {
  kind: "dir",
  entries: [
    {
      name: "d",
      node: {
        kind: "dir",
        entries: [{ name: "f", node: { kind: "file", content: "f\n" } }],
      },
    },
    { name: "pipe", node: { kind: "fifo" } },
    { name: "link", node: { kind: "symlink", target: { kind: "dir" } } },
  ],
} as const;

async function makeWorkspace(
  files: Readonly<Record<string, string>> = BUILT,
): Promise<TestWorkspace> {
  const workspace = await TestWorkspace.create({ files: { ...files } });
  onTestFinished(() => workspace.dispose());
  return workspace;
}

/** The absolute byte path of `.xspec/lock/<name>` in the workspace. */
function entryPath(workspace: TestWorkspace, name: Uint8Array): Buffer {
  return Buffer.concat([
    Buffer.from(workspace.path(".xspec/lock")),
    ascii("/"),
    Buffer.from(name),
  ]);
}

/**
 * The product's side, as a held run's acquisition leaves it: an entry, a
 * plain file of `content` and `mode` in `.xspec/lock`, its parents created.
 */
async function writeEntry(
  workspace: TestWorkspace,
  name: Uint8Array,
  content: Uint8Array = OPAQUE,
  mode = 0o600,
): Promise<Buffer> {
  await fsp.mkdir(workspace.path(".xspec/lock"), { recursive: true });
  const abs = entryPath(workspace, name);
  await fsp.writeFile(abs, content, { flag: "wx", mode: 0o600 });
  await fsp.chmod(abs, mode);
  return abs;
}

async function modeOf(target: string | Buffer): Promise<number> {
  return (await fsp.lstat(target)).mode & 0o7777;
}

/** What a promise rejects with; null when it resolves. */
async function rejectionOf(pending: Promise<unknown>): Promise<unknown> {
  return await pending.then(
    () => null,
    (thrown: unknown) => thrown,
  );
}

/** What a call throws; null when it returns. */
function thrownBy(call: () => void): unknown {
  try {
    call();
    return null;
  } catch (thrown) {
    return thrown;
  }
}

/** Expect a diagnosed failure whose message matches every pattern. */
function expectDiagnosed(thrown: unknown, ...patterns: RegExp[]): void {
  expect(thrown).toBeInstanceOf(HarnessAssertionError);
  for (const pattern of patterns) {
    expect((thrown as Error).message).toMatch(pattern);
  }
}

/** Expect a misuse: a plain error, never a diagnosed failure. */
function expectMisuse(thrown: unknown, pattern: RegExp): void {
  expect(thrown).toBeInstanceOf(Error);
  expect(thrown).not.toBeInstanceOf(HarnessAssertionError);
  expect((thrown as Error).message).toMatch(pattern);
}

test("the count half: exactly one plain-file entry per held run, returned with its name bytes, content, and mode; an entry absent or doubled, the lock path missing or no directory, and a directory, a symbolic link, or a FIFO beside the entries each fail, diagnosed, none counted as an entry unless the harness staged it (TEST-SPEC §13.5's preamble; SPEC 13.5)", async () => {
  const workspace = await makeWorkspace();
  const baseline = await snapshotDirectory(workspace.root);
  const lockPath = workspace.path(".xspec/lock");
  const held = (
    heldRuns: number,
    staged: readonly StagedLeftover[] = [],
  ): Promise<unknown> =>
    rejectionOf(
      assertHeldState(workspace.root, { baseline, heldRuns, staged }, "probe"),
    );
  const countHalf =
    /probe \(the held-state comparison's count half\): \.xspec\/lock must be a directory holding exactly 1 entry, each a plain file, and nothing else — one per held run whose entry stands/;

  expectDiagnosed(await held(1), countHalf, /found nothing at \.xspec\/lock$/);
  await fsp.writeFile(lockPath, "x\n");
  expectDiagnosed(await held(1), /found a plain file at \.xspec\/lock$/);
  await fsp.unlink(lockPath);
  await fsp.symlink(workspace.tempRoot, lockPath);
  expectDiagnosed(await held(1), /found a symbolic link at \.xspec\/lock$/);
  await fsp.unlink(lockPath);
  await fsp.mkdir(lockPath);
  expectDiagnosed(await held(1), countHalf, /found no entry$/);
  expect(await held(0)).toBeNull();

  // A directory, symbolic links to a directory and to a plain file (never
  // followed: T13.5-10(e)'s replacing occupants), and a FIFO: no entries.
  const others = [
    await stageLeftover(
      workspace,
      ".xspec/lock/d",
      LEFTOVER_TREE.entries[0].node,
    ),
    await stageLeftover(workspace, ".xspec/lock/filelink", {
      kind: "symlink",
      target: { kind: "file", content: "x\n" },
    }),
    await stageLeftover(workspace, ".xspec/lock/link", {
      kind: "symlink",
      target: { kind: "dir" },
    }),
    await stageLeftover(workspace, ".xspec/lock/pipe", { kind: "fifo" }),
  ];
  expectDiagnosed(
    await held(1),
    /found no entry, and beside the entries:/,
    /"\.xspec\/lock\/d": a directory — no entry \(an entry is a plain file\), and nothing the harness staged/,
    /"\.xspec\/lock\/filelink": a symbolic link — no entry/,
    /"\.xspec\/lock\/link": a symbolic link — no entry/,
    /"\.xspec\/lock\/pipe": a FIFO — no entry/,
  );
  expectDiagnosed(await held(0), /found no entry, and beside the entries:/);
  expect(await held(0, others)).toBeNull();
  expectDiagnosed(
    await held(1, others),
    /besides the occupants the harness staged there \("\.xspec\/lock\/d", "\.xspec\/lock\/filelink", "\.xspec\/lock\/link", "\.xspec\/lock\/pipe"\), exactly 1 entry/,
    /found no entry$/,
  );

  // One entry: returned exactly, name bytes, content, and mode.
  await writeEntry(workspace, ODD_NAME, OPAQUE, 0o640);
  const entries = await assertHeldState(
    workspace.root,
    { baseline, heldRuns: 1, staged: others },
    "probe",
  );
  expect(entries.map((entry) => hex(entry.name))).toEqual([hex(ODD_NAME)]);
  expect(entries.map((entry) => hex(entry.content))).toEqual([hex(OPAQUE)]);
  expect(entries.map((entry) => entry.mode)).toEqual([0o640]);
  expectDiagnosed(
    await held(1),
    new RegExp(`found 1 entry \\(${ODD_SHOWN}\\), and beside the entries:`),
  );
  expectDiagnosed(
    await held(2, others),
    /exactly 2 entries/,
    new RegExp(`found 1 entry \\(${ODD_SHOWN}\\)$`),
  );

  // Doubled: two plain files where one run is held.
  await writeEntry(workspace, ascii("second"), ascii("2\n"));
  expectDiagnosed(
    await held(1, others),
    new RegExp(`found 2 entries \\(${ODD_SHOWN}, "\\.xspec/lock/second"\\)$`),
  );
  expect(
    (
      await assertHeldState(
        workspace.root,
        { baseline, heldRuns: 2, staged: others },
        "probe",
      )
    ).map((entry) => hex(entry.name)),
  ).toEqual([hex(ODD_NAME), hex(ascii("second"))]);

  // The count half alone, as a residue's check takes it (T13.5-11).
  await fsp.unlink(entryPath(workspace, ascii("second")));
  const residue = await assertLockDirectoryEntries(
    workspace.root,
    { entries: 1, staged: others },
    "probe",
  );
  expect(residue.map((entry) => hex(entry.name))).toEqual([hex(ODD_NAME)]);
  expectDiagnosed(
    await rejectionOf(
      assertLockDirectoryEntries(workspace.root, { entries: 1 }, "probe"),
    ),
    /SPEC 13\.5: each run's entry is a plain file in the lock directory; anything else there is no entry; found 1 entry/,
  );

  // Many entries: the first ten named, the rest counted.
  for (let index = 0; index < 11; index += 1) {
    await writeEntry(workspace, ascii(`x${String(index).padStart(2, "0")}`));
  }
  expectDiagnosed(
    await held(1, others),
    new RegExp(
      `found 12 entries \\(${ODD_SHOWN}, "\\.xspec/lock/x00", .*"\\.xspec/lock/x08", … and 2 more\\)$`,
    ),
  );

  // Misuse: no count of entries.
  expectMisuse(await held(-1), /-1 is no number of entries/);
  expectMisuse(await held(1.5), /1\.5 is no number of entries/);
}, 60_000);

test("the byte half excludes the root's lock path alone: a change to `.xspec/graph.json`, to another path in `.xspec`, to a source, or under a nested root's lock path is caught; `.xspec` itself is accepted as new only where the baseline had none, and nothing more under it; a baseline retaken during the hold serves (TEST-SPEC §13.5's preamble; CERTIFICATIONS.md CONF-CORE's justification)", async () => {
  const workspace = await makeWorkspace();
  const baseline = await snapshotDirectory(workspace.root);
  await writeEntry(workspace, ascii("entry"));
  const held = (from = baseline): Promise<unknown> =>
    rejectionOf(
      assertHeldState(workspace.root, { baseline: from, heldRuns: 1 }, "probe"),
    );
  const byteHalf =
    /probe: the held-state comparison's byte half — every workspace path but the lock path \.xspec\/lock and everything under it — must be byte-identical/;
  expect(await held()).toBeNull();

  const graph = workspace.path(".xspec/graph.json");
  await fsp.writeFile(graph, '{"g":2}\n');
  expectDiagnosed(
    await held(),
    byteHalf,
    /1 difference\(s\), the graph-data area compared like every other path:\n {2}- changed \.xspec\/graph\.json: file bytes differ/,
  );
  await fsp.writeFile(graph, '{"g":1}\n');
  await fsp.rm(workspace.path(".xspec/journal"));
  expectDiagnosed(await held(), /removed \.xspec\/journal: was file/);
  await fsp.writeFile(workspace.path(".xspec/journal"), "j\n");
  for (const rel of [".xspec/lockx", ".xspec/extra", "specs/b.txt"]) {
    await fsp.writeFile(workspace.path(rel), "x\n");
    expectDiagnosed(
      await held(),
      new RegExp(`added ${rel.replaceAll(".", "\\.")}: file`),
    );
    await fsp.rm(workspace.path(rel));
  }
  await fsp.writeFile(workspace.path("specs/a.txt"), "edited\n");
  expectDiagnosed(await held(), /changed specs\/a\.txt: file bytes differ/);
  await fsp.writeFile(workspace.path("specs/a.txt"), "source\n");
  await fsp.mkdir(workspace.path("in/.xspec/lock"), { recursive: true });
  await fsp.writeFile(workspace.path("in/.xspec/lock/e"), "e\n");
  expectDiagnosed(await held(), /added in\/\.xspec\/lock\/e: file/);
  await fsp.rm(workspace.path("in"), { recursive: true });
  expect(await held()).toBeNull();

  // Retaken during the hold: whatever the baseline holds under the lock
  // path is ignored — another run's entry there now, the first gone.
  const retaken = await snapshotDirectory(workspace.root);
  await fsp.unlink(entryPath(workspace, ascii("entry")));
  await writeEntry(workspace, ascii("later"));
  expect(await held(retaken)).toBeNull();

  // `.xspec` absent before: acquisition creates it, and nothing else in it.
  const unbuilt = await makeWorkspace({ "specs/a.txt": "source\n" });
  const fresh = await snapshotDirectory(unbuilt.root);
  await writeEntry(unbuilt, ascii("entry"));
  const heldUnbuilt = (): Promise<unknown> =>
    rejectionOf(
      assertHeldState(unbuilt.root, { baseline: fresh, heldRuns: 1 }, "probe"),
    );
  expect(await heldUnbuilt()).toBeNull();
  await fsp.writeFile(unbuilt.path(".xspec/graph.json"), "{}\n");
  expectDiagnosed(
    await heldUnbuilt(),
    /the lock path \.xspec\/lock and everything under it — and \.xspec itself, a directory, which the invocation found absent and acquisition creates — must be byte-identical/,
    /added \.xspec\/graph\.json: file/,
  );

  // `.xspec` present before, an obstruction: never excluded then.
  const obstructed = await makeWorkspace({
    "specs/a.txt": "source\n",
    ".xspec": "obstruction\n",
  });
  const blocked = await snapshotDirectory(obstructed.root);
  await fsp.rm(obstructed.path(".xspec"));
  await writeEntry(obstructed, ascii("entry"));
  expectDiagnosed(
    await rejectionOf(
      assertHeldState(
        obstructed.root,
        { baseline: blocked, heldRuns: 1 },
        "probe",
      ),
    ),
    byteHalf,
    /changed \.xspec: kind changed: file → dir/,
  );

  // Misuse: a baseline of another directory.
  expectMisuse(
    await held(fresh),
    /assertHeldState: the baseline is a snapshot of .*, not of the workspace/,
  );
}, 60_000);

test("occupants the harness staged in the lock directory — a dead run's entry copied in, a directory holding a file, a FIFO, a symbolic link — are counted apart from the entries and required in place: a change to one, or its removal, is caught (TEST-SPEC §13.5's preamble; T13.5-10(c), (e))", async () => {
  const workspace = await makeWorkspace();
  const baseline = await snapshotDirectory(workspace.root);
  await writeEntry(workspace, ODD_NAME);
  const staged: StagedLeftover[] = [
    await copyEntryIn(workspace, {
      name: ascii("dead"),
      content: ascii("12345\n"),
      mode: 0o600,
    }),
    await stageLeftover(
      workspace,
      ".xspec/lock/d",
      LEFTOVER_TREE.entries[0].node,
    ),
    await stageLeftover(workspace, ".xspec/lock/pipe", { kind: "fifo" }),
    await stageLeftover(workspace, ".xspec/lock/link", {
      kind: "symlink",
      target: { kind: "dir" },
    }),
  ];
  const held = (declared: readonly StagedLeftover[]): Promise<unknown> =>
    rejectionOf(
      assertHeldState(
        workspace.root,
        { baseline, heldRuns: 1, staged: declared },
        "probe",
      ),
    );
  const entries = await assertHeldState(
    workspace.root,
    { baseline, heldRuns: 1, staged },
    "probe",
  );
  expect(entries.map((entry) => hex(entry.name))).toEqual([hex(ODD_NAME)]);

  // Undeclared, the copied-in entry is a second entry, the rest beside them.
  expectDiagnosed(
    await held([]),
    /found 2 entries \("\.xspec\/lock\/dead", /,
    /"\.xspec\/lock\/d": a directory — no entry/,
    /"\.xspec\/lock\/link": a symbolic link — no entry/,
    /"\.xspec\/lock\/pipe": a FIFO — no entry/,
  );
  const inPlace =
    /probe \(the held-state comparison's count half\): what the harness staged at or under the lock path \(or at the area's own path\) is no longer byte-identical in place/;
  const file = workspace.path(".xspec/lock/d/f");
  await fsp.writeFile(file, "edited\n");
  expectDiagnosed(
    await held(staged),
    inPlace,
    /changed "\.xspec\/lock\/d\/f": content changed/,
  );
  await fsp.writeFile(file, "f\n");
  const dead = workspace.path(".xspec/lock/dead");
  await fsp.writeFile(dead, "54321\n");
  expectDiagnosed(
    await held(staged),
    inPlace,
    /changed "\.xspec\/lock\/dead": content changed/,
  );
  await fsp.writeFile(dead, "12345\n");
  expect(await held(staged)).toBeNull();
  await fsp.unlink(workspace.path(".xspec/lock/pipe"));
  expectDiagnosed(
    await held(staged),
    inPlace,
    /removed "\.xspec\/lock\/pipe": was FIFO/,
  );

  // Misuse: a staging at the lock path itself, another workspace's.
  const other = await makeWorkspace();
  const whole = await stageLeftover(other, ".xspec/lock", { kind: "dir" });
  expectMisuse(
    await rejectionOf(
      assertHeldState(
        other.root,
        {
          baseline: await snapshotDirectory(other.root),
          heldRuns: 0,
          staged: [whole],
        },
        "probe",
      ),
    ),
    /the staging at "\.xspec\/lock" is no occupant of the lock directory/,
  );
  expectMisuse(await held([whole]), /lies outside the workspace/);
}, 60_000);

test("a mode-0o000 entry is read through H-4's grant, its mode restored; an entry's identity across a span — name and content, its mode aside — and the lock directory's only entry are checked, and two runs' entries named apart (H-4; SPEC 13.5; E-1)", async () => {
  const workspace = await makeWorkspace();
  const baseline = await snapshotDirectory(workspace.root);
  const abs = await writeEntry(workspace, ODD_NAME, OPAQUE, 0o000);
  // E-1: the removal refuses this process's own read (fails as root).
  await verifyContentReadRefused(abs);
  const [entry] = await assertHeldState(
    workspace.root,
    { baseline, heldRuns: 1 },
    "probe",
  );
  if (entry === undefined) throw new Error("no entry returned");
  expect(hex(entry.name)).toBe(hex(ODD_NAME));
  expect(hex(entry.content)).toBe(hex(OPAQUE));
  expect(entry.mode).toBe(0o000);
  expect(await modeOf(abs)).toBe(0o000);
  await assertEntryUnchanged(workspace.root, entry, "probe");
  await assertOnlyEntry(workspace.root, entry, "probe");
  expect(await modeOf(abs)).toBe(0o000);

  const unchanged = (): Promise<unknown> =>
    rejectionOf(assertEntryUnchanged(workspace.root, entry, "probe"));
  const only = (): Promise<unknown> =>
    rejectionOf(assertOnlyEntry(workspace.root, entry, "probe"));
  const identity = new RegExp(
    `probe: the entry ${ODD_SHOWN} must stand unchanged — a plain file under the same name, its content byte-identical`,
  );

  // A mode change alone is none (modes aside).
  await fsp.chmod(abs, 0o644);
  expect(await unchanged()).toBeNull();
  expect(await only()).toBeNull();

  // Its content altered in place.
  await fsp.writeFile(abs, "altered\n");
  expectDiagnosed(await unchanged(), identity, /; its content changed:\n/);
  expectDiagnosed(
    await only(),
    new RegExp(
      `the entry ${ODD_SHOWN}, \\.xspec/lock's one entry, must keep its content byte-identical`,
    ),
  );
  await fsp.writeFile(abs, OPAQUE);

  // Another entry beside it: still standing, no longer the only one.
  const second = await writeEntry(workspace, ascii("second"));
  expect(await unchanged()).toBeNull();
  expectDiagnosed(
    await only(),
    new RegExp(
      `\\.xspec/lock must be a directory holding exactly 1 entry, each a plain file, and nothing else — the entry ${ODD_SHOWN} its only one`,
    ),
    /found 2 entries/,
  );
  await fsp.unlink(second);

  // Renamed: gone under its name, another entry in its place.
  const renamed = workspace.path(".xspec/lock/renamed");
  await fsp.rename(abs, renamed);
  expectDiagnosed(
    await unchanged(),
    identity,
    /; nothing is there now — a directory is at \.xspec\/lock, holding "\.xspec\/lock\/renamed"$/,
  );
  expectDiagnosed(
    await only(),
    new RegExp(`\\.xspec/lock's one entry must be ${ODD_SHOWN}`),
    /its one entry is "\.xspec\/lock\/renamed"$/,
  );

  // Replaced under its name by a directory.
  await fsp.unlink(renamed);
  await fsp.mkdir(abs);
  expectDiagnosed(await unchanged(), identity, /; a directory is there now$/);
  expectDiagnosed(await only(), /found no entry, and beside the entries:/);
  await fsp.rm(abs, { recursive: true });
  expectDiagnosed(
    await unchanged(),
    /; nothing is there now — an empty directory is at \.xspec\/lock$/,
  );

  // Two runs' entries: named apart, or not.
  expect(
    thrownBy(() => assertEntriesNamedApart(entry, ascii("other"), "probe")),
  ).toBeNull();
  expect(
    thrownBy(() =>
      assertEntriesNamedApart(
        ODD_NAME,
        Buffer.concat([ODD_NAME, ascii("x")]),
        "probe",
      ),
    ),
  ).toBeNull();
  expectDiagnosed(
    thrownBy(() =>
      assertEntriesNamedApart(entry, Buffer.from(ODD_NAME), "probe"),
    ),
    /probe: two runs' entries must bear byte-different names/,
    new RegExp(`both are named ${ODD_SHOWN}$`),
  );
}, 60_000);

test("the lock path absent — `.xspec` absent or no directory included — and the lock path holding exactly a given tree: stagings as staged and entries by name and content (a mode-0o000 one read through the grant), nothing added beside them (SPEC 13.5; T13.5-11, T13.4-12, T13.5-10(c))", async () => {
  const workspace = await makeWorkspace({ "specs/a.txt": "source\n" });
  const area = workspace.path(".xspec");
  const lockPath = workspace.path(".xspec/lock");
  const absent = (): Promise<unknown> =>
    rejectionOf(assertLockPathAbsent(workspace.root, "probe"));
  const rule =
    /probe: nothing must be at \.xspec\/lock once every run has ended \(SPEC 13\.5: release deletes the run's entry, then the emptied lock directory/;

  expect(await absent()).toBeNull();
  await fsp.writeFile(area, "obstruction\n");
  expect(await absent()).toBeNull();
  await fsp.rm(area);
  await fsp.mkdir(lockPath, { recursive: true });
  expectDiagnosed(
    await absent(),
    rule,
    /but an empty directory is at \.xspec\/lock$/,
  );
  await writeEntry(workspace, ascii("left"));
  expectDiagnosed(
    await absent(),
    /but a directory is at \.xspec\/lock, holding "\.xspec\/lock\/left"$/,
  );
  await fsp.rm(lockPath, { recursive: true });
  expect(await absent()).toBeNull();
  await fsp.symlink(path.join(workspace.tempRoot, "nowhere"), lockPath);
  expectDiagnosed(await absent(), /but a symbolic link is at \.xspec\/lock$/);
  await fsp.unlink(lockPath);
  await fsp.writeFile(lockPath, "garbage\n");
  expectDiagnosed(await absent(), /but a plain file is at \.xspec\/lock$/);
  await fsp.unlink(lockPath);

  // Exactly a staged lock directory's tree.
  const staged = await stageLeftover(workspace, ".xspec/lock", LEFTOVER_TREE);
  const holds = (expected: LockPathContents): Promise<unknown> =>
    rejectionOf(assertLockPathHolds(workspace.root, expected, "probe"));
  const exactly =
    /probe: \.xspec\/lock must hold exactly what is expected there — each staging as staged, each entry by name and content/;
  expect(await holds({ staged: [staged] })).toBeNull();
  await fsp.writeFile(workspace.path(".xspec/lock/added"), "");
  expectDiagnosed(
    await holds({ staged: [staged] }),
    exactly,
    /added "\.xspec\/lock\/added": plain file/,
  );
  await fsp.unlink(workspace.path(".xspec/lock/added"));
  await fsp.writeFile(workspace.path(".xspec/lock/d/f"), "g\n");
  expectDiagnosed(
    await holds({ staged: [staged] }),
    /changed "\.xspec\/lock\/d\/f": content changed/,
  );
  await fsp.writeFile(workspace.path(".xspec/lock/d/f"), "f\n");

  // A dead run's entry beside it, mode 0o000: expected by name and content.
  const dead: LockEntry = {
    name: Buffer.from(ODD_NAME),
    content: ascii("dead\n"),
    mode: 0o600,
  };
  const deadAbs = await writeEntry(workspace, dead.name, dead.content, 0o000);
  expectDiagnosed(
    await holds({ staged: [staged] }),
    new RegExp(`added ${ODD_SHOWN}: plain file`),
  );
  expect(await holds({ staged: [staged], entries: [dead] })).toBeNull();
  expect(await modeOf(deadAbs)).toBe(0o000);
  expectDiagnosed(
    await holds({
      staged: [staged],
      entries: [{ ...dead, content: ascii("other\n") }],
    }),
    new RegExp(`changed ${ODD_SHOWN}: content changed`),
  );
  await fsp.rm(lockPath, { recursive: true });
  expectDiagnosed(
    await holds({ staged: [staged], entries: [dead] }),
    /removed "\.xspec\/lock": was directory/,
    new RegExp(`removed ${ODD_SHOWN}: was plain file`),
  );

  // A plain file staged at the lock path itself, then a directory there.
  const plain = await stageLeftover(workspace, ".xspec/lock", {
    kind: "file",
    content: OPAQUE,
  });
  expect(await holds({ staged: [plain] })).toBeNull();
  await fsp.unlink(lockPath);
  await fsp.mkdir(lockPath);
  expectDiagnosed(
    await holds({ staged: [plain] }),
    /changed "\.xspec\/lock": kind changed: plain file/,
  );

  // Misuse: nothing expected; a conflict; a staging outside the lock path.
  expectMisuse(await holds({}), /nothing is expected at the lock path/);
  expectMisuse(
    await holds({ staged: [plain], entries: [dead] }),
    /"\.xspec\/lock" is expected twice/,
  );
  const obstructed = await makeWorkspace({ "specs/a.txt": "source\n" });
  const obstruction = await stageLeftover(obstructed, ".xspec", {
    kind: "file",
    content: "x\n",
  });
  expectMisuse(
    await rejectionOf(
      assertLockPathHolds(obstructed.root, { staged: [obstruction] }, "probe"),
    ),
    /the staging at "\.xspec" lies outside the lock path \.xspec\/lock/,
  );
}, 60_000);

test("the inclusion check around a command acquiring nothing: whatever occupied the lock path before — nothing, a leftover, a held run's entry (mode 0o000 read through the grant), nothing under an obstruction at `.xspec` — occupies it afterwards byte-identical, nothing added beside it; an addition, a removal, or a change is caught, a mode change alone is none (H-6; SPEC 13.4; T13.4-12, T13.5-4)", async () => {
  const workspace = await makeWorkspace();
  const lockPath = workspace.path(".xspec/lock");
  const around = (action: () => Promise<void>): Promise<unknown> =>
    rejectionOf(assertLockPathUntouchedAround(workspace.root, action, "probe"));

  expect(
    await assertLockPathUntouchedAround(workspace.root, () => 42, "probe"),
  ).toBe(42);
  // A reader laying out the lock directory and leaving it.
  expectDiagnosed(
    await around(async () => {
      await fsp.mkdir(lockPath);
    }),
    /probe: nothing occupied the lock path \.xspec\/lock before, so nothing may occupy it afterwards: a command that acquires nothing makes no write there \(H-6; SPEC 13\.4/,
    /added "\.xspec\/lock": directory/,
  );
  // That directory left, a reader adding an entry in it.
  expectDiagnosed(
    await around(async () => {
      await writeEntry(workspace, ascii("reader"));
    }),
    /probe: whatever occupied the lock path \.xspec\/lock before — a leftover or a held run's entry — must occupy it afterwards byte-identical/,
    /added "\.xspec\/lock\/reader": plain file/,
  );
  await fsp.rm(lockPath, { recursive: true });

  // A leftover tree: untouched, it passes; a removal is caught.
  await stageLeftover(workspace, ".xspec/lock", LEFTOVER_TREE);
  expect(await around(async () => undefined)).toBeNull();
  expectDiagnosed(
    await around(async () => {
      await fsp.rm(workspace.path(".xspec/lock/d"), { recursive: true });
    }),
    /removed "\.xspec\/lock\/d": was directory/,
    /removed "\.xspec\/lock\/d\/f": was plain file/,
  );
  await fsp.rm(lockPath, { recursive: true });

  // A held run's entry, mode 0o000.
  const abs = await writeEntry(workspace, ODD_NAME, OPAQUE, 0o000);
  const capture = await captureLockPath(workspace.root);
  expect(await modeOf(abs)).toBe(0o000);
  await assertLockPathAsCaptured(capture, "probe");
  expect(await modeOf(abs)).toBe(0o000);
  await fsp.chmod(abs, 0o600);
  await assertLockPathAsCaptured(capture, "probe");
  await fsp.writeFile(abs, "changed\n");
  expectDiagnosed(
    await rejectionOf(assertLockPathAsCaptured(capture, "probe")),
    new RegExp(`changed ${ODD_SHOWN}: content changed`),
    /captured: 5 bytes/,
  );
  await fsp.unlink(abs);
  expectDiagnosed(
    await rejectionOf(assertLockPathAsCaptured(capture, "probe")),
    new RegExp(`removed ${ODD_SHOWN}: was plain file`),
  );

  // An obstruction at `.xspec`: nothing at the lock path before or after.
  const obstructed = await makeWorkspace({ ".xspec": "obstruction\n" });
  expect(
    await rejectionOf(
      assertLockPathUntouchedAround(
        obstructed.root,
        async () => undefined,
        "probe",
      ),
    ),
  ).toBeNull();
  expect((await captureLockPath(obstructed.root)).tree.size).toBe(0);
}, 60_000);

test("the byte half never walks the lock path: a directory there that the harness cannot list (mode -wx, verified first) fails the count half, diagnosed, when nothing staged it — never a harness error at the walk — and, declared staged, its in-place check is refused until the test restores its mode (TEST-SPEC §13.5's preamble; T13.5-10(c)'s -wx leftovers; E-1)", async () => {
  const workspace = await makeWorkspace();
  const baseline = await snapshotDirectory(workspace.root);
  await writeEntry(workspace, ascii("entry"));
  const left = await stageLeftover(
    workspace,
    ".xspec/lock/left",
    LEFTOVER_TREE.entries[0].node,
  );
  const dir = workspace.path(".xspec/lock/left");
  const held = (staged: readonly StagedLeftover[]): Promise<unknown> =>
    rejectionOf(
      assertHeldState(
        workspace.root,
        { baseline, heldRuns: 1, staged },
        "probe",
      ),
    );
  await fsp.chmod(dir, 0o300);
  try {
    // E-1: the harness's own listing is refused (as root it is not).
    const listing = (await rejectionOf(fsp.readdir(dir))) as {
      code?: string;
    } | null;
    expect(listing?.code).toBe("EACCES");
    expectDiagnosed(
      await held([]),
      /found 1 entry \("\.xspec\/lock\/entry"\), and beside the entries:\n {2}- "\.xspec\/lock\/left": a directory — no entry/,
    );
    expectMisuse(
      await held([left]),
      /cannot list .* a test restores its own staging's permissions before inspecting it/,
    );
  } finally {
    await fsp.chmod(dir, 0o755);
  }
  expect(await held([left])).toBeNull();
}, 60_000);
