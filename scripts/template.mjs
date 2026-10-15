// Template switching. Every card repo ships all layouts + theme styles in templates/,
// so a card can become any of the ScholarTap templates without re-cloning.
//
//   npm run setup        → pick one in the form (live preview)
//   card.json "template" → change it on GitHub; the CI build applies it
//   node scripts/template.mjs law      → switch from the command line
//   node scripts/template.mjs --list
import { readFile, writeFile, cp } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function loadCatalog(root) {
  return JSON.parse(await readFile(resolve(root, "templates/catalog.json"), "utf8"));
}

// The template currently applied to a folder (marker on the first line of css/theme.css).
export async function currentTemplate(dir) {
  try { return (await readFile(resolve(dir, "css/theme.css"), "utf8")).match(/^\/\* template:([\w-]+)/)?.[1] || null; }
  catch { return null; }
}

// Writes index.html, css/style.css, css/theme.css, favicon.svg and the manifest colours for template `id`
// into `dest` (defaults to the repo itself). Card data, photo and CV are never touched.
export async function applyTemplate({ root, dest = root, id }) {
  const catalog = await loadCatalog(root);
  const t = catalog.themes.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown template "${id}". Run: node scripts/template.mjs --list`);
  const layoutDir = resolve(root, "templates/layouts", t.layout);

  let html = await readFile(resolve(layoutDir, "index.html"), "utf8");
  html = html.replace('<link rel="stylesheet" href="css/style.css">', '<link rel="stylesheet" href="css/style.css">\n  <link rel="stylesheet" href="css/theme.css">');
  if (t.fontsHref) html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]+" rel="stylesheet">/, `<link href="${t.fontsHref}" rel="stylesheet">`);
  if (t.themeColor) html = html.replace(/<meta name="theme-color" content="[^"]*">/, `<meta name="theme-color" content="${t.themeColor}">`);
  html = html.replace(/<!-- (?:TEMPLATE|LAYOUT): [^—]+—/, `<!-- ${t.name} template · ${t.layout} layout —`);

  await writeFile(resolve(dest, "index.html"), html);
  await cp(resolve(layoutDir, "style.css"), resolve(dest, "css/style.css"));
  await writeFile(resolve(dest, "css/theme.css"), `/* template:${t.id} */\n${t.css}`);
  if (t.favicon) await writeFile(resolve(dest, "favicon.svg"), t.favicon);

  try {
    const mp = resolve(dest, "manifest.webmanifest");
    const m = JSON.parse(await readFile(mp, "utf8"));
    m.name = `${t.name} · ScholarTap`;
    if (t.themeColor) m.theme_color = t.themeColor;
    if (t.bg) m.background_color = t.bg;
    await writeFile(mp, JSON.stringify(m, null, 2) + "\n");
  } catch {}
  return t;
}

// CLI
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const root = resolve(import.meta.dirname, "..");
  const arg = process.argv[2];
  const catalog = await loadCatalog(root);
  if (!arg || arg === "--list") {
    const cur = await currentTemplate(root);
    let group = "";
    for (const t of catalog.themes) {
      if (t.group !== group) console.log(`\n${(group = t.group)}`);
      console.log(`  ${t.id === cur ? "●" : " "} ${t.id.padEnd(26)} ${t.name}`);
    }
    console.log("\nSwitch with: node scripts/template.mjs <id>");
  } else {
    const t = await applyTemplate({ root, id: arg });
    const cardPath = resolve(root, "card.json");
    const card = JSON.parse(await readFile(cardPath, "utf8"));
    card.template = t.id;
    if (t.wallet) card.wallet = { ...card.wallet, ...t.wallet };
    await writeFile(cardPath, JSON.stringify(card, null, 2) + "\n");
    console.log(`✓ Switched to ${t.name} (${t.layout} layout). Your details are unchanged.`);
  }
}
