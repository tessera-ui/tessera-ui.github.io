---
title: Blog
description: Design notes and implementation write-ups from the people building Tessera.
layout: page
---

<script setup>
import BlogIndex from "../../.vitepress/theme/blog/BlogIndex.vue";
import { data as posts } from "./posts.data.ts";
</script>

<BlogIndex :posts="posts" />
