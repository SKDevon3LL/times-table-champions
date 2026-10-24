// The two reward games, opened for 30 minutes when a child completes the week's trail (see app.js, "reward games").
// Each takes a host element and an api from app.js, draws into the host, and returns {destroy}.
(() => {
'use strict';
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* A question box: a times-table fact with three answers to tap and a countdown. Calls done(ok). */
function askBox(box, api, seconds, done){
  const q = api.ask(), t0 = Date.now();
  box.hidden = false;
  box.innerHTML = `<p class="gq-text">${esc(q.text)} = ?</p><div class="gq-opts">${q.choices.map(v => `<button class="btn big" data-v="${v}">${v}</button>`).join('')}</div><div class="gq-time"><span></span></div>`;
  const bar = box.querySelector('.gq-time span');
  let over = false;
  const finish = ok => { if (over) return; over = true; clearInterval(tk); box.hidden = true; box.innerHTML = ''; done(ok, q); };
  const tk = setInterval(() => { const f = 1 - (Date.now() - t0) / (seconds * 1000); bar.style.width = Math.max(0, f * 100) + '%'; if (f <= 0) finish(false); }, 100);
  box.onclick = e => { const b = e.target.closest('[data-v]'); if (b) finish(+b.dataset.v === q.ans); };
  return () => { over = true; clearInterval(tk); };
}

/* ---------- Hughie: the Jungle Gold Run ---------- */
// Chop a path to the gold (one right answer = one chop), then get back to the boat before the anacondas come out of the river.
// Every answer is a turn: snakes, panthers and anacondas each close in on their own beat, so a wrong answer lets them gain.
function jungle(host, api){
  // Snakes always close in on him, every other turn, wherever they are, so he feels cornered (Sam, 24 Oct 2026).
  const W = 7, H = 9, BOAT = 3, SENSE = {snake:99, panther:3, anaconda:5};
  // Adventure music (an original track made for the game) loops quietly while he plays, when sound is on.
  const music = new Audio('audio/jungle-adventure.mp3'); music.loop = true; music.volume = .35;
  if (api.soundOn && api.soundOn()) music.play().catch(() => {});
  // Snakes hiss louder as they slither closer, and strike with a snap when they catch him.
  const noise = (ac, len) => { const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * len), ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const n = ac.createBufferSource(); n.buffer = b; return n; };
  // A cobra: a breathy hiss that pulses (louder the closer it is); the strike rears up with a rising hiss, then a sharp
  // spitting burst, a whoosh and a snap of the jaws.
  const hiss = (vol, strike) => { if (api.soundOn && !api.soundOn()) return; try {
    const ac = api.audio(), t0 = ac.currentTime + .02, len = strike ? .55 : .7;
    const n = noise(ac, len + .1), hp = ac.createBiquadFilter(), bp = ac.createBiquadFilter(), g = ac.createGain(), trem = ac.createOscillator(), tg = ac.createGain();
    hp.type = 'highpass'; hp.frequency.value = 2500; bp.type = 'bandpass'; bp.Q.value = .7;
    bp.frequency.setValueAtTime(strike ? 3500 : 5500, t0); bp.frequency.linearRampToValueAtTime(strike ? 8000 : 6500, t0 + len);
    trem.frequency.value = strike ? 9 : 6; tg.gain.value = vol * .35; trem.connect(tg); tg.connect(g.gain);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol * (strike ? .9 : .7), t0 + (strike ? len * .9 : .12)); g.gain.exponentialRampToValueAtTime(.0001, t0 + len);
    n.connect(hp); hp.connect(bp); bp.connect(g); g.connect(ac.destination); n.start(t0); n.stop(t0 + len + .05); trem.start(t0); trem.stop(t0 + len);
    if (strike) {
      const ts = t0 + len;
      const spit = noise(ac, .08), sg = ac.createGain(), sf = ac.createBiquadFilter(); sf.type = 'highpass'; sf.frequency.value = 1200;
      sg.gain.setValueAtTime(1, ts); sg.gain.exponentialRampToValueAtTime(.001, ts + .08); spit.connect(sf); sf.connect(sg); sg.connect(ac.destination); spit.start(ts);
      const wh = noise(ac, .35), wf = ac.createBiquadFilter(), wg = ac.createGain(); wf.type = 'lowpass'; wf.frequency.setValueAtTime(4000, ts); wf.frequency.exponentialRampToValueAtTime(300, ts + .3);
      wg.gain.setValueAtTime(.6, ts); wg.gain.exponentialRampToValueAtTime(.001, ts + .35); wh.connect(wf); wf.connect(wg); wg.connect(ac.destination); wh.start(ts);
      const o = ac.createOscillator(), og = ac.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(900, ts + .05); o.frequency.exponentialRampToValueAtTime(120, ts + .12);
      og.gain.setValueAtTime(.7, ts + .05); og.gain.exponentialRampToValueAtTime(.001, ts + .14); o.connect(og); og.connect(ac.destination); o.start(ts + .05); o.stop(ts + .16);
    }
  } catch {} };
  // A heartbeat that quickens as a snake gets closer.
  const heartbeat = near => { if (api.soundOn && !api.soundOn()) return; try {
    const ac = api.audio(), gap = [0, .28, .36, .44][near] || .44;
    for (const [t, v] of [[0, .5], [gap * .45, .35]]) { const o = ac.createOscillator(), g = ac.createGain(), at = ac.currentTime + .05 + t;
      o.type = 'sine'; o.frequency.setValueAtTime(70, at); o.frequency.exponentialRampToValueAtTime(40, at + .15);
      g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(v, at + .02); g.gain.exponentialRampToValueAtTime(.0001, at + .2);
      o.connect(g); g.connect(ac.destination); o.start(at); o.stop(at + .22); }
  } catch {} };
  // Panthers snarl as they close in, swipe their claws when right beside him, and roar when they catch him.
  const roar = (vol, big) => { if (api.soundOn && !api.soundOn()) return; try {
    const ac = api.audio(), at = ac.currentTime + .02, len = big ? 1.6 : .7;
    const o = ac.createOscillator(), o2 = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; o.frequency.setValueAtTime(big ? 120 : 95, at); o.frequency.linearRampToValueAtTime(big ? 70 : 80, at + len);
    o2.frequency.setValueAtTime(big ? 61 : 48, at); lfo.frequency.value = big ? 22 : 30; lg.gain.value = .5;
    lfo.connect(lg); lg.connect(g.gain); f.type = 'lowpass'; f.frequency.setValueAtTime(big ? 1400 : 700, at); f.frequency.linearRampToValueAtTime(400, at + len);
    g.gain.setValueAtTime(.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + (big ? .15 : .08)); g.gain.exponentialRampToValueAtTime(.0001, at + len);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(ac.destination); for (const x of [o, o2, lfo]) { x.start(at); x.stop(at + len + .05); }
  } catch {} };
  const claw = () => { if (api.soundOn && !api.soundOn()) return; try {
    const ac = api.audio();
    for (let k = 0; k < 3; k++) { const at = ac.currentTime + .05 + k * .09, b = ac.createBuffer(1, ac.sampleRate * .12, ac.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; f.type = 'bandpass'; f.frequency.setValueAtTime(3000, at); f.frequency.exponentialRampToValueAtTime(900, at + .12); g.gain.value = .5;
      s.connect(f); f.connect(g); g.connect(ac.destination); s.start(at); }
  } catch {} };
  const pantherNear = () => { const ds = st.preds.filter(p => p.kind === 'panther').map(p => Math.abs(p.r - st.pl.r) + Math.abs(p.c - st.pl.c)); return ds.length ? Math.min(...ds) : 99; };
  const snakeNear = () => { const ds = st.preds.filter(p => p.kind !== 'panther').map(p => Math.abs(p.r - st.pl.r) + Math.abs(p.c - st.pl.c)); return ds.length ? Math.min(...ds) : 99; };
  let level = 1, st = null, busy = false, cancelQ = null;
  // Hughie's adventure pictures (private family-photos bucket, made from his own photos): start, chop, gold, chase, win, caught.
  const scene = (name, title, text, go, btn) => `<div class="sticker jg-scene"><img class="jg-photo" data-p="jungle/${name}.jpg" alt=""><h2>${title}</h2><p>${text}</p><button class="btn big" data-go="${go}">${btn}</button></div>`;
  const loadPics = el => el.querySelectorAll('img[data-p]').forEach(im => api.picture(im.dataset.p).then(u => { if (im.isConnected) im.src = u; }).catch(() => {}));
  const backdrop = name => { const im = host.querySelector('.jg-bd'); if (im) { im.dataset.p = `jungle/${name}.jpg`; loadPics(host); } };
  // The action panel beside the board (held sideways) and the blurred backdrop: what Hughie is doing this turn.
  // Each moment also has a 10-second video clip (clips/, made with Google's video model; jungle, creatures and his-eye
  // views, never his face). The side screen mixes them with his own picture (Sam, 24 Oct 2026): the picture for 2.5
  // seconds, then the clip fades in; when the clip ends his picture shows for 3 seconds and the clip plays again.
  const CLIP = {start:'start', chop:'chop', miss:'miss', hold:'hold', chase:'chase', run:'run', gold:'gold', win:'win', 'snake-attack':'snake', 'panther-attack':'panther'};
  const clipUrls = new Map();
  const clipUrl = c => clipUrls.get(c) || clipUrls.set(c, fetch(`clips/${c}.mp4`).then(r => r.ok ? r.blob() : Promise.reject()).then(b => URL.createObjectURL(b))).get(c);
  const action = (name, cap) => {
    const a = $('act'); if (!a) { backdrop(name); return; }
    a.querySelector('img').dataset.p = `jungle/${name}.jpg`; a.querySelector('b').textContent = cap; backdrop(name);
    const v = a.querySelector('video'), c = CLIP[name], go = (a._go || 0) + 1; a._go = go; a.dataset.clip = c || '';
    clearTimeout(a._t); a.classList.remove('has-clip'); v.pause();
    if (!c) return;
    const play = () => { if (a._go !== go || !a.isConnected) return; v.currentTime = 0; v.play().catch(() => {}); a.classList.add('has-clip'); };
    v.onended = () => { if (a._go !== go) return; a.classList.remove('has-clip'); a._t = setTimeout(play, 3000); };
    clipUrl(c).then(u => { if (a._go !== go) return; if (v.src !== u) v.src = u; a._t = setTimeout(play, 2500); }).catch(() => {});
  };
  setTimeout(() => Object.values(CLIP).forEach(c => clipUrl(c).catch(() => {})), 1500);   // fetch the rest in the background

  // The board's picture tiles: shown once every one is on the device, the emoji until then.
  const TILES = ['jungle1', 'jungle2', 'path', 'rock', 'gold', 'river', 'boat', 'snake', 'panther', 'anaconda'];
  Promise.all(TILES.map(t => api.picture(`jungle/tiles/${t}.jpg`).then(u => [t, u]))).then(pairs => {
    const b = $('board'); if (!b || !b.isConnected) return;
    for (const [t, u] of pairs) host.style.setProperty('--t-' + t, `url("${u}")`);
    b.classList.add('tiles');
  }).catch(() => {});
  host.innerHTML = `<img class="jg-bd" alt=""><div class="jg"><div class="jg-act" data-k="act"><video muted playsinline preload="auto"></video><img alt=""><b></b></div>
    <div class="jg-bar"><b>Level <span data-k="lvl">1</span></b><span class="jg-msg" data-k="msg"></span><b>Gold <span data-k="gold">${api.state.gold || 0}</span></b></div>
    <div class="jg-board" data-k="board" style="--w:${W}"></div>
    <div class="gq" data-k="q" hidden></div>
    <div class="jg-over" data-k="over" hidden></div></div>`;
  const $ = k => host.querySelector(`[data-k="${k}"]`);
  const at = (list, r, c) => list.find(x => x.r === r && x.c === c);
  const free = (g, r, c) => r >= 0 && r < H && c >= 0 && c < W && g[r][c] !== 'rock';
  function reachable(g, from, to){
    const seen = new Set([from.r + ',' + from.c]), q = [from];
    while (q.length) {
      const {r, c} = q.shift(); if (r === to.r && c === to.c) return true;
      for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nr = r + dr, nc = c + dc, k = nr + ',' + nc; if (free(g, nr, nc) && g[nr][nc] !== 'river' && !seen.has(k)) { seen.add(k); q.push({r:nr, c:nc}); } }
    }
    return false;
  }
  function newLevel(){
    let g, goldAt, pl;
    do {
      g = Array.from({length:H}, (_, r) => Array.from({length:W}, () => r === H - 1 ? 'river' : 'jungle'));
      for (let i = 0; i < 4 + level; i++) g[1 + rnd(H - 3)][rnd(W)] = 'rock';
      goldAt = {r:0, c:rnd(W)}; g[0][goldAt.c] = 'gold';
      pl = {r:H - 2, c:BOAT}; g[pl.r][pl.c] = 'path';
    } while (!reachable(g, pl, goldAt));
    const preds = [];
    const put = (kind, every, r, c) => { if (g[r][c] === 'rock' || g[r][c] === 'gold') g[r][c] = 'jungle'; preds.push({kind, every, r, c}); };
    const far = goldAt.c < W / 2 ? W - 1 : 0;
    put('panther', level >= 5 ? 2 : level >= 3 ? 3 : 4, 0, far);
    for (let i = 0; i < Math.min(3, 1 + Math.floor(level / 2)); i++) put('snake', 2, 2 + rnd(3), i % 2 ? 0 : W - 1);
    if (level >= 6) put('panther', 3, 1, W - 1 - far);
    st = {g, goldAt, pl, preds, has:false, turn:0};
    $('lvl').textContent = level;
    msg('Tap a square next to you to chop towards the gold.');
    draw();
    action('start', "Let's go!");
    busy = true;
    const o = $('over'); o.hidden = false;
    o.innerHTML = scene('start', `Level ${level}`, level === 1 ? 'Chop a path to the gold, then get back to the boat. Every right answer swings your machete.' : 'The jungle is wilder now. Keep your answers sharp!', 'begin', 'Start the adventure');
    loadPics(o);
  }
  const msg = t => { $('msg').textContent = t; };
  const near = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  function canGo(r, c){
    if (!st || busy) return false;
    if (r === st.pl.r && c === st.pl.c) return boxedIn();   // nowhere to go: stand your ground for a turn
    if (!near(st.pl, {r, c}) || !free(st.g, r, c) || at(st.preds, r, c)) return false;
    if (st.g[r][c] === 'river') return st.has && r === H - 1 && c === BOAT;
    return true;
  }
  function boxedIn(){
    const {r, c} = st.pl;
    return ![[1,0],[-1,0],[0,1],[0,-1]].some(([dr, dc]) => { const nr = r + dr, nc = c + dc;
      return free(st.g, nr, nc) && !at(st.preds, nr, nc) && (st.g[nr][nc] !== 'river' || (st.has && nr === H - 1 && nc === BOAT)); });
  }
  function draw(){
    const {g, pl, preds, has} = st;
    let h = '';
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const kind = g[r][c], p = at(preds, r, c), me = pl.r === r && pl.c === c, boat = r === H - 1 && c === BOAT;
      let inner = '';
      if (me) inner = `<span class="jg-me">${api.photo ? `<img src="${api.photo}" alt="">` : '🧒'}${has ? '<i>💰</i>' : ''}</span>`;
      else if (p) inner = `<span class="emo jg-${p.kind}${p.moved ? ' moved' : ''}">${p.kind === 'panther' ? '🐆' : '🐍'}</span>`;
      else if (boat) inner = '<span class="emo">🛶</span>';
      else if (kind === 'gold') inner = '<span class="emo">💰</span>';
      else if (kind === 'rock') inner = '<span class="emo">🪨</span>';
      else if (kind === 'jungle') inner = `<span class="emo">${['🌿', '🌴', '🌱'][(r * 7 + c * 3) % 3]}</span>`;
      const cls = `jg-c ${kind}${kind === 'jungle' && (r * 5 + c * 3) % 3 === 0 ? ' alt' : ''}${boat ? ' boat' : ''}${p ? ' has-' + p.kind : ''}${canGo(r, c) ? ' can' : ''}`;
      h += `<button class="${cls}" data-r="${r}" data-c="${c}" aria-label="Row ${r + 1}, column ${c + 1}">${inner}</button>`;
    }
    $('board').innerHTML = h;
    $('board').dataset.near = Math.min(snakeNear(), 9);   // the board glows amber, then red, as a snake closes in
    if (!busy && boxedIn()) msg('Boxed in! Tap yourself to hold your ground.');
  }
  function stepPred(p){
    const opts = [[1,0],[-1,0],[0,1],[0,-1]].map(([dr, dc]) => ({r:p.r + dr, c:p.c + dc}))
      .filter(o => o.r >= 0 && o.r < H && o.c >= 0 && o.c < W && st.g[o.r][o.c] !== 'rock' && (p.kind === 'anaconda' || st.g[o.r][o.c] !== 'river') && !at(st.preds, o.r, o.c));
    if (!opts.length) return;
    const d = o => Math.abs(o.r - st.pl.r) + Math.abs(o.c - st.pl.c), best = Math.min(...opts.map(d));
    if (d(p) > SENSE[p.kind] + (p.kind === 'panther' && level >= 3 ? 1 : 0)) return;   // panthers and anacondas only hunt when he comes close
    const pick = shuffle(opts.filter(o => d(o) === best))[0];
    if (best >= d(p)) return;   // never wander away
    p.r = pick.r; p.c = pick.c; p.moved = true;
  }
  const caught = () => st.preds.find(p => p.r === st.pl.r && p.c === st.pl.c);
  function over(win, who){
    busy = true;
    const o = $('over');
    o.hidden = false;
    if (win) {
      api.state.gold = (api.state.gold || 0) + 1; api.save(); $('gold').textContent = api.state.gold;
      o.innerHTML = scene('win', 'You made it to the boat with the gold!', `Level ${level} done. The jungle gets wilder from here.`, 'next', 'Next level');
      api.sound('win'); loadPics(o); action('win', 'Made it!');
    } else {
      if (who !== 'panther') hiss(.9, true); else roar(.8, true);
      o.innerHTML = scene(who === 'panther' ? 'panther-attack' : 'snake-attack', who === 'anaconda' ? 'An anaconda got you!' : who === 'panther' ? 'The panther got you!' : 'Snake attack!', `Right answers keep you ahead of them. Try level ${level} again.`, 'again', 'Try again');
      api.sound('bad'); loadPics(o); action(who === 'panther' ? 'panther-attack' : 'snake-attack', 'Look out!');
    }
  }
  function turn(ok, r, c){
    if (ok) {
      api.sound('ok');
      const stay = r === st.pl.r && c === st.pl.c;
      st.pl = {r, c};
      if (st.g[r][c] === 'jungle') st.g[r][c] = 'path';
      if (st.g[r][c] === 'gold' && !st.has) {
        st.has = true; st.g[r][c] = 'path';
        const ev = level >= 3 ? 2 : 3;
        st.preds.push({kind:'anaconda', every:ev, r:H - 1, c:0}, {kind:'anaconda', every:ev, r:H - 1, c:W - 1});
        if (level >= 3) st.preds.push({kind:'anaconda', every:3, r:H - 1, c:BOAT + (Math.random() < .5 ? -2 : 2)});
        msg('You got the gold! Run back to the boat before the anacondas get you!');
        action('chase', 'Run!');
        busy = true;
        const o = $('over'); o.hidden = false;
        o.innerHTML = scene('gold', 'You found the gold!', 'Now run back to the boat. The anacondas are coming out of the river!', 'run', 'Run for the boat!');
        loadPics(o);
      } else { msg(stay ? 'You held your ground!' : st.has ? 'Keep going: back to the boat!' : 'Chop! Keep heading for the gold.'); action(stay ? 'hold' : st.has ? (st.turn % 2 ? 'run' : 'chase') : 'chop', stay ? 'Held it!' : st.has ? 'Run!' : 'Chop!'); }
      if (st.has && r === H - 1 && c === BOAT) { draw(); over(true); return; }
    } else { api.sound('bad'); msg('Missed! They are getting closer.'); action('miss', 'Missed!'); }
    let who = caught();
    st.preds.forEach(p => { p.moved = false; });
    if (!who) {
      st.turn++;
      for (const p of st.preds) if (st.turn % p.every === 0 || !ok) { stepPred(p); if (p.r === st.pl.r && p.c === st.pl.c) { who = p; break; } }
    }
    draw();
    if (who) { over(false, who.kind); return; }
    const near = snakeNear();
    if (near <= 3) { hiss([0, .7, .45, .25][near]); heartbeat(near); }
    else if (st.preds.some(p => p.moved && p.kind !== 'panther')) hiss(.08);   // a soft rustle as snakes slither about
    const pn = pantherNear();
    if (pn === 1) { roar(.55); claw(); const me = host.querySelector('.jg-me'); if (me) { me.classList.remove('clawed'); void me.offsetWidth; me.classList.add('clawed'); } }
    else if (pn === 2 && st.preds.some(p => p.moved && p.kind === 'panther')) roar(.35);
  }
  host.onclick = e => {
    const go = e.target.closest('[data-go]');
    if (go) {
      $('over').hidden = true; busy = false;
      if (go.dataset.go === 'begin' || go.dataset.go === 'run') { draw(); return; }
      if (go.dataset.go === 'next') level++;
      newLevel(); return;
    }
    const cell = e.target.closest('.jg-c');
    if (!cell) return;
    const r = +cell.dataset.r, c = +cell.dataset.c;
    if (!canGo(r, c)) return;
    busy = true; draw();
    $('board').querySelector(`[data-r="${r}"][data-c="${c}"]`).classList.add('aim');
    cancelQ = askBox($('q'), api, 10, ok => { cancelQ = null; busy = false; turn(ok, r, c); });
  };
  newLevel();
  return {destroy(){ if (cancelQ) cancelQ(); music.pause(); host.querySelectorAll('video').forEach(v => v.pause()); host.onclick = null; host.innerHTML = ''; }};
}

/* ---------- Jessica: the Eras Stadium Show ---------- */
// Choose a dress and a song, then perform. Each right answer brings more fans in; fill the stadium to win the award.
// Song titles are real; the band plays an original tune made here, never the recording or its words. The real song is a
// tap away in Apple Music (url: the track; Jessica's own favourites open an Apple Music search). Stage 2 may play it here.
const SONGS = [
  {title:'Tim McGraw', era:0, bpm:92, url:'https://music.apple.com/gb/album/tim-mcgraw/1440802681?i=1440802686'}, {title:'Love Story', era:1, bpm:118, url:'https://music.apple.com/gb/album/love-story-taylors-version/1552791073?i=1552791427'},
  {title:'Enchanted', era:2, bpm:100, url:'https://music.apple.com/gb/album/enchanted-taylors-version/1690839749?i=1690840535'}, {title:'All Too Well', era:3, bpm:94, url:'https://music.apple.com/gb/album/all-too-well-taylors-version/1590368448?i=1590368456'},
  {title:'Shake It Off', era:4, bpm:160, url:'https://music.apple.com/gb/album/shake-it-off-taylors-version/1708308989?i=1708309002'}, {title:'...Ready for It?', era:5, bpm:120, url:'https://music.apple.com/gb/album/ready-for-it/1440933849?i=1440934248'},
  {title:'Cruel Summer', era:6, bpm:170, url:'https://music.apple.com/gb/album/cruel-summer/1468058165?i=1468058171'}, {title:'cardigan', era:7, bpm:130, url:'https://music.apple.com/gb/album/cardigan/1524793738?i=1524793745'},
  {title:'willow', era:8, bpm:84, url:'https://music.apple.com/gb/album/willow/1544275966?i=1544276228'}, {title:'Anti-Hero', era:9, bpm:97, url:'https://music.apple.com/gb/album/anti-hero/1649434004?i=1649434293'},
  {title:'Fortnight', era:10, bpm:96, url:'https://music.apple.com/gb/album/fortnight-feat-post-malone/1736268193?i=1736268194'}, {title:'The Fate of Ophelia', era:11, bpm:126, url:'https://music.apple.com/gb/album/the-fate-of-ophelia/1838810949?i=1838810951'}
];
const appleMusic = s => s.url || `https://music.apple.com/gb/search?term=${encodeURIComponent('Taylor Swift ' + s.title)}`;
const CAPACITY = 90000, AWARD_AT = 80000;

// An original pop tune: drums, bass, chords and a hook, all made in the browser from the song's own number.
function tune(ac, seedText, bpm){
  let seed = [...seedText].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const out = ac.createGain(); out.gain.value = .5; out.connect(ac.destination);
  const noise = ac.createBuffer(1, ac.sampleRate * .5, ac.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const root = 57 + Math.floor(rand() * 8), prog = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], scale = [0, 2, 4, 7, 9, 12, 14, 16];
  const hook = Array.from({length:16}, () => rand() < .78 ? scale[Math.floor(rand() * scale.length)] : null);
  const hook2 = hook.map((n, i) => i >= 8 && n !== null ? scale[Math.floor(rand() * scale.length)] : n);
  const tone = (type, f, t, len, vol, dest = out) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + len); o.connect(g); g.connect(dest); o.start(t); o.stop(t + len + .05); };
  const hit = (t, len, vol, f) => { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise; fl.type = f[0]; fl.frequency.value = f[1]; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + len); s.connect(fl); fl.connect(g); g.connect(out); s.start(t); s.stop(t + len + .02); };
  const kick = t => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + .12); g.gain.setValueAtTime(.55, t); g.gain.exponentialRampToValueAtTime(.0001, t + .25); o.connect(g); g.connect(out); o.start(t); o.stop(t + .3); };
  const step = 60 / bpm / 4;
  let next = ac.currentTime + .1, i = 0;
  const timer = setInterval(() => {
    while (next < ac.currentTime + .25) {
      const bar = Math.floor(i / 16), s = i % 16, ch = prog[bar % 4], r = root + ch[0];
      if (s % 4 === 0) kick(next);
      if (s === 4 || s === 12) hit(next, .18, .3, ['highpass', 1200]);
      if (s % 2 === 0) hit(next, .04, .08, ['highpass', 7000]);
      if (s === 0 || s === 6 || s === 8 || s === 14) tone('sawtooth', hz(r - 24), next, step * 1.8, .09);
      if (s === 0) ch.forEach(n => tone('triangle', hz(root + n), next, step * 15, .05));
      const mel = (bar % 4 === 3 ? hook2 : hook)[s];
      if (bar >= 1 && mel !== null && s % 2 === 0) tone('square', hz(root + 12 + mel), next, step * 1.6, .035);
      next += step; i++;
    }
  }, 50);
  return {barSec: step * 16, stop(){ clearInterval(timer); try { out.gain.setTargetAtTime(.0001, ac.currentTime, .2); setTimeout(() => out.disconnect(), 800); } catch {} }};
}
function cheer(ac, big){
  try {
    const len = big ? 2.2 : 1.2, b = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / d.length);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = .6; g.gain.value = big ? .5 : .3;
    s.connect(f); f.connect(g); g.connect(ac.destination); s.start();
  } catch {}
}

function stage(host, api){
  // Jessica's real stage photos (private bucket, cached on the device): per dress a = singing, d = dancing, t = twirling.
  const sv = api.state, pick = {dress: sv.dress ?? 2, song: sv.song ?? 4};
  // Jessica's own set list (Sam, 24 Oct 2026): she chooses her 10 favourite songs, and once all 10 are in it is fixed and
  // replaces the twelve below. Until then the twelve play, and she can take a pick out again to fix a mistake.
  const MY_SET = 10, mine = () => sv.mySongs || [], fixed = () => mine().length >= MY_SET;
  const known = t => SONGS.find(x => x.title.toLowerCase().replace(/[^a-z]/g, '') === t.toLowerCase().replace(/[^a-z]/g, ''));
  const songs = () => fixed() ? mine().slice(0, MY_SET).map(s => ({title: s.title, era: s.era, bpm: (known(s.title) || {}).bpm || 112, url: (known(s.title) || {}).url})) : SONGS;
  if (pick.song >= songs().length) pick.song = 4;
  const pic = (d, p) => `stage/era${String(d).padStart(2, '0')}-${p}.jpg`;
  const load = (img, path) => api.picture(path).then(u => { if (img.isConnected) img.src = u; }).catch(() => { img.alt = 'Connect to Wi-Fi once to load this photo'; });
  let show = null;
  // The MTV Video Music Award: a silver astronaut planting a flag, on a black base (drawn here, logo left off the flag).
  const awardSvg = size => `<svg viewBox="0 0 80 120" width="${size}" height="${Math.round(size * 1.5)}" aria-hidden="true">
    <defs><linearGradient id="moon-chrome" x1="0" x2="1"><stop offset="0" stop-color="#8E959F"/><stop offset=".45" stop-color="#F4F6F8"/><stop offset="1" stop-color="#9AA1AB"/></linearGradient></defs>
    <path d="M14 104 h52 v12 h-52 z" fill="#1C1C22" stroke="var(--line)" stroke-width="2"/><ellipse cx="40" cy="104" rx="26" ry="4" fill="#3A3740" stroke="var(--line)" stroke-width="2"/>
    <path d="M58 104 V8" stroke="url(#moon-chrome)" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M58 10 Q68 6 76 12 L76 34 Q68 28 58 32 Z" fill="url(#moon-chrome)" stroke="var(--line)" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M22 44 h10 v26 h-10 z" fill="url(#moon-chrome)" stroke="var(--line)" stroke-width="1.8"/>
    <path d="M28 46 Q28 40 36 40 L46 40 Q54 40 54 48 L54 70 Q54 74 50 74 L32 74 Q28 74 28 70 Z" fill="url(#moon-chrome)" stroke="var(--line)" stroke-width="2"/>
    <path d="M52 50 L58 46" stroke="url(#moon-chrome)" stroke-width="7" stroke-linecap="round"/><circle cx="58" cy="46" r="3.6" fill="url(#moon-chrome)" stroke="var(--line)" stroke-width="1.4"/>
    <path d="M34 74 L32 100 h8 l2 -20 l2 20 h8 l-2 -26 Z" fill="url(#moon-chrome)" stroke="var(--line)" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="41" cy="30" r="13" fill="url(#moon-chrome)" stroke="var(--line)" stroke-width="2"/>
    <path d="M33 26 Q41 20 49 26 Q51 34 41 36 Q31 34 33 26 Z" fill="#2B2F3A" stroke="var(--line)" stroke-width="1.4"/><path d="M36 26 Q40 23 44 25" stroke="#FFFFFF" stroke-width="1.6" fill="none" opacity=".8"/>
  </svg>`;
  function wardrobe(){
    if (show) { show.stop(); show = null; }
    host.innerHTML = `<div class="stg-pick">
      <div class="sticker stg-preview"><img class="stg-big" data-p="${pic(pick.dress, 'a')}" alt="Jessica in the ${esc(api.eras[pick.dress].album)} dress"><p class="muted small">${(sv.awards || 0) ? `MTV Awards won: ${sv.awards} · ` : ''}Biggest crowd: ${(sv.best || 0).toLocaleString('en-GB')}</p></div>
      <div class="stg-opts">
        <div class="sticker"><h3>1. Choose your dress</h3><div class="looks">${api.eras.map((e, k) => `<button class="look ${pick.dress === k ? 'on' : ''}" data-dress="${k}" aria-label="${esc(e.album)} dress"><img data-p="${pic(k, 'a')}" alt=""><span style="--era:${e.hex};--era-t:${e.text}">${esc(e.era)}</span></button>`).join('')}</div></div>
        <div class="sticker"><h3>2. Pick your song</h3><div class="songs">${songs().map((s, k) => `<button class="song ${pick.song === k ? 'on' : ''}" data-song="${k}" style="--era:${api.eras[s.era].hex};--era-t:${api.eras[s.era].text}">${esc(s.title)}</button>`).join('')}</div>
          <div class="row" style="margin-top:12px"><a class="btn small" href="${appleMusic(songs()[pick.song])}" target="_blank" rel="noopener">\u25B6 Play \u201C${esc(songs()[pick.song].title)}\u201D in Apple Music</a></div>
          ${fixed() ? `<p class="muted small" style="margin-top:10px">This is your own set list of ${MY_SET} favourites.</p>` : `<form class="addsong" data-k="addsong"><label for="as-t">Make your own set list: choose your ${MY_SET} favourite songs (${mine().length} of ${MY_SET} chosen). Once all ${MY_SET} are in, it is fixed.</label>
            ${mine().length ? `<div class="chips">${mine().map((m, k) => `<button class="tchip" type="button" data-del="${k}" aria-label="Take out ${esc(m.title)}">${esc(m.title)} \u2715</button>`).join('')}</div>` : ''}
            <div class="row"><input id="as-t" name="t" maxlength="40" required placeholder="Song title"><select name="e" aria-label="Which era">${api.eras.map((e, k) => `<option value="${k}">${esc(e.album)}</option>`).join('')}</select><button class="btn small" type="submit">Add</button></div></form>`}
          <p class="muted small" style="margin-top:8px">On stage the band plays its own tune. Tap Play to hear the real song.</p></div>
        <button class="btn big" data-go="stage">Go on stage</button>
      </div></div>`;
    host.querySelectorAll('img[data-p]').forEach(im => load(im, im.dataset.p));
  }
  function concert(){
    const song = songs()[pick.song] || SONGS[4], ac = api.audio();
    sv.dress = pick.dress; sv.song = pick.song; api.save();
    let crowd = 15000, asked = 0, right = 0, cancelQ = null, ended = false, pose = 0;
    host.innerHTML = `<div class="stg">
      <div class="stg-photos"><img class="stg-fill" data-p="${pic(pick.dress, 'a')}" alt="">${['a', 'd', 'a', 't'].map((p, i) => `<img class="pose ${i === 0 ? 'on' : ''}" data-p="${pic(pick.dress, p)}" alt="">`).join('')}</div>
      <div class="stg-hud"><b>${esc(song.title)}</b><span>Fans: <b data-k="count">15,000</b></span><div class="meter"><span data-k="fill"></span></div></div>
      <div class="stg-pop" data-k="pop"></div>
      <div class="gq" data-k="q" hidden></div>
      <div class="jg-over" data-k="over" hidden></div></div>`;
    const $ = k => host.querySelector(`[data-k="${k}"]`), imgs = [...host.querySelectorAll('.stg-photos img.pose')], box = host.querySelector('.stg');
    host.querySelectorAll('.stg-photos img').forEach(im => load(im, im.dataset.p));
    const paint = () => { $('count').textContent = crowd.toLocaleString('en-GB'); $('fill').style.width = Math.min(100, crowd / CAPACITY * 100) + '%'; };
    paint();
    const t = tune(ac, song.title, song.bpm), bars = 24, endAt = Date.now() + t.barSec * bars * 1000;
    box.style.setProperty('--beat', (t.barSec / 4).toFixed(3) + 's');
    const dance = setInterval(() => { pose = (pose + 1) % imgs.length; imgs.forEach((im, i) => im.classList.toggle('on', i === pose)); }, t.barSec * 1000);
    show = {stop(){ ended = true; t.stop(); if (cancelQ) cancelQ(); clearInterval(loop); clearInterval(dance); }};
    let nextQ = Date.now() + t.barSec * 2000;
    const loop = setInterval(() => {
      if (ended) return;
      if (Date.now() >= endAt && !cancelQ) { finish(); return; }
      if (!cancelQ && Date.now() >= nextQ && Date.now() < endAt - 3000) {
        asked++;
        cancelQ = askBox($('q'), api, 7, ok => {
          cancelQ = null; nextQ = Date.now() + t.barSec * 1000;
          if (ok) {
            right++; const more = 6000 + rnd(3000); crowd = Math.min(CAPACITY, crowd + more); cheer(ac, false);
            $('pop').textContent = '+' + more.toLocaleString('en-GB') + ' fans!'; $('pop').classList.remove('go'); void $('pop').offsetWidth; $('pop').classList.add('go');
            box.classList.add('roar'); setTimeout(() => box.isConnected && box.classList.remove('roar'), 700);
          } else crowd = Math.max(5000, crowd - 1500);
          paint();
        });
      }
    }, 200);
    function finish(){
      show.stop(); show = null;
      const award = crowd >= AWARD_AT;
      sv.best = Math.max(sv.best || 0, crowd); if (award) sv.awards = (sv.awards || 0) + 1; api.save();
      if (award) { cheer(ac, true); api.sound('win'); }
      const o = $('over'); o.hidden = false;
      o.innerHTML = `<div class="sticker">${award ? awardSvg(90) : ''}
        <h2>${award ? 'You won an MTV Award!' : 'What a show!'}</h2>
        <p><b>${crowd.toLocaleString('en-GB')}</b> fans came to see you sing ${esc(song.title)}. You got ${right} of ${asked} right.</p>
        <p class="muted">${award ? 'A packed stadium and a trophy for the shelf. Encore!' : `Fill the stadium with ${AWARD_AT.toLocaleString('en-GB')} fans to win the MTV Award. Every right answer brings more people in.`}</p>
        <div class="row" style="justify-content:center"><button class="btn big" data-go="stage">Sing again</button><button class="btn ghost" data-go="wardrobe">Change dress or song</button></div></div>`;
    }
  }
  host.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.dress) { pick.dress = +b.dataset.dress; wardrobe(); }
    else if (b.dataset.song) { pick.song = +b.dataset.song; wardrobe(); }
    else if (b.dataset.del && !fixed()) { const m = mine().slice(); m.splice(+b.dataset.del, 1); sv.mySongs = m; api.save(); wardrobe(); }
    else if (b.dataset.go === 'stage') concert();
    else if (b.dataset.go === 'wardrobe') wardrobe();
  };
  host.onsubmit = e => {
    e.preventDefault(); const f = e.target; if (f.dataset.k !== 'addsong' || fixed()) return;
    const title = f.t.value.trim().slice(0, 40); if (!title) return;
    const m = mine().filter(s => s.title.toLowerCase() !== title.toLowerCase()); m.push({title, era: +f.e.value || 0}); sv.mySongs = m.slice(0, MY_SET);
    if (fixed()) { pick.song = 0; sv.song = 0; } api.save(); wardrobe();
  };
  wardrobe();
  // Fetch every stage photo now, so the show also works with no internet later.
  for (let d = 0; d < 12; d++) for (const p of ['a', 'd', 't']) api.picture(pic(d, p)).catch(() => {});
  return {destroy(){ if (show) show.stop(); host.onclick = null; host.onsubmit = null; host.innerHTML = ''; }};
}

window.TTCGames = {jungle, stage};
})();
