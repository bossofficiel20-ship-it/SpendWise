var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
__name(errorResponse, "errorResponse");
function validateTransaction(body) {
  if (!body || typeof body !== "object") return "Invalid request body.";
  const { type, amount, category, note, date } = body;
  if (type !== "income" && type !== "expense") return 'type must be "income" or "expense".';
  const num = Number(amount);
  if (isNaN(num) || num <= 0) return "amount must be a positive number.";
  const cleanAmount = Math.round(num * 100) / 100;
  if (typeof category !== "string" || !/^[a-z0-9_]{1,30}$/.test(category)) {
    return "category must be lowercase alphanumeric (max 30 chars).";
  }
  const cleanNote = typeof note === "string" ? note.replace(/[<>]/g, "").trim().slice(0, 80) : "";
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return "date must be YYYY-MM-DD format.";
  }
  return { type, amount: cleanAmount, category, note: cleanNote, date };
}
__name(validateTransaction, "validateTransaction");
async function listTransactions(db, params, userId) {
  let sql = "SELECT * FROM transactions";
  const conditions = ["user_id = ?"];
  const binds = [userId];
  const type = params.get("type");
  const category = params.get("category");
  const search = params.get("search");
  const year = params.get("year");
  const month = params.get("month");
  if (type && (type === "income" || type === "expense")) {
    conditions.push("type = ?");
    binds.push(type);
  }
  if (category && /^[a-z0-9_]{1,30}$/.test(category)) {
    conditions.push("category = ?");
    binds.push(category);
  }
  if (year && /^\d{4}$/.test(year) && month && /^\d{1,2}$/.test(month)) {
    const m = month.padStart(2, "0");
    conditions.push("date LIKE ? || '-' || ?");
    binds.push(year, m);
  }
  if (search && typeof search === "string") {
    conditions.push("(note LIKE ? OR category LIKE ?)");
    const pattern = "%" + search.slice(0, 80) + "%";
    binds.push(pattern, pattern);
  }
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY date DESC, created_at DESC";
  const stmt = binds.length > 0 ? db.prepare(sql).bind(...binds) : db.prepare(sql);
  const { results } = await stmt.all();
  return jsonResponse({ transactions: results });
}
__name(listTransactions, "listTransactions");
async function createTransaction(db, body, userId) {
  const clean = validateTransaction(body);
  if (typeof clean === "string") return errorResponse(clean);
  const id = "txn_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const stmt = db.prepare(
    `INSERT INTO transactions (id, user_id, type, amount, category, note, date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, userId, clean.type, clean.amount, clean.category, clean.note, clean.date);
  await stmt.run();
  return jsonResponse({ id, ...clean }, 201);
}
__name(createTransaction, "createTransaction");
async function updateTransaction(db, id, body, userId) {
  if (!id || typeof id !== "string") return errorResponse("Invalid transaction id.", 400);
  const clean = validateTransaction(body);
  if (typeof clean === "string") return errorResponse(clean);
  const stmt = db.prepare(
    `UPDATE transactions
         SET type = ?, amount = ?, category = ?, note = ?, date = ?, updated_at = datetime('now')
         WHERE id = ? AND user_id = ?`
  ).bind(clean.type, clean.amount, clean.category, clean.note, clean.date, id, userId);
  const result = await stmt.run();
  if (result.meta.changes === 0) return errorResponse("Transaction not found.", 404);
  return jsonResponse({ id, ...clean });
}
__name(updateTransaction, "updateTransaction");
async function deleteTransaction(db, id, userId) {
  if (!id || typeof id !== "string") return errorResponse("Invalid transaction id.", 400);
  const stmt = db.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?").bind(id, userId);
  const result = await stmt.run();
  if (result.meta.changes === 0) return errorResponse("Transaction not found.", 404);
  return jsonResponse({ deleted: true });
}
__name(deleteTransaction, "deleteTransaction");
async function bulkImport(db, body, userId) {
  if (!body || !Array.isArray(body.transactions)) {
    return errorResponse("Body must contain a transactions array.");
  }
  const list = body.transactions;
  if (list.length === 0) return jsonResponse({ imported: 0 });
  const MAX_BULK = 500;
  if (list.length > MAX_BULK) return errorResponse(`Max ${MAX_BULK} transactions per import.`, 400);
  const stmts = [];
  for (const t of list) {
    const clean = validateTransaction(t);
    if (typeof clean === "string") continue;
    const id = typeof t.id === "string" && t.id ? t.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) : "txn_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    stmts.push(
      db.prepare(
        `INSERT OR REPLACE INTO transactions (id, user_id, type, amount, category, note, date)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, userId, clean.type, clean.amount, clean.category, clean.note, clean.date)
    );
  }
  if (stmts.length > 0) await db.batch(stmts);
  return jsonResponse({ imported: stmts.length });
}
__name(bulkImport, "bulkImport");
async function exportAll(db, userId) {
  const { results } = await db.prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC").bind(userId).all();
  return jsonResponse({
    app: "expense-tracker",
    version: 1,
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    transactions: results
  });
}
__name(exportAll, "exportAll");
async function createSession(db, userId) { const token = randomHex(32); const tokenHash = await sha256Hex(token); await db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))").bind(tokenHash, userId).run(); return token; }
async function getAuthUser(request, db) { const header = request.headers.get("Authorization") || ""; if (!header.startsWith("Bearer ")) return null; const token = header.slice(7).trim(); if (!token) return null; const tokenHash = await sha256Hex(token); return await db.prepare("SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > datetime('now')").bind(tokenHash).first(); }
async function registerUser(db, body) { const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""; const password = typeof body?.password === "string" ? body.password : ""; if (!isValidEmail(email)) return errorResponse("Please enter a valid email.", 400); if (password.length < 8 || password.length > 128) return errorResponse("Password must be 8-128 characters.", 400); const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first(); if (existing) return errorResponse("Email is already registered.", 409); const userId = "usr_" + randomHex(16); const salt = randomHex(16); const passwordHash = await hashPassword(password, salt); await db.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)").bind(userId, email, salt + ":" + passwordHash).run(); const token = await createSession(db, userId); return jsonResponse({ user: { id: userId, email }, token }, 201); }
async function loginUser(db, body) { const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""; const password = typeof body?.password === "string" ? body.password : ""; const user = await db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").bind(email).first(); if (!user) return errorResponse("Invalid email or password.", 401); const parts = user.password_hash.split(":"); if (parts.length !== 2) return errorResponse("Invalid email or password.", 401); const passwordHash = await hashPassword(password, parts[0]); if (passwordHash !== parts[1]) return errorResponse("Invalid email or password.", 401); const token = await createSession(db, user.id); return jsonResponse({ user: { id: user.id, email: user.email }, token }); }
async function logoutUser(request, db) { const header = request.headers.get("Authorization") || ""; if (header.startsWith("Bearer ")) { const token = header.slice(7).trim(); if (token) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run(); } return jsonResponse({ loggedOut: true }); }
var worker_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const authUser = await getAuthUser(request, env.DB);
    try {
      if (path === "/api/health" && method === "GET") {
        return jsonResponse({ status: "ok", db: !!env.DB });
      }
      if (path === "/api/auth/register" && method === "POST") { const body = await request.json().catch(() => null); return await registerUser(env.DB, body); }
      if (path === "/api/auth/login" && method === "POST") { const body = await request.json().catch(() => null); return await loginUser(env.DB, body); }
      if (path === "/api/auth/me" && method === "GET") { if (!authUser) return errorResponse("Authentication required.", 401); return jsonResponse({ user: { id: authUser.id, email: authUser.email } }); }
      if (path === "/api/auth/logout" && method === "POST") { return await logoutUser(request, env.DB); }
      if (path === "/api/transactions" && method === "GET") {
        if (!authUser) return errorResponse("Authentication required.", 401);
        return await listTransactions(env.DB, url.searchParams, authUser.id);
      }
      if (path === "/api/transactions" && method === "POST") {
        if (!authUser) return errorResponse("Authentication required.", 401);
        const body = await request.json().catch(() => null);
        return await createTransaction(env.DB, body, authUser.id);
      }
      const updateMatch = path.match(/^\/api\/transactions\/([a-zA-Z0-9_-]+)$/);
      if (updateMatch && method === "PUT") {
        if (!authUser) return errorResponse("Authentication required.", 401);
        const body = await request.json().catch(() => null);
        return await updateTransaction(env.DB, updateMatch[1], body, authUser.id);
      }
      if (updateMatch && method === "DELETE") {
        if (!authUser) return errorResponse("Authentication required.", 401);
        return await deleteTransaction(env.DB, updateMatch[1], authUser.id);
      }
      if (path === "/api/transactions/bulk" && method === "POST") {
        if (!authUser) return errorResponse("Authentication required.", 401);
        const body = await request.json().catch(() => null);
        return await bulkImport(env.DB, body, authUser.id);
      }
      if (path === "/api/export" && method === "GET") {
        if (!authUser) return errorResponse("Authentication required.", 401);
        return await exportAll(env.DB, authUser.id);
      }
      return errorResponse("Not found.", 404);
    } catch (err) {
      console.error("Worker error:", err);
      return errorResponse("Internal server error.", 500);
    }
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(length = 32) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, saltHex) {
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(x => parseInt(x, 16)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    key,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
