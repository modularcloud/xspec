#!/usr/bin/env bash
# Pack the product's package directory exactly as distributed, the module
# channel's input (TEST-SPEC H-2 and C-2; SPEC 7.6: the defineConfig module is
# distributed as a package, and the package directory, exactly as distributed,
# is given to the harness beside the executable).
#
# Usage: pack-package.sh <directory>
#
# <directory> must be absent or an empty directory. The script packs the
# repository's built product with `npm pack`, which makes the tarball
# `npm publish` uploads (.github/workflows/release.yml), into <directory>,
# extracts that tarball there, and prints the package directory,
# <directory>/package, on standard output: exactly what the distribution
# carries, with nothing installed into it, and never the development tree,
# whose own node_modules would resolve inside a placed copy (H-2). The tarball
# stays beside it. Build the product first (npm run build): the package
# carries dist/.
#
# The harness reads the package directory from the XSPEC_PACKAGE_DIR
# environment variable: CI sets it from this script's output. Unset, no
# package directory is given, and every test of 7.6 fails as the missing
# product does (H-8).
set -euo pipefail

me=pack-package.sh

fail() {
  echo "$me: $*" >&2
  exit 1
}

[ $# -eq 1 ] || fail "usage: $me <directory that is absent or empty>"
out=$1
if [ -e "$out" ] || [ -L "$out" ]; then
  if [ -L "$out" ] || [ ! -d "$out" ] || [ -n "$(ls -A "$out")" ]; then
    fail "$out exists and is not an empty directory"
  fi
else
  mkdir -p "$out"
fi
out=$(cd "$out" && pwd -P)

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)
[ -f "$root/dist/cli/bin.js" ] ||
  fail "no built product at $root/dist (run npm run build first)"

report=$(cd "$root" && npm pack --json --pack-destination "$out") ||
  fail "npm pack failed"
tarball=$(node -e '
  const report = JSON.parse(process.argv[1]);
  if (!Array.isArray(report) || report.length !== 1 || typeof report[0].filename !== "string") {
    throw new Error("unexpected npm pack report");
  }
  console.log(report[0].filename);
' "$report") || fail "cannot read npm pack's report"
[ -f "$out/$tarball" ] || fail "npm pack wrote no $out/$tarball"

tar -xzf "$out/$tarball" -C "$out" --no-same-owner
package="$out/package"
[ -f "$package/package.json" ] || fail "$tarball holds no package/package.json"
node -e '
  const fs = require("node:fs");
  const packed = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const source = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  if (packed.name !== source.name) {
    throw new Error("the packed manifest names " + packed.name + " where the repository manifest names " + source.name);
  }
' "$package/package.json" "$root/package.json" || fail "the packed manifest does not match the repository's"
echo "$package"
