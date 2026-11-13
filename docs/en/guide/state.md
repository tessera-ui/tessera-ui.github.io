---
title: State and sharing
description: Store component state with remember, hoist ownership, structure screen logic with Model, and pass ambient defaults via Context.
---

# State and sharing

Component functions run again whenever the UI updates, so plain local variables do not persist across frames. Use `State`, `Model`, and `Context` to give every piece of data an explicit owner and keep the screen in sync automatically.

## Component-local state with `remember`

`remember` initializes a value once when the component first mounts and returns a lightweight, `Copy` handle (`State<T>`):

```rust
use tessera_components::{button::button, column::column, text::text};
use tessera_ui::{State, remember, tessera};

#[tessera]
fn count_label(count: State<i32>) {
    text(format!("Count: {}", count.get()));
}

#[tessera]
fn counter() {
    let count = remember(|| 0i32);
    column().children(move || {
        count_label(count);
        button()
            .on_click(move || count.with_mut(|n| *n += 1))
            .child(|| text("Increment"));
    });
}
```

Call `remember` (and `remember_with_key`, `retain`, `retain_with_key`) directly in a build context—never inside event callbacks or helpers. Stored values must be `'static` and may be `!Send` (such as `Rc`), in which case the handle stays on the UI thread.

## Reading and writing `State<T>`

| Method | Behavior |
| --- | --- |
| `get()` | Clones the value (`T: Clone`). |
| `with(f)` | Borrows `&T` for the duration of `f`. |
| `set(value)` | Replaces the value and notifies readers. |
| `with_mut(f)` | Mutates `&mut T` and notifies readers. |
| `set_if_changed(value)` | Replaces and notifies only when `value != current` (`T: PartialEq`); returns `bool`. |
| `is_alive()` | Checks whether the state slot is still valid. |

`State<T>` is `Copy`, so pass it into closures directly without `.clone()`. When `T: Send`, `State<T>` is `Send + Sync` and supports the same read/write methods from background tasks—writes synchronize cleanly at frame boundaries. Check `is_alive()` before touching a state inside cleanup code that might outlive its owner.

## Read close to the leaf

Reading a `State` during build (`get()` or `with(...)`) subscribes only that component to updates. Reading inside event callbacks does not subscribe.

Pass `State<T>` handles down and read them in the leaf component that displays the value. In the `counter` example above, `counter` holds `count` without reading it, so clicking the button rebuilds only `count_label`.

Prefer short `with(|v| ...)` borrows for large values, and use `set_if_changed` when repeated updates often yield the same result.

## Hoisting state and deriving values

When multiple components need to read or constrain the same value, lift ownership to their lowest common ancestor: pass the current value (or handle) down and accept a callback for edits.

```rust
use tessera_components::{button::button, row::row, text::text};
use tessera_ui::{CallbackWith, remember, tessera};

#[tessera]
fn stepper(value: i32, on_change: Option<CallbackWith<i32>>) {
    row().children(move || {
        button()
            .on_click(move || {
                if let Some(on_change) = on_change {
                    on_change.call(value - 1);
                }
            })
            .child(|| text("-"));
        text(value.to_string());
        button()
            .on_click(move || {
                if let Some(on_change) = on_change {
                    on_change.call(value + 1);
                }
            })
            .child(|| text("+"));
    });
}

#[tessera]
fn order_line() {
    let quantity = remember(|| 1i32);
    stepper(quantity.get()).on_change(move |value: i32| quantity.set(value.max(1)));
}
```

For ongoing editing or scrolling, pass a component controller (`TextInputController`, `ScrollableController`, `LazyListController`) rather than lifting every intermediate keystroke or pixel delta.

Compute derived values directly during build rather than mirroring them in a second `State`:

```rust
use tessera_components::text::text;
use tessera_ui::{State, tessera};

#[derive(Clone, PartialEq)]
struct Task {
    title: String,
    done: bool,
}

#[tessera]
fn remaining_label(tasks: State<Vec<Task>>) {
    let remaining = tasks.with(|tasks| tasks.iter().filter(|task| !task.done).count());
    text(format!("{remaining} left"));
}
```

## Structuring screen logic with `Model<T>`

For a screen or feature with multiple operations, internal caches, and async `Task` handles, implement `ModelInit`. Put reactive fields in `State::new(...)` inside `init()`, and keep non-UI fields (caches, request handles) as plain private fields updated through `&mut self` methods:

```rust
use tessera_components::{button::button, column::column, text::text};
use tessera_ui::{Model, ModelInit, State, key, tessera};

struct Selection {
    selected: State<Option<u64>>,
    history: Vec<u64>,
}

impl ModelInit for Selection {
    fn init() -> Self {
        Self {
            selected: State::new(None),
            history: Vec::new(),
        }
    }
}

impl Selection {
    fn select(&mut self, id: u64) {
        self.history.push(id);
        self.selected.set(Some(id));
    }
}

#[tessera]
fn contact_list(contacts: Vec<(u64, String)>, selection: Model<Selection>) {
    let selected = selection.with(|selection| selection.selected);
    column().children(move || {
        for (id, name) in &contacts {
            let id = *id;
            let marker = if selected.get() == Some(id) { "> " } else { "" };
            let label = format!("{marker}{name}");
            key(id, || {
                button()
                    .on_click(move || selection.with_mut(|selection| selection.select(id)))
                    .child(move || text(label.clone()));
            });
        }
    });
}
```

`Model<T>` is `Copy` (and `Send + Sync` when `T: Send`). Only reads of its `State` fields subscribe the UI—mutating plain fields like `history` triggers no rebuild.

When a component declares a `Model<T>` parameter:

- Omit it (`contact_list(contacts)`) to let Tessera inject it: under a `ModelStoreScope` (such as a `shard_home` route), the nearest store owns one shared instance per type; otherwise the component owns it until unmount.
- Or pass an explicit handle (`contact_list(contacts).selection(existing_model)`) to share a caller-owned model.

Always create model states with `State::new` inside `ModelInit::init` or `ModelStore::model`, and never store `remember` states inside a `Model`. For custom lifetimes outside navigation, create a `ModelStore` and provide `store.scope()` via `provide_context`.

## Ambient defaults with `Context`

Use `provide_context(value, content)` and `use_context::<T>()` to pass subtree-wide visual defaults (themes, text styles, content colors) without threading arguments through every intermediate component:

```rust
use tessera_components::{column::column, text::text, theme::ContentColor};
use tessera_ui::{Color, provide_context, tessera};

#[tessera]
fn warning_block() {
    provide_context(ContentColor { current: Color::RED }, || {
        column().children(|| {
            text("Storage almost full");
            text("Free up space to keep syncing.");
        });
    });
}
```

`use_context::<T>()` returns `Option<Context<T>>`. Reading `.get()` or `.with(...)` during build subscribes that component to future context changes.

::: warning Keep Context for visual defaults
Pass business data through component parameters and actions through callbacks. Reserve `Context` for themes and inherited visual defaults so component dependencies stay explicit.
:::

## Next steps

Read [Identity, lifecycle, and effects](/guide/lifecycle) to choose the right lifetime for each piece of state and place side effects safely.
