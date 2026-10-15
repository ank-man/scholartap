// vCard 3.0 — the format iOS, Android and Outlook all import.
const esc = (v) => String(v ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export function toVCard(card) {
  const parts = (card.name || "").trim().split(/\s+/);
  const first = parts.shift() || "";
  const last = parts.pop() || "";
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${esc(last)};${esc(first)};${esc(parts.join(" "))};;`,
    `FN:${esc(card.name)}`,
    card.organization && `ORG:${esc(card.organization)}${card.department ? ";" + esc(card.department) : ""}`,
    card.title && `TITLE:${esc(card.title)}`,
    card.email && `EMAIL;TYPE=INTERNET,WORK:${card.email}`,
    card.phone && `TEL;TYPE=CELL:${card.phone}`,
    card.website && `URL:${card.website}`,
    card.siteUrl && `URL;TYPE=ScholarTap:${card.siteUrl}`,
    ...(card.links || []).slice(0, 6).map((l) => `X-SOCIALPROFILE;TYPE=${esc(l.label)}:${l.url}`),
    card.location && `ADR;TYPE=WORK:;;;${esc(card.location)};;;`,
    (card.headline || card.bio) && `NOTE:${esc([card.headline, card.gsaRole].filter(Boolean).join(" — "))}`,
    "END:VCARD"
  ];
  return lines.filter(Boolean).join("\r\n") + "\r\n";
}
