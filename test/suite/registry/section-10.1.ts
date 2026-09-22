// TEST-SPEC §10.1 (review sessions) — SUITE-33: T10.1-1…T10.1-6.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), and rejects a product only via diagnosed
// assertion failures (H-8).
//
// SPEC 10.1: a session lives at `.xspec/reviews/<name>.json` as a plain,
// deterministic file; names are one or more of `A–Z a–z 0–9 . _ -`, never
// beginning with `.`; names are case-sensitive everywhere except `create`'s
// ASCII-case-insensitive existing-name refusal; only a file directly under
// `.xspec/reviews/` named `<valid-name>.json` is a session — anything else
// there is ignored by every command; a session file that is not a plain file,
// cannot be parsed, or violates a session invariant is corrupt (14.21).
//
// Conservative operationalizations (noted per H-3/H-4):
// - "writes exactly `.xspec/reviews/<name>.json` and nothing else" is a
//   whole-workspace byte-state diff around `create` (H-4): the only tolerated
//   additions besides the session file are its parent directory entries
//   (`.xspec`, `.xspec/reviews`), which must exist for the file to. On the
//   stale-workspace arm the tolerated set widens to entries under `.xspec/`
//   outside `.xspec/reviews/` — the 13.3 graph-data refresh, whose content is
//   opaque (H-4) — while everything outside `.xspec/` (generated TypeScript
//   and Markdown included) and every other session must stay byte-identical.
// - "reports the corruption" (T10.1-4): 12.0 classes `review` subcommands
//   naming a corrupt session as exit-1 findings, and findings are reports —
//   standard-output content; SPEC.md's fixed vocabulary for the state is
//   "corrupt" (10.1, 10.7, 14.21). Operationalized as exit 1 with stdout
//   matching /corrupt/i (information presence, never exact wording, H-3).
// - "modifies nothing" is a whole-workspace snapshot compare around each
//   command (H-4); the compares run with fresh graph data, so no 13.3
//   refresh legitimately intervenes.
// - The directory/symlink occupant states name a placeholder item id in
//   `show`/`resolve`/`split`: 10.1 is categorical — every `review` subcommand
//   naming a corrupt session reports the corruption and exits 1 — and an
//   unreadable session has no item list to resolve an id against.
// - Single-casing probes (`status Foo` against only `foo` on disk; `status
//   NAME` against only `NAME.JSON`) stage exactly one casing, so the
//   Windows-leg rerun (E-6; implemented by CI-01 in test/windows/) meets a
//   case-insensitive filesystem with the discriminating state intact.
// - T10.1-5's gate probes (SPEC 13.3): "report exactly the gate's findings"
//   is exit 1 with stdout the single form-exact 12.7 findings report holding
//   exactly the staged validation finding — for `review list`, that same
//   one-member decode realizes "the gate's report replaces the per-session
//   report whole" (SPEC 10.7): a document carrying session rows fails it.
//   The `show`/`resolve`/`split` probes pass an item ID no session ever
//   held: an item ID is judged only against its session's content (SPEC
//   12.0), which no gated command reads on a failing workspace (13.3), so
//   the probes must gate identically whatever the ID.
//
// T10.1-4 staging is blackbox (H-3): every shape-dependent corrupt fixture
// starts from a session file the product itself wrote and is corrupted
// through the adapter layer's shape-aware, value-blind transformations
// (helpers/adapters/session-staging.ts); only shape-independent states —
// unparseable bytes, truncation, a directory or symlink at the path — are
// staged directly. The harness never writes a session file from an assumed
// layout. The malformed-creation-parameters state uses a `coverage` session:
// it records the profile's resolved definition, where an `audit` session
// records none (SPEC 10.7), so there is a recorded value to garble. The
// malformed-recorded-decompositions state first has the product perform a
// `split` — the decomposition is recorded durably in the session (SPEC 10.7)
// — so the garbled member holds a genuine product-recorded decomposition.
//
// T10.1-6 (session-directory and area occupancy; `create`'s ordering):
// - Non-directory occupants are staged at `.xspec/reviews` and at `.xspec`
//   as a plain file and, separately, as a symbolic link to a real directory
//   holding product-written content (a valid session `s.json`; a journal,
//   graph data, and a valid session) — the staging the product must not
//   list, read, or write through (SPEC 10.1, 13.4). The link's target lives
//   inside the workspace root, outside the area, so one whole-root snapshot
//   compare covers the occupant, the link, and its target at once (H-4:
//   "byte-unchanged", "byte-identical", "nothing written through it").
//   Symbolic links are never followed by the snapshot (helpers/snapshot.ts),
//   so a product writing through the link changes the target's entries.
// - "graph data has been refreshed" is observed the way SPEC.md defines it
//   (13.3, 14.10): `check` afterwards reports no graph-data unit form —
//   graph-data content is opaque (H-4), so its bytes are never compared.
//   The per-file staleness `check` reports is the edited source's: every
//   14.10 finding concerns a derived path of `specs/A.mdx` — `specs/A.xspec.`
//   plus a suffix, the module and its companions (SPEC 13.1) — and the
//   module itself is among them, since it embeds the edited text (SPEC 4.2).
// - `review status s` against the occupied session directory is an unknown
//   session — a plain usage error, so the exit-2 error document's `code` and
//   `path` are `null` (SPEC 12.0, 12.7).
// - The concerned path of the code-less existing-name refusal and of the
//   condition-21 finding reported in its place is pinned nowhere (SPEC 10.7,
//   14.21), so only their identity, count, and empty locations are asserted.

import * as fsp from "node:fs/promises";
import type {
  Finding,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import {
  GRAPH_DATA_AREA_PATH,
  assertReportMentions,
  decodeFindingsReport,
  decodeIdsReport,
  decodeInventoryDocument,
  decodeSessionListReport,
  decodeSessionStatusReport,
  decodeViewReport,
  stageBlockedByAbsentItem,
  stageBlockedByCycle,
  stageDeleteItemField,
  stageDuplicateItemEntry,
  stageGarbleCreationParameters,
  stageGarbleDecompositions,
  stageUnknownItemStatus,
} from "../../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import {
  assertLeavesUnchanged,
  diffSnapshots,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertFindingConcernsPath,
  assertFindingLocated,
  assertSameJson,
  buildOk,
  expectErrorDocument,
  expectExit,
  expectFindingFreeReport,
  runCli,
  runFindingsReport,
  runJson,
} from "./support.js";

// Minimal declarative configuration (SPEC 7): exactly one spec group.
const SPECS_ONLY_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

// The same spec group plus one coverage profile (SPEC 7.4) for the
// coverage-session arm of T10.1-4: `main`'s one leaf has no incoming
// dependency edge, so the profile leaves it uncovered and `create --coverage`
// derives at least one item while recording the profile definition.
const COVERAGE_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  coverage: [
    {
      name: "p",
      target: "main",
      boundary: "main",
      mode: "direct"
    }
  ]
})
`;

const A_MDX = [
  '<S id="a">',
  "Alpha text.",
  '<S id="a.k">',
  "Kid text.",
  "</S>",
  "</S>",
  "",
].join("\n");

// The staleness edit for T10.1-1: same structure, different leaf text — the
// graph data written by the earlier `build` no longer matches the sources.
const A_MDX_EDITED = A_MDX.replace("Kid text.", "Kid text, edited.");

const CORE_FILES: Readonly<Record<string, string>> = {
  "xspec.config.ts": SPECS_ONLY_CONFIG,
  "specs/A.mdx": A_MDX,
};

const COVERAGE_FILES: Readonly<Record<string, string>> = {
  "xspec.config.ts": COVERAGE_CONFIG,
  "specs/A.mdx": A_MDX,
};

const REVIEWS_DIR = ".xspec/reviews";

/** The session file's workspace-relative path (SPEC 10.1). */
function sessionRel(name: string): string {
  return `${REVIEWS_DIR}/${name}.json`;
}

/** Stage a fresh workspace, run `body`, dispose (H-1). */
async function withWorkspace<T>(
  files: Readonly<Record<string, string>>,
  body: (workspace: TestWorkspace) => Promise<T>,
): Promise<T> {
  const workspace = await TestWorkspace.create({ files });
  try {
    return await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Read a session file's exact bytes, failing diagnosed (H-8) when the path
 * does not hold a plain file (SPEC 10.1, 13.4: a session is a plain file).
 */
async function readSessionBytes(
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<Uint8Array> {
  const rel = sessionRel(name);
  const kind = await workspace.kind(rel);
  if (kind !== "file") {
    fail(
      `${context}: expected the session as a plain file at ${rel} ` +
        `(SPEC 10.1, 13.4); found ${kind}`,
    );
  }
  return await workspace.readBytes(rel);
}

/**
 * Assert the session file is plain and parseable as exactly one JSON document
 * (SPEC 10.1) — the whole file is one `JSON.parse` input, so concatenated
 * documents or trailing garbage fail.
 */
async function assertSessionIsOneJsonDocument(
  workspace: TestWorkspace,
  name: string,
  context: string,
): Promise<void> {
  const bytes = await readSessionBytes(workspace, name, context);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(
      `${context}: the session file at ${sessionRel(name)} is not valid ` +
        `UTF-8, so it is not parseable as a single JSON document (SPEC 10.1)`,
    );
  }
  try {
    JSON.parse(text);
  } catch (error) {
    fail(
      `${context}: the session file at ${sessionRel(name)} must be ` +
        `parseable as a single JSON document (SPEC 10.1): ` +
        `${(error as Error).message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// T10.1-1 — storage
// ---------------------------------------------------------------------------

const T10_1_1 = defineProductTest({
  id: "T10.1-1",
  title:
    "`review create` on a freshly built workspace writes exactly `.xspec/reviews/<name>.json` and nothing else (whole-workspace byte-state diff); on a stale workspace it additionally performs the 13.3 graph-data refresh — writes confined to `.xspec/` outside `.xspec/reviews/`, no TypeScript or Markdown regenerated; the file is plain, parseable as one JSON document, and deterministic across two identical fixtures (SPEC 10.1, 13.3, 13.4)",
  run: async (product) => {
    await withWorkspace(CORE_FILES, async (workspace) => {
      await buildOk(product, workspace, "T10.1-1 `build`");

      // Fresh arm: the diff around `create` holds the session file and, at
      // most, its parent directory entries — nothing else (SPEC 10.1; the
      // workspace is freshly built, so no 13.3 refresh applies).
      const sessionKey = sessionRel("r1");
      const preFresh = await snapshotDirectory(workspace.root);
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "r1"],
        0,
        "T10.1-1 `review create --strategy audit --name r1` on the freshly built workspace",
      );
      const postFresh = await snapshotDirectory(workspace.root);
      const freshChanges = diffSnapshots(preFresh, postFresh);
      const allowedAdditions = new Set([".xspec", REVIEWS_DIR, sessionKey]);
      for (const change of freshChanges) {
        if (change.change !== "added" || !allowedAdditions.has(change.key)) {
          fail(
            `T10.1-1: on a freshly built workspace \`review create\` writes ` +
              `exactly ${sessionKey} and nothing else — its parent directory ` +
              `entries are the only tolerated additions (SPEC 10.1; H-4 ` +
              `byte-state diff); found ${change.change} ${change.path}: ` +
              change.detail,
          );
        }
      }
      if (!freshChanges.some((change) => change.key === sessionKey)) {
        fail(
          `T10.1-1: \`review create --name r1\` exited 0 but created no ` +
            `entry at ${sessionKey} (SPEC 10.1: a session is stored at ` +
            `.xspec/reviews/<session-name>.json)`,
        );
      }
      await assertSessionIsOneJsonDocument(
        workspace,
        "r1",
        "T10.1-1 the created session file",
      );

      // Stale arm: edit a source so the graph data no longer matches, then
      // create again. The additional writes are the 13.3 graph-data refresh —
      // confined to `.xspec/` outside `.xspec/reviews/` (graph-data content
      // is opaque, H-4): no TypeScript or Markdown is generated or removed
      // (everything outside `.xspec/` stays byte-identical) and the existing
      // session r1 is untouched.
      await workspace.file("specs/A.mdx", A_MDX_EDITED);
      const session2Key = sessionRel("r2");
      const preStale = await snapshotDirectory(workspace.root);
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "r2"],
        0,
        "T10.1-1 `review create --strategy audit --name r2` on the stale workspace",
      );
      const postStale = await snapshotDirectory(workspace.root);
      const staleChanges = diffSnapshots(preStale, postStale);
      let session2Added = false;
      for (const change of staleChanges) {
        if (change.key === session2Key) {
          if (change.change !== "added") {
            fail(
              `T10.1-1 stale arm: expected ${session2Key} to be added, ` +
                `found ${change.change}: ${change.detail}`,
            );
          }
          session2Added = true;
          continue;
        }
        const underXspec =
          change.key === ".xspec" || change.key.startsWith(".xspec/");
        const underReviews =
          change.key === REVIEWS_DIR ||
          change.key.startsWith(`${REVIEWS_DIR}/`);
        if (!underXspec || underReviews) {
          fail(
            `T10.1-1 stale arm: \`review create\` on a stale workspace ` +
              `writes the session file plus the 13.3 graph-data refresh — ` +
              `refresh writes are confined to .xspec/ outside ` +
              `.xspec/reviews/: no TypeScript or Markdown is generated or ` +
              `removed and no other session is touched (SPEC 10.1, 13.3); ` +
              `found ${change.change} ${change.path}: ${change.detail}`,
          );
        }
      }
      if (!session2Added) {
        fail(
          `T10.1-1 stale arm: \`review create --name r2\` exited 0 but ` +
            `created no entry at ${session2Key} (SPEC 10.1)`,
        );
      }
      await assertSessionIsOneJsonDocument(
        workspace,
        "r2",
        "T10.1-1 the second session file (stale-workspace arm)",
      );
    });

    // Determinism arm (H-6, two-directory form): two identical fixtures,
    // identically built and created — the session files are byte-identical
    // (SPEC 10.1 "plain, deterministic"; 12.0: no wall clock, no randomness,
    // no absolute paths in stored data).
    const first = await TestWorkspace.create({ files: CORE_FILES });
    const second = await TestWorkspace.create({ files: CORE_FILES });
    try {
      const directories: readonly (readonly [string, TestWorkspace])[] = [
        ["directory 1", first],
        ["directory 2", second],
      ];
      for (const [label, workspace] of directories) {
        await buildOk(
          product,
          workspace,
          `T10.1-1 determinism arm \`build\` in ${label}`,
        );
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", "r1"],
          0,
          `T10.1-1 determinism arm \`review create --strategy audit --name r1\` in ${label}`,
        );
      }
      assertBytesEqual(
        await readSessionBytes(
          second,
          "r1",
          "T10.1-1 determinism arm, directory 2",
        ),
        await readSessionBytes(
          first,
          "r1",
          "T10.1-1 determinism arm, directory 1",
        ),
        "T10.1-1: two identical fixtures yield byte-identical session files " +
          "(SPEC 10.1 deterministic; H-6 two-directory protocol — the " +
          "directories differ only in their absolute paths, which never " +
          "enter stored data, SPEC 12.0)",
      );
    } finally {
      await first.dispose();
      await second.dispose();
    }
  },
});

// ---------------------------------------------------------------------------
// T10.1-2 — names
// ---------------------------------------------------------------------------

/**
 * T10.1-2's single-casing session-name probe over an already-built workspace
 * where the name `foo` is free — one shared code path, called by the
 * registered T10.1-2 body on the suite leg and by the Windows-leg wrapper
 * (TEST-SPEC E-6; test/windows/e6-subset.test.ts). Only `foo` ever exists on
 * disk, so the fixture stages identically on any filesystem; on a
 * case-insensitive one it exposes a product matching session names via
 * filesystem lookup (`status Foo` must be exit 2, SPEC 10.1, 12.0).
 */
export async function probeSessionNameCasing(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  await expectExit(
    product,
    workspace,
    ["review", "create", "--strategy", "audit", "--name", "foo"],
    0,
    "T10.1-2 `review create --strategy audit --name foo`",
  );
  await expectExit(
    product,
    workspace,
    ["review", "status", "foo"],
    0,
    "T10.1-2 control: `review status foo` finds the session under its exact name (SPEC 10.1)",
  );
  const probeContext =
    "T10.1-2 `review status Foo --json` — names are case-sensitive for " +
    "all subcommands, so `Foo` names no session: an unknown session is " +
    "a usage error (SPEC 10.1, 12.0; single-casing probe, rerun on the " +
    "Windows leg per E-6/CI-01)";
  const probe = await expectExit(
    product,
    workspace,
    ["review", "status", "Foo", "--json"],
    2,
    probeContext,
  );
  expectErrorDocument(
    probe,
    `${probeContext} — under --json, the exit-2 error document is the ` +
      `entire stdout (SPEC 12.0, 12.7, H-5)`,
  );
}

/**
 * Self-contained staging of {@link probeSessionNameCasing} for the Windows
 * leg (E-6/CI-01): fresh workspace, `build`, then the shared probe.
 */
export async function runT1012SessionNameCasingProbe(
  product: ProductBinding,
): Promise<void> {
  await withWorkspace(CORE_FILES, async (workspace) => {
    await buildOk(product, workspace, "T10.1-2 casing probe `build`");
    await probeSessionNameCasing(product, workspace);
  });
}

const T10_1_2 = defineProductTest({
  id: "T10.1-2",
  title:
    "session names: the full `A–Z a–z 0–9 . _ -` alphabet is accepted; `/`, whitespace, empty, leading `.`, and non-ASCII names are usage errors (exit 2, nothing created); names are case-sensitive for every subcommand (`status Foo` does not find `foo` — single-casing probe, rerun on the Windows leg via CI-01) while `create` refuses a name matching an existing session ignoring ASCII case (exit 1, nothing created) (SPEC 10.1, 10.7, 12.0)",
  run: async (product) => {
    await withWorkspace(CORE_FILES, async (workspace) => {
      await buildOk(product, workspace, "T10.1-2 `build`");

      // Invalid names: usage error, exit 2, nothing created (SPEC 10.1,
      // 12.0). Byte-state compare around each attempt realizes "nothing
      // created"; with --json, exit 2 emits no JSON document (H-5).
      const invalidNames: readonly (readonly [string, string])[] = [
        ["a/b", "a path separator"],
        ["a b", "whitespace"],
        ["", "the empty name"],
        [".a", "a leading `.`"],
        ["é", "a non-ASCII character (U+00E9)"],
      ];
      for (const [name, why] of invalidNames) {
        const context = `T10.1-2 \`review create --strategy audit --name ${JSON.stringify(name)} --json\` (invalid name: ${why})`;
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await expectExit(
              product,
              workspace,
              [
                "review",
                "create",
                "--strategy",
                "audit",
                "--name",
                name,
                "--json",
              ],
              2,
              `${context} — an invalid session name is a usage error (SPEC 10.1, 12.0)`,
            );
            expectErrorDocument(
              result,
              `${context} — under --json, the exit-2 error document is the ` +
                `entire stdout (SPEC 12.0, 12.7, H-5)`,
            );
          },
          `${context} — nothing created`,
        );
      }

      // Valid names: one name drawing on all four character classes (and
      // interior `.`), one bare digit. Each create succeeds and stores the
      // session at .xspec/reviews/<name>.json as a plain file.
      for (const name of ["Az09._-", "0"]) {
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", name],
          0,
          `T10.1-2 \`review create --strategy audit --name ${name}\` (valid name)`,
        );
        const kind = await workspace.kind(sessionRel(name));
        if (kind !== "file") {
          fail(
            `T10.1-2: after \`create --name ${name}\`, expected a plain ` +
              `session file at ${sessionRel(name)} (SPEC 10.1); found ${kind}`,
          );
        }
      }

      // Case rules. Single-casing probe: only `foo` ever exists on disk in
      // this workspace (the refused creates below create nothing), so the
      // Windows-leg rerun (E-6, CI-01) meets a case-insensitive filesystem
      // with exactly one casing present — exposing a product that matches
      // session names via filesystem lookup. Shared code path with that
      // rerun.
      await probeSessionNameCasing(product, workspace);

      // `create` alone folds ASCII case when checking for an existing
      // session: `FOO` matches `foo`, is treated as an existing session, and
      // is refused — exit 1 (a refused operation, SPEC 10.7, 12.0), nothing
      // created, `foo`'s file byte-identical.
      await assertLeavesUnchanged(
        workspace.root,
        async () => {
          await expectExit(
            product,
            workspace,
            ["review", "create", "--strategy", "audit", "--name", "FOO"],
            1,
            "T10.1-2 `review create --strategy audit --name FOO` — a name " +
              "matching existing `foo` ignoring ASCII case is treated as an " +
              "existing session and refused: exit 1 (SPEC 10.1, 10.7, 12.0)",
          );
        },
        "T10.1-2 the refused `create --name FOO` modifies nothing — no " +
          "FOO.json appears and foo.json stays byte-identical (SPEC 10.1)",
      );
    });
  },
});

// ---------------------------------------------------------------------------
// T10.1-3 — non-session files
// ---------------------------------------------------------------------------

// Deliberately unparseable content for every staged non-session file: a
// product that wrongly treats one as a session would classify it corrupt —
// caught by the list/check assertions below.
const NON_SESSION_GARBAGE = "not a session { this is deliberately not JSON [\n";

// The wrong-case-extension non-session (T10.1-3): staged in exactly this one
// casing — no NAME.json exists anywhere — so the fixture stages identically
// on any filesystem (E-6).
const WRONG_CASE_SESSION_FILE = `${REVIEWS_DIR}/NAME.JSON`;

/**
 * T10.1-3's wrong-case-extension probe over a workspace where
 * {@link WRONG_CASE_SESSION_FILE} is staged — one shared code path, called by
 * the registered T10.1-3 body on the suite leg and by the Windows-leg wrapper
 * (TEST-SPEC E-6; test/windows/e6-subset.test.ts). Only a file named
 * `<valid-name>.json` is a session and paths compare byte-wise (SPEC 10.1,
 * 12.0), so `NAME.JSON` is not one: `status NAME` is exit 2 (unknown session)
 * even where a case-insensitive filesystem lookup would find the file.
 */
export async function probeWrongCaseExtensionSession(
  product: ProductBinding,
  workspace: TestWorkspace,
): Promise<void> {
  const context =
    'T10.1-3 `review status "NAME" --json` — exit 2 unknown session: ' +
    "NAME.JSON is not a session, paths compare byte-wise (SPEC 10.1, 12.0; " +
    "single-casing probe, rerun on the Windows leg per E-6/CI-01)";
  const result = await expectExit(
    product,
    workspace,
    ["review", "status", "NAME", "--json"],
    2,
    context,
  );
  expectErrorDocument(
    result,
    `${context} — under --json, the exit-2 error document is the entire ` +
      `stdout (SPEC 12.0, 12.7, H-5)`,
  );
}

/**
 * Self-contained staging of {@link probeWrongCaseExtensionSession} for the
 * Windows leg (E-6/CI-01): fresh workspace, `build`, a real session as the
 * served-session control, the staged `NAME.JSON` stray, then the shared
 * probe.
 */
export async function runT1013WrongCaseExtensionProbe(
  product: ProductBinding,
): Promise<void> {
  await withWorkspace(CORE_FILES, async (workspace) => {
    await buildOk(product, workspace, "T10.1-3 wrong-case probe `build`");
    await expectExit(
      product,
      workspace,
      ["review", "create", "--strategy", "audit", "--name", "real"],
      0,
      "T10.1-3 wrong-case probe `review create --strategy audit --name real`",
    );
    await workspace.file(WRONG_CASE_SESSION_FILE, NON_SESSION_GARBAGE);
    await expectExit(
      product,
      workspace,
      ["review", "status", "real"],
      0,
      "T10.1-3 wrong-case probe control: `review status real` — sessions " +
        "resolve with the stray present, so the probe's exit 2 below is " +
        "attributable to the extension's casing alone (SPEC 10.1)",
    );
    await probeWrongCaseExtensionSession(product, workspace);
  });
}

const T10_1_3 = defineProductTest({
  id: "T10.1-3",
  title:
    'non-session files under `.xspec/reviews/` — a stray `notes.txt`, a subdirectory (with a nested .json), invalid-stem `.foo.json` and `a b.json`, and wrong-case `NAME.JSON` — are ignored by `list` (neither sessions nor corrupt, exit 0), `check` (no 14.21), and every subcommand; naming them finds no session: `status .foo`/`status "a b"` exit 2 invalid name, `status NAME` exit 2 unknown session (single-casing probe, rerun on the Windows leg via CI-01) (SPEC 10.1, 12.0, 14.21)',
  run: async (product) => {
    await withWorkspace(CORE_FILES, async (workspace) => {
      await buildOk(product, workspace, "T10.1-3 `build`");
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "real"],
        0,
        "T10.1-3 `review create --strategy audit --name real`",
      );

      // Stage the non-session entries beside the real session. NAME.JSON is
      // staged in a single casing — no NAME.json exists anywhere (E-6).
      await workspace.file(`${REVIEWS_DIR}/notes.txt`, NON_SESSION_GARBAGE);
      await workspace.dir(`${REVIEWS_DIR}/sub`);
      await workspace.file(
        `${REVIEWS_DIR}/sub/inner.json`,
        NON_SESSION_GARBAGE,
      );
      await workspace.file(`${REVIEWS_DIR}/.foo.json`, NON_SESSION_GARBAGE);
      await workspace.file(`${REVIEWS_DIR}/a b.json`, NON_SESSION_GARBAGE);
      await workspace.file(WRONG_CASE_SESSION_FILE, NON_SESSION_GARBAGE);

      // `list`: exactly the one real session — the strays are reported
      // neither as sessions nor as corrupt — and exit 0, since exit 1 is
      // reserved for an existing corrupt session (SPEC 10.1, 10.7).
      const listLabel = "T10.1-3 `review list --json`";
      const listResult = await expectExit(
        product,
        workspace,
        ["review", "list", "--json"],
        0,
        `${listLabel} — no session is corrupt (non-session files are ignored), so \`list\` exits 0 (SPEC 10.1, 10.7)`,
      );
      const list = decodeSessionListReport(
        parseJsonStdout(listResult, listLabel),
        listLabel,
      );
      assertSameJson(
        list.sessions.map(({ name, corrupt }) => ({ name, corrupt })),
        [{ name: "real", corrupt: false }],
        `${listLabel}: exactly the one real session — the stray file, ` +
          `subdirectory, nested .json, invalid-stem .json files, and ` +
          `wrong-case NAME.JSON are neither sessions nor corrupt (SPEC 10.1)`,
      );

      // `check`: no 14.21 — the workspace is freshly built and otherwise
      // clean, so with every stray correctly ignored `check` has no finding
      // at all and exits 0 (SPEC 10.1, 12.2, 14.21).
      await expectExit(
        product,
        workspace,
        ["check", "--json"],
        0,
        "T10.1-3 `check --json` — non-session files under .xspec/reviews/ " +
          "are no 14.21 finding (SPEC 10.1, 14.21); the workspace is " +
          "otherwise clean, so `check` exits 0",
      );

      // Naming the non-sessions finds no session (SPEC 10.1, 12.0): invalid
      // names are usage errors before any lookup; `NAME` is a valid name but
      // names no session, since NAME.JSON's extension differs byte-wise —
      // that arm is the shared single-casing probe rerun on the Windows leg
      // (E-6/CI-01).
      const namingProbes: readonly (readonly [string, string])[] = [
        [".foo", "exit 2 invalid session name (leading `.`)"],
        ["a b", "exit 2 invalid session name (whitespace)"],
      ];
      for (const [name, why] of namingProbes) {
        const context = `T10.1-3 \`review status ${JSON.stringify(name)} --json\` — ${why}`;
        const result = await expectExit(
          product,
          workspace,
          ["review", "status", name, "--json"],
          2,
          context,
        );
        expectErrorDocument(
          result,
          `${context} — under --json, the exit-2 error document is the ` +
            `entire stdout (SPEC 12.0, 12.7, H-5)`,
        );
      }
      await probeWrongCaseExtensionSession(product, workspace);

      // Ignored by every subcommand: the real session is served unaffected,
      // and a session named after the stray's stem is creatable — notes.txt
      // is not a session, so the name `notes` is free (SPEC 10.1).
      await expectExit(
        product,
        workspace,
        ["review", "status", "real"],
        0,
        "T10.1-3 `review status real` — the real session is served unaffected by the strays",
      );
      await expectExit(
        product,
        workspace,
        ["review", "export", "real"],
        0,
        "T10.1-3 `review export real` — unaffected by the strays",
      );
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "notes"],
        0,
        "T10.1-3 `review create --strategy audit --name notes` — " +
          "notes.txt is not a session, so the name is free (SPEC 10.1)",
      );
      const list2Label = "T10.1-3 `review list --json` after creating `notes`";
      const list2Result = await expectExit(
        product,
        workspace,
        ["review", "list", "--json"],
        0,
        list2Label,
      );
      const list2 = decodeSessionListReport(
        parseJsonStdout(list2Result, list2Label),
        list2Label,
      );
      assertSameJson(
        list2.sessions.map(({ name, corrupt }) => ({ name, corrupt })),
        [
          { name: "notes", corrupt: false },
          { name: "real", corrupt: false },
        ],
        `${list2Label}: both real sessions in byte order of name, strays still ignored (SPEC 10.1, 10.7)`,
      );
    });
  },
});

// ---------------------------------------------------------------------------
// T10.1-4 — corruption
// ---------------------------------------------------------------------------

// Item id passed to `show`/`resolve`/`split` for the occupant states, whose
// session cannot be read at all: 10.1's contract is categorical (corruption
// is reported whatever item the arguments name), so any plausible id serves.
const PLACEHOLDER_ITEM_ID = "item-1";

/** The corrupt session's name in every T10.1-4 staging. */
const CORRUPT_NAME = "cor";

/**
 * Decode `review status <cor> --json` and require at least one item — the
 * pre-corruption read of a product-written session.
 */
async function readSessionItems(
  product: ProductBinding,
  workspace: TestWorkspace,
  label: string,
): Promise<readonly SessionStatusRow[]> {
  const status = decodeSessionStatusReport(
    await runJson(
      product,
      workspace,
      ["review", "status", CORRUPT_NAME, "--json"],
      label,
    ),
    label,
  );
  if (status.items.length === 0) {
    fail(
      `${label}: staging premise — the session must hold at least one item ` +
        `for the corruption transformations and the item-naming subcommands ` +
        `(SPEC 10.5–10.7); got none`,
    );
  }
  return status.items;
}

/**
 * Build, create the session via the given argv, and capture one item id from
 * `status --json` before the file is corrupted.
 */
async function stageProductSession(
  product: ProductBinding,
  workspace: TestWorkspace,
  createArgv: readonly string[],
  context: string,
): Promise<string> {
  await buildOk(product, workspace, `${context} \`build\``);
  await expectExit(
    product,
    workspace,
    createArgv,
    0,
    `${context} \`${createArgv.join(" ")}\``,
  );
  const items = await readSessionItems(
    product,
    workspace,
    `${context} \`review status ${CORRUPT_NAME} --json\` (pre-corruption item-id capture)`,
  );
  return items[0].id;
}

/** What `review list` must report for a staged corrupt state. */
interface ExpectedSessionEntry {
  readonly name: string;
  readonly corrupt: boolean;
}

/**
 * The full T10.1-4 contract for one staged corrupt state: every `review`
 * subcommand naming the session reports the corruption (exit 1, /corrupt/i
 * on stdout — see the module header) and modifies nothing (whole-workspace
 * snapshot compare); `list` reports the session corrupt in place of its
 * fields and exits 1; `check` reports condition 14.21.
 */
async function assertCorruptSessionContract(
  product: ProductBinding,
  workspace: TestWorkspace,
  state: string,
  itemId: string,
  expectedSessions: readonly ExpectedSessionEntry[],
): Promise<void> {
  const namingSubcommands: readonly (readonly string[])[] = [
    ["review", "status", CORRUPT_NAME],
    ["review", "next", CORRUPT_NAME],
    ["review", "show", CORRUPT_NAME, itemId],
    ["review", "export", CORRUPT_NAME],
    ["review", "resolve", CORRUPT_NAME, itemId, "--status", "updated"],
    ["review", "split", CORRUPT_NAME, itemId],
  ];
  for (const argv of namingSubcommands) {
    const context = `T10.1-4 [${state}] \`${argv.join(" ")}\``;
    await assertLeavesUnchanged(
      workspace.root,
      async () => {
        const result = await runCli(product, workspace, argv);
        assertExitCode(
          result,
          1,
          `${context} — every review subcommand naming a corrupt session ` +
            `reports the corruption and exits 1 (SPEC 10.1, 14.21; ` +
            `findings-class outcome, 12.0)`,
        );
        assertReportMentions(
          result,
          [/corrupt/i],
          `${context} — the report identifies the session as corrupt ` +
            `(SPEC 10.1/14.21 vocabulary; findings are standard-output ` +
            `content, 12.0; information presence, never exact wording, H-3)`,
        );
      },
      `${context} — a review subcommand naming a corrupt session modifies nothing (SPEC 10.1)`,
    );
  }

  const listContext = `T10.1-4 [${state}] \`review list --json\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await runCli(product, workspace, [
        "review",
        "list",
        "--json",
      ]);
      assertExitCode(
        result,
        1,
        `${listContext} — \`list\` exits 1 when any corrupt session exists (SPEC 10.7, 14.21)`,
      );
      const report = decodeSessionListReport(
        parseJsonStdout(result, listContext),
        listContext,
      );
      assertSameJson(
        report.sessions.map(({ name, corrupt }) => ({ name, corrupt })),
        expectedSessions,
        `${listContext} — the corrupt session is reported by name as ` +
          `corrupt in place of its fields, sessions in byte order of name ` +
          `(SPEC 10.1, 10.7; the adapter refuses fields on a corrupt entry)`,
      );
    },
    `${listContext} — a read leaves the workspace unchanged (SPEC 10.4, 13.5)`,
  );

  const checkContext = `T10.1-4 [${state}] \`check --json\``;
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const result = await runCli(product, workspace, ["check", "--json"]);
      assertExitCode(
        result,
        1,
        `${checkContext} — a corrupt review session is a check finding (SPEC 12.2, 14.21)`,
      );
      const findings = decodeFindingsReport(
        parseJsonStdout(result, checkContext),
        checkContext,
      ).findings;
      if (!findings.some((finding) => finding.condition === "14.21")) {
        fail(
          `${checkContext}: \`check\` must report the corrupt session with ` +
            `condition 14.21 (SPEC 12.2, 14.21); reported conditions: ` +
            JSON.stringify(findings.map((finding) => finding.condition)),
        );
      }
    },
    `${checkContext} — \`check\` never writes (SPEC 12.2, 13.3)`,
  );
}

// The shape-dependent corrupt states, each staged through the H-3 adapter
// layer over a session file the product itself wrote (session-staging.ts).
const ADAPTER_STATES: readonly (readonly [
  string,
  (sessionAbsPath: string) => Promise<void>,
])[] = [
  [
    "missing 10.2 field",
    // The stored item field deleted here is the status; "status" mirrors the
    // adapter's SESSION_SHAPE key and the deletion fails loudly if the
    // product's stored shape differs (H-3).
    (abs) => stageDeleteItemField(abs, "status"),
  ],
  ["unknown status", (abs) => stageUnknownItemStatus(abs)],
  ["duplicate item ids", (abs) => stageDuplicateItemEntry(abs)],
  [
    "two items with same kind and scope node",
    (abs) => stageDuplicateItemEntry(abs, { distinctId: true }),
  ],
  ["blockedBy naming an absent item", (abs) => stageBlockedByAbsentItem(abs)],
  ["blockedBy cycle", (abs) => stageBlockedByCycle(abs)],
];

const T10_1_4 = defineProductTest({
  id: "T10.1-4",
  title:
    "each corrupt session state — unparseable bytes (garbage and truncation), missing 10.2 field, unknown status, duplicate item ids, blockedBy at an absent item, a blockedBy cycle, duplicate kind+scope, malformed recorded creation parameters, malformed recorded decompositions (garbled over a product-performed `split`'s durable record), and a directory or symlink at the session path — makes every review subcommand naming the session report corruption, exit 1, and modify nothing; `list` reports it corrupt in place of its fields (exit 1); `check` reports 14.21; shape-dependent states are staged via the H-3 adapter over product-written files (SPEC 10.1, 10.7, 13.4, 14.21)",
  timeoutMs: 360_000,
  run: async (product) => {
    // --- Shape-dependent states via the adapter, over an audit session ---
    for (const [state, corrupt] of ADAPTER_STATES) {
      await withWorkspace(CORE_FILES, async (workspace) => {
        const itemId = await stageProductSession(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", CORRUPT_NAME],
          `T10.1-4 [${state}]`,
        );
        await corrupt(workspace.path(sessionRel(CORRUPT_NAME)));
        await assertCorruptSessionContract(product, workspace, state, itemId, [
          { name: CORRUPT_NAME, corrupt: true },
        ]);
      });
    }

    // --- Malformed recorded creation parameters ---
    // A coverage session records the profile's resolved definition (an audit
    // session records none, SPEC 10.7), so there is a recorded value for the
    // value-blind adapter transformation to garble.
    await withWorkspace(COVERAGE_FILES, async (workspace) => {
      const state = "malformed recorded creation parameters";
      const itemId = await stageProductSession(
        product,
        workspace,
        ["review", "create", "--coverage", "p", "--name", CORRUPT_NAME],
        `T10.1-4 [${state}]`,
      );
      await stageGarbleCreationParameters(
        workspace.path(sessionRel(CORRUPT_NAME)),
      );
      await assertCorruptSessionContract(product, workspace, state, itemId, [
        { name: CORRUPT_NAME, corrupt: true },
      ]);
    });

    // --- Malformed recorded decompositions ---
    // A `split` records its decomposition — the original's kind and scope
    // node — durably in the session (SPEC 10.7), so the product itself is
    // made to perform one before the recorded value is garbled: the
    // corrupted file starts as one the product wrote holding a genuine
    // recorded decomposition (an unsplit session may record none).
    await withWorkspace(CORE_FILES, async (workspace) => {
      const state = "malformed recorded decompositions";
      const context = `T10.1-4 [${state}]`;
      await buildOk(product, workspace, `${context} \`build\``);
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", CORRUPT_NAME],
        0,
        `${context} \`review create --strategy audit --name ${CORRUPT_NAME}\``,
      );
      const items = await readSessionItems(
        product,
        workspace,
        `${context} \`review status ${CORRUPT_NAME} --json\` (split-target selection)`,
      );
      // The split target: the subtree-coherence item scoped at the one
      // section with a child (`a` contains `a.k`), so the split is not
      // refused (SPEC 10.7: a childless scope root refuses).
      const splitScope = "specs/A.mdx#a";
      const splitTarget = items.find(
        (item) =>
          item.kind === "subtree-coherence" && item.scope === splitScope,
      );
      if (splitTarget === undefined) {
        fail(
          `${context}: staging premise — the audit session holds one ` +
            `subtree-coherence item per requirement node (SPEC 10.6), so an ` +
            `item scoped at ${splitScope} must exist for \`split\` to ` +
            `decompose; item scopes: ` +
            JSON.stringify(items.map((item) => item.scope)),
        );
      }
      await expectExit(
        product,
        workspace,
        ["review", "split", CORRUPT_NAME, splitTarget.id],
        0,
        `${context} \`review split ${CORRUPT_NAME} ${splitTarget.id}\` — ` +
          `the product-performed split records the decomposition durably ` +
          `(SPEC 10.7)`,
      );
      const postSplit = await readSessionItems(
        product,
        workspace,
        `${context} \`review status ${CORRUPT_NAME} --json\` (post-split item-id capture)`,
      );
      if (postSplit.some((item) => item.id === splitTarget.id)) {
        fail(
          `${context}: staging premise — after \`split\`, the original item ` +
            `is removed from the session and its id (${splitTarget.id}) ` +
            `never reused (SPEC 10.7), so its decomposition is genuinely ` +
            `recorded; the id is still present`,
        );
      }
      await stageGarbleDecompositions(workspace.path(sessionRel(CORRUPT_NAME)));
      await assertCorruptSessionContract(
        product,
        workspace,
        state,
        postSplit[0].id,
        [{ name: CORRUPT_NAME, corrupt: true }],
      );
    });

    // --- Unparseable JSON: garbage bytes (shape-independent, staged
    // directly — no assumed session layout is involved) ---
    await withWorkspace(CORE_FILES, async (workspace) => {
      const state = "unparseable JSON (garbage bytes)";
      await buildOk(product, workspace, `T10.1-4 [${state}] \`build\``);
      await workspace.file(
        sessionRel(CORRUPT_NAME),
        "this is deliberately not a JSON document ][}{\n",
      );
      await assertCorruptSessionContract(
        product,
        workspace,
        state,
        PLACEHOLDER_ITEM_ID,
        [{ name: CORRUPT_NAME, corrupt: true }],
      );
    });

    // --- Unparseable JSON: truncation of the product-written file ---
    await withWorkspace(CORE_FILES, async (workspace) => {
      const state = "unparseable JSON (truncated product-written file)";
      const itemId = await stageProductSession(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", CORRUPT_NAME],
        `T10.1-4 [${state}]`,
      );
      const bytes = await readSessionBytes(
        workspace,
        CORRUPT_NAME,
        `T10.1-4 [${state}] the product-written session file`,
      );
      const truncated = bytes.subarray(0, Math.floor(bytes.length / 2));
      // Staging premise: the front half of the product's single JSON
      // document must itself not parse as one (a JSON object loses its
      // closing brace); verify rather than assume.
      let stillParses = false;
      try {
        JSON.parse(new TextDecoder("utf-8").decode(truncated));
        stillParses = true;
      } catch {
        // Expected: the truncation is unparseable.
      }
      if (truncated.length === 0 || stillParses) {
        fail(
          `T10.1-4 [${state}]: staging premise — truncating the ` +
            `product-written session file (${String(bytes.length)} bytes) to ` +
            `its front half must yield a non-empty, unparseable document; ` +
            `adjust the staging if the product's stored form legitimately ` +
            `defeats this (H-3)`,
        );
      }
      await workspace.file(sessionRel(CORRUPT_NAME), truncated);
      await assertCorruptSessionContract(product, workspace, state, itemId, [
        { name: CORRUPT_NAME, corrupt: true },
      ]);
    });

    // --- Session path occupied by a directory (SPEC 13.4: a durable file's
    // path occupied by anything other than a plain file is corrupt) ---
    await withWorkspace(CORE_FILES, async (workspace) => {
      const state = "session path occupied by a directory";
      await buildOk(product, workspace, `T10.1-4 [${state}] \`build\``);
      await workspace.dir(sessionRel(CORRUPT_NAME));
      await assertCorruptSessionContract(
        product,
        workspace,
        state,
        PLACEHOLDER_ITEM_ID,
        [{ name: CORRUPT_NAME, corrupt: true }],
      );
    });

    // --- Session path occupied by a symbolic link ---
    // The link's target is a *valid* session file (the real session beside
    // it), so a product that follows the link instead of treating the
    // occupied path as corrupt (13.4: never read through it) sees a
    // perfectly healthy session and fails every arm.
    await withWorkspace(CORE_FILES, async (workspace) => {
      const state = "session path occupied by a symbolic link";
      await buildOk(product, workspace, `T10.1-4 [${state}] \`build\``);
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "real"],
        0,
        `T10.1-4 [${state}] \`review create --strategy audit --name real\` (the link's valid target)`,
      );
      await workspace.symlink(sessionRel(CORRUPT_NAME), "real.json");
      await assertCorruptSessionContract(
        product,
        workspace,
        state,
        PLACEHOLDER_ITEM_ID,
        [
          { name: CORRUPT_NAME, corrupt: true },
          { name: "real", corrupt: false },
        ],
      );
    });
  },
});

// ---------------------------------------------------------------------------
// T10.1-5 — failing workspace: gate precedence over corruption
// ---------------------------------------------------------------------------

// The invalidating edit's target: valid at staging, then overwritten with a
// non-root section carrying no `id` — after the edit the workspace's one
// `build` validation finding is that 14.1 (the section has no children, so
// condition 2's masking never enters), making "exactly the gate's findings"
// a one-element multiset (SPEC 13.3, 14.1). A.mdx — the session's item
// source — is never touched, so the gate alone flips every subcommand's
// behavior.
const T10_1_5_B_VALID = ['<S id="b">', "Beta text.", "</S>", ""].join("\n");
const T10_1_5_B_INVALID = ["<S>", "Beta text.", "</S>", ""].join("\n");

// T10.1-4's shape-independent garbage-bytes corruption: staged directly, no
// assumed session layout — the bytes parse as no JSON document (SPEC 10.1,
// 14.21).
const T10_1_5_GARBAGE = "this is deliberately not a JSON document ][}{\n";

// Item ID for the gated `show`/`resolve`/`split` probes: deliberately one no
// session ever held. An item ID is judged only against its session's content
// (SPEC 12.0), which no gated command reads on a failing workspace (13.3) —
// and the corruption would withhold anyway — so the probes must report the
// gate's findings whatever the ID: a product judging the ID before the gate
// (exit 2, unknown item) or opening the session to judge it (a corruption
// report) fails the exact-findings assertions below.
const T10_1_5_ITEM_ID = "no-such-item";

const T10_1_5 = defineProductTest({
  id: "T10.1-5",
  title:
    "failing workspace: gate precedence over corruption — a session created on a valid build is corrupted shape-independently (garbage bytes), then a source edited to fail build validation: `status`, `next`, `show`, `export`, `resolve` and `split` with an item ID no session held, and `review list` each report exactly the gate's findings as the form-exact findings report — the one staged 14.1, no condition-21 finding beside it — exit 1 and modify nothing, the corrupt session's bytes untouched (no session file is read; for `list` the gate's report replaces the per-session report whole), while `check` reports 14.21 concerning the session file together with the validation finding — the discriminating pair (SPEC 10.1, 10.7, 13.3, 14.21, 12.0)",
  run: async (product) => {
    await withWorkspace(
      {
        "xspec.config.ts": SPECS_ONLY_CONFIG,
        "specs/A.mdx": A_MDX,
        "specs/B.mdx": T10_1_5_B_VALID,
      },
      async (workspace) => {
        // --- Staging, in TEST-SPEC's order: session on a valid build,
        // shape-independent corruption, then the invalidating source edit.
        await buildOk(product, workspace, "T10.1-5 staging `build`");
        await expectExit(
          product,
          workspace,
          ["review", "create", "--strategy", "audit", "--name", CORRUPT_NAME],
          0,
          `T10.1-5 staging \`review create --strategy audit --name ${CORRUPT_NAME}\``,
        );
        await workspace.file(sessionRel(CORRUPT_NAME), T10_1_5_GARBAGE);
        const corruptBytes = await readSessionBytes(
          workspace,
          CORRUPT_NAME,
          "T10.1-5 staging (the corrupted session file)",
        );
        await workspace.file("specs/B.mdx", T10_1_5_B_INVALID);

        // --- The gate reference: `build` itself reports exactly the staged
        // validation error — "the findings a `build` would now report" is
        // what every gated probe below must reproduce (SPEC 13.3) — and the
        // exact one-element count doubles as condition 21's not-by-build
        // half: `build` reads no sessions (SPEC 14 condition 21). A failing
        // build modifies nothing (SPEC 12.1).
        const buildContext = "T10.1-5 `build --json` (the gate reference)";
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await expectExit(
              product,
              workspace,
              ["build", "--json"],
              1,
              `${buildContext} — the edited source fails build validation (SPEC 12.1, 14.1)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, buildContext),
              buildContext,
            ).findings;
            assertConditionCounts(
              findings,
              { "14.1": 1 },
              `${buildContext} — exactly the staged validation error, and ` +
                `never 14.21: \`build\` does not read sessions (SPEC 14 ` +
                `condition 21)`,
            );
            assertFindingLocated(
              findings[0] as Finding,
              { file: "specs/B.mdx" },
              `${buildContext} — the validation error identifies the broken source (SPEC 14)`,
            );
          },
          `${buildContext} — a failing build modifies nothing (SPEC 12.1)`,
        );

        /**
         * One gated probe (SPEC 13.3, 10.1): exit 1 with stdout the single
         * form-exact findings report holding exactly the gate's findings —
         * the staged 14.1 alone, so no condition-21 finding beside it — and
         * nothing modified: sources, graph data, and the corrupt session's
         * bytes byte-identical around the invocation.
         */
        const probeGate = async (
          argv: readonly string[],
          what: string,
        ): Promise<void> => {
          const context = `T10.1-5 ${what}`;
          await assertLeavesUnchanged(
            workspace.root,
            async () => {
              const result = await runCli(product, workspace, argv);
              assertExitCode(
                result,
                1,
                `${context} — on a workspace failing \`build\`'s ` +
                  `validations the gate's findings are reported and the ` +
                  `command exits 1; no session file is read, so the ` +
                  `corruption is not the outcome (SPEC 13.3, 10.1, 12.0)`,
              );
              const findings = decodeFindingsReport(
                parseJsonStdout(result, context),
                context,
              ).findings;
              assertConditionCounts(
                findings,
                { "14.1": 1 },
                `${context} — exactly the gate's findings: the staged ` +
                  `validation error alone, no condition-21 finding beside ` +
                  `it (SPEC 13.3, 14.21)`,
              );
              assertFindingLocated(
                findings[0] as Finding,
                { file: "specs/B.mdx" },
                `${context} — the gate's finding identifies the broken source (SPEC 14)`,
              );
            },
            `${context} — nothing modified: sources, graph data, and the ` +
              `corrupt session's bytes stay byte-identical (SPEC 13.3, 10.1)`,
          );
        };

        // Every `review` subcommand naming the session (TEST-SPEC's list).
        await probeGate(
          ["review", "status", CORRUPT_NAME, "--json"],
          `\`review status ${CORRUPT_NAME} --json\``,
        );
        await probeGate(
          ["review", "next", CORRUPT_NAME, "--json"],
          `\`review next ${CORRUPT_NAME} --json\``,
        );
        await probeGate(
          ["review", "show", CORRUPT_NAME, T10_1_5_ITEM_ID, "--json"],
          `\`review show ${CORRUPT_NAME} ${T10_1_5_ITEM_ID} --json\``,
        );
        await probeGate(
          ["review", "export", CORRUPT_NAME, "--json"],
          `\`review export ${CORRUPT_NAME} --json\``,
        );
        await probeGate(
          [
            "review",
            "resolve",
            CORRUPT_NAME,
            T10_1_5_ITEM_ID,
            "--status",
            "updated",
            "--json",
          ],
          `\`review resolve ${CORRUPT_NAME} ${T10_1_5_ITEM_ID} --status updated --json\``,
        );
        await probeGate(
          ["review", "split", CORRUPT_NAME, T10_1_5_ITEM_ID, "--json"],
          `\`review split ${CORRUPT_NAME} ${T10_1_5_ITEM_ID} --json\``,
        );
        // `review list`: the gate's report replaces the per-session report
        // whole (SPEC 10.7) — realized by the same form-exact one-member
        // decode, which no session-row-carrying document passes.
        await probeGate(["review", "list", "--json"], "`review list --json`");

        // --- The discriminating pair's other half: `check` reports 14.21
        // together with the validation findings (SPEC 14 condition 21:
        // beside a failing workspace's other findings; 12.2).
        // Presence-based beside the two staged conditions: with invalid
        // sources, the detectability of staleness findings (14.10) beside
        // them is T14-4's reporter-matrix business (the T13.3-3 precedent).
        const checkContext = "T10.1-5 `check --json`";
        await assertLeavesUnchanged(
          workspace.root,
          async () => {
            const result = await expectExit(
              product,
              workspace,
              ["check", "--json"],
              1,
              `${checkContext} — the workspace carries findings (SPEC 12.2)`,
            );
            const findings = decodeFindingsReport(
              parseJsonStdout(result, checkContext),
              checkContext,
            ).findings;
            if (
              !findings.some(
                (finding) =>
                  finding.condition === "14.1" &&
                  finding.locations.some(
                    (location) => location.file === "specs/B.mdx",
                  ),
              )
            ) {
              fail(
                `${checkContext}: the staged validation error (14.1 in ` +
                  `specs/B.mdx) must be reported (SPEC 12.2, 14.1); got ` +
                  JSON.stringify(
                    findings.map((finding) => ({
                      condition: finding.condition,
                      locations: finding.locations,
                    })),
                  ),
              );
            }
            const corrupt = findings.filter(
              (finding) => finding.condition === "14.21",
            );
            if (corrupt.length === 0) {
              fail(
                `${checkContext}: \`check\` must report 14.21 together ` +
                  `with the validation findings — beside a failing ` +
                  `workspace's other findings, the discriminating half ` +
                  `against a product dropping 14.21 on the failing side ` +
                  `(SPEC 14 condition 21, 12.2); reported conditions: ` +
                  JSON.stringify(findings.map((finding) => finding.condition)),
              );
            }
            if (
              !corrupt.some(
                (finding) => finding.path === sessionRel(CORRUPT_NAME),
              )
            ) {
              fail(
                `${checkContext}: the 14.21 finding carries the corrupt ` +
                  `session file it concerns, ${sessionRel(CORRUPT_NAME)}, ` +
                  `as its 12.7 path member (SPEC 14: session conditions ` +
                  `carry the file they concern); got paths ` +
                  JSON.stringify(corrupt.map((finding) => finding.path)),
              );
            }
          },
          `${checkContext} — \`check\` never writes (SPEC 12.2, 13.3)`,
        );

        // --- Pointed restatement of "the corrupt session's bytes
        // untouched" across the whole sweep (each probe's whole-root
        // compare already covers its own invocation).
        assertBytesEqual(
          await readSessionBytes(
            workspace,
            CORRUPT_NAME,
            "T10.1-5 (after every probe)",
          ),
          corruptBytes,
          "T10.1-5: the corrupt session's bytes are untouched by the whole " +
            "probe sweep — no session file is read or written on a failing " +
            "workspace (SPEC 13.3, 10.1)",
        );
      },
    );
  },
});

// ---------------------------------------------------------------------------
// T10.1-6 — session-directory and area occupancy; `create`'s ordering
// ---------------------------------------------------------------------------

// The non-directory occupant staged at `.xspec/reviews` and at `.xspec`
// (SPEC 14.22's plain-file kind; content arbitrary — the occupant is never
// read).
const T10_1_6_OCCUPANT = "not a directory\n";

// The derived paths of `specs/A.mdx`: its module and companions are
// `specs/A.xspec.` plus a suffix (SPEC 13.1); the module itself embeds the
// node text (SPEC 4.2), so a text edit makes it stale for certain.
const T10_1_6_A_DERIVED_PREFIX = "specs/A.xspec.";
const T10_1_6_A_MODULE = "specs/A.xspec.ts";

/** The product-written session every staging starts from (`s`). */
const T10_1_6_SESSION = "s";
/** The name `create` is refused for on every occupied session directory. */
const T10_1_6_NEW_SESSION = "n";

const T10_1_6_CREATE_S: readonly string[] = [
  "review",
  "create",
  "--strategy",
  "audit",
  "--name",
  T10_1_6_SESSION,
];

/** How a path comes to hold a non-directory (SPEC 13.4). */
type T1016Occupant =
  | { readonly kind: "plain-file" }
  | {
      readonly kind: "symlink";
      /** Where the relocated product-written directory goes (root-relative). */
      readonly targetRel: string;
      /** The link's stored target, spelled relative to the link's directory. */
      readonly linkTarget: string;
    };

const T10_1_6_PLAIN_FILE: T1016Occupant = { kind: "plain-file" };
// `.xspec/reviews` → `../elsewhere-reviews`: a real directory inside the
// workspace root, outside the area, holding the product-written `s.json`.
const T10_1_6_REVIEWS_LINK: T1016Occupant = {
  kind: "symlink",
  targetRel: "elsewhere-reviews",
  linkTarget: "../elsewhere-reviews",
};
// `.xspec` → `elsewhere-area`: the relocated area — journal, graph data, and
// the valid session — beside the link.
const T10_1_6_AREA_LINK: T1016Occupant = {
  kind: "symlink",
  targetRel: "elsewhere-area",
  linkTarget: "elsewhere-area",
};

/**
 * Stage a non-directory occupant at `rel` (SPEC 13.4): `plain-file`
 * replaces whatever the path holds with a plain file; `symlink` relocates
 * the directory the path holds to `targetRel` and leaves a symbolic link
 * spelled `linkTarget` in its place, so the link's target holds exactly what
 * the product wrote there. The staging is verified on the harness's own
 * process before any product runs: a wrong occupant kind is machinery
 * misuse, thrown as a plain `Error` — never a diagnosed failure (H-11).
 */
async function stageNonDirectoryOccupant(
  workspace: TestWorkspace,
  rel: string,
  occupant: T1016Occupant,
): Promise<void> {
  if (occupant.kind === "plain-file") {
    await fsp.rm(workspace.path(rel), { recursive: true, force: true });
    await workspace.file(rel, T10_1_6_OCCUPANT);
  } else {
    const held = await workspace.kind(rel);
    if (held !== "dir") {
      throw new Error(
        `T10.1-6 staging: ${rel} must hold the product-written directory ` +
          `to relocate to ${occupant.targetRel}; found ${held}`,
      );
    }
    await fsp.rename(workspace.path(rel), workspace.path(occupant.targetRel));
    await workspace.symlink(rel, occupant.linkTarget, "dir");
  }
  const expected = occupant.kind === "plain-file" ? "file" : "symlink";
  const staged = await workspace.kind(rel);
  if (staged !== expected) {
    throw new Error(
      `T10.1-6 staging: expected ${rel} to hold a ${expected} once staged; ` +
        `found ${staged} (a harness staging error, not a product observation)`,
    );
  }
}

/**
 * Exactly one finding, of the given counting identity — a condition token of
 * 14, or `(code-less)` for a refusal carrying no stable code (10.7) — with
 * no in-source location (locations [], SPEC 12.7) and, where SPEC pins one,
 * the concerned path.
 */
function assertExactlyOneFinding(
  findings: readonly Finding[],
  identity: string,
  concernedPath: string | null,
  context: string,
): Finding {
  assertConditionCounts(findings, { [identity]: 1 }, context);
  const finding = findings[0]!;
  if (concernedPath !== null) {
    assertFindingConcernsPath(finding, concernedPath, context);
  }
  assertSameJson(
    finding.locations,
    [],
    `${context}: the finding has no in-source location — locations [] ` +
      `(SPEC 12.7)`,
  );
  return finding;
}

/**
 * `check`'s report once a refused `create` has refreshed graph data on the
 * edited-source twin (SPEC 13.5, 13.3): every condition-10 finding is per
 * file, concerning a derived path of `specs/A.mdx` — `specs/A.xspec.` plus
 * a suffix (SPEC 13.1) — with the module itself among them (it embeds the
 * edited text, SPEC 4.2), and none is the graph-data unit form, whose
 * concerned path would be `.xspec` (SPEC 14.10). Beside the staleness,
 * exactly `beside` (counted by identity) and nothing else.
 */
function assertPerFileStalenessOfA(
  findings: readonly Finding[],
  beside: Readonly<Record<string, number>>,
  context: string,
): void {
  const stale = findings.filter((finding) => finding.condition === "14.10");
  assertConditionCounts(
    findings.filter((finding) => finding.condition !== "14.10"),
    beside,
    `${context} — beside the per-file staleness, exactly the expected ` +
      `findings and nothing else (SPEC 14, 12.2)`,
  );
  if (stale.length === 0) {
    fail(
      `${context}: the edited source's generated module no longer matches ` +
        `what the current sources generate — its documentation comment ` +
        `embeds the edited text (SPEC 4.2) — so \`check\` reports per-file ` +
        `staleness (SPEC 14.10, 12.2); got no condition-10 finding`,
    );
  }
  for (const finding of stale) {
    if (
      typeof finding.path !== "string" ||
      !finding.path.startsWith(T10_1_6_A_DERIVED_PREFIX)
    ) {
      fail(
        `${context}: graph data was refreshed before the refusal (SPEC ` +
          `13.5, 13.3), so no graph-data unit form is reported and every ` +
          `condition-10 finding is per file, concerning a derived path of ` +
          `specs/A.mdx — ${T10_1_6_A_DERIVED_PREFIX}* (SPEC 13.1, 14.10); ` +
          `got a condition-10 finding concerning ` +
          `${JSON.stringify(finding.path)} (message: ` +
          `${JSON.stringify(finding.message)})`,
      );
    }
    assertSameJson(
      finding.locations,
      [],
      `${context}: a per-file staleness finding names its path and has no ` +
        `in-source location — locations [] (SPEC 14.10, 12.7)`,
    );
  }
  if (!stale.some((finding) => finding.path === T10_1_6_A_MODULE)) {
    fail(
      `${context}: the module ${T10_1_6_A_MODULE} itself is stale — it ` +
        `embeds the edited text (SPEC 4.2, 13.1) — so a condition-10 ` +
        `finding concerns it (SPEC 14.10); got ` +
        JSON.stringify(stale.map((finding) => finding.path)),
    );
  }
}

/**
 * The session directory holds sessions only while a directory occupies its
 * path (SPEC 10.1, 13.4): on a freshly built valid workspace whose
 * `.xspec/reviews` holds a non-directory, no command lists through the
 * occupant — `review list` reports no sessions, `review status s` is an
 * unknown session, `inventory` reports `sessions` [] — `check` is clean and
 * the gate carries nothing (14.22 is `create`'s finding there, never
 * `check`'s or the gate's), `ids` answers, and `create` refuses its own
 * obstructed write path with one condition-22 finding concerning
 * `.xspec/reviews`. One whole-root compare around the sweep (the workspace
 * is fresh, so no 13.3 refresh legitimately intervenes): nothing written —
 * the occupant byte-unchanged, the link and its target byte-identical.
 */
async function assertSessionDirectoryOccupied(
  product: ProductBinding,
  workspace: TestWorkspace,
  label: string,
): Promise<void> {
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const listContext =
        `${label} \`review list --json\` — no command lists through the ` +
        `occupant: no sessions, exit 0 (SPEC 10.1, 13.4, 10.7)`;
      const list = decodeSessionListReport(
        await runJson(
          product,
          workspace,
          ["review", "list", "--json"],
          listContext,
        ),
        listContext,
      );
      assertSameJson(list.sessions, [], `${listContext}: sessions`);

      const statusContext =
        `${label} \`review status s --json\` — \`s\` names no session ` +
        `through the occupant: exit 2, unknown session (SPEC 10.1, 12.0)`;
      const status = await expectExit(
        product,
        workspace,
        ["review", "status", T10_1_6_SESSION, "--json"],
        2,
        statusContext,
      );
      const error = expectErrorDocument(status, statusContext);
      assertSameJson(
        { code: error.code, path: error.path },
        { code: null, path: null },
        `${statusContext} — a plain usage error's document carries code ` +
          `and path null (SPEC 12.7)`,
      );

      await expectFindingFreeReport(
        product,
        workspace,
        ["check", "--json"],
        `${label} \`check --json\` — the occupied session directory is ` +
          `\`create\`'s condition-22 finding, never \`check\`'s or the ` +
          `gate's, and it holds no session to find corrupt (SPEC 14.22, ` +
          `12.2, 10.1)`,
      );

      const inventoryContext =
        `${label} \`inventory --json\` — sessions [] while the session ` +
        `directory holds no directory, and no finding (SPEC 11.6, 13.4)`;
      const inventory = decodeInventoryDocument(
        await runJson(
          product,
          workspace,
          ["inventory", "--json"],
          inventoryContext,
        ),
        inventoryContext,
      );
      assertSameJson(inventory.findings, [], `${inventoryContext}: findings`);
      assertSameJson(inventory.sessions, [], `${inventoryContext}: sessions`);

      const idsContext =
        `${label} \`ids --json\` — the gate carries no finding, so \`ids\` ` +
        `answers, exit 0 (SPEC 13.3, 14.22)`;
      decodeIdsReport(
        await runJson(product, workspace, ["ids", "--json"], idsContext),
        idsContext,
      );

      const createContext =
        `${label} \`review create --strategy audit --name n --json\` — the ` +
        `occupant obstructs the session write: exit 1, exactly one ` +
        `condition-22 finding concerning .xspec/reviews, locations [] ` +
        `(SPEC 10.1, 14.22)`;
      assertExactlyOneFinding(
        await runFindingsReport(
          product,
          workspace,
          [
            "review",
            "create",
            "--strategy",
            "audit",
            "--name",
            T10_1_6_NEW_SESSION,
            "--json",
          ],
          1,
          createContext,
        ),
        "14.22",
        REVIEWS_DIR,
        createContext,
      );
    },
    `${label}: nothing is written — the occupant byte-unchanged, the link ` +
      `and its target byte-identical, nothing written through it, and no ` +
      `session file anywhere (SPEC 10.1, 13.4, 14.22)`,
  );
}

/** The one refusal finding a stale twin's `create` reports. */
interface ExpectedRefusal {
  /** A condition token of 14, or `(code-less)` for the 10.7 refusal. */
  readonly identity: string;
  /** The concerned path where SPEC pins one, else null (left unasserted). */
  readonly concernedPath: string | null;
}

/**
 * `create`'s ordering on a stale twin (SPEC 13.5, 14.22): a section's text
 * is edited after `build`, then `create --name <name>` is refused — the one
 * finding of `expected` (condition 22, the code-less existing-name refusal,
 * or condition 21 in its place), exit 1. The refusal follows the gate and
 * refresh of 13.3, so graph data has been refreshed: the compare around
 * `create` confines every change to `.xspec/` outside `.xspec/reviews/`
 * (the refresh's opaque writes, H-4 — nothing outside the area, the
 * occupant and every session file byte-unchanged, no session file
 * written), and `check` afterwards reports the edited source's per-file
 * staleness beside exactly `besideStaleness` and no graph-data unit form —
 * where a product examining the session directory before refreshing leaves
 * graph data stale (the unit form then reported).
 */
async function assertCreateFollowsRefresh(
  product: ProductBinding,
  workspace: TestWorkspace,
  name: string,
  expected: ExpectedRefusal,
  besideStaleness: Readonly<Record<string, number>>,
  label: string,
): Promise<void> {
  await workspace.file("specs/A.mdx", A_MDX_EDITED);
  const argv = [
    "review",
    "create",
    "--strategy",
    "audit",
    "--name",
    name,
    "--json",
  ];
  const createContext =
    `${label} \`${argv.join(" ")}\` on the stale twin — exit 1 with the ` +
    `one refusal finding, judged after the gate and refresh (SPEC 13.5, ` +
    `14.22, 10.7, 14.21)`;
  const before = await snapshotDirectory(workspace.root);
  const findings = await runFindingsReport(
    product,
    workspace,
    argv,
    1,
    createContext,
  );
  const after = await snapshotDirectory(workspace.root);
  assertExactlyOneFinding(
    findings,
    expected.identity,
    expected.concernedPath,
    createContext,
  );
  for (const change of diffSnapshots(before, after)) {
    const underArea =
      change.key === GRAPH_DATA_AREA_PATH ||
      change.key.startsWith(`${GRAPH_DATA_AREA_PATH}/`);
    const underReviews =
      change.key === REVIEWS_DIR || change.key.startsWith(`${REVIEWS_DIR}/`);
    if (!underArea || underReviews) {
      fail(
        `${label}: the refused \`create\` on a stale twin writes nothing ` +
          `but the 13.3 refresh, confined to .xspec/ outside ` +
          `.xspec/reviews/ — no session file written or changed, the ` +
          `occupant byte-unchanged, nothing outside the area touched ` +
          `(SPEC 13.5, 13.3, 14.22); found ${change.change} ` +
          `${change.path}: ${change.detail}`,
      );
    }
  }
  const checkContext = `${label} \`check --json\` after the refused \`create\``;
  assertPerFileStalenessOfA(
    await runFindingsReport(
      product,
      workspace,
      ["check", "--json"],
      1,
      `${checkContext} — the edited source's generated module is stale, ` +
        `so \`check\` exits 1 (SPEC 12.2, 14.10)`,
    ),
    besideStaleness,
    checkContext,
  );
}

/**
 * The graph-data area's own path occupied by a non-directory (SPEC 13.4,
 * 14.22, 14.23): `inventory` meets condition 23 in its record-supplied
 * datum — `recorded` explicitly unavailable, `journal.occupied` false and
 * `sessions` [] (nothing is read below the occupant), that one finding
 * concerning `.xspec`, exit 1 (11.6); `build`, `ids`, and `review list`
 * each refuse on `build`'s obstructed graph-data write path — exactly one
 * condition-22 finding concerning `.xspec`, the gate's report for the reads
 * (13.3), exit 1; `check` reports that finding beside condition 10 in the
 * unreadable-record unit form and nothing else (14.10, 14.23: reported
 * whatever the workspace's validity); and `view` of a clean file answers
 * finding-free (11.2, T11.2-6). One whole-root compare around the sweep:
 * nothing written, the link's target byte-identical.
 */
async function assertAreaOccupied(
  product: ProductBinding,
  workspace: TestWorkspace,
  label: string,
): Promise<void> {
  await assertLeavesUnchanged(
    workspace.root,
    async () => {
      const inventoryContext =
        `${label} \`inventory --json\` — the area's own path holds no ` +
        `directory: recorded unavailable with the one condition-23 ` +
        `finding, exit 1 (SPEC 11.6, 14.23, 13.4)`;
      const inventoryRun = await expectExit(
        product,
        workspace,
        ["inventory", "--json"],
        1,
        inventoryContext,
      );
      const inventory = decodeInventoryDocument(
        parseJsonStdout(inventoryRun, inventoryContext),
        inventoryContext,
      );
      assertExactlyOneFinding(
        inventory.findings,
        "14.23",
        GRAPH_DATA_AREA_PATH,
        `${inventoryContext} — that finding alone, concerning the area`,
      );
      assertSameJson(
        inventory.recorded,
        { state: "unavailable" },
        `${inventoryContext} — the record-supplied datum is reported ` +
          `explicitly unavailable, never read as an empty record (SPEC ` +
          `14.23, 11.6)`,
      );
      assertSameJson(
        inventory.journal.occupied,
        false,
        `${inventoryContext} — the journal is unoccupied to the inventory ` +
          `below an area path holding no directory (SPEC 11.6, 13.4)`,
      );
      assertSameJson(
        inventory.sessions,
        [],
        `${inventoryContext} — no session while the area's own path holds ` +
          `no directory (SPEC 11.6, 10.1)`,
      );

      for (const argv of [["build"], ["ids"], ["review", "list"]] as const) {
        const context =
          `${label} \`${argv.join(" ")} --json\` — a directory component ` +
          `of graph data's write path is occupied by a non-directory: ` +
          `exactly one condition-22 finding concerning .xspec, exit 1, ` +
          `nothing written (SPEC 14.22, 13.3, 13.4)`;
        assertExactlyOneFinding(
          await runFindingsReport(
            product,
            workspace,
            [...argv, "--json"],
            1,
            context,
          ),
          "14.22",
          GRAPH_DATA_AREA_PATH,
          context,
        );
      }

      const checkContext =
        `${label} \`check --json\` — the obstructed graph-data write path ` +
        `beside condition 10 in the unreadable-record unit form, and ` +
        `nothing else (SPEC 14.22, 14.10, 14.23, 12.2)`;
      const checkFindings = await runFindingsReport(
        product,
        workspace,
        ["check", "--json"],
        1,
        checkContext,
      );
      assertConditionCounts(
        checkFindings,
        { "14.22": 1, "14.10": 1 },
        checkContext,
      );
      for (const finding of checkFindings) {
        assertFindingConcernsPath(
          finding,
          GRAPH_DATA_AREA_PATH,
          finding.condition === "14.22"
            ? `${checkContext}: the offending component's ` +
                `workspace-relative path (SPEC 14.22, 13.4)`
            : `${checkContext}: the unit form's concerned path is the ` +
                `graph-data area, no path inside it named (SPEC 14.10, ` +
                `14.23, 11.6)`,
        );
        assertSameJson(
          finding.locations,
          [],
          `${checkContext}: a path-concerned condition is unlocated — ` +
            `locations [] (SPEC 12.7)`,
        );
        if (finding.condition === "14.10" && !/build/i.test(finding.message)) {
          fail(
            `${checkContext}: the unit form instructs rebuilding (SPEC ` +
              `14.10) — any message naming \`build\` qualifies (H-3); got ` +
              JSON.stringify(finding.message),
          );
        }
      }

      const viewContext =
        `${label} \`view specs/A.mdx --json\` — \`view\` answers from the ` +
        `current sources: the clean file finding-free, exit 0 (SPEC 11.2, ` +
        `T11.2-6)`;
      const view = decodeViewReport(
        await runJson(
          product,
          workspace,
          ["view", "specs/A.mdx", "--json"],
          viewContext,
        ),
        { text: false },
        viewContext,
      );
      assertSameJson(view.findings, [], `${viewContext}: findings`);
    },
    `${label}: nothing is written — the occupant byte-unchanged, the link ` +
      `and its target byte-identical, nothing written through it (SPEC ` +
      `14.22, 13.4)`,
  );
}

const T10_1_6 = defineProductTest({
  id: "T10.1-6",
  title:
    "session-directory and area occupancy; `create`'s ordering: `.xspec/reviews` occupied by a plain file, or by a symbolic link to a directory holding a valid session, holds no sessions (`list` none, `status s` exit 2, `check` clean, `inventory` sessions [], `ids` answers) and `create` is refused with one condition-22 finding concerning `.xspec/reviews`, nothing written; on stale twins the refused `create` — condition 22, the code-less existing-name refusal, or condition 21 in its place — follows the refresh (`check` then reports the edited source's per-file staleness and no unit form; no session written or changed); `.xspec` occupied by a plain file, or by a symbolic link to a directory holding a journal and valid sessions: `inventory` recorded unavailable with the one condition-23 finding, `build`/`ids`/`review list` one condition-22 finding concerning `.xspec`, `check` that finding beside the unreadable-record unit form, `view` finding-free (10.1, 10.7, 11.6, 13.3–13.5, 14.10, 14.21–14.23)",
  timeoutMs: 360_000,
  run: async (product) => {
    // --- Session-directory occupancy on a freshly built valid workspace --
    // Plain file: no session has been created, so `.xspec/reviews` is
    // absent after `build` (SPEC 10.1) and the plain file takes its path.
    await withWorkspace(CORE_FILES, async (workspace) => {
      const label = "T10.1-6 [.xspec/reviews: plain file]";
      await buildOk(product, workspace, `${label} \`build\``);
      await stageNonDirectoryOccupant(
        workspace,
        REVIEWS_DIR,
        T10_1_6_PLAIN_FILE,
      );
      await assertSessionDirectoryOccupied(product, workspace, label);
    });
    // Symbolic link: the product writes `s` first; its session directory
    // is then relocated outside the area and linked from its path, so the
    // link's target holds the valid product-written `s.json`.
    await withWorkspace(CORE_FILES, async (workspace) => {
      const label =
        "T10.1-6 [.xspec/reviews: symbolic link to a directory holding s.json]";
      await buildOk(product, workspace, `${label} \`build\``);
      await expectExit(
        product,
        workspace,
        T10_1_6_CREATE_S,
        0,
        `${label} \`review create --strategy audit --name s\` — the valid ` +
          `session the link's target then holds (SPEC 10.1)`,
      );
      await stageNonDirectoryOccupant(
        workspace,
        REVIEWS_DIR,
        T10_1_6_REVIEWS_LINK,
      );
      await assertSessionDirectoryOccupied(product, workspace, label);
    });

    // --- Ordering: `create` examines the session directory only past the
    // gate and refresh of 13.3 (SPEC 13.5) — three stale twins.
    await withWorkspace(CORE_FILES, async (workspace) => {
      const label = "T10.1-6 [stale twin, .xspec/reviews: plain file]";
      await buildOk(product, workspace, `${label} \`build\``);
      await stageNonDirectoryOccupant(
        workspace,
        REVIEWS_DIR,
        T10_1_6_PLAIN_FILE,
      );
      await assertCreateFollowsRefresh(
        product,
        workspace,
        T10_1_6_NEW_SESSION,
        { identity: "14.22", concernedPath: REVIEWS_DIR },
        {},
        label,
      );
    });
    await withWorkspace(CORE_FILES, async (workspace) => {
      const label = "T10.1-6 [stale twin holding a valid s]";
      await buildOk(product, workspace, `${label} \`build\``);
      await expectExit(
        product,
        workspace,
        T10_1_6_CREATE_S,
        0,
        `${label} \`review create --strategy audit --name s\` (SPEC 10.1)`,
      );
      await assertCreateFollowsRefresh(
        product,
        workspace,
        T10_1_6_SESSION,
        { identity: "(code-less)", concernedPath: null },
        {},
        label,
      );
    });
    await withWorkspace(CORE_FILES, async (workspace) => {
      const label = "T10.1-6 [stale twin holding a corrupt s]";
      await buildOk(product, workspace, `${label} \`build\``);
      await expectExit(
        product,
        workspace,
        T10_1_6_CREATE_S,
        0,
        `${label} \`review create --strategy audit --name s\` (SPEC 10.1)`,
      );
      // Shape-independent corruption (module header): unparseable bytes
      // over the product-written session (SPEC 14.21).
      await workspace.file(sessionRel(T10_1_6_SESSION), NON_SESSION_GARBAGE);
      await assertCreateFollowsRefresh(
        product,
        workspace,
        T10_1_6_SESSION,
        { identity: "14.21", concernedPath: null },
        { "14.21": 1 },
        label,
      );
    });

    // --- The graph-data area's own path (SPEC 13.4, 14.22, 14.23) --------
    // Built first: the derived files exist and match, so `check` meets no
    // per-file staleness beside the two findings the staging pins.
    await withWorkspace(CORE_FILES, async (workspace) => {
      const label = "T10.1-6 [.xspec: plain file]";
      await buildOk(product, workspace, `${label} \`build\``);
      await stageNonDirectoryOccupant(
        workspace,
        GRAPH_DATA_AREA_PATH,
        T10_1_6_PLAIN_FILE,
      );
      await assertAreaOccupied(product, workspace, label);
    });
    // Symbolic link: a journaled rename brings the journal into existence
    // (SPEC 6.1) and regenerates; `create` writes the valid session; the
    // area is then relocated and linked from its path.
    await withWorkspace(CORE_FILES, async (workspace) => {
      const label =
        "T10.1-6 [.xspec: symbolic link to a directory holding a journal and s.json]";
      await buildOk(product, workspace, `${label} \`build\``);
      await expectExit(
        product,
        workspace,
        ["rename", "specs/A.mdx", "a.k", "a.k2"],
        0,
        `${label} \`rename specs/A.mdx a.k a.k2\` — the journal the link's ` +
          `target then holds (SPEC 6.1, 6.4)`,
      );
      await expectExit(
        product,
        workspace,
        T10_1_6_CREATE_S,
        0,
        `${label} \`review create --strategy audit --name s\` — the valid ` +
          `session the link's target then holds (SPEC 10.1)`,
      );
      await stageNonDirectoryOccupant(
        workspace,
        GRAPH_DATA_AREA_PATH,
        T10_1_6_AREA_LINK,
      );
      await assertAreaOccupied(product, workspace, label);
    });
  },
});

/** TEST-SPEC §10.1, in canonical ID order (SUITE-33). */
export const section101Tests: readonly ProductTestEntry[] = [
  T10_1_1,
  T10_1_2,
  T10_1_3,
  T10_1_4,
  T10_1_5,
  T10_1_6,
];
