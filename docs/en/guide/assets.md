---
title: Resources
description: Ship images, icons, fonts and data files with your app and load them through generated references.
---

# Resources

Images, icons, fonts and data files you ship with the app go in an assets directory. At build time Tessera generates a typed reference for each file, so you refer to `res::images::LOGO_SVG`, a missing file is a compile error, and the same code finds the file on every platform however it ends up being delivered.

To show an image, pass its generated reference to `.painter(...)`. For an `assets/images/logo.svg` file:

```rust
use tessera_components::{image::image, modifier::ModifierExt as _};
use tessera_ui::{Dp, Modifier, tessera};

use crate::res;

#[tessera]
fn logo() {
    image()
        .painter(res::images::LOGO_SVG)
        .modifier(Modifier::new().size(Dp(96.0), Dp(96.0)));
}
```

The component reads and decodes the file for you. The reference describes where the bytes come from; the component requests the resource and updates when it becomes available. The component rendering pipelines come from `ComponentsPackage`, registered at the [entry point](/guide/app).

## Configure the assets directory

Asset settings belong in `tessera-config.toml` at the package root:

```toml
[assets]
dir = "assets"
embed = ["images/logo.svg"]

[assets.tree_shaking]
exclude = ["runtime/**"]
```

`dir` is relative to the package root and defaults to `assets` when the `[assets]` section exists. The directory must exist. The build helper collects an asset directory only when the `[assets]` section is present.

`embed` lists exact paths relative to that directory. These files stay embedded in the binary even when the CLI chooses platform delivery for the other assets. By default the build helper embeds everything; platform delivery lets the CLI ship files separately through platform resources or HTTP. Let the CLI manage delivery when you [package and release](/guide/distribution) the app.

`tree_shaking.exclude` takes glob patterns for files that must **remain available** even when platform asset analysis finds no reference to them. In other words, it protects files from removal. Use it for resources your code selects dynamically. To keep them embedded under platform delivery, list them in `embed` as well.

## Generated references

The generated project's `build.rs` calls `tessera_build::build()`, which writes the references into a module that `src/res.rs` exposes as `res`; [Project structure](/guide/project-structure) shows those files. Rebuilding picks up added or removed assets.

Directory names become lowercase modules, and file names become uppercase constants that include the extension, with punctuation replaced by underscores. So `images/logo.svg` becomes `res::images::LOGO_SVG`, and `fonts/ExampleSans.ttf` becomes `res::fonts::EXAMPLESANS_TTF`. Names that collide after this normalization are rejected. Leave the generated file to the build, and reach every asset through its generated reference, which carries the delivery path for each platform.

## Images and icons

`Painter` accepts generated assets, file paths, encoded bytes, `ImageData` and `ImageVectorData`. Both `image().painter(...)` and `icon().painter(...)` use this shared representation. A string source is a filesystem path on native targets and a URL on the web, while a generated asset picks the right delivery mechanism for the target.

The Material icons that ship with the components crate are generated assets too, in `filled`, `outlined`, `round`, `sharp` and `two_tone` styles:

```rust
use tessera_components::{icon::icon, material_icons::filled};

#[tessera_ui::tessera]
fn settings_symbol() {
    icon().painter(filled::SETTINGS_SVG);
}
```

Themed components such as icons need a `material_theme()` ancestor; see [Material 3 theming](/guide/theming).

Encoded sources load asynchronously. Native targets read and decode them on workers. The web fetches asynchronously, but decoding currently runs in the browser task, so keep custom web decoders small. While an image or icon is loading, or after a decode failure, it shows no image content. Give it a size to keep the surrounding layout steady when the image arrives.

SVG content is drawn as vector geometry. Paths support solid-color fills and strokes. SVG text, embedded images, gradients, patterns, dashed strokes, clip paths, masks, filters, non-default shape-rendering modes and non-normal blend modes are rejected. Convert text to paths and simplify unsupported artwork before adding it.

The [painter](https://tessera-ui.github.io/tessera/tessera_components/painter/index.html), [image](https://tessera-ui.github.io/tessera/tessera_components/image/index.html) and [icon](https://tessera-ui.github.io/tessera/tessera_components/icon/index.html) API references list the payload and presentation options.

## Fonts

Register fonts as entry packages from `tessera_components::fonts`. `Fonts` takes a static slice of `Font` descriptors. For `assets/fonts/ExampleSans.ttf`:

```rust
use tessera_components::{ComponentsPackage, fonts::{Font, Fonts}};
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

Here, `app` is your existing root component. Select the registered family through `TextStyle::font_family`, for example `Some("Example Sans")`. `fallback` holds inclusive Unicode ranges that request this font even when it is not the selected family, which is how you supply glyphs for scripts the main font lacks. `coverage` limits requests to the ranges the font supports; an empty slice allows every range. Font files load when text first needs them.

`FontStylesheet("https://example.com/fonts.css")` is an alternative entry package, also registered with `.package(...)`. It discovers fonts from CSS `@font-face` rules and requests their files according to `unicode-range`. Prefer bundled font assets when the app has to work offline. Without registered fonts, native text uses system fonts; web builds include a startup font and request additional default fonts from a CDN.

See the [fonts API](https://tessera-ui.github.io/tessera/tessera_components/fonts/index.html) for registration details and [Text and text input](/guide/text) for text styles.

## Load data files

For other files, such as JSON, text or a model file, use `Resource::load(source, decode)`. The decoder has the signature `fn(Arc<[u8]>) -> io::Result<T>` and turns the bytes into your type, which must implement `Clone + Send + Sync + 'static`. It is a plain function pointer, so it cannot capture variables.

Keep the resource with `remember`, then read `Resource::get()` during the build:

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

This example reads a native file, or on the web a URL relative to the page. For content that ships with the app, pass a generated asset; an `assets/files/notice.txt` file would be `res::files::NOTICE_TXT`. `LoadState` distinguishes loading, success and failure, so you can show explicit loading and error UI.

Live requests with the same source and decoder share one result. When loading completes, the builds and measurements that read the resource are invalidated and run again. Keep the handle alive for as long as you need the result; when changing the source should create a new resource, remember it under a key as described in [Lifecycle and side effects](/guide/lifecycle).
