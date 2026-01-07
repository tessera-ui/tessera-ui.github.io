---
title: 快速开始
order: 1
---

# 快速开始

此章节将引导你创建一个基础的`tessera`应用。

## 安装

### 前置条件

- 已安装 [Rust](https://www.rust-lang.org)

## 创建新项目

首先，确保你已经安装了 `cargo-tessera`，它集成了创建、开发基于 `tessera` App项目所需的各种功能。

```bash
cargo install cargo-tessera
```

然后，使用以下命令创建一个新的`tessera`项目：

```bash
cargo tessera new
```

`cargo-tessera` 会引导你完成项目创建的过程，并生成一个包含基本结构和示例代码的 `tessera` 项目，它会询问你项目名称、使用的模板等。对于本文，我们将使用 `blank` 模板。

创建完成之后，进入项目目录，运行以下命令以启动自动重建:

```bash
cargo tessera dev
```

如果看到和下图一样的一个黑色或者透明的窗口弹出，说明你的应用正在运行中。

![empty](/getting-start-1.png)

## 第一个 `tessera`

在`tessera`中，每个组件都是一个被`tessera`宏标记的函数，所以我们也将组件称为`tessera`。

### 添加背景

首先我们添加一个白色的最大化`surface`作为背景，进入你的项目，打开 `src/app.rs`，找到 `app` 函数，此时它看起来应该是这样的：

```rust
#[tessera]
pub fn app() {
    material_theme(MaterialTheme::default, || {
        // Your app code goes here
    });
}
```

`blank` 模板创建的项目ui入口是app函数，它目前是一个空组件，我们就在其中开始添加内容。首先让我们添加一个surface作为app的背景：

```rust
#[tessera]
pub fn app() {
    material_theme(MaterialTheme::default, || {
        surface(
            SurfaceArgs::default().modifier(Modifier::new().fill_max_size()),
            || {},
        );
    });
}
```

等待 `cargo tessera dev` 完成一次自动重建（或手动重启它），即可看到纯色背景。

![surface](/getting-start-2.png)

### 添加文本

接下来我们在背景上添加一个文本组件，显示"Hello, Tessera!"。

```rust
#[tessera]
pub fn app() {
    material_theme(MaterialTheme::default, || {
        surface(
            SurfaceArgs::default().modifier(Modifier::new().fill_max_size()),
            || {
                text("Hello Tessera!");
            },
        );
    });
}
```

当开发服务器再次重建完成，就可以看到一个白色的窗口和黑色的"Hello, World!"文本。

![hello](/getting-start-3.png)

## 下一步

恭喜你！你已经成功创建了一个简单的`tessera`应用。接下来推荐进一步了解[tessera 组件模型](../guide/component.md)。
