---
title: 插件
order: 2
---

# 插件

在 `tessera` 中，插件用于处理各个平台特定的api调用。由于桌面端和移动端的系统api往往具有很大的使用差异，本章将先介绍桌面端的插件开发，再进一步介绍移动端的插件开发。

插件的创建通过 `cargo-tessera` 脚手架完成，可以通过 `cargo install cargo-tessera` 安装该脚手架工具。

## 创建桌面端插件

首先创建一个新的插件。

```bash
cargo tessera plugin new
```

这会展示交互式创建界面，自定义插件的crate名并选择 `basic` 模板。下文以 `my-plugin` 作为插件名说明。创建完成后，进入插件目录。

## 插件结构

插件项目结构如下：

```text
├── Cargo.lock
├── Cargo.toml
├── README.md
├── src
│   └── lib.rs          # 插件代码
└── tessera-plugin.toml # 插件配置
```

`tessera-plugin.toml` 主要用于声明插件需要使用的系统权限等元信息，对于桌面端来说暂时没有意义。

## 插件加载

插件通过被 `tessera` 应用调用 `init` 函数加载。在 `src/lib.rs` 中可以看到如下代码：

```rust
// The registration of the plugin. DO NOT REMOVE
pub fn init() -> impl Plugin {
    HelloPlugin {
        message: format!("Hello from my-plugin"),
    }
}

pub fn with_plugin<R>(f: impl FnOnce(&HelloPlugin) -> R) -> R {
    tessera_ui::with_plugin::<HelloPlugin, R>(f)
}
```

`init` 是插件的初始化函数，返回插件对象。而 `with_plugin` 则是一个辅助函数，用于在应用中方便的调用插件提供的接口。直接使用 `tessera_ui::with_plugin` 需要指定泛型参数，不利于编译器类型推导，最佳实践推荐保留它。

在 `tessera` 应用中，首先将插件crate加入到依赖，然后注册插件：

```rust
tessera_ui::entry!(
    app,
    plugins = [my_plugin],
    pipelines = [tessera_components]
);
```

这会自动在应用启动时加载 `my_plugin` 插件。因此 `init` 函数是必须的。

## 生命周期事件

插件可以响应如下的生命周期事件：

- on_resumed：渲染器创建/恢复平台资源时触发。
- on_suspended：渲染器暂停并释放平台资源时触发。
- on_shutdown：渲染器即将退出时触发。

在 `src/lib.rs` 中可以看到如下的模板：

```rust
pub struct HelloPlugin {
    message: String,
}

impl HelloPlugin {
    pub fn message(&self) -> &str {
        &self.message
    }
}

impl Plugin for HelloPlugin {}
```

其中在 `impl Plugin for HelloPlugin {}` 中实现 `Plugin` trait 的方法即可响应生命周期事件。例如，添加一个 `on_resumed` 事件处理器：

```rust
impl Plugin for HelloPlugin {
    fn on_resumed(&mut self, _context: &tessera_ui::PluginContext) -> tessera_ui::PluginResult {
        println!("resumed");
        Ok(())
    }
}
```

## 系统API

生命周期事件的回调会提供一些系统API的访问接口，即 `PluginContext`，根据不同的平台，提供的接口会有所不同。下面展示使用 `PluginContext` 设置窗口标题的例子。

```rust
impl Plugin for HelloPlugin {
    fn on_resumed(&mut self, context: &tessera_ui::PluginContext) -> tessera_ui::PluginResult {
        context.window_handle().set_title("hello-plugin");
        Ok(())
    }
}
```

## 调用插件

除了生命周期回调以外，插件还可以将系统api调用封装成接口供应用调用。

由于系统api一般需要 `PluginContext` 提供的句柄或者应用上下文，因此一般在 `resumed` 事件中保存需要的上下文。下面展示提供设置窗口标题接口的例子。

```rust
pub struct HelloPlugin {
    windows: Option<Arc<Window>>,
}

impl HelloPlugin {
    pub fn set_window_title(&self, title: &str) {
        if let Some(window) = &self.windows {
            window.set_title(title);
        }
    }
}

impl Plugin for HelloPlugin {
    fn on_resumed(&mut self, context: &tessera_ui::PluginContext) -> tessera_ui::PluginResult {
        self.windows = Some(context.window_handle());
        Ok(())
    }
}
```

在应用中调用该接口：

```rust
my_plugin::with_plugin(|plugin| {
    plugin.set_window_title("New Title");
});
```

## 创建安卓端插件

安卓端插件的创建仍然使用 `cargo-tessera` 脚手架完成。

```bash
cargo tessera plugin new
```

命名插件crate名后，选择 `android` 模板。下文以 `my-android-plugin` 作为插件名说明。创建完成后，进入插件目录。

## 安卓插件结构

安卓插件结构如下：

```text
├── Cargo.lock
├── Cargo.toml
├── README.md
├── android
│   ├── build.gradle.kts
│   └── src                # android侧插件代码
├── src
│   └── lib.rs             # rust侧插件代码
└── tessera-plugin.toml    # 插件配置
```

`tessera-plugin.toml` 用于声明插件需要使用的系统权限和安卓模块的配置信息。

```toml
#:schema https://raw.githubusercontent.com/tessera-ui/tessera/main/docs/schemas/tessera-plugin.schema.json
permissions = []

[android]
module = "my_android_plugin"
```

## 权限声明

`tessera-plugin.toml` 中的 `permission` 段可以声明所需的系统权限。`tessera` 定义了一套跨平台的权限映射，你不会因为没有声明某个权限就被 `tessera` 拒绝对应类别的调用，但它会影响部分平台打包时的权限清单。例如，安卓平台会根据插件声明的权限生成 `AndroidManifest.xml` 中的权限清单。目前的映射关系如下：

| 权限 | 安卓端 | 桌面端 |
| :--- | :--- | :--- |
| notifications | android.permission.POST_NOTIFICATIONS | N/A |
| camera | android.permission.CAMERA | N/A |
| microphone | android.permission.RECORD_AUDIO | N/A |
| location | android.permission.ACCESS_FINE_LOCATION | N/A |
| bluetooth | android.permission.BLUETOOTH | N/A |

举例来说，如果一个安卓插件需要使用通知权限，则需要在 `tessera-plugin.toml` 中如下声明：

```toml
#:schema https://raw.githubusercontent.com/tessera-ui/tessera/main/docs/schemas/tessera-plugin.schema.json
permissions = ["notifications"]

[android]
module = "my_android_plugin"
package = "com.tessera.plugin.my_android_plugin"
```

## 安卓api交互

android较为特殊的一点是它的系统api是由jvm提供的，虽然也有ndk的api，但缺乏绝大多数的功能。因此安卓插件必须要有一种方式和jvm层交互。

`tessera` 提供了一种简便的方式生成rust到kotlin插件代码的绑定。在安卓模板中打开 `src/lib.rs`，可以看到如下代码：

```rust
#[cfg(target_os = "android")]
tessera_ui::android::jni_bind! {
    class "com.tessera.plugin.my_android_plugin.HelloPlugin" as HelloPluginJni {
        fn hello(activity: ActivityRef) -> String;
    }
}
```

在 `android/src/main/kotlin/com/tessera/plugin/my_android_plugin/HelloPlugin.kt` 中可以看到对应的kotlin实现：

```kotlin
package com.tessera.plugin.my_android_plugin

import android.app.Activity

object HelloPlugin {
    @JvmStatic
    fun hello(activity: Activity): String {
        return "Hello from Kotlin (${activity.packageName})"
    }
}
```

`jni_bind!` 宏将 `com.tessera.plugin.my_android_plugin.HelloPlugin` 类的 `hello` 方法绑定到rust侧。它会自动生成 `HelloPluginJni` 结构体，并提供 `hello` 方法供rust侧调用。也就是说，可以在rust侧直接调用 `HelloPluginJni::hello(activity)` 来调用kotlin侧的 `hello` 方法。

### 使用jni_bind

jni_bind宏的语法如下：

```rust
tessera_ui::android::jni_bind! {
    class "full.class.Name" as StructName {
        fn method_name(arg1: Arg1Type, arg2: Arg2Type, ...) -> ReturnType;
        fn another_method(...) -> ...;
        // ...
    }
}
```

- `class` 指定要绑定的kotlin类的完整类名。
- `as` 指定生成的rust结构体名。
- `fn` 定义要绑定的方法签名。

需要注意的是，它只能绑定静态方法（`@JvmStatic` 注解的方法）。此外，参数使用的类型必须实现了 `JNIArg` trait，返回值类型必须实现了 `JNIReturn` trait。`tessera` 已经为常用类型和基本类型实现了这些trait。如果需要绑定自定义类型，则需要手动实现。

有些时候完全不关心jvm对象的内容在rust侧的意义，只是需要一个强类型句柄来传递给jvm侧的方法。此时不应该为该类型实现完整的 `JNIArg` 或 `JNIReturn`，而是使用 `java_class!` 宏创建类型标记。举例来说，假设有一个kotlin类 `com.example.Session`，而我们有两个jvm方法分别可以获取和使用该类的实例：

```rust
tessera_ui::android::java_class!(pub Session = "com.example.Session");
```

然后，使用 `JavaObject` 包装该类型，就可以作为实现了 `JNIArg` 和 `JNIReturn` 的类型使用：

```rust
tessera_ui::android::jni_bind! {
    class "com.example.Session" as SessionJni {
        fn create(context: ContextRef) -> JavaObject<Session>;
        fn ping(session: JavaObject<Session>) -> bool;
        fn close(session: JavaObject<Session>) -> ();
    }
}
```

对应的kotlin侧实现：

```kotlin
// Kotlin
package com.example

import android.content.Context

class Session private constructor() {
companion object {
    @JvmStatic
    fun create(context: Context): Session = Session()
}

@JvmStatic
fun ping(): Boolean = true

@JvmStatic
fun close() { }
}
```

并不推荐为自定义类编写手动实现 `JNIArg` 和 `JNIReturn` 对应的rust绑定。因为jni交互是相对复杂而且容易出错的过程，同时反复跨越jni边界，尝试在rust侧有意义的读写自定义类的内容容易导致反复跨越jni边界的写法，从而影响性能。

jni绑定是一个相对复杂的主题，使用时应当遵守下面的最佳实践：

- 逻辑下沉：尽量将逻辑放在 JVM (Kotlin) 侧实现，减少跨越 JNI 边界的调用次数。
- 保持不透明：不要尝试在 Rust 侧读写复杂的 JVM 对象内容，而是将其视为不透明句柄传递。
- 使用标准类型：优先使用 Tessera 已实现绑定的基础类型，避免手动实现复杂的自定义类型绑定。

### 在插件中使用jni绑定

直接调用 `jni_bind!` 宏生成的结构体方法即可调用对应的kotlin方法。在默认模板中绑定的是 `HelloPlugin` 类的 `hello` 方法。它要求传入一个 `ActivityRef` 参数，表示当前的Acitivity对象。如[调用插件](#调用插件)章节所示，可以在 `on_resumed` 事件中获取 `PluginContext`，然后通过 `PluginContext` 获取平台特定的上下文，这里是 `AndroidApp`。

```rust
impl Plugin for HelloPlugin {
    fn on_resumed(&mut self, ctx: &PluginContext) -> PluginResult {
        #[cfg(target_os = "android")]
        {
            self.android_app = Some(ctx.android_app().clone());
        }
        Ok(())
    }

    fn on_suspended(&mut self, _ctx: &PluginContext) -> PluginResult {
        #[cfg(target_os = "android")]
        {
            self.android_app = None;
        }
        Ok(())
    }
}
```

保存 `AndroidApp` 后，就可以将它转为 `ActivityRef` 传递给 `HelloPluginJni::hello` 方法：

```rust
impl HelloPlugin {
    #[cfg(target_os = "android")]
    pub fn hello_from_kotlin(&self) -> Option<String> {
        let android_app = self.android_app?;
        let activity = activity(&android_app);
        match HelloPluginJni::hello(&android_app, activity) {
            Ok(value) => Some(value),
            Err(err) => {
                eprintln!("JNI call failed: {err}");
                None
            }
        }
    }
}
```

在应用中调用该接口：

```rust
my_android_plugin::with_plugin(|plugin| {
    if let Some(message) = plugin.hello_from_kotlin() {
        println!("Message from Kotlin: {}", message);
    }
});
```
