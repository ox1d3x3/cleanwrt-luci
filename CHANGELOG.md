# Changelog

All notable changes to CleanX are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

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

[0.6.1]: https://github.com/Ox1d3x3/cleanwrt-luci/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/Ox1d3x3/cleanwrt-luci/releases/tag/v0.6.0
