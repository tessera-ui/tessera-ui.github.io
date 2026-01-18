---
title: Boxed
order: 8
---

# Boxed

```rust
pub fn boxed<F>(args: BoxedArgs, scope_config: F)
where
    F: FnOnce(&mut BoxedScope),
```

The `boxed` component is a container that overlays its children, aligning them relative to each other.

Unlike other container components, `boxed` requires you to use methods like `BoxedScope::child` to add children, instead of calling child component functions directly inside the closure.

::: warning
If you attempt to call child component functions directly inside the closure, the `boxed` component will panic at runtime.
:::

## Arguments

- `args: BoxedArgs`

  This argument configures the `boxed` component's style, including width, height, and default alignment. You can use `BoxedArgsBuilder` to construct it.

- `scope_config: F`

  A closure used to add child components into the `boxed` component. The closure receives a `&mut BoxedScope` and you should use its `child` and `child_with_alignment` methods to add children.

## Examples

```rust
use tessera_components::boxed::{boxed, BoxedArgs};
use tessera_components::text::{text, TextArgsBuilder};
use tessera_components::alignment::Alignment;

boxed(BoxedArgs::default(), |scope| {
    // Add a child that will be in the background (rendered first).
    scope.child(|| {
        text(TextArgsBuilder::default().text("Background".to_string()).build().unwrap());
    });
    // Add another child aligned to the center, which will appear on top.
    scope.child_with_alignment(Alignment::Center, || {
        text(TextArgsBuilder::default().text("Foreground".to_string()).build().unwrap());
    });
});
```

## Preview

![boxed](/boxed_example.png)

