// Accounts and logins. Passwords are hashed with scrypt (built into Node), logins are random tokens in an
// httpOnly cookie; only a SHA-256 of the token is stored, so a database copy can't be used to log in.
import crypto from "node:crypto";
import { col, adoptLegacyProgress, deleteUserData, saveSettings } from "./db.js";
import { dayKey } from "./srs.js";

export const COOKIE = "gv_session";
const SESSION_DAYS = 90;
const USERNAME = /^[a-z0-9][a-z0-9._-]{1,31}$/;

/* ---------- passwords ---------- */
const scrypt = (pw, salt) => new Promise((ok, no) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? no(e) : ok(k)));

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${(await scrypt(pw, salt)).toString("base64")}`;
}
async function verifyPassword(pw, stored) {
  const [kind, salt, hash] = String(stored || "").split("$");
  if (kind !== "scrypt") return false;
  const want = Buffer.from(hash, "base64"), got = await scrypt(pw, Buffer.from(salt, "base64"));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export function checkNewAccount({ username, password, name }) {
  const u = String(username || "").trim().toLowerCase();
  if (!USERNAME.test(u)) return { error: "Username: 2-32 characters, lowercase letters, numbers, dot, dash or underscore." };
  if (String(password || "").length < 8) return { error: "Password must be at least 8 characters." };
  return { u, name: String(name || "").trim().slice(0, 60) || u };
}

/* ---------- users ---------- */
const publicUser = (d) => d && { id: d._id, name: d.name, admin: !!d.admin, created: d.created };

export async function countUsers() { return (await col("users")).countDocuments({}); }

export async function listUsers() {
  return (await (await col("users")).find({}).toArray()).map(publicUser).sort((a, b) => a.created.localeCompare(b.created));
}

// One account at a time, so two people opening the setup screen at once can't both become "the first" user.
let queue = Promise.resolve();
export function createUser(input) {
  const run = queue.then(() => createUserNow(input));
  queue = run.catch(() => {});
  return run;
}
async function createUserNow({ username, password, name, admin = false }) {
  const v = checkNewAccount({ username, password, name });
  if (v.error) throw new Error(v.error);
  const users = await col("users");
  if (await users.findOne({ _id: v.u })) throw new Error("That username is taken.");
  const first = (await users.countDocuments({})) === 0;
  const doc = { _id: v.u, name: v.name, admin: first || !!admin, hash: await hashPassword(password), created: new Date().toISOString() };
  await users.insertOne(doc);
  // The very first account inherits the progress from before accounts existed. Others start fresh this week.
  if (first) await adoptLegacyProgress(v.u);
  else await saveSettings(v.u, { startDate: dayKey() });
  return publicUser(doc);
}

export async function updateUser(id, { password, admin, name }) {
  const users = await col("users");
  const cur = await users.findOne({ _id: id });
  if (!cur) throw new Error("No such user.");
  const set = {};
  if (password !== undefined) {
    if (String(password).length < 8) throw new Error("Password must be at least 8 characters.");
    set.hash = await hashPassword(password);
  }
  if (admin !== undefined) {
    if (!admin && cur.admin && (await users.countDocuments({ admin: true })) <= 1) throw new Error("Keep at least one admin.");
    set.admin = !!admin;
  }
  if (name !== undefined) set.name = String(name).trim().slice(0, 60) || id;
  await users.updateOne({ _id: id }, { $set: set });
  if (set.hash) await (await col("sessions")).deleteMany({ u: id }); // new password logs out other devices
  return publicUser({ ...cur, ...set });
}

export async function deleteUser(id) {
  const users = await col("users");
  const cur = await users.findOne({ _id: id });
  if (!cur) throw new Error("No such user.");
  if (cur.admin && (await users.countDocuments({ admin: true })) <= 1) throw new Error("Keep at least one admin.");
  await deleteUserData(id);
  await users.deleteOne({ _id: id });
}

/* ---------- login throttle: 5 wrong passwords per username or address, then a 15 minute pause ---------- */
const fails = (globalThis.__gvFails = globalThis.__gvFails || new Map());
const WINDOW = 15 * 60 * 1000;
function blocked(keys) {
  const now = Date.now();
  return keys.some(k => { const f = fails.get(k); return f && now - f.at < WINDOW && f.n >= 5; });
}
function noteFail(keys) {
  const now = Date.now();
  for (const k of keys) { const f = fails.get(k); fails.set(k, f && now - f.at < WINDOW ? { n: f.n + 1, at: f.at } : { n: 1, at: now }); }
}

export async function login(username, password, ip) {
  const u = String(username || "").trim().toLowerCase(), keys = ["u:" + u, "ip:" + ip];
  if (blocked(keys)) throw new Error("Too many wrong passwords. Try again in 15 minutes.");
  const doc = await (await col("users")).findOne({ _id: u });
  // Hash even for unknown names so the response time doesn't reveal which usernames exist
  const ok = await verifyPassword(String(password || ""), doc?.hash || "scrypt$AAAA$AAAA");
  if (!doc || !ok) { noteFail(keys); throw new Error("Wrong username or password."); }
  keys.forEach(k => fails.delete(k));
  return publicUser(doc);
}

export async function changeOwnPassword(id, current, next) {
  const doc = await (await col("users")).findOne({ _id: id });
  if (!doc || !(await verifyPassword(String(current || ""), doc.hash))) throw new Error("Current password is wrong.");
  return updateUser(id, { password: next });
}

/* ---------- sessions ---------- */
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");

export async function startSession(u) {
  const token = crypto.randomBytes(32).toString("base64url");
  await (await col("sessions")).insertOne({ _id: sha(token), u, exp: new Date(Date.now() + SESSION_DAYS * 86400000) });
  return token;
}
export async function endSession(token) { if (token) await (await col("sessions")).deleteOne({ _id: sha(token) }); }

export async function userFromToken(token) {
  if (!token) return null;
  const s = await (await col("sessions")).findOne({ _id: sha(token) });
  if (!s || new Date(s.exp) < new Date()) return null;
  return publicUser(await (await col("users")).findOne({ _id: s.u }));
}

/* ---------- app-wide config (admin only) ---------- */
export async function getConfig() {
  return { signup: false, ...((await (await col("meta")).findOne({ _id: "config" }))?.value || {}) };
}
export async function setConfig(patch) {
  const value = { ...(await getConfig()), signup: !!patch.signup };
  await (await col("meta")).updateOne({ _id: "config" }, { $set: { value } }, { upsert: true });
  return value;
}
