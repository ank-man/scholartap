#!/usr/bin/env node
// Regenerates templates/catalog.json from kit/themes.mjs (+ motifs), then re-applies the
// current template to the repo root.  Run after editing themes or layouts:
//   npm run catalog
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { THEMES } from "./themes.mjs";
import { motif } from "./motifs.mjs";
import { applyTemplate, currentTemplate } from "../scripts/template.mjs";

const root = resolve(import.meta.dirname, "..");
const SANS = "system-ui, sans-serif", SERIF = "Georgia, serif", MONO = "ui-monospace, Menlo, monospace";
const fam = (f, fallback) => (f ? `"${f[0]}", ${fallback}` : undefined);

export function themeCss(t) {
  const p = t.palette;
  if (!p && !t.fonts && !t.motif) return "/* Uses the layout's default look. */\n";
  const [h, b, m] = t.fonts || [];
  const mot = t.motif ? motif(...t.motif) : undefined;
  const common = { "--accent": p?.accent, "--ink": p?.ink, "--muted": p?.muted, "--bg": p?.bg, "--line": p?.line, "--motif": mot };
  const card = p?.card || [];
  const map = {
    classic: { ...common, "--accent-dark": p?.accent2, "--surface": p?.surface, "--chip": p?.soft, "--strong": p?.strong, "--font-head": fam(h, SANS), "--font-body": fam(b, SANS), "--head-case": t.head?.case },
    scholar: { ...common, "--paper": p?.bg, "--rule": p?.line, "--surface": p?.surface, "--serif": fam(h, SERIF), "--sans": fam(b, SANS) },
    minimal: { ...common, "--tile": p?.soft, "--font-head": fam(h, SANS), "--font-body": fam(b, SANS) },
    midnight: { ...common, "--accent-2": p?.accent2, "--card-a": card[0], "--card-b": card[1], "--card-c": card[2], "--font-body": fam(b || h, SANS), "--mono": fam(m, MONO) },
    officer: { ...common, "--accent-dark": p?.accent2, "--card": p?.surface, "--strong": p?.strong, "--soft": p?.soft, "--cond": fam(h, SANS), "--font-body": fam(b, SANS) },
    terminal: { ...common, "--accent-2": p?.accent2, "--surface": p?.surface, "--mono": fam(h, MONO) },
    portfolio: { ...common, "--accent-2": p?.accent2, "--surface": p?.surface, "--font-head": fam(h, SANS), "--font-body": fam(b, SANS), "--head-case": t.head?.case }
  }[t.layout];
  const decl = Object.entries(map).filter(([, v]) => v != null).map(([k, v]) => `  ${k}: ${v};`).join("\n");
  return `/* ${t.name} theme */\n:root {\n${decl}\n}\n`;
}

function fontsHref(fonts) {
  const fams = [...new Map(fonts.map((f) => [f[0], f])).values()];
  return "https://fonts.googleapis.com/css2?" + fams.map(([n, w]) => `family=${n.replace(/ /g, "+")}${w && w !== "400" ? `:wght@${w}` : ""}`).join("&") + "&display=swap";
}

function favicon(accent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${accent}"/><g fill="none" stroke-linecap="round" stroke-width="5"><circle cx="22" cy="32" r="4" fill="#fff" stroke="none"/><path d="M30 22a14 14 0 0 1 0 20M37 15a24 24 0 0 1 0 34M44 8a34 34 0 0 1 0 48" stroke="#fff"/></g></svg>`;
}

function walletFor(t) {
  const p = t.palette;
  return { ...(p && { backgroundColor: p.card?.[1] || p.accent, foregroundColor: "#FFFFFF", labelColor: p.soft || "#EDEDED" }), ...(t.wallet || {}) };
}

const catalog = {
  themes: THEMES.map((t) => ({
    id: t.id, name: t.name, group: t.group, layout: t.layout, tagline: t.tagline, bestFor: t.bestFor,
    accent: t.palette?.accent || "#BA0C2F", bg: t.palette?.bg || null,
    themeColor: t.palette ? (t.layout === "classic" ? t.palette.accent : t.palette.bg) : null,
    fontsHref: t.fonts ? fontsHref(t.fonts) : null, css: themeCss(t), wallet: walletFor(t),
    favicon: t.palette ? favicon(t.palette.accent) : null
  }))
};
await writeFile(resolve(root, "templates/catalog.json"), JSON.stringify(catalog));

const card = JSON.parse(await readFile(resolve(root, "card.json"), "utf8"));
const id = card.template || (await currentTemplate(root)) || "classic";
const t = await applyTemplate({ root, id });
console.log(`✓ templates/catalog.json (${catalog.themes.length} templates) · applied ${t.name}`);
