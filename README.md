# CleanX LuCI Theme

**CleanX** is a clean, Apple-inspired LuCI theme for OpenWrt with a modern glass interface, smooth animation, dark/light mode and live dashboard cards.

This project is built **from scratch** for modern LuCI using `ucode/template/themes/`. It is not a fork of Aurora or Bootstrap.

## Highlights

- Premium Apple-style glass UI
- Clean sidebar with SVG icons
- Smooth loader, page reveal, hover and ripple interactions
- Light/dark mode with local browser memory
- Mobile-friendly LuCI layout
- Custom login page
- Live dashboard on LuCI overview page
- Live WAN download and upload speed
- Total RX/TX traffic with automatic B/KB/MB/GB/TB/PB formatting
- Uptime and RAM usage card
- OpenWrt SDK GitHub Actions workflow
- Builds `.ipk` for OpenWrt 24.10 and older package systems
- Builds `.apk` for OpenWrt 25.12+ and snapshot package systems

## Important compatibility note

This theme uses the **modern LuCI ucode template path**:

```text
ucode/template/themes/cleanx/
```

That is the correct structure for current OpenWrt/LuCI builds. Older themes that only use:

```text
luasrc/view/themes/<theme>/header.htm
```

may look good in static previews, but they are not the right base for current OpenWrt 23.05/24.10/25.x LuCI packaging.

## Screenshots and preview

Open this file locally after extracting the repo:

```text
preview/index.html
```

Included preview screens are available from `preview/index.html`, including login, dashboard, status, network, wireless, firewall, system, software, services, theme settings concept and mobile layout.

The preview pages are static mockups so you can judge the style before installing. Real LuCI pages depend on the packages installed on your router.

## Repository structure

```text
luci-theme-cleanx/
├── Makefile
├── README.md
├── htdocs/luci-static/cleanx/
│   ├── main.css
│   ├── login.css
│   └── images/logo.svg
├── htdocs/luci-static/resources/
│   ├── menu-cleanx.js
│   └── cleanx-dashboard.js
├── root/etc/uci-defaults/30_luci-theme-cleanx
├── root/usr/share/rpcd/acl.d/luci-theme-cleanx.json
├── ucode/template/themes/cleanx/
│   ├── header.ut
│   ├── footer.ut
│   └── sysauth.ut
├── scripts/
│   ├── build-openwrt-package.sh
│   └── install-theme.sh
└── .github/workflows/build-openwrt-packages.yml
```

## Build packages using GitHub Actions

1. Upload this repository to GitHub.
2. Go to **Actions**.
3. Run **Build CleanX OpenWrt packages**.
4. Download the generated artifacts.

The workflow uses the official OpenWrt SDK and compiles the package properly instead of manually zipping files.

## Install on OpenWrt 24.10 or older

Copy the `.ipk` to your router, for example:

```sh
scp luci-theme-cleanx_*.ipk root@192.168.1.1:/tmp/
```

Install and apply:

```sh
opkg install /tmp/luci-theme-cleanx_*.ipk
uci set luci.main.mediaurlbase='/luci-static/cleanx'
uci commit luci
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache
/etc/init.d/uhttpd restart
```

## Install on OpenWrt 25.12+ or snapshots

Copy the `.apk` to your router:

```sh
scp luci-theme-cleanx*.apk root@192.168.1.1:/tmp/
```

Install and apply:

```sh
apk add --allow-untrusted /tmp/luci-theme-cleanx*.apk
uci set luci.main.mediaurlbase='/luci-static/cleanx'
uci commit luci
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache
/etc/init.d/uhttpd restart
```

## Recovery if LuCI breaks

SSH into the router and switch back to Bootstrap:

```sh
uci set luci.main.mediaurlbase='/luci-static/bootstrap'
uci commit luci
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache
/etc/init.d/uhttpd restart
```

If needed, remove the package:

```sh
opkg remove luci-theme-cleanx
```

or on APK-based systems:

```sh
apk del luci-theme-cleanx
```

## Live dashboard behaviour

The current live dashboard reads WAN interface counters from LuCI RPC and calculates speed by comparing RX/TX byte counters every few seconds.

Current behaviour:

- Live download and upload speed: real-time calculation
- RX/TX total data: since boot/interface counter reset
- GB/TB/PB conversion: automatic

For persistent monthly/yearly totals, add one of these in a future phase:

- `vnstat` for long-term interface traffic history
- `nlbwmon` for per-client/per-MAC traffic accounting

## Roadmap

Planned next features:

- LuCI theme settings page
- WAN interface selector
- Accent colour selector
- Animation mode selector
- Persistent traffic totals using `vnstat` or `nlbwmon`
- Wi-Fi and connected-client cards
- CPU temperature/load cards
- Realtime mini charts
- Cleaner package release automation

## Licence

Apache-2.0
