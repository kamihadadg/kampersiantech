"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const DB_PATH = path.join(DATA, "app.sqlite");

const DEFAULT_SETTINGS = {
  easy_mode_default: "0",
  tts_enabled: "1",
  allow_guest: "0",
  app_title: "همراه علوم",
  preferred_port: "8080"
};

let db;

function getSqlite() {
  try {
    return require("node:sqlite");
  } catch (e) {
    const err = new Error(
      "SQLite needs Node.js 22.5+. Current: " + process.version + " — download from https://nodejs.org"
    );
    err.code = "NO_SQLITE";
    throw err;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(password), salt, 32).toString("hex");
  return salt + ":" + hash;
}

function verifyPassword(password, stored) {
  if (!stored || stored.indexOf(":") === -1) return false;
  const parts = stored.split(":");
  const salt = parts[0];
  const hash = parts[1];
  const next = crypto.scryptSync(String(password), salt, 32).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(next, "hex"));
  } catch (e) {
    return false;
  }
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    display_name: row.display_name,
    parent_id: row.parent_id,
    active: row.active === 1 || row.active === true,
    created_at: row.created_at
  };
}

function open() {
  if (db) return db;
  fs.mkdirSync(DATA, { recursive: true });
  const { DatabaseSync } = getSqlite();
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('parent','child')),
      display_name TEXT NOT NULL DEFAULT '',
      parent_id INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(parent_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  const count = db.prepare("SELECT COUNT(*) AS c FROM settings").get().c;
  if (!count) {
    const ins = db.prepare("INSERT INTO settings(key, value) VALUES (?, ?)");
    Object.keys(DEFAULT_SETTINGS).forEach((k) => ins.run(k, DEFAULT_SETTINGS[k]));
  }
  return db;
}

function needsSetup() {
  open();
  const row = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'parent' AND active = 1").get();
  return !row || !row.c;
}

function createUser({ username, password, role, display_name, parent_id }) {
  open();
  const u = String(username || "").trim();
  const p = String(password || "");
  const r = role === "parent" ? "parent" : "child";
  if (!u || u.length < 2) throw new Error("نام کاربری کوتاه است");
  if (p.length < 4) throw new Error("رمز حداقل ۴ کاراکتر");
  if (r === "child" && !parent_id) throw new Error("فرزند باید به والد وصل باشد");
  try {
    const info = db
      .prepare(
        "INSERT INTO users(username, password_hash, role, display_name, parent_id) VALUES (?, ?, ?, ?, ?)"
      )
      .run(u, hashPassword(p), r, String(display_name || u), parent_id || null);
    return getUserById(Number(info.lastInsertRowid));
  } catch (e) {
    if (String(e && e.message).includes("UNIQUE")) throw new Error("این نام کاربری تکراری است");
    throw e;
  }
}

function setupFirstParent({ username, password, display_name }) {
  open();
  if (!needsSetup()) throw new Error("راه‌اندازی قبلاً انجام شده");
  return createUser({
    username: username || "والد",
    password,
    role: "parent",
    display_name: display_name || "والد"
  });
}

function getUserById(id) {
  open();
  return publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
}

function getUserByUsername(username) {
  open();
  return db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(String(username || "").trim());
}

function listUsers(forParentId) {
  open();
  if (forParentId) {
    return db
      .prepare(
        "SELECT * FROM users WHERE id = ? OR parent_id = ? ORDER BY role DESC, id ASC"
      )
      .all(forParentId, forParentId)
      .map(publicUser);
  }
  return db.prepare("SELECT * FROM users ORDER BY role DESC, id ASC").all().map(publicUser);
}

function updateUser(id, patch, actor) {
  open();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!row) throw new Error("کاربر پیدا نشد");
  if (actor.role !== "parent") throw new Error("اجازه ندارید");
  if (row.role === "child" && row.parent_id !== actor.id && row.id !== actor.id) {
    throw new Error("این فرزند مال شما نیست");
  }
  if (row.role === "parent" && row.id !== actor.id) {
    throw new Error("فقط حساب خودتان را ویرایش کنید");
  }

  const display_name =
    patch.display_name != null ? String(patch.display_name) : row.display_name;
  const active = patch.active == null ? row.active : patch.active ? 1 : 0;
  let password_hash = row.password_hash;
  if (patch.password) {
    if (String(patch.password).length < 4) throw new Error("رمز حداقل ۴ کاراکتر");
    password_hash = hashPassword(patch.password);
  }
  db.prepare("UPDATE users SET display_name = ?, active = ?, password_hash = ? WHERE id = ?").run(
    display_name,
    active,
    password_hash,
    id
  );
  return getUserById(id);
}

function authenticate(username, password) {
  open();
  const row = getUserByUsername(username);
  if (!row || !row.active) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return publicUser(row);
}

function createSession(userId, days) {
  open();
  const token = crypto.randomBytes(24).toString("hex");
  const hours = (Number(days) || 14) * 24;
  db.prepare(
    "INSERT INTO sessions(token, user_id, expires_at) VALUES (?, ?, datetime('now', ?))"
  ).run(token, userId, "+" + hours + " hours");
  return token;
}

function destroySession(token) {
  open();
  if (!token) return;
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

function userFromToken(token) {
  open();
  if (!token) return null;
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at >= datetime('now') AND u.active = 1`
    )
    .get(token);
  return publicUser(row);
}

function getSettings() {
  open();
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const out = Object.assign({}, DEFAULT_SETTINGS);
  rows.forEach((r) => {
    out[r.key] = r.value;
  });
  return out;
}

function setSettings(patch) {
  open();
  const upsert = db.prepare(
    "INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  Object.keys(patch || {}).forEach((key) => {
    const k = String(key).trim();
    if (!k) return;
    upsert.run(k, String(patch[key]));
  });
  return getSettings();
}

function dbPath() {
  return DB_PATH;
}

module.exports = {
  open,
  needsSetup,
  setupFirstParent,
  createUser,
  getUserById,
  listUsers,
  updateUser,
  authenticate,
  createSession,
  destroySession,
  userFromToken,
  getSettings,
  setSettings,
  dbPath,
  DEFAULT_SETTINGS
};
