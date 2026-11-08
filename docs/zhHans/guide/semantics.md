---
title: 语义
description: 描述界面元素的含义，让辅助技术和测试都能找到并理解它们。
---

# 语义

除了绘制出来的画面，Tessera 还会构建一棵语义树，说明界面的每一部分是什么：一个按钮、一个标题、一个停在 40% 的滑块。屏幕阅读器等辅助技术读取这棵树，你的测试也读取它，所以同一份描述可以同时服务两者。

标准控件会自己描述自己。构建自定义元素，或者默认描述不合适时，由你来添加语义。下面的星级评分对外呈现为一张带有明确名称的图片，其中的五个星形字符不进入语义树：

```rust
use tessera_components::{
    modifier::{ModifierExt as _, SemanticsArgs},
    row::row,
    text::text,
};
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

角色和带类型的状态值来自 `tessera_ui::accesskit`。语义只负责描述 UI。绘制来自组件和视觉修饰符，交互来自控件和交互修饰符。

## 语义树

语义树比组件树稀疏。只有带语义元数据的组件才会出现在其中；没有元数据的布局容器会被跳过，它们带语义的后代挂到最近的语义祖先下面。树的根是窗口。

元数据有三个来源：

- **标准组件。** `text` 发布一个标签节点，名称就是它的文本内容，除非你用 `accessibility_label` 覆盖。按钮、输入框等控件会发布各自的角色、状态和动作。
- **交互修饰符。** `clickable_with`、`toggleable_with` 和 `selectable_with` 会发布与所添加行为相符的角色、名称和动作，见[手势与交互](/zhHans/guide/interaction)。
- **`semantics` 修饰符。** `ModifierExt::semantics` 可以把 `SemanticsArgs` 附加到任意子树上。

每个节点沿用其组件的稳定标识，因此值更新和局部重建之后，焦点目标和动作目标都不会丢失。节点的边界来自布局；`bounds_padding` 可以在不改变布局的情况下扩大语义边界。只有布局时被放置的子树才会发布，所以只测量、未放置的内容对辅助技术不可见。

## 保留还是隐藏后代

上面的 `rating` 示例为这一行和其中的五颗星只发布一个节点。使用 `SemanticsArgs::default()` 时，`merge_descendants` 为 `false`，由该节点自身的描述代表它的全部后代。如果父节点的描述本来就要取代其中的内容，比如这个评分，这正是想要的效果。

如果容器里的子元素仍然需要单独操作，就设置 `merge_descendants: true`。例如工具栏给整组命名，同时让其中的按钮仍然可以访问：

```rust
use tessera_components::button::button;
use tessera_ui::Callback;

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

这样发布出来的树里有工具栏节点，下面是各个按钮及其标签。

::: warning 注意
在一组控件的容器上写 `semantics(SemanticsArgs { .. })` 时，请设置 `merge_descendants: true`。虽然字段名叫 `merge_descendants`，但设为 `true` 表示子元素作为独立的子节点保留下来，设为 `false` 反而会丢弃它们。保持默认值 `false`，容器里的控件就会对辅助技术隐藏。
:::

`clear_and_set_semantics(args)` 无论 `args` 中如何设置，总是采用隐藏后代的行为，能把意图表达得更明确。父节点给出了完整的替代描述时使用它。

`hidden: true` 把内容标记为对无障碍隐藏，绘制、指针和键盘交互照常进行。请让焦点留在辅助技术能访问的内容上。

## SemanticsArgs 字段

所有字段都是可选的，其余字段用 `..Default::default()` 补齐。

| 字段 | 含义 |
| --- | --- |
| `role` | 元素的种类。按元素的用途选择。 |
| `label`、`description` | 元素的名称，以及名称没有表达的补充说明。 |
| `value` | 与名称分开的文本值。 |
| `numeric_value`、`numeric_range` | 当前数值及其 `(min, max)`。 |
| `numeric_value_step`、`numeric_value_jump` | 范围控件的小步增量和翻页增量。 |
| `toggled` | 勾选、未勾选或混合状态，类型为 `accesskit::Toggled`。 |
| `selected` | 对支持选择的角色，表示项目是否被选中。 |
| `expanded`、`has_popup` | 展开状态，以及控件会打开的弹出内容种类。 |
| `disabled`、`invalid` | 可用性和校验状态。 |
| `state_description`、`role_description` | 补充的可读状态文本，以及角色的自定义名称。 |
| `heading_level` | 标题级别，从 1 开始。没有设置 `role` 时，节点会成为标题。 |
| `tooltip` | 上下文帮助。没有自带描述的可聚焦后代会把它继承为描述。 |
| `live` | 节点变化时以何种礼貌程度播报。 |
| `modal` | 该对话框是否阻止与窗口其余部分交互。 |
| `scroll_x`、`scroll_y` | 滚动位置，形式为 `(value, min, max)`。 |
| `collection_info`、`collection_item_info` | 集合的行数和列数，以及某个项目在集合中的位置。 |
| `actions` | 节点声明支持的 AccessKit 动作。 |
| `focusable`、`focused` | 已发布节点的焦点元数据。 |
| `hidden` | 对无障碍隐藏该节点。 |
| `merge_descendants` | 后代是否作为独立节点保留。默认为 `false`。 |
| `bounds_padding` | 在语义边界周围额外扩展的空间，不改变布局。 |
| `test_tag` | 供测试和检查使用的稳定键。 |

选中状态和勾选状态含义不同。例如 `selectable_with` 对 `Role::RadioButton` 发布勾选状态，对其他可选角色发布选中状态。发布的状态要和驱动外观的那份状态保持同步。

有几个字段只描述行为，行为本身来自别处：

- `disabled` 只发布元数据。你的输入处理和动作也必须拒绝修改状态。交互修饰符的 `enabled` 配置可以让行为和语义保持一致。
- `actions` 只负责声明动作，处理动作是另一回事。普通的点击和切换行为，请使用标准控件或交互修饰符。
- `focusable` 和 `focused` 只描述焦点。要注册焦点目标或移动焦点，请使用 `FocusModifierExt`、焦点请求器和焦点管理器。

需要自行处理无障碍动作的底层控件，可以实现 `tessera_ui::SemanticsModifierNode`，它同时接收 `AccessibilityNode` 和可选的 `AccessibilityActionHandler`。这是扩展接口，应用组件很少需要用到。

## 在测试中使用语义

测试读取的就是辅助技术读取的那棵树，所以语义是一种稳定的定位方式。最直接的是 `test_tag`：布局快照通过它解析 `snapshot.node("rating")`，组件快照用 `tagged` 查找它。标签在已放置的节点中必须唯一，`root` 是保留名称。

下面的测试同时检查组件请求了什么、以及实际发布了什么：

```rust
use tessera_ui::{
    accesskit::Role,
    testing::{layout_test, pump_layout_test_session, start_layout_test_session},
};

#[test]
fn rating_publishes_one_node() {
    let mut session = start_layout_test_session(layout_test(|| rating(4)));
    pump_layout_test_session(&mut session, 0);

    let components = session.inspect_components();
    let node = components.tagged("rating");
    assert_eq!(
        node.semantics().and_then(|semantics| semantics.label.as_deref()),
        Some("Rated 4 out of 5"),
    );

    let tree = session.inspect_accessibility().expect("published tree");
    assert!(tree.find("Rated 4 out of 5", Role::Image).is_some());
    assert!(tree.nodes().iter().all(|(_, node)| node.role() != Role::Label));
}
```

`inspect_components()` 返回所有组件及其边界和所请求的元数据；`labeled` 和 `matching_label` 按名称查找组件。`inspect_accessibility()` 返回实际发布的树：`find(label, role)` 定位唯一的节点，`ancestor_with_role` 从它向上查找，`reading_order()` 按屏幕阅读器的顺序遍历节点。`dispatch_accessibility_action` 像辅助技术那样，通过已发布的目标发送动作；检查结果之前要再推进一帧。headless 渲染器同样提供 `inspect_components()` 和 `inspect_accessibility()`，`cargo tessera headless` 的 `snapshot` 命令也会返回这些数据。详见[测试](/zhHans/guide/testing)。

要回答“屏幕阅读器会得到什么”，就对已发布的树做断言。组件请求的元数据可能被父节点隐藏，最后一条断言正说明了这一点：星形字符请求了标签节点，但一个也没有发布出来。

## 平台支持

应用渲染器在 Windows、macOS、Linux 和 iOS 上连接 AccessKit 适配器。Tessera 在 Android 和 Web 上没有启用的适配器，在这些平台上发布的语义树本身并不能让屏幕阅读器访问应用，不过测试仍然可以检查它。命名、焦点顺序以及如何用真实的辅助技术检查应用，见[无障碍](/zhHans/guide/accessibility)。

`AccessibilityNode` 和动作接口见[核心 API 参考](https://tessera-ui.github.io/tessera/tessera_ui/)。
