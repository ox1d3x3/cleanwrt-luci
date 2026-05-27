# Changelog

## v0.5.3

### Fixed
- Focused recovery for the uploaded saved issue pages: Firewall Zones, Traffic Rules, Interfaces/Devices and LED Configuration.
- Reordered table classification so LED and Interfaces/Devices tables are no longer misclassified as Firewall/Routing.
- Added isolated cell borders and safer column sizing for firewall zone/rule rows.
- Added LED-specific table sizing while keeping native LuCI checkbox/dropdown behaviour untouched.
- Added Interfaces/Devices column sizing for Device, Type, MAC Address and MTU fields.
- Kept graph and realtime-page behaviour unchanged from v0.5.2.

## v0.5.3

- Fixed a v0.5.1 regression where Status → Realtime Graphs / Load could render incorrectly.
- Restored the v0.4.9-safe graph behaviour for `admin-status-realtime*` pages only.
- Left Channel Analysis untouched because the previous fix improved it.
- No table/form/control changes were made in this release.



## v0.5.3

- Added saved-page alignment recovery for DHCP, DNS, Diagnostics, System, Load and Traffic Rules pages.
- Added runtime technical table classification for LuCI data-heavy tables.
- Fixed table cells collapsing into vertical text by using readable natural table widths with controlled horizontal scrolling.
- Fixed CBI value label/field alignment across DNS/DHCP/System style forms.
- Improved DNS/DHCP multi-select dropdowns so long option lists open as compact scrollable grids.
- Improved graph containment for Load, Realtime Graphs and Channel Analysis.
- Added stronger fallback tab switching for CBI tab pages on OpenWrt 25.x.

## v0.5.3

### Fixed
- Added a loader failsafe so LuCI can no longer remain stuck behind the CleanX loading screen if an optional JavaScript enhancer fails.
- Wrapped optional UI enhancers with safe error handling. Native LuCI content should still render even if one CleanX enhancement hits an unexpected page structure.
- Updated cache-busting version strings for CleanX CSS assets.


## v0.5.3

- Fixed GitHub Actions auto-trigger behaviour after GitHub Desktop push.
- Replaced stale UniWRT workflow references with CleanX workflow naming.
- Removed path filters from the pre-release workflow so every push to main/master starts a build.
- Kept package assets architecture-independent with `all-openwrt-*` release naming.


## v0.5.3

- GitHub Desktop commit safety fix.
- Removed long saved-browser QA page filenames from the tracked repo package.
- Added `.gitattributes` to keep LF line endings and reduce CRLF warnings.
- Updated `.gitignore` to keep future saved HTML resource folders out of Git.
- No LuCI runtime styling regression intended from this build.



## v0.5.3

- Added a real LuCI table recovery pass for DHCP, DNS, Routing, Firewall, LED, Interfaces, Wireless, Software, Startup and Processes.
- Stopped technical table cells from collapsing into vertical letters.
- Restored div.table based LuCI data tables to native table behaviour on data-heavy pages.
- Improved graph containment for Load, Realtime Graphs and Channel Analysis.
- Kept Save & Apply as a modern primary button plus separate More action.

## [0.4.7] - 2026-05-26

### Fixed
- Centred the top bar router/page title so it no longer appears slightly off-position.
- Added safer responsive truncation for long page titles.

## [0.4.3] - 2026-05-26

### Fixed
- Restored native LuCI table layout for DHCP, Startup, Wireless, Processes and Routing pages.
- Compacted Startup and Processes action buttons without forcing huge row heights.
- Hid the unreliable Local Startup panel when CleanX detects the Startup page.
- Improved LED trigger-mode checkbox layout while keeping native LuCI input handling.
- Improved Realtime Graphs, Load and Channel Analysis containers so graphs stay inside their cards.
- Improved Save & Apply dropdown styling so it stays compact and modern.
- Added sticky action cells for wide Network/DHCP/Overview tables where supported.

### Changed
- Workflow release assets now use architecture-independent `all-openwrt-*` naming.

# Changelog



## v0.3.9 - Workflow recovery

### Fixed
- Replaced the stale `Build UniWRT packages` workflow with a CleanX-specific pre-release workflow.
- Fixed package build jobs still referencing `luci-theme-uniwrt` instead of `luci-theme-cleanx`.
- Added a compatibility `scripts/build-sdk.sh` that uses CleanX names and current OpenWrt SDK targets.
- Made the older manual build workflow dispatch-only to avoid duplicate or conflicting release jobs.

### Changed
- Pre-release assets are generated with clean package names and attached with build logs, summaries and checksums.
- Release notes now clearly identify the package target and format.

All notable user-facing CleanX changes are tracked here. GitHub Actions uses this file when generating automated pre-release notes.

## [0.3.9] - 2026-05-26

### Fixed
- Fixed automated pre-release package asset names so `.apk` and `.ipk` extensions appear only once.
- Release package names now use target suffixes such as `openwrt-25.12.4-mt7622.apk` instead of `openwrt-25.12.4-mt7622-apk.apk`.
- Release notes now explain the correct package format clearly for OpenWrt 24.10 and OpenWrt 25.12/snapshot builds.

### Changed
- Kept GitHub Actions artifact group names descriptive, but separated them from release asset file names.

## [0.3.2] - 2026-05-26

### Added
- Automated GitHub **pre-release** publishing after successful OpenWrt SDK builds.
- Release assets now include `.ipk`, `.apk`, build logs, build summaries, release notes and SHA256 checksums.
- Pre-release notes now include changes, fixes, features, package list, logs and recent commits.

### Changed
- Build workflow now uses `contents: write` only so GitHub Actions can create pre-releases with the default `GITHUB_TOKEN`.
- Stable releases are intentionally manual, so tested builds can be promoted only after router validation.

### Fixed
- Build logs are uploaded even if a matrix build fails, making broken SDK/package builds easier to diagnose.

## [0.3.1] - 2026-05-26

### Added
- Live CPU and RAM cards on the Overview page.
- System uptime, total traffic and RAM total summary line.

### Fixed
- Overview Network and Wireless sections now space labels and values cleanly.
- Show/Hide buttons are styled as modern compact controls.
- Footer now links to the CleanX project repository.

## v0.3.9 - Stable-candidate LuCI control recovery

### Fixed
- Recovered native LuCI tab behaviour for System and Startup pages.
- Hid the broken Local Startup tab on the Startup page to avoid a dead UI path.
- Added final conservative overrides for DNS/DHCP multi-select fields so long options render inline, scrollable and clickable without floating over later fields.
- Improved LED edit modal checkbox alignment and click targets.
- Compacted Startup and Processes action buttons and reduced excessive row height.
- Added full-width Realtime Graphs, Load and Channel Analysis graph container rules to prevent clipped half-graphs.
- Kept Diagnostics IPv4/IPv6 actions split into separate visible buttons while leaving LuCI handlers intact.

### QA
- Added focused mock pages under `preview/qa-v039/` for DNS/DHCP, LED modal, Startup, Diagnostics and graph pages.
