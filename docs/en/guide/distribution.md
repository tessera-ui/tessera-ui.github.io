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
| iOS `.app` / IPA | `cargo tessera ios build --release` | macOS with Xcode and XcodeGen |
| Web bundle (`gen/web/`) | `cargo tessera web build --release` | Host with `wasm32-unknown-unknown` & `wasm-opt` |

## Shared application identity

Set display name, reverse-domain identifier, and icon once in the `[app]` table of `tessera.toml`:

```toml
[app]
name = "My App"
identifier = "com.example.myapp"
icon = "icon.svg"
```

Every platform icon is generated from this file (use a square PNG of at least 1024 × 1024, or a square SVG with text converted to outlines and external resources embedded). Versions come from `Cargo.toml`; the Android `versionCode` is `major * 1_000_000 + minor * 1_000 + patch + 1`.

Platform settings such as permissions, SDK versions, entitlements, and signing live in each platform's own files: the Android and Xcode projects under `gen/`, or `[package.metadata.packager]` for desktop packages.

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

Supported `--formats` values: Windows (`nsis`, `wix`), macOS (`app`, `dmg`), Linux (`deb`, `appimage`, `pacman`), plus `default` and `all`. Outputs are written under Cargo's target directory at `packages/my-app/`. The application name, identifier, version, and icon come from `tessera.toml` and Cargo; put signing, installer settings, and additional resources in `[package.metadata.packager]` in `Cargo.toml`.

## Android

Install the Android SDK and NDK, a JDK supported by Gradle 8.14 (17 or 21), and put `adb` on your `PATH`. Generate `gen/android/` once, then build APKs or AABs:

```sh
cargo tessera android init
cargo tessera android build -p my-app --release --format apk --arch arm64
cargo tessera android build -p my-app --release --format aab --arch arm64
```

`--arch` accepts `arm64` (default), `arm`, `x86`, and `x86_64`; `--format` accepts `apk` (default) and `aab`.

`gen/android/` belongs to your app: commit it and edit it like any Android project. Declare permissions in `app/src/main/AndroidManifest.xml`, and set `minSdk`, Gradle plugins, dependencies, and release signing in `app/build.gradle.kts`. `cargo tessera` does not modify these files after `init`; `android init --force` regenerates them, replacing local changes.

On every Android command, `cargo tessera` rewrites only the files it maintains, all excluded by the generated `.gitignore`:

| File | Contents |
| --- | --- |
| `tessera.properties` | Application ID, `versionCode`, `versionName`, library name, and Rust project path, read by `app/build.gradle.kts` |
| `tessera.settings.gradle` | Plugin modules, applied from `settings.gradle` |
| `tessera.build.gradle.kts` | Plugin module dependencies |
| `buildSrc/`, `tessera-plugins/` | Rust build integration and copied plugin modules |
| `app/src/main/tessera-res/` | Application name and icons |
| `app/src/main/assets/tessera/` | Platform assets |

A fresh clone needs one `cargo tessera` Android command before Android Studio can sync the project.

## iOS

On macOS with Xcode and [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`), generate the Xcode project once, then build a simulator `.app` or a device IPA:

```sh
cargo tessera apple init -p my-app
cargo tessera ios build -p my-app --release
cargo tessera ios build -p my-app --release --device
```

`ios build` runs `xcodebuild`; `--device` archives the app and exports an IPA using `gen/apple/ExportOptions.plist`. Outputs are written under Cargo's target directory at `packages/my-app/ios/<target triple>/`.

`gen/apple/` contains an Xcode project with an iOS and a macOS target. It belongs to your app: commit it and open the `.xcodeproj` in Xcode. Set the signing team, capabilities, and entitlements in Xcode, and add usage descriptions and other keys to `iOS/Info.plist` or `macOS/Info.plist`. Both targets run `cargo tessera apple rust-build` as a build phase, so building in Xcode also builds the Rust executable and its assets.

On every Apple command, `cargo tessera` rewrites `tessera.xcconfig` (bundle identifier, display name, and versions) and `Tessera.xcassets` (app icon); both are excluded by the generated `.gitignore`, so run any Apple command once after a fresh clone. `apple init --force` regenerates the editable files, replacing local changes.

## macOS

Distribute macOS apps outside the App Store with `cargo tessera package --formats app,dmg`. For the Mac App Store, archive the macOS target of the `gen/apple/` Xcode project in Xcode (Product → Archive).

## Web

Initialize web host files once if missing, then build with Binaryen 110+ (`wasm-opt`) on `PATH`:

```sh
rustup target add wasm32-unknown-unknown
cargo tessera web init -p my-app
cargo tessera web build -p my-app --release
```

`gen/web/index.html` belongs to your app. Its `<head>` must contain a `<!-- tessera-app -->` … `<!-- /tessera-app -->` block: web commands rewrite only that block (title, icons, and manifest link) and report an error if it is missing. Everything else, including your own elements, is preserved.

Deploy the **entire `gen/web/` directory** (keeping `index.html`, `pkg-web/`, `app/`, and `tessera/` together) on a static HTTP server with `.wasm` MIME support over HTTPS (or `localhost`).
