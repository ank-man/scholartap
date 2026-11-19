// Apple Wallet (.pkpass) for ANY card, signed by one shared Pass Type ID certificate.
// One Apple Developer account (UGA's, or GSA's at $99/yr) covers every student: no keys in student repos.
//   APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_SIGNER_CERT, APPLE_SIGNER_KEY, APPLE_SIGNER_KEY_PASSPHRASE?, APPLE_WWDR_CERT
// A .pkpass is a zip: pass.json + images + manifest.json (SHA-1 of each file) + signature (detached PKCS#7 of the manifest).
import forge from "node-forge";
import { zipSync, strToU8 } from "fflate";

const pem = (v) => String(v || "").replace(/\\n/g, "\n");
const sha1 = (bytes) => { const md = forge.md.sha1.create(); md.update(u8ToBin(bytes)); return md.digest().toHex(); };
const u8ToBin = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return s; };
const binToU8 = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const rgb = (hex, d) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || "") || /^#?([0-9a-f]{6})$/i.exec(d); const n = parseInt(m[1], 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };

export const appleReady = (env) => ["APPLE_PASS_TYPE_ID", "APPLE_TEAM_ID", "APPLE_SIGNER_CERT", "APPLE_SIGNER_KEY", "APPLE_WWDR_CERT"].every((k) => env[k]);

export function passJson(card, cardUrl, env) {
  const w = card.wallet || {};
  const abs = (v) => { try { return new URL(v, cardUrl).href; } catch { return ""; } };
  const slug = new URL(cardUrl).host.split(".")[0] + new URL(cardUrl).pathname.replace(/\W+/g, "-");
  const back = [
    ["card", "DIGITAL CARD", cardUrl], ["email", "EMAIL", card.email], ["phone", "PHONE", card.phone], ["website", "WEBSITE", card.website],
    ["cv", "CV", card.cv && abs(card.cv)], ["research", "RESEARCH", (card.researchInterests || []).join(", ")], ["bio", "ABOUT", card.bio],
    ...(card.links || []).slice(0, 8).map((l, i) => [`link${i}`, String(l?.label || "LINK").toUpperCase(), l?.url]),
    ["powered", "", "ScholarTap · developed by Ankush Sharma at the University of Georgia"]
  ].filter(([, , v]) => v).map(([key, label, value]) => ({ key, label, value: String(value).slice(0, 2000), dataDetectorTypes: ["PKDataDetectorTypeLink", "PKDataDetectorTypePhoneNumber"] }));
  return {
    formatVersion: 1,
    passTypeIdentifier: env.APPLE_PASS_TYPE_ID,
    teamIdentifier: env.APPLE_TEAM_ID,
    serialNumber: `scholartap-${slug}`.slice(0, 100),
    organizationName: "ScholarTap · GSA Connect UGA",
    description: `ScholarTap card for ${card.name || "a student"}`,
    logoText: card.brand?.cardName || "ScholarTap",
    backgroundColor: rgb(w.backgroundColor, "#BA0C2F"),
    foregroundColor: rgb(w.foregroundColor, "#FFFFFF"),
    labelColor: rgb(w.labelColor, "#F6E7EA"),
    barcodes: [{ format: "PKBarcodeFormatQR", message: `${cardUrl}?via=qr`, messageEncoding: "iso-8859-1", altText: "Scan to swap cards" }],
    generic: {
      primaryFields: [{ key: "name", label: card.pronouns ? `NAME · ${card.pronouns}` : "NAME", value: card.name || "" }],
      secondaryFields: card.title ? [{ key: "title", label: "ROLE", value: card.title }] : [],
      auxiliaryFields: [card.department && { key: "dept", label: "DEPARTMENT", value: card.department }].filter(Boolean),
      backFields: back
    }
  };
}

// RSA runs in WebCrypto (native, fast): node-forge only builds the PKCS#7 structure, which keeps a pass well
// inside the Workers Free plan's 10 ms CPU budget. The key is imported once per isolate and reused.
const keyCache = new Map();
async function signerKey(env) {
  const id = env.APPLE_SIGNER_KEY;
  if (!keyCache.has(id)) {
    const keyPem = pem(env.APPLE_SIGNER_KEY);
    let pkcs8;
    if (/BEGIN PRIVATE KEY/.test(keyPem) && !env.APPLE_SIGNER_KEY_PASSPHRASE) {
      // Fast path (recommended for the free plan): unencrypted PKCS#8, imported natively by WebCrypto.
      pkcs8 = Uint8Array.from(atob(keyPem.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
    } else {
      const k = env.APPLE_SIGNER_KEY_PASSPHRASE ? forge.pki.decryptRsaPrivateKey(keyPem, env.APPLE_SIGNER_KEY_PASSPHRASE) : forge.pki.privateKeyFromPem(keyPem);
      if (!k) throw new Error("Couldn't open APPLE_SIGNER_KEY (check the passphrase)");
      pkcs8 = binToU8(forge.asn1.toDer(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(k))).getBytes());
    }
    const signer = forge.pki.certificateFromPem(pem(env.APPLE_SIGNER_CERT));
    keyCache.set(id, {
      key: await crypto.subtle.importKey("pkcs8", pkcs8, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]),
      signer, wwdr: forge.pki.certificateFromPem(pem(env.APPLE_WWDR_CERT)),
      bits: signer.publicKey.n.bitLength()
    });
  }
  return keyCache.get(id);
}

export async function signManifest(manifestBytes, env) {
  const { key, signer, wwdr, bits } = await signerKey(env);
  const when = new Date();
  // forge lays out the PKCS#7 and calls key.sign() synchronously; WebCrypto is async. Pass 1 uses a placeholder
  // signature to get the exact signed attributes (fixed signing time), WebCrypto signs their DER as a SET
  // (RFC 2315), and pass 2 rebuilds the structure with the real signature.
  const build = (sig) => {
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(u8ToBin(manifestBytes));
    p7.addCertificate(signer);
    p7.addCertificate(wwdr);
    p7.addSigner({
      key: { sign: () => sig }, certificate: signer, digestAlgorithm: forge.pki.oids.sha256,
      authenticatedAttributes: [{ type: forge.pki.oids.contentType, value: forge.pki.oids.data }, { type: forge.pki.oids.messageDigest }, { type: forge.pki.oids.signingTime, value: when }]
    });
    p7.sign({ detached: true });
    return p7;
  };
  const draft = build("\0".repeat(Math.ceil(bits / 8)));
  const attrs = draft.signers[0].authenticatedAttributesAsn1;
  const setDer = binToU8(forge.asn1.toDer(forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, attrs.value)).getBytes());
  const sig = u8ToBin(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, setDer)));
  return binToU8(forge.asn1.toDer(build(sig).toAsn1()).getBytes());
}

// images: { "icon.png": Uint8Array, "logo.png": Uint8Array, ... } (icon.png is required by Wallet)
export async function buildPkpass(card, cardUrl, images, env) {
  const files = { "pass.json": strToU8(JSON.stringify(passJson(card, cardUrl, env))), ...images };
  const manifest = {};
  for (const [name, bytes] of Object.entries(files)) manifest[name] = sha1(bytes);
  const manifestBytes = strToU8(JSON.stringify(manifest));
  return zipSync({ ...files, "manifest.json": manifestBytes, signature: await signManifest(manifestBytes, env) }, { level: 0 });
}

export async function applePass(card, cardUrl, env) {
  const fetcher = env.__fetch || fetch;
  const get = async (path) => { try { const r = await fetcher(new URL(path, cardUrl).href); return r.ok ? new Uint8Array(await r.arrayBuffer()) : null; } catch { return null; } };
  const icon = (await get("assets/icon-192.png")) || (await get("assets/apple-touch-icon.png"));
  if (!icon) throw new Error("The card has no icon image (assets/icon-192.png)");
  const images = { "icon.png": icon, "icon@2x.png": icon };
  const logo = await get("assets/wallet-logo.png");
  if (logo) { images["logo.png"] = logo; images["logo@2x.png"] = logo; }
  const thumb = (await get("assets/wallet-thumbnail.png")) || (/\.png$/i.test(card.photo || "") ? await get(card.photo) : null);
  if (thumb) { images["thumbnail.png"] = thumb; images["thumbnail@2x.png"] = thumb; }
  return await buildPkpass(card, cardUrl, images, env);
}
