// TEST-SPEC §10.7 (review commands), third part: T10.7-14 (the refusal
// finding form). T10.7-1…T10.7-6 are section-10.7-i.ts's business, and
// T10.7-7…T10.7-12 section-10.7-ii.ts's.
//
// Registered product-facing bodies (C-2 "one code path"): each builds its own
// fresh workspace (H-1), drives the product strictly as a subprocess (H-2),
// asserts exact exit codes (H-5), decodes output through the H-3 adapters,
// and rejects a product only via diagnosed assertion failures (H-8).
//
// SPEC 10.7: `review create` with the name of an existing session — a name
// matching one ignoring ASCII case counting, at `create`, as that session's
// (10.1) — `resolve` of a blocked item, and `split` of an item of any other
// kind or of a `subtree-coherence` item whose scope root has no children are
// refused, each refusal one finding, exit 1, modifying nothing (13.5). SPEC
// 14: a review-operation refusal carries no stable code, and neither
// location nor concerned path — `locations` empty, `path` `null` (12.7); a
// refused operation's report is the findings-only form `{"findings": […]}`
// (12.7).
//
// Conservative operationalizations (noted per H-3/H-4):
// - Every refusal runs through the shared check (support.ts
//   `expectReviewRefusal`), the one each of the refusal's home tests runs
//   too (T10.1-2, T10.1-6, T10.3-2, T10.7-1, T10.7-9, T10.7-10): the command
//   run with `--json`, exit 1, standard output exactly `{"findings": [f]}`
//   decoded form-exact (H-3: the one member; `f` exactly the five members
//   `code`, `message`, `locations`, `path`, `identities`), `code` `null`,
//   `locations` `[]`, `path` `null`, and `identities` an array of strings
//   (the decode's) whose content is informational (12.7) and not asserted;
//   the session file the refusal names byte-identical around the run. That
//   is T10.7-14's whole compare: the whole-root "nothing modified" is its
//   home tests' (the sites above pass the shared check's option).
// - One audit session `s` (no baseline, so no git) over one file carries
//   every refusal the entry lists, each staged as its home test stages it:
//   `create` naming `s` exactly and as `S` (ASCII case alone; T10.7-1,
//   T10.1-2); `resolve` of p's item, blocked by p.a's unresolved item
//   (audit blocking, SPEC 10.6; T10.7-10), and of p's `parent-consistency`
//   item, blocked by p.a's resolved item once that item reads `invalidated`
//   (re-blocking, SPEC 10.3, 10.4; T10.3-2); `split` of p.a's item, a
//   leaf's (no children), of p's `parent-consistency` item (another kind),
//   and of t's item once t's only child t.u has been deleted by manual edit
//   after `create` (no children now; T10.7-9). p's `parent-consistency` item
//   comes from splitting p's item (SPEC 10.7: the scope root's
//   `parent-consistency` item, blocked by the child items). Each premise the
//   staging relies on — the blocked states and the decomposition's item — is
//   asserted from `review status --json` before the refusal it serves
//   (diagnosed, H-8).
// - The one edit (p.a's text, and t.u deleted) is followed by an explicit
//   `build` before any read, so no read or refusal meets stale graph data
//   (the refresh path is T13.3's business, and refusals beside it T10.1-6's).
//   It is staged after the body's first invocation, so it is a staged-source
//   record (helpers/staged-mdx.ts, S-9); the initial file and configuration
//   of the body's one workspace, created before any invocation, stay plain
//   strings.

import type {
  ItemKind,
  SessionStatusReport,
  SessionStatusRow,
} from "../../helpers/adapters/index.js";
import { decodeSessionStatusReport } from "../../helpers/adapters/index.js";
import { fail } from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import { stagedMdx } from "../../helpers/staged-mdx.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import {
  assertSameJson,
  buildOk,
  expectExit,
  expectReviewRefusal,
  runJson,
} from "./support.js";

// ---------------------------------------------------------------------------
// T10.7-14 — refusal finding form
// ---------------------------------------------------------------------------

// Minimal declarative configuration (SPEC 7): exactly one spec group.
const R14_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

const R14_FILE = "specs/A.mdx";
const R14_ROOT = "specs/A.mdx";
const R14_P = "specs/A.mdx#p";
const R14_PA = "specs/A.mdx#p.a";
const R14_T = "specs/A.mdx#t";
const R14_TU = "specs/A.mdx#t.u";

/** The session every refusal names, and its file (SPEC 10.1). */
const R14_SESSION = "s";
const R14_SESSION_REL = `.xspec/reviews/${R14_SESSION}.json`;

/**
 * `specs/A.mdx`: top-level `p` holding the leaf `p.a`, and top-level `t`
 * holding the leaf `t.u`; `edited` gives p.a its v2 text and deletes t.u.
 */
function r14Spec(edited: boolean): string {
  return [
    '<S id="p">',
    "Parent text.",
    "",
    '<S id="p.a">',
    edited ? "Kid text v2." : "Kid text.",
    "</S>",
    "</S>",
    "",
    '<S id="t">',
    "Holder text.",
    ...(edited ? [] : ["", '<S id="t.u">', "Lost text.", "</S>"]),
    "</S>",
    "",
  ].join("\n");
}

// The body's one edit, staged after its first invocation: a staged-source
// record (helpers/staged-mdx.ts; S-9's before-any-product clause).
const R14_EDITED = stagedMdx(
  "T10.7-14 specs/A.mdx with p.a's text at v2 and t.u deleted",
  r14Spec(true),
);

/** `review status s --json`, decoded (SPEC 10.7). */
async function r14Status(
  product: ProductBinding,
  workspace: TestWorkspace,
  context: string,
): Promise<SessionStatusReport> {
  const label = `${context} \`review status ${R14_SESSION} --json\``;
  return decodeSessionStatusReport(
    await runJson(
      product,
      workspace,
      ["review", "status", R14_SESSION, "--json"],
      label,
    ),
    label,
  );
}

/**
 * The unique status row for a kind and scope node, diagnosed loudly when
 * missing or duplicated (SPEC 10.1, 10.5: at most one item per kind and
 * scope node).
 */
function r14Row(
  report: SessionStatusReport,
  kind: ItemKind,
  scope: string,
  context: string,
): SessionStatusRow {
  const rows = report.items.filter(
    (row) => row.kind === kind && row.scope === scope,
  );
  if (rows.length !== 1) {
    fail(
      `${context}: expected exactly one ${kind} item scoped at ${scope} ` +
        `(SPEC 10.1, 10.5: a session never contains two items with the same ` +
        `kind and scope node); found ${String(rows.length)} among ` +
        JSON.stringify(report.items.map((row) => `${row.kind} ${row.scope}`)),
    );
  }
  return rows[0]!;
}

/** A staging premise on one row's status and blocked state (diagnosed). */
function r14ExpectRowState(
  row: SessionStatusRow,
  expected: { readonly status: string; readonly blocked: boolean },
  why: string,
  context: string,
): void {
  assertSameJson(
    { status: row.status, blocked: row.blocked },
    expected,
    `${context} staging premise: the ${row.kind} item scoped at ` +
      `${row.scope} — ${why}`,
  );
}

const T10_7_14 = defineProductTest({
  id: "T10.7-14",
  title:
    'refusal finding form: each review-operation refusal — `create` naming an existing session exactly, and matching it ignoring ASCII case alone; `resolve` of a blocked item, its blocker unresolved and, re-blocked, `invalidated`; `split` of an item of another kind, and of a `subtree-coherence` item whose scope root has no children, a leaf\'s and one whose only child was deleted by manual edit after `create` — run with `--json` exits 1 with standard output exactly `{"findings": [f]}`, `f` exactly `{"code", "message", "locations", "path", "identities"}` with `code` `null`, `locations` `[]`, `path` `null`, and `identities` an array of strings, its content not asserted; the session file stays byte-identical (SPEC 10.1, 10.3, 10.4, 10.6, 10.7, 12.7, 14)',
  run: async (product) => {
    const workspace = await TestWorkspace.create({
      files: { "xspec.config.ts": R14_CONFIG, [R14_FILE]: r14Spec(false) },
    });
    try {
      const prefix = "T10.7-14";
      await buildOk(product, workspace, `${prefix} \`build\``);
      await expectExit(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", R14_SESSION],
        0,
        `${prefix} \`review create --strategy audit --name ${R14_SESSION}\``,
      );
      const initial = await r14Status(product, workspace, prefix);
      const pRow = r14Row(initial, "subtree-coherence", R14_P, prefix);
      const paRow = r14Row(initial, "subtree-coherence", R14_PA, prefix);
      const tRow = r14Row(initial, "subtree-coherence", R14_T, prefix);
      r14Row(initial, "subtree-coherence", R14_ROOT, prefix);
      r14Row(initial, "subtree-coherence", R14_TU, prefix);
      r14ExpectRowState(
        pRow,
        { status: "unresolved", blocked: true },
        "blocked by its child section's unresolved item, p.a's (SPEC 10.3, " +
          "10.6)",
        prefix,
      );
      r14ExpectRowState(
        paRow,
        { status: "unresolved", blocked: false },
        "a leaf's item, blocked by nothing (SPEC 10.6)",
        prefix,
      );

      // `create` naming the existing session — exactly, then matching it
      // ignoring ASCII case alone (SPEC 10.1, 10.7).
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", R14_SESSION],
        R14_SESSION_REL,
        `${prefix} [create naming the existing session s exactly]`,
      );
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "create", "--strategy", "audit", "--name", "S"],
        R14_SESSION_REL,
        `${prefix} [create naming S, matching the existing session s ` +
          `ignoring ASCII case alone]`,
      );

      // `resolve` of a blocked item: p's, its blocker p.a's item unresolved.
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "resolve", R14_SESSION, pRow.id, "--status", "no-change"],
        R14_SESSION_REL,
        `${prefix} [resolve of p's item, blocked by p.a's unresolved item]`,
      );

      // `split` of a subtree-coherence item whose scope root has no
      // children: p.a's, a leaf's.
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "split", R14_SESSION, paRow.id],
        R14_SESSION_REL,
        `${prefix} [split of p.a's item, a leaf's: its scope root has no ` +
          `children]`,
      );

      // Splitting p's item yields p's parent-consistency item, blocked by
      // the per-child item — p.a's, reused (SPEC 10.7).
      await expectExit(
        product,
        workspace,
        ["review", "split", R14_SESSION, pRow.id],
        0,
        `${prefix} \`review split ${R14_SESSION} <p's item>\` — p has a ` +
          `child, so the split is performed (SPEC 10.7)`,
      );
      const afterSplit = await r14Status(
        product,
        workspace,
        `${prefix} after p's split`,
      );
      const pcRow = r14Row(
        afterSplit,
        "parent-consistency",
        R14_P,
        `${prefix} after p's split`,
      );
      r14ExpectRowState(
        pcRow,
        { status: "unresolved", blocked: true },
        "the decomposition's parent-consistency item, entering unresolved " +
          "and blocked by the per-child item, p.a's (SPEC 10.2, 10.7)",
        `${prefix} after p's split`,
      );

      // `split` of an item of another kind: p's parent-consistency item.
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "split", R14_SESSION, pcRow.id],
        R14_SESSION_REL,
        `${prefix} [split of p's parent-consistency item: an item of ` +
          `another kind]`,
      );

      // Re-blocking (SPEC 10.3, 10.4): p.a's item resolved, then
      // invalidated by its text's edit, re-blocks p's parent-consistency
      // item. The same edit deletes t's only child t.u.
      await expectExit(
        product,
        workspace,
        ["review", "resolve", R14_SESSION, paRow.id, "--status", "no-change"],
        0,
        `${prefix} \`review resolve ${R14_SESSION} <p.a's item> --status ` +
          `no-change\` — unblocked, so resolved (SPEC 10.7)`,
      );
      await workspace.file(R14_FILE, R14_EDITED);
      await buildOk(
        product,
        workspace,
        `${prefix} \`build\` after p.a's edit and t.u's deletion`,
      );
      const afterEdit = await r14Status(
        product,
        workspace,
        `${prefix} after the edit`,
      );
      r14ExpectRowState(
        r14Row(
          afterEdit,
          "subtree-coherence",
          R14_PA,
          `${prefix} after the edit`,
        ),
        { status: "invalidated", blocked: false },
        "resolved, then its scope's subtreeHash changed by the edit " +
          "(SPEC 10.4)",
        `${prefix} after the edit`,
      );
      r14ExpectRowState(
        r14Row(
          afterEdit,
          "parent-consistency",
          R14_P,
          `${prefix} after the edit`,
        ),
        { status: "unresolved", blocked: true },
        "re-blocked by p.a's item, which is invalidated, no resolved status " +
          "(SPEC 10.3)",
        `${prefix} after the edit`,
      );

      // `resolve` of a blocked item: p's parent-consistency item, its
      // blocker resolved and then invalidated.
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "resolve", R14_SESSION, pcRow.id, "--status", "no-change"],
        R14_SESSION_REL,
        `${prefix} [resolve of p's parent-consistency item, re-blocked by ` +
          `p.a's invalidated item]`,
      );

      // `split` of a subtree-coherence item whose scope root has no
      // children now: t's, its only child t.u deleted by manual edit after
      // `create`, though its scope as last assigned still lists t.u.
      await expectReviewRefusal(
        product,
        workspace,
        ["review", "split", R14_SESSION, tRow.id],
        R14_SESSION_REL,
        `${prefix} [split of t's item, its only child t.u deleted after ` +
          `create: its scope root has no children]`,
      );
    } finally {
      await workspace.dispose();
    }
  },
});

/** TEST-SPEC §10.7, third part, in canonical ID order. */
export const section107iiiTests: readonly ProductTestEntry[] = [T10_7_14];
