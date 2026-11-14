---
title: Tessera 的思维方式
description: 理解 #[tessera] 组件、配置句柄、RenderSlot、Callback 以及构建边界的基本规范。
---

# Tessera 的思维方式

写 Tessera 时，你声明“当前状态下的界面长什么样”，而不是去手动修改某个控件实例。状态更新时，Tessera 会重新运行受影响的组件，让屏幕始终对齐最新声明。

## 用函数定义组件

给函数加上 `#[tessera]` 就成了一个组件。普通参数是调用时的必填位置参数；`Option<T>` 参数会变成返回值句柄上的同名可选 setter。

```rust
use tessera_components::md3::text::text;
use tessera_ui::tessera;

#[tessera]
fn greeting(#[prop(into)] name: String, excited: Option<bool>) {
    let mark = if excited.unwrap_or(false) { "!" } else { "." };
    text(format!("Hello, {name}{mark}"));
}

#[tessera]
fn greeting_demo() {
    greeting("Ada").excited(true);
}
```

定义组件参数时遵循这几条约定：

- **必填与可选**：必须由调用方给出的参数写成普通类型（如 `name: String`）；有默认行为的参数写成 `Option<T>`，并在函数体里解析默认值（如 `excited.unwrap_or(false)`）。
- **善用 `#[prop(into)]`**：让字符串或可转换类型接收 `impl Into<T>`，调用方就能直接传 `"Ada"`。
- **拥有所有权且可比较**：参数类型需满足 `Clone + 'static`（以及 `PartialEq`，除非标注了 `#[prop(skip_eq)]`）。

本页代码片段默认运行在应用的 `material_theme()` 下，见[Material 3 主题与视觉样式](/zhHans/guide/theming)。

## 用普通 Rust 写控制流

条件显示和循环直接使用 `if`、`match` 和 `for`：

```rust
use tessera_components::{column::column, md3::text::text};
use tessera_ui::tessera;

#[tessera]
fn greetings(names: Vec<String>) {
    column().children(move || {
        for name in &names {
            text(format!("Hello, {name}"));
        }
    });
}
```

如果列表条目带有局部状态且顺序会变，记得用 `key(...)` 包住每一项，见[身份、生命周期与副作用](/zhHans/guide/lifecycle#用-key-跟踪重排列表)。

## 调用决定顺序，句柄负责配置

调用组件即在当前位置登记一次使用，并返回一个带类型的配置句柄。即便把句柄存进变量再按别的顺序设置属性，树里的排列顺序依然严格按照调用顺序：

```rust
use tessera_components::{md3::text::text, row::row};
use tessera_ui::{Dp, tessera};

#[tessera]
fn heading() {
    row().children(|| {
        let title = text("Title");
        let description = text("Description");

        description.size(Dp(14.0));
        title.size(Dp(24.0));
    });
}
```

最终渲染时 `Title` 仍然排在 `Description` 前面。拿到句柄后应当立即完成配置，不要把配置句柄留到下一次构建再用；跨帧变更应交给[状态与共享](/zhHans/guide/state)或控制器。

## 用 `RenderSlot` 传入子界面

用 `RenderSlot`（或需要向下传参时用 `RenderSlotWith<T>`）接收延迟展开的子内容：

```rust
use tessera_components::{column::column, md3::text::text};
use tessera_ui::{RenderSlot, tessera};

#[tessera]
fn section(#[prop(into)] title: String, child: Option<RenderSlot>) {
    column().children(move || {
        text(title.clone());
        if let Some(child) = child {
            child.render();
        }
    });
}

#[tessera]
fn page() {
    section("Account").child(|| text("Ada"));
}
```

父组件决定是否展开槽、在何处展开以及提供什么上下文。平时直接传闭包给 `.child(|| ...)` 或 `.children(|| ...)`；只有需要保存或转发槽句柄时，才用 `RenderSlot::new(...)` 并通过对应的 `_shared` setter 传入。不要把组件调用本身当成子内容传参——组件调用会在求值处立刻登记。

## 用 `Callback` 上报事件

数据通过参数向下传，操作通过 `Callback` 或 `CallbackWith<T, R>` 向上抛：

```rust
use tessera_components::md3::{button::button, text::text};
use tessera_ui::{Callback, tessera};

#[tessera]
fn click_counter(clicks: u32, on_click: Option<Callback>) {
    button()
        .on_click(move || {
            if let Some(on_click) = on_click {
                on_click.call();
            }
        })
        .child(move || text(format!("Clicked {clicks} times")));
}
```

回调捕获拥有所有权的 `'static` 数据并在 UI 线程执行，不需要满足 `Send + Sync`。需要在回调里读取最新值时，捕获 `State<T>` 句柄并在触发时读取。

## 构建上下文与普通 Rust 的边界

Tessera 明确区分**构建界面的代码**和**普通 Rust 代码**：

- **构建上下文**：`#[tessera]` / `#[shard]` 函数体、入口根闭包（`EntryPoint::new`、`UiTest::content`），以及渲染槽闭包（`RenderSlot`、`RenderSlotWith`、`key`、`provide_context` 和容器的内容闭包）。
- **普通 Rust 上下文**：普通辅助函数、方法、事件回调（`on_click`、`on_change`）、迭代器闭包（`.map(...)`、`.unwrap_or_else(...)`）以及异步任务。

组件调用与构建期 API（`remember`、`retain`、`use_context`、`provide_context`、`launch`、`key`、`RenderSlot::new`）只能出现在构建上下文中。需要复用一段界面时，把它写成 `#[tessera]` 组件函数；需要响应交互时，在回调里更新状态让组件自然重建。提交前用 `cargo tessera check` 校验这些边界。

## 保持组件体纯粹

组件函数在状态变化时会重新运行，在属性不变时会被跳过：

- 在组件体里计算派生值并声明子组件；把 I/O、定时器和请求放到事件回调、初始化闭包或 `launch` 里。
- 不要在构建期间修改 `State`。
- 确实需要隐藏内部字段或跳过属性比较时，使用 `#[prop(skip_setter)]` 或 `#[prop(skip_eq)]`。

## 下一步

继续阅读[状态与共享](/zhHans/guide/state)，了解 `State`、`Model` 和 `Context` 的适用场景。
