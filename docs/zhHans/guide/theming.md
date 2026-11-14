---
title: Material 3 主题与视觉样式
description: 用 material_theme 为应用统一提供配色、排版和圆角形状，支持浅色/深色切换与玻璃材质。
---

# Material 3 主题与视觉样式

`tessera-components` 里的标准控件都遵循 Material 3 Expressive 规范，颜色、字号、圆角和交互态透明度都从同一份 `MaterialTheme` 里取。只要在根部挂好主题、自定义组件也跟着读取里面的角色，整套界面就能天然协调，切深色模式也不用挨个组件手改颜色。

把 `material_theme()` 放在界面树最外层：

```rust
use tessera_components::{
    column::column,
    md3::{
        text::text,
        theme::{MaterialTheme, material_theme},
    },
    modifier::ModifierExt as _,
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Color, Dp, Modifier, tessera, use_context};

#[tessera]
fn app() {
    material_theme()
        .theme(|| MaterialTheme::from_seed(Color::from_rgb(0.4, 0.3, 0.6), false))
        .child(|| themed_panel());
}
```

别忘了在 `EntryPoint` 上继续注册 `ComponentsPackage`：`ComponentsPackage` 负责装渲染管线和平台服务，`material_theme()` 负责往下传递设计 Token 上下文。

## 生成与定制配色

`MaterialTheme` 包含三部分：`color_scheme`、`typography` 和 `shapes`。

最省事的起手方式是 `MaterialTheme::from_seed(seed, is_dark)`，传入一个线性 sRGB `Color` 种子色和是否深色模式，就能算出一整套配色，排版和形状保持默认。如果不调用 `.theme(...)`，`material_theme()` 会使用 `MaterialTheme::default()`（以 `#6750A4` 为种子的浅色方案）。

需要更细致地微调时，可以先用 `MaterialColorScheme::light_from_seed` 或 `dark_from_seed` 算出配色，传入 `MaterialTheme::from_color_scheme(scheme)`，再替换里面的 `typography` 或 `shapes`。

## 切换浅色与深色模式

Tessera 不会私自跟随系统外观自动切色。把当前选择放进状态里，并在 `.theme(...)` 闭包内部读取它：

```rust
use tessera_components::md3::{
    button::button,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_ui::{Color, remember, tessera};

#[tessera]
fn appearance_picker() {
    let dark = remember(|| false);
    material_theme()
        .theme(move || MaterialTheme::from_seed(Color::from_rgb(0.4, 0.3, 0.6), dark.get()))
        .child(move || {
            button()
                .on_click(move || dark.with_mut(|value| *value = !*value))
                .child(|| text("Change appearance"));
        });
}
```

`.theme(...)` 在 `material_theme` 构建期间执行，因此在里面调 `dark.get()` 会建立订阅；一旦 `dark` 变化，`material_theme` 就会发布新主题，所有读过主题的后代组件跟着刷新。局部区域需要换一套配色（比如预览卡片）时，直接再嵌一层 `material_theme()` 即可，它只影响自己包住的子树。

## 成对使用颜色角色与 `ContentColor`

在子孙组件里调用 `use_context::<MaterialTheme>()` 取出当前主题：

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

Material 的颜色角色是成对设计的，确保浅色和深色下文字都看得清：

| 用途 | 背景/填充色 | 内容/前景文字色 |
| --- | --- | --- |
| 主按钮/重点操作 | `primary` | `on_primary` |
| 强调容器 | `primary_container` | `on_primary_container` |
| 常规表面 | `surface` / `surface_container` | `on_surface` |
| 错误提示容器 | `error_container` | `on_error_container` |
| 反色提示 | `inverse_surface` | `inverse_on_surface` |

边框常用 `outline` 或 `outline_variant`，次要说明文字用 `on_surface_variant`。

`text` 和 `icon` 会自动从上下文读取 `ContentColor`（取不到则退回到 `on_surface`）。这里要注意区分 `Modifier::background` 和 `surface()` 组件：`background` 修饰符只管涂颜色，而 `surface()` 会通过 `content_color_for(fill, &scheme)` 自动把配套的 `ContentColor` 提供给子组件。所以下面这段文字会自动用上 `on_primary_container`：

```rust
use tessera_components::md3::{
    surface::{SurfaceStyle, surface},
    text::text,
    theme::MaterialTheme,
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, tessera, use_context};

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

如果传给 `surface()` 的是自定义颜色（不在主题配色表里），记得顺手指定 `.content_color(...)`。

## 排版与共享圆角形状

`theme.typography` 提供了五套字级角色（`display`、`headline`、`title`、`body`、`label`），每套都有 `large`、`medium`、`small`，还可以调用 `.emphasized()` 获取强调排版。文本样式细节见[文本与文本输入](/zhHans/guide/text)。

`theme.shapes` 提供了一组圆角 token（`extra_small`、`small`、`medium`、`large`、`large_increased`、`extra_large`）。当一个容器同时用到阴影、背景填充、边框和内容裁剪时，让这四者共用同一个 `Shape`，边缘才能严丝合缝：

```rust
use tessera_components::{
    md3::{
        modifier::{ModifierExt as _, ShadowArgs},
        theme::MaterialTheme,
    },
    modifier::ModifierExt as _,
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier};

fn panel_modifier(theme: &MaterialTheme) -> Modifier {
    let shape = theme.shapes.large;
    Modifier::new()
        .shadow(
            &theme.color_scheme,
            &ShadowArgs {
                elevation: Dp(3.0),
                shape,
                ..Default::default()
            },
        )
        .background_with_shape(theme.color_scheme.surface_container, shape)
        .border_with_shape(Dp(1.0), theme.color_scheme.outline_variant, shape)
        .clip_shape(shape)
        .padding_all(Dp(16.0))
}
```

注意 `shadow(...)` 写在 `clip_shape(shape)` 外面：阴影才能向轮廓外扩散，而里面的子内容会被干净地裁在圆角以内。

## 玻璃材质（`experiment::hig::glass`）

`tessera_components::experiment::hig::glass::glass()` 会采样它背后已经画好的场景像素，叠加模糊、色调和边缘折射：

```rust
use tessera_components::{
    experiment::hig::glass::{GlassMaterial, glass},
    md3::text::text,
};
use tessera_ui::{Dp, tessera};

#[tessera]
fn glass_label() {
    glass()
        .material(GlassMaterial::Regular)
        .padding(Dp(16.0))
        .child(|| text("Content on glass"));
}
```

- `GlassMaterial::Regular`：磨砂质感，与背景区分更明显。
- `GlassMaterial::Clear`：更通透，保留较多背景色彩和对比度。
- `GlassMaterial::Custom`：只保留折射透镜，不套默认的模糊与调色参数。

可以通过 `appearance` 显式指定浅色（`GlassAppearance::Light`，默认）或深色处理，或用 `blur_radius(Dp(0.0))` 关掉背景模糊。由于它会读取背后像素，使用前确保它下方有内容可透出，并留意文字在亮/暗背景下的可读性。

## 下一步

继续看[列表、网格与滚动](/zhHans/guide/lists)来排布长列表和网格，或者去[组件 API 参考](https://tessera-ui.github.io/tessera/tessera_components/)和[在线示例](https://tessera-ui.github.io/tessera/example/)浏览全部内置控件。
