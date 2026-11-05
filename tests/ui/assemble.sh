#!/usr/bin/env bash
# assemble.sh <luci-branch-checkout> <cleanx-repo> <outdir>
# Builds a router-like web root (LuCI + Bootstrap + CleanX) for the UI audit.
set -euo pipefail
LUCI="$1"; CX="$2"; OUT="$3"
rm -rf "$OUT"; mkdir -p "$OUT/www/luci-static" "$OUT/tpl/themes" "$OUT/menu.d"
for m in modules/luci-base modules/luci-mod-network modules/luci-mod-system modules/luci-mod-status applications/luci-app-firewall themes/luci-theme-bootstrap protocols/luci-proto-ipv6 protocols/luci-proto-ppp libs/luci-lib-uqr; do
  [ -d "$LUCI/$m/htdocs/luci-static" ] && cp -a "$LUCI/$m/htdocs/luci-static/." "$OUT/www/luci-static/"
  [ -d "$LUCI/$m/root/usr/share/luci/menu.d" ] && cp -a "$LUCI/$m/root/usr/share/luci/menu.d/." "$OUT/menu.d/"
done
cp -a "$LUCI/modules/luci-base/ucode/template/." "$OUT/tpl/"
for m in modules/luci-mod-status modules/luci-mod-network modules/luci-mod-system applications/luci-app-firewall; do [ -d "$LUCI/$m/ucode/template" ] && cp -a "$LUCI/$m/ucode/template/." "$OUT/tpl/"; done
cp -a "$LUCI/themes/luci-theme-bootstrap/ucode/template/themes/." "$OUT/tpl/themes/"
# CleanX exactly as the package lays it out
cp -a "$CX/htdocs/luci-static/." "$OUT/www/luci-static/"
cp -a "$CX/ucode/template/themes/cleanx" "$OUT/tpl/themes/"
[ -d "$CX/root/usr/share/luci/menu.d" ] && cp -a "$CX/root/usr/share/luci/menu.d/." "$OUT/menu.d/"
# Test the stylesheets exactly as releases ship them (minified). MINIFY=0 tests
# the readable source instead.
if [ "${MINIFY:-1}" = 1 ]; then
  bash "$CX/scripts/minify-css.sh" "$OUT/www/luci-static/cleanx" >&2
fi
echo "assembled $(find "$OUT/www" -type f | wc -l) web files, $(ls "$OUT/menu.d" | wc -l) menu files into $OUT"
