---
title: Entry point and windows
description: Start your app on every platform from one entry point and configure its window, identity and title bar.
---

# Entry point and windows

Every Tessera app starts from an `EntryPoint`: a value that connects your root component to the renderer, the platform services and the window. You build it once, in one function, and each platform's launcher calls that function, so desktop, web, Android and iOS all start the same app with the same configuration.

The `basic` project template puts this function in `src/lib.rs`. It relies on the generated `src/app.rs`, `src/res.rs` and `build.rs`; [Project structure](/guide/project-structure) explains what each of those files does.

```rust
mod app;
pub mod res;

use tessera_ui::{EntryPoint, renderer::TesseraConfig};

use app::app;

#[cfg(target_family = "wasm")]
use tessera_ui::renderer::WebConfig;
#[cfg(target_family = "wasm")]
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

#[tessera_ui::entry]
pub fn run() -> EntryPoint {
    EntryPoint::new(app)
        .config(TesseraConfig {
            #[cfg(target_family = "wasm")]
            web: WebConfig::default().with_canvas_id(env!("CARGO_CRATE_NAME")),
            ..res::application()
        })
        .package(tessera_components::ComponentsPackage)
}

#[cfg(target_family = "wasm")]
#[wasm_bindgen(start)]
pub fn start() -> Result<(), JsValue> {
    run()
        .run_web()
        .map_err(|err| JsValue::from_str(&err.to_string()))
}
```

`app` is an ordinary `#[tessera]` component. If you use Material components, put a `material_theme()` at the top of it: `ComponentsPackage` installs the rendering pipelines, and `material_theme()` supplies the theme. See [Material 3 theming](/guide/theming).

## Launch on each platform

`#[tessera_ui::entry]` goes on a public function with no arguments that returns `EntryPoint`. On Android it generates the `android_main` function and calls `run_android` with the host's `AndroidApp`, which is all Android needs. On the web you write the `start` function shown above, and on desktop and iOS you write `main`.

That `main` lives in `src/main.rs`. For a project named `notes`, the template's library crate is `notes_lib`, and `main` launches the shared entry like this:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(all(not(target_family = "wasm"), not(target_os = "android")))]
fn main() {
    #[cfg(target_os = "ios")]
    let result = notes_lib::run().run_ios();
    #[cfg(not(target_os = "ios"))]
    let result = notes_lib::run().run_desktop();
    if let Err(err) = result {
        eprintln!("App failed to run: {err}");
    }
}

#[cfg(any(target_family = "wasm", target_os = "android"))]
fn main() {}
```

Each launch method exists only on the targets it supports, which is why every call sits behind a `cfg` guard. The choice happens at compile time:

| Method | Available on |
| --- | --- |
| `run_desktop()` | Native targets other than Android and iOS. |
| `run_ios()` | iOS; call it on the application's main thread. |
| `run_android(android_app)` | Android. |
| `run_web()` | The `wasm` target family. |
| `into_headless(config)` | Non-`wasm` targets with the `headless` feature. |

All of them consume the `EntryPoint`. Headless rendering is used for offscreen tests and is covered in [Testing](/guide/testing); what each native host needs is in [Platforms](/guide/platforms).

## Register application services

Before launching, you tell the entry point which services the app uses. These builder methods do that:

| Builder method | Registers or sets |
| --- | --- |
| `.package(package)` | A `TesseraPackage`, which groups registrations through `EntryRegistry`. |
| `.module(module)` | A `RenderModule`, which registers graphics pipelines. |
| `.plugin(plugin)` | A `Plugin` instance owned by this application session. |
| `.config(config)` | The `TesseraConfig` used by the renderer and window. |

Most apps need one package. `ComponentsPackage` registers the standard component pipelines together with `tessera_platform::PlatformPackage`, which provides the platform services the components depend on, so register it whenever you build with `tessera-components`. Font packages are registered the same way; see [Resources](/guide/assets#fonts). For your own integrations, see [Platform integration and plugins](/guide/plugins) and [Drawing and shaders](/guide/drawing).

## Configure the window

`TesseraConfig` holds the window title, the desktop `window` options (`WindowConfig`), the `web` host options and GPU settings such as `sample_count`, which defaults to `1`; any other sample count has to be supported by the GPU. Each `EntryPoint` runs one window.

In a generated project, start from `res::application()` rather than `TesseraConfig::default()`. The generated value already carries the window title, application ID and desktop icon from your [application identity](#application-identity), so when you change one runtime option on top of it, that identity stays in place. This version of `run` makes the desktop window non-resizable:

```rust
#[tessera_ui::entry]
pub fn run() -> EntryPoint {
    let mut config = res::application();
    config.window.resizable = false;

    EntryPoint::new(app)
        .config(config)
        .package(tessera_components::ComponentsPackage)
}
```

`WindowConfig` also controls system decorations and transparency. Its options apply to desktop windows only; the [API reference](https://tessera-ui.github.io/tessera/tessera_ui/) lists them with their defaults.

To keep content clear of the status bar and the on-screen keyboard, use window insets: they measure those areas live as they change. [Layout basics](/guide/layout) shows how to apply them.

## Application identity

Your app's display name, reverse-domain identifier and source icon live in `tessera-app.toml` at the package root:

```toml
name = "Notes"
identifier = "dev.example.notes"
icon = "icon.svg"
```

The generated `build.rs` reads this file through `tessera_build::build()`, and the generated `res::application()` turns it into a `TesseraConfig` with the window title, application ID and desktop icon. The CLI reads the same metadata when it creates platform packages and host files. This happens at build time, so the running app uses the values from its last build; rebuild after you change the file.

The identifier needs at least two dot-separated segments. Each segment starts with an ASCII letter and contains only ASCII letters and digits. If you leave the fields out, the name defaults to the Cargo package name and an identifier is derived from it.

The icon path is relative to the package root. Use a square SVG or PNG; in an SVG, convert text to paths and embed any external resources. [Packaging and release](/guide/distribution) shows where this identity appears in installers, bundles and launchers.

## Integrate the title bar

On desktop you can let your app bar act as the window's title bar, so the toolbar and the window chrome share one row. This takes two changes. First, enable it in the window configuration. The helper below can go in `src/lib.rs`; pass your configuration through it before calling `.config(...)`:

```rust
fn with_app_titlebar(mut config: TesseraConfig) -> TesseraConfig {
    config.window = config.window.with_app_titlebar();
    config
}
```

Then mark the app bar that should serve as the title bar with `.window_chrome(true)`. For example, `src/app.rs` could become:

```rust
use tessera_components::{
    app_bar::top_app_bar,
    theme::{MaterialTheme, material_theme},
};
use tessera_ui::tessera;

#[tessera]
pub fn app() {
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(|| {
            top_app_bar().title("Notes").window_chrome(true);
        });
}
```

macOS keeps its native window controls. On other desktop platforms the system decorations are turned off and the app draws its own controls. Either way, the app bar provides the drag region and, where the platform needs them, minimize, maximize and close buttons. On mobile and web, `with_app_titlebar` has no effect.

## Control the window from code

If you draw your own window controls or want a "Quit" action, `tessera_platform::window` provides `minimize`, `maximize`, `toggle_maximize` and `close`. Add the crate with `cargo add tessera-platform`. Each function takes no arguments, so it can be passed straight to `on_click`:

```rust
use tessera_components::{button::button, row::row, text::text};
use tessera_platform::window;
use tessera_ui::tessera;

#[tessera]
fn window_buttons() {
    row().children(|| {
        button().on_click(window::minimize).child(|| text("Minimize"));
        button().on_click(window::toggle_maximize).child(|| text("Maximize"));
        button().on_click(window::close).child(|| text("Quit"));
    });
}
```

These calls work through the desktop services that `ComponentsPackage` registers. When those services are not available, the call does nothing. `close` asks the host to shut the application down rather than tearing it down immediately.

## Runtime sessions

An `EntryPoint` owns a `RuntimeSession`. Packages, plugins, state owners and session resources belong to that UI session, so each entry point keeps its own set. While you still hold the entry, `entry.runtime_session()` borrows its session.

Working with the session directly is mostly for tests and integrations. They can create an independent one with `RuntimeSession::new()`, run a scoped operation inside it with `run(...)`, or call `enter()` to get a guard that restores the previous session when dropped. `resource::<T>()` returns a resource shared across the session; `local_resource::<T>()` keeps one on the UI thread.

Cloning a `RuntimeSession` keeps it alive. `downgrade()` gives you a `WeakRuntimeSession` that does not, and its `run(...)` returns `None` once the session has ended. `run` executes on the owning UI thread only. To hand results back from background work on another thread, use a dispatcher as described in [Background tasks](/guide/tasks), and release external resources together with whatever owns them.

The [tessera-ui API reference](https://tessera-ui.github.io/tessera/tessera_ui/) has the full contracts.
