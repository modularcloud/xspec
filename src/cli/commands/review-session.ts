// The review command family's shared session engine (SPEC 10.4, 10.7).
//
// IMPLEMENTATION (Architecture): the cli layer owns dispatch, rendering, and
// the exit-code taxonomy; the pure derivation machinery lives in the core
// (review.ts, review-state.ts, review-derive.ts, path-blocks.ts, audit.ts,
// coverage-session.ts) and the I/O in the workspace layer (reviews.ts,
// baseline.ts, refresh.ts). This module composes them into the one flow
// every session-naming subcommand shares:
//
// 1. Session-name validity is the parser's (cli/args.ts): a name outside
//    the form of 10.1 is a usage error of 12.0's syntax class, exit 2,
//    reported before the configuration is loaded — so every name reaching
//    this flow is well-formed.
// 2. Analyze the workspace (a pure read): configuration errors keep their
//    exit-2 precedence over every later check (SPEC 14.14, 12.0).
// 3. Session existence, judged against the session directory alone — no
//    content read (SPEC 12.0, 10.1): an absent session is an unknown
//    session named in arguments, exit 2, whatever findings the workspace
//    carries.
// 4. The gate (SPEC 13.3): on a workspace failing `build`'s validations
//    the gate's findings report alone, exit 1, and no session file is read
//    — a session's corruption (14.21) is reported exactly where sessions
//    are read, on a passing workspace (SPEC 10.1).
// 5. The session read, past the passing gate: corrupt → the 14.21 finding,
//    exit 1, modifying nothing.
// 6. The item ID of `show`, `resolve`, and `split` (SPEC 10.7, 12.0),
//    judged against the session's stored items past the session read and
//    before the recorded baseline: an unknown item is a usage error, exit
//    2, met before any git read (SPEC's preamble: git data is read only
//    where stated) and before any write.
// 7. For a readable `path-blocks` session, resolve the recorded baseline
//    commit (SPEC 10.7: every later generator run uses the recorded
//    parameters). A baseline that cannot be resolved or reconstructed
//    fails per 6.3 as a usage error (exit 2), modifying nothing; a corrupt
//    session has no readable parameters, the corruption reporting instead.
// 8. Re-run the session's strategy generators with the recorded creation
//    parameters against the current workspace (SPEC 10.4, 10.7),
//    canonicalized at the derivation seam (core/review-derive.ts
//    `canonicalizeGeneration` — stored references and generated nodes
//    compare canonically, SPEC 5.4), replay the recorded decompositions
//    (SPEC 10.5), and derive the read-time view: effective statuses
//    (read-time invalidation — a stale resolution is reported
//    `invalidated`, never persisted), blocked states over those statuses
//    (SPEC 10.3), and the presentation item order (10.5–10.7) over derived
//    current spellings.
// 9. The refresh write of 13.3 (SPEC 10.7, 13.5): the gate's assessment
//    decided it without writing, and it commits only once every outcome
//    has passed — a read's (the steps above) just before the read answers;
//    `resolve`'s and `split`'s past their refusals and the session path's
//    14.22 check, right before the session file's write
//    (./review-mutate.ts) — so each outcome ends the subcommand with stale
//    graph data still stale, and every judgement turning on the graph is
//    made against the current workspace (and, in a baseline session, the
//    recorded baseline), never against stale graph data (SPEC 10.7, 13.3).
//
// The payload renderers below fix the self-contained text payload of
// SPEC 10.7 once, so `show`, `export`, and `next --json` can never disagree:
// every scope, context, and origin node under its current identity — the
// stored canonical reference's derived current spelling (SPEC 10.4, 6.3) —
// and presence, source ranges for present requirement nodes, the recorded
// `baseline`/`current` states, and text per item kind — a present node's
// text from the current graph, an absent node's from the most recent
// recorded state containing it (the derivation-time snapshots, else the
// item's baseline state: its baseline snapshots, and in a baseline session
// the recorded-baseline graph the read reconstructed), and no text for a
// node contained in none or for a code-location scope — each origin node's
// before/after pair of own text — before from the item's baseline state,
// in a baseline session the recorded-baseline graph the read reconstructed
// (a node that joined the origin later included), after from the current
// graph — and, on a `metadata-consistency` item, its scope node's metadata
// pair (core/review-metadata.ts). The context presented is the item's current
// context set (SPEC 10.4: computed by the read, never persisted), while
// `scope`, `origin`, `reason`, and `blockedBy` present as last assigned.

import { generateAuditItems } from "../../core/audit.js";
import type { JsonObject } from "../../core/canonical-json.js";
import { generateCoverageSessionItems } from "../../core/coverage-session.js";
import type { SourceClassification } from "../../core/discovery.js";
import type { ExitCode, Finding } from "../../core/findings.js";
import { generatePathBlocksItems } from "../../core/path-blocks.js";
import type {
  ItemKind,
  ItemStatus,
  RecordedState,
  RecordedTexts,
  ReviewItem,
  ReviewSession,
  SessionParameters,
} from "../../core/review.js";
import {
  isItemBlocked,
  recordedStateToJson,
  sessionStrategy,
} from "../../core/review.js";
import type {
  DecompositionContentSource,
  GeneratedItem,
} from "../../core/review-derive.js";
import {
  canonicalizeGeneration,
  currentContextSets,
  expandDecompositions,
  sortItemsByFileThenDocument,
  sortItemsPathBlocks,
} from "../../core/review-derive.js";
import type { BaselineDerivationSide } from "../../core/review-derive.js";
import type { MetadataSide } from "../../core/review-metadata.js";
import { metadataPairOf } from "../../core/review-metadata.js";
import type { ReviewStateInputs } from "../../core/review-state.js";
import {
  deriveEffectiveStatuses,
  presentRecordedState,
  resolveReference,
  resolveReferenceAt,
} from "../../core/review-state.js";
import type { ResolvedBaseline } from "../../workspace/baseline.js";
import { resolveBaseline } from "../../workspace/baseline.js";
import { loadSession, sessionOccupied } from "../../workspace/reviews.js";
import type { WorkspaceAnalysis } from "../../workspace/pipeline.js";
import { assessWorkspaceRead } from "../../workspace/refresh.js";
import type { Invocation } from "../args.js";
import type { CliWriter, CommandContext } from "../io.js";
import { analyzeGraphForRead } from "../prepare.js";
import { emitFindingsReport } from "../report.js";
import { rangeJson, reportBaselineFailure, usageError } from "./common.js";

// ---------------------------------------------------------------------------
// Generator runs with recorded parameters (SPEC 10.4, 10.7)
// ---------------------------------------------------------------------------

/** One strategy-generator run, normalized across the three strategies and
 * canonicalized at the derivation seam (core/review-derive.ts
 * `canonicalizeGeneration`): every generated node and blocker reference is
 * a stored canonical reference (SPEC 5.4, 10.4). */
export interface SessionGenerationRun {
  /** The canonicalized generated items, before decomposition replay
   * (SPEC 10.5). */
  readonly items: readonly GeneratedItem[];
  /** The strategy's decomposition content (SPEC 10.7), in
   * canonical-reference space. */
  readonly contentSource: DecompositionContentSource;
  /**
   * SPEC 10.4/9.2: per canonical code-location reference, the canonical
   * impact-edge target references — `path-blocks` only; the other
   * strategies scope no code.
   */
  readonly impactTargets?: ReadonlyMap<string, readonly string[]>;
  /**
   * The recorded-baseline derivation side (SPEC 10.2: new items' `baseline`
   * states) — `path-blocks` only; an `audit`/`coverage` item's `baseline`
   * is the current graph's values at entry.
   */
  readonly baseline?: BaselineDerivationSide;
}

/**
 * Run the session's strategy generators with the recorded creation
 * parameters against the current workspace (SPEC 10.4, 10.7: the recorded
 * commit as the baseline, the recorded globs matched against the currently
 * discovered sources, nothing for `audit`), then canonicalize the run at
 * the derivation seam. For `path-blocks` the caller has already resolved
 * the recorded baseline (`resolveRecordedBaseline`).
 */
export function runSessionGenerators(
  parameters: SessionParameters,
  analysis: WorkspaceAnalysis,
  baseline: ResolvedBaseline | undefined,
): SessionGenerationRun {
  const journal = analysis.journal.journal;
  switch (parameters.strategy) {
    case "path-blocks": {
      if (baseline === undefined) {
        throw new Error(
          "xspec internal error: a path-blocks generator run needs the " +
            "resolved recorded baseline (SPEC 10.7)",
        );
      }
      const generation = generatePathBlocksItems(
        {
          graph: baseline.analysis.graph,
          hashes: baseline.analysis.hashes,
          journal: baseline.analysis.journal.journal,
        },
        {
          graph: analysis.graph,
          hashes: analysis.hashes,
          journal,
        },
      );
      // SPEC 6.3: the baseline journal is a prefix of the current one, so
      // its entry count is the baseline journal prefix length the
      // canonicalization anchors deleted baseline nodes at.
      const baselineJournalLength =
        baseline.analysis.journal.journal.entries.length;
      const canonical = canonicalizeGeneration(
        {
          items: generation.items,
          contentSource: generation.contentSource,
          impactTargets: generation.impactTargets,
        },
        { journal, baselineJournalLength },
      );
      return {
        items: canonical.items,
        contentSource: canonical.contentSource,
        impactTargets: canonical.impactTargets,
        baseline: {
          graph: baseline.analysis.graph,
          hashes: baseline.analysis.hashes,
          textModel: baseline.analysis.textModel,
          journal,
          journalLength: baselineJournalLength,
        },
      };
    }
    case "audit": {
      // SPEC 10.7: an audit session records no creation parameters — its
      // generators run against the current workspace as it stands.
      const generation = generateAuditItems(analysis.graph);
      const canonical = canonicalizeGeneration(
        { items: generation.items, contentSource: generation.contentSource },
        { journal },
      );
      return {
        items: canonical.items,
        contentSource: canonical.contentSource,
      };
    }
    case "coverage": {
      const generation = generateCoverageSessionItems(
        analysis.graph,
        parameters.profile,
      );
      const canonical = canonicalizeGeneration(
        { items: generation.items, contentSource: generation.contentSource },
        { journal },
      );
      return {
        items: canonical.items,
        contentSource: canonical.contentSource,
      };
    }
  }
}

/** `ReviewStateInputs` over the current analysis and a generation run —
 * total for every stored item (an externally injected `code-impact` item in
 * a strategy without impact data reads an empty target set rather than
 * failing, keeping reads deterministic). */
export function generationStateInputs(
  analysis: WorkspaceAnalysis,
  generation: SessionGenerationRun,
): ReviewStateInputs {
  const impactTargets = generation.impactTargets;
  return {
    graph: analysis.graph,
    hashes: analysis.hashes,
    journal: analysis.journal.journal,
    impactTargets: (location): readonly string[] =>
      impactTargets === undefined ? [] : (impactTargets.get(location) ?? []),
  };
}

// ---------------------------------------------------------------------------
// The read-time view (SPEC 10.4)
// ---------------------------------------------------------------------------

/** A session's read-time view: canonical references, invalidation applied. */
export interface SessionReadView {
  readonly name: string;
  /** As stored — canonical references (SPEC 5.4, 10.4: comparisons are
   * byte-wise over them; presentation derives current spellings). */
  readonly session: ReviewSession;
  /** The decomposition-expanded generator run (SPEC 10.5, 10.7). */
  readonly expanded: readonly GeneratedItem[];
  readonly generation: SessionGenerationRun;
  /**
   * SPEC 10.4: each item's current context set, by item ID — the context
   * the generators, run with the recorded creation parameters and
   * decompositions against the current workspace, assign it — as canonical
   * references (`currentContextSets`). An item the generators no longer
   * produce is absent here: its current context set is its `context` as
   * last assigned (`presentedContext`). Computed, never persisted.
   */
  readonly currentContexts: ReadonlyMap<string, readonly string[]>;
  /** SPEC 10.4: effective statuses — read-time invalidation applied. */
  readonly statuses: ReadonlyMap<string, ItemStatus>;
  /** SPEC 10.3: blocked states over the effective statuses. */
  readonly blocked: ReadonlyMap<string, boolean>;
  /** The session's items in presentation order (SPEC 10.5–10.7). */
  readonly ordered: readonly ReviewItem[];
  readonly analysis: WorkspaceAnalysis;
}

/**
 * Derive a session's read-time view (module header step 8). Nothing is
 * persisted: read-time invalidation is computed and reported, never written
 * (SPEC 10.4). The stored session is consumed as-is — stored references
 * are canonical identities (SPEC 5.4), eternal under journal growth, so no
 * read-time identity rewrite exists.
 */
export function buildSessionReadView(
  name: string,
  stored: ReviewSession,
  generation: SessionGenerationRun,
  analysis: WorkspaceAnalysis,
): SessionReadView {
  const journal = analysis.journal.journal;
  const session = stored;
  // SPEC 10.5/10.7: the recorded decompositions replay over the generation.
  const expanded = expandDecompositions(
    generation.items,
    session.decompositions.map((decomposition) => decomposition.scope),
    analysis.graph,
    journal,
    generation.contentSource,
  );
  const stateInputs = generationStateInputs(analysis, generation);
  // SPEC 10.4: the current context sets — computed without persisting
  // anything, fed to context-set invalidation and presented as each item's
  // `context` (`presentedContext`).
  const currentContexts = currentContextSets(session.items, expanded);
  // SPEC 10.4: effective statuses — a stale resolution reads `invalidated`.
  const statuses = deriveEffectiveStatuses(session.items, {
    state: stateInputs,
    currentContexts,
  });
  // SPEC 10.3: blocked over the effective statuses — a blocker that became
  // invalidated re-blocks its dependents.
  const blocked = new Map<string, boolean>();
  for (const item of session.items) {
    blocked.set(
      item.id,
      isItemBlocked(item, (id) => statuses.get(id) ?? "unresolved"),
    );
  }
  // SPEC 10.5 (path-blocks total order), 10.6 (audit), 10.7 (coverage) —
  // ranked over the scope references' derived current spellings (10.4).
  const ordered =
    sessionStrategy(session) === "path-blocks"
      ? sortItemsPathBlocks(session.items, analysis.graph, journal)
      : sortItemsByFileThenDocument(session.items, analysis.graph, journal);
  return {
    name,
    session,
    expanded,
    generation,
    currentContexts,
    statuses,
    blocked,
    ordered,
    analysis,
  };
}

/**
 * SPEC 10.4: the context a read presents for an item — its current context
 * set: the generators' assignment where they still produce the item (kind
 * and scope node matched canonically, `currentContextSets`), otherwise its
 * `context` as last assigned (by `create`, a re-derivation, a `split`, or a
 * resolve). Reads present it as the item's `context` (10.7), so a
 * context-set change shows without waiting for a re-derivation, while
 * `scope`, `origin`, `reason`, and `blockedBy` stay as last assigned.
 */
export function presentedContext(
  view: SessionReadView,
  item: ReviewItem,
): readonly string[] {
  return view.currentContexts.get(item.id) ?? item.context;
}

// ---------------------------------------------------------------------------
// The shared open flow (module header steps 1–9)
// ---------------------------------------------------------------------------

/** The open outcome: the view and the named item, or an already-emitted
 * exit code. */
export type SessionOpenResult =
  | {
      readonly ok: true;
      readonly view: SessionReadView;
      /** The item `show` names (module header step 6); absent for the
       * reads naming none. */
      readonly item?: ReviewItem;
    }
  | { readonly ok: false; readonly exit: ExitCode };

/**
 * Open a named session for a read (`status`, `next`, `show`, `export`) —
 * the module header's steps 1–9, `itemId` being `show`'s item operand.
 * Failures are fully reported here; the caller returns `exit` unchanged.
 * Every outcome of a read is met here, so the refresh write commits here
 * too, last: the caller answers right after, with no outcome of its own
 * in between (SPEC 10.7: "A read subcommand answers only then"). Mutating
 * subcommands share steps 1–7 through `loadSessionForCommand`, run their
 * own derivation and refusals, and commit the refresh themselves.
 */
export async function openSessionForRead(
  name: string,
  invocation: Invocation,
  context: CommandContext,
  itemId?: string,
): Promise<SessionOpenResult> {
  const loaded = await loadSessionForCommand(name, invocation, context, {
    itemId,
  });
  if (!loaded.ok) {
    return loaded;
  }
  const generation = runSessionGenerators(
    loaded.session.parameters,
    loaded.analysis,
    loaded.baseline,
  );
  const view = buildSessionReadView(
    name,
    loaded.session,
    generation,
    loaded.analysis,
  );
  // Step 9 — SPEC 10.7, 13.3: past every outcome the refresh write (a no-op
  // when the store already matches); a write the environment refuses fails
  // the read before it answers (14.24).
  await loaded.commitRefresh();
  return { ok: true, view, item: loaded.item };
}

/** What a subcommand hands `loadSessionForCommand` beside the name. */
export interface SessionLoadOptions {
  /** The item operand of `show`, `resolve`, and `split` (SPEC 10.7). */
  readonly itemId?: string;
  /** The classification a mutating subcommand's second discovery made
   * holding exclusivity (SPEC 13.5; ./mutation.ts). */
  readonly discovered?: SourceClassification;
}

/** Steps 1–7 of the open flow: the stored session, the current analysis,
 * the named item, and — for a `path-blocks` session — the resolved
 * recorded baseline, with the refresh write of 13.3 handed back
 * uncommitted. */
export interface LoadedSessionForCommand {
  readonly ok: true;
  readonly session: ReviewSession;
  readonly analysis: WorkspaceAnalysis;
  /** The stored item `options.itemId` names (step 6); absent when the
   * subcommand names none. */
  readonly item?: ReviewItem;
  readonly baseline?: ResolvedBaseline;
  /**
   * Step 9 — SPEC 10.7, 13.3, 13.5: the refresh write (a no-op when the
   * stored graph data already matches), the caller's to run, once, when
   * every outcome of its own has passed: a read just before answering,
   * `resolve` and `split` past their refusals and the session path's
   * 14.22 check, right before the session file's write.
   */
  readonly commitRefresh: () => Promise<void>;
}

export async function loadSessionForCommand(
  name: string,
  invocation: Invocation,
  context: CommandContext,
  options: SessionLoadOptions = {},
): Promise<
  LoadedSessionForCommand | { readonly ok: false; readonly exit: ExitCode }
> {
  const { itemId, discovered } = options;
  // Step 1 — the name's form (SPEC 10.1) was judged by the parser
  // (cli/args.ts) before the configuration was loaded: a name outside it
  // is a syntax-class usage error (SPEC 12.0).

  // Step 2 — SPEC 14.14/12.0: analyze the current workspace — a pure read;
  // configuration errors precede every argument check that consults the
  // workspace, the unknown-session check below included. A mutating
  // subcommand hands in the classification its second discovery made
  // holding exclusivity, its configuration errors already reported there
  // (SPEC 13.5; ./mutation.ts).
  const analyzed = await analyzeGraphForRead(invocation, context, discovered);
  if (!analyzed.ok) {
    return { ok: false, exit: analyzed.exit };
  }

  // Step 3 — SPEC 12.0/10.1: the session name is judged against the
  // session directory — existence by directory entry alone, no session
  // content read — before the invalid-workspace report of 13.3: an unknown
  // session is a usage error, exit 2, whatever findings the workspace
  // carries.
  if (!(await sessionOccupied(context.workspace.root, name))) {
    return {
      ok: false,
      exit: unknownSessionError(name, invocation, context),
    };
  }

  // Step 4 — the gate (SPEC 13.3): on a workspace failing `build`'s
  // validations — validation findings and a refused refresh write
  // (SPEC 14.22) alike — the gate's findings are reported alone, exit 1,
  // and no session file is read: a session's corruption (14.21) is
  // reported exactly where sessions are read, on a passing workspace
  // (SPEC 10.1, 12.0). The assessment decides without writing; its one
  // refresh write is handed back uncommitted (step 9), the caller running
  // it once every outcome of its own has passed (SPEC 10.7, 13.5).
  const assessed = await assessWorkspaceRead(
    context.workspace,
    analyzed.analysis,
  );
  if (assessed.kind === "findings") {
    emitFindingsReport(invocation.json, context.stdout, assessed.findings);
    return { ok: false, exit: 1 };
  }

  // Step 5 — the workspace passes: sessions are read here (SPEC 10.1).
  // Corrupt = the 14.21 finding, exit 1, modifying nothing; absent (the
  // occupant vanished since step 3) = unknown session (SPEC 10.7 → 12.0).
  const loaded = await loadSession(context.workspace.root, name);
  if (loaded.state === "absent") {
    return {
      ok: false,
      exit: unknownSessionError(name, invocation, context),
    };
  }
  if (loaded.state === "corrupt") {
    emitFindingsReport(invocation.json, context.stdout, [loaded.finding]);
    return { ok: false, exit: 1 };
  }

  // Step 6 — SPEC 10.7, 12.0: an unknown item ID, judged against the
  // session's stored items once the session read has met any corruption,
  // and before the recorded baseline: the usage error, exit 2, ends the
  // subcommand before any git read (SPEC's preamble: git data is read only
  // where stated) and before any write — stale graph data stays stale.
  let item: ReviewItem | undefined;
  if (itemId !== undefined) {
    item = loaded.session.items.find((candidate) => candidate.id === itemId);
    if (item === undefined) {
      return {
        ok: false,
        exit: unknownItemError(invocation, context, name, itemId),
      };
    }
  }

  // Step 7 — SPEC 10.7/6.3/12.0: resolve the recorded baseline of a
  // readable session — past the gate, one of 12.0's two usage-class checks
  // running there; failure is a usage error, nothing modified (the refresh
  // write has not run). A corrupt session has no readable parameters — the
  // corruption (or, on a failing workspace, the gate) reports instead.
  let baseline: ResolvedBaseline | undefined;
  if (loaded.session.parameters.strategy === "path-blocks") {
    // The current journal as the analysis loaded it, read once — past the
    // passing gate, free of condition-13 errors (SPEC 13.3, 14.13).
    const resolution = await resolveBaseline(
      context.workspace,
      loaded.session.parameters.baseCommit,
      analyzed.analysis.journal,
    );
    if (!resolution.ok) {
      return {
        ok: false,
        exit: reportBaselineFailure(
          invocation,
          context,
          resolution,
          `the recorded baseline of session '${name}' cannot be ` +
            `reconstructed: `,
        ),
      };
    }
    baseline = resolution.baseline;
  }

  // Step 9 is the caller's: the refresh write of 13.3 commits only past
  // every outcome of its own (SPEC 10.7, 13.5).
  return {
    ok: true,
    session: loaded.session,
    analysis: analyzed.analysis,
    item,
    baseline,
    commitRefresh: assessed.commit,
  };
}

/** SPEC 10.7 → 12.0: an unknown item ID in a review command's arguments. */
function unknownItemError(
  invocation: Invocation,
  context: CommandContext,
  name: string,
  itemId: string,
): ExitCode {
  return usageError(
    invocation,
    context,
    `unknown item '${itemId}' in session '${name}' — no item of the ` +
      `session has that id (SPEC 10.7, 12.0)`,
  );
}

/** SPEC 10.7 → 12.0: an unknown session named in arguments. */
export function unknownSessionError(
  name: string,
  invocation: Invocation,
  context: CommandContext,
): ExitCode {
  return usageError(
    invocation,
    context,
    `unknown session '${name}' — the session directory .xspec/reviews/ ` +
      `holds no session file ${name}.json (it holds sessions only while ` +
      `directories occupy its path and .xspec, never through a symbolic ` +
      `link or other non-directory occupant, SPEC 10.1, 13.4); session ` +
      `names compare byte-wise and case-sensitively (SPEC 10.1, 10.7, 12.0)`,
  );
}

// ---------------------------------------------------------------------------
// Payload rendering (SPEC 10.7 — one payload rule for show/export/next)
// ---------------------------------------------------------------------------

/** Which text value a node presents in a payload role (SPEC 10.7). */
type TextSelection = "own" | "subtree" | "code";

/** SPEC 10.7: scope text per kind — subtree text for `subtree-coherence`
 * and `uncovered-requirement`, own text for the consistency kinds, none for
 * a code location. */
function scopeTextSelection(kind: ItemKind): TextSelection {
  switch (kind) {
    case "subtree-coherence":
    case "uncovered-requirement":
      return "subtree";
    case "parent-consistency":
    case "dependency-consistency":
    case "metadata-consistency":
      return "own";
    case "code-impact":
      return "code";
  }
}

/** SPEC 10.7: context text — own text where the context is an ancestor
 * chain (`subtree-coherence`, `uncovered-requirement`), subtree text
 * otherwise (branch children; dependency/metadata/code-impact targets). */
function contextTextSelection(kind: ItemKind): TextSelection {
  switch (kind) {
    case "subtree-coherence":
    case "uncovered-requirement":
      return "own";
    default:
      return "subtree";
  }
}

/**
 * SPEC 10.7: an absent node's text is its value in the most recent graph
 * state that contained it, among the item's baseline state (10.2) and the
 * states under which mutating subcommands derived the item with that node
 * among its nodes — the derivation-time snapshots are rewritten per node at
 * each derivation that finds it present, so they are the most recent
 * wherever they exist; else the item's baseline state: its baseline
 * snapshots (the nodes it held at entry), and — in a baseline session,
 * whose items' baseline state is the graph at the recorded baseline — that
 * graph itself (`baselineGraphTexts`), which holds a node that joined the
 * item later too: a node entering the current context set at a read
 * (SPEC 10.4), or one a re-derivation joined while already absent. A node
 * contained in none has no text. The tables are keyed by canonical
 * reference (10.4), so the lookup is exact whatever the node's spelling
 * became.
 */
function absentNodeText(
  view: SessionReadView,
  item: ReviewItem,
  reference: string,
  selection: TextSelection,
): string | undefined {
  if (selection === "code") {
    return undefined;
  }
  const recorded =
    item.derivedTexts[reference] ??
    item.baselineTexts[reference] ??
    baselineGraphTexts(view, reference);
  if (recorded === undefined) {
    return undefined;
  }
  return selection === "own" ? recorded.ownText : recorded.subtreeText;
}

/**
 * A stored reference's texts in the recorded-baseline graph a baseline
 * session's read reconstructed (`view.generation.baseline`; SPEC 10.2: the
 * item's baseline state in a baseline session) — the reference resolved as
 * of the baseline journal prefix (SPEC 6.3: the baseline journal is a
 * prefix of the current one; `resolveReferenceAt`), so a node that entered
 * the workspace after the baseline, or whose spelling a distinct chain bore
 * there, finds none. Undefined in a session without a baseline (`audit`,
 * `coverage`), whose items' baseline state — the current graph at entry —
 * survives only in their entry-time snapshots.
 */
function baselineGraphTexts(
  view: SessionReadView,
  reference: string,
): RecordedTexts | undefined {
  const baseline = view.generation.baseline;
  if (baseline === undefined) {
    return undefined;
  }
  const { spelling, resolves } = resolveReferenceAt(
    baseline.journal,
    baseline.journalLength,
    reference,
  );
  const node = resolves ? baseline.graph.requirementNode(spelling) : undefined;
  if (node === undefined) {
    return undefined;
  }
  return {
    ownText: baseline.textModel.ownText(node.document, node.section),
    subtreeText: baseline.textModel.subtreeText(node.document, node.section),
  };
}

/**
 * One payload node (SPEC 10.7): identity, presence, the role's text, and —
 * for a present graph node, requirement node and code location alike — its
 * source range (1.7: review payloads are one of the two range-presenting
 * outputs for code locations), read from the current graph. The stored
 * canonical reference surfaces as its derived current spelling (SPEC 10.4:
 * every recorded node presented under its current identity), while
 * presence is judged by canonical resolution (10.4): a dangling reference
 * — its identity ceased to resolve through the journal — presents absent,
 * with no source range and the absent-node text rule, even though its
 * presented spelling matches the distinct node that recaptured it. A code
 * location (`selection === "code"`) carries no text value either way.
 */
function nodeStateJson(
  view: SessionReadView,
  item: ReviewItem,
  reference: string,
  selection: TextSelection,
): JsonObject {
  const { spelling, resolves } = resolveReference(
    view.analysis.journal.journal,
    reference,
  );
  if (selection === "code") {
    const location = resolves
      ? view.analysis.graph.codeLocation(spelling)
      : undefined;
    if (location !== undefined) {
      // SPEC 10.7/1.7: a present code location enters as identity,
      // presence, and its source range — the construct binding the unit's
      // name (4.6), the entire file for a whole-file location — no text.
      return {
        node: spelling,
        present: true,
        sourceRange: rangeJson(location.range),
      };
    }
    return { node: spelling, present: false };
  }
  const node = resolves
    ? view.analysis.graph.requirementNode(spelling)
    : undefined;
  if (node !== undefined) {
    // SPEC 10.7: a present node's text is read from the current graph —
    // the expanded value of 1.6 — with its source range (1.7).
    return {
      node: spelling,
      present: true,
      sourceRange: rangeJson(node.section.range),
      text:
        selection === "own"
          ? view.analysis.textModel.ownText(node.document, node.section)
          : view.analysis.textModel.subtreeText(node.document, node.section),
    };
  }
  return {
    node: spelling,
    present: false,
    text: absentNodeText(view, item, reference, selection),
  };
}

/**
 * One origin entry (SPEC 10.7): a before/after pair of the node's own text
 * — before from the item's baseline state (`originBeforeSide`), after from
 * the current graph; the absent side of the pair is presented absent, with
 * no text. The after side's presence is judged by canonical resolution
 * (SPEC 10.4): a dangling reference presents absent even though its
 * presented spelling matches the distinct node that recaptured it. Like
 * every payload node, a currently-present origin node carries its current
 * source range on the entry (SPEC 10.7, 1.7) — the after side is the
 * current graph's, so a currently-absent node (absent after side) carries
 * none.
 */
function originEntryJson(
  view: SessionReadView,
  item: ReviewItem,
  reference: string,
): JsonObject {
  const before = originBeforeSide(view, item, reference);
  const { spelling, resolves } = resolveReference(
    view.analysis.journal.journal,
    reference,
  );
  const node = resolves
    ? view.analysis.graph.requirementNode(spelling)
    : undefined;
  if (node === undefined) {
    return { node: spelling, before, after: { present: false } };
  }
  return {
    node: spelling,
    before,
    after: {
      present: true,
      text: view.analysis.textModel.ownText(node.document, node.section),
    },
    sourceRange: rangeJson(node.section.range),
  };
}

/**
 * SPEC 10.7: an origin entry's before side — the node's own text in the
 * item's baseline state (10.2), "whether or not the node has an entry in
 * `baseline`", presented absent, with no text, where that state does not
 * contain the node. In a baseline session that state is the graph at the
 * recorded baseline, which the read reconstructed (`baselineGraphTexts`:
 * the stored reference resolved as of the baseline journal prefix, 6.3),
 * so a node that joined the item's origin after it entered the session —
 * at a re-derivation (10.5), gaining no entry in `baseline` (10.2) — has
 * its baseline text there exactly as a node recorded at entry does, and a
 * node added since the baseline is absent there. A session without a
 * baseline (`audit`, `coverage`) generates empty origins (10.6, 10.7); its
 * items' baseline state, the current graph at entry, survives only in
 * their `baseline` entries and entry-time text snapshots, which stand for
 * that state here.
 */
function originBeforeSide(
  view: SessionReadView,
  item: ReviewItem,
  reference: string,
): JsonObject {
  if (view.generation.baseline !== undefined) {
    const texts = baselineGraphTexts(view, reference);
    return texts === undefined
      ? { present: false }
      : { present: true, text: texts.ownText };
  }
  const recordedBaseline = item.baseline.nodes[reference];
  return recordedBaseline !== undefined && recordedBaseline.present
    ? { present: true, text: item.baselineTexts[reference]?.ownText }
    : { present: false };
}

/**
 * The full item document (SPEC 10.7: every field of 10.2, the blocked
 * state, and the self-contained text payload) — `show`'s whole document,
 * one element of `export`'s item list, and `next --json`'s `item` member.
 * Status is the effective one (SPEC 10.4: a stale resolution is never
 * reported as resolved); `context` is the item's current context set
 * (`presentedContext`, SPEC 10.4), each node's payload — identity,
 * presence, range, text — over that set; `scope`, `origin`, `reason`, and
 * `blockedBy` present as last assigned; `baseline` and `current` report as
 * recorded, each node presented under its current identity
 * (`presentRecordedState`).
 */
export function itemDocument(
  view: SessionReadView,
  item: ReviewItem,
): JsonObject {
  const journal = view.analysis.journal.journal;
  const scopeSelection = scopeTextSelection(item.kind);
  return {
    id: item.id,
    kind: item.kind,
    status: view.statuses.get(item.id) ?? item.status,
    blocked: view.blocked.get(item.id) ?? false,
    blockedBy: [...item.blockedBy],
    reason: item.reason,
    note: item.note,
    scope: nodeStateJson(view, item, item.scope, scopeSelection),
    context: presentedContext(view, item).map((reference) =>
      nodeStateJson(view, item, reference, contextTextSelection(item.kind)),
    ),
    origin: item.origin.map((reference) =>
      originEntryJson(view, item, reference),
    ),
    // SPEC 10.7: a `metadata-consistency` item's payload carries its scope
    // node's metadata pair; no other kind's does.
    metadata:
      item.kind === "metadata-consistency"
        ? metadataPairJson(view, item)
        : undefined,
    baseline: recordedStateToJson(presentRecordedState(journal, item.baseline)),
    current: recordedStateToJson(presentRecordedState(journal, item.current)),
  };
}

/**
 * SPEC 10.7: a `metadata-consistency` item's metadata pair
 * (core/review-metadata.ts) — before from the item's baseline state, the
 * recorded-baseline graph a baseline session's read reconstructed
 * (`view.generation.baseline`, SPEC 10.2), after from the current graph —
 * as `{ "before", "after" }`, a side `{ "present": false }` where its graph
 * state lacks the node, else `{ "present": true, "d", "coverage", "tags" }`:
 * the `d` targets under their current identities (10.4), the coverage
 * attribute and the tags in 12.7's value forms.
 */
function metadataPairJson(view: SessionReadView, item: ReviewItem): JsonObject {
  const pair = metadataPairOf(
    item.scope,
    { graph: view.analysis.graph, journal: view.analysis.journal.journal },
    view.generation.baseline,
  );
  return {
    before: metadataSideJson(pair.before),
    after: metadataSideJson(pair.after),
  };
}

/** One metadata side as JSON (SPEC 10.7, 12.7; `metadataPairJson`). */
function metadataSideJson(side: MetadataSide): JsonObject {
  if (!side.present) {
    return { present: false };
  }
  return {
    present: true,
    d: [...side.d],
    coverage: side.coverage,
    tags: side.tags === null ? null : [...side.tags],
  };
}

/**
 * The item document rendered for human reading — the same information as
 * the JSON form (SPEC 12.0): every 10.2 field, the blocked state, and the
 * payload texts, in a stable indented layout.
 */
export function renderItemHuman(
  view: SessionReadView,
  item: ReviewItem,
): string {
  const document = itemDocument(view, item);
  let out = `item ${item.id}\n`;
  out += `  kind: ${item.kind}\n`;
  out += `  status: ${String(document["status"])}\n`;
  out += `  blocked: ${String(document["blocked"])}\n`;
  out += `  blockedBy: ${item.blockedBy.length === 0 ? "(none)" : item.blockedBy.join(", ")}\n`;
  out += `  reason: ${item.reason}\n`;
  if (item.note !== undefined) {
    out += `  note: ${item.note}\n`;
  }
  out += renderNodeStateHuman("scope", document["scope"] as JsonObject);
  const contexts = document["context"] as readonly JsonObject[];
  out += `  context:${contexts.length === 0 ? " (none)" : ""}\n`;
  for (const state of contexts) {
    out += renderNodeStateHuman("  -", state);
  }
  const origins = document["origin"] as readonly JsonObject[];
  out += `  origin:${origins.length === 0 ? " (none)" : ""}\n`;
  for (const entry of origins) {
    out += renderOriginHuman(entry);
  }
  const metadata = document["metadata"];
  if (metadata !== undefined) {
    // SPEC 10.7: the metadata pair, on `metadata-consistency` items alone.
    out += renderMetadataPairHuman(metadata as JsonObject);
  }
  const journal = view.analysis.journal.journal;
  out += `  baseline: ${compactStateHuman(presentRecordedState(journal, item.baseline))}\n`;
  out += `  current: ${compactStateHuman(presentRecordedState(journal, item.current))}\n`;
  return out;
}

/** One payload node as human lines (identity, presence, range, text). */
function renderNodeStateHuman(label: string, state: JsonObject): string {
  const present = state["present"] === true;
  let out = `  ${label}: ${String(state["node"])} (${present ? "present" : "absent"})\n`;
  const range = state["sourceRange"];
  if (range !== undefined) {
    const rangeObject = range as JsonObject;
    out += `    range: ${String(rangeObject["start"])}-${String(rangeObject["end"])}\n`;
  }
  const text = state["text"];
  if (typeof text === "string") {
    out += renderTextBlock(text);
  }
  return out;
}

/** One origin before/after pair as human lines (SPEC 10.7). */
function renderOriginHuman(entry: JsonObject): string {
  let out = `  - ${String(entry["node"])}\n`;
  const range = entry["sourceRange"];
  if (range !== undefined) {
    const rangeObject = range as JsonObject;
    out += `    range: ${String(rangeObject["start"])}-${String(rangeObject["end"])}\n`;
  }
  for (const side of ["before", "after"] as const) {
    const sideObject = entry[side] as JsonObject;
    const present = sideObject["present"] === true;
    out += `    ${side}: ${present ? "present" : "absent"}\n`;
    const text = sideObject["text"];
    if (typeof text === "string") {
      out += renderTextBlock(text, "      ");
    }
  }
  return out;
}

/**
 * A metadata pair as human lines (SPEC 10.7, 12.0: the information of the
 * JSON member): each side's presence and, for a present side, its `d`
 * targets and tags one per line beneath their labels (`(none)` on the label
 * line for an empty list, `(absent)` for a root's structurally absent tags)
 * and its coverage attribute (`(absent)` for a root's).
 */
function renderMetadataPairHuman(pair: JsonObject): string {
  let out = "  metadata:\n";
  for (const side of ["before", "after"] as const) {
    const sideObject = pair[side] as JsonObject;
    if (sideObject["present"] !== true) {
      out += `    ${side}: absent\n`;
      continue;
    }
    out += `    ${side}: present\n`;
    out += renderMetadataListHuman("d", sideObject["d"] as readonly string[]);
    const coverage = sideObject["coverage"];
    out += `      coverage: ${coverage === null ? "(absent)" : String(coverage)}\n`;
    const tags = sideObject["tags"] as readonly string[] | null;
    out +=
      tags === null
        ? "      tags: (absent)\n"
        : renderMetadataListHuman("tags", tags);
  }
  return out;
}

/** A labelled list of a metadata side, one element per line. */
function renderMetadataListHuman(
  label: string,
  values: readonly string[],
): string {
  if (values.length === 0) {
    return `      ${label}: (none)\n`;
  }
  let out = `      ${label}:\n`;
  for (const value of values) {
    out += `        - ${value}\n`;
  }
  return out;
}

/** A text value as an indented block, deterministic for identical text. */
function renderTextBlock(text: string, indent = "    "): string {
  if (text.length === 0) {
    return `${indent}text: (empty)\n`;
  }
  const lines = text.split("\n");
  let out = `${indent}text: |\n`;
  for (const line of lines) {
    out += `${indent}  ${line}\n`;
  }
  return out;
}

/** A presented recorded state (`presentRecordedState`) as one compact
 * human line (the same information the JSON member carries; SPEC 12.0). */
function compactStateHuman(state: RecordedState): string {
  const parts: string[] = [];
  for (const [identity, node] of Object.entries(state.nodes)) {
    if (!node.present) {
      parts.push(`${identity}=absent`);
      continue;
    }
    const hashes = Object.entries(node.hashes)
      .map(([name, value]) => `${name}:${value}`)
      .join(" ");
    parts.push(`${identity}={${hashes}}`);
  }
  return parts.length === 0 ? "(no nodes)" : parts.join("; ");
}

// ---------------------------------------------------------------------------
// Status rows and totals (SPEC 10.7 `status`)
// ---------------------------------------------------------------------------

/** Effective totals by status (SPEC 10.7 `status`: read-time invalidation
 * applied — 10.4). */
export function effectiveTotals(
  view: SessionReadView,
): Readonly<Record<ItemStatus, number>> {
  const totals: Record<ItemStatus, number> = {
    unresolved: 0,
    updated: 0,
    "no-change": 0,
    skipped: 0,
    invalidated: 0,
  };
  for (const item of view.session.items) {
    totals[view.statuses.get(item.id) ?? item.status] += 1;
  }
  return totals;
}

/** Status counts as a JSON member (explicit zeros keep the record total). */
export function countsJson(
  counts: Readonly<Record<ItemStatus, number>>,
): JsonObject {
  return {
    unresolved: counts.unresolved,
    updated: counts.updated,
    "no-change": counts["no-change"],
    skipped: counts.skipped,
    invalidated: counts.invalidated,
  };
}

/** Status counts as one deterministic human fragment. */
export function renderCountsHuman(
  counts: Readonly<Record<ItemStatus, number>>,
): string {
  return (
    `unresolved=${String(counts.unresolved)} ` +
    `updated=${String(counts.updated)} ` +
    `no-change=${String(counts["no-change"])} ` +
    `skipped=${String(counts.skipped)} ` +
    `invalidated=${String(counts.invalidated)}`
  );
}

// ---------------------------------------------------------------------------
// Refusals (SPEC 10.7 → 12.0: refused review operations, exit 1)
// ---------------------------------------------------------------------------

/**
 * SPEC 10.7/12.0/14: a refused review operation (`split` on a wrong-kind or
 * childless item, `resolve` on a blocked item, `create` with an existing
 * name) is a findings-class outcome — its report is the findings-only
 * document `{"findings": […]}` (SPEC 12.7), one finding per refusal, and the
 * human form presents the same information through the shared findings
 * renderer (SPEC 12.0). Review-operation refusals carry no stable code
 * (SPEC 14: "review-operation refusals likewise carry none"): `code` null,
 * no in-source locations, no concerned path; `identities` carry the context
 * strings the refusal names (session name, item id) — informational,
 * deterministic per SPEC 12.7. Exit 1, nothing modified.
 */
export function emitReviewRefusal(
  json: boolean,
  stdout: CliWriter,
  message: string,
  identities: readonly string[],
): ExitCode {
  const finding: Finding = {
    code: null,
    message,
    locations: [],
    path: null,
    identities,
  };
  emitFindingsReport(json, stdout, [finding]);
  return 1;
}
