#!/bin/sh
set -eu

PKG="${1:-}"

if [ -z "$PKG" ] || [ ! -f "$PKG" ]; then
	echo "Usage: $0 ./luci-theme-cleanx_*.ipk|*.apk" >&2
	exit 1
fi

case "$PKG" in
	*.ipk)
		command -v opkg >/dev/null || { echo "opkg not found on this OpenWrt build" >&2; exit 1; }
		opkg install "$PKG"
		;;
	*.apk)
		command -v apk >/dev/null || { echo "apk not found on this OpenWrt build" >&2; exit 1; }
		apk add --allow-untrusted "$PKG"
		;;
	*)
		echo "Unsupported package file: $PKG" >&2
		exit 1
		;;
esac

uci set luci.main.mediaurlbase='/luci-static/cleanx'
uci commit luci
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache 2>/dev/null || true
/etc/init.d/uhttpd restart

echo "CleanX theme installed and selected. Open LuCI again."
