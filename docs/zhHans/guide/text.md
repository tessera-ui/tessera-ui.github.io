---
title: 文本与文本输入
description: 使用 Material 排版层级显示文本，并通过 text_field 与 TextInputController 收集用户输入。
---

# 文本与文本输入

`text()` 负责显示统一样式的字符串，`text_field()` 提供完整的 Material 文本框，自带光标、选区、输入法组合和剪贴板集成。两者都会从 `MaterialTheme` 读取默认字体与颜色。

本页示例默认跑在 `material_theme()` 下，并在入口注册了 `ComponentsPackage`。

## 显示文本

从 `theme.typography` 里选择排版角色，标题和正文就能跟随主题比例协调变化：

```rust
use tessera_components::{column::column, md3::{text::text, theme::MaterialTheme}};
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

未显式指定 `style` 时，`text` 会优先读取父级继承的 `TextStyle`（例如按钮标签自带的样式），否则回退到 `theme.typography.body_large`。颜色同理：先看显式 `.color(...)`，再看继承的 `ContentColor`，最后取 `theme.color_scheme.on_surface`。

## 样式覆盖与换行

`MaterialTypography` 包含 `display`、`headline`、`title`、`body` 和 `label` 五组规格，每组有大、中、小三个尺寸，也提供 `.emphasized()` 强调样式。局部微调某项属性时，基于主题角色展开即可：

```rust
use tessera_components::md3::{
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

- `single_line(true)` 保持单行并在溢出时显示省略号；默认则按父级宽度约束自动换行。
- 未指定 `line_height` 时默认取 `1.2 × font_size`；临时改单处尺寸可以用 `.size(...)` 和 `.line_height(...)`。
- 需要朗读文本与显示文本不同时，用 `accessibility_label` 和 `accessibility_description` 覆盖。

字体注册和 Unicode 回退配置见[资源、图片与字体](/zhHans/guide/assets)。

## 文本输入框

`text_field()` 默认是填充式单行输入框，可以通过 setter 切到描边、密码遮罩或多行模式：

```rust
use tessera_components::{
    column::column,
    md3::text_field::{TextFieldLineLimit, text_field},
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

`.read_only(true)` 允许选中和复制但禁止编辑；`.enabled(false)` 则完全禁用输入。单行提交使用 `.on_submit(...)`。

## 响应输入变化与过滤

`on_change` 接收候选 `String` 并**返回最终接受的 `String`**——即便回调里只是把值存下来，也要把字符串返回给输入框：

```rust
let query = remember(String::new);
text_field().label("Search").on_change(move |value: String| {
    query.set(value.clone());
    value
});
```

输入格式限制写在 `input_transform` 中，它会在 `on_change` 之前执行：

```rust
text_field()
    .label("Verification code")
    .input_transform(|value: String| value.chars().filter(char::is_ascii_digit).collect());
```

## 用控制器读写文本和焦点

需要在外部按钮或动作里读取、清空文本或拉起焦点时，自己 `remember` 一个 `TextInputController` 并传给 `.controller(...)`：

```rust
use tessera_components::{
    column::column,
    md3::{
        button::button,
        text::text,
        text_field::text_field,
        text_input::TextInputController,
    },
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

仅当使用内置控制器时才通过 `initial_text` 设初值；传入外部控制器时直接初始化控制器本身即可。

## 输入法、右键菜单与剪贴板

`TextFieldContextMenu` 控制剪切、复制、粘贴与全选菜单；`.secure()` 会自动切换到 `TextFieldContextMenu::secure_default()`（关闭剪切和复制）。

如果基于 `ImeInput`、`ImeSession`、`ImeRequest` 与 `ClipboardInput` 编写自定义编辑器：

- 通过 `ImeInput` 接收输入法组合与提交事件，不要靠按键自己拼接字符。
- 异步编辑写回前先核对当前文本与选区是否一致；实现剪切时使用 `ClipboardInput::write_text`，在平台确认剪贴板写入成功后再删除选中文本。

底层输入扩展 trait 见[手势、交互与焦点](/zhHans/guide/interaction)。
