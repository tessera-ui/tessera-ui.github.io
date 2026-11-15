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

## 在 `tessera.toml` 中配置资源

包根目录 `tessera.toml` 中的 `[assets]` 表用于开启资源生成：

```toml
[assets]
dir = "assets"
embed = ["fonts/*.ttf"]
keep = ["licenses/**"]
```

- `dir`：资源目录，相对包根目录（默认为 `assets`）。
- `embed`：在所有目标上始终内嵌进二进制的资源，使用 `--asset-backend platform` 构建时也不例外。
- `keep`：即使在二进制中找不到引用也照常分发的平台资源（适合按名称动态选择的资源）。

`embed` 与 `keep` 使用相对 `dir` 的 glob 模式；`*` 不跨越目录，`**` 可以跨越。

目录名会转为小写模块名（Rust 2024 关键字自动加 `_` 后缀），带扩展名的文件名转为大写常量（标点替换为 `_`），例如 `assets/images/logo.svg` 生成 `res::images::LOGO_SVG`。

## 图片与矢量图标

`Painter` 支持生成的 `Asset` 常量、编码字节（`&[u8]`、`Vec<u8>` 或 `Arc<[u8]>`）、`Source`、`ImageData` 与 `ImageVectorData`。`tessera_components::md3::material_icons` 内置了 `filled`、`outlined`、`round`、`sharp`、`two_tone` 五套 Material 图标常量：

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

如需加载 Web 字体样式表中 `@font-face` 规则声明的字体，可通过 `.package(...)` 注册 `FontStylesheet("https://example.com/fonts.css")`；文本用到某条规则 `unicode-range` 内的字符时才会拉取对应字体文件。远程字体只在 Web 上加载，其他平台会报告该样式表不可用，请改用 `Fonts` 随包分发这些字体。

原生平台的文本使用系统字体，`ComponentsPackage` 会在后台预加载系统字体。Web 构建内嵌一份启动 Roboto 字体，并从 CDN 按需加载其余 Roboto / Noto Sans SC 子集。

## 加载自定义数据文件

对于 JSON、文本或自定义二进制文件，使用 `Resource::load(source, decode)`。`source` 是生成的 `Asset` 或内存中的字节（`&[u8]`、`Vec<u8>` 或 `Arc<[u8]>`）；`decode` 是普通函数指针 `fn(Bytes) -> io::Result<T>`（`T: Clone + Send + 'static`），在 `Dispatcher::Io` 上运行。`tessera_ui::asset::Bytes` 可解引用为 `[u8]`，克隆时共享同一份数据：

```rust
use std::io;

use tessera_components::md3::text::text;
use tessera_ui::{LoadState, Resource, asset::Bytes, remember, tessera};

use crate::res;

fn decode_text(bytes: Bytes) -> io::Result<String> {
    String::from_utf8(bytes.to_vec()).map_err(io::Error::other)
}

#[tessera]
fn resource_notice() {
    let resource = remember(|| Resource::load(res::NOTICE_TXT, decode_text));
    match resource.with(|resource| resource.get()) {
        LoadState::Loading => { text("Loading…"); }
        LoadState::Ready(value) => { text(value); }
        LoadState::Failed(error) => { text(format!("Cannot load notice: {error}")); }
    }
}
```

这里的 `assets/notice.txt` 生成 `res::NOTICE_TXT`。同一来源和解码器的存活请求会共享结果，加载完成后所有读取过 `get()` 的组件都会重建；若来源动态变化，配合 `remember_with_key` 使用。丢弃最后一个句柄会取消尚未完成的工作。

如需由其他工作（例如网络请求）产出值，对返回 `io::Result<T>` 的 `Send` future 使用 `Resource::spawn(future)`；若 future 必须留在当前 UI 会话线程上，使用 `Resource::spawn_local(future)`。
