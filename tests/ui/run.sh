#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# tests/ui/run.sh <luci-branch> [viewport WxH] [page-filter-regex]
#
# Interaction audit of CleanX against stock LuCI (Bootstrap) on real LuCI
# pages: renders every page with the real templates and JavaScript, answers
# backend calls with a mocked router, then clicks through every tab, dialog,
# checkbox, select, text field and dropdown with a real mouse in Chromium.
# Fails when something works with Bootstrap but not with CleanX, or when
# CleanX shows something LuCI hides (inactive options, tab panes, ...).
# Then runs the Network Map checks (netmap.test.js).
#
# Needs Node.js with Playwright + Chromium, and Python 3. Run setup.sh first.
set -euo pipefail

BRANCH="${1:?usage: $0 <luci-branch> [WxH] [filter]}"
VIEWPORT="${2:-1440x900}"
FILTER="${3:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
WORK="${WORK:-$HERE/.work}"
OUT="${OUT:-$WORK/out-$BRANCH-$VIEWPORT}"
PORT="${PORT:-8199}"
OWVER="${BRANCH#openwrt-}"

"$HERE/setup.sh" "$BRANCH" "$WORK"
"$HERE/assemble.sh" "$WORK/luci-$BRANCH" "$REPO" "$WORK/root-$BRANCH"
rm -rf "$OUT"; mkdir -p "$OUT"

UCODE_DIR="$WORK/ucode/b" node "$HERE/server.js" "$WORK/root-$BRANCH" "$PORT" "$OWVER" > "$OUT/server.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do curl -fs "http://localhost:$PORT/__pages" >/dev/null 2>&1 && break; sleep 0.2; done

# Both themes are audited at the same time, each in its own browser.
pids=()
for theme in bootstrap cleanx; do
	echo "== auditing $theme ($BRANCH, $VIEWPORT)"
	node "$HERE/audit.js" "http://localhost:$PORT" "$theme" "$OUT/$theme.json" "$FILTER" "$VIEWPORT" > "$OUT/$theme.log" 2>&1 &
	pids+=($!)
done
status=0
for pid in "${pids[@]}"; do wait "$pid" || status=1; done
cat "$OUT/bootstrap.log" "$OUT/cleanx.log"
[ "$status" = 0 ] || { echo "audit run failed" >&2; exit 1; }

python3 "$HERE/compare.py" "$OUT/bootstrap.json" "$OUT/cleanx.json" | tee "$OUT/report.txt"

# CleanX's own Network Map: rendering (desktop/phone, light/dark, access-point
# mode), the device dialog and saving a name and icon.
if [ -z "$FILTER" ] || echo "admin/cleanx-netmap" | grep -Eq "$FILTER"; then
	echo "== Network Map checks"
	node "$HERE/netmap.test.js" "http://localhost:$PORT" "$OUT/netmap" | tee "$OUT/netmap.txt"
fi
