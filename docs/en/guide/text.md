---
title: Text and text input
description: Show text in the theme's type scale and accept text from users with text fields.
---

# Text and text input

Text is how most of your UI talks to the user, so Tessera gives you one component for showing it and a Material text field for collecting it. Both read their fonts and colors from the theme, which keeps every label on a screen consistent.

The examples on this page run beneath the app's `material_theme()`; [Material 3 theming](/guide/theming) shows the root setup.

## Show text

`text()` draws a string with one uniform style. Pick a role from the theme's typography scale, so headings and body copy stay in proportion when the theme changes:

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

When you leave `style` unset, `text` uses a `TextStyle` inherited from its parent if there is one (a button provides one for its label, for example), and otherwise the theme's `body_large`. Color resolves the same way: an explicit `color`, then the inherited `ContentColor`, then the theme's `on_surface`. That is why text inside a button or a filled surface usually picks up the right color on its own.

## Style text

The typography scale has display, headline, title, body and label roles, each in large, medium and small sizes. A `TextStyle` holds the font size, an optional line height, the weight, letter spacing and an optional font family. When one piece of content needs to differ from its role, start from the role and change only what is different:

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

`single_line(true)` keeps the text on one line and ellipsizes whatever does not fit. Without it, text wraps to the width its parent allows. If a line height is not given, it defaults to 1.2 times the font size. `text` also has `size` and `line_height` setters for one-off overrides.

If many components should share a change, change the theme's typography once; `theme.typography.emphasized()` gives you a stronger scale for emphasized content. `text` draws a single style, so a sentence with mixed weights or colors needs several `text` calls laid out together. Registering fonts and controlling fallback belongs to [Resources](/guide/assets).

Text is also exposed to accessibility: by default its label is the displayed content and its role is a label. Use `accessibility_label` or `accessibility_description` when the spoken name should differ from the visible text. [Semantics](/guide/semantics) explains how that metadata is used.

## Accept text input

`text_field()` is the Material text field. It handles editing, selection, the caret, the input method and the clipboard for you. Its builder gives you labels, placeholders and a few presets:

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

Fields are filled and single-line by default. `outlined()` switches to the outlined style, and `TextFieldLineLimit::MultiLine` allows several lines. Leading and trailing icons, prefixes, suffixes and error state are further setters; the [text field reference](https://tessera-ui.github.io/tessera/tessera_components/text_field/index.html) lists them all.

`read_only` and `enabled` express different policies. A read-only field keeps its content available but accepts no edits, while a disabled field accepts no user input at all. `on_submit` handles submission of a single-line field.

## Respond to changes

`on_change` receives the proposed `String` and **returns the accepted `String`**, not `()`. That return value is what the field keeps, so return it even when your callback only records it:

```rust
let query = remember(String::new);
text_field().label("Search").on_change(move |value: String| {
    query.set(value.clone());
    value
});
```

Editing rules belong in `input_transform`, which runs before `on_change`. This field keeps only the digits of each proposed value:

```rust
text_field()
    .label("Verification code")
    .input_transform(|value: String| value.chars().filter(char::is_ascii_digit).collect());
```

Keep these rules in `input_transform`. The component body runs on every rebuild, so it is the wrong place to edit what the user typed.

## Control the text from code

`text_field()` creates and owns an editor controller unless you supply one. Keep your own `TextInputController` when application actions need to read or replace the text, or move focus to the editor:

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

Read the current content with `editor.with(|editor| editor.text())`. `initial_text` seeds the internally owned controller once, when it is created; later rebuilds leave the current text in place. If you supply an external controller, initialize it directly.

## Input methods and the clipboard

The editor already handles selection, IME preedit and committed text, caret positioning and clipboard editing. Build on it instead of assembling text from key presses: a key press is not necessarily a character, and an input method may revise a composition the user has not finished.

`TextFieldContextMenu` configures the field's cut, copy, paste and select-all menu. `secure()` obscures what is displayed, keeps the field on one line and switches to a context-menu policy without cut or copy.

::: warning
Protect sensitive data in your application as well. These settings only change what the field displays and what its menu offers.
:::

When you apply an asynchronous editing result, first check that it still refers to the current content and selection. A cut, for example, deletes the text once the clipboard write has succeeded. The focused clipboard input path supports this through `ClipboardInput::write_text`, whose completion callback runs only after the platform acknowledges success. Keep normal text editing on the existing controller and input pipeline.

A fully custom editor receives composition through `ImeInput` and publishes its text, selection and input configuration through `ImeSession` and `ImeRequest`. Alongside its keyboard handler, it also needs keyboard focus, clipboard handling and accessibility semantics. [Gestures and interaction](/guide/interaction) describes the raw input traits, and the [text input reference](https://tessera-ui.github.io/tessera/tessera_components/text_input/index.html) documents the editor contracts.
