// The certification fixtures' valid workspace shapes, shared by the guards
// that drive a conformer's reader directly (CERTIFICATIONS.md preamble,
// third paragraph): the invocation-grammar guard
// (certification-fixture-grammar.test.ts), whose tables stage these as their
// declarations, and the configuration-import guard
// (certification-fixture-import.test.ts), which stages each once importing
// from "xspec" and once per spelling of its specifier. One declaration per
// conformer with a reader of its own, each a workspace its scope admits and
// every command its table drives answers over; each configuration file
// spells its import's specifier `"xspec"` exactly once, as the import guard
// requires of the twin it varies.

import type { WorkspaceDecl } from "../helpers/workspace.js";

/** One spec group of `.mdx` sources (SPEC 7.1), no other configuration. */
export const SPEC_GROUP_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  }
})
`;

/**
 * CONF-DISC: one trivial single-section `.mdx` source in one spec group, as
 * §CONF-DISC's scope admits: no code group (so the conformer never loads
 * TypeScript), Markdown emission absent — a valid workspace `build`
 * regenerates and `ids` lists.
 */
export const DISC_STAGING: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPEC_GROUP_CONFIG,
    "specs/A.mdx": `<S id="a">
Alpha text.
</S>
`,
  },
};

/** CONF-IMPORT's configuration: one spec group, Markdown next to sources. */
const IMPORT_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  },
  markdown: { emit: true }
})
`;

/**
 * CONF-IMPORT: T7-9's workspace outside its install stagings, as
 * §CONF-IMPORT's scope admits — one spec group globbing `specs/*.mdx` over
 * `specs/A.mdx` and `specs/B.mdx`, each a trivial single-section source
 * whose one section carries an `id` alone around plain text (T7-9(d)'s
 * `<S id="a">A</S>`), and `markdown` with `emit: true`, emitting next to
 * sources (7.3, 13.2); no code group, `coverage`, `policy`, git, or
 * `node_modules`, so that no configured group discovers the configuration
 * file. A valid workspace `build` regenerates, `check` then finds current,
 * `ids` lists, and `inventory` reports.
 */
export const IMPORT_STAGING: WorkspaceDecl = {
  files: {
    "xspec.config.ts": IMPORT_CONFIG,
    "specs/A.mdx": `<S id="a">A</S>
`,
    "specs/B.mdx": `<S id="b">B</S>
`,
  },
};

/**
 * CONF-AVAIL: one finding-free spec source as §CONF-AVAIL's scope admits: a
 * section `a`, and a section `b` whose `d` prop and embedding each reference
 * `a` locally — two resolving occurrences (5.7), so the answers compared
 * hold records.
 */
export const AVAIL_STAGING: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPEC_GROUP_CONFIG,
    "specs/A.mdx": `<S id="a">
Alpha text.
</S>

<S id="b" d={"a"}>
Beta: {text("a")}
</S>
`,
  },
};

/**
 * CONF-ORPHAN: one spec group of one trivial single-section source, as
 * §CONF-ORPHAN's scope admits (its staging constraint: the spec glob matches
 * `.mdx` names alone), Markdown emission absent: a valid workspace `build`
 * regenerates.
 */
export const ORPHAN_STAGING: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPEC_GROUP_CONFIG,
    "specs/A.mdx": `<S id="a">
Alpha text.
</S>
`,
  },
};

/**
 * CONF-VALID: one finding-free spec source as §CONF-VALID's scope admits —
 * sections carrying `id` and `tags` props, `a` tagged `x` and `y` and `b`
 * untagged — so a `--tag` filter selects a proper subset (11.1).
 */
export const VALID_STAGING: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPEC_GROUP_CONFIG,
    "specs/A.mdx": `<S id="a" tags="x y">
Alpha text.
</S>

<S id="b">
Beta text.
</S>
`,
  },
};

/** CONF-MD: SPEC 1.3's own nested shape, `a` containing `a.b`, finding-free. */
export const MD_SOURCE = `<S id="a">
Alpha text.

<S id="a.b">
Beta text.
</S>
</S>
`;

/**
 * CONF-MD: one spec group with Markdown emission next to each source (7.3,
 * 13.2) — so a `build` that runs writes `specs/A.md`, and an exit-2 row's
 * unchanged workspace shows that none ran — and MD_SOURCE, a valid workspace
 * as §CONF-MD's scope admits ("every file well-formed MDX (14.20) and
 * valid"). No `check` runs on it to exit 0 before its `build`: on a
 * workspace never built, a conforming `check` reports the missing derived
 * files and graph data (12.2, 14.10), which §CONF-MD's scope leaves out
 * ("for T3-1's grammar-boundary arm, `check` exiting 0", after its
 * `build`), so the grammar table runs `check` in exit-2 rows alone, and the
 * import guard only once `build` has run.
 */
export const MD_STAGING: WorkspaceDecl = {
  files: {
    "xspec.config.ts": `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  },
  markdown: { emit: true }
})
`,
    "specs/A.mdx": MD_SOURCE,
  },
};

/**
 * CONF-CORE: one spec group of one single-section source, as §CONF-CORE's
 * scope admits (no imports, embeddings, `d` props, or tags; no `code`,
 * `markdown`, `coverage`, or `policy` keys; no git): a valid workspace every
 * served read answers and every served mutating command performs on.
 */
export const CORE_STAGING: WorkspaceDecl = {
  files: {
    "xspec.config.ts": SPEC_GROUP_CONFIG,
    "specs/A.mdx": `<S id="a">
Alpha text.
</S>
`,
  },
};
