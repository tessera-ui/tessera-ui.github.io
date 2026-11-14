---
title: Lists, grids, and scrolling
description: Scroll finite containers, virtualize long feeds with lazy lists and grids, and control scroll positions.
---

# Lists, grids, and scrolling

When content exceeds the viewport, small fixed forms can simply wrap a `column` with a scroll modifier. For long or dynamic collections, Tessera's lazy lists and grids only build and lay out the items visible in the viewport, keeping frame cost tied to screen size rather than total item count.

Examples below assume `material_theme()` above them and `ComponentsPackage` registered at startup.

## Scrollable containers

Wrap a container in a scroll modifier and remember a `ScrollableController` so the scroll offset survives rebuilds:

```rust
use tessera_components::{
    column::column,
    md3::{modifier::ModifierExt as _, scrollable::ScrollableController, text::text},
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, remember, tessera};

#[tessera]
fn notes() {
    let scroll = remember(ScrollableController::default);
    column()
        .modifier(
            Modifier::new()
                .fill_max_width()
                .height(Dp(240.0))
                .vertical_scroll(scroll),
        )
        .children(|| {
            for index in 0..40 {
                text(format!("Line {index}"));
            }
        });
}
```

Use `horizontal_scroll(controller)` for horizontal scrolling, or `scroll(controller, vertical, horizontal)` for both axes. Descendants are clipped to the viewport.

Notice the explicit `.height(Dp(240.0))`: a scroll viewport must have a finite bound along its scroll axis (either from its parent or from a size modifier). Note also that a plain `column` with `vertical_scroll` still builds all 40 lines on rebuild—great for settings forms or short articles, not for large feeds.

::: warning Nested same-axis scrollers
Inside a vertical scroller, the incoming height constraint is unbounded (`max == None`). Never place a `fill_max_height()` child scroller directly inside it without a bounded height; give the inner scroller an explicit size.
:::

## Virtualized lists: `lazy_column` and `lazy_row`

`lazy_column()` and `lazy_row()` build only visible items plus a small `overscan` margin. Add entries with `item`, `items`, `items_from_iter_with_key`, and `sticky_header`:

```rust
use tessera_components::md3::{lazy_list::lazy_column, text::text};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, tessera};

#[tessera]
fn files() {
    lazy_column()
        .modifier(Modifier::new().fill_max_width().height(Dp(320.0)))
        .item_spacing(Dp(8.0))
        .content_padding(Dp(12.0))
        .items_from_iter_with_key(
            vec![(41_u64, "Notes"), (73_u64, "Pictures")],
            |_, item| item.0,
            |_, item| text(item.1),
        );
}
```

`item_spacing` sets the gap between items, `content_padding` pads the outer viewport edges, and `sticky_header` / `sticky_header_with_key` pin section headers while their section scrolls through.

## Stable keys and offscreen item state

Whenever items can be inserted, removed, or reordered, pass a stable business ID to `items_with_key` or `items_from_iter_with_key` (only use unkeyed `items(count, ...)` when the index itself is the item's identity). Remember two closure rules:

- Key provider closures run as ordinary Rust code; item builder closures are Tessera build closures.
- Both closures are stored in props, so their captures must be owned and `'static` (UI-thread-local types are fine).

By default (`keep_composed_items(false)`), items that scroll far out of the viewport are unmounted, so any `remember` state inside an item component resets when it scrolls back in. You can pass `.keep_composed_items(true)` to retain visited items until the list itself unmounts (trading memory for preservation), though the idiomatic pattern is to hoist durable data (checkbox state, drafts) into a `State` or `Model` owned outside the list.

## Controlling scroll position

Create and `remember` a `LazyListController` to jump or inspect scroll state from outside the list:

```rust
use tessera_components::{
    column::column,
    md3::{
        button::button,
        lazy_list::{LazyListController, lazy_column},
        text::text,
    },
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, remember, tessera};

#[tessera]
fn history() {
    let list = remember(LazyListController::new);
    column().children(move || {
        button()
            .on_click(move || list.with_mut(|list| list.scroll_to_item(0, Dp(0.0))))
            .child(|| text("Back to top"));
        lazy_column()
            .modifier(Modifier::new().fill_max_width().height(Dp(320.0)))
            .controller(list)
            .items(200, |index| text(format!("Entry {index}")));
    });
}
```

`scroll_to_item(index, offset)` jumps to an item at `offset` from the viewport start (out-of-range indices are ignored), and `scroll_to(x, y)` scrolls by content offset.

## Grids, staggered grids, and pagers

For multi-column or multi-row layouts, use `lazy_vertical_grid()` (configuring `.columns(...)`) or `lazy_horizontal_grid()` (configuring `.rows(...)`) with `GridCells`:

```rust
use tessera_components::md3::{
    lazy_grid::{GridCells, lazy_vertical_grid},
    text::text,
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, tessera};

#[tessera]
fn photo_grid() {
    lazy_vertical_grid()
        .modifier(Modifier::new().fill_max_size())
        .columns(GridCells::adaptive(Dp(160.0)))
        .main_axis_spacing(Dp(8.0))
        .cross_axis_spacing(Dp(8.0))
        .items(60, |index| text(format!("Photo {index}")));
}
```

- `GridCells::adaptive(min_size)`: fits as many columns/rows of at least `min_size` as available space allows.
- `GridCells::fixed(count)`: fixes an exact lane count.
- `GridCells::fixed_size(size)`: fixes each cell's cross-axis extent.

For uneven-height masonry layouts, use `lazy_vertical_staggered_grid()` or `lazy_horizontal_staggered_grid()`. For full-page swipeable views with snapping, use `horizontal_pager()` or `vertical_pager()` paired with `PagerController`.

## Next steps

See [Text and text input](/guide/text) to style text and wire up editable fields, or check the [component API reference](https://tessera-ui.github.io/tessera/tessera_components/) for full controller methods.
