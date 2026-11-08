---
title: Navigation
description: Move between screens with a destination stack, keep per-screen state, and handle Android back.
---

# Navigation

Most apps have more than one screen, and users expect to go forward into detail and come back to where they were. `tessera-shard` gives a part of your UI a stack of destinations for this. A destination is a value that describes a screen and its arguments, and `shard_home` renders whichever destination is on top of the stack.

Add the crate to your app first:

```sh
cargo add tessera-shard
```

The root component below opens a detail screen and lets you go back. It plugs into the `EntryPoint` and `ComponentsPackage` registration your app already has:

```rust
use tessera_components::{
    button::button,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_shard::{RouterController, shard, shard_home};
use tessera_ui::{State, tessera};

#[shard]
fn home(#[router] router: State<RouterController>) {
    button().on_click(move || {
        router.with_mut(|router| router.push(DetailDestination { id: 42 }));
    }).child(|| { text("Open note"); });
}

#[shard]
fn detail(#[router] router: State<RouterController>, id: u64) {
    button().on_click(move || {
        router.with_mut(RouterController::pop);
    }).child(move || { text(format!("Note {id}: go back")); });
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

## Declare destinations

`#[shard]` turns a free function into a component and generates a destination type for it. The name follows the function: `detail` generates `DetailDestination`, and `note_editor` generates `NoteEditorDestination`. The destination type has the same visibility as the function.

Each function parameter becomes a public field on the destination, with one exception: the parameter marked `#[router]`. That parameter receives the `State<RouterController>` supplied by `shard_home`, so you construct a destination from the other parameters only. At most one parameter can carry `#[router]`, and its type must be `State<RouterController>`.

Because a destination sits in the router's stack long after the code that created it has returned, its arguments must be owned values. Generated destinations implement `Clone` and `PartialEq` and have to meet the router's `Send + Sync + 'static` requirements. In practice, pass the ID of a record, and let the screen look the record up. An `Option<T>` parameter is still a field like any other, so write `None` when there is no value.

`#[shard]` creates the component boundary itself, so it is the only attribute the function needs. To show a shard, navigate to its generated destination; `shard_home` calls the function when that destination is on top.

## Own the router

`shard_home().root(HomeDestination {})` creates and remembers an internal controller. The root you pass is the initial destination only; when the component rebuilds, the stack keeps the navigation that has happened since.

When your app shell also needs to read or change the stack, remember a controller yourself and pass it in. This version replaces `app` from the first example:

```rust
use tessera_ui::remember;

#[tessera]
pub fn app() {
    let router = remember(|| RouterController::with_root(HomeDestination {}));
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(move || {
            shard_home().controller(router);
        });
}
```

An external controller brings its own initial stack, and `shard_home` uses that stack as it is, ignoring `.root(...)`. Keep that stack nonempty for as long as `shard_home` is mounted. If you supply neither a root nor an external controller, `shard_home` reports an error.

Remembering the controller ties it to the lifetime of the shell component. Separate controllers keep separate stacks and separate shard state. [State](/guide/state) explains how remembered state is owned.

## Change the stack

Read the controller with `router.with(...)` and change it with `router.with_mut(...)`, usually from an input callback. These methods change the stack:

| Method | Effect |
| --- | --- |
| `push(destination)` | Adds a new route instance above the current destination. |
| `pop()` | Removes the current route and returns its destination, or `None` for an empty stack. |
| `replace(destination)` | Removes the current route and pushes a new one; pushes if the stack is empty. |
| `reset(destination)` | Removes all routes and installs a new root. |

Pick the method by what the user should be able to return to. Use `push` when they should come back to the previous screen, `replace` when the current step should disappear from history, and `reset` when none of the old history should be reachable, such as after signing out.

To inspect the stack, use `len`, `is_empty`, `last` and `current_is::<D>()`. Android's built-in back handling stops at the root. A direct `pop()` call removes whatever is on top, the root included, so a custom back button should pop only when `len() > 1`.

## Switch between top-level destinations

Apps with a few top-level sections usually show them in a navigation bar, rail or drawer, and each switch should start a fresh history. The shell below owns the controller, renders the current destination above a [navigation bar](https://tessera-ui.github.io/tessera/tessera_components/navigation_bar/index.html), and resets the stack when the user picks a section:

```rust
use tessera_components::{
    boxed::boxed,
    column::column,
    modifier::ModifierExt as _,
    navigation_bar::{navigation_bar, navigation_bar_item},
    text::text,
    theme::{MaterialTheme, material_theme},
};
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

The bar reads the router while it builds, so it rebuilds and moves its selection whenever the stack changes. Inside a section, screens can still `push` details as usual. Because `reset` releases the routes it removes, any route-owned state in the old section is gone when the user comes back; use controller-scoped state, described next, for sections that should keep theirs.

## Keep screen state

When the user opens another screen on top of an editor and comes back, they expect the editor to look the way they left it. `#[shard(state = T)]` gives a shard state for this. It lazily creates a `T` and makes it available inside the function as `state: ShardState<T>`. The macro provides `state`, so the parameter list holds only the destination's arguments. `T` must implement `Default + Send + Sync + 'static`.

This additional destination keeps its counter while another route sits above it:

```rust
#[derive(Default)]
struct EditorState {
    edits: usize,
}

#[shard(state = EditorState)]
fn editor() {
    let edits = state.with(|value| value.edits);
    button().on_click(move || {
        state.with_mut(|value| value.edits += 1);
    }).child(move || { text(format!("Edits: {edits}")); });
}
```

`EditorDestination {}` has no arguments. Even so, pushing it twice creates two route instances, each with its own state, although the two destination values are equal.

The `lifecycle` option decides who owns the state:

| Declaration | State owner |
| --- | --- |
| `#[shard(state = EditorState)]` | One route instance; equivalent to `lifecycle = shard`. |
| `#[shard(state = EditorState, lifecycle = scope)]` | The router controller; shared by occurrences of this shard in that controller. |

Route-owned state lives as long as its route stays in the stack and is released when the route is popped, replaced or cleared. Scope-owned state survives every stack change, including `reset`, and ends with its controller. `lifecycle` requires `state`; writing it alone is an error. The two choices correspond to `ShardStateLifeCycle::Shard` and `ShardStateLifeCycle::Scope`.

Ordinary `remember` state belongs to the mounted component, so it ends when a screen leaves the visible tree. Keep data that has to outlive that in shard state or in another explicit owner.

`ShardState` supports `with`, `with_mut`, `get` and `set`. Copying the handle does not extend its owner's lifetime. If the route or controller may already be gone, use `try_with` and `try_with_mut`, which report that case as a result. To deliver results from background work into shard state, go through the owning UI session as described in [Background tasks](/guide/tasks).

## Android back navigation

`shard_home` hooks into Android system back through the generated host, so back navigation works as soon as `shard_home` is mounted. With more than one route, a predictive back swipe previews the previous destination while the current one stays in the stack. If the user cancels, the current screen comes back; if they commit, one route is popped. At the root, Android handles back as usual.

For a custom destination or an overlay, use `tessera_ui::system_back::system_back_handler`. Keep the handler mounted consistently, and enable it only while there is actually a back action to perform. Android sends back to the most recently mounted enabled handler, and a predictive gesture stays with the handler it started with.

Treat `SystemBackEvent::Started`, `Progress` and `Cancelled` as changes to the preview, and change navigation only on `Committed`. That way a cancelled swipe keeps the current screen. A back button can send `Committed` directly, with no preview events before it. See [Platforms](/guide/platforms) for the Android host and [Gestures and interaction](/guide/interaction) for other app actions.

The [tessera-shard API reference](https://tessera-ui.github.io/tessera/tessera_shard/) documents the destination and state APIs in full.
