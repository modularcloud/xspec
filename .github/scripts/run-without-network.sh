#!/usr/bin/env bash
# Run a command with network access disabled and as an unprivileged user
# (TEST-SPEC E-1): the suite must pass with network access disabled after
# setup, product invocations run with network access denied, and the Linux leg
# runs product invocations as an unprivileged user so that the permission-based
# stagings of environment refusals (T13.5-7, T14-9, T14-10) take effect. The
# harness verifies each staging on itself and reports a privileged runner as a
# harness error (H-11); this script is what makes the runner unprivileged.
#
# The command runs inside two nested user namespaces, entered by this script
# re-invoking itself one stage at a time:
#
#   outer  `unshare --map-root-user --net`. A fresh network namespace holding
#          only a loopback interface, so the command and every subprocess it
#          spawns (the harness's product invocations included) have no route
#          off the machine while the Actions runner agent keeps its own
#          connectivity. Root inside this namespace is needed only to bring
#          loopback up. It must not run the suite: a root-mapped namespace
#          also carries CAP_DAC_OVERRIDE over every file the runner user owns,
#          so permission removal is ineffective there — a process writes into
#          a read-only directory and reads a mode-200 file — exactly the
#          privileged runner E-1 excludes.
#
#   inner  `unshare --map-user --map-group` (util-linux >= 2.38; ubuntu-24.04
#          ships 2.39). Maps the identity back to the runner's real uid and
#          gid; executing a program as a non-zero uid inside a user namespace
#          clears every capability. Mode bits then refuse exactly as they do
#          for a plain unprivileged process, the network namespace is
#          inherited, and the uid the harness, git, and the product observe is
#          the runner's own. The command runs here, after the stage verifies
#          both properties.
#
# Failures here are loud by design: falling back to a networked or privileged
# run would silently drop the E-1 guarantee.
set -euo pipefail

me="run-without-network.sh"

case "${1-}" in
  --stage-outer)
    # Inside the root-mapped user + network namespaces.
    uid=$2; gid=$3; shift 3
    ip link set lo up 2>/dev/null || true
    exec unshare --map-user="$uid" --map-group="$gid" -- bash "$0" --stage-inner "$uid" "$@"
    ;;
  --stage-inner)
    # Inside the inner user namespace: the runner's own identity, no
    # capabilities. Verify both before running anything.
    uid=$2; shift 2
    if [ "$(id -u)" != "$uid" ]; then
      echo "$me: uid $(id -u) inside the inner namespace, expected $uid" >&2
      exit 1
    fi
    if ! grep -Eq '^CapEff:[[:space:]]*0+$' /proc/self/status; then
      echo "$me: capabilities survived the inner namespace (privileged runner, E-1)" >&2
      exit 1
    fi
    exec "$@"
    ;;
esac

uid=$(id -u)
gid=$(id -g)
if [ "$uid" -eq 0 ]; then
  echo "$me: refusing to run as root — E-1 requires an unprivileged runner" >&2
  exit 1
fi

# Ubuntu 24.04 can restrict unprivileged user namespaces; lift the restriction
# for this VM so `unshare` needs no root. A no-op where already permitted.
sudo sysctl -qw kernel.apparmor_restrict_unprivileged_userns=0 2>/dev/null || true

# --map-root-user grants CAP_NET_ADMIN inside the new namespaces (to bring up
# loopback); the real uid outside remains the runner user, and the inner stage
# maps it back.
exec unshare --map-root-user --net -- bash "$0" --stage-outer "$uid" "$gid" "$@"
