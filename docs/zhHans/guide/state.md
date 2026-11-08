---
title: 状态
description: 让数据在重建之间保留，决定由谁持有它，并把它交给需要的组件。
---

# 状态

Tessera 每次重建组件都会重新执行组件函数，所以局部变量只在一次执行内有效。状态让值能够跨越重建保留下来；修改状态，也就是在告诉 Tessera 界面的哪些部分需要更新。

## 在重建之间记住一个值

用 `remember` 保存一个值，它就会在重建之间保留。`remember` 返回一个 `State<T>` 句柄，复制和传递的成本都很低。下面的计数器把计数保存在记住的状态里，再把句柄交给负责显示的子组件：

```rust
use tessera_components::{button::button, column::column, text::text};
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

这个组件要放在应用提供的 Material 主题之下。初始化闭包 `|| 0i32` 只在状态槽首次创建时执行一次，之后的重建直接返回已有的值，不会再调用它。

`remember` 依靠构建时的调用位置找到对应的状态槽，因此要在组件或受认可的构建闭包执行构建时调用。动作和后台任务运行在构建之外，那里没有可以对应的状态槽。`remember_with_key`、`retain` 和 `retain_with_key` 也是如此。保存的值必须满足 `Send + Sync + 'static`。

`State<T>` 句柄只是一个引用，背后状态槽的生命周期与句柄有多少份副本无关。状态槽能存在多久，见[生命周期与副作用](/zhHans/guide/lifecycle)。

## 读写

| 方法 | 行为 |
| --- | --- |
| `get()` | 克隆值，需要 `Clone` |
| `with(f)` | 短暂借用读取 |
| `set(value)` | 替换值，使读取者失效 |
| `with_mut(f)` | 修改值，使读取者失效 |
| `set_if_changed(value)` | 只有值不同时才替换并使读取者失效，返回是否发生了变化；需要 `PartialEq` |
| `is_alive()` | 检查句柄是否仍指向当前会话中的有效状态 |

只要值满足上述约束，`State<T>` 就是 `Copy + Send + Sync`，可以随意移入闭包。读写仍然发生在拥有该状态的 UI 会话中。访问过期句柄或其他会话的句柄会 panic；如果需要先确认，就先调用 `is_alive()`，对这类句柄它会返回 `false`。工作线程上的任务通过[调度器](/zhHans/guide/tasks)把结果送回 UI 会话，在那里写入状态。

## 什么会触发重建

组件在构建期间读取状态时，Tessera 会记下这个组件依赖该状态。之后的写入会使这些读取者失效，它们随之重建，应用的其他部分不受影响。事件回调里的读取发生在构建之外，不会建立依赖。

所以，读取状态的位置应尽量靠近显示它的地方。计数器中由 `count_label` 读取 `count`，父组件只负责传递句柄。计数变化时，只有标签重建，外层的列保留上一次的结果。

模型较大时，用 `with` 借用它，就地读取需要的部分。借用要尽量短；等 `with_mut` 结束之后，再访问同一个状态。还要注意，`set` 和 `with_mut` 总会发布写入，即使新值和旧值相等。对于经常算出相同结果的值，使用 `set_if_changed`，它只在值确实变化时唤醒读取者。

## 把状态提升给调用方

组件自己持有状态用起来方便，这份状态也只属于它自己。如果父组件需要读取或控制它，就把状态往上移，让子组件变成*无状态*的：它通过属性接收当前值，通过回调报告变化。这种做法叫作状态提升。

```rust
use tessera_components::{button::button, row::row, text::text};
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

现在数量只有一个可信来源，由 `order_line` 持有，“数量不能小于 1”这条规则也由它来保证。相同的属性总是产生相同的输出，`stepper` 因此更容易复用，也更容易测试。

状态应提升到所有读写它的组件的最近共同所有者。多个组件需要同一份状态时，把它放在最近的共同祖先中，再向下传递。

传值还是传 `State<T>` 句柄都可以。像上面这样传值，子组件不关心数据存在哪里；像计数器那样传句柄，子组件自己读取，值变化时只有子组件重建。如果父组件自己用不到这个值，又希望重建范围尽量小，就传句柄。

编辑、滚动这类持续进行的交互，请使用组件的控制器。控制器跨越多次构建持有持续进行的命令和交互状态，配置句柄则只描述一次构建。

## 计算派生值，而不是同步它们

如果一个值能从已有状态算出来，就在用到它的地方直接计算，让它只有一个来源。把派生出来的文字或几何数据复制到另一份可变状态里，就得手动保持同步，两份数据也可能互相矛盾。

```rust
use tessera_components::text::text;
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

`remaining_label` 在构建时读取了 `tasks`，列表一变它就会重建，显示的数量始终是最新的。

## 用上下文提供继承的默认值

有些值作用于整棵子树，而不是某一个组件，比如主题、当前文字样式、表面上内容的颜色。上下文让祖先提供一次这样的值，任何后代都能读取，类似 Jetpack Compose 中的 `CompositionLocal`。

`provide_context(init, content)` 在 `content` 构建期间提供一个值。下面这个块里的每个 `text` 都会从上下文中取得红色的内容颜色：

```rust
use tessera_components::{column::column, text::text, theme::ContentColor};
use tessera_ui::{Color, provide_context, tessera};

#[tessera]
fn warning_block() {
    provide_context(
        || ContentColor { current: Color::RED },
        || {
            column().children(|| {
                text("Storage almost full");
                text("Free up space to keep syncing.");
            });
        },
    );
}
```

读取时，`use_context::<T>()` 返回最近的 `Context<T>`，如果没有祖先提供则返回 `None`。通过它的 `with` 方法读取；和状态一样，构建期间的读取会让读取者订阅这个值。用这种方式读取 `MaterialTheme` 的示例见 [Material 3 主题](/zhHans/guide/theming)。

这两个函数都需要构建上下文。和 `remember` 一样，提供方的初始化闭包只在上下文槽创建时执行一次，之后的重建沿用它产生的值。

::: warning 注意
上下文用于主题和继承的视觉默认值。数据和控制器请通过属性传递，动作通过回调报告。从上下文里取数据的组件，会把这份依赖藏在签名之外，复用和理解都会变难。
:::

## 为状态指定显式所有者

记住的状态属于组件挂载的位置，而控制器或服务往往需要自己的生命周期，`StateOwner` 就是为此提供的。在有效的 UI 会话中创建所有者，再向它申请带 key 的状态：

```rust
let owner = tessera_ui::StateOwner::new();
let selected = owner.state_with_key("selected", || None::<u64>);
let dispatcher = owner.dispatcher();
```

所有者中的状态在读写和重建上与记住的状态完全一样，只是生命周期不同。所有者的 `dispatcher()` 用来把后台结果送回这段生命周期，用法见[后台任务](/zhHans/guide/tasks)。

常见的用法是写一个小控制器，把所有者和它的状态放在一起，再对外提供方法。控制器只创建一次（这里用 `remember` 保存），需要的地方传它的克隆：

```rust
use tessera_components::{button::button, column::column, text::text};
use tessera_ui::{State, StateOwner, key, remember, tessera};

#[derive(Clone, PartialEq)]
pub struct SelectionController {
    owner: StateOwner,
    selected: State<Option<u64>>,
}

impl SelectionController {
    pub fn new() -> Self {
        let owner = StateOwner::new();
        let selected = owner.state_with_key("selected", || None);
        Self { owner, selected }
    }

    pub fn selected(&self) -> Option<u64> {
        self.selected.get()
    }

    pub fn select(&self, id: u64) {
        self.selected.set(Some(id));
    }
}

#[tessera]
fn contact_list(contacts: Vec<(u64, String)>) {
    let controller = remember(SelectionController::new).get();
    column().children(move || {
        for (id, name) in &contacts {
            let id = *id;
            let marker = if controller.selected() == Some(id) { "> " } else { "" };
            let label = format!("{marker}{name}");
            let controller = controller.clone();
            key(id, || {
                button()
                    .on_click(move || controller.select(id))
                    .child(move || text(label.clone()));
            });
        }
    });
}
```

所有者只创建一次，并和控制器保存在一起；如果每次构建都新建一个，状态每次都会丢失。所有者的各个克隆共享同一个生命周期，而且 `StateOwner` 按身份比较相等，所以持有它的控制器可以作为属性传递。所有者何时、如何释放状态，见[生命周期与副作用](/zhHans/guide/lifecycle#关闭状态所有者)。

## 下一步

状态存放在各自有生命周期的槽里。[生命周期与副作用](/zhHans/guide/lifecycle)介绍 Tessera 如何把状态对应到组件、何时释放状态，以及带副作用的工作应该放在哪里。
