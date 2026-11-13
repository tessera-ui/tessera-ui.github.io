<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useData, useRoute, withBase } from "vitepress";
import { LOCALES, localeByKey, translatePath } from "../../locales";

defineProps<{ label: string }>();
const { localeIndex } = useData();
const route = useRoute();

const current = computed(() => localeByKey(localeIndex.value));
// Every language links to the page being read, not to its homepage.
const links = computed(() =>
  LOCALES.map((locale) => ({
    locale,
    href: withBase(translatePath(route.path, locale)),
  })),
);

const open = ref(false);
const root = ref<HTMLElement>();
const button = ref<HTMLButtonElement>();

function close(refocus = false) {
  if (!open.value) return;
  open.value = false;
  if (refocus) button.value?.focus();
}

const onPointerDown = (event: PointerEvent) => {
  if (!root.value?.contains(event.target as Node)) close();
};
const onFocusOut = (event: FocusEvent) => {
  if (!root.value?.contains(event.relatedTarget as Node | null)) close();
};

onMounted(() => document.addEventListener("pointerdown", onPointerDown));
onBeforeUnmount(() =>
  document.removeEventListener("pointerdown", onPointerDown),
);
</script>

<template>
  <div
    ref="root"
    class="lang"
    :class="{ 'is-open': open }"
    @keydown.escape="close(true)"
    @focusout="onFocusOut"
  >
    <button
      ref="button"
      class="lang__button"
      type="button"
      aria-haspopup="true"
      :aria-expanded="open"
      :aria-label="label"
      :title="label"
      @click="open = !open"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path
          d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"
        />
      </svg>
      <span class="lang__current" :lang="current.lang">{{
        current.label
      }}</span>
      <svg class="lang__chevron" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m7 10 5 5 5-5" />
      </svg>
    </button>

    <ul v-show="open" class="lang__menu" :aria-label="label">
      <li v-for="{ locale, href } in links" :key="locale.key">
        <a
          class="lang__item"
          :href="href"
          :lang="locale.lang"
          :hreflang="locale.lang"
          :aria-current="locale.key === current.key ? 'true' : undefined"
          data-language-link
          @click="close()"
        >
          <span>{{ locale.label }}</span>
          <svg
            v-if="locale.key === current.key"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </a>
      </li>
    </ul>
  </div>
</template>
