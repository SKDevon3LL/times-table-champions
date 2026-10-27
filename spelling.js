// Spelling (Sam, 27 Oct 2026): the same app, sign-in and rewards as the times tables, in the same shape: a Daily Spelling
// Challenge, then a Bonus Round in order (Beat the Clock, Learn today's rule, Test) for double points, plus extra practice.
// Built on what the best spelling programmes do: words come back on a schedule until they stick (wrong today, back
// tomorrow, then 3 days, a week, 2 weeks, a month), one spelling rule at a time, help that fades (see the word, then build
// it from its own letter tiles, then tiles with extra letters, then the full keyboard), every word heard with a sentence,
// mistakes shown letter by letter and put right before moving on, and timers with personal bests (Sam: "my children are
// competitive so timers and PBs are important"). Spelling trophies go on the same weekly trail as the times tables.
(function(){
const SP = window.TTC_SPELL || {rules: [], lists: {y34: [], y56: []}, hooks: {}};
const INTERVALS = [0, 1, 3, 7, 14, 30], MASTER = 5;

// Every word once: the first place it appears wins (a rule's examples, then the statutory lists).
const WORDS = new Map();
for (const r of SP.rules) for (const [w, s] of r.words) if (!WORDS.has(w.toLowerCase())) WORDS.set(w.toLowerCase(), {w, s, rule: r.id, track: r.track});
for (const k of ['y34', 'y56']) for (const [w, s, syl] of SP.lists[k]) { const o = WORDS.get(w.toLowerCase()); if (o) { o.syl = o.syl || syl; o.list = k; } else WORDS.set(w.toLowerCase(), {w, s, syl, list: k, track: k}); }

const better = {
  daily: (a, b) => !b || a.ms < b.ms,
  clock: (a, b) => !b || a.score > b.score,
  test: (a, b) => !b || a.pct > b.pct || (a.pct === b.pct && a.ms < b.ms),
};
// Two devices' copies of a child's spelling, merged (called by the app's sync).
window.TTCSpellMerge = (a, b) => {
  if (!a) return b; if (!b) return a;
  const r = Object.assign({}, b, a);
  r.words = {};
  for (const k of new Set([...Object.keys(a.words || {}), ...Object.keys(b.words || {})])) {
    const x = (a.words || {})[k], y = (b.words || {})[k];
    r.words[k] = !x ? y : !y ? x : (x.n > y.n || (x.n === y.n && (x.t || 0) >= (y.t || 0))) ? x : y;
  }
  r.daily = Object.assign({}, b.daily); for (const [k, v] of Object.entries(a.daily || {})) if (!r.daily[k] || v.pct > r.daily[k].pct) r.daily[k] = v;
  const steps = v => Object.keys(v.steps || {}).length;
  r.bonus = Object.assign({}, b.bonus); for (const [k, v] of Object.entries(a.bonus || {})) { const o = r.bonus[k]; if (!o || steps(v) > steps(o) || (steps(v) === steps(o) && (v.heard || []).length >= (o.heard || []).length)) r.bonus[k] = v; }
  r.bests = Object.assign({}, b.bests); for (const [k, v] of Object.entries(a.bests || {})) if (better[k] ? better[k](v, r.bests[k]) : true) r.bests[k] = v;
  r.intro = Object.assign({}, b.intro); for (const [k, v] of Object.entries(a.intro || {})) r.intro[k] = [...new Set([...(r.intro[k] || []), ...v])];
  if (a.game || b.game) r.game = {right: Math.max((a.game || {}).right || 0, (b.game || {}).right || 0), tries: Math.max((a.game || {}).tries || 0, (b.game || {}).tries || 0)};
  return r;
};

window.TTCSpell = function(X){
  const {esc} = X;
  const today = () => X.dayStr();
  const addDays = (d, n) => { const t = new Date(d + 'T12:00:00'); t.setDate(t.getDate() + n); return X.dayStr(t.getTime()); };
  const st = () => { const p = X.S.prog; p.spell = p.spell || {}; const s = p.spell; for (const k of ['words', 'daily', 'bonus', 'bests', 'intro']) s[k] = s[k] || {}; return s; };
  // Years 3 and 4 for the younger child, Years 5 and 6 for the older (worked out from the school year the app already uses).
  const track = () => X.yearOf(X.S.me) <= 5 ? 'y34' : 'y56';
  const younger = () => track() === 'y34';
  const rules = () => SP.rules.filter(r => r.track === track());
  const info = w => WORDS.get(String(w).toLowerCase()) || school().find(x => x.w.toLowerCase() === String(w).toLowerCase()) || {w, s: ''};
  const rec = w => st().words[String(w).toLowerCase()];
  // Words the grown-ups typed in from school this week (Grown-ups area, Spelling tab) come first.
  const school = () => ((X.S.spellLists || {})[X.S.me.id] || {}).words || [];
  const currentRule = () => rules().find(r => r.words.some(([w]) => !rec(w))) || rules()[rules().length - 1];
  const due = w => { const r = rec(w); return r && r.due <= today(); };
  const mastered = () => Object.entries(st().words).filter(([, r]) => r.b >= MASTER);
  const learning = () => Object.entries(st().words).filter(([, r]) => r.b < MASTER);
  // The help fades as a word settles: see it (copy), build it from its own letters, then with extra letters, then type it.
  // The older child goes from seeing the word straight to typing it.
  const modeFor = w => { const r = rec(w); if (!r || r.b === 0) return 'copy'; if (!younger()) return 'type'; return r.b === 1 ? 'tiles' : r.b === 2 ? 'tiles+' : 'type'; };
  const PTS = {copy: 5, tiles: 10, 'tiles+': 12, type: 15};

  /* ---------- speaking: the word, a sentence, then the word again, in a British voice ---------- */
  let voice = null;
  const pickVoice = () => { if (voice || !window.speechSynthesis) return; const vs = speechSynthesis.getVoices();
    voice = vs.find(v => /en[-_]GB/i.test(v.lang) && /Daniel|Kate|Serena|Arthur|Martha|Stephanie|Google UK/i.test(v.name)) || vs.find(v => /en[-_]GB/i.test(v.lang)) || null; };
  if (window.speechSynthesis) { speechSynthesis.onvoiceschanged = () => { voice = null; pickVoice(); }; pickVoice(); }
  const speak = parts => { if (!window.speechSynthesis) return; try { speechSynthesis.cancel(); pickVoice();
    for (const [text, rate] of parts) { if (!text) continue; const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; if (voice) u.voice = voice; u.rate = rate || .92; speechSynthesis.speak(u); } } catch {} };
  // Recorded in a British voice (Sam, 27 Oct 2026: the iPad's own voice was "terrible"): audio/spell/w/<word>.m4a is the word,
  // its sentence and the word again; audio/spell/p/<word>.m4a says it in parts. School words have no recording and use the
  // iPad's voice.
  let clip = null;
  const play = (path, fallback) => { try { if (window.speechSynthesis) speechSynthesis.cancel(); if (clip) { clip.pause(); clip = null; }
    const a = clip = new Audio(path); let fell = false; const fb = () => { if (fell || clip !== a) return; fell = true; fallback(); };
    a.onerror = fb; a.play().catch(e => { if (e && e.name === 'NotAllowedError') return; fb(); }); } catch { fallback(); } };
  const file = w => encodeURIComponent(String(w).toLowerCase());
  // Which words have recordings: audio/spell/index.json ({"w": [...], "p": [...]}), fetched once. Until it arrives, or for a
  // word not in it, the iPad's voice speaks straight away (an iPad only lets speech start straight after a tap).
  let have = {w: new Set(), p: new Set()};
  fetch('audio/spell/index.json').then(r => r.ok ? r.json() : null).then(j => { if (j) have = {w: new Set(j.w || []), p: new Set(j.p || [])}; }).catch(() => {});
  const recorded = (w, k = 'w') => have[k].has(String(w).toLowerCase());
  const sayWord = w => { const o = info(w), say = () => speak([[o.w, .8], [o.s, .95], [o.w, .8]]); recorded(w) ? play(`audio/spell/w/${file(w)}.m4a`, say) : say(); };
  const sayParts = w => { const o = info(w), say = () => speak([[o.syl ? o.syl.split('-').join(', ') : o.w, .7]]); recorded(w, 'p') ? play(`audio/spell/p/${file(w)}.m4a`, say) : say(); };

  /* ---------- the word schedule ---------- */
  function touch(w){ const k = w.toLowerCase(); const s = st(); if (!s.words[k]) s.words[k] = {b: 0, due: today(), n: 0, c: 0, first: Date.now(), t: Date.now()}; return s.words[k]; }
  // A first try at a word (not the see-it step) moves it on the schedule: right moves it up a step (once a day), wrong
  // brings it back tomorrow. Five steps right, on different days, and it is mastered; it still comes back after a month.
  function score(w, ok){
    const r = touch(w); r.n++; r.t = Date.now();
    if (ok) { r.c++; if (r.last !== today()) { r.b = Math.min(MASTER, r.b + 1); r.last = today(); r.due = addDays(today(), r.b >= MASTER ? 30 : INTERVALS[r.b]); if (r.b >= MASTER && !r.m) r.m = Date.now(); } }
    else { r.b = 1; r.due = addDays(today(), 1); r.wrong = (r.wrong || 0) + 1; r.m = 0; }
  }
  // Today's new words: from the current rule, plus from the statutory list (school words first). Fixed once chosen.
  function newToday(){
    const s = st(), d = today();
    if (s.intro[d]) return s.intro[d];
    const want = younger() ? [2, 1] : [3, 2], out = [];
    for (const o of school()) if (out.length < want[0] + want[1] && !rec(o.w)) out.push(o.w);
    const r = currentRule(); for (const [w] of (r ? r.words : [])) { if (out.length >= want[0]) break; if (!rec(w) && !out.includes(w)) out.push(w); }
    let m = 0; for (const [w] of SP.lists[track()]) { if (m >= want[1]) break; if (!rec(w) && !out.includes(w) && !WORDS.get(w.toLowerCase()).rule) { out.push(w); m++; } }
    s.intro[d] = out; const keys = Object.keys(s.intro).sort(); while (keys.length > 60) delete s.intro[keys.shift()];
    return out;
  }
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const known = () => Object.entries(st().words).filter(([, r]) => r.b >= 1).map(([k]) => info(k).w);
  // The Daily Spelling Challenge: words due back first, then today's new words (seen first, then from sound later on),
  // then recent words to fill it up.
  function dailyItems(){
    const size = younger() ? 10 : 15, nw = newToday().filter(w => !rec(w) || rec(w).b === 0);
    const dueW = Object.entries(st().words).filter(([, r]) => r.b >= 1 && r.due <= today()).sort((a, b) => a[1].b - b[1].b || a[1].due.localeCompare(b[1].due)).map(([k]) => info(k).w);
    const pick = [...dueW.slice(0, Math.max(0, size - nw.length))];
    for (const w of shuffle(known())) { if (pick.length >= size - nw.length) break; if (!pick.includes(w)) pick.push(w); }
    // each new word is seen first, then asked from sound once the others have been seen, with the older words in between
    const old = shuffle(pick).map(w => ({w, mode: modeFor(w)})), half = Math.ceil(old.length / 2);
    return [...nw.map(w => ({w, mode: 'copy', intro: true})), ...old.slice(0, half), ...nw.map(w => ({w, mode: younger() ? 'tiles' : 'type', after: true})), ...old.slice(half)];
  }
  const poolFor = n => { const k = known(), sorted = k.sort((a, b) => (rec(a).b - rec(b).b) || (Math.random() - .5)); return shuffle(sorted.slice(0, Math.max(n, Math.min(k.length, n * 2)))).slice(0, n); };

  /* ---------- today: the Daily Challenge, then the Bonus Round in order ---------- */
  const STEPS = [{k: 'clock', name: 'Beat the Clock', sub: 'Spell as many as you can in 60 seconds.'}, {k: 'learn', name: 'Learn the rule', sub: 'Hear 5 words that follow it.'}, {k: 'test', name: 'Spelling test', sub: 'Hear the sentence, spell the word. Then your points double!'}];
  const dailyDone = () => { const d = st().daily[today()]; return !!(d && d.pct >= 80); };
  const bonus = () => { const s = st(), d = today(); if (!s.bonus[d]) { s.bonus[d] = {xp: 0, steps: {}, heard: []}; const k = Object.keys(s.bonus).sort(); while (k.length > 60) delete s.bonus[k.shift()]; } return s.bonus[d]; };
  const stepAt = () => { const b = st().bonus[today()] || {steps: {}}; const i = STEPS.findIndex(x => !(b.steps || {})[x.k]); return i < 0 ? STEPS.length : i; };

  /* ---------- playing ---------- */
  function start(kind, opts = {}){
    if (kind !== 'learn' && !known().length && kind !== 'daily') { X.toast('Do the Daily Spelling Challenge first to learn some words.'); return; }
    let items;
    if (kind === 'daily') items = dailyItems();
    else if (kind === 'clock') items = poolFor(40).map(w => ({w, mode: modeFor(w) === 'copy' ? 'type' : modeFor(w)}));
    else if (kind === 'test') items = poolFor(younger() ? 10 : 20).map(w => ({w, mode: modeFor(w) === 'copy' ? 'type' : modeFor(w), test: true}));
    else if (kind === 'practice') items = (opts.words || poolFor(10)).map(w => ({w, mode: modeFor(w)}));
    if (kind === 'learn') { X.S.sp = {kind, rule: currentRule(), start: Date.now()}; X.go('splay'); return; }
    if (!items || !items.length) { X.toast('No words to practise yet.'); return; }
    const P = X.S.sp = {kind, items, i: 0, input: '', answers: [], start: Date.now(), fb: null, ends: kind === 'clock' ? Date.now() + 60000 : 0};
    setup(P); X.go('splay'); sayWord(P.items[0].w);
    P.timer = setInterval(() => tick(P), 250);
  }
  function setup(P){
    const it = P.items[P.i]; P.input = ''; P.used = [];
    if (it.mode === 'copy' && !younger()) { P.tiles = null; return; }
    if (it.mode === 'copy' || it.mode === 'tiles' || it.mode === 'tiles+') {
      const letters = it.w.toLowerCase().split('');
      const extra = it.mode === 'tiles+' ? shuffle('aeiourstlnmcdph'.split('').filter(c => !letters.includes(c))).slice(0, 3) : [];
      P.tiles = shuffle([...letters, ...extra]);
    } else P.tiles = null;
  }
  function tick(P){
    if (X.S.sp !== P || X.S.screen !== 'splay') { clearInterval(P.timer); return; }
    const el = document.getElementById('sp-time');
    if (P.kind === 'clock') { const left = Math.max(0, P.ends - Date.now()); if (el) el.textContent = Math.ceil(left / 1000) + 's'; if (left <= 0) finish(); }
    else if (el) el.textContent = X.fmtClock(Date.now() - P.start);
  }
  function key(k){
    const P = X.S.sp; if (!P || !P.items || P.done) return;
    const it = P.items[P.i];
    if (k === 'back') { if (P.tiles && P.used.length) P.used.pop(); P.input = P.input.slice(0, -1); X.render(); return; }
    if (k === 'ok') { check(); return; }
    if (P.input.length >= 24) return;
    P.input += k; X.render();
    if (P.tiles && P.input.length >= it.w.length) check();
  }
  function tile(i){ const P = X.S.sp; if (!P || !P.tiles || P.used.includes(i)) return; P.used.push(i); key(P.tiles[i]); }
  function check(){
    const P = X.S.sp, it = P.items[P.i]; if (!P.input) return;
    const ok = P.input.toLowerCase() === it.w.toLowerCase();
    if (it.fixing) {   // putting a mistake right: copy it until it is right, then on
      if (ok) { X.sound('ok'); P.fb = null; next(); } else { X.sound('bad'); P.input = ''; if (P.tiles) P.used = []; X.render(); }
      return;
    }
    const counts = it.mode !== 'copy';
    if (counts) score(it.w, ok); else touch(it.w);
    P.answers.push({w: it.w, ok, mode: it.mode, got: P.input, counts, pts: ok ? PTS[it.mode] : 0});
    if (ok) { X.sound('ok'); P.fb = {ok: true}; next(); return; }
    X.sound('bad');
    if (P.kind === 'clock') { P.fb = {ok: false, got: P.input, w: it.w}; next(); return; }
    // Wrong: show where, then put it right with the word in view, and it comes back once later.
    P.fb = {ok: false, got: P.input, w: it.w};
    it.fixing = true; it.mode0 = it.mode; it.mode = 'copy'; setup(P);
    if (!P.items.slice(P.i + 1).some(x => x.w === it.w) && P.kind !== 'test') P.items.splice(Math.min(P.items.length, P.i + 4), 0, {w: it.w, mode: it.mode0 === 'copy' ? (younger() ? 'tiles' : 'type') : it.mode0, again: true});
    X.render(); sayWord(it.w);
  }
  function next(){
    const P = X.S.sp; P.i++;
    if (P.kind === 'clock' && P.i >= P.items.length) P.items.push(...poolFor(20).map(w => ({w, mode: modeFor(w) === 'copy' ? 'type' : modeFor(w)})));
    if (P.i >= P.items.length) { finish(); return; }
    setup(P); X.render(); sayWord(P.items[P.i].w);
  }
  function quit(){ const P = X.S.sp; if (P && P.answers && P.answers.some(a => a.counts)) finish(true); else { if (P) clearInterval(P.timer); X.S.sp = null; X.go('spell'); } }

  function finish(stopped){
    const P = X.S.sp; if (!P || P.done) return; P.done = true; clearInterval(P.timer);
    if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch {}
    if (clip) { clip.pause(); clip = null; }
    const p = X.S.prog, s = st(), sc = P.answers.filter(a => a.counts), n = sc.length, c = sc.filter(a => a.ok).length;
    const pct = n ? Math.round(c / n * 100) : 0, ms = Date.now() - P.start, kind = P.kind;
    let xp = P.answers.reduce((t, a) => t + a.pts, 0), extra = [], prize = null, pb = null, dDone = false, bonusMsg = null;
    if (!stopped && kind === 'daily') {
      const prev = s.daily[today()];
      if (pct >= 80 && !(prev && prev.pct >= 80)) { xp += 50; dDone = true; extra.push(`50 for finishing the Daily Spelling Challenge`); }
      if (!prev || pct > prev.pct) s.daily[today()] = {pct, c, n};
      prize = X.tierFor(pct);
      if (pct >= 80) pb = bestCheck('daily', {ms, t: Date.now()}, 20);
    }
    if (!stopped && kind === 'clock') pb = bestCheck('clock', {score: c, t: Date.now()}, 30);
    // a test best only counts once the test has its full number of words (early on there are not enough words learnt)
    if (!stopped && kind === 'test') { prize = X.tierFor(pct); if (n >= (younger() ? 10 : 20)) pb = bestCheck('test', {pct, ms, t: Date.now()}, 30); }
    if (pb && pb.x) { xp += pb.x; extra.push(`${pb.x} for a new personal best`); }
    // The Bonus Round: a step counts when played in its turn; the test is last and pays the round's points again.
    if (!stopped && dailyDone() && (kind === 'clock' || kind === 'test')) {
      const i = stepAt(), cur = STEPS[i];
      if (cur && cur.k === kind) { const b = bonus(); b.steps[kind] = Date.now(); b.xp += xp;
        if (kind === 'test') { b.bonusXp = b.xp; b.done = Date.now(); xp += b.bonusXp; bonusMsg = `Bonus Round complete! +${b.bonusXp} extra ${X.ptsName()}.`; }
        else bonusMsg = `Bonus Round: ${i + 1} of ${STEPS.length} done.`;
      }
    }
    // one Daily Challenge trophy and one test trophy a day, so the weekly trail is earned, not farmed
    const won = s.won = s.won || {};
    if (prize && won[kind] === today()) prize = null; else if (prize) won[kind] = today();
    const itemsBefore = X.itemsOwned(p);
    p.xp += xp;
    if (!p.days.includes(today())) { p.days.push(today()); if (p.days.length > 400) p.days.shift(); }
    if (prize) { p.prizes[prize.id] = (p.prizes[prize.id] || 0) + 1; p.prizeLog.unshift({t: Date.now(), tier: prize.id, pct, mode: 'spell-' + kind}); p.prizeLog = p.prizeLog.slice(0, 80); }
    const newItems = []; for (let k = itemsBefore; k < X.itemsOwned(p); k++) newItems.push(k);
    const unlocked = X.skinId() !== 'classic' && itemsBefore < X.TRAIL_STOPS && X.itemsOwned(p) >= X.TRAIL_STOPS;
    const entry = {t: P.start, mode: 'spell-' + kind, tables: [], n, c, pct, ms, xp, words: [...new Set(sc.map(a => a.w))], wrong: [...new Set(sc.filter(a => !a.ok).map(a => a.w))]};
    if (stopped) entry.ab = true;
    s.rule = (currentRule() || {}).name || '';   // for the grown-ups' Sunday spelling email
    X.S.sessions.push(entry); X.ensureLogCur(); X.S.logCur.sessions.push(entry);
    if (!X.S.demo) Promise.all([X.saveProg(), X.saveLog()]).catch(X.saveFail);
    X.S.spr = Object.assign({}, entry, {kind, prize, pb, extra, dDone, bonusMsg, newItems, unlocked, answers: P.answers});
    X.S.sp = null; X.go('sres');
    if (prize) { X.confetti(prize.id); X.sound('win'); } else if (pb && pb.x) X.confetti('gold');
  }
  // A personal best: the first time only sets the mark; beating it pays.
  function bestCheck(k, v, pts){
    const s = st(), old = s.bests[k];
    if (!old) { s.bests[k] = v; return {first: true, v}; }
    if (better[k](v, old)) { s.bests[k] = v; return {v, old, x: pts}; }
    return {v, old};
  }
  function heard(w){   // Learn the rule: each example word heard counts once
    sayWord(w);
    if (!dailyDone()) return;
    const cur = STEPS[stepAt()]; if (!cur || cur.k !== 'learn') { X.render(); return; }
    const b = bonus(); if (!b.heard.includes(w)) b.heard.push(w);
    const need = Math.min(5, X.S.sp.rule.words.length);
    if (b.heard.length >= need && !b.steps.learn) { b.steps.learn = Date.now(); const got = 50; b.xp += got; X.S.prog.xp += got; X.toast(`Rule learnt! +${got} ${X.ptsName()}.`); X.sound('win'); }
    if (!X.S.demo) X.saveProg().catch(X.saveFail);
    X.render();
  }

  /* ---------- screens ---------- */
  const big = (w, cls = '') => `<span class="sp-word ${cls}">${esc(w)}</span>`;
  // Which letters match, lined up properly (longest common run of letters), so one missing letter is one mark, not all
  // the rest. side 'got' marks the extra or wrong letters in the attempt; side 'w' marks the letters that were missed.
  const diff = (got, w, side = 'got') => { const a = got.toLowerCase(), b = w.toLowerCase(), L = Array.from({length: a.length + 1}, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const inA = new Set(), inB = new Set(); let i = 0, j = 0;
    while (i < a.length && j < b.length) { if (a[i] === b[j]) { inA.add(i); inB.add(j); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
    const src = side === 'got' ? a : w, keep = side === 'got' ? inA : inB;
    return src.split('').map((c, k) => keep.has(k) ? esc(c) : `<mark>${esc(c)}</mark>`).join(''); };
  function scrPlay(){
    const P = X.S.sp; if (!P) return scrSpell();
    if (P.kind === 'learn') return scrLearn(P);
    const it = P.items[P.i], o = info(it.w), done = P.answers.filter(a => a.counts).length;
    const frac = P.kind === 'clock' ? Math.max(0, P.ends - Date.now()) / 60000 : P.i / P.items.length;
    const label = P.kind === 'clock' ? `${P.answers.filter(a => a.ok).length} right` : `${P.items.length - P.i} to go`;
    const name = {daily: 'Daily Spelling Challenge', clock: 'Beat the Clock', test: 'Spelling test', practice: 'Practise'}[P.kind];
    const best = st().bests[P.kind === 'daily' ? 'daily' : P.kind];
    const bestTxt = !best ? '' : P.kind === 'clock' ? `Best ${best.score}` : P.kind === 'test' ? `Best ${best.pct}% in ${X.fmtClock(best.ms)}` : P.kind === 'daily' ? `Best ${X.fmtClock(best.ms)}` : '';
    const sentence = it.test ? `<p class="sp-sent">${esc(o.s).replace(new RegExp('\\b' + it.w.replace(/[-]/g, '\\-') + '\\b', 'i'), '<span class="sp-gap">?</span>')}</p>` : '';
    const showWord = it.mode === 'copy';
    const hook = (it.fixing || showWord) && SP.hooks[o.w.toLowerCase()] ? `<p class="sp-hook">Tip: ${esc(SP.hooks[o.w.toLowerCase()])}</p>` : '';
    const fb = P.fb && !P.fb.ok ? `<div class="sp-fb" role="status"><p>Nearly! You wrote <span class="sp-got">${diff(P.fb.got, P.fb.w)}</span></p><p>It is <span class="sp-got">${diff(P.fb.got, P.fb.w, 'w')}</span>${it.fixing ? '. Now copy it.' : ''}</p></div>` : P.fb && P.fb.ok ? `<p class="sp-ok" role="status">✓ Right!</p>` : '';
    const slots = P.tiles ? `<div class="sp-slots">${it.w.split('').map((_, i) => `<span>${esc(P.input[i] || '')}</span>`).join('')}</div>` : `<div class="sp-typed">${esc(P.input) || '&nbsp;'}<i class="sp-caret"></i></div>`;
    const pad = P.tiles ? `<div class="sp-tiles">${P.tiles.map((c, i) => `<button class="sp-tile" data-act="sp-tile" data-i="${i}" ${P.used.includes(i) ? 'disabled' : ''}>${esc(c)}</button>`).join('')}</div><div class="sp-row"><button class="btn ghost" data-act="sp-key" data-k="back">⌫ Undo</button></div>`
      : `<div class="sp-kb">${['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map(r => `<div>${r.split('').map(c => `<button data-act="sp-key" data-k="${c}">${c}</button>`).join('')}</div>`).join('')}<div><button data-act="sp-key" data-k="-" aria-label="Hyphen">-</button><button class="wide" data-act="sp-key" data-k="back" aria-label="Delete">⌫</button><button class="ok" data-act="sp-key" data-k="ok" aria-label="Check">✓ Check</button></div></div>`;
    return `<header class="top"><div class="brand">${X.logo()}<span>Spelling</span></div><div class="top-right"><span class="me-chip">${X.avatar(X.S.me, 34)}<span>${esc(X.S.me.name)}</span></span></div></header>
    <section class="sp-play">
      <div class="play-top"><div class="info"><span>${name}</span><span class="num rc-clock" id="sp-time">${P.kind === 'clock' ? Math.ceil(Math.max(0, P.ends - Date.now()) / 1000) + 's' : X.fmtClock(Date.now() - P.start)}</span>${bestTxt ? `<span class="muted num">${bestTxt}</span>` : ''}</div><button class="btn ghost small" data-act="sp-quit">Stop</button></div>
      <div class="pbar-wrap"><div class="pbar" role="progressbar" aria-label="How much is left"><span style="width:${(P.kind === 'clock' ? frac : frac) * 100}%"></span></div><b class="num">${label}</b></div>
      <div class="sp-card sticker">
        ${fb}
        ${showWord ? `<p class="eyebrow">${it.intro ? 'New word' : 'Copy it'}</p>${big(o.syl && it.intro ? o.syl.split('-').join('·') : o.w)}` : `<p class="eyebrow">${it.test ? 'Spell the missing word' : 'Listen and spell'}</p>`}
        ${sentence}${hook}
        <div class="sp-row"><button class="btn small" data-act="sp-say">🔊 Hear it again</button>${o.syl && o.syl.includes('-') ? `<button class="btn small ghost" data-act="sp-parts">Say it in parts</button>` : ''}</div>
        ${slots}
      </div>
      ${pad}
    </section>`;
  }
  function scrLearn(P){
    const r = P.rule, b = st().bonus[today()] || {heard: []}, heardN = (b.heard || []).length, need = Math.min(5, r.words.length);
    const inRound = dailyDone() && STEPS[stepAt()] && STEPS[stepAt()].k === 'learn';
    return `${X.topbar('spell')}<div class="parent-head"><div><p class="eyebrow">Learn the rule</p><h1 class="mega sm">${esc(r.name)}</h1><p class="lede">${esc(r.kid)}</p></div></div>
      ${inRound ? `<p class="callout">Tap ${need} words to hear them: ${Math.min(heardN, need)} of ${need}.</p>` : b.steps && b.steps.learn ? `<p class="callout mint">Rule learnt! Next: the spelling test.</p>` : ''}
      <div class="sp-learn">${r.words.map(([w]) => `<button class="sp-ex ${(b.heard || []).includes(w) ? 'on' : ''}" data-act="sp-hear" data-w="${esc(w)}">🔊 ${big(w, 'sm')}</button>`).join('')}</div>
      <div class="row" style="margin-top:16px"><button class="btn big" data-act="go" data-to="spell">Back to spelling</button></div>`;
  }
  function scrRes(){
    const r = X.S.spr; if (!r) return scrSpell();
    const name = {daily: 'Daily Spelling Challenge', clock: 'Beat the Clock', test: 'Spelling test', practice: 'Practise'}[r.kind];
    const head = r.ab ? 'Stopped early' : r.kind === 'clock' ? (r.pb && r.pb.x ? 'New personal best!' : "Time's up!") : r.prize ? `You won a ${esc(r.prize.name)}!` : 'Well done!';
    const big1 = r.kind === 'clock' ? `${r.c}` : `${r.c}/${r.n}`, sub = r.kind === 'clock' ? 'words right in 60 seconds' : `right in ${X.fmtClock(r.ms)}`;
    const pbLine = !r.pb ? '' : r.pb.first ? `<p class="muted">That sets your mark. Beat it next time for bonus ${X.ptsName()}!</p>`
      : r.pb.x ? `<p class="callout mint">New personal best! It was ${r.kind === 'clock' ? r.pb.old.score : r.kind === 'test' ? `${r.pb.old.pct}% in ${X.fmtClock(r.pb.old.ms)}` : X.fmtClock(r.pb.old.ms)}.</p>`
      : `<p class="muted">Your best is ${r.kind === 'clock' ? r.pb.old.score : r.kind === 'test' ? `${r.pb.old.pct}% in ${X.fmtClock(r.pb.old.ms)}` : X.fmtClock(r.pb.old.ms)}.</p>`;
    const wrong = (r.wrong || []).length ? `<p class="muted">To practise: ${r.wrong.map(w => big(w, 'sm')).join(', ')}. They will come back.</p>` : '';
    const next = r.dDone ? `<p class="callout">Daily Spelling Challenge done! Now the Bonus Round for double ${X.ptsName()}. <button class="btn small" data-act="sp-step">${STEPS[stepAt()] ? esc(STEPS[stepAt()].name) : ''}</button></p>` : r.bonusMsg && STEPS[stepAt()] ? `<p class="callout">${esc(r.bonusMsg)} <button class="btn small" data-act="sp-step">${esc(STEPS[stepAt()].name)}</button></p>` : r.bonusMsg ? `<p class="callout mint">${esc(r.bonusMsg)}</p>` : '';
    return `${X.topbar('spell')}<section class="results"><div class="res-body">
      <p class="eyebrow">${name}</p><h1 class="mega sm">${head}</h1>
      ${r.prize ? `<div class="res-medal pop">${X.medal(r.prize.id, 110)}</div>` : ''}
      <div><span class="score num">${big1}</span> <span class="muted" style="font-weight:800">${sub}</span></div>
      ${pbLine}
      <p class="callout mint">+${r.xp} ${X.ptsName()}${r.extra.length ? ` (including ${r.extra.join(' and ')})` : ''}</p>
      ${next}${wrong}${X.resultItems(r)}
      <div class="row" style="margin-top:14px"><button class="btn big" data-act="sp-again">Again</button><button class="btn ghost" data-act="go" data-to="spell">Spelling home</button></div>
    </div></section>`;
  }
  function todayCardSpell(){
    const d = st().daily[today()], dd = dailyDone(), i = stepAt(), b = st().bonus[today()] || {steps: {}, heard: []}, pts = X.ptsName();
    const row = (n, name, sub, state, btn) => `<li class="${state}"><span class="n" aria-hidden="true">${state === 'done' ? '✓' : n}</span><div><b>${esc(name)}</b><small>${esc(sub)}</small></div>${btn}</li>`;
    const btn = (k, label) => `<button class="btn" data-act="sp-start" data-k="${k}">${label}</button>`;
    const head = !dd ? {t: "Today's spelling", x: `The Daily Spelling Challenge first. Then the Bonus Round, in order, for double ${pts}.`}
      : i < STEPS.length ? {t: "Today's spelling done!", x: `Want more ${pts}? Do the Bonus Round in order for double.`} : {t: 'Bonus Round complete!', x: `All done! +${b.bonusXp || b.xp} extra ${pts} today.`};
    const rows = [row(1, 'Daily Spelling Challenge', dd ? `Done today: ${d.pct}%.` : d ? `Best today ${d.pct}%. Get 80% to finish.` : `${Math.max(newToday().length, Math.min(known().length + newToday().length, younger() ? 10 : 15))} words, ${newToday().length} of them new. 80% = +50 ${pts}.`, dd ? 'done' : 'now', dd ? '' : btn('daily', d ? 'Try again' : 'Start'))];
    STEPS.forEach((s, k) => { const isDone = dd && i > k, isNow = dd && i === k;
      const sub = s.k === 'learn' ? (isDone ? 'Done.' : `${currentRule().name}. ${isNow && (b.heard || []).length ? `${b.heard.length} heard so far.` : s.sub}`) : isDone ? 'Done.' : s.sub;
      rows.push(row(k + 2, s.name, sub, isDone ? 'done' : isNow ? 'now' : 'locked', isNow ? btn(s.k, 'Start') : '')); });
    return `<div class="today sticker"><div><p class="eyebrow">Spelling · ${new Date().toLocaleDateString('en-GB', {weekday: 'long'})}</p><h2>${head.t}</h2><p>${head.x}</p></div>
      <ol class="todo">${rows[0]}<li class="sep" aria-hidden="true"><span>Bonus Round · double ${pts}</span></li>${rows.slice(1).join('')}</ol></div>`;
  }
  function scrSpell(){
    const m = mastered(), l = learning(), wobbly = l.filter(([, r]) => (r.wrong || 0) > 0 && r.b <= 2), dueN = l.filter(([, r]) => r.b >= 1 && r.due <= today()).length, bs = st().bests;
    const tile = (k, glyph, title, sub, col) => `<button class="mode" style="--c:var(--${col})" data-act="sp-start" data-k="${k}"><span class="glyph">${glyph}</span><b>${title}</b><span>${sub}</span></button>`;
    const list = (arr, empty) => arr.length ? `<div class="sp-chips">${arr.slice(0, 60).map(([k]) => `<button class="sp-chip" data-act="sp-hear1" data-w="${esc(info(k).w)}">${esc(info(k).w)}</button>`).join('')}</div>` : `<p class="muted small">${empty}</p>`;
    const r = currentRule();
    return `${X.topbar('spell')}
    <section class="hero-home"><div class="hello"><p class="eyebrow">Spelling · ${track() === 'y34' ? 'Years 3 and 4' : 'Years 5 and 6'}</p><h1 class="mega">Spelling</h1>
      <p class="muted small">Personal bests: Beat the Clock ${bs.clock ? bs.clock.score : '-'} · Daily Challenge ${bs.daily ? X.fmtClock(bs.daily.ms) : '-'} · Test ${bs.test ? bs.test.pct + '%' : '-'}</p></div>
      <div class="stats"><div class="stat"><b>${m.length}</b><span>words mastered</span></div><div class="stat"><b>${l.length}</b><span>learning</span></div><div class="stat"><b>${dueN}</b><span>due back today</span></div></div></section>
    <div class="grid-home"><div class="col">
      ${X.gameBanner ? X.gameBanner(X.S.prog) : ''}${todayCardSpell()}
      <div class="extra-h"><h2>Extra practice</h2><p>Not part of today's plan. Play any time for more ${X.ptsName()}.</p></div>
      <div class="modes">${tile('practice', 'abc', 'Practise', 'Your trickiest words.', 'mint')}${tile('test', '20', 'Spelling test', 'Win trophies at 70%.', 'sun')}${tile('clock', '60s', 'Beat the Clock', 'Beat your best.', 'tomato')}${tile('learn', 'Aa', 'The rule', esc(r ? r.name : ''), 'sky')}</div>
    </div><div class="col">
      ${X.journey ? X.journey(X.S.prog) : ''}
      <div class="sticker"><div class="card-h"><h3>Words to practise</h3></div>${list(wobbly, 'None yet. Words you find tricky show here.')}</div>
      <div class="sticker"><div class="card-h"><h3>Words mastered</h3></div>${list(m, 'Spell a word right on 5 different days and it is mastered.')}</div>
      <div class="sticker"><div class="card-h"><h3>Learning now</h3></div>${list(l.filter(x => !wobbly.includes(x)), 'Start the Daily Spelling Challenge to meet your first words.')}</div>
    </div></div>`;
  }
  // A short line on the times-tables home screen pointing at today's spelling.
  function homeLine(){
    const dd = dailyDone(), i = stepAt();
    return `<div class="callout sp-home"><div><b>Spelling:</b> ${dd ? (i < STEPS.length ? `Daily Challenge done. Bonus Round next.` : 'all done today!') : `the Daily Spelling Challenge is waiting.`}</div><button class="btn small" data-act="go" data-to="spell">${dd && i >= STEPS.length ? 'Open' : 'Go'}</button></div>`;
  }
  const actions = {
    'sp-start': el => { const k = el.dataset.k; if (k === 'practice') { const w = learning().sort((a, b) => (b[1].wrong || 0) - (a[1].wrong || 0) || a[1].b - b[1].b).slice(0, 10).map(([k]) => info(k).w); start('practice', {words: w.length ? w : undefined}); } else start(k); },
    'sp-step': () => { const s = STEPS[stepAt()]; if (s) start(s.k); },
    'sp-again': () => { const r = X.S.spr; start(r ? r.kind : 'daily'); },
    'sp-key': el => key(el.dataset.k),
    'sp-tile': el => tile(+el.dataset.i),
    'sp-say': () => { const P = X.S.sp; if (P && P.items) { const it = P.items[P.i]; it.test ? sayWord(it.w) : sayWord(it.w); } },
    'sp-parts': () => { const P = X.S.sp; if (P && P.items) sayParts(P.items[P.i].w); },
    'sp-quit': () => quit(),
    'sp-hear': el => heard(el.dataset.w),
    'sp-hear1': el => sayWord(el.dataset.w),
  };
  const keydown = e => {
    if (X.S.screen !== 'splay' || !X.S.sp || !X.S.sp.items || e.metaKey || e.ctrlKey || e.altKey) return false;
    if (/^[a-zA-Z-]$/.test(e.key)) { const P = X.S.sp; if (P.tiles) { const i = P.tiles.findIndex((c, j) => c === e.key.toLowerCase() && !P.used.includes(j)); if (i >= 0) tile(i); } else key(e.key.toLowerCase()); return true; }
    if (e.key === 'Backspace') { key('back'); return true; }
    if (e.key === 'Enter') { key('ok'); return true; }
    return false;
  };
  /* ---------- Spell Strike: the reward game asks for words from the same list (Sam, 27 Oct 2026) ---------- */
  // A word he has met, trickiest first, built from its own letter tiles (two extra letters once it is settling; the extras
  // are never b, d, p or q). Words spelled right in the game count towards its guns; they never move a word on the schedule.
  const recentGame = [];
  function gameWord(){
    let pool = learning().sort((a, b) => (b[1].wrong || 0) - (a[1].wrong || 0) || a[1].b - b[1].b).map(([k]) => info(k).w);
    if (pool.length < 6) pool = pool.concat(shuffle(mastered().map(([k]) => info(k).w)));
    // early on there are only a few: his next new words join, seen first (the same ones the Daily Challenge brings)
    if (pool.length < 6) for (const w of [...newToday(), ...(currentRule() || {words: []}).words.map(([x]) => x)]) { if (pool.length >= 8) break; if (!pool.some(q => q.toLowerCase() === w.toLowerCase())) pool.push(w); }
    if (!pool.length) return null;
    const fresh = pool.filter(w => !recentGame.includes(w.toLowerCase())), from = (fresh.length ? fresh : pool).slice(0, 8), w = from[Math.floor(Math.random() * from.length)];
    recentGame.push(w.toLowerCase()); while (recentGame.length > Math.min(6, pool.length - 1)) recentGame.shift();
    const o = info(w), r = rec(w), letters = o.w.toLowerCase().split('');
    const extra = r && r.b >= 2 ? shuffle('aeiourstlnmch'.split('').filter(c => !letters.includes(c))).slice(0, 2) : [];
    return {w: o.w, s: o.s || '', syl: o.syl || '', hook: SP.hooks[o.w.toLowerCase()] || '', mode: !r || r.b === 0 ? 'copy' : 'tiles', tiles: shuffle([...letters, ...extra])};
  }
  function gameResult(w, ok){ const s = st(), g = s.game = s.game || {right: 0, tries: 0}; g.tries++; if (ok) g.right++; if (!X.S.demo) X.saveProg().catch(X.saveFail); }
  const gameTotal = () => Object.values(st().words).reduce((t, r) => t + (r.c || 0), 0) + ((st().game || {}).right || 0);
  const gameWeek = () => { const since = X.weekStart(); return (X.S.sessions || []).filter(e => e.t >= since && /^spell-/.test(e.mode || '')).reduce((t, e) => t + (e.c || 0), 0); };
  return {screens: {spell: scrSpell, splay: scrPlay, sres: scrRes}, actions, keydown, homeLine, stop: () => { const P = X.S.sp; if (P) clearInterval(P.timer); },
    game: {word: gameWord, say: sayWord, parts: sayParts, result: gameResult, total: gameTotal, week: gameWeek}};
};
})();
