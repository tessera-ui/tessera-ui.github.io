---
title: Custom drawing and shaders
description: Record custom DrawCommand and ComputeCommand payloads, register WGSL pipelines via RenderModule, and honor stencil clipping and sampling bounds.
---

# Custom drawing and shaders

When built-in modifiers (`background`, `border`, `shadow`, `clip_shape`), `Painter` images/SVGs, and `fluid_glass` do not cover a visual effect, write a typed command paired with a `wgpu` pipeline and register it via `RenderModule`.

## Recording a draw command from a component

Attach a `DrawModifierNode` to a `layout(Stack)` node (or inside a custom modifier chain via `push_draw`):

```rust
use tessera_foundation::modifier::ModifierExt as _;
use tessera_ui::{
    Dp, Modifier,
    layout::{Stack, layout},
    render::{DrawCommand, DrawModifierContent, DrawModifierContext, DrawModifierNode},
    tessera,
};

#[derive(Clone, Copy, Debug, PartialEq)]
struct CanvasCommand {
    time_seconds: f32,
    opacity: f32,
}

impl DrawCommand for CanvasCommand {
    fn apply_opacity(&mut self, opacity: f32) {
        self.opacity *= opacity.clamp(0.0, 1.0);
    }
}

impl DrawModifierNode for CanvasCommand {
    fn draw(
        &self,
        ctx: &mut DrawModifierContext<'_, '_>,
        content: &mut dyn DrawModifierContent,
    ) {
        let input = &mut *ctx.render_input;
        input.metadata_mut().fragment_mut().push_draw_command(*self);
        content.draw(input);
    }
}

#[tessera]
fn shader_canvas(time_seconds: f32) {
    layout(Stack)
        .modifier(Modifier::new().size(Dp(560.0), Dp(320.0)))
        .draw(CanvasCommand {
            time_seconds,
            opacity: 1.0,
        });
}
```

Record before `content.draw(input)` to paint behind wrapped content, or afterward to paint over it. Always multiply output alpha in `apply_opacity` so ancestor `.alpha(...)` fades your custom draw consistently. Drive `time_seconds` with `launch` and `with_frame_time` as shown in [Animation](/guide/animation).

## Implementing and registering the pipeline

Implement `DrawablePipeline<C>` and register it inside a `RenderModule` (installed via `EntryPoint::module` or `EntryRegistry::add_module`):

```rust
use tessera_ui::render::{
    DrawContext, DrawGeometry, DrawablePipeline, PipelineContext, RenderModule, ui_stencil_state,
};
use tessera_ui::{Px, PxRect, PxSize};

struct CanvasModule;

impl RenderModule for CanvasModule {
    fn register_pipelines(&self, context: &mut PipelineContext<'_>) {
        let resources = context.resources();
        // Construct your wgpu::RenderPipeline using:
        // - format: resources.surface_config.format
        // - multisample.count: resources.sample_count
        // - depth_stencil: ui_stencil_state()
        // - cache: resources.pipeline_cache
        let pipeline = CanvasPipeline::new(
            resources.device,
            resources.surface_config,
            resources.pipeline_cache,
            resources.sample_count,
        );
        context.register_draw_pipeline(pipeline);
    }
}
```

Use `context.register_draw_pipeline_factory(...)` when you want pipeline creation deferred until the first frame that actually uses that command type.

Always set `depth_stencil: ui_stencil_state()` on UI draw pipelines so Tessera's shape-mask clipping (`clip_shape`) applies to your output.

## Drawing batches, transforms, and scissors

In `DrawablePipeline::draw`, bind your pipeline and draw each item using `DrawGeometry` and `clip_rect`:

- **Window placement**: use `geometry.window_origin()` and `geometry.window_size()` for the target quad.
- **Local metrics**: keep radii, stroke widths, and fragment-space distances in `geometry.local_size` and apply `geometry.local_to_window` (or its inverse scale) once—never treat `window_size()` as a local layout dimension.
- **Per-frame uniforms**: allocate distinct aligned uniform ranges per draw via `context.graphics.frame_buffer(wgpu::BufferUsages::UNIFORM, bytes)` and reuse bind groups via `GraphicsDevice` rather than overwriting one shared buffer repeatedly in a batch.
- **Scissor clipping**: intersect the outward-rounded `geometry.window_bounds()`, `context.clip_rect`, and `context.target_size`:

```rust
fn resolve_scissor_rect(
    geometry: DrawGeometry,
    clip_rect: Option<PxRect>,
    target_size: PxSize,
) -> Option<(u32, u32, u32, u32)> {
    let viewport = PxRect::new(Px::ZERO, Px::ZERO, target_size.width, target_size.height);
    let base = geometry.window_bounds().outward();
    let clipped = match clip_rect {
        Some(clip) => base.intersection(&clip)?,
        None => base,
    }
    .intersection(&viewport)?;
    if clipped.width.raw() <= 0 || clipped.height.raw() <= 0 {
        return None;
    }
    Some((
        clipped.x.positive(),
        clipped.y.positive(),
        clipped.width.positive(),
        clipped.height.positive(),
    ))
}
```

If `draw_region()` extends beyond `DrawRegion::PaddedLocal(PaddingRect::ZERO)` (such as an outer glow or shadow), include that padding (`geometry.padded_window_bounds(...)`) when resolving the scissor.

## Scene sampling and compute passes

For effects that read pixels already drawn behind the node (blur, distortion, glass):

- Override `DrawCommand::sample_region()` to return `Some(SampleRegion::PaddedLocal(...))` (preferred for bounded filters), `SampleRegion::Absolute(...)`, or `SampleRegion::Global`. `SampleRegion` declares **input** bounds independently of `DrawRegion` (**output**) and clipping.
- Sample from `context.scene_texture_view` using `context.scene_rect` as the window-space origin of valid texels, and normalize against the actual texture dimensions (the leased texture may be larger than `scene_rect`).

For GPU compute effects, implement `ComputeCommand` (`barrier() -> SampleRegion`) and `ComputablePipeline<C>` (`dispatch(&mut ComputeContext<C>)`), register with `register_compute_pipeline`, and push commands via `fragment_mut().push_compute_command(...)`. Remember that compute outputs start as a copy of the input in a non-sRGB storage format—clamp shader writes to each item's `target_area`.

## Partial redraw opt-in

`DrawCommand::supports_partial_redraw()` defaults to `false`. Override it to return `true` only if every visual change invalidates the command or its geometry and `draw_region()` bounds every affected pixel (leave it `false` if external or deferred-upload textures can change independently).

See the complete working raymarching example in the Tessera repository under `example/src/pages/custom_shader.rs`.
