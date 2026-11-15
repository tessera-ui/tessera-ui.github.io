---
title: Project structure
description: What each file in a new Tessera project does and where your changes belong.
---

# Project structure

A newly created Tessera project is a standard Cargo package with a `tessera.toml` configuration file and a `gen/` folder for platform host projects, so the same code builds for desktop, mobile, and the browser.

## File layout

`cargo tessera new my-app` (with either `--template basic` or `--template blank`) creates:

```text
my-app/
├── Cargo.toml
├── build.rs
├── tessera.toml
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

Day-to-day UI work stays inside `src/` and `assets/`. `tessera.toml` configures app identity, assets, and localization, while `gen/` holds the platform host projects. `gen/android/` and `gen/apple/` appear after `cargo tessera android init` and `cargo tessera apple init`.

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

Desktop installer and signing settings go in `[package.metadata.packager]`; mobile platform settings live in the generated Android and Xcode projects. See [Packaging and release](/guide/distribution).

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

`run()` registers the root component, loads `res::application()` (window title, app ID, and desktop icon derived from `tessera.toml`), and installs `ComponentsPackage`. `#[tessera_ui::entry]` also generates the `android_main` export for Android. On the web, `start()` mounts onto the `<canvas>` in `gen/web/index.html` whose `id` matches the crate name.

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

`build.rs` invokes `tessera_build::build()`, which reads `tessera.toml`, indexes `assets/` and any localization directory, and writes `OUT_DIR/tessera_assets.rs`. `src/res.rs` includes that generated file as `crate::res`.

You get `res::application()` out of the box, plus typed constants for every asset file (for example, `res::images::LOGO_SVG` for `assets/images/logo.svg`) and `res::I18N` / `res::i18n()` once localization is configured. See [Assets, images, and fonts](/guide/assets) and [Localization](/guide/i18n).

## `tessera.toml`

Each package may have a `tessera.toml` next to its `Cargo.toml`. The template starts with:

```toml
#:schema https://raw.githubusercontent.com/tessera-ui/tessera/main/docs/schemas/tessera.schema.json

[app]
name = "my-app"
identifier = "com.tessera.myapp"
icon = "icon.svg"

[assets]
dir = "assets"
```

Replace the generated `identifier` with your own reverse-domain name before publishing. Keys are kebab-case, and unknown keys are errors. The file has these tables:

- **`[app]`** defines app identity and is read only from the package being built: `name` (defaults to the Cargo package name), reverse-domain `identifier` (at least two dot-separated segments of ASCII letters and digits, each starting with a letter), and `icon` (a square SVG with outlined text and embedded resources, or a PNG of at least 1024 × 1024; without it, the Tessera logo is used).
- **`[assets]`** enables asset generation: `dir` (defaults to `assets`), plus `embed` and `keep` glob lists. See [Assets, images, and fonts](/guide/assets).
- **`[i18n]`** enables localization catalogs: `dir` (defaults to `locales`) and the required `fallback`. See [Localization](/guide/i18n).
- **`[plugin.android]`** is used by plugin packages: `module` names the Gradle library in the package's `android/` directory. See [Platform integration and plugins](/guide/plugins).

The `#:schema` comment on the first line lets editors with TOML schema support validate keys as you edit.

## `gen/` host directories

- **`gen/web/`**: created with the project. `index.html` belongs to your app; its `<head>` must keep the `<!-- tessera-app -->` … `<!-- /tessera-app -->` block, which web commands rewrite with the title, icons, and manifest link. Everything else in the file is preserved. Web builds write `pkg-web/`, `tessera/`, and `app/` alongside it (all gitignored).
- **`gen/android/`**: generated once by `cargo tessera android init`. It is an ordinary Android project that you commit and edit, for example to declare permissions in `AndroidManifest.xml`. Android commands only rewrite the gitignored files `cargo tessera` maintains, such as `tessera.properties`.
- **`gen/apple/`**: generated once by `cargo tessera apple init` on macOS. It is an Xcode project with iOS and macOS targets that you commit and edit in Xcode. Apple commands only rewrite the gitignored `tessera.xcconfig` and `Tessera.xcassets`.

See [Packaging and release](/guide/distribution) for what each platform project contains.

## Other generated files

`AGENTS.md` documents how coding agents can install the bundled `tessera-good-taste` skill via `cargo tessera skill`, `README.md` summarizes common run commands, and `.gitignore` excludes `target/` and generated web output.

## Next steps

If you have not tried the [Tutorial](/guide/tutorial) yet, start there; otherwise move on to [Thinking in Tessera](/guide/thinking-in-tessera) to understand the component execution model in detail.
