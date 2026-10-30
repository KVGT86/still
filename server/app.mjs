import express from "express";
import { DatabaseSync, backup } from "node:sqlite";
import { readFileSync } from "node:fs";
import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { blankState, mergeState } from "../shared/domain.mjs";
const version = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const opaque = () => randomBytes(32).toString("hex");
const pinHash = (pin, salt) => scryptSync(pin, salt, 32).toString("hex");
const publicProfile = (p) => ({
  id: p.id,
  name: p.name,
  avatar: p.avatar,
  locked: !!p.pin,
});
export function createApp({
  database = ":memory:",
  verifyAccount = async (authKey) => {
    const response = await fetch("https://api.strem.io/api/getUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authKey }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    if (data.error || !data.result?._id)
      throw new Error("Invalid Stremio session");
    return data.result._id;
  },
} = {}) {
  const db = new DatabaseSync(database);
  db.exec(
    "PRAGMA synchronous=FULL; PRAGMA max_page_count=65536; PRAGMA journal_size_limit=67108864;",
  );
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, account TEXT NOT NULL, name TEXT NOT NULL, avatar TEXT NOT NULL, pin TEXT, salt TEXT, state TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, account TEXT NOT NULL, expires INTEGER NOT NULL);",
  );
  const unlocks = new Map(),
    limits = new Map();
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Profile-Token",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Cache-Control": "no-store",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob: https: http:; media-src 'self' blob: https: http:; connect-src 'self' https: http:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: "4mb" }));
  app.use((req, res, next) => {
    if (
      req.method === "POST" &&
      (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
    )
      return res.status(400).json({ error: "A JSON object is required." });
    next();
  });
  app.get("/api/health", (_, res) => res.json({ ok: true, version }));
  function limited(key, max) {
    const now = Date.now();
    let bucket = limits.get(key);
    if (!bucket || bucket.until < now) {
      bucket = { count: 0, until: now + 60000 };
      limits.set(key, bucket);
    }
    if (limits.size > 10000)
      for (const [k, v] of limits) if (v.until < now) limits.delete(k);
    return ++bucket.count > max;
  }
  app.post("/api/session", async (req, res) => {
    if (limited(req.ip + ":session", 20))
      return res.status(429).json({ error: "Try again in a minute." });
    const authKey = req.body?.authKey;
    if (typeof authKey !== "string" || authKey.length > 512)
      return res.sendStatus(400);
    try {
      const account = await verifyAccount(authKey);
      const token = opaque();
      db.prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
      db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
        digest(token),
        account,
        Date.now() + 30 * 86400000,
      );
      res.json({ token });
    } catch {
      res.status(401).json({ error: "Stremio sign-in required." });
    }
  });
  app.use("/api", (req, res, next) => {
    const token = (req.get("Authorization") || "").replace(/^Bearer /, "");
    const tokenHash = digest(token);
    const session = db
      .prepare("SELECT * FROM sessions WHERE token=? AND expires>?")
      .get(tokenHash, Date.now());
    if (!session)
      return res
        .status(401)
        .json({ error: "Sign in again to reconnect the profile service." });
    req.account = session.account;
    req.sessionToken = tokenHash;
    next();
  });
  app.post("/api/session/revoke", (req, res) => {
    db.prepare("DELETE FROM sessions WHERE token=?").run(req.sessionToken);
    res.json({ ok: true });
  });
  const list = (account) =>
    db.prepare("SELECT * FROM profiles WHERE account=?").all(account);
  app.get("/api/profiles", (req, res) =>
    res.json(list(req.account).map(publicProfile)),
  );
  app.post("/api/profiles", (req, res) => {
    if (list(req.account).length >= 20)
      return res.status(400).json({ error: "Maximum 20 profiles." });
    const { name, avatar = "◒", pin = "", importState } = req.body;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 40 ||
      typeof avatar !== "string" ||
      avatar.length > 12 ||
      typeof pin !== "string" ||
      (pin && !/^\d{4,8}$/.test(pin))
    )
      return res
        .status(400)
        .json({ error: "Use a name and a 4–8 digit PIN, or leave PIN blank." });
    const state =
      list(req.account).length === 0 && validState(importState)
        ? mergeState(blankState(), importState)
        : blankState();
    const id = randomBytes(12).toString("hex"),
      salt = opaque();
    db.prepare("INSERT INTO profiles VALUES (?,?,?,?,?,?,?)").run(
      id,
      req.account,
      name.trim(),
      avatar,
      pin ? pinHash(pin, salt) : null,
      salt,
      JSON.stringify(state),
    );
    res.json({ id, name: name.trim(), avatar, locked: !!pin });
  });
  app.use("/api/profiles/:id", (req, res, next) => {
    const p = db
      .prepare("SELECT * FROM profiles WHERE id=? AND account=?")
      .get(req.params.id, req.account);
    if (!p) return res.sendStatus(404);
    req.profile = p;
    next();
  });
  app.post("/api/profiles/:id/unlock", (req, res) => {
    const p = req.profile;
    if (limited(p.id + ":unlock", 10))
      return res
        .status(429)
        .json({ error: "Too many attempts. Wait one minute." });
    if (
      p.pin &&
      (typeof req.body.pin !== "string" ||
        req.body.pin.length > 8 ||
        !timingSafeEqual(
          Buffer.from(p.pin, "hex"),
          Buffer.from(pinHash(req.body.pin, p.salt), "hex"),
        ))
    )
      return res.status(403).json({ error: "Incorrect PIN." });
    const token = opaque();
    const now = Date.now();
    for (const [k, v] of unlocks) if (v.expires < now) unlocks.delete(k);
    unlocks.set(digest(token), { id: p.id, expires: now + 86400000 });
    res.json({ token, state: JSON.parse(p.state) });
  });
  app.use("/api/profiles/:id", (req, res, next) => {
    const p = req.profile;
    const u = unlocks.get(digest(req.get("X-Profile-Token") || ""));
    if (p.pin && (!u || u.id !== p.id || u.expires < Date.now()))
      return res.status(403).json({ error: "Unlock this profile first." });
    next();
  });
  app.get("/api/profiles/:id/state", (req, res) =>
    res.json(JSON.parse(req.profile.state)),
  );
  app.post("/api/profiles/:id/state", (req, res) => {
    if (!validState(req.body))
      return res.status(400).json({ error: "Invalid profile state." });
    const state = mergeState(JSON.parse(req.profile.state), req.body);
    db.prepare("UPDATE profiles SET state=? WHERE id=?").run(
      JSON.stringify(state),
      req.profile.id,
    );
    res.json(state);
  });
  app.post("/api/profiles/:id/edit", (req, res) => {
    const { name, avatar, pin } = req.body;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 40 ||
      typeof avatar !== "string" ||
      avatar.length > 12 ||
      (pin !== undefined &&
        (typeof pin !== "string" || (pin && !/^\d{4,8}$/.test(pin))))
    )
      return res.sendStatus(400);
    const p = req.profile;
    const salt = opaque();
    db.prepare(
      "UPDATE profiles SET name=?,avatar=?,pin=?,salt=? WHERE id=?",
    ).run(
      name.trim(),
      avatar,
      pin === undefined ? p.pin : pin ? pinHash(pin, salt) : null,
      pin === undefined ? p.salt : salt,
      p.id,
    );
    for (const [k, v] of unlocks) if (v.id === p.id) unlocks.delete(k);
    res.json({ ok: true });
  });
  app.post("/api/profiles/:id/delete", (req, res) => {
    if (req.body.confirm !== true)
      return res.status(400).json({ error: "Confirmation required." });
    db.prepare("DELETE FROM profiles WHERE id=?").run(req.profile.id);
    for (const [k, v] of unlocks)
      if (v.id === req.profile.id) unlocks.delete(k);
    res.json({ ok: true });
  });
  app.use((error, req, res, next) => {
    res.status(error.status || 500).json({
      error:
        error.status === 413
          ? "Profile data is too large."
          : "Request could not be completed.",
    });
  });
  return { app, close: () => db.close(), backup: (file) => backup(db, file) };
}
function validState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  for (const field of ["saved", "progress", "feedback"]) {
    const map = state[field];
    if (
      !map ||
      typeof map !== "object" ||
      Array.isArray(map) ||
      Object.keys(map).length > 10000
    )
      return false;
    for (const [k, v] of Object.entries(map)) {
      if (
        ["__proto__", "constructor", "prototype"].includes(k) ||
        !v ||
        !Number.isFinite(v.updatedAt) ||
        v.updatedAt > Date.now() + 60000 ||
        !v.meta ||
        typeof v.meta.id !== "string" ||
        !["movie", "series"].includes(v.meta.type)
      )
        return false;
      if (
        field === "progress" &&
        (!Number.isFinite(v.position) ||
          !Number.isFinite(v.duration) ||
          v.position < 0 ||
          v.duration < 0)
      )
        return false;
    }
  }
  return (
    typeof state.settings === "object" &&
    state.settings !== null &&
    typeof state.settings.audio === "string" &&
    /^[a-z]{2,3}$/.test(state.settings.audio) &&
    typeof state.settings.subtitle === "string" &&
    /^[a-z]{2,3}$/.test(state.settings.subtitle) &&
    typeof state.settings.subtitles === "boolean" &&
    ["on", "off", "scheduled"].includes(state.settings.autoplay) &&
    Number.isFinite(state.settingsAt) &&
    state.settingsAt <= Date.now() + 60000
  );
}
