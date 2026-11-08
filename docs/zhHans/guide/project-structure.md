---
title: 项目结构
description: 新建 Tessera 项目中每个文件的作用，以及哪些文件需要你来修改。
---

# 项目结构

新建的 Tessera 项目就是一个普通的 Cargo 包，只是多了几个文件，用来向构建过程和 CLI 描述你的应用。了解每个文件的作用，你就知道一处改动该放在哪里，也知道哪些文件由工具替你管理。

## 文件一览

`cargo tessera new my-app` 会生成下面的目录结构。`basic` 和 `blank` 两个模板生成的文件相同，只有 `src/app.rs` 不一样。

```text
my-app/
├── Cargo.toml
├── build.rs
├── tessera-app.toml
├── tessera-config.toml
├── icon.svg
├── assets/
├── gen/
│   └── web/
│       └── index.html
├── src/
│   ├── app.rs
│   ├── lib.rs
│   ├── main.rs
│   └── res.rs
├── AGENTS.md
├── README.md
└── .gitignore
```

大部分工作都在 `src/` 中完成，起点是 `src/app.rs`。根目录下的配置文件偶尔需要修改；`gen/` 下则是各平台的宿主文件，由 CLI 创建和补充。

## Cargo.toml

这份清单会把你的代码构建两次：一次构建成承载整个应用的库，一次构建成在桌面上启动它的小型可执行文件。对于名为 `my-app` 的项目，它的内容如下：

```toml
[package]
name = "my-app"
version = "0.1.0"
edition = "2024"

[lib]
crate-type = ["rlib", "cdylib"]
name = "my_app_lib"
path = "src/lib.rs"

[[bin]]
name = "my_app"
path = "src/main.rs"

[dependencies]
tessera-ui = "..."
tessera-components = "..."

[target.'cfg(target_family = "wasm")'.dependencies]
wasm-bindgen = "0.2.130"

[build-dependencies]
tessera-build = "..."
```

`tessera-*` 的版本由 CLI 按其发布时对应的版本填入，这里用 `"..."` 代替。库同时构建为 `cdylib`，是因为 Android 和 Web 以动态库的形式加载应用。`wasm-bindgen` 只在为浏览器构建时使用。需要 `tessera-shard`、`tessera-i18n` 等其他 crate 时，把它们加到 `[dependencies]` 中即可。

平台构建设置也写在这个文件里：Android 选项放在 `[package.metadata.tessera.android]`，iOS 选项放在 `[package.metadata.tessera.ios]`。具体说明见[平台概览](/zhHans/guide/platforms)和[打包发布](/zhHans/guide/distribution)。

## src/lib.rs：共享入口

所有平台都从 `src/lib.rs` 中的同一个函数启动应用：

```rust
mod app;
pub mod res;

use tessera_ui::{EntryPoint, renderer::TesseraConfig};

use app::app;

#[cfg(target_family = "wasm")]
use tessera_ui::renderer::WebConfig;
#[cfg(target_family = "wasm")]
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

#[tessera_ui::entry]
pub fn run() -> EntryPoint {
    EntryPoint::new(app)
        .config(TesseraConfig {
            #[cfg(target_family = "wasm")]
            web: WebConfig::default().with_canvas_id(env!("CARGO_CRATE_NAME")),
            ..res::application()
        })
        .package(tessera_components::ComponentsPackage)
}

#[cfg(target_family = "wasm")]
#[wasm_bindgen(start)]
pub fn start() -> Result<(), JsValue> {
    run()
        .run_web()
        .map_err(|err| JsValue::from_str(&err.to_string()))
}
```

`run` 指定根组件，以 `tessera-app.toml` 生成的配置为基础，并注册 `ComponentsPackage`，为组件库安装所需的渲染管线和平台服务。`#[tessera_ui::entry]` 还会根据这个函数生成 Android 入口。在 Web 上，`start` 运行同一个入口，并让它绘制到 `gen/web/index.html` 中的 `<canvas>` 上；这个画布的 `id` 就是库的 crate 名。

随着应用变大，额外的包、字体、插件和语言目录都在这里注册。构建器方法和各种启动方式见[应用入口与窗口](/zhHans/guide/app)。

## src/main.rs：桌面与 iOS 程序

可执行文件只负责调用库。对 `my-app` 来说，库 crate 名是 `my_app_lib`：

```rust
// Prevents additional console window on Windows in release, DO NOT REMOVE
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(all(not(target_family = "wasm"), not(target_os = "android")))]
fn main() {
    #[cfg(target_os = "ios")]
    let result = my_app_lib::run().run_ios();
    #[cfg(not(target_os = "ios"))]
    let result = my_app_lib::run().run_desktop();
    if let Err(err) = result {
        eprintln!("App failed to run: {err}");
    }
}

#[cfg(any(target_family = "wasm", target_os = "android"))]
fn main() {}
```

Android 和 Web 通过库来启动应用，所以在这两个平台上 `main` 是空的。应用的初始化放在 `run` 里，每个平台都能用上；这个文件很少需要改动。

## src/app.rs：根组件

`src/app.rs` 中是 `run` 传给 `EntryPoint::new` 的组件。在 `basic` 模板里，它在铺满窗口的 surface 上显示一行文字：

```rust
use tessera_components::{
    modifier::ModifierExt as _,
    surface::surface,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_ui::{Modifier, tessera};

#[tessera]
pub fn app() {
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(|| {
            surface()
                .modifier(Modifier::new().fill_max_size())
                .child(|| {
                    text("Hello Tessera!");
                });
        });
}
```

`blank` 模板有同样的主题和 surface，只是没有这行文字。替换内容时，请保留根部的 `material_theme()`：Material 控件从它读取颜色、字体排版和形状。注册 `ComponentsPackage` 安装的是渲染和平台服务，主题则来自 `material_theme()`。自定义主题的方法见 [Material 3 主题](/zhHans/guide/theming)。

应用变大后，可以把各个页面和可复用的部分拆成单独的模块，放在 `app.rs` 旁边。

## build.rs 与 res 模块

构建脚本调用 Tessera 的构建辅助函数：

```rust
fn main() {
    tessera_build::build().expect("Failed to build Tessera resources");
}
```

它读取 `tessera-app.toml` 和 `tessera-config.toml`，收集资源目录和语言目录，再把结果生成为 Rust 代码，写入 Cargo `OUT_DIR` 下的 `tessera_assets.rs`。`src/res.rs` 引入这个文件，crate 的其余部分就能通过 `crate::res` 使用它：

```rust
#[allow(missing_docs, clippy::all)]
mod generated {
    include!(concat!(env!("OUT_DIR"), "/tessera_assets.rs"));
}

pub use generated::*;
```

生成的模块中始终有 `res::application()`，它返回一个 `TesseraConfig`，其中包含窗口标题、应用 ID 和桌面图标。每个资源也会对应一个常量，例如 `assets/images/logo.svg` 对应 `res::images::LOGO_SVG`；配置多语言之后，还会生成 `res::I18N` 目录及其 `res::i18n()` 包。这些输入一变，Cargo 就会重新生成该文件，所以修改请放在这些输入里。这些输入的写法见[资源](/zhHans/guide/assets)和[多语言](/zhHans/guide/i18n)。

## tessera-app.toml：应用身份

这个文件定义了用户和操作系统眼中的应用：显示名称、反向域名形式的标识符和源图标。

```toml
#:schema https://raw.githubusercontent.com/tessera-ui/tessera/main/docs/schemas/tessera-app.schema.json
name = "my-app"
identifier = "com.tessera.myapp"
icon = "icon.svg"
```

CLI 用包名作为初始名称，并由包名推导出标识符。发布之前，请把两者都改成你自己的值，因为平台清单、桌面启动器和应用包都靠这个标识符来识别应用。标识符至少要有两段，用点分隔，每段以 ASCII 字母开头，并且只包含 ASCII 字母和数字。

图标路径相对于包的根目录。请使用正方形 SVG（文字需转换为路径，外部资源需内嵌），或者至少 1024 × 1024 的正方形 PNG。构建过程和平台命令在运行时读取这个文件，所以修改会在下一次构建时生效。开头的 `#:schema` 一行可以让支持 TOML schema 的编辑器校验这个文件。

## tessera-config.toml：资源与平台功能

`tessera-app.toml` 说明应用“是谁”，第二个配置文件则描述它用到了什么：

```toml
#:schema https://raw.githubusercontent.com/tessera-ui/tessera/main/docs/schemas/tessera-config.schema.json
permissions = []

[assets]
dir = "assets"

[assets.tree_shaking]
exclude = []
```

`permissions` 列出应用需要的平台权限，可选值有 `notifications`、`camera`、`microphone`、`location` 和 `bluetooth`，CLI 会把它们映射为各平台自己的权限名。`[assets]` 告诉构建辅助函数资源位于 `assets/` 目录；`[assets.tree_shaking]` 列出即使找不到任何引用也必须保留的文件。为应用添加多语言时，在这里加一个 `[i18n]` 表。这些表的说明见[资源](/zhHans/guide/assets)和[多语言](/zhHans/guide/i18n)。

## assets/ 与 icon.svg

`assets/` 一开始是空的。图片、字体等文件都放在这里，并通过生成的 `res` 常量来引用。`icon.svg` 是 `tessera-app.toml` 中指定的占位图标，请换成你自己的图标。

## gen/ 下的平台目录

各平台的宿主项目都放在 `gen/` 下。新项目中已经有 `gen/web/index.html`，这个页面把 WebAssembly 构建加载到铺满窗口的画布上，并在应用启动前显示加载条。你可以修改这个页面，但 `<title>` 以及 `<!-- tessera-app -->` 与 `<!-- /tessera-app -->` 之间的区域要交给 CLI：每次 Web 构建都会根据 `tessera-app.toml` 重写它们，第一次构建时还会插入这个区域。

Web 构建会在旁边再生成三个目录，它们都已列入 `.gitignore`：`gen/web/pkg-web/` 存放编译出的 JavaScript 和 WebAssembly，`gen/web/tessera/` 存放通过 HTTP 分发的资源，`gen/web/app/` 存放生成的图标和 Web 清单。对于还没有 Web 支持的旧项目，`cargo tessera web init` 会创建宿主页面，并补上缺少的配置：`wasm-bindgen` 依赖、`src/lib.rs` 中的 `start` 函数、`src/main.rs` 中的平台条件，以及 `.gitignore` 条目。

`cargo tessera android init` 会在 `gen/android/` 中生成一个 Android Studio Gradle 项目，其中包含承载 Rust 库的 Activity。Android 相关设置请写在 `Cargo.toml` 和 `tessera-config.toml` 中：每次运行 `android init`、`android build` 和 `android dev`，CLI 都会根据这些配置重新生成 Gradle 构建文件、清单、Activity 和启动器图标，覆盖对这些文件的手动修改。包含 Kotlin 代码的插件也会在同一次同步中复制进来。

iOS 在 `gen/` 下没有目录：`cargo tessera ios build` 直接在 Cargo 的 target 目录下组装应用包。各平台产物的具体位置见[打包发布](/zhHans/guide/distribution)。

## 其他文件

`AGENTS.md` 告诉编程智能体如何用 `cargo tessera skill` 安装 Tessera 自带的开发指引。`README.md` 列出了运行、本地预览和构建项目的命令。`.gitignore` 排除了 `target/` 和生成的 Web 输出；`basic` 模板的 `.gitignore` 还排除了 `Cargo.lock`。

## 下一步

想开始修改 `src/app.rs`，请跟着[教程](/zhHans/guide/tutorial)来做。想深入了解应用入口，请阅读[应用入口与窗口](/zhHans/guide/app)。
