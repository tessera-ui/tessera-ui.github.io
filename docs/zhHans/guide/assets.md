---
title: 资源、图片与字体
description: 通过 tessera-build 管理图片、图标、字体与数据文件，并在所有平台统一加载。
---

# 资源、图片与字体

把静态资源放进项目资源目录后，`tessera-build` 会在编译期把它们生成为 `crate::res` 下的强类型常量。路径写错会直接编译失败，同一个 `Asset` 常量在嵌入分发和平台按需分发两种模式下都能正常加载。

```rust
use tessera_components::image::image;
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, tessera};

use crate::res;

#[tessera]
fn logo() {
    image()
        .painter(res::images::LOGO_SVG)
        .modifier(Modifier::new().size(Dp(96.0), Dp(96.0)));
}
```

## 配置 `tessera-config.toml`

在包根目录的 `tessera-config.toml` 中开启资源收集：

```toml
[assets]
dir = "assets"
embed = ["images/logo.svg"]

[assets.tree_shaking]
exclude = ["runtime/**"]
```

- `dir`：资源目录路径（存在 `[assets]` 节时默认为 `assets`）。
- `embed`：即便使用 `--asset-backend platform` 构建，也始终直接内嵌进二进制的文件列表（相对 `dir`）。
- `tree_shaking.exclude`：按 glob 保留资源，防止平台打包裁剪时把动态拼接引用的文件删掉。

目录名会转为小写模块名（Rust 2024 关键字自动加 `_` 后缀），带扩展名的文件名转为大写常量（标点替换为 `_`），例如 `assets/images/logo.svg` 生成 `res::images::LOGO_SVG`。

## 图片与矢量图标

`Painter` 支持生成的 `Asset` 常量、路径或 URL 字符串、编码字节、`ImageData` 与 `ImageVectorData`。`tessera_components::md3::material_icons` 内置了 `filled`、`outlined`、`round`、`sharp`、`two_tone` 五套 Material 图标常量：

```rust
use tessera_components::md3::{icon::icon, material_icons::filled};
use tessera_ui::tessera;

#[tessera]
fn settings_symbol() {
    icon().painter(filled::SETTINGS_SVG);
}
```

- 图片和 SVG 均异步解码，请为它们设置明确尺寸以免加载完成时周围布局跳动。
- SVG 渲染支持纯色填充与描边；导入前先把文字转为路径，并避免渐变、遮罩、滤镜或内嵌位图。

## 注册字体

通过 `tessera_components::fonts::{Font, Fonts}` 在 `EntryPoint` 注册随应用分发的字体：

```rust
use tessera_components::{
    ComponentsPackage,
    fonts::{Font, Fonts},
};
use tessera_ui::EntryPoint;

const APP_FONTS: Fonts = Fonts(&[Font {
    asset: crate::res::fonts::EXAMPLESANS_TTF,
    family: "Example Sans",
    fallback: &[],
    coverage: &[],
}]);

#[tessera_ui::entry]
pub fn run() -> EntryPoint {
    EntryPoint::new(app)
        .package(ComponentsPackage)
        .package(APP_FONTS)
}
```

通过 `TextStyle::font_family`（如 `Some("Example Sans")`）选用字体。`fallback` 指定当主字体缺字时也自动兜底的闭区间 Unicode 范围，`coverage` 限制按需加载该字体的字符范围。

如需加载远程 CSS 字体表，可注册 `FontStylesheet("https://example.com/fonts.css")`。原生平台未指定自定义字体时，`ComponentsPackage` 会在后台预扫描系统字体；Web 构建内嵌一份启动 Roboto 字体并按需拉取 Roboto / Noto Sans SC 子集。

## 加载自定义数据文件

对于 JSON、文本或自定义二进制文件，使用 `Resource::load(source, decode)`，其中 `decode` 是普通函数指针 `fn(Arc<[u8]>) -> io::Result<T>`（`T: Clone + Send + 'static`）：

```rust
use std::{io, sync::Arc};

use tessera_components::md3::text::text;
use tessera_ui::{LoadState, Resource, remember, tessera};

fn decode_text(bytes: Arc<[u8]>) -> io::Result<String> {
    String::from_utf8(bytes.to_vec()).map_err(io::Error::other)
}

#[tessera]
fn resource_notice() {
    let resource = remember(|| Resource::load("notice.txt", decode_text));
    match resource.with(|resource| resource.get()) {
        LoadState::Loading => { text("Loading…"); }
        LoadState::Ready(value) => { text(value); }
        LoadState::Failed(error) => { text(format!("Cannot load notice: {error}")); }
    }
}
```

随包分发的资源传入 `res::files::NOTICE_TXT`，外部路径或 URL 传字符串。同一来源和解码器的存活请求会自动共享结果，加载完成会自动触发读取者重建；若来源动态变化，配合 `remember_with_key` 使用。
