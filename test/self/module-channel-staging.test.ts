// Self-checks for the module channel's stagings (TEST-SPEC 17 preamble:
// internal self-tests cover harness machinery certification does not
// exercise; §7.6 Placement, H-1, H-2, H-8, C-2; SPEC 7.6 Package and
// installation, Reach; helpers/module-channel.ts). No test of 7.6 is
// registered yet, so the machinery every one of them will stage through is
// pinned here on its own, before any product exists:
// - the package directory: none given fails diagnosed before anything is
//   staged (H-8); on the built product's binding a directory that does not
//   exist is its missing product, diagnosed likewise, and on any other a
//   harness error; a relative path, a plain file, a development tree (an
//   entry named `node_modules` at its root, of any kind), and an entry that
//   is neither a plain file, a directory, nor a symbolic link (a FIFO, made
//   by helpers/lock-staging.ts's `stageFifo` and never opened) are harness
//   errors on every binding;
// - placement by copy alone: the copy at `node_modules/N` is byte-equal to
//   the source, modes and symbolic links kept, and the source is untouched,
//   read entry by entry before and after; a symbolic-link placement reaches
//   a copy elsewhere in the staging, under no `node_modules`;
// - N's grammar and exclusions on vectors, `fs` and `path` refused on a
//   runtime arm — each of E-1's releases asked, so XSPEC_NODE_RELEASES_DIR
//   must name them, as CI's harness-self job and AGENTS.md's recipe do —
//   and admitted on a type-checking one; the canonical N; the manifest's
//   name;
// - H-1 through Task 8's module: a staging under an ancestor holding a
//   `package.json` or a `node_modules` entry is refused, and so is a run
//   whose fresh HOME holds a global module folder's entry;
// - the three project kinds, each confirmed on its finished staging;
// - each Reach condition refused when broken, and admitted where Reach bars
//   nothing (an unrelated package at `node_modules/a` beside `a.js`, an
//   ancestor manifest named `unrelated`), and the canonical placement's
//   "nothing else installed";
// - no staging write lands in a placed copy (H-2).
//
// The stand-in package, test/fixtures/module-channel-standin/, documented
// here since JSON holds no comment: a small hand-written, non-xspec package
// — `package.json` naming `module-channel-standin`, version `1.0.0`, `main`
// `index.js`, and `types` `index.d.ts`; `index.js`, a CommonJS module
// exporting `answer`; `index.d.ts`, its declaration; and `lib/helper.js`, so
// that a copy has a directory to keep. Nothing here loads or type-checks
// it: what it serves is a directory to place. Stagings with modes and
// links of their own are made from it at run time, under the OS temporary
// directory, so the committed tree holds no symbolic link.

import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import { stageFifo } from "../helpers/lock-staging.js";
import {
  builtInNamesOn,
  CANONICAL_MODULE_NAMES,
  canonicalModuleName,
  describeTreeDifference,
  judgeManifestBytes,
  MODULE_NAME_MAX_LENGTH,
  MODULE_STAGING_PREFIX,
  ModuleStaging,
  moduleNameExclusion,
  moduleNameGrammarProblem,
  modulePackageDirectory,
  PROJECT_KINDS,
  readManifestName,
  readPackageTree,
  runtimeArm,
  TYPE_CHECKING_ARM,
  verifyModuleName,
} from "../helpers/module-channel.js";
import type {
  ModuleArm,
  PackageTree,
  Placement,
  PlacementForm,
  ProjectKind,
} from "../helpers/module-channel.js";
import { resolveNodeReleases } from "../helpers/node-releases.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import { builtProductBindingAt } from "../helpers/subprocess.js";
import type { ProductBinding } from "../helpers/subprocess.js";

/** The committed stand-in package (module header), resolved like a fixture. */
const STANDIN_PACKAGE_DIR = fileURLToPath(
  new URL("../fixtures/module-channel-standin", import.meta.url),
);

/** The name the stand-in's manifest gives. */
const STANDIN_NAME = "module-channel-standin";

/** S-7's stub package (test/self/s7-red-green-sweep.test.ts). */
const STUB_PACKAGE_DIR = fileURLToPath(
  new URL("../fixtures/empty-stub-package", import.meta.url),
);

const BACKSLASH = String.fromCodePoint(0x5c);
const BYTE_ORDER_MARK = String.fromCodePoint(0xfeff);

/**
 * A binding of the certification fixtures' shape beside `packageDir`: its
 * executable is never run here, and a missing package directory is no
 * diagnosed missing product on it.
 */
function standInBinding(packageDir?: string): ProductBinding {
  return {
    label: "module-channel stand-in binding",
    command: process.execPath,
    requiredFiles: [process.execPath],
    ...(packageDir === undefined ? {} : { packageDir }),
  };
}

/** The built product's binding shape beside `packageDir`. */
function builtBinding(packageDir?: string): ProductBinding {
  const binding = builtProductBindingAt(
    path.join(os.tmpdir(), "xspec-module-channel-absent", "bin.js"),
  );
  return packageDir === undefined ? binding : { ...binding, packageDir };
}

/** A fresh, empty directory of this test's own, removed once it ends. */
async function freshDirectory(): Promise<string> {
  const directory = await fsp.realpath(
    await fsp.mkdtemp(path.join(os.tmpdir(), "xspec-module-channel-probe-")),
  );
  onTestFinished(() => fsp.rm(directory, { recursive: true, force: true }));
  return directory;
}

/** A staging beside `packageDir`, disposed once the test ends. */
async function stagingBeside(
  packageDir: string = STANDIN_PACKAGE_DIR,
  context = "module-channel self-test",
): Promise<ModuleStaging> {
  const staging = await ModuleStaging.create(
    standInBinding(packageDir),
    context,
  );
  onTestFinished(() => staging.dispose());
  return staging;
}

/** A copy of the committed stand-in in `into`, made file by file. */
async function copyOfStandIn(into: string): Promise<string> {
  const directory = path.join(into, "package");
  await fsp.mkdir(path.join(directory, "lib"), { recursive: true });
  for (const file of [
    "package.json",
    "index.js",
    "index.d.ts",
    "lib/helper.js",
  ]) {
    await fsp.copyFile(
      path.join(STANDIN_PACKAGE_DIR, file),
      path.join(directory, file),
    );
  }
  return directory;
}

/** What `pending` rejected with (a test failure where it resolved). */
async function rejectionOf(
  pending: Promise<unknown>,
  what: string,
): Promise<unknown> {
  try {
    await pending;
  } catch (error) {
    return error;
  }
  throw new Error(`expected ${what} to reject, but it resolved`);
}

/**
 * `pending` rejects with the module channel's harness error, its message
 * holding each of `holding`; never a diagnosed failure.
 */
async function expectRefused(
  pending: Promise<unknown>,
  what: string,
  ...holding: readonly string[]
): Promise<HarnessStagingError> {
  const error = await rejectionOf(pending, what);
  expect(error, what).toBeInstanceOf(HarnessStagingError);
  expect(error, what).not.toBeInstanceOf(HarnessAssertionError);
  const refusal = error as HarnessStagingError;
  expect(refusal.mode, what).toBe("module-channel");
  for (const part of holding) expect(refusal.message, what).toContain(part);
  return refusal;
}

/** `pending` rejects with H-8's diagnosed failure, declining shrinking. */
async function expectDiagnosed(
  pending: Promise<unknown>,
  what: string,
  ...holding: readonly string[]
): Promise<void> {
  const error = await rejectionOf(pending, what);
  expect(error, what).toBeInstanceOf(HarnessAssertionError);
  expect((error as HarnessAssertionError).shrinkable, what).toBe(false);
  for (const part of holding) {
    expect((error as Error).message, what).toContain(part);
  }
}

test("no package directory given: making a staging fails as a diagnosed assertion failure declining shrinking, on the built product's binding and any other alike, before anything is staged (TEST-SPEC H-8, C-2)", async () => {
  const parent = await freshDirectory();
  for (const binding of [standInBinding(), builtBinding()]) {
    await expectDiagnosed(
      ModuleStaging.create(binding, "no package directory", { parent }),
      `${binding.label} with no package directory`,
      "no package directory is given",
      "Nothing was staged",
    );
  }
  expect(await fsp.readdir(parent), "nothing was staged").toEqual([]);
});

test("a package directory that does not exist is the built product's missing product — a diagnosed failure, nothing staged — and a harness error on any other binding; a relative path and a plain file are harness errors on every binding, the relative one never resolved against the working directory (TEST-SPEC H-8, H-2, C-2)", async () => {
  const parent = await freshDirectory();
  const absent = path.join(parent, "absent-package");
  await expectDiagnosed(
    ModuleStaging.create(builtBinding(absent), "absent package", { parent }),
    "the built product's absent package directory",
    `the package directory ${absent} does not exist`,
  );
  await expectRefused(
    ModuleStaging.create(standInBinding(absent), "absent package", { parent }),
    "another binding's absent package directory",
    "does not exist",
    "only the built product's missing package",
  );
  const file = path.join(parent, "a-file");
  await fsp.writeFile(file, "not a package");
  for (const binding of [standInBinding(file), builtBinding(file)]) {
    await expectRefused(
      ModuleStaging.create(binding, "a plain file", { parent }),
      `${binding.label}'s plain-file package directory`,
      "is a plain file, not a directory",
    );
  }
  for (const relative of [
    "package",
    "./test/fixtures/module-channel-standin",
  ]) {
    for (const binding of [standInBinding(relative), builtBinding(relative)]) {
      await expectRefused(
        ModuleStaging.create(binding, "a relative path", { parent }),
        `${binding.label}'s relative package directory ${relative}`,
        "is not an absolute path",
      );
    }
  }
  expect((await fsp.readdir(parent)).sort(), "nothing was staged").toEqual([
    "a-file",
  ]);
});

test("a development tree is refused: a package directory holding an entry named node_modules at its root — a directory, a plain file, or a symbolic link — is a harness error, and so is one holding an entry neither a plain file, a directory, nor a symbolic link (a FIFO, never opened); the committed stand-in and S-7's stub package are accepted (TEST-SPEC H-2: never a development tree; C-2)", async () => {
  for (const accepted of [STANDIN_PACKAGE_DIR, STUB_PACKAGE_DIR]) {
    const checked = await modulePackageDirectory(
      standInBinding(accepted),
      "an accepted package directory",
    );
    expect(checked.path).toBe(accepted);
  }
  const probe = await freshDirectory();
  const decoy = path.join(probe, "decoy");
  await fsp.mkdir(decoy);
  const installs: readonly [string, (at: string) => Promise<unknown>][] = [
    [
      "a directory",
      (at) => fsp.mkdir(path.join(at, "dependency"), { recursive: true }),
    ],
    ["a plain file", (at) => fsp.writeFile(at, "")],
    ["a symbolic link", (at) => fsp.symlink(decoy, at)],
  ];
  for (const [kind, install] of installs) {
    const holder = path.join(probe, `tree-${kind.replace(/ /g, "-")}`);
    await fsp.mkdir(holder);
    const tree = await copyOfStandIn(holder);
    await install(path.join(tree, "node_modules"));
    await expectRefused(
      modulePackageDirectory(standInBinding(tree), `node_modules as ${kind}`),
      `a package directory holding node_modules as ${kind}`,
      "holds an entry named node_modules at its root",
      "never a development tree",
    );
  }
  const fifoHolder = path.join(probe, "tree-fifo");
  await fsp.mkdir(fifoHolder);
  const withFifo = await copyOfStandIn(fifoHolder);
  await stageFifo({ root: withFifo, tempRoot: fifoHolder }, "lib/pipe");
  await expectRefused(
    modulePackageDirectory(standInBinding(withFifo), "a FIFO in the package"),
    "a package directory holding a FIFO",
    "lib/pipe, a FIFO",
  );
  expect((await fsp.lstat(path.join(withFifo, "lib", "pipe"))).isFIFO()).toBe(
    true,
  );
});

/** A package tree's entries, for a readable comparison. */
function entriesOf(tree: PackageTree): string[] {
  return [...tree.entries].map(([key, entry]) => {
    const shown = Buffer.from(key, "latin1").toString();
    if (entry.kind === "symlink")
      return `${shown} -> ${entry.target.toString()}`;
    const mode = entry.mode.toString(8);
    return entry.kind === "file"
      ? `${shown} (file ${mode}, ${String(entry.bytes.length)} bytes)`
      : `${shown} (directory ${mode})`;
  });
}

/**
 * A package directory with modes and a symbolic link of its own, made from
 * the stand-in: `bin/run.sh` mode 0755, `lib` mode 0750, `lib/alias.js` a
 * link to `helper.js`, `docs/empty` an empty directory, and the directory's
 * own mode 0750.
 */
async function variedPackage(): Promise<string> {
  const probe = await freshDirectory();
  const directory = await copyOfStandIn(probe);
  await fsp.mkdir(path.join(directory, "bin"));
  await fsp.writeFile(
    path.join(directory, "bin", "run.sh"),
    ["#!/bin/sh", "exit 0", ""].join(String.fromCodePoint(0x0a)),
  );
  await fsp.chmod(path.join(directory, "bin", "run.sh"), 0o755);
  await fsp.chmod(path.join(directory, "lib"), 0o750);
  await fsp.symlink("helper.js", path.join(directory, "lib", "alias.js"));
  await fsp.mkdir(path.join(directory, "docs", "empty"), { recursive: true });
  await fsp.chmod(directory, 0o750);
  return directory;
}

test("placement by copy alone: the canonical placement is a copy at node_modules/N in the holding directory, N the canonical name, byte-equal to the package directory — directories, modes, and symbolic links kept, the directory's own mode too — and the package directory, read entry by entry before and after, is untouched (TEST-SPEC §7.6 Placement, H-2)", async () => {
  for (const source of [STANDIN_PACKAGE_DIR, await variedPackage()]) {
    const refused = (detail: string): HarnessStagingError =>
      new HarnessStagingError("module-channel", source, detail);
    const before = await readPackageTree(source, "before", refused);
    const staging = await stagingBeside(source);
    const placement = await staging.placeCanonical("", TYPE_CHECKING_ARM);
    expect(placement).toStrictEqual({
      name: CANONICAL_MODULE_NAMES[0],
      holdingDir: staging.root,
      path: path.join(staging.root, "node_modules", CANONICAL_MODULE_NAMES[0]),
      form: "copy",
      copy: path.join(staging.root, "node_modules", CANONICAL_MODULE_NAMES[0]),
    });
    expect((await fsp.lstat(placement.path)).isDirectory()).toBe(true);
    const copied = await readPackageTree(placement.path, "the copy", refused);
    expect(describeTreeDifference(before, copied), source).toBeNull();
    expect(entriesOf(copied)).toStrictEqual(entriesOf(before));
    expect(copied.mode, "the copy keeps the directory's own mode").toBe(
      before.mode,
    );
    const after = await readPackageTree(source, "after", refused);
    expect(describeTreeDifference(before, after), source).toBeNull();
  }
  const varied = await variedPackage();
  const tree = entriesOf(
    await readPackageTree(
      varied,
      "the varied package",
      (detail) => new HarnessStagingError("module-channel", varied, detail),
    ),
  );
  expect(tree).toContain("bin/run.sh (file 755, 17 bytes)");
  expect(tree).toContain("lib (directory 750)");
  expect(tree).toContain("lib/alias.js -> helper.js");
  expect(
    (
      await readPackageTree(
        varied,
        "the varied package",
        (detail) => new HarnessStagingError("module-channel", varied, detail),
      )
    ).mode,
  ).toBe(0o750);
  // Its mode is the umask's: present, as a directory.
  expect(
    tree.filter((entry) => entry.startsWith("docs/empty (directory ")),
  ).toHaveLength(1);
});

test("a symbolic-link placement: node_modules/N is a symbolic link to a copy of the package directory elsewhere in the staging, under no node_modules, the copy byte-equal to the source; a copy under a directory named node_modules is refused, as is a holding directory named node_modules and an occupied placement (TEST-SPEC §7.6 Placement, T7.6-4(b); SPEC 7.6)", async () => {
  const source = await variedPackage();
  const refused = (detail: string): HarnessStagingError =>
    new HarnessStagingError("module-channel", source, detail);
  const before = await readPackageTree(source, "before", refused);
  const staging = await stagingBeside(source);
  const placement = await staging.place({
    name: "linked",
    holdingDir: "project",
    arm: TYPE_CHECKING_ARM,
    form: "symlink",
  });
  expect(placement.form).toBe("symlink");
  expect(placement.path).toBe(
    path.join(staging.root, "project", "node_modules", "linked"),
  );
  expect((await fsp.lstat(placement.path)).isSymbolicLink()).toBe(true);
  const reached = await fsp.realpath(placement.path);
  expect(reached).toBe(placement.copy);
  expect(reached.startsWith(`${staging.root}${path.sep}`)).toBe(true);
  expect(path.relative(staging.root, reached).split(path.sep)).not.toContain(
    "node_modules",
  );
  const copied = await readPackageTree(reached, "the linked copy", refused);
  expect(describeTreeDifference(before, copied)).toBeNull();
  await expectRefused(
    staging.place({
      name: "under-modules",
      holdingDir: "project",
      arm: TYPE_CHECKING_ARM,
      form: "symlink",
      copyDir: "vendor/node_modules/copy",
    }),
    "a linked copy under node_modules",
    "under a directory named node_modules",
  );
  await expectRefused(
    staging.place({
      name: "held",
      holdingDir: "project/node_modules",
      arm: TYPE_CHECKING_ARM,
    }),
    "a holding directory named node_modules",
    "is itself named node_modules",
  );
  await expectRefused(
    staging.place({
      name: "linked",
      holdingDir: "project",
      arm: TYPE_CHECKING_ARM,
    }),
    "an occupied placement",
    "is occupied already",
  );
  expect(
    describeTreeDifference(
      before,
      await readPackageTree(source, "after", refused),
    ),
  ).toBeNull();
});

/** A name of `length` characters: `prefix` padded with `a`. */
function nameOfLength(prefix: string, length: number): string {
  return `${prefix}${"a".repeat(length - prefix.length)}`;
}

test("N's grammar and exclusions: name or @scope/name, each a non-empty run of lowercase ASCII letters, digits, -, ., and _ beginning with a letter or digit, at most 214 characters in all; never an @types name or an @typescript name beginning lib-; a placement under a name outside them is refused on every arm (SPEC 7.6 Package and installation)", async () => {
  const admitted = [
    "a",
    "0a",
    "a-b_c",
    "a.js",
    "a.b",
    "x.",
    "@scope/name",
    "@0/a.b",
    "@typescript/lib",
    "@typescript/libx",
    "@typescript/es5",
    "types",
    nameOfLength("", MODULE_NAME_MAX_LENGTH),
    nameOfLength("@scope/", MODULE_NAME_MAX_LENGTH),
  ];
  for (const name of admitted) {
    expect(moduleNameGrammarProblem(name), name).toBeNull();
    expect(moduleNameExclusion(name), name).toBeNull();
  }
  const outsideGrammar = [
    "",
    "A",
    "aB",
    ".a",
    "-a",
    "_a",
    "a b",
    "a~b",
    "a/b",
    "@scope",
    "@scope/",
    "@/name",
    "@a/b/c",
    "@Scope/name",
    "caf" + String.fromCodePoint(0xe9),
    nameOfLength("", MODULE_NAME_MAX_LENGTH + 1),
    nameOfLength("@scope/", MODULE_NAME_MAX_LENGTH + 1),
  ];
  for (const name of outsideGrammar) {
    expect(moduleNameGrammarProblem(name), JSON.stringify(name)).not.toBeNull();
  }
  expect(moduleNameGrammarProblem(nameOfLength("", 215))).toContain(
    "215 characters long",
  );
  for (const name of [
    "@types/x",
    "@types/scope__name",
    "@typescript/lib-es5",
    "@typescript/lib-dom",
  ]) {
    expect(moduleNameGrammarProblem(name), name).toBeNull();
    expect(moduleNameExclusion(name), name).not.toBeNull();
  }
  for (const [name, holding] of [
    ["@types/x", "the @types scope"],
    ["@typescript/lib-es5", "beginning lib-"],
    ["Upper", "not a non-empty run"],
    [nameOfLength("", 215), "past 7.6's limit of 214"],
  ] as const) {
    await expectRefused(
      verifyModuleName(name, TYPE_CHECKING_ARM, "a vector"),
      `the name ${name}`,
      holding,
    );
  }
  const staging = await stagingBeside();
  await expectRefused(
    staging.place({ name: "@types/x", holdingDir: "", arm: TYPE_CHECKING_ARM }),
    "a placement under @types/x",
    "the @types scope",
  );
  expect(await fsp.readdir(staging.root), "nothing was placed").toEqual([]);
});

test("N on a runtime arm: each of E-1's releases is asked, so fs and path — names every release resolves to built-in modules — are refused, while test, built in only as node:test, and the canonical names are admitted; on a type-checking arm fs and path are admitted (SPEC 7.6: the built-in exclusion is Node.js's resolution's and the runtime contract's alone; T7.6-4(f))", async () => {
  const releases = await resolveNodeReleases();
  const runtime: ModuleArm = runtimeArm(releases);
  for (const release of releases) {
    const builtIn = await builtInNamesOn(
      release,
      ["fs", "path", "test", ...CANONICAL_MODULE_NAMES],
      "the built-in vectors",
    );
    expect([...builtIn].sort(), release.version).toEqual(["fs", "path"]);
  }
  for (const name of ["fs", "path"]) {
    const refusal = await expectRefused(
      verifyModuleName(name, runtime, "a runtime vector"),
      `${name} on a runtime arm`,
      "resolve to a built-in module",
    );
    for (const release of releases) {
      expect(refusal.message).toContain(release.version);
    }
    await verifyModuleName(name, TYPE_CHECKING_ARM, "a type-checking vector");
  }
  for (const name of ["test", ...CANONICAL_MODULE_NAMES]) {
    await verifyModuleName(name, runtime, "a runtime vector");
  }
  const staging = await stagingBeside();
  await expectRefused(
    staging.place({ name: "fs", holdingDir: "runtime", arm: runtime }),
    "a runtime placement under fs",
    "resolve to a built-in module",
  );
  const typeChecked = await staging.place({
    name: "fs",
    holdingDir: "type-checked",
    arm: TYPE_CHECKING_ARM,
  });
  expect(typeChecked.path).toBe(
    path.join(staging.root, "type-checked", "node_modules", "fs"),
  );
});

test("the canonical N is the first of two fixed, unscoped, dot-free names of 7.6's grammar, built in on no release, that differs from the name the package's manifest gives — the stand-in's, S-7's stub package's, the product's, and either canonical name itself — so the canonical install is an aliased one (TEST-SPEC §7.6 Placement)", async () => {
  for (const name of CANONICAL_MODULE_NAMES) {
    expect(moduleNameGrammarProblem(name), name).toBeNull();
    expect(name.startsWith("@") || name.includes("."), name).toBe(false);
    expect(name).not.toBe("xspec");
  }
  expect(CANONICAL_MODULE_NAMES[0]).not.toBe(CANONICAL_MODULE_NAMES[1]);
  for (const manifestName of [
    STANDIN_NAME,
    "xspec-empty-stub",
    "@modularcloud/xspec",
    undefined,
  ]) {
    expect(canonicalModuleName(manifestName)).toBe(CANONICAL_MODULE_NAMES[0]);
  }
  expect(canonicalModuleName(CANONICAL_MODULE_NAMES[0])).toBe(
    CANONICAL_MODULE_NAMES[1],
  );
  expect(canonicalModuleName(CANONICAL_MODULE_NAMES[1])).toBe(
    CANONICAL_MODULE_NAMES[0],
  );
  const stub = await stagingBeside(STUB_PACKAGE_DIR);
  expect(stub.canonicalName).not.toBe(stub.package.manifestName.name);
});

test("the manifest's name is read by parsing the package directory's package.json alone: the stand-in's and S-7's stub package's names; none, saying why, for a manifest that is absent, not JSON, repeating a member, or holding no string name (T7.6-4(a), T7-9(d))", async () => {
  expect(await readManifestName(STANDIN_PACKAGE_DIR)).toStrictEqual({
    name: STANDIN_NAME,
    detail: "",
  });
  expect(await readManifestName(STUB_PACKAGE_DIR)).toStrictEqual({
    name: "xspec-empty-stub",
    detail: "",
  });
  const probe = await freshDirectory();
  const vectors: readonly [string, string | undefined, string][] = [
    ["absent", undefined, "is absent"],
    ["not-json", "{", "is not JSON"],
    [
      "repeated",
      '{"name": "a", "name": "b"}',
      'repeats the member name "name"',
    ],
    ["unnamed", '{"version": "1.0.0"}', "holds no name member"],
    ["numbered", '{"name": 1}', 'holds a "name" member that is a number'],
  ];
  for (const [label, text, holding] of vectors) {
    const directory = path.join(probe, label);
    await fsp.mkdir(directory);
    if (text !== undefined) {
      await fsp.writeFile(path.join(directory, "package.json"), text);
    }
    const read = await readManifestName(directory);
    expect(read.name, label).toBeUndefined();
    expect(read.detail, label).toContain(holding);
  }
});

test("H-1 through helpers/staging-isolation.ts: a staging is made fresh under the OS temporary directory at its physical path, and only where no ancestor of its root holds an entry named package.json or node_modules — refused otherwise as the module channel's harness error, the refused staging removed — and before a Node.js run its global half admits an empty fresh HOME on E-1's releases and refuses one holding a global module folder's entry (TEST-SPEC H-1, H-11)", async () => {
  const ancestors: readonly [string, (at: string) => Promise<void>][] = [
    ["package.json", (at) => fsp.writeFile(at, "{}")],
    ["node_modules", (at) => fsp.mkdir(at)],
  ];
  for (const [entry, make] of ancestors) {
    const parent = await freshDirectory();
    await make(path.join(parent, entry));
    await expectRefused(
      ModuleStaging.create(
        standInBinding(STANDIN_PACKAGE_DIR),
        `an ancestor ${entry}`,
        {
          parent,
        },
      ),
      `a staging under an ancestor ${entry}`,
      `holds an entry named ${entry}`,
      "H-1's isolation of the module channel's staging is unmet",
    );
    expect(
      await fsp.readdir(parent),
      "the refused staging was removed",
    ).toEqual([entry]);
  }
  const staging = await stagingBeside();
  expect(path.dirname(staging.root)).toBe(await fsp.realpath(os.tmpdir()));
  expect(path.basename(staging.root).startsWith(MODULE_STAGING_PREFIX)).toBe(
    true,
  );
  expect(await fsp.realpath(staging.root)).toBe(staging.root);
  const releases = await resolveNodeReleases();
  const home = await freshDirectory();
  const run = {
    environment: { HOME: home, PATH: process.env["PATH"] ?? "" },
    cwd: staging.root,
    executables: releases.map((release) => release.executable),
  };
  await staging.verifyIsolation(run);
  await fsp.mkdir(path.join(home, ".node_modules", "pkg"), { recursive: true });
  await expectRefused(
    staging.verifyIsolation(run),
    "a fresh HOME holding .node_modules/pkg",
    path.join(home, ".node_modules"),
    "counts as holding a package",
  );
  await staging.dispose();
  await expect(fsp.lstat(staging.root)).rejects.toThrow();
});

/** An importing file's text: nothing here type-checks or loads it. */
const IMPORTING_TEXT = ["export {};", ""].join(String.fromCodePoint(0x0a));

/** A finished staging for a Reach vector. */
interface ReachFixture {
  readonly staging: ModuleStaging;
  readonly placement: Placement;
  /** The importing file, staging-relative. */
  readonly importingFile: string;
}

/**
 * A finished staging beside the stand-in: a project of `kind` (ES-module
 * unless given) at `project`, the importing file `config.ts` in
 * `importingDir` (`project` unless given), and the package placed under
 * `name` (the canonical N unless given) in `holdingDir` (the importing
 * file's own unless given), by `form`.
 */
async function reachStaging(
  options: {
    readonly name?: string;
    readonly kind?: ProjectKind;
    readonly importingDir?: string;
    readonly holdingDir?: string;
    readonly form?: PlacementForm;
  } = {},
): Promise<ReachFixture> {
  const staging = await stagingBeside();
  const importingDir = options.importingDir ?? "project";
  await staging.stageProject("project", options.kind ?? "es-module");
  const placement = await staging.place({
    name: options.name ?? staging.canonicalName,
    holdingDir: options.holdingDir ?? importingDir,
    arm: TYPE_CHECKING_ARM,
    ...(options.form === undefined ? {} : { form: options.form }),
  });
  const importingFile = `${importingDir}/config.ts`;
  await staging.writeFile(importingFile, IMPORTING_TEXT);
  return { staging, placement, importingFile };
}

test('the three project kinds are stageable — an ES-module project, its package.json holding "type": "module"; a CommonJS project, its package.json holding no type; one with no package.json — each confirmed on its finished staging with nothing but the canonical placement installed, an ES-module project beneath an ancestor manifest holding "type": "commonjs" included, and a staging declaring a kind it does not have is refused (SPEC 7.6 Covered setups; TEST-SPEC §7.6 Placement, T7.6-5(b))', async () => {
  const LF = String.fromCodePoint(0x0a);
  const manifests: Readonly<Record<ProjectKind, string | undefined>> = {
    "es-module": ["{", '  "type": "module"', "}", ""].join(LF),
    commonjs: ["{}", ""].join(LF),
    "no-manifest": undefined,
  };
  for (const kind of PROJECT_KINDS) {
    const { staging, placement, importingFile } = await reachStaging({ kind });
    const manifest = await fsp
      .readFile(staging.path("project/package.json"), "utf8")
      .catch(() => undefined);
    expect(manifest, kind).toBe(manifests[kind]);
    await staging.verifyReach({
      importingFile,
      placement,
      project: kind,
      alone: true,
    });
    for (const other of PROJECT_KINDS.filter(
      (candidate) => candidate !== kind,
    )) {
      await expectRefused(
        staging.verifyReach({ importingFile, placement, project: other }),
        `a ${kind} project declared ${other}`,
        "is declared",
      );
    }
  }
  const staging = await stagingBeside();
  await staging.writeFile("package.json", JSON.stringify({ type: "commonjs" }));
  await staging.stageProject("project", "es-module");
  const placement = await staging.placeCanonical("project", TYPE_CHECKING_ARM);
  await staging.writeFile("project/config.ts", IMPORTING_TEXT);
  await staging.verifyReach({
    importingFile: "project/config.ts",
    placement,
    project: "es-module",
    alone: true,
  });
});

/** One nothing-nearer vector: a Reach staging, and the entries it adds. */
interface NearerVector {
  readonly label: string;
  readonly name?: string;
  readonly importingDir?: string;
  readonly holdingDir?: string;
  /** Files written, staging-relative; `<N>` stands for the placement's N. */
  readonly occupy: readonly string[];
}

/** The nothing-nearer vectors Reach bars (SPEC 7.6 Reach). */
const NEARER_REFUSED: readonly NearerVector[] = [
  {
    label: "N.js beside node_modules/N",
    occupy: ["project/node_modules/<N>.js"],
  },
  {
    label: "N.d.ts beside node_modules/N",
    occupy: ["project/node_modules/<N>.d.ts"],
  },
  {
    label: "a.ts beside node_modules/a.js (S is a)",
    name: "a.js",
    occupy: ["project/node_modules/a.ts"],
  },
  {
    label: "@scope/a.ts beside node_modules/@scope/a.b",
    name: "@scope/a.b",
    occupy: ["project/node_modules/@scope/a.ts"],
  },
  {
    label:
      "node_modules/N in the importing file's directory, the holding directory a strict ancestor",
    importingDir: "project/sub",
    holdingDir: "project",
    occupy: ["project/sub/node_modules/<N>/index.js"],
  },
  {
    label: "node_modules/@types/N (D) between",
    importingDir: "project/sub",
    holdingDir: "project",
    occupy: ["project/sub/node_modules/@types/<N>/index.d.ts"],
  },
  {
    label: "node_modules/N.x (S.) between",
    importingDir: "project/sub/deeper",
    holdingDir: "project",
    occupy: ["project/sub/node_modules/<N>.x"],
  },
  {
    label: "node_modules/@types/N.x (T.) between",
    importingDir: "project/sub",
    holdingDir: "project",
    occupy: ["project/sub/node_modules/@types/<N>.x"],
  },
  {
    label: "node_modules/@types/scope__a.b (D of @scope/a.b) between",
    name: "@scope/a.b",
    importingDir: "project/sub",
    holdingDir: "project",
    occupy: ["project/sub/node_modules/@types/scope__a.b/index.d.ts"],
  },
  {
    label: "node_modules/@types/scope__a.x (T of @scope/a.b) between",
    name: "@scope/a.b",
    importingDir: "project/sub",
    holdingDir: "project",
    occupy: ["project/sub/node_modules/@types/scope__a.x"],
  },
];

/** The nothing-nearer vectors Reach leaves open (T7.6-4(c), (d), (e)). */
const NEARER_ADMITTED: readonly NearerVector[] = [
  { label: "the placement alone", occupy: [] },
  {
    label: "an unrelated package at node_modules/a beside a.js",
    name: "a.js",
    occupy: ["project/node_modules/a/index.js"],
  },
  {
    label: "an unrelated package at node_modules/a beside a.b",
    name: "a.b",
    occupy: ["project/node_modules/a/index.js"],
  },
  {
    label:
      "an unrelated package in the importing file's directory, the holding directory a strict ancestor",
    importingDir: "project/sub",
    holdingDir: "project",
    occupy: ["project/sub/node_modules/unrelated/index.js"],
  },
  {
    label: "another name's @types package between",
    importingDir: "project/sub",
    holdingDir: "project",
    occupy: ["project/sub/node_modules/@types/other/index.d.ts"],
  },
  {
    label:
      "node_modules/N above the holding directory, farther than the placement",
    importingDir: "project/sub",
    holdingDir: "project/sub",
    occupy: ["project/node_modules/<N>/index.js"],
  },
];

test("Reach's nothing-nearer condition: in the holding directory no entry but the placement begins node_modules/S., and from the importing file's directory up to, excluding, the holding directory none occupies node_modules/N or node_modules/D or begins node_modules/S. or node_modules/T. — each such entry refused, while an unrelated package at node_modules/a beside a.js or a.b, another package or another name's @types package between, and a farther node_modules/N are admitted (SPEC 7.6 Reach; TEST-SPEC T7.6-4(c)-(e))", async () => {
  for (const vector of [...NEARER_REFUSED, ...NEARER_ADMITTED]) {
    const { staging, placement, importingFile } = await reachStaging(vector);
    for (const entry of vector.occupy) {
      await staging.writeFile(entry.replace("<N>", placement.name), "");
    }
    const verified = staging.verifyReach({ importingFile, placement });
    if (NEARER_REFUSED.includes(vector)) {
      await expectRefused(
        verified,
        vector.label,
        "fails Reach's nothing-nearer condition",
      );
    } else {
      await verified;
    }
  }
});

test("Reach's no-self-reference condition: a manifest in the importing file's directory or an ancestor giving a name read as N or a leading part of it — empty, N, or N's scope, with or without one trailing /, each backslash read as / — is refused; unrelated names, and names N only begins, are admitted (SPEC 7.6 Reach; TEST-SPEC T7.6-5(a))", async () => {
  const vectors: readonly {
    readonly name?: string;
    readonly refused: readonly string[];
    readonly admitted: readonly string[];
  }[] = [
    {
      refused: ["", "<N>", "<N>/", `<N>${BACKSLASH}`],
      admitted: ["unrelated", "<N>-other", "/", "@<N>"],
    },
    {
      name: "@scope/a.b",
      refused: [
        "",
        "@scope/a.b",
        "@scope/a.b/",
        "@scope",
        "@scope/",
        `@scope${BACKSLASH}a.b`,
        `@scope${BACKSLASH}`,
      ],
      admitted: [
        "unrelated",
        "@scope/a",
        "@scope/a.b/x",
        "scope",
        "@scope/a.bc",
      ],
    },
  ];
  expect(vectors[0]!.refused[3]!.length).toBe("<N>".length + 1);
  for (const vector of vectors) {
    for (const where of ["", "project"] as const) {
      for (const given of [...vector.refused, ...vector.admitted]) {
        const { staging, placement, importingFile } = await reachStaging({
          ...(vector.name === undefined ? {} : { name: vector.name }),
          kind: "no-manifest",
        });
        const name = given.replace("<N>", placement.name);
        await staging.writeFile(
          where === "" ? "package.json" : "project/package.json",
          JSON.stringify({ name }),
        );
        const verified = staging.verifyReach({ importingFile, placement });
        if (vector.refused.includes(given)) {
          await expectRefused(
            verified,
            `a manifest at ${where || "the staging root"} named ${JSON.stringify(name)}`,
            "fails Reach's no-self-reference condition",
          );
        } else {
          await verified;
        }
      }
    }
  }
});

test("physical naming and the holding directory: an importing file reached through a symbolically linked directory, or itself a symbolic link, is refused, as is a placement whose holding directory is not the file's own or an ancestor; a holding directory that is an ancestor of the file's physical path alone, the file's directory also reachable through a link elsewhere, is admitted given the physical path (SPEC 7.6 Package and installation, Reach; TEST-SPEC T7.6-4(d))", async () => {
  const { staging, placement } = await reachStaging({
    importingDir: "project/real",
  });
  await staging.link("project/alias", "project/real");
  await staging.link("project/linked.ts", "project/real/config.ts");
  await staging.verifyReach({
    importingFile: "project/real/config.ts",
    placement,
  });
  for (const importingFile of [
    "project/alias/config.ts",
    "project/linked.ts",
  ]) {
    await expectRefused(
      staging.verifyReach({ importingFile, placement }),
      `the importing file named as ${importingFile}`,
      "fails physical naming",
    );
  }
  const elsewhere = await staging.place({
    name: "elsewhere-placed",
    holdingDir: "elsewhere",
    arm: TYPE_CHECKING_ARM,
  });
  await expectRefused(
    staging.verifyReach({
      importingFile: "project/real/config.ts",
      placement: elsewhere,
    }),
    "a holding directory beside the importing file's",
    "neither the importing file's directory nor one of its ancestors",
  );
  const ancestral = await reachStaging({
    importingDir: "a/b",
    holdingDir: "a",
  });
  await ancestral.staging.link("elsewhere/b", "a/b");
  await ancestral.staging.verifyReach({
    importingFile: ancestral.importingFile,
    placement: ancestral.placement,
  });
  await expectRefused(
    ancestral.staging.verifyReach({
      importingFile: "elsewhere/b/config.ts",
      placement: ancestral.placement,
    }),
    "the importing file named through the link elsewhere",
    "fails physical naming",
  );
});

test("Reach's well-formed-manifests condition: a manifest that is not UTF-8, begins with a byte-order mark, is not JSON, is no JSON object, repeats a member name in any object it holds (compared as decoded, __proto__ among them), holds a non-string name or type, or escapes a lone surrogate in any string, member names included, is refused, and so is an ancestor package.json that is a directory or a dangling symbolic link; a paired surrogate escape and a link to a well-formed manifest are admitted (SPEC 7.6 Reach)", async () => {
  const u = (hex: string): string => `${BACKSLASH}u${hex}`;
  const refused: readonly [string, Uint8Array | string, string][] = [
    ["not UTF-8", Uint8Array.of(0x7b, 0xff, 0x7d), "is not UTF-8"],
    ["a byte-order mark", `${BYTE_ORDER_MARK}{}`, "byte-order mark"],
    ["not JSON", "{", "is not JSON"],
    ["an array", "[]", "an array, not a JSON object"],
    ["a string", '"x"', "a string, not a JSON object"],
    ["null", "null", "null, not a JSON object"],
    [
      "a repeated name",
      '{"name": "a", "name": "b"}',
      'repeats the member name "name"',
    ],
    [
      "a repeated nested member",
      '{"a": {"b": 1, "b": 2}}',
      'repeats the member name "b"',
    ],
    [
      "a member repeated as decoded",
      `{"name": "a", "n${u("0061")}me": "b"}`,
      'repeats the member name "name"',
    ],
    [
      "a repeated __proto__",
      '{"__proto__": 1, "__proto__": 2}',
      'repeats the member name "__proto__"',
    ],
    [
      "a non-string name",
      '{"name": 1}',
      'holds a "name" member that is a number',
    ],
    [
      "a non-string type",
      '{"type": true}',
      'holds a "type" member that is a boolean',
    ],
    [
      "a lone high surrogate",
      `{"description": "${u("d800")}"}`,
      "lone surrogate U+D800",
    ],
    [
      "a lone low surrogate",
      `{"description": "${u("dc00")}"}`,
      "lone surrogate U+DC00",
    ],
    [
      "a high surrogate before another escape",
      `{"description": "${u("d800")}${u("0041")}"}`,
      "lone surrogate U+D800",
    ],
    [
      "a lone surrogate in a member name",
      `{"${u("dbff")}": 1}`,
      "lone surrogate U+DBFF",
    ],
  ];
  const admitted: readonly [string, string][] = [
    ["an empty object", "{}"],
    ["a name and a type", '{"name": "unrelated", "type": "module"}'],
    [
      "a paired surrogate escape",
      `{"description": "${u("d83d")}${u("de00")}"}`,
    ],
    ["repeated names in two objects", '{"a": {"b": 1}, "c": {"b": 2}}'],
    ["one __proto__", '{"__proto__": {"name": 1}, "name": "x"}'],
  ];
  expect(u("d800")).toHaveLength(6);
  expect(u("d800").codePointAt(0)).toBe(0x5c);
  for (const [label, text, holding] of refused) {
    const bytes = typeof text === "string" ? Buffer.from(text, "utf8") : text;
    const judged = judgeManifestBytes(bytes);
    expect(judged.wellFormed, label).toBe(false);
    if (!judged.wellFormed) expect(judged.problem, label).toContain(holding);
  }
  for (const [label, text] of admitted) {
    expect(
      judgeManifestBytes(Buffer.from(text, "utf8")).wellFormed,
      label,
    ).toBe(true);
  }
  const stagings: readonly [
    string,
    (staging: ModuleStaging) => Promise<unknown>,
    boolean,
  ][] = [
    [
      "a malformed ancestor manifest",
      (staging) => staging.writeFile("package.json", "{"),
      false,
    ],
    [
      "an ancestor manifest with a lone surrogate",
      (staging) =>
        staging.writeFile("package.json", `{"description": "${u("d800")}"}`),
      false,
    ],
    [
      "an ancestor package.json that is a directory",
      (staging) => staging.makeDirectory("package.json"),
      false,
    ],
    [
      "an ancestor package.json that is a dangling link",
      (staging) => staging.link("package.json", "absent.json"),
      false,
    ],
    [
      "an ancestor package.json linking to a well-formed manifest",
      async (staging) => {
        await staging.writeFile("manifests/real.json", '{"type": "commonjs"}');
        await staging.link("package.json", "manifests/real.json");
      },
      true,
    ],
  ];
  for (const [label, stage, holds] of stagings) {
    const { staging, placement, importingFile } = await reachStaging({
      kind: "no-manifest",
    });
    await stage(staging);
    const verified = staging.verifyReach({ importingFile, placement });
    if (holds) await verified;
    else
      await expectRefused(
        verified,
        label,
        "fails Reach's well-formed-manifests condition",
      );
  }
});

test("nothing else installed: the canonical placement alone in the staging — a copy or a symbolic link, unscoped or scoped — is confirmed, and an unrelated package beside it, TypeScript's package at node_modules/typescript, or a node_modules directory elsewhere in the staging is refused where the staging declares its placement alone (TEST-SPEC §7.6 Placement, T7.6-4(e))", async () => {
  for (const options of [
    {},
    { form: "symlink" as const },
    { name: "@scope/name" },
  ]) {
    const { staging, placement, importingFile } = await reachStaging(options);
    await staging.verifyReach({ importingFile, placement, alone: true });
  }
  const others: readonly string[] = [
    "project/node_modules/unrelated/index.js",
    "project/node_modules/typescript/package.json",
    "tools/node_modules/x/index.js",
    "project/sub/node_modules/x.js",
  ];
  for (const other of others) {
    const { staging, placement, importingFile } = await reachStaging();
    await staging.writeFile(other, "{}");
    await staging.verifyReach({ importingFile, placement });
    await expectRefused(
      staging.verifyReach({ importingFile, placement, alone: true }),
      `the canonical placement beside ${other}`,
      "is declared to have nothing but its placement",
    );
  }
  const scoped = await reachStaging({ name: "@scope/name" });
  await scoped.staging.writeFile(
    "project/node_modules/@scope/other/index.js",
    "",
  );
  await expectRefused(
    scoped.staging.verifyReach({
      importingFile: scoped.importingFile,
      placement: scoped.placement,
      alone: true,
    }),
    "a scoped placement beside another package of its scope",
    "is declared to have nothing but its placement",
  );
});

test("no staging write lands in a placed copy: a file, a directory, a link, or a project at or below a placement or the copy a symbolic-link placement reaches is refused, the copies left byte-equal to the package directory (TEST-SPEC H-2: nothing installed into it afterwards)", async () => {
  const staging = await stagingBeside();
  const copied = await staging.placeCanonical("", TYPE_CHECKING_ARM);
  const linked = await staging.place({
    name: "linked",
    holdingDir: "other",
    arm: TYPE_CHECKING_ARM,
    form: "symlink",
  });
  const inside = [
    `node_modules/${copied.name}/extra.js`,
    `node_modules/${copied.name}/lib/extra.js`,
    path.relative(staging.root, linked.copy).split(path.sep).join("/") +
      "/extra.js",
  ];
  for (const rel of inside) {
    await expectRefused(
      staging.writeFile(rel, ""),
      `a write at ${rel}`,
      "lies in the placed copy",
    );
    await expectRefused(
      staging.makeDirectory(rel),
      `a directory at ${rel}`,
      "lies in the placed copy",
    );
    await expectRefused(
      staging.link(rel, "other"),
      `a link at ${rel}`,
      "lies in the placed copy",
    );
    await expectRefused(
      staging.stageProject(rel, "commonjs"),
      `a project at ${rel}`,
      "lies in the placed copy",
    );
  }
  const refused = (detail: string): HarnessStagingError =>
    new HarnessStagingError("module-channel", STANDIN_PACKAGE_DIR, detail);
  const source = await readPackageTree(
    STANDIN_PACKAGE_DIR,
    "the source",
    refused,
  );
  for (const copy of [copied.copy, linked.copy]) {
    expect(
      describeTreeDifference(
        source,
        await readPackageTree(copy, "a copy", refused),
      ),
      copy,
    ).toBeNull();
  }
});
