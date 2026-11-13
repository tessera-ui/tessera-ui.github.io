---
title: Layout basics
description: Arrange UI with rows, columns, boxes, flow containers, constraints, and window insets.
---

# Layout basics

Interfaces in Tessera are built by nesting components inside a handful of standard containers. Each container solves one arrangement problem—horizontal, vertical, stacked, or wrapping—and modifiers adjust sizing and spacing on individual children.

Examples on this page assume they sit beneath `material_theme()` with `ComponentsPackage` registered at startup. See [Material 3 theming](/guide/theming) and [Entry point, windows, and sessions](/guide/app).

## Standard containers

`row()` places children left to right, `column()` stacks them top to bottom, and `boxed()` layers them on top of each other. Here is a typical message preview combining a row and a column:

```rust
use tessera_components::{
    alignment::CrossAxisAlignment,
    column::column,
    row::row,
    spacer::spacer,
    text::text,
};
use tessera_foundation::modifier::ModifierExt as _;
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

Because `children` takes a plain build closure, you can include or repeat children with normal Rust `if`, `match`, and `for`. Fixed-size `spacer()` components add consistent gaps between siblings.

## Alignment and weighted space

Rows and columns align children to the start on both axes by default:

- `main_axis_alignment(...)` positions children along the layout direction (`Start`, `Center`, `End`, `SpaceBetween`, `SpaceAround`, `SpaceEvenly`).
- `cross_axis_alignment(...)` aligns perpendicular to the layout direction (`Start`, `Center`, `End`, `Stretch`).

To push part of a row or column to the far end, insert a weighted `spacer()` (or give any direct child `.weight(1.0)`):

```rust
use tessera_components::{
    alignment::CrossAxisAlignment,
    row::row,
    spacer::spacer,
    text::text,
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, tessera};

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

`weight` attaches parent data that `row` and `column` read during measurement: unweighted children are measured first, and any remaining finite space along the main axis is divided proportionally among weighted children. If the main axis has no finite upper bound (for instance inside a scrollable column), there is no leftover space to split, so weighted children are measured normally. Only `row` and `column` read `.weight(...)`.

## Layering with `boxed`

`boxed().alignment(...)` sets the default placement for its children, and individual children can override it with `.align(...)`:

```rust
use tessera_components::{alignment::Alignment, boxed::boxed, text::text};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, tessera};

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

## Wrapping with flow containers

When items should wrap onto the next line once a row fills up, use `flow_row()` (or `flow_column()` for vertical wrapping):

```rust
use tessera_components::{flow_row::flow_row, text::text};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, tessera};

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

`item_spacing` sets the gap within a line, and `line_spacing` sets the gap between wrapped lines. Because flow containers build all children upfront, switch to lazy grids or lists when rendering large data sets; see [Lists, grids, and scrolling](/guide/lists).

## Units and constraints

Tessera separates authoring units from measured pixel units:

- **`Dp` (density-independent pixels)**: use for padding, component sizes, spacing, and typography. `Dp(16.0)` scales automatically with the UI session's display density.
- **`Px` (physical pixels)**: integer pixels used internally by layout measurement and readback; `PxPosition` uses `f32` physical coordinates.

During layout, each parent passes a `Constraint` containing one `AxisConstraint` for width and one for height. An `AxisConstraint` has a `min: Px` and an `Option<Px>` `max`:

```rust
use tessera_ui::{AxisConstraint, Constraint, Px};

let available = Constraint::new(
    AxisConstraint::at_most(Px(640)),
    AxisConstraint::new(Px(0), Some(Px(480))),
);
let exact = Constraint::exact(Px(320), Px(240));
```

When `max` is `None`, that axis is **unbounded**—common inside scroll viewports along the scroll direction. That is why `fill_max_height()` inside a vertical scroller has no finite maximum to expand to. When `min == max`, the size on that axis is fixed.

## Window insets and safe areas

On mobile devices or edge-to-edge windows, status bars, display cutouts, and the on-screen keyboard can overlap window edges. Full-screen layouts usually delegate this to `scaffold`:

```rust
use tessera_components::{scaffold::scaffold, text::text};
use tessera_ui::{WindowInsets, tessera};

#[tessera]
fn screen() {
    scaffold()
        .window_insets(WindowInsets::SafeDrawing)
        .content(|| text("Screen content"));
}
```

`WindowInsets::SystemBars` covers status/navigation bars and cutouts, `WindowInsets::Ime` covers a docked on-screen keyboard, and `WindowInsets::SafeDrawing` takes the per-edge maximum of both so neither overlaps your content.

When building custom full-screen shells, apply `Modifier::new().window_insets_padding(WindowInsets::SafeDrawing)`. It pads only by the insets not yet consumed by ancestors and marks those edges consumed so nested screens never double-pad. Use `consume_window_insets` when a layout reserves the space itself without padding, or edge helpers like `window_insets_bottom_height` to size spacers directly.

## Next steps

- Learn modifier ordering and visual/layout chaining in [Modifiers](/guide/modifiers).
- Handle content larger than the viewport in [Lists, grids, and scrolling](/guide/lists).
- Write custom measurement or scaled coordinate boundaries in [Custom layout and coordinates](/guide/custom-layout).
