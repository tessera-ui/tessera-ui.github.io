---
title: Thinking in Tessera
description: How declarative components, props and rebuilds fit together in Tessera.
---

# Thinking in Tessera

In Tessera you describe what the interface should look like for the current data, and the framework works out what to change on screen. To update the screen, you change the data, and the components that depend on it run again and describe the new interface. Once that idea clicks, the rest of the API follows from it.

## Describe the UI for the current data

A component is a function that takes data and declares UI. When the data changes, Tessera calls the function again, which is called a *rebuild*, and the new declaration replaces the old one. The screen always comes from the latest declaration, so it stays in agreement with the data. Since Tessera only rebuilds the parts that can have changed, describing the whole component again is cheap.

## Components are functions

Mark a Rust function with `#[tessera]` to make it a component. Non-optional parameters become required arguments that you pass in the call. `Option<T>` parameters become named builder setters, and you resolve their defaults inside the function body:

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

A few things are worth noticing here:

- The function returns nothing: calling `text(...)` declares a text element as part of `greeting`.
- `#[prop(into)]` lets callers pass anything convertible to the prop type, so `"Ada"` works where a `String` is expected.
- Defaults live in the function body. Declare the parameter as `Option<T>` and decide the default there, as `excited.unwrap_or(false)` does.
- Props own their data, so pass owned strings and stable handles. Tessera compares props when deciding whether a child must run again, so prop types implement `Clone` and `PartialEq`.

These examples are components that run inside your app, beneath its `material_theme()`. See the [Introduction](/guide/) for a complete root component, and [Theming](/guide/theming) for the theme itself.

## Dynamic content is ordinary Rust

Because components are plain functions, you use plain Rust for control flow. A loop declares one element per item, and an `if` decides whether something exists at all:

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

When the items can be reordered and carry state, give each one a key so its state follows it; [Lifecycle and side effects](/guide/lifecycle#identify-items-with-keys) explains why.

## A call declares a use

Calling a component registers one use of it right away and returns a typed configuration handle. The component's body runs later in the same build, when Tessera expands the declarations, before layout and drawing.

The order of the calls is the order in the tree. Setters configure the pending use and leave its position as it is:

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

Title comes before Description even though Description is configured first. The use keeps its place and still happens if you move, save or drop the handle. Chaining is the usual form, but ordinary Rust helpers can configure a handle too.

A handle is only configurable while its use is pending. Once that use starts executing, its props are final and further setters panic. Expanding a render slot can commit earlier pending declarations in the same build, so configure a handle right after you create it. Handles describe a single build, so keep them local to that build: the next build creates new ones even when the component's identity and remembered state are unchanged. Keep anything that must last in [state](/guide/state) and controllers.

## Compose components

You customize by wrapping one component in another and by passing content into it. Containers take child content as build closures, and your own components can do the same with `RenderSlot`:

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

The parent decides whether, where and in which context the slot is expanded. A slot declares its content only when it is rendered. When the content needs a value from its parent, use `RenderSlotWith<T>`.

Child content is a closure that calls components when the slot is expanded. A component handle is a declaration that has already taken its place in the tree where it was called, so to put a component inside a container, call it inside the container's closure. Pass closures directly, and construct `RenderSlot::new(...)` only when the content needs independent storage or forwarding, then hand it over with the matching `_shared` setter.

## Data flows down, events flow up

A component receives data through props and reports what happened through callbacks. Declare callback props as `Callback`, or `CallbackWith<T, R>` when the callback takes a value:

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

`click_counter` shows the number it was given and tells its caller when it was clicked; the counting happens in the caller. The caller updates its state, Tessera rebuilds what read that state, and `click_counter` runs again with the new number. [State](/guide/state#hoist-state-to-the-caller) shows the caller's side.

`Callback::call()` takes no argument; `CallbackWith<T, R>::call(value)` takes a `T` and returns an `R`, which defaults to `()`. Generated setters accept closures, and `_shared` setters accept an existing callback handle. Stored callbacks and slots need owned captures that are `Send + Sync + 'static`. When an action needs current data, capture a `State<T>` handle and read it when the action runs; that way the action sees the latest value.

## How rebuilding works

When state that a component read during its build changes, Tessera marks that component for rebuilding and runs that one body again. A parent that only passed a handle along stays as it is, and when a parent does rebuild, a child whose props compare equal and whose own build is clean can be skipped entirely. Changed props can also make a child run, even when the state it reads is unchanged. The [rendering guide](/guide/rendering) covers what happens after the build.

This has consequences for how you write component bodies:

- **A body can run many times, or not at all.** Tessera decides how often based on what changed. Keep the body repeatable: compute values and declare children there. Start network requests, file writes and similar work from actions or initializers, see [where side effects belong](/guide/lifecycle#run-side-effects-outside-the-build); work placed in the body, including counting its calls, would repeat or be skipped as rebuilds vary.
- **Pass data through props and state.** Siblings are laid out in declaration order, but whether a particular body runs in a given rebuild depends on what is dirty, so a state write in one body reaches another body only if that body happens to run afterwards. A write during a build also makes readers that already ran with the old value rebuild again.
- **Build UI only in build contexts.** Components and recognized build closures (child setters, render slots and root callbacks such as `EntryPoint::new`) declare UI, and a plain `for` loop inside a build works too. Event callbacks, closures passed to iterator adapters such as `map`, and ordinary helpers sit outside that context. An action changes state, and the next build declares the new interface.

`cargo tessera check` verifies these call boundaries. A helper becomes a component only through the attribute, even when a component calls it, so annotate any helper that declares UI with `#[tessera]`.

## Advanced props

The macro also supports generic components. `#[prop(skip_setter)]` hides an internal backing field from the builder. `#[prop(skip_eq)]` leaves a field out of the prop comparison mentioned above; use it only when skipping that comparison cannot hide a real change to the UI.

## Next steps

Components get interesting once they hold data that changes. Continue with [State](/guide/state).
