---
title: 教程：购物清单
description: 从 basic 模板出发，分六步改出一个能增删、勾选、滚动和切换深色模式的购物清单应用。
---

# 教程：购物清单

这一篇带你把 `basic` 模板一步步改造成一个能用的购物清单：支持输入添加、勾选、删除，列表变长后可以滚动，还能切深色主题。每一步只改 `src/app.rs` 里的一小块，跑起来看到效果后，再顺手附上深入讲解的章节链接。

## 准备工程

按[快速开始](/zhHans/guide/getting-started)建好项目并开启桌面热重启：

```sh
cargo tessera new groceries --template basic
cd groceries
cargo tessera dev
```

写代码期间让 `cargo tessera dev` 一直跑在终端里。每次保存 `src/app.rs`，它都会重编并重启窗口（因为是新进程，刚才输入的数据会重置，属于正常现象）。

打开 `src/app.rs`，模板默认是这样的：

```rust
use tessera_components::{
    surface::surface,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_foundation::modifier::ModifierExt as _;
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

从外往里看：`material_theme()` 为整棵子树提供主题配置，`surface()` 铺满窗口并画上主题背景色，`text` 显示问候语。容器通过闭包接收子内容，所以一层层用 `.child(|| { ... })` 套起来。

## 第 1 步：写自己的第一个组件

组件就是加上 `#[tessera]` 的 Rust 函数。先写一个显示单个条目名字的 `grocery_item`，把原来的问候语换掉：

```rust
use tessera_components::{
    surface::surface,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_foundation::modifier::ModifierExt as _;
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

保存后，窗口里会显示 “Milk”。

因为 `name` 是普通的 `String` 而不是 `Option<String>`，调用 `grocery_item` 时必须传入这个参数；加上 `#[prop(into)]` 后，调用处就能直接写 `&str` 字面量。调用 `grocery_item("Milk")` 并不是马上画像素，而是向 Tessera 声明“这个位置要放一个 `grocery_item`”，框架会在构建界面时展开它。背后的规则见[Tessera 的思维方式](/zhHans/guide/thinking-in-tessera)。

## 第 2 步：用列把条目排开

清单不能只有一条。把页面内容拆到单独的 `grocery_screen` 里，用 `column` 把标题和几条商品竖着排好：

```rust
use tessera_components::{
    column::column,
    spacer::spacer,
    surface::surface,
    text::text,
    theme::{MaterialTheme, material_theme},
};
use tessera_foundation::modifier::ModifierExt as _;
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

保存之后就能看到标题 “Groceries”，下面依次排着三行条目，四周与窗口边缘隔开 16 dp。

`column` 按代码里的调用顺序从上到下排列子组件。尺寸和留白由 `Modifier` 链控制：列填满窗口并留出外边距，定高的 `spacer` 在标题下方留空隙，每个条目上下各留 12 dp 内边距。尺寸单位 `Dp` 会自动按屏幕缩放系数换算成像素。把 `grocery_screen` 拆出来，也是为了第 6 步让 `app` 专心管全局主题。细节见[布局基础](/zhHans/guide/layout)和[修饰符](/zhHans/guide/modifiers)。

## 第 3 步：接上输入框和添加按钮

真用的清单应该从空开始，让用户输入添加。我们需要三样东西：保存清单的状态、一个文本框，以及把输入放进列表并清空输入框的动作。更新 `src/app.rs`：

```rust
use tessera_components::{
    alignment::CrossAxisAlignment,
    boxed::boxed,
    button::button,
    column::column,
    row::row,
    spacer::spacer,
    surface::surface,
    text::text,
    text_field::text_field,
    text_input::TextInputController,
    theme::{MaterialTheme, material_theme},
};
use tessera_foundation::modifier::ModifierExt as _;
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
                    boxed()
                        .modifier(Modifier::new().weight(1.0))
                        .children(move || {
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

现在输完名字点 **Add** 或直接按回车，条目就会插到下面，输入框同时清空。

因为每次重建都会重新运行组件函数，普通的局部 `Vec` 一重建就丢了；`remember` 会把值留在状态槽里，并返回一个可以廉价复制的 `State<T>` 句柄。`column` 的闭包里调用了 `items.get()`，所以往 `items` 写入新条目后，这段界面会自动重建。详见[状态与共享](/zhHans/guide/state)。

输入框内部文字由 `TextInputController` 管理，自己 `remember` 一个控制器传进去，外部动作才能读内容和清空内容。这里把 `add` 包装成 `Callback::new`，是因为按钮点击和文本框回车提交都要用同一个回调，直接传给各自的 `_shared` setter 即可。输入行里给外层 `boxed` 加了 `.weight(1.0)`，让它吃掉按钮和间隔之外的全部剩余宽度，里面的 `text_field` 再用 `fill_max_width()` 填满这个盒子。

循环里用 `key(item.id, ...)` 把每一行绑到条目的 `id` 而不是循环下标上，这样下一步加入删除功能时，状态不会错位。相关机制见[身份、生命周期与副作用](/zhHans/guide/lifecycle)和[文本与文本输入](/zhHans/guide/text)。

## 第 4 步：加上勾选与删除

接下来给每个条目加 `done` 字段、复选框和删除图标按钮。更新导入、`Grocery` 和 `grocery_item`，再补两个修改列表的辅助函数：

```rust
use tessera_components::{
    alignment::CrossAxisAlignment,
    boxed::boxed,
    button::button,
    checkbox::checkbox,
    column::column,
    icon_button::icon_button,
    material_icons::filled,
    row::row,
    spacer::spacer,
    surface::surface,
    text::text,
    text_field::text_field,
    text_input::TextInputController,
    theme::{MaterialTheme, material_theme},
};
use tessera_foundation::modifier::ModifierExt as _;
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
            checkbox(item.done)
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

然后把 `grocery_screen` 里的 `add` 改成推入 `Grocery { id, name, done: false }`，并把末尾的 `for` 循环替换成：

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

保存后，每一行左边多了一个复选框，右边多了一个垃圾桶图标按钮。

注意 `grocery_item` 自己不存状态：它只接收当前的 `item`，把勾选和删除事件通过回调往上交，列表的唯一数据源依然留在 `grocery_screen`。这就是**状态提升**。另外，必填的回调参数（比如这里的 `Callback` 和 `CallbackWith<bool>`）在调用时可以直接传普通闭包；`checkbox(item.done)` 也是把当前勾选值作为必填参数直接传入。给纯图标按钮加上 `accessibility_label`，读屏软件和 UI 测试就能准确识别它。详见[状态与共享](/zhHans/guide/state#把状态提升给调用方)与[语义与无障碍](/zhHans/guide/accessibility)。

## 第 5 步：用惰性列表支持长列表滚动

连续添加十几条之后，下面的条目就会顶出窗口底部：`column` 会把所有子组件一股脑全建出来。把 `for` 循环换成 `lazy_column`，不仅能滚动，还只构建视口里看得见的那几行。在 `tessera_components` 导入里加上 `lazy_list::lazy_column`，把 `tessera_ui` 导入里的 `key` 删掉（惰性列表自己带 key 方法），然后替换循环：

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

条目超出屏幕后，可以用滚轮或触摸上下滚动，上面的标题和输入行固定在原位。

可滚动列表在滚动方向上必须有有限的高度，否则就不知道视口到哪里算满。这里 `.weight(1.0)` 把外层铺满窗口的 `column` 剩下的高度全分给了 `lazy_column`。第二个闭包返回每个条目的唯一 `id` 作为 key；而列表数据保存在上层 `grocery_screen` 里，所以条目滑出屏幕再滑回来时，勾选状态依然在。更多用法见[列表、网格与滚动](/zhHans/guide/lists)。

## 第 6 步：换一套主题并支持深色模式

目前应用还在用默认的浅色配色。最后我们选一个绿色种子生成主题，给标题套上 Material 排版样式，再在右上角放一个深色模式开关。在 `app` 里记住 `dark` 状态，用它生成主题并向下传递：

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

把 `grocery_screen` 改成接收 `dark: State<bool>`，用 `use_context::<MaterialTheme>()` 取出标题字体，并在标题右侧加上切换按钮：

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
                    boxed()
                        .modifier(Modifier::new().weight(1.0))
                        .children(move || {
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

别忘了在 `tessera_ui` 导入里加上 `Color` 和 `use_context`。保存后，控件全换成了绿色系，标题也醒目多了，点一下右上角的月亮图标就能在浅色和深色之间切换。主题系统的更多细节见[Material 3 主题与视觉样式](/zhHans/guide/theming)。

## 完整的 `src/app.rs`

::: details 展开查看完整 src/app.rs
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
    row::row,
    spacer::spacer,
    surface::surface,
    text::text,
    text_field::text_field,
    text_input::TextInputController,
    theme::{MaterialTheme, material_theme},
};
use tessera_foundation::modifier::ModifierExt as _;
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
            checkbox(item.done)
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
                    boxed()
                        .modifier(Modifier::new().weight(1.0))
                        .children(move || {
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

提交前跑一下 `cargo tessera check`，确认调用边界和编译都通过。

## 下一步

到这里你已经把 Tessera 最核心的几块积木都过了一遍。接着去读[Tessera 的思维方式](/zhHans/guide/thinking-in-tessera)和[状态与共享](/zhHans/guide/state)，把刚写下的代码背后的机制串起来；想找更多现成控件，随时翻[组件 API 参考](https://tessera-ui.github.io/tessera/tessera_components/)。
