// node --test relay/test   (uses node:sqlite in memory and a fake GitHub)
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { generateKeyPairSync, createVerify } from "node:crypto";
import worker, { parseCard } from "../src/worker.js";
import { makeStore, nodeSqlite } from "../src/store.js";

const CARDS = {
  "https://alex.github.io/card/card.json": { name: "Alex Rivera", title: "PhD, Ecology", photo: "assets/me.jpg", wallet: { backgroundColor: "#004E60" } },
  "https://jordan.github.io/card.json": { name: "Jordan Dawgson", title: "PhD Candidate, Plant Biology", email: "j@uga.edu", researchInterests: ["Drought"] }
};
const TOKENS = { "ghp_alex": "Alex", "ghp_jordan": "jordan" };

function setup(extra = {}) {
  const fake = async (url, init = {}) => {
    url = String(url);
    if (url === "https://api.github.com/user") {
      const login = TOKENS[(init.headers?.authorization || "").replace("Bearer ", "")];
      return login ? Response.json({ login }) : new Response("no", { status: 401 });
    }
    if (CARDS[url]) return Response.json(CARDS[url]);
    if (url.startsWith("https://oauth2.googleapis.com/")) return new Response("no", { status: 500 });
    return new Response("nope", { status: 404 });
  };
  const env = { SESSION_SECRET: "test-secret-0123456789", __fetch: fake, __store: makeStore(nodeSqlite(new DatabaseSync(":memory:"))), ...extra };
  const call = async (method, path, { body, token, ip = "1.1.1.1" } = {}) => {
    const headers = { "content-type": "application/json", "cf-connecting-ip": ip };
    if (token) headers.authorization = `Bearer ${token}`;
    const r = await worker.fetch(new Request(`https://relay.test${path}`, { method, headers, body: body && JSON.stringify(body) }), env);
    const text = await r.text();
    return { status: r.status, headers: r.headers, data: text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null };
  };
  return { env, call };
}

async function login(call, pat) { return (await call("POST", "/auth/token", { body: { token: pat } })).data.session; }

test("parseCard normalises links and finds the GitHub owner", () => {
  assert.deepEqual(parseCard("https://Alex.github.io/card/index.html"), { url: "https://alex.github.io/card/", owner: "alex" });
  assert.deepEqual(parseCard("https://jordan.github.io"), { url: "https://jordan.github.io/", owner: "jordan" });
  assert.equal(parseCard("https://evil.com/card/"), null);
  assert.equal(parseCard("javascript:alert(1)"), null);
  assert.equal(parseCard("https://a.github.io/x/y/z/"), null);
});

test("token sign-in, profile, tap, inbox, mutual", async () => {
  const { call } = setup();
  assert.equal((await call("POST", "/auth/token", { body: { token: "ghp_bad" } })).status, 401);
  const a = await login(call, "ghp_alex"), j = await login(call, "ghp_jordan");
  assert.ok(a && j);

  // profile must be your own card
  assert.equal((await call("PUT", "/me", { token: a, body: { card: "https://jordan.github.io/" } })).status, 403);
  const me = await call("PUT", "/me", { token: a, body: { card: "https://alex.github.io/card/" } });
  assert.equal(me.data.profile.name, "Alex Rivera");
  assert.equal(me.data.profile.photo, "https://alex.github.io/card/assets/me.jpg");

  // can't tap yourself
  assert.equal((await call("POST", "/tap", { token: a, body: { to: "https://alex.github.io/card/" } })).status, 400);

  const t1 = await call("POST", "/tap", { token: a, body: { to: "https://jordan.github.io/", event: "Poster Night", note: "roots!" } });
  assert.equal(t1.status, 200); assert.equal(t1.data.mutual, false);
  // repeat within 10 min refreshes instead of duplicating
  const t2 = await call("POST", "/tap", { token: a, body: { to: "https://jordan.github.io/" } });
  assert.equal(t2.data.id, t1.data.id);

  const inbox = await call("GET", "/inbox", { token: j });
  assert.equal(inbox.data.taps.length, 1);
  const tap = inbox.data.taps[0];
  assert.equal(tap.from_login, "alex"); assert.equal(tap.name, "Alex Rivera"); assert.equal(tap.event, "Poster Night"); assert.equal(tap.note, "roots!");
  assert.equal((await call("GET", "/inbox", { token: a })).data.taps.length, 0);

  // Jordan taps back → mutual
  const back = await call("POST", "/tap", { token: j, body: { to: "https://alex.github.io/card/" } });
  assert.equal(back.data.mutual, true);

  // only the owner can delete
  await call("DELETE", `/inbox/${tap.id}`, { token: a });
  assert.equal((await call("GET", "/inbox", { token: j })).data.taps.length, 1);
  await call("DELETE", `/inbox/${tap.id}`, { token: j });
  assert.equal((await call("GET", "/inbox", { token: j })).data.taps.length, 0);
});

test("auth required and tampered sessions rejected", async () => {
  const { call } = setup();
  assert.equal((await call("GET", "/inbox")).status, 401);
  const a = await login(call, "ghp_alex");
  const [body, sig] = a.split(".");
  const forged = Buffer.from(JSON.stringify({ k: "s", login: "jordan", exp: 9e9 })).toString("base64url") + "." + sig;
  assert.equal((await call("GET", "/inbox", { token: forged })).status, 401);
  assert.equal((await call("GET", "/inbox", { token: body + "." + sig })).status, 200);
});

test("guest taps: validation, honeypot, rate limit", async () => {
  const { call } = setup();
  const to = "https://jordan.github.io/";
  assert.equal((await call("POST", "/guest", { body: { to, name: "" } })).status, 400);
  assert.equal((await call("POST", "/guest", { body: { to, name: "Sam" } })).status, 400);
  assert.equal((await call("POST", "/guest", { body: { to, name: "Sam", email: "nope" } })).status, 400);
  assert.equal((await call("POST", "/guest", { body: { to, name: "Bot", email: "b@x.io", website: "spam" } })).status, 200);
  assert.equal((await call("POST", "/guest", { body: { to, name: "Sam Lee", email: "sam@uga.edu", note: "loved the talk", event: "GSA mixer" } })).status, 200);
  const j = await login(call, "ghp_jordan");
  const taps = (await call("GET", "/inbox", { token: j })).data.taps;
  assert.equal(taps.length, 1); assert.equal(taps[0].kind, "guest"); assert.equal(taps[0].email, "sam@uga.edu");
  let last;
  for (let i = 0; i < 14; i++) last = await call("POST", "/guest", { body: { to, name: "Sam", email: "s@x.io" }, ip: "9.9.9.9" });
  assert.equal(last.status, 429);
});

test("contacts sync and view stats", async () => {
  const { call } = setup();
  const a = await login(call, "ghp_alex");
  assert.deepEqual((await call("GET", "/contacts", { token: a })).data.items, []);
  await call("PUT", "/contacts", { token: a, body: { items: [{ card: "https://jordan.github.io/", name: "Jordan", tags: ["lab"] }] } });
  assert.equal((await call("GET", "/contacts", { token: a })).data.items[0].name, "Jordan");

  await call("POST", "/hit", { body: { card: "https://alex.github.io/card/", via: "nfc" }, ip: "2.2.2.2" });
  await call("POST", "/hit", { body: { card: "https://alex.github.io/card/", via: "nfc" }, ip: "2.2.2.2" }); // same visitor, same day
  await call("POST", "/hit", { body: { card: "https://alex.github.io/card/" }, ip: "3.3.3.3" });
  const s = (await call("GET", "/stats", { token: a })).data;
  assert.equal(s.views.reduce((n, v) => n + v.n, 0), 2);
  assert.ok(s.views.some((v) => v.via === "nfc"));
});

test("public card summary and CORS", async () => {
  const { call } = setup();
  const r = await call("GET", "/card?url=" + encodeURIComponent("https://alex.github.io/card/"));
  assert.equal(r.data.name, "Alex Rivera"); assert.equal(r.data.owner, "alex"); assert.equal(r.data.accent, "#004E60");
  assert.equal(r.headers.get("access-control-allow-origin"), "*");
  assert.equal((await call("GET", "/card?url=https://evil.com/")).status, 400);
});

test("GitHub OAuth start only returns to allowed pages", async () => {
  const { call } = setup({ GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "s" });
  assert.equal((await call("GET", "/auth/github?return=" + encodeURIComponent("https://evil.com/x"))).status, 400);
  const r = await call("GET", "/auth/github?return=" + encodeURIComponent("https://ank-man.github.io/scholartap/taps/"));
  assert.equal(r.status, 302);
  assert.match(r.headers.get("location"), /^https:\/\/github\.com\/login\/oauth\/authorize\?client_id=id/);
});

test("Google Wallet link is a valid RS256 JWT carrying the card QR", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  const { call } = setup({ GOOGLE_WALLET_ISSUER_ID: "338800", GOOGLE_WALLET_SA_KEY: JSON.stringify({ client_email: "w@x.iam", private_key: pem }) });
  assert.equal((await call("GET", "/")).data.features.googleWallet, true);
  const r = await call("GET", "/wallet/google?card=" + encodeURIComponent("https://jordan.github.io/"));
  assert.equal(r.status, 302);
  const jwt = r.headers.get("location").replace("https://pay.google.com/gp/v/save/", "");
  const [h, b, s] = jwt.split(".");
  assert.ok(createVerify("RSA-SHA256").update(`${h}.${b}`).verify(publicKey, Buffer.from(s, "base64url")));
  const claims = JSON.parse(Buffer.from(b, "base64url"));
  const obj = claims.payload.genericObjects[0];
  assert.equal(obj.barcode.value, "https://jordan.github.io/");
  assert.equal(obj.header.defaultValue.value, "Jordan Dawgson");
});
