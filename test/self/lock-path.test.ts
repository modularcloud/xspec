// Self-checks for the lock-path primitives (TEST-SPEC 17 preamble: internal
// self-tests cover harness machinery certification does not exercise; H-4,
// H-6; SPEC 13.4, 13.5). `test/helpers/lock-path.ts` names the lock path
// `.xspec/lock`, matches it and everything under it for H-6's exclusion, and
// grants the harness a read or write that a plain file's own mode refuses
// there, restoring the exact prior mode at once (H-4); the snapshot walk
// (helpers/snapshot.ts) reads lock-path files through that grant. Asserted
// here: the predicate's vectors in both directions and the exclusion's reach
// in a snapshot; and, on the Linux leg, run unprivileged, that a plain file
// at or under the lock path whose mode refuses the owner's read snapshots
// byte-complete and keeps its exact mode; that a refused read anywhere else,
// and a refused listing under the lock path, still throws, the mode
// untouched; that a grant adds the one owner bit alone and restores the
// prior mode when the access under it throws; and that the read, in-place
// write, and copy helpers keep that discipline. Each staging is first
// verified to refuse this process's own plain access, so a privileged runner
// (root: CAP_DAC_OVERRIDE) fails these tests by design, never passing them
// vacuously (H-9, H-11); CI runs the self project unprivileged, and a root
// sandbox runs it under `unshare --map-user`/`--map-group` (AGENTS.md).

import { Buffer } from "node:buffer";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import { expect, onTestFinished, test } from "vitest";
import {
  copyLockPathFile,
  EXCLUDE_LOCK_PATH,
  excludingLockPath,
  isLockPathBytes,
  isLockPathKey,
  LOCK_PATH,
  readLockPathFile,
  withOwnerGrant,
  writeLockPathFile,
} from "../helpers/lock-path.js";
import { snapshotDirectory } from "../helpers/snapshot.js";
import { TestWorkspace } from "../helpers/workspace.js";

const onLinux = process.platform === "linux";

const ascii = (text: string): Buffer => Buffer.from(text, "latin1");
const bytes = (...values: number[]): Buffer => Buffer.from(values);
/** An entry name that is not valid UTF-8 (0xFF never occurs in UTF-8). */
const BYTE_NAME = bytes(0x65, 0xff, 0xfe, 0x2e, 0x31);
/** Ill-formed UTF-8 content: a NUL, 0xFF, a truncated two-byte sequence. */
const OPAQUE = bytes(0x00, 0xff, 0xc3, 0x28, 0x0a);
const under = (...segments: Uint8Array[]): Buffer =>
  Buffer.concat(
    segments.flatMap((segment, index) =>
      index === 0 ? [segment] : [ascii("/"), segment],
    ),
  );

async function makeWorkspace(
  files: Record<string, string | Uint8Array> = {},
): Promise<TestWorkspace> {
  const workspace = await TestWorkspace.create({ files });
  onTestFinished(() => workspace.dispose());
  return workspace;
}

async function modeOf(target: string | Buffer): Promise<number> {
  return (await fsp.lstat(target)).mode & 0o7777;
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

/** Stage `mode` on `target`, verifying it refuses this process's read. */
async function stageUnreadable(
  target: string | Buffer,
  mode: number,
): Promise<void> {
  await fsp.chmod(target, mode);
  expect(await outcome(fsp.readFile(target))).toBe("EACCES");
}

test("the lock-path predicate matches exactly `.xspec/lock` and everything under it, never a sibling, a prefix, or a nested root's (H-6)", () => {
  expect(LOCK_PATH).toBe(".xspec/lock");
  const inside: readonly Buffer[] = [
    ascii(".xspec/lock"),
    ascii(".xspec/lock/x"),
    ascii(".xspec/lock/a/b"),
    ascii(".xspec/lock/.hidden"),
    under(ascii(".xspec/lock"), BYTE_NAME),
    under(ascii(".xspec/lock"), BYTE_NAME, ascii("f")),
  ];
  const outside: readonly Buffer[] = [
    ascii(""),
    ascii(".xspec"),
    ascii(".xspec/"),
    ascii(".xspec/loc"),
    ascii(".xspec/lockx"),
    ascii(".xspec/lock.tmp"),
    ascii(".xspec/locks/e"),
    ascii(".xspec/Lock"),
    ascii(".XSPEC/lock"),
    ascii(".xspec/journal"),
    ascii(".xspec/reviews/s"),
    ascii(".xspec/graph.json"),
    ascii("lock"),
    ascii("xspec/lock"),
    ascii("x/.xspec/lock"),
    ascii("x/.xspec/lock/e"),
    ascii(".xspec\\lock"),
    Buffer.concat([ascii(".xspec/lock"), bytes(0xff)]),
  ];
  for (const rel of inside) {
    expect(isLockPathBytes(rel), rel.toString("hex")).toBe(true);
    expect(isLockPathKey(rel.toString("latin1")), rel.toString("hex")).toBe(
      true,
    );
  }
  for (const rel of outside) {
    expect(isLockPathBytes(rel), rel.toString("hex")).toBe(false);
    expect(isLockPathKey(rel.toString("latin1")), rel.toString("hex")).toBe(
      false,
    );
  }
  // The ready options exclude the lock path alone; the combinator adds it to
  // a caller's own exclusion, keeping both and adding nothing else.
  const isGit = (rel: Uint8Array): boolean =>
    Buffer.from(rel).toString("latin1") === ".git";
  const combined = excludingLockPath({ exclude: isGit });
  const alone = excludingLockPath();
  for (const rel of [...inside, ...outside, ascii(".git")]) {
    const lock = inside.includes(rel);
    const git = rel.toString("latin1") === ".git";
    expect(EXCLUDE_LOCK_PATH.exclude?.(rel), rel.toString("hex")).toBe(lock);
    expect(alone.exclude?.(rel), rel.toString("hex")).toBe(lock);
    expect(combined.exclude?.(rel), rel.toString("hex")).toBe(lock || git);
  }
});

test("a snapshot includes the lock path by default and, under EXCLUDE_LOCK_PATH, omits exactly it and everything under it (H-6)", async () => {
  const workspace = await makeWorkspace({
    ".xspec/lock/e1": "entry",
    ".xspec/lock/d/f": "leftover",
    ".xspec/lockx": "x",
    ".xspec/lock.tmp": "t",
    ".xspec/graph.json": "{}\n",
    "x/.xspec/lock/e": "nested root's entry",
    ".git/index": "machine state",
  });
  await fsp.writeFile(
    workspace.bytePath(under(ascii(".xspec/lock"), BYTE_NAME)),
    OPAQUE,
  );
  const whole = [...(await snapshotDirectory(workspace.root)).entries.keys()];
  const lockKeys = [
    ".xspec/lock",
    ".xspec/lock/d",
    ".xspec/lock/d/f",
    ".xspec/lock/e1",
    under(ascii(".xspec/lock"), BYTE_NAME).toString("latin1"),
  ];
  for (const key of lockKeys) expect(whole).toContain(key);
  const excluded = [
    ...(
      await snapshotDirectory(workspace.root, EXCLUDE_LOCK_PATH)
    ).entries.keys(),
  ];
  expect(excluded).toEqual(whole.filter((key) => !lockKeys.includes(key)));
  for (const kept of [
    ".xspec",
    ".xspec/lockx",
    ".xspec/lock.tmp",
    ".xspec/graph.json",
    "x/.xspec/lock",
    "x/.xspec/lock/e",
  ]) {
    expect(excluded).toContain(kept);
  }
  const withGit = [
    ...(
      await snapshotDirectory(
        workspace.root,
        excludingLockPath({
          exclude: (rel) => Buffer.from(rel).toString("latin1") === ".git",
        }),
      )
    ).entries.keys(),
  ];
  expect(withGit).toEqual(
    excluded.filter((key) => key !== ".git" && key !== ".git/index"),
  );
});

test.runIf(onLinux)(
  "H-4: plain files at and under the lock path whose own mode refuses the owner's read snapshot byte-complete, each keeping its exact mode",
  async () => {
    const workspace = await makeWorkspace({
      ".xspec/lock/w": "group and others may read; the owner may not\n",
      ".xspec/lock/d/f": "a leftover tree's file\n",
      ".xspec/graph.json": "{}\n",
    });
    const entry = workspace.bytePath(under(ascii(".xspec/lock"), BYTE_NAME));
    await fsp.writeFile(entry, OPAQUE);
    const staged: readonly [string | Buffer, number][] = [
      [entry, 0o000],
      [workspace.path(".xspec/lock/d/f"), 0o200],
      [workspace.path(".xspec/lock/w"), 0o044],
    ];
    for (const [target, mode] of staged) await stageUnreadable(target, mode);
    const snapshot = await snapshotDirectory(workspace.root);
    const expected: readonly [string, Uint8Array][] = [
      [under(ascii(".xspec/lock"), BYTE_NAME).toString("latin1"), OPAQUE],
      [".xspec/lock/d/f", ascii("a leftover tree's file\n")],
      [
        ".xspec/lock/w",
        ascii("group and others may read; the owner may not\n"),
      ],
      [".xspec/graph.json", ascii("{}\n")],
    ];
    for (const [key, content] of expected) {
      const captured = snapshot.entries.get(key);
      expect(captured?.kind, key).toBe("file");
      if (captured?.kind !== "file") continue;
      expect(Buffer.from(captured.bytes).equals(content), key).toBe(true);
    }
    for (const [target, mode] of staged) {
      expect(await modeOf(target)).toBe(mode);
    }
    // The test's own read through the helper: the same bytes, the same mode.
    expect(
      (
        await readLockPathFile(
          workspace.root,
          under(ascii(".xspec/lock"), BYTE_NAME),
        )
      ).equals(OPAQUE),
    ).toBe(true);
    expect(await modeOf(entry)).toBe(0o000);

    // A plain file at the lock path itself (a leftover, 13.5).
    const fileAtLockPath = await makeWorkspace({ ".xspec/lock": OPAQUE });
    await stageUnreadable(fileAtLockPath.path(".xspec/lock"), 0o000);
    const atSnapshot = await snapshotDirectory(fileAtLockPath.root);
    const captured = atSnapshot.entries.get(".xspec/lock");
    expect(captured?.kind).toBe("file");
    if (captured?.kind === "file") {
      expect(Buffer.from(captured.bytes).equals(OPAQUE)).toBe(true);
    }
    expect(await modeOf(fileAtLockPath.path(".xspec/lock"))).toBe(0o000);
  },
);

test.runIf(onLinux)(
  "H-4: a refused read outside the lock path still throws EACCES, its mode untouched — a sibling, a prefix, a nested root's lock path, graph data, a file elsewhere",
  async () => {
    const outside = [
      ".xspec/graph.json",
      ".xspec/lockx",
      ".xspec/lock.tmp",
      "x/.xspec/lock/e",
      "specs/a.txt",
    ];
    const workspace = await makeWorkspace({
      ...Object.fromEntries(outside.map((rel) => [rel, "bytes\n"])),
      ".xspec/lock/e": "entry",
    });
    for (const rel of outside) {
      const target = workspace.path(rel);
      await stageUnreadable(target, 0o000);
      expect(await outcome(snapshotDirectory(workspace.root)), rel).toBe(
        "EACCES",
      );
      expect(await modeOf(target), rel).toBe(0o000);
      await fsp.chmod(target, 0o644);
    }
  },
);

test.runIf(onLinux)(
  "H-4: a directory under the lock path whose listing is refused is never granted — the snapshot throws EACCES and the mode stays as staged",
  async () => {
    const workspace = await makeWorkspace({
      ".xspec/lock/e": "entry",
      ".xspec/lock/d/f": "leftover",
    });
    const stagings: readonly [string, number][] = [
      [".xspec/lock", 0o100],
      [".xspec/lock/d", 0o300],
      [".xspec/lock/d", 0o000],
    ];
    for (const [rel, mode] of stagings) {
      const target = workspace.path(rel);
      await fsp.chmod(target, mode);
      onTestFinished(() => fsp.chmod(target, 0o755));
      expect(await outcome(fsp.readdir(target)), rel).toBe("EACCES");
      expect(await outcome(snapshotDirectory(workspace.root)), rel).toBe(
        "EACCES",
      );
      expect(await modeOf(target), rel).toBe(mode);
      await fsp.chmod(target, 0o755);
    }
  },
);

test.runIf(onLinux)(
  "H-4: withOwnerGrant adds the owner's bit for the one access alone, restores the exact prior mode even when the access under the grant throws, and grants nothing for other failures",
  async () => {
    const workspace = await makeWorkspace({ ".xspec/lock/e": "entry" });
    const target = workspace.path(".xspec/lock/e");
    const cases: readonly ["read" | "write", number, number][] = [
      ["read", 0o000, 0o400],
      ["read", 0o244, 0o644],
      ["write", 0o000, 0o200],
      ["write", 0o444, 0o644],
    ];
    for (const [access, prior, granted] of cases) {
      await fsp.chmod(target, prior);
      const failure = new Error(`synthetic failure under the ${access} grant`);
      let attempts = 0;
      let seen = -1;
      const thrown = await withOwnerGrant(target, access, async () => {
        attempts += 1;
        if (attempts === 1) {
          // The real access, refused by the file's own mode.
          if (access === "read") await fsp.readFile(target);
          else await (await fsp.open(target, fs.constants.O_WRONLY)).close();
          return "unrefused";
        }
        seen = await modeOf(target);
        throw failure;
      }).catch((error: unknown) => error);
      expect(thrown, `${access} ${prior.toString(8)}`).toBe(failure);
      expect(attempts).toBe(2);
      expect(seen).toBe(granted);
      expect(await modeOf(target)).toBe(prior);
    }
    // A successful access under the grant returns its value, mode restored.
    await fsp.chmod(target, 0o000);
    const read = await withOwnerGrant(target, "read", () =>
      fsp.readFile(target, "utf8"),
    );
    expect(read).toBe("entry");
    expect(await modeOf(target)).toBe(0o000);
    // A failure that is no permission refusal is never retried.
    let calls = 0;
    const missing = workspace.path(".xspec/lock/absent");
    expect(
      await outcome(
        withOwnerGrant(missing, "read", () => {
          calls += 1;
          return fsp.readFile(missing);
        }),
      ),
    ).toBe("ENOENT");
    expect(calls).toBe(1);
    // A refusal with the owner's bit already set is retried once, unchanged.
    await fsp.chmod(target, 0o644);
    calls = 0;
    const modesSeen: number[] = [];
    const value = await withOwnerGrant(target, "read", async () => {
      calls += 1;
      modesSeen.push(await modeOf(target));
      if (calls === 1) {
        throw Object.assign(new Error("synthetic refusal"), { code: "EACCES" });
      }
      return "retried";
    });
    expect(value).toBe("retried");
    expect(modesSeen).toEqual([0o644, 0o644]);
    // A refusal at a directory is never granted: it propagates, mode kept.
    const dir = workspace.path(".xspec/lock");
    await fsp.chmod(dir, 0o300);
    onTestFinished(() => fsp.chmod(dir, 0o755));
    expect(
      await outcome(withOwnerGrant(dir, "read", () => fsp.readdir(dir))),
    ).toBe("EACCES");
    expect(await modeOf(dir)).toBe(0o300);
    await fsp.chmod(dir, 0o755);
  },
);

test.runIf(onLinux)(
  "H-4: writeLockPathFile alters an entry's content in place under the grant — same file, mode restored — and refuses any path but the lock path's plain files",
  async () => {
    const workspace = await makeWorkspace({
      ".xspec/lock/e": "entry content",
      ".xspec/lockx": "a sibling",
      ".xspec/graph.json": "{}\n",
      "outside.txt": "a link's target\n",
    });
    await fsp.symlink("../../outside.txt", workspace.path(".xspec/lock/link"));
    const target = workspace.path(".xspec/lock/e");
    const inode = (await fsp.lstat(target)).ino;
    await fsp.chmod(target, 0o000);
    expect(await outcome(fsp.open(target, "r+"))).toBe("EACCES");
    for (const content of [new Uint8Array(0), OPAQUE, ascii("x".repeat(40))]) {
      await writeLockPathFile(workspace.root, ".xspec/lock/e", content);
      expect(await modeOf(target)).toBe(0o000);
      expect((await fsp.lstat(target)).ino).toBe(inode);
      expect(
        (await readLockPathFile(workspace.root, ".xspec/lock/e")).equals(
          Buffer.from(content),
        ),
      ).toBe(true);
    }
    // Refusals: outside the lock path, a malformed path, an absent entry (none
    // created), a symbolic link (never written through).
    for (const rel of [".xspec/lockx", ".xspec/lock/../graph.json"]) {
      await expect(
        writeLockPathFile(workspace.root, rel, OPAQUE),
      ).rejects.toThrow(/is not \.xspec\/lock or a path under it/);
    }
    expect(await fsp.readFile(workspace.path(".xspec/lockx"), "utf8")).toBe(
      "a sibling",
    );
    expect(
      await fsp.readFile(workspace.path(".xspec/graph.json"), "utf8"),
    ).toBe("{}\n");
    expect(
      await outcome(
        writeLockPathFile(workspace.root, ".xspec/lock/absent", OPAQUE),
      ),
    ).toBe("ENOENT");
    expect(await outcome(fsp.lstat(workspace.path(".xspec/lock/absent")))).toBe(
      "ENOENT",
    );
    await expect(
      writeLockPathFile(workspace.root, ".xspec/lock/link", OPAQUE),
    ).rejects.toThrow(/holds no plain file/);
    expect(await fsp.readFile(workspace.path("outside.txt"), "utf8")).toBe(
      "a link's target\n",
    );
  },
);

test.runIf(onLinux)(
  "H-4: copyLockPathFile copies an entry's exact bytes and mode under the grant, the source's mode restored, never replacing an occupant",
  async () => {
    const source = await makeWorkspace({ ".xspec/lockx": "a sibling" });
    await fsp.mkdir(source.path(".xspec/lock"));
    const rel = under(ascii(".xspec/lock"), BYTE_NAME);
    await fsp.writeFile(source.bytePath(rel), OPAQUE);
    await stageUnreadable(source.bytePath(rel), 0o000);
    const destination = await makeWorkspace({ ".xspec/lock/occupied": "kept" });
    await copyLockPathFile(source.root, rel, destination.bytePath(rel));
    expect(await modeOf(source.bytePath(rel))).toBe(0o000);
    expect(await modeOf(destination.bytePath(rel))).toBe(0o000);
    expect((await readLockPathFile(destination.root, rel)).equals(OPAQUE)).toBe(
      true,
    );
    expect(await modeOf(destination.bytePath(rel))).toBe(0o000);
    // An occupied destination is never replaced.
    expect(
      await outcome(
        copyLockPathFile(
          source.root,
          rel,
          destination.path(".xspec/lock/occupied"),
        ),
      ),
    ).toBe("EEXIST");
    expect(
      await fsp.readFile(destination.path(".xspec/lock/occupied"), "utf8"),
    ).toBe("kept");
    // Only the lock path's files are copied under the grant.
    await expect(
      copyLockPathFile(
        source.root,
        ".xspec/lockx",
        destination.path(".xspec/lock/x"),
      ),
    ).rejects.toThrow(/is not \.xspec\/lock or a path under it/);
    expect(await outcome(fsp.lstat(destination.path(".xspec/lock/x")))).toBe(
      "ENOENT",
    );
  },
);
