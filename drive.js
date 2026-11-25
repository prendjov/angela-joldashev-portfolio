(() => {
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);

  /* ---------- time zones (both DST calendars, through Intl) ---------- */
  const HOME = 'Europe/Skopje', DAY = 1440;
  const ZONES = { ET: ['America/New_York', 'New York'], CT: ['America/Chicago', 'Chicago'], MT: ['America/Denver', 'Denver'], PT: ['America/Los_Angeles', 'L.A.'] };
  function offset(tz, date) {
    const p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(date).forEach((x) => { p[x.type] = +x.value; });
    return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime()) / 60000);
  }
  const wrap = (m) => ((m % DAY) + DAY) % DAY;
  const fmt = (m) => { m = wrap(Math.floor(m)); const h = Math.floor(m / 60); return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
  let zone = 'CT', ahead = 420;
  function clocks() {
    const now = new Date(), utc = Math.floor(now / 60000);
    ahead = offset(HOME, now) - offset(ZONES.CT[0], now);
    $('us-city').textContent = ZONES[zone][1];
    $('us-now').textContent = fmt(utc + offset(ZONES[zone][0], now));
    $('me-now').textContent = fmt(utc + offset(HOME, now));
    document.querySelectorAll('.veles').forEach((e) => { e.textContent = fmt(+e.dataset.ct + ahead); });
  }
  document.querySelectorAll('[data-zone]').forEach((b) => b.addEventListener('click', () => {
    zone = b.dataset.zone;
    document.querySelectorAll('[data-zone]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    clocks();
  }));
  clocks(); setInterval(clocks, 15000);

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ---------- the drive ---------- */
  document.documentElement.classList.add('go');
  const stops = [...document.querySelectorAll('.stop')].map((el) => ({
    el, sign: el.querySelector('.sign'), chat: el.querySelector('.chat'), time: +el.dataset.time, miles: +el.dataset.miles,
    overhead: !!el.querySelector('.overhead'), trailer: !!el.querySelector('.trailer'),
  }));
  const N = stops.length, GAP = 170, D0 = 14, CAMH = 2.5;
  const cv = $('road'), g = cv.getContext('2d');
  const heroCopy = document.querySelector('.hero-copy'), track = $('drive');
  let W, H, HL, hor, F, dpr, seg, dashH;
  let cam = 0, speed = 0, last = 0;

  function measure() {
    W = document.documentElement.clientWidth;
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;height:100svh;width:1px;visibility:hidden';
    document.body.append(probe); H = probe.offsetHeight; probe.remove();
    HL = cv.offsetHeight || H;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    cv.width = Math.round(W * dpr); cv.height = Math.round(HL * dpr);
    const wide = W >= 900;
    hor = H * (wide ? 0.56 : 0.5); F = H * 0.85;
    seg = H * (wide ? 1.25 : 1.05);
    dashH = document.querySelector('.dash').offsetHeight;
    track.style.height = `${seg * (N - 1) + H}px`;
    stops.forEach((s) => {
      s.w = s.sign.offsetWidth; s.h = s.sign.offsetHeight;
      const extra = s.sign.classList.contains('diamond') ? s.w * 0.2 : 0;
      const floor = s.chat ? (wide ? H * 0.82 : H - dashH - s.chat.offsetHeight - 14) : (s.trailer ? H - dashH : Math.min(H * (wide ? 0.53 : 0.56), H - dashH - heroCopy.offsetHeight - 28));
      const room = floor - 66;
      s.fit = Math.min(1, room / (s.h + extra));
      s.sy = 66 + Math.max(0, (room - (s.h + extra) * s.fit) * (s.trailer ? 0.95 : 0.4)) - hor;
      const sw = s.w * s.fit;
      s.sx = wide && s.sign.classList.contains('side') ? Math.min(W * 0.05, W / 2 - sw - 48) : -sw / 2;
      s.sign.style.setProperty('--post', `${Math.max(0, (F * CAMH / D0 - s.sy) / s.fit - s.h)}px`);
    });
  }

  /* scroll position to distance: slow near every sign, fast between them */
  const camFor = (p) => {
    const k = Math.min(N - 2, Math.floor(p)), t = p - k, hold = 0.24, creep = 1.1;
    if (t < hold) return k * GAP + (t / hold) * creep;
    if (t > 1 - hold) return (k + 1) * GAP - ((1 - t) / hold) * creep;
    return lerp(k * GAP + creep, (k + 1) * GAP - creep, smooth((t - hold) / (1 - 2 * hold)));
  };

  /* the night's palette: sky top, sky middle, sky low, ground, light */
  const KEY = [
    [[39, 48, 107], [214, 92, 62], [255, 190, 98], [66, 60, 30], 0.75],
    [[18, 24, 66], [112, 54, 92], [238, 128, 74], [32, 33, 24], 0.42],
    [[6, 10, 32], [24, 28, 70], [72, 48, 88], [13, 16, 16], 0.16],
    [[2, 4, 13], [6, 12, 32], [16, 27, 56], [6, 8, 8], 0.05],
    [[2, 4, 13], [5, 10, 27], [13, 23, 48], [5, 7, 7], 0.04],
    [[2, 4, 14], [6, 12, 32], [18, 30, 62], [6, 8, 8], 0.05],
    [[27, 47, 99], [125, 90, 134], [244, 150, 104], [38, 40, 30], 0.5],
    [[63, 120, 184], [240, 168, 110], [255, 216, 143], [86, 94, 46], 0.85],
    [[70, 146, 210], [160, 208, 232], [255, 238, 204], [104, 122, 54], 1],
  ];
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const mul = (a, k) => [Math.min(255, a[0] * k), Math.min(255, a[1] * k), Math.min(255, a[2] * k)];
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  function palette(u) {
    const k = clamp(Math.floor(u), 0, KEY.length - 2), t = clamp(u - k), a = KEY[k], b = KEY[k + 1];
    return { top: mix(a[0], b[0], t), mid: mix(a[1], b[1], t), low: mix(a[2], b[2], t), ground: mix(a[3], b[3], t), light: lerp(a[4], b[4], t) };
  }
  const rnd = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const STARS = Array.from({ length: 150 }, (_, i) => [rnd(i), rnd(i + 500) ** 1.3, 0.6 + rnd(i + 900) * 1.4]);
  const TURB = Array.from({ length: 11 }, (_, i) => [(i + rnd(i + 40) * 0.8) / 11, 0.5 + rnd(i + 70) * 0.7, rnd(i + 20) * 6]);

  /* words painted on the lane */
  const PAINT = ['ROLL', 'CALM', 'LEGAL', 'AWAKE', 'COOL', 'EARLY', 'PAID', 'HOME'];
  let paints = [];
  function makePaint() {
    paints = PAINT.map((txt, i) => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 200;
      const x = c.getContext('2d');
      x.font = '900 100px Overpass, sans-serif';
      const size = Math.min(250, 100 * 560 / x.measureText(txt).width), stretch = 185 / (size * 0.74);
      x.font = `900 ${size}px Overpass, sans-serif`; x.fillStyle = '#f2f0e6'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
      x.setTransform(1, 0, 0, stretch, 0, 0); x.fillText(txt, 320, 192 / stretch);
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-out';
      for (let n = 0; n < 420; n++) { x.globalAlpha = 0.5 * rnd(n + i * 91); x.fillRect(rnd(n + i) * 640, rnd(n * 3 + i) * 200, 2 + rnd(n) * 7, 1 + rnd(n + 7) * 2); }
      return { c, z: i * GAP + GAP * 0.55, len: 7.5 };
    });
  }
  function spark(stopsList) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), r = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    stopsList.forEach(([o, col]) => r.addColorStop(o, col)); x.fillStyle = r; x.fillRect(0, 0, 64, 64); return c;
  }
  const glow = spark([[0, '#fff'], [0.18, '#fff8e0'], [0.4, 'rgba(255,240,200,.35)'], [1, 'rgba(255,240,200,0)']]);
  const red = spark([[0, '#ffb0a0'], [0.2, '#ff2a20'], [1, 'rgba(255,20,10,0)']]);

  const bend = (d) => Math.sin(cam / 118) * W * 0.16 * (d / (d + 90)) * (1 - Math.exp(-d / 60));
  const px = (X, d) => W / 2 + bend(d) + F * X / d;
  const py = (Y, d) => hor + F * (CAMH - Y) / d;

  function draw(ms) {
    const u = cam / GAP, P = palette(u), night = 1 - P.light;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, hor);
    sky.addColorStop(0, rgb(P.top)); sky.addColorStop(0.62, rgb(P.mid)); sky.addColorStop(1, rgb(P.low));
    g.fillStyle = sky; g.fillRect(0, 0, W, hor + 1);

    const starA = clamp((night - 0.6) * 2.6);
    if (starA > 0) {
      g.fillStyle = '#fff';
      STARS.forEach(([x, y, r], i) => { g.globalAlpha = starA * (0.45 + 0.55 * Math.abs(Math.sin(ms / 1400 + i))); g.fillRect(x * W, y * hor * 0.9, r, r); });
      g.globalAlpha = 1;
    }

    /* the sun sets behind you leaving, and rises as you arrive */
    if (u < 1.4 || u > 5.6) {
      const rise = u > 3, sunY = rise ? lerp(0.14, -0.24, (u - 6.2) / 1.8) : lerp(-0.07, 0.16, u / 1.1);
      const sx = W / 2 + bend(900) + (rise ? W * 0.17 : -W * (W >= 900 ? 0.33 : 0.13)), sy = hor + sunY * H, r = Math.max(34, H * 0.075);
      const gl = g.createRadialGradient(sx, sy, r * 0.3, sx, sy, r * 7);
      gl.addColorStop(0, 'rgba(255,224,150,.75)'); gl.addColorStop(0.25, 'rgba(255,160,80,.28)'); gl.addColorStop(1, 'rgba(255,140,60,0)');
      g.fillStyle = gl; g.fillRect(0, 0, W, hor);
      g.save(); g.beginPath(); g.rect(0, 0, W, hor); g.clip(); g.fillStyle = '#fff1c4'; g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill(); g.restore();
    }

    /* wind farm: every beacon blinks at the same moment, as they do along I-65 */
    const far = mix(P.low, P.ground, 0.55), blink = (ms % 1700) < 420;
    g.strokeStyle = rgb(far); g.lineCap = 'round';
    TURB.forEach(([x, s, a]) => {
      const tx = (x * 1.3 - 0.15) * W + bend(1200) * (0.5 + s * 0.4), h = H * 0.12 * s, ty = hor - h;
      g.lineWidth = 2.4 * s; g.beginPath(); g.moveTo(tx, hor); g.lineTo(tx, ty); g.stroke();
      g.lineWidth = 1.7 * s;
      for (let b = 0; b < 3; b++) { const an = a + ms / 1500 + b * 2.094; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + Math.cos(an) * h * 0.46, ty + Math.sin(an) * h * 0.46); g.stroke(); }
      if (night > 0.45 && blink) { g.globalAlpha = clamp((night - 0.45) * 3); g.drawImage(red, tx - 9, ty - 9, 18, 18); g.globalAlpha = 1; }
    });
    g.fillStyle = rgb(mix(far, P.ground, 0.5)); g.beginPath(); g.moveTo(0, hor + 2);
    for (let x = 0; x <= W + 8; x += 8) { const n = (x - bend(700) * 0.8) / 34; g.lineTo(x, hor - 3 - 7 * rnd(Math.floor(n)) - 4 * Math.abs(Math.sin(n * 0.3))); }
    g.lineTo(W, hor + 2); g.fill();

    /* ground and road, one scanline at a time */
    const step = Math.max(1, Math.round(dpr)) / dpr, DAYROAD = [78, 78, 82], LIT = [70, 74, 40], WHITE = [255, 255, 255], YEL = [255, 190, 20];
    for (let y = Math.ceil(hor * dpr) / dpr + 1 / dpr; y < HL; y += step) {
      const d = F * CAMH / (y - hor), wz = cam + d, cx = W / 2 + bend(d), k = F / d;
      const head = night * Math.exp(-d / 34) * 0.62, haze = clamp(d / 520) * 0.65;
      const L = clamp(P.light * 0.95 + head + 0.05);
      const grain = 1 + ((Math.floor(wz / 2.2) & 1) ? 0.05 : -0.03) * clamp(40 / d);
      g.fillStyle = rgb(mix(mul(mix(P.ground, LIT, head * 0.6), grain), P.low, haze * 0.5)); g.fillRect(0, y, W, step);
      g.fillStyle = rgb(mix(mul(DAYROAD, L * (1 + (grain - 1) * 0.35)), P.low, haze * 0.45));
      g.fillRect(cx - 7.2 * k, y, 12 * k, step);
      g.fillRect(cx - 29 * k, y, 11 * k, step);
      const lw = Math.max(0.15 * k, 0.6);
      g.fillStyle = rgb(mix(mul(WHITE, clamp(L * 0.95 + 0.14)), P.low, haze * 0.5));
      g.fillRect(cx + 1.95 * k, y, lw, step);
      if (((wz % 12) + 12) % 12 < 3.2) g.fillRect(cx - 2 * k, y, lw, step);
      g.fillStyle = rgb(mix(mul(YEL, clamp(L + 0.12)), P.low, haze * 0.5)); g.fillRect(cx - 5.7 * k, y, lw, step);
      for (const p of paints) {
        const v = (wz - p.z) / p.len;
        if (v >= 0 && v < 1) { g.globalAlpha = clamp(L * 0.9 + 0.16) * 0.92; g.drawImage(p.c, 0, Math.min(199, (1 - v) * 200), 640, 1, cx - 1.75 * k, y, 3.5 * k, step); g.globalAlpha = 1; }
      }
    }

    /* things beside the road, far to near */
    const sil = mix(P.ground, [0, 0, 0], 0.45), items = [];
    const near = (sp, max, fn) => { for (let i = Math.ceil((cam + 3) / sp); i * sp < cam + max; i++) fn(i, i * sp - cam); };
    near(13, 420, (i, d) => { const r = rnd(i), s = rnd(i + 99) > 0.5 ? 1 : -1; if (r > 0.35) items.push([d, () => tree(s * (s < 0 ? 36 : 17) + s * rnd(i + 5) * 46, d, 5 + r * 9, i)]); });
    near(46, 330, (i, d) => items.push([d, () => pole(10.5, d, 46)]));
    near(30, 190, (i, d) => items.push([d, () => marker(5.6, d)]));
    stops.forEach((s, i) => { const d = i * GAP + D0 - cam; if (s.overhead && d > 4 && d < 420) items.push([d, () => gantry(s, d)]); });
    for (let n = 0; n < 4; n++) { const d = 12 + ((((n * 151 - ms * 0.052 - cam) % 600) + 600) % 600); items.push([d, () => lamps(-22.5 + (n & 1) * 3.7, d)]); }
    const td = 78 + 26 * Math.sin(ms / 5200);
    if (u < N - 1.6) items.push([td, () => truckAhead(-3.85, td)]);
    items.sort((a, b) => b[0] - a[0]).forEach((x) => x[1]());

    function tree(X, d, h, i) {
      const x = px(X, d), y = py(0, d), k = F / d; if (x < -200 || x > W + 200) return;
      g.fillStyle = rgb(mix(sil, P.low, clamp(d / 420) * 0.7));
      const w = h * 0.36 * k; g.fillRect(x - 0.2 * k, y - h * 0.4 * k, 0.4 * k, h * 0.4 * k);
      g.beginPath();
      for (let b = 0; b < 4; b++) { const bx = x + (rnd(i + b) - 0.5) * w, by = y - h * k * (0.45 + b * 0.14), br = w * (0.75 - b * 0.12); g.moveTo(bx + br, by); g.arc(bx, by, br, 0, 7); }
      g.fill();
    }
    function pole(X, d, sp) {
      const k = F / d, x = px(X, d), y = py(0, d), t = py(10, d);
      g.strokeStyle = rgb(mix(sil, P.low, clamp(d / 330) * 0.7)); g.lineWidth = Math.max(0.28 * k, 0.8);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, t); g.moveTo(x - 1.3 * k, t + 0.8 * k); g.lineTo(x + 1.3 * k, t + 0.8 * k); g.stroke();
      const d2 = d + sp, x2 = px(X, d2), t2 = py(10, d2), k2 = F / d2; g.lineWidth = Math.max(0.05 * k, 0.5);
      [-1.2, 1.2].forEach((o) => { g.beginPath(); g.moveTo(x + o * k, t + 0.8 * k); g.quadraticCurveTo((x + x2) / 2 + o * (k + k2) / 2, (t + t2) / 2 + 0.8 * (k + k2), x2 + o * k2, t2 + 0.8 * k2); g.stroke(); });
    }
    function marker(X, d) {
      const k = F / d, x = px(X, d), y = py(0, d);
      g.fillStyle = rgb(mul([120, 124, 128], clamp(P.light + 0.25))); g.fillRect(x, y - 1.2 * k, Math.max(0.09 * k, 0.7), 1.2 * k);
      g.fillStyle = `rgba(255,236,190,${clamp(0.35 + night * Math.exp(-d / 110))})`; g.fillRect(x - 0.05 * k, y - 1.25 * k, Math.max(0.2 * k, 1.2), Math.max(0.26 * k, 1.2));
    }
    function lamps(X, d) {
      const x = px(X, d), y = py(0.9, d), k = F / d, r = Math.max(5, 1.5 * k) * (0.55 + night * 0.6);
      g.globalAlpha = 0.35 + night * 0.65; g.drawImage(glow, x - 0.75 * k - r, y - r, r * 2, r * 2); g.drawImage(glow, x + 0.75 * k - r, y - r, r * 2, r * 2); g.globalAlpha = 1;
    }
    function truckAhead(X, d) {
      const k = F / d, x = px(X, d), b = py(0.5, d), w = 2.6 * k, h = 3.5 * k, c = clamp(P.light * 0.9 + 0.1);
      g.fillStyle = rgb([226 * c, 230 * c, 234 * c]); g.fillRect(x - w / 2, b - h, w, h * 0.9);
      g.fillStyle = rgb([15, 16, 18]); g.fillRect(x - w / 2, b - h * 0.1, w, h * 0.22);
      g.fillStyle = '#d22'; g.fillRect(x - w / 2, b - h * 0.14, w, Math.max(1, h * 0.035));
      g.fillStyle = rgb([90 * c, 96 * c, 102 * c]); g.fillRect(x - 0.02 * k, b - h, Math.max(0.05 * k, 0.6), h * 0.9);
      const r = Math.max(2.5, 0.42 * k) * (0.8 + night * 0.5);
      [-1.1, 1.1].forEach((o) => g.drawImage(red, x + o * k - r, b + 0.08 * k - r, r * 2, r * 2));
      [-1.1, -0.15, 0, 0.15, 1.1].forEach((o) => g.drawImage(red, x + o * k - r * 0.4, b - h - r * 0.4, r * 0.8, r * 0.8));
    }
    function gantry(s, d) {
      const sc = D0 / d, x = W / 2 + bend(d), t = hor + s.sy * sc, half = Math.max(s.w * s.fit * 0.56, W * 0.55) * sc;
      const c = clamp(P.light + 0.3), bw = 12 * sc, by = t + s.h * s.fit * sc * 0.4;
      g.fillStyle = g.strokeStyle = rgb([120 * c, 126 * c, 132 * c]);
      g.fillRect(x - half, by, half * 2, bw); g.fillRect(x - half, by + 40 * sc, half * 2, bw * 0.7);
      g.fillRect(x - half, by - 8 * sc, bw * 1.5, py(0, d) - by); g.fillRect(x + half - bw * 1.5, by - 8 * sc, bw * 1.5, py(0, d) - by);
      g.lineWidth = Math.max(4 * sc, 0.6); g.beginPath();
      for (let n = 0; n < 16; n++) { const a = x - half + (half / 8) * n; g.moveTo(a, by + (n & 1 ? 40 * sc : 0)); g.lineTo(a + half / 8, by + (n & 1 ? 0 : 40 * sc)); }
      g.stroke();
    }
  }

  let shown = -2;
  function place(p) {
    stops.forEach((s, i) => {
      const d = i * GAP + D0 - cam, sc = d > 0.5 ? D0 / d : 99;
      const gone = s.trailer ? 1 : 1 - smooth(clamp((sc - 1.25) / 1.1));
      const a = clamp((sc - 0.03) / 0.05) * gone;
      s.sign.style.opacity = a.toFixed(3);
      if (a > 0) s.sign.style.transform = `translate3d(${(W / 2 + bend(d) + s.sx * sc).toFixed(2)}px,${(hor + s.sy * sc).toFixed(2)}px,0) scale(${(s.fit * sc).toFixed(4)})`;
      s.sign.classList.toggle('near', sc > 0.8 && sc < 1.4);
    });
    const near = Math.round(p), on = Math.abs(p - near) < 0.3 ? near : -1;
    if (on !== shown) { shown = on; stops.forEach((s, i) => s.chat && s.chat.classList.toggle('on', i === on)); }
    const h = clamp(1 - p * 5);
    heroCopy.style.opacity = h; heroCopy.style.transform = `translateY(${(1 - h) * 60}px)`; heroCopy.style.visibility = h > 0 ? 'visible' : 'hidden';
    const k = clamp(Math.floor(cam / GAP), 0, N - 2), t = clamp(cam / GAP - k), m = lerp(stops[k].time, stops[k + 1].time, t);
    $('hud-ct').textContent = fmt(m); $('hud-me').textContent = fmt(m + ahead);
    $('hud-mi').textContent = Math.round(lerp(stops[k].miles, stops[k + 1].miles, t));
    $('mph').textContent = Math.round(clamp(Math.abs(speed) * 0.62, 0, 70));
  }

  const progress = () => clamp((scrollY - track.offsetTop) / seg, 0, N - 1);
  let cruising = false, acc = 0;
  function frame(ms) {
    const dt = Math.min(0.05, (ms - last) / 1000 || 0.016); last = ms;
    if (cruising) {
      acc += seg * 0.16 * dt; const whole = Math.floor(acc);
      if (whole) { scrollBy(0, whole); acc -= whole; }
      if (progress() >= N - 1.005) cruise(false);
    }
    const p = progress(), target = camFor(p), prev = cam;
    cam += (target - cam) * (1 - Math.exp(-dt * 9));
    if (Math.abs(target - cam) < 0.002) cam = target;
    speed = lerp(speed, (cam - prev) / dt, 0.12);
    place(p); draw(ms);
    requestAnimationFrame(frame);
  }

  function cruise(on) { cruising = on; $('cruise').setAttribute('aria-pressed', String(on)); }
  $('cruise').addEventListener('click', () => { if (!cruising && progress() >= N - 1.02) scrollTo(0, 0); cruise(!cruising); });
  ['wheel', 'touchstart', 'keydown'].forEach((e) => addEventListener(e, (ev) => { if (cruising && !ev.target.closest?.('#cruise')) cruise(false); }, { passive: true }));

  /* links and keyboard focus travel to the right stop */
  const goTo = (i) => scrollTo(0, track.offsetTop + i * seg);
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const i = stops.findIndex((s) => `#${s.el.id}` === a.getAttribute('href'));
    if (i < 0) return;
    e.preventDefault(); cruise(false); goTo(i);
    if (a.classList.contains('skip')) stops[i].sign.querySelector('a')?.focus({ preventScroll: true });
  }));
  track.addEventListener('focusin', (e) => { const i = stops.findIndex((s) => s.el.contains(e.target)); if (i >= 0 && Math.abs(progress() - i) > 0.3) goTo(i); });

  let lastW = 0;
  function refit() { const p = seg ? progress() : 0; measure(); if (lastW && lastW !== W) goTo(p); lastW = W; }
  addEventListener('resize', refit);
  refit(); makePaint();
  document.fonts?.load('900 100px Overpass').then(() => document.fonts.ready).then(() => { refit(); makePaint(); });
  if (location.hash === '#contact') goTo(N - 1);
  cam = camFor(progress());
  requestAnimationFrame(frame);
})();
