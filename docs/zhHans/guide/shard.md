---
title: 分片与导航
order: 2
---

# 分片与导航

:::tip
分片 (shard) 是 `tessera-ui` 的一个可选特性，用于实现更方便的页面化组件和导航功能。

以下内容仅在启用 `shard` feature 时适用（默认启用）。
:::

## 分片

现代应用程序通常由多个页面组成。大部分时候，我们管理状态的最大单位是页面而非整个应用程序。在 `tessera` 中，我们将每个页面称为一个分片 (shard)。

分片由一个 `#[tessera]` 组件标记而来。举例说下面这个分片：

```rust
#[shard]
#[tessera]
fn about_page() {
    // page content...
}
```

在这里， `#[shard]` 宏将 `about_page` 组件标记为一个分片。

目前我们还没看出分片和普通组件的区别。实际上，它确实不会破坏组件本身的任何特性。然而，分片提供了下面两个重要功能：

## 状态注入

如前文所述，页面(分片)在现代应用中通常是状态管理的最小单位。`#[shard]` 宏允许我们为分片注入一个特殊的状态，它不需要调用者传入，也不会在每帧销毁。

让我们先给刚刚的 `about_page` 分片设计一个状态：

```rust
struct AboutPageState {
    last_visited: Instant,
}
```

接下来，将它添加到 `about_page` 组件的参数列表中：

```rust
#[shard]
#[tessera]
fn about_page(state: AboutPageState) {
    // page content...
}
```

现在，根据[组件模型](./component.md)的规则，我们调用 `about_page` 组件时需要传入一个 `AboutPageState` 实例：

```rust
let state = AboutPageState {
    last_visited: Instant::now(),
};
about_page(state);
```

这样做看似很直接，但是当页面多起来之后，你就需要编写管理这堆页面状态，又实际没什么用处的样板代码了。接下来，我们将看到 `#[shard]` 宏如何帮助我们简化这个过程。

修改 `about_page` 组件：

```rust
#[shard]
#[tessera]
fn about_page(#[state] state: AboutPageState) {
    // page content...
}
```

:::warning
`#[state]` 标记的参数必须实现了 `Default` trait。用于初始化状态。
:::

这里我们将 `about_page` 的 `state` 参数标记为 `#[state]`。那么 `#[shard]` 宏会自动为我们生成管理 `AboutPageState` 的代码，并注入状态到 `about_page` 函数，将其包装为去掉此参数的结果。现在我们可以直接调用 `about_page` 而不需要传入状态：

```rust
about_page();
```

:::tip
默认的，此注入状态的生命周期等于整个应用程序的生命周期。
:::

在 `about_page` 内部，就可以使用 `state` 了，但是要注意的是，#[state] 标记会自动使用 `std::arc::Arc` 包装状态，这是出于测量逻辑的并行考虑。因此如果需要修改它，请使用支持内部可变性的包装器，比如 `Mutex` 或 `RwLock`。

```rust
// 从组件外部看起来的样子：
#[tessera]
fn about_page();
// 对组件内部来说的样子：
#[tessera]
fn about_page(state: std::sync::Arc<AboutPageState>);
```

## 导航

分片的另一个重要功能是导航。在一个应用程序中，我们通常需要在不同的页面(分片)之间切换。如果我们需要手动实现，它可能看起来是这样的:

```rust
match current_page {
    Page::Home => home_page(page_state),
    Page::About => about_page(page_state),
    Page::Settings => settings_page(page_state),
}
```

尽管直观，但是这较为繁琐和容易出错。功能性也显得不足，比如，如何在 `home_page` 导航到 `about_page` 并且传递一个参数？因此 `#[shard]` 宏为提供了一个更简洁的方式来实现类型安全的导航。

让我们使用前文的 `about_page` 分片，并添加一个新的分片 `home_page`：

```rust
#[shard]
#[tessera]
fn about_page(#[state] state: AboutPageState) {
    // page content...
}

#[shard]
#[tessera]
fn home_page(num: i32) {
    // page content...
}
```

`#[shard]` 宏在这里会为 `about_page` 和 `home_page` 生成各自的导航目标类型：

```rust
struct AboutPageDestination;
struct HomePageDestination {
    num: i32,
}
```

:::tip
导航目标类型的可见性和分片函数相同。这意味着如果分片函数是私有的，那么导航目标类型也是私有的，反之亦然。
:::

注意到 `HomePageDestination` 结构体包含了 `home_page` 函数的参数 `num`。这是因为导航到一个分片时，必须提供它的所有参数，除非参数是由 `#[state]` 注入的。

使用导航目标类型，我们可在任意地方程序化的导航到目标：

```rust
// Router 是一个全局单例，可以通过 Router::with_mut / Router::with 访问
Router::with_mut(|router| {
    router.push(HomePageDestination { num: 42 });
});
```

关于 `Router` 的更多操作见[docs.rs](https://docs.rs/tessera-ui/latest/tessera_ui/router/struct.Router.html)上的文档。

然而，你可能会发现这完全没有作用，这是因为我们的导航需要一个根组件用于渲染当前导航到的分片，我们需要使用这个组件：

```rust
pub fn router_root(root_dest: impl RouterDestination + 'static)
```

`root_dest` 是应用程序启动时的初始导航目标。比如上文的 `HomePageDestination` 就可以作为初始导航目标。

将它放在你的应用程序显示页面的地方，一个简单的想法是直接作为根组件：

```rust
Renderer::run_with_config(
    || router_root(HomePageDestination {
        num: 0,
    }),
    |app| {
        tessera_ui_basic_components::pipelines::register_pipelines(app);
    },
    config,
)
.unwrap();
```

这固然是可行的，但假如你有导航栏、顶栏、侧边栏等需要在页面之外的内容，也可放在别的容器组件中，总之，它是显示当前导航分片的组件。

:::warning
目前不支持多个 `router_root` 显示不同的导航分片。尽管多处使用它可显示多个相同的分片实例，但它们共享同一个导航状态。
:::

## 注入状态的生命周期

如果你同时使用了注入状态和导航功能，你还可以为注入状态指定生命周期，使得它于导航堆栈被弹出时自动销毁，或者无论如何都和应用程序生命周期相同。

```rust
#[shard]
#[tessera]
fn about_page(#[state(shard)] state: AboutPageState) {
    // page content...
}
```

这代表 `AboutPageState` 的生命周期和 `about_page` 分片的生命周期相同。也就是说，如果 `about_page` 分片被导航堆栈弹出，那么它的状态也会被销毁。

如果不指定生命周期，默认就是 `shard` 。

```rust
#[shard]
#[tessera]
fn about_page(#[state(app)] state: AboutPageState) {
    // page content...
}
```

这代表 `AboutPageState` 的生命周期和应用程序相同。也就是说，无论 `about_page` 分片 是否被导航堆栈弹出，它的状态都不会被销毁。

需要注意的是，尽管默认生命周期是 `shard` ，但是假如不使用导航功能，那么它就没有意义，可视为 `app` 生命周期。
