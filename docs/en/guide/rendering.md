---
title: Rendering, incremental frames, and performance
description: How Tessera isolates frame phases, keeps updates incremental, and profiles CPU and GPU work.
---

# Rendering, incremental frames, and performance

Tessera caches component subtrees, measured layouts, paint records, and scene pixels between frames so each state change re-does only the work it actually affects. Knowing how dependencies isolate across phases lets you keep frames fast and diagnose bottlenecks cleanly.

## Five phases of a frame

1. **Build**: execute invalidated `#[tessera]` functions to declare children, props, and modifiers.
2. **Measure**: compute sizes under parent `Constraint`s.
3. **Place**: position measured children and update coordinate geometry.
4. **Draw**: record draw and compute commands for placed nodes.
5. **Present**: submit GPU passes and copy the retained scene target to the output.

## Dependency isolation

Reads are tracked separately by phase:

- **Build reads** subscribe the executing component: read `State` near the leaf that renders it, and pass `State<T>` handles through intermediate components so containers stay skipped.
- **Prop equality** skips unchanged children during parent rebuilds (`set_if_changed` avoids redundant writes when a computed result is unchanged).
- **Measure vs. place vs. draw**: reading state inside measurement invalidates layout size; reading only inside placement (`MeasureScope::placement`) updates positions without re-measuring; reading only in draw updates paint without re-measuring or re-placing.
- **Unplaced subtrees**: a child that is measured (or hidden) without being placed is excluded from drawing, hit testing, accessibility, and keyboard focus.

## Retained scene pixels and partial redraw

Between frames, Tessera preserves the rendered scene target and collects old/new bounds of changed branches into a damage rectangle, replaying intersecting commands in scene order while keeping clipping, blending, and MSAA intact. Idle frames skip scene uploads and draws entirely.

Partial redraw falls back to a full scene redraw when:

- Background-sampling draws (`SampleRegion`, such as `fluid_glass`) or compute passes are active (including the first frame after removal).
- The viewport resizes or the render target is recreated.
- A custom `DrawCommand` leaves `supports_partial_redraw()` at its default `false`.

## Practical performance habits

- Read state at the leaf; pass `State<T>` handles instead of cloned values through wrappers.
- Use `set_if_changed` when repeated updates may produce the same value.
- Use `lazy_column`, `lazy_row`, and lazy grids for long collections instead of scrolling a plain `column`.
- Launch I/O and heavy work on `Dispatcher::Io` / `Dispatcher::Default` and write results back on `Dispatcher::Ui`; see [Background tasks](/guide/tasks).
- Treat geometry observers (`on_layout_size_changed`, `on_layout_coordinates`) as outputs—feeding them back into the same node's size creates a layout feedback loop.

## Verifying work in tests

Use `UiTest::work()`, `work_totals()`, and `diagnostics()` (with the `testing` feature) to assert that a state change rebuilds only the expected component:

```rust
use std::time::Duration;

use tessera_components::{column::column, text::text, theme::material_theme};
use tessera_ui::{
    State, remember, tessera,
    testing::{TestProbe, UiTest, WorkPhase},
};

#[tessera]
fn value_label(value: State<u32>) {
    text(format!("Value: {}", value.get()));
}

#[tessera]
fn counter_fixture(handle: TestProbe<Option<State<u32>>>) {
    let value = remember(|| 0u32);
    handle.set(Some(value));
    material_theme().child(move || {
        column().children(move || {
            value_label(value);
            text("Caption");
        });
    });
}

#[test]
fn only_the_reader_rebuilds() {
    let handle = TestProbe::new(None);
    let fixture = handle.clone();
    let mut ui = UiTest::new()
        .viewport(320, 240)
        .scale_factor(1.0)
        .content(move || counter_fixture(fixture.clone()));
    ui.frame();

    let value = handle.get().expect("fixture built");
    ui.run(|| value.set(1));
    ui.advance(Duration::from_millis(16));

    let work = ui.work();
    assert_eq!(work.count("value_label", WorkPhase::Build), 1);
    assert_eq!(work.count("counter_fixture", WorkPhase::Build), 0);
}
```

## Profiling a live app

Use `cargo tessera` to observe live builds and capture frame traces:

```sh
cargo tessera dev -p my-app --top
cargo tessera dev -p my-app --debug-dirty-overlay
cargo tessera dev -p my-app --profiling-output target/desktop.jsonl
cargo tessera headless -p my-app --profiling-output target/headless.jsonl
cargo tessera profiling analyze target/headless.jsonl --top 30
```

- `--top` shows a live terminal breakdown per component.
- `--debug-dirty-overlay` tints replayed regions to verify partial redraw visually.
- `--profiling-output` records per-frame CPU timings for build, layout, render preparation, encoding, and submission. Note that component build timings are inclusive of child builds.

For native GPU timestamp queries (`render_gpu_ns`), run a `profiling`-enabled build with `TESSERA_GPU_TIMING=1` (or `TESSERA_HEADLESS_GPU_TIMING=1` for headless). Because GPU timing waits for GPU readback every frame, measure normal frame pacing in a separate run with timing variables unset.
