#!/usr/bin/env node
// Regenerates templates/previews/<id>.jpg (the thumbnails in the setup app's template picker),
// rendering each template with its sample persona from kit/themes.mjs.
//   npm i -D playwright-core && npx playwright install chromium
//   node kit/screenshots.mjs [id…]          (CHROME_PATH=… to use an existing Chrome)
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { THEMES } from "./themes.mjs";

const root = resolve(import.meta.dirname, "..");
const port = 4199, base = `http://localhost:${port}/`;
const catalog = JSON.parse(await readFile(resolve(root, "templates/catalog.json"), "utf8"));
const sample = JSON.parse(await readFile(resolve(root, "card.json"), "utf8"));

function personaCard(t) {
  const card = structuredClone(sample);
  const persona = t.persona || {};
  if (Object.keys(persona).length) {
    for (const k of ["publications", "projects", "education", "awards"]) card[k] = [];
    Object.assign(card, {
      slug: persona.name.toLowerCase().replace(/[^a-z]+/g, "-"), email: "yourname@uga.edu", photo: "", gsaRole: "GSA Member",
      officeHours: "By appointment · use the booking link", badgeLabel: "GSA Member",
      bio: `Graduate student at the University of Georgia. ${persona.headline || ""} Open to collaborations, mentoring and good conversations.`,
      education: [{ degree: persona.title, school: "University of Georgia", years: "2024 – present" }]
    });
  }
  return { ...card, ...persona, setup: true, siteUrl: "https://yourname.github.io/card/" };
}

const server = spawn(process.execPath, [resolve(root, "scripts/dev.mjs")], { env: { ...process.env, PORT: String(port), NO_OPEN: "1" }, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5 });
const only = process.argv.slice(2);

for (const t of THEMES.filter((t) => !only.length || only.includes(t.id))) {
  const c = catalog.themes.find((x) => x.id === t.id);
  let html = await readFile(resolve(root, "templates/layouts", c.layout, "index.html"), "utf8");
  html = html
    .replace("<head>", `<head><base href="${base}">`)
    .replace('<link rel="stylesheet" href="css/style.css">', `<link rel="stylesheet" href="templates/layouts/${c.layout}/style.css"><style>${c.css}</style>`)
    .replace('<script src="js/card.js" defer></script>', `<script>window.GSA_CARD=${JSON.stringify(personaCard(t)).replace(/</g, "\\u003c")}</script><script src="js/card.js" defer></script>`);
  if (c.fontsHref) html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]+" rel="stylesheet">/, `<link href="${c.fontsHref}" rel="stylesheet">`);
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: resolve(root, "templates/previews", `${t.id}.jpg`), type: "jpeg", quality: 78 });
  console.log("📸", t.id);
}
await browser.close();
server.kill();
