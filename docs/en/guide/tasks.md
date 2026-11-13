---
title: Background tasks
description: Run asynchronous work tied to the component or model that owns its result, and cancel stale work cleanly.
---

# Background tasks

Network requests, disk I/O, and heavy computation take time, whereas component builds must stay fast. Run asynchronous work as tasks and write results back into `State`. Every task belongs to a handle or build call—dropping the handle or changing the key cancels the task automatically.

`tessera_ui` provides four primitives:

| API | Use it for |
| --- | --- |
| `launch(key, future)` | Work tied to a mounted component and its current `key` |
| `launch_once(future)` | Work started once while the component stays mounted |
| `spawn(dispatcher, future)` | Work started from an action; returns a `Task` handle you own |
| `on(dispatcher, future)` | Running part of a task on another dispatcher and awaiting its result |

See [Identity, lifecycle, and effects](/guide/lifecycle) for why side effects stay out of plain build logic.

## Loading data in a component (`launch`)

`launch` ties a task to the component call and restarts it whenever `key` changes:

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

- First build starts `future`; equal keys on later builds keep the running task alive.
- A changed `key` cancels the previous task and starts the new one.
- Unmounting the component cancels the task.

Because the outer `future` runs on the UI session (first polled after the current build), it can capture `!Send` values and write directly into `name`, while `on(Dispatcher::Io, ...)` runs the I/O work off the UI thread. Use `launch_once(future)` when the task should not restart on input changes.

## Running tasks from actions and models (`spawn`)

Start action-driven work with `spawn` and keep the returned `Task` on the owning `Model` so replacing the field cancels any superseded request, and closing the model cancels in-flight work:

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

For multi-step async methods on a model, accept `model: Model<Self>` and access fields between `.await` points:

```rust
impl SearchModel {
    async fn refresh(model: Model<Self>) {
        let found = on(Dispatcher::Io, fetch_results(String::new())).await;
        model.with(|model| model.results.set(found));
    }
}

// Inside `search_panel`:
launch_once(SearchModel::refresh(model));
```

Call `Task::detach()` only when fire-and-forget work should outlive its handle; check `task.is_finished()` to inspect completion.

## Choosing a dispatcher

| Dispatcher | Where it runs |
| --- | --- |
| `Dispatcher::Ui` | The owning UI session, polled between frames |
| `Dispatcher::Io` | Blocking-capable worker threads with a Tokio 1 runtime context |
| `Dispatcher::Default` | Compute thread pool sized for CPU work |

`spawn` requires `Send + 'static` futures; `launch` and `launch_once` allow `!Send` futures. On native targets every dispatcher provides a Tokio 1 runtime context (`tokio = "1"` works out of the box); on the web, all dispatchers run on the browser's event loop.

Running the outer task on `Dispatcher::Ui` and offloading slow work via `on(Dispatcher::Io, ...)` keeps state writes on the UI thread, where cancellation prevents stale writes immediately before `.await` resumes. When updating `State<T>` (`T: Send`) directly from another dispatcher, synchronization happens at frame boundaries—never block the UI thread waiting on a thread that is accessing UI state.

::: warning Keep blocking calls off `Dispatcher::Ui`
Cancellation stops a future at its next `.await` and cannot interrupt synchronous code. Always put blocking I/O or heavy CPU loops on `Dispatcher::Io` or `Dispatcher::Default`.
:::

## Next steps

Read [Animation](/guide/animation) to see how `launch` and `with_frame_time` drive frame-synchronized motion.
