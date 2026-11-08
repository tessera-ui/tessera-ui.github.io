import { nextTick, type Ref } from "vue";
import { hatThemeTransition, prepareHatTransition } from "./hatTransition";

let running = false;

/** Builds the tiling in idle time so the first click animates immediately. */
export function warmAppearanceTransition() {
  const idle =
    window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 300));
  idle(() => prepareHatTransition());
}

/**
 * Toggles dark mode behind a hat-tile mosaic that spreads from the pointer
 * (see hatTransition.ts). Switches instantly when the user prefers reduced
 * motion.
 */
export async function toggleAppearance(
  isDark: Ref<boolean>,
  event?: MouseEvent,
) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    isDark.value = !isDark.value;
    return;
  }
  if (running) return;
  running = true;

  // Keyboard activation reports (0, 0); start from the button's centre instead.
  const rect = (
    event?.currentTarget as HTMLElement | undefined
  )?.getBoundingClientRect();
  const x =
    event?.clientX || (rect ? rect.left + rect.width / 2 : innerWidth / 2);
  const y = event?.clientY || (rect ? rect.top + rect.height / 2 : 0);

  const root = document.documentElement;
  try {
    await hatThemeTransition(x, y, !isDark.value, async () => {
      // Switch in one step under the mosaic, without colour transitions.
      root.classList.add("theme-switching");
      isDark.value = !isDark.value;
      await nextTick();
      requestAnimationFrame(() => root.classList.remove("theme-switching"));
    });
  } finally {
    running = false;
  }
}
