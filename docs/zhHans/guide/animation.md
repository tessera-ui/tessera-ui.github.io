---
title: 动画
description: 通过组件控制器触发内置动效，并使用 launch 与 with_frame_time 编写自定义帧时钟动画。
---

# 动画

Tessera 的动画分成两层：标准控件的展开、收起与吸附动效由控制器自己驱动；需要自定义插值时，在 `launch` UI 任务里用帧时钟 `with_frame_time` 推进状态。

## 使用标准组件的内置动效

带过渡动画的控件在内部维护弹簧与缓动曲线，只需操作它们的控制器：

- **浮层类**：`DialogController::open()` / `close()`、`SideSheetController::open()` / `close()`、`BottomSheetController::open()` / `close()` 会启动进退场动画，在途中再次切换也能从当前位置平滑反向。`SideSheetController` 和 `BottomSheetController` 还提供 `is_animating()`。
- **滑动容器**：`CarouselController` 区分 `jump_to_item` 和 `animate_to_item`，`PagerController` 区分 `jump_to_page` 和 `scroll_to_page`。静默恢复初始位置用瞬间跳转，交互切换用动画过渡。

各控制器的完整方法见[组件 API 参考](https://tessera-ui.github.io/tessera/tessera_components/)。

## 用 `with_frame_time` 编写自定义动画

自定义动画通过 `launch` / `launch_once` 启动一个 UI 任务，在循环里等待 `tessera_ui::with_frame_time(|now| ...)`。每次 `await` 都会暂停到下一帧构建开始之前，把该帧的 `Instant` 传给你的闭包用于更新状态；动画收敛后立刻 `break` 退出循环，避免继续请求空帧。

下面这个标签会在 300 毫秒内从 0% 数到 100%：

```rust
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

用经过的时间差计算进度，就算某一帧偶发卡顿，下一帧也能自动追上进度。

## 响应目标变化与中途打断

把动画目标作为 `key` 传给 `launch(target, ...)`。只要目标变化——哪怕还在半路上——Tessera 会立刻取消旧任务，并从当前状态里的中间值接着转向新目标：

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

注意 `if opacity.get() > 0.0`：`.alpha(0.0)` 只会让节点透明，但它依然占着布局位置、能拿焦点并留在语义树里。淡出结束后应当把节点从树里移除。

## 让动画可测试、可复现

始终通过 `with_frame_time` 读取时间，不要使用 `Instant::now()`、外部定时器或线程休眠。这样动画才能受[测试与无头自动化](/zhHans/guide/testing)里的虚拟帧时钟控制——测试中可以用 `UiTest::advance(duration)`、`UiTest::frames(count)` 精确步进，也可以用 `UiTest::settle()` 等所有动画收敛。

像 `step_toward` 这样的纯插值函数也可以不依赖 UI 会话直接做单元测试。
