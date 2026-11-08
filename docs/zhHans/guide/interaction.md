---
title: 手势与交互
description: 响应点击、开关、拖动和按键，根据按下与悬停改变外观，并控制键盘焦点。
---

# 手势与交互

响应用户操作，通常就是给组件传一个闭包。闭包修改状态或调用控制器，UI 在下一次重建时读到结果。下面的例子里，按钮让计数加一，上方的文本读取这个计数：

```rust
use tessera_components::{button::button, column::column, text::text};
use tessera_ui::{remember, tessera};

#[tessera]
fn counter() {
    let count = remember(|| 0);
    column().children(move || {
        text(format!("Count: {}", count.get()));
        button()
            .on_click(move || count.with_mut(|value| *value += 1))
            .child(|| text("Increment"));
    });
}
```

本页示例都默认放在应用的 `material_theme()` 下运行，根组件的配置见 [Material 3 主题](/zhHans/guide/theming)。文字输入另有专门的页面：[文本与文本输入](/zhHans/guide/text)。

## 编写动作

组件会保存动作闭包，所以闭包必须拥有它捕获的值，并满足 `Send + Sync + 'static`。实际写法是捕获可复制的 `State` 句柄，或者把克隆出的、拥有所有权的值移入闭包。状态归谁所有见[状态](/zhHans/guide/state)；动作返回后还要继续的工作见[后台任务](/zhHans/guide/tasks)。

大多数动作都写成普通闭包。动作需要单独保存、共享或转发时，使用 `Callback` 或 `CallbackWith`。手里已经有这样的句柄时，直接传给对应的设置方法，例如 `on_click_shared`。

## 让自定义内容可交互

现有控件能满足需求时，就从现有控件开始。如果只是想换个外观、行为保持常规，可以使用 `tessera_components::modifier::ModifierExt` 提供的语义交互修饰符：

| 修饰符 | 含义 |
| --- | --- |
| `clickable` | 触发动作 |
| `toggleable` | 修改布尔值 |
| `selectable` | 激活带有选中状态的项目 |
| `draggable` | 接收以局部物理像素为单位的拖动增量 |

每个修饰符都有接受配置结构体的 `_with` 版本。下面用 `clickable_with` 给自定义目标设置名称和角色，这样它不仅能响应指针，还能获得键盘焦点：

```rust
use tessera_components::{
    boxed::boxed,
    modifier::{ClickableArgs, ModifierExt as _},
    text::text,
};
use tessera_ui::{Callback, Dp, Modifier, accesskit::Role, tessera};

#[tessera]
fn save_action(on_save: Callback) {
    boxed()
        .modifier(Modifier::new().padding_all(Dp(12.0)).clickable_with(
            ClickableArgs {
                label: Some("Save document".into()),
                role: Some(Role::Button),
                on_click: on_save,
                ..Default::default()
            },
        ))
        .children(|| text("Save"));
}
```

一个修饰符就把同一个动作同时接到指针激活、键盘激活和无障碍点击动作上。配置里还可以设置 `enabled`、外部的 `InteractionState` 和 `FocusRequester`。它在修饰符链中的位置决定了点击区域：像这里一样放在内边距外侧，内边距也能点击。顺序的规则见[修饰符](/zhHans/guide/modifiers)。

::: warning 注意
需要键盘操作的自定义控件，请使用 `clickable_with` 并设置角色、标签或描述。三者都没有的普通 `clickable` 不会注册自己的焦点目标，键盘用户无法到达它。
:::

`toggleable` 描述带有开/关值的控件。它把新值传给你的回调，由你保存：

```rust
use tessera_components::{
    modifier::{ModifierExt as _, ToggleableArgs},
    row::row,
    text::text,
};
use tessera_ui::{CallbackWith, Dp, Modifier, accesskit::Role, remember, tessera};

#[tessera]
fn wifi_row() {
    let enabled = remember(|| false);
    row()
        .modifier(Modifier::new().padding_all(Dp(12.0)).toggleable_with(
            ToggleableArgs {
                value: enabled.get(),
                on_value_change: CallbackWith::new(move |value| enabled.set(value)),
                role: Some(Role::Switch),
                label: Some("Wi-Fi".into()),
                ..Default::default()
            },
        ))
        .children(|| text("Wi-Fi"));
}
```

勾选状态和选中状态要分开对待。`toggleable` 描述的是布尔控件；`selectable_with` 对普通可选角色发布选中状态，对 `Role::RadioButton` 则发布勾选状态。名称、角色和状态的细节见[无障碍](/zhHans/guide/accessibility)。

`draggable` 以 `DragDelta` 报告每次移动，单位是局部物理像素。`DraggableArgs` 还可以设置锁定方向、开始拖动前的最小移动距离，以及 `on_drag_started` / `on_drag_stopped` 回调。滚动容器会处理自己的拖动，见[列表与滚动](/zhHans/guide/lists)。

## 根据按下、悬停和焦点改变外观

有时外观要随交互变化，比如目标被按住的时候。把 `InteractionState` 传给修饰符，并在构建时读取它。修饰符会持续更新悬停、按下、焦点和拖动状态，状态变化时组件随之重建：

```rust
use tessera_components::{
    boxed::boxed,
    modifier::{ClickableArgs, InteractionState, ModifierExt as _},
    text::text,
};
use tessera_ui::{Callback, Dp, Modifier, accesskit::Role, remember, tessera};

#[tessera]
fn hold_to_preview() {
    let interaction = remember(InteractionState::new);
    let pressed = interaction.with(|state| state.is_pressed());
    boxed()
        .modifier(Modifier::new().padding_all(Dp(12.0)).clickable_with(
            ClickableArgs {
                label: Some("Preview".into()),
                role: Some(Role::Button),
                interaction_state: Some(interaction),
                on_click: Callback::new(|| {}),
                ..Default::default()
            },
        ))
        .children(move || text(if pressed { "Release to close" } else { "Hold to preview" }));
}
```

`is_hovered()`、`is_focused()` 和 `is_dragged()` 的用法相同。Material 控件根据这些信息绘制自己的状态层和水波纹，所以它主要用于自定义视觉效果。目标被禁用时，它的交互状态会被重置。

## 焦点

键盘用户和使用辅助技术的用户都靠焦点在界面中移动。控件和 `clickable_with` 目标会自动加入焦点遍历；下面的 API 用于在代码中移动焦点，以及编写自定义焦点目标。焦点修饰符来自核心库的 `tessera_ui::FocusModifierExt`，需要和组件库的修饰符 trait 一起导入。

### 在代码中移动焦点

先用 `remember` 让 `FocusRequester` 保持稳定，把它绑定到目标上，再在动作里调用它：

```rust
use tessera_components::{boxed::boxed, button::button, column::column, text::text};
use tessera_ui::{FocusModifierExt as _, FocusRequester, Modifier, remember, tessera};

#[tessera]
fn preview_panel() {
    let requester = remember(FocusRequester::new).get();
    column().children(move || {
        boxed()
            .modifier(Modifier::new().focus_requester(requester).focusable())
            .children(|| text("Preview"));
        button()
            .on_click(move || requester.request_focus())
            .child(|| text("Focus preview"));
    });
}
```

`focusable()` 只负责注册焦点目标。真正的自定义控件还要自己提供动作，以及向辅助技术描述它的语义。已经挂载但被布局隐藏的目标会拒绝直接请求。请在动作里或针对某个具体变化请求焦点；每次重建都请求，会覆盖用户自己导航到的位置。

### 显示焦点

同一个请求器也能告诉你目标的焦点情况：`is_focused()` 表示是否持有主焦点，`has_focus()` 则把活动焦点路径也算在内。绘制键盘焦点指示时，在构建期间读取 `is_focus_visible()`。键盘输入和无障碍焦点操作会显示指示，指针按下会隐藏指示但不释放焦点，代码设置的焦点则沿用最近一次的输入方式。这样焦点框只在键盘操作时出现，使用鼠标和触摸时保持隐藏：

```rust
use tessera_components::{
    boxed::boxed,
    modifier::{ClickableArgs, ModifierExt as _},
    text::text,
    theme::MaterialTheme,
};
use tessera_ui::{
    Callback, Color, Dp, FocusRequester, Modifier, accesskit::Role, remember, tessera,
    use_context,
};

#[tessera]
fn open_tile(on_open: Callback) {
    let scheme = use_context::<MaterialTheme>()
        .expect("open_tile requires material_theme")
        .get()
        .color_scheme;
    let requester = remember(FocusRequester::new).get();
    let ring = if requester.is_focus_visible() {
        scheme.secondary
    } else {
        Color::TRANSPARENT
    };
    boxed()
        .modifier(
            Modifier::new()
                .border(Dp(2.0), ring)
                .padding_all(Dp(12.0))
                .clickable_with(ClickableArgs {
                    label: Some("Open".into()),
                    role: Some(Role::Button),
                    focus_requester: Some(requester),
                    on_click: on_open,
                    ..Default::default()
                }),
        )
        .children(|| text("Open"));
}
```

焦点变化时要执行代码，可以挂上 `on_focus_changed`，它会收到一个 `FocusState`。`capture_focus()` 会把焦点锁定在目标上，直到你调用 `free_focus()`，或者焦点被强制清除、目标被布局隐藏或移除。

### 遍历、分组与恢复

焦点遍历使用 `FocusManager::current().request_move_focus(direction)`。它把移动排到布局之后执行，因此能让惰性内容显示出来。返回的布尔值表示请求已被接受，目标要等排队的移动执行时才获得焦点。想立即遍历，用 `move_focus(direction)`。

`focus_group()` 用来建立遍历组，`focus_restorer(...)` 建立一个会记住上次获得焦点的后代的作用域。浮层和导航应当有意识地选好初始焦点和恢复目标，这样对话框打开时焦点落在合适的位置，关闭后又能回到原处。

## 键盘输入

大部分键盘行为由控件自带。获得焦点的控件和 `clickable_with` 目标会响应键盘激活，焦点遍历负责在它们之间移动，文字输入交给输入框。带 `on_long_click` 的 `surface()` 还可以通过上下文菜单键和 Shift+F10 触发这个动作。

需要快捷键，或者自定义控件有自己的按键时，实现 `KeyboardInputModifierNode`，再按下一节的方式挂载。`KeyboardInput` 携带待处理的 `KeyboardEvent` 采样，以及事件发生时的修饰键状态。只消费控件真正处理的按键，让无关的按键继续传给其他处理器。

## 原始输入扩展

原始输入处理器面向自定义控件和输入集成；普通的按钮动作使用前面介绍的闭包。做法是实现专用的节点 trait，再通过 `tessera_ui::modifier::ModifierCapabilityExt` 挂载：

| 来自 `tessera_ui` 的节点 trait | 挂载方法 | 输入数据 |
| --- | --- | --- |
| `PointerInputModifierNode` | `push_pointer_input` | `PointerInput` |
| `KeyboardInputModifierNode` | `push_keyboard_input` | `KeyboardInput` |
| `ImeInputModifierNode` | `push_ime_input` | `ImeInput` |
| `ClipboardInputModifierNode` | `push_clipboard_input` | `ClipboardInput` |

每个 trait 都有对应的 `on_..._input` 方法，并要求 `Send + Sync + 'static`。能力 trait 另外提供指针、键盘和 IME 的预览钩子，以及一个指针最终钩子。这些都是编写高层修饰符扩展用的底层构件，扩展的写法见[自定义布局](/zhHans/guide/custom-layout)。

指针处理器要保留 `PointerChange::pointer_id`、每个采样点的位置及其消费状态，让一批采样中的每一个都保持它被记录时的位置。`PointerInput::local_delta` 可以把窗口坐标下的位移换算成局部单位。只消费控件真正处理的事件，让滚动和无关按键继续传给其他处理器。

扩展约定见[核心 API 参考](https://tessera-ui.github.io/tessera/tessera_ui/)。
