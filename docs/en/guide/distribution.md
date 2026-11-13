---
title: Packaging and release
description: Build release binaries, desktop installers, Android APKs/AABs, iOS bundles, and deployable WebGPU sites.
---

# Packaging and release

Use `cargo tessera` to produce release builds for every target. Pass `--release` on every command below when building artifacts to ship.

| Artifact | Command | Required host |
| --- | --- | --- |
| Native binary | `cargo tessera build --release` | Matching desktop OS (or cross toolchain) |
| Desktop installer / bundle | `cargo tessera package --release` | Target desktop OS |
| Android APK / AAB | `cargo tessera android build --release` | Host with Android SDK, NDK, and JDK |
| iOS `.app` / IPA | `cargo tessera ios build --release` | macOS with Xcode |
| Web bundle (`gen/web/`) | `cargo tessera web build --release` | Host with `wasm32-unknown-unknown` & `wasm-opt` |

## Shared application identity

Set display name, reverse-domain identifier, and icon once in `tessera-app.toml`:

```toml
name = "My App"
identifier = "com.example.myapp"
icon = "icon.svg"
```

Every platform icon is generated from this file (use a square PNG, or a square SVG with text converted to outlines and external resources embedded). Android and iOS read the version string from `Cargo.toml`.

## Native executables and desktop installers

Build a native binary:

```sh
cargo tessera build --package my-app --bin my_app --release
```

Native builds embed assets by default. Passing `--asset-backend platform` stages assets into `<bin>.resources/tessera/` next to the binary—ship that folder alongside the executable.

To create installers or OS bundles via `cargo-packager`:

```sh
cargo install cargo-packager --locked
cargo tessera package -p my-app --release --formats default
```

Supported `--formats` values: Windows (`nsis`, `wix`), macOS (`app`, `dmg`), Linux (`deb`, `appimage`, `pacman`), plus `default` and `all`. Outputs are written under Cargo's target directory at `packages/my-app/`. Extra packager settings go in `[package.metadata.packager]` in `Cargo.toml`. Configure code signing and notarization with your platform certificates and packager config.

## Android

Initialize `gen/android/` once, then build APKs or AABs:

```sh
cargo tessera android init
cargo tessera android build -p my-app --release --format apk --arch arm64
cargo tessera android build -p my-app --release --format aab --arch arm64
```

Persist defaults in `Cargo.toml` under `[package.metadata.tessera.android]` (`arch`, `format`, `min_sdk`); CLI flags override them. Configure release signing in your Android toolchain before distribution.

## iOS

Build a simulator `.app` or a signed device `.ipa` on macOS:

```sh
cargo tessera ios build -p my-app --release
cargo tessera ios build -p my-app --release --device \
  --signing-identity "Apple Development: Your Name (TEAMID)" \
  --provisioning-profile signing/app.mobileprovision
```

Outputs land under `target/<triple>/release` / `packages/my-app/ios/`. Customize plist, asset catalogs, entitlements, and extra resources in `Cargo.toml`:

```toml
[package.metadata.tessera.ios]
info-plist = "ios/Info.plist"
asset-catalog = "ios/Assets.xcassets"
entitlements = "ios/app.entitlements"
resources = "ios/resources"
```

Keys from `tessera-app.toml` and `Cargo.toml` (`name`, `identifier`, `version`, executable name) override matching keys in your custom `Info.plist`.

## Web

Initialize web host files once if missing, then build with Binaryen 110+ (`wasm-opt`) on `PATH`:

```sh
rustup target add wasm32-unknown-unknown
cargo tessera web init -p my-app
cargo tessera web build -p my-app --release
```

Deploy the **entire `gen/web/` directory** (keeping `index.html`, `pkg-web/`, `app/`, and `tessera/` together) on a static HTTP server with `.wasm` MIME support over HTTPS (or `localhost`).
