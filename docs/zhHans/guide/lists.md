---
title: 列表与滚动
description: 让放不下的内容可以滚动，并用惰性列表和网格展示长集合。
---

# 列表与滚动

很多界面要展示的内容都比窗口大：设置页、聊天记录、相册。内容不多时，让普通的列滚动起来就够了；集合很长或长度不定时，惰性列表和网格只构建你能看到的条目，界面的开销取决于视口大小，而不是数据量。

本页示例都需要放在 `material_theme()` 下，应用入口还要注册 `ComponentsPackage`。

## 让内容可以滚动

滚动修饰符会把内容包进一个视口。用 `remember` 保存 `ScrollableController`，滚动位置才能在重建之间保留：

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

水平内容用 `horizontal_scroll`，两个方向都要滚动时用 `scroll(controller, vertical, horizontal)`。滚动内容会被裁剪到视口范围内。

加了滚动修饰符的普通列，每次重建仍会构建全部四十行。这适合表单或一页文字；长度取决于数据的列表，请用惰性列表。

## 给视口一个有限尺寸

视口在滚动方向上必须有有限的尺寸，可以来自父布局，也可以像上面的 `height(Dp(240.0))` 那样显式指定。否则就没有可以滚过的边界。下面的惰性列表和网格也是如此。

::: warning 注意
同方向的滚动容器相互嵌套时，内层必须有有界的视口。在滚动的父容器里，滚动方向没有上界，在这个方向上“填满空间”会让内层容器得不到可用的视口。
:::

## 惰性展示长列表

`lazy_column()` 和 `lazy_row()` 只构建视口内以及 `overscan` 范围内的条目。内容通过 `item`、`items` 或对应的带键方法追加：

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

`item_spacing` 设置条目之间的间距，`content_padding` 在整个列表四周加内边距。列表还可以用 `sticky_header` 声明分组标题，让标题在本组内容滚动时固定在顶部。

## 给条目稳定的键

如果条目会移动、插入或删除，就用记录本身稳定且在集合内唯一的标识作为键，就像上例用每条记录的 id 那样。数据变化之后，Tessera 靠键分辨哪个条目是哪个；键如何决定组件身份，见[生命周期与副作用](/zhHans/guide/lifecycle)。

只有当位置本身就是条目的身份时，才适合用按索引的 `items(count, builder)`。`items_with_key(count, key_provider, builder)` 把取键和渲染分开：键提供函数是只负责计算键的普通 Rust 代码，组件在构建函数里调用；条目构建函数和键提供函数会被保存下来，捕获的值必须拥有所有权，并满足 `'static`；它们运行在 UI 线程上，不需要满足 `Send` 或 `Sync`。

### 视口外的条目会丢失局部状态

光有键，并不能让视口外条目的局部状态一直保留。条目滚出视口足够远后，它的组件会被丢弃，用 `remember` 保存的东西在它回来时会重新开始。列表默认是 `keep_composed_items(false)`；设为 `keep_composed_items(true)` 后，访问过的条目状态会一直保留到列表卸载，内存占用也可能随之增加。

更常见的做法是把需要长期保存的数据，比如复选框的值或一段草稿，放到条目组件之外的状态里，再传给条目。状态提升见[状态](/zhHans/guide/state)。

## 控制滚动位置

想在列表外部读取或改变惰性列表的位置，就创建一个 `LazyListController`，用 `remember` 保存后传给列表。下面的按钮让列表滚回第一条：

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

`scroll_to_item(index, offset)` 把条目显示在距视口起点 `offset` 的位置，超出列表范围的索引会被忽略；`scroll_to(x, y)` 则按内容偏移滚动。滚动位置和测量缓存都由控制器保存，保留这个控制器，这些数据就能跨导航保留。

## 用网格排列条目

平铺的集合用 `lazy_vertical_grid()`，并用 `GridCells` 描述列。自适应写法会在空间允许的范围内，放下尽可能多宽度不小于给定值的列：

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

只有父布局的高度有限时，`fill_max_size` 才能给网格一个有界的视口。`GridCells::fixed(3)` 固定列数，`GridCells::fixed_size(Dp(160.0))` 固定交叉轴上的单元格尺寸。`lazy_horizontal_grid()` 改用 `rows(...)`。尺寸不一的瀑布流布局，可以用 `lazy_vertical_staggered_grid()` 或 `lazy_horizontal_staggered_grid()`。

控制器和条目声明的完整说明，见[惰性列表](https://tessera-ui.github.io/tessera/tessera_components/lazy_list/index.html)、[惰性网格](https://tessera-ui.github.io/tessera/tessera_components/lazy_grid/index.html)和[瀑布流网格](https://tessera-ui.github.io/tessera/tessera_components/lazy_staggered_grid/index.html)的 API 参考。
