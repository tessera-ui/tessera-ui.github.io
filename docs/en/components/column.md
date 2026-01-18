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

The `column` component arranges a set of child components vertically.

Unlike other container components, `column` requires adding children via methods on `ColumnScope` such as `child`, instead of calling child component functions directly inside the closure.

::: warning
If you try to call child component functions directly inside the closure, the `column` component will panic at runtime.
:::

Here is a correct example of using the `column` component:

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

## Arguments

- `args: ColumnArgs`

  This argument configures the `column` component's style including width, height, alignment, etc. You can use `ColumnArgsBuilder` to construct it.

- `scope_config: F`

  A closure used to add child components into the `column`. The closure receives a `&mut ColumnScope` and you should use its `child`, `child_weighted`, etc. methods to add children.

## Preview

![column](/column_example.png)

