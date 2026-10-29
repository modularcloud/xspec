#!/usr/bin/env bash
# Provision the Node.js releases on which the module channel loads the
# defineConfig module (TEST-SPEC E-1 and H-2's module channel; T7.6-6, T7.6-7,
# P-17, S-10; SPEC 7.6), at setup, while the network is still available.
#
# Usage: provision-node-releases.sh <directory>
#
# <directory> must be absent or an empty directory. The releases are the ones
# test/node-releases.json lists: E-1's list, pinned by exact version. Each is
# installed exactly as nodejs.org distributes it for this platform, at
# <directory>/v<version>/, so its executable is <directory>/v<version>/bin/node.
# Each archive is checked against the release's published SHA-256 sum, and each
# executable against the version it reports, before the next release is
# fetched. The archives and the sums files stay in <directory>/archives/.
#
# The harness finds the releases through the XSPEC_NODE_RELEASES_DIR
# environment variable, naming <directory>: CI sets it right after this step.
# No test downloads a runtime, so the runs that need these releases stay
# network-denied (E-1), and a listed release left unprovisioned is a harness
# error for every run needing it (E-1, H-11), never a skip or a product
# failure. Failures here are loud for the same reason.
#
# Linux only: E-1 exercises these releases on the Linux leg alone.
set -euo pipefail

me=provision-node-releases.sh

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

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
list="$here/../../test/node-releases.json"
[ -f "$list" ] || fail "no release list at $list"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) platform=linux-x64 ;;
  Linux-aarch64) platform=linux-arm64 ;;
  *) fail "no Node.js release archive for $(uname -s) $(uname -m): E-1 provisions these releases on Linux alone" ;;
esac

# The list's releases, one per line, each an exact version listed once.
releases_text=$(node -e '
  const fs = require("node:fs");
  const list = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const releases = list.releases;
  if (!Array.isArray(releases) || releases.length === 0) {
    throw new Error("no releases listed");
  }
  for (const release of releases) {
    if (typeof release !== "string" || !/^[0-9]+[.][0-9]+[.][0-9]+$/.test(release)) {
      throw new Error("not an exact version: " + JSON.stringify(release));
    }
  }
  if (new Set(releases).size !== releases.length) {
    throw new Error("a release is listed twice");
  }
  for (const release of releases) console.log(release);
' "$list") || fail "cannot read the release list $list"
mapfile -t releases <<<"$releases_text"

fetch() {
  curl -fsSL --retry 5 --retry-all-errors --connect-timeout 30 -o "$2" "$1" ||
    fail "cannot download $1"
}

mkdir "$out/archives"
for version in "${releases[@]}"; do
  archive="node-v$version-$platform.tar.xz"
  base="https://nodejs.org/dist/v$version"
  sums="$out/archives/SHASUMS256-v$version.txt"
  fetch "$base/$archive" "$out/archives/$archive"
  fetch "$base/SHASUMS256.txt" "$sums"
  expected=$(awk -v name="$archive" '$2 == name { print $1 }' "$sums")
  [ -n "$expected" ] || fail "$base/SHASUMS256.txt publishes no SHA-256 sum for $archive"
  actual=$(sha256sum "$out/archives/$archive" | awk '{ print $1 }')
  [ "$actual" = "$expected" ] ||
    fail "$archive has SHA-256 $actual where $base/SHASUMS256.txt publishes $expected"
  mkdir "$out/v$version"
  tar -xJf "$out/archives/$archive" -C "$out/v$version" --strip-components=1 --no-same-owner
  node="$out/v$version/bin/node"
  [ -x "$node" ] || fail "$archive holds no executable bin/node"
  reported=$(env -u NODE_OPTIONS -u NODE_PATH "$node" --version)
  [ "$reported" = "v$version" ] || fail "$node reports $reported, expected v$version"
  echo "$me: v$version at $node" >&2
done
