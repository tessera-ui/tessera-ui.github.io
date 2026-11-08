---
title: Background tasks
description: Run asynchronous work with a clear owner, deliver its results safely, and drop stale ones.
---

# Background tasks

Loading data, calling a server or saving a file takes time, while a component build has to finish quickly and may run many times. Run that work as a background task: start it from an action or an explicit initializer, let it compute a result off the build, and hand the result back to UI state through a dispatcher that belongs to whatever owns the state. Tie the task to the same owner, and it is cancelled when the screen that wanted the result goes away.

[Lifecycle and side effects](/guide/lifecycle) explains why side effects stay out of the build body. This page covers the tools for the work itself. `TaskHandles` lives in `tessera-shard`; projects created from the `basic` template need to add that dependency first:

```sh
cargo add tessera-shard
```

## Run a task from an action

The following component starts a task when you click the button and shows its result:

```rust
use tessera_components::{button::button, column::column, text::text};
use tessera_shard::task_handles::TaskHandles;
use tessera_ui::{StateOwner, remember, tessera};

#[tessera]
fn task_status() {
    let owner = remember(StateOwner::new);
    let (status, dispatcher) = owner.with(|owner| {
        (
            owner.state_with_key("status", || String::from("Idle")),
            owner.dispatcher(),
        )
    });
    let tasks = remember(TaskHandles::new);

    column().children(move || {
        text(status.get());
        let dispatcher = dispatcher.clone();
        button()
            .on_click(move || {
                let dispatcher = dispatcher.clone();
                tasks.with(|tasks| tasks.spawn(async move {
                    let message = std::future::ready(String::from("Ready")).await;
                    dispatcher.dispatch(move || status.set(message));
                }));
            })
            .child(|| text("Run"));
    });
}
```

Place this component beneath your app's `material_theme()`. The already-completed future stands in for your real asynchronous operation. Notice the division of labor: the task only computes a result, and only the closure passed to `dispatch` touches UI state.

## Start work when a component appears

Some work should begin as soon as a screen is shown, such as loading the data it displays. The initializer passed to `remember` runs once, when its slot is created, so it is a natural place to start that work. Return the `TaskHandles` from the initializer so the collection, and the job inside it, stays tied to the component:

```rust
use tessera_components::text::text;
use tessera_shard::task_handles::TaskHandles;
use tessera_ui::{StateOwner, remember, tessera};

#[tessera]
fn welcome_message() {
    let owner = remember(StateOwner::new);
    let (message, dispatcher) = owner.with(|owner| {
        (
            owner.state_with_key("message", || None::<String>),
            owner.dispatcher(),
        )
    });
    let _tasks = remember(move || {
        let tasks = TaskHandles::new();
        tasks.spawn(async move {
            let loaded = std::future::ready(String::from("Welcome back")).await;
            dispatcher.dispatch(move || message.set(Some(loaded)));
        });
        tasks
    });

    match message.get() {
        Some(value) => { text(value); }
        None => { text("Loading…"); }
    }
}
```

Later rebuilds find the existing slot and skip the initializer, so the load starts only once. When the component leaves the tree, its remembered `TaskHandles` is dropped and the job is cancelled with it.

## Deliver results to an owner

A result needs somewhere to land, and that destination should have a clear lifetime. Create `StateOwner::new()` inside the active UI session and keep the owner either with `remember`, as above, or in the controller that owns the work. `state_with_key` then creates state inside that owner's lifetime. Capture `owner.dispatcher()` before you start the background work.

`State<T>` is `Send + Sync`, but reads and writes still belong on the UI thread. Take snapshots of the inputs on the UI thread, move the snapshots into the task, and send owned results back with `UiDispatcher::dispatch`. The closure you pass must be `FnOnce() + Send + 'static`; it runs in the owning UI session before a subsequent build.

The dispatcher does not keep its `StateOwner` alive. Once the owner is closed or its last clone is dropped, delivery stops, and closures that were already queued but had not run yet are dropped too. `dispatch` returns `false` when the destination has stopped accepting work. A `true` return means the closure was queued; it can still be dropped if the owner closes before it runs. Let the owner's lifetime follow the screen, and move only the dispatcher into the task.

Keep the state you update inside the same ownership scope. An owner-scoped dispatcher protects only its own owner's state, so state from unrelated components may already have been removed by the time it runs. If cleanup touches state from another lifetime, check that state's `is_alive()` first. [Lifecycle and side effects](/guide/lifecycle) and [Navigation](/guide/navigation) describe component and route lifetimes.

## Accept only the current request

An old result can also reach a destination that is still alive but has moved on. A search for an earlier query can finish after the latest one and overwrite it. To prevent this, give each request a generation number and compare it inside the dispatched closure, where you can safely read the current UI state.

For work that can be replaced, add a counter next to `status` in the first example's build:

```rust
let current_request = owner.with(|owner| {
    owner.state_with_key("request", || 0u64)
});
```

Then replace the body of its `on_click` with:

```rust
let request = current_request.with_mut(|value| {
    *value += 1;
    *value
});
tasks.with(TaskHandles::cancel_all);
let dispatcher = dispatcher.clone();
let input = String::from("Ready");

tasks.with(|tasks| tasks.spawn(async move {
    let message = std::future::ready(input).await;
    dispatcher.dispatch(move || {
        if current_request.get() == request {
            status.set(message);
        }
    });
}));
```

In a real app, `input` would be the query or a model snapshot and the future would perform the operation. Advance the generation as soon as the inputs change or the request stops being relevant. For route-owned work, also consider whether the route is still the intended destination: a retained route may still be alive after the user navigates away.

The two mechanisms do different jobs. Cancellation saves wasted work. The generation check is what actually prevents stale results, even when cancellation races with completion or a result is already queued. Neither one rolls back an external side effect, such as a write that has already completed.

## Keep task handles with their owner

`tessera_shard::task_handles::TaskHandles` groups related jobs. `spawn` takes a future whose output is `()` and which is `Send + 'static`. `cancel_all()` aborts and removes the tracked jobs, and dropping the collection cancels them as well. That is why the collection should be remembered or stored in route or controller state, where it survives rebuilds; a collection recreated on each build would cancel its jobs every time. Jobs also stop when the UI session that created the collection ends.

Where the futures run depends on the target:

| Target | Execution |
| --- | --- |
| Native | A session-owned Tokio multi-thread runtime |
| Web | `wasm_bindgen_futures::spawn_local` on the browser thread |

On the web, the public `spawn` bound is still `Send`. Asynchronous work in the browser runs on the browser thread, alongside the UI. Write futures that suit the target; the browser executor does not provide native Tokio services.

::: warning
Run blocking I/O and long CPU loops on a worker or blocking-work facility that fits the target, outside UI callbacks and asynchronous executor polling, and return the result through the captured dispatcher. Aborting a future does not interrupt blocking code. Cancelling a task also does not recall closures that are already queued for UI delivery.
:::

The core [API reference](https://tessera-ui.github.io/tessera/tessera_ui/) documents `StateOwner` and `UiDispatcher`; `TaskHandles` is in the [shard API reference](https://tessera-ui.github.io/tessera/tessera_shard/). For time-based UI changes, use the frame clock described in [Animation](/guide/animation).
