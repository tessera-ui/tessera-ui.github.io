---
title: Blog
---

<script setup>
import { data as posts } from './posts.data.ts'
</script>

# Blog

Welcome to the Tessera Blog.

<div v-for="post in posts" :key="post.url" class="post-item">
  <h2>
    <a :href="post.url">{{ post.title }}</a>
  </h2>
  <div class="post-date">
    <span v-if="post.author">By {{ post.author }} | </span>
    <span>{{ post.date.string }}</span>
    <span class="meta-info"> | Words: {{ post.wordCount }} | Reading Time: {{ post.readingTime }} min</span>
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
