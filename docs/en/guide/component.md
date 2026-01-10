---
title: Component
order: 1
---

# Component

In `tessera`, a component is the basic building block of the user interface. It allows developers to create complex UIs by composing these components.

`tessera` expresses components as functions, usually by marking functions with the `#[tessera]` macro. Below we also refer to components as "tessera".

## Defining components

Defining a component is very simple: just create a function and mark it with the `#[tessera]` macro — it becomes a `tessera` component.

```rust
use tessera_ui::tessera;

#[tessera]
fn component() {

}
```

Component functions can accept parameters with no special restrictions. As mentioned above, a component function is fundamentally an ordinary Rust function.

```rust
use tessera_ui::tessera;
use tessera_ui_basic_components::text::text;

#[tessera]
fn component(name: String, age: u32) {
    text(format!("Hello, {}! You are {} years old.", name, age));
}
```

## Composition

To compose components, simply call one component function from another component function.

```rust
use tessera_ui::tessera;

#[tessera]
fn parent_component() {
    child_component();
}

#[tessera]
fn child_component() {
    // child component content
}
```

By default, this renders the child component at the top-left corner of the parent. For more advanced layouts see the "measure-place" layout system below.

## Container

Often we don't know what the child component will be and cannot call it directly. In such cases we can pass the child as a closure.

```rust
use tessera_ui::tessera;

#[tessera]
fn parent_component(child: impl FnOnce()) {
    child();
}

#[tessera]
fn child_component() {
    // child component content
}

fn app() {
    parent_component(|| {
        child_component();
    });
}
```

Such components are called containers.

## Measure - Place

For more complex layouts you need to dive into tessera's measure-place layout system.

Tessera's layout system is split into two phases: measure and place. The measure phase determines the component's size, while the place phase determines the component's position on the screen.

### Custom layout

To override the default measurement behavior, call the `measure` function inside the component and provide a closure:

```rust
use tessera_ui::tessera;

#[tessera]
fn component() {
    measure(Box::new(|input| {
        // measurement logic here
    }))
}
```

The `measure` function accepts a closure that receives a `MeasureInput` and returns a `Size`. Its type is defined as:

```rust
pub type MeasureFn =
    dyn Fn(&MeasureInput<'_>) -> Result<ComputedData, MeasurementError> + Send + Sync;
```

`MeasureInput` contains layout information such as child component ids and parent constraints, while the returned `ComputedData` is the component's size — the measurement result.

Note that `measure` does not need to be imported; it is injected into the function component's context by the `#[tessera]` macro and can be considered part of the component API.

For detailed information about `MeasureInput` and `ComputedData`, see the documentation on docs.rs. Here is a simple measurement example: it measures the first child's size, places the child at the top-left (relative coordinate `(0, 0)`), and returns its own size as the child's size plus 10 pixels.

```rust
#[tessera]
fn component(child: impl FnOnce()) {
    child(); // compose child component
    measure(Box::new(|input| {
        let child_node_id = input.children_ids[0];
        let child_size = input.measure_child(child_node_id, input.parent_constraint)?;
        input.place_child(child_node_id, PxPosition::new(Px(0), Px(0)));
        Ok(
            ComputedData {
                width: child_size.width + Px(10),
                height: child_size.height + Px(10),
            }
        )
    }))
}
```

This simple example demonstrates what a component must do to perform layout:

1. Execute child component functions
2. Measure child sizes
3. Place child components
4. Return its own size

::: warning
If you place children without measuring them, or measure children but do not place them, the renderer will panic at runtime.
:::

You may notice earlier examples did not include any explicit layout. That's because tessera provides a default layout behavior for components without a custom layout: it measures child components and places them at the top-left. This default behavior is adequate in many cases.

### Input handling

Similar to `measure`, the `#[tessera]` macro injects an `input_handler` function into the component for handling external input events.

The following example shows a component that prevents components below it from receiving mouse events:

```rust
#[tessera]
fn component() {
    input_handler(Box::new(|mut input | {
        input.block_cursor();
    }))
}
```

### Window callbacks

The `#[tessera]` macro also injects functions to register window callbacks. Currently available callbacks include:

- `on_minimize(Box<dyn Fn(bool) + Send + Sync>)` – window minimize callback
- `on_close(Box<dyn Fn() + Send + Sync>)` – window close callback
