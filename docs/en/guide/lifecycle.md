---
title: Lifecycle and side effects
description: How Tessera matches state to components, how long state lives, and where side effects belong.
---

# Lifecycle and side effects

A component enters the tree the first time it is declared, rebuilds zero or more times while it stays, and leaves when a rebuild no longer declares it. Knowing how Tessera recognizes "the same component" across rebuilds, and how long each kind of state survives, lets you keep state where users expect it and run work with side effects exactly once.

## How Tessera identifies a component

Remembered state is associated with the component's identity, the control-flow scope it is in, and the order of calls within that scope. In practice that means the call site: the same component called from the same place in the same parent is the same instance on the next rebuild, and it gets its remembered state back.

Call order works well for fixed layouts. It breaks down for collections whose items can move. If a list is identified only by position, inserting an item at the top shifts every item one slot down while their state stays put, so the third row's expanded flag now belongs to whatever item moved into third place.

## Identify items with keys

Wrap each item in `key` with a stable business identifier, such as a record ID. An index changes whenever items move, so it identifies a position, not an item:

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

Inside the key scope, each row's `expanded` state follows its item when the list is reordered or items are inserted. Keys only need to be unique among siblings, and any `Hash` value works.

Keys select identity. If an item's key changes, Tessera treats it as a new item, and it starts from fresh state; the value under the old key stays with the old key. Lazy lists have their own item keys, which do not keep state alive for items that have scrolled out of view; see [Lists and scrolling](/guide/lists).

## Reset state when an input changes

`remember_with_key` applies the same idea to a single slot. It names the slot within the current component and scope. When the key changes, you get a fresh value from the initializer, which is the simplest way to reset local state when the data it describes changes:

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

The key ties the reveal to one contact: when the screen switches to the next contact, its phone number starts hidden again.

## How long state lives

Different kinds of state have different lifetimes. Pick the one that matches how long the value should last.

### `remember`: while the slot is in use

State from `remember` and `remember_with_key` lives as long as builds keep reaching its call. If its component rebuilds without reaching that call, for example because an `if` branch is no longer taken, or if the component leaves the tree, the slot can be released. A parent keeps its state while its children rebuild on their own.

### `retain`: until state is reset

Sometimes a value should survive while its component is gone, such as a tab that comes back the way you left it. `retain` and `retain_with_key` keep their slots even when the declaration is no longer used, including when the component leaves the tree:

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

Switching to the archive and back shows the same count, because `inbox_tab` returns with the same identity and finds its retained slot. A different identity would start from scratch. A retained slot lasts until state is reset or the UI session shuts down.

::: warning
Retained slots stay until state is reset or the session ends. Retain state under a bounded set of keys; with one key per list item, for example, the slots accumulate for the rest of the session. Use `retain` when you want the longer lifetime, and `remember` otherwise.
:::

When the renderer is suspended, for example when an Android app's window is torn down in the background, Tessera resets component state from both `remember` and `retain`. State held by a `StateOwner` survives it.

### `StateOwner`: until you close it

If state should be released together with a controller or service rather than with a component, give it a [`StateOwner`](/guide/state#give-state-an-explicit-owner). If it should follow a navigation route, use [shard state](/guide/navigation).

## Close a state owner

An owner's lifetime ends when you call `close()` on it, or when its last clone is dropped. Either way it releases all its state, and its dispatcher stops delivering results, including closures that were already queued. `close()` takes effect even while other clones still exist, which is useful when a controller is shared but its work has a clear end, like signing out.

An owner stored with `remember` is dropped when that slot is released, unless a clone lives on elsewhere, so the owner's lifetime then follows the component after all. Store it in a controller, a route or another long-lived place when you want it to outlive a particular mount.

Handles into an owner's state become stale once it closes. If cleanup code may run after some other owner has gone away, check `is_alive()` on that state, or on the owner, before touching it.

## Run side effects outside the build

A side effect is anything a component does beyond declaring UI: a network request, a file write, a log entry, starting a timer. Component bodies may run many times or be skipped, so an effect placed directly in the body runs an unpredictable number of times. Tessera gives you three places where effects behave predictably.

**Actions.** Event callbacks such as `on_click` run once per event, outside any build. This is where most effects belong: change state, call a controller, start a task.

**Initializers.** The closure you pass to `remember`, `remember_with_key` or `provide_context` runs only when its slot is created. Combined with a key, an initializer starts work once per value of the key, and the slot's lifetime decides when that work is cleaned up:

```rust
use tessera_components::text::text;
use tessera_shard::task_handles::TaskHandles;
use tessera_ui::{StateOwner, remember, remember_with_key, tessera};

async fn load_display_name(user_id: u64) -> String {
    format!("User {user_id}")
}

#[tessera]
fn display_name(user_id: u64) {
    let owner = remember(StateOwner::new);
    let (name, dispatcher) = owner.with(|owner| {
        (
            owner.state_with_key("name", || None::<String>),
            owner.dispatcher(),
        )
    });

    let _tasks = remember_with_key(user_id, move || {
        let tasks = TaskHandles::new();
        tasks.spawn(async move {
            let loaded = load_display_name(user_id).await;
            dispatcher.dispatch(move || name.set(Some(loaded)));
        });
        tasks
    });

    text(name.get().unwrap_or_else(|| String::from("Loading...")));
}
```

The request starts when `display_name` first appears and again whenever `user_id` changes. `TaskHandles` comes from `tessera-shard` (`cargo add tessera-shard`) and cancels its jobs when dropped, so when the key changes or the component leaves the tree, Tessera releases the old slot and the old request is cancelled with it. Cancellation does not recall a result that was already queued for delivery, though; when the input can change mid-request, also check that the result still matches the current request, as described in [Background tasks](/guide/tasks).

**Frame callbacks.** Animation registers with `receive_frame_nanos` from the build, and Tessera manages the subscription for that call position. The callback updates state, and the components that read that state rebuild to show it. See [Animation](/guide/animation).

::: warning
Write state from actions, and compute derived values in place during the build. A write during a build makes readers that already ran with the old value rebuild again, which costs extra work.
:::

## Clean up with ownership

Cleanup lives in `Drop`. When Tessera releases a slot, it drops the value stored there: remembered `TaskHandles` cancel their jobs, and a remembered `StateOwner` releases its state when its last clone goes. Tie each resource to the owner whose lifetime it should share, whether that is a component slot, a controller's `StateOwner` or a route, and it is cleaned up when that owner goes away.

## Next steps

Longer-running work needs more than an initializer: snapshotting inputs, delivering results safely and discarding stale ones. [Background tasks](/guide/tasks) covers that in full.
