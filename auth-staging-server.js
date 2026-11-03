const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const FIREBASE_AUTH_ORIGIN = "https://tareeq-al-layl.firebaseapp.com";

// Forward Firebase's hosted auth helper endpoints while keeping the browser
// on this staging origin. Do not forward ordinary Mersalo API requests here.
app.use("/__/auth", async (req, res) => {
  try {
    const target = new URL(req.originalUrl, FIREBASE_AUTH_ORIGIN);
    const headers = { ...req.headers, host: target.host };
    delete headers["accept-encoding"];
    delete headers["content-length"];

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : body,
      redirect: "manual"
    });

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (!["transfer-encoding", "content-encoding", "content-length", "connection"].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    const cookies = upstream.headers.getSetCookie?.() || [];
    if (cookies.length) res.setHeader("set-cookie", cookies.map(cookie =>
      cookie.replace(/;\\s*Domain=[^;]*/ig, "")
    ));
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    res.send(responseBody);
  } catch (error) {
    console.error("Firebase auth proxy error:", error.message);
    res.status(502).type("text/plain").send("Firebase authentication proxy unavailable");
  }
});

app.use(express.static(__dirname, { index: "index.html", fallthrough: true }));
app.get("/health", (_req, res) => res.json({ success: true, status: "auth-staging-ok" }));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, "0.0.0.0", () => console.log("Mersalo auth staging listening on", PORT));
