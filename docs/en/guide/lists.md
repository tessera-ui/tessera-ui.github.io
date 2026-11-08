---
title: Lists and scrolling
description: Scroll content that does not fit, and show long collections with lazy lists and grids.
---

# Lists and scrolling

Many screens show more content than fits in the window: a settings page, a chat history, a photo library. For a modest amount of content you can make an ordinary column scroll. For long or unbounded collections, lazy lists and grids build only the items you can see, so the cost of a screen stays proportional to the viewport rather than to the data.

The examples on this page need a `material_theme()` ancestor, and the application has to register `ComponentsPackage`.

## Make content scrollable

A scroll modifier wraps its content in a viewport. Keep the `ScrollableController` with `remember` so the scroll position survives rebuilds:

```rust
use tessera_components::{
    column::column, modifier::ModifierExt as _, scrollable::ScrollableController,
    text::text,
};
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

Use `horizontal_scroll` for horizontal content, or `scroll(controller, vertical, horizontal)` to choose both axes. Scrolled content is clipped to its viewport.

A scrolling column still builds all forty lines on every rebuild. That suits a form or a page of text; for a list whose length depends on data, use a lazy list.

## Give the viewport a finite size

The viewport needs a finite size on the scrolling axis, either from its parent or from an explicit size like the `height(Dp(240.0))` above. Without one there is no edge to scroll past. The same applies to lazy lists and grids below.

::: warning
When you nest a scroll container inside another one on the same axis, give the inner viewport a bounded size. Inside a scrolling parent the scrolling axis is unbounded, so filling that axis leaves the inner container without a usable viewport.
:::

## Show long lists lazily

`lazy_column()` and `lazy_row()` only build the items inside the viewport plus the configured `overscan`. You add their content with `item`, `items` or their keyed forms:

```rust
use tessera_components::lazy_list::lazy_column;

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

`item_spacing` puts a gap between items and `content_padding` adds padding around the whole list. Lists also accept `sticky_header` declarations for section headers that stay pinned while their section scrolls.

## Give items stable keys

When items can move, be inserted or be removed, key them by a stable record identifier that is unique within the collection, as the example above does with each record's id. The key tells Tessera which item is which after the data changes; see [Lifecycle and side effects](/guide/lifecycle) for how keys give components identity.

The index-based `items(count, builder)` fits only when an item's position is its identity. `items_with_key(count, key_provider, builder)` keeps key lookup separate from rendering; the key provider is plain Rust that only computes keys, and components are called from the builder. Item builders are UI content closures, so their captures must be owned and `Send + Sync + 'static`.

### Offscreen items lose local state

A key alone does not keep an offscreen item's local state alive. When an item scrolls far enough out of view, its components are dropped, and anything it kept with `remember` starts over when it comes back. Lists default to `keep_composed_items(false)`. Setting `keep_composed_items(true)` keeps the state of every visited item until the list unmounts, which can increase memory use.

The usual answer is to keep data that has to last, such as a checkbox's value or a draft reply, in state owned outside the individual item components and pass it in. See [State](/guide/state) for hoisting.

## Control the scroll position

To read or change a lazy list's position from outside, create a `LazyListController`, keep it with `remember` and pass it to the list. Here a button scrolls back to the first entry:

```rust
use tessera_components::{button::button, lazy_list::LazyListController};

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

`scroll_to_item(index, offset)` reveals an item at an offset from the viewport start and ignores indices outside the list. `scroll_to(x, y)` scrolls to content offsets instead. The controller owns the scroll position and measurement caches, so keeping the controller around preserves them across navigation.

## Lay items out in a grid

For a tiled collection, use `lazy_vertical_grid()` and describe its columns with `GridCells`. The adaptive form fits as many columns of at least the given width as the space allows:

```rust
use tessera_components::lazy_grid::{GridCells, lazy_vertical_grid};

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

`fill_max_size` gives the grid a bounded viewport only if its parent has a finite height. `GridCells::fixed(3)` sets a fixed number of columns, and `GridCells::fixed_size(Dp(160.0))` sets a fixed cell size on the cross axis. `lazy_horizontal_grid()` uses `rows(...)` instead. For masonry layouts with variable-size tiles, use `lazy_vertical_staggered_grid()` or `lazy_horizontal_staggered_grid()`.

The [lazy list](https://tessera-ui.github.io/tessera/tessera_components/lazy_list/index.html), [lazy grid](https://tessera-ui.github.io/tessera/tessera_components/lazy_grid/index.html) and [staggered grid](https://tessera-ui.github.io/tessera/tessera_components/lazy_staggered_grid/index.html) references document their controllers and item declarations.
