<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useData, withBase } from "vitepress";
import HomeNav from "./HomeNav.vue";
import HatField from "./HatField.vue";
import CopyCommand from "./CopyCommand.vue";
import LiveDemo from "./LiveDemo.vue";
import { copies } from "./copy";
import { DEFAULT_LOCALE, localeByKey } from "../../locales";
import { data as code } from "./code.data";

const { localeIndex } = useData();
const t = computed(
  () =>
    copies[localeByKey(localeIndex.value).code] ?? copies[DEFAULT_LOCALE.code],
);
const href = (link: string) =>
  link.startsWith("http") ? link : withBase(link);

// Publishes how far the hero has scrolled out of view (0..1) as --hero-p, so
// CSS can move the copy and background with the scroll in both directions.
const hero = ref<HTMLElement>();
let frame = 0;
let heroHeight = 1;
let lastP = -1;
const measureHero = () => {
  heroHeight = hero.value?.offsetHeight || 1;
};
const updateHero = () => {
  frame = 0;
  const el = hero.value;
  if (!el) return;
  // Round to steps too small to see, and skip writes once the hero is gone,
  // so scrolling the rest of the page causes no style work.
  const p =
    Math.round(Math.min(Math.max(window.scrollY / heroHeight, 0), 1) * 500) /
    500;
  if (p === lastP) return;
  lastP = p;
  el.style.setProperty("--hero-p", String(p));
};
const onScroll = () => {
  frame ||= requestAnimationFrame(updateHero);
};
const onResize = () => {
  measureHero();
  onScroll();
};
onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  measureHero();
  updateHero();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
});
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", onResize);
});
</script>

<template>
  <div class="th">
    <div class="frame">
      <HomeNav :copy="t" />

      <main>
        <section ref="hero" class="hero" data-hat-host>
          <div class="hero__bg" aria-hidden="true">
            <HatField :focus-x="0.72" :focus-y="0.5" />
            <div class="hero__veil" />
          </div>

          <div class="hero__copy">
            <h1 class="hero__title">
              {{ t.hero.title }}
            </h1>
            <p class="hero__lead">{{ t.hero.lead }}</p>
            <div class="hero__actions">
              <CopyCommand
                command="cargo install cargo-tessera"
                :label="t.copy.label"
                :done="t.copy.done"
              />
              <a class="btn" :href="withBase(t.hero.primary.link)">
                {{ t.hero.primary.text }}
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" />
                </svg>
              </a>
            </div>
          </div>
        </section>

        <section class="showcase">
          <div class="showcase__code">
            <div class="code" v-html="code" />
          </div>

          <div class="showcase__side">
            <div class="showcase__note">
              <p class="cell-label label">{{ t.showcase.noteTitle }}</p>
              <div class="showcase__text">
                <p>{{ t.showcase.note }}</p>
              </div>
            </div>
            <div class="showcase__start">
              <p class="cell-label label">{{ t.showcase.startTitle }}</p>
              <pre
                class="shell"
              ><code><span v-for="line in t.showcase.start" :key="line" class="shell__line"><span class="shell__prompt">$ </span>{{ line }}
</span></code></pre>
            </div>
          </div>
        </section>

        <LiveDemo :copy="t.demo" />

        <section class="features">
          <component
            :is="f.link ? 'a' : 'div'"
            v-for="f in t.features"
            :key="f.title"
            class="feature"
            :href="f.link ? href(f.link) : undefined"
          >
            <h3>{{ f.title }}</h3>
            <p>{{ f.body }}</p>
            <svg
              v-if="f.link"
              class="feature__arrow"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" />
            </svg>
          </component>
        </section>
      </main>

      <footer class="foot label">
        <span>{{ t.footer.license }}</span>
        <nav :aria-label="t.nav.label">
          <a v-for="l in t.footer.links" :key="l.link" :href="href(l.link)">{{
            l.text
          }}</a>
        </nav>
      </footer>
    </div>
  </div>
</template>
