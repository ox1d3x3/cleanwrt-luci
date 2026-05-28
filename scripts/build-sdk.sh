#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# CleanX local/OpenWrt SDK package builder.
set -euo pipefail

PACKAGE_NAME="${PACKAGE_NAME:-luci-theme-cleanx}"
OPENWRT_VERSION="${OPENWRT_VERSION:-25.12.4}"
TARGET="${TARGET:-x86}"
SUBTARGET="${SUBTARGET:-64}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="${WORK_DIR:-$ROOT_DIR/.sdk-$OPENWRT_VERSION-$TARGET-$SUBTARGET}"
DIST_DIR="$ROOT_DIR/dist"
SDK_BASE="https://downloads.openwrt.org/releases/${OPENWRT_VERSION}/targets/${TARGET}/${SUBTARGET}/"

case "${OPENWRT_VERSION}" in
  snapshot|SNAPSHOT)
    SDK_BASE="https://downloads.openwrt.org/snapshots/targets/${TARGET}/${SUBTARGET}/"
    ;;
esac

mkdir -p "$WORK_DIR" "$DIST_DIR"
cd "$WORK_DIR"

printf '==> Discovering SDK at %s\n' "$SDK_BASE"
SDK_FILE="$(curl -fsSL "$SDK_BASE" | grep -oE 'openwrt-sdk-[^"<>]+Linux-x86_64\.tar\.(xz|zst)' | head -n1)"
[ -n "$SDK_FILE" ] || { echo "ERROR: SDK file not found at $SDK_BASE" >&2; exit 1; }

if [ ! -d sdk ]; then
  printf '==> Downloading %s\n' "$SDK_FILE"
  curl -fL "$SDK_BASE$SDK_FILE" -o "$SDK_FILE"
  printf '==> Extracting SDK\n'
  SDK_TOPDIR="$(tar -tf "$SDK_FILE" | head -n1 | cut -d/ -f1)"
  [ -n "$SDK_TOPDIR" ] || { echo "ERROR: Could not detect SDK root directory in $SDK_FILE" >&2; exit 1; }
  rm -rf "$SDK_TOPDIR" sdk
  case "$SDK_FILE" in
    *.tar.zst) tar --zstd -xf "$SDK_FILE" ;;
    *.tar.xz) tar -xf "$SDK_FILE" ;;
    *) echo "ERROR: Unsupported SDK archive: $SDK_FILE" >&2; exit 1 ;;
  esac
  [ -d "$SDK_TOPDIR" ] || { echo "ERROR: Extracted SDK directory not found: $SDK_TOPDIR" >&2; exit 1; }
  mv "$SDK_TOPDIR" sdk
fi

printf '==> Copying %s package source\n' "$PACKAGE_NAME"
rm -rf "sdk/package/custom/$PACKAGE_NAME"
mkdir -p "sdk/package/custom/$PACKAGE_NAME"
rsync -a --delete \
  --exclude '.git' \
  --exclude '.github' \
  --exclude '.sdk-*' \
  --exclude 'dist' \
  --exclude 'package-artifacts' \
  --exclude 'build-logs' \
  --exclude '*.zip' \
  "$ROOT_DIR/" "sdk/package/custom/$PACKAGE_NAME/"

cd sdk
printf '==> Updating feeds\n'
./scripts/feeds update -a
./scripts/feeds install -a
make defconfig

printf '==> Building %s for OpenWrt %s (PKGARCH=all universal package)\n' "$PACKAGE_NAME" "$OPENWRT_VERSION"
make "package/$PACKAGE_NAME/clean" V=s || true
make "package/$PACKAGE_NAME/compile" V=s 2>&1 | tee "$DIST_DIR/build-${OPENWRT_VERSION}.log"

printf '==> Collecting packages\n'
find bin -type f \( -name "${PACKAGE_NAME}*.ipk" -o -name "${PACKAGE_NAME}*.apk" \) -print -exec cp -f {} "$DIST_DIR/" \;
for f in "$DIST_DIR"/${PACKAGE_NAME}*.ipk; do [ -e "$f" ] && cp -f "$f" "$DIST_DIR/${PACKAGE_NAME}.ipk"; done
for f in "$DIST_DIR"/${PACKAGE_NAME}*.apk; do [ -e "$f" ] && cp -f "$f" "$DIST_DIR/${PACKAGE_NAME}.apk"; done
printf '==> Done. Output is in %s\n' "$DIST_DIR"
