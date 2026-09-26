// TEST-SPEC §6.5 (move), second half — SUITE-25 (continued): T6.5-11,
// TypeScript `text(...)` calls across the section-form move. T6.5-1…T6.5-10
// are section-6.5.ts's business; this module keeps that file's edits bounded
// (the section-10.7-i/-ii precedent).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 6.5 (reference spellings; import edits): a TypeScript `text(...)`
// call whose target the section form carries into another file is rooted,
// callee and argument, at bindings of the module its target joins — the
// callee at that module's `text` binding (4.3, 4.4), the argument at its
// default binding — and so rewritten whole, over its occurrence's span
// (5.7: callee through closing parenthesis), and is never the cross-module
// call of 14.11. An import is added exactly where the file lacks a binding a
// spelling is rooted at — one declaration per module, binding exactly the
// lacked bindings — spelled `import X, { text as Y } from "…"` or
// `import { text as Y } from "…"`, the named binding `{ text }` where its
// identifier is `text` itself, single spaces, no `;`, the specifier
// double-quoted in the canonical relative spelling, inserted as a line of
// its own at an admissible offset, a line-start one taken over any other.
// An existing import is removed exactly when an occurrence used a binding
// of its before the rewrite and none uses any binding of its after it — its
// declaration deleted in place, a line left empty purely by the deletion
// dropped with its terminator (3) — while a type-level spelling of a binding
// (4.5) is no occurrence and keeps no import: a removal can leave one naming
// a vanished binding, a consumer type error outside xspec's validations.
// Beyond these edits a move changes no bytes. SPEC 6.6/12.7: the preview
// reports, per rewritten file, each edit as class plus pre-operation range —
// a `reference-rewrite` over the occurrence's span, an `import-addition` as
// a zero-length range at the offset the real operation uses, an
// `import-removal` spanning the declaration plus its adjunct drops.
//
// Conservative operationalizations (noted per H-4):
// - The fresh identifiers are the only unpinned runs (TEST-SPEC T6.5-11).
//   Both are read off the rewritten call — the one place 6.4/6.5's pinned
//   spelling makes them observable: exactly one `<callee>(<root>.y)` in the
//   file, `<callee>` the added `text` binding (or `text`) and `<root>` the
//   target module's default binding — the added declaration is then
//   composed byte-exactly with those identifiers substituted, the file's
//   post-move bytes WITHOUT it composed from the rules of 6.5 and 3 (the
//   origin declaration's line removed where both its bindings lose their
//   last use, the call's occurrence span replaced by the rewritten call —
//   "the call's span as a second isolated run"), and the single inserted
//   run isolated by diff (`assertExactDeclarationInsertion`) must read, at
//   some admissible offset lying at the start of a line, as exactly that
//   declaration followed by U+000A. Where the file keeps a binding (the
//   retained origin import of (c), the existing `T` of (b)) the fresh
//   identifiers may not be it — asserted directly (a collision is also
//   TS2300 under the compile), never narrowing 6.5's latitude.
// - "`build` and `check` are clean (no 14.11, no 14.7)" is each command's
//   `--json` report decoded as exactly `{"findings": []}` at exit 0.
// - (a)'s preview parity runs on a second, identically staged workspace
//   after the real move — the real move first, so the headline observation
//   (the move succeeding, the call never becoming the cross-module call of
//   14.11) is the first diagnosis. Byte determinism (6.1, 6.5) makes the two
//   workspaces comparable: the `import-addition`'s pre-operation offset is
//   mapped to composed coordinates (6.5's composition — an offset strictly
//   inside the removal's or the rewrite's range is diagnosed; the removal's
//   start and end compose to one position, the assertion admitting either,
//   T6.6-4 (b)) and must be one of the offsets at which the real move's
//   inserted run reads as the disciplined declaration.
// - (b), (c), and (d) pin no preview (TEST-SPEC pins (a)'s), and no arm
//   pins the origin's and target's plan entries (T6.6-4's business); the
//   origin and target files' post-move bytes are asserted whole as
//   soundness guards, composed from 6.5 and 3 with no latitude, as
//   T6.5-8's arms compose them.
// - (d)'s discriminating expectation — the standard-tooling compile fails
//   after the move — is asserted through H-2's tooling channel as at least
//   one error diagnostic located within the type alias statement's
//   characters (the vanished binding's error), the file having compiled
//   clean before the move (a fixture self-check every arm makes).

import { Buffer } from "node:buffer";
import type {
  GraphEdge,
  PreviewEdit,
  PreviewFileEntry,
} from "../../helpers/adapters/index.js";
import {
  decodeEdgesReport,
  decodePreviewReport,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import { assertFileBytes, fail } from "../../helpers/assertions.js";
import { assertExactDeclarationInsertion } from "../../helpers/import-insertion.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import {
  ConsumerProject,
  assertNoCompileErrors,
} from "../../helpers/tooling.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  assertEdgeSetEqual,
  assertSameJson,
  buildOk,
  expectExit,
  expectFindingFreeReport,
  runJson,
} from "./support.js";

// One spec group plus one code group (SPEC 7.2): the code file is a
// discovered code source, so its call records an occurrence and its edge.
const CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`;

const ORIGIN = "specs/origin.mdx";
const TARGET = "specs/target.mdx";
const CODE = "src/c.ts";
/** The canonical relative spelling of the target module from `src/`. */
const TARGET_SPECIFIER = "../specs/target.xspec";
const MOVE_ARGV = ["move", `${ORIGIN}#x`, `${TARGET}#y`] as const;
const MOVE_LABEL = MOVE_ARGV.join(" ");

// The origin holds the moved `x` and, for (c)'s second call, the unmoved
// `w`; the target holds `z`, (b)'s marker target. Both are ledger records
// (S-9's before-any-product clause; helpers/staged-mdx.ts): every arm after
// the first stages them after the body's first product invocation.
const ORIGIN_BEFORE = stagedMdx(
  "T6.5-11 specs/origin.mdx",
  [
    '<S id="x">',
    "Moved x text.",
    "</S>",
    "",
    '<S id="w">',
    "Unmoved w text.",
    "</S>",
    "",
  ].join("\n"),
);

// Composed from SPEC 6.5 and 3: the construct's own characters deleted in
// place; the merged line that deletion leaves holds only the closing tag's
// terminator and is dropped with it; the blank line that separated the two
// sections was blank before the deletion and stays. No import is gained:
// nothing left in the origin references a moved node.
const ORIGIN_AFTER = ["", '<S id="w">', "Unmoved w text.", "</S>", ""].join(
  "\n",
);

const TARGET_BEFORE = stagedMdx(
  "T6.5-11 specs/target.mdx",
  ['<S id="z">', "Target z text.", "</S>", ""].join("\n"),
);

// Composed from SPEC 6.5: top-level `y`, so the moved text — re-identified
// by prefix replacement `x` → `y` — is inserted at the end of the file
// followed by U+000A; the existing final line is terminated, so the
// insertion point lies at a line start and no preceding U+000A is added.
const TARGET_AFTER = [
  '<S id="z">',
  "Target z text.",
  "</S>",
  '<S id="y">',
  "Moved x text.",
  "</S>",
  "",
].join("\n");

/** The origin import every arm's code file opens with, `;`-terminated. */
const ORIGIN_IMPORT = 'import O, { text as t } from "../specs/origin.xspec";';
/** (b)'s existing default binding of the target module. */
const TARGET_DEFAULT_IMPORT = 'import T from "../specs/target.xspec";';
/** The call under test, inside the function `f`. */
const CALL_BEFORE = "t(O.x)";
/** (d)'s type-level spelling of the origin binding (SPEC 4.5). */
const TYPE_ALIAS = "export type N = typeof O.x;";

/** The function `f` holding one `text(...)` call as its return value. */
function functionF(call: string): readonly string[] {
  return ["export function f(): string {", `  return ${call};`, "}"];
}

/** (c)'s second function, calling on the unmoved node `w`. */
const FUNCTION_G = ["export function g(): string {", "  return t(O.w);", "}"];

/** The bindings a rewritten call is rooted at, read off the call. */
interface CallBindings {
  /** The callee — the added `text` binding, or `text` itself. */
  readonly callee: string;
  /** The argument's root — the target module's default binding. */
  readonly root: string;
}

/** The rewritten call in 6.4/6.5's pinned spelling. */
function rewrittenCall(bindings: CallBindings): string {
  return `${bindings.callee}(${bindings.root}.y)`;
}

/** `{ text as Y }`, or `{ text }` where the identifier is `text` (6.5). */
function namedTextBinding(callee: string): string {
  return callee === "text" ? "{ text }" : `{ text as ${callee} }`;
}

/** `import X, { text as Y } from "../specs/target.xspec"` (SPEC 6.5). */
function fullDeclaration(bindings: CallBindings): string {
  return (
    `import ${bindings.root}, ${namedTextBinding(bindings.callee)} from ` +
    `"${TARGET_SPECIFIER}"`
  );
}

/** `import { text as Y } from "../specs/target.xspec"` (SPEC 6.5). */
function textOnlyDeclaration(bindings: CallBindings): string {
  return `import ${namedTextBinding(bindings.callee)} from "${TARGET_SPECIFIER}"`;
}

const EMBEDS_F_TO_Y: GraphEdge = {
  from: `${CODE}#f`,
  to: `${TARGET}#y`,
  kind: "embeds",
};

/** One T6.5-11 arm: `src/c.ts` before the move and its pinned outcome. */
interface CallMoveArm {
  readonly label: string;
  readonly summary: string;
  /** `src/c.ts` before the move. */
  readonly code: string;
  /** Its composed post-move bytes WITHOUT the added import (SPEC 6.5, 3). */
  readonly base: (bindings: CallBindings) => string;
  /** The added declaration's exact characters (SPEC 6.5). */
  readonly declaration: (bindings: CallBindings) => string;
  /** The bindings the file lacks, for diagnoses. */
  readonly lacked: string;
  /** The target module's default binding the file already holds (b). */
  readonly existingRoot?: string;
  /** Identifiers the fresh bindings may not be: bindings the file keeps. */
  readonly forbidden: readonly {
    readonly name: string;
    readonly why: string;
  }[];
  /** Whether the origin declaration is removed with its line, or kept. */
  readonly originImport: "removed" | "kept";
  /** The workspace's complete `embeds` edge set after the move. */
  readonly embeds: readonly GraphEdge[];
  /** The workspace's complete `references` edge set after the move. */
  readonly references: readonly GraphEdge[];
  readonly compile: "clean" | "fails-at-type-alias";
}

const CALL_MOVE_ARMS: readonly CallMoveArm[] = [
  {
    label: "(a)",
    summary:
      "the file imports `O, { text as t }` from the origin module and calls " +
      "`t(O.x)` inside `f`, both bindings losing their last use",
    code: [ORIGIN_IMPORT, "", ...functionF(CALL_BEFORE), ""].join("\n"),
    base: (bindings) =>
      ["", ...functionF(rewrittenCall(bindings)), ""].join("\n"),
    declaration: fullDeclaration,
    lacked: "the target module's default and `text` bindings",
    forbidden: [],
    originImport: "removed",
    embeds: [EMBEDS_F_TO_Y],
    references: [],
    compile: "clean",
  },
  {
    label: "(b)",
    summary:
      'the file already holds `import T from "../specs/target.xspec"` — ' +
      "its default binding used by the marker `T.z` — and lacks its `text`",
    code: [
      ORIGIN_IMPORT,
      TARGET_DEFAULT_IMPORT,
      "",
      "T.z;",
      "",
      ...functionF(CALL_BEFORE),
      "",
    ].join("\n"),
    base: (bindings) =>
      [
        TARGET_DEFAULT_IMPORT,
        "",
        "T.z;",
        "",
        ...functionF(rewrittenCall(bindings)),
        "",
      ].join("\n"),
    declaration: textOnlyDeclaration,
    lacked: "the target module's `text` binding alone",
    existingRoot: "T",
    forbidden: [
      {
        name: "T",
        why: "the identifier the file's existing target-module import binds",
      },
    ],
    originImport: "removed",
    embeds: [EMBEDS_F_TO_Y],
    references: [{ from: CODE, to: `${TARGET}#z`, kind: "references" }],
    compile: "clean",
  },
  {
    label: "(c)",
    summary:
      "a second call `t(O.w)` in `g` on the unmoved node keeps both origin " +
      "bindings in use, so the origin declaration stays",
    code: [
      ORIGIN_IMPORT,
      "",
      ...functionF(CALL_BEFORE),
      "",
      ...FUNCTION_G,
      "",
    ].join("\n"),
    base: (bindings) =>
      [
        ORIGIN_IMPORT,
        "",
        ...functionF(rewrittenCall(bindings)),
        "",
        ...FUNCTION_G,
        "",
      ].join("\n"),
    declaration: fullDeclaration,
    lacked: "the target module's default and `text` bindings",
    forbidden: [
      {
        name: "O",
        why: "the default binding of the file's retained origin import",
      },
      {
        name: "t",
        why: "the `text` binding of the file's retained origin import",
      },
    ],
    originImport: "kept",
    embeds: [
      EMBEDS_F_TO_Y,
      { from: `${CODE}#g`, to: `${ORIGIN}#w`, kind: "embeds" },
    ],
    references: [],
    compile: "clean",
  },
  {
    label: "(d)",
    summary:
      "the file's only value-level use of `O` is the moved call while " +
      "`type N = typeof O.x` remains — a type-level spelling keeps no import",
    code: [
      ORIGIN_IMPORT,
      "",
      TYPE_ALIAS,
      "",
      ...functionF(CALL_BEFORE),
      "",
    ].join("\n"),
    base: (bindings) =>
      ["", TYPE_ALIAS, "", ...functionF(rewrittenCall(bindings)), ""].join(
        "\n",
      ),
    declaration: fullDeclaration,
    lacked: "the target module's default and `text` bindings",
    forbidden: [],
    originImport: "removed",
    embeds: [EMBEDS_F_TO_Y],
    references: [],
    compile: "fails-at-type-alias",
  },
];

function utf8Length(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/** Stage a fresh workspace (config plus `files`), run `body`, dispose (H-1). */
async function withWorkspace<T>(
  files: Readonly<Record<string, InitialFileContents>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": CONFIG, ...files },
  });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

function armFiles(
  arm: CallMoveArm,
): Readonly<Record<string, InitialFileContents>> {
  return { [ORIGIN]: ORIGIN_BEFORE, [TARGET]: TARGET_BEFORE, [CODE]: arm.code };
}

/**
 * Read the code file as UTF-8 text, failing diagnosed (H-8) when the path
 * does not hold a plain file.
 */
async function readCodeText(
  workspace: TestWorkspace,
  context: string,
): Promise<string> {
  const kind = await workspace.kind(CODE);
  if (kind !== "file") {
    fail(`${context}: expected a plain file at ${CODE}; found ${kind}`);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(
    await workspace.readBytes(CODE),
  );
}

// The rewritten call in 6.4/6.5's pinned spelling: an identifier callee, an
// identifier root, dot access for the identifier-valid `y`, the argument
// alone. `t(O.w)` (c) and `typeof O.x` (d) never match.
const REWRITTEN_CALL =
  /([A-Za-z_$][A-Za-z0-9_$]*)\(([A-Za-z_$][A-Za-z0-9_$]*)\.y\)/g;

/**
 * The bindings the rewritten call is rooted at — the value-unpinned fresh
 * identifiers (SPEC 6.5), read off the one place the pinned spelling makes
 * them observable; diagnosed when the call is not rewritten as pinned, is
 * rooted at anything but the existing default binding where the file holds
 * one, or binds an identifier the file keeps.
 */
function readRewrittenCall(
  text: string,
  arm: CallMoveArm,
  context: string,
): CallBindings {
  const matches = [...text.matchAll(REWRITTEN_CALL)];
  const match = matches.length === 1 ? matches[0] : undefined;
  const callee = match?.[1];
  const root = match?.[2];
  if (callee === undefined || root === undefined) {
    fail(
      `${context}: ${CODE} must hold exactly one rewritten call ` +
        `\`<callee>(<root>.y)\` — the moved call's occurrence span, callee ` +
        `through closing parenthesis, replaced by a call whose callee is ` +
        `the target module's \`text\` binding and whose argument is its ` +
        `default binding's \`y\` (SPEC 6.5, 5.7, 6.4); found ` +
        `${String(matches.length)} in ${JSON.stringify(text)}`,
    );
  }
  if (arm.existingRoot !== undefined && root !== arm.existingRoot) {
    fail(
      `${context}: the rewritten call's argument must be rooted at the ` +
        `existing default binding \`${arm.existingRoot}\` the file already ` +
        `holds of the target module — an import is added only where the ` +
        `file lacks the binding, binding exactly the lacked ones, so no ` +
        `second default binding (SPEC 6.5); the call reads ` +
        `${JSON.stringify(rewrittenCall({ callee, root }))}`,
    );
  }
  for (const kept of arm.forbidden) {
    for (const [role, name] of [
      ["callee", callee],
      ["argument root", root],
    ] as const) {
      if (name === kept.name && name !== arm.existingRoot) {
        fail(
          `${context}: the rewritten call's ${role} is \`${name}\`, ` +
            `${kept.why} — an added import binds fresh identifiers ` +
            `colliding with no binding already in the file (SPEC 6.5, ` +
            `2.1, 4)`,
        );
      }
    }
  }
  return { callee, root };
}

/** The real move's observations (a)'s preview parity needs. */
interface RealMoveOutcome {
  readonly bindings: CallBindings;
  /** Every composed-coordinates offset at which the added run reads. */
  readonly offsets: readonly number[];
}

/**
 * Stage one arm, run the section-form move, and assert the code file is its
 * composed post-move bytes with exactly the declaration the lacked bindings
 * require added under 6.5's line discipline at a line-start offset, the
 * origin and target files as composed, `check` and `build` clean, the edge
 * sets exact, and the standard-tooling compile as pinned.
 */
async function runCallMoveArm(
  product: ProductBinding,
  arm: CallMoveArm,
): Promise<RealMoveOutcome> {
  const context = `T6.5-11 ${arm.label}`;
  return await withWorkspace(armFiles(arm), async (workspace) => {
    // Premise: the staging is valid and the code file compiles clean under
    // standard tooling, so a later failure is the move's, not the staging's.
    await buildOk(
      product,
      workspace,
      `${context} \`build\` over the staging (${arm.summary})`,
    );
    assertNoCompileErrors(
      await ConsumerProject.load({
        rootDir: workspace.root,
        rootFiles: [CODE],
      }),
      `${context} premise: ${CODE} compiles clean before the move under ` +
        `standard tooling — the origin import resolves against the ` +
        `generated module and the call's argument is a node (SPEC 4, 13.1; ` +
        `a fixture self-check)`,
    );
    await expectExit(
      product,
      workspace,
      [...MOVE_ARGV],
      0,
      `${context} \`${MOVE_LABEL}\` — a valid move over the workspace the ` +
        `premise \`build\` accepted succeeds: the call whose target the ` +
        `section form carries into the target file is rooted, callee and ` +
        `argument, at bindings of the target module and rewritten whole, ` +
        `never becoming the cross-module call of 14.11 — a refusal naming ` +
        `a cross-module call at this step is the product rooting the callee ` +
        `at the origin's \`text\` binding (SPEC 6.5, 4.3, 4.4)`,
    );

    const text = await readCodeText(workspace, context);
    const bindings = readRewrittenCall(text, arm, context);
    const declaration = arm.declaration(bindings);
    const readings = assertExactDeclarationInsertion(
      {
        rel: CODE,
        base: Buffer.from(arm.base(bindings), "utf8"),
        actual: await workspace.readBytes(CODE),
        declaration,
      },
      `${context}: ${CODE} after the move is its composed post-move bytes — ` +
        `the call's occurrence span replaced by ` +
        `${JSON.stringify(rewrittenCall(bindings))}, the origin declaration ` +
        (arm.originImport === "removed"
          ? "removed with its line (both its bindings lost their last use)"
          : "kept byte-for-byte (its bindings are still used)") +
        `, every other byte unchanged — with exactly one declaration added, ` +
        `binding ${arm.lacked}: ${JSON.stringify(declaration)} followed by ` +
        `U+000A (SPEC 6.5, 2.1, 5.7, 3)`,
    );
    if (!readings.some((reading) => reading.atLineStart)) {
      fail(
        `${context}: ${CODE} — the added declaration was inserted at a ` +
          `mid-line offset (U+000A, the declaration, U+000A; read at ` +
          `composed offset(s) ` +
          `${readings.map((reading) => String(reading.offset)).join(", ")}) ` +
          `while the file holds line-start admissible offsets — its start, ` +
          `every later line's start, its end after the final terminator — ` +
          `and an admissible offset at the start of a line is taken over ` +
          `any other (SPEC 6.5)`,
      );
    }
    await assertFileBytes(
      workspace.path(ORIGIN),
      ORIGIN_AFTER,
      `${context}: ${ORIGIN} after the move — the moved section deleted in ` +
        `place with its emptied merged line dropped, the blank line kept, ` +
        `no import gained (SPEC 6.5, 3; H-4, normalizing nothing)`,
    );
    await assertFileBytes(
      workspace.path(TARGET),
      TARGET_AFTER,
      `${context}: ${TARGET} after the move — the re-identified moved text ` +
        `appended at the end of the file plus U+000A, otherwise ` +
        `byte-identical (SPEC 6.5, 3; H-4, normalizing nothing)`,
    );

    await expectFindingFreeReport(
      product,
      workspace,
      ["check", "--json"],
      `${context} \`check --json\` after the move — clean: no 14.11 (the ` +
        `call is rooted at the target module's bindings), no 14.7 (the ` +
        `rewritten call and every kept spelling resolve), no staleness ` +
        `after the finishing regeneration (SPEC 6.5, 6.4, 12.2)`,
    );
    await expectFindingFreeReport(
      product,
      workspace,
      ["build", "--json"],
      `${context} \`build --json\` after the move — clean: no 14.11, no ` +
        `14.7, the fresh bindings colliding with nothing (SPEC 6.5, 14.15)`,
    );
    for (const kind of ["embeds", "references"] as const) {
      const label = `${context} \`query edges --kinds ${kind}\``;
      const edges = decodeEdgesReport(
        await runJson(
          product,
          workspace,
          ["query", "edges", "--kinds", kind],
          label,
        ),
        label,
      );
      assertEdgeSetEqual(
        edges,
        kind === "embeds" ? arm.embeds : arm.references,
        `${label}: the complete \`${kind}\` edge set after the move — ` +
          (kind === "embeds"
            ? `the rewritten call's edge from ${CODE}#f to the moved node's ` +
              `new identity ${TARGET}#y, and no other call's changed`
            : `a marker's edge alone; the calls and a type-level spelling ` +
              `record none`) +
          ` (SPEC 6.5, 4.3, 4.5, 4.6, 5.2)`,
      );
    }

    // The language service snapshots files on first access, and the move
    // rewrote them: a fresh project.
    const project = await ConsumerProject.load({
      rootDir: workspace.root,
      rootFiles: [CODE],
    });
    if (arm.compile === "clean") {
      assertNoCompileErrors(
        project,
        `${context}: ${CODE} after the move compiles clean under standard ` +
          `tooling — the added declaration binds fresh identifiers, the ` +
          `rewritten call's callee is the target module's \`text\` and its ` +
          `argument a node of that module, and the regenerated modules ` +
          `resolve (SPEC 6.5, 4.3, 4.5)`,
      );
    } else {
      assertTypeAliasCompileFailure(project, context);
    }
    return { bindings, offsets: readings.map((reading) => reading.offset) };
  });
}

/**
 * (d): the removal leaves `type N = typeof O.x` naming the vanished binding
 * — a consumer type error outside xspec's validations (SPEC 6.5, 4.5, 6.4)
 * — so the standard-tooling compile fails with an error located within the
 * type alias statement's characters.
 */
function assertTypeAliasCompileFailure(
  project: ConsumerProject,
  context: string,
): void {
  const errors = project.errors();
  const alias = project.locate(CODE, TYPE_ALIAS);
  const within = errors.filter(
    (diagnostic) =>
      diagnostic.file === alias.file &&
      diagnostic.start !== undefined &&
      diagnostic.start.offset >= alias.offset &&
      diagnostic.start.offset < alias.offset + TYPE_ALIAS.length,
  );
  if (within.length === 0) {
    fail(
      `${context}: ${CODE} after the move must fail the standard-tooling ` +
        `compile at ${JSON.stringify(TYPE_ALIAS)} — the origin import, its ` +
        `bindings' only occurrence moved, is removed while the type-level ` +
        `spelling keeps no import and now names a vanished binding, a ` +
        `consumer type error outside xspec's validations (SPEC 6.5, 4.5, ` +
        `6.4); ` +
        (errors.length === 0
          ? "the file compiled clean"
          : `the ${String(errors.length)} error(s) lie elsewhere: ` +
            errors.map((diagnostic) => diagnostic.message).join("; ")),
    );
  }
}

/** The 12.7 edit order: range start, then range end, then class-name bytes. */
function compareEdits(a: PreviewEdit, b: PreviewEdit): number {
  if (a.range.start !== b.range.start) return a.range.start - b.range.start;
  if (a.range.end !== b.range.end) return a.range.end - b.range.end;
  return Buffer.compare(
    Buffer.from(a.class, "utf8"),
    Buffer.from(b.class, "utf8"),
  );
}

function projectEdits(edits: readonly PreviewEdit[]): readonly PreviewEdit[] {
  return edits.map((edit) => ({
    class: edit.class,
    range: { start: edit.range.start, end: edit.range.end },
  }));
}

function renderEdits(edits: readonly PreviewEdit[]): string {
  return edits
    .map(
      (edit) =>
        `${edit.class} [${String(edit.range.start)}, ${String(edit.range.end)})`,
    )
    .join(", ");
}

interface ByteRange {
  readonly start: number;
  readonly end: number;
}

/**
 * The composed-coordinates position of a pre-operation addition offset
 * under 6.5's composition: the removal's range collapses to one position
 * (its start and its end both compose to it, T6.6-4 (b)), the rewrite's
 * range to its replacement; an offset strictly inside either is
 * inadmissible (`null`).
 */
function composedOffset(
  offset: number,
  removal: ByteRange,
  rewrite: ByteRange,
  rewrittenLength: number,
): number | null {
  if (offset > removal.start && offset < removal.end) return null;
  if (offset > rewrite.start && offset < rewrite.end) return null;
  let composed = offset;
  if (offset >= removal.end) composed -= removal.end - removal.start;
  if (offset >= rewrite.end)
    composed += rewrittenLength - (rewrite.end - rewrite.start);
  return composed;
}

/**
 * (a)'s preview parity (SPEC 6.6, 12.7): on a second, identically staged
 * workspace, the preview's entry for the code file holds exactly the
 * `import-removal` spanning the origin declaration with its adjunct drop,
 * the `reference-rewrite` spanning the call's occurrence, and one
 * zero-length `import-addition` whose offset, composed, is where the real
 * move inserted the declaration.
 */
async function runPreviewParityArm(
  product: ProductBinding,
  arm: CallMoveArm,
  real: RealMoveOutcome,
): Promise<void> {
  const context = `T6.5-11 ${arm.label} preview parity`;
  await withWorkspace(armFiles(arm), async (workspace) => {
    await buildOk(product, workspace, `${context} \`build\` over the staging`);
    const label = `${context} \`${MOVE_LABEL} --preview --json\``;
    const preview = decodePreviewReport(
      await runJson(
        product,
        workspace,
        [...MOVE_ARGV, "--preview", "--json"],
        label,
      ),
      label,
    );
    assertSameJson(
      preview.findings,
      [],
      `${label}: the preview of a valid move completes with findings [] ` +
        `(SPEC 6.6)`,
    );
    if (preview.files === null) {
      fail(
        `${label}: the completed preview reports its plan — \`files\` ` +
          `non-null (SPEC 6.6, 12.7)`,
      );
    }
    const entries = preview.files.filter((entry) => entry.file === CODE);
    const entry: PreviewFileEntry | undefined =
      entries.length === 1 ? entries[0] : undefined;
    if (entry === undefined) {
      fail(
        `${label}: \`files\` must hold exactly one entry for ${CODE}, the ` +
          `code file the move rewrites (SPEC 6.6, 12.7); got ` +
          `[${preview.files.map((file) => renderPathValue(file.file)).join(", ")}]`,
      );
    }
    const removal: ByteRange = { start: 0, end: utf8Length(ORIGIN_IMPORT) + 1 };
    const callStart = utf8Length(
      arm.code.slice(0, arm.code.indexOf(CALL_BEFORE)),
    );
    const rewrite: ByteRange = {
      start: callStart,
      end: callStart + utf8Length(CALL_BEFORE),
    };
    const additions = entry.edits.filter(
      (edit) => edit.class === "import-addition",
    );
    const addition = additions.length === 1 ? additions[0] : undefined;
    if (addition === undefined) {
      fail(
        `${label}: ${CODE} — exactly one \`import-addition\`, the one ` +
          `declaration the rewrite adds there (SPEC 6.5, 6.6); the entry ` +
          `reports ${renderEdits(entry.edits)}`,
      );
    }
    if (addition.range.start !== addition.range.end) {
      fail(
        `${label}: ${CODE} — the \`import-addition\` is a zero-length range ` +
          `at the insertion offset (SPEC 6.6, 12.7); got ` +
          `[${String(addition.range.start)}, ${String(addition.range.end)})`,
      );
    }
    const offset = addition.range.start;
    const expected: PreviewEdit[] = [
      { class: "import-removal", range: removal },
      { class: "reference-rewrite", range: rewrite },
      { class: "import-addition", range: { start: offset, end: offset } },
    ];
    expected.sort(compareEdits);
    assertSameJson(
      projectEdits(entry.edits),
      projectEdits(expected),
      `${label}: ${CODE} — exactly the three edits the move makes there, ` +
        `class-plus-range in the 12.7 order: the \`import-removal\` ` +
        `spanning the origin declaration with its adjunct drop ` +
        `[0, ${String(removal.end)}) — its own characters and the ` +
        `terminator of the line its deletion leaves empty — the ` +
        `\`reference-rewrite\` spanning the call's occurrence, callee ` +
        `through closing parenthesis [${String(rewrite.start)}, ` +
        `${String(rewrite.end)}), and the zero-length \`import-addition\` ` +
        `at the insertion offset (SPEC 6.6, 6.5, 5.7, 3, 12.7)`,
    );
    const composed = composedOffset(
      offset,
      removal,
      rewrite,
      utf8Length(rewrittenCall(real.bindings)),
    );
    if (composed === null) {
      fail(
        `${label}: the \`import-addition\` offset ${String(offset)} lies ` +
          `strictly inside another edit's range — the removal ` +
          `[0, ${String(removal.end)}) or the rewrite ` +
          `[${String(rewrite.start)}, ${String(rewrite.end)}) — where an ` +
          `addition's offset never lies (SPEC 6.5, 6.6)`,
      );
    }
    if (!real.offsets.includes(composed)) {
      fail(
        `${label}: the \`import-addition\` offset ${String(offset)} ` +
          `(composed position ${String(composed)}) is not where the real ` +
          `operation inserted the declaration — the offset the preview ` +
          `reports is exactly the one the operation uses (SPEC 6.5, 6.6); ` +
          `the real move's inserted run reads at composed offset(s) ` +
          `${real.offsets.map(String).join(", ")}`,
      );
    }
  });
}

const T6_5_11 = defineProductTest({
  id: "T6.5-11",
  title:
    "TypeScript `text(...)` calls across the move: a call whose target the section form carries into another file is rewritten whole — callee through the target module's `text` binding, argument through its default binding — over its occurrence's span, never becoming the cross-module call of 14.11, and imports are added binding exactly the lacked bindings and removed exactly when an occurrence used a binding of theirs before and none after; over `specs/origin.mdx#x` → `specs/target.mdx#y` and `src/c.ts`: (a) `import O, { text as t }` with `t(O.x)` inside `f` — after the move the file compiles clean under standard tooling, `build` and `check` are clean, `query edges` reports the one `embeds` edge from `src/c.ts#f` to `specs/target.mdx#y`, and the bytes are the composed post-move file with the single added run exactly `import <X>, { text as <Y> } from \"../specs/target.xspec\"` (or `{ text }` where the fresh identifier is `text` itself) followed by U+000A at a line-start offset, the call's span replaced by `<Y>(<X>.y)`, the origin declaration removed with its line, no other byte changed; (b) the file already holding `import T from \"../specs/target.xspec\"` (used by the marker `T.z`) gains exactly `import { text as <Y> } from …` (or `{ text }`), the argument rewritten through the existing `T`, the origin import removed; (c) a second call `t(O.w)` on an unmoved node keeps the origin declaration byte-for-byte, the moved call alone rewritten; (d) `type N = typeof O.x` keeps no import — the origin import is removed, `build` and `check` are clean, and the standard-tooling compile fails at the alias; and (a)'s `--preview` reports for `src/c.ts` one `reference-rewrite` over the call's span, one `import-addition` at the offset the real operation then uses, and one `import-removal` spanning the origin declaration with its adjunct drop (SPEC 6.5, 4.3, 4.5, 4.6, 5.7, 6.6, 12.7)",
  run: async (product) => {
    const armA = CALL_MOVE_ARMS[0]!;
    const real = await runCallMoveArm(product, armA);
    await runPreviewParityArm(product, armA, real);
    for (const arm of CALL_MOVE_ARMS.slice(1)) {
      await runCallMoveArm(product, arm);
    }
  },
});

/** TEST-SPEC §6.5, second half (SUITE-25 continued): T6.5-11. */
export const section65iiTests: readonly ProductTestEntry[] = [T6_5_11];
