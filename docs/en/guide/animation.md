---
title: Animation
description: Use built-in component motion through controllers and drive custom animations with launch and with_frame_time.
---

# Animation

Tessera handles animation in two ways: standard components animate their own transitions through controllers, and custom animations run inside UI tasks driven by the framework frame clock (`with_frame_time`).

## Built-in component motion

Interactive and overlay components manage their own springs and easing curves internally:

- **Overlays**: `DialogController::open()` / `close()`, `SideSheetController::open()` / `close()`, and `BottomSheetController::open()` / `close()` animate open and closed, smoothly reversing mid-flight if toggled again. Controllers such as `SideSheetController` and `BottomSheetController` also expose `is_animating()`.
- **Scrollable content**: `CarouselController` distinguishes `jump_to_item` from `animate_to_item`, and `PagerController` distinguishes `jump_to_page` from `scroll_to_page`. Use instant jumps when restoring state silently.

See the [component API reference](https://tessera-ui.github.io/tessera/tessera_components/) for each control's controller methods.

## Driving custom motion with `with_frame_time`

To animate custom values, start a UI task with `launch` / `launch_once` and await `tessera_ui::with_frame_time(|now| ...)` inside a loop. Each call suspends until the next frame, runs your closure with that frame's `Instant` timestamp (before component build runs), and lets you update state—break out of the loop as soon as the animation finishes so no idle frame wakes remain.

Here is a progress label that counts from 0% to 100% over 300 milliseconds:

```rust
use std::time::Duration;

use tessera_components::text::text;
use tessera_ui::{launch_once, remember, tessera, with_frame_time};

#[tessera]
fn timed_label() {
    let progress = remember(|| 0.0f32);

    launch_once(async move {
        let mut start = None;
        loop {
            let done = with_frame_time(|now| {
                let start = *start.get_or_insert(now);
                let elapsed = now.saturating_duration_since(start);
                let t = (elapsed.as_secs_f32() / 0.3).min(1.0);
                progress.set_if_changed(t);
                t >= 1.0
            })
            .await;
            if done {
                break;
            }
        }
    });

    text(format!("{:.0}%", progress.get() * 100.0));
}
```

Computing progress from elapsed time keeps animations on schedule even if a frame takes longer than usual.

## Interruptible transitions toward a target

Pass the target value as the `key` to `launch(target, ...)`. Whenever `target` changes—even mid-animation—Tessera cancels the old task and starts the new one from whatever value is currently stored in state:

```rust
use tessera_components::{button::button, column::column, text::text};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Modifier, launch, remember, tessera, with_frame_time};

#[tessera]
fn fading_details() {
    let visible = remember(|| false);
    let opacity = remember(|| 0.0f32);
    let target = if visible.get() { 1.0f32 } else { 0.0f32 };

    launch(target.to_bits(), async move {
        if opacity.get() == target {
            return;
        }
        let mut last = None;
        loop {
            let settled = with_frame_time(|now| {
                let dt = last
                    .replace(now)
                    .map_or(0.0, |prev| now.saturating_duration_since(prev).as_secs_f32());
                let next = step_toward(opacity.get(), target, dt / 0.2);
                opacity.set_if_changed(next);
                next == target
            })
            .await;
            if settled {
                break;
            }
        }
    });

    column().children(move || {
        button()
            .on_click(move || visible.with_mut(|v| *v = !*v))
            .child(|| text("Details"));
        if opacity.get() > 0.0 {
            text("Shipped on Monday").modifier(Modifier::new().alpha(opacity.get()));
        }
    });
}

fn step_toward(current: f32, goal: f32, max_step: f32) -> f32 {
    if (goal - current).abs() <= max_step {
        goal
    } else {
        current + max_step.copysign(goal - current)
    }
}
```

Notice `if opacity.get() > 0.0`: `.alpha(0.0)` makes a node invisible, but it still occupies layout space, receives focus, and appears in the accessibility tree. Remove content from the tree once its fade completes.

## Keeping animations testable

Always read time from `with_frame_time` rather than `Instant::now()`, timers, or thread sleeps. That keeps motion synchronized with the virtual frame clock in [Testing and headless automation](/guide/testing), where `UiTest::advance(duration)` and `UiTest::frames(count)` step frame time deterministically, and `UiTest::settle()` runs until all animations finish.

Pure interpolation helpers such as `step_toward` can also be unit-tested directly without spinning up a UI session.
