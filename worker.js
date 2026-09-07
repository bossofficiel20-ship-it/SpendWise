var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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
async function listTransactions(db, params) {
  let sql = "SELECT * FROM transactions";
  const conditions = [];
  const binds = [];
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
async function createTransaction(db, body) {
  const clean = validateTransaction(body);
  if (typeof clean === "string") return errorResponse(clean);
  const id = "txn_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const stmt = db.prepare(
    `INSERT INTO transactions (id, type, amount, category, note, date)
         VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, clean.type, clean.amount, clean.category, clean.note, clean.date);
  await stmt.run();
  return jsonResponse({ id, ...clean }, 201);
}
__name(createTransaction, "createTransaction");
async function updateTransaction(db, id, body) {
  if (!id || typeof id !== "string") return errorResponse("Invalid transaction id.", 400);
  const clean = validateTransaction(body);
  if (typeof clean === "string") return errorResponse(clean);
  const stmt = db.prepare(
    `UPDATE transactions
         SET type = ?, amount = ?, category = ?, note = ?, date = ?, updated_at = datetime('now')
         WHERE id = ?`
  ).bind(clean.type, clean.amount, clean.category, clean.note, clean.date, id);
  const result = await stmt.run();
  if (result.meta.changes === 0) return errorResponse("Transaction not found.", 404);
  return jsonResponse({ id, ...clean });
}
__name(updateTransaction, "updateTransaction");
async function deleteTransaction(db, id) {
  if (!id || typeof id !== "string") return errorResponse("Invalid transaction id.", 400);
  const stmt = db.prepare("DELETE FROM transactions WHERE id = ?").bind(id);
  const result = await stmt.run();
  if (result.meta.changes === 0) return errorResponse("Transaction not found.", 404);
  return jsonResponse({ deleted: true });
}
__name(deleteTransaction, "deleteTransaction");
async function bulkImport(db, body) {
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
        `INSERT OR REPLACE INTO transactions (id, type, amount, category, note, date)
                 VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(id, clean.type, clean.amount, clean.category, clean.note, clean.date)
    );
  }
  if (stmts.length > 0) await db.batch(stmts);
  return jsonResponse({ imported: stmts.length });
}
__name(bulkImport, "bulkImport");
async function exportAll(db) {
  const { results } = await db.prepare("SELECT * FROM transactions ORDER BY date DESC, created_at DESC").all();
  return jsonResponse({
    app: "expense-tracker",
    version: 1,
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    transactions: results
  });
}
__name(exportAll, "exportAll");
var worker_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    try {
      if (path === "/api/health" && method === "GET") {
        return jsonResponse({ status: "ok", db: !!env.DB });
      }
      if (path === "/api/transactions" && method === "GET") {
        return await listTransactions(env.DB, url.searchParams);
      }
      if (path === "/api/transactions" && method === "POST") {
        const body = await request.json().catch(() => null);
        return await createTransaction(env.DB, body);
      }
      const updateMatch = path.match(/^\/api\/transactions\/([a-zA-Z0-9_-]+)$/);
      if (updateMatch && method === "PUT") {
        const body = await request.json().catch(() => null);
        return await updateTransaction(env.DB, updateMatch[1], body);
      }
      if (updateMatch && method === "DELETE") {
        return await deleteTransaction(env.DB, updateMatch[1]);
      }
      if (path === "/api/transactions/bulk" && method === "POST") {
        const body = await request.json().catch(() => null);
        return await bulkImport(env.DB, body);
      }
      if (path === "/api/export" && method === "GET") {
        return await exportAll(env.DB);
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
