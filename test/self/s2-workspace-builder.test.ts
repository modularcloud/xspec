// S-2 Workspace builder self-test (TEST-SPEC 17). The fixture builder must
// write exactly the declared bytes — round-trip checks covering every
// declared-byte class: LF/CRLF/lone-CR content, BOMs, invalid-UTF-8 blobs
// (contents, and byte-string file names on Linux — T1.5-2 staging), symbolic
// links (verbatim targets: live, dangling, directory, cyclic, external —
// T7-5, T13.4-6), and git fixtures with scripted commits carrying pinned,
// platform-independent identities and timestamps (E-6) — and scale vectors
// at the suite's staged maxima (`staged-scale.ts`, shared with S-8): the
// 4096-deep section tower P-8's giant-nesting draws stage and the largest
// document any draw stages, each read back byte-complete, so a truncating
// writer or recursion-limited serializer cannot silently stage shallower or
// smaller inputs than declared (H-11's input side). Certification cannot
// exercise builder bugs that make fixtures diverge from their declarations,
// so this self-test must pass before any fixture is trusted.
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
import {
  GIT_FIXTURE_EPOCH_SECONDS,
  GIT_FIXTURE_PERSON,
  TestWorkspace,
} from "../helpers/workspace.js";
import type { WorkspaceDecl } from "../helpers/workspace.js";
import { FUZZ_BASE_FILES } from "../suite/registry/section-16-p8.js";
import {
  DEEPEST_STAGED_TOWER,
  GIANT_NESTING_FLOOR,
  LARGEST_BASE_FILE,
  LARGEST_GENERATED_INPUT_BYTES,
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
    await workspace.file(relBytes, contents);

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
// Both vectors are built by string repetition and buffer concatenation —
// never by recursion — and compared as whole byte arrays read back from disk
// through plain `fs`, independently of the builder's own readers.

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

test("scale vector: the largest document the suite stages (fuzz base plus the whole mutation budget of towers), read back byte-complete", async () => {
  // Derivation (staged-scale.ts, shared with S-8): the largest staged file
  // is the largest fuzz base file (`specs/A.mdx`) with all three mutations
  // of P-8's budget appending the deepest balanced tower — 204 + 3 × 65 542
  // = 196 830 bytes; every deterministic fixture is far smaller (the
  // largest, T4.1's own-text probe, ~33 KiB) and so is every P-2/P-3, P-4,
  // and P-9 draw. Staged exactly as P-8's driver stages a trial: the base
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
