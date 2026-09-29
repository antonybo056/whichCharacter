'use strict';

/*
 * Portre motoru: fotoğrafı analiz eder, sınıfa özel renk haritası + mürekkep
 * çizgileri + parçacık efektleriyle stilize eder ve paylaşılabilir kart çizer.
 * Her şey tarayıcıda, <canvas> üzerinde gerçekleşir.
 */
const Portrait = (() => {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
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

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Görsel okunamadı'));
      img.src = src instanceof Blob ? URL.createObjectURL(src) : src;
    });
  }

  async function fontsReady() {
    try {
      await Promise.all([
        document.fonts.load('900 60px Cinzel'),
        document.fonts.load('700 30px Cinzel'),
        document.fonts.load('600 24px Inter'),
        document.fonts.load('italic 400 24px Inter'),
      ]);
    } catch (e) { /* yedek yazı tipleriyle devam */ }
  }

  /* Yüzü (tarayıcı destekliyorsa) bulup kare bir kırpma alanı döndürür. */
  async function findCrop(img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const min = Math.min(w, h);
    let side = min, cx = w / 2, cy = h > w ? h * 0.4 : h / 2, face = null;
    if ('FaceDetector' in window) {
      try {
        const faces = await new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 }).detect(img);
        if (faces[0]) face = faces[0].boundingBox;
      } catch (e) { /* desteklenmiyor */ }
    }
    if (face) {
      side = clamp(face.width * 2.6, min * 0.35, min);
      cx = face.x + face.width / 2;
      cy = face.y + face.height * 0.6;
    }
    return { sx: clamp(cx - side / 2, 0, w - side), sy: clamp(cy - side / 2, 0, h - side), side, face: !!face };
  }

  /* Fotoğrafın baskın rengini (doygunluk ağırlıklı ton ortalaması) bulur. */
  function analyze(img, crop) {
    const N = 48;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, crop.sx, crop.sy, crop.side, crop.side, 0, 0, N, N);
    const d = x.getImageData(0, 0, N, N).data;
    let vx = 0, vy = 0, lsum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
      lsum += l;
      if (max === min) continue;
      const s = (max - min) / (1 - Math.abs(2 * l - 1) || 1);
      let hue;
      if (max === r) hue = ((g - b) / (max - min)) % 6;
      else if (max === g) hue = (b - r) / (max - min) + 2;
      else hue = (r - g) / (max - min) + 4;
      const rad = hue * Math.PI / 3;
      vx += Math.cos(rad) * s;
      vy += Math.sin(rad) * s;
    }
    const n = N * N;
    const hue = (Math.atan2(vy, vx) * 180 / Math.PI + 360) % 360;
    const sat = Math.hypot(vx, vy) / n;
    const light = lsum / n;

    let key;
    if (sat < 0.1) key = light < 0.35 ? 'shadow' : light > 0.62 ? 'silver' : 'mist';
    else if (hue < 18 || hue >= 340) key = 'crimson';
    else if (hue < 45) key = 'amber';
    else if (hue < 70) key = 'gold';
    else if (hue < 160) key = 'emerald';
    else if (hue < 200) key = 'teal';
    else if (hue < 250) key = 'sapphire';
    else if (hue < 290) key = 'amethyst';
    else key = 'rose';
    return { hue, sat, light, key, ...AURAS[key] };
  }

  function drawPlaceholder(x, cls, S) {
    const g = x.createRadialGradient(S / 2, S * 0.42, S * 0.05, S / 2, S * 0.5, S * 0.75);
    g.addColorStop(0, '#9c9c9c');
    g.addColorStop(0.45, '#4a4a4a');
    g.addColorStop(1, '#050505');
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    x.save();
    x.font = `${Math.round(S * 0.56)}px ${EMOJI_FONT}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.shadowColor = 'rgba(0,0,0,.85)';
    x.shadowBlur = S * 0.06;
    x.fillText(cls.emoji, S / 2, S * 0.56);
    x.restore();
  }

  /* Işıklılığa göre 4 duraklı sınıf rengini örnekler. */
  function makeRamp(hexes) {
    const stops = [0, 0.36, 0.72, 1];
    const cols = hexes.map(hexToRgb);
    const lut = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255;
      let k = 0;
      while (k < 2 && t > stops[k + 1]) k++;
      const f = (t - stops[k]) / (stops[k + 1] - stops[k]);
      for (let c = 0; c < 3; c++) lut[i * 3 + c] = cols[k][c] + (cols[k + 1][c] - cols[k][c]) * f;
    }
    return lut;
  }

  function stylize(source, cls, seed, S = 760) {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d', { willReadFrequently: true });
    if (source) x.drawImage(source.img, source.crop.sx, source.crop.sy, source.crop.side, source.crop.side, 0, 0, S, S);
    else drawPlaceholder(x, cls, S);

    const id = x.getImageData(0, 0, S, S);
    const d = id.data;
    const N = S * S;
    const lum = new Float32Array(N);
    const hist = new Uint32Array(256);
    for (let i = 0, j = 0; i < N; i++, j += 4) {
      const l = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
      lum[i] = l;
      hist[l | 0]++;
    }
    // Otomatik seviye: %2 ve %98'lik dilimler
    let lo = 0, hi = 255, acc = 0;
    for (let k = 0; k < 256; k++) { acc += hist[k]; if (acc > N * 0.02) { lo = k; break; } }
    acc = 0;
    for (let k = 255; k >= 0; k--) { acc += hist[k]; if (acc > N * 0.02) { hi = k; break; } }
    const range = Math.max(40, hi - lo);

    // Kenarlar: 3x3 bulanıklaştırma + Sobel
    const bl = new Float32Array(N);
    for (let y = 1; y < S - 1; y++) {
      for (let xx = 1; xx < S - 1; xx++) {
        const i = y * S + xx;
        bl[i] = (lum[i - S - 1] + lum[i - S] + lum[i - S + 1] + lum[i - 1] + lum[i] + lum[i + 1] + lum[i + S - 1] + lum[i + S] + lum[i + S + 1]) / 9;
      }
    }
    const edge = new Float32Array(N);
    const sample = [];
    for (let y = 2; y < S - 2; y++) {
      for (let xx = 2; xx < S - 2; xx++) {
        const i = y * S + xx;
        const gx = -bl[i - S - 1] - 2 * bl[i - 1] - bl[i + S - 1] + bl[i - S + 1] + 2 * bl[i + 1] + bl[i + S + 1];
        const gy = -bl[i - S - 1] - 2 * bl[i - S] - bl[i - S + 1] + bl[i + S - 1] + 2 * bl[i + S] + bl[i + S + 1];
        const m = Math.sqrt(gx * gx + gy * gy);
        edge[i] = m;
        if (i % 37 === 0) sample.push(m);
      }
    }
    sample.sort((a, b) => a - b);
    const eref = Math.max(12, sample[Math.floor(sample.length * 0.92)] || 12);

    const lut = makeRamp(cls.ramp);
    const ink = hexToRgb(cls.ramp[0]);
    for (let i = 0, j = 0; i < N; i++, j += 4) {
      let L = clamp((lum[i] - lo) / range, 0, 1);
      L = L * 0.45 + L * L * (3 - 2 * L) * 0.55;          // kontrast
      L = L * 0.55 + (Math.round(L * 5) / 5) * 0.45;      // hafif posterize (boyalı görünüm)
      L = 0.07 + L * 0.93;                                 // gölgeleri biraz aç
      const k = Math.round(L * 255) * 3;
      const e = smooth(0.45, 1.25, edge[i] / eref) * 0.58;
      const grain = (Math.random() - 0.5) * 10;
      for (let ch = 0; ch < 3; ch++) {
        let v = lut[k + ch] * 0.8 + d[j + ch] * 0.2;
        v = v * (1 - e) + ink[ch] * e;
        d[j + ch] = v + grain;
      }
    }
    x.putImageData(id, 0, 0);

    const r = rng(seed);
    drawAura(x, cls, S);
    drawParticles(x, cls, S, r);
    drawVignette(x, S);
    return c;
  }

  function drawAura(x, cls, S) {
    x.save();
    x.globalCompositeOperation = 'screen';
    const g = x.createRadialGradient(S / 2, S * 0.45, S * 0.25, S / 2, S * 0.5, S * 0.72);
    g.addColorStop(0, rgba(cls.accent, 0));
    g.addColorStop(1, rgba(cls.accent, 0.38));
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    const b = x.createLinearGradient(0, S, 0, S * 0.6);
    b.addColorStop(0, rgba(cls.accent, 0.35));
    b.addColorStop(1, rgba(cls.accent, 0));
    x.fillStyle = b;
    x.fillRect(0, 0, S, S);
    x.restore();
  }

  function drawVignette(x, S) {
    const g = x.createRadialGradient(S / 2, S / 2, S * 0.38, S / 2, S / 2, S * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.6)');
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
  }

  /* Parçacıkları yüzün üstüne değil çevresine yerleştirmek için merkezden iter. */
  function edgePoint(r, S, minDist = 0.3) {
    let px = r() * S, py = r() * S;
    const dx = px - S / 2, dy = py - S * 0.45;
    const dist = Math.hypot(dx, dy) / S;
    if (dist < minDist) {
      const a = Math.atan2(dy, dx) || r() * Math.PI * 2;
      const push = (minDist + r() * 0.15) * S;
      px = S / 2 + Math.cos(a) * push;
      py = S * 0.45 + Math.sin(a) * push;
    }
    return [px, py];
  }

  function glowDot(x, px, py, rad, color, glow) {
    x.shadowColor = color;
    x.shadowBlur = glow;
    x.fillStyle = color;
    x.beginPath();
    x.arc(px, py, rad, 0, Math.PI * 2);
    x.fill();
  }

  function glyph(x, ch, px, py, size, color, alpha, glow, rot = 0, font = 'serif') {
    x.save();
    x.translate(px, py);
    x.rotate(rot);
    x.globalAlpha = alpha;
    x.font = `${size}px ${font}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.shadowColor = color;
    x.shadowBlur = glow;
    x.fillStyle = color;
    x.fillText(ch, 0, 0);
    x.restore();
  }

  function drawParticles(x, cls, S, r) {
    const a = cls.accent, hi = cls.ramp[3];
    x.save();
    x.globalCompositeOperation = 'screen';
    switch (cls.particles) {
      case 'runes': {
        const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
        for (let i = 0; i < 24; i++) {
          const [px, py] = edgePoint(r, S, 0.34);
          glyph(x, runes[(r() * runes.length) | 0], px, py, 16 + r() * 30, a, 0.35 + r() * 0.55, 16, (r() - 0.5) * 0.6);
        }
        x.globalAlpha = 0.55;
        x.strokeStyle = a;
        x.shadowColor = a;
        x.shadowBlur = 14;
        for (let k = 0; k < 3; k++) {
          x.lineWidth = 2 - k * 0.5;
          x.beginPath();
          x.ellipse(S / 2, S * 0.93, S * (0.46 - k * 0.07), S * (0.08 - k * 0.012), 0, 0, Math.PI * 2);
          x.stroke();
        }
        for (let i = 0; i < 40; i++) glowDot(x, r() * S, r() * S, 0.6 + r() * 1.6, hi, 8);
        break;
      }
      case 'rays': {
        for (let i = 0; i < 9; i++) {
          const ang = Math.PI / 2 + (i - 4) * 0.16 + (r() - 0.5) * 0.05;
          const w = 0.03 + r() * 0.04;
          const g = x.createLinearGradient(S / 2, -S * 0.1, S / 2, S);
          g.addColorStop(0, rgba(hi, 0.5));
          g.addColorStop(1, rgba(a, 0));
          x.fillStyle = g;
          x.beginPath();
          x.moveTo(S / 2, -S * 0.12);
          x.lineTo(S / 2 + Math.cos(ang - w) * S * 1.4, -S * 0.12 + Math.sin(ang - w) * S * 1.4);
          x.lineTo(S / 2 + Math.cos(ang + w) * S * 1.4, -S * 0.12 + Math.sin(ang + w) * S * 1.4);
          x.closePath();
          x.globalAlpha = 0.35 + r() * 0.3;
          x.fill();
        }
        x.globalAlpha = 1;
        for (let i = 0; i < 26; i++) {
          const [px, py] = edgePoint(r, S, 0.3);
          const s = 3 + r() * 9;
          x.save();
          x.translate(px, py);
          x.shadowColor = a;
          x.shadowBlur = 12;
          x.fillStyle = hi;
          x.beginPath();
          for (let k = 0; k < 8; k++) {
            const rr = k % 2 ? s * 0.22 : s;
            const an = k * Math.PI / 4;
            x.lineTo(Math.cos(an) * rr, Math.sin(an) * rr);
          }
          x.closePath();
          x.fill();
          x.restore();
        }
        break;
      }
      case 'leaves': {
        x.globalCompositeOperation = 'source-over';
        const greens = ['#3f8f4a', '#7ee081', '#b8e986', '#2d6b3a', '#d8c35a'];
        for (let i = 0; i < 30; i++) {
          const [px, py] = edgePoint(r, S, 0.36);
          x.save();
          x.translate(px, py);
          x.rotate(r() * Math.PI * 2);
          x.globalAlpha = 0.55 + r() * 0.4;
          x.fillStyle = greens[(r() * greens.length) | 0];
          x.shadowColor = 'rgba(0,0,0,.4)';
          x.shadowBlur = 6;
          const L = 10 + r() * 16;
          x.beginPath();
          x.moveTo(-L, 0);
          x.quadraticCurveTo(0, -L * 0.55, L, 0);
          x.quadraticCurveTo(0, L * 0.55, -L, 0);
          x.fill();
          x.strokeStyle = 'rgba(0,0,0,.25)';
          x.lineWidth = 1;
          x.beginPath();
          x.moveTo(-L, 0);
          x.lineTo(L, 0);
          x.stroke();
          x.restore();
        }
        x.globalCompositeOperation = 'screen';
        for (let i = 0; i < 30; i++) glowDot(x, r() * S, r() * S, 0.8 + r() * 1.8, '#eaffdf', 10);
        break;
      }
      case 'embers':
      case 'fire': {
        if (cls.particles === 'fire') {
          const g = x.createLinearGradient(0, S, 0, S * 0.55);
          g.addColorStop(0, 'rgba(255,140,40,.75)');
          g.addColorStop(0.5, 'rgba(216,64,42,.35)');
          g.addColorStop(1, 'rgba(216,64,42,0)');
          x.fillStyle = g;
          x.filter = 'blur(7px)';
          for (let i = 0; i < 16; i++) {
            const bx = (i / 15) * S + (r() - 0.5) * 40;
            const h = S * (0.1 + r() * 0.22);
            const w = 26 + r() * 40;
            const sway = (r() - 0.5) * 50;
            x.globalAlpha = 0.45 + r() * 0.35;
            x.beginPath();
            x.moveTo(bx - w, S);
            x.bezierCurveTo(bx - w * 0.9, S - h * 0.45, bx + sway - w * 0.2, S - h * 0.7, bx + sway, S - h);
            x.bezierCurveTo(bx + sway * 0.4 + w * 0.3, S - h * 0.6, bx + w * 0.9, S - h * 0.4, bx + w, S);
            x.closePath();
            x.fill();
          }
          x.filter = 'none';
          x.globalAlpha = 1;
        }
        const cols = ['#ffb347', '#ff6b3d', '#ffd27a', '#ff3d1f'];
        for (let i = 0; i < 110; i++) {
          const px = r() * S;
          const py = S * (1 - Math.pow(r(), 1.8));
          glowDot(x, px, py, 0.8 + r() * 3.2, cols[(r() * cols.length) | 0], 12);
        }
        break;
      }
      case 'smoke': {
        x.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 16; i++) {
          const px = r() < 0.5 ? r() * S * 0.3 : S - r() * S * 0.3;
          const py = S * (0.35 + r() * 0.7);
          const rad = 80 + r() * 160;
          const g = x.createRadialGradient(px, py, 0, px, py, rad);
          g.addColorStop(0, 'rgba(4,8,20,.55)');
          g.addColorStop(1, 'rgba(4,8,20,0)');
          x.fillStyle = g;
          x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
        }
        x.globalCompositeOperation = 'screen';
        x.strokeStyle = rgba(a, 0.5);
        x.shadowColor = a;
        x.shadowBlur = 12;
        x.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) {
          const y0 = S * (0.2 + r() * 0.7);
          x.beginPath();
          x.moveTo(r() < 0.5 ? 0 : S, y0);
          x.bezierCurveTo(S * 0.3, y0 - 60 + r() * 120, S * 0.7, y0 - 60 + r() * 120, r() < 0.5 ? 0 : S, y0 + (r() - 0.5) * 200);
          x.globalAlpha = 0.25 + r() * 0.3;
          x.stroke();
        }
        x.globalAlpha = 1;
        for (let i = 0; i < 40; i++) {
          const [px, py] = edgePoint(r, S, 0.33);
          glowDot(x, px, py, 0.6 + r() * 1.8, hi, 10);
        }
        break;
      }
      case 'fireflies': {
        for (let i = 0; i < 46; i++) {
          const [px, py] = edgePoint(r, S, 0.3);
          const rad = 8 + r() * 18;
          const g = x.createRadialGradient(px, py, 0, px, py, rad);
          g.addColorStop(0, 'rgba(240,255,170,.9)');
          g.addColorStop(0.25, 'rgba(200,240,90,.45)');
          g.addColorStop(1, 'rgba(160,220,60,0)');
          x.fillStyle = g;
          x.globalAlpha = 0.5 + r() * 0.5;
          x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
        }
        x.globalAlpha = 0.55;
        x.strokeStyle = a;
        x.lineWidth = 3;
        x.shadowColor = a;
        x.shadowBlur = 10;
        for (let i = 0; i < 6; i++) {
          const bx = r() * S;
          x.beginPath();
          x.moveTo(bx, S);
          x.bezierCurveTo(bx + (r() - 0.5) * 120, S * 0.85, bx + (r() - 0.5) * 160, S * 0.8, bx + (r() - 0.5) * 100, S * (0.65 + r() * 0.15));
          x.stroke();
        }
        break;
      }
      case 'snow': {
        for (let i = 0; i < 140; i++) glowDot(x, r() * S, r() * S, 0.6 + r() * 2.6, '#ffffff', 8);
        for (let i = 0; i < 12; i++) {
          const [px, py] = edgePoint(r, S, 0.35);
          glyph(x, '❄', px, py, 18 + r() * 26, '#e8fbff', 0.5 + r() * 0.45, 14, r() * Math.PI, 'sans-serif');
        }
        x.globalAlpha = 0.5;
        x.strokeStyle = hi;
        x.shadowColor = a;
        x.shadowBlur = 12;
        x.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const bx = r() * S, h = S * (0.08 + r() * 0.16), w = 12 + r() * 22;
          x.beginPath();
          x.moveTo(bx - w, S);
          x.lineTo(bx, S - h);
          x.lineTo(bx + w, S);
          x.stroke();
        }
        break;
      }
      case 'notes': {
        const notes = ['♪', '♫', '♬', '♩'];
        x.globalAlpha = 0.45;
        x.strokeStyle = a;
        x.shadowColor = a;
        x.shadowBlur = 10;
        x.lineWidth = 1.2;
        for (let k = 0; k < 5; k++) {
          x.beginPath();
          for (let px = 0; px <= S; px += 8) {
            const py = S * 0.82 + k * 9 + Math.sin(px / 70) * 36;
            px ? x.lineTo(px, py) : x.moveTo(px, py);
          }
          x.stroke();
        }
        for (let i = 0; i < 22; i++) {
          const [px, py] = edgePoint(r, S, 0.34);
          glyph(x, notes[(r() * notes.length) | 0], px, py, 20 + r() * 32, hi, 0.5 + r() * 0.45, 16, (r() - 0.5) * 0.7);
        }
        for (let i = 0; i < 30; i++) glowDot(x, r() * S, r() * S, 0.6 + r() * 1.6, '#ffd6ec', 8);
        break;
      }
      case 'souls': {
        const fog = x.createLinearGradient(0, S, 0, S * 0.6);
        fog.addColorStop(0, rgba(a, 0.4));
        fog.addColorStop(1, rgba(a, 0));
        x.fillStyle = fog;
        x.fillRect(0, 0, S, S);
        for (let i = 0; i < 14; i++) {
          const [px, py] = edgePoint(r, S, 0.36);
          const L = 26 + r() * 40;
          x.save();
          x.translate(px, py);
          x.rotate((r() - 0.5) * 0.8);
          x.globalAlpha = 0.35 + r() * 0.45;
          x.shadowColor = a;
          x.shadowBlur = 22;
          const g = x.createLinearGradient(0, -L, 0, L);
          g.addColorStop(0, rgba(hi, 0.95));
          g.addColorStop(1, rgba(a, 0));
          x.fillStyle = g;
          x.beginPath();
          x.arc(0, -L * 0.55, L * 0.3, Math.PI, 0);
          x.quadraticCurveTo(L * 0.3, L * 0.3, (r() - 0.5) * L * 0.4, L);
          x.quadraticCurveTo(-L * 0.3, L * 0.3, -L * 0.3, -L * 0.55);
          x.fill();
          x.restore();
        }
        for (let i = 0; i < 40; i++) glowDot(x, r() * S, r() * S, 0.6 + r() * 1.6, hi, 10);
        break;
      }
    }
    x.restore();
  }

  function roundRect(x, px, py, w, h, rad) {
    x.beginPath();
    if (x.roundRect) { x.roundRect(px, py, w, h, rad); return; }
    x.moveTo(px + rad, py);
    x.arcTo(px + w, py, px + w, py + h, rad);
    x.arcTo(px + w, py + h, px, py + h, rad);
    x.arcTo(px, py + h, px, py, rad);
    x.arcTo(px, py, px + w, py, rad);
    x.closePath();
  }

  function fitFont(x, text, weight, family, maxSize, maxWidth) {
    let size = maxSize;
    do {
      x.font = `${weight} ${size}px ${family}`;
      size -= 2;
    } while (x.measureText(text).width > maxWidth && size > 14);
  }

  function diamond(x, cx, cy, s, color) {
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(cx, cy - s);
    x.lineTo(cx + s, cy);
    x.lineTo(cx, cy + s);
    x.lineTo(cx - s, cy);
    x.closePath();
    x.fill();
  }

  /* Paylaşılabilir karakter kartı (900x1300). */
  function renderCard({ portrait, cls, heroName, epithet, stats, rarity, power, footer }) {
    const W = 900, H = 1300, gold = '#e3c07a';
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');

    // Arka plan
    const bg = x.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, cls.ramp[1]);
    bg.addColorStop(0.45, cls.ramp[0]);
    bg.addColorStop(1, '#040308');
    x.fillStyle = bg;
    x.fillRect(0, 0, W, H);
    const glow = x.createRadialGradient(W / 2, 420, 50, W / 2, 420, 700);
    glow.addColorStop(0, rgba(cls.accent, 0.25));
    glow.addColorStop(1, rgba(cls.accent, 0));
    x.fillStyle = glow;
    x.fillRect(0, 0, W, H);

    // Çerçeve
    x.strokeStyle = rgba(gold, 0.85);
    x.lineWidth = 3;
    roundRect(x, 22, 22, W - 44, H - 44, 26);
    x.stroke();
    x.strokeStyle = rgba(gold, 0.35);
    x.lineWidth = 1;
    roundRect(x, 34, 34, W - 68, H - 68, 20);
    x.stroke();
    [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]].forEach(([px, py]) => diamond(x, px, py, 9, gold));

    // Başlık
    x.textAlign = 'center';
    x.textBaseline = 'alphabetic';
    x.fillStyle = rgba(gold, 0.9);
    x.font = '700 22px Cinzel, serif';
    if ('letterSpacing' in x) x.letterSpacing = '6px';
    x.fillText('✦  YOUR CHARACTER  ✦', W / 2, 80);
    if ('letterSpacing' in x) x.letterSpacing = '0px';

    // Portre
    const PX = 70, PY = 105, PW = 760, PH = 690;
    x.save();
    x.shadowColor = rgba(cls.accent, 0.7);
    x.shadowBlur = 40;
    roundRect(x, PX, PY, PW, PH, 24);
    x.fillStyle = '#000';
    x.fill();
    x.restore();
    x.save();
    roundRect(x, PX, PY, PW, PH, 24);
    x.clip();
    const cut = (portrait.height - portrait.width * (PH / PW)) / 2;
    x.drawImage(portrait, 0, cut, portrait.width, portrait.height - cut * 2, PX, PY, PW, PH);
    const fade = x.createLinearGradient(0, PY + PH * 0.7, 0, PY + PH);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,.55)');
    x.fillStyle = fade;
    x.fillRect(PX, PY, PW, PH);
    x.restore();
    x.strokeStyle = rgba(gold, 0.9);
    x.lineWidth = 2.5;
    roundRect(x, PX, PY, PW, PH, 24);
    x.stroke();

    // Nadirlik rozeti ve güç seviyesi
    x.font = '700 20px Cinzel, serif';
    const rText = `★ ${rarity.name.toLocaleUpperCase('tr-TR')}`;
    const rw = x.measureText(rText).width + 36;
    roundRect(x, PX + 20, PY + 20, rw, 42, 21);
    x.fillStyle = 'rgba(0,0,0,.6)';
    x.fill();
    x.strokeStyle = rarity.color;
    x.lineWidth = 2;
    x.stroke();
    x.fillStyle = rarity.color;
    x.textAlign = 'left';
    x.fillText(rText, PX + 38, PY + 48);

    x.textAlign = 'right';
    x.font = '600 14px Inter, sans-serif';
    x.fillStyle = 'rgba(255,255,255,.75)';
    x.fillText('GÜÇ SEVİYESİ', PX + PW - 24, PY + 38);
    x.font = '900 34px Cinzel, serif';
    x.fillStyle = '#fff';
    x.shadowColor = cls.accent;
    x.shadowBlur = 16;
    x.fillText(String(power), PX + PW - 24, PY + 72);
    x.shadowBlur = 0;

    // Amblem
    const EY = PY + PH;
    x.save();
    x.shadowColor = cls.accent;
    x.shadowBlur = 30;
    x.beginPath();
    x.arc(W / 2, EY, 60, 0, Math.PI * 2);
    const eg = x.createRadialGradient(W / 2, EY - 20, 5, W / 2, EY, 60);
    eg.addColorStop(0, cls.ramp[2]);
    eg.addColorStop(1, cls.ramp[0]);
    x.fillStyle = eg;
    x.fill();
    x.restore();
    x.strokeStyle = gold;
    x.lineWidth = 3;
    x.beginPath();
    x.arc(W / 2, EY, 60, 0, Math.PI * 2);
    x.stroke();
    x.font = `60px ${EMOJI_FONT}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(cls.emoji, W / 2, EY + 4);
    x.textBaseline = 'alphabetic';

    // Sınıf adı
    const title = cls.name.toLocaleUpperCase('tr-TR');
    fitFont(x, title, 900, 'Cinzel, serif', 62, 760);
    const tg = x.createLinearGradient(0, 860, 0, 920);
    tg.addColorStop(0, '#fff6dc');
    tg.addColorStop(1, gold);
    x.fillStyle = tg;
    x.shadowColor = rgba(cls.accent, 0.8);
    x.shadowBlur = 24;
    x.fillText(title, W / 2, 920);
    x.shadowBlur = 0;

    x.font = '700 20px Cinzel, serif';
    x.fillStyle = rgba(cls.accent, 0.95);
    if ('letterSpacing' in x) x.letterSpacing = '8px';
    x.fillText(cls.en.toUpperCase(), W / 2, 956);
    if ('letterSpacing' in x) x.letterSpacing = '0px';

    const heroLine = heroName ? `${heroName}, ${epithet}` : epithet;
    fitFont(x, heroLine, 'italic 400', 'Inter, sans-serif', 24, 740);
    x.fillStyle = 'rgba(255,255,255,.82)';
    x.fillText(heroLine, W / 2, 996);

    // Özellikler
    const colX = [80, 474], colW = 346, top = 1040, rowH = 62;
    STATS.forEach((s, i) => {
      const cx = colX[i % 2], cy = top + Math.floor(i / 2) * rowH;
      const v = stats[s.key];
      x.textAlign = 'left';
      x.font = '700 17px Cinzel, serif';
      x.fillStyle = 'rgba(255,255,255,.9)';
      x.fillText(s.en.toUpperCase(), cx, cy + 16);
      x.textAlign = 'right';
      x.font = '900 22px Cinzel, serif';
      x.fillStyle = '#fff';
      x.fillText(String(v), cx + colW, cy + 18);
      roundRect(x, cx, cy + 28, colW, 10, 5);
      x.fillStyle = 'rgba(255,255,255,.1)';
      x.fill();
      const bar = x.createLinearGradient(cx, 0, cx + colW, 0);
      bar.addColorStop(0, cls.ramp[2]);
      bar.addColorStop(1, cls.accent);
      x.save();
      x.shadowColor = cls.accent;
      x.shadowBlur = 10;
      roundRect(x, cx, cy + 28, Math.max(10, colW * v / 100), 10, 5);
      x.fillStyle = bar;
      x.fill();
      x.restore();
    });

    // Alt bilgi
    x.textAlign = 'center';
    x.font = '500 15px Inter, sans-serif';
    x.fillStyle = 'rgba(255,255,255,.45)';
    x.fillText(footer, W / 2, H - 52);
    return c;
  }

  return { loadImage, findCrop, analyze, stylize, renderCard, fontsReady, rng, hash, rgba };
})();
