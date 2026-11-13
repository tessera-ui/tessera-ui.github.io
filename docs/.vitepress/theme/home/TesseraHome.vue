<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
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
// The chapter band and the code panel reveal themselves once they scroll into
// view. They start hidden only after mounting, so without JavaScript or with
// reduced motion they are simply shown.
const chapter = ref<HTMLElement>();
const showcase = ref<HTMLElement>();
const waiting = reactive({ chapter: false, showcase: false });
let reveal: IntersectionObserver | undefined;

function watchReveal() {
  if (!chapter.value || !showcase.value) return;
  // The code lines cascade in order; CSS staggers them by this index.
  showcase.value
    .querySelectorAll<HTMLElement>(".code .line")
    .forEach((line, i) => line.style.setProperty("--i", String(i)));
  waiting.chapter = waiting.showcase = true;
  reveal = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        waiting[entry.target === chapter.value ? "chapter" : "showcase"] =
          false;
        reveal?.unobserve(entry.target);
      }
    },
    { threshold: 0.2 },
  );
  reveal.observe(chapter.value);
  reveal.observe(showcase.value);
}

onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  measureHero();
  updateHero();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  watchReveal();
});
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  reveal?.disconnect();
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

        <section
          ref="chapter"
          class="chapter"
          :class="{ 'is-waiting': waiting.chapter }"
        >
          <span class="chapter__rule" aria-hidden="true" />
          <span class="chapter__rule chapter__rule--end" aria-hidden="true" />
          <h2 class="chapter__title">
            <span>{{ t.chapter.lead }}</span>
            <span>{{ t.chapter.rest }}</span>
          </h2>
          <div class="chapter__tiles" aria-hidden="true">
            <span v-for="i in 12" :key="i" :style="{ '--i': i - 1 }" />
          </div>
        </section>

        <section
          ref="showcase"
          class="showcase"
          :class="{ 'is-waiting': waiting.showcase }"
        >
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
