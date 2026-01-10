---
title: 快速开始
order: 0
---

# 快速开始

`tessera-ui-basic-components` 是 `tessera-ui` 的官方组件库，包含了一些常用的基础组件。它完全可选，和 `tessera-ui` 核心库解耦。

## 安装

我们假设你已经添加并配置了 `tessera-ui` 作为你项目的依赖，如果没有，请参考 [快速开始](../guide/getting-started.md)。

接下来添加 `tessera-ui-basic-components` 作为依赖：

```bash
cargo add tessera-ui-basic-components
```

## 注册到渲染器

::: warning
如果不注册对应管线到渲染器中，渲染器将直接崩溃。
:::

`tessera-ui` 使用去中心化的渲染器架构，所以你需要将 `tessera-ui-basic-components` 注册到渲染器中。

假设你原来的渲染器初始化代码如下：

```rust
use tessera_ui::{Renderer, renderer::TesseraConfig};

fn main() {
    let config = TesseraConfig {
        window_title: "Tessera".to_string(), // 设置窗口标题
        ..Default::default()
    };
    Renderer::run_with_config(
        || {}, // UI入口函数
        |app| {},
        config,
    )
    .unwrap();
}
```

那么你需要做如下修改：

```rust
use tessera_ui::{Renderer, renderer::TesseraConfig};

fn main() {
    let config = TesseraConfig {
        window_title: "Tessera".to_string(), // 设置窗口标题
        ..Default::default()
    };
    Renderer::run_with_config(
        || {}, // UI入口函数
        |app| {
            tessera_ui_basic_components::pipelines::register_pipelines(app); // 注册基本组件库的渲染管线
        },
        config,
    )
    .unwrap();
}
```

## 使用组件

现在你可以在`#[tessera]`函数中使用 `tessera-ui-basic-components` 提供的组件了。这里展示一个使用`surface`做背景的例子

```rust
use tessera_ui::{Color, DimensionValue, Renderer, renderer::TesseraConfig, tessera};
use tessera_ui_basic_components::surface::{SurfaceArgsBuilder, surface};

fn main() {
    let config = TesseraConfig {
        window_title: "Tessera Example".to_string(), // 设置窗口标题
        ..Default::default()
    };
    Renderer::run_with_config(
        || app(), // UI入口，也就是顶层的tessera
        |app| {
            tessera_ui_basic_components::pipelines::register_pipelines(app); // 注册渲染管线
        },
        config,
    )
    .unwrap();
}

#[tessera]
fn app() {
    surface(
        SurfaceArgsBuilder::default()
            .style(Color::WHITE.into()) // 设置surface的背景颜色为白色
            .width(DimensionValue::FILLED) // 这代表对surface的约束是填满父组件宽度
            .height(DimensionValue::FILLED) // 这代表对surface的约束是填满父组件高度
            .build()
            .unwrap(),
        None, // 第二个参数传入的是ripple动画状态，这是用于点击的水波纹动画的，我们的背景surface不需要点击，所以传None
        || {
            // surface是一个经典的容器组件，可以用来放置其他组件，目前我们放一个空闭包占位
        },
    );
}
```

运行`cargo run`，将会看到一个白色的窗口。

![白色的窗口](/getting-start-2.png)
