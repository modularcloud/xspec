// The validations of `xspec build` (SPEC 12.1) as one report — the
// findings a `build` would now report (SPEC 13.3).
//
// SPEC 13.3: a workspace fails `build`'s validations on "source validation
// errors, journal errors (14.13), and refused writes (14.22) alike". SPEC
// 14: "When several error conditions are present, they MUST report each
// of them, not only the first; a condition goes unreported only where
// another error makes it undetectable". A refused write is detectable on a
// workspace whose sources or journal fail: 14.22 judges paths, never
// generated content — `build`'s write paths are "the derived files the
// current sources and configuration generate (13.1, 13.2) and graph data
// (13.3)", per-source derived paths "defined by this `NAME.mdx` name shape
// alone" (13.1), a set discovery and configuration define on any
// workspace (14.10; `discoveredWritePaths`, core/build.ts). So the refused
// writes are judged over that set whatever the sources' validity and
// reported beside the analysis's findings.
//
// SPEC 14.22 names two relations, one condition: a workspace-relative
// directory component of a path xspec writes occupied by anything other
// than a directory (13.4; ./writes.ts), and — "equally this condition" — a
// module, companion, or Markdown path that is a directory component of
// another such path or of a discovered source's path, occupied or not
// (13.4; core/derived-relation.ts). `refusedWriteFindings` judges both and
// reports "one finding per distinct offending component, whatever write
// paths it refuses": a path meeting both relations is one finding.
//
// Shared by every surface reporting or gating on `build`'s validations:
// `build` itself (12.1), `check` (12.2, which judges exactly `build`'s
// write paths, 14.22), the gate of 13.3 (./refresh.ts), and the
// invalid-workspace refusal of `rename` and `move` (6.4, 6.5: "the
// workspace's findings alone", 14) — and, through `refusedWriteFindings`,
// by the surfaces that refresh only where `build` would succeed (the
// availability refresh of 11.2, ./availability.ts; the store-backed fast
// path, ./fast-read.ts). The examination makes kind reads only — nothing
// is modified (SPEC 12.1: a failing `build` modifies nothing) — and a kind
// read the environment refuses stops the command at that read (SPEC
// 14.25, ./writes.ts).

import { discoveredWritePaths } from "../core/build.js";
import type { Configuration } from "../core/config.js";
import type {
  DerivedPathConflict,
  DerivedPathEntry,
} from "../core/derived-relation.js";
import {
  derivedPathConflicts,
  derivedPathEntries,
} from "../core/derived-relation.js";
import type { SourceClassification } from "../core/discovery.js";
import type { Finding } from "../core/findings.js";
import { pathFinding } from "../core/findings.js";
import type { PathText } from "../core/path-text.js";
import {
  comparePathTexts,
  pathTextKey,
  renderPathText,
} from "../core/path-text.js";
import type { LoadedWorkspace } from "./config.js";
import type { WorkspaceAnalysis } from "./pipeline.js";
import type { PathOccupant } from "./writes.js";
import {
  describeOccupant,
  obstructedWriteComponents,
  obstructionFinding,
} from "./writes.js";

/**
 * The findings a `build` would now report over `analysis` (SPEC 13.3,
 * 12.1): its source validation findings and journal errors, then the
 * refused writes (SPEC 14.22) over `build`'s write paths as discovery and
 * configuration define them (`refusedWriteFindings`). Empty exactly when
 * the workspace passes `build`'s validations. Unordered: every findings
 * emitter applies 12.7's order.
 */
export async function buildValidationFindings(
  workspace: LoadedWorkspace,
  analysis: WorkspaceAnalysis,
): Promise<readonly Finding[]> {
  const refusedWrites = await refusedWriteFindings(
    workspace.root,
    workspace.configuration,
    analysis.classification,
  );
  return [...analysis.findings, ...refusedWrites];
}

/**
 * SPEC 14.22's refused writes of `build` on any workspace, judged over
 * its write paths as discovery and configuration define them
 * (`discoveredWritePaths`, core/build.ts) under both relations 14.22
 * names: a workspace-relative directory component of a write path occupied
 * by anything other than a directory (`obstructedWriteComponents`), and a
 * module, companion, or Markdown path that is a directory component of a
 * discovered source's path or of another such path, occupied or not
 * (`derivedPathConflicts` over every discovered spec source's derived
 * paths and every discovered source's path, valid or not, 14.19 — a
 * discovered file whose own path 14.19 rejects is a discovered source all
 * the same). One finding per distinct offending path — whatever write
 * paths it refuses and whichever relations it meets — concerning it,
 * `locations` `[]`; in byte order of concerned path (SPEC 12.0).
 */
export async function refusedWriteFindings(
  root: string,
  configuration: Configuration,
  classification: SourceClassification,
): Promise<Finding[]> {
  const obstructions = await obstructedWriteComponents(
    root,
    discoveredWritePaths(configuration, classification),
  );
  const specSources: PathText[] = classification.specSources.map(
    (source) => source.path,
  );
  const sources: PathText[] = [
    ...specSources,
    ...classification.codeSources.map((source) => source.path),
  ];
  for (const source of classification.invalidSources) {
    if (source.kind === "spec") specSources.push(source.path);
    sources.push(source.path);
  }
  const entries = derivedPathEntries(configuration, specSources);
  const conflicts = derivedPathConflicts(
    entries.map((entry) => entry.path),
    sources,
  );

  // The witness each offending derived path's finding names: the first
  // discovered source beneath it in byte order, else the first derived
  // path beneath it (`derivedPathConflicts` orders the pairs so).
  const witnesses = new Map<string, DerivedPathConflict>();
  for (const conflict of conflicts) {
    const key = pathTextKey(conflict.derived);
    const current = witnesses.get(key);
    if (
      current === undefined ||
      (current.beneathKind === "derived" && conflict.beneathKind === "source")
    ) {
      witnesses.set(key, conflict);
    }
  }
  const entryByKey = new Map<string, DerivedPathEntry>(
    entries.map((entry) => [pathTextKey(entry.path), entry]),
  );
  const occupantByKey = new Map<string, PathOccupant>(
    obstructions.map((obstruction) => [
      pathTextKey(obstruction.component),
      obstruction.occupant,
    ]),
  );

  const findings: Finding[] = [];
  for (const [key, witness] of witnesses) {
    findings.push(
      derivedPathFinding(witness, entryByKey, occupantByKey.get(key) ?? null),
    );
  }
  for (const obstruction of obstructions) {
    if (!witnesses.has(pathTextKey(obstruction.component))) {
      findings.push(obstructionFinding(obstruction));
    }
  }
  return findings.sort((a, b) => comparePathTexts(a.path ?? "", b.path ?? ""));
}

/** A derived path's description in a 14.22 message (SPEC 13.1, 13.2). */
function describeDerivedPath(entry: DerivedPathEntry): string {
  const source = renderPathText(entry.source);
  switch (entry.role) {
    case "module":
      return `the TypeScript module xspec generates for ${source}`;
    case "companion":
      return `a companion of the TypeScript module xspec generates for ${source}`;
    case "markdown":
      return `the Markdown file xspec emits for ${source}`;
  }
}

/**
 * The SPEC 14.22 finding for one derived path lying above a discovered
 * source's path or another derived path (13.4), naming one path beneath it
 * — `witness` — and, where the offending path is also occupied by a
 * non-directory (the occupied-component relation meeting this one at the
 * same component), that occupant. Its correction: move or rename the
 * source generating the offending path or what lies beneath it, or, where
 * emitted Markdown takes part, reconfigure `markdown.outDir` (7.3).
 */
function derivedPathFinding(
  witness: DerivedPathConflict,
  entries: ReadonlyMap<string, DerivedPathEntry>,
  occupant: PathOccupant | null,
): Finding {
  const offending = renderPathText(witness.derived);
  const entry = entries.get(pathTextKey(witness.derived));
  const beneath = renderPathText(witness.beneath);
  const beneathEntry =
    witness.beneathKind === "derived"
      ? entries.get(pathTextKey(witness.beneath))
      : undefined;
  const what =
    entry === undefined ? "a path xspec writes" : describeDerivedPath(entry);
  const where =
    witness.beneathKind === "source"
      ? `the discovered source ${beneath}`
      : `${beneath}, ${
          beneathEntry === undefined
            ? "another path xspec writes"
            : describeDerivedPath(beneathEntry)
        }`;
  const consequence =
    witness.beneathKind === "source"
      ? "the plain file written there would replace the directory holding that source"
      : "the plain file written there would leave that write no directory";
  const occupied =
    occupant === null
      ? ""
      : `, and ${offending} already holds ${describeOccupant(occupant)}, ` +
        `not a directory`;
  // The sources to move or rename: the one generating the offending path
  // and the one beneath it — the witness itself, or the source generating
  // the derived path beneath — each named once.
  const movable = [
    ...new Set(
      [
        entry?.source,
        witness.beneathKind === "source"
          ? witness.beneath
          : beneathEntry?.source,
      ]
        .filter((source) => source !== undefined)
        .map(renderPathText),
    ),
  ];
  const sources =
    movable.length === 0 ? "the sources involved" : movable.join(" or ");
  const markdown =
    entry?.role === "markdown" || beneathEntry?.role === "markdown"
      ? ", or reconfigure Markdown emission (`markdown`, SPEC 7.3)"
      : "";
  return pathFinding(
    22,
    `obstructed write path: ${offending}, ${what}, is a directory ` +
      `component of ${where}, occupied or not: ${consequence} (SPEC ` +
      `13.4)${occupied}; move or rename ${sources}${markdown}, so that no ` +
      `path xspec writes is a directory component of a source's path or ` +
      `of another path xspec writes (SPEC 14.22)`,
    witness.derived,
  );
}
