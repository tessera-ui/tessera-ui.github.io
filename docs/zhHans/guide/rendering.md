---
title: 渲染、增量帧与性能
description: 了解 Tessera 如何按阶段隔离依赖、保持增量更新，以及如何分析与调优性能。
---

# 渲染、增量帧与性能

Tessera 会在帧与帧之间缓存组件子树、布局测量、绘制命令和场景像素，状态变化时只重跑真正受影响的部分。理解各阶段的依赖隔离方式，写出来的界面自然轻量，也更容易排查瓶颈。

## 一帧的五个阶段

1. **Build（构建）**：运行失效的 `#[tessera]` 函数，声明子组件、属性和修饰符。
2. **Measure（测量）**：在父级 `Constraint` 下计算尺寸。
3. **Place（放置）**：确定已测量子节点的坐标并更新几何变换。
4. **Draw（绘制）**：为已放置节点记录绘制与计算命令。
5. **Present（呈现）**：提交 GPU 通道并将保留的场景目标输出到屏幕。

## 跨阶段依赖隔离

各阶段的状态读取相互独立：

- **构建读取**：只订阅正在执行的组件；在靠近显示的叶子组件里读取 `State`，中间层只传句柄，就能跳过外层容器重建。
- **属性比较**：父组件重建时，属性相等的子组件直接跳过（用 `set_if_changed` 也能避免结果相同时的无意义失效）。
- **测量、放置与绘制分离**：测量阶段读取的值会使尺寸失效；仅在 `MeasureScope::placement` 里读取的值只会重算坐标而不重新测量；仅在绘制时读取的值只会重录绘制命令。
- **未放置子树**：仅测量但未被父级放置的子树，不会参与绘制、指针命中、语义发布与键盘焦点。

## 场景像素保留与局部重绘

帧间渲染会保留上一帧的场景目标，把变更或移除分支的新旧边界收集成损伤区域，只重放相交命令并保持裁剪、混合和 MSAA 一致；完全空闲的帧会跳过场景上传与绘制。

出现以下情况时会保守回退到全量重绘：

- 存在采样背后场景的绘制命令（如 `fluid_glass` 等使用 `SampleRegion` 的效果）或计算命令（含移除后的第一帧）。
- 视口尺寸改变或渲染目标重建。
- 自定义 `DrawCommand` 未覆写 `supports_partial_redraw()`（默认为 `false`）。

## 保持轻量的几个习惯

- 状态在叶子读取，中间组件只传递 `State<T>` 句柄。
- 结果可能重复的计算用 `set_if_changed`。
- 长列表和网格用 `lazy_column` / `lazy_row` / 惰性网格，不要给普通 `column` 加滚动。
- I/O 和密集计算放到 `Dispatcher::Io` / `Dispatcher::Default`，结果在 `Dispatcher::Ui` 写回，见[后台任务与异步工作](/zhHans/guide/tasks)。
- 把几何回调（`on_layout_size_changed`、`on_layout_coordinates`）当作只读输出，不要把测量结果反过来写进同一节点的尺寸，以免形成布局反馈循环。

## 在测试中验证重建范围

启用 `testing` feature 后，可以用 `UiTest::work()`、`work_totals()` 和 `diagnostics()` 直接断言只重建了预期的组件：

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

## 分析运行中应用的性能

使用 `cargo tessera` 实时查看或导出帧性能数据：

```sh
cargo tessera dev -p my-app --top
cargo tessera dev -p my-app --debug-dirty-overlay
cargo tessera dev -p my-app --profiling-output target/desktop.jsonl
cargo tessera headless -p my-app --profiling-output target/headless.jsonl
cargo tessera profiling analyze target/headless.jsonl --top 30
```

- `--top` 在终端实时显示各组件耗时排行。
- `--debug-dirty-overlay` 高亮标出每帧重放的脏区域，方便直观验证局部重绘。
- `--profiling-output` 记录每帧构建、布局、准备、编码与提交的 CPU 耗时（组件构建耗时包含其子组件耗时，请勿直接累加嵌套样本）。

在启用了 `profiling` 的原生构建中，设置 `TESSERA_GPU_TIMING=1`（或离屏使用的 `TESSERA_HEADLESS_GPU_TIMING=1`）可采集 `render_gpu_ns` GPU 时间戳。由于 GPU 计时每帧需要等待回读，测量真实帧率节奏时请单独取消该环境变量后运行。
