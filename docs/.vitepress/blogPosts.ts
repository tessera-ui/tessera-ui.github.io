import { createContentLoader } from "vitepress";

export interface Post {
  title: string;
  url: string;
  /** ISO date, for <time datetime>. */
  iso: string;
  time: number;
  /** Date formatted for the locale. */
  date: string;
  summary: string;
  author?: string;
  githubName?: string;
  readingTime: number;
}

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const WORD =
  /[a-zA-Z0-9_\u0392-\u03c9\u0400-\u04FF]+|[\u3040-\u309f\u30a0-\u30ff\uff00-\uffef]/g;

export function readingTime(src: string): number {
  const cjk = (src.match(CJK) ?? []).length;
  const words = (src.replace(CJK, " ").match(WORD) ?? []).length;
  return Math.max(1, Math.ceil(cjk / 400 + words / 200));
}

/** The first prose paragraph after the title, as plain text. */
function summarize(src: string, max: number) {
  const body = src
    .replace(/^---[\s\S]*?---/, "")
    .replace(/^```[\s\S]*?^```/gm, "");
  const paragraph =
    body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !/^(#|<|\||>|-|\*|\d+\.|:::)/.test(p)) ?? "";
  const text = paragraph
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max
    ? text.slice(0, max).replace(/[\s,，。.、;；:：]+\S*$/, "") + "…"
    : text;
}

/** Loads the blog posts under `dir` (`en` or `zhHans`), newest first. */
export function blogLoader(dir: "en" | "zhHans") {
  const zh = dir === "zhHans";
  return createContentLoader(`${dir}/blog/*.md`, {
    includeSrc: true,
    transform(raw): Post[] {
      return raw
        .filter(({ url }) => !url.endsWith("/blog/"))
        .map(({ url, frontmatter, src = "" }) => {
          const date = new Date(frontmatter.date);
          return {
            title: frontmatter.title,
            // English pages are served from the site root.
            url: zh ? url : url.replace(/^\/en\//, "/"),
            iso: date.toISOString(),
            time: +date,
            date: date.toLocaleDateString(zh ? "zh-CN" : "en-US", {
              year: "numeric",
              month: zh ? "long" : "short",
              day: "numeric",
            }),
            summary: frontmatter.description ?? summarize(src, zh ? 110 : 220),
            author: frontmatter.author,
            githubName: frontmatter.githubName,
            readingTime: readingTime(src),
          };
        })
        .sort((a, b) => b.time - a.time);
    },
  });
}
