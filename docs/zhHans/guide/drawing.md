---
title: 自定义绘制与着色器
description: 编写自定义 DrawCommand 与 ComputeCommand，通过 RenderModule 注册 WGSL 管线，并遵守模板裁剪与场景采样约定。
---

# 自定义绘制与着色器

当内置修饰符（`background`、`border`、`shadow`、`clip_shape`）、`Painter` 图片/SVG 或 `fluid_glass` 无法表达所需视觉效果时，可以编写自定义命令并配套 `wgpu` 着色器管线，通过 `RenderModule` 注册到渲染器。

## 在组件中记录绘制命令

在 `layout(Stack)` 节点上挂载 `DrawModifierNode`（或在自定义修饰符链中通过 `push_draw` 挂载）：

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

在 `content.draw(input)` 之前记录画在内容后面，之后记录画在内容前面。`apply_opacity` 必须正确乘到输出透明度上，祖先使用 `.alpha(...)` 时才不会失真。动态时间参数配合[动画](/zhHans/guide/animation)里的 `launch` + `with_frame_time` 驱动。

## 实现并注册渲染管线

为命令实现 `DrawablePipeline<C>`，并在 `RenderModule` 中注册（通过 `EntryPoint::module` 或 `EntryRegistry::add_module` 安装）：

```rust
use tessera_ui::render::{
    DrawContext, DrawGeometry, DrawablePipeline, PipelineContext, RenderModule, ui_stencil_state,
};
use tessera_ui::{Px, PxRect, PxSize};

struct CanvasModule;

impl RenderModule for CanvasModule {
    fn register_pipelines(&self, context: &mut PipelineContext<'_>) {
        let resources = context.resources();
        // 构建 wgpu::RenderPipeline 时务必传入：
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

希望推迟到首次真正用到该命令的帧再创建管线时，使用 `context.register_draw_pipeline_factory(...)`。

UI 绘制管线必须配置 `depth_stencil: ui_stencil_state()`，否则祖先的 `clip_shape` 形状裁剪不会对它生效。

## 批次绘制、坐标变换与 Scissor 裁剪

在 `DrawablePipeline::draw` 中遍历 `context.commands`：

- **窗口矩形**：用 `geometry.window_origin()` 和 `geometry.window_size()` 定位目标矩形。
- **局部度量**：圆角、线宽等局部几何基于 `geometry.local_size` 计算，并仅应用一次 `geometry.local_to_window`（或逆变换）——不要把窗口尺寸再当成局部尺寸用。
- **逐帧 Uniform 分配**：使用 `context.graphics.frame_buffer(wgpu::BufferUsages::UNIFORM, bytes)` 为同一批次的每次绘制分配独立对齐范围，不要在同一帧里反复覆写同一个 buffer。
- **Scissor 矩形**：取向外取整的 `geometry.window_bounds()`、`context.clip_rect` 与 `context.target_size` 的交集：

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

若 `draw_region()` 超出了默认零留白范围（例如外发光或阴影），用 `geometry.padded_window_bounds(...)` 计算绘制范围。

## 场景采样与计算通道

需要读取后方已绘制像素的效果（模糊、折射、玻璃）：

- 覆盖 `DrawCommand::sample_region()` 返回 `Some(SampleRegion::PaddedLocal(...))`（有界效果首选）、`SampleRegion::Absolute(...)` 或 `SampleRegion::Global`。`SampleRegion` 描述**输入**范围，与输出 `DrawRegion` 和裁剪彼此独立。
- 从 `context.scene_texture_view` 采样时，以 `context.scene_rect` 作为有效像素在窗口中的起点，并按纹理实际大小归一化 UV（租用的纹理尺寸可能大于 `scene_rect`）。

若效果更适合用计算着色器实现，实现 `ComputeCommand`（`barrier() -> SampleRegion`）与 `ComputablePipeline<C>`，通过 `register_compute_pipeline` 注册并在绘制阶段调用 `fragment_mut().push_compute_command(...)`。计算通道的输出初始为输入的副本（非 sRGB 存储格式），在着色器中需将写入限制在每项的 `target_area` 内。

## 开启局部重绘

`DrawCommand::supports_partial_redraw()` 默认返回 `false`。只有确认每次视觉变化都会使命令或几何失效、且 `draw_region()` 完整覆盖所有可能修改的像素时，才覆写为 `true`（依赖延迟上传或外部独立变更纹理的命令保持 `false`）。

完整可运行的射线步进示例见 Tessera 仓库中的 `example/src/pages/custom_shader.rs`。
