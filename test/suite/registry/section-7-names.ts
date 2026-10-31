// TEST-SPEC §7 configured names — T7-11 (SPEC 7, 7.4, 7.5, 8.2, 11.6, 12.0,
// 12.7, 14). Configuration basics (T7-1…T7-3, T7-7) live in
// section-7-basics.ts, discovery (T7-4…T7-6, T7-8) in
// section-7-discovery.ts, the configuration's import (T7-9, T7-10) in
// section-7-import.ts, and profile and rule validation (T7.4-1, T7.5-1) in
// section-7.4-7.5.ts.
//
// Registered product-facing body (C-2 "one code path"): each arm builds its
// own fresh workspace (H-1), drives the product strictly as a subprocess
// (H-2), asserts exact exit codes (H-5), decodes reports through the H-3
// adapters, and rejects a product only via diagnosed assertion failures
// (H-8).
//
// SPEC 7 bars a group, profile, or rule name only when it is empty or
// contains U+FFFD, so the members of TypeScript's global `Object` interface
// and `__proto__`, which 7.6 spells out, are names like any other. Each arm
// fails a product that looks configured names up in a plain object, where
// `constructor` and `__proto__` name inherited members — a lookup finds a
// group or profile nobody configured, and an assignment keyed `__proto__`
// replaces the object's prototype instead of adding a member — and a group
// named `hasOwnProperty` shadows the method such a product calls on that
// object; (a)'s and (c)'s identifier-key spellings of `__proto__` also fail
// a product reading an identifier key through TypeScript's escaped
// identifier text, which prefixes a third underscore to a name beginning
// with two.
//
// The arms, each on an otherwise valid workspace (TEST-SPEC T7-11):
//
// (a) Groups (`T7_11_A_ARMS`, eight arms): a spec group named `__proto__` —
//     spelled once as an identifier key and once as a string-literal key —
//     one named `constructor`, and one named `hasOwnProperty`, each
//     globbing `specs/*.mdx` over `specs/A.mdx`; and code groups so named,
//     in the same four spellings, each globbing `src/*.ts` over `src/a.ts`
//     beside no spec group (`specs: {}`, valid with zero sources, SPEC 7, the
//     shape T7-4's literal-backslash arm stages), so that each workspace
//     holds exactly what its arm names. `build --json` and `check --json`
//     exit 0 finding-free (12.7's `{"findings": []}`), and `inventory
//     --json` exits 0 reporting the group under its name with its glob, the
//     other group list empty, and its one source in it: `sources` exactly
//     one `{"path", "groups"}` entry whose one membership is the group's
//     `{"name", "kind"}` (11.6, 12.7).
// (b) A profile and a rule (`T7_11_B_CONFIG`): a profile named `toString`
//     (target `product`, boundary `tests`, mode `direct`) and a `forbidden`
//     rule named `toString` from `{ group: "tests" }` to `{ group:
//     "product" }`, over the one depends edge `tests/T.mdx#t` →
//     `specs/A.mdx#a`, which the rule forbids. `build --json` exits 0
//     finding-free (build evaluates no policy, 12.1); `inventory --json`
//     reports both with their complete definitions in 12.7's resolved view,
//     every default and inferred kind explicit (`targetTags` null, `targets`
//     "leaves", `boundaryKind` "spec", both selectors' kinds "spec", both
//     kind sets all three kinds in 5.2's order); `coverage toString --json`
//     exits 0 reporting exactly that profile, `specs/A.mdx#a` covered over
//     the path [`tests/T.mdx#t`, `specs/A.mdx#a`] and nothing uncovered
//     (8.2: `coverage <name>` runs one profile); and `check --json` exits 1
//     with exactly one finding, 14.12's, its identities the rule's name
//     `toString` and the edge's source, kind token, and target, `locations`
//     [] and `path` null (14.12, 12.7).
// (c) References (`T7_11_C_ARMS`, six arms of two workspaces each): a
//     profile's `target`, its `boundary`, and a rule's selector `group` (its
//     `from`), each naming `__proto__` and, separately, `constructor` —
//     TEST-SPEC's "each naming `__proto__` or `constructor`, one arm each"
//     read as one arm per reference and name. With a spec group of that name
//     configured — keyed by its identifier spelling, in place of the neutral
//     group (`product` or `tests`) the reference names in the other arms —
//     the reference resolves: `build --json` exits 0 finding-free, and the
//     profile's coverage is reported (`coverage --json`: profile `p`,
//     `specs/A.mdx#a` covered over [`tests/T.mdx#t`, `specs/A.mdx#a`],
//     nothing uncovered) or the rule evaluated (`check --json`: the one
//     14.12 finding of rule `r` on that edge). With none — the same
//     configuration with that group keyed by its neutral name, so the
//     reference is the workspace's only defect — the reference names an
//     unknown group, 14.14: `build` exits 2 with the 12.7 error document
//     whose one finding carries `configuration-error`, `path`
//     `xspec.config.ts`, and `locations` [], and writes nothing (the
//     contract section-7.4-7.5.ts's `expectConfigRefused` holds T7.4-1's
//     and T7.5-1's unknown references to).
// (d) Unknown profiles (`runUnknownProfileArms`): on a workspace configuring
//     one profile, `p`, whose `coverage p --json` answers first (exit 0, the
//     profile reported as in (c) — the premise that the surface answers a
//     configured name), `coverage constructor --json` and `coverage
//     __proto__ --json`, one arm each, name an unknown profile: the plain
//     usage error of 12.0 — exit 2, the 12.7 error document with `code` and
//     `path` null and no locations, a standard-error message (support.ts
//     `expectPlainUsageError`).
//
// Every arm runs: each arm's diagnosed failure (a `HarnessAssertionError`,
// its message naming the arm) is collected, and the body fails once at the
// end naming every failed arm; a harness error or a hang propagates at once
// (section-7-import.ts's pattern). Against S-7's empty stub every arm fails
// at its first command.
//
// Staging (S-9's timing clause; helpers/staged-ts.ts, helpers/staged-mdx.ts):
// every configuration and source is a staged-source record made at module
// load — every arm past the first stages its workspace after the body's
// first product invocation — judged by test/self/s9-staged-sources.test.ts
// before any product exists. The three sources (`specs/A.mdx`,
// `tests/T.mdx`, `src/a.ts`) are one record each, named with every arm
// staging them. No staged text needs a backslash, and this source spells
// none.
//
// Certification: T7-11 is in no conformer's scope (CERTIFICATIONS.md); its
// operative assertions are positive — each name reported, resolving, or
// refused as such — so a staging that misses fails loud.

import type { CoverageReport } from "../../helpers/adapters/index.js";
import {
  decodeCoverageReport,
  decodeFindingsReport,
  decodeInventoryDocument,
} from "../../helpers/adapters/index.js";
import {
  HarnessAssertionError,
  fail,
  parseJsonStdout,
} from "../../helpers/assertions.js";
import { defineProductTest } from "../../helpers/registry.js";
import type { ProductTestEntry } from "../../helpers/registry.js";
import {
  assertSnapshotsEqual,
  snapshotDirectory,
} from "../../helpers/snapshot.js";
import { type StagedMdx, stagedMdx } from "../../helpers/staged-mdx.js";
import { type StagedTs, stagedTs } from "../../helpers/staged-ts.js";
import type { ProductBinding } from "../../helpers/subprocess.js";
import { TestWorkspace } from "../../helpers/workspace.js";
import type { InitialFileContents } from "../../helpers/workspace.js";
import {
  assertConditionCounts,
  assertSameJson,
  expectConfigurationError,
  expectErrorDocument,
  expectExit,
  expectFindingFreeReport,
  expectPlainUsageError,
  runJson,
} from "./support.js";

// ---------------------------------------------------------------------------
// Shared fixture material
// ---------------------------------------------------------------------------

/** U+000A, built from its code point (module header: no escape spelled). */
const LINE_FEED = String.fromCodePoint(0x0a);

/** The configuration file every arm stages at the workspace root. */
const CONFIG_PATH = "xspec.config.ts";

/** The spec glob of (a)'s spec groups and of (b)–(d)'s group `product`. */
const SPEC_GLOB = "specs/*.mdx";
/** The spec glob of (b)–(d)'s group `tests`. */
const TESTS_GLOB = "tests/*.mdx";
/** The code glob of (a)'s code groups. */
const CODE_GLOB = "src/*.ts";

/** Every arm's spec source but (a)'s code-group arms': one section, `a`. */
const SPEC_A_PATH = "specs/A.mdx";
const SPEC_A_SOURCE: StagedMdx = stagedMdx(
  "T7-11 specs/A.mdx (one section a; (a)'s spec-group arms, (b), (c), and (d))",
  `<S id="a">
Requirement a.
</S>
`,
);

/** (b)–(d)'s second spec source: section `t`, depending on `a`. */
const TESTS_T_PATH = "tests/T.mdx";
const TESTS_T_SOURCE: StagedMdx = stagedMdx(
  "T7-11 tests/T.mdx (section t, its d prop depending on specs/A.mdx#a; " +
    "(b), (c), and (d))",
  `import A from "../specs/A.xspec"

<S id="t" d={A.a}>
Depends on requirement a.
</S>
`,
);

/** (a)'s code-group arms' one code source. */
const SRC_A_PATH = "src/a.ts";
const SRC_A_SOURCE: StagedTs = stagedTs(
  "T7-11 src/a.ts (the code source of (a)'s code-group arms)",
  `export const a = 1;
`,
);

/** The requirement node every profile's target set holds: `a`. */
const NODE_A = "specs/A.mdx#a";
/** The boundary node whose depends edge covers `a`, and offends a rule. */
const NODE_T = "tests/T.mdx#t";

/**
 * The one dependency edge (b)–(d)'s workspace holds, as 14.12's identities
 * name it after the rule's name: the source, the kind token, the target.
 */
const EDGE_IDENTITIES: readonly string[] = [NODE_T, "depends", NODE_A];

/** A configuration file: the import, then the default export over `body`. */
function configText(body: string): string {
  return `import { defineConfig } from "xspec"

export default defineConfig({
${body}
})
`;
}

/** (b)–(d)'s workspace: the configuration beside `specs/A.mdx` and `tests/T.mdx`. */
function graphFiles(
  config: StagedTs,
): Readonly<Record<string, InitialFileContents>> {
  return {
    [CONFIG_PATH]: config,
    [SPEC_A_PATH]: SPEC_A_SOURCE,
    [TESTS_T_PATH]: TESTS_T_SOURCE,
  };
}

// ---------------------------------------------------------------------------
// (a) Groups named by `Object` members and `__proto__`
// ---------------------------------------------------------------------------

type GroupKind = "spec" | "code";

/** One spelling of a configured group's key (TEST-SPEC T7-11(a)). */
interface GroupKeySpelling {
  /** The group's name. */
  readonly name: string;
  /** The key exactly as the configuration spells it. */
  readonly key: string;
  /** The spelling, in words, for labels. */
  readonly spelled: string;
}

const GROUP_KEY_SPELLINGS: readonly GroupKeySpelling[] = [
  { name: "__proto__", key: "__proto__", spelled: "an identifier key" },
  { name: "__proto__", key: '"__proto__"', spelled: "a string-literal key" },
  { name: "constructor", key: "constructor", spelled: "an identifier key" },
  {
    name: "hasOwnProperty",
    key: "hasOwnProperty",
    spelled: "an identifier key",
  },
];

/** One (a) arm: a group of `kind` named by an `Object` member or `__proto__`. */
interface GroupArm {
  readonly label: string;
  readonly kind: GroupKind;
  readonly name: string;
  readonly glob: string;
  readonly sourcePath: string;
  readonly files: Readonly<Record<string, InitialFileContents>>;
}

/** The `defineConfig` argument of one (a) arm: the one group, keyed `key`. */
function groupArmBody(kind: GroupKind, key: string): string {
  if (kind === "spec") {
    return `  specs: {
    ${key}: ["${SPEC_GLOB}"]
  }`;
  }
  return `  specs: {},
  code: {
    ${key}: ["${CODE_GLOB}"]
  }`;
}

const T7_11_A_ARMS: readonly GroupArm[] = (["spec", "code"] as const).flatMap(
  (kind) =>
    GROUP_KEY_SPELLINGS.map((spelling): GroupArm => {
      const label =
        "the " +
        kind +
        " group " +
        JSON.stringify(spelling.name) +
        ", " +
        spelling.spelled;
      const sourcePath = kind === "spec" ? SPEC_A_PATH : SRC_A_PATH;
      return {
        label,
        kind,
        name: spelling.name,
        glob: kind === "spec" ? SPEC_GLOB : CODE_GLOB,
        sourcePath,
        files: {
          [CONFIG_PATH]: stagedTs(
            "T7-11 xspec.config.ts ((a): " + label + ")",
            configText(groupArmBody(kind, spelling.key)),
          ),
          [sourcePath]: kind === "spec" ? SPEC_A_SOURCE : SRC_A_SOURCE,
        },
      };
    }),
);

// ---------------------------------------------------------------------------
// (b) A profile and a rule both named `toString`
// ---------------------------------------------------------------------------

/** (b)'s profile and rule name. */
const TO_STRING = "toString";

const T7_11_B_CONFIG: StagedTs = stagedTs(
  "T7-11 xspec.config.ts ((b): a profile and a forbidden rule both named " +
    "toString)",
  configText(`  specs: {
    product: ["${SPEC_GLOB}"],
    tests: ["${TESTS_GLOB}"]
  },
  coverage: [
    {
      name: "${TO_STRING}",
      target: "product",
      boundary: "tests",
      mode: "direct"
    }
  ],
  policy: [
    {
      name: "${TO_STRING}",
      type: "forbidden",
      from: { group: "tests" },
      to: { group: "product" }
    }
  ]`),
);

/** Every dependency kind, the kind set's 12.7 form (5.2's order). */
const ALL_DEPENDENCY_KINDS: readonly string[] = [
  "depends",
  "embeds",
  "references",
];

/**
 * (b)'s profile in 12.7's resolved view, every default and inferred kind
 * explicit (11.6), its members in the order the form-exact decoder builds
 * them (forms.ts `decodeCoverageProfileView`).
 */
const T7_11_B_PROFILE_VIEW = {
  name: TO_STRING,
  target: "product",
  targetTags: null,
  targets: "leaves",
  boundary: "tests",
  boundaryKind: "spec",
  mode: "direct",
  edgeKinds: ALL_DEPENDENCY_KINDS,
};

/** (b)'s rule in 12.7's resolved view (forms.ts `decodePolicyRuleView`). */
const T7_11_B_RULE_VIEW = {
  name: TO_STRING,
  type: "forbidden",
  from: { group: "tests", kind: "spec" },
  to: { group: "product", kind: "spec" },
  kinds: ALL_DEPENDENCY_KINDS,
};

// ---------------------------------------------------------------------------
// (c) References naming `__proto__` and `constructor`
// ---------------------------------------------------------------------------

type ReferenceSite = "target" | "boundary" | "selector";

/** The reference, in words, for labels. */
function referenceSiteWords(site: ReferenceSite): string {
  switch (site) {
    case "target":
      return "a profile's target";
    case "boundary":
      return "a profile's boundary";
    case "selector":
      return "a rule's selector group (its from)";
  }
}

/** One (c) arm: the reference and the name, configured and not. */
interface ReferenceArm {
  readonly label: string;
  readonly site: ReferenceSite;
  readonly name: string;
  /** A spec group of that name configured: the reference resolves. */
  readonly resolving: Readonly<Record<string, InitialFileContents>>;
  /** No group of that name: the reference names an unknown group (14.14). */
  readonly unknown: Readonly<Record<string, InitialFileContents>>;
}

/**
 * The `defineConfig` argument of one (c) workspace: the spec groups
 * `product` (`specs/*.mdx`) and `tests` (`tests/*.mdx`) — the group the
 * reference names keyed `name` instead where `configured` — and the profile
 * `p` (target `product`, boundary `tests`) or the forbidden rule `r` (from
 * `tests` to `product`), its referencing field naming `name`.
 */
function referenceArmBody(
  site: ReferenceSite,
  name: string,
  configured: boolean,
): string {
  const productKey = site === "target" && configured ? name : "product";
  const testsKey = site !== "target" && configured ? name : "tests";
  const groups = `  specs: {
    ${productKey}: ["${SPEC_GLOB}"],
    ${testsKey}: ["${TESTS_GLOB}"]
  },`;
  if (site === "selector") {
    return `${groups}
  policy: [
    {
      name: "r",
      type: "forbidden",
      from: { group: "${name}" },
      to: { group: "product" }
    }
  ]`;
  }
  const target = site === "target" ? name : "product";
  const boundary = site === "boundary" ? name : "tests";
  return `${groups}
  coverage: [
    {
      name: "p",
      target: "${target}",
      boundary: "${boundary}",
      mode: "direct"
    }
  ]`;
}

/** (c)'s names, each naming an inherited member of a plain object. */
const REFERENCE_NAMES: readonly string[] = ["__proto__", "constructor"];

const T7_11_C_ARMS: readonly ReferenceArm[] = (
  ["target", "boundary", "selector"] as const
).flatMap((site) =>
  REFERENCE_NAMES.map((name): ReferenceArm => {
    const label = referenceSiteWords(site) + " naming " + JSON.stringify(name);
    return {
      label,
      site,
      name,
      resolving: graphFiles(
        stagedTs(
          "T7-11 xspec.config.ts ((c): " +
            label +
            ", a spec group of that name configured)",
          configText(referenceArmBody(site, name, true)),
        ),
      ),
      unknown: graphFiles(
        stagedTs(
          "T7-11 xspec.config.ts ((c): " + label + ", no group of that name)",
          configText(referenceArmBody(site, name, false)),
        ),
      ),
    };
  }),
);

// ---------------------------------------------------------------------------
// (d) Unknown profiles named `constructor` and `__proto__`
// ---------------------------------------------------------------------------

/** (d)'s configuration: the one profile `p`, no other. */
const T7_11_D_CONFIG: StagedTs = stagedTs(
  "T7-11 xspec.config.ts ((d): the one profile p, none named constructor or " +
    "__proto__)",
  configText(`  specs: {
    product: ["${SPEC_GLOB}"],
    tests: ["${TESTS_GLOB}"]
  },
  coverage: [
    {
      name: "p",
      target: "product",
      boundary: "tests",
      mode: "direct"
    }
  ]`),
);

/** (d)'s profile names, neither configured. */
const UNKNOWN_PROFILE_NAMES: readonly string[] = ["constructor", "__proto__"];

/** T7-11's arm count, for the collected failures' summary. */
const T7_11_ARM_COUNT =
  T7_11_A_ARMS.length +
  1 +
  2 * T7_11_C_ARMS.length +
  UNKNOWN_PROFILE_NAMES.length;

// ---------------------------------------------------------------------------
// Arm runners
// ---------------------------------------------------------------------------

/** Stage a fresh workspace (H-1), run `body`, dispose. */
async function withWorkspace(
  files: Readonly<Record<string, InitialFileContents>>,
  body: (workspace: TestWorkspace) => Promise<void>,
): Promise<void> {
  const workspace = await TestWorkspace.create({ files });
  try {
    await body(workspace);
  } finally {
    await workspace.dispose();
  }
}

/**
 * Run one arm, collecting its diagnosed failure (module header): a
 * `HarnessAssertionError` is recorded and the next arm runs; anything else —
 * a harness error, a hang — propagates at once.
 */
async function collectArmFailure(
  failures: string[],
  arm: () => Promise<void>,
): Promise<void> {
  try {
    await arm();
  } catch (error) {
    if (!(error instanceof HarnessAssertionError)) throw error;
    failures.push(error.message);
  }
}

/**
 * A coverage report holding exactly the profile `name` — the one the
 * workspace configures — whose target group's one leaf `a` is covered over
 * the one depends edge from the boundary group's `t`, nothing uncovered
 * (SPEC 8, 8.1, 8.2). Counts and ignored nodes are T8.2-1's subject.
 */
function assertProfileCoversA(
  report: CoverageReport,
  name: string,
  context: string,
): void {
  assertSameJson(
    report.profiles.map((profile) => ({
      name: profile.name,
      covered: profile.covered.map((row) => ({
        identity: row.identity,
        path: row.path,
      })),
      uncovered: [...profile.uncovered].sort(),
    })),
    [
      {
        name,
        covered: [{ identity: NODE_A, path: [NODE_T, NODE_A] }],
        uncovered: [],
      },
    ],
    context +
      ": the report carries exactly the profile " +
      JSON.stringify(name) +
      ", its target group's one leaf " +
      NODE_A +
      " covered over the one depends edge from the boundary group's " +
      NODE_T +
      " (the covering path [" +
      NODE_T +
      ", " +
      NODE_A +
      "]), nothing uncovered — the profile found under its name and its " +
      "group references resolved (SPEC 7.4, 8, 8.1, 8.2)",
  );
}

/**
 * `check --json` on a freshly built workspace whose one dependency edge the
 * forbidden rule `rule` forbids: exit 1 with exactly one finding, 14.12's —
 * its identities the rule's name and the edge's source, kind token, and
 * target, no location, no concerned path (SPEC 7.5, 14.12, 12.7).
 */
async function expectOneViolation(
  product: ProductBinding,
  workspace: TestWorkspace,
  rule: string,
  context: string,
): Promise<void> {
  const result = await expectExit(
    product,
    workspace,
    ["check", "--json"],
    1,
    context +
      " — the forbidden rule " +
      JSON.stringify(rule) +
      " is evaluated, its one offending edge a finding of check, exit 1 " +
      "(SPEC 7.5, 14.12, 12.0)",
  );
  const findings = decodeFindingsReport(
    parseJsonStdout(result, context),
    context,
  ).findings;
  assertConditionCounts(findings, { "14.12": 1 }, context);
  assertSameJson(
    findings.map((finding) => ({
      locations: finding.locations,
      path: finding.path,
      identities: finding.identities,
    })),
    [{ locations: [], path: null, identities: [rule, ...EDGE_IDENTITIES] }],
    context +
      ": the one policy finding names the rule " +
      JSON.stringify(rule) +
      " and the offending edge — identities in order the rule's name, the " +
      "edge's source, kind token, and target; no in-source location, no " +
      "concerned path (SPEC 7.5, 14.12, 12.7)",
  );
}

/** (a): the group loads, and `inventory` reports it with its one source. */
async function runGroupArm(
  product: ProductBinding,
  arm: GroupArm,
): Promise<void> {
  await withWorkspace(arm.files, async (workspace) => {
    const label = "T7-11(a) (" + arm.label + ")";
    await expectFindingFreeReport(
      product,
      workspace,
      ["build", "--json"],
      label +
        " `build --json` — the configuration loads: 7 bars a group name " +
        "only when it is empty or contains U+FFFD (SPEC 7)",
    );
    await expectFindingFreeReport(
      product,
      workspace,
      ["check", "--json"],
      label + " `check --json` on the freshly built workspace (SPEC 7, 12.2)",
    );
    const inventoryLabel = label + " `inventory --json`";
    const inventory = decodeInventoryDocument(
      await runJson(
        product,
        workspace,
        ["inventory", "--json"],
        inventoryLabel,
      ),
      inventoryLabel,
    );
    const group = { name: arm.name, globs: [arm.glob] };
    assertSameJson(
      {
        specs: inventory.configuration.specs,
        code: inventory.configuration.code,
        sources: inventory.sources,
      },
      {
        specs: arm.kind === "spec" ? [group] : [],
        code: arm.kind === "code" ? [group] : [],
        sources: [
          {
            path: arm.sourcePath,
            groups: [{ name: arm.name, kind: arm.kind }],
          },
        ],
      },
      inventoryLabel +
        ": the " +
        arm.kind +
        " group is reported under its name " +
        JSON.stringify(arm.name) +
        " with its glob " +
        arm.glob +
        ", the other group list empty, and its one discovered source " +
        arm.sourcePath +
        " a member of it — a name like any other (SPEC 7, 11.6, 12.7)",
    );
  });
}

/** (b): a profile and a forbidden rule both named `toString`. */
async function runProfileAndRuleArm(product: ProductBinding): Promise<void> {
  await withWorkspace(graphFiles(T7_11_B_CONFIG), async (workspace) => {
    const label =
      "T7-11(b) (a profile and a forbidden rule both named toString)";
    await expectFindingFreeReport(
      product,
      workspace,
      ["build", "--json"],
      label +
        " `build --json` — the configuration loads, and build evaluates no " +
        "policy (SPEC 7, 7.4, 7.5, 12.1)",
    );
    const inventoryLabel = label + " `inventory --json`";
    const inventory = decodeInventoryDocument(
      await runJson(
        product,
        workspace,
        ["inventory", "--json"],
        inventoryLabel,
      ),
      inventoryLabel,
    );
    assertSameJson(
      {
        coverage: inventory.configuration.coverage,
        policy: inventory.configuration.policy,
      },
      { coverage: [T7_11_B_PROFILE_VIEW], policy: [T7_11_B_RULE_VIEW] },
      inventoryLabel +
        ": the profile and the rule are each reported under the name " +
        "toString with its complete definition, every default and inferred " +
        "kind explicit (SPEC 7, 7.4, 7.5, 11.6, 12.7)",
    );
    const coverageLabel = label + " `coverage toString --json`";
    assertProfileCoversA(
      decodeCoverageReport(
        await runJson(
          product,
          workspace,
          ["coverage", TO_STRING, "--json"],
          coverageLabel,
        ),
        coverageLabel,
      ),
      TO_STRING,
      coverageLabel,
    );
    await expectOneViolation(
      product,
      workspace,
      TO_STRING,
      label + " `check --json`",
    );
  });
}

/** (c), the group configured: the reference resolves. */
async function runReferenceResolvingArm(
  product: ProductBinding,
  arm: ReferenceArm,
): Promise<void> {
  await withWorkspace(arm.resolving, async (workspace) => {
    const label =
      "T7-11(c) (" + arm.label + ", a spec group of that name configured)";
    await expectFindingFreeReport(
      product,
      workspace,
      ["build", "--json"],
      label +
        " `build --json` — the reference resolves, so the configuration " +
        "loads (SPEC 7, " +
        (arm.site === "selector" ? "7.5" : "7.4") +
        ")",
    );
    if (arm.site === "selector") {
      await expectOneViolation(
        product,
        workspace,
        "r",
        label + " `check --json`",
      );
      return;
    }
    const coverageLabel = label + " `coverage --json`";
    assertProfileCoversA(
      decodeCoverageReport(
        await runJson(
          product,
          workspace,
          ["coverage", "--json"],
          coverageLabel,
        ),
        coverageLabel,
      ),
      "p",
      coverageLabel,
    );
  });
}

/** (c), no group of that name: the reference names an unknown group. */
async function runReferenceUnknownArm(
  product: ProductBinding,
  arm: ReferenceArm,
): Promise<void> {
  await withWorkspace(arm.unknown, async (workspace) => {
    const label = "T7-11(c) (" + arm.label + ", no group of that name)";
    const before = await snapshotDirectory(workspace.root);
    const result = await expectConfigurationError(
      product,
      workspace,
      ["build"],
      label +
        " `build --json` — the reference names no configured group, an " +
        "unknown group (SPEC " +
        (arm.site === "selector" ? "7.5" : "7.4") +
        ", 14.14)",
    );
    const finding = expectErrorDocument(result, label);
    assertSameJson(
      {
        code: finding.code,
        path: finding.path,
        locations: finding.locations,
      },
      { code: "configuration-error", path: CONFIG_PATH, locations: [] },
      label +
        ": the error document's one finding carries the stable code " +
        "configuration-error, locations [] (a configuration condition " +
        "carries the file it concerns, never a source range), and as its " +
        "concerned path the configuration file the upward search found, in " +
        "the anchoring form of 11.6 relative to the invocation working " +
        "directory, the workspace root — exactly xspec.config.ts (SPEC 14, " +
        "12.7, 11.6)",
    );
    assertSnapshotsEqual(
      before,
      await snapshotDirectory(workspace.root),
      label +
        ": a build failing at configuration load modifies nothing (SPEC " +
        "12.1, 12.0) — no derived file or graph data appears anywhere under " +
        "the root",
    );
  });
}

/**
 * (d): the premise — `coverage p` answers the one configured profile — then
 * each unknown name, one arm each, its diagnosed failure collected.
 */
async function runUnknownProfileArms(
  product: ProductBinding,
  failures: string[],
): Promise<void> {
  await withWorkspace(graphFiles(T7_11_D_CONFIG), async (workspace) => {
    const label = "T7-11(d) (the one profile p configured)";
    await expectFindingFreeReport(
      product,
      workspace,
      ["build", "--json"],
      label + " `build --json` — the configuration loads (SPEC 7, 7.4)",
    );
    const coverageLabel =
      label +
      " `coverage p --json` — the premise: the surface answers a configured " +
      "profile's name";
    assertProfileCoversA(
      decodeCoverageReport(
        await runJson(
          product,
          workspace,
          ["coverage", "p", "--json"],
          coverageLabel,
        ),
        coverageLabel,
      ),
      "p",
      coverageLabel,
    );
    for (const name of UNKNOWN_PROFILE_NAMES) {
      await collectArmFailure(failures, async () => {
        await expectPlainUsageError(
          product,
          workspace,
          ["coverage", name, "--json"],
          label +
            " `coverage " +
            name +
            " --json` — no profile named " +
            name +
            " is configured: an unknown profile named in arguments is the " +
            "usage error of 12.0, exit 2 (SPEC 8.2, 12.0, 12.7)",
        );
      });
    }
  });
}

// ---------------------------------------------------------------------------
// T7-11 — configured names
// ---------------------------------------------------------------------------

const T7_11 = defineProductTest({
  id: "T7-11",
  title:
    "configured names: 7 bars a group, profile, or rule name only when it " +
    "is empty or contains U+FFFD, so the `Object` members and `__proto__` " +
    "are names like any other — (a) a spec group named `__proto__` (an " +
    "identifier key, and separately a string-literal key), one named " +
    "`constructor`, and one named `hasOwnProperty`, each globbing " +
    "specs/*.mdx over specs/A.mdx, and code groups so named globbing " +
    "src/*.ts over src/a.ts beside no spec group, one arm each: `build` and " +
    "`check` exit 0 finding-free and `inventory` reports the group under " +
    "its name with its glob and its one source; (b) a profile and a " +
    "`forbidden` rule both named `toString`, over the one edge the rule " +
    "forbids: `build` exits 0, `inventory` reports both with their " +
    "complete definitions, every default and inferred kind explicit, " +
    "`coverage toString` reports exactly that profile, its target leaf " +
    "covered over the edge, and `check` reports the violation under the " +
    "rule's name, its one 14.12 finding, exit 1; (c) a profile's `target`, " +
    "its `boundary`, and a rule's selector `group`, each naming " +
    "`__proto__` and `constructor`, one arm each: with a spec group of " +
    "that name configured the reference resolves — `build` exits 0 and " +
    "the profile's coverage is reported, or the rule evaluated, its one " +
    "violation reported by `check` — and with none it is an unknown group, " +
    "14.14, exit 2, the finding naming xspec.config.ts, nothing written; " +
    "(d) with the one profile p configured, which `coverage p` reports, " +
    "`coverage constructor` and `coverage __proto__` each name an unknown " +
    "profile, the plain usage error of 12.0 (exit 2, the error document's " +
    "code and path null) (SPEC 7, 7.4, 7.5, 8.2, 11.6, 12.0, 12.7, 14)",
  run: async (product) => {
    const failures: string[] = [];
    for (const arm of T7_11_A_ARMS) {
      await collectArmFailure(failures, () => runGroupArm(product, arm));
    }
    await collectArmFailure(failures, () => runProfileAndRuleArm(product));
    for (const arm of T7_11_C_ARMS) {
      await collectArmFailure(failures, () =>
        runReferenceResolvingArm(product, arm),
      );
      await collectArmFailure(failures, () =>
        runReferenceUnknownArm(product, arm),
      );
    }
    await collectArmFailure(failures, () =>
      runUnknownProfileArms(product, failures),
    );
    if (failures.length > 0) {
      fail(
        "T7-11: " +
          String(failures.length) +
          " of " +
          String(T7_11_ARM_COUNT) +
          " arms failed, each diagnosed below:" +
          LINE_FEED +
          failures.join(LINE_FEED),
      );
    }
  },
});

/** TEST-SPEC §7 configured names: T7-11. */
export const section7NamesTests: readonly ProductTestEntry[] = [T7_11];
