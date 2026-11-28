#!/usr/bin/env bash
# Commit only the named paths, built in a private index, so other sessions' staged or half-done work stays out and
# a commit landing meanwhile fails the ref move instead of being overwritten. git commit-tree runs no hooks.
#   scripts/commit-mine.sh <message-file> <path>...        print each path's hunks against HEAD, commit nothing
#   scripts/commit-mine.sh -y <message-file> <path>...     commit them and move the branch
# Check the hunk list holds only your edits first: a path a peer also edited would carry their hunks too.
set -euo pipefail

yes=0
if [ "${1:-}" = "-y" ]; then yes=1; shift; fi
[ $# -ge 2 ] || { sed -n '4,5p' "$0"; exit 2; }
msg=$1; shift
[ -s "$msg" ] || { echo "empty or missing message file: $msg" >&2; exit 2; }

base=$(git rev-parse HEAD)
branch=$(git symbolic-ref --short HEAD)

if [ $yes = 0 ]; then
  for p in "$@"; do
    echo "== $p"
    if git ls-files --error-unmatch -- "$p" >/dev/null 2>&1; then git diff "$base" -- "$p" | grep '^@@' || echo "(no change)"; else echo "(new file)"; fi
  done
  echo "Every hunk yours? Rerun with -y." >&2
  exit 1
fi

idx=$(mktemp)
trap 'rm -f "$idx"' EXIT
GIT_INDEX_FILE=$idx git read-tree "$base"
GIT_INDEX_FILE=$idx git add --all -- "$@"
tree=$(GIT_INDEX_FILE=$idx git write-tree)
[ "$tree" != "$(git rev-parse "$base^{tree}")" ] || { echo "nothing to commit in those paths" >&2; exit 1; }
new=$(git commit-tree "$tree" -p "$base" -F "$msg")
git update-ref "refs/heads/$branch" "$new" "$base" || { echo "$branch moved since $base: rerun" >&2; exit 1; }
# The shared index still holds the old blobs, which would read as staged reversals of this commit.
git reset -q -- "$@"
git --no-pager show --stat --format='%h %s' HEAD
