---
title: CLI reference
description: Every cargo tessera command and its flags, grouped by task.
---

# CLI reference

`cargo-tessera` creates projects, runs the development loop, checks Tessera's call rules and builds every platform target. Install it once, then run its commands as a Cargo subcommand:

```sh
cargo install cargo-tessera --locked
cargo tessera new my-app --template basic
cd my-app
cargo tessera dev
```

Options belong to individual commands, and each command accepts only the options listed for it; arbitrary Cargo flags are not passed through. Run `cargo tessera --help`, or add `--help` after any subcommand, to see the list for your installed version. Unless a command says otherwise, it builds with the debug profile, so add `--release` for anything you ship.

## Projects and plugins

| Command | Options |
| --- | --- |
| `cargo tessera new [NAME]` | `--template`, `-t`: `basic` or `blank`. |
| `cargo tessera plugin new [NAME]` | `--template`, `-t`: `basic` or `android`. |

If you omit the name or the template, the command asks for it. See [Getting started](/guide/getting-started) and [Platform integration and plugins](/guide/plugins#create-a-plugin-crate).

## Development

`cargo tessera dev` watches the project, rebuilds it and restarts the desktop app after each change. Each restart is a new process, so the app starts again from its initial state.

| Option | Meaning |
| --- | --- |
| `--package NAME`, `-p` | Package to run. |
| `--release`, `-r` | Use the release profile. |
| `--verbose`, `-v` | Show verbose output. |
| `--profiling-output FILE` | Enable profiling and write JSONL records to `FILE`. Desktop only. |
| `--top` | Show a live, `top`-like component profiler in the terminal. |
| `--debug-dirty-overlay` | Overlay dirty replay regions with a translucent color. |
| `--asset-backend embed\|platform` | Override how assets are delivered. |

For Android and the web, use [`android dev`](#android) and [`web dev`](#web). What the profiling and overlay output tell you is explained in [Rendering phases and performance](/guide/rendering).

## Builds and packaging

`cargo tessera build` checks Tessera call boundaries, then compiles a native target.

| Option | Meaning |
| --- | --- |
| `--release`, `-r` | Use the release profile. |
| `--package NAME`, `-p` | Package to build. |
| `--target TRIPLE`, `-t` | Rust target triple, passed to `cargo build`. |
| `--bin NAME` | Executable to build. |
| `--profiling-output FILE` | Enable profiling and write JSONL records. Not supported for Android targets. |
| `--debug-dirty-overlay` | Overlay dirty replay regions with a translucent color. |
| `--asset-backend embed\|platform` | Override asset delivery. Defaults to `embed`, or `platform` for Android targets. |

`cargo tessera package` builds the app with platform assets and produces a desktop installer or bundle through `cargo-packager`, which must be installed.

| Option | Meaning |
| --- | --- |
| `--release`, `-r` | Use the release profile. |
| `--package NAME`, `-p` | Package to bundle. |
| `--target TRIPLE`, `-t` | Rust target triple. Android, iOS and wasm targets are rejected. |
| `--bin NAME` | Executable to bundle. |
| `--formats LIST`, `-f` | Comma-separated: `default`, `all`, `nsis`, `wix`, `app`, `dmg`, `deb`, `appimage`, `pacman`. |

Host requirements, output paths and signing are covered in [Packaging and release](/guide/distribution).

## Checking and fixes

`cargo tessera check` checks compilation and Tessera call boundaries. A component may call ordinary Rust code. Components and Tessera-only APIs may be called only from a build context. Ordinary helpers and event callbacks are ordinary code, even when the closure is written inside a component; see [Thinking in Tessera](/guide/thinking-in-tessera).

```sh
cargo tessera check -p my-app --all-targets
cargo tessera check -D warnings
cargo tessera check --explain T0001
```

`--explain CODE` prints the explanation for a diagnostic code and exits without running the check. It is an option of `check`.

`cargo tessera fix` applies machine-applicable Tessera suggestions, runs `cargo fix` and checks the result. It selects all targets by default; pass a target selector to narrow it. You review the remaining suggestions yourself.

```sh
cargo tessera fix -p my-app
```

`check` and `fix` share these selection and output options:

| Purpose | Options |
| --- | --- |
| Package and platform | `--package` (`-p`), `--workspace`, `--target` (`-t`), `--release` (`-r`) |
| Cargo targets | `--lib`, `--bin NAME`, `--bins`, `--examples`, `--tests`, `--benches`, `--all-targets` |
| Features | `--features` (`-F`), `--all-features`, `--no-default-features` |
| Execution and output | `--jobs` (`-j`), `--message-format`, `--verbose` (`-v`), `--quiet` (`-q`) |

### Lint levels

These two commands are the ones that accept lint switches. Each takes an individual lint such as `tessera::redundant_render_slot`, the `tessera::all` group, or `warnings`. Switches apply in the order you write them.

| Option | Meaning |
| --- | --- |
| `--allow LINT`, `-A` | Allow the lint. |
| `--warn LINT`, `-W` | Warn on the lint. |
| `--deny LINT`, `-D` | Make the lint an error. |
| `--forbid LINT` | Make the lint an error that nested settings cannot lower. |
| `--force-warn LINT` | Warn even when the lint is allowed or capped. Does not accept `warnings`. |
| `--cap-lints LEVEL` | Cap lint levels at `allow`, `warn`, `deny` or `forbid`. |

`-F` is the short form of `--features`; use `--forbid` for the forbid level. In source, override levels with `#[tessera_ui::lint(allow(tessera::redundant_render_slot))]` on an item or inline module tree. Source attributes accept `allow`, `warn`, `deny` and `forbid`, and nested settings cannot lower a forbidden lint.

### Fix safety

Commit or otherwise save your edits before running `fix`. These options relax its workspace checks or enable compiler migrations:

| Option | Meaning |
| --- | --- |
| `--allow-dirty` | Fix even if the working directory has uncommitted changes. |
| `--allow-staged` | Fix even if there are staged changes. |
| `--allow-no-vcs` | Fix even if no version control is detected. |
| `--broken-code` | Fix even if the code already has compiler errors. |
| `--edition` | Fix in preparation for the next edition. |
| `--edition-idioms` | Fix warnings to migrate to an edition's idioms. |

## Android

| Command | Purpose |
| --- | --- |
| `cargo tessera android init` | Generate the Gradle host project. `--skip-targets-install` skips installing Rust targets. |
| `cargo tessera android build` | Build an APK or AAB with Gradle. |
| `cargo tessera android dev` | Build, install and run the app on a device. |
| `cargo tessera android rust-build TARGET` | Build the Rust library for one Android target. Gradle calls this during the Android build. |

`build`, `dev` and `rust-build` share these options:

| Option | Meaning |
| --- | --- |
| `--release`, `-r` | Use the release profile. |
| `--package NAME`, `-p` | Package to build. |
| `--profiling-output REMOTE_PATH` | Enable profiling and write JSONL to this path inside the app sandbox on the device. |
| `--debug-dirty-overlay` | Overlay dirty replay regions with a translucent color. |
| `--asset-backend embed\|platform` | Override asset delivery. Defaults to `platform`. |

`build` and `dev` also take `--arch`, the CPU architecture, which defaults to the `arch` in `[package.metadata.tessera.android]` or else `arm64`. In addition:

- `build` takes `--format`, `-f`: `apk` or `aab`. It defaults to the configured `format` or else `apk`.
- `dev` requires `--device`, `-d`, set to a serial from `adb devices`.

## iOS

`cargo tessera ios build` builds and bundles an iOS app. It runs only on macOS with Xcode.

| Option | Meaning |
| --- | --- |
| `--release`, `-r` | Use the release profile. |
| `--package NAME`, `-p` | Package to build. |
| `--bin NAME` | Executable to bundle. |
| `--device` | Build a device IPA instead of a simulator app. |
| `--signing-identity NAME` | Code-signing certificate name. Without it, the bundle is signed ad hoc. |
| `--provisioning-profile FILE` | Embed this provisioning profile for device installation. |
| `--profiling-output PATH` | Write frame profiling JSONL to this path inside the app. |

See [Packaging and release](/guide/distribution#ios) for signing and bundle configuration.

## Web

| Command | Options |
| --- | --- |
| `cargo tessera web init` | `--package` (`-p`). Adds the browser host files and web entry support. |
| `cargo tessera web build` | `--package` (`-p`), `--release` (`-r`), `--features` (`-F`), comma-separated. |
| `cargo tessera web dev` | `--package` (`-p`), `--release` (`-r`), `--port` (default `8000`). |

`web dev` rebuilds and serves `gen/web/` locally. Refresh the browser after each rebuild to load the new build. Release builds need Binaryen 110 or newer. Deployment is covered in [Packaging and release](/guide/distribution#web).

## Headless sessions

`cargo tessera headless` runs a session-based JSONL server over standard input and output, for tests and automation that render offscreen.

| Option | Meaning |
| --- | --- |
| `--package NAME`, `-p` | Package to run. Defaults to the workspace root package. |
| `--release`, `-r` | Build workers with the release profile. |
| `--width PX` | Default offscreen width in physical pixels. Default `800`. |
| `--height PX` | Default offscreen height in physical pixels. Default `600`. |
| `--frame-time-ms MS` | Virtual time step per frame. Default `16`. |
| `--profiling-output FILE` | Enable profiling and write JSONL records. |

The app must enable the `tessera-ui/headless` feature and keep its shared `EntryPoint::run_desktop()` startup path. A `spawn` request can name a `package` instead of `-p`. [Testing](/guide/testing) documents the protocol and GPU requirements.

## Profiling

`cargo tessera profiling analyze PATH` summarizes a JSONL capture written by `--profiling-output` and ranks components.

| Option | Meaning |
| --- | --- |
| `--verbose`, `-v` | Show the full summary and every ranking section. |
| `--top N` | Entries per section. Default `5`, or `20` with `--verbose`. Must be greater than 0. |
| `--min-count N` | Minimum samples for a component to be listed. Default `1`. |
| `--skip-invalid` | Skip non-frame lines that fail to parse. |
| `--csv FILE` | Export per-component aggregated stats to CSV. |

`cargo tessera profiling analyze-android` pulls a capture from a device with adb, then analyzes it. It takes the same analysis options, plus:

| Option | Meaning |
| --- | --- |
| `--package ID` | Required. The Android application ID, such as `com.example.myapp`. |
| `--device SERIAL`, `-d` | Device from `adb devices`. |
| `--remote-path REMOTE_PATH` | Path inside the app sandbox. Common locations are tried when omitted. |
| `--pull-to FILE` | Local copy of the capture. Default `profiles/android.jsonl`. |

```sh
cargo tessera profiling analyze target/headless.jsonl --top 30
cargo tessera profiling analyze-android --package com.example.myapp --top 20
```

How to capture useful profiles and read the results is covered in [Rendering phases and performance](/guide/rendering).

## Agent skill

`cargo tessera skill` installs the bundled `tessera-good-taste` guidance for coding agents. Without a scope it asks in an interactive terminal, so scripts must pass one:

```sh
cargo tessera skill --local
cargo tessera skill --global
```

| Option | Meaning |
| --- | --- |
| `--local` | Install into the project's `.agents/skills/`. |
| `--path DIR` | Project directory for a local install. Defaults to the current directory. Conflicts with `--global`. |
| `--global` | Install into `~/.agents/skills/`. Conflicts with `--local`. |
| `--force` | Replace locally modified files that belong to the bundled skill. |
