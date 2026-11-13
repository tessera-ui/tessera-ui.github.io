---
title: 命令行与诊断参考
description: cargo tessera 全部子命令、静态边界检查错误码（T0001–T0007）与内置 lint 说明。
---

# 命令行与诊断参考

`cargo-tessera` 负责项目脚手架、静态调用边界检查、热重启开发、离屏会话、性能分析与全平台打包。运行 `cargo tessera --help` 或 `cargo tessera <子命令> --help` 可查看当前安装版本的完整选项。

## 项目、插件与 Agent 技能

| 命令 | 用途 |
| --- | --- |
| `cargo tessera new [NAME] [-t basic\|blank]` | 创建新应用项目 |
| `cargo tessera plugin new [NAME] [-t basic\|android]` | 创建插件 crate |
| `cargo tessera skill [--local\|--global\|--path DIR] [--force]` | 安装随 CLI 提供的 `tessera-good-taste` 代理技能 |

## 开发、构建与打包

- **`cargo tessera dev`**：监听改动并重编重启桌面应用（`-p`、`-r`/`--release`、`-v`、`--top`、`--debug-dirty-overlay`、`--profiling-output FILE`、`--asset-backend embed\|platform`）。
- **`cargo tessera build`**：检查边界后编译原生二进制（`-r`、`-p`、`-t`/`--target`、`--bin`、`--profiling-output`、`--debug-dirty-overlay`、`--asset-backend`）。
- **`cargo tessera package`**：以平台资源模式构建并通过 `cargo-packager` 打桌面安装包（`-r`、`-p`、`-t`、`--bin`、`-f`/`--formats`）。
- **`cargo tessera android {init, build, dev, rust-build}`**：初始化与同步 Gradle 宿主、构建 APK/AAB（`--format`、`--arch`），以及设备实时开发（`--device`）。
- **`cargo tessera ios build`**：在 macOS 上构建模拟器 `.app` 或真机 `.ipa`（`--device`、`--signing-identity`、`--provisioning-profile`、`--profiling-output`）。
- **`cargo tessera web {init, build, dev}`**：初始化 Web 宿主、编译 WebAssembly（`-r`、`-p`、`-F`/`--features`）或在本地启动开发服务（`--port`）。

## 无头会话与性能分析

- **`cargo tessera headless`**：启动 JSONL 离屏测试管理进程（`-p`、`-r`、`--width`、`--height`、`--frame-time-ms`、`--profiling-output`）。
- **`cargo tessera profiling analyze PATH`**：汇总分析桌面/离屏性能记录（`-v`、`--top N`、`--min-count N`、`--skip-invalid`、`--csv FILE`）。
- **`cargo tessera profiling analyze-android --package ID`**：通过 `adb` 拉取 Android 性能记录并分析（`-d`/`--device`、`--remote-path`、`--pull-to` 及分析参数）。

## 静态检查与修复（`check` / `fix`）

`cargo tessera check` 会在运行 `cargo check` 前先校验 Tessera 执行边界与所有权规则：

```sh
cargo tessera check -p my-app --all-targets
cargo tessera check -D warnings
cargo tessera check --explain T0001
cargo tessera fix -p my-app
```

`check` 与 `fix` 共用目标/特性选择参数（`-p`、`--workspace`、`-t`、`-r`、`--lib`、`--bin`、`--bins`、`--examples`、`--tests`、`--benches`、`--all-targets`、`-F`/`--features`、`--all-features`、`--no-default-features`、`-j`/`--jobs`、`--message-format`、`-v`、`-q`）以及 lint 级别开关（`-A`/`--allow`、`-W`/`--warn`、`-D`/`--deny`、`--forbid`、`--force-warn`、`--cap-lints`）。`fix` 额外支持 `--allow-dirty`、`--allow-staged`、`--allow-no-vcs`、`--broken-code`、`--edition` 与 `--edition-idioms`。

在源码中可以通过 `#[tessera_ui::lint(allow(tessera::redundant_render_slot))]` 在条目或模块上调整级别。

### 错误码（`--explain CODE`）

| 错误码 | 规则说明 |
| --- | --- |
| `T0001` | 在非 Tessera 构建上下文中调用了组件 |
| `T0002` | 在非构建上下文中调用了 `remember`、`use_context`、`launch`、`key`、`RenderSlot::render` 等运行时 API |
| `T0003` | 无法解析可能属于 Tessera 敏感调用的目标 |
| `T0004` | `#[tessera_ui::lint(...)]` 属性配置无效 |
| `T0005` | 在宏展开之外直接引用了 `tessera_ui::__private` |
| `T0006` | 在 `ModelInit::init` 或 `ModelStore::model` 初始化闭包之外调用了 `State::new` |
| `T0007` | 单个构建上下文中可能发射超过一个 `layout()` 或 `group()` 节点 |

### 内置 Lint

- **`tessera::redundant_render_slot`**：警告构造 `RenderSlot` 后仅通过只调用 `.render()` 的闭包进行冗余转发。
- **`tessera::remembered_state_in_model`**：警告 `ModelStore::model` 初始化器捕获了 `remember` 或 `retain` 状态（应改用 `State::new`）。
- **`tessera::named_modifier_ext_import`**：警告私有 `use` 绑定了从未按名称引用的 `ModifierExt` / `FocusModifierExt` / `CursorModifierExt`（`cargo tessera fix` 可自动重写为 `as _`）。
