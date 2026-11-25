(() => {
  const HOME = 'Europe/Skopje';
  const ZONES = {
    ET: ['America/New_York', 'Eastern'],
    CT: ['America/Chicago', 'Central'],
    MT: ['America/Denver', 'Mountain'],
    PT: ['America/Los_Angeles', 'Pacific'],
  };
  const OPEN = 8, CLOSE = 17;          // typical US office hours
  const DAY_START = 7, DAY_END = 19;   // daytime in Veles
  const DAY = 1440, NOON = 720;
  const $ = (id) => document.getElementById(id);

  // Minutes that a zone is ahead of UTC at a given moment (handles both DST calendars).
  function offset(tz, date) {
    const p = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric',
      day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(date).forEach((x) => { p[x.type] = +x.value; });
    const local = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((local - date.getTime()) / 60000);
  }
  const ahead = (tz, date) => offset(HOME, date) - offset(tz, date);
  const wrap = (m) => ((m % DAY) + DAY) % DAY;
  const minutesIn = (tz, date) => wrap(Math.floor(date.getTime() / 60000) + offset(tz, date));
  function fmt(m) {
    m = wrap(m);
    const h = Math.floor(m / 60);
    return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }

  let zone = 'CT';
  let live = true;

  // The band runs noon to noon, so the US night sits in one piece in the middle.
  function seg(start, end, cls, label) {
    let from = wrap(start - NOON), len = end - start, html = '';
    while (len > 0) {
      const w = Math.min(len, DAY - from);
      const text = w / DAY > 0.11 ? `<span>${label}</span>` : '';
      html += `<i class="seg ${cls}" style="left:${from / DAY * 100}%;width:${w / DAY * 100}%">${text}</i>`;
      len -= w; from = 0;
    }
    return html;
  }

  function drawBands() {
    const [tz, name] = ZONES[zone];
    const diff = ahead(tz, new Date());
    $('us-name').textContent = `Your office, ${name}`;
    $('band-us').innerHTML = seg(OPEN * 60, NOON, 'office', 'Open') + seg(NOON, CLOSE * 60, 'office', 'Open')
      + seg(CLOSE * 60, OPEN * 60 + DAY, 'after', 'After hours');
    $('band-me').innerHTML = seg(DAY_START * 60 - diff, DAY_END * 60 - diff, 'day', 'Daytime in Veles');
    const from = Math.max(CLOSE * 60, DAY_START * 60 - diff + DAY);
    const to = Math.min(OPEN * 60 + DAY, DAY_END * 60 - diff + DAY);
    const total = (OPEN * 60 + DAY - CLOSE * 60) / 60;
    $('overlap').textContent = `${Math.max(0, to - from) / 60} of your ${total} after-hours hours fall between 7 AM and 7 PM in Veles.`;
  }

  function drawTime() {
    const [tz, name] = ZONES[zone];
    const now = new Date();
    const scrub = $('scrub');
    const us = live ? minutesIn(tz, now) : wrap(+scrub.value + NOON);
    const pos = live ? wrap(us - NOON) : +scrub.value;
    if (live) scrub.value = pos;
    const here = us + ahead(tz, now);
    $('needle').style.left = `${pos / DAY * 100}%`;
    $('readout').innerHTML = `${live ? 'Right now, ' : ''}<b>${fmt(us)}</b> ${name} is <b>${fmt(here)}</b> in Veles`;
    scrub.setAttribute('aria-valuetext', `${fmt(us)} ${name}, ${fmt(here)} in Veles`);
    $('tonow').hidden = live;
    $('veles-now').textContent = `local time ${fmt(minutesIn(HOME, now))}`;
  }

  function drawShift() {
    const diff = ahead(ZONES.CT[0], new Date());
    document.querySelectorAll('.veles[data-ct]').forEach((el) => { el.textContent = fmt(+el.dataset.ct + diff); });
  }

  document.querySelectorAll('[data-zone]').forEach((b) => b.addEventListener('click', () => {
    zone = b.dataset.zone;
    document.querySelectorAll('[data-zone]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    drawBands(); drawTime();
  }));
  $('scrub').addEventListener('input', () => { live = false; drawTime(); });
  $('tonow').addEventListener('click', () => { live = true; drawTime(); $('scrub').focus(); });

  $('copy').addEventListener('click', async () => {
    const mail = document.querySelector('.mail').textContent;
    try { await navigator.clipboard.writeText(mail); $('copied').textContent = 'Copied'; }
    catch { $('copied').textContent = mail; }
  });

  // <details name> is exclusive in current browsers; this covers older ones.
  const lines = document.querySelectorAll('details[name=rc]');
  lines.forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) lines.forEach((o) => { if (o !== d) o.open = false; });
  }));

  drawBands(); drawTime(); drawShift();
  setInterval(() => { drawBands(); drawTime(); drawShift(); }, 30000);
})();
