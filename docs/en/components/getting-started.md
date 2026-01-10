---
title: Getting Started
order: 0
---

# Getting Started

`tessera-ui-basic-components` is the official component library for `tessera-ui`. It provides a set of common foundational components. It is completely optional and is decoupled from the `tessera-ui` core library.

## Installation

We assume you have already added and configured `tessera-ui` as a dependency for your project. If not, please refer to [Getting Started](../guide/getting-started.md).

Next, add `tessera-ui-basic-components` as a dependency:

```bash
cargo add tessera-ui-basic-components
```

## Registering with the renderer

::: warning
If you do not register the corresponding pipelines with the renderer, the renderer will crash.
:::

`tessera-ui` uses a decentralized renderer architecture, so you need to register `tessera-ui-basic-components` with the renderer.

Assume your original renderer initialization looks like:

```rust
use tessera_ui::{Renderer, renderer::TesseraConfig};

fn main() {
    let config = TesseraConfig {
        window_title: "Tessera".to_string(), // Window title
        ..Default::default()
    };
    Renderer::run_with_config(
        || {}, // UI entry function
        |app| {},
        config,
    )
    .unwrap();
}
```

You need to modify it as follows:

```rust
use tessera_ui::{Renderer, renderer::TesseraConfig};

fn main() {
    let config = TesseraConfig {
        window_title: "Tessera".to_string(), // Window title
        ..Default::default()
    };
    Renderer::run_with_config(
        || {}, // UI entry function
        |app| {
            tessera_ui_basic_components::pipelines::register_pipelines(app); // Register pipelines required by the basic components
        },
        config,
    )
    .unwrap();
}
```

## Using components

Now you can use components provided by `tessera-ui-basic-components` inside `#[tessera]` functions. Here is an example that uses `surface` as a background:

```rust
use tessera_ui::{Color, DimensionValue, Renderer, renderer::TesseraConfig, tessera};
use tessera_ui_basic_components::surface::{SurfaceArgsBuilder, surface};

fn main() {
    let config = TesseraConfig {
        window_title: "Tessera Example".to_string(), // Window title
        ..Default::default()
    };
    Renderer::run_with_config(
        || app(), // UI entry, the top-level tessera
        |app| {
            tessera_ui_basic_components::pipelines::register_pipelines(app); // Register pipelines
        },
        config,
    )
    .unwrap();
}

#[tessera]
fn app() {
    surface(
        SurfaceArgsBuilder::default()
            .style(Color::WHITE.into()) // Set surface background color to white
            .width(DimensionValue::FILLED) // Fill parent width
            .height(DimensionValue::FILLED) // Fill parent height
            .build()
            .unwrap(),
        None, // The second argument is the ripple state for click animations; background surface doesn't need clicks so pass None
        || {
            // surface is a container component that can hold other components; here we pass an empty closure as placeholder
        },
    );
}
```

Run `cargo run` to see a white window.

![White window](/getting-start-2.png)
