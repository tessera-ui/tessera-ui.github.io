---
title: 修饰符
description: 认识各类 Modifier 扩展 trait，并理解链式顺序如何决定尺寸、绘制与点击区域。
---

# 修饰符

`Modifier` 用来给任意组件附加尺寸、内边距、背景、裁剪、点击、焦点或无障碍语义，而不用为每种组合都包装一个新容器。用 `Modifier::new()` 起头，按生效顺序往后接，最后传给组件的 `.modifier(...)` 就行。

比如用一条链做出带圆角背景和内边距的标签：

```rust
use tessera_components::{md3::{text::text, theme::MaterialTheme}, modifier::ModifierExt as _};
use tessera_foundation::modifier::ModifierExt as _;
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

## 修饰符方法分布在哪里

`Modifier` 类型本身定义在 `tessera_ui`（同时带有 `on_layout_size_changed` 等几何观察固有方法），各类链式扩展方法按职责分在几个 trait 里：

| Trait | 提供的能力 |
| --- | --- |
| `tessera_foundation::modifier::ModifierExt` | 尺寸与约束（`size`、`width`、`height`、`fill_max_*`、`required_*`、`size_in`、`constrain`）、`padding*`、`offset`、`alpha`、`clip_to_bounds`、`clip_shape`、`weight`、`align`、`window_insets_*`、`draggable`、`block_touch_propagation`、`window_drag_region`、`semantics`、`clear_and_set_semantics` |
| `tessera_components::modifier::ModifierExt` | 基础绘制与状态交互修饰符：`background*`、`border*`、`clickable`、`toggleable`、`selectable` |
| `tessera_components::md3::modifier::ModifierExt` | Material 滚动与高度阴影：`vertical_scroll`、`horizontal_scroll`、`scroll`、`shadow` |
| `tessera_ui::modifier::FocusModifierExt` | 焦点与几何位置观察：`focusable`、`focus_requester`、`focus_properties`、`preferred_tab_stop`、`focus_group`、`focus_scope`、`focus_restorer`、`focus_traversal_policy`、`on_focus_changed`、`on_globally_positioned*`、`on_layout_coordinates`、`on_local_to_window` |
| `tessera_ui::modifier::CursorModifierExt` | 鼠标悬停光标 `hover_cursor_icon` |

导入这些扩展 trait 时推荐用 `as _`（例如 `use tessera_foundation::modifier::ModifierExt as _; `）。如果私有的 `use` 绑定了从未按名字提过的扩展 trait 名，`cargo tessera check` 会给出 `tessera::named_modifier_ext_import` 警告（`cargo tessera fix` 可以自动改成 `as _`）。

## 顺序决定最终效果

链上的每次调用都包住它后面的内容，**从外向内**生效：第一个修饰符接父级传来的约束，最后一个离组件内容最近。调换顺序，结果往往截然不同。

对比这两条尺寸和内边距的链：

```rust
let outside = Modifier::new()
    .padding_all(Dp(12.0))
    .size(Dp(120.0), Dp(48.0));

let inside = Modifier::new()
    .size(Dp(120.0), Dp(48.0))
    .padding_all(Dp(12.0));
```

空间够用时，`outside` 是在 120 × 48 dp 的内容外再包一圈 12 dp 内边距，总尺寸 144 × 72 dp；`inside` 先把整体定死成 120 × 48 dp，再往里扣掉四边 12 dp，内容区只剩 96 × 24 dp。多次设置尺寸也一样，外层的精确尺寸会限制里面的大小请求。

绘制和命中测试也严格取修饰符所在那一层的边界：

```rust
let padded_surface = Modifier::new()
    .background(Color::WHITE)
    .padding_all(Dp(12.0));

let content_surface = Modifier::new()
    .padding_all(Dp(12.0))
    .background(Color::WHITE);
```

`padded_surface` 会连同 12 dp 内边距一起涂白；`content_surface` 只涂里面内容那一块，外圈保持透明。同理，把 `clickable` 写在 `padding_all` 前面，内边距区域也能点中。

## 常用修饰符速览

### 尺寸、内边距与偏移

- `width`、`height`、`size`：在父级允许的约束内请求精确尺寸。
- `size_in(min_w, max_w, min_h, max_h)` / `constrain(...)` / `default_min_size(...)`：设置尺寸上下限区间。
- `fill_max_width`、`fill_max_height`、`fill_max_size`：占满父级给出的有限最大值。
- `required_width`、`required_height`、`required_size`：无视父级约束，让内容按指定尺寸撑开（允许溢出）。
- `padding_all`、`padding_symmetric`、`padding(Padding::new(left, top, right, bottom))`：在当前位置向内留白。
- `offset(x, y)`：只移动放置坐标，不改变测量占位，也不影响兄弟元素。

### 绘制与裁剪

- `background` / `background_with_shape`：在后续内容背后画填充色。
- `border` / `border_with_shape`：在后续内容上方画描边，不额外占布局空间。
- `shadow(&scheme, &ShadowArgs { .. })`：按 Material 配色方案绘制高度阴影。
- `clip_shape(shape)` / `clip_to_bounds()`：限制后代的绘制和命中范围，不改变测量尺寸。注意 `background_with_shape` 只管填色不负责裁剪，要让子内容也按圆角切掉，需要再挂一个同形状的 `clip_shape(shape)`。
- `alpha(value)`：把整棵子树的绘制不透明度乘以给定系数。它**不会**先合成独立离屏图层再统一淡出，重叠元素各自混合；并且透明节点依然照常参与布局、焦点和语义。

### 交互与语义

- `clickable`、`toggleable`、`selectable`、`draggable` 把指针、键盘激活、水波纹和语义串在一起，见[手势、交互与焦点](/zhHans/guide/interaction)。
- `semantics` 和 `clear_and_set_semantics` 用来挂载或覆盖无障碍元数据，见[语义与无障碍](/zhHans/guide/accessibility)。

## 复用与在自定义组件里暴露 `modifier`

`Modifier` 是个普通的 `Clone` 值，构造和克隆都很轻，节点状态直到构建挂载进节点时才分配。你可以把它存进变量、克隆后继续追加，或者用 `.then(other)` 拼上另一段链。

写自己的可复用组件时，留一个 `modifier: Option<Modifier>` 参数，并把调用方传入的链放在最前面：

```rust
use tessera_components::{md3::{text::text, theme::MaterialTheme}, modifier::ModifierExt as _, row::row};
use tessera_foundation::modifier::ModifierExt as _;
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

把调用方的 `modifier` 接在最外头，外面传进来的外边距和定位就会自然包裹住组件自己的背景和内边距。

## 封装自己的修饰符扩展

一组修饰符搭配用得频繁了，可以给 `Modifier` 写个扩展 trait 起个业务名字：

```rust
use tessera_components::{md3::theme::MaterialTheme, modifier::ModifierExt as _};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, tessera, use_context};

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

如果内置修饰符满足不了需求，就需要实现 `LayoutModifier`、`DrawModifierNode` 等底层节点 trait，再用 `tessera_ui::modifier::ModifierCapabilityExt` 封装进扩展方法里。具体写法见[自定义布局与局部坐标](/zhHans/guide/custom-layout)与[自定义绘制与着色器](/zhHans/guide/drawing)。

## 下一步

继续看[Material 3 主题与视觉样式](/zhHans/guide/theming)，了解上面用到的 `color_scheme`、`shapes` 和主题上下文是怎么配出来的。
