---
title: Packaging and release
description: Turn a Tessera app into release builds, installers and deployable bundles for each platform.
---

# Packaging and release

When your app is ready to leave your machine, the `cargo tessera` CLI turns it into something you can hand to users: a release executable, a desktop installer, an Android APK or app bundle, an iOS application, or a directory you can put on a web server. Each platform has its own command, because each one needs different tools and produces a different kind of artifact:

| You want | Command | Builds on |
| --- | --- | --- |
| A native executable | `cargo tessera build` | Any desktop host, for its own target or a `--target` you have a toolchain for |
| A desktop installer or bundle | `cargo tessera package` | The OS you are packaging for |
| An APK or AAB | `cargo tessera android build` | Any host with the Android SDK, NDK and Java |
| A simulator app or IPA | `cargo tessera ios build` | macOS with Xcode |
| A deployable web directory | `cargo tessera web build` | Any host with the `wasm32-unknown-unknown` target |

Every one of these uses the debug profile unless you pass `--release`, so add it whenever you build something to ship.

## Set the app's identity

The display name, identifier and icon are shared by every platform, so you set them once in `tessera-app.toml`:

```toml
name = "My App"
identifier = "com.example.myapp"
icon = "icon.svg"
```

Packaging generates each platform's icons from this one file. Use a square PNG, or a square SVG whose text has been converted to outlines and whose resources are embedded. Android and iOS builds take the version number from `version` in your `Cargo.toml`. Keep the runtime defaults in your code aligned with this identity, as described in [Entry point and windows](/guide/app).

## Build a native executable

`cargo tessera build` checks Tessera call boundaries and compiles the app. In a workspace, choose the package with `--package`; if that package has more than one executable, choose one with `--bin`:

```sh
cargo tessera build --package my-app --bin my_app --release
```

`--target` selects a Rust target triple, which is all it does: install the cross-compilation toolchain and the target platform's packaging tools yourself.

By default, native builds embed assets in the executable. With `--asset-backend platform`, the build instead copies the assets your app uses into a resource directory next to the executable, such as `my_app.resources/tessera/`. If you ship a build like that, ship the directory with it, because that is where the app looks for its assets. See [Resources](/guide/assets).

## Package for desktop

`cargo tessera package` builds the app and hands its identity, executable and resources to `cargo-packager`, which produces the installer. Install the packager once:

```sh
cargo install cargo-packager --locked
cargo tessera package -p my-app --release
```

The command always builds with platform assets, includes the staged Tessera resources in the package, and writes the result under the Cargo target directory at `packages/my-app/`. Choose formats with `--formats`, as a comma-separated list:

| Platform | Formats |
| --- | --- |
| Windows | `nsis`, `wix` |
| macOS | `app`, `dmg` |
| Linux | `deb`, `appimage`, `pacman` |

For example, on a Linux packaging host:

```sh
cargo tessera package -p my-app --release --formats deb,appimage
```

`default` and `all` are also accepted and passed through to `cargo-packager`. Pick formats your host and its installed tools can actually produce; each OS's formats are built on that OS. Android, iOS and web targets are rejected here; use their own commands below.

The command also accepts `--target`, `--package` and `--bin`. Tessera supplies the application identity, the selected executable, the output location and the generated icons. Everything else, such as installer options or metadata, comes from `[package.metadata.packager]` in `Cargo.toml`.

::: warning
Set up signing and notarization with the platform's own tools, your credentials and your packager configuration. The command does not obtain certificates or guarantee that the installer it produces is signed, and macOS and Windows block or warn about unsigned apps that users download.
:::

## Android

Initialize the Android host project once, then build whichever artifact you need:

```sh
cargo tessera android init
cargo tessera android build -p my-app --release --format apk --arch arm64
cargo tessera android build -p my-app --release --format aab --arch arm64
```

`--format` accepts `apk` or `aab` and defaults to `apk`. `--arch` selects the Android CPU target and defaults to `arm64`; if you pass a value the CLI does not know, the error lists the supported ones. When the build finishes, the command prints the path of each artifact. You need the Android SDK, NDK and Java/Gradle toolchain described in [Platforms](/guide/platforms).

If you always build the same way, put the defaults in `Cargo.toml`. Flags on the command line still take precedence:

```toml
[package.metadata.tessera.android]
arch = "arm64"
format = "aab"
min_sdk = 26
```

`min_sdk` replaces the generated minimum SDK, which defaults to `24`. Runtime permissions are declared separately; see [Declare Android permissions](/guide/plugins#declare-android-permissions).

::: warning
Configure and verify signing in the Android build toolchain before you distribute an APK or upload an AAB. `--release` only selects the build profile, and the command has no flag for signing credentials.
:::

## iOS

iOS packaging runs only on macOS with Xcode installed. Without `--device`, the command builds an `.app` for the simulator architecture of the Mac you are on:

```sh
cargo tessera ios build -p my-app --release
```

To get an IPA, add `--device`. For the IPA to install on a device, also pass a signing identity installed on the Mac and a matching provisioning profile:

```sh
cargo tessera ios build -p my-app --release --device \
  --signing-identity "Apple Development: Your Name (TEAMID)" \
  --provisioning-profile signing/app.mobileprovision
```

The command signs with `codesign`, and without `--signing-identity` it signs ad hoc. Installing the IPA on devices and shipping it to the App Store also depend on certificates, profiles, entitlements and submission, which remain your project's responsibility.

Artifacts land under `packages/my-app/ios/` in the Cargo target directory, grouped by target triple. Use `--bin` to choose an executable. To customize the bundle, set any of these paths, relative to the application package, in `Cargo.toml`:

```toml
[package.metadata.tessera.ios]
info-plist = "ios/Info.plist"
asset-catalog = "ios/Assets.xcassets"
entitlements = "ios/app.entitlements"
resources = "ios/resources"
```

Keys from your `info-plist` are merged into the generated one, which is where usage descriptions such as camera access belong. The bundle name, identifier, version and executable always come from `tessera-app.toml` and `Cargo.toml`, and take precedence over the same keys in your plist.

## Web

To add browser support to a project, initialize it, add the Rust web target and build:

```sh
rustup target add wasm32-unknown-unknown
cargo tessera web init -p my-app
cargo tessera web build -p my-app --release
```

The CLI generates the browser bindings and optimizes the WebAssembly output, which is why release web builds need Binaryen 110 or newer with `wasm-opt` on your `PATH`. To enable Cargo features, pass `--features` (or `-F`); they apply to both the Tessera check and the web build.

The generated JavaScript, TypeScript declarations and WebAssembly go into `gen/web/pkg-web/` in the application package, and the browser also needs the rest of `gen/web/`. Deploy the **whole `gen/web/` directory** and keep its layout: the host `index.html`, `pkg-web/`, the generated application metadata and icons under `app/`, and the separately delivered assets under `tessera/`.

::: warning
Upload all of `gen/web/`. `pkg-web/` on its own leaves out the host page and the resources.
:::

Serve the directory over HTTP with WebAssembly support and open it in a WebGPU-capable browser. Public deployments need a secure browser context, which normally means HTTPS. After deploying, check that the asset URLs load as well as the first page. [Platforms](/guide/platforms#web) covers browser requirements, and the [CLI reference](/guide/cli#web) lists every web option.
