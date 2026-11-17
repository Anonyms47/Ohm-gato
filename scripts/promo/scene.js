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

  // ---------- cartes produits ----------
  const cards = $("cards");
  const hero = document.createElement("div");
  hero.className = "card";
  cards.appendChild(hero);
  const heroLayers = S.heroes.map((p) => {
    const img = document.createElement("img");
    img.src = p.img;
    const name = document.createElement("div");
    name.className = "t name";
    name.textContent = p.name;
    const desc = document.createElement("div");
    desc.className = "t desc";
    desc.textContent = p.desc;
    hero.append(img, name, desc);
    return { img, name, desc };
  });
  const cells = S.grid.map((p) => {
    const c = document.createElement("div");
    c.className = "card cell";
    const img = document.createElement("img");
    img.src = p.img;
    const name = document.createElement("div");
    name.className = "t name";
    name.textContent = p.name;
    c.append(img, name);
    cards.appendChild(c);
    return { c, img, name };
  });
  const pill = $("pill");
  pill.textContent = S.pillText;
  const tagline = $("tagline");
  tagline.textContent = S.tagline;

  const CARD = { x: 300, y: 230, w: 1320, h: 660, r: 44 };
  const DIA = S.diamond; // centre et côté du losange officiel dans la scène
  const PILL = { x: 560, y: 690, w: 800, h: 108, r: 54 };
  const gridRect = (i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    return { x: 120 + col * (397.5 + 30), y: 200 + row * (350 + 34), w: 397.5, h: 350, r: 30 };
  };
  const place = (el, r) => {
    el.style.left = r.x + "px";
    el.style.top = r.y + "px";
    el.style.width = r.w + "px";
    el.style.height = r.h + "px";
    el.style.borderRadius = r.r + "px";
  };
  const lerpRect = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k), r: lerp(a.r, b.r, k) });

  function layoutHero(t) {
    const T = S.times;
    hero.style.display = t >= T.card && t < T.grid + 0.02 ? "block" : "none";
    if (hero.style.display === "none") return;
    // losange rose → carte (rotation 45° → 0°, coins vifs → arrondis, rose → crème)
    const k = ease((t - T.card) / 1.4);
    const side = DIA.side;
    const w = lerp(side, CARD.w, k);
    const h = lerp(side, CARD.h, k);
    const cx = lerp(DIA.cx, CARD.x + CARD.w / 2, k);
    const cy = lerp(DIA.cy, CARD.y + CARD.h / 2, k);
    hero.style.left = cx - w / 2 + "px";
    hero.style.top = cy - h / 2 + "px";
    hero.style.width = w + "px";
    hero.style.height = h + "px";
    hero.style.borderRadius = lerp(0, CARD.r, k) + "px";
    hero.style.transform = `rotate(${lerp(45, 0, k)}deg)`;
    hero.style.background = mixColor("dca7ae", "fbf4ea", k);
    // produits successifs : chaque photo se révèle par un disque qui grandit, le texte glisse
    const start = T.card + 1.4;
    heroLayers.forEach((L, i) => {
      const ti = start + i * T.heroStep;
      const inK = i === 0 ? ease((t - T.card - 0.9) / 0.6) : ease((t - ti) / 0.7);
      const outK = i === heroLayers.length - 1 ? 0 : ease((t - (ti + T.heroStep)) / 0.7);
      const vis = inK > 0 && outK < 1;
      for (const el of [L.img, L.name, L.desc]) el.style.display = vis ? "block" : "none";
      if (!vis) return;
      const cw = parseFloat(hero.style.width);
      const ch = parseFloat(hero.style.height);
      L.img.style.left = "0px";
      L.img.style.top = "0px";
      L.img.style.width = cw * 0.5 + "px";
      L.img.style.height = ch + "px";
      L.img.style.zIndex = String(i + 1);
      L.img.style.clipPath = `circle(${inK * 75}% at 50% 50%)`;
      const slideIn = (1 - inK) * 60;
      const slideOut = -outK * 60;
      for (const [el, y] of [[L.name, ch * 0.3], [L.desc, ch * 0.3 + 170]]) {
        el.style.left = cw * 0.5 + 70 + slideIn + slideOut + "px";
        el.style.top = y + "px";
        el.style.width = cw * 0.5 - 120 + "px";
        el.style.opacity = String(Math.min(clamp((inK - 0.45) / 0.55), 1 - clamp(outK / 0.45)));
        el.style.zIndex = "20";
      }
    });
  }

  function layoutGrid(t) {
    const T = S.times;
    const fromHero = { ...CARD };
    cells.forEach((C, i) => {
      const k = ease((t - T.grid - i * 0.05) / 1.2);
      const fin = ease((t - T.final - (cells.length - 1 - i) * 0.04) / 1.3);
      const show = t >= T.grid && fin < 1;
      C.c.style.display = show ? "block" : "none";
      if (!show) return;
      const g = gridRect(i);
      let r = lerpRect(fromHero, g, k);
      r = lerpRect(r, PILL, fin);
      place(C.c, r);
      C.c.style.background = mixColor("fbf4ea", "3a2418", fin);
      C.img.style.left = "0px";
      C.img.style.top = "0px";
      C.img.style.width = r.w + "px";
      C.img.style.height = r.h * 0.78 + "px";
      C.img.style.opacity = String(1 - clamp(fin * 1.6));
      C.name.style.left = "22px";
      C.name.style.top = r.h * 0.78 + 14 + "px";
      C.name.style.width = r.w - 30 + "px";
      C.name.style.opacity = String(clamp((k - 0.6) / 0.4) * (1 - clamp(fin * 2)));
      C.c.style.zIndex = String(i === S.heroes.length - 1 ? 40 : 10 + i);
    });
    const pk = clamp((t - T.final - 1.25) / 0.35);
    pill.style.display = pk > 0 ? "flex" : "none";
    place(pill, PILL);
    pill.style.background = "#3a2418";
    pill.style.color = `rgba(245,233,214,${ease((t - T.final - 1.3) / 0.5)})`;
    tagline.style.top = "585px";
    tagline.style.opacity = String(ease((t - T.final - 0.7) / 0.7));
    tagline.style.transform = `translateY(${(1 - ease((t - T.final - 0.7) / 0.7)) * 20}px)`;
  }

  window.render = (t, brand) => {
    const T = S.times;
    // fond : blanc (conversation) → crème (marque)
    const stage = $("stage");
    stage.style.background = t < T.toBrand + 1.4 ? "#ffffff" : "#F5E9D6";
    // conversation
    chat.style.display = t < T.toBrand + 1.4 ? "flex" : "none";
    if (chat.style.display === "flex") {
      renderChat(Math.min(t, T.toBrand));
      chat.style.opacity = String(1 - clamp((t - T.toBrand) / 0.5));
    }
    // la bulle du lien s'ouvre en plein écran
    const mo = $("morph");
    const mk = ease((t - T.toBrand) / 1.4);
    if (t >= T.toBrand && t < T.toBrand + 1.4) {
      const last = rows[rows.length - 1].b.getBoundingClientRect();
      const from = { x: last.left, y: last.top, w: last.width, h: last.height, r: 30 };
      if (!window.__from) window.__from = from;
      const f = window.__from;
      mo.style.display = "block";
      place(mo, lerpRect(f, { x: 0, y: 0, w: 1920, h: 1080, r: 0 }, mk));
      mo.style.background = mixColor("1f8bff", "f5e9d6", mk);
    } else mo.style.display = "none";
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
    layoutHero(t);
    layoutGrid(t);
  };
})();
