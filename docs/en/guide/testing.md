---
title: Testing and headless automation
description: Test layout, interaction, accessibility, and GPU pixels with UiTest, and automate complete apps over cargo tessera headless.
---

# Testing and headless automation

Tessera UI tests are standard Rust `#[test]` functions powered by `tessera_ui::testing::UiTest`. Most tests run purely on the CPU without opening a window; when you need pixel readback or shader checks, opt into GPU rendering on the same `UiTest` builder. For script- or agent-driven inspection of the full built app, use `cargo tessera headless`.

Enable `testing` on `tessera-ui` for CPU layout, input, and accessibility tests, and add `headless` when using `.rendered(...)` or `cargo tessera headless`.

## Layout and geometry assertions

`UiTest::new()` creates a deterministic test session (800 × 600 viewport, 60 Hz frame step by default). Configure viewport, scale factor, and content, step a frame with `.frame()`, and assert on nodes by `test_tag`, unique component function name, or semantic label:

```rust
use tessera_components::{row::row, spacer::spacer};
use tessera_foundation::modifier::{ModifierExt as _, SemanticsArgs};
use tessera_ui::{Dp, Modifier, tessera, testing::UiTest};

#[tessera]
fn layout_fixture() {
    row().children(|| {
        spacer().modifier(
            Modifier::new().size(Dp(80.0), Dp(24.0)).semantics(SemanticsArgs {
                test_tag: Some("gap".into()),
                ..Default::default()
            }),
        );
    });
}

#[test]
fn fixed_gap_size() {
    let layout = UiTest::new()
        .viewport(320, 240)
        .scale_factor(1.0)
        .content(layout_fixture)
        .frame();

    layout.node("gap").position(0, 0).size(80, 24);
}
```

Always set `.scale_factor(...)` explicitly so expected pixel dimensions do not depend on the host machine's DPI. The assertion chain covers `exists()`, `position(x, y)`, `size(width, height)`, `rect(...)`, `x` / `y` / `width` / `height`, relative checks (`above`, `below`, `left_of`, `right_of`, `align_start_with`, `align_top_with`, `same_width_as`, `same_height_as`), and `bounds()`.

## Interaction, accessibility, and virtual time

Keep a `UiTest` session alive to send clicks, pointer/touch/keyboard/IME events, accessibility actions, and virtual clock steps:

```rust
use std::time::Duration;

use tessera_components::{button::button, column::column, text::text, theme::material_theme};
use tessera_ui::{
    accesskit::{Action, Role},
    remember, tessera,
    testing::UiTest,
};

#[tessera]
fn counter() {
    let count = remember(|| 0u32);
    material_theme().child(move || {
        column().children(move || {
            text(format!("Count: {}", count.get()));
            button()
                .on_click(move || count.set(count.get() + 1))
                .child(|| text("Add"));
        });
    });
}

#[test]
fn add_increments_count() {
    let mut ui = UiTest::new().viewport(320, 240).scale_factor(1.0).content(counter);
    ui.frame();

    let tree = ui.inspect_accessibility().expect("accessibility tree");
    let (label, _) = tree.find("Add", Role::Label).expect("Add label");
    let (button_id, _) = tree
        .ancestor_with_role(label, Role::Button)
        .expect("Add button");

    assert!(ui.accessibility_action(button_id, Action::Click));
    ui.advance(Duration::from_millis(16));
    ui.inspect_components().labeled("Count: 1");
}
```

Common `UiTest` helpers:

- **Input**: `ui.node("tag").click()`, `click_at(pos)`, `pointer_move` / `pointer_press` / `pointer_release` / `pointer_scroll`, `touch_start` / `touch_move` / `touch_end` / `touch_cancel`, `press_key`, `inject_key_event`, `set_key_modifiers`, `inject_text`, `dispatch_system_back`.
- **Virtual clock**: `frame_step(duration)`, `advance(duration)`, `frames(count)`, `settle()` (runs until no animations or invalidations remain).
- **Inspection & probes**: `inspect_components()`, `inspect_accessibility()`, `work()`, `work_totals()`, `diagnostics()`, and `TestProbe<T>` for passing inputs or observing callback results across frames.

Run state reads/writes outside frames inside `ui.run(|| ...)` so the test's session is active.

## Offscreen GPU pixel tests

Chain `.rendered(module)` (requires the `headless` feature and a native GPU adapter) to run real WGSL pipelines offscreen and inspect pixels or GPU resource usage:

```rust
use tessera_components::ComponentsPackage;
use tessera_ui::{EntryRegistry, testing::UiTest};

#[test]
fn renders_offscreen_pixels() {
    let mut registry = EntryRegistry::new();
    registry.register_package(ComponentsPackage);

    let mut ui = UiTest::new()
        .viewport(320, 240)
        .scale_factor(1.0)
        .rendered(registry.finish())
        .content(layout_fixture);

    ui.frames(1);
    let pixels = ui.read_pixels();
    assert_eq!(pixels.len(), 320 * 240 * 4);
}
```

To test your real application entrypoint (`crate::run()`) with all its packages and localization catalogs, call `.into_headless(HeadlessConfig { .. })` on the `EntryPoint` directly. Keep GPU-backed tests separate from pure CPU layout tests in CI so headless environments without a GPU adapter can run CPU tests freely.

## Driving a full app via `cargo tessera headless`

`cargo tessera headless` supervises offscreen worker processes that run your app's shared `EntryPoint::run_desktop()` path over JSONL stdin/stdout (requires the `headless` feature on `tessera-ui`):

```sh
cargo tessera headless -p my-app --width 800 --height 600 --frame-time-ms 16
```

Wait for `{"event":"ready"}`, then send one JSON command per line:

```jsonl
{"id":1,"cmd":"spawn","name":"preview"}
{"id":2,"cmd":"render","session":"preview","frames":1,"out":"target/preview.png"}
{"id":3,"cmd":"snapshot","session":"preview"}
{"id":4,"cmd":"input","session":"preview","kind":"press","x":100,"y":80,"button":"left"}
{"id":5,"cmd":"input","session":"preview","kind":"release","x":100,"y":80,"button":"left"}
{"id":6,"cmd":"render","session":"preview","duration_ms":160,"out":"target/after-click.png"}
{"id":7,"cmd":"snapshot","session":"preview"}
{"id":8,"cmd":"shutdown"}
```

Commands include `spawn`, `render`, `input` (`press`, `release`, `move`, `scroll`), `text`, `snapshot`, `resources`, `resize`, `rebuild`, `list`, `kill`, and `shutdown`. Because inputs are queued, send `render` after `input` or `text` before reading an updated `snapshot` or PNG. Set `TESSERA_HEADLESS_SCALE_FACTOR` before launching to test HiDPI scaling.
