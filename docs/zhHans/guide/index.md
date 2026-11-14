---
title: 介绍
description: Tessera 是一个纯 Rust 声明式 UI 框架，基于 wgpu 在桌面、移动端和 Web 上直接绘制界面。
---

# 介绍

Tessera 用普通的 Rust 函数和响应式状态描述界面，直接通过 `wgpu` 把每一帧画到屏幕上。不套 WebView，也不依赖系统原生控件，同一份代码可以编译到 Windows、macOS、Linux、Android、iOS 和浏览器。

## 用 Rust 函数声明界面

组件就是标注了 `#[tessera]` 的函数。调用组件会在当前位置声明这块界面，并返回一个配置句柄供链式设置可选参数；子界面放进闭包，跨更新保留的数据放进 `remember` 返回的状态句柄。

```rust
use tessera_components::{
    column::column,
    md3::{button::button, surface::surface, text::text, theme::material_theme},
};
use tessera_foundation::modifier::ModifierExt as _;
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

`remember(|| 0i32)` 在组件首次挂载时初始化计数，之后每次重建都返回同一个 `State<i32>` 句柄。点击按钮修改计数，读取了 `count.get()` 的文本随之重建。外层 `material_theme()` 提供颜色、排版和圆角，`surface()` 铺满窗口背景，`column()` 把文字和按钮上下排列。

通过 `cargo tessera` 创建的项目已经在 `src/lib.rs` 里接好了 `EntryPoint` 和 `ComponentsPackage`，所有平台都从这同一个入口启动，见[项目结构](/zhHans/guide/project-structure)。

## 核心 Crate 分工

新项目默认包含前三个 crate：

- **`tessera-ui`**：核心运行时，提供 `#[tessera]`、`State` 与 `Model`、`Modifier`、`EntryPoint`、布局/绘制扩展 trait，以及 `UiTest` 测试框架。
- **`tessera-foundation`**：与设计系统无关的基础原语，包括对齐、`Shape`、手势识别以及布局/语义修饰符。
- **`tessera-components`**：根模块提供与设计系统无关的布局与媒体原语（`row`、`column`、`boxed`、`image`、`pager` 等），Material 3 Expressive 控件与主题位于 `tessera_components::md3`，实验性玻璃效果位于 `tessera_components::experiment`。
- **`tessera-platform`**：桌面窗口控制与剪贴板服务（由 `ComponentsPackage` 自动安装）。
- **`tessera-shard`**：页面栈导航（`#[shard]`、`shard_home`、`RouterController`）与路由作用域模型。需要多页面时通过 `cargo add tessera-shard` 添加。

多语言在 `tessera-i18n`，资源与语言目录编译生成在 `tessera-build`，脚手架、检查和各平台打包由 `cargo tessera` 命令行工具完成。

各控件的完整参数和控制器方法见[组件 API 参考](https://tessera-ui.github.io/tessera/tessera_components/)与[运行时 API 参考](https://tessera-ui.github.io/tessera/tessera_ui/)，实际渲染效果可以在[在线 WebGPU 示例](https://tessera-ui.github.io/tessera/example/)里体验。

## 阅读路线

- **快速上手**：按[快速开始](/zhHans/guide/getting-started)装好 CLI 并运行项目，然后跟着[教程：购物清单](/zhHans/guide/tutorial)做完第一个小应用。
- **掌握核心模型**：阅读[Tessera 的思维方式](/zhHans/guide/thinking-in-tessera)、[状态与共享](/zhHans/guide/state)和[身份、生命周期与副作用](/zhHans/guide/lifecycle)。
- **界面与发布**：从[布局基础](/zhHans/guide/layout)开始构建界面，在[应用入口、窗口与会话](/zhHans/guide/app)组织工程，发布时参考[目标平台](/zhHans/guide/platforms)与[打包与发布](/zhHans/guide/distribution)。
