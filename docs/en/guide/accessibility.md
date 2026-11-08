---
title: Accessibility
description: Make your app usable with screen readers and the keyboard by choosing the right controls, naming them well and checking the result.
---

# Accessibility

Tessera publishes an accessibility tree next to the visual UI, and screen readers, keyboard navigation and your tests all work from it. Most of the effort goes into choosing controls that already publish the right information, giving them clear names and keeping focus where people expect it. This page is about those practices; [Semantics](/guide/semantics) documents the API that describes nodes in the tree.

A text field is a good place to start: its visible label becomes its accessible name, and you can add a description for anything the label doesn't say.

```rust
use tessera_components::text_field::text_field;
use tessera_ui::tessera;

#[tessera]
fn account_name() {
    text_field()
        .label("Account name")
        .accessibility_description("Used to identify your account to other members");
}
```

Material controls need a `material_theme()` ancestor, as described in [Material 3 theming](/guide/theming).

## Start with existing controls

When a control from the component library fits, use it. A text field already connects editing, focus, selection and accessibility, so using it gives you all of them together; a version built from painted text and a pointer handler has to recreate each connection by hand.

Composite controls carry keyboard behavior too. A radio group publishes the group and its options, and it behaves as a single Tab stop whose options you move between with the arrow keys:

```rust
use tessera_components::radio_button::{radio_button, radio_group};
use tessera_ui::{remember, tessera};

#[tessera]
fn sort_order() {
    let selected = remember(|| 0usize);
    radio_group()
        .accessibility_label("Sort by")
        .content(move |group| {
            radio_button()
                .group(group)
                .selected(selected.get() == 0)
                .accessibility_label("Newest first")
                .on_select(move |_| selected.set(0));
            radio_button()
                .group(group)
                .selected(selected.get() == 1)
                .accessibility_label("Oldest first")
                .on_select(move |_| selected.set(1));
        });
}
```

If you need a custom look but ordinary activation behavior, build it with `clickable_with`, `toggleable_with` or `selectable_with`. These modifiers connect one action to pointer input, keyboard input and assistive technology at once. See [Gestures and interaction](/guide/interaction).

## Give every control a name

A name says what a control is for: "Search messages", not "Magnifying glass". A description adds what the name leaves out, such as an input requirement or the consequence of an action. Leave the role out of the name, since the screen reader announces the role separately; "Search messages, button" reads better than "Search messages button, button".

Icon-only controls have no visible text to borrow a name from, so give them one with `accessibility_label`:

```rust
use tessera_components::{icon_button::icon_button, material_icons::filled};
use tessera_ui::tessera;

#[tessera]
fn search_action() {
    icon_button()
        .icon(filled::SEARCH_SVG)
        .accessibility_label("Search messages")
        .on_click(|| {});
}
```

Use a control's `accessibility_label` whenever its visible content isn't a suitable name. Where a control offers `accessibility_description`, it adds explanatory text without changing the name. Give text fields a label even when they show a placeholder, because the placeholder disappears as soon as the user types.

Text you place inside a button is published as a text node of its own, beneath the button. To give the button node itself a name, set `accessibility_label` on it.

Names and descriptions are user-facing text. Resolve them next to the control from the same catalog as its visible text, so they change language together; see [Localization](/guide/i18n).

## Describe custom controls honestly

When a custom subtree needs metadata that no existing control publishes, attach it with the semantics modifier. [Semantics](/guide/semantics) lists the fields; a few habits keep the result truthful:

- Choose the role for what the element does, not for how it looks.
- Checked and selected are different states. The selectable interaction modifier, for example, publishes checked state for `Role::RadioButton` and selected state for other selectable roles. Derive the published state from the same application state that drives the appearance, so the two always agree.
- Publishing `disabled` only sets metadata; make your input handlers and actions leave state unchanged as well. The interaction modifiers' `enabled` setting does both.
- Semantics advertise actions; your code implements them. Advertise only what the control actually handles, and get ordinary click and toggle from an existing control or an interaction modifier.
- Marking content `hidden` removes it from the accessibility tree, but it is still drawn and still receives pointer and keyboard input. Keep focus out of content that assistive technology cannot reach.
- Be careful when you put semantics on a container of controls. With `SemanticsArgs::default()`, `merge_descendants` is `false` and the children are no longer exposed individually. A named group of independently operable controls needs `merge_descendants: true`.

## Keep focus and reading order predictable

Both keyboard traversal and the accessibility tree follow the order in which layouts place their children, not their final screen coordinates. For rows, columns and the other standard layouts that is the visual order, so the simplest way to get a sensible reading order is to declare content in the order you want it read.

A toolbar or another composite widget usually works best as one Tab stop with arrow-key movement inside it, like the radio group above. A focus group with a traversal policy gives you that for your own containers:

```rust
use tessera_components::{icon_button::icon_button, material_icons::filled, row::row};
use tessera_ui::{FocusTraversalPolicy, Modifier, modifier::FocusModifierExt as _, tessera};

#[tessera]
fn formatting_toolbar() {
    row()
        .modifier(Modifier::new().focus_group().focus_traversal_policy(
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

When temporary UI such as a dialog or menu closes, return focus to where the user was. Save the focused target before you show it, and restore it while the temporary UI still holds focus, so a place the user has moved to in the meantime keeps its focus. Restoring does nothing if the target has been removed or disabled in the meantime:

```rust
use tessera_ui::FocusManager;

let restore_to = FocusManager::current().save_focus();
// Show the dialog. When it closes:
if let Some(target) = restore_to {
    target.restore();
}
```

Keep a visible focus indicator on custom controls; `FocusRequester::is_focus_visible` tells you when keyboard focus should be drawn. The `focusable` and `focused` semantic fields only describe focus; to register or move keyboard focus, use the focus modifiers, requesters and the focus manager described in [Gestures and interaction](/guide/interaction).

## Platform support

The application renderer connects AccessKit adapters on Windows, macOS, Linux and iOS. Android and web have no active adapter in Tessera, so on those targets the published semantics do not by themselves give screen-reader users native access.

## Check your app

Try the app with each target platform's screen reader and with the keyboard alone. Confirm that names and values are announced, activation works, checked and selected states are right, disabled controls do nothing, the reading order makes sense and focus comes back after dialogs close.

Automated tests read the same tree. They can find a node by label and role, fire accessibility actions on it and check the reading order, all in a windowless test; see [Testing](/guide/testing).
