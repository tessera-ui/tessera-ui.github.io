---
title: 平台集成与插件
description: 通过 Plugin 接入宿主生命周期、用 TesseraPackage 封装复用能力，以及调用 Android / iOS 原生代码。
---

# 平台集成与插件

当应用需要接入组件树之外的能力——原生 SDK、平台句柄或随宿主启停的服务时，将其封装成 `Plugin`。插件由当前 `RuntimeSession` 持有，接收宿主生命周期回调，并能在会话任意位置按 Rust 类型访问。

```rust
use tessera_components::{ComponentsPackage, text::text, theme::material_theme};
use tessera_ui::{EntryPoint, Plugin, tessera, with_plugin};

struct GreetingPlugin {
    message: String,
}

impl Plugin for GreetingPlugin {}

#[tessera]
fn app() {
    let message = with_plugin::<GreetingPlugin, _>(|plugin| plugin.message.clone())
        .unwrap_or_default();
    material_theme().child(move || {
        text(message.clone());
    });
}

#[tessera_ui::entry]
pub fn run() -> EntryPoint {
    EntryPoint::new(app)
        .package(ComponentsPackage)
        .plugin(GreetingPlugin {
            message: "Hello from the plugin".into(),
        })
}
```

## 访问插件与生命周期钩子

`Plugin` 只需满足 `'static`（钩子和 `with_plugin` 均在 UI 线程运行，不要求 `Send + Sync`）。按需覆写以下钩子：

| 钩子 | 调用时机 |
| --- | --- |
| `on_resumed(&mut self, context: &PluginContext)` | 渲染器创建或恢复平台资源 |
| `on_suspended(&mut self, context: &PluginContext)` | 渲染器挂起并释放平台资源 |
| `on_shutdown(&mut self, context: &PluginContext)` | 渲染器退出 |

在 `on_resumed` 获取句柄，在 `on_suspended` 释放（移动端会多次恢复），在 `on_shutdown` 释放剩余资源。钩子应保持简短，耗时工作交由[后台任务与异步工作](/zhHans/guide/tasks)处理。

`PluginContext` 提供 `window()`、`window_handle()`、`desktop()`（桌面窗口操作），Android 下提供 `android_app()`，iOS 下提供 `ui_view()`。

通过 `with_plugin::<P, _>(|plugin| ...)` 读写已注册的插件（返回 `Option<R>`，无活跃会话或未注册该类型时返回 `None`）。不要在闭包内部重入访问同一插件。

插件字段本身不是响应式状态。需要触发 UI 更新时，将状态存放在通过 `tessera_ui::runtime_resource::<T>()` 持有的 `ModelStore` 与 `State<T>` 中（`tessera-i18n` 即采用此模式）。

## 用 `TesseraPackage` 封装复用包

将插件、`RenderModule` 与子包统一打包进 `TesseraPackage`：

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

应用在入口调用 `.package(GreetingPackage)` 安装。同一插件类型重复注册时保留第一个实例。

## 创建插件 crate

使用 CLI 生成插件脚手架：

```sh
cargo tessera plugin new hello-plugin --template basic
cargo tessera plugin new hello-plugin --template android
```

- `basic`：跨平台 Rust 插件模板，包含 `HelloPlugin` 与类型化访问函数。
- `android`：在 `android/` 下附加 Kotlin 模块，并在 `tessera-config.toml` 的 `[plugin.android]` 中声明。始终直接修改插件自己的 `android/` 目录——每次执行 `android init/build/dev` 都会将其同步进应用的 `gen/android/`。

使用 `tessera_ui::android::jni_bind!` 绑定 Kotlin 静态方法：

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

应用处于恢复状态时，通过 `PluginContext::current()` 获取 `context.android_app()` 并传入 `activity(android_app)` 调用；涉及 Android 视图操作时务必切到 Android UI 线程执行。

### 声明 Android 权限

任意包或插件都可以在 `tessera-config.toml` 中列出所需权限：

```toml
permissions = ["camera", "notifications"]
```

内置支持的别名：`notifications`（`POST_NOTIFICATIONS`）、`camera`（`CAMERA`）、`microphone`（`RECORD_AUDIO`）、`location`（`ACCESS_COARSE_LOCATION`、`ACCESS_FINE_LOCATION`）与 `bluetooth`（`BLUETOOTH_CONNECT`、`BLUETOOTH_SCAN`）。如需列表之外的权限，在应用 `Cargo.toml` 的 `[package.metadata.tessera.android]` `permissions` 中填写完整 Android 权限名。

## iOS 与 UIKit

从 `--template basic` 起步，用 `#[cfg(target_os = "ios")]` 隔离原生代码，并在主线程通过 `context.ui_view()` 获取已 retain 的宿主 `UIView`。UIKit 操作需留在主线程执行；所需用途说明（Usage Description）请通过自定义 `Info.plist` 配置（见[打包与发布](/zhHans/guide/distribution#ios)）。
