---
title: 快速开始
description: 安装 Tessera CLI，创建项目，并在桌面、浏览器或手机上运行。
---

# 快速开始

只需几条命令，你就能在桌面上运行一个 Tessera 应用，并且每次保存文件它都会自动重新构建。之后，同一个项目还可以运行在浏览器或手机上。

## 安装工具

Tessera 需要 Rust 1.98 或更新版本，这是 `cargo-tessera` 声明的最低编译器版本；此外还需要当前操作系统的原生链接器和构建工具。每增加一个目标平台，还有各自的要求：

- **Web：** 支持 WebGPU 的浏览器。发布构建还需要 Binaryen 110 或更新版本，并且 `wasm-opt` 位于 `PATH` 中。
- **Android：** Android SDK 和 NDK、生成的 Gradle 项目所需的 Java，以及一台设备或模拟器。
- **iOS：** 装有 Xcode 的 macOS。

各平台的详细要求见[平台概览](/zhHans/guide/platforms)。装好 Rust 之后，安装 CLI：

```sh
cargo install cargo-tessera
```

CLI 以 Cargo 子命令的形式运行，所以本页的命令都以 `cargo tessera` 开头。

## 创建项目

用 `basic` 模板创建应用并启动：

```sh
cargo tessera new my-app --template basic
cd my-app
cargo tessera dev
```

随后会打开一个窗口，铺满窗口的 surface 上显示着 `Hello Tessera!`。另一个模板 `blank` 生成的项目与它相同，只是 surface 里是空的。两个模板都包含 `tessera-components`，都注册了 `ComponentsPackage`，并用 Material 主题包裹根组件。运行 `new` 时不带 `--template`，CLI 会让你选择模板；不带项目名，它也会提示你输入。

除非另有说明，这些指南中的示例都假定你使用 `basic` 模板。大部分时间你只会修改 `src/app.rs`，其余生成文件的作用见[项目结构](/zhHans/guide/project-structure)。

## 修改并重新运行

`cargo tessera dev` 会监视 `src/`、`Cargo.toml`、`build.rs`、`tessera-app.toml`、`tessera-config.toml`、应用图标和资源目录。其中任何一个发生变化，它都会重新构建并重启应用。

每次改动都会重启进程，所以应用会回到初始状态，从初始界面重新开始。如果构建失败，修复错误后再次保存即可，`dev` 会接着处理下一次修改。

不妨试一试：把 `src/app.rs` 替换为[介绍](/zhHans/guide/)中的计数器，然后保存。

## 在浏览器中运行

先添加一次 WebAssembly 目标，再启动 Web 开发服务器：

```sh
rustup target add wasm32-unknown-unknown
cargo tessera web dev
```

这条命令会构建项目，在 `http://127.0.0.1:8000` 上提供服务，并尝试用默认浏览器打开这个地址。它会持续监视并重新构建；每次重新构建后，手动刷新页面即可加载新版本。用 `--port 8080` 可以换一个端口。

新项目已经在 `gen/web/` 中包含了浏览器宿主页面。给缺少该页面的旧项目添加 Web 支持时，先运行 `cargo tessera web init`。浏览器中运行的是编译成 WebAssembly 的同一份组件代码；浏览器要求和字体加载见[平台概览](/zhHans/guide/platforms)。

## 在 Android 上运行

装好 Android SDK 和 NDK 后，先生成一次 Android 项目，然后在设备上运行：

```sh
cargo tessera android init
cargo tessera android dev --device DEVICE_ID
```

`android init` 还会安装 Rust 的 Android 目标，传入 `--skip-targets-install` 可以跳过这一步。设备标识使用 `adb devices` 列出的值。和桌面命令一样，`android dev` 会持续监视：源码变化时，它会重新构建应用、重新安装到设备上并重启。

## 为 iOS 构建

在装有 Xcode 的 macOS 上，为 iOS 模拟器构建应用：

```sh
cargo tessera ios build
```

这条命令构建一次应用包就退出；它不像 `dev` 那样监视源码并运行应用。加上 `--device` 则改为面向真机构建 IPA。签名方式和应用包的输出位置见[打包发布](/zhHans/guide/distribution)。

## 检查项目

提交代码之前，运行检查器：

```sh
cargo tessera check
```

它先检查 Tessera 的调用边界，再检查编译。边界规则很简单：在另一个组件或可识别的构建闭包中调用组件。`on_click` 这类普通事件回调运行在构建之外，它们修改状态，由下一次构建呈现结果。原因见 [Tessera 的思维方式](/zhHans/guide/thinking-in-tessera)。`cargo tessera fix` 会应用编译器和 Tessera 给出的可自动应用的修复建议，然后再检查一遍。

在工作区中，用 `-p my-app` 选择应用。lint 设置、性能分析和其他命令见[命令行参考](/zhHans/guide/cli)。

## 下一步

[教程](/zhHans/guide/tutorial)会从这个项目出发，一次一处改动，做出一个小应用。如果你想先了解生成的文件，请阅读[项目结构](/zhHans/guide/project-structure)。
