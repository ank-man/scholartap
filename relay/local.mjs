// Runs the relay on your laptop with node:sqlite (Node 22.5+): `npm run relay` → http://localhost:8787
//   RELAY_DB=relay/local.db  SESSION_SECRET=...  GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET (optional)
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import worker from "./src/worker.js";
import { makeStore, nodeSqlite } from "./src/store.js";

const port = Number(process.env.RELAY_PORT) || 8787;
const db = new DatabaseSync(process.env.RELAY_DB || resolve(import.meta.dirname, "local.db"));
const env = { ...process.env, SESSION_SECRET: process.env.SESSION_SECRET || "local-dev-secret-change-me", __store: makeStore(nodeSqlite(db)) };

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  headers.set("cf-connecting-ip", req.socket.remoteAddress || "local");
  const request = new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
  const out = await worker.fetch(request, env);
  res.writeHead(out.status, Object.fromEntries(out.headers));
  res.end(Buffer.from(await out.arrayBuffer()));
}).listen(port, "127.0.0.1", () => console.log(`\n  ScholarTap relay → http://localhost:${port}\n`));
