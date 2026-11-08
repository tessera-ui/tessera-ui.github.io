---
title: 应用入口与窗口
description: 用同一个入口在各个平台启动应用，并配置窗口、应用标识和标题栏。
---

# 应用入口与窗口

每个 Tessera 应用都从一个 `EntryPoint` 启动。它把根组件和渲染器、平台服务以及窗口连接起来。你只需要在一个函数里构建它，再让各平台的启动代码调用这个函数，桌面、Web、Android 和 iOS 就会以同一套配置启动同一个应用。

`basic` 项目模板把这个函数放在 `src/lib.rs` 中。它依赖模板生成的 `src/app.rs`、`src/res.rs` 和 `build.rs`，这些文件各自的作用见[项目结构](/zhHans/guide/project-structure)。

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

`app` 是一个普通的 `#[tessera]` 组件。使用 Material 组件时，要在它的最外层放一个 `material_theme()`：`ComponentsPackage` 负责安装渲染管线，主题由 `material_theme()` 提供。详见 [Material 3 主题](/zhHans/guide/theming)。

## 在各个平台启动

`#[tessera_ui::entry]` 标注在返回 `EntryPoint` 的公共无参函数上。在 Android 上，它会生成 `android_main`，并把宿主提供的 `AndroidApp` 传给 `run_android`，Android 平台到此就齐了。Web 上的 `start` 函数（见上文）以及桌面和 iOS 上的 `main` 由你自己编写。

`main` 位于 `src/main.rs`。项目名为 `notes` 时，模板的库 crate 名为 `notes_lib`，`main` 这样启动共享入口：

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(all(not(target_family = "wasm"), not(target_os = "android")))]
fn main() {
    #[cfg(target_os = "ios")]
    let result = notes_lib::run().run_ios();
    #[cfg(not(target_os = "ios"))]
    let result = notes_lib::run().run_desktop();
    if let Err(err) = result {
        eprintln!("App failed to run: {err}");
    }
}

#[cfg(any(target_family = "wasm", target_os = "android"))]
fn main() {}
```

每个启动方法只在它支持的目标上存在，所以每次调用都要放在 `cfg` 条件之后。选择发生在编译期：

| 方法 | 可用目标 |
| --- | --- |
| `run_desktop()` | Android 和 iOS 之外的原生目标。 |
| `run_ios()` | iOS；必须在应用主线程调用。 |
| `run_android(android_app)` | Android。 |
| `run_web()` | `wasm` 目标族。 |
| `into_headless(config)` | 启用 `headless` feature 的非 `wasm` 目标。 |

这些方法都会消耗 `EntryPoint`。无头渲染用于离屏测试，见[测试](/zhHans/guide/testing)；各原生宿主的要求见[平台概览](/zhHans/guide/platforms)。

## 注册应用服务

启动之前，先告诉入口应用要用到哪些服务。下面这些构建方法负责注册：

| 构建方法 | 注册或设置的内容 |
| --- | --- |
| `.package(package)` | 通过 `EntryRegistry` 组织多项注册的 `TesseraPackage`。 |
| `.module(module)` | 注册图形管线的 `RenderModule`。 |
| `.plugin(plugin)` | 由当前应用会话拥有的 `Plugin` 实例。 |
| `.config(config)` | 渲染器与窗口使用的 `TesseraConfig`。 |

大多数应用只需要一个包。`ComponentsPackage` 会注册标准组件的管线，同时注册 `tessera_platform::PlatformPackage`，后者提供组件依赖的平台服务。只要用 `tessera-components` 构建应用，就应注册它。字体包也用同样的方式注册，见[资源](/zhHans/guide/assets#字体)。自己的集成见[平台集成与插件](/zhHans/guide/plugins)和[绘制与着色器](/zhHans/guide/drawing)。

## 配置窗口

`TesseraConfig` 包含窗口标题、桌面 `window` 选项（`WindowConfig`）、`web` 宿主选项，以及 `sample_count` 等 GPU 设置。`sample_count` 默认为 `1`，其他采样数需要 GPU 支持。每个 `EntryPoint` 运行一个窗口。

在生成的项目中，应以 `res::application()` 为起点，而不是 `TesseraConfig::default()`。生成的配置已经带有来自[应用标识](#应用标识)的窗口标题、应用 ID 和桌面图标；在它的基础上调整某个运行时选项，这些信息会原样保留。下面这个版本的 `run` 让桌面窗口不能调整大小：

```rust
#[tessera_ui::entry]
pub fn run() -> EntryPoint {
    let mut config = res::application();
    config.window.resizable = false;

    EntryPoint::new(app)
        .config(config)
        .package(tessera_components::ComponentsPackage)
}
```

`WindowConfig` 还控制系统装饰和窗口透明。这些选项只作用于桌面窗口，完整列表和默认值见 [API 参考](https://tessera-ui.github.io/tessera/tessera_ui/)。

要让内容避开状态栏和屏幕键盘，请使用窗口边距：它会随这些区域的变化实时测量。用法见[布局基础](/zhHans/guide/layout)。

## 应用标识

应用的显示名称、反向域名形式的标识符和源图标写在包根目录的 `tessera-app.toml` 中：

```toml
name = "Notes"
identifier = "dev.example.notes"
icon = "icon.svg"
```

生成的 `build.rs` 通过 `tessera_build::build()` 读取这个文件，生成的 `res::application()` 再把它变成带窗口标题、应用 ID 和桌面图标的 `TesseraConfig`。CLI 生成平台包和宿主文件时也读取同一份元数据。这些都发生在构建期，运行中的应用使用的是上次构建时的值；修改文件后请重新构建。

标识符至少包含两个以点分隔的片段。每段以 ASCII 字母开头，只能包含 ASCII 字母和数字。省略这些字段时，名称默认使用 Cargo 包名，标识符也由包名推导。

图标路径相对于包根目录，使用正方形的 SVG 或 PNG。SVG 中的文字要转为路径，外部资源要嵌入文件。这些标识会出现在安装包、应用 bundle 和启动器的哪些位置，见[打包发布](/zhHans/guide/distribution)。

## 让应用栏成为标题栏

在桌面上，可以让应用栏兼任窗口标题栏，工具栏和窗口装饰共用一行。这需要两处改动。先在窗口配置中启用。下面的辅助函数可以放进 `src/lib.rs`，在调用 `.config(...)` 之前把配置传给它：

```rust
fn with_app_titlebar(mut config: TesseraConfig) -> TesseraConfig {
    config.window = config.window.with_app_titlebar();
    config
}
```

再用 `.window_chrome(true)` 标出充当标题栏的应用栏。例如，`src/app.rs` 可以改成：

```rust
use tessera_components::{
    app_bar::top_app_bar,
    theme::{MaterialTheme, material_theme},
};
use tessera_ui::tessera;

#[tessera]
pub fn app() {
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(|| {
            top_app_bar().title("Notes").window_chrome(true);
        });
}
```

macOS 保留原生窗口按钮；其他桌面平台会关闭系统装饰，由应用自己绘制窗口按钮。两种情况下，应用栏都提供拖动区域，并在平台需要时提供最小化、最大化和关闭按钮。在移动端和 Web 上，`with_app_titlebar` 不起作用。

## 用代码控制窗口

如果你自己绘制窗口按钮，或者需要一个“退出”操作，可以使用 `tessera_platform::window` 提供的 `minimize`、`maximize`、`toggle_maximize` 和 `close`。先用 `cargo add tessera-platform` 添加依赖。这些函数都不接受参数，可以直接传给 `on_click`：

```rust
use tessera_components::{button::button, row::row, text::text};
use tessera_platform::window;
use tessera_ui::tessera;

#[tessera]
fn window_buttons() {
    row().children(|| {
        button().on_click(window::minimize).child(|| text("Minimize"));
        button().on_click(window::toggle_maximize).child(|| text("Maximize"));
        button().on_click(window::close).child(|| text("Quit"));
    });
}
```

这些调用依赖 `ComponentsPackage` 注册的桌面服务；服务不可用时，调用什么也不做。`close` 会请求宿主关闭应用，而不是立刻销毁它。

## 运行时会话

`EntryPoint` 拥有一个 `RuntimeSession`。包、插件、状态所有者和会话资源都属于这个 UI 会话，每个入口各有一套。在入口被消耗之前，可以用 `entry.runtime_session()` 借用它的会话。

直接操作会话主要用于测试和集成。它们可以用 `RuntimeSession::new()` 创建独立的会话，用 `run(...)` 在其中执行一段代码，或者调用 `enter()` 获取一个守卫，守卫销毁时恢复此前的会话。`resource::<T>()` 返回整个会话共享的资源，`local_resource::<T>()` 则把资源保留在 UI 线程上。

克隆 `RuntimeSession` 会让会话保持存活。`downgrade()` 返回不持有会话的 `WeakRuntimeSession`，会话结束后，它的 `run(...)` 返回 `None`。`run` 只在所属的 UI 线程上执行。要把其他线程上后台工作的结果送回界面，请使用调度器，见[后台任务](/zhHans/guide/tasks)；外部资源也应随拥有它的对象一起释放。

完整约定见 [tessera-ui API 参考](https://tessera-ui.github.io/tessera/tessera_ui/)。
