<script setup lang="ts">
import { ref } from "vue";
import { useData, withBase } from "vitepress";
import TileMark from "./TileMark.vue";
import { toggleAppearance } from "../appearance";
import type { HomeCopy } from "./copy";
import { GITHUB } from "./copy";

const props = defineProps<{ copy: HomeCopy }>();
const { isDark } = useData();
const open = ref(false);

const toggleTheme = (event: MouseEvent) => toggleAppearance(isDark, event);
</script>

<template>
  <header class="nav" :class="{ 'is-open': open }">
    <div class="nav__inner">
      <a
        class="nav__brand"
        :href="withBase(props.copy.homeLink)"
        aria-label="Tessera"
      >
        <TileMark :size="22" />
        <span>Tessera</span>
      </a>

      <nav class="nav__links" :aria-label="props.copy.nav.label">
        <a
          v-for="item in props.copy.nav.items"
          :key="item.link"
          :href="withBase(item.link)"
          >{{ item.text }}</a
        >
      </nav>

      <div class="nav__actions">
        <a
          class="nav__lang"
          :href="withBase(props.copy.nav.altLang.link)"
          :lang="props.copy.nav.altLang.lang"
        >
          {{ props.copy.nav.altLang.text }}
        </a>
        <a class="nav__icon" :href="GITHUB" aria-label="GitHub" title="GitHub">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="nav__gh">
            <path
              d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z"
            />
          </svg>
        </a>
        <button
          class="nav__icon"
          type="button"
          :aria-label="props.copy.nav.theme"
          :title="props.copy.nav.theme"
          @click="toggleTheme"
        >
          <svg class="nav__sun" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="4.2" />
            <path
              d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"
            />
          </svg>
          <svg class="nav__moon" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a8.4 8.4 0 1 0 10.8 10.8Z"
            />
          </svg>
        </button>
        <button
          class="nav__icon nav__burger"
          type="button"
          :aria-expanded="open"
          :aria-label="props.copy.nav.menu"
          @click="open = !open"
        >
          <span /><span />
        </button>
      </div>
    </div>

    <nav v-if="open" class="nav__sheet" :aria-label="props.copy.nav.label">
      <a
        v-for="item in props.copy.nav.items"
        :key="item.link"
        :href="withBase(item.link)"
        @click="open = false"
      >
        {{ item.text }}
      </a>
    </nav>
  </header>
</template>
