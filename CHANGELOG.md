# Changelog

All notable changes to CleanX are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.6.4] - 2026-11-05

### Added
- **Network Map**, a new page in the sidebar: a live map of everything
  connected to the router, drawn in CleanX's own style. It runs from the
  Internet to the router, then to each Wi-Fi and wired network and the devices
  on it.
  - Links light up and move while traffic flows, faster with more traffic.
    Quiet links rest and offline ones are dashed.
  - Summary cards show the number of devices, Internet speed (download and
    upload), Wi-Fi networks and radios, and the most active device.
  - Each device shows a type icon, its IP address, Wi-Fi signal and current
    speed. Wired devices show the LAN port they are plugged into, read from the
    bridge's forwarding table.
  - Selecting a device opens its details: IPv4/IPv6, MAC, signal, link rate,
    connected time, current traffic and why it was detected as that type. The
    dialog can also rename the device and change its icon. Names and icons are
    saved to `/etc/config/cleanx`, so they are kept across firmware upgrades.
    Names given in UniWRT's map are shown too.
  - Device types come from the hostname, the maker of the network card and
    private (randomised) Wi-Fi addresses. The `ufpd` fingerprinting service is
    used too when it is installed.
  - **Access-point mode**: when the router sits behind a main router, the map
    shows the main router at the top, marks the LAN port it is connected to,
    and still places wired devices by port.
  - Works in light and dark mode, on desktop and phone, and with the keyboard.
- New `netmap_interval` option (3–60 seconds, default 5).

### Performance
- The Network Map costs the router about as much as LuCI's own Status pages:
  one batched request per refresh, and only while the page is open in a
  visible tab. Layout, device detection and rate maths run in the browser, and
  the page is only rebuilt when devices join, leave or are renamed.
- Links are drawn with CSS; nothing is measured in JavaScript, and they are
  animated by the browser's compositor. They move only while traffic flows,
  pause while a dialog is open, and stay still with `animations=off` or the
  system's *reduce motion* setting. The page also leaves out the faint blurred
  background shapes, which the browser would otherwise re-blur on every frame.
  This keeps the moving links at 60 fps even without GPU acceleration, where
  frames otherwise took about 130 ms.

### Changed
- With UniWRT installed alongside, CleanX's sidebar lists one Network Map, its
  own. UniWRT's map only works under UniWRT.
- The theme's rpcd access rules now also cover the Network Map: host hints,
  network and Wi-Fi devices, Wi-Fi station lists, bridge port tables, and
  saving names to the `cleanx` config.
- CI runs new Network Map checks (`tests/ui/netmap.test.js`) after the UI audit
  on OpenWrt 24.10 and 25.12. They cover desktop, phone, light and dark mode,
  access-point mode, the device dialog, saving a name and icon, and the
  message shown under other themes. The mocked router gained Wi-Fi clients,
  wired hosts behind bridge ports, live traffic counters and an access-point
  scenario.

## [0.6.3] - 2026-11-05

A deep interaction pass: every page, tab, Edit/Add dialog and control of
OpenWrt 24.10 and 25.12 was clicked through with a real mouse on real LuCI,
with CleanX and with stock LuCI (Bootstrap) side by side. Everything below
was found that way and is now covered by an automated test.

### Fixed
- **Dropdown options that could not be selected.** Closed dropdowns showed
  every choice instead of just the current one, but LuCI treats any click on
  a closed dropdown as "open the list", so clicking the option you wanted
  did nothing. Closed dropdowns now show only the selection, as in LuCI.
- **Checkboxes in multi-selects that did nothing** (LED trigger modes,
  networks in Wireless and Firewall dialogs, ...). They were visible while
  the list was closed, where LuCI ignores clicks on them. They now appear only
  in the open list, where they work.
- **Selection preview duplicated every option** while a list was open; a click
  on that copy closed the list instead of selecting.
- **Long dropdown lists in dialogs** (IP protocol, routing tables, helpers,
  lease times, ...) let their items spill out of the list, where the fields
  below painted over them, or collapsed to a sliver near the edge of a dialog.
  Open lists now have a fixed height and scroll.
- **Tabs inside dialogs did not switch.** Every tab pane of a dialog was shown
  at once (Mount Points, Wireless, Interfaces, Firewall, Routing, LED, ...),
  so dialogs were very long and the tabs seemed to do nothing.
- **Options LuCI hides were shown.** Settings whose conditions are not met
  (for example "Bind NTP server" with the NTP server off, bonding options on a
  bridge, VLAN ID on a non-VLAN device, TFTP options with TFTP disabled) were
  visible and editable, but LuCI ignores them when saving.
- **Wireless Edit dialog layout.** Device Configuration was squeezed into a
  narrow column and Interface Configuration (Mode, ESSID, Network, ...) was
  pushed out of reach. Sections nested in dialogs span the full width again.
- **Empty tabs** such as DNSSEC (when it has nothing to show) appeared and
  opened a blank page; they are hidden like in LuCI.
- **Local Startup (rc.local) is available again** on System > Startup. Older
  versions hid it to work around the tab bug above.
- Items scrolled to the bottom of a dialog no longer end up hidden behind the
  pinned Dismiss / Save bar.
- On phones, a select with long option labels (e.g. Firewall NAT "Action")
  no longer pushes the whole dialog sideways and cuts off its fields.
- The sidebar no longer highlights System > Administration on every page.

### Performance
- Decorative icon loops (sidebar icons, dashboard stat icons, status dots) now
  play twice after a page loads and then rest; they previously ran forever and
  made the browser redraw the blurred background on every frame. With software
  rendering (no GPU acceleration) an idle page dropped from about 180 ms to
  17 ms per frame, the same as stock LuCI. `animations=full` keeps the loops.
- Page animations pause while a dialog is open (dialogs: about 330 ms to 17 ms
  per frame with software rendering), so dropdown lists in dialogs open
  promptly.
- The hidden page loader no longer keeps animating in the background.

### Changed
- Removed CleanX's own tab-switching scripts. LuCI switches tabs itself; the
  extra handlers could hide the wrong group of options and are no longer
  needed now that the styling follows LuCI's tab state.
- New CI job: a UI interaction audit (`tests/ui/`) renders every LuCI page with
  the real LuCI templates and JavaScript and compares CleanX against stock
  LuCI on OpenWrt 24.10 and 25.12. Releases are blocked if it finds a control
  that works with stock LuCI but not with CleanX.

## [0.6.2] - 2026-11-03

### Added
- **Standalone install that survives firmware upgrades.** The new
  `cleanx-apply.sh` installs CleanX without registering a package, so
  Attended Sysupgrade (LuCI's Firmware Upgrade page and `owut`) no longer
  fails with *"Impossible package selection"*. Every installed file is listed
  in `/lib/upgrade/keep.d/cleanx-standalone`, so the theme and its settings
  are carried into the new firmware when *Keep settings* is on.
- `cleanx-apply.sh` also updates in place (removing files a newer version no
  longer ships), checks installs with `--status`, removes them with
  `--uninstall`, installs a pinned release with `--version`, installs offline
  with `--file`, and still offers the classic package with `--package`.
  Downloads are verified against `SHA256SUMS`, and free space is checked
  before anything is changed.
- Existing package installs switch over by simply running the script: the
  package is removed, the standalone copy is installed, and settings and the
  active theme are kept.
- Releases now include `luci-theme-cleanx-standalone.tar.gz` (cut from the
  same build as the `.ipk`, so files are byte-identical), `cleanx-apply.sh`
  and `SHA256SUMS`.
- CI tests the installer against a simulated router using OpenWrt's own
  BusyBox, `uci` and `apk`, including a simulated firmware upgrade and a real
  `.apk` package migration, before anything is published.

### Fixed
- Installing CleanX no longer removes **UniWRT Portal** from the theme list
  when it is installed alongside. Theme entries left by early CleanX
  development builds (UniWRT, X1Wrt) are only cleaned up when those themes
  aren't actually present.
- `/etc/config/cleanx` now ships with the package as a configuration file
  with documented defaults, so package upgrades keep your settings.

### Changed
- The one-line installer (`scripts/install.sh`) now performs a standalone
  install. `scripts/uninstall.sh` removes either kind of install.
- Release checksums are published as `SHA256SUMS` (previously `SHA256SUMS.txt`).

## [0.6.1] - 2026-10-28

### Fixed
- **Fresh installs now actually select CleanX.** The package still shipped the
  retired UniWRT and X1Wrt development themes, and their `uci-defaults`
  scripts ran after CleanX's, re-registering both themes and switching the
  active theme to X1Wrt. They are removed, and upgrades from builds that
  point at either old path are moved to CleanX.
- The `cleanx` UCI config is now created on install. Previously
  `/etc/config/cleanx` never existed, so the theme mode, dashboard and
  animation settings could not be saved.
- `scripts/install.sh` and `scripts/uninstall.sh` targeted the old
  `uniwrt-luci` repository and package. They now install the latest CleanX
  release (picking `.ipk`, `.apk` or snapshot `.apk` automatically) and
  remove CleanX cleanly.
- `localStorage` access is guarded, so private-browsing modes or blocked site
  data no longer break theme switching.

### Performance
- All DOM enhancers now share one `MutationObserver` instead of seven, run at
  most once per animation frame, and pause the observer while CleanX edits
  the page so its own changes no longer trigger another round. On pages LuCI
  refreshes constantly (Processes, Realtime Graphs, Overview) this roughly
  halves the DOM querying with identical output.
- Overview dashboard and memory widgets skip their RPC polls while the browser
  tab is hidden.
- Scroll progress bar updates are throttled to one per frame; the clock wakes
  once per minute instead of every 30 seconds.
- Removed a permanent `will-change` from every navigation icon, which kept
  dozens of GPU layers alive for no visual benefit.
- The blurred background blobs are now static by default. Their drift is
  opt-in with `uci set cleanx.theme.animations=full`.
- Removed 488 stylesheet declarations that could never take effect (each was
  re-declared later with the same selector, value and priority).
- Release packages ship minified CSS (`main.css` 423 KB → 337 KB). The
  repository keeps the readable source.

### Changed
- Pushing a new `VERSION` to `main` now publishes a **stable** release
  automatically; other pushes publish pre-releases as before.
- Added `scripts/bump-version.sh` to update every hard-coded version string
  in one step, with a `--check` mode used by CI.
- Removed stale QA snapshot folders from `preview/`. The preview gallery and
  `preview/compat/` mocks now load the real theme stylesheet instead of an
  outdated copy.
- README rewritten.

## [0.6.0] - 2026-05-28

### Changed
- GitHub Actions publish architecture-independent universal packages named
  `all-openwrt-*-universal`. CleanX contains no compiled binaries, so one
  package works on ARM, ARM64, MIPS, x86 and x86_64 for the matching
  package-manager generation.
- x86/64 is used as a neutral SDK build target while keeping `PKGARCH:=all`.

### Fixed
- Per-cell alignment for **Network → Firewall → Traffic Rules** and
  **Network → Interfaces → Devices**: each data cell shows its field label so
  descriptions and values stay visually connected.

## [0.5.8] - 2026-05-27

### Fixed
- Traffic Rules table fills the full card width.
- Devices table uses clear column dividers and hides LuCI tooltip payloads that
  overlapped the rows.
- Interfaces summary layout restored without artificial internal labels.
- Removed the duplicated header bar from Firewall → General Settings → Zones.

### Changed
- Old development theme names (UniWRT, X1Wrt) are removed from the LuCI design
  list on install and upgrade.

## [0.5.5] - 2026-05-27

### Fixed
- Network Devices table is no longer misclassified as a routing table.
- Header-aligned cell sizing and borders for the Devices table.
- Traffic Rules column sizing and badge contrast, keeping Match / Action /
  Enable / Actions aligned.

## [0.5.4] - 2026-05-27

### Fixed
- Firewall Zones, LED and Interfaces/Devices tables are classified correctly.
- Isolated cell borders and safer column sizing for firewall zone and rule rows.
- LED-specific table sizing that keeps native checkbox and dropdown behaviour.
- Realtime Graphs → Load renders correctly again (regression from 0.5.1).
- Alignment recovery for DHCP, DNS, Diagnostics, System, Load and Traffic Rules.
- Table cells no longer collapse into vertical text.
- CBI label/field alignment on DNS, DHCP and System style forms.
- Loader failsafe: LuCI can no longer stay hidden behind the CleanX loading
  screen if an optional enhancer fails; enhancers are individually guarded.

### Changed
- DNS/DHCP multi-select dropdowns open as compact scrollable grids.
- Save & Apply is a primary button plus a separate "More" action.
- Workflow triggers on every push to `main`; LF line endings enforced via
  `.gitattributes`.

## [0.4.7] - 2026-05-26

### Fixed
- Top bar router/page title is centred correctly, with responsive truncation
  for long titles.

## [0.4.3] - 2026-05-26

### Fixed
- Native table layout restored for DHCP, Startup, Wireless, Processes and
  Routing.
- Compact Startup and Processes action buttons.
- Local Startup panel hidden on the Startup page.
- Realtime Graphs, Load and Channel Analysis graphs stay inside their cards.
- Sticky action cells for wide Network/DHCP/Overview tables where supported.

## [0.3.9] - 2026-05-26

### Fixed
- Native LuCI tab behaviour on System and Startup pages.
- DNS/DHCP multi-select fields render inline, scrollable and clickable.
- LED edit modal checkbox alignment.
- Diagnostics IPv4/IPv6 actions shown as separate buttons.
- Release asset names no longer repeat the package extension.

### Changed
- CleanX-specific pre-release workflow replaces the old UniWRT workflow.

## [0.3.2] - 2026-05-26

### Added
- Automated GitHub pre-releases after successful OpenWrt SDK builds, with
  `.ipk`/`.apk` packages and SHA256 checksums.

## [0.3.1] - 2026-05-26

### Added
- Live CPU and RAM cards on the Overview page.
- Uptime, total traffic and RAM total summary line.

### Fixed
- Overview Network and Wireless sections space labels and values cleanly.
- Modern compact Show/Hide buttons.

[0.6.4]: https://github.com/Ox1d3x3/cleanwrt-luci/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/Ox1d3x3/cleanwrt-luci/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/Ox1d3x3/cleanwrt-luci/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/Ox1d3x3/cleanwrt-luci/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/Ox1d3x3/cleanwrt-luci/releases/tag/v0.6.0
