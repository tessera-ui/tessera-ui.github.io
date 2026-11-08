---
title: 平台概览
description: Tessera 六个目标平台各自的环境要求与宿主行为。
---

# 平台概览

同一个 Tessera 应用可以用同一棵 Rust 组件树运行在 Windows、macOS、Linux、Android、iOS 和 Web 上。各平台的宿主负责提供窗口或画布、输入、安全区域测量和平台服务。平台之间真正不同的，是应用怎样启动、用什么工具链构建，以及有哪些宿主行为需要你专门测试。

## 一个入口，各平台各自启动

应用只有一个标注了 `#[tessera_ui::entry]` 的入口函数，它返回 `EntryPoint`（见[应用入口与窗口](/zhHans/guide/app)）。每个平台用自己的方法启动这个入口，生成的项目已经把它们都接好了：

| 平台 | 启动方式 | Rust 目标 |
| --- | --- | --- |
| Windows、macOS、Linux | 在 `src/main.rs` 中调用 `run_desktop()` | 主机三元组 |
| iOS | 在 `src/main.rs` 中、于主线程调用 `run_ios()` | `aarch64-apple-ios` 或模拟器三元组 |
| Android | 由 `#[tessera_ui::entry]` 导出的代码调用 `run_android(app)` | 默认 `aarch64-linux-android` |
| Web | 在 `src/lib.rs` 的 `#[wasm_bindgen(start)]` 函数中调用 `run_web()` | `wasm32-unknown-unknown` |

每个方法只在对应的目标上存在，所以调错方法会在编译期报错。生成的 `src/main.rs` 在两个原生方法之间做选择：

```rust
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

Android 和 Web 从库入口进入，所以在这两个目标上 `main` 是空的。开发时怎样在各平台上运行，见[快速开始](/zhHans/guide/getting-started)；怎样生成发布产物，见[打包发布](/zhHans/guide/distribution)。

## 环境要求一览

每个原生目标都需要 Rust 工具链、该目标的原生编译器和链接器，以及渲染器能使用的 GPU 驱动。

| 平台 | 宿主与运行环境要求 |
| --- | --- |
| Windows | Windows 原生构建工具和 SDK；默认渲染器需要支持 Direct3D 12 的显卡与驱动。 |
| macOS | Apple 原生构建工具和 SDK；支持 Metal 的 GPU 与驱动。 |
| Linux | C/C++ 构建工具链、X11 或 Wayland 会话及其客户端库、用于键盘输入的 `libxkbcommon`，以及兼容的 GPU 驱动。 |
| Android | Android SDK 和 NDK、生成的 Gradle 宿主所需的 Java，以及设备或模拟器；生成的 `minSdk` 默认为 `24`。 |
| iOS | macOS、Xcode 和 iOS SDK，以及模拟器或设备；部署目标默认为 iOS `15.0`。 |
| Web | Rust 的 `wasm32-unknown-unknown` 目标，以及在安全上下文中启用了 WebGPU 的浏览器。 |

## Windows

Windows 上的渲染器默认使用 Direct3D 12。请在用户实际使用的硬件和驱动上测试：窗口能打开只说明平台窗口正常，图形适配器是否适合渲染器，要靠真实负载来验证。

生成的 `src/main.rs` 开头有一行 `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]`，它让 release 构建只打开应用窗口，没有多余的控制台，请保留它。应用名称和图标来自 `tessera-app.toml`；修改窗口选项时，保留生成的 `res::application()` 配置。

如果希望标题栏作为界面的一部分来绘制，配合使用 `WindowConfig::with_app_titlebar` 和标记了 `window_chrome(true)` 的应用栏。两者怎样搭配，见[应用入口与窗口](/zhHans/guide/app)。

## macOS

构建前需要安装 Apple 命令行工具和 SDK。窗口由 AppKit 提供，渲染走 Metal。macOS 和其他桌面平台一样使用 `run_desktop()`；`run_ios()` 只用于 iOS，尽管两者都用 Apple 工具链。

集成式标题栏会保留原生的窗口按钮。让应用栏为这些按钮留出空间，内容就不会和按钮重叠。bundle 标识、图标以及 `.app`/`.dmg` 产物见[打包发布](/zhHans/guide/distribution)。

## Linux

默认窗口配置同时支持 X11 和 Wayland。运行时需要图形会话和该会话的客户端库，键盘处理还需要 `libxkbcommon`。各发行版的包名不同，请确认部署环境带有对应会话所需的库。

Linux 上通常走 Vulkan，所以要安装适合这台机器的 GPU 驱动。能否访问 GPU 和有没有显示服务器是两回事，在容器和远程会话里也要单独确认。图形和字体是否可用，除了开发机，还要在实际部署的环境里检查。

保持应用元数据一致，让运行中的窗口和打包后的启动器条目对应同一个应用。

## Android

生成的 Android 宿主使用 GameActivity。它把原生渲染器、键盘和边衬区（inset）处理，以及系统返回分发器接到你的 Rust 应用上。`#[tessera_ui::entry]` 会导出 Android 入口，并把宿主的 `AndroidApp` 交给 `run_android`。

请安装生成的 Gradle 项目所需的 Android SDK、NDK 和 Java 工具。CLI 默认构建 `arm64`（`aarch64-linux-android`）；如果模拟器是其他架构，需要用 `--arch` 指定匹配的架构。生成的最低 SDK 为 `24`，设备的 GPU 和驱动也必须扛得住你的图形负载。

内容可以绘制到系统栏下方。请用 `WindowInsets::SystemBars` 或 `WindowInsets::SafeDrawing` 留出边距，布局会随设备自动适配；如果只关心键盘遮挡，用 `WindowInsets::Ime`。见[布局基础](/zhHans/guide/layout)。

`shard_home` 已经处理好预测性返回：手势进行时预览上一条路由，确认后才真正弹出。在根目标上，系统执行它通常的返回动作。自定义页面和浮层应稳定挂载 `system_back_handler`，预览时保持导航原样，取消时恢复原状，只在确认时导航。见[导航](/zhHans/guide/navigation)。

## iOS

iOS 构建需要 macOS 和 Xcode，CLI 在构建前会用 `xcrun` 检查所选的 SDK。设备构建的目标是 `aarch64-apple-ios`；模拟器构建在 Apple silicon 上是 `aarch64-apple-ios-sim`，在 Intel Mac 上是 `x86_64-apple-ios`。

部署目标默认为 `15.0`。需要修改时设置 `IPHONEOS_DEPLOYMENT_TARGET`，CLI 构建时会读取它。`run_ios()` 要在主线程调用，它是这个目标上唯一的启动方法。

安全区域和键盘请从实时的窗口边衬区读取，并在模拟器或设备上测试旋转和文本编辑。需要从 Rust 访问 UIKit 时，插件可以在主线程通过 `PluginContext::ui_view` 拿到宿主视图，见[平台集成与插件](/zhHans/guide/plugins#ios-与-uikit)。

`cargo tessera ios build` 生成模拟器用的 `.app`，加上 `--device` 则生成签名后的 IPA。签名身份、描述文件和 bundle 设置见[打包发布](/zhHans/guide/distribution#ios)。

## Web

Web 构建以 `wasm32-unknown-unknown` 为目标，通过 WebGPU 渲染，没有 WebGL 回退。请在 HTTPS 或 `localhost` 这类安全上下文中提供应用，并确认浏览器在目标硬件上开放了 WebGPU。

模板中的 `#[wasm_bindgen(start)]` 函数调用 `run_web()`。`WebConfig::with_canvas_id` 按 ID 选择画布，生成的库和 HTML 使用同一个 ID。如果没有配置画布，渲染器会在文档 body 中追加一个。最终得到的是画在 canvas 里的 Rust 界面，而不是一棵 DOM 元素树。

浏览器不允许文本渲染器发现系统字体。组件库内嵌了一份用于启动的 Roboto 字体，其余的 Roboto 和 Noto Sans SC 字体会按需从 CDN 样式表加载，所以部署时要考虑网络访问、CORS 和站点的内容安全策略。如果需要自己控制字体来源，可以注册 `Fonts` 或 `FontStylesheet` 包，见[资源](/zhHans/guide/assets)。

耗时的工作请用浏览器支持的方式异步执行，让 UI 线程保持响应（见[后台任务](/zhHans/guide/tasks)）。怎样部署生成的 `gen/web/` 目录，见[打包发布](/zhHans/guide/distribution#web)。

## 平台服务与无障碍

`ComponentsPackage` 会注册标准的平台服务。编写自己的原生集成时，请使用插件和会话接口，从它们提供的上下文中获取窗口，而不是依赖进程级的全局窗口，见[平台集成与插件](/zhHans/guide/plugins)。

Windows、macOS、Linux 和 iOS 上启用了无障碍适配器；Android 和 Web 没有无障碍适配器，因此不会发布无障碍树。请在所有平台上都为组件声明角色、标签和动作，见[无障碍](/zhHans/guide/accessibility)。
