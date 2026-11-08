---
title: 渲染阶段与性能
description: 一次状态变化如何变成新的一帧，以及如何查明它引起了多少工作。
---

# 渲染阶段与性能

Tessera 会在帧与帧之间保留组件树、布局结果和绘制结果，只重做受变化影响的部分。了解某个值是在哪个阶段读取的，就能判断修改它要付出多少代价；某一帧比预期慢时，也知道该从哪里查起。

以一个计数器为例，标签读取计数值：

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

`counter` 持有状态，但只是把句柄传下去，真正读取它的是 `value_label`。按下按钮后，Tessera 重建 `value_label`，`counter` 和按钮保留上一次的结果。新的文字可能还需要重新测量和绘制，树的其余部分保持原样。和其他使用 Material 组件的示例一样，它需要运行在应用的 `material_theme()` 之下。

## 一帧的各个阶段

每一帧都经过同样的几个步骤，每一步都保留自己的结果：

1. **构建**：运行组件函数，声明子组件、属性、内容和修饰符。
2. **测量**：在父级约束下确定尺寸。
3. **放置**：确定每个已测量子元素的位置，建立几何信息。
4. **绘制**：根据最终的边界和裁剪记录绘制命令。
5. **呈现**：提交需要的 GPU 工作，把场景目标复制到输出。

测量和放置是两个独立的步骤。父级测量子元素之后，仍可以决定是否放置它；只有被放置的子树才参与绘制、输入命中测试、语义和键盘焦点。

构建按声明顺序进行。调用组件只是登记一次使用并返回配置句柄，组件体要等 Tessera 展开父组件的声明时才运行。每次使用会先完成自己的全部后代，再轮到下一个同级；构建期间声明的所有内容都会在布局开始前完成。这对编写组件意味着什么，见 [Tessera 的思维方式](/zhHans/guide/thinking-in-tessera)。

## 状态读取决定哪些部分重新运行

组件在构建时读取状态，就会订阅这个值。写入会把读取者标记为脏，下一帧重建这些组件子树，没有失效的分支直接复用。如果没有任何构建失效，这一帧会完全跳过组件构建。

属性同样有影响。父组件重建时，如果子组件的属性比较相等，且它自身的构建没有失效，就保留原有子树，不运行组件体。子组件自身的状态失效时，即使属性相等，它也会重建；反过来，即使子组件读取的状态都没变，属性变化也可能要求它重建。

由此得出最有用的一条性能原则：在靠近输出的地方读取状态。订阅来自读取，所以父组件可以持有 `State<T>` 句柄，把它交给唯一需要显示它的子组件，只有这个子组件会订阅。`set` 和 `with_mut` 即使结果没有变化也会发布写入；对可比较的值，`set_if_changed` 在值不变时不会触发失效。状态 API 见[状态](/zhHans/guide/state)。

布局和绘制期间的读取与构建期间的读取分开跟踪。测量时读取的值只会使测量失效；仅在绘制时读取的值只会使绘制失效，不需要重建组件，也不需要重新计算尺寸。自定义布局和绘制代码要把这些职责分开，才能从中受益，见[自定义布局](/zhHans/guide/custom-layout)。

## 测量与放置

测量出的尺寸和布局结果会被缓存。节点的约束没有变化、测量依赖也没有失效时，直接复用上一次的结果。如果布局策略支持缓存放置，只移动内容的变化无需重新测量就能生效。

尺寸变化可能向上传播，因为父级可能需要重新测量来容纳它。所以只重建了一棵很小的子树，并不保证后续工作都局限在这棵子树之内。

布局在 UI 线程上运行，逐个测量同级元素。构建、布局和绘制记录是同一线程上的不同职责，而不是分布在不同工作线程上的流水线阶段。

## 复用几何信息与场景像素

Tessera 保留了好几类数据，每一类省下的工作不同：

| 保留的数据 | 可以避免的工作 |
| --- | --- |
| 组件子树与属性 | 运行没有变化的组件体 |
| 测量尺寸与放置结果 | 重复计算没有失效的布局 |
| 绘制记录与场景分支 | 重新记录没有变化的绘制、重建没有变化的场景数据 |
| 场景目标像素 | 在符合条件的场景中重绘没有变化的部分 |

几何信息变化时，Tessera 会更新所有使用它的地方：渲染、指针命中测试、焦点、位置观察器和无障碍。只影响绘制的变化会保持几何信息不变。

对于符合条件的帧，渲染器把已变化或已移除分支的新旧绘制边界合并成一个损伤矩形，清除这块区域，再按场景顺序重放与之相交的命令，同时保持裁剪、混合和多重采样的效果。没有变化的分支如果与损伤区域重叠，它的命令也可能被重放。

如果场景完全没有变化，渲染器会跳过场景上传和绘制，但呈现阶段仍然要把保留的场景目标复制到输出。空闲帧的开销很低，但并不是零 CPU 工作、零 GPU 工作或零呈现成本。

## 什么时候会重绘整个场景

局部重绘采取保守策略，以下情况都会让它失效：

- 背景采样和计算命令目前会强制全量重绘，移除它们之后的第一帧也是如此。像玻璃这样读取背后场景的效果，享受不到普通填充那样的低成本重绘。
- 重新创建渲染目标、调整视口大小，或者缺少上一帧的渲染结果，都会强制全量重绘。损伤描述的是相对上一次场景更新的变化，一旦有变化的帧被丢弃，就不能再安全地套用。
- 自定义 `DrawCommand` 默认不启用局部重绘。只有当每一次视觉变化都会使它的绘制或几何失效，并且 `draw_region` 覆盖它可能影响的所有像素时，才应重写 `supports_partial_redraw`。独立更新的资源（包括延迟上传的图片）只有在能保证这一点时才可以启用。

保留的场景像素并不是为每棵子树准备的可独立合成的图层，也不会把逐命令的透明度变成整组透明度。自定义渲染应遵守[绘制与着色器](/zhHans/guide/drawing)中的约定。

## 线程

组件构建、布局和渲染器都运行在 UI 线程上，UI 回调和 UI 状态也属于这个会话。即使句柄满足 `Send + Sync`，会话拥有的状态也要在这个线程上访问。

后台工作在别处运行：原生平台的 `TaskHandles` 任务使用 Tokio 多线程运行时，Web 上的任务使用浏览器的本地执行器。两者都不会让布局并行。在 UI 线程上取得输入快照，再通过所有者的 `UiDispatcher` 把结果送回来，见[后台任务](/zhHans/guide/tasks)。

GPU 命令通过 wgpu 执行。CPU 记录或提交命令所花的时间不是 GPU 执行时间，有后台工作线程也不代表某一帧真的从中获益。

## 减少每帧的工作

下面几个习惯能让每次变化引起的工作保持在较小范围：

- 在负责显示的组件里读取状态，中间经过的组件只传递句柄，不传递值。
- 经常被写入相同结果的值，使用 `set_if_changed`。
- 长列表和网格使用惰性列表。可滚动的列会构建全部子元素，见[列表与滚动](/zhHans/guide/lists)。
- 网络请求、文件写入之类的副作用从动作中发起，因为任何一次重建都可能运行组件体，见[生命周期与副作用](/zhHans/guide/lifecycle)。
- 把节点观察到的尺寸和位置只当作输出。几何回调是观察器，把它的值再反馈给节点自己的尺寸会造成布局反馈循环。

## 检查哪些部分被重建

想确认某个变化只引起了预期的工作，可以在测试里计数。启用 `testing` feature 后，布局测试会话会记录每个阶段执行了哪些组件、策略和修饰符。下面的测试复用了上文的 `value_label`：

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

探针把状态句柄从测试夹具中带出来，测试才能写入它；`session.run` 在夹具自己的运行时会话中执行这次写入。`work()` 统计最近一帧，`work_totals()` 累计整个会话。`diagnostics()` 还提供布局方面的计数，例如测量调用次数、缓存命中与未命中、几何更新、绘制记录、场景更新、命中测试和语义更新。原生 headless 渲染器也为最近一帧提供同样的 `work()` 和 `diagnostics()`。夹具和 headless 渲染的一般用法见[测试](/zhHans/guide/testing)。

对比首帧、发生变化的帧和稳定下来的帧的计数，得到的信息远比截图或平均帧率多。

## 分析运行中的应用

对运行中的应用，用 CLI 采集性能记录并分析：

```sh
cargo tessera dev -p my-app --profiling-output target/desktop.jsonl
cargo tessera headless -p my-app --profiling-output target/headless.jsonl
cargo tessera profiling analyze target/headless.jsonl --top 30
```

记录包含组件构建、布局、渲染准备、编码和提交的 CPU 耗时，分析器会按开销给组件排名。组件的构建耗时包含其子组件的构建，把嵌套的样本相加会重复计算同一份工作。`cargo tessera dev --top` 在终端里显示实时的组件性能视图；给 `dev` 或 `build` 加上 `--debug-dirty-overlay` 会标出被重放的区域，可以快速看出局部重绘是否生效。完整选项（包括 Android 采集）见[命令行参考](/zhHans/guide/cli)。

启用 `profiling` feature 的原生构建还可以记录 GPU 时间戳：设置 `TESSERA_GPU_TIMING=1`（`TESSERA_HEADLESS_GPU_TIMING` 是它的别名），结果记录为 `render_gpu_ns`。时间戳覆盖帧内各个 pass 和输出复制，不包括前置上传、交换链获取和合成器呈现。

::: warning 注意
GPU 计时每一帧都要等待 GPU 完成，tracing 本身也有开销。测量正常帧延迟时，应另做一次运行，关闭 tracing，并取消设置这两个 GPU 计时变量。比较多次运行时，保持负载、视口、缩放系数、目标平台和构建设置一致。
:::

公开的诊断和渲染类型见[核心 API 参考](https://tessera-ui.github.io/tessera/tessera_ui/)。
