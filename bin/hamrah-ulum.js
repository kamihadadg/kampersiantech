#!/usr/bin/env node
"use strict";

const { start } = require("../lib/server");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1 || !process.argv[i + 1]) return fallback;
  return process.argv[i + 1];
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
Hamrah Ulum (همراه علوم) — home learning server

Usage:
  npx hamrah-ulum
  hamrah-ulum
  npm start

Options:
  --port 8080          Preferred port (auto-picks next if busy)
  --host 0.0.0.0       Bind address (default all interfaces)
  --no-open            Do not open browser

Users/settings: data/app.sqlite
Lesson content: data/shared-adds.json (+ guide.js files)
`);
  process.exit(0);
}

start({
  port: arg("--port", process.env.PORT || undefined),
  host: arg("--host", "0.0.0.0"),
  open: !process.argv.includes("--no-open")
});
