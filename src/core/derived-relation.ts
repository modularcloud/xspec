// The relation between the derived paths xspec writes and the paths beneath
// them (SPEC 13.4, 14.22) — pure core.
//
// SPEC 13.4: "Derived-file paths belong to xspec: writing a derived file
// replaces whatever exists at its path, whether or not xspec wrote it —
// except that a module, companion, or Markdown path that is a directory
// component of a discovered source's path or of another such path is
// refused before any write (14.22)." SPEC 14.22: "It is equally this
// condition when a generated module's, companion's, or emitted Markdown
// file's path xspec writes (13.1, 13.2) is a directory component of another
// such path it writes or of a discovered source's path, occupied or not —
// the plain file written there would leave the other write no directory, or
// replace a directory holding a source (13.4)."
//
// The relation reads paths alone, never what occupies them, so it is a
// function of plain path sets (IMPLEMENTATION Architecture: pure core):
// `build`'s validations apply it over the derived paths the discovered spec
// sources generate and the discovered source paths, merging it there with
// 14.22's occupied-component relation into one finding per offending path
// (workspace/build-validation.ts); a move's destination checks can apply it
// over the sets the move would leave (6.5). Paths compare by their exact
// bytes (SPEC 12.0), so a path with no plain string form (14.19) takes part
// like any other: a directory component is a byte prefix of a path ending
// before one of its `/` bytes.

import type { Configuration } from "./config.js";
import { specSourceDerivedPaths } from "./discovery.js";
import { SPEC_MODULE_SUFFIXES } from "./emission.js";
import type { PathText } from "./path-text.js";
import {
  comparePathTexts,
  pathTextBytes,
  pathTextKey,
  pathTextOf,
} from "./path-text.js";

/** What a derived path is (SPEC 13.1, 13.2). */
export type DerivedPathRole = "module" | "companion" | "markdown";

/** One module, companion, or Markdown path xspec writes, with its source. */
export interface DerivedPathEntry {
  /**
   * The workspace-relative derived path — in the byte form where it has no
   * plain string form (SPEC 12.0, 12.7).
   */
  readonly path: PathText;
  readonly role: DerivedPathRole;
  /** The discovered spec source whose name generates it (SPEC 13.1). */
  readonly source: PathText;
}

const utf8Encoder = new TextEncoder();

/** The length of the `.mdx` extension following a spec source's stem. */
const MDX_SUFFIX_LENGTH = ".mdx".length;

/** The companions' suffixes as bytes (SPEC 13.1; emission's naming). */
const COMPANION_SUFFIXES: readonly Uint8Array[] = [
  SPEC_MODULE_SUFFIXES.runtime,
  SPEC_MODULE_SUFFIXES.types,
  SPEC_MODULE_SUFFIXES.typesMap,
].map((suffix) => utf8Encoder.encode(suffix));

/**
 * The module, companion, and Markdown paths the discovered spec sources at
 * `specSources` generate, each tagged with its role and source: per source
 * by its `NAME.mdx` name shape alone, never by parsing (SPEC 13.1 — a
 * spec-group file without the `.mdx` extension, 14.19, generates nothing),
 * its Markdown path exactly while emission is enabled (7.3, 13.2). Total
 * over paths with no plain string form (14.19): such a source's derived
 * paths keep its stem's bytes. In the sources' order, each source's paths
 * in a fixed order — module, companions, Markdown.
 */
export function derivedPathEntries(
  configuration: Configuration,
  specSources: Iterable<PathText>,
): DerivedPathEntry[] {
  const entries: DerivedPathEntry[] = [];
  for (const source of specSources) {
    const bytes = pathTextBytes(source);
    const derived = specSourceDerivedPaths(bytes, configuration);
    if (derived.module === null) continue;
    entries.push({ path: derived.module, role: "module", source });
    const stem = bytes.subarray(0, bytes.length - MDX_SUFFIX_LENGTH);
    for (const suffix of COMPANION_SUFFIXES) {
      const companion = new Uint8Array(stem.length + suffix.length);
      companion.set(stem, 0);
      companion.set(suffix, stem.length);
      entries.push({ path: pathTextOf(companion), role: "companion", source });
    }
    if (derived.markdown !== null) {
      entries.push({ path: derived.markdown, role: "markdown", source });
    }
  }
  return entries;
}

/** One instance of SPEC 13.4/14.22's relation between derived paths. */
export interface DerivedPathConflict {
  /** The offending derived path: a directory component of `beneath`. */
  readonly derived: PathText;
  /** The path it lies above — a discovered source's or another derived. */
  readonly beneath: PathText;
  readonly beneathKind: "source" | "derived";
}

/**
 * SPEC 13.4/14.22's relation over plain path sets: every pair of a path of
 * `derived` and a path of `sources` or of `derived` of which it is a proper
 * workspace-relative directory component — a byte prefix of that path
 * ending before one of its `/` bytes — occupied or not, nothing read. A
 * path is never a directory component of itself, so equal paths are no
 * part of the relation. Duplicates within either set count once. Ordered
 * by the offending path's bytes, then the path beneath it, a source before
 * a derived path of equal bytes (SPEC 12.0 determinism).
 */
export function derivedPathConflicts(
  derived: Iterable<PathText>,
  sources: Iterable<PathText>,
): DerivedPathConflict[] {
  const derivedByKey = new Map<string, PathText>();
  for (const path of derived) derivedByKey.set(pathTextKey(path), path);
  const sourceByKey = new Map<string, PathText>();
  for (const path of sources) sourceByKey.set(pathTextKey(path), path);
  const conflicts: DerivedPathConflict[] = [];
  const collect = (
    key: string,
    beneath: PathText,
    beneathKind: DerivedPathConflict["beneathKind"],
  ): void => {
    // A key spells each byte as one code unit, so the byte 0x2f is "/".
    for (
      let end = key.indexOf("/");
      end !== -1;
      end = key.indexOf("/", end + 1)
    ) {
      const component = derivedByKey.get(key.slice(0, end));
      if (component !== undefined) {
        conflicts.push({ derived: component, beneath, beneathKind });
      }
    }
  };
  for (const [key, path] of sourceByKey) collect(key, path, "source");
  for (const [key, path] of derivedByKey) collect(key, path, "derived");
  return conflicts.sort(
    (a, b) =>
      comparePathTexts(a.derived, b.derived) ||
      comparePathTexts(a.beneath, b.beneath) ||
      kindRank(a.beneathKind) - kindRank(b.beneathKind),
  );
}

/** A source before a derived path of equal bytes. */
function kindRank(kind: DerivedPathConflict["beneathKind"]): number {
  return kind === "source" ? 0 : 1;
}
