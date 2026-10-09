const crypto = require("crypto");
const U = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const T = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = async cmd => {
  const r = await fetch(U, { method: "POST", headers: { Authorization: "Bearer " + T }, body: JSON.stringify(cmd) });
  return (await r.json()).result;
};
const STAGES = ["Requirement", "Design", "Development", "Testing", "Live"];
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const key = String(req.headers["x-admin-key"] || "");
  const real = process.env.ADMIN_KEY || "";
  const ok = real && key.length === real.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(real));
  if (req.method !== "POST" || !ok) return res.status(401).json({ error: "unauthorized" });

  const b = req.body || {};
  if (b.action === "list") {
    const a = (await redis(["HGETALL", "projects"])) || [];
    const out = [];
    for (let i = 0; i < a.length; i += 2) out.push({ code: a[i], ...JSON.parse(a[i + 1]) });
    out.sort((x, y) => y.updated - x.updated);
    return res.json(out);
  }
  if (b.action === "add") {
    const name = String(b.name || "").trim().slice(0, 100);
    if (!name) return res.status(400).json({ error: "name required" });
    const code = [...crypto.randomBytes(6)].map(n => CHARS[n % CHARS.length]).join("");
    await redis(["HSET", "projects", code, JSON.stringify({ name, status: STAGES[0], note: "", updated: Date.now() })]);
    return res.json({ code });
  }
  if (b.action === "update") {
    const v = await redis(["HGET", "projects", String(b.code)]);
    if (!v || !STAGES.includes(b.status)) return res.status(400).json({ error: "bad request" });
    const p = JSON.parse(v);
    p.status = b.status;
    p.note = String(b.note || "").slice(0, 255);
    p.updated = Date.now();
    await redis(["HSET", "projects", String(b.code), JSON.stringify(p)]);
    return res.json({ ok: true });
  }
  res.status(400).json({ error: "unknown action" });
};
