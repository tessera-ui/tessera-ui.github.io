---
title: Platform integration and plugins
description: Hook into host lifecycle events with Plugin, bundle integrations as TesseraPackage, and call Android/iOS native APIs.
---

# Platform integration and plugins

When an app needs capabilities outside the UI tree—native SDKs, platform handles, or host-managed services—put them in a `Plugin`. Plugins are owned by the active `RuntimeSession`, receive host lifecycle hooks, and are accessed anywhere in that session by Rust type.

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

## Accessing plugins and lifecycle hooks

`Plugin` requires `'static` (no `Send + Sync` bound, since hooks and `with_plugin` run on the UI thread). Override only the hooks you need:

| Hook | Called when |
| --- | --- |
| `on_resumed(&mut self, context: &PluginContext)` | The renderer creates or resumes platform resources |
| `on_suspended(&mut self, context: &PluginContext)` | The renderer suspends and releases platform resources |
| `on_shutdown(&mut self, context: &PluginContext)` | The renderer exits |

Acquire handles in `on_resumed`, release them in `on_suspended` (resume can happen repeatedly on mobile), and release remaining resources in `on_shutdown`. Keep hooks short and offload slow operations to [Background tasks](/guide/tasks).

`PluginContext` exposes `window()`, `window_handle()`, `desktop()` (window actions), `android_app()` on Android, and `ui_view()` on iOS.

Access or mutate a registered plugin with `with_plugin::<P, _>(|plugin| ...)`, which returns `Option<R>` (`None` if no active session exists or `P` was not registered). Do not call `with_plugin` for the same type re-entrantly inside its own closure.

Note that plugin fields are not reactive state. When plugin updates should trigger UI rebuilds, keep the reactive data in a `State<T>` inside a `ModelStore` stored in `tessera_ui::runtime_resource::<T>()` (the pattern used by `tessera-i18n`).

## Sharing integrations via `TesseraPackage`

Wrap plugins, `RenderModule`s, and sub-packages into a reusable `TesseraPackage`:

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

Register it with `.package(GreetingPackage)`. If the same plugin type is registered twice, the first registration wins.

## Scaffolding a plugin crate

Generate a plugin crate with `cargo tessera plugin new`:

```sh
cargo tessera plugin new hello-plugin --template basic
cargo tessera plugin new hello-plugin --template android
```

- `basic`: cross-platform Rust plugin skeleton with `HelloPlugin` and typed helpers.
- `android`: adds a Kotlin module under `android/` configured in `tessera-config.toml` under `[plugin.android]`. Always edit the plugin's own `android/` folder—`cargo tessera android init/build/dev` syncs it into `gen/android/` on every run.

Bind Kotlin static methods with `tessera_ui::android::jni_bind!`:

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

Use `PluginContext::current()` to obtain `context.android_app()` while the app is resumed, pass `activity(android_app)`, and dispatch any Android view work onto the Android UI thread.

### Declaring Android permissions

List required permissions in any package or plugin's `tessera-config.toml`:

```toml
permissions = ["camera", "notifications"]
```

Supported aliases: `notifications` (`POST_NOTIFICATIONS`), `camera` (`CAMERA`), `microphone` (`RECORD_AUDIO`), `location` (`ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`), and `bluetooth` (`BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`). For other permissions, list full Android names under `[package.metadata.tessera.android]` `permissions` in the app's `Cargo.toml`.

## iOS and UIKit

Start from `--template basic`, guard UIKit code with `#[cfg(target_os = "ios")]`, and obtain the retained hosting `UIView` on the main thread via `context.ui_view()` inside `on_resumed` (or `PluginContext::current()`). Keep UIKit calls on the main thread and add any required iOS usage descriptions to a custom `Info.plist` (see [Packaging and release](/guide/distribution#ios)).
