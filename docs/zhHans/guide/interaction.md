---
title: 手势、交互与焦点
description: 响应点击、开关、选择、拖动，管理键盘焦点遍历，以及接入底层原始输入。
---

# 手势、交互与焦点

用户操作通过事件回调修改状态或操作控制器，随后重建把最新结果呈现在屏幕上。

本页示例默认跑在 `material_theme()` 下，并在入口注册了 `ComponentsPackage`。文本输入见[文本与文本输入](/zhHans/guide/text)。

## 动作闭包与 `Callback`

标准控件直接接收动作闭包（如 `button().on_click(...)`）。闭包捕获的数据需拥有所有权且满足 `'static`；动作在 UI 线程运行，因此无需 `Send + Sync`。直接捕获 `State<T>` 句柄并在触发时读取最新值。

只有需要把同一个动作保存、复用或传给多个 setter（通过 `*_shared` setter）时，才构造 `Callback` 或 `CallbackWith`。

## 为自定义界面添加交互

标准组件满足需求时优先用标准组件。若要保留通用交互和无障碍语义、仅自定义外观，使用 `tessera_components::modifier::ModifierExt` 提供的交互修饰符（配置结构体来自 `tessera_foundation::modifier`）：

| 修饰符 | 用途 |
| --- | --- |
| `clickable(ClickableArgs)` | 点击激活（指针/键盘/无障碍）与水波纹 |
| `toggleable(ToggleableArgs)` | 开关类布尔值切换（`on_value_change`） |
| `selectable(SelectableArgs)` | 单选/选中状态切换 |
| `draggable(DraggableArgs)` | 接收以局部物理像素为单位的拖动增量（位于 `tessera_foundation::modifier::ModifierExt`） |

给自定义点击区域设置 `role` 与 `label`（或 `description`），它才会注册进键盘焦点遍历并向辅助技术暴露点击动作：

```rust
use tessera_components::{
    boxed::boxed,
    md3::text::text,
    modifier::ModifierExt as _,
};
use tessera_foundation::modifier::{ClickableArgs, ModifierExt as _};
use tessera_ui::{Callback, Dp, Modifier, accesskit::Role, tessera};

#[tessera]
fn save_action(on_save: Callback) {
    boxed()
        .modifier(Modifier::new().padding_all(Dp(12.0)).clickable(
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

自定义开关行示例：

```rust
use tessera_components::{md3::text::text, modifier::ModifierExt as _, row::row};
use tessera_foundation::modifier::{ModifierExt as _, ToggleableArgs};
use tessera_ui::{CallbackWith, Dp, Modifier, accesskit::Role, remember, tessera};

#[tessera]
fn wifi_row() {
    let enabled = remember(|| false);
    row()
        .modifier(Modifier::new().padding_all(Dp(12.0)).toggleable(
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

注意区分开关与选中语义：`toggleable` 发布开关状态；`selectable` 发布选中状态（仅当 `role` 为 `Role::RadioButton` 时发布勾选状态）。

## 用 `InteractionState` 响应悬停与按下

把记住的 `State<InteractionState>` 传给交互修饰符，即可在构建时读取悬停、按下、焦点和拖动状态来改变外观：

```rust
use tessera_components::{boxed::boxed, md3::text::text, modifier::ModifierExt as _};
use tessera_foundation::modifier::{ClickableArgs, InteractionState, ModifierExt as _};
use tessera_ui::{Callback, Dp, Modifier, accesskit::Role, remember, tessera};

#[tessera]
fn hold_to_preview() {
    let interaction = remember(InteractionState::new);
    let pressed = interaction.with(|state| state.is_pressed());
    boxed()
        .modifier(Modifier::new().padding_all(Dp(12.0)).clickable(
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

`is_hovered()`、`is_focused()` 和 `is_dragged()` 用法相同。

## 键盘焦点管理

焦点修饰符来自 `tessera_ui::modifier::FocusModifierExt`。

### 请求与观察焦点

用 `remember` 保存 `FocusRequester` 并绑定到节点，在动作回调中请求焦点（不要在构建体里无条件请求，否则会抢走用户的键盘导航位置）：

```rust
use tessera_components::{boxed::boxed, column::column, md3::{button::button, text::text}};
use tessera_ui::{FocusRequester, Modifier, modifier::FocusModifierExt as _, remember, tessera};

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

绘制仅键盘可见的焦点环时，在构建期间读取 `requester.is_focus_visible()`：键盘和无障碍焦点动作会显示它，指针点击会隐藏它但保留焦点，代码请求焦点则沿用最近一次输入方式。

监听焦点变化使用 `.on_focus_changed(|state: FocusState| ...)`；需要临时锁定焦点时使用 `capture_focus()` 与 `free_focus()`。

### 遍历、分组与恢复

- **焦点移动**：可能涉及滚动或展开惰性列表条目时，调用 `tessera_ui::focus::request_move_focus(direction)` 将移动排到布局之后执行；仅在已布局目标间立即跳转时，调用 `tessera_ui::focus::move_focus(direction)`。
- **焦点组与作用域**：工具栏等复合控件使用 `.focus_group(None)` 搭配 `.focus_traversal_policy(FocusTraversalPolicy::horizontal().single_tab_stop(true))`；需要记住上次聚焦后代的容器使用 `.focus_scope(None)` 与 `.focus_restorer(None, fallback)`。
- **浮层焦点恢复**：打开对话框或菜单前调用 `tessera_ui::focus::save_focus()`，关闭时若浮层仍持有焦点则恢复保存的 `FocusRestorationTarget`。打开或关闭可聚焦浮层时，调用 `tessera_ui::focus::defer_keyboard_until_layout()` 让后续按键等待新布局完成。

## 原始输入扩展

编写自定义底层控件时，实现对应节点 trait 并通过 `tessera_ui::modifier::ModifierCapabilityExt` 挂载：

| 节点 Trait | 挂载方法 | 输入上下文 |
| --- | --- | --- |
| `PointerInputModifierNode` | `push_pointer_input` | `PointerInput` |
| `KeyboardInputModifierNode` | `push_keyboard_input` | `KeyboardInput` |
| `ImeInputModifierNode` | `push_ime_input` | `ImeInput` |
| `ClipboardInputModifierNode` | `push_clipboard_input` | `ClipboardInput` |

处理指针事件时保留 `pointer_id`、各采样点位置和消费标记，使用 `PointerInput::local_delta` 把窗口位移换算到局部坐标，并且只消费控件真正处理的事件，让父级滚动与全局快捷键继续生效。
