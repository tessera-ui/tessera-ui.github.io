---
title: 文本与文本输入
description: 用主题的字体层级显示文本，并通过输入框接收用户输入的文字。
---

# 文本与文本输入

界面上的大部分信息都靠文字传达。Tessera 用一个组件显示文本，用 Material 输入框收集文本，两者的字体和颜色都来自主题，同一界面上的标签因此保持一致。

本页示例都默认放在应用的 `material_theme()` 下运行，根组件的配置见 [Material 3 主题](/zhHans/guide/theming)。

## 显示文本

`text()` 用统一的一种样式绘制一段字符串。从主题的排版层级里选一个角色，这样主题变化时，标题和正文之间的比例仍然协调：

```rust
use tessera_components::{column::column, text::text, theme::MaterialTheme};
use tessera_ui::{tessera, use_context};

#[tessera]
fn article_header() {
    let theme = use_context::<MaterialTheme>()
        .expect("article_header requires material_theme")
        .get();
    column().children(move || {
        text("Release notes").style(theme.typography.headline_small);
        text("Updated today")
            .style(theme.typography.body_medium)
            .color(theme.color_scheme.on_surface_variant);
    });
}
```

没有设置 `style` 时，`text` 先使用父级继承下来的 `TextStyle`（例如按钮会为自己的标签提供一份），没有的话再用主题的 `body_large`。颜色也按同样的顺序决定：先看显式的 `color`，再看继承的 `ContentColor`，最后是主题的 `on_surface`。所以放在按钮或填充表面里的文字，通常会自动用上合适的颜色。

## 设置文本样式

排版层级包含 display、headline、title、body 和 label 五类角色，每类有大、中、小三个尺寸。`TextStyle` 包含字号、可选的行高、字重、字间距和可选的字体族。某段内容需要和所属角色略有不同时，以该角色为基础，只改不同的部分：

```rust
use tessera_components::{
    text::text,
    theme::{MaterialTheme, TextStyle},
};
use tessera_ui::{tessera, use_context};

#[tessera]
fn report_title() {
    let theme = use_context::<MaterialTheme>()
        .expect("report_title requires material_theme")
        .get();
    text("Quarterly report for the northern region")
        .style(TextStyle {
            font_weight: 600,
            ..theme.typography.title_medium
        })
        .single_line(true);
}
```

`single_line(true)` 让文本保持一行，放不下的部分以省略号结尾；不设置时，文本会按父级允许的宽度换行。没有指定行高时，默认取字号的 1.2 倍。临时覆盖某一项，也可以用 `text` 的 `size` 和 `line_height`。

如果许多组件都要跟着变，就改一次主题排版；`theme.typography.emphasized()` 可以生成一套用于强调内容的更醒目的层级。`text` 只绘制一种样式，一句话里要混用不同字重或颜色时，需要把几个 `text` 排在一起。字体注册和回退见[资源](/zhHans/guide/assets)。

文本也会提供给无障碍服务：默认以显示的内容作为标签，角色为 label。朗读的名称需要和显示的文字不同时，用 `accessibility_label` 或 `accessibility_description` 覆盖。这些元数据的用途见[语义](/zhHans/guide/semantics)。

## 接收文本输入

`text_field()` 是 Material 风格的输入框，编辑、选择、光标、输入法和剪贴板都已经替你处理好。通过构建器可以设置标签、占位文字和几种预设：

```rust
use tessera_components::{
    column::column,
    text_field::{TextFieldLineLimit, text_field},
};
use tessera_ui::tessera;

#[tessera]
fn sign_in_form() {
    column().children(|| {
        text_field().label("Email").placeholder("name@example.com");
        text_field().label("Password").secure();
        text_field()
            .label("Notes")
            .outlined()
            .line_limit(TextFieldLineLimit::MultiLine);
    });
}
```

输入框默认是填充样式、单行输入。`outlined()` 切换为描边样式，`TextFieldLineLimit::MultiLine` 允许多行。前后图标、前缀、后缀和错误状态等也都有对应的设置方法，完整列表见[输入框参考](https://tessera-ui.github.io/tessera/tessera_components/text_field/index.html)。

`read_only` 和 `enabled` 代表两种不同的策略：只读输入框的内容仍然可用，只是不接受编辑；禁用的输入框则完全不接受用户输入。`on_submit` 处理单行输入框的提交。

## 响应文本变化

`on_change` 接收候选的 `String`，并且**返回最终接受的 `String`**，而不是 `()`。输入框保留的正是这个返回值，所以即使回调只是把文本记下来，也要把值返回：

```rust
let query = remember(String::new);
text_field().label("Search").on_change(move |value: String| {
    query.set(value.clone());
    value
});
```

编辑规则应该写在 `input_transform` 里，它在 `on_change` 之前执行。下面的输入框只保留候选文本中的数字：

```rust
text_field()
    .label("Verification code")
    .input_transform(|value: String| value.chars().filter(char::is_ascii_digit).collect());
```

这类规则都放在 `input_transform` 里。组件函数体每次重建都会运行，不适合用来修改用户输入的内容。

## 在代码中控制文本

如果你没有传入控制器，`text_field()` 会自己创建并持有一个。当应用动作需要读取或替换文本、或者把焦点移到编辑器上时，就自己保存一个 `TextInputController`：

```rust
use tessera_components::{
    button::button, column::column, text::text, text_field::text_field,
    text_input::TextInputController,
};
use tessera_ui::{Dp, remember, tessera};

#[tessera]
fn search_field() {
    let editor = remember(|| TextInputController::new(Dp(16.0), Some(Dp(24.0))));
    column().children(move || {
        text_field().controller(editor).label("Search");
        button()
            .on_click(move || {
                editor.with_mut(|editor| editor.set_text(""));
                editor.with(|editor| editor.request_focus());
            })
            .child(|| text("Clear and focus"));
    });
}
```

用 `editor.with(|editor| editor.text())` 读取当前内容。`initial_text` 只在内部控制器创建时提供一次初始文本，之后的重建会保留当前文本。传入外部控制器时，请直接初始化它。

## 输入法与剪贴板

编辑器已经处理了选择、IME 预编辑和已提交文本、光标定位以及剪贴板编辑。请在它的基础上处理文本输入，而不是靠按键拼接文本：一次按键不一定对应一个字符，输入法也可能改写用户尚未完成的组合文本。

`TextFieldContextMenu` 用来配置输入框的剪切、复制、粘贴和全选菜单。`secure()` 会遮盖显示内容、限制为单行，并换用不提供剪切和复制的上下文菜单策略。

::: warning 注意
敏感数据仍需由应用自身保护。这些设置只改变输入框的显示内容和菜单选项。
:::

应用异步编辑结果之前，先确认它仍然对应当前的内容和选择。比如剪切，要等剪贴板写入成功后再删除文本。获得焦点的剪贴板输入路径通过 `ClipboardInput::write_text` 支持这一点：只有平台确认成功，完成回调才会运行。普通的文本编辑仍然走现有的控制器和输入管线。

完全自定义的编辑器通过 `ImeInput` 接收组合输入，再通过 `ImeSession` 和 `ImeRequest` 发布文本、选择和输入配置。除了键盘处理器，它还需要键盘焦点、剪贴板处理和无障碍语义。原始输入 trait 见[手势与交互](/zhHans/guide/interaction)，编辑器的约定见[文本输入参考](https://tessera-ui.github.io/tessera/tessera_components/text_input/index.html)。
