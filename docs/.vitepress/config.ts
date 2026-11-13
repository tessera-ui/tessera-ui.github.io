import { defineConfig, type DefaultTheme, type UserConfig } from "vitepress";
import { withI18n } from "vitepress-i18n";
import type { VitePressI18nOptions } from "vitepress-i18n/types";
import fs from "node:fs";
import { tesseraDark, tesseraLight } from "./theme/home/shiki-themes";
import { readingTime } from "./blogPosts";
import { writeLegacyRedirects } from "./redirects";
import { LOCALES, type Locale } from "./locales";

const GITHUB = "https://github.com/tessera-ui/tessera";
const API_DOCS = "https://tessera-ui.github.io/tessera/tessera_ui/";

type Titles = Record<string, string>;

const SIDEBAR: { group: Titles; pages: [string, Titles][] }[] = [
  {
    group: { en: "Get started", zh: "起步" },
    pages: [
      ["", { en: "Introduction", zh: "介绍" }],
      ["getting-started", { en: "Getting started", zh: "快速开始" }],
      ["tutorial", { en: "Tutorial", zh: "教程：购物清单" }],
      ["project-structure", { en: "Project structure", zh: "项目结构" }],
    ],
  },
  {
    group: { en: "Core mental model", zh: "核心心智模型" },
    pages: [
      [
        "thinking-in-tessera",
        { en: "Thinking in Tessera", zh: "Tessera 的思维方式" },
      ],
      ["state", { en: "State and sharing", zh: "状态与共享" }],
      [
        "lifecycle",
        {
          en: "Identity, lifecycle, and effects",
          zh: "身份、生命周期与副作用",
        },
      ],
    ],
  },
  {
    group: { en: "Building UI", zh: "构建界面" },
    pages: [
      ["layout", { en: "Layout basics", zh: "布局基础" }],
      ["modifiers", { en: "Modifiers", zh: "修饰符" }],
      ["theming", { en: "Material 3 theming", zh: "Material 3 主题与视觉样式" }],
      ["lists", { en: "Lists, grids, and scrolling", zh: "列表、网格与滚动" }],
      ["text", { en: "Text and text input", zh: "文本与文本输入" }],
      ["interaction", { en: "Gestures, input, and focus", zh: "手势、交互与焦点" }],
      ["tasks", { en: "Background tasks", zh: "后台任务与异步工作" }],
      ["animation", { en: "Animation", zh: "动画" }],
    ],
  },
  {
    group: { en: "Build an app", zh: "应用工程化" },
    pages: [
      ["app", { en: "Entry point, windows, and sessions", zh: "应用入口、窗口与会话" }],
      ["navigation", { en: "Navigation", zh: "页面导航" }],
      ["assets", { en: "Assets, images, and fonts", zh: "资源、图片与字体" }],
      ["i18n", { en: "Localization", zh: "多语言与本地化" }],
      ["accessibility", { en: "Semantics and accessibility", zh: "语义与无障碍" }],
      [
        "testing",
        { en: "Testing and headless automation", zh: "测试与无头自动化" },
      ],
    ],
  },
  {
    group: { en: "Under the hood", zh: "底层与扩展" },
    pages: [
      [
        "rendering",
        {
          en: "Rendering, incremental frames, and performance",
          zh: "渲染、增量帧与性能",
        },
      ],
      [
        "custom-layout",
        { en: "Custom layout and coordinates", zh: "自定义布局与局部坐标" },
      ],
      ["drawing", { en: "Custom drawing and shaders", zh: "自定义绘制与着色器" }],
      [
        "plugins",
        { en: "Platform integration and plugins", zh: "平台集成与插件" },
      ],
    ],
  },
  {
    group: { en: "Platforms and CLI", zh: "平台与发布" },
    pages: [
      ["platforms", { en: "Platforms", zh: "目标平台" }],
      ["distribution", { en: "Packaging and release", zh: "打包与发布" }],
      ["cli", { en: "CLI and diagnostics", zh: "命令行与诊断参考" }],
    ],
  },
];

// Navigation titles, by locale code.
const NAV: Titles[] = [
  { en: "Docs", zh: "文档" },
  { en: "Blog", zh: "博客" },
  { en: "Edit this page on GitHub", zh: "在 GitHub 上编辑此页" },
];
const [DOCS, BLOG, EDIT] = NAV;

function sidebar(locale: Locale): DefaultTheme.SidebarItem[] {
  return SIDEBAR.map(({ group, pages }) => ({
    text: group[locale.code],
    items: pages.map(([slug, title]) => ({
      text: title[locale.code],
      link: `${locale.prefix}/guide/${slug}`,
    })),
  }));
}

function nav(locale: Locale): DefaultTheme.NavItem[] {
  return [
    {
      text: DOCS[locale.code],
      link: `${locale.prefix}/guide/`,
      activeMatch: "/guide/",
    },
    { text: "API", link: API_DOCS },
    {
      text: BLOG[locale.code],
      link: `${locale.prefix}/blog/`,
      activeMatch: "/blog/",
    },
  ];
}

// vitepress-i18n names the default language by its code.
const i18nName = (locale: Locale) =>
  locale.key === "root" ? locale.code : locale.key;

const vitePressConfig: UserConfig = {
  title: "Tessera",
  description: "A cross-platform, GPU-native UI framework for Rust",
  cleanUrls: true,
  lastUpdated: true,

  sitemap: {
    hostname: "https://tessera-ui.github.io/",
  },

  head: [
    ["link", { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }],
    ["meta", { name: "theme-color", content: "#07080d" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "Tessera" }],
    [
      "meta",
      { property: "og:image", content: "https://tessera-ui.github.io/og.png" },
    ],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
  ],

  rewrites: {
    "en/:rest*": ":rest*",
  },

  markdown: {
    theme: { light: tesseraLight, dark: tesseraDark },
  },

  async buildEnd(siteConfig) {
    await writeLegacyRedirects(siteConfig.outDir);
  },

  themeConfig: {
    logo: { light: "/logo.svg", dark: "/logo-dark.svg" },

    socialLinks: [{ icon: "github", link: GITHUB }],

    outline: { level: [2, 3] },

    editLink: {
      pattern:
        "https://github.com/tessera-ui/tessera-ui.github.io/edit/main/docs/:path",
    },

    i18nRouting: true,
  },

  transformPageData(pageData) {
    try {
      pageData.frontmatter.readingTime = readingTime(
        fs.readFileSync("docs/" + pageData.filePath, "utf8"),
      );
    } catch {
      pageData.frontmatter.readingTime = 0;
    }

    return pageData;
  },
};

const vitePressI18nConfig: VitePressI18nOptions = {
  searchProvider: "local",
  locales: LOCALES.map(i18nName),
  themeConfig: Object.fromEntries(
    LOCALES.map((locale) => [
      i18nName(locale),
      {
        nav: nav(locale),
        sidebar: { [`${locale.prefix}/guide/`]: sidebar(locale) },
        editLink: { text: EDIT[locale.code] },
      },
    ]),
  ),
};

// https://vitepress.dev/reference/site-config
export default defineConfig(withI18n(vitePressConfig, vitePressI18nConfig));
