---
title: Drawing and shaders
description: Record your own draw commands and render them with WGSL pipelines, including clipping, scene sampling and compute passes.
---

# Drawing and shaders

When you need a visual beyond what the built-in components and modifiers produce, you can draw it yourself with a WGSL shader. Custom drawing has two halves: a typed command that describes what to draw, and a GPU pipeline you register that knows how to draw it. Components record commands during the draw phase, and the renderer hands them to your pipeline in batches.

## Before you write a pipeline

Most visuals come from existing modifiers and components. Fills, outlines, elevation shadows and shaped clips come from the `background`, `border`, `shadow`, `clip_shape` and `clip_to_bounds` modifiers, which [Modifiers](/guide/modifiers) covers together with their ordering. Raster images, SVGs and icons render through image and icon components that take a `.painter(...)`; see [Resources](/guide/assets). Material surfaces, including glass materials, are part of [Material 3 theming](/guide/theming).

Write a pipeline for visuals outside that set: a procedural fill, a chart renderer, a blur or distortion that reads the scene behind it.

## Draw from a component

The component side is small. This one follows the custom shader example's `layout().draw(...)` path, giving a fixed-size layout node a draw policy:

```rust
use tessera_components::modifier::ModifierExt as _;
use tessera_ui::{Dp, Modifier, layout::layout, tessera};

#[tessera]
fn shader_canvas(time_seconds: f32) {
    layout()
        .modifier(Modifier::new().size(Dp(560.0), Dp(320.0)))
        .draw(CanvasCommand { time_seconds, opacity: 1.0 });
}
```

Use the layout primitive to build custom rendering components like this one, and the normal application containers to arrange your UI.

The rest of this page adapts the [Rust custom shader example](https://github.com/tessera-ui/tessera/blob/main/example/src/pages/custom_shader.rs) and its [WGSL](https://github.com/tessera-ui/tessera/blob/main/example/src/pages/custom_shader_raymarch.wgsl) into a smaller animated fill; the full example also supplies camera uniforms and ray tracing. The snippets show where your code plugs into Tessera, and they are **not a complete, copy-and-run pipeline**. Wherever pipeline creation or GPU resource binding is left out, the text says so explicitly.

Time reaches the shader as ordinary component state. Drive the value from [the frame clock](/guide/animation) while the animation runs: the clock schedules the frames, and the uniform carries each new value to the shader.

## Record a draw command

You need two traits: `DrawCommand` for the data the pipeline receives, and `DrawModifierNode` for the policy that records that data. A small command type can implement both:

```rust
use tessera_ui::{DrawCommand, DrawModifierContent, DrawModifierContext, DrawModifierNode};

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
```

Order matters here. Recording before `content.draw(input)` paints behind the wrapped content, and recording afterward paints over it. The policy receives the bounds that apply at its position in the modifier chain.

`apply_opacity` has to reach the output alpha, so that your drawing fades along with its ancestors. Make the shader's color representation match the pipeline's blend state; this example uses straight (non-premultiplied) color with `wgpu::BlendState::ALPHA_BLENDING`.

## Write the WGSL

The example generates its six vertices in the shader from the vertex index, without a vertex buffer. The reduced shader below keeps its mapping from the component rectangle to clip space and swaps ray tracing for a moving color field:

```wgsl
struct Uniforms {
    rect: vec4<f32>,
    time: f32,
    opacity: f32,
    screen_size: vec2<f32>,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) coord: vec2<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) index: u32) -> VertexOutput {
    let vertices = array<vec2<f32>, 6>(
        vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0),
        vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 0.0),
        vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 1.0),
    );
    let local = vertices[index];
    let pixel_pos = uniforms.rect.xy + local * uniforms.rect.zw;
    let clip = vec2<f32>(
        pixel_pos.x / uniforms.screen_size.x * 2.0 - 1.0,
        pixel_pos.y / uniforms.screen_size.y * -2.0 + 1.0,
    );
    var out: VertexOutput;
    out.position = vec4<f32>(clip, 0.0, 1.0);
    out.coord = local;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let wave = 0.5 + 0.5 * sin(in.coord.x * 12.0 + uniforms.time);
    return vec4<f32>(0.2 * wave, 0.4 * wave, wave, uniforms.opacity);
}
```

On the Rust side, the matching uniform payload is eight `f32` values: rectangle origin and size, time, opacity, then render-target width and height. Keep your Rust buffer layout consistent with WGSL's alignment rules. When you create the shader module, load the file with `wgpu::ShaderSource::Wgsl(include_str!("canvas.wgsl").into())`.

## Register the pipeline

Your pipeline implements `DrawablePipeline<CanvasCommand>`, and a `RenderModule` registers it. The fragment below is **abbreviated**: it assumes your application defines a `CanvasPipeline::new` constructor, and that constructor's GPU setup is omitted:

```rust
use tessera_ui::{PipelineContext, RenderModule};

struct CanvasModule;

impl RenderModule for CanvasModule {
    fn register_pipelines(&self, context: &mut PipelineContext<'_>) {
        let resources = context.resources();
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

To install the module, add `.module(CanvasModule)` to your existing `EntryPoint`, or call `EntryRegistry::add_module` inside a `TesseraPackage`; see [Entry point and windows](/guide/app). If you use the standard component stack, keep `ComponentsPackage` registered as well.

Build the WGPU render pipeline with the surface format and sample count you're given. UI pipelines must also set `depth_stencil: tessera_ui::ui_stencil_state()` so that shape clips apply to their output: the renderer supplies the stencil attachment and reference value used for shape clips, and a pipeline without that state ignores shape clipping.

## Draw a batch

The renderer calls `DrawablePipeline::draw` with a `DrawContext` that holds the active render pass, the command/geometry pairs in the batch, the target size and the clip rectangle. The renderer owns pass boundaries and submission. If you need setup or teardown around them, `begin_frame` prepares resources before the passes, and `end_frame` runs after the passes and before submission.

The following is an **abbreviated method body**, not a complete pipeline implementation. It leaves out binding the pipeline, allocating and uploading per-command uniforms, and binding those ranges:

```rust
use tessera_ui::renderer::drawer::pipeline::{DrawContext, DrawablePipeline};

impl DrawablePipeline<CanvasCommand> for CanvasPipeline {
    fn draw(&mut self, context: &mut DrawContext<'_, '_, '_, CanvasCommand>) {
        for (_command, geometry) in context.commands {
            let Some((x, y, width, height)) =
                resolve_scissor_rect(*geometry, context.clip_rect, context.target_size)
            else {
                continue;
            };
            // Bind this command's pipeline and uniform range here.
            context.render_pass.set_scissor_rect(x, y, width, height);
            context.render_pass.draw(0..6, 0..1);
        }
    }
}
```

Fill the rectangle uniform from `geometry.window_origin()` and `geometry.window_size()`. Local quantities such as corner radii and stroke widths are different: keep them in terms of `geometry.local_size` and apply `geometry.local_to_window` exactly once. A transformed window size already includes that scale, so treating it as a layout measurement applies the scale twice.

::: warning
Give each draw in a batch its own buffer range or instance, so it keeps stable uniform data. Queue writes to a shared range are not snapshotted per draw, so every draw would see the last write. Create buffers and bind groups once and reuse them across frames and commands.
:::

## Clip to the drawing region

The scissor rectangle must be the intersection of the command's drawing region, `context.clip_rect` and the target bounds. Round fractional bounds outward before converting them to integer scissor coordinates, so edge pixels stay inside the scissor. For a command that draws only its local rectangle, the example uses this helper:

```rust
use tessera_ui::{DrawGeometry, Px, PxRect, PxSize};

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
    }.intersection(&viewport)?;
    if clipped.width.raw() <= 0 || clipped.height.raw() <= 0 {
        return None;
    }
    Some((clipped.x.positive(), clipped.y.positive(),
          clipped.width.positive(), clipped.height.positive()))
}
```

If your `draw_region()` extends beyond the local bounds, derive the scissor from that declared output. A scissor only bounds a rectangle; shape clips are enforced separately by the renderer's stencil state. [Custom layout](/guide/custom-layout) explains the coordinate spaces involved.

## Sample the scene

Effects such as blur or distortion read pixels that were already drawn. To get them, override `DrawCommand::sample_region()`, which returns `None` by default. Keep the two regions apart: `SampleRegion` declares **input** coverage, and `DrawRegion` declares **output** coverage. Expanding what you sample leaves layout and drawing coverage as they are.

| Region | Meaning |
| --- | --- |
| `SampleRegion::PaddedLocal(PaddingRect)` | The component bounds plus local padding. Include the full filter or distortion footprint. |
| `SampleRegion::Absolute(PxRect)` | An explicit window-space rectangle. |
| `SampleRegion::Global` | The entire scene; requires a full-screen copy. |

The captured scene arrives as `DrawContext::scene_texture_view`. Its first texel corresponds to the window-space origin of `scene_rect`, which can differ from the window origin, and the allocated texture can be larger than the valid rectangle. To sample it, subtract that origin from window coordinates, normalize UVs against the actual texture dimensions, and read only valid captured pixels.

Sampling bounds are independent of draw clips: a clipped blur can still need pixels outside its visible output. Declare the whole dependency, so the texture holds every pixel the effect reads. Bounded regions keep copies small, so save `Global` for effects that need the whole scene.

## Compute effects

For scene processing that fits a compute shader better than a draw, implement `ComputeCommand::barrier() -> SampleRegion` and `ComputablePipeline::dispatch(&mut self, context: &mut ComputeContext<C>)`. Register the pipeline with `PipelineContext::register_compute_pipeline` in the same render module, and record the command from a draw policy with `input.metadata_mut().fragment_mut().push_compute_command(command)`.

`ComputeContext` gives you `input_view`, `output_view`, `compute_pass` and the typed `items`. Each item carries its command, its geometry and a `target_area` in pass-texture coordinates. Pass textures cover the union of the batch's sampling and output regions and can be offset from the window, so work from the supplied geometry and target areas.

The output starts as a copy of the input and uses a non-sRGB storage format. Dispatch only over each item's target area, guard shader accesses at region edges, and leave the remaining pixels intact; the next scene-sampling draw reads the result. A compute pass has no UI clipping, so its writes are bounded only by the checks you write.

## Partial redraw

`DrawCommand::supports_partial_redraw()` defaults to `false`. Turn it on once every visual change invalidates the command's paint fragment or geometry. Mutable textures, deferred uploads and external GPU changes can all make identical command data produce different pixels.

By default, `draw_region()` is the local bounds with zero padding. Effects that paint outside their bounds, such as shadows, should declare the larger output so damage tracking covers every affected pixel. Scene sampling and compute work always need conservative redraw, whatever a draw command opts into. Unchanged command data says nothing about external resources, which can change on their own.

For the invalidation and redraw model, see [Rendering phases and performance](/guide/rendering), and for the extension traits, the [core graphics API](https://tessera-ui.github.io/tessera/tessera_ui/).
