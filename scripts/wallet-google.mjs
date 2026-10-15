// Google Wallet — "Save to Google Wallet" link carrying a signed JWT with a Generic pass.
//
// Needs a (free) Google Wallet issuer account + a service account with Wallet access:
//   GOOGLE_WALLET_ISSUER_ID   numeric issuer id from pay.google.com/business/console
//   GOOGLE_WALLET_SA_KEY      the service-account JSON key (whole file contents)
// The JWT only contains public card data and is safe to publish; the private key stays in CI secrets.

export async function buildGoogle({ card, siteUrl, env }) {
  if (!env.GOOGLE_WALLET_ISSUER_ID || !env.GOOGLE_WALLET_SA_KEY) return null;
  if (!siteUrl) throw new Error("SITE_URL is required (Google fetches the logo from it)");

  const jwt = (await import("jsonwebtoken")).default;
  const sa = JSON.parse(env.GOOGLE_WALLET_SA_KEY);
  const issuer = env.GOOGLE_WALLET_ISSUER_ID;
  const classId = `${issuer}.${env.GOOGLE_WALLET_CLASS_SUFFIX || "gsa_connect_card"}`;
  const objectId = `${issuer}.${(card.slug || card.name).toLowerCase().replace(/[^a-z0-9_.-]/g, "_")}`;
  const t = (value) => ({ defaultValue: { language: "en-US", value: String(value) } });
  const w = card.wallet || {};

  const textModules = [
    card.gsaRole && { id: "gsa", header: card.brand?.orgShort || "GSA", body: card.gsaRole },
    card.department && { id: "dept", header: "Department", body: card.department },
    card.email && { id: "email", header: "Email", body: card.email },
    card.phone && { id: "phone", header: "Phone", body: card.phone },
    card.researchInterests?.length && { id: "research", header: "Research", body: card.researchInterests.join(", ") }
  ].filter(Boolean);

  const uris = [
    { id: "card", uri: siteUrl, description: "Open digital card" },
    card.cv && { id: "cv", uri: new URL(card.cv, siteUrl).href, description: "CV" },
    card.website && { id: "web", uri: card.website, description: "Website" },
    ...(card.links || []).slice(0, 5).map((l, i) => ({ id: `l${i}`, uri: l.url, description: l.label }))
  ].filter(Boolean);

  const genericObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    cardTitle: t(card.brand?.cardName || "ScholarTap"),
    header: t(card.name),
    subheader: t(card.title || card.brand?.org || ""),
    logo: { sourceUri: { uri: new URL("assets/wallet-logo.png", siteUrl).href }, contentDescription: t("ScholarTap") },
    hexBackgroundColor: w.backgroundColor || "#BA0C2F",
    barcode: { type: "QR_CODE", value: siteUrl, alternateText: "Scan to connect" },
    textModulesData: textModules,
    linksModuleData: { uris }
  };
  if (card.photo && /^https?:|\.(png|jpe?g)$/i.test(card.photo)) {
    genericObject.heroImage = { sourceUri: { uri: new URL(card.photo, siteUrl).href }, contentDescription: t(card.name) };
  }

  // Preferred: upsert class + object through the REST API, then sign a short "skinny" JWT (id only).
  // Fallback: embed everything in the JWT (works without API access, but the link gets long).
  let payload;
  try {
    const token = await accessToken(jwt, sa);
    await upsert(token, "genericClass", { id: classId });
    await upsert(token, "genericObject", genericObject);
    payload = { genericObjects: [{ id: objectId, classId }] };
  } catch (e) {
    console.warn(`  ! Wallet API upsert failed (${e.message}); embedding the pass in the link instead.`);
    payload = { genericClasses: [{ id: classId }], genericObjects: [genericObject] };
  }

  const claims = { iss: sa.client_email, aud: "google", typ: "savetowallet", origins: [new URL(siteUrl).origin], payload };
  const url = `https://pay.google.com/gp/v/save/${jwt.sign(claims, sa.private_key, { algorithm: "RS256" })}`;
  if (url.length > 1800) console.warn(`  ! Google Wallet link is ${url.length} chars; some browsers may refuse it.`);
  return url;
}

const API = "https://walletobjects.googleapis.com/walletobjects/v1";

async function accessToken(jwt, sa) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: sa.client_email, scope: "https://www.googleapis.com/auth/wallet_object.issuer", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 600 },
    sa.private_key, { algorithm: "RS256" }
  );
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  });
  if (!r.ok) throw new Error(`token ${r.status}`);
  return (await r.json()).access_token;
}

async function upsert(token, kind, body) {
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  let r = await fetch(`${API}/${kind}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (r.status === 409) r = await fetch(`${API}/${kind}/${encodeURIComponent(body.id)}`, { method: "PUT", headers, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${kind} ${r.status}`);
}
