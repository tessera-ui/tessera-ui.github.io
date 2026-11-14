---
title: Tutorial
description: Turn the basic template into a working grocery list app step by step.
---

# Tutorial

In this tutorial, you will turn the `basic` template into a small grocery list app: you can type new items, check them off, delete them, scroll when the list grows long, and toggle dark mode. Each step changes a focused part of `src/app.rs` and links to the guide pages that go deeper into each idea.

## Setup

Create the project and start the desktop dev loop as described in [Getting started](/guide/getting-started):

```sh
cargo tessera new groceries --template basic
cd groceries
cargo tessera dev
```

Leave `cargo tessera dev` running in the background while you work. Every time you save `src/app.rs`, it rebuilds and restarts the window (which clears any items you typed during the previous run—that is expected).

Open `src/app.rs`. The template starts like this:

```rust
use tessera_components::md3::{
    surface::surface,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_foundation::modifier::ModifierExt as _;
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

Reading from outside in: `material_theme()` provides Material theme defaults to everything below it, `surface()` fills the window and paints the theme's background color, and `text` shows the greeting. Containers take child UI as closures, so each layer nests with `.child(|| { ... })`.

## Step 1: Write your own component

A component is a Rust function annotated with `#[tessera]`. Write a `grocery_item` component and display it instead of the greeting:

```rust
use tessera_components::md3::{
    surface::surface,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Modifier, tessera};

#[tessera]
pub fn app() {
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(|| {
            surface()
                .modifier(Modifier::new().fill_max_size())
                .child(|| {
                    grocery_item("Milk");
                });
        });
}

#[tessera]
fn grocery_item(#[prop(into)] name: String) {
    text(name);
}
```

Save the file and the window now shows "Milk".

Because `name` is a plain `String` (not `Option<String>`), it is a required positional argument when calling `grocery_item`. `#[prop(into)]` generates an `impl Into<String>` parameter so you can pass a `&str` literal like `"Milk"` directly. Calling `grocery_item("Milk")` declares that this component belongs at this spot in the tree; Tessera runs its body when building the UI. See [Thinking in Tessera](/guide/thinking-in-tessera).

## Step 2: Arrange items in a column

A list needs more than one item. Move the screen layout into a `grocery_screen` component and use `column` to stack a heading above a few items:

```rust
use tessera_components::{
    column::column,
    md3::{
        surface::surface,
        text::text,
        theme::{MaterialTheme, material_theme},
    },
    spacer::spacer,
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, tessera};

#[tessera]
pub fn app() {
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(|| {
            surface()
                .modifier(Modifier::new().fill_max_size())
                .child(|| {
                    grocery_screen();
                });
        });
}

#[tessera]
fn grocery_screen() {
    column()
        .modifier(Modifier::new().fill_max_size().padding_all(Dp(16.0)))
        .children(|| {
            text("Groceries");
            spacer().modifier(Modifier::new().height(Dp(8.0)));
            grocery_item("Milk");
            grocery_item("Eggs");
            grocery_item("Bread");
        });
}

#[tessera]
fn grocery_item(#[prop(into)] name: String) {
    text(name).modifier(Modifier::new().padding_symmetric(Dp(0.0), Dp(12.0)));
}
```

You now see the "Groceries" heading and three padded rows, inset 16 dp from the window edges.

`column` stacks children top to bottom in call order. Sizes and spacing come from `Modifier` chains: the column fills the surface with outer padding, a fixed-height `spacer` creates a gap under the heading, and each item adds vertical padding. Dimensions use density-independent pixels (`Dp`) so physical sizing scales across displays. Keeping `app` focused on app-wide setup also prepares for theme state in Step 6. See [Layout basics](/guide/layout) and [Modifiers](/guide/modifiers).

## Step 3: Add items from a text field

A real list starts empty and grows from user input. You need three things: state for the items, a text field, and an action that appends to the list and clears the field. Update `src/app.rs`:

```rust
use tessera_components::{
    alignment::CrossAxisAlignment,
    boxed::boxed,
    column::column,
    md3::{
        button::button,
        surface::surface,
        text::text,
        text_field::text_field,
        text_input::TextInputController,
        theme::{MaterialTheme, material_theme},
    },
    row::row,
    spacer::spacer,
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Callback, Dp, Modifier, key, remember, tessera};

#[tessera]
pub fn app() {
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(|| {
            surface()
                .modifier(Modifier::new().fill_max_size())
                .child(|| {
                    grocery_screen();
                });
        });
}

#[tessera]
fn grocery_item(#[prop(into)] name: String) {
    text(name).modifier(Modifier::new().padding_symmetric(Dp(0.0), Dp(12.0)));
}

#[derive(Clone, PartialEq)]
struct Grocery {
    id: u64,
    name: String,
}

#[tessera]
fn grocery_screen() {
    let items = remember(Vec::<Grocery>::new);
    let next_id = remember(|| 0_u64);
    let editor = remember(|| TextInputController::new(Dp(16.0), Some(Dp(24.0))));

    let add = Callback::new(move || {
        let name = editor.with(|editor| editor.text()).trim().to_string();
        if name.is_empty() {
            return;
        }
        let id = next_id.get();
        next_id.set(id + 1);
        items.with_mut(|items| items.push(Grocery { id, name }));
        editor.with_mut(|editor| editor.set_text(""));
    });

    column()
        .modifier(Modifier::new().fill_max_size().padding_all(Dp(16.0)))
        .children(move || {
            text("Groceries");
            spacer().modifier(Modifier::new().height(Dp(8.0)));
            row()
                .modifier(Modifier::new().fill_max_width())
                .cross_axis_alignment(CrossAxisAlignment::Center)
                .children(move || {
                    boxed()
                        .modifier(Modifier::new().weight(1.0))
                        .children(move || {
                            text_field()
                                .modifier(Modifier::new().fill_max_width())
                                .controller(editor)
                                .label("Add an item")
                                .on_submit_shared(add);
                        });
                    spacer().modifier(Modifier::new().width(Dp(8.0)));
                    button().on_click_shared(add).child(|| text("Add"));
                });
            for item in items.get() {
                key(item.id, || {
                    grocery_item(item.name);
                });
            }
        });
}
```

Type an item name and click **Add** (or press Enter): the item appears below and the input clears.

Component bodies run again on rebuild, so an ordinary local `Vec` would reset on every update. `remember` preserves values across rebuilds and gives you a `Copy` handle (`State<T>`). Because `column`'s children closure calls `items.get()`, writing to `items` schedules a rebuild of that subtree. See [State and sharing](/guide/state).

The text field stores its buffer in `TextInputController`; remembering the controller yourself lets the `add` action read and clear it. Wrapping the closure in `Callback::new` creates a reusable handle so both the button and the field's Enter handler can share it via `_shared` setters. Inside the row, `.weight(1.0)` gives the boxed wrapper all width remaining after the spacer and button, and `fill_max_width()` stretches the text field to fill that box.

Finally, `key(item.id, ...)` binds each rendered row to its item ID instead of its loop index, which matters as soon as items can be deleted in the next step. See [Identity, lifecycle, and effects](/guide/lifecycle) and [Text and text input](/guide/text).

## Step 4: Check off and delete items

Now give each item a `done` flag, a checkbox, and a delete icon button. Update the imports, `Grocery`, and `grocery_item`, and add two small mutation helpers:

```rust
use tessera_components::{
    alignment::CrossAxisAlignment,
    boxed::boxed,
    column::column,
    md3::{
        button::button,
        checkbox::checkbox,
        icon_button::icon_button,
        material_icons::filled,
        surface::surface,
        text::text,
        text_field::text_field,
        text_input::TextInputController,
        theme::{MaterialTheme, material_theme},
    },
    row::row,
    spacer::spacer,
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Callback, CallbackWith, Dp, Modifier, State, key, remember, tessera};

#[derive(Clone, PartialEq)]
struct Grocery {
    id: u64,
    name: String,
    done: bool,
}

fn set_done(items: State<Vec<Grocery>>, id: u64, done: bool) {
    items.with_mut(|items| {
        if let Some(item) = items.iter_mut().find(|item| item.id == id) {
            item.done = done;
        }
    });
}

fn remove(items: State<Vec<Grocery>>, id: u64) {
    items.with_mut(|items| items.retain(|item| item.id != id));
}

#[tessera]
fn grocery_item(item: Grocery, on_checked_change: CallbackWith<bool>, on_delete: Callback) {
    row()
        .modifier(Modifier::new().fill_max_width())
        .cross_axis_alignment(CrossAxisAlignment::Center)
        .children(move || {
            checkbox(item.done)
                .accessibility_label(item.name.clone())
                .on_toggle_shared(on_checked_change);
            text(item.name.clone()).modifier(Modifier::new().weight(1.0));
            icon_button()
                .standard()
                .icon(filled::DELETE_SVG)
                .accessibility_label(format!("Delete {}", item.name))
                .on_click_shared(on_delete);
        });
}
```

In `grocery_screen`, update `add` to push `Grocery { id, name, done: false }`, and replace the `for` loop at the end of the column with:

```rust
            for item in items.get() {
                let id = item.id;
                key(id, || {
                    grocery_item(
                        item,
                        move |done| set_done(items, id, done),
                        move || remove(items, id),
                    );
                });
            }
```

Each row now has a leading checkbox and a trailing trash button.

Notice how `grocery_item` owns no state: it takes the current `item` value and reports user actions through callbacks, while `grocery_screen` remains the single source of truth for `items`. That pattern is state hoisting. Notice also that required callback parameters (`Callback` and `CallbackWith<bool>`) accept closures directly at the call site, and `checkbox(item.done)` takes its checked state as a required argument. Setting `accessibility_label` on the icon button gives screen readers and UI tests a clear name for an icon-only control. See [State and sharing](/guide/state#lifting-state-to-the-caller) and [Semantics and accessibility](/guide/accessibility).

## Step 5: Make long lists scroll

Add a dozen items and the bottom ones overflow the window: `column` builds and lays out every child at once. Replace the `for` loop with `lazy_column`, which scrolls and builds only the items visible in its viewport. Add `lazy_list::lazy_column` to the `tessera_components::md3` imports, remove `key` from the `tessera_ui` imports (the lazy list tracks keys directly), and replace the loop:

```rust
            lazy_column()
                .modifier(Modifier::new().fill_max_width().weight(1.0))
                .items_from_iter_with_key(
                    items.get(),
                    |_, item| item.id,
                    move |_, item| {
                        let id = item.id;
                        grocery_item(
                            item.clone(),
                            move |done| set_done(items, id, done),
                            move || remove(items, id),
                        );
                    },
                );
```

When the list exceeds the remaining vertical space, it scrolls with the mouse wheel or touch while the heading and input row stay pinned at the top.

A scrollable container needs bounded height along its scroll axis. `.weight(1.0)` gives `lazy_column` whatever height remains inside the full-size `column`. The second closure returns each item's stable key so rows stay matched to their records as items are removed. Because all item data lives in `grocery_screen`, scrolling an item offscreen and back never drops its checked state. See [Lists, grids, and scrolling](/guide/lists).

## Step 6: Theme the app and add dark mode

So far the app uses the default light palette. Let's pick a green seed color, give the heading a Material typography role, and add a dark-mode toggle. Store the `dark` flag in `app`, generate the theme from it, and pass the handle down:

```rust
#[tessera]
pub fn app() {
    let dark = remember(|| false);
    material_theme()
        .theme(move || MaterialTheme::from_seed(Color::from_rgb(0.2, 0.5, 0.25), dark.get()))
        .child(move || {
            surface()
                .modifier(Modifier::new().fill_max_size())
                .child(move || {
                    grocery_screen(dark);
                });
        });
}
```

Update `grocery_screen` to take `dark: State<bool>`, read the heading style from `MaterialTheme`, and place an icon button beside the heading:

```rust
#[tessera]
fn grocery_screen(dark: State<bool>) {
    let title_style = use_context::<MaterialTheme>()
        .expect("grocery_screen needs a material_theme ancestor")
        .get()
        .typography
        .headline_small;
    let items = remember(Vec::<Grocery>::new);
    let next_id = remember(|| 0_u64);
    let editor = remember(|| TextInputController::new(Dp(16.0), Some(Dp(24.0))));

    let add = Callback::new(move || {
        let name = editor.with(|editor| editor.text()).trim().to_string();
        if name.is_empty() {
            return;
        }
        let id = next_id.get();
        next_id.set(id + 1);
        items.with_mut(|items| items.push(Grocery { id, name, done: false }));
        editor.with_mut(|editor| editor.set_text(""));
    });

    column()
        .modifier(Modifier::new().fill_max_size().padding_all(Dp(16.0)))
        .children(move || {
            row()
                .modifier(Modifier::new().fill_max_width())
                .cross_axis_alignment(CrossAxisAlignment::Center)
                .children(move || {
                    text("Groceries")
                        .style(title_style)
                        .modifier(Modifier::new().weight(1.0));
                    icon_button()
                        .standard()
                        .icon(filled::DARK_MODE_SVG)
                        .selected(dark.get())
                        .accessibility_label("Dark theme")
                        .on_click(move || dark.set(!dark.get()));
                });
            spacer().modifier(Modifier::new().height(Dp(8.0)));
            row()
                .modifier(Modifier::new().fill_max_width())
                .cross_axis_alignment(CrossAxisAlignment::Center)
                .children(move || {
                    boxed()
                        .modifier(Modifier::new().weight(1.0))
                        .children(move || {
                            text_field()
                                .modifier(Modifier::new().fill_max_width())
                                .controller(editor)
                                .label("Add an item")
                                .on_submit_shared(add);
                        });
                    spacer().modifier(Modifier::new().width(Dp(8.0)));
                    button().on_click_shared(add).child(|| text("Add"));
                });
            lazy_column()
                .modifier(Modifier::new().fill_max_width().weight(1.0))
                .items_from_iter_with_key(
                    items.get(),
                    |_, item| item.id,
                    move |_, item| {
                        let id = item.id;
                        grocery_item(
                            item.clone(),
                            move |done| set_done(items, id, done),
                            move || remove(items, id),
                        );
                    },
                );
        });
}
```

Add `Color` and `use_context` to the `tessera_ui` imports. Controls switch to the green palette, the heading scales up, and the moon icon toggles light and dark themes across the entire app. See [Material 3 theming](/guide/theming).

## Complete `src/app.rs`

::: details Full source for src/app.rs
```rust
use tessera_components::{
    alignment::CrossAxisAlignment,
    boxed::boxed,
    column::column,
    md3::{
        button::button,
        checkbox::checkbox,
        icon_button::icon_button,
        lazy_list::lazy_column,
        material_icons::filled,
        surface::surface,
        text::text,
        text_field::text_field,
        text_input::TextInputController,
        theme::{MaterialTheme, material_theme},
    },
    row::row,
    spacer::spacer,
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{
    Callback, CallbackWith, Color, Dp, Modifier, State, remember, tessera, use_context,
};

#[derive(Clone, PartialEq)]
struct Grocery {
    id: u64,
    name: String,
    done: bool,
}

fn set_done(items: State<Vec<Grocery>>, id: u64, done: bool) {
    items.with_mut(|items| {
        if let Some(item) = items.iter_mut().find(|item| item.id == id) {
            item.done = done;
        }
    });
}

fn remove(items: State<Vec<Grocery>>, id: u64) {
    items.with_mut(|items| items.retain(|item| item.id != id));
}

#[tessera]
fn grocery_item(item: Grocery, on_checked_change: CallbackWith<bool>, on_delete: Callback) {
    row()
        .modifier(Modifier::new().fill_max_width())
        .cross_axis_alignment(CrossAxisAlignment::Center)
        .children(move || {
            checkbox(item.done)
                .accessibility_label(item.name.clone())
                .on_toggle_shared(on_checked_change);
            text(item.name.clone()).modifier(Modifier::new().weight(1.0));
            icon_button()
                .standard()
                .icon(filled::DELETE_SVG)
                .accessibility_label(format!("Delete {}", item.name))
                .on_click_shared(on_delete);
        });
}

#[tessera]
pub fn app() {
    let dark = remember(|| false);
    material_theme()
        .theme(move || MaterialTheme::from_seed(Color::from_rgb(0.2, 0.5, 0.25), dark.get()))
        .child(move || {
            surface()
                .modifier(Modifier::new().fill_max_size())
                .child(move || {
                    grocery_screen(dark);
                });
        });
}

#[tessera]
fn grocery_screen(dark: State<bool>) {
    let title_style = use_context::<MaterialTheme>()
        .expect("grocery_screen needs a material_theme ancestor")
        .get()
        .typography
        .headline_small;
    let items = remember(Vec::<Grocery>::new);
    let next_id = remember(|| 0_u64);
    let editor = remember(|| TextInputController::new(Dp(16.0), Some(Dp(24.0))));

    let add = Callback::new(move || {
        let name = editor.with(|editor| editor.text()).trim().to_string();
        if name.is_empty() {
            return;
        }
        let id = next_id.get();
        next_id.set(id + 1);
        items.with_mut(|items| items.push(Grocery { id, name, done: false }));
        editor.with_mut(|editor| editor.set_text(""));
    });

    column()
        .modifier(Modifier::new().fill_max_size().padding_all(Dp(16.0)))
        .children(move || {
            row()
                .modifier(Modifier::new().fill_max_width())
                .cross_axis_alignment(CrossAxisAlignment::Center)
                .children(move || {
                    text("Groceries")
                        .style(title_style)
                        .modifier(Modifier::new().weight(1.0));
                    icon_button()
                        .standard()
                        .icon(filled::DARK_MODE_SVG)
                        .selected(dark.get())
                        .accessibility_label("Dark theme")
                        .on_click(move || dark.set(!dark.get()));
                });
            spacer().modifier(Modifier::new().height(Dp(8.0)));
            row()
                .modifier(Modifier::new().fill_max_width())
                .cross_axis_alignment(CrossAxisAlignment::Center)
                .children(move || {
                    boxed()
                        .modifier(Modifier::new().weight(1.0))
                        .children(move || {
                            text_field()
                                .modifier(Modifier::new().fill_max_width())
                                .controller(editor)
                                .label("Add an item")
                                .on_submit_shared(add);
                        });
                    spacer().modifier(Modifier::new().width(Dp(8.0)));
                    button().on_click_shared(add).child(|| text("Add"));
                });
            lazy_column()
                .modifier(Modifier::new().fill_max_width().weight(1.0))
                .items_from_iter_with_key(
                    items.get(),
                    |_, item| item.id,
                    move |_, item| {
                        let id = item.id;
                        grocery_item(
                            item.clone(),
                            move |done| set_done(items, id, done),
                            move || remove(items, id),
                        );
                    },
                );
        });
}
```
:::

Run `cargo tessera check` before committing to make sure all call-boundary and compiler checks pass.

## Next steps

You have just used most of the core pieces of a Tessera app. Read [Thinking in Tessera](/guide/thinking-in-tessera) and [State and sharing](/guide/state) to solidify the mental model behind what you wrote, or check the [component API reference](https://tessera-ui.github.io/tessera/tessera_components/) for other controls you can drop in.
