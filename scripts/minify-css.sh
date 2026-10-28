#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# Minify the theme stylesheets inside a *staged copy* of the package source,
# right before it is built. The repository keeps the readable CSS.
#
#   scripts/minify-css.sh /path/to/staged/luci-theme-cleanx
#
# LuCI's own csstidy step is disabled in the Makefile because it breaks modern
# CSS, so this uses csso in --no-restructure mode: whitespace, comments and
# value shortening only. Rules are never merged or reordered, so the cascade is
# unchanged. Skips quietly when Node.js is not available (the package still
# builds, just with unminified CSS).

set -euo pipefail

PKG_DIR="${1:?usage: $0 <staged package dir>}"
CSSO_PKG="csso-cli@4.0.2"

if ! command -v npx >/dev/null 2>&1; then
	echo "minify-css: npx not found, leaving CSS unminified" >&2
	exit 0
fi

find "$PKG_DIR/htdocs" -type f -name '*.css' -print0 | while IFS= read -r -d '' css; do
	before=$(wc -c < "$css")
	npx --yes "$CSSO_PKG" --no-restructure --input "$css" --output "$css.min"
	mv "$css.min" "$css"
	after=$(wc -c < "$css")
	printf 'minify-css: %-48s %8d -> %8d bytes\n' "${css#"$PKG_DIR"/}" "$before" "$after"
done
