/* TechGrit x Tidal webinar deck. No dependencies. */
(function(){
'use strict';
const Q = new URLSearchParams(location.search);
const MODE = Q.has('print') ? 'print' : Q.has('presenter') ? 'presenter' : Q.has('embed') ? 'embed' : 'deck';
document.body.classList.add(MODE);
const stage = document.getElementById('stage');
const slides = [...document.querySelectorAll('.slide')];
const chan = ('BroadcastChannel' in window) ? new BroadcastChannel('techgrit-tidal-deck') : null;
let cur = 0, step = 0;
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

/* ---------- scaling ---------- */
function fit(){ if (MODE==='print') return; const s = Math.min(innerWidth/1920, innerHeight/1080); stage.style.transform = `scale(${s})`; }
addEventListener('resize', fit); fit();

/* ---------- deterministic timeline helper ---------- */
// Each animation is render(t) where t is seconds since start; finish renders at its duration.
function timeline(dur, render){
  let raf = 0, t0 = 0;
  return {
    dur,
    start(){ cancelAnimationFrame(raf); t0 = performance.now(); const tick = now => { const t = (now - t0)/1000; render(Math.min(t, dur)); if (t < dur) raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); },
    stop(){ cancelAnimationFrame(raf); },
    reset(){ cancelAnimationFrame(raf); render(0); },
    finish(){ cancelAnimationFrame(raf); render(dur); }
  };
}

/* ---------- loop component ---------- */
function buildLoop(host){
  const fails = +host.dataset.fails || 0, mode = host.dataset.mode || 'pass', small = host.dataset.size === 'small';
  const W = host.clientWidth || parseInt(host.style.width), H = host.clientHeight || parseInt(host.style.height);
  const cx = W/2, cy = H/2, R = Math.min(W, H)/2 - (small ? 62 : 78), nr = small ? 52 : 64;
  host.innerHTML = '';
  const svg = svgEl('svg', {width: W, height: H, viewBox: `0 0 ${W} ${H}`}, host);
  svgEl('circle', {class:'ring', cx, cy, r: R}, svg);
  const trail = svgEl('path', {class:'trail', d:''}, svg);
  const comet = svgEl('circle', {class:'comet', r: small ? 13 : 16, cx, cy: cy - R}, svg);
  const names = ['Plan','Change','Test','Retry'];
  const nodes = names.map((n, i) => {
    const a = -Math.PI/2 + i*Math.PI/2, g = svgEl('g', {class:'node'}, svg);
    svgEl('circle', {cx: cx + R*Math.cos(a), cy: cy + R*Math.sin(a), r: nr}, g);
    const tx = svgEl('text', {x: cx + R*Math.cos(a), y: cy + R*Math.sin(a)}, g); tx.textContent = n;
    if (small) tx.style.fontSize = '22px';
    return g;
  });
  const c = svgEl('g', {class:'center'}, svg);
  const it = svgEl('text', {class:'it', x: cx, y: cy - (small ? 44 : 60)}, c);
  const st = svgEl('text', {class:'st', x: cx, y: cy + 8}, c);
  const st2 = svgEl('text', {class:'st2', x: cx, y: cy + (small ? 56 : 74)}, c);
  if (small){ st.style.fontSize = '40px'; st2.style.fontSize = '30px'; it.style.fontSize = '22px'; }
  const lap = small ? 1.9 : 2.2, laps = fails + 1, runEnd = laps*lap - lap/2; // stop at Test on final lap
  const dur = runEnd + 1.4;
  const arc = (a0, a1) => { const p = a => [cx + R*Math.cos(a), cy + R*Math.sin(a)]; const [x0,y0] = p(a0), [x1,y1] = p(a1); const large = (a1 - a0) > Math.PI ? 1 : 0; return `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1}`; };
  function render(t){
    const tt = Math.min(t, runEnd);
    const frac = tt/lap, lapIdx = Math.min(Math.floor(frac), laps - 1), within = frac - Math.floor(frac);
    const ang = -Math.PI/2 + (tt/lap)*2*Math.PI;
    comet.setAttribute('cx', cx + R*Math.cos(ang)); comet.setAttribute('cy', cy + R*Math.sin(ang));
    trail.setAttribute('d', tt > 0.02 ? arc(ang - Math.min(1.1, tt*2.5), ang) : '');
    const pos = ((tt/lap) % 1 + 1) % 1; // 0 plan, .25 change, .5 test, .75 retry
    nodes.forEach((g, i) => { const d = Math.abs(((pos - i*0.25 + 1.5) % 1) - 0.5); g.classList.toggle('on', d < 0.07 && t < runEnd); g.classList.remove('fail','pass'); });
    // test results: lap k passes Test at time k*lap + lap/2
    let lastTest = -1; for (let k = 0; k < laps; k++) if (tt >= k*lap + lap/2 - 0.001) lastTest = k;
    const doneRun = t >= runEnd;
    if (lastTest >= 0){
      const passed = lastTest >= fails;
      nodes[2].classList.add(passed ? 'pass' : 'fail');
      if (!passed && tt >= lastTest*lap + 0.75*lap - 0.1) nodes[3].classList.add('on');
    }
    it.textContent = `ITERATION ${Math.min(lapIdx + 1, laps)}`;
    st.style.fill = '#fff'; st2.textContent = '';
    host.classList.toggle('done', doneRun);
    if (lastTest < 0) st.textContent = '';
    else if (lastTest < fails) { st.textContent = 'Tests ✕'; st.style.fill = '#FF7A2E'; }
    else {
      st.textContent = 'Tests ✓'; st.style.fill = '#5CC873';
      if (doneRun && mode !== 'pass' && t >= runEnd + 0.5){
        st2.textContent = mode === 'intent' ? 'Intent ✕' : 'Intent ✓';
        st2.style.fill = mode === 'intent' ? '#FF7A2E' : '#5CC873';
      }
      if (doneRun && mode === 'pass' && t >= runEnd + 0.3){ st2.textContent = 'PASS'; st2.style.fill = '#5CC873'; }
    }
  }
  render(0);
  return timeline(dur, render);
}

/* ---------- slide animations ---------- */
const anims = {};
function A(name, fn){ anims[name] = fn; }
A('assume', s => {
  const pf = s.querySelector('#pf'); pf.innerHTML = '';
  const N = 200, cells = [];
  for (let i = 0; i < N; i++){ const e = document.createElement('i'); pf.appendChild(e); cells.push(e); }
  // deterministic pattern: ~4% modernized, ~38% lift and shift, rest left alone (illustrative)
  let seed = 7; const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
  const kind = cells.map(() => { const r = rnd(); return r < 0.04 ? 'mod' : r < 0.42 ? 'ls' : ''; });
  const order = cells.map((_, i) => i).sort(() => rnd() - 0.5);
  return timeline(3.2, t => { const n = Math.floor(N * Math.min(1, t/2.6)); order.forEach((ix, k) => { cells[ix].className = k < n ? kind[ix] : ''; }); });
});
A('loop4', s => {
  const lp = buildLoop(s.querySelector('#loopA'));
  const curve = s.querySelector('#costCurve'), area = s.querySelector('#costArea');
  const L = curve.getTotalLength(); curve.style.strokeDasharray = L;
  area.setAttribute('d', curve.getAttribute('d') + ' L830,380 L70,380 Z');
  const dur = Math.max(lp.dur, 4);
  const tl = timeline(dur, t => { const p = Math.min(1, t/3.2); curve.style.strokeDashoffset = L*(1 - p); area.style.opacity = p; });
  return combine([lp, tl]);
});
A('loop5', s => buildLoop(s.querySelector('#loopB')));
A('demo', s => combine([buildLoop(s.querySelector('#loopC')), buildLoop(s.querySelector('#loopD'))]));
A('bottleneck', s => {
  const tiles = s.querySelector('#tiles'); tiles.innerHTML = '';
  const cells = []; for (let i = 0; i < 200; i++){ const e = document.createElement('i'); tiles.appendChild(e); cells.push(e); }
  const ff = s.querySelector('#fastFill'), fv = s.querySelector('#fastVal'), sf = s.querySelector('#slowFill'), sv = s.querySelector('#slowVal'), cnt = s.querySelector('#tileCount');
  const DUR = 7;
  return timeline(DUR, t => {
    const f = Math.min(1, t/1.4); ff.style.width = (f*100) + '%'; fv.textContent = f >= 1 ? 'done ✓' : '';
    const sp = Math.min(1, t/DUR) * 0.24; sf.style.width = (sp*100) + '%'; sv.textContent = t >= DUR ? 'still going...' : '';
    const n = Math.round(200*sp); cells.forEach((c, i) => c.classList.toggle('got', i < n)); cnt.textContent = n;
  });
});
A('portfolio', s => {
  const svg = s.querySelector('#scatter'); svg.innerHTML = '';
  const X0 = 80, Y0 = 600, X1 = 980, Y1 = 30;
  svgEl('line', {class:'ax', x1:X0, y1:Y0, x2:X1, y2:Y0}, svg); svgEl('line', {class:'ax', x1:X0, y1:Y0, x2:X0, y2:Y1}, svg);
  const tx = svgEl('text', {x: X1, y: Y0 + 46, 'text-anchor':'end'}, svg); tx.textContent = 'Ease of change (with context) →';
  const ty = svgEl('text', {x: 0, y: 0, transform:`translate(${X0-26},${Y1+250}) rotate(-90)`, 'text-anchor':'middle'}, svg); ty.textContent = 'Business value →';
  svgEl('rect', {x: (X0+X1)/2, y: Y1, width: (X1-X0)/2, height: (Y0-Y1)/2, fill:'rgba(247,206,0,.07)', rx: 8}, svg);
  let seed = 11; const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
  const pts = []; let guard = 0; while (pts.length < 44 && guard++ < 5000){ const q = {x: X0 + 40 + rnd()*(X1-X0-80), y: Y1 + 40 + rnd()*(Y0-Y1-80)}; const inLabel = (q.y < Y1 + 70 && q.x > X1 - 240) || (q.y > Y0 - 70 && q.x < X0 + 380); if (!inLabel && pts.every(o => Math.hypot(o.x-q.x, o.y-q.y) > 62)) pts.push(q); }
  const l1 = svgEl('text', {class:'ql', x: X1 - 16, y: Y1 + 34, 'text-anchor':'end'}, svg); l1.textContent = 'LOOP FIRST';
  const l2 = svgEl('text', {class:'ql2', x: X0 + 20, y: Y0 - 18}, svg); l2.textContent = 'RETIRE, RETAIN OR WAIT';
  const hot = pts.filter(p => p.x > (X0+X1)/2 + 10 && p.y < (Y0+Y1)/2 - 10).sort((a, b) => (b.x - X0) - (a.x - X0) + (a.y - b.y)).slice(0, 6);
  const dots = pts.map(p => svgEl('circle', {class:'dot', cx:p.x, cy:p.y, r: 13}, svg));
  const orbits = hot.map(p => { const g = svgEl('g', {}, svg); const o = svgEl('circle', {class:'orbit', cx:p.x, cy:p.y, r: 30}, g); return {g, o, p}; });
  const DUR = 0.8 + hot.length*0.45 + 0.5;
  return timeline(DUR, t => {
    orbits.forEach((ob, k) => { const on = t >= 0.8 + k*0.45; ob.g.style.opacity = on ? 1 : 0; ob.o.style.transform = `rotate(${t*120}deg)`; ob.o.style.transformOrigin = `${ob.p.x}px ${ob.p.y}px`;
      const d = dots[pts.indexOf(ob.p)]; d.classList.toggle('hot', on); });
  });
});
A('temm', s => { const g = s.querySelector('.spinr'); return timeline(3, t => { g.style.transform = `rotate(${t*240}deg)`; }); });
function combine(list){ return { dur: Math.max(...list.map(x => x.dur)), start(){ list.forEach(x => x.start()); }, stop(){ list.forEach(x => x.stop()); }, reset(){ list.forEach(x => x.reset()); }, finish(){ list.forEach(x => x.finish()); } }; }
const built = new Map();
function animFor(i){ const s = slides[i], n = s.dataset.anim; if (!n) return null; if (!built.has(i)) built.set(i, anims[n](s)); return built.get(i); }

/* ---------- audience list ---------- */
const aud = document.getElementById('aud'), board = document.getElementById('board');
const custom = []; // {text}
const audItems = () => [...aud.querySelectorAll('li')];
const revealOrder = []; // elements in reveal order
function setRevealed(li, on){ li.classList.toggle('in', on); const i = revealOrder.indexOf(li); if (on && i < 0) revealOrder.push(li); if (!on && i >= 0) revealOrder.splice(i, 1); board.classList.toggle('has', revealOrder.length > 0); }
function addCustom(text){
  const li = document.createElement('li'); li.className = 'custom'; li.dataset.k = 'custom';
  li.innerHTML = `<span class="n">+</span><div></div>`; li.querySelector('div').textContent = text;
  aud.appendChild(li); custom.push(li); requestAnimationFrame(() => setRevealed(li, true)); syncAnswers(); broadcast();
}
function listNext(){ const hidden = audItems().find(li => !li.classList.contains('in') && !li.classList.contains('custom')); if (hidden){ setRevealed(hidden, true); syncAnswers(); return true; } return false; }
function listBack(){ const last = revealOrder[revealOrder.length - 1]; if (!last) return false; setRevealed(last, false); if (last.classList.contains('custom')){ last.remove(); custom.splice(custom.indexOf(last), 1); } syncAnswers(); return true; }
const addbox = document.getElementById('addbox'), addinput = document.getElementById('addinput');
function openAdd(){ addbox.classList.add('open'); addinput.value = ''; setTimeout(() => addinput.focus(), 0); }
addinput.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter'){ const v = addinput.value.trim(); addbox.classList.remove('open'); addinput.blur(); if (v) addCustom(v); } if (e.key === 'Escape'){ addbox.classList.remove('open'); addinput.blur(); } });

/* ---------- reveal slide (ticks the audience list) ---------- */
const ansList = document.getElementById('ansList');
const TICK = {deps:1, flows:1, risk:2, intent:3, owners:3, matters:3, retire:3, custom:3};
function syncAnswers(){
  ansList.innerHTML = '';
  const base = audItems().filter(li => !li.classList.contains('custom'));
  const list = [...base, ...custom];
  list.forEach((li, i) => {
    const c = document.createElement('li'); c.className = li.classList.contains('custom') ? 'custom' : ''; c.dataset.tick = TICK[li.dataset.k] || 3;
    c.innerHTML = `<span class="n">${li.querySelector('.n').textContent}</span><div></div><span class="tick">✓</span>`;
    c.querySelector('div').textContent = li.querySelector('div').firstChild.textContent.trim();
    ansList.appendChild(c);
  });
  applySteps(slides[cur], step);
}

/* ---------- steps ---------- */
function maxStep(s){ let m = 0; s.querySelectorAll('[data-step]').forEach(e => m = Math.max(m, +e.dataset.step)); return m; }
function applySteps(s, k){
  s.querySelectorAll('[data-step]').forEach(e => e.classList.toggle('shown', +e.dataset.step <= k));
  s.querySelectorAll('[data-tick]').forEach(e => e.classList.toggle('ticked', +e.dataset.tick <= k));
}

/* ---------- navigation ---------- */
function show(i, k, opts = {}){
  i = Math.max(0, Math.min(slides.length - 1, i));
  const changed = i !== cur || opts.force;
  if (changed){ const old = animFor(cur); if (old) old.stop(); slides[cur].classList.remove('active'); }
  cur = i; step = Math.max(0, Math.min(maxStep(slides[i]), k|0));
  slides.forEach((s, j) => s.classList.toggle('active', j === i));
  applySteps(slides[i], step);
  if (changed){ const a = animFor(i); if (a){ if (opts.end) a.finish(); else { a.reset(); a.start(); } } }
  document.getElementById('progress').style.width = ((i + 1)/slides.length*100) + '%';
  document.getElementById('counter').textContent = `${i + 1} / ${slides.length}`;
  renderNotes();
  if (MODE === 'deck' && !opts.silent){ history.replaceState(null, '', `#${i + 1}`); broadcast(); }
}
function next(skip){
  const s = slides[cur];
  if (!skip && s.dataset.list && listNext()) return broadcast();
  if (!skip && step < maxStep(s)) return show(cur, step + 1);
  if (cur < slides.length - 1) show(cur + 1, 0);
}
function prev(){
  const s = slides[cur];
  if (step > 0) return show(cur, step - 1);
  if (cur > 0) show(cur - 1, maxStep(slides[cur - 1]));
}
function replay(){ const a = animFor(cur); if (a){ a.reset(); a.start(); } }

/* ---------- notes ---------- */
const notesEl = document.getElementById('notes'), notesBody = document.getElementById('notesBody');
function notesHTML(i){ const n = slides[i].querySelector('aside.notes'); return `<div style="opacity:.7;font-size:13px">Slide ${i + 1} of ${slides.length} · ${slides[i].dataset.title || ''}</div>` + (n ? n.innerHTML : '<p>No notes.</p>'); }
function renderNotes(){ if (notesEl.classList.contains('open')) notesBody.innerHTML = notesHTML(cur); }

/* ---------- sync with presenter window ---------- */
function state(){ return {type:'state', slide: cur, step, list: revealOrder.map(li => li.classList.contains('custom') ? {c: li.querySelector('div').textContent} : {k: li.dataset.k})}; }
function broadcast(){ if (chan && MODE === 'deck') chan.postMessage(state()); }
function applyListState(list){
  audItems().forEach(li => { if (li.classList.contains('custom')) li.remove(); else li.classList.remove('in'); });
  custom.length = 0; revealOrder.length = 0;
  (list || []).forEach(x => { if (x.c){ const li = document.createElement('li'); li.className = 'custom in'; li.dataset.k = 'custom'; li.innerHTML = '<span class="n">+</span><div></div>'; li.querySelector('div').textContent = x.c; aud.appendChild(li); custom.push(li); revealOrder.push(li); } else { const li = aud.querySelector(`li[data-k="${x.k}"]`); if (li){ li.classList.add('in'); revealOrder.push(li); } } });
  board.classList.toggle('has', revealOrder.length > 0); syncAnswers();
}
if (chan) chan.onmessage = e => {
  const m = e.data;
  if (MODE === 'deck' && m.type === 'cmd'){ ({next: () => next(), prev, skip: () => next(true), replay, hello: broadcast})[m.action]?.(); }
  if (MODE === 'embed' && m.type === 'state'){ const off = +(Q.get('offset') || 0); applyListState(m.list); const target = m.slide + off; if (target < slides.length){ show(target, off ? maxStep(slides[target]) : m.step, {silent: true, end: !!off}); stage.style.visibility = 'visible'; } else stage.style.visibility = 'hidden'; }
  if (MODE === 'presenter' && m.type === 'state') presenterUpdate(m);
};

/* ---------- input ---------- */
let gotoBuf = null;
addEventListener('keydown', e => {
  if (MODE !== 'deck') return;
  if (e.target === addinput) return;
  const k = e.key, s = slides[cur];
  if (document.getElementById('help').classList.contains('open') && k !== '?' && k !== 'h' && k !== 'H') { document.getElementById('help').classList.remove('open'); }
  if (gotoBuf !== null){ if (/^\d$/.test(k)){ gotoBuf += k; return; } if (k === 'Enter'){ const n = parseInt(gotoBuf, 10); gotoBuf = null; if (n) show(n - 1, 0); return; } gotoBuf = null; }
  if (s.dataset.list && /^[1-7]$/.test(k)){ const li = aud.querySelectorAll('li:not(.custom)')[+k - 1]; if (li){ setRevealed(li, !li.classList.contains('in')); syncAnswers(); broadcast(); } return; }
  if (s.dataset.list && (k === 'a' || k === 'A')){ e.preventDefault(); openAdd(); return; }
  if (s.dataset.list && k === 'Backspace'){ e.preventDefault(); listBack(); broadcast(); return; }
  switch (k){
    case 'ArrowRight': case 'PageDown': case ' ': case 'Enter': e.preventDefault(); next(e.shiftKey); break;
    case 'ArrowDown': e.preventDefault(); next(); break;
    case 'ArrowLeft': case 'PageUp': case 'ArrowUp': e.preventDefault(); prev(); break;
    case 'Home': show(0, 0); break;
    case 'End': show(slides.length - 1, 0); break;
    case 'r': case 'R': replay(); break;
    case 'n': case 'N': notesEl.classList.toggle('open'); renderNotes(); break;
    case 'p': case 'P': window.open(location.pathname + '?presenter', 'tidal-presenter', 'width=1400,height=900'); break;
    case 'f': case 'F': if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); break;
    case 'b': case 'B': case '.': document.getElementById('black').classList.toggle('on'); break;
    case 'c': case 'C': document.body.classList.toggle('clean'); break;
    case 'g': case 'G': gotoBuf = ''; break;
    case '?': case 'h': case 'H': document.getElementById('help').classList.toggle('open'); break;
  }
});
document.getElementById('viewport').addEventListener('click', e => {
  if (MODE !== 'deck' || e.target.closest('input,a,button,.addbox')) return;
  if (e.clientX < innerWidth/3) prev(); else next();
});
let tx0 = null;
addEventListener('touchstart', e => { tx0 = e.touches[0].clientX; }, {passive: true});
addEventListener('touchend', e => { if (tx0 === null) return; const dx = e.changedTouches[0].clientX - tx0; if (Math.abs(dx) > 50) (dx < 0 ? next() : prev()); tx0 = null; });

/* ---------- presenter window ---------- */
let pStart = null;
function presenterInit(){
  const p = document.getElementById('presenter');
  p.innerHTML = `<div><div class="top"><div class="lbl">Current (mirrors audience screen)</div><div><button data-a="prev">◀ Back</button> <button data-a="next">Next ▶</button> <button data-a="skip">Skip slide ⇥</button> <button data-a="replay">Replay ⟲</button></div></div>
    <div class="frame" id="pf1"><iframe src="index.html?embed"></iframe></div></div>
    <div><div class="top"><div class="lbl">Next slide</div><div class="timer" id="ptimer">00:00</div></div><div class="frame" id="pf2"><iframe src="index.html?embed&offset=1"></iframe></div>
    <div style="margin-top:10px" id="pmeta"></div><button id="ptreset" style="margin-top:8px">Reset timer</button></div>
    <div class="pnotes" id="pnotes">Waiting for the main deck window... (keep the audience deck open in another window and press P there)</div>`;
  const scaleFrames = () => p.querySelectorAll('.frame').forEach(f => { f.querySelector('iframe').style.transform = `scale(${f.clientWidth/1920})`; });
  addEventListener('resize', scaleFrames); setTimeout(scaleFrames, 50);
  p.addEventListener('click', e => { const a = e.target.dataset?.a; if (a && chan) chan.postMessage({type:'cmd', action: a}); });
  document.getElementById('ptreset').onclick = () => { pStart = Date.now(); };
  addEventListener('keydown', e => { const m = {ArrowRight:'next', ' ':'next', PageDown:'next', ArrowLeft:'prev', PageUp:'prev', r:'replay', R:'replay'}[e.key]; if (m && chan){ e.preventDefault(); chan.postMessage({type:'cmd', action: e.shiftKey && m === 'next' ? 'skip' : m}); } });
  setInterval(() => { if (!pStart) return; const s = Math.floor((Date.now() - pStart)/1000); document.getElementById('ptimer').textContent = `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }, 500);
  setTimeout(() => chan && chan.postMessage({type:'cmd', action:'hello'}), 400);
}
function presenterUpdate(m){
  if (!pStart) pStart = Date.now();
  document.getElementById('pnotes').innerHTML = notesHTML(m.slide);
  const ms = maxStep(slides[m.slide]);
  document.getElementById('pmeta').textContent = `Slide ${m.slide + 1}/${slides.length}` + (ms ? ` · step ${m.step}/${ms}` : '') + (slides[m.slide + 1] ? ` · next: ${slides[m.slide + 1].dataset.title}` : ' · last slide');
}

addEventListener('hashchange', () => { if (MODE !== 'deck') return; const n = parseInt(location.hash.slice(1), 10); if (!isNaN(n) && n - 1 !== cur) show(n - 1, 0); });
/* ---------- boot ---------- */
window.deck = { show, next, prev, replay, slides, finishAll(){ const a = animFor(cur); if (a) a.finish(); }, revealList(){ while (listNext()); syncAnswers(); }, addCustom, get cur(){ return cur; }, get step(){ return step; } };
syncAnswers();
if (MODE === 'print'){
  audItems().forEach(li => setRevealed(li, true)); syncAnswers();
  slides.forEach((s, i) => { s.classList.add('active'); applySteps(s, maxStep(s)); const a = animFor(i); if (a) a.finish(); });
  document.body.dataset.ready = '1';
} else if (MODE === 'presenter'){
  presenterInit();
} else {
  const h = parseInt(location.hash.slice(1), 10);
  slides[0].classList.add('active');
  show(isNaN(h) ? 0 : h - 1, 0, {force: true});
  if (MODE === 'embed') stage.style.visibility = 'hidden';
  document.body.dataset.ready = '1';
}
})();
