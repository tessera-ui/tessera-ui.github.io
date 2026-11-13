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
| iOS `.app` / IPA | `cargo tessera ios build --release` | 装有 Xcode 的 macOS |
| Web 发布目录（`gen/web/`） | `cargo tessera web build --release` | 已安装 `wasm32-unknown-unknown` 与 `wasm-opt` |

## 统一应用标识

在 `tessera-app.toml` 中一次配置显示名称、反向域名标识符与源图标：

```toml
name = "My App"
identifier = "com.example.myapp"
icon = "icon.svg"
```

所有平台图标均由此文件生成（请使用正方形 PNG，或文字已转曲且资源已内嵌的正方形 SVG）。Android 和 iOS 的版本号读取自 `Cargo.toml` 的 `version`。

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

`--formats` 支持 Windows（`nsis`、`wix`）、macOS（`app`、`dmg`）、Linux（`deb`、`appimage`、`pacman`），以及 `default` 和 `all`。产物输出在 Cargo target 目录的 `packages/my-app/` 下，更多安装包选项配置在 `Cargo.toml` 的 `[package.metadata.packager]`。代码签名与公证请使用各平台证书及打包器配置完成。

## Android

首次先初始化 `gen/android/`，之后按需构建 APK 或 AAB：

```sh
cargo tessera android init
cargo tessera android build -p my-app --release --format apk --arch arm64
cargo tessera android build -p my-app --release --format aab --arch arm64
```

可在 `Cargo.toml` 的 `[package.metadata.tessera.android]` 下保存 `arch`、`format`、`min_sdk` 默认值；命令行参数优先。正式分发前请在 Android 工具链中配置发布签名。

## iOS

在 macOS 上构建模拟器 `.app` 或真机签名 `.ipa`：

```sh
cargo tessera ios build -p my-app --release
cargo tessera ios build -p my-app --release --device \
  --signing-identity "Apple Development: Your Name (TEAMID)" \
  --provisioning-profile signing/app.mobileprovision
```

产物位于 Cargo target 目录的 `packages/my-app/ios/` 下。如需自定义 plist、资源目录或权限描述文件，在 `Cargo.toml` 中配置：

```toml
[package.metadata.tessera.ios]
info-plist = "ios/Info.plist"
asset-catalog = "ios/Assets.xcassets"
entitlements = "ios/app.entitlements"
resources = "ios/resources"
```

`tessera-app.toml` 与 `Cargo.toml` 中的名称、标识符、版本号与可执行文件名会覆盖自定义 `Info.plist` 中的对应字段。

## Web

旧项目先初始化 Web 宿主文件，确保 `wasm-opt`（Binaryen 110+）在 `PATH` 中再执行发布构建：

```sh
rustup target add wasm32-unknown-unknown
cargo tessera web init -p my-app
cargo tessera web build -p my-app --release
```

部署时请上传**整个 `gen/web/` 目录**（包含 `index.html`、`pkg-web/`、`app/` 与 `tessera/`），并由支持 `.wasm` MIME 类型的 HTTPS（或 `localhost`）服务托管。
