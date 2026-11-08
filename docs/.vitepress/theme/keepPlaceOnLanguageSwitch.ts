import { nextTick } from "vue";
import type { Router } from "vitepress";

const ZH = "/zhHans";
// Elements that line up between the two languages: doc headings and the
// homepage sections and cards. Both languages share the same structure.
const ANCHORS =
  ".vp-doc :is(h1, h2, h3), .th main > *, .th .stat, .th .feature";
// The reading line sits just below the fixed navigation bar.
const LINE = 80;

interface Place {
  to: string;
  index: number;
  ratio: number;
  scrollY: number;
}

const pathOf = (href: string) =>
  new URL(href, location.href).pathname
    .replace(/\.html$/, "")
    .replace(/\/index$/, "/")
    .replace(/(.)\/$/, "$1");

/** Whether two paths are the same page in English and Chinese. */
function isTranslation(from: string, to: string) {
  const strip = (p: string) =>
    p === ZH ? "/" : p.startsWith(ZH + "/") ? p.slice(ZH.length) : null;
  const fromZh = strip(from);
  const toZh = strip(to);
  return (
    (fromZh !== null) !== (toZh !== null) && (fromZh ?? from) === (toZh ?? to)
  );
}

function anchors() {
  return [...document.querySelectorAll<HTMLElement>(ANCHORS)];
}

/** Records which section is at the reading line and how far into it the reader is. */
function capture(to: string): Place {
  const list = anchors();
  let index = -1;
  for (let i = 0; i < list.length; i++) {
    if (list[i].getBoundingClientRect().top <= LINE) index = i;
    else break;
  }
  let ratio = 0;
  if (index >= 0) {
    const top = list[index].getBoundingClientRect().top;
    const next =
      list[index + 1]?.getBoundingClientRect().top ??
      top + list[index].offsetHeight;
    ratio = Math.min(1, (LINE - top) / Math.max(1, next - top));
  }
  return { to, index, ratio, scrollY: window.scrollY };
}

function restore(place: Place) {
  const list = anchors();
  const el = list[place.index];
  if (place.index < 0 || !el) {
    window.scrollTo(0, place.index < 0 ? place.scrollY : 0);
    return;
  }
  const top = el.getBoundingClientRect().top + window.scrollY;
  const next = list[place.index + 1]
    ? list[place.index + 1].getBoundingClientRect().top + window.scrollY
    : top + el.offsetHeight;
  window.scrollTo(0, top + place.ratio * (next - top) - LINE);
}

/**
 * Keeps the reader at the same section when switching between the English and
 * Chinese version of a page, instead of jumping back to the top.
 */
export function keepPlaceOnLanguageSwitch(router: Router) {
  if (typeof window === "undefined") return;
  let pending: Place | null = null;

  const before = router.onBeforeRouteChange;
  router.onBeforeRouteChange = (to) => {
    const from = pathOf(location.href);
    const target = pathOf(to);
    pending =
      isTranslation(from, target) && !new URL(to, location.href).hash
        ? capture(target)
        : null;
    return before?.(to);
  };

  const after = router.onAfterRouteChange;
  router.onAfterRouteChange = async (to) => {
    await after?.(to);
    const place = pending;
    pending = null;
    if (!place || pathOf(to) !== place.to) return;
    // The router scrolls to the top after the new page renders; restore after it.
    await nextTick();
    restore(place);
    // Again after layout settles (fonts, code highlighting).
    requestAnimationFrame(() => restore(place));
  };
}
