---
title: 目标平台
description: Windows、macOS、Linux、Android、iOS 与 Web 六大目标平台的环境要求与宿主特性。
---

# 目标平台

同一个 Tessera 项目通过 `src/lib.rs` 里共享的 `EntryPoint` 编译并运行在六个目标平台上（见[应用入口、窗口与会话](/zhHans/guide/app)）：

| 平台 | 启动调用 | Rust 目标 |
| --- | --- | --- |
| Windows、macOS、Linux | `run_desktop()` | 本机三元组 |
| iOS | `run_ios()`（主线程） | `aarch64-apple-ios` 或模拟器三元组 |
| Android | `run_android(app)`（由 `#[tessera_ui::entry]` 导出） | 默认 `aarch64-linux-android` |
| Web | `run_web()`（由 `#[wasm_bindgen(start)]` 调用） | `wasm32-unknown-unknown` |

## 环境要求一览

所有原生平台都需要 Rust 1.98+、原生 C/C++ 链接器以及可用的 GPU 驱动：

| 平台 | 构建与运行环境要求 |
| --- | --- |
| Windows | Windows 构建工具与 SDK；支持 Direct3D 12 的显卡与驱动 |
| macOS | Xcode / Apple 命令行工具；支持 Metal 的 GPU 与驱动 |
| Linux | C/C++ 工具链、X11 或 Wayland 客户端库、`libxkbcommon` 以及 Vulkan 驱动 |
| Android | Android SDK 与 NDK、Gradle 所需的 JDK、真机或模拟器（`minSdk` 默认为 `24`） |
| iOS | 装有 Xcode 与 iOS SDK 的 macOS（部署目标默认 `15.0`） |
| Web | `wasm32-unknown-unknown` 目标、支持 WebGPU 的安全上下文浏览器（HTTPS 或 `localhost`）；release 构建需 Binaryen 110+（`wasm-opt`） |

## 桌面平台要点

- **Windows**：默认走 Direct3D 12。保留 `src/main.rs` 开头的 `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`，防止 release 版本弹出控制台窗口。
- **macOS**：基于 AppKit 与 Metal（同样调用 `run_desktop()`）。启用 `.with_app_titlebar()` 时保留原生红绿灯按钮并由应用栏提供拖动区。
- **Linux**：同时支持 X11 与 Wayland，发布时确认目标环境已安装对应显示会话库、`libxkbcommon` 与 Vulkan 驱动。

## 移动平台要点

- **Android**：基于 `GameActivity`。全屏界面请使用 `WindowInsets::SystemBars`、`SafeDrawing` 或 `Ime` 避开系统栏与软键盘。`shard_home` 内置预测性返回支持；自定义返回拦截使用 `system_back_handler`。
- **iOS**：必须在主线程调用 `run_ios()`；在模拟器或真机上验证屏幕旋转、安全区域与输入法。需要原生视图集成时在主线程调用 `PluginContext::ui_view()`。

## Web 平台要点

Web 构建通过 WebGPU 直接绘制在 `<canvas>` 中（无 WebGL 回退，也不生成 DOM 树）。模板中 `WebConfig::with_canvas_id(env!("CARGO_CRATE_NAME"))` 与 `gen/web/index.html` 的画布 ID 保持一致。

由于浏览器无法访问系统字体，`ComponentsPackage` 内嵌了启动用 Roboto 字体并按需从 CDN 拉取其余 Roboto / Noto Sans SC 子集；若需离线运行或受限 CSP，请自行注册随包分发的 `Fonts`（见[资源、图片与字体](/zhHans/guide/assets#注册字体)）。

## 无障碍支持范围

AccessKit 适配器在 Windows、macOS、Linux 和 iOS 上启用；Android 与 Web 目前未接入系统读屏适配器，但所有平台都会正常构建语义树并支持自动化测试。
