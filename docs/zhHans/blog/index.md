---
title: 博客
---

<script setup>
import { data as posts } from './posts.data.ts'
</script>

# 博客

欢迎来到 Tessera 博客。

<div v-for="post in posts" :key="post.url" class="post-item">
  <h2>
    <a :href="post.url">{{ post.title }}</a>
  </h2>
  <div class="post-date">
    <span v-if="post.author">作者：{{ post.author }} | </span>
    <span>发布于 {{ post.date.string }}</span>
    <span class="meta-info"> | 字数：{{ post.wordCount }} | 预计阅读：{{ post.readingTime }} 分钟</span>
  </div>
  <div v-if="post.excerpt" v-html="post.excerpt"></div>
</div>

<style>
.post-item {
  margin-bottom: 2rem;
  border-bottom: 1px solid var(--vp-c-divider);
  padding-bottom: 1rem;
}

.post-item:last-child {
  border-bottom: none;
}

.post-date {
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  margin-bottom: 0.5rem;
}
</style>
