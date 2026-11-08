import type { ThemeRegistration } from "shiki";

interface Palette {
  fg: string;
  muted: string;
  comment: string;
  keyword: string;
  fn: string;
  type: string;
  string: string;
  number: string;
  attr: string;
  macro: string;
}

function theme(name: string, type: "dark" | "light", c: Palette): ThemeRegistration {
  return {
    name,
    type,
    colors: { "editor.background": "#00000000", "editor.foreground": c.fg },
    tokenColors: [
      { settings: { foreground: c.fg } },
      { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: c.comment, fontStyle: "italic" } },
      {
        scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.other", "keyword.control", "variable.language.self"],
        settings: { foreground: c.keyword },
      },
      { scope: ["keyword.operator", "punctuation", "meta.brace"], settings: { foreground: c.muted } },
      { scope: ["entity.name.function", "support.function", "meta.function-call"], settings: { foreground: c.fn } },
      { scope: ["entity.name.function.macro", "support.macro"], settings: { foreground: c.macro } },
      { scope: ["entity.name.type", "support.type", "entity.name.namespace", "storage.type.core", "entity.name.struct"], settings: { foreground: c.type } },
      { scope: ["string", "string.quoted", "punctuation.definition.string"], settings: { foreground: c.string } },
      { scope: ["constant.numeric", "constant.language", "constant.other"], settings: { foreground: c.number } },
      { scope: ["meta.attribute", "punctuation.definition.attribute", "entity.other.attribute-name"], settings: { foreground: c.attr } },
      { scope: ["variable.parameter", "variable.other"], settings: { foreground: c.fg } },
    ],
  };
}

export const tesseraDark = theme("tessera-dark", "dark", {
  fg: "#dfe3f1",
  muted: "#8890aa",
  comment: "#5d6683",
  keyword: "#a5b4fc",
  fn: "#67e8f9",
  type: "#c4b5fd",
  string: "#fcd38d",
  number: "#f9a8d4",
  attr: "#7dd3fc",
  macro: "#5eead4",
});

export const tesseraLight = theme("tessera-light", "light", {
  fg: "#1d2233",
  muted: "#6b7286",
  comment: "#8a91a6",
  keyword: "#4f46e5",
  fn: "#0e7490",
  type: "#7c3aed",
  string: "#b45309",
  number: "#be185d",
  attr: "#0369a1",
  macro: "#0f766e",
});
