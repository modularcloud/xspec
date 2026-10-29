// Self-checks for E-1's Node.js releases, read on the harness side (TEST-SPEC
// 17 preamble: internal self-tests cover harness machinery certification
// does not exercise; E-1, H-11, H-9, S-10; helpers/node-releases.ts). The
// module channel's runtime arms (T7.6-6, T7.6-7, P-17) run on the releases
// E-1 lists, which the environment provisions before the run and the
// harness finds under XSPEC_NODE_RELEASES_DIR; a listed release left
// unprovisioned is a harness error for every run needing it, never a skip
// or a product failure. Asserted here, on stand-in directories alone, so
// the file passes alike with the variable set (CI's harness-self job,
// which provisions the releases) and unset:
// - test/node-releases.json, the one copy CI's provisioning and the harness
//   both read, found relative to the module, lists exactly the releases
//   E-1's rule yielded when set on 2026-10-29, in order — pinned, so a
//   change goes through the normal change process, with E-1;
// - the list is read strictly: anything but a JSON object holding a
//   `releases` array of exact versions, at least one and none twice, beside
//   at most a string `comment`, is refused, naming the list;
// - the variable is read by the call resolving a release, never at import
//   (this file imports the module whatever the environment holds): unset,
//   empty, relative, or naming no directory, it is the harness error naming
//   the variable; a stand-in directory missing one listed release, or
//   holding one whose executable is no file or is not executable, fails the
//   whole list's resolution and that release's own, naming the release and
//   the path looked at, while every provisioned release still resolves; a
//   version the list does not hold is refused even where a directory holds
//   it; every such error is a `NodeReleaseError`, never a
//   `HarnessAssertionError` (a diagnosed product failure) and never an
//   empty answer;
// - a directory of stand-in executables resolves every release in list
//   order, each at `<directory>/v<version>/bin/node`.
// Whether a provisioned executable is the release it names — the version
// the running process reports — is S-10's check, made by running it.

import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, onTestFinished, test, vi } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import {
  NODE_RELEASE_LIST_PATH,
  NODE_RELEASES_DIR_VARIABLE,
  NodeReleaseError,
  parseNodeReleaseList,
  readNodeReleaseList,
  resolveNodeRelease,
  resolveNodeReleases,
} from "../helpers/node-releases.js";
import type { NodeReleaseFault } from "../helpers/node-releases.js";

/**
 * E-1's list as its rule yielded it, set on 2026-10-29 (TEST-SPEC E-1):
 * 22.0.0, the 22 line's first release; 22.11.0, the last on which
 * `require` cannot load an ES module without a flag; 22.12.0, the first on
 * which it can; 22.23.4, the line's newest; and the newest of each later
 * line still supported upstream, 24 and 26.
 */
const E1_RELEASES = [
  "22.0.0",
  "22.11.0",
  "22.12.0",
  "22.23.4",
  "24.22.2",
  "26.13.0",
] as const;

/** A stand-in release executable: a script that does nothing. */
const STAND_IN_EXECUTABLE = `#!/bin/sh
exit 0
`;

/** A fresh, empty directory of this test's own, removed once it ends. */
async function freshDirectory(): Promise<string> {
  const directory = await fsp.mkdtemp(
    path.join(os.tmpdir(), "xspec-node-releases-"),
  );
  onTestFinished(() => fsp.rm(directory, { recursive: true, force: true }));
  return directory;
}

/** Where a release's executable lies under `directory`. */
function executableUnder(directory: string, version: string): string {
  return path.join(directory, `v${version}`, "bin", "node");
}

/**
 * A directory — `into`, else a fresh one — holding a stand-in executable,
 * mode 0755, for each of `versions` where the provisioning script installs
 * it.
 */
async function standInReleases(
  versions: readonly string[],
  into?: string,
): Promise<string> {
  const directory = into ?? (await freshDirectory());
  for (const version of versions) {
    const executable = executableUnder(directory, version);
    await fsp.mkdir(path.dirname(executable), { recursive: true });
    await fsp.writeFile(executable, STAND_IN_EXECUTABLE);
    await fsp.chmod(executable, 0o755);
  }
  return directory;
}

/** The environment naming `directory` as the releases' directory. */
function naming(directory: string): Record<string, string> {
  return { [NODE_RELEASES_DIR_VARIABLE]: directory };
}

/** What `run` threw (a test failure naming `what` where it threw nothing). */
function thrownBy(run: () => unknown, what: string): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error(`expected ${what} to throw, got a return`);
}

/** What `pending` rejected with (a test failure where it resolved). */
async function rejectionOf(pending: Promise<unknown>): Promise<unknown> {
  try {
    await pending;
  } catch (error) {
    return error;
  }
  throw new Error("expected a rejection, got a resolution");
}

/**
 * `error` is the harness error of `fault` (never a diagnosed product
 * failure) whose message matches `pattern` and names every one of `names`.
 */
function expectReleaseError(
  error: unknown,
  fault: NodeReleaseFault,
  pattern: RegExp,
  names: readonly string[] = [],
): NodeReleaseError {
  expect(error).toBeInstanceOf(NodeReleaseError);
  expect(error).not.toBeInstanceOf(HarnessAssertionError);
  const releaseError = error as NodeReleaseError;
  expect(releaseError.fault, releaseError.message).toBe(fault);
  expect(releaseError.message).toMatch(/^harness error [(]H-11[)]: /);
  expect(releaseError.message).toMatch(pattern);
  for (const name of names) expect(releaseError.message).toContain(name);
  return releaseError;
}

test("E-1's release list: test/node-releases.json, found relative to the harness module, lists exactly the releases E-1's rule yielded when set on 2026-10-29 — 22.0.0, 22.11.0, 22.12.0, 22.23.4, 24.22.2, 26.13.0 — in order", async () => {
  expect(NODE_RELEASE_LIST_PATH).toBe(
    fileURLToPath(new URL("../node-releases.json", import.meta.url)),
  );
  expect(path.isAbsolute(NODE_RELEASE_LIST_PATH)).toBe(true);
  expect(await readNodeReleaseList()).toEqual(E1_RELEASES);
});

test("E-1's release list is read strictly: anything but one JSON object holding a `releases` array of exact major.minor.patch versions, at least one and none twice, beside at most a string `comment`, is the harness error naming the list — never a shorter list", async () => {
  const source = "/stand-in/node-releases.json";
  expect(parseNodeReleaseList('{"releases":["1.2.3"]}', source)).toEqual([
    "1.2.3",
  ]);
  expect(
    parseNodeReleaseList(
      '{"comment":"a note","releases":["0.0.0","10.20.30","22.0.0"]}',
      source,
    ),
  ).toEqual(["0.0.0", "10.20.30", "22.0.0"]);
  const refusals: readonly (readonly [string, RegExp])[] = [
    ["", /is not JSON/],
    ['{"releases":["22.0.0"]', /is not JSON/],
    ["[]", /not a JSON object/],
    ["null", /not a JSON object/],
    ['"22.0.0"', /not a JSON object/],
    ["{}", /holds no "releases"/],
    ['{"comment":"a note"}', /holds no "releases"/],
    ['{"releases":"22.0.0"}', /as its "releases", not an array/],
    ['{"releases":{"0":"22.0.0"}}', /as its "releases", not an array/],
    ['{"releases":[]}', /lists no release/],
    ['{"releases":[22]}', /lists 22 as release 1, not an exact/],
    ['{"releases":[null]}', /lists null as release 1, not an exact/],
    ['{"releases":["22.0.0","22"]}', /lists "22" as release 2, not an exact/],
    ['{"releases":["22.0"]}', /not an exact/],
    ['{"releases":["22.0.0.1"]}', /not an exact/],
    ['{"releases":["v22.0.0"]}', /not an exact/],
    ['{"releases":["22.0.0-rc.1"]}', /not an exact/],
    ['{"releases":["22.x.0"]}', /not an exact/],
    ['{"releases":["022.0.0"]}', /not an exact/],
    ['{"releases":["22.00.0"]}', /not an exact/],
    ['{"releases":[" 22.0.0"]}', /not an exact/],
    ['{"releases":["22.0.0 "]}', /not an exact/],
    [
      '{"releases":["22.0.0","24.0.0","22.0.0"]}',
      /lists the release 22[.]0[.]0 twice/,
    ],
    ['{"releases":["22.0.0"],"release":["24.0.0"]}', /holds the key "release"/],
    ['{"releases":["22.0.0"],"comment":1}', /holds 1 as its "comment"/],
  ];
  for (const [text, pattern] of refusals) {
    const error = expectReleaseError(
      thrownBy(
        () => parseNodeReleaseList(text, source),
        `reading the list ${JSON.stringify(text)}`,
      ),
      "list",
      pattern,
      [source],
    );
    expect(error.releases).toEqual([]);
  }
  // A list that cannot be read is the same harness error.
  const directory = await freshDirectory();
  const absent = path.join(directory, "node-releases.json");
  expectReleaseError(
    await rejectionOf(readNodeReleaseList(absent)),
    "list",
    /cannot be read [(]ENOENT/,
    [absent],
  );
  expectReleaseError(
    await rejectionOf(resolveNodeReleases({ listPath: absent })),
    "list",
    /cannot be read [(]ENOENT/,
    [absent],
  );
});

test("XSPEC_NODE_RELEASES_DIR unset, empty, relative, or naming no directory is the harness error naming the variable, for one release's resolution and the whole list's alike — never a skip, an empty answer, or a diagnosed failure", async () => {
  const scratch = await freshDirectory();
  const absent = path.join(scratch, "absent");
  const file = path.join(scratch, "file");
  await fsp.writeFile(file, "");
  const cases: readonly (readonly [
    Readonly<Record<string, string | undefined>>,
    RegExp,
    readonly string[],
  ])[] = [
    [{}, /XSPEC_NODE_RELEASES_DIR is unset/, []],
    [
      { [NODE_RELEASES_DIR_VARIABLE]: undefined },
      /XSPEC_NODE_RELEASES_DIR is unset/,
      [],
    ],
    [naming(""), /XSPEC_NODE_RELEASES_DIR is empty/, []],
    [
      naming("node-releases"),
      /XSPEC_NODE_RELEASES_DIR is "node-releases", not an absolute path/,
      [],
    ],
    [naming(absent), /names no directory [(]ENOENT/, [absent]],
    [naming(file), /names a file, not a directory/, [file]],
  ];
  for (const [environment, pattern, names] of cases) {
    const whole = expectReleaseError(
      await rejectionOf(resolveNodeReleases({ environment })),
      "directory",
      pattern,
      [NODE_RELEASES_DIR_VARIABLE, ...names, ...E1_RELEASES],
    );
    expect(whole.releases).toEqual([]);
    expectReleaseError(
      await rejectionOf(resolveNodeRelease("22.11.0", { environment })),
      "directory",
      pattern,
      [NODE_RELEASES_DIR_VARIABLE, "the Node.js release 22.11.0", ...names],
    );
  }
});

test("the variable is read from the process environment by the call resolving a release, never at import: unset there, the call fails naming it; set there, the call resolves under it", async () => {
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
  vi.stubEnv(NODE_RELEASES_DIR_VARIABLE, undefined);
  expectReleaseError(
    await rejectionOf(resolveNodeReleases()),
    "directory",
    /XSPEC_NODE_RELEASES_DIR is unset/,
  );
  expectReleaseError(
    await rejectionOf(resolveNodeRelease("26.13.0")),
    "directory",
    /XSPEC_NODE_RELEASES_DIR is unset/,
  );
  const directory = await standInReleases(E1_RELEASES);
  vi.stubEnv(NODE_RELEASES_DIR_VARIABLE, directory);
  expect(await resolveNodeRelease("26.13.0")).toEqual({
    version: "26.13.0",
    executable: executableUnder(directory, "26.13.0"),
  });
  expect(
    (await resolveNodeReleases()).map((release) => release.version),
  ).toEqual(E1_RELEASES);
});

test("a stand-in directory missing one listed release is the harness error naming that release and the path looked at, for the whole list's resolution and that release's own, while each provisioned release still resolves", async () => {
  const missing = "22.12.0";
  const provisioned = E1_RELEASES.filter((version) => version !== missing);
  const directory = await standInReleases(provisioned);
  const environment = naming(directory);
  const lookedAt = executableUnder(directory, missing);
  const whole = expectReleaseError(
    await rejectionOf(resolveNodeReleases({ environment })),
    "release",
    /the Node.js release 22[.]12[.]0 is not provisioned under XSPEC_NODE_RELEASES_DIR=/,
    [directory, `${lookedAt} is absent (ENOENT`],
  );
  expect(whole.releases).toEqual([missing]);
  const own = expectReleaseError(
    await rejectionOf(resolveNodeRelease(missing, { environment })),
    "release",
    /the Node.js release 22[.]12[.]0 is not provisioned/,
    [lookedAt],
  );
  expect(own.releases).toEqual([missing]);
  for (const version of provisioned) {
    expect(await resolveNodeRelease(version, { environment })).toEqual({
      version,
      executable: executableUnder(directory, version),
    });
  }
});

test("a listed release whose executable is no file, or a file not executable, is not provisioned: the harness error names each such release and the path looked at", async () => {
  const directory = await standInReleases(
    E1_RELEASES.filter(
      (version) => version !== "22.0.0" && version !== "24.22.2",
    ),
  );
  const environment = naming(directory);
  // 22.0.0's bin/node is a directory; 24.22.2's a file of mode 0644.
  const directoryInstead = executableUnder(directory, "22.0.0");
  await fsp.mkdir(directoryInstead, { recursive: true });
  const notExecutable = executableUnder(directory, "24.22.2");
  await fsp.mkdir(path.dirname(notExecutable), { recursive: true });
  await fsp.writeFile(notExecutable, STAND_IN_EXECUTABLE);
  await fsp.chmod(notExecutable, 0o644);
  const whole = expectReleaseError(
    await rejectionOf(resolveNodeReleases({ environment })),
    "release",
    /the Node.js releases 22[.]0[.]0, 24[.]22[.]2 are not provisioned/,
    [
      `${directoryInstead} is a directory, not a file`,
      `${notExecutable} is not executable by this process (EACCES`,
    ],
  );
  expect(whole.releases).toEqual(["22.0.0", "24.22.2"]);
  expectReleaseError(
    await rejectionOf(resolveNodeRelease("22.0.0", { environment })),
    "release",
    /is a directory, not a file/,
    [directoryInstead],
  );
  expectReleaseError(
    await rejectionOf(resolveNodeRelease("24.22.2", { environment })),
    "release",
    /is not executable by this process/,
    [notExecutable],
  );
});

test("a version E-1's list does not hold is refused, naming it, even where the directory holds it: no run exercises an unlisted release", async () => {
  const directory = await standInReleases([...E1_RELEASES, "22.1.0"]);
  const environment = naming(directory);
  for (const version of ["22.1.0", "v22.0.0", "22"]) {
    const error = expectReleaseError(
      await rejectionOf(resolveNodeRelease(version, { environment })),
      "list",
      /is not listed in E-1's release list/,
      [`the Node.js release ${version}`, NODE_RELEASE_LIST_PATH],
    );
    expect(error.releases).toEqual([version]);
  }
});

test("a directory of stand-in executables resolves every release E-1 lists, in list order, each at <directory>/v<version>/bin/node", async () => {
  const directory = await standInReleases(E1_RELEASES);
  const releases = await resolveNodeReleases({
    environment: naming(directory),
  });
  expect(releases).toEqual(
    E1_RELEASES.map((version) => ({
      version,
      executable: executableUnder(directory, version),
    })),
  );
  // Named through a symbolic link to it, a directory still: each executable
  // as spelled through the link. Link and directory share a fresh directory.
  const scratch = await freshDirectory();
  const target = path.join(scratch, "provisioned");
  await fsp.mkdir(target);
  await standInReleases(E1_RELEASES, target);
  const link = path.join(scratch, "releases");
  await fsp.symlink(target, link);
  expect(await resolveNodeReleases({ environment: naming(link) })).toEqual(
    E1_RELEASES.map((version) => ({
      version,
      executable: executableUnder(link, version),
    })),
  );
});
