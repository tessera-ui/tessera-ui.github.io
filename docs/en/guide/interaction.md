---
title: Gestures, input, and focus
description: Handle clicks, toggles, selection, dragging, focus traversal, and raw pointer/keyboard/IME input.
---

# Gestures, input, and focus

User interactions flow through action closures that update state or call controllers; the next rebuild reflects the updated UI.

Examples on this page run beneath `material_theme()` with `ComponentsPackage` registered at startup. For text editing, see [Text and text input](/guide/text).

## Action closures and callbacks

Standard controls accept action closures directly (such as `button().on_click(...)`). Captures must be owned and `'static`; because actions run on the UI thread, captures do not need `Send + Sync`. Capture `State<T>` handles directly and read current values when the action runs.

Create `Callback` or `CallbackWith` handles only when storing, reusing, or forwarding an action across multiple setters (via the generated `*_shared` setter).

## Interactive modifiers for custom UI

When an existing Material control fits your task, prefer it. When building a custom visual surface with standard interaction behavior, attach modifiers from `tessera_components::modifier::ModifierExt` (configured with structs from `tessera_foundation::modifier`):

| Modifier | Behavior |
| --- | --- |
| `clickable(ClickableArgs)` | Pointer/keyboard click, ripple, and click semantics |
| `toggleable(ToggleableArgs)` | Boolean toggle (`on_value_change`) with toggled semantics |
| `selectable(SelectableArgs)` | Selection item (`selected` + `on_click`) |
| `draggable(DraggableArgs)` | Drag deltas in local physical pixels (`tessera_foundation::modifier::ModifierExt`) |

Give custom clickable elements an accessibility `role` and `label` (or `description`) so they register as keyboard focus targets and expose click actions to assistive technology:

```rust
use tessera_components::{
    boxed::boxed,
    modifier::ModifierExt as _,
    text::text,
};
use tessera_foundation::modifier::{ClickableArgs, ModifierExt as _};
use tessera_ui::{Callback, Dp, Modifier, accesskit::Role, tessera};

#[tessera]
fn save_action(on_save: Callback) {
    boxed()
        .modifier(Modifier::new().padding_all(Dp(12.0)).clickable(
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

Here is a custom toggleable row:

```rust
use tessera_components::{modifier::ModifierExt as _, row::row, text::text};
use tessera_foundation::modifier::{ModifierExt as _, ToggleableArgs};
use tessera_ui::{CallbackWith, Dp, Modifier, accesskit::Role, remember, tessera};

#[tessera]
fn wifi_row() {
    let enabled = remember(|| false);
    row()
        .modifier(Modifier::new().padding_all(Dp(12.0)).toggleable(
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

Keep checked and selected semantics distinct: `toggleable` publishes toggled state for boolean controls, while `selectable` publishes selected state (or toggled state when `role` is `Role::RadioButton`).

## Visual feedback with `InteractionState`

Pass a remembered `State<InteractionState>` to interactive modifiers when custom visuals need to react to hover, press, focus, or drag:

```rust
use tessera_components::{boxed::boxed, modifier::ModifierExt as _, text::text};
use tessera_foundation::modifier::{ClickableArgs, InteractionState, ModifierExt as _};
use tessera_ui::{Callback, Dp, Modifier, accesskit::Role, remember, tessera};

#[tessera]
fn hold_to_preview() {
    let interaction = remember(InteractionState::new);
    let pressed = interaction.with(|state| state.is_pressed());
    boxed()
        .modifier(Modifier::new().padding_all(Dp(12.0)).clickable(
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

`is_hovered()`, `is_focused()`, and `is_dragged()` work the same way.

## Focus management

Import focus modifiers from `tessera_ui::modifier::FocusModifierExt`.

### Requesting and observing focus

Bind a remembered `FocusRequester` to a focusable node and call `.request_focus()` from an action (never unconditionally during build, or you override user navigation):

```rust
use tessera_components::{boxed::boxed, button::button, column::column, text::text};
use tessera_ui::{FocusRequester, Modifier, modifier::FocusModifierExt as _, remember, tessera};

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

To draw a keyboard-only focus ring, read `requester.is_focus_visible()` during build: keyboard navigation and accessibility focus actions show it, pointer presses hide it without releasing focus, and programmatic focus inherits the latest input mode.

Use `.on_focus_changed(|state: FocusState| ...)` to observe focus transitions, and `capture_focus()` / `free_focus()` when a control needs to lock focus temporarily (for instance, during modal editing).

### Traversal, groups, and restoration

- **Traversal**: use `tessera_ui::focus::request_move_focus(direction)` when moving focus may need to scroll or reveal lazy items after layout; use `tessera_ui::focus::move_focus(direction)` for immediate traversal among already-laid-out targets.
- **Groups and scopes**: attach `.focus_group(None)` with `.focus_traversal_policy(FocusTraversalPolicy::horizontal().single_tab_stop(true))` for composite controls like toolbars, and use `.focus_scope(None)` / `.focus_restorer(None, fallback)` for containers that restore the last focused descendant.
- **Overlays**: call `tessera_ui::focus::save_focus()` before opening a dialog or popup, and restore the saved `FocusRestorationTarget` when closing while the overlay still holds focus. Call `tessera_ui::focus::defer_keyboard_until_layout()` when opening or closing focusable overlays so queued keys reach the new target cleanly.

## Raw input extensions

When building custom input controls, implement node traits and attach them via `tessera_ui::modifier::ModifierCapabilityExt`:

| Trait | Attachment method | Context |
| --- | --- | --- |
| `PointerInputModifierNode` | `push_pointer_input` | `PointerInput` |
| `KeyboardInputModifierNode` | `push_keyboard_input` | `KeyboardInput` |
| `ImeInputModifierNode` | `push_ime_input` | `ImeInput` |
| `ClipboardInputModifierNode` | `push_clipboard_input` | `ClipboardInput` |

Preserve pointer IDs, sample positions, and consumption flags, use `PointerInput::local_delta` when converting window-space deltas into local control units, and consume only the events your control handles so parent scrolling and shortcuts keep working.
