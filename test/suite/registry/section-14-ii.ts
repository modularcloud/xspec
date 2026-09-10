// TEST-SPEC §14 II (the environment refusals: the reporting contract of a
// refused write) — SUITE-49: T14-9.
//
// T14-9 (write failures, 14.24) is the reporting-contract test of a write the
// environment refuses: a usage error — exit 2, the 12.7 error document as
// stdout (`code` `"write-failure"`, `path` the concerned path), the
// diagnostic on stderr, never a finding — from every command that makes the
// write and from none that writes nothing, met only at the write it refuses
// (12.0: after every check and validation). The per-command states a refused
// write leaves are T13.5-7's subject (section-13.5.ts); the stagings,
// fixtures, twins, and seam choreography are shared through
// write-refusal-staging.ts, and every arm here is contract and recovery:
// stage, refuse, decode, then — the permissions restored — `build` exits 0
// and `check` is clean (12.1, 13.4).
//
// Staging discipline (E-1, Linux leg): permission removal alone, applied at
// the seam of 13.5 for a mutating command (`runHeldWithStaging`: after
// acquisition, before any modification) and before the invocation for
// `build` and the reads (`runStaged`), each staging verified on the
// harness's own process first — an ineffective one, a privileged runner, is
// a `HarnessStagingError` (H-11), never a pass or a skip (H-9). Elsewhere
// the arms are not staged (the NU3_STAGED pattern of section-11.5, here
// `WRITE_REFUSALS_STAGED`), and the Windows subset (E-6) selects T14-9
// nowhere.
//
// Conservative operationalizations (H-3):
// - Arm (a)'s rename is `b.k` → `b.k2` in `specs/b/B.mdx` — the child
//   identity, referenced nowhere — so the refused source rewrite is the
//   operation's first write: the state 13.5 pins is "nothing written", and
//   the recovery clause ("after every arm ... `build` exits 0") holds on it.
//   The staging is (a)'s (`specs/b` unwritable) and the concerned path the
//   same `specs/b/B.mdx`; T13.5-7 (a) drives the multi-file rename whose
//   partly applied rewrite leaves the workspace failing validation.
// - "stderr the diagnostic": wording is free, so the assertion is presence —
//   a non-empty stderr beside the error document on stdout (12.0: usage
//   error messages and diagnostics are standard-error content).
// - The reporter sweep pins every refreshing read's concerned path to the
//   graph-data area `.xspec` exactly: a refresh writes graph data alone
//   (13.3: no TypeScript or Markdown is generated or removed), and the
//   mutating `review create` refreshes before its session write (13.5), so
//   on the stale workspace with `.xspec` unwritable the area is the first
//   refused write of each — never a path inside it (14.24, 11.6).
// - The refused writes of the precedence arms and the state assertions
//   beyond the contract (nothing written where the refused write is the
//   operation's first; the journal or the session file byte-unchanged) are
//   whole-entry byte compares against the workspace's own pre-invocation
//   snapshot, never harness-composed content (H-6).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import type { Finding } from "../../helpers/adapters/index.js";
import { decodeFindingsReport } from "../../helpers/adapters/index.js";
import {
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { stageWriteRefusal } from "../../helpers/permissions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import type { DirectorySnapshot } from "../../helpers/snapshot.js";
import { assertSnapshotsEqual } from "../../helpers/snapshot.js";
import type { ProductBinding, RunResult } from "../../helpers/subprocess.js";
import type { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  buildOk,
  expectErrorDocument,
  expectExit,
  runJson,
} from "./support.js";
import type { RefusalFixture } from "./write-refusal-staging.js";
import {
  GRAPH_DATA_AREA,
  JOURNAL_PATH,
  MOVE_ARGV,
  MOVE_DESTINATION,
  MOVE_DESTINATION_DIR,
  MOVE_FIXTURE,
  MOVE_MARKDOWN_DIR,
  MOVE_MARKDOWN_WRITES,
  MOVE_ORIGIN,
  RENAME_A_PATH,
  RENAME_B_DIR,
  RENAME_B_PATH,
  RENAME_FIXTURE,
  REVIEWS_DIR,
  WRITE_REFUSALS_STAGED,
  expectWriteFailure,
  isDerivedFile,
  prepareRefusalWorkspace,
  refusalAt,
  refusalUnder,
  requireItemByScope,
  runHeldWithStaging,
  runSettled,
  runStaged,
  sessionStatus,
  snapshotWorkspace,
} from "./write-refusal-staging.js";

// ---------------------------------------------------------------------------
// Shared constants and helpers
// ---------------------------------------------------------------------------

/** The arms' full rename, `b` → `b2` in `specs/b/B.mdx` (SPEC 6.4). */
const RENAME_B_TO_B2: readonly string[] = [
  "rename",
  RENAME_B_PATH,
  "b",
  "b2",
  "--json",
];
/** Arm (a)'s rename: the child identity `b.k`, referenced nowhere. */
const RENAME_CHILD: readonly string[] = [
  "rename",
  RENAME_B_PATH,
  "b.k",
  "b.k2",
  "--json",
];
const MOVE_JSON: readonly string[] = [...MOVE_ARGV, "--json"];

// Text-only staleness edits of built sources: the workspace stays valid, its
// graph data and the edited source's derived files stale (SPEC 13.3).
const B_EDIT_FROM = "Beta text.";
const B_EDIT_TO = "Beta text, edited.";
const A_EDIT_FROM = "Alpha text.";
const A_EDIT_TO = "Alpha text, edited.";
/** A's `d` reference into B after the fixture's prior rename (`b0` → `b`). */
const A_REFERENCE = "d={B.b}";
/** The same reference respelled to resolve nowhere (SPEC 14.5). */
const A_UNRESOLVED = "d={B.nope}";

const SESSION = "s";
const NEW_SESSION = "n";
const SESSION_FILE = `${REVIEWS_DIR}/${SESSION}.json`;
/** An unblocked leaf item's scope (SPEC 10.6) — not the edited source's. */
const RESOLVE_SCOPE = "specs/c/C.mdx#c";
/** A requirement node of the built rename fixture, `show`'s operand. */
const SHOW_IDENTITY = "specs/b/B.mdx#b";

/**
 * A refused write's 14.24 contract with its diagnostic: exit 2, the error
 * document as stdout (`write-failure`, a concerned path — `expectWriteFailure`),
 * and a non-empty stderr (12.0: the diagnostic is standard-error content).
 */
function expectRefusal(
  result: RunResult,
  concerned: readonly string[],
  context: string,
): Finding {
  const finding = expectWriteFailure(result, concerned, context);
  if (result.stderr.trim().length === 0) {
    fail(
      `${context} — the diagnostic accompanies the error document on ` +
        `standard error (SPEC 14.24, 12.0: usage-error messages are ` +
        `standard-error content); got an empty stderr beside ` +
        `${JSON.stringify(finding.message)}`,
    );
  }
  return finding;
}

/**
 * Recovery (SPEC 12.1, 13.4): with the permissions restored — every staging
 * is restored the moment its command exits — the next `build` exits 0 and
 * `check` is clean.
 */
async function assertRecovers(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<void> {
  await buildOk(
    product,
    workspace,
    `${context}: recovery — the permissions restored, the next \`build\` ` +
      `exits 0 (SPEC 12.1, 13.4)`,
  );
  await expectExit(
    product,
    workspace,
    ["check"],
    0,
    `${context}: recovery — after the next \`build\`, \`check\` is clean ` +
      `(SPEC 12.2, 13.4)`,
  );
}

/**
 * Rewrite one spelling in a source's current bytes (the bytes the fixture's
 * prior rename left), never a recomposed constant — a staging edit.
 */
async function editSource(
  workspace: TestWorkspace,
  rel: string,
  from: string,
  to: string,
): Promise<void> {
  const current = Buffer.from(await workspace.readBytes(rel)).toString("utf8");
  if (!current.includes(from)) {
    throw new Error(
      `harness staging: ${rel} does not contain ${JSON.stringify(from)}`,
    );
  }
  await workspace.file(rel, current.replace(from, to));
}

/** The bytes of the snapshot's plain file at `rel`. */
function fileBytes(
  snapshot: DirectorySnapshot,
  rel: string,
  context: string,
): Uint8Array {
  const entry = snapshot.entries.get(rel);
  if (entry === undefined || entry.kind !== "file") {
    return fail(
      `${context}: ${rel} must be a plain file (SPEC 13.4); found ` +
        (entry === undefined ? "absent" : entry.kind),
    );
  }
  return entry.bytes;
}

/** One plain file byte-unchanged between two snapshots. */
function assertFileUnchanged(
  before: DirectorySnapshot,
  after: DirectorySnapshot,
  rel: string,
  context: string,
): void {
  const prior = fileBytes(before, rel, context);
  const current = fileBytes(after, rel, context);
  if (Buffer.compare(Buffer.from(prior), Buffer.from(current)) !== 0) {
    fail(`${context}: ${rel} must be byte-unchanged; found it rewritten`);
  }
}

// ---------------------------------------------------------------------------
// The concerned paths, one arm each (T13.5-7's stagings)
// ---------------------------------------------------------------------------

/**
 * (a) A rewritten source: `rename specs/b/B.mdx b.k b.k2` with `specs/b`
 * staged unwritable at the seam — the error document concerns
 * `specs/b/B.mdx`; the refused rewrite being the operation's first write
 * (the child identity is referenced nowhere), nothing is written: no
 * journal entry, nothing regenerated (13.5).
 */
async function rewrittenSourceArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 (a) `rename specs/b/B.mdx b.k b.k2 --json` with specs/b unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const result = await runHeldWithStaging(
      product,
      workspace,
      RENAME_CHILD,
      "hold-t14-9-a.tmp",
      refusalUnder(RENAME_B_DIR),
      context,
    );
    expectRefusal(
      result,
      [RENAME_B_PATH],
      `${context} — the rewritten source is the concerned path (SPEC 14.24, 6.4)`,
    );
    assertSnapshotsEqual(
      prepared.before,
      await snapshotWorkspace(workspace.root),
      `${context}: nothing written — the child identity \`b.k\` is ` +
        `referenced nowhere, so B's refused rewrite is the operation's ` +
        `first write and the command stops there: no journal entry (the ` +
        `append follows every source edit), nothing regenerated (SPEC ` +
        `13.5, 14.24)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * (b) The journal: the full rename with `.xspec/journal` staged unwritable
 * (`.xspec` read-only, its occupant unwritable) — the error document
 * concerns `.xspec/journal`, the journal byte-unchanged (no entry); restored,
 * the consistently rewritten sources build clean (T13.5-7 (b)).
 */
async function journalArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 (b) `rename specs/b/B.mdx b b2 --json` with .xspec/journal unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const result = await runHeldWithStaging(
      product,
      workspace,
      RENAME_B_TO_B2,
      "hold-t14-9-b.tmp",
      refusalAt(JOURNAL_PATH),
      context,
    );
    expectRefusal(
      result,
      [JOURNAL_PATH],
      `${context} — the journal is the concerned path (SPEC 14.24, 6.1)`,
    );
    assertFileUnchanged(
      prepared.before,
      await snapshotWorkspace(workspace.root),
      JOURNAL_PATH,
      `${context}: the refused append leaves no entry (SPEC 13.5, 6.1)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * (c) An emitted Markdown file's creation or removal: the file-form move
 * with `out/specs` staged unwritable — the error document concerns one of
 * the two Markdown writes the finishing regeneration owes there,
 * `out/specs/sub/B.md`'s creation (the directory it needs is part of that
 * write, 13.4) or `out/specs/A.md`'s removal, the order among a
 * regeneration's derived-file writes being unpinned (13.5).
 */
async function markdownArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 (c) `move specs/A.mdx specs/sub/B.mdx --json` with out/specs unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    MOVE_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const result = await runHeldWithStaging(
      product,
      workspace,
      MOVE_JSON,
      "hold-t14-9-c.tmp",
      refusalUnder(MOVE_MARKDOWN_DIR),
      context,
    );
    expectRefusal(
      result,
      MOVE_MARKDOWN_WRITES,
      `${context} — an emitted Markdown file's creation or removal under ` +
        `${MOVE_MARKDOWN_DIR} is the concerned path (SPEC 14.24, 13.2, 13.5)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * (d) A relocation's second write, the origin's removal: the file-form move
 * with `specs/sub` present and writable and `specs` staged unwritable — the
 * destination produced, the origin's removal refused, the error document
 * concerning `specs/A.mdx`, the origin's own path (14.24: each of a
 * relocation's two writes concerns its own path).
 */
async function originRemovalArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 (d) `move specs/A.mdx specs/sub/B.mdx --json` with specs unwritable, specs/sub present and writable";
  const prepared = await prepareRefusalWorkspace(
    product,
    MOVE_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    await workspace.dir(MOVE_DESTINATION_DIR);
    const result = await runHeldWithStaging(
      product,
      workspace,
      MOVE_JSON,
      "hold-t14-9-d.tmp",
      refusalAt(MOVE_ORIGIN),
      context,
    );
    expectRefusal(
      result,
      [MOVE_ORIGIN],
      `${context} — the origin's removal, the relocation's second write, ` +
        `concerns the origin's own path (SPEC 14.24, 13.5)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * (d) A relocation's first write, the destination's production: the same
 * move with `specs/sub` the directory staged unwritable instead — the error
 * document concerns `specs/sub/B.mdx`, the origin still present and nothing
 * relocated: the relocation's entry precedes `src/` in `files` order (6.6,
 * 12.7), so its refused first write leaves the whole workspace
 * byte-unchanged (13.5).
 */
async function destinationProductionArm(
  product: ProductBinding,
): Promise<void> {
  const context =
    "T14-9 (d) `move specs/A.mdx specs/sub/B.mdx --json` with specs/sub unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    MOVE_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    await workspace.dir(MOVE_DESTINATION_DIR);
    const staged = await snapshotWorkspace(workspace.root);
    const result = await runHeldWithStaging(
      product,
      workspace,
      MOVE_JSON,
      "hold-t14-9-d2.tmp",
      refusalUnder(MOVE_DESTINATION_DIR),
      context,
    );
    expectRefusal(
      result,
      [MOVE_DESTINATION],
      `${context} — the destination's production, the relocation's first ` +
        `write, concerns the destination's own path (SPEC 14.24, 13.5)`,
    );
    assertSnapshotsEqual(
      staged,
      await snapshotWorkspace(workspace.root),
      `${context}: the origin still present, nothing relocated — the ` +
        `relocation's entry precedes src/ in files order (SPEC 6.6, 12.7), ` +
        `so its refused first write leaves every source, the journal, ` +
        `derived files, and graph data byte-unchanged (SPEC 13.5, 14.24)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * (e) A session file: on a stale, valid workspace holding an audit session,
 * `review resolve s <item> --status no-change` with `.xspec/reviews` and the
 * session file staged unwritable at the seam (`.xspec` itself writable, so
 * the refresh preceding the session write succeeds, 13.5) — the error
 * document concerns `.xspec/reviews/s.json`, the session file
 * byte-unchanged.
 */
async function sessionFileArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 (e) `review resolve s <item> --status no-change --json` with .xspec/reviews and the session file unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    await expectExit(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", SESSION],
      0,
      `${context} staging \`review create --strategy audit --name s\` (SPEC 10.7)`,
    );
    // The item lookup precedes the staleness edit: `review status` is itself
    // a refreshing read (SPEC 13.3), so it runs while nothing is stale.
    const item = requireItemByScope(
      await sessionStatus(product, workspace, SESSION, `${context} staging`),
      RESOLVE_SCOPE,
      `${context} staging`,
    );
    await editSource(workspace, RENAME_A_PATH, A_EDIT_FROM, A_EDIT_TO);
    const staged = await snapshotWorkspace(workspace.root);
    const result = await runHeldWithStaging(
      product,
      workspace,
      [
        "review",
        "resolve",
        SESSION,
        item.id,
        "--status",
        "no-change",
        "--json",
      ],
      "hold-t14-9-e.tmp",
      refusalAt(SESSION_FILE),
      context,
    );
    expectRefusal(
      result,
      [SESSION_FILE],
      `${context} — the session file is the concerned path (SPEC 14.24, 10.7)`,
    );
    assertFileUnchanged(
      staged,
      await snapshotWorkspace(workspace.root),
      SESSION_FILE,
      `${context}: the session write, the mutator's last write, refused ` +
        `(SPEC 13.5, 14.24)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * (f) A generated module or companion: `build` on the B-edited workspace
 * with `specs/b` staged unwritable before the invocation (`build` takes no
 * hold) — the error document concerns a derived path under `specs/b/`, the
 * first `specs/b/` write in the product's order: the set a regeneration
 * writes there is the set the prior build left (12.1 rewrites every derived
 * file; the edit changes content, not the set).
 */
async function derivedPathArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 (f) `build --json` with specs/b unwritable on the B-edited workspace";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const derivedUnderB = [...prepared.before.entries.keys()].filter(
      (rel) =>
        isDerivedFile(rel, prepared.before.entries.get(rel)) &&
        rel.startsWith(`${RENAME_B_DIR}/`),
    );
    if (derivedUnderB.length === 0) {
      fail(
        `${context}: the built workspace holds B's generated module and ` +
          `companions beside its source under ${RENAME_B_DIR}/ (SPEC 13.1, ` +
          `13.2); found none among ` +
          JSON.stringify([...prepared.before.entries.keys()]),
      );
    }
    await editSource(workspace, RENAME_B_PATH, B_EDIT_FROM, B_EDIT_TO);
    const result = await runStaged(
      product,
      workspace,
      ["build", "--json"],
      refusalUnder(RENAME_B_DIR),
      context,
    );
    expectRefusal(
      result,
      derivedUnderB,
      `${context} — a generated module or companion under ${RENAME_B_DIR}/, ` +
        `the first ${RENAME_B_DIR}/ write in the product's order, is the ` +
        `concerned path (SPEC 14.24, 12.1, 13.1)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// The reporter set, the never-reporters, and precedence (SPEC 14.24, 12.0)
// ---------------------------------------------------------------------------

// The precedence fixture: the rename fixture plus a code group — `app`, one
// code source importing A's generated module — so that `query nodes --group
// app` names a code group, an invalid flag value (SPEC 11.1: `--group`
// accepts only a configured spec group's name). The prior journaled rename
// is the rename fixture's; the code source references nothing it rewrites.
const CODE_GROUP = "app";
const PRECEDENCE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    ${CODE_GROUP}: ["src/**/*.ts"]
  },
  markdown: { emit: true }
})
`;
const PRECEDENCE_APP = [
  'import A from "../specs/a/A.xspec";',
  "",
  "A.a;",
  "",
].join("\n");
const PRECEDENCE_FIXTURE: RefusalFixture = {
  decl: {
    files: {
      ...RENAME_FIXTURE.decl.files,
      "xspec.config.ts": PRECEDENCE_CONFIG,
      "src/app.ts": PRECEDENCE_APP,
    },
  },
  priorRename: RENAME_FIXTURE.priorRename,
};

/** An exit-2 error the checks of 12.0 report with no stable code. */
function expectPlainUsageError(
  result: RunResult,
  why: string,
  context: string,
): void {
  assertExitCode(
    result,
    2,
    `${context} — ${why} is a usage error, exit 2, reported before any ` +
      `write: a write failure is met only at the write it refuses, after ` +
      `every check and validation, so a product attempting the refresh ` +
      `first fails here (SPEC 12.0, 14.24)`,
  );
  const finding = expectErrorDocument(result, context);
  if (finding.code !== null) {
    fail(
      `${context} — ${why} carries no stable code: \`code\` is null where ` +
        `14 assigns none, never \`write-failure\` (SPEC 14, 12.7); got ` +
        `${JSON.stringify(finding.code)} (message: ` +
        `${JSON.stringify(finding.message)})`,
    );
  }
}

/**
 * Graph data, the reporter set, the never-reporters, and the check-first
 * precedence, all on one state: the built precedence fixture holding an
 * audit session and a git baseline, B text-edited (stale, valid), `.xspec`
 * staged unwritable before each invocation (the reads take no hold). Every
 * refreshing read of 13.3 and the mutating `review create` exit 2 with the
 * error document concerning `.xspec` (14.24: a graph-data write concerns
 * the area); `check` exits 1 with the staleness alone, `inventory` and
 * `version` exit 0, a `rename --preview` exits 0 writing nothing; the
 * invalid-flag-value and unknown-node usage errors precede the refresh
 * (`code` null); nothing in the workspace changes around the sweep.
 */
async function reportersArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 reporters: the stale, session-bearing workspace with .xspec unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    PRECEDENCE_FIXTURE,
    context,
  );
  const { workspace, baseline } = prepared;
  try {
    await expectExit(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", SESSION],
      0,
      `${context} staging \`review create --strategy audit --name s\` (SPEC 10.7)`,
    );
    await editSource(workspace, RENAME_B_PATH, B_EDIT_FROM, B_EDIT_TO);
    const staged = await snapshotWorkspace(workspace.root);
    const staging = await refusalUnder(GRAPH_DATA_AREA)(workspace.root);
    try {
      const reporters: readonly (readonly string[])[] = [
        ["ids", "--json"],
        ["show", SHOW_IDENTITY, "--json"],
        ["coverage", "--json"],
        ["impact", "--base", baseline, "--json"],
        ["review", "status", SESSION, "--json"],
        ["query", "nodes"],
        ["occurrences"],
        ["view", RENAME_A_PATH],
        ["at", RENAME_A_PATH, "0"],
        [
          "review",
          "create",
          "--strategy",
          "audit",
          "--name",
          NEW_SESSION,
          "--json",
        ],
      ];
      for (const argv of reporters) {
        const label = `${context} \`${argv.join(" ")}\``;
        expectRefusal(
          await runSettled(product, workspace, argv, label),
          [GRAPH_DATA_AREA],
          `${label} — a refreshing read of 13.3, or a review mutator ` +
            `refreshing before its session write (13.5), whose graph-data ` +
            `write the environment refuses reports the write failure ` +
            `concerning the graph-data area, never a path inside it, and ` +
            `answers nothing (SPEC 14.24, 11.6, 13.3)`,
        );
      }

      // Never-reporters on the same state (14.24: never `check` or any other
      // command that writes nothing; 6.6: a preview writes nothing).
      const checkLabel = `${context} \`check --json\``;
      const checkResult = await runSettled(
        product,
        workspace,
        ["check", "--json"],
        checkLabel,
      );
      assertExitCode(
        checkResult,
        1,
        `${checkLabel} — \`check\` writes nothing, so it is never a 14.24 ` +
          `reporter: on the same state it exits 1 with the staleness ` +
          `(SPEC 14.24, 12.2)`,
      );
      const checkFindings = decodeFindingsReport(
        parseJsonStdout(checkResult, checkLabel),
        checkLabel,
      ).findings;
      if (checkFindings.length === 0) {
        fail(
          `${checkLabel}: exit 1 carries the staleness findings (SPEC 12.2, 14.10)`,
        );
      }
      for (const finding of checkFindings) {
        if (finding.condition !== "14.10") {
          fail(
            `${checkLabel}: \`check\` reports the staleness alone — ` +
              `condition 10, never a write failure (SPEC 14.24, 14.10); got ` +
              `${JSON.stringify(finding.code)} (message: ` +
              `${JSON.stringify(finding.message)})`,
          );
        }
      }
      await runJson(
        product,
        workspace,
        ["inventory"],
        `${context} \`inventory\` — \`inventory\` parses no sources and ` +
          `writes nothing: exit 0 with its answer on the stale workspace ` +
          `whose graph-data area is unwritable (SPEC 14.24, 11.6)`,
      );
      await runJson(
        product,
        workspace,
        ["version"],
        `${context} \`version\` — \`version\` writes nothing and loads no ` +
          `configuration: exit 0 (SPEC 14.24, 12.6)`,
      );
      const previewArgv = [
        "rename",
        RENAME_B_PATH,
        "b",
        "b2",
        "--preview",
        "--json",
      ];
      const previewLabel = `${context} \`${previewArgv.join(" ")}\``;
      const preview = await runSettled(
        product,
        workspace,
        previewArgv,
        previewLabel,
      );
      assertExitCode(
        preview,
        0,
        `${previewLabel} — a preview writes nothing — no sources, no ` +
          `journal, no derived files, no graph data — so it exits 0 on the ` +
          `valid, stale workspace, refreshing nothing (SPEC 6.6, 14.24)`,
      );

      // Precedence: the checks of 12.0 precede the write (and the refresh).
      expectPlainUsageError(
        await runSettled(
          product,
          workspace,
          ["query", "nodes", "--group", CODE_GROUP],
          `${context} \`query nodes --group ${CODE_GROUP}\``,
        ),
        `an invalid flag value — a code group's name under \`--group\` (SPEC 11.1)`,
        `${context} \`query nodes --group ${CODE_GROUP}\``,
      );
      const missing = `${RENAME_A_PATH}#missing`;
      expectPlainUsageError(
        await runSettled(
          product,
          workspace,
          ["query", "node", missing],
          `${context} \`query node ${missing}\``,
        ),
        "an unknown node identity named in an argument (SPEC 12.0)",
        `${context} \`query node ${missing}\``,
      );
    } finally {
      await staging.restore();
    }
    assertSnapshotsEqual(
      staged,
      await snapshotWorkspace(workspace.root),
      `${context}: nothing in the workspace changes around the sweep — a ` +
        `refresh writes graph data alone (refused), a preview writes ` +
        `nothing, and the usage errors precede every write (SPEC 13.3, ` +
        `6.6, 12.0)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Precedence, the failing twin: an identically prepared workspace whose
 * sources also fail validation (A's `d` reference respelled to resolve
 * nowhere, 14.5) beside the staleness edit — with `.xspec` staged
 * unwritable, `ids` exits 1 with the findings: nothing is written on a
 * failing workspace (13.3), so no write is refused, and a product
 * attempting the refresh first fails here.
 */
async function failingTwinArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 precedence: `ids --json` on the failing, stale twin with .xspec unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    PRECEDENCE_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    await editSource(workspace, RENAME_B_PATH, B_EDIT_FROM, B_EDIT_TO);
    await editSource(workspace, RENAME_A_PATH, A_REFERENCE, A_UNRESOLVED);
    const staged = await snapshotWorkspace(workspace.root);
    const result = await runStaged(
      product,
      workspace,
      ["ids", "--json"],
      refusalUnder(GRAPH_DATA_AREA),
      context,
    );
    assertExitCode(
      result,
      1,
      `${context} — the gate of 13.3 turns the read back with the ` +
        `workspace's findings, exit 1: nothing is written on a failing ` +
        `workspace, so no write is refused (SPEC 13.3, 14.24, 12.0)`,
    );
    assertConditionCounts(
      decodeFindingsReport(parseJsonStdout(result, context), context).findings,
      { "14.5": 1 },
      `${context} — exactly the staged condition, A's unresolved \`d\` ` +
        `reference (SPEC 14.5, 13.3)`,
    );
    assertSnapshotsEqual(
      staged,
      await snapshotWorkspace(workspace.root),
      `${context}: nothing written on the failing workspace (SPEC 13.3)`,
    );
    // Recovery: the harness's own invalidity reverted, then `build`/`check`.
    await editSource(workspace, RENAME_A_PATH, A_UNRESOLVED, A_REFERENCE);
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Precedence, a validation refusal under (a)'s staging: an
 * identity-unchanged rename (T6.4-3) with `specs/b` staged unwritable at the
 * seam exits 1 with its refusal reported alone — exactly one finding,
 * `refused-identity-unchanged` — and attempts no write: the workspace
 * byte-unchanged (6.4, 13.5).
 */
async function validationRefusalArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 precedence: `rename specs/b/B.mdx b b --json` refused by validation with specs/b unwritable";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const result = await runHeldWithStaging(
      product,
      workspace,
      ["rename", RENAME_B_PATH, "b", "b", "--json"],
      "hold-t14-9-refused.tmp",
      refusalUnder(RENAME_B_DIR),
      context,
    );
    assertExitCode(
      result,
      1,
      `${context} — an identity-unchanged rename is refused by validation: ` +
        `exit 1 with its refusal, before any write (SPEC 6.4, 12.0, 14.24)`,
    );
    const findings = decodeFindingsReport(
      parseJsonStdout(result, context),
      context,
    ).findings;
    const codes = findings.map((finding) => finding.code);
    if (codes.length !== 1 || codes[0] !== "refused-identity-unchanged") {
      fail(
        `${context} — the refusal is reported alone: exactly one finding, ` +
          `its stable code \`refused-identity-unchanged\`, never a write ` +
          `failure beside it (SPEC 6.4, 14); got ${JSON.stringify(codes)}`,
      );
    }
    assertSnapshotsEqual(
      prepared.before,
      await snapshotWorkspace(workspace.root),
      `${context}: no write attempted — the refused rename modifies ` +
        `nothing (SPEC 6.4, 13.5)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Precedence, the hold file: `--test-hold` naming a path in a read-only
 * directory (staged under T14-9's path-form discipline, beside the
 * workspace) — the hold file cannot be created, 13.5's usage error: exit 2,
 * the error document with `code` null, never this condition; nothing
 * modified.
 */
async function holdFileArm(product: ProductBinding): Promise<void> {
  const context =
    "T14-9 precedence: `rename specs/b/B.mdx b b2 --test-hold <read-only directory>/hold.tmp --json`";
  const prepared = await prepareRefusalWorkspace(
    product,
    RENAME_FIXTURE,
    context,
  );
  const { workspace } = prepared;
  try {
    const holdDir = path.join(workspace.tempRoot, "t14-9-read-only");
    await fsp.mkdir(holdDir);
    const hold = path.join(holdDir, "hold.tmp");
    const staging = await stageWriteRefusal(hold);
    try {
      expectPlainUsageError(
        await runSettled(
          product,
          workspace,
          [...RENAME_B_TO_B2, "--test-hold", hold],
          context,
        ),
        "a hold file that cannot be created — the usage error of 13.5, " +
          "never a write of 14.24 (SPEC 13.5, 14.24)",
        context,
      );
    } finally {
      await staging.restore();
    }
    assertSnapshotsEqual(
      prepared.before,
      await snapshotWorkspace(workspace.root),
      `${context}: nothing modified — the hold file is created before any ` +
        `modification, and its failure stops the command (SPEC 13.5)`,
    );
    await assertRecovers(product, workspace, context);
  } finally {
    await workspace.dispose();
  }
}

// ---------------------------------------------------------------------------
// T14-9 — write failures (14.24)
// ---------------------------------------------------------------------------

const T14_9 = defineProductTest({
  id: "T14-9",
  title:
    "write failures (14.24): a write the environment refuses is a usage error — exit 2, the error document (`code` `write-failure`, `path` the concerned path) on stdout, the diagnostic on stderr, never a finding — from every command making the write and met only at the write it refuses; one arm per concerned path through T13.5-7's stagings: a derived path under specs/b/ (`build`), an emitted Markdown file under out/specs (`move`), the rewritten source specs/b/B.mdx and the journal (`rename`), the session file (`review resolve`), a relocation's origin removal and destination production (`move`), and the graph-data area `.xspec` from every refreshing read of 13.3 and `review create` on a stale workspace — while `check` exits 1 with the staleness, `inventory` and `version` exit 0, and a `--preview` exits 0 writing nothing; precedence: the invalid-flag-value and unknown-node usage errors (`code` null), the failing twin's findings (`ids` exit 1), a validation refusal under (a)'s staging (exit 1, no write), and a hold file in a read-only directory (13.5's usage error, `code` null); after every arm, permissions restored, `build` exits 0 and `check` is clean (SPEC 14.24, 12.0, 12.7, 13.3, 13.5)",
  // A hang guard only (H-10): eleven workspaces, each built, renamed,
  // checked, committed, and driven — generous under a saturated box.
  timeoutMs: 600_000,
  run: async (product) => {
    // E-1: permission stagings belong to the Linux leg; elsewhere the arms
    // are not staged (the NU3_STAGED pattern of section-11.5) and no other
    // leg selects T14-9 (E-6).
    if (!WRITE_REFUSALS_STAGED) return;
    await rewrittenSourceArm(product);
    await journalArm(product);
    await markdownArm(product);
    await originRemovalArm(product);
    await destinationProductionArm(product);
    await sessionFileArm(product);
    await derivedPathArm(product);
    await reportersArm(product);
    await failingTwinArm(product);
    await validationRefusalArm(product);
    await holdFileArm(product);
  },
});

/** TEST-SPEC §14 II — T14-9, in canonical ID order (SUITE-49). */
export const section14iiTests: readonly ProductTestEntry[] = [T14_9];
