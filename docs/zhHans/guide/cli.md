---
title: 命令行参考
description: 按任务分组的 cargo tessera 全部命令及其选项。
---

# 命令行参考

`cargo-tessera` 负责创建项目、运行开发循环、检查 Tessera 的调用规则，并构建所有平台目标。安装一次之后，以 Cargo 子命令的形式使用：

```sh
cargo install cargo-tessera --locked
cargo tessera new my-app --template basic
cd my-app
cargo tessera dev
```

选项属于各个命令，每个命令只接受为它列出的选项，任意 Cargo 参数不会被透传。运行 `cargo tessera --help`，或在任一子命令后加 `--help`，可以查看你所安装版本的完整列表。除非另有说明，命令都使用调试配置构建，要发布的产物记得加 `--release`。

## 项目与插件

| 命令 | 选项 |
| --- | --- |
| `cargo tessera new [NAME]` | `--template`、`-t`：`basic` 或 `blank`。 |
| `cargo tessera plugin new [NAME]` | `--template`、`-t`：`basic` 或 `android`。 |

省略名称或模板时，命令会交互式询问。见[快速开始](/zhHans/guide/getting-started)和[平台集成与插件](/zhHans/guide/plugins#创建插件-crate)。

## 开发

`cargo tessera dev` 监听项目，每次改动后重新构建并重启桌面应用。每次重启都是新进程，应用会从初始状态重新开始。

| 选项 | 含义 |
| --- | --- |
| `--package NAME`、`-p` | 要运行的包。 |
| `--release`、`-r` | 使用 release 构建配置。 |
| `--verbose`、`-v` | 显示详细输出。 |
| `--profiling-output FILE` | 启用性能记录，并把 JSONL 记录写入 `FILE`。仅限桌面。 |
| `--top` | 在终端显示类似 `top` 的实时组件性能面板。 |
| `--debug-dirty-overlay` | 用半透明颜色叠加显示脏重放区域。 |
| `--asset-backend embed\|platform` | 覆盖资源交付方式。 |

Android 和 Web 请使用 [`android dev`](#android) 和 [`web dev`](#web)。性能记录和叠加层输出说明了什么，见[渲染阶段与性能](/zhHans/guide/rendering)。

## 构建与打包

`cargo tessera build` 先检查 Tessera 调用边界，再编译原生目标。

| 选项 | 含义 |
| --- | --- |
| `--release`、`-r` | 使用 release 构建配置。 |
| `--package NAME`、`-p` | 要构建的包。 |
| `--target TRIPLE`、`-t` | Rust 目标三元组，传给 `cargo build`。 |
| `--bin NAME` | 要构建的可执行文件。 |
| `--profiling-output FILE` | 启用性能记录并写入 JSONL。不支持 Android 目标。 |
| `--debug-dirty-overlay` | 用半透明颜色叠加显示脏重放区域。 |
| `--asset-backend embed\|platform` | 覆盖资源交付方式。默认 `embed`，Android 目标默认 `platform`。 |

`cargo tessera package` 以平台资源后端构建应用，再通过 `cargo-packager` 生成桌面安装包或应用包，需要事先安装 `cargo-packager`。

| 选项 | 含义 |
| --- | --- |
| `--release`、`-r` | 使用 release 构建配置。 |
| `--package NAME`、`-p` | 要打包的包。 |
| `--target TRIPLE`、`-t` | Rust 目标三元组。Android、iOS 和 wasm 目标会被拒绝。 |
| `--bin NAME` | 要打包的可执行文件。 |
| `--formats LIST`、`-f` | 以逗号分隔：`default`、`all`、`nsis`、`wix`、`app`、`dmg`、`deb`、`appimage`、`pacman`。 |

主机要求、输出路径和签名见[打包发布](/zhHans/guide/distribution)。

## 检查与修复

`cargo tessera check` 检查编译和 Tessera 调用边界。组件可以调用普通 Rust 代码。组件和仅限 Tessera 的 API 只能在构建上下文中调用；普通辅助函数和事件回调属于普通代码，即使闭包写在组件内部也一样，见[Tessera 的思维方式](/zhHans/guide/thinking-in-tessera)。

```sh
cargo tessera check -p my-app --all-targets
cargo tessera check -D warnings
cargo tessera check --explain T0001
```

`--explain CODE` 打印某个诊断代码的说明后直接退出，不运行检查。它是 `check` 的选项。

`cargo tessera fix` 应用可机器执行的 Tessera 修复建议，运行 `cargo fix`，再检查结果。它默认选择所有目标，传入目标选择参数可以缩小范围。其余建议由你手动审阅。

```sh
cargo tessera fix -p my-app
```

`check` 和 `fix` 共用以下选择与输出选项：

| 用途 | 选项 |
| --- | --- |
| 包与平台 | `--package`（`-p`）、`--workspace`、`--target`（`-t`）、`--release`（`-r`） |
| Cargo 目标 | `--lib`、`--bin NAME`、`--bins`、`--examples`、`--tests`、`--benches`、`--all-targets` |
| 特性 | `--features`（`-F`）、`--all-features`、`--no-default-features` |
| 执行与输出 | `--jobs`（`-j`）、`--message-format`、`--verbose`（`-v`）、`--quiet`（`-q`） |

### Lint 级别

只有这两个命令接受 lint 开关。每个开关可以接单条规则（例如 `tessera::redundant_render_slot`）、`tessera::all` 分组或 `warnings`。开关按书写顺序依次生效。

| 选项 | 含义 |
| --- | --- |
| `--allow LINT`、`-A` | 允许该规则。 |
| `--warn LINT`、`-W` | 对该规则发出警告。 |
| `--deny LINT`、`-D` | 把该规则视为错误。 |
| `--forbid LINT` | 视为错误，且嵌套设置无法降低。 |
| `--force-warn LINT` | 即使规则被允许或被封顶也发出警告。不接受 `warnings`。 |
| `--cap-lints LEVEL` | 把规则级别封顶为 `allow`、`warn`、`deny` 或 `forbid`。 |

`-F` 是 `--features` 的简写；forbid 级别请用 `--forbid`。在源码中，可以在条目或内联模块树上用 `#[tessera_ui::lint(allow(tessera::redundant_render_slot))]` 覆盖级别。源码属性支持 `allow`、`warn`、`deny` 和 `forbid`，嵌套设置不能降低已 forbid 的规则。

### 修复的安全选项

运行 `fix` 之前，先提交或保存好现有改动。下面这些选项会放宽它的工作区检查，或启用编译器迁移：

| 选项 | 含义 |
| --- | --- |
| `--allow-dirty` | 工作目录有未提交的改动时也执行修复。 |
| `--allow-staged` | 有已暂存的改动时也执行修复。 |
| `--allow-no-vcs` | 未检测到版本控制时也执行修复。 |
| `--broken-code` | 代码已有编译错误时也执行修复。 |
| `--edition` | 为迁移到下一个 edition 做修复。 |
| `--edition-idioms` | 修复警告，迁移到某个 edition 的惯用写法。 |

## Android

| 命令 | 用途 |
| --- | --- |
| `cargo tessera android init` | 生成 Gradle 宿主项目。`--skip-targets-install` 跳过安装 Rust 目标。 |
| `cargo tessera android build` | 用 Gradle 构建 APK 或 AAB。 |
| `cargo tessera android dev` | 构建应用，安装到设备并运行。 |
| `cargo tessera android rust-build TARGET` | 为单个 Android 目标构建 Rust 库。由 Gradle 在 Android 构建过程中调用。 |

`build`、`dev` 和 `rust-build` 共用以下选项：

| 选项 | 含义 |
| --- | --- |
| `--release`、`-r` | 使用 release 构建配置。 |
| `--package NAME`、`-p` | 要构建的包。 |
| `--profiling-output REMOTE_PATH` | 启用性能记录，把 JSONL 写到设备上应用沙箱内的这个路径。 |
| `--debug-dirty-overlay` | 用半透明颜色叠加显示脏重放区域。 |
| `--asset-backend embed\|platform` | 覆盖资源交付方式。默认 `platform`。 |

`build` 和 `dev` 还接受 `--arch`，即 CPU 架构，默认取 `[package.metadata.tessera.android]` 中的 `arch`，没有则为 `arm64`。此外：

- `build` 接受 `--format`、`-f`：`apk` 或 `aab`。默认取配置中的 `format`，没有则为 `apk`。
- `dev` 必须传入 `--device`、`-d`，值为 `adb devices` 列出的序列号。

## iOS

`cargo tessera ios build` 构建并打包 iOS 应用，只能在装有 Xcode 的 macOS 上运行。

| 选项 | 含义 |
| --- | --- |
| `--release`、`-r` | 使用 release 构建配置。 |
| `--package NAME`、`-p` | 要构建的包。 |
| `--bin NAME` | 要打包的可执行文件。 |
| `--device` | 构建设备用的 IPA，而不是模拟器应用。 |
| `--signing-identity NAME` | 代码签名证书名称。不传时使用临时签名（ad hoc）。 |
| `--provisioning-profile FILE` | 嵌入这个描述文件，用于安装到设备。 |
| `--profiling-output PATH` | 把帧性能记录（JSONL）写到应用内的这个路径。 |

签名和 bundle 配置见[打包发布](/zhHans/guide/distribution#ios)。

## Web

| 命令 | 选项 |
| --- | --- |
| `cargo tessera web init` | `--package`（`-p`）。添加浏览器宿主文件和 Web 入口支持。 |
| `cargo tessera web build` | `--package`（`-p`）、`--release`（`-r`）、以逗号分隔的 `--features`（`-F`）。 |
| `cargo tessera web dev` | `--package`（`-p`）、`--release`（`-r`）、`--port`（默认 `8000`）。 |

`web dev` 重新构建并在本地提供 `gen/web/`。每次重新构建后刷新浏览器，即可加载新的构建。发布构建需要 Binaryen 110 或更高版本。部署见[打包发布](/zhHans/guide/distribution#web)。

## 无窗口会话

`cargo tessera headless` 通过标准输入输出运行一个基于会话的 JSONL 服务，用于离屏渲染的测试和自动化。

| 选项 | 含义 |
| --- | --- |
| `--package NAME`、`-p` | 要运行的包。默认是工作区根包。 |
| `--release`、`-r` | 以 release 配置构建工作进程。 |
| `--width PX` | 默认离屏宽度，单位为物理像素。默认 `800`。 |
| `--height PX` | 默认离屏高度，单位为物理像素。默认 `600`。 |
| `--frame-time-ms MS` | 每帧的虚拟时间步长。默认 `16`。 |
| `--profiling-output FILE` | 启用性能记录并写入 JSONL。 |

应用需要启用 `tessera-ui/headless` 特性，并保留共用的 `EntryPoint::run_desktop()` 启动路径。也可以不用 `-p`，而在 `spawn` 请求中指定 `package`。协议和 GPU 要求见[测试](/zhHans/guide/testing)。

## 性能分析

`cargo tessera profiling analyze PATH` 汇总 `--profiling-output` 写出的 JSONL 记录，并对组件排名。

| 选项 | 含义 |
| --- | --- |
| `--verbose`、`-v` | 显示完整摘要和所有排名分组。 |
| `--top N` | 每组显示的条目数。默认 `5`，加 `--verbose` 时为 `20`。必须大于 0。 |
| `--min-count N` | 组件进入排名所需的最少样本数。默认 `1`。 |
| `--skip-invalid` | 跳过无法解析的非帧记录行。 |
| `--csv FILE` | 把按组件汇总的统计导出为 CSV。 |

`cargo tessera profiling analyze-android` 先用 adb 从设备拉取记录，再进行分析。它接受同样的分析选项，另外还有：

| 选项 | 含义 |
| --- | --- |
| `--package ID` | 必需。Android 应用 ID，例如 `com.example.myapp`。 |
| `--device SERIAL`、`-d` | `adb devices` 列出的设备。 |
| `--remote-path REMOTE_PATH` | 记录在应用沙箱内的路径。省略时尝试常见位置。 |
| `--pull-to FILE` | 拉取到本地的路径。默认 `profiles/android.jsonl`。 |

```sh
cargo tessera profiling analyze target/headless.jsonl --top 30
cargo tessera profiling analyze-android --package com.example.myapp --top 20
```

怎样采集有用的性能数据、怎样解读结果，见[渲染阶段与性能](/zhHans/guide/rendering)。

## 代理技能

`cargo tessera skill` 为编程代理安装随 CLI 提供的 `tessera-good-taste` 指南。不指定范围时，它会在交互式终端中询问，所以脚本里必须显式传入：

```sh
cargo tessera skill --local
cargo tessera skill --global
```

| 选项 | 含义 |
| --- | --- |
| `--local` | 安装到项目的 `.agents/skills/`。 |
| `--path DIR` | 本地安装的项目目录，默认是当前目录。与 `--global` 冲突。 |
| `--global` | 安装到 `~/.agents/skills/`。与 `--local` 冲突。 |
| `--force` | 覆盖该技能中被本地修改过的文件。 |
