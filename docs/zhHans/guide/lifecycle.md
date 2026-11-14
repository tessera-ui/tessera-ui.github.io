---
title: 身份、生命周期与副作用
description: 用 key 绑定动态条目身份、按需选择状态生命周期，并把副作用放在正确的时机。
---

# 身份、生命周期与副作用

组件首次声明时进入树，留存期间按需更新，不再被声明时释放资源。正确标识动态身份并规范放置副作用，能让状态始终对号入座，也不会在重建时意外重复执行操作。

## 位置身份与 `key`

默认情况下，组件的状态按类型、所在控制流分支以及调用顺序匹配。固定布局天然适用，但遇到会增删、重排的列表时，仅靠位置匹配会把旧条目的 UI 状态留给新挪过来的条目。

用 `key(...)` 包住动态列表项，并传入稳定的业务主键（不要用循环索引）：

```rust
use tessera_components::{column::column, md3::{button::button, text::text}};
use tessera_ui::{key, remember, tessera};

#[derive(Clone, PartialEq)]
struct Item {
    id: u64,
    title: String,
}

#[tessera]
fn item_row(item: Item) {
    let expanded = remember(|| false);
    button()
        .on_click(move || expanded.with_mut(|value| *value = !*value))
        .child(move || {
            let mark = if expanded.get() { "v" } else { ">" };
            text(format!("{mark} {}", item.title));
        });
}

#[tessera]
fn item_list(items: Vec<Item>) {
    column().children(move || {
        for item in &items {
            key(item.id, || {
                item_row(item.clone());
            });
        }
    });
}
```

加上 `key(item.id, ...)` 后，每个 `expanded` 状态会跟着自己的 `id` 走。`key` 只需在同一组兄弟之间唯一，实现 `Hash` 即可。（惰性列表自带专门的带键方法，见[列表、网格与滚动](/zhHans/guide/lists)。）

## 用 `remember_with_key` 随输入重置状态

希望某项局部状态在输入切换时自动重置，使用 `remember_with_key(key, init)`：

```rust
use tessera_components::{column::column, md3::{button::button, text::text}};
use tessera_ui::{remember_with_key, tessera};

#[tessera]
fn contact_details(contact_id: u64, #[prop(into)] phone: String) {
    let show_phone = remember_with_key(contact_id, || false);
    column().children(move || {
        if show_phone.get() {
            text(phone.clone());
        }
        button()
            .on_click(move || show_phone.set(true))
            .child(|| text("Show phone number"));
    });
}
```

当 `contact_id` 变化时，`show_phone` 会重新初始化为 `false`。

## 选择合适的作用域与寿命

按数据需要保留的时长选型：

- **`remember` / `remember_with_key`**：在组件挂载且当前分支持续执行时保留；一旦分支隐藏或组件卸载即释放。
- **`retain` / `retain_with_key`**：能跨越条件分支（如切换标签页）留存，直到所属组件卸载或会话重置。使用 `retain_with_key` 时务必保持 key 集合有限且可控，不要对无限列表每条数据保留。
- **`Model`**：与所属 `ModelStore` 同寿命（在 `shard_home` 路由下被新页面覆盖时保留，弹出或替换时关闭）；独立使用时随组件卸载关闭。

```rust
use tessera_components::md3::{button::button, text::text};
use tessera_ui::{retain, tessera};

#[tessera]
fn inbox_tab() {
    let opened = retain(|| 0u32);
    button()
        .on_click(move || opened.with_mut(|n| *n += 1))
        .child(move || text(format!("Opened {} messages", opened.get())));
}

#[tessera]
fn archive_tab() {
    text("Archive");
}

#[tessera]
fn tab_body(selected: usize) {
    if selected == 0 {
        inbox_tab();
    } else {
        archive_tab();
    }
}
```

## 副作用应该放在哪里

不要在组件函数体里直接做网络请求、文件读写或启动定时器——组件体可能反复执行或被跳过。应把副作用放进下面四个位置：

1. **事件回调**（`on_click`、`on_change` 等）：每次用户操作触发一次，适合改状态、调控制器或用 `spawn` 启动任务。
2. **状态初始化闭包**（`remember`、`remember_with_key`、`provide_context`）：仅在建槽时执行一次。
3. **组件绑定任务（`launch` / `launch_once`）**：专门用于构建中声明异步工作。`launch(key, future)` 首次构建时启动；`key` 不变时继续运行；`key` 改变时自动取消旧任务并重启新任务；组件卸载时自动取消：

```rust
use tessera_components::md3::text::text;
use tessera_ui::{Dispatcher, launch, on, remember, tessera};

async fn load_display_name(user_id: u64) -> String {
    format!("User {user_id}")
}

#[tessera]
fn display_name(user_id: u64) {
    let name = remember(|| None::<String>);

    launch(user_id, async move {
        let loaded = on(Dispatcher::Io, load_display_name(user_id)).await;
        name.set(Some(loaded));
    });

    text(name.get().unwrap_or_else(|| String::from("Loading...")));
}
```

4. **所有权与 `Drop`**：把 `Task` 句柄或资源守卫放进 `State` 或 `Model` 字段，所有者结束时自动清理。若 `Drop` 需要访问其他 `State`，先用 `is_alive()` 确认它尚未关闭。

::: warning 构建期间只读状态
在构建体中直接计算派生值，把写入状态留给回调或异步任务。
:::

## 下一步

进入[布局基础](/zhHans/guide/layout)，开始用容器、约束与安全区域搭建界面。
