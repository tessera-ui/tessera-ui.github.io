---
title: 平台集成与插件
description: 接入平台生命周期，把集成封装成包，并调用 Android 和 iOS 原生代码。
---

# 平台集成与插件

应用有时需要组件树之外的东西：原生 SDK、平台句柄，或者必须随应用启动和停止的服务。这类东西放在插件里。插件是由会话持有的 Rust 值，它接收宿主的生命周期回调，组件和动作都可以按类型访问它。

下面是一个最小的插件：在入口注册一个实例，再按 Rust 类型读取它。

```rust
use tessera_components::{ComponentsPackage, text::text, theme::material_theme};
use tessera_ui::{EntryPoint, Plugin, tessera, with_plugin};

struct GreetingPlugin {
    message: String,
}

impl Plugin for GreetingPlugin {}

#[tessera]
fn app() {
    let message = with_plugin::<GreetingPlugin, _>(|plugin| plugin.message.clone());
    material_theme().child(move || {
        text(message.clone());
    });
}

#[tessera_ui::entry]
pub fn run() -> EntryPoint {
    EntryPoint::new(app)
        .package(ComponentsPackage)
        .plugin(GreetingPlugin { message: "Hello from the plugin".into() })
}
```

插件是三种扩展方式之一，三者各有分工：组件负责组合界面，`RenderModule` 负责添加 GPU 管线（见[绘制与着色器](/zhHans/guide/drawing)），插件负责应用服务和平台生命周期集成。一个包可以通过入口 API 同时安装这三类东西，见[应用入口与窗口](/zhHans/guide/app)。

## 响应生命周期事件

`Plugin` 要求 `Send + Sync + 'static`。每个钩子都接收 `&mut self` 和 `&PluginContext`，返回 `PluginResult`，并且都有默认实现，只需重写你用得到的：

| 钩子 | 调用时机 |
| --- | --- |
| `on_resumed` | 渲染器创建或恢复平台资源。 |
| `on_suspended` | 渲染器挂起并释放平台资源。 |
| `on_shutdown` | 渲染器退出。 |

依赖生命周期的句柄，在 `on_resumed` 中获取，在 `on_suspended` 中释放。恢复可能发生不止一次，移动端尤其常见，所以每次恢复都要重新获取句柄，之前恢复时拿到的句柄可能已经失效。仍由你持有的资源，在 `on_shutdown` 中释放。钩子运行在宿主的生命周期路径上，应保持简短，耗时的工作交给[后台任务](/zhHans/guide/tasks)。

钩子返回错误时，宿主会记录日志，应用继续运行。`name()` 为插件提供诊断名称，默认是 Rust 类型名。

上下文用于访问宿主。`PluginContext::window()` 借用当前窗口，`window_handle()` 克隆一个拥有所有权的窗口句柄，`desktop()` 提供由宿主管理的窗口操作。Android 和 iOS 另有专用的访问器，见[下文](#在-android-上调用-kotlin)。

## 把集成封装成包

只有你自己的应用用到的插件，用 `EntryPoint::plugin(...)` 注册就够了。想在多个应用之间复用某个集成时，把它包装成 `TesseraPackage`，通过 `EntryRegistry` 注册它需要的一切：

```rust
use tessera_ui::{EntryRegistry, TesseraPackage};

pub struct GreetingPackage;

impl TesseraPackage for GreetingPackage {
    fn register(self, registry: &mut EntryRegistry) {
        registry.register_plugin(GreetingPlugin {
            message: "Hello from the package".into(),
        });
    }
}
```

应用里用 `.package(GreetingPackage)` 注册它即可。包还可以用 `register_package(...)` 引入其他包，用 `add_module(...)` 添加渲染模块。所有注册都在渲染器启动之前完成。

插件实例属于当前 UI 会话，以具体的 Rust 类型为键；`name()` 只用于诊断。同一类型注册两次时，保留第一个实例并记录警告，所以每个插件只注册一次：要么直接注册，要么通过它所在的包注册。

## 读取和更新插件

`with_plugin::<P, R>(...)` 提供共享访问，`with_plugin_mut::<P, R>(...)` 提供可变访问。如果没有注册对应类型的插件，两者都会 panic。闭包应返回拥有所有权的值，例如所需字段的克隆。

动作可以用同一套 API 更新插件：

```rust
use tessera_ui::with_plugin_mut;

fn change_greeting() {
    with_plugin_mut::<GreetingPlugin, _>(|plugin| {
        plugin.message = "Updated greeting".into();
    });
}
```

`change_greeting` 这样的函数应该在动作里调用。插件字段不是响应式状态：修改它不会安排重建，所以第一个示例里的文字仍然显示旧消息。需要反映到界面上的变化，请通过有明确所有者的 `State` 及其调度器发布，见[状态](/zhHans/guide/state)和[后台任务](/zhHans/guide/tasks)。

闭包执行期间插件处于锁定状态。闭包要短；等闭包结束后再访问同一个插件，因为在闭包内部它仍处于锁定状态。对于可能不存在的服务，`tessera_ui::plugin::try_with_plugin` 和 `try_with_plugin_mut` 在没有当前会话或没有对应注册时返回 `None`：

```rust
use tessera_ui::plugin::try_with_plugin;

fn current_greeting() -> String {
    try_with_plugin::<GreetingPlugin, _>(|plugin| plugin.message.clone())
        .unwrap_or_default()
}
```

## 创建插件 crate

CLI 可以用两种模板生成插件 crate。下面两条命令选一条执行，它们都会创建 `hello-plugin` 目录：

```sh
cargo tessera plugin new hello-plugin --template basic
cargo tessera plugin new hello-plugin --template android
```

`basic` 生成一个可在所有支持平台上使用的 Rust 插件，包含 `HelloPlugin`、`HelloPackage` 和一个带类型的 `with_plugin` 辅助函数。`android` 在同一个 Rust crate 上再加一个 Kotlin 模块和 Android 生命周期处理。iOS 插件从 `basic` 开始，再加上按目标平台启用的原生代码。

把生成的 crate 加入应用依赖，再注册它的包：

```rust
EntryPoint::new(app)
    .package(ComponentsPackage)
    .package(hello_plugin::HelloPackage::default())
```

这段代码替换第一个示例中入口函数的函数体。脚手架的 README 说明了公开的辅助函数，以及怎样在本地依赖这个 crate。

## 在 Android 上调用 Kotlin

`android` 模板把 JVM 代码放在 `android/` 下，并在插件的 `tessera-config.toml` 的 `[plugin.android]` 中声明这个模块。执行 `android init`、`android build` 和 `android dev` 时，CLI 会把模块复制到应用生成的 Gradle 项目里。请始终修改插件自己的 `android/` 目录，复制出来的那份每次同步都会被覆盖。

对于上面的 `hello-plugin`，生成的 Kotlin 对象如下：

```kotlin
package com.tessera.plugin.hello_plugin

import android.app.Activity

object HelloPlugin {
    @JvmStatic
    fun hello(activity: Activity): String {
        return "Hello from Kotlin (${activity.packageName})"
    }
}
```

Rust 侧用 `jni_bind!` 声明同一个静态方法：

```rust
#[cfg(target_os = "android")]
use tessera_ui::android::{ActivityRef, activity};

#[cfg(target_os = "android")]
tessera_ui::android::jni_bind! {
    class "com.tessera.plugin.hello_plugin.HelloPlugin" as HelloPluginJni {
        fn hello(activity: ActivityRef) -> String;
    }
}
```

模板在 `on_resumed` 中把 `context.android_app().clone()` 存进 `Option<AndroidApp>`，在 `on_suspended` 中清空。它的 `hello_from_kotlin()` 方法用 `activity(&android_app)` 取得 activity，调用 `HelloPluginJni::hello(&android_app, activity)`，并处理返回的错误。类名、包名和 Kotlin 静态方法签名必须与桥接声明完全一致。Android 视图操作要在 Android UI 线程上执行，通过 JNI 调用的也一样。

## 声明 Android 权限

应用中的任何包，包括插件 crate，都可以在自己的 `tessera-config.toml` 里列出所需的权限：

```toml
permissions = ["camera", "notifications"]
```

Android 构建会从应用及其所有依赖中收集这些列表，并把对应条目写入生成的清单文件：

| 值 | Android 权限 |
| --- | --- |
| `notifications` | `POST_NOTIFICATIONS` |
| `camera` | `CAMERA` |
| `microphone` | `RECORD_AUDIO` |
| `location` | `ACCESS_COARSE_LOCATION`、`ACCESS_FINE_LOCATION` |
| `bluetooth` | `BLUETOOTH_CONNECT`、`BLUETOOTH_SCAN` |

写入其他值会让构建报错并停止。如果需要列表之外的权限，在应用 `Cargo.toml` 的 `[package.metadata.tessera.android]` 下，把完整的 Android 权限名加到 `permissions` 中。声明权限只是把它写进清单，运行时向用户申请仍要由你的原生代码完成。在 iOS 上，应用需要的用途说明请通过自定义的 `Info.plist` 添加（见[打包发布](/zhHans/guide/distribution#ios)）。

## iOS 与 UIKit

在 iOS 上，从 `basic` 脚手架开始，并用 `#[cfg(target_os = "ios")]` 包住 UIKit 代码。在主线程调用 `PluginContext::ui_view()` 时，它返回已 retain 的宿主 `UIView`：

```rust
use tessera_ui::{Plugin, PluginContext, PluginResult};

struct NativeViewPlugin;

impl Plugin for NativeViewPlugin {
    fn on_resumed(&mut self, context: &PluginContext) -> PluginResult {
        #[cfg(target_os = "ios")]
        if let Some(view) = context.ui_view() {
            let _ = view;
        }
        #[cfg(not(target_os = "ios"))]
        let _ = context;
        Ok(())
    }
}
```

这段代码标出 UIKit 代码该写在哪里，具体功能由你实现。在非主线程调用，或者没有兼容的视图时，`ui_view()` 返回 `None`；把工作派发到主线程需要你自己处理。UIKit 访问要留在主线程，挂起时释放依赖生命周期的原生资源。应用本身通过在主线程调用 `EntryPoint::run_ios()` 启动，见[平台概览](/zhHans/guide/platforms)。

插件、包和平台上下文的完整约定，见[核心 API 参考](https://tessera-ui.github.io/tessera/tessera_ui/)。
