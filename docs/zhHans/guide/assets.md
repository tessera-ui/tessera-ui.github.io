---
title: 资源
description: 随应用分发图片、图标、字体和数据文件，并通过生成的引用加载它们。
---

# 资源

随应用分发的图片、图标、字体和数据文件都放在资源目录中。构建时，Tessera 会为每个文件生成一个带类型的引用：你写的是 `res::images::LOGO_SVG`；文件不存在会直接编译失败；无论文件最终以什么方式分发，同一段代码在每个平台上都能找到它。

要显示图片，把生成的引用传给 `.painter(...)`。以 `assets/images/logo.svg` 为例：

```rust
use tessera_components::{image::image, modifier::ModifierExt as _};
use tessera_ui::{Dp, Modifier, tessera};

use crate::res;

#[tessera]
fn logo() {
    image()
        .painter(res::images::LOGO_SVG)
        .modifier(Modifier::new().size(Dp(96.0), Dp(96.0)));
}
```

读取和解码文件都由组件完成。引用描述的是字节从哪里来；组件会请求资源，并在资源可用后更新。组件的渲染管线来自在[应用入口](/zhHans/guide/app)注册的 `ComponentsPackage`。

## 配置资源目录

资源配置写在包根目录的 `tessera-config.toml` 中：

```toml
[assets]
dir = "assets"
embed = ["images/logo.svg"]

[assets.tree_shaking]
exclude = ["runtime/**"]
```

`dir` 相对于包根目录；只要存在 `[assets]` 节，它的默认值就是 `assets`。这个目录必须存在。只有存在 `[assets]` 节时，构建辅助函数才会收集资源目录。

`embed` 列出相对于资源目录的精确路径。即使 CLI 为其他资源选择了平台分发，这些文件也始终嵌入在二进制中。构建辅助函数默认嵌入所有资源；平台分发则让 CLI 通过平台资源或 HTTP 单独提供文件。[打包发布](/zhHans/guide/distribution)时，交给 CLI 管理分发方式即可。

`tree_shaking.exclude` 接受一组 glob 模式，匹配的文件即使在平台资源分析中找不到引用，也会**保留下来**。也就是说，它让文件免于被裁剪。代码动态选择的资源适合用它。如果在平台分发下也要嵌入这些文件，请同时把它们写进 `embed`。

## 生成的引用

生成项目的 `build.rs` 会调用 `tessera_build::build()`，把引用写入一个模块，再由 `src/res.rs` 以 `res` 的名字导出；这些文件见[项目结构](/zhHans/guide/project-structure)。增删资源后重新构建即可生效。

目录名转为小写模块名，文件名连同扩展名转为大写常量名，标点替换为下划线。因此 `images/logo.svg` 对应 `res::images::LOGO_SVG`，`fonts/ExampleSans.ttf` 对应 `res::fonts::EXAMPLESANS_TTF`。规范化之后重名的文件会被拒绝。生成的文件交给构建维护；访问资源时始终使用生成的引用，它带有各平台的分发路径。

## 图片与图标

`Painter` 接受生成的资源、文件路径、编码后的字节、`ImageData` 和 `ImageVectorData`。`image().painter(...)` 和 `icon().painter(...)` 使用的是同一种表示。字符串来源在原生平台上表示文件路径，在 Web 上表示 URL；生成的资源则会为目标平台选择正确的分发方式。

组件库自带的 Material 图标同样是生成的资源，分为 `filled`、`outlined`、`round`、`sharp` 和 `two_tone` 几种风格：

```rust
use tessera_components::{icon::icon, material_icons::filled};

#[tessera_ui::tessera]
fn settings_symbol() {
    icon().painter(filled::SETTINGS_SVG);
}
```

图标这类使用主题的组件需要 `material_theme()` 祖先，见 [Material 3 主题](/zhHans/guide/theming)。

编码后的来源是异步加载的。原生平台在工作线程上读取和解码；Web 异步获取内容，但目前解码仍在浏览器任务中进行，所以自定义的 Web 解码器要尽量轻量。图片和图标在加载期间或解码失败后不显示任何图像内容。给它指定尺寸，图片到达时周围布局就能保持稳定。

SVG 以矢量几何绘制。路径支持纯色填充和描边。SVG 文本、内嵌图片、渐变、图案、虚线描边、裁剪路径、遮罩、滤镜、非默认的形状渲染模式以及非普通混合模式都会被拒绝。添加之前，先把文字转为路径，并简化不受支持的图形。

载荷与显示选项见 [painter](https://tessera-ui.github.io/tessera/tessera_components/painter/index.html)、[image](https://tessera-ui.github.io/tessera/tessera_components/image/index.html) 和 [icon](https://tessera-ui.github.io/tessera/tessera_components/icon/index.html) 的 API 参考。

## 字体

字体通过 `tessera_components::fonts` 中的入口包注册。`Fonts` 接受一个静态的 `Font` 描述符切片。以 `assets/fonts/ExampleSans.ttf` 为例：

```rust
use tessera_components::{ComponentsPackage, fonts::{Font, Fonts}};
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

这里的 `app` 是应用已有的根组件。通过 `TextStyle::font_family` 选择注册的字体族，例如 `Some("Example Sans")`。`fallback` 是一组闭区间形式的 Unicode 范围，遇到这些字符时，即使没有选中这个字体族也会请求它，主字体缺少某种文字的字形时可以这样补上。`coverage` 把请求限制在字体支持的范围内，空切片表示允许所有范围。字体文件在文本首次需要时加载。

另一种入口包是 `FontStylesheet("https://example.com/fonts.css")`，同样用 `.package(...)` 注册。它从 CSS 的 `@font-face` 规则中发现字体，并根据 `unicode-range` 请求字体文件。应用需要离线可用时，优先使用随应用分发的字体资源。没有注册字体时，原生平台的文本使用系统字体；Web 构建自带一个启动字体，其他默认字体从 CDN 请求。

注册细节见 [fonts API](https://tessera-ui.github.io/tessera/tessera_components/fonts/index.html)，文本样式见[文本与文本输入](/zhHans/guide/text)。

## 加载数据文件

其他文件，比如 JSON、文本或模型文件，用 `Resource::load(source, decode)` 加载。解码器的签名是 `fn(Arc<[u8]>) -> io::Result<T>`，负责把字节转换成你的类型，这个类型必须实现 `Clone + Send + Sync + 'static`。解码器是函数指针，不能是捕获环境的闭包。

用 `remember` 保存资源，再在构建时读取 `Resource::get()`：

```rust
use std::{io, sync::Arc};

use tessera_components::text::text;
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

这个示例在原生平台读取文件，在 Web 上读取相对于当前页面的 URL。随应用分发的内容应传入生成的资源；例如 `assets/files/notice.txt` 对应 `res::files::NOTICE_TXT`。`LoadState` 区分加载中、成功和失败，你可以据此显示明确的加载和错误界面。

来源和解码器相同的存活请求共享同一个结果。加载完成后，读取过该资源的构建和测量会失效并重新执行。需要结果期间，请一直持有这个句柄；如果来源变化时应创建新的资源，就按[生命周期与副作用](/zhHans/guide/lifecycle)中的说明，用键来记住它。
