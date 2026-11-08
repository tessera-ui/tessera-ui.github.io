import { defineConfig, type DefaultTheme, type UserConfig } from "vitepress";
import { withI18n } from "vitepress-i18n";
import type { VitePressI18nOptions } from "vitepress-i18n/types";
import fs from "node:fs";
import { tesseraDark, tesseraLight } from "./theme/home/shiki-themes";
import { readingTime } from "./blogPosts";
import { writeLegacyRedirects } from "./redirects";

const GITHUB = "https://github.com/tessera-ui/tessera";
const API_DOCS = "https://tessera-ui.github.io/tessera/tessera_ui/";

type Titles = Record<string, string>;

const SIDEBAR: { group: Titles; pages: [string, Titles][] }[] = [
  {
    group: { en: "Get started", zh: "开始" },
    pages: [
      ["", { en: "Introduction", zh: "介绍" }],
      ["getting-started", { en: "Getting started", zh: "快速开始" }],
      ["tutorial", { en: "Tutorial", zh: "教程" }],
      ["project-structure", { en: "Project structure", zh: "项目结构" }],
    ],
  },
  {
    group: { en: "Core concepts", zh: "核心概念" },
    pages: [
      [
        "thinking-in-tessera",
        { en: "Thinking in Tessera", zh: "Tessera 的思维方式" },
      ],
      ["state", { en: "State", zh: "状态" }],
      [
        "lifecycle",
        { en: "Lifecycle and side effects", zh: "生命周期与副作用" },
      ],
      ["modifiers", { en: "Modifiers", zh: "修饰符" }],
      ["rendering", { en: "Rendering and performance", zh: "渲染阶段与性能" }],
      ["semantics", { en: "Semantics", zh: "语义" }],
    ],
  },
  {
    group: { en: "UI", zh: "界面" },
    pages: [
      ["layout", { en: "Layout basics", zh: "布局基础" }],
      ["lists", { en: "Lists and scrolling", zh: "列表与滚动" }],
      ["text", { en: "Text and text input", zh: "文本与文本输入" }],
      ["theming", { en: "Material 3 theming", zh: "Material 3 主题" }],
      ["interaction", { en: "Gestures and interaction", zh: "手势与交互" }],
      ["animation", { en: "Animation", zh: "动画" }],
      ["custom-layout", { en: "Custom layout", zh: "自定义布局" }],
      ["drawing", { en: "Drawing and shaders", zh: "绘制与着色器" }],
    ],
  },
  {
    group: { en: "Build an app", zh: "构建应用" },
    pages: [
      ["app", { en: "Entry point and windows", zh: "应用入口与窗口" }],
      ["navigation", { en: "Navigation", zh: "导航" }],
      ["tasks", { en: "Background tasks", zh: "后台任务" }],
      ["assets", { en: "Resources", zh: "资源" }],
      ["i18n", { en: "Localization", zh: "多语言" }],
      ["accessibility", { en: "Accessibility", zh: "无障碍" }],
      ["testing", { en: "Testing", zh: "测试" }],
    ],
  },
  {
    group: { en: "Platforms and release", zh: "平台与发布" },
    pages: [
      ["platforms", { en: "Platforms", zh: "平台概览" }],
      [
        "plugins",
        { en: "Platform integration and plugins", zh: "平台集成与插件" },
      ],
      ["distribution", { en: "Packaging and release", zh: "打包发布" }],
      ["cli", { en: "CLI reference", zh: "命令行参考" }],
    ],
  },
];

function sidebar(lang: "en" | "zh"): DefaultTheme.SidebarItem[] {
  const base = lang === "en" ? "/guide/" : "/zhHans/guide/";
  return SIDEBAR.map(({ group, pages }) => ({
    text: group[lang],
    items: pages.map(([slug, title]) => ({
      text: title[lang],
      link: base + slug,
    })),
  }));
}

function nav(lang: "en" | "zh"): DefaultTheme.NavItem[] {
  const prefix = lang === "en" ? "" : "/zhHans";
  return [
    {
      text: lang === "en" ? "Docs" : "文档",
      link: `${prefix}/guide/`,
      activeMatch: "/guide/",
    },
    { text: "API", link: API_DOCS },
    {
      text: lang === "en" ? "Blog" : "博客",
      link: `${prefix}/blog/`,
      activeMatch: "/blog/",
    },
  ];
}

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
  locales: ["en", "zhHans"],
  themeConfig: {
    en: {
      nav: nav("en"),
      sidebar: { "/guide/": sidebar("en") },
      editLink: {
        text: "Edit this page on GitHub",
      },
    },
    zhHans: {
      nav: nav("zh"),
      sidebar: { "/zhHans/guide/": sidebar("zh") },
      editLink: {
        text: "在 GitHub 上编辑此页",
      },
    },
  },
};

// https://vitepress.dev/reference/site-config
export default defineConfig(withI18n(vitePressConfig, vitePressI18nConfig));
