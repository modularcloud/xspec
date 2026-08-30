// `xspec at <file> <offset>` (SPEC 11.5).
//
// Resolves a byte position in a discovered spec source: the innermost
// section construct whose range (SPEC 1.7) contains the offset — the root
// when no narrower section does — reported with its construct range and,
// per SPEC 11.2, its node identity; and, when the offset lies within a
// reference occurrence's range, that occurrence's full record (SPEC 5.7).
// JSON-only (SPEC 11): a single JSON document — the 12.7
// `{"findings", "resolution"}` form — is its only output form, with or
// without `--json`.
//
// The argument checks precede answering and the refresh (SPEC 11.2, 12.0),
// each a usage error at exit 2 whatever findings the workspace or the named
// file carry:
//
// - `<offset>` must be one or more ASCII decimal digits, read in decimal —
//   leading zeros permitted; a sign, whitespace, or any other character is
//   not a non-negative integer's spelling (SPEC 11.5). A purely syntactic
//   check, judged before any configuration or source is consulted.
// - `<file>` asserts domain membership exactly as a `view` operand does
//   (SPEC 11.4): a file outside the discovered set is unknown and a
//   discovered code source is a wrong-kind operand; a `#`-containing
//   operand is a whole path, never a `path#id` split (SPEC 12.0), so an
//   invalid-path spec member with a UTF-8 spelling is addressable (a
//   non-UTF-8-pathed one is nameable by no argument value — the glob-reached
//   view is the one route to its positions, SPEC 11.5).
// - An offset greater than the file's byte length is a usage error; equal
//   (the EOF caret) resolves to the root (SPEC 11.5). The byte length is a
//   property of the file's bytes, not of its parse, so the bound is judged
//   on unparseable files too — read from the parse where one exists, from
//   the filesystem otherwise.
//
// Resolution is by range containment and total over the file (SPEC 11.5):
// every within-file offset resolves through the same positional tree the
// view serves (SPEC 11.4), so `at` adds convenience, not information. The
// consulted domain (SPEC 11.2) is the named file: its findings accompany
// the answer, any finding or explicitly-unavailable datum exits 1 with the
// full document still emitted, and on an unparseable file the resolution is
// exactly the unavailability marker, the parse-failure finding beside it.

import {
  accompanyingFindings,
  availabilityExit,
  ConsultedDomain,
  selectOccurrences,
} from "../../core/availability.js";
import { canonicalJson } from "../../core/canonical-json.js";
import type { JsonObject, JsonValue } from "../../core/canonical-json.js";
import type { ExitCode } from "../../core/findings.js";
import { orderFindings } from "../../core/findings.js";
import type { SpecFileAnalysis } from "../../core/graph.js";
import type { SpecSection } from "../../core/mdx.js";
import { definedIdentitySections } from "../../core/mdx.js";
import { pathTextKey } from "../../core/path-text.js";
import {
  finishAvailabilityRefresh,
  readSourceByteLength,
} from "../../workspace/availability.js";
import type { Invocation } from "../args.js";
import type { CommandContext } from "../io.js";
import { analyzeAnalysisForAvailability } from "../prepare.js";
import {
  findingToJson,
  occurrenceRecordJson,
  unavailableJson,
} from "../report.js";
import {
  invalidOffsetMessage,
  offsetOutOfRangeMessage,
  offsetSpellingOk,
  unknownFileMessage,
  wrongKindFileMessage,
} from "./at-common.js";
import { rangeJson, usageError } from "./common.js";

/** The `at` command handler (SPEC 11.5). */
export async function atCommand(
  invocation: Invocation,
  context: CommandContext,
): Promise<ExitCode> {
  const file = invocation.positionals[0]!;
  const offsetSpelling = invocation.positionals[1]!;

  // --- the syntactic offset check (SPEC 11.5, 12.0: a malformed value,
  // judged from the invocation alone, before anything is consulted) -------
  if (!offsetSpellingOk(offsetSpelling)) {
    return usageError(
      invocation,
      context,
      invalidOffsetMessage(offsetSpelling),
    );
  }
  const offset = Number.parseInt(offsetSpelling, 10);

  // --- the analysis half of the SPEC 11.2 pre-answer step (a pure read) ---
  const prepared = await analyzeAnalysisForAvailability(invocation, context);
  if (!prepared.ok) {
    return prepared.exit;
  }
  const { analysis } = prepared;
  const { classification } = analysis;

  // --- operand membership (SPEC 11.5: exactly as a `view` operand, 11.4):
  // judged against the discovered set — discovery is controlled exclusively
  // by configuration (SPEC 7), so an on-disk file no group discovers is
  // unknown — before any answer or refresh side effect (SPEC 11.2).
  const discoveredKinds = new Map<string, "spec" | "code">();
  for (const source of classification.specSources) {
    discoveredKinds.set(pathTextKey(source.path), "spec");
  }
  for (const source of classification.codeSources) {
    discoveredKinds.set(pathTextKey(source.path), "code");
  }
  for (const source of classification.invalidSources) {
    // SPEC 11.2/14.19: invalid-path members are discovered files of their
    // kind — a spec-kind member is addressable where its path has a UTF-8
    // spelling; a code-kind member is a wrong-kind operand like any other
    // discovered code source.
    discoveredKinds.set(pathTextKey(source.path), source.kind);
  }
  const kind = discoveredKinds.get(pathTextKey(file));
  if (kind === undefined) {
    return usageError(invocation, context, unknownFileMessage(file));
  }
  if (kind === "code") {
    return usageError(invocation, context, wrongKindFileMessage(file));
  }

  // The named file's parse, where one exists: an unparseable file (masked,
  // SPEC 14.20) has none — its resolution is explicitly unavailable below.
  const key = pathTextKey(file);
  let requested:
    | { readonly spec: SpecFileAnalysis; readonly pathValid: boolean }
    | undefined;
  for (const spec of analysis.specs) {
    if (pathTextKey(spec.document.file) === key) {
      requested = { spec, pathValid: true };
      break;
    }
  }
  if (requested === undefined) {
    for (const spec of analysis.invalidPathSpecs) {
      if (pathTextKey(spec.document.file) === key) {
        // SPEC 11.2/14.19: parse-local structure stays on view while no
        // node of the file has a defined identity.
        requested = { spec, pathValid: false };
        break;
      }
    }
  }

  // --- the offset bound (SPEC 11.5): greater than the file's byte length
  // is a usage error; equal resolves to the root. The length is the parsed
  // root's construct end (the entire file, SPEC 1.7) or, for a file the
  // analysis holds no parse for, the file's bytes read directly — with
  // unreadable content there is no byte length to judge against, and the
  // resolution below is explicitly unavailable regardless.
  const byteLength =
    requested !== undefined
      ? requested.spec.document.root.range.end
      : await readSourceByteLength(context.workspace, file);
  if (byteLength !== null && offset > byteLength) {
    return usageError(
      invocation,
      context,
      offsetOutOfRangeMessage(offsetSpelling, byteLength),
    );
  }

  // --- the refresh half (SPEC 13.3, 11.2): the invocation is valid, so
  // the surface participates in read-time refresh on a passing workspace
  // and touches nothing on a failing one.
  await finishAvailabilityRefresh(context.workspace, analysis);

  // --- the answer (SPEC 11.5, 11.2): the consulted domain is the named
  // file — its findings alone accompany.
  const domain = new ConsultedDomain([file]);
  const findings = orderFindings(
    accompanyingFindings(analysis.findings, domain),
  );

  let carriesUnavailable = false;
  let resolution: JsonValue;
  if (requested === undefined) {
    // SPEC 11.5/11.2: on an unparseable file the resolution is reported
    // explicitly unavailable — never a fabricated root resolution — the
    // parse-failure finding accompanying it.
    carriesUnavailable = true;
    resolution = unavailableJson();
  } else {
    const { spec, pathValid } = requested;
    const document = spec.document;

    // The innermost section construct whose range contains the offset
    // (SPEC 1.7: start-inclusive, end-exclusive), descending the same
    // positional tree the view serves (SPEC 11.4) — the root remains where
    // no section contains the offset, which also realizes the EOF-caret
    // rule: the byte-length offset lies in no end-exclusive range.
    let node: SpecSection = document.root;
    let descended = true;
    while (descended) {
      descended = false;
      for (const child of node.children) {
        if (child.range.start <= offset && offset < child.range.end) {
          node = child;
          descended = true;
          break;
        }
      }
    }

    // SPEC 11.2: the node identity datum — defined per the spelling, chain,
    // and uniqueness rules on a valid path (the root's exactly when the
    // path is valid), explicitly unavailable otherwise.
    const defined = pathValid ? definedIdentitySections(document) : null;
    const isRoot = node.parent === null;
    let identity: JsonValue;
    if (defined === null) {
      carriesUnavailable = true;
      identity = unavailableJson();
    } else if (isRoot) {
      identity = document.path;
    } else if (defined.has(node)) {
      identity = `${document.path}#${node.id ?? ""}`;
    } else {
      carriesUnavailable = true;
      identity = unavailableJson();
    }

    // SPEC 11.5/5.7: the containing occurrence's full record — the named
    // file's records in occurrence order, the first (only: occurrence
    // spans are disjoint) whose range contains the offset — or null when
    // the offset lies within none.
    const records = selectOccurrences(analysis.graph, domain);
    const containing = records.find(
      (record) => record.range.start <= offset && offset < record.range.end,
    );
    let occurrence: JsonValue;
    if (containing === undefined) {
      occurrence = null;
    } else {
      if (containing.source === null) {
        // The record's source datum is the unavailability marker
        // (SPEC 11.2) — an explicitly-unavailable datum in the answer.
        carriesUnavailable = true;
      }
      occurrence = occurrenceRecordJson(containing);
    }

    const section: JsonObject = { identity, range: rangeJson(node.range) };
    resolution = { section, occurrence };
  }

  const document: JsonValue = {
    findings: findings.map(findingToJson),
    resolution,
  };
  context.stdout.write(canonicalJson(document));
  // SPEC 11.2: any finding or explicitly-unavailable datum → exit 1 with
  // the full document emitted; complete and finding-free → exit 0.
  return availabilityExit(findings, carriesUnavailable);
}
