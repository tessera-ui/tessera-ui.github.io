---
title: Semantics and accessibility
description: Describe custom UI with SemanticsArgs, build accessible controls and focus order, and inspect the published tree.
---

# Semantics and accessibility

Tessera publishes a semantic tree alongside the visual UI for screen readers, keyboard navigation, and automated tests. Built-in controls and interactive modifiers publish their own roles, names, and actions; you step in to label icon-only controls, group composite widgets cleanly, or describe custom elements.

## Prefer standard controls and labels

Whenever an existing control fits, use it—`text_field`, `checkbox`, `radio_group`, and `button` already wire roles, keyboard navigation, and accessibility actions together.

- Provide `accessibility_label` on icon-only controls (`icon_button`, image buttons) and fields whose visual content is not self-explanatory; omit the role word ("Search messages", not "Search messages button").
- Add `accessibility_description` for extra instructions without cluttering the name.
- Always set `.label(...)` on `text_field`, even when using `.placeholder(...)`.
- Resolve accessibility strings from the same localization catalog as visible UI copy.

```rust
use tessera_components::md3::{
    icon_button::icon_button,
    material_icons::filled,
    radio_button::{radio_button, radio_group},
};
use tessera_ui::{remember, tessera};

#[tessera]
fn sort_controls() {
    let selected = remember(|| 0usize);
    radio_group()
        .accessibility_label("Sort by")
        .content(move |group| {
            radio_button(selected.get() == 0)
                .group(group)
                .accessibility_label("Newest first")
                .on_select(move |_| selected.set(0));
            radio_button(selected.get() == 1)
                .group(group)
                .accessibility_label("Oldest first")
                .on_select(move |_| selected.set(1));
        });

    icon_button()
        .icon(filled::SEARCH_SVG)
        .accessibility_label("Search messages")
        .on_click(|| {});
}
```

## Describing custom subtrees with `semantics`

Attach `Modifier::new().semantics(SemanticsArgs { .. })` (from `tessera_foundation::modifier`) when a custom subtree needs an explicit role, label, value, or `test_tag` (types come from `tessera_ui::accesskit`).

Only nodes with semantic metadata appear in the published tree—plain layout containers are flattened away, and only placed nodes are published.

### Keeping vs. hiding descendants (`merge_descendants`)

With `SemanticsArgs::default()`, `merge_descendants` is `false`, meaning the parent node's description replaces its descendants:

```rust
use tessera_components::{md3::text::text, row::row};
use tessera_foundation::modifier::{ModifierExt as _, SemanticsArgs};
use tessera_ui::{Modifier, accesskit::Role, tessera};

#[tessera]
fn rating(stars: u8) {
    row()
        .modifier(Modifier::new().semantics(SemanticsArgs {
            role: Some(Role::Image),
            label: Some(format!("Rated {stars} out of 5")),
            test_tag: Some("rating".into()),
            ..Default::default()
        }))
        .children(move || {
            for index in 0..5 {
                text(if index < stars { "★" } else { "☆" });
            }
        });
}
```

When labeling a container whose child controls must remain individually interactive (such as a toolbar), set `merge_descendants: true` (or use `clear_and_set_semantics(args)` when explicitly replacing all child semantics):

```rust
use tessera_components::{md3::{button::button, text::text}, row::row};
use tessera_foundation::modifier::{ModifierExt as _, SemanticsArgs};
use tessera_ui::{Callback, Modifier, accesskit::Role, tessera};

#[tessera]
fn text_style_toolbar(on_bold: Callback, on_italic: Callback) {
    row()
        .modifier(Modifier::new().semantics(SemanticsArgs {
            role: Some(Role::Toolbar),
            label: Some("Text style".into()),
            merge_descendants: true,
            ..Default::default()
        }))
        .children(move || {
            button().on_click_shared(on_bold).child(|| text("Bold"));
            button().on_click_shared(on_italic).child(|| text("Italic"));
        });
}
```

::: warning Keep semantics truthful
- Match `toggled` vs. `selected` to the control's role (`toggleable` sets `toggled`; `selectable` sets `selected`, or `toggled` for `Role::RadioButton`).
- `disabled: true` only sets metadata—use interaction modifier `enabled` flags or gate handlers so disabled controls do not mutate state.
- `hidden: true` hides a node from assistive technology while still rendering and accepting input; keep focus out of hidden nodes.
:::

For low-level custom controls that handle AccessKit actions directly, implement `tessera_ui::SemanticsModifierNode`.

## Focus order and restoration

Keyboard traversal and reading order follow child declaration/placement order, so declare UI in the order it should be read.

- For toolbars and grouped controls, make the container one Tab stop with arrow-key movement inside:

```rust
use tessera_components::{md3::{icon_button::icon_button, material_icons::filled}, row::row};
use tessera_ui::{FocusTraversalPolicy, Modifier, modifier::FocusModifierExt as _, tessera};

#[tessera]
fn formatting_toolbar() {
    row()
        .modifier(Modifier::new().focus_group(None).focus_traversal_policy(
            FocusTraversalPolicy::horizontal().single_tab_stop(true),
        ))
        .children(|| {
            icon_button()
                .icon(filled::FORMAT_BOLD_SVG)
                .accessibility_label("Bold")
                .on_click(|| {});
            icon_button()
                .icon(filled::FORMAT_ITALIC_SVG)
                .accessibility_label("Italic")
                .on_click(|| {});
        });
}
```

- Before opening a temporary overlay (dialog, menu), save the active target with `tessera_ui::focus::save_focus()`, and call `target.restore()` when closing while the overlay still holds focus.

## Platform support and testing

AccessKit adapters are active on Windows, macOS, Linux, and iOS. Android and web do not currently expose native AccessKit adapters, though the published tree is still built and testable everywhere.

Use `UiTest` to verify published labels, roles, reading order, and accessibility actions without a window—see [Testing and headless automation](/guide/testing).
