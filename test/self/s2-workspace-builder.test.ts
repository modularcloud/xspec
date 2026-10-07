// S-2 Workspace builder self-test (TEST-SPEC 17). The fixture builder must
// write exactly the declared bytes — round-trip checks covering every
// declared-byte class: LF/CRLF/lone-CR content, BOMs, invalid-UTF-8 blobs
// (contents, and byte-string file names on Linux — T1.5-2 staging — through
// every byte-path form, `bytePath()`'s raw resolution included), symbolic
// links (verbatim targets: live, dangling, directory, cyclic, external —
// T7-5, T13.4-6), and git fixtures with scripted commits carrying pinned,
// platform-independent identities and timestamps (E-6) — and scale vectors
// at the suite's staged maxima (`staged-scale.ts`, shared with S-8): the
// 4096-deep section tower P-8's giant-nesting draws stage, the largest
// document any generator draw stages, and the largest document any
// deterministic fixture stages (T1.3-7's 2048-deep chained-id tower — the
// largest document the suite stages), each read back byte-complete, so a
// truncating writer or recursion-limited serializer cannot silently stage
// shallower or smaller inputs than declared (H-11's input side). The
// builder's S-9 TypeScript check at staging time has its vectors here too
// (TEST-SPEC S-9's TypeScript clause): a declared-well-formed ill-formed
// `.ts` file, a declared-unparseable well-formed one, and a text TypeScript
// 5.9.3 accepts read one way only each throw `HarnessStagingError` (mode
// `ts-derivability`) before anything is written.
// Certification cannot exercise builder bugs that make fixtures diverge from
// their declarations, so this self-test must pass before any fixture is
// trusted.
//
// Platform gates mirror TEST-SPEC's own staging notes, not CI skips: the
// `self` project runs on Linux in CI (harness-self job), where every test
// here executes. Byte-string file names exist only where file names are byte
// strings (Linux, T1.5-2), and symlink tests run on POSIX (E-2: symlink
// tests run on Linux CI; the E-6 Windows subset depends on no symlink
// creation).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import {
  GIT_FIXTURE_EPOCH_SECONDS,
  GIT_FIXTURE_PERSON,
  TS_DEFAULT_SUFFIXES,
  TestWorkspace,
} from "../helpers/workspace.js";
import type { WorkspaceDecl } from "../helpers/workspace.js";
import { FUZZ_BASE_FILES } from "../suite/registry/section-16-p8.js";
import {
  DEEPEST_STAGED_TOWER,
  DEPTH_FLOOR,
  depthTower,
  GIANT_NESTING_FLOOR,
  LARGEST_BASE_FILE,
  LARGEST_DETERMINISTIC_INPUT_BYTES,
  LARGEST_GENERATED_INPUT_BYTES,
  LARGEST_STAGED_INPUT_BYTES,
  largestDeterministicDocument,
  largestGeneratedDocument,
  TOWER_SOURCE,
} from "./staged-scale.js";

const onLinux = process.platform === "linux";
const onPosix = process.platform !== "win32";

const hex = (data: Uint8Array): string => Buffer.from(data).toString("hex");
const utf8 = (text: string): Uint8Array => Buffer.from(text, "utf8");
const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
const concatBytes = (...parts: Uint8Array[]): Uint8Array =>
  Buffer.concat(parts);

/** Byte-exact comparison with hex output for a diagnosable failure. */
function expectSameBytes(actual: Uint8Array, expected: Uint8Array): void {
  expect(hex(actual)).toBe(hex(expected));
}

async function makeWorkspace(decl?: WorkspaceDecl): Promise<TestWorkspace> {
  const workspace = await TestWorkspace.create(decl);
  onTestFinished(() => workspace.dispose());
  return workspace;
}

test("H-1: every workspace is a fresh, unique, initially empty root in the OS temp directory", async () => {
  const all = await Promise.all(
    Array.from({ length: 4 }, () => makeWorkspace()),
  );
  const roots = new Set(all.map((workspace) => workspace.root));
  expect(roots.size).toBe(4);
  const prefix = path.join(os.tmpdir(), "xspec-harness-");
  for (const workspace of all) {
    expect(workspace.root.startsWith(prefix)).toBe(true);
    expect(await workspace.readdirNames()).toEqual([]);
  }
  // Workspaces share no state: writing into one leaves the others untouched.
  await all[0]!.file("only-here.txt", "x\n");
  expect(await all[0]!.readdirNames()).toEqual(["only-here.txt"]);
  for (const workspace of all.slice(1)) {
    expect(await workspace.readdirNames()).toEqual([]);
  }
});

test("writes LF, CRLF, and lone-CR string content byte-exactly (no newline translation)", async () => {
  const workspace = await makeWorkspace({
    files: {
      "lf.txt": "one\ntwo\n",
      "crlf.txt": "one\r\ntwo\r\n",
      "cr.txt": "one\rtwo\r",
      "mixed.txt": "a\r\nb\rc\nd",
    },
  });
  expectSameBytes(
    await workspace.readBytes("lf.txt"),
    bytes(0x6f, 0x6e, 0x65, 0x0a, 0x74, 0x77, 0x6f, 0x0a),
  );
  expectSameBytes(
    await workspace.readBytes("crlf.txt"),
    bytes(0x6f, 0x6e, 0x65, 0x0d, 0x0a, 0x74, 0x77, 0x6f, 0x0d, 0x0a),
  );
  expectSameBytes(
    await workspace.readBytes("cr.txt"),
    bytes(0x6f, 0x6e, 0x65, 0x0d, 0x74, 0x77, 0x6f, 0x0d),
  );
  expectSameBytes(
    await workspace.readBytes("mixed.txt"),
    bytes(0x61, 0x0d, 0x0a, 0x62, 0x0d, 0x63, 0x0a, 0x64),
  );
});

test("writes BOM-prefixed content byte-exactly (string and byte declarations)", async () => {
  const workspace = await makeWorkspace({
    files: {
      "bom-string.mdx": "\uFEFF# Doc\n",
      "bom-bytes.bin": bytes(0xef, 0xbb, 0xbf, 0x0d),
      "bom-utf16le.bin": bytes(0xff, 0xfe, 0x41, 0x00),
    },
    // A byte-level probe of the builder, not a 14.20 fixture (S-9).
    mdx: { unchecked: ["bom-string.mdx"] },
  });
  expectSameBytes(
    await workspace.readBytes("bom-string.mdx"),
    bytes(0xef, 0xbb, 0xbf, 0x23, 0x20, 0x44, 0x6f, 0x63, 0x0a),
  );
  expectSameBytes(
    await workspace.readBytes("bom-bytes.bin"),
    bytes(0xef, 0xbb, 0xbf, 0x0d),
  );
  expectSameBytes(
    await workspace.readBytes("bom-utf16le.bin"),
    bytes(0xff, 0xfe, 0x41, 0x00),
  );
});

test("writes invalid-UTF-8 blob contents byte-exactly", async () => {
  const allByteValues = Uint8Array.from({ length: 256 }, (_, i) => i);
  const malformed = bytes(0xc3, 0x28, 0x80, 0xe2, 0x82, 0xf5, 0xff, 0xfe, 0x00);
  const workspace = await makeWorkspace({
    files: {
      "all-bytes.bin": allByteValues,
      "malformed.mdx": malformed,
      "empty.bin": bytes(),
    },
    // A byte-level probe of the builder, not a 14.20 fixture (S-9).
    mdx: { unchecked: ["malformed.mdx"] },
  });
  expectSameBytes(await workspace.readBytes("all-bytes.bin"), allByteValues);
  expectSameBytes(await workspace.readBytes("malformed.mdx"), malformed);
  expect((await workspace.readBytes("empty.bin")).length).toBe(0);

  // A Uint8Array view into a larger buffer writes exactly the viewed bytes.
  const backing = utf8("xxHELLOyy");
  await workspace.file("view.bin", backing.subarray(2, 7));
  expectSameBytes(await workspace.readBytes("view.bin"), utf8("HELLO"));
});

test.runIf(onLinux)(
  "stages byte-string file names containing invalid UTF-8 (Linux; T1.5-2 staging)",
  async () => {
    const workspace = await makeWorkspace({ dirs: ["specs"] });
    const nameBytes = concatBytes(
      utf8("spec-"),
      bytes(0xff, 0xe9),
      utf8(".mdx"),
    );
    const relBytes = concatBytes(utf8("specs/"), nameBytes);
    const contents = concatBytes(utf8("# Title\n"), bytes(0x80, 0xfe));
    // A byte-level probe of the builder, not a 14.20 fixture (S-9).
    await workspace.file(relBytes, contents, { mdx: "unchecked" });

    // The directory holds exactly the declared byte-string name.
    expect((await workspace.readdirBytes("specs")).map(hex)).toEqual([
      hex(nameBytes),
    ]);
    expect(await workspace.kind(relBytes)).toBe("file");
    expectSameBytes(await workspace.readBytes(relBytes), contents);

    // Parent directories with byte-string names are created implicitly.
    const dirBytes = concatBytes(utf8("d"), bytes(0xff));
    const nested = concatBytes(dirBytes, utf8("/inner.mdx"));
    await workspace.file(nested, "x\n");
    expect(await workspace.kind(dirBytes)).toBe("dir");
    expectSameBytes(await workspace.readBytes(nested), utf8("x\n"));

    // `bytePath()`, the byte twin of `path()`: the root's bytes, a `/`, and
    // exactly the relative bytes — raw calls through it create, read, and
    // remove the entry at the declared name bytes (product-chosen names,
    // e.g. graph data under `.xspec/`, SPEC 13.3), and every byte-path form
    // reads the same entry back.
    const rawDir = concatBytes(utf8(".xspec/c"), bytes(0xc3, 0xa9));
    const rawName = concatBytes(utf8("a"), bytes(0xff), utf8(".json"));
    const rawFile = concatBytes(rawDir, utf8("/"), rawName);
    expectSameBytes(
      workspace.bytePath(rawFile),
      concatBytes(utf8(workspace.root), utf8("/"), rawFile),
    );
    await fsp.mkdir(workspace.bytePath(rawDir), { recursive: true });
    await fsp.writeFile(workspace.bytePath(rawFile), contents);
    expect((await workspace.readdirBytes(rawDir)).map(hex)).toEqual([
      hex(rawName),
    ]);
    expect(await workspace.kind(rawFile)).toBe("file");
    expectSameBytes(await workspace.readBytes(rawFile), contents);
    expectSameBytes(
      await fsp.readFile(workspace.bytePath(rawFile)),
      await workspace.readBytes(rawFile),
    );
    await fsp.rm(workspace.bytePath(rawFile));
    expect(await workspace.kind(rawFile)).toBe("absent");
    expect(await workspace.readdirBytes(rawDir)).toEqual([]);
  },
);

test.runIf(onPosix)(
  "creates symbolic links with verbatim targets: live, dangling, directory, cyclic, external",
  async () => {
    const workspace = await makeWorkspace({
      files: { "target.txt": "linked\n" },
      dirs: ["sub"],
      symlinks: { "link.txt": "target.txt", dangling: "missing.txt" },
    });
    await workspace.symlink("dirlink", "sub", "dir");
    await workspace.symlink("cycle-a", "cycle-b");
    await workspace.symlink("cycle-b", "cycle-a");
    await workspace.symlink("external", "../../outside-the-workspace");

    expect(await workspace.kind("link.txt")).toBe("symlink");
    expect(await workspace.linkTarget("link.txt")).toBe("target.txt");
    // A live link resolves to the declared target's bytes.
    expectSameBytes(await workspace.readBytes("link.txt"), utf8("linked\n"));

    // Declaring a link stores its target verbatim and never creates it.
    expect(await workspace.kind("dangling")).toBe("symlink");
    expect(await workspace.linkTarget("dangling")).toBe("missing.txt");
    expect(await workspace.kind("missing.txt")).toBe("absent");

    expect(await workspace.kind("dirlink")).toBe("symlink");
    expect(await workspace.linkTarget("dirlink")).toBe("sub");

    expect(await workspace.linkTarget("cycle-a")).toBe("cycle-b");
    expect(await workspace.linkTarget("cycle-b")).toBe("cycle-a");

    expect(await workspace.linkTarget("external")).toBe(
      "../../outside-the-workspace",
    );
  },
);

test("create() writes exactly the declared tree and nothing else (self-contained root)", async () => {
  const decl = {
    files: {
      "xspec.config.ts":
        'export default { specs: { include: ["specs/**/*.mdx"] } };\n',
      "specs/deep/nested/a.mdx": "# A\n",
      "specs/b.mdx": "# B\r\n",
      "empty.txt": "",
    },
    dirs: ["empty-dir"],
  } satisfies WorkspaceDecl;
  const workspace = await makeWorkspace(decl);

  // Exactly the declared entries — no builder droppings inside the root.
  expect(await workspace.readdirNames()).toEqual([
    "empty-dir",
    "empty.txt",
    "specs",
    "xspec.config.ts",
  ]);
  expect(await workspace.readdirNames("specs")).toEqual(["b.mdx", "deep"]);
  expect(await workspace.readdirNames("specs/deep")).toEqual(["nested"]);
  expect(await workspace.readdirNames("specs/deep/nested")).toEqual(["a.mdx"]);
  expect(await workspace.readdirNames("empty-dir")).toEqual([]);
  expect(await workspace.kind("empty-dir")).toBe("dir");
  for (const [rel, contents] of Object.entries(decl.files)) {
    expectSameBytes(await workspace.readBytes(rel), utf8(contents));
  }
});

test("scripts git commits with pinned identities and timestamps, read back exactly", async () => {
  const crlfSecond = "# A\r\nbody two\r\n";
  const workspace = await makeWorkspace({
    files: { "specs/a.mdx": "# A\r\nbody\r\n", "note.txt": "n\n" },
  });
  await workspace.gitInit();
  const first = await workspace.gitCommitAll("first commit");
  await workspace.file("specs/a.mdx", crlfSecond);
  const second = await workspace.gitCommitAll("second commit", {
    author: { name: "Alice Author", email: "alice@example.invalid" },
    committer: { name: "Carl Committer", email: "carl@example.invalid" },
    authorDate: "1234567890 +0000",
    committerDate: "1234567950 +0000",
  });

  expect(first).toMatch(/^[0-9a-f]{40}$/);
  expect(second).toMatch(/^[0-9a-f]{40}$/);
  expect(second).not.toBe(first);
  expect((await workspace.git(["rev-parse", "HEAD"])).stdout.trim()).toBe(
    second,
  );

  const { stdout } = await workspace.git([
    "log",
    "--format=%H%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%s",
  ]);
  const records = stdout
    .trim()
    .split("\n")
    .map((line) => line.split("\u001f"));
  expect(records).toEqual([
    [
      second,
      "Alice Author",
      "alice@example.invalid",
      "1234567890",
      "Carl Committer",
      "carl@example.invalid",
      "1234567950",
      "second commit",
    ],
    [
      first,
      GIT_FIXTURE_PERSON.name,
      GIT_FIXTURE_PERSON.email,
      String(GIT_FIXTURE_EPOCH_SECONDS),
      GIT_FIXTURE_PERSON.name,
      GIT_FIXTURE_PERSON.email,
      String(GIT_FIXTURE_EPOCH_SECONDS),
      "first commit",
    ],
  ]);

  // Everything was committed, and scripting never munged worktree bytes
  // (CRLF survives: newline conversion is pinned off).
  expect((await workspace.git(["status", "--porcelain"])).stdout).toBe("");
  expectSameBytes(await workspace.readBytes("specs/a.mdx"), utf8(crlfSecond));
});

test("identically scripted repositories realize identical commit hashes (E-6 determinism)", async () => {
  const script = async (): Promise<readonly string[]> => {
    const workspace = await makeWorkspace({
      files: {
        "specs/a.mdx": "# A\r\n",
        "raw.bin": bytes(0xff, 0x00, 0xc3, 0x28),
      },
    });
    await workspace.gitInit();
    const first = await workspace.gitCommitAll("first");
    await workspace.file("specs/a.mdx", "# A\r\nmore\r\n");
    const second = await workspace.gitCommitAll("second");
    return [first, second];
  };
  const [left, right] = await Promise.all([script(), script()]);
  expect(left).toEqual(right);
});

test("ambient git environment and configuration never leak into scripted commits", async () => {
  const ambient: Record<string, string> = {
    GIT_AUTHOR_NAME: "Ambient Author",
    GIT_AUTHOR_EMAIL: "ambient@example.invalid",
    GIT_AUTHOR_DATE: "999999999 +0300",
    GIT_COMMITTER_NAME: "Ambient Committer",
    GIT_COMMITTER_EMAIL: "ambient-c@example.invalid",
    GIT_COMMITTER_DATE: "888888888 +0300",
    EMAIL: "ambient-fallback@example.invalid",
  };
  const saved = new Map<string, string | undefined>(
    Object.keys(ambient).map((key) => [key, process.env[key]]),
  );
  try {
    Object.assign(process.env, ambient);
    const workspace = await makeWorkspace({ files: { "a.txt": "a\n" } });
    await workspace.gitInit();
    await workspace.gitCommitAll("pinned despite ambient env");
    const { stdout } = await workspace.git([
      "log",
      "-1",
      "--format=%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct",
    ]);
    expect(stdout.trim().split("\u001f")).toEqual([
      GIT_FIXTURE_PERSON.name,
      GIT_FIXTURE_PERSON.email,
      String(GIT_FIXTURE_EPOCH_SECONDS),
      GIT_FIXTURE_PERSON.name,
      GIT_FIXTURE_PERSON.email,
      String(GIT_FIXTURE_EPOCH_SECONDS),
    ]);
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});

test("rejects declarations escaping the workspace root", async () => {
  const workspace = await makeWorkspace();
  expect(() => workspace.path("../outside")).toThrow(
    /escapes the workspace root/,
  );
  expect(() => workspace.path("/etc/passwd")).toThrow(
    /escapes the workspace root/,
  );
  await expect(workspace.file("../evil.txt", "x")).rejects.toThrow(
    /escapes the workspace root/,
  );
  await expect(workspace.file(utf8("../evil.txt"), "x")).rejects.toThrow(
    /'\.\.' segment/,
  );
  await expect(workspace.file(bytes(0x2f, 0x61), "x")).rejects.toThrow(
    /workspace-relative/,
  );
  // `bytePath()` validates like every byte path: it never leaves the root.
  expect(() => workspace.bytePath(utf8("a/../../evil.txt"))).toThrow(
    /'\.\.' segment/,
  );
  expect(() => workspace.bytePath(bytes(0x2f, 0x61))).toThrow(
    /workspace-relative/,
  );
  expect(() => workspace.bytePath(utf8("a/./b"))).toThrow(/'\.' segment/);
  expect(() => workspace.bytePath(utf8("a//b"))).toThrow(/empty segment/);
  expect(() => workspace.bytePath(bytes(0x61, 0x00))).toThrow(/NUL/);
  expect(() => workspace.bytePath(bytes())).toThrow(/empty/);
  // In-root normalization is not an escape.
  expect(workspace.path("a/../b.txt")).toBe(workspace.path("b.txt"));
});

test("dispose() removes the workspace entirely, read-only git objects included", async () => {
  const workspace = await makeWorkspace({ files: { "a.txt": "a\n" } });
  await workspace.gitInit();
  await workspace.gitCommitAll("to be deleted");
  await workspace.dispose();
  await expect(fsp.lstat(workspace.root)).rejects.toMatchObject({
    code: "ENOENT",
  });
  await expect(fsp.lstat(workspace.tempRoot)).rejects.toMatchObject({
    code: "ENOENT",
  });
});

// ---------------------------------------------------------------------------
// Scale vectors (S-2): the suite's staged maxima, read back byte-complete.
// Every vector is built iteratively — string repetition, buffer
// concatenation, one loop over the levels — never by recursion, and compared
// as whole byte arrays read back from disk through plain `fs`, independently
// of the builder's own readers.

/** Whole-array comparison with a diagnosable first-mismatch report. */
function expectByteComplete(actual: Uint8Array, expected: Uint8Array): void {
  expect(actual.length).toBe(expected.length);
  let mismatch = -1;
  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) {
      mismatch = index;
      break;
    }
  }
  expect(mismatch, "first differing byte offset (-1 = identical)").toBe(-1);
}

/** Occurrences of `needle` in `haystack`, scanned iteratively. */
function countOccurrences(haystack: Uint8Array, needle: string): number {
  const buffer = Buffer.from(
    haystack.buffer,
    haystack.byteOffset,
    haystack.length,
  );
  let count = 0;
  for (
    let index = buffer.indexOf(needle, 0, "utf8");
    index >= 0;
    index = buffer.indexOf(needle, index + 1, "utf8")
  ) {
    count += 1;
  }
  return count;
}

test("scale vector: one `.mdx` file nesting sections 4096 deep — P-8's staged tower, read back byte-complete", async () => {
  // The tower the suite stages (sectionTowerSource(4096, balanced), the
  // bytes a P-8 nesting draw appends): 11 bytes per opener line, one
  // six-byte content line, 5 bytes per closer line.
  const expected = utf8(TOWER_SOURCE);
  expect(DEEPEST_STAGED_TOWER).toBe(4096);
  expect(DEEPEST_STAGED_TOWER).toBeGreaterThanOrEqual(GIANT_NESTING_FLOOR);
  expect(expected.length).toBe(
    DEEPEST_STAGED_TOWER * 11 + 6 + DEEPEST_STAGED_TOWER * 5,
  );

  // Declared through the builder's declarative path (create → file).
  const workspace = await makeWorkspace({
    files: { "specs/tower.mdx": TOWER_SOURCE },
  });

  // The builder's own listing reports the file once, as a regular file, at
  // the full declared size.
  expect(await workspace.readdirNames()).toEqual(["specs"]);
  expect(await workspace.readdirNames("specs")).toEqual(["tower.mdx"]);
  expect(await workspace.kind("specs/tower.mdx")).toBe("file");
  const abs = path.join(workspace.root, "specs", "tower.mdx");
  expect((await fsp.stat(abs)).size).toBe(expected.length);

  // Read back from disk with plain fs: byte-complete, and still 4096 levels
  // deep — every opener and closer present, so the staged depth is the
  // declared depth, at or past P-8's floor.
  const actual = new Uint8Array(await fsp.readFile(abs));
  expectByteComplete(actual, expected);
  expect(countOccurrences(actual, '<S id="g">\n')).toBe(DEEPEST_STAGED_TOWER);
  expect(countOccurrences(actual, "</S>\n")).toBe(DEEPEST_STAGED_TOWER);
  expect(countOccurrences(actual, "deep.\n")).toBe(1);
});

test("scale vector: the largest document any generator draw stages (fuzz base plus the whole mutation budget of towers), read back byte-complete", async () => {
  // Derivation (staged-scale.ts, shared with S-8): the largest file any
  // generator draw stages is the largest fuzz base file (`specs/A.mdx`) with
  // all three mutations of P-8's budget appending the deepest balanced tower
  // — 204 + 3 × 65 542 = 196 830 bytes; every P-2/P-3, P-4, and P-9 draw is
  // far smaller. The deterministic fixture T1.3-7 stages a document ~21×
  // larger — the largest document the suite stages, the next vector's
  // subject. Staged exactly as P-8's driver stages a trial: the base
  // workspace declared, then the mutated bytes written over the base file
  // through `file` — the imperative path.
  const [basePath] = LARGEST_BASE_FILE;
  const expected = largestGeneratedDocument();
  expect(expected.length).toBe(LARGEST_GENERATED_INPUT_BYTES);
  expect(LARGEST_GENERATED_INPUT_BYTES).toBe(196_830);
  expect(basePath).toBe("specs/A.mdx");

  const workspace = await makeWorkspace({
    files: Object.fromEntries(FUZZ_BASE_FILES),
  });
  await workspace.file(basePath, expected);

  // The builder's own listing reports the file once, as a regular file, at
  // the full declared size — the base workspace's other entries untouched.
  expect(await workspace.readdirNames("specs")).toEqual(["A.mdx", "B.mdx"]);
  expect(await workspace.kind(basePath)).toBe("file");
  const abs = path.join(workspace.root, ...basePath.split("/"));
  expect((await fsp.stat(abs)).size).toBe(LARGEST_GENERATED_INPUT_BYTES);

  // Read back from disk with plain fs, byte-complete: the base text intact
  // at the front, all three towers behind it.
  const actual = new Uint8Array(await fsp.readFile(abs));
  expectByteComplete(actual, expected);
  expectSameBytes(
    actual.subarray(0, Buffer.byteLength(LARGEST_BASE_FILE[1], "utf8")),
    utf8(LARGEST_BASE_FILE[1]),
  );
  expect(countOccurrences(actual, '<S id="g">\n')).toBe(
    3 * DEEPEST_STAGED_TOWER,
  );
  expect(countOccurrences(actual, "deep.\n")).toBe(3);
  for (const [rel, text] of FUZZ_BASE_FILES) {
    if (rel !== basePath) {
      expectSameBytes(await workspace.readBytes(rel), utf8(text));
    }
  }
});

test("scale vector: the largest document the suite stages — T1.3-7's 2048-deep chained-id tower (4 225 030 bytes), read back byte-complete", async () => {
  // Derivation (staged-scale.ts, shared with S-8): the largest document the
  // suite stages is deterministic — T1.3-7's `specs/A.mdx`, nesting sections
  // DEPTH_FLOOR deep with chained ids (`a`, `a.b`, `a.b.c`, …;
  // section-1.3.ts). Every id spells its whole ancestor chain, so the file is
  // quadratic in the depth: 9·D + D·(D + 1) + 6 + 5·D = 4 225 030 bytes at
  // D = 2048, ~21× the generator maximum above — the truncation window the
  // two vectors above cannot see. `expected` is the document byte for byte;
  // the exact-size pins move only when DEPTH_FLOOR does — deliberately.
  const tower = depthTower(DEPTH_FLOOR);
  const expected = largestDeterministicDocument();
  expect(DEPTH_FLOOR).toBe(2048);
  expect(DEPTH_FLOOR).toBeGreaterThanOrEqual(GIANT_NESTING_FLOOR);
  expect(expected.length).toBe(LARGEST_DETERMINISTIC_INPUT_BYTES);
  expect(expected.length).toBe(4_225_030);
  expectByteComplete(expected, utf8(tower.source));
  // The vector's subject is the suite's staged maximum, not merely the
  // deterministic one: this pin fails the day a generator bound outgrows
  // T1.3-7's document, when the title above stops being true and the vector
  // must move with it.
  expect(LARGEST_STAGED_INPUT_BYTES).toBe(expected.length);

  // Staged exactly as T1.3-7 stages it: `specs/A.mdx` declared through the
  // builder's declarative path (create → file), the byte class the fixture
  // exercises — its `xspec.config.ts` is irrelevant to the builder.
  const workspace = await makeWorkspace({
    files: { "specs/A.mdx": tower.source },
  });

  // The builder's own listing reports the file once, as a regular file, at
  // the full declared size.
  expect(await workspace.readdirNames()).toEqual(["specs"]);
  expect(await workspace.readdirNames("specs")).toEqual(["A.mdx"]);
  expect(await workspace.kind("specs/A.mdx")).toBe("file");
  const abs = path.join(workspace.root, "specs", "A.mdx");
  expect((await fsp.stat(abs)).size).toBe(4_225_030);

  // Read back from disk with plain fs: byte-complete, and still the declared
  // chain end to end — not merely DEPTH_FLOOR openers of any ids: every
  // opener and closer, the one content line, every line feed, and the
  // outermost (`a`) and innermost (4 095-character) ids each exactly once.
  const actual = new Uint8Array(await fsp.readFile(abs));
  expectByteComplete(actual, expected);
  expect(countOccurrences(actual, '<S id="')).toBe(DEPTH_FLOOR);
  expect(countOccurrences(actual, "</S>\n")).toBe(DEPTH_FLOOR);
  expect(countOccurrences(actual, "deep.\n")).toBe(1);
  expect(countOccurrences(actual, "\n")).toBe(2 * DEPTH_FLOOR + 1);
  expect(2 * DEPTH_FLOOR + 1).toBe(4_097);
  expect(tower.ids).toHaveLength(DEPTH_FLOOR);
  const outermost = tower.ids[0]!;
  const innermost = tower.ids[DEPTH_FLOOR - 1]!;
  expect(outermost).toBe("a");
  expect(innermost).toHaveLength(2 * DEPTH_FLOOR - 1);
  expect(innermost).toHaveLength(4_095);
  expect(countOccurrences(actual, `<S id="${outermost}">\n`)).toBe(1);
  expect(countOccurrences(actual, `<S id="${innermost}">\n`)).toBe(1);
});

// ---------------------------------------------------------------------------
// S-9's TypeScript check at staging time (TEST-SPEC S-9's TypeScript clause,
// H-8; helpers/workspace.ts): the builder judges every staged code source and
// configuration file with `judgeTypeScript` (helpers/ts-derivability.ts — the
// harness's own TypeScript 5.9.3 parser, both readings) as it judges `.mdx`
// sources. A name `TS_DEFAULT_SUFFIXES` reaches is declared well-formed by
// default; a staging declares the exceptions per path (`ts: { unparseable,
// unchecked, wellFormed }`, or per `file()` call). A contradiction, and a
// text accepted read one way only, throw `HarnessStagingError` (mode
// `ts-derivability`) before anything is written — a harness error, never an
// assertion failure and never a skip.

const TS_WELL_FORMED = "export const n = 1;\n";
/** Rejected both ways: TS1134 at the `=` (byte offset 13). */
const TS_ILL_FORMED = "export const = 1;\n";
/** SPEC 14.20's one-way texts: module code only, and script code only. */
const TS_MODULE_ONLY = "await /re/;\n";
const TS_SCRIPT_ONLY = "let a = await / 2 / 1;\n";
/** A TSX-only construct: well-formed in a `.tsx` file, nowhere else. */
const TSX_ONLY = "export const v = <b>x</b>;\n";
const TS_BOM_BYTES = concatBytes(bytes(0xef, 0xbb, 0xbf), utf8(TS_WELL_FORMED));
const TS_INVALID_UTF8_BYTES = concatBytes(
  utf8("export const n = 1; // "),
  bytes(0xff, 0x0a),
);
/** T7-2's syntax-error configuration: its braces never close. */
const UNCLOSED_CONFIG =
  'import { defineConfig } from "xspec"\n\nexport default defineConfig({\n' +
  '  specs: {\n    main: ["specs/**/*.mdx"]\n';

async function expectTsStagingError(
  action: () => Promise<unknown>,
  stagedPath: string,
  ...fragments: readonly string[]
): Promise<HarnessStagingError> {
  let thrown: unknown;
  try {
    await action();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(HarnessStagingError);
  expect(thrown).not.toBeInstanceOf(HarnessAssertionError);
  const error = thrown as HarnessStagingError;
  expect(error.mode).toBe("ts-derivability");
  expect(error.path).toBe(stagedPath);
  expect(error.message).toContain(`ts-derivability staging of ${stagedPath}: `);
  for (const fragment of fragments) {
    expect(error.message).toContain(fragment);
  }
  return error;
}

test("S-9 TypeScript vector: a declared-well-formed ill-formed `.ts` throws at staging, naming the path and the parser's first error", async () => {
  await expectTsStagingError(
    () => TestWorkspace.create({ files: { "src/a.ts": TS_ILL_FORMED } }),
    "src/a.ts",
    "declared well-formed, but it is not well-formed TypeScript (5.9.3",
    'TS1134 "Variable declaration expected." at line 1, column 14 (byte offset 13)',
    "`ts.unparseable`",
  );
  // Declared well-formed explicitly — the same verdict.
  await expectTsStagingError(
    () =>
      TestWorkspace.create({
        files: { "src/a.ts": TS_ILL_FORMED },
        ts: { wellFormed: ["src/a.ts"] },
      }),
    "src/a.ts",
    "declared well-formed",
  );
  // The configuration file is judged by the same grammar (SPEC 7, 14.20).
  await expectTsStagingError(
    () =>
      TestWorkspace.create({ files: { "xspec.config.ts": UNCLOSED_CONFIG } }),
    "xspec.config.ts",
    "declared well-formed",
    "TS1005",
  );
  // 14.20's encoding rules: a byte-order mark and invalid UTF-8.
  await expectTsStagingError(
    () => TestWorkspace.create({ files: { "src/a.ts": TS_BOM_BYTES } }),
    "src/a.ts",
    "byte-order mark",
  );
  await expectTsStagingError(
    () =>
      TestWorkspace.create({ files: { "src/a.ts": TS_INVALID_UTF8_BYTES } }),
    "src/a.ts",
    "not valid UTF-8: an invalid sequence at byte offset 23",
  );
  // The name selects the grammar: a TSX-only construct in a `.ts` file.
  await expectTsStagingError(
    () => TestWorkspace.create({ files: { "src/v.ts": TSX_ONLY } }),
    "src/v.ts",
    "declared well-formed",
  );
  const workspace = await makeWorkspace({
    files: { "src/v.tsx": TSX_ONLY, "src/a.ts": TS_WELL_FORMED },
  });
  expect(Buffer.from(await workspace.readBytes("src/v.tsx")).toString()).toBe(
    TSX_ONLY,
  );
  expect(workspace.tsDeclarationOf("src/v.tsx")).toBe("well-formed");
});

test("S-9 TypeScript vector: a declared-unparseable well-formed `.ts` throws at staging; an ill-formed one stages", async () => {
  await expectTsStagingError(
    () =>
      TestWorkspace.create({
        files: { "src/a.ts": TS_WELL_FORMED },
        ts: { unparseable: ["src/a.ts"] },
      }),
    "src/a.ts",
    "declared unparseable, but TypeScript 5.9.3 accepts it both as module code and as script code",
  );
  await expectTsStagingError(
    () =>
      TestWorkspace.create({
        files: { "src/v.tsx": TSX_ONLY },
        ts: { unparseable: ["src/v.tsx"] },
      }),
    "src/v.tsx",
    "declared unparseable",
  );
  const workspace = await makeWorkspace({
    files: {
      "src/a.ts": TS_ILL_FORMED,
      "src/v.ts": TSX_ONLY,
      "src/bom.ts": TS_BOM_BYTES,
      "src/bad.ts": TS_INVALID_UTF8_BYTES,
      "xspec.config.ts": UNCLOSED_CONFIG,
    },
    ts: {
      unparseable: [
        "src/a.ts",
        "src/v.ts",
        "src/bom.ts",
        "src/bad.ts",
        "xspec.config.ts",
      ],
    },
  });
  expect(workspace.tsDeclarationOf("src/a.ts")).toBe("unparseable");
  expectSameBytes(await workspace.readBytes("src/bom.ts"), TS_BOM_BYTES);
  expectSameBytes(
    await workspace.readBytes("src/bad.ts"),
    TS_INVALID_UTF8_BYTES,
  );
  expectSameBytes(
    await workspace.readBytes("xspec.config.ts"),
    utf8(UNCLOSED_CONFIG),
  );
});

test("S-9 TypeScript vector: a text accepted read one way only throws under either declaration — module code only and script code only", async () => {
  for (const [text, fragment] of [
    [
      TS_MODULE_ONLY,
      "accepted read as module code only, rejected read as script code",
    ],
    [
      TS_SCRIPT_ONLY,
      "accepted read as script code only, rejected read as module code",
    ],
  ] as const) {
    await expectTsStagingError(
      () => TestWorkspace.create({ files: { "src/a.ts": text } }),
      "src/a.ts",
      "declared well-formed",
      fragment,
      "whatever its declaration (S-9)",
      "restage the fixture",
    );
    await expectTsStagingError(
      () =>
        TestWorkspace.create({
          files: { "src/a.ts": text },
          ts: { unparseable: ["src/a.ts"] },
        }),
      "src/a.ts",
      "declared unparseable",
      fragment,
    );
    // A file whose well-formedness the document does not declare is never
    // judged, a one-way text included.
    const workspace = await makeWorkspace({
      files: { "src/a.ts": text },
      ts: { unchecked: ["src/a.ts"] },
    });
    expect(Buffer.from(await workspace.readBytes("src/a.ts")).toString()).toBe(
      text,
    );
  }
});

test("S-9 TypeScript default: the names `TS_DEFAULT_SUFFIXES` reaches are judged; any other name only when declared", async () => {
  expect([...TS_DEFAULT_SUFFIXES]).toEqual([
    ".ts",
    ".tsx",
    ".mts",
    ".cts",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
  ]);
  const workspace = await makeWorkspace({
    files: {
      // Not judged by default: a code group may glob these names, so a code
      // source among them declares itself.
      "specs/A.md": TS_ILL_FORMED,
      "notes.txt": TS_ILL_FORMED,
      "src/a.TS": TS_ILL_FORMED,
      "data.json": TS_ILL_FORMED,
    },
  });
  for (const rel of [
    "src/a.ts",
    "src/a.tsx",
    "src/a.mts",
    "src/a.cts",
    "src/a.d.ts",
    "src/a.d.mts",
    "src/a.js",
    "src/a.jsx",
    "src/a.mjs",
    "src/a.cjs",
    "xspec.config.ts",
    "cfg/broken.config.ts",
  ]) {
    expect(workspace.tsDeclarationOf(rel)).toBe("well-formed");
    await expectTsStagingError(
      () => workspace.file(rel, TS_ILL_FORMED),
      rel,
      "declared well-formed",
    );
  }
  for (const rel of [
    "specs/A.md",
    "notes.txt",
    "src/a.TS",
    "data.json",
    "specs/A.mdx",
  ]) {
    expect(workspace.tsDeclarationOf(rel)).toBeUndefined();
  }
  // A code source whose name the default does not reach is declared: T7-6's
  // `specs/a'b.md` holding `)` unparseable, T13.4-11(b)'s `specs/A.md`
  // holding `export const n = 1` well-formed.
  const declared = await makeWorkspace({
    files: { "specs/a'b.md": ")", "specs/A.md": "export const n = 1\n" },
    ts: { unparseable: ["specs/a'b.md"], wellFormed: ["specs/A.md"] },
  });
  expect(declared.tsDeclarationOf("specs/a'b.md")).toBe("unparseable");
  expect(declared.tsDeclarationOf("specs/A.md")).toBe("well-formed");
  await expectTsStagingError(
    () =>
      TestWorkspace.create({
        files: { "specs/A.md": ")" },
        ts: { wellFormed: ["specs/A.md"] },
      }),
    "specs/A.md",
    "declared well-formed",
    'TS1128 "Declaration or statement expected."',
  );
  await expectTsStagingError(
    () =>
      TestWorkspace.create({
        files: { "specs/a'b.md": "export const n = 1\n" },
        ts: { unparseable: ["specs/a'b.md"] },
      }),
    "specs/a'b.md",
    "declared unparseable",
  );
});

test("S-9 TypeScript declarations: the workspace declaration governs later stagings — `file()`, `edit()`, `copyFrom()` — and a `ts` option overrides it for one write", async () => {
  const workspace = await makeWorkspace({
    files: { "src/a.ts": TS_WELL_FORMED },
    ts: { unparseable: ["src/u.ts"], unchecked: ["src/n.ts"] },
  });
  await workspace.file("src/u.ts", TS_ILL_FORMED);
  await expectTsStagingError(
    () => workspace.file("src/u.ts", TS_WELL_FORMED),
    "src/u.ts",
    "declared unparseable",
  );
  await workspace.file("src/u.ts", TS_WELL_FORMED, { ts: "well-formed" });
  await workspace.file("src/n.ts", TS_ILL_FORMED);
  await workspace.file("src/n.ts", TS_MODULE_ONLY);
  await workspace.file("src/b.ts", TS_ILL_FORMED, { ts: "unparseable" });
  await workspace.file("src/c.ts", TS_SCRIPT_ONLY, { ts: "unchecked" });
  await workspace.file("specs/A.md", ")", { ts: "unparseable" });
  await expectTsStagingError(
    () => workspace.file("specs/B.md", ")", { ts: "well-formed" }),
    "specs/B.md",
    "declared well-formed",
  );
  // A byte path is keyed by its decoding.
  await expectTsStagingError(
    () => workspace.file(utf8("src/d.ts"), TS_ILL_FORMED),
    "src/d.ts",
    "declared well-formed",
  );
  // `edit()` and `copyFrom()` stage under the destination's declaration.
  await expectTsStagingError(
    () => workspace.edit("src/a.ts", "n = 1", "= 1"),
    "src/a.ts",
    "declared well-formed",
  );
  expect(Buffer.from(await workspace.readBytes("src/a.ts")).toString()).toBe(
    TS_WELL_FORMED,
  );
  await workspace.edit("src/n.ts", "await", "await await");
  const source = await makeWorkspace({
    files: { "src/x.ts": TS_ILL_FORMED },
    ts: { unchecked: ["src/x.ts"] },
  });
  await expectTsStagingError(
    () => workspace.copyFrom(source, "src/x.ts", "src/y.ts"),
    "src/y.ts",
    "declared well-formed",
  );
  await workspace.copyFrom(source, "src/x.ts", "src/u.ts");
  expect(Buffer.from(await workspace.readBytes("src/u.ts")).toString()).toBe(
    TS_ILL_FORMED,
  );
});

test("S-9 TypeScript declarations: a refused staging writes nothing; a path in two lists is refused at creation", async () => {
  const workspace = await makeWorkspace({
    files: { "src/a.ts": TS_WELL_FORMED },
  });
  await expectTsStagingError(
    () => workspace.file("src/a.ts", TS_ILL_FORMED),
    "src/a.ts",
  );
  expect(Buffer.from(await workspace.readBytes("src/a.ts")).toString()).toBe(
    TS_WELL_FORMED,
  );
  await expectTsStagingError(
    () => workspace.file("src/deep/b.ts", TS_ILL_FORMED),
    "src/deep/b.ts",
  );
  expect(await workspace.kind("src/deep")).toBe("absent");
  await expectTsStagingError(
    () =>
      TestWorkspace.create({
        ts: { unparseable: ["src/a.ts"], unchecked: ["./src/a.ts"] },
      }),
    "src/a.ts",
    "more than one",
  );
  await expectTsStagingError(
    () =>
      TestWorkspace.create({
        ts: { wellFormed: ["specs/A.md"], unparseable: ["specs//A.md"] },
      }),
    "specs/A.md",
    "more than one",
  );
});
