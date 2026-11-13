---
title: Thinking in Tessera
description: Write #[tessera] components, configure handles, compose with RenderSlot and Callback, and follow call-boundary rules.
---

# Thinking in Tessera

In Tessera, you declare what the UI should be for the current state rather than mutating widgets by hand. When state changes, Tessera re-runs the affected components and reconciles the screen with the new declarations.

## Components are functions

Annotate a Rust function with `#[tessera]` to define a component. Non-optional parameters become required positional arguments; `Option<T>` parameters become optional chainable setters on the returned configuration handle.

```rust
use tessera_components::text::text;
use tessera_ui::tessera;

#[tessera]
fn greeting(#[prop(into)] name: String, excited: Option<bool>) {
    let mark = if excited.unwrap_or(false) { "!" } else { "." };
    text(format!("Hello, {name}{mark}"));
}

#[tessera]
fn greeting_demo() {
    greeting("Ada").excited(true);
}
```

Follow these conventions when designing component parameters:

- **Required vs. optional**: keep mandatory inputs as plain types (`name: String`), and declare optional inputs as `Option<T>` with explicit defaults resolved in the body (`excited.unwrap_or(false)`).
- **Use `#[prop(into)]`** on string or convertible fields so callers can pass `"Ada"` directly.
- **Keep props owned and comparable**: parameter types must implement `Clone + 'static` (and `PartialEq` unless marked `#[prop(skip_eq)]`).

Examples on this page run inside an app's `material_theme()`. See [Material 3 theming](/guide/theming).

## Control flow is plain Rust

Conditional UI and repetition use ordinary `if`, `match`, and `for`:

```rust
use tessera_components::{column::column, text::text};
use tessera_ui::tessera;

#[tessera]
fn greetings(names: Vec<String>) {
    column().children(move || {
        for name in &names {
            text(format!("Hello, {name}"));
        }
    });
}
```

When loop items can reorder, insert, or delete while holding local state, wrap each item with `key(...)`. See [Identity, lifecycle, and effects](/guide/lifecycle#identifying-reordered-items-with-key).

## Calls fix order; handles configure options

Calling a component registers one UI use in call order and returns a configuration handle. Even if you bind handles to local variables and configure them out of order, the resulting UI stays in call order:

```rust
use tessera_components::{row::row, text::text};
use tessera_ui::{Dp, tessera};

#[tessera]
fn heading() {
    row().children(|| {
        let title = text("Title");
        let description = text("Description");

        description.size(Dp(14.0));
        title.size(Dp(24.0));
    });
}
```

`Title` appears before `Description`. Configure a handle immediately after creating it, and do not store handles across builds—use [State](/guide/state) and controllers for changes after the initial declaration.

## Passing child UI with `RenderSlot`

Accept deferred child content with `RenderSlot` (or `RenderSlotWith<T>` when passing a value down to the slot):

```rust
use tessera_components::{column::column, text::text};
use tessera_ui::{RenderSlot, tessera};

#[tessera]
fn section(#[prop(into)] title: String, child: Option<RenderSlot>) {
    column().children(move || {
        text(title.clone());
        if let Some(child) = child {
            child.render();
        }
    });
}

#[tessera]
fn page() {
    section("Account").child(|| text("Ada"));
}
```

The parent controls if, when, and in what context a slot renders. Pass closures directly to `.child(|| ...)` or `.children(|| ...)`; construct `RenderSlot::new(...)` and pass it via `_shared` setters only when storing or forwarding an existing slot. Never pass a component call as an argument expecting a slot—component calls register in the caller immediately.

## Reporting events with `Callback`

Pass data down through props and report actions up through `Callback` or `CallbackWith<T, R>`:

```rust
use tessera_components::{button::button, text::text};
use tessera_ui::{Callback, tessera};

#[tessera]
fn click_counter(clicks: u32, on_click: Option<Callback>) {
    button()
        .on_click(move || {
            if let Some(on_click) = on_click {
                on_click.call();
            }
        })
        .child(move || text(format!("Clicked {clicks} times")));
}
```

Callbacks require owned `'static` captures and run on the UI thread, so they do not need `Send + Sync`. When a callback needs current data, capture a `State<T>` handle and read it inside the callback.

## Execution boundaries

Tessera enforces a clean split between **UI-building code** and **ordinary Rust code**:

- **Build contexts**: `#[tessera]` and `#[shard]` functions, root entry closures (`EntryPoint::new`, `UiTest::content`), and render-slot closures (`RenderSlot`, `RenderSlotWith`, `key`, `provide_context`, and built-in container content closures).
- **Ordinary Rust**: helpers, methods, event callbacks (`on_click`, `on_change`), iterator combinators (`.map(...)`, `.unwrap_or_else(...)`), and async tasks.

Call components and build-scoped APIs (`remember`, `retain`, `use_context`, `provide_context`, `launch`, `key`, `RenderSlot::new`) only inside build contexts. To share reusable UI snippets, extract a `#[tessera]` function; to react to user input, update state in the callback and let the UI rebuild. Run `cargo tessera check` to verify these boundaries before building.

## Keeping component bodies pure

Component bodies may run repeatedly when inputs or read state change, or be skipped when unchanged:

- Compute derived values and declare child UI in the body; keep I/O, timers, and requests in event callbacks, slot initializers, or `launch`.
- Do not write to `State` during a build; update state from actions or tasks.
- When a prop field should be hidden from the builder or excluded from prop diffing, use `#[prop(skip_setter)]` or `#[prop(skip_eq)]`.

## Next steps

Continue to [State and sharing](/guide/state) to manage component-local, screen-scoped, and inherited data.
