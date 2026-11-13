import { withBase } from "vitepress";
import {
  DEFAULT_LOCALE,
  localeByCode,
  localeForBrowser,
  localeOfPath,
} from "../locales";

const KEY = "tessera:language";
// The homepage language menu and the VitePress desktop/mobile menus.
const LANGUAGE_LINKS =
  "[data-language-link], .VPNavBarTranslations a, .VPNavScreenTranslations a, .VPNavBarExtra .translations a";

export function initLanguagePreference() {
  if (typeof window === "undefined") return;

  // Only an initial visit to the plain homepage picks a language. Explicit
  // links to any language, including document deep links, win.
  if (
    location.pathname === withBase("/") &&
    !location.search &&
    !location.hash
  ) {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      // Private browsing may block storage; browser language still works.
    }
    const locale =
      localeByCode(saved) ??
      localeForBrowser(navigator.languages ?? [navigator.language]) ??
      DEFAULT_LOCALE;
    if (locale !== DEFAULT_LOCALE)
      location.replace(withBase(locale.prefix + "/"));
  }

  document.addEventListener("click", (event) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = (event.target as Element).closest<HTMLAnchorElement>(
      LANGUAGE_LINKS,
    );
    if (!link) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin) return;
    const path = url.pathname.slice(withBase("/").length - 1);
    try {
      localStorage.setItem(KEY, localeOfPath(path).code);
    } catch {
      // Switching languages still works when storage is unavailable.
    }
  });
}
