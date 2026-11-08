---
title: Testing
description: Test layout, semantics and interaction without a window, render offscreen when you need pixels, and drive the whole app over JSONL.
---

# Testing

UI tests in Tessera are ordinary Rust `#[test]` functions. Most of them run the component tree without a window or GPU: you give the fixture an explicit size, density and time, find nodes by test tag or accessible label, act on them and assert on layout and semantics. When a test depends on real pixels, keyboard input or IME, a headless renderer runs the same entry offscreen, and `cargo tessera headless` lets a script drive the complete app.

Pick the lightest tool that can observe what you care about:

- **Layout sessions** (`layout_test`) build and lay out components on the CPU. Use them for sizes and placement, published semantics, accessibility actions and pointer input.
- **The headless renderer** (`into_headless`) needs a GPU adapter. Use it for pixels, rendering pipelines, keyboard and IME input, and for tests that start the app's real entry with its registered packages.
- **JSONL sessions** (`cargo tessera headless`) run the built app in worker processes that you control over stdin and stdout.

Layout sessions need the `testing` feature on the app's `tessera-ui` dependency. The headless renderer also needs `headless`.

## Write a layout test

`layout_test` builds and lays out a component with no window and no renderer. This fixture places a fixed-size spacer and tags it so the test can find it:

```rust
use tessera_components::{
    modifier::{ModifierExt as _, SemanticsArgs},
    row::row,
    spacer::spacer,
};
use tessera_ui::{Dp, Modifier, tessera, testing::layout_test};

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
    let snapshot = layout_test(layout_fixture)
        .viewport_px(320, 240)
        .scale_factor(1.0)
        .run();
    snapshot.node("gap").position(0, 0).size(80, 24);
}
```

`viewport_px(width, height)` sets the viewport in physical pixels, and `scale_factor(factor)` sets how many physical pixels make one `Dp`; it must be finite and positive. Setting the density explicitly keeps expected sizes the same on every machine, whatever its display settings. Material components still need a `material_theme()` ancestor in a fixture, just as in the app.

### Find nodes

`LayoutSnapshot::node` looks a node up by its `test_tag`. Tags must be unique among placed nodes, and `root` is reserved for the root. A component function name that is unique in the tree works as a selector too, but tags keep tests independent of how components are structured. A missing or ambiguous selector panics, which fails the test with a clear message. Tags are part of a node's semantics; see [Semantics](/guide/semantics).

### Layout assertions

The assertion chain provides:

| Assertion | Checks |
| --- | --- |
| `exists()` | The selector resolves. |
| `position(x, y)`, `x(value)`, `y(value)` | Position in physical pixels. |
| `size(width, height)`, `width(value)`, `height(value)` | Size in physical pixels. |
| `above(other)`, `below(other)` | Non-overlapping vertical order. |
| `left_of(other)`, `right_of(other)` | Non-overlapping horizontal order. |
| `align_start_with(other)`, `align_top_with(other)` | Equal start or top coordinates. |
| `same_width_as(other)`, `same_height_as(other)` | Equal dimensions. |

`bounds()` returns a `PxRect` for comparisons the chain doesn't cover. These assertions inspect layout; to check how a shader or clip looks, render offscreen and read the pixels, as described below.

## Act on the UI and check the result

A layout session can do more than measure. Keep it open with `start_layout_test_session`, and you can read the published accessibility tree, perform actions the way assistive technology does and check what changed. Here is a small counter:

```rust
use tessera_components::{button::button, column::column, text::text};
use tessera_ui::{remember, tessera};

#[tessera]
fn counter() {
    let count = remember(|| 0u32);
    column().children(move || {
        text(format!("Count: {}", count.get()));
        button()
            .on_click(move || count.set(count.get() + 1))
            .child(|| text("Add"));
    });
}
```

The test finds the button through its visible text, clicks it with an accessibility action, pumps one more frame and checks the new text:

```rust
use tessera_components::theme::material_theme;
use tessera_ui::{
    accesskit::{Action, ActionRequest, Role, TreeId},
    testing::{layout_test, pump_layout_test_session, start_layout_test_session},
};

fn fixture() {
    material_theme().child(|| counter());
}

#[test]
fn add_increments_count() {
    let mut session = start_layout_test_session(
        layout_test(fixture).viewport_px(320, 240).scale_factor(1.0),
    );
    pump_layout_test_session(&mut session, 0);

    let tree = session.inspect_accessibility().expect("accessibility tree");
    let (text, _) = tree.find("Add", Role::Label).expect("Add text");
    let (add, _) = tree
        .ancestor_with_role(text, Role::Button)
        .expect("Add button");
    assert!(session.dispatch_accessibility_action(ActionRequest {
        action: Action::Click,
        target_tree: TreeId::ROOT,
        target_node: add,
        data: None,
    }));

    pump_layout_test_session(&mut session, 16_000_000);
    session.inspect_components().labeled("Count: 1");
}
```

A button's text is published as a separate text node, which is why the test finds the label first and then walks up to the enclosing button with `ancestor_with_role`. If the button had an `accessibility_label`, `tree.find("Add", Role::Button)` would find it directly. `labeled` panics when no node, or more than one, carries the label, so on its own it works as the assertion.

The accessibility snapshot also gives you `reading_order()` to check the order a screen reader would follow and `focus()` for the focused node. Testing through published semantics checks what users actually get; see [Accessibility](/guide/accessibility) for what to look for.

For pointer input, `pump_layout_test_session_with_input` delivers pointer changes and a cursor position along with the frame.

## Control time

A layout session runs frames at timestamps you choose, in nanoseconds, so a test advances time directly and animations and retained state behave the same on every run:

```rust
use tessera_ui::testing::{
    layout_test, pump_layout_test_session, start_layout_test_session,
};

let mut session = start_layout_test_session(
    layout_test(layout_fixture)
        .viewport_px(320, 240)
        .scale_factor(1.0),
);
pump_layout_test_session(&mut session, 0)
    .node("gap").size(80, 24);
pump_layout_test_session(&mut session, 160_000_000)
    .node("gap").size(80, 24);
```

`advance_layout_test_session_by_nanos` advances relative to the previous frame instead. All of these remain layout-only; use the headless renderer when you need GPU output. [Animation](/guide/animation) explains how frame time drives animations.

## Feed inputs and record outputs

Pass fixture inputs through component props. When a test needs to observe something, such as how often a callback ran, use `testing::TestProbe`. It provides `new`, `get`, `set`, `with`, `with_mut` and `take`, and its clones share one value, so you can hand one clone to the fixture and keep another in the test. A probe is plain shared storage, so writing to it triggers no rebuild; use `State` for values whose changes should update the UI.

Each fixture owns its own runtime session. To read or write state, or to call a controller, from outside a frame, go through `session.run(...)` or the headless renderer's `run(...)`. Keep session-owned state, focus targets and component identities inside the fixture that created them.

## Render offscreen

The headless renderer creates no window, but it **requires a native GPU adapter**. `EntryPoint::into_headless` keeps the packages and render modules registered on the entry. This test renders the earlier fixture and reads its pixels:

```rust
use std::time::Duration;

use tessera_components::ComponentsPackage;
use tessera_ui::{EntryPoint, HeadlessConfig};

let mut renderer = EntryPoint::new(layout_fixture)
    .package(ComponentsPackage)
    .into_headless(HeadlessConfig {
        width: 320,
        height: 240,
        scale_factor: 1.0,
        frame_time: Duration::from_millis(16),
        ..Default::default()
    })
    .expect("headless renderer");

renderer.render_frames(1);
let components = renderer.inspect_components();
assert!(components.tagged("gap").bounds().is_some());
let pixels = renderer.read_pixels().expect("RGBA pixels");
assert_eq!(pixels.len(), 320 * 240 * 4);
```

To test the whole application, call its shared entry function and then `into_headless`, so the test uses the app's own package registrations. [Localization](/guide/i18n#check-each-language-in-tests) has an example.

`step_frame`, `render_frames` and `render_for_duration` advance a virtual clock. For reproducible results, fix the viewport, density, frame step, inputs and assets. Pixel comparisons still need a controlled GPU and backend.

Queue pointer input with `pointer_move`, `pointer_press`, `pointer_release` or `pointer_scroll`, using window pixel coordinates. `press_key` takes a `winit::keyboard::NamedKey`, and `inject_text` commits text to the focused editor. Input is queued, so render another frame before you assert on its result.

### Inspect the output

`inspect_components()` returns a `ComponentSnapshot`. Find nodes with `tagged`, `find_tag`, `labeled` or `matching_label`, then read their `bounds`, `layout_coordinates` and `semantics`. `inspect_accessibility()` returns the published accessibility snapshot when there is one, with the same `find`, `ancestor_with_role` and `reading_order` you used in layout sessions, and `dispatch_accessibility_action` works here too.

Messages formatted with Fluent arguments wrap each argument in invisible Unicode isolation marks. The label finders ignore those marks; when you compare text yourself, use `testing::text_matches` or `testing::visible_text`.

`work()` reports the component, layout and paint work done in the last frame, `work_totals()` adds it up across the fixture, and `frame_clock_diagnostics()` reports frame-clock work and subscriptions. Reach for these when a test protects invalidation or scheduling behavior specifically, alongside a check of the visible result.

`resource_snapshot()` waits for the GPU to finish and reports held handles, allocation counters and allocator reservations. Some counters are unavailable on some backends. Reserved bytes are not resident VRAM; measure process memory separately when you need it.

## Drive the whole app over JSONL

`cargo tessera headless` runs a supervisor whose workers start the app through its shared `EntryPoint::run_desktop()` path, so you test the build you ship. It is handy for scripted checks and for coding agents that need to see and operate the app. Enable `headless` on the app's dependency, then start it:

```sh
cargo tessera headless -p my-app --width 800 --height 600 --frame-time-ms 16
```

Wait for the `ready` event, then write one JSON object per line to stdin. Responses come back on stdout, carrying the request's `id` when you gave one; diagnostics go to stderr. Send application logging to stderr or a file, since stdout carries the responses.

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

The coordinates above are illustrative. Clicks are sent by coordinates: take the bounds of the node you want from a `snapshot` and click inside them.

| Command | Purpose |
| --- | --- |
| `spawn` | Start a named worker; optional `package`, `width`, `height` and `release` override the defaults. |
| `render` | Advance `frames` or `duration_ms`; optional `out` writes a PNG. |
| `input` | Queue `press`, `release`, `move` or `scroll`; scrolling uses `delta_x` and `delta_y`. |
| `text` | Queue input for the focused editor from a `text` field. |
| `snapshot` | Read component geometry and accessibility output. |
| `resources` | Wait for the GPU to finish and inspect resources and graphics work. |
| `resize` | Set physical-pixel `width` and `height`. |
| `rebuild` | Rebuild and restart the selected worker after source changes. |
| `list` | List workers and their PIDs. |
| `kill` | Stop the selected worker. |
| `shutdown` | Stop all workers and close the supervisor. |

Worker commands pick their target with `session`; `spawn`, `list` and `shutdown` act on the supervisor. Each worker has its own application state, and `rebuild` starts the worker again from its initial state.

Input is queued here as well: send `render` before reading an updated snapshot or image. Each rendered frame advances the virtual clock by the configured step, so animations advance as fast as you render frames. For DPI cases, set `TESSERA_HEADLESS_SCALE_FACTOR` before starting the supervisor.

## Run tests in CI

Keep GPU rendering tests apart from layout-only tests, and run them on hosts that have a native adapter. Pin fixture fonts and assets, pass explicit times, and keep tests self-contained, independent of a developer's desktop and of network services. Assert on real outcomes, such as state changes, actions, semantics or pixels.

For profiling captures and command options, see the [CLI reference](/guide/cli). Public test types are documented in the [core API reference](https://tessera-ui.github.io/tessera/tessera_ui/).
