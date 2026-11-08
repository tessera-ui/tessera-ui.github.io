---
title: 绘制与着色器
description: 记录自定义绘制命令，用 WGSL 管线渲染，并处理裁剪、场景采样和计算通道。
---

# 绘制与着色器

需要内置组件和修饰符之外的视觉效果时，可以用 WGSL 着色器自己绘制。自定义绘制分两部分：一个带类型的命令，描述要画什么；一条你注册的 GPU 管线，负责把它画出来。组件在绘制阶段记录命令，渲染器再把命令分批交给你的管线。

## 写管线之前

大多数视觉效果来自现有的修饰符和组件。填充、描边、阴影和形状裁剪来自 `background`、`border`、`shadow`、`clip_shape` 和 `clip_to_bounds` 修饰符，它们的用法和顺序见[修饰符](/zhHans/guide/modifiers)。位图、SVG 和图标交给接收 `.painter(...)` 的图片和图标组件，见[资源](/zhHans/guide/assets)。各种 Material 表面，包括玻璃材质，属于 [Material 3 主题](/zhHans/guide/theming)的内容。

超出这些范围的效果，就写一条管线：比如程序生成的填充、图表渲染器，或者要读取背后场景的模糊、扭曲效果。

## 在组件中绘制

组件这一侧的代码很少。下面沿用自定义着色器示例中的 `layout().draw(...)` 写法，给一个固定尺寸的布局节点挂上绘制策略：

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

布局原语用来实现这类自定义渲染组件，排布应用界面则继续使用普通的应用容器。

下文把 [Rust 自定义着色器示例](https://github.com/tessera-ui/tessera/blob/main/example/src/pages/custom_shader.rs)及其 [WGSL](https://github.com/tessera-ui/tessera/blob/main/example/src/pages/custom_shader_raymarch.wgsl)简化成一个动态填色；完整示例还包含相机 uniform 和光线追踪。这些片段展示的是你的代码在哪里接入 Tessera，**不是可以直接复制运行的完整管线**。凡是省略了管线创建或 GPU 资源绑定的地方，下文都会明确说明。

时间作为普通的组件状态传给着色器。动画进行期间，用[帧时钟](/zhHans/guide/animation)驱动这个值：帧时钟负责安排新帧，uniform 负责把每次的新值带给着色器。

## 记录绘制命令

这里需要两个 trait：`DrawCommand` 描述管线收到的数据，`DrawModifierNode` 是负责记录这些数据的策略。简单的命令类型可以同时实现二者：

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

这里的顺序有讲究：在 `content.draw(input)` 之前记录命令，画在被包裹内容的后面；之后记录，则画在内容上面。绘制策略拿到的是它在修饰符链中所处位置的边界。

`apply_opacity` 必须作用到输出的 alpha 上，这样祖先淡出时，你画的内容也会跟着淡出。着色器的颜色表示要和管线的混合状态一致；本例使用非预乘颜色和 `wgpu::BlendState::ALPHA_BLENDING`。

## 编写 WGSL

示例在着色器里根据顶点索引生成六个顶点，无需顶点缓冲区。下面的精简版保留了从组件矩形到裁剪空间的映射，把光线追踪换成了移动的色彩场：

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

Rust 侧对应的 uniform 载荷是八个 `f32`：矩形原点和尺寸、时间、不透明度，以及渲染目标的宽高。Rust 缓冲区的布局必须符合 WGSL 的对齐规则。创建着色器模块时，可以用 `wgpu::ShaderSource::Wgsl(include_str!("canvas.wgsl").into())` 加载文件。

## 注册管线

你的管线实现 `DrawablePipeline<CanvasCommand>`，再由一个 `RenderModule` 注册。下面的片段是**省略版**：它假设应用已经定义了 `CanvasPipeline::new` 构造函数，构造函数里的 GPU 初始化代码没有写出：

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

要安装这个模块，在已有的 `EntryPoint` 上加 `.module(CanvasModule)`，或者在 `TesseraPackage` 里调用 `EntryRegistry::add_module`，见[应用入口与窗口](/zhHans/guide/app)。如果用的是标准组件，`ComponentsPackage` 也要继续注册。

创建 WGPU 渲染管线时，使用传入的表面格式和采样数。UI 管线还必须设置 `depth_stencil: tessera_ui::ui_stencil_state()`，让形状裁剪作用到它的输出上：形状裁剪用到的模板附件和参考值由渲染器提供，没有这个状态的管线会忽略形状裁剪。

## 绘制批次

渲染器调用 `DrawablePipeline::draw` 时传入 `DrawContext`，里面有当前的渲染通道、本批次的命令与几何信息、目标尺寸和裁剪矩形。通道的边界和提交都由渲染器负责。如果需要在此前后做准备或收尾，`begin_frame` 在各通道开始前准备资源，`end_frame` 在所有通道结束后、提交之前执行。

下面是**省略了实现细节的方法体**，不是完整的管线实现。绑定管线、分配和上传每条命令的 uniform，以及绑定对应缓冲区范围的代码都没有写出：

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

矩形 uniform 用 `geometry.window_origin()` 和 `geometry.window_size()` 填充。圆角半径、描边宽度这类局部量则不同：它们应基于 `geometry.local_size`，并且只应用一次 `geometry.local_to_window`。变换后的窗口尺寸已经包含了缩放，拿它当布局测量值用，缩放就会被算两次。

::: warning 注意
请给同一批次里的每次绘制分配各自的缓冲区范围或实例，让它们拥有独立、稳定的 uniform 数据。反复向同一段缓冲区写入队列，并不会为每次绘制留下快照，结果所有绘制看到的都是最后一次写入。缓冲区和绑定组只创建一次，在各帧和各条命令之间复用。
:::

## 裁剪到绘制区域

scissor 矩形必须取命令绘制区域、`context.clip_rect` 和目标边界三者的交集。小数边界先向外取整，再转换成整数 scissor 坐标，这样边缘像素才能完整留在 scissor 内。对于只绘制自身局部矩形的命令，示例使用了这个辅助函数：

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

如果你的 `draw_region()` 超出了局部边界，就应根据声明的输出区域计算 scissor。scissor 只能限定一个矩形，形状裁剪由渲染器的模板状态另行处理。相关的坐标空间见[自定义布局](/zhHans/guide/custom-layout)。

## 采样场景

模糊、扭曲这类效果需要读取已经画好的像素。为此要覆盖 `DrawCommand::sample_region()`，它默认返回 `None`。两种区域要分清：`SampleRegion` 声明**输入**范围，`DrawRegion` 声明**输出**范围。扩大采样范围时，布局和绘制范围保持原样。

| 区域 | 含义 |
| --- | --- |
| `SampleRegion::PaddedLocal(PaddingRect)` | 组件边界加上局部留白，必须覆盖滤镜或扭曲的完整采样范围。 |
| `SampleRegion::Absolute(PxRect)` | 明确的窗口坐标矩形。 |
| `SampleRegion::Global` | 整个场景，需要全屏复制。 |

捕获的场景通过 `DrawContext::scene_texture_view` 传入。它的第一个纹素对应 `scene_rect` 在窗口中的原点，它可能与窗口左上角不同；分配的纹理也可能比有效矩形大。采样时，先从窗口坐标中减去这个原点，再按纹理的实际尺寸归一化 UV，并且只读取有效的捕获像素。

采样范围和绘制裁剪相互独立：一个被裁剪的模糊效果，仍可能需要可见输出之外的像素。请声明完整的依赖范围，让纹理包含效果读取的每一个像素。有界区域能让复制量保持在较小范围，`Global` 留给确实需要整个场景的效果。

## 计算效果

如果场景处理更适合用计算着色器而不是绘制，就实现 `ComputeCommand::barrier() -> SampleRegion` 和 `ComputablePipeline::dispatch(&mut self, context: &mut ComputeContext<C>)`。在同一个渲染模块中用 `PipelineContext::register_compute_pipeline` 注册管线，再在绘制策略里通过 `input.metadata_mut().fragment_mut().push_compute_command(command)` 记录命令。

`ComputeContext` 提供 `input_view`、`output_view`、`compute_pass` 和带类型的 `items`。每一项都带有命令、几何信息，以及以通道纹理坐标表示的 `target_area`。通道纹理覆盖整个批次采样区域与输出区域的并集，并且可能相对窗口有偏移，所以要以提供的几何信息和目标区域为准。

输出一开始是输入的副本，使用非 sRGB 的存储格式。只在每一项的目标区域内 dispatch，在着色器中检查区域边缘，其余像素保持不变；下一个采样场景的绘制会读取计算结果。计算通道没有 UI 裁剪，它的写入范围只受你自己编写的检查约束。

## 局部重绘

`DrawCommand::supports_partial_redraw()` 默认返回 `false`。确认每一种视觉变化都会让命令的绘制片段或几何信息失效之后，再开启它。可变纹理、延迟上传以及外部的 GPU 修改，都可能让相同的命令数据画出不同的像素。

默认的 `draw_region()` 是零留白的局部边界。阴影这类会画到边界之外的效果，应声明更大的输出范围，让损伤追踪覆盖所有受影响的像素。无论绘制命令是否开启这个选项，场景采样和计算任务始终需要保守重绘。命令数据没变，也说明不了外部资源的情况，它们可能自行发生变化。

失效与重绘模型见[渲染阶段与性能](/zhHans/guide/rendering)，扩展 trait 见[核心图形 API](https://tessera-ui.github.io/tessera/tessera_ui/)。
