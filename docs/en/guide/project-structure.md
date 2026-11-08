---
title: Project structure
description: What each file in a new Tessera project does and which ones you are expected to edit.
---

# Project structure

A new Tessera project is an ordinary Cargo package with a few extra files that describe your application to the build and to the CLI. Knowing what each one does tells you where a change belongs, and which files the tools manage for you.

## The files at a glance

`cargo tessera new my-app` creates this layout. The `basic` and `blank` templates produce the same files; only `src/app.rs` differs.

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

Most of your work happens in `src/`, starting with `src/app.rs`. The configuration files at the root change occasionally, and the files under `gen/` are host files that the CLI creates and extends for each platform.

## Cargo.toml

The manifest builds your code twice: as a library that holds the application, and as a small binary that launches it on desktop. For a project named `my-app` it looks like this:

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

[target.'cfg(target_family = "wasm")'.dependencies]
wasm-bindgen = "0.2.130"

[build-dependencies]
tessera-build = "..."
```

The CLI fills in the `tessera-*` versions it was released with; they are shown as `"..."` here. The library is also built as a `cdylib` because Android and the web load the application as a dynamic library. `wasm-bindgen` is only used when building for the browser. Add other crates, such as `tessera-shard` or `tessera-i18n`, to `[dependencies]` as you need them.

Platform build settings also live here. Android options go in `[package.metadata.tessera.android]` and iOS options in `[package.metadata.tessera.ios]`; [Platforms](/guide/platforms) and [Packaging and release](/guide/distribution) describe them.

## src/lib.rs: the shared entry

Every platform starts the application from the same function in `src/lib.rs`:

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

`run` names the root component, starts from the configuration generated from `tessera-app.toml`, and registers `ComponentsPackage`, which installs the rendering pipelines and platform services the component library needs. `#[tessera_ui::entry]` also generates the Android entry point from this function. On the web, `start` runs the same entry and points it at the `<canvas>` in `gen/web/index.html`, whose `id` is the library's crate name.

This is where you register more packages, fonts, plugins and localization catalogs as the application grows. [Entry point and windows](/guide/app) covers the builder methods and launch variants.

## src/main.rs: the desktop and iOS binary

The binary only calls into the library. For `my-app` the library crate is `my_app_lib`:

```rust
// Prevents additional console window on Windows in release, DO NOT REMOVE
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

Android and the web start the application through the library, so `main` is empty there. Put application setup in `run`, where every platform picks it up; this file rarely changes.

## src/app.rs: the root component

`src/app.rs` holds the component that `run` passes to `EntryPoint::new`. In the `basic` template it shows a label on a surface that fills the window:

```rust
use tessera_components::{
    modifier::ModifierExt as _,
    surface::surface,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_ui::{Modifier, tessera};

#[tessera]
pub fn app() {
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(|| {
            surface()
                .modifier(Modifier::new().fill_max_size())
                .child(|| {
                    text("Hello Tessera!");
                });
        });
}
```

The `blank` template has the same theme and surface without the label. Keep the `material_theme()` at the root as you replace the content: Material controls read their colors, typography and shapes from it. Registering `ComponentsPackage` installs rendering and platform services, and the theme comes from `material_theme()`. [Material 3 theming](/guide/theming) explains how to customize it.

As the application grows, split screens and reusable pieces into their own modules next to `app.rs`.

## build.rs and the res module

The build script runs the Tessera build helper:

```rust
fn main() {
    tessera_build::build().expect("Failed to build Tessera resources");
}
```

It reads `tessera-app.toml` and `tessera-config.toml`, collects the asset directory and any localization catalogs, and writes the result as Rust code to `tessera_assets.rs` in Cargo's `OUT_DIR`. `src/res.rs` includes that file so the rest of the crate can use it as `crate::res`:

```rust
#[allow(missing_docs, clippy::all)]
mod generated {
    include!(concat!(env!("OUT_DIR"), "/tessera_assets.rs"));
}

pub use generated::*;
```

The generated module always contains `res::application()`, which returns a `TesseraConfig` holding the window title, application ID and desktop icon. It also contains a constant for each asset, such as `res::images::LOGO_SVG` for `assets/images/logo.svg`, and, once you configure localization, the `res::I18N` catalog and its `res::i18n()` package. Cargo regenerates the file whenever those inputs change, so make your changes in the inputs. [Resources](/guide/assets) and [Localization](/guide/i18n) explain those inputs.

## tessera-app.toml: application identity

This file holds what users and operating systems see as the application: its display name, a reverse-domain identifier and the source icon.

```toml
#:schema https://raw.githubusercontent.com/tessera-ui/tessera/main/docs/schemas/tessera-app.schema.json
name = "my-app"
identifier = "com.tessera.myapp"
icon = "icon.svg"
```

The CLI starts the name from the package name and derives the identifier from it. Set both to your own values before you ship, because the identifier is what platform manifests, desktop launchers and bundles use to recognize the application. It needs at least two dot-separated segments, each starting with an ASCII letter and containing only ASCII letters and digits.

The icon path is relative to the package root. Use a square SVG, with text converted to paths and external resources embedded, or a square PNG of at least 1024 × 1024. The build and the platform commands read this file when they run, so a change takes effect on the next build. The `#:schema` line lets editors with TOML schema support validate the file.

## tessera-config.toml: assets and platform features

Where `tessera-app.toml` says who the application is, this second configuration file describes what it uses:

```toml
#:schema https://raw.githubusercontent.com/tessera-ui/tessera/main/docs/schemas/tessera-config.schema.json
permissions = []

[assets]
dir = "assets"

[assets.tree_shaking]
exclude = []
```

`permissions` lists the platform permissions the application needs, chosen from `notifications`, `camera`, `microphone`, `location` and `bluetooth`; the CLI maps them to each platform's own permission names. `[assets]` points the build helper at the `assets/` directory, and `[assets.tree_shaking]` lists files that must stay available even when no reference to them is found. Add an `[i18n]` table here when you localize the application. [Resources](/guide/assets) and [Localization](/guide/i18n) describe these tables.

## assets/ and icon.svg

`assets/` starts empty. Put images, fonts and other files there and refer to them through the generated `res` constants. `icon.svg` is the placeholder icon named in `tessera-app.toml`; replace it with your own artwork.

## Platform folders under gen/

Platform host projects live under `gen/`. A new project already has `gen/web/index.html`, the page that loads the WebAssembly build into a full-window canvas and shows a loading bar until it starts. You can edit the page, but leave the `<title>` and the region between `<!-- tessera-app -->` and `<!-- /tessera-app -->` to the CLI: every web build rewrites them from `tessera-app.toml`, adding the region the first time.

Web builds add three directories beside it, all listed in `.gitignore`: `gen/web/pkg-web/` for the compiled JavaScript and WebAssembly, `gen/web/tessera/` for assets delivered over HTTP, and `gen/web/app/` for the generated icons and web manifest. In older projects without web support, `cargo tessera web init` creates the host page and adds whatever wiring is missing: the `wasm-bindgen` dependency, the `start` function in `src/lib.rs`, the platform guards in `src/main.rs` and the `.gitignore` entries.

`cargo tessera android init` generates an Android Studio Gradle project in `gen/android/`, including an activity that hosts the Rust library. Put Android settings in `Cargo.toml` and `tessera-config.toml`: each `android init`, `android build` and `android dev` regenerates the Gradle build files, the manifest, the activity and the launcher icons from that configuration, overwriting hand edits to those files. Plugins with Kotlin code are copied in by the same sync.

iOS has no folder under `gen/`: `cargo tessera ios build` assembles the application bundle directly under the Cargo target directory. [Packaging and release](/guide/distribution) describes where each platform's output ends up.

## Other files

`AGENTS.md` tells coding agents how to install Tessera's bundled guidance with `cargo tessera skill`. `README.md` lists the commands to run, serve and build the project. `.gitignore` excludes `target/` and the generated web output; the `basic` template's copy also excludes `Cargo.lock`.

## Next steps

To start changing `src/app.rs`, follow the [Tutorial](/guide/tutorial). For the entry point in depth, read [Entry point and windows](/guide/app).
