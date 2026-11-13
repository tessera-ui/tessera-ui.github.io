<script setup lang="ts">
import { onMounted, provide } from "vue";
import { useData } from "vitepress";
import DefaultTheme from "vitepress/theme";
import DocHeader from "./DocHeader.vue";
import TesseraHome from "./home/TesseraHome.vue";
import { toggleAppearance, warmAppearanceTransition } from "./appearance";

const { frontmatter, isDark } = useData();

onMounted(warmAppearanceTransition);

// VitePress's appearance switch calls this instead of flipping the theme itself.
provide("toggle-appearance", (event?: MouseEvent) =>
  toggleAppearance(isDark, event),
);
</script>

<template>
  <!-- Rendered here rather than by each language's index page, so switching
       languages re-renders the homepage in place and the live demo keeps
       running. -->
  <TesseraHome v-if="frontmatter.tesseraHome" />
  <DefaultTheme.Layout v-else>
    <template #doc-before>
      <DocHeader />
    </template>
  </DefaultTheme.Layout>
</template>
