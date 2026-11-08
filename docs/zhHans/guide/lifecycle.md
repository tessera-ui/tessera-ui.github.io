---
title: 生命周期与副作用
description: 了解 Tessera 如何把状态对应到组件、状态能保留多久，以及副作用应该放在哪里。
---

# 生命周期与副作用

组件第一次被声明时进入树，留在树中期间会重建零次或多次，等到某次重建不再声明它时离开。弄清 Tessera 如何在重建之间认出“同一个组件”、各种状态能保留多久，你就能让状态待在用户预期的地方，也能让带副作用的工作只执行一次。

## Tessera 如何识别组件

记住的状态与三样东西关联：组件身份、所在的控制流作用域，以及作用域内的调用顺序。落到实际代码上，就是调用位置：同一个父组件在同一处调用的同一个组件，在下一次重建中仍是同一个实例，并拿回它记住的状态。

调用顺序适合固定的布局，但遇到条目会移动的集合就不够用了。如果列表只按位置区分条目，在最前面插入一项，所有条目都会往后挪一格，状态却留在原位，于是第三行的“展开”标记就落到了新挪到第三位的条目身上。

## 用 key 标识列表项

用 `key` 包住每个条目，并传入稳定的业务标识，例如记录 ID。下标会随条目移动而变化，它标识的是位置，而不是条目：

```rust
use tessera_components::{button::button, column::column, text::text};
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

放进 key 作用域之后，列表重新排序或插入新条目时，每一行的 `expanded` 状态都会跟着自己的条目走。key 只需要在同级之间唯一，任何实现了 `Hash` 的值都可以。

key 决定的是身份。条目的 key 一旦改变，Tessera 就把它当作新条目，从全新的状态开始；旧 key 下的值仍留在旧 key 名下。惰性列表有自己的条目 key，它们不会让滚出视口的条目保留状态，见[列表与滚动](/zhHans/guide/lists)。

## 输入变化时重置状态

`remember_with_key` 把同样的思路用在单个状态槽上。它在当前组件和作用域内为状态槽命名。key 变化时，你会从初始化闭包拿到一个全新的值。想在所描述的数据变化时重置局部状态，这是最简单的办法：

```rust
use tessera_components::{button::button, column::column, text::text};
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

key 把“显示号码”绑定到一位联系人上：切换到下一位联系人时，号码会重新隐藏。

## 状态能保留多久

不同种类的状态生命周期不同，请按值应当保留的时长来选择。

### `remember`：状态槽还在使用时

`remember` 和 `remember_with_key` 的状态，只要构建还会执行到这次调用，就会一直保留。如果组件重建时没有再执行到这次调用（例如某个 `if` 分支不再进入），或者组件离开了树，这个槽就可能被释放。子组件单独重建时，父组件保留自己的状态。

### `retain`：直到状态重置

有时你希望组件不在时值也能留下来，例如切回某个标签页时恢复离开前的样子。`retain` 和 `retain_with_key` 在声明不再使用时仍会保留状态槽，组件离开树也不例外：

```rust
use tessera_components::{button::button, text::text};
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

切到归档再切回来，计数仍然不变，因为 `inbox_tab` 以相同的身份回到树中，找到了保留下来的槽。身份不同则会从头开始。保留的槽会一直存在，直到状态重置或 UI 会话结束。

::: warning 注意
保留的槽会一直存在，直到状态重置或会话结束。保留状态时请使用有限的 key 集合；如果每个列表项一个 key，这些槽会在整个会话期间不断累积。需要更长的生命周期时用 `retain`，其他情况用 `remember`。
:::

渲染器挂起时（例如 Android 应用转入后台、窗口被销毁时），Tessera 会重置 `remember` 和 `retain` 的组件状态。`StateOwner` 持有的状态会保留下来。

### `StateOwner`：直到你关闭它

如果状态应该随控制器或服务一起释放，而不是随组件释放，就交给 [`StateOwner`](/zhHans/guide/state#为状态指定显式所有者)。如果状态应该跟随导航路由，就使用 [shard 状态](/zhHans/guide/navigation)。

## 关闭状态所有者

调用所有者的 `close()`，或者丢弃它的最后一个克隆，它的生命周期就结束了。无论哪种方式，它都会释放全部状态，调度器也不再交付结果，已经排队但还没执行的闭包也不例外。即使还有其他克隆存在，`close()` 也会立即生效。如果控制器被多处共享，而它的工作有明确的终点（比如退出登录），这一点就很有用。

用 `remember` 保存的所有者，会在那个槽被释放时一并丢弃（除非别处还有它的克隆），这样一来它的生命周期又跟回了组件。如果希望它比某一次挂载活得更久，请把它保存在控制器、路由或其他长期存在的地方。

所有者关闭后，指向其状态的句柄就过期了。如果清理代码可能在另一个所有者结束之后才运行，访问那份状态之前，先在状态或所有者上检查 `is_alive()`。

## 在构建之外执行副作用

副作用是组件在声明界面之外做的任何事情：网络请求、写文件、记录日志、启动计时器。组件体可能运行很多次，也可能被跳过，所以直接写在函数体里的副作用，执行次数是无法预料的。Tessera 提供了三个能让副作用按预期执行的位置。

**动作。** `on_click` 这类事件回调在构建之外运行，每个事件执行一次。大多数副作用都应该放在这里：修改状态、调用控制器、启动任务。

**初始化闭包。** 传给 `remember`、`remember_with_key` 或 `provide_context` 的闭包只在对应的槽创建时执行。配合 key 使用时，初始化闭包对每个 key 值只启动一次工作，而槽的生命周期决定这项工作何时被清理：

```rust
use tessera_components::text::text;
use tessera_shard::task_handles::TaskHandles;
use tessera_ui::{StateOwner, remember, remember_with_key, tessera};

async fn load_display_name(user_id: u64) -> String {
    format!("User {user_id}")
}

#[tessera]
fn display_name(user_id: u64) {
    let owner = remember(StateOwner::new);
    let (name, dispatcher) = owner.with(|owner| {
        (
            owner.state_with_key("name", || None::<String>),
            owner.dispatcher(),
        )
    });

    let _tasks = remember_with_key(user_id, move || {
        let tasks = TaskHandles::new();
        tasks.spawn(async move {
            let loaded = load_display_name(user_id).await;
            dispatcher.dispatch(move || name.set(Some(loaded)));
        });
        tasks
    });

    text(name.get().unwrap_or_else(|| String::from("Loading...")));
}
```

`display_name` 第一次出现时会发起请求，之后每当 `user_id` 变化都会再发起一次。`TaskHandles` 来自 `tessera-shard`（用 `cargo add tessera-shard` 添加），被丢弃时会取消其中的任务。所以 key 变化或组件离开树时，Tessera 释放旧的槽，旧请求也随之取消。不过，取消并不能撤回已经排队等待交付的结果；如果请求进行中输入可能变化，还要确认结果仍然对应当前请求，做法见[后台任务](/zhHans/guide/tasks)。

**帧回调。** 动画在构建中通过 `receive_frame_nanos` 注册，Tessera 会按调用位置管理这个订阅。回调负责更新状态，读取该状态的组件随之重建并显示新值。详见[动画](/zhHans/guide/animation)。

::: warning 注意
在动作中写入状态，派生值在构建时就地计算。构建期间的写入会让已经用旧值运行过的读取者再重建一次，白白增加工作量。
:::

## 借助所有权完成清理

清理逻辑写在 `Drop` 里。Tessera 释放一个槽时，会丢弃槽中保存的值：记住的 `TaskHandles` 会取消自己的任务，记住的 `StateOwner` 在最后一个克隆消失时释放状态。把每项资源交给与它生命周期一致的所有者，无论是组件的状态槽、控制器的 `StateOwner` 还是路由，所有者离开时资源就会被清理。

## 下一步

运行时间更长的工作光靠初始化闭包还不够：还需要为输入拍快照、安全地交付结果、丢弃过期的结果。这些内容在[后台任务](/zhHans/guide/tasks)中有完整介绍。
