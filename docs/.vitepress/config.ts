import { defineConfig, UserConfig } from "vitepress";
import { withSidebar } from "vitepress-sidebar";
import { withI18n } from "vitepress-i18n";
import { VitePressI18nOptions } from "vitepress-i18n/types";
import fs from "node:fs";

const vitePressConfig: UserConfig = {
  base: "/",
  title: "Tessera",
  description: "A declarative, immediate-mode UI framework for Rust",

  sitemap: {
    hostname: "https://tessera-ui.github.io/",
  },

  head: [["link", { rel: "icon", href: "/favicon.svg" }]],

  rewrites: {
    "en/:rest*": ":rest*",
  },

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: "/icon-text-only.svg",
    siteTitle: false,

    socialLinks: [
      { icon: "github", link: "https://github.com/tessera-ui/tessera" },
    ],

    search: {
      provider: "local",
    },

    footer: {
      message: "Licensed under the MIT or Apache-2.0 at your option.",
      copyright: "Copyright © Tessera UI Framework Developers",
    },

    i18nRouting: true,
  },

  transformPageData(pageData) {
    try {
      const content = fs.readFileSync("docs/" + pageData.filePath, "utf-8");

      const cn = (content.match(/[\u4e00-\u9fa5]/g) || []).length;

      const en = (
        content
          .replace(/[\u4e00-\u9fa5]/g, " ")
          .match(
            /[a-zA-Z0-9_\u0392-\u03c9\u0400-\u04FF]+|[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\u31f0-\u31ff\u3105-\u312d\u31a0-\u31b7\uff00-\uffef]/g
          ) || []
      ).length;

      const words = cn + en;

      pageData.frontmatter.wordCount = words;

      pageData.frontmatter.readingTime = Math.ceil(cn / 400 + en / 200);
    } catch (e) {
      pageData.frontmatter.wordCount = 0;

      pageData.frontmatter.readingTime = 0;
    }

    return pageData;
  },
};

const supportedLocales = ["en", "zhHans"];
const rootLocale = "en";

const commonVitePressSidebarConfig = {
  useTitleFromFrontmatter: true,
  useFolderTitleFromIndexFile: true,
  sortMenusByFrontmatterOrder: true,
  manualSortFileNameByPriority: ["about", "guide", "components"],
  excludeByGlobPattern: ["about/**"],
};

const vitePressSidebarConfigs = supportedLocales.map((lang) => ({
  ...commonVitePressSidebarConfig,
  ...(lang === rootLocale ? {} : { basePath: `/${lang}/` }),
  documentRootPath: `docs/${lang}`,
  resolvePath: lang === rootLocale ? "/" : `/${lang}/`,
  collapsed: true,
}));

const vitePressI18nConfig: VitePressI18nOptions = {
  searchProvider: "local",
  // VitePress I18n config
  locales: ["en", "zhHans"],
  themeConfig: {
    zhHans: {
      nav: [
        { text: "主页", link: "/zhHans" },
        { text: "手册", link: "/zhHans/guide/getting-started" },
        { text: "博客", link: "/zhHans/blog/" },
        { text: "关于", link: "/zhHans/about" },
      ],
    },
    en: {
      nav: [
        { text: "Home", link: "/" },
        { text: "Guide", link: "/guide/getting-started" },
        { text: "Blog", link: "/blog/" },
        { text: "About", link: "/about" },
      ],
    },
  },
};

// https://vitepress.dev/reference/site-config
export default defineConfig(
  withSidebar(
    withI18n(vitePressConfig, vitePressI18nConfig),
    vitePressSidebarConfigs
  )
);
