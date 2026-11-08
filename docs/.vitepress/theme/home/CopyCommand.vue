<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{ command: string; label: string; done: string }>();
const copied = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

async function copy() {
  try {
    await navigator.clipboard.writeText(props.command);
    copied.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => (copied.value = false), 1600);
  } catch {
    copied.value = false;
  }
}
</script>

<template>
  <div class="cmd">
    <span class="cmd__prompt" aria-hidden="true">$</span>
    <code class="cmd__text">{{ props.command }}</code>
    <button class="cmd__copy" type="button" :aria-label="copied ? props.done : props.label" @click="copy">
      <svg v-if="!copied" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
        <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
      <span class="sr-only" aria-live="polite">{{ copied ? props.done : "" }}</span>
    </button>
  </div>
</template>
