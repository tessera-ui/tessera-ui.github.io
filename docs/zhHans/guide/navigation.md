---
title: 页面导航
description: 使用 tessera-shard 管理页面栈、在路由间保留 Model 状态，并接入系统返回手势。
---

# 页面导航

`tessera-shard` 用目标栈管理多页面应用，`shard_home` 负责渲染当前位于栈顶的目标页。

先添加依赖：

```sh
cargo add tessera-shard
```

一个最小的双页面跳转示例：

```rust
use tessera_components::{
    button::button,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_shard::{RouterController, shard, shard_home, use_router};
use tessera_ui::tessera;

#[shard]
fn home() {
    let router = use_router();
    button()
        .on_click(move || {
            router.with_mut(|router| router.push(DetailDestination { id: 42 }));
        })
        .child(|| text("Open note"));
}

#[shard]
fn detail(id: u64) {
    let router = use_router();
    button()
        .on_click(move || {
            router.with_mut(RouterController::pop);
        })
        .child(move || text(format!("Note {id}: go back")));
}

#[tessera]
pub fn app() {
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(|| {
            shard_home().root(HomeDestination {});
        });
}
```

## 声明页面目标

`#[shard]` 会把自由函数变成组件，并生成同可见性的 `<函数名>Destination` 结构体（如 `detail` 生成 `DetailDestination`，`note_editor` 生成 `NoteEditorDestination`）。

- 除 `Model<T>` 外，函数的所有参数都会成为目标结构体的公共字段。
- 参数类型需拥有所有权且实现 `Clone + PartialEq + 'static`。实践中通常只在目标里传记录 ID，由页面或模型自行加载详情。
- `#[shard]` 本身已经声明了组件边界，不要再叠加 `#[tessera]`。

在 `shard_home` 下的任意组件构建体里调用 `use_router()`，即可拿到当前 `State<RouterController>` 并在回调中驱动跳转。

## 托管与外部控制路由栈

只写 `shard_home().root(HomeDestination {})` 时，控制器由 `shard_home` 内部维护。如果外层导航栏或侧边栏也需要读取或切换页面栈，就由外层 `remember` 一个 `RouterController` 并传入 `.controller(router)`：

```rust
use tessera_components::{
    boxed::boxed,
    column::column,
    navigation_bar::{navigation_bar, navigation_bar_item},
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_shard::{RouterController, shard, shard_home};
use tessera_ui::{Modifier, remember, tessera};

#[shard]
fn inbox() {
    text("Inbox");
}

#[shard]
fn settings() {
    text("Settings");
}

#[tessera]
pub fn app() {
    let router = remember(|| RouterController::with_root(InboxDestination {}));
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(move || {
            column()
                .modifier(Modifier::new().fill_max_size())
                .children(move || {
                    boxed()
                        .modifier(Modifier::new().weight(1.0))
                        .children(move || {
                            shard_home().controller(router);
                        });
                    navigation_bar().content(move |position| {
                        navigation_bar_item()
                            .icon_position(position)
                            .label("Inbox")
                            .selected(router.with(|r| r.current_is::<InboxDestination>()))
                            .on_click(move || router.with_mut(|r| r.reset(InboxDestination {})));
                        navigation_bar_item()
                            .icon_position(position)
                            .label("Settings")
                            .selected(router.with(|r| r.current_is::<SettingsDestination>()))
                            .on_click(move || router.with_mut(|r| r.reset(SettingsDestination {})));
                    });
                });
        });
}
```

挂载 `shard_home` 期间要保持栈不为空。常用的栈操作方法：

| 方法 | 效果 |
| --- | --- |
| `push(destination)` | 压入新的路由实例 |
| `pop()` | 弹出当前路由并关闭其模型（空栈返回 `None`） |
| `replace(destination)` | 替换当前路由并关闭原模型 |
| `reset(destination)` | 清空全部路由并设置新根目标 |
| `clear()` | 清空全部路由 |

可以用 `len()`、`is_empty()`、`last()` 和 `current_is::<D>()` 检查栈状态。自定义返回按钮通常只在 `len() > 1` 时调用 `pop()`。

## 用 `Model<T>` 保留页面状态

新页面压入后，被盖住的页面会离开组件树，普通的 `remember` 状态也会随之释放。想在返回时保留编辑状态或滚动进度，给页面加上 `Model<T>` 参数：

```rust
use tessera_components::{button::button, text::text};
use tessera_shard::shard;
use tessera_ui::{Model, ModelInit, State};

struct EditorModel {
    edits: State<usize>,
}

impl ModelInit for EditorModel {
    fn init() -> Self {
        Self {
            edits: State::new(0),
        }
    }
}

#[shard]
fn editor(model: Model<EditorModel>) {
    let edits = model.with(|model| model.edits);
    button()
        .on_click(move || edits.with_mut(|value| *value += 1))
        .child(move || text(format!("Edits: {}", edits.get())));
}
```

每个路由实例拥有独立的模型存储：

- 路由首次渲染时创建模型，被其他路由覆盖期间一直保留。
- 该路由子树下所有请求 `Model<EditorModel>` 的组件共享同一份实例。
- 路由被弹出、替换或重置时模型关闭，存放在其中的 `Task` 句柄随之取消。
- 即使目标值相等，两次 `push` 也会创建两个互不影响的路由实例。

如果数据需要跨越顶级 Tab 的 `reset` 保留，把模型或 `State` 放在 `shard_home` 外层的应用外壳中，再把需要的句柄传入目标。

## 页面任务与生命周期配合

页面内用 `launch` 启动的任务会在路由被覆盖时停止，返回时重新启动。任务开头先检查模型是否已加载过数据，避免返回时重复请求：

```rust
use tessera_components::text::text;
use tessera_shard::shard;
use tessera_ui::{Dispatcher, Model, ModelInit, State, launch, on};

async fn load_note(id: u64) -> String {
    format!("Note {id}")
}

struct NoteModel {
    body: State<Option<String>>,
}

impl ModelInit for NoteModel {
    fn init() -> Self {
        Self {
            body: State::new(None),
        }
    }
}

#[shard]
fn note(id: u64, model: Model<NoteModel>) {
    let body = model.with(|model| model.body);
    launch(id, async move {
        if body.with(Option::is_some) {
            return;
        }
        let loaded = on(Dispatcher::Io, load_note(id)).await;
        body.set(Some(loaded));
    });
    text(body.get().unwrap_or_else(|| String::from("Loading...")));
}
```

希望在页面被覆盖时仍后台继续的工作（如文件上传），请用 `spawn` 启动并把 `Task` 存进路由的 `Model` 中。

## 系统返回导航

`shard_home` 自动接入了 Android 预测性返回手势：滑动时预览上一页，取消手势恢复当前页，确认手势则弹出路由直到根目标。

自定义浮层或局部拦截返回时，挂载 `tessera_ui::system_back::system_back_handler(enabled, on_back)`：对 `Started`、`Progress` 和 `Cancelled` 只做视觉预览，仅在 `Committed` 时执行实际导航或关闭动作。
