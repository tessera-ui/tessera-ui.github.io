---
title: "Tessera UI v3.0.0: Rebuilt from the tile up"
date: 2026-11-18T14:16:00+08:00
author: shadow3
githubName: shadow3aaa
---

- [官网](https://tessera-ui.github.io)
- [GitHub](https://github.com/tessera-ui/tessera)
- [web demo](https://tessera-ui.github.io/tessera/example)

经过恰好一年的开发。Tessera v3.0.0 终于完成，这彻底地改变了框架本身。如今，它几乎是一个全新的框架，但是依然保有原有的设计理念。

先简单介绍一下，Tessera 是一个基于 Rust 和 wgpu 的响应式、**保留式** UI 框架。致力于探索在 Rust 中自然的、高性能的、可拓展的 UI 构建方式。

## 它曾经是什么

Tessera UI 曾经是一个基于 Rust 和 wgpu 的**即时模式** UI 框架。

在当时，我觉得 iced 的 Elm 模式对我来说有点繁琐：哪怕只是点一下按钮、改一个值，也要定义消息和处理逻辑。egui 则是另一个方向，仅需一个 `cx` 即可绘制，然而需要到处传递 context，并且对于复杂效果的支持不佳。我想要的组件组合方式更接近 Jetpack Compose：组件就是函数，布局可以一层一层组合，渲染也不必依赖框架预先提供绘图原语。

为了实现这个目标，我最开始定义了一个基于组件是状态的纯函数的组件系统。它看起来是这样的：

```rust
#[tessera]
#[shard] // 定义一个“碎片”，它会注入一个 `#[state]` 标记的状态
fn counter_app(#[state] state: AppState) {
    let count = state.click_count.load(Ordering::Relaxed);
    let ripple = state.button_state.clone();

    button(
        ButtonArgs::primary(Arc::new(move || {
            state.click_count.fetch_add(1, Ordering::Relaxed);
        })),
        ripple,
        move || text(format!("Count: {count}")),
    );
}
```

可以看到，这里有几个显著的问题，导致 Tessera v3.0.0 里放弃了它：

- 状态必须提升到顶部或者 `AppState` 中
- `Arc` 和原子类型乱飞，然而 UI 计算总是单线程的
- 繁琐的参数传递

下面我会介绍这些问题是如何在新版本中解决的。如果并不希望了解之前的 Tessera，或者只是希望查看新版本的 API，可以直接转为阅读[官网上的文档](https://tessera-ui.github.io/guide)。

## 状态膨胀和 Clone 地狱

假设一个点一下就变宽的方块，在一个面板里有两个这样的方块。用 2.5.0 的写法，代码大概长这样（省略了初始化、测量和命中测试的细节）：

```rust
struct AppState {
    panel: PanelState,
}

#[derive(Clone)]
struct PanelState {
    left: Arc<AtomicUsize>,
    right: Arc<AtomicUsize>,
}

#[tessera]
#[shard]
fn page(#[state] state: AppState) {
    panel(state.panel.clone());
}

#[tessera]
fn panel(state: PanelState) {
    let PanelState { left, right } = state;
    column(ColumnArgs::default(), |scope| {
        scope.child(move || growing_box(left));
        scope.child(move || growing_box(right));
    });
}

#[tessera]
fn growing_box(width: Arc<AtomicUsize>) {
    let layout_width = Arc::clone(&width);
    measure(Box::new(move |input| {
        measure_box(input, layout_width.load(Ordering::Relaxed))
    }));

    input_handler(Box::new(move |input| {
        if was_clicked(&input) {
            width.fetch_add(1, Ordering::Relaxed);
        }
    }));
}
```

页面根本不关心方块有多宽，却不得不在 `AppState` 里替它们持有宽度。面板也不关心宽度，但每多放一个方块，就得多一个字段，再想个名字。等状态终于传到真正用它的地方，测量要读、点击要写，还得 `clone` 一个 `Arc`，才能把同一个宽度交给两个闭包。**只是想在面板里多放一个方块，为什么还得回去改 `AppState`？**

因此，Tessera v3.0.0 引入了 `remember` 机制（当然，还有 `retain`）。使得状态变得局部化，响应式。并且运用了各种技巧等使得它高性能的同时避免了大部分 `clone`。

`remember` 机制的详细原理详见 [`tessera-ui` 和 `tessera-macros` 的源代码](https://github.com/tessera-ui/tessera/tree/main)。总而言之，它类似 Compose 的同名函数或者 React 的 `useState`，然而不需要使用观察类型或者遵循 [rules-of-hooks](https://react.dev/reference/rules/rules-of-hooks)，可以在控制流中直接使用。

同样的例子，不再有 `Arc`、状态提升和到处 `clone` 了。在 3.0.0 中一切都变得简单：

```rust
#[tessera]
fn panel() {
    column().children(|| {
        growing_box();
        growing_box();
    });
}

#[tessera]
fn growing_box() {
    let width = remember(|| 100.0_f32);

    boxed().modifier(
        Modifier::new()
            .size(Dp(width.get()), Dp(48.0))
            .background(Color::BLUE)
            .clickable(ClickableArgs {
                on_click: Callback::new(move || width.with_mut(|w| *w += 1.0)),
                ..Default::default()
            }),
    );
}
```

## 组件参数

UI 组件有个特点：配置化。比如写一段文字时，可能只想改字号，并不想管颜色、行高，或者它是不是单行。但是又不能忽略任意一个参数，因为虽然使用的时候往往知道仅需设置哪些参数，编写的时候却无从得知。

Rust 没有原生的具名参数和默认参数。过去，Tessera 希望保持参数如何构造的自由度，所以组件库自行使用了 `ArgBuilder` 模式。这虽然自由，但是并不好用且繁琐，所以在 3.0.0 中，Tessera 直接接管了组件参数的管理形式，提供了一种在 Rust 中最接近默认和具名参数的体验。

考虑一个简单的组件：

```rust
#[tessera]
fn text_wrapper(content: String, color: Option<Color>) {
    let label = text(format!("W{content}W"));
    if let Some(color) = color {
        label.color(color);
    }
}
```

在这里，如果没有用 `Option` 包裹，那么就表明这是必填参数，调用时必须提供。而用 `Option` 包裹的参数则是可选的，调用时可以忽略。

所以很自然的，将它 builder 化就应该使得必填参数是 builder 本身的构造参数，而可选参数则通过方法链设置。这与 Rust 的语法完全契合。

```rust
text_wrapper("Hello".into());
text_wrapper("Hello".into()).color(Color::BLUE);
```

你可能已经注意到 `text_wrapper` 调用 `text` 展示的一个有用的技巧：保存组件来进行后续的配置。这对于需要在多个控制流分支中对同一个组件进行配置的情况非常有用：

```rust
let wrapped = text_wrapper("Hello".into());
if need_blue {
    wrapped.color(Color::BLUE);
} else {
    wrapped.color(Color::RED);
}
// 等效于
if need_blue {
    text_wrapper("Hello".into())
        .color(Color::BLUE);
} else {
    text_wrapper("Hello".into())
        .color(Color::RED);
}
```

这对于需要在多个控制流分支中对同一个组件进行配置的情况非常有用。需要注意的是，组件在声明的时候就已经确定，后面的配置并不会改变它的执行顺序。

## 别的工作

除了以上最值得一提的部分，v3.0.0 还做了不少别的工作：完善脚手架、优化性能、适配更多平台、支持异步任务，导航，以及简化和使得各 API 更自然统一。这篇不是文档，就不一项项展开了。有一件事我想单独说一下：Tessera 现在有了自己的 Material 3 Expressive（M3E）组件库。

在 [Web Demo](https://tessera-ui.github.io/tessera/example/) 里打开 **Material Components**，可以看到我用 Tessera 复刻的 [Material 官方组件展示页](https://m3.material.io/components)。

Material 是 Tessera 的第一套完整官方组件库，但它绝不是用 Tessera 写界面的唯一方式。和 v1.0.0 时一样，你可以不用这套组件，按自己的想法实现任意效果。目前，[#214](https://github.com/tessera-ui/tessera/pull/214) 中正在推进与 iOS/macOS 效果一致的 Human Interface Guidelines 的实现。

## 参与 Tessera 开发

最后，还是和之前一样：Tessera 是一个开放的社区项目，欢迎各种形式的贡献。可以是代码、文档或建议。随着 v3.0.0 的发布，应该不会再出现像 2.5.0 到它这样的巨大改动。项目也因此转入 GitHub flow 模式开发，贡献更加简单。

如果你对 Tessera 的设计感兴趣，或者也想一起探索 Rust 里的 UI 可以怎么写，欢迎来 [GitHub](https://github.com/tessera-ui/tessera) 看看。想动手的话，可以从[贡献指南](https://github.com/tessera-ui/tessera/blob/main/CONTRIBUTING.md)开始。
