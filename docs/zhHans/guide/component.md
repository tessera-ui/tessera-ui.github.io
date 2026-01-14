---
title: 组件
order: 1
---

# 组件

本章节将介绍 `tessera` 中组件的声明方式和常见的使用方法。

这默认你已经了解了rust的基本语法和概念。如果你还不熟悉 rust，建议先阅读 [Rust 程序设计语言](https://kaisery.github.io/trpl-zh-cn/)。

## 组件声明

在自由函数上使用 `#[tessera]` 过程宏修饰即可声明组件。

```rust
use tessera_ui::tessera;

#[tessera]
fn app() {
    // 组件内容
}
```

在组件内调用其它组件即可实现组件嵌套。

```rust
use tessera_ui::tessera;

#[tessera]
fn child() {
    // 子组件内容
}

#[tessera]
fn parent() {
    child();
}
```

## 容器

固定调用某个或者多个子组件无法满足通用组件需求。此时可以让组件函数接受一个闭包参数代表子组件。

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

值得一提的是，非组件函数，包括闭包，未被 `#[tessera]` 修饰的函数，对于组件模型来说是透明的。也就是说它们不会创建新的组件边界，组件模型会继续沿用调用它们的组件的上下文环境。

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
    // counter实现
}

#[tessera]
fn foo2() {
    // counter实现
}
```

上面的代码中，`helper` 函数并不是组件函数，因此它不会创建新的组件边界。`foo1` 和 `foo2` 组件会被视为 `app` 组件的直接子组件。利用这一点，可以灵活的使用普通函数和闭包来参与布局和逻辑组织，而不影响组件树结构。

## 状态记忆

在组件内使用记忆原语以持久的保存变量状态。

目前 `tessera` 有下面几个记忆原语，它们各自的能力、生命周期不同，但是用法一致。

- `remember`: 记忆一个变量，在组件可见时一直存在
- `retain`: 记忆一个变量，在整个进程生命周期内一直存在
- `context`: 生命周期和 `remember` 一致，但是可以透传给任意深度的子组件

本节将一个个介绍它们的用法。

### remember

`remember` 用于在组件内短期记忆一个变量。是最常用的记忆原语。

下面用计数器实现举例说明 `remember` 的用法，首先是还没有使用 `remember` 的ui代码：

```rust
use tessera_ui::tessera;

#[tessera]
fn counter() {
    let mut count = 0;
    surface(
        SurfaceArgs::default().modifier(Modifier::new().fill_max_size()),
        move || {
            column(ColumnArgs::default(), move |scope| {
                scope.child(move || button(ButtonArgs::filled(move || {}), move || text("+")));
                scope.child(move || text(format!("count {}", count)));
            });
        },
    );
}
```

为了让 `count` 在每次组件重绘时都能使用同个变量，我们必须改为使用 `remember` 来记忆它。

```rust
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

这样 `count` 就能在组件重绘时都使用同一个值，因此点击按钮时 `count` 会正确增加。

### retain

`retain` 用于在组件内长期记忆一个变量。它常用于一些需要在组件不可见时也需要保存状态的场景，如滚动进度，用户输入等等。

建议只在确实需要长期记忆时使用 `retain`，否则优先使用 `remember`，以免出现不必要的持续内存占用。

下面用一个滚动页面切换的例子说明 `retain` 的用法：

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
                        lazy_column(
                            LazyColumnArgs::default().content_padding(Dp(5.0)),
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
                        lazy_column(
                            LazyColumnArgs::default().content_padding(Dp(5.0)),
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

在上面的代码中，`first` 变量决定了当前显示的是第一个页面还是第二个页面。每个页面都是一个 `lazy_column` 组件。由于未使用 `retain` 记忆 `lazy_column` 的滚动状态，因此每次切换页面时，滚动位置都会重置为顶部。如果希望切换回来时能记住上次的滚动位置，需要使用 `retain` 来记忆 `lazy_column` 组件的状态。

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

这样切换分支时，包含滚动状态的 `LazyListController` 也不会丢失，切换两者时能分别记住上次的滚动位置。

### context

`context` 用于在组件内记忆一个变量，并且可以将该变量传递给任意深度的子组件。这对于一些需要跨越多个组件层级传递的数据非常有用，比如主题色，用户信息等等。

下面用一个主题色传递的例子说明 `context` 的用途，假设我们有三个组件嵌套，顶层组件提供主题色，但是中间的组件不需要使用组件色。

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

`app` 组件使用 `provide_context` 提供了一个 `Theme` 变量作为上下文。`mid` 组件虽然没有使用 `Theme`，但是它的子组件 `leaf` 可以通过 `use_context` 获取到 `Theme` 并使用其中的颜色信息。而中间的 `mid` 组件并不需要关心主题色的传递细节。`context` 使得跨组件层级的数据传递变得简单而高效。

## 布局

`tessera-components` 组件库提供了一些布局组件，如 `row`、`column`、`lazy_row`、`lazy_column` 等，满足常见的布局需求。本节将介绍这些基本布局组件。

### row 和 column

`row` 和 `column` 分别用于水平和垂直排列子组件。它们是最基本的布局组件。

下面分别展示 `row` 和 `column` 的基本使用示例：

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

```rust
#[tessera]
fn app() {
    surface(SurfaceArgs::default(), || {
        column(
            ColumnArgs::default().modifier(Modifier::new().fill_max_height()),
            |scope| {
                scope.child(|| text("Item A"));
                scope.child(|| text("Item B"));
                scope.child(|| text("Item C"));
            }
        );
    });
}
```

column 和 row 组件都不是直接接受一个 `FnOnce()` 闭包表示所有子组件，而是接受一个 `FnOnce(Scope)` 闭包。`Scope` 用于管理子组件的生命周期和布局顺序。通过调用 `scope.child(F)` 方法可以添加子组件。这是因为子组件可能有额外的布局信息，如下文所述的权重（weight）。

如果需要让指定的多个组件占据的空间遵循比例，则应该使用 `scope.child_weighted(F, weight: f32)` 方法来添加子组件。

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

上面的示例中，红色和蓝色组件各占 1 份空间，绿色组件占 2 份空间，因此它们最终的宽度比例为 1:2:1。

### lazy_row 和 lazy_column

`lazy_row` 和 `lazy_column` 的使用方式和 `row`、`column` 类似，但是带有滚动的能力，能够在内容超出可见区域时进行滚动查看。通常在屏幕空间不足以同时显示所有子组件时使用。

之所以称为 `lazy`，是因为它们实际为虚拟列表组件，只会测量当前可见区域内的子组件，从而提升性能。虽然也有结合使用 `scrollable` 和 `row`、`column` 实现滚动效果的方式，但是那种方式会测量所有子组件，性能开销较大。请优先使用 `lazy_row` 和 `lazy_column`。

下面分别展示 `lazy_row` 和 `lazy_column` 的基本使用示例：

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

`lazy_row` 和 `lazy_column` 也支持权重(weight)，和 `row`、`column` 的用法一致，这里不再赘述。

## 自定义布局

虽然 `tessera-components` 提供了常见的布局组件，但是有时候可能需要自定义布局以满足特殊需求。

被 `#[tessera]` 宏修饰的组件函数会被注入 `fn layout<S: LayoutSpec>(spec: S)` 函数，用于自定义布局。调用它并提供一个实现了 `LayoutSpec` trait 的结构体即可实现自定义布局。

`LayoutSpec` trait 定义了布局所需的方法，这分为 `measure` he `record` 两个部分。`record` 是用于生成绘制对象的，而 `measure` 则用于测量子组件的大小。本节主要介绍 `measure` 部分的用法。`record` 部分的用法将在自定义绘制章节介绍。

本节将通过一个简单的重叠堆叠布局示例来说明自定义布局的用法。

首先，需要定义一个结构体用于实现 `LayoutSpec` trait：

```rust
#[derive(Clone, PartialEq)]
struct ExampleSpec;
```

`Clone` 和 `PartialEq` trait 是必须实现的，因为 `tessera` 依赖它进行布局缓存。

接下来，为该结构体实现 `LayoutSpec` trait：

```rust
impl LayoutSpec for ExampleSpec {
    fn measure(
        &self,
        input: &tessera_ui::LayoutInput<'_>,
        output: &mut tessera_ui::LayoutOutput<'_>,
    ) -> Result<ComputedData, MeasurementError> {
        // 测量逻辑
    }
}
```

首先需要获取需要测量和放置的组件的组件id，接下来无论是测量还是放置，都是通过组件id来操作的。这由 `input.children_ids()` 方法提供。

```rust
impl LayoutSpec for ExampleSpec {
    fn measure(
        &self,
        input: &tessera_ui::LayoutInput<'_>,
        output: &mut tessera_ui::LayoutOutput<'_>,
    ) -> Result<ComputedData, MeasurementError> {
        for &id in input.children_ids() {
            // ...
        }
    }
}
```

接下来要测量每个子组件的大小。进而确认自己的大小。这是通过 `input.measure_child(id, constraints)` 方法实现的。`constraints` 参数用于指定测量时的约束条件。这里没有特殊要求，因此使用父组件传入的约束条件 `input.parent_constraint()`。

对于重叠堆叠来说，一般是取所有子组件的最大宽度和最大高度作为自己的大小，这样才能确保所有子组件都能被完整显示。因此也需要用两个变量来记录当前的最大宽度和最大高度。

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
        for &id in input.children_ids() {
            let size = input.measure_child(id, constraint.as_ref())?;
            max_width = max_width.max(size.width);
            max_height = max_height.max(size.height);
        }
        // ...
    }
}
```

测量之后还需要将组件放在指定的位置上。这里我们希望所有子组件都放在左上角位置，因此放置位置都是 `(0, 0)`(tessera 使用左上角为坐标原点，向右为 x 轴正方向，向下为 y 轴正方向)。这属于布局的输出，因此需要通过 `output.place_child(id, x, y)` 方法实现。

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
        for &id in input.children_ids() {
            let size = input.measure_child(id, constraint.as_ref())?;
            max_width = max_width.max(size.width);
            max_height = max_height.max(size.height);
            output.place_child(id, PxPosition::ZERO);
        }
        // ...
    }
}
```

最后组合 `max_width` 和 `max_height` 返回 `ComputedData` 结构体作为结果即可。

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

这已经可以工作，但不是最佳实践。`tessera` 支持并行的测量子组件，这需要将多个 `input.measure_child` 调用合并为一个 `input.measure_children` 实现。

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

> ## Note for this page
>
> 还有部分文档未完成或者未完全完成
>
> - 输入处理
