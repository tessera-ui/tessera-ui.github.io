---
title: Platforms
description: Toolchain requirements and host behavior across Windows, macOS, Linux, Android, iOS, and the web.
---

# Platforms

One Tessera codebase targets six platforms from the same shared `EntryPoint` in `src/lib.rs` (see [Entry point, windows, and sessions](/guide/app)):

| Platform | Entry call | Rust target |
| --- | --- | --- |
| Windows, macOS, Linux | `run_desktop()` | Host triple |
| iOS | `run_ios()` (main thread) | `aarch64-apple-ios` or simulator triple |
| Android | `run_android(app)` (via `#[tessera_ui::entry]`) | `aarch64-linux-android` (default) |
| Web | `run_web()` (via `#[wasm_bindgen(start)]`) | `wasm32-unknown-unknown` |

## Requirements at a glance

Every native target requires Rust 1.98+, a native C/C++ linker, and a supported GPU driver:

| Platform | Host and runtime requirements |
| --- | --- |
| Windows | Windows build tools/SDK; Direct3D 12-capable GPU and driver |
| macOS | Apple Xcode/Command Line Tools; Metal-capable GPU and driver |
| Linux | C/C++ toolchain, X11 or Wayland client libraries, `libxkbcommon`, and a Vulkan-capable GPU driver |
| Android | Android SDK and NDK, JDK for Gradle, and a device/emulator (`minSdk` defaults to `24`) |
| iOS | macOS with Xcode and iOS SDK (`IPHONEOS_DEPLOYMENT_TARGET` defaults to `15.0`) |
| Web | `wasm32-unknown-unknown` target, a WebGPU-enabled browser in a secure context (HTTPS or `localhost`), and Binaryen 110+ (`wasm-opt`) for release builds |

## Desktop notes

- **Windows**: uses Direct3D 12 by default. Keep `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` in `src/main.rs` so release builds do not spawn a console window.
- **macOS**: uses AppKit and Metal (`run_desktop()`). When using `.with_app_titlebar()`, macOS retains native window buttons while letting the app bar act as a drag region.
- **Linux**: supports both X11 and Wayland; verify target machines ship the display client libraries, `libxkbcommon`, and working Vulkan drivers.

## Mobile notes

- **Android**: uses `GameActivity`. Pad full-screen content with `WindowInsets::SystemBars` or `WindowInsets::SafeDrawing` (or `WindowInsets::Ime` for keyboard occlusion). `shard_home` handles predictive back automatically; custom interceptors use `system_back_handler`.
- **iOS**: call `run_ios()` on the main thread and test rotation, safe areas, and text input on simulator or device. Use `PluginContext::ui_view()` on the main thread when integrating UIKit views.

## Web notes

Web builds render via WebGPU into a `<canvas>` (no WebGL fallback and no DOM tree). `WebConfig::with_canvas_id(env!("CARGO_CRATE_NAME"))` matches the canvas ID in `gen/web/index.html`.

Because browsers do not expose system fonts, `ComponentsPackage` bundles a startup Roboto font and loads extra Roboto / Noto Sans SC subsets from a CDN stylesheet—ensure your deployment CSP permits those requests or register bundled `Fonts` directly (see [Assets, images, and fonts](/guide/assets#registering-fonts)).

## Accessibility support

AccessKit adapters are enabled on Windows, macOS, Linux, and iOS; Android and web do not currently connect native screen-reader adapters. Keep semantic labels and roles consistent across all platforms so tests and desktop/iOS users get full coverage.
