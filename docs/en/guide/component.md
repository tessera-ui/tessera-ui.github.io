---
title: Component
order: 1
---

# Component

This chapter explains how to declare components in `tessera` and common usage patterns.

It assumes basic familiarity with Rust. If you're new to Rust, consider reading [The Rust Programming Language](https://doc.rust-lang.org/book/).

## Component declaration

Mark a free function with the `#[tessera]` procedural macro to declare a component:

```rust
use tessera_ui::tessera;

#[tessera]
fn app() {
    // component content
}
```

Components can be nested simply by calling other component functions inside a component:

```rust
use tessera_ui::tessera;

#[tessera]
fn child() {
    // child content
}

#[tessera]
fn parent() {
    child();
}
```

## Containers

When a component needs to accept arbitrary children, receive them as a closure parameter:

```rust
use tessera_ui::tessera;
use tessera_components::{
    surface::{SurfaceArgs, surface},
    text::text,
};

#[tessera]
fn container<F>(child: F)
where
    F: FnOnce() + Send + Sync + 'static,
{
    surface(SurfaceArgs::default(), || {
        child();
    });
}

#[tessera]
fn app() {
    container(|| text("Hello from container!"));
}
```

Note: non-component functions (including plain closures) that are not annotated with `#[tessera]` are transparent to the component model. They do not create new component boundaries—child components called inside them are considered direct children of the original component. This allows using ordinary functions and closures for layout and logic organization without affecting the component tree.

```rust
use tessera_ui::tessera;

#[tessera]
fn app() {
    container(|| {
        helper();
    });
}

fn helper() {
    foo1();
    foo2();
}

#[tessera]
fn foo1() {
    // counter implementation
}

#[tessera]
fn foo2() {
    // counter implementation
}
```

In the example above, `helper` is not a component, so `foo1` and `foo2` are treated as direct children of `app`.

## State: remember, retain, context

`tessera` provides primitives to persist state inside components. They have different lifetimes and capabilities but a consistent usage pattern:

- `remember`: store a value as long as the component is visible
- `retain`: store a value for the whole process lifetime
- `context`: similar lifetime to `remember`, but can be propagated to arbitrarily deep child components

### remember

`remember` is used for short-lived component state. It's the most commonly used primitive. Example: a simple counter.

```rust
use tessera_ui::tessera;

#[tessera]
fn counter() {
    let count = remember(|| 0);
    surface(
        SurfaceArgs::default().modifier(Modifier::new().fill_max_size()),
        move || {
            column(ColumnArgs::default(), |scope| {
                scope.child(move || {
                    button(
                        ButtonArgs::filled(move || count.with_mut(|count| *count += 1)),
                        || text("+"),
                    )
                });
                scope.child(move || text(format!("count {}", count.get())));
            });
        },
    );
}
```

`count` is preserved across re-renders of the component.

### retain

`retain` stores long-lived state and is useful for things that should survive when a component is not visible, e.g., scroll positions or text input. Prefer `remember` unless you really need process-lifetime persistence.

Below is an example showing how `retain` can be used to keep `LazyListController` instances so each page remembers its scroll position when switching.

```rust
#[tessera]
pub fn app() {
    surface(SurfaceArgs::default(), || {
        column(
            ColumnArgs::default().modifier(Modifier::new().fill_max_size()),
            move |scope| {
                let first = remember(|| false);
                scope.child(move || {
                    button(
                        ButtonArgs::filled(move || first.set(!first.get())),
                        move || text("Switch"),
                    );
                });

                scope.child(move || {
                    if first.get() {
                        let controller = retain(|| LazyListController::new());
                        lazy_column_with_controller(
                            LazyColumnArgs::default().content_padding(Dp(5.0)),
                            controller,
                            |scope| {
                                for i in 0..100 {
                                    scope.item(move || {
                                        card(CardArgs::default(), move |_| {
                                            text(
                                                TextArgs::default()
                                                    .modifier(Modifier::new().padding_all(Dp(16.0)))
                                                    .text(i.to_string()),
                                            );
                                        })
                                    });
                                }
                            },
                        );
                    } else {
                        let controller = retain(|| LazyListController::new());
                        lazy_column_with_controller(
                            LazyColumnArgs::default().content_padding(Dp(5.0)),
                            controller,
                            |scope| {
                                for i in 0..100 {
                                    scope.item(move || {
                                        card(CardArgs::default(), move |_| {
                                            text(
                                                TextArgs::default()
                                                    .modifier(Modifier::new().padding_all(Dp(16.0)))
                                                    .text(i.to_string()),
                                            );
                                        })
                                    });
                                }
                            },
                        );
                    }
                });
            },
        );
    });
}
```

### context

`context` lets you provide a value that can be retrieved by any descendant component. It's useful for cross-cutting data such as theme or user info.

```rust
#[derive(Clone)]
struct Theme {
    color: Color,
}

#[tessera]
pub fn app() {
    surface(SurfaceArgs::default(), || {
        provide_context(|| Theme { color: Color::BLUE }, || mid())
    });
}

#[tessera]
fn mid() {
    Modifier::new().padding_all(Dp(16.0)).run(|| leaf());
}

#[tessera]
fn leaf() {
    let color = use_context::<Theme>().unwrap().get().color;
    surface(SurfaceArgs::default().style(color.into()), || {});
}
```

`app` provides a `Theme` via `provide_context`. `leaf` retrieves it with `use_context`, while `mid` doesn't need to know about the theme.

## Layout

`tessera-components` provides layout primitives such as `row`, `column`, `lazy_row`, and `lazy_column`. This section covers their basic usage.

### row and column

`row` and `column` arrange children horizontally and vertically, respectively. They accept a `FnOnce(Scope)` closure rather than a plain `FnOnce()` so you can manage child lifecycle and weights via the provided `Scope`.

```rust
#[tessera]
fn app() {
    surface(SurfaceArgs::default(), || {
        row(
            RowArgs::default().modifier(Modifier::new().fill_max_width()),
            |scope| {
                scope.child(|| text("Item 1"));
                scope.child(|| text("Item 2"));
                scope.child(|| text("Item 3"));
            }
        );
    });
}
```

To make children share space proportionally, use `scope.child_weighted(F, weight: f32)`.

```rust
#[tessera]
fn app() {
    surface(SurfaceArgs::default(), || {
        row(
            RowArgs::default().modifier(Modifier::new().fill_max_width()),
            |scope| {
                scope.child_weighted(|| {
                    surface(SurfaceArgs::default().style(Color::RED.into()), || {});
                }, 1.0);
                scope.child_weighted(|| {
                    surface(SurfaceArgs::default().style(Color::GREEN.into()), || {});
                }, 2.0);
                scope.child_weighted(|| {
                    surface(SurfaceArgs::default().style(Color::BLUE.into()), || {});
                }, 1.0);
            }
        );
    });
}
```

### lazy_row and lazy_column

`lazy_row` and `lazy_column` are virtualized scrolling lists that measure and lay out only visible items for performance. Prefer them over combining `row`/`column` with `scrollable` when dealing with large lists.

```rust
#[tessera]
fn app() {
    surface(SurfaceArgs::default(), || {
        lazy_row(
            LazyRowArgs::default().content_padding(Dp(5.0)),
            |scope| {
                for i in 0..50 {
                    scope.item(|| {
                        card(CardArgs::default(), |_| {
                            text(
                                TextArgs::default()
                                    .modifier(Modifier::new().padding_all(Dp(16.0)))
                                    .text(i.to_string()),
                            );
                        })
                    });
                }
            },
        );
    });
}
```

and

```rust
#[tessera]
fn app() {
    surface(SurfaceArgs::default(), || {
        lazy_column(
            LazyColumnArgs::default().content_padding(Dp(5.0)),
            |scope| {
                for i in 0..50 {
                    scope.item(|| {
                        card(CardArgs::default(), |_| {
                            text(
                                TextArgs::default()
                                    .modifier(Modifier::new().padding_all(Dp(16.0)))
                                    .text(i.to_string()),
                            );
                        })
                    });
                }
            },
        );
    });
}
```

Both `lazy_row` and `lazy_column` support weights like `row` and `column`.

## Custom layout

For specialized layouts, implement a `LayoutSpec` and call `fn layout<S: LayoutSpec>(spec: S)` inside a `#[tessera]` component. `LayoutSpec` separates measurement from recording (drawing). This section focuses on the `measure` portion.

A simple overlapping stack layout measures all children and returns the maximum width and height as its size, placing every child at `(0, 0)`.

```rust
#[derive(Clone, PartialEq)]
struct ExampleSpec;

impl LayoutSpec for ExampleSpec {
    fn measure(
        &self,
        input: &tessera_ui::LayoutInput<'_>,
        output: &mut tessera_ui::LayoutOutput<'_>,
    ) -> Result<ComputedData, MeasurementError> {
        let mut max_width = Px::ZERO;
        let mut max_height = Px::ZERO;
        let constraint = input.parent_constraint();
        for &id in input.children_ids() {
            let size = input.measure_child(id, constraint.as_ref())?;
            max_width = max_width.max(size.width);
            max_height = max_height.max(size.height);
            output.place_child(id, PxPosition::ZERO);
        }
        Ok(ComputedData {
            width: max_width,
            height: max_height,
        })
    }
}
```

For better performance, use `input.measure_children` to measure multiple children in parallel:

```rust
impl LayoutSpec for ExampleSpec {
    fn measure(
        &self,
        input: &tessera_ui::LayoutInput<'_>,
        output: &mut tessera_ui::LayoutOutput<'_>,
    ) -> Result<ComputedData, MeasurementError> {
        let mut max_width = Px::ZERO;
        let mut max_height = Px::ZERO;
        let constraint = input.parent_constraint();
        let nodes_to_measure = input
            .children_ids()
            .iter()
            .copied()
            .map(|id| (id, constraint.as_ref().to_owned()))
            .collect::<Vec<_>>();
        for (id, size) in input.measure_children(nodes_to_measure)? {
            max_width = max_width.max(size.width);
            max_height = max_height.max(size.height);
            output.place_child(id, PxPosition::ZERO);
        }
        Ok(ComputedData {
            width: max_width,
            height: max_height,
        })
    }
}
```

## Window callbacks and events

The `#[tessera]` macro injects functions to register window callbacks and event handlers. Currently available:

- `on_minimize(Fn(bool) + Send + Sync + 'static)`: window minimize callback
- `on_close(Fn() + Send + Sync + 'static)`: window close callback

> ## Note for this page
>
> Some parts of the documentation are incomplete or not yet finished:
>
> - Event callbacks
> - Input handling
