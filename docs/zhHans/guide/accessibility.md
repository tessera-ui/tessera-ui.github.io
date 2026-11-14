---
title: 语义与无障碍
description: 用 SemanticsArgs 描述自定义控件、组织合理的焦点与阅读顺序，并验证发布的无障碍树。
---

# 语义与无障碍

Tessera 会在视觉界面之外同步发布一棵语义树，供屏幕阅读器、键盘导航与自动化测试读取。标准控件和交互修饰符会自动发布角色、名称和动作；你需要做的是补齐纯图标按钮的名称、梳理复合控件的分组，以及为自定义元素附上语义。

## 优先使用标准控件并起好名称

能用标准组件就不要手搓指针事件——`text_field`、`checkbox`、`radio_group` 和 `button` 已经把角色、键盘导航和无障碍动作接好了。

- 为纯图标控件（`icon_button` 等）设置 `accessibility_label`，只写用途不写角色词（写“搜索消息”，不要写“搜索消息按钮”）。
- 用 `accessibility_description` 补充说明文字，不把长句子塞进名称。
- `text_field` 即使有 `placeholder` 也要设置 `.label(...)`。
- 无障碍标签和可见文案从同一套多语言目录读取。

```rust
use tessera_components::md3::{
    icon_button::icon_button,
    material_icons::filled,
    radio_button::{radio_button, radio_group},
};
use tessera_ui::{remember, tessera};

#[tessera]
fn sort_controls() {
    let selected = remember(|| 0usize);
    radio_group()
        .accessibility_label("Sort by")
        .content(move |group| {
            radio_button(selected.get() == 0)
                .group(group)
                .accessibility_label("Newest first")
                .on_select(move |_| selected.set(0));
            radio_button(selected.get() == 1)
                .group(group)
                .accessibility_label("Oldest first")
                .on_select(move |_| selected.set(1));
        });

    icon_button()
        .icon(filled::SEARCH_SVG)
        .accessibility_label("Search messages")
        .on_click(|| {});
}
```

## 用 `semantics` 描述自定义子树

当自定义子树需要显式角色、标签、数值或测试标签（`test_tag`）时，挂上 `tessera_foundation::modifier::ModifierExt::semantics(SemanticsArgs { .. })`（角色与状态类型来自 `tessera_ui::accesskit`）。

只有带语义元数据的节点才会出现在发布的无障碍树中——普通布局容器会被展平，且未在布局阶段放置的子树不会发布。

### 合并还是保留子节点（`merge_descendants`）

使用 `SemanticsArgs::default()` 时，`merge_descendants` 默认为 `false`，表示由当前父节点的描述整体替代其后代：

```rust
use tessera_components::{md3::text::text, row::row};
use tessera_foundation::modifier::{ModifierExt as _, SemanticsArgs};
use tessera_ui::{Modifier, accesskit::Role, tessera};

#[tessera]
fn rating(stars: u8) {
    row()
        .modifier(Modifier::new().semantics(SemanticsArgs {
            role: Some(Role::Image),
            label: Some(format!("Rated {stars} out of 5")),
            test_tag: Some("rating".into()),
            ..Default::default()
        }))
        .children(move || {
            for index in 0..5 {
                text(if index < stars { "★" } else { "☆" });
            }
        });
}
```

如果容器里的子控件依然需要各自独立操作（比如工具栏），务必显式设 `merge_descendants: true`；若明确要吞掉所有后代语义，也可以使用更直观的 `clear_and_set_semantics(args)`：

```rust
use tessera_components::{md3::{button::button, text::text}, row::row};
use tessera_foundation::modifier::{ModifierExt as _, SemanticsArgs};
use tessera_ui::{Callback, Modifier, accesskit::Role, tessera};

#[tessera]
fn text_style_toolbar(on_bold: Callback, on_italic: Callback) {
    row()
        .modifier(Modifier::new().semantics(SemanticsArgs {
            role: Some(Role::Toolbar),
            label: Some("Text style".into()),
            merge_descendants: true,
            ..Default::default()
        }))
        .children(move || {
            button().on_click_shared(on_bold).child(|| text("Bold"));
            button().on_click_shared(on_italic).child(|| text("Italic"));
        });
}
```

::: warning 保持语义与实际行为一致
- 根据控件用途区分 `toggled` 与 `selected`（`toggleable` 发布开关态，`selectable` 对普通角色发布选中态、对 `Role::RadioButton` 发布开关态）。
- `disabled: true` 只设置元数据，交互逻辑同样要拦截修改（直接用交互修饰符的 `enabled` 最省心）。
- `hidden: true` 只对无障碍隐藏，节点依然会绘制和响应输入，不要让焦点停留在被隐藏的内容上。
:::

底层自定义控件若需自行处理 AccessKit 动作，可以实现 `tessera_ui::SemanticsModifierNode`。

## 焦点顺序与恢复

键盘遍历和阅读顺序严格跟随布局放置子节点的顺序，按希望朗读的先后声明 UI 即可。

- 工具栏等组合控件应作为单个 Tab 停靠点，内部用方向键移动：

```rust
use tessera_components::{md3::{icon_button::icon_button, material_icons::filled}, row::row};
use tessera_ui::{FocusTraversalPolicy, Modifier, modifier::FocusModifierExt as _, tessera};

#[tessera]
fn formatting_toolbar() {
    row()
        .modifier(Modifier::new().focus_group(None).focus_traversal_policy(
            FocusTraversalPolicy::horizontal().single_tab_stop(true),
        ))
        .children(|| {
            icon_button()
                .icon(filled::FORMAT_BOLD_SVG)
                .accessibility_label("Bold")
                .on_click(|| {});
            icon_button()
                .icon(filled::FORMAT_ITALIC_SVG)
                .accessibility_label("Italic")
                .on_click(|| {});
        });
}
```

- 弹出对话框或菜单前调用 `tessera_ui::focus::save_focus()` 记录当前焦点，关闭时若浮层仍持有焦点则调用 `target.restore()` 归还焦点。

## 平台支持与测试检查

AccessKit 适配器在 Windows、macOS、Linux 和 iOS 上默认启用；Android 与 Web 目前不接入系统读屏，但语义树依然照常构建并可用于测试。

在无窗口环境下使用 `UiTest` 断言节点标签、角色、阅读顺序与无障碍动作，见[测试与无头自动化](/zhHans/guide/testing)。
