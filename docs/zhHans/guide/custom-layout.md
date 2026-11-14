---
title: 自定义布局与局部坐标
description: 实现 LayoutModifier 与 LayoutPolicy、使用 scaled_box 缩放子树，以及按需观察布局几何信息。
---

# 自定义布局与局部坐标

当标准容器（`row`、`column`、`boxed`、`flow_row`、惰性列表）满足不了尺寸计算或摆放需求时，使用 `LayoutModifier` 包装单个节点，或使用 `LayoutPolicy` 排布容器的多个子组件。

## 节点发射原语：`layout` 与 `group`

只有这两个原语会向界面树发射节点：

- `layout(policy)`：发射带 `LayoutPolicy` 的布局节点，可链式附带 `.draw(...)`、`.modifier(...)` 和 `.child(...)`。
- `group()`：不引入布局边界，用于给上层布局管理的内容挂载语义、焦点或输入修饰符。

每个组件或渲染槽上下文中**最多只能发射一个** `layout()` 或 `group()` 节点（由 `cargo tessera check` 强制检查），子内容统一放进 `.child(...)`。

## 用 `LayoutModifier` 包装内容

`LayoutModifier` 接收父级约束、测量内部内容、放置它并返回自身尺寸：

```rust
use tessera_ui::{
    ComputedData, Constraint, LayoutModifier, LayoutModifierChild, LayoutModifierInput,
    LayoutResult, MeasurementError, Modifier, PxPosition,
    modifier::ModifierCapabilityExt as _,
};

#[derive(PartialEq)]
struct CenterContent;

impl LayoutModifier for CenterContent {
    fn measure(
        &self,
        input: &LayoutModifierInput<'_>,
        child: &mut dyn LayoutModifierChild,
    ) -> Result<LayoutResult, MeasurementError> {
        let parent = *input.layout_input.parent_constraint().as_ref();
        let loose = Constraint::new(parent.width.without_min(), parent.height.without_min());
        let content = child.measure(&loose)?;
        let size = ComputedData {
            width: parent.width.clamp(content.width),
            height: parent.height.clamp(content.height),
        };
        child.place(PxPosition::from_f32_xy(
            (size.width.0 - content.width.0) as f32 / 2.0,
            (size.height.0 - content.height.0) as f32 / 2.0,
        ));
        Ok(LayoutResult::new(size))
    }
}

pub trait CenterModifierExt {
    fn center_content(self) -> Modifier;
}

impl CenterModifierExt for Modifier {
    fn center_content(self) -> Modifier {
        self.push_layout(CenterContent)
    }
}
```

对外暴露语义清晰的扩展 trait，把具体的 `LayoutModifier` 结构体保持为私有。

## 用 `LayoutPolicy` 排布子组件

将实现 `LayoutPolicy`（`Clone + PartialEq + 'static`）的值传给 `tessera_ui::layout::layout`：

```rust
use tessera_ui::{
    ComputedData, LayoutPolicy, LayoutResult, MeasurementError, Px, PxPosition, RenderSlot,
    layout::{MeasureScope, layout},
    tessera,
};

#[derive(Clone, PartialEq)]
struct Cascade {
    step: Px,
}

impl LayoutPolicy for Cascade {
    fn measure(&self, scope: &mut MeasureScope<'_>) -> Result<LayoutResult, MeasurementError> {
        let parent = *scope.parent_constraint().as_ref();
        let loose = scope.parent_constraint().without_min();
        let mut width = Px::ZERO;
        let mut height = Px::ZERO;
        let mut result = LayoutResult::new(ComputedData::ZERO);

        for (index, child) in scope.children().into_iter().enumerate() {
            let measured = child.measure(scope, &loose)?;
            let offset = Px(self.step.0 * index as i32);
            width = width.max(offset + measured.width);
            height = height.max(offset + measured.height);
            result.place_child(measured, PxPosition::new(offset, offset));
        }

        Ok(result.with_size(ComputedData {
            width: parent.width.clamp(width),
            height: parent.height.clamp(height),
        }))
    }
}

#[tessera]
fn cascade(content: RenderSlot) {
    layout(Cascade { step: Px(24) }).child(move || content.render());
}
```

编写布局策略时的关键约定：

- **测量与放置分离**：每个需要显示的子节点都必须测量并放置；未放置的子节点会从绘制、输入、语义和焦点中隐藏。需要试探尺寸时使用 `child.probe` 或 `child.probe_intrinsic`（排除最小交互触摸留白），之后仍需调用正常的 `child.measure`。
- **缓存放置**：把尺寸/约束计算留在 `measure`，把纯位置计算放进 `MeasureScope::placement`（或 `LayoutModifierInput::placement`）并实现 `LayoutPolicy::place`，仅移动位置时即可跳过重新测量。
- **脏比较与内部状态**：只有区分纯绘制与布局属性时才覆盖 `measure_eq` / `placement_eq`；若策略在测量期间故意修改内部缓存，用 `StatefulLayoutPolicy(policy)` 包装。

## 局部坐标与 `scaled_box`

原生控件始终在局部 `Px` 空间里测量和交互。需要把一个交互子树整体等比缩放（例如把固定规格的示例装进窄容器）时，用 `tessera_ui::scaled_box(scale)` 包住单个直接子节点：

```rust
use tessera_components::{column::column, md3::text::text};
use tessera_ui::{scaled_box, tessera};

#[tessera]
fn scaled_preview() {
    scaled_box(0.75).child(|| {
        column().children(|| {
            text("Scaled cleanly");
        });
    });
}
```

`scaled_box` 会把 `LocalToWindow` 变换统一应用在渲染、裁剪、指针命中、滚动位移、输入法锚点和无障碍边界上。里面的组件保持正常 `Dp` 写法即可，不需要自己乘以缩放系数。

## 观察几何位置与尺寸

根据实际消费者所处的坐标空间选用合适的观察器：

| 需要观察的信息 | 修饰符 |
| --- | --- |
| 未缩放的局部测量尺寸（`PxSize`） | `Modifier::on_layout_size_changed` |
| 相对某个祖先容器的矩形（`FloatRect`） | 祖先挂 `Modifier::layout_coordinate_space`，后代挂 `on_layout_rect_in_space` |
| 局部尺寸与窗口变换（`LayoutCoordinates`） | `FocusModifierExt::on_layout_coordinates` |
| 精确小数窗口矩形（`FloatRect`） | `FocusModifierExt::on_globally_positioned_precise` |
| 向外取整的整数窗口矩形（`PxRect`） | `FocusModifierExt::on_globally_positioned` |
| 扣除祖先裁剪与窗口边界后的可见矩形（`Option<FloatRect>`） | `Modifier::on_visible_window_bounds` |

始终把几何观察结果当作只读输出（写入状态前先比对是否变化），不要把观察到的尺寸回填给同一个节点的布局约束。
