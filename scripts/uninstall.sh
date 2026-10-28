#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
#
# Remove CleanX from an OpenWrt router and switch LuCI back to Bootstrap.

set -eu

PKG_NAME="luci-theme-cleanx"

uci set luci.main.mediaurlbase='/luci-static/bootstrap'
uci commit luci

if command -v apk >/dev/null 2>&1; then
	apk del "$PKG_NAME" || true
elif command -v opkg >/dev/null 2>&1; then
	opkg remove "$PKG_NAME" || true
fi

rm -rf /tmp/luci-indexcache /tmp/luci-modulecache 2>/dev/null || true
/etc/init.d/uhttpd restart >/dev/null 2>&1 || true

printf '%s\n' 'CleanX removed. LuCI is back on the Bootstrap theme.'
