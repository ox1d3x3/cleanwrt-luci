#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Set the CleanX version everywhere it is hard-coded.
#
#   scripts/bump-version.sh 0.6.2
#   scripts/bump-version.sh --check     # verify every file matches VERSION
#
# Pushing a commit to main whose VERSION has no GitHub release yet publishes a
# stable release automatically (see .github/workflows/build-release.yml).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

current="$(tr -d '[:space:]' < VERSION)"

check() {
	local v="$1" ok=1
	grep -q "^PKG_VERSION:=${v}\$" Makefile                                       || { echo "Makefile PKG_VERSION != $v"; ok=0; }
	grep -q "main.css?v=${v}\"" ucode/template/themes/cleanx/header.ut            || { echo "header.ut main.css cache key != $v"; ok=0; }
	grep -q "login.css?v=${v}\"" ucode/template/themes/cleanx/header.ut           || { echo "header.ut login.css cache key != $v"; ok=0; }
	grep -q "CleanX Theme v${v}<" ucode/template/themes/cleanx/footer.ut          || { echo "footer.ut version != $v"; ok=0; }
	grep -q "CleanX Theme v${v} " htdocs/luci-static/cleanx/main.css              || { echo "main.css banner != $v"; ok=0; }
	[ "$ok" = 1 ] && echo "All version strings match ${v}."
	[ "$ok" = 1 ]
}

if [ "${1:-}" = "--check" ]; then
	check "$current"
	exit $?
fi

new="${1:?usage: $0 <new-version> | --check}"
[[ "$new" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Version must look like 1.2.3" >&2; exit 1; }

printf '%s\n' "$new" > VERSION
sed -i -E "s/^PKG_VERSION:=.*/PKG_VERSION:=${new}/" Makefile
sed -i -E "s/(main|login)\.css\?v=[0-9.]+\"/\1.css?v=${new}\"/g" ucode/template/themes/cleanx/header.ut
sed -i -E "s/CleanX Theme v[0-9.]+</CleanX Theme v${new}</" ucode/template/themes/cleanx/footer.ut
sed -i -E "1s/CleanX Theme v[0-9.]+ /CleanX Theme v${new} /" htdocs/luci-static/cleanx/main.css

echo "Bumped ${current} -> ${new}"
check "$new"
