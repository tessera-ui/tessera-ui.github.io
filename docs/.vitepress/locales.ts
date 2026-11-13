/**
 * The site's languages. To add one, add an entry here, a matching locale to
 * vitepress-i18n, its pages under docs/<key>/, its homepage copy and its
 * sidebar and nav titles in config.ts.
 */
export interface Locale {
  /** VitePress locale key; `root` is the default language. */
  key: string;
  /** Short code: the stored preference and the key of the homepage copy. */
  code: string;
  /** BCP 47 tag for `lang` and `hreflang`, and for matching browser languages. */
  lang: string;
  /** The language's name in itself, as shown in the language menu. */
  label: string;
  /** URL prefix of its pages; empty for the default language. */
  prefix: string;
}

export const LOCALES: Locale[] = [
  { key: "root", code: "en", lang: "en-US", label: "English", prefix: "" },
  {
    key: "zhHans",
    code: "zh",
    lang: "zh-CN",
    label: "简体中文",
    prefix: "/zhHans",
  },
];

export const DEFAULT_LOCALE = LOCALES[0];

export function localeByKey(key: string): Locale {
  return LOCALES.find((locale) => locale.key === key) ?? DEFAULT_LOCALE;
}

export function localeByCode(code: string | null): Locale | undefined {
  return LOCALES.find((locale) => locale.code === code);
}

const owns = (locale: Locale, path: string) =>
  locale.prefix !== "" &&
  (path === locale.prefix || path.startsWith(locale.prefix + "/"));

/** The language of a site path (without the base). */
export function localeOfPath(path: string): Locale {
  return LOCALES.find((locale) => owns(locale, path)) ?? DEFAULT_LOCALE;
}

/** The same page in another language, or null when it isn't a site path. */
export function translatePath(path: string, target: Locale): string {
  const from = localeOfPath(path);
  const rest = path.slice(from.prefix.length) || "/";
  return target.prefix + (rest === "/" && target.prefix ? "/" : rest);
}

/** The first browser language the site has, matched by primary language. */
export function localeForBrowser(languages: readonly string[]) {
  for (const language of languages) {
    const primary = language.split("-")[0].toLowerCase();
    const match = LOCALES.find(
      (locale) => locale.lang.split("-")[0].toLowerCase() === primary,
    );
    if (match) return match;
  }
  return undefined;
}
