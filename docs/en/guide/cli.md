---
title: CLI and diagnostics
description: Reference for cargo tessera commands, call-boundary error codes (T0001–T0007), and Tessera lints.
---

# CLI and diagnostics

`cargo-tessera` provides project scaffolding, static call-boundary checking, live development loops, offscreen headless sessions, profiling analysis, and platform builds. Run `cargo tessera --help` or `cargo tessera <cmd> --help` for the exact flags of your installed version.

## Project, plugin, and skill commands

| Command | Purpose |
| --- | --- |
| `cargo tessera new [NAME] [-t basic\|blank]` | Scaffold a new Tessera app |
| `cargo tessera plugin new [NAME] [-t basic\|android]` | Scaffold a Tessera plugin crate |
| `cargo tessera skill [--local\|--global\|--path DIR] [--force]` | Install the bundled `tessera-good-taste` agent skill |

## Development, build, and packaging

- **`cargo tessera dev`**: watches and rebuilds/restarts desktop apps (`-p`, `-r`/`--release`, `-v`, `--top`, `--debug-dirty-overlay`, `--profiling-output FILE`, `--asset-backend embed\|platform`).
- **`cargo tessera build`**: checks boundaries and builds native binaries (`-r`, `-p`, `-t`/`--target`, `--bin`, `--profiling-output`, `--debug-dirty-overlay`, `--asset-backend`).
- **`cargo tessera package`**: builds with platform assets and invokes `cargo-packager` (`-r`, `-p`, `-t`, `--bin`, `-f`/`--formats`).
- **`cargo tessera android {init, build, dev, rust-build}`**: Gradle project sync, APK/AAB builds (`--format`, `--arch`), and live device deployment (`--device`).
- **`cargo tessera ios build`**: builds simulator `.app` or device `.ipa` on macOS (`--device`, `--signing-identity`, `--provisioning-profile`, `--profiling-output`).
- **`cargo tessera web {init, build, dev}`**: initializes browser host, builds WebAssembly (`-r`, `-p`, `-F`/`--features`), or serves `gen/web/` locally (`--port`).

## Headless and profiling commands

- **`cargo tessera headless`**: runs the JSONL offscreen session supervisor (`-p`, `-r`, `--width`, `--height`, `--frame-time-ms`, `--profiling-output`).
- **`cargo tessera profiling analyze PATH`**: summarizes desktop/headless JSONL profiles (`-v`, `--top N`, `--min-count N`, `--skip-invalid`, `--csv FILE`).
- **`cargo tessera profiling analyze-android --package ID`**: pulls profiler output via `adb` and analyzes it (`-d`/`--device`, `--remote-path`, `--pull-to`, plus analysis flags).

## Static checking (`check` and `fix`)

`cargo tessera check` validates Tessera execution and ownership rules with `rust-analyzer` before running `cargo check`:

```sh
cargo tessera check -p my-app --all-targets
cargo tessera check -D warnings
cargo tessera check --explain T0001
cargo tessera fix -p my-app
```

Both `check` and `fix` accept Cargo selection flags (`-p`, `--workspace`, `-t`, `-r`, `--lib`, `--bin`, `--bins`, `--examples`, `--tests`, `--benches`, `--all-targets`, `-F`/`--features`, `--all-features`, `--no-default-features`, `-j`/`--jobs`, `--message-format`, `-v`, `-q`) and lint level switches (`-A`/`--allow`, `-W`/`--warn`, `-D`/`--deny`, `--forbid`, `--force-warn`, `--cap-lints`). `fix` additionally accepts `--allow-dirty`, `--allow-staged`, `--allow-no-vcs`, `--broken-code`, `--edition`, and `--edition-idioms`.

In source, configure lint levels on items or inline modules with `#[tessera_ui::lint(allow(tessera::redundant_render_slot))]`.

### Error codes (`--explain CODE`)

| Code | Rule |
| --- | --- |
| `T0001` | Component called outside a Tessera build context |
| `T0002` | Tessera-only runtime API (`remember`, `use_context`, `launch`, `key`, `RenderSlot::render`, etc.) called outside a build context |
| `T0003` | Unresolved call to a potentially Tessera-sensitive target |
| `T0004` | Invalid `#[tessera_ui::lint(...)]` attribute configuration |
| `T0005` | Direct use of `tessera_ui::__private` outside generated macro code |
| `T0006` | `State::new` called outside `ModelInit::init` or a `ModelStore::model` initializer |
| `T0007` | A single build context may emit more than one `layout()` or `group()` node |

### Built-in lints

- **`tessera::redundant_render_slot`**: warns when creating a `RenderSlot` only to immediately forward it through a closure whose sole action is `.render()`.
- **`tessera::remembered_state_in_model`**: warns when a `ModelStore::model` initializer captures state created by `remember` or `retain` instead of `State::new`.
- **`tessera::named_modifier_ext_import`**: warns when a private `use` binds `ModifierExt`, `FocusModifierExt`, or `CursorModifierExt` to a name never referenced directly (`cargo tessera fix` rewrites it to `as _`).
