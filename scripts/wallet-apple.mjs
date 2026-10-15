// Apple Wallet (.pkpass) — generic pass with a QR code that opens the card.
//
// Needs an Apple Developer account (one account can sign passes for a whole GSA):
//   APPLE_PASS_TYPE_ID            e.g. pass.edu.uga.gsa.connect
//   APPLE_TEAM_ID                 10-char team id
//   APPLE_SIGNER_CERT             PEM of the Pass Type ID certificate
//   APPLE_SIGNER_KEY              PEM of its private key
//   APPLE_SIGNER_KEY_PASSPHRASE   (optional)
//   APPLE_WWDR_CERT               PEM of Apple WWDR G4 intermediate
// See docs/WALLET-SETUP.md for how to export these.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const pem = (v) => (v || "").replace(/\\n/g, "\n");

export async function buildApple({ card, root, dist, siteUrl, env }) {
  const need = ["APPLE_PASS_TYPE_ID", "APPLE_TEAM_ID", "APPLE_SIGNER_CERT", "APPLE_SIGNER_KEY", "APPLE_WWDR_CERT"];
  if (need.some((k) => !env[k])) return null;
  if (!siteUrl) throw new Error("SITE_URL is required for the pass QR code");

  const { PKPass } = await import("passkit-generator");
  const modelDir = resolve(root, "wallet/apple/model.pass");
  const buffers = {};
  for (const f of await readdir(modelDir)) buffers[f] = await readFile(resolve(modelDir, f));

  const w = card.wallet || {};
  const pass = new PKPass(
    buffers,
    {
      wwdr: pem(env.APPLE_WWDR_CERT),
      signerCert: pem(env.APPLE_SIGNER_CERT),
      signerKey: pem(env.APPLE_SIGNER_KEY),
      signerKeyPassphrase: env.APPLE_SIGNER_KEY_PASSPHRASE || undefined
    },
    {
      serialNumber: `gsa-connect-${card.slug || "card"}`,
      passTypeIdentifier: env.APPLE_PASS_TYPE_ID,
      teamIdentifier: env.APPLE_TEAM_ID,
      organizationName: card.brand?.org || "Graduate Student Association",
      description: `${card.brand?.cardName || "GSA Connect"} card for ${card.name}`,
      logoText: card.brand?.cardName || "GSA Connect",
      backgroundColor: hexToRgb(w.backgroundColor || "#BA0C2F"),
      foregroundColor: hexToRgb(w.foregroundColor || "#FFFFFF"),
      labelColor: hexToRgb(w.labelColor || "#F6E7EA")
    }
  );

  pass.primaryFields.push({ key: "name", label: card.pronouns ? `NAME · ${card.pronouns}` : "NAME", value: card.name });
  pass.secondaryFields.push({ key: "title", label: "ROLE", value: card.title || "" });
  if (card.gsaRole) pass.auxiliaryFields.push({ key: "gsa", label: card.brand?.orgShort || "GSA", value: card.gsaRole });
  if (card.department) pass.auxiliaryFields.push({ key: "dept", label: "DEPARTMENT", value: card.department });

  const back = [
    ["card", "DIGITAL CARD", siteUrl],
    ["email", "EMAIL", card.email],
    ["phone", "PHONE", card.phone],
    ["website", "WEBSITE", card.website],
    ["cv", "CV", card.cv && new URL(card.cv, siteUrl).href],
    ["research", "RESEARCH", (card.researchInterests || []).join(", ")],
    ["bio", "ABOUT", card.bio],
    ...(card.links || []).map((l, i) => [`link${i}`, l.label.toUpperCase(), l.url]),
    ["powered", "", `Powered by ${card.poweredBy?.name || "ScholarTap"}`]
  ];
  for (const [key, label, value] of back) if (value) pass.backFields.push({ key, label, value, dataDetectorTypes: ["PKDataDetectorTypeLink", "PKDataDetectorTypePhoneNumber"] });

  pass.setBarcodes({ message: siteUrl, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: "Scan to connect" });

  // Pass thumbnail: assets/wallet-thumbnail.png (made by `npm run setup`), else a PNG profile photo.
  for (const f of ["assets/wallet-thumbnail.png", /\.png$/i.test(card.photo || "") && card.photo]) {
    if (!f) continue;
    try { pass.addBuffer("thumbnail.png", await readFile(resolve(root, f))); break; } catch {}
  }

  await writeFile(resolve(dist, "wallet", "card.pkpass"), pass.getAsBuffer());
  return "wallet/card.pkpass";
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
