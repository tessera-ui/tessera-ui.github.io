---
title: 布局基础
description: 用行、列、盒子和流式容器编排界面，理解约束与单位，并适配系统安全区域。
---

# 布局基础

Tessera 里的界面是用几种基础容器嵌套拼出来的。每种容器只管一种排布规律——水平、垂直、叠放或自动换行；单个元素的留白和大小再交给修饰符微调。

本页代码默认跑在 `material_theme()` 之下，并在入口注册了 `ComponentsPackage`。详见[Material 3 主题与视觉样式](/zhHans/guide/theming)与[应用入口、窗口与会话](/zhHans/guide/app)。

## 标准容器

`row()` 把子组件从左往右排，`column()` 从上往下排，`boxed()` 把它们叠在一起。比如一条带头像和两行文字的消息预览，就是行套列：

```rust
use tessera_components::{
    alignment::CrossAxisAlignment,
    column::column,
    md3::text::text,
    row::row,
    spacer::spacer,
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

`children` 接收普通构建闭包，所以条件显示和循环直接写 Rust 的 `if`、`match`、`for` 就行。固定宽高的 `spacer()` 用来在相邻元素之间拉出均匀间距。

## 对齐与权重分配

行和列默认都在两个方向上靠起点对齐：

- `main_axis_alignment(...)` 控制主轴（排列方向）上的分布，可选 `Start`、`Center`、`End`、`SpaceBetween`、`SpaceAround`、`SpaceEvenly`。
- `cross_axis_alignment(...)` 控制交叉轴上的对齐，可选 `Start`、`Center`、`End`、`Stretch`。

想把行或列里的部分元素推到最远端，插入一个带权重的 `spacer()`（或者直接给子组件挂 `.weight(1.0)`）：

```rust
use tessera_components::{
    alignment::CrossAxisAlignment,
    md3::text::text,
    row::row,
    spacer::spacer,
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

`weight` 是写给父容器看的父数据。`row` 和 `column` 会先测量没有权重的子组件，再把主轴上剩下的有限空间按权重比例分给带权重的子组件。如果主轴没有上限（例如放在垂直滚动容器里），就没有“剩余空间”可分，权重不会拉伸子组件。目前只有 `row` 和 `column` 读取 `.weight(...)`。

## 在 `boxed` 里叠放元素

`boxed().alignment(...)` 设置所有子组件的默认叠放位置，个别子组件可以用 `.align(...)` 单独覆盖：

```rust
use tessera_components::{alignment::Alignment, boxed::boxed, md3::text::text};
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

## 用流式容器自动换行

一排标签放不下时希望自动折行，用 `flow_row()`；垂直折列用 `flow_column()`：

```rust
use tessera_components::{flow_row::flow_row, md3::text::text};
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

`item_spacing` 管同一行内元素之间的空隙，`line_spacing` 管行与行之间的空隙。流式容器会一次性构建所有子组件，条目数量很大时请改用[列表、网格与滚动](/zhHans/guide/lists)里的惰性容器。

## 单位与约束

Tessera 把界面设计单位和渲染物理像素分得很清楚：

- **`Dp`（密度无关像素）**：写组件尺寸、内边距、间距和字号时统一用 `Dp`。`Dp(16.0)` 会按当前窗口缩放系数自动换算。
- **`Px`（物理像素）**：测量和读回时用的整数像素；`PxPosition` 使用 `f32` 物理坐标。

测量阶段，父容器会给每个子组件传一份 `Constraint`，包含宽高两个方向上的 `AxisConstraint` 区间（下限 `min: Px` 和可选上限 `max: Option<Px>`）：

```rust
use tessera_ui::{AxisConstraint, Constraint, Px};

let available = Constraint::new(
    AxisConstraint::at_most(Px(640)),
    AxisConstraint::new(Px(0), Some(Px(480))),
);
let exact = Constraint::exact(Px(320), Px(240));
```

当 `max` 为 `None` 时，表示该方向**无上界**——比如纵向滚动容器的垂直方向。这也是为什么在纵向滚动里写 `fill_max_height()` 没法撑满窗口高度，因为父级根本没有给有限上限。当 `min == max` 时，该方向尺寸就固定死了。

## 避开系统栏与安全区域

在手机或无边框全屏窗口里，状态栏、刘海和软键盘会遮挡窗口边缘。全屏页面最省事的做法是交给 `scaffold`：

```rust
use tessera_components::md3::{scaffold::scaffold, text::text};
use tessera_ui::{WindowInsets, tessera};

#[tessera]
fn screen() {
    scaffold()
        .window_insets(WindowInsets::SafeDrawing)
        .content(|| text("Screen content"));
}
```

`WindowInsets::SystemBars` 包含系统栏和屏幕缺口，`WindowInsets::Ime` 表示软键盘遮挡区域，`WindowInsets::SafeDrawing` 则会在四条边上分别取两者较大值。

如果不用 `scaffold` 而自己搭全屏外壳，可以给根容器加上 `Modifier::new().window_insets_padding(WindowInsets::SafeDrawing)`。它只会补充祖先尚未消费的那部分边距，并把已加的边标记为已消费，嵌套子页面不会重复留白。如果父容器已经通过别的方式留出了位置，用 `consume_window_insets` 只做标记不加内边距；想直接按某条边的剩余安全高度撑开 `spacer`，可以用 `window_insets_bottom_height` 等辅助方法。

## 下一步

- 在[修饰符](/zhHans/guide/modifiers)掌握修饰符的来源和顺序规则。
- 在[列表、网格与滚动](/zhHans/guide/lists)解决内容超出屏幕与长列表性能问题。
- 需要自己写测量逻辑或缩放子树时，查阅[自定义布局与局部坐标](/zhHans/guide/custom-layout)。
