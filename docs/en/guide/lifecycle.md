---
title: Identity, lifecycle, and effects
description: Keep state matched to dynamic items with key, choose the right state lifetime, and place side effects safely.
---

# Identity, lifecycle, and effects

A component enters the tree when first declared, updates while it stays mounted, and drops its resources when a parent stops declaring it. Matching identity explicitly and placing side effects in the right hooks keeps state aligned with data and prevents duplicate work.

## Positional identity and `key`

By default, Tessera matches remembered state by component type, enclosing control-flow branch, and call order. In fixed layouts that works automatically, but in dynamic lists where items shift, insert, or reorder, positional matching attaches old UI state to the wrong item.

Wrap dynamic list items in `key(...)` using a stable business identifier (never a loop index):

```rust
use tessera_components::{button::button, column::column, text::text};
use tessera_ui::{key, remember, tessera};

#[derive(Clone, PartialEq)]
struct Item {
    id: u64,
    title: String,
}

#[tessera]
fn item_row(item: Item) {
    let expanded = remember(|| false);
    button()
        .on_click(move || expanded.with_mut(|value| *value = !*value))
        .child(move || {
            let mark = if expanded.get() { "v" } else { ">" };
            text(format!("{mark} {}", item.title));
        });
}

#[tessera]
fn item_list(items: Vec<Item>) {
    column().children(move || {
        for item in &items {
            key(item.id, || {
                item_row(item.clone());
            });
        }
    });
}
```

Each `expanded` flag now follows its `item.id` across insertions and reorders. Keys only need to be unique among siblings in the same group and can be any `Hash` type. (Lazy lists provide dedicated keyed methods; see [Lists, grids, and scrolling](/guide/lists).)

## Resetting state with `remember_with_key`

Use `remember_with_key(key, init)` when a single local state should reset whenever an input changes:

```rust
use tessera_components::{button::button, column::column, text::text};
use tessera_ui::{remember_with_key, tessera};

#[tessera]
fn contact_details(contact_id: u64, #[prop(into)] phone: String) {
    let show_phone = remember_with_key(contact_id, || false);
    column().children(move || {
        if show_phone.get() {
            text(phone.clone());
        }
        button()
            .on_click(move || show_phone.set(true))
            .child(|| text("Show phone number"));
    });
}
```

Switching `contact_id` automatically re-initializes `show_phone` to `false`.

## Choosing state lifetime

Pick the mechanism that matches how long the data should live:

- **`remember` / `remember_with_key`**: lives while the component is mounted and builds keep reaching that branch. When an `if` branch hides it or the component unmounts, the state is released.
- **`retain` / `retain_with_key`**: survives conditional branches (such as switching tabs) until the owning component unmounts or the session resets. Keep retained keys to a small, bounded set—never per item in an unbounded list.
- **`Model`**: lives as long as its owning `ModelStore` (under `shard_home`, a route keeps its models while covered and closes them when popped or replaced), or the component when used standalone.

```rust
use tessera_components::{button::button, text::text};
use tessera_ui::{retain, tessera};

#[tessera]
fn inbox_tab() {
    let opened = retain(|| 0u32);
    button()
        .on_click(move || opened.with_mut(|n| *n += 1))
        .child(move || text(format!("Opened {} messages", opened.get())));
}

#[tessera]
fn archive_tab() {
    text("Archive");
}

#[tessera]
fn tab_body(selected: usize) {
    if selected == 0 {
        inbox_tab();
    } else {
        archive_tab();
    }
}
```

## Where side effects belong

Never perform network I/O, disk writes, or timers directly in a component body—bodies may execute on every rebuild or be skipped. Place side effects in one of these hooks:

1. **Event callbacks** (`on_click`, `on_change`, etc.): execute once per user action; ideal for mutating state, calling controllers, or starting work with `spawn`.
2. **Slot initializers** (`remember`, `remember_with_key`, `provide_context`): execute once when creating the slot.
3. **Keyed UI tasks (`launch` / `launch_once`)**: safe to call directly inside a component body. `launch(key, future)` starts `future` once, keeps it alive while `key` stays equal, cancels and restarts it when `key` changes, and cancels it automatically when the component unmounts:

```rust
use tessera_components::text::text;
use tessera_ui::{Dispatcher, launch, on, remember, tessera};

async fn load_display_name(user_id: u64) -> String {
    format!("User {user_id}")
}

#[tessera]
fn display_name(user_id: u64) {
    let name = remember(|| None::<String>);

    launch(user_id, async move {
        let loaded = on(Dispatcher::Io, load_display_name(user_id)).await;
        name.set(Some(loaded));
    });

    text(name.get().unwrap_or_else(|| String::from("Loading...")));
}
```

4. **Ownership & `Drop`**: store `Task` handles or resource guards inside `State` or `Model` fields so cleanup runs automatically when the owner closes. Check `is_alive()` if a `Drop` hook accesses another `State` that may already have closed.

::: warning Keep builds read-only for state
Compute derived values during build, and write state only in callbacks or async tasks.
:::

## Next steps

Continue to [Layout basics](/guide/layout) to start building screens with containers, constraints, and window insets.
