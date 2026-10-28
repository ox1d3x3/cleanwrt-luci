#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
#
# Install the latest CleanX release directly on an OpenWrt router.
#
#   wget -O- https://raw.githubusercontent.com/Ox1d3x3/cleanwrt-luci/main/scripts/install.sh | sh
#
# Picks the right package for the router automatically:
#   opkg-based builds (OpenWrt 24.10 and older) -> .ipk
#   apk-based builds  (OpenWrt 25.12 and newer) -> .apk (snapshot build on snapshots)
#
# Environment overrides:
#   REPO=owner/name   install from a fork
#   TAG=v0.6.1        install a specific release instead of the latest

set -eu

REPO="${REPO:-Ox1d3x3/cleanwrt-luci}"
TAG="${TAG:-}"
PKG_NAME="luci-theme-cleanx"
TMP_DIR="/tmp/cleanx-install"

log()  { printf '==> %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

fetch() {
	if command -v uclient-fetch >/dev/null 2>&1; then
		uclient-fetch -q -O "$2" "$1"
	elif command -v wget >/dev/null 2>&1; then
		wget -q -O "$2" "$1"
	elif command -v curl >/dev/null 2>&1; then
		curl -fsSL -o "$2" "$1"
	else
		fail "Need uclient-fetch, wget or curl to download files."
	fi
}

if command -v apk >/dev/null 2>&1; then
	PM="apk"
	EXT="apk"
elif command -v opkg >/dev/null 2>&1; then
	PM="opkg"
	EXT="ipk"
else
	fail "Neither apk nor opkg found. This does not look like an OpenWrt system."
fi

# apk releases ship a stable-branch and a snapshot build.
SNAPSHOT=0
grep -qi 'snapshot' /etc/openwrt_release 2>/dev/null && SNAPSHOT=1

command -v jsonfilter >/dev/null 2>&1 || fail "jsonfilter is required (part of a standard OpenWrt image)."

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"
trap 'rm -rf "$TMP_DIR"' EXIT

if [ -n "$TAG" ]; then
	API="https://api.github.com/repos/${REPO}/releases/tags/${TAG}"
else
	API="https://api.github.com/repos/${REPO}/releases/latest"
fi

log "Looking up ${TAG:-latest} release of ${REPO}"
fetch "$API" "$TMP_DIR/release.json" || fail "Could not reach the GitHub API. Check the router's internet access and CA certificates."

URL="$(jsonfilter -i "$TMP_DIR/release.json" -e '@.assets[*].browser_download_url' \
	| grep "/${PKG_NAME}_.*\.${EXT}\$" \
	| { if [ "$EXT" != "apk" ]; then cat; elif [ "$SNAPSHOT" = 1 ]; then grep -- '-snapshot-'; else grep -v -- '-snapshot-'; fi; } \
	| head -n 1)"

[ -n "$URL" ] || fail "No .${EXT} package found in the ${TAG:-latest} release."

PKG="$TMP_DIR/${URL##*/}"
log "Downloading ${URL##*/}"
fetch "$URL" "$PKG" || fail "Download failed."

log "Installing with ${PM}"
if [ "$PM" = "apk" ]; then
	apk add --allow-untrusted "$PKG"
else
	opkg install "$PKG"
fi

log "Activating CleanX"
uci set luci.main.mediaurlbase='/luci-static/cleanx'
uci commit luci
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache 2>/dev/null || true
/etc/init.d/uhttpd restart >/dev/null 2>&1 || true

log "Done. Reload LuCI in your browser (hard refresh: Ctrl+F5 / Cmd+Shift+R)."
