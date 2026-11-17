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

When an existing Material control fits your task, prefer it. For custom UI, import interaction modifiers and their configuration types from `tessera_foundation::modifier`. These provide behavior without requiring a Material theme or adding ripples; Material controls supply their own visual feedback.

| Modifier | Behavior |
| --- | --- |
| `clickable(ClickableArgs)` | Pointer/keyboard/accessibility activation |
| `combined_clickable(CombinedClickableArgs)` | Click and long-click actions with cancellation |
| `toggleable(ToggleableArgs)` | Boolean toggle (`on_value_change`) with toggled semantics |
| `selectable(SelectableArgs)` | Selection item (`selected` + `on_click`) |
| `draggable(DraggableArgs)` | Drag deltas in local physical pixels |

Give custom clickable elements an accessibility `role` and `label` (or `description`) so they register as keyboard focus targets and expose click actions to assistive technology:

```rust
use tessera_components::{boxed::boxed, md3::text::text};
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
use tessera_components::{md3::text::text, row::row};
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
use tessera_components::{boxed::boxed, md3::text::text};
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

## Custom asynchronous gestures

Use the interactive modifiers above for standard activation: raw gesture detection does not add keyboard or accessibility behavior. For custom pointer handling, attach a detector with `Modifier::pointer_input(key, detector)` or `pointer_input_once(detector)` and prefer the shared helpers in `tessera_foundation::pointer_gestures`:

```rust
use tessera_components::{boxed::boxed, md3::text::text};
use tessera_foundation::{
    modifier::ModifierExt as _,
    pointer_gestures::{TapGesture, TapGestureConfig, detect_tap_gestures},
};
use tessera_ui::{Dp, Modifier, remember, tessera};

#[tessera]
fn tap_counter() {
    let count = remember(|| 0usize);
    boxed()
        .modifier(
            Modifier::new()
                .size(Dp(160.0), Dp(80.0))
                .pointer_input_once(move |mut scope| async move {
                    detect_tap_gestures(&mut scope, TapGestureConfig::default(), move |gesture| {
                        if matches!(gesture, TapGesture::Tapped(_, _)) {
                            count.with_mut(|value| *value += 1);
                        }
                    })
                    .await;
                }),
        )
        .children(move || text(format!("Taps: {}", count.get())));
}
```

Each attachment owns one UI-local task. Detaching the modifier or changing its key cancels the task; rebuilding with the same key keeps the original running closure. Capture state handles for current values, and put configuration that should restart detection in the key. `pointer_input_once` means one task per attachment, not one gesture.

- `detect_tap_gestures`, `detect_long_press_gestures`, `detect_drag_gestures`, and `detect_scroll_gestures` share sampled event handling and cancellation. Drag thresholds accumulate from the press; deltas are incremental local movement. Long presses use the frame clock, including while the pointer is still.
- Cancellation callbacks can run when a detector is dropped. Check `State::is_alive` before touching remembered state during cleanup.
- For custom arbitration, use `PointerInputScope` to await `PointerEventPass::Initial`, `Main`, or `Final`. Each sample completes all three passes before the next sample; consumption affects later handlers in the same dispatch. Main runs children before parents, so a child's tap does not activate an ancestor click handler.
- `await_each_gesture` repeats a custom gesture body after all observed pointers lift. Keep unrelated asynchronous work in a separate task: pointer events are not buffered while the detector awaits something else.

The detector closures passed directly to `pointer_input` and `pointer_input_once` are Tessera-colored; gesture action callbacks are ordinary callbacks and must not call components or build-scoped APIs.

## Focus management

Import focus modifiers from `tessera_ui::modifier::FocusModifierExt`.

### Requesting and observing focus

Bind a remembered `FocusRequester` to a focusable node and call `.request_focus()` from an action (never unconditionally during build, or you override user navigation):

```rust
use tessera_components::{boxed::boxed, column::column, md3::{button::button, text::text}};
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
