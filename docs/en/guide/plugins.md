---
title: Platform integration and plugins
description: Hook into the platform lifecycle, share integrations as packages and call native Android and iOS code.
---

# Platform integration and plugins

When your app needs something that lives outside the component tree, such as a native SDK, a platform handle or a service that must start and stop with the app, you put it in a plugin. A plugin is a Rust value that the session owns, receives lifecycle callbacks from the host, and can be reached from components and actions by its type.

Here is the smallest useful plugin: register one instance at the entry, then read it by its Rust type.

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

Plugins are one of three extension points, and each has its own job: components compose UI, a `RenderModule` adds GPU pipelines (see [Drawing and shaders](/guide/drawing)), and a plugin holds application services and platform lifecycle integration. A package can install any mix of the three through the entry APIs described in [Entry point and windows](/guide/app).

## Respond to lifecycle events

`Plugin` requires `Send + Sync + 'static`. Every hook takes `&mut self` and a `&PluginContext`, returns `PluginResult`, and has a default implementation, so you override only the ones you need:

| Hook | Called when |
| --- | --- |
| `on_resumed` | The renderer creates or resumes platform resources. |
| `on_suspended` | The renderer suspends and releases platform resources. |
| `on_shutdown` | The renderer shuts down. |

Acquire lifecycle-bound handles in `on_resumed` and release them in `on_suspended`. Resume can happen more than once, especially on mobile, so acquire the handle again on each resume; one from an earlier resume may already be invalid. Release anything you still own in `on_shutdown`. Hooks run on the host's lifecycle path, so keep them short and move slow work to [background tasks](/guide/tasks).

If a hook returns an error, the host logs it and the app keeps running. `name()` gives the plugin a diagnostic name and defaults to the Rust type name.

The context gives you access to the host. `PluginContext::window()` borrows the active window, `window_handle()` clones an owned handle to it, and `desktop()` exposes host-managed window actions. Android and iOS add their own accessors, described [below](#call-kotlin-on-android).

## Share an integration as a package

`EntryPoint::plugin(...)` is fine for a plugin that only your app uses. When you want to reuse an integration across apps, wrap it in a `TesseraPackage` that registers everything it needs through `EntryRegistry`:

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

The app then registers it with `.package(GreetingPackage)`. A package can also pull in other packages with `register_package(...)` and add render modules with `add_module(...)`. All registration happens before the renderer starts.

Plugin instances belong to the active UI session and are keyed by their concrete Rust type; `name()` is only for diagnostics. If the same type is registered twice, the first instance wins and a warning is logged, so register each plugin once, either directly or through its package.

## Read and update a plugin

`with_plugin::<P, R>(...)` gives you shared access and `with_plugin_mut::<P, R>(...)` gives you mutable access. Both panic if no plugin of that type was registered. Return an owned value from the closure, such as a clone of the field you need.

An action can update the plugin through the same API:

```rust
use tessera_ui::with_plugin_mut;

fn change_greeting() {
    with_plugin_mut::<GreetingPlugin, _>(|plugin| {
        plugin.message = "Updated greeting".into();
    });
}
```

Call a function like `change_greeting` from an action. Plugin fields are not reactive state: changing one does not schedule a rebuild, so the text in the first example keeps showing the old message. When a change should appear in the UI, publish it through an explicitly owned `State` and its dispatcher; see [State](/guide/state) and [Background tasks](/guide/tasks).

The closure runs while the plugin is locked. Keep it short, and finish with the plugin before you access it again: inside the closure, that plugin is still locked. For services that may be absent, `tessera_ui::plugin::try_with_plugin` and `try_with_plugin_mut` return `None` when there is no active session or no matching registration:

```rust
use tessera_ui::plugin::try_with_plugin;

fn current_greeting() -> String {
    try_with_plugin::<GreetingPlugin, _>(|plugin| plugin.message.clone())
        .unwrap_or_default()
}
```

## Create a plugin crate

The CLI can scaffold a plugin crate from one of two templates. Pick one of these commands; both create a `hello-plugin` directory:

```sh
cargo tessera plugin new hello-plugin --template basic
cargo tessera plugin new hello-plugin --template android
```

`basic` creates a Rust plugin that works on every supported platform, with a `HelloPlugin`, a `HelloPackage` and a typed `with_plugin` helper. `android` adds a Kotlin module and Android lifecycle handling to the same Rust crate. For iOS, start from `basic` and add target-gated native code.

Add the generated crate to your app's dependencies and register its package:

```rust
EntryPoint::new(app)
    .package(ComponentsPackage)
    .package(hello_plugin::HelloPackage::default())
```

This fragment replaces the entry body from the first example. The scaffold's README explains the public helper and how to depend on the crate locally.

## Call Kotlin on Android

The `android` template keeps its JVM code under `android/` and declares that module in the plugin's `tessera-config.toml`, under `[plugin.android]`. During `android init`, `android build` and `android dev`, the CLI copies the module into the app's generated Gradle project. Always edit the plugin's own `android/` directory; the copy is replaced on every sync.

For the `hello-plugin` name above, the generated Kotlin object looks like this:

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

On the Rust side, `jni_bind!` declares the same static method:

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

The template stores `context.android_app().clone()` in an `Option<AndroidApp>` during `on_resumed` and clears it in `on_suspended`. Its `hello_from_kotlin()` method gets the activity with `activity(&android_app)`, calls `HelloPluginJni::hello(&android_app, activity)` and handles the returned error. The class name, package and static Kotlin signature must match the bridge declaration exactly. Run Android view operations on the Android UI thread, including the ones you reach through JNI.

## Declare Android permissions

Any package in your app, including a plugin crate, can list the permissions it needs in its `tessera-config.toml`:

```toml
permissions = ["camera", "notifications"]
```

The Android build collects these lists from the app and all of its dependencies and writes the matching entries into the generated manifest:

| Value | Android permissions |
| --- | --- |
| `notifications` | `POST_NOTIFICATIONS` |
| `camera` | `CAMERA` |
| `microphone` | `RECORD_AUDIO` |
| `location` | `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` |
| `bluetooth` | `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN` |

Any other value stops the build with an error. For a permission outside this list, add the full Android name to `permissions` under `[package.metadata.tessera.android]` in the app's `Cargo.toml`. Declaring a permission only puts it in the manifest; asking the user at runtime is still up to your native code. On iOS, add the usage descriptions your app needs through a custom `Info.plist` (see [Packaging and release](/guide/distribution#ios)).

## iOS and UIKit

On iOS, start from the `basic` scaffold and guard UIKit code with `#[cfg(target_os = "ios")]`. `PluginContext::ui_view()` returns the hosting `UIView`, retained, when called on the main thread:

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

This sketch marks where your UIKit code goes; the feature itself is yours to write. `ui_view()` returns `None` off the main thread or when no compatible view is available, and dispatching work to the main thread is up to you. Keep UIKit access on the main thread and release lifecycle-bound native resources on suspension. The app itself starts with `EntryPoint::run_ios()` on the main thread, as described in [Platforms](/guide/platforms).

The [core API reference](https://tessera-ui.github.io/tessera/tessera_ui/) documents the full plugin, package and platform context contracts.
