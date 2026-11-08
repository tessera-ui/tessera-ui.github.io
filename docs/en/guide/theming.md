---
title: Material 3 theming
description: Give your app one Material 3 color scheme, type scale and shape set, and use them in your own components.
---

# Material 3 theming

The standard components follow Material 3 Expressive, and they all take their colors, type and shapes from one theme. When you set that theme once at the root and use its roles in your own components too, your custom UI matches the built-in controls and switches between light and dark along with them.

`material_theme()` provides the theme to a subtree. Put it around the application UI:

```rust
use tessera_components::{
    column::column, modifier::ModifierExt as _, text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_ui::{Color, Dp, Modifier, tessera, use_context};

#[tessera]
fn app() {
    material_theme()
        .theme(|| MaterialTheme::from_seed(Color::from_rgb(0.4, 0.3, 0.6), false))
        .child(|| themed_panel());
}
```

This is an application root component; a complete app also needs an entry point. Register `ComponentsPackage` with the application's `EntryPoint` to install the component rendering and platform dependencies; see [Entry point and windows](/guide/app). The `themed_panel` it renders appears under [Use color roles](#use-color-roles).

## Choose a color scheme

`MaterialTheme` holds three things: `color_scheme`, `typography` and `shapes`. Most apps start from a seed color. `MaterialTheme::from_seed(seed, is_dark)` derives a full light or dark scheme from a linear sRGB `Color` and keeps the default typography and shapes; pass `true` as the second argument for the dark scheme.

If you need more control, build a `MaterialColorScheme` yourself (`MaterialColorScheme::light_from_seed` and `dark_from_seed` are starting points) and pass it to `MaterialTheme::from_color_scheme(scheme)`. Because `MaterialTheme` is a plain struct, you can also replace its `typography` or `shapes` fields directly.

Without a `theme` setter, `material_theme()` provides `MaterialTheme::default()`: a light scheme from the Material baseline seed `#6750A4`.

## Support a dark theme

The theme does not follow the operating system's dark mode on its own. Your app decides which appearance to use, and the theme producer reads that decision:

```rust
use tessera_components::button::button;
use tessera_ui::remember;

#[tessera]
fn appearance_picker() {
    let dark = remember(|| false);
    material_theme()
        .theme(move || {
            MaterialTheme::from_seed(Color::from_rgb(0.4, 0.3, 0.6), dark.get())
        })
        .child(move || {
            button()
                .on_click(move || dark.with_mut(|value| *value = !*value))
                .child(|| text("Change appearance"));
        });
}
```

The producer runs during rebuild and reads current state, and descendants that consume the theme update when its value changes. Keep the state read inside the producer, as above, so the theme keeps reacting; a value read once outside the producer is a snapshot that stays fixed. [State](/guide/state) explains why.

A nested `material_theme()` overrides the theme for its descendants only, which is useful for something like a preview in a different scheme. Its siblings keep the outer theme, and the nested theme paints no background of its own.

## Use color roles

Inside a component, read the nearest theme with `use_context::<MaterialTheme>()`. This is the `themed_panel` from the first example:

```rust
#[tessera]
fn themed_panel() {
    let theme = use_context::<MaterialTheme>()
        .expect("themed_panel requires material_theme")
        .get();
    let scheme = &theme.color_scheme;

    column()
        .modifier(
            Modifier::new()
                .background_with_shape(scheme.surface_container, theme.shapes.medium)
                .padding_all(Dp(16.0)),
        )
        .children(move || {
            text("Documents")
                .style(theme.typography.title_medium)
                .color(theme.color_scheme.on_surface);
        });
}
```

Color roles come in pairs: a fill and the content color designed to sit on it. Using the pair is what keeps text readable in both light and dark schemes.

| Purpose | Fill | Content |
| --- | --- | --- |
| Prominent action | `primary` | `on_primary` |
| Accented container | `primary_container` | `on_primary_container` |
| General surface | `surface` or `surface_container` | `on_surface` |
| Error state | `error_container` | `on_error_container` |
| Inverse surface | `inverse_surface` | `inverse_on_surface` |

Use `outline` or `outline_variant` for strokes, and `on_surface_variant` for less prominent content on a surface. `content_color_for(background, &scheme)` returns the matching content color for a recognized scheme fill, or `None` for an unrelated color; it is not a general contrast calculator.

Text and icons inherit `ContentColor` from their parent, and bare text falls back to `on_surface` when nothing else is set. A `background` modifier does not provide a content color, though. A `surface()` does: for a fill that belongs to the scheme it passes the matching content role down to its children, so the text here is drawn in `on_primary_container` automatically:

```rust
use tessera_components::surface::{SurfaceStyle, surface};

#[tessera]
fn backup_banner() {
    let scheme = use_context::<MaterialTheme>()
        .expect("backup_banner requires material_theme")
        .get()
        .color_scheme;
    surface()
        .style(SurfaceStyle::Filled {
            color: scheme.primary_container,
        })
        .child(|| {
            text("Backup complete").modifier(Modifier::new().padding_all(Dp(16.0)));
        });
}
```

For a fill the scheme does not recognize, `surface` keeps the inherited content color; set `content_color` on it explicitly in that case.

## Typography

The theme's `typography` is a `MaterialTypography` scale with display, headline, title, body and label roles in three sizes. Components pick their own roles from it, so changing a role in the theme changes every component that uses it. [Text and text input](/guide/text) shows how to apply roles and override a single style.

## Shapes

`MaterialShapes` provides shared corner roles: `extra_small`, `small`, `medium`, `large`, `large_increased` and `extra_large`. Reuse one `Shape` for a surface's fill, outline, shadow and clipping so their edges agree. A shaped background only draws that shape; to keep overflowing children inside it, add `clip_shape`.

The following fragment runs inside a component after reading its `theme` context:

```rust
use tessera_components::modifier::ShadowArgs;

let shape = theme.shapes.large;
let panel = Modifier::new()
    .shadow(
        &theme.color_scheme,
        &ShadowArgs { elevation: Dp(3.0), shape, ..Default::default() },
    )
    .background_with_shape(theme.color_scheme.surface_container, shape)
    .border_with_shape(Dp(1.0), theme.color_scheme.outline_variant, shape)
    .clip_shape(shape)
    .padding_all(Dp(16.0));
```

Pass `panel` to a container's `modifier` setter. The explicit `clip_shape` keeps descendants inside the shared shape, and placing the shadow outside that clip lets it extend beyond the surface. Clipping changes drawing and hit-test boundaries; measurement stays the same. Why the order of these calls matters is covered in [Modifiers](/guide/modifiers).

## Material 3 Expressive components

The component library covers actions, selection, editing, navigation and feedback, plus layout containers and controllers for composing them into screens. All of them read the shared theme for color, typography, shape and interaction defaults.

Start from a standard component when its behavior matches the task, then override what it exposes. As a rule of thumb, use a theme override for a subtree-wide policy, a component setter for one component, and a modifier for node-local layout or drawing. For selected, disabled or focus behavior, use the control's own states; a background modifier only paints.

The [component API reference](https://tessera-ui.github.io/tessera/tessera_components/) documents each component's parameters and defaults, and the [running gallery](https://tessera-ui.github.io/tessera/example/) shows how they look and behave. This guide describes patterns, and the reference covers each control in detail.

## Glass materials

`fluid_glass()` samples the scene behind it and draws a tinted, refractive surface. It is a backdrop material whose look depends on what lies behind it, so place it over content that gives it something to show and check foreground contrast over both light and dark regions.

```rust
use tessera_components::fluid_glass::{GlassMaterial, fluid_glass};

#[tessera]
fn glass_label() {
    fluid_glass()
        .material(GlassMaterial::Regular)
        .padding(Dp(16.0))
        .child(|| text("Content on glass"));
}
```

Like the other components, it belongs below the application's theme. `GlassMaterial::Regular` gives a frosted treatment; `Clear` preserves more of the backdrop's color and contrast; `Custom` supplies a refractive lens without default blur or tone adjustment. `appearance` can override the theme's light or dark treatment, and `blur_radius` overrides the material's blur, where zero disables backdrop blur.

The [glass material reference](https://tessera-ui.github.io/tessera/tessera_components/fluid_glass/index.html) covers shape, tint, optics and input configuration, and the [gallery](https://tessera-ui.github.io/tessera/example/) includes glass examples. Custom scene-sampling effects must declare their sampling bounds; that contract is covered in [Drawing and shaders](/guide/drawing).
