---
title: Entry point, windows, and sessions
description: Boot every platform from one EntryPoint, configure windows and title bars, and understand RuntimeSession.
---

# Entry point, windows, and sessions

Every Tessera application starts from an `EntryPoint` that connects your root component, renderer settings, packages, and plugins. Define it once in `src/lib.rs` and let each platform launcher call it.

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

Put `material_theme()` at the root of `app` whenever you use `tessera-components`: `ComponentsPackage` installs the rendering pipelines and platform services, while `material_theme()` provides theme tokens to descendants.

## Launching on each platform

`#[tessera_ui::entry]` marks the public zero-argument `EntryPoint` function and generates the Android entrypoint (`android_main` calling `run_android`). Desktop and iOS launch from `src/main.rs`:

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

| Launch method | Available on |
| --- | --- |
| `run_desktop()` | Native desktop targets (also enters offscreen mode when invoked by `cargo tessera headless`) |
| `run_ios()` | iOS (must run on the application's main thread) |
| `run_android(android_app)` | Android |
| `run_web()` | `wasm` targets |
| `into_headless(config)` | Non-`wasm` targets with the `headless` feature |

## Registering packages, modules, and plugins

| Method | Purpose |
| --- | --- |
| `.package(package)` | Install a `TesseraPackage` (groups modules, plugins, and sub-packages) |
| `.module(module)` | Register custom GPU pipelines via `RenderModule` |
| `.plugin(plugin)` | Register a session-owned `Plugin` instance |
| `.config(config)` | Supply `TesseraConfig` for window, web, and GPU settings |

Always register `ComponentsPackage` when using `tessera-components` (it also registers `PlatformPackage` for clipboard and desktop window services). See [Assets, images, and fonts](/guide/assets#fonts), [Custom drawing and shaders](/guide/drawing), and [Platform integration and plugins](/guide/plugins).

## Configuring windows and app identity

Start from `res::application()` rather than `TesseraConfig::default()` so window title, application ID, and desktop icon stay in sync with `tessera-app.toml`:

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

Set display name, reverse-domain identifier (at least two dot-separated ASCII segments), and source icon in `tessera-app.toml`:

```toml
name = "Notes"
identifier = "dev.example.notes"
icon = "icon.svg"
```

Use a square SVG (with text converted to paths and external assets embedded) or a square PNG (at least 1024 × 1024).

## Integrated title bars and window controls

To merge the top app bar into the desktop window title bar:

1. Enable it on `WindowConfig`: `config.window = config.window.with_app_titlebar();`
2. Mark the bar with `.window_chrome(true)`:

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

On macOS this keeps native traffic-light window buttons while adding a drag region; on Windows and Linux it disables system chrome and renders window controls inside the app bar. It has no effect on mobile or web.

For custom window buttons or quit actions, depend on `tessera-platform` (`cargo add tessera-platform`) and call `tessera_platform::window::{minimize, maximize, toggle_maximize, close}`:

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

## Runtime sessions

Each `EntryPoint` owns a `RuntimeSession` that scopes packages, plugins, models, and session resources. Call `entry.runtime_session()` before consuming the entry if an integration needs to inspect or attach work to it.

Tests and custom hosts can create isolated sessions with `RuntimeSession::new()`, execute scoped work via `.run(...)` or `.enter()`, store session-wide state with `runtime_resource::<T>()`, or hold a non-owning `WeakRuntimeSession` via `.downgrade()`.
