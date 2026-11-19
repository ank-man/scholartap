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

test("Apple Wallet pass: valid zip, manifest hashes, detached PKCS#7 signature", async () => {
  const forge = (await import("node-forge")).default;
  const { unzipSync, strFromU8 } = await import("fflate");
  const { createHash } = await import("node:crypto");
  const mk = (cn, issuer, signKey, pub, ca) => {
    const c = forge.pki.createCertificate(); c.publicKey = pub; c.serialNumber = String(Math.floor(Math.random() * 1e9));
    c.validity.notBefore = new Date(); c.validity.notAfter = new Date(Date.now() + 864e5);
    c.setSubject([{ name: "commonName", value: cn }]); c.setIssuer([{ name: "commonName", value: issuer }]);
    if (ca) c.setExtensions([{ name: "basicConstraints", cA: true }]);
    c.sign(signKey, forge.md.sha256.create()); return c;
  };
  const caKeys = forge.pki.rsa.generateKeyPair(2048), sKeys = forge.pki.rsa.generateKeyPair(2048);
  const wwdr = mk("Test WWDR", "Test WWDR", caKeys.privateKey, caKeys.publicKey, true);
  const signer = mk("Pass Type ID: pass.test", "Test WWDR", caKeys.privateKey, sKeys.publicKey, false);
  const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
  const { call, env } = setup({
    APPLE_PASS_TYPE_ID: "pass.test", APPLE_TEAM_ID: "ABCDE12345",
    APPLE_SIGNER_CERT: forge.pki.certificateToPem(signer), APPLE_SIGNER_KEY: forge.pki.privateKeyToPem(sKeys.privateKey), APPLE_WWDR_CERT: forge.pki.certificateToPem(wwdr)
  });
  const inner = env.__fetch;
  env.__fetch = async (u, i) => String(u).endsWith(".png") && String(u).includes("jordan.github.io") ? new Response(png) : inner(u, i);
  assert.equal((await call("GET", "/")).data.features.appleWallet, true);
  const r = await worker.fetch(new Request("https://relay.test/wallet/apple?card=" + encodeURIComponent("https://jordan.github.io/")), env);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/vnd.apple.pkpass");
  const files = unzipSync(new Uint8Array(await r.arrayBuffer()));
  for (const f of ["pass.json", "manifest.json", "signature", "icon.png"]) assert.ok(files[f], f);
  const manifest = JSON.parse(strFromU8(files["manifest.json"]));
  for (const [name, hash] of Object.entries(manifest)) assert.equal(createHash("sha1").update(files[name]).digest("hex"), hash, name);
  const pass = JSON.parse(strFromU8(files["pass.json"]));
  assert.equal(pass.passTypeIdentifier, "pass.test");
  assert.equal(pass.generic.primaryFields[0].value, "Jordan Dawgson");
  assert.equal(pass.barcodes[0].message, "https://jordan.github.io/?via=qr");
  // signature: detached PKCS#7 over manifest.json, signed by the signer cert, verified with node-forge
  const p7 = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.createBuffer(Buffer.from(files.signature).toString("binary"))));
  assert.equal(p7.certificates.length, 2);
  const attrs = p7.rawCapture.signerInfos[0].value.find((v) => v.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && v.type === 0);
  const digestAttr = attrs.value.find((a) => forge.asn1.derToOid(a.value[0].value) === forge.pki.oids.messageDigest);
  const md = forge.md.sha256.create(); md.update(Buffer.from(files["manifest.json"]).toString("binary"));
  assert.equal(digestAttr.value[1].value[0].value, md.digest().getBytes());
  const sig = p7.rawCapture.signerInfos[0].value.at(-1).value;
  const signed = forge.asn1.toDer(Object.assign({}, attrs, { tagClass: forge.asn1.Class.UNIVERSAL, type: forge.asn1.Type.SET })).getBytes();
  const md2 = forge.md.sha256.create(); md2.update(signed);
  assert.ok(sKeys.publicKey.verify(md2.digest().getBytes(), sig));
});

test("push: subscribe, tap sends a signed VAPID ping to the push service, dead endpoints pruned", async () => {
  const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = Buffer.from(await crypto.subtle.exportKey("raw", k.publicKey)).toString("base64url");
  const d = (await crypto.subtle.exportKey("jwk", k.privateKey)).d;
  const { call, env } = setup({ VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: d });
  const sent = [];
  const inner = env.__fetch;
  env.__fetch = async (u, i) => { if (String(u).includes("push.apple.com")) { sent.push({ u: String(u), h: i.headers }); return new Response(null, { status: sent.length > 1 ? 410 : 201 }); } return inner(u, i); };
  const root = (await call("GET", "/")).data;
  assert.equal(root.features.push, true); assert.equal(root.vapidPublicKey, pub);
  const a = await login(call, "ghp_alex"), j = await login(call, "ghp_jordan");
  assert.equal((await call("POST", "/push", { token: j, body: { endpoint: "https://evil.example/steal" } })).status, 400);
  assert.equal((await call("POST", "/push", { token: j, body: { endpoint: "https://web.push.apple.com/QGx1" } })).status, 200);
  await call("POST", "/tap", { token: a, body: { to: "https://jordan.github.io/" } });
  await Promise.all(env.__later || []);
  assert.equal(sent.length, 1);
  const auth = sent[0].h.authorization;
  const [, jwt, key] = auth.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(key, pub);
  const [h, b, s] = jwt.split(".");
  assert.equal(JSON.parse(Buffer.from(b, "base64url")).aud, "https://web.push.apple.com");
  assert.ok(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k.publicKey, Buffer.from(s, "base64url"), new TextEncoder().encode(`${h}.${b}`)));
  // repeat tap within 10 min: no second ping; a guest tap pings again, gets 410, and the endpoint is pruned
  env.__later = [];
  await call("POST", "/tap", { token: a, body: { to: "https://jordan.github.io/" } });
  await Promise.all(env.__later); assert.equal(sent.length, 1);
  await call("POST", "/guest", { body: { to: "https://jordan.github.io/", name: "Sam", email: "s@x.io" } });
  await Promise.all(env.__later); assert.equal(sent.length, 2);
  env.__later = [];
  await call("POST", "/guest", { body: { to: "https://jordan.github.io/", name: "Kim", email: "k@x.io" } });
  await Promise.all(env.__later); assert.equal(sent.length, 2);
});
