# Changelog

All notable user-facing CleanX changes are tracked here. GitHub Actions uses this file when generating automated pre-release notes.

## [0.3.6] - 2026-05-26

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
