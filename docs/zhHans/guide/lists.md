---
title: 列表、网格与滚动
description: 为有限容器加上滚动、使用惰性列表与网格虚拟化长集合，并控制滚动位置。
---

# 列表、网格与滚动

当内容超出视口时，较小的固定表单可以直接用滚动修饰符包住 `column`。面对长列表或长度不定的集合，使用 Tessera 的惰性列表和惰性网格——它们只构建视口内可见的条目，帧耗时只和屏幕大小有关，与总条目数无关。

本页示例均假设外层存在 `material_theme()`，且入口已注册 `ComponentsPackage`。

## 可滚动容器

为容器挂上滚动修饰符，并用 `remember` 保存 `ScrollableController`，让滚动偏移在重建间保持不变：

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

横向滚动使用 `horizontal_scroll(controller)`，双向滚动使用 `scroll(controller, vertical, horizontal)`。超出视口的内容会被自动裁剪。

注意必须显式设置 `.height(Dp(240.0))`：滚动视口沿滚动轴必须有有限上界（由父级或尺寸修饰符提供）。同时要注意，普通的 `column` 加 `vertical_scroll` 每次重建仍会构建全部 40 行，适合设置表单或短文，不适合长信息流。

::: warning 避免同轴嵌套 `fill_max_height`
在纵向滚动容器内部，传入的高度约束无上界（`max == None`）。切勿直接把只写 `fill_max_height()` 的子滚动容器嵌套其中；请为内层滚动容器指定有限高度。
:::

## 惰性列表：`lazy_column` 与 `lazy_row`

`lazy_column()` 和 `lazy_row()` 只构建可见条目外加少量 `overscan` 预载范围，通过 `item`、`items`、`items_from_iter_with_key` 与 `sticky_header` 追加内容：

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

`item_spacing` 控制条目间距，`content_padding` 设置视口内边距，`sticky_header` / `sticky_header_with_key` 可将分组标题吸顶。

## 稳定的 key 与视口外状态

只要集合会插入、删除或重排，请向 `items_with_key` 或 `items_from_iter_with_key` 传入稳定的业务 ID（仅当下标即唯一身份时才用无 key 的 `items(count, ...)`）：

- key 提取闭包运行在普通 Rust 上下文；条目构建闭包是 Tessera 构建闭包。
- 两者都会存进属性中，捕获的变量需拥有所有权且满足 `'static`（UI 线程本地类型即可）。

默认（`keep_composed_items(false)`）下，滚出视口较远的条目会被卸载，条目内的 `remember` 状态随之重置；虽可设 `.keep_composed_items(true)` 以内存换保留，但更推荐把持久数据（勾选态、草稿）提升到列表之外的 `State` 或 `Model` 中。

## 控制滚动位置

`remember` 一个 `LazyListController` 即可从列表外部跳转或读取滚动位置：

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

`scroll_to_item(index, offset)` 将指定条目滚动到距离视口起点 `offset` 处（越界索引自动忽略），`scroll_to(x, y)` 则按内容偏移滚动。

## 网格、瀑布流与翻页器

多列或网格布局使用 `lazy_vertical_grid()`（配置 `.columns(...)`）或 `lazy_horizontal_grid()`（配置 `.rows(...)`），搭配 `GridCells`：

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

- `GridCells::adaptive(min_size)`：在可用空间内尽可能多排，每列/行不少于 `min_size`。
- `GridCells::fixed(count)`：固定列数或行数。
- `GridCells::fixed_size(size)`：固定交叉轴单元格尺寸。

不定高瀑布流使用 `lazy_vertical_staggered_grid()` 或 `lazy_horizontal_staggered_grid()`；整页吸附滑动视图使用 `tessera_components::pager::{horizontal_pager, vertical_pager}` 配合 `PagerController`。

## 下一步

继续阅读[文本与文本输入](/zhHans/guide/text)了解字体排版与输入框控制，完整控制器方法见[组件 API 参考](https://tessera-ui.github.io/tessera/tessera_components/)。
