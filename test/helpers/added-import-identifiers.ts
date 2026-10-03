// T6.5-22(a)'s universal assertion (TEST-SPEC T6.5-22(a); SPEC 6.5's
// constraints on an added import's identifiers): in every operation the
// suite performs that adds an import, whichever test performs it, each added
// identifier passes every constraint the fixture decides. Harness machinery
// only: no product imports, no test-framework dependence.
//
// Where it runs. The subprocess driver (helpers/subprocess.ts) is the one
// path every invocation takes — the registered bodies, the property runner,
// the certification runner, and S-7's sweep alike — so the assertion lives
// there: before spawning an invocation whose argv reads, under SPEC 12.0's
// invocation grammar, as a performed `move` (the operation 6.5 lets add an
// import; never a `--preview`, which performs nothing, 6.6), the driver has
// `prepareAddedImportCheck` read the pre-operation sources, and once the run
// exits 0 its `verify` reads the post-operation sources and judges them
// before the driver hands the run's result back. A breach is a diagnosed
// product failure (`HarnessAssertionError`) naming the file, the identifier,
// and the clause; a run that does not exit 0 is not judged.
//
// What it reads. The sources the operation could have rewritten — the
// workspace's discovered spec and code sources, found by the harness's own
// means from the configuration the invocation loads (SPEC 7: the `--config`
// path, else the nearest `xspec.config.ts` at or above the working
// directory; its directory the workspace root): the declarative
// configuration read with its literals as spelled (2.4), the globs matched
// by the harness's glob oracle (helpers/oracles/glob.ts), no symbolic link
// followed, and the derived files excluded as 13.4 excludes them (a name
// containing `.xspec.`, anything under `.xspec/`, a configured Markdown emit
// destination). A configuration the harness cannot read so — none found,
// not a plain file, not 7's declarative form — is one no performed move
// loads (14.14), so the operation goes unjudged; a file the environment
// refuses to read is left out on both sides.
//
// What it judges. Each source whose bytes the operation changed or created —
// a file-form move's relocated file compared with its origin's bytes, a
// created target file with empty content: its import declarations before and
// after (a spec source's in its ESM blocks, through S-9's MDX parse,
// helpers/mdx-derivability.ts `readMdxTree`; a code source's top-level ones,
// through the harness's TypeScript 5.9.3, TSX or plain as the name selects,
// 14.20), and the declarations the operation added: those after it that no
// declaration before it accounts for, compared by their characters — under a
// file-form move all but the specifier literal's, which that form's
// specifier rewrites alone change (6.5). The added declarations' identifiers
// (their local bindings, values otherwise unpinned) are judged with S-6's
// name analysis of the pre-operation file (helpers/oracles/name-analysis.ts):
// none barred there, none bound by a declaration of the file or referenced
// in it, all distinct, and in a spec source none of `S`, `Spec`, `text`. A
// source the operation rewrote that is not well-formed under its grammar is
// a diagnosed failure too, after the operation or before it — 6.5 keeps
// every file a successful move rewrites well-formed, and its valid-workspace
// precondition refuses a move over sources that are not (6.4, 14.20) — its
// names being unreadable either way.

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import ts from "typescript-5.9.3";
import { bytesEqual, fail } from "./assertions.js";
import { readMdxTree } from "./mdx-derivability.js";
import { globMatches } from "./oracles/glob.js";
import {
  addedIdentifierBreaches,
  analyzeNames,
  type ReceivingFileKind,
} from "./oracles/name-analysis.js";
import type { ArgvValue, RunResult } from "./subprocess.js";
import { judgeTypeScript } from "./ts-derivability.js";

/** A performed move's pending judgement (see the module header). */
export interface AddedImportCheck {
  /** Judges the operation's added imports when `result` exited 0. */
  verify(result: RunResult): Promise<void>;
}

/**
 * Before an invocation spawns: undefined unless `argv` (the tokens after the
 * binding's prefix) reads as a performed move under a configuration the
 * harness reads; else the check, holding the pre-operation sources.
 */
export async function prepareAddedImportCheck(
  cwd: string,
  argv: readonly ArgvValue[],
  commandLine: string,
): Promise<AddedImportCheck | undefined> {
  const move = readPerformedMove(argv);
  if (move === undefined) return undefined;
  const configPath = await locateConfiguration(cwd, move.config);
  if (configPath === undefined) return undefined;
  const configuration = await readConfiguration(configPath);
  if (configuration === undefined) return undefined;
  const before = await readSources(configuration);
  return {
    verify: async (result: RunResult): Promise<void> => {
      if (result.exitCode !== 0) return;
      const after = await readSources(configuration);
      const problems = judgeAddedImports(move, before, after);
      if (problems.length > 0) {
        fail(
          `T6.5-22(a), held over every operation that adds an import (SPEC 6.5's constraints on an added import's identifiers): ${commandLine} exited 0, and\n` +
            problems.map((problem) => `  - ${problem}`).join("\n"),
        );
      }
    },
  };
}

// ---------------------------------------------------------------------------
// The invocation (SPEC 12.0's grammar).

/**
 * The flags that take a value, by name: SPEC 12.0 fixes a flag's arity by
 * its name, the same for every command, and every other `--` token takes
 * none.
 */
// prettier-ignore
const VALUE_FLAGS: ReadonlySet<string> = new Set([
  "base", "config", "coverage", "file", "from", "group", "kinds", "name",
  "note", "status", "strategy", "tag", "test-hold", "to",
]);

/** A performed `move`, as its argv reads under SPEC 12.0's grammar. */
export interface PerformedMove {
  /** The section form when the operands spell `<file>#<id>` (6.5). */
  readonly form: "file" | "section";
  /** The first operand: `<old-file>`, or `<file>#<id>`. */
  readonly origin: string;
  /** The second operand: `<new-file>`, or `<target-file>#<new-id>`. */
  readonly destination: string;
  /** The `--config` value, when given. */
  readonly config: string | undefined;
}

/**
 * Reads an invocation's argv under SPEC 12.0's grammar — flag tokens
 * anywhere, a value-taking flag taking the whole next token, `--` ending
 * flag reading: a performed move, or undefined for anything else (another
 * command, a `--preview`, or tokens matching no move synopsis — a usage
 * error, exit 2, leaving nothing to judge).
 */
export function readPerformedMove(
  argv: readonly ArgvValue[],
): PerformedMove | undefined {
  const operands: ArgvValue[] = [];
  const flags = new Map<string, ArgvValue | true>();
  let flagsEnded = false;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] as ArgvValue;
    if (!flagsEnded && typeof token === "string" && token.startsWith("--")) {
      if (token === "--") {
        flagsEnded = true;
        continue;
      }
      const name = token.slice(2);
      if (flags.has(name)) return undefined;
      if (VALUE_FLAGS.has(name)) {
        index += 1;
        if (index >= argv.length) return undefined;
        flags.set(name, argv[index] as ArgvValue);
      } else {
        flags.set(name, true);
      }
      continue;
    }
    operands.push(token);
  }
  const [command, origin, destination, ...surplus] = operands;
  if (command !== "move" || surplus.length > 0) return undefined;
  if (typeof origin !== "string" || typeof destination !== "string") {
    return undefined;
  }
  if (flags.has("preview")) return undefined;
  const config = flags.get("config");
  if (config !== undefined && typeof config !== "string") return undefined;
  const sectionForm = origin.includes("#");
  if (sectionForm !== destination.includes("#")) return undefined;
  return {
    form: sectionForm ? "section" : "file",
    origin,
    destination,
    config,
  };
}

// ---------------------------------------------------------------------------
// The configuration (SPEC 7, 7.3) and discovery (7, 13.4).

const CONFIG_NAME = "xspec.config.ts";

interface Configuration {
  /** The workspace root: the configuration file's directory. */
  readonly root: string;
  readonly specGlobs: readonly string[];
  readonly codeGlobs: readonly string[];
  /** While Markdown emission is enabled, its `outDir` ("" when unset). */
  readonly emitDir: string | undefined;
}

/** The configuration file the invocation loads (SPEC 7), if any. */
async function locateConfiguration(
  cwd: string,
  flag: string | undefined,
): Promise<string | undefined> {
  const physical = await fsp.realpath(cwd).catch(() => path.resolve(cwd));
  if (flag !== undefined) return path.resolve(physical, flag);
  for (let dir = physical; ;) {
    const candidate = path.join(dir, CONFIG_NAME);
    // The search stops at an entry of that name, whatever occupies it.
    if ((await fsp.lstat(candidate).catch(() => undefined)) !== undefined) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Reads 7's declarative configuration, or undefined when it is not one. */
async function readConfiguration(
  configPath: string,
): Promise<Configuration | undefined> {
  const stats = await fsp.lstat(configPath).catch(() => undefined);
  if (stats === undefined || !stats.isFile()) return undefined;
  const bytes = await fsp.readFile(configPath).catch(() => undefined);
  if (bytes === undefined) return undefined;
  const text = decodeUtf8(bytes);
  if (text === undefined || text.charCodeAt(0) === 0xfeff) return undefined;
  const file = ts.createSourceFile(
    CONFIG_NAME,
    text,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS,
  );
  const exported = file.statements.find(
    (statement): statement is ts.ExportAssignment =>
      ts.isExportAssignment(statement) && statement.isExportEquals !== true,
  );
  const call = exported?.expression;
  if (call === undefined || !ts.isCallExpression(call)) return undefined;
  const [argument, ...rest] = call.arguments;
  if (argument === undefined || rest.length > 0) return undefined;
  const top = propertiesOf(argument, file);
  if (top === undefined) return undefined;
  const specs = top.get("specs");
  if (specs === undefined) return undefined;
  const specGlobs = groupGlobs(specs, file);
  const code = top.get("code");
  const codeGlobs = code === undefined ? [] : groupGlobs(code, file);
  if (specGlobs === undefined || codeGlobs === undefined) return undefined;
  let emitDir: string | undefined;
  const markdown = top.get("markdown");
  if (markdown !== undefined) {
    const fields = propertiesOf(markdown, file);
    const emit = fields?.get("emit");
    if (emit === undefined) return undefined;
    if (emit.kind === ts.SyntaxKind.TrueKeyword) {
      const outDir = fields?.get("outDir");
      emitDir = outDir === undefined ? "" : literalValue(outDir, file);
      if (emitDir === undefined) return undefined;
    } else if (emit.kind !== ts.SyntaxKind.FalseKeyword) {
      return undefined;
    }
  }
  return {
    root: path.dirname(configPath),
    specGlobs,
    codeGlobs,
    emitDir,
  };
}

/** A static string literal's value: its characters as spelled (2.4). */
function literalValue(node: ts.Node, file: ts.SourceFile): string | undefined {
  return ts.isStringLiteral(node) ? node.getText(file).slice(1, -1) : undefined;
}

/** An object literal's properties by key, non-computed keys alone (7). */
function propertiesOf(
  node: ts.Node,
  file: ts.SourceFile,
): ReadonlyMap<string, ts.Expression> | undefined {
  if (!ts.isObjectLiteralExpression(node)) return undefined;
  const properties = new Map<string, ts.Expression>();
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) return undefined;
    const key = ts.isIdentifier(property.name)
      ? property.name.getText(file)
      : literalValue(property.name, file);
    if (key === undefined || properties.has(key)) return undefined;
    properties.set(key, property.initializer);
  }
  return properties;
}

/** Every glob of a `specs` or `code` group map. */
function groupGlobs(
  node: ts.Expression,
  file: ts.SourceFile,
): readonly string[] | undefined {
  const groups = propertiesOf(node, file);
  if (groups === undefined) return undefined;
  const globs: string[] = [];
  for (const list of groups.values()) {
    if (!ts.isArrayLiteralExpression(list)) return undefined;
    for (const element of list.elements) {
      const glob = literalValue(element, file);
      if (glob === undefined) return undefined;
      globs.push(glob);
    }
  }
  return globs;
}

/** A discovered source, keyed by its workspace-relative path's bytes. */
interface DiscoveredSource {
  readonly kind: ReceivingFileKind;
  /** Its bytes; undefined where the environment refused the read. */
  readonly bytes: Uint8Array | undefined;
}

/** Map keys: a workspace-relative path's exact bytes, latin1-encoded. */
type Sources = ReadonlyMap<string, DiscoveredSource>;

const SLASH = Buffer.from("/");
const DERIVED_INFIX = Buffer.from(".xspec.");
const GRAPH_DATA_AREA = Buffer.from(".xspec");

/**
 * The workspace's discovered spec and code sources and their bytes (7):
 * no symbolic link followed or yielded, the derived files of 13.4 excluded,
 * a directory the environment refuses to list holding nothing.
 */
async function readSources(configuration: Configuration): Promise<Sources> {
  const { specGlobs, codeGlobs } = configuration;
  const matches = (globs: readonly string[], rel: Buffer): boolean =>
    globs.some((glob) => globMatches(glob, rel));
  // A dot-initial path segment is matched only by a pattern segment written
  // with a leading `.` (7), so without one no such entry is reached.
  const dotReached = [...specGlobs, ...codeGlobs].some((glob) =>
    glob.split("/").some((segment) => segment.startsWith(".")),
  );
  const spec = new Map<string, Uint8Array | undefined>();
  const code = new Map<string, Uint8Array | undefined>();
  const walk = async (absDir: Buffer, relDir: Buffer | null): Promise<void> => {
    const names = await fsp
      .readdir(absDir, { encoding: "buffer" })
      .catch(() => [] as Buffer[]);
    // Bytewise order, so a diagnosis lists its files the same everywhere.
    for (const name of names.sort(Buffer.compare)) {
      if (name[0] === 0x2e && !dotReached) continue;
      if (relDir === null && name.equals(GRAPH_DATA_AREA)) continue;
      const rel = relDir === null ? name : Buffer.concat([relDir, SLASH, name]);
      const abs = Buffer.concat([absDir, SLASH, name]);
      const stats = await fsp.lstat(abs).catch(() => undefined);
      if (stats === undefined || stats.isSymbolicLink()) continue;
      if (stats.isDirectory()) {
        await walk(abs, rel);
        continue;
      }
      if (!stats.isFile() || name.includes(DERIVED_INFIX)) continue;
      if (matches(specGlobs, rel)) {
        // A spec-group file without the `.mdx` extension is no spec source
        // a move rewrites (it makes the workspace invalid, 14.19).
        if (rel.toString("latin1").endsWith(".mdx")) {
          spec.set(rel.toString("latin1"), await readOrUndefined(abs));
        }
      } else if (matches(codeGlobs, rel)) {
        code.set(rel.toString("latin1"), await readOrUndefined(abs));
      }
    }
  };
  await walk(Buffer.from(configuration.root), null);
  const sources = new Map<string, DiscoveredSource>();
  for (const [rel, bytes] of spec) {
    sources.set(rel, { kind: "spec-source", bytes });
  }
  for (const [rel, bytes] of code) {
    if (isEmitDestination(rel, configuration.emitDir, spec)) continue;
    sources.set(rel, {
      kind: rel.endsWith(".tsx") ? "tsx" : "typescript",
      bytes,
    });
  }
  return sources;
}

/** Whether `rel` is the Markdown emit destination of a discovered spec
 * source (13.2, 7.3: `NAME.md` for `NAME.mdx`, under `outDir` when set). */
function isEmitDestination(
  rel: string,
  emitDir: string | undefined,
  spec: ReadonlyMap<string, unknown>,
): boolean {
  if (emitDir === undefined) return false;
  let local = rel;
  if (emitDir !== "") {
    const prefix = `${Buffer.from(emitDir).toString("latin1")}/`;
    if (!local.startsWith(prefix)) return false;
    local = local.slice(prefix.length);
  }
  return local.endsWith(".md") && spec.has(`${local.slice(0, -3)}.mdx`);
}

async function readOrUndefined(abs: Buffer): Promise<Uint8Array | undefined> {
  return await fsp.readFile(abs).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// The judgement.

/** Every breach and unreadable source the operation left, as text. */
function judgeAddedImports(
  move: PerformedMove,
  before: Sources,
  after: Sources,
): readonly string[] {
  const problems: string[] = [];
  const relocated =
    move.form === "file"
      ? {
          from: Buffer.from(move.origin).toString("latin1"),
          to: Buffer.from(move.destination).toString("latin1"),
        }
      : undefined;
  for (const [rel, source] of after) {
    if (source.bytes === undefined) continue;
    let prior = before.get(rel);
    if (
      prior === undefined &&
      relocated !== undefined &&
      rel === relocated.to
    ) {
      prior = before.get(relocated.from);
    }
    if (prior !== undefined) {
      if (prior.bytes === undefined) continue;
      if (bytesEqual(prior.bytes, source.bytes)) continue;
    }
    problems.push(
      ...judgeFile(
        Buffer.from(rel, "latin1").toString("utf8"),
        source.kind,
        prior?.bytes ?? new Uint8Array(0),
        source.bytes,
        move.form === "file",
      ),
    );
  }
  return problems;
}

/** One import declaration as a file spells it. */
interface DeclarationReading {
  /** The declaration's characters. */
  readonly text: string;
  /** Its characters, the specifier literal's blanked where asked. */
  readonly key: string;
  /** The specifier literal's value, as the file's grammar reads it. */
  readonly specifier: string | undefined;
  /** The local bindings it declares. */
  readonly identifiers: readonly string[];
}

/** An import declaration an operation added to a file (see
 * `judgeAddedImportsOfFile`). */
export interface AddedImportDeclaration {
  /** The declaration's characters. */
  readonly text: string;
  /** The specifier literal's value, as the file's grammar reads it. */
  readonly specifier: string | undefined;
  /** The local bindings it declares. */
  readonly identifiers: readonly string[];
}

/** One file's judgement: the declarations the operation added to it, and
 * every problem — a breach, or a side not well-formed (none added then). */
interface FileJudgement {
  readonly added: readonly AddedImportDeclaration[];
  readonly problems: readonly string[];
}

/**
 * T6.5-22(a)'s judgement of one file a section move rewrote, for a caller
 * holding both of its texts (T6.5-22(b)'s lures, one code path with the
 * driver's): the import declarations `after` holds that no declaration of
 * `before` accounts for, compared by their characters, in `after`'s order,
 * and every breach their identifiers make in `before`, worded as the driver
 * words it; when either text is not well-formed under its grammar (14.20),
 * no declarations and that problem alone. `file` names the file in the
 * problems' wording.
 */
export function judgeAddedImportsOfFile(
  file: string,
  kind: ReceivingFileKind,
  before: string,
  after: string,
): FileJudgement {
  const encoder = new TextEncoder();
  return judgeFileDeclarations(
    file,
    kind,
    encoder.encode(before),
    encoder.encode(after),
    false,
  );
}

function judgeFile(
  file: string,
  kind: ReceivingFileKind,
  priorBytes: Uint8Array,
  bytes: Uint8Array,
  specifiersRewritten: boolean,
): readonly string[] {
  return judgeFileDeclarations(
    file,
    kind,
    priorBytes,
    bytes,
    specifiersRewritten,
  ).problems;
}

function judgeFileDeclarations(
  file: string,
  kind: ReceivingFileKind,
  priorBytes: Uint8Array,
  bytes: Uint8Array,
  specifiersRewritten: boolean,
): FileJudgement {
  const after = readDeclarations(kind, bytes, specifiersRewritten);
  if (typeof after === "string") {
    return {
      added: [],
      problems: [
        `${file}, which the operation rewrote, is not well-formed under its grammar after it (SPEC 14.20: ${after}) — 6.5 keeps every file a successful move rewrites well-formed — so the import declarations it added cannot be read`,
      ],
    };
  }
  const before = readDeclarations(kind, priorBytes, specifiersRewritten);
  if (typeof before === "string") {
    return {
      added: [],
      problems: [
        `${file}, which the operation rewrote, was not well-formed under its grammar before it (SPEC 14.20: ${before}) — the valid-workspace precondition of 6.4 and 6.5 refuses a move over such a source — so the names an added identifier must avoid cannot be read`,
      ],
    };
  }
  const unmatched = new Map<string, number>();
  for (const declaration of before.declarations) {
    unmatched.set(declaration.key, (unmatched.get(declaration.key) ?? 0) + 1);
  }
  const added: DeclarationReading[] = [];
  for (const declaration of after.declarations) {
    const count = unmatched.get(declaration.key) ?? 0;
    if (count > 0) unmatched.set(declaration.key, count - 1);
    else added.push(declaration);
  }
  const addedDeclarations = added.map(
    ({ text, specifier, identifiers }): AddedImportDeclaration => ({
      text,
      specifier,
      identifiers,
    }),
  );
  if (added.length === 0) return { added: addedDeclarations, problems: [] };
  const addedBy = new Map<string, string>();
  for (const declaration of added) {
    for (const identifier of declaration.identifiers) {
      if (!addedBy.has(identifier)) addedBy.set(identifier, declaration.text);
    }
  }
  const breaches = addedIdentifierBreaches(
    analyzeNames(kind, before.text),
    added.flatMap((declaration) => declaration.identifiers),
  );
  return {
    added: addedDeclarations,
    problems: breaches.map(
      (breach) =>
        `${file}: the added identifier \`${breach.identifier}\` (\`${addedBy.get(breach.identifier) ?? "?"}\`) is ${breach.clause}`,
    ),
  };
}

/** A source's decoded text and import declarations, or why it is not
 * well-formed under its grammar (14.20). */
function readDeclarations(
  kind: ReceivingFileKind,
  bytes: Uint8Array,
  blankSpecifiers: boolean,
):
  | { readonly text: string; readonly declarations: DeclarationReading[] }
  | string {
  const text = decodeUtf8(bytes);
  if (text === undefined) return "its bytes are not valid UTF-8 (1.6)";
  const declarations: DeclarationReading[] = [];
  const add = (
    start: number,
    end: number,
    specifier: { readonly start: number; readonly end: number } | undefined,
    value: string | undefined,
    identifiers: readonly string[],
  ): void => {
    const declaration = text.slice(start, end);
    const key =
      blankSpecifiers && specifier !== undefined
        ? text.slice(start, specifier.start) +
          String.fromCharCode(0) +
          text.slice(specifier.end, end)
        : declaration;
    declarations.push({
      text: declaration,
      key,
      specifier: value,
      identifiers,
    });
  };
  if (kind === "spec-source") {
    let tree: MdastNode;
    try {
      tree = readMdxTree(text) as unknown as MdastNode;
    } catch (error) {
      return (error as Error).message;
    }
    readMdxDeclarations(tree, add);
  } else {
    const name = kind === "tsx" ? "receiver.tsx" : "receiver.ts";
    const verdict = judgeTypeScript(text, name);
    if (verdict.verdict === "unparseable") return verdict.reason;
    readTypeScriptDeclarations(kind, text, add);
  }
  return { text, declarations };
}

type AddDeclaration = (
  start: number,
  end: number,
  specifier: { readonly start: number; readonly end: number } | undefined,
  value: string | undefined,
  identifiers: readonly string[],
) => void;

interface MdastNode {
  readonly type: string;
  readonly children?: readonly MdastNode[];
  readonly data?: { readonly estree?: unknown };
}

interface EsImportDeclaration {
  readonly type: "ImportDeclaration";
  readonly start: number;
  readonly end: number;
  readonly source: {
    readonly start: number;
    readonly end: number;
    readonly value?: unknown;
  };
  readonly specifiers: readonly { readonly local: { readonly name: string } }[];
}

/** A spec source's import declarations: those of its ESM blocks, wherever
 * the blocks stand (14.20), each with its offsets in the document. */
function readMdxDeclarations(node: MdastNode, add: AddDeclaration): void {
  if (node.type === "mdxjsEsm") {
    const program = node.data?.estree as
      { readonly body?: readonly { readonly type: string }[] } | undefined;
    if (program === undefined || !Array.isArray(program.body)) {
      throw new Error(
        "T6.5-22(a)'s added-import reading: the MDX parse attached no ESTree program to an ESM block",
      );
    }
    for (const statement of program.body) {
      if (statement.type !== "ImportDeclaration") continue;
      const declaration = statement as EsImportDeclaration;
      add(
        declaration.start,
        declaration.end,
        declaration.source,
        typeof declaration.source.value === "string"
          ? declaration.source.value
          : undefined,
        declaration.specifiers.map((specifier) => specifier.local.name),
      );
    }
  }
  for (const child of node.children ?? []) readMdxDeclarations(child, add);
}

/** A code source's top-level import declarations, read as module code. */
function readTypeScriptDeclarations(
  kind: "typescript" | "tsx",
  text: string,
  add: AddDeclaration,
): void {
  const file = ts.createSourceFile(
    kind === "tsx" ? "receiver.tsx" : "receiver.ts",
    text,
    {
      languageVersion: ts.ScriptTarget.ESNext,
      setExternalModuleIndicator: (sourceFile) => {
        (
          sourceFile as unknown as { externalModuleIndicator?: unknown }
        ).externalModuleIndicator = true;
      },
    },
    true,
    kind === "tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const rangeOf = (node: ts.Node): { start: number; end: number } => ({
    start: node.getStart(file),
    end: node.getEnd(),
  });
  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement)) {
      const identifiers: string[] = [];
      const clause = statement.importClause;
      if (clause?.name !== undefined) identifiers.push(clause.name.text);
      const bindings = clause?.namedBindings;
      if (bindings !== undefined) {
        if (ts.isNamespaceImport(bindings)) {
          identifiers.push(bindings.name.text);
        } else {
          for (const element of bindings.elements) {
            identifiers.push(element.name.text);
          }
        }
      }
      const range = rangeOf(statement);
      add(
        range.start,
        range.end,
        rangeOf(statement.moduleSpecifier),
        ts.isStringLiteral(statement.moduleSpecifier)
          ? statement.moduleSpecifier.text
          : undefined,
        identifiers,
      );
    } else if (ts.isImportEqualsDeclaration(statement)) {
      const reference = statement.moduleReference;
      const range = rangeOf(statement);
      const external = ts.isExternalModuleReference(reference)
        ? reference.expression
        : undefined;
      add(
        range.start,
        range.end,
        external === undefined ? undefined : rangeOf(external),
        external !== undefined && ts.isStringLiteral(external)
          ? external.text
          : undefined,
        [statement.name.text],
      );
    }
  }
}

const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/** The bytes' UTF-8 text, a leading byte-order mark kept as U+FEFF, or
 * undefined when they are not valid UTF-8. */
function decodeUtf8(bytes: Uint8Array): string | undefined {
  try {
    return UTF8.decode(bytes);
  } catch {
    return undefined;
  }
}
