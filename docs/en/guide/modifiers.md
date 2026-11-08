---
title: Modifiers
description: Decorate a component with size, spacing, drawing, interaction and semantics by chaining modifiers.
---

# Modifiers

A modifier changes how one piece of UI is laid out, drawn, or handled, and it works the same on any component that takes one. You start a chain with `Modifier::new()`, add calls in the order you want them to apply, and pass the result to the component's `modifier` setter.

This badge gets its background, rounded shape and inner spacing from one chain:

```rust
use tessera_components::{modifier::ModifierExt as _, text::text, theme::MaterialTheme};
use tessera_ui::{Dp, Modifier, tessera, use_context};

#[tessera]
fn status_badge() {
    let theme = use_context::<MaterialTheme>()
        .expect("status_badge requires material_theme")
        .get();
    let scheme = &theme.color_scheme;

    text("Synced").color(scheme.on_secondary_container).modifier(
        Modifier::new()
            .background_with_shape(scheme.secondary_container, theme.shapes.small)
            .padding_symmetric(Dp(12.0), Dp(4.0)),
    );
}
```

`Modifier` itself comes from `tessera_ui`. Most of the methods you call on it, such as `padding_all`, `background` and `clickable`, are extension methods from `tessera_components::modifier::ModifierExt`, so import that trait with `as _`. Focus modifiers come from `tessera_ui::FocusModifierExt` instead. Examples that read `MaterialTheme` need a `material_theme()` ancestor; see [Material 3 theming](/guide/theming).

## Order matters

Each call wraps everything after it. The chain applies from the outside in: the first modifier sees the constraints from the parent, and the last one sits closest to the content. Swapping two calls can change the result.

Here the same padding and size produce two different boxes:

```rust
let outside = Modifier::new()
    .padding_all(Dp(12.0))
    .size(Dp(120.0), Dp(48.0));

let inside = Modifier::new()
    .size(Dp(120.0), Dp(48.0))
    .padding_all(Dp(12.0));
```

With room to spare, `outside` puts 12 dp of padding around a 120 × 48 content area, so the whole thing is 144 × 72. `inside` fixes the total at 120 × 48 and then takes the padding out of it, leaving 96 × 24 for the content. Either way the parent's constraints still bound ordinary sizing requests. Repeated sizing modifiers follow the same outside-in order: an outer exact size bounds every request inside it, so an inner request may have no effect.

Drawing follows the same rule, because a visual modifier uses the bounds it has at its position in the chain:

```rust
let padded_surface = Modifier::new()
    .background(Color::WHITE)
    .padding_all(Dp(12.0));

let content_surface = Modifier::new()
    .padding_all(Dp(12.0))
    .background(Color::WHITE);
```

`padded_surface` paints the padding too. `content_surface` leaves the outer 12 dp unpainted and fills only the content behind it. Borders, clips and click targets work the same way, which is why the same few modifiers can express quite different designs.

## Size and spacing

Write sizes you choose yourself in `Dp`. The common sizing modifiers are:

- `width`, `height` and `size` ask for an exact size within the incoming bounds. `size_in` sets optional minimums and maximums, and `constrain` takes explicit `AxisConstraint` intervals.
- `fill_max_width`, `fill_max_height` and `fill_max_size` take the parent's finite maximum. On an unbounded axis, such as the main axis of a scrolling column, there is no maximum to take.
- `required_width`, `required_height` and `required_size` ignore the incoming constraints. Use them when you want the content to be able to overflow its parent.
- `padding_all`, `padding_symmetric` and `padding(Padding::new(left, top, right, bottom))` add space inside the modifier's bounds.
- `offset(x, y)` moves content while the space its parent reserved stays the same, so siblings stay where they are.

Some modifiers are instructions for the parent rather than for the node itself. `weight(1.0)` is read by rows and columns when they share out leftover space, and `align(...)` is read by `boxed()`. Other parents ignore them. [Layout basics](/guide/layout) shows these in context, together with what constraints are.

## Drawing

Visual modifiers paint around the content without changing its size:

- `background` and `background_with_shape` paint behind the content, and `border` and `border_with_shape` paint a stroke above it. They take up no space, so add padding when content must keep clear of a stroke.
- `shadow(&scheme, &ShadowArgs { .. })` draws an elevation shadow from the color scheme.
- `clip_shape(shape)` and `clip_to_bounds()` keep descendants inside a shape or the rectangular bounds. Clipping affects drawing and hit testing, not measurement. A shaped background paints only; to clip content to the same shape, add `clip_shape` with that shape.
- `alpha(value)` multiplies the subtree's opacity. It does not create an isolated layer, so overlapping children may not fade as one image. It is also not a disabled state: transparent content still takes part in layout, focus and semantics.

When a surface uses a shadow, fill, border and clip together, give them the same `Shape` so their edges agree. Color roles and shape roles come from the theme; see [Material 3 theming](/guide/theming). For drawing that these modifiers cannot express, see [Drawing and shaders](/guide/drawing).

## Interaction

Interaction modifiers give a custom-looking subtree the behavior of a standard control. `clickable`, `toggleable` and `selectable` connect one action to pointer input, keyboard activation and the accessibility action, and `draggable` reports drag deltas. Each has a `_with` variant that takes a configuration struct.

Where you put them in the chain decides how big the target is. In this row the click target is placed before the padding, so the padding is part of what you can press:

```rust
use tessera_components::{
    modifier::{ClickableArgs, ModifierExt as _},
    row::row,
    text::text,
};
use tessera_ui::{Callback, Dp, Modifier, accesskit::Role, tessera};

#[tessera]
fn settings_row(on_open: Callback) {
    row()
        .modifier(
            Modifier::new()
                .fill_max_width()
                .clickable_with(ClickableArgs {
                    label: Some("Open settings".into()),
                    role: Some(Role::Button),
                    on_click: on_open,
                    ..Default::default()
                })
                .padding_all(Dp(16.0)),
        )
        .children(|| text("Settings"));
}
```

The label and role are what make this target reachable from the keyboard: an enabled `clickable` registers a focus target once it has a role, a label or a description. [Gestures and interaction](/guide/interaction) covers the configuration structs, focus and raw input handlers.

## Semantics

`semantics(SemanticsArgs { .. })` attaches accessibility metadata, such as a name, role, value or test tag, to a subtree, leaving layout and drawing as they are. Interaction modifiers and standard controls publish their own semantics, so you reach for it mainly when you build something custom or need a stable tag in tests. [Semantics](/guide/semantics) explains the tree it builds.

## Reuse modifiers

A `Modifier` is an ordinary value. You can keep a chain in a variable, clone it, and keep extending the clone; any state a modifier needs is allocated when the chain is attached to a node, so building and cloning the value stays cheap. `then(other)` appends a whole chain after the current one.

When you write your own component, accept the caller's chain as an optional `modifier` prop and put it first, so the caller's size and padding sit outside your own decoration.

```rust
use tessera_components::{
    modifier::ModifierExt as _, row::row, text::text, theme::MaterialTheme,
};
use tessera_ui::{Dp, Modifier, tessera, use_context};

#[tessera]
fn tag(#[prop(into)] label: String, modifier: Option<Modifier>) {
    let theme = use_context::<MaterialTheme>()
        .expect("tag requires material_theme")
        .get();
    text(label).modifier(
        modifier
            .unwrap_or_default()
            .background_with_shape(theme.color_scheme.surface_container, theme.shapes.small)
            .padding_symmetric(Dp(8.0), Dp(4.0)),
    );
}

#[tessera]
fn tag_row() {
    let spaced = Modifier::new().padding_all(Dp(4.0));
    row().children(move || {
        tag("Rust").modifier(spaced.clone());
        tag("Archived").modifier(spaced.clone().alpha(0.6));
    });
}
```

The outer 4 dp padding stays unpainted because it comes before the tag's background.

## Write a modifier extension

When the same combination keeps appearing, give it a name with an extension trait on `Modifier`. Most extensions only compose existing modifiers:

```rust
trait CardModifierExt {
    fn card_surface(self, theme: &MaterialTheme) -> Modifier;
}

impl CardModifierExt for Modifier {
    fn card_surface(self, theme: &MaterialTheme) -> Modifier {
        let shape = theme.shapes.medium;
        self.background_with_shape(theme.color_scheme.surface_container, shape)
            .clip_shape(shape)
            .padding_all(Dp(16.0))
    }
}

#[tessera]
fn card_title() {
    let theme = use_context::<MaterialTheme>()
        .expect("card_title requires material_theme")
        .get();
    text("Documents").modifier(Modifier::new().fill_max_width().card_surface(&theme));
}
```

Name the method after what it means, take owned configuration, and keep normal ordering: the extension's modifiers apply where the call sits in the chain.

For behavior the existing modifiers cannot express, you implement a node trait and attach it through `tessera_ui::modifier::ModifierCapabilityExt`, for example `push_layout` for measurement or `push_draw` for painting. Keep those calls inside the extension, so application UI only calls the named method. [Custom layout](/guide/custom-layout) walks through a layout node, and [Drawing and shaders](/guide/drawing) covers draw nodes.

The [components API reference](https://tessera-ui.github.io/tessera/tessera_components/modifier/index.html) lists every method on `ModifierExt`.
