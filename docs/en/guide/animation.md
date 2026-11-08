---
title: Animation
description: Rely on the built-in motion of standard components, and drive your own transitions from the frame clock.
---

# Animation

Tessera's animation story has two parts. The standard components animate themselves: sheets and dialogs animate open and closed, switches move their thumb, and you trigger that motion through the components' state and controllers. For anything custom, you get the frame clock, a per-frame callback that updates state, and you write the interpolation yourself. That clock is the public animation API; the easing curves and springs the components use internally stay private.

## Use built-in motion

When a component has motion, its controller starts it. `DialogController::open()` and `close()` begin the dialog's enter and exit animations. `SideSheetController` and `BottomSheetController` work the same way, and if you call `close()` while a sheet is still opening, it reverses smoothly from its current position. Several controllers, the sheets among them, report `is_animating()` so you can tell when the motion has settled.

Controllers that move content distinguish an instant change from an animated one. `CarouselController` has `jump_to_item` and `animate_to_item`; `PagerController` has `jump_to_page` and `scroll_to_page`, which moves toward the page with snap smoothing. Pick the jump for moves that should go unnoticed, such as restoring a position.

The [component API reference](https://tessera-ui.github.io/tessera/tessera_components/) lists each controller's methods, and the [running gallery](https://tessera-ui.github.io/tessera/example/) shows the motion.

## Animate with the frame clock

For custom animation, call `receive_frame_nanos` from a component build. Its callback receives a `u64` timestamp and returns `FrameNanosControl::Continue` to be called again on the next frame, or `FrameNanosControl::Stop` to unregister.

This label counts a percentage from 0 to 100:

```rust
use tessera_components::text::text;
use tessera_ui::{
    FrameNanosControl, current_frame_nanos, receive_frame_nanos,
    remember, tessera,
};

#[tessera]
fn timed_label() {
    let progress = remember(|| 0.0f32);
    let start = remember(current_frame_nanos).get();

    if progress.get() < 1.0 {
        receive_frame_nanos(move |now| {
            let elapsed = now.saturating_sub(start);
            let t = (elapsed as f64 / 300_000_000.0).min(1.0) as f32;
            progress.set_if_changed(t);
            if t < 1.0 {
                FrameNanosControl::Continue
            } else {
                FrameNanosControl::Stop
            }
        });
    }

    text(format!("{:.0}%", progress.get() * 100.0));
}
```

The transition lasts 300 milliseconds from the component's first frame. Progress comes from elapsed time, so a late frame jumps straight to the correct value and the animation stays on schedule. The `if` around the registration registers the subscription only while the animation is still running.

## How a frame callback behaves

A few rules explain what the example above relies on:

- **It belongs to a call position.** A registration is tied to its component and its position in the build. Calling `receive_frame_nanos` again from the same position keeps the callback that is already active, together with the values it captured. If the target can change mid-animation, capture state handles and read the current target inside the callback.
- **It rebuilds its component.** While a receiver is active, the component that registered it is rebuilt on every frame, which is how the new state reaches the screen. That is one more reason to return `Stop` as soon as nothing moves.
- **It ends with its owner.** When the owning component is removed, its receivers are removed with it.
- **It only updates state.** The callback must be `Send + 'static`, and its job is to update state; the component tree is built in the rebuild that follows. Call `receive_frame_nanos` itself during a component build; calling it during measure or later phases panics.

## Animate toward a target

Many transitions run in response to a change, and may be interrupted by the next one. This panel fades its details in and out when you click the button. Because the callback reads `visible` on every frame, clicking again mid-fade turns the animation around from wherever it is:

```rust
use tessera_components::{
    button::button, column::column, modifier::ModifierExt as _, text::text,
};
use tessera_ui::{FrameNanosControl, Modifier, receive_frame_nanos, remember, tessera};

#[tessera]
fn fading_details() {
    let visible = remember(|| false);
    let opacity = remember(|| 0.0f32);
    let last_frame = remember(|| None::<u64>);
    let goal = if visible.get() { 1.0 } else { 0.0 };

    if opacity.get() != goal {
        receive_frame_nanos(move |now| {
            let elapsed = last_frame.get().map_or(0, |last| now.saturating_sub(last));
            last_frame.set(Some(now));
            let goal = if visible.get() { 1.0 } else { 0.0 };
            let max_step = elapsed as f32 / 200_000_000.0;
            let next = step_toward(opacity.get(), goal, max_step);
            opacity.set_if_changed(next);
            if next == goal {
                last_frame.set(None);
                FrameNanosControl::Stop
            } else {
                FrameNanosControl::Continue
            }
        });
    }

    column().children(move || {
        button()
            .on_click(move || visible.with_mut(|value| *value = !*value))
            .child(|| text("Details"));
        if opacity.get() > 0.0 {
            text("Shipped on Monday")
                .modifier(Modifier::new().alpha(opacity.get()));
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

A full fade takes 200 milliseconds. Once the callback stops, the next click finds `opacity` away from its new goal during the rebuild and registers a fresh receiver at the same position.

The `if opacity.get() > 0.0` matters. `alpha` only changes drawing opacity: a fully transparent node still takes up layout space, can still receive focus and still appears in the semantics tree. Remove content that is meant to be gone, as the example does once the opacity reaches zero.

## Clock values

| API | Value |
| --- | --- |
| `current_frame_nanos()` | Nanoseconds since this runtime's frame-clock origin |
| `current_frame_time()` | The current frame's `Option<Instant>` timestamp |
| `frame_delta()` | A `Duration` since the preceding frame |

The clock origin is the timestamp of the runtime's first frame, so the first frame has timestamp zero and a zero delta, and an animation that subscribes later starts from whatever the clock reads by then. The values count from that origin, not wall-clock time, so they are meaningful only within the running session. Record a start value from the same clock and work with elapsed differences.

## Keep motion deterministic

Advance animations from the supplied timestamps or deltas. That ties motion to frames and makes it reproducible in tests, which reading `Instant::now()`, sleeping or running timer tasks would break.

Keeping the interpolation in an ordinary function, like `step_toward` above, lets you test it without running any UI:

```rust
#[cfg(test)]
mod tests {
    use super::step_toward;

    #[test]
    fn step_toward_lands_on_goal() {
        assert_eq!(step_toward(0.0, 1.0, 0.25), 0.25);
        assert_eq!(step_toward(0.9, 1.0, 0.25), 1.0);
        assert_eq!(step_toward(1.0, 0.0, 0.25), 0.75);
    }
}
```

To test the component itself, enable the `tessera-ui` `testing` feature. `testing::pump_layout_test_session` accepts explicit frame timestamps, and `testing::advance_layout_test_session_by_nanos` advances a session by a delta you choose. [Testing](/guide/testing) shows how to set up a session.

The [core API reference](https://tessera-ui.github.io/tessera/tessera_ui/) documents the frame clock.
