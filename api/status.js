const U = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const T = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = async cmd => {
  const r = await fetch(U, { method: "POST", headers: { Authorization: "Bearer " + T }, body: JSON.stringify(cmd) });
  return (await r.json()).result;
};
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const code = String(req.query.code || "").toUpperCase().slice(0, 12);
  const v = code && (await redis(["HGET", "projects", code]));
  if (!v) return res.status(404).json({ error: "not found" });
  const { name, status, note, updated } = JSON.parse(v);
  res.status(200).json({ name, status, note, updated });
};
