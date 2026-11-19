// ScholarTap Taps relay: the one small server that lets cards "tap back".
//
// Cards stay static on GitHub Pages. This relay only stores:
//   - taps: "Alex (@alex, alex.github.io/card) swapped cards with you at Poster Night"
//   - guest taps: someone without a card left their name + email on your card
//   - your saved contacts list (so it follows you between phone and laptop)
//   - anonymous daily view counts per card
// and optionally signs "Save to Google Wallet" links for every card with one shared issuer.
//
// Runs on Cloudflare Workers + D1 (free tier is plenty). `npm run relay` runs the same code locally on node:sqlite.
// Identity is your GitHub account, the same one that hosts your card: a card at <login>.github.io belongs to <login>.

import { makeStore } from "./store.js";
import { googleWalletLink } from "./wallet-google.js";

const MAX_BODY = 600_000;
const DAY = 86_400;

export default {
  async fetch(request, env) {
    try {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
      const store = env.__store || makeStore(env.DB);
      const res = await route(request, env, store);
      return cors(res);
    } catch (e) {
      if (e instanceof HttpError) return cors(json({ error: e.message }, e.status));
      console.error(e);
      return cors(json({ error: "Something went wrong" }, 500));
    }
  }
};

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };

function cors(res) {
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", "*");
  h.set("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS");
  h.set("access-control-allow-headers", "authorization,content-type");
  h.set("access-control-max-age", "86400");
  return new Response(res.body, { status: res.status, headers: h });
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

async function body(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) fail(413, "Too large");
  try { return text ? JSON.parse(text) : {}; } catch { fail(400, "Bad JSON"); }
}

// ---------- routing ----------
async function route(request, env, store) {
  const url = new URL(request.url);
  const p = url.pathname.replace(/\/+$/, "") || "/";
  const m = request.method;

  if (p === "/" && m === "GET") return json({ ok: true, name: "ScholarTap relay", features: features(env) });

  if (p === "/auth/github" && m === "GET") return authStart(url, env);
  if (p === "/auth/github/callback" && m === "GET") return authCallback(url, env, store);
  if (p === "/auth/token" && m === "POST") return authToken(request, env, store);

  if (p === "/hit" && m === "POST") return hit(request, env, store);
  if (p === "/guest" && m === "POST") return guest(request, env, store);
  if (p === "/card" && m === "GET") return publicCard(url, env);
  if (p === "/wallet/google" && m === "GET") return wallet(url, env);

  // everything below needs a session
  const me = await session(request, env);
  if (p === "/me" && m === "GET") return json({ login: me.login, profile: await store.getProfile(me.login) });
  if (p === "/me" && m === "PUT") return setProfile(request, env, store, me);
  if (p === "/tap" && m === "POST") return tap(request, env, store, me);
  if (p === "/inbox" && m === "GET") return json({ taps: await store.inbox(me.login, Number(url.searchParams.get("since")) || 0) });
  if (p.startsWith("/inbox/") && m === "DELETE") { await store.deleteTap(me.login, p.slice(7)); return json({ ok: true }); }
  if (p === "/contacts" && m === "GET") return json(await store.getContacts(me.login) || { items: [], updated: 0 });
  if (p === "/contacts" && m === "PUT") return putContacts(request, store, me);
  if (p === "/stats" && m === "GET") return json(await store.stats(me.login, now() - 30 * DAY));
  fail(404, "Not found");
}

function features(env) {
  return {
    github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
    token: true,
    googleWallet: Boolean(env.GOOGLE_WALLET_ISSUER_ID && env.GOOGLE_WALLET_SA_KEY)
  };
}

const now = () => Math.floor(Date.now() / 1000);

// ---------- cards & ownership ----------
// Normalises a card link to "https://host/path/" and returns its GitHub owner, or null for links we can't verify.
export function parseCard(raw) {
  let u;
  try { u = new URL(String(raw || "").trim()); } catch { return null; }
  if (u.protocol !== "https:" && !(u.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) return null;
  let path = u.pathname.replace(/index\.html$/, "");
  if (!path.endsWith("/")) path += "/";
  const segs = path.split("/").filter(Boolean);
  if (segs.length > 2 || segs.some((s) => !/^[\w.-]{1,100}$/.test(s))) return null;
  const host = u.hostname.toLowerCase();
  const gh = host.match(/^([a-z0-9](?:[a-z0-9-]{0,38}))\.github\.io$/);
  const owner = gh ? gh[1] : (/^(localhost|127\.0\.0\.1)$/.test(host) && segs[0] ? segs[0].toLowerCase() : null);
  if (!owner) return null;
  return { url: `${u.protocol}//${u.host.toLowerCase()}${path}`, owner };
}

async function fetchCard(cardUrl, env) {
  const fetcher = env.__fetch || fetch;
  try {
    const r = await fetcher(new URL("card.json", cardUrl).href, { headers: { accept: "application/json" }, cf: { cacheTtl: 300 } });
    if (!r.ok) return null;
    const c = await r.json();
    return c && typeof c === "object" ? c : null;
  } catch { return null; }
}

const clip = (v, n) => (v == null ? "" : String(v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n));
const absolute = (v, base) => { try { const u = new URL(v, base); return /^https?:$/.test(u.protocol) ? u.href : ""; } catch { return ""; } };

function summary(card, cardUrl) {
  return {
    name: clip(card?.name, 80),
    title: clip(card?.title, 120),
    org: clip(card?.organization, 120),
    photo: card?.photo && !String(card.photo).startsWith("data:") ? absolute(card.photo, cardUrl) : "",
    accent: /^#[0-9a-f]{3,8}$/i.test(card?.wallet?.backgroundColor || "") ? card.wallet.backgroundColor : ""
  };
}

async function publicCard(url, env) {
  const c = parseCard(url.searchParams.get("url"));
  if (!c) fail(400, "Not a ScholarTap card link");
  const card = await fetchCard(c.url, env);
  if (!card) fail(404, "Card not found");
  return json({ card: c.url, owner: c.owner, ...summary(card, c.url) });
}

// ---------- sessions ----------
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hmacKey(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 16) fail(500, "Relay is missing SESSION_SECRET");
  return crypto.subtle.importKey("raw", enc.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function sign(payload, env) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), enc.encode(body));
  return `${body}.${b64u(sig)}`;
}
export async function verify(token, env) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify("HMAC", await hmacKey(env), unb64u(sig), enc.encode(body)); } catch { return null; }
  if (!ok) return null;
  const data = JSON.parse(new TextDecoder().decode(unb64u(body)));
  return data.exp > now() ? data : null;
}
async function session(request, env) {
  const t = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const s = await verify(t, env);
  if (!s || s.k !== "s") fail(401, "Sign in again");
  return s;
}
const newSession = (login, env) => sign({ k: "s", login: login.toLowerCase(), exp: now() + 120 * DAY }, env);

function safeReturn(raw, env) {
  const allowed = String(env.HUB_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const u = new URL(raw);
    if (allowed.includes(u.origin) || /^https:\/\/[a-z0-9-]+\.github\.io$/.test(u.origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(u.origin)) return u.href.split("#")[0];
  } catch {}
  return null;
}

async function authStart(url, env) {
  if (!env.GITHUB_CLIENT_ID) fail(501, "GitHub sign-in is not set up on this relay");
  const ret = safeReturn(url.searchParams.get("return"), env);
  if (!ret) fail(400, "Bad return link");
  const state = await sign({ k: "o", ret, exp: now() + 600, n: crypto.randomUUID() }, env);
  const gh = new URL("https://github.com/login/oauth/authorize");
  gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  gh.searchParams.set("scope", "");          // identity only: no repo access
  gh.searchParams.set("state", state);
  gh.searchParams.set("allow_signup", "true");
  return Response.redirect(gh.href, 302);
}

async function authCallback(url, env, store) {
  const st = await verify(url.searchParams.get("state"), env);
  if (!st || st.k !== "o") fail(400, "Sign-in expired. Try again.");
  const fetcher = env.__fetch || fetch;
  const r = await fetcher("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code: url.searchParams.get("code") })
  });
  const tok = (await r.json()).access_token;
  if (!tok) fail(400, "GitHub sign-in failed");
  const login = await githubLogin(tok, env);
  await store.touchUser(login);
  return Response.redirect(`${st.ret}#session=${encodeURIComponent(await newSession(login, env))}&login=${login}`, 302);
}

async function githubLogin(token, env) {
  const fetcher = env.__fetch || fetch;
  const r = await fetcher("https://api.github.com/user", { headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "scholartap-relay" } });
  if (!r.ok) fail(401, "That GitHub token isn't valid");
  const u = await r.json();
  if (!u?.login) fail(401, "That GitHub token isn't valid");
  return String(u.login).toLowerCase();
}

// The GitHub token the card app already uses also works: we read the login once and forget the token.
async function authToken(request, env, store) {
  const { token } = await body(request);
  if (!token || String(token).length > 300) fail(400, "Paste your GitHub token");
  const login = await githubLogin(String(token).trim(), env);
  await store.touchUser(login);
  return json({ session: await newSession(login, env), login });
}

// ---------- profile ----------
async function setProfile(request, env, store, me) {
  const b = await body(request);
  const c = parseCard(b.card);
  if (!c) fail(400, "That isn't a ScholarTap card link");
  if (c.owner !== me.login) fail(403, `That card belongs to @${c.owner}, not @${me.login}`);
  const card = await fetchCard(c.url, env);
  const s = summary(card || { name: b.name }, c.url);
  const profile = { card: c.url, ...s, name: s.name || me.login };
  await store.setProfile(me.login, profile);
  return json({ login: me.login, profile });
}

// ---------- taps ----------
async function limit(store, key, max, windowSec) {
  if (!(await store.rate(key, windowSec, max))) fail(429, "Slow down a little and try again");
}
async function ipHash(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
  const d = await crypto.subtle.digest("SHA-256", enc.encode(`${env.SESSION_SECRET || ""}|${ip}`));
  return b64u(d).slice(0, 22);
}

async function tap(request, env, store, me) {
  const b = await body(request);
  const to = parseCard(b.to);
  if (!to) fail(400, "That isn't a ScholarTap card link");
  if (to.owner === me.login) fail(400, "That's your own card");
  await limit(store, `tap:${me.login}`, 120, 3600);
  const profile = await store.getProfile(me.login);
  const row = {
    id: crypto.randomUUID(),
    to_owner: to.owner, to_card: to.url,
    from_login: me.login, from_card: profile?.card || "",
    name: profile?.name || me.login, title: profile?.title || "", photo: profile?.photo || "",
    email: "", phone: "",
    note: clip(b.note, 500), event: clip(b.event, 120),
    kind: "tap", created: now()
  };
  const id = await store.addTap(row, 600);
  return json({ ok: true, id, to: to.url, owner: to.owner, mutual: await store.hasTapped(to.owner, me.login) });
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
async function guest(request, env, store) {
  const b = await body(request);
  if (b.website) return json({ ok: true });                      // honeypot: bots fill every field
  const to = parseCard(b.to);
  if (!to) fail(400, "That isn't a ScholarTap card link");
  const name = clip(b.name, 80), email = clip(b.email, 200), phone = clip(b.phone, 40);
  if (!name) fail(400, "Add your name");
  if (!email && !phone) fail(400, "Add an email or phone number so they can reach you");
  if (email && !EMAIL.test(email)) fail(400, "That email doesn't look right");
  const ip = await ipHash(request, env);
  await limit(store, `guest:${ip}`, 12, 3600);
  await limit(store, `guest-to:${to.owner}`, 200, DAY);
  const link = absolute(b.link, "https://x.invalid/");
  await store.addTap({
    id: crypto.randomUUID(), to_owner: to.owner, to_card: to.url,
    from_login: "", from_card: link.startsWith("https://x.invalid") ? "" : link,
    name, title: clip(b.title, 120), photo: "", email, phone,
    note: clip(b.note, 500), event: clip(b.event, 120), kind: "guest", created: now()
  }, 0);
  return json({ ok: true });
}

async function hit(request, env, store) {
  const b = await body(request);
  const c = parseCard(b.card);
  if (!c) return json({ ok: false });
  const ip = await ipHash(request, env);
  // one view per visitor per card per day
  if (await store.rate(`hit:${ip}:${c.url}`, DAY, 1)) await store.hit(c.owner, c.url, new Date().toISOString().slice(0, 10), b.via === "nfc" ? "nfc" : b.via === "qr" ? "qr" : "link");
  return json({ ok: true });
}

async function putContacts(request, store, me) {
  const b = await body(request);
  if (!Array.isArray(b.items) || b.items.length > 5000) fail(400, "Bad contacts list");
  const doc = { items: b.items, updated: now() };
  await store.putContacts(me.login, doc);
  return json({ ok: true, updated: doc.updated });
}

async function wallet(url, env) {
  if (!features(env).googleWallet) fail(501, "Google Wallet isn't set up on this relay");
  const c = parseCard(url.searchParams.get("card"));
  if (!c) fail(400, "That isn't a ScholarTap card link");
  const card = await fetchCard(c.url, env);
  if (!card) fail(404, "Card not found");
  return Response.redirect(await googleWalletLink(card, c.url, env), 302);
}
