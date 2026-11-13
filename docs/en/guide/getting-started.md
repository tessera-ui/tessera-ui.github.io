---
title: Getting started
description: Install cargo-tessera, create a project, and run it on desktop, web, or mobile.
---

# Getting started

You can go from an empty directory to a running desktop window in three commands. Once the project is set up, the same code also runs in a browser or on mobile.

## Prerequisites

Tessera requires **Rust 1.98 or newer** (the minimum supported version of `cargo-tessera`) along with your OS native C/C++ linker and build tools. Additional targets bring their own requirements:

- **Web**: a browser with WebGPU enabled. Release builds also need Binaryen 110 or newer with `wasm-opt` on your `PATH`.
- **Android**: Android SDK and NDK, a JDK for Gradle, and a device or emulator.
- **iOS**: macOS with Xcode installed.

For exact per-OS dependencies (such as Linux display libraries), see [Platforms](/guide/platforms).

Install the CLI once with Cargo:

```sh
cargo install cargo-tessera --locked
```

Because `cargo-tessera` installs as a Cargo subcommand, every command in this guide starts with `cargo tessera`.

## Create and run a project

Scaffold a new project from the `basic` template and start the desktop dev loop:

```sh
cargo tessera new my-app --template basic
cd my-app
cargo tessera dev
```

A window opens showing `Hello Tessera!` on a full-window surface. The `blank` template generates the same structure with an empty surface. Both templates depend on `tessera-ui`, `tessera-foundation`, and `tessera-components`, register `ComponentsPackage`, and wrap the root UI in `material_theme()`. If you omit `--template` or the project name, the CLI prompts interactively.

Unless noted otherwise, examples across this documentation assume the `basic` template, where your UI code starts in `src/app.rs`. See [Project structure](/guide/project-structure) for a tour of the generated files.

## Edit and reload

`cargo tessera dev` watches `src/`, `Cargo.toml`, `build.rs`, `tessera-app.toml`, `tessera-config.toml`, your icon, and configured resource directories. Whenever a watched file changes, it checks Tessera rules, rebuilds, and restarts the desktop window.

Each reload starts a fresh process, so in-memory state resets to its initial values. If a build fails, fix the compiler or checker error and save again—`dev` stays running and picks up the next save.

Try replacing `src/app.rs` with the counter from the [Introduction](/guide/) and saving the file to see it update.

## Run on other targets

### Browser (WebGPU)

Add the WebAssembly target once, then start the local dev server:

```sh
rustup target add wasm32-unknown-unknown
cargo tessera web dev
```

This builds the app, serves `gen/web/` at `http://127.0.0.1:8000`, and opens your browser. After saving edits and waiting for a rebuild, refresh the tab to load the updated bundle. Pass `--port 8080` to use another port. New projects already ship with `gen/web/index.html`; for an older project, run `cargo tessera web init` first.

### Android

With the Android SDK, NDK, and Java configured, generate the Gradle host once and launch on a connected device:

```sh
cargo tessera android init
cargo tessera android dev --device DEVICE_ID
```

`android init` also installs the Rust Android targets unless you pass `--skip-targets-install`. Find `DEVICE_ID` from `adb devices`. Like desktop `dev`, `android dev` watches your sources, rebuilds, reinstalls, and relaunches the app on save.

### iOS

On macOS with Xcode installed, build an iOS simulator `.app` bundle:

```sh
cargo tessera ios build
```

Unlike `dev`, `ios build` builds once and exits. Pass `--device` to produce an IPA for physical hardware. See [Packaging and release](/guide/distribution#ios) for signing and bundle options.

## Check rules and apply fixes

Before committing changes, run the Tessera checker:

```sh
cargo tessera check
```

It validates Tessera-specific rules first—for instance, catching component or `remember` calls placed inside plain callbacks—and then runs `cargo check`. See [Thinking in Tessera](/guide/thinking-in-tessera#call-boundaries-and-static-checks) for why those boundaries exist. To apply machine-applicable suggestions from both `cargo-tessera` and `rustc` automatically, run:

```sh
cargo tessera fix
```

In a multi-crate workspace, pass `-p my-app` to target a specific package. If you use a coding agent, you can also install the bundled Tessera skill into your project or home directory with `cargo tessera skill --local` or `--global`.

## Next steps

Follow the [Tutorial](/guide/tutorial) to turn the template into a working grocery list app one small step at a time, or browse [Project structure](/guide/project-structure) first if you want to know what every generated file does.
