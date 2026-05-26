# CleanX LuCI Theme

**CleanX** is a clean, modern LuCI theme for OpenWrt. It focuses on readable pages, responsive layout, dark/light mode, polished LuCI controls and a useful overview dashboard.

CleanX uses the current LuCI `ucode/template/themes/` structure and is designed for OpenWrt 23.05, 24.10, 25.12 and snapshot builds.

## Highlights

- Clean gradient background with no grid/box wallpaper
- Responsive sidebar with SVG icons
- Compact top bar with modern dark/light switch
- Mobile-friendly menu button and drawer
- Custom login page
- Live overview dashboard
- WAN download and upload speed
- CPU and RAM usage cards
- System uptime summary
- RX/TX traffic totals with B/KB/MB/GB/TB/PB formatting
- Styled LuCI forms, CBI sections, tables, tabs and action buttons
- Improved Overview Network and Wireless status output
- Improved Package Manager install/details modal
- Improved Backup / Flash, Processes, Startup and System pages
- GitHub Actions workflow for `.ipk` and `.apk` builds

## Compatibility

CleanX uses:

```text
ucode/template/themes/cleanx/
```

The package is architecture-independent and is built through the OpenWrt SDK.

## Preview and QA mocks

Open the preview gallery after extracting the repository:

```text
preview/index.html
```

Open the v0.3.7 QA mocks here:

```text
preview/qa-v034/index.html
```

```text
preview/qa-v031/index.html
```

The QA mocks include fake OpenWrt/LuCI data for the Overview dashboard, Network output, Wireless output, Package Manager install modal and compact mobile top bar.

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
├── preview/
├── scripts/
└── .github/workflows/build-openwrt-packages.yml
```

## Build packages using GitHub Actions

1. Upload this repository to GitHub.
2. Open the **Actions** tab.
3. Run **Build CleanX OpenWrt packages**.
4. Download the generated package artifact.

The workflow uses the official OpenWrt SDK and creates packages for the matching OpenWrt package system.

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

## Dashboard behaviour

The overview dashboard reads LuCI RPC data from the router.

Current behaviour:

- WAN speed is calculated from RX/TX byte counter changes.
- Traffic totals are interface counters since boot/interface reset.
- RAM usage comes from `system.info`.
- CPU usage uses `/proc/stat` when available and falls back to load-based estimation if file RPC is unavailable.
- System uptime updates on the overview dashboard.

For persistent monthly or yearly traffic totals, add `vnstat` or `nlbwmon` in a future release.

## Changelog

### v0.3.7

- Added CPU and RAM cards to the overview dashboard.
- Added small dashboard summary line for system uptime, total traffic and RAM total.
- Restyled Overview Hide/Show controls as modern pills.
- Fixed Overview Network output so labels and values do not run together.
- Fixed Overview Wireless output so radio and SSID details are readable.
- Improved Package Manager install/details modal dependency layout.
- Compact top bar controls and dark/light switch.
- Added a visible SVG mobile menu icon.
- Updated footer to link to the CleanX project repository.
- Cleaned user-facing text so it does not include internal prompt/design wording.
- Added v0.3.7 QA mock pages.

## Author

[Author: @Ox1d3x3 x CleanX Theme](https://github.com/ox1d3x3/cleanwrt-luci)

## Licence

Apache-2.0


## Release workflow

CleanX automatically creates a GitHub **pre-release** after a successful OpenWrt SDK build from `main`, `master`, or a manual workflow run.

Each pre-release includes the built `.ipk` and `.apk` packages, build logs, build summaries, release notes and SHA256 checksums. Stable releases are intentionally manual so router-tested builds can be promoted after validation.

See [`RELEASE_PROCESS.md`](RELEASE_PROCESS.md) for the full process.

### v0.3.7 QA focus

This build fixes native LuCI dropdown/action compatibility reported on DNS, Diagnostics, Startup, LED Configuration, System, Load and Processes pages. It keeps dropdowns compact by default and opens long DNS/DHCP lists as side-by-side grids only when the control is focused/open.

Open the v0.3.7 QA mock after extracting:

```text
preview/qa-v035/index.html
```
