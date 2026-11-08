<script setup lang="ts">
import { computed } from "vue";
import { useData, useRoute, withBase } from "vitepress";

type Item = { text?: string; link?: string; items?: Item[] };

const { frontmatter, theme, lang, page } = useData();
const route = useRoute();

const zh = computed(() => lang.value.startsWith("zh"));
const normalize = (p: string) =>
  p
    .replace(/\.html$/, "")
    .replace(/\/index$/, "/")
    .replace(/(.)\/$/, "$1");

const isPost = computed(() =>
  /(^|\/)blog\/(?!index\.md$)[^/]+\.md$/.test(page.value.relativePath),
);

/** The sidebar group that contains the current guide page, e.g. "Core concepts". */
const group = computed(() => {
  const sidebar = theme.value.sidebar as
    | Item[]
    | Record<string, Item[]>
    | undefined;
  if (!sidebar) return null;
  const groups = Array.isArray(sidebar)
    ? sidebar
    : (Object.entries(sidebar).find(([prefix]) =>
        route.path.startsWith(prefix),
      )?.[1] ?? []);
  const here = normalize(route.path);
  return (
    groups.find((g) =>
      g.items?.some((i) => i.link && normalize(withBase(i.link)) === here),
    )?.text ?? null
  );
});

const date = computed(() => {
  if (!frontmatter.value.date) return null;
  const d = new Date(frontmatter.value.date);
  return {
    iso: d.toISOString(),
    text: d.toLocaleDateString(zh.value ? "zh-CN" : "en-US", {
      year: "numeric",
      month: zh.value ? "long" : "short",
      day: "numeric",
    }),
  };
});

const blogLink = computed(() =>
  withBase(zh.value ? "/zhHans/blog/" : "/blog/"),
);
const minutes = computed(() => {
  const n = frontmatter.value.readingTime;
  if (!n) return null;
  return zh.value ? `${n} 分钟阅读` : `${n} min read`;
});
</script>

<template>
  <div v-if="isPost" class="dh dh--post">
    <p class="dh__eyebrow">
      <a :href="blogLink">{{ zh ? "博客" : "Blog" }}</a>
      <template v-if="date">
        <span aria-hidden="true">/</span>
        <time :datetime="date.iso">{{ date.text }}</time>
      </template>
    </p>
    <h1 class="dh__title">{{ frontmatter.title }}</h1>
    <p class="dh__byline">
      <a
        v-if="frontmatter.githubName"
        class="dh__author"
        :href="`https://github.com/${frontmatter.githubName}`"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          :src="`https://github.com/${frontmatter.githubName}.png?size=56`"
          alt=""
          width="24"
          height="24"
        />
        <span>{{ frontmatter.author ?? frontmatter.githubName }}</span>
      </a>
      <span v-else-if="frontmatter.author" class="dh__author">{{
        frontmatter.author
      }}</span>
      <span v-if="minutes" class="dh__minutes">{{ minutes }}</span>
    </p>
  </div>
  <p v-else-if="group" class="dh dh__eyebrow">{{ group }}</p>
</template>

<style scoped>
.dh__eyebrow {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 14px;
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
  font-weight: 500;
  line-height: 1.6;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

:lang(zh-CN) .dh__eyebrow {
  letter-spacing: 0.06em;
}

.dh__eyebrow a {
  color: inherit;
  text-decoration: none;
  transition: color 0.2s;
}

.dh__eyebrow a:hover {
  color: var(--vp-c-text-1);
}

.dh--post {
  margin-bottom: 36px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--vp-c-divider);
}

.dh__title {
  margin: 0 0 20px;
  font-size: clamp(30px, 3.6vw, 40px);
  line-height: 1.2;
  font-weight: 650;
  letter-spacing: -0.035em;
  color: var(--vp-c-text-1);
  text-wrap: balance;
}

:lang(zh-CN) .dh__title {
  text-wrap: wrap;
  letter-spacing: -0.005em;
}

.dh__byline {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.dh__author {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  text-decoration: none;
}

.dh__author img {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--vp-c-divider);
}

.dh__minutes {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
}
</style>
