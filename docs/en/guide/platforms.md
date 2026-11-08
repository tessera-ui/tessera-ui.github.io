---
title: Platforms
description: What each of Tessera's six targets needs and how it hosts your app.
---

# Platforms

One Tessera app runs on Windows, macOS, Linux, Android, iOS and the web from the same Rust component tree. The host on each platform supplies the window or canvas, input, safe-area measurements and platform services. What changes between targets is how the app is launched, which toolchain builds it and which host behaviour you need to test for.

## One entry, one launch call per platform

Your app has a single entry function marked with `#[tessera_ui::entry]` that returns an `EntryPoint` (see [Entry point and windows](/guide/app)). Each platform starts that entry with its own method, and the generated project already wires each one up:

| Platform | Started by | Rust target |
| --- | --- | --- |
| Windows, macOS, Linux | `run_desktop()` from `src/main.rs` | the host triple |
| iOS | `run_ios()` from `src/main.rs`, on the main thread | `aarch64-apple-ios`, or a simulator triple |
| Android | `run_android(app)`, called by the code `#[tessera_ui::entry]` exports | `aarch64-linux-android` by default |
| Web | `run_web()` from a `#[wasm_bindgen(start)]` function in `src/lib.rs` | `wasm32-unknown-unknown` |

Each method exists only on its own target, so calling the wrong one fails at compile time. The generated `src/main.rs` picks between the two native methods:

```rust
#[cfg(all(not(target_family = "wasm"), not(target_os = "android")))]
fn main() {
    #[cfg(target_os = "ios")]
    let result = my_app_lib::run().run_ios();
    #[cfg(not(target_os = "ios"))]
    let result = my_app_lib::run().run_desktop();
    if let Err(err) = result {
        eprintln!("App failed to run: {err}");
    }
}

#[cfg(any(target_family = "wasm", target_os = "android"))]
fn main() {}
```

Android and the web enter through the library instead, which is why `main` is empty on those targets. Commands for running each target during development are in [Getting started](/guide/getting-started); producing release artifacts is covered in [Packaging and release](/guide/distribution).

## Requirements at a glance

Every native target needs a Rust toolchain, a native compiler and linker for that target, and a GPU driver the renderer can use.

| Platform | Host and runtime requirements |
| --- | --- |
| Windows | Windows native build tools and SDK; a Direct3D 12-capable adapter and driver for the default renderer. |
| macOS | Apple's native build tools and SDK; a Metal-capable GPU and driver. |
| Linux | A C/C++ build toolchain, an X11 or Wayland session and its client libraries, `libxkbcommon` for keyboard input, and a compatible GPU driver. |
| Android | Android SDK and NDK, Java for the generated Gradle host, and a device or emulator; the generated `minSdk` defaults to `24`. |
| iOS | macOS and Xcode with the iOS SDK; a simulator or device; the deployment target defaults to iOS `15.0`. |
| Web | The Rust `wasm32-unknown-unknown` target and a browser with WebGPU enabled in a secure context. |

## Windows

On Windows the renderer uses Direct3D 12 by default. Test on the hardware and drivers your users actually have: a window that opens tells you the platform window works, and only a real workload tells you the graphics adapter suits the renderer.

The generated `src/main.rs` starts with `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`, so release builds open only the app window, with no extra console; keep that line. The application name and icon come from `tessera-app.toml`, so keep the generated `res::application()` configuration in place when you change window options.

If you want the title bar drawn as part of your UI, use `WindowConfig::with_app_titlebar` together with an app bar marked `window_chrome(true)`. [Entry point and windows](/guide/app) shows the two pieces together.

## macOS

Build with Apple's command-line tools and SDK installed. The window is an AppKit window and rendering goes through Metal. macOS uses `run_desktop()` like the other desktop platforms; `run_ios()` is for iOS only, even though both targets use Apple tooling.

An integrated title bar keeps the native window controls. Let the app bar reserve space for them, so content stays clear of the controls. Bundle identity, icons and `.app`/`.dmg` output are covered in [Packaging and release](/guide/distribution).

## Linux

The default windowing configuration supports both X11 and Wayland. At runtime the app needs a graphical session and that session's client libraries, plus `libxkbcommon` for keyboard handling. Package names differ between distributions, so make sure the deployment environment ships the libraries its session needs.

Vulkan is the usual graphics path, so install a GPU driver that suits the machine. GPU access is separate from having a display server, so check it in containers and remote sessions too. Check graphics and font availability in the environment you deploy to as well as on your development machine.

Keep application metadata consistent so the running window and the packaged launcher entry identify the same app.

## Android

The generated Android host uses GameActivity. It connects the native renderer, keyboard and inset handling, and the system back dispatcher to your Rust app. `#[tessera_ui::entry]` exports the Android entry point and forwards the host's `AndroidApp` to `run_android`.

Install the Android SDK, NDK and the Java tooling the generated Gradle project needs. The CLI builds for `arm64` (`aarch64-linux-android`) by default; an emulator with a different architecture needs a matching `--arch`. The generated minimum SDK is `24`, and the device's GPU and driver still have to handle your graphics workload.

Content can draw behind the system bars. Pad with `WindowInsets::SystemBars` or `WindowInsets::SafeDrawing` so the layout adapts to each device, and use `WindowInsets::Ime` when only keyboard occlusion matters. See [Layout basics](/guide/layout).

Predictive back is handled for you in `shard_home`: during the gesture it previews the previous route and pops only when the gesture commits. At the root destination the system performs its usual back action. Custom screens and overlays should keep a `system_back_handler` mounted consistently, preview while leaving navigation as it is, restore on cancel and navigate only on commit. See [Navigation](/guide/navigation).

## iOS

Building for iOS requires macOS and Xcode; the CLI checks the selected SDK with `xcrun` before it builds. Device builds target `aarch64-apple-ios`. Simulator builds target `aarch64-apple-ios-sim` on Apple silicon and `x86_64-apple-ios` on Intel Macs.

The deployment target defaults to `15.0`. To change it, set `IPHONEOS_DEPLOYMENT_TARGET`; the CLI reads it when it builds. Call `run_ios()` on the main thread; it is the only launch method on this target.

Read safe areas and the keyboard from live window insets, and test rotation and text editing on a simulator or device. To reach UIKit from Rust, a plugin can get the hosting view through `PluginContext::ui_view` on the main thread; see [Platform integration and plugins](/guide/plugins#ios-and-uikit).

`cargo tessera ios build` produces a simulator `.app` or, with `--device`, a signed IPA. Signing identities, provisioning profiles and bundle settings are covered in [Packaging and release](/guide/distribution#ios).

## Web

Web builds target `wasm32-unknown-unknown` and render through WebGPU. There is no WebGL fallback. Serve the app from a secure context, such as HTTPS or `localhost`, in a browser that exposes WebGPU on the hardware you are targeting.

The template's `#[wasm_bindgen(start)]` function calls `run_web()`. `WebConfig::with_canvas_id` selects the canvas by ID, and the generated library and HTML agree on that ID. Without a configured canvas, the renderer appends one to the document body. The result is a Rust UI drawn into a canvas, not a tree of DOM elements.

Browsers do not let the text renderer discover system fonts. The component stack embeds a Roboto font for startup and loads more Roboto and Noto Sans SC fonts on demand from CDN stylesheets, so account for network access, CORS and your site's content security policy. If you need to control where fonts come from, register `Fonts` or `FontStylesheet` packages; see [Resources](/guide/assets).

Run long work asynchronously, in ways the browser supports, so the UI thread stays responsive (see [Background tasks](/guide/tasks)). Deploying the generated `gen/web/` directory is covered in [Packaging and release](/guide/distribution#web).

## Platform services and accessibility

`ComponentsPackage` registers the standard platform services. For your own native integrations, use the plugin and session interfaces, and get the window from the context they give you rather than from a process-wide global; see [Platform integration and plugins](/guide/plugins).

Accessibility adapters are active on Windows, macOS, Linux and iOS. Android and the web have no accessibility adapter, so the tree is not published there. Declare roles, labels and actions on your components for every platform; see [Accessibility](/guide/accessibility).
