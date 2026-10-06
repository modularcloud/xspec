// T6.5-22(a)'s universal assertion, held by the subprocess driver over every
// performed move (test/helpers/added-import-identifiers.ts; TEST-SPEC
// T6.5-22(a), SPEC 6.5): its mechanics pinned against a known-behavior
// stand-in before any product-facing test trusts them. The stand-in is a
// tiny Node script that rewrites the workspace as the test's plan says and
// exits as told, driven through the same binding shape product tests use,
// so each vector fixes exactly which import declarations an operation added:
//   * the hook fires — a performed move adding a barred identifier (`let`,
//     T6.5-22(b)'s first lure) is failed, a diagnosed assertion failure
//     naming the file, the identifier, and the clause — and passes a fresh
//     one; each clause the name analysis decides fails in its kind of file
//     (referenced, bound in some scope, not distinct, `S` in a spec source,
//     a TSX pragma's factory and `React`), a created target file judged
//     against empty content;
//   * what is read: the sources the configuration discovers — a file-form
//     move's specifier rewrites added nothing, its relocated file compared
//     with its origin; derived files, Markdown emit destinations, and files
//     no group discovers are not judged; `--config`'s directory is the root,
//     the upward search starts at the working directory, and flags stand
//     anywhere (SPEC 12.0);
//   * what is not judged: a run exiting non-zero, a `--preview`, another
//     command;
//   * a rewritten source not well-formed after the operation, or before it,
//     is a diagnosed failure too;
//   * a spec source binding a word strict mode code admits as no binding, or
//     `await` — well-formed under 14.20, an early error alone (T6.5-22:
//     `import let from "./let.xspec"` derives) — is read (`readMdxTree`)
//     though no S-9 allowance admits it, `deriveMdx`'s verdicts unchanged,
//     while a reserved word no binding derives (`enum`) is read nowhere.
// And `judgeAddedImportsOfFile`, the same judgement over one file's two
// texts that T6.5-22(b)'s lures apply to their receiving file after the
// move: the declarations added, each with its specifier's value and local
// bindings, and the breaches, in a spec source and a code source alike; a
// side not well-formed yields that problem alone.
// And the reader value-blind byte compares read a fresh identifier with
// (helpers/ts-identifiers.ts, `expectFreshIdentifier` in
// helpers/import-insertion.ts; SPEC 6.5, 1.4, 14.20; TEST-SPEC T1.4-5,
// T6.4-2, T6.5-8): a run is an identifier exactly when TypeScript 5.9.3 at
// ESNext judges it one, code point by code point — U+00E9 and U+2EBF0
// accepted, U+1C89 (which the runtime's later tables admit) rejected, the
// verdicts TypeScript's own scanner gives — the scanners read an
// astral code point whole, a permissive capture holds a non-ASCII
// identifier whole, and the guards exclude every identifier part beside it.
// Every non-ASCII input is built from its code point.

import ts from "typescript-5.9.3";
import { describe, expect, onTestFinished, test } from "vitest";
import {
  judgeAddedImportsOfFile,
  readPerformedMove,
} from "../helpers/added-import-identifiers.js";
import { HarnessAssertionError } from "../helpers/assertions.js";
import { expectFreshIdentifier } from "../helpers/import-insertion.js";
import {
  deriveMdx,
  MDX_ALLOWANCES,
  readMdxTree,
} from "../helpers/mdx-derivability.js";
import { runProduct } from "../helpers/subprocess.js";
import type { ProductBinding, RunResult } from "../helpers/subprocess.js";
import {
  freshIdentifierProblem,
  IDENTIFIER_RUN_SOURCE,
  identifierRunAt,
  isTsIdentifier,
  NO_RUN_AFTER_SOURCE,
  NO_RUN_BEFORE_SOURCE,
  readTsIdentifierAt,
  readTsIdentifierEndingAt,
} from "../helpers/ts-identifiers.js";
import { TestWorkspace, type WorkspaceDecl } from "../helpers/workspace.js";

// The stand-in: removes and writes what the plan names (paths relative to
// the working directory), then exits with the plan's code.
const STANDIN_SOURCE = `import fs from "node:fs";
import path from "node:path";

const plan = JSON.parse(process.env.XSPEC_STANDIN_PLAN ?? "{}");
for (const rel of plan.remove ?? []) fs.rmSync(rel);
for (const [rel, content] of Object.entries(plan.write ?? {})) {
  fs.mkdirSync(path.dirname(rel), { recursive: true });
  fs.writeFileSync(rel, content);
}
process.exit(plan.exit ?? 0);
`;

interface Plan {
  readonly write?: Readonly<Record<string, string>>;
  readonly remove?: readonly string[];
  readonly exit?: number;
}

interface Stage {
  readonly workspace: TestWorkspace;
  readonly binding: ProductBinding;
  /** Runs the stand-in with `argv` in `cwd` (the root by default). */
  run(argv: readonly string[], plan: Plan, cwd?: string): Promise<RunResult>;
}

async function stage(decl: WorkspaceDecl): Promise<Stage> {
  const workspace = await TestWorkspace.create({
    ...decl,
    files: { "bin/standin.mjs": STANDIN_SOURCE, ...decl.files },
  });
  onTestFinished(() => workspace.dispose());
  const binding: ProductBinding = {
    label: "T6.5-22(a) stand-in",
    command: process.execPath,
    prefixArgs: [workspace.path("bin/standin.mjs")],
  };
  return {
    workspace,
    binding,
    run: async (argv, plan, cwd = workspace.root) =>
      await runProduct(binding, {
        cwd,
        argv,
        env: { XSPEC_STANDIN_PLAN: JSON.stringify(plan) },
      }),
  };
}

/** The run must fail as a diagnosed assertion failure matching each
 * pattern; resolves with the failure's message. */
async function expectBreach(
  run: Promise<RunResult>,
  ...patterns: readonly RegExp[]
): Promise<string> {
  const error = await run.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(HarnessAssertionError);
  const message = (error as Error).message;
  expect(message).toMatch(/^T6\.5-22\(a\)/);
  for (const pattern of patterns) expect(message).toMatch(pattern);
  return message;
}

async function expectExit(
  run: Promise<RunResult>,
  code: number,
): Promise<void> {
  expect((await run).exitCode).toBe(code);
}

const CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts", "src/**/*.tsx"]
  }
})
`;

const SECTION_A = '<S id="a">\n\nAlpha.\n</S>\n';
const SECTION_B = '<S id="b">\n\nBeta.\n</S>\n';
const SECTION_MOVE = ["move", "specs/A.mdx#a", "specs/B.mdx#b.a"];

const BASE_FILES = {
  "xspec.config.ts": CONFIG,
  "specs/A.mdx": SECTION_A,
  "specs/B.mdx": SECTION_B,
};

/** `B.mdx` with `declaration` heading it as an ESM block of its own. */
const bWith = (declaration: string): string => `${declaration}\n\n${SECTION_B}`;

describe("T6.5-22(a): the driver judges a performed move's added identifiers", () => {
  test("a section move adding `import let from …` to a spec source fails, naming the file, the identifier, and the clause; a fresh identifier passes", async () => {
    const barred = await stage({ files: BASE_FILES });
    const message = await expectBreach(
      barred.run(SECTION_MOVE, {
        write: { "specs/B.mdx": bWith('import let from "./let.xspec"') },
      }),
      /specs\/B\.mdx: the added identifier `let` \(`import let from "\.\/let\.xspec"`\) is barred: /,
    );
    expect(message.split("\n")).toHaveLength(2);

    const fresh = await stage({ files: BASE_FILES });
    await expectExit(
      fresh.run(SECTION_MOVE, {
        write: { "specs/B.mdx": bWith('import fresh from "./let.xspec"') },
      }),
      0,
    );
  });

  test("in a code source: a name the file references, and one it binds only in a function, are failed", async () => {
    const { run } = await stage({
      files: {
        ...BASE_FILES,
        "src/t.ts": 'test("x", () => {})\n',
        "src/h.ts":
          "export function g() {\n  const helper = 1\n  return helper\n}\n",
      },
    });
    await expectBreach(
      run(SECTION_MOVE, {
        write: {
          "src/t.ts":
            'import test from "../specs/test.xspec"\ntest("x", () => {})\n',
          "src/h.ts":
            'import helper from "../specs/helper.xspec"\nexport function g() {\n  const helper = 1\n  return helper\n}\n',
        },
      }),
      /src\/t\.ts: the added identifier `test` .* is equal to a name the pre-operation file references/,
      /src\/h\.ts: the added identifier `helper` .* is bound by a declaration of the pre-operation file/,
    );
  });

  test("added identifiers are distinct; `S` is barred in a spec source and not in a code source", async () => {
    const twice = await stage({
      files: { ...BASE_FILES, "src/c.ts": "export const v = 1\n" },
    });
    await expectBreach(
      twice.run(SECTION_MOVE, {
        write: {
          "src/c.ts":
            'import X from "../specs/a.xspec"\nimport X from "../specs/c.xspec"\nexport const v = 1\n',
        },
      }),
      /src\/c\.ts: the added identifier `X` .* is not distinct from another identifier added to the file/,
    );

    const spec = await stage({ files: BASE_FILES });
    await expectBreach(
      spec.run(SECTION_MOVE, {
        write: { "specs/B.mdx": bWith('import S from "./s.xspec"') },
      }),
      /specs\/B\.mdx: the added identifier `S` .* is barred: a compiler-provided name/,
    );

    const code = await stage({
      files: { ...BASE_FILES, "src/c.ts": "export const v = 1\n" },
    });
    await expectExit(
      code.run(SECTION_MOVE, {
        write: {
          "src/c.ts":
            'import S, { text } from "../specs/s.xspec"\nexport const v = 1\n',
        },
      }),
      0,
    );
  });

  test("a TSX source bars `React` and the factory its `@jsx` pragma names", async () => {
    const { run } = await stage({
      files: {
        ...BASE_FILES,
        "src/d.tsx": "/** @jsx h */\nexport const v = 1\n",
      },
    });
    await expectBreach(
      run(SECTION_MOVE, {
        write: {
          "src/d.tsx":
            '/** @jsx h */\nimport h from "../specs/h.xspec"\nimport React from "../specs/React.xspec"\nexport const v = 1\n',
        },
      }),
      /src\/d\.tsx: the added identifier `h` .* is barred: in a TSX source, the leading identifier of a factory/,
      /src\/d\.tsx: the added identifier `React` .* is barred: `React` in a TSX source/,
    );
  });

  test("a created target file is judged against empty pre-operation content", async () => {
    const argv = ["move", "specs/A.mdx#a", "specs/N.mdx#n"];
    const created = await stage({ files: BASE_FILES });
    await expectBreach(
      created.run(argv, {
        write: {
          "specs/N.mdx":
            'import Spec from "./a.xspec"\n\n<S id="n">\n\nNu.\n</S>\n',
        },
      }),
      /specs\/N\.mdx: the added identifier `Spec` .* is barred: a compiler-provided name/,
    );

    const fresh = await stage({ files: BASE_FILES });
    await expectExit(
      fresh.run(argv, {
        write: {
          "specs/N.mdx":
            'import Fresh from "./a.xspec"\n\n<S id="n">\n\nNu.\n</S>\n',
        },
      }),
      0,
    );
  });

  test("a file-form move: specifier rewrites add nothing, a kept barred binding included; an import added to the relocated file is judged", async () => {
    const files = {
      ...BASE_FILES,
      "specs/A.mdx": `import Object from "./Object.xspec"\n\n${SECTION_A}`,
      "specs/C.mdx":
        'import A from "./A.xspec"\n\n<S id="c" d={A.a}>\n\nGamma.\n</S>\n',
    };
    const argv = ["move", "specs/A.mdx", "specs/sub/A.mdx"];
    const rewrittenC =
      "import A from './sub/A.xspec'\n\n<S id=\"c\" d={A.a}>\n\nGamma.\n</S>\n";

    const rewrites = await stage({ files });
    await expectExit(
      rewrites.run(argv, {
        remove: ["specs/A.mdx"],
        write: {
          "specs/sub/A.mdx": `import Object from "../Object.xspec"\n\n${SECTION_A}`,
          "specs/C.mdx": rewrittenC,
        },
      }),
      0,
    );

    const added = await stage({ files });
    await expectBreach(
      added.run(argv, {
        remove: ["specs/A.mdx"],
        write: {
          "specs/sub/A.mdx": `import Object from "../Object.xspec"\nimport Math from "../Math.xspec"\n\n${SECTION_A}`,
          "specs/C.mdx": rewrittenC,
        },
      }),
      /specs\/sub\/A\.mdx: the added identifier `Math` .* is barred: /,
    );
  });

  test("a run exiting non-zero, a preview, and another command are not judged", async () => {
    const { run } = await stage({ files: BASE_FILES });
    await expectExit(
      run(SECTION_MOVE, {
        write: { "specs/B.mdx": bWith('import let from "./let.xspec"') },
        exit: 1,
      }),
      1,
    );
    await expectExit(
      run([...SECTION_MOVE, "--preview"], {
        write: { "specs/B.mdx": bWith('import eval from "./eval.xspec"') },
      }),
      0,
    );
    await expectExit(
      run(["rename", "specs/B.mdx", "b", "c"], {
        write: { "specs/B.mdx": bWith('import yield from "./yield.xspec"') },
      }),
      0,
    );
    await expectExit(
      run(["show", "move"], {
        write: { "specs/B.mdx": bWith('import static from "./static.xspec"') },
      }),
      0,
    );
  });

  test("`--config`'s directory is the workspace root, flags stand anywhere, and the upward search starts at the working directory", async () => {
    const { workspace, run } = await stage({
      files: {
        "cfg/xspec.config.ts": CONFIG,
        "cfg/specs/A.mdx": SECTION_A,
        "cfg/specs/B.mdx": SECTION_B,
      },
    });
    await expectBreach(
      run(
        [
          "--json",
          "move",
          "--config",
          "cfg/xspec.config.ts",
          "specs/A.mdx#a",
          "specs/B.mdx#b.a",
        ],
        {
          write: {
            "cfg/specs/B.mdx": bWith('import eval from "./eval.xspec"'),
          },
        },
      ),
      /- specs\/B\.mdx: the added identifier `eval` /,
    );
    // From `cfg/specs`, the search finds `cfg/xspec.config.ts`; the file
    // read before the move holds the `eval` binding the last run wrote.
    await expectBreach(
      run(
        SECTION_MOVE,
        { write: { "B.mdx": bWith('import static from "./static.xspec"') } },
        workspace.path("cfg/specs"),
      ),
      /- specs\/B\.mdx: the added identifier `static` /,
    );
  });

  test("derived files, Markdown emit destinations, and files no group discovers are not judged; a code group's own file is", async () => {
    const files = {
      "xspec.config.ts": `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  },
  code: {
    app: ["src/**/*.ts", "specs/**/*.ts", "specs/**/*.md", ".xspec/**/*.ts"]
  },
  markdown: { emit: true }
})
`,
      "specs/A.mdx": SECTION_A,
      "specs/B.mdx": SECTION_B,
    };
    const barred = 'import let from "./let.xspec"\n';
    const { run } = await stage({ files });
    await expectExit(
      run(SECTION_MOVE, {
        write: {
          "specs/B.xspec.ts": barred,
          "specs/B.md": barred,
          ".xspec/g.ts": barred,
          "notes/n.ts": barred,
        },
      }),
      0,
    );
    const message = await expectBreach(
      run(SECTION_MOVE, {
        write: { "specs/x.ts": barred, "specs/notes.md": barred },
      }),
      /- specs\/notes\.md: the added identifier `let` /,
      /- specs\/x\.ts: the added identifier `let` /,
    );
    expect(message.split("\n")).toHaveLength(3);
  });

  test("a rewritten source not well-formed after the operation, or before it, is a diagnosed failure", async () => {
    const after = await stage({ files: BASE_FILES });
    await expectBreach(
      after.run(SECTION_MOVE, {
        write: { "specs/B.mdx": '<S id="b">\n\nBeta.\n' },
      }),
      /specs\/B\.mdx, which the operation rewrote, is not well-formed under its grammar after it/,
    );

    const before = await stage({
      files: { ...BASE_FILES, "specs/B.mdx": '<S id="b">\n\nBeta.\n' },
      mdx: { unparseable: ["specs/B.mdx"] },
    });
    await expectBreach(
      before.run(SECTION_MOVE, { write: { "specs/B.mdx": SECTION_B } }),
      /specs\/B\.mdx, which the operation rewrote, was not well-formed under its grammar before it/,
    );
  });
});

describe("T6.5-22(a): a performed move, read by SPEC 12.0's invocation grammar", () => {
  test.each([
    [["move", "a.mdx", "b.mdx"], "file"],
    [["move", "a.mdx#x", "b.mdx#y"], "section"],
    [["--json", "move", "a.mdx#x", "--test-hold", "h", "b.mdx#y"], "section"],
    [["--file", "--json", "move", "a.mdx", "b.mdx"], "file"],
    [["move", "--", "--a.mdx", "b.mdx"], "file"],
  ] as const)("%j performs a %s-form move", (argv, form) => {
    expect(readPerformedMove(argv)?.form).toBe(form);
  });

  test("`--config`'s value is read, whatever it spells", () => {
    expect(
      readPerformedMove(["move", "--config", "--json", "a.mdx", "b.mdx"]),
    ).toEqual({
      form: "file",
      origin: "a.mdx",
      destination: "b.mdx",
      config: "--json",
    });
  });

  test.each([
    [["move", "a.mdx#x", "b.mdx#y", "--preview"]],
    [["rename", "a.mdx", "x", "y"]],
    [["show", "move"]],
    [["--config", "move", "a.mdx", "b.mdx"]],
    [["move", "a.mdx#x", "b.mdx"]],
    [["move", "a.mdx", "b.mdx", "c.mdx"]],
    [["move", "a.mdx"]],
    [["move", "a.mdx", "b.mdx", "--config"]],
    [["move", "--json", "--json", "a.mdx", "b.mdx"]],
  ] as const)("%j performs none", (argv) => {
    expect(readPerformedMove(argv)).toBeUndefined();
  });
});

describe("T6.5-22(a): a spec source's strict-mode-barred import bindings read, S-9's verdicts unchanged", () => {
  // prettier-ignore
  const EARLY_ERROR_BINDINGS = [
    "let", "static", "implements", "interface", "package", "private",
    "protected", "public", "eval", "arguments", "yield", "await",
  ];

  test.each(EARLY_ERROR_BINDINGS)(
    "`import %s from …` reads, though S-9's allowances admit it nowhere",
    (name) => {
      const text = bWith(`import ${name} from "./${name}.xspec"`);
      expect(deriveMdx(text, { allowances: MDX_ALLOWANCES }).derives).toBe(
        false,
      );
      expect(() => readMdxTree(text)).not.toThrow();
    },
  );

  test("a reserved word no binding derives, and an `await` no identifier, read nowhere", () => {
    for (const text of [
      bWith('import enum from "./enum.xspec"'),
      bWith('import default from "./default.xspec"'),
      '<S id="b">\n\n{await}\n</S>\n',
      'import await from "./await.xspec"\n\n<S id="b">\n\nBeta {text(await.a)}.\n</S>\n',
    ]) {
      expect(() => readMdxTree(text)).toThrow(/does not derive/);
    }
  });
});

describe("T6.5-22(b): one file's added declarations and breaches (`judgeAddedImportsOfFile`)", () => {
  const HOST_BEFORE =
    'import A from "./A.xspec"\n\n<S id="host" d={A.w}>\nHost text, quoting {text(A.a)}.\n</S>\n';
  const hostAfter = (name: string): string =>
    `import A from "./A.xspec"\nimport ${name} from "./let.xspec"\n\n<S id="host" d={A.w}>\nHost text, quoting {text(${name}.a)}.\n</S>\n`;

  test("a spec source: the added declaration with its specifier's value and binding; a fresh one passes, `let` is barred", () => {
    expect(
      judgeAddedImportsOfFile(
        "specs/host.mdx",
        "spec-source",
        HOST_BEFORE,
        hostAfter("let2"),
      ),
    ).toEqual({
      added: [
        {
          text: 'import let2 from "./let.xspec"',
          specifier: "./let.xspec",
          identifiers: ["let2"],
        },
      ],
      problems: [],
    });
    const barred = judgeAddedImportsOfFile(
      "specs/host.mdx",
      "spec-source",
      HOST_BEFORE,
      hostAfter("let"),
    );
    expect(barred.added.map((declaration) => declaration.identifiers)).toEqual([
      ["let"],
    ]);
    expect(barred.problems).toHaveLength(1);
    expect(barred.problems[0]).toMatch(
      /^specs\/host\.mdx: the added identifier `let` \(`import let from "\.\/let\.xspec"`\) is barred/,
    );
  });

  test("a code source: `Record`, referenced only in a type annotation, is a breach; an unchanged file adds nothing", () => {
    const before =
      'import A from "../specs/A.xspec"\n\nlet r: Record<string, number> = {}\n\nA.m\nA.w\n';
    const after =
      'import A from "../specs/A.xspec"\nimport Record from "../specs/Record.xspec"\n\nlet r: Record<string, number> = {}\n\nRecord.m\nA.w\n';
    const judgement = judgeAddedImportsOfFile(
      "src/record.ts",
      "typescript",
      before,
      after,
    );
    expect(judgement.added).toEqual([
      {
        text: 'import Record from "../specs/Record.xspec"',
        specifier: "../specs/Record.xspec",
        identifiers: ["Record"],
      },
    ]);
    expect(judgement.problems).toHaveLength(1);
    expect(judgement.problems[0]).toMatch(
      /the added identifier `Record` .* is equal to a name the pre-operation file references/,
    );
    expect(
      judgeAddedImportsOfFile("src/record.ts", "typescript", before, before),
    ).toEqual({ added: [], problems: [] });
  });

  test("a side not well-formed yields that problem alone", () => {
    const judgement = judgeAddedImportsOfFile(
      "specs/host.mdx",
      "spec-source",
      HOST_BEFORE,
      'import A from "./A.xspec"\nimport await from "./await.xspec"\n\n<S id="host" d={A.w}>\nHost text, quoting {text(await.a)}.\n</S>\n',
    );
    expect(judgement.added).toEqual([]);
    expect(judgement.problems).toHaveLength(1);
    expect(judgement.problems[0]).toMatch(
      /^specs\/host\.mdx, which the operation rewrote, is not well-formed under its grammar after it/,
    );
  });
});

// ---------------------------------------------------------------------------
// The fresh-identifier reader (helpers/ts-identifiers.ts): TypeScript 5.9.3
// at ESNext judges each run (SPEC 6.5, 1.4, 14.20; T1.4-5, T6.4-2).

const E_ACUTE = String.fromCodePoint(0x00e9);
const TJE = String.fromCodePoint(0x1c89);
const IDEOGRAPH = String.fromCodePoint(0x2ebf0);
const ESNEXT = ts.ScriptTarget.ESNext;

/** TypeScript 5.9.3's own scanner reading `run` at ESNext as exactly one
 * identifier token, with no error — the release's public whole-text reading,
 * apart from the reader's code-point loop. */
function scansAsOneIdentifier(run: string): boolean {
  let errors = 0;
  const scanner = ts.createScanner(
    ESNEXT,
    false,
    ts.LanguageVariant.Standard,
    run,
    () => {
      errors += 1;
    },
  );
  const kind = scanner.scan();
  return (
    errors === 0 &&
    kind === ts.SyntaxKind.Identifier &&
    scanner.getTokenEnd() === run.length
  );
}

/** Runs 5.9.3 reads as one identifier at ESNext — U+2EBF0 at ESNext alone,
 * not at ES5 (T1.4-5(c)). */
const ACCEPTED_RUNS: readonly { name: string; run: string }[] = [
  { name: "`x`", run: "x" },
  { name: "`$`", run: "$" },
  { name: "`_a`", run: "_a" },
  { name: "U+00E9 alone", run: E_ACUTE },
  { name: "U+00E9 after `M`", run: `M${E_ACUTE}` },
  { name: "U+2EBF0 alone", run: IDEOGRAPH },
  { name: "U+2EBF0 after a letter", run: `a${IDEOGRAPH}` },
];

/** Runs 5.9.3 reads as no identifier, each with what the diagnosis names:
 * U+1C89 begins and continues none there, though the runtime's later
 * Unicode tables admit it to both (T6.4-2). */
const REJECTED_RUNS: readonly {
  name: string;
  run: string;
  offending: string;
}[] = [
  { name: "a leading digit", run: "1a", offending: "U+0031" },
  { name: "U+1C89 alone", run: TJE, offending: "U+1C89" },
  { name: "U+1C89 before `x`", run: `${TJE}x`, offending: "U+1C89" },
  { name: "the empty run", run: "", offending: "it is empty" },
  { name: "a run holding a space", run: "a b", offending: "U+0020" },
  { name: "a run holding `-`", run: "a-b", offending: "U+002D" },
];

describe("T1.4-5, T6.5-8: a fresh identifier read as TypeScript 5.9.3 judges one at ESNext", () => {
  test("`x`, `$`, `_a`, U+00E9 alone and after `M`, and U+2EBF0 alone and after a letter are each one identifier, read whole between ASCII delimiters", () => {
    for (const { name, run } of ACCEPTED_RUNS) {
      const framed = `(${run}.y`;
      expect([name, freshIdentifierProblem(run)]).toEqual([name, undefined]);
      expect([name, isTsIdentifier(run)]).toEqual([name, true]);
      // TypeScript's own scanner agrees.
      expect([name, scansAsOneIdentifier(run)]).toEqual([name, true]);
      expect([name, readTsIdentifierAt(framed, 1)]).toEqual([name, run]);
      expect([name, readTsIdentifierEndingAt(framed, 1 + run.length)]).toEqual([
        name,
        run,
      ]);
      expect([name, identifierRunAt(framed, 1)]).toEqual([name, run]);
      expect([name, expectFreshIdentifier(run, "context")]).toEqual([
        name,
        run,
      ]);
    }
  });

  test("a leading digit, U+1C89 alone and before `x`, the empty run, and a run holding a space or `-` are none, failed diagnosed naming the run, its code point, and SPEC 6.5 and 1.4", () => {
    for (const { name, run, offending } of REJECTED_RUNS) {
      expect([name, isTsIdentifier(run)]).toEqual([name, false]);
      expect([name, scansAsOneIdentifier(run)]).toEqual([name, false]);
      const problem = freshIdentifierProblem(run);
      expect([name, problem]).toEqual([name, expect.any(String)]);
      expect(problem).toContain(`the run ${JSON.stringify(run)}`);
      expect(problem).toContain(offending);
      expect(problem).toMatch(/\(SPEC 6\.5, 1\.4, 14\.20\)$/);
      let thrown: unknown;
      try {
        expectFreshIdentifier(run, "T0 context");
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(HarnessAssertionError);
      expect((thrown as Error).message).toBe(`T0 context: ${String(problem)}`);
    }
    // A non-ASCII run is shown with its code points named.
    expect(freshIdentifierProblem(`${TJE}x`)).toContain(
      `the run ${JSON.stringify(`${TJE}x`)} (U+1C89 U+0078)`,
    );
  });

  test("the scanners read code point by code point, an astral code point whole, stopping where the judge rejects", () => {
    expect(readTsIdentifierAt(`a${IDEOGRAPH}b.c`, 0)).toBe(`a${IDEOGRAPH}b`);
    expect(readTsIdentifierAt(IDEOGRAPH, 0)).toBe(IDEOGRAPH);
    // U+1C89 continues no identifier, so `x` ends before it.
    expect(readTsIdentifierAt(`x${TJE}`, 0)).toBe("x");
    expect(readTsIdentifierAt(`${TJE}x`, 0)).toBeUndefined();
    expect(readTsIdentifierAt("1a", 0)).toBeUndefined();
    expect(readTsIdentifierAt("a", 1)).toBeUndefined();
    // Inside a surrogate pair no identifier begins.
    expect(readTsIdentifierAt(IDEOGRAPH, 1)).toBeUndefined();
    expect(readTsIdentifierEndingAt(`.${IDEOGRAPH}`, 3)).toBe(IDEOGRAPH);
    expect(readTsIdentifierEndingAt(`(M${E_ACUTE}`, 3)).toBe(`M${E_ACUTE}`);
    expect(readTsIdentifierEndingAt(`${TJE}x`, 2)).toBe("x");
    // The run of parts ending there opens with a digit.
    expect(readTsIdentifierEndingAt("(1a", 3)).toBeUndefined();
    expect(readTsIdentifierEndingAt("(a", 1)).toBeUndefined();
    expect(readTsIdentifierEndingAt("", 0)).toBeUndefined();
  });

  test("a permissive capture holds a non-ASCII identifier whole, and the guards exclude every identifier part beside it", () => {
    // T6.5-8's lookbehind shape: no identifier part and no `.` before.
    const rooted = new RegExp(
      `${NO_RUN_BEFORE_SOURCE}(?<!\\.)(${IDENTIFIER_RUN_SOURCE})\\.y;`,
      "g",
    );
    const code =
      `const p = ${E_ACUTE}a.y;\n` +
      `const q = o.${E_ACUTE}b.y;\n` +
      `const r = M${IDEOGRAPH}.y;\n` +
      `const s = ${TJE}x.y;\n`;
    const captured = Array.from(code.matchAll(rooted), (match) => match[1]);
    expect(captured).toEqual([`${E_ACUTE}a`, `M${IDEOGRAPH}`, `${TJE}x`]);
    // The ASCII-only guard reads `a` and `b` out of the non-ASCII
    // identifiers, where the judge's reads them whole or not at all.
    const ascii = /(?<![A-Za-z0-9_$.])([A-Za-z_$][A-Za-z0-9_$]*)\.y;/g;
    expect(Array.from(code.matchAll(ascii), (match) => match[1])).toEqual([
      "a",
      "b",
      "x",
    ]);
    // The judge decides each capture.
    expect(captured.map((run) => isTsIdentifier(run ?? ""))).toEqual([
      true,
      true,
      false,
    ]);
    // T6.5-18's lookahead shape: no identifier part after the property.
    const property = new RegExp(
      `${NO_RUN_BEFORE_SOURCE}(${IDENTIFIER_RUN_SOURCE})\\.y${NO_RUN_AFTER_SOURCE}`,
      "g",
    );
    const calls = `f(${E_ACUTE}.y${E_ACUTE}); g(Tgt.y); h(Tgt.y${IDEOGRAPH});`;
    expect(Array.from(calls.matchAll(property), (match) => match[1])).toEqual([
      "Tgt",
    ]);
    // The run class: every non-ASCII code point, and of ASCII exactly `$`,
    // the digits, the letters, and `_`.
    const whole = new RegExp(`^${IDENTIFIER_RUN_SOURCE}$`);
    for (let unit = 0; unit < 0x80; unit++) {
      const char = String.fromCharCode(unit);
      expect([unit, whole.test(char)]).toEqual([
        unit,
        /^[$0-9A-Z_a-z]$/.test(char),
      ]);
    }
    for (const char of [E_ACUTE, TJE, IDEOGRAPH, String.fromCharCode(0xa0)]) {
      expect(whole.test(char)).toBe(true);
      expect(identifierRunAt(`${char}.`, 0)).toBe(char);
    }
    expect(identifierRunAt("a b", 0)).toBe("a");
    expect(identifierRunAt(".a", 0)).toBe("");
  });
});
