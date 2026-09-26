// E-1 permission-staging self-test (TEST-SPEC 17; T13.5-7, T14-9, T14-10).
// `test/helpers/permissions.ts` stages environment refusals by permission
// removal and verifies each staging on the harness's own process before any
// product is invoked (E-1). This self-test asserts, on the Linux leg: that
// each mode refuses this process's own attempt at exactly the operations the
// discipline names and keeps the permission it must keep; that `restore()`
// reinstates every recorded mode, idempotently; that unstageable objects — a
// directory in the path form, a symbolic link, an absent object for a read
// refusal — are staging errors, never refusals; and that the E-1
// ineffective-staging report fires: the exported verification functions run
// on an unstaged path see their own attempts succeed, undo them, and throw
// `HarnessStagingError`, which is not a `HarnessAssertionError` (H-8, H-11).
//
// On a privileged runner (root: CAP_DAC_OVERRIDE) the staging tests below
// fail with that same error by design (H-9: never a pass or a skip); CI runs
// the self project unprivileged through .github/scripts/run-without-network.sh
// and a root sandbox runs it under `unshare --map-user`/`--map-group`
// (AGENTS.md). On any other platform every staging throws at once: the guard
// reads `process.platform` when called, so the platform arm below presents it
// a foreign value — redefined for the arm's duration and restored on finish —
// and runs on the Linux leg too, never skipped (H-9).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import {
  HarnessStagingError,
  stageReadRefusalOfDirectory,
  stageReadRefusalOfFile,
  stageWriteRefusal,
  stageWriteRefusalUnder,
  verifyReadRefusalOfDirectory,
  verifyReadRefusalOfFile,
  verifyWriteRefusal,
  verifyWriteRefusalUnder,
} from "../helpers/permissions.js";
import type { PermissionStaging } from "../helpers/permissions.js";
import { TestWorkspace } from "../helpers/workspace.js";

const onLinux = process.platform === "linux";

const B_MDX = '<section id="b">B</section>\n';
const FILES = {
  "specs/b/B.mdx": B_MDX,
  "specs/b/B.xspec.ts": "export const b = 1;\n",
  "specs/b/sub/C.mdx": '<section id="c">C</section>\n',
  ".xspec/journal": "",
  ".xspec/graph.json": "{}\n",
};
const DIRS = ["specs/empty"];
const SYMLINKS = { "specs/b/link.mdx": "B.mdx", "specs/link.mdx": "b/B.mdx" };
const B_LISTING = ["B.mdx", "B.xspec.ts", "link.mdx", "sub"];

/** A workspace with every mode of interest pinned to a known prior. */
async function makeWorkspace(): Promise<TestWorkspace> {
  const workspace = await TestWorkspace.create({
    dirs: DIRS,
    files: FILES,
    symlinks: SYMLINKS,
  });
  onTestFinished(() => workspace.dispose());
  for (const dir of [
    "specs",
    "specs/b",
    "specs/b/sub",
    "specs/empty",
    ".xspec",
  ]) {
    await fsp.chmod(workspace.path(dir), 0o755);
  }
  for (const file of Object.keys(FILES)) {
    await fsp.chmod(workspace.path(file), 0o644);
  }
  return workspace;
}

/** The error code of a rejected attempt, or "allowed" when it resolved. */
async function outcome(attempt: Promise<unknown>): Promise<string> {
  try {
    await attempt;
    return "allowed";
  } catch (thrown) {
    return (thrown as { code?: string }).code ?? "unknown";
  }
}

async function modeOf(target: string): Promise<number> {
  return (await fsp.stat(target)).mode & 0o7777;
}

async function openAndClose(target: string, flags: string): Promise<void> {
  const handle = await fsp.open(target, flags);
  await handle.close();
}

/** Register the staging's restoration so a failing test leaves nothing. */
function tracked(staging: PermissionStaging): PermissionStaging {
  onTestFinished(() => staging.restore());
  return staging;
}

/** The staging error a call must reject with — never an assertion error. */
async function stagingError(
  call: Promise<unknown>,
): Promise<HarnessStagingError> {
  let thrown: unknown;
  try {
    await call;
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(HarnessStagingError);
  expect(thrown).not.toBeInstanceOf(HarnessAssertionError);
  return thrown as HarnessStagingError;
}

test("HarnessStagingError is a harness error, never a diagnosed product failure (H-8, H-11)", () => {
  const error = new HarnessStagingError("write-refusal", "/w/specs/x", "why");
  expect(error).toBeInstanceOf(Error);
  expect(error).not.toBeInstanceOf(HarnessAssertionError);
  expect(error.name).toBe("HarnessStagingError");
  expect(error.mode).toBe("write-refusal");
  expect(error.path).toBe("/w/specs/x");
  expect(error.message).toBe("write-refusal staging of /w/specs/x: why");
});

test.runIf(onLinux)(
  "write refusal, path form (T14-9): the holding directory read-only and the occupant unwritable — creation, replacement, appending, and removal refused, reads kept, siblings untouched; restore reinstates the recorded modes",
  async () => {
    const workspace = await makeWorkspace();
    const dir = workspace.path("specs/b");
    const target = workspace.path("specs/b/B.mdx");
    const staging = tracked(await stageWriteRefusal(target));
    expect(staging.mode).toBe("write-refusal");
    expect(staging.path).toBe(target);
    expect(await modeOf(dir)).toBe(0o555);
    expect(await modeOf(target)).toBe(0o444);
    // This process's own attempts at every write the discipline refuses.
    expect(await outcome(openAndClose(path.join(dir, "D.mdx"), "wx"))).toBe(
      "EACCES",
    );
    expect(await outcome(fsp.mkdir(path.join(dir, "d")))).toBe("EACCES");
    expect(await outcome(openAndClose(target, "r+"))).toBe("EACCES");
    expect(await outcome(openAndClose(target, "a"))).toBe("EACCES");
    expect(await outcome(fsp.rename(target, path.join(dir, "E.mdx")))).toBe(
      "EACCES",
    );
    expect(await outcome(fsp.unlink(target))).toBe("EACCES");
    // Reads and listings are kept; siblings and the subdirectory untouched.
    expect(Buffer.from(await fsp.readFile(target)).toString("utf8")).toBe(
      B_MDX,
    );
    expect((await fsp.readdir(dir)).sort()).toEqual(B_LISTING);
    expect(await modeOf(workspace.path("specs/b/B.xspec.ts"))).toBe(0o644);
    expect(await modeOf(workspace.path("specs/b/sub"))).toBe(0o755);
    expect(await modeOf(workspace.path("specs"))).toBe(0o755);
    // Restoration reinstates the recorded modes and is idempotent.
    await staging.restore();
    expect(await modeOf(dir)).toBe(0o755);
    expect(await modeOf(target)).toBe(0o644);
    await openAndClose(path.join(dir, "D.mdx"), "wx");
    await fsp.unlink(path.join(dir, "D.mdx"));
    await openAndClose(target, "a");
    await staging.restore();
    expect(await modeOf(target)).toBe(0o644);
  },
);

test.runIf(onLinux)(
  "write refusal, path form, absent target: the creation the product owes is refused and nothing appears; restore reinstates the directory's mode",
  async () => {
    const workspace = await makeWorkspace();
    const dir = workspace.path("specs/b");
    const target = workspace.path("specs/b/D.mdx");
    const staging = tracked(await stageWriteRefusal(target));
    expect(await modeOf(dir)).toBe(0o555);
    expect(await outcome(openAndClose(target, "wx"))).toBe("EACCES");
    expect(await outcome(fsp.mkdir(target))).toBe("EACCES");
    expect(
      await outcome(fsp.rename(workspace.path("specs/b/B.mdx"), target)),
    ).toBe("EACCES");
    expect(await outcome(fsp.lstat(target))).toBe("ENOENT");
    expect((await fsp.readdir(dir)).sort()).toEqual(B_LISTING);
    await staging.restore();
    expect(await modeOf(dir)).toBe(0o755);
    await openAndClose(target, "wx");
  },
);

test.runIf(onLinux)(
  "write refusal under a directory: the area and every directory and file beneath it unwritable, symbolic links left alone, the parent untouched; restore reinstates every recorded mode",
  async () => {
    const workspace = await makeWorkspace();
    const area = workspace.path("specs/b");
    const staging = tracked(await stageWriteRefusalUnder(area));
    expect(staging.mode).toBe("write-refusal-under");
    expect(staging.path).toBe(area);
    expect(await modeOf(area)).toBe(0o555);
    expect(await modeOf(workspace.path("specs/b/sub"))).toBe(0o555);
    expect(await modeOf(workspace.path("specs/b/B.mdx"))).toBe(0o444);
    expect(await modeOf(workspace.path("specs/b/B.xspec.ts"))).toBe(0o444);
    expect(await modeOf(workspace.path("specs/b/sub/C.mdx"))).toBe(0o444);
    expect(
      (await fsp.lstat(workspace.path("specs/b/link.mdx"))).isSymbolicLink(),
    ).toBe(true);
    expect(
      await outcome(openAndClose(workspace.path("specs/b/sub/D.mdx"), "wx")),
    ).toBe("EACCES");
    expect(
      await outcome(openAndClose(workspace.path("specs/b/sub/C.mdx"), "r+")),
    ).toBe("EACCES");
    expect(
      await outcome(fsp.unlink(workspace.path("specs/b/B.xspec.ts"))),
    ).toBe("EACCES");
    // The parent stays writable: a product's exclusivity state kept there is
    // never refused.
    expect(await modeOf(workspace.path("specs"))).toBe(0o755);
    await openAndClose(workspace.path("specs/lock"), "wx");
    await fsp.unlink(workspace.path("specs/lock"));
    await staging.restore();
    expect(await modeOf(area)).toBe(0o755);
    expect(await modeOf(workspace.path("specs/b/sub"))).toBe(0o755);
    for (const file of [
      "specs/b/B.mdx",
      "specs/b/B.xspec.ts",
      "specs/b/sub/C.mdx",
    ]) {
      expect(await modeOf(workspace.path(file))).toBe(0o644);
    }
    await openAndClose(workspace.path("specs/b/sub/D.mdx"), "wx");
  },
);

test.runIf(onLinux)(
  "read refusal of a file (T14-10): mode 0o200 — the content read refused, a write-open allowed, the holding directory untouched; restore reinstates the mode",
  async () => {
    const workspace = await makeWorkspace();
    const target = workspace.path(".xspec/graph.json");
    const staging = tracked(await stageReadRefusalOfFile(target));
    expect(staging.mode).toBe("read-refusal-of-file");
    expect(await modeOf(target)).toBe(0o200);
    expect(await outcome(fsp.readFile(target))).toBe("EACCES");
    expect(await outcome(openAndClose(target, "r+"))).toBe("EACCES");
    await openAndClose(target, "a");
    expect(await modeOf(workspace.path(".xspec"))).toBe(0o755);
    // Still replaceable by name: the directory admits a fresh sibling.
    await openAndClose(workspace.path(".xspec/fresh"), "wx");
    await fsp.unlink(workspace.path(".xspec/fresh"));
    await staging.restore();
    expect(await modeOf(target)).toBe(0o644);
    expect(Buffer.from(await fsp.readFile(target)).toString("utf8")).toBe(
      "{}\n",
    );
  },
);

test.runIf(onLinux)(
  "read refusal of a directory (T14-10): mode 0o100 — the listing refused, entries reachable and readable by name, an empty directory stageable too; restore reinstates the mode",
  async () => {
    const workspace = await makeWorkspace();
    const dir = workspace.path("specs/b");
    const staging = tracked(await stageReadRefusalOfDirectory(dir));
    expect(staging.mode).toBe("read-refusal-of-directory");
    expect(await modeOf(dir)).toBe(0o100);
    expect(await outcome(fsp.readdir(dir))).toBe("EACCES");
    expect(
      Buffer.from(await fsp.readFile(workspace.path("specs/b/B.mdx"))).toString(
        "utf8",
      ),
    ).toBe(B_MDX);
    expect((await fsp.stat(workspace.path("specs/b/sub"))).isDirectory()).toBe(
      true,
    );
    await staging.restore();
    expect(await modeOf(dir)).toBe(0o755);
    expect((await fsp.readdir(dir)).sort()).toEqual(B_LISTING);
    const empty = workspace.path("specs/empty");
    const emptyStaging = tracked(await stageReadRefusalOfDirectory(empty));
    expect(await modeOf(empty)).toBe(0o100);
    expect(await outcome(fsp.readdir(empty))).toBe("EACCES");
    await emptyStaging.restore();
    expect(await fsp.readdir(empty)).toEqual([]);
  },
);

test.runIf(onLinux)(
  "unstageable objects are staging errors, never refusals: a directory in the path form, a symbolic link, an absent holding directory, nonexistence for a read refusal, a file for a listing refusal, a relative path — nothing changed",
  async () => {
    const workspace = await makeWorkspace();
    // Thunks: a rejection must not precede its await (an unhandled rejection).
    const cases: Array<[string, () => Promise<unknown>]> = [
      ["directory target", () => stageWriteRefusal(workspace.path("specs/b"))],
      [
        "symlink target",
        () => stageWriteRefusal(workspace.path("specs/link.mdx")),
      ],
      [
        "absent holding directory",
        () => stageWriteRefusal(workspace.path("nowhere/x.mdx")),
      ],
      [
        "symlinked holding directory",
        () => stageWriteRefusal(workspace.path("specs/link.mdx/x")),
      ],
      [
        "absent file",
        () => stageReadRefusalOfFile(workspace.path("specs/b/D.mdx")),
      ],
      [
        "symlink file",
        () => stageReadRefusalOfFile(workspace.path("specs/link.mdx")),
      ],
      [
        "directory as file",
        () => stageReadRefusalOfFile(workspace.path("specs/b")),
      ],
      [
        "file as directory",
        () => stageReadRefusalOfDirectory(workspace.path("specs/b/B.mdx")),
      ],
      [
        "absent directory",
        () => stageReadRefusalOfDirectory(workspace.path("gone")),
      ],
      ["relative path", () => stageWriteRefusal("specs/b/B.mdx")],
    ];
    for (const [label, call] of cases) {
      const error = await stagingError(call());
      expect(error.message, label).toContain("staging of ");
    }
    const directoryError = await stagingError(
      stageWriteRefusal(workspace.path("specs/b")),
    );
    expect(directoryError.message).toContain("stageWriteRefusalUnder");
    expect(await modeOf(workspace.path("specs"))).toBe(0o755);
    expect(await modeOf(workspace.path("specs/b"))).toBe(0o755);
    expect(await modeOf(workspace.path("specs/b/B.mdx"))).toBe(0o644);
  },
);

test.runIf(onLinux)(
  "E-1: an ineffective staging is a HarnessStagingError — each verification run on an unstaged object sees its own attempt succeed, undoes it, and reports a privileged runner; a permission removed beyond the mode is reported too",
  async () => {
    const workspace = await makeWorkspace();
    const dir = workspace.path("specs/b");
    const target = workspace.path("specs/b/B.mdx");
    const notRefused = [
      () => verifyWriteRefusal(target),
      () => verifyWriteRefusal(workspace.path("specs/b/D.mdx")),
      () => verifyWriteRefusalUnder(dir),
      () => verifyReadRefusalOfFile(target),
      () => verifyReadRefusalOfDirectory(dir, "B.mdx"),
    ];
    for (const call of notRefused) {
      const error = await stagingError(call());
      expect(error.message).toContain("was not refused");
      expect(error.message).toContain("privileged runner");
    }
    // Every probe undid its effect: the listing and the bytes are unchanged.
    expect((await fsp.readdir(dir)).sort()).toEqual(B_LISTING);
    expect((await fsp.readdir(workspace.path("specs/b/sub"))).sort()).toEqual([
      "C.mdx",
    ]);
    expect(Buffer.from(await fsp.readFile(target)).toString("utf8")).toBe(
      B_MDX,
    );
    expect(await outcome(fsp.lstat(workspace.path("specs/b/D.mdx")))).toBe(
      "ENOENT",
    );
    // A read staging that also lost the permission it must keep.
    await fsp.chmod(target, 0o000);
    const fileError = await stagingError(verifyReadRefusalOfFile(target));
    expect(fileError.message).toContain("removed more than it may");
    await fsp.chmod(target, 0o644);
    await fsp.chmod(dir, 0o000);
    const dirError = await stagingError(
      verifyReadRefusalOfDirectory(dir, "B.mdx"),
    );
    expect(dirError.message).toContain("removed more than it may");
    await fsp.chmod(dir, 0o755);
  },
);

// The platform guard (E-1): every staging consults `process.platform` when
// called and, off the Linux leg, throws before touching the filesystem. The
// arm presents the guard the Windows and macOS values in turn — the property
// redefined (it is configurable, not writable) and restored on finish — over a
// target inside a disposable workspace, the one place a bypassed guard could
// stage; so it runs on every platform, the Linux leg included, and is never
// marked skipped (H-9, E-2).
const FOREIGN_PLATFORMS: readonly NodeJS.Platform[] = ["win32", "darwin"];

/** The own descriptor of `process.platform`, reinstated as it was. */
function platformDescriptor(): PropertyDescriptor {
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
  if (descriptor === undefined) {
    throw new Error("process.platform is not an own property of process");
  }
  return descriptor;
}

test("the platform guard (E-1): presented a non-Linux platform, every staging throws HarnessStagingError at once and touches nothing — run on every platform, never skipped (H-9)", async () => {
  const workspace = await TestWorkspace.create();
  onTestFinished(() => workspace.dispose());
  const target = workspace.path("nowhere");
  const holdingMode = await modeOf(workspace.root);
  const original = platformDescriptor();
  const restore = (): void => {
    Object.defineProperty(process, "platform", original);
  };
  onTestFinished(restore);
  const stagings = [
    ["write-refusal", () => stageWriteRefusal(target)],
    ["write-refusal-under", () => stageWriteRefusalUnder(target)],
    ["read-refusal-of-file", () => stageReadRefusalOfFile(target)],
    ["read-refusal-of-directory", () => stageReadRefusalOfDirectory(target)],
  ] as const;
  for (const platform of FOREIGN_PLATFORMS) {
    Object.defineProperty(process, "platform", {
      ...original,
      value: platform,
    });
    expect(process.platform).toBe(platform);
    for (const [mode, call] of stagings) {
      const error = await stagingError(call());
      expect(error.mode).toBe(mode);
      expect(error.path).toBe(target);
      expect(error.message).toContain("Linux leg");
      expect(error.message).toContain(platform);
    }
    restore();
    expect(process.platform).toBe(original.value);
  }
  // At once: the target never came to be and the holding directory keeps
  // its mode — no staging reached the filesystem.
  expect(await outcome(fsp.stat(target))).toBe("ENOENT");
  expect(await modeOf(workspace.root)).toBe(holdingMode);
});
