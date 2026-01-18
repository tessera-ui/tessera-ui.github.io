---
title: Shards and Navigation
order: 3
---

# Shards and Navigation

:::tip
Shards are an optional feature of `tessera-ui` to make page-like components and navigation easier.

The following applies only when the `shard` feature is enabled (enabled by default).
:::

## Shards

Modern applications usually consist of multiple pages. Most of the time, the largest unit for state management is a page rather than the whole application. In `tessera` each page is called a shard.

A shard is marked by a `#[tessera]` component. For example:

```rust
#[shard]
#[tessera]
fn about_page() {
    // page content...
}
```

Here, the `#[shard]` macro marks the `about_page` component as a shard.

At first glance there is no difference between a shard and a normal component. Indeed, it does not break any component features. However, shards provide two important features:

## State Injection

As mentioned, pages (shards) are usually the smallest unit for state management in modern apps. The `#[shard]` macro allows injecting a special state into a shard; it does not need to be passed by the caller and is not destroyed every frame.

Let's design a state for the `about_page` shard:

```rust
struct AboutPageState {
    last_visited: Instant,
}
```

Next, add it to the `about_page` component parameter list:

```rust
#[shard]
#[tessera]
fn about_page(state: AboutPageState) {
    // page content...
}
```

According to the [component model](./component.md) rules, when we call `about_page` we need to pass an `AboutPageState` instance:

```rust
let state = AboutPageState {
    last_visited: Instant::now(),
};
about_page(state);
```

This seems straightforward, but when pages increase you'll have to write boilerplate to manage these page states that are mostly useless. Next we'll see how `#[shard]` simplifies this.

Modify the `about_page` component:

```rust
#[shard]
#[tessera]
fn about_page(#[state] state: AboutPageState) {
    // page content...
}
```

:::warning
Parameters marked with `#[state]` must implement `Default` for initialization.
:::

Here we mark the `state` parameter of `about_page` with `#[state]`. The `#[shard]` macro will automatically generate code to manage `AboutPageState` and inject the state into `about_page`, wrapping the function to remove this parameter. Now we can call `about_page` directly without providing the state:

```rust
about_page();
```

:::tip
By default, the lifetime of this injected state equals the lifetime of the whole application.
:::

Inside `about_page` you can use `state`, but note that the parameter marked by `#[state]` is automatically wrapped in `std::sync::Arc` for concurrency considerations. Therefore if you need to mutate it, use interior-mutable wrappers like `Mutex` or `RwLock`.

```rust
// From outside the component:
#[tessera]
fn about_page();
// From inside the component:
#[tessera]
fn about_page(state: std::sync::Arc<AboutPageState>);
```

## Navigation

Another key feature of shards is navigation. In an application we often need to switch between different pages (shards). If implemented manually it might look like:

```rust
match current_page {
    Page::Home => home_page(page_state),
    Page::About => about_page(page_state),
    Page::Settings => settings_page(page_state),
}
```

While straightforward, this is verbose and error-prone. It also lacks features, for example how to navigate from `home_page` to `about_page` and pass parameters. The `#[shard]` macro provides a concise, type-safe way to navigate.

Let's use the earlier `about_page` shard and add a new `home_page` shard:

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

The `#[shard]` macro will generate destination types for `about_page` and `home_page`:

```rust
struct AboutPageDestination;
struct HomePageDestination {
    num: i32,
}
```

:::tip
The visibility of the destination types matches that of the shard function. If a shard function is private, the destination type is private as well, and vice versa.
:::

Notice `HomePageDestination` includes the `num` parameter from `home_page`. This is because navigating to a shard requires supplying all its parameters unless they are injected by `#[state]`.

Using the destination types we can programmatically navigate anywhere:

```rust
// Router is a global singleton, accessible via Router::with_mut / Router::with
Router::with_mut(|router| {
    router.push(HomePageDestination { num: 42 });
});
```

See the `Router` docs on [docs.rs](https://docs.rs/tessera-ui/latest/tessera_ui/router/struct.Router.html) for more operations
However, this won't work by itself because navigation needs a root component to render the current destination; we need to use this component:

```rust
pub fn router_root(root_dest: impl RouterDestination + 'static)
```

`root_dest` is the initial navigation destination when the app starts. For example, `HomePageDestination` can be used as the initial destination.

Put it where your app displays pages; a simple idea is to use it as the root component:

```rust
#[tessera]
fn app() {
    router_root(HomePageDestination { num: 0 });
}

tessera_ui::entry!(
    app,
    packages = [tessera_components::ComponentsPackage::default()],
);
```

This works, but if you have a nav bar, top bar, side bar, or other content outside pages, you can put it in another container component; the root idea is that it's the component that displays the currently navigated shard.

:::warning
Multiple `router_root`s showing different shards are not supported. While using it in multiple places will display multiple identical shard instances, they share the same navigation state.
:::

## Lifecycle of injected state

When using injected state and navigation together, you can set the lifetime of injected state so that it is destroyed when the navigation stack pops, or it can always live for the lifetime of the app.

```rust
#[shard]
#[tessera]
fn about_page(#[state(shard)] state: AboutPageState) {
    // page content...
}
```

This makes the lifetime of `AboutPageState` the same as the lifetime of the `about_page` shard. That is, if the `about_page` shard is popped from the navigation stack, its state will be destroyed.

If no lifetime is specified, the default is `shard`.

```rust
#[shard]
#[tessera]
fn about_page(#[state(app)] state: AboutPageState) {
    // page content...
}
```

This means `AboutPageState` has the same lifetime as the application. That is, whether or not `about_page` is popped from the navigation stack, its state will not be destroyed.

Note that although the default lifetime is `shard`, if you don't use navigation, it has no effect and can be considered `app` lifetime.

