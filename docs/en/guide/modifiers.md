---
title: Modifiers
description: Chain layout, drawing, interaction, focus, and semantics modifiers in the right order.
---

# Modifiers

A `Modifier` decorates or changes how a UI node behaves—its size, padding, background, clipping, click handling, focus, or accessibility metadata—without inventing wrapper components for every combination. Start a chain with `Modifier::new()`, append methods in order, and pass the result to `.modifier(...)`.

Here is a rounded status badge styled with one modifier chain:

```rust
use tessera_components::{md3::{text::text, theme::MaterialTheme}, modifier::ModifierExt as _};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, tessera, use_context};

#[tessera]
fn status_badge() {
    let theme = use_context::<MaterialTheme>()
        .expect("status_badge requires material_theme")
        .get();
    let scheme = &theme.color_scheme;

    text("Synced").color(scheme.on_secondary_container).modifier(
        Modifier::new()
            .background_with_shape(scheme.secondary_container, theme.shapes.small)
            .padding_symmetric(Dp(12.0), Dp(4.0)),
    );
}
```

## Where modifier methods come from

`Modifier` itself lives in `tessera_ui` (along with geometry observers such as `on_layout_size_changed`), while chainable extension methods are split into focused traits by responsibility:

| Trait | Methods it provides |
| --- | --- |
| `tessera_foundation::modifier::ModifierExt` | Sizing (`size`, `width`, `height`, `fill_max_*`, `required_*`, `size_in`, `constrain`), `padding*`, `offset`, `alpha`, `clip_to_bounds`, `clip_shape`, `weight`, `align`, `window_insets_*`, `draggable`, `block_touch_propagation`, `window_drag_region`, `semantics`, `clear_and_set_semantics` |
| `tessera_components::modifier::ModifierExt` | Visual and stateful interaction modifiers: `background*`, `border*`, `clickable`, `toggleable`, `selectable` |
| `tessera_components::md3::modifier::ModifierExt` | Material scrolling and elevation shadows: `vertical_scroll`, `horizontal_scroll`, `scroll`, `shadow` |
| `tessera_ui::modifier::FocusModifierExt` | Focus registration and geometry observers: `focusable`, `focus_requester`, `focus_properties`, `preferred_tab_stop`, `focus_group`, `focus_scope`, `focus_restorer`, `focus_traversal_policy`, `on_focus_changed`, `on_globally_positioned*`, `on_layout_coordinates`, `on_local_to_window` |
| `tessera_ui::modifier::CursorModifierExt` | `hover_cursor_icon` |

Import only the traits you call using `as _` (for example, `use tessera_foundation::modifier::ModifierExt as _;`). `cargo tessera check` warns (`tessera::named_modifier_ext_import`) if a private import binds a trait name that is never mentioned by name.

## Order matters

Each call in a `Modifier` chain wraps everything after it, working **outside in**: the first modifier receives the parent's incoming constraints, and the last modifier sits closest to the component's content. Swapping two calls changes what gets measured, painted, or clicked.

Compare these two size-and-padding chains:

```rust
let outside = Modifier::new()
    .padding_all(Dp(12.0))
    .size(Dp(120.0), Dp(48.0));

let inside = Modifier::new()
    .size(Dp(120.0), Dp(48.0))
    .padding_all(Dp(12.0));
```

When space allows, `outside` pads 12 dp around a 120 × 48 dp inner box (total size 144 × 72 dp). `inside` fixes the outer box at 120 × 48 dp first and subtracts 12 dp on each side, leaving 96 × 24 dp for the inner content. Chained size constraints follow the same rule: an outer exact size limits any inner size requests.

Visual and hit-testing modifiers also use the bounds at their position in the chain:

```rust
let padded_surface = Modifier::new()
    .background(Color::WHITE)
    .padding_all(Dp(12.0));

let content_surface = Modifier::new()
    .padding_all(Dp(12.0))
    .background(Color::WHITE);
```

`padded_surface` paints behind the padding too; `content_surface` leaves the outer 12 dp transparent and fills only behind the inner content. Placing `clickable` before `padding_all` makes the padding area clickable as well.

## Common modifier groups

### Sizing, padding, and offset

- `width`, `height`, `size`: request an exact size clamped to incoming parent constraints.
- `size_in(min_w, max_w, min_h, max_h)` / `constrain(...)` / `default_min_size(...)`: apply min/max intervals.
- `fill_max_width`, `fill_max_height`, `fill_max_size`: expand to the parent's finite maximum on that axis.
- `required_width`, `required_height`, `required_size`: ignore incoming parent constraints when content must overflow.
- `padding_all`, `padding_symmetric`, `padding(Padding::new(left, top, right, bottom))`: inset content inside the chain.
- `offset(x, y)`: shift placement without changing the measured footprint or neighboring nodes.

### Visuals and clipping

- `background` / `background_with_shape`: paint behind the wrapped subtree.
- `border` / `border_with_shape`: stroke above the wrapped subtree without taking layout space.
- `shadow(&scheme, &ShadowArgs { .. })`: draw Material elevation shadows.
- `clip_shape(shape)` / `clip_to_bounds()`: clip descendant drawing and pointer hit testing without affecting layout size. Note that `background_with_shape` only paints—add `clip_shape(shape)` with the same `Shape` when children must be clipped to those corners too.
- `alpha(value)`: multiplies subtree opacity. It does **not** create an offscreen compositing group (overlapping children blend individually), and transparent nodes still participate in layout, focus, and semantics.

### Interaction and semantics

- `clickable`, `toggleable`, `selectable`, and `draggable` connect pointer, keyboard activation, ripples, and accessibility metadata; see [Gestures, input, and focus](/guide/interaction).
- `semantics` and `clear_and_set_semantics` attach or replace accessibility metadata; see [Semantics and accessibility](/guide/accessibility).

## Reusing and composing modifiers

`Modifier` is a regular `Clone` value that allocates node state only when attached to a node during build. You can store a modifier chain in a variable, clone it, extend it, or append another chain with `.then(other)`.

When writing reusable components, accept an `Option<Modifier>` parameter and start your root modifier chain from `modifier.unwrap_or_default()`:

```rust
use tessera_components::{md3::{text::text, theme::MaterialTheme}, modifier::ModifierExt as _, row::row};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, tessera, use_context};

#[tessera]
fn tag(#[prop(into)] label: String, modifier: Option<Modifier>) {
    let theme = use_context::<MaterialTheme>()
        .expect("tag requires material_theme")
        .get();
    text(label).modifier(
        modifier
            .unwrap_or_default()
            .background_with_shape(theme.color_scheme.surface_container, theme.shapes.small)
            .padding_symmetric(Dp(8.0), Dp(4.0)),
    );
}

#[tessera]
fn tag_row() {
    let spaced = Modifier::new().padding_all(Dp(4.0));
    row().children(move || {
        tag("Rust").modifier(spaced.clone());
        tag("Archived").modifier(spaced.clone().alpha(0.6));
    });
}
```

Putting the caller's `modifier` first ensures caller spacing and sizing sit *outside* the tag's own background and padding.

## Writing your own modifier helpers

If the same combination of modifiers keeps showing up, package it in an extension trait on `Modifier`:

```rust
use tessera_components::{md3::theme::MaterialTheme, modifier::ModifierExt as _};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, tessera, use_context};

trait CardModifierExt {
    fn card_surface(self, theme: &MaterialTheme) -> Modifier;
}

impl CardModifierExt for Modifier {
    fn card_surface(self, theme: &MaterialTheme) -> Modifier {
        let shape = theme.shapes.medium;
        self.background_with_shape(theme.color_scheme.surface_container, shape)
            .clip_shape(shape)
            .padding_all(Dp(16.0))
    }
}

#[tessera]
fn card_title() {
    let theme = use_context::<MaterialTheme>()
        .expect("card_title requires material_theme")
        .get();
    text("Documents").modifier(Modifier::new().fill_max_width().card_surface(&theme));
}
```

For capabilities that cannot be expressed from existing modifiers, implement node traits such as `LayoutModifier` or `DrawModifierNode` and attach them inside an extension method via `tessera_ui::modifier::ModifierCapabilityExt`. See [Custom layout and coordinates](/guide/custom-layout) and [Custom drawing and shaders](/guide/drawing).

## Next steps

Read [Material 3 theming](/guide/theming) to see where `color_scheme`, `typography`, and `shapes` come from and how `surface()` interacts with content colors.
