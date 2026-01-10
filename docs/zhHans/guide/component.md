---
title: 组件
order: 1
---

# 组件

在 `tessera` 中，组件（Component）是构建用户界面的基本单元。使得开发者可以通过组合这些组件来创建复杂的用户界面。

`tessera` 使用函数来表达组件，这一般通过 `#[tessera]` 宏标记函数来实现。所以下文中我们也将组件称为 `tessera`。

## 定义组件

定义一个组件非常简单，只需创建一个函数并使用 `#[tessera]` 宏标记它，它就从一个普通函数变成了一个 `tessera` 组件。

```rust
use tessera_ui::tessera;

#[tessera]
fn component() {

}
```

组件函数可以接受参数，对参数没有任何限制，就像上文说的，组件函数本质上还是普通的 Rust 函数。

```rust
use tessera_ui::tessera;
use tessera_ui_basic_components::text::text;

#[tessera]
fn component(name: String, age: u32) {
    text(format!("Hello, {}! You are {} years old.", name, age));
}
```

## 组件的组合

想要组合组件，只需在一个组件函数中调用另一个组件函数即可。

```rust
use tessera_ui::tessera;

#[tessera]
fn parent_component() {
    child_component();
}

#[tessera]
fn child_component() {
    // 这里是子组件的内容
}
```

默认的，这会将子组件渲染在父组件的左上角。如果需要更复杂的布局见后文关于`测量-放置`布局系统的介绍。

## 容器

很多时候，我们没法直接知道子组件是什么，无法直接调用它们。这时我们可以使用闭包传入子组件。

```rust
use tessera_ui::tessera;

#[tessera]
fn parent_component(child: impl FnOnce()) {
    child();
}

#[tessera]
fn child_component() {
    // 这里是子组件的内容
}

fn app() {
    parent_component(|| {
        child_component();
    });
}
```

这种组件，我们称之为容器（Container）。

## 测量-放置

如果需要更加复杂的布局，我们就需要深入`tessera`的测量-放置布局系统。

`tessera`的布局系统分为两个阶段：`测量（measure）`和`放置（place）`。其中测量阶段是为了确定组件的大小，而放置阶段是为了确定组件在屏幕上的位置。

### 自定义布局

如果需要覆盖默认的测量行为，则需要在组件函数中调用 `measure` 函数设置

```rust
use tessera_ui::tessera;

#[tessera]
fn component() {
    measure(Box::new(|input| {
        // 这里是测量逻辑
    }))
}
```

`measure`函数接受一个闭包作为参数，这个闭包接受一个`MeasureInput`类型的参数，并返回一个`Size`类型的值。它的类型定义如下：

```rust
pub type MeasureFn =
    dyn Fn(&MeasureInput<'_>) -> Result<ComputedData, MeasurementError> + Send + Sync;
```

`MeasureInput` 包含了子组件组件 id，父组件约束等布局信息，而返回的 `ComputedData` 为本组件的大小，即测量结果。

注意，`measure` 函数是不需要导入的，它由 `#[tessera]` 宏注入到函数组件上下文，可以理解为函数组件的 api。

有关`MeasureInput`和`ComputedData`的详细信息，请参考[docs.rs](https://docs.rs/tessera-ui/latest/tessera_ui/type.MeasureFn.html)上的文档。这里给出一个简单的测量例子，它测量第一个子组件的大小，将子组件放在左上角(即相对坐标的`(0, 0)`)，然后返回自己的大小为子组件的大小加上 10 个像素的结果。

```rust
#[tessera]
fn component(child: impl FnOnce()) {
    child(); // 组合子组件
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

这个简单的例子展示了布局一个组件必须要做的事情：

1. 执行子组件函数
2. 测量子组件大小
3. 放置子组件
4. 返回自己的大小

::: warning
如果不测量子组件就放置它们，或者测量了子组件但是没有放置，渲染器会在运行时崩溃。
:::

读者可能注意到，本段之前给出的组件没有任何布局实现，这其实是因为`tessera`为未实现布局的组件提供了一个默认的布局行为：测量子组件的大小，并将它们放置在左上角。这在很多情况下已经足够了。

### 输入处理

类似 `measure` 函数，`#[tessera]` 宏还会为组件注入一个 `input_handler` 函数，用于处理外部输入事件。

以下例子展示一个会阻止它下面的组件接收鼠标事件的组件：

```rust
#[tessera]
fn component() {
    input_handler(Box::new(|mut input | {
        input.block_cursor();
    }))
}
```

### 窗口回调

`#[tessera]` 宏还会为组件注入一些可以注册窗口回调的函数，目前有下面这些，在未来可能会有所变化：

- `on_minimize(Box<dyn Fn(bool) + Send + Sync>)` – 窗口最小化回调
- `on_close(Box<dyn Fn() + Send + Sync>)` – 窗口关闭回调
