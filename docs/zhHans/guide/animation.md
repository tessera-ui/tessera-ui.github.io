---
title: 动画
description: 使用标准组件自带的动效，并用帧时钟驱动你自己的过渡。
---

# 动画

Tessera 的动画分两部分。标准组件自己负责动效：面板和对话框打开、关闭时有动画，开关会移动滑块，你通过组件的状态和控制器触发它们。自定义动效则使用帧时钟：注册一个每帧调用的回调去更新状态，插值由你自己编写。帧时钟就是公开的动画 API；组件内部使用的缓动曲线和弹簧属于私有实现。

## 使用组件自带的动效

组件有动效时，由它的控制器启动。`DialogController::open()` 和 `close()` 会开始对话框的进入和退出动画。`SideSheetController` 和 `BottomSheetController` 的用法相同；面板还在打开的过程中调用 `close()`，它会从当前位置平滑地反向收回。包括这两种面板在内，有几个控制器提供 `is_animating()`，可以用来判断动画是否已经结束。

移动内容的控制器会区分立即变化和动画变化。`CarouselController` 有 `jump_to_item` 和 `animate_to_item`；`PagerController` 有 `jump_to_page` 和 `scroll_to_page`，后者会带着吸附平滑地滚向目标页。希望悄悄完成的移动（比如恢复之前的位置）用跳转即可。

每个控制器的方法见[组件 API 参考](https://tessera-ui.github.io/tessera/tessera_components/)，动效的实际效果可以在[在线示例](https://tessera-ui.github.io/tessera/example/)里查看。

## 用帧时钟编写动画

自定义动画在组件构建中调用 `receive_frame_nanos`。回调接收一个 `u64` 时间戳，返回 `FrameNanosControl::Continue` 表示下一帧继续调用，返回 `FrameNanosControl::Stop` 则注销。

下面的标签把百分比从 0 数到 100：

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

过渡从组件的第一帧开始，持续 300 毫秒。进度按经过的时间计算，所以某一帧来晚了，也会直接跳到正确的值，动画始终按时进行。注册外面的 `if` 保证只在动画还在进行时注册订阅。

## 帧回调的行为

上面的例子依赖下面几条规则：

- **回调与调用位置绑定。** 注册关联到组件以及它在构建中的位置。在同一位置再次调用 `receive_frame_nanos`，会保留已经生效的回调，连同它捕获的值。目标可能在动画途中改变时，应捕获状态句柄，在回调里读取当前目标。
- **回调会让组件重建。** 接收器生效期间，注册它的组件每一帧都会重建，新状态就是这样显示出来的。这也是动画一停就应返回 `Stop` 的另一个原因。
- **回调随组件一起结束。** 所属组件被移除时，它的接收器也会一并移除。
- **回调只负责更新状态。** 回调要求 `Send + 'static`，用来更新状态，组件树在随后的重建中构建。`receive_frame_nanos` 本身要在组件构建期间调用，在测量或之后的阶段调用会 panic。

## 朝目标值过渡

很多过渡是对某个变化的响应，还可能被下一次变化打断。下面的面板在点击按钮时淡入或淡出详情。回调每一帧都读取 `visible`，所以淡入淡出途中再次点击，动画会从当前位置掉头：

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

完整的一次淡入或淡出需要 200 毫秒。回调停止后，下一次点击触发重建，构建时发现 `opacity` 偏离了新的目标，就会在同一位置注册一个新的接收器。

`if opacity.get() > 0.0` 这一行很重要。`alpha` 只改变绘制的不透明度：完全透明的节点仍然占据布局空间，仍然可以获得焦点，也仍然出现在语义树里。本该消失的内容应当移除，就像示例在不透明度降到零时所做的那样。

## 时钟值

| API | 值 |
| --- | --- |
| `current_frame_nanos()` | 从当前运行时帧时钟原点起算的纳秒数 |
| `current_frame_time()` | 当前帧的 `Option<Instant>` 时间戳 |
| `frame_delta()` | 距上一帧的 `Duration` |

时钟原点是运行时第一帧的时间戳，因此第一帧的时间戳和时间差都是零；之后才订阅的动画，从时钟当时的读数开始。这些值从该原点起算，不是墙上时钟时间，只在当前运行的会话内有意义。请在同一个时钟上记录起点，再用时间差计算。

## 让动效可复现

用框架提供的时间戳或时间差推进动画。这样动效与帧绑定，在测试中也能复现；读取 `Instant::now()`、休眠或定时任务都会破坏这一点。

把插值写成普通函数（比如上面的 `step_toward`），不运行任何 UI 就能测试它：

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

要测试组件本身，启用 `tessera-ui` 的 `testing` feature。`testing::pump_layout_test_session` 接受显式的帧时间戳，`testing::advance_layout_test_session_by_nanos` 按你指定的时间差推进会话。如何建立测试会话见[测试](/zhHans/guide/testing)。

帧时钟的详细说明见[核心 API 参考](https://tessera-ui.github.io/tessera/tessera_ui/)。
