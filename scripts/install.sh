#!/bin/sh
# SPDX-License-Identifier: Apache-2.0
#
# One-line CleanX installer for OpenWrt:
#
#   wget -O- https://raw.githubusercontent.com/Ox1d3x3/cleanwrt-luci/main/scripts/install.sh | sh
#
# Downloads cleanx-apply.sh from the latest release and runs it, which does a
# standalone install (Attended Sysupgrade keeps working and the theme survives
# firmware upgrades). Arguments are passed through, for example:
#
#   ... | sh -s -- --status
#   ... | sh -s -- --version v0.6.2
#   ... | sh -s -- --package        # classic .ipk/.apk package instead

set -eu

REPO="${REPO:-Ox1d3x3/cleanwrt-luci}"
URL="https://github.com/${REPO}/releases/latest/download/cleanx-apply.sh"
DEST="/tmp/cleanx-apply.sh"

if command -v uclient-fetch >/dev/null 2>&1; then
	uclient-fetch -q -O "$DEST" "$URL"
elif command -v wget >/dev/null 2>&1; then
	wget -q -O "$DEST" "$URL"
elif command -v curl >/dev/null 2>&1; then
	curl -fsSL -o "$DEST" "$URL"
else
	echo "ERROR: need uclient-fetch, wget or curl" >&2
	exit 1
fi

exec sh "$DEST" "$@"
