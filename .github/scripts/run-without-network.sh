#!/usr/bin/env bash
# Run a command for the Linux CI legs (TEST-SPEC E-1, E-3; H-2): as the
# runner's own unprivileged identity, with network access disabled after
# setup, and with the job's administrative access kept for the harness.
#
# What E-1 asks of the Linux leg, and how this script provides it:
#
#   No network.  The suite must pass with network access disabled after
#     setup, every product invocation running with network access denied. The
#     command runs in a fresh network namespace holding only a loopback
#     interface, so it and every process it starts, through sudo included,
#     have no route off the machine, while the Actions runner agent keeps its
#     own connectivity.
#
#   Unprivileged.  Product invocations run as an unprivileged user, so the
#     permission-based stagings of environment refusals (T13.5-7,
#     T13.5-10(d), T14-9, T14-10) take effect; the harness verifies each on
#     itself and reports a privileged runner as a harness error (H-11). The
#     command runs as the runner's own uid, gid, and groups with every
#     capability cleared, so mode bits refuse it as they refuse any
#     unprivileged process.
#
#   Administrative access.  13.5's machine-wide stagings (T13.5-9's second
#     user and second mount; T13.5-10(e)'s, (f)'s, and (g)'s fresh
#     process-identifier namespaces) are made with the administrative access
#     the hosted runner grants the job, passwordless sudo, outside every
#     product invocation (H-2). So the command stays in the machine's own
#     user namespace, where sudo works, and in its own process-identifier
#     namespace, where every user's processes share one process list (13.5's
#     one machine: T13.5-9 checks that each identity lists the other's).
#     Nothing here makes those stagings: the harness makes them, per suite
#     instance, and the second user idempotently (E-3).
#
# The script re-invokes itself one stage at a time:
#
#   caller  The runner user. Saves its environment and resource limits in a
#           private directory, then through sudo enters fresh network and
#           mount namespaces as root.
#   root    Brings loopback up and restores the caller's resource limits
#           (sudo's PAM session resets them). sudo resolves the host's own
#           name on every call (Ubuntu builds it with fqdn), and inside this
#           network namespace only /etc/hosts can answer: where that file
#           lacks the name, a copy mapping it to loopback is bind-mounted over
#           it, in this mount namespace alone, so sudo stays silent and adds
#           no warning line to the stderr of a run the harness starts through
#           it. The mount namespace's propagation is private: mounts the
#           harness makes (T13.5-9's second mount) are seen by every process
#           of the run and by nothing outside it. Then drops to the runner's
#           uid, gid, and groups; setpriv leaves no capability on leaving uid
#           0, and the bounding set stays whole, so sudo keeps working.
#   user    Verifies the identity, the capabilities, the resource limits, the
#           network, and sudo, restores the caller's environment exactly, and
#           execs the command.
#
# Workspaces: the harness makes them under os.tmpdir(). TMPDIR is left unset
# in CI, so they land in /tmp, on the hosted image's ext4 root filesystem,
# which lists a directory in name-hash order: T13.5-10(c)'s bracketing arm
# needs a filesystem whose listing order is not creation order (tmpfs lists
# in creation order). The verification line names that filesystem's type.
#
# Failures here are loud by design: a networked, privileged, or sudo-less run
# would silently drop an E-1 guarantee.
set -euo pipefail

me="run-without-network.sh"

fail() {
  echo "$me: $*" >&2
  exit 1
}

# Sorted, deduplicated, comma-joined group IDs from a space- or
# comma-separated list.
normalize_groups() {
  tr ', ' '\n\n' <<<"$1" | sed '/^$/d' | sort -nu | paste -sd, -
}

# Every resource limit of this shell, one "RESOURCE soft hard" line each.
limits() {
  prlimit --pid $$ --raw --noheadings --output RESOURCE,SOFT,HARD
}

case "${1-}" in
  --stage-root)
    # Root, in the fresh network and mount namespaces.
    uid=$2; gid=$3; groups=$4; state=$5; shift 5
    ip link set lo up 2>/dev/null || true
    restore=()
    while read -r resource soft hard; do
      restore+=("--${resource,,}=$soft:$hard")
    done <"$state/limits"
    prlimit --pid $$ "${restore[@]}"
    host=$(uname -n)
    if ! getent -s files hosts "$host" >/dev/null; then
      hosts=$(mktemp /tmp/xspec-ci-hosts.XXXXXX)
      cat /etc/hosts >"$hosts"
      printf '127.0.1.1\t%s\n' "$host" >>"$hosts"
      chmod 644 "$hosts"
      mount --bind "$hosts" /etc/hosts
      rm -f -- "$hosts"
    fi
    exec setpriv --reuid="$uid" --regid="$gid" --groups="$groups" -- \
      bash "$0" --stage-user "$uid" "$gid" "$groups" "$state" "$@"
    ;;
  --stage-user)
    # The runner's own identity, no capabilities. Consume the saved state,
    # then verify before running.
    uid=$2; gid=$3; groups=$4; state=$5; shift 5
    mapfile -d '' -t vars <"$state/env"
    caller_limits=$(cat "$state/limits")
    rm -rf -- "$state"
    [ "$(id -u)" = "$uid" ] || fail "uid $(id -u), expected $uid"
    [ "$(id -g)" = "$gid" ] || fail "gid $(id -g), expected $gid"
    [ "$(normalize_groups "$(id -G)")" = "$(normalize_groups "$groups")" ] ||
      fail "groups $(id -G), expected $groups"
    for set in CapEff CapPrm CapAmb; do
      grep -Eq "^$set:[[:space:]]*0+\$" /proc/self/status ||
        fail "capabilities survived ($set): a privileged run (E-1)"
    done
    [ "$(limits)" = "$caller_limits" ] ||
      fail "resource limits differ from the caller's"
    ifaces=$(awk -F: 'NR > 2 { gsub(/[[:space:]]/, "", $1); print $1 }' /proc/net/dev | paste -sd, -)
    [ "$ifaces" = lo ] || fail "network interfaces $ifaces, expected lo alone (E-1)"
    out=$(sudo -n true 2>&1) || fail "administrative access refused (E-1): $out"
    [ -z "$out" ] || fail "sudo is not silent here: $out"
    tmp=/tmp
    for kv in "${vars[@]}"; do
      case $kv in TMPDIR=?*) tmp=${kv#TMPDIR=} ;; esac
    done
    echo "$me: uid $uid, gid $gid, groups $groups; no capabilities;" \
      "the caller's resource limits; network: lo alone;" \
      "administrative access: sudo;" \
      "temporary directory $tmp on $(stat -f -c %T "$tmp")" >&2
    exec env -i "${vars[@]}" "$@"
    ;;
esac

uid=$(id -u)
gid=$(id -g)
groups=$(id -G | tr ' ' ',')
if [ "$uid" -eq 0 ]; then
  fail "refusing to run as root: E-1 requires an unprivileged runner"
fi
sudo -n true 2>/dev/null ||
  fail "no passwordless sudo: E-1 requires the administrative access the hosted runner grants the job"

state=$(mktemp -d)
env -0 >"$state/env"
limits >"$state/limits"

exec sudo -n -- unshare --net --mount -- \
  bash "$0" --stage-root "$uid" "$gid" "$groups" "$state" "$@"
