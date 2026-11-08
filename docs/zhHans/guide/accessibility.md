---
title: 无障碍
description: 选对控件、起好名称并检查结果，让应用能用屏幕阅读器和键盘操作。
---

# 无障碍

Tessera 在可视 UI 之外还会发布一棵无障碍树，屏幕阅读器、键盘导航和你的测试都基于这棵树工作。大部分工作是选用已经能发布正确信息的控件、给它们起清楚的名称，并让焦点停在用户预期的位置。本页讲的是这些做法；描述树中节点的 API 见[语义](/zhHans/guide/semantics)。

文本输入框是个不错的起点：它的可见标签会成为无障碍名称，标签没说清的内容可以用描述补充。

```rust
use tessera_components::text_field::text_field;
use tessera_ui::tessera;

#[tessera]
fn account_name() {
    text_field()
        .label("Account name")
        .accessibility_description("Used to identify your account to other members");
}
```

Material 控件需要 `material_theme()` 祖先，见 [Material 3 主题](/zhHans/guide/theming)。

## 优先使用现有控件

组件库里有合适的控件时，就直接用它。文本输入框已经把编辑、焦点、选择和无障碍连在一起，用它就能一次得到全部这些能力；用绘制的文本加指针处理器自行实现时，每一项连接都要手动重建。

组合控件还自带键盘行为。单选按钮组会发布分组和其中的选项，并且整组只占一个 Tab 停靠点，组内用方向键切换选项：

```rust
use tessera_components::radio_button::{radio_button, radio_group};
use tessera_ui::{remember, tessera};

#[tessera]
fn sort_order() {
    let selected = remember(|| 0usize);
    radio_group()
        .accessibility_label("Sort by")
        .content(move |group| {
            radio_button()
                .group(group)
                .selected(selected.get() == 0)
                .accessibility_label("Newest first")
                .on_select(move |_| selected.set(0));
            radio_button()
                .group(group)
                .selected(selected.get() == 1)
                .accessibility_label("Oldest first")
                .on_select(move |_| selected.set(1));
        });
}
```

如果需要自定义外观，但激活行为很普通，就用 `clickable_with`、`toggleable_with` 或 `selectable_with` 来构建。这些修饰符把同一个动作同时接到指针输入、键盘输入和辅助技术上。见[手势与交互](/zhHans/guide/interaction)。

## 给每个控件起名称

名称说明控件的用途，比如“搜索消息”，而不是“放大镜”。描述补充名称没有涵盖的信息，例如输入要求或操作的后果。名称只写用途，角色由屏幕阅读器单独播报，“搜索消息，按钮”比“搜索消息按钮，按钮”顺耳得多。

只有图标的控件没有可见文字可以借用，需要用 `accessibility_label` 指定名称：

```rust
use tessera_components::{icon_button::icon_button, material_icons::filled};
use tessera_ui::tessera;

#[tessera]
fn search_action() {
    icon_button()
        .icon(filled::SEARCH_SVG)
        .accessibility_label("Search messages")
        .on_click(|| {});
}
```

只要控件的可见内容不适合作为名称，就使用它的 `accessibility_label`。提供 `accessibility_description` 的控件可以用它添加说明，而不改变名称。带占位文本的输入框也要设置标签，因为用户一开始输入，占位文本就消失了。

放在按钮里的文字会作为按钮下方一个独立的文本节点发布。要让按钮节点本身带有名称，请在按钮上设置 `accessibility_label`。

名称和描述同样是给用户看的文字。在控件旁边，用与可见文本相同的消息目录解析它们，这样切换语言时两者会一起变化，见[多语言](/zhHans/guide/i18n)。

## 如实描述自定义控件

自定义子树需要现有控件没有发布的元数据时，用语义修饰符附加。字段列表见[语义](/zhHans/guide/semantics)；下面几条习惯能让发布的信息与实际一致：

- 按元素的用途选择角色，而不是按它的外形。
- 勾选和选中是两种不同的状态。例如，可选交互修饰符对 `Role::RadioButton` 发布勾选状态，对其他可选角色发布选中状态。发布的状态要和驱动外观的应用状态来自同一处，两者才能始终一致。
- 发布 `disabled` 只设置元数据，你的输入处理器和动作也要保持状态不变。交互修饰符的 `enabled` 设置会同时处理这两件事。
- 语义负责公开动作，实现由你的代码完成。只公开控件真正能处理的动作；普通的点击和切换交给现有控件或交互修饰符。
- 把内容标记为 `hidden` 会把它从无障碍树中移除，但它仍会绘制，也仍然接收指针和键盘输入。让焦点只停留在辅助技术能访问的内容上。
- 给包含多个控件的容器添加语义时要小心。使用 `SemanticsArgs::default()` 时，`merge_descendants` 为 `false`，子控件不再单独公开。包含多个可独立操作控件的命名分组需要设置 `merge_descendants: true`。

## 让焦点和阅读顺序可预期

键盘遍历和无障碍树都按布局放置子节点的顺序排列，而不是按它们最终在屏幕上的坐标。对行、列等标准布局来说，这就是视觉顺序，所以想得到合理的阅读顺序，最简单的办法是按希望被读到的顺序声明内容。

工具栏这类组合控件，通常最好整体作为一个 Tab 停靠点，内部用方向键移动，就像上面的单选按钮组。在自己的容器上使用带遍历策略的焦点组，就能得到同样的效果：

```rust
use tessera_components::{icon_button::icon_button, material_icons::filled, row::row};
use tessera_ui::{FocusTraversalPolicy, Modifier, modifier::FocusModifierExt as _, tessera};

#[tessera]
fn formatting_toolbar() {
    row()
        .modifier(Modifier::new().focus_group().focus_traversal_policy(
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

对话框、菜单等临时 UI 关闭后，要把焦点还给用户原来所在的位置。显示之前先保存当前焦点目标，并在临时 UI 仍持有焦点时恢复，这样用户在此期间自己移动到的位置会保留焦点。如果目标在此期间已被移除或禁用，恢复不会生效：

```rust
use tessera_ui::FocusManager;

let restore_to = FocusManager::current().save_focus();
// Show the dialog. When it closes:
if let Some(target) = restore_to {
    target.restore();
}
```

自定义控件要保留可见的焦点指示，`FocusRequester::is_focus_visible` 会告诉你何时应该绘制键盘焦点。语义字段 `focusable` 和 `focused` 只描述焦点；要注册或移动键盘焦点，请使用[手势与交互](/zhHans/guide/interaction)中介绍的焦点修饰符、焦点请求器和焦点管理器。

## 平台支持

应用渲染器在 Windows、macOS、Linux 和 iOS 上接入 AccessKit 适配器。Tessera 在 Android 和 web 上没有启用的适配器，因此在这些目标上，发布的语义本身并不能让屏幕阅读器用户获得原生访问。

## 检查你的应用

用各目标平台的屏幕阅读器试用应用，再只用键盘操作一遍。确认名称和值能被播报、激活操作有效、勾选与选中状态正确、禁用的控件确实不响应、阅读顺序合理，并且对话框关闭后焦点能回来。

自动化测试读取的是同一棵树。测试可以按标签和角色查找节点、对它触发无障碍动作、检查阅读顺序，全部在无窗口测试中完成，见[测试](/zhHans/guide/testing)。
