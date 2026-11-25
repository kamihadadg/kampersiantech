(function () {
  const KEY = "hamrah-ulum-adds";

  function emptyLesson() {
    return { notes: [], examples: [], practice: [], memory: "", scene: "", updatedAt: "" };
  }

  function onServer() {
    return location.protocol === "http:" || location.protocol === "https:";
  }

  function all() {
    if (window.PACK_ADDS && typeof window.PACK_ADDS === "object") {
      return window.PACK_ADDS;
    }
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; }
  }

  function saveAll(data) {
    window.PACK_ADDS = data;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
    if (onServer()) {
      fetch("/api/adds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      }).catch(function () {});
    }
  }

  async function refreshFromServer() {
    if (!onServer()) return all();
    try {
      const res = await fetch("/api/adds", { cache: "no-store" });
      if (!res.ok) return all();
      const data = await res.json();
      if (data && typeof data === "object") {
        window.PACK_ADDS = data;
        try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
      }
    } catch (e) {}
    return all();
  }

  function get(subject, lessonId) {
    const a = all();
    const s = a[subject] || {};
    return Object.assign(emptyLesson(), s[String(lessonId)] || {});
  }

  function set(subject, lessonId, patch) {
    const a = all();
    if (!a[subject]) a[subject] = {};
    const cur = Object.assign(emptyLesson(), a[subject][String(lessonId)] || {});
    if (patch.notes) cur.notes = (cur.notes || []).concat(patch.notes).filter(Boolean);
    if (patch.examples) cur.examples = (cur.examples || []).concat(patch.examples).filter((x) => x && x.question);
    if (patch.practice) cur.practice = (cur.practice || []).concat(patch.practice).filter((x) => x && x.question);
    if (patch.memory) cur.memory = String(patch.memory);
    if (patch.scene) cur.scene = String(patch.scene);
    if (patch.replaceNotes) cur.notes = patch.replaceNotes;
    if (patch.replaceExamples) cur.examples = patch.replaceExamples;
    if (patch.replacePractice) cur.practice = patch.replacePractice;
    cur.updatedAt = new Date().toISOString();
    a[subject][String(lessonId)] = cur;
    saveAll(a);
    return cur;
  }

  function clearLesson(subject, lessonId) {
    const a = all();
    if (a[subject]) delete a[subject][String(lessonId)];
    saveAll(a);
  }

  function appendNote(subject, lessonId, text, source) {
    const note = (source ? ("[" + source + "] ") : "") + String(text || "").trim();
    if (!note) return get(subject, lessonId);
    return set(subject, lessonId, { notes: [note] });
  }

  function parseAgentPack(text) {
    if (!text) return null;
    const m = String(text).match(/```json\s*([\s\S]*?)```/i) || String(text).match(/\{[\s\S]*"practice"[\s\S]*\}/);
    if (!m) return null;
    try {
      const raw = m[1] ? m[1] : m[0];
      const obj = JSON.parse(raw);
      const pack = emptyLesson();
      if (Array.isArray(obj.notes)) pack.notes = obj.notes.map(String);
      else if (obj.note) pack.notes = [String(obj.note)];
      if (Array.isArray(obj.examples)) {
        pack.examples = obj.examples.map(function (ex) {
          return {
            question: String(ex.question || ""),
            solution: Array.isArray(ex.solution) ? ex.solution.map(String) : String(ex.solution || "").split(/\n+/).filter(Boolean),
            result: String(ex.result || "")
          };
        }).filter(function (x) { return x.question; });
      }
      if (Array.isArray(obj.practice)) {
        pack.practice = obj.practice.map(function (p) {
          return { question: String(p.question || ""), answer: String(p.answer || "") };
        }).filter(function (x) { return x.question; });
      }
      if (obj.memory) pack.memory = String(obj.memory);
      if (obj.scene) pack.scene = String(obj.scene);
      return pack;
    } catch (e) {
      return null;
    }
  }

  function applyPack(subject, lessonId, pack, source) {
    if (!pack) return null;
    const payload = {
      notes: pack.notes || [],
      examples: pack.examples || [],
      practice: pack.practice || []
    };
    if (source && payload.notes.length) {
      payload.notes = payload.notes.map(function (n) { return "[" + source + "] " + n; });
    } else if (source && !payload.notes.length && (payload.examples.length || payload.practice.length)) {
      payload.notes = ["[" + source + "] محتوای تازه به درس اضافه شد."];
    }
    if (pack.memory) payload.memory = pack.memory;
    if (pack.scene) payload.scene = pack.scene;
    return set(subject, lessonId, payload);
  }

  function mergeIntoLessons(subject, lessons) {
    (lessons || []).forEach(function (lesson) {
      const add = get(subject, lesson.id);
      lesson._adds = add;
      if (add.scene) lesson.scene = add.scene;
      if (add.memory) lesson.memory = add.memory;
      if (add.examples && add.examples.length) {
        lesson.worked_examples = (lesson.worked_examples || []).concat(add.examples);
      }
      if (add.practice && add.practice.length) {
        lesson.practice = (lesson.practice || []).concat(add.practice);
      }
      if (add.notes && add.notes.length) {
        lesson.adult_notes = (lesson.adult_notes || []).concat(add.notes);
      }
    });
  }

  function exportJSON() {
    return JSON.stringify(all(), null, 2);
  }

  function importJSON(text) {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object") throw new Error("فایل نامعتبر است");
    saveAll(data);
    return data;
  }

  function download() {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hamrah-ulum-adds.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  window.ADDS = {
    KEY: KEY,
    all: all,
    get: get,
    set: set,
    clearLesson: clearLesson,
    appendNote: appendNote,
    parseAgentPack: parseAgentPack,
    applyPack: applyPack,
    mergeIntoLessons: mergeIntoLessons,
    exportJSON: exportJSON,
    importJSON: importJSON,
    download: download,
    emptyLesson: emptyLesson,
    refreshFromServer: refreshFromServer,
    onServer: onServer
  };
})();
