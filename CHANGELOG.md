# Changelog

All notable user-facing CleanX changes are tracked here. GitHub Actions uses this file when generating automated pre-release notes.

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
