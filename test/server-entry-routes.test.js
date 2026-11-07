"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("the public root serves the entry page instead of Express 404", () => {
  assert.match(
    server,
    /app\.get\(\["\/", "\/index\.html"\],\s*\(req,\s*res\)\s*=>\s*\{[\s\S]*?res\.sendFile\(path\.join\(__dirname,\s*"index\.html"\)\)/,
    "root and /index.html must serve the entry page"
  );
  assert.match(index, /window\.location\.replace\(["']\/login\.html["']\)/);
});

test("health and login routes remain available", () => {
  assert.match(server, /app\.get\(["']\/health["']/);
  assert.match(server, /app\.get\(["']\/login\.html["']/);
});
