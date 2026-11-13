---
title: 后台任务与异步工作
description: 用 launch 与 spawn 组织归属明确的异步任务，按需取消过期请求并安全写回状态。
---

# 后台任务与异步工作

网络请求、文件读写和耗时计算都需要时间，而组件构建必须迅速完成。把异步工作放进任务里运行，准备好后再写回 `State`。每个任务都有清晰的所有权：丢弃 `Task` 句柄或改变 `launch` 的 key 都会自动取消任务。

`tessera_ui` 提供四个原语：

| API | 适用场景 |
| --- | --- |
| `launch(key, future)` | 随挂载组件和当前 `key` 存续的异步工作 |
| `launch_once(future)` | 组件挂载期间只启动一次的异步工作 |
| `spawn(dispatcher, future)` | 从动作中启动任务，返回由你持有生命周期的 `Task` |
| `on(dispatcher, future)` | 把任务中的某段工作切到指定调度器运行并等待结果 |

为什么不在组件体里直接跑副作用，见[身份、生命周期与副作用](/zhHans/guide/lifecycle)。

## 随组件加载数据（`launch`）

`launch` 把任务绑定到组件调用位置，当 `key` 变化时自动取消旧任务并启动新任务：

```rust
use tessera_components::text::text;
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

- 首次构建启动 future；后续重建传入相等的 `key` 时继续运行原有任务。
- `key` 变化时取消前一个任务并启动新任务；组件离开界面树时自动取消。

外层 future 运行在 UI 会话线程上，可以捕获 `!Send` 值并直接写回 `name`，耗时的请求通过 `on(Dispatcher::Io, ...)` 交到 I/O 线程。任务不需要随输入重启时使用 `launch_once(future)`。

## 从动作与模型启动任务（`spawn`）

点击按钮等动作使用 `spawn` 启动任务，并把返回的 `Task` 存进 `Model` 字段——新请求覆盖字段时自动取消旧请求，模型关闭时也会自动清理进行中的任务：

```rust
use tessera_components::{button::button, column::column, text::text};
use tessera_ui::{Dispatcher, Model, ModelInit, State, Task, on, spawn, tessera};

async fn fetch_results(query: String) -> Vec<String> {
    vec![format!("Result for {query}")]
}

struct SearchModel {
    results: State<Vec<String>>,
    request: Option<Task>,
}

impl ModelInit for SearchModel {
    fn init() -> Self {
        Self {
            results: State::new(Vec::new()),
            request: None,
        }
    }
}

impl SearchModel {
    fn search(&mut self, query: String) {
        let results = self.results;
        self.request = Some(spawn(Dispatcher::Ui, async move {
            let found = on(Dispatcher::Io, fetch_results(query)).await;
            results.set(found);
        }));
    }
}

#[tessera]
fn search_panel(model: Model<SearchModel>) {
    let results = model.with(|model| model.results);

    column().children(move || {
        for result in results.get() {
            text(result);
        }
        button()
            .on_click(move || model.with_mut(|model| model.search(String::from("tessera"))))
            .child(|| text("Search"));
    });
}
```

模型上跨 `.await` 的异步操作接收 `model: Model<Self>`，在等待点之间读取或更新模型：

```rust
impl SearchModel {
    async fn refresh(model: Model<Self>) {
        let found = on(Dispatcher::Io, fetch_results(String::new())).await;
        model.with(|model| model.results.set(found));
    }
}

// 在 `search_panel` 中：
launch_once(SearchModel::refresh(model));
```

只有明确希望任务脱手运行到结束时才调用 `Task::detach()`；用 `task.is_finished()` 检查是否结束。

## 选择调度器

| 调度器 | 运行位置 |
| --- | --- |
| `Dispatcher::Ui` | 所属 UI 会话线程，在帧间轮询 |
| `Dispatcher::Io` | 支持阻塞操作的 I/O 线程池 |
| `Dispatcher::Default` | 按 CPU 核心数配置的计算线程池 |

`spawn` 要求 future 满足 `Send + 'static`，`launch` 和 `launch_once` 接受非 `Send` 的 future。在原生平台上，所有调度器均内置 Tokio 1 运行时上下文（可直接依赖 `tokio = "1"`）；在 Web 上所有调度器均运行在浏览器事件循环中。

推荐外层用 `Dispatcher::Ui`、耗时部分用 `on(Dispatcher::Io, ...)` 的模式：所有状态写入都在 UI 线程完成，取消在 `.await` 恢复前立即阻止过期写入。若在其他调度器直接写 `State<T>`（`T: Send`），切勿让 UI 线程阻塞等待正在访问状态的后台线程，否则会互相等待造成死锁。

::: warning 不要在 `Dispatcher::Ui` 上运行阻塞调用
取消只能停在下一个 `.await` 处，无法打断同步阻塞代码。阻塞 I/O 与密集计算务必放在 `Dispatcher::Io` 或 `Dispatcher::Default`。
:::

## 下一步

继续阅读[动画](/zhHans/guide/animation)，了解如何用 `launch` 配合 `with_frame_time` 驱动帧同步动画。
