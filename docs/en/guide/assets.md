---
title: Assets, images, and fonts
description: Bundle images, icons, fonts, and data files via tessera-build and load them across every platform.
---

# Assets, images, and fonts

Place static files in your project's assets directory so `tessera-build` turns them into typed Rust constants under `crate::res`. Missing paths fail at compile time, and the same `Asset` handle resolves whether assets are embedded or delivered per platform.

```rust
use tessera_components::image::image;
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, tessera};

use crate::res;

#[tessera]
fn logo() {
    image()
        .painter(res::images::LOGO_SVG)
        .modifier(Modifier::new().size(Dp(96.0), Dp(96.0)));
}
```

## Configuring `tessera-config.toml`

Enable asset generation in `tessera-config.toml` at your package root:

```toml
[assets]
dir = "assets"
embed = ["images/logo.svg"]

[assets.tree_shaking]
exclude = ["runtime/**"]
```

- `dir`: asset folder relative to the package root (defaults to `assets` when `[assets]` is present).
- `embed`: exact asset paths (relative to `dir`) that must always stay embedded in the binary even when building with `--asset-backend platform`.
- `tree_shaking.exclude`: glob patterns for assets kept during platform packaging even if static analysis finds no direct constant reference (useful for dynamically selected paths).

Directory names map to lowercase module names (escaping Rust 2024 keywords with a trailing `_`), and filenames including extensions map to uppercase constants with punctuation replaced by `_`—for instance, `assets/images/logo.svg` becomes `res::images::LOGO_SVG`.

## Images and vector icons

`Painter` accepts generated `Asset` constants, path/URL strings, encoded bytes, `ImageData`, and `ImageVectorData`. `tessera_components::material_icons` also ships generated Material icon constants across `filled`, `outlined`, `round`, `sharp`, and `two_tone` styles:

```rust
use tessera_components::{icon::icon, material_icons::filled};
use tessera_ui::tessera;

#[tessera]
fn settings_symbol() {
    icon().painter(filled::SETTINGS_SVG);
}
```

- Encoded images and SVGs load asynchronously; assign an explicit size so surrounding layout does not jump while loading.
- SVG rendering supports solid-color fills and strokes; convert SVG text to paths and avoid gradients, masks, filters, or embedded bitmaps.

## Registering fonts

Register bundled font assets at `EntryPoint` using `tessera_components::fonts::{Font, Fonts}`:

```rust
use tessera_components::{
    ComponentsPackage,
    fonts::{Font, Fonts},
};
use tessera_ui::EntryPoint;

const APP_FONTS: Fonts = Fonts(&[Font {
    asset: crate::res::fonts::EXAMPLESANS_TTF,
    family: "Example Sans",
    fallback: &[],
    coverage: &[],
}]);

#[tessera_ui::entry]
pub fn run() -> EntryPoint {
    EntryPoint::new(app)
        .package(ComponentsPackage)
        .package(APP_FONTS)
}
```

Select the font via `TextStyle::font_family` (`Some("Example Sans")`). Use `fallback` for inclusive Unicode ranges where a font supplies missing glyphs even when not selected by family, and `coverage` to restrict which ranges trigger loading that font.

For web-hosted font CSS, register `FontStylesheet("https://example.com/fonts.css")` via `.package(...)`. On native targets without custom fonts, `ComponentsPackage` preloads system fonts in the background; on the web, a startup Roboto font is bundled and extra Roboto / Noto Sans SC subsets load on demand.

## Loading custom data files

Use `Resource::load(source, decode)` for JSON, text, or binary payloads, where `decode` is a plain function pointer `fn(Arc<[u8]>) -> io::Result<T>` (`T: Clone + Send + 'static`):

```rust
use std::{io, sync::Arc};

use tessera_components::text::text;
use tessera_ui::{LoadState, Resource, remember, tessera};

fn decode_text(bytes: Arc<[u8]>) -> io::Result<String> {
    String::from_utf8(bytes.to_vec()).map_err(io::Error::other)
}

#[tessera]
fn resource_notice() {
    let resource = remember(|| Resource::load("notice.txt", decode_text));
    match resource.with(|resource| resource.get()) {
        LoadState::Loading => { text("Loading…"); }
        LoadState::Ready(value) => { text(value); }
        LoadState::Failed(error) => { text(format!("Cannot load notice: {error}")); }
    }
}
```

Pass `res::files::NOTICE_TXT` for bundled files, or a path/URL string for external files. Live requests with the same source and decoder share one result, and completion automatically invalidates readers; use `remember_with_key` when the source changes dynamically.
