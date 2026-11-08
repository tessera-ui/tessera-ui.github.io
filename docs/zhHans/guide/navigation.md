---
title: 导航
description: 用目标页面栈在页面之间切换、保留各页面的状态，并处理 Android 返回。
---

# 导航

大多数应用都不止一个页面。用户希望能点进详情，再回到刚才的位置。`tessera-shard` 为界面的某一部分提供一个目标页面栈来实现这一点：目标（destination）是描述页面及其参数的值，`shard_home` 负责渲染栈顶的那个目标。

先把这个 crate 加入应用：

```sh
cargo add tessera-shard
```

下面的根组件可以打开详情页并返回。它沿用应用中已有的 `EntryPoint` 和 `ComponentsPackage` 注册：

```rust
use tessera_components::{
    button::button,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_shard::{RouterController, shard, shard_home};
use tessera_ui::{State, tessera};

#[shard]
fn home(#[router] router: State<RouterController>) {
    button().on_click(move || {
        router.with_mut(|router| router.push(DetailDestination { id: 42 }));
    }).child(|| { text("Open note"); });
}

#[shard]
fn detail(#[router] router: State<RouterController>, id: u64) {
    button().on_click(move || {
        router.with_mut(RouterController::pop);
    }).child(move || { text(format!("Note {id}: go back")); });
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

## 声明目标页面

`#[shard]` 把一个自由函数变成组件，并为它生成目标类型。类型名跟随函数名：`detail` 生成 `DetailDestination`，`note_editor` 生成 `NoteEditorDestination`。目标类型的可见性与函数相同。

函数的每个参数都会成为目标类型的公共字段，只有标注 `#[router]` 的参数例外。这个参数接收 `shard_home` 提供的 `State<RouterController>`，构造目标时只需填写其余参数。最多只能有一个参数标注 `#[router]`，而且它的类型必须是 `State<RouterController>`。

创建目标的代码早已返回，目标却还留在路由栈里，因此目标参数必须是拥有所有权的值。生成的目标类型实现 `Clone` 和 `PartialEq`，并且要满足路由要求的 `Send + Sync + 'static`。实际写代码时，传记录的 ID，由页面自己去查找记录。`Option<T>` 参数同样是普通字段，没有值时要显式写 `None`。

`#[shard]` 自己就会建立组件边界，函数上有它这一个属性就够了。要显示一个 shard，就导航到它生成的目标；该目标位于栈顶时，`shard_home` 会调用这个函数。

## 管理路由控制器

`shard_home().root(HomeDestination {})` 会创建并记住一个内部控制器。传入的根目标只用于初始化；组件重建时，页面栈保持重建前的导航结果。

如果应用外壳也需要读取或修改页面栈，就自己记住一个控制器并传进去。下面的代码替换第一个示例中的 `app`：

```rust
use tessera_ui::remember;

#[tessera]
pub fn app() {
    let router = remember(|| RouterController::with_root(HomeDestination {}));
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(move || {
            shard_home().controller(router);
        });
}
```

外部控制器自带初始页面栈，`shard_home` 直接使用这个栈，并忽略 `.root(...)`。在 `shard_home` 挂载期间，要保证栈不为空。既不提供根目标、也不提供外部控制器时，`shard_home` 会报错。

用 `remember` 保存控制器，它的生命周期就跟随外壳组件。不同的控制器拥有各自独立的页面栈和 shard 状态。记住的状态归谁所有，见[状态](/zhHans/guide/state)。

## 修改页面栈

用 `router.with(...)` 读取控制器，用 `router.with_mut(...)` 修改它，通常在输入回调中进行。下面这些方法会改变页面栈：

| 方法 | 效果 |
| --- | --- |
| `push(destination)` | 在当前目标之上添加新的路由实例。 |
| `pop()` | 移除当前路由并返回其目标；空栈返回 `None`。 |
| `replace(destination)` | 移除当前路由后压入新目标；空栈直接压入。 |
| `reset(destination)` | 移除全部路由，并设置新的根目标。 |

选哪个方法，取决于用户之后应该能回到哪里。需要回到上一页时用 `push`；当前这一步不该留在历史里时用 `replace`；旧的历史一概不该再访问时用 `reset`，比如退出登录之后。

检查页面栈可以用 `len`、`is_empty`、`last` 和 `current_is::<D>()`。Android 内置的返回处理到根目标为止。直接调用 `pop()` 则会移除栈顶的任何目标，包括根目标，所以自定义返回按钮应只在 `len() > 1` 时弹出。

## 在顶层页面之间切换

有几个顶层分区的应用，通常用导航栏、导航轨或抽屉展示它们，每次切换分区都应从一段新的历史开始。下面的外壳持有控制器，在[导航栏](https://tessera-ui.github.io/tessera/tessera_components/navigation_bar/index.html)上方渲染当前目标，用户选择分区时重置页面栈：

```rust
use tessera_components::{
    boxed::boxed,
    column::column,
    modifier::ModifierExt as _,
    navigation_bar::{navigation_bar, navigation_bar_item},
    text::text,
    theme::{MaterialTheme, material_theme},
};
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

导航栏在构建时读取了路由，所以页面栈一变，它就会重建并更新选中项。在分区内部，页面仍然可以照常 `push` 详情页。`reset` 会释放被移除的路由，用户切回旧分区时，那里由路由持有的状态已经不在了。需要保留状态的分区，请使用下一节介绍的控制器级状态。

## 保留页面状态

用户在编辑器上打开另一个页面再返回时，会希望编辑器保持离开时的样子。`#[shard(state = T)]` 为此给 shard 提供状态：它在首次使用时创建一个 `T`，并在函数内以 `state: ShardState<T>` 的形式提供。`state` 由宏提供，参数列表里只写目标的参数。`T` 必须实现 `Default + Send + Sync + 'static`。

下面这个额外的目标在其他路由覆盖它时仍保留计数：

```rust
#[derive(Default)]
struct EditorState {
    edits: usize,
}

#[shard(state = EditorState)]
fn editor() {
    let edits = state.with(|value| value.edits);
    button().on_click(move || {
        state.with_mut(|value| value.edits += 1);
    }).child(move || { text(format!("Edits: {edits}")); });
}
```

`EditorDestination {}` 没有参数。尽管两次的目标值相等，压入两次仍会创建两个路由实例，各有各的状态。

`lifecycle` 选项决定状态归谁所有：

| 声明 | 状态所有者 |
| --- | --- |
| `#[shard(state = EditorState)]` | 单个路由实例，等同于 `lifecycle = shard`。 |
| `#[shard(state = EditorState, lifecycle = scope)]` | 路由控制器；同一控制器中该 shard 的各个实例共享状态。 |

路由持有的状态在路由留在栈中期间一直存在，路由被弹出、替换或清空时释放。控制器持有的状态能跨过所有页面栈变化，包括 `reset`，直到控制器结束。`lifecycle` 需要和 `state` 一起使用，单独写会报错。这两种选择分别对应 `ShardStateLifeCycle::Shard` 和 `ShardStateLifeCycle::Scope`。

普通的 `remember` 状态属于挂载中的组件，页面离开可见树时它也随之结束。需要活得更久的数据，应放在 shard 状态或其他明确的所有者中。

`ShardState` 支持 `with`、`with_mut`、`get` 和 `set`。复制句柄不会延长所有者的生命周期。如果路由或控制器可能已经不在，请使用 `try_with` 和 `try_with_mut`，它们会把这种情况作为错误返回。要把后台工作的结果写进 shard 状态，应经由所属的 UI 会话交付，见[后台任务](/zhHans/guide/tasks)。

## Android 返回导航

`shard_home` 通过生成的宿主接入 Android 系统返回，挂载 `shard_home` 后就能返回上一页。栈中有多个路由时，预测性返回手势会预览上一个目标，当前页面仍留在栈中。用户取消手势，当前页面恢复；确认手势，弹出一个路由。位于根目标时，由 Android 照常处理返回。

自定义目标或浮层可以使用 `tessera_ui::system_back::system_back_handler`。让处理器保持稳定挂载，只在确实有返回动作可做时启用。Android 把返回事件交给最近挂载且已启用的处理器，一次预测性手势会始终交给它开始时的那个处理器。

把 `SystemBackEvent::Started`、`Progress` 和 `Cancelled` 当作预览的变化来处理，只在 `Committed` 时修改导航，这样取消滑动时，当前页面会保留下来。返回按钮可能直接发送 `Committed`，之前没有任何预览事件。Android 宿主见[平台概览](/zhHans/guide/platforms)，其他应用操作见[手势与交互](/zhHans/guide/interaction)。

完整的目标与状态 API 见 [tessera-shard API 参考](https://tessera-ui.github.io/tessera/tessera_shard/)。
