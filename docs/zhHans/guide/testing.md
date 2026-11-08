---
title: 测试
description: 不开窗口测试布局、语义和交互，需要像素时离屏渲染，并通过 JSONL 驱动完整应用。
---

# 测试

Tessera 的 UI 测试就是普通的 Rust `#[test]` 函数。大多数测试不需要窗口和 GPU：你为夹具指定明确的尺寸、密度和时间，按测试标签或无障碍标签找到节点，对它执行操作，再断言布局和语义。测试依赖真实像素、键盘输入或 IME 时，无窗口渲染器可以离屏运行同一个入口；`cargo tessera headless` 则让脚本驱动整个应用。

选择能观察到目标行为的最轻量的工具：

- **布局会话**（`layout_test`）在 CPU 上构建组件并计算布局。适合检查尺寸与放置、发布的语义、无障碍动作和指针输入。
- **无窗口渲染器**（`into_headless`）需要 GPU 适配器。适合检查像素、渲染管线、键盘和 IME 输入，以及从应用真实入口启动、带上已注册包的测试。
- **JSONL 会话**（`cargo tessera headless`）在工作进程中运行构建好的应用，你通过标准输入输出来控制它。

布局会话需要为应用的 `tessera-ui` 依赖启用 `testing` 特性，无窗口渲染器还需要启用 `headless`。

## 编写布局测试

`layout_test` 构建组件并计算布局，不创建窗口，也不创建渲染器。下面的夹具放置一个固定尺寸的间隔，并给它加上标签，方便测试找到它：

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

`viewport_px(width, height)` 以物理像素设置视口，`scale_factor(factor)` 设置一个 `Dp` 对应多少物理像素，取值必须有限且为正数。显式指定密度后，无论机器的显示设置如何，预期尺寸都保持不变。和在应用中一样，夹具里的 Material 组件仍然需要 `material_theme()` 祖先。

### 查找节点

`LayoutSnapshot::node` 按 `test_tag` 查找节点。已放置节点的标签必须唯一，`root` 保留给根节点。树中唯一的组件函数名也可以作为选择器，但用标签能让测试不受组件结构变化的影响。选择器找不到或有歧义时会 panic，测试随之失败，并给出清楚的信息。标签属于节点语义的一部分，见[语义](/zhHans/guide/semantics)。

### 布局断言

断言链提供以下方法：

| 断言 | 检查内容 |
| --- | --- |
| `exists()` | 选择器可以解析。 |
| `position(x, y)`、`x(value)`、`y(value)` | 物理像素位置。 |
| `size(width, height)`、`width(value)`、`height(value)` | 物理像素尺寸。 |
| `above(other)`、`below(other)` | 不重叠的纵向顺序。 |
| `left_of(other)`、`right_of(other)` | 不重叠的横向顺序。 |
| `align_start_with(other)`、`align_top_with(other)` | 起始坐标或顶部坐标相同。 |
| `same_width_as(other)`、`same_height_as(other)` | 宽度或高度相同。 |

断言链覆盖不到的比较，可以用 `bounds()` 取得 `PxRect` 自己比较。这些断言检查的是布局；要检查着色器或裁剪的效果，请按下文的方法离屏渲染并读取像素。

## 操作界面并检查结果

布局会话不只能测量。用 `start_layout_test_session` 保持会话打开，就可以读取发布的无障碍树，像辅助技术那样执行动作，再检查发生了什么变化。下面是一个简单的计数器：

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

测试通过可见文字找到按钮，用无障碍动作点击它，再推进一帧，检查新的文字：

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

按钮里的文字会作为独立的文本节点发布，所以测试先找到这个文本，再用 `ancestor_with_role` 向上找到外层的按钮。如果按钮设置了 `accessibility_label`，`tree.find("Add", Role::Button)` 就能直接找到它。没有节点或有多个节点带有该标签时，`labeled` 都会 panic，因此单独调用它就相当于一条断言。

无障碍快照还提供 `reading_order()`，用来检查屏幕阅读器的阅读顺序，`focus()` 则返回当前获得焦点的节点。通过发布的语义来测试，检查的是用户实际得到的东西；需要关注哪些方面，见[无障碍](/zhHans/guide/accessibility)。

需要指针输入时，`pump_layout_test_session_with_input` 会随这一帧一起传入指针变化和光标位置。

## 控制时间

布局会话按你指定的纳秒时间戳运行每一帧，测试直接推进时间，因此动画和保留的状态在每次运行时表现都一样：

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

`advance_layout_test_session_by_nanos` 则相对上一帧推进时间。这些函数都只计算布局，需要 GPU 输出时请使用无窗口渲染器。帧时间如何驱动动画，见[动画](/zhHans/guide/animation)。

## 传入输入与记录输出

夹具的输入通过组件 props 传入。测试需要观察某些情况时，比如回调执行了几次，可以使用 `testing::TestProbe`。它提供 `new`、`get`、`set`、`with`、`with_mut` 和 `take`，克隆之间共享同一个值，因此可以把一个克隆交给夹具，另一个留在测试里。Probe 只是共享的存储，写入它不会触发重建；需要在变化时更新 UI 的值，请使用 `State`。

每个夹具拥有独立的运行时会话。要在帧之外读写状态或调用控制器，请通过 `session.run(...)` 或无窗口渲染器的 `run(...)`。归属于会话的状态、焦点目标和组件标识，只在创建它们的夹具里使用。

## 离屏渲染

无窗口渲染器不创建窗口，但**需要原生 GPU 适配器**。`EntryPoint::into_headless` 会保留入口上注册的包和渲染模块。下面的测试渲染前面的夹具并读取像素：

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

测试完整应用时，调用应用共用的入口函数，再调用 `into_headless`，这样测试使用的就是应用自己的包注册。[多语言](/zhHans/guide/i18n#check-each-language-in-tests)中有一个示例。

`step_frame`、`render_frames` 和 `render_for_duration` 推进的是虚拟时钟。要得到可重复的结果，请固定视口、密度、帧步长、输入和资源。像素比较仍然需要受控的 GPU 和后端环境。

用 `pointer_move`、`pointer_press`、`pointer_release` 或 `pointer_scroll` 排队发送指针输入，坐标为窗口像素。`press_key` 接受 `winit::keyboard::NamedKey`，`inject_text` 向获得焦点的编辑器提交文字。输入是排队处理的，断言结果之前要再渲染一帧。

### 检查输出

`inspect_components()` 返回 `ComponentSnapshot`。用 `tagged`、`find_tag`、`labeled` 或 `matching_label` 查找节点，再读取它们的 `bounds`、`layout_coordinates` 和 `semantics`。`inspect_accessibility()` 在有发布结果时返回无障碍快照，其中的 `find`、`ancestor_with_role` 和 `reading_order` 与布局会话中的用法相同，`dispatch_accessibility_action` 在这里同样可用。

用 Fluent 参数格式化的消息，会在每个参数两侧加上不可见的 Unicode 隔离符。按标签查找的方法会忽略这些字符；自己比较文本时，请使用 `testing::text_matches` 或 `testing::visible_text`。

`work()` 报告上一帧实际执行的组件、布局和绘制工作，`work_totals()` 累计整个夹具的工作，`frame_clock_diagnostics()` 报告帧时钟工作和订阅。它们适合专门保护失效处理或调度行为的测试，与对可见结果的检查配合使用。

`resource_snapshot()` 等待 GPU 完成后，报告仍持有的句柄、分配计数和分配器预留量。部分后端不提供某些计数。预留字节数不等于驻留显存，需要时请另行测量进程内存。

## 通过 JSONL 驱动完整应用

`cargo tessera headless` 会运行一个管理进程，它的工作进程通过应用共用的 `EntryPoint::run_desktop()` 路径启动应用，所以你测试的就是要发布的构建。它适合脚本化检查，也适合需要查看和操作应用的编程代理。先为应用依赖启用 `headless`，再启动：

```sh
cargo tessera headless -p my-app --width 800 --height 600 --frame-time-ms 16
```

等收到 `ready` 事件后，向标准输入每行写入一个 JSON 对象。响应从标准输出返回，如果请求带有 `id`，响应也会带上；诊断信息写到标准错误。应用日志请写到标准错误或文件，因为标准输出用来传送响应。

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

上面的坐标只是示意。点击按坐标发送：请从 `snapshot` 中取得目标节点的边界，在边界内点击。

| 命令 | 用途 |
| --- | --- |
| `spawn` | 启动命名工作进程；可用 `package`、`width`、`height` 和 `release` 覆盖默认值。 |
| `render` | 推进 `frames` 或 `duration_ms`；可用 `out` 写入 PNG。 |
| `input` | 排队发送 `press`、`release`、`move` 或 `scroll`；滚动使用 `delta_x` 和 `delta_y`。 |
| `text` | 从 `text` 字段读取内容，排队发送给获得焦点的编辑器。 |
| `snapshot` | 读取组件几何信息和无障碍输出。 |
| `resources` | 等待 GPU 完成，检查资源和图形工作。 |
| `resize` | 设置物理像素 `width` 和 `height`。 |
| `rebuild` | 源码变化后重新构建并重启选定的工作进程。 |
| `list` | 列出工作进程及其 PID。 |
| `kill` | 停止选定的工作进程。 |
| `shutdown` | 停止所有工作进程并关闭管理进程。 |

工作进程命令通过 `session` 选择目标；`spawn`、`list` 和 `shutdown` 作用于管理进程。每个工作进程的应用状态相互独立，`rebuild` 会让工作进程从初始状态重新启动。

这里的输入同样是排队处理的：读取更新后的快照或图片之前，先发送 `render`。每渲染一帧，虚拟时钟就按配置的步长前进，因此动画随渲染的帧推进，帧渲染得多快，动画就走得多快。测试 DPI 相关情况时，在启动管理进程之前设置 `TESSERA_HEADLESS_SCALE_FACTOR`。

## 在 CI 中运行

把 GPU 渲染测试和纯布局测试分开，放在有原生适配器的主机上运行。固定夹具使用的字体和资源，显式传入时间，让测试自成一体，与开发者的桌面环境和网络服务无关。断言真实的结果，比如状态变化、动作、语义或像素。

性能记录和命令选项见[命令行参考](/zhHans/guide/cli)。公开的测试类型见[核心 API 参考](https://tessera-ui.github.io/tessera/tessera_ui/)。
