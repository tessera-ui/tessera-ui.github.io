---
title: 应用入口、窗口与会话
description: 用一个 EntryPoint 覆盖全平台启动，配置窗口、应用标识、集成标题栏与 RuntimeSession。
---

# 应用入口、窗口与会话

每个 Tessera 应用都从一个 `EntryPoint` 启动，它把根组件、渲染配置、组件包和插件串在一起。在 `src/lib.rs` 写好一次，所有平台就都走同一套初始化流程。

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

使用 `tessera-components` 时，在 `app` 最外层包上 `material_theme()`：`ComponentsPackage` 负责安装渲染管线与平台服务，`material_theme()` 负责向下提供设计主题。

## 各平台启动方式

`#[tessera_ui::entry]` 标在无参返回 `EntryPoint` 的公开函数上，并会为 Android 生成 `android_main` 胶水。桌面和 iOS 通过 `src/main.rs` 启动：

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

| 启动方法 | 适用目标 |
| --- | --- |
| `run_desktop()` | 桌面原生平台（`cargo tessera headless` 也会复用此入口进入离屏模式） |
| `run_ios()` | iOS（必须在主线程调用） |
| `run_android(android_app)` | Android |
| `run_web()` | `wasm` 目标 |
| `into_headless(config)` | 启用 `headless` feature 的非 `wasm` 目标 |

## 注册包、渲染模块与插件

| 方法 | 用途 |
| --- | --- |
| `.package(package)` | 安装 `TesseraPackage`（组合多个模块、插件和子包） |
| `.module(module)` | 通过 `RenderModule` 注册自定义 GPU 管线 |
| `.plugin(plugin)` | 注册由当前会话持有的 `Plugin` |
| `.config(config)` | 设置窗口、Web 与 GPU 选项（`TesseraConfig`） |

使用组件库时务必注册 `ComponentsPackage`（它会自动带上提供剪贴板与窗口服务的 `PlatformPackage`）。自定义字体、管线和插件详见[资源、图片与字体](/zhHans/guide/assets#字体)、[自定义绘制与着色器](/zhHans/guide/drawing)与[平台集成与插件](/zhHans/guide/plugins)。

## 配置窗口与应用标识

在生成的项目里，基于 `res::application()` 修改选项，不要直接从 `TesseraConfig::default()` 起步，这样来自 `tessera-app.toml` 的标题、应用 ID 和图标都会自动保留：

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

应用的显示名称、反向域名标识符（至少两段点分 ASCII 标识符）和源图标写在 `tessera-app.toml`：

```toml
name = "Notes"
identifier = "dev.example.notes"
icon = "icon.svg"
```

源图标应为正方形 SVG（文字转为路径、外部资源内嵌）或至少 1024 × 1024 的正方形 PNG。

## 集成标题栏与窗口控制

在桌面上可以让顶部应用栏兼作窗口标题栏：

1. 在 `WindowConfig` 中开启：`config.window = config.window.with_app_titlebar();`
2. 在应用栏组件上开启 `.window_chrome(true)`：

```rust
use tessera_components::md3::{
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

macOS 会保留原生红绿灯按钮并把应用栏设为拖动区；Windows 和 Linux 则关闭系统边框，由应用栏自己绘制最小化/最大化/关闭按钮。移动端和 Web 上该配置自动忽略。

如果需要自定义窗口控制按钮，添加 `tessera-platform`（`cargo add tessera-platform`），直接把 `tessera_platform::window` 里的函数传给 `on_click`：

```rust
use tessera_components::{md3::{button::button, text::text}, row::row};
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

## 运行时会话（`RuntimeSession`）

每个 `EntryPoint` 拥有独立的 `RuntimeSession`，用于隔离包、插件、模型和会话资源。消费入口前可通过 `entry.runtime_session()` 获取会话引用。

测试或宿主集成可以直接使用 `RuntimeSession::new()` 创建隔离会话，通过 `.run(...)` / `.enter()` 切换当前会话，用 `runtime_resource::<T>()` 存取会话级共享资源，或用 `.downgrade()` 获取不延长生命周期的 `WeakRuntimeSession`。
