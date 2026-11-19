// Web Push "someone tapped you" pings (iPhone home-screen apps on iOS 16.4+, Android, desktop). Free: no push vendor.
// Pushes carry NO payload, so no message encryption is needed: the service worker shows "New tap" and the app loads
// the inbox when opened. Only VAPID (an ES256-signed JWT) is required:
//   VAPID_PUBLIC_KEY   base64url uncompressed P-256 point (65 bytes)  ┐ `npm run vapid` prints both
//   VAPID_PRIVATE_KEY  base64url 32-byte private scalar               ┘
//   VAPID_SUBJECT      mailto: or https: contact for push services (optional)
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const enc = new TextEncoder();

export const pushReady = (env) => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

// Only real browser push services, so the relay can't be pointed at arbitrary URLs.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /\.notify\.windows\.com$/, /^android\.googleapis\.com$/];
export function validEndpoint(raw) {
  try { const u = new URL(raw); return u.protocol === "https:" && PUSH_HOSTS.some((r) => r.test(u.hostname)) ? u.href : null; } catch { return null; }
}

async function vapidKey(env) {
  const pub = unb64u(env.VAPID_PUBLIC_KEY);
  const jwk = { kty: "EC", crv: "P-256", d: env.VAPID_PRIVATE_KEY, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}
export async function vapidAuth(endpoint, env) {
  const aud = new URL(endpoint).origin;
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || "mailto:scholartap@example.org" })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await vapidKey(env), enc.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

export async function notify(store, owner, env) {
  if (!pushReady(env)) return;
  const fetcher = env.__fetch || fetch;
  for (const { endpoint } of await store.pushSubs(owner)) {
    try {
      const r = await fetcher(endpoint, { method: "POST", headers: { authorization: await vapidAuth(endpoint, env), ttl: "86400", urgency: "normal", "content-length": "0" } });
      if (r.status === 404 || r.status === 410) await store.deletePushSub(owner, endpoint);
    } catch {}
  }
}
