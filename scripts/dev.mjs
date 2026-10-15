// Zero-dependency local server.
//   npm run dev     → your card at http://localhost:4173
//   npm run setup   → the setup app at http://localhost:4173/app/
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { extname, join, resolve } from "node:path";

const args = process.argv.slice(2);
const openIdx = args.indexOf("--open");
const openPath = openIdx >= 0 ? (args[openIdx + 1] && !args[openIdx + 1].startsWith("--") && args[openIdx + 1] !== "dist" ? args[openIdx + 1] : "") : null;
const sub = args.find((a, i) => !a.startsWith("--") && !(openIdx >= 0 && i === openIdx + 1 && a !== "dist"));
const root = resolve(import.meta.dirname, "..", sub || ".");
const port = Number(process.env.PORT) || 4173;
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".pdf": "application/pdf", ".vcf": "text/vcard", ".webmanifest": "application/manifest+json",
  ".pkpass": "application/vnd.apple.pkpass", ".ico": "image/x-icon"
};

createServer(async (req, res) => {
  let file = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  const link = `http://localhost:${port}/${openPath || ""}`;
  console.log(`\n  GSA Connect → ${link}\n  (Ctrl+C to stop)\n`);
  if (openPath !== null && !process.env.NO_OPEN) {
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open";
    execFile(opener, [link], () => {});
  }
});
