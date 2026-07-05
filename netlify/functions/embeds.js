// netlify/functions/embeds.js
// Public GET: returns { [matchKey]: [videoId, videoId, ...] } for everyone.
// Admin POST/DELETE: requires x-admin-key header matching ADMIN_SECRET env var.

const { getStore } = require("@netlify/blobs");

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return respond(200, {});
  }

  const store = getStore("embeds");

  if (event.httpMethod === "GET") {
    const data = (await store.get("data", { type: "json" })) || {};
    return respond(200, data);
  }

  const adminKey = event.headers["x-admin-key"];
  if (!process.env.ADMIN_SECRET || adminKey !== process.env.ADMIN_SECRET) {
    return respond(401, { error: "Unauthorized" });
  }

  const body = JSON.parse(event.body || "{}");
  const data = (await store.get("data", { type: "json" })) || {};

  if (event.httpMethod === "POST") {
    const { matchKey, embedUrl } = body;
    if (!matchKey || !embedUrl) return respond(400, { error: "matchKey and embedUrl required" });
    data[matchKey] = data[matchKey] || [];
    if (!data[matchKey].includes(embedUrl)) data[matchKey].push(embedUrl);
    await store.setJSON("data", data);
    return respond(200, data);
  }

  if (event.httpMethod === "DELETE") {
    const { matchKey, embedUrl } = body;
    if (!matchKey || !embedUrl) return respond(400, { error: "matchKey and embedUrl required" });
    if (data[matchKey]) {
      data[matchKey] = data[matchKey].filter((v) => v !== embedUrl);
      if (data[matchKey].length === 0) delete data[matchKey];
    }
    await store.setJSON("data", data);
    return respond(200, data);
  }

  return respond(405, { error: "Method not allowed" });
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-key",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}
