'use strict';

(() => {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const CLASS_IDS = Object.keys(CLASSES);
  const SITE = location.host ? location.host + location.pathname.replace(/index\.html$/, '') : 'antonybo056.github.io/whichCharacter/';

  const state = {
    name: '', img: null, crop: null, analysis: null,
    answers: [], q: 0, result: null, card: null, portrait: null, shared: false,
  };

  /* ---------- Kahraman Salonu (bu cihazda oluşturulan kahramanlar) ---------- */
  const Roster = (() => {
    const KEY = 'wc-roster-v1', MAX = 12;
    const read = () => {
      try {
        const a = JSON.parse(localStorage.getItem(KEY) || '[]');
        return Array.isArray(a) ? a : [];
      } catch (e) { return []; }
    };
    const write = (list) => {
      try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
    };
    function list() {
      return read().map((e) => ({ ...e, result: decodeResult(e.code) })).filter((e) => e.result);
    }
    function save(code, portrait, source) {
      const id = Portrait.hash(code).toString(36);
      const all = read();
      const prev = all.find((e) => e.id === id);
      let thumb = prev?.portrait || null;
      if (portrait) {
        const c = document.createElement('canvas');
        c.width = c.height = 360;
        c.getContext('2d').drawImage(portrait, 0, 0, 360, 360);
        thumb = c.toDataURL('image/jpeg', 0.82);
      }
      const next = all.filter((e) => e.id !== id);
      next.unshift({ id, code, portrait: thumb, source, w: prev?.w || 0, l: prev?.l || 0, t: Date.now() });
      next.length = Math.min(next.length, MAX);
      // Depolama dolarsa en eski kahramanların portrelerinden vazgeç
      for (let i = next.length - 1; !write(next) && i >= 0; i--) next[i].portrait = null;
      return id;
    }
    function remove(id) { write(read().filter((e) => e.id !== id)); }
    function record(id, won) {
      const all = read();
      const e = all.find((x) => x.id === id);
      if (e) { if (won) e.w++; else e.l++; write(all); }
    }
    return { list, save, remove, record };
  })();

  /* ---------- Ekran yönetimi ---------- */
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${id}`));
    window.scrollTo(0, 0);
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function setTheme(cls) {
    const root = document.documentElement.style;
    root.setProperty('--accent', cls ? cls.accent : '#b77cff');
    root.setProperty('--accent-soft', Portrait.rgba(cls ? cls.accent : '#b77cff', 0.16));
    Background.setColor(cls ? cls.accent : null);
  }

  /* ---------- Arka plan parçacıkları ---------- */
  const Background = (() => {
    const c = $('#bg');
    const x = c.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W, H, parts = [], color = [227, 192, 122];
    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      c.width = W * dpr; c.height = H * dpr;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(clamp(W * H / 16000, 30, 110));
      parts = Array.from({ length: n }, () => spawn(true));
    }
    function spawn(any) {
      return {
        x: Math.random() * W, y: any ? Math.random() * H : H + 10,
        r: 0.5 + Math.random() * 1.8, v: 0.15 + Math.random() * 0.5,
        a: 0.2 + Math.random() * 0.6, p: Math.random() * Math.PI * 2,
      };
    }
    function frame(t) {
      x.clearRect(0, 0, W, H);
      for (const p of parts) {
        if (!reduce) { p.y -= p.v; p.x += Math.sin(t / 2000 + p.p) * 0.2; }
        if (p.y < -10) Object.assign(p, spawn(false));
        const tw = 0.6 + 0.4 * Math.sin(t / 700 + p.p);
        x.beginPath();
        x.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${p.a * tw})`;
        x.shadowColor = `rgb(${color[0]},${color[1]},${color[2]})`;
        x.shadowBlur = 8;
        x.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        x.fill();
      }
      if (!reduce) requestAnimationFrame(frame);
    }
    addEventListener('resize', resize);
    resize();
    requestAnimationFrame(frame);
    return {
      setColor(hex) {
        const n = parseInt((hex || '#e3c07a').slice(1), 16);
        color = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        if (reduce) requestAnimationFrame(frame);
      },
    };
  })();

  /* ---------- Giriş ---------- */
  const strip = $('#class-strip');
  CLASS_IDS.forEach((id, i) => {
    const s = el('span', null, CLASSES[id].emoji);
    s.title = CLASSES[id].name;
    s.style.animationDelay = `${i * 60}ms`;
    strip.append(s);
  });
  let sigilIndex = 0;
  setInterval(() => {
    sigilIndex = (sigilIndex + 1) % CLASS_IDS.length;
    $('#sigil-emoji').textContent = CLASSES[CLASS_IDS[sigilIndex]].emoji;
  }, 1800);

  $('#btn-start').addEventListener('click', () => {
    show('photo');
    setTimeout(() => $('#hero-name').focus(), 300);
  });

  /* ---------- Fotoğraf ---------- */
  const fileInput = $('#file-input');
  const dz = $('#dropzone');

  async function setPhoto(src) {
    try {
      const img = await Portrait.loadImage(src);
      state.img = img;
      state.crop = null;
      const prev = $('#photo-preview');
      prev.src = img.src;
      prev.hidden = false;
      $('#dz-empty').hidden = true;
      $('#btn-clear-photo').hidden = false;
      dz.classList.add('has-photo');
      $('#photo-hint').textContent = '✨ Harika! Bu fotoğraftan kahraman portren oluşturulacak.';
    } catch (e) {
      toast('Bu dosya okunamadı. JPG veya PNG bir fotoğraf dene.');
    }
  }
  function clearPhoto() {
    state.img = null;
    state.crop = null;
    const prev = $('#photo-preview');
    prev.hidden = true;
    prev.removeAttribute('src');
    $('#dz-empty').hidden = false;
    $('#btn-clear-photo').hidden = true;
    dz.classList.remove('has-photo');
    fileInput.value = '';
    $('#photo-hint').textContent = 'Fotoğraf eklemezsen sınıfının amblemiyle bir portre oluşturulur.';
  }

  $('#btn-upload').addEventListener('click', () => fileInput.click());
  dz.addEventListener('click', (e) => { if (e.target.id !== 'btn-clear-photo') fileInput.click(); });
  dz.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) setPhoto(fileInput.files[0]); });
  $('#btn-clear-photo').addEventListener('click', (e) => { e.stopPropagation(); clearPhoto(); });
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', (e) => {
    const f = [...(e.dataTransfer?.files || [])].find((file) => file.type.startsWith('image/'));
    if (f) setPhoto(f);
  });

  $('#btn-photo-back').addEventListener('click', () => show('intro'));
  $('#btn-photo-next').addEventListener('click', () => {
    state.name = $('#hero-name').value.trim().replace(/\s+/g, ' ');
    state.q = 0;
    state.answers = [];
    show('quiz');
    renderQuestion();
  });
  $('#hero-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-photo-next').click(); });

  /* ---------- Kamera ---------- */
  let stream = null;
  const modal = $('#camera-modal');
  const video = $('#cam-video');
  async function openCamera() {
    modal.hidden = false;
    $('#cam-error').hidden = true;
    $('#btn-cam-shot').disabled = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
      video.srcObject = stream;
      $('#btn-cam-shot').disabled = false;
    } catch (e) {
      const err = $('#cam-error');
      err.textContent = 'Kameraya erişilemedi. Tarayıcı izinlerini kontrol et ya da fotoğraf yükle.';
      err.hidden = false;
    }
  }
  function closeCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    modal.hidden = true;
  }
  $('#btn-camera').addEventListener('click', openCamera);
  $('#btn-cam-cancel').addEventListener('click', closeCamera);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeCamera(); });
  $('#btn-cam-shot').addEventListener('click', () => {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w) return;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    x.translate(w, 0);
    x.scale(-1, 1);
    x.drawImage(video, 0, 0);
    closeCamera();
    setPhoto(c.toDataURL('image/jpeg', 0.92));
  });

  /* ---------- Sorular ---------- */
  const qBody = $('#q-body');

  function renderQuestion() {
    const q = QUESTIONS[state.q];
    const total = QUESTIONS.length;
    $('#progress-bar').style.width = `${(state.q / total) * 100}%`;
    $('#q-count').textContent = `${state.q + 1} / ${total}`;
    qBody.replaceChildren(
      el('div', 'q-icon', q.icon),
      el('h2', null, q.title),
      el('p', 'q-sub', q.sub),
    );

    if (q.type === 'slider') {
      const box = el('div', 'slider-box');
      const labels = el('div', 'slider-labels');
      const L = el('span', null, q.left), R = el('span', null, q.right);
      labels.append(L, R);
      const range = el('input');
      range.type = 'range';
      range.min = 0;
      range.max = 100;
      range.value = state.answers[state.q] ?? 50;
      range.setAttribute('aria-label', 'Hız ile güç arasındaki denge');
      const read = el('p', 'slider-read');
      const update = () => {
        const v = +range.value;
        L.classList.toggle('lead-side', v < 45);
        R.classList.toggle('lead-side', v > 55);
        read.textContent = v < 20 ? '🌪️ Şimşek kadar hızlı'
          : v < 45 ? '🍃 Çevik ve atik'
          : v <= 55 ? '⚖️ Mükemmel denge'
          : v <= 80 ? '🪨 Sağlam ve güçlü'
          : '🏔️ Dağları yerinden oynatan';
      };
      range.addEventListener('input', update);
      range.addEventListener('keydown', (e) => { if (e.key === 'Enter') answer(+range.value); });
      update();
      const next = el('button', 'btn btn-primary', 'Devam →');
      next.type = 'button';
      next.addEventListener('click', () => answer(+range.value));
      box.append(labels, range, read, next);
      qBody.append(box);
    } else {
      const grid = el('div', `options${q.options.length > 4 ? ' many' : ''}`);
      q.options.forEach((o, i) => {
        const b = el('button', 'option');
        b.type = 'button';
        if (state.answers[state.q] === i) b.classList.add('selected');
        b.append(el('span', 'opt-emoji', o.e), el('span', 'opt-text', o.t), el('span', 'opt-key', String(i + 1)));
        b.addEventListener('click', () => pick(b, i));
        grid.append(b);
      });
      qBody.append(grid);
    }
    qBody.classList.remove('enter');
    void qBody.offsetWidth;
    qBody.classList.add('enter');
  }

  let picking = false;
  async function pick(btn, i) {
    if (picking) return;
    picking = true;
    qBody.querySelectorAll('.option').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected', 'picked');
    await sleep(260);
    picking = false;
    answer(i);
  }

  function answer(v) {
    state.answers[state.q] = v;
    if (state.q < QUESTIONS.length - 1) {
      state.q++;
      renderQuestion();
    } else {
      $('#progress-bar').style.width = '100%';
      startRitual();
    }
  }

  $('#btn-quiz-back').addEventListener('click', () => {
    if (state.q === 0) show('photo');
    else { state.q--; renderQuestion(); }
  });

  document.addEventListener('keydown', (e) => {
    if (!$('#screen-quiz').classList.contains('active') || e.target.tagName === 'INPUT') return;
    const n = parseInt(e.key, 10);
    const btns = qBody.querySelectorAll('.option');
    if (n >= 1 && n <= btns.length) btns[n - 1].click();
    if (e.key === 'Backspace') $('#btn-quiz-back').click();
  });

  /* ---------- Sonuç hesaplama ---------- */
  function computeResult() {
    const scores = Object.fromEntries(CLASS_IDS.map((id) => [id, 0]));
    const mods = Object.fromEntries(STATS.map((s) => [s.key, 0]));

    QUESTIONS.forEach((q, qi) => {
      const a = state.answers[qi];
      if (a == null) return;
      if (q.type === 'slider') {
        const v = a / 100;
        scores.berserker += v * 3; scores.dragon += v * 2; scores.paladin += v * 1.5;
        scores.assassin += (1 - v) * 3; scores.ranger += (1 - v) * 2; scores.bard += (1 - v);
        mods.power += (v - 0.5) * 10;
        mods.speed += (0.5 - v) * 10;
      } else {
        const o = q.options[a];
        for (const k in o.w) scores[k] += o.w[k];
        for (const k in o.s) mods[k] += o.s[k];
      }
    });
    if (state.analysis) for (const k in state.analysis.bonus) scores[k] += state.analysis.bonus[k];

    const seed = Portrait.hash(`${state.name}|${state.answers.join(',')}|${state.analysis?.key || ''}`);
    const r = Portrait.rng(seed);
    for (const k of CLASS_IDS) scores[k] += r() * 0.3;

    const ranked = CLASS_IDS.slice().sort((a, b) => scores[b] - scores[a]);
    const classId = ranked[0];
    const cls = CLASSES[classId];

    const exps = ranked.map((id) => Math.exp(scores[id] / 4));
    const sum = exps.reduce((a, b) => a + b, 0);
    const matches = ranked.slice(0, 5).map((id, i) => [id, Math.max(1, Math.round((exps[i] / sum) * 100))]);

    const stats = {};
    STATS.forEach((s) => {
      let v = cls.base[s.key] + mods[s.key] * 1.4 - 5 + (r() * 8 - 4);
      if (v > 88) v = 88 + (v - 88) * 0.4;
      stats[s.key] = Math.round(clamp(v, 12, 99));
    });

    return buildResult({
      classId, name: state.name, stats, matches, seed,
      aura: state.analysis ? { name: state.analysis.name, color: state.analysis.color } : null,
    });
  }

  function buildResult(r) {
    const power = STATS.reduce((a, s) => a + r.stats[s.key], 0);
    const top = STATS.slice().sort((a, b) => r.stats[b.key] - r.stats[a.key])[0];
    return {
      ...r, power,
      rarity: RARITIES.find((x) => power >= x.min),
      epithet: top.epithet,
    };
  }

  /* ---------- Ritüel (yükleme) ---------- */
  async function startRitual() {
    show('loading');
    const steps = [
      'Ruhun okunuyor…',
      state.img ? 'Yüzün ve aura rengin çözümleniyor…' : 'Aura rengin hissediliyor…',
      'Kader yıldızları hizalanıyor…',
      'Sınıfın belirleniyor…',
      'Kahraman portren resmediliyor…',
    ];
    const list = $('#ritual-steps');
    list.replaceChildren(...steps.map((s) => el('li', null, s)));
    const items = [...list.children];
    const emojis = ['🔮', '👁️', '🌌', '⚔️', '🎨'];
    const fontP = Portrait.fontsReady();

    for (let i = 0; i < items.length; i++) {
      items[i].classList.add('active');
      $('#ritual-emoji').textContent = emojis[i];
      const t0 = performance.now();
      if (i === 1 && state.img) {
        if (!state.crop) state.crop = await Portrait.findCrop(state.img);
        state.analysis = Portrait.analyze(state.img, state.crop);
      }
      if (i === 1 && !state.img) state.analysis = null;
      if (i === 3) {
        state.result = computeResult();
        $('#ritual-emoji').textContent = CLASSES[state.result.classId].emoji;
      }
      if (i === 4) {
        await fontP;
        await sleep(30);
        buildCard();
      }
      const wait = 720 - (performance.now() - t0);
      if (wait > 0) await sleep(wait);
      items[i].classList.replace('active', 'done');
    }
    await sleep(250);
    state.shared = false;
    const code = encodeResult(state.result);
    state.rosterId = Roster.save(code, state.portrait, 'me');
    history.replaceState(null, '', `#r=${code}`);
    showResult();
  }

  function buildCard() {
    const r = state.result;
    const cls = CLASSES[r.classId];
    const source = state.img && !state.shared ? { img: state.img, crop: state.crop } : null;
    const portrait = Portrait.stylize(source, cls, r.seed ?? Portrait.hash(r.classId + r.name));
    state.portrait = portrait;
    state.card = Portrait.renderCard({
      portrait, cls, heroName: r.name, epithet: r.epithet, stats: r.stats,
      rarity: r.rarity, power: r.power, footer: `Hangi Fantastik Karaktersin? · ${SITE}`,
    });
  }

  /* ---------- Sonuç ekranı ---------- */
  function showResult() {
    const r = state.result;
    const cls = CLASSES[r.classId];
    setTheme(cls);
    show('result');

    $('#card-wrap').replaceChildren(state.card);
    state.card.setAttribute('role', 'img');
    state.card.setAttribute('aria-label', `${cls.name} karakter kartı`);

    $('#shared-banner').hidden = !state.shared;
    if (state.shared) {
      $('#shared-text').textContent = r.name
        ? `⚔️ ${r.name} bir ${cls.name} çıktı! Peki sen hangi karaktersin?`
        : `⚔️ Bu kahraman bir ${cls.name}! Peki sen hangi karaktersin?`;
    }

    $('#r-emoji').textContent = cls.emoji;
    $('#r-name').textContent = cls.name;
    $('#r-en').textContent = cls.en;
    const badges = $('#r-badges');
    badges.replaceChildren();
    const rb = el('span', 'badge', `★ ${r.rarity.name} · ${r.rarity.en}`);
    rb.style.color = r.rarity.color;
    const pb = el('span', 'badge', `⚡ Güç Seviyesi ${r.power}`);
    pb.style.color = 'var(--gold)';
    const mb = el('span', 'badge', `💫 Ruh uyumu %${r.matches[0][1]}`);
    mb.style.color = cls.accent;
    badges.append(rb, pb, mb);
    $('#r-epithet').textContent = r.name ? `“${r.name}, ${r.epithet}”` : `“${r.epithet}”`;
    $('#r-desc').textContent = cls.desc;
    $('#r-motto').textContent = `“${cls.motto}”`;

    // Özellik çubukları
    const statsBox = $('#r-stats');
    statsBox.replaceChildren();
    const bars = [];
    STATS.forEach((s) => {
      const row = el('div', 'stat');
      const top = el('div', 'stat-top');
      const lab = el('span', null, `${s.icon} ${s.label}`);
      lab.append(el('small', null, s.en));
      const val = el('b', null, '0');
      top.append(lab, val);
      const bar = el('div', 'bar');
      const fill = el('i');
      bar.append(fill);
      row.append(top, bar);
      statsBox.append(row);
      bars.push([fill, val, r.stats[s.key]]);
    });
    requestAnimationFrame(() => setTimeout(() => {
      bars.forEach(([fill, val, v]) => {
        fill.style.width = `${v}%`;
        countUp(val, v);
      });
    }, 150));

    $('#r-radar').replaceChildren(radar(r.stats));
    $('#r-ability-name').textContent = `✦ ${cls.ability.name}`;
    $('#r-ability-text').textContent = cls.ability.text;

    const info = $('#r-info');
    info.replaceChildren();
    const infoItem = (k, v, color) => {
      const d = el('div');
      const dd = el('dd');
      if (color) {
        const dot = el('span', 'aura-dot');
        dot.style.color = color;
        dd.append(dot);
      }
      dd.append(document.createTextNode(v));
      d.append(el('dt', null, k), dd);
      info.append(d);
    };
    infoItem('⚔️ Silah', cls.weapon);
    infoItem('🌀 Element', cls.element);
    infoItem('🐾 Yoldaş', cls.companion);
    infoItem('🔆 Aura', r.aura ? `${r.aura.name} Aura` : 'Gizli (fotoğraf yok)', r.aura?.color);

    $('#r-strengths').replaceChildren(...cls.strengths.map((s) => el('span', 'chip', s)));
    $('#r-weakness').textContent = cls.weakness;

    const m = $('#r-matches');
    m.replaceChildren();
    r.matches.forEach(([id, pct], i) => {
      const c = CLASSES[id];
      const row = el('div', `match${i === 0 ? ' top' : ''}`);
      const mid = el('div');
      const bar = el('div', 'bar');
      const fill = el('i');
      fill.style.background = `linear-gradient(90deg, ${c.ramp[2]}, ${c.accent})`;
      fill.style.boxShadow = `0 0 10px ${c.accent}`;
      bar.append(fill);
      mid.append(el('div', 'm-name', c.name), bar);
      row.append(el('span', 'm-emoji', c.emoji), mid, el('span', 'm-pct', `%${pct}`));
      m.append(row);
      setTimeout(() => { fill.style.width = `${pct}%`; }, 300 + i * 120);
    });
  }

  function countUp(node, target) {
    const t0 = performance.now(), dur = 1200;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      node.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function radar(stats) {
    const NS = 'http://www.w3.org/2000/svg';
    const size = 220, c = size / 2, R = 78;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Özellik radar grafiği');
    const pt = (i, v) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / STATS.length;
      return [c + Math.cos(a) * R * v, c + Math.sin(a) * R * v];
    };
    const mk = (tag, attrs) => {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      svg.append(n);
      return n;
    };
    [0.25, 0.5, 0.75, 1].forEach((f) => mk('polygon', { class: 'grid', points: STATS.map((_, i) => pt(i, f).join(',')).join(' ') }));
    STATS.forEach((s, i) => {
      const [x2, y2] = pt(i, 1);
      mk('line', { class: 'axis', x1: c, y1: c, x2, y2 });
      const [lx, ly] = pt(i, 1.24);
      const t = mk('text', { x: lx, y: ly + 3, 'text-anchor': Math.abs(lx - c) < 5 ? 'middle' : lx > c ? 'start' : 'end' });
      t.textContent = s.label;
    });
    mk('polygon', { class: 'shape', points: STATS.map((s, i) => pt(i, stats[s.key] / 100).join(',')).join(' ') });
    STATS.forEach((s, i) => {
      const [cx, cy] = pt(i, stats[s.key] / 100);
      mk('circle', { class: 'dot', cx, cy, r: 3 });
    });
    return svg;
  }

  /* ---------- Paylaşım ---------- */
  function b64urlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
  }
  function encodeResult(r) {
    return b64urlEncode(JSON.stringify({
      v: 1, c: r.classId, n: r.name, s: STATS.map((s) => r.stats[s.key]),
      m: r.matches, a: r.aura, z: r.seed,
    }));
  }
  function decodeResult(str) {
    try {
      const o = JSON.parse(b64urlDecode(str));
      if (!CLASSES[o.c] || !Array.isArray(o.s) || o.s.length !== STATS.length) return null;
      const stats = {};
      STATS.forEach((s, i) => { stats[s.key] = clamp(Math.round(+o.s[i] || 0), 1, 99); });
      const matches = (Array.isArray(o.m) ? o.m : [[o.c, 100]])
        .filter((m) => Array.isArray(m) && CLASSES[m[0]])
        .slice(0, 5)
        .map(([id, p]) => [id, clamp(Math.round(+p || 0), 1, 100)]);
      const aura = o.a && typeof o.a.name === 'string' && /^#[0-9a-f]{6}$/i.test(o.a.color)
        ? { name: o.a.name.slice(0, 20), color: o.a.color } : null;
      return buildResult({
        classId: o.c, name: String(o.n || '').slice(0, 22), stats,
        matches: matches.length ? matches : [[o.c, 100]], aura, seed: (+o.z >>> 0) || undefined,
      });
    } catch (e) {
      return null;
    }
  }
  function shareUrl() {
    return `${location.origin}${location.pathname}#r=${encodeResult(state.result)}`;
  }
  function fileName() {
    const slug = (s) => s.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const cls = CLASSES[state.result.classId];
    return `${[slug(state.result.name), slug(cls.en)].filter(Boolean).join('-')}.png`;
  }
  const cardBlob = () => new Promise((res) => state.card.toBlob(res, 'image/png'));

  $('#btn-download').addEventListener('click', async () => {
    const blob = await cardBlob();
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName();
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Kartın indirildi! 🎉');
  });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      toast('Link kopyalandı! 🔗');
    } catch (e) {
      prompt('Linki kopyala:', shareUrl());
    }
  }
  $('#btn-link').addEventListener('click', copyLink);

  $('#btn-share').addEventListener('click', async () => {
    const cls = CLASSES[state.result.classId];
    const text = `Ben bir ${cls.emoji} ${cls.name} çıktım! Güç seviyem ${state.result.power}. Sen hangi fantastik karaktersin?`;
    try {
      const file = new File([await cardBlob()], fileName(), { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Hangi Fantastik Karaktersin?', text, url: shareUrl() });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: 'Hangi Fantastik Karaktersin?', text, url: shareUrl() });
        return;
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
    copyLink();
  });

  function resetGame() {
    state.answers = [];
    state.q = 0;
    state.result = null;
    state.card = null;
    state.analysis = null;
    state.shared = false;
    history.replaceState(null, '', location.pathname);
    setTheme(null);
  }
  $('#btn-replay').addEventListener('click', () => { resetGame(); show('photo'); });
  $('#btn-try').addEventListener('click', () => { resetGame(); show('intro'); });

  /* ---------- Arena (js/arena.js) için ortak arayüz ---------- */
  function currentFighter() {
    if (!state.result) return null;
    const code = encodeResult(state.result);
    return {
      key: `c:${code}`, code, result: state.result, portrait: state.portrait,
      rosterId: state.shared ? null : state.rosterId, source: state.shared ? 'friend' : 'me',
    };
  }
  window.App = {
    $, el, sleep, clamp, show, toast, setTheme,
    encodeResult, decodeResult, buildResult, Roster, currentFighter,
    hasResult: () => !!state.result,
    // Yeni (başka) bir kahraman: önceki adı ve fotoğrafı da temizle
    newHero() {
      resetGame();
      clearPhoto();
      $('#hero-name').value = '';
      show('photo');
      setTimeout(() => $('#hero-name').focus(), 300);
    },
  };

  /* ---------- Paylaşılan link ile açılış ---------- */
  async function boot() {
    const m = location.hash.match(/^#r=([\w-]+)$/);
    if (!m) return;
    const r = decodeResult(m[1]);
    if (!r) return;
    state.result = r;
    state.shared = true;
    await Portrait.fontsReady();
    buildCard();
    showResult();
  }
  boot();
})();
