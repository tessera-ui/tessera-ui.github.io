---
title: Tessera 的思维方式
description: 了解声明式组件、属性和重建在 Tessera 中如何配合。
---

# Tessera 的思维方式

在 Tessera 中，你只需描述当前数据下界面应该是什么样子，屏幕上具体要改哪里由框架负责。要更新屏幕，你只需修改数据；依赖这份数据的组件会重新运行，声明出新的界面。理解了这一点，其余的 API 也就顺理成章了。

## 按当前数据描述界面

组件是一个接收数据、声明界面的函数。数据变化时，Tessera 会再次调用这个函数，这个过程叫作*重建*，新的声明会取代旧的声明。屏幕始终来自最新的声明，因此和数据保持一致。Tessera 只重建可能发生变化的部分，所以重新描述整个组件的开销很小。

## 组件就是函数

给 Rust 函数标注 `#[tessera]`，它就成了组件。非可选参数是调用时必须传入的参数；`Option<T>` 参数会生成具名的构建器 setter，默认值在函数体内决定：

```rust
use tessera_components::text::text;
use tessera_ui::tessera;

#[tessera]
fn greeting(#[prop(into)] name: String, excited: Option<bool>) {
    let mark = if excited.unwrap_or(false) { "!" } else { "." };
    text(format!("Hello, {name}{mark}"));
}

#[tessera]
fn greeting_demo() {
    greeting("Ada").excited(true);
}
```

这段代码有几点值得留意：

- 函数没有返回值：调用 `text(...)` 就是在 `greeting` 中声明一个文本元素。
- `#[prop(into)]` 允许调用方传入任何可以转换成属性类型的值，所以需要 `String` 的地方可以直接写 `"Ada"`。
- 默认值写在函数体内。把参数声明为 `Option<T>`，在函数体里决定默认值，就像 `excited.unwrap_or(false)` 这样。
- 属性拥有自己的数据，所以请传入拥有所有权的字符串和稳定的句柄。Tessera 要靠比较属性来决定子组件是否需要重新运行，因此属性类型都实现了 `Clone` 和 `PartialEq`。

这些示例是运行在应用内部、位于其 `material_theme()` 之下的组件。完整的根组件见[介绍](/zhHans/guide/)，主题本身见 [Material 3 主题](/zhHans/guide/theming)。

## 动态内容就是普通的 Rust

组件是普通函数，控制流自然也用普通的 Rust 来写。循环为每一项声明一个元素，`if` 决定某个元素是否存在：

```rust
use tessera_components::{column::column, text::text};
use tessera_ui::tessera;

#[tessera]
fn greetings(names: Vec<String>) {
    column().children(move || {
        for name in &names {
            text(format!("Hello, {name}"));
        }
    });
}
```

如果列表项可以重新排序，而且各自带有状态，就要给每一项一个 key，让状态跟着条目走，原因见[生命周期与副作用](/zhHans/guide/lifecycle#用-key-标识列表项)。

## 一次调用声明一次使用

调用组件会立即登记该组件的一次使用，并返回一个带类型的配置句柄。组件体在同一次构建中稍后运行，也就是 Tessera 展开这些声明的时候，之后才进入布局和绘制。

调用的先后就是它们在树中的先后。setter 配置还在等待执行的那次使用，它的位置保持不变：

```rust
use tessera_components::{row::row, text::text};
use tessera_ui::{Dp, tessera};

#[tessera]
fn heading() {
    row().children(|| {
        let title = text("Title");
        let description = text("Description");
        description.size(Dp(14.0));
        title.size(Dp(24.0));
    });
}
```

虽然先配置的是 Description，Title 仍然排在前面。即使移动、保存或丢弃句柄，这次使用也会保留原来的位置并照常发生。通常直接链式调用，但也可以交给普通的 Rust 辅助函数来配置句柄。

句柄只在对应的使用还未执行时可以配置。这次使用一旦开始执行，属性就固定下来，再调用 setter 会 panic。展开渲染槽可能会提前提交同一次构建中更早的声明，所以请在创建句柄后立即配置它。句柄只描述一次构建，因此只在这次构建内部使用它：即使组件身份和记住的状态都没变，下一次构建也会创建新的句柄。需要长期保存的东西请交给[状态](/zhHans/guide/state)和控制器。

## 组合组件

要定制组件，就把它包进另一个组件里，再把内容传进去。容器以构建闭包的形式接收子内容，你自己的组件也可以借助 `RenderSlot` 做到这一点：

```rust
use tessera_components::{column::column, text::text};
use tessera_ui::{RenderSlot, tessera};

#[tessera]
fn section(#[prop(into)] title: String, child: Option<RenderSlot>) {
    column().children(move || {
        text(title.clone());
        if let Some(child) = child {
            child.render();
        }
    });
}

#[tessera]
fn page() {
    section("Account").child(|| text("Ada"));
}
```

是否展开槽、在哪里展开、在什么上下文中展开，都由父组件决定。槽只有在渲染时才会声明其中的内容。如果内容需要从父组件拿到一个值，请使用 `RenderSlotWith<T>`。

子内容是一个闭包，在槽展开时调用组件。组件句柄是一条已经在调用处占好位置的声明，所以要把组件放进容器，就在容器的闭包里调用它。通常直接传闭包即可；只有内容需要独立保存或转发时，才构造 `RenderSlot::new(...)`，再通过对应的 `_shared` setter 传入。

## 数据向下流，事件向上传

组件通过属性接收数据，通过回调报告发生了什么。回调属性声明为 `Callback`；需要带参数时用 `CallbackWith<T, R>`：

```rust
use tessera_components::{button::button, text::text};
use tessera_ui::{Callback, tessera};

#[tessera]
fn click_counter(clicks: u32, on_click: Option<Callback>) {
    button()
        .on_click(move || {
            if let Some(on_click) = on_click {
                on_click.call();
            }
        })
        .child(move || text(format!("Clicked {clicks} times")));
}
```

`click_counter` 显示传进来的数字，并在被点击时通知调用方；计数由调用方完成。调用方更新自己的状态，Tessera 重建读取了该状态的部分，`click_counter` 带着新数字再次运行。调用方那一侧的写法见[状态](/zhHans/guide/state#把状态提升给调用方)。

`Callback::call()` 不接收参数；`CallbackWith<T, R>::call(value)` 接收一个 `T`，返回 `R`，`R` 默认为 `()`。生成的 setter 接收闭包，`_shared` setter 接收已有的回调句柄。保存下来的回调和槽要求捕获的值拥有所有权，并满足 `Send + Sync + 'static`。动作需要当前数据时，请捕获 `State<T>` 句柄，在动作执行时再读取，这样动作拿到的总是最新的值。

## 重建是怎么发生的

组件在构建时读取过的状态发生变化后，Tessera 会把这个组件标记为需要重建，并只再次运行它的函数体。只负责传递句柄的父组件保持不动；父组件重建时，如果某个子组件的属性比较结果相等、自身也不需要重建，就可以整个跳过。属性变化同样可能让子组件重新运行，即使它读取的状态没有变化。构建之后发生的事情见[渲染阶段与性能](/zhHans/guide/rendering)。

这对组件体的写法有几点要求：

- **函数体可能运行很多次，也可能一次都不运行。** 运行几次由 Tessera 根据变化情况决定。函数体要能重复执行：在这里计算值、声明子组件。网络请求、写文件这类工作从动作或初始化闭包中启动，见[副作用应该放在哪里](/zhHans/guide/lifecycle#在构建之外执行副作用)；放在函数体里的工作，包括统计调用次数，会随着重建情况被重复执行或被跳过。
- **通过属性和状态传递数据。** 同级组件按声明顺序排列，但某个函数体在某次重建中是否运行，取决于哪些部分需要更新，所以在一个函数体中写入的状态，只有当另一个函数体恰好在之后运行时才会被它看到。构建期间的写入还会让已经用旧值运行过的读取者再重建一次。
- **只在构建上下文中构建界面。** 组件和受认可的构建闭包（子内容 setter、渲染槽，以及 `EntryPoint::new` 这类根回调）用来声明界面，在构建中写普通的 `for` 循环也可以。事件回调、传给 `map` 等迭代器适配器的闭包，以及普通辅助函数都在这个上下文之外。动作修改状态，下一次构建再声明新的界面。

`cargo tessera check` 会检查这些调用边界。辅助函数只有标注了属性宏才是组件，被组件调用也一样，所以凡是声明界面的辅助函数，都应标注 `#[tessera]`。

## 进阶属性

宏也支持泛型组件。`#[prop(skip_setter)]` 会在构建器中隐藏内部存储字段；`#[prop(skip_eq)]` 会把字段排除在前面提到的属性比较之外，只有在跳过比较不会掩盖真实的界面变化时才应使用。

## 下一步

组件持有会变化的数据后才真正有意思。接着阅读[状态](/zhHans/guide/state)。
