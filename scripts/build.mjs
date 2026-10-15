#!/usr/bin/env node
// Builds the deployable site into ./dist:
//   - copies the static card (index.html, card.json, css, js, assets, manifest)
//   - writes card.vcf (save-contact file) and qr.svg / qr.png (for printing / NFC cards)
//   - builds Apple / Google / Samsung wallet passes when their secrets are set
//   - writes dist/wallet/wallet.json so the page only shows buttons that work
//
// Usage: npm run build            (SITE_URL=https://you.github.io/repo/ npm run build)
import { cp, mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { buildApple } from "./wallet-apple.mjs";
import { buildGoogle } from "./wallet-google.mjs";
import { buildSamsung } from "./wallet-samsung.mjs";
import { toVCard } from "./vcard.mjs";
import { applyTemplate, currentTemplate } from "./template.mjs";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const exists = (p) => access(p).then(() => true, () => false);

const card = JSON.parse(await readFile(resolve(root, "card.json"), "utf8"));
let siteUrl = (process.env.SITE_URL || card.siteUrl || "").trim();
if (siteUrl && !siteUrl.endsWith("/")) siteUrl += "/";
card.siteUrl = siteUrl;

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "wallet"), { recursive: true });

for (const f of ["index.html", "nfc.html", "app", "templates", "card.json", "manifest.webmanifest", ".nojekyll", "favicon.svg", "css", "js", "assets"]) {
  if (await exists(resolve(root, f))) await cp(resolve(root, f), resolve(dist, f), { recursive: true });
}
// "template" in card.json wins when it differs from what's applied in the repo (e.g. edited on GitHub).
if (card.template && card.template !== (await currentTemplate(root)) && (await exists(resolve(root, "templates/catalog.json")))) {
  const t = await applyTemplate({ root, dest: dist, id: card.template });
  console.log(`✓ template → ${t.name}`);
}
// Bake the resolved URL into the deployed card.json so QR codes / shares use the canonical link.
await writeFile(resolve(dist, "card.json"), JSON.stringify(card, null, 2));

await writeFile(resolve(dist, "card.vcf"), toVCard(card));
console.log("✓ card.vcf");

if (siteUrl) {
  try {
    const QR = (await import("qrcode")).default;
    await writeFile(resolve(dist, "qr.svg"), await QR.toString(siteUrl, { type: "svg", margin: 2, errorCorrectionLevel: "M" }));
    await QR.toFile(resolve(dist, "qr.png"), siteUrl, { width: 1024, margin: 2, errorCorrectionLevel: "M" });
    console.log("✓ qr.svg / qr.png →", siteUrl);
  } catch (e) {
    console.log("· QR skipped (run npm install):", e.message);
  }
} else {
  console.log("· No SITE_URL yet — QR + wallet passes need the public URL (set in CI automatically).");
}

const wallet = {};
const steps = [
  ["apple", buildApple],
  ["google", buildGoogle],
  ["samsung", buildSamsung]
];
for (const [name, fn] of steps) {
  try {
    const url = await fn({ card, root, dist, siteUrl, env: process.env });
    if (url) { wallet[name] = url; console.log(`✓ ${name} wallet`); }
  } catch (e) {
    console.warn(`✗ ${name} wallet failed: ${e.message}`);
    if (process.env.WALLET_STRICT === "1") process.exitCode = 1;
  }
}
await writeFile(resolve(dist, "wallet", "wallet.json"), JSON.stringify(wallet, null, 2));
console.log(`\nBuilt → ${dist}`);
