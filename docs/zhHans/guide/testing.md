---
title: 测试与无头自动化
description: 使用 UiTest 测试布局、交互、无障碍与 GPU 像素输出，以及用 cargo tessera headless 通过 JSONL 驱动完整应用。
---

# 测试与无头自动化

Tessera 的 UI 测试就是普通的 Rust `#[test]` 函数，统一通过 `tessera_ui::testing::UiTest` 驱动。布局、语义、焦点和输入测试全在 CPU 上完成，无需窗口或 GPU；需要验证着色器或像素时，在同一个 `UiTest` 上启用离屏渲染即可；需要脚本或编程 Agent 驱动真实构建的应用时，使用 `cargo tessera headless`。

启用测试能力时，为 `tessera-ui` 打开 `testing` feature；用到 `.rendered(...)` 或 `cargo tessera headless` 时再打开 `headless` feature。

## 布局与几何断言

`UiTest::new()` 会创建一个确定性的测试会话（默认 800 × 600 视口、60 Hz 虚拟帧步长）。配置好视口、缩放系数和根内容后，调用 `.frame()` 推进一帧，再按 `test_tag`、唯一组件函数名或语义标签选中节点并断言：

```rust
use tessera_components::{row::row, spacer::spacer};
use tessera_foundation::modifier::{ModifierExt as _, SemanticsArgs};
use tessera_ui::{Dp, Modifier, tessera, testing::UiTest};

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
    let layout = UiTest::new()
        .viewport(320, 240)
        .scale_factor(1.0)
        .content(layout_fixture)
        .frame();

    layout.node("gap").position(0, 0).size(80, 24);
}
```

测试里显式设置 `.scale_factor(...)`，确保期望的物理像素值不受开发机显示器 DPI 影响。断言链支持 `exists()`、`position(x, y)`、`size(width, height)`、`rect(...)`、`x` / `y` / `width` / `height`、相对方位断言（`above`、`below`、`left_of`、`right_of`、`align_start_with`、`align_top_with`、`same_width_as`、`same_height_as`）以及 `bounds()`。

## 交互、无障碍与虚拟时间

保留 `UiTest` 实例即可连续注入点击、指针/触摸/键盘/IME 事件、触发无障碍动作并推进虚拟时钟：

```rust
use std::time::Duration;

use tessera_components::{button::button, column::column, text::text, theme::material_theme};
use tessera_ui::{
    accesskit::{Action, Role},
    remember, tessera,
    testing::UiTest,
};

#[tessera]
fn counter() {
    let count = remember(|| 0u32);
    material_theme().child(move || {
        column().children(move || {
            text(format!("Count: {}", count.get()));
            button()
                .on_click(move || count.set(count.get() + 1))
                .child(|| text("Add"));
        });
    });
}

#[test]
fn add_increments_count() {
    let mut ui = UiTest::new().viewport(320, 240).scale_factor(1.0).content(counter);
    ui.frame();

    let tree = ui.inspect_accessibility().expect("accessibility tree");
    let (label, _) = tree.find("Add", Role::Label).expect("Add label");
    let (button_id, _) = tree
        .ancestor_with_role(label, Role::Button)
        .expect("Add button");

    assert!(ui.accessibility_action(button_id, Action::Click));
    ui.advance(Duration::from_millis(16));
    ui.inspect_components().labeled("Count: 1");
}
```

常用的 `UiTest` 能力：

- **输入注入**：`ui.node("tag").click()`、`click_at(pos)`、`pointer_move` / `pointer_press` / `pointer_release` / `pointer_scroll`、`touch_start` / `touch_move` / `touch_end` / `touch_cancel`、`press_key`、`inject_key_event`、`set_key_modifiers`、`inject_text`、`dispatch_system_back`。
- **虚拟时钟**：`frame_step(duration)`、`advance(duration)`、`frames(count)`、`settle()`（持续推进直到动画与失效全部收敛）。
- **状态检查与探针**：`inspect_components()`、`inspect_accessibility()`、`work()`、`work_totals()`、`diagnostics()`，以及跨帧传出回调或状态句柄的 `TestProbe<T>`。

在帧外直接读写状态或调用控制器时，包进 `ui.run(|| ...)` 激活该测试的会话。

## 离屏 GPU 像素测试

链上 `.rendered(module)`（需启用 `headless` feature 且主机具备原生 GPU 适配器）即可在离屏渲染管线后读取像素或检查 GPU 资源：

```rust
use tessera_components::ComponentsPackage;
use tessera_ui::{EntryRegistry, testing::UiTest};

#[test]
fn renders_offscreen_pixels() {
    let mut registry = EntryRegistry::new();
    registry.register_package(ComponentsPackage);

    let mut ui = UiTest::new()
        .viewport(320, 240)
        .scale_factor(1.0)
        .rendered(registry.finish())
        .content(layout_fixture);

    ui.frames(1);
    let pixels = ui.read_pixels();
    assert_eq!(pixels.len(), 320 * 240 * 4);
}
```

要从应用真实入口（`crate::run()`）连带全套包与多语言一起测，直接调用 `EntryPoint::into_headless(HeadlessConfig { .. })`。在 CI 中建议把带 GPU 的测试与纯 CPU 布局测试拆开运行。

## 用 `cargo tessera headless` 驱动完整应用

`cargo tessera headless` 通过标准输入输出的 JSONL 协议管理离屏工作进程，运行的是应用共用的 `EntryPoint::run_desktop()` 路径（需开启 `tessera-ui/headless`）：

```sh
cargo tessera headless -p my-app --width 800 --height 600 --frame-time-ms 16
```

收到 `{"event":"ready"}` 后即可按行发送命令：

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

可用命令包括 `spawn`、`render`、`input`（`press`、`release`、`move`、`scroll`）、`text`、`snapshot`、`resources`、`resize`、`rebuild`、`list`、`kill` 与 `shutdown`。输入按队列生效，发送 `input` 或 `text` 后先发 `render`，再读取最新的 `snapshot` 或 PNG。启动前设置 `TESSERA_HEADLESS_SCALE_FACTOR` 可以测试不同 DPI 缩放场景。
