# CleanX LuCI Theme

**CleanX** is a clean, modern LuCI theme for OpenWrt with a glass-style interface, smooth interactions, dark/light mode and live dashboard cards.

The theme uses the current LuCI `ucode/template/themes/` structure and is designed for OpenWrt 23.05, 24.10 and newer builds.

## Highlights

- Clean glass-style interface
- Responsive sidebar with SVG icons
- Smooth loader, page reveal, hover and ripple interactions
- Light/dark mode with local browser memory
- Mobile-friendly LuCI layout
- Custom login page
- Live dashboard on the LuCI overview page
- Live WAN download and upload speed
- Total RX/TX traffic with automatic B/KB/MB/GB/TB/PB formatting
- Uptime and RAM usage card
- Better styling for LuCI forms, CBI sections, tables and action buttons
- Status/overview memory progress bar support
- OpenWrt SDK GitHub Actions workflow
- Builds `.ipk` for OpenWrt 24.10 and older package systems
- Builds `.apk` for OpenWrt 25.12+ and snapshot package systems

## Compatibility

CleanX uses:

```text
ucode/template/themes/cleanx/
```

This is the modern LuCI theme template path used by current OpenWrt builds.

## Screenshots and preview

Open this file locally after extracting the repository:

```text
preview/index.html
```

The preview includes login, dashboard, status, network, wireless, firewall, system, software, services, theme settings concept and mobile layout pages.

The preview pages are static examples. Real LuCI pages depend on the packages installed on your router.

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
2. Open the **Actions** tab.
3. Run **Build CleanX OpenWrt packages**.
4. Download the generated package artifact.

The workflow uses the official OpenWrt SDK and compiles the package properly instead of manually compressing files.

## Install on OpenWrt 24.10 or older

Copy the `.ipk` to your router:

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

SSH into the router and switch back to the default LuCI theme:

```sh
uci set luci.main.mediaurlbase='/luci-static/bootstrap'
uci commit luci
rm -rf /tmp/luci-indexcache /tmp/luci-modulecache
/etc/init.d/uhttpd restart
```

Remove the package if required:

```sh
opkg remove luci-theme-cleanx
```

or on APK-based systems:

```sh
apk del luci-theme-cleanx
```

## Live dashboard behaviour

The live dashboard reads WAN interface counters from LuCI RPC and calculates speed by comparing RX/TX byte counters every few seconds.

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

## Changelog

### v0.2.4

- Removed internal design-reference wording from user-facing files.
- Cleaned README and preview text so it focuses on user-facing features.
- Updated version references to 0.2.4.
- Kept the v0.2.3 status memory/progress bar fixes.
- Kept the v0.2.2 package manager, Backup/Flash and global CBI button fixes.

### v0.2.3

- Fixed LuCI Status / Overview memory progress bars not rendering correctly.
- Preserved native LuCI realtime graph/table markup instead of wrapping it as package tables.
- Improved `.cbi-progressbar` and `.progress` styling for memory, load and status widgets.
- Added better canvas/SVG compatibility for realtime graph pages.

## Licence

Apache-2.0
