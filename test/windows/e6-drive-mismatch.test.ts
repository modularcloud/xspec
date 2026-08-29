// E-6 platform-sensitive subset, part 2 of 3 (TEST-SPEC §18 E-6; CI-01) —
// the drive-mismatch anchoring arm of T11.6-1, the sole platform-form output
// in the whole surface, stageable on no Linux runner. Run by the
// suite-windows CI job (`npm run test:windows`); the path/identity
// assertions and casing probes live in e6-subset.test.ts, the byte-identity
// comparison in e6-byte-identity.test.ts.
//
// SPEC 11.6: the inventory's anchoring (`root`, `config`) is the canonical
// relative spelling — ascent `..` segments then descent segments, joined
// with `/` on every platform — except when the platform admits no relative
// path between the working directory and the workspace root (roots on
// different Windows drives): then, and only then, it is reported in the
// platform's absolute form, drive-qualified in the platform's own spelling —
// the sole absolute-path case and the sole output spelling whose separator
// is the platform's, still a pure function of invocation input,
// deterministic per invocation (SPEC 12.0). The registered T11.6-1 body
// (test/suite/registry/section-11.6.ts) pins every relative arm plus the
// Linux side of this one (an unrelated directory tree still yields the pure
// relative form: on Linux no absolute form ever appears); this arm stages
// the mismatch itself, which needs only a substituted drive mapping
// (`subst`, E-6) — per-logon-session state, no elevation, no second volume.
//
// Staging: the working directory is the root of a freshly substituted drive
// letter mapping a scratch directory, while the workspace root stays on the
// real temporary volume; `--config` names the configuration file absolutely
// (a relative spelling cannot cross drives). The registered body already
// proves an absolute `--config` from a same-drive working directory still
// yields the relative anchoring, so the absolute output here is
// attributable to the drive mismatch alone — never an echo of the
// argument's spelling (SPEC 11.6, 12.0). A relative answer computed by
// resolving the substituted mapping to its target would not even resolve
// correctly against the actual working directory, which is exactly why
// TEST-SPEC pins that a substituted mapping suffices to stage the mismatch.
//
// Drive letters are machine-global, per-logon-session state: the claim
// tries free letters until `subst` accepts one, so concurrent harness
// instances race safely (H-1, E-3) — each claims its own letter and deletes
// exactly the mapping it created. If the harness process is killed before
// the release, the mapping leaks until logoff (`subst <L>: /D` cleans it
// up by hand); CI runners are fresh per job.
//
// Failure taxonomy (H-8/H-9 — never a skip, never a vacuous pass),
// mirroring e6-byte-identity.test.ts:
// - stub or nonconforming product → the same-drive premise arm fails first,
//   as a diagnosed assertion failure, on any platform this project is run
//   on locally (the expected pre-product red on this leg);
// - premise passed, platform not Windows → loud error: the product answers
//   `inventory`, but a substituted drive mapping exists only on Windows —
//   the arm runs on the Windows leg (E-6), and passing here would be
//   vacuous;
// - premise passed, Windows, mapping staged, values differ → diagnosed
//   assertion failure — the platform-form divergence this arm exists to
//   catch.

import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import { test } from "vitest";
import type { PathValue } from "../helpers/adapters/index.js";
import {
  decodeInventoryAnchoring,
  decodeInventoryFindings,
  renderPathValue,
} from "../helpers/adapters/index.js";
import {
  assertBytesEqual,
  assertExitCode,
  fail,
  parseJsonStdout,
} from "../helpers/assertions.js";
import { DEFAULT_PRODUCT_TEST_TIMEOUT_MS } from "../helpers/registry.js";
import { builtProductBinding, runProduct } from "../helpers/subprocess.js";
import type { ProductBinding, RunResult } from "../helpers/subprocess.js";
import { TestWorkspace } from "../helpers/workspace.js";

const execFileAsync = promisify(execFile);

/**
 * Native realpath (GetFinalPathNameByHandle semantics on Windows): resolves
 * 8.3 short-name components (a GitHub runner's TEMP contains one) and
 * substituted mappings, where the JS `fs.realpath` resolves symlinks only.
 * The expectation and the `--config` argument are both spelled from this
 * canonical form, so a product that canonicalizes natively and one that
 * resolves the argument as-is agree on the same bytes.
 */
function realpathNative(p: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.realpath.native(p, (error, resolved) => {
      if (error) reject(error);
      else resolve(resolved);
    });
  });
}

// --- fixture ------------------------------------------------------------------
//
// A minimal valid workspace (the registered T11.6-1 body's staging): the
// inventory parses no sources (SPEC 11.6), so the anchoring depends on none
// of this — the staging keeps the workspace valid so every answer is the
// complete, finding-free, exit-0 case.

const ANCHOR_CONFIG = `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`;

const ANCHOR_SOURCE = '<S id="racine">\nAncrage — contenu stable.\n</S>\n';

const CONFIG_FILE = "xspec.config.ts";

// --- the platform-absolute spelling (harness-side) ----------------------------

/**
 * Whether `spelling` is a well-formed expected value for the drive-mismatch
 * anchoring: the platform's absolute, drive-qualified form — `<L>:\` then
 * backslash-joined segments, no `/`, no trailing separator, no `\\?\`
 * namespace prefix — on a drive other than the working directory's (SPEC
 * 11.6, 12.0). Pure string arithmetic (path.win32 works on every platform),
 * so the fixed-vector self-check below runs even where the arm itself
 * cannot stage.
 */
function isPlatformAbsoluteMismatchSpelling(
  spelling: string,
  cwdDriveLetter: string,
): boolean {
  return (
    path.win32.isAbsolute(spelling) &&
    /^[A-Za-z]:\\/.test(spelling) &&
    !spelling.includes("/") &&
    !spelling.endsWith("\\") &&
    spelling.slice(0, 1).toUpperCase() !== cwdDriveLetter.toUpperCase()
  );
}

/**
 * Fixture self-check (harness-side, before any product invocation, on every
 * platform): the expected-spelling validator must accept the platform's
 * absolute drive-qualified form and reject every near-miss — forward
 * slashes, drive-less or relative forms, a trailing separator, the `\\?\`
 * namespace prefix, and the working directory's own drive (no mismatch) —
 * and the config spelling must compose by platform join. A failure here is
 * a harness-arithmetic defect, never a product failure.
 */
function selfCheckPlatformSpellingRule(): void {
  const vectors: readonly [string, string, boolean][] = [
    ["C:\\t\\lieu\\work", "Z", true],
    ["D:\\a\\_temp\\xh-1\\work\\xspec.config.ts", "Z", true],
    ["C:/t/lieu/work", "Z", false],
    ["\\t\\lieu\\work", "Z", false],
    ["..\\lieu\\work", "Z", false],
    ["C:\\t\\lieu\\work\\", "Z", false],
    ["\\\\?\\C:\\t\\lieu\\work", "Z", false],
    ["Z:\\t\\lieu\\work", "Z", false],
    ["c:\\t\\lieu\\work", "C", false],
  ];
  for (const [spelling, cwdLetter, expected] of vectors) {
    if (isPlatformAbsoluteMismatchSpelling(spelling, cwdLetter) !== expected) {
      fail(
        `E-6 drive-mismatch fixture self-check — the platform-absolute ` +
          `spelling validator judges ${JSON.stringify(spelling)} against ` +
          `working-directory drive ${cwdLetter}: as ` +
          `${String(!expected)}, expected ${String(expected)} (a ` +
          `harness-arithmetic defect, not a product failure)`,
      );
    }
  }
  const joined = path.win32.join("C:\\t\\work", CONFIG_FILE);
  if (joined !== `C:\\t\\work\\${CONFIG_FILE}`) {
    fail(
      `E-6 drive-mismatch fixture self-check — platform join composed ` +
        `${JSON.stringify(joined)}, expected ` +
        `${JSON.stringify(`C:\\t\\work\\${CONFIG_FILE}`)} (a ` +
        `harness-arithmetic defect, not a product failure)`,
    );
  }
}

/** Self-check one computed expectation (see selfCheckPlatformSpellingRule). */
function selfCheckComputedPlatformSpelling(
  spelling: string,
  cwdDriveLetter: string,
  what: string,
): void {
  if (isPlatformAbsoluteMismatchSpelling(spelling, cwdDriveLetter)) return;
  fail(
    `E-6 drive-mismatch fixture self-check — ${what}: the computed ` +
      `expected spelling ${JSON.stringify(spelling)} is not the platform's ` +
      `absolute, drive-qualified form on a drive other than the working ` +
      `directory's ${cwdDriveLetter}: (a harness staging or arithmetic ` +
      `defect, not a product failure)`,
  );
}

/** The drive letter of an absolute drive-qualified path, or a loud error. */
function driveLetterOf(absPath: string, what: string): string {
  const letter = /^([A-Za-z]):[\\/]/.exec(absPath)?.[1];
  if (letter === undefined) {
    throw new Error(
      `E-6 drive-mismatch staging: ${what} (${JSON.stringify(absPath)}) ` +
        `carries no drive letter — the arm stages a working directory and ` +
        `a workspace root on different drive letters (SPEC 11.6, TEST-SPEC ` +
        `E-6), so the workspace root must live on a drive-lettered path (a ` +
        `UNC or namespace-prefixed temporary root cannot stage this arm). ` +
        `A staging environment problem, not a product failure.`,
    );
  }
  return letter;
}

// --- substituted drive mapping ------------------------------------------------

const SUBST_TIMEOUT_MS = 15_000;

/**
 * Letters tried for the mapping, most-obscure first; A/B (floppies), C/D
 * (system and runner work volumes) are never tried. `subst` refuses a
 * letter that is in use, so claiming is try-until-accepted: safe under
 * concurrent harness instances (H-1, E-3), which simply claim different
 * letters.
 */
const CANDIDATE_DRIVE_LETTERS = "ZYXWVUTSRQPONMLKJIHGFE";

interface SubstDrive {
  /** The claimed letter, e.g. "Z". */
  readonly letter: string;
  /** The mapped drive's root directory, e.g. "Z:\\" — the arm's cwd. */
  readonly root: string;
  /** Delete exactly the mapping this claim created (`subst <L>: /D`). */
  release(): Promise<void>;
}

function describeExecFailure(error: unknown): string {
  const failure = error as {
    code?: number | string;
    killed?: boolean;
    stdout?: string;
    stderr?: string;
    message?: string;
  };
  if (failure.killed === true) return "killed (timeout)";
  const output = [failure.stdout, failure.stderr]
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .join(" / ")
    .replaceAll(/\s+/g, " ")
    .trim();
  const detail = output === "" ? (failure.message ?? "") : output;
  return `exit ${String(failure.code ?? "unknown")}${
    detail === "" ? "" : `: ${detail.slice(0, 200)}`
  }`;
}

/**
 * Map a free drive letter onto `targetDir` via `subst` and verify the
 * mapping answers. Failures here are staging environment problems (plain
 * errors), never product failures: the product is not involved.
 */
async function claimSubstDrive(targetDir: string): Promise<SubstDrive> {
  const attempts: string[] = [];
  for (const letter of CANDIDATE_DRIVE_LETTERS) {
    const drive = `${letter}:`;
    try {
      await execFileAsync("subst", [drive, targetDir], {
        timeout: SUBST_TIMEOUT_MS,
        windowsHide: true,
      });
    } catch (error) {
      // In use (or otherwise refused) — try the next letter.
      attempts.push(`${drive} (${describeExecFailure(error)})`);
      continue;
    }
    const stats = await fsp.stat(`${drive}\\`).catch(() => undefined);
    if (stats === undefined || !stats.isDirectory()) {
      await execFileAsync("subst", [drive, "/D"], {
        timeout: SUBST_TIMEOUT_MS,
        windowsHide: true,
      }).catch(() => undefined);
      throw new Error(
        `E-6 drive-mismatch staging: \`subst ${drive} ${targetDir}\` ` +
          `reported success but ${drive}\\ does not answer as a directory. ` +
          `A staging environment problem, not a product failure.`,
      );
    }
    let released = false;
    return {
      letter,
      root: `${drive}\\`,
      release: async () => {
        if (released) return;
        released = true;
        try {
          await execFileAsync("subst", [drive, "/D"], {
            timeout: SUBST_TIMEOUT_MS,
            windowsHide: true,
          });
        } catch (error) {
          throw new Error(
            `E-6 drive-mismatch staging: failed to delete the substituted ` +
              `mapping ${drive} (${describeExecFailure(error)}). The ` +
              `mapping leaks until logoff — clean it up with ` +
              `\`subst ${drive} /D\`.`,
          );
        }
      },
    };
  }
  throw new Error(
    `E-6 drive-mismatch staging: no candidate drive letter accepted a ` +
      `substituted mapping — tried ${attempts.join("; ")}. A staging ` +
      `environment problem (every letter in use, or subst unavailable), ` +
      `not a product failure.`,
  );
}

// --- shared assertion ---------------------------------------------------------

function assertAnchoringMember(
  actual: PathValue,
  expected: string,
  member: string,
  form: string,
  context: string,
): void {
  if (actual === expected) return;
  fail(
    `${context}: the inventory's ${member} anchoring must be exactly ` +
      `${JSON.stringify(expected)} — ${form}; got ${renderPathValue(actual)}`,
  );
}

/**
 * Run `inventory` from `cwd` and assert the T11.6-1 contract (the registered
 * body's frame): exit 0 exactly (a complete, finding-free answer, SPEC
 * 12.0/11.6; H-5); exactly one JSON document as the entire stdout (JSON-only,
 * SPEC 11); `findings` decoding to [] (form-exact, 12.7); and the
 * `root`/`config` anchoring byte-exact against `expected`, with `form`
 * naming the spelling rule the expectation realizes.
 */
async function expectAnchoredInventory(
  product: ProductBinding,
  cwd: string,
  argv: readonly string[],
  expected: { readonly root: string; readonly config: string },
  form: string,
  context: string,
): Promise<RunResult> {
  const result = await runProduct(product, { cwd, argv });
  assertExitCode(
    result,
    0,
    `${context} — a complete, finding-free inventory answer exits 0 ` +
      `(SPEC 12.0, 11.6)`,
  );
  const doc = parseJsonStdout(
    result,
    `${context} — inventory is JSON-only: a single JSON document is its ` +
      `only output form, with or without --json (SPEC 11, 12.0)`,
  );
  const findings = decodeInventoryFindings(doc, context);
  if (findings.length !== 0) {
    fail(
      `${context}: the staged workspace is valid and the inventory parses ` +
        `no sources, so the answer is finding-free — findings [] (SPEC ` +
        `11.6, 12.7); got ${String(findings.length)} finding(s), first: ` +
        `${JSON.stringify(findings[0]?.message)}`,
    );
  }
  const anchoring = decodeInventoryAnchoring(doc, context);
  assertAnchoringMember(anchoring.root, expected.root, "`root`", form, context);
  assertAnchoringMember(
    anchoring.config,
    expected.config,
    "`config`",
    form,
    context,
  );
  return result;
}

// --- the arm ------------------------------------------------------------------

test(
  "T11.6-1 drive-mismatch arm (Windows leg, E-6): with the working directory on a substituted drive and the workspace root on another drive letter, `inventory` reports the anchoring in the platform's absolute, drive-qualified spelling — the sole absolute-path case and sole platform-separator output — byte-exact, deterministic per invocation, the answer complete and finding-free at exit 0; same-drive premise first: from the workspace root the anchoring stays the relative `.`/`xspec.config.ts` (SPEC 11.6, 12.0, 11; TEST-SPEC E-6)",
  { timeout: DEFAULT_PRODUCT_TEST_TIMEOUT_MS },
  async () => {
    selfCheckPlatformSpellingRule();
    const product = builtProductBinding();
    const workspace = await TestWorkspace.create({
      files: {
        [CONFIG_FILE]: ANCHOR_CONFIG,
        "specs/a.mdx": ANCHOR_SOURCE,
      },
    });
    try {
      // --- same-drive premise arm, any platform: the workspace stages and
      // the product answers `inventory` with the canonical relative
      // anchoring (the registered T11.6-1 body's first arm). Against a stub
      // or nonconforming product this fails first, diagnosed, before any
      // platform-only staging is attempted — so the platform gate below can
      // only mean "the product works, the platform cannot stage the arm" —
      // and on the Windows leg it is the arm's discriminating contrast: the
      // same workspace anchors relatively until the drives differ.
      await expectAnchoredInventory(
        product,
        workspace.root,
        ["inventory"],
        { root: ".", config: CONFIG_FILE },
        "the canonical relative spelling from the invocation working " +
          "directory — the working directory itself spelled `.`, the " +
          "configuration file the pure descent (SPEC 11.6): a drive " +
          "mismatch is the sole case that ever departs from it",
        "T11.6-1 (E-6 drive-mismatch premise) — `inventory` from the " +
          "workspace root: the same-drive anchoring is the relative form " +
          "(SPEC 11.6)",
      );

      // --- platform gate: the mismatch stages only on Windows (H-9 — a
      // loud error, never a skip, never a vacuous pass).
      if (process.platform !== "win32") {
        throw new Error(
          `E-6 drive-mismatch arm: the product answers \`inventory\` (the ` +
            `premise arm passed), but the drive-mismatch staging — a ` +
            `substituted drive mapping (\`subst\`) — exists only on ` +
            `Windows; this arm runs on the Windows CI leg (TEST-SPEC E-6). ` +
            `Failing loudly rather than passing vacuously (H-9); every ` +
            `platform-portable Windows-subset assertion lives in ` +
            `e6-subset.test.ts and e6-byte-identity.test.ts.`,
        );
      }

      // --- stage the mismatch: cwd on a substituted drive letter, the
      // workspace root untouched on the real volume. The expectation is the
      // canonical native spelling of the root (realpath.native: long-name,
      // drive-qualified, backslash-separated), the `--config` argument the
      // same spelling of the configuration file — so the identified file
      // and the expected output are one canonical form, whatever
      // canonicalization the product applies (pure invocation input, never
      // an argument echo, SPEC 11.6, 12.0).
      const physicalRoot = await realpathNative(workspace.root);
      const rootDrive = driveLetterOf(physicalRoot, "the workspace root");
      const expectedRoot = physicalRoot;
      const expectedConfig = path.win32.join(physicalRoot, CONFIG_FILE);
      const mountDir = path.join(workspace.tempRoot, "lecteur");
      await fsp.mkdir(mountDir);
      const drive = await claimSubstDrive(mountDir);
      try {
        if (drive.letter.toUpperCase() === rootDrive.toUpperCase()) {
          throw new Error(
            `E-6 drive-mismatch staging: the claimed substituted letter ` +
              `${drive.letter}: equals the workspace root's drive — no ` +
              `mismatch staged (\`subst\` should refuse an in-use ` +
              `letter). A staging defect, not a product failure.`,
          );
        }
        selfCheckComputedPlatformSpelling(
          expectedRoot,
          drive.letter,
          "the expected `root`",
        );
        selfCheckComputedPlatformSpelling(
          expectedConfig,
          drive.letter,
          "the expected `config`",
        );

        const argv = ["inventory", "--config", expectedConfig];
        const form =
          `the platform's absolute, drive-qualified spelling: the working ` +
          `directory ${drive.root} is a substituted drive mapping and the ` +
          `workspace root sits on drive ${rootDrive}:, so the platform ` +
          `admits no relative path between them — the sole absolute-path ` +
          `case and the sole output spelling whose separator is the ` +
          `platform's (SPEC 11.6, 12.0; TEST-SPEC E-6)`;
        const context =
          `T11.6-1 (E-6 drive-mismatch arm) — \`inventory --config\` from ` +
          `${drive.root}, the root of a substituted drive, with the ` +
          `workspace root on drive ${rootDrive}:`;
        const first = await expectAnchoredInventory(
          product,
          drive.root,
          argv,
          { root: expectedRoot, config: expectedConfig },
          form,
          context,
        );
        const second = await expectAnchoredInventory(
          product,
          drive.root,
          argv,
          { root: expectedRoot, config: expectedConfig },
          form,
          `${context} — repeated invocation`,
        );
        assertBytesEqual(
          second.stdoutBytes,
          first.stdoutBytes,
          "T11.6-1 (E-6 drive-mismatch arm) — the platform-absolute " +
            "anchoring is invocation-anchored content: a pure function of " +
            "invocation input, deterministic per invocation, so repeating " +
            "the identical invocation from the identical working directory " +
            "yields byte-identical stdout (SPEC 12.0, 11.6; a " +
            "product-to-itself comparison, H-4)",
        );
      } finally {
        await drive.release();
      }
    } finally {
      await workspace.dispose();
    }
  },
);
