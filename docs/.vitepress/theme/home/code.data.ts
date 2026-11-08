import { createHighlighter } from "shiki";
import { defineLoader } from "vitepress";
import { appSnippet } from "./snippets";
import { tesseraDark, tesseraLight } from "./shiki-themes";

declare const data: string;
export { data };

export default defineLoader({
  watch: ["./snippets.ts", "./shiki-themes.ts"],
  async load(): Promise<string> {
    const highlighter = await createHighlighter({
      themes: [tesseraDark, tesseraLight],
      langs: ["rust"],
    });
    const html = highlighter.codeToHtml(appSnippet.trim(), {
      lang: "rust",
      themes: { light: "tessera-light", dark: "tessera-dark" },
      defaultColor: false,
    });
    highlighter.dispose();
    return html;
  },
});
