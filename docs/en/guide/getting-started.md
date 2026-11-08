---
title: Getting started
description: Install the Tessera CLI, create a project, and run it on desktop, in a browser or on a phone.
---

# Getting started

In a few commands you can have a Tessera application running on your desktop, rebuilding itself each time you save a file. From there, the same project runs in a browser or on a phone.

## Install the tools

Tessera needs Rust 1.98 or newer, which is the minimum compiler version `cargo-tessera` declares, along with the native linker and build tools for your operating system. Each extra target adds its own requirements:

- **Web:** a browser with WebGPU. Release builds also need Binaryen 110 or newer, with `wasm-opt` on `PATH`.
- **Android:** the Android SDK and NDK, Java for the generated Gradle project, and a device or emulator.
- **iOS:** macOS with Xcode.

[Platforms](/guide/platforms) lists the details for each one. With Rust installed, install the CLI:

```sh
cargo install cargo-tessera
```

The CLI runs as a Cargo subcommand, so every command on this page starts with `cargo tessera`.

## Create a project

Create an application from the `basic` template and start it:

```sh
cargo tessera new my-app --template basic
cd my-app
cargo tessera dev
```

A window opens with `Hello Tessera!` on a full-window surface. The other template, `blank`, is the same project with an empty surface. Both include `tessera-components`, register `ComponentsPackage`, and wrap the root in a Material theme. Run `new` without `--template` and the CLI asks you to pick one; run it without a project name and it asks for that too.

Unless a page says otherwise, the examples in these guides assume the `basic` template. You will edit `src/app.rs` most of the time; [Project structure](/guide/project-structure) explains the rest of the generated files.

## Edit and rerun

`cargo tessera dev` watches `src/`, `Cargo.toml`, `build.rs`, `tessera-app.toml`, `tessera-config.toml`, the application icon and the resource directories. Whenever one of them changes, it rebuilds the application and restarts it.

Each change restarts the process, so the application starts again from its initial state and initial screen after every edit. If a build fails, fix the error and save again, and `dev` picks up the next change.

To try it, replace `src/app.rs` with the counter from the [Introduction](/guide/) and save.

## Run in a browser

Add the WebAssembly target once, then start the web development server:

```sh
rustup target add wasm32-unknown-unknown
cargo tessera web dev
```

The command builds the project, serves it at `http://127.0.0.1:8000` and tries to open that address in your default browser. It keeps watching and rebuilding; refresh the page yourself after each rebuild to load the new version. Pass `--port 8080` to use another port.

New projects already contain the browser host page in `gen/web/`. To add web support to an older project that lacks this page, run `cargo tessera web init` first. The browser runs the same component code compiled to WebAssembly; [Platforms](/guide/platforms) covers browser requirements and font loading.

## Run on Android

With the Android SDK and NDK installed, generate the Android project once and then run on a device:

```sh
cargo tessera android init
cargo tessera android dev --device DEVICE_ID
```

`android init` also installs the Rust Android targets; pass `--skip-targets-install` to skip that step. Use the device identifier that `adb devices` reports. Like the desktop command, `android dev` keeps watching: when your sources change it rebuilds the application, installs it on the device again and restarts it.

## Build for iOS

On macOS with Xcode, build the application for the iOS simulator:

```sh
cargo tessera ios build
```

This builds an application bundle once and exits; unlike `dev`, it does not watch your sources or run the app. Add `--device` to build an IPA for a physical device instead. [Packaging and release](/guide/distribution) covers signing and where the bundle is written.

## Check the project

Before you commit, run the checker:

```sh
cargo tessera check
```

It checks Tessera call boundaries first and compilation second. The boundary rule is short: call a component from another component or from a recognized build closure. Ordinary event callbacks such as `on_click` run outside the build, so they change state and the next build shows the result. [Thinking in Tessera](/guide/thinking-in-tessera) explains why. `cargo tessera fix` applies the compiler's and Tessera's machine-applicable suggestions and then checks again.

In a workspace, select the application with `-p my-app`. The [CLI reference](/guide/cli) describes lint settings, profiling and the other commands.

## Next steps

The [Tutorial](/guide/tutorial) starts from this project and builds a small app one change at a time. If you would rather understand the generated files first, read [Project structure](/guide/project-structure).
