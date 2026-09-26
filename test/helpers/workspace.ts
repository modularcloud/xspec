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
// - The undeclared-staging guard enforces that form: once a product has been
//   invoked in a workspace (the subprocess driver marks it, root and
//   realpath matched) or anywhere in the running registered body (the
//   async-local context test/suite/declare.ts and the certification runner
//   establish — S-7's reach is per body: the sweep stops at the body's
//   first invocation in whatever workspace, so a staging into a fresh
//   later-arm workspace is unreached too; helpers/product-invocations.ts),
//   `file()` on an `.mdx` path with plain contents throws
//   `HarnessStagingError` (mode `undeclared-staging`) unless the effective
//   declaration is `unchecked` (P-8's mutations) or `per-draw` (a property
//   draw the runner judged before the body saw it, S-9's property clause —
//   the section-16 modules' alone). `edit()` is a declared staging by
//   construction, and so is `copyFrom()` — another live workspace's current
//   bytes, the product's output there, carried into a fresh workspace (the
//   H-6 two-directory seeding of T6.4-7, T6.5-1, T6.5-3) — except out of a
//   workspace no product has been invoked in, where the bytes are the
//   harness's own staging and the guard applies as to plain contents. A
//   workspace declaration's initial `files` take a record too
//   (`InitialFileContents`): the initial `.mdx` files of a workspace a body
//   creates AFTER its first product invocation — a later arm's, a helper's
//   twin — are deterministic fixtures S-7's sweep never reaches (the body
//   fails at that invocation), so each is a record `create()` stages under
//   the record's declaration (a record at a non-`.mdx` key, or beside a
//   workspace-declaration entry for its path, throws as a record beside an
//   `mdx` option does); a body's first workspace's initial files may stay
//   plain contents, reached by the sweep. The guard does not cover
//   `create()`'s initial entries: a plain `.mdx` entry of a later-arm
//   workspace is a convention the S-9 self-test cannot see, not a refusal.
//   The declaration's `perDraw` list is the initial-file form of
//   `per-draw`: a section-16 module's draw-derived initial files, judged by
//   the property runner before the body saw them.

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
 * staged-source record (helpers/staged-mdx.ts) whose bytes `create()` stages
 * under the record's own S-9 declaration — the form of every `.mdx` initial
 * file of a workspace a body creates after its first product invocation, so
 * that the S-9 self-test judged it before any product existed (module
 * header). A record belongs at an `.mdx` key the workspace's `mdx`
 * declaration does not name; a body's first workspace's initial files may
 * stay plain contents.
 */
export type InitialFileContents = FileContents | StagedMdx;

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
 * (section-16-p4.ts, -p5-p6.ts, -p9.ts) pass it — to `file()`, or as the
 * workspace declaration's `perDraw` list for a draw's initial files; a
 * deterministic test never does, and a staged-source record never carries it.
 */
export type MdxFileDeclaration =
  | "well-formed"
  | "unparseable"
  | "unchecked"
  | "per-draw"
  | { readonly allowances: readonly MdxAllowance[] };

/** Options of a single `file()` staging. */
export interface FileOptions {
  /** The file's S-9 declaration; defaults to the workspace declaration's. */
  readonly mdx?: MdxFileDeclaration;
}

/** Declarative form of a workspace's initial content. */
export interface WorkspaceDecl {
  /**
   * Regular files: workspace-relative path → exact contents, or a
   * staged-source record at an `.mdx` path (`InitialFileContents`).
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
  /** The undeclared-staging guard's mark: has a product been invoked here? */
  private readonly invocationMark: WorkspaceInvocationMark;

  private constructor(
    tempRoot: string,
    root: string,
    mdxDeclarations: ReadonlyMap<string, MdxFileDeclaration>,
    invocationMark: WorkspaceInvocationMark,
  ) {
    this.tempRoot = tempRoot;
    this.root = root;
    this.mdxDeclarations = mdxDeclarations;
    this.invocationMark = invocationMark;
  }

  /**
   * Create a fresh workspace in a unique temporary directory and populate it
   * with the declared entries (directories, then files, then symlinks); each
   * `.mdx` file is judged against the staging's S-9 declaration as it is
   * written (a contradiction throws `HarnessStagingError`).
   */
  static async create(decl: WorkspaceDecl = {}): Promise<TestWorkspace> {
    const mdxDeclarations = resolveMdxDeclaration(decl.mdx ?? {});
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
   * effective declaration is `unchecked` or `per-draw`.
   */
  async file(
    rel: RelPath,
    contents: FileContents | StagedMdx,
    options: FileOptions = {},
  ): Promise<void> {
    let data: Uint8Array;
    let declaration = options.mdx;
    if (contents instanceof StagedMdx) {
      ({ data, declaration } = this.recordStaging(
        rel,
        contents,
        declaration,
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
    }
    this.checkMdx(rel, data, declaration);
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
   * staged-source record, staged under the record's own declaration (module
   * header — the form of a later-arm workspace's initial `.mdx` files, which
   * S-7's sweep never reaches; a body's first workspace's may stay plain).
   * Outside the undeclared-staging guard: a plain entry is not refused after
   * an invocation.
   */
  private async stageInitial(
    rel: string,
    contents: InitialFileContents,
  ): Promise<void> {
    let data: Uint8Array;
    let declaration: MdxFileDeclaration | undefined;
    if (contents instanceof StagedMdx) {
      ({ data, declaration } = this.recordStaging(
        rel,
        contents,
        this.mdxDeclarations.get(mdxKey(rel)),
        "declaration entry",
      ));
    } else {
      data = toBytes(contents);
      declaration = undefined;
    }
    this.checkMdx(rel, data, declaration);
    await this.write(rel, data);
  }

  /**
   * A staged-source record's staging — `file()`'s and an initial `files`
   * entry's alike: the record's bytes under the record's declaration, the
   * one the S-9 self-test verified. A record at a path S-9 does not judge
   * is a mistake, and a second declaration for the path beside the record
   * (`file()`'s `mdx` option, the workspace declaration's entry) is a
   * contradiction; both throw before anything is written.
   */
  private recordStaging(
    rel: RelPath,
    record: StagedMdx,
    beside: MdxFileDeclaration | undefined,
    besideForm: "option" | "declaration entry",
  ): { readonly data: Uint8Array; readonly declaration: MdxFileDeclaration } {
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
    return { data: toBytes(record.source), declaration: record.mdx };
  }

  /**
   * The undeclared-staging guard (module header; TEST-SPEC S-9's timing
   * clause, S-7, H-8): a plain `.mdx` staging — contents that are not a
   * staged-source record — after a product invocation is first judged at
   * suite time, against a real product, because S-7's sweep never reaches
   * it; unless its effective declaration exempts it, it is refused with the
   * rule to follow. "After a product invocation" is judged both per
   * workspace (this one's mark) and per body (the running registered body's
   * context), the latter being S-7's actual reach.
   */
  private guardUndeclaredStaging(
    rel: RelPath,
    declaration: MdxFileDeclaration,
  ): void {
    if (declaration === "unchecked" || declaration === "per-draw") return;
    const body = productInvokedInBody();
    if (!this.invocationMark.invoked && body === undefined) return;
    const where = this.invocationMark.invoked
      ? "in this workspace"
      : `in the running body of ${body ?? "?"} (in another workspace: S-7's sweep stops at the body's first invocation wherever it happens)`;
    throw new HarnessStagingError(
      "undeclared-staging",
      mdxKey(rel),
      `an MDX source staged with plain contents (declared ${JSON.stringify(declaration)}) after a product invocation ${where} — S-7's sweep against the empty stub never reaches this staging (the body fails at that invocation), so S-9's check would first run at suite time, against a real product, not before any product exists (H-8). Stage it as a staged-source record instead (helpers/staged-mdx.ts: \`stagedMdx("<TEST-ID> <what it stages>", <the same expression, moved, never re-spelled>, <this declaration>)\` at module level, passed to \`file()\`), which test/self/s9-staged-sources.test.ts judges before any product exists; an edit of bytes the product itself wrote goes through \`edit()\`; a P-8 fuzz mutation is declared \`unchecked\`; a property draw the runner already judged is declared \`per-draw\` (section-16 modules only); another workspace's product-written bytes carried into a fresh workspace go through \`copyFrom()\``,
    );
  }

  /**
   * Rewrite one spelling in a file's current bytes — `from` replaced by `to`
   * once, in the UTF-8 decoding of the bytes as they stand — and stage the
   * result under the path's S-9 declaration (the workspace declaration's,
   * else well-formed), judged at staging time like every `.mdx` write. This
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
    await this.write(rel, data);
  }

  /**
   * Stage another live workspace's current bytes of `rel` here, at `destRel`
   * (default: the same path), under this workspace's S-9 declaration for the
   * destination, judged at staging time like every `.mdx` write. This
   * carries the PRODUCT's output — a rename's or move's rewritten sources,
   * the configuration and journal beside them — into a fresh workspace (the
   * H-6 two-directory protocol of T6.4-7, T6.5-1, T6.5-3): bytes no harness
   * constant equals, so not a deterministic fixture, and never a new
   * harness-spelled source (whatever the product left untouched was staged,
   * and judged, in `source` already). Out of a workspace no product has
   * been invoked in, the bytes are the harness's own staging under another
   * name, so the undeclared-staging guard applies to an `.mdx` destination
   * exactly as to plain contents (a deterministic fixture belongs in the
   * ledger).
   */
  async copyFrom(
    source: TestWorkspace,
    rel: RelPath,
    destRel: RelPath = rel,
  ): Promise<void> {
    const data = await source.readBytes(rel);
    if (isMdxPath(destRel) && !source.productInvoked) {
      this.guardUndeclaredStaging(
        destRel,
        this.mdxDeclarations.get(mdxKey(destRel)) ?? "well-formed",
      );
    }
    this.checkMdx(destRel, data, undefined);
    await this.write(destRel, data);
  }

  /** The S-9 declaration in effect for a staged path (`.mdx` paths only). */
  mdxDeclarationOf(rel: RelPath): MdxFileDeclaration | undefined {
    if (!isMdxPath(rel)) return undefined;
    return this.mdxDeclarations.get(mdxKey(rel)) ?? "well-formed";
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
