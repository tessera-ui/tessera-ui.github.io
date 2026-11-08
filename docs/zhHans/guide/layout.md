---
title: 布局基础
description: 用行、列、盒子和流式容器排列组件，并让界面避开系统区域。
---

# 布局基础

界面是把组件嵌套进几种标准容器搭出来的。每种容器只负责一种排列方式：水平、垂直、叠放或换行，组合起来就能得到想要的结构。单个内容要占多大空间，再交给修饰符调整。

本页示例都需要放在 `material_theme()` 下，应用入口还要注册 `ComponentsPackage`。参见 [Material 3 主题](/zhHans/guide/theming)和[应用入口与窗口](/zhHans/guide/app)。

## 标准容器

`row()` 把子组件水平依次排开，`column()` 垂直排开，`boxed()` 则把它们叠在一起。比如一条消息预览，就是一个行里放头像和一个两行文字的列：

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

容器通过 `children` 闭包接收子组件，所以放什么、放几个，可以直接用 `if`、`for` 这些普通的 Rust 控制流决定。固定 `width` 的空白组件在头像和文字之间留出一段恒定的间距。

## 对齐与排列

行和列在两个方向上都默认从起点开始排列。`main_axis_alignment` 控制子组件在排列方向上的位置，可选 `Center`、`End`、`SpaceBetween`、`SpaceAround`、`SpaceEvenly` 等；`cross_axis_alignment` 控制垂直于排列方向的位置，其中 `CrossAxisAlignment::Stretch` 会把子组件拉伸到交叉轴的可用尺寸。

想让一部分子组件靠到最远端、其余留在起点，可以给空白组件设置权重。下面这个行通过修饰符占满可用宽度，带权重的空白组件吃掉两段文字之外的全部剩余空间：

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

`weight(1.0)` 是交给行列布局读取的父数据。行列会先测量没有权重的子组件，再把主轴上剩余的有限空间按正权重分给其他子组件。如果主轴没有有限最大值，就没有“剩余空间”可分，布局会直接测量子组件，不按权重分配。只有行和列会读取权重，所以它只对行列的直接子组件生效。

## 在盒子里叠放内容

`boxed().alignment(...)` 设置子组件的默认位置，子组件可以用自己的 `align(...)` 修饰符覆盖它。在预览图角落放一个标记，就是这样写的：

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

## 用流式布局自动换行

希望一行排满后自动换到下一行，就用 `flow_row()`；垂直方向对应 `flow_column()`。一组标签是最典型的场景：

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

`item_spacing` 是同一行内条目之间的间距，`line_spacing` 是行与行之间的间距。流式容器会构建所有子组件，适合数量不多的内容；内容很多时，使用[列表与滚动](/zhHans/guide/lists)里按视口构建的惰性列表。

## 间距、尺寸与偏移

`padding_all` 给四条边设置相同的内边距，`padding_symmetric(horizontal, vertical)` 分别设置水平和垂直方向。要单独设置每条边，使用 `padding(Padding::new(left, top, right, bottom))`，其中 `Padding` 从 `tessera_components::modifier` 导入。行列子组件之间需要固定间距时，插入一个带 `width` 或 `height` 的 `spacer()`；带权重的空白组件占据的则是剩余空间。

`width`、`height` 和 `size` 在父布局允许的范围内请求固定尺寸，`fill_max_width`、`fill_max_height` 和 `fill_max_size` 取父布局给出的有限最大值。修饰符从外向内生效，所以先写 `padding` 再写 `size`，和反过来写，结果并不相同。顺序规则和完整的尺寸修饰符见[修饰符](/zhHans/guide/modifiers)。

`offset(x, y)` 只移动内容的位置，父布局为它预留的尺寸保持原样，相邻组件也留在原处。如果周围的布局需要为此让出空间，使用内边距或空白组件。

## 单位与约束

内边距、控件尺寸、文字大小这类由你自己设定的尺寸，用 `Dp` 表示。`Dp(16.0)` 与屏幕密度无关，Tessera 会按当前 UI 会话的密度把它换算成物理像素。布局本身以物理像素计算：`Px` 是整数像素单位，用于约束、测量尺寸和读回数据；`PxPosition` 则允许带小数的像素位置。

布局时，父布局会给子组件一个 `Constraint`，其中包含一个宽度区间和一个高度区间。子组件在区间内选定自己的尺寸，再由父布局决定把它放在哪里。每个 `AxisConstraint` 都有一个 `Px` 最小值和一个可选的最大值。没有最大值表示该方向无上界，并不等于“和窗口一样大”。最小值与最大值相等时，尺寸就是固定的。

```rust
use tessera_ui::{AxisConstraint, Constraint, Px};

let available = Constraint::new(
    AxisConstraint::at_most(Px(640)),
    AxisConstraint::new(Px(0), Some(Px(480))),
);
let exact = Constraint::exact(Px(320), Px(240));
```

这些值是物理测量结果。大多数 UI 代码用修饰符描述尺寸，约束由父布局生成。不过“无上界”在实际中经常遇到：滚动容器里，滚动方向没有最大值，在那里用 `fill_max_height` 就无处可填。需要直接处理约束的测量代码，见[自定义布局](/zhHans/guide/custom-layout)。

## 让内容避开系统区域

在手机上或全面屏窗口里，状态栏、屏幕缺口和屏幕键盘都可能盖住窗口的一部分。占满整个窗口的界面可以交给 `scaffold` 处理：它让各个插槽避开这些区域，同时仍把背景绘制到它们下方。

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

`WindowInsets::SystemBars` 包括系统栏和屏幕缺口，`Ime` 表示停靠式屏幕键盘遮挡的区域。`SafeDrawing` 在每条边上取二者中较大的值，而不是相加。

如果你自己绘制界面边界，可以使用 `Modifier::new().window_insets_padding(WindowInsets::SafeDrawing)`。它只为祖先尚未消费的那部分安全区域添加内边距，然后把这部分空间标记为已消费，嵌套的界面对每段安全区域只留白一次。`consume_window_insets` 只做标记、不加内边距，仅在父布局已经用其他方式预留了这部分空间时使用。

`window_insets_bottom_height`、`window_insets_top_height` 等边缘辅助方法，可以让空白组件取得对应边上剩余的安全区域高度。普通的内容内边距和安全区域内边距请分开设置。应用栏和浮动内容插槽见 [`scaffold` 参考](https://tessera-ui.github.io/tessera/tessera_components/scaffold/index.html)。

## 下一步

- 内容超出屏幕时，看[列表与滚动](/zhHans/guide/lists)。
- 尺寸、顺序和视觉修饰符，看[修饰符](/zhHans/guide/modifiers)。
- 现有容器都不合适时，看[自定义布局](/zhHans/guide/custom-layout)。
