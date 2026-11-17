// Rendu déterministe de la vidéo de présentation : window.render(t, brand) dessine l'image au temps t (s).
// Les tracés du logotype et du symbole (écriture, morphing) sont calculés côté Node et passés dans `brand`.
(() => {
  const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ease = (x) => {
    const t = clamp(x);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  const mixColor = (a, b, t) => {
    const pa = a.match(/\w\w/g).map((h) => parseInt(h, 16));
    const pb = b.match(/\w\w/g).map((h) => parseInt(h, 16));
    return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(",")})`;
  };
  const $ = (id) => document.getElementById(id);

  const S = window.__SCENE;
  const chat = $("chat");
  const rows = [];

  // ---------- conversation ----------
  S.msgs.forEach((m, i) => {
    const row = document.createElement("div");
    row.className = "row " + m.side;
    const b = document.createElement("div");
    const next = S.msgs[i + 1];
    b.className = "b" + (m.link ? " link" : "") + (!next || next.side !== m.side ? " tail" : "");
    const txt = document.createElement("span");
    txt.className = "txt";
    txt.textContent = m.text;
    b.appendChild(txt);
    if (m.side === "l") {
      const dots = document.createElement("div");
      dots.className = "dots";
      dots.innerHTML = "<i></i><i></i><i></i>";
      b.appendChild(dots);
    }
    row.appendChild(b);
    let meta = null;
    if (m.meta) {
      meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = m.meta;
      row.appendChild(meta);
    }
    chat.appendChild(row);
    const gap = next && next.side === m.side ? 6 : 22;
    const box = b.getBoundingClientRect();
    rows.push({ m, row, b, txt, dots: b.querySelector(".dots"), meta, gap, w: Math.ceil(box.width) + 2, h: Math.ceil(box.height), mh: meta ? meta.offsetHeight + 6 : 0 });
  });
  const TYPE_W = 104;
  const TYPE_H = 62;

  function renderChat(t) {
    renderRows(t);
    // comme une messagerie : la conversation commence en haut puis défile quand l'écran est plein
    const avail = chat.clientHeight;
    const inner = rows.reduce((sum, r) => sum + parseFloat(r.row.style.height || "0"), 0);
    chat.firstChild.style.marginTop = "0px";
    for (const r of rows) r.row.style.transform = `translateY(${-Math.max(0, inner - avail)}px)`;
  }
  function renderRows(t) {
    for (const r of rows) {
      const { m, row, b, txt, dots } = r;
      if (m.side === "r") {
        const p = easeOut((t - m.t) / 0.34);
        row.style.height = (r.h + r.gap) * p + "px";
        b.style.opacity = clamp((t - m.t) / 0.12);
        b.style.transform = `translateY(${(1 - p) * 26}px) scale(${0.82 + 0.18 * p})`;
        b.style.width = r.w + "px";
        b.style.height = r.h + "px";
        txt.style.opacity = 1;
        if (r.meta) {
          const q = easeOut((t - m.t - 0.7) / 0.3);
          r.meta.style.opacity = q;
          row.style.height = (r.h + r.gap) * p + r.mh * q + "px";
        }
      } else {
        const ts = m.t - m.typing;
        const pin = easeOut((t - ts) / 0.28);
        const q = ease((t - m.t) / 0.4);
        const w = lerp(TYPE_W, r.w, q);
        const h = lerp(TYPE_H, r.h, q);
        row.style.height = (h + r.gap) * pin + "px";
        b.style.opacity = clamp((t - ts) / 0.15);
        b.style.transform = `scale(${0.7 + 0.3 * pin})`;
        b.style.width = w + "px";
        b.style.height = h + "px";
        txt.style.opacity = clamp((t - m.t - 0.34) / 0.18);
        dots.style.opacity = 1 - clamp((t - m.t) / 0.14);
        [...dots.children].forEach((d, k) => {
          const ph = Math.sin((t - ts) * 2 * Math.PI * 1.3 - k * 0.9);
          d.style.opacity = String(0.35 + 0.65 * Math.max(0, ph));
        });
      }
      if (t < (m.side === "l" ? m.t - m.typing : m.t)) row.style.height = "0px";
    }
  }

  // ---------- site : navigateur, téléphone, titres ----------
  const browser = $("browser");
  const phone = $("phone");
  const homeImg = $("homeImg");
  const carteImg = $("carteImg");
  const barImg = $("barImg");
  homeImg.src = S.captures.home;
  carteImg.src = S.captures.carte;
  barImg.src = S.captures.bar;
  const pill = $("pill");
  pill.textContent = S.pillText;
  const tagline = $("tagline");
  tagline.textContent = S.tagline;

  const BROWSER = { x: 110, y: 110, w: 1180, h: 860, r: 24 };
  const PHONE = { x: 1200, y: 95, w: 424, h: 890, r: 64 };
  const PILL = { x: 560, y: 700, w: 800, h: 108, r: 54 };
  const FULL = { x: 0, y: 0, w: 1920, h: 1080, r: 0 };
  const place = (el, r) => {
    el.style.left = r.x + "px";
    el.style.top = r.y + "px";
    el.style.width = r.w + "px";
    el.style.height = r.h + "px";
    el.style.borderRadius = r.r + "px";
  };
  const lerpRect = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k), r: lerp(a.r, b.r, k) });
  // défilement par étapes (temps local → position), transitions adoucies
  const keyed = (keys, u) => {
    if (u <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1] = keys[i];
      const [t0, v0] = keys[i - 1];
      if (u <= t1) return lerp(v0, v1, ease((u - t0) / (t1 - t0)));
    }
    return keys[keys.length - 1][1];
  };

  // titres : chaque lettre monte en place, puis repart vers le haut
  const caps = $("caps");
  const capEls = S.captions.map((c) => {
    const el = document.createElement("div");
    el.className = "cap";
    el.style.left = c.x + "px";
    el.style.top = c.y + "px";
    const letters = [];
    c.lines.forEach((line, li) => {
      if (li) el.appendChild(document.createElement("br"));
      line.split(/(\s+)/).forEach((word) => {
        const w = document.createElement("span");
        w.className = "w" + (c.accent && c.accent.includes(word) ? " accent" : "");
        for (const ch of word) {
          const i = document.createElement("i");
          i.textContent = ch;
          w.appendChild(i);
          letters.push(i);
        }
        el.appendChild(w);
      });
    });
    caps.appendChild(el);
    return { c, el, letters };
  });
  function renderCaptions(t) {
    for (const { c, el, letters } of capEls) {
      const vis = t >= c.t0 - 0.05 && t <= c.t1 + 0.8;
      el.style.display = vis ? "block" : "none";
      if (!vis) continue;
      letters.forEach((L, i) => {
        const kin = easeOut((t - c.t0 - i * 0.028) / 0.55);
        const kout = ease((t - c.t1 - i * 0.012) / 0.45);
        L.style.transform = `translateY(${(1 - kin) * 70 - kout * 60}px) scale(${0.92 + 0.08 * kin})`;
        L.style.opacity = String(Math.min(kin, 1 - kout));
      });
    }
  }

  function renderSite(t) {
    const T = S.times;
    // navigateur : apparaît à la fin de l'ouverture de la bulle, se transforme en téléphone
    const showB = t >= T.browser + 1.25 && t < T.phone + 0.02;
    browser.style.display = showB ? "block" : "none";
    if (showB) {
      place(browser, BROWSER);
      const u = t - T.tour;
      const scale = (BROWSER.w - 4) / 1440;
      homeImg.style.width = BROWSER.w - 4 + "px";
      homeImg.style.transform = `translateY(${-keyed(S.homeScroll, u) * scale}px)`;
      homeImg.style.opacity = String(ease((t - T.browser - 1.2) / 0.45));
    }
    // fenêtre → téléphone → plein écran crème
    const showP = t >= T.phone && t < T.brand + 1.25;
    phone.style.display = showP ? "block" : "none";
    if (showP) {
      const k = ease((t - T.phone) / 1.3);
      const kf = ease((t - T.brand) / 1.2);
      let r = lerpRect(BROWSER, PHONE, k);
      r = lerpRect(r, FULL, kf);
      place(phone, r);
      phone.style.background = mixColor(k < 1 ? "e4d2b8" : "3a2418", "3a2418", k);
      if (kf > 0) phone.style.background = mixColor("3a2418", "f5e9d6", kf);
      const border = lerp(2, 12, k) * (1 - kf);
      const view = phone.querySelector(".view");
      view.style.left = border + "px";
      view.style.top = border + "px";
      view.style.right = border + "px";
      view.style.bottom = border + "px";
      view.style.borderRadius = Math.max(0, r.r - border) + "px";
      view.style.background = mixColor("fbf4ea", "f5e9d6", k);
      const innerW = r.w - 2 * border;
      const sc = innerW / 390;
      const content = clamp((t - T.phone - 1.0) / 0.4) * (1 - clamp(kf / 0.35));
      carteImg.style.width = innerW + "px";
      carteImg.style.transform = `translateY(${-keyed(S.carteScroll, t - T.phoneTour) * sc}px)`;
      carteImg.style.opacity = String(content);
      barImg.style.width = innerW + "px";
      barImg.style.opacity = String(content);
    }
  }

  function renderFinal(t) {
    const T = S.times;
    const k = ease((t - T.final - 0.6) / 0.8);
    tagline.style.display = k > 0 ? "block" : "none";
    tagline.style.top = "585px";
    tagline.style.opacity = String(k);
    tagline.style.transform = `translateY(${(1 - k) * 24}px)`;
    // le bouton naît du losange rose et s'étire
    const kp = ease((t - T.final - 1.0) / 0.9);
    pill.style.display = kp > 0 ? "flex" : "none";
    if (kp > 0) {
      const w = lerp(108, PILL.w, kp);
      place(pill, { x: 960 - w / 2, y: PILL.y, w, h: PILL.h, r: PILL.r });
      pill.style.color = `rgba(245,233,214,${clamp((kp - 0.6) / 0.4)})`;
    }
  }

  window.render = (t, brand) => {
    const T = S.times;
    const stage = $("stage");
    const white = t < T.browser + 0.6;
    stage.style.background = white ? "#ffffff" : "#F5E9D6";
    if (t >= T.browser && t < T.browser + 1.3) stage.style.background = mixColor("ffffff", "f5e9d6", ease((t - T.browser) / 1.3));
    // conversation
    chat.style.display = t < T.browser + 1.3 ? "flex" : "none";
    if (chat.style.display === "flex") {
      renderChat(Math.min(t, T.browser));
      chat.style.opacity = String(1 - clamp((t - T.browser) / 0.45));
    }
    // la bulle du lien devient la fenêtre du site
    const mo = $("morph");
    if (t >= T.browser && t < T.browser + 1.3) {
      const mk = ease((t - T.browser) / 1.3);
      if (!window.__from) {
        const last = rows[rows.length - 1].b.getBoundingClientRect();
        window.__from = { x: last.left, y: last.top, w: last.width, h: last.height, r: 30 };
      }
      mo.style.display = "block";
      place(mo, lerpRect(window.__from, BROWSER, mk));
      mo.style.background = mixColor("1f8bff", "fbf4ea", mk);
      mo.style.border = mk > 0.5 ? "2px solid #e4d2b8" : "none";
    } else mo.style.display = "none";
    renderSite(t);
    renderCaptions(t);
    // logotype / symbole
    const body = $("body");
    const dia = $("dia");
    if (brand) {
      $("brand").style.display = "block";
      body.setAttribute("d", brand.d);
      if (brand.transform) body.setAttribute("transform", brand.transform);
      else body.removeAttribute("transform");
      dia.setAttribute("d", S.diamondD);
      dia.setAttribute("transform", S.diamondTransform);
      dia.setAttribute("opacity", String(brand.diamond ?? 0));
      $("symG").setAttribute("transform", brand.group ?? "");
    } else $("brand").style.display = "none";
    renderFinal(t);
  };
})();
