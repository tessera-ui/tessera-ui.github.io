import DefaultTheme from "vitepress/theme";
import Layout from "./Layout.vue";
import { keepPlaceOnLanguageSwitch } from "./keepPlaceOnLanguageSwitch";
import { initLanguagePreference } from "./languagePreference";
import "@fontsource-variable/noto-sans";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource/maple-mono/400.css";
import "@fontsource/maple-mono/400-italic.css";
import "@fontsource/maple-mono/500.css";
import "@fontsource/maple-mono/600.css";
import "@fontsource/maple-mono/700.css";
import "./style.css";
import "./home/home.css";
import type { Theme } from "vitepress";

export default {
  ...DefaultTheme,
  Layout,
  enhanceApp(ctx) {
    DefaultTheme.enhanceApp?.(ctx);
    initLanguagePreference();
    keepPlaceOnLanguageSwitch(ctx.router);
  },
} satisfies Theme;
