---
title: 项目结构
description: 了解 cargo tessera new 生成的每个文件干什么用，哪些归你改，哪些归工具管。
---

# 项目结构

新建的 Tessera 项目就是一个标准的 Cargo 包，外加两份描述应用和资源的 TOML 配置，以及存放各平台宿主壳的 `gen/` 目录。同一份 Rust 代码会靠它编译到桌面、移动端和浏览器。

## 目录一览

执行 `cargo tessera new my-app`（无论选 `basic` 还是 `blank` 模板），都会生成下面这套文件：

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

平时写业务主要待在 `src/` 和 `assets/` 里。根目录的几份配置偶尔改一次，而 `gen/` 下的平台工程由 `cargo tessera` 自动生成和同步。

## `Cargo.toml`

这份清单会把你的代码同时编成两部分：一个承载整个应用的库（Android 和 Web 会把它加载成动态库），以及一个在桌面和 iOS 上拉起它的薄可执行文件：

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
tessera-foundation = "..."

[target.'cfg(not(target_family = "wasm"))'.dependencies]
tokio = "1"

[target.'cfg(target_family = "wasm")'.dependencies]
wasm-bindgen = "0.2.130"

[build-dependencies]
tessera-build = "..."
```

建项目时 CLI 会自动填好对应的 `tessera-*` 版本。非 `wasm` 目标默认带了 `tokio = "1"`，因为 Tessera 原生调度器里的任务本身就跑在 Tokio 1 运行时上下文中。需要页面路由、多语言或直接调窗口/剪贴板接口时，再按需加上 `tessera-shard`、`tessera-i18n` 或 `tessera-platform`。

Android 和 iOS 的打包选项也写在这个文件里，分别放在 `[package.metadata.tessera.android]` 和 `[package.metadata.tessera.ios]` 下，具体字段见[打包与发布](/zhHans/guide/distribution)。

## `src/lib.rs`：全平台共用入口

所有目标平台都从 `src/lib.rs` 里的 `run()` 启动应用：

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

`run()` 做了三件事：指定根组件 `app`、加载来自 `tessera-app.toml` 的 `res::application()` 默认窗口配置，以及安装 `ComponentsPackage`。`#[tessera_ui::entry]` 会为 Android 生成 `android_main` 入口；在浏览器里，`start()` 会把应用挂载到 `gen/web/index.html` 中 `id` 与库 crate 同名的 `<canvas>` 上。

以后要注册自定义字体、着色器管线、插件或语言包，也都接在这个 `EntryPoint` 构建链上。详情见[应用入口、窗口与会话](/zhHans/guide/app)。

## `src/main.rs`：桌面与 iOS 启动器

可执行文件只负责调用共享库里的 `run()`：

```rust
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

Android 和 Web 直接加载 `cdylib` 入口，不用 `main()`，所以这两个目标下留空即可。这个文件平时几乎不需要改。

## `src/app.rs`：根组件

`src/app.rs` 里放着传给 `EntryPoint::new(app)` 的根组件。`basic` 模板会在 `material_theme()` 和铺满窗口的 `surface()` 里放一行 `"Hello Tessera!"`，`blank` 模板的 `surface()` 里则是空的。只要用到 `tessera-components` 里的控件，就保留外层的 `material_theme()`。

项目大起来之后，把各个页面和可复用组件拆成 `app.rs` 同级的模块即可。

## `build.rs` 与 `src/res.rs`

构建脚本里只有一行 `tessera_build::build()`。编译时它会读取 `tessera-app.toml` 和 `tessera-config.toml`，扫描 `assets/` 和语言目录，把生成好的代码写进 `OUT_DIR/tessera_assets.rs`；`src/res.rs` 再把它以 `crate::res` 的形式导出给整个 crate 用。

里面默认就有 `res::application()`，每个资源文件还会变成一个强类型常量（比如 `assets/images/logo.svg` 对应 `res::images::LOGO_SVG`），配了多语言之后还会多出 `res::I18N` 和 `res::i18n()`。具体写法见[资源、图片与字体](/zhHans/guide/assets)和[多语言与本地化](/zhHans/guide/i18n)。

## `tessera-app.toml` 与 `tessera-config.toml`

- **`tessera-app.toml`** 描述“应用是谁”：显示名称 `name`、反向域名形式的 `identifier`（至少两段点分 ASCII 标识符）以及源图标 `icon`（正方形 SVG，文字需先转路径；或者至少 1024 × 1024 的正方形 PNG）。
- **`tessera-config.toml`** 描述“应用用到了哪些资源与能力”：`permissions`（自动映射为各平台权限）、`[assets]`（`dir`、`embed`、`tree_shaking.exclude`）和可选的 `[i18n]`（`dir`、`fallback`）。

两份文件第一行都带了 `#:schema` 注释，支持 TOML Schema 的编辑器会自动帮你校验字段名。

## `gen/` 下的平台宿主目录

- **`gen/web/`**：建项目时就会生成。你可以自己改 `index.html` 的样式，但别动 `<title>` 和 `<!-- tessera-app -->` 注释块——每次 Web 构建都会按 `tessera-app.toml` 自动更新这里。构建时旁边还会生成 `pkg-web/`、`tessera/` 和 `app/`（已加入 `.gitignore`）。
- **`gen/android/`**：在执行 `cargo tessera android init` 时生成，并且每次跑 `android build` / `android dev` 都会按 `Cargo.toml` 和 `tessera-config.toml` 重新同步。所以 Android 配置请写在 TOML 里，不要直接手改生成的 Gradle 文件。
- **iOS**：`cargo tessera ios build` 直接在 Cargo 的 `target/` 目录里组装 `.app` 和 IPA，`gen/` 下不会多出目录。

## 其他文件

`AGENTS.md` 告诉编程 Agent 可以用 `cargo tessera skill` 安装官方编码指引；`README.md` 记着常用的运行命令；`.gitignore` 屏蔽了 `target/` 和生成的 Web 产物。

## 下一步

还没跑过小例子的，可以接着看[教程：购物清单](/zhHans/guide/tutorial)；已经上手的，直接进入[Tessera 的思维方式](/zhHans/guide/thinking-in-tessera)，把组件调用和构建模型彻底弄明白。
