---
title: 快速开始
description: 安装 cargo-tessera，创建新项目，并在桌面、浏览器或手机上运行起来。
---

# 快速开始

三条命令就能在桌面上打开一个 Tessera 窗口。项目建好后，同一份代码也可以直接跑到浏览器和手机上。

## 准备环境

Tessera 需要 **Rust 1.98 或更高版本**（`cargo-tessera` 声明的最低版本），以及当前系统的原生链接器和构建工具。如果要跑其他平台，还需要对应的环境：

- **Web**：支持 WebGPU 的浏览器；打发布包还需要 Binaryen 110+，且 `wasm-opt` 在 `PATH` 中。
- **Android**：Android SDK 与 NDK、Gradle 所需的 JDK，以及真机或模拟器。
- **iOS**：装有 Xcode 的 macOS。

各系统具体的系统库依赖（如 Linux 下的窗口和键盘库）见[目标平台](/zhHans/guide/platforms)。

先用 Cargo 安装命令行工具：

```sh
cargo install cargo-tessera --locked
```

`cargo-tessera` 作为 Cargo 子命令工作，后面所有操作都以 `cargo tessera` 开头。

## 创建并运行项目

用 `basic` 模板建一个新应用，并启动桌面热重启开发循环：

```sh
cargo tessera new my-app --template basic
cd my-app
cargo tessera dev
```

很快就会弹出一个窗口，铺满窗口的背景上写着 `Hello Tessera!`。另一个 `blank` 模板结构完全相同，只是画面里面是空的。两个模板都已经配好了 `tessera-ui`、`tessera-foundation` 和 `tessera-components`，注册了 `ComponentsPackage`，并在根组件外包了一层 `material_theme()`。不写项目名或 `--template` 时，CLI 会交互式让你选。

除非特别说明，整本手册的例子都默认基于 `basic` 模板，你写界面时主要改 `src/app.rs`。项目里其他文件的作用见[项目结构](/zhHans/guide/project-structure)。

## 修改代码并自动重跑

`cargo tessera dev` 会盯着 `src/`、`Cargo.toml`、`build.rs`、`tessera-app.toml`、`tessera-config.toml`、应用图标和资源目录。只要其中任何一个改动，它就会重新做边界检查、编译并重启桌面窗口。

每次重启都是新进程，所以运行时内存里的状态会回到初始值。要是改出了编译错误或检查报错，修好再保存就行，`dev` 会留在后台等你的下一次保存。

现在就可以把 `src/app.rs` 换成[介绍](/zhHans/guide/)里的计数器代码，保存文件看看窗口变化。

## 在其他平台上跑起来

### 浏览器（WebGPU）

先添加一次 `wasm32-unknown-unknown` 目标，再启动本地 Web 开发服务：

```sh
rustup target add wasm32-unknown-unknown
cargo tessera web dev
```

命令会编译 WebAssembly，在 `http://127.0.0.1:8000` 启动静态服务并尝试打开默认浏览器。它同样会监听源码变化并自动重编，编完手动刷新页面就能看到新界面。想换端口就加 `--port 8080`。新项目默认带有 `gen/web/index.html`；如果是给老项目补 Web 支持，先跑一遍 `cargo tessera web init`。

### Android

配好 Android SDK、NDK 和 Java 后，先初始化一次 Gradle 宿主，再推到设备上跑：

```sh
cargo tessera android init
cargo tessera android dev --device DEVICE_ID
```

`android init` 会顺便装好 Rust 的 Android 编译目标（加 `--skip-targets-install` 可跳过）。`DEVICE_ID` 就是 `adb devices` 输出的设备编号。`android dev` 也会监听改动，保存后自动重编、重新安装并拉起应用。

### iOS

在装了 Xcode 的 macOS 上，可以构建 iOS 模拟器用的 `.app`：

```sh
cargo tessera ios build
```

注意它不是监听模式，编完一次包就退出；加 `--device` 可以打出真机用的 IPA。签名和 bundle 配置见[打包与发布](/zhHans/guide/distribution#ios)。

## 静态检查与自动修复

提交代码前，习惯性跑一遍检查：

```sh
cargo tessera check
```

它会先做 Tessera 的调用边界与所有权检查（比如拦住你在按钮回调里误调用组件或 `remember`），再跑 `cargo check`。这些规则背后的原因见[Tessera 的思维方式](/zhHans/guide/thinking-in-tessera#调用边界与静态检查)。如果想让工具把可自动修复的建议直接改好，执行：

```sh
cargo tessera fix
```

在多包工作区里，用 `-p my-app` 指定要检查的包。如果你用编程 Agent 写代码，还可以执行 `cargo tessera skill --local` 或 `--global`，把官方的 `tessera-good-taste` 开发指引装进工作目录或主目录。

## 下一步

想直接动手写点东西，打开[教程：购物清单](/zhHans/guide/tutorial)，从这个模板一步步做出一个完整的小应用；想先摸清脚手架里每个文件的用途，去看[项目结构](/zhHans/guide/project-structure)。
