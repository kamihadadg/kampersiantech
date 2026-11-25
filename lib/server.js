"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { URL } = require("url");
const db = require("./db");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");
const CFG = path.join(ROOT, "agent-proxy.json");
const ADDS_JSON = path.join(DATA, "shared-adds.json");
const ADDS_JS = path.join(ROOT, "assets", "shared-adds.js");
const SESSION_COOKIE = "hamrah_session";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".bat": "text/plain; charset=utf-8"
};

function lanIps() {
  const ips = [];
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach((name) => {
    (ifaces[name] || []).forEach((info) => {
      if (info.family === "IPv4" && !info.internal && ips.indexOf(info.address) === -1) {
        ips.push(info.address);
      }
    });
  });
  return ips.length ? ips : ["127.0.0.1"];
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function loadProxy() {
  return Object.assign(
    { target: "http://127.0.0.1:20128/v1", apiKey: "" },
    readJson(CFG, {})
  );
}

function loadAdds() {
  return readJson(ADDS_JSON, {});
}

function writeAdds(data) {
  writeJson(ADDS_JSON, data);
  fs.mkdirSync(path.dirname(ADDS_JS), { recursive: true });
  fs.writeFileSync(ADDS_JS, "window.PACK_ADDS = " + JSON.stringify(data) + ";\n", "utf8");
}

function ensureAdds() {
  if (!fs.existsSync(ADDS_JSON)) writeAdds({});
  if (!fs.existsSync(ADDS_JS)) writeAdds(loadAdds());
}

function send(res, code, body, type, extraHeaders) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8");
  const headers = Object.assign(
    {
      "Content-Type": type || "text/plain; charset=utf-8",
      "Content-Length": buf.length,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
      "Cache-Control": "no-store"
    },
    extraHeaders || {}
  );
  res.writeHead(code, headers);
  res.end(buf);
}

function sendJson(res, code, obj, extraHeaders) {
  send(res, code, JSON.stringify(obj), "application/json; charset=utf-8", extraHeaders);
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || "";
  raw.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v || "");
  });
  return out;
}

function sessionToken(req) {
  const cookies = parseCookies(req);
  if (cookies[SESSION_COOKIE]) return cookies[SESSION_COOKIE];
  const auth = req.headers.authorization || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}

function currentUser(req) {
  return db.userFromToken(sessionToken(req));
}

function sessionCookieHeader(token, clear) {
  if (clear) {
    return SESSION_COOKIE + "=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
  }
  return (
    SESSION_COOKIE +
    "=" +
    encodeURIComponent(token) +
    "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" +
    14 * 24 * 3600
  );
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) {
    sendJson(res, 401, { error: "login_required" });
    return null;
  }
  return user;
}

function requireParent(req, res) {
  const user = requireUser(req, res);
  if (!user) return null;
  if (user.role !== "parent") {
    sendJson(res, 403, { error: "parent_only" });
    return null;
  }
  return user;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  let rel = decoded.replace(/^\/+/, "");
  if (!rel || rel.endsWith("/")) rel = path.join(rel, "index.html");
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(root)) return null;
  return full;
}

function proxyAgent(req, res, pathname) {
  const cfg = loadProxy();
  const target = String(cfg.target || "").replace(/\/$/, "");
  if (!target) return sendJson(res, 500, { error: { message: "Agent target missing" } });

  let suffix = pathname;
  if (pathname.startsWith("/agent-proxy/")) suffix = pathname.slice("/agent-proxy/".length);
  else if (pathname.startsWith("/v1/")) suffix = pathname.slice("/v1/".length);
  if (target.endsWith("/v1") && suffix.startsWith("v1/")) suffix = suffix.slice(3);

  const method = (req.method || "GET").toUpperCase();
  const url = new URL(target + "/" + suffix.replace(/^\//, ""));

  const run = function (body) {
    // اگر کلاینت کلید ساختگی (مثل lm-studio) بفرستد، کلید سرور را استفاده کن
    const incomingAuth = String(req.headers.authorization || "");
    const incomingKey = incomingAuth.replace(/^Bearer\s+/i, "").trim();
    const placeholder = !incomingKey || /^(lm-studio|no-key|EMPTY|undefined|null)$/i.test(incomingKey);
    let authHeader = "";
    if (!placeholder) authHeader = incomingAuth;
    else if (cfg.apiKey) authHeader = "Bearer " + cfg.apiKey;

    let outBody = body;
    // chat را غیر استریم کن تا مرورگر روی SSE گیر نکند
    if (method === "POST" && /chat\/completions\/?$/.test(url.pathname) && body && body.length) {
      try {
        const parsed = JSON.parse(body.toString("utf8"));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          parsed.stream = false;
          outBody = Buffer.from(JSON.stringify(parsed), "utf8");
        }
      } catch (e) {}
    }

    const headers = {};
    if (method !== "GET" && method !== "HEAD") headers["Content-Type"] = "application/json";
    if (authHeader) headers.Authorization = authHeader;
    if (outBody && outBody.length) headers["Content-Length"] = outBody.length;

    const lib = url.protocol === "https:" ? https : http;
    let settled = false;
    const fail = (code, message) => {
      if (settled || res.headersSent) return;
      settled = true;
      sendJson(res, code, { error: { message: message } });
    };
    const preq = lib.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: headers
      },
      (pres) => {
        const chunks = [];
        pres.on("data", (c) => chunks.push(c));
        pres.on("end", () => {
          if (settled || res.headersSent) return;
          settled = true;
          const data = Buffer.concat(chunks);
          res.writeHead(pres.statusCode || 502, {
            "Content-Type": "application/json; charset=utf-8",
            "Content-Length": data.length,
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store"
          });
          res.end(data);
        });
        pres.on("error", (err) => fail(502, "Agent response error: " + err.message));
      }
    );
    preq.on("error", (err) => fail(502, "Agent unreachable: " + err.message));
    preq.setTimeout(300000, () => {
      preq.destroy();
      fail(504, "Agent timeout (300s)");
    });
    if (outBody && outBody.length) preq.end(outBody);
    else preq.end();
  };

  if (method === "GET" || method === "HEAD") return Promise.resolve(run(null));
  return readBody(req).then(run);
}

function livePort(res) {
  try {
    const addr = res.socket && res.socket.server && res.socket.server.address();
    if (addr && addr.port) return addr.port;
  } catch (e) {}
  return 8080;
}

function openWindowsFirewall(port) {
  if (process.platform !== "win32") return false;
  const { execSync } = require("child_process");
  try {
    execSync('netsh advfirewall firewall delete rule name="HamrahUlumHome"', { stdio: "ignore" });
  } catch (e) {}
  try {
    execSync(
      'netsh advfirewall firewall add rule name="HamrahUlumHome" dir=in action=allow protocol=TCP localport=' +
        Number(port),
      { stdio: "ignore" }
    );
    return true;
  } catch (e) {
    return false;
  }
}

function portCandidates(preferred) {
  const base = Number(preferred) || 8080;
  const list = [base];
  for (let i = 1; i <= 20; i++) list.push(base + i);
  [3000, 5173, 9000, 8888].forEach((p) => {
    if (list.indexOf(p) === -1) list.push(p);
  });
  return list;
}

function createServer() {
  ensureAdds();
  try {
    db.open();
  } catch (e) {
    console.error(e.message || e);
  }
  return http.createServer(async (req, res) => {
    const method = req.method || "GET";
    const u = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = u.pathname;

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true"
      });
      return res.end();
    }

    try {
      if (pathname === "/api/info" || pathname === "/info") {
        const port = livePort(res);
        const ips = lanIps();
        const settings = db.getSettings();
        const me = currentUser(req);
        return sendJson(res, 200, {
          name: settings.app_title || "همراه علوم",
          port,
          ips,
          kids: ips.map((ip) => "http://" + ip + ":" + port + "/"),
          assistant: ips.map((ip) => "http://" + ip + ":" + port + "/dastyar.html"),
          local: "http://127.0.0.1:" + port + "/",
          setupNeeded: db.needsSetup(),
          me,
          db: "sqlite+json",
          sqlite: path.basename(db.dbPath()),
          content: "data/shared-adds.json"
        });
      }

      if (pathname === "/api/auth/status" && method === "GET") {
        return sendJson(res, 200, {
          setupNeeded: db.needsSetup(),
          me: currentUser(req),
          settings: db.getSettings()
        });
      }

      if (pathname === "/api/auth/setup" && method === "POST") {
        const raw = await readBody(req);
        const data = JSON.parse(raw.toString("utf8") || "{}");
        const user = db.setupFirstParent(data);
        const token = db.createSession(user.id);
        return sendJson(res, 200, { ok: true, user }, { "Set-Cookie": sessionCookieHeader(token) });
      }

      if (pathname === "/api/auth/login" && method === "POST") {
        const raw = await readBody(req);
        const data = JSON.parse(raw.toString("utf8") || "{}");
        const user = db.authenticate(data.username, data.password);
        if (!user) return sendJson(res, 401, { error: "bad_credentials" });
        const token = db.createSession(user.id);
        return sendJson(res, 200, { ok: true, user }, { "Set-Cookie": sessionCookieHeader(token) });
      }

      if (pathname === "/api/auth/logout" && method === "POST") {
        db.destroySession(sessionToken(req));
        return sendJson(res, 200, { ok: true }, { "Set-Cookie": sessionCookieHeader("", true) });
      }

      if (pathname === "/api/auth/me" && method === "GET") {
        return sendJson(res, 200, { me: currentUser(req), setupNeeded: db.needsSetup() });
      }

      if (pathname === "/api/users" && method === "GET") {
        const parent = requireParent(req, res);
        if (!parent) return;
        return sendJson(res, 200, { users: db.listUsers(parent.id) });
      }

      if (pathname === "/api/users" && method === "POST") {
        const parent = requireParent(req, res);
        if (!parent) return;
        const raw = await readBody(req);
        const data = JSON.parse(raw.toString("utf8") || "{}");
        const role = data.role === "parent" ? "parent" : "child";
        const user = db.createUser({
          username: data.username,
          password: data.password,
          role,
          display_name: data.display_name,
          parent_id: role === "child" ? parent.id : null
        });
        return sendJson(res, 200, { ok: true, user });
      }

      if (pathname.startsWith("/api/users/") && (method === "PUT" || method === "PATCH")) {
        const parent = requireParent(req, res);
        if (!parent) return;
        const id = Number(pathname.split("/").pop());
        const raw = await readBody(req);
        const data = JSON.parse(raw.toString("utf8") || "{}");
        const user = db.updateUser(id, data, parent);
        return sendJson(res, 200, { ok: true, user });
      }

      if (pathname === "/api/settings" && method === "GET") {
        return sendJson(res, 200, { settings: db.getSettings(), me: currentUser(req) });
      }

      if (pathname === "/api/settings" && (method === "PUT" || method === "POST")) {
        const parent = requireParent(req, res);
        if (!parent) return;
        const raw = await readBody(req);
        const data = JSON.parse(raw.toString("utf8") || "{}");
        const settings = db.setSettings(data.settings || data);
        return sendJson(res, 200, { ok: true, settings });
      }

      if (pathname === "/api/adds" && method === "GET") {
        return sendJson(res, 200, loadAdds());
      }

      if (pathname === "/api/adds" && (method === "POST" || method === "PUT")) {
        const parent = requireParent(req, res);
        if (!parent) return;
        const raw = await readBody(req);
        const data = JSON.parse(raw.toString("utf8") || "{}");
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          return sendJson(res, 400, { error: "object required" });
        }
        writeAdds(data);
        return sendJson(res, 200, { ok: true });
      }

      if (pathname.startsWith("/proxy-config") && method === "GET") {
        const cfg = loadProxy();
        return sendJson(res, 200, { target: cfg.target || "", hasKey: !!cfg.apiKey });
      }

      if (pathname.startsWith("/proxy-config") && method === "POST") {
        const parent = requireParent(req, res);
        if (!parent) return;
        const raw = await readBody(req);
        const data = JSON.parse(raw.toString("utf8") || "{}");
        const cfg = loadProxy();
        if (data.target != null) cfg.target = String(data.target).replace(/\/$/, "");
        if (data.apiKey != null) cfg.apiKey = String(data.apiKey || "");
        writeJson(CFG, cfg);
        return sendJson(res, 200, { ok: true });
      }

      if (
        (pathname.startsWith("/v1/") || pathname.startsWith("/agent-proxy/")) &&
        (method === "GET" || method === "POST")
      ) {
        return proxyAgent(req, res, pathname);
      }

      if (method !== "GET" && method !== "HEAD") {
        return sendJson(res, 404, { error: "not found" });
      }

      const file = safeJoin(ROOT, pathname);
      if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        return send(res, 404, "Not found");
      }
      const ext = path.extname(file).toLowerCase();
      const body = fs.readFileSync(file);
      return send(res, 200, body, MIME[ext] || "application/octet-stream");
    } catch (err) {
      return sendJson(res, 500, { error: { message: err.message || String(err) } });
    }
  });
}

function start(opts) {
  try {
    db.open();
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
  const settings = db.getSettings();
  const preferred = Number(
    opts.port || process.env.PORT || settings.preferred_port || 8080
  );
  const host = opts.host || "0.0.0.0";
  const open = opts.open !== false;
  const wantLan = host === "0.0.0.0" || host === "::";
  const candidates = portCandidates(preferred);
  const server = createServer();
  let index = 0;

  function onListening() {
    const addr = server.address();
    const port = addr && addr.port ? addr.port : preferred;
    let firewallOk = false;
    if (wantLan) firewallOk = openWindowsFirewall(port);

    const ips = lanIps();
    const loginPath = db.needsSetup() ? "/vorod.html" : "/vorod.html";
    console.log("");
    console.log("========================================");
    console.log("  Hamrah Ulum is running");
    console.log("========================================");
    console.log("Login:       http://127.0.0.1:" + port + loginPath);
    console.log("Parent PC:   http://127.0.0.1:" + port + "/");
    console.log("Family:      http://127.0.0.1:" + port + "/khanevadeh.html");
    console.log("JSON content: data/shared-adds.json");
    console.log("SQLite users: data/app.sqlite");
    console.log("");
    console.log("Kids on same Wi-Fi:");
    ips.forEach((ip) => console.log("  http://" + ip + ":" + port + "/vorod.html"));
    console.log("");
    if (wantLan) {
      console.log(
        firewallOk
          ? "Firewall: opened automatically for port " + port
          : "Firewall: could not open. Run start-home.bat and click YES once."
      );
      console.log("");
    }
    console.log("Keep this window OPEN. Ctrl+C to stop.");
    console.log("========================================");
    if (open) {
      const url = "http://127.0.0.1:" + port + loginPath;
      const cmd =
        process.platform === "win32"
          ? 'start "" "' + url + '"'
          : process.platform === "darwin"
            ? 'open "' + url + '"'
            : 'xdg-open "' + url + '"';
      require("child_process").exec(cmd);
    }
  }

  function tryListen() {
    if (index >= candidates.length) {
      console.error("No free port found. Close other programs and try again.");
      process.exit(1);
    }
    const port = candidates[index++];
    server.once("error", (err) => {
      if (err && err.code === "EADDRINUSE") {
        console.log("Port " + port + " busy — trying next...");
        tryListen();
        return;
      }
      console.error(err && err.message ? err.message : String(err));
      process.exit(1);
    });
    server.listen(port, host, onListening);
  }

  tryListen();
  return server;
}

module.exports = { start, createServer, lanIps, ROOT };
