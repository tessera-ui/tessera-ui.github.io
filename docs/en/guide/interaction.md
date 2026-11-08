---
title: Gestures and interaction
description: Respond to clicks, toggles, drags and keys, react to press and hover, and control keyboard focus.
---

# Gestures and interaction

Most of the time you respond to the user by handing a component a closure. The closure changes state or calls a controller, and the UI picks up the result the next time it rebuilds. Here a button increments a counter that the text above it reads:

```rust
use tessera_components::{button::button, column::column, text::text};
use tessera_ui::{remember, tessera};

#[tessera]
fn counter() {
    let count = remember(|| 0);
    column().children(move || {
        text(format!("Count: {}", count.get()));
        button()
            .on_click(move || count.with_mut(|value| *value += 1))
            .child(|| text("Increment"));
    });
}
```

The examples on this page run beneath the app's `material_theme()`; [Material 3 theming](/guide/theming) shows the root setup. Text entry has its own page, [Text and text input](/guide/text).

## Write actions

A component stores its action closures, so each closure has to own what it captures and satisfy `Send + Sync + 'static`. In practice that means capturing a copyable `State` handle or moving a cloned, owned value into the closure. [State](/guide/state) explains who owns state, and [Background tasks](/guide/tasks) covers work that keeps going after the action returns.

Most actions are ordinary closures. Use `Callback` or `CallbackWith` when the action needs its own storage, or has to be shared or forwarded. If you already hold such a handle, pass it straight to the matching setter, such as `on_click_shared`.

## Make custom content interactive

Start from an existing control when one already does what you need. When you want a custom appearance with standard behavior, use the semantic interaction modifiers from `tessera_components::modifier::ModifierExt`:

| Modifier | Meaning |
| --- | --- |
| `clickable` | Activate an action |
| `toggleable` | Change a boolean value |
| `selectable` | Activate an item with a selected state |
| `draggable` | Receive drag deltas in local physical pixels |

Each has a `_with` variant that takes a configuration struct. The next example uses `clickable_with` to give a custom target a name and a role, which lets it take keyboard focus as well as respond to the pointer:

```rust
use tessera_components::{
    boxed::boxed,
    modifier::{ClickableArgs, ModifierExt as _},
    text::text,
};
use tessera_ui::{Callback, Dp, Modifier, accesskit::Role, tessera};

#[tessera]
fn save_action(on_save: Callback) {
    boxed()
        .modifier(Modifier::new().padding_all(Dp(12.0)).clickable_with(
            ClickableArgs {
                label: Some("Save document".into()),
                role: Some(Role::Button),
                on_click: on_save,
                ..Default::default()
            },
        ))
        .children(|| text("Save"));
}
```

One modifier wires the same action to pointer activation, keyboard activation and the accessibility click action. The configuration also accepts `enabled`, an external `InteractionState` and a `FocusRequester`. Where you place it in the modifier chain decides the hit area: outside the padding, as here, the padding is clickable too. [Modifiers](/guide/modifiers) explains the ordering.

::: warning
Use `clickable_with` with a role, label or description for a custom control that must work from the keyboard. A bare `clickable` without any of them does not register its own focus target, so keyboard users cannot reach it.
:::

`toggleable` describes a control with an on/off value. It passes the new value to your callback, and you store it:

```rust
use tessera_components::{
    modifier::{ModifierExt as _, ToggleableArgs},
    row::row,
    text::text,
};
use tessera_ui::{CallbackWith, Dp, Modifier, accesskit::Role, remember, tessera};

#[tessera]
fn wifi_row() {
    let enabled = remember(|| false);
    row()
        .modifier(Modifier::new().padding_all(Dp(12.0)).toggleable_with(
            ToggleableArgs {
                value: enabled.get(),
                on_value_change: CallbackWith::new(move |value| enabled.set(value)),
                role: Some(Role::Switch),
                label: Some("Wi-Fi".into()),
                ..Default::default()
            },
        ))
        .children(|| text("Wi-Fi"));
}
```

Keep checked state and selection apart. `toggleable` describes a boolean control, while `selectable_with` publishes selection for ordinary selectable roles and checked state for `Role::RadioButton`. [Accessibility](/guide/accessibility) goes into names, roles and state.

`draggable` reports each movement as a `DragDelta` in local physical pixels. `DraggableArgs` adds an optional axis lock, the slop distance before a drag starts, and `on_drag_started` / `on_drag_stopped` callbacks. Scrolling containers handle their own drags; see [Lists and scrolling](/guide/lists).

## React to press, hover and focus

Sometimes the appearance should change while the user interacts, for example while a target is held down. Pass an `InteractionState` to the modifier and read it during the build. The modifier keeps it updated with hover, press, focus and drag, and the component rebuilds when it changes:

```rust
use tessera_components::{
    boxed::boxed,
    modifier::{ClickableArgs, InteractionState, ModifierExt as _},
    text::text,
};
use tessera_ui::{Callback, Dp, Modifier, accesskit::Role, remember, tessera};

#[tessera]
fn hold_to_preview() {
    let interaction = remember(InteractionState::new);
    let pressed = interaction.with(|state| state.is_pressed());
    boxed()
        .modifier(Modifier::new().padding_all(Dp(12.0)).clickable_with(
            ClickableArgs {
                label: Some("Preview".into()),
                role: Some(Role::Button),
                interaction_state: Some(interaction),
                on_click: Callback::new(|| {}),
                ..Default::default()
            },
        ))
        .children(move || text(if pressed { "Release to close" } else { "Hold to preview" }));
}
```

`is_hovered()`, `is_focused()` and `is_dragged()` work the same way. Material controls draw their own state layers and ripples from this information, so you read it mainly for custom visuals. When a target is disabled, its interaction state resets.

## Focus

Keyboard users, and anyone using assistive technology, move through your UI by focus. Controls and `clickable_with` targets join focus traversal for you; the APIs below are for moving focus from code and for custom focus targets. The focus modifiers come from the core trait `tessera_ui::FocusModifierExt`; import it alongside the component modifier trait.

### Move focus from code

Keep a `FocusRequester` stable with `remember`, bind it to a target, and call it from an action:

```rust
use tessera_components::{boxed::boxed, button::button, column::column, text::text};
use tessera_ui::{FocusModifierExt as _, FocusRequester, Modifier, remember, tessera};

#[tessera]
fn preview_panel() {
    let requester = remember(FocusRequester::new).get();
    column().children(move || {
        boxed()
            .modifier(Modifier::new().focus_requester(requester).focusable())
            .children(|| text("Preview"));
        button()
            .on_click(move || requester.request_focus())
            .child(|| text("Focus preview"));
    });
}
```

`focusable()` registers a focus target and nothing more. A real custom control adds its own action and the semantics that describe it to assistive technology. An attached target hidden by layout rejects a direct request. Request focus from an action or in response to a specific change; requesting it on every rebuild overrides wherever the user has navigated.

### Show focus

The same requester tells you about the target's focus. `is_focused()` reports primary focus and `has_focus()` also counts the active focus path. To draw a keyboard focus indicator, read `is_focus_visible()` during the build. Keyboard input and accessibility focus actions show the indicator, a pointer press hides it without releasing focus, and programmatic focus follows the most recent input mode. The ring therefore appears for keyboard users and stays hidden during mouse and touch use:

```rust
use tessera_components::{
    boxed::boxed,
    modifier::{ClickableArgs, ModifierExt as _},
    text::text,
    theme::MaterialTheme,
};
use tessera_ui::{
    Callback, Color, Dp, FocusRequester, Modifier, accesskit::Role, remember, tessera,
    use_context,
};

#[tessera]
fn open_tile(on_open: Callback) {
    let scheme = use_context::<MaterialTheme>()
        .expect("open_tile requires material_theme")
        .get()
        .color_scheme;
    let requester = remember(FocusRequester::new).get();
    let ring = if requester.is_focus_visible() {
        scheme.secondary
    } else {
        Color::TRANSPARENT
    };
    boxed()
        .modifier(
            Modifier::new()
                .border(Dp(2.0), ring)
                .padding_all(Dp(12.0))
                .clickable_with(ClickableArgs {
                    label: Some("Open".into()),
                    role: Some(Role::Button),
                    focus_requester: Some(requester),
                    on_click: on_open,
                    ..Default::default()
                }),
        )
        .children(|| text("Open"));
}
```

To run code when focus changes, attach `on_focus_changed`, which receives a `FocusState`. `capture_focus()` holds focus on a target until you call `free_focus()`, it is force-cleared, hidden by layout or removed.

### Traversal, groups and restoration

For traversal, call `FocusManager::current().request_move_focus(direction)`. It queues the move until after layout, which lets it reveal lazy content. Its boolean result tells you the request was accepted; the destination receives focus when the queued move runs. `move_focus(direction)` tries to traverse immediately.

`focus_group()` establishes a traversal group, and `focus_restorer(...)` creates a scope that remembers its last focused descendant. Overlays and navigation should choose their initial target and their restoration target on purpose, so that focus lands somewhere sensible when a dialog opens and returns when it closes.

## Keyboard input

Most keyboard behavior comes with the controls. Focused controls and `clickable_with` targets respond to keyboard activation, focus traversal handles moving between them, and text fields take care of typing. A `surface()` with `on_long_click` also offers that action through the context-menu key and Shift+F10.

For shortcuts or a custom control with its own keys, implement `KeyboardInputModifierNode` and attach it as described in the next section. `KeyboardInput` carries the pending `KeyboardEvent` samples and the modifier state at the time of the event. Consume only the keys your control handles, so that unrelated keys still reach other handlers.

## Raw input extensions

Raw input handlers are for custom controls and input integrations; ordinary button actions use the closures described above. To add one, implement the dedicated node trait and attach it through `tessera_ui::modifier::ModifierCapabilityExt`:

| Node trait from `tessera_ui` | Attachment method | Payload |
| --- | --- | --- |
| `PointerInputModifierNode` | `push_pointer_input` | `PointerInput` |
| `KeyboardInputModifierNode` | `push_keyboard_input` | `KeyboardInput` |
| `ImeInputModifierNode` | `push_ime_input` | `ImeInput` |
| `ClipboardInputModifierNode` | `push_clipboard_input` | `ClipboardInput` |

Each trait has a matching `on_..._input` method and requires `Send + Sync + 'static`. The capability trait also provides preview hooks for pointer, keyboard and IME input, plus a final pointer hook. These are low-level building blocks for writing higher-level modifier extensions; [Custom layout](/guide/custom-layout) shows how such extensions are put together.

A pointer handler should preserve `PointerChange::pointer_id`, each sample's position and its consumption state, so every sample in a batch keeps the position it was recorded at. `PointerInput::local_delta` converts a window-space displacement into local units. Consume only the events your control handles, so scrolling and unrelated keys still reach other handlers.

The [core API reference](https://tessera-ui.github.io/tessera/tessera_ui/) documents the extension contracts.
