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

import { describe, expect, onTestFinished, test } from "vitest";
import { readPerformedMove } from "../helpers/added-import-identifiers.js";
import { HarnessAssertionError } from "../helpers/assertions.js";
import {
  deriveMdx,
  MDX_ALLOWANCES,
  readMdxTree,
} from "../helpers/mdx-derivability.js";
import { runProduct } from "../helpers/subprocess.js";
import type { ProductBinding, RunResult } from "../helpers/subprocess.js";
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
