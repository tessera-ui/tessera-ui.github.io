---
title: Introduction
description: Tessera is a declarative Rust UI framework that renders directly on the GPU across desktop, mobile, and the web.
---

# Introduction

Tessera builds interfaces from plain Rust functions and reactive state, and renders every pixel directly through `wgpu`. The same UI code runs on Windows, macOS, Linux, Android, iOS, and the browser—with no WebView and no native widget bindings.

## Declarative UI in pure Rust

A component is a Rust function marked with `#[tessera]`. Calling a component declares that piece of UI in place and returns a typed handle for optional configuration. Child UI goes into closures, and persistent state lives in `remember` handles.

```rust
use tessera_components::{
    button::button,
    column::column,
    surface::surface,
    text::text,
    theme::material_theme,
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, remember, tessera};

#[tessera]
pub fn app() {
    let count = remember(|| 0i32);

    material_theme().child(move || {
        surface()
            .modifier(Modifier::new().fill_max_size())
            .child(move || {
                column()
                    .modifier(Modifier::new().padding_all(Dp(16.0)))
                    .children(move || {
                        text(format!("Count: {}", count.get()));
                        button()
                            .filled()
                            .on_click(move || count.with_mut(|n| *n += 1))
                            .child(|| text("Increment"));
                    });
            });
    });
}
```

`remember(|| 0i32)` initializes the count once and keeps its `State<i32>` handle across updates. Clicking the button updates `count`, and the text that reads `count.get()` rebuilds with the new label. Around it, `material_theme()` supplies colors, typography, and shapes, `surface()` paints the window background, and `column()` stacks the label above the button.

Projects scaffolded with `cargo tessera` wire this root component into `EntryPoint` in `src/lib.rs` and install `ComponentsPackage` so every target platform boots from one shared entry. See [Project structure](/guide/project-structure).

## Crate layout

New projects depend on the first three crates by default:

- **`tessera-ui`**: the core runtime—`#[tessera]`, `State` and `Model`, `Modifier`, `EntryPoint`, layout/draw extension traits, and `UiTest`.
- **`tessera-foundation`**: design-system-agnostic primitives—alignment, `Shape`, gesture recognizers, and layout/semantics modifiers.
- **`tessera-components`**: Material 3 Expressive controls, themes, containers, text, images, icons, and glass effects.
- **`tessera-platform`**: desktop window controls and clipboard services (installed by `ComponentsPackage`).
- **`tessera-shard`**: screen navigation (`#[shard]`, `shard_home`, `RouterController`) with route-scoped models. Add with `cargo add tessera-shard`.

Localization lives in `tessera-i18n`, build-time asset and catalog generation lives in `tessera-build`, and `cargo tessera` handles scaffolding, checking, live development, and packaging.

For full parameter lists and controller methods, see the [component API reference](https://tessera-ui.github.io/tessera/tessera_components/) and [runtime API reference](https://tessera-ui.github.io/tessera/tessera_ui/), or explore the [live WebGPU gallery](https://tessera-ui.github.io/tessera/example/).

## Reading path

- **Start building**: install the CLI and run an app in [Getting started](/guide/getting-started), then follow the [Tutorial](/guide/tutorial).
- **Learn the model**: read [Thinking in Tessera](/guide/thinking-in-tessera), [State and sharing](/guide/state), and [Identity, lifecycle, and effects](/guide/lifecycle).
- **Build and ship**: work through the UI guides from [Layout basics](/guide/layout), move on to [Entry point, windows, and sessions](/guide/app), and check [Platforms](/guide/platforms) and [Packaging and release](/guide/distribution) before shipping.
