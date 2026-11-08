---
title: Rendering phases and performance
description: How a state change turns into a new frame, and how to find out how much work it caused.
---

# Rendering phases and performance

Tessera keeps your component tree, its layout and its drawing between frames, and redoes only the parts a change affects. Knowing which phase reads a value tells you how much work changing it will cost, and where to look when a frame is slower than it should be.

Take a counter whose label reads the count:

```rust
use tessera_components::{button::button, column::column, text::text};
use tessera_ui::{State, remember, tessera};

#[tessera]
fn value_label(value: State<u32>) {
    text(format!("Value: {}", value.get()));
}

#[tessera]
fn counter() {
    let value = remember(|| 0u32);
    column().children(move || {
        value_label(value);
        button()
            .on_click(move || value.with_mut(|value| *value += 1))
            .child(|| text("Increment"));
    });
}
```

`counter` owns the state but only passes the handle along; `value_label` is the one that reads it. When you press the button, Tessera rebuilds `value_label`. `counter` and the button keep their previous results. The new text may then need measuring and drawing again, and the rest of the tree stays as it was. Like other examples that use Material components, this one runs beneath the app's `material_theme()`.

## The phases of a frame

Every frame goes through the same steps, and each one keeps its own results:

1. **Build** runs component functions. They declare child components, props, content and modifiers.
2. **Measure** works out sizes under the parent's constraints.
3. **Place** positions each measured child and establishes its geometry.
4. **Draw** records drawing commands using the final bounds and clips.
5. **Present** submits the GPU work that is needed and copies the scene target to the output.

Measuring and placing are separate steps. A parent can measure a child and still decide whether to place it, and only placed subtrees take part in drawing, input hit testing, semantics and keyboard focus.

Build runs in declaration order. Calling a component registers a use and returns a configuration handle; the body runs later, when Tessera expands the declarations of its parent. Each use finishes its own descendants before the next sibling starts, and everything declared during the build is complete before layout begins. [Thinking in Tessera](/guide/thinking-in-tessera) covers what this means for writing components.

## State reads decide what reruns

When a component reads state during build, it subscribes to that value. A write marks the readers dirty, and the next frame rebuilds those component subtrees while reusing the branches nobody invalidated. If no build was invalidated, Tessera skips component construction for the frame entirely.

Props matter as well. When a parent rebuilds, a child whose props compare equal, and whose own build is not dirty, keeps its subtree without running its body. A child whose own state was invalidated still rebuilds when its props are equal, and changed props can require a rebuild even though no state the child reads has changed.

That leads to the most useful rule for performance: read state close to the output that needs it. Subscriptions come from reads, so a parent can hold a `State<T>` handle and pass it to the one child that displays it, and only that child subscribes. `set` and `with_mut` publish a write even when the result is unchanged; `set_if_changed` skips the invalidation when a comparable value stays the same. [State](/guide/state) covers the state API.

Reads during layout and drawing are tracked separately from reads during build. A value read in measurement invalidates measurement; a value read only while drawing invalidates paint, without rebuilding the component or recomputing its size. Custom layout and draw code has to keep these responsibilities apart to benefit; see [Custom layout](/guide/custom-layout).

## Measure and place

Measured sizes and layout results are cached. If a node's constraints are unchanged and its measurement dependencies are clean, its previous result is reused. A change that only moves content can be applied without measuring again, when the layout policy supports cached placement.

A size change can travel upwards, because the parent may have to measure again to fit it. Rebuilding one small subtree is therefore no guarantee that the work after it stays inside that subtree.

Layout runs on the UI thread and measures siblings one after another. Build, layout and draw recording are different responsibilities on that same thread, not stages on separate worker threads.

## Reuse geometry and scene pixels

Tessera retains several kinds of data, and each saves a different kind of work:

| Retained data | Work it can avoid |
| --- | --- |
| Component subtrees and props | Running unchanged component bodies |
| Measured sizes and placements | Repeating clean layout calculations |
| Drawing records and scene branches | Recording unchanged paint and rebuilding unchanged scene data |
| Scene-target pixels | Redrawing unchanged parts of an eligible scene |

When geometry changes, Tessera updates everything that consumes it: rendering, pointer hit testing, focus, position observers and accessibility. A paint-only change leaves geometry as it is.

For an eligible frame, the renderer collects the old and new drawing bounds of changed or removed branches into a damage rectangle. It clears that rectangle and replays the commands that intersect it in scene order, preserving clipping, blending and multisampling. Commands from unchanged branches may still be replayed if they overlap the damage.

If the scene has not changed at all, the renderer skips scene uploads and drawing, but presentation still copies the retained scene target to the output. An idle frame is cheap; it is not zero CPU work, zero GPU work or zero presentation cost.

## When the whole scene is redrawn

Partial redraw is conservative, and several things turn it off:

- Background sampling and compute commands currently force a full redraw, including the first frame after they are removed. Effects that read the scene behind them, such as glass, do not get the cheap redraw an ordinary fill does.
- Recreating the render target, resizing the viewport, or missing the previously rendered frame forces a full redraw. Damage describes the change since the last scene update, so it cannot be applied safely after a changed frame was dropped.
- A custom `DrawCommand` does not opt in by default. Override `supports_partial_redraw` only when every visual change invalidates its paint or geometry and `draw_region` covers every pixel it can affect. Resources that update independently, including deferred image uploads, may opt in only with that guarantee.

Retained scene pixels are not an independently composited layer for every subtree, and they do not turn per-command opacity into group opacity. Custom rendering should follow the contracts in [Drawing and shaders](/guide/drawing).

## Threads

Component builds, layout and the renderer run on the UI thread, and UI callbacks and UI state belong to that session. Access session-owned state from that thread, even through handles that are `Send + Sync`.

Background work runs elsewhere: native `TaskHandles` jobs use a Tokio multi-thread runtime, and web jobs use the browser's local executor. Neither makes layout parallel. Take a snapshot of the inputs on the UI thread and deliver the result back through the owner's `UiDispatcher`; see [Background tasks](/guide/tasks).

GPU commands execute through wgpu. Time spent recording or submitting commands on the CPU is not GPU execution time, and having background workers does not mean a given frame benefits from them.

## Keep work small

A few habits keep the work each change causes small:

- Read state in the component that displays it, and pass handles rather than values through the components in between.
- Use `set_if_changed` for values that are often written with the same result.
- Use lazy lists and grids for long collections. A scrollable column builds all of its children; see [Lists and scrolling](/guide/lists).
- Start side effects such as network requests or file writes from actions, since the build body can run on any rebuild; see [Lifecycle and side effects](/guide/lifecycle).
- Treat a node's observed size and position as output only. Geometry callbacks are observers, and feeding their values back into the node's own sizing creates a layout feedback loop.

## Check what rebuilt

To confirm that a change only causes the work you expect, count it in a test. With the `testing` feature, a layout test session records which components, policies and modifiers executed in each phase. This test reuses `value_label` from above:

```rust
use tessera_components::{column::column, text::text};
use tessera_ui::{
    State, WorkPhase, remember, tessera,
    testing::{TestProbe, layout_test, pump_layout_test_session, start_layout_test_session},
};

#[tessera]
fn counter_fixture(handle: TestProbe<Option<State<u32>>>) {
    let value = remember(|| 0u32);
    handle.set(Some(value));
    column().children(move || {
        value_label(value);
        text("Caption");
    });
}

#[test]
fn only_the_reader_rebuilds() {
    let handle = TestProbe::new(None);
    let fixture = handle.clone();
    let mut session =
        start_layout_test_session(layout_test(move || counter_fixture(fixture.clone())));
    pump_layout_test_session(&mut session, 0);

    let value = handle.get().expect("fixture built");
    session.run(|| value.set(1));
    pump_layout_test_session(&mut session, 16_000_000);

    let work = session.work();
    assert_eq!(work.count("value_label", WorkPhase::Build), 1);
    assert_eq!(work.count("counter_fixture", WorkPhase::Build), 0);
}
```

The probe hands the state handle out of the fixture so the test can write to it, and `session.run` performs the write inside the fixture's runtime session. `work()` covers the last frame; `work_totals()` accumulates over the session. `diagnostics()` adds layout counts such as measurement calls, cache hits and misses, geometry updates, paint recordings, scene updates, hit testing and semantics updates. Native headless renderers offer the same `work()` and `diagnostics()` for their most recent frame. [Testing](/guide/testing) covers fixtures and headless rendering in general.

Compare counts for the first frame, a frame with a change, and a settled frame. That tells you far more than a screenshot or an average frame rate.

## Profile a running app

For a running app, capture profiling records with the CLI and analyze them:

```sh
cargo tessera dev -p my-app --profiling-output target/desktop.jsonl
cargo tessera headless -p my-app --profiling-output target/headless.jsonl
cargo tessera profiling analyze target/headless.jsonl --top 30
```

Records cover CPU time for component builds, layout, render preparation, encoding and submission, and the analyzer ranks components by cost. A component's build time includes its children's builds, so adding nested samples together counts the same work twice. `cargo tessera dev --top` shows a live component profiler in the terminal, and `--debug-dirty-overlay` on `dev` or `build` draws the regions that were replayed, which is a quick way to see whether partial redraw is working. [CLI reference](/guide/cli) lists the options, including Android captures.

Native builds with the `profiling` feature can also record GPU timestamps: set `TESSERA_GPU_TIMING=1` (`TESSERA_HEADLESS_GPU_TIMING` is an alias) and the results appear as `render_gpu_ns`. The timestamps cover frame passes and output blitting, not prelude uploads, swapchain acquisition or compositor presentation.

::: warning
GPU timing waits for the GPU to finish every frame, and tracing adds its own cost. Measure normal frame latency in a separate run with tracing off and both GPU timing variables unset. When comparing runs, keep the workload, viewport, scale factor, target and build settings the same.
:::

Public diagnostics and rendering types are documented in the [core API reference](https://tessera-ui.github.io/tessera/tessera_ui/).
