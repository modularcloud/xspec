// E-1 permission-staging self-test (TEST-SPEC 17; T13.5-7, T14-9, T14-10).
// `test/helpers/permissions.ts` stages environment refusals by permission
// removal and verifies each staging on the harness's own process before any
// product is invoked (E-1). This self-test asserts, on the Linux leg: that
// each mode refuses this process's own attempt at exactly the operations the
// discipline names and keeps the permission it must keep — the directory
// modes of `stageDirectoryMode` (T13.5-10(d), (h), T13.5-11) included, each
// declared probe refused or kept as declared, and T14-9's graph-data staging
// (`stageGraphDataWriteRefusal`) over a hand-made area holding graph data
// in a file directly in it and in directories of its own below it beside
// the journal, the session directory, and the lock directory — every
// graph-data write refused, the three keeping their modes and writable;
// that `restore()` reinstates every recorded mode, idempotently, restoring
// nothing where a product's removal took the staged object away or renamed
// it away (a file read refusal's file removed, a listing refusal's or a
// directory-mode staging's directory renamed away: H-8, the state left to
// the checks' diagnosis, never a harness error); that unstageable objects —
// a directory in the path form, a symbolic link, an absent object for a read
// refusal, a graph-data area absent or a symbolic link — are staging errors,
// never refusals; that an entry the product named is reached at its exact
// bytes whatever the name — not valid UTF-8, or not ASCII (SPEC 13.1, 13.3)
// — by every staging that reaches entries the harness does not name, its
// diagnoses rendering such a name readably; and that the E-1
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
  stageDirectoryMode,
  stageGraphDataWriteRefusal,
  stageReadRefusalOfDirectory,
  stageReadRefusalOfFile,
  stageWriteRefusal,
  stageWriteRefusalUnder,
  verifyDirectoryMode,
  verifyGraphDataWriteRefusal,
  verifyReadRefusalOfDirectory,
  verifyReadRefusalOfFile,
  verifyWriteRefusal,
  verifyWriteRefusalUnder,
} from "../helpers/permissions.js";
import type {
  DirectoryModeProbe,
  PermissionStaging,
} from "../helpers/permissions.js";
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

async function modeOf(target: string | Buffer): Promise<number> {
  return (await fsp.stat(target)).mode & 0o7777;
}

async function openAndClose(
  target: string | Buffer,
  flags: string,
): Promise<void> {
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

// T14-9's graph-data staging over a hand-made area: graph data in a file
// directly in the area and in directories of its own below it (SPEC 13.3),
// beside the durable journal and session directory and the transient lock
// directory holding a held run's entry (13.4, 13.5).
const LOCK_ENTRY = ".xspec/lock/1234-run";
const GRAPH_DATA_WORKSPACE_FILES: Readonly<Record<string, string>> = {
  ".xspec/graph.json": "{}\n",
  ".xspec/d/x.json": "x\n",
  ".xspec/d/e/y.json": "y\n",
  ".xspec/journal": "entry\n",
  ".xspec/reviews/s.json": "{}\n",
  [LOCK_ENTRY]: "",
};
/** The area and the directories of T13.3-2's set: made read-only. */
const GRAPH_DATA_DIRS = [".xspec", ".xspec/d", ".xspec/d/e"];
/** The files of T13.3-2's set: made unwritable. */
const GRAPH_DATA_FILES = [
  ".xspec/graph.json",
  ".xspec/d/x.json",
  ".xspec/d/e/y.json",
];
/** The session directory and the lock directory: keeping their modes. */
const KEPT_DIRS = [".xspec/reviews", ".xspec/lock"];
/** The journal, a session file, and a held run's entry: keeping theirs. */
const KEPT_FILES = [".xspec/journal", ".xspec/reviews/s.json", LOCK_ENTRY];

/** The hand-made area, every mode pinned to a known prior. */
async function makeGraphDataWorkspace(): Promise<TestWorkspace> {
  const workspace = await TestWorkspace.create({
    files: GRAPH_DATA_WORKSPACE_FILES,
  });
  onTestFinished(() => workspace.dispose());
  for (const dir of [...GRAPH_DATA_DIRS, ...KEPT_DIRS]) {
    await fsp.chmod(workspace.path(dir), 0o755);
  }
  for (const file of [...GRAPH_DATA_FILES, ...KEPT_FILES]) {
    await fsp.chmod(workspace.path(file), 0o644);
  }
  return workspace;
}

test.runIf(onLinux)(
  "graph-data write refusal (T14-9's graph-data staging): `.xspec` and every directory of T13.3-2's operational path set read-only and every file of it unwritable — creation in each directory and writing, replacing, and removing each file refused wherever graph data lies, reads kept — while the journal, the session directory, and the lock path keep their modes and stay writable, a held run's release deleting its entry but refused the emptied lock directory's deletion; restore reinstates every recorded mode, idempotently",
  async () => {
    const workspace = await makeGraphDataWorkspace();
    const at = (rel: string): string => workspace.path(rel);
    const staging = tracked(await stageGraphDataWriteRefusal(workspace.root));
    expect(staging.mode).toBe("graph-data-write-refusal");
    expect(staging.path).toBe(at(".xspec"));
    for (const dir of GRAPH_DATA_DIRS) {
      expect(await modeOf(at(dir)), dir).toBe(0o555);
    }
    for (const file of GRAPH_DATA_FILES) {
      expect(await modeOf(at(file)), file).toBe(0o444);
    }
    for (const dir of KEPT_DIRS) {
      expect(await modeOf(at(dir)), dir).toBe(0o755);
    }
    for (const file of KEPT_FILES) {
      expect(await modeOf(at(file)), file).toBe(0o644);
    }
    // This process's own attempts at every graph-data write, in the area and
    // in the directories below it.
    for (const dir of GRAPH_DATA_DIRS) {
      expect(
        await outcome(openAndClose(path.join(at(dir), "n.json"), "wx")),
        dir,
      ).toBe("EACCES");
      expect(await outcome(fsp.mkdir(path.join(at(dir), "n"))), dir).toBe(
        "EACCES",
      );
    }
    for (const file of GRAPH_DATA_FILES) {
      expect(await outcome(openAndClose(at(file), "r+")), file).toBe("EACCES");
      expect(await outcome(openAndClose(at(file), "a")), file).toBe("EACCES");
      expect(await outcome(fsp.unlink(at(file))), file).toBe("EACCES");
    }
    expect(
      await outcome(fsp.rename(at(".xspec/d/e/y.json"), at(".xspec/d/z.json"))),
    ).toBe("EACCES");
    expect(
      await outcome(
        fsp.rename(at(".xspec/reviews/s.json"), at(".xspec/graph.json")),
      ),
    ).toBe("EACCES");
    // Reads and listings are kept.
    expect(
      Buffer.from(await fsp.readFile(at(".xspec/d/e/y.json"))).toString("utf8"),
    ).toBe("y\n");
    expect((await fsp.readdir(at(".xspec/d"))).sort()).toEqual(["e", "x.json"]);
    // The journal appended to; a session rewritten in place and replaced by
    // renaming; a fresh session created and removed — none refused.
    await fsp.appendFile(at(".xspec/journal"), "entry 2\n");
    expect(
      Buffer.from(await fsp.readFile(at(".xspec/journal"))).toString("utf8"),
    ).toBe("entry\nentry 2\n");
    await fsp.writeFile(at(".xspec/reviews/s.json"), "{ }\n");
    await fsp.writeFile(at(".xspec/reviews/s.json.next"), "{}\n");
    await fsp.rename(
      at(".xspec/reviews/s.json.next"),
      at(".xspec/reviews/s.json"),
    );
    await fsp.chmod(at(".xspec/reviews/s.json"), 0o644);
    await openAndClose(at(".xspec/reviews/t.json"), "wx");
    await fsp.unlink(at(".xspec/reviews/t.json"));
    // A held run's release: its entry deleted, then the emptied lock
    // directory's deletion — an entry of the read-only area — refused, which
    // changes no outcome (SPEC 13.5, 14.24).
    await fsp.unlink(at(LOCK_ENTRY));
    expect(await outcome(fsp.rmdir(at(".xspec/lock")))).toBe("EACCES");
    await fsp.writeFile(at(LOCK_ENTRY), "");
    await fsp.chmod(at(LOCK_ENTRY), 0o644);
    // Restoration reinstates the recorded modes and is idempotent.
    await staging.restore();
    for (const dir of [...GRAPH_DATA_DIRS, ...KEPT_DIRS]) {
      expect(await modeOf(at(dir)), dir).toBe(0o755);
    }
    for (const file of [...GRAPH_DATA_FILES, ...KEPT_FILES]) {
      expect(await modeOf(at(file)), file).toBe(0o644);
    }
    await openAndClose(at(".xspec/d/e/n.json"), "wx");
    await fsp.unlink(at(".xspec/d/e/n.json"));
    await staging.restore();
    expect(await modeOf(at(".xspec"))).toBe(0o755);
  },
);

test.runIf(onLinux)(
  "graph-data write refusal over an area holding no graph data: `.xspec` alone made read-only, graph data's creation refused; a journal and a session directory whose own modes withhold writing keep those modes, the staging verifying no permission they lack; restore reinstates the area's mode",
  async () => {
    const workspace = await TestWorkspace.create({
      dirs: [".xspec/lock"],
      files: { ".xspec/journal": "entry\n", ".xspec/reviews/s.json": "{}\n" },
    });
    onTestFinished(() => workspace.dispose());
    const at = (rel: string): string => workspace.path(rel);
    for (const dir of [".xspec", ".xspec/lock"]) {
      await fsp.chmod(at(dir), 0o755);
    }
    await fsp.chmod(at(".xspec/reviews/s.json"), 0o644);
    await fsp.chmod(at(".xspec/reviews"), 0o555);
    await fsp.chmod(at(".xspec/journal"), 0o444);
    const staging = tracked(await stageGraphDataWriteRefusal(workspace.root));
    expect(await modeOf(at(".xspec"))).toBe(0o555);
    expect(await modeOf(at(".xspec/journal"))).toBe(0o444);
    expect(await modeOf(at(".xspec/reviews"))).toBe(0o555);
    expect(await modeOf(at(".xspec/reviews/s.json"))).toBe(0o644);
    expect(await modeOf(at(".xspec/lock"))).toBe(0o755);
    expect(await outcome(openAndClose(at(".xspec/graph.json"), "wx"))).toBe(
      "EACCES",
    );
    expect(await outcome(fsp.mkdir(at(".xspec/d")))).toBe("EACCES");
    expect((await fsp.readdir(at(".xspec"))).sort()).toEqual([
      "journal",
      "lock",
      "reviews",
    ]);
    await staging.restore();
    expect(await modeOf(at(".xspec"))).toBe(0o755);
    expect(await modeOf(at(".xspec/journal"))).toBe(0o444);
    expect(await modeOf(at(".xspec/reviews"))).toBe(0o555);
    await fsp.chmod(at(".xspec/reviews"), 0o755);
  },
);

test.runIf(onLinux)(
  "E-1 for the graph-data write refusal: its verification, run on an unstaged workspace, sees its own attempts succeed, undoes them, and reports a privileged runner; under the staging, a graph-data file or directory below the area left writable is reported; a walk the environment refuses is a staging error, nothing changed",
  async () => {
    const workspace = await makeGraphDataWorkspace();
    const at = (rel: string): string => workspace.path(rel);
    const unstaged = await stagingError(
      verifyGraphDataWriteRefusal(workspace.root),
    );
    expect(unstaged.mode).toBe("graph-data-write-refusal");
    expect(unstaged.path).toBe(at(".xspec"));
    expect(unstaged.message).toContain(`creating ${at(".xspec")}/`);
    expect(unstaged.message).toContain("was not refused");
    expect(unstaged.message).toContain("privileged runner");
    // Every probe undid its effect: the listings and the bytes are unchanged.
    expect((await fsp.readdir(at(".xspec"))).sort()).toEqual([
      "d",
      "graph.json",
      "journal",
      "lock",
      "reviews",
    ]);
    expect((await fsp.readdir(at(".xspec/d"))).sort()).toEqual(["e", "x.json"]);
    for (const [rel, contents] of Object.entries(GRAPH_DATA_WORKSPACE_FILES)) {
      expect(
        Buffer.from(await fsp.readFile(at(rel))).toString("utf8"),
        rel,
      ).toBe(contents);
    }

    const staging = tracked(await stageGraphDataWriteRefusal(workspace.root));
    // A file of the set, in a directory below the area, left writable.
    await fsp.chmod(at(".xspec/d/e/y.json"), 0o644);
    const fileError = await stagingError(
      verifyGraphDataWriteRefusal(workspace.root),
    );
    expect(fileError.message).toContain(
      `opening ${at(".xspec/d/e/y.json")} with "r+" was not refused`,
    );
    await fsp.chmod(at(".xspec/d/e/y.json"), 0o444);
    // A directory of the set left writable: a creation in it unrefused.
    await fsp.chmod(at(".xspec/d/e"), 0o755);
    const dirError = await stagingError(
      verifyGraphDataWriteRefusal(workspace.root),
    );
    expect(dirError.message).toContain(`creating ${at(".xspec/d/e")}/`);
    expect(dirError.message).toContain("was not refused");
    await fsp.chmod(at(".xspec/d/e"), 0o555);
    // Restaged as staged, the verification holds.
    await verifyGraphDataWriteRefusal(workspace.root);
    await staging.restore();
    expect(await fsp.readdir(at(".xspec/d/e"))).toEqual(["y.json"]);

    // A walk the environment refuses — a graph-data directory unlistable —
    // is a staging error, and nothing is changed.
    await fsp.chmod(at(".xspec/d"), 0o300);
    const walkError = await stagingError(
      stageGraphDataWriteRefusal(workspace.root),
    );
    expect(walkError.message).toContain(
      "walking T13.3-2's operational path set failed with EACCES",
    );
    expect(await modeOf(at(".xspec"))).toBe(0o755);
    expect(await modeOf(at(".xspec/graph.json"))).toBe(0o644);
    await fsp.chmod(at(".xspec/d"), 0o755);
  },
);

test.runIf(onLinux)(
  "read refusal of a file (T14-10): mode 0o200 — the content read refused, a write-open allowed, the holding directory untouched; restore reinstates the mode, and restores nothing, without throwing, where the file was removed meanwhile (T13.4-12)",
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
    // A product's removal of the staged file meanwhile: nothing to restore,
    // its state left to the checks' diagnosis — never a harness error.
    const removed = tracked(await stageReadRefusalOfFile(target));
    await fsp.unlink(target);
    await removed.restore();
    await removed.restore();
    expect(await outcome(fsp.lstat(target))).toBe("ENOENT");
  },
);

test.runIf(onLinux)(
  "read refusal of a directory (T14-10): mode 0o100 — the listing refused, entries reachable and readable by name, an empty directory stageable too; restore reinstates the mode, and restores nothing, without throwing, where the directory was renamed away meanwhile (T13.4-12)",
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
    // A product's renaming of the staged directory away meanwhile: nothing
    // restored, never a harness error.
    const moved = tracked(await stageReadRefusalOfDirectory(empty));
    const elsewhere = workspace.path("specs/renamed-listing");
    await fsp.rename(empty, elsewhere);
    await moved.restore();
    expect(await modeOf(elsewhere)).toBe(0o100);
    expect(await outcome(fsp.lstat(empty))).toBe("ENOENT");
    await fsp.chmod(elsewhere, 0o755);
  },
);

test.runIf(onLinux)(
  "directory modes (T13.5-10(d), (h), T13.5-11): `-wx`, `r-x`, and `rw-` each refuse exactly the probes declared refused — the listing, a creation, an entry's examination, an entry's removal — and keep those declared kept, the probes leaving nothing behind; restore reinstates the recorded mode, idempotently, and restores nothing where the directory was renamed away",
  async () => {
    const workspace = await makeWorkspace();
    // `-wx` on an empty directory: its listing refused, creation kept.
    const empty = workspace.path("specs/empty");
    const unlistable = tracked(
      await stageDirectoryMode(empty, 0o300, [
        { attempt: "list", refused: true },
        { attempt: "create", refused: false },
      ]),
    );
    expect(unlistable.mode).toBe("directory-mode");
    expect(unlistable.path).toBe(empty);
    expect(await modeOf(empty)).toBe(0o300);
    expect(await outcome(fsp.readdir(empty))).toBe("EACCES");
    await openAndClose(path.join(empty, "e"), "wx");
    await fsp.unlink(path.join(empty, "e"));
    await unlistable.restore();
    expect(await modeOf(empty)).toBe(0o755);
    expect(await fsp.readdir(empty)).toEqual([]);
    await unlistable.restore();
    expect(await modeOf(empty)).toBe(0o755);

    // `r-x` on a directory holding a file: creation and the file's removal
    // refused, the listing and the file's examination kept.
    const sub = workspace.path("specs/b/sub");
    const subFile = path.join(sub, "C.mdx");
    const unwritable = tracked(
      await stageDirectoryMode(sub, 0o500, [
        { attempt: "create", refused: true },
        { attempt: "remove", name: "C.mdx" },
        { attempt: "list", refused: false },
        { attempt: "examine", name: "C.mdx", refused: false },
      ]),
    );
    expect(await modeOf(sub)).toBe(0o500);
    expect(await outcome(openAndClose(path.join(sub, "D.mdx"), "wx"))).toBe(
      "EACCES",
    );
    expect(await outcome(fsp.unlink(subFile))).toBe("EACCES");
    expect(await fsp.readdir(sub)).toEqual(["C.mdx"]);
    await unwritable.restore();
    expect(await modeOf(sub)).toBe(0o755);
    expect(Buffer.from(await fsp.readFile(subFile)).toString("utf8")).toBe(
      FILES["specs/b/sub/C.mdx"],
    );

    // `rw-` on a directory holding a directory: an entry's examination —
    // of one present and of one absent — and creation refused, the listing
    // kept.
    const dir = workspace.path("specs/b");
    const unsearchable = tracked(
      await stageDirectoryMode(dir, 0o600, [
        { attempt: "examine", name: "sub", refused: true },
        { attempt: "examine", name: "absent", refused: true },
        { attempt: "create", refused: true },
        { attempt: "list", refused: false },
      ]),
    );
    expect(await modeOf(dir)).toBe(0o600);
    expect(await outcome(fsp.lstat(sub))).toBe("EACCES");
    expect((await fsp.readdir(dir)).sort()).toEqual(B_LISTING);
    await unsearchable.restore();
    expect(await modeOf(dir)).toBe(0o755);
    expect((await fsp.readdir(dir)).sort()).toEqual(B_LISTING);

    // A directory renamed away meanwhile — as a removal may rename a
    // leftover first: the restore leaves it alone and does not throw.
    const moved = tracked(
      await stageDirectoryMode(empty, 0o300, [
        { attempt: "list", refused: true },
      ]),
    );
    const elsewhere = workspace.path("specs/renamed");
    await fsp.rename(empty, elsewhere);
    await moved.restore();
    expect(await modeOf(elsewhere)).toBe(0o300);
    expect(await outcome(fsp.lstat(empty))).toBe("ENOENT");
    await fsp.chmod(elsewhere, 0o755);
  },
);

test.runIf(onLinux)(
  "E-1 for directory modes: each probe declared refused, attempted on a directory whose mode refuses nothing, is an ineffective staging — its own attempt undone — and each declared kept that the mode refuses is a removal beyond the mode, each a HarnessStagingError; a staging whose verification fails reinstates the prior mode",
  async () => {
    const workspace = await makeWorkspace();
    const dir = workspace.path("specs/b");
    const target = workspace.path("specs/b/B.mdx");
    const notRefused: readonly (readonly DirectoryModeProbe[])[] = [
      [{ attempt: "list", refused: true }],
      [{ attempt: "create", refused: true }],
      [{ attempt: "examine", name: "sub", refused: true }],
      [{ attempt: "remove", name: "B.mdx" }],
    ];
    for (const probes of notRefused) {
      const error = await stagingError(verifyDirectoryMode(dir, probes));
      expect(error.mode).toBe("directory-mode");
      expect(error.path).toBe(dir);
      expect(error.message).toContain("was not refused");
      expect(error.message).toContain("privileged runner");
    }
    // Every probe undid its effect: the listing and the bytes are unchanged.
    expect((await fsp.readdir(dir)).sort()).toEqual(B_LISTING);
    expect(Buffer.from(await fsp.readFile(target)).toString("utf8")).toBe(
      B_MDX,
    );
    await fsp.chmod(dir, 0o000);
    const keptRefused: readonly (readonly DirectoryModeProbe[])[] = [
      [{ attempt: "list", refused: false }],
      [{ attempt: "create", refused: false }],
      [{ attempt: "examine", name: "sub", refused: false }],
    ];
    for (const probes of keptRefused) {
      const error = await stagingError(verifyDirectoryMode(dir, probes));
      expect(error.message).toContain("removed more than it may");
    }
    await fsp.chmod(dir, 0o755);
    const failed = await stagingError(
      stageDirectoryMode(dir, 0o700, [{ attempt: "list", refused: true }]),
    );
    expect(failed.message).toContain("was not refused");
    expect(await modeOf(dir)).toBe(0o755);
  },
);

// Names a product may choose (SPEC 13.1, 13.3; permissions.ts: Names), built
// from bytes and code points: "a" then 0xFF — no valid UTF-8 — and "d" then
// U+00E9, valid UTF-8 but not ASCII.
const NOT_UTF8_NAME = Buffer.from([0x61, 0xff]);
const NOT_ASCII_NAME = Buffer.from(`d${String.fromCodePoint(0xe9)}`, "utf8");

test.runIf(onLinux)(
  "byte paths: an entry the product named — not valid UTF-8, or not ASCII — is reached at its exact bytes by the area write refusal and its E-1 verification, a file read refusal, and a listing refusal's by-name probe; a diagnosis renders such a name's segment as hex; restore reinstates every mode",
  async () => {
    const workspace = await makeWorkspace();
    const area = workspace.path(".xspec");
    const rel = (...parts: Buffer[]): Buffer =>
      Buffer.concat([Buffer.from(".xspec/"), ...parts]);
    const fileRel = rel(NOT_UTF8_NAME);
    const subRel = rel(NOT_ASCII_NAME);
    const subFileRel = rel(NOT_ASCII_NAME, Buffer.from("/f"));
    await workspace.file(fileRel, "x\n");
    await workspace.file(subFileRel, "f\n");
    const file = workspace.bytePath(fileRel);
    const sub = workspace.bytePath(subRel);
    const subFile = workspace.bytePath(subFileRel);
    await fsp.chmod(sub, 0o755);
    for (const target of [file, subFile]) await fsp.chmod(target, 0o644);
    const shownFile = `${area}/<bytes ${NOT_UTF8_NAME.toString("hex")}>`;

    // The area write refusal reaches both names, and so does its verification.
    const staging = tracked(await stageWriteRefusalUnder(area));
    expect(await modeOf(area)).toBe(0o555);
    expect(await modeOf(file)).toBe(0o444);
    expect(await modeOf(sub)).toBe(0o555);
    expect(await modeOf(subFile)).toBe(0o444);
    expect(await modeOf(workspace.path(".xspec/graph.json"))).toBe(0o444);
    expect(await outcome(openAndClose(file, "r+"))).toBe("EACCES");
    expect(await outcome(openAndClose(file, "a"))).toBe("EACCES");
    expect(await outcome(openAndClose(subFile, "a"))).toBe("EACCES");
    const fresh = Buffer.concat([sub, Buffer.from("/g")]);
    expect(await outcome(openAndClose(fresh, "wx"))).toBe("EACCES");
    // That one file left writable is an ineffective staging E-1 reports.
    await fsp.chmod(file, 0o644);
    const areaError = await stagingError(verifyWriteRefusalUnder(area));
    expect(areaError.path).toBe(area);
    expect(areaError.message).toContain(
      `opening ${shownFile} with "r+" was not refused`,
    );
    await staging.restore();
    expect(await modeOf(area)).toBe(0o755);
    expect(await modeOf(sub)).toBe(0o755);
    expect(await modeOf(subFile)).toBe(0o644);
    expect(await modeOf(file)).toBe(0o644);

    // A file read refusal at the exact bytes; unstaged, its verification
    // names the file with the segment as hex.
    const fileStaging = tracked(await stageReadRefusalOfFile(file));
    expect(fileStaging.path).toEqual(file);
    expect(await modeOf(file)).toBe(0o200);
    expect(await outcome(fsp.readFile(file))).toBe("EACCES");
    await openAndClose(file, "a");
    await fileStaging.restore();
    expect(await modeOf(file)).toBe(0o644);
    const fileError = await stagingError(verifyReadRefusalOfFile(file));
    expect(fileError.path).toBe(shownFile);
    expect(fileError.message).toContain("was not refused");

    // A listing refusal whose first entry, bytewise, is the name that is not
    // valid UTF-8: the by-name probe reaches it.
    const listing = tracked(await stageReadRefusalOfDirectory(area));
    expect(await modeOf(area)).toBe(0o100);
    expect(await outcome(fsp.readdir(area))).toBe("EACCES");
    expect((await fsp.lstat(file)).isFile()).toBe(true);
    await listing.restore();
    expect(await modeOf(area)).toBe(0o755);
    expect(
      (await workspace.readdirBytes(".xspec"))
        .map((name) => Buffer.from(name).toString("hex"))
        .sort(),
    ).toEqual(
      [
        NOT_UTF8_NAME,
        NOT_ASCII_NAME,
        Buffer.from("graph.json"),
        Buffer.from("journal"),
      ]
        .map((name) => name.toString("hex"))
        .sort(),
    );
  },
);

test.runIf(onLinux)(
  "byte paths, graph-data staging: graph data under names the product chose — not valid UTF-8, or not ASCII, a file in the area and a directory below it — is reached at its exact bytes by the graph-data staging and its E-1 verification, a diagnosis rendering such a name's segment as hex; restore reinstates every mode",
  async () => {
    const workspace = await makeGraphDataWorkspace();
    const rel = (...parts: Buffer[]): Buffer =>
      Buffer.concat([Buffer.from(".xspec/"), ...parts]);
    const fileRel = rel(NOT_UTF8_NAME);
    const subRel = rel(NOT_ASCII_NAME);
    const subFileRel = rel(NOT_ASCII_NAME, Buffer.from("/f"));
    await workspace.file(fileRel, "x\n");
    await workspace.file(subFileRel, "f\n");
    const file = workspace.bytePath(fileRel);
    const sub = workspace.bytePath(subRel);
    const subFile = workspace.bytePath(subFileRel);
    await fsp.chmod(sub, 0o755);
    for (const target of [file, subFile]) await fsp.chmod(target, 0o644);

    const staging = tracked(await stageGraphDataWriteRefusal(workspace.root));
    expect(await modeOf(file)).toBe(0o444);
    expect(await modeOf(sub)).toBe(0o555);
    expect(await modeOf(subFile)).toBe(0o444);
    expect(await modeOf(workspace.path(".xspec/journal"))).toBe(0o644);
    expect(await outcome(openAndClose(file, "a"))).toBe("EACCES");
    expect(await outcome(openAndClose(subFile, "r+"))).toBe("EACCES");
    expect(
      await outcome(
        openAndClose(Buffer.concat([sub, Buffer.from("/g")]), "wx"),
      ),
    ).toBe("EACCES");
    // That one file left writable is an ineffective staging E-1 reports.
    await fsp.chmod(file, 0o644);
    const error = await stagingError(
      verifyGraphDataWriteRefusal(workspace.root),
    );
    expect(error.path).toBe(workspace.path(".xspec"));
    expect(error.message).toContain(
      `opening ${workspace.path(".xspec")}/<bytes ${NOT_UTF8_NAME.toString("hex")}> with "r+" was not refused`,
    );
    await staging.restore();
    expect(await modeOf(file)).toBe(0o644);
    expect(await modeOf(sub)).toBe(0o755);
    expect(await modeOf(subFile)).toBe(0o644);
    expect(await modeOf(workspace.path(".xspec"))).toBe(0o755);
  },
);

test.runIf(onLinux)(
  "unstageable objects are staging errors, never refusals: a directory in the path form, a symbolic link, an absent holding directory, nonexistence for a read refusal, a file for a listing refusal, a graph-data area absent or a symbolic link, a relative path — nothing changed",
  async () => {
    const workspace = await makeWorkspace();
    // A root whose graph-data area is a symbolic link (to a directory).
    await workspace.symlink("specs/empty/.xspec", "../b", "dir");
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
      [
        "file as directory, directory mode",
        () =>
          stageDirectoryMode(workspace.path("specs/b/B.mdx"), 0o300, [
            { attempt: "list", refused: true },
          ]),
      ],
      [
        "symlink as directory, directory mode",
        () =>
          stageDirectoryMode(workspace.path("specs/link.mdx"), 0o300, [
            { attempt: "list", refused: true },
          ]),
      ],
      [
        "absent directory, directory mode",
        () =>
          stageDirectoryMode(workspace.path("gone"), 0o300, [
            { attempt: "list", refused: true },
          ]),
      ],
      [
        "directory mode without a probe",
        () => stageDirectoryMode(workspace.path("specs/b"), 0o300, []),
      ],
      [
        "directory mode beyond the mode bits",
        () =>
          stageDirectoryMode(workspace.path("specs/b"), 0o10000, [
            { attempt: "list", refused: true },
          ]),
      ],
      [
        "directory mode removing a directory",
        () =>
          stageDirectoryMode(workspace.path("specs/b"), 0o500, [
            { attempt: "remove", name: "sub" },
          ]),
      ],
      [
        "directory mode examining an absent entry it keeps",
        () =>
          stageDirectoryMode(workspace.path("specs/b"), 0o500, [
            { attempt: "examine", name: "gone", refused: false },
          ]),
      ],
      [
        "graph-data area absent",
        () => stageGraphDataWriteRefusal(workspace.path("specs")),
      ],
      [
        "graph-data area a symbolic link",
        () => stageGraphDataWriteRefusal(workspace.path("specs/empty")),
      ],
      ["graph-data root relative", () => stageGraphDataWriteRefusal("work")],
    ];
    for (const [label, call] of cases) {
      const error = await stagingError(call());
      expect(error.message, label).toContain("staging of ");
    }
    const areaError = await stagingError(
      stageGraphDataWriteRefusal(workspace.path("specs/empty")),
    );
    expect(areaError.mode).toBe("graph-data-write-refusal");
    expect(areaError.message).toContain("the graph-data area");
    expect(areaError.message).toContain("is symlink, not a directory");
    expect(await modeOf(workspace.path("specs/empty"))).toBe(0o755);
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
    ["graph-data-write-refusal", () => stageGraphDataWriteRefusal(target)],
    ["read-refusal-of-file", () => stageReadRefusalOfFile(target)],
    ["read-refusal-of-directory", () => stageReadRefusalOfDirectory(target)],
    [
      "directory-mode",
      () =>
        stageDirectoryMode(target, 0o300, [{ attempt: "list", refused: true }]),
    ],
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
