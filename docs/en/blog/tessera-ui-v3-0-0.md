---
title: "Tessera UI v3.0.0: Rebuilt from the tile up"
date: 2026-11-18T14:16:00+08:00
author: shadow3
githubName: shadow3aaa
---

- [Website](https://tessera-ui.github.io)
- [GitHub](https://github.com/tessera-ui/tessera)
- [Web Demo](https://tessera-ui.github.io/tessera/example)

After exactly a year of development, Tessera v3.0.0 is finally done. This release changed the framework itself so much that it feels like a new one, even though the ideas behind it are still the same.

A quick introduction: Tessera is a reactive, **retained-mode** UI framework built on Rust and wgpu. I started it to explore how to build UIs that feel natural to write in Rust, run fast, and leave room for you to extend them.

## What it used to be

Tessera UI used to be an **immediate-mode** UI framework built on Rust and wgpu.

At the time, iced's Elm architecture felt a little cumbersome to me. Even to change a value when a button was clicked, I had to define a message and write the code to handle it. egui took the opposite approach: all I needed to draw was a `cx`, but I had to pass that context around, and I found it harder to build more complex visual effects. What I wanted was closer to Jetpack Compose: components are functions, layouts can be composed layer by layer, and rendering doesn't have to rely on the drawing primitives the framework ships with.

To make that happen, I started with the idea that a component should be a pure function of its state. It looked like this:

```rust
#[tessera]
#[shard] // Defines a shard, which injects the state marked with `#[state]`.
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

A few problems are already visible in this example, and they're why I moved away from this model in Tessera v3.0.0:

- State had to be hoisted to the top level or into `AppState`.
- There were `Arc`s and atomics everywhere, even though the UI work in this example ran on a single thread.
- Passing arguments around was cumbersome.

I'll go through how the new version addresses these problems. If you'd rather skip the history and see what the new APIs look like, you can jump straight to the [docs](https://tessera-ui.github.io/guide).

## State bloat and clone hell

Suppose I have a box that gets wider when I click it, and I want two of them in a panel. Here's roughly what that looked like in 2.5.0, leaving out initialization, measurement, and hit-testing details:

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

The page doesn't care how wide the boxes are, but it still has to hold their widths in `AppState`. The panel doesn't care either, yet every time I add a box, I have to add another field and come up with a name for it. When the state finally reaches the code that actually uses it, measurement needs to read it and the click handler needs to write it, so I still have to `clone` an `Arc` to get the same width into both closures. **I just wanted to add another box to the panel. Why am I editing `AppState`?**

That's why Tessera v3.0.0 introduces `remember` (and `retain`). State can now stay local to the component and still be reactive. The implementation also keeps state access fast without making you write all those `clone` calls.

If you're curious how `remember` works, the details are in the [`tessera-ui` and `tessera-macros` source code](https://github.com/tessera-ui/tessera/tree/main). The short version is that it works much like Compose's `remember` or React's `useState`, but you don't need an observable type or have to follow the [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks). You can use it directly inside control flow.

Here's the same example in 3.0.0, without hoisting state, passing around `Arc`s, or cloning them everywhere:

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

## Component parameters

UI components tend to have a lot of options, but you usually only want to set a few of them at a time. If I'm putting some text on screen, I might want to change the font size without thinking about the color, line height, or whether it should be on a single line. But the person writing the component doesn't know in advance which of those options I'll need, so the API still needs to expose them.

Rust doesn't have built-in named or default arguments. In older versions of Tessera, the component library used `ArgBuilder` types so callers could put their arguments together however they wanted. It was flexible, but there was a lot to write. In 3.0.0, Tessera generates the component's configuration API directly, so calling a component feels closer to using named and default arguments in Rust.

Consider a simple component:

```rust
#[tessera]
fn text_wrapper(content: String, color: Option<Color>) {
    let label = text(format!("W{content}W"));
    if let Some(color) = color {
        label.color(color);
    }
}
```

A parameter that isn't wrapped in `Option` is required: you have to provide it when you call the component. A parameter wrapped in `Option` is optional and can be left out.

That maps neatly onto a builder. The required arguments go in the initial call, and the optional ones are set by chaining methods:

```rust
text_wrapper("Hello".into());
text_wrapper("Hello".into()).color(Color::BLUE);
```

You might already have noticed a useful trick in how `text_wrapper` calls `text`: you can save the configuration handle and use it later. That's handy when different branches need to configure the same component:

```rust
let wrapped = text_wrapper("Hello".into());
if need_blue {
    wrapped.color(Color::BLUE);
} else {
    wrapped.color(Color::RED);
}
// Same visible result in this example:
if need_blue {
    text_wrapper("Hello".into())
        .color(Color::BLUE);
} else {
    text_wrapper("Hello".into())
        .color(Color::RED);
}
```

The useful bit is that you can declare the component once and decide how to configure it in different branches. The declaration determines the component's execution order; where you set its options later doesn't change that.

## Other work

There's plenty more in v3.0.0: better project scaffolding, performance improvements, support for more platforms, async tasks, navigation, and simpler, more consistent APIs. This isn't the docs, so I won't go through all of it here. There is one thing I want to single out, though: Tessera now has its own Material 3 Expressive (M3E) component library.

Open **Material Components** in the [Web Demo](https://tessera-ui.github.io/tessera/example/) to see my recreation of the [official Material component showcase](https://m3.material.io/components), built with Tessera.

Material is Tessera's first complete official component library, but it's by no means the only way to build an interface with Tessera. Just as in v1.0.0, you can skip these components and build whatever effects you have in mind. There's also work underway in [#214](https://github.com/tessera-ui/tessera/pull/214) on an implementation of Apple's Human Interface Guidelines that aims to match the look and feel of iOS and macOS.

## Contributing to Tessera

As before, Tessera is an open community project, and contributions of all kinds are welcome, whether that's code, documentation, or suggestions. With v3.0.0 out, I don't expect to make another change on the scale of the jump from 2.5.0 to 3.0.0. The project has also moved to GitHub flow to make contributing easier.

If you're interested in Tessera's design, or want to explore how we can write UIs in Rust together, come take a look on [GitHub](https://github.com/tessera-ui/tessera). If you'd like to get involved, the [contributing guide](https://github.com/tessera-ui/tessera/blob/main/CONTRIBUTING.md) is a good place to start.
