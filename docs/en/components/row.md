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

The `row` component arranges a set of child components horizontally.

Unlike other container components, `row` requires adding children via methods on `RowScope` such as `child`, instead of calling child component functions directly inside the closure.

::: warning
If you try to call child component functions directly inside the closure, the `row` component will panic at runtime.
:::

Here is a correct example of using the `row` component:

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

## Arguments

- `args: RowArgs`

  This argument configures the `row` component's style including width, height, alignment, etc. You can use `RowArgsBuilder` to construct it.

- `scope_config: F`

  A closure used to add child components into the `row`. The closure receives a `&mut RowScope` and you should use its `child`, `child_weighted`, etc. methods to add children.

## Preview

![row](/row_example.png)

