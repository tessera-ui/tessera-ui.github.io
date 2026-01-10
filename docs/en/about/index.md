---
layout: home
title: About Tessera

hero:
  name: "About Tessera"
---

Tessera is a cross-platform, declarative and functional UI library for Rust that focuses on performance and extensibility.

It grew out of [my](https://github.com/shadow3aaa/) desire for a modern, pleasant-to-write native Rust UI framework.

Existing Rust UI frameworks tend to be either verbose to author (for example, `iced`'s Elm-style components), only suitable for simple debug-style applications like `egui`, or require a separate DSL such as `slint` to declare UI. I wanted a pure-Rust framework that lets developers construct common native application UIs in a concise, unobtrusive, and intuitive way while delivering high performance and good extensibility.

## Component model

Keeping the component model close to common Rust coding patterns is important. If a UI introduces a way of writing that is very different from ordinary logic code, users must switch mental models; Tessera strives to remain intuitive.

In Rust there are two common organization patterns: one uses `struct` and `impl` to hold the primary logic with a few free functions as helpers, and the other uses free functions to express logic while `struct`s represent data and `impl` blocks act as utilities. I won't claim which is more "Rusty", but Tessera chooses the latter because it is simpler and more concise.

## No reactive programming here

Before discussing reactive programming, it's important to clarify that I mean reactive state updates, not reactive UI design.

The core idea of reactive programming is to only update parts of the UI that depend on changed data, thereby reducing wasted work. This idea naturally appears in web frameworks because the DOM update process is historically expensive and needed optimization. In non-web scenarios, I don't think this is a necessary design.

The key to UI performance is reducing unnecessary layout computation. Reducing layout work does not mean keeping a huge component tree holding all UI state and then running a lightweight algorithm to find the minimal set of updates—this is a legacy of web-based techniques.

Because relayout is the performance bottleneck, we should optimize it directly. Tessera designs the layout phase to be side-effect-free and parallelizable, and it introduces automatic caching to avoid repeated computations and address layout performance. For these reasons, reactive state propagation is not required and would only introduce synchronization complexity into the developer experience.
