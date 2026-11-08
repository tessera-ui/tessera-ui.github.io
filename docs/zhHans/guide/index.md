---
title: 介绍
description: Tessera 是一个 Rust UI 框架，用函数和响应式状态构建界面，并在 GPU 上绘制。
---

# 介绍

在 Tessera 里，你用普通的 Rust 函数描述界面，框架负责让屏幕始终和数据保持一致。所有内容都由 Tessera 通过 wgpu 自行绘制，因此同一份代码可以运行在 Windows、macOS、Linux、Android、iOS 和 Web 上。

## Tessera 界面如何工作

组件就是一个标注了 `#[tessera]` 的 Rust 函数，调用它就是在声明“这里有这一块界面”。返回的句柄上的 setter 用来配置这次使用，闭包则提供子内容。状态变化时，Tessera 会重建读取了该状态的组件，新的声明就成了新的界面。

下面是一个完整的根组件，一个计数器：

```rust
use tessera_components::{
    button::button, column::column, modifier::ModifierExt as _, surface::surface,
    text::text, theme::material_theme,
};
use tessera_ui::{Dp, Modifier, remember, tessera};

#[tessera]
pub fn app() {
    let count = remember(|| 0i32);
    material_theme().child(move || {
        surface()
            .modifier(Modifier::new().fill_max_size())
            .child(move || {
                column()
                    .modifier(Modifier::new().padding_all(Dp(16.0)))
                    .children(move || {
                        text(format!("Count: {}", count.get()));
                        button()
                            .filled()
                            .on_click(move || count.with_mut(|n| *n += 1))
                            .child(|| text("Increment"));
                    });
            });
    });
}
```

`remember` 只在状态槽创建时初始化一次计数，之后的每次重建都会保留它。点击回调修改这个值，而构建文字时读取了它，所以每次点击都会重建显示数字的那部分界面。外层的 Material 主题向其下所有内容提供颜色、字体排版和形状，`surface` 铺满窗口并绘制背景，`column` 则把文字放在按钮上方。

启动代码由 CLI 生成。用 CLI 创建的项目里，`src/lib.rs` 会为这个根组件创建 `EntryPoint`，并注册 `ComponentsPackage`，为组件库安装所需的渲染和平台服务。桌面程序、Android、iOS 和 Web 启动的都是同一个入口。这些文件详见[项目结构](/zhHans/guide/project-structure)。

## 用什么来构建

在每个平台上，包括浏览器，界面都由 Tessera 自己的渲染器直接绘制。功能分布在几个 crate 中，新项目默认依赖前两个。

- **`tessera-ui`** 是运行时，提供 `#[tessera]`、`remember` 等状态、`Modifier`、应用入口、布局与绘制的扩展接口，以及测试会话。
- **`tessera-components`** 是组件库，包含 Material 3 Expressive 控件、主题、布局容器、图片、图标、字体和视觉效果。大多数应用都基于它来构建；超出它范围的需求，你可以自己实现布局和渲染。
- **`tessera-shard`** 提供页面导航、限定在页面范围内的状态，以及成组管理的后台任务。需要[导航](/zhHans/guide/navigation)或[后台任务](/zhHans/guide/tasks)时，用 `cargo add tessera-shard` 添加它。

多语言支持在 `tessera-i18n` 中。生成项目的构建脚本使用 `tessera-build`，把配置、资源和语言目录转换成 Rust 代码。`cargo tessera` 命令行工具负责在各个平台上创建、运行、检查和打包项目。

这些指南借助控件来讲解概念。每个控件的参数、默认值和控制器方法请查阅[组件 API 参考](https://tessera-ui.github.io/tessera/tessera_components/)和[运行时 API 参考](https://tessera-ui.github.io/tessera/tessera_ui/)。想直观看看组件库的效果，可以打开[在线示例](https://tessera-ui.github.io/tessera/example/)。

## 下一步

先阅读[快速开始](/zhHans/guide/getting-started)，安装工具并运行一个新项目，然后跟着[教程](/zhHans/guide/tutorial)一步步做出一个小应用。

应用跑起来之后，可以按需选择阅读顺序。[Tessera 的思维方式](/zhHans/guide/thinking-in-tessera)和[状态](/zhHans/guide/state)解释了上面计数器背后的模型；从[布局基础](/zhHans/guide/layout)开始的界面章节介绍用户看到和操作的部分；从[应用入口与窗口](/zhHans/guide/app)开始的章节讲解如何组织、测试和交付应用。准备发布时，[平台概览](/zhHans/guide/platforms)和[打包发布](/zhHans/guide/distribution)会介绍各个目标平台。
