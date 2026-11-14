---
title: 状态与共享
description: 用 remember 管理局部状态、通过状态提升共享数据、用 Model 组织页面逻辑，并用 Context 传递环境默认值。
---

# 状态与共享

组件函数在界面更新时会重新运行，普通局部变量无法跨帧保留。使用 `State`、`Model` 和 `Context`，为每份数据指定明确的所有者，让屏幕随数据自动同步。

## 用 `remember` 保存组件局部状态

`remember` 在组件首次挂载时初始化值，并返回一个轻量的 `Copy` 句柄（`State<T>`）：

```rust
use tessera_components::{column::column, md3::{button::button, text::text}};
use tessera_ui::{State, remember, tessera};

#[tessera]
fn count_label(count: State<i32>) {
    text(format!("Count: {}", count.get()));
}

#[tessera]
fn counter() {
    let count = remember(|| 0i32);
    column().children(move || {
        count_label(count);
        button()
            .on_click(move || count.with_mut(|n| *n += 1))
            .child(|| text("Increment"));
    });
}
```

只在构建上下文中调用 `remember`（以及 `remember_with_key`、`retain`、`retain_with_key`），不要放进事件回调或普通辅助函数。保存的值必须满足 `'static`，可以是 `!Send`（例如 `Rc`），此时句柄留在 UI 线程上使用。

## 读写 `State<T>`

| 方法 | 行为 |
| --- | --- |
| `get()` | 克隆当前值（要求 `T: Clone`）。 |
| `with(f)` | 在闭包 `f` 内借用 `&T`。 |
| `set(value)` | 替换值并通知读取者更新。 |
| `with_mut(f)` | 可变借用 `&mut T` 修改值并通知读取者更新。 |
| `set_if_changed(value)` | 仅当 `value != current` 时才替换并通知（要求 `T: PartialEq`），返回是否变化。 |
| `is_alive()` | 判断底层状态是否仍有效。 |

`State<T>` 实现了 `Copy`，直接移入多个闭包即可，无需 `.clone()`。当 `T: Send` 时，`State<T>` 同时满足 `Send + Sync`，可在后台任务中用同一套方法安全读写。如果清理逻辑可能比所有者活得更久，先用 `is_alive()` 检查后再访问。

## 在叶子节点读取状态

在构建期间调用 `get()` 或 `with(...)` 会让当前组件订阅该状态；事件回调里的读取发生在构建之外，不会建立订阅。

**把 `State<T>` 句柄传下去，在真正需要显示的最小叶子组件里再读取。** 上面的计数器里，`counter` 只传递句柄不读取它，点击按钮时就只会重建 `count_label`。

结构体较大时用短生命周期的 `with(|v| ...)` 借用；经常算出相同结果的计算，用 `set_if_changed` 避免无意义的更新。

## 状态提升与派生计算

当父组件或兄弟组件需要读取、约束同一份数据时，把状态提升到它们最近的共同祖先，让子组件接收当前值并通过回调上报修改：

```rust
use tessera_components::{md3::{button::button, text::text}, row::row};
use tessera_ui::{CallbackWith, remember, tessera};

#[tessera]
fn stepper(value: i32, on_change: Option<CallbackWith<i32>>) {
    row().children(move || {
        button()
            .on_click(move || {
                if let Some(on_change) = on_change {
                    on_change.call(value - 1);
                }
            })
            .child(|| text("-"));
        text(value.to_string());
        button()
            .on_click(move || {
                if let Some(on_change) = on_change {
                    on_change.call(value + 1);
                }
            })
            .child(|| text("+"));
    });
}

#[tessera]
fn order_line() {
    let quantity = remember(|| 1i32);
    stepper(quantity.get()).on_change(move |value: i32| quantity.set(value.max(1)));
}
```

文本编辑、滚动位置这类持续交互状态，直接保留并传入对应的控制器（`TextInputController`、`ScrollableController`、`LazyListController`）。

能从已有状态算出来的值，直接在构建时计算，不要另建一个 `State` 去手动双份同步：

```rust
use tessera_components::md3::text::text;
use tessera_ui::{State, tessera};

#[derive(Clone, PartialEq)]
struct Task {
    title: String,
    done: bool,
}

#[tessera]
fn remaining_label(tasks: State<Vec<Task>>) {
    let remaining = tasks.with(|tasks| tasks.iter().filter(|task| !task.done).count());
    text(format!("{remaining} left"));
}
```

## 用 `Model<T>` 组织页面与业务状态

当一个页面或功能模块包含多项操作、内部缓存和后台 `Task` 时，为其实现 `ModelInit`。UI 要读取的字段在 `init()` 中用 `State::new(...)` 创建，无需触发刷新的内部字段（缓存、任务句柄）作为普通私有字段由 `&mut self` 方法维护：

```rust
use tessera_components::{column::column, md3::{button::button, text::text}};
use tessera_ui::{Model, ModelInit, State, key, tessera};

struct Selection {
    selected: State<Option<u64>>,
    history: Vec<u64>,
}

impl ModelInit for Selection {
    fn init() -> Self {
        Self {
            selected: State::new(None),
            history: Vec::new(),
        }
    }
}

impl Selection {
    fn select(&mut self, id: u64) {
        self.history.push(id);
        self.selected.set(Some(id));
    }
}

#[tessera]
fn contact_list(contacts: Vec<(u64, String)>, selection: Model<Selection>) {
    let selected = selection.with(|selection| selection.selected);
    column().children(move || {
        for (id, name) in &contacts {
            let id = *id;
            let marker = if selected.get() == Some(id) { "> " } else { "" };
            let label = format!("{marker}{name}");
            key(id, || {
                button()
                    .on_click(move || selection.with_mut(|selection| selection.select(id)))
                    .child(move || text(label.clone()));
            });
        }
    });
}
```

`Model<T>` 同样是 `Copy` 句柄（`T: Send` 时 `Send + Sync`）。只有读取内部的 `State` 字段才会订阅更新，修改 `history` 这类普通字段不会触发界面重建。

组件声明 `Model<T>` 参数后有两种用法：

- 调用时省略（`contact_list(contacts)`），由框架注入：在 `ModelStoreScope`（如 `shard_home` 路由）下按类型共享同一实例；否则随当前组件同生共死。
- 通过 setter 显式传入已有句柄（`contact_list(contacts).selection(existing_model)`），由调用方决定作用域。

请始终在 `ModelInit::init` 或 `ModelStore::model` 中调用 `State::new`，也不要把 `remember` 状态放进 `Model` 字段。需要独立控制模型作用域时，可自行创建 `ModelStore` 并通过 `provide_context(store.scope(), ...)` 提供给子树。

## 用 `Context` 传递环境默认值

使用 `provide_context(value, content)` 与 `use_context::<T>()` 为整棵子树提供主题、字号、内容颜色等环境配置，避免层层透传：

```rust
use tessera_components::{column::column, md3::{text::text, theme::ContentColor}};
use tessera_ui::{Color, provide_context, tessera};

#[tessera]
fn warning_block() {
    provide_context(ContentColor { current: Color::RED }, || {
        column().children(|| {
            text("Storage almost full");
            text("Free up space to keep syncing.");
        });
    });
}
```

`use_context::<T>()` 返回 `Option<Context<T>>`。在构建期间调用 `.get()` 或 `.with(...)` 会自动订阅该上下文的变化。

::: warning 保持 Context 的纯粹性
把 `Context` 留给主题与视觉默认值。业务数据和控制器应通过显式参数传递，事件通过回调上报，让组件的依赖一目了然。
:::

## 下一步

阅读[身份、生命周期与副作用](/zhHans/guide/lifecycle)，合理选择不同状态的保留范围，并把副作用放在正确的位置。
