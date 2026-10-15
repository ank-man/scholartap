/*!
 * ScholarTap card — core renderer
 * An initiative of GSA Connect · UGA Graduate Student Association
 *
 * Reads card.json and fills any element in index.html that carries a data-* hook:
 *   data-field="path"        textContent from card.json (dot paths ok: "gsa.role")
 *   data-src="path"          <img src>
 *   data-href="path"         <a href>  (data-prefix="mailto:" optional)
 *   data-show="path"         hide element when value is empty
 *   data-list="path"         repeat the inner <template> once per array item;
 *                            inside the template use data-item / data-item-href / data-item-icon / data-item-src
 *   data-section="path"      hide the whole section when the list/value is empty
 *   data-join=", " data-fields="a,b"   join the non-empty fields with the separator
 *   data-action="..."        save-contact | share | copy-link | flip | toggle (data-target=".sel")
 *   data-qr                  renders a QR code that points to this card
 *   data-wallet="apple|google|samsung"  shown only when that pass was built
 *
 * You should not need to edit this file — edit card.json instead.
 */
(() => {
  "use strict";

  const ICONS = {
    researchgate: '<rect x="2.5" y="2.5" width="19" height="19" rx="5"/><text x="12" y="15.6" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="700" fill="currentColor" stroke="none">RG</text>',
    semanticscholar: '<rect x="2.5" y="2.5" width="19" height="19" rx="5"/><text x="12" y="15.6" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="700" fill="currentColor" stroke="none">S2</text>',
    scopus: '<rect x="2.5" y="2.5" width="19" height="19" rx="5"/><text x="12" y="15.6" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="700" fill="currentColor" stroke="none">Sc</text>',
    webofscience: '<rect x="2.5" y="2.5" width="19" height="19" rx="5"/><text x="12" y="15.6" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="7" font-weight="700" fill="currentColor" stroke="none">WoS</text>',
    academia: '<path d="M3 21h18M5 21V10M9.5 21V10M14.5 21V10M19 21V10M2.5 10 12 4l9.5 6z"/>',
    osf: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/>',
    x: '<path d="M4 4l16 16M20 4 4 20"/>',
    bluesky: '<path d="M12 11c-1.4-2.8-5-6.5-7.4-6.5C3.2 4.5 3 6.6 3.5 8.8c.6 2.3 2.9 3.1 5.1 2.7-3 .6-3.6 2.7-2 4.3 2.6 2.6 4.2-.9 5.4-3.8 1.2 2.9 2.8 6.4 5.4 3.8 1.6-1.6 1-3.7-2-4.3 2.2.4 4.5-.4 5.1-2.7.5-2.2.3-4.3-1.1-4.3-2.4 0-6 3.7-7.4 6.5z"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    mastodon: '<path d="M20.5 12.5c0 3.7-3.5 5.8-8.5 5.8-1.3 0-2.6-.2-3.6-.5.2 1.5 1.6 2.3 4 2.2"/><path d="M3.5 12.5V9.4C3.5 6 6 4 12 4s8.5 2 8.5 5.4v3.1"/><path d="M8 13.5V9.6a2 2 0 0 1 4 0v2.6m0 0V9.6a2 2 0 0 1 4 0v3.9"/>',
    youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    cv: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    scholar: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    orcid: '<circle cx="12" cy="12" r="10"/><path d="M8.5 8v8M12 8h2a4 4 0 0 1 0 8h-2z"/>',
    linkedin: '<rect x="2" y="2" width="20" height="20" rx="3"/><path d="M7 10v7M7 7v.01M11 17v-4a2.5 2.5 0 0 1 5 0v4M11 10v7"/>',
    github: '<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>',
    research: '<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/>',
    website: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    location: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    social: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
    video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m22 8-6 4 6 4z"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    contact: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    flip: '<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
    nfc: '<path d="M6 8.3a6 6 0 0 1 0 7.4M9.5 5.5a10 10 0 0 1 0 13M13 3a14 14 0 0 1 0 18"/><circle cx="3" cy="12" r="1" fill="currentColor"/>',
    arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
    apple: '<path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9a4.8 4.8 0 0 0-3.8-2c-1.6-.2-3.1.9-3.9.9s-2-.9-3.4-.9a5 5 0 0 0-4.2 2.6c-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6s1.8-.8 3.3-.8 2 .8 3.3.8 2.2-1.3 3-2.5a10 10 0 0 0 1.4-2.8 4.3 4.3 0 0 1-2.4-4.2zM13.9 5c.7-.9 1.2-2 1-3.2a4.5 4.5 0 0 0-2.9 1.5 4.2 4.2 0 0 0-1.1 3.1A3.7 3.7 0 0 0 13.9 5z" fill="currentColor" stroke="none"/>',
    wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><path d="M16 14h.01"/>'
  };
  const ICON_ALIASES = {
    "google scholar": "scholar", googlescholar: "scholar", lab: "research", "semantic scholar": "semanticscholar", "web of science": "webofscience", publons: "webofscience", "academia.edu": "academia", "x (twitter)": "x",
    "linked in": "linkedin", twitter: "x", threads: "social", site: "website", web: "website",
    portfolio: "website", mail: "email", resume: "cv", pdf: "cv", publications: "book",
    google: "scholar", gsa: "users", "wifi-nfc": "nfc", tap: "nfc"
  };

  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const get = (obj, path) =>
    path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const empty = (v) => v == null || v === "" || (Array.isArray(v) && v.length === 0);

  function icon(name, cls = "icon") {
    const key = String(name || "link").toLowerCase();
    const body = ICONS[key] || ICONS[ICON_ALIASES[key]] || ICONS.link;
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  function cardUrl(card) {
    return (card.siteUrl && card.siteUrl.trim()) || location.href.split("#")[0].replace(/index\.html$/, "");
  }

  function initials(name = "") {
    return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  }

  // ---------- vCard ----------
  function esc(v) {
    return String(v ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  }
  function vcard(card) {
    const [first, ...rest] = (card.name || "").split(" ");
    const last = rest.pop() || "";
    const lines = [
      "BEGIN:VCARD", "VERSION:3.0",
      `N:${esc(last)};${esc(first)};${esc(rest.join(" "))};;`,
      `FN:${esc(card.name)}`,
      card.organization && `ORG:${esc(card.organization)}${card.department ? ";" + esc(card.department) : ""}`,
      card.title && `TITLE:${esc(card.title)}`,
      card.email && `EMAIL;TYPE=INTERNET,WORK:${card.email}`,
      card.phone && `TEL;TYPE=CELL:${card.phone}`,
      card.website && `URL:${card.website}`,
      `URL;TYPE=ScholarTap:${cardUrl(card)}`,
      card.location && `ADR;TYPE=WORK:;;;${esc(card.location)};;;`,
      `NOTE:${esc([card.headline, card.bio].filter(Boolean).join(" — "))}`,
      "END:VCARD"
    ];
    return lines.filter(Boolean).join("\r\n");
  }

  function saveContact(card) {
    // Prefer the static card.vcf built by `npm run build` (best iOS support), else build one in-browser.
    fetch("card.vcf", { method: "HEAD" })
      .then((r) => { if (!r.ok) throw 0; location.href = "card.vcf"; })
      .catch(() => {
        const blob = new Blob([vcard(card)], { type: "text/vcard;charset=utf-8" });
        const a = Object.assign(document.createElement("a"), {
          href: URL.createObjectURL(blob),
          download: `${(card.slug || card.name || "contact").replace(/\s+/g, "-").toLowerCase()}.vcf`
        });
        document.body.appendChild(a); a.click(); a.remove();
      });
  }

  function toast(msg) {
    let t = document.querySelector(".gc-toast");
    if (!t) { t = document.createElement("div"); t.className = "gc-toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2200);
  }

  async function share(card) {
    const data = { title: `${card.name} · ScholarTap`, text: card.headline || card.title || "", url: cardUrl(card) };
    if (navigator.share) { try { await navigator.share(data); return; } catch (_) { return; } }
    copyLink(card);
  }
  async function copyLink(card) {
    try { await navigator.clipboard.writeText(cardUrl(card)); toast("Link copied"); }
    catch (_) { prompt("Copy this link:", cardUrl(card)); }
  }

  // ---------- QR ----------
  function renderQR(el, text) {
    if (typeof window.qrcode !== "function") { el.hidden = true; return; }
    const qr = window.qrcode(0, "M");
    qr.addData(text); qr.make();
    const n = qr.getModuleCount(), q = 2, size = n + q * 2;
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`;
    el.innerHTML = `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code linking to this card"><rect width="100%" height="100%" fill="var(--qr-bg,#fff)"/><path d="${d}" fill="var(--qr-fg,#000)"/></svg>`;
  }

  // ---------- binding ----------
  function fillItem(node, item) {
    const val = (k) => (k === "." ? item : typeof item === "object" ? get(item, k) : undefined);
    const scope = (sel) => (node.matches?.(sel) ? [node] : []).concat($$(sel, node));
    scope("[data-item]").forEach((el) => {
      const v = val(el.dataset.item);
      if (empty(v)) el.remove(); else el.textContent = Array.isArray(v) ? v.join(", ") : v;
    });
    scope("[data-item-href]").forEach((el) => {
      const v = val(el.dataset.itemHref);
      if (empty(v)) { el.removeAttribute("href"); el.classList.add("no-link"); }
      else { el.href = v; if (/^https?:/.test(v)) { el.target = "_blank"; el.rel = "noopener"; } }
    });
    scope("[data-item-src]").forEach((el) => { const v = val(el.dataset.itemSrc); if (empty(v)) el.remove(); else { el.src = v; el.alt = el.alt || ""; } });
    scope("[data-item-icon]").forEach((el) => { el.innerHTML = icon(val(el.dataset.itemIcon) || val("label")); });
    scope("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
    scope("[data-item-show]").forEach((el) => { if (empty(val(el.dataset.itemShow))) el.remove(); });
  }

  function bind(card) {
    $$("[data-field]").forEach((el) => {
      const v = get(card, el.dataset.field);
      if (empty(v)) el.hidden = true; else el.textContent = Array.isArray(v) ? v.join(" · ") : v;
    });
    $$("[data-join]").forEach((el) => {
      const vals = el.dataset.fields.split(",").map((f) => get(card, f.trim())).filter((v) => !empty(v));
      if (vals.length) el.textContent = vals.join(el.dataset.join); else el.hidden = true;
    });
    $$("[data-src]").forEach((el) => {
      const v = get(card, el.dataset.src);
      if (empty(v)) {
        el.hidden = true;
        const fb = el.parentElement?.querySelector("[data-initials]");
        if (fb) fb.hidden = false;
      } else { el.src = v; el.alt = el.alt || card.name; }
    });
    $$("[data-initials]").forEach((el) => { el.textContent = initials(card.name); });
    $$("[data-href]").forEach((el) => {
      const v = get(card, el.dataset.href);
      if (empty(v)) { el.hidden = true; return; }
      el.href = (el.dataset.prefix || "") + (el.dataset.prefix === "tel:" ? String(v).replace(/[^\d+]/g, "") : v);
      if (/^https?:/.test(el.href) && !el.href.startsWith(location.origin)) { el.target = "_blank"; el.rel = "noopener"; }
    });
    $$("[data-show]").forEach((el) => { if (empty(get(card, el.dataset.show))) el.hidden = true; });
    $$("[data-section]").forEach((el) => { if (empty(get(card, el.dataset.section))) el.hidden = true; });
    $$("[data-icon]").forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
    $$("[data-list]").forEach((list) => {
      const tpl = list.querySelector("template");
      const items = get(card, list.dataset.list) || [];
      if (!tpl) return;
      items.forEach((item) => {
        const frag = tpl.content.cloneNode(true);
        [...frag.children].forEach((child) => fillItem(child, item));
        list.appendChild(frag);
      });
    });
    $$("[data-qr]").forEach((el) => renderQR(el, cardUrl(card)));
    $$("[data-card-url]").forEach((el) => { el.textContent = cardUrl(card).replace(/^https?:\/\//, "").replace(/\/$/, ""); });

    // Powered-by
    const pb = card.poweredBy || { name: "ScholarTap", url: "https://ank-man.github.io/scholartap/" };
    $$("[data-powered]").forEach((el) => {
      el.innerHTML = `Made with <strong>${pb.name || "ScholarTap"}</strong>`;
      el.title = "Make your own free research card";
      if (pb.url) { el.href = pb.url; el.target = "_blank"; el.rel = "noopener"; }
    });

    // Actions
    const actions = {
      "save-contact": () => saveContact(card),
      share: () => share(card),
      "copy-link": () => copyLink(card),
      flip: (el) => el.closest("[data-flippable]")?.classList.toggle("flipped"),
      toggle: (el) => document.querySelector(el.dataset.target)?.classList.toggle("open")
    };
    $$("[data-action]").forEach((el) => {
      const fn = actions[el.dataset.action];
      if (fn) el.addEventListener("click", (e) => { e.preventDefault(); fn(el); });
    });

    // Document metadata
    document.title = `${card.name} · ${card.brand?.cardName || "ScholarTap"}`;
    const desc = card.headline || card.title || "";
    setMeta("description", desc);
    setMeta("og:title", document.title, "property");
    setMeta("og:description", desc, "property");
    if (card.theme?.accent) document.documentElement.style.setProperty("--accent", card.theme.accent);
  }

  function setMeta(name, content, attr = "name") {
    let m = document.querySelector(`meta[${attr}="${name}"]`);
    if (!m) { m = document.createElement("meta"); m.setAttribute(attr, name); document.head.appendChild(m); }
    m.setAttribute("content", content);
  }

  // ---------- wallet buttons ----------
  async function wallet() {
    const btns = $$("[data-wallet]");
    if (!btns.length) return;
    let w = {};
    try { const r = await fetch("wallet/wallet.json", { cache: "no-store" }); if (r.ok) w = await r.json(); } catch (_) {}
    let any = false;
    btns.forEach((b) => {
      const url = w[b.dataset.wallet];
      if (url) { b.href = url; b.hidden = false; any = true; } else b.hidden = true;
    });
    $$("[data-wallet-group]").forEach((g) => { g.hidden = !any; });
  }

  async function init() {
    document.documentElement.classList.add("gc-loading");
    let card = window.GSA_CARD; // set by the setup app's live preview
    try {
      if (!card) {
        const r = await fetch("card.json", { cache: "no-cache" });
        card = await r.json();
        // A brand-new card that hasn't been set up yet → send the visitor to the setup app.
        if (card.setup === false) { location.replace("app/"); return; }
      }
    } catch (err) {
      document.body.insertAdjacentHTML("afterbegin",
        '<p class="gc-error">Could not load <code>card.json</code>. Preview with a local server: <code>npm run dev</code> (or <code>python3 -m http.server</code>), not by double-clicking the file.</p>');
      console.error(err);
      return;
    }
    bind(card);
    await wallet();
    document.documentElement.classList.remove("gc-loading");
    document.documentElement.classList.add("gc-ready");
    window.GSAConnect = { card, vcard: () => vcard(card), icon };
  }

  // The setup app loads this file only for its icons.
  if (document.currentScript?.hasAttribute("data-icons-only")) { window.GSAIcon = (n) => icon(n); return; }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
