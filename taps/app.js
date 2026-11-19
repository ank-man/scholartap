// ScholarTap Taps: your QR, your taps, who tapped you. Works offline; the relay adds inbox + sync when configured.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const K = { me: "st-me", session: "st-session", contacts: "st-contacts", seen: "st-seen", event: "st-event", events: "st-events", relay: "st-relay", theme: "st-theme" };
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};

const ICONS = {
  github: '<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  contact: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  dots: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
  wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><path d="M16 14h.01"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  nfc: '<path d="M6 8.3a6 6 0 0 1 0 7.4M9.5 5.5a10 10 0 0 1 0 13M13 3a14 14 0 0 1 0 18"/>',
  open: '<path d="M7 17 17 7M7 7h10v10"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 20h1"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'
};
const svg = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;
const paintIcons = (root = document) => $$("[data-i]", root).forEach((el) => { el.innerHTML = svg(el.dataset.i); });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = (n = "") => n.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
const buzz = (p = 12) => { try { navigator.vibrate?.(p); } catch {} };
const ago = (t) => { const s = Date.now() / 1000 - t; if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; if (s < 604800) return `${Math.floor(s / 86400)}d ago`; return new Date(t * 1000).toLocaleDateString(); };

function avatar(el, p) {
  el.style.setProperty("--c", p?.accent || "var(--me)");
  el.innerHTML = p?.photo ? `<img src="${esc(p.photo)}" alt="" onerror="this.remove()">` : "";
  if (!p?.photo) el.textContent = initials(p?.name);
}

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2400);
}

// ---------- card links ----------
export function normCard(raw) {
  try {
    const u = new URL(String(raw).trim());
    if (!/^https?:$/.test(u.protocol)) return null;
    let p = u.pathname.replace(/index\.html$|nfc\.html$/, "");
    if (!p.endsWith("/")) p += "/";
    return `${u.protocol}//${u.host.toLowerCase()}${p}`;
  } catch { return null; }
}
async function fetchCard(url) {
  const r = await fetch(new URL("card.json", url), { cache: "no-cache" });
  if (!r.ok) throw new Error("No ScholarTap card at that link");
  const c = await r.json();
  if (!c || typeof c !== "object" || !c.name) throw new Error("No ScholarTap card at that link");
  return c;
}
function summarize(c, url) {
  const abs = (v) => { try { return v && !String(v).startsWith("data:") ? new URL(v, url).href : ""; } catch { return ""; } };
  return {
    card: url, name: c.name || "", title: c.title || "", org: c.organization || "", photo: abs(c.photo),
    email: c.email || "", phone: c.phone || "", website: c.website || "", accent: c.wallet?.backgroundColor || c.theme?.accent || "",
    links: (c.links || []).slice(0, 8).map((l) => ({ label: l.label, url: l.url }))
  };
}

// ---------- relay ----------
let CONFIG = { relay: "" }, FEATURES = {};
const relayUrl = () => (ls.get(K.relay) || CONFIG.relay || "").replace(/\/$/, "");
async function api(path, { method = "GET", body, auth = true } = {}) {
  const base = relayUrl(); if (!base) throw new Error("offline");
  const headers = { "content-type": "application/json" };
  const s = ls.get(K.session);
  if (auth && s) headers.authorization = `Bearer ${s}`;
  const r = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && auth) { ls.del(K.session); }
  if (!r.ok) throw Object.assign(new Error(data.error || `Error ${r.status}`), { status: r.status });
  return data;
}
const signedIn = () => Boolean(ls.get(K.session) && relayUrl());

// ---------- contacts (saved taps) ----------
const contacts = () => ls.get(K.contacts, []);
function saveContacts(list, sync = true) {
  ls.set(K.contacts, list);
  if (sync && signedIn()) { clearTimeout(saveContacts._t); saveContacts._t = setTimeout(() => api("/contacts", { method: "PUT", body: { items: contacts() } }).catch(() => {}), 800); }
}
const keyOf = (c) => c.card || c.email || c.id;
function upsertContact(c) {
  const list = contacts();
  const i = list.findIndex((x) => keyOf(x) && keyOf(x) === keyOf(c));
  const now = Math.floor(Date.now() / 1000);
  if (i >= 0) list[i] = { ...list[i], ...Object.fromEntries(Object.entries(c).filter(([, v]) => v !== "" && v != null)), updated: now };
  else list.unshift({ id: crypto.randomUUID(), tags: [], note: "", created: now, updated: now, ...c });
  saveContacts(list);
  return list[i >= 0 ? i : 0];
}
async function pullContacts() {
  if (!signedIn()) return;
  try {
    const remote = (await api("/contacts")).items || [];
    const map = new Map(contacts().map((c) => [keyOf(c), c]));
    for (const r of remote) { const l = map.get(keyOf(r)); if (!l || (r.updated || 0) > (l.updated || 0)) map.set(keyOf(r), r); }
    const merged = [...map.values()].sort((a, b) => (b.created || 0) - (a.created || 0));
    saveContacts(merged, merged.length !== remote.length || merged.some((m, i) => m.updated !== remote[i]?.updated));
  } catch {}
}

// ---------- vCard ----------
function vcard(c) {
  const e = (v) => String(v ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  const [first, ...rest] = (c.name || "").split(" "); const last = rest.pop() || "";
  return ["BEGIN:VCARD", "VERSION:3.0", `N:${e(last)};${e(first)};${e(rest.join(" "))};;`, `FN:${e(c.name)}`,
    c.org && `ORG:${e(c.org)}`, c.title && `TITLE:${e(c.title)}`, c.email && `EMAIL;TYPE=INTERNET:${c.email}`, c.phone && `TEL;TYPE=CELL:${c.phone}`,
    c.card && `URL;TYPE=ScholarTap:${c.card}`, c.website && `URL:${c.website}`,
    (c.event || c.note) && `NOTE:${e([c.event && `Met at ${c.event}`, c.note].filter(Boolean).join(" · "))}`, "END:VCARD"].filter(Boolean).join("\r\n");
}
function download(name, text, type) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
}
async function saveVcf(c) {
  let full = c;
  if (c.card && !c.email && !c.phone) { try { full = { ...summarize(await fetchCard(c.card), c.card), ...c }; } catch {} }
  const text = vcard(full), name = `${(full.name || "contact").replace(/\W+/g, "-").toLowerCase()}.vcf`;
  const file = new File([text], name, { type: "text/vcard" });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === "AbortError") return; } }
  download(name, text, "text/vcard");
}

// ---------- QR ----------
function qrSvg(text, fg = "#111") {
  if (typeof window.qrcode !== "function") return "";
  const qr = window.qrcode(0, "M"); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), q = 2; let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${(n + 2 * q) * 8}" height="${(n + 2 * q) * 8}" viewBox="0 0 ${n + 2 * q} ${n + 2 * q}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="${fg}"/></svg>`;
}
const qrLink = (card, via) => `${card}?via=${via}`;

// ---------- views ----------
const me = () => ls.get(K.me);
let current = "";
function show(view) {
  current = view;
  $$(".view").forEach((v) => { v.hidden = v.id !== `v-${view}`; });
  $("#tabbar").hidden = !me() || view === "swap" || view === "welcome";
  $$("#tabbar [data-tab]").forEach((b) => { if (b.dataset.tab === view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  if (view !== "scan") stopScan();
  if (view !== "nfc") stopBurn();
  ({ me: renderMe, taps: renderTaps, scan: startScan, nfc: renderBurn }[view] || (() => {}))();
  const url = new URL(location.href);
  if (view !== "swap") { url.search = view === "me" ? "" : `?view=${view}`; history.replaceState(null, "", url); }
  window.scrollTo(0, 0);
}

function applyAccent() {
  const a = me()?.accent;
  if (a) document.documentElement.style.setProperty("--me", a);
}

function renderMe() {
  const m = me(); if (!m) return show("welcome");
  applyAccent();
  avatar($("#meAvatar"), m);
  $("#meName").textContent = m.name || "Your card";
  $("#meTitle").textContent = [m.title, m.login && `@${m.login}`].filter(Boolean).join(" · ");
  $("#meQr").innerHTML = qrSvg(qrLink(m.card, "qr"));
  $("#aCard").href = m.card;
  const ev = ls.get(K.event, "");
  $("#eventIn").value = ev; $("#eventPill").classList.toggle("on", Boolean(ev));
  setupWallet(m);
  renderStats();
  installHint();
  pushHint();
}

async function setupWallet(m) {
  const a = $("#aWallet");
  a.removeAttribute("href"); a.setAttribute("aria-disabled", "true");
  let w = {};
  try { const r = await fetch(new URL("wallet/wallet.json", m.card), { cache: "no-store" }); if (r.ok) w = await r.json(); } catch {}
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const enc = encodeURIComponent(m.card);
  if (!w.apple && FEATURES.appleWallet) w.apple = `${relayUrl()}/wallet/apple?card=${enc}`;
  if (!w.google && FEATURES.googleWallet) w.google = `${relayUrl()}/wallet/google?card=${enc}`;
  const link = ios ? w.apple : (w.google || w.samsung || w.apple);
  if (link) { a.href = link; a.removeAttribute("aria-disabled"); a.onclick = null; }
  else a.onclick = (e) => { e.preventDefault(); toast(ios ? "Apple Wallet isn't switched on yet. Use Lock screen: your QR on your wallpaper" : "Wallet pass isn't set up for this card yet"); };
}

async function renderStats() {
  if (!signedIn()) { $("#stats").hidden = true; return; }
  try {
    const s = await api("/stats");
    const total = s.views.reduce((n, v) => n + v.n, 0);
    $("#stViews").textContent = total; $("#stTaps").textContent = s.taps;
    $("#stNfc").textContent = s.views.filter((v) => v.via === "nfc").reduce((n, v) => n + v.n, 0);
    const days = [...Array(30)].map((_, i) => new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10));
    const per = days.map((d) => s.views.filter((v) => v.day === d).reduce((n, v) => n + v.n, 0));
    const max = Math.max(1, ...per);
    const pts = per.map((v, i) => `${(i / 29) * 120},${30 - (v / max) * 28}`).join(" ");
    $("#stSpark").innerHTML = `<polyline points="${pts}" fill="none" stroke="var(--me)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
    $("#stats").hidden = false;
  } catch { $("#stats").hidden = true; }
}

// ---------- tap alerts (Web Push; iOS needs the home-screen app) ----------
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
async function pushHint() {
  const card = $("#pushCard");
  if (!signedIn() || !FEATURES.push || !("serviceWorker" in navigator)) { card.hidden = true; return; }
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  card.hidden = false;
  if (!("PushManager" in window) || (ios && !standalone())) {
    $("#pushHow").textContent = ios ? "On iPhone, add ScholarTap to your Home Screen first (Share → Add to Home Screen), then open it from there and turn alerts on." : "This browser can't show notifications.";
    $("#pushBtn").hidden = true; return;
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  $("#pushBtn").hidden = false;
  $("#pushBtn").textContent = sub ? "Tap alerts are on · turn off" : "Turn on tap alerts";
  $("#pushHow").textContent = sub ? "You'll get a notification whenever someone swaps cards with you." : "Works on iPhone (iOS 16.4+, from the home-screen app), Android and computers.";
}
$("#pushBtn").onclick = async () => {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) { await api("/push", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe(); toast("Tap alerts off"); return pushHint(); }
    if ((await Notification.requestPermission()) !== "granted") return toast("Notifications are blocked. Allow them in Settings.");
    const key = Uint8Array.from(atob(FEATURES.vapid.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await api("/push", { method: "POST", body: { endpoint: s.endpoint } });
    buzz(); toast("Tap alerts on 🔔"); pushHint();
  } catch (e) { toast(e.message || "Couldn't turn on alerts"); }
};

let deferredInstall = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; installHint(); });
function installHint() {
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) { $("#installCard").hidden = true; return; }
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  $("#installCard").hidden = false;
  $("#installHow").textContent = deferredInstall ? "One tap: your QR, scanner and taps open like an app, even offline."
    : ios ? "In Safari tap Share → Add to Home Screen. Long-press the icon for quick Scan and My QR."
    : "Use your browser menu → Install app / Add to Home screen.";
  $("#installBtn").hidden = !deferredInstall;
}
$("#installBtn").onclick = async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; installHint(); };

// ---------- taps list ----------
let filterTag = "";
function renderTaps() {
  const q = $("#q").value.trim().toLowerCase();
  const list = contacts();
  const today = new Date().toISOString().slice(0, 10);
  const tags = [...new Set(list.flatMap((c) => c.tags || []).concat(list.map((c) => c.event).filter(Boolean)))].slice(0, 30);
  $("#tagChips").innerHTML = tags.length ? ["", ...tags].map((t) => `<button aria-pressed="${t === filterTag}" data-tag="${esc(t)}">${t ? esc(t) : "All"}</button>`).join("") : "";
  const shown = list.filter((c) => (!filterTag || (c.tags || []).includes(filterTag) || c.event === filterTag)
    && (!q || [c.name, c.title, c.org, c.event, c.note, ...(c.tags || [])].join(" ").toLowerCase().includes(q)));
  $("#tapList").innerHTML = shown.map((c) => personRow(c, {
    line: [c.event && `📍 ${c.event}`, c.title, ago(c.created || 0)].filter(Boolean).join(" · "),
    tags: [c.mutual && '<span class="tag mutual">mutual</span>', c.follow && c.follow <= today && '<span class="tag due">follow up</span>'].filter(Boolean).join("")
  })).join("");
  renderInbox();
  $("#tapEmpty").hidden = list.length > 0 || !$("#inbox").hidden;
}
function personRow(c, { line, tags = "", actions = "" }) {
  return `<div class="person" role="button" tabindex="0" data-id="${esc(c.id)}">
    <div class="avatar" style="--c:${esc(c.accent || "var(--me)")}">${c.photo ? `<img src="${esc(c.photo)}" alt="" onerror="this.remove()">` : esc(initials(c.name))}</div>
    <div class="meta"><div class="nm">${esc(c.name || "Someone")} ${tags}</div><div class="ln">${esc(line)}</div></div>${actions}</div>`;
}

let INBOX = [];
async function pullInbox() {
  if (!signedIn()) return;
  try { INBOX = (await api("/inbox")).taps || []; } catch { return; }
  const seen = ls.get(K.seen, 0);
  const fresh = INBOX.filter((t) => t.created > seen).length;
  $("#tabBadge").hidden = !fresh; $("#tabBadge").textContent = fresh;
  if (fresh && "setAppBadge" in navigator) navigator.setAppBadge(fresh).catch(() => {});
  if (current === "taps") renderInbox();
}
function renderInbox() {
  const saved = new Set(contacts().map(keyOf));
  const pending = INBOX.filter((t) => !saved.has(t.from_card || t.email || t.id));
  $("#inbox").hidden = !pending.length;
  $("#inboxCount").textContent = pending.length || "";
  $("#inboxList").innerHTML = pending.map((t) => personRow({ id: t.id, name: t.name, photo: t.photo }, {
    line: [t.kind === "guest" ? "left their details" : "tapped you", t.event && `at ${t.event}`, t.note && `“${t.note}”`, ago(t.created)].filter(Boolean).join(" · "),
    tags: t.kind === "guest" ? '<span class="tag">guest</span>' : "",
    actions: `<button class="btn small primary" data-accept="${esc(t.id)}">${t.from_card ? "Tap back" : "Save"}</button>`
  })).join("");
  if (current === "taps" && pending.length) {
    ls.set(K.seen, Math.max(...INBOX.map((t) => t.created)));
    $("#tabBadge").hidden = true; navigator.clearAppBadge?.().catch(() => {});
  }
}
async function acceptTap(id) {
  const t = INBOX.find((x) => x.id === id); if (!t) return;
  buzz();
  const c = upsertContact({ card: t.from_card, name: t.name, title: t.title, photo: t.photo, email: t.email, phone: t.phone, event: t.event, note: t.note ? `They said: “${t.note}”` : "", mutual: Boolean(t.from_card), login: t.from_login, id: t.from_card ? undefined : t.id });
  if (t.from_card) { try { await api("/tap", { method: "POST", body: { to: t.from_card, event: ls.get(K.event, "") } }); } catch {} }
  toast(t.from_card ? `Tapped back ${t.name.split(" ")[0]} 🤝` : `Saved ${t.name}`);
  if (t.from_card) confetti();
  renderTaps();
  if (!c.photo && c.card) enrich(c);
}
async function enrich(c) {
  try { const s = summarize(await fetchCard(c.card), c.card); upsertContact({ card: c.card, photo: s.photo, accent: s.accent, title: c.title || s.title, org: s.org, email: c.email || s.email, phone: c.phone || s.phone, website: s.website }); if (current === "taps") renderTaps(); } catch {}
}

// ---------- contact sheet ----------
let sheetId = null;
function openSheet(id) {
  const c = contacts().find((x) => x.id === id); if (!c) return;
  sheetId = id;
  avatar($("#shAvatar"), c);
  $("#shName").textContent = c.name || "Someone";
  $("#shTitle").textContent = [c.title, c.org].filter(Boolean).join(" · ");
  $("#shEvent").value = c.event || ""; $("#shTags").value = (c.tags || []).join(", "); $("#shNote").value = c.note || ""; $("#shFollow").value = c.follow || "";
  const acts = [
    c.card && `<a class="btn small" href="${esc(c.card)}" target="_blank" rel="noopener">${svg("open")}Card</a>`,
    c.email && `<a class="btn small" href="mailto:${esc(c.email)}?subject=${encodeURIComponent("Great meeting you" + (c.event ? ` at ${c.event}` : ""))}">${svg("mail")}Email</a>`,
    `<button class="btn small" type="button" data-vcf>${svg("contact")}Save</button>`,
    `<button class="btn small" type="button" data-ics>${svg("cal")}Remind me</button>`
  ];
  $("#shActions").innerHTML = acts.filter(Boolean).join("");
  $("#shActions [data-vcf]").onclick = () => saveVcf(c);
  $("#shActions [data-ics]").onclick = () => reminder(c);
  $("#sheet").showModal();
}
$("#sheet").addEventListener("close", () => {
  const list = contacts(), i = list.findIndex((x) => x.id === sheetId);
  if (i < 0) return;
  if ($("#sheet").returnValue === "delete") { if (confirm(`Remove ${list[i].name}?`)) { list.splice(i, 1); saveContacts(list); } }
  else {
    list[i] = { ...list[i], event: $("#shEvent").value.trim(), note: $("#shNote").value.trim(), follow: $("#shFollow").value,
      tags: $("#shTags").value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12), updated: Math.floor(Date.now() / 1000) };
    saveContacts(list);
  }
  renderTaps();
});
function reminder(c) {
  const d = ($("#shFollow").value || new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10)).replace(/-/g, "");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ScholarTap//Taps//EN", "BEGIN:VEVENT", `UID:${crypto.randomUUID()}@scholartap`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${d}`,
    `SUMMARY:Follow up with ${c.name}`, `DESCRIPTION:${[c.event && `Met at ${c.event}`, c.card, c.email].filter(Boolean).join("\\n")}`,
    "BEGIN:VALARM", "TRIGGER:PT9H", "ACTION:DISPLAY", `DESCRIPTION:Follow up with ${c.name}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  download(`follow-up-${(c.name || "contact").replace(/\W+/g, "-").toLowerCase()}.ics`, ics, "text/calendar");
}

$("#exportBtn").onclick = () => {
  const list = contacts(); if (!list.length) return toast("Nothing to export yet");
  const col = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [["Name", "Title", "Organisation", "Email", "Phone", "Card", "Where met", "Tags", "Notes", "Follow up", "Added"].map(col).join(","),
    ...list.map((c) => [c.name, c.title, c.org, c.email, c.phone, c.card, c.event, (c.tags || []).join("; "), c.note, c.follow, new Date((c.created || 0) * 1000).toISOString().slice(0, 10)].map(col).join(","))].join("\n");
  if (confirm("Export as a spreadsheet (CSV)?\nCancel exports all as contacts (vCard) instead.")) download("scholartap-taps.csv", csv, "text/csv");
  else download("scholartap-taps.vcf", list.map(vcard).join("\r\n"), "text/vcard");
};

// ---------- swap ----------
let SWAP = null;
async function openSwap(raw, { via = "link", back = true } = {}) {
  const url = normCard(raw);
  if (!url) return toast("That isn't a card link");
  const mine = me();
  if (mine && url === mine.card) { toast("That's your own card 😄"); return show("me"); }
  show("swap");
  ["#swapForm", "#guestForm", "#swapAfter", "#swapGuestCta"].forEach((s) => { $(s).hidden = true; });
  $("#v-swap").classList.remove("swapped");
  $("#swapTitle").textContent = "Loading…"; $("#swapSub").textContent = "";
  avatar($("#swapMe"), mine || { name: "You" });
  let them;
  try { them = summarize(await fetchCard(url), url); }
  catch { $("#swapTitle").textContent = "Couldn't open that card"; $("#swapSub").textContent = url; $("#swapAfter").hidden = false; return; }
  SWAP = { ...them, via, back };
  avatar($("#swapThem"), them);
  $("#swapBack").href = them.card; $("#swapBack").hidden = !back;
  const first = them.name.split(" ")[0];
  $("#eventList").innerHTML = ls.get(K.events, []).map((e) => `<option value="${esc(e)}">`).join("");
  $("#swapEvent").value = ls.get(K.event, "");
  if (mine) {
    $("#swapTitle").textContent = `Swap with ${first}?`;
    $("#swapSub").textContent = signedIn() ? `${first} gets your card in their taps, and you keep theirs.` : `You'll keep ${first}'s card. Sign in so ${first} gets yours too.`;
    $("#swapFine").textContent = signedIn() ? "" : "Not signed in: saved on this phone only.";
    $("#swapForm").hidden = false;
  } else {
    $("#swapTitle").textContent = `Connect with ${first}`;
    $("#swapSub").textContent = them.title;
    if (relayUrl()) $("#guestForm").hidden = false;
    $("#swapAfter").hidden = false; $("#swapGuestCta").hidden = false; $("#swapHome").hidden = true;
  }
}
$("#swapForm").onsubmit = async (e) => {
  e.preventDefault(); if (!SWAP) return;
  const event = $("#swapEvent").value.trim(), note = $("#swapNote").value.trim();
  const btn = $("#swapForm button[type=submit]"); btn.disabled = true;
  if (event) { ls.set(K.events, [event, ...ls.get(K.events, []).filter((x) => x !== event)].slice(0, 12)); }
  let mutual = false;
  try {
    if (signedIn()) mutual = (await api("/tap", { method: "POST", body: { to: SWAP.card, event, note } })).mutual;
  } catch (err) { toast(err.message); }
  upsertContact({ ...SWAP, via: undefined, back: undefined, event, mutual: mutual || undefined });
  btn.disabled = false; buzz([10, 40, 20]);
  $("#v-swap").classList.add("swapped");
  $("#swapTitle").textContent = mutual ? "It's mutual 🤝" : "Swapped ✨";
  $("#swapSub").textContent = signedIn() ? `${SWAP.name.split(" ")[0]} will see you in their taps.` : `Saved to your taps.`;
  $("#swapForm").hidden = true; $("#swapAfter").hidden = false; $("#swapHome").hidden = false;
  confetti();
};
$("#guestForm").onsubmit = async (e) => {
  e.preventDefault(); if (!SWAP) return;
  const btn = $("#guestForm button"); btn.disabled = true;
  try {
    await api("/guest", { method: "POST", auth: false, body: { to: SWAP.card, name: $("#gName").value, email: $("#gEmail").value, phone: $("#gPhone").value, link: $("#gLink").value, note: $("#gNote").value, website: $("#gWebsite").value } });
    $("#guestForm").hidden = true; $("#v-swap").classList.add("swapped");
    $("#swapTitle").textContent = "Sent ✨"; $("#swapSub").textContent = `${SWAP.name.split(" ")[0]} will see your details in their taps.`;
    buzz([10, 40, 20]); confetti();
  } catch (err) { toast(err.message); }
  btn.disabled = false;
};
$("#swapSaveVcf").onclick = () => SWAP && saveVcf(SWAP);
$("#swapHome").onclick = () => show("taps");
$("#swapSignIn").onclick = () => { ls.set("st-after", SWAP?.card || ""); show("welcome"); };

// ---------- scanning ----------
let stream = null, scanTimer = null, detector = null;
async function startScan() {
  $("#camMsg").textContent = "Point at a ScholarTap QR";
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); }
  catch { $("#camMsg").textContent = "Camera blocked. Paste a link below, or use your camera app."; return; }
  const v = $("#cam"); v.srcObject = stream; await v.play().catch(() => {});
  if ("BarcodeDetector" in window) { try { detector = new BarcodeDetector({ formats: ["qr_code"] }); } catch { detector = null; } }
  if (!detector) { try { await loadJsQR(); } catch { $("#camMsg").textContent = "Scanner unavailable. Paste a link below."; return; } }
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true });
  const tick = async () => {
    if (!stream) return;
    let text = null;
    try {
      if (detector) text = (await detector.detect(v))[0]?.rawValue;
      else if (v.videoWidth) {
        canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0);
        text = window.jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data;
      }
    } catch {}
    if (text && normCard(text)) { buzz(30); stopScan(); return openSwap(text, { via: "qr", back: true }); }
    scanTimer = setTimeout(tick, 220);
  };
  tick();
}
function stopScan() { clearTimeout(scanTimer); stream?.getTracks().forEach((t) => t.stop()); stream = null; }
function loadJsQR() {
  if (window.jsQR) return Promise.resolve();
  return new Promise((ok, no) => { const s = Object.assign(document.createElement("script"), { src: "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js", onload: ok, onerror: no }); document.head.append(s); });
}
$("#pasteForm").onsubmit = (e) => { e.preventDefault(); openSwap($("#pasteIn").value); };

// ---------- NFC burner (Web NFC: Chrome on Android) ----------
let burnCtl = null, burned = 0;
const canNfc = () => "NDEFReader" in window;
function burnState(cls, label, status = "") {
  $("#burnBtn").className = `burn ${cls}`; $("#burnLabel").textContent = label; $("#burnStatus").textContent = status;
}
function renderBurn() {
  const m = me(); if (!m) return show("welcome");
  if (!$("#burnUrl").value) $("#burnUrl").value = qrLink(m.card, "nfc");
  $("#burnNoNfc").hidden = canNfc();
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  $("#burnIos").hidden = !ios;
  $("#burnNoTitle").textContent = ios ? "Burn from your iPhone" : "This browser can't write NFC.";
  $("#burnIosOpen").href = `scholartap-nfc://write?auto=1&url=${encodeURIComponent($("#burnUrl").value)}`;
  if (CONFIG.iosApp) { $("#burnIosGet").href = CONFIG.iosApp; $("#burnIosGet").hidden = false; }
  $("#burnVerify").hidden = !canNfc();
  burnState("", canNfc() ? "Tap to start" : ios ? "Burn with the app" : "Not supported here");
}
function stopBurn() { burnCtl?.abort(); burnCtl = null; }
async function burn() {
  if (!canNfc()) { if (!$("#burnIos").hidden) { $("#burnIosOpen").click(); return; } $("#burnNoNfc").scrollIntoView({ behavior: "smooth" }); return; }
  if (burnCtl) { stopBurn(); return burnState("", "Tap to start", "Stopped"); }
  const url = normCard($("#burnUrl").value.split("?")[0]) ? $("#burnUrl").value.trim() : null;
  if (!url) return toast("That link doesn't look right");
  burnCtl = new AbortController();
  burnState("waiting", "Hold a card to your phone", url.replace(/^https?:\/\//, ""));
  try {
    const ndef = new NDEFReader();
    do {
      await ndef.write({ records: [{ recordType: "url", data: url }] }, { overwrite: true, signal: burnCtl.signal });
      if ($("#burnLock").checked) { try { await ndef.makeReadOnly({ signal: burnCtl.signal }); } catch { toast("Written, but this card can't be locked"); } }
      burned++; buzz([20, 60, 40]);
      $("#burnCount").textContent = `· ${burned} written`;
      if ($("#burnBatch").checked) { burnState("ok waiting", `✓ Card ${burned} done`, "Next card…"); await new Promise((r) => setTimeout(r, 1200)); burnState("waiting", "Hold the next card", ""); }
    } while ($("#burnBatch").checked && burnCtl && !burnCtl.signal.aborted);
    burnState("ok", "✓ Burned!", "Tap it with any phone to test"); confetti();
  } catch (e) {
    if (e.name === "AbortError") return;
    burnState("err", "Try again", e.name === "NotAllowedError" ? "Allow NFC for this site, and turn NFC on in Settings" : e.name === "NotSupportedError" ? "No NFC on this phone" : e.message);
  } finally { burnCtl = null; }
}
async function verifyTag() {
  if (!canNfc()) return;
  stopBurn(); burnCtl = new AbortController();
  burnState("waiting", "Hold the card to check", "");
  try {
    const ndef = new NDEFReader(); await ndef.scan({ signal: burnCtl.signal });
    ndef.onreadingerror = () => burnState("err", "Couldn't read", "Try holding it still");
    ndef.onreading = ({ message, serialNumber }) => {
      const dec = new TextDecoder();
      const urls = message.records.filter((r) => /url/.test(r.recordType)).map((r) => dec.decode(r.data));
      const mine = urls.some((u) => normCard(u) === me()?.card);
      burnState(mine ? "ok" : "err", mine ? "✓ It's yours" : urls.length ? "Different link" : "Blank card", urls[0] || `Serial ${serialNumber || "?"}`);
      buzz(20); stopBurn();
    };
  } catch (e) { burnState("err", "Try again", e.message); burnCtl = null; }
}
$("#burnBtn").onclick = burn;
$("#burnVerify").onclick = verifyTag;
$("#burnUrl").addEventListener("input", () => { $("#burnIosOpen").href = `scholartap-nfc://write?auto=1&url=${encodeURIComponent($("#burnUrl").value)}`; });
// If the app isn't installed the custom link does nothing: still here after a moment → show the other routes.
$("#burnIosOpen").addEventListener("click", () => {
  const t = setTimeout(() => { if (!document.hidden) toast(CONFIG.iosApp ? "Get ScholarTap NFC first, or use NFC Tools" : "ScholarTap NFC isn't installed: use NFC Tools below"); }, 1600);
  addEventListener("pagehide", () => clearTimeout(t), { once: true }); document.addEventListener("visibilitychange", () => clearTimeout(t), { once: true });
});
$("#burnCopy").onclick = async () => { try { await navigator.clipboard.writeText($("#burnUrl").value); toast("Link copied: paste it into NFC Tools"); } catch { prompt("Copy your link:", $("#burnUrl").value); } };
$("#aNfc").onclick = (e) => { e.preventDefault(); show("nfc"); };

// ---------- lock-screen wallpaper ----------
async function wallpaper() {
  const m = me(); if (!m) return;
  const W = 1179, H = 2556, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const acc = m.accent || getComputedStyle(document.documentElement).getPropertyValue("--me").trim() || "#BA0C2F";
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, acc); g.addColorStop(.55, "#1a1016"); g.addColorStop(1, "#0b0a0b");
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 3; i++) { const r = x.createRadialGradient(W * [0.1, 0.9, 0.5][i], H * [0.75, 0.55, 0.95][i], 0, W * [0.1, 0.9, 0.5][i], H * [0.75, 0.55, 0.95][i], 700); r.addColorStop(0, ["#ff7a5955", "#7c4dff55", acc + "66"][i]); r.addColorStop(1, "transparent"); x.fillStyle = r; x.fillRect(0, 0, W, H); }
  const box = 620, bx = (W - box) / 2, by = H * 0.52;
  x.fillStyle = "#fff"; x.beginPath(); x.roundRect(bx - 40, by - 40, box + 80, box + 80, 64); x.fill();
  const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(qrSvg(qrLink(m.card, "qr")));
  await img.decode(); x.imageSmoothingEnabled = false; x.drawImage(img, bx, by, box, box);
  x.fillStyle = "#fff"; x.textAlign = "center";
  x.font = "700 76px 'Space Grotesk', Inter, sans-serif"; x.fillText(m.name || "", W / 2, by + box + 170);
  x.globalAlpha = .75; x.font = "500 40px Inter, sans-serif"; x.fillText(m.title || "", W / 2, by + box + 232);
  x.globalAlpha = .55; x.font = "600 34px Inter, sans-serif"; x.fillText("scan to swap cards · ScholarTap", W / 2, by + box + 300);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const file = new File([blob], "scholartap-lockscreen.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: "My ScholarTap lock screen" }); toast("Save the image, then set it as your wallpaper"); return; } catch (e) { if (e.name === "AbortError") return; } }
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: file.name }); document.body.append(a); a.click(); a.remove();
  toast("Downloaded. Set it as your lock screen 📲");
}

// ---------- fullscreen QR ----------
let wake = null;
async function fullQr() {
  const m = me(); if (!m) return;
  $("#fullQrBox").innerHTML = qrSvg(qrLink(m.card, "qr")); $("#fullName").textContent = m.name;
  $("#fullqr").hidden = false; buzz();
  try { wake = await navigator.wakeLock?.request("screen"); } catch {}
}
$("#fullqr").onclick = () => { $("#fullqr").hidden = true; wake?.release?.(); wake = null; };

// ---------- confetti ----------
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = $("#confetti"), x = cv.getContext("2d"); cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio;
  const cols = [getComputedStyle(document.documentElement).getPropertyValue("--me").trim(), "#ff7a59", "#7c4dff", "#2fd27a", "#ffd23f"];
  const ps = [...Array(140)].map(() => ({ x: cv.width / 2, y: cv.height * 0.35, vx: (Math.random() - .5) * 26, vy: -Math.random() * 26 - 6, r: 6 + Math.random() * 8, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6, s: (Math.random() - .5) * .4 }));
  let f = 0;
  (function draw() {
    x.clearRect(0, 0, cv.width, cv.height);
    ps.forEach((p) => { p.vy += .8; p.x += p.vx; p.y += p.vy; p.vx *= .985; p.a += p.s; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); });
    if (++f < 120) requestAnimationFrame(draw); else x.clearRect(0, 0, cv.width, cv.height);
  })();
}

// ---------- identity ----------
async function setMyCard(raw) {
  const url = normCard(raw); if (!url) throw new Error("Paste your card link, like https://you.github.io/card/");
  const card = await fetchCard(url);
  const prev = me() || {};
  const m = { ...summarize(card, url), login: prev.login };
  if (signedIn()) {
    try { const r = await api("/me", { method: "PUT", body: { card: url, name: m.name } }); m.login = r.login; }
    catch (e) { if (e.status === 403) throw e; }
  }
  ls.set(K.me, m);
  return m;
}
async function afterSignIn(login) {
  toast(`Signed in as @${login}`);
  const prev = me();
  if (prev?.card) { try { await setMyCard(prev.card); } catch {} }
  else {
    try {
      const r = await api("/me");
      if (r.profile?.card) ls.set(K.me, { ...r.profile, login });
      else { const guess = `https://${login}.github.io/card/`; try { await setMyCard(guess); } catch { try { await setMyCard(`https://${login}.github.io/`); } catch {} } }
    } catch {}
  }
  if (me()) ls.set(K.me, { ...me(), login });
  startLive();
  const after = ls.get("st-after", ""); ls.del("st-after");
  if (after) return openSwap(after);
  if (!me()) { $("#linkForm").scrollIntoView({ behavior: "smooth" }); toast("Now paste your card link"); return show("welcome"); }
  show("me");
}

$("#signGithub").onclick = () => { location.href = `${relayUrl()}/auth/github?return=${encodeURIComponent(location.href.split(/[?#]/)[0])}`; };
$("#tokenForm").onsubmit = async (e) => {
  e.preventDefault();
  try { const r = await api("/auth/token", { method: "POST", auth: false, body: { token: $("#tokenIn").value.trim() } }); $("#tokenIn").value = ""; ls.set(K.session, r.session); await afterSignIn(r.login); }
  catch (err) { toast(err.message === "offline" ? "Sign-in isn't available yet" : err.message); }
};
$("#linkForm").onsubmit = async (e) => {
  e.preventDefault();
  const b = $("#linkForm button"); b.disabled = true;
  try { await setMyCard($("#myLink").value); startLive(); const after = ls.get("st-after", ""); ls.del("st-after"); after ? openSwap(after) : show("me"); }
  catch (err) { toast(err.message); }
  b.disabled = false;
};

// ---------- wiring ----------
$$("#tabbar [data-tab]").forEach((b) => { b.onclick = () => { buzz(8); show(b.dataset.tab); }; });
$("#qrCard").onclick = fullQr;
$("#aScan").onclick = () => show("scan");
$("#emptyScan").onclick = () => show("scan");
$("#aWallpaper").onclick = wallpaper;
$("#aShare").onclick = async () => {
  const m = me(); const data = { title: `${m.name} · ScholarTap`, text: m.title || "", url: m.card };
  if (navigator.share) { try { await navigator.share(data); } catch {} } else { await navigator.clipboard?.writeText(m.card); toast("Link copied"); }
};
$("#eventIn").addEventListener("change", () => {
  const v = $("#eventIn").value.trim(); ls.set(K.event, v);
  if (v) ls.set(K.events, [v, ...ls.get(K.events, []).filter((x) => x !== v)].slice(0, 12));
  $("#eventPill").classList.toggle("on", Boolean(v)); toast(v ? `Event mode: new taps tagged “${v}”` : "Event mode off");
});
$("#q").addEventListener("input", renderTaps);
$("#tagChips").onclick = (e) => { const b = e.target.closest("[data-tag]"); if (b) { filterTag = b.dataset.tag; renderTaps(); } };
document.addEventListener("click", (e) => {
  const acc = e.target.closest("[data-accept]"); if (acc) { e.stopPropagation(); return acceptTap(acc.dataset.accept); }
  const row = e.target.closest("#tapList .person"); if (row) openSheet(row.dataset.id);
});
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches?.("#tapList .person")) openSheet(e.target.dataset.id); });

$("#meMenu").onclick = () => {
  const m = me();
  $("#setWho").textContent = signedIn() ? `Signed in as @${m?.login || "you"} · taps sync across your devices` : "Not signed in · taps are saved on this phone only";
  $("#setLink").value = m?.card || "";
  $("#setSignout").textContent = signedIn() ? "Sign out on this phone" : "Forget this card on this phone";
  $("#setTheme").textContent = `Theme: ${ls.get(K.theme, "auto")}`;
  $("#settings").showModal();
};
$("#settings").addEventListener("close", async () => {
  const v = $("#settings").returnValue;
  if (v === "relink") { try { await setMyCard($("#setLink").value); toast("Card updated"); renderMe(); } catch (e) { toast(e.message); } }
  if (v === "theme") { const order = ["auto", "dark", "light"]; const next = order[(order.indexOf(ls.get(K.theme, "auto")) + 1) % 3]; ls.set(K.theme, next); applyTheme(); $("#meMenu").click(); }
  if (v === "signout") { if (confirm("Sign out? Your saved taps stay on this phone.")) { ls.del(K.session); if (confirm("Also forget your card on this phone?")) ls.del(K.me); location.reload(); } }
});
function applyTheme() { const t = ls.get(K.theme, "auto"); if (t === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = t; }

// ---------- boot ----------
async function boot() {
  applyTheme(); paintIcons(); applyAccent();
  // A sign-in redirect lands with #session=…
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get("session")) { ls.set(K.session, h.get("session")); history.replaceState(null, "", location.pathname + location.search); }
  const params = new URLSearchParams(location.search);
  if (params.get("relay")) ls.set(K.relay, params.get("relay"));
  try { CONFIG = { ...CONFIG, ...(await (await fetch("config.json", { cache: "no-cache" })).json()) }; } catch {}
  if (relayUrl()) { try { const r = await (await fetch(relayUrl() + "/")).json(); FEATURES = { ...(r.features || {}), vapid: r.vapidPublicKey }; } catch { FEATURES = {}; } }
  $("#signGithub").hidden = !FEATURES.github;
  $("#tokenBox").hidden = !FEATURES.token;
  $(".or span").textContent = FEATURES.token ? "or, no account" : "start with your card";

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  if (h.get("session")) return afterSignIn(h.get("login") || "you");

  const shared = params.get("url") || (params.get("text") || "").match(/https?:\/\/\S+/)?.[0];
  const swap = params.get("swap") || shared;
  if (swap) { if (!me()) ls.set("st-after", swap); return openSwap(swap, { via: params.get("via") || "link", back: !shared }); }
  if (!me()) return show("welcome");
  show(params.get("view") || "me");
  if (params.get("qr")) fullQr();
  startLive();
}
let live = false;
function startLive() {
  pullContacts().then(() => current === "taps" && renderTaps());
  pullInbox();
  if (live) return; live = true;
  setInterval(pullInbox, 45_000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) pullInbox(); });
}
boot();
