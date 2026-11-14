---
title: Text and text input
description: Display text with Material typography roles and collect user input with text_field and TextInputController.
---

# Text and text input

`text()` renders styled strings, and `text_field()` provides Material text editing with selection, caret handling, IME composition, and clipboard integration. Both inherit their default typography and colors from `MaterialTheme`.

Examples below assume `material_theme()` above them and `ComponentsPackage` registered at startup.

## Displaying text

Pick a role from `theme.typography` so headings, labels, and body copy scale coherently with the theme:

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

When `style` is omitted, `text` uses any `TextStyle` provided in context (such as a button label style) or falls back to `theme.typography.body_large`. Color follows the same precedence: explicit `.color(...)`, inherited `ContentColor`, then `theme.color_scheme.on_surface`.

## Styling and wrapping

`MaterialTypography` includes `display`, `headline`, `title`, `body`, and `label` in `large`, `medium`, and `small` sizes (plus `.emphasized()`). To tweak one property without losing the role's scale, copy from the theme role:

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

- `single_line(true)` keeps text on one line and truncates overflow with an ellipsis; by default, text wraps within the parent's width constraint.
- `line_height` defaults to `1.2 × font_size` when omitted; use `.size(...)` and `.line_height(...)` for one-off overrides.
- `accessibility_label` and `accessibility_description` override the spoken label when it should differ from the visible string.

For registering custom fonts and Unicode fallback ranges, see [Assets, images, and fonts](/guide/assets).

## Text fields

`text_field()` starts filled and single-line by default, and supports outlined, secure, and multi-line presets:

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

Set `.read_only(true)` to allow selection and copying without edits, or `.enabled(false)` to disable interaction completely. Use `.on_submit(...)` for single-line Enter submission.

## Filtering and observing edits

`on_change` receives the proposed `String` and returns the accepted `String` that the field retains—always return the string even when you only store it:

```rust
let query = remember(String::new);
text_field().label("Search").on_change(move |value: String| {
    query.set(value.clone());
    value
});
```

Use `input_transform` for editing rules such as character filtering; it runs before `on_change`:

```rust
text_field()
    .label("Verification code")
    .input_transform(|value: String| value.chars().filter(char::is_ascii_digit).collect());
```

## Controlling text from code

Pass a remembered `TextInputController` when actions outside the field need to read, replace, or focus the text buffer:

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

Use `initial_text` only when letting `text_field()` manage its own internal controller; when passing an external controller, initialize it directly.

## IME, context menus, and clipboard

`TextFieldContextMenu` configures cut, copy, paste, and select-all entries; `.secure()` automatically selects `TextFieldContextMenu::secure_default()` (which omits cut and copy).

When building a custom editor on lower-level primitives (`ImeInput`, `ImeSession`, `ImeRequest`, and `ClipboardInput`):

- Handle text composition through `ImeInput` rather than inferring characters from key presses.
- Verify asynchronous edits against the current buffer and selection before applying them, and use `ClipboardInput::write_text` for cut so text is deleted only after the platform confirms the clipboard write succeeded.

See [Gestures, input, and focus](/guide/interaction) for raw input extension traits.
