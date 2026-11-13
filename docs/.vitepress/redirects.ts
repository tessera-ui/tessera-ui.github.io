import fs from "node:fs/promises";
import path from "node:path";

// Keep links to the former guide and widget reference usable without retaining
// obsolete articles in the sidebar, search index or sitemap.
const formerComponents = [
  "bottom_nav_bar",
  "bottom_sheet",
  "boxed",
  "button",
  "checkbox",
  "column",
  "dialog",
  "fluid_glass",
  "getting-started",
  "glass_button",
  "glass_progress",
  "glass_slider",
  "glass_switch",
  "image",
  "progress",
  "row",
  "side_bar",
  "slider",
  "spacer",
  "surface",
  "switch",
  "tabs",
  "text",
  "text_editor",
];

export async function writeLegacyRedirects(outDir: string) {
  for (const prefix of ["", "zhHans/"]) {
    const routes: [string, string][] = [
      ["guide/component.html", "guide/thinking-in-tessera"],
      ["guide/plugin.html", "guide/plugins"],
      ["guide/shard.html", "guide/navigation"],
      ["guide/semantics.html", "guide/accessibility"],
      ["about/index.html", "guide/"],
      ["about.html", "guide/"],
      ["components/index.html", "guide/theming"],
      ["components.html", "guide/theming"],
      ...formerComponents.map((slug): [string, string] => [
        `components/${slug}.html`,
        "guide/theming",
      ]),
    ];
    for (const [from, to] of routes) {
      const destination = `/${prefix}${to}`;
      const filename = path.join(outDir, prefix, from);
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(
        filename,
        `<!doctype html>
<html lang="${prefix ? "zh-CN" : "en"}"><head>
<meta charset="utf-8"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0;url=${destination}">
<link rel="canonical" href="https://tessera-ui.github.io${destination}">
<title>Tessera</title></head><body>
<a href="${destination}">${prefix ? "文档已迁移，继续阅读" : "Documentation has moved. Continue reading"}</a>
</body></html>\n`,
      );
    }
  }
}
