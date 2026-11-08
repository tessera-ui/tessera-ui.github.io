---
title: Tutorial
description: Build a small grocery list app step by step, starting from the basic template.
---

# Tutorial

In this tutorial you turn the `basic` template into a small grocery list: you can add items, check them off, delete them, scroll through a long list and switch to a dark theme. Each step changes `src/app.rs` a little, tells you what to look for on screen, and links to the page that explains the idea in depth, so you can keep moving now and come back for the details later.

## Before you start

Create a project from the `basic` template and start the development loop, as described in [Getting started](/guide/getting-started):

```sh
cargo tessera new groceries --template basic
cd groceries
cargo tessera dev
```

Leave `dev` running while you work. Every time you save, it rebuilds and restarts the app. Because the process restarts, the app starts fresh after each save and anything you typed into it is cleared; that is expected.

Open `src/app.rs`. The template gives you this:

```rust
use tessera_components::{
    modifier::ModifierExt as _,
    surface::surface,
    text::text,
    theme::{MaterialTheme, material_theme},
};
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

Read it from the outside in. `material_theme()` makes a Material theme available to everything inside it, and the Material controls you add later rely on it. `surface()` fills the window and paints the theme's background. `text` shows the greeting. Containers take their content as closures, which is why each level is a `.child(|| { ... })`.

## Step 1: Write your own component

A component is a Rust function marked with `#[tessera]`. Add one for a single grocery item and call it in place of the greeting:

```rust
use tessera_components::{
    modifier::ModifierExt as _,
    surface::surface,
    text::text,
    theme::{MaterialTheme, material_theme},
};
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

The window now shows "Milk" where the greeting was.

`name` is a plain `String`, so it is a required argument of `grocery_item`. `#[prop(into)]` lets callers pass anything that converts into a `String`, such as the `&str` literal here. Calling `grocery_item("Milk")` declares that this component appears at that point in the tree, and Tessera runs it when it builds the UI. [Thinking in Tessera](/guide/thinking-in-tessera) explains this model.

## Step 2: Arrange items in a column

A list needs several items. Move the screen into its own `grocery_screen` component, which stacks a title and a few items in a `column`:

```rust
use tessera_components::{
    column::column,
    modifier::ModifierExt as _,
    spacer::spacer,
    surface::surface,
    text::text,
    theme::{MaterialTheme, material_theme},
};
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

You now see a "Groceries" heading with three items under it, inset 16 dp from the window edges.

`column` places its children top to bottom in the order you declare them. Size and spacing come from the `Modifier` chain: the column fills the surface and pads its content, a `spacer` with a fixed height adds a gap, and each item gets some vertical padding so the rows have room between them. Sizes are written in `Dp`, which Tessera converts to pixels for the screen's density. Splitting out `grocery_screen` keeps `app` about app-wide setup, which pays off in step 6. See [Layout basics](/guide/layout) and [Modifiers](/guide/modifiers).

## Step 3: Add items with a text field

A real list starts empty and grows as you type. That needs three pieces: state that holds the items, a text field, and an action that moves the field's text into the list. Replace `src/app.rs` with this:

```rust
use tessera_components::{
    alignment::CrossAxisAlignment,
    boxed::boxed,
    button::button,
    column::column,
    modifier::ModifierExt as _,
    row::row,
    spacer::spacer,
    surface::surface,
    text::text,
    text_field::text_field,
    text_input::TextInputController,
    theme::{MaterialTheme, material_theme},
};
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
                    boxed().modifier(Modifier::new().weight(1.0)).children(move || {
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

The list now starts empty. Under the heading there is a text field with an Add button beside it. Type a name and click Add, or press Enter, and the item appears below while the field clears.

A component function runs again whenever Tessera rebuilds it, so a plain local `Vec` would start empty every time. `remember` keeps a value across rebuilds and hands you a `State` handle. Its initializer runs only once, when the state is first created. Because the column's content reads `items` while it builds, writing to `items` from the action makes that content rebuild with the new list. [State](/guide/state) covers this in detail.

The text field keeps its text in a `TextInputController`. Remembering your own controller, instead of letting the field create one, is what lets the action read the text and clear it. `Callback::new` wraps the action in a handle that stays the same across rebuilds, so the button and the field's Enter key can share it through their `_shared` setters. In the row, `weight(1.0)` hands the box all the width the button and the gap leave over, and the field fills that box.

Finally, `key(item.id, ...)` ties each row to its item's id, whatever its position in the list. That starts to matter in the next step: once items can be removed, it keeps every row attached to the right item. [Lifecycle and side effects](/guide/lifecycle) explains identity and keys, and [Text and text input](/guide/text) covers the field and its controller.

## Step 4: Check off and delete items

Next, give every item a checkbox and a delete button. The item needs a `done` flag, and `grocery_item` needs a way to report what the user did. Update the imports, the `Grocery` struct and `grocery_item`, and add two small helpers that change the list:

```rust
use tessera_components::{
    alignment::CrossAxisAlignment,
    boxed::boxed,
    button::button,
    checkbox::checkbox,
    column::column,
    icon_button::icon_button,
    material_icons::filled,
    modifier::ModifierExt as _,
    row::row,
    spacer::spacer,
    surface::surface,
    text::text,
    text_field::text_field,
    text_input::TextInputController,
    theme::{MaterialTheme, material_theme},
};
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
            checkbox()
                .checked(item.done)
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

In `grocery_screen`, the `add` action now pushes `Grocery { id, name, done: false }`. Then replace the `for` loop at the end of the column with one that passes each item its callbacks:

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

Each row now starts with a checkbox and ends with a trash-can button. Checking an item ticks its box; the trash can removes the row.

`grocery_item` receives the item to show and two callbacks, and it reports events through them; `grocery_screen` owns the list and decides what an event means. This pattern, called state hoisting, keeps a single copy of the data, so the checkbox and the list always agree. The checkbox is controlled in the same way: `checked` comes from the data, and `on_toggle` sends the new value back up to the owner of that data.

Required callback parameters such as `on_delete: Callback` accept closures directly at the call site. The closures capture `items`, which is a cheap copyable handle, and the `id`, so they own everything they use. Because the delete button shows only an icon, `accessibility_label` gives it a name that screen readers can announce. [State](/guide/state) covers hoisting, [Gestures and interaction](/guide/interaction) covers actions, and [Accessibility](/guide/accessibility) covers labelling.

## Step 5: Scroll a long list

Add a dozen items and the last ones fall off the bottom of the window, because a `column` lays out everything you give it at full length, past the window edge. Swap the `for` loop for a `lazy_column`, which scrolls and only builds the rows that are in view. Add `lazy_list::lazy_column` to the `tessera_components` import, remove `key` from the `tessera_ui` import (the list handles keys now), and replace the loop:

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

With more items than fit, the list now scrolls with the mouse wheel or touch, while the heading and text field stay in place.

A scrolling list needs a finite height to scroll within. `weight(1.0)` gives it whatever height the column has left after the heading and the input row, which works because the column itself fills the window. The second argument returns each item's key, so rows keep following their item as the list changes. A row's local state ends when the row scrolls out of view, even with a key; here the list data lives in `grocery_screen`, so every item keeps its data while you scroll. [Lists and scrolling](/guide/lists) explains viewports, keys and controllers.

## Step 6: Theme the app

The app still uses the default light theme. Give it its own color, a stronger heading and a dark-mode switch. Store the dark-mode flag in `app`, derive the theme from it, and pass the flag down to the screen:

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

`grocery_screen` takes the flag, reads the title style from the theme, and puts a toggle button next to the heading:

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
                    boxed().modifier(Modifier::new().weight(1.0)).children(move || {
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

Add `Color` and `use_context` to the `tessera_ui` import. The button, checkboxes and field now take on a green palette, the heading is larger, and the moon button at the top right switches the whole app between light and dark.

`MaterialTheme::from_seed` derives a complete color scheme from one seed color, and its second argument picks the light or dark variant. Because the theme closure reads `dark` each time it runs, flipping the flag rebuilds the theme, and every component that reads it updates. Tessera doesn't follow the operating system's dark mode on its own, so state like this is how you give the user the choice. Inside the screen, `use_context::<MaterialTheme>()` reads the nearest theme, which is how the heading picks up the theme's `headline_small` style. [Material 3 theming](/guide/theming) covers color roles, typography and shapes.

## The finished app

Here is the complete `src/app.rs` after the last step:

::: details src/app.rs
```rust
use tessera_components::{
    alignment::CrossAxisAlignment,
    boxed::boxed,
    button::button,
    checkbox::checkbox,
    column::column,
    icon_button::icon_button,
    lazy_list::lazy_column,
    material_icons::filled,
    modifier::ModifierExt as _,
    row::row,
    spacer::spacer,
    surface::surface,
    text::text,
    text_field::text_field,
    text_input::TextInputController,
    theme::{MaterialTheme, material_theme},
};
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
            checkbox()
                .checked(item.done)
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
                    boxed().modifier(Modifier::new().weight(1.0)).children(move || {
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

Before you commit, run `cargo tessera check`. It checks that components are only called where UI can be built, then compiles the project.

## Next steps

You have now used most of the ideas that a Tessera app is built from. [Thinking in Tessera](/guide/thinking-in-tessera) explains the model behind them, and [State](/guide/state) goes deeper into who owns data and when the UI rebuilds. To see what else the component library offers, browse the [component API reference](https://tessera-ui.github.io/tessera/tessera_components/) or the [running gallery](https://tessera-ui.github.io/tessera/example/).
