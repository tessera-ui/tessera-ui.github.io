---
title: 快速开始
order: 0
---

# 快速开始

`tessera-components` 是 `tessera-ui` 的官方组件库，包含了一些常用的基础组件。它完全可选，和 `tessera-ui` 核心库解耦。

## 安装

我们假设你已经添加并配置了 `tessera-ui` 作为你项目的依赖，如果没有，请参考 [快速开始](../guide/getting-started.md)。

接下来添加 `tessera-components` 作为依赖：

```bash
cargo add tessera-components
```

## 注册到渲染器

::: warning
如果使用 `tessera-components` 却未注册对应 package（或管线），渲染器将直接崩溃。
:::

`tessera-ui` 使用去中心化的渲染器架构，所以你需要将 `tessera-components` 注册到渲染器中。推荐在 `entry!` 中注册 package：

```rust
use tessera_components::ComponentsPackage;

tessera_ui::entry!(
    app,
    packages = [ComponentsPackage::default()],
);
```

如果你需要手动初始化 `Renderer`，请在初始化闭包中注册管线：

```rust
use tessera_ui::{Renderer, renderer::TesseraConfig};

fn main() {
    let config = TesseraConfig {
        window_title: "Tessera".to_string(),
        ..Default::default()
    };
    Renderer::run_with_config(
        || app(),
        |app| {
            tessera_components::pipelines::register_pipelines(app);
        },
        config,
    )
    .unwrap();
}
```

## 使用组件

现在你可以在`#[tessera]`函数中使用 `tessera-components` 提供的组件了。这里展示一个使用`surface`做背景的例子

```rust
use tessera_ui::{Color, DimensionValue, tessera};
use tessera_components::surface::{SurfaceArgsBuilder, surface};

#[tessera]
fn app() {
    surface(
        SurfaceArgsBuilder::default()
            .style(Color::WHITE.into())
            .width(DimensionValue::FILLED)
            .height(DimensionValue::FILLED)
            .build()
            .unwrap(),
        None,
        || {
        },
    );
}

tessera_ui::entry!(
    app,
    packages = [tessera_components::ComponentsPackage::default()],
);
```

运行`cargo run`，将会看到一个白色的窗口。

![白色的窗口](/getting-start-2.png)

