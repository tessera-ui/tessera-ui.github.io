---
title: Custom layout and coordinates
description: Write LayoutModifier and LayoutPolicy implementations, scale subtrees with scaled_box, and observe layout geometry.
---

# Custom layout and coordinates

When standard containers (`row`, `column`, `boxed`, `flow_row`, lazy lists) cannot express the sizing or placement you need, implement `LayoutModifier` to wrap a single continuation or `LayoutPolicy` to arrange multiple children.

## Node primitives: `layout` and `group`

Only two primitives emit nodes into the component tree:

- `layout(policy)` emits a layout node with a `LayoutPolicy`, optional `.draw(...)`, `.modifier(...)`, and `.child(...)`.
- `group()` attaches node-local modifiers (semantics, focus, input) to content without adding a layout boundary.

Each component or slot build context may emit **at most one** `layout()` or `group()` node (enforced by `cargo tessera check`), and its children belong inside `.child(...)`.

## Wrapping content with `LayoutModifier`

A `LayoutModifier` receives incoming constraints, measures its wrapped child, places it, and returns the wrapper's size:

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

Keep modifier structs private and expose them through clean extension traits.

## Arranging children with `LayoutPolicy`

Pass a `LayoutPolicy` (`Clone + PartialEq + 'static`) to `tessera_ui::layout::layout`:

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

Key layout contracts:

- **Measure vs. place**: every visible child must be both measured and placed; unplaced children stay hidden from drawing, input, semantics, and focus. Use `child.probe` or `child.probe_intrinsic` when you need tentative/intrinsic dimensions before final `child.measure`.
- **Cached placement**: keep size/constraint logic in `measure`, put placement-only state reads inside `MeasureScope::placement` (or `LayoutModifierInput::placement`), and implement `LayoutPolicy::place` so position-only changes skip re-measurement.
- **Dirty comparison**: override `measure_eq` / `placement_eq` only when separating draw-only fields from layout fields, and wrap policies that intentionally mutate interior caches during measurement in `StatefulLayoutPolicy(policy)`.

## Local coordinates and `scaled_box`

Native controls always measure and edit in local `Px`. To scale an interactive subtree uniformly (for example, fitting a specification card into a preview area), wrap a single child in `tessera_ui::scaled_box(scale)`:

```rust
use tessera_components::{column::column, text::text};
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

`scaled_box` composes a uniform `LocalToWindow` transform once across rendering, clipping, pointer hit testing, scroll deltas, IME anchors, and accessibility—keep component sizes canonical inside it without manually multiplying authoring values.

## Observing geometry

Pick the observer modifier that matches the coordinate space your consumer actually needs:

| Need | Modifier |
| --- | --- |
| Local unscaled size (`PxSize`) | `Modifier::on_layout_size_changed` |
| Bounds relative to an ancestor container (`FloatRect`) | `Modifier::layout_coordinate_space` on ancestor + `on_layout_rect_in_space` on descendant |
| Local size + `LocalToWindow` (`LayoutCoordinates`) | `FocusModifierExt::on_layout_coordinates` |
| Exact fractional window rect (`FloatRect`) | `FocusModifierExt::on_globally_positioned_precise` |
| Outward integer window rect (`PxRect`) | `FocusModifierExt::on_globally_positioned` |
| Window rect clipped by ancestors and viewport (`Option<FloatRect>`) | `Modifier::on_visible_window_bounds` |

Always treat observed geometry as output—for example, guard writes with `if measured.get() != Some(size)` and never feed a node's own observed size back into its own sizing constraints.
