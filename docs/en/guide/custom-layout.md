---
title: Custom layout
description: Write layout modifiers that measure and place content, and observe where content ends up.
---

# Custom layout

Rows, columns, boxes and lazy containers cover most screens. When one node needs sizing or placement that none of them provide, you can write a layout modifier: a small node that receives the incoming constraints, measures its content and decides where to put it. You then expose it as an ordinary modifier method, and application code calls it like any other modifier while the measurement details stay inside the node.

Start with the [standard containers](/guide/layout); this page is for the cases they leave uncovered.

## Measure and place wrapped content

A wrapping layout modifier implements `LayoutModifierNode::measure_content`. This one centers its content within the space required by its incoming minimum constraints:

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

The node follows the same three steps every wrapping modifier does:

1. Read the incoming constraint. `input.layout_input.parent_constraint()` returns a `ParentConstraint` with width and height intervals.
2. Derive the constraint you offer the content and call `child.measure(&constraint)`. It returns the content's `ComputedData` in physical pixels.
3. Place the content with `child.place(position)`, relative to the wrapper's origin, and return the wrapper's own size with `LayoutResult::new(size)`.

Measuring and placing are separate steps, so call `place` yourself after `measure`. The wrapper's size and its content's size can differ, as they do with padding or minimum-size enforcement. Here the node clears only the incoming minimums for the content, keeps the maximums, clamps its own size to the original intervals and centers the result. An outer exact size therefore becomes the space inside which the content is centered. Preserve incoming bounds like this unless your extension deliberately defines overflow behavior.

`LayoutModifierNode` requires `Send + Sync + 'static`. Measurement code like this only computes sizes and positions; persistent state and component calls belong to the component build.

## Expose a modifier extension

Keep capability-level calls inside an extension implementation, and let application UI call the extension method. `ModifierCapabilityExt::push_layout` appends a node and requires that node to implement `PartialEq` in addition to `LayoutModifierNode`:

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

Application code then uses it like any other modifier. Mount this component below `material_theme()` in an application with `ComponentsPackage`:

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

The outer `size` provides exact bounds, and the inner centering wrapper measures the text with relaxed minimums. Reversing that order changes the constraints the wrapper sees; [Modifiers](/guide/modifiers) explains chain order in general.

For a reusable library, make the extension trait public and keep the node implementation private. Name methods by their behavior, accept owned configuration, and preserve normal modifier ordering. Handle placement, drawing, input, semantics and parent data through their own capabilities, and keep measurement about size.

## Lay out several children with `MeasureScope`

A wrapping node sees one continuation: the rest of the chain. An innermost layout policy, the kind a container uses, measures its direct children instead. It implements `LayoutModifierNode::measure`, which receives a `MeasureScope`. Implement `measure` for that role and `measure_content` for a wrapping node; each default returns an error, so implement the method that matches the node's role. A node that implements only `measure` stays a pure-measure policy when you append it with `push_layout`; to wrap content, implement `measure_content`.

The following implementation stacks every child at the origin. It only illustrates the policy contract: a container component is what puts such a policy to use, and it plays a different role from the extension above:

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

`scope.children()` returns copyable `LayoutChild` handles. `child.measure(scope, &constraint)` returns a `MeasuredChild` with width, height and `size()`. `LayoutResult` holds the node's computed size and its child placements. Pass a child handle or measured child to `place_child`; it carries the placement identity for you.

::: warning
Measure and place every child that should remain part of the layout. An unplaced child hides its whole subtree from drawing, input geometry, semantics and keyboard focus, even if it was measured. A placed child outside a scroll viewport, by contrast, can still take part in focus reveal.
:::

Sometimes you need a child's size before deciding the real constraints. `child.probe` obtains a trial measurement that stays separate from the final parent measurement. `probe_intrinsic` probes natural content dimensions in isolation, excluding minimum interactive-size padding while preserving other sizing and padding. After probing, still measure the child normally; that measurement is what publishes the final layout.

## Separate measurement from placement

Tessera can redo placement without redoing measurement, which is cheaper, but only if your node tells it which state affects which phase. Keep size and constraint calculations in measurement. When a state value only changes position, calculate that position through `MeasureScope::placement` or `LayoutModifierInput::placement`. State read there invalidates only placement, so compute measured dimensions outside that closure. [Rendering phases and performance](/guide/rendering) explains how invalidation flows between phases.

An innermost policy can implement `place_children(&PlacementScope, &PlacementResult) -> Option<PlacementResult>` to place children using cached sizes. `PlacementScope::children()` exposes those children and their measured sizes, and `size()` returns the current node size. Return `None` when placement cannot be recomputed without measurement. Wrapping nodes use `measure_content` around the cached inner result to preserve their content bounds.

`measure_eq` and `placement_eq` default to value equality for comparable nodes. Override them only when you can classify each property accurately: a drawing-only property leaves measurement alone, and a property that changes offered constraints counts as a measurement change. Parent-data extensions should implement `equivalent` when their payloads can be compared.

## Observe geometry

Sometimes you only need to know where content ended up: to position a tooltip, size a canvas, or hand a rectangle to a platform API. Geometry observers report that after placement. Pick the coordinate space the consumer needs:

| Need | API |
| --- | --- |
| Unscaled local measured dimensions | `on_layout_size_changed` |
| Bounds relative to a container | `layout_coordinate_space` on the container, `on_layout_rect_in_space` on descendants |
| Local size and exact window transformation | `on_layout_coordinates` |
| Fractional window rectangle | `on_globally_positioned_precise` |
| Integer window rectangle | `on_globally_positioned` |
| Bounds remaining after ancestor clipping and window boundaries | `on_visible_window_bounds` |

`on_layout_size_changed` runs after initial placement and after each change of local size; an ancestor that only moves or scales leaves that size, and the callback, untouched. This label stores its local size for another consumer:

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

The comparison before `set` writes state only when the size actually changes. Geometry callbacks observe a finished layout. Use the reported bounds to size or position other content; feeding a node's own bounds back into its sizing creates a layout feedback loop.

Relative observers use the nearest declared coordinate space, or window coordinates when none exists. A descendant's rectangle within the declared space stays the same when the whole space moves or scales.

`LayoutCoordinates` contains `local_size` and `local_to_window`; `window_bounds()` maps that size into the window. Use `LocalToWindow` to map points, vectors and rectangles, or to invert a window-space value for a local consumer. The mapping already includes density and ancestor scale, so apply it as is. Visible bounds report `None` when fully clipped or when a previously placed layout becomes unplaced; they do not account for occlusion by other content.

`on_layout_coordinates`, the global-position observers and transform observers require `tessera_ui::FocusModifierExt` in scope. The local-size, relative-space and visible-bounds methods are inherent `Modifier` methods.

See the [core API reference](https://tessera-ui.github.io/tessera/tessera_ui/) for the extension traits and [Testing](/guide/testing) for layout assertions. To paint rather than position content, continue with [Drawing and shaders](/guide/drawing).
