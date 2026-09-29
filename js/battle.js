'use strict';

/*
 * Dövüş motoru: iki kartın özelliklerinden tur tabanlı, tohumlu (tekrarlanabilir)
 * bir dövüş yürütür ve Türkçe anlatım günlüğü üretir.
 *  - create(): adım adım ilerleyen dövüş (oyuncu hamle seçer)
 *  - simulate(): iki tarafı da otomatik oynatan tam dövüş (İzle modu ve olasılık hesabı)
 * Not: Türkçe ek uyumu hatalarını önlemek için isimlere hiç ek getirilmez.
 */
const Battle = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // Fiziksel saldırılara Dayanıklılık, büyülere Zeka da direnç sağlar.
  const PHYSICAL = new Set(['paladin', 'ranger', 'berserker', 'assassin', 'dragon']);

  // Her sınıfın saldırı gücünü belirleyen [ana, yan] özellikler.
  const ATK = {
    mage: ['magic', 'intel'], paladin: ['power', 'defense'], ranger: ['speed', 'power'],
    berserker: ['power', 'speed'], assassin: ['speed', 'power'], druid: ['magic', 'intel'],
    dragon: ['power', 'magic'], frost: ['magic', 'intel'], bard: ['charisma', 'magic'], necro: ['magic', 'intel'],
  };

  // Sınıflar arası denge katsayısı (simülasyonla ayarlandı).
  const BALANCE = {
    mage: 1.2, paladin: 1, ranger: 1.02, berserker: 0.95, assassin: 0.9,
    druid: 1.1, dragon: 0.95, frost: 0.98, bard: 1.02, necro: 1.1,
  };

  // Element avantajı: saldıran sınıf, listedeki sınıflara %15 fazla hasar verir.
  const COUNTERS = {
    mage: ['paladin', 'berserker'],
    paladin: ['necro', 'assassin'],
    ranger: ['frost', 'bard'],
    berserker: ['bard', 'druid'],
    assassin: ['mage', 'necro'],
    druid: ['ranger', 'mage'],
    dragon: ['frost', 'druid'],
    frost: ['dragon', 'ranger'],
    bard: ['dragon', 'paladin'],
    necro: ['berserker', 'assassin'],
  };

  // Oyuncunun seçebileceği hamleler
  const POTIONS = 1;
  const MOVES = {
    attack: { icon: '⚔️', name: 'Saldır', hint: 'Güvenilir hasar; rakipten hızlıysan ikinci vuruş şansı' },
    heavy: { icon: '💥', name: 'Ağır Darbe', hint: '1.55x hasar ama ıskalama riski çok daha yüksek' },
    defend: { icon: '🛡️', name: 'Savun', hint: 'Sonraki darbenin %60\'ını engelle, %5 can topla (üst üste kullanılamaz)' },
    potion: { icon: '🧪', name: 'İksir', hint: 'Canının %30\'unu hemen yenile (tek hak)' },
  };
  const SPECIAL_HINT = {
    mage: 'Kaçınılamaz, zırhı delen dev büyü (2.1x)',
    paladin: '%30 can + 2 darbeyi yarıya indiren kalkan',
    ranger: '5 oktan oluşan yağmur (her biri 0.5x)',
    berserker: 'Öfkeli darbe + sonraki 2 saldırı 1.45x',
    assassin: 'Garantili kritik + sonraki saldırıdan kaç',
    druid: 'Hasar + rakibi 1 tur köklere sar + %15 can',
    dragon: 'Dev alev (2.1x) + rakip 3 tur yanar',
    frost: 'Hasar + rakibi 2 tur dondur',
    bard: '3 tur +%35 hasar + rakibi büyüle',
    necro: 'Her tur saldıran ve can emen ruh ordusu',
  };

  const ATTACKS = {
    mage: ['obsidyen asasından mor bir yıldırım fırlattı', 'gölgelerden bir boşluk küresi çağırdı', 'yasak bir rün fısıldadı, hava çatırdadı', 'karanlık zincirler savurdu'],
    paladin: ['Şafak Kılıcı ile kutsal bir darbe indirdi', 'kalkanıyla ileri atılıp sert bir darbe vurdu', 'kılıcına ışık doldurup savurdu', 'göğe yükselen bir ışık kesiği attı'],
    ranger: ['üç oku aynı anda gerip bıraktı', 'ağaçların arasından sessiz bir ok fırlattı', 'rüzgârı arkasına alıp keskin bir ok attı', 'ay ışığı yayından parıldayan bir ok saldı'],
    berserker: ['baltasını iki eliyle savurdu', 'kükreyerek omuz attı', 'yeri sarsan bir balta darbesi indirdi', 'çılgın bir hücumla saldırdı'],
    assassin: ['gölgelerden fırlayıp hançerini sapladı', 'zehirli bir bıçak fırlattı', 'göz açıp kapayıncaya kadar iki kez kesti', 'bir anda arkada belirip saldırdı'],
    druid: ['sarmaşıkları kamçı gibi savurdu', 'bir ayıya dönüşüp pençeledi', 'dikenli bir kök fırtınası çağırdı', 'kartal suretinde gökten pike yaptı'],
    dragon: ['ejderha mızrağını ileri sapladı', 'ejderhasıyla birlikte alev püskürttü', 'gökten dalışla mızrağını indirdi', 'ejderhasının pençeleriyle saldırdı'],
    frost: ['buz mızrakları yağdırdı', 'dondurucu bir kar fırtınası estirdi', 'kristal asasından buz ışını fırlattı', 'keskin buz kristalleri savurdu'],
    bard: ['lavtasından sağır edici bir akor çaldı', 'ses dalgalarından bir kılıç yarattı', 'alaycı bir şarkıyla sersemletti', 'büyülü bir notayı mermi gibi fırlattı'],
    necro: ['kafatası grimuarından yeşil bir lanet okudu', 'ruh emici bir karanlık dalga saldı', 'kemik mızraklar çağırdı', 'ölülerin fısıltısını silaha çevirdi'],
  };
  const DODGES = ['son anda yana sıçradı — ıska!', 'darbeyi ustaca savuşturdu!', 'bir gölge gibi kayıp saldırıdan kaçtı!', 'takla atarak kurtuldu!'];

  function icons(f) {
    const s = f.st;
    return [
      s.frozen && '❄️', s.rooted && '🌿', s.burn && '🔥', s.rage && '💢', s.shield && '🛡️',
      s.guard && '🧱', s.charm && '🎵', s.ballad && '🎶', s.spirits && '👻', s.vanish && '🌑', s.inspire && '📯',
    ].filter(Boolean).join(' ');
  }

  const maxHpOf = (s) => Math.round(260 + s.defense * 1.8 + s.power * 0.5);
  const MAX_ROUNDS = 30;

  function makeFighter(f, idx) {
    const s = f.stats;
    const phys = PHYSICAL.has(f.classId);
    const maxHp = maxHpOf(s);
    const [main, side] = ATK[f.classId];
    return {
      idx, classId: f.classId, s, phys, maxHp, hp: maxHp,
      name: f.name || CLASSES[f.classId].name,
      atk: (s[main] * 0.65 + s[side] * 0.35) * BALANCE[f.classId],
      crit: 0.05 + Math.max(s.intel, s.speed) * 0.0014,
      usedSpecial: false,
      potions: POTIONS,
      st: { frozen: 0, rooted: 0, burn: 0, rage: 0, shield: 0, guard: 0, charm: 0, ballad: 0, spirits: 0, vanish: 0, inspire: 0 },
      tally: { dmg: 0, crits: 0, dodges: 0, maxHit: 0, heal: 0, first: 0 },
    };
  }

  /* Adım adım ilerleyen dövüş. Hamle sırası: beginRound → (startTurn → act → endTurn) x2 */
  function create(A, B, seed, withLog = true) {
    const r = rng(seed);
    const F = [makeFighter(A, 0), makeFighter(B, 1)];
    if (F[0].name === F[1].name) F[1].name += ' II';
    const log = [];
    let drained = 0, round = 0, finished = null;
    const pick = (arr) => arr[(r() * arr.length) | 0];
    const push = (e) => {
      if (withLog) log.push({ ...e, hp: [F[0].hp, F[1].hp], icons: [icons(F[0]), icons(F[1])] });
    };
    const heal = (f, amount) => {
      const h = Math.min(f.maxHp - f.hp, Math.round(amount));
      f.hp += h;
      f.tally.heal += h;
      return h;
    };

    function strike(me, foe, mult, o = {}) {
      if (!o.sure) {
        if (foe.st.vanish) { foe.st.vanish = 0; foe.tally.dodges++; return { dodged: true, vanish: true }; }
        const dodge = clamp(0.04 + (foe.s.speed - me.s.speed) * 0.004, 0.03, 0.3) + (o.miss || 0);
        if (r() < dodge) { foe.tally.dodges++; return { dodged: true }; }
      }
      let dmg = me.atk * (0.5 + r() * 0.3) * mult;
      if (COUNTERS[me.classId].includes(foe.classId)) dmg *= 1.15;
      if (me.st.rage > 0) { dmg *= 1.45; me.st.rage--; }
      if (me.st.ballad > 0) dmg *= 1.35;
      if (me.st.inspire) { dmg *= 1.25; me.st.inspire = 0; }
      const crit = o.crit || (!o.noCrit && r() < me.crit);
      if (crit) { dmg *= 1.7; me.tally.crits++; }
      if (!o.pierce) {
        const res = me.phys ? foe.s.defense / 450 : (foe.s.defense * 0.3 + foe.s.intel * 0.3) / 450;
        dmg *= 1 - res;
      }
      if (foe.st.shield > 0) { dmg *= 0.5; foe.st.shield--; }
      let guarded = false;
      if (foe.st.guard) { dmg *= 0.4; foe.st.guard = 0; guarded = true; }
      dmg = Math.max(1, Math.round(dmg));
      foe.hp = Math.max(0, foe.hp - dmg);
      me.tally.dmg += dmg;
      me.tally.maxHit = Math.max(me.tally.maxHit, dmg);
      return { dmg, crit, guarded };
    }
    const guardNote = (x) => (x.guarded ? ' 🧱 Savunma darbeyi hafifletti.' : '');

    function special(me, foe) {
      const a = me.idx, t = foe.idx;
      push({ type: 'special', actor: a, text: `✨ ${me.name} özel yeteneğini açığa çıkardı: ${CLASSES[me.classId].ability.name}!` });
      switch (me.classId) {
        case 'mage': {
          const x = strike(me, foe, 2.1, { sure: true, pierce: true });
          push({ type: 'attack', actor: a, target: t, dmg: x.dmg, crit: x.crit, big: true, text: `🌀 Savaş alanının ortasında bir kara delik açıldı! ${foe.name} ${x.dmg} hasar aldı.${guardNote(x)}` });
          break;
        }
        case 'paladin': {
          const h = heal(me, me.maxHp * 0.3);
          me.st.shield = 2;
          push({ type: 'heal', actor: a, heal: h, text: `☀️ Altın bir kubbe yükseldi: ${me.name} ${h} can kazandı ve kutsal kalkanla korunuyor.` });
          break;
        }
        case 'ranger': {
          let tot = 0, hits = 0, guarded = false;
          for (let i = 0; i < 5 && foe.hp > 0; i++) {
            const x = strike(me, foe, 0.5);
            if (!x.dodged) { tot += x.dmg; hits++; guarded = guarded || x.guarded; }
          }
          push({ type: 'attack', actor: a, target: t, dmg: tot, big: true, text: `🏹 Gökyüzü oklarla karardı! ${hits} ok hedefini buldu: ${foe.name} toplam ${tot} hasar aldı.${guardNote({ guarded })}` });
          break;
        }
        case 'berserker': {
          me.st.rage = 2;
          const x = strike(me, foe, 1.2, { sure: true });
          push({ type: 'attack', actor: a, target: t, dmg: x.dmg, crit: x.crit, big: true, text: `💢 Gözleri kıpkırmızı oldu! ${foe.name} öfkeli bir darbeyle ${x.dmg} hasar aldı. Sıradaki saldırılar çok daha güçlü.${guardNote(x)}` });
          break;
        }
        case 'assassin': {
          const x = strike(me, foe, 1.5, { sure: true, crit: true });
          me.st.vanish = 1;
          push({ type: 'attack', actor: a, target: t, dmg: x.dmg, crit: true, big: true, text: `🌑 Gölgeden gölgeye ışınlandı ve tam arkada belirdi! KRİTİK: ${foe.name} ${x.dmg} hasar aldı.${guardNote(x)}` });
          break;
        }
        case 'druid': {
          const x = strike(me, foe, 1.1, { sure: true });
          const h = heal(me, me.maxHp * 0.15);
          foe.st.rooted = 1;
          push({ type: 'attack', actor: a, target: t, dmg: x.dmg, crit: x.crit, big: true, heal: h, text: `🌳 Topraktan dev kökler fışkırdı! ${foe.name} ${x.dmg} hasar aldı ve sarmalandı; ${me.name} ${h} can yeniledi.` });
          break;
        }
        case 'dragon': {
          const x = strike(me, foe, 2.1, { sure: true });
          foe.st.burn = 3;
          push({ type: 'attack', actor: a, target: t, dmg: x.dmg, crit: x.crit, big: true, text: `🐉 Ejderha gökten alev yağdırdı! ${foe.name} ${x.dmg} hasar aldı ve yanmaya başladı.${guardNote(x)}` });
          break;
        }
        case 'frost': {
          const x = strike(me, foe, 0.9, { sure: true });
          foe.st.frozen = 2;
          push({ type: 'attack', actor: a, target: t, dmg: x.dmg, crit: x.crit, big: true, text: `❄️ Zaman durdu! ${foe.name} ${x.dmg} hasar aldı ve bir buz kütlesine hapsoldu.` });
          break;
        }
        case 'bard': {
          me.st.ballad = 3;
          foe.st.charm = 2;
          const x = strike(me, foe, 1, { sure: true });
          push({ type: 'attack', actor: a, target: t, dmg: x.dmg, crit: x.crit, big: true, text: `🎶 Destansı balad yankılandı! ${me.name} güçlendi; ${foe.name} ${x.dmg} hasar aldı ve büyülendi.` });
          break;
        }
        case 'necro': {
          me.st.spirits = 1;
          const x = strike(me, foe, 1, { sure: true });
          push({ type: 'attack', actor: a, target: t, dmg: x.dmg, crit: x.crit, big: true, text: `💀 Kadim savaşçıların ruhları mezarlarından kalktı! ${foe.name} ${x.dmg} hasar aldı; ruh ordusu artık her turda saldıracak.` });
          break;
        }
      }
    }

    function attackMove(me, foe, heavy) {
      const a = me.idx, t = foe.idx;
      if (!me.st.inspire && r() < 0.02 + me.s.charisma * 0.0012) {
        me.st.inspire = 1;
        push({ type: 'status', actor: a, text: `📯 ${me.name} bir savaş narası attı — moral tavan yaptı!` });
      }
      const verb = heavy ? 'tüm gücünü toplayıp ağır bir darbe indirdi' : pick(ATTACKS[me.classId]);
      const x = strike(me, foe, heavy ? 1.55 : 1, heavy ? { miss: 0.2 } : {});
      if (x.dodged) {
        push({ type: 'dodge', actor: a, target: t, text: `💨 ${me.name} ${verb}… ama ${foe.name} ${x.vanish ? 'çoktan gölgelere karışmıştı — ıska!' : pick(DODGES)}` });
      } else {
        push({
          type: 'attack', actor: a, target: t, dmg: x.dmg, crit: x.crit, big: heavy,
          text: `${x.crit ? '💥' : heavy ? '🔨' : '⚔️'} ${me.name} ${verb}! ${x.crit ? 'KRİTİK VURUŞ! ' : ''}${foe.name} ${x.dmg} hasar aldı.${guardNote(x)}`,
        });
      }
      if (heavy) return;
      // Hızlı olan taraf bazen ikinci bir saldırı yapar
      const diff = me.s.speed - foe.s.speed;
      if (diff > 0 && foe.hp > 0 && r() < Math.min(0.25, diff * 0.006)) {
        const y = strike(me, foe, 0.6);
        if (!y.dodged) push({ type: 'attack', actor: a, target: t, dmg: y.dmg, crit: y.crit, text: `⚡ ${me.name} o kadar hızlı ki bir kez daha vurdu! ${foe.name} ${y.dmg} hasar aldı.${guardNote(y)}` });
      }
    }

    const fight = {
      F, log,
      get round() { return round; },
      /* Henüz okunmamış günlük kayıtlarını döndürür. */
      drain() { const out = log.slice(drained); drained = log.length; return out; },
      done() { return F[0].hp <= 0 || F[1].hp <= 0 || round >= MAX_ROUNDS; },

      beginRound() {
        round++;
        push({ type: 'round', round, text: `— ${round}. Tur —` });
        const first = F[0].s.speed + r() * 25 >= F[1].s.speed + r() * 25 ? 0 : 1;
        F[first].tally.first++;
        return [first, 1 - first];
      },

      /* Tur başı etkileri uygular; false dönerse bu fighter bu tur hamle yapamaz. */
      startTurn(i) {
        const me = F[i];
        if (me.hp <= 0 || F[1 - i].hp <= 0) return false;
        me.st.guard = 0;
        if (me.st.burn > 0) {
          const d = Math.min(me.hp, Math.round(me.maxHp * 0.05));
          me.hp -= d;
          me.st.burn--;
          F[1 - i].tally.dmg += d;
          push({ type: 'dot', target: i, dmg: d, text: `🔥 ${me.name} ejderha alevleri içinde yanıyor: ${d} hasar.` });
          if (me.hp <= 0) return false;
        }
        if (me.st.frozen > 0) {
          me.st.frozen--;
          push({ type: 'status', actor: i, text: `❄️ ${me.name} buzun içinde donmuş, kıpırdayamıyor!` });
          return false;
        }
        if (me.st.rooted > 0) {
          me.st.rooted--;
          push({ type: 'status', actor: i, text: `🌿 ${me.name} köklerden kurtulmaya uğraşıyor, saldıramadı!` });
          return false;
        }
        if (me.st.charm > 0) {
          me.st.charm--;
          if (r() < 0.5) {
            push({ type: 'status', actor: i, text: `🎵 ${me.name} büyülü ezgiye kapıldı ve dans etmeden duramadı!` });
            return false;
          }
        }
        return true;
      },

      /* Bu fighter için şu an seçilebilir hamleler. */
      available(i) {
        const me = F[i];
        return { attack: true, heavy: true, defend: !me.defended, potion: me.potions > 0 && me.hp < me.maxHp, special: !me.usedSpecial };
      },

      act(i, move) {
        const me = F[i], foe = F[1 - i];
        if (!fight.available(i)[move]) move = 'attack';
        me.defended = move === 'defend';
        if (move === 'special') { me.usedSpecial = true; special(me, foe); }
        else if (move === 'heavy') attackMove(me, foe, true);
        else if (move === 'defend') {
          me.st.guard = 1;
          const h = heal(me, me.maxHp * 0.05);
          push({ type: 'heal', actor: i, heal: h, text: `🧱 ${me.name} savunma duruşuna geçti ve ${h} can topladı.` });
        } else if (move === 'potion') {
          me.potions--;
          const h = heal(me, me.maxHp * 0.3);
          push({ type: 'heal', actor: i, heal: h, text: `🧪 ${me.name} bir şifa iksiri içti: +${h} can. (Kalan iksir: ${me.potions})` });
        } else attackMove(me, foe, false);
      },

      endTurn(i) {
        const me = F[i], foe = F[1 - i];
        if (me.st.spirits && foe.hp > 0 && me.hp > 0) {
          const x = strike(me, foe, 0.5, { sure: true, noCrit: true });
          const h = heal(me, x.dmg * 0.6);
          push({ type: 'attack', actor: i, target: 1 - i, dmg: x.dmg, heal: h, text: `👻 Ruh ordusu saldırdı: ${foe.name} ${x.dmg} hasar aldı, ${me.name} ${h} can emdi.` });
        }
        if (me.st.ballad > 0) me.st.ballad--;
      },

      /* İzle modundaki otomatik oyuncu (denge bu davranışa göre ayarlandı). */
      autoMove(i) {
        const me = F[i];
        return !me.usedSpecial && (me.hp < me.maxHp * 0.55 || round >= 5) && r() < 0.7 ? 'special' : 'attack';
      },

      /* Oyuncuya karşı oynayan bilgisayar: iksir, savunma ve ağır darbeyi de kullanır. */
      aiMove(i) {
        const me = F[i], foe = F[1 - i];
        const hp = me.hp / me.maxHp;
        const av = fight.available(i);
        if (av.special && (hp < 0.6 || round >= 3) && r() < 0.6) return 'special';
        if (av.potion && hp < 0.3 && r() < 0.7) return 'potion';
        if (foe.st.guard) return 'attack';
        const x = r();
        if (x < 0.2) return 'heavy';
        if (x < 0.3 && av.defend) return 'defend';
        return 'attack';
      },

      finish() {
        if (finished) return finished;
        let winner, timeout = false;
        if (F[0].hp <= 0 || F[1].hp <= 0) winner = F[0].hp > 0 ? 0 : 1;
        else {
          timeout = true;
          winner = F[0].hp / F[0].maxHp >= F[1].hp / F[1].maxHp ? 0 : 1;
        }
        const W = F[winner];
        const close = W.hp / W.maxHp < 0.15;
        push({
          type: 'end', winner,
          text: timeout
            ? `⏳ Süre doldu! Daha ayakta kalan taraf kazandı: 🏆 ${W.name}!`
            : `🏆 ${F[1 - winner].name} yere düştü! ${close ? 'Kıl payı bir zafer: ' : 'Zafer: '}${W.name}!`,
        });
        finished = {
          winner, rounds: round, timeout, close, log,
          fighters: F.map((f) => ({ name: f.name, classId: f.classId, hp: f.hp, maxHp: f.maxHp, tally: f.tally })),
        };
        return finished;
      },
    };

    push({ type: 'intro', text: `🏟️ Arena kapıları açıldı! ${F[0].name} ve ${F[1].name} karşı karşıya.` });
    return fight;
  }

  /* İki tarafı da otomatik oynatan tam dövüş. */
  function simulate(A, B, seed, withLog = true) {
    const f = create(A, B, seed, withLog);
    while (!f.done()) {
      for (const i of f.beginRound()) {
        if (f.F[0].hp <= 0 || f.F[1].hp <= 0) break;
        if (f.startTurn(i)) {
          f.act(i, f.autoMove(i));
          f.endTurn(i);
        }
      }
    }
    return f.finish();
  }

  /* Aynı eşleşmeyi n kez simüle edip A'nın kazanma oranını döndürür. */
  function odds(A, B, key, n = 1000) {
    let w = 0;
    for (let i = 0; i < n; i++) if (simulate(A, B, hash(`${key}#${i}`), false).winner === 0) w++;
    return w / n;
  }

  /* "Neden?" bölümü için kısa analiz maddeleri. */
  function analysis(A, B, oddsA, names) {
    const out = [];
    const ca = CLASSES[A.classId], cb = CLASSES[B.classId];
    const aAdv = COUNTERS[A.classId].includes(B.classId);
    const bAdv = COUNTERS[B.classId].includes(A.classId);
    if (aAdv && bAdv) out.push(`⚖️ Karşılıklı element avantajı: ${ca.element} ve ${cb.element} birbirine karşı eşit derecede etkili.`);
    else if (aAdv) out.push(`🌀 Element avantajı: ${ca.name} (${ca.element}), ${cb.name} karşısında %15 daha fazla hasar veriyor.`);
    else if (bAdv) out.push(`🌀 Element avantajı: ${cb.name} (${cb.element}), ${ca.name} karşısında %15 daha fazla hasar veriyor.`);
    else out.push('🌀 İki sınıf arasında element avantajı yok; dövüş tamamen özelliklere kalmış.');

    const ds = A.stats.speed - B.stats.speed;
    if (Math.abs(ds) >= 8) out.push(`⚡ Hız farkı: ${ds > 0 ? names[0] : names[1]} daha hızlı (${Math.max(A.stats.speed, B.stats.speed)} ve ${Math.min(A.stats.speed, B.stats.speed)}); daha sık ilk saldıran ve daha çok kaçan taraf.`);
    const hpA = maxHpOf(A.stats);
    const hpB = maxHpOf(B.stats);
    if (Math.abs(hpA - hpB) >= 30) out.push(`🛡️ Dayanıklılık: ${hpA > hpB ? names[0] : names[1]} daha fazla cana sahip (${Math.round(Math.max(hpA, hpB))} ve ${Math.round(Math.min(hpA, hpB))}).`);
    const ia = A.stats.intel, ib = B.stats.intel;
    if (Math.abs(ia - ib) >= 15) out.push(`🧠 Zeka farkı: ${ia > ib ? names[0] : names[1]} kritik vuruşa daha yatkın.`);

    const fav = oddsA >= 0.5 ? names[0] : names[1];
    const p = Math.round(Math.max(oddsA, 1 - oddsA) * 100);
    if (p >= 75) out.push(`📊 Sonuç: ${fav} ezici favori; 100 dövüşün yaklaşık ${p} tanesini kazanıyor.`);
    else if (p >= 58) out.push(`📊 Sonuç: ${fav} hafif favori; 100 dövüşün yaklaşık ${p} tanesini kazanıyor.`);
    else out.push(`📊 Sonuç: Tam bir yazı tura! Taraflar neredeyse eşit (%${p} - %${100 - p}).`);
    return out;
  }

  return { create, simulate, odds, analysis, hash, rng, COUNTERS, MOVES, SPECIAL_HINT };
})();
