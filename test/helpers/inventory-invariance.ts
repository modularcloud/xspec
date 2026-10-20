// T11.6-1's member-invariance arm (TEST-SPEC T11.6-1, its last sentence;
// SPEC 1.5, 11.6) as one shared code path (C-2) for both legs: the
// registered body (test/suite/registry/section-11.6.ts) holds every run but
// the root's to the root run on the Linux leg, and the drive-mismatch arm
// (helpers/e6-drive-mismatch-arm.ts) holds its drive-mismatch runs to a
// root run on the Windows leg. Harness machinery only: no product imports
// and no test-framework dependence — the product is driven strictly as a
// subprocess through the ProductBinding it is handed (H-2).
//
// SPEC 11.6 anchors `root` and `config` alone to the invocation working
// directory; every other path the inventory reports is workspace-relative,
// as every path in every output is (1.5). So, on a workspace staged to give
// every path-bearing member content — built with Markdown emission enabled
// (the derived map's Markdown destinations, the record's paths), a journal
// (a journaled `rename`, 6.1), and a review session (`review create`, 10.1)
// — every member but `root` and `config` (`findings`, `configuration`,
// `sources`, `derived`, `recorded`, `graphData`, `journal`, `sessions`,
// `lock`) is byte-identical whatever the working directory, and every answer
// reports `graphData` exactly `.xspec`, `journal`'s `path` exactly
// `.xspec/journal`, and `lock` exactly `.xspec/lock`: a product relativizing
// every path to the working directory (`../../.xspec/lock` from `a/b`)
// fails, and so does one judging the journal's occupancy, the session
// listing, or the record through a path resolved against the working
// directory rather than the root, or one spelling the area, the journal
// path, or the lock path otherwise in every answer alike, which the
// byte-identity alone would admit. The staging premise is asserted on the
// root run's answer — each path-bearing member non-empty, the journal
// occupied — so no member's comparison is vacuous.
//
// Members compare as decoded 12.7 values (helpers/adapters/forms.ts
// `decodeInventoryDocument`, form-exact, its object members in the decoder's
// own order): every string exactly — each path's bytes, in its plain or
// marked byte form — and every list in its reported order. The JSON text's
// insignificant whitespace and escape spellings are not member content.

import type { InventoryDocument } from "./adapters/index.js";
import { GRAPH_DATA_AREA_PATH, renderPathValue } from "./adapters/index.js";
import { assertExitCode, fail } from "./assertions.js";
import { LOCK_PATH } from "./lock-path.js";
import type { ProductBinding } from "./subprocess.js";
import { runProduct } from "./subprocess.js";

/**
 * Every member of the 12.7 inventory document but the anchoring (`root`,
 * `config`), in the document's order: the members SPEC 11.6 leaves
 * invariant under the working directory (TEST-SPEC T11.6-1).
 */
export const WORKING_DIRECTORY_INVARIANT_MEMBERS = [
  "findings",
  "configuration",
  "sources",
  "derived",
  "recorded",
  "graphData",
  "journal",
  "sessions",
  "lock",
] as const satisfies readonly (keyof InventoryDocument)[];

/** The staging that gives every path-bearing member content (header). */
export interface InvarianceStaging {
  /** The spec source the journaled `rename` edits, workspace-relative. */
  readonly source: string;
  /** The `rename`'s `<old-id>`, an ID the source declares (SPEC 6.4). */
  readonly renameFrom: string;
  /** The `rename`'s `<new-id>`, an ID nothing declares yet (SPEC 6.4). */
  readonly renameTo: string;
  /** The audit session's name (SPEC 10.1). */
  readonly session: string;
}

/**
 * Stage the arm's workspace through the product itself, from the workspace
 * root: `build` (the configuration enables Markdown emission, so the record
 * lists modules and Markdown, 13.3), a journaled `rename` (the journal,
 * 6.1, 6.4; its finishing regeneration leaves the workspace built, 6.4), and
 * `review create --strategy audit` (a session, 10.1) — each exiting 0
 * (H-5). Against a stub or nonconforming product the first step fails,
 * diagnosed.
 */
export async function stageInvarianceWorkspace(
  product: ProductBinding,
  root: string,
  staging: InvarianceStaging,
  context: string,
): Promise<void> {
  const steps: readonly {
    readonly argv: readonly string[];
    readonly why: string;
  }[] = [
    {
      argv: ["build"],
      why:
        "the staged workspace is valid, with Markdown emission enabled " +
        "(SPEC 12.1, 7.3)",
    },
    {
      argv: ["rename", staging.source, staging.renameFrom, staging.renameTo],
      why:
        "a journaled rename of a declared ID to a fresh one succeeds, " +
        "appending the journal and regenerating the derived files exactly " +
        "as build does (SPEC 6.4, 6.1)",
    },
    {
      argv: [
        "review",
        "create",
        "--strategy",
        "audit",
        "--name",
        staging.session,
      ],
      why: "an audit session over the built workspace is created (SPEC 10.1)",
    },
  ];
  for (const step of steps) {
    const result = await runProduct(product, { cwd: root, argv: step.argv });
    assertExitCode(
      result,
      0,
      `${context} — staging \`${step.argv.join(" ")}\` from the workspace ` +
        `root: ${step.why}`,
    );
  }
}

/**
 * The staging premise, on the root run's answer: every path-bearing member
 * carries content — a source, its derived entry with a module and a
 * Markdown destination (emission enabled, 7.3), a non-empty record (the
 * workspace built, 13.3), the journal occupied (6.1), and a session listed
 * (10.1) — so the invariance below compares content, never two empty
 * members (SPEC 11.6).
 */
export function assertInvariancePremise(
  document: InventoryDocument,
  context: string,
): void {
  const vacuous: string[] = [];
  if (document.sources.length === 0) {
    vacuous.push("`sources` lists no discovered source (SPEC 11.6, 7.1)");
  }
  if (
    document.derived.length === 0 ||
    document.derived.some(
      (entry) => entry.module === null || entry.markdown === null,
    )
  ) {
    vacuous.push(
      "`derived` lacks a spec source's generated module or Markdown " +
        "destination, though emission is enabled (SPEC 11.6, 13.1, 7.3)",
    );
  }
  if (
    document.recorded.state !== "value" ||
    document.recorded.value.length === 0
  ) {
    vacuous.push(
      "`recorded` is not a non-empty list, though the workspace was built " +
        "and regenerated by the rename (SPEC 11.6, 13.3)",
    );
  }
  if (!document.journal.occupied) {
    vacuous.push(
      "`journal` is unoccupied, though the journaled rename wrote it " +
        "(SPEC 11.6, 6.1)",
    );
  }
  if (document.sessions.length === 0) {
    vacuous.push(
      "`sessions` lists no session, though `review create` wrote one " +
        "(SPEC 11.6, 10.1)",
    );
  }
  if (vacuous.length === 0) return;
  fail(
    `${context}: on the workspace built with Markdown emission enabled, a ` +
      `journal, and a review session, every path-bearing member of the ` +
      `root run's answer carries content — the reference every other run's ` +
      `members are compared with (TEST-SPEC T11.6-1); instead ` +
      `${vacuous.join("; ")}`,
  );
}

/** The journal's workspace-relative path (SPEC 6.1). */
const JOURNAL_PATH = `${GRAPH_DATA_AREA_PATH}/journal`;

/**
 * The area, journal, and lock members' exact spellings, in every answer:
 * `graphData` exactly `.xspec`, `journal`'s `path` exactly
 * `.xspec/journal`, and `lock` exactly `.xspec/lock` — workspace-relative
 * whatever the working directory, no trailing separator (SPEC 11.6, 12.7,
 * 1.5, 6.1, 13.5; TEST-SPEC T11.6-1). The journal's occupancy is the
 * invariance's (`assertMembersInvariant`), never pinned here.
 */
export function assertAreaJournalAndLockSpellings(
  document: InventoryDocument,
  context: string,
): void {
  if (document.graphData !== GRAPH_DATA_AREA_PATH) {
    fail(
      `${context}: the graph-data area is reported as its workspace-` +
        `relative path, exactly ${JSON.stringify(GRAPH_DATA_AREA_PATH)} ` +
        `whatever the working directory — 11.6 anchors \`root\` and ` +
        `\`config\` alone (SPEC 11.6, 1.5, 13.3); got ` +
        `${renderPathValue(document.graphData)}`,
    );
  }
  if (document.journal.path !== JOURNAL_PATH) {
    fail(
      `${context}: the journal path is reported as its workspace-relative ` +
        `path, exactly ${JSON.stringify(JOURNAL_PATH)} whatever the working ` +
        `directory — xspec maintains the journal there, and 11.6 anchors ` +
        `\`root\` and \`config\` alone (SPEC 11.6, 6.1, 1.5); got ` +
        `${renderPathValue(document.journal.path)}`,
    );
  }
  if (document.lock !== LOCK_PATH) {
    fail(
      `${context}: the lock path is reported as its workspace-relative ` +
        `path, exactly ${JSON.stringify(LOCK_PATH)} whatever the working ` +
        `directory — 11.6 anchors \`root\` and \`config\` alone (SPEC ` +
        `11.6, 1.5, 13.5); got ${renderPathValue(document.lock)}`,
    );
  }
}

/** A member's decoded value, rendered for comparison and diagnosis. */
function renderMember(
  document: InventoryDocument,
  member: (typeof WORKING_DIRECTORY_INVARIANT_MEMBERS)[number],
): string {
  return JSON.stringify(document[member]) ?? "undefined";
}

/** At most `limit` characters of a rendering, the cut marked. */
function clip(rendered: string, limit = 600): string {
  return rendered.length <= limit
    ? rendered
    : `${rendered.slice(0, limit)}… (${String(rendered.length)} characters)`;
}

/**
 * The invariance itself: every member but `root` and `config` of
 * `document` is byte-identical to `reference`'s (the root run's answer,
 * `referenceName` naming it, e.g. "the root run's answer"), each differing
 * member named with both values (SPEC 11.6, 1.5; TEST-SPEC T11.6-1).
 */
export function assertMembersInvariant(
  document: InventoryDocument,
  reference: InventoryDocument,
  referenceName: string,
  context: string,
): void {
  const differing = WORKING_DIRECTORY_INVARIANT_MEMBERS.filter(
    (member) =>
      renderMember(document, member) !== renderMember(reference, member),
  );
  if (differing.length === 0) return;
  fail(
    `${context}: every member but \`root\` and \`config\` is invariant ` +
      `under the working directory — 11.6 anchors those two alone, and ` +
      `every other path is workspace-relative in every output (SPEC 11.6, ` +
      `1.5, 12.0) — so each is byte-identical to its value in ` +
      `${referenceName}; ` +
      `${differing
        .map(
          (member) =>
            `\`${member}\` differs: got ` +
            `${clip(renderMember(document, member))}; in ${referenceName}: ` +
            `${clip(renderMember(reference, member))}`,
        )
        .join("; ")}`,
  );
}
