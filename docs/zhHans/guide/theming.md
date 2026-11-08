---
title: Material 3 主题
description: 为应用提供统一的 Material 3 配色、字体层级和形状，并在自己的组件里使用它们。
---

# Material 3 主题

标准组件遵循 Material 3 Expressive，颜色、字体和形状全部来自同一个主题。在根部设置一次主题，自定义组件也使用其中的角色，你写的界面就能和内置控件保持一致，并跟着它们一起在浅色与深色之间切换。

`material_theme()` 为一棵子树提供主题。把它放在应用 UI 的最外层：

```rust
use tessera_components::{
    column::column, modifier::ModifierExt as _, text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_ui::{Color, Dp, Modifier, tessera, use_context};

#[tessera]
fn app() {
    material_theme()
        .theme(|| MaterialTheme::from_seed(Color::from_rgb(0.4, 0.3, 0.6), false))
        .child(|| themed_panel());
}
```

这是应用的根组件，完整的应用还需要一个入口。应用的 `EntryPoint` 还要注册 `ComponentsPackage`，才能装上组件的渲染和平台依赖，参见[应用入口与窗口](/zhHans/guide/app)。这里渲染的 `themed_panel` 在下文“使用颜色角色”一节给出。

## 选择配色

`MaterialTheme` 包含三部分：`color_scheme`、`typography` 和 `shapes`。大多数应用从一个种子色开始：`MaterialTheme::from_seed(seed, is_dark)` 根据线性 sRGB `Color` 派生出完整的浅色或深色配色，排版和形状保持默认；第二个参数传 `true` 得到深色配色。

需要更多控制时，可以自己构建 `MaterialColorScheme`（`MaterialColorScheme::light_from_seed` 和 `dark_from_seed` 是不错的起点），再传给 `MaterialTheme::from_color_scheme(scheme)`。`MaterialTheme` 是普通结构体，也可以直接替换它的 `typography` 或 `shapes` 字段。

不设置 `theme` 时，`material_theme()` 提供 `MaterialTheme::default()`，即以 Material 基准种子色 `#6750A4` 生成的浅色配色。

## 支持深色主题

主题不会自己跟随操作系统的深色模式。用哪种外观由应用决定，主题生成函数读取这个决定：

```rust
use tessera_components::button::button;
use tessera_ui::remember;

#[tessera]
fn appearance_picker() {
    let dark = remember(|| false);
    material_theme()
        .theme(move || {
            MaterialTheme::from_seed(Color::from_rgb(0.4, 0.3, 0.6), dark.get())
        })
        .child(move || {
            button()
                .on_click(move || dark.with_mut(|value| *value = !*value))
                .child(|| text("Change appearance"));
        });
}
```

生成函数在重建时运行并读取当前状态，主题的值变化后，使用主题的后代会随之更新。像上面这样在生成函数内部读取状态，主题才会持续响应变化；在外面读取一次再捕获进去的值只是一份固定的快照。原因见[状态](/zhHans/guide/state)。

嵌套的 `material_theme()` 只覆盖自己后代的主题，适合用来做另一套配色的预览之类的场景。兄弟组件仍使用外层主题，嵌套的主题本身也不绘制背景。

## 使用颜色角色

在组件里用 `use_context::<MaterialTheme>()` 读取最近的主题。下面就是第一个示例中的 `themed_panel`：

```rust
#[tessera]
fn themed_panel() {
    let theme = use_context::<MaterialTheme>()
        .expect("themed_panel requires material_theme")
        .get();
    let scheme = &theme.color_scheme;

    column()
        .modifier(
            Modifier::new()
                .background_with_shape(scheme.surface_container, theme.shapes.medium)
                .padding_all(Dp(16.0)),
        )
        .children(move || {
            text("Documents")
                .style(theme.typography.title_medium)
                .color(theme.color_scheme.on_surface);
        });
}
```

颜色角色是成对设计的：一个填充色，加上一个专门放在它上面的内容色。成对使用，文字在浅色和深色配色下才都清晰可读。

| 用途 | 填充 | 内容 |
| --- | --- | --- |
| 突出的操作 | `primary` | `on_primary` |
| 强调容器 | `primary_container` | `on_primary_container` |
| 普通表面 | `surface` 或 `surface_container` | `on_surface` |
| 错误状态 | `error_container` | `on_error_container` |
| 反色表面 | `inverse_surface` | `inverse_on_surface` |

描边用 `outline` 或 `outline_variant`，表面上较次要的内容用 `on_surface_variant`。`content_color_for(background, &scheme)` 会为配色中能识别的填充色返回对应的内容色，遇到无关颜色则返回 `None`；它不是通用的对比度计算器。

文字和图标会继承父级的 `ContentColor`，什么都没设置时，普通文字回退到 `on_surface`。不过 `background` 修饰符不会提供内容色，`surface()` 才会：如果填充色属于当前配色，它会把对应的内容角色传给子组件。所以下面的文字会自动以 `on_primary_container` 绘制：

```rust
use tessera_components::surface::{SurfaceStyle, surface};

#[tessera]
fn backup_banner() {
    let scheme = use_context::<MaterialTheme>()
        .expect("backup_banner requires material_theme")
        .get()
        .color_scheme;
    surface()
        .style(SurfaceStyle::Filled {
            color: scheme.primary_container,
        })
        .child(|| {
            text("Backup complete").modifier(Modifier::new().padding_all(Dp(16.0)));
        });
}
```

如果填充色不属于配色，`surface` 会沿用继承的内容色，这时请显式设置它的 `content_color`。

## 排版

主题的 `typography` 是一套 `MaterialTypography` 层级，包含 display、headline、title、body 和 label 五类角色，各有三个尺寸。组件会从中选用自己的角色，所以在主题里修改某个角色，所有用到它的组件都会跟着变。如何应用角色、如何覆盖单个样式，见[文本与文本输入](/zhHans/guide/text)。

## 形状

`MaterialShapes` 提供一组共享的圆角角色：`extra_small`、`small`、`medium`、`large`、`large_increased` 和 `extra_large`。同一个表面的填充、描边、阴影和裁剪应复用同一个 `Shape`，边缘才能对齐。带形状的背景只负责绘制；要把溢出的子组件限制在形状内，再加上 `clip_shape`。

下面的片段在组件内部运行，假定已经读取了 `theme` 上下文：

```rust
use tessera_components::modifier::ShadowArgs;

let shape = theme.shapes.large;
let panel = Modifier::new()
    .shadow(
        &theme.color_scheme,
        &ShadowArgs { elevation: Dp(3.0), shape, ..Default::default() },
    )
    .background_with_shape(theme.color_scheme.surface_container, shape)
    .border_with_shape(Dp(1.0), theme.color_scheme.outline_variant, shape)
    .clip_shape(shape)
    .padding_all(Dp(16.0));
```

把 `panel` 传给容器的 `modifier`。显式的 `clip_shape` 把后代限制在共享形状内；阴影放在这个裁剪之外，才能延伸到表面以外。裁剪改变的是绘制和命中测试的边界，测量结果保持不变。这些调用的顺序为什么重要，见[修饰符](/zhHans/guide/modifiers)。

## Material 3 Expressive 组件

组件库涵盖操作、选择、编辑、导航和反馈等控件，以及把它们组合成界面的布局容器和控制器。它们都从共享主题读取颜色、排版、形状和交互的默认值。

任务与某个标准组件的行为相符时，先用这个组件，再覆盖它暴露的属性。大致的分工是：子树范围的策略用主题覆盖，单个组件用组件的设置方法，节点局部的布局或绘制用修饰符。选中、禁用或焦点行为请使用控件自身的状态，背景修饰符只负责绘制。

[组件 API 参考](https://tessera-ui.github.io/tessera/tessera_components/)介绍每个组件的参数与默认值，[在线示例](https://tessera-ui.github.io/tessera/example/)展示它们的外观和交互。本手册讲的是使用方式，各个控件的细节见参考文档。

## 玻璃材质

`fluid_glass()` 会采样它后方的场景，绘制带色调和折射的表面。它是背景采样材质，呈现效果取决于后方的内容，所以要放在后方有内容可显示的位置，并检查前景在明暗区域上的对比度。

```rust
use tessera_components::fluid_glass::{GlassMaterial, fluid_glass};

#[tessera]
fn glass_label() {
    fluid_glass()
        .material(GlassMaterial::Regular)
        .padding(Dp(16.0))
        .child(|| text("Content on glass"));
}
```

和其他组件一样，它也应放在应用主题之下。`GlassMaterial::Regular` 呈现磨砂效果；`Clear` 保留更多背景的色彩和对比度；`Custom` 提供折射透镜，但不带默认的模糊和色调调整。`appearance` 可以覆盖主题的浅色或深色处理，`blur_radius` 覆盖材质的模糊半径，设为零则关闭背景模糊。

形状、色调、光学效果和输入配置见[玻璃材质参考](https://tessera-ui.github.io/tessera/tessera_components/fluid_glass/index.html)，[在线示例](https://tessera-ui.github.io/tessera/example/)中也有玻璃效果展示。自定义的场景采样效果必须声明采样边界，相关约定见[绘制与着色器](/zhHans/guide/drawing)。
