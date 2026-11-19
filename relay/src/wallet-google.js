// "Save to Google Wallet" for any card, signed by the relay's one issuer account (WebCrypto, no dependencies).
//   GOOGLE_WALLET_ISSUER_ID   numeric issuer id (pay.google.com/business/console)
//   GOOGLE_WALLET_SA_KEY      service-account JSON key with Wallet access

const API = "https://walletobjects.googleapis.com/walletobjects/v1";
const enc = new TextEncoder();
const b64u = (buf) => btoa(typeof buf === "string" ? unescape(encodeURIComponent(buf)) : String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function rsaKey(pem) {
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\\n|\s/g, "")), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}
export async function rs256(claims, pem) {
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify(claims));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await rsaKey(pem), enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}

export function genericObject(card, cardUrl, issuer, classId) {
  const t = (value) => ({ defaultValue: { language: "en-US", value: String(value) } });
  const slug = new URL(cardUrl).host.split(".")[0] + "_" + (new URL(cardUrl).pathname.replace(/\W+/g, "_") || "root");
  const abs = (v) => { try { return new URL(v, cardUrl).href; } catch { return ""; } };
  const w = card.wallet || {};
  const text = [
    card.department && { id: "dept", header: "Department", body: card.department },
    card.email && { id: "email", header: "Email", body: card.email },
    card.phone && { id: "phone", header: "Phone", body: card.phone },
    card.researchInterests?.length && { id: "research", header: "Research", body: card.researchInterests.join(", ") }
  ].filter(Boolean);
  const uris = [
    { id: "card", uri: cardUrl, description: "Open card" },
    card.cv && { id: "cv", uri: abs(card.cv), description: "CV" },
    ...(card.links || []).slice(0, 4).map((l, i) => l?.url && { id: `l${i}`, uri: l.url, description: String(l.label || "Link") })
  ].filter(Boolean);
  const o = {
    id: `${issuer}.${slug.toLowerCase().replace(/[^a-z0-9_.-]/g, "_").slice(0, 60)}`,
    classId, state: "ACTIVE",
    cardTitle: t(card.brand?.cardName || "ScholarTap"),
    header: t(card.name || "ScholarTap"),
    subheader: t(card.title || card.organization || " "),
    logo: { sourceUri: { uri: abs("assets/wallet-logo.png") }, contentDescription: t("ScholarTap") },
    hexBackgroundColor: /^#[0-9a-f]{6}$/i.test(w.backgroundColor || "") ? w.backgroundColor : "#BA0C2F",
    barcode: { type: "QR_CODE", value: cardUrl, alternateText: "Scan to swap cards" },
    textModulesData: text,
    linksModuleData: { uris }
  };
  if (card.photo && /^https?:|\.(png|jpe?g|webp)$/i.test(card.photo)) o.heroImage = { sourceUri: { uri: abs(card.photo) }, contentDescription: t(card.name || "") };
  return o;
}

export async function googleWalletLink(card, cardUrl, env) {
  const fetcher = env.__fetch || fetch;
  const sa = JSON.parse(env.GOOGLE_WALLET_SA_KEY);
  const issuer = env.GOOGLE_WALLET_ISSUER_ID;
  const classId = `${issuer}.${env.GOOGLE_WALLET_CLASS_SUFFIX || "scholartap_card"}`;
  const obj = genericObject(card, cardUrl, issuer, classId);
  let payload;
  try {
    const t = Math.floor(Date.now() / 1000);
    const assertion = await rs256({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/wallet_object.issuer", aud: "https://oauth2.googleapis.com/token", iat: t, exp: t + 600 }, sa.private_key);
    const r = await fetcher("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
    if (!r.ok) throw new Error(`token ${r.status}`);
    const token = (await r.json()).access_token;
    const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    const upsert = async (kind, b) => {
      let x = await fetcher(`${API}/${kind}`, { method: "POST", headers, body: JSON.stringify(b) });
      if (x.status === 409) x = await fetcher(`${API}/${kind}/${encodeURIComponent(b.id)}`, { method: "PUT", headers, body: JSON.stringify(b) });
      if (!x.ok) throw new Error(`${kind} ${x.status}`);
    };
    await upsert("genericClass", { id: classId });
    await upsert("genericObject", obj);
    payload = { genericObjects: [{ id: obj.id, classId }] };
  } catch {
    payload = { genericClasses: [{ id: classId }], genericObjects: [obj] };
  }
  const jwt = await rs256({ iss: sa.client_email, aud: "google", typ: "savetowallet", origins: [new URL(cardUrl).origin], payload }, sa.private_key);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
