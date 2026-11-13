---
title: Project structure
description: What each file in a new Tessera project does and where your changes belong.
---

# Project structure

A newly created Tessera project is a standard Cargo package with two TOML manifests and a generated host folder so the same code builds for desktop, mobile, and the browser.

## File layout

`cargo tessera new my-app` (with either `--template basic` or `--template blank`) creates:

```text
my-app/
├── Cargo.toml
├── build.rs
├── tessera-app.toml
├── tessera-config.toml
├── icon.svg
├── assets/
├── gen/
│   └── web/
│       └── index.html
├── src/
│   ├── app.rs
│   ├── lib.rs
│   ├── main.rs
│   └── res.rs
├── AGENTS.md
├── README.md
└── .gitignore
```

Day-to-day UI work stays inside `src/` and `assets/`. The files at the root configure app identity, assets, and permissions, while `gen/` holds platform host wrappers managed by `cargo tessera`.

## `Cargo.toml`

The manifest builds your code as both a library (loaded by Android and WebAssembly) and a thin desktop/iOS executable:

```toml
[package]
name = "my-app"
version = "0.1.0"
edition = "2024"

[lib]
crate-type = ["rlib", "cdylib"]
name = "my_app_lib"
path = "src/lib.rs"

[[bin]]
name = "my_app"
path = "src/main.rs"

[dependencies]
tessera-ui = "..."
tessera-components = "..."
tessera-foundation = "..."

[target.'cfg(not(target_family = "wasm"))'.dependencies]
tokio = "1"

[target.'cfg(target_family = "wasm")'.dependencies]
wasm-bindgen = "0.2.130"

[build-dependencies]
tessera-build = "..."
```

The CLI pins matching `tessera-*` versions when creating the project. On native targets, `tokio = "1"` is included because Tessera dispatchers provide a Tokio 1 runtime context out of the box. Add `tessera-shard`, `tessera-i18n`, or `tessera-platform` to `[dependencies]` when your app needs routing, localization, or direct window/clipboard calls.

Platform-specific packaging options also live here under `[package.metadata.tessera.android]` and `[package.metadata.tessera.ios]`. See [Packaging and release](/guide/distribution).

## `src/lib.rs`: shared entry point

Every target starts from the same `run()` function in `src/lib.rs`:

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

`run()` registers the root component, loads `res::application()` (window title, app ID, and desktop icon derived from `tessera-app.toml`), and installs `ComponentsPackage`. `#[tessera_ui::entry]` also generates the `android_main` export for Android. On the web, `start()` mounts onto the `<canvas>` in `gen/web/index.html` whose `id` matches the crate name.

Additional packages (such as custom fonts, shaders, plugins, and localization catalogs) go on this builder. See [Entry point, windows, and sessions](/guide/app).

## `src/main.rs`: desktop and iOS launcher

The binary target only forwards to `run()`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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

Android and WebAssembly boot from the `cdylib` rather than `main()`, so `main()` is an empty stub there. You rarely need to touch this file.

## `src/app.rs`: root component

`src/app.rs` contains the `app()` component passed to `EntryPoint::new(app)`. In the `basic` template it wraps a `text("Hello Tessera!")` inside `material_theme()` and a full-window `surface()`; in `blank` the surface starts empty. Keep `material_theme()` near the root whenever you use `tessera-components` controls so they can read the theme from context.

As your UI grows, split screens and reusable pieces into sibling modules next to `app.rs`.

## `build.rs` and `src/res.rs`

`build.rs` invokes `tessera_build::build()`, which reads `tessera-app.toml` and `tessera-config.toml`, indexes `assets/` and any localization directory, and writes `OUT_DIR/tessera_assets.rs`. `src/res.rs` includes that generated file as `crate::res`.

You get `res::application()` out of the box, plus typed constants for every asset file (for example, `res::images::LOGO_SVG` for `assets/images/logo.svg`) and `res::I18N` / `res::i18n()` once localization is configured. See [Assets, images, and fonts](/guide/assets) and [Localization](/guide/i18n).

## `tessera-app.toml` and `tessera-config.toml`

- **`tessera-app.toml`** defines app identity: `name`, reverse-domain `identifier` (at least two dot-separated ASCII segments), and `icon` (a square SVG with outlined text, or a PNG of at least 1024 × 1024).
- **`tessera-config.toml`** configures build resources and platform capabilities: `permissions` (mapped to platform permission strings), `[assets]` (`dir`, `embed`, `tree_shaking.exclude`), and optional `[i18n]` (`dir`, `fallback`).

Both files include a `#:schema` comment at the top so editors with TOML schema support can validate keys as you edit.

## `gen/` host directories

- **`gen/web/`**: created with the project. You can customize `index.html`, as long as you leave `<title>` and the `<!-- tessera-app -->` block alone—CLI web commands update those from `tessera-app.toml`. Web builds write `pkg-web/`, `tessera/`, and `app/` alongside it (all gitignored).
- **`gen/android/`**: generated on demand by `cargo tessera android init` and refreshed on every `android build` or `android dev`. Keep Android settings in `Cargo.toml` and `tessera-config.toml` rather than editing generated Gradle files directly.
- **iOS**: assembled directly inside Cargo's `target/` directory during `cargo tessera ios build`, with no `gen/` folder required.

## Other generated files

`AGENTS.md` documents how coding agents can install the bundled `tessera-good-taste` skill via `cargo tessera skill`, `README.md` summarizes common run commands, and `.gitignore` excludes `target/` and generated web output.

## Next steps

If you have not tried the [Tutorial](/guide/tutorial) yet, start there; otherwise move on to [Thinking in Tessera](/guide/thinking-in-tessera) to understand the component execution model in detail.
