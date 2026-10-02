// Workspace/fixture builder for the xspec test harness (TEST-SPEC H-1, S-2,
// E-6). Harness machinery only: this module never imports product code; the
// workspaces it builds are handed to the product strictly through the
// subprocess driver (TEST-SPEC H-2).
//
// - Every test builds a fresh, self-contained workspace in a unique temporary
//   directory (`fs.mkdtemp` under the OS temp directory), so tests share no
//   mutable state and two harness instances can run concurrently on one
//   machine (H-1). The workspace root is a `work/` subdirectory of that
//   temporary directory; builder-internal scratch (the isolated git HOME and
//   global-config file) lives beside the root, never inside it, so the root
//   contains exactly the declared entries.
// - The builder writes exactly the declared bytes (S-2): string contents are
//   encoded as UTF-8 with no newline translation (CRLF/CR/lone-CR preserved,
//   BOMs kept), byte contents are written verbatim (invalid UTF-8 included),
//   paths may be declared as raw byte strings for non-UTF-8 file names (Linux
//   staging, TEST-SPEC T1.5-2), and symbolic-link targets are stored verbatim
//   — dangling, cyclic, and workspace-external targets are legitimate
//   declarations (T7-5, T13.4-6).
// - Git fixtures are scripted with pinned, platform-independent author and
//   committer identities and timestamps (E-6), so identical scripts realize
//   identical commit hashes on every platform and CI leg. Every git
//   invocation runs with ambient configuration disabled: no system or global
//   config, an isolated HOME, and all inherited `GIT_*` environment dropped.
// - Every staged file whose path ends in `.mdx` is judged by S-9's
//   derivability check (`deriveMdx`, helpers/mdx-derivability.ts — the stock
//   MDX 3 parser, independent of the product) at staging time, before any
//   product exists (H-8): it is declared well-formed by default, and a
//   staging declares the exceptions per path — `unparseable` for a source
//   TEST-SPEC declares unparseable (SPEC 14.20: invalid UTF-8, a byte-order
//   mark, an MDX-syntax rejection), `allowances` for a source relying on an
//   ECMAScript early error 14.20 admits (S-9's named allowances), and
//   `unchecked` only for a source whose derivability the document does not
//   declare (a fuzz mutation, a noise file no discovery reaches). A source
//   contradicting its declaration throws `HarnessStagingError` (mode
//   `mdx-derivability`, naming the path and the parser's reason) — a harness
//   error, never an assertion failure, never a skip. The parse is in-process
//   and cheap at every scale the suite stages (the 4096-deep tower in ~0.3 s,
//   T1.3-7's 4.2 MB document in ~1.4 s), so no staging is exempted for size.
// - Every staged code source and configuration file is judged the same way
//   by S-9's TypeScript check (`judgeTypeScript`, helpers/ts-derivability.ts
//   — the harness's own `typescript-5.9.3` parser at ESNext, read as module
//   code and as script code; SPEC 14.20), at staging time, through the same
//   four stagings (`create()`'s initial files, `file()`, `edit()`,
//   `copyFrom()`). The default reaches a path by its name alone: every file
//   whose name ends in a TypeScript or JavaScript source suffix
//   (`TS_DEFAULT_SUFFIXES`: `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`,
//   `.mjs`, `.cjs` — so `.d.ts` names and every configuration file the suite
//   stages, `xspec.config.ts` and each `--config` target, all named `.ts`)
//   is declared well-formed and must be accepted both ways. A staging
//   declares the exceptions per path in `ts: { unparseable, unchecked,
//   wellFormed }` (or per `file()` call, `{ ts: ... }`): `unparseable` for a
//   file TEST-SPEC declares unparseable (14.20: a TypeScript syntax error,
//   invalid UTF-8, a byte-order mark — rejected both ways), `unchecked` for
//   a file whose well-formedness the document does not declare (a fuzz
//   mutation, a noise file no discovery reaches, an edit of product-written
//   bytes), and `wellFormed` for a code source whose name the default does
//   not reach (a code group globs any name: T7-6's `specs/a'b.md` is
//   declared `unparseable`, T13.4-11(b)'s `specs/A.md` `wellFormed`). A
//   contradiction throws `HarnessStagingError` (mode `ts-derivability`,
//   naming the path and the parser's first error), and so does every text
//   the release accepts read one way only, whatever its declaration but
//   `unchecked` (no fixture is such text, S-9) — a harness error, never an
//   assertion failure, never a skip.
// - A `.mdx` source a test body stages after invoking the product in its
//   workspace is passed to `file()` as a staged-source record
//   (helpers/staged-mdx.ts) carrying the bytes and the S-9 declaration
//   together: S-7's sweep never reaches such a staging (the body fails at
//   the invocation against the stub), so the self-test
//   test/self/s9-staged-sources.test.ts judges every record before any
//   product exists (S-9's timing clause, H-8) through the judge the builder
//   itself applies at staging time (`judgeMdxDeclaration` — one code path).
//   An edit of bytes the product itself wrote goes through `edit()`, judged
//   at staging time alone: no harness constant equals them, so they are not
//   a deterministic fixture.
// - A code source or configuration file a test body stages after its first
//   product invocation — a `file()` write, or an initial `files` entry of a
//   workspace created after that invocation — is passed as the ledger's
//   TypeScript record (helpers/staged-ts.ts) carrying the bytes, the S-9
//   declaration, and the grammar the record is judged under, staged under
//   the record's declaration (a `ts` option beside it, a workspace `ts`
//   entry beside an initial record, an `.mdx` path, and a path selecting
//   the other grammar all throw); the same self-test judges every such
//   record with `judgeTsDeclaration` before any product exists. A record
//   makes its path judged whatever the name, as `ts.wellFormed` does. An
//   `.mdx` path a code group discovers is a code source too: its MDX record
//   carries the TypeScript declaration (`ts`), and the same self-test
//   judges it as TypeScript as well. The undeclared-staging guard below
//   holds every such staging to that form, as it holds the `.mdx` ones.
// - The undeclared-staging guard enforces that form: once a product has been
//   invoked in a workspace (the subprocess driver marks it, root and
//   realpath matched) or anywhere in the running registered body (the
//   async-local context test/suite/declare.ts and the certification runner
//   establish — S-7's reach is per body: the sweep stops at the body's
//   first invocation in whatever workspace, so a staging into a fresh
//   later-arm workspace is unreached too; helpers/product-invocations.ts),
//   `file()` with plain contents throws `HarnessStagingError` (mode
//   `undeclared-staging`) on an `.mdx` path unless the effective
//   declaration is `unchecked` (P-8's mutations) or `per-draw` (a property
//   draw the runner judged before the body saw it, S-9's property clause —
//   the section-16 modules' alone), and — the guard's TypeScript arm — on
//   a path S-9's TypeScript check judges (a `TS_DEFAULT_SUFFIXES` name, or
//   one a `ts` option or the workspace's `ts` declaration names) unless the
//   effective TypeScript declaration is `unchecked` (P-8's and P-11's
//   mutations, a noise file, a tampered product-written module) or
//   `per-draw` (a property draw's composed configuration or code source,
//   judged well-formed at staging — the section-16 modules' alone). An MDX
//   record carrying no `ts` at a path the TypeScript check judges (a
//   code-group `.mdx` path) is refused likewise: the self-test judged it as
//   MDX alone. `edit()` is a declared staging by construction, and so is
//   `copyFrom()` — another live workspace's current bytes, the product's
//   output there, carried into a fresh workspace (the H-6 two-directory
//   seeding of T6.4-7, T6.5-1, T6.5-3) — except out of a workspace no
//   product has been invoked in, where the bytes are the harness's own
//   staging and both arms of the guard apply as to plain contents. A
//   workspace declaration's initial `files` take a record too
//   (`InitialFileContents`): the initial `.mdx` files, code sources, and
//   configuration of a workspace a body creates AFTER its first product
//   invocation — a later arm's, a helper's twin — are deterministic
//   fixtures S-7's sweep never reaches (the body fails at that
//   invocation), so each is a record `create()` stages under the record's
//   declaration (a record at a key of the other kind, or beside a
//   workspace-declaration entry for its path, throws as a record beside a
//   `file()` option does); a body's first workspace's initial files may
//   stay plain contents, reached by the sweep. The guard covers
//   `create()`'s initial entries too, one code path with `file()`'s: a
//   plain entry of a workspace created after the running body's first
//   product invocation is refused at creation (the diagnosis names it an
//   initial `files` entry, with its remedies) unless its declaration
//   exempts it — `mdx.unchecked` or `mdx.perDraw` for an `.mdx` path,
//   `ts.unchecked` or `ts.perDraw` for a path the TypeScript check judges
//   — and the half-built workspace is disposed. At creation only the
//   per-body mark can be set — the root was registered an instant before
//   and nothing has run in it — so outside a body context (a self-test,
//   the E-6 fixture, the Windows leg's drive-mismatch arm) creation never
//   refuses. The declaration's `perDraw` lists are the initial-file forms
//   of `per-draw`: a section-16 module's draw-derived initial files
//   (`mdxPathsOf` and `tsPathsOf` list a rendered map's plain `.mdx` keys
//   and plain TypeScript-default keys for them). Every generated draw must
//   derive (TEST-SPEC 16, S-9): the document declares no draw unparseable,
//   so no per-draw declaration exempts a draw from deriving, nor a
//   per-draw configuration or code source from being well-formed.

import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import {
  MDX_ALLOWANCES,
  deriveMdx,
  type MdxAllowance,
} from "./mdx-derivability.js";
import { HarnessStagingError } from "./permissions.js";
import {
  type WorkspaceInvocationMark,
  productInvokedInBody,
  registerWorkspaceRoot,
  unregisterWorkspaceRoot,
} from "./product-invocations.js";
import { StagedMdx } from "./staged-mdx.js";
import { StagedTs, tsGrammarOf } from "./staged-ts.js";
import {
  type TsDeclaration,
  judgeTypeScript,
  tsDeclarationProblem,
} from "./ts-derivability.js";

const execFileAsync = promisify(execFile);

const SLASH = 0x2f; // "/"
const DOT = 0x2e; // "."

/**
 * A workspace-relative path. Strings use `/` separators on every platform;
 * `Uint8Array` declares the path as raw bytes (`/`-separated, i.e. 0x2f) for
 * file names that are not valid UTF-8 — meaningful on Linux, where file names
 * are byte strings (TEST-SPEC T1.5-2).
 */
export type RelPath = string | Uint8Array;

/**
 * Declared file contents. Strings are encoded as UTF-8 exactly as written —
 * no newline translation, no BOM handling; `Uint8Array` contents are written
 * verbatim.
 */
export type FileContents = string | Uint8Array;

/**
 * An initial `files` entry of a workspace declaration: plain contents, or a
 * staged-source record whose bytes `create()` stages under the record's own
 * S-9 declaration — an MDX record (helpers/staged-mdx.ts) at an `.mdx` key,
 * a TypeScript record (helpers/staged-ts.ts) at a code source's or
 * configuration file's key — the form of every such initial file of a
 * workspace a body creates after its first product invocation, so that the
 * S-9 self-test judged it before any product existed (module header). A
 * record belongs at a key the workspace's `mdx` (or `ts`) declaration does
 * not name; a body's first workspace's initial files may stay plain
 * contents, and a plain `.mdx` entry, code source, or configuration file of
 * a workspace created after the running body's first product invocation is
 * refused at creation (the undeclared-staging guard) unless its path is
 * listed `unchecked` or `perDraw` (in `mdx`, or in `ts` for a path the
 * TypeScript check judges).
 */
export type InitialFileContents = FileContents | StagedMdx | StagedTs;

/**
 * A staging's S-9 declaration of its MDX sources' well-formedness, by
 * workspace-relative path (`/`-separated, as the file is staged; a byte
 * path is keyed by its UTF-8 decoding with replacement characters). Every
 * staged `.mdx` file not named here is declared well-formed and must derive
 * under SPEC 14.20's grammar; a path belongs to at most one list.
 */
export interface WorkspaceMdxDecl {
  /**
   * Sources TEST-SPEC declares unparseable (14.20): each must NOT derive —
   * invalid UTF-8, a leading byte-order mark, an MDX-syntax rejection.
   */
  readonly unparseable?: readonly string[];
  /**
   * Sources whose derivability the document does not declare — fuzz
   * mutations (P-8), noise files no discovery reaches, byte-level probes.
   * Never a way to hide an ill-formed deterministic fixture.
   */
  readonly unchecked?: readonly string[];
  /**
   * Sources relying on an ECMAScript early error 14.20 admits (S-9's named
   * allowances): each derives under exactly the allowances named for it.
   */
  readonly allowances?: Readonly<Record<string, readonly MdxAllowance[]>>;
  /**
   * Sources whose initial contents are a property draw the runner already
   * judged (helpers/property.ts `mdxSources`; TEST-SPEC 16, S-9's property
   * clause): each is judged well-formed at creation exactly as the default
   * is, and a later plain `file()` staging of the path is exempt from the
   * undeclared-staging guard — the initial-file form of `per-draw`. Only
   * the section-16 modules list a path here; a deterministic test never
   * does (a later-arm workspace's initial `.mdx` files are records).
   */
  readonly perDraw?: readonly string[];
}

/**
 * One file's S-9 declaration, for a `file()` call after creation; overrides
 * the workspace declaration for that write alone. `per-draw` is a property
 * draw's source (TEST-SPEC 16; S-9's property clause): well-formed — judged
 * at staging exactly as `well-formed` is — and already judged per draw by the
 * property runner before the body saw it (helpers/property.ts `mdxSources`),
 * so the undeclared-staging guard exempts it. Only the section-16 modules
 * pass it — to `file()` (section-16-p4.ts, -p5-p6.ts, -p9.ts), or as the
 * workspace declaration's `perDraw` list for a draw's initial files; a
 * deterministic test never does, and a staged-source record never carries it.
 */
export type MdxFileDeclaration =
  | "well-formed"
  | "unparseable"
  | "unchecked"
  | "per-draw"
  | { readonly allowances: readonly MdxAllowance[] };

/**
 * A staging's S-9 declaration of its TypeScript files' well-formedness —
 * code sources and configuration files (SPEC 14.20's TypeScript grammar) —
 * by workspace-relative path, keyed as `WorkspaceMdxDecl` keys are. Every
 * staged file whose name ends in one of `TS_DEFAULT_SUFFIXES` and is not
 * named here is declared well-formed: accepted by TypeScript 5.9.3 both as
 * module code and as script code. A path belongs to at most one list.
 */
export interface WorkspaceTsDecl {
  /**
   * Files TEST-SPEC declares unparseable (14.20): each must be rejected
   * both ways — a TypeScript syntax error, invalid UTF-8, a leading
   * byte-order mark — whatever its name.
   */
  readonly unparseable?: readonly string[];
  /**
   * Files whose well-formedness the document does not declare — fuzz
   * mutations (P-8, P-11), noise files no discovery reaches, edits of
   * product-written bytes. Never a way to hide an ill-formed fixture.
   */
  readonly unchecked?: readonly string[];
  /**
   * Code sources (or a configuration file) whose names the default does not
   * reach — a code group globs any name (`specs/*.md`, `src/*`, `.mdx`
   * names under `docs/`): each must be well-formed, as a default path is.
   */
  readonly wellFormed?: readonly string[];
  /**
   * Configuration files and code sources whose initial contents a property
   * draw composed (TEST-SPEC 16, S-9's property clause — P-7's
   * configurations, P-13's configuration and code sources): each is judged
   * well-formed at creation exactly as the default is, and the
   * undeclared-staging guard exempts the path, at creation and for a later
   * plain `file()` staging — the initial-file form of `per-draw`. Only the
   * section-16 modules list a path here (`tsPathsOf` over a rendered map);
   * a deterministic test never does (a later-arm workspace's initial code
   * sources and configuration are records).
   */
  readonly perDraw?: readonly string[];
}

/**
 * One file's S-9 TypeScript declaration, for a `file()` call after creation;
 * overrides the workspace declaration (and the name's default) for that
 * write alone. `per-draw` is a property draw's composed configuration or
 * code source (TEST-SPEC 16; S-9's property clause): well-formed — judged at
 * staging exactly as `well-formed` is — and generated per trial, so no
 * module-level record can hold it and the undeclared-staging guard exempts
 * it. Only the section-16 modules pass it — to `file()`, or as the
 * workspace declaration's `ts.perDraw` list for a draw's initial files; a
 * deterministic test never does, and a staged-source record never carries
 * it.
 */
export type TsFileDeclaration = TsDeclaration | "unchecked" | "per-draw";

/** Options of a single `file()` staging. */
export interface FileOptions {
  /** The file's S-9 declaration; defaults to the workspace declaration's. */
  readonly mdx?: MdxFileDeclaration;
  /**
   * The file's S-9 TypeScript declaration; defaults to the workspace
   * declaration's, else to well-formed for a name `TS_DEFAULT_SUFFIXES`
   * reaches (any other name is not judged).
   */
  readonly ts?: TsFileDeclaration;
}

/** Declarative form of a workspace's initial content. */
export interface WorkspaceDecl {
  /**
   * Regular files: workspace-relative path → exact contents, or a
   * staged-source record — an MDX record at an `.mdx` path, a TypeScript
   * record at a code source's or configuration file's path
   * (`InitialFileContents`).
   */
  readonly files?: Readonly<Record<string, InitialFileContents>>;
  /** Symbolic links: workspace-relative link path → verbatim target. */
  readonly symlinks?: Readonly<Record<string, string>>;
  /** Directories created explicitly (parents of files are implicit). */
  readonly dirs?: readonly string[];
  /**
   * S-9 declaration of the staged `.mdx` sources — those in `files` staged
   * as plain contents (a record carries its own declaration, and naming its
   * path here contradicts it) and those a later `file()` call stages; every
   * `.mdx` path absent from it is declared well-formed (see the module
   * header).
   */
  readonly mdx?: WorkspaceMdxDecl;
  /**
   * S-9 declaration of the staged TypeScript files — code sources and
   * configuration files, those in `files` and those later stagings write;
   * every path `TS_DEFAULT_SUFFIXES` reaches and absent from it is declared
   * well-formed (see the module header).
   */
  readonly ts?: WorkspaceTsDecl;
}

export interface GitPerson {
  readonly name: string;
  readonly email: string;
}

export interface GitCommitOptions {
  /** Defaults to the pinned fixture identity. */
  readonly author?: GitPerson;
  /** Defaults to `author`. */
  readonly committer?: GitPerson;
  /**
   * A git date (e.g. `"1700000000 +0000"`). Defaults to a pinned value
   * derived from the commit's index in this workspace, so identical scripts
   * yield identical timestamps — and identical commit hashes — everywhere.
   */
  readonly authorDate?: string;
  /** Defaults to `authorDate`. */
  readonly committerDate?: string;
}

/** Pinned fixture identity (E-6: platform-independent commit metadata). */
export const GIT_FIXTURE_PERSON: GitPerson = {
  name: "xspec fixture",
  email: "fixture@xspec.invalid",
};

/** Pinned timestamp base: commit N of a workspace gets base + 60·N seconds. */
export const GIT_FIXTURE_EPOCH_SECONDS = 1_700_000_000;

export type EntryKind = "file" | "dir" | "symlink" | "other" | "absent";

export class TestWorkspace {
  /** The unique temporary directory owning this workspace. */
  readonly tempRoot: string;
  /** The workspace root — the directory handed to the product (H-1). */
  readonly root: string;

  private gitCommitCount = 0;
  private gitScratch: Promise<{ home: string; configFile: string }> | undefined;
  /** The S-9 declaration, resolved per normalized path (see `mdxDeclarationOf`). */
  private readonly mdxDeclarations: ReadonlyMap<string, MdxFileDeclaration>;
  /** The S-9 TypeScript declaration, resolved per normalized path. */
  private readonly tsDeclarations: ReadonlyMap<string, TsFileDeclaration>;
  /** The undeclared-staging guard's mark: has a product been invoked here? */
  private readonly invocationMark: WorkspaceInvocationMark;

  private constructor(
    tempRoot: string,
    root: string,
    mdxDeclarations: ReadonlyMap<string, MdxFileDeclaration>,
    tsDeclarations: ReadonlyMap<string, TsFileDeclaration>,
    invocationMark: WorkspaceInvocationMark,
  ) {
    this.tempRoot = tempRoot;
    this.root = root;
    this.mdxDeclarations = mdxDeclarations;
    this.tsDeclarations = tsDeclarations;
    this.invocationMark = invocationMark;
  }

  /**
   * Create a fresh workspace in a unique temporary directory and populate it
   * with the declared entries (directories, then files, then symlinks); each
   * `.mdx` file, code source, and configuration file is judged against the
   * staging's S-9 declarations as it is written (a contradiction throws
   * `HarnessStagingError`).
   */
  static async create(decl: WorkspaceDecl = {}): Promise<TestWorkspace> {
    const mdxDeclarations = resolveMdxDeclaration(decl.mdx ?? {});
    const tsDeclarations = resolveTsDeclaration(decl.ts ?? {});
    const tempRoot = await fsp.mkdtemp(
      path.join(os.tmpdir(), "xspec-harness-"),
    );
    const root = path.join(tempRoot, "work");
    await fsp.mkdir(root);
    // Registered under the root and its realpath while the workspace lives
    // (helpers/product-invocations.ts): an invocation anywhere under either
    // marks it for the undeclared-staging guard.
    const realRoot = await fsp.realpath(root);
    const workspace = new TestWorkspace(
      tempRoot,
      root,
      mdxDeclarations,
      tsDeclarations,
      registerWorkspaceRoot(root, realRoot),
    );
    try {
      for (const dir of decl.dirs ?? []) {
        await workspace.dir(dir);
      }
      for (const [rel, contents] of Object.entries(decl.files ?? {})) {
        await workspace.stageInitial(rel, contents);
      }
      for (const [rel, target] of Object.entries(decl.symlinks ?? {})) {
        await workspace.symlink(rel, target);
      }
    } catch (error) {
      // A refused staging (an S-9 contradiction, an unwritable entry) leaves
      // no temporary directory behind; the error itself is what matters.
      await workspace.dispose().catch(() => undefined);
      throw error;
    }
    return workspace;
  }

  /**
   * Resolve a workspace-relative string path to an absolute native path,
   * refusing any path that escapes the workspace root (a builder-bug guard:
   * fixtures are self-contained by definition, H-1).
   */
  path(rel: string): string {
    const abs = path.resolve(this.root, rel);
    if (abs !== this.root && !abs.startsWith(this.root + path.sep)) {
      throw new Error(
        `workspace-relative path escapes the workspace root: ${JSON.stringify(rel)}`,
      );
    }
    return abs;
  }

  /**
   * Write a regular file with exactly the declared bytes, creating parents.
   * A `.mdx` path is first judged against its S-9 declaration — the option's,
   * else the workspace declaration's, else well-formed — and a contradiction
   * throws `HarnessStagingError` before anything is written. A staged-source
   * record (helpers/staged-mdx.ts) supplies both the bytes and the
   * declaration of the write — the form of every `.mdx` staging a body makes
   * after a product invocation in this workspace, so that the S-9 self-test
   * judged it before any product existed; an `mdx` option beside a record
   * contradicts it, and a record at a path S-9 does not judge is a mistake —
   * both throw. Plain contents on an `.mdx` path after a product invocation
   * — in this workspace, or anywhere in the running registered body — throw
   * too (`undeclared-staging`, see `guardUndeclaredStaging`), unless the
   * effective declaration is `unchecked` or `per-draw`. A code source or
   * configuration file is judged against its S-9 TypeScript declaration —
   * the `ts` option's, else the workspace declaration's, else well-formed
   * for a name `TS_DEFAULT_SUFFIXES` reaches — before anything is written;
   * a TypeScript staged-source record (helpers/staged-ts.ts) supplies both
   * the bytes and that declaration — the form of every code source and
   * configuration file a body stages after a product invocation — and a
   * `ts` option beside it, an `.mdx` path, or a path selecting the other
   * grammar throws. Plain contents at a path the TypeScript check judges
   * after a product invocation throw `undeclared-staging` too (the guard's
   * TypeScript arm, `guardUndeclaredTsStaging`), unless the effective
   * TypeScript declaration is `unchecked` or `per-draw`; so does an MDX
   * record carrying no `ts` at such a path (a code-group `.mdx` path).
   */
  async file(
    rel: RelPath,
    contents: FileContents | StagedMdx | StagedTs,
    options: FileOptions = {},
  ): Promise<void> {
    let data: Uint8Array;
    let declaration = options.mdx;
    let tsDeclaration = options.ts;
    if (contents instanceof StagedMdx) {
      const staged = this.recordStaging(
        rel,
        contents,
        declaration,
        tsDeclaration,
        "option",
      );
      if (staged.tsDeclaration === undefined) {
        this.guardUndeclaredTsStaging(
          rel,
          tsDeclaration ?? this.tsDeclarationOf(rel),
          "write",
          contents,
        );
      }
      data = staged.data;
      declaration = staged.declaration;
      tsDeclaration = staged.tsDeclaration ?? tsDeclaration;
    } else if (contents instanceof StagedTs) {
      ({ data, tsDeclaration } = this.tsRecordStaging(
        rel,
        contents,
        tsDeclaration,
        "option",
      ));
    } else {
      data = toBytes(contents);
      if (isMdxPath(rel)) {
        this.guardUndeclaredStaging(
          rel,
          declaration ?? this.mdxDeclarations.get(mdxKey(rel)) ?? "well-formed",
        );
      }
      this.guardUndeclaredTsStaging(
        rel,
        tsDeclaration ?? this.tsDeclarationOf(rel),
      );
    }
    this.checkMdx(rel, data, declaration);
    this.checkTs(rel, data, tsDeclaration);
    await this.write(rel, data);
  }

  /**
   * Whether a product has been invoked in this workspace since its creation
   * (the subprocess driver marks it; helpers/product-invocations.ts).
   */
  get productInvoked(): boolean {
    return this.invocationMark.invoked;
  }

  /**
   * An initial `files` entry of the workspace declaration: plain contents,
   * judged under the workspace declaration like every `.mdx` staging, or a
   * staged-source record — an MDX record or a TypeScript one — staged under
   * the record's own declaration (module header — the form of a later-arm
   * workspace's initial `.mdx` files, code sources, and configuration,
   * which S-7's sweep never reaches; a body's first workspace's may stay
   * plain).
   * Inside the undeclared-staging guard, as `file()` is: a plain `.mdx`
   * entry of a workspace created after the running body's first product
   * invocation is refused before anything of it is written, unless the
   * workspace declaration lists it `unchecked` or `perDraw`
   * (`guardUndeclaredStaging`), and so is a plain entry at a path the
   * TypeScript check judges, unless the declaration lists it
   * `ts.unchecked` or `ts.perDraw`, and an MDX record carrying no `ts` at
   * such a path (`guardUndeclaredTsStaging`); `create()` then disposes the
   * half-built workspace. At creation only the per-body mark can be set,
   * so outside a body context (a self-test, the E-6 fixture, the Windows
   * leg's drive-mismatch arm) creation never refuses.
   */
  private async stageInitial(
    rel: string,
    contents: InitialFileContents,
  ): Promise<void> {
    let data: Uint8Array;
    let declaration: MdxFileDeclaration | undefined;
    let tsDeclaration: TsFileDeclaration | undefined;
    if (contents instanceof StagedMdx) {
      ({ data, declaration, tsDeclaration } = this.recordStaging(
        rel,
        contents,
        this.mdxDeclarations.get(mdxKey(rel)),
        this.tsDeclarations.get(mdxKey(rel)),
        "declaration entry",
      ));
      if (tsDeclaration === undefined) {
        this.guardUndeclaredTsStaging(
          rel,
          this.tsDeclarationOf(rel),
          "initial entry",
          contents,
        );
      }
    } else if (contents instanceof StagedTs) {
      ({ data, tsDeclaration } = this.tsRecordStaging(
        rel,
        contents,
        this.tsDeclarations.get(mdxKey(rel)),
        "declaration entry",
      ));
    } else {
      data = toBytes(contents);
      declaration = undefined;
      if (isMdxPath(rel)) {
        this.guardUndeclaredStaging(
          rel,
          this.mdxDeclarations.get(mdxKey(rel)) ?? "well-formed",
          "initial entry",
        );
      }
      this.guardUndeclaredTsStaging(
        rel,
        this.tsDeclarationOf(rel),
        "initial entry",
      );
    }
    this.checkMdx(rel, data, declaration);
    this.checkTs(rel, data, tsDeclaration);
    await this.write(rel, data);
  }

  /**
   * A staged-source record's staging — `file()`'s and an initial `files`
   * entry's alike: the record's bytes under the record's declaration, the
   * one the S-9 self-test verified. A record at a path S-9 does not judge
   * is a mistake, and a second declaration for the path beside the record
   * (`file()`'s `mdx` option, the workspace declaration's entry) is a
   * contradiction; both throw before anything is written. A record carrying
   * a TypeScript declaration too (the path is a code source a code group
   * discovers; helpers/staged-mdx.ts) returns it for the TypeScript check,
   * and a `ts` option or workspace `ts` entry beside it is a contradiction
   * likewise.
   */
  private recordStaging(
    rel: RelPath,
    record: StagedMdx,
    beside: MdxFileDeclaration | undefined,
    tsBeside: TsFileDeclaration | undefined,
    besideForm: "option" | "declaration entry",
  ): {
    readonly data: Uint8Array;
    readonly declaration: MdxFileDeclaration;
    readonly tsDeclaration: TsFileDeclaration | undefined;
  } {
    const key = mdxKey(rel);
    if (!isMdxPath(rel)) {
      throw new HarnessStagingError(
        "mdx-derivability",
        key,
        `the staged-source record ${JSON.stringify(record.name)} is an ` +
          "MDX source and the path is not an `.mdx` path — a path S-9 " +
          "does not judge takes plain contents",
      );
    }
    if (beside !== undefined) {
      const what =
        besideForm === "option"
          ? `the \`mdx\` option ${JSON.stringify(beside)} beside it`
          : `the workspace declaration's entry ${JSON.stringify(beside)} for the path beside it`;
      throw new HarnessStagingError(
        "mdx-derivability",
        key,
        `the staged-source record ${JSON.stringify(record.name)} ` +
          `carries its own S-9 declaration ${JSON.stringify(record.mdx)}; ` +
          `${what} is a contradiction — the record's declaration is the ` +
          `one the S-9 self-test verified, so drop the ${besideForm} (or ` +
          "change the record)",
      );
    }
    if (record.ts !== undefined && tsBeside !== undefined) {
      const what =
        besideForm === "option"
          ? `the \`ts\` option ${JSON.stringify(tsBeside)} beside it`
          : `the workspace declaration's \`ts\` entry ${JSON.stringify(tsBeside)} for the path beside it`;
      throw new HarnessStagingError(
        "ts-derivability",
        key,
        `the staged-source record ${JSON.stringify(record.name)} ` +
          "carries its own S-9 TypeScript declaration " +
          `${JSON.stringify(record.ts)} (the path is a code source too); ` +
          `${what} is a contradiction — the record's declaration is the ` +
          `one the S-9 self-test verified, so drop the ${besideForm} (or ` +
          "change the record)",
      );
    }
    return {
      data: toBytes(record.source),
      declaration: record.mdx,
      tsDeclaration: record.ts,
    };
  }

  /**
   * A TypeScript staged-source record's staging (helpers/staged-ts.ts) —
   * `file()`'s and an initial `files` entry's alike: the record's bytes
   * under the record's declaration, the one the S-9 self-test verified under
   * the grammar the record names. An `.mdx` path is an MDX source first (an
   * MDX record's), and a path selecting the other grammar (SPEC 14.20: a
   * name ending `.tsx` selects TSX, any other plain TypeScript) would judge
   * the bytes otherwise than the self-test did — both are mistakes; a
   * second declaration for the path beside the record (`file()`'s `ts`
   * option, the workspace declaration's `ts` entry) is a contradiction. All
   * throw before anything is written. A record makes its path judged
   * whatever its name: it is the per-write form of `ts.wellFormed` (or
   * `ts.unparseable`).
   */
  private tsRecordStaging(
    rel: RelPath,
    record: StagedTs,
    beside: TsFileDeclaration | undefined,
    besideForm: "option" | "declaration entry",
  ): {
    readonly data: Uint8Array;
    readonly tsDeclaration: TsFileDeclaration;
  } {
    const key = mdxKey(rel);
    if (isMdxPath(rel)) {
      throw new HarnessStagingError(
        "ts-derivability",
        key,
        `the staged-source record ${JSON.stringify(record.name)} is a ` +
          "TypeScript record and the path is an `.mdx` path — an MDX " +
          "source is staged as an MDX record (helpers/staged-mdx.ts)",
      );
    }
    const selected = tsGrammarOf(key);
    if (selected !== record.grammar) {
      const named = (grammar: string): string =>
        grammar === "tsx" ? "TSX" : "plain TypeScript";
      throw new HarnessStagingError(
        "ts-derivability",
        key,
        `the staged-source record ${JSON.stringify(record.name)} is judged ` +
          `under the grammar ${JSON.stringify(record.grammar)} ` +
          `(${named(record.grammar)}) and the path selects ` +
          `${JSON.stringify(selected)} (${named(selected)}; SPEC 14.20: a ` +
          "name ending `.tsx` selects TSX, any other plain TypeScript) — " +
          "stage the record at a path of its grammar, or register one " +
          "naming the path's",
      );
    }
    if (beside !== undefined) {
      const what =
        besideForm === "option"
          ? `the \`ts\` option ${JSON.stringify(beside)} beside it`
          : `the workspace declaration's \`ts\` entry ${JSON.stringify(beside)} for the path beside it`;
      throw new HarnessStagingError(
        "ts-derivability",
        key,
        `the staged-source record ${JSON.stringify(record.name)} ` +
          `carries its own S-9 declaration ${JSON.stringify(record.ts)}; ` +
          `${what} is a contradiction — the record's declaration is the ` +
          `one the S-9 self-test verified, so drop the ${besideForm} (or ` +
          "change the record)",
      );
    }
    return { data: toBytes(record.source), tsDeclaration: record.ts };
  }

  /**
   * The undeclared-staging guard (module header; TEST-SPEC S-9's timing
   * clause, S-7, H-8): a plain `.mdx` staging — contents that are not a
   * staged-source record — after a product invocation is first judged at
   * suite time, against a real product, because S-7's sweep never reaches
   * it; unless its effective declaration exempts it, it is refused with the
   * rule to follow. "After a product invocation" is judged both per
   * workspace (this one's mark) and per body (the running registered body's
   * context), the latter being S-7's actual reach. `site` is the staging's
   * kind, named in the diagnosis with its remedies: a write after creation
   * (`file()`, `copyFrom()`), or an initial `files` entry `create()` stages —
   * where only the per-body mark can refuse, since the workspace's own mark
   * cannot be set yet (its root was registered an instant before, and
   * nothing has run in it).
   */
  private guardUndeclaredStaging(
    rel: RelPath,
    declaration: MdxFileDeclaration,
    site: "write" | "initial entry" = "write",
  ): void {
    if (declaration === "unchecked" || declaration === "per-draw") return;
    const where = this.invocationBefore();
    if (where === undefined) return;
    const detail =
      site === "initial entry"
        ? `an initial \`files\` entry of a workspace created after a product invocation ${where}, staged with plain contents (declared ${JSON.stringify(declaration)}) — S-7's sweep against the empty stub never reaches this creation (the body fails at that invocation), so S-9's check would first run at suite time, against a real product, not before any product exists (H-8). Pass a staged-source record as the entry's value instead (helpers/staged-mdx.ts: \`stagedMdx("<TEST-ID> <workspace or arm> <path>", <the same expression, moved, never re-spelled>, <this declaration>)\` at module level, and the path dropped from the workspace's \`mdx\` declaration — the record carries it), which test/self/s9-staged-sources.test.ts judges before any product exists; a property draw's initial file the runner already judged is listed in \`mdx.perDraw\` (section-16 modules only); a P-8 fuzz mutation or a noise file no discovery reaches is listed in \`mdx.unchecked\``
        : `an MDX source staged with plain contents (declared ${JSON.stringify(declaration)}) after a product invocation ${where} — S-7's sweep against the empty stub never reaches this staging (the body fails at that invocation), so S-9's check would first run at suite time, against a real product, not before any product exists (H-8). Stage it as a staged-source record instead (helpers/staged-mdx.ts: \`stagedMdx("<TEST-ID> <what it stages>", <the same expression, moved, never re-spelled>, <this declaration>)\` at module level, passed to \`file()\`), which test/self/s9-staged-sources.test.ts judges before any product exists; an edit of bytes the product itself wrote goes through \`edit()\`; a P-8 fuzz mutation is declared \`unchecked\`; a property draw the runner already judged is declared \`per-draw\` (section-16 modules only); another workspace's product-written bytes carried into a fresh workspace go through \`copyFrom()\``;
    throw new HarnessStagingError("undeclared-staging", mdxKey(rel), detail);
  }

  /**
   * The undeclared-staging guard's TypeScript arm (module header; TEST-SPEC
   * S-9's TypeScript and timing clauses, S-7, H-8): a staging at a path
   * S-9's TypeScript check judges — `declaration`, the write's effective
   * TypeScript declaration, is defined — after a product invocation is
   * first judged at suite time, against a real product, unless its bytes
   * are a TypeScript staged-source record (or an MDX record carrying its
   * TypeScript declaration) the S-9 self-test judged before any product
   * existed. Refused, with the rule to follow: plain contents (`mdxRecord`
   * undefined), and an MDX record carrying no `ts` (`mdxRecord` — the
   * self-test judged it as MDX alone), unless the effective declaration is
   * `unchecked` (a mutation, a noise file, a tampered product-written
   * module: nothing to judge) or `per-draw` (a property draw's composed
   * configuration or code source, generated per trial). The marks and
   * `site` are `guardUndeclaredStaging`'s.
   */
  private guardUndeclaredTsStaging(
    rel: RelPath,
    declaration: TsFileDeclaration | undefined,
    site: "write" | "initial entry" = "write",
    mdxRecord?: StagedMdx,
  ): void {
    if (
      declaration === undefined ||
      declaration === "unchecked" ||
      declaration === "per-draw"
    ) {
      return;
    }
    const where = this.invocationBefore();
    if (where === undefined) return;
    const declared = `declared ${JSON.stringify(declaration)}`;
    const unreached = `S-7's sweep against the empty stub never reaches this ${site === "initial entry" ? "creation" : "staging"} (the body fails at that invocation), so S-9's TypeScript check would first run at suite time, against a real product, not before any product exists (H-8)`;
    const mdxForm =
      "a code-group `.mdx` path takes an MDX staged-source record carrying " +
      "its TypeScript declaration (`stagedMdx(name, source, mdx, ts)`)";
    let detail: string;
    if (mdxRecord !== undefined) {
      const staging =
        site === "initial entry"
          ? `an initial \`files\` entry of a workspace created after a product invocation ${where}`
          : `a staging after a product invocation ${where}`;
      detail = `${staging}: the MDX staged-source record ${JSON.stringify(mdxRecord.name)} carries no TypeScript declaration, yet S-9's TypeScript check judges the path (${declared}: a code source a code group discovers), so the record's TypeScript reading was never judged before any product existed — ${unreached}. Give the record its TypeScript declaration instead (\`stagedMdx(name, source, mdx, ts)\`, which test/self/s9-staged-sources.test.ts judges as TypeScript too), dropping the path from the workspace's \`ts\` declaration and any \`ts\` option — the record carries it; a file whose well-formedness the document does not declare is declared \`unchecked\` (\`ts.unchecked\`); a property draw's composed file is declared per draw (\`ts.perDraw\`, \`{ ts: "per-draw" }\`; section-16 modules only)`;
    } else if (site === "initial entry") {
      detail = `an initial \`files\` entry of a workspace created after a product invocation ${where}, a code source or configuration file staged with plain contents (${declared}) — ${unreached}. Pass a TypeScript staged-source record as the entry's value instead (helpers/staged-ts.ts: \`stagedTs("<TEST-ID> <workspace or arm> <path>", <the same expression, moved, never re-spelled>, <this declaration>)\` at module level, and the path dropped from the workspace's \`ts\` declaration — the record carries it), which test/self/s9-staged-sources.test.ts judges before any product exists; ${mdxForm}; a property draw's composed file is listed in \`ts.perDraw\` (section-16 modules only); a mutation or a noise file no discovery reaches is listed in \`ts.unchecked\``;
    } else {
      detail = `a code source or configuration file staged with plain contents (${declared}) after a product invocation ${where} — ${unreached}. Stage it as a TypeScript staged-source record instead (helpers/staged-ts.ts: \`stagedTs("<TEST-ID> <what it stages>", <the same expression, moved, never re-spelled>, <this declaration>)\` at module level, passed to \`file()\`), which test/self/s9-staged-sources.test.ts judges before any product exists; ${mdxForm}; an edit of bytes the product itself wrote goes through \`edit()\`; a mutation, a noise file, or a tampered product-written module is declared \`unchecked\` (\`{ ts: "unchecked" }\`); a property draw's composed file is declared \`per-draw\` (\`{ ts: "per-draw" }\`, section-16 modules only); another workspace's product-written bytes carried into a fresh workspace go through \`copyFrom()\``;
    }
    throw new HarnessStagingError("undeclared-staging", mdxKey(rel), detail);
  }

  /**
   * Where the undeclared-staging guard finds a product invocation before
   * a staging: in this workspace (its mark), else in the running registered
   * body (its context — S-7's actual reach); undefined when neither mark is
   * set, the staging being one S-7's sweep reaches.
   */
  private invocationBefore(): string | undefined {
    if (this.invocationMark.invoked) return "in this workspace";
    const body = productInvokedInBody();
    if (body === undefined) return undefined;
    return `in the running body of ${body} (in another workspace: S-7's sweep stops at the body's first invocation wherever it happens)`;
  }

  /**
   * Rewrite one spelling in a file's current bytes — `from` replaced by `to`
   * once, in the UTF-8 decoding of the bytes as they stand — and stage the
   * result under the path's S-9 declarations (the workspace declaration's,
   * else well-formed), judged at staging time like every `.mdx` write and
   * every code source's or configuration file's (`tsDeclarationOf`). This
   * stages an edit of bytes the PRODUCT wrote — a rename's or move's
   * rewritten source, which no harness constant equals and which nothing can
   * judge before the product exists — never of a file whose current bytes
   * are the harness's own staging: that edit is a deterministic fixture,
   * computed at module level from the constant as a staged-source record
   * (helpers/staged-mdx.ts) and staged with `file()`. A `from` the file does
   * not contain is a harness staging error, never a product verdict.
   */
  async edit(rel: string, from: string, to: string): Promise<void> {
    const current = Buffer.from(await this.readBytes(rel)).toString("utf8");
    if (!current.includes(from)) {
      throw new Error(
        `harness staging: ${rel} does not contain ${JSON.stringify(from)}`,
      );
    }
    const data = Buffer.from(current.replace(from, to), "utf8");
    this.checkMdx(rel, data, undefined);
    this.checkTs(rel, data, undefined);
    await this.write(rel, data);
  }

  /**
   * Stage another live workspace's current bytes of `rel` here, at `destRel`
   * (default: the same path), under this workspace's S-9 declarations for
   * the destination, judged at staging time like every `.mdx` write and
   * every code source's or configuration file's. This
   * carries the PRODUCT's output — a rename's or move's rewritten sources,
   * the configuration and journal beside them — into a fresh workspace (the
   * H-6 two-directory protocol of T6.4-7, T6.5-1, T6.5-3): bytes no harness
   * constant equals, so not a deterministic fixture, and never a new
   * harness-spelled source (whatever the product left untouched was staged,
   * and judged, in `source` already). Out of a workspace no product has
   * been invoked in, the bytes are the harness's own staging under another
   * name, so the undeclared-staging guard applies to an `.mdx` destination,
   * and to a destination the TypeScript check judges, exactly as to plain
   * contents (a deterministic fixture belongs in the ledger).
   */
  async copyFrom(
    source: TestWorkspace,
    rel: RelPath,
    destRel: RelPath = rel,
  ): Promise<void> {
    const data = await source.readBytes(rel);
    if (!source.productInvoked) {
      if (isMdxPath(destRel)) {
        this.guardUndeclaredStaging(
          destRel,
          this.mdxDeclarations.get(mdxKey(destRel)) ?? "well-formed",
        );
      }
      this.guardUndeclaredTsStaging(destRel, this.tsDeclarationOf(destRel));
    }
    this.checkMdx(destRel, data, undefined);
    this.checkTs(destRel, data, undefined);
    await this.write(destRel, data);
  }

  /** The S-9 declaration in effect for a staged path (`.mdx` paths only). */
  mdxDeclarationOf(rel: RelPath): MdxFileDeclaration | undefined {
    if (!isMdxPath(rel)) return undefined;
    return this.mdxDeclarations.get(mdxKey(rel)) ?? "well-formed";
  }

  /**
   * The S-9 TypeScript declaration in effect for a staged path: the
   * workspace declaration's entry, else well-formed for a name
   * `TS_DEFAULT_SUFFIXES` reaches; undefined for a path nothing judges.
   */
  tsDeclarationOf(rel: RelPath): TsFileDeclaration | undefined {
    return (
      this.tsDeclarations.get(mdxKey(rel)) ??
      (isTsDefaultPath(rel) ? "well-formed" : undefined)
    );
  }

  private checkTs(
    rel: RelPath,
    data: Uint8Array,
    override: TsFileDeclaration | undefined,
  ): void {
    const declaration = override ?? this.tsDeclarationOf(rel);
    if (declaration === undefined) return;
    judgeTsDeclaration(mdxKey(rel), data, declaration);
  }

  private checkMdx(
    rel: RelPath,
    data: Uint8Array,
    override: MdxFileDeclaration | undefined,
  ): void {
    if (!isMdxPath(rel)) return;
    const declaration = override ?? this.mdxDeclarationOf(rel);
    if (declaration === undefined) return;
    judgeMdxDeclaration(mdxKey(rel), data, declaration);
  }

  private async write(rel: RelPath, data: Uint8Array): Promise<void> {
    const abs = this.resolve(rel);
    await ensureParent(abs);
    await fsp.writeFile(abs, data);
  }

  /** Create a directory (and parents). */
  async dir(rel: string): Promise<void> {
    await fsp.mkdir(this.path(rel), { recursive: true });
  }

  /**
   * Create a symbolic link whose target is stored verbatim — never resolved,
   * never validated: dangling, cyclic, and workspace-external targets are
   * legitimate declarations (T7-5, T13.4-6). `kind` is the Windows link-type
   * hint; it is ignored on POSIX platforms.
   */
  async symlink(
    rel: string,
    target: string,
    kind: "file" | "dir" = "file",
  ): Promise<void> {
    const abs = this.path(rel);
    await ensureParent(abs);
    await fsp.symlink(target, abs, kind);
  }

  /** Read a file's exact bytes (follows symlinks, like the product would). */
  async readBytes(rel: RelPath): Promise<Uint8Array> {
    return await fsp.readFile(this.resolve(rel));
  }

  /** Directory entry names as raw bytes, sorted bytewise (deterministic). */
  async readdirBytes(rel: RelPath = "."): Promise<Uint8Array[]> {
    const names = await fsp.readdir(this.resolve(rel), { encoding: "buffer" });
    return names.sort(Buffer.compare);
  }

  /** Directory entry names as UTF-8 strings, sorted (deterministic). */
  async readdirNames(rel = "."): Promise<string[]> {
    const names = await fsp.readdir(this.path(rel));
    return names.sort();
  }

  /** A symbolic link's target, exactly as stored. */
  async linkTarget(rel: string): Promise<string> {
    return await fsp.readlink(this.path(rel));
  }

  /** What occupies a path, without following symlinks. */
  async kind(rel: RelPath): Promise<EntryKind> {
    let stats;
    try {
      stats = await fsp.lstat(this.resolve(rel));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return "absent";
      }
      throw error;
    }
    if (stats.isSymbolicLink()) return "symlink";
    if (stats.isDirectory()) return "dir";
    if (stats.isFile()) return "file";
    return "other";
  }

  /**
   * Initialize a git repository at the workspace root with a fixed initial
   * branch name and newline handling pinned off, independent of the machine
   * and platform (E-6).
   */
  async gitInit(): Promise<void> {
    await this.runGit(["init", "--quiet", "-b", "main"]);
    await this.runGit(["config", "core.autocrlf", "false"]);
  }

  /**
   * Stage everything and commit with pinned, platform-independent identities
   * and timestamps (E-6). Returns the commit hash. Defaults make identical
   * scripts produce identical hashes in any directory, on any platform.
   */
  async gitCommitAll(
    message: string,
    options: GitCommitOptions = {},
  ): Promise<string> {
    const author = options.author ?? GIT_FIXTURE_PERSON;
    const committer = options.committer ?? author;
    const authorDate =
      options.authorDate ??
      `${GIT_FIXTURE_EPOCH_SECONDS + 60 * this.gitCommitCount} +0000`;
    const committerDate = options.committerDate ?? authorDate;
    this.gitCommitCount += 1;
    await this.runGit(["add", "-A"]);
    await this.runGit(["commit", "--quiet", "--allow-empty", "-m", message], {
      GIT_AUTHOR_NAME: author.name,
      GIT_AUTHOR_EMAIL: author.email,
      GIT_AUTHOR_DATE: authorDate,
      GIT_COMMITTER_NAME: committer.name,
      GIT_COMMITTER_EMAIL: committer.email,
      GIT_COMMITTER_DATE: committerDate,
    });
    const { stdout } = await this.runGit(["rev-parse", "HEAD"]);
    return stdout.trim();
  }

  /**
   * Run an arbitrary git command in the workspace root under the isolated,
   * pinned git environment. Throws (with stderr) on nonzero exit.
   */
  async git(
    args: readonly string[],
  ): Promise<{ stdout: string; stderr: string }> {
    return await this.runGit(args);
  }

  /** Remove the workspace and all builder scratch. Safe to call twice. */
  async dispose(): Promise<void> {
    unregisterWorkspaceRoot(this.invocationMark);
    try {
      await fsp.rm(this.tempRoot, {
        recursive: true,
        force: true,
        maxRetries: 2,
      });
    } catch {
      // Read-only entries (git object files on Windows) block deletion; make
      // the tree writable and retry once, loudly this time.
      await makeTreeWritable(Buffer.from(this.tempRoot));
      await fsp.rm(this.tempRoot, {
        recursive: true,
        force: true,
        maxRetries: 2,
      });
    }
  }

  private resolve(rel: RelPath): string | Buffer {
    if (typeof rel === "string") {
      return this.path(rel);
    }
    const bytes = Buffer.from(rel);
    assertValidBytePath(bytes);
    return Buffer.concat([Buffer.from(this.root), Buffer.from([SLASH]), bytes]);
  }

  private gitScratchDirs(): Promise<{ home: string; configFile: string }> {
    this.gitScratch ??= (async () => {
      const home = path.join(this.tempRoot, "git-home");
      await fsp.mkdir(path.join(home, ".config"), { recursive: true });
      const configFile = path.join(this.tempRoot, "git-config");
      await fsp.writeFile(configFile, "");
      return { home, configFile };
    })();
    return this.gitScratch;
  }

  private async runGit(
    args: readonly string[],
    identityEnv: Readonly<Record<string, string>> = {},
  ): Promise<{ stdout: string; stderr: string }> {
    const { home, configFile } = await this.gitScratchDirs();
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      const upper = key.toUpperCase();
      // Ambient git control variables and the ident fallback must not leak
      // into fixtures (E-6: platform- and machine-independent commits).
      if (upper.startsWith("GIT_") || upper === "EMAIL") continue;
      env[key] = value;
    }
    Object.assign(env, {
      HOME: home,
      XDG_CONFIG_HOME: path.join(home, ".config"),
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: configFile,
      GIT_CEILING_DIRECTORIES: this.tempRoot,
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C",
      ...identityEnv,
    });
    try {
      const { stdout, stderr } = await execFileAsync("git", args, {
        cwd: this.root,
        env,
        timeout: 60_000,
        maxBuffer: 16 * 1024 * 1024,
      });
      return { stdout, stderr };
    } catch (error) {
      const failure = error as {
        stderr?: string;
        code?: number | string;
        killed?: boolean;
      };
      const reason = failure.killed
        ? "killed (timeout)"
        : `exit ${String(failure.code ?? "unknown")}`;
      throw new Error(
        `git ${args.join(" ")} failed in ${this.root} (${reason}): ${failure.stderr ?? String(error)}`,
      );
    }
  }
}

/**
 * S-9's judge — one code path for the builder (every `.mdx` staging, as it
 * is written) and the self-tests (every staged-source record, before any
 * product exists): `data`, a source's exact bytes, must match `declaration`
 * — derive under the stock MDX 3 parser when declared well-formed (under
 * exactly the named allowances when it names any), not derive when declared
 * unparseable — or a `HarnessStagingError` of mode `mdx-derivability` names
 * `key` (the staged path, or a record's name) and the parser's reason. An
 * `unchecked` declaration judges nothing; `per-draw` judges as `well-formed`
 * (the property runner judged the draw already; the declaration's other
 * meaning — exempt from the undeclared-staging guard — is `file()`'s).
 */
export function judgeMdxDeclaration(
  key: string,
  data: Uint8Array,
  declaration: MdxFileDeclaration,
): void {
  if (declaration === "unchecked") return;
  const allowances =
    typeof declaration === "object" ? declaration.allowances : undefined;
  if (allowances !== undefined) assertKnownAllowances(key, allowances);
  const verdict = deriveMdx(
    data,
    allowances === undefined ? undefined : { allowances },
  );
  if (declaration === "unparseable") {
    if (verdict.derives) {
      throw new HarnessStagingError(
        "mdx-derivability",
        key,
        "declared unparseable (`mdx.unparseable`) but the source derives " +
          "under the stock MDX 3 parser — SPEC 14.20 admits it; declare " +
          "it well-formed (the default) or, if it relies on an early " +
          "error 14.20 admits, name its allowance",
      );
    }
    return;
  }
  if (!verdict.derives) {
    const where =
      verdict.position === undefined
        ? ""
        : ` at line ${verdict.position.line}, column ${verdict.position.column} (offset ${verdict.position.offset})`;
    const declared =
      declaration === "per-draw"
        ? "declared well-formed per draw (`per-draw`: a property draw the runner judged)"
        : allowances === undefined
          ? "declared well-formed (S-9's default)"
          : `declared well-formed under the allowances ${JSON.stringify(allowances)}`;
    throw new HarnessStagingError(
      "mdx-derivability",
      key,
      `${declared} but the stock MDX 3 parser rejects it${where}: ` +
        `${verdict.reason} — list the path under \`mdx.unparseable\` if ` +
        "TEST-SPEC declares the source unparseable (SPEC 14.20), name " +
        "its allowance if it relies on an early error 14.20 admits, or " +
        "under `mdx.unchecked` only if the document does not declare " +
        "its derivability (S-9)",
    );
  }
}

/**
 * The name suffixes S-9's TypeScript default reaches: a staged file whose
 * name ends in one of them is declared well-formed unless its staging
 * declares otherwise — TypeScript's own source names (`.d.ts` and its kin
 * included) and JavaScript's, which a code group globbing them discovers as
 * code sources parsed as plain TypeScript (SPEC 14.20: any name but `.tsx`
 * selects plain TypeScript). Every configuration file the suite stages is
 * named `.ts` (`xspec.config.ts`, each `--config` target). Matched
 * case-sensitively, as SPEC spells the `.tsx` suffix.
 */
export const TS_DEFAULT_SUFFIXES = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
] as const;

/**
 * S-9's TypeScript judge for a staging — one code path for the builder
 * (every code source and configuration file, as it is written) and the
 * self-tests judging a staging before any product exists (every TypeScript
 * staged-source record): `data`, the file's exact bytes, must match
 * `declaration` under `judgeTypeScript` (the grammar `fileName` selects —
 * the staged path, `key`, by default; a record, judged before it has a
 * path, is handed a neutral name of its grammar, `tsGrammarFileName`), or a
 * `HarnessStagingError` of mode `ts-derivability` names `key` (the staged
 * path, or a record's name) and the parser's first error. A text the
 * release accepts read one way only is refused under either declaration
 * (S-9: no fixture is such text). An `unchecked` declaration judges nothing;
 * `per-draw` judges as `well-formed` (a property draw's composed file; the
 * declaration's other meaning — exempt from the undeclared-staging guard —
 * is the builder's), its refusal naming the generator.
 */
export function judgeTsDeclaration(
  key: string,
  data: Uint8Array,
  declaration: TsFileDeclaration,
  fileName: string = key,
): void {
  if (declaration === "unchecked") return;
  const verdict = judgeTypeScript(data, fileName);
  const perDraw = declaration === "per-draw";
  const problem = tsDeclarationProblem(
    verdict,
    perDraw ? "well-formed" : declaration,
  );
  if (problem === undefined) return;
  if (perDraw) {
    throw new HarnessStagingError(
      "ts-derivability",
      key,
      `${problem.replace(
        /^declared well-formed/,
        "declared well-formed per draw (`per-draw`: a property draw's " +
          "composed file)",
      )} — the generator composed a configuration or code source that is ` +
        "not well-formed TypeScript, which no draw may be (TEST-SPEC 16, " +
        "S-9): fix the generator",
    );
  }
  const remedy =
    verdict.verdict === "one-way"
      ? "restage the fixture as text both readings agree on, or list the " +
        "path under `ts.unchecked` only if the document does not declare " +
        "its well-formedness (S-9)"
      : declaration === "well-formed"
        ? "list the path under `ts.unparseable` if TEST-SPEC declares the " +
          "file unparseable (SPEC 14.20), or under `ts.unchecked` only if " +
          "the document does not declare its well-formedness (a fuzz " +
          "mutation, a noise file no discovery reaches, an edit of " +
          "product-written bytes; S-9)"
        : "drop the path from `ts.unparseable` (well-formed is the default " +
          "for a name the default reaches; `ts.wellFormed` declares any " +
          "other code source)";
  throw new HarnessStagingError(
    "ts-derivability",
    key,
    `${problem} — ${remedy}`,
  );
}

/** A declared file's bytes: a string encoded as UTF-8, bytes verbatim. */
function toBytes(contents: FileContents): Uint8Array {
  return typeof contents === "string"
    ? Buffer.from(contents, "utf8")
    : contents;
}

const MDX_SUFFIX = Buffer.from(".mdx", "utf8");

/** Whether a staged path names an MDX source: it ends in `.mdx`. */
function isMdxPath(rel: RelPath): boolean {
  if (typeof rel === "string") return rel.endsWith(".mdx");
  return (
    rel.length >= MDX_SUFFIX.length &&
    Buffer.from(rel.subarray(rel.length - MDX_SUFFIX.length)).equals(MDX_SUFFIX)
  );
}

/** Whether S-9's TypeScript default reaches a staged path by its name. */
function isTsDefaultPath(rel: RelPath): boolean {
  const bytes = typeof rel === "string" ? Buffer.from(rel, "utf8") : rel;
  return TS_DEFAULT_SUFFIXES.some((suffix) => {
    const tail = Buffer.from(suffix, "utf8");
    return (
      bytes.length >= tail.length &&
      Buffer.from(bytes.subarray(bytes.length - tail.length)).equals(tail)
    );
  });
}

/**
 * The `.mdx` keys of an initial `files` map that stage plain contents, in
 * the map's order — the paths a workspace declaration's list may name (a
 * section-16 module's `perDraw` list over a map its generator rendered,
 * whose `.mdx` keys are the draw's; P-11's `unchecked` mutations). A record
 * entry is left out: it carries its own declaration, and a list naming its
 * path is the contradiction `create()` refuses.
 */
export function mdxPathsOf(
  files: Readonly<Record<string, InitialFileContents>>,
): string[] {
  return Object.entries(files)
    .filter(
      ([rel, contents]) => isMdxPath(rel) && !(contents instanceof StagedMdx),
    )
    .map(([rel]) => rel);
}

/**
 * The keys of an initial `files` map that stage plain contents at a path
 * S-9's TypeScript default reaches (a `TS_DEFAULT_SUFFIXES` name), in the
 * map's order — the paths a section-16 module's `ts.perDraw` list names
 * over a map its generator rendered (P-7's configurations, P-13's
 * configuration and code sources). A record entry is left out: it carries
 * its own declaration, and a list naming its path is the contradiction
 * `create()` refuses.
 */
export function tsPathsOf(
  files: Readonly<Record<string, InitialFileContents>>,
): string[] {
  return Object.entries(files)
    .filter(
      ([rel, contents]) =>
        isTsDefaultPath(rel) &&
        !(contents instanceof StagedTs) &&
        !(contents instanceof StagedMdx),
    )
    .map(([rel]) => rel);
}

/**
 * The declaration key of a staged path: the `/`-separated relative path,
 * normalized (`./a`, `a//b` and `a/./b` spell `a`, `a/b`); a byte path is
 * decoded as UTF-8 with replacement characters.
 */
function mdxKey(rel: RelPath): string {
  const text =
    typeof rel === "string" ? rel : Buffer.from(rel).toString("utf8");
  return path.posix.normalize(text);
}

function assertKnownAllowances(
  key: string,
  allowances: readonly MdxAllowance[],
): void {
  for (const allowance of allowances) {
    if (!(MDX_ALLOWANCES as readonly string[]).includes(allowance)) {
      throw new HarnessStagingError(
        "mdx-derivability",
        key,
        `unknown allowance ${JSON.stringify(allowance)} — S-9's allowances are ${JSON.stringify(MDX_ALLOWANCES)}`,
      );
    }
  }
}

/**
 * Resolve a workspace's S-9 declaration to one entry per path, refusing a
 * declaration defect: a path in two lists, a path that is not an MDX
 * source, an unknown allowance, an empty allowance list.
 */
function resolveMdxDeclaration(
  decl: WorkspaceMdxDecl,
): ReadonlyMap<string, MdxFileDeclaration> {
  const resolved = new Map<string, MdxFileDeclaration>();
  const declare = (rel: string, declaration: MdxFileDeclaration): void => {
    if (!isMdxPath(rel)) {
      throw new HarnessStagingError(
        "mdx-derivability",
        rel,
        "the S-9 declaration names a path that is not an MDX source (only " +
          "`.mdx` paths are judged)",
      );
    }
    const key = mdxKey(rel);
    if (resolved.has(key)) {
      throw new HarnessStagingError(
        "mdx-derivability",
        key,
        "the S-9 declaration names the path in more than one of " +
          "`unparseable`, `unchecked`, `perDraw`, and `allowances`",
      );
    }
    resolved.set(key, declaration);
  };
  for (const rel of decl.unparseable ?? []) declare(rel, "unparseable");
  for (const rel of decl.unchecked ?? []) declare(rel, "unchecked");
  for (const rel of decl.perDraw ?? []) declare(rel, "per-draw");
  for (const [rel, allowances] of Object.entries(decl.allowances ?? {})) {
    if (allowances.length === 0) {
      throw new HarnessStagingError(
        "mdx-derivability",
        rel,
        "the S-9 declaration names an empty allowance list — omit the path " +
          "instead (well-formed is the default)",
      );
    }
    assertKnownAllowances(rel, allowances);
    declare(rel, { allowances });
  }
  return resolved;
}

/**
 * Resolve a workspace's S-9 TypeScript declaration to one entry per path,
 * refusing a declaration defect: a path in two lists.
 */
function resolveTsDeclaration(
  decl: WorkspaceTsDecl,
): ReadonlyMap<string, TsFileDeclaration> {
  const resolved = new Map<string, TsFileDeclaration>();
  const declare = (rel: string, declaration: TsFileDeclaration): void => {
    const key = mdxKey(rel);
    if (resolved.has(key)) {
      throw new HarnessStagingError(
        "ts-derivability",
        key,
        "the S-9 TypeScript declaration names the path in more than one " +
          "of `unparseable`, `unchecked`, `wellFormed`, and `perDraw`",
      );
    }
    resolved.set(key, declaration);
  };
  for (const rel of decl.unparseable ?? []) declare(rel, "unparseable");
  for (const rel of decl.unchecked ?? []) declare(rel, "unchecked");
  for (const rel of decl.wellFormed ?? []) declare(rel, "well-formed");
  for (const rel of decl.perDraw ?? []) declare(rel, "per-draw");
  return resolved;
}

/** Create the parent directory chain for an absolute (string or byte) path. */
async function ensureParent(abs: string | Buffer): Promise<void> {
  if (typeof abs === "string") {
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    return;
  }
  // Byte paths always contain the root/rel joiner slash.
  await fsp.mkdir(abs.subarray(0, abs.lastIndexOf(SLASH)), { recursive: true });
}

/**
 * Byte paths are workspace-relative by construction: no leading `/`, no NUL,
 * and no `.`/`..`/empty segments (they cannot be normalized safely and could
 * alias or escape the root).
 */
function assertValidBytePath(bytes: Buffer): void {
  if (bytes.length === 0) {
    throw new Error("byte path is empty");
  }
  if (bytes[0] === SLASH) {
    throw new Error(
      "byte path must be workspace-relative (leading '/' forbidden)",
    );
  }
  if (bytes.includes(0)) {
    throw new Error("byte path contains a NUL byte");
  }
  let start = 0;
  for (let i = 0; i <= bytes.length; i += 1) {
    if (i === bytes.length || bytes[i] === SLASH) {
      const segment = bytes.subarray(start, i);
      if (segment.length === 0) {
        throw new Error("byte path contains an empty segment");
      }
      if (segment.length === 1 && segment[0] === DOT) {
        throw new Error("byte path contains a '.' segment");
      }
      if (segment.length === 2 && segment[0] === DOT && segment[1] === DOT) {
        throw new Error("byte path contains a '..' segment");
      }
      start = i + 1;
    }
  }
}

/** Best-effort recursive chmod so `rm` can delete read-only entries. */
async function makeTreeWritable(dir: Buffer): Promise<void> {
  await fsp.chmod(dir, 0o700).catch(() => undefined);
  const names = await fsp
    .readdir(dir, { encoding: "buffer" })
    .catch(() => undefined);
  if (!names) return;
  for (const name of names) {
    const child = Buffer.concat([dir, Buffer.from([SLASH]), name]);
    const stats = await fsp.lstat(child).catch(() => undefined);
    if (!stats) continue;
    if (stats.isDirectory()) {
      await makeTreeWritable(child);
    } else if (stats.isFile()) {
      await fsp.chmod(child, 0o600).catch(() => undefined);
    }
  }
}
