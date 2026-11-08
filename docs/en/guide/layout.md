---
title: Layout basics
description: Arrange components in rows, columns, boxes and flows, and keep screens clear of system areas.
---

# Layout basics

You build a screen by nesting components inside a few standard containers. Each container arranges its children in one way, horizontally, vertically, stacked or wrapping, and you combine them to get the structure you want. Modifiers then adjust how much space a single piece of content takes.

The examples on this page need a `material_theme()` ancestor, and the application has to register `ComponentsPackage`. See [Material 3 theming](/guide/theming) and [Entry point and windows](/guide/app).

## Standard containers

`row()` places its children one after another horizontally, `column()` places them vertically, and `boxed()` stacks them on top of each other. A message preview, for example, is a row holding an avatar and a column of two lines:

```rust
use tessera_components::{
    alignment::CrossAxisAlignment, column::column, modifier::ModifierExt as _,
    row::row, spacer::spacer, text::text,
};
use tessera_ui::{Dp, Modifier, tessera};

#[tessera]
fn message_preview() {
    row()
        .cross_axis_alignment(CrossAxisAlignment::Center)
        .children(|| {
            text("AL");
            spacer().modifier(Modifier::new().width(Dp(12.0)));
            column().children(|| {
                text("Ada Lovelace");
                text("Notes on the engine");
            });
        });
}
```

Containers take their children in a `children` closure, so ordinary Rust control flow such as `if` and `for` decides what goes inside. The spacer with a fixed `width` puts a constant gap between the avatar and the text.

## Alignment and arrangement

Rows and columns start their children at the start of both axes. `main_axis_alignment` moves them along the container's direction, with choices such as `Center`, `End`, `SpaceBetween`, `SpaceAround` and `SpaceEvenly`. `cross_axis_alignment` controls the perpendicular direction, and `CrossAxisAlignment::Stretch` stretches children across it.

To push some children to the far end and keep others at the start, give a spacer a weight. In this row the modifier makes the row fill the available width, and the weighted spacer takes everything the two labels leave over:

```rust
#[tessera]
fn folder_row() {
    row()
        .modifier(Modifier::new().fill_max_width().padding_all(Dp(12.0)))
        .cross_axis_alignment(CrossAxisAlignment::Center)
        .children(|| {
            text("Documents");
            spacer().modifier(Modifier::new().weight(1.0));
            text("12 items");
        });
}
```

`weight(1.0)` is parent data that rows and columns read. They measure the unweighted children first, then divide the remaining finite main-axis space among children with positive weights. If the main axis has no finite maximum, there is nothing left over to divide, and the layout measures children without weighted allocation. Only rows and columns read a weight, so it takes effect on their direct children.

## Stack content in a box

`boxed().alignment(...)` sets where its children go by default, and a child can override that with its own `align(...)` modifier. That is how you put a badge in the corner of a preview:

```rust
use tessera_components::{alignment::Alignment, boxed::boxed};

#[tessera]
fn layered_label() {
    boxed()
        .modifier(Modifier::new().size(Dp(240.0), Dp(120.0)))
        .alignment(Alignment::Center)
        .children(|| {
            text("Preview");
            text("New").modifier(Modifier::new().align(Alignment::TopEnd));
        });
}
```

## Wrap items with flow layouts

When items should wrap onto another line once a line is full, use `flow_row()`, or `flow_column()` for the vertical direction. A set of tags is the typical case:

```rust
use tessera_components::flow_row::flow_row;

#[tessera]
fn tags() {
    flow_row()
        .modifier(Modifier::new().fill_max_width())
        .item_spacing(Dp(8.0))
        .line_spacing(Dp(8.0))
        .children(|| {
            for tag in ["rust", "ui", "gpu", "desktop", "android", "web"] {
                text(tag);
            }
        });
}
```

`item_spacing` sets the gap between items on one line and `line_spacing` the gap between lines. Flow containers build every child, so they suit short sets; for long collections use a lazy list from [Lists and scrolling](/guide/lists).

## Spacing, size and offsets

`padding_all` puts the same padding on every edge, and `padding_symmetric(horizontal, vertical)` sets the two axes separately. To set each edge on its own, use `padding(Padding::new(left, top, right, bottom))` with `Padding` imported from `tessera_components::modifier`. For a fixed gap between row or column children, insert a `spacer()` with a `width` or `height`; a weighted spacer takes the remaining space instead.

`width`, `height` and `size` ask for an exact size within the bounds the parent allows, and `fill_max_width`, `fill_max_height` and `fill_max_size` take the parent's finite maximum. Modifiers apply from the outside in, so `padding` before `size` gives a different result than `size` before `padding`. [Modifiers](/guide/modifiers) explains ordering and the full set of sizing modifiers.

`offset(x, y)` moves content while keeping the size its parent reserved for it, so siblings stay where they are. When the surrounding layout needs to make room, use padding or a spacer.

## Units and constraints

Write the dimensions you choose yourself, such as padding, control sizes and text sizes, in `Dp`. `Dp(16.0)` is density-independent, and Tessera converts it to physical pixels using the density of the active UI session. Layout itself works in physical pixels: `Px` is an integer pixel measurement used by constraints, measured sizes and readback, and `PxPosition` allows fractional pixel positions.

During layout, each parent hands its child a `Constraint`: one interval for width and one for height. The child picks a size within those intervals, and the parent then decides where to place it. Each `AxisConstraint` has a minimum `Px` and an optional maximum. A missing maximum means the space is unbounded on that axis, which is not the same as "as big as the window". When the minimum and maximum are equal, the size is exact.

```rust
use tessera_ui::{AxisConstraint, Constraint, Px};

let available = Constraint::new(
    AxisConstraint::at_most(Px(640)),
    AxisConstraint::new(Px(0), Some(Px(480))),
);
let exact = Constraint::exact(Px(320), Px(240));
```

These values are physical measurements. In most UI code you describe size with modifiers, and parent layouts produce the constraints. Unbounded axes matter in practice, though: inside a scrolling container the scrolling axis has no maximum, so `fill_max_height` there has nothing to fill. Measurement code that works with constraints directly is covered in [Custom layout](/guide/custom-layout).

## Keep content clear of system areas

On phones and in edge-to-edge windows, status bars, display cutouts and the on-screen keyboard can cover part of the window. For a screen that fills the window, `scaffold` keeps its slots clear of those areas while still drawing its background underneath them:

```rust
use tessera_components::scaffold::scaffold;
use tessera_ui::WindowInsets;

#[tessera]
fn screen() {
    scaffold()
        .window_insets(WindowInsets::SafeDrawing)
        .content(|| text("Screen content"));
}
```

`WindowInsets::SystemBars` covers system bars and display cutouts, and `Ime` covers the area hidden by a docked on-screen keyboard. `SafeDrawing` takes the larger of the two on each edge; it does not add them together.

If you draw your own screen boundary, use `Modifier::new().window_insets_padding(WindowInsets::SafeDrawing)`. It pads only the part of the inset that ancestors have not already consumed, then marks that space as consumed for its descendants, so nested screens pad each inset once. `consume_window_insets` marks the space as consumed without adding padding. Use it only when a parent has already reserved that space some other way.

Edge helpers such as `window_insets_bottom_height` and `window_insets_top_height` size a spacer to whatever inset remains on that edge. Keep regular content padding separate from safe-area padding. The [scaffold reference](https://tessera-ui.github.io/tessera/tessera_components/scaffold/index.html) covers the bar and floating-content slots.

## Next steps

- [Lists and scrolling](/guide/lists) for content that does not fit on screen.
- [Modifiers](/guide/modifiers) for sizing, ordering and visual modifiers.
- [Custom layout](/guide/custom-layout) when no container does what you need.
