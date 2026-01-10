---
title: Getting Started
order: 0
---

# Getting Started

This section guides you through creating a basic `tessera` application.

## Installation

### Prerequisites

- The [Rust](https://www.rust-lang.org) programming language

## Create a new project

First, make sure you have the `cargo-tessera` CLI installed — it bundles the commands for creating, developing, and building Tessera apps.

```bash
cargo install cargo-tessera
```

Then create a new tessera project:

```bash
cargo tessera new
```

`cargo-tessera` will walk you through creating the project and generate a scaffold with example code. For this guide pick the `blank` template.

After creation, enter the project directory and run the dev server:

```bash
cargo tessera dev
```

If a black or transparent window appears, your app is running.

![empty](/getting-start-1.png)

## Your first `tessera`

In `tessera`, a component is a function marked with the `tessera` macro — we also call components "tessera".

### Add a background

Open your project's `src/app.rs` and find the generated `app` function; it should look like this:

```rust
#[tessera]
pub fn app() {
    material_theme(MaterialTheme::default, || {
        // Your app code goes here
    });
}
```

The `blank` template provides an empty `app` entry point — we'll add a white `surface` that fills the window and acts as the background:

```rust
#[tessera]
pub fn app() {
    material_theme(MaterialTheme::default, || {
        surface(
            SurfaceArgs::default().modifier(Modifier::new().fill_max_size()),
            || {},
        );
    });
}
```

When `cargo tessera dev` completes a rebuild (or after restarting it), you should see a solid background.

![surface](/getting-start-2.png)

### Add text

Next add a text component showing "Hello Tessera!":

```rust
#[tessera]
pub fn app() {
    material_theme(MaterialTheme::default, || {
        surface(
            SurfaceArgs::default().modifier(Modifier::new().fill_max_size()),
            || {
                text("Hello Tessera!");
            },
        );
    });
}
```

After the dev server rebuilds, you'll see a white window with black "Hello Tessera!" text.

![hello](/getting-start-3.png)

## What's next

Congratulations — you have a simple `tessera` app running. Next, explore the [Tessera component model](../guide/component.md).
