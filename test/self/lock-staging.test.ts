// Self-checks for the lock-path leftover staging and the dead-entry helper
// (helpers/lock-staging.ts; TEST-SPEC 17 preamble: internal self-tests cover
// harness machinery certification does not exercise — T13.5-10(b)'s link
// staging rides VIOL-LEFTOVER-FOLLOWLINK's certification of P-15 only
// insofar as it shares this machinery, CERTIFICATIONS.md's Exclusions;
// T13.5-10(a)-(c), (e), T13.4-12, T11.6-3, T6.6-3(c), P-15, T13.5-3, H-4,
// E-1). Asserted here, each read back with raw `lstat`, `readdir`,
// `readlink`, and reads — never through the module's own reader:
//
// - a declared tree holding every kind — directories two levels deep, plain
//   files of declared contents and modes, symbolic links to a directory
//   outside the workspace holding a file, to an outside file, and dangling
//   (its target absent from a writable outside directory), FIFOs — with
//   names beginning with `.` and names that are not valid UTF-8, staged by
//   bytes, round-trips byte-exactly (names, kinds, modes, link targets,
//   contents), its record holding exactly that state;
// - plain files with every permission removed stage at mode 0o000, refuse
//   the harness's own read (verified by the staging itself, an ineffective
//   removal a `HarnessStagingError`), and read back byte-exactly through
//   H-4's grant, their mode restored;
// - `assertStagingInPlace` catches each change in place — content, an entry
//   added or removed, a link re-pointed, a kind changed, a name that is not
//   valid UTF-8 renamed — rendering such names as hex, and ignores a mode
//   change (byte state); `assertOutsideTargetsUntouched` catches a write, an
//   addition, or a removal through any link, a dangling target created
//   included, and passes once the links alone are removed; a staged FIFO
//   lstat-checks as a FIFO, and `assertFifosIntact` fails once one is
//   replaced or removed;
// - the stagings at the lock path itself, at the area's own path, and beside
//   a lock directory's occupants create the parents they need, never
//   replace an occupant, and refuse a misplaced staging, a directory at the
//   area's path, a link to a directory holding no plain file, and a plain
//   file of the harness's own naming at the lock directory's top level
//   (T13.5-10(b)'s caution, P-15) — `copyEntryIn` carrying an entry in
//   under its exact name, content, and mode instead;
// - `killHeldRun`, through known-behavior stand-ins honoring `--test-hold`:
//   it kills a held run under T13.5-3's discipline (its group gone, its
//   hold file removed) and returns the lock directory's one entry — its
//   name bytes, content read through H-4's grant, and mode — and fails,
//   diagnosed, when the run leaves nothing at `.xspec/lock`, a plain file
//   there, several entries, an entry that is no plain file, never holds, or
//   ends on its own before the kill.
//
// The Linux leg's (FIFOs, byte names, the process list); the permission
// removals verify themselves on this process, so the test staging them
// fails as root by design (CAP_DAC_OVERRIDE reads a mode-0o000 file), never
// passing vacuously (E-1, H-9, H-11): CI runs the self project
// unprivileged, and a root sandbox runs it under `unshare --map-user` /
// `--map-group` (AGENTS.md).

import { Buffer } from "node:buffer";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import { listedAmong } from "../helpers/kill-discipline.js";
import type {
  LeftoverNode,
  StagedLeftover,
  StagingWorkspace,
} from "../helpers/lock-staging.js";
import {
  assertFifosIntact,
  assertOutsideTargetsUntouched,
  assertStagingInPlace,
  copyEntryIn,
  DEFAULT_FIFO_MODE,
  DEFAULT_FILE_MODE,
  DIRECTORY_MODE,
  killHeldRun,
  stageLeftover,
  verifyContentReadRefused,
} from "../helpers/lock-staging.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import type { ProductBinding } from "../helpers/subprocess.js";
import { TestWorkspace } from "../helpers/workspace.js";

const ascii = (text: string): Buffer => Buffer.from(text, "latin1");
const bytes = (...values: number[]): Buffer => Buffer.from(values);
/** A name that is not valid UTF-8: 0xFF and 0xFE never occur in UTF-8. */
const BYTE_NAME = bytes(0x6c, 0xff, 0xfe, 0x2e, 0x78);
/** Beginning with `.` and not valid UTF-8: a truncated two-byte sequence. */
const DOT_BYTE_NAME = bytes(0x2e, 0xc3, 0x28, 0x7a);
/** A FIFO's name that is not valid UTF-8. */
const PIPE_BYTE_NAME = bytes(0x70, 0x69, 0x70, 0x65, 0xff);
/** Ill-formed UTF-8 content: a NUL, 0xFF, a truncated two-byte sequence. */
const OPAQUE = bytes(0x00, 0xff, 0xc3, 0x28, 0x0a);
const under = (...segments: Uint8Array[]): Buffer =>
  Buffer.concat(
    segments.flatMap((segment, index) =>
      index === 0 ? [Buffer.from(segment)] : [ascii("/"), Buffer.from(segment)],
    ),
  );
const LOCK = ascii(".xspec/lock");
const hex = (value: Uint8Array): string => Buffer.from(value).toString("hex");

async function makeWorkspace(): Promise<TestWorkspace> {
  const workspace = await TestWorkspace.create();
  onTestFinished(() => workspace.dispose());
  return workspace;
}

/** The absolute byte path of a workspace-relative byte path. */
function absOf(workspace: StagingWorkspace, rel: Uint8Array): Buffer {
  return Buffer.concat([
    Buffer.from(workspace.root),
    ascii("/"),
    Buffer.from(rel),
  ]);
}

async function modeOf(target: string | Buffer): Promise<number> {
  return (await fsp.lstat(target)).mode & 0o7777;
}

async function listing(target: string | Buffer): Promise<string[]> {
  return (await fsp.readdir(target, { encoding: "buffer" }))
    .sort(Buffer.compare)
    .map(hex);
}

/** The error code an attempt rejects with, or "allowed" when it resolves. */
async function outcome(attempt: Promise<unknown>): Promise<string> {
  try {
    await attempt;
    return "allowed";
  } catch (thrown) {
    return (thrown as { code?: string }).code ?? "unknown";
  }
}

/** What a promise rejects with; null when it resolves. */
async function rejectionOf(pending: Promise<unknown>): Promise<unknown> {
  return await pending.then(
    () => null,
    (thrown: unknown) => thrown,
  );
}

/** Whether `candidate` lies outside `root`. */
function outsideOf(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative.startsWith("..") || path.isAbsolute(relative);
}

// Every kind, at depth, with `.`-names and names that are not UTF-8, and no
// plain file at the lock directory's top level (T13.5-10(b), P-15).
const EVERY_KIND: LeftoverNode = {
  kind: "dir",
  entries: [
    {
      name: ".hidden",
      node: {
        kind: "dir",
        entries: [
          {
            name: "deep",
            node: {
              kind: "dir",
              entries: [
                {
                  name: "f.txt",
                  node: { kind: "file", content: "two down\n", mode: 0o600 },
                },
              ],
            },
          },
          {
            name: "notes",
            node: { kind: "file", content: OPAQUE, mode: 0o444 },
          },
        ],
      },
    },
    {
      name: BYTE_NAME,
      node: {
        kind: "dir",
        entries: [
          { name: DOT_BYTE_NAME, node: { kind: "file", content: "x" } },
          { name: PIPE_BYTE_NAME, node: { kind: "fifo", mode: 0o600 } },
        ],
      },
    },
    { name: "dirlink", node: { kind: "symlink", target: { kind: "dir" } } },
    {
      name: ".filelink",
      node: { kind: "symlink", target: { kind: "file", content: OPAQUE } },
    },
    {
      name: "dangling",
      node: { kind: "symlink", target: { kind: "dangling" } },
    },
    { name: "fifo", node: { kind: "fifo" } },
    {
      name: "sub",
      node: {
        kind: "dir",
        entries: [
          {
            name: "custom",
            node: {
              kind: "symlink",
              target: {
                kind: "dir",
                entries: [
                  {
                    name: "a",
                    node: {
                      kind: "dir",
                      entries: [
                        { name: "b.txt", node: { kind: "file", content: "b" } },
                      ],
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    },
  ],
};

/** Every path EVERY_KIND stages, workspace-relative, as hex. */
const EVERY_KIND_PATHS: readonly Buffer[] = [
  LOCK,
  under(LOCK, ascii(".filelink")),
  under(LOCK, ascii(".hidden")),
  under(LOCK, ascii(".hidden/deep")),
  under(LOCK, ascii(".hidden/deep/f.txt")),
  under(LOCK, ascii(".hidden/notes")),
  under(LOCK, ascii("dangling")),
  under(LOCK, ascii("dirlink")),
  under(LOCK, ascii("fifo")),
  under(LOCK, BYTE_NAME),
  under(LOCK, BYTE_NAME, DOT_BYTE_NAME),
  under(LOCK, BYTE_NAME, PIPE_BYTE_NAME),
  under(LOCK, ascii("sub")),
  under(LOCK, ascii("sub/custom")),
];

test("a declared tree holding every kind, with `.`-names and names that are not valid UTF-8, round-trips byte-exactly — names, kinds, modes, link targets, contents — and its record holds exactly that state (T13.5-10(b), P-15; CONF-LEFTOVER's staging constraints)", async () => {
  const workspace = await makeWorkspace();
  const staged = await stageLeftover(workspace, ".xspec/lock", EVERY_KIND);
  const at = (...segments: Uint8Array[]): Buffer =>
    absOf(workspace, under(LOCK, ...segments));

  // Names, byte for byte, at every level; nothing else staged.
  expect(await listing(absOf(workspace, ascii(".xspec")))).toEqual([
    hex(ascii("lock")),
  ]);
  expect(await listing(at())).toEqual(
    [
      ascii(".filelink"),
      ascii(".hidden"),
      ascii("dangling"),
      ascii("dirlink"),
      ascii("fifo"),
      BYTE_NAME,
      ascii("sub"),
    ]
      .sort(Buffer.compare)
      .map(hex),
  );
  expect(await listing(at(ascii(".hidden")))).toEqual(
    [ascii("deep"), ascii("notes")].map(hex),
  );
  expect(await listing(at(ascii(".hidden/deep")))).toEqual([
    hex(ascii("f.txt")),
  ]);
  expect(await listing(at(BYTE_NAME))).toEqual(
    [DOT_BYTE_NAME, PIPE_BYTE_NAME].sort(Buffer.compare).map(hex),
  );
  expect(await listing(at(ascii("sub")))).toEqual([hex(ascii("custom"))]);

  // Kinds and modes, by lstat: never following a link.
  const kindAndMode = async (target: Buffer): Promise<[string, number]> => {
    const stats = await fsp.lstat(target);
    const kind = stats.isSymbolicLink()
      ? "symlink"
      : stats.isDirectory()
        ? "dir"
        : stats.isFile()
          ? "file"
          : stats.isFIFO()
            ? "fifo"
            : "other";
    return [kind, kind === "symlink" ? -1 : stats.mode & 0o7777];
  };
  expect(await kindAndMode(at())).toEqual(["dir", DIRECTORY_MODE]);
  expect(await kindAndMode(at(ascii(".hidden")))).toEqual([
    "dir",
    DIRECTORY_MODE,
  ]);
  expect(await kindAndMode(at(ascii(".hidden/deep")))).toEqual([
    "dir",
    DIRECTORY_MODE,
  ]);
  expect(await kindAndMode(at(ascii(".hidden/deep/f.txt")))).toEqual([
    "file",
    0o600,
  ]);
  expect(await kindAndMode(at(ascii(".hidden/notes")))).toEqual([
    "file",
    0o444,
  ]);
  expect(await kindAndMode(at(BYTE_NAME))).toEqual(["dir", DIRECTORY_MODE]);
  expect(await kindAndMode(at(BYTE_NAME, DOT_BYTE_NAME))).toEqual([
    "file",
    DEFAULT_FILE_MODE,
  ]);
  expect(await kindAndMode(at(BYTE_NAME, PIPE_BYTE_NAME))).toEqual([
    "fifo",
    0o600,
  ]);
  expect(await kindAndMode(at(ascii("fifo")))).toEqual([
    "fifo",
    DEFAULT_FIFO_MODE,
  ]);
  for (const link of ["dirlink", ".filelink", "dangling", "sub/custom"]) {
    expect((await kindAndMode(at(ascii(link))))[0], link).toBe("symlink");
  }

  // Contents, exactly.
  expect(await fsp.readFile(at(ascii(".hidden/deep/f.txt")))).toEqual(
    ascii("two down\n"),
  );
  expect(await fsp.readFile(at(ascii(".hidden/notes")))).toEqual(OPAQUE);
  expect(await fsp.readFile(at(BYTE_NAME, DOT_BYTE_NAME))).toEqual(ascii("x"));

  // Link targets: absolute, outside the workspace, each as declared.
  const targetOf = async (link: string): Promise<string> => {
    const target = await fsp.readlink(at(ascii(link)));
    expect(path.isAbsolute(target), link).toBe(true);
    expect(outsideOf(workspace.root, target), link).toBe(true);
    return target;
  };
  const dirTarget = await targetOf("dirlink");
  expect((await fsp.lstat(dirTarget)).isDirectory()).toBe(true);
  expect(await listing(dirTarget)).toEqual([hex(ascii("held.txt"))]);
  expect((await fsp.lstat(path.join(dirTarget, "held.txt"))).isFile()).toBe(
    true,
  );
  const fileTarget = await targetOf(".filelink");
  expect((await fsp.lstat(fileTarget)).isFile()).toBe(true);
  expect(await fsp.readFile(fileTarget)).toEqual(OPAQUE);
  const danglingTarget = await targetOf("dangling");
  expect(await outcome(fsp.lstat(danglingTarget))).toBe("ENOENT");
  const danglingDir = path.dirname(danglingTarget);
  expect((await fsp.lstat(danglingDir)).isDirectory()).toBe(true);
  expect(await outcome(fsp.access(danglingDir, fs.constants.W_OK))).toBe(
    "allowed",
  );
  const customTarget = await targetOf("sub/custom");
  expect(await listing(customTarget)).toEqual([hex(ascii("a"))]);
  expect(await fsp.readFile(path.join(customTarget, "a", "b.txt"))).toEqual(
    ascii("b"),
  );
  // Each link reaches a directory of its own.
  expect(
    new Set(
      [dirTarget, fileTarget, danglingTarget, customTarget].map(path.dirname),
    ).size,
  ).toBe(4);

  // The record: exactly the staged paths and their state.
  expect(staged.root).toBe(workspace.root);
  expect(staged.at).toEqual(LOCK);
  expect([...staged.tree.keys()].map((key) => hex(ascii(key))).sort()).toEqual(
    EVERY_KIND_PATHS.map(hex).sort(),
  );
  expect(
    staged.tree.get(under(LOCK, ascii(".hidden/notes")).toString("latin1")),
  ).toEqual({ kind: "file", bytes: OPAQUE, mode: 0o444 });
  expect(
    staged.tree.get(under(LOCK, ascii("dirlink")).toString("latin1")),
  ).toEqual({ kind: "symlink", target: Buffer.from(dirTarget) });
  expect(
    staged.tree.get(under(LOCK, BYTE_NAME, PIPE_BYTE_NAME).toString("latin1")),
  ).toEqual({ kind: "fifo", mode: 0o600 });
  expect(staged.fifos.map((key) => hex(ascii(key))).sort()).toEqual(
    [under(LOCK, ascii("fifo")), under(LOCK, BYTE_NAME, PIPE_BYTE_NAME)]
      .map(hex)
      .sort(),
  );
  expect(
    staged.outside.map((record) => record.target.toString()).sort(),
  ).toEqual([dirTarget, fileTarget, danglingTarget, customTarget].sort());
  expect(staged.createdParents).toEqual([".xspec"]);

  // Untouched, every check passes.
  await assertStagingInPlace(staged, "fresh staging");
  await assertOutsideTargetsUntouched(staged, "fresh staging");
  await assertFifosIntact(staged, "fresh staging");
}, 30_000);

test("plain files with every permission removed stage at mode 0o000, refuse the harness's own read — verified by the staging itself — and read back byte-exactly through H-4's grant, their mode restored (T13.5-10(b), P-15; E-1)", async () => {
  // In a lock directory, below its top level: a `.`-name and a name that is
  // not valid UTF-8.
  const workspace = await makeWorkspace();
  const staged = await stageLeftover(workspace, ".xspec/lock", {
    kind: "dir",
    entries: [
      {
        name: ".d",
        node: {
          kind: "dir",
          entries: [
            { name: ".none", node: { kind: "file", content: OPAQUE, mode: 0 } },
          ],
        },
      },
      {
        name: BYTE_NAME,
        node: {
          kind: "dir",
          entries: [
            {
              name: DOT_BYTE_NAME,
              node: { kind: "file", content: "sealed\n", mode: 0 },
            },
          ],
        },
      },
    ],
  });
  const hidden = under(LOCK, ascii(".d/.none"));
  const byteNamed = under(LOCK, BYTE_NAME, DOT_BYTE_NAME);
  for (const [rel, content] of [
    [hidden, OPAQUE],
    [byteNamed, ascii("sealed\n")],
  ] as const) {
    const abs = absOf(workspace, rel);
    expect(await modeOf(abs), hex(rel)).toBe(0);
    expect(await outcome(fsp.readFile(abs)), hex(rel)).toBe("EACCES");
    await verifyContentReadRefused(abs);
    expect(staged.tree.get(rel.toString("latin1")), hex(rel)).toEqual({
      kind: "file",
      bytes: content,
      mode: 0,
    });
  }
  // The checks read them through the grant and restore the mode at once.
  await assertStagingInPlace(staged, "permission removals");
  expect(await modeOf(absOf(workspace, hidden))).toBe(0);
  expect(await modeOf(absOf(workspace, byteNamed))).toBe(0);

  // A plain file at the lock path itself, every permission removed.
  const other = await makeWorkspace();
  const atLock = await stageLeftover(other, ".xspec/lock", {
    kind: "file",
    content: OPAQUE,
    mode: 0,
  });
  expect(await modeOf(absOf(other, LOCK))).toBe(0);
  expect(await outcome(fsp.readFile(absOf(other, LOCK)))).toBe("EACCES");
  expect(atLock.tree.get(".xspec/lock")).toEqual({
    kind: "file",
    bytes: OPAQUE,
    mode: 0,
  });

  // The verifier itself: a file the harness can read is no removal.
  const readable = path.join(other.tempRoot, "readable.txt");
  await fsp.writeFile(readable, "open");
  const ineffective = await rejectionOf(verifyContentReadRefused(readable));
  expect(ineffective).toBeInstanceOf(HarnessStagingError);
  expect((ineffective as HarnessStagingError).mode).toBe("lock-path-leftover");
  expect((ineffective as Error).message).toMatch(/privileged runner/);
  expect(ineffective).not.toBeInstanceOf(HarnessAssertionError);
}, 30_000);

/**
 * A fresh workspace holding EVERY_KIND at the lock path, `mutate` applied,
 * and what `check` then throws (null when it passes).
 */
async function afterMutation(
  mutate: (workspace: TestWorkspace, staged: StagedLeftover) => Promise<void>,
  check: (staged: StagedLeftover, context: string) => Promise<void>,
): Promise<unknown> {
  const workspace = await makeWorkspace();
  const staged = await stageLeftover(workspace, ".xspec/lock", EVERY_KIND);
  await mutate(workspace, staged);
  return await rejectionOf(check(staged, "probe"));
}

/** Expect a diagnosed failure whose message matches every pattern. */
function expectDiagnosed(thrown: unknown, ...patterns: RegExp[]): void {
  expect(thrown).toBeInstanceOf(HarnessAssertionError);
  for (const pattern of patterns) {
    expect((thrown as Error).message).toMatch(pattern);
  }
}

test("assertStagingInPlace catches each change in place — content, an entry added or removed, a link re-pointed, a kind changed, a name that is not valid UTF-8 renamed — rendering such names as hex, and ignores a mode change (H-4 byte state; T13.4-12, T13.5-10(a), (c))", async () => {
  const at = (workspace: TestWorkspace, ...segments: Uint8Array[]): Buffer =>
    absOf(workspace, under(LOCK, ...segments));
  const inPlace = assertStagingInPlace;

  expect(
    await afterMutation(async () => undefined, inPlace),
    "untouched",
  ).toBeNull();
  expect(
    await afterMutation(async (workspace) => {
      await fsp.chmod(at(workspace, ascii(".hidden/notes")), 0o600);
    }, inPlace),
    "a mode change alone",
  ).toBeNull();

  expectDiagnosed(
    await afterMutation(async (workspace) => {
      await fsp.writeFile(
        at(workspace, ascii(".hidden/deep/f.txt")),
        "edited\n",
      );
    }, inPlace),
    /changed "\.xspec\/lock\/\.hidden\/deep\/f\.txt": content changed/,
  );
  expectDiagnosed(
    await afterMutation(async (workspace) => {
      await fsp.writeFile(at(workspace, ascii(".hidden/deep/new")), "");
    }, inPlace),
    /added "\.xspec\/lock\/\.hidden\/deep\/new": plain file/,
  );
  expectDiagnosed(
    await afterMutation(async (workspace) => {
      await fsp.unlink(at(workspace, ascii("fifo")));
    }, inPlace),
    /removed "\.xspec\/lock\/fifo": was FIFO/,
  );
  expectDiagnosed(
    await afterMutation(async (workspace) => {
      const link = at(workspace, ascii("dirlink"));
      await fsp.unlink(link);
      await fsp.symlink(workspace.tempRoot, link);
    }, inPlace),
    /changed "\.xspec\/lock\/dirlink": link target changed/,
  );
  expectDiagnosed(
    await afterMutation(async (workspace) => {
      const fifo = at(workspace, BYTE_NAME, PIPE_BYTE_NAME);
      await fsp.unlink(fifo);
      await fsp.writeFile(fifo, "");
    }, inPlace),
    new RegExp(
      `changed "\\.xspec/lock/<bytes ${hex(BYTE_NAME)}>/<bytes ` +
        `${hex(PIPE_BYTE_NAME)}>": kind changed: FIFO`,
    ),
  );
  expectDiagnosed(
    await afterMutation(async (workspace) => {
      await fsp.rename(
        at(workspace, BYTE_NAME),
        at(workspace, ascii("renamed")),
      );
    }, inPlace),
    new RegExp(
      `removed "\\.xspec/lock/<bytes ${hex(BYTE_NAME)}>": was directory`,
    ),
    /added "\.xspec\/lock\/renamed": directory/,
  );
  expectDiagnosed(
    await afterMutation(async (workspace) => {
      await fsp.rm(at(workspace), { recursive: true });
    }, inPlace),
    /removed "\.xspec\/lock": was directory/,
    /removed "\.xspec\/lock\/sub\/custom": was symbolic link/,
  );
}, 60_000);

test("assertOutsideTargetsUntouched catches a write, an addition, or a removal through any link — a dangling link's target created included — and passes once the links alone are removed (SPEC 13.4, 13.5; T13.5-10(a), (b), P-15)", async () => {
  const at = (workspace: TestWorkspace, link: string): Buffer =>
    absOf(workspace, under(LOCK, ascii(link)));
  const outside = assertOutsideTargetsUntouched;

  expect(
    await afterMutation(async () => undefined, outside),
    "untouched",
  ).toBeNull();
  // A conforming removal: each link removed itself, never its target.
  const linksRemoved = await afterMutation(async (workspace) => {
    await fsp.rm(absOf(workspace, LOCK), { recursive: true });
  }, outside);
  expect(linksRemoved, "the links removed, their targets intact").toBeNull();

  expectDiagnosed(
    await afterMutation(async (workspace) => {
      await fsp.writeFile(
        path.join(at(workspace, "dirlink").toString(), "held.txt"),
        "rewritten",
      );
    }, outside),
    /changed ".*\/target\/held\.txt": content changed/,
    /the target of the link "\.xspec\/lock\/dirlink"/,
  );
  expectDiagnosed(
    await afterMutation(async (workspace) => {
      await fsp.writeFile(
        path.join(at(workspace, "sub/custom").toString(), "added"),
        "",
      );
    }, outside),
    /added ".*\/target\/added": plain file/,
    /the target of the link "\.xspec\/lock\/sub\/custom"/,
  );
  // A removal following a link into its target (VIOL-LEFTOVER-FOLLOWLINK's
  // deviation): the target emptied, then the link removed.
  expectDiagnosed(
    await afterMutation(async (workspace) => {
      const link = at(workspace, "dirlink").toString();
      await fsp.rm(path.join(link, "held.txt"));
      await fsp.unlink(link);
    }, outside),
    /removed ".*\/target\/held\.txt": was plain file/,
  );
  expectDiagnosed(
    await afterMutation(async (workspace) => {
      await fsp.appendFile(at(workspace, ".filelink"), "more");
    }, outside),
    /changed ".*\/target": content changed/,
    /the target of the link "\.xspec\/lock\/\.filelink"/,
  );
  expectDiagnosed(
    await afterMutation(async (workspace) => {
      // Written through the dangling link: its target comes into being.
      await fsp.writeFile(at(workspace, "dangling"), "through");
    }, outside),
    /added ".*\/absent": plain file/,
    /the target of the link "\.xspec\/lock\/dangling"/,
  );
}, 60_000);

test("a staged FIFO lstat-checks as a FIFO, at the lock path and inside a lock directory; assertFifosIntact fails, diagnosed, once one is replaced or removed", async () => {
  const workspace = await makeWorkspace();
  const atLock = await stageLeftover(workspace, ".xspec/lock", {
    kind: "fifo",
  });
  expect((await fsp.lstat(absOf(workspace, LOCK))).isFIFO()).toBe(true);
  expect(atLock.fifos).toEqual([".xspec/lock"]);
  expect(atLock.tree.get(".xspec/lock")).toEqual({
    kind: "fifo",
    mode: DEFAULT_FIFO_MODE,
  });
  await assertFifosIntact(atLock, "a FIFO at the lock path");
  await assertStagingInPlace(atLock, "a FIFO at the lock path");

  const other = await makeWorkspace();
  const inside = await stageLeftover(other, ".xspec/lock", {
    kind: "dir",
    entries: [{ name: PIPE_BYTE_NAME, node: { kind: "fifo" } }],
  });
  const fifo = absOf(other, under(LOCK, PIPE_BYTE_NAME));
  expect((await fsp.lstat(fifo)).isFIFO()).toBe(true);
  await assertFifosIntact([atLock, inside], "both FIFOs");

  await fsp.unlink(fifo);
  await fsp.writeFile(fifo, "");
  expectDiagnosed(
    await rejectionOf(assertFifosIntact([atLock, inside], "replaced")),
    new RegExp(`"\\.xspec/lock/<bytes ${hex(PIPE_BYTE_NAME)}>": a plain file`),
  );
  await fsp.unlink(absOf(workspace, LOCK));
  expectDiagnosed(
    await rejectionOf(assertFifosIntact(atLock, "removed")),
    /"\.xspec\/lock": nothing there/,
  );
}, 30_000);

test("stagings at the lock path itself, at the area's own path, and beside a lock directory's occupants create the parents they need and never replace an occupant; misplaced stagings, a directory at the area's path, a link to a directory holding no plain file, and a plain file of the harness's own naming at the lock directory's top level are refused (T13.5-10(a), (b), (c), (e), T13.4-12, P-15)", async () => {
  // A plain file holding garbage at the lock path of a workspace with no
  // area: `.xspec` created, the lock path itself the plain file.
  const bare = await makeWorkspace();
  const garbage = await stageLeftover(bare, ".xspec/lock", {
    kind: "file",
    content: OPAQUE,
  });
  expect(garbage.createdParents).toEqual([".xspec"]);
  expect((await fsp.lstat(absOf(bare, LOCK))).isFile()).toBe(true);
  expect(await fsp.readFile(absOf(bare, LOCK))).toEqual(OPAQUE);

  // A second staging there is refused, the occupant untouched.
  const occupied = await rejectionOf(
    stageLeftover(bare, ".xspec/lock", { kind: "fifo" }),
  );
  expect(occupied).toBeInstanceOf(Error);
  expect(occupied).not.toBeInstanceOf(HarnessAssertionError);
  expect(occupied).not.toBeInstanceOf(HarnessStagingError);
  expect((occupied as Error).message).toMatch(/is occupied/);
  await assertStagingInPlace(garbage, "after the refused staging");
  // `.xspec` occupied by a directory: no obstruction staged over it.
  expect(
    (
      (await rejectionOf(
        stageLeftover(bare, ".xspec", { kind: "fifo" }),
      )) as Error
    ).message,
  ).toMatch(/is occupied/);

  // Obstructions at the area's own path: a plain file, a symbolic link to a
  // directory holding a journal and a session, a dangling link, a FIFO.
  const obstructions: readonly [string, LeftoverNode, string][] = [
    ["a plain file", { kind: "file", content: "not an area\n" }, "file"],
    [
      "a link to a directory",
      {
        kind: "symlink",
        target: {
          kind: "dir",
          entries: [
            { name: "journal", node: { kind: "file", content: "j\n" } },
            {
              name: "reviews",
              node: {
                kind: "dir",
                entries: [
                  { name: "s.json", node: { kind: "file", content: "{}\n" } },
                ],
              },
            },
          ],
        },
      },
      "symlink",
    ],
    [
      "a dangling link",
      { kind: "symlink", target: { kind: "dangling" } },
      "symlink",
    ],
    ["a FIFO", { kind: "fifo" }, "fifo"],
  ];
  for (const [label, node, kind] of obstructions) {
    const workspace = await makeWorkspace();
    const staged = await stageLeftover(workspace, ".xspec", node);
    const stats = await fsp.lstat(path.join(workspace.root, ".xspec"));
    const seen = stats.isSymbolicLink()
      ? "symlink"
      : stats.isFIFO()
        ? "fifo"
        : stats.isFile()
          ? "file"
          : "other";
    expect(seen, label).toBe(kind);
    expect(staged.createdParents, label).toEqual([]);
    await assertStagingInPlace(staged, label);
    await assertOutsideTargetsUntouched(staged, label);
  }
  const area = await makeWorkspace();
  expect(
    (
      (await rejectionOf(
        stageLeftover(area, ".xspec", { kind: "dir" }),
      )) as Error
    ).message,
  ).toMatch(/never a directory/);
  // Nothing under an area that is no directory.
  await stageLeftover(area, ".xspec", { kind: "file" });
  expect(
    (
      (await rejectionOf(
        stageLeftover(area, ".xspec/lock", { kind: "fifo" }),
      )) as Error
    ).message,
  ).toMatch(/is a plain file, not a directory/);

  // Occupants beside what the lock directory already holds.
  const beside = await makeWorkspace();
  const first = await stageLeftover(beside, ascii(".xspec/lock/a"), {
    kind: "dir",
    entries: [{ name: "f", node: { kind: "file", content: "f" } }],
  });
  expect(first.createdParents).toEqual([".xspec", ".xspec/lock"]);
  const second = await stageLeftover(beside, under(LOCK, BYTE_NAME), {
    kind: "fifo",
  });
  expect(second.createdParents).toEqual([]);
  expect(await listing(absOf(beside, LOCK))).toEqual(
    [ascii("a"), BYTE_NAME].sort(Buffer.compare).map(hex),
  );
  await assertStagingInPlace([first, second], "beside each other");

  // Refusals, each a usage error staging nothing.
  const refusals: readonly [
    string,
    (workspace: TestWorkspace) => Promise<unknown>,
    RegExp,
  ][] = [
    [
      "a source path",
      (workspace) => stageLeftover(workspace, "specs/x", { kind: "fifo" }),
      /is neither the area's own path/,
    ],
    [
      "graph data",
      (workspace) =>
        stageLeftover(workspace, ".xspec/graph.json", { kind: "fifo" }),
      /is neither the area's own path/,
    ],
    [
      "a near-miss name",
      (workspace) => stageLeftover(workspace, ".xspec/lockx", { kind: "fifo" }),
      /is neither the area's own path/,
    ],
    [
      "two levels under the lock directory",
      (workspace) =>
        stageLeftover(workspace, ".xspec/lock/a/b", { kind: "fifo" }),
      /is no name/,
    ],
    [
      "a plain file at the lock directory's top level",
      (workspace) =>
        stageLeftover(workspace, ".xspec/lock/x", { kind: "file" }),
      /harness's own naming at the lock directory's top level.*T13\.5-10\(b\), P-15/,
    ],
    [
      "a plain file at the top level of a staged lock directory",
      (workspace) =>
        stageLeftover(workspace, ".xspec/lock", {
          kind: "dir",
          entries: [
            { name: "d", node: { kind: "dir" } },
            { name: "x", node: { kind: "file" } },
          ],
        }),
      /harness's own naming at the lock directory's top level/,
    ],
    [
      "a link to a directory holding no plain file",
      (workspace) =>
        stageLeftover(workspace, ".xspec/lock", {
          kind: "dir",
          entries: [
            {
              name: "l",
              node: {
                kind: "symlink",
                target: {
                  kind: "dir",
                  entries: [{ name: "d", node: { kind: "dir" } }],
                },
              },
            },
          ],
        }),
      /must hold at least one plain file/,
    ],
    [
      "a name declared twice",
      (workspace) =>
        stageLeftover(workspace, ".xspec/lock", {
          kind: "dir",
          entries: [
            { name: "d", node: { kind: "dir" } },
            { name: "d", node: { kind: "fifo" } },
          ],
        }),
      /declares the name "d" twice/,
    ],
  ];
  for (const [label, attempt, pattern] of refusals) {
    const workspace = await makeWorkspace();
    const thrown = await rejectionOf(attempt(workspace));
    expect(thrown, label).toBeInstanceOf(Error);
    expect(thrown, label).not.toBeInstanceOf(HarnessAssertionError);
    expect(thrown, label).not.toBeInstanceOf(HarnessStagingError);
    expect((thrown as Error).message, label).toMatch(pattern);
    // Judged before anything was made: nothing staged, no area created.
    expect(await listing(workspace.root), label).toEqual([]);
    expect(await listing(workspace.tempRoot), label).toEqual([
      hex(ascii("work")),
    ]);
  }
}, 60_000);

test("copyEntryIn carries an entry in under its exact name, content, and mode — creating the lock directory where absent, beside what it holds — and its record checks like any staging's (T13.5-10(c), (b); H-4)", async () => {
  const workspace = await makeWorkspace();
  const entry = { name: BYTE_NAME, content: OPAQUE, mode: 0o600 };
  const copied = await copyEntryIn(workspace, entry);
  expect(copied.createdParents).toEqual([".xspec", ".xspec/lock"]);
  const abs = absOf(workspace, under(LOCK, BYTE_NAME));
  expect((await fsp.lstat(abs)).isFile()).toBe(true);
  expect(await modeOf(abs)).toBe(0o600);
  expect(await fsp.readFile(abs)).toEqual(OPAQUE);
  expect(await listing(absOf(workspace, LOCK))).toEqual([hex(BYTE_NAME)]);

  // A second entry, the product's mode withholding every permission: no
  // permission removal is verified (the mode is the product's own), and its
  // content reads back through the grant.
  const sealed = {
    name: ascii("run.42.x"),
    content: ascii("42\n"),
    mode: 0,
  };
  const second = await copyEntryIn(workspace, sealed);
  expect(second.createdParents).toEqual([]);
  expect(await modeOf(absOf(workspace, under(LOCK, sealed.name)))).toBe(0);
  expect(second.tree.get(under(LOCK, sealed.name).toString("latin1"))).toEqual({
    kind: "file",
    bytes: sealed.content,
    mode: 0,
  });
  await assertStagingInPlace([copied, second], "copied entries");

  // Never over an occupant; an altered entry fails the in-place check.
  expect(
    ((await rejectionOf(copyEntryIn(workspace, entry))) as Error).message,
  ).toMatch(/is occupied/);
  await fsp.writeFile(abs, "altered");
  expectDiagnosed(
    await rejectionOf(assertStagingInPlace(copied, "altered")),
    new RegExp(
      `changed "\\.xspec/lock/<bytes ${hex(BYTE_NAME)}>": content changed`,
    ),
  );
}, 30_000);

// A known-behavior stand-in honoring `--test-hold <path>` (SPEC 13.5's seam)
// in the workspace it runs in. Its mode — the binding's first argument —
// picks what it leaves at `.xspec/lock` before creating its hold file:
// `entry`, one entry, a plain file named `run.<pid>` and a byte that is not
// UTF-8, holding `<pid>\n`, every permission removed; `none`, nothing;
// `file-at-lock`, a plain file at the lock path; `two`, two entries;
// `dir-entry`, one entry that is a directory. Each then idles until killed.
// `exit-early` exits 3 without holding; `exit-after-hold` leaves an entry
// and exits 0 at once, its hold file created a moment later by a process of
// another session that keeps the run's streams open meanwhile — so the hold
// file appears while the run has ended on its own, never killed.
const HOLD_STANDIN_SOURCE = `import { spawn } from "node:child_process";
import fs from "node:fs";

const [mode, ...args] = process.argv.slice(2);
const flag = args.indexOf("--test-hold");
const hold = flag >= 0 ? args[flag + 1] : undefined;
const lock = ".xspec/lock";
const idle = () => setInterval(() => {}, 60000);
const entry = (suffix, entryMode) => {
  fs.mkdirSync(lock, { recursive: true });
  const name = Buffer.concat([
    Buffer.from(lock + "/run." + String(process.pid) + suffix, "latin1"),
    Buffer.from([0xff]),
  ]);
  fs.writeFileSync(name, String(process.pid) + "\\n");
  fs.chmodSync(name, entryMode);
};
const held = () => {
  fs.writeFileSync(hold, "");
  idle();
};
switch (mode) {
  case "entry":
    entry("", 0);
    held();
    break;
  case "none":
    held();
    break;
  case "file-at-lock":
    fs.mkdirSync(".xspec", { recursive: true });
    fs.writeFileSync(lock, "not a directory");
    held();
    break;
  case "two":
    entry(".a", 0o600);
    entry(".b", 0o600);
    held();
    break;
  case "dir-entry":
    fs.mkdirSync(lock + "/run." + String(process.pid), { recursive: true });
    held();
    break;
  case "exit-early":
    process.exit(3);
    break;
  case "exit-after-hold":
    entry("", 0o600);
    spawn("sh", ["-c", 'sleep 0.3 && : > "$1" && sleep 0.5', "sh", hold], {
      detached: true,
      stdio: ["ignore", "inherit", "inherit"],
    }).unref();
    process.exit(0);
    break;
  default:
    process.stderr.write("unknown mode: " + String(mode));
    process.exit(99);
}
`;

/** The stand-in, staged once per test, bound in `mode`. */
async function holdStandin(): Promise<(mode: string) => ProductBinding> {
  const home = await TestWorkspace.create({
    files: { "standin.mjs": HOLD_STANDIN_SOURCE },
  });
  onTestFinished(() => home.dispose());
  return (mode) => ({
    label: `lock-staging stand-in (${mode})`,
    command: process.execPath,
    prefixArgs: [home.path("standin.mjs"), mode],
  });
}

const RENAME_ARGV = ["rename", "specs/A.mdx", "a", "a2", "--json"] as const;

test("killHeldRun kills a held run under T13.5-3's discipline — its group gone, its hold file removed — and returns the lock directory's one entry, its exact name bytes, its content read through H-4's grant, and its mode (T13.5-3, T13.5-10(b), (c))", async () => {
  const bind = await holdStandin();
  const workspace = await makeWorkspace();
  const holdPath = path.join(workspace.tempRoot, "dead.hold");
  const dead = await killHeldRun(bind("entry"), {
    root: workspace.root,
    argv: RENAME_ARGV,
    holdPath,
    context: "stand-in (entry)",
  });
  const pid = dead.killed.groupId;
  expect(dead.killed.result.signal).toBe("SIGKILL");
  expect(dead.killed.identifiers).toContain(pid);
  expect(await listedAmong(dead.killed.identifiers)).toEqual([]);
  expect(await outcome(fsp.lstat(holdPath))).toBe("ENOENT");
  const name = Buffer.concat([ascii(`run.${String(pid)}`), bytes(0xff)]);
  expect(hex(dead.entry.name)).toBe(hex(name));
  expect(dead.entry.content).toEqual(ascii(`${String(pid)}\n`));
  expect(dead.entry.mode).toBe(0);
  // The entry stays in place, its mode the product's again.
  const abs = absOf(workspace, under(LOCK, name));
  expect(await modeOf(abs)).toBe(0);
  expect(await listing(absOf(workspace, LOCK))).toEqual([hex(name)]);

  // Carried into another workspace's lock directory, name and content.
  const other = await makeWorkspace();
  const copied = await copyEntryIn(other, dead.entry);
  expect(await modeOf(absOf(other, under(LOCK, name)))).toBe(0);
  expect(copied.tree.get(under(LOCK, name).toString("latin1"))).toEqual({
    kind: "file",
    bytes: dead.entry.content,
    mode: 0,
  });
}, 60_000);

test("killHeldRun fails, diagnosed, when the killed run leaves nothing at .xspec/lock, a plain file there, several entries, or an entry that is no plain file, and when the run never holds or ends on its own before the kill (SPEC 13.5; T13.5-3)", async () => {
  const bind = await holdStandin();
  const cases: readonly [string, RegExp][] = [
    ["none", /found nothing at \.xspec\/lock$/],
    ["file-at-lock", /found a plain file at \.xspec\/lock$/],
    [
      "two",
      // A name that is not valid UTF-8 renders as its hex: `run.<pid>.a`
      // and a 0xFF byte.
      /found 2 entries: "<bytes 72756e2e[0-9a-f]+2e61ff>", "<bytes 72756e2e[0-9a-f]+2e62ff>"$/,
    ],
    ["dir-entry", /its one entry "run\.\d+" is a directory, no plain file$/],
    ["exit-early", /must create its hold file .*exited before creating/],
    ["exit-after-hold", /ended on its own before the kill — exit code 0/],
  ];
  for (const [mode, pattern] of cases) {
    const workspace = await makeWorkspace();
    const holdPath = path.join(workspace.tempRoot, `${mode}.hold`);
    const thrown = await rejectionOf(
      killHeldRun(bind(mode), {
        root: workspace.root,
        argv: RENAME_ARGV,
        holdPath,
        context: `stand-in (${mode})`,
      }),
    );
    expect(thrown, mode).toBeInstanceOf(HarnessAssertionError);
    expect((thrown as Error).message, mode).toMatch(
      new RegExp(`^stand-in \\(${mode}\\): `),
    );
    expect((thrown as Error).message, mode).toMatch(pattern);
    // The hold file never outlives the helper.
    expect(await outcome(fsp.lstat(holdPath)), mode).toBe("ENOENT");
  }

  // Usage: the hold path lies outside the workspace and is unoccupied.
  const workspace = await makeWorkspace();
  const inside = await rejectionOf(
    killHeldRun(bind("none"), {
      root: workspace.root,
      argv: RENAME_ARGV,
      holdPath: path.join(workspace.root, "hold"),
      context: "inside",
    }),
  );
  expect(inside).not.toBeInstanceOf(HarnessAssertionError);
  expect((inside as Error).message).toMatch(/must be absolute and lie outside/);
  const occupiedHold = path.join(workspace.tempRoot, "taken.hold");
  await fsp.writeFile(occupiedHold, "");
  const taken = await rejectionOf(
    killHeldRun(bind("none"), {
      root: workspace.root,
      argv: RENAME_ARGV,
      holdPath: occupiedHold,
      context: "occupied",
    }),
  );
  expect((taken as Error).message).toMatch(/is occupied/);
}, 120_000);
