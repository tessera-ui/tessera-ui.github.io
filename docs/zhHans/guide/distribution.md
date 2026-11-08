---
title: 打包发布
description: 把 Tessera 应用构建成各平台的发布版本、安装包和可部署文件。
---

# 打包发布

应用可以交给用户时，`cargo tessera` 能把它变成用户拿得到的东西：发布版可执行文件、桌面安装包、Android APK 或应用包、iOS 应用，或者一个可以放到 Web 服务器上的目录。每个平台需要的工具不同，产物形式也不同，所以各有各的命令：

| 你需要 | 命令 | 构建环境 |
| --- | --- | --- |
| 原生可执行文件 | `cargo tessera build` | 任意桌面主机，构建本机目标，或已有工具链的 `--target` |
| 桌面安装包或应用包 | `cargo tessera package` | 目标操作系统本身 |
| APK 或 AAB | `cargo tessera android build` | 装有 Android SDK、NDK 和 Java 的主机 |
| 模拟器应用或 IPA | `cargo tessera ios build` | 装有 Xcode 的 macOS |
| 可部署的 Web 目录 | `cargo tessera web build` | 装有 `wasm32-unknown-unknown` 目标的主机 |

这些命令在不传 `--release` 时都使用调试配置，所以构建要发布的版本时，记得加上它。

## 设置应用标识

显示名称、标识符和图标在所有平台之间共用，只需在 `tessera-app.toml` 中设置一次：

```toml
name = "My App"
identifier = "com.example.myapp"
icon = "icon.svg"
```

打包时，各平台的图标都从这一个文件生成。图标可以是正方形 PNG，也可以是正方形 SVG；用 SVG 时，要把文字转成轮廓，并把引用的资源嵌进文件。Android 和 iOS 构建的版本号取自 `Cargo.toml` 中的 `version`。代码里的运行时默认配置也要与这份标识保持一致，见[应用入口与窗口](/zhHans/guide/app)。

## 构建原生可执行文件

`cargo tessera build` 会检查 Tessera 调用边界并编译应用。在工作区中用 `--package` 选择包；如果这个包有多个可执行文件，再用 `--bin` 指定其中一个：

```sh
cargo tessera build --package my-app --bin my_app --release
```

`--target` 选择 Rust 目标三元组，作用仅此而已：交叉编译工具链和目标平台的打包工具需要你自己安装。

原生构建默认把资源嵌入可执行文件。传入 `--asset-backend platform` 后，构建会把应用用到的资源复制到可执行文件旁边的资源目录，例如 `my_app.resources/tessera/`。发布这样的构建时，要把这个目录和可执行文件放在一起，因为应用会从那里读取资源。见[资源](/zhHans/guide/assets)。

## 打包桌面应用

`cargo tessera package` 先构建应用，再把应用标识、可执行文件和资源交给 `cargo-packager` 生成安装包。打包器只需安装一次：

```sh
cargo install cargo-packager --locked
cargo tessera package -p my-app --release
```

这个命令总是以平台资源后端构建，把暂存的 Tessera 资源一起打进安装包，并把结果写到 Cargo 目标目录下的 `packages/my-app/`。用 `--formats` 选择格式，多个格式之间用逗号分隔：

| 平台 | 格式 |
| --- | --- |
| Windows | `nsis`、`wix` |
| macOS | `app`、`dmg` |
| Linux | `deb`、`appimage`、`pacman` |

例如，在 Linux 打包主机上运行：

```sh
cargo tessera package -p my-app --release --formats deb,appimage
```

`default` 和 `all` 也可以用，命令会把它们原样传给 `cargo-packager`。请选择当前主机及已安装工具真正能生成的格式，各操作系统的格式要在该系统上生成。Android、iOS 和 Web 目标在这里会被拒绝，请改用下文各自的命令。

这个命令同样接受 `--target`、`--package` 和 `--bin`。Tessera 负责提供应用标识、选定的可执行文件、输出位置和生成的图标；其余配置，例如安装程序选项和元数据，来自 `Cargo.toml` 中的 `[package.metadata.packager]`。

::: warning 注意
请用平台自己的工具、你的凭据和打包配置完成签名与公证。命令不会替你获取证书，也不保证生成的安装包已经签名；用户下载未签名的应用时，macOS 和 Windows 通常会拦截或给出警告。
:::

## Android

先初始化一次 Android 宿主项目，之后按需构建产物：

```sh
cargo tessera android init
cargo tessera android build -p my-app --release --format apk --arch arm64
cargo tessera android build -p my-app --release --format aab --arch arm64
```

`--format` 可选 `apk` 或 `aab`，默认是 `apk`。`--arch` 选择 Android CPU 目标，默认是 `arm64`；传入 CLI 不认识的值时，错误信息会列出支持的选项。构建完成后，命令会打印每个产物的路径。构建前需要准备好 Android SDK、NDK 和 Java/Gradle 工具链，见[平台概览](/zhHans/guide/platforms)。

如果每次都用同样的参数构建，可以把默认值写进 `Cargo.toml`。命令行上的参数仍然优先：

```toml
[package.metadata.tessera.android]
arch = "arm64"
format = "aab"
min_sdk = 26
```

`min_sdk` 替换生成的最低 SDK，默认值是 `24`。运行时权限另行声明，见[声明 Android 权限](/zhHans/guide/plugins#声明-android-权限)。

::: warning 注意
在分发 APK 或上传 AAB 之前，请先在 Android 构建工具链中配置并验证签名。`--release` 只选择构建配置，这个命令也没有签名凭据参数。
:::

## iOS

iOS 打包只能在装有 Xcode 的 macOS 上进行。不加 `--device` 时，命令会按当前 Mac 对应的模拟器架构构建 `.app`：

```sh
cargo tessera ios build -p my-app --release
```

加上 `--device` 会生成 IPA。要让它能装到设备上，还要传入 Mac 上已安装的签名身份，以及与之匹配的描述文件：

```sh
cargo tessera ios build -p my-app --release --device \
  --signing-identity "Apple Development: Your Name (TEAMID)" \
  --provisioning-profile signing/app.mobileprovision
```

命令通过 `codesign` 签名；没有指定 `--signing-identity` 时使用临时签名（ad hoc）。要把 IPA 装到设备上或提交到 App Store，还取决于证书、描述文件、权限声明（entitlements）和提交流程，这些仍由你的项目负责。

产物位于 Cargo 目标目录下的 `packages/my-app/ios/`，按目标三元组分组。`--bin` 用于选择可执行文件。需要定制 bundle 时，可以在 `Cargo.toml` 中设置下面这些路径，它们都相对于应用包目录：

```toml
[package.metadata.tessera.ios]
info-plist = "ios/Info.plist"
asset-catalog = "ios/Assets.xcassets"
entitlements = "ios/app.entitlements"
resources = "ios/resources"
```

`info-plist` 中的键会合并进生成的 `Info.plist`，相机等权限的用途说明就写在这里。bundle 名称、标识符、版本和可执行文件名始终取自 `tessera-app.toml` 和 `Cargo.toml`，并覆盖你 plist 中的同名键。

## Web

要为项目加上浏览器支持，先初始化，再添加 Rust 的 Web 目标并构建：

```sh
rustup target add wasm32-unknown-unknown
cargo tessera web init -p my-app
cargo tessera web build -p my-app --release
```

CLI 会生成浏览器绑定并优化 WebAssembly 输出，所以 Web 发布构建需要 Binaryen 110 或更高版本，并且 `PATH` 中能找到 `wasm-opt`。需要启用 Cargo 特性时，传入 `--features`（或 `-F`），Tessera 检查和 Web 构建都会使用这些特性。

生成的 JavaScript、TypeScript 声明和 WebAssembly 位于应用包的 `gen/web/pkg-web/`，浏览器还需要 `gen/web/` 中的其余文件。部署时请上传**整个 `gen/web/` 目录**，并保持目录结构不变：其中有宿主页面 `index.html`、`pkg-web/`、`app/` 下生成的应用元数据和图标，以及 `tessera/` 下单独交付的资源。

::: warning 注意
请上传整个 `gen/web/`。单独的 `pkg-web/` 缺少宿主页面和资源。
:::

用支持 WebAssembly 的 HTTP 服务提供这个目录，并在支持 WebGPU 的浏览器中打开。公开部署需要安全上下文，通常就是 HTTPS。部署后，确认首页和各个资源 URL 都能正常加载。浏览器要求见[平台概览](/zhHans/guide/platforms#web)，所有 Web 选项见[命令行参考](/zhHans/guide/cli#web)。
