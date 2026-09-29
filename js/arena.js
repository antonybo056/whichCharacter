'use strict';

/* Dövüş modu arayüzü: savaşçı seçimi, animasyonlu dövüş, analiz ve paylaşım. */
(() => {
  const { $, el, sleep, clamp, show, toast, setTheme, encodeResult, decodeResult, buildResult, Roster } = App;

  const arena = {
    slots: [null, null], pendingSlot: null, pickSlot: 0,
    round: 0, token: 0, speed: 1, skip: false, last: null, fromLink: false,
  };

  const RANDOM_NAMES = ['Morgath', 'Sylvaine', 'Kael', 'Thorne', 'Lyra', 'Draven', 'Isolde', 'Rhogar',
    'Nyssa', 'Varek', 'Elowen', 'Zarek', 'Brann', 'Seraphine', 'Malakar', 'Ysolde'];

  /* ---------- Savaşçılar ---------- */
  const displayName = (f) => f.result.name || CLASSES[f.result.classId].name;

  function fromRoster(e) {
    return { key: `c:${e.code}`, code: e.code, result: e.result, portraitSrc: e.portrait, rosterId: e.id, source: e.source };
  }
  function fromCode(code, source) {
    const result = decodeResult(code);
    return result ? { key: `c:${code}`, code, result, rosterId: null, source } : null;
  }
  function randomFighter() {
    const ids = Object.keys(CLASSES);
    const id = ids[(Math.random() * ids.length) | 0];
    const cls = CLASSES[id];
    const stats = {};
    STATS.forEach((s) => { stats[s.key] = clamp(Math.round(cls.base[s.key] + Math.random() * 16 - 8), 12, 99); });
    const result = buildResult({
      classId: id, name: RANDOM_NAMES[(Math.random() * RANDOM_NAMES.length) | 0], stats,
      matches: [[id, 100]], aura: null, seed: (Math.random() * 2 ** 32) >>> 0,
    });
    const code = encodeResult(result);
    return { key: `c:${code}`, code, result, rosterId: null, source: 'random' };
  }

  async function portraitOf(f) {
    if (f.portrait) return f.portrait;
    if (f.portraitSrc) {
      try { f.portrait = await Portrait.loadImage(f.portraitSrc); } catch (e) { /* yedek portre */ }
    }
    if (!f.portrait) {
      f.portrait = Portrait.stylize(null, CLASSES[f.result.classId], f.result.seed ?? Portrait.hash(f.code), 360);
    }
    return f.portrait;
  }
  function thumb(f, size = 240) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d').drawImage(f.portrait, 0, 0, size, size);
    return c;
  }

  /* ---------- Savaşçı seçimi ---------- */
  function openArena(fighter) {
    arena.fromLink = false;
    if (fighter && !arena.slots.some((s) => s && s.key === fighter.key)) {
      let target = arena.pendingSlot;
      if (target == null) {
        if (fighter.source === 'friend') target = arena.slots[1] ? (arena.slots[0] ? 1 : 0) : 1;
        else target = !arena.slots[0] ? 0 : !arena.slots[1] ? 1 : 0;
      }
      arena.slots[target] = fighter;
    }
    arena.pendingSlot = null;
    arena.token++;
    setTheme(null);
    history.replaceState(null, '', location.pathname);
    renderSetup();
    show('arena');
  }

  async function renderSetup() {
    await Promise.all(arena.slots.filter(Boolean).map(portraitOf));
    arena.slots.forEach((f, i) => {
      const btn = $(`#slot-${i}`);
      btn.replaceChildren();
      btn.classList.toggle('empty', !f);
      if (!f) {
        btn.append(el('span', 'slot-plus', '+'), el('span', 'slot-label', i === 0 ? 'Birinci savaşçıyı seç' : 'Rakibini seç'));
        return;
      }
      const cls = CLASSES[f.result.classId];
      btn.style.setProperty('--fc', cls.accent);
      const img = el('div', 'slot-img');
      img.append(thumb(f));
      btn.append(
        img,
        el('span', 'slot-name', displayName(f)),
        el('span', 'slot-class', `${cls.emoji} ${cls.name}`),
        el('span', 'slot-power', `⚡ ${f.result.power} · ${f.result.rarity.name}`),
        el('span', 'slot-change', 'Değiştir'),
      );
    });

    const [A, B] = arena.slots;
    const box = $('#matchup');
    box.replaceChildren();
    $('#btn-fight').disabled = !(A && B);
    if (A && B) {
      const ca = CLASSES[A.result.classId], cb = CLASSES[B.result.classId];
      const aAdv = Battle.COUNTERS[A.result.classId].includes(B.result.classId);
      const bAdv = Battle.COUNTERS[B.result.classId].includes(A.result.classId);
      box.textContent = aAdv && bAdv ? `⚖️ İki taraf da birbirine karşı element avantajlı (${ca.element} ve ${cb.element}).`
        : aAdv ? `🌀 Element avantajı: ${ca.name} (${ca.element}) bu eşleşmede %15 fazla hasar verir.`
        : bAdv ? `🌀 Element avantajı: ${cb.name} (${cb.element}) bu eşleşmede %15 fazla hasar verir.`
        : '🌀 Element avantajı yok — dövüşü özellikler belirleyecek.';
    }
  }

  document.querySelectorAll('.slot').forEach((b) => b.addEventListener('click', () => openPicker(+b.dataset.slot)));
  $('#btn-fight').addEventListener('click', () => { arena.round = 0; startBattle(); });
  $('#btn-arena-back').addEventListener('click', () => {
    if (App.hasResult()) show('result');
    else show('intro');
  });
  $('#btn-battle').addEventListener('click', () => openArena(App.currentFighter()));
  $('#btn-intro-arena').addEventListener('click', () => openArena(null));

  /* ---------- Seçim penceresi ---------- */
  const picker = $('#picker-modal');
  function openPicker(slot) {
    arena.pickSlot = slot;
    $('#picker-title').textContent = slot === 0 ? 'Birinci Savaşçıyı Seç' : 'Rakibini Seç';
    $('#picker-link').value = '';
    renderRoster();
    picker.hidden = false;
  }
  function closePicker() { picker.hidden = true; }
  function choose(f) {
    arena.slots[arena.pickSlot] = f;
    closePicker();
    renderSetup();
  }

  function renderRoster() {
    const box = $('#picker-roster');
    box.replaceChildren();
    const list = Roster.list();
    if (!list.length) {
      box.append(el('p', 'muted', 'Henüz kahraman yok. Testi çözdüğünde kahramanların burada birikir — arkadaşınla aynı cihazda sırayla oynayıp dövüştürebilirsiniz!'));
      return;
    }
    list.forEach((e) => {
      const cls = CLASSES[e.result.classId];
      const item = el('div', 'r-item');
      item.style.setProperty('--fc', cls.accent);
      const pick = el('button', 'r-pick');
      pick.type = 'button';
      const pic = el('div', 'r-pic');
      if (e.portrait) {
        const img = el('img');
        img.src = e.portrait;
        img.alt = '';
        pic.append(img);
      } else pic.textContent = cls.emoji;
      const txt = el('div', 'r-txt');
      txt.append(
        el('b', null, e.result.name || cls.name),
        el('span', null, `${cls.emoji} ${cls.name}`),
        el('small', null, [
          `⚡ ${e.result.power}`,
          e.w + e.l ? `${e.w} zafer, ${e.l} yenilgi` : null,
          e.source === 'friend' ? 'arkadaş' : null,
        ].filter(Boolean).join(' · ')),
      );
      pick.append(pic, txt);
      pick.addEventListener('click', () => choose(fromRoster(e)));
      const del = el('button', 'r-del', '✕');
      del.type = 'button';
      del.setAttribute('aria-label', 'Kahramanı sil');
      del.addEventListener('click', () => {
        if (!confirm(`${e.result.name || cls.name} Kahraman Salonu'ndan silinsin mi?`)) return;
        Roster.remove(e.id);
        renderRoster();
      });
      item.append(pick, del);
      box.append(item);
    });
  }

  $('#btn-picker-close').addEventListener('click', closePicker);
  picker.addEventListener('click', (e) => { if (e.target === picker) closePicker(); });
  $('#btn-picker-random').addEventListener('click', () => choose(randomFighter()));
  $('#btn-picker-new').addEventListener('click', () => {
    arena.pendingSlot = arena.pickSlot;
    closePicker();
    App.newHero();
  });
  function addFromLink() {
    const v = $('#picker-link').value.trim();
    const m = v.match(/#r=([\w-]+)/) || v.match(/^([\w-]{20,})$/);
    const f = m && fromCode(m[1], 'friend');
    if (!f) { toast('Bu link geçerli bir karakter kartı değil.'); return; }
    f.rosterId = Roster.save(f.code, null, 'friend');
    choose(f);
  }
  $('#btn-picker-link').addEventListener('click', addFromLink);
  $('#picker-link').addEventListener('keydown', (e) => { if (e.key === 'Enter') addFromLink(); });

  /* ---------- Dövüş ---------- */
  const battleUrl = () => {
    const [A, B] = arena.slots;
    return `${location.origin}${location.pathname}#b=${A.code}~${B.code}~${arena.round}`;
  };

  async function startBattle() {
    const [A, B] = arena.slots;
    if (!A || !B) return;
    const pair = `${A.code}~${B.code}`;
    const sim = Battle.simulate(A.result, B.result, Battle.hash(`${pair}~${arena.round}`));
    const oddsA = Battle.odds(A.result, B.result, pair, 1000);
    arena.last = { A, B, sim, oddsA, recorded: false };
    history.replaceState(null, '', `#b=${pair}~${arena.round}`);
    await Promise.all([portraitOf(A), portraitOf(B)]);
    setTheme(null);
    renderStage(sim);
    $('#battle-banner').hidden = !arena.fromLink;
    show('battle');
    play(sim);
  }

  function renderStage(sim) {
    [0, 1].forEach((i) => {
      const f = arena.slots[i];
      const cls = CLASSES[f.result.classId];
      const box = $(`#fighter-${i}`);
      box.className = 'fighter';
      box.style.setProperty('--fc', cls.accent);
      const pic = el('div', 'f-pic');
      pic.append(thumb(f, 300));
      pic.append(el('span', 'f-crown', '👑'));
      const hp = el('div', 'hp');
      hp.append(el('i'), el('span', 'hp-text', `${sim.fighters[i].maxHp} / ${sim.fighters[i].maxHp}`));
      box.replaceChildren(
        pic,
        el('div', 'f-name', sim.fighters[i].name),
        el('div', 'f-class', `${cls.emoji} ${cls.name}`),
        hp,
        el('div', 'f-icons'),
      );
    });
    $('#round-no').textContent = 'Hazır';
    $('#battle-log').replaceChildren();
    $('#battle-end').hidden = true;
    $('#battle-controls').hidden = false;
    $('#btn-speed').textContent = `⏩ Hız: ${arena.speed}x`;
  }

  function floatText(i, text, cls) {
    const pic = $(`#fighter-${i} .f-pic`);
    const n = el('span', `float ${cls}`, text);
    n.style.left = `${35 + Math.random() * 30}%`;
    pic.append(n);
    setTimeout(() => n.remove(), 1400);
  }
  function pulse(node, cls, ms = 500) {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), ms);
  }

  function applyEntry(e, sim, animate) {
    if (e.type === 'round') $('#round-no').textContent = `${e.round}. Tur`;
    [0, 1].forEach((i) => {
      const max = sim.fighters[i].maxHp;
      const box = $(`#fighter-${i}`);
      const pct = (e.hp[i] / max) * 100;
      const bar = box.querySelector('.hp i');
      bar.style.width = `${pct}%`;
      bar.classList.toggle('low', pct < 30);
      box.querySelector('.hp-text').textContent = `${e.hp[i]} / ${max}`;
      box.querySelector('.f-icons').textContent = e.icons[i];
    });

    const log = $('#battle-log');
    const line = el('p', `log-${e.type}${e.crit ? ' log-crit' : ''}${e.big ? ' log-big' : ''}`, e.text);
    if (e.actor != null) line.style.setProperty('--fc', CLASSES[arena.slots[e.actor].result.classId].accent);
    log.append(line);
    log.scrollTop = log.scrollHeight;
    if (!animate) return;

    if (e.type === 'attack' || e.type === 'dot') {
      const target = $(`#fighter-${e.target}`);
      pulse(target, e.crit || e.big ? 'hit-hard' : 'hit');
      floatText(e.target, `-${e.dmg}`, e.crit ? 'crit' : e.type === 'dot' ? 'burn' : 'dmg');
      if (e.actor != null) pulse($(`#fighter-${e.actor}`), `lunge-${e.actor}`, 400);
    }
    if (e.heal) floatText(e.actor, `+${e.heal}`, 'heal');
    if (e.type === 'dodge') {
      pulse($(`#fighter-${e.target}`), 'dodge');
      floatText(e.target, 'ISKA!', 'miss');
    }
    if (e.type === 'special') {
      const f = $(`#fighter-${e.actor}`);
      pulse(f, 'cast', 1200);
      const flash = $('#stage-flash');
      flash.style.setProperty('--fc', CLASSES[arena.slots[e.actor].result.classId].accent);
      pulse(flash, 'on', 900);
    }
  }

  const DELAY = { intro: 1100, round: 450, attack: 1050, special: 1250, heal: 1100, dodge: 1000, status: 1000, dot: 850, end: 700 };

  async function play(sim) {
    const token = ++arena.token;
    arena.skip = false;
    for (const e of sim.log) {
      if (token !== arena.token) return;
      applyEntry(e, sim, !arena.skip);
      if (!arena.skip) await sleep(((DELAY[e.type] || 900) + (e.big ? 250 : 0)) / arena.speed);
    }
    if (token === arena.token) finish(sim);
  }

  $('#btn-skip').addEventListener('click', () => { arena.skip = true; });
  $('#btn-speed').addEventListener('click', () => {
    arena.speed = arena.speed >= 4 ? 1 : arena.speed * 2;
    $('#btn-speed').textContent = `⏩ Hız: ${arena.speed}x`;
  });

  function finish(sim) {
    const { A, B, oddsA } = arena.last;
    const w = sim.winner;
    const wf = arena.slots[w];
    const wcls = CLASSES[wf.result.classId];
    $(`#fighter-${w}`).classList.add('winner');
    $(`#fighter-${1 - w}`).classList.add('loser');
    $('#battle-controls').hidden = true;

    if (!arena.last.recorded && !arena.fromLink) {
      arena.last.recorded = true;
      [A, B].forEach((f, i) => { if (f.rosterId && A.key !== B.key) Roster.record(f.rosterId, i === w); });
    }

    $('#be-winner').textContent = `${wcls.emoji} ${sim.fighters[w].name}`;
    const left = Math.round((sim.fighters[w].hp / sim.fighters[w].maxHp) * 100);
    $('#be-sub').textContent = `${wcls.name} · ${sim.rounds} tur sürdü · kalan can %${left}${sim.timeout ? ' · süre doldu' : sim.close ? ' · kıl payı!' : ''}`;

    const pa = Math.round(oddsA * 100), pb = 100 - pa;
    $('#odds-a').style.width = `${pa}%`;
    $('#odds-b').style.width = `${pb}%`;
    $('#odds-a').style.background = CLASSES[A.result.classId].accent;
    $('#odds-b').style.background = CLASSES[B.result.classId].accent;
    $('#odds-la').textContent = `${sim.fighters[0].name} %${pa}`;
    $('#odds-lb').textContent = `%${pb} ${sim.fighters[1].name}`;

    const wOdds = w === 0 ? oddsA : 1 - oddsA;
    const upset = $('#be-upset');
    upset.hidden = wOdds >= 0.4;
    if (wOdds < 0.4) {
      upset.textContent = `😲 Sürpriz! Bu zafer 100 dövüşte yalnızca yaklaşık ${Math.max(1, Math.round(wOdds * 100))} kez yaşanır.`;
    }

    const names = sim.fighters.map((f) => f.name);
    $('#be-why').replaceChildren(...Battle.analysis(A.result, B.result, oddsA, names).map((t) => el('li', null, t)));

    const table = $('#be-stats');
    table.replaceChildren();
    const head = el('tr');
    head.append(el('th'), el('th', null, names[0]), el('th', null, names[1]));
    table.append(head);
    const T = sim.fighters.map((f) => f.tally);
    [
      ['Toplam hasar', 'dmg'], ['En büyük vuruş', 'maxHit'], ['Kritik vuruş', 'crits'],
      ['Kaçınma', 'dodges'], ['İyileşme', 'heal'], ['İlk saldırı', 'first'],
    ].forEach(([label, k]) => {
      const tr = el('tr');
      const best = T[0][k] === T[1][k] ? -1 : T[0][k] > T[1][k] ? 0 : 1;
      tr.append(el('td', null, label));
      [0, 1].forEach((i) => tr.append(el('td', i === best ? 'best' : null, String(T[i][k]))));
      table.append(tr);
    });

    $('#battle-end').hidden = false;
    setTimeout(() => $('#battle-end').scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  }

  $('#btn-rematch').addEventListener('click', () => { arena.round++; startBattle(); window.scrollTo(0, 0); });
  $('#btn-change').addEventListener('click', () => {
    arena.token++;
    arena.fromLink = false;
    history.replaceState(null, '', location.pathname);
    renderSetup();
    show('arena');
  });
  $('#btn-battle-try').addEventListener('click', () => {
    arena.token++;
    arena.fromLink = false;
    arena.pendingSlot = 0;
    history.replaceState(null, '', location.pathname);
    App.newHero();
  });

  /* ---------- VS görseli ve paylaşım ---------- */
  async function vsImage() {
    await Portrait.fontsReady();
    const { sim, oddsA } = arena.last;
    const W = 1600, H = 1180, gold = '#e3c07a';
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    const ca = CLASSES[arena.slots[0].result.classId], cb = CLASSES[arena.slots[1].result.classId];
    const bg = x.createLinearGradient(0, 0, W, 0);
    bg.addColorStop(0, ca.ramp[1]);
    bg.addColorStop(0.5, '#07060d');
    bg.addColorStop(1, cb.ramp[1]);
    x.fillStyle = bg;
    x.fillRect(0, 0, W, H);

    x.textAlign = 'center';
    x.fillStyle = gold;
    x.font = '900 46px Cinzel, serif';
    x.fillText('⚔  KİM KAZANIRDI?  ⚔', W / 2, 78);

    const scale = 0.7, cw = 900 * scale, ch = 1300 * scale, top = 118;
    arena.slots.forEach((f, i) => {
      const r = f.result;
      const cls = CLASSES[r.classId];
      const card = Portrait.renderCard({
        portrait: f.portrait, cls, heroName: r.name, epithet: r.epithet, stats: r.stats,
        rarity: r.rarity, power: r.power, footer: '',
      });
      const px = i === 0 ? 70 : W - 70 - cw;
      x.save();
      if (i === sim.winner) {
        x.shadowColor = gold;
        x.shadowBlur = 50;
      } else {
        x.globalAlpha = 0.6;
        if ('filter' in x) x.filter = 'grayscale(0.85)';
      }
      x.drawImage(card, px, top, cw, ch);
      x.restore();
      if (i === sim.winner) {
        x.font = '84px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        x.fillText('👑', px + cw / 2, top + 30);
      }
    });

    x.save();
    x.shadowColor = gold;
    x.shadowBlur = 30;
    x.beginPath();
    x.arc(W / 2, top + ch / 2, 70, 0, Math.PI * 2);
    x.fillStyle = '#120e20';
    x.fill();
    x.restore();
    x.strokeStyle = gold;
    x.lineWidth = 4;
    x.stroke();
    x.fillStyle = gold;
    x.font = '900 56px Cinzel, serif';
    x.textBaseline = 'middle';
    x.fillText('VS', W / 2, top + ch / 2 + 4);
    x.textBaseline = 'alphabetic';

    const wOdds = Math.round((sim.winner === 0 ? oddsA : 1 - oddsA) * 100);
    x.fillStyle = '#fff';
    x.font = '700 34px Cinzel, serif';
    x.fillText(`🏆 Kazanan: ${sim.fighters[sim.winner].name}`, W / 2, H - 70);
    x.fillStyle = 'rgba(255,255,255,.65)';
    x.font = '500 22px Inter, sans-serif';
    x.fillText(`${sim.rounds} tur · Kazanma olasılığı %${wOdds} · ${location.host || 'antonybo056.github.io'}${location.pathname}`, W / 2, H - 30);
    return c;
  }

  const vsBlob = async () => { const c = await vsImage(); return new Promise((res) => c.toBlob(res, 'image/png')); };

  $('#btn-vs-download').addEventListener('click', async () => {
    const blob = await vsBlob();
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'arena-dovusu.png';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('VS görseli indirildi! 🖼️');
  });

  $('#btn-battle-share').addEventListener('click', async () => {
    const { sim } = arena.last;
    const text = `⚔️ ${sim.fighters[0].name} ve ${sim.fighters[1].name} arenada karşılaştı. Kazanan: ${sim.fighters[sim.winner].name}! Dövüşü izle:`;
    try {
      const file = new File([await vsBlob()], 'arena-dovusu.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Kim Kazanırdı?', text, url: battleUrl() });
        return;
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(battleUrl());
      toast('Dövüş linki kopyalandı! 🔗');
    } catch (e) {
      prompt('Linki kopyala:', battleUrl());
    }
  });

  /* ---------- Paylaşılan dövüş linkiyle açılış ---------- */
  const m = location.hash.match(/^#b=([\w-]+)~([\w-]+)~(\d{1,4})$/);
  if (m) {
    const A = fromCode(m[1], 'friend'), B = fromCode(m[2], 'friend');
    if (A && B) {
      arena.slots = [A, B];
      arena.round = +m[3];
      arena.fromLink = true;
      startBattle();
    }
  }
})();
