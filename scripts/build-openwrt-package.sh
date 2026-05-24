#!/usr/bin/env sh
set -eu

# Build this LuCI theme inside an existing OpenWrt buildroot or SDK.
# Usage:
#   scripts/build-openwrt-package.sh /path/to/openwrt-or-sdk
#
# Output extension depends on the OpenWrt branch:
#   OpenWrt <= 24.10  -> .ipk
#   OpenWrt >= 25.12  -> .apk

OWRT_DIR="${1:-}"
PKG_NAME="luci-theme-cleanx"

if [ -z "$OWRT_DIR" ] || [ ! -d "$OWRT_DIR" ]; then
	echo "ERROR: give OpenWrt buildroot/SDK path" >&2
	exit 1
fi

OWRT_DIR="$(cd "$OWRT_DIR" && pwd)"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PKG_DIR="$OWRT_DIR/package/custom/$PKG_NAME"

mkdir -p "$OWRT_DIR/package/custom"
rm -rf "$PKG_DIR"
cp -a "$SRC_DIR" "$PKG_DIR"
rm -rf "$PKG_DIR/.git" "$PKG_DIR/.github"

cd "$OWRT_DIR"

if [ -x ./scripts/feeds ]; then
	./scripts/feeds update luci >/dev/null 2>&1 || ./scripts/feeds update -a
	./scripts/feeds install -a -p luci >/dev/null 2>&1 || true
fi

make defconfig
make "package/$PKG_NAME/clean" V=s || true
make "package/$PKG_NAME/compile" V=s

echo
find "$OWRT_DIR/bin" -type f \( -name "${PKG_NAME}_*.ipk" -o -name "${PKG_NAME}-*.apk" -o -name "${PKG_NAME}_*.apk" \) -print
