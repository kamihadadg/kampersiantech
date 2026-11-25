(function () {
  function el(tag, attrs, html) {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach((k) => {
      if (k === "className") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    if (html != null) n.innerHTML = html;
    return n;
  }

  function svgRoot(viewBox) {
    return '<svg viewBox="' + (viewBox || "0 0 640 240") + '" aria-hidden="true" focusable="false">';
  }

  function controls(root, rows) {
    const box = el("div", { className: "lab-controls" });
    rows.forEach((row) => box.appendChild(row));
    root.appendChild(box);
    return box;
  }

  function btn(label, onClick) {
    const b = el("button", { type: "button", className: "lab-btn", text: label });
    b.addEventListener("click", onClick);
    return b;
  }

  function slider(label, min, max, value, onInput) {
    const wrap = el("label", { className: "lab-slider" });
    const name = el("span", { text: label });
    const input = el("input", { type: "range", min: String(min), max: String(max), value: String(value), step: "1" });
    const val = el("strong", { text: String(value) });
    input.addEventListener("input", () => {
      val.textContent = input.value;
      onInput(Number(input.value), val, input);
    });
    wrap.appendChild(name);
    wrap.appendChild(input);
    wrap.appendChild(val);
    return { wrap, input, val };
  }

  function readout(root) {
    const p = el("p", { className: "lab-readout" });
    root.appendChild(p);
    return p;
  }

  function stage(root, svgHtml) {
    const s = el("div", { className: "lab-canvas", html: svgHtml });
    root.appendChild(s);
    return s;
  }

  function shell(root, title, tip, build) {
    root.innerHTML = "";
    root.appendChild(el("div", { className: "lab-head", html: "<strong>" + title + "</strong>" }));
    build(root);
    if (tip) root.appendChild(el("p", { className: "lab-tip", text: tip }));
  }

  const LABS = {};

  // ---------- MATH ----------
  LABS["math-1"] = {
    title: "آزمایش: ضرب یعنی گروه مساوی",
    tip: "تعداد گروه و اندازهٔ هر گروه را عوض کن و ببین ضرب چطور ساخته می‌شود.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        const canvas = stage(r, svgRoot() + "</svg>");
        const out = readout(r);
        const g = slider("تعداد گروه", 1, 6, 4, draw);
        const n = slider("در هر گروه", 1, 5, 3, draw);
        controls(r, [g.wrap, n.wrap]);
        function draw() {
          const groups = Number(g.input.value);
          const each = Number(n.input.value);
          let dots = "";
          for (let i = 0; i < groups; i++) {
            const x = 40 + i * 100;
            dots += '<rect class="paper" x="' + x + '" y="40" width="80" height="140" rx="10"/>';
            for (let j = 0; j < each; j++) {
              dots += '<circle class="accent-fill" cx="' + (x + 40) + '" cy="' + (70 + j * 22) + '" r="8"/>';
            }
          }
          canvas.innerHTML = svgRoot() + dots + "</svg>";
          out.textContent = groups + " × " + each + " = " + (groups * each);
        }
        draw();
      });
    }
  };

  LABS["math-2"] = {
    title: "آزمایش: درصد روی نوار",
    tip: "لغزنده را بکش و ببین همان مقدار چند درصد، کسر و اعشار است.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        const canvas = stage(r, "");
        const out = readout(r);
        const s = slider("مقدار از ۱۰۰", 0, 100, 50, draw);
        controls(r, [s.wrap]);
        function draw() {
          const p = Number(s.input.value);
          const w = Math.max(2, p * 5);
          canvas.innerHTML = svgRoot() +
            '<rect class="paper" x="70" y="90" width="500" height="44" rx="12"/>' +
            '<rect class="accent-fill" x="72" y="92" width="' + w + '" height="40" rx="10"/>' +
            "</svg>";
          out.textContent = p + "% = " + (p / 100) + " = " + p + "/100";
        }
        draw();
      });
    }
  };

  LABS["math-5"] = {
    title: "آزمایش: توان یعنی مربع",
    tip: "ضلع مربع را عوض کن و ببین n² چند خانه می‌شود.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        const canvas = stage(r, "");
        const out = readout(r);
        const s = slider("ضلع", 1, 6, 3, draw);
        controls(r, [s.wrap]);
        function draw() {
          const n = Number(s.input.value);
          const size = 28;
          let cells = "";
          for (let row = 0; row < n; row++) {
            for (let col = 0; col < n; col++) {
              cells += '<rect class="soft" x="' + (80 + col * size) + '" y="' + (40 + row * size) +
                '" width="' + (size - 3) + '" height="' + (size - 3) + '" rx="4" stroke="var(--blue)" stroke-width="1.5"/>';
            }
          }
          canvas.innerHTML = svgRoot() + cells + "</svg>";
          out.textContent = n + "² = " + (n * n) + " خانه";
        }
        draw();
      });
    }
  };

  LABS["math-3"] = {
    title: "آزمایش: جمع کسر با مخرج مشترک",
    tip: "تعداد تکه‌های رنگی را عوض کن و ببین جمع روی مخرج ۶ چه می‌شود.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        const canvas = stage(r, "");
        const out = readout(r);
        const a = slider("از ۶ قسمت (کسر اول)", 0, 6, 3, draw);
        const b = slider("از ۶ قسمت (کسر دوم)", 0, 6, 2, draw);
        controls(r, [a.wrap, b.wrap]);
        function bar(y, filled, label) {
          let s = '<text x="50" y="' + (y + 24) + '" class="ink" font-size="14" text-anchor="end" direction="ltr">' + label + "</text>";
          for (let i = 0; i < 6; i++) {
            s += '<rect class="' + (i < filled ? "accent-fill" : "paper") + '" x="' + (70 + i * 80) + '" y="' + y + '" width="74" height="34" rx="6"/>';
          }
          return s;
        }
        function draw() {
          const x = Number(a.input.value);
          const y = Number(b.input.value);
          const sum = Math.min(6, x + y);
          canvas.innerHTML = svgRoot() + bar(40, x, x + "/6") + bar(95, y, y + "/6") + bar(150, sum, sum + "/6") + "</svg>";
          out.textContent = x + "/6 + " + y + "/6 = " + sum + "/6" + (x + y > 6 ? " (پر شد)" : "");
        }
        draw();
      });
    }
  };

  LABS["phy-13"] = {
    title: "آزمایش: سری و موازی",
    tip: "حالت مدار را عوض کن و مقاومت معادل را مقایسه کن.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        let series = true;
        const canvas = stage(r, "");
        const out = readout(r);
        const r1 = 6, r2 = 6;
        function paint() {
          if (series) {
            canvas.innerHTML = svgRoot() +
              '<rect class="gold" x="180" y="100" width="80" height="30"/>' +
              '<rect class="gold" x="320" y="100" width="80" height="30"/>' +
              '<line class="accent" x1="100" y1="115" x2="180" y2="115"/>' +
              '<line class="accent" x1="260" y1="115" x2="320" y2="115"/>' +
              '<line class="accent" x1="400" y1="115" x2="520" y2="115"/>' +
              "</svg>";
            out.textContent = "سری: R = " + r1 + "+" + r2 + " = " + (r1 + r2) + " اهم";
          } else {
            canvas.innerHTML = svgRoot() +
              '<rect class="gold" x="220" y="60" width="80" height="30"/>' +
              '<rect class="gold" x="220" y="140" width="80" height="30"/>' +
              '<line class="accent" x1="160" y1="115" x2="160" y2="75"/><line class="accent" x1="160" y1="75" x2="220" y2="75"/>' +
              '<line class="accent" x1="160" y1="115" x2="160" y2="155"/><line class="accent" x1="160" y1="155" x2="220" y2="155"/>' +
              '<line class="accent" x1="300" y1="75" x2="380" y2="75"/><line class="accent" x1="300" y1="155" x2="380" y2="155"/>' +
              '<line class="accent" x1="380" y1="75" x2="380" y2="155"/>' +
              "</svg>";
            out.textContent = "موازی دو تا " + r1 + " اهمی: معادل = " + (r1 / 2) + " اهم";
          }
        }
        controls(r, [
          btn("مدار سری", () => { series = true; paint(); }),
          btn("مدار موازی", () => { series = false; paint(); })
        ]);
        paint();
      });
    }
  };

  LABS["bio-1"] = {
    title: "آزمایش: سلول گیاهی یا جانوری",
    tip: "نوع سلول را عوض کن و ببین دیواره و کلروپلاست ظاهر می‌شوند یا نه.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        let plant = false;
        const canvas = stage(r, "");
        const out = readout(r);
        function paint() {
          let svg = svgRoot();
          if (plant) {
            svg += '<rect class="paper" x="200" y="40" width="240" height="160" rx="10"/>';
            svg += '<ellipse class="soft" cx="320" cy="120" rx="90" ry="55"/>';
            svg += '<circle class="gold" cx="300" cy="110" r="18"/>';
            svg += '<ellipse class="accent-fill" cx="360" cy="145" rx="20" ry="12"/>';
            out.textContent = "گیاهی: دیواره + کلروپلاست + هسته";
          } else {
            svg += '<ellipse class="soft" cx="320" cy="120" rx="110" ry="70" stroke="var(--blue)" stroke-width="3"/>';
            svg += '<circle class="gold" cx="310" cy="115" r="22"/>';
            out.textContent = "جانوری: غشا و هسته؛ بدون دیواره و کلروپلاست";
          }
          canvas.innerHTML = svg + "</svg>";
        }
        controls(r, [
          btn("سلول جانوری", () => { plant = false; paint(); }),
          btn("سلول گیاهی", () => { plant = true; paint(); })
        ]);
        paint();
      });
    }
  };

  LABS["geo-8"] = {
    title: "آزمایش: کانون و رومرکز",
    tip: "عمق کانون را عوض کن و جای رومرکز روی سطح را ببین.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        const canvas = stage(r, "");
        const out = readout(r);
        const d = slider("عمق کانون", 20, 120, 60, draw);
        controls(r, [d.wrap]);
        function draw() {
          const depth = Number(d.input.value);
          canvas.innerHTML = svgRoot() +
            '<line class="dash" x1="60" y1="70" x2="580" y2="70"/>' +
            '<circle class="accent-fill" cx="320" cy="70" r="10"/>' +
            '<circle class="gold" cx="320" cy="' + (70 + depth) + '" r="12"/>' +
            '<line class="thin" x1="320" y1="80" x2="320" y2="' + (70 + depth - 12) + '"/>' +
            "</svg>";
          out.textContent = "رومرکز روی سطح است · کانون " + depth + " واحد زیر سطح";
        }
        draw();
      });
    }
  };

  // ---------- PHYSICS ----------
  LABS["phy-2"] = {
    title: "آزمایش: مسافت و جابه‌جایی",
    tip: "توپ را بفرست و برگردان. مسافت زیاد می‌شود ولی جابه‌جایی می‌تواند صفر شود.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        let x = 80;
        let dist = 0;
        const start = 80;
        const canvas = stage(r, "");
        const out = readout(r);
        function paint() {
          canvas.innerHTML = svgRoot() +
            '<line class="accent" x1="40" y1="140" x2="600" y2="140"/>' +
            '<circle class="accent-fill" cx="' + x + '" cy="140" r="18"/>' +
            '<circle class="gold" cx="' + start + '" cy="140" r="6"/>' +
            "</svg>";
          out.textContent = "مسافت ≈ " + Math.round(dist) + " · جابه‌جایی ≈ " + Math.round(x - start);
        }
        controls(r, [
          btn("برو جلو", () => { dist += 120; x = Math.min(560, x + 120); paint(); }),
          btn("برگرد عقب", () => { dist += Math.abs(x - start); x = start; paint(); }),
          btn("از نو", () => { x = start; dist = 0; paint(); })
        ]);
        paint();
      });
    }
  };

  LABS["phy-3"] = {
    title: "آزمایش: شتاب",
    tip: "شتاب را عوض کن و ببین سرعت چقدر سریع بالا می‌رود.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        let v = 0;
        let t = 0;
        const canvas = stage(r, "");
        const out = readout(r);
        const a = slider("شتاب", 0, 5, 2, () => {});
        controls(r, [
          a.wrap,
          btn("یک ثانیه جلو", () => {
            const acc = Number(a.input.value);
            v += acc;
            t += 1;
            paint();
          }),
          btn("از نو", () => { v = 0; t = 0; paint(); })
        ]);
        function paint() {
          const x = 80 + Math.min(480, v * 18);
          canvas.innerHTML = svgRoot() +
            '<rect class="paper" x="40" y="150" width="560" height="12" rx="6"/>' +
            '<rect class="accent-fill" x="' + x + '" y="110" width="70" height="40" rx="8"/>' +
            "</svg>";
          out.textContent = "t=" + t + "s · v=" + v + " m/s · a=" + a.input.value + " m/s²";
        }
        paint();
      });
    }
  };

  LABS["phy-5"] = {
    title: "آزمایش: F = ma",
    tip: "جرم و نیرو را عوض کن و شتاب را ببین.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        const canvas = stage(r, "");
        const out = readout(r);
        const m = slider("جرم (kg)", 1, 10, 2, draw);
        const f = slider("نیرو (N)", 0, 20, 10, draw);
        controls(r, [m.wrap, f.wrap]);
        function draw() {
          const mass = Number(m.input.value);
          const force = Number(f.input.value);
          const acc = +(force / mass).toFixed(2);
          const w = 40 + mass * 12;
          canvas.innerHTML = svgRoot() +
            '<rect class="soft" x="120" y="' + (140 - w / 2) + '" width="' + w + '" height="' + w + '" rx="10"/>' +
            '<line class="accent" x1="' + (120 + w) + '" y1="140" x2="' + (220 + force * 8) + '" y2="140"/>' +
            "</svg>";
          out.textContent = "a = F/m = " + force + "/" + mass + " = " + acc + " m/s²";
        }
        draw();
      });
    }
  };

  LABS["phy-8"] = {
    title: "آزمایش: تبدیل انرژی روی تپه",
    tip: "توپ را از بالا رها کن و ببین پتانسیل کم و جنبشی زیاد می‌شود.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        let step = 0;
        const path = [0, 1, 2, 3, 4];
        const canvas = stage(r, "");
        const out = readout(r);
        function paint() {
          const h = 100 - step * 20;
          const k = step * 20;
          const x = 100 + step * 90;
          const y = 70 + step * 22;
          canvas.innerHTML = svgRoot() +
            '<path class="accent" d="M60 60 Q200 60 300 140 T560 170" fill="none"/>' +
            '<circle class="accent-fill" cx="' + x + '" cy="' + y + '" r="16"/>' +
            "</svg>";
          out.textContent = "پتانسیل ≈ " + h + " · جنبشی ≈ " + k + " · جمع ≈ " + (h + k);
        }
        controls(r, [
          btn("یک قدم پایین", () => { step = Math.min(4, step + 1); paint(); }),
          btn("برو بالا", () => { step = 0; paint(); })
        ]);
        paint();
      });
    }
  };

  LABS["phy-10"] = {
    title: "آزمایش: موج",
    tip: "بسامد و دامنه را عوض کن. تندی در این مدل ثابت است؛ طول موج عوض می‌شود.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        const canvas = stage(r, "");
        const out = readout(r);
        const f = slider("بسامد", 1, 6, 2, draw);
        const amp = slider("دامنه", 10, 50, 30, draw);
        controls(r, [f.wrap, amp.wrap]);
        function draw() {
          const freq = Number(f.input.value);
          const A = Number(amp.input.value);
          const v = 12;
          const lambda = +(v / freq).toFixed(2);
          let d = "M20 120";
          for (let x = 20; x <= 620; x += 4) {
            const y = 120 - A * Math.sin((x / 640) * freq * Math.PI * 2 * 2);
            d += " L" + x + " " + y.toFixed(1);
          }
          canvas.innerHTML = svgRoot() +
            '<path class="accent" d="' + d + '" fill="none"/>' +
            '<line class="dash" x1="20" y1="120" x2="620" y2="120"/>' +
            "</svg>";
          out.textContent = "v≈" + v + " · f=" + freq + " · λ≈" + lambda + " · دامنه=" + A;
        }
        draw();
      });
    }
  };

  LABS["phy-12"] = {
    title: "آزمایش: قانون اهم",
    tip: "ولتاژ و مقاومت را عوض کن و جریان را ببین.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        const canvas = stage(r, "");
        const out = readout(r);
        const vv = slider("ولتاژ V", 1, 24, 12, draw);
        const rr = slider("مقاومت R", 1, 12, 4, draw);
        controls(r, [vv.wrap, rr.wrap]);
        function draw() {
          const V = Number(vv.input.value);
          const R = Number(rr.input.value);
          const I = +(V / R).toFixed(2);
          const glow = Math.min(40, I * 8);
          canvas.innerHTML = svgRoot() +
            '<rect class="paper" x="80" y="70" width="360" height="100" rx="8"/>' +
            '<rect class="gold" x="250" y="105" width="70" height="30" rx="4"/>' +
            '<circle class="accent-fill" cx="500" cy="120" r="' + (12 + glow / 4) + '" opacity="0.85"/>' +
            "</svg>";
          out.textContent = "I = V/R = " + V + "/" + R + " = " + I + " A";
        }
        draw();
      });
    }
  };

  LABS["phy-14"] = {
    title: "آزمایش: گرم کردن آب",
    tip: "گرما بده و ببین دما بالا می‌رود. جرم بیشتر، گرم شدن کندتر است.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        let temp = 20;
        const canvas = stage(r, "");
        const out = readout(r);
        const mass = slider("جرم آب", 1, 5, 1, () => {});
        function paint() {
          const h = Math.min(140, (temp - 20) * 3);
          canvas.innerHTML = svgRoot() +
            '<rect class="paper" x="160" y="40" width="50" height="150" rx="20"/>' +
            '<rect class="accent-fill" x="168" y="' + (180 - h) + '" width="34" height="' + h + '" rx="14"/>' +
            '<circle class="accent-fill" cx="185" cy="190" r="18"/>' +
            "</svg>";
          out.textContent = "دما ≈ " + temp + "°C · جرم=" + mass.input.value;
        }
        controls(r, [
          mass.wrap,
          btn("کمی گرما بده", () => {
            const m = Number(mass.input.value);
            temp = Math.min(100, temp + Math.max(1, Math.round(8 / m)));
            paint();
          }),
          btn("سرد کن", () => { temp = 20; paint(); })
        ]);
        paint();
      });
    }
  };

  LABS["phy-16"] = {
    title: "آزمایش: فشار و مساحت",
    tip: "مساحت تماس را کم کن؛ با همان نیرو فشار زیاد می‌شود.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        const canvas = stage(r, "");
        const out = readout(r);
        const force = slider("نیرو", 50, 400, 200, draw);
        const area = slider("مساحت", 1, 20, 5, draw);
        controls(r, [force.wrap, area.wrap]);
        function draw() {
          const F = Number(force.input.value);
          const A = Number(area.input.value);
          const P = Math.round(F / A);
          const w = 20 + A * 8;
          canvas.innerHTML = svgRoot() +
            '<rect class="soft" x="' + (320 - w / 2) + '" y="80" width="' + w + '" height="80" rx="8"/>' +
            '<line class="accent" x1="320" y1="40" x2="320" y2="80"/>' +
            "</svg>";
          out.textContent = "P = F/A = " + F + "/" + A + " ≈ " + P;
        }
        draw();
      });
    }
  };

  // ---------- CHEMISTRY (conceptual / safe) ----------
  LABS["chem-1"] = {
    title: "آزمایش تصویری: حالت ماده",
    tip: "دما را بالا ببر و ببین ذره‌ها چطور آزادتر می‌شوند. این فقط مدل است؛ چیزی را روی اجاق آزمایش نکن.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        const canvas = stage(r, "");
        const out = readout(r);
        const t = slider("دما", 0, 2, 0, draw);
        t.input.step = "1";
        controls(r, [t.wrap]);
        function draw() {
          const mode = Number(t.input.value);
          const label = ["جامد", "مایع", "گاز"][mode];
          let dots = "";
          if (mode === 0) {
            for (let i = 0; i < 9; i++) {
              dots += '<circle class="accent-fill" cx="' + (260 + (i % 3) * 30) + '" cy="' + (90 + Math.floor(i / 3) * 30) + '" r="10"/>';
            }
          } else if (mode === 1) {
            [[0, 0], [40, 10], [20, 35], [55, 40], [10, 60], [45, 65]].forEach((p) => {
              dots += '<circle class="accent-fill" cx="' + (270 + p[0]) + '" cy="' + (90 + p[1]) + '" r="10"/>';
            });
          } else {
            [[0, 10], [90, 30], [40, 70], [120, 90], [20, 120], [100, 130]].forEach((p) => {
              dots += '<circle class="accent-fill" cx="' + (240 + p[0]) + '" cy="' + (60 + p[1]) + '" r="10"/>';
            });
          }
          canvas.innerHTML = svgRoot() + '<rect class="paper" x="220" y="40" width="200" height="160" rx="12"/>' + dots + "</svg>";
          out.textContent = "حالت: " + label;
        }
        draw();
      });
    }
  };

  LABS["chem-3"] = {
    title: "آزمایش: ساخت اتم ساده",
    tip: "تعداد پروتون و الکترون را عوض کن. اگر برابر نباشند یون می‌شود.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        const canvas = stage(r, "");
        const out = readout(r);
        const p = slider("پروتون", 1, 12, 6, draw);
        const e = slider("الکترون", 1, 12, 6, draw);
        controls(r, [p.wrap, e.wrap]);
        function draw() {
          const P = Number(p.input.value);
          const E = Number(e.input.value);
          const charge = P - E;
          let electrons = "";
          for (let i = 0; i < E; i++) {
            const ang = (i / E) * Math.PI * 2;
            electrons += '<circle class="paper" cx="' + (320 + Math.cos(ang) * 70) + '" cy="' + (120 + Math.sin(ang) * 55) + '" r="7"/>';
          }
          canvas.innerHTML = svgRoot() +
            '<circle class="soft" cx="320" cy="120" r="80" stroke="var(--blue)" stroke-width="1.5"/>' +
            '<circle class="accent-fill" cx="320" cy="120" r="' + (12 + P) + '"/>' +
            electrons + "</svg>";
          out.textContent = charge === 0 ? "اتم خنثی" : ("یون با بار " + (charge > 0 ? "+" + charge : charge));
        }
        draw();
      });
    }
  };

  LABS["chem-10"] = {
    title: "آزمایش: موازنه با دکمه",
    tip: "ضریب‌ها را عوض کن تا دو طرف معادله آب جور شود. زیروند را دست نزن.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        let a = 1, b = 1, c = 1;
        const canvas = stage(r, "");
        const out = readout(r);
        function paint() {
          const leftH = a * 2, leftO = b * 2, rightH = c * 2, rightO = c;
          const ok = leftH === rightH && leftO === rightO;
          canvas.innerHTML = svgRoot("0 0 640 160") +
            '<text x="320" y="80" text-anchor="middle" font-size="28" class="ink" direction="ltr">' +
            a + " H₂ + " + b + " O₂ → " + c + " H₂O</text></svg>";
          out.textContent = ok ? "آفرین! موازنه درست است." : ("چپ: H=" + leftH + " O=" + leftO + " | راست: H=" + rightH + " O=" + rightO);
        }
        controls(r, [
          btn("H₂ +", () => { a = Math.min(4, a + 1); paint(); }),
          btn("H₂ −", () => { a = Math.max(1, a - 1); paint(); }),
          btn("O₂ +", () => { b = Math.min(4, b + 1); paint(); }),
          btn("O₂ −", () => { b = Math.max(1, b - 1); paint(); }),
          btn("H₂O +", () => { c = Math.min(4, c + 1); paint(); }),
          btn("H₂O −", () => { c = Math.max(1, c - 1); paint(); })
        ]);
        paint();
      });
    }
  };

  LABS["chem-11"] = {
    title: "آزمایش: مقیاس pH",
    tip: "لغزنده را بکش. زیر ۷ اسید، حدود ۷ خنثی، بالای ۷ باز. مواد خانگی را قاطی نکن.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        const canvas = stage(r, "");
        const out = readout(r);
        const s = slider("pH", 0, 14, 7, draw);
        controls(r, [s.wrap]);
        function draw() {
          const ph = Number(s.input.value);
          const x = 50 + (ph / 14) * 540;
          const kind = ph < 7 ? "اسیدی" : ph > 7 ? "بازی" : "خنثی";
          canvas.innerHTML = svgRoot() +
            '<defs><linearGradient id="phlab" x1="0" x2="1"><stop offset="0" stop-color="#d98a7a"/><stop offset="0.5" stop-color="#f4e7a8"/><stop offset="1" stop-color="#7eb8c4"/></linearGradient></defs>' +
            '<rect x="50" y="100" width="540" height="36" rx="18" fill="url(#phlab)"/>' +
            '<circle cx="' + x + '" cy="118" r="14" fill="#1b2836"/>' +
            "</svg>";
          out.textContent = "pH=" + ph + " → " + kind;
        }
        draw();
      });
    }
  };

  LABS["chem-13"] = {
    title: "آزمایش: رقیق کردن",
    tip: "آب اضافه کن. مقدار حل‌شونده همان است، ولی غلظت کم می‌شود.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        let water = 1;
        const solute = 8;
        const canvas = stage(r, "");
        const out = readout(r);
        function paint() {
          const rOuter = 40 + water * 25;
          let dots = "";
          for (let i = 0; i < solute; i++) {
            const ang = (i / solute) * Math.PI * 2;
            const rad = rOuter * 0.45;
            dots += '<circle class="accent-fill" cx="' + (320 + Math.cos(ang) * rad) + '" cy="' + (120 + Math.sin(ang) * rad) + '" r="7"/>';
          }
          canvas.innerHTML = svgRoot() +
            '<circle class="soft" cx="320" cy="120" r="' + rOuter + '" stroke="var(--blue)" stroke-width="2"/>' +
            dots + "</svg>";
          out.textContent = "حل‌شونده=" + solute + " · آب×" + water + " · غلظت نسبی ≈ " + (solute / water).toFixed(1);
        }
        controls(r, [
          btn("آب اضافه کن", () => { water = Math.min(5, water + 1); paint(); }),
          btn("از نو", () => { water = 1; paint(); })
        ]);
        paint();
      });
    }
  };

  // ---------- BIOLOGY ----------
  LABS["bio-3"] = {
    title: "آزمایش: فتوسنتز با نور",
    tip: "چراغ را روشن/خاموش کن. بدون نور، ساخت قند متوقف می‌شود.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        let light = true;
        const canvas = stage(r, "");
        const out = readout(r);
        function paint() {
          canvas.innerHTML = svgRoot() +
            (light ? '<circle class="gold" cx="100" cy="60" r="28"/>' : '<circle class="paper" cx="100" cy="60" r="28"/>') +
            '<ellipse class="accent-fill" cx="320" cy="130" rx="90" ry="50"/>' +
            (light ? '<text x="450" y="120" class="ink" font-size="18">قند + اکسیژن</text>' :
              '<text x="450" y="120" class="muted" font-size="18">ساخت متوقف</text>') +
            "</svg>";
          out.textContent = light ? "نور هست → فتوسنتز فعال" : "تاریکی → فتوسنتز خاموش";
        }
        controls(r, [btn("روشن/خاموش نور", () => { light = !light; paint(); })]);
        paint();
      });
    }
  };

  LABS["bio-6"] = {
    title: "آزمایش: مربع پانت",
    tip: "الل والد دوم را عوض کن و خانه‌های فرزند را ببین.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        let parent2 = "Tt";
        const canvas = stage(r, "");
        const out = readout(r);
        function cells(p2) {
          const a = ["T", "t"];
          const b = p2 === "TT" ? ["T", "T"] : p2 === "tt" ? ["t", "t"] : ["T", "t"];
          const grid = [];
          for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) grid.push(a[i] + b[j]);
          return grid;
        }
        function paint() {
          const g = cells(parent2);
          let svg = svgRoot();
          g.forEach((gene, i) => {
            const x = 180 + (i % 2) * 90;
            const y = 50 + Math.floor(i / 2) * 70;
            const hot = gene === "tt";
            svg += '<rect class="' + (hot ? "gold" : "soft") + '" x="' + x + '" y="' + y + '" width="80" height="60" rx="8"/>';
            svg += '<text x="' + (x + 40) + '" y="' + (y + 38) + '" text-anchor="middle" font-size="22" class="ink" direction="ltr">' + gene + "</text>";
          });
          canvas.innerHTML = svg + "</svg>";
          const dom = g.filter((x) => x !== "tt").length;
          out.textContent = "Tt × " + parent2 + " → غالب‌نما: " + dom + " از ۴ · tt: " + (4 - dom) + " از ۴";
        }
        controls(r, [
          btn("والد دوم: TT", () => { parent2 = "TT"; paint(); }),
          btn("والد دوم: Tt", () => { parent2 = "Tt"; paint(); }),
          btn("والد دوم: tt", () => { parent2 = "tt"; paint(); })
        ]);
        paint();
      });
    }
  };

  LABS["bio-10"] = {
    title: "آزمایش: هرم انرژی",
    tip: "یک سطح بالا برو و ببین انرژی تقریبی چقدر کم می‌شود.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        let level = 0;
        const names = ["علف ۱۰۰۰", "ملخ ۱۰۰", "قورباغه ۱۰", "مار ۱"];
        const canvas = stage(r, "");
        const out = readout(r);
        function paint() {
          let poly = "";
          for (let i = 0; i < 4; i++) {
            const top = 40 + i * 40;
            const half = 180 - i * 35;
            const active = i === level;
            poly += '<rect class="' + (active ? "accent-fill" : "soft") + '" x="' + (320 - half) + '" y="' + top +
              '" width="' + (half * 2) + '" height="34" rx="6"/>';
            poly += '<text x="320" y="' + (top + 24) + '" text-anchor="middle" font-size="14" class="' + (active ? "soft" : "ink") + '">' + names[i] + "</text>";
          }
          canvas.innerHTML = svgRoot() + poly + "</svg>";
          out.textContent = "سطح فعلی: " + names[level] + " · در هر پله انرژی خیلی کمتر می‌شود";
        }
        controls(r, [
          btn("برو سطح بالاتر", () => { level = Math.min(3, level + 1); paint(); }),
          btn("برگرد پایه", () => { level = 0; paint(); })
        ]);
        paint();
      });
    }
  };

  LABS["bio-12"] = {
    title: "آزمایش: استتار و بقا",
    tip: "پس‌زمینه را عوض کن. پروانهٔ هم‌رنگ بهتر دیده نمی‌شود.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        let dark = false;
        const canvas = stage(r, "");
        const out = readout(r);
        function paint() {
          const bg = dark ? "#3d4a3f" : "#e8e0c8";
          canvas.innerHTML = svgRoot() +
            '<rect x="40" y="40" width="560" height="160" rx="12" fill="' + bg + '"/>' +
            '<ellipse cx="200" cy="120" rx="28" ry="18" fill="#f5f0e0" stroke="#1b2836"/>' +
            '<ellipse cx="400" cy="120" rx="28" ry="18" fill="#2a332c" stroke="#1b2836"/>' +
            "</svg>";
          out.textContent = dark
            ? "محیط تیره: پروانهٔ تیره بهتر پنهان است"
            : "محیط روشن: پروانهٔ روشن بهتر پنهان است";
        }
        controls(r, [btn("عوض کردن محیط", () => { dark = !dark; paint(); })]);
        paint();
      });
    }
  };

  // ---------- GEOLOGY ----------
  LABS["geo-1"] = {
    title: "آزمایش: لایه‌های زمین",
    tip: "روی هر لایه بزن و اسمش را ببین.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        const layers = [
          { name: "پوسته", r: 96, c: "gold" },
          { name: "گوشته", r: 70, c: "soft" },
          { name: "هستهٔ بیرونی", r: 40, c: "paper" },
          { name: "هستهٔ درونی", r: 18, c: "accent-fill" }
        ];
        const canvas = stage(r, "");
        const out = readout(r);
        out.textContent = "یک لایه را لمس کن";
        function paint(active) {
          let svg = svgRoot();
          layers.forEach((L, i) => {
            svg += '<circle class="' + L.c + '" cx="240" cy="120" r="' + L.r + '" data-i="' + i + '" style="cursor:pointer"/>';
          });
          canvas.innerHTML = svg + "</svg>";
          canvas.querySelectorAll("circle").forEach((cir) => {
            cir.addEventListener("click", () => {
              const i = Number(cir.getAttribute("data-i"));
              out.textContent = "این لایه: " + layers[i].name;
              paint(i);
            });
          });
          if (active != null) {
            // highlight handled by readout
          }
        }
        paint();
      });
    }
  };

  LABS["geo-7"] = {
    title: "آزمایش: حرکت صفحه‌ها",
    tip: "نوع مرز را عوض کن و جهت حرکت را ببین.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        let mode = "divergent";
        const canvas = stage(r, "");
        const out = readout(r);
        function paint() {
          let arrows = "";
          if (mode === "divergent") {
            arrows = '<line class="accent" x1="260" y1="120" x2="160" y2="120"/><line class="accent" x1="380" y1="120" x2="480" y2="120"/>';
            out.textContent = "واگرا: صفحه‌ها از هم دور می‌شوند";
          } else if (mode === "convergent") {
            arrows = '<line class="accent" x1="180" y1="120" x2="280" y2="120"/><line class="accent" x1="460" y1="120" x2="360" y2="120"/>';
            out.textContent = "همگرا: صفحه‌ها به هم نزدیک می‌شوند";
          } else {
            arrows = '<line class="accent" x1="180" y1="100" x2="460" y2="100"/><line class="accent" x1="460" y1="140" x2="180" y2="140"/>';
            out.textContent = "امتدادلغز: کنار هم می‌لغزند";
          }
          canvas.innerHTML = svgRoot() +
            '<rect class="paper" x="120" y="70" width="180" height="100" rx="8"/>' +
            '<rect class="soft" x="340" y="70" width="180" height="100" rx="8"/>' +
            arrows + "</svg>";
        }
        controls(r, [
          btn("واگرا", () => { mode = "divergent"; paint(); }),
          btn("همگرا", () => { mode = "convergent"; paint(); }),
          btn("امتدادلغز", () => { mode = "transform"; paint(); })
        ]);
        paint();
      });
    }
  };

  LABS["geo-10"] = {
    title: "آزمایش: چرخهٔ آب",
    tip: "قدم‌به‌قدم مرحله‌ها را جلو ببر.",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        const steps = ["تبخیر از دریا", "ساخته شدن ابر (میعان)", "بارش", "رواناب به رود"];
        let i = 0;
        const canvas = stage(r, "");
        const out = readout(r);
        function paint() {
          canvas.innerHTML = svgRoot() +
            '<circle class="gold" cx="100" cy="50" r="22"/>' +
            '<ellipse class="paper" cx="280" cy="50" rx="55" ry="24"/>' +
            '<path class="accent" d="M60 180 C160 150 260 190 360 160 S520 150 580 180" fill="none"/>' +
            '<circle class="accent-fill" cx="' + (120 + i * 120) + '" cy="' + (80 + (i % 2) * 40) + '" r="12"/>' +
            "</svg>";
          out.textContent = "مرحله " + (i + 1) + ": " + steps[i];
        }
        controls(r, [
          btn("مرحله بعد", () => { i = (i + 1) % steps.length; paint(); }),
          btn("از اول", () => { i = 0; paint(); })
        ]);
        paint();
      });
    }
  };

  LABS["geo-11"] = {
    title: "آزمایش: هوازدگی درجا",
    tip: "چند بار ضربه بزن؛ سنگ خرد می‌شود ولی هنوز جایش است (هوازدگی، نه فرسایش).",
    mount(root) {
      shell(root, this.title, this.tip, (r) => {
        let cracks = 0;
        const canvas = stage(r, "");
        const out = readout(r);
        function paint() {
          let bits = '<rect class="soft" x="240" y="70" width="160" height="110" rx="8"/>';
          for (let i = 0; i < cracks; i++) {
            bits += '<line class="thin" x1="' + (260 + i * 20) + '" y1="80" x2="' + (250 + i * 18) + '" y2="170"/>';
          }
          canvas.innerHTML = svgRoot() + bits + "</svg>";
          out.textContent = cracks === 0 ? "سنگ سالم" : ("ترک‌ها: " + cracks + " · هنوز حمل نشده = هوازدگی");
        }
        controls(r, [
          btn("یخ/ریشه فشار بدهد", () => { cracks = Math.min(6, cracks + 1); paint(); }),
          btn("از نو", () => { cracks = 0; paint(); })
        ]);
        paint();
      });
    }
  };

  window.LABS = LABS;
  window.mountLab = function (key, root) {
    const lab = LABS[key];
    if (!lab || !root) return false;
    lab.mount(root);
    return true;
  };
})();
