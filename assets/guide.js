(function () {
  const data = window.GUIDE;
  const host = document.getElementById("lessons");
  const toc = document.getElementById("toc");
  if (!data || !host) {
    if (host) host.innerHTML = '<div class="empty">محتوای این درس‌نامه پیدا نشد.</div>';
    return;
  }

  const extra = window.ENRICH || {};
  (data.lessons || []).forEach((lesson) => {
    const more = extra[lesson.id];
    if (!more) return;
    if (more.scene) lesson.scene = more.scene;
    if (more.memory) lesson.memory = more.memory;
    if (more.example) {
      lesson.worked_examples = (lesson.worked_examples || (lesson.worked_example ? [lesson.worked_example] : [])).concat(more.example);
    }
    if (more.practice) lesson.practice = (lesson.practice || []).concat(more.practice);
  });
  // افزوده‌های ایجنت/بزرگ‌ترها (localStorage)
  if (window.ADDS && window.ADDS.mergeIntoLessons) {
    // subjectKey تعریف نشده؛ بعداً با heading حدس می‌زنیم
    const h = (data.heading || "") + " " + (data.title || "");
    const sub = h.indexOf("فیزیک") !== -1 ? "phy"
      : h.indexOf("شیمی") !== -1 ? "chem"
        : h.indexOf("زیست") !== -1 ? "bio"
          : h.indexOf("زمین") !== -1 ? "geo" : "math";
    window.ADDS.mergeIntoLessons(sub, data.lessons || []);
  }

  const root = document.documentElement;
  if (data.accent) root.style.setProperty("--blue", data.accent);
  if (data.accentDark) {
    root.style.setProperty("--hero1", data.accentDark);
    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme) theme.setAttribute("content", data.accentDark);
  }
  if (data.accentSoft) root.style.setProperty("--blue2", data.accentSoft);
  if (data.accent) root.style.setProperty("--hero2", data.accent);
  document.title = data.title || document.title;

  const sk = subjectKey();
  const fun = window.FUN || {};
  const startIds = (fun.start && fun.start[sk]) || (data.lessons || []).slice(0, 8).map((x) => x.id);
  const storageKey = "hamrah-ulum-" + sk;
  let easy = false;
  let onlyStart = false;
  let activeStage = "همه";
  let activeId = null;
  let scrollOnRender = false;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  const byId = Object.fromEntries((data.lessons || []).map((x) => [x.id, x]));
  const stages = [{ name: "همه", ids: null }].concat(
    (data.learning_map || []).map((s) => ({ name: s.stage, ids: s.lessons }))
  );

  function subjectKey() {
    const h = (data.heading || "") + " " + (data.title || "");
    if (h.indexOf("فیزیک") !== -1) return "phy";
    if (h.indexOf("شیمی") !== -1) return "chem";
    if (h.indexOf("زیست") !== -1) return "bio";
    if (h.indexOf("زمین") !== -1) return "geo";
    return "math";
  }

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch (e) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(storageKey, JSON.stringify(p)); } catch (e) {}
  }
  function isDone(id) { return !!loadProgress()[id]; }
  function setDone(id, val) {
    const p = loadProgress();
    if (val) p[id] = 1; else delete p[id];
    saveProgress(p);
  }
  function doneCount() {
    const p = loadProgress();
    return (data.lessons || []).filter((x) => p[x.id]).length;
  }

  function shortText(s, n) {
    s = String(s || "").trim();
    if (s.length <= n) return s;
    const cut = s.slice(0, n);
    const i = Math.max(cut.lastIndexOf("۔"), cut.lastIndexOf("."), cut.lastIndexOf("،"), cut.lastIndexOf(" "));
    return (i > 30 ? cut.slice(0, i) : cut).trim() + "…";
  }

  function figureHTML(x) {
    const fig = (window.FIGURES || {})[sk + "-" + x.id];
    if (!fig) return "";
    return '<figure class="figure">' + fig.svg + "<figcaption>" + esc(fig.caption) + "</figcaption></figure>";
  }

  function labHTML(x) {
    const key = sk + "-" + x.id;
    if (!(window.LABS || {})[key]) return "";
    return '<section class="lab" data-lab="' + esc(key) + '"><div class="lab-stage"></div></section>';
  }

  function mountActiveLab() {
    const section = host.querySelector(".lab[data-lab]");
    const box = host.querySelector(".lab-stage");
    if (!section || !box || !window.mountLab) return;
    window.mountLab(section.getAttribute("data-lab"), box);
  }

  function examplesOf(x) {
    if (Array.isArray(x.worked_examples) && x.worked_examples.length) return x.worked_examples;
    return x.worked_example ? [x.worked_example] : [];
  }

  function visibleLessons() {
    const q = (document.getElementById("search") || { value: "" }).value.trim().toLocaleLowerCase("fa");
    const stage = stages.find((s) => s.name === activeStage);
    return (data.lessons || []).filter((x) => {
      if (onlyStart && !startIds.includes(x.id)) return false;
      if (stage && stage.ids && !stage.ids.includes(x.id)) return false;
      if (q && !JSON.stringify(x).toLocaleLowerCase("fa").includes(q)) return false;
      return true;
    });
  }

  function linkHTML(x) {
    const L = (fun.links || {})[sk + "-" + x.id];
    if (!L) return "";
    return '<a class="fun-link" href="' + esc(L.href) + '">' + esc(L.text) + "</a>";
  }

  function lessonHTML(x) {
    const idea = easy ? shortText(x.idea || x.summary, 120) : (x.idea || "");
    const summary = easy ? shortText(x.summary || x.idea, 80) : (x.summary || "");
    const prereq = (x.prerequisites || []).map((id) => (byId[id] ? byId[id].title : String(id)));
    const chips = prereq.map((name) => '<span class="chip">' + esc(name) + "</span>").join("");
    const steps = (x.steps || []).map((s) => "<li>" + esc(s) + "</li>").join("");
    const formulas = (x.formulas || []).map((s) => '<div class="formula-row">' + esc(s) + "</div>").join("");
    const examples = examplesOf(x).map((ex, i) => {
      const sol = (ex.solution || []).map((s) => "<li>" + esc(s) + "</li>").join("");
      return '<article class="example"><p class="ex-q"><span class="label">مثال ' + (i + 1) + "</span>" +
        esc(ex.question || "") + '</p><ol class="step-list">' + sol +
        '</ol><p class="ex-result">نتیجه: ' + esc(ex.result || "") + "</p></article>";
    }).join("");
    const tip = shortText(x.common_mistake || x.memory || x.summary || "یک‌بار دیگر ایده را بخوان.", 100);
    const practices = (x.practice || []).map((p, i) =>
      '<article class="practice"><span class="label">تمرین ' + (i + 1) + "</span><p class=\"prose\">" +
      esc(p.question) + '</p><button class="action answer-btn" type="button" aria-expanded="false">ببین درست زدم؟</button>' +
      '<div class="answer" hidden><b>پاسخ:</b> ' + esc(p.answer) +
      '<p class="why-line">اگر سخت بود: ' + esc(tip) + "</p></div></article>"
    ).join("");
    const block = (title, inner) => inner ? '<section class="block"><h3>' + title + "</h3>" + inner + "</section>" : "";
    const done = isDone(x.id);

    return '<article class="lesson">' +
      '<header class="lesson-head"><span class="num">' + x.id + "</span><div><h2>" + esc(x.title) +
      "</h2>" + (x.level ? '<span class="level">' + esc(x.level) + "</span>" : "") + "</div></header>" +
      '<div class="fun-bar">' +
      '<button type="button" class="fun-btn" data-speak="1">برام بخون</button>' +
      '<button type="button" class="fun-btn star-btn' + (done ? " on" : "") + '" data-star="1">' +
      (done ? "ستاره‌اش را گرفتی" : "خواندم — ستاره بده") + "</button>" +
      '<button type="button" class="fun-btn" data-sheet="1">چاپ تمرین</button>' +
      '<a class="fun-btn adult-only" href="../dastyar.html?sub=' + encodeURIComponent(sk) + '&id=' + x.id + '">دستیار بزرگ‌ترها</a>' +
      "</div>" +
      (summary ? '<p class="summary-box"><span class="label">چکیده</span>' + esc(summary) + "</p>" : "") +
      figureHTML(x) +
      labHTML(x) +
      (x.goal && !easy ? '<p class="kicker"><span class="label">بعد از این درس می‌توانی</span>' + esc(x.goal) + "</p>" : "") +
      (chips && !easy ? '<div class="chips"><span class="label">اول این‌ها را بلد باش</span>' + chips + "</div>" : "") +
      (idea ? '<p class="prose">' + esc(idea) + "</p>" : "") +
      (!easy && x.why ? '<p class="why"><span class="label">چرا مهم است</span>' + esc(x.why) + "</p>" : "") +
      (x.scene ? '<p class="scene"><span class="label">در زندگی واقعی</span>' + esc(x.scene) + "</p>" : "") +
      block("قدم‌به‌قدم", steps ? '<ol class="step-list">' + steps + "</ol>" : "") +
      (!easy ? block("فرمول‌ها", formulas ? '<div class="formulas">' + formulas + "</div>" : "") : "") +
      block("مثال‌های حل‌شده", examples) +
      (x.common_mistake ? '<p class="mistake"><span class="label">مواظب باش</span>' + esc(x.common_mistake) + "</p>" : "") +
      block("تمرین بازی", practices) +
      '<section class="feel-box"><h3>حس خودت را بگو</h3>' +
      '<div class="feel-row">' +
      '<button type="button" class="feel" data-feel="2">بلدم</button>' +
      '<button type="button" class="feel" data-feel="1">نیمه‌بلدم</button>' +
      '<button type="button" class="feel" data-feel="0">هنوز نه</button>' +
      '</div><p class="feel-msg" hidden></p></section>' +
      (x.reflect && !easy ? '<p class="reflect"><span class="label">از خودت بپرس</span>' + esc(x.reflect) + "</p>" : "") +
      (x.memory ? '<p class="memory"><span class="label">یک جمله قشنگ</span>' + esc(x.memory) + "</p>" : "") +
      (x.bridge ? '<p class="bridge"><span class="label">بعدش چی؟</span>' + esc(x.bridge) + "</p>" : "") +
      ((x.adult_notes || []).length
        ? '<section class="adult-notes"><h3>از بزرگ‌ترها / ایجنت</h3>' +
          (x.adult_notes || []).map(function (n) { return "<p>" + esc(n) + "</p>"; }).join("") +
          "</section>"
        : "") +
      linkHTML(x) +
      "</article>";
  }

  function pagerHTML(list, index) {
    const prev = list[index - 1];
    const next = list[index + 1];
    return '<nav class="pager" aria-label="درس قبل و بعد">' +
      '<button type="button" data-go="prev"' + (prev ? "" : " disabled") + ">قبلی" +
      (prev ? "<small>" + esc(prev.title) + "</small>" : "") + "</button>" +
      '<button type="button" data-go="next"' + (next ? "" : " disabled") + ">بعدی" +
      (next ? "<small>" + esc(next.title) + "</small>" : "") + "</button></nav>";
  }

  function updateProgressUI() {
    const el = document.getElementById("progressFun");
    if (!el) return;
    const total = (data.lessons || []).length;
    const n = doneCount();
    el.textContent = "ستاره‌ها: " + n + " از " + total;
  }

  function speakLesson(x) {
    if (!window.speechSynthesis) {
      alert("روی این دستگاه خواندن صوتی نیست. خودت چکیده را بلند بخوان!");
      return;
    }
    window.speechSynthesis.cancel();
    const text = [x.title, x.summary || x.idea, x.memory].filter(Boolean).join(". ");
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fa-IR";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }

  function sheetQuestions(x) {
    const qs = [];
    const add = (q, lines) => {
      if (!q) return;
      const t = String(q).trim();
      if (!t || qs.some((y) => y.q === t)) return;
      qs.push({ q: t, lines: lines || 1 });
    };

    add("با یک جمله بگو این درس دربارهٔ چیست؟", 2);
    if (x.goal) add("بعد از این درس چه کاری می‌توانی بکنی؟ با زبان خودت بنویس.", 2);
    if (x.summary) add("چکیده را بدون نگاه کردن به درس، از حفظ بنویس.", 2);

    (x.practice || []).forEach((p) => add(p.question, 1));
    examplesOf(x).forEach((ex) => {
      if (ex.question) add("خودت حل کن (مثل مثال درس): " + ex.question, 2);
    });

    (x.formulas || []).forEach((f) => {
      add("این فرمول را کامل یا از حفظ بنویس: «" + shortText(f, 48) + "…» — جاهای خالی یا شکل درستش را بنویس.", 1);
    });

    if ((x.steps || []).length) {
      add("قدم‌های حل را به ترتیب و با کلمات خودت بنویس (حداقل ۳ قدم).", 3);
    }
    if (x.common_mistake) {
      add("یک اشتباه رایج این درس چیست؟ چطور درستش می‌کنی؟", 2);
    }
    if (x.scene) {
      add("یک مثال از زندگی خودت برای این درس بساز (غیر از مثال کتاب).", 2);
    }
    if (x.reflect) add(x.reflect, 2);
    if (x.memory) add("جملهٔ ماندگار درس را بنویس، بعد با یک مثال کوچک توضیح بده.", 2);

    add("یک سؤال سخت‌تر شبیه تمرین‌های بالا خودت بساز و حل کن.", 3);
    add("به دوستت چطور یاد می‌دهی؟ در ۳ خط آموزش بده.", 3);
    add("کدام قسمت برایت سخت بود؟ چرا؟", 2);

    // اگر هنوز کم است، سؤال‌های کمکی عمومی بساز
    const fillers = [
      "یک عدد یا نمونهٔ واقعی برای مفهوم این درس بنویس.",
      "درست یا نادرست را مشخص کن و دلیل بیاور: «این درس فقط حفظ کردن فرمول است.»",
      "اگر فردا امتحان باشد، ۳ نکتهٔ مهم را که باید مرور کنی لیست کن.",
      "یک شکل ساده برای این مفهوم بکش و زیرش توضیح یک‌خطی بنویس.",
      "مفهوم این درس را به یک درس دیگر که خوانده‌ای وصل کن."
    ];
    let i = 0;
    while (qs.length < 12 && i < fillers.length) {
      add(fillers[i], 2);
      i += 1;
    }
    return qs.slice(0, 16);
  }

  function openSheet(x) {
    const items = sheetQuestions(x);
    const body = items.map((item, i) => {
      const lines = Array.from({ length: item.lines }, () =>
        '<p class="line">................................................................</p>'
      ).join("");
      return '<div class="q"><p><b>' + (i + 1) + ")</b> " + esc(item.q) + "</p>" + lines + "</div>";
    }).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write("<!doctype html><html lang=\"fa\" dir=\"rtl\"><head><meta charset=\"utf-8\">" +
      "<title>کاربرگ " + esc(x.title) + "</title>" +
      "<style>" +
      "body{font-family:Tahoma,sans-serif;padding:22px;line-height:1.85;color:#222;max-width:820px;margin:auto}" +
      "h1{font-size:1.25rem;margin:0 0 6px} .meta{color:#555;margin:0 0 14px}" +
      ".banner{background:#f7f1e3;border:1px solid #e2d3b0;border-radius:12px;padding:10px 12px;margin:0 0 16px}" +
      ".q{margin:0 0 16px;padding-bottom:8px;border-bottom:1px dashed #ddd}" +
      ".line{margin:6px 0;color:#777;letter-spacing:1px}" +
      ".foot{margin-top:18px} @media print{.no{display:none} body{padding:0} .q{break-inside:avoid}}" +
      "</style></head><body>" +
      "<p class=\"no\"><button onclick=\"print()\">چاپ</button> · بدون پاسخ — برای تمرین</p>" +
      "<h1>کاربرگ: " + esc(x.title) + "</h1>" +
      "<p class=\"meta\">نام: ...................... &nbsp; تاریخ: ............ &nbsp; تعداد سؤال: " + items.length + "</p>" +
      "<p class=\"banner\">جواب‌ها را اینجا ننویسِ آماده؛ اول خودت فکر کن. اگر گیر کردی برگرد به آزمایش یا مثال درس.</p>" +
      body +
      "<p class=\"foot\">ستاره‌ام به این درس: □ □ □ &nbsp;&nbsp; حس من: بلدم □ &nbsp; نیمه‌بلدم □ &nbsp; هنوز نه □</p>" +
      "</body></html>");
    w.document.close();
  }

  function bindLessonActions(lesson) {
    const star = host.querySelector("[data-star]");
    if (star) star.addEventListener("click", () => {
      const on = !isDone(lesson.id);
      setDone(lesson.id, on);
      render();
    });
    const speakBtn = host.querySelector("[data-speak]");
    if (speakBtn) speakBtn.addEventListener("click", () => speakLesson(lesson));
    const sheet = host.querySelector("[data-sheet]");
    if (sheet) sheet.addEventListener("click", () => openSheet(lesson));
    host.querySelectorAll(".feel").forEach((b) => b.addEventListener("click", () => {
      const v = Number(b.getAttribute("data-feel"));
      const msg = host.querySelector(".feel-msg");
      host.querySelectorAll(".feel").forEach((x) => x.classList.remove("on"));
      b.classList.add("on");
      msg.hidden = false;
      if (v === 2) {
        msg.textContent = "عالی! ستاره‌اش را هم بگیر و برو درس بعد.";
        setDone(lesson.id, true);
        updateProgressUI();
        const starBtn = host.querySelector(".star-btn");
        if (starBtn) { starBtn.classList.add("on"); starBtn.textContent = "ستاره‌اش را گرفتی"; }
      } else if (v === 1) {
        msg.textContent = "اشکالی نداره. یک‌بار آزمایش یا مثال را دوباره ببین.";
      } else {
        msg.textContent = "آروم باش. فقط چکیده و آزمایش را بازی کن، بعد دوباره بیا.";
      }
    }));
  }

  function render() {
    const list = visibleLessons();
    const pos = document.getElementById("lessonPos");
    const answersBtn = document.getElementById("allAnswers");
    if (answersBtn) answersBtn.textContent = "همهٔ پاسخ‌ها";
    updateProgressUI();
    if (!list.length) {
      if (toc) toc.innerHTML = "";
      if (pos) pos.textContent = "";
      host.innerHTML = '<div class="empty">چیزی پیدا نشد. فیلتر را عوض کن.</div>';
      return;
    }
    if (!list.some((x) => x.id === activeId)) activeId = list[0].id;
    const index = list.findIndex((x) => x.id === activeId);
    const lesson = list[index];
    if (toc) {
      toc.innerHTML = list.map((x) =>
        '<button class="toc-item' + (x.id === activeId ? " active" : "") + (isDone(x.id) ? " done" : "") +
        '" type="button" data-id="' + x.id + '">' +
        '<span class="toc-num">' + (isDone(x.id) ? "★" : x.id) + "</span><span>" + esc(x.title) + "</span></button>"
      ).join("");
      toc.querySelectorAll(".toc-item").forEach((b) => b.addEventListener("click", () => {
        activeId = Number(b.getAttribute("data-id"));
        scrollOnRender = true;
        render();
      }));
    }
    if (pos) pos.textContent = "درس " + (index + 1) + " از " + list.length;
    host.innerHTML = lessonHTML(lesson) + pagerHTML(list, index);
    mountActiveLab();
    bindLessonActions(lesson);
    host.querySelectorAll(".answer-btn").forEach((b) => b.addEventListener("click", () => {
      const a = b.nextElementSibling;
      const show = a.hidden;
      a.hidden = !show;
      b.textContent = show ? "پنهان کن" : "ببین درست زدم؟";
      b.setAttribute("aria-expanded", String(show));
    }));
    host.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => {
      if (b.disabled) return;
      const delta = b.getAttribute("data-go") === "next" ? 1 : -1;
      const target = list[index + delta];
      if (!target) return;
      activeId = target.id;
      scrollOnRender = true;
      render();
    }));
    if (scrollOnRender) {
      scrollOnRender = false;
      const card = host.querySelector(".lesson");
      if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function init() {
    document.getElementById("pageTitle").textContent = data.heading || data.title;
    document.getElementById("pageDesc").textContent = data.description || "";
    const count = (data.lessons || []).length;
    document.getElementById("badge").textContent = count + " درس · با بازی و ستاره";
    const tips = (data.how_to_study || []).map((s) => "<li>" + esc(s) + "</li>").join("");
    const how = document.getElementById("howPanel");
    how.innerHTML = "<details><summary>چطور بخوانم؟</summary><ol class=\"how-list\">" + tips + "</ol></details>";
    document.getElementById("orderNote").textContent = data.study_order_note || "";
    document.getElementById("glossary").innerHTML = (data.glossary || []).map((x) =>
      '<div class="term"><b>' + esc(x.term) + "</b><p>" + esc(x.definition) + "</p></div>").join("");
    document.getElementById("formulaSheet").innerHTML = (data.formula_sheet || []).map((x) =>
      '<div class="formula-row"><span class="label">' + esc(x.topic) + "</span>" + esc(x.formula) + "</div>").join("");
    const gSum = document.querySelector("#glossaryFold summary");
    const fSum = document.querySelector("#formulaFold summary");
    if (gSum) gSum.textContent = "واژه‌نامه (" + (data.glossary || []).length + ")";
    if (fSum) fSum.textContent = "برگهٔ فرمول‌ها (" + (data.formula_sheet || []).length + ")";
    document.getElementById("footer").textContent = data.footer || "درس‌نامهٔ آفلاین";

    const stageHost = document.getElementById("stages");
    stageHost.innerHTML =
      '<button class="stage fun-start" type="button" data-start="1">شروع از اینجا</button>' +
      stages.map((s) => '<button class="stage' + (s.name === "همه" ? " active" : "") + '" type="button">' + esc(s.name) + "</button>").join("");
    stageHost.querySelectorAll(".stage").forEach((b) => b.addEventListener("click", () => {
      stageHost.querySelectorAll(".stage").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      if (b.getAttribute("data-start")) {
        onlyStart = true;
        activeStage = "همه";
      } else {
        onlyStart = false;
        activeStage = b.textContent;
      }
      render();
    }));

    const easyBtn = document.getElementById("easyMode");
    if (easyBtn) easyBtn.addEventListener("click", () => {
      easy = !easy;
      easyBtn.classList.toggle("on", easy);
      easyBtn.textContent = easy ? "حالت ساده روشن" : "ساده‌تر نشان بده";
      render();
    });

    document.getElementById("search").addEventListener("input", render);
    document.getElementById("allAnswers").addEventListener("click", (e) => {
      const items = [...host.querySelectorAll(".answer")];
      const show = items.some((x) => x.hidden);
      items.forEach((x) => {
        x.hidden = !show;
        const btn = x.previousElementSibling;
        if (btn) {
          btn.textContent = show ? "پنهان کن" : "ببین درست زدم؟";
          btn.setAttribute("aria-expanded", String(show));
        }
      });
      e.currentTarget.textContent = show ? "پنهان‌کردن پاسخ‌ها" : "همهٔ پاسخ‌ها";
    });
    onlyStart = true;
    const startBtn = stageHost.querySelector("[data-start]");
    if (startBtn) {
      stageHost.querySelectorAll(".stage").forEach((x) => x.classList.remove("active"));
      startBtn.classList.add("active");
    }
    render();
  }

  init();
})();
