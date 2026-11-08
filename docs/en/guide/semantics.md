---
title: Semantics
description: Describe what your UI means so that assistive technology and tests can find and understand it.
---

# Semantics

Alongside what it draws, Tessera builds a semantics tree that says what each part of the interface is: a button, a heading, a slider at 40 percent. Screen readers and other assistive technology read this tree, and so do your tests, so one description serves both.

Standard controls describe themselves. You add semantics when you build something custom, or when the default description does not fit. This star rating presents itself as a single image with a meaningful name, and the five star glyphs inside it stay out of the tree:

```rust
use tessera_components::{
    modifier::{ModifierExt as _, SemanticsArgs},
    row::row,
    text::text,
};
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

Roles and typed state values come from `tessera_ui::accesskit`. Semantics only describe the UI. Drawing comes from components and visual modifiers, and interaction from controls and interaction modifiers.

## The semantics tree

The semantics tree is sparser than the component tree. Only components that carry semantic metadata appear in it; layout containers without metadata are skipped, and their semantic descendants attach to the nearest semantic ancestor. The root is the window.

Metadata comes from three places:

- **Standard components.** `text` publishes a label node whose name is its content, unless you override it with `accessibility_label`. Controls such as buttons and text fields publish their roles, states and actions.
- **Interaction modifiers.** `clickable_with`, `toggleable_with` and `selectable_with` publish the role, name and action that match the behavior they add; see [Gestures and interaction](/guide/interaction).
- **The `semantics` modifier.** `ModifierExt::semantics` attaches `SemanticsArgs` to any subtree.

Each node keeps the stable identity of its component, so focus and action targets survive value updates and local rebuilds. Its bounds come from layout; `bounds_padding` can enlarge them without changing layout. Only subtrees placed during layout are published, so content that was measured but never placed stays invisible to assistive technology.

## Keep or hide descendants

The `rating` example above publishes a single node for the row and its five stars. With `SemanticsArgs::default()`, `merge_descendants` is `false`, and the node's own description stands in for all of its descendants. That is the right choice when the parent's description replaces the content, as it does here.

For a container whose children are still operated on their own, set `merge_descendants: true`. A toolbar, for example, names the group and keeps its buttons reachable:

```rust
use tessera_components::button::button;
use tessera_ui::Callback;

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

Now the published tree contains the toolbar, and under it each button with its label.

::: warning
Set `merge_descendants: true` when you put `semantics(SemanticsArgs { .. })` on a container of controls. Despite its name, `true` keeps the children as separate child nodes, and `false` drops them. With the default `false`, the controls in that container are hidden from assistive technology.
:::

`clear_and_set_semantics(args)` always uses the hiding behavior, whatever `args` says, which makes the intent explicit. Use it when the parent provides the complete replacement description.

`hidden: true` marks content as hidden from accessibility. Drawing, pointer input and keyboard interaction carry on as before, so keep focus on content that assistive technology can reach.

## SemanticsArgs fields

All fields are optional, and `..Default::default()` fills the rest.

| Field | Meaning |
| --- | --- |
| `role` | What kind of element this is. Choose it by what the element does. |
| `label`, `description` | The element's name, and extra explanation the name does not give. |
| `value` | A textual value, separate from the name. |
| `numeric_value`, `numeric_range` | The current number and its `(min, max)`. |
| `numeric_value_step`, `numeric_value_jump` | Small and page-sized increments for range controls. |
| `toggled` | Checked, unchecked or mixed, as `accesskit::Toggled`. |
| `selected` | Whether an item is selected, for roles that support selection. |
| `expanded`, `has_popup` | Disclosure state and the kind of popup the control opens. |
| `disabled`, `invalid` | Availability and validation state. |
| `state_description`, `role_description` | Extra human-readable state, and a custom name for the role. |
| `heading_level` | A heading's level, starting at 1. Without a `role`, the node becomes a heading. |
| `tooltip` | Contextual help. Focusable descendants without their own description inherit it as their description. |
| `live` | How politely changes to this node are announced. |
| `modal` | Whether this dialog blocks interaction with the rest of the window. |
| `scroll_x`, `scroll_y` | Scroll position as `(value, min, max)`. |
| `collection_info`, `collection_item_info` | Row and column counts of a collection, and an item's position in it. |
| `actions` | AccessKit actions the node advertises. |
| `focusable`, `focused` | Focus metadata for the published node. |
| `hidden` | Hides the node from accessibility. |
| `merge_descendants` | Whether descendants stay exposed as separate nodes. Defaults to `false`. |
| `bounds_padding` | Extra space around the semantic bounds, without changing layout. |
| `test_tag` | A stable key for tests and inspection. |

Selection and checked state mean different things. `selectable_with`, for instance, publishes checked state for `Role::RadioButton` and selection for other selectable roles. Keep whatever you publish in sync with the same state that drives the appearance.

Several fields describe behavior; the behavior itself comes from elsewhere:

- `disabled` only publishes metadata. Your input handlers and actions must also refuse to change state. The `enabled` setting on interaction modifiers keeps behavior and semantics together.
- `actions` only advertises actions; handling them is a separate job. For ordinary click and toggle behavior, use a standard control or an interaction modifier.
- `focusable` and `focused` only describe focus. To register a focus target or move focus, use `FocusModifierExt`, focus requesters and the focus manager.

A lower-level control that needs to handle accessibility actions itself can implement `tessera_ui::SemanticsModifierNode`, which receives both the `AccessibilityNode` and an optional `AccessibilityActionHandler`. That is an extension API; application components rarely need it.

## Use semantics in tests

Tests read the same tree that assistive technology does, which makes semantics a stable way to find things. A `test_tag` is the most direct handle: layout snapshots resolve `snapshot.node("rating")` through it, and component snapshots find it with `tagged`. Tags must be unique among placed nodes, and `root` is reserved.

This test checks both what the component asked for and what was actually published:

```rust
use tessera_ui::{
    accesskit::Role,
    testing::{layout_test, pump_layout_test_session, start_layout_test_session},
};

#[test]
fn rating_publishes_one_node() {
    let mut session = start_layout_test_session(layout_test(|| rating(4)));
    pump_layout_test_session(&mut session, 0);

    let components = session.inspect_components();
    let node = components.tagged("rating");
    assert_eq!(
        node.semantics().and_then(|semantics| semantics.label.as_deref()),
        Some("Rated 4 out of 5"),
    );

    let tree = session.inspect_accessibility().expect("published tree");
    assert!(tree.find("Rated 4 out of 5", Role::Image).is_some());
    assert!(tree.nodes().iter().all(|(_, node)| node.role() != Role::Label));
}
```

`inspect_components()` returns every component with its bounds and the metadata it requested; `labeled` and `matching_label` find components by name. `inspect_accessibility()` returns the published tree: `find(label, role)` locates a unique node, `ancestor_with_role` walks up from it, and `reading_order()` visits nodes in the order a screen reader would. `dispatch_accessibility_action` sends an action through the published target, as assistive technology would; pump another frame before checking the result. Headless renderers also provide `inspect_components()` and `inspect_accessibility()`, and `cargo tessera headless` returns this data from its `snapshot` command. See [Testing](/guide/testing).

Assert on the published tree when the question is "what will a screen reader get". A component can request metadata that a parent then hides, as the last assertion shows: the star glyphs requested label nodes, but none were published.

## Platform support

The application renderer connects AccessKit adapters on Windows, macOS, Linux and iOS. Android and web have no active adapter in Tessera, so the tree you publish there does not by itself give screen readers access, although tests can still inspect it. [Accessibility](/guide/accessibility) covers naming, focus order and checking your app with real assistive technology.

The [core API reference](https://tessera-ui.github.io/tessera/tessera_ui/) documents `AccessibilityNode` and the action interfaces.
