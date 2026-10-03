// TEST-SPEC §6.5 (move), fourth part — SUITE-25 (continued): T6.5-20,
// destination refusals over derived paths. T6.5-1…T6.5-10 are
// section-6.5.ts's business, T6.5-11 section-6.5-ii.ts's, and T6.5-12…
// T6.5-19 section-6.5-iii.ts's; this module keeps those files' edits bounded
// (the section-10.7-i/-ii precedent).
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 6.5 (`refused-invalid-destination`, 14): a move is refused when its
// destination file path — a target file to be created included — or a
// derived path it would generate is a directory component of another derived
// path the sources would generate after the move (13.1, 13.2, 7.3), or lies
// under one: the finishing regeneration's writes would then meet a plain
// file where they need a directory (14.22), or replace a directory holding a
// source or another derived path (13.4). The relation reads the derived
// paths the sources would generate, whether or not anything occupies them;
// T6.5-4's relation — a directory component OCCUPIED by a non-directory —
// stays apart wherever nothing is built, and where the two meet at one
// component (a built module path) they are one reason, one finding (14).
// The source relation — arm (c) — refuses alike a derived path the
// destination would generate that is the path of, or a directory component
// of the path of, a discovered source other than a relocated origin: the
// regeneration would replace or hide that source (13.4; an emit destination
// so added over a code source first excluding it from every group).
//
// Conservative operationalizations (noted per H-4):
// - The common contract, asserted for every refused move by
//   `expectD20Refusal`: inside a whole-root modifies-nothing compare (the
//   compare-around machinery VIOL-CORE-CHATTYREADS certifies; the journal
//   absent or byte-unchanged with everything else), `move … --json` exits 1
//   and its stdout decodes as the form-exact 12.7 findings-only report
//   holding exactly one finding — `refused-invalid-destination`, nothing
//   beside it (never 14.22: a refused operation reports refusal reasons
//   alone, 14) — whose `path` is the destination as spelled (for the section
//   form, the target file's path, the operand before `#`) and whose
//   `locations` is `[]`. Its `identities` composition is unpinned (12.7) and
//   not asserted. The `--preview` twin of every refused move is T6.6-3's,
//   staged identically from `d20RefusedStagings` through
//   `runD20RefusedStaging` (one code path).
// - Each staging is one fresh workspace; its refused moves — the file form,
//   then the section form creating the target at the file form's
//   destination, keeping the ID `x` (`specs/Z.mdx` holds the one section
//   `x`) — run one after the other on it: each modifies nothing (asserted),
//   so the second meets the identical staging.
// - The companion legs read the companion paths of `specs/A.mdx` as
//   T13.4-9(e) reads them (support.ts `readRecordedCompanionPaths`): a
//   scratch twin holding, under the staging's configuration, `specs/A.mdx`'s
//   bytes at that path alone is built, and the recorded entries
//   `specs/A.xspec.<suffix>` other than the module are the companions — the
//   product's own suffixes, none for a product writing no companions. One
//   staging per companion path.
// - "Staged before any build": the staging's workspace is created and the
//   moves run with no `build` before them, so no derived path is occupied
//   and the relation is judged over the derived paths the sources would
//   generate, never over files on disk. TEST-SPEC leaves (b)'s first staging
//   open on this; it is staged before any build too, so a product judging
//   the relation over what is on disk alone performs the move there as well.
// - The after-build staging re-pins its premise: after the premise `build`,
//   `specs/A.xspec.ts` is a plain file (the module that build wrote, 13.1) —
//   a product writing no module there fails diagnosed at the premise, never
//   at a refusal the arm does not stage.
// - Arm (c), emission next to sources throughout. TEST-SPEC names the code
//   group of the staging beside `specs/B.md` (`specs/*.md`) and replaces it
//   ("instead") only from the staging beside `specs/B.md/x.ts` on
//   (`specs/**/*.ts`), so the staging beside `specs/B.md/C.mdx` keeps the
//   first; each code source holds `export const v = 1` and U+000A, as
//   T13.4-11(b)'s does. The companion stagings read the destination's
//   companion paths from a twin holding `specs/Z.mdx`'s bytes at
//   `specs/A.mdx` under the `specs/**/*.ts` configuration (TEST-SPEC). The
//   exemption's stagings hold `specs/B.md/C.mdx` alone under the first
//   configuration — no `specs/Z.mdx`, which they never move — and are built
//   first: the performed file form (`runD20Exemption`, after the refused
//   stagings, no T6.6-3 twin) re-pins the build's Markdown and module beneath
//   `specs/B.md`, and its "`specs/B.md` a plain file holding its Markdown"
//   compares that file with what a twin holding the moved bytes at
//   `specs/B.mdx`, freshly built under the same configuration, emits there
//   (T13.4-11's twin protocol); the refused section form is a table staging
//   whose premise is `specs/B.md/C.md` a plain file after the build.
// - Arm (d): TEST-SPEC names no code group for `src/c.ts`; one group
//   globbing `src/**/*.ts` reaches it. Each refused staging holds
//   `specs/Z.mdx` and `src/c.ts` alone and is staged before any build (the
//   entry leaves this open), so nothing occupies `specs/B.md` or
//   `specs/Z.md`. "Emission disabled" is spelled `markdown: { emit: false }`:
//   the refused stagings' configuration but for that one boolean (SPEC 7.3:
//   with `emit` false, as with `markdown` absent, no path is a Markdown emit
//   destination). The controls are performed arms with no T6.6-3 twin, run
//   in the body after the refused stagings and the exemption
//   (`runD20Performed`): exit 0 with the performed-operation report,
//   `specs/B.mdx` holding the moved bytes (the moved file holds no import
//   and nothing imports it), then `check` clean.
// - Arm (e): `specs/A.mdx` holds the one section `x` and no import, a
//   record of its own (unlike (a)'s). Its retired paths are the module
//   `specs/A.xspec.ts`, the Markdown `specs/A.md`, and each companion path,
//   read as T13.4-9(e) reads them (`readD20RetiredCompanions`). "Its
//   derived paths written beneath the fresh directory" is pinned as plain
//   files at the destination's module and Markdown paths and at each
//   companion path that a scratch twin, holding the moved bytes at the
//   destination, records (read the same way). The after-build controls are
//   file-form moves alone, as the entry states them, each premise re-pinned
//   (the retired path a plain file after the build); the section-form
//   control is the module path's alone, staged before any build.

import type { Finding } from "../../helpers/adapters/index.js";
import {
  decodeAppliedMappingReport,
  decodeFindingsReport,
  renderPathValue,
} from "../../helpers/adapters/index.js";
import {
  assertFileBytes,
  assertFilesEqual,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { assertLeavesUnchanged } from "../../helpers/snapshot.js";
import { type StagedMdx, stagedMdx } from "../../helpers/staged-mdx.js";
import { type StagedTs, stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertFindingConcernsPath,
  buildOk,
  expectExit,
  expectFindingFreeReport,
  readRecordedCompanionPaths,
  runJson,
} from "./support.js";

// ---------------------------------------------------------------------------
// Stagings — every file a staged-source record (S-9's timing clause: every
// staging but the body's first follows a product invocation, and T6.6-3
// stages them all after many)
// ---------------------------------------------------------------------------

/** The one spec glob of every staging (TEST-SPEC: "throughout"). */
const D20_SPEC_GLOB = "specs/**/*.mdx";

/**
 * A configuration: the one spec group, then the one code group globbing
 * `codeGlob` (or none), then `markdown` as given (or absent).
 */
function d20ConfigText(
  markdown: string | null,
  codeGlob: string | null = null,
): string {
  const code =
    codeGlob === null ? "" : `,\n  code: {\n    app: ["${codeGlob}"]\n  }`;
  const tail = markdown === null ? "" : `,\n  markdown: ${markdown}`;
  return (
    `import { defineConfig } from "xspec"\n\n` +
    `export default defineConfig({\n` +
    `  specs: {\n` +
    `    main: ["${D20_SPEC_GLOB}"]\n` +
    `  }${code}${tail}\n` +
    `})\n`
  );
}

const D20_SPECS_CONFIG = stagedTs(
  "T6.5-20/T6.6-3 xspec.config.ts — specs/**/*.mdx alone, no Markdown emission ((a)'s module and companion stagings and the companion twin)",
  d20ConfigText(null),
);
const D20_OUT_CONFIG = stagedTs(
  "T6.5-20/T6.6-3 xspec.config.ts — specs/**/*.mdx, Markdown emitted under outDir \"out\" ((a)'s outDir staging, (b)'s first)",
  d20ConfigText('{ emit: true, outDir: "out" }'),
);
const D20_NESTED_OUT_CONFIG = stagedTs(
  'T6.5-20/T6.6-3 xspec.config.ts — specs/**/*.mdx, Markdown emitted under outDir "specs/B.mdx/md" ((b)\'s second staging)',
  d20ConfigText('{ emit: true, outDir: "specs/B.mdx/md" }'),
);
/** (c)'s configurations: emission next to sources, and one code group. */
const D20_EMIT_NEXT = "{ emit: true }";
const D20_C_MD_CONFIG = stagedTs(
  "T6.5-20/T6.6-3 xspec.config.ts — specs/**/*.mdx, a code group globbing specs/*.md, Markdown emitted next to sources ((c)'s stagings beside specs/B.md and beside specs/B.md/C.mdx, and its exemption's)",
  d20ConfigText(D20_EMIT_NEXT, "specs/*.md"),
);
const D20_C_TS_CONFIG = stagedTs(
  "T6.5-20/T6.6-3 xspec.config.ts — specs/**/*.mdx, a code group globbing specs/**/*.ts, Markdown emitted next to sources ((c)'s stagings beside specs/B.md/x.ts, specs/A.xspec.ts/c.ts, and specs/A.xspec.<suffix>/c.ts, and the companion twin)",
  d20ConfigText(D20_EMIT_NEXT, "specs/**/*.ts"),
);

/** The moved file: the section `x` the section-form moves move. */
const D20_Z = "specs/Z.mdx";
const D20_Z_SOURCE = stagedMdx(
  "T6.5-20/T6.6-3 specs/Z.mdx — the moved file, holding the one section x",
  ['<S id="x">', "Zed text.", "</S>", ""].join("\n"),
);
/** The section the section-form moves move, keeping its ID. */
const D20_SECTION = "x";

/** (a)'s discovered source, whose module path is `specs/A.xspec.ts`. */
const D20_A = "specs/A.mdx";
const D20_A_SOURCE = stagedMdx(
  "T6.5-20/T6.6-3 specs/A.mdx — (a)'s discovered source, module path specs/A.xspec.ts (the companion twin's source as well)",
  ['<S id="a">', "Alpha text.", "</S>", ""].join("\n"),
);
const D20_A_MODULE = "specs/A.xspec.ts";

/** (a)'s outDir staging: a discovered source emitting `out/specs/x.md`. */
const D20_X = "specs/x.mdx";
const D20_X_SOURCE = stagedMdx(
  "T6.5-20/T6.6-3 specs/x.mdx — (a)'s outDir staging, emitting out/specs/x.md",
  ['<S id="w">', "Emitted text.", "</S>", ""].join("\n"),
);

/** (b)'s first staging: a discovered source emitting `out/specs/a.md/b.md`. */
const D20_AB = "specs/a.md/b.mdx";
const D20_AB_SOURCE = stagedMdx(
  "T6.5-20/T6.6-3 specs/a.md/b.mdx — (b)'s discovered source, emitting out/specs/a.md/b.md",
  ['<S id="b">', "Beta text.", "</S>", ""].join("\n"),
);

/**
 * (c)'s destination `specs/B.mdx`, whose emit path next to sources is
 * `specs/B.md` (13.2).
 */
const D20_C_DESTINATION = "specs/B.mdx";
const D20_C_EMIT_PATH = "specs/B.md";

/**
 * (c)'s discovered code sources — `specs/B.md`, `specs/B.md/x.ts`,
 * `specs/A.xspec.ts/c.ts`, and `specs/A.xspec.<suffix>/c.ts` — each well-
 * formed TypeScript holding `export const v = 1` (TEST-SPEC: "the same
 * content").
 */
const D20_CODE_SOURCE = stagedTs(
  "T6.5-20/T6.6-3 (c)'s discovered code sources specs/B.md, specs/B.md/x.ts, specs/A.xspec.ts/c.ts, and specs/A.xspec.<suffix>/c.ts — export const v = 1",
  "export const v = 1\n",
);

/**
 * (c)'s discovered `specs/B.md/C.mdx`, below the emit path `specs/B.md`:
 * holding no import and the one section `x` — the exemption's origin, alone
 * under `specs/B.md`, of either form.
 */
const D20_BC = "specs/B.md/C.mdx";
const D20_BC_SOURCE = stagedMdx(
  "T6.5-20/T6.6-3 specs/B.md/C.mdx — (c)'s discovered source below the emit path specs/B.md, holding no import and the one section x (the exemption's origin; at specs/B.mdx, the exemption twin's source)",
  ['<S id="x">', "Cee text.", "</S>", ""].join("\n"),
);

/**
 * (d)'s code group, the one glob reaching the code source `src/c.ts`
 * (TEST-SPEC names none): its refused stagings and emission-enabled controls
 * emit next to sources, its emission-disabled controls under the same
 * configuration but for `emit: false` (SPEC 7.3: no path is then a Markdown
 * emit destination).
 */
const D20_D_CODE_GLOB = "src/**/*.ts";
const D20_D_CONFIG = stagedTs(
  "T6.5-20/T6.6-3 xspec.config.ts — specs/**/*.mdx, a code group globbing src/**/*.ts, Markdown emitted next to sources ((d)'s refused stagings and its emission-enabled controls)",
  d20ConfigText(D20_EMIT_NEXT, D20_D_CODE_GLOB),
);
const D20_D_NO_EMIT_CONFIG = stagedTs(
  "T6.5-20 xspec.config.ts — specs/**/*.mdx, a code group globbing src/**/*.ts, Markdown emission disabled by emit false ((d)'s emission-disabled controls)",
  d20ConfigText("{ emit: false }", D20_D_CODE_GLOB),
);

/** (d)'s code source, holding one construct alone. */
const D20_D_CODE = "src/c.ts";

/**
 * One (d) staging of `src/c.ts`: the construct it holds alone, its line
 * followed by U+000A, naming `specs/B.md` — the emit path of (c)'s and
 * (d)'s destination `specs/B.mdx` — by the relative specifier
 * `../specs/B.md`.
 */
interface D20DesignationCode {
  /** The construct (diagnostics), e.g. `an import declaration`. */
  readonly construct: string;
  readonly source: StagedTs;
}

function d20DesignationCode(
  tests: string,
  construct: string,
  line: string,
): D20DesignationCode {
  return {
    construct,
    source: stagedTs(
      `${tests} src/c.ts — (d) ${construct} alone: ${line}`,
      `${line}\n`,
    ),
  };
}

/**
 * (d)'s six stagings, one per module-linking form SPEC 4 names, each text
 * TypeScript 5.9.3 accepts both as module code and as script code (S-9
 * judges each record both ways): with emission enabled each makes the move
 * to `specs/B.mdx` refused, the specifier designating the destination's
 * would-be emit path (SPEC 6.5, 4, 14.15); with emission disabled no emit
 * destination arises, and the move is performed (the controls).
 */
const D20_D_FORMS: readonly D20DesignationCode[] = [
  d20DesignationCode(
    "T6.5-20/T6.6-3",
    "an import declaration",
    'import "../specs/B.md"',
  ),
  d20DesignationCode(
    "T6.5-20/T6.6-3",
    "an export declaration with a module specifier",
    'export * from "../specs/B.md"',
  ),
  d20DesignationCode(
    "T6.5-20/T6.6-3",
    "an import X = require(…) declaration",
    'import X = require("../specs/B.md")',
  ),
  d20DesignationCode(
    "T6.5-20/T6.6-3",
    "a dynamic import() whose specifier is a static string literal",
    'import("../specs/B.md")',
  ),
  d20DesignationCode(
    "T6.5-20/T6.6-3",
    "an import type",
    'type T = import("../specs/B.md")',
  ),
  d20DesignationCode(
    "T6.5-20/T6.6-3",
    "a string-named module declaration",
    'declare module "../specs/B.md" { }',
  ),
];

/**
 * (d)'s emission-enabled controls: the path named only by constructs that
 * are no module-linking form (SPEC 4) — a `require(…)` call's argument, a
 * triple-slash directive, and a dynamic `import()` whose template literal
 * is no static string literal (2.4) — so the move is performed.
 */
const D20_D_NON_FORMS: readonly D20DesignationCode[] = [
  d20DesignationCode(
    "T6.5-20",
    "a require(…) call's argument",
    'require("../specs/B.md")',
  ),
  d20DesignationCode(
    "T6.5-20",
    "a triple-slash reference directive",
    '/// <reference path="../specs/B.md" />',
  ),
  d20DesignationCode(
    "T6.5-20",
    "a dynamic import() whose specifier is a template literal",
    "import(`../specs/B.md`)",
  ),
];

/**
 * (e)'s configuration: the one spec group, Markdown emitted next to
 * sources, no code group.
 */
const D20_E_CONFIG = stagedTs(
  "T6.5-20/T6.6-3 xspec.config.ts — specs/**/*.mdx alone, Markdown emitted next to sources ((e)'s stagings and its companion twins)",
  d20ConfigText(D20_EMIT_NEXT),
);

/**
 * (e)'s only source `specs/A.mdx`, holding the one section `x` and no
 * import (unlike (a)'s `specs/A.mdx`).
 */
const D20_E_A_SOURCE = stagedMdx(
  "T6.5-20/T6.6-3 specs/A.mdx — (e)'s only source, holding the one section x and no import (the companion twins' source, at specs/A.mdx and at each performed destination)",
  ['<S id="x">', "Alpha text.", "</S>", ""].join("\n"),
);

/** `specs/A.mdx`'s Markdown path, emitted next to sources (13.2). */
const D20_A_MARKDOWN = "specs/A.md";

/**
 * One refused move of T6.5-20 (the module header's common contract):
 * exported, with its staging, for T6.6-3's preview twin.
 */
export interface D20RefusedMove {
  /** The move's argv, `--json` excluded. */
  readonly argv: readonly string[];
  /**
   * The finding's concerned path: the destination as spelled — for the
   * section form, the target file's path (SPEC 14, 6.5).
   */
  readonly path: string;
}

/**
 * One refused staging of T6.5-20: a fresh workspace (`config` plus `files`),
 * the premise `build` when staged after one, then each refused move in turn.
 * Exported for T6.6-3, which stages each identically (TEST-SPEC T6.6-3).
 */
export interface D20RefusedStaging {
  /** The arm and staging (diagnostics), e.g. `(a) module path`. */
  readonly key: string;
  readonly config: StagedTs;
  readonly files: Readonly<Record<string, InitialFileContents>>;
  /**
   * `null` for a staging staged before any build; else a derived path the
   * premise `build` must leave a plain file — the occupant the staging needs
   * ((a)'s built module path; for (c)'s exemption staging, the Markdown that
   * build writes beneath the emit path) — its premise re-pinned (the module
   * header's note).
   */
  readonly builtOccupant: string | null;
  readonly moves: readonly D20RefusedMove[];
}

/**
 * The pair at one destination: the file-form move of `specs/Z.mdx` there,
 * then the section-form move of its section `x` creating that target file.
 */
function d20Pair(destination: string): readonly D20RefusedMove[] {
  return [
    { argv: ["move", D20_Z, destination], path: destination },
    {
      argv: [
        "move",
        `${D20_Z}#${D20_SECTION}`,
        `${destination}#${D20_SECTION}`,
      ],
      path: destination,
    },
  ];
}

/** (a)'s files: the discovered `specs/A.mdx` beside the moved file. */
const D20_A_FILES: Readonly<Record<string, InitialFileContents>> = {
  [D20_A]: D20_A_SOURCE,
  [D20_Z]: D20_Z_SOURCE,
};

/**
 * (a), the module path: the destination `specs/A.xspec.ts/B.mdx` lies under
 * `specs/A.mdx`'s module path, staged before any build — nothing occupies
 * the module path, so T6.5-4's occupied-component relation stays apart.
 */
const D20_A_MODULE_STAGING: D20RefusedStaging = {
  key: "(a) under the module path specs/A.xspec.ts, before any build",
  config: D20_SPECS_CONFIG,
  files: D20_A_FILES,
  builtOccupant: null,
  moves: d20Pair(`${D20_A_MODULE}/B.mdx`),
};

/**
 * (a), one companion path `specs/A.xspec.<suffix>` of `specs/A.mdx` (read
 * by `readRecordedCompanionPaths`): the destination
 * `specs/A.xspec.<suffix>/B.mdx`, staged before any build — a product whose
 * relation leaves out companions performs it, its regeneration then writing
 * the companion over the directory holding the moved file.
 */
function d20CompanionStaging(companion: string): D20RefusedStaging {
  return {
    key: `(a) under the companion path ${companion}, before any build`,
    config: D20_SPECS_CONFIG,
    files: D20_A_FILES,
    builtOccupant: null,
    moves: d20Pair(`${companion}/B.mdx`),
  };
}

/**
 * (a), the module path after a `build`: `specs/A.xspec.ts` is then the plain
 * file that build wrote, occupying a directory component of the destination
 * (T6.5-4's relation) while being the derived path the destination lies
 * under — one reason either way, exactly one finding per move (SPEC 6.5,
 * 14).
 */
const D20_A_MODULE_BUILT_STAGING: D20RefusedStaging = {
  key: "(a) under the module path specs/A.xspec.ts, after a build (the two relations meeting at one component)",
  config: D20_SPECS_CONFIG,
  files: D20_A_FILES,
  builtOccupant: D20_A_MODULE,
  moves: d20Pair(`${D20_A_MODULE}/B.mdx`),
};

/**
 * (a), a derived path of the destination under one while the destination
 * itself lies under none: under `outDir: "out"` beside `specs/x.mdx`
 * (emitting `out/specs/x.md`), the destination `specs/x.md/y.mdx` emits
 * `out/specs/x.md/y.md`, under `out/specs/x.md`; `specs/x.md`, the
 * destination's own component, is no derived path. Staged before any build.
 */
const D20_A_OUTDIR_STAGING: D20RefusedStaging = {
  key: "(a) the destination's emit path out/specs/x.md/y.md under out/specs/x.md, before any build",
  config: D20_OUT_CONFIG,
  files: { [D20_X]: D20_X_SOURCE, [D20_Z]: D20_Z_SOURCE },
  builtOccupant: null,
  moves: d20Pair("specs/x.md/y.mdx"),
};

/**
 * (b), a directory component of another derived path: under `outDir:
 * "out"` beside `specs/a.md/b.mdx` (emitting `out/specs/a.md/b.md`), the
 * destination `specs/a.mdx` emits `out/specs/a.md`, a directory component of
 * that path. Staged before any build (the module header's note).
 */
const D20_B_COMPONENT_STAGING: D20RefusedStaging = {
  key: "(b) the destination's emit path out/specs/a.md a directory component of out/specs/a.md/b.md, before any build",
  config: D20_OUT_CONFIG,
  files: { [D20_AB]: D20_AB_SOURCE, [D20_Z]: D20_Z_SOURCE },
  builtOccupant: null,
  moves: d20Pair("specs/a.mdx"),
};

/**
 * (b), the destination itself such a component: under `outDir:
 * "specs/B.mdx/md"`, staged before any build so nothing occupies
 * `specs/B.mdx` (`refused-destination-exists` otherwise, T6.5-4), every emit
 * destination after the move — the destination's own
 * `specs/B.mdx/md/specs/B.md` among them — lies under the destination's
 * path.
 */
const D20_B_DESTINATION_STAGING: D20RefusedStaging = {
  key: '(b) the destination specs/B.mdx a directory component of every emit destination under outDir "specs/B.mdx/md", before any build',
  config: D20_NESTED_OUT_CONFIG,
  files: { [D20_Z]: D20_Z_SOURCE },
  builtOccupant: null,
  moves: d20Pair("specs/B.mdx"),
};

/**
 * (c), a source replaced: beside a discovered code source `specs/B.md` (the
 * code group globbing `specs/*.md`), the destination `specs/B.mdx` emits
 * `specs/B.md`, that source's path — an emit destination so added first
 * excluding the source from every group (13.4). Every (c) staging is staged
 * before any build, so nothing occupies `specs/Z.md` (the module header's
 * note).
 */
const D20_C_CODE_STAGING: D20RefusedStaging = {
  key: `(c) the emit path ${D20_C_EMIT_PATH} the path of a discovered code source, before any build`,
  config: D20_C_MD_CONFIG,
  files: { [D20_Z]: D20_Z_SOURCE, [D20_C_EMIT_PATH]: D20_CODE_SOURCE },
  builtOccupant: null,
  moves: d20Pair(D20_C_DESTINATION),
};

/**
 * (c), a source hidden: separately, beside a discovered `specs/B.md/C.mdx`
 * (the same configuration), the emit path `specs/B.md` a directory
 * component of that source's path — `C.mdx`'s derived paths, under the
 * emit path, meeting (b)'s relation as well: one reason, one finding.
 */
const D20_C_SPEC_STAGING: D20RefusedStaging = {
  key: `(c) the emit path ${D20_C_EMIT_PATH} a directory component of the discovered ${D20_BC}, before any build`,
  config: D20_C_MD_CONFIG,
  files: { [D20_Z]: D20_Z_SOURCE, [D20_BC]: D20_BC_SOURCE },
  builtOccupant: null,
  moves: d20Pair(D20_C_DESTINATION),
};

/**
 * (c), beside a discovered code source `specs/B.md/x.ts`, the only file
 * beneath `specs/B.md` (the code group globbing `specs/**\/*.ts` instead):
 * a code source generates no derived path, so the source relation alone
 * refuses — a product vetting derived paths against sources for equality
 * alone performs it.
 */
const D20_C_BENEATH_STAGING: D20RefusedStaging = {
  key: `(c) the emit path ${D20_C_EMIT_PATH} a directory component of the discovered code source ${D20_C_EMIT_PATH}/x.ts, before any build`,
  config: D20_C_TS_CONFIG,
  files: {
    [D20_Z]: D20_Z_SOURCE,
    [`${D20_C_EMIT_PATH}/x.ts`]: D20_CODE_SOURCE,
  },
  builtOccupant: null,
  moves: d20Pair(D20_C_DESTINATION),
};

/**
 * (c), `move specs/Z.mdx specs/A.mdx` beside a discovered code source
 * `specs/A.xspec.ts/c.ts` (that group; its file name holding no `.xspec.`,
 * so no exclusion applies, 13.4): the destination's module path
 * `specs/A.xspec.ts` a directory component of its path.
 */
const D20_C_MODULE_STAGING: D20RefusedStaging = {
  key: `(c) the module path ${D20_A_MODULE} a directory component of the discovered code source ${D20_A_MODULE}/c.ts, before any build`,
  config: D20_C_TS_CONFIG,
  files: { [D20_Z]: D20_Z_SOURCE, [`${D20_A_MODULE}/c.ts`]: D20_CODE_SOURCE },
  builtOccupant: null,
  moves: d20Pair(D20_A),
};

/**
 * (c), separately, one staging per companion path `specs/A.xspec.<suffix>`
 * of the destination (read by `readRecordedCompanionPaths` from a twin
 * holding `specs/Z.mdx`'s bytes at `specs/A.mdx`): beside a discovered code
 * source `specs/A.xspec.<suffix>/c.ts` instead — a product whose relations
 * leave out companions performs it, its regeneration writing the plain file
 * over the directory and so deleting the source (13.4).
 */
function d20CodeCompanionStaging(companion: string): D20RefusedStaging {
  return {
    key: `(c) the companion path ${companion} a directory component of the discovered code source ${companion}/c.ts, before any build`,
    config: D20_C_TS_CONFIG,
    files: { [D20_Z]: D20_Z_SOURCE, [`${companion}/c.ts`]: D20_CODE_SOURCE },
    builtOccupant: null,
    moves: d20Pair(D20_A),
  };
}

/**
 * (c)'s exemption staging under the section form, which relocates no
 * origin: after a `build`, `move specs/B.md/C.mdx#x specs/B.mdx#x` creating
 * the target `specs/B.mdx` — the source left below the emit path being no
 * relocated origin. Its premise: the `build` wrote `C.mdx`'s Markdown
 * beneath the emit path.
 */
const D20_C_EXEMPTION_SECTION_STAGING: D20RefusedStaging = {
  key: `(c) the exemption staging under the section form, after a build: ${D20_BC} below the emit path ${D20_C_EMIT_PATH} no relocated origin`,
  config: D20_C_MD_CONFIG,
  files: { [D20_BC]: D20_BC_SOURCE },
  builtOccupant: `${D20_C_EMIT_PATH}/C.md`,
  moves: [
    {
      argv: [
        "move",
        `${D20_BC}#${D20_SECTION}`,
        `${D20_C_DESTINATION}#${D20_SECTION}`,
      ],
      path: D20_C_DESTINATION,
    },
  ],
};

/**
 * (d), a module-linking form made to designate a derived-file path: with
 * emission next to sources, the code source `src/c.ts` holds one form
 * alone, its relative specifier `../specs/B.md` — valid while no
 * `specs/B.mdx` exists, `specs/B.md` then no derived-file path — and the
 * move to `specs/B.mdx` (of either form) would make it the destination's
 * emit path (SPEC 6.5, 4, 14.15). Staged before any build (the module
 * header's note).
 */
function d20DesignationStaging(code: D20DesignationCode): D20RefusedStaging {
  return {
    key: `(d) ${D20_D_CODE} holding ${code.construct} alone, designating the destination's emit path ${D20_C_EMIT_PATH}, before any build`,
    config: D20_D_CONFIG,
    files: { [D20_Z]: D20_Z_SOURCE, [D20_D_CODE]: code.source },
    builtOccupant: null,
    moves: d20Pair(D20_C_DESTINATION),
  };
}

/**
 * (e)'s retired paths: `specs/A.mdx`'s module, its Markdown, then each of
 * its companion paths (`companions`, from `readD20RetiredCompanions`) —
 * generated by no source once a file-form move relocates `specs/A.mdx`.
 */
function d20RetiredPaths(companions: readonly string[]): readonly string[] {
  return [D20_A_MODULE, D20_A_MARKDOWN, ...companions];
}

/**
 * (e)'s companion paths of `specs/A.mdx`, read as T13.4-9(e) reads them: a
 * scratch twin holding (e)'s `specs/A.mdx` alone under (e)'s configuration
 * (`readRecordedCompanionPaths`; none for a product writing no companions).
 */
async function readD20RetiredCompanions(
  product: ProductBinding,
  context: string,
): Promise<readonly string[]> {
  return readRecordedCompanionPaths(
    product,
    D20_E_CONFIG,
    D20_A,
    D20_E_A_SOURCE,
    `${context} (e)'s companion paths of ${D20_A}`,
  );
}

/**
 * (e)'s refused controls, each performed arm's file-form move staged after
 * a `build` instead: the retired path `retired` is then the plain file
 * that build wrote, occupying a directory component of the destination
 * `<retired>/B.mdx` — refused by T6.5-4's relation alone (SPEC 6.5).
 */
function d20RetiredBuiltStaging(retired: string): D20RefusedStaging {
  const destination = `${retired}/B.mdx`;
  return {
    key: `(e) under the retired path ${retired}, after a build (T6.5-4's relation alone, ${retired} the plain file that build wrote)`,
    config: D20_E_CONFIG,
    files: { [D20_A]: D20_E_A_SOURCE },
    builtOccupant: retired,
    moves: [{ argv: ["move", D20_A, destination], path: destination }],
  };
}

/**
 * (e)'s section-form control, staged before any build: `move
 * specs/A.mdx#x specs/A.xspec.ts/B.mdx#x` creating the target relocates no
 * origin, so `specs/A.mdx` still generates `specs/A.xspec.ts` after the
 * move and the target lies under that derived path (SPEC 6.5).
 */
const D20_E_SECTION_STAGING: D20RefusedStaging = {
  key: `(e) the section form under the module path ${D20_A_MODULE}, before any build (relocating no origin, ${D20_A} still generating it)`,
  config: D20_E_CONFIG,
  files: { [D20_A]: D20_E_A_SOURCE },
  builtOccupant: null,
  moves: [
    {
      argv: [
        "move",
        `${D20_A}#${D20_SECTION}`,
        `${D20_A_MODULE}/B.mdx#${D20_SECTION}`,
      ],
      path: `${D20_A_MODULE}/B.mdx`,
    },
  ],
};

/**
 * Every refused staging of T6.5-20, in the entry's order — (d)'s six, then
 * (c)'s exemption staging under the section form, as the entry's
 * section-form paragraph states it, then (e)'s controls — the companion legs
 * read first (`readRecordedCompanionPaths`, as T13.4-9(e) reads them: for
 * (a), a scratch twin holding `specs/A.mdx`'s bytes alone under (a)'s
 * configuration; for (c), one holding `specs/Z.mdx`'s bytes at
 * `specs/A.mdx` under (c)'s `specs/**\/*.ts` configuration; for (e), one
 * holding (e)'s `specs/A.mdx` alone under (e)'s configuration). Exported
 * for T6.6-3, whose preview twins stage each identically; the reads are the
 * caller's first product invocations of the table.
 */
export async function d20RefusedStagings(
  product: ProductBinding,
  context: string,
): Promise<readonly D20RefusedStaging[]> {
  const companions = await readRecordedCompanionPaths(
    product,
    D20_SPECS_CONFIG,
    D20_A,
    D20_A_SOURCE,
    `${context} (a)'s companion paths of ${D20_A}`,
  );
  const codeCompanions = await readRecordedCompanionPaths(
    product,
    D20_C_TS_CONFIG,
    D20_A,
    D20_Z_SOURCE,
    `${context} (c)'s companion paths of the destination ${D20_A} (a twin ` +
      `holding ${D20_Z}'s bytes there)`,
  );
  const retiredCompanions = await readD20RetiredCompanions(product, context);
  return [
    D20_A_MODULE_STAGING,
    ...companions.map(d20CompanionStaging),
    D20_A_MODULE_BUILT_STAGING,
    D20_A_OUTDIR_STAGING,
    D20_B_COMPONENT_STAGING,
    D20_B_DESTINATION_STAGING,
    D20_C_CODE_STAGING,
    D20_C_SPEC_STAGING,
    D20_C_BENEATH_STAGING,
    D20_C_MODULE_STAGING,
    ...codeCompanions.map(d20CodeCompanionStaging),
    ...D20_D_FORMS.map(d20DesignationStaging),
    D20_C_EXEMPTION_SECTION_STAGING,
    ...d20RetiredPaths(retiredCompanions).map(d20RetiredBuiltStaging),
    D20_E_SECTION_STAGING,
  ];
}

/**
 * Stage one refused staging in a fresh workspace (H-1) — the premise
 * `build` first when the staging is built after one, its premise re-pinned
 * (the module header's note) — and hand each refused move to `perMove` in
 * turn: T6.5-20's own contract, or T6.6-3's preview equivalence. Exported
 * for T6.6-3 (one code path for "staged identically").
 */
export async function runD20RefusedStaging(
  product: ProductBinding,
  staging: D20RefusedStaging,
  context: string,
  perMove: (
    workspace: TestWorkspace,
    move: D20RefusedMove,
    context: string,
  ) => Promise<void>,
): Promise<void> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": staging.config, ...staging.files },
  });
  try {
    if (staging.builtOccupant !== null) {
      await buildOk(
        product,
        workspace,
        `${context}: the premise \`build\` — the staged workspace passes ` +
          `\`build\`'s validations (SPEC 12.1)`,
      );
      const kind = await workspace.kind(staging.builtOccupant);
      if (kind !== "file") {
        fail(
          `${context}: staging premise — after the premise \`build\`, ` +
            `${staging.builtOccupant} is the plain file that build wrote, ` +
            `a derived file of a staged source (SPEC 13.1, 13.2, 13.4); ` +
            `found ${kind}`,
        );
      }
    }
    for (const move of staging.moves) {
      await perMove(workspace, move, `${context}: \`${move.argv.join(" ")}\``);
    }
  } finally {
    await workspace.dispose();
  }
}

/**
 * T6.5-20's common contract for one refused move (the module header's
 * note): inside a whole-root modifies-nothing compare, exit 1 and exactly one
 * `refused-invalid-destination` finding — `path` the destination as
 * spelled, `locations` `[]` — nothing beside it, never 14.22 (SPEC 6.5, 14,
 * 12.7).
 */
async function expectD20Refusal(
  product: ProductBinding,
  workspace: TestWorkspace,
  move: D20RefusedMove,
  context: string,
): Promise<void> {
  const command = [...move.argv, "--json"].join(" ");
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await expectExit(
        product,
        workspace,
        [...move.argv, "--json"],
        1,
        `${context} — the move is refused, a validation failure: exit 1 ` +
          `(SPEC 6.5, 12.0)`,
      );
      const findings: readonly Finding[] = decodeFindingsReport(
        parseJsonStdout(result, `${context}: \`${command}\``),
        `${context}: \`${command}\` — a refused operation's report is the ` +
          `form-exact 12.7 findings-only report (SPEC 12.7, H-3)`,
      ).findings;
      assertConditionCounts(
        findings,
        { "refused-invalid-destination": 1 },
        `${context} — exactly one refused-invalid-destination finding and ` +
          `nothing beside it: one finding per reason, the relations meeting ` +
          `at one component being one reason, and never 14.22 — a refused ` +
          `operation reports refusal reasons alone (SPEC 6.5, 14, T14-7)`,
      );
      const finding = findings[0]!;
      assertFindingConcernsPath(
        finding,
        move.path,
        `${context}: the refused-invalid-destination finding concerns the ` +
          `destination path as spelled (SPEC 14, 6.5)`,
      );
      if (finding.locations.length !== 0) {
        fail(
          `${context}: the refused-invalid-destination finding concerns a ` +
            `path, so its \`locations\` is [] (SPEC 14, 12.7, T14-7); got ` +
            JSON.stringify(
              finding.locations.map((location) => ({
                file: renderPathValue(location.file),
                range: location.range,
              })),
            ),
        );
      }
    },
    `${context}: the refused move modifies nothing — sources, derived ` +
      `files, and the journal (absent or byte-unchanged) alike (SPEC 6.5)`,
  );
}

/**
 * (c)'s exemption, performed: after a `build`, `move specs/B.md/C.mdx
 * specs/B.mdx` — `C.mdx` holding no import and the only source under
 * `specs/B.md`, so the one source below the emit path is the relocated
 * origin (SPEC 6.5) — exits 0 with the performed-operation report, leaving
 * `specs/B.mdx` holding the moved bytes and `specs/B.md` a plain file
 * holding its Markdown — the bytes a twin holding the moved bytes at
 * `specs/B.mdx`, freshly built under the same configuration, emits there —
 * the emitted file replacing the vacated directory with nothing under it
 * (13.4, T13.4-11); `check` clean. A performed arm: no T6.6-3 twin.
 */
async function runD20Exemption(product: ProductBinding): Promise<void> {
  const context =
    `T6.5-20 (c) the exemption, performed after a build: ` +
    `\`move ${D20_BC} ${D20_C_DESTINATION}\``;
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": D20_C_MD_CONFIG, [D20_BC]: D20_BC_SOURCE },
  });
  try {
    await buildOk(
      product,
      workspace,
      `${context}: the premise \`build\` — the staged workspace passes ` +
        `\`build\`'s validations (SPEC 12.1)`,
    );
    for (const rel of [
      `${D20_C_EMIT_PATH}/C.md`,
      `${D20_C_EMIT_PATH}/C.xspec.ts`,
    ]) {
      const kind = await workspace.kind(rel);
      if (kind !== "file") {
        fail(
          `${context}: staging premise — the premise \`build\` writes ` +
            `${D20_BC}'s Markdown and module beneath the emit path ` +
            `${D20_C_EMIT_PATH}, plain files (SPEC 13.1, 13.2, 7.3); found ` +
            `${kind} at ${rel}`,
        );
      }
    }
    const command = ["move", D20_BC, D20_C_DESTINATION, "--json"];
    const label = `${context}: \`${command.join(" ")}\``;
    decodeAppliedMappingReport(
      await runJson(
        product,
        workspace,
        command,
        `${label} — the one source below the emit path is the relocated ` +
          `origin, so the move is performed: exit 0 (SPEC 6.5, 12.0)`,
      ),
      `${label} — a performed move reports the form-exact 12.7 ` +
        `performed-operation document, \`findings\` [] beside its applied ` +
        `mapping (SPEC 6.5, 6.4, 12.7)`,
    );
    await assertFileBytes(
      workspace.path(D20_C_DESTINATION),
      D20_BC_SOURCE.source,
      `${context}: ${D20_C_DESTINATION} holds the moved bytes — ${D20_BC} ` +
        `holds no import and nothing imports it, so the relocation rewrites ` +
        `no byte (SPEC 6.5)`,
    );
    const emitted = await workspace.kind(D20_C_EMIT_PATH);
    if (emitted !== "file") {
      fail(
        `${context}: ${D20_C_EMIT_PATH} is a plain file holding ` +
          `${D20_C_DESTINATION}'s Markdown, the emitted file replacing the ` +
          `vacated directory with nothing under it (SPEC 13.4, 13.2, ` +
          `T13.4-11); found ${emitted}`,
      );
    }
    const twin = await TestWorkspace.create({
      files: {
        "xspec.config.ts": D20_C_MD_CONFIG,
        [D20_C_DESTINATION]: D20_BC_SOURCE,
      },
    });
    try {
      await buildOk(
        product,
        twin,
        `${context}: the twin's \`build\` — the moved bytes at ` +
          `${D20_C_DESTINATION} alone under the same configuration, exit 0 ` +
          `(SPEC 12.1)`,
      );
      await assertFilesEqual(
        workspace.path(D20_C_EMIT_PATH),
        twin.path(D20_C_EMIT_PATH),
        `${context}: ${D20_C_EMIT_PATH} after the move vs the Markdown a ` +
          `twin holding the moved bytes at ${D20_C_DESTINATION}, freshly ` +
          `built, emits there — ${D20_C_DESTINATION}'s Markdown (SPEC 13.2, ` +
          `13.4, 3)`,
      );
    } finally {
      await twin.dispose();
    }
    await expectFindingFreeReport(
      product,
      workspace,
      ["check", "--json"],
      `${context}: \`check --json\` after the move — clean (SPEC 6.5, ` +
        `13.4, 14.10)`,
    );
  } finally {
    await workspace.dispose();
  }
}

/**
 * One performed file-form move of T6.5-20 — (d)'s controls and (e)'s
 * retired-path arms, each staged before any build — no T6.6-3 twin.
 */
interface D20PerformedMove {
  readonly config: StagedTs;
  readonly files: Readonly<Record<string, InitialFileContents>>;
  readonly origin: string;
  readonly destination: string;
  /** The origin's bytes, which the destination holds after the move. */
  readonly moved: StagedMdx;
  /**
   * Further paths the move's finishing regeneration leaves plain files —
   * (e)'s destination's derived paths beneath the fresh directory.
   */
  readonly written: readonly string[];
}

/**
 * Perform one `D20PerformedMove` in a fresh workspace (H-1): `move <origin>
 * <destination> --json` exits 0 with the form-exact performed-operation
 * report, the destination holds the moved bytes — the moved file holds no
 * import and nothing imports it, so the relocation rewrites no byte (SPEC
 * 6.5) — each `written` path is a plain file, and `check` is clean
 * afterward.
 */
async function runD20Performed(
  product: ProductBinding,
  performed: D20PerformedMove,
  context: string,
): Promise<void> {
  const workspace = await TestWorkspace.create({
    files: { "xspec.config.ts": performed.config, ...performed.files },
  });
  try {
    const command = ["move", performed.origin, performed.destination, "--json"];
    const label = `${context}: \`${command.join(" ")}\``;
    decodeAppliedMappingReport(
      await runJson(
        product,
        workspace,
        command,
        `${label} — no relation of SPEC 6.5 refuses it, so the move is ` +
          `performed: exit 0 (SPEC 6.5, 12.0)`,
      ),
      `${label} — a performed move reports the form-exact 12.7 ` +
        `performed-operation document, \`findings\` [] beside its applied ` +
        `mapping (SPEC 6.5, 6.4, 12.7)`,
    );
    await assertFileBytes(
      workspace.path(performed.destination),
      performed.moved.source,
      `${context}: ${performed.destination} holds the moved bytes — ` +
        `${performed.origin} holds no import and nothing imports it, so ` +
        `the relocation rewrites no byte (SPEC 6.5)`,
    );
    for (const rel of performed.written) {
      const kind = await workspace.kind(rel);
      if (kind !== "file") {
        fail(
          `${context}: after the move, the destination's derived path ` +
            `${rel} is a plain file written beneath the fresh directory by ` +
            `the finishing regeneration (SPEC 6.5, 6.4, 13.1, 13.2, 13.4); ` +
            `found ${kind}`,
        );
      }
    }
    await expectFindingFreeReport(
      product,
      workspace,
      ["check", "--json"],
      `${context}: \`check --json\` after the move — clean (SPEC 6.5, ` +
        `14.15, 13.4, 14.10)`,
    );
  } finally {
    await workspace.dispose();
  }
}

/**
 * (d)'s controls, each performed with `check` clean afterward (the moved
 * file `specs/Z.mdx`, holding no import, to `specs/B.mdx`): emission
 * disabled under each of the six stagings, no emit destination arising
 * (SPEC 7.3); and emission enabled with `specs/B.md` named only by a
 * construct that is no module-linking form (SPEC 4).
 */
async function runD20DesignationControls(
  product: ProductBinding,
): Promise<void> {
  const controls: readonly (readonly [StagedTs, D20DesignationCode, string])[] =
    [
      ...D20_D_FORMS.map(
        (code) => [D20_D_NO_EMIT_CONFIG, code, "emission disabled"] as const,
      ),
      ...D20_D_NON_FORMS.map(
        (code) =>
          [
            D20_D_CONFIG,
            code,
            "emission enabled, no module-linking form",
          ] as const,
      ),
    ];
  for (const [config, code, condition] of controls) {
    await runD20Performed(
      product,
      {
        config,
        files: { [D20_Z]: D20_Z_SOURCE, [D20_D_CODE]: code.source },
        origin: D20_Z,
        destination: D20_C_DESTINATION,
        moved: D20_Z_SOURCE,
        written: [],
      },
      `T6.5-20 (d)'s control, performed (${condition}): ${D20_D_CODE} ` +
        `holding ${code.construct} alone, before any build`,
    );
  }
}

/**
 * (e), performed: with emission next to sources and (e)'s `specs/A.mdx`
 * the only source, staged before any build, the file-form move of
 * `specs/A.mdx` to `<retired>/B.mdx` under each retired path — its module,
 * Markdown, and companion paths (`readD20RetiredCompanions`) — exits 0, the
 * destination holding the moved bytes and its derived paths written beneath
 * the fresh directory, `check` clean (SPEC 6.5: the relation reads the
 * derived paths the sources would generate after the move). Those derived
 * paths are the destination's module and Markdown (13.1, 13.2) and each
 * companion path a scratch twin holding the moved bytes at the destination
 * records, read as T13.4-9(e) reads them.
 */
async function runD20RetiredPerformed(product: ProductBinding): Promise<void> {
  const companions = await readD20RetiredCompanions(product, "T6.5-20");
  for (const retired of d20RetiredPaths(companions)) {
    const destination = `${retired}/B.mdx`;
    const context =
      `T6.5-20 (e) performed under the retired path ${retired}, before ` +
      `any build`;
    const stem = destination.slice(0, -".mdx".length);
    const written = [
      `${stem}.xspec.ts`,
      `${stem}.md`,
      ...(await readRecordedCompanionPaths(
        product,
        D20_E_CONFIG,
        destination,
        D20_E_A_SOURCE,
        `${context}: the companion paths of the destination ${destination}`,
      )),
    ];
    await runD20Performed(
      product,
      {
        config: D20_E_CONFIG,
        files: { [D20_A]: D20_E_A_SOURCE },
        origin: D20_A,
        destination,
        moved: D20_E_A_SOURCE,
        written,
      },
      context,
    );
  }
}

const T6_5_20 = defineProductTest({
  id: "T6.5-20",
  title:
    'destination refusals over derived paths, arms (a) through (e): 6.5 refuses, as `refused-invalid-destination` concerning the destination path, a move whose destination would leave the finishing regeneration a write it cannot make — each refused move exits 1 and modifies nothing (whole-root byte compare, the journal absent or byte-unchanged), reporting exactly that one finding, `path` the destination (the section form\'s target file) as spelled, `locations` `[]`, never 14.22, a refused operation reporting refusal reasons alone, and its `--preview` reports the same (T6.6-3); spec globs `specs/**/*.mdx` throughout, so each destination is otherwise valid: (a) under a derived path the sources would generate after the move — beside a discovered `specs/A.mdx`, `move specs/Z.mdx specs/A.xspec.ts/B.mdx` and the section form `move specs/Z.mdx#x specs/A.xspec.ts/B.mdx#x` creating that target, and the same pair under each companion path `specs/A.xspec.<suffix>` of `specs/A.mdx` (read from `inventory`\'s `recorded` set after a scratch twin\'s build, as T13.4-9(e) reads them; none for a product writing no companions), each staged before any build so nothing occupies the derived path; the module-path pair once more after a `build`, `specs/A.xspec.ts` then the plain file that build wrote, the two relations meeting at one component — exactly one finding per move; and, under `markdown.outDir: "out"` beside a discovered `specs/x.mdx`, `move specs/Z.mdx specs/x.md/y.mdx` and its section form, staged before any build, the destination\'s emit path `out/specs/x.md/y.md` lying under `out/specs/x.md` while the destination itself lies under no derived path; (b) a directory component of another derived path — under `markdown.outDir: "out"` beside a discovered `specs/a.md/b.mdx`, `move specs/Z.mdx specs/a.mdx` and `move specs/Z.mdx#x specs/a.mdx#x`, the emit path `out/specs/a.md` a directory component of `out/specs/a.md/b.md`; and, under `markdown.outDir: "specs/B.mdx/md"` staged before any build, `move specs/Z.mdx specs/B.mdx` and `move specs/Z.mdx#x specs/B.mdx#x`, every emit destination lying under the destination\'s path; (c) a source hidden or replaced, with emission next to sources and each refused staging staged before any build, so nothing occupies `specs/Z.md` — `move specs/Z.mdx specs/B.mdx` and its section form beside a discovered code source `specs/B.md` (a code group globbing `specs/*.md`), beside a discovered `specs/B.md/C.mdx`, and beside a discovered code source `specs/B.md/x.ts`, the only file beneath `specs/B.md` (a code group globbing `specs/**/*.ts`, the file holding `export const v = 1`); `move specs/Z.mdx specs/A.mdx` and its section form beside a discovered code source `specs/A.xspec.ts/c.ts`, and, one staging per companion path of the destination (read from a twin holding `specs/Z.mdx`\'s bytes at `specs/A.mdx`), beside `specs/A.xspec.<suffix>/c.ts` instead; and the exemption, performed — `move specs/B.md/C.mdx specs/B.mdx` after a `build`, `C.mdx` holding no import and the only source under `specs/B.md`, exits 0, leaving `specs/B.mdx` holding the moved bytes and `specs/B.md` a plain file holding its Markdown (what a freshly built twin emits there), `check` clean — while its section form, `move specs/B.md/C.mdx#x specs/B.mdx#x` after a `build`, is refused, the source left below the emit path being no relocated origin; (d) a module-linking form made to designate a derived-file path — with emission next to sources, a code source `src/c.ts` (a code group globbing `src/**/*.ts`) holding one module-linking form alone, its relative specifier `../specs/B.md`, one staging per form SPEC 4 names, each the line followed by U+000A — `import "../specs/B.md"`, `export * from "../specs/B.md"`, `import X = require("../specs/B.md")`, `import("../specs/B.md")`, `type T = import("../specs/B.md")`, and `declare module "../specs/B.md" { }`, each accepted by TypeScript 5.9.3 both as module code and as script code — makes `move specs/Z.mdx specs/B.mdx` and its section form `move specs/Z.mdx#x specs/B.mdx#x` refused, each staged before any build, the specifier designating the destination\'s would-be emit path `specs/B.md`; its controls, each performed (exit 0, the destination holding the moved bytes) with `check` clean afterward: emission disabled (`emit: false`) under each of the six stagings, and emission enabled with the path named only by `require("../specs/B.md")`, by `/// <reference path="../specs/B.md" />`, and by the template-literal `import()`, none a module-linking form; (e) the derived paths a file-form move retires — with emission next to sources and `specs/A.mdx`, holding a section `x` and no import, the only source, each staged before any build: `move specs/A.mdx specs/A.xspec.ts/B.mdx`, `move specs/A.mdx specs/A.md/B.mdx`, and, one staging per companion path of `specs/A.mdx` (read as T13.4-9(e) reads them), `move specs/A.mdx specs/A.xspec.<suffix>/B.mdx` each exit 0, the destination holding the moved bytes and its derived paths — its module, its Markdown, and each companion path a scratch twin holding the moved bytes at the destination records — written beneath the fresh directory, `check` clean; its controls, refused under the common contract: each of those file-form moves staged after a `build` instead (T6.5-4\'s relation alone, the retired path then the plain file that build wrote), and the section form `move specs/A.mdx#x specs/A.xspec.ts/B.mdx#x`, staged before any build, `specs/A.mdx` still generating `specs/A.xspec.ts` (SPEC 6.5, 4, 14.15, 13.4, 13.1, 13.2, 7.3, 14, 12.7)',
  run: async (product) => {
    for (const staging of await d20RefusedStagings(product, "T6.5-20")) {
      await runD20RefusedStaging(
        product,
        staging,
        `T6.5-20 ${staging.key}`,
        (workspace, move, context) =>
          expectD20Refusal(product, workspace, move, context),
      );
    }
    await runD20Exemption(product);
    await runD20DesignationControls(product);
    await runD20RetiredPerformed(product);
  },
});

/** TEST-SPEC §6.5, fourth part, in canonical ID order (SUITE-25). */
export const section65ivTests: readonly ProductTestEntry[] = [T6_5_20];
