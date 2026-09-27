// Self-test of the workspace builder's undeclared-staging guard
// (helpers/workspace.ts `TestWorkspace.file()` and `create()`'s initial
// `files`, helpers/product-invocations.ts; TEST-SPEC 17 S-9's timing
// clause, S-7, §0 H-8). The staged-source ledger
// (helpers/staged-mdx.ts, test/self/s9-staged-sources.test.ts) holds every
// `.mdx` source a body stages after a product invocation, so that S-9's
// check runs for it before any product exists; the guard is what makes an
// omission from the ledger a harness error at the first run that reaches
// the site rather than a gap trusted to enumeration: once a product has been
// invoked — in the workspace (the subprocess driver marks the live workspace
// whose root, or realpath, the invocation's working directory is or lies
// under) or anywhere in the running registered body (the async-local context
// the suite wrapper and the certification runner establish, S-7's actual
// reach) — a plain `.mdx` staging, a `file()` write or an initial `files`
// entry of a workspace created after the invocation, throws
// `HarnessStagingError` of mode `undeclared-staging`, and nothing is
// written.
//
// Verified here: a staging before any invocation is accepted (S-7's sweep
// reaches it); after an invocation a plain staging is refused with the rule
// in the diagnosis, whatever its declaration (well-formed, unparseable,
// allowances), and the file is untouched; the exemptions — a staged-source
// record, `edit()`, `unchecked` (by option or by workspace declaration),
// `per-draw` (still judged well-formed at staging), a non-`.mdx` path; the
// marks — a working directory inside the root, a symbolic link resolving to
// the root, a background `startProduct`, never a sibling workspace; the
// per-body reach — a fresh later-arm workspace's `file()` is refused inside
// a body that has invoked the product elsewhere, and so is a plain `.mdx`
// initial entry of such a workspace, at creation (the diagnosis naming an
// initial `files` entry and its remedies, whatever the entry's
// declaration; the half-built workspace disposed, no temporary directory
// left behind — observed in a private temp directory), while a
// staged-source record entry (the record-accepting `InitialFileContents`,
// the form such a workspace's initial `.mdx` files take) stages under the
// record's declaration, `unchecked`, `perDraw`, and `perDrawUnparseable`
// entries pass (the last two still judged), a non-`.mdx` entry passes, and
// so does the same creation before the body's first invocation; outside a
// body context only the per-workspace mark applies, so a creation — which
// no invocation has touched yet — is never refused; the registry's
// bookkeeping (`dispose` unregisters); that `per-draw` is a `file()`
// declaration only (the judge treats it as well-formed, a ledger record
// refuses it); that the workspace
// declaration's `perDraw` list is its initial-file form — the listed path's
// initial contents judged well-formed at creation, a later plain `file()`
// there exempt from the guard and still judged; and the same of
// `per-draw-unparseable`, its twin for a draw the document declares
// unparseable (P-12's break-parse twist) — exempt from the guard by option
// and through the `perDrawUnparseable` list (in a later-arm workspace of a
// body that has invoked, too), judged as `unparseable` at creation and at
// staging, refused on a ledger record. The guard's error is a harness
// error, never a `HarnessAssertionError`.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { expect, onTestFinished, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import {
  noteProductInvocation,
  productInvokedInBody,
  registerWorkspaceRoot,
  runProductTestBody,
  unregisterWorkspaceRoot,
} from "../helpers/product-invocations.js";
import { stagedMdx } from "../helpers/staged-mdx.js";
import { runProduct, startProduct } from "../helpers/subprocess.js";
import type { ProductBinding } from "../helpers/subprocess.js";
import { TestWorkspace, judgeMdxDeclaration } from "../helpers/workspace.js";
import type { WorkspaceDecl } from "../helpers/workspace.js";

const onPosix = process.platform !== "win32";

const LF = String.fromCodePoint(0x000a);

/** Lines joined by U+000A, the last one terminated. */
const doc = (...lines: readonly string[]): string => lines.join(LF) + LF;

const utf8 = (text: string): Uint8Array => Buffer.from(text, "utf8");

const text = (data: Uint8Array): string => Buffer.from(data).toString("utf8");

const WELL_FORMED = doc('<S id="x">', "", "closed below", "", "</S>");
const EDITED = doc('<S id="x">', "", "edited below", "", "</S>");
const ILL_FORMED = doc('<S id="x">', "", "never closed");
const ILL_FORMED_EDITED = doc('<S id="x">', "", "never closed either");

const A = "specs/A.mdx";

/**
 * A stand-in "product": Node itself, exiting 0. What the child does is
 * immaterial — the driver's one invocation path (`startProduct`) is what
 * marks the workspace and the body.
 */
const STANDIN: ProductBinding = {
  label: "self-test stand-in (node, exits 0)",
  command: process.execPath,
  prefixArgs: ["-e", "process.exit(0)"],
};

async function stage(decl: WorkspaceDecl = {}): Promise<TestWorkspace> {
  const workspace = await TestWorkspace.create(decl);
  onTestFinished(() => workspace.dispose());
  return workspace;
}

async function invoke(cwd: string): Promise<void> {
  const result = await runProduct(STANDIN, { cwd, argv: [] });
  expect(result.exitCode).toBe(0);
}

function expectUndeclared(
  thrown: unknown,
  key: string,
  ...fragments: readonly string[]
): void {
  expect(thrown).toBeInstanceOf(HarnessStagingError);
  expect(thrown).not.toBeInstanceOf(HarnessAssertionError);
  const error = thrown as HarnessStagingError;
  expect(error.name).toBe("HarnessStagingError");
  expect(error.mode).toBe("undeclared-staging");
  expect(error.path).toBe(key);
  expect(error.message).toContain(`undeclared-staging staging of ${key}: `);
  expect(error.message).toContain("after a product invocation");
  expect(error.message).toContain("staged-source record");
  expect(error.message).toContain("S-7");
  for (const fragment of fragments) {
    expect(error.message).toContain(fragment);
  }
}

async function expectRefused(
  action: () => Promise<unknown>,
  key: string,
  ...fragments: readonly string[]
): Promise<void> {
  let thrown: unknown;
  try {
    await action();
  } catch (error) {
    thrown = error;
  }
  expectUndeclared(thrown, key, ...fragments);
}

/** What one `TestWorkspace.create()` did, observed in a private temp dir. */
interface Creation {
  /** The workspace, when the creation succeeded (disposed at test end). */
  readonly created: TestWorkspace | undefined;
  /** What the creation threw, when it was refused. */
  readonly thrown: unknown;
  /** The private temp directory's entries after the creation settled. */
  readonly leftBehind: readonly string[];
}

const TEMP_VARIABLES = ["TMPDIR", "TMP", "TEMP"] as const;

/**
 * `TestWorkspace.create(decl)` with the OS temp directory pointed at a
 * fresh, private directory for the call (`os.tmpdir()` reads these
 * variables at each call), so what the creation leaves behind is exactly
 * that directory's listing afterwards — immune to the `xspec-harness-*`
 * directories the other self-test files create and remove concurrently in
 * the shared temp directory. A success leaves its one workspace directory
 * there, which is what makes an empty listing after a refusal meaningful.
 */
async function createInPrivateTemp(decl: WorkspaceDecl): Promise<Creation> {
  const holder = await fsp.mkdtemp(
    path.join(os.tmpdir(), "xspec-guard-self-test-"),
  );
  onTestFinished(() => fsp.rm(holder, { recursive: true, force: true }));
  const saved = TEMP_VARIABLES.map((name) => process.env[name]);
  let redirected = "";
  let created: TestWorkspace | undefined;
  let thrown: unknown;
  for (const name of TEMP_VARIABLES) process.env[name] = holder;
  try {
    redirected = os.tmpdir();
    created = await TestWorkspace.create(decl);
  } catch (error) {
    thrown = error;
  } finally {
    TEMP_VARIABLES.forEach((name, index) => {
      const value = saved[index];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
  }
  expect(redirected).toBe(holder);
  if (created !== undefined) {
    const workspace = created;
    onTestFinished(() => workspace.dispose());
  }
  return { created, thrown, leftBehind: await fsp.readdir(holder) };
}

/** A creation that succeeded, leaving its one workspace directory behind. */
function expectCreated(creation: Creation): TestWorkspace {
  expect(creation.thrown).toBeUndefined();
  expect(creation.created).toBeInstanceOf(TestWorkspace);
  expect(creation.leftBehind).toEqual([
    expect.stringMatching(/^xspec-harness-/),
  ]);
  return creation.created!;
}

test("before any invocation, a plain `.mdx` staging is accepted — S-7's sweep reaches it", async () => {
  const workspace = await stage({ files: { [A]: WELL_FORMED } });
  expect(workspace.productInvoked).toBe(false);
  await workspace.file("specs/B.mdx", WELL_FORMED);
  await workspace.file(A, EDITED);
  expect(text(await workspace.readBytes("specs/B.mdx"))).toBe(WELL_FORMED);
  expect(text(await workspace.readBytes(A))).toBe(EDITED);
});

test("after an invocation in the workspace, a plain `.mdx` staging is refused with the rule, and nothing is written", async () => {
  const workspace = await stage({ files: { [A]: WELL_FORMED } });
  await invoke(workspace.root);
  expect(workspace.productInvoked).toBe(true);
  await expectRefused(
    () => workspace.file(A, EDITED),
    A,
    "in this workspace",
    'declared "well-formed"',
    "stagedMdx(",
    "`edit()`",
    "`unchecked`",
    "`per-draw`",
  );
  expect(text(await workspace.readBytes(A))).toBe(WELL_FORMED);
  await expectRefused(
    () => workspace.file("specs/deep/../B.mdx", utf8(WELL_FORMED)),
    "specs/B.mdx",
  );
  expect(await workspace.kind("specs/B.mdx")).toBe("absent");
});

test("the refusal covers every plain declaration — unparseable and allowances ride the record too", async () => {
  const workspace = await stage({
    files: { [A]: WELL_FORMED },
    mdx: {
      unparseable: ["specs/bad.mdx"],
      allowances: { "specs/dup.mdx": ["duplicate-import-binding"] },
    },
  });
  await invoke(workspace.root);
  await expectRefused(
    () => workspace.file("specs/bad.mdx", ILL_FORMED),
    "specs/bad.mdx",
    'declared "unparseable"',
  );
  await expectRefused(
    () => workspace.file("specs/dup.mdx", WELL_FORMED),
    "specs/dup.mdx",
    '"allowances":["duplicate-import-binding"]',
  );
  await expectRefused(
    () => workspace.file(A, ILL_FORMED, { mdx: "unparseable" }),
    A,
    'declared "unparseable"',
  );
  expect(await workspace.kind("specs/bad.mdx")).toBe("absent");
  expect(await workspace.kind("specs/dup.mdx")).toBe("absent");
});

test("the exemptions after an invocation: a staged-source record, `edit()`, `unchecked`, `per-draw`, a non-`.mdx` path", async () => {
  const workspace = await stage({
    files: { [A]: WELL_FORMED },
    mdx: { unchecked: ["specs/fuzz.mdx"] },
  });
  await invoke(workspace.root);

  // A record: the S-9 self-test's business, staged under its declaration.
  const record = stagedMdx("T0-1 guard: the edited source", EDITED);
  await workspace.file(A, record);
  expect(text(await workspace.readBytes(A))).toBe(EDITED);

  // `edit()`: a declared staging by construction (bytes the product wrote,
  // in a real body) — judged at staging time, never guarded.
  await workspace.edit(A, "edited below", "edited again");
  expect(text(await workspace.readBytes(A))).toBe(
    EDITED.replace("edited below", "edited again"),
  );

  // `unchecked`, by option and by workspace declaration (P-8's mutations).
  await workspace.file(A, ILL_FORMED, { mdx: "unchecked" });
  expect(text(await workspace.readBytes(A))).toBe(ILL_FORMED);
  await workspace.file("specs/fuzz.mdx", ILL_FORMED);
  expect(text(await workspace.readBytes("specs/fuzz.mdx"))).toBe(ILL_FORMED);

  // `per-draw`: exempt from the guard, still judged well-formed at staging.
  await workspace.file(A, WELL_FORMED, { mdx: "per-draw" });
  expect(text(await workspace.readBytes(A))).toBe(WELL_FORMED);
  let thrown: unknown;
  try {
    await workspace.file(A, ILL_FORMED, { mdx: "per-draw" });
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(HarnessStagingError);
  expect((thrown as HarnessStagingError).mode).toBe("mdx-derivability");
  expect((thrown as HarnessStagingError).message).toContain("per draw");
  expect(text(await workspace.readBytes(A))).toBe(WELL_FORMED);

  // A path S-9 does not judge.
  await workspace.file("notes.txt", "plain text\n");
  await workspace.file("src/app.ts", "export {};\n");
  expect(text(await workspace.readBytes("notes.txt"))).toBe("plain text\n");
});

test("an invocation inside the root marks the workspace; a background start marks it before the child runs; a sibling workspace stays unmarked", async () => {
  const first = await stage({ dirs: ["sub/deeper"] });
  const sibling = await stage({ files: { [A]: WELL_FORMED } });
  await invoke(first.path("sub/deeper"));
  expect(first.productInvoked).toBe(true);
  expect(sibling.productInvoked).toBe(false);
  await sibling.file(A, EDITED);
  expect(text(await sibling.readBytes(A))).toBe(EDITED);

  const held = await stage();
  const running = await startProduct(STANDIN, { cwd: held.root, argv: [] });
  expect(held.productInvoked).toBe(true);
  const result = await running.waitForExit();
  expect(result.exitCode).toBe(0);
  await expectRefused(() => held.file(A, WELL_FORMED), A);
});

test.runIf(onPosix)(
  "an invocation through a symbolic link resolving into the workspace marks it (the realpath is matched, T13.4-6's shape)",
  async () => {
    const workspace = await stage({ files: { [A]: WELL_FORMED } });
    const link = path.join(workspace.tempRoot, "link-work");
    await fsp.symlink("work", link, "dir");
    await invoke(link);
    expect(workspace.productInvoked).toBe(true);
    await expectRefused(() => workspace.file(A, EDITED), A);
  },
);

test("per-body reach: inside a registered body, an invocation anywhere makes a plain staging into a fresh workspace refused — its initial `files` take records and declared draws", async () => {
  expect(productInvokedInBody()).toBeUndefined();
  await runProductTestBody("T0-2", async () => {
    expect(productInvokedInBody()).toBeUndefined();
    const first = await stage({ files: { [A]: WELL_FORMED } });
    await first.file(A, EDITED); // before the body's first invocation
    await invoke(first.root);
    expect(productInvokedInBody()).toBe("T0-2");

    // A plain `.mdx` initial entry here is refused at creation (the next
    // test); a non-`.mdx` one is not.
    const later = await stage({ files: { "notes.txt": "plain text\n" } });
    expect(later.productInvoked).toBe(false);
    expect(text(await later.readBytes("notes.txt"))).toBe("plain text\n");
    await expectRefused(
      () => later.file("specs/B.mdx", WELL_FORMED),
      "specs/B.mdx",
      "in the running body of T0-2",
      "in another workspace",
    );
    expect(await later.kind("specs/B.mdx")).toBe("absent");
    await later.file(
      "specs/B.mdx",
      stagedMdx("T0-2 guard: the later-arm source", WELL_FORMED),
    );
    expect(text(await later.readBytes("specs/B.mdx"))).toBe(WELL_FORMED);
    await later.file("specs/C.mdx", ILL_FORMED, { mdx: "unchecked" });
    await later.file("specs/D.mdx", WELL_FORMED, { mdx: "per-draw" });

    // A later-arm workspace's initial `.mdx` files as records (the
    // record-accepting `files`): `create()` stages each under the record's
    // declaration, inside the body that has invoked; a `perDraw` entry is
    // judged well-formed and a `perDrawUnparseable` entry (P-12's
    // break-parse twist) unparseable, and each path takes plain contents
    // past the guard.
    const arm = await stage({
      files: {
        "specs/E.mdx": stagedMdx(
          "T0-2 guard: the later-arm initial source",
          WELL_FORMED,
        ),
        "specs/draw.mdx": WELL_FORMED,
        "specs/twist.mdx": ILL_FORMED,
        "notes.txt": "plain text\n",
      },
      mdx: {
        perDraw: ["specs/draw.mdx"],
        perDrawUnparseable: ["specs/twist.mdx"],
      },
    });
    expect(arm.productInvoked).toBe(false);
    expect(text(await arm.readBytes("specs/E.mdx"))).toBe(WELL_FORMED);
    expect(text(await arm.readBytes("specs/draw.mdx"))).toBe(WELL_FORMED);
    expect(text(await arm.readBytes("specs/twist.mdx"))).toBe(ILL_FORMED);
    await arm.file("specs/draw.mdx", EDITED);
    expect(text(await arm.readBytes("specs/draw.mdx"))).toBe(EDITED);
    await arm.file("specs/twist.mdx", ILL_FORMED_EDITED);
    expect(text(await arm.readBytes("specs/twist.mdx"))).toBe(
      ILL_FORMED_EDITED,
    );
    await expectRefused(
      () => arm.file("specs/E.mdx", EDITED),
      "specs/E.mdx",
      "in the running body of T0-2",
    );
  });
  expect(productInvokedInBody()).toBeUndefined();

  // Outside a body context only the per-workspace mark applies: a fresh
  // workspace after an invocation elsewhere is not flagged.
  const elsewhere = await stage();
  await invoke(elsewhere.root);
  const fresh = await stage();
  await fresh.file(A, WELL_FORMED);
  expect(text(await fresh.readBytes(A))).toBe(WELL_FORMED);
});

test("initial `files` join the guard: inside a body that has invoked the product, a plain `.mdx` entry of a fresh workspace is refused at creation with the rule, whatever its declaration, and nothing is left behind", async () => {
  const INITIAL =
    "an initial `files` entry of a workspace created after a product invocation in the running body of T0-9";
  await runProductTestBody("T0-9", async () => {
    // Before the body's first invocation the same creation passes — S-7's
    // sweep reaches it (a body's first workspace may stay plain).
    const first = expectCreated(
      await createInPrivateTemp({ files: { [A]: WELL_FORMED } }),
    );
    expect(text(await first.readBytes(A))).toBe(WELL_FORMED);
    await invoke(first.root);
    expect(productInvokedInBody()).toBe("T0-9");

    // After it: refused, the site and its remedies named, no temporary
    // directory left behind.
    const refused = await createInPrivateTemp({ files: { [A]: WELL_FORMED } });
    expect(refused.created).toBeUndefined();
    expectUndeclared(
      refused.thrown,
      A,
      INITIAL,
      "in another workspace",
      'staged with plain contents (declared "well-formed")',
      "Pass a staged-source record as the entry's value",
      "stagedMdx(",
      "`mdx.perDraw`",
      "`mdx.perDrawUnparseable`",
      "`mdx.unchecked`",
    );
    expect(refused.leftBehind).toEqual([]);

    // Entries staged before the refused one — a record, a non-`.mdx` file —
    // go with the disposed half-built workspace.
    const mixed = await createInPrivateTemp({
      files: {
        "specs/Z.mdx": stagedMdx(
          "T0-9 guard: an initial record staged before the refused entry",
          WELL_FORMED,
        ),
        "notes.txt": "plain text\n",
        [A]: WELL_FORMED,
      },
    });
    expectUndeclared(mixed.thrown, A, INITIAL);
    expect(mixed.leftBehind).toEqual([]);

    // Whatever the plain entry's declaration — unparseable and allowances
    // ride a record too — and under its normalized key.
    const unparseable = await createInPrivateTemp({
      files: { "specs/bad.mdx": ILL_FORMED },
      mdx: { unparseable: ["specs/bad.mdx"] },
    });
    expectUndeclared(
      unparseable.thrown,
      "specs/bad.mdx",
      INITIAL,
      'declared "unparseable"',
    );
    expect(unparseable.leftBehind).toEqual([]);
    const allowances = await createInPrivateTemp({
      files: { "specs/dup.mdx": WELL_FORMED },
      mdx: { allowances: { "specs/dup.mdx": ["duplicate-import-binding"] } },
    });
    expectUndeclared(
      allowances.thrown,
      "specs/dup.mdx",
      INITIAL,
      '"allowances":["duplicate-import-binding"]',
    );
    expect(allowances.leftBehind).toEqual([]);
    const unnormalized = await createInPrivateTemp({
      files: { "specs/deep/../B.mdx": WELL_FORMED },
    });
    expectUndeclared(unnormalized.thrown, "specs/B.mdx", INITIAL);
    expect(unnormalized.leftBehind).toEqual([]);

    // The exemptions: a record entry, staged under the record's declaration.
    const record = expectCreated(
      await createInPrivateTemp({
        files: {
          [A]: stagedMdx(
            "T0-9 guard: a later workspace's initial source",
            WELL_FORMED,
          ),
        },
      }),
    );
    expect(text(await record.readBytes(A))).toBe(WELL_FORMED);

    // `unchecked` (P-8's mutations, noise): never judged.
    const unchecked = expectCreated(
      await createInPrivateTemp({
        files: { [A]: ILL_FORMED },
        mdx: { unchecked: [A] },
      }),
    );
    expect(text(await unchecked.readBytes(A))).toBe(ILL_FORMED);

    // `perDraw`: past the guard, still judged well-formed at creation.
    const draw = expectCreated(
      await createInPrivateTemp({
        files: { [A]: WELL_FORMED },
        mdx: { perDraw: [A] },
      }),
    );
    expect(text(await draw.readBytes(A))).toBe(WELL_FORMED);
    const illDraw = await createInPrivateTemp({
      files: { [A]: ILL_FORMED },
      mdx: { perDraw: [A] },
    });
    expect(illDraw.thrown).toBeInstanceOf(HarnessStagingError);
    expect((illDraw.thrown as HarnessStagingError).mode).toBe(
      "mdx-derivability",
    );
    expect((illDraw.thrown as HarnessStagingError).message).toContain(
      "per draw",
    );
    expect(illDraw.leftBehind).toEqual([]);

    // `perDrawUnparseable` (P-12's break-parse twist): past the guard,
    // judged unparseable at creation.
    const twist = expectCreated(
      await createInPrivateTemp({
        files: { [A]: ILL_FORMED },
        mdx: { perDrawUnparseable: [A] },
      }),
    );
    expect(text(await twist.readBytes(A))).toBe(ILL_FORMED);

    // A path S-9 does not judge always passes.
    const plain = expectCreated(
      await createInPrivateTemp({
        files: {
          "notes.txt": "plain text\n",
          "src/app.ts": "export {};\n",
          "xspec.config.ts": "export default {};\n",
        },
      }),
    );
    expect(text(await plain.readBytes("src/app.ts"))).toBe("export {};\n");
  });

  // Outside any body context, after an invocation elsewhere: only the
  // per-workspace mark applies, and a workspace being created has none.
  const elsewhere = await stage();
  await invoke(elsewhere.root);
  expect(productInvokedInBody()).toBeUndefined();
  const outside = expectCreated(
    await createInPrivateTemp({ files: { [A]: WELL_FORMED } }),
  );
  expect(text(await outside.readBytes(A))).toBe(WELL_FORMED);
});

test("`runProductTestBody` keeps contexts apart and turns a synchronous throw into a rejection", async () => {
  await Promise.all([
    runProductTestBody("T0-3", async () => {
      noteProductInvocation("/nowhere/at/all", "/nowhere/at/all");
      expect(productInvokedInBody()).toBe("T0-3");
    }),
    runProductTestBody("T0-4", async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(productInvokedInBody()).toBeUndefined();
    }),
  ]);
  await expect(
    runProductTestBody("T0-5", () => {
      throw new TypeError("synchronous throw from the body");
    }),
  ).rejects.toThrow("synchronous throw from the body");
});

test("the root registry: an invocation at or under a registered root marks that root's live mark; `unregister` retires it", () => {
  const root = path.resolve("/xspec-guard-self-test/tmp-a/work");
  const realRoot = path.resolve("/xspec-guard-self-test/real/tmp-a/work");
  const mark = registerWorkspaceRoot(root, realRoot);
  expect(mark.invoked).toBe(false);
  const parent = path.resolve("/xspec-guard-self-test/tmp-a");
  noteProductInvocation(parent, parent);
  expect(mark.invoked).toBe(false); // the parent of a root is outside it
  noteProductInvocation(path.join(realRoot, "sub"), path.join(realRoot, "sub"));
  expect(mark.invoked).toBe(true); // the realpath key matches too
  unregisterWorkspaceRoot(mark);
  const again = registerWorkspaceRoot(root, realRoot);
  expect(again.invoked).toBe(false);
  noteProductInvocation(root, root);
  expect(again.invoked).toBe(true);
  unregisterWorkspaceRoot(again);
  unregisterWorkspaceRoot(again); // idempotent
});

test("`dispose()` unregisters the workspace, so a later invocation in its directory marks nothing live", async () => {
  const workspace = await TestWorkspace.create();
  const { root } = workspace;
  await workspace.dispose();
  await fsp.mkdir(root, { recursive: true });
  onTestFinished(() => workspace.dispose());
  await invoke(root);
  expect(workspace.productInvoked).toBe(false);
});

test("`perDraw` in the workspace declaration: the listed path's initial contents are judged well-formed at creation, and after an invocation a plain `file()` there passes the guard — still judged", async () => {
  const draw = "specs/draw.mdx";
  const workspace = await stage({
    files: { [A]: WELL_FORMED, [draw]: WELL_FORMED },
    mdx: { perDraw: [draw] },
  });
  expect(workspace.mdxDeclarationOf(draw)).toBe("per-draw");
  await invoke(workspace.root);
  await workspace.file(draw, EDITED);
  expect(text(await workspace.readBytes(draw))).toBe(EDITED);
  let thrown: unknown;
  try {
    await workspace.file(draw, ILL_FORMED);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(HarnessStagingError);
  expect((thrown as HarnessStagingError).mode).toBe("mdx-derivability");
  expect((thrown as HarnessStagingError).message).toContain("per draw");
  expect(text(await workspace.readBytes(draw))).toBe(EDITED);
  // The unlisted path is guarded as before.
  await expectRefused(() => workspace.file(A, EDITED), A, "in this workspace");

  // An ill-formed `perDraw` initial entry is refused at creation.
  thrown = undefined;
  try {
    const refused = await TestWorkspace.create({
      files: { [draw]: ILL_FORMED },
      mdx: { perDraw: [draw] },
    });
    onTestFinished(() => refused.dispose());
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(HarnessStagingError);
  expect((thrown as HarnessStagingError).mode).toBe("mdx-derivability");
  expect((thrown as HarnessStagingError).path).toBe(draw);
  expect((thrown as HarnessStagingError).message).toContain("per draw");
});

test("`per-draw` is a `file()` declaration only: the judge treats it as well-formed, and a ledger record refuses it", () => {
  judgeMdxDeclaration("draw", utf8(WELL_FORMED), "per-draw");
  let thrown: unknown;
  try {
    judgeMdxDeclaration("draw", utf8(ILL_FORMED), "per-draw");
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(HarnessStagingError);
  expect((thrown as HarnessStagingError).mode).toBe("mdx-derivability");
  expect((thrown as HarnessStagingError).message).toContain(
    "declared well-formed per draw",
  );
  expect(() =>
    stagedMdx("T0-6 per-draw record", WELL_FORMED, "per-draw"),
  ).toThrow(/per-draw/);
});

test("`per-draw-unparseable` after an invocation — by option, and as the workspace declaration's `perDrawUnparseable` list, whose initial contents are judged unparseable at creation — passes the guard, still judged unparseable at staging", async () => {
  const twist = "specs/twist.mdx";
  const workspace = await stage({
    files: { [A]: WELL_FORMED, [twist]: ILL_FORMED },
    mdx: { perDrawUnparseable: [twist] },
  });
  expect(workspace.mdxDeclarationOf(twist)).toBe("per-draw-unparseable");
  await invoke(workspace.root);

  // The list: a later plain `file()` of the path passes the guard, judged.
  await workspace.file(twist, ILL_FORMED_EDITED);
  expect(text(await workspace.readBytes(twist))).toBe(ILL_FORMED_EDITED);
  let thrown: unknown;
  try {
    await workspace.file(twist, WELL_FORMED);
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(HarnessStagingError);
  expect((thrown as HarnessStagingError).mode).toBe("mdx-derivability");
  expect((thrown as HarnessStagingError).message).toContain(
    "declared unparseable per draw",
  );
  expect(text(await workspace.readBytes(twist))).toBe(ILL_FORMED_EDITED);

  // The option, on an unlisted path the guard otherwise refuses.
  await workspace.file(A, ILL_FORMED, { mdx: "per-draw-unparseable" });
  expect(text(await workspace.readBytes(A))).toBe(ILL_FORMED);
  thrown = undefined;
  try {
    await workspace.file(A, EDITED, { mdx: "per-draw-unparseable" });
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(HarnessStagingError);
  expect((thrown as HarnessStagingError).mode).toBe("mdx-derivability");
  expect((thrown as HarnessStagingError).message).toContain(
    "declared unparseable per draw",
  );
  expect(text(await workspace.readBytes(A))).toBe(ILL_FORMED);
  await expectRefused(
    () => workspace.file(A, ILL_FORMED, { mdx: "unparseable" }),
    A,
    "in this workspace",
    "`per-draw-unparseable`",
  );

  // A deriving `perDrawUnparseable` initial entry is refused at creation.
  thrown = undefined;
  try {
    const refused = await TestWorkspace.create({
      files: { [twist]: WELL_FORMED },
      mdx: { perDrawUnparseable: [twist] },
    });
    onTestFinished(() => refused.dispose());
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(HarnessStagingError);
  expect((thrown as HarnessStagingError).mode).toBe("mdx-derivability");
  expect((thrown as HarnessStagingError).path).toBe(twist);
  expect((thrown as HarnessStagingError).message).toContain(
    "declared unparseable per draw",
  );
});

test("`per-draw-unparseable` is a `file()` declaration only: the judge treats it as unparseable, and a ledger record refuses it", () => {
  judgeMdxDeclaration("twist", utf8(ILL_FORMED), "per-draw-unparseable");
  let thrown: unknown;
  try {
    judgeMdxDeclaration("twist", utf8(WELL_FORMED), "per-draw-unparseable");
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(HarnessStagingError);
  expect(thrown).not.toBeInstanceOf(HarnessAssertionError);
  expect((thrown as HarnessStagingError).mode).toBe("mdx-derivability");
  expect((thrown as HarnessStagingError).path).toBe("twist");
  expect((thrown as HarnessStagingError).message).toContain(
    "declared unparseable per draw (`per-draw-unparseable`",
  );
  expect(() =>
    stagedMdx(
      "T0-8 per-draw-unparseable record",
      ILL_FORMED,
      "per-draw-unparseable",
    ),
  ).toThrow(/`per-draw-unparseable` — that declaration is a property draw's/);
});

test("`copyFrom()` carries another workspace's bytes — the product's output there — past the guard, judged at staging; out of a workspace the product never touched, the guard applies as to plain contents", async () => {
  const untouched = await stage({ files: { [A]: WELL_FORMED } });
  await runProductTestBody("T0-7", async () => {
    const source = await stage({
      files: { [A]: WELL_FORMED, "xspec.config.ts": "export default {};\n" },
      mdx: { unchecked: ["specs/fuzz.mdx"] },
    });
    await invoke(source.root);
    const fresh = await stage();
    await fresh.copyFrom(source, A);
    await fresh.copyFrom(source, "xspec.config.ts");
    await fresh.copyFrom(source, A, "specs/Copy.mdx");
    expect(text(await fresh.readBytes(A))).toBe(WELL_FORMED);
    expect(text(await fresh.readBytes("specs/Copy.mdx"))).toBe(WELL_FORMED);
    expect(text(await fresh.readBytes("xspec.config.ts"))).toBe(
      "export default {};\n",
    );

    // Judged at staging under the destination's declaration (well-formed).
    await source.file("specs/fuzz.mdx", ILL_FORMED);
    let thrown: unknown;
    try {
      await fresh.copyFrom(source, "specs/fuzz.mdx");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(HarnessStagingError);
    expect((thrown as HarnessStagingError).mode).toBe("mdx-derivability");
    expect(await fresh.kind("specs/fuzz.mdx")).toBe("absent");

    // Out of a workspace no product touched: the harness's own bytes, a
    // deterministic fixture — refused here, inside a body that has invoked
    // the product.
    await expectRefused(
      () => fresh.copyFrom(untouched, A, "specs/B.mdx"),
      "specs/B.mdx",
      "in the running body of T0-7",
      "`copyFrom()`",
    );
    expect(await fresh.kind("specs/B.mdx")).toBe("absent");
  });

  // Before any invocation (outside a body, nothing invoked in the
  // destination) the same copy is a pre-invocation staging S-7 reaches.
  const fresh = await stage();
  await fresh.copyFrom(untouched, A);
  expect(text(await fresh.readBytes(A))).toBe(WELL_FORMED);
});
