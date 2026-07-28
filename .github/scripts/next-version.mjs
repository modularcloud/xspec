// Compute the next release version (DEVOPS.md — npm releases, standing
// procedure). Usage:
//
//   node .github/scripts/next-version.mjs <baseline> [latest-published]
//
// Prints the version to publish:
//
//   - the baseline (package.json's version) when nothing is published yet or
//     the baseline is greater than the latest published version — this is how
//     a deliberate minor/major bump landed on main takes effect;
//   - otherwise the latest published version with its patch component
//     incremented.
//
// Either way the result is strictly greater than every previously published
// version. Only plain x.y.z versions are accepted; anything else (prerelease
// tags, garbage from a failed registry lookup) fails loudly rather than
// publishing a surprise.

const [baseline, latest] = process.argv.slice(2);

const parse = (v) => {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v ?? "");
  if (!m) throw new Error(`next-version: not a plain x.y.z version: ${JSON.stringify(v)}`);
  return m.slice(1).map(Number);
};

const b = parse(baseline);
if (!latest) {
  console.log(baseline);
} else {
  const l = parse(latest);
  const gt = b[0] !== l[0] ? b[0] > l[0] : b[1] !== l[1] ? b[1] > l[1] : b[2] > l[2];
  console.log(gt ? baseline : `${l[0]}.${l[1]}.${l[2] + 1}`);
}
