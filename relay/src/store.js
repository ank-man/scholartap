// Storage for the relay. One SQL schema, two drivers: Cloudflare D1 in production, node:sqlite locally.

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users    (login TEXT PRIMARY KEY, created INTEGER NOT NULL, seen INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS profiles (login TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS taps (
  id TEXT PRIMARY KEY, to_owner TEXT NOT NULL, to_card TEXT NOT NULL,
  from_login TEXT NOT NULL DEFAULT '', from_card TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '', photo TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '', event TEXT NOT NULL DEFAULT '', kind TEXT NOT NULL, created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS taps_to   ON taps (to_owner, created);
CREATE INDEX IF NOT EXISTS taps_from ON taps (from_login, to_owner);
CREATE TABLE IF NOT EXISTS contacts (login TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS views (owner TEXT NOT NULL, card TEXT NOT NULL, day TEXT NOT NULL, via TEXT NOT NULL, n INTEGER NOT NULL,
  PRIMARY KEY (card, day, via));
CREATE INDEX IF NOT EXISTS views_owner ON views (owner, day);
CREATE TABLE IF NOT EXISTS rates (key TEXT PRIMARY KEY, n INTEGER NOT NULL, reset INTEGER NOT NULL);
`;

const now = () => Math.floor(Date.now() / 1000);

// D1: db.prepare(sql).bind(...).run() / .all() / .first()
export function d1(db) {
  return {
    run: (sql, ...a) => db.prepare(sql).bind(...a).run(),
    all: async (sql, ...a) => (await db.prepare(sql).bind(...a).all()).results || [],
    first: (sql, ...a) => db.prepare(sql).bind(...a).first()
  };
}

// node:sqlite DatabaseSync
export function nodeSqlite(db) {
  db.exec(SCHEMA);
  return {
    run: async (sql, ...a) => db.prepare(sql).run(...a),
    all: async (sql, ...a) => db.prepare(sql).all(...a).map((r) => ({ ...r })),
    first: async (sql, ...a) => { const r = db.prepare(sql).get(...a); return r ? { ...r } : null; }
  };
}

export function makeStore(dbOrAdapter) {
  if (!dbOrAdapter) throw new Error("Relay has no database binding (DB)");
  const q = typeof dbOrAdapter.prepare === "function" ? d1(dbOrAdapter) : dbOrAdapter;
  const parse = (r) => (r ? JSON.parse(r.data) : null);

  return {
    async touchUser(login) {
      await q.run("INSERT INTO users (login, created, seen) VALUES (?, ?, ?) ON CONFLICT(login) DO UPDATE SET seen = excluded.seen", login, now(), now());
    },
    getProfile: async (login) => parse(await q.first("SELECT data FROM profiles WHERE login = ?", login)),
    async setProfile(login, data) {
      await q.run("INSERT INTO profiles (login, data, updated) VALUES (?, ?, ?) ON CONFLICT(login) DO UPDATE SET data = excluded.data, updated = excluded.updated", login, JSON.stringify(data), now());
    },

    // A repeat tap from the same person within `dedupeSec` refreshes the old one instead of piling up.
    async addTap(t, dedupeSec) {
      if (dedupeSec && t.from_login) {
        const prev = await q.first("SELECT id FROM taps WHERE from_login = ? AND to_owner = ? AND created > ? ORDER BY created DESC LIMIT 1", t.from_login, t.to_owner, t.created - dedupeSec);
        if (prev) {
          await q.run("UPDATE taps SET note = CASE WHEN ? <> '' THEN ? ELSE note END, event = CASE WHEN ? <> '' THEN ? ELSE event END, created = ?, to_card = ? WHERE id = ?",
            t.note, t.note, t.event, t.event, t.created, t.to_card, prev.id);
          return prev.id;
        }
      }
      await q.run(`INSERT INTO taps (id, to_owner, to_card, from_login, from_card, name, title, photo, email, phone, note, event, kind, created)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        t.id, t.to_owner, t.to_card, t.from_login, t.from_card, t.name, t.title, t.photo, t.email, t.phone, t.note, t.event, t.kind, t.created);
      return t.id;
    },
    hasTapped: async (from, to) => Boolean(await q.first("SELECT 1 AS x FROM taps WHERE from_login = ? AND to_owner = ? LIMIT 1", from, to)),
    inbox: (owner, since) => q.all("SELECT * FROM taps WHERE to_owner = ? AND created > ? ORDER BY created DESC LIMIT 500", owner, since),
    deleteTap: (owner, id) => q.run("DELETE FROM taps WHERE to_owner = ? AND id = ?", owner, id),

    getContacts: async (login) => parse(await q.first("SELECT data FROM contacts WHERE login = ?", login)),
    async putContacts(login, doc) {
      await q.run("INSERT INTO contacts (login, data, updated) VALUES (?, ?, ?) ON CONFLICT(login) DO UPDATE SET data = excluded.data, updated = excluded.updated", login, JSON.stringify(doc), doc.updated);
    },

    async hit(owner, card, day, via) {
      await q.run("INSERT INTO views (owner, card, day, via, n) VALUES (?, ?, ?, ?, 1) ON CONFLICT(card, day, via) DO UPDATE SET n = n + 1", owner, card, day, via);
    },
    async stats(owner, sinceTs) {
      const day = new Date(sinceTs * 1000).toISOString().slice(0, 10);
      const views = await q.all("SELECT card, day, via, n FROM views WHERE owner = ? AND day >= ? ORDER BY day", owner, day);
      const taps = await q.first("SELECT COUNT(*) AS n, SUM(kind = 'guest') AS guests FROM taps WHERE to_owner = ? AND created >= ?", owner, sinceTs);
      return { views, taps: Number(taps?.n || 0), guests: Number(taps?.guests || 0) };
    },

    // Fixed-window counter. Returns true while under `max` hits per `windowSec`.
    async rate(key, windowSec, max) {
      const t = now();
      const r = await q.first("SELECT n, reset FROM rates WHERE key = ?", key);
      if (!r || r.reset <= t) {
        await q.run("INSERT INTO rates (key, n, reset) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET n = 1, reset = excluded.reset", key, t + windowSec);
        if (Math.random() < 0.01) await q.run("DELETE FROM rates WHERE reset < ?", t);
        return true;
      }
      if (r.n >= max) return false;
      await q.run("UPDATE rates SET n = n + 1 WHERE key = ?", key);
      return true;
    }
  };
}
