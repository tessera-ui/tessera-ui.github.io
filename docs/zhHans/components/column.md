---
title: Column
order: 6
---

# Column

```rust
pub fn column<F>(args: ColumnArgs, scope_config: F)
where
    F: FnOnce(&mut ColumnScope),
```

`column` 组件用于垂直排列一组子组件。

不像别的容器组件，`column` 组件要求你使用 `ColumnScope::child` 等方法来添加子组件，而非直接在闭包中调用子组件函数。

::: warning
如果尝试在闭包中直接调用子组件函数，`column` 组件将在运行时崩溃。
:::

以下是一个正确使用 `column` 组件的例子：

```rust
use tessera_components::{
    column::{column, ColumnArgs},
    text::text,
    spacer::{spacer, SpacerArgs},
};

column(ColumnArgs::default(), |scope| {
    scope.child(|| text("First item".to_string()));
    scope.child_weighted(|| spacer(SpacerArgs::default()), 1.0); // This spacer will be flexible
    scope.child(|| text("Last item".to_string()));
});
```

## 参数

- `args: ColumnArgs`

  该参数用于配置 `column` 组件的样式，包括宽高、对齐方式等。可以使用 `ColumnArgsBuilder` 来构建它。

- `scope_config: F`

  该参数是一个闭包，用于添加子组件到 `column` 组件中。闭包接收一个 `&mut ColumnScope` 参数，使用它的 `child`、`child_weighted` 等方法来添加子组件。

## 预览

![column](/column_example.png)

