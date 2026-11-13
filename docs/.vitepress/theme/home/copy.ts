interface Link {
  text: string;
  link: string;
}

export interface DemoCopy {
  title: string;
  frameTitle: string;
  run: (size: string) => string;
  loading: string;
  unsupported: string;
  failed: string;
  failedHint: string;
  note: string;
  source: string;
}

export interface HomeCopy {
  homeLink: string;
  nav: {
    label: string;
    items: Link[];
    altLang: Link & { lang: string };
    theme: string;
    menu: string;
  };
  copy: { label: string; done: string };
  hero: {
    title: string;
    lead: string;
    primary: Link;
  };
  stats: { value: string; label: string }[];
  demo: DemoCopy;
  showcase: {
    noteTitle: string;
    note: string;
    startTitle: string;
    start: string[];
  };
  features: { title: string; body: string; link?: string }[];
  footer: {
    license: string;
    links: Link[];
  };
}

export const GITHUB = "https://github.com/tessera-ui/tessera";
const API_DOCS = "https://tessera-ui.github.io/tessera/tessera_ui/";

const START = [
  "cargo install cargo-tessera",
  "cargo tessera new my-app",
  "cd my-app && cargo tessera dev",
];

const en: HomeCopy = {
  homeLink: "/",
  nav: {
    label: "Primary",
    items: [
      { text: "Docs", link: "/guide/" },
      { text: "API", link: API_DOCS },
      { text: "Blog", link: "/blog/" },
    ],
    altLang: { text: "中文", link: "/zhHans/", lang: "zh-CN" },
    theme: "Toggle color theme",
    menu: "Menu",
  },
  copy: { label: "Copy command", done: "Copied" },
  hero: {
    title: "Tessera",
    lead: "A fast, GPU-first Rust UI framework that is declarative and reactive.",
    primary: { text: "Get started", link: "/guide/getting-started" },
  },
  stats: [
    { value: "100+", label: "Material 3 Expressive components" },
    { value: "6", label: "Platforms, one codebase" },
    { value: "0", label: "Redraws when nothing changed" },
    { value: "100%", label: "Rust, no webview" },
  ],
  demo: {
    title: "Live demo",
    frameTitle: "Tessera demo running on WebGPU",
    run: (size) => `Run the demo · ${size}`,
    loading: "Loading WebAssembly…",
    unsupported:
      "This browser doesn't expose WebGPU. Try a recent Chrome, Edge or Safari.",
    failed: "Try again",
    failedHint:
      "The demo failed to start. The browser console has the details.",
    note: "* A chat client built with Tessera, compiled to WebAssembly and drawn with WebGPU. The replies are scripted.",
    source: "Demo source",
  },
  showcase: {
    noteTitle: "How it works",
    note: "The UI is a Rust function of state. Tessera runs these functions as needed to build each frame, then draws it on the GPU using Vulkan, Metal, DirectX 12 or WebGPU. No HTML, no CSS, no WebView.",
    startTitle: "Start a project",
    start: START,
  },
  features: [
    {
      title: "Cross-platform",
      body: "Runs on Windows, macOS, Linux, Android, iOS and the web.",
      link: "/guide/platforms",
    },
    {
      title: "Bring your own shader",
      body: "Every effect is a pluggable shader, the built-in component library included.",
      link: "/guide/drawing",
    },
    {
      title: "Modern scaffolding",
      body: "cargo-tessera is all you need, for everything.",
      link: "/guide/cli",
    },
    {
      title: "Pure Rust",
      body: "Plain Rust syntax, 0% RSX.",
      link: "/guide/thinking-in-tessera",
    },
  ],
  footer: {
    license: "Tessera · MIT or Apache-2.0",
    links: [
      { text: "Docs", link: "/guide/" },
      { text: "API", link: API_DOCS },
      { text: "Blog", link: "/blog/" },
      { text: "GitHub", link: GITHUB },
      { text: "Hat tiling", link: "/licenses/hatviz.txt" },
    ],
  },
};

const zh: HomeCopy = {
  homeLink: "/zhHans/",
  nav: {
    label: "主导航",
    items: [
      { text: "文档", link: "/zhHans/guide/" },
      { text: "API", link: API_DOCS },
      { text: "博客", link: "/zhHans/blog/" },
    ],
    altLang: { text: "EN", link: "/", lang: "en" },
    theme: "切换配色",
    menu: "菜单",
  },
  copy: { label: "复制命令", done: "已复制" },
  hero: {
    title: "Tessera",
    lead: "快速、GPU 优先的 Rust UI 框架，声明式且响应式。",
    primary: { text: "开始使用", link: "/zhHans/guide/getting-started" },
  },
  stats: [
    { value: "100+", label: "个 Material 3 Expressive 组件" },
    { value: "6", label: "个平台，同一份代码" },
    { value: "0", label: "无变化时的重绘" },
    { value: "100%", label: "Rust，没有 WebView" },
  ],
  demo: {
    title: "在线演示",
    frameTitle: "运行在 WebGPU 上的 Tessera 演示",
    run: (size) => `运行演示 · ${size}`,
    loading: "正在加载 WebAssembly…",
    unsupported:
      "当前浏览器没有提供 WebGPU，请换用较新的 Chrome、Edge 或 Safari。",
    failed: "重试",
    failedHint: "演示启动失败，详情见浏览器控制台。",
    note: "* 用 Tessera 写的聊天客户端，编译为 WebAssembly，通过 WebGPU 绘制。回复内容是预设的。",
    source: "演示源码",
  },
  showcase: {
    noteTitle: "工作方式",
    note: "界面是关于状态的 Rust 函数。Tessera 按需执行它们来构建每帧，并通过 GPU 在 Vulkan、Metal、DirectX 12 或 WebGPU 上绘制。没有 HTML，没有 CSS，没有 WebView。",
    startTitle: "创建项目",
    start: START,
  },
  features: [
    {
      title: "跨平台支持",
      body: "支持 Windows、macOS、Linux、Android、iOS 和 Web。",
      link: "/zhHans/guide/platforms",
    },
    {
      title: "自定义着色器",
      body: "用插件式着色器编写一切效果，内置组件库也不例外。",
      link: "/zhHans/guide/drawing",
    },
    {
      title: "现代的脚手架",
      body: "仅需 cargo-tessera 便可完成一切操作。",
      link: "/zhHans/guide/cli",
    },
    {
      title: "纯粹的 Rust",
      body: "纯粹的 Rust 语法，0% RSX。",
      link: "/zhHans/guide/thinking-in-tessera",
    },
  ],
  footer: {
    license: "Tessera · MIT 或 Apache-2.0",
    links: [
      { text: "文档", link: "/zhHans/guide/" },
      { text: "API", link: API_DOCS },
      { text: "博客", link: "/zhHans/blog/" },
      { text: "GitHub", link: GITHUB },
      { text: "密铺图案", link: "/licenses/hatviz.txt" },
    ],
  },
};

export const copies = { en, zh };
