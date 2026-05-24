#
# luci-theme-x1wrt
# Clean modern LuCI theme for OpenWrt.
# SPDX-License-Identifier: Apache-2.0
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=X1Wrt Theme - clean modern LuCI theme with live dashboard widgets
LUCI_DEPENDS:=+luci-base

PKG_NAME:=luci-theme-x1wrt
PKG_VERSION:=0.2.0
PKG_RELEASE:=1
PKGARCH:=all
LUCI_PKGARCH:=all
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Mahabub X <github.com/ox1d3x3>

# Keep our hand-written CSS untouched. LuCI's legacy csstidy can break modern CSS.
LUCI_MINIFY_CSS:=
CONFIG_LUCI_CSSTIDY:=

define Package/luci-theme-x1wrt/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	uci -q delete luci.themes.X1Wrt
	if [ "$$(uci -q get luci.main.mediaurlbase)" = "/luci-static/x1wrt" ]; then
		uci -q set luci.main.mediaurlbase="/luci-static/bootstrap"
	fi
	uci -q commit luci
}
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
