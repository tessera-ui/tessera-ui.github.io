---
title: Row
order: 7
---

# Row

```rust
pub fn row<F>(args: RowArgs, scope_config: F)
where
    F: FnOnce(&mut RowScope),
```

`row` 组件用于水平排列一组子组件。

不像别的容器组件，`row` 组件要求你使用 `RowScope::child` 等方法来添加子组件，而非直接在闭包中调用子组件函数。

::: warning
如果尝试在闭包中直接调用子组件函数，`row` 组件将在运行时崩溃。
:::

以下是一个正确使用 `row` 组件的例子：

```rust
use tessera_components::{
    row::{row, RowArgs},
    text::text
};

row(RowArgs::default(), |scope| {
    scope.child(|| text("A".to_string()));
    scope.child(|| text("B".to_string()));
});
```

## 参数

- `args: RowArgs`

  该参数用于配置 `row` 组件的样式，包括宽高、对齐方式等。可以使用 `RowArgsBuilder` 来构建它。

- `scope_config: F`

  该参数是一个闭包，用于添加子组件到 `row` 组件中。闭包接收一个 `&mut RowScope` 参数，使用它的 `child`、`child_weighted` 等方法来添加子组件。

## 预览

![row](/row_example.png)

