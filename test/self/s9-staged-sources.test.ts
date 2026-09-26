// Self-test of the staged-source ledger (test/helpers/staged-mdx.ts;
// TEST-SPEC 17 S-9, H-8). Every MDX source a registered test body stages
// after a product invocation in its workspace — an edit, a replacement, an
// arm's variant — is a deterministic fixture file whose well-formedness the
// document declares, and S-9's check runs for it before any product exists.
// S-7's sweep against the empty stub reaches a test's initial staging and the
// `file()` calls before its first invocation only — the body fails at that
// invocation — so a post-invocation staging used to be judged first at suite
// time, against a real product. The ledger closes that gap: each such source
// is a record created at module load (the very expression the staging used,
// moved, never re-spelled) carrying its bytes and its S-9 declaration;
// `TestWorkspace.file()` stages the record; and this file, which loads the
// whole registry (so the ledger is complete and sealed), judges every record
// against its declaration with the builder's own judge (`judgeMdxDeclaration`
// — the one code path `file()` applies at staging time). A record
// contradicting its declaration fails here, before any product exists, as a
// `HarnessStagingError` (mode `mdx-derivability`) — never a product failure,
// never a skip.
//
// Also verified: the ledger's invariants (sealed once the registry has
// loaded, so a run-time registration throws; non-empty; uniquely named, each
// name led by the ID of a registered test, or by E-6 for the §18 exchange
// fixture's four records — helpers/e6.ts is no registry entry, so this file
// imports it before the manifest seals the ledger; no `unchecked` record —
// that declaration is P-8's mutations' alone), its registration rules on a fresh
// unsealed instance, the builder's record overload (a record stages exactly
// its bytes under its own declaration, which overrides the workspace's for
// the path; an `mdx` option beside it, or a non-`.mdx` path, throws with
// nothing written), the record-accepting initial `files` of a workspace
// declaration (`InitialFileContents` — the form of a later-arm workspace's
// initial `.mdx` files, which S-7's sweep never reaches: `create()` stages
// a record under the record's declaration; a record at a non-`.mdx` key, or
// beside a workspace-declaration entry naming its path, throws; the
// declaration's `perDraw` list judges a draw's initial file as well-formed
// and declares the path `per-draw`; `mdxPathsOf` lists a rendered map's
// plain `.mdx` keys for such a list, records left out), the builder's
// `edit()` (a rewrite of the current bytes,
// judged under the path's declaration), and the judge's own red checks (an
// ill-formed source declared well-formed and a deriving source declared
// unparseable both throw; `unchecked` judges nothing).

import { Buffer } from "node:buffer";
import { describe, expect, onTestFinished, test, vi } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import type { MdxAllowance } from "../helpers/mdx-derivability.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import {
  StagedMdx,
  isStagedMdxLedgerSealed,
  stagedMdx,
  stagedMdxLedger,
} from "../helpers/staged-mdx.js";
import {
  TestWorkspace,
  judgeMdxDeclaration,
  mdxPathsOf,
} from "../helpers/workspace.js";
import type { WorkspaceDecl, WorkspaceMdxDecl } from "../helpers/workspace.js";
// The E-6 exchange fixture (helpers/e6.ts) is no registry entry, yet stages
// four `.mdx` sources no sweep reaches — three initial files, and one edit
// after its first invocations — as records of its own, which this import
// registers BEFORE the registry manifest below seals the ledger.
import "../helpers/e6.js";
import { productTestSuite } from "../suite/registry/index.js";

const LF = String.fromCodePoint(0x000a);

/** Lines joined by U+000A, the last one terminated. */
const doc = (...lines: readonly string[]): string => lines.join(LF) + LF;

const utf8 = (text: string): Uint8Array => Buffer.from(text, "utf8");

const bytesOf = (source: string | Uint8Array): Uint8Array =>
  typeof source === "string" ? utf8(source) : source;

const text = (data: Uint8Array): string => Buffer.from(data).toString("utf8");

/** The complete ledger: every registry module has loaded through the manifest. */
const LEDGER = stagedMdxLedger();

/** TEST-SPEC §18 E-6's ID: the exchange fixture (helpers/e6.ts), no registry entry. */
const E6_FIXTURE_ID = "E-6";

const ILL_FORMED = doc('<S id="x">', "", "never closed");
const WELL_FORMED = doc('<S id="x">', "", "closed below", "", "</S>");
const DUPLICATE_BINDING = doc(
  'import { a } from "./x.xspec"',
  'import { a } from "./y.xspec"',
  "",
  "# Doc",
);

async function stage(decl: WorkspaceDecl = {}): Promise<TestWorkspace> {
  const workspace = await TestWorkspace.create(decl);
  onTestFinished(() => workspace.dispose());
  return workspace;
}

function expectMdxStagingError(
  thrown: unknown,
  key: string,
  ...fragments: readonly string[]
): void {
  expect(thrown).toBeInstanceOf(HarnessStagingError);
  expect(thrown).not.toBeInstanceOf(HarnessAssertionError);
  const error = thrown as HarnessStagingError;
  expect(error.name).toBe("HarnessStagingError");
  expect(error.mode).toBe("mdx-derivability");
  expect(error.path).toBe(key);
  expect(error.message).toContain(`mdx-derivability staging of ${key}: `);
  for (const fragment of fragments) {
    expect(error.message).toContain(fragment);
  }
}

async function expectStagingRejected(
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
  expectMdxStagingError(thrown, key, ...fragments);
}

function expectJudgeRejects(
  action: () => void,
  key: string,
  ...fragments: readonly string[]
): void {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }
  expectMdxStagingError(thrown, key, ...fragments);
}

/** A well-formed record of the registry's own, for the builder checks. */
function someWellFormedRecord(): StagedMdx {
  const record = LEDGER.find((entry) => entry.mdx === "well-formed");
  if (record === undefined) {
    throw new Error("the ledger holds no well-formed record");
  }
  return record;
}

/** A record of the registry's own declared unparseable, for the builder checks. */
function someUnparseableRecord(): StagedMdx {
  const record = LEDGER.find((entry) => entry.mdx === "unparseable");
  if (record === undefined) {
    throw new Error("the ledger holds no unparseable record");
  }
  return record;
}

/**
 * `TestWorkspace.create(decl)` must be refused with an S-9 staging error
 * naming `key`; a workspace it unexpectedly yields is disposed.
 */
async function createRejected(
  decl: WorkspaceDecl,
  key: string,
  ...fragments: readonly string[]
): Promise<void> {
  await expectStagingRejected(
    async () => {
      const workspace = await TestWorkspace.create(decl);
      onTestFinished(() => workspace.dispose());
    },
    key,
    ...fragments,
  );
}

/**
 * A fresh, unsealed ledger and the builder bound to it — both modules
 * re-evaluated after `vi.resetModules()`, so the fresh builder's `StagedMdx`
 * is the fresh ledger's class — for the checks that need a record
 * contradicting its declaration: the sealed registry ledger holds none,
 * this file having judged every record. The fresh builder's errors are the
 * fresh permissions module's, matched by name and mode, not `instanceof`.
 */
async function freshBuilder(): Promise<{
  readonly ledger: typeof import("../helpers/staged-mdx.js");
  readonly builder: typeof import("../helpers/workspace.js");
}> {
  vi.resetModules();
  const ledger = await import("../helpers/staged-mdx.js");
  const builder = await import("../helpers/workspace.js");
  return { ledger, builder };
}

function expectFreshStagingError(
  thrown: unknown,
  key: string,
  ...fragments: readonly string[]
): void {
  expect(thrown).toBeInstanceOf(Error);
  const error = thrown as Error & { mode?: unknown; path?: unknown };
  expect(error.name).toBe("HarnessStagingError");
  expect(error.mode).toBe("mdx-derivability");
  expect(error.path).toBe(key);
  for (const fragment of fragments) {
    expect(error.message).toContain(fragment);
  }
}

// ---------------------------------------------------------------------------
// The ledger's invariants, with the whole registry loaded.

describe("S-9: the staged-source ledger, once the registry has loaded", () => {
  test("is sealed, so a record created at run time throws instead of escaping this self-test", () => {
    expect(isStagedMdxLedgerSealed()).toBe(true);
    expect(() => stagedMdx("T0-0 late record", doc("# Late"))).toThrow(
      /sealed/,
    );
    expect(() => new StagedMdx("T0-0 late record", doc("# Late"))).toThrow(
      /sealed/,
    );
    expect(LEDGER.some((record) => record.name === "T0-0 late record")).toBe(
      false,
    );
  });

  test("is non-empty, and every record is an immutable, uniquely named `StagedMdx`", () => {
    expect(LEDGER.length).toBeGreaterThan(0);
    const names = LEDGER.map((record) => record.name);
    expect(new Set(names).size).toBe(names.length);
    for (const record of LEDGER) {
      expect(record).toBeInstanceOf(StagedMdx);
      expect(Object.isFrozen(record)).toBe(true);
      expect(record.name.trim().length).toBeGreaterThan(0);
      expect(
        typeof record.source === "string" ||
          record.source instanceof Uint8Array,
      ).toBe(true);
    }
  });

  test("names every record after registered tests: `<TEST-ID>[/<TEST-ID>…] <what it stages>` — or after E-6, the §18 exchange fixture's ID (helpers/e6.ts), for its four records", () => {
    let e6Records = 0;
    for (const record of LEDGER) {
      const [lead, ...rest] = record.name.split(" ");
      expect(rest.join(" ").trim(), record.name).not.toBe("");
      for (const id of (lead ?? "").split("/")) {
        if (id === E6_FIXTURE_ID) {
          e6Records += 1;
          continue;
        }
        expect(
          productTestSuite.has(id),
          `${record.name}: ${id} names no registered test (nor ${E6_FIXTURE_ID}, the exchange fixture of helpers/e6.ts)`,
        ).toBe(true);
      }
    }
    // The fixture's records — its three initial `.mdx` sources and its leaf
    // edit — are judged here like every other: its module loaded before the
    // seal (the import order above).
    expect(e6Records).toBe(4);
  });

  test("holds no `unchecked` record (that declaration is P-8's mutations' alone, S-9)", () => {
    for (const record of LEDGER) {
      expect(record.mdx, record.name).not.toBe("unchecked");
    }
  });
});

// ---------------------------------------------------------------------------
// The check S-9 requires before any product exists: every record matches its
// declaration under the builder's own judge.

describe("S-9: every staged source in the ledger matches its declaration before any product exists", () => {
  test.each(LEDGER.map((record) => [record.name, record] as const))(
    "%s",
    (_name, record) => {
      judgeMdxDeclaration(record.name, bytesOf(record.source), record.mdx);
    },
  );
});

// ---------------------------------------------------------------------------
// The registration rules, on a fresh, unsealed instance of the module.

describe("S-9: the ledger's registration rules", () => {
  async function freshLedger(): Promise<
    typeof import("../helpers/staged-mdx.js")
  > {
    vi.resetModules();
    return await import("../helpers/staged-mdx.js");
  }

  test("a record registers in order with its declaration, well-formed by default; a duplicate name throws", async () => {
    const ledger = await freshLedger();
    expect(ledger.isStagedMdxLedgerSealed()).toBe(false);
    expect(ledger.stagedMdxLedger()).toEqual([]);
    const a = ledger.stagedMdx("T0-1 a", WELL_FORMED);
    const b = ledger.stagedMdx("T0-1 b", utf8(ILL_FORMED), "unparseable");
    const c = ledger.stagedMdx("T0-1 c", DUPLICATE_BINDING, {
      allowances: ["duplicate-import-binding"],
    });
    expect(a.mdx).toBe("well-formed");
    expect(a.source).toBe(WELL_FORMED);
    expect(b.mdx).toBe("unparseable");
    expect(c.mdx).toEqual({ allowances: ["duplicate-import-binding"] });
    expect(ledger.stagedMdxLedger()).toEqual([a, b, c]);
    expect(() => ledger.stagedMdx("T0-1 a", WELL_FORMED)).toThrow(/duplicate/);
    expect(ledger.stagedMdxLedger()).toHaveLength(3);
  });

  test("an `unchecked` declaration, an empty name, an unknown allowance, an empty allowance list, and non-file contents are refused", async () => {
    const ledger = await freshLedger();
    expect(() => ledger.stagedMdx("T0-2 u", WELL_FORMED, "unchecked")).toThrow(
      /unchecked/,
    );
    expect(() => ledger.stagedMdx("  ", WELL_FORMED)).toThrow(/non-empty name/);
    expect(() =>
      ledger.stagedMdx("T0-2 n", WELL_FORMED, {
        allowances: ["nope" as MdxAllowance],
      }),
    ).toThrow(/invalid declaration/);
    expect(() =>
      ledger.stagedMdx("T0-2 e", WELL_FORMED, { allowances: [] }),
    ).toThrow(/invalid declaration/);
    expect(() =>
      ledger.stagedMdx("T0-2 c", { text: WELL_FORMED } as unknown as string),
    ).toThrow(/string or byte contents/);
    expect(ledger.stagedMdxLedger()).toEqual([]);
  });

  test("sealing freezes the ledger: a later registration throws, and sealing twice throws", async () => {
    const ledger = await freshLedger();
    const a = ledger.stagedMdx("T0-3 a", WELL_FORMED);
    ledger.sealStagedMdxLedger();
    expect(ledger.isStagedMdxLedgerSealed()).toBe(true);
    expect(() => ledger.stagedMdx("T0-3 b", WELL_FORMED)).toThrow(/sealed/);
    expect(() => ledger.sealStagedMdxLedger()).toThrow(/sealed twice/);
    expect(ledger.stagedMdxLedger()).toEqual([a]);
    expect(Object.isFrozen(ledger.stagedMdxLedger())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The builder's record overload (helpers/workspace.ts `file()`).

describe("S-9: the builder stages a record's bytes under the record's declaration", () => {
  test("a record stages exactly its bytes", async () => {
    const record = someWellFormedRecord();
    const workspace = await stage();
    await workspace.file("specs/record.mdx", record);
    expect(
      Buffer.compare(
        Buffer.from(await workspace.readBytes("specs/record.mdx")),
        Buffer.from(bytesOf(record.source)),
      ),
    ).toBe(0);
  });

  test("a record's declaration overrides the workspace declaration for its path, as the `mdx` option does; plain contents there are judged under the workspace's", async () => {
    const record = someWellFormedRecord();
    const workspace = await stage({
      mdx: { unparseable: ["specs/record.mdx"] },
    });
    await workspace.file("specs/record.mdx", record);
    expect(await workspace.kind("specs/record.mdx")).toBe("file");
    await expectStagingRejected(
      () => workspace.file("specs/record.mdx", record.source),
      "specs/record.mdx",
      "declared unparseable (`mdx.unparseable`) but the source derives",
    );
  });

  test("an `mdx` option beside a record is a contradiction: nothing is written", async () => {
    const record = someWellFormedRecord();
    const workspace = await stage();
    await expectStagingRejected(
      () => workspace.file("specs/record.mdx", record, { mdx: "well-formed" }),
      "specs/record.mdx",
      "contradiction",
      JSON.stringify(record.name),
    );
    expect(await workspace.kind("specs/record.mdx")).toBe("absent");
  });

  test("a record at a path S-9 does not judge is a mistake: nothing is written", async () => {
    const record = someWellFormedRecord();
    const workspace = await stage();
    await expectStagingRejected(
      () => workspace.file("src/record.ts", record),
      "src/record.ts",
      "not an `.mdx` path",
      JSON.stringify(record.name),
    );
    expect(await workspace.kind("src/record.ts")).toBe("absent");
  });

  test("a record is judged at staging time too (the same judge): a fresh ledger's contradicting record throws", async () => {
    vi.resetModules();
    const ledger = await import("../helpers/staged-mdx.js");
    // The fresh module instance's class is not the builder's, so the record
    // is staged through the judge the builder applies to plain contents
    // under the record's own declaration — the code path `file()` takes.
    const record = ledger.stagedMdx("T0-4 ill-formed", ILL_FORMED);
    expectJudgeRejects(
      () =>
        judgeMdxDeclaration(record.name, bytesOf(record.source), record.mdx),
      record.name,
      "declared well-formed (S-9's default) but the stock MDX 3 parser rejects it",
    );
  });
});

// ---------------------------------------------------------------------------
// The record-accepting initial `files` (`InitialFileContents`): the form of a
// later-arm workspace's initial `.mdx` files — a workspace the body creates
// after its first product invocation, which S-7's sweep never reaches — so
// `create()` stages a record under the record's declaration as `file()`
// does. A refusal is `create()`'s: the workspace is disposed, nothing left.

describe("S-9: the builder stages an initial `files` record under the record's declaration", () => {
  test("a record in `files` stages exactly its bytes, under its own declaration: a well-formed record and an unparseable one alike, whatever the workspace's default for the path", async () => {
    const wellFormed = someWellFormedRecord();
    const unparseable = someUnparseableRecord();
    const workspace = await stage({
      files: {
        "specs/record.mdx": wellFormed,
        "specs/unparseable.mdx": unparseable,
        "notes.txt": "plain text\n",
      },
    });
    expect(
      Buffer.compare(
        Buffer.from(await workspace.readBytes("specs/record.mdx")),
        Buffer.from(bytesOf(wellFormed.source)),
      ),
    ).toBe(0);
    expect(
      Buffer.compare(
        Buffer.from(await workspace.readBytes("specs/unparseable.mdx")),
        Buffer.from(bytesOf(unparseable.source)),
      ),
    ).toBe(0);
    expect(text(await workspace.readBytes("notes.txt"))).toBe("plain text\n");
    // The path's workspace declaration is the default (well-formed), under
    // which the unparseable record's bytes are refused as plain contents:
    // the record's own declaration governed the staging.
    expect(workspace.mdxDeclarationOf("specs/unparseable.mdx")).toBe(
      "well-formed",
    );
    await expectStagingRejected(
      () => workspace.file("specs/unparseable.mdx", unparseable.source),
      "specs/unparseable.mdx",
      "declared well-formed (S-9's default) but the stock MDX 3 parser rejects it",
    );
  });

  test("a record is judged at creation (the same judge): a fresh ledger's contradicting record makes `create()` throw, either way round", async () => {
    const { ledger, builder } = await freshBuilder();
    const deriving = ledger.stagedMdx(
      "T0-5 deriving, declared unparseable",
      WELL_FORMED,
      "unparseable",
    );
    const illFormed = ledger.stagedMdx(
      "T0-5 ill-formed, declared well-formed",
      ILL_FORMED,
    );
    for (const [record, fragment] of [
      [
        deriving,
        "declared unparseable (`mdx.unparseable`) but the source derives",
      ],
      [
        illFormed,
        "declared well-formed (S-9's default) but the stock MDX 3 parser rejects it",
      ],
    ] as const) {
      let thrown: unknown;
      try {
        const workspace = await builder.TestWorkspace.create({
          files: { "specs/record.mdx": record },
        });
        onTestFinished(() => workspace.dispose());
      } catch (error) {
        thrown = error;
      }
      expectFreshStagingError(thrown, "specs/record.mdx", fragment);
    }
  });

  test("a record at a key S-9 does not judge is a mistake: `create()` throws", async () => {
    const record = someWellFormedRecord();
    await createRejected(
      { files: { "src/record.ts": record } },
      "src/record.ts",
      "not an `.mdx` path",
      JSON.stringify(record.name),
    );
  });

  test("a record beside a workspace declaration naming its path is a contradiction, whichever list names it: `create()` throws", async () => {
    const record = someWellFormedRecord();
    const P = "specs/record.mdx";
    const declarations: readonly WorkspaceMdxDecl[] = [
      { unparseable: [P] },
      { unchecked: [P] },
      { allowances: { [P]: ["duplicate-import-binding"] } },
      { perDraw: [P] },
    ];
    for (const mdx of declarations) {
      await createRejected(
        { files: { [P]: record }, mdx },
        P,
        "contradiction",
        JSON.stringify(record.name),
        "drop the declaration entry",
      );
    }
  });

  test("`perDraw`: a listed path's initial contents are judged well-formed at creation and the path is declared `per-draw`; an ill-formed entry throws; a path in two lists, or not an MDX source, throws", async () => {
    const draw = "specs/draw.mdx";
    const workspace = await stage({
      files: { [draw]: WELL_FORMED },
      mdx: { perDraw: [draw] },
    });
    expect(workspace.mdxDeclarationOf(draw)).toBe("per-draw");
    expect(text(await workspace.readBytes(draw))).toBe(WELL_FORMED);
    await createRejected(
      { files: { [draw]: ILL_FORMED }, mdx: { perDraw: [draw] } },
      draw,
      "declared well-formed per draw",
      "but the stock MDX 3 parser rejects it",
    );
    await createRejected(
      { mdx: { perDraw: [draw], unchecked: [draw] } },
      draw,
      "more than one of",
      "`perDraw`",
    );
    await createRejected(
      { mdx: { perDraw: ["specs/draw.md"] } },
      "specs/draw.md",
      "not an MDX source",
    );
  });

  test("`mdxPathsOf`: the plain `.mdx` keys of an initial `files` map, in map order — a record entry and a non-`.mdx` key left out — so a `perDraw` list derived from a rendered map never names a record's path", async () => {
    const record = someWellFormedRecord();
    const files = {
      "xspec.config.ts": "export default {}",
      "specs/b.mdx": WELL_FORMED,
      "specs/a.mdx": WELL_FORMED,
      "specs/note.md": "# not judged",
      "specs/record.mdx": record,
      "specs/bytes.mdx": Buffer.from(WELL_FORMED, "utf8"),
    };
    expect(mdxPathsOf(files)).toEqual([
      "specs/b.mdx",
      "specs/a.mdx",
      "specs/bytes.mdx",
    ]);
    expect(mdxPathsOf({})).toEqual([]);
    expect(mdxPathsOf({ "specs/record.mdx": record })).toEqual([]);
    const workspace = await stage({
      files,
      mdx: { perDraw: mdxPathsOf(files) },
    });
    for (const rel of ["specs/b.mdx", "specs/a.mdx", "specs/bytes.mdx"]) {
      expect(workspace.mdxDeclarationOf(rel)).toBe("per-draw");
    }
    expect(await workspace.readBytes("specs/record.mdx")).toEqual(
      bytesOf(record.source),
    );
  });
});

// ---------------------------------------------------------------------------
// The builder's `edit()`: a rewrite of the current bytes — the form of an
// edit to bytes the product wrote — judged under the path's declaration.

describe("S-9: the builder's edit() rewrites the current bytes under the path's declaration", () => {
  const BASE = doc('<S id="e">', "", "Alpha text. Alpha text.", "", "</S>");

  test("replaces the first occurrence of `from` and stages the result", async () => {
    const workspace = await stage({ files: { "specs/e.mdx": BASE } });
    await workspace.edit("specs/e.mdx", "Alpha text.", "Alpha text, edited.");
    expect(text(await workspace.readBytes("specs/e.mdx"))).toBe(
      doc('<S id="e">', "", "Alpha text, edited. Alpha text.", "", "</S>"),
    );
  });

  test("a `from` the file does not contain is a harness staging error, the file untouched", async () => {
    const workspace = await stage({ files: { "specs/e.mdx": BASE } });
    await expect(
      workspace.edit("specs/e.mdx", "Beta text.", "Beta text, edited."),
    ).rejects.toThrow(/harness staging: specs\/e\.mdx does not contain/);
    expect(text(await workspace.readBytes("specs/e.mdx"))).toBe(BASE);
  });

  test("an edit breaking well-formedness contradicts the path's declaration (well-formed by default): nothing is written", async () => {
    const workspace = await stage({ files: { "specs/e.mdx": BASE } });
    await expectStagingRejected(
      () => workspace.edit("specs/e.mdx", "</S>", ""),
      "specs/e.mdx",
      "declared well-formed (S-9's default) but the stock MDX 3 parser rejects it",
    );
    expect(text(await workspace.readBytes("specs/e.mdx"))).toBe(BASE);
  });

  test("a path the workspace declares unparseable judges the edit under that declaration", async () => {
    const workspace = await stage({
      files: { "specs/u.mdx": ILL_FORMED },
      mdx: { unparseable: ["specs/u.mdx"] },
    });
    await workspace.edit("specs/u.mdx", "never closed", "still never closed");
    await expectStagingRejected(
      () => workspace.edit("specs/u.mdx", "still never closed", "closed\n</S>"),
      "specs/u.mdx",
      "declared unparseable (`mdx.unparseable`) but the source derives",
    );
    expect(text(await workspace.readBytes("specs/u.mdx"))).toBe(
      doc('<S id="x">', "", "still never closed"),
    );
  });
});

// ---------------------------------------------------------------------------
// The judge itself (the one code path the builder and this self-test share).

describe("S-9: the judge — an ill-formed source declared well-formed and a deriving source declared unparseable both throw", () => {
  test("an ill-formed source declared well-formed throws mode `mdx-derivability`, naming the key and the parser's rejection", () => {
    expectJudgeRejects(
      () =>
        judgeMdxDeclaration(
          "hand-made ill-formed",
          utf8(ILL_FORMED),
          "well-formed",
        ),
      "hand-made ill-formed",
      "declared well-formed (S-9's default) but the stock MDX 3 parser rejects it",
    );
  });

  test("a deriving source declared unparseable throws", () => {
    expectJudgeRejects(
      () =>
        judgeMdxDeclaration(
          "hand-made deriving",
          utf8(WELL_FORMED),
          "unparseable",
        ),
      "hand-made deriving",
      "declared unparseable (`mdx.unparseable`) but the source derives",
    );
  });

  test("a source relying on an early error passes under its named allowance alone", () => {
    judgeMdxDeclaration("allowed", utf8(DUPLICATE_BINDING), {
      allowances: ["duplicate-import-binding"],
    });
    expectJudgeRejects(
      () =>
        judgeMdxDeclaration(
          "not allowed",
          utf8(DUPLICATE_BINDING),
          "well-formed",
        ),
      "not allowed",
      "declared well-formed (S-9's default) but the stock MDX 3 parser rejects it",
    );
    expectJudgeRejects(
      () =>
        judgeMdxDeclaration("unknown allowance", utf8(WELL_FORMED), {
          allowances: ["nope" as MdxAllowance],
        }),
      "unknown allowance",
      "unknown allowance",
    );
  });

  test("a matching declaration passes, and `unchecked` judges nothing", () => {
    judgeMdxDeclaration("well-formed", utf8(WELL_FORMED), "well-formed");
    judgeMdxDeclaration("unparseable", utf8(ILL_FORMED), "unparseable");
    judgeMdxDeclaration("unchecked", utf8(ILL_FORMED), "unchecked");
  });
});
