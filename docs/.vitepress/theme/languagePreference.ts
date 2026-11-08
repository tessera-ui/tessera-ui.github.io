import { withBase } from "vitepress";

const KEY = "tessera:language";
const LANGUAGE_LINKS =
  ".nav__lang, .VPNavBarTranslations a, .VPNavScreenTranslations a, .VPNavBarExtra .translations a";

export function initLanguagePreference() {
  if (typeof window === "undefined") return;

  // Only an initial visit to the plain homepage uses the browser language.
  // Explicit links to either language, including document deep links, win.
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
    if (
      saved === "zh" ||
      (!saved &&
        /^zh(?:-|$)/i.test(navigator.languages?.[0] ?? navigator.language))
    ) {
      location.replace(withBase("/zhHans/"));
    }
  }

  // Both the homepage and the VitePress desktop/mobile menus use links.
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
    try {
      localStorage.setItem(
        KEY,
        url.pathname.startsWith(withBase("/zhHans/")) ? "zh" : "en",
      );
    } catch {
      // Switching languages still works when storage is unavailable.
    }
  });
}
