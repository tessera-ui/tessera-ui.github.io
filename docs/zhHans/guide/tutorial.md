---
title: 教程
description: 从 basic 模板出发，一步步做出一个小小的购物清单应用。
---

# 教程

这篇教程带你把 `basic` 模板改造成一个购物清单：可以添加条目、勾选、删除，列表很长时能滚动，还能切换到深色主题。每一步只改动 `src/app.rs` 的一小部分，告诉你屏幕上会出现什么变化，并链接到深入讲解相关概念的页面。你可以先一路做下去，之后再回头细看。

## 准备工作

按照[快速开始](/zhHans/guide/getting-started)的说明，用 `basic` 模板创建项目并启动开发循环：

```sh
cargo tessera new groceries --template basic
cd groceries
cargo tessera dev
```

写代码时让 `dev` 一直运行。每次保存文件，它都会重新构建并重启应用。因为进程会重启，每次保存后应用都会重新开始，你在应用里输入的内容也会清空，这是正常现象。

打开 `src/app.rs`，模板里的内容是这样的：

```rust
use tessera_components::{
    modifier::ModifierExt as _,
    surface::surface,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_ui::{Modifier, tessera};

#[tessera]
pub fn app() {
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(|| {
            surface()
                .modifier(Modifier::new().fill_max_size())
                .child(|| {
                    text("Hello Tessera!");
                });
        });
}
```

从外往里读：`material_theme()` 为内部的所有内容提供 Material 主题，后面加入的 Material 控件都依赖它；`surface()` 铺满窗口，并绘制主题的背景色；`text` 显示问候语。容器通过闭包接收子内容，所以每一层都写成 `.child(|| { ... })`。

## 第 1 步：编写自己的组件

组件就是标注了 `#[tessera]` 的 Rust 函数。为单个购物条目写一个组件，并用它替换问候语：

```rust
use tessera_components::{
    modifier::ModifierExt as _,
    surface::surface,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_ui::{Modifier, tessera};

#[tessera]
pub fn app() {
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(|| {
            surface()
                .modifier(Modifier::new().fill_max_size())
                .child(|| {
                    grocery_item("Milk");
                });
        });
}

#[tessera]
fn grocery_item(#[prop(into)] name: String) {
    text(name);
}
```

原来显示问候语的地方现在显示“Milk”。

`name` 的类型是普通的 `String`，因此它是 `grocery_item` 的必填参数。`#[prop(into)]` 允许调用方传入任何能转换成 `String` 的值，比如这里的 `&str` 字面量。调用 `grocery_item("Milk")` 声明的是这个组件出现在树中的这个位置，Tessera 在构建界面时执行它。[Tessera 的思维方式](/zhHans/guide/thinking-in-tessera)讲解了这套模型。

## 第 2 步：用列排列条目

清单需要多个条目。把整个界面移到单独的 `grocery_screen` 组件里，用 `column` 把标题和几个条目竖着排列：

```rust
use tessera_components::{
    column::column,
    modifier::ModifierExt as _,
    spacer::spacer,
    surface::surface,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_ui::{Dp, Modifier, tessera};

#[tessera]
pub fn app() {
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(|| {
            surface()
                .modifier(Modifier::new().fill_max_size())
                .child(|| {
                    grocery_screen();
                });
        });
}

#[tessera]
fn grocery_screen() {
    column()
        .modifier(Modifier::new().fill_max_size().padding_all(Dp(16.0)))
        .children(|| {
            text("Groceries");
            spacer().modifier(Modifier::new().height(Dp(8.0)));
            grocery_item("Milk");
            grocery_item("Eggs");
            grocery_item("Bread");
        });
}

#[tessera]
fn grocery_item(#[prop(into)] name: String) {
    text(name).modifier(Modifier::new().padding_symmetric(Dp(0.0), Dp(12.0)));
}
```

现在你会看到标题“Groceries”，下面是三个条目，内容与窗口边缘相隔 16 dp。

`column` 按声明顺序从上到下放置子组件。尺寸和间距由 `Modifier` 链决定：列铺满整个 surface 并为内容留出内边距，固定高度的 `spacer` 留出一段空隙，每个条目都有上下内边距，行与行之间留有空间。尺寸用 `Dp` 表示，Tessera 会按屏幕密度换算成像素。把 `grocery_screen` 拆出来以后，`app` 只负责应用级的设置，第 6 步就会用到这一点。详见[布局基础](/zhHans/guide/layout)和[修饰符](/zhHans/guide/modifiers)。

## 第 3 步：用文本框添加条目

真正的清单一开始是空的，随着输入逐渐变长。为此需要三样东西：保存条目的状态、一个文本框，以及把文本框内容放进清单的操作。把 `src/app.rs` 替换为：

```rust
use tessera_components::{
    alignment::CrossAxisAlignment,
    boxed::boxed,
    button::button,
    column::column,
    modifier::ModifierExt as _,
    row::row,
    spacer::spacer,
    surface::surface,
    text::text,
    text_field::text_field,
    text_input::TextInputController,
    theme::{MaterialTheme, material_theme},
};
use tessera_ui::{Callback, Dp, Modifier, key, remember, tessera};

#[tessera]
pub fn app() {
    material_theme()
        .theme(|| MaterialTheme::default())
        .child(|| {
            surface()
                .modifier(Modifier::new().fill_max_size())
                .child(|| {
                    grocery_screen();
                });
        });
}

#[tessera]
fn grocery_item(#[prop(into)] name: String) {
    text(name).modifier(Modifier::new().padding_symmetric(Dp(0.0), Dp(12.0)));
}

#[derive(Clone, PartialEq)]
struct Grocery {
    id: u64,
    name: String,
}

#[tessera]
fn grocery_screen() {
    let items = remember(Vec::<Grocery>::new);
    let next_id = remember(|| 0_u64);
    let editor = remember(|| TextInputController::new(Dp(16.0), Some(Dp(24.0))));

    let add = Callback::new(move || {
        let name = editor.with(|editor| editor.text()).trim().to_string();
        if name.is_empty() {
            return;
        }
        let id = next_id.get();
        next_id.set(id + 1);
        items.with_mut(|items| items.push(Grocery { id, name }));
        editor.with_mut(|editor| editor.set_text(""));
    });

    column()
        .modifier(Modifier::new().fill_max_size().padding_all(Dp(16.0)))
        .children(move || {
            text("Groceries");
            spacer().modifier(Modifier::new().height(Dp(8.0)));
            row()
                .modifier(Modifier::new().fill_max_width())
                .cross_axis_alignment(CrossAxisAlignment::Center)
                .children(move || {
                    boxed().modifier(Modifier::new().weight(1.0)).children(move || {
                        text_field()
                            .modifier(Modifier::new().fill_max_width())
                            .controller(editor)
                            .label("Add an item")
                            .on_submit_shared(add);
                    });
                    spacer().modifier(Modifier::new().width(Dp(8.0)));
                    button().on_click_shared(add).child(|| text("Add"));
                });
            for item in items.get() {
                key(item.id, || {
                    grocery_item(item.name);
                });
            }
        });
}
```

清单现在从空开始，标题下方出现了一个文本框，旁边是 Add 按钮。输入名称后点击 Add 或按回车，条目就会出现在下方，文本框随之清空。

组件函数在每次重建时都会重新执行，普通的局部 `Vec` 每次都会从空开始。`remember` 让值在重建之间保留下来，并返回一个 `State` 句柄。它的初始化函数只在状态首次创建时运行一次。列的内容在构建时读取了 `items`，所以操作写入 `items` 之后，这部分内容会带着新列表重建。[状态](/zhHans/guide/state)一页有详细说明。

文本框把文字保存在 `TextInputController` 中。自己用 `remember` 保存一个控制器，而不是让文本框自行创建，操作才能读取并清空其中的文字。`Callback::new` 把操作包装成一个在重建之间保持不变的句柄，按钮和文本框的回车键因此可以通过各自的 `_shared` setter 共用它。在这一行里，`weight(1.0)` 把按钮和间隔用剩的宽度全部交给外面那层 box，文本框再填满这层 box。

最后，`key(item.id, ...)` 让每一行与条目的 id 绑定，无论条目在列表中的什么位置。下一步就会用到它：条目可以删除之后，它能保证每一行始终对应正确的条目。[生命周期与副作用](/zhHans/guide/lifecycle)解释了身份与 key，[文本与文本输入](/zhHans/guide/text)介绍了文本框及其控制器。

## 第 4 步：勾选和删除条目

接下来给每个条目加上复选框和删除按钮。条目需要一个 `done` 标记，`grocery_item` 也需要某种方式把用户的操作告诉外面。更新导入、`Grocery` 结构体和 `grocery_item`，再添加两个修改列表的小函数：

```rust
use tessera_components::{
    alignment::CrossAxisAlignment,
    boxed::boxed,
    button::button,
    checkbox::checkbox,
    column::column,
    icon_button::icon_button,
    material_icons::filled,
    modifier::ModifierExt as _,
    row::row,
    spacer::spacer,
    surface::surface,
    text::text,
    text_field::text_field,
    text_input::TextInputController,
    theme::{MaterialTheme, material_theme},
};
use tessera_ui::{Callback, CallbackWith, Dp, Modifier, State, key, remember, tessera};

#[derive(Clone, PartialEq)]
struct Grocery {
    id: u64,
    name: String,
    done: bool,
}

fn set_done(items: State<Vec<Grocery>>, id: u64, done: bool) {
    items.with_mut(|items| {
        if let Some(item) = items.iter_mut().find(|item| item.id == id) {
            item.done = done;
        }
    });
}

fn remove(items: State<Vec<Grocery>>, id: u64) {
    items.with_mut(|items| items.retain(|item| item.id != id));
}

#[tessera]
fn grocery_item(item: Grocery, on_checked_change: CallbackWith<bool>, on_delete: Callback) {
    row()
        .modifier(Modifier::new().fill_max_width())
        .cross_axis_alignment(CrossAxisAlignment::Center)
        .children(move || {
            checkbox()
                .checked(item.done)
                .accessibility_label(item.name.clone())
                .on_toggle_shared(on_checked_change);
            text(item.name.clone()).modifier(Modifier::new().weight(1.0));
            icon_button()
                .standard()
                .icon(filled::DELETE_SVG)
                .accessibility_label(format!("Delete {}", item.name))
                .on_click_shared(on_delete);
        });
}
```

在 `grocery_screen` 中，`add` 操作现在要推入 `Grocery { id, name, done: false }`。然后把列末尾的 `for` 循环换成下面这段，为每个条目传入回调：

```rust
            for item in items.get() {
                let id = item.id;
                key(id, || {
                    grocery_item(
                        item,
                        move |done| set_done(items, id, done),
                        move || remove(items, id),
                    );
                });
            }
```

现在每一行前面有一个复选框，末尾有一个垃圾桶按钮。勾选条目会打上对勾，点击垃圾桶则删除这一行。

`grocery_item` 接收要显示的条目和两个回调，通过回调上报事件；列表归 `grocery_screen` 所有，由它决定事件意味着什么。这种做法叫作状态提升：数据只有一份，复选框和列表始终一致。复选框本身也是受控的：`checked` 来自数据，`on_toggle` 把新值交回持有数据的上层。

像 `on_delete: Callback` 这样的必填回调参数，在调用处可以直接传闭包。这些闭包捕获的是 `items`（一个可以廉价复制的句柄）和 `id`，用到的值都归闭包自己所有。删除按钮只显示图标，所以用 `accessibility_label` 给它一个读屏软件能念出来的名字。状态提升见[状态](/zhHans/guide/state)，操作见[手势与交互](/zhHans/guide/interaction)，标注方式见[无障碍](/zhHans/guide/accessibility)。

## 第 5 步：让长列表滚动

加上十几个条目，最后几项就会超出窗口底部：`column` 会把给它的内容按完整长度全部排出来，一直排到窗口边缘之外。把 `for` 循环换成 `lazy_column`，它可以滚动，而且只构建视口内的行。在 `tessera_components` 的导入中加上 `lazy_list::lazy_column`，从 `tessera_ui` 的导入中去掉 `key`（现在由列表负责 key），然后替换循环：

```rust
            lazy_column()
                .modifier(Modifier::new().fill_max_width().weight(1.0))
                .items_from_iter_with_key(
                    items.get(),
                    |_, item| item.id,
                    move |_, item| {
                        let id = item.id;
                        grocery_item(
                            item.clone(),
                            move |done| set_done(items, id, done),
                            move || remove(items, id),
                        );
                    },
                );
```

条目多到放不下时，列表可以用鼠标滚轮或触摸滚动，标题和文本框则固定不动。

滚动列表需要一个有限的高度作为滚动范围。`weight(1.0)` 把列在标题和输入行之后剩下的高度交给它；这之所以可行，是因为列本身铺满了窗口。第二个参数返回每个条目的 key，列表变化时，行会继续跟随自己的条目。即使有 key，行滚出视口后它的局部状态也会结束；这里的清单数据保存在 `grocery_screen` 中，所以滚动时每个条目的数据都完好保留。[列表与滚动](/zhHans/guide/lists)讲解了视口、key 和控制器。

## 第 6 步：为应用设置主题

应用仍在使用默认的浅色主题。现在给它换一种主色，加粗标题，再加一个深色模式开关。在 `app` 中保存深色模式标记，用它生成主题，并把标记传给界面：

```rust
#[tessera]
pub fn app() {
    let dark = remember(|| false);
    material_theme()
        .theme(move || MaterialTheme::from_seed(Color::from_rgb(0.2, 0.5, 0.25), dark.get()))
        .child(move || {
            surface()
                .modifier(Modifier::new().fill_max_size())
                .child(move || {
                    grocery_screen(dark);
                });
        });
}
```

`grocery_screen` 接收这个标记，从主题中读取标题样式，并在标题旁放一个切换按钮：

```rust
#[tessera]
fn grocery_screen(dark: State<bool>) {
    let title_style = use_context::<MaterialTheme>()
        .expect("grocery_screen needs a material_theme ancestor")
        .get()
        .typography
        .headline_small;
    let items = remember(Vec::<Grocery>::new);
    let next_id = remember(|| 0_u64);
    let editor = remember(|| TextInputController::new(Dp(16.0), Some(Dp(24.0))));

    let add = Callback::new(move || {
        let name = editor.with(|editor| editor.text()).trim().to_string();
        if name.is_empty() {
            return;
        }
        let id = next_id.get();
        next_id.set(id + 1);
        items.with_mut(|items| items.push(Grocery { id, name, done: false }));
        editor.with_mut(|editor| editor.set_text(""));
    });

    column()
        .modifier(Modifier::new().fill_max_size().padding_all(Dp(16.0)))
        .children(move || {
            row()
                .modifier(Modifier::new().fill_max_width())
                .cross_axis_alignment(CrossAxisAlignment::Center)
                .children(move || {
                    text("Groceries")
                        .style(title_style)
                        .modifier(Modifier::new().weight(1.0));
                    icon_button()
                        .standard()
                        .icon(filled::DARK_MODE_SVG)
                        .selected(dark.get())
                        .accessibility_label("Dark theme")
                        .on_click(move || dark.set(!dark.get()));
                });
            spacer().modifier(Modifier::new().height(Dp(8.0)));
            row()
                .modifier(Modifier::new().fill_max_width())
                .cross_axis_alignment(CrossAxisAlignment::Center)
                .children(move || {
                    boxed().modifier(Modifier::new().weight(1.0)).children(move || {
                        text_field()
                            .modifier(Modifier::new().fill_max_width())
                            .controller(editor)
                            .label("Add an item")
                            .on_submit_shared(add);
                    });
                    spacer().modifier(Modifier::new().width(Dp(8.0)));
                    button().on_click_shared(add).child(|| text("Add"));
                });
            lazy_column()
                .modifier(Modifier::new().fill_max_width().weight(1.0))
                .items_from_iter_with_key(
                    items.get(),
                    |_, item| item.id,
                    move |_, item| {
                        let id = item.id;
                        grocery_item(
                            item.clone(),
                            move |done| set_done(items, id, done),
                            move || remove(items, id),
                        );
                    },
                );
        });
}
```

在 `tessera_ui` 的导入中加上 `Color` 和 `use_context`。按钮、复选框和文本框都换成了绿色调，标题变大了，右上角的月亮按钮可以让整个应用在浅色和深色之间切换。

`MaterialTheme::from_seed` 从一个种子颜色推导出完整的配色方案，第二个参数决定使用浅色还是深色。主题闭包每次运行都会读取 `dark`，所以切换标记会重建主题，所有读取主题的组件随之更新。Tessera 不会自动跟随操作系统的深色模式，像这样用状态保存选择，就能把决定权交给用户。在界面内部，`use_context::<MaterialTheme>()` 读取最近的主题，标题因此用上了主题的 `headline_small` 样式。[Material 3 主题](/zhHans/guide/theming)介绍了颜色角色、字体排印和形状。

## 完成后的应用

完成最后一步后，`src/app.rs` 的完整内容如下：

::: details src/app.rs
```rust
use tessera_components::{
    alignment::CrossAxisAlignment,
    boxed::boxed,
    button::button,
    checkbox::checkbox,
    column::column,
    icon_button::icon_button,
    lazy_list::lazy_column,
    material_icons::filled,
    modifier::ModifierExt as _,
    row::row,
    spacer::spacer,
    surface::surface,
    text::text,
    text_field::text_field,
    text_input::TextInputController,
    theme::{MaterialTheme, material_theme},
};
use tessera_ui::{
    Callback, CallbackWith, Color, Dp, Modifier, State, remember, tessera, use_context,
};

#[derive(Clone, PartialEq)]
struct Grocery {
    id: u64,
    name: String,
    done: bool,
}

fn set_done(items: State<Vec<Grocery>>, id: u64, done: bool) {
    items.with_mut(|items| {
        if let Some(item) = items.iter_mut().find(|item| item.id == id) {
            item.done = done;
        }
    });
}

fn remove(items: State<Vec<Grocery>>, id: u64) {
    items.with_mut(|items| items.retain(|item| item.id != id));
}

#[tessera]
fn grocery_item(item: Grocery, on_checked_change: CallbackWith<bool>, on_delete: Callback) {
    row()
        .modifier(Modifier::new().fill_max_width())
        .cross_axis_alignment(CrossAxisAlignment::Center)
        .children(move || {
            checkbox()
                .checked(item.done)
                .accessibility_label(item.name.clone())
                .on_toggle_shared(on_checked_change);
            text(item.name.clone()).modifier(Modifier::new().weight(1.0));
            icon_button()
                .standard()
                .icon(filled::DELETE_SVG)
                .accessibility_label(format!("Delete {}", item.name))
                .on_click_shared(on_delete);
        });
}

#[tessera]
pub fn app() {
    let dark = remember(|| false);
    material_theme()
        .theme(move || MaterialTheme::from_seed(Color::from_rgb(0.2, 0.5, 0.25), dark.get()))
        .child(move || {
            surface()
                .modifier(Modifier::new().fill_max_size())
                .child(move || {
                    grocery_screen(dark);
                });
        });
}

#[tessera]
fn grocery_screen(dark: State<bool>) {
    let title_style = use_context::<MaterialTheme>()
        .expect("grocery_screen needs a material_theme ancestor")
        .get()
        .typography
        .headline_small;
    let items = remember(Vec::<Grocery>::new);
    let next_id = remember(|| 0_u64);
    let editor = remember(|| TextInputController::new(Dp(16.0), Some(Dp(24.0))));

    let add = Callback::new(move || {
        let name = editor.with(|editor| editor.text()).trim().to_string();
        if name.is_empty() {
            return;
        }
        let id = next_id.get();
        next_id.set(id + 1);
        items.with_mut(|items| items.push(Grocery { id, name, done: false }));
        editor.with_mut(|editor| editor.set_text(""));
    });

    column()
        .modifier(Modifier::new().fill_max_size().padding_all(Dp(16.0)))
        .children(move || {
            row()
                .modifier(Modifier::new().fill_max_width())
                .cross_axis_alignment(CrossAxisAlignment::Center)
                .children(move || {
                    text("Groceries")
                        .style(title_style)
                        .modifier(Modifier::new().weight(1.0));
                    icon_button()
                        .standard()
                        .icon(filled::DARK_MODE_SVG)
                        .selected(dark.get())
                        .accessibility_label("Dark theme")
                        .on_click(move || dark.set(!dark.get()));
                });
            spacer().modifier(Modifier::new().height(Dp(8.0)));
            row()
                .modifier(Modifier::new().fill_max_width())
                .cross_axis_alignment(CrossAxisAlignment::Center)
                .children(move || {
                    boxed().modifier(Modifier::new().weight(1.0)).children(move || {
                        text_field()
                            .modifier(Modifier::new().fill_max_width())
                            .controller(editor)
                            .label("Add an item")
                            .on_submit_shared(add);
                    });
                    spacer().modifier(Modifier::new().width(Dp(8.0)));
                    button().on_click_shared(add).child(|| text("Add"));
                });
            lazy_column()
                .modifier(Modifier::new().fill_max_width().weight(1.0))
                .items_from_iter_with_key(
                    items.get(),
                    |_, item| item.id,
                    move |_, item| {
                        let id = item.id;
                        grocery_item(
                            item.clone(),
                            move |done| set_done(items, id, done),
                            move || remove(items, id),
                        );
                    },
                );
        });
}
```
:::

提交代码前，运行 `cargo tessera check`。它会先检查组件是否只在可以构建界面的地方被调用，然后编译项目。

## 下一步

到这里，构成 Tessera 应用的大部分概念你都已经用过了。[Tessera 的思维方式](/zhHans/guide/thinking-in-tessera)讲解这些概念背后的模型，[状态](/zhHans/guide/state)进一步说明数据归谁所有、界面何时重建。想了解组件库还提供了哪些组件，可以浏览[组件 API 参考](https://tessera-ui.github.io/tessera/tessera_components/)或[在线演示](https://tessera-ui.github.io/tessera/example/)。
