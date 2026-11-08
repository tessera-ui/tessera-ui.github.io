---
title: State
description: Keep values across rebuilds, decide who owns them, and share them with the components that need them.
---

# State

A component function runs again every time Tessera rebuilds it, so its local variables only last for one run. State is how a value outlives a rebuild, and how changing that value tells Tessera which parts of the interface to update.

## Remember a value across rebuilds

Store a value with `remember` to keep it between rebuilds. You get back a `State<T>` handle, which is cheap to copy and pass around. The counter below keeps its count in remembered state and hands the handle to a child that displays it:

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

Use this component beneath the Material theme your app sets up. The initializer `|| 0i32` runs once, when the state slot is first created; later rebuilds return the existing value without calling it again.

`remember` finds its slot by where it is called during the build, so call it while a component or a recognized build closure is building. Actions and background tasks run outside the build, where there is no slot to find. The same applies to `remember_with_key`, `retain` and `retain_with_key`. The stored value must be `Send + Sync + 'static`.

A `State<T>` handle is only a reference. The slot behind it lives on its own schedule, however many copies of the handle exist; how long a slot lives is covered in [Lifecycle and side effects](/guide/lifecycle).

## Read and write

| Method | Behavior |
| --- | --- |
| `get()` | Clones the value; requires `Clone` |
| `with(f)` | Borrows the value for a short read |
| `set(value)` | Replaces the value and invalidates readers |
| `with_mut(f)` | Mutates the value and invalidates readers |
| `set_if_changed(value)` | Replaces and invalidates only if the value differs, returning whether it did; requires `PartialEq` |
| `is_alive()` | Checks whether the handle still refers to live state in this session |

When the value meets these bounds, `State<T>` is `Copy + Send + Sync`, so you can move handles into closures freely. Reads and writes still happen in the UI session that owns the state. Accessing a stale handle, or one from another session, panics; call `is_alive()` first if you need to check, and it returns `false` for those handles. Work on a worker thread sends its results back through a [dispatcher](/guide/tasks), and the state is written there, in the UI session.

## What triggers a rebuild

When a component reads state during its build, Tessera records that the component depends on it. A later write invalidates those readers, and they rebuild; the rest of the app is left alone. Reads inside an event callback happen outside any build, so they create no dependency.

That is why you should read state close to where it is shown. In the counter, `count_label` reads `count` and the parent only passes the handle along. When the count changes, only the label rebuilds; the column around it keeps its previous result.

For a large model, borrow it with `with` and read what you need in place. Keep those borrows short, and let a `with_mut` finish before you access the same state again. Also note that `set` and `with_mut` always publish a write, even when the new value equals the old one. For values that often come out the same, use `set_if_changed`, which wakes readers only when the value actually changes.

## Hoist state to the caller

A component that keeps its own state is convenient, and that state stays private to it. When a parent needs to read or control it, move the state up and make the child *stateless*: it takes the current value as a prop and reports changes through a callback. This is called state hoisting.

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

`stepper` now has a single source of truth, owned by `order_line`, which also gets to enforce the rule that the quantity never drops below one. The stepper is easier to reuse and to test because the same props always produce the same output.

Hoist state to the lowest common owner of every component that reads or writes it. When several components need the same state, keep it in their nearest common ancestor and pass it down.

You can pass either the value or the `State<T>` handle. Passing a value, as above, keeps the child independent of where the data lives. Passing the handle, as in the counter, lets the child read it itself, so only the child rebuilds when it changes. Both are fine; prefer the handle when the parent has no other use for the value and you want the rebuild to stay small.

For editing, scrolling and similar ongoing interaction, use the component's controller. A controller owns ongoing commands and interaction state across builds, while a configuration handle describes a single build.

## Derive values instead of syncing them

If a value can be computed from state you already have, compute it where you use it, so there is one source for it. A derived copy of text or geometry kept in a second mutable state has to be synced by hand, and the two can drift apart.

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

Because `remaining_label` reads `tasks` during its build, it rebuilds whenever the list changes and the count is always current.

## Provide inherited defaults with context

Some values apply to a whole subtree rather than to one component: the theme, the current text style, the color for content on a surface. Context lets an ancestor provide such a value once, and any descendant can read it, much like `CompositionLocal` in Jetpack Compose.

`provide_context(init, content)` makes a value available while `content` builds. Here every `text` inside the block picks up a red content color from the context:

```rust
use tessera_components::{column::column, text::text, theme::ContentColor};
use tessera_ui::{Color, provide_context, tessera};

#[tessera]
fn warning_block() {
    provide_context(
        || ContentColor { current: Color::RED },
        || {
            column().children(|| {
                text("Storage almost full");
                text("Free up space to keep syncing.");
            });
        },
    );
}
```

On the reading side, `use_context::<T>()` returns the nearest `Context<T>`, or `None` if no ancestor provided one. Read it through its `with` method; a read during a build subscribes the reader, just like state. [Theming](/guide/theming) shows how to read `MaterialTheme` this way.

Both functions need a build context. Like `remember`, the provider's initializer runs once, when its context slot is created, and later rebuilds keep the value it produced.

::: warning
Use context for themes and inherited visual defaults. Pass data and controllers through props, and report actions through callbacks. A component that pulls its data from context hides that dependency from its signature, which makes it harder to reuse and to reason about.
:::

## Give state an explicit owner

Remembered state belongs to the place where a component is mounted. A controller or service often needs a lifetime of its own instead, and `StateOwner` provides one. You create an owner inside an active UI session and ask it for keyed state:

```rust
let owner = tessera_ui::StateOwner::new();
let selected = owner.state_with_key("selected", || None::<u64>);
let dispatcher = owner.dispatcher();
```

State from an owner behaves like remembered state for reads, writes and rebuilds; only its lifetime differs. The owner's `dispatcher()` delivers background results into that lifetime, as the [Background tasks](/guide/tasks) guide shows.

A typical use is a small controller that bundles the owner with its state and exposes methods. Store the controller once, here with `remember`, and pass clones to whoever needs it:

```rust
use tessera_components::{button::button, column::column, text::text};
use tessera_ui::{State, StateOwner, key, remember, tessera};

#[derive(Clone, PartialEq)]
pub struct SelectionController {
    owner: StateOwner,
    selected: State<Option<u64>>,
}

impl SelectionController {
    pub fn new() -> Self {
        let owner = StateOwner::new();
        let selected = owner.state_with_key("selected", || None);
        Self { owner, selected }
    }

    pub fn selected(&self) -> Option<u64> {
        self.selected.get()
    }

    pub fn select(&self, id: u64) {
        self.selected.set(Some(id));
    }
}

#[tessera]
fn contact_list(contacts: Vec<(u64, String)>) {
    let controller = remember(SelectionController::new).get();
    column().children(move || {
        for (id, name) in &contacts {
            let id = *id;
            let marker = if controller.selected() == Some(id) { "> " } else { "" };
            let label = format!("{marker}{name}");
            let controller = controller.clone();
            key(id, || {
                button()
                    .on_click(move || controller.select(id))
                    .child(move || text(label.clone()));
            });
        }
    });
}
```

Create the owner once and keep it with the controller; creating a new one on every build would throw the state away each time. Clones of an owner share one lifetime, and `StateOwner` compares by identity, so a controller holding one can be a prop. When and how an owner releases its state is described in [Lifecycle and side effects](/guide/lifecycle#close-a-state-owner).

## Next steps

State lives in slots with lifetimes of their own. [Lifecycle and side effects](/guide/lifecycle) explains how Tessera matches state to components, when it releases it, and where work with side effects belongs.
