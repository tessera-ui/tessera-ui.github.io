<script setup lang="ts">
import { computed } from "vue";
import { useData, withBase } from "vitepress";
import HatField from "../home/HatField.vue";
import type { Post } from "../../blogPosts";

const props = defineProps<{ posts: Post[] }>();
const { lang } = useData();

const zh = computed(() => lang.value.startsWith("zh"));
const t = computed(() =>
  zh.value
    ? {
        title: "博客",
        minutes: (n: number) => `${n} 分钟阅读`,
        empty: "还没有文章。",
      }
    : {
        title: "Blog",
        minutes: (n: number) => `${n} min read`,
        empty: "No posts yet.",
      },
);
</script>

<template>
  <div class="tb">
    <header class="tb__head" data-hat-host>
      <div class="tb__tiles" aria-hidden="true">
        <HatField :focus-x="0.82" :focus-y="0.4" :hat-width="56" />
        <div class="tb__veil" />
      </div>
      <div class="tb__frame tb__intro">
        <h1 class="tb__title">{{ t.title }}</h1>
      </div>
    </header>

    <ol class="tb__frame tb__list">
      <li v-for="post in props.posts" :key="post.url">
        <a class="tb__post" :href="withBase(post.url)">
          <time class="tb__date" :datetime="post.iso">{{ post.date }}</time>
          <div class="tb__body">
            <h2 class="tb__post-title">{{ post.title }}</h2>
            <p v-if="post.summary" class="tb__summary">{{ post.summary }}</p>
            <p class="tb__meta">
              <img
                v-if="post.githubName"
                class="tb__avatar"
                :src="`https://github.com/${post.githubName}.png?size=48`"
                alt=""
                width="20"
                height="20"
                loading="lazy"
              />
              <span v-if="post.author">{{ post.author }}</span>
              <span v-if="post.author" aria-hidden="true">·</span>
              <span>{{ t.minutes(post.readingTime) }}</span>
            </p>
          </div>
          <svg class="tb__arrow" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" />
          </svg>
        </a>
      </li>
      <li v-if="!props.posts.length" class="tb__empty">{{ t.empty }}</li>
    </ol>
  </div>
</template>

<style scoped>
.tb {
  --tb-max: 1160px;
  --tb-pad: clamp(20px, 3.4vw, 40px);
  padding-bottom: clamp(64px, 10vw, 128px);
}

.tb__frame {
  max-width: var(--tb-max);
  margin-inline: auto;
}

.tb__head {
  position: relative;
  isolation: isolate;
  border-bottom: 1px solid var(--vp-c-divider);
  overflow: hidden;
}

.tb__tiles {
  position: absolute;
  inset: 0;
  z-index: -1;
}

.tb__veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(
      ellipse 52% 90% at 22% 55%,
      color-mix(in srgb, var(--vp-c-bg) 94%, transparent) 0%,
      color-mix(in srgb, var(--vp-c-bg) 70%, transparent) 55%,
      transparent 100%
    ),
    linear-gradient(to bottom, var(--vp-c-bg) 0, transparent 56px),
    linear-gradient(to top, var(--vp-c-bg) 0, transparent 72px);
}

/* No frame lines over the tiling; the frame starts with the list. */
.tb__intro {
  padding: clamp(56px, 8vw, 96px) var(--tb-pad) clamp(48px, 6vw, 72px);
}

.tb__date,
.tb__meta {
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

:lang(zh-CN) .tb__date,
:lang(zh-CN) .tb__meta {
  letter-spacing: 0.04em;
}

.tb__title {
  margin: 0;
  font-size: clamp(40px, 5.4vw, 64px);
  line-height: 1.05;
  font-weight: 650;
  letter-spacing: -0.04em;
  color: var(--vp-c-text-1);
}

.tb__list {
  list-style: none;
  margin-block: 0;
  padding: 0;
  border-inline: 1px solid var(--vp-c-divider);
}

.tb__post {
  position: relative;
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr) 24px;
  gap: 24px;
  padding: 32px var(--tb-pad) 34px;
  border-bottom: 1px solid var(--vp-c-divider);
  color: inherit;
  text-decoration: none;
  transition: background-color 0.2s;
}

.tb__post::before {
  content: "";
  position: absolute;
  left: -1px;
  top: -1px;
  bottom: -1px;
  width: 2px;
  background: linear-gradient(180deg, #6366f1, #22d3ee);
  opacity: 0;
  transition: opacity 0.2s;
}

.tb__post:hover {
  background: color-mix(in srgb, var(--vp-c-text-1) 3%, transparent);
}

.tb__post:hover::before {
  opacity: 1;
}

.tb__date {
  padding-top: 6px;
}

.tb__post-title {
  margin: 0;
  padding: 0;
  border: 0;
  font-size: clamp(19px, 1.8vw, 23px);
  line-height: 1.35;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--vp-c-text-1);
}

:lang(zh-CN) .tb__post-title {
  letter-spacing: 0;
}

.tb__summary {
  margin: 10px 0 0;
  max-width: 44em;
  font-size: 15px;
  line-height: 1.75;
  color: var(--vp-c-text-2);
}

.tb__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0 0;
  text-transform: none;
  letter-spacing: 0.02em;
}

.tb__avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid var(--vp-c-divider);
}

.tb__arrow {
  width: 16px;
  height: 16px;
  margin-top: 8px;
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition:
    transform 0.25s cubic-bezier(0.2, 0.7, 0.2, 1),
    stroke 0.2s;
}

.tb__post:hover .tb__arrow {
  stroke: var(--vp-c-text-1);
  transform: translateX(3px);
}

.tb__empty {
  padding: 40px var(--tb-pad);
  color: var(--vp-c-text-3);
}

@media (max-width: 760px) {
  .tb__post {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
  }

  .tb__date {
    padding-top: 0;
  }

  .tb__arrow {
    display: none;
  }
}
</style>
