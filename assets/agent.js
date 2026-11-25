(function () {
  const STORE = "hamrah-ulum-agent";

  const SUBJECTS = [
    { key: "math", folder: "riazi", title: "ریاضی" },
    { key: "phy", folder: "fizik", title: "فیزیک" },
    { key: "chem", folder: "shimi", title: "شیمی" },
    { key: "bio", folder: "zist", title: "زیست‌شناسی" },
    { key: "geo", folder: "zamin", title: "زمین‌شناسی" }
  ];

  const PRESETS = [
    { id: "teach", label: "کامل کن و بساز برای درس", prompt: "محتوای قابل‌افزودن به خود درس بساز. اول ۲ پاراگراف توضیح کودک‌پسند، بعد بلوک JSON طبق قالب سیستم." },
    { id: "mistakes", label: "اشتباهات + تمرین", prompt: "۳ اشتباه رایج و ۳ تمرین اصلاحی بساز. متن کوتاه فارسی + بلوک JSON قالب سیستم." },
    { id: "moreq", label: "مثال و تمرین بیشتر", prompt: "۲ مثال حل‌شده و ۵ تمرین با پاسخ بساز، ساده و جذاب. متن کوتاه + JSON قالب سیستم." },
    { id: "week", label: "برنامهٔ هفته", prompt: "برنامهٔ ۷ روزهٔ ۱۵ دقیقه‌ای برای والد. فقط متن؛ JSON لازم نیست مگر یک note کوتاه." },
    { id: "story", label: "داستان کوتاه", prompt: "یک داستانک ۸۰ کلمه‌ای. بعد JSON با notes شامل همان داستان." }
  ];

  function loadCfg() {
    try {
      return Object.assign({
        baseUrl: "http://192.168.1.112:20128/v1",
        apiKey: "",
        model: "",
        useProxy: true
      }, JSON.parse(localStorage.getItem(STORE) || "{}"));
    } catch (e) {
      return { baseUrl: "http://192.168.1.112:20128/v1", apiKey: "", model: "", useProxy: true };
    }
  }

  function saveCfg(cfg) {
    localStorage.setItem(STORE, JSON.stringify({
      baseUrl: (cfg.baseUrl || "").replace(/\/$/, ""),
      apiKey: cfg.apiKey || "",
      model: cfg.model || "",
      useProxy: cfg.useProxy !== false
    }));
  }

  function modelsEndpoint(cfg) {
    const wantProxy = cfg.useProxy !== false;
    if (wantProxy && hasLocalServer()) {
      return location.origin.replace(/\/$/, "") + "/v1/models";
    }
    return cfg.baseUrl.replace(/\/$/, "") + "/models";
  }

  function authHeaders(cfg) {
    const headers = { Accept: "application/json" };
    const key = (cfg && cfg.apiKey || "").trim();
    // با پروکسی محلی، اگر کلید خالی بود نفرست تا سرور از agent-proxy.json استفاده کند
    if (key) headers.Authorization = "Bearer " + key;
    else if (!(cfg && cfg.useProxy !== false && hasLocalServer())) headers.Authorization = "Bearer lm-studio";
    return headers;
  }

  function fetchWithTimeout(url, options, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, ms || 300000);
    const opts = Object.assign({}, options || {}, { signal: ctrl.signal });
    return fetch(url, opts).finally(function () { clearTimeout(timer); });
  }

  async function listModels(cfg) {
    const c = cfg || loadCfg();
    if (isFileOrigin()) throw new Error(corsHelp());
    if (c.useProxy !== false && hasLocalServer()) await syncProxyConfig(c);
    const res = await fetchWithTimeout(modelsEndpoint(c), {
      headers: authHeaders(c)
    }, 15000);
    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      const msg = (data && data.error && (data.error.message || data.error)) || res.statusText || "models error";
      throw new Error(String(msg));
    }
    const rows = (data && data.data) || [];
    return rows.map(function (m) { return m && m.id; }).filter(Boolean);
  }

  function pickLoadedModel(ids, current) {
    const list = ids || [];
    if (!list.length) return current || "";
    if (current && list.indexOf(current) !== -1) return current;
    // مدل‌های نمونهٔ قدیمی که روی این ایجنت نیستند
    const stale = !current || current === "gpt-4o-mini" || current === "local-model";
    if (stale) return list[0];
    return list[0];
  }

  async function syncLoadedModel(cfg) {
    const c = Object.assign({}, cfg || loadCfg());
    const ids = await listModels(c);
    c.model = pickLoadedModel(ids, c.model);
    saveCfg(c);
    if (c.useProxy !== false && hasLocalServer()) await syncProxyConfig(c);
    return { model: c.model, models: ids, cfg: c };
  }

  function isFileOrigin() {
    return location.protocol === "file:" || location.origin === "null";
  }

  function hasLocalServer() {
    return location.protocol === "http:" || location.protocol === "https:";
  }

  function corsHelp() {
    return "مرورگر به‌خاطر CORS جلوی اتصال را گرفته. فایل start-home.bat را اجرا کن و صفحه را از آدرس سرور باز کن (نه دوبارکلیک روی HTML).";
  }

  async function syncProxyConfig(cfg) {
    if (!hasLocalServer()) return;
    try {
      await fetch("/proxy-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: cfg.baseUrl, apiKey: cfg.apiKey || "" })
      });
    } catch (e) {
      // سرور پروکسی روشن نیست
    }
  }

  function lessonContext(guide, lesson) {
    if (!lesson) return "درسی انتخاب نشده.";
    return [
      "علم: " + (guide.heading || guide.title || ""),
      "درس " + lesson.id + ": " + lesson.title,
      "هدف: " + (lesson.goal || ""),
      "چکیده: " + (lesson.summary || ""),
      "ایده: " + (lesson.idea || ""),
      "فرمول‌ها: " + ((lesson.formulas || []).join(" | ") || "—"),
      "اشتباه رایج: " + (lesson.common_mistake || "—"),
      "جمله ماندگار: " + (lesson.memory || "—")
    ].join("\n");
  }

  function systemPrompt() {
    return [
      "تو دستیار آموزشی والدین و معلمان هستی برای بستهٔ آفلاین «همراه علوم».",
      "به فارسی ساده، دقیق و کودک‌پسند جواب بده. پیچیده و ترسناک ننویس.",
      "برای شیمی دستور مخلوط مواد خانگی نده. برای زیست درمان/تشخیص پزشکی نده.",
      "هر وقت محتوا برای افزودن مستقیم به درس می‌سازی، پایان پاسخ یک بلوک JSON با این قالب بگذار:",
      "```json",
      "{\"notes\":[\"یادداشت کوتاه\"],\"examples\":[{\"question\":\"...\",\"solution\":[\"گام1\"],\"result\":\"...\"}],\"practice\":[{\"question\":\"...\",\"answer\":\"...\"}],\"memory\":\"یک جمله\",\"scene\":\"مثال زندگی\"}",
      "```",
      "فیلدهای خالی را حذف کن. notes و practice و examples مهم‌ترین‌ها هستند."
    ].join(" ");
  }

  function loadGuide(folder) {
    return new Promise(function (resolve, reject) {
      const keep = window.GUIDE;
      window.GUIDE = undefined;
      const s = document.createElement("script");
      s.src = folder + "/guide.js";
      s.onload = function () {
        const g = window.GUIDE;
        window.GUIDE = keep;
        s.remove();
        if (!g || !g.lessons) reject(new Error("درس‌نامه بار نشد."));
        else resolve(g);
      };
      s.onerror = function () {
        window.GUIDE = keep;
        s.remove();
        reject(new Error("فایل راهنما پیدا نشد: " + folder));
      };
      document.head.appendChild(s);
    });
  }

  function extractContent(data) {
    if (!data) return "";
    const choice = data.choices && data.choices[0];
    if (!choice) return typeof data.content === "string" ? data.content : "";
    const msg = choice.message || choice.delta || {};
    if (typeof msg.content === "string" && msg.content) return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content.map(function (p) {
        if (typeof p === "string") return p;
        return (p && (p.text || p.content)) || "";
      }).join("");
    }
    if (typeof choice.text === "string") return choice.text;
    // برخی مدل‌های thinking فقط reasoning می‌فرستند
    if (typeof msg.reasoning === "string" && msg.reasoning) return msg.reasoning;
    if (typeof msg.reasoning_content === "string" && msg.reasoning_content) return msg.reasoning_content;
    return "";
  }

  function parseChatPayload(raw) {
    const text = String(raw || "").trim();
    if (!text) return {};
    if (text.charAt(0) === "{") {
      try { return JSON.parse(text); } catch (e) { return {}; }
    }
    // پاسخ SSE (stream) — تکه‌های data: را جمع کن
    if (text.indexOf("data:") !== -1) {
      let content = "";
      let last = null;
      text.split(/\r?\n/).forEach(function (line) {
        const s = line.replace(/^data:\s*/, "").trim();
        if (!s || s === "[DONE]") return;
        try {
          const chunk = JSON.parse(s);
          last = chunk;
          const piece = extractContent(chunk);
          if (piece) content += piece;
        } catch (e) {}
      });
      if (content) {
        return {
          choices: [{ message: { role: "assistant", content: content }, finish_reason: "stop" }],
          model: last && last.model
        };
      }
      return last || {};
    }
    return {};
  }

  async function chat(messages) {
    let cfg = loadCfg();
    const wantProxy = cfg.useProxy !== false;

    if (isFileOrigin()) {
      throw new Error(corsHelp());
    }

    try {
      const synced = await syncLoadedModel(cfg);
      cfg = synced.cfg;
    } catch (e) {
      // اگر لیست مدل‌ها نیامد با همان نام ذخیره‌شده ادامه بده
    }

    if (!cfg.model) {
      throw new Error("نام مدل خالی است. دکمهٔ «همگام با مدل لودشده» را بزن.");
    }

    let endpoint;
    if (wantProxy && hasLocalServer()) {
      await syncProxyConfig(cfg);
      endpoint = location.origin.replace(/\/$/, "") + "/v1/chat/completions";
    } else {
      endpoint = cfg.baseUrl.replace(/\/$/, "") + "/chat/completions";
    }

    const headers = Object.assign({ "Content-Type": "application/json" }, authHeaders(cfg));

    let res;
    try {
      res = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          model: cfg.model,
          stream: false,
          temperature: 0.5,
          max_tokens: 2048,
          messages: messages
        })
      }, 300000);
    } catch (e) {
      if (isFileOrigin()) throw new Error(corsHelp());
      if (e && e.name === "AbortError") {
        throw new Error("زمان پاسخ ایجنت تمام شد. دوباره بفرست.");
      }
      throw new Error("ارتباط برقرار نشد: " + (e && e.message ? e.message : e) +
        " — مطمئن شو start-home.bat روشن است و ایجنت روی همان آدرس کار می‌کند.");
    }

    const raw = await res.text();
    const data = parseChatPayload(raw);
    if (!res.ok) {
      const msg = (data && data.error && (data.error.message || data.error)) || res.statusText || "خطای ایجنت";
      const text = String(msg);
      if (res.status === 401) {
        throw new Error("ایجنت کلید می‌خواهد (401). کلید را در agent-proxy.json یا تنظیمات دستیار بگذار.");
      }
      if (res.status === 404) {
        throw new Error("مسیر chat/completions پیدا نشد. آدرس باید شبیه http://IP:PORT/v1 باشد.");
      }
      if (res.status === 504) {
        throw new Error(text || "Agent timeout");
      }
      if (/model|not found|does not exist|unknown/i.test(text)) {
        throw new Error(text + " — دکمهٔ «همگام با مدل لودشده» را بزن. مدل فعلی: " + cfg.model);
      }
      throw new Error(text);
    }
    const content = extractContent(data);
    if (!content) {
      throw new Error("پاسخی از ایجنت نیامد. مدل فعلی «" + cfg.model + "» است؛ صفحه را یک‌بار رفرش کن یا «همگام با مدل لودشده» را بزن.");
    }
    return content;
  }

  function copyPrompt(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return Promise.resolve();
  }

  window.AGENT = {
    STORE: STORE,
    SUBJECTS: SUBJECTS,
    PRESETS: PRESETS,
    loadCfg: loadCfg,
    saveCfg: saveCfg,
    loadGuide: loadGuide,
    lessonContext: lessonContext,
    systemPrompt: systemPrompt,
    chat: chat,
    copyPrompt: copyPrompt,
    isFileOrigin: isFileOrigin,
    hasLocalServer: hasLocalServer,
    corsHelp: corsHelp,
    syncProxyConfig: syncProxyConfig,
    listModels: listModels,
    syncLoadedModel: syncLoadedModel,
    pickLoadedModel: pickLoadedModel
  };
})();
