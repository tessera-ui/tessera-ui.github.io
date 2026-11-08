---
title: 后台任务
description: 让异步工作有明确的所有者，安全地交付结果，并丢弃过期结果。
---

# 后台任务

加载数据、请求服务器、保存文件都需要时间，而组件构建必须很快完成，还可能反复执行。这类工作作为后台任务运行：从动作或显式的初始化中启动，在构建之外算出结果，再通过状态所有者的调度器把结果送回 UI 状态。让任务也跟随同一个所有者，等需要结果的页面消失时，任务会随之取消。

副作用为什么要放在构建函数体之外，见[生命周期与副作用](/zhHans/guide/lifecycle)。本页介绍执行这些工作的工具。`TaskHandles` 位于 `tessera-shard`，用 `basic` 模板创建的项目需要先添加这个依赖：

```sh
cargo add tessera-shard
```

## 从动作启动任务

下面的组件在点击按钮时启动任务，并显示结果：

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

把这个组件放在应用的 `material_theme()` 之下。示例中已经完成的 future 代替了真实的异步操作。注意其中的分工：任务只负责计算结果，只有传给 `dispatch` 的闭包会接触 UI 状态。

## 在组件出现时启动工作

有些工作应该在页面一显示就开始，比如加载页面要展示的数据。传给 `remember` 的初始化函数只在槽位创建时运行一次，正适合启动这类工作。让初始化函数返回 `TaskHandles`，这个集合和其中的任务就会跟随组件：

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

之后的重建会找到已有的槽位，不再调用初始化函数，所以加载只启动一次。组件离开组件树时，记住的 `TaskHandles` 被丢弃，任务也随之取消。

## 把结果交给所有者

结果需要一个落脚点，而这个落脚点应当有明确的生命周期。在有效的 UI 会话中调用 `StateOwner::new()`，像上面那样用 `remember` 保存所有者，或者把它放在负责这项工作的控制器里。随后 `state_with_key` 会在这个所有者的生命周期内创建状态。启动后台工作之前，先取得 `owner.dispatcher()`。

`State<T>` 虽然满足 `Send + Sync`，读写它仍然要在 UI 线程上进行。在 UI 线程上取得输入的快照，把快照移进任务，再用 `UiDispatcher::dispatch` 把拥有所有权的结果送回来。传入的闭包必须满足 `FnOnce() + Send + 'static`，它会在所属的 UI 会话中、下一次构建之前执行。

调度器不会让 `StateOwner` 保持存活。所有者被关闭或最后一个克隆被丢弃之后，交付随即停止，已经排队但尚未执行的闭包也会被丢弃。目标停止接收工作后，`dispatch` 返回 `false`；返回 `true` 说明闭包已经排队，但如果所有者在它执行前关闭，它仍会被丢弃。让所有者的生命周期跟随页面，只把调度器移进任务。

要更新的状态应当属于同一个所有权范围。绑定到所有者的调度器只保护这个所有者自己的状态，其他组件的状态在闭包执行时可能已经被移除。如果清理代码要访问另一个生命周期里的状态，先检查它的 `is_alive()`。组件和路由的生命周期见[生命周期与副作用](/zhHans/guide/lifecycle)和[导航](/zhHans/guide/navigation)。

## 只接受当前请求

旧结果也可能送到一个仍然存活、但已经换了请求的目标。较早的一次搜索可能在最新一次之后才完成，把新结果覆盖掉。为了避免这种情况，给每个请求一个代次编号，并在交付闭包里比较它，那里可以安全地读取当前的 UI 状态。

对于可能被替换的工作，在第一个示例的构建代码中，紧挨着 `status` 加一个计数器：

```rust
let current_request = owner.with(|owner| {
    owner.state_with_key("request", || 0u64)
});
```

然后把它的 `on_click` 闭包体替换为：

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

在实际应用中，`input` 是查询条件或模型快照，future 执行具体的操作。输入一变，或者请求已经过时，就立即推进代次。对于路由持有的工作，还要考虑这个路由是否仍是预期的目标：用户导航离开后，被保留的路由可能依然存活。

这两种机制各司其职。取消可以省掉无用的工作；真正阻止过期结果的是代次检查，即使取消与完成发生竞争，或者结果已经排队，它依然有效。两者都无法撤销已经完成的外部副作用，例如一次已经落盘的写入。

## 让任务句柄跟随所有者

`tessera_shard::task_handles::TaskHandles` 用来管理一组相关的任务。`spawn` 接受输出为 `()`、满足 `Send + 'static` 的 future。`cancel_all()` 会中止并移除已跟踪的任务，丢弃整个集合同样会取消它们。所以这个集合应该用 `remember` 保存，或者放进路由、控制器的状态里，让它跨越重建保留下来；每次构建都重新创建的集合，每次都会取消里面的任务。创建集合的 UI 会话结束时，其中的任务也会停止。

future 在哪里运行取决于目标平台：

| 目标 | 执行方式 |
| --- | --- |
| 原生平台 | 会话拥有的 Tokio 多线程运行时 |
| Web | 浏览器线程上的 `wasm_bindgen_futures::spawn_local` |

在 Web 上，公开的 `spawn` 仍然要求 `Send`。浏览器里的异步工作和 UI 一起运行在浏览器线程上。请编写适合目标平台的 future，浏览器执行器不提供原生 Tokio 的服务。

::: warning 注意
把阻塞 I/O 和长时间的 CPU 循环放到适合目标平台的工作线程或阻塞任务设施上运行，放在 UI 回调和异步执行器轮询之外，结果仍然通过事先取得的调度器送回。中止 future 并不能打断阻塞代码。取消任务也不会撤回已经排队等待交付的 UI 闭包。
:::

`StateOwner` 和 `UiDispatcher` 见核心 [API 参考](https://tessera-ui.github.io/tessera/tessera_ui/)，`TaskHandles` 见 [shard API 参考](https://tessera-ui.github.io/tessera/tessera_shard/)。随时间变化的界面效果请使用[动画](/zhHans/guide/animation)中介绍的帧时钟。
