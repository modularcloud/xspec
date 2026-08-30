// `xspec at` — the store-backed fast path (SPEC 13.3; the full path is
// ./at.ts).
//
// cli/main.ts calls this before loading the full pipeline: when the stored
// graph data verifies against the current workspace bytes
// (workspace/fast-read.ts — every recorded derivation input matches), the
// workspace is exactly the passing one the snapshot was derived from
// (SPEC 12.0 determinism), so the store already "matches the current
// sources and configuration" (SPEC 13.3 — the refresh these surfaces
// participate in would write nothing) and the answer is finding-free with
// every datum defined (a passing workspace carries no findings, SPEC 11.2).
// The snapshot holds everything `at` reports: every requirement node with
// its construct range and identity (a root node per spec source, every
// section a node — zero findings leave no identity undefined), every code
// location, and every reference occurrence (SPEC 5.7), so the resolution is
// read off the stored data byte-for-byte as the full path would derive it.
// A null return means "no verified store" — the caller falls back to the
// full path, whose behavior is exactly the SPEC 11.2/13.3 pre-answer step.
// The fast path performs no writes: a verified store needs no refresh.
//
// The argument checks keep their SPEC 11.2/12.0 semantics and their exact
// diagnostics (./at-common.ts — SPEC 12.0: byte-identical output whichever
// path answers): the syntactic offset check precedes everything; membership
// is judged against the verified snapshot — on a verified store the
// discovered set equals the recorded set with no invalid paths
// (workspace/fast-read.ts), every discovered spec source has its root node
// and every discovered code source its whole-file location (core/graph.ts),
// so the operand's classification is the stored identities' — and the
// offset bound against the root's whole-file range (SPEC 1.7).

import { canonicalJson } from "../../core/canonical-json.js";
import type { JsonValue } from "../../core/canonical-json.js";
import type { ExitCode } from "../../core/findings.js";
import type {
  GraphSnapshot,
  StoredRequirementNode,
} from "../../core/graph-data.js";
import { verifyStoreForRead } from "../../workspace/fast-read.js";
import type { LocatedWorkspace } from "../../workspace/locate.js";
import type { Invocation } from "../args.js";
import type { CliWriter } from "../io.js";
import { occurrenceRecordJson } from "../report.js";
import {
  invalidOffsetMessage,
  offsetOutOfRangeMessage,
  offsetSpellingOk,
  unknownFileMessage,
  wrongKindFileMessage,
} from "./at-common.js";
import { rangeJson, usageError } from "./common.js";

/** The stored source range of `identity`, or undefined when unknown. */
function rangeOfIdentity(
  snapshot: GraphSnapshot,
  identity: string,
): { readonly start: number; readonly end: number } | undefined {
  for (const node of snapshot.requirements) {
    if (node.identity === identity) return node.range;
  }
  for (const location of snapshot.codeLocations) {
    if (location.identity === identity) return location.range;
  }
  return undefined;
}

/**
 * Answer `at` from the verified store, or return null when no store
 * verifies (the caller falls back to the full path). SPEC 11: a single
 * JSON document is `at`'s only output form; the argument checks of
 * SPEC 11.5 precede the answer exactly as on the full path.
 */
export async function tryFastAt(
  invocation: Invocation,
  located: LocatedWorkspace,
  stdout: CliWriter,
  stderr: CliWriter,
): Promise<ExitCode | null> {
  const io = { stdout, stderr };
  const file = invocation.positionals[0]!;
  const offsetSpelling = invocation.positionals[1]!;

  // SPEC 11.5/12.0: a malformed <offset> is judged from the invocation
  // alone — before any store, configuration, or workspace consult.
  if (!offsetSpellingOk(offsetSpelling)) {
    return usageError(invocation, io, invalidOffsetMessage(offsetSpelling));
  }
  const offset = Number.parseInt(offsetSpelling, 10);

  const verified = await verifyStoreForRead(located);
  if (verified === null) {
    return null;
  }
  const snapshot = verified.data.snapshot;

  // Operand membership (SPEC 11.5, exactly as a `view` operand, 11.4):
  // judged against the verified snapshot (module header).
  let root: StoredRequirementNode | undefined;
  for (const node of snapshot.requirements) {
    if (node.id === null && node.path === file) {
      root = node;
      break;
    }
  }
  if (root === undefined) {
    for (const location of snapshot.codeLocations) {
      if (location.identity === file) {
        return usageError(invocation, io, wrongKindFileMessage(file));
      }
    }
    return usageError(invocation, io, unknownFileMessage(file));
  }

  // The offset bound (SPEC 11.5): the root's construct range is the entire
  // file (SPEC 1.7), so its end is the file's byte length; greater is a
  // usage error, equal resolves to the root.
  const byteLength = root.range.end;
  if (offset > byteLength) {
    return usageError(
      invocation,
      io,
      offsetOutOfRangeMessage(offsetSpelling, byteLength),
    );
  }

  // The innermost section construct whose range contains the offset
  // (SPEC 1.7: start-inclusive, end-exclusive): sections nest properly, so
  // among the containing constructs the innermost is the one opening last;
  // the root remains where none contains the offset (the EOF caret
  // included).
  let section: StoredRequirementNode = root;
  for (const node of snapshot.requirements) {
    if (node.path !== file || node.id === null) continue;
    if (node.range.start <= offset && offset < node.range.end) {
      if (section === root || node.range.start > section.range.start) {
        section = node;
      }
    }
  }

  // The containing occurrence (SPEC 11.5, 5.7): the named file's records in
  // occurrence order, the first whose range contains the offset — null when
  // the offset lies within none. The source datum joins its node's stored
  // range (a requirement's section construct, a code location's range).
  let occurrence: JsonValue = null;
  for (const record of snapshot.occurrences) {
    if (record.file !== file) continue;
    if (record.range.start <= offset && offset < record.range.end) {
      if (record.source === null) {
        // Unreachable on a verified store (a passing workspace leaves no
        // identity undefined, SPEC 11.2) — let the full path decide.
        return null;
      }
      const sourceRange = rangeOfIdentity(snapshot, record.source);
      if (sourceRange === undefined) {
        // Unreachable: every occurrence's source is a stored node. Let the
        // full path decide rather than fabricate.
        return null;
      }
      occurrence = occurrenceRecordJson({
        file: record.file,
        range: record.range,
        kind: record.kind,
        source: { identity: record.source, range: sourceRange },
        target: record.target,
      });
      break;
    }
  }

  // The answer (SPEC 11.5, 12.7): a verified store's domain findings are
  // empty and every datum is defined, so the answer is complete and
  // finding-free — exit 0 (SPEC 11.2).
  const document: JsonValue = {
    findings: [],
    resolution: {
      section: { identity: section.identity, range: rangeJson(section.range) },
      occurrence,
    },
  };
  stdout.write(canonicalJson(document));
  return 0;
}
