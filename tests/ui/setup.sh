#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# tests/ui/setup.sh <luci-branch> [workdir]
#
# Fetches the LuCI sources the UI audit renders (base, network, system,
# status, firewall, Bootstrap, IPv6/PPP protocols, uqr) for one release branch,
# e.g. openwrt-25.12, and builds the ucode interpreter that renders LuCI's
# page templates. Needs git, cmake, a C compiler and json-c headers.
set -euo pipefail

BRANCH="${1:?usage: $0 <luci-branch, e.g. openwrt-25.12> [workdir]}"
WORK="${2:-$(cd "$(dirname "$0")" && pwd)/.work}"
mkdir -p "$WORK"

if [ ! -d "$WORK/luci-$BRANCH/.git" ]; then
	git clone -q --depth 1 --filter=blob:none --sparse -b "$BRANCH" https://github.com/openwrt/luci.git "$WORK/luci-$BRANCH"
	git -C "$WORK/luci-$BRANCH" sparse-checkout set \
		modules/luci-base modules/luci-mod-network modules/luci-mod-system modules/luci-mod-status \
		applications/luci-app-firewall themes/luci-theme-bootstrap \
		protocols/luci-proto-ipv6 protocols/luci-proto-ppp libs/luci-lib-uqr
fi
echo "LuCI $BRANCH: $(git -C "$WORK/luci-$BRANCH" log -1 --format='%h %cd' --date=short)"

if [ ! -x "$WORK/ucode/b/ucode" ]; then
	[ -d "$WORK/ucode/.git" ] || git clone -q --depth 1 https://github.com/jow-/ucode.git "$WORK/ucode"
	cmake -S "$WORK/ucode" -B "$WORK/ucode/b" -DCMAKE_BUILD_TYPE=Release \
		-DUCI_SUPPORT=OFF -DUBUS_SUPPORT=OFF -DULOOP_SUPPORT=OFF -DRTNL_SUPPORT=OFF -DNL80211_SUPPORT=OFF \
		-DDEBUG_SUPPORT=OFF -DLOG_SUPPORT=OFF -DDIGEST_SUPPORT=OFF -DSOCKET_SUPPORT=OFF -DZLIB_SUPPORT=OFF \
		-DIO_SUPPORT=OFF >/dev/null
	cmake --build "$WORK/ucode/b" -j"$(nproc)" >/dev/null
fi
echo "ucode: $("$WORK/ucode/b/ucode" -e 'print("ok\n")')"
