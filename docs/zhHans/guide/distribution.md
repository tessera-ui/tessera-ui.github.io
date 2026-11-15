---
title: 打包与发布
description: 为桌面、Android、iOS 和 Web 生成发布版二进制、安装包与可部署产物。
---

# 打包与发布

使用 `cargo tessera` 为各平台构建发布产物。正式打包时请在以下所有命令中加上 `--release`。

| 目标产物 | 命令 | 构建环境要求 |
| --- | --- | --- |
| 原生可执行文件 | `cargo tessera build --release` | 对应桌面系统（或已配好的交叉工具链） |
| 桌面安装包 / 应用包 | `cargo tessera package --release` | 目标桌面操作系统本机 |
| Android APK / AAB | `cargo tessera android build --release` | 配有 Android SDK、NDK 与 JDK 的主机 |
| iOS `.app` / IPA | `cargo tessera ios build --release` | 装有 Xcode 与 XcodeGen 的 macOS |
| Web 发布目录（`gen/web/`） | `cargo tessera web build --release` | 已安装 `wasm32-unknown-unknown` 与 `wasm-opt` |

## 统一应用标识

在 `tessera.toml` 的 `[app]` 表中一次配置显示名称、反向域名标识符与源图标：

```toml
[app]
name = "My App"
identifier = "com.example.myapp"
icon = "icon.svg"
```

所有平台图标均由此生成（请使用至少 1024 × 1024 的正方形 PNG，或文字已转曲且外部资源已内嵌的正方形 SVG）。版本号读取自 `Cargo.toml`；Android 的 `versionCode` 为 `major * 1_000_000 + minor * 1_000 + patch + 1`。

权限、SDK 版本、entitlements 和签名等平台设置写在各平台自己的文件里：`gen/` 下的 Android 与 Xcode 工程，桌面安装包则写在 `[package.metadata.packager]`。

## 原生二进制与桌面安装包

构建原生可执行文件：

```sh
cargo tessera build --package my-app --bin my_app --release
```

原生构建默认将资源内嵌进二进制。指定 `--asset-backend platform` 时，资源会被复制到可执行文件旁的 `<bin>.resources/tessera/` 目录，发布时需一并携带该目录。

通过 `cargo-packager` 生成系统安装包：

```sh
cargo install cargo-packager --locked
cargo tessera package -p my-app --release --formats default
```

`--formats` 支持 Windows（`nsis`、`wix`）、macOS（`app`、`dmg`）、Linux（`deb`、`appimage`、`pacman`），以及 `default` 和 `all`。产物输出在 Cargo target 目录的 `packages/my-app/` 下。应用名称、标识符、版本与图标来自 `tessera.toml` 和 Cargo；签名、安装包设置与额外资源写在 `Cargo.toml` 的 `[package.metadata.packager]` 中。

## Android

安装 Android SDK 与 NDK、Gradle 8.14 支持的 JDK（17 或 21），并把 `adb` 加入 `PATH`。首次生成 `gen/android/`，之后按需构建 APK 或 AAB：

```sh
cargo tessera android init
cargo tessera android build -p my-app --release --format apk --arch arm64
cargo tessera android build -p my-app --release --format aab --arch arm64
```

`--arch` 可选 `arm64`（默认）、`arm`、`x86` 与 `x86_64`；`--format` 可选 `apk`（默认）与 `aab`。

`gen/android/` 属于你的应用：提交到版本库，像普通 Android 工程一样修改。权限写在 `app/src/main/AndroidManifest.xml`，`minSdk`、Gradle 插件、依赖与发布签名写在 `app/build.gradle.kts`。`init` 之后 `cargo tessera` 不再修改这些文件；`android init --force` 会重新生成它们并覆盖本地修改。

每次执行 Android 命令时，`cargo tessera` 只重写它维护的文件，这些文件都已被生成的 `.gitignore` 排除：

| 文件 | 内容 |
| --- | --- |
| `tessera.properties` | 应用 ID、`versionCode`、`versionName`、库名与 Rust 项目路径，由 `app/build.gradle.kts` 读取 |
| `tessera.settings.gradle` | 插件模块，由 `settings.gradle` 引入 |
| `tessera.build.gradle.kts` | 插件模块依赖 |
| `buildSrc/`、`tessera-plugins/` | Rust 构建集成与复制来的插件模块 |
| `app/src/main/tessera-res/` | 应用名称与图标 |
| `app/src/main/assets/tessera/` | 平台资源 |

新克隆的仓库需要先执行一次 `cargo tessera` 的 Android 命令，Android Studio 才能同步工程。

## iOS

在装有 Xcode 与 [XcodeGen](https://github.com/yonaskolb/XcodeGen)（`brew install xcodegen`）的 macOS 上，首次生成 Xcode 工程，之后构建模拟器 `.app` 或真机 IPA：

```sh
cargo tessera apple init -p my-app
cargo tessera ios build -p my-app --release
cargo tessera ios build -p my-app --release --device
```

`ios build` 通过 `xcodebuild` 构建；加 `--device` 时会归档应用，并按 `gen/apple/ExportOptions.plist` 导出 IPA。产物输出在 Cargo target 目录的 `packages/my-app/ios/<目标三元组>/` 下。

`gen/apple/` 是包含 iOS 与 macOS 两个 target 的 Xcode 工程。它属于你的应用：提交到版本库，并在 Xcode 中打开 `.xcodeproj`。签名团队、capabilities 与 entitlements 在 Xcode 中设置，用途说明等键写进 `iOS/Info.plist` 或 `macOS/Info.plist`。两个 target 都会在构建阶段运行 `cargo tessera apple rust-build`，因此在 Xcode 中构建也会同时构建 Rust 可执行文件及其资源。

每次执行 Apple 命令时，`cargo tessera` 会重写 `tessera.xcconfig`（bundle 标识符、显示名称与版本号）和 `Tessera.xcassets`（应用图标）；两者都已被生成的 `.gitignore` 排除，新克隆的仓库请先执行一次任意 Apple 命令。`apple init --force` 会重新生成可编辑文件并覆盖本地修改。

## macOS

在 App Store 之外分发 macOS 应用，使用 `cargo tessera package --formats app,dmg`。上架 Mac App Store 时，在 Xcode 中归档 `gen/apple/` 工程的 macOS target（Product → Archive）。

## Web

旧项目先初始化 Web 宿主文件，确保 `wasm-opt`（Binaryen 110+）在 `PATH` 中再执行发布构建：

```sh
rustup target add wasm32-unknown-unknown
cargo tessera web init -p my-app
cargo tessera web build -p my-app --release
```

`gen/web/index.html` 属于你的应用。它的 `<head>` 中必须包含 `<!-- tessera-app -->` … `<!-- /tessera-app -->` 注释块：Web 命令只重写这个块（标题、图标与 manifest 链接），缺少时会报错。文件中的其他内容（包括你自己添加的元素）都会保留。

部署时请上传**整个 `gen/web/` 目录**（包含 `index.html`、`pkg-web/`、`app/` 与 `tessera/`），并由支持 `.wasm` MIME 类型的 HTTPS（或 `localhost`）服务托管。
