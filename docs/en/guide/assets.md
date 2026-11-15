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

## Configuring assets in `tessera.toml`

The `[assets]` table in `tessera.toml` at your package root enables asset generation:

```toml
[assets]
dir = "assets"
embed = ["fonts/*.ttf"]
keep = ["licenses/**"]
```

- `dir`: asset folder relative to the package root (defaults to `assets`).
- `embed`: assets always embedded in the binary on every target, including builds with `--asset-backend platform`.
- `keep`: platform assets delivered even when no reference to them is found in the binary (useful for dynamically selected assets).

`embed` and `keep` take glob patterns relative to `dir`; `*` does not cross directories, `**` does.

Directory names map to lowercase module names (escaping Rust 2024 keywords with a trailing `_`), and filenames including extensions map to uppercase constants with punctuation replaced by `_`—for instance, `assets/images/logo.svg` becomes `res::images::LOGO_SVG`.

## Images and vector icons

`Painter` accepts generated `Asset` constants, encoded bytes (`&[u8]`, `Vec<u8>`, or `Arc<[u8]>`), a `Source`, `ImageData`, and `ImageVectorData`. `tessera_components::md3::material_icons` also ships generated Material icon constants across `filled`, `outlined`, `round`, `sharp`, and `two_tone` styles:

```rust
use tessera_components::md3::{icon::icon, material_icons::filled};
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

To load fonts declared by a web font stylesheet's `@font-face` rules, register `FontStylesheet("https://example.com/fonts.css")` via `.package(...)`; each font file is fetched when text uses a character in its `unicode-range`. Remote fonts load only on the web; other platforms report the stylesheet as unavailable, so bundle those fonts with `Fonts`.

Native text uses system fonts, which `ComponentsPackage` preloads in the background. Web builds bundle a startup Roboto font and load additional Roboto / Noto Sans SC subsets from a CDN.

## Loading custom data files

Use `Resource::load(source, decode)` for JSON, text, or binary payloads. `source` is a generated `Asset` or bytes held in memory (`&[u8]`, `Vec<u8>`, or `Arc<[u8]>`); `decode` is a plain function pointer `fn(Bytes) -> io::Result<T>` (`T: Clone + Send + 'static`) that runs on `Dispatcher::Io`. `tessera_ui::asset::Bytes` dereferences to `[u8]`, and cloning it shares the data:

```rust
use std::io;

use tessera_components::md3::text::text;
use tessera_ui::{LoadState, Resource, asset::Bytes, remember, tessera};

use crate::res;

fn decode_text(bytes: Bytes) -> io::Result<String> {
    String::from_utf8(bytes.to_vec()).map_err(io::Error::other)
}

#[tessera]
fn resource_notice() {
    let resource = remember(|| Resource::load(res::NOTICE_TXT, decode_text));
    match resource.with(|resource| resource.get()) {
        LoadState::Loading => { text("Loading…"); }
        LoadState::Ready(value) => { text(value); }
        LoadState::Failed(error) => { text(format!("Cannot load notice: {error}")); }
    }
}
```

Here `assets/notice.txt` generates `res::NOTICE_TXT`. Live requests with the same source and decoder share one result, and completion invalidates every component that read `get()`; use `remember_with_key` when the source changes dynamically. Dropping the last handle cancels unfinished work.

To produce a value from other work, such as a network request, use `Resource::spawn(future)` for a `Send` future returning `io::Result<T>`, or `Resource::spawn_local(future)` for a future that must stay on the current UI session's thread.
