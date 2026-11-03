#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
#
# Remove CleanX from an OpenWrt router, however it was installed, and switch
# LuCI back to Bootstrap.

set -eu

PKG_NAME="luci-theme-cleanx"
KEEP="/lib/upgrade/keep.d/cleanx-standalone"

if [ -f "$KEEP" ]; then
	# Standalone install: the keep list is the file manifest.
	sed -e '/^[[:space:]]*$/d' -e '/^#/d' "$KEEP" | while IFS= read -r f; do
		rm -f "$f"
	done
	rm -rf /www/luci-static/cleanx /usr/share/ucode/luci/template/themes/cleanx
	rm -f "$KEEP"
	uci -q delete luci.themes.CleanX || true
elif command -v apk >/dev/null 2>&1; then
	apk del "$PKG_NAME" || true
elif command -v opkg >/dev/null 2>&1; then
	opkg remove "$PKG_NAME" || true
fi

if [ "$(uci -q get luci.main.mediaurlbase || true)" = "/luci-static/cleanx" ]; then
	uci set luci.main.mediaurlbase='/luci-static/bootstrap'
fi
uci commit luci

rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null || true
/etc/init.d/rpcd reload >/dev/null 2>&1 || true

printf '%s\n' 'CleanX removed. LuCI is back on the Bootstrap theme.'
