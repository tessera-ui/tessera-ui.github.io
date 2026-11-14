---
title: Material 3 theming
description: Provide Material 3 colors, typography, and shapes across your app, support light/dark mode, and style glass surfaces.
---

# Material 3 theming

Standard controls in `tessera-components` follow Material 3 Expressive: colors, typography, shapes, and state-layer alphas all read from one shared `MaterialTheme`. Setting the theme at your app root and reusing its roles in your own components keeps custom UI visually consistent across light and dark mode.

Place `material_theme()` at the root of your UI tree:

```rust
use tessera_components::{
    column::column,
    md3::{
        text::text,
        theme::{MaterialTheme, material_theme},
    },
    modifier::ModifierExt as _,
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Color, Dp, Modifier, tessera, use_context};

#[tessera]
fn app() {
    material_theme()
        .theme(|| MaterialTheme::from_seed(Color::from_rgb(0.4, 0.3, 0.6), false))
        .child(|| themed_panel());
}
```

Remember to register `ComponentsPackage` on your `EntryPoint` as well: the package installs rendering pipelines and platform services, while `material_theme()` supplies design tokens through context.

## Choosing a color scheme

`MaterialTheme` bundles three pieces: `color_scheme`, `typography`, and `shapes`.

The quickest way to build a palette is `MaterialTheme::from_seed(seed, is_dark)`, which derives a complete light or dark `MaterialColorScheme` from a linear sRGB `Color` while keeping default typography and shapes. When `.theme(...)` is omitted, `material_theme()` uses `MaterialTheme::default()` (the baseline Material seed `#6750A4` in light mode).

For custom schemes or type overrides, construct a `MaterialColorScheme` directly (starting from `MaterialColorScheme::light_from_seed` or `dark_from_seed`), build a `MaterialTheme::from_color_scheme(scheme)`, and adjust `.typography` or `.shapes` as needed.

## Light and dark mode

Tessera does not switch themes behind your back based on OS settings. Store the appearance choice in state and read that state *inside* `.theme(...)`:

```rust
use tessera_components::md3::{
    button::button,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_ui::{Color, remember, tessera};

#[tessera]
fn appearance_picker() {
    let dark = remember(|| false);
    material_theme()
        .theme(move || MaterialTheme::from_seed(Color::from_rgb(0.4, 0.3, 0.6), dark.get()))
        .child(move || {
            button()
                .on_click(move || dark.with_mut(|value| *value = !*value))
                .child(|| text("Change appearance"));
        });
}
```

Because `.theme(...)` runs during `material_theme`'s build, reading `dark.get()` inside that closure ensures `material_theme` re-runs and publishes the updated `MaterialTheme` to every reading descendant. Nested `material_theme()` calls override only their own subtree—useful for previewing another palette side by side.

## Using color roles and `ContentColor`

Read the active theme in any descendant with `use_context::<MaterialTheme>()`:

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

Material colors come in surface/content pairs so contrast holds in both light and dark modes:

| Role | Fill | Content |
| --- | --- | --- |
| Primary action | `primary` | `on_primary` |
| Emphasized container | `primary_container` | `on_primary_container` |
| Standard surface | `surface` / `surface_container` | `on_surface` |
| Error state | `error_container` | `on_error_container` |
| Inverse surface | `inverse_surface` | `inverse_on_surface` |

Use `outline` / `outline_variant` for borders and `on_surface_variant` for secondary labels.

`text` and `icon` inherit `ContentColor` from context (falling back to `on_surface`). Note the difference between a plain background modifier and `surface()`: `Modifier::background` only paints pixels, whereas `surface()` looks up `content_color_for(fill, &scheme)` and automatically provides the matching `ContentColor` to its children:

```rust
use tessera_components::md3::{
    surface::{SurfaceStyle, surface},
    text::text,
    theme::MaterialTheme,
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, tessera, use_context};

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

If you pass a custom non-scheme color to `surface()`, pass `.content_color(...)` explicitly as well.

## Typography and shared shapes

`theme.typography` provides the five standard Material roles (`display`, `headline`, `title`, `body`, `label`) in `large`, `medium`, and `small` variants, plus `.emphasized()` for emphasized variants. See [Text and text input](/guide/text) for applying and customizing `TextStyle`.

`theme.shapes` provides rounded corner tokens (`extra_small`, `small`, `medium`, `large`, `large_increased`, `extra_large`). Whenever a container combines shadow, fill, border, and clipping, share the same `Shape` across all four so corners line up cleanly:

```rust
use tessera_components::{
    md3::{
        modifier::{ModifierExt as _, ShadowArgs},
        theme::MaterialTheme,
    },
    modifier::ModifierExt as _,
};
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier};

fn panel_modifier(theme: &MaterialTheme) -> Modifier {
    let shape = theme.shapes.large;
    Modifier::new()
        .shadow(
            &theme.color_scheme,
            &ShadowArgs {
                elevation: Dp(3.0),
                shape,
                ..Default::default()
            },
        )
        .background_with_shape(theme.color_scheme.surface_container, shape)
        .border_with_shape(Dp(1.0), theme.color_scheme.outline_variant, shape)
        .clip_shape(shape)
        .padding_all(Dp(16.0))
}
```

Notice `shadow(...)` stays *outside* `clip_shape(shape)` so the shadow can spread beyond the rounded edge while children inside are clipped to it.

## Glass surfaces (`experiment::hig::glass`)

`glass()` in `tessera_components::experiment::hig::glass` samples the scene rendered behind it to draw a tinted, blurred, refractive surface:

```rust
use tessera_components::{
    experiment::hig::glass::{GlassMaterial, glass},
    md3::text::text,
};
use tessera_ui::{Dp, tessera};

#[tessera]
fn glass_label() {
    glass()
        .material(GlassMaterial::Regular)
        .padding(Dp(16.0))
        .child(|| text("Content on glass"));
}
```

- `GlassMaterial::Regular`: frosted look with stronger foreground separation.
- `GlassMaterial::Clear`: more transparent, keeping backdrop color and contrast.
- `GlassMaterial::Custom`: refractive lens without default blur or tint adjustments.

You can override `appearance` (`GlassAppearance::Light` by default, or `Dark`) or `blur_radius` (`Dp(0.0)` disables backdrop blur). Because backdrop sampling copies behind-the-glass pixels, place `glass` where something visual sits behind it and check text contrast across light and dark backdrops.

## Next steps

See [Lists, grids, and scrolling](/guide/lists) for displaying large collections, or browse the [component API reference](https://tessera-ui.github.io/tessera/tessera_components/) and [live WebGPU gallery](https://tessera-ui.github.io/tessera/example/) for every control in the library.
