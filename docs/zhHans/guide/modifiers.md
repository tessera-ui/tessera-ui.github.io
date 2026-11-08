---
title: 修饰符
description: 通过链式调用修饰符，为组件添加尺寸、间距、绘制、交互和语义。
---

# 修饰符

修饰符用来改变某一块 UI 的布局、绘制或交互方式，在任何接受修饰符的组件上用法都一样。用 `Modifier::new()` 开始一条修饰符链，按希望生效的顺序依次追加调用，再把结果传给组件的 `modifier` setter。

下面这个徽标的背景、圆角形状和内边距都来自同一条链：

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

`Modifier` 类型来自 `tessera_ui`，而 `padding_all`、`background`、`clickable` 这类常用方法大多是 `tessera_components::modifier::ModifierExt` 提供的扩展方法，所以需要用 `as _` 引入这个 trait。焦点相关的修饰符则来自 `tessera_ui::FocusModifierExt`。读取 `MaterialTheme` 的示例需要一个 `material_theme()` 祖先，见 [Material 3 主题](/zhHans/guide/theming)。

## 顺序很重要

链上的每一次调用都会包住它后面的所有内容。修饰符从外向内生效：第一个修饰符拿到父级传来的约束，最后一个离内容最近。交换两个调用的位置，结果就可能不同。

同样的内边距和尺寸，这里得到两个不同的盒子：

```rust
let outside = Modifier::new()
    .padding_all(Dp(12.0))
    .size(Dp(120.0), Dp(48.0));

let inside = Modifier::new()
    .size(Dp(120.0), Dp(48.0))
    .padding_all(Dp(12.0));
```

在空间足够时，`outside` 在 120 × 48 的内容区四周加上 12 dp 内边距，整体是 144 × 72；`inside` 先把整体固定为 120 × 48，再从中扣除内边距，留给内容的只有 96 × 24。无论哪种写法，普通的尺寸请求仍受父级约束限制。重复的尺寸修饰符同样按从外向内的顺序生效：外层的精确尺寸会限定它内部的所有请求，内层请求因此可能完全不起作用。

绘制遵循同样的规则，因为视觉修饰符使用的是它在链中所处位置的边界：

```rust
let padded_surface = Modifier::new()
    .background(Color::WHITE)
    .padding_all(Dp(12.0));

let content_surface = Modifier::new()
    .padding_all(Dp(12.0))
    .background(Color::WHITE);
```

`padded_surface` 连内边距一起涂色；`content_surface` 外圈 12 dp 不涂色，只在内容后面填充。边框、裁剪和点击区域也是如此，所以少数几个修饰符就能组合出差别很大的设计。

## 尺寸与间距

自己选定的尺寸用 `Dp` 表示。常用的尺寸修饰符有：

- `width`、`height` 和 `size` 在传入的边界内请求精确尺寸。`size_in` 设置可选的最小值和最大值，`constrain` 直接接收 `AxisConstraint` 区间。
- `fill_max_width`、`fill_max_height` 和 `fill_max_size` 取父级的有限最大值。在无界的轴上，例如可滚动列的主轴，没有最大值可取。
- `required_width`、`required_height` 和 `required_size` 会忽略传入的约束。希望内容能够溢出父级时使用它们。
- `padding_all`、`padding_symmetric` 和 `padding(Padding::new(left, top, right, bottom))` 在修饰符的边界内留出空间。
- `offset(x, y)` 移动内容，父级为它预留的空间保持不变，相邻元素也留在原位。

有些修饰符是写给父级看的，而不是作用于节点自身。`weight(1.0)` 由行和列在分配剩余空间时读取，`align(...)` 由 `boxed()` 读取，其他父级会忽略它们。[布局基础](/zhHans/guide/layout)结合实际场景介绍了这些修饰符，也解释了什么是约束。

## 绘制

视觉修饰符在内容周围绘制，不改变内容尺寸：

- `background` 和 `background_with_shape` 绘制在内容后面，`border` 和 `border_with_shape` 在内容上方绘制描边。它们不占用空间，内容需要和描边保持距离时，另加内边距。
- `shadow(&scheme, &ShadowArgs { .. })` 根据配色方案绘制高度阴影。
- `clip_shape(shape)` 和 `clip_to_bounds()` 把后代限制在某个形状或矩形边界之内。裁剪影响绘制和命中测试，不影响测量。带形状的背景只负责涂色；要把内容裁剪成同样的形状，再加上使用该形状的 `clip_shape`。
- `alpha(value)` 把子树的不透明度乘以给定值。它不会创建独立图层，重叠的子元素不一定作为一个整体淡出。它也不表示禁用：透明内容仍然参与布局、焦点和语义。

一个表面同时使用阴影、填充、边框和裁剪时，让它们共用同一个 `Shape`，边缘才能对齐。颜色角色和形状角色来自主题，见 [Material 3 主题](/zhHans/guide/theming)。这些修饰符表达不了的绘制，见[绘制与着色器](/zhHans/guide/drawing)。

## 交互

交互修饰符让外观自定义的子树具备标准控件的行为。`clickable`、`toggleable` 和 `selectable` 把同一个动作同时连接到指针输入、键盘激活和无障碍动作，`draggable` 报告拖动位移。每个修饰符都有接收配置结构体的 `_with` 版本。

交互修饰符放在链中的哪个位置，决定了可点击区域有多大。下面这一行把点击区域放在内边距之前，内边距也属于可按下的范围：

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

正是名称和角色让键盘可以访问这个目标：处于启用状态的 `clickable` 只要带有角色、名称或描述之一，就会注册焦点目标。配置结构体、焦点和原始输入处理见[手势与交互](/zhHans/guide/interaction)。

## 语义

`semantics(SemanticsArgs { .. })` 为子树附加名称、角色、值或测试标签等无障碍元数据，布局和绘制保持不变。交互修饰符和标准控件会发布自己的语义，所以通常只在构建自定义元素、或者测试中需要稳定标签时才用到它。它所构建的语义树见[语义](/zhHans/guide/semantics)。

## 复用修饰符

`Modifier` 是普通的值：可以存进变量、克隆，再在克隆上继续追加。修饰符需要的状态在链挂载到节点时才分配，所以构造和克隆这个值的开销都很低。`then(other)` 把另一整条链追加到当前链之后。

编写自己的组件时，用可选的 `modifier` 属性接收调用方的链，并把它放在最前面。这样调用方设置的尺寸和内边距会位于组件自身装饰的外侧。

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

外侧 4 dp 的内边距排在标签背景之前，所以不会被涂色。

## 编写修饰符扩展

同一种组合反复出现时，可以在 `Modifier` 上定义扩展 trait，给它起个名字。大多数扩展只是组合现有的修饰符：

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

方法名应体现它的含义，配置参数使用自有所有权的值，并保持正常的顺序语义：扩展中的修饰符在调用所处的位置生效。

如果需要现有修饰符表达不了的行为，就要实现某个节点 trait，并通过 `tessera_ui::modifier::ModifierCapabilityExt` 挂载，例如用 `push_layout` 处理测量、用 `push_draw` 处理绘制。这些调用应封装在扩展内部，应用 UI 只调用起好名字的方法。布局节点的完整示例见[自定义布局](/zhHans/guide/custom-layout)，绘制节点见[绘制与着色器](/zhHans/guide/drawing)。

`ModifierExt` 的全部方法见[组件 API 参考](https://tessera-ui.github.io/tessera/tessera_components/modifier/index.html)。
