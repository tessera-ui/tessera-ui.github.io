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

`boxed` 组件是一个容器，用于将其子组件相互叠加，并根据指定的对齐方式进行对齐。

不像别的容器组件，`boxed` 组件要求你使用 `BoxedScope::child` 等方法来添加子组件，而非直接在闭包中调用子组件函数。

::: warning
如果尝试在闭包中直接调用子组件函数，`boxed` 组件将在运行时崩溃。
:::

## 参数

- `args: BoxedArgs`

  该参数用于配置 `boxed` 组件的样式，包括宽高、默认对齐方式等。可以使用 `BoxedArgsBuilder` 来构建。

- `scope_config: F`
  该参数是一个闭包，用于添加子组件到 `boxed` 组件中。闭包接收一个 `&mut BoxedScope` 参数，使用它的 `child` 和 `child_with_alignment` 方法来添加子组件。

## 例子

```rust
use tessera_components::boxed::{boxed, BoxedArgs};
use tessera_components::text::{text, TextArgsBuilder};
use tessera_components::alignment::Alignment;

boxed(BoxedArgs::default(), |scope| {
    // 添加一个将位于背景的子组件（首先渲染）。
    scope.child(|| {
        text(TextArgsBuilder::default().text("Background".to_string()).build().unwrap());
    });
    // 添加另一个居中对齐的子组件，它将出现在顶部。
    scope.child_with_alignment(Alignment::Center, || {
        text(TextArgsBuilder::default().text("Foreground".to_string()).build().unwrap());
    });
});
```

## 预览

![boxed](/boxed_example.png)

