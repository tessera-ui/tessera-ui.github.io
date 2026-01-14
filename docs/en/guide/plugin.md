---
title: Plugins
order: 2
---

# Plugins

In `tessera`, plugins are used to handle platform-specific API calls. Because desktop and mobile system APIs often differ significantly, this chapter first covers desktop plugin development and then moves on to mobile (Android) plugin development.

Plugin scaffolding is provided by the `cargo-tessera` CLI. Install it with:

```bash
cargo install cargo-tessera
```

## Create a desktop plugin

Create a new plugin:

```bash
cargo tessera plugin new
```

This launches an interactive prompt where you can choose a crate name and pick the `basic` template. In the examples below we use `my-plugin` as the plugin name. After creation, enter the plugin directory.

## Plugin structure

A plugin project looks like this:

```text
├── Cargo.lock
├── Cargo.toml
├── README.md
├── src
│   └── lib.rs          # plugin code
└── tessera-plugin.toml # plugin configuration
```

The `tessera-plugin.toml` is mainly used to declare required system permissions and other metadata; for desktop plugins it is not very meaningful yet.

## Loading a plugin

Plugins are loaded by `tessera` by calling their `init` function. In `src/lib.rs` you'll typically see something like:

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

`init` is the plugin initialization function and returns the plugin instance. `with_plugin` is a helper to call plugin-provided APIs from the app; keeping it avoids verbose generic annotations when using `tessera_ui::with_plugin` directly.

To register the plugin in a `tessera` app, add the plugin crate to dependencies and register it:

```rust
tessera_ui::entry!(
    app,
    plugins = [my_plugin],
    pipelines = [tessera_components]
);
```

This will load `my_plugin` when the app starts, so `init` is required.

## Lifecycle events

Plugins can handle the following lifecycle events:

- `on_resumed`: called when the renderer and platform resources are created/resumed.
- `on_suspended`: called when the renderer is suspended and releases platform resources.
- `on_shutdown`: called when the renderer is shutting down.

A typical plugin template looks like:

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

Implement the `Plugin` trait methods in `impl Plugin for HelloPlugin {}` to respond to lifecycle events. For example, adding an `on_resumed` handler:

```rust
impl Plugin for HelloPlugin {
    fn on_resumed(&mut self, _context: &tessera_ui::PluginContext) -> tessera_ui::PluginResult {
        println!("resumed");
        Ok(())
    }
}
```

## System APIs

Lifecycle callbacks receive a `PluginContext` which exposes platform-specific APIs. The available API surface varies per platform. For example, setting the window title using `PluginContext`:

```rust
impl Plugin for HelloPlugin {
    fn on_resumed(&mut self, context: &tessera_ui::PluginContext) -> tessera_ui::PluginResult {
        context.window_handle().set_title("hello-plugin");
        Ok(())
    }
}
```

## Calling plugin APIs from the app

Besides lifecycle callbacks, plugins can expose APIs for the app to call. Since system APIs usually require handles from `PluginContext`, it's common to capture and store needed context during `on_resumed`.

For example, a plugin that exposes a `set_window_title` API:

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

Call the plugin API from the app like this:

```rust
my_plugin::with_plugin(|plugin| {
    plugin.set_window_title("New Title");
});
```

## Create an Android plugin

Android plugins are also scaffolded via `cargo-tessera`.

```bash
cargo tessera plugin new
```

Pick the `android` template and choose a name (we use `my-android-plugin` below). After creation, enter the plugin directory.

## Android plugin structure

An Android plugin looks like:

```text
├── Cargo.lock
├── Cargo.toml
├── README.md
├── android
│   ├── build.gradle.kts
│   └── src                # Android-side plugin code
├── src
│   └── lib.rs             # Rust-side plugin code
└── tessera-plugin.toml    # plugin configuration
```

`tessera-plugin.toml` declares permissions and Android module configuration:

```toml
#:schema https://raw.githubusercontent.com/tessera-ui/tessera/main/docs/schemas/tessera-plugin.schema.json
permissions = []

[android]
module = "my_android_plugin"
```

## Permission declarations

The `permissions` section in `tessera-plugin.toml` lets you declare required system permissions. Tessera defines a cross-platform permission mapping; declaring permissions does not prevent calls on other platforms, but it affects platform packaging (for example, AndroidManifest permissions for Android builds). Current mappings:

| permission | Android permission | Desktop |
| :--- | :--- | :--- |
| notifications | android.permission.POST_NOTIFICATIONS | N/A |
| camera | android.permission.CAMERA | N/A |
| microphone | android.permission.RECORD_AUDIO | N/A |
| location | android.permission.ACCESS_FINE_LOCATION | N/A |
| bluetooth | android.permission.BLUETOOTH | N/A |

For example, if an Android plugin needs notification permission, declare it like:

```toml
#:schema https://raw.githubusercontent.com/tessera-ui/tessera/main/docs/schemas/tessera-plugin.schema.json
permissions = ["notifications"]

[android]
module = "my_android_plugin"
package = "com.tessera.plugin.my_android_plugin"
```

## Android API interop

Android is unique because many system APIs are provided by the JVM. While the NDK exists, most functionality is in the JVM layer, so Android plugins need a way to interact with JVM (Kotlin/Java) code.

Tessera provides a convenient macro to generate Rust⇄Kotlin bindings. In the Android template `src/lib.rs` you may find:

```rust
#[cfg(target_os = "android")]
tessera_ui::android::jni_bind! {
    class "com.tessera.plugin.my_android_plugin.HelloPlugin" as HelloPluginJni {
        fn hello(activity: ActivityRef) -> String;
    }
}
```

On the Kotlin side (e.g., `android/src/main/kotlin/com/tessera/plugin/my_android_plugin/HelloPlugin.kt`) there is an implementation:

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

The `jni_bind!` macro binds the Kotlin class method to Rust, generating a `HelloPluginJni` struct and a `hello` method usable from Rust. In other words, call `HelloPluginJni::hello(activity)` from Rust to invoke the Kotlin `hello` method.

### Using `jni_bind`

`jni_bind!` syntax:

```rust
tessera_ui::android::jni_bind! {
    class "full.class.Name" as StructName {
        fn method_name(arg1: Arg1Type, arg2: Arg2Type, ...) -> ReturnType;
        fn another_method(...) -> ...;
        // ...
    }
}
```

- `class` is the full Kotlin class name to bind.
- `as` specifies the generated Rust struct name.
- `fn` defines method signatures.

Only static (`@JvmStatic`) methods can be bound. Argument types must implement the `JNIArg` trait and return types must implement the `JNIReturn` trait. Tessera provides implementations for common and primitive types. If you need to bind custom types, you must implement the required traits manually.

Sometimes you only need a strongly-typed handle to pass through Rust to JVM without reading its contents on the Rust side. In that case, use the `java_class!` macro to create a type marker instead of implementing full `JNIArg`/`JNIReturn` for that type. For example, given a Kotlin `com.example.Session` class:

```rust
tessera_ui::android::java_class!(pub Session = "com.example.Session");

// Then use JavaObject<Session> in jni_bind signatures:

tessera_ui::android::jni_bind! {
    class "com.example.Session" as SessionJni {
        fn create(context: ContextRef) -> JavaObject<Session>;
        fn ping(session: JavaObject<Session>) -> bool;
        fn close(session: JavaObject<Session>) -> ();
    }
}
```

Corresponding Kotlin implementation:

```kotlin
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

Manual implementations of `JNIArg`/`JNIReturn` for custom classes are not recommended: JNI interop is complex and error-prone, and repeatedly crossing the JNI boundary to read/write custom object contents can hurt performance.

Best practices for JNI bindings:

- Push logic to the JVM side (Kotlin) to reduce JNI calls.
- Keep JVM objects opaque on the Rust side; pass handles rather than reading internal fields.
- Prefer Tessera-provided standard types over implementing custom bindings.

### Using JNI bindings in plugins

Call the generated struct methods directly to invoke Kotlin. The default template binds `HelloPlugin.hello`, which accepts an `ActivityRef`. As shown in the "Calling plugin APIs from the app" section, store `AndroidApp` or activity in `on_resumed` and then pass `ActivityRef` to the generated method.

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

Save the `AndroidApp` and call the Kotlin method:

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

Call it from the app:

```rust
my_android_plugin::with_plugin(|plugin| {
    if let Some(message) = plugin.hello_from_kotlin() {
        println!("Message from Kotlin: {}", message);
    }
});
```
