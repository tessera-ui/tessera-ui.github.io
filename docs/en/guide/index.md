---
title: Introduction
description: Tessera is a Rust UI framework that builds interfaces from functions and reactive state and draws them on the GPU.
---

# Introduction

With Tessera you describe your interface in plain Rust functions, and the framework keeps the screen in step with your data. It draws everything itself with wgpu, so the same code runs on Windows, macOS, Linux, Android, iOS and the web.

## How a Tessera interface works

A component is a Rust function marked with `#[tessera]`, and calling it declares that this piece of UI belongs here. Setters on the returned handle configure that use, and closures supply its children. When state changes, Tessera rebuilds the components that read that state, and the new declarations become the new interface.

Here is a complete root component, a counter:

```rust
use tessera_components::{
    button::button, column::column, modifier::ModifierExt as _, surface::surface,
    text::text, theme::material_theme,
};
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

`remember` initializes the count once, when its state slot is created, and keeps it across rebuilds. The click callback changes the value; building the label reads it, so each click rebuilds the part of the interface that shows the number. Around them, the Material theme provides colors, typography and shapes to everything beneath it, the surface fills the window and paints its background, and the column places the label above the button.

The CLI writes the startup code for you. A project it creates has a `src/lib.rs` that creates an `EntryPoint` for this root and registers `ComponentsPackage`, which installs the rendering and platform services the component library needs. The desktop binary, Android, iOS and the web all start that same entry. [Project structure](/guide/project-structure) shows those files.

## What you build with

Tessera's own renderer draws the whole UI on every platform, the browser included. The work is split across a few crates, and a new project depends on the first two.

- **`tessera-ui`** is the runtime. It provides `#[tessera]`, state such as `remember`, `Modifier`, the application entry point, layout and drawing extension points, and test sessions.
- **`tessera-components`** is the component library: Material 3 Expressive controls, themes, layout containers, images, icons, fonts and visual effects. Most applications are built from it, and for anything beyond it you can write your own layout and rendering.
- **`tessera-shard`** adds screen navigation, state scoped to a screen, and groups of background tasks. Add it with `cargo add tessera-shard` when you need [Navigation](/guide/navigation) or [Background tasks](/guide/tasks).

Localization lives in `tessera-i18n`, and the generated project's build script uses `tessera-build` to turn your configuration, assets and catalogs into Rust code. The `cargo tessera` command-line tool creates, runs, checks and packages projects on every platform.

These guides use controls to explain concepts. For each control's parameters, defaults and controller methods, use the [component API reference](https://tessera-ui.github.io/tessera/tessera_components/) and the [runtime API reference](https://tessera-ui.github.io/tessera/tessera_ui/). To see what the component library looks like, open the [running gallery](https://tessera-ui.github.io/tessera/example/).

## Next steps

[Getting started](/guide/getting-started) installs the tools and runs a new project. After that, the [Tutorial](/guide/tutorial) builds a small app step by step.

Once you have something running, read in whatever order your application needs. [Thinking in Tessera](/guide/thinking-in-tessera) and [State](/guide/state) explain the model behind the counter above. The UI pages, starting with [Layout basics](/guide/layout), cover what users see and touch, and the pages from [Entry point and windows](/guide/app) onward cover structuring, testing and shipping an application. When you are ready to release, [Platforms](/guide/platforms) and [Packaging and release](/guide/distribution) describe each target.
