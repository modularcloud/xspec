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
//   They are read off the rewritten call — the one place 6.4/6.5's pinned
//   spelling makes them observable: exactly one `<callee>(<root>.y)` in the
//   file, `<callee>` the added `text` binding (or `text`), or (e)'s held
//   `tt`, and `<root>` the target module's default binding, added or (b)'s
//   held `T` — the added declaration is then composed byte-exactly with
//   those identifiers substituted, the file's post-move bytes WITHOUT it
//   composed from the rules of 6.5 and 3 (the origin declaration's line
//   removed where both its bindings lose their last use, the call's
//   occurrence span replaced by the rewritten call — "the call's span as a
//   second isolated run"), and the single inserted run isolated by diff
//   (`assertExactDeclarationInsertion`) must read as exactly that
//   declaration followed by U+000A: in (a), (b), (e), and (f) at the one
//   composed position where the origin declaration's line stood, directly
//   after the heading import's line — the file's one line-start admissible
//   offset (the removal's start and end, each following a statement's end
//   and timely, compose to it; every later line start lies inside `f` or is
//   untimely, a statement standing between it and `O`'s declaration) — and
//   in (c) and (d), which TEST-SPEC places nowhere, at some offset lying at
//   the start of a line. Where the file keeps a binding (the retained
//   origin import of (c), `K` of (a) and (f), the existing `T` of (b), `tt`
//   of (e) and (f)) the fresh identifiers may not be it — asserted directly
//   (a collision is also TS2300 under the compile), never narrowing 6.5's
//   latitude — and a held binding roots the call exactly where 6.5 roots it
//   there: `T` the argument in (b), timely, its declaration preceding
//   `O`'s; `tt` the callee in (e), timely, its declaration preceding `t`'s;
//   `tt` never the callee in (f), untimely, `f` standing between `t`'s
//   declaration and its own (T6.5-23(k)'s mirror).
// - "`build` and `check` are clean (no 14.11, no 14.7)" is each command's
//   `--json` report decoded as exactly `{"findings": []}` at exit 0.
// - (a)'s, (e)'s, and (f)'s preview parity runs on a second, identically
//   staged workspace after the arm's real move — the real move first, so
//   the headline observation (the move succeeding, the call never becoming
//   the cross-module call of 14.11) is the first diagnosis. Byte
//   determinism (6.1, 6.5) makes the two workspaces comparable: the
//   `import-addition`'s pre-operation offset must be the origin
//   declaration's removal's start or its end (TEST-SPEC T6.5-11: one
//   composed position, the choice 6.5's latitude, T6.6-4 (b)), and, mapped
//   to composed coordinates (6.5's composition — an offset strictly inside
//   the removal's or the rewrite's range is diagnosed; the removal's start
//   and end compose to one position), must be one of the offsets at which
//   the real move's inserted run reads as the disciplined declaration.
// - (b), (c), and (d) pin no preview (TEST-SPEC pins (a)'s, (e)'s, and
//   (f)'s), and no arm pins the origin's and target's plan entries
//   (T6.6-4's business); the origin, target, and third-module files'
//   post-move bytes are asserted whole as soundness guards, composed from
//   6.5 and 3 with no latitude, as T6.5-8's arms compose them.
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
import { type StagedTs, stagedTs } from "../../helpers/staged-ts.js";
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
// discovered code source, so its call records an occurrence and its edge. A
// staged-source record: T6.5-11 stages it in workspaces created after a
// product invocation — the preview-parity twins of (a), (e), and (f), and
// arms (b)–(f) (S-9's timing clause; test/self/s9-staged-sources.test.ts).
const CONFIG = stagedTs(
  "T6.5-11 xspec.config.ts — one spec group and one code group",
  `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts"]
  }
})
`,
);

const ORIGIN = "specs/origin.mdx";
const TARGET = "specs/target.mdx";
/** (a)'s and (f)'s retained third module, whose node `a` `f`'s marker names. */
const THIRD = "specs/k.mdx";
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

// The retained third module of (a) and (f): `K`'s import heads their code
// file so that the origin declaration's removal starts after a statement's
// end (TEST-SPEC T6.5-11), and `f`'s marker `K.a` keeps it. The move never
// touches it. A ledger record, as the origin and target are.
const THIRD_TEXT = ['<S id="a">', "Third-module a text.", "</S>", ""].join(
  "\n",
);
const THIRD_BEFORE = stagedMdx("T6.5-11 specs/k.mdx", THIRD_TEXT);

// The import declarations the arms' code files hold, spelled as TEST-SPEC
// T6.5-11 gives them: single spaces, no statement terminator.
/** The origin import every arm's code file holds. */
const ORIGIN_IMPORT = 'import O, { text as t } from "../specs/origin.xspec"';
/** (a)'s and (f)'s third-module import, heading the file. */
const THIRD_IMPORT = 'import K from "../specs/k.xspec"';
/** (b)'s existing default binding of the target module, heading the file. */
const TARGET_DEFAULT_IMPORT = 'import T from "../specs/target.xspec"';
/** (e)'s and (f)'s existing `text` binding of the target module. */
const TARGET_TEXT_IMPORT = 'import { text as tt } from "../specs/target.xspec"';
/** The call under test, inside the function `f`. */
const CALL_BEFORE = "t(O.x)";
/** (a)'s and (f)'s marker inside `f`, on the third module's node `a`. */
const THIRD_MARKER = "K.a";
/** (d)'s type-level spelling of the origin binding (SPEC 4.5). */
const TYPE_ALIAS = "export type N = typeof O.x;";

/**
 * The function `f` holding one `text(...)` call as its return value, after
 * an optional marker statement ((a)'s and (f)'s `K.a`).
 */
function functionF(call: string, marker?: string): readonly string[] {
  return [
    "export function f(): string {",
    ...(marker === undefined ? [] : [`  ${marker};`]),
    `  return ${call};`,
    "}",
  ];
}

/** (c)'s second function, calling on the unmoved node `w`. */
const FUNCTION_G = ["export function g(): string {", "  return t(O.w);", "}"];

/** The bindings a rewritten call is rooted at, read off the call. */
interface CallBindings {
  /**
   * The callee — the target module's `text` binding: the added one (or
   * `text` itself), or (e)'s held `tt`.
   */
  readonly callee: string;
  /**
   * The argument's root — the target module's default binding: the added
   * one, or (b)'s held `T`.
   */
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

/** `import X from "../specs/target.xspec"` (SPEC 6.5; (e)). */
function defaultOnlyDeclaration(bindings: CallBindings): string {
  return `import ${bindings.root} from "${TARGET_SPECIFIER}"`;
}

/**
 * The offset of the start of line 2 of a file whose line 1 is `firstLine`
 * terminated by U+000A — in the composed text of (a), (b), (e), and (f),
 * where the origin declaration's line stood.
 */
function lineTwoOffset(firstLine: string): number {
  return utf8Length(firstLine) + 1;
}

const EMBEDS_F_TO_Y: GraphEdge = {
  from: `${CODE}#f`,
  to: `${TARGET}#y`,
  kind: "embeds",
};

/** (a)'s and (f)'s marker edge: `K.a` inside `f`, untouched by the move. */
const REFERENCES_F_TO_A: GraphEdge = {
  from: `${CODE}#f`,
  to: `${THIRD}#a`,
  kind: "references",
};

/** One T6.5-11 arm: `src/c.ts` before the move and its pinned outcome. */
interface CallMoveArm {
  readonly label: string;
  readonly summary: string;
  /**
   * `src/c.ts` before the move — a staged-source record
   * (helpers/staged-ts.ts): every workspace but (a)'s first is created after
   * a product invocation (S-9's timing clause), and the table is converted
   * uniformly. `codeText` reads it back as text.
   */
  readonly code: StagedTs;
  /** Its composed post-move bytes WITHOUT the added import (SPEC 6.5, 3). */
  readonly base: (bindings: CallBindings) => string;
  /** The added declaration's exact characters (SPEC 6.5). */
  readonly declaration: (bindings: CallBindings) => string;
  /** The bindings the file lacks, for diagnoses. */
  readonly lacked: string;
  /**
   * The target module's default binding the file already holds, which
   * roots the argument (b).
   */
  readonly existingRoot?: string;
  /**
   * The target module's `text` binding the file already holds, value-level,
   * unshadowed, and timely, which roots the callee (e).
   */
  readonly existingCallee?: string;
  /**
   * A target-module `text` binding the file holds that is untimely for the
   * callee, which therefore never roots it (f), with why.
   */
  readonly untimelyCallee?: { readonly name: string; readonly why: string };
  /** Identifiers the fresh bindings may not be: bindings the file keeps. */
  readonly forbidden: readonly {
    readonly name: string;
    readonly why: string;
  }[];
  /**
   * The insertion offset into `base` TEST-SPEC pins — where the origin
   * declaration's line stood, the file's one line-start admissible offset —
   * with how the diagnosis names it; absent, any offset lying at the start
   * of a line is accepted ((c), (d)).
   */
  readonly placement?: { readonly offset: number; readonly where: string };
  /** Whether the origin declaration is removed with its line, or kept. */
  readonly originImport: "removed" | "kept";
  /** Whether the third module `specs/k.mdx` is staged ((a), (f)). */
  readonly third: boolean;
  /** Whether TEST-SPEC pins the arm's preview parity ((a), (e), (f)). */
  readonly preview: boolean;
  /** The workspace's complete `embeds` edge set after the move. */
  readonly embeds: readonly GraphEdge[];
  /** The workspace's complete `references` edge set after the move. */
  readonly references: readonly GraphEdge[];
  readonly compile: "clean" | "fails-at-type-alias";
}

/** (a)'s and (f)'s pinned placement, directly after `K`'s line. */
const AFTER_THIRD_IMPORT = {
  offset: lineTwoOffset(THIRD_IMPORT),
  where:
    "the start of line 2 of the composed text, where the origin " +
    "declaration's line stood, directly after `K`'s line — the one " +
    "composed position the removal's start and end make, each following " +
    "a statement's end and timely; every later line start lies inside " +
    "the statement `f` (no top-level position) or past it, untimely, `f` " +
    "standing between it and `O`'s declaration (SPEC 6.5; T6.5-23(n))",
} as const;

const CALL_MOVE_ARMS: readonly CallMoveArm[] = [
  {
    label: "(a)",
    summary:
      "`K`'s import heads the file, then `import O, { text as t }` from the " +
      "origin module; `f` holds the marker `K.a` and calls `t(O.x)`, both " +
      "origin bindings losing their last use",
    code: stagedTs(
      "T6.5-11 (a) src/c.ts",
      [
        THIRD_IMPORT,
        ORIGIN_IMPORT,
        ...functionF(CALL_BEFORE, THIRD_MARKER),
        "",
      ].join("\n"),
    ),
    base: (bindings) =>
      [
        THIRD_IMPORT,
        ...functionF(rewrittenCall(bindings), THIRD_MARKER),
        "",
      ].join("\n"),
    declaration: fullDeclaration,
    lacked: "the target module's default and `text` bindings",
    forbidden: [
      {
        name: "K",
        why: "the default binding of the retained third-module import",
      },
    ],
    placement: AFTER_THIRD_IMPORT,
    originImport: "removed",
    third: true,
    preview: true,
    embeds: [EMBEDS_F_TO_Y],
    references: [REFERENCES_F_TO_A],
    compile: "clean",
  },
  {
    label: "(b)",
    summary:
      'the file already holds `import T from "../specs/target.xspec"` — ' +
      "heading it, before the origin import, its default binding used by " +
      "the marker `T.z` — and lacks its `text`",
    code: stagedTs(
      "T6.5-11 (b) src/c.ts",
      [
        TARGET_DEFAULT_IMPORT,
        ORIGIN_IMPORT,
        "T.z;",
        ...functionF(CALL_BEFORE),
        "",
      ].join("\n"),
    ),
    base: (bindings) =>
      [
        TARGET_DEFAULT_IMPORT,
        "T.z;",
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
    placement: {
      offset: lineTwoOffset(TARGET_DEFAULT_IMPORT),
      where:
        "the start of line 2 of the composed text, where the origin " +
        "declaration's line stood, directly after `T`'s line, as in (a) — " +
        "the one composed position the removal's start and end make, each " +
        "following a statement's end and timely; every later line start is " +
        "untimely, the marker statement `T.z;` standing between it and " +
        "`O`'s declaration (SPEC 6.5)",
    },
    originImport: "removed",
    third: false,
    preview: false,
    embeds: [EMBEDS_F_TO_Y],
    references: [{ from: CODE, to: `${TARGET}#z`, kind: "references" }],
    compile: "clean",
  },
  {
    label: "(c)",
    summary:
      "a second call `t(O.w)` in `g` on the unmoved node keeps both origin " +
      "bindings in use, so the origin declaration stays",
    code: stagedTs(
      "T6.5-11 (c) src/c.ts",
      [
        ORIGIN_IMPORT,
        "",
        ...functionF(CALL_BEFORE),
        "",
        ...FUNCTION_G,
        "",
      ].join("\n"),
    ),
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
    third: false,
    preview: false,
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
    code: stagedTs(
      "T6.5-11 (d) src/c.ts",
      [ORIGIN_IMPORT, "", TYPE_ALIAS, "", ...functionF(CALL_BEFORE), ""].join(
        "\n",
      ),
    ),
    base: (bindings) =>
      ["", TYPE_ALIAS, "", ...functionF(rewrittenCall(bindings)), ""].join(
        "\n",
      ),
    declaration: fullDeclaration,
    lacked: "the target module's default and `text` bindings",
    forbidden: [],
    originImport: "removed",
    third: false,
    preview: false,
    embeds: [EMBEDS_F_TO_Y],
    references: [],
    compile: "fails-at-type-alias",
  },
  {
    label: "(e)",
    summary:
      "the file holds the target module's `text` binding — `import { text " +
      "as tt }` heading it, unused before the move — and lacks its default; " +
      "`f` calls `t(O.x)`, the only use of `O` and of `t`",
    code: stagedTs(
      "T6.5-11 (e) src/c.ts",
      [TARGET_TEXT_IMPORT, ORIGIN_IMPORT, ...functionF(CALL_BEFORE), ""].join(
        "\n",
      ),
    ),
    base: (bindings) =>
      [TARGET_TEXT_IMPORT, ...functionF(rewrittenCall(bindings)), ""].join(
        "\n",
      ),
    declaration: defaultOnlyDeclaration,
    lacked: "the target module's default binding alone",
    existingCallee: "tt",
    forbidden: [
      {
        name: "tt",
        why: "the `text` binding the file's existing target-module import binds",
      },
    ],
    placement: {
      offset: lineTwoOffset(TARGET_TEXT_IMPORT),
      where:
        "the start of line 2 of the composed text, where the origin " +
        "declaration's line stood, directly after `tt`'s line, as in (a) — " +
        "the one composed position the removal's start and end make, each " +
        "following a statement's end and timely; every later line start " +
        "lies inside the statement `f` or past it, untimely (SPEC 6.5)",
    },
    originImport: "removed",
    third: false,
    preview: true,
    embeds: [EMBEDS_F_TO_Y],
    references: [],
    compile: "clean",
  },
  {
    label: "(f)",
    summary:
      "(a)'s file with `import { text as tt }` from the target module " +
      "appended after `f` — `tt` untimely for the callee, `f` standing " +
      "between `t`'s declaration and its own",
    code: stagedTs(
      "T6.5-11 (f) src/c.ts",
      [
        THIRD_IMPORT,
        ORIGIN_IMPORT,
        ...functionF(CALL_BEFORE, THIRD_MARKER),
        TARGET_TEXT_IMPORT,
        "",
      ].join("\n"),
    ),
    base: (bindings) =>
      [
        THIRD_IMPORT,
        ...functionF(rewrittenCall(bindings), THIRD_MARKER),
        TARGET_TEXT_IMPORT,
        "",
      ].join("\n"),
    declaration: fullDeclaration,
    lacked:
      "the target module's default and `text` bindings — its held `tt` " +
      "untimely for the callee",
    untimelyCallee: {
      name: "tt",
      why:
        "the target module's `text` binding the file holds, untimely for " +
        "the callee: its declaration follows `t`'s with the statement `f` " +
        "between them, and a binding declared after the replaced one is " +
        "timely only with no top-level statement but import declarations " +
        "between the two",
    },
    forbidden: [
      {
        name: "K",
        why: "the default binding of the retained third-module import",
      },
      {
        name: "tt",
        why: "the `text` binding the file's existing target-module import binds",
      },
    ],
    placement: AFTER_THIRD_IMPORT,
    originImport: "removed",
    third: true,
    preview: true,
    embeds: [EMBEDS_F_TO_Y],
    references: [REFERENCES_F_TO_A],
    compile: "clean",
  },
];

function utf8Length(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/**
 * An arm's staged `src/c.ts` as text: the string its record was made from.
 * Every code file this module stages is a string; anything else is a defect
 * of the arm table.
 */
function codeText(arm: CallMoveArm): string {
  const text = arm.code.source;
  if (typeof text !== "string") {
    throw new Error(
      `T6.5-11 ${arm.label}: the staged ${CODE} must be a string (the arm ` +
        "table composes text, never bytes)",
    );
  }
  return text;
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
  return {
    [ORIGIN]: ORIGIN_BEFORE,
    [TARGET]: TARGET_BEFORE,
    ...(arm.third ? { [THIRD]: THIRD_BEFORE } : {}),
    [CODE]: arm.code,
  };
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
 * rooted at anything but the existing default or `text` binding where the
 * file holds a timely one, has its callee rooted at a held `text` binding
 * untimely for it, or binds an identifier the file keeps.
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
  if (arm.existingCallee !== undefined && callee !== arm.existingCallee) {
    fail(
      `${context}: the rewritten call's callee must be re-rooted at the ` +
        `existing \`text\` binding \`${arm.existingCallee}\` the file ` +
        `already holds of the target module — value-level, unshadowed at ` +
        `the call, and timely for the callee, its declaration preceding ` +
        `\`t\`'s — so the addition binds the lacked default binding alone ` +
        `and the call becomes exactly ` +
        `\`${arm.existingCallee}(<X>.y)\` (SPEC 6.5); the call reads ` +
        `${JSON.stringify(rewrittenCall({ callee, root }))} — a product ` +
        `judging the \`text\` binding lacked whenever the default is`,
    );
  }
  if (arm.untimelyCallee !== undefined && callee === arm.untimelyCallee.name) {
    fail(
      `${context}: the rewritten call's callee is \`${callee}\`, ` +
        `${arm.untimelyCallee.why} — a held binding roots a spelling only ` +
        `where it is timely for it, so one added declaration binds both ` +
        `the default and \`text\` and the callee is its \`text\` binding ` +
        `(SPEC 6.5; T6.5-23(k)); the call reads ` +
        `${JSON.stringify(rewrittenCall({ callee, root }))} — a product ` +
        `checking a held \`text\` binding's timeliness only when it would ` +
        `otherwise add nothing`,
    );
  }
  for (const kept of arm.forbidden) {
    for (const [role, name, held] of [
      ["callee", callee, arm.existingCallee],
      ["argument root", root, arm.existingRoot],
    ] as const) {
      if (name === kept.name && name !== held) {
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

/** The real move's observations an arm's preview parity needs. */
interface RealMoveOutcome {
  readonly bindings: CallBindings;
  /** Every composed-coordinates offset at which the added run reads. */
  readonly offsets: readonly number[];
}

/**
 * Stage one arm, run the section-form move, and assert the code file is its
 * composed post-move bytes with exactly the declaration the lacked bindings
 * require added under 6.5's line discipline — at the arm's pinned offset,
 * where the origin declaration's line stood, or, unpinned, at a line-start
 * offset — the origin, target, and third-module files as composed, `check`
 * and `build` clean, the edge sets exact, and the standard-tooling compile
 * as pinned.
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
    const pinned = arm.placement;
    if (pinned !== undefined) {
      // Bytes are the only observable: the pin holds exactly when the run
      // reads as the disciplined declaration at the pinned offset.
      if (!readings.some((reading) => reading.offset === pinned.offset)) {
        fail(
          `${context}: ${CODE} — the added declaration ` +
            `${JSON.stringify(declaration)} followed by U+000A must stand at ` +
            `${pinned.where} (offset ${String(pinned.offset)} of the ` +
            `composed text), the file's one line-start admissible offset; ` +
            `the inserted run reads instead at composed offset(s) ` +
            `${readings.map((reading) => String(reading.offset)).join(", ")} ` +
            `(SPEC 6.5, 3; T6.5-8's discipline)`,
        );
      }
    } else if (!readings.some((reading) => reading.atLineStart)) {
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
    if (arm.third) {
      await assertFileBytes(
        workspace.path(THIRD),
        THIRD_TEXT,
        `${context}: ${THIRD} after the move — the retained third module, ` +
          `whose node \`K.a\` names is neither moved nor referenced by the ` +
          `moved text, untouched (SPEC 6.5; H-4, normalizing nothing)`,
      );
    }

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
 * The byte range of `needle`'s one occurrence in `text`, `needle` standing
 * at a line start and followed by U+000A — `withTerminator` widens the range
 * over that terminator. Throws (a harness defect) when the arm table stages
 * no such occurrence or several.
 */
function stagedLineRange(
  text: string,
  needle: string,
  withTerminator: boolean,
  label: string,
): ByteRange {
  const at = text.indexOf(needle);
  if (
    at < 0 ||
    text.indexOf(needle, at + 1) >= 0 ||
    (at > 0 && text[at - 1] !== "\n") ||
    text[at + needle.length] !== "\n"
  ) {
    throw new Error(
      `${label}: the staged ${CODE} must hold ${JSON.stringify(needle)} ` +
        "exactly once, as a line of its own (a harness defect)",
    );
  }
  const start = utf8Length(text.slice(0, at));
  return {
    start,
    end: start + utf8Length(needle) + (withTerminator ? 1 : 0),
  };
}

/**
 * An arm's preview parity (SPEC 6.6, 12.7) — (a)'s, (e)'s, and (f)'s: on a
 * second, identically staged workspace, the preview's entry for the code
 * file holds exactly the `import-removal` spanning the origin declaration
 * with its adjunct drop, the `reference-rewrite` spanning the call's
 * occurrence, and one zero-length `import-addition` at the removal's start
 * or at its end, whose offset, composed, is where the real move inserted
 * the declaration.
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
    const code = codeText(arm);
    if (arm.originImport !== "removed") {
      throw new Error(
        `${context}: preview parity is pinned for arms whose origin ` +
          "declaration is removed (a harness defect)",
      );
    }
    // The origin declaration's own characters plus the terminator of the
    // line its deletion leaves empty (SPEC 6.5, 3).
    const removal = stagedLineRange(code, ORIGIN_IMPORT, true, context);
    const callStart = utf8Length(code.slice(0, code.indexOf(CALL_BEFORE)));
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
        `[${String(removal.start)}, ${String(removal.end)}) — its own ` +
        `characters and the terminator of the line its deletion leaves ` +
        `empty — the \`reference-rewrite\` spanning the call's occurrence, ` +
        `callee through closing parenthesis [${String(rewrite.start)}, ` +
        `${String(rewrite.end)}), and the zero-length \`import-addition\` ` +
        `at the insertion offset (SPEC 6.6, 6.5, 5.7, 3, 12.7)`,
    );
    if (offset !== removal.start && offset !== removal.end) {
      fail(
        `${label}: ${CODE} — the \`import-addition\` stands at offset ` +
          `${String(offset)}, neither the origin declaration's removal's ` +
          `start (${String(removal.start)}) nor its end ` +
          `(${String(removal.end)}): the one composed position those two ` +
          `make, where the origin declaration's line stood, is the file's ` +
          `one line-start admissible offset — every later line start lies ` +
          `inside a statement or is untimely — the choice between them 6.5's ` +
          `latitude, the real operation's bytes the same either way ` +
          `(SPEC 6.5, 6.6; T6.6-4 (b))`,
      );
    }
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
          `[${String(removal.start)}, ${String(removal.end)}) or the rewrite ` +
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
    "TypeScript `text(...)` calls across the move: a call whose target the section form carries into another file is rewritten whole — callee through the target module's `text` binding, argument through its default binding — over its occurrence's span, never becoming the cross-module call of 14.11, and imports are added binding exactly the lacked bindings and removed exactly when an occurrence used a binding of theirs before and none after; over `specs/origin.mdx#x` → `specs/target.mdx#y` and `src/c.ts`: (a) `import K from \"../specs/k.xspec\"` heading `import O, { text as t }`, then `f` holding the marker `K.a` and `t(O.x)` — after the move the file compiles clean under standard tooling, `build` and `check` are clean, `query edges` reports the one `embeds` edge from `src/c.ts#f` to `specs/target.mdx#y`, and the bytes are the composed post-move file with the single added run exactly `import <X>, { text as <Y> } from \"../specs/target.xspec\"` (or `{ text }` where the fresh identifier is `text` itself) followed by U+000A where the origin declaration's line stood, directly after `K`'s line, the call's span replaced by `<Y>(<X>.y)`, the origin declaration removed with its line, no other byte changed; (b) the file headed by `import T from \"../specs/target.xspec\"` (used by the marker `T.z`), then the origin import, gains exactly `import { text as <Y> } from …` (or `{ text }`) where the origin declaration's line stood, the argument rewritten through the existing `T`, the origin import removed; (c) a second call `t(O.w)` on an unmoved node keeps the origin declaration byte-for-byte, the moved call alone rewritten; (d) `type N = typeof O.x` keeps no import — the origin import is removed, `build` and `check` are clean, and the standard-tooling compile fails at the alias; (e) the file headed by `import { text as tt } from \"../specs/target.xspec\"`, lacking the default, gains exactly `import <X> from …` where the origin declaration's line stood, the call becoming `tt(<X>.y)`; (f) (a)'s file with `import { text as tt }` appended after `f`, untimely for the callee, gains one declaration binding both, as in (a), the call becoming `<Y>(<X>.y)`, `<Y>` never `tt` — (e) and (f) each clean under `build`, `check`, and the compile, with the one `embeds` edge; and the `--preview` of (a), (e), and (f) reports for `src/c.ts` one `reference-rewrite` over the call's span, one `import-addition` at the origin declaration's removal's start or end, where the real operation then inserts, and one `import-removal` spanning the origin declaration with its adjunct drop (SPEC 6.5, 4.3, 4.5, 4.6, 5.7, 6.6, 12.7)",
  run: async (product) => {
    for (const arm of CALL_MOVE_ARMS) {
      const real = await runCallMoveArm(product, arm);
      if (arm.preview) await runPreviewParityArm(product, arm, real);
    }
  },
});

/** TEST-SPEC §6.5, second half (SUITE-25 continued): T6.5-11. */
export const section65iiTests: readonly ProductTestEntry[] = [T6_5_11];
