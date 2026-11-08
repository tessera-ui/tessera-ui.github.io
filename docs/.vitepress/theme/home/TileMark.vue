<script setup lang="ts">
import { useId } from "vue";

withDefaults(defineProps<{ size?: number | string }>(), { size: 28 });
const id = `tile-${useId()}`;
</script>

<template>
  <svg
    class="tile-mark"
    :width="size"
    :height="size"
    viewBox="48 48 416 416"
    aria-hidden="true"
  >
    <defs>
      <linearGradient :id="id" gradientUnits="userSpaceOnUse" x1="48.1" y1="349.27" x2="414.6" y2="184.85">
        <stop offset="0" stop-color="var(--th-tile-from, #6366F1)" />
        <stop offset="1" stop-color="var(--th-tile-to, #22D3EE)" />
      </linearGradient>
    </defs>
    <path
      :fill="`url(#${id})`"
      d="M222.39 390.6A9 9 0 0 0 213.39 390.6L116.57 446.5A15 15 0 0 1 96.08 441.01L69.8 395.5A15 15 0 0 1 69.8 380.5L137.35 263.5A15 15 0 0 1 150.34 256L208.89 256A9 9 0 0 0 217.89 247L217.89 132.66A15 15 0 0 1 225.39 119.67L319.22 65.5A15 15 0 0 1 339.71 70.99L365.99 116.5A15 15 0 0 1 365.99 131.5L336.71 182.21A9 9 0 0 0 340 194.5L439.03 251.67A15 15 0 0 1 446.53 264.66L446.53 373A15 15 0 0 1 431.53 388L375.51 388A9 9 0 0 0 367.72 392.5L339.71 441.01A15 15 0 0 1 319.22 446.5Z"
    />
  </svg>
</template>
