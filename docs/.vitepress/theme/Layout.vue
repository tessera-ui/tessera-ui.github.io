<script setup lang="ts">
import { onMounted, provide } from "vue";
import { useData } from "vitepress";
import DefaultTheme from "vitepress/theme";
import DocHeader from "./DocHeader.vue";
import { toggleAppearance, warmAppearanceTransition } from "./appearance";

const { isDark } = useData();

onMounted(warmAppearanceTransition);

// VitePress's appearance switch calls this instead of flipping the theme itself.
provide("toggle-appearance", (event?: MouseEvent) =>
  toggleAppearance(isDark, event),
);
</script>

<template>
  <DefaultTheme.Layout>
    <template #doc-before>
      <DocHeader />
    </template>
  </DefaultTheme.Layout>
</template>
