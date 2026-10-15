// Field-specific background motifs, emitted as tileable SVG data-URIs for the `--motif` CSS variable.
// motif(name, colour, opacity) → `url("data:image/svg+xml,…")`
const tile = (w, h, body, c, o) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><g fill='none' stroke='${c}' stroke-opacity='${o}' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'>${body}</g></svg>`
  )}")`;
const fillTile = (w, h, body, c, o) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><g fill='${c}' fill-opacity='${o}'>${body}</g></svg>`
  )}")`;

const sine = (y, amp, len, phase = 0, w = 120) => {
  let d = `M0 ${y + amp * Math.sin(phase)}`;
  for (let x = 4; x <= w; x += 4) d += ` L${x} ${(y + amp * Math.sin((x / len) * 2 * Math.PI + phase)).toFixed(1)}`;
  return d;
};

export const MOTIFS = {
  // Life sciences
  dna: (c, o) => tile(60, 120, `<path d="${sine(30, 18, 120, 0, 120).replace(/(\d+(\.\d+)?) (\d+(\.\d+)?)/g, (_, x, __, y) => `${y} ${x}`)}"/><path d="${sine(30, 18, 120, Math.PI, 120).replace(/(\d+(\.\d+)?) (\d+(\.\d+)?)/g, (_, x, __, y) => `${y} ${x}`)}"/>` +
    [10, 25, 40, 55, 70, 85, 100, 115].map((y) => { const a = 18 * Math.sin((y / 120) * 2 * Math.PI); return `<path d="M${(30 - a).toFixed(1)} ${y}H${(30 + a).toFixed(1)}" stroke-opacity='${o * 0.7}'/>`; }).join(""), c, o),
  cells: (c, o) => tile(90, 90, `<circle cx="22" cy="24" r="16"/><circle cx="25" cy="22" r="5"/><circle cx="68" cy="62" r="19"/><circle cx="64" cy="66" r="6"/><circle cx="70" cy="16" r="8"/><circle cx="20" cy="74" r="10"/>`, c, o),
  leaves: (c, o) => tile(80, 80, `<path d="M14 58C14 36 30 22 52 20 52 42 36 58 14 58Z"/><path d="M14 58 44 28"/><path d="M58 76c0-12 9-20 21-21 0 12-9 21-21 21Z" transform="translate(-6 -8)"/><path d="M52 68 66 54"/>`, c, o),
  seeds: (c, o) => tile(70, 70, `<path d="M35 8v54"/>` + [16, 26, 36, 46].map((y) => `<path d="M35 ${y}c-8-2-12-7-12-12 7 0 11 5 12 12Z"/><path d="M35 ${y}c8-2 12-7 12-12-7 0-11 5-12 12Z"/>`).join(""), c, o),
  insects: (c, o) => tile(96, 96,
    `<g transform="translate(26 26) rotate(-20)"><ellipse cx="0" cy="4" rx="8" ry="12"/><circle cx="0" cy="-11" r="4"/><path d="M0-8v24M-8 0l-9-5M8 0l9-5M-8 6l-10 2M8 6l10 2M-7 12l-8 7M7 12l8 7M-2-14l-4-7M2-14l4-7"/></g>` +
    `<g transform="translate(72 70) rotate(25)"><path d="M0-14v28"/><ellipse cx="-9" cy="-4" rx="9" ry="5"/><ellipse cx="9" cy="-4" rx="9" ry="5"/><ellipse cx="-7" cy="5" rx="7" ry="4"/><ellipse cx="7" cy="5" rx="7" ry="4"/></g>`, c, o),
  honeycomb: (c, o) => tile(56, 97, `<path d="M28 0 56 16v32L28 64 0 48V16Z"/><path d="M28 64v33M0 48l-0 0M56 48v0"/>`, c, o),
  paw: (c, o) => fillTile(80, 80, `<ellipse cx="24" cy="30" rx="8" ry="7"/><circle cx="13" cy="19" r="3.4"/><circle cx="20" cy="14" r="3.4"/><circle cx="29" cy="14" r="3.4"/><circle cx="36" cy="20" r="3.4"/><g transform="translate(40 40)"><ellipse cx="14" cy="18" rx="7" ry="6"/><circle cx="5" cy="9" r="3"/><circle cx="11" cy="5" r="3"/><circle cx="18" cy="5" r="3"/><circle cx="24" cy="10" r="3"/></g>`, c, o),
  plus: (c, o) => tile(48, 48, `<path d="M12 6v12M6 12h12M36 30v12M30 36h12"/>`, c, o),
  pills: (c, o) => tile(80, 80, `<g transform="rotate(-35 24 24)"><rect x="10" y="18" width="28" height="12" rx="6"/><path d="M24 18v12"/></g><circle cx="60" cy="58" r="8"/><path d="M54 58h12"/>`, c, o),
  neural: (c, o) => tile(100, 100, `<path d="M10 20 50 50 90 15M50 50 20 85M50 50 85 80M10 20 20 85M90 15 85 80"/>` + [[10, 20], [50, 50], [90, 15], [20, 85], [85, 80]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4"/>`).join(""), c, o),
  // Physical sciences & engineering
  hex: (c, o) => tile(52, 90, `<path d="M26 0 52 15v30L26 60 0 45V15Z"/><path d="M26 60v30"/><path d="M14 22 26 15M26 15l12 7" stroke-opacity='${o * 0.6}'/>`, c, o),
  atoms: (c, o) => tile(110, 110, `<g transform="translate(55 55)"><ellipse rx="34" ry="12"/><ellipse rx="34" ry="12" transform="rotate(60)"/><ellipse rx="34" ry="12" transform="rotate(-60)"/><circle r="3"/></g>`, c, o),
  stars: (c, o) => fillTile(120, 120, [[12, 18, 1.2], [48, 8, .8], [90, 22, 1.6], [70, 54, 1], [24, 70, 1.4], [104, 84, .9], [56, 100, 1.3], [8, 108, .7], [38, 44, .6], [84, 112, 1.1]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join(""), c, o),
  circuit: (c, o) => tile(80, 80, `<path d="M0 20h24l10 10h20M54 30h26M40 0v14l-6 6M40 80V56l10-10h30M0 60h18l8-8v-8"/><circle cx="54" cy="30" r="3"/><circle cx="26" cy="44" r="3"/><circle cx="40" cy="56" r="3"/>`, c, o),
  blueprint: (c, o) => tile(100, 100, `<path d="M0 .5H100M.5 0V100" stroke-width="1.2"/>` + [20, 40, 60, 80].map((v) => `<path d="M0 ${v}H100M${v} 0V100" stroke-width=".5"/>`).join(""), c, o),
  grid: (c, o) => tile(24, 24, `<path d="M0 .5H24M.5 0V24" stroke-width=".8"/>`, c, o),
  math: (c, o) => fillTile(140, 140, `<text x="10" y="30" font-family="serif" font-size="22">∑</text><text x="80" y="40" font-family="serif" font-size="18" font-style="italic">π</text><text x="40" y="84" font-family="serif" font-size="20">∫</text><text x="100" y="100" font-family="serif" font-size="16" font-style="italic">e^iθ</text><text x="14" y="128" font-family="serif" font-size="18">∞</text><text x="70" y="130" font-family="serif" font-size="16">∂x</text>`, c, o),
  strata: (c, o) => tile(120, 60, [10, 22, 34, 46].map((y, i) => `<path d="${sine(y, 3 + i, 120, i)}"/>`).join(""), c, o),
  topo: (c, o) => tile(140, 140, [14, 26, 38, 50, 62].map((r) => `<path d="M${70 - r} 70c0-${r * .7} ${r * .4}-${r} ${r}-${r}s${r} ${r * .5} ${r} ${r}-${r * .5} ${r * 1.05}-${r} ${r}-${r}-${r * .4}-${r}-${r}Z"/>`).join(""), c, o),
  waves: (c, o) => tile(120, 40, `<path d="${sine(12, 6, 60)}"/><path d="${sine(30, 6, 60, Math.PI)}" stroke-opacity='${o * 0.6}'/>`, c, o),
  code: (c, o) => fillTile(160, 100, `<text x="8" y="26" font-family="monospace" font-size="14">&lt;/&gt;</text><text x="92" y="44" font-family="monospace" font-size="13">{ }</text><text x="30" y="80" font-family="monospace" font-size="12">0101</text><text x="110" y="92" font-family="monospace" font-size="14">=&gt;</text>`, c, o),
  // Social sciences, business, policy
  bars: (c, o) => tile(80, 60, `<path d="M8 56V40M20 56V30M32 56V36M44 56V18M56 56V26M68 56V10" stroke-width="4"/>`, c, o),
  ledger: (c, o) => tile(40, 28, `<path d="M0 27.5H40" stroke-width=".8"/>`, c, o),
  globe: (c, o) => tile(120, 120, `<g transform="translate(60 60)"><circle r="40"/><ellipse rx="16" ry="40"/><path d="M-40 0H40M-34 -20H34M-34 20H34M0-40V40"/></g>`, c, o),
  // Humanities & arts
  type: (c, o) => fillTile(160, 120, `<text x="10" y="44" font-family="Georgia,serif" font-size="40">“</text><text x="70" y="40" font-family="Georgia,serif" font-size="22" font-style="italic">Aa</text><text x="120" y="90" font-family="Georgia,serif" font-size="28">¶</text><text x="30" y="104" font-family="Georgia,serif" font-size="20">&amp;</text>`, c, o),
  ruled: (c, o) => tile(60, 30, `<path d="M0 29.5H60" stroke-width=".8"/>`, c, o),
  columns: (c, o) => tile(60, 120, `<path d="M8 20h44M10 26h40M14 26v74M22 26v74M30 26v74M38 26v74M46 26v74M10 100h40M8 106h44"/>`, c, o),
  staff: (c, o) => tile(160, 70, [10, 18, 26, 34, 42].map((y) => `<path d="M0 ${y}H160" stroke-width=".8"/>`).join("") + `<ellipse cx="40" cy="38" rx="5" ry="3.6" transform="rotate(-20 40 38)" fill="${c}" fill-opacity="${o}"/><path d="M44.5 37V12"/><ellipse cx="110" cy="22" rx="5" ry="3.6" transform="rotate(-20 110 22)" fill="${c}" fill-opacity="${o}"/><path d="M114.5 21V-2"/>`, c, o),
  brush: (c, o) => fillTile(140, 140, `<path d="M10 40c30-20 60 10 90-10 10-6 20-4 30 2-30 20-60-6-90 14-12 8-24 6-30-6Z"/><circle cx="110" cy="100" r="14"/><path d="M20 110l30-30 10 10-30 30Z"/>`, c, o),
  halftone: (c, o) => fillTile(16, 16, `<circle cx="4" cy="4" r="1.6"/><circle cx="12" cy="12" r="1.6"/>`, c, o),
  sound: (c, o) => tile(120, 60, [6, 14, 22, 30, 38, 46, 54, 62, 70, 78, 86, 94, 102, 110].map((x, i) => { const h = [6, 14, 24, 10, 30, 18, 8, 22, 34, 14, 6, 20, 12, 4][i]; return `<path d="M${x} ${30 - h}V${30 + h}" stroke-width="3"/>`; }).join(""), c, o),
  diagonal: (c, o) => tile(20, 20, `<path d="M0 20 20 0" stroke-width="1"/>`, c, o)
};

export function motif(name, colour = "#ffffff", opacity = 0.12) {
  const fn = MOTIFS[name];
  if (!fn) throw new Error(`Unknown motif: ${name}`);
  return fn(colour, opacity);
}
