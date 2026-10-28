// The configuration's stored plain form (SPEC 13.3; core/graph-data.ts).
//
// The graph data records the parsed configuration among its derivation
// inputs, beside the configuration file's content hash. The record is
// written, never read back: no surface answers from it or substitutes it
// for parsing the configuration file (SPEC 13.3: read results never come
// from stale data, and every command but `version` parses and validates
// the configuration, 7, 14.14). Graph data's content is otherwise opaque
// (13.3), so the form is kept as written: `configurationToStored`
// projects a `Configuration` onto plain JSON data, compiled globs reduced
// to the patterns they were compiled from.
//
// Pure core (IMPLEMENTATION Architecture): data in, data out, no I/O — and
// free of core/config.ts value imports, so loading this module never loads
// the TypeScript compiler.

import type { JsonValue } from "./canonical-json.js";
import type {
  Configuration,
  ConfiguredGroup,
  PolicySelector,
} from "./config.js";

function groupToStored(group: ConfiguredGroup): JsonValue {
  return { name: group.name, patterns: [...group.patterns] };
}

function selectorToStored(selector: PolicySelector): JsonValue {
  switch (selector.selector) {
    case "group":
      return {
        selector: "group",
        group: selector.group,
        groupKind: selector.groupKind,
      };
    case "files":
      return { selector: "files", pattern: selector.pattern };
    case "tags":
      return { selector: "tags", tags: [...selector.tags] };
  }
}

/**
 * Project a parsed configuration onto plain JSON data (the graph data's
 * recorded parse, SPEC 13.3). Compiled globs reduce to the patterns they
 * were compiled from; everything else is already plain.
 */
export function configurationToStored(configuration: Configuration): JsonValue {
  return {
    specGroups: configuration.specGroups.map(groupToStored),
    codeGroups: configuration.codeGroups.map(groupToStored),
    markdown:
      configuration.markdown === undefined
        ? null
        : {
            emit: configuration.markdown.emit,
            outDir: configuration.markdown.outDir ?? null,
          },
    coverage: configuration.coverage.map((profile): JsonValue => ({
      name: profile.name,
      target: profile.target,
      targetTags:
        profile.targetTags === undefined ? null : [...profile.targetTags],
      targets: profile.targets,
      boundary: profile.boundary,
      boundaryKind: profile.boundaryKind,
      mode: profile.mode,
      edgeKinds: [...profile.edgeKinds],
    })),
    policy: configuration.policy.map((rule): JsonValue => ({
      name: rule.name,
      type: rule.type,
      from: selectorToStored(rule.from),
      to: selectorToStored(rule.to),
      kinds: [...rule.kinds],
    })),
  };
}
