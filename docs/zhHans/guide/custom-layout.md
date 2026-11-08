---
title: 自定义布局
description: 编写负责测量和放置内容的布局修饰符，并观察内容最终的位置。
---

# 自定义布局

行、列、盒子和惰性容器能满足大多数界面。某个节点需要它们都不提供的尺寸或放置方式时，可以写一个布局修饰符：这是一个小节点，接收传入的约束，测量内部内容，再决定把它放在哪里。最后把它包装成普通的修饰符方法，应用代码像调用其他修饰符一样调用它，测量细节留在节点内部。

请先用[标准容器](/zhHans/guide/layout)；这一页处理的是它们覆盖不到的情况。

## 测量并放置被包装的内容

包装式布局修饰符实现 `LayoutModifierNode::measure_content`。下面的节点在传入最小约束要求的空间内居中放置内容：

```rust
use tessera_ui::{
    ComputedData, Constraint, LayoutModifierChild, LayoutModifierInput,
    LayoutModifierNode, LayoutResult, MeasurementError, Modifier, PxPosition,
};

#[derive(PartialEq)]
struct CenterContent;

impl LayoutModifierNode for CenterContent {
    fn measure_content(
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
```

所有包装式修饰符都遵循同样的三步：

1. 读取传入约束。`input.layout_input.parent_constraint()` 返回带宽高区间的 `ParentConstraint`。
2. 推导要提供给内容的约束，调用 `child.measure(&constraint)`，得到以物理像素表示的 `ComputedData`。
3. 用 `child.place(position)` 放置内容，位置相对于包装节点的原点；再用 `LayoutResult::new(size)` 返回包装节点自己的尺寸。

测量和放置是两个独立的步骤，`measure` 之后要由你调用 `place`。包装节点可以与内部内容大小不同，内边距和最小尺寸约束就是这种情况。这里的节点只在测量内容时清除传入的最小值、保留最大值，再把自身尺寸限制在原始区间内，并将内容居中。因此，外层的固定尺寸就成了内容居中所用的空间。除非扩展明确要定义溢出行为，否则应像这样遵守传入边界。

`LayoutModifierNode` 要求 `Send + Sync + 'static`。这类测量代码只负责计算尺寸和位置；持久状态和组件调用属于组件构建阶段。

## 提供修饰符扩展

把底层能力调用集中在扩展实现里，应用 UI 只调用扩展方法。`ModifierCapabilityExt::push_layout` 用来追加节点，它要求节点除了 `LayoutModifierNode`，还要实现 `PartialEq`：

```rust
use tessera_ui::modifier::ModifierCapabilityExt as _;

trait CenterModifierExt {
    fn center_content(self) -> Modifier;
}

impl CenterModifierExt for Modifier {
    fn center_content(self) -> Modifier {
        self.push_layout(CenterContent)
    }
}
```

之后，应用代码就能像使用其他修饰符一样使用它。下面的组件应放在 `material_theme()` 下，应用还需注册 `ComponentsPackage`：

```rust
use tessera_components::{modifier::ModifierExt as _, text::text};
use tessera_ui::{Dp, tessera};

#[tessera]
fn centered_title() {
    text("Documents").modifier(
        Modifier::new()
            .size(Dp(240.0), Dp(80.0))
            .center_content(),
    );
}
```

外层 `size` 提供固定边界，内层的居中包装节点放宽最小值来测量文字。顺序反过来，包装节点看到的约束就不同了；修饰符链顺序的一般规则见[修饰符](/zhHans/guide/modifiers)。

可复用库应公开扩展 trait，把节点实现保持为私有。方法名应表达行为，配置参数应拥有所有权，并保留正常的修饰符顺序。放置、绘制、输入、语义和父数据交给各自对应的能力处理，测量只管尺寸。

## 用 `MeasureScope` 布局多个子组件

包装节点面对的只有一段后续内容，也就是链上剩下的部分。最内层布局策略（容器使用的就是这一种）则要测量自己的直接子组件。它实现 `LayoutModifierNode::measure`，接收一个 `MeasureScope`。最内层策略实现 `measure`，包装节点实现 `measure_content`；两个默认方法都会返回错误，所以要实现与节点角色相符的那一个。只实现了 `measure` 的节点，用 `push_layout` 追加后仍然是纯测量策略；要包装内容，请实现 `measure_content`。

下面的实现把所有子组件叠放在原点，只用来说明策略约定：这类策略要由容器组件来使用，和前面的修饰符扩展承担的是不同的角色：

```rust
use tessera_ui::{Px, layout::MeasureScope};

#[derive(PartialEq)]
struct StackAtOrigin;

impl LayoutModifierNode for StackAtOrigin {
    fn measure(&self, scope: &mut MeasureScope<'_>) -> Result<LayoutResult, MeasurementError> {
        let parent = *scope.parent_constraint().as_ref();
        let loose = scope.parent_constraint().without_min();
        let mut width = Px::ZERO;
        let mut height = Px::ZERO;
        let mut result = LayoutResult::new(ComputedData::ZERO);

        for child in scope.children() {
            let measured = child.measure(scope, &loose)?;
            width = width.max(measured.width);
            height = height.max(measured.height);
            result.place_child(measured, PxPosition::ZERO);
        }

        Ok(result.with_size(ComputedData {
            width: parent.width.clamp(width),
            height: parent.height.clamp(height),
        }))
    }
}
```

`scope.children()` 返回可复制的 `LayoutChild` 句柄。`child.measure(scope, &constraint)` 返回包含宽高和 `size()` 的 `MeasuredChild`。`LayoutResult` 记录当前节点的计算尺寸和各子组件的位置。记录位置时，把子句柄或测量结果交给 `place_child`，放置身份由它们携带。

::: warning 注意
需要留在布局中的子组件，都要测量并放置。未放置的子组件，即使已经测量，整棵子树也会被排除在绘制、输入几何、语义和键盘焦点之外。相反，已放置但位于滚动视口之外的子组件，仍然可以参与焦点显示。
:::

有时你需要先知道子组件的尺寸，才能决定真正的约束。`child.probe` 可以拿到一次试探性的测量结果，它与父布局的最终测量分开记录。`probe_intrinsic` 单独探测内容的自然尺寸，排除最小交互尺寸带来的留白，同时保留其他尺寸限制和内边距。探测之后仍要正常测量子组件，最终布局由这次测量发布。

## 区分测量和放置

Tessera 可以只重新放置、不重新测量，这样开销更小，前提是你的节点说清楚哪些状态影响哪个阶段。尺寸和约束计算应留在测量阶段。状态只改变位置时，通过 `MeasureScope::placement` 或 `LayoutModifierInput::placement` 计算这个位置。在其中读取的状态只会让放置失效，所以测量尺寸要在这个闭包之外计算。失效如何在各阶段之间传递，见[渲染阶段与性能](/zhHans/guide/rendering)。

最内层策略可以实现 `place_children(&PlacementScope, &PlacementResult) -> Option<PlacementResult>`，根据缓存的尺寸重新放置子组件。`PlacementScope::children()` 提供子组件及其测量尺寸，`size()` 返回当前节点尺寸。无法脱离测量重新计算位置时，返回 `None`。包装节点则通过 `measure_content` 包住缓存的内部结果，保持内容边界一致。

对于可比较的节点，`measure_eq` 和 `placement_eq` 默认按值相等判断。只有能准确划分每个属性时才覆盖它们：纯绘制属性与测量无关，改变所提供约束的属性则算作测量变化。父数据扩展的载荷可以比较时，应实现 `equivalent`。

## 观察几何信息

有时你只想知道内容最后落在哪里：用来定位提示框、确定画布大小，或者把矩形交给平台 API。几何观察器会在放置完成后报告这些信息。请按消费者实际需要的坐标空间来选：

| 需要的数据 | API |
| --- | --- |
| 未经缩放的局部测量尺寸 | `on_layout_size_changed` |
| 相对容器的边界 | 容器使用 `layout_coordinate_space`，后代使用 `on_layout_rect_in_space` |
| 局部尺寸与精确的窗口变换 | `on_layout_coordinates` |
| 带小数的窗口矩形 | `on_globally_positioned_precise` |
| 整数窗口矩形 | `on_globally_positioned` |
| 祖先裁剪与窗口边界内剩余的范围 | `on_visible_window_bounds` |

`on_layout_size_changed` 在首次放置后以及每次局部尺寸变化后调用；祖先只是移动或缩放时，局部尺寸不变，回调也不会触发。下面的文字把自己的局部尺寸保存下来，供别处使用：

```rust
use tessera_ui::{PxSize, remember};

#[tessera]
fn observed_label() {
    let measured = remember(|| None::<PxSize>);
    text("Measured content").modifier(
        Modifier::new().on_layout_size_changed(move |size| {
            if measured.get() != Some(size) {
                measured.set(Some(size));
            }
        }),
    );
}
```

`set` 之前先比较，只在尺寸确实变化时才写入状态。几何回调观察的是已经完成的布局。报告的边界可以用来确定其他内容的尺寸或位置；把节点自己的边界反过来用于它自身的尺寸，会形成布局反馈循环。

相对边界观察器使用最近声明的坐标空间；没有声明时使用窗口坐标。已声明的坐标空间整体移动或缩放时，后代在该空间内的矩形保持不变。

`LayoutCoordinates` 包含 `local_size` 和 `local_to_window`，`window_bounds()` 把该尺寸映射到窗口。用 `LocalToWindow` 映射点、向量和矩形，或者把窗口坐标反向映射给局部消费者。这个映射已经包含密度和祖先缩放，直接使用即可。完全被裁剪，或者原先已放置的布局变为未放置时，可见边界返回 `None`；其他内容造成的遮挡不在计算范围内。

`on_layout_coordinates`、全局位置观察器和变换观察器需要导入 `tessera_ui::FocusModifierExt`。局部尺寸、相对空间和可见边界方法是 `Modifier` 的固有方法。

扩展 trait 见[核心 API 参考](https://tessera-ui.github.io/tessera/tessera_ui/)，布局断言见[测试](/zhHans/guide/testing)。要绘制内容而不是摆放内容，请继续阅读[绘制与着色器](/zhHans/guide/drawing)。
