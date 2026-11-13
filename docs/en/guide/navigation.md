---
title: Navigation
description: Manage a screen stack with tessera-shard, keep route-scoped models alive across pushes, and handle system back.
---

# Navigation

`tessera-shard` manages a stack of route destinations and renders whichever destination sits on top inside `shard_home`.

Add the crate to your project first:

```sh
cargo add tessera-shard
```

Here is a minimal two-screen flow using `#[shard]` and `use_router()`:

```rust
use tessera_components::{
    button::button,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_shard::{RouterController, shard, shard_home, use_router};
use tessera_ui::tessera;

#[shard]
fn home() {
    let router = use_router();
    button()
        .on_click(move || {
            router.with_mut(|router| router.push(DetailDestination { id: 42 }));
        })
        .child(|| text("Open note"));
}

#[shard]
fn detail(id: u64) {
    let router = use_router();
    button()
        .on_click(move || {
            router.with_mut(RouterController::pop);
        })
        .child(move || text(format!("Note {id}: go back")));
}

#[tessera]
pub fn app() {
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(|| {
            shard_home().root(HomeDestination {});
        });
}
```

## Defining destinations

`#[shard]` turns a free function into a component and generates a `<FnName>Destination` struct (`detail` generates `DetailDestination`, `note_editor` generates `NoteEditorDestination`) with matching visibility.

- Every parameter becomes a public field on the destination struct, **except** `Model<T>` parameters (which are injected per route).
- Argument types must be owned and satisfy `Clone + PartialEq + 'static`. Pass lightweight IDs in destinations and look up full records inside the screen or its model.
- `#[shard]` already establishes the component boundary; do not stack `#[tessera]` on the same function.

Call `use_router()` during build inside any component rendered beneath `shard_home` to obtain `State<RouterController>`, then capture that handle in callbacks.

## Managing the router controller

`shard_home().root(HomeDestination {})` manages an internal `RouterController`. When the outer shell (such as a navigation bar or drawer) also needs to inspect or drive the stack, remember a `RouterController` yourself and pass `.controller(router)`:

```rust
use tessera_components::{
    boxed::boxed,
    column::column,
    navigation_bar::{navigation_bar, navigation_bar_item},
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_shard::{RouterController, shard, shard_home};
use tessera_ui::{Modifier, remember, tessera};

#[shard]
fn inbox() {
    text("Inbox");
}

#[shard]
fn settings() {
    text("Settings");
}

#[tessera]
pub fn app() {
    let router = remember(|| RouterController::with_root(InboxDestination {}));
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(move || {
            column()
                .modifier(Modifier::new().fill_max_size())
                .children(move || {
                    boxed()
                        .modifier(Modifier::new().weight(1.0))
                        .children(move || {
                            shard_home().controller(router);
                        });
                    navigation_bar().content(move |position| {
                        navigation_bar_item()
                            .icon_position(position)
                            .label("Inbox")
                            .selected(router.with(|r| r.current_is::<InboxDestination>()))
                            .on_click(move || router.with_mut(|r| r.reset(InboxDestination {})));
                        navigation_bar_item()
                            .icon_position(position)
                            .label("Settings")
                            .selected(router.with(|r| r.current_is::<SettingsDestination>()))
                            .on_click(move || router.with_mut(|r| r.reset(SettingsDestination {})));
                    });
                });
        });
}
```

Keep the stack non-empty while `shard_home` is mounted. Stack operations on `RouterController`:

| Method | Effect |
| --- | --- |
| `push(destination)` | Push a new route instance on top |
| `pop()` | Pop the top route and close its models (`None` if empty) |
| `replace(destination)` | Replace the current route and close its models |
| `reset(destination)` | Clear all routes and install a new root |
| `clear()` | Clear all routes |

Inspect the stack with `len()`, `is_empty()`, `last()`, and `current_is::<D>()`. For custom back buttons, guard `pop()` with `len() > 1` so you do not pop the root screen.

## Route-scoped state with `Model<T>`

Because covered routes are not mounted in the UI tree, component-local `remember` state resets when another route pushes on top. To keep screen state across navigation pushes, inject a `Model<T>`:

```rust
use tessera_components::{button::button, text::text};
use tessera_shard::shard;
use tessera_ui::{Model, ModelInit, State};

struct EditorModel {
    edits: State<usize>,
}

impl ModelInit for EditorModel {
    fn init() -> Self {
        Self {
            edits: State::new(0),
        }
    }
}

#[shard]
fn editor(model: Model<EditorModel>) {
    let edits = model.with(|model| model.edits);
    button()
        .on_click(move || edits.with_mut(|value| *value += 1))
        .child(move || text(format!("Edits: {}", edits.get())));
}
```

Each route instance owns its own model store:

- Models are created on first render and kept alive while covered by later routes.
- All components below that route requesting `Model<EditorModel>` share the same instance.
- Popping, replacing, or resetting the route closes its models and cancels any `Task` handles stored inside them.
- Pushing the same destination twice creates two independent route instances with separate models.

For state that must survive `reset` across top-level tabs, own a `Model` (or `State`) above `shard_home` in the app shell and pass handles into destinations.

## Route tasks

`launch` tasks inside a `#[shard]` function stop when another route covers the page and restart when returning. Check your route model before fetching again so completed loads do not repeat:

```rust
use tessera_components::text::text;
use tessera_shard::shard;
use tessera_ui::{Dispatcher, Model, ModelInit, State, launch, on};

async fn load_note(id: u64) -> String {
    format!("Note {id}")
}

struct NoteModel {
    body: State<Option<String>>,
}

impl ModelInit for NoteModel {
    fn init() -> Self {
        Self {
            body: State::new(None),
        }
    }
}

#[shard]
fn note(id: u64, model: Model<NoteModel>) {
    let body = model.with(|model| model.body);
    launch(id, async move {
        if body.with(Option::is_some) {
            return;
        }
        let loaded = on(Dispatcher::Io, load_note(id)).await;
        body.set(Some(loaded));
    });
    text(body.get().unwrap_or_else(|| String::from("Loading...")));
}
```

For work that should keep running while the page is covered (such as an upload), start it with `spawn` and store its `Task` inside the route's model.

## System back navigation

`shard_home` integrates with Android's predictive back gesture automatically: swiping previews the previous route, cancelling restores the current one, and committing pops the route (stopping at the root destination).

For custom overlays or back interception, mount `tessera_ui::system_back::system_back_handler(enabled, on_back)`. Preview `SystemBackEvent::Started`, `Progress`, and `Cancelled` visually, and commit navigation changes only on `SystemBackEvent::Committed`.
