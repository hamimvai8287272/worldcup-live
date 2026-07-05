// netlify/functions/heartbeat.js
// Every visitor pings this endpoint every ~15s with a random session id.
// We keep a shared map of {sessionId: lastSeenTimestamp} in Netlify Blobs
// so the "N watching" count is real and shared across all visitors,
// not just per-browser.

const { getStore } = require("@netlify/blobs");

function viewersStore() {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: "viewers", siteID, token });
  }
  return getStore("viewers");
}

const ACTIVE_WINDOW_MS = 30 * 1000; // consider "active" if seen in last 30s

exports.handler = async function (event) {
  try {
    const store = viewersStore();
    const sessionId =
      (event.queryStringParameters && event.queryStringParameters.sid) ||
      Math.random().toString(36).slice(2);

    const sessions = (await store.get("sessions", { type: "json" })) || {};
    const now = Date.now();

    sessions[sessionId] = now;

    for (const key of Object.keys(sessions)) {
      if (now - sessions[key] > ACTIVE_WINDOW_MS) {
        delete sessions[key];
      }
    }

    await store.setJSON("sessions", sessions);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        sessionId,
        count: Object.keys(sessions).length,
      }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "local", count: 1 }),
    };
  }
};
