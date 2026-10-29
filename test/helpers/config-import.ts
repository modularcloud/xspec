// The configuration import's spelling (TEST-SPEC T7-9, §16 P-19; SPEC 7,
// 2.4; CERTIFICATIONS.md §CONF-IMPORT and its Exclusions bullet "T7-9 and
// T7-10") — the one path by which the harness stages a configuration whose
// import's module specifier is a given static string literal. Harness
// machinery only: no product imports, no test-framework dependence.
//
// SPEC 7 reads the specifier as spelled (2.4): any static string literal,
// in either quote style, escape sequences, line continuations, and U+FFFD
// included, never interpreted, resolved, or loaded. A test of that rule is
// worth only what reaches the file: tooling that handles the literal as its
// value — a code printer (`JSON.stringify` among them) serializing a drawn
// value, text whose escape sequences were decoded on their way into the
// harness — stages another spelling of the same value, and a formatter
// normalizing quotes stages the single-quoted form as a double-quoted one;
// S-9 accepts either, and the class P-19 searches goes silently unreached
// (CONF-IMPORT's two staging hazards). So the literal is handed over exactly
// as it is to appear in the file, its quotes included, and reaches the
// file's text by concatenation alone: `configImportText` joins three
// strings and nothing else — no printer, no decoding, no formatter, no
// re-quoting — and the workspace builder writes that text's UTF-8 bytes as
// they stand (test/self/p19-fixed-seed-draws.test.ts reads each fixed-seed
// draw's staged file back and pins its bytes). P-19's draws
// (test/suite/registry/section-16-p19.ts) and T7-9(a)'s escape-spelled,
// single-quoted, and raw-U+FFFD arms are staged through this module, so that
// those arms ride VIOL-IMPORT-BRACED's and VIOL-IMPORT-SINGLE's
// certification of P-19 representatively (CERTIFICATIONS.md, Exclusions).
// A literal holding a backslash is built by its caller from code point
// U+005C (the BACKSLASH constant below), never spelled in harness source,
// where a string or template literal would itself interpret an escape.
//
// The workspace (T7-9's opening; CONF-IMPORT's scope and staging
// constraints): `xspec.config.ts` with one spec group, `main`, globbing
// `specs/*.mdx`, and `markdown` with `emit: true`, emitting next to sources
// (7.3, 13.2) — no code group at all, and no `coverage` or `policy`, so that
// no configured group discovers the configuration file — over `specs/A.mdx`
// and `specs/B.mdx`, each a trivial single-section source whose one section
// carries an `id` alone around plain text (`<S id="a">A</S>`, T7-9(d)'s
// `specs/A.mdx`); no git repository and no `node_modules`.

import { stagedMdx } from "./staged-mdx.js";
import type { StagedMdx } from "./staged-mdx.js";
import { stagedTs } from "./staged-ts.js";
import type { StagedTs } from "./staged-ts.js";

/** U+005C, the escape character, built from its code point. */
export const BACKSLASH = String.fromCodePoint(0x5c);

/** The configuration file's workspace-relative path (SPEC 7). */
export const CONFIG_IMPORT_CONFIG_PATH = "xspec.config.ts";

/**
 * The configuration's text before its import's specifier: the import of
 * `defineConfig`, unaliased, with no modifier and no attributes (SPEC 7).
 */
export const CONFIG_IMPORT_HEAD = "import { defineConfig } from ";

/**
 * The configuration's text after its import's specifier: the line's end, a
 * blank line, and the default export — the one spec group `main` over
 * `specs/*.mdx` and Markdown emission next to sources (module header).
 */
export const CONFIG_IMPORT_TAIL = `

export default defineConfig({
  specs: {
    main: ["specs/*.mdx"]
  },
  markdown: { emit: true }
})
`;

/** The twin's specifier (T7-9, P-19): the double-quoted name `xspec`. */
export const CONFIG_IMPORT_TWIN_LITERAL = '"xspec"';

/**
 * The configuration whose import's module specifier is `literal`, spelled
 * exactly as it is to appear in the file, its quotes included: the three
 * strings joined, nothing printed, decoded, or re-quoted (module header).
 * The caller guarantees `literal` is one static string literal TypeScript
 * 5.9.3's scanner accepts; S-9 judges the result before any product sees it.
 */
export function configImportText(literal: string): string {
  return CONFIG_IMPORT_HEAD + literal + CONFIG_IMPORT_TAIL;
}

/**
 * The twin's configuration, a staged-source record (S-9's timing clause:
 * every twin workspace P-19 stages is created at module load's bytes).
 */
export const CONFIG_IMPORT_TWIN_CONFIG: StagedTs = stagedTs(
  'P-19 xspec.config.ts (the twin: the specifier "xspec", one spec group main over specs/*.mdx, Markdown emitted next to sources)',
  configImportText(CONFIG_IMPORT_TWIN_LITERAL),
);

/** The workspace's two sources, staged-source records (module header). */
export const CONFIG_IMPORT_SOURCES: Readonly<Record<string, StagedMdx>> = {
  "specs/A.mdx": stagedMdx(
    `P-19 specs/A.mdx (one section, its id alone around plain text: <S id="a">A</S>)`,
    `<S id="a">A</S>
`,
  ),
  "specs/B.mdx": stagedMdx(
    `P-19 specs/B.mdx (one section, its id alone around plain text: <S id="b">B</S>)`,
    `<S id="b">B</S>
`,
  ),
};
