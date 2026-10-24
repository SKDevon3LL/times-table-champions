(() => {
'use strict';
const app = document.getElementById('app');

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad2 = n => String(n).padStart(2, '0');
const dayStr = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };
const monthStr = (t = Date.now()) => dayStr(t).slice(0, 7);
const fmtDate = t => new Date(t).toLocaleDateString('en-GB', {day:'numeric', month:'short'});
const fmtDateTime = t => new Date(t).toLocaleString('en-GB', {weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
const fmtDur = ms => { const s = Math.round(ms/1000); return s < 60 ? s + 's' : Math.floor(s/60) + 'm ' + pad2(s%60) + 's'; };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ls = {
  get(k){ try { return JSON.parse(localStorage.getItem('ttc.' + k)); } catch { return null; } },
  set(k, v){ try { localStorage.setItem('ttc.' + k, JSON.stringify(v)); } catch {} }
};
const ss = {
  get(k){ try { return sessionStorage.getItem('ttc.' + k); } catch { return null; } },
  set(k, v){ try { sessionStorage.setItem('ttc.' + k, v); } catch {} },
  del(k){ try { sessionStorage.removeItem('ttc.' + k); } catch {} }
};
const clone = o => JSON.parse(JSON.stringify(o));
const uniq = a => [...new Set(a)];

async function hashPin(id, pin){
  const txt = `ttc:${id}:${pin}`;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 5381; for (const c of txt) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
    return 'd' + (h >>> 0).toString(16);
  }
}

/* ---------- storage: on this iPad first, copied online when there is internet ---------- */
const mem = {};
const LS = 'ttc:';
function readLocal(path){
  try { const v = localStorage.getItem(LS + path); if (v) return JSON.parse(v); } catch {}
  return mem[path] ? clone(mem[path]) : null;
}
function writeLocal(path, data){
  mem[path] = data;
  try { localStorage.setItem(LS + path, JSON.stringify(data)); }
  catch { toast("This iPad is nearly full. Free up some space so progress can be saved."); }
}
function markDirty(path){ const d = ls.get('dirty') || {}; d[path] = Date.now() + Math.random(); ls.set('dirty', d); }
const Store = {
  async get(path){ return readLocal(path); },
  async set(path, data){ const d = clone(data); d._t = Date.now(); writeLocal(path, d); markDirty(path); Sync.soon(); },
  async list(coll, field, val){
    const out = {}, pre = LS + coll + '/';
    for (const k in mem) if (k.startsWith(coll + '/')) out[k.slice(coll.length + 1)] = mem[k];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(pre)) out[k.slice(pre.length)] = JSON.parse(localStorage.getItem(k));
      }
    } catch {}
    return Object.entries(out).filter(([id, d]) => !id.includes('/') && (!field || d[field] === val)).map(([id, d]) => Object.assign(clone(d), {id}));
  }
};
const strip = o => { const c = clone(o); delete c.id; return c; };
function saveFail(){ toast("Couldn't save on this iPad. Free up some space and try again."); }

/* Two copies of one document (this iPad's and the online one) become one, the same whichever way round. */
const stable = v => Array.isArray(v) ? '[' + v.map(stable).join(',') + ']' : (v && typeof v === 'object') ? '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}' : JSON.stringify(v);
function mergeDoc(path, a, b){
  const coll = path.split('/')[0];
  if (coll === 'logs') {
    const seen = new Set();
    const sessions = [...(a.sessions || []), ...(b.sessions || [])].filter(s => { const k = s.t + '|' + s.mode; if (seen.has(k)) return false; seen.add(k); return true; }).sort((x, y) => x.t - y.t);
    return Object.assign({}, b, a, {logins: uniq([...(a.logins || []), ...(b.logins || [])]).sort((x, y) => x - y), sessions, _t: Math.max(a._t || 0, b._t || 0)});
  }
  if (coll === 'progress') {
    const r = Object.assign({}, b, a), mx = k => Math.max(a[k] || 0, b[k] || 0);
    ['xp', 'logins', 'lastLogin', '_t', 'trailReset'].forEach(k => { r[k] = mx(k); });
    if ((a.gameTrail || 0) !== (b.gameTrail || 0)) { const w = (a.gameTrail || 0) > (b.gameTrail || 0) ? a : b; r.gameTrail = w.gameTrail; r.gameMs = w.gameMs || 0; }
    else r.gameMs = Math.max(a.gameMs || 0, b.gameMs || 0);
    r.facts = {};
    for (const k of uniq([...Object.keys(a.facts || {}), ...Object.keys(b.facts || {})])) {
      const x = (a.facts || {})[k], y = (b.facts || {})[k];
      r.facts[k] = !x ? y : !y ? x : (x.n > y.n || (x.n === y.n && (x.t || 0) >= (y.t || 0))) ? x : y;
    }
    r.prizes = {}; for (const t of ['bronze', 'silver', 'gold', 'diamond']) r.prizes[t] = Math.max((a.prizes || {})[t] || 0, (b.prizes || {})[t] || 0);
    const ta = a.totals || {q:0, c:0}, tb = b.totals || {q:0, c:0}; r.totals = ta.q >= tb.q ? ta : tb;
    r.bests = Object.assign({}, b.bests); for (const [k, v] of Object.entries(a.bests || {})) if (!r.bests[k] || v.score > r.bests[k].score) r.bests[k] = v;
    r.days = uniq([...(a.days || []), ...(b.days || [])]).sort().slice(-400);
    r.daily = Object.assign({}, b.daily); for (const [k, v] of Object.entries(a.daily || {})) if (!r.daily[k] || v.pct > r.daily[k].pct) r.daily[k] = v;
    // The Bonus Round: the copy that got further through the day's steps wins; same steps, the one with more facts looked at.
    const stepsOf = v => Object.keys(Object.assign({}, v.clock && {clock: 1}, v.explore && {explore: 1}, v.test && {test: 1}, v.steps)).length;
    r.bonus = Object.assign({}, b.bonus); for (const [k, v] of Object.entries(a.bonus || {})) { const o = r.bonus[k]; if (!o || stepsOf(v) > stepsOf(o) || (stepsOf(v) === stepsOf(o) && (v.ex || []).length >= (o.ex || []).length)) r.bonus[k] = v; }
    r.badges = Object.assign({}, b.badges); for (const [k, v] of Object.entries(a.badges || {})) if (!r.badges[k] || v < r.badges[k]) r.badges[k] = v;
    const seen = new Set();
    r.prizeLog = [...(a.prizeLog || []), ...(b.prizeLog || [])].filter(x => { const k = x.t + x.tier; if (seen.has(k)) return false; seen.add(k); return true; }).sort((x, y) => y.t - x.t).slice(0, 80);
    return r;
  }
  return (a._t || 0) >= (b._t || 0) ? a : b;
}

const SB_URL = 'https://wcfpnpgpcxuptxpklksu.supabase.co', SB_KEY = 'sb_publishable_M9vyllZLl2gGGJ_bXBSMzA_VssuM4DP';
let sbc = null;
function sbClient(){
  if (!sbc && window.supabase) sbc = window.supabase.createClient(SB_URL, SB_KEY, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, flowType:'pkce', storageKey:'ttc-auth'}});
  return sbc;
}
const Device = {
  get(){ return ls.get('device'); },
  set(d){ ls.set('device', d); },
  clear(){ try { localStorage.removeItem('ttc.device'); } catch {} }
};
const isParentDevice = () => (Device.get() || {}).role === 'parent';
const withTimeout = (p, ms) => Promise.race([p, sleep(ms).then(() => { throw new Error('timed out'); })]);
const Sync = {
  busy:false, timer:null, status:'idle', err:null, lastOk: ls.get('lastSyncOk') || 0,
  soon(ms = 2000){ clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), ms); },
  async run(){
    if (this.busy || !Device.get()) return;
    if (!navigator.onLine) { this.status = 'offline'; updateSyncChip(); return; }
    const c = sbClient(); if (!c) return;
    this.busy = true; this.status = 'syncing'; updateSyncChip();
    let changed = false;
    try {
      const {data:{session}} = await withTimeout(c.auth.getSession(), 10000);
      if (!session) { this.status = 'signed-out'; return; }
      const snap = ls.get('dirty') || {}, paths = Object.keys(snap);
      if (paths.length) {
        const {data:remote, error} = await c.from('docs').select('path,data').in('path', paths);
        if (error) throw error;
        const rmap = Object.fromEntries(remote.map(r => [r.path, r.data]));
        const rows = [];
        for (const p of paths) {
          const local = readLocal(p); if (!local) continue;
          const merged = rmap[p] ? mergeDoc(p, local, rmap[p]) : local;
          if (stable(merged) !== stable(local)) { writeLocal(p, merged); changed = true; }
          rows.push({path:p, data:merged});
        }
        if (rows.length) { const {error:e2} = await c.from('docs').upsert(rows); if (e2) throw e2; }
        const cur = ls.get('dirty') || {}; for (const p of paths) if (cur[p] === snap[p]) delete cur[p]; ls.set('dirty', cur);
      }
      for (let page = 0; page < 20; page++) {
        const since = ls.get('pullSince') || '1970-01-01T00:00:00Z';
        const {data:rows, error:e3} = await c.from('docs').select('path,data,updated_at').gte('updated_at', since).order('updated_at').limit(500);
        if (e3) throw e3;
        for (const r of rows) {
          const local = readLocal(r.path), d = local ? mergeDoc(r.path, local, r.data) : r.data;
          if (!local || stable(d) !== stable(local)) { writeLocal(r.path, d); changed = true; }
          if (stable(d) !== stable(r.data)) markDirty(r.path);
        }
        if (!rows.length || rows[rows.length - 1].updated_at === since) break;
        ls.set('pullSince', rows[rows.length - 1].updated_at);
        if (rows.length < 500) break;
      }
      this.lastOk = Date.now(); ls.set('lastSyncOk', this.lastOk); this.status = 'ok'; this.err = null;
    } catch (e) {
      this.status = 'error'; this.err = (e && e.message) || String(e);
    } finally {
      this.busy = false; updateSyncChip();
      if (changed) onRemoteChange();
      if (Object.keys(ls.get('dirty') || {}).length && this.status === 'ok') this.soon(5000);
    }
  }
};
function ago(t){
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return 'on ' + fmtDate(t);
}
function syncText(){
  if (S.demo) return 'Demo: nothing is saved';
  if (!navigator.onLine) return 'Offline · saved on this iPad';
  if (Sync.status === 'syncing') return 'Saving online…';
  if (Sync.status === 'signed-out') return 'Saved here · sign in again to sync';
  if (Sync.status === 'error') return 'Saved here · not synced yet';
  if (Sync.lastOk) return 'Synced ' + ago(Sync.lastOk);
  return 'Saved on this iPad';
}
function updateSyncChip(){ const el = document.getElementById('sync-chip'); if (el) el.textContent = syncText(); }
async function onRemoteChange(){
  if (S.demo) return;   // a grown-up is mid-demo on a copy of the data; the parent area reloads when it ends
  await loadPlayers();
  if (S.me) {
    const fresh = S.players.find(p => p.id === S.me.id);
    if (fresh) { S.me = fresh; applySkin(fresh); }
    if (!S.play) {
      const d = await loadPlayerData(S.me.id);
      S.prog = d.prog; S.sessions = d.sessions; S.logins = d.logins;
      const cur = d.logs.find(l => l.id === `${S.me.id}-${monthStr()}`);
      if (cur) S.logCur = strip(cur);
      ensureLogCur();
    }
  }
  if (S.parentOK) { for (const pl of S.players) { try { S.pdata[pl.id] = await loadPlayerData(pl.id); } catch {} } }
  if (S.screen === 'login') preselect();
  const typing = document.activeElement && document.activeElement.matches && document.activeElement.matches('input,textarea,select');
  if (!S.play && !typing && ['login', 'home', 'progress', 'parent', 'explore'].includes(S.screen)) render();
}
function preselect(){
  const d = Device.get();
  if (!S.v.loginFor && d && d.role === 'child') { const p = S.players.find(x => (x.email || '').toLowerCase() === d.email); if (p) S.v.loginFor = p.id; }
}

/* ---------- maths model ---------- */
const ALL = [1,2,3,4,5,6,7,8,9,10,11,12];
const TEACH_ORDER = [2,10,5,1,11,3,4,8,9,6,7,12];
const fkey = (a, b) => a < b ? `${a}x${b}` : `${b}x${a}`;
const ALLKEYS = (() => { const s = []; for (let a = 1; a <= 12; a++) for (let b = a; b <= 12; b++) s.push(fkey(a, b)); return s; })();
const fmtKey = k => k.split('x').join(' × ');
const LEVEL_NAMES = ['Not tried yet', 'Learning', 'Getting there', 'Strong', 'Mastered'];
function level(f){
  if (!f || !f.n) return 0;
  const acc = f.c / f.n;
  if (f.s >= 5 && f.ms && f.ms <= 3000 && acc >= .85) return 4;
  if (f.s >= 3 && f.ms && f.ms <= 5000) return 3;
  if (acc >= .6) return 2;
  return 1;
}
function tableMastery(p, t){ let s = 0; for (let k = 1; k <= 12; k++) s += level(p.facts[fkey(t, k)]); return s / 48; }
function strongCount(p, t){ let s = 0; for (let k = 1; k <= 12; k++) if (level(p.facts[fkey(t, k)]) >= 3) s++; return s; }
function overallMastery(p){ let s = 0; for (const k of ALLKEYS) s += level(p.facts[k]); return s / (ALLKEYS.length * 4); }
function tableStats(p, t){ let n = 0, c = 0; for (let k = 1; k <= 12; k++) { const f = p.facts[fkey(t, k)]; if (f) { n += f.n; c += f.c; } } return {n, c, acc: n ? c / n : null}; }
function updateFact(key, ok, ms){
  const f = S.prog.facts[key] || (S.prog.facts[key] = {n:0, c:0, s:0, ms:0, t:0});
  f.n++; f.t = Date.now();
  if (ok) { f.c++; f.s++; const m = Math.min(ms, 15000); f.ms = f.ms ? Math.round(f.ms * .6 + m * .4) : m; }
  else f.s = 0;
}

const SKINS = {
  classic: {brand:'Times Table Champions', daily:'Daily Challenge', confetti:'rect',
    levels:['Number Cadet','Times Explorer','Fact Finder','Speed Spotter','Pattern Pro','Number Ninja','Maths Marvel','Table Titan','Grand Master','Times Table Expert'],
    praise:['Yes!','Brilliant!','Spot on!','Nailed it!','Super!','Correct!','Fantastic!'], streak: n => `${n} in a row!`, prizes:{}},
  eras: {brand:'Times Table Eras', label:'Eras (Taylor Swift fan theme)', daily:'Tonight\u2019s Setlist', confetti:'star', points:'Poundelas',
    levels:['Opening Act','Rising Star','Sparkle Squad','In the Spotlight','Chart Topper','Headliner','Sold-Out Show','Stadium Star','Encore Legend','Times Table Icon'],
    praise:['Fearless!','Sparkling!','Iconic!','Legendary!','Encore!','Showstopper!','Gold star!'], streak: n => `${n} in a row. That\u2019s a whole new era!`,
    prizes:{bronze:'Bronze Star', silver:'Silver Sparkle', gold:'Gold Record', diamond:'Diamond Tiara'}},
  trail: {brand:'Times Table Trail', label:'Trail (outdoor adventure theme)', daily:'Today\u2019s Expedition', confetti:'leaf', points:'Poundelas',
    levels:['Trail Starter','Path Finder','Hill Walker','River Crosser','Forest Ranger','Ridge Runner','Peak Bagger','Summit Seeker','Mountain Guide','Times Table Explorer'],
    praise:['Summit!','Trail blazer!','Spot on!','Onwards!','Expert tracker!','Nailed it!','Top explorer!'], streak: n => `${n} in a row. You\u2019re climbing fast!`,
    prizes:{bronze:'Bronze Badge', silver:'Silver Compass Medal', gold:'Gold Summit Cup', diamond:'Diamond Crown'}},
};
const skinId = () => (S.me && SKINS[S.me.theme]) ? S.me.theme : 'classic';
const ptsName = () => skin().points || 'XP';   // what the child's points are called on screen
const skin = () => SKINS[skinId()];
const TIERS = [
  {id:'bronze',  min:70,  base:'Bronze Medal',  xp:20},
  {id:'silver',  min:80,  base:'Silver Medal',  xp:40},
  {id:'gold',    min:90,  base:'Gold Trophy',   xp:70},
  {id:'diamond', min:100, base:'Diamond Crown', xp:120},
].map(t => Object.defineProperty(t, 'name', {get(){ return skin().prizes[this.id] || this.base; }}));
const tierFor = pct => { let t = null; for (const x of TIERS) if (pct >= x.min) t = x; return t; };
const nextTier = pct => TIERS.find(x => x.min > pct) || null;
const tierById = id => TIERS.find(x => x.id === id);

const THRESH = [0,150,400,800,1400,2200,3200,4500,6000,8000];
function lvlInfo(xp){
  let n = 1; while (n < THRESH.length && xp >= THRESH[n]) n++;
  const cur = THRESH[n-1], next = THRESH[n];
  const LV = skin().levels;
  return {n, title: LV[n-1], next, nextTitle: LV[n], frac: next ? (xp - cur) / (next - cur) : 1};
}
function streakDays(p){
  const set = new Set(p.days || []); const d = new Date();
  if (!set.has(dayStr(d))) d.setDate(d.getDate() - 1);
  let n = 0; while (set.has(dayStr(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function weekStart(t = Date.now()){ const d = new Date(t); d.setHours(0,0,0,0); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getTime(); }
// The 52-week challenge: week 1 began on Monday 19 October 2026 (Sam, 24 Oct 2026).
const CHALLENGE_START = new Date(2026, 9, 19).getTime();
const challengeWeek = (t = Date.now()) => Math.max(1, Math.min(52, Math.round((weekStart(t) - CHALLENGE_START) / (7 * 864e5)) + 1));
// School year, set by a grown-up on a slider (Year 3 to 8). It decides which question types join the Daily Challenge:
// missing numbers from Year 4, division from Year 5, then x10 and x100 facts (70 × 8, 300 × 4) from Year 6 and 7.
const YEAR_KINDS = {3:[], 4:['miss'], 5:['miss','div'], 6:['miss','div','scale'], 7:['miss','div','scale','scale100'], 8:['miss','div','scale','scale100']};
const yearOf = pl => (pl && pl.year) || Math.min(8, Math.max(3, ((pl && pl.age) || 9) - 4));
// The weekly plan for each child, written every Sunday by the weekly report (plans/<id>): which tables to focus on, how
// hard the Daily Challenge mixes, the week's targets and a line for the child. It only counts in the week it was written for.
const planFor = pl => { const x = pl && S.plans[pl.id]; return x && x.week === challengeWeek() ? x : null; };
const prizeTotal = p => TIERS.reduce((s, t) => s + (p.prizes[t.id] || 0), 0);
const MODE_NAMES = {practice:'Practice', test:'Test', clock:'Beat the Clock', daily:'Daily Challenge'};
const tablesLabel = (s) => s.mode === 'daily' || s.pool ? 'Trickiest facts' : (s.tables.length === 12 ? 'All tables' : s.tables.map(t => '×' + t).join(' '));

function hint(a, b){
  const p = a * b;
  if (a === b && a > 2) return `${a} × ${a} is a square number. Picture a square of dots ${a} wide and ${a} tall: ${p} dots.`;
  let m, n;
  for (const x of [1,10,2,5,11,4,9,3,6,8,12,7]) if (a === x || b === x) { m = x; n = a === x ? b : a; break; }
  switch (m) {
    case 1:  return `Anything times 1 stays the same: ${n} × 1 = ${n}.`;
    case 10: return `Times 10: every digit moves one place left, so ${n} becomes ${n*10}.`;
    case 2:  return `Times 2 means double it: ${n} + ${n} = ${p}.`;
    case 5:  return `Times 5 is half of times 10. ${n} × 10 = ${n*10}, and half of that is ${p}.`;
    case 11: return n <= 9 ? `Times 11 for 1 to 9: write the digit twice. ${n} becomes ${p}.` : `Do ${n} × 10 = ${n*10}, then add one more ${n}: ${p}.`;
    case 4:  return `Double, then double again: ${n} → ${n*2} → ${p}.`;
    case 9:  return `Times 9: do times 10, then take one ${n} away. ${n*10} − ${n} = ${p}.`;
    case 3:  return `Double ${n} to get ${n*2}, then add one more ${n}: ${p}.`;
    case 6:  return `Do times 5, then add one more ${n}: ${n*5} + ${n} = ${p}.`;
    case 8:  return `Double, double, double: ${n} → ${n*2} → ${n*4} → ${p}.`;
    case 12: return `Do times 10, then add times 2: ${n*10} + ${n*2} = ${p}.`;
    case 7:  return `Split the 7 into 5 and 2: ${n*5} + ${n*2} = ${p}.`;
  }
  return `${a} × ${b} = ${p}.`;
}

/* ---------- new ways to learn: suggested to the grown-ups, shown to the children once approved ---------- */
// One document per method, methods/<id> {status:'approved'|'rejected', by, at}, so two grown-ups deciding at once never clash.
const METHODS = [
  {id:'factor-pairs', name:'Factor pairs', why:'Find every pair that makes a number. Links times and divide.',
    kid:'Find all the pairs that make a number.', ex:['24 = 1 × 24 = 2 × 12 = 3 × 8 = 4 × 6', '36 = 1 × 36 = 2 × 18 = 3 × 12 = 4 × 9 = 6 × 6', '48 = 4 × 12 = 6 × 8']},
  {id:'turnarounds', name:'Turnaround facts', why:'Facts work both ways, so 144 facts are really 78.',
    kid:'Learn one fact, get its twin free.', ex:['7 × 8 = 56, so 8 × 7 = 56', '3 × 12 = 36, so 12 × 3 = 36', '9 × 6 = 54, so 6 × 9 = 54']},
  {id:'doubling', name:'Doubling and halving', why:'The 4s and 8s are the 2s doubled.',
    kid:'×2 is double. ×4 is double twice. ×8 is double three times.', ex:['6 × 4: 6 → 12 → 24', '7 × 8: 7 → 14 → 28 → 56', '5 × 16 is the same as 10 × 8 = 80 (halve one, double the other)']},
  {id:'split-it', name:'Split it up', why:'Split a hard fact into two easy ones.',
    kid:'Stuck? Split it into two you know, then add.', ex:['7 × 8 = 7 × 5 + 7 × 3 = 35 + 21 = 56', '12 × 7 = 10 × 7 + 2 × 7 = 70 + 14 = 84', '6 × 9 = 6 × 10 − 6 = 54']},
  {id:'anchor-facts', name:'Build from a fact you know', why:'Step up or down from the 2s, 5s and 10s.',
    kid:'Start from an easy fact and add or take one group.', ex:['6 × 7: 5 × 7 = 35, add one more 7 = 42', '9 × 8: 10 × 8 = 80, take away 8 = 72', '11 × 6: 10 × 6 = 60, add 6 = 66']},
  {id:'squares', name:'Square numbers as stepping stones', why:'Learn the squares; their neighbours are one step away.',
    kid:'Learn the squares, then hop one step.', ex:['7 × 7 = 49, so 7 × 8 = 49 + 7 = 56', '6 × 6 = 36, so 6 × 7 = 36 + 6 = 42', '8 × 8 = 64, so 8 × 9 = 64 + 8 = 72']},
  {id:'fact-families', name:'Fact families', why:'Every times fact gives two divide facts.',
    kid:'Three numbers, four facts.', ex:['6 × 7 = 42, 7 × 6 = 42, 42 ÷ 6 = 7, 42 ÷ 7 = 6', '8 × 3 = 24, 3 × 8 = 24, 24 ÷ 8 = 3, 24 ÷ 3 = 8']},
  {id:'nines-fingers', name:'The nines finger trick', why:'A finger trick for the 9s.',
    kid:'10 fingers up. For 9 × 4 fold down finger 4: 3 and 6 = 36.', ex:['9 × 4: 3 fingers, then 6 fingers = 36', '9 × 7: 6 fingers, then 3 fingers = 63', 'The digits always add up to 9: 3 + 6, 6 + 3']},
  {id:'patterns', name:'Spot the patterns', why:'Patterns show if an answer could be right.',
    kid:'Use the table’s pattern to check your answer.', ex:['5s always end in 5 or 0: 35, 40, 45', '11s up to 9 repeat the digit: 11 × 7 = 77', 'Any number times an even number is even: 7 × 6 = 42']},
  {id:'rhymes', name:'Rhymes for the tricky ones', why:'A silly rhyme for a fact that won’t stick.',
    kid:'Say the rhyme out loud. It sticks!', ex:['5, 6, 7, 8: 56 = 7 × 8', 'I ate and I ate till I was sick on the floor: 8 × 8 = 64', '6 × 8 is 48, don’t be late!']},
  {id:'skip-counting', name:'Count in steps', why:'Count and clap in steps. Great in the car.',
    kid:'Count in steps and clap. Then faster!', ex:['3, 6, 9, 12, 15, 18, 21, 24 …', '7, 14, 21, 28, 35, 42, 49, 56 …', 'Backwards: 48, 42, 36, 30 …']},
  {id:'card-game', name:'Times-table snap', why:'Race to say the answer to two cards.',
    kid:'Turn two cards. First to shout the answer wins.', ex:['Turn over 6 and 7: shout 42!', 'Picture cards count as 10, aces as 1', 'Keep the cards you win. Most cards wins.']}
];
const methodState = id => (S.methods[id] || {}).status || 'new';
// The suggested methods, then the ones the grown-ups wrote themselves (methods/<id> with custom: true), oldest first.
const allMethods = () => [...METHODS, ...Object.values(S.methods || {}).filter(m => m.custom && m.name).sort((a, b) => (a.made || 0) - (b.made || 0))];
function methodsParent(){
  const order = {new:0, approved:1, rejected:2};
  const list = allMethods().sort((a, b) => order[methodState(a.id)] - order[methodState(b.id)]);
  const kids = S.players.map(p => p.name).join(' and ') || 'the children';
  return `<h2 class="sec">New ways to learn</h2>
    <p class="muted" style="margin:-6px 0 16px">Approve one and ${esc(kids)} see it in Explore.</p>
    <div class="settings">${list.map(m => {
      const st = methodState(m.id), d = S.methods[m.id] || {};
      return `<div class="sticker"><div class="card-h"><h3>${esc(m.name)}</h3>${st === 'new' ? '' : `<span class="pill ${st}">${st === 'approved' ? 'Approved' : 'Rejected'}</span>`}</div>
        ${m.custom ? `<p class="muted small">Added by ${esc(m.author || 'a grown-up')}</p><p style="font-weight:800">${esc(m.kid)}</p>` : `<p>${esc(m.why)}</p>`}
        ${(m.ex || []).length ? `<div class="mistakes" style="margin:12px 0"><span>${esc(m.ex[0])}</span></div>` : ''}
        ${st === 'new' ? '' : `<p class="muted small">${st === 'approved' ? 'Approved' : 'Rejected'}${d.by ? ' by ' + esc(d.by) : ''}${d.at ? ' ' + ago(d.at) : ''}.</p>`}
        <div class="row">${st !== 'approved' ? `<button class="btn small" data-act="method" data-id="${m.id}" data-s="approved">Approve</button>` : ''}${st !== 'rejected' ? `<button class="btn small ghost" data-act="method" data-id="${m.id}" data-s="rejected">Reject</button>` : ''}</div>
      </div>`;
    }).join('')}
      <form class="sticker form" data-form="add-method"><h3>Add your own method</h3>
        <p class="muted small">It shows in Explore for ${esc(kids)} as soon as you save it.</p>
        <label for="am-n">Name</label><input id="am-n" name="name" required maxlength="60" placeholder="The nines finger trick">
        <label for="am-k">How you would explain it to the children</label><textarea id="am-k" name="kid" required maxlength="300" rows="3" placeholder="Hold up ten fingers and fold down the one you are multiplying by..."></textarea>
        <label for="am-e">Examples, one per line (up to 5)</label><textarea id="am-e" name="ex" maxlength="400" rows="3" placeholder="9 &times; 3: fold the 3rd finger, 2 and 7 = 27"></textarea>
        <button class="btn" type="submit">Add method</button></form>
    </div>`;
}
function methodsKids(){
  const ok = allMethods().filter(m => methodState(m.id) === 'approved');
  if (!ok.length) return '';
  return `<h2 class="sec">New ways to learn</h2><div class="settings">${ok.map(m => `<div class="sticker"><h3>${esc(m.name)}</h3><p style="font-weight:800">${esc(m.kid)}</p>
    <div class="mistakes" style="margin-top:12px;flex-direction:column;align-items:flex-start">${(m.ex || []).map(x => `<span>${esc(x)}</span>`).join('')}</div></div>`).join('')}</div>`;
}

/* ---------- state ---------- */
const S = {
  screen:'loading', players:[], family:{rewards:{}}, me:null, prog:null, sessions:[], logins:[], logCur:null,
  play:null, result:null, v:{}, err:null, okMsg:null, parentOK:false, pdata:{}, methods:{}, plans:{}, gameOK:{}, demo:null, sound: ls.get('sound') ?? true
};
const defaultProg = id => ({player:id, xp:0, facts:{}, prizes:{bronze:0,silver:0,gold:0,diamond:0}, prizeLog:[], bests:{}, days:[], daily:{}, bonus:{}, badges:{}, totals:{q:0,c:0}, logins:0, lastLogin:0, created:Date.now()});
function normProg(p, id){ const d = defaultProg(id); p = Object.assign(d, p || {}); p.prizes = Object.assign(defaultProg(id).prizes, p.prizes || {}); return p; }

async function loadPlayers(){
  try {
    S.players = (await Store.list('players')).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    S.family = Object.assign({rewards:{}}, (await Store.get('settings/family')) || {});
    S.methods = Object.fromEntries((await Store.list('methods')).map(m => [m.id, m]));
    S.plans = Object.fromEntries((await Store.list('plans')).map(x => [x.id, x]));
    S.gameOK = Object.fromEntries((await Store.list('games')).map(x => [x.id, x]));
  } catch { S.players = []; toast("Couldn't load players. Reload the page to try again."); }
}
async function loadPlayerData(id){
  const prog = normProg(await Store.get('progress/' + id), id);
  const logs = await Store.list('logs', 'player', id);
  const sessions = logs.flatMap(l => l.sessions || []).sort((a, b) => a.t - b.t);
  const logins = logs.flatMap(l => l.logins || []).sort((a, b) => a - b);
  return {prog, logs, sessions, logins};
}
function ensureLogCur(){
  const m = monthStr();
  if (!S.logCur || S.logCur.month !== m) S.logCur = {player:S.me.id, month:m, logins:[], sessions:[]};
}
const saveLog = () => Store.set(`logs/${S.me.id}-${S.logCur.month}`, strip(S.logCur));
const saveProg = () => Store.set('progress/' + S.me.id, S.prog);
const savePlayer = p => Store.set('players/' + p.id, strip(p));

function applySkin(p){
  const root = document.documentElement;
  if (p && SKINS[p.theme] && p.theme !== 'classic') { root.dataset.skin = p.theme; root.style.removeProperty('--me'); }
  else { delete root.dataset.skin; if (p) root.style.setProperty('--me', `var(--${p.color || 'sky'})`); else root.style.removeProperty('--me'); }
}
async function signIn(p, record){
  S.me = p;
  applySkin(p);
  const d = await loadPlayerData(p.id);
  S.prog = d.prog; S.sessions = d.sessions; S.logins = d.logins;
  const cur = d.logs.find(l => l.id === `${p.id}-${monthStr()}`);
  S.logCur = cur ? strip(cur) : null;
  ensureLogCur();
  if (record) {
    const now = Date.now();
    S.logCur.logins.push(now); S.logins.push(now);
    S.prog.logins = (S.prog.logins || 0) + 1; S.prog.lastLogin = now;
    Promise.all([saveLog(), saveProg()]).catch(saveFail);
  }
  ss.set('me', p.id);
  S.screen = 'home'; S.v = {}; render(); scrollTo(0, 0);
}

/* ---------- pictures ---------- */
function starPath(cx, cy, r1, r2){
  let d = '';
  for (let i = 0; i < 10; i++) { const r = i % 2 ? r2 : r1, a = -Math.PI/2 + i * Math.PI/5; d += (i ? 'L' : 'M') + (cx + r*Math.cos(a)).toFixed(1) + ' ' + (cy + r*Math.sin(a)).toFixed(1); }
  return d + 'Z';
}
function medal(tier, size = 56){
  const c = `var(--${tier})`, L = 'var(--line)';
  let body;
  if (tier === 'diamond') {
    body = `<path d="M8 44 L11 16 L22 29 L32 9 L42 29 L53 16 L56 44 Z" fill="${c}" stroke="${L}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="7" y="44" width="50" height="10" rx="3" fill="${c}" stroke="${L}" stroke-width="3"/>
      <circle cx="32" cy="49" r="3.4" fill="var(--pink)" stroke="${L}" stroke-width="2"/><circle cx="18" cy="49" r="2.6" fill="var(--sky)" stroke="${L}" stroke-width="2"/><circle cx="46" cy="49" r="2.6" fill="var(--sky)" stroke="${L}" stroke-width="2"/>
      <circle cx="11" cy="14" r="3.4" fill="var(--sun)" stroke="${L}" stroke-width="2"/><circle cx="32" cy="7" r="3.4" fill="var(--sun)" stroke="${L}" stroke-width="2"/><circle cx="53" cy="14" r="3.4" fill="var(--sun)" stroke="${L}" stroke-width="2"/>
      <path d="M27 33 L32 25 L37 33 L32 40 Z" fill="var(--card)" stroke="${L}" stroke-width="2"/>`;
  } else if (tier === 'gold' && skinId() === 'eras') {
    body = `<circle cx="32" cy="32" r="27" fill="var(--ink)" stroke="${L}" stroke-width="3"/>
      <circle cx="32" cy="32" r="21" fill="none" stroke="var(--muted)" stroke-width="1.2"/><circle cx="32" cy="32" r="16.5" fill="none" stroke="var(--muted)" stroke-width="1.2"/>
      <path d="M14 20 A22 22 0 0 1 26 11" fill="none" stroke="var(--card)" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>
      <circle cx="32" cy="32" r="11" fill="${c}" stroke="${L}" stroke-width="2"/>
      <path d="${starPath(32, 32, 7, 3)}" fill="var(--card)" stroke="${L}" stroke-width="1.5" stroke-linejoin="round"/>`;
  } else if (tier === 'gold') {
    body = `<path d="M18 21 H11 a7 7 0 0 0 9 11" fill="none" stroke="${L}" stroke-width="3"/><path d="M46 21 H53 a7 7 0 0 1 -9 11" fill="none" stroke="${L}" stroke-width="3"/>
      <path d="M17 8 H47 V22 a15 15 0 0 1 -30 0 Z" fill="${c}" stroke="${L}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="28" y="37" width="8" height="9" fill="${c}" stroke="${L}" stroke-width="3"/>
      <rect x="18" y="46" width="28" height="10" rx="3" fill="${c}" stroke="${L}" stroke-width="3"/>
      <path d="${starPath(32, 21, 7.5, 3.2)}" fill="var(--card)" stroke="${L}" stroke-width="1.8" stroke-linejoin="round"/>`;
  } else {
    body = `<path d="M17 3 H28 L35 24 H24 Z" fill="var(--sky)" stroke="${L}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M47 3 H36 L29 24 H40 Z" fill="var(--tomato)" stroke="${L}" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="32" cy="40" r="19" fill="${c}" stroke="${L}" stroke-width="3"/>
      <circle cx="32" cy="40" r="13" fill="none" stroke="${L}" stroke-width="1.5" stroke-dasharray="2 3"/>
      <path d="${starPath(32, 40, 9, 4)}" fill="var(--card)" stroke="${L}" stroke-width="1.8" stroke-linejoin="round"/>`;
  }
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" role="img" aria-label="${esc(tierById(tier).name)}">${body}</svg>`;
}
const logo = () => skinId() === 'eras'
  ? `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="var(--pink)" stroke="var(--line)" stroke-width="3"/><path d="${starPath(24, 25, 13, 5.5)}" fill="var(--sun)" stroke="var(--line)" stroke-width="2.2" stroke-linejoin="round"/></svg>`
  : skinId() === 'trail'
  ? `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="var(--sky)" stroke="var(--line)" stroke-width="3"/><path d="M6 36 L18 18 L25 27 L31 19 L42 36 Z" fill="var(--mint)" stroke="var(--line)" stroke-width="2.5" stroke-linejoin="round"/><path d="M31 19 V8 L39 11 L31 14" fill="var(--me)" stroke="var(--line)" stroke-width="2" stroke-linejoin="round"/></svg>`
  : `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="var(--sun)" stroke="var(--line)" stroke-width="3"/><path d="M15 15 L33 33 M33 15 L15 33" stroke="var(--on-accent)" stroke-width="6" stroke-linecap="round"/></svg>`;
const photoOk = s => typeof s === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s);
const avatar = (p, size = 48) => `<span class="avatar" style="--c:var(--${esc(p.color || 'sky')});--s:${size}px" aria-hidden="true">${photoOk(p.photo) ? `<img src="${p.photo}" alt="">` : esc((p.name || '?')[0].toUpperCase())}</span>`;
const COLORS = [['tomato','Tomato'],['sky','Sky'],['mint','Mint'],['grape','Grape'],['sun','Sunshine'],['pink','Bubblegum']];

/* ---------- sound + confetti ---------- */
let actx;
function sound(kind){
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain(); o.connect(g); g.connect(actx.destination);
    const t = actx.currentTime, f = kind === 'ok' ? [660, 880] : kind === 'bad' ? [240, 190] : [523, 659, 784, 1047];
    o.type = kind === 'bad' ? 'triangle' : 'sine';
    f.forEach((fr, i) => o.frequency.setValueAtTime(fr, t + i * .09));
    const end = t + .09 * f.length + .18;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + .02); g.gain.exponentialRampToValueAtTime(.0001, end);
    o.start(t); o.stop(end + .02);
  } catch {}
}
function confetti(tier){
  if (reduced) return;
  const cv = document.getElementById('confetti'), ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1;
  const W = innerWidth, H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cs = getComputedStyle(document.documentElement);
  const cols = ['--sun','--tomato','--mint','--sky','--grape','--pink','--' + tier].map(v => cs.getPropertyValue(v).trim());
  const shape = skin().confetti;
  const N = {diamond:280, gold:200, silver:150, bronze:110}[tier] || 120;
  const ps = Array.from({length:N}, () => ({x: W/2 + (Math.random()-.5)*W*.3, y: H*.35, vx: (Math.random()-.5)*14, vy: -Math.random()*14 - 4, r: Math.random()*Math.PI, vr: (Math.random()-.5)*.4, w: 6 + Math.random()*7, h: 4 + Math.random()*5, c: cols[Math.floor(Math.random()*cols.length)]}));
  const t0 = performance.now();
  (function frame(now){
    const el = now - t0; ctx.clearRect(0, 0, W, H);
    for (const p of ps) { p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - el/3600); if (shape === 'star') { ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? p.w * .25 : p.w * .8, a = i * Math.PI / 4; ctx.lineTo(r * Math.cos(a), r * Math.sin(a)); } ctx.closePath(); ctx.fill(); }
      else if (shape === 'leaf') { ctx.beginPath(); ctx.ellipse(0, 0, p.w * .75, p.h * .45, 0, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore(); }
    if (el < 3600) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  })(t0);
}
let toastT;
function toast(msg){
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 3600);
}

/* ---------- coaching ---------- */
function recommendations(p, sessions){
  const out = [];
  if (!sessions.length) {
    out.push({text:'Warm up on the 2s, 5s and 10s.', mode:'practice', tables:[2,5,10], cta:'Practise 2s, 5s and 10s'});
    out.push({text:'Find the patterns in Explore.', mode:'explore', tables:[], cta:'Open Explore'});
    return out;
  }
  const scored = ALL.map(t => Object.assign({t}, tableStats(p, t))).filter(x => x.n >= 6).sort((a, b) => a.acc - b.acc);
  if (scored[0] && scored[0].acc < .9) out.push({text:`Your ${scored[0].t}s are trickiest: ${Math.round(scored[0].acc*100)}% right. Practise them.`, mode:'practice', tables:[scored[0].t], cta:`Practise the ${scored[0].t}s`});
  const tricky = ALLKEYS.map(k => ({k, f:p.facts[k]})).filter(x => x.f && x.f.n >= 2 && x.f.c / x.f.n < .8).sort((a, b) => a.f.c/a.f.n - b.f.c/b.f.n).slice(0, 3);
  if (tricky.length) out.push({text:`Watch out for ${tricky.map(x => fmtKey(x.k)).join(', ')}. Today's Daily Challenge picks facts like these.`, mode:'daily', tables:[], cta:'Daily Challenge'});
  const slow = ALLKEYS.filter(k => !k.startsWith('1x')).map(k => ({k, f:p.facts[k]})).filter(x => x.f && x.f.c > 0 && x.f.ms > 6000).sort((a, b) => b.f.ms - a.f.ms).slice(0, 2);
  if (slow.length) {
    const tabs = uniq(slow.flatMap(x => x.k.split('x').map(Number))).filter(t => t !== 1 && t !== 10).slice(0, 3);
    out.push({text:`You know ${fmtKey(slow[0].k)}, but it takes ${Math.round(slow[0].f.ms/1000)} seconds. Beat the Clock!`, mode:'clock', tables: tabs.length ? tabs : [2,5,10], cta:'Beat the Clock'});
  }
  const lastTest = [...sessions].reverse().find(s => s.mode === 'test' && !s.ab);
  if (lastTest && lastTest.pct < 70) out.push({text:`Last test ${lastTest.pct}%. Practise, then aim for 70%.`, mode:'practice', tables:lastTest.tables, cta:'Practise them'});
  else if (lastTest && lastTest.pct < 100) { const nt = nextTier(lastTest.pct); out.push({text:`Last test ${lastTest.pct}%. Get ${nt.min}% for a ${nt.name}.`, mode:'test', tables:lastTest.tables, cta:'Try that test again'}); }
  const next = TEACH_ORDER.find(t => t !== 1 && tableStats(p, t).n === 0);
  if (next) out.push({text:`Try the ${next}s next.`, mode:'practice', tables:[next], cta:`Start the ${next}s`});
  if (overallMastery(p) >= .85 && !p.prizes.diamond) out.push({text:'Nearly expert! Go for 100% on all tables.', mode:'test', tables:ALL, cta:'All-tables test'});
  return out.slice(0, 3);
}
function weeklyGoals(p, sessions, player){
  const ws = weekStart(), wk = sessions.filter(s => s.t >= ws);
  const plan = planFor(player), qGoal = (plan && plan.questions) || ((player && player.age >= 11) ? 250 : 150), dGoal = (plan && plan.days) || 5;
  const quest = TEACH_ORDER.find(t => strongCount(p, t) < 12);
  const goals = [
    {name:`Answer ${qGoal} questions`, cur: wk.reduce((s, x) => s + (x.n || 0), 0), goal:qGoal},
    {name:`Play on ${dGoal} different days`, cur: uniq(wk.map(s => dayStr(s.t))).length, goal:dGoal},
    {name:'Complete 3 Daily Challenges', cur: uniq(wk.filter(s => s.mode === 'daily' && s.pct >= 80).map(s => dayStr(s.t))).length, goal:3},
    {name:`Win a ${TIERS[2].name} (90% or more)`, cur: wk.some(s => (s.mode === 'test' || s.mode === 'daily') && s.pct >= 90 && !s.ab) ? 1 : 0, goal:1},
    {name:'Complete a Bonus Round', cur: Object.values(p.bonus || {}).some(b => b.done >= ws) ? 1 : 0, goal:1},
  ];
  if (quest) goals.push({name:`Quest: make all twelve ${quest}s facts strong`, cur: strongCount(p, quest), goal:12});
  return goals;
}
// A test wins a trophy only when it includes a table that is not strong yet (Sam, 24 Oct 2026: no collecting trophies on
// the easy 10s). Once every table is strong, any test can win one. The Daily Challenge always can: it picks their weakest facts.
const notStrong = (p, tables) => tables.filter(t => t !== 1 && strongCount(p, t) < 12);
const trophyTest = (p, tables) => notStrong(p, tables).length > 0 || notStrong(p, ALL).length === 0;
// Which tables are strong (all 12 facts strong) and which need practice, shown plainly on the home and progress pages and
// on the table chips (Sam, 24 Oct 2026). A table to practise is a button that starts a Practice round on it.
function tablesSplit(p){
  const strong = ALL.filter(t => t !== 1 && strongCount(p, t) === 12), weak = ALL.filter(t => t !== 1 && strongCount(p, t) < 12);
  return `<div class="tsplit"><div><b>Strong \u2713</b><div class="tchips">${strong.length ? strong.map(t => `<span class="tc strong">${t}s</span>`).join('') : '<span class="muted small">None yet: keep going!</span>'}</div></div>
    <div><b>Need practice</b><div class="tchips">${weak.map(t => `<button class="tc" data-act="rec" data-mode="practice" data-tables="${t}" title="Practise the ${t}s">${t}s <small>${strongCount(p, t)}/12</small></button>`).join('') || '<span class="muted small">Nothing: every table is strong!</span>'}</div></div></div>`;
}
// The table to work on next: the first in teaching order that isn't fully strong (the 1s look after themselves).
const focusTable = p => { const plan = planFor(S.me); return (plan && (plan.focus || []).find(t => ALL.includes(t) && strongCount(p, t) < 12)) || TEACH_ORDER.find(t => t !== 1 && strongCount(p, t) < 12) || null; };
// Today's order (Sam, 24 Oct 2026): the Daily Challenge is today's work. Once it is done, the Bonus Round, in order:
// Beat the Clock, Explore (look closely at five facts), today's ways to learn, then a test. Finish them all and the points
// won in the round are paid again, so it is worth double. Each step opens only when the one before it is done; anything
// played out of order still earns points, just not for the round. A Grown-ups demo runs the round too, on its copy, and
// saves nothing. The approved ways to learn take turns day by day; how many come each day is set by Taylor's weekly plan
// (plan.methods, 1 to 3), so the round grows as the children cope with it.
const STEP_CLOCK = {k:'clock', name:'Beat the Clock', sub:'As many as you can in 60 seconds.', act:'setup', mode:'clock'};
const STEP_EXPLORE = {k:'explore', name:'Explore', sub:'Tap 5 facts in the grid.', act:'go', mode:'explore'};
const STEP_TEST = {k:'test', name:'Take a test', sub:'20 questions. Then your points double!', act:'setup', mode:'test'};
const EXPLORE_FACTS = 5, METHOD_QS = 5;
function methodsToday(){
  const ok = allMethods().filter(m => methodState(m.id) === 'approved'); if (!ok.length) return [];
  const plan = planFor(S.me), n = Math.min(ok.length, Math.max(1, Math.min(3, (plan && plan.methods) || 1)));
  const day = Math.round(Date.parse(dayStr() + 'T12:00:00Z') / 864e5), start = (day * n) % ok.length;
  return Array.from({length:n}, (_, i) => ok[(start + i) % ok.length]);
}
const bonusSteps = () => [STEP_CLOCK, STEP_EXPLORE,
  ...methodsToday().map(m => ({k:'m:' + m.id, name:`Try: ${m.name}`, sub:`Learn the trick, then ${METHOD_QS} questions.`, act:'method-step', mode:m.id})), STEP_TEST];
const todayDone = p => { const d = (p.daily || {})[dayStr()]; return !!(d && d.pct >= 80); };
const bonusToday = p => (p.bonus || {})[dayStr()] || null;
// Steps done today; a round started on the version before 24 Oct evening kept them as clock/explore/test fields.
const stepsDone = r => r ? Object.assign({}, r.clock && {clock: r.clock}, r.explore && {explore: r.explore}, r.test && {test: r.test}, r.steps) : {};
function bonusRound(p){
  const b = p.bonus || (p.bonus = {}), k = dayStr();
  if (!b[k]) { b[k] = {xp:0, ex:[], steps:{}}; const keys = Object.keys(b).sort(); while (keys.length > 60) delete b[keys.shift()]; }
  if (!b[k].steps) b[k].steps = stepsDone(b[k]);
  return b[k];
}
// How far through today's round they are, in order: a step played before its turn does not count.
const bonusStep = p => { const d = stepsDone(bonusToday(p)), st = bonusSteps(), i = st.findIndex(x => !d[x.k]); return i < 0 ? st.length : i; };
const curStep = p => bonusSteps()[bonusStep(p)] || null;
// Explore counts once five different facts have been looked at, while Explore is the step they are on.
function exploreLooked(k){
  const p = S.prog, cur = p && todayDone(p) && curStep(p); if (!cur || cur.k !== 'explore') return;
  const r = bonusRound(p); if (r.ex.includes(k)) return;
  r.ex.push(k);
  if (r.ex.length >= EXPLORE_FACTS) {
    const got = EXPLORE_FACTS * 10; r.steps.explore = Date.now(); r.xp += got; p.xp += got;
    const next = curStep(p);
    toast(`Explore done! +${got} ${ptsName()}.`); sound('win');
  }
  if (!S.demo) saveProg().catch(saveFail);
}
// A way-to-learn step: a short practice round on the focus table with the method shown above every question.
function startMethodStep(id){
  const m = allMethods().find(x => x.id === id); if (!m) return;
  const t = focusTable(S.prog);
  startPlay('practice', {tables: t ? [t] : [2, 5, 10], count: METHOD_QS, miss: false, div: false, method: id});
}
function gameBanner(p){
  if (!gameOpen(p)) return '';
  return `<div class="today sticker game-ready"><div><p class="eyebrow">You completed the trail</p><h2>${skinId() === 'eras' ? 'Your stadium show is ready!' : 'The jungle gold is waiting!'}</h2>
    <p>${Math.ceil((GAME_MS - gameUsed(p)) / 60000)} minutes of play left. When they run out, a new trail starts.</p></div><button class="btn big" data-act="game">Play now</button></div>`;
}
// The home screen's card: today's work, then the Bonus Round as a numbered list, the current step with its button and the
// later ones locked until it is done.
function todayCard(p){
  const d = (p.daily || {})[dayStr()], done = todayDone(p), steps = bonusSteps(), st = bonusStep(p), r = bonusToday(p) || {ex:[], xp:0};
  const day = new Date().toLocaleDateString('en-GB', {weekday:'long'}), pts = ptsName(), dn = skin().daily;
  const head = !done ? {title:"Today's work", text:`Start with ${dn}. Then the Bonus Round, in order, for double ${pts}.`}
    : st < steps.length ? {title:"Today's work complete!", text:`Want more ${pts}? Do the Bonus Round in order for double.`}
    : {title:'Bonus Round complete!', text:`All done! +${r.bonusXp || r.xp} extra ${pts} today.`};
  const row = (n, name, sub, state, btn) => `<li class="${state}"><span class="n" aria-hidden="true">${state === 'done' ? '✓' : n}</span><div><b>${esc(name)}</b><small>${esc(sub)}</small></div>${btn}</li>`;
  const btn = (act, mode, label) => `<button class="btn" data-act="${act}" data-to="${mode}" data-mode="${mode}">${label}</button>`;
  const rows = [row(1, dn, done ? `Done today: ${d.pct}%.` : d ? `Best today ${d.pct}%. Get 80% to finish.` : `15 tricky facts. 80% = +50 ${pts}.`, done ? 'done' : 'now', done ? '' : btn('start-daily', '', d ? 'Try again' : 'Start'))];
  steps.forEach((s, i) => {
    const isDone = done && st > i, isNow = done && st === i;
    const sub = isDone ? (s.k === 'explore' ? `Done: ${EXPLORE_FACTS} facts looked at.` : s.k === 'test' ? `Done. Round complete: +${r.bonusXp || 0} ${pts}.` : 'Done.')
      : isNow && s.k === 'explore' && r.ex.length ? `${r.ex.length} of ${EXPLORE_FACTS} facts looked at so far.` : s.sub;
    rows.push(row(i + 2, s.name, sub, isDone ? 'done' : isNow ? 'now' : 'locked', isNow ? btn(s.act, s.mode, 'Start') : ''));
  });
  return `<div class="today sticker"><div><p class="eyebrow">Today · ${day}</p><h2>${head.title}</h2><p>${head.text}</p></div>
    <ol class="todo" aria-label="Today's order">${rows[0]}<li class="sep" aria-hidden="true"><span>Bonus Round · double ${pts}</span></li>${rows.slice(1).join('')}</ol></div>`;
}
function weakPairs(p, n){
  const keys = ALLKEYS.filter(k => !k.startsWith('1x')).map(k => {
    const f = p.facts[k], [a, b] = k.split('x').map(Number);
    const tried = f && f.n;
    const score = tried ? level(f) * 10 + (f.c / f.n) * 5 - Math.min(f.ms || 0, 9000) / 3000 : 25 + TEACH_ORDER.indexOf(b) * .5;
    return {a, b, score};
  }).sort((x, y) => x.score - y.score);
  return keys.slice(0, n).map(x => [x.a, x.b]);
}

/* ---------- actions ---------- */
function go(to){
  if (S.play && to !== 'play') { quit(); return; }
  if (S.screen === 'game' && (gameTimer || gameInst)) { const demo = !!S.demo; stopGame(); if (!demo) saveProg().catch(saveFail); }
  if (S.reloadSoon && !S.demo && ['home', 'login', 'parent'].includes(to)) { location.reload(); return; }
  if (S.demo && (to === 'home' || to === 'login')) { endDemo(); to = 'parent'; }
  if (to === 'parent' && isParentDevice() && !S.parentOK) { S.parentOK = true; setTimeout(loadParentData, 0); }
  S.screen = to; S.err = null; S.okMsg = null; render(); scrollTo(0, 0);
}
function cfgFor(mode, tables){
  const saved = ls.get(`cfg.${mode}.${S.me.id}`) || {};
  const c = Object.assign({tables:[2,5,10], count:20, miss:false, div:false}, saved);
  S.v.suggested = null;
  if (tables && tables.length) c.tables = tables.slice();
  else if (mode !== 'clock') { const t = focusTable(S.prog); if (t) { c.tables = [t]; S.v.suggested = t; } }
  return c;
}
function openSetup(mode, tables){ S.v.mode = mode; S.v.cfg = cfgFor(mode, tables); go('setup'); }

function startPlay(mode, cfg, pool){
  const kinds = mode === 'daily' ? dailyKinds() : ['mul', ...(cfg.miss ? ['miss'] : []), ...(cfg.div ? ['div'] : [])];
  const P = {mode, cfg: clone(cfg), tables: cfg.tables.slice().sort((a, b) => a - b), kinds, pool: pool || null,
    total: mode === 'test' ? cfg.count : mode === 'daily' ? 15 : cfg.method ? METHOD_QS : null,
    answers:[], correct:0, streak:0, best:0, input:'', start:Date.now(), fb:null, hint:null, retry:false, locked:false, done:false};
  if (mode === 'clock') P.bestKey = P.tables.join('-') + '|' + P.kinds.join('');
  if (mode === 'test') P.trophyOK = trophyTest(S.prog, P.tables);
  if (mode !== 'daily' && !pool && !cfg.method && !S.demo) ls.set(`cfg.${mode}.${S.me.id}`, cfg);
  S.play = P; S.screen = 'play';
  if (mode === 'clock') { P.endsAt = Date.now() + 60000; P.timer = setInterval(tick, 100); }
  else P.timer = setInterval(tickElapsed, 1000);
  nextQ(); scrollTo(0, 0);
}
function dailyKinds(){
  const allowed = YEAR_KINDS[yearOf(S.me)], plan = planFor(S.me), mix = plan && plan.mix;
  return ['mul', 'mul', ...allowed.filter(k => !mix || mix[k] !== false)];
}
function startDaily(){
  const plan = planFor(S.me), focus = plan && (plan.focus || []).filter(t => ALL.includes(t));
  let pool = weakPairs(S.prog, 12);
  if (focus && focus.length) {
    const f = weakPairs(S.prog, 144).filter(([a, b]) => focus.includes(a) || focus.includes(b)).slice(0, 6);
    pool = [...f, ...pool.filter(([a, b]) => !f.some(([x, y]) => x === a && y === b))].slice(0, 12);
  }
  startPlay('daily', {tables: ALL.slice(), count:15}, pool);
}

function pickPair(P){
  const pool = P.pool || P.tables.flatMap(t => ALL.map(k => [t, k]));
  const w = pool.map(([a, b]) => { const k = fkey(a, b); let x = [6,5,4,2,1][level(S.prog.facts[k])]; if (k === P.lastKey) x = .02; return x; });
  let r = Math.random() * w.reduce((s, x) => s + x, 0);
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}
function buildQ(a, b, kind){
  if (Math.random() < .5) [a, b] = [b, a];
  const p = a * b, key = fkey(a, b);
  if (kind === 'miss') return {a, b, kind, parts:[a, '×', '?', '=', p], answer:b, key};
  if (kind === 'div')  return {a, b, kind, parts:[p, '÷', a, '=', '?'], answer:b, key};
  if (kind === 'scale') return {a, b, kind, parts:[a * 10, '×', b, '=', '?'], answer:p * 10, key};
  if (kind === 'scale100') return {a, b, kind, parts:[a * 100, '×', b, '=', '?'], answer:p * 100, key};
  return {a, b, kind:'mul', parts:[a, '×', b, '=', '?'], answer:p, key};
}
// Uplift for harder tables (Sam, 24 Oct 2026): a right answer is worth 15 on the 6s, 7s, 8s, 9s and 12s, 12 on the 3s and
// 4s, 10 on the rest (the fact's harder table counts), and 5 more for missing numbers, division or x10 and x100 facts.
const TABLE_PTS = {3:12, 4:12, 6:15, 7:15, 8:15, 9:15, 12:15};
const tablePts = t => TABLE_PTS[t] || 10;
const answerPts = q => Math.max(tablePts(q.a), tablePts(q.b)) + (q.kind && q.kind !== 'mul' ? 5 : 0);
const qText = (q, fill) => q.parts.map(x => x === '?' ? (fill ?? '?') : x).join(' ');
function nextQ(){
  const P = S.play; if (!P || P.done) return;
  P.fb = null; P.hint = null; P.input = ''; P.retry = false;
  if (P.total && P.answers.length >= P.total) { finish(false); return; }
  const [a, b] = pickPair(P);
  P.q = buildQ(a, b, P.kinds[Math.floor(Math.random() * P.kinds.length)]);
  P.lastKey = P.q.key; P.qStart = Date.now();
  render();
}
function lockThen(ms, fn){
  const P = S.play; P.locked = true; render();
  setTimeout(() => { if (S.play !== P || P.done) return; P.locked = false; fn(); }, ms);
}
function press(k){
  const P = S.play; if (!P || P.locked || P.done) return;
  if (k === 'back') P.input = P.input.slice(0, -1);
  else if (k === 'ok') { submit(); return; }
  else if (P.input.length < 4) P.input += k;
  const slot = document.getElementById('slot'); if (slot) slot.textContent = P.input || '?';
  if (P.mode === 'clock' && P.input.length === String(P.q.answer).length) submit();
}
function submit(){
  const P = S.play, q = P.q; if (P.input === '') return;
  const given = +P.input, ms = Date.now() - P.qStart, ok = given === q.answer;
  if (P.retry) {
    if (ok) { P.fb = {ok:true, text:'That’s it. Now you know it!'}; sound('ok'); lockThen(800, nextQ); }
    else { P.fb = {ok:false, text:`Not quite. It's ${q.answer}. Type ${q.answer} to carry on.`}; P.input = ''; sound('bad'); render(); }
    return;
  }
  updateFact(q.key, ok, ms);
  P.answers.push({k:q.key, t:qText(q), a:q.answer, g:given, ok, ms, pts: ok ? answerPts(q) : 0});
  if (ok) {
    P.correct++; P.streak++; P.best = Math.max(P.best, P.streak); sound('ok');
    P.fb = {ok:true, text: P.streak >= 5 && P.streak % 5 === 0 ? skin().streak(P.streak) : skin().praise[Math.floor(Math.random() * skin().praise.length)]};
    lockThen(P.mode === 'clock' ? 200 : 600, nextQ);
  } else {
    P.streak = 0; sound('bad');
    if (P.mode === 'practice') { P.retry = true; P.hint = hint(q.a, q.b); P.fb = {ok:false, text:`Not quite: ${qText(q, q.answer)}. Type ${q.answer} to carry on.`}; P.input = ''; render(); }
    else if (P.mode === 'test') { P.fb = {ok:false, text:'Not this time. Keep going!'}; lockThen(900, nextQ); }
    else { P.fb = {ok:false, text: qText(q, q.answer)}; lockThen(P.mode === 'clock' ? 1000 : 1500, nextQ); }
  }
}
function tick(){
  const P = S.play; if (!P || P.done) return;
  const left = P.endsAt - Date.now();
  if (left <= 0) { finish(false); return; }
  const t = document.getElementById('clock-t'), fg = document.getElementById('clock-fg');
  if (t) t.textContent = Math.ceil(left / 1000);
  if (fg) fg.setAttribute('stroke-dashoffset', (175.9 * (1 - left / 60000)).toFixed(1));
}
function tickElapsed(){
  const P = S.play; if (!P) return;
  const el = document.getElementById('elapsed'); if (el) el.textContent = fmtDur(Date.now() - P.start);
}
function quit(){
  const P = S.play; if (!P) return;
  finish(P.mode !== 'practice');
}
function masteredSet(p){ return ALL.filter(t => strongCount(p, t) === 12); }

async function finish(abandoned){
  const P = S.play; if (!P || P.done) return;
  P.done = true; clearInterval(P.timer);
  const n = P.answers.length, c = P.answers.filter(a => a.ok).length;
  if (n === 0) { S.play = null; go('home'); return; }
  const pct = Math.round(c / n * 100), ms = Date.now() - P.start, prog = S.prog, today = dayStr();
  const prize = (!abandoned && (P.mode === 'daily' || (P.mode === 'test' && P.trophyOK))) ? tierFor(pct) : null;
  const noTrophy = !abandoned && P.mode === 'test' && !P.trophyOK && !!tierFor(pct);
  const earned = P.answers.reduce((s, x) => s + (x.pts || 0), 0), uplift = Math.max(0, earned - c * 10);
  let xp = earned + (prize ? prize.xp : 0);
  let dailyDone = false;
  if (P.mode === 'daily' && !abandoned) {
    const prev = prog.daily[today];
    if (pct >= 80 && !(prev && prev.pct >= 80)) { xp += 50; dailyDone = true; }
    if (!prev || pct > prev.pct) prog.daily[today] = {pct, c, n};
    const keys = Object.keys(prog.daily).sort(); while (keys.length > 60) delete prog.daily[keys.shift()];
  }
  let prevBest = null, newBest = false;
  if (P.mode === 'clock' && !abandoned) {
    const b = prog.bests[P.bestKey]; prevBest = b ? b.score : null;
    if (!b || c > b.score) { prog.bests[P.bestKey] = {score:c, t:Date.now()}; newBest = true; }
  }
  // The Bonus Round: the step they are on counts when played in its turn; the test is last and pays the round's points again.
  let bonus = null;
  if (!abandoned && todayDone(prog)) {
    const steps = bonusSteps(), i = bonusStep(prog), cur = steps[i];
    const k = P.mode === 'clock' ? 'clock' : P.mode === 'test' ? 'test' : P.cfg && P.cfg.method && n >= METHOD_QS ? 'm:' + P.cfg.method : null;
    if (k && cur && cur.k === k) {
      const r = bonusRound(prog); r.steps[k] = Date.now(); r.xp += xp;
      if (k === 'test') { r.bonusXp = r.xp; r.done = Date.now(); xp += r.bonusXp; bonus = {done:true, base:r.xp, extra:r.bonusXp}; }
      else bonus = {step: i + 1, of: steps.length, next: steps[i + 1]};
    } else if (k && cur && steps.some(x => x.k === k)) bonus = {hint:true, next: cur};
  }
  const itemsBefore = itemsOwned(prog);
  prog.xp += xp; prog.totals.q += n; prog.totals.c += c;
  if (!prog.days.includes(today)) { prog.days.push(today); if (prog.days.length > 400) prog.days.shift(); }
  if (prize) { prog.prizes[prize.id] = (prog.prizes[prize.id] || 0) + 1; prog.prizeLog.unshift({t:Date.now(), tier:prize.id, pct, mode:P.mode}); prog.prizeLog = prog.prizeLog.slice(0, 80); }
  const newItems = []; for (let k = itemsBefore; k < itemsOwned(prog); k++) newItems.push(k);
  const unlocked = skinId() !== 'classic' && itemsBefore < TRAIL_STOPS && itemsOwned(prog) >= TRAIL_STOPS;
  const newBadges = masteredSet(prog).filter(t => !prog.badges['t' + t]);
  newBadges.forEach(t => { prog.badges['t' + t] = Date.now(); });
  const wrong = uniq(P.answers.filter(a => !a.ok).map(a => a.k)).slice(0, 12);
  const entry = {t:P.start, mode:P.mode, tables:P.tables, n, c, pct, ms, prize: prize ? prize.id : null, xp, wrong};
  if (P.pool) entry.pool = true;
  if (P.cfg && P.cfg.method) entry.method = P.cfg.method;
  if (abandoned) entry.ab = true;
  S.sessions.push(entry); ensureLogCur(); S.logCur.sessions.push(entry);
  if (!S.demo) Promise.all([saveProg(), saveLog()]).catch(saveFail);
  S.result = Object.assign({}, entry, {answers:P.answers, newBest, prevBest, newBadges, newItems, unlocked, dailyDone, bonus, noTrophy, uplift, cfg:P.cfg, poolPairs:P.pool, best:P.best});
  S.play = null; S.screen = 'results'; render(); scrollTo(0, 0);
  if (prize) { confetti(prize.id); sound('win'); }
  else if (newBest) confetti('gold');
}

/* ---------- screens ---------- */
function brandBar(){ return `<header class="top"><div class="brand">${logo()}<span>Times Table Champions</span></div></header>`; }
function topbar(cur){
  const me = S.me;
  const tabs = [['home','Home','go'],['progress','My progress','go']];
  return `<header class="top"><div class="brand">${logo()}<span>${esc(skin().brand)}</span></div>
    <div class="top-right">
      <span class="sync" id="sync-chip">${esc(syncText())}</span>
      <button class="icon-btn" data-act="sound" aria-pressed="${S.sound}">${S.sound ? 'Sound on' : 'Sound off'}</button>
      <span class="me-chip">${avatar(me, 34)}<span>${esc(me.name)}</span></span>
      <button class="btn ghost small" data-act="logout">Sign out</button>
    </div></header>
    <nav class="tabs" aria-label="Main"><div class="tabs-in">${tabs.map(([k, l, a]) => `<button class="tab ${cur === k ? 'on' : ''}" data-act="${a}" data-to="${k}" data-mode="${k}" ${cur === k ? 'aria-current="page"' : ''}>${l}</button>`).join('')}</div></nav>`;
}
const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;

function scrLoading(){ return `${brandBar()}<div class="loading"><div><p class="mega">7 × 8 = ?</p><p class="muted">Opening your times tables…</p></div></div>`; }

function scrLogin(){
  const lf = S.v.loginFor && S.players.find(p => p.id === S.v.loginFor);
  return `${brandBar()}<section class="login">
    <div><h1 class="mega">Who's playing today?</h1><p class="lede">Tap your name, then type your PIN.</p></div>
    ${S.players.length
      ? `<div class="who">${S.players.map(p => `<button class="who-card ${lf && lf.id === p.id ? 'on' : ''}" data-act="pick-player" data-id="${esc(p.id)}" style="--c:var(--${esc(p.color || 'sky')})">${avatar(p, 76)}<span class="who-name">${esc(p.name)}</span><span class="who-sub">${[p.age ? 'Age ' + esc(p.age) : '', SKINS[p.theme] && p.theme !== 'classic' ? esc(SKINS[p.theme].brand) : ''].filter(Boolean).join(' · ') || '&nbsp;'}</span></button>`).join('')}</div>`
      : `<div class="sticker form"><h2>No players yet</h2><p class="muted">A grown-up can add players in the Grown-ups area. It takes a minute.</p><button class="btn" data-act="go" data-to="parent">Open the Grown-ups area</button></div>`}
    ${lf ? loginForm(lf) : ''}
    <div class="sticker howvid"><div><h2>New here? Watch how it works</h2><p class="muted">Two and a half minutes with Taylor, your Times Table Coach.</p></div><button class="btn" data-act="howvid">\u25B6 Watch the video</button></div>
    <p class="foot-link"><button class="link" data-act="go" data-to="parent">Grown-ups area</button></p>
  </section>`;
}
function loginForm(p){
  const setup = !p.pinHash;
  return `<form class="sticker form" data-form="login" data-id="${esc(p.id)}">
    <h2>${setup ? `Choose your PIN, ${esc(p.name)}` : `Welcome back, ${esc(p.name)}!`}</h2>
    ${setup ? '<p class="muted">Choose 4 secret numbers you’ll remember.</p>' : ''}
    <label for="lg-pin">${setup ? 'Choose a PIN (4 numbers)' : 'Your PIN'}</label>
    <input id="lg-pin" name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="4" required data-autofocus>
    ${setup ? '<label for="lg-pin2">Type your PIN again</label><input id="lg-pin2" name="pin2" type="password" inputmode="numeric" autocomplete="off" maxlength="4" required>' : ''}
    ${S.err ? `<p class="err" role="alert">${esc(S.err)}</p>` : ''}
    <button class="btn big" type="submit">${setup ? 'Save and start' : 'Sign in'}</button>
  </form>`;
}

function scrGate(){
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return `${brandBar()}<section class="narrow"><div class="sticker form">
    <h1 class="mega sm">Welcome!</h1>
    ${ios && !standalone ? `<p class="callout"><b>First, put the app on the Home Screen.</b> Tap the Share button, then <b>Add to Home Screen</b>. Open Times Tables from the Home Screen and sign in there.</p>` : ''}
    <p>Sign in with the family Google account for this ${ios ? 'iPad' : 'device'}. You only do this once. After that the app works without the internet.</p>
    ${navigator.onLine ? '' : '<p class="err">Connect to Wi-Fi for this first sign-in.</p>'}
    ${S.gateErr ? `<p class="err" role="alert">${esc(S.gateErr)}</p>` : ''}
    <button class="btn big" data-act="google">Sign in with Google</button>
    <p class="muted small">Only the four family Google accounts can use this app.</p>
  </div></section>`;
}

function scrHome(){
  const p = S.prog, me = S.me, L = lvlInfo(p.xp), streak = streakDays(p), om = Math.round(overallMastery(p) * 100);
  return `${topbar('home')}
  <section class="hero-home">
    <div class="hello"><p class="eyebrow">Week ${challengeWeek()} of 52 · Level ${L.n} · ${esc(L.title)}</p><h1 class="mega">Hi ${esc(me.name)}!</h1>
      <div class="xpbar" role="progressbar" aria-label="Progress to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(L.frac*100)}"><span style="width:${(L.frac*100).toFixed(1)}%"></span></div>
      <p class="muted small">${p.xp} ${ptsName()}${L.next ? ` · ${L.next - p.xp} ${ptsName()} until you become a ${esc(L.nextTitle)}` : ' · You reached the top level!'}</p></div>
    <div class="stats">${stat(streak, streak === 1 ? 'day in a row' : 'days in a row')}${stat(om + '%', 'tables mastered')}${stat(prizeTotal(p), 'prizes won')}</div>
  </section>
  <div class="grid-home">
    <div class="col">
      ${gameBanner(p)}${todayCard(p)}
      <div class="extra-h"><h2>Extra practice</h2><p>Not part of today's plan. Play any time for more ${ptsName()}.</p></div>
      <div class="modes">
        ${modeTile('practice', '7×8', 'Practise', 'No timer. Tricks when stuck.', 'mint')}
        ${modeTile('test', '90%', 'Take a test', 'Win trophies at 70%.', 'sun')}
        ${modeTile('clock', '60s', 'Beat the Clock', 'Beat your best in 60 seconds.', 'tomato')}
        ${modeTile('explore', '12²', 'Explore', 'Spot the patterns.', 'sky')}
      </div>
      <div class="sticker"><p class="eyebrow">From Taylor, your Times Table Coach</p>${planFor(me) && planFor(me).note ? `<p class="callout" style="margin-top:10px">${esc(planFor(me).note)}</p>` : ''}<ul class="recs">${recommendations(p, S.sessions).map(recItem).join('')}</ul></div>
    </div>
    <div class="col">
      ${journey(p)}
      <div class="sticker"><div class="card-h"><h3>Your times-table map</h3><button class="link small" data-act="go" data-to="progress">See all progress</button></div>
        ${tablesSplit(p)}
        <p class="muted small" style="margin-bottom:10px">Each square is one fact, like 7 × 8 = 56. Green means you know it.</p>${heatmap(p, false)}</div>
    </div>
  </div>`;
}
const modeTile = (mode, glyph, title, sub, col) => `<button class="mode" style="--c:var(--${col})" data-act="${mode === 'explore' ? 'go' : 'setup'}" data-to="${mode}" data-mode="${mode}"><span class="glyph">${glyph}</span><b>${title}</b><span>${sub}</span></button>`;
const recItem = r => `<li><p>${esc(r.text)}</p>${r.mode ? `<button class="btn small" data-act="rec" data-mode="${r.mode}" data-tables="${r.tables.join(',')}">${esc(r.cta)}</button>` : ''}</li>`;

/* ---------- collections: Jessica's era dresses, Hughie's survival kit ---------- */
// One item per trophy won, in order. Album colours and Eras Tour looks researched 24 Oct 2026.
const ERAS = [
  {album:'Taylor Swift', era:'Debut', colour:'Teal green', hex:'#2FA89A', text:'#FFFFFF', look:'A country sundress with cowboy boots, the look of her very first era.'},
  {album:'Fearless', era:'Fearless', colour:'Gold', hex:'#E8B923', text:'#1B2140', look:'A sparkling gold fringe mini dress that swings when she dances.'},
  {album:'Speak Now', era:'Speak Now', colour:'Purple', hex:'#A77BD6', text:'#FFFFFF', look:'A princess ballgown covered in crystals, with a huge twirly skirt.'},
  {album:'Red', era:'Red', colour:'Red', hex:'#C8102E', text:'#FFFFFF', look:'A sparkling red-and-black robe with a black hat.'},
  {album:'1989', era:'1989', colour:'Sky blue', hex:'#7DB9E8', text:'#1B2140', look:'A glittering two-piece: crop top and mini skirt.'},
  {album:'reputation', era:'reputation', colour:'Black', hex:'#1C1C22', text:'#FFFFFF', look:'A black catsuit with one leg, wrapped in a red sequin snake.'},
  {album:'Lover', era:'Lover', colour:'Pink and blue', hex:'#F5A3C7', text:'#1B2140', look:'A jewelled pink-and-blue bodysuit with sparkly boots.'},
  {album:'folklore', era:'folklore', colour:'Grey', hex:'#A7A9AC', text:'#1B2140', look:'A flowing cream gown with a soft cape, like a story in a forest.'},
  {album:'evermore', era:'evermore', colour:'Brown and gold', hex:'#C08A3E', text:'#1B2140', look:'A golden-mustard boho gown, cosy as an autumn walk.'},
  {album:'Midnights', era:'Midnights', colour:'Midnight blue', hex:'#26346E', text:'#FFFFFF', look:'A starry midnight-blue bodysuit under a lavender fluffy coat.'},
  {album:'The Tortured Poets Department', era:'TTPD', colour:'White', hex:'#F4F1EA', text:'#1B2140', look:'A white gown with poetry written all over it.'},
  {album:'The Life of a Showgirl', era:'Showgirl', colour:'Orange and mint', hex:'#F07A1A', text:'#1B2140', look:'An orange glitter showgirl costume with a feathered headpiece.'},
];
const TOOLS = [
  {name:'Backpack', camp:'Pack for the adventure', use:'Carries everything else you collect.'},
  {name:'Map', camp:'Find the trailhead', use:'Shows the path all the way to the summit.'},
  {name:'Compass', camp:'Choose the right path', use:'Points north, so you never get lost.'},
  {name:'Water bottle', camp:'Fill up at the stream', use:'Keeps you going on the long climb.'},
  {name:'Head torch', camp:'Walk through the dark forest', use:'Lights the way with both hands free.'},
  {name:'Penknife', camp:'Get through the brambles', use:'A blade, scissors and a tin opener in one.'},
  {name:'Rope', camp:'Cross the river', use:'Strong enough to cross the river safely.'},
  {name:'Tent', camp:'Shelter from the storm', use:'Keeps you dry when the storm rolls in.'},
  {name:'Fire starter', camp:'Light the campfire', use:'Sparks a campfire for warmth and cooking.'},
  {name:'First-aid kit', camp:'Patch up a scraped knee', use:'Plasters and bandages for bumps and scrapes.'},
  {name:'Whistle', camp:'Signal to the team', use:'Three blasts means "help" anywhere in the world.'},
  {name:'Ice axe', camp:'Climb the icy summit', use:'Grips the ice on the final climb.'},
  {name:'Machete', camp:'Reach the edge of the gold jungle', use:'Chops a path through the thickest jungle.'},
];
const ERA_COLS = ERAS.map(e => e.hex);
const ERA_TEXT = ERAS.map(e => e.text);
// The weekly trail: 7 trophies since Monday open the reward game for 30 minutes of play. When the 30 minutes run out,
// or a new week starts, a fresh trail begins (Sam, 24 Oct 2026).
const TRAIL_STOPS = 7, GAME_MS = 30 * 60 * 1000;
const trailStart = p => Math.max(weekStart(), p.trailReset || 0);
const itemsOwned = p => Math.min(TRAIL_STOPS, (p.prizeLog || []).filter(x => x.t >= trailStart(p)).length);
const gameUsed = p => p.gameTrail === trailStart(p) ? (p.gameMs || 0) : 0;
// A child's game opens only once a grown-up has approved it in the Grown-ups area (games/<id>; Sam, 24 Oct 2026: "final approval").
const gameApproved = pl => !!pl && ((S.gameOK || {})[pl.id] || {}).status === 'approved';
const gameOpen = p => skinId() !== 'classic' && itemsOwned(p) >= TRAIL_STOPS && gameUsed(p) < GAME_MS && gameApproved(S.me);
const gameName = () => skinId() === 'eras' ? 'Eras Stadium Show' : 'Jungle Gold Run';
// Jessica's seven dresses change every trail; Hughie packs the same seven tools for the jungle.
const trailDress = (p, i) => (Math.floor(trailStart(p) / (7 * 864e5)) * TRAIL_STOPS + i) % ERAS.length;
const JUNGLE = [[0, 'Load the boat on the river'], [1, 'Find the jungle trail'], [2, 'Choose the right path'], [3, 'Fill up at the waterfall'],
  [4, 'Walk through the dark forest'], [6, 'Swing across the ravine'], [12, 'Reach the edge of the gold jungle']].map(([tool, camp]) => ({tool, camp}));
const allTablesTest = s => s.mode === 'test' && !s.ab && s.tables && s.tables.length === 12;
const trophyLine = p => `<div class="trophy-line">${TIERS.map(t => `<span class="${p.prizes[t.id] ? '' : 'locked'}" title="${esc(t.name)}">${medal(t.id, 28)}<b class="num">${p.prizes[t.id] || 0}</b></span>`).join('')}<span class="muted small">Win trophies with 70% to move on.</span></div>`;

function dressSvg(i, size, locked){
  const L = 'var(--line)', sw = 2.2;
  const sp = pts => pts.map(([x, y]) => `<path d="M${x} ${y - 2.6}l.9 1.7 1.7.9-1.7.9-.9 1.7-.9-1.7-1.7-.9 1.7-.9z" fill="#FFFFFF" opacity=".9"/>`).join('');
  const straps = c => `<path d="M31 22 L29 12 M49 22 L51 12" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`;
  const bodice = c => `${straps(c)}<path d="M30 22 Q40 27 50 22 L52 46 Q40 49 28 46 Z" fill="${c}" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  let g;
  switch (locked ? -1 : i) {
    case 0: g = `${bodice('#2FA89A')}<path d="M28 46 L52 46 L62 82 Q40 88 18 82 Z" fill="#2FA89A" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/>
      <circle cx="33" cy="60" r="2.4" fill="#FFF"/><circle cx="45" cy="66" r="2.4" fill="#FFF"/><circle cx="38" cy="74" r="2.4" fill="#FFF"/>
      <path d="M31 88 h7 v13 h5 v5 h-12 z M42 88 h7 v18 h-12 v-5 h5 z" fill="#8B5A2B" stroke="${L}" stroke-width="2" stroke-linejoin="round"/>`; break;
    case 1: g = `${bodice('#E8B923')}<path d="M28 46 L52 46 L56 64 L24 64 Z" fill="#E8B923" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/>
      ${Array.from({length:11}, (_, k) => `<path d="M${25.5 + k * 2.9} 64 L${25 + k * 3} ${78 + (k % 2) * 3}" stroke="#C9971A" stroke-width="1.8" stroke-linecap="round"/>`).join('')}
      ${sp([[36, 30], [45, 38], [33, 54], [47, 57]])}`; break;
    case 2: g = `${bodice('#A77BD6')}<path d="M28 46 Q40 50 52 46 Q66 70 74 104 Q40 114 6 104 Q14 70 28 46 Z" fill="#A77BD6" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/>
      <path d="M17 76 Q40 84 63 76 M11 92 Q40 102 69 92" fill="none" stroke="#8458B8" stroke-width="2"/>${sp([[36, 32], [46, 36], [26, 86], [52, 70], [40, 98], [60, 96]])}`; break;
    case 3: g = `<ellipse cx="40" cy="11" rx="17" ry="4" fill="#1C1C22" stroke="${L}" stroke-width="2"/><path d="M31 11 Q31 1 40 1 Q49 1 49 11 Z" fill="#1C1C22" stroke="${L}" stroke-width="2"/>
      <path d="M27 20 L53 20 L64 108 L16 108 Z" fill="#C8102E" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/>
      <path d="M33 20 L40 46 L47 20 M40 46 L40 108" fill="none" stroke="#1C1C22" stroke-width="3"/>${sp([[26, 60], [54, 70], [30, 90], [50, 96], [36, 36]])}`; break;
    case 4: g = `${straps('#7DB9E8')}<path d="M30 22 Q40 26 50 22 L51 38 L29 38 Z" fill="#7DB9E8" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/>
      <path d="M28 46 L52 46 L57 68 L23 68 Z" fill="#7DB9E8" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/>
      <path d="M34 26 l4 5 -4 5 -4 -5z M46 26 l4 5 -4 5 -4 -5z M32 52 l4 6 -4 6 -4 -6z M40 52 l4 6 -4 6 -4 -6z M48 52 l4 6 -4 6 -4 -6z" fill="#B9DBF5"/>`; break;
    case 5: g = `${straps('#1C1C22')}<path d="M30 22 Q40 27 50 22 L52 52 L50 58 L51 108 L43 108 L41 62 L34 60 L28 52 Z" fill="#1C1C22" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/>
      <path d="M34 26 Q46 32 36 40 Q26 48 44 52 Q50 56 46 66 Q42 78 47 90 Q50 98 46 104" fill="none" stroke="#B3001B" stroke-width="3.6" stroke-linecap="round"/><circle cx="34" cy="26" r="2.6" fill="#B3001B"/>`; break;
    case 6: g = `${straps('#F5A3C7')}<path d="M30 22 Q40 27 50 22 L52 52 L44 60 L36 60 L28 52 Z" fill="#F5A3C7" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/>
      <path d="M40 26 l5 6 -5 6 -5 -6z M33 42 l4 5 -4 5 -4 -5z M47 42 l4 5 -4 5 -4 -5z" fill="#8CC8F0"/>
      <path d="M31 70 h8 v34 h-10 v-4 h2 z M41 70 h8 v30 h2 v4 h-10 z" fill="#F5A3C7" stroke="${L}" stroke-width="2" stroke-linejoin="round"/>${sp([[35, 80], [45, 90], [35, 96]])}`; break;
    case 7: g = `<path d="M26 18 Q12 64 8 110 L72 110 Q68 64 54 18 Z" fill="#A7A9AC" fill-opacity=".55" stroke="${L}" stroke-width="1.6"/>
      ${straps('#F1EAD8')}<path d="M30 22 Q40 27 50 22 L52 46 Q60 78 64 108 L16 108 Q20 78 28 46 Z" fill="#F1EAD8" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/>
      <path d="M34 50 Q32 80 28 106 M46 50 Q48 80 52 106" fill="none" stroke="#C9C1AE" stroke-width="1.6"/>`; break;
    case 8: g = `${bodice('#C08A3E')}<path d="M28 46 L52 46 L62 106 L18 106 Z" fill="#C08A3E" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/>
      <path d="M25 66 L55 66 M22 86 L58 86" stroke="#8E6226" stroke-width="2"/>
      ${[[32, 58], [46, 60], [28, 78], [52, 78], [36, 96], [48, 98]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="#F3D9A4"/>`).join('')}`; break;
    case 9: g = `<path d="M22 16 L58 16 L66 98 L47 98 L45 40 L35 40 L33 98 L14 98 Z" fill="#C9B3FF" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/>
      <path d="M20 30 q-3 3 0 6 M60 30 q3 3 0 6 M18 56 q-3 3 0 6 M62 56 q3 3 0 6 M16 80 q-3 3 0 6 M64 80 q3 3 0 6" fill="none" stroke="#A88EE8" stroke-width="2"/>
      <path d="M35 20 L45 20 L45 60 L35 60 Z" fill="#26346E" stroke="${L}" stroke-width="1.8"/>${sp([[38, 28], [42, 40], [38, 52]])}`; break;
    case 10: g = `${bodice('#F4F1EA')}<path d="M28 46 L52 46 Q64 92 66 108 Q40 96 14 108 Q16 92 28 46 Z" fill="#F4F1EA" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/>
      ${[56, 64, 72, 80, 88].map((y, k) => `<path d="M${30 - k} ${y} q2 -2 4 0 t4 0 t4 0 t4 0 t4 0" fill="none" stroke="#3A3740" stroke-width="1.2"/>`).join('')}`; break;
    case 11: g = `<path d="M40 14 C30 2 26 8 30 18 M40 14 C50 2 54 8 50 18 M40 14 C40 0 40 0 40 0" fill="none" stroke="#7FE0C2" stroke-width="4" stroke-linecap="round"/>
      <path d="M30 22 Q40 27 50 22 L52 52 L44 62 L36 62 L28 52 Z" fill="#F07A1A" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round"/>
      <path d="M52 30 Q72 34 74 58 Q62 50 52 50 Z" fill="#7FE0C2" stroke="${L}" stroke-width="1.8"/><path d="M28 30 Q8 34 6 58 Q18 50 28 50 Z" fill="#7FE0C2" stroke="${L}" stroke-width="1.8"/>
      <path d="M33 68 h7 v38 h-9 v-3 h2 z M41 68 h7 v35 h2 v3 h-9 z" fill="#F07A1A" stroke="${L}" stroke-width="2" stroke-linejoin="round"/>${sp([[36, 32], [44, 40], [40, 52], [37, 84], [45, 94]])}`; break;
    default: g = `<path d="M30 22 Q40 27 50 22 L52 46 L62 104 L18 104 L28 46 Z" fill="var(--card2)" stroke="var(--muted)" stroke-width="2" stroke-dasharray="4 4"/><text x="40" y="76" text-anchor="middle" font-size="26" fill="var(--muted)">?</text>`;
  }
  return `<svg viewBox="0 0 80 112" width="${size}" height="${Math.round(size * 1.4)}" aria-hidden="true">${g}</svg>`;
}
function toolSvg(i, size, locked){
  const L = 'var(--line)', W = 2.4;
  let g;
  switch (locked ? -1 : i) {
    case 0: g = `<rect x="14" y="14" width="36" height="42" rx="10" fill="#4E8A3E" stroke="${L}" stroke-width="${W}"/><rect x="20" y="34" width="24" height="16" rx="4" fill="#6FAE5A" stroke="${L}" stroke-width="2"/><path d="M24 14 Q24 6 32 6 Q40 6 40 14" fill="none" stroke="${L}" stroke-width="${W}"/><path d="M14 28 H50" stroke="${L}" stroke-width="2"/>`; break;
    case 1: g = `<path d="M8 14 L24 8 L40 14 L56 8 V50 L40 56 L24 50 L8 56 Z" fill="#F3E3B5" stroke="${L}" stroke-width="${W}" stroke-linejoin="round"/><path d="M24 8 V50 M40 14 V56" stroke="#C9B37A" stroke-width="1.6"/><path d="M14 44 Q24 34 30 38 T46 22" fill="none" stroke="#D9443A" stroke-width="2.4" stroke-dasharray="3 3"/><path d="M44 18 l6 6 M50 18 l-6 6" stroke="#D9443A" stroke-width="2.6" stroke-linecap="round"/>`; break;
    case 2: g = `<circle cx="32" cy="34" r="22" fill="#E7EEF5" stroke="${L}" stroke-width="${W}"/><circle cx="32" cy="34" r="17" fill="none" stroke="#9DB0C4" stroke-width="1.4"/><path d="M32 18 L37 34 L32 50 L27 34 Z" fill="#FFFFFF" stroke="${L}" stroke-width="1.6"/><path d="M32 18 L37 34 L27 34 Z" fill="#D9443A"/><circle cx="32" cy="34" r="2.4" fill="${L}"/><rect x="28" y="6" width="8" height="6" rx="2" fill="#9DB0C4" stroke="${L}" stroke-width="1.8"/>`; break;
    case 3: g = `<rect x="20" y="16" width="24" height="42" rx="8" fill="#3B9BD9" stroke="${L}" stroke-width="${W}"/><rect x="24" y="6" width="16" height="10" rx="3" fill="#2B6E9E" stroke="${L}" stroke-width="2"/><path d="M24 32 Q32 28 40 32 V50 Q32 54 24 50 Z" fill="#9FD4F5" opacity=".8"/>`; break;
    case 4: g = `<path d="M6 34 Q32 18 58 34" fill="none" stroke="#3A3740" stroke-width="6" stroke-linecap="round"/><rect x="22" y="22" width="20" height="16" rx="5" fill="#F2C14E" stroke="${L}" stroke-width="${W}"/><circle cx="32" cy="30" r="5" fill="#FFF6C8" stroke="${L}" stroke-width="1.6"/><path d="M26 40 L14 60 H50 L38 40 Z" fill="#FFE98A" opacity=".55"/>`; break;
    case 5: g = `<rect x="10" y="30" width="40" height="14" rx="7" fill="#D9443A" stroke="${L}" stroke-width="${W}"/><path d="M44 30 L60 18 L58 26 L48 34" fill="#C9D1DA" stroke="${L}" stroke-width="2" stroke-linejoin="round"/><path d="M22 37 h6 M25 34 v6" stroke="#FFF" stroke-width="2.4" stroke-linecap="round"/>`; break;
    case 6: g = `<ellipse cx="32" cy="34" rx="24" ry="20" fill="none" stroke="#B07A3E" stroke-width="7"/><ellipse cx="32" cy="34" rx="14" ry="11" fill="none" stroke="#C99256" stroke-width="6"/><path d="M50 46 Q58 54 52 60" fill="none" stroke="#B07A3E" stroke-width="5" stroke-linecap="round"/>`; break;
    case 7: g = `<path d="M6 54 L32 10 L58 54 Z" fill="#F28A3C" stroke="${L}" stroke-width="${W}" stroke-linejoin="round"/><path d="M32 10 L24 54 M32 10 L40 54" stroke="${L}" stroke-width="1.6"/><path d="M26 54 Q32 36 38 54 Z" fill="#7A3E12" stroke="${L}" stroke-width="1.8"/><path d="M2 56 H62" stroke="${L}" stroke-width="2.4" stroke-linecap="round"/>`; break;
    case 8: g = `<path d="M14 54 L50 42 M14 42 L50 54" stroke="#8B5A2B" stroke-width="6" stroke-linecap="round"/><path d="M32 46 C18 36 26 24 30 10 C34 22 46 26 40 40 C44 34 46 30 44 26 C52 34 48 46 32 46 Z" fill="#F28A3C" stroke="${L}" stroke-width="2" stroke-linejoin="round"/><path d="M32 44 C26 38 30 32 32 26 C34 32 38 38 32 44 Z" fill="#FFD166"/>`; break;
    case 9: g = `<rect x="10" y="18" width="44" height="34" rx="6" fill="#3E9A5A" stroke="${L}" stroke-width="${W}"/><path d="M26 18 V12 H38 V18" fill="none" stroke="${L}" stroke-width="${W}"/><path d="M28 26 h8 v6 h6 v8 h-6 v6 h-8 v-6 h-6 v-8 h6 z" fill="#FFF" stroke="${L}" stroke-width="1.4"/>`; break;
    case 10: g = `<path d="M10 30 H40 A12 12 0 1 1 34 48 L18 40 H10 Z" fill="#F28A3C" stroke="${L}" stroke-width="${W}" stroke-linejoin="round"/><circle cx="44" cy="40" r="5" fill="#FFF" stroke="${L}" stroke-width="1.6"/><path d="M10 30 Q2 18 14 10 Q26 4 30 30" fill="none" stroke="#3B9BD9" stroke-width="2.4"/>`; break;
    case 12: g = `<path d="M14 52 L24 42" stroke="#5B3A1E" stroke-width="7" stroke-linecap="round"/><path d="M24 42 L50 12 Q58 8 56 18 L30 48 Z" fill="#C9D1DA" stroke="${L}" stroke-width="2.2" stroke-linejoin="round"/><path d="M24 42 L30 48" stroke="${L}" stroke-width="3"/>`; break;
    case 11: g = `<path d="M30 58 L36 16" stroke="#8B5A2B" stroke-width="6" stroke-linecap="round"/><path d="M14 18 Q36 6 56 14 L52 20 Q38 14 18 24 Z" fill="#C9D1DA" stroke="${L}" stroke-width="2.2" stroke-linejoin="round"/><path d="M56 14 L60 22" stroke="${L}" stroke-width="2.4" stroke-linecap="round"/>`; break;
    default: g = `<rect x="10" y="10" width="44" height="44" rx="12" fill="var(--card2)" stroke="var(--muted)" stroke-width="2" stroke-dasharray="4 4"/><text x="32" y="41" text-anchor="middle" font-size="22" fill="var(--muted)">?</text>`;
  }
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">${g}</svg>`;
}

function collectionCard(p){
  const id = skinId(); if (id === 'classic') return '';
  const n = itemsOwned(p), sel = S.v.item, open = gameOpen(p), mins = Math.ceil((GAME_MS - gameUsed(p)) / 60000);
  const goal = open ? `<div class="callout mint unlock"><div><b>${id === 'eras' ? 'Your stadium show is open!' : 'The jungle gold is waiting!'}</b> ${mins} minutes of play left.</div><button class="btn" data-act="game">${id === 'eras' ? 'Go on stage' : 'Start the Gold Run'}</button></div>`
    : n >= TRAIL_STOPS && !gameApproved(S.me) ? `<p class="callout">Trail complete! Your ${id === 'eras' ? 'stadium show' : 'Jungle Gold Run'} is waiting for a grown-up to approve it.</p>`
    : `<p class="muted small">Win ${TRAIL_STOPS - n} more troph${TRAIL_STOPS - n === 1 ? 'y' : 'ies'} by Sunday to unlock ${id === 'eras' ? 'your stadium show' : 'the Jungle Gold Run'}: 30 minutes of play. A new trail starts every Monday.</p>`;
  if (id === 'eras') {
    const ds = Array.from({length:TRAIL_STOPS}, (_, k) => trailDress(p, k)), e = sel !== undefined && sel < TRAIL_STOPS && ERAS[ds[sel]];
    return `<div class="sticker"><div class="card-h"><h3>This week's Eras Tour</h3><span class="muted small">${n} of ${TRAIL_STOPS} dresses</span></div>
      <div class="rail">${ds.map((d, k) => `<button class="hanger ${k < n ? '' : 'locked'} ${sel === k ? 'on' : ''}" data-act="item" data-i="${k}" aria-label="${esc(ERAS[d].album)}${k < n ? '' : ', not won yet'}">${dressPhoto(d, k >= n ? 'locked' : '')}<span style="--era:${ERAS[d].hex};--era-t:${ERAS[d].text}">${esc(ERAS[d].era)}</span></button>`).join('')}</div>
      ${e ? `<div class="item-detail">${dressPhoto(ds[sel], 'big ' + (sel >= n ? 'locked' : ''))}<div><p class="eyebrow">${esc(e.album)} · ${esc(e.colour)}</p><p>${sel < n ? esc(e.look) : `Win ${sel + 1 - n} more troph${sel + 1 - n === 1 ? 'y' : 'ies'} to unlock this dress.`}</p></div></div>` : ''}
      ${goal}${trophyLine(p)}</div>`;
  }
  const pts = [[44,236],[188,228],[256,198],[282,146],[432,128],[452,78],[598,28]];
  let g = `<polygon points="0,270 110,150 200,205 330,85 420,160 520,30 640,130 640,270" fill="var(--mint)" fill-opacity=".22"/>
    <path d="M0 252 Q160 236 320 256 T640 246 V270 H0 Z" fill="var(--sky)" fill-opacity=".45"/>
    <polyline points="${pts.map(q => q.join(',')).join(' ')}" fill="none" stroke="var(--me)" stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round"/>
    <text x="608" y="66" font-size="26" text-anchor="middle">💰</text>`;
  pts.forEach(([x, y], i) => {
    const got = n > i;
    g += `<g><title>Camp ${i + 1}: ${esc(JUNGLE[i].camp)}${got ? ' (reached)' : ''}</title>
      <circle cx="${x}" cy="${y}" r="17" fill="${got ? 'var(--mint)' : 'var(--card)'}" stroke="var(--line)" stroke-width="2.5"/>
      <text x="${x}" y="${y + 6}" text-anchor="middle" font-size="15" fill="var(--ink)">${i + 1}</text>
      ${got ? `<path d="M${x + 8} ${y - 14} V${y - 38} L${x + 26} ${y - 31} L${x + 8} ${y - 25}" fill="var(--me)" stroke="var(--line)" stroke-width="2" stroke-linejoin="round"/>` : ''}
      ${i === n ? `<path d="M${x} ${y - 22} c-9 -10 -13 -15 -13 -21 a13 13 0 0 1 26 0 c0 6 -4 11 -13 21z" fill="var(--me)" stroke="var(--line)" stroke-width="2"/><circle cx="${x}" cy="${y - 43}" r="4.5" fill="var(--card)"/>` : ''}</g>`;
  });
  const tl = sel !== undefined && sel < TRAIL_STOPS && TOOLS[JUNGLE[sel].tool];
  return `<div class="sticker journey"><div class="card-h"><h3>This week's jungle trail</h3><span class="muted small">${n} of ${TRAIL_STOPS} camps</span></div>
    <svg viewBox="0 0 640 270" role="img" aria-label="Jungle trail: ${n} of ${TRAIL_STOPS} camps reached">${g}</svg>
    ${n < TRAIL_STOPS ? `<p style="font-weight:800;margin:6px 0 4px">Next: camp ${n + 1}. Win a trophy to get there.</p>` : ''}
    <div class="kit">${JUNGLE.map((j, k) => `<button class="slot-btn ${k < n ? '' : 'locked'} ${sel === k ? 'on' : ''}" data-act="item" data-i="${k}" aria-label="${esc(TOOLS[j.tool].name)}${k < n ? '' : ', not won yet'}">${toolSvg(j.tool, 36, k >= n)}<span>${k < n ? esc(TOOLS[j.tool].name) : '?'}</span></button>`).join('')}</div>
    ${tl ? `<div class="item-detail">${toolSvg(JUNGLE[sel].tool, 60, sel >= n)}<div><p class="eyebrow">Camp ${sel + 1} · ${esc(JUNGLE[sel].camp)}</p><p>${sel < n ? `<b>${esc(tl.name)}.</b> ${esc(tl.use)}` : `Win ${sel + 1 - n} more troph${sel + 1 - n === 1 ? 'y' : 'ies'} to get this tool.`}</p></div></div>` : ''}
    ${goal}${trophyLine(p)}</div>`;
}
// Home's one reward card: Jessica's Eras Tour or Hughie's adventure, and the plain trophy cabinet for the classic look.
function journey(p){ return skinId() === 'classic' ? trophyShelf(p) : collectionCard(p); }
// Jessica's friendship bracelet: a bead per table that fills as its facts get strong. Shown on My progress.
function bracelet(p){
  if (skinId() !== 'eras') return '';
  const done = ALL.filter(t => strongCount(p, t) === 12).length;
  const bx = t => 40 + (t - 1) * (560 / 11), by = t => { const u = (t - 1) / 11; return 30 + 4 * u * (1 - u) * 70; };
  let beads = '';
  ALL.forEach(t => {
    const k = strongCount(p, t), full = k === 12, x = bx(t), y = by(t), i = t - 1;
    beads += `<g><title>The ${t}s, ${ERAS[i].album} colours: ${k} of 12 facts strong</title>
      <rect x="${(x - 21).toFixed(1)}" y="${(y - 21).toFixed(1)}" width="42" height="42" rx="${full ? 21 : 10}" fill="${ERA_COLS[i]}" fill-opacity="${(.28 + .72 * k / 12).toFixed(2)}" stroke="var(--line)" stroke-width="2.5"/>
      <text x="${x.toFixed(1)}" y="${(y + 7).toFixed(1)}" text-anchor="middle" font-size="19" fill="${k >= 6 ? ERA_TEXT[i] : 'var(--ink)'}">${t}</text>
      ${full ? `<path d="${starPath(x + 17, y - 17, 8, 3.2)}" fill="var(--sun)" stroke="var(--line)" stroke-width="1.5" stroke-linejoin="round"/>` : ''}</g>`;
  });
  return `<div class="sticker journey"><div class="card-h"><h3>Your friendship bracelet</h3><span class="muted small">${done} of 12 beads sparkling</span></div>
    <svg viewBox="0 0 640 140" role="img" aria-label="Friendship bracelet with a bead for each times table; ${done} fully mastered">
      <path d="M8 20 Q320 ${30 + 2 * 70} 632 20" fill="none" stroke="var(--muted)" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round"/>${beads}</svg>
    <p class="muted small">Each bead is a times table in its album's colour, from Debut for the 1s to Showgirl for the 12s. It fills up as the facts get strong and gets a star when all twelve are.</p></div>`;
}
function trophyShelf(p){
  const badges = ALL.filter(t => p.badges['t' + t]);
  const rw = S.family.rewards || {};
  return `<div class="sticker"><div class="card-h"><h3>Trophy cabinet</h3><span class="muted small">From tests and Daily Challenges</span></div>
    <div class="shelf-row">${TIERS.map(t => `<div class="prize ${p.prizes[t.id] ? '' : 'locked'}">${medal(t.id, 60)}<b class="num">${p.prizes[t.id] || 0}</b><span>${t.name}</span><small>${t.min === 100 ? '100%' : t.min + '% or more'}</small>${rw[t.id] ? `<em>${esc(rw[t.id])}</em>` : ''}</div>`).join('')}</div>
    ${badges.length ? `<div class="badges">${badges.map(t => `<span class="chip">×${t} master</span>`).join('')}</div>` : ''}</div>`;
}
function weeklyCard(p, sessions, player){
  return `<div class="sticker"><h3>This week's challenges</h3><ul class="goals">${weeklyGoals(p, sessions, player).map(g => {
    const done = g.cur >= g.goal;
    return `<li class="${done ? 'done' : ''}"><div class="goal-top"><span>${esc(g.name)}</span><b class="num">${Math.min(g.cur, g.goal)} / ${g.goal}</b></div><div class="bar"><span style="width:${(Math.min(1, g.cur / g.goal) * 100).toFixed(1)}%"></span></div></li>`;
  }).join('')}</ul><p class="muted small">New challenges every Monday.</p></div>`;
}
function heatmap(p, compact){
  let h = `<div class="heat-wrap"><div class="heat ${compact ? 'compact' : ''}" role="img" aria-label="Times-table map: colour shows how well each fact is known"><span class="h">×</span>`;
  for (let b = 1; b <= 12; b++) h += `<span class="h">${b}</span>`;
  for (let a = 1; a <= 12; a++) {
    h += `<span class="h">${a}</span>`;
    for (let b = 1; b <= 12; b++) { const l = level(p.facts[fkey(a, b)]); h += `<span class="lv${l}" title="${a} × ${b} = ${a*b}: ${LEVEL_NAMES[l]}">${a*b}</span>`; }
  }
  return h + `</div></div><div class="legend">${LEVEL_NAMES.map((n, i) => `<span><i class="lv${i}"></i>${n}</span>`).join('')}</div>`;
}

function scrSetup(){
  const m = S.v.mode, c = S.v.cfg;
  const info = {
    practice:['Practise', 'No timer. Get one wrong and you get a trick.'],
    test:['Take a test', '70% Bronze, 80% Silver, 90% Gold, 100% Diamond.'],
    clock:['Beat the Clock', 'As many as you can in 60 seconds.']
  }[m];
  const best = m === 'clock' ? S.prog.bests[c.tables.slice().sort((a, b) => a - b).join('-') + '|' + ['mul', ...(c.miss ? ['miss'] : []), ...(c.div ? ['div'] : [])].join('')] : null;
  return `${topbar(m)}<section class="setup">
    <div><h1 class="mega sm">${info[0]}</h1><p class="lede">${info[1]}</p></div>
    <div class="sticker" style="display:grid;gap:18px">
      <div><div class="card-h"><h3>Which times tables?</h3><div class="row"><button class="btn ghost small" data-act="all-tables">All</button><button class="btn ghost small" data-act="clear-tables">Clear</button></div></div>
        <div class="chips">${ALL.map(t => { const st = t !== 1 && strongCount(S.prog, t) === 12; return `<button class="tchip ${c.tables.includes(t) ? 'on' : ''} ${st ? 'strong' : ''}" data-act="toggle-table" data-t="${t}" aria-pressed="${c.tables.includes(t)}" aria-label="${t} times table${st ? ', strong' : ', needs practice'}${tablePts(t) > 10 ? `, ${tablePts(t)} points a right answer` : ''}">×${t}${st ? ' \u2713' : ''}${tablePts(t) > 10 ? `<small class="up">+${(tablePts(t) - 10) * 10}%</small>` : ''}</button>`; }).join('')}</div>
        <p class="muted small" style="margin-top:8px">\u2713 = strong already.</p>
        <p class="muted small" style="margin-top:4px">Harder tables earn more ${ptsName()}.</p>
        ${S.v.suggested && c.tables.length === 1 && c.tables[0] === S.v.suggested ? `<p class="muted small" style="margin-top:10px">We picked the ${S.v.suggested}s for you.</p>` : ''}</div>
      ${m === 'test' ? `<div><h3>How many questions?</h3><div class="chips" style="margin-top:10px">${[10,20,30].map(n => `<button class="tchip ${c.count === n ? 'on' : ''}" data-act="set-count" data-n="${n}" aria-pressed="${c.count === n}">${n}</button>`).join('')}</div></div>` : ''}
      <div style="display:grid;gap:6px"><h3>Extra question types</h3>
        <button class="toggle" data-act="toggle-kind" data-k="miss" aria-pressed="${!!c.miss}"><span class="sw"></span>Missing numbers, like 6 × ? = 42</button>
        <button class="toggle" data-act="toggle-kind" data-k="div" aria-pressed="${!!c.div}"><span class="sw"></span>Division, like 42 ÷ 6 = ?</button></div>
      ${m === 'test' && c.tables.length ? (trophyTest(S.prog, c.tables) ? `<p class="callout mint">This test can win a trophy.</p>` : `<p class="callout">Already strong, so no trophy. Add ${(t => t ? `the ${t}s` : 'a table that is not strong yet')(focusTable(S.prog))} to win one.</p>`) : ''}
      ${m === 'clock' ? `<p class="callout ${best ? 'mint' : ''}">${best ? `Your best with these tables: <b>${best.score}</b> in 60 seconds (${fmtDate(best.t)}). Can you beat it?` : 'No score yet with these tables. Set your first record!'}</p>` : ''}
      <div><button class="btn big" data-act="start" ${c.tables.length ? '' : 'disabled'}>${c.tables.length ? 'Start' : 'Pick at least one table'}</button></div>
    </div></section>`;
}

function scrPlay(){
  const P = S.play, q = P.q;
  const cls = P.fb ? (P.fb.ok ? 'is-ok' : 'is-bad') : '';
  let info = '';
  if (P.mode === 'clock') {
    const left = Math.max(0, P.endsAt - Date.now());
    info = `<svg class="ring" viewBox="0 0 66 66" role="timer" aria-label="Seconds left"><circle class="bg" cx="33" cy="33" r="28"/><circle id="clock-fg" class="fg" cx="33" cy="33" r="28" stroke-dasharray="175.9" stroke-dashoffset="${(175.9 * (1 - left / 60000)).toFixed(1)}"/><text id="clock-t" x="33" y="41" text-anchor="middle">${Math.ceil(left / 1000)}</text></svg><span class="num">${P.correct} correct</span>`;
  } else if (P.total) {
    info = `<span>${MODE_NAMES[P.mode]} · Question ${Math.min(P.answers.length + 1, P.total)} of ${P.total}</span><span class="muted num" id="elapsed">${fmtDur(Date.now() - P.start)}</span>`;
  } else {
    info = `<span class="num">${P.answers.length} answered · ${P.correct} right</span>${P.streak >= 3 ? `<span class="chip">${P.streak} in a row</span>` : ''}<span class="muted num" id="elapsed">${fmtDur(Date.now() - P.start)}</span>`;
  }
  const dots = P.total ? `<div class="pdots" aria-hidden="true">${Array.from({length:P.total}, (_, i) => { const a = P.answers[i]; return `<i class="${a ? (a.ok ? 'y' : 'n') : (i === P.answers.length ? 'cur' : '')}"></i>`; }).join('')}</div>` : '';
  const qh = q.parts.map(x => x === '?' ? `<span class="slot" id="slot">${esc(P.input || '?')}</span>` : esc(x)).join(' ');
  const keys = [1,2,3,4,5,6,7,8,9].map(n => `<button data-act="key" data-k="${n}">${n}</button>`).join('');
  return `<header class="top"><div class="brand">${logo()}<span>${esc(skin().brand)}</span></div><div class="top-right"><span class="me-chip">${avatar(S.me, 34)}<span>${esc(S.me.name)}</span></span></div></header>
  <section class="play ${cls}">
    <div class="play-main">
      <div class="play-top"><div class="info">${info}</div><button class="btn ghost small" data-act="quit">${P.mode === 'practice' ? 'Finish' : 'Stop'}</button></div>
      ${dots}
      ${P.cfg && P.cfg.method ? (m => m ? `<div class="callout" style="margin-bottom:12px"><b>${esc(m.name)}.</b> ${esc(m.kid)}${(m.ex || [])[0] ? `<br><span class="muted small">For example: ${esc(m.ex[0])}</span>` : ''}</div>` : '')(allMethods().find(x => x.id === P.cfg.method)) : ''}
      <div class="qcard sticker"><div class="q" aria-label="${esc(qText(q))}">${qh}</div><div class="fb" role="status">${P.fb ? esc(P.fb.text) : ''}</div>${P.hint ? `<p class="hint">${esc(P.hint)}</p>` : ''}</div>
      ${P.mode === 'practice' && !P.hint ? `<div><button class="link" data-act="hint">Show me a trick</button></div>` : ''}
    </div>
    <div class="pad" role="group" aria-label="Number pad">${keys}<button class="del" data-act="key" data-k="back" aria-label="Delete">⌫</button><button data-act="key" data-k="0">0</button><button class="ok" data-act="key" data-k="ok" aria-label="Check my answer">✓</button></div>
  </section>`;
}

function resultItems(r){
  const id = skinId(); let h = '';
  for (const k of r.newItems || []) {
    if (id === 'eras') { const e = ERAS[trailDress(S.prog, k)]; h += `<div class="callout item-new">${dressPhoto(trailDress(S.prog, k), 'big')}<div><b>New dress: ${esc(e.album)}!</b> ${esc(e.look)}</div></div>`; }
    else if (id === 'trail') { const j = JUNGLE[k], t = TOOLS[j.tool]; h += `<div class="callout item-new">${toolSvg(j.tool, 54)}<div><b>New tool: ${esc(t.name)}!</b> ${esc(t.use)} Camp ${k + 1} reached: ${esc(j.camp.toLowerCase())}.</div></div>`; }
  }
  if (r.unlocked) h += gameApproved(S.me) ? `<div class="callout mint unlock"><div><b>You completed this week's trail!</b> The ${gameName()} is open: 30 minutes of play.</div><button class="btn" data-act="game">Play now</button></div>`
    : `<div class="callout"><b>You completed this week's trail!</b> Your ${gameName()} is waiting for a grown-up to approve it.</div>`;
  return h;
}
function scrResults(){
  const r = S.result, prize = r.prize ? tierById(r.prize) : null;
  let headline, big, sub;
  if (r.mode === 'clock') { headline = r.ab ? 'Stopped early' : (r.newBest ? 'New personal best!' : 'Time’s up!'); big = `${r.c}`; sub = `correct answers in ${r.ab ? fmtDur(r.ms) : '60 seconds'}${r.prevBest !== null && !r.newBest ? ` · your best is ${r.prevBest}` : ''}`; }
  else if (r.mode === 'practice') { headline = 'Practice finished'; big = `${r.c}/${r.n}`; sub = `right in ${fmtDur(r.ms)} · best run ${r.best} in a row`; }
  else { headline = r.ab ? 'Stopped early' : (prize ? `You won a ${prize.name}!` : 'Test finished'); big = `${r.pct}%`; sub = `${r.c} out of ${r.n} right in ${fmtDur(r.ms)}`; }
  const nt = (r.mode === 'test' || r.mode === 'daily') && !r.ab ? nextTier(r.pct) : null;
  const wrongA = r.answers.filter(a => !a.ok);
  const reward = prize && S.family.rewards && S.family.rewards[prize.id];
  const nextBtn = st => st ? `<button class="btn small" data-act="${st.act}" data-to="${st.mode}" data-mode="${st.mode}">Next: ${esc(st.name)}</button>` : '';
  const art = prize ? `<div class="res-medal pop">${medal(prize.id, 170)}<b>${prize.name}</b></div>`
    : `<div class="res-medal"><svg viewBox="0 0 64 64" width="150" height="150" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="color-mix(in srgb, var(--me) 30%, var(--card))" stroke="var(--line)" stroke-width="3"/><path d="${starPath(32, 32, 16, 7)}" fill="var(--me)" stroke="var(--line)" stroke-width="2.5" stroke-linejoin="round"/></svg></div>`;
  return `${topbar('')}<section class="results">
    ${art}
    <div class="res-body">
      <p class="eyebrow">${MODE_NAMES[r.mode]} · ${esc(tablesLabel(r))}</p>
      <h1 class="mega sm">${headline}</h1>
      <div><span class="score num">${big}</span> <span class="muted" style="font-weight:800">${sub}</span></div>
      <p class="callout mint">+${r.xp} ${ptsName()}${[r.uplift ? `${r.uplift} extra for harder tables` : '', r.dailyDone ? `50 bonus for completing the Daily Challenge` : ''].filter(Boolean).map((x, i, a) => (i ? '' : ' (including ') + x + (i === a.length - 1 ? ')' : ' and ')).join('')}</p>
      ${r.bonus && r.bonus.done ? `<p class="callout mint">Bonus Round complete! +${r.bonus.extra} extra ${ptsName()}.</p>`
        : r.bonus && r.bonus.step ? `<p class="callout">Bonus Round: ${r.bonus.step} of ${r.bonus.of} done. ${nextBtn(r.bonus.next)}</p>`
        : r.bonus && r.bonus.hint ? `<p class="callout">Do the Bonus Round in order. ${nextBtn(r.bonus.next)}</p>`
        : r.dailyDone ? `<p class="callout">Today's work done! Now the Bonus Round for double ${ptsName()}. ${nextBtn(bonusSteps()[0])}</p>` : ''}
      ${r.noTrophy ? `<p class="callout">No trophy: these tables are already strong. Next time add ${(t => t ? `the ${t}s` : 'a table that is not strong yet')(focusTable(S.prog))} to win one.</p>` : ''}
      ${reward ? `<p class="callout">Your reward for a ${prize.name}: <b>${esc(reward)}</b></p>` : ''}
      ${nt ? `<p class="callout">${r.pct < 70 ? 'So close to a prize.' : 'Brilliant work.'} Score ${nt.min}% next time to win a ${nt.name}.</p>` : ''}
      ${resultItems(r)}
      ${r.newBadges.map(t => `<p class="callout mint">You mastered the ${t}s! New badge in your cabinet.</p>`).join('')}
      ${wrongA.length ? `<div><h3 style="margin-bottom:8px">Facts to practise</h3><div class="mistakes">${wrongA.slice(0, 16).map(a => `<span>${esc(a.t.replace('?', a.a))} <small>you said ${a.g}</small></span>`).join('')}</div></div>` : (r.n >= 5 ? '<p class="callout mint">Every answer right. Amazing!</p>' : '')}
      <div class="row" style="margin-top:6px">
        <button class="btn big" data-act="again">Play again</button>
        ${wrongA.length ? '<button class="btn ghost" data-act="practise-mistakes">Practise these facts</button>' : ''}
        <button class="btn ghost" data-act="go" data-to="home">Home</button>
      </div>
    </div></section>`;
}

/* ---------- charts + reports ---------- */
function scoreChart(sessions){
  const pts = sessions.filter(s => (s.mode === 'test' || s.mode === 'daily') && !s.ab).slice(-30);
  if (!pts.length) return `<div class="empty-chart">Scores from tests and Daily Challenges will appear here.</div>`;
  const W = 820, H = 260, L = 40, R = 104, T = 14, B = 30, iw = W - L - R, ih = H - T - B;
  const x = i => L + (pts.length === 1 ? iw / 2 : i * iw / (pts.length - 1)), y = v => T + ih - v / 100 * ih;
  let g = '';
  [0, 50].forEach(v => { g += `<line x1="${L}" x2="${L + iw}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1.5"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}%</text>`; });
  TIERS.forEach(t => { g += `<line x1="${L}" x2="${L + iw}" y1="${y(t.min)}" y2="${y(t.min)}" stroke="var(--${t.id})" stroke-width="2" stroke-dasharray="5 5"/><text x="${L + iw + 8}" y="${y(t.min) + 4}">${t.name.split(' ')[0]} ${t.min}</text>`; });
  const line = pts.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s.pct).toFixed(1)}`).join('');
  const area = pts.length > 1 ? `<path d="${line}L${x(pts.length - 1).toFixed(1)} ${y(0)}L${x(0).toFixed(1)} ${y(0)}Z" fill="var(--me)" fill-opacity=".14"/>` : '';
  const dots = pts.map((s, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(s.pct).toFixed(1)}" r="${i === pts.length - 1 ? 7 : 5}" fill="${s.prize ? `var(--${s.prize})` : 'var(--card)'}" stroke="var(--line)" stroke-width="2"><title>${fmtDate(s.t)}: ${s.pct}% (${MODE_NAMES[s.mode]})</title></circle>`).join('');
  const last = pts[pts.length - 1];
  const xl = [0, pts.length - 1].filter((v, i, a) => a.indexOf(v) === i).map(i => `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="${pts.length === 1 ? 'middle' : (i ? 'end' : 'start')}">${fmtDate(pts[i].t)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scores from the last ${pts.length} tests and challenges; latest ${last.pct}%">${g}${area}<path d="${line}" fill="none" stroke="var(--line)" stroke-width="3" stroke-linejoin="round"/>${dots}<text class="lbl" x="${x(pts.length - 1).toFixed(1)}" y="${(y(last.pct) - 13).toFixed(1)}" text-anchor="${pts.length === 1 ? 'middle' : 'end'}" font-size="14">${last.pct}%</text>${xl}</svg>`;
}
function tableBars(p){
  const W = 440, H = 300, L = 38, R = 6, T = 22, B = 30, iw = W - L - R, ih = H - T - B, bw = iw / 12;
  const y = v => T + ih - v * ih;
  let g = '';
  [0, .5, 1].forEach(v => { g += `<line x1="${L}" x2="${L + iw}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1.5"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v * 100}%</text>`; });
  ALL.forEach((t, i) => {
    const st = tableStats(p, t), cx = L + i * bw + bw / 2, w = bw * .64;
    const tried = ALL.filter(k => { const f = p.facts[fkey(t, k)]; return f && f.n; }).length;
    if (st.acc === null || tried < 6) g += `<rect x="${(cx - w/2).toFixed(1)}" y="${y(.06)}" width="${w.toFixed(1)}" height="${(ih * .06).toFixed(1)}" fill="none" stroke="var(--muted)" stroke-dasharray="3 3" rx="3"/>`;
    else {
      const col = st.acc >= .9 ? 'var(--mint)' : st.acc >= .7 ? 'var(--sun)' : 'var(--tomato)';
      g += `<rect x="${(cx - w/2).toFixed(1)}" y="${y(st.acc).toFixed(1)}" width="${w.toFixed(1)}" height="${(st.acc * ih).toFixed(1)}" fill="${col}" stroke="var(--line)" stroke-width="2" rx="4"><title>×${t}: ${Math.round(st.acc*100)}% of ${st.n} answers right</title></rect><text class="lbl" x="${cx.toFixed(1)}" y="${(y(st.acc) - 6).toFixed(1)}" text-anchor="middle">${Math.round(st.acc * 100)}</text>`;
    }
    g += `<text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle">×${t}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Percentage of answers right for each times table">${g}</svg>`;
}
function calendar(sessions, logins){
  const act = new Set(sessions.map(s => dayStr(s.t))), lg = new Set(logins.map(t => dayStr(t)));
  const start = new Date(weekStart()); start.setDate(start.getDate() - 28);
  const today = dayStr(); let cells = '';
  for (let i = 0; i < 35; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i); const k = dayStr(d);
    const future = d.getTime() > Date.now();
    cells += `<i class="${act.has(k) ? 'a' : (lg.has(k) ? 'l' : '')} ${k === today ? 't' : ''}" title="${d.toLocaleDateString('en-GB', {weekday:'short', day:'numeric', month:'short'})}${act.has(k) ? ': played' : lg.has(k) ? ': signed in' : ''}" ${future ? 'style="opacity:.35"' : ''}>${d.getDate()}</i>`;
  }
  return `<div class="cal-h"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div><div class="cal">${cells}</div>
    <div class="legend"><span><i style="background:var(--me)"></i>Played</span><span><i style="border:2px solid var(--me);background:none"></i>Signed in only</span></div>`;
}
function histTable(sessions){
  const rows = sessions.slice(-40).reverse();
  if (!rows.length) return `<div class="empty-chart">Every practice, test and challenge will be listed here.</div>`;
  return `<div class="hist"><table><thead><tr><th>When</th><th>Activity</th><th>Tables</th><th>Score</th><th>Prize</th><th>Time</th></tr></thead><tbody>${rows.map(s => `<tr>
    <td>${fmtDateTime(s.t)}</td><td><span class="pill ${s.mode}">${MODE_NAMES[s.mode]}</span>${s.ab ? ' <span class="muted small">stopped early</span>' : ''}</td>
    <td>${esc(tablesLabel(s))}</td><td>${s.mode === 'clock' ? `${s.c} in ${s.ab ? fmtDur(s.ms) : '60s'}` : `${s.c}/${s.n} · ${s.pct}%`}</td>
    <td>${s.prize ? medal(s.prize, 26) : '<span class="muted">–</span>'}</td><td>${fmtDur(s.ms)}</td></tr>`).join('')}</tbody></table></div>`;
}
function reportBlocks(p, sessions, logins, player){
  const tests = sessions.filter(s => s.mode === 'test' && !s.ab), last10 = tests.slice(-10);
  const avg = last10.length ? Math.round(last10.reduce((s, x) => s + x.pct, 0) / last10.length) : null;
  const clockBest = Object.values(p.bests || {}).reduce((m, b) => Math.max(m, b.score), 0);
  const acc = p.totals.q ? Math.round(p.totals.c / p.totals.q * 100) : null;
  return `<div class="report">
    <div class="sumrow">
      ${stat(tests.length, 'tests taken')}${stat(avg === null ? '–' : avg + '%', 'average test score (last 10)')}${stat(clockBest || '–', 'best Beat the Clock')}
      ${stat(p.totals.q, 'questions answered')}${stat(acc === null ? '–' : acc + '%', 'answers right')}${stat(logins.length, 'sign-ins')}
    </div>
    <div class="sticker"><div class="card-h"><h3>Test and challenge scores</h3><span class="muted small">Dashed lines show the prize targets</span></div>${scoreChart(sessions)}</div>
    <div class="two">
      <div class="sticker"><div class="card-h"><h3>Right answers by table</h3><span class="muted small">Dashed: fewer than 6 of its facts tried yet</span></div>${tableBars(p)}</div>
      <div class="sticker"><div class="card-h"><h3>Times-table map</h3><span class="muted small">Strong = right 3 times in a row, under 5s</span></div>${heatmap(p, false)}</div>
    </div>
    <div class="two">
      <div class="sticker"><div class="card-h"><h3>Last five weeks</h3><span class="muted small">${streakDays(p)} day${streakDays(p) === 1 ? '' : 's'} in a row now</span></div>${calendar(sessions, logins)}</div>
      <div class="sticker"><div class="card-h"><h3>Prizes won</h3><span class="muted small">${prizeTotal(p)} in total</span></div>
        <div class="shelf-row" style="margin:0 0 14px">${TIERS.map(t => `<div class="prize ${p.prizes[t.id] ? '' : 'locked'}">${medal(t.id, 44)}<b class="num">${p.prizes[t.id] || 0}</b><span>${t.name}</span></div>`).join('')}</div>
        ${p.prizeLog.length ? `<p class="muted small" style="margin-bottom:6px">Most recent first</p><div class="prizelog">${p.prizeLog.slice(0, 24).map(x => `<span title="${fmtDate(x.t)}: ${x.pct}% in a ${MODE_NAMES[x.mode]}">${medal(x.tier, 34)}</span>`).join('')}</div>` : '<p class="muted">Score 70% or more in a test to win the first medal.</p>'}
        ${ALL.some(t => p.badges['t' + t]) ? `<div class="badges">${ALL.filter(t => p.badges['t' + t]).map(t => `<span class="chip">×${t} master</span>`).join('')}</div>` : ''}
      </div>
    </div>
    <div class="sticker"><div class="card-h"><h3>Everything ${player ? esc(player.name) + ' has' : 'you have'} done</h3><span class="muted small">Latest 40</span></div>${histTable(sessions)}</div>
  </div>`;
}
function scrProgress(){
  const p = S.prog, acc = p.totals.q ? Math.round(p.totals.c / p.totals.q * 100) + '%' : '–';
  return `${topbar('progress')}<div class="parent-head"><div><p class="eyebrow">My progress</p><h1 class="mega sm">How you're doing, ${esc(S.me.name)}</h1></div></div>
  <div class="report">
    <div class="sumrow">${stat(streakDays(p), streakDays(p) === 1 ? 'day in a row' : 'days in a row')}${stat(p.totals.q, 'questions answered')}${stat(acc, 'answers right')}${stat(prizeTotal(p), 'trophies won')}</div>
    <div class="two">${trophyShelf(p)}${weeklyCard(p, S.sessions, S.me)}</div>
    ${bracelet(p)}
    <div class="sticker"><div class="card-h"><h3>Your times-table map</h3><span class="muted small">Green means you know it: right 3 times in a row, quickly</span></div>${tablesSplit(p)}${heatmap(p, false)}</div>
    <div class="sticker"><div class="card-h"><h3>Everything you've done</h3><span class="muted small">Latest 40</span></div>${histTable(S.sessions)}</div>
  </div>`;
}

function dotsSvg(a, b){
  const c = 18, g = 7;
  const W = b * c + Math.floor((b - 1) / 5) * g + 8, H = a * c + Math.floor((a - 1) / 5) * g + 8;
  let s = '';
  for (let r = 0; r < a; r++) for (let k = 0; k < b; k++) s += `<circle cx="${4 + k*c + Math.floor(k/5)*g + c/2}" cy="${4 + r*c + Math.floor(r/5)*g + c/2}" r="6.5" fill="currentColor"/>`;
  return `<svg class="dots" viewBox="0 0 ${W} ${H}" role="img" aria-label="${a} rows of ${b} dots">${s}</svg>`;
}
function scrExplore(){
  const e = S.v.ex || (S.v.ex = {a:7, b:8, hl:null});
  const {a, b} = e, p = a * b;
  const isHl = (r, c) => e.hl === 'sq' ? r === c : (typeof e.hl === 'number' && (r * c) % e.hl === 0);
  let board = `<div class="heat-wrap"><div class="board"><span class="h">×</span>`;
  for (let c = 1; c <= 12; c++) board += `<span class="h">${c}</span>`;
  for (let r = 1; r <= 12; r++) {
    board += `<span class="h">${r}</span>`;
    for (let c = 1; c <= 12; c++) {
      const cls = r === a && c === b ? 'sel' : isHl(r, c) ? 'hl' : (r === a || c === b) ? 'ax' : '';
      board += `<button class="${cls}" data-act="ex-cell" data-a="${r}" data-b="${c}" aria-label="${r} times ${c}">${r * c}</button>`;
    }
  }
  board += `</div></div>`;
  const lv = level(S.prog.facts[fkey(a, b)]);
  const p0 = S.prog, cs = todayDone(p0) ? curStep(p0) : null, exDone = !!stepsDone(bonusToday(p0)).explore;
  const roundLine = cs && cs.k === 'explore' ? `<p class="callout" style="margin-top:10px">Tap ${EXPLORE_FACTS} different facts: ${bonusRound(p0).ex.length} of ${EXPLORE_FACTS}.</p>`
    : cs && exDone ? `<p class="callout mint" style="margin-top:10px">Explore done! <button class="btn small" data-act="${cs.act}" data-to="${cs.mode}" data-mode="${cs.mode}">${esc(cs.name)}</button></p>` : '';
  return `${topbar('explore')}<div class="parent-head"><div><p class="eyebrow">Explore</p><h1 class="mega sm">Tap any square</h1><p class="lede">Tap a square to see it as dots.</p>${roundLine}</div></div>
  <div class="explore">
    <div class="sticker" style="display:grid;gap:14px">
      ${board}
      <div><p class="eyebrow" style="margin-bottom:8px">Light up a pattern</p><div class="chips">
        <button class="tchip ${e.hl === 'sq' ? 'on' : ''}" data-act="ex-hl" data-v="sq" style="font-size:16px">Square numbers</button>
        ${[2,3,4,5,6,7,8,9,10,11,12].map(n => `<button class="tchip ${e.hl === n ? 'on' : ''}" data-act="ex-hl" data-v="${n}" style="font-size:16px" aria-label="Multiples of ${n}">${n}s</button>`).join('')}
      </div>${typeof e.hl === 'number' ? `<p class="muted small" style="margin-top:8px">Yellow = the ${e.hl}s. See the stripes?</p>` : e.hl === 'sq' ? '<p class="muted small" style="margin-top:8px">Squares sit on the diagonal.</p>' : ''}</div>
    </div>
    <div class="sticker">
      <p class="eyebrow">${LEVEL_NAMES[lv]} for you</p>
      <p class="fact-big num">${a} × ${b} = ${p}</p>
      ${dotsSvg(a, b)}
      <p style="font-weight:800">${a} row${a > 1 ? 's' : ''} of ${b} dot${b > 1 ? 's' : ''} makes ${p}. Turn it on its side and it is ${b} rows of ${a}: the same ${p} dots.</p>
      <div class="mistakes" style="margin:14px 0"><span>${b} × ${a} = ${p}</span><span>${p} ÷ ${a} = ${b}</span>${a !== b ? `<span>${p} ÷ ${b} = ${a}</span>` : ''}</div>
      <p class="hint" style="margin:0 0 16px">${esc(hint(a, b))}</p>
      <div class="row"><button class="btn" data-act="rec" data-mode="practice" data-tables="${uniq([a, b]).join(',')}">Practise the ${a === b ? a + 's' : a + 's and ' + b + 's'}</button></div>
    </div>
  </div>${methodsKids()}`;
}

function parentRecs(pl, d){
  const out = [], p = d.prog, last = Math.max(0, ...d.logins, ...d.sessions.map(s => s.t)), plan = planFor(pl);
  out.push(`Week ${challengeWeek()} of 52 · Year ${yearOf(pl)} · ${itemsOwned(p)} of ${TRAIL_STOPS} trophies on this week's trail.`);
  if (plan) out.push(`This week's plan${plan.focus && plan.focus.length ? `: the ${plan.focus.join('s, ')}s` : ''}. ${plan.why || ''}`.trim());
  if (!last) { out.push(`${pl.name} hasn't signed in yet.${pl.pinHash ? '' : ' They will choose a PIN the first time.'}`); return out; }
  const days = Math.floor((Date.now() - last) / 864e5);
  if (days >= 3) out.push(`${pl.name} hasn't played for ${days} days. Ten minutes a day works better than one long session.`);
  const wk = d.sessions.filter(s => s.t >= weekStart());
  out.push(`This week: ${wk.length} activit${wk.length === 1 ? 'y' : 'ies'}, ${wk.reduce((s, x) => s + x.n, 0)} questions, ${uniq(wk.map(s => dayStr(s.t))).length} different days.`);
  const scored = ALL.map(t => Object.assign({t}, tableStats(p, t))).filter(x => x.n >= 6).sort((a, b) => a.acc - b.acc);
  if (scored[0] && scored[0].acc < .9) out.push(`Weakest table: the ${scored[0].t}s (${Math.round(scored[0].acc * 100)}% right over ${scored[0].n} answers).`);
  const slow = ALLKEYS.filter(k => p.facts[k] && p.facts[k].c > 0 && p.facts[k].ms > 6000);
  if (slow.length) out.push(`${slow.length} fact${slow.length > 1 ? 's take' : ' takes'} longer than 6 seconds, the time allowed per question in the national Multiplication Tables Check: ${slow.slice(0, 5).map(fmtKey).join(', ')}.`);
  const tests = d.sessions.filter(s => s.mode === 'test' && !s.ab).slice(-5);
  if (tests.length >= 2) { const diff = tests[tests.length - 1].pct - tests[0].pct; out.push(`Last ${tests.length} tests: ${tests.map(t => t.pct + '%').join(', ')} (${diff >= 0 ? 'up' : 'down'} ${Math.abs(diff)} points).`); }
  out.push(`${Math.round(overallMastery(p) * 100)}% of the 144 facts are mastered; ${ALL.filter(t => strongCount(p, t) === 12).length} of 12 tables are fully strong.`);
  return out;
}
function scrParent(){
  const head = S.me ? topbar('') : brandBar();
  const back = S.me ? 'home' : 'login';
  if (!S.parentOK) {
    const setPin = !S.family.parentPinHash;
    if (setPin) return `${head}<section class="narrow"><div class="sticker form"><p class="eyebrow">Grown-ups area</p><h2>No grown-up PIN yet</h2>
      <p>Sam or Abbey: open Times Tables on your own phone or iPad, signed in with your Google account. The Grown-ups area opens there without a PIN. Choose a grown-up PIN in its settings, and it reaches this iPad the next time it has internet.</p>
      <div class="row"><button class="btn ghost" type="button" data-act="go" data-to="${back}">Back</button></div></div></section>`;
    return `${head}<section class="narrow"><form class="sticker form" data-form="${setPin ? 'parent-set' : 'parent-in'}">
      <p class="eyebrow">Grown-ups area</p><h2>${setPin ? 'Choose a grown-up PIN' : 'Enter the grown-up PIN'}</h2>
      <p class="muted">${setPin ? "This PIN opens every child's reports, sign-in history and the settings. Pick one the children don't know." : 'Reports, sign-in history and settings for every child.'}</p>
      <label for="pp1">PIN (4 to 8 numbers)</label><input id="pp1" name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" required data-autofocus>
      ${setPin ? '<label for="pp2">Type it again</label><input id="pp2" name="pin2" type="password" inputmode="numeric" autocomplete="off" maxlength="8" required>' : ''}
      ${S.err ? `<p class="err" role="alert">${esc(S.err)}</p>` : ''}
      <div class="row"><button class="btn" type="submit">${setPin ? 'Save PIN' : 'Open'}</button><button class="btn ghost" type="button" data-act="go" data-to="${back}">Back</button></div>
    </form></section>`;
  }
  const pls = S.players, pp = S.v.pp && pls.find(x => x.id === S.v.pp) || pls[0];
  const rw = S.family.rewards || {};
  const overview = pls.map(pl => {
    const d = S.pdata[pl.id];
    if (!d) return `<div class="sticker"><div class="ov-head">${avatar(pl, 52)}<h3>${esc(pl.name)}</h3></div><p class="muted">Loading…</p></div>`;
    const p = d.prog, last = Math.max(0, ...d.logins), tests = d.sessions.filter(s => s.mode === 'test' && !s.ab).slice(-10);
    const avg = tests.length ? Math.round(tests.reduce((s, x) => s + x.pct, 0) / tests.length) + '%' : '–';
    return `<div class="sticker"><div class="ov-head">${avatar(pl, 52)}<div><h3>${esc(pl.name)}</h3><p class="muted small">${last ? 'Last signed in ' + fmtDateTime(last) : 'Not signed in yet'}</p></div></div>
      <div class="ov-grid">
        <div><b>${d.logins.length}</b><span>sign-ins</span></div><div><b>${d.sessions.length}</b><span>activities</span></div>
        <div><b>${avg}</b><span>average test (last 10)</span></div><div><b>${Math.round(overallMastery(p) * 100)}%</b><span>facts mastered</span></div>
        <div><b>${streakDays(p)}</b><span>days in a row</span></div><div><b>${TIERS.map(t => p.prizes[t.id] || 0).join(' · ')}</b><span>bronze · silver · gold · diamond</span></div>
      </div></div>`;
  }).join('');
  const d = pp && S.pdata[pp.id];
  const detail = pp ? (d ? `<div class="ptabs">${pls.map(pl => `<button class="tab ${pl.id === pp.id ? 'on' : ''}" data-act="pp" data-id="${esc(pl.id)}">${esc(pl.name)}</button>`).join('')}</div>
    <div class="two" style="margin-bottom:24px">
      <div class="sticker"><p class="eyebrow">What to know about ${esc(pp.name)}</p><ul class="recs">${parentRecs(pp, d).map(t => `<li><p>${esc(t)}</p></li>`).join('')}</ul></div>
      <div class="sticker"><div class="card-h"><h3>Sign-in history</h3><span class="muted small">${d.logins.length} in total</span></div>
        ${d.logins.length ? `<ul class="logins">${d.logins.slice().reverse().slice(0, 100).map(t => `<li>${fmtDateTime(t)}</li>`).join('')}</ul>` : '<p class="muted">No sign-ins yet.</p>'}</div>
    </div>
    ${reportBlocks(d.prog, d.sessions, d.logins, pp)}` : '<p class="muted">Loading…</p>') : '';
  // The Settings tab: each player's settings, adding a player, rewards, the grown-up PIN and this device.
  function settingsTab(){ return `
    <div class="settings">
      ${pls.map(pl => `<form class="sticker form" data-form="edit-player" data-id="${esc(pl.id)}">
        <div class="ov-head">${avatar(pl, 44)}<h3>${esc(pl.name)}</h3></div>
        <label for="ep-n-${esc(pl.id)}">Name</label><input id="ep-n-${esc(pl.id)}" name="name" value="${esc(pl.name)}" required>
        <label for="ep-a-${esc(pl.id)}">Age</label><input id="ep-a-${esc(pl.id)}" name="age" type="number" min="4" max="16" value="${esc(pl.age || '')}">
        <label for="ep-y-${esc(pl.id)}">School year: <b>Year ${yearOf(pl)}</b></label>
        <input id="ep-y-${esc(pl.id)}" name="year" type="range" min="3" max="8" step="1" value="${yearOf(pl)}" oninput="this.previousElementSibling.querySelector('b').textContent = 'Year ' + this.value">
        <p class="muted small">Sets the question types: Year 4 missing numbers, Year 5 division, Year 6 ×10, Year 7 and 8 ×100.</p>
        <label for="ep-e-${esc(pl.id)}">Google account</label><input id="ep-e-${esc(pl.id)}" name="email" type="email" value="${esc(pl.email || '')}" placeholder="Their iPad opens on their name">
        <label for="ep-t-${esc(pl.id)}">App theme</label><select id="ep-t-${esc(pl.id)}" name="theme">${Object.entries(SKINS).map(([k, v]) => `<option value="${k}" ${(pl.theme || 'classic') === k ? 'selected' : ''}>${esc(v.label || 'Classic exercise book')}</option>`).join('')}</select>
        <label>Colour</label>${swatches('ep-c-' + pl.id, pl.color)}
        <p class="muted small">${pl.pinHash ? 'PIN is set.' : `No PIN yet. ${esc(pl.name)} chooses one at first sign-in.`}</p>
        <div class="row"><button class="btn" type="submit">Save</button>${pl.pinHash ? `<button class="btn ghost" type="button" data-act="reset-pin" data-id="${esc(pl.id)}">${S.v.confirmReset === pl.id ? 'Tap again to reset' : 'Reset PIN'}</button>` : ''}</div>
      </form>`).join('')}
      <form class="sticker form" data-form="add-player"><h3>Add a player</h3>
        <label for="ap-n">Name</label><input id="ap-n" name="name" required>
        <label for="ap-a">Age</label><input id="ap-a" name="age" type="number" min="4" max="16">
        <label for="ap-e">Google account (optional)</label><input id="ap-e" name="email" type="email" placeholder="Their iPad opens on their name">
        <label for="ap-t">App theme</label><select id="ap-t" name="theme">${Object.entries(SKINS).map(([k, v]) => `<option value="${k}" ${('classic' || 'classic') === k ? 'selected' : ''}>${esc(v.label || 'Classic exercise book')}</option>`).join('')}</select>
        <label>Colour</label>${swatches('ap-c', COLORS[pls.length % COLORS.length][0])}
        <button class="btn" type="submit">Add player</button></form>
      <form class="sticker form" data-form="rewards"><h3>Real-life rewards</h3><p class="muted small">Optional. Shown in the trophy cabinet and when a prize is won.</p>
        ${TIERS.map(t => `<label for="rw-${t.id}">${t.name} (${t.min === 100 ? '100%' : t.min + '%+'})</label><input id="rw-${t.id}" name="${t.id}" maxlength="80" value="${esc(rw[t.id] || '')}" placeholder="${{bronze:'A sticker for the chart', silver:'15 minutes extra screen time', gold:'Choose Friday night film', diamond:'Trip for ice cream'}[t.id]}">`).join('')}
        <button class="btn" type="submit">Save rewards</button></form>
      <form class="sticker form" data-form="parent-change"><h3>${S.family.parentPinHash ? 'Change the grown-up PIN' : 'Set a grown-up PIN'}</h3><p class="muted small">Opens this area on the children's iPads. Your own devices don't need it.</p>
        <label for="pc1">New PIN (4 to 8 numbers)</label><input id="pc1" name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" required>
        <label for="pc2">Type it again</label><input id="pc2" name="pin2" type="password" inputmode="numeric" autocomplete="off" maxlength="8" required>
        <button class="btn" type="submit">Change PIN</button></form>
    </div>
    <h2 class="sec">This device</h2>${devicePanel()}`; }
  const GTABS = [['family', 'Family report'], ['methods', 'Ways to learn'], ['games', 'Reward games'], ['try', 'Try it yourself'], ['settings', 'Settings']];
  const gt = GTABS.some(t => t[0] === S.gtab) ? S.gtab : 'family';
  const waiting = pls.filter(pl => (pl.theme === 'eras' || pl.theme === 'trail') && !gameApproved(pl)).length;
  return `${head}<section>
    <div class="parent-head"><div><p class="eyebrow">Grown-ups area</p><h1 class="mega sm">${GTABS.find(t => t[0] === gt)[1]}</h1></div>
      <div class="row">${isParentDevice() ? '' : '<button class="btn ghost" data-act="parent-lock">Lock</button>'}<button class="btn ghost" data-act="go" data-to="${back}">Back to the app</button></div></div>
    <nav class="tabs" aria-label="Grown-ups area"><div class="tabs-in">${GTABS.map(([k, l]) => `<button class="tab ${gt === k ? 'on' : ''}" data-act="gtab" data-t="${k}" ${gt === k ? 'aria-current="page"' : ''}>${l}${k === 'games' && waiting ? ` (${waiting} waiting)` : ''}</button>`).join('')}</div></nav>
    ${S.okMsg ? `<p class="callout mint" role="status" style="margin-bottom:18px">${esc(S.okMsg)}</p>` : ''}
    ${gt === 'family' ? (pls.length ? `<div class="overview">${overview}</div><h2 class="sec">Reports</h2>${detail}` : '<p class="callout" style="margin-bottom:18px">Add the first player in Settings to get started.</p>') : ''}
    ${gt === 'methods' ? methodsParent() : ''}
    ${gt === 'games' ? gamesParent(pls) : ''}
    ${gt === 'try' ? demosParent(pls) : ''}
    ${gt === 'settings' ? settingsTab() : ''}
    ${S.v.lightbox ? `<div class="jg-over lightbox" data-act="lightbox"><img data-photo="${esc(S.v.lightbox)}" alt=""></div>` : ''}
  </section>`;
}
function devicePanel(){
  const d = Device.get() || {};
  return `<div class="sticker form" style="max-width:640px">
    <p>Signed in with Google as <b>${esc(d.email || 'nobody')}</b>${d.role ? ` (${d.role === 'parent' ? 'grown-up' : 'child'})` : ''}.</p>
    <p class="muted small">${esc(syncText())}${Sync.status === 'error' && Sync.err ? ' · ' + esc(Sync.err) : ''}</p>
    <div class="row">${Sync.status === 'signed-out' ? '<button class="btn" type="button" data-act="google">Sign in with Google again</button>' : '<button class="btn" type="button" data-act="sync-now">Sync now</button>'}
      <button class="btn ghost" type="button" data-act="device-out">${S.v.confirmOut ? 'Tap again to sign out' : 'Sign this device out'}</button></div>
    <p class="muted small">Saved here first, then copied online when there’s internet.</p>
  </div>`;
}
const swatches = (name, cur) => `<div class="swatches" role="radiogroup">${COLORS.map(([c, l]) => `<label title="${l}"><input type="radio" name="color" value="${c}" ${c === cur ? 'checked' : ''} aria-label="${l}"><span style="--c:var(--${c})"></span></label>`).join('')}</div>`;

// Reward games, for the grown-ups' approval: every picture each game uses, a Play it demo, and Approve. A child's game
// opens at the end of their trail only once approved (games/<id>).
function gamesParent(pls){
  const kids = pls.filter(pl => pl.theme === 'eras' || pl.theme === 'trail');
  if (!kids.length) return '';
  const thumb = (p, label) => `<button class="look" style="--era:var(--card2);--era-t:var(--ink)" data-act="lightbox" data-p="${p}"><img data-photo="${p}" alt=""><span>${esc(label)}</span></button>`;
  return `<h2 class="sec">Reward games: for your approval</h2>
    <p class="muted" style="margin:-6px 0 16px">Every picture the games use, made from the children's own photos and kept private to the family. A child's game opens at the end of their trail only once a grown-up has approved it here. Tap a picture to see it full size.</p>
    ${kids.map(pl => {
      const eras = pl.theme === 'eras', ok = S.gameOK[pl.id] || {}, approved = ok.status === 'approved';
      const pics = eras
        ? ERAS.flatMap((e, k) => [['a', 'singing'], ['d', 'dancing'], ['t', 'twirling']].map(([s, w]) => thumb(`stage/era${pad2(k)}-${s}.jpg`, `${e.era} · ${w}`)))
        : [...[['start', 'Start of a level'], ['chop', 'Chopping: right answer'], ['miss', 'Missed: wrong answer'], ['hold', 'Holding ground'], ['gold', 'Found the gold'], ['chase', 'Run for the boat'], ['run', 'Running with the gold'], ['win', 'Made it to the boat'], ['caught', 'Caught']].map(([n, w]) => thumb(`jungle/${n}.jpg`, w)),
           ...['jungle1', 'jungle2', 'path', 'rock', 'gold', 'river', 'boat', 'snake', 'panther', 'anaconda'].map(n => thumb(`jungle/tiles/${n}.jpg`, 'Board: ' + n))];
      return `<div class="sticker" style="margin-bottom:20px"><div class="card-h"><h3>${esc(pl.name)}'s ${eras ? 'Eras Stadium Show' : 'Jungle Gold Run'}</h3>${approved ? '<span class="pill approved">Approved</span>' : '<span class="pill">Waiting for approval</span>'}</div>
        <p>${eras ? 'She picks a dress and a song, then sings on a stadium stage to an original tune. Every right answer brings more fans in; 80,000 fans wins the MTV Award.' : 'He chops a path to the gold, one right answer per swing, then runs it back to the boat before the snakes, panthers and anacondas catch him.'}</p>
        <div class="looks" style="grid-template-columns:repeat(auto-fill,minmax(76px,1fr))">${pics.join('')}</div>
        <div class="row" style="margin-top:14px"><button class="btn small ghost" data-act="demo" data-id="${esc(pl.id)}" data-what="game">Play it</button>${approved ? `<span class="muted small">Approved${ok.by ? ' by ' + esc(ok.by) : ''}${ok.at ? ' ' + ago(ok.at) : ''}.</span><button class="btn small ghost" data-act="game-unapprove" data-id="${esc(pl.id)}">Take approval back</button>` : `<button class="btn small" data-act="game-approve" data-id="${esc(pl.id)}">Approve for ${esc(pl.name)}</button>`}</div>
      </div>`;
    }).join('')}`;
}
async function setGameApproval(id, status){
  const pl = S.players.find(x => x.id === id); if (!pl) return;
  const doc = {status, by: (Device.get() || {}).name || '', at: Date.now()};
  try { await Store.set('games/' + id, doc); S.gameOK[id] = doc; toast(status === 'approved' ? `${pl.name}'s game is approved.` : `${pl.name}'s game is on hold.`); } catch { saveFail(); }
  render();
}
// Try it yourself: a grown-up plays as a child on a copy of their data. Nothing is saved, and the reward game opens
// without a trail (Sam, 24 Oct 2026: "give the grown ups demos to test").
function demosParent(pls){
  if (!pls.length) return '';
  return `<h2 class="sec">Try it yourself</h2>
    <p class="muted" style="margin:-6px 0 16px">Play anything as ${esc(pls.map(p => p.name).join(' or '))} to see what they see. Nothing you do here is saved to their progress, and the reward games open without a trail.</p>
    <div class="settings">${pls.map(pl => {
      const sk = SKINS[pl.theme] || SKINS.classic, game = pl.theme === 'eras' ? 'Eras Stadium Show' : pl.theme === 'trail' ? 'Jungle Gold Run' : null;
      const b = (what, label, cls = 'ghost') => `<button class="btn small ${cls}" data-act="demo" data-id="${esc(pl.id)}" data-what="${what}">${esc(label)}</button>`;
      return `<div class="sticker"><div class="ov-head">${avatar(pl, 44)}<h3>As ${esc(pl.name)}</h3></div>
        <div class="row" style="margin-top:12px">${b('daily', sk.daily, '')}${b('practice', 'Practise')}${b('test', 'Take a test')}${b('clock', 'Beat the Clock')}${b('explore', 'Explore')}${game ? b('game', game, '') : ''}</div></div>`;
    }).join('')}</div>`;
}
async function startDemo(id, what){
  const pl = S.players.find(x => x.id === id); if (!pl || S.demo) return;
  const d = await loadPlayerData(id);
  S.demo = {me: S.me, prog: S.prog, sessions: S.sessions, logins: S.logins, logCur: S.logCur};
  S.me = pl; applySkin(pl);
  S.prog = clone(d.prog); S.sessions = d.sessions.slice(); S.logins = d.logins.slice();
  S.logCur = {player: id, month: monthStr(), logins: [], sessions: []};
  S.v = {}; S.okMsg = null;
  if (what === 'game') startGame();
  else if (what === 'daily') startDaily();
  else if (what === 'explore') go('explore');
  else openSetup(what);
}
function endDemo(){
  const d = S.demo; if (!d) return;
  S.demo = null; S.gtab = 'try';
  if (S.play) { clearInterval(S.play.timer); S.play = null; }
  S.me = d.me; S.prog = d.prog; S.sessions = d.sessions; S.logins = d.logins; S.logCur = d.logCur;
  applySkin(S.me); S.v = {};
  setTimeout(loadParentData, 0);
}
async function loadParentData(){
  await loadPlayers();
  await Promise.all(S.players.map(async pl => { try { S.pdata[pl.id] = await loadPlayerData(pl.id); } catch {} }));
  if (S.screen === 'parent') render();
}

/* ---------- family photos ---------- */
// Pictures of the children made for the games (Jessica's stage photos) sit in the private family-photos bucket, never in
// this public repo. Each device downloads a picture once and keeps it in its own cache, so the games work offline after.
const PHOTO_CACHE = 'ttc-photos-v1', photoUrls = new Map();
async function familyPhoto(path){
  if (photoUrls.has(path)) return photoUrls.get(path);
  const key = new Request(location.origin + '/__family-photos/' + path), cache = await caches.open(PHOTO_CACHE);
  let res = await cache.match(key);
  if (!res) {
    const c = sbClient(); if (!c) throw new Error('offline');
    const {data, error} = await c.storage.from('family-photos').download(path);
    if (error) throw error;
    res = new Response(data, {headers: {'Content-Type': data.type || 'image/jpeg'}});
    await cache.put(key, res.clone());
  }
  const url = URL.createObjectURL(await res.blob());
  photoUrls.set(path, url);
  return url;
}
const dressPhoto = (d, cls = '') => `<img class="dress-ph ${cls}" data-photo="stage/era${pad2(d)}-a.jpg" alt="">`;
// The how-it-works video (24 Oct 2026). It shows the children's photos, so it sits in the private family bucket like them,
// and plays in an overlay outside the app's own markup so the login screen's refreshes never restart it.
function showHowVideo(){
  if (document.querySelector('.vid-over')) return;
  const o = document.createElement('div'); o.className = 'vid-over';
  o.innerHTML = '<div class="vid-box"><button class="btn ghost small vid-x" type="button">Close</button><p class="vid-msg">Loading the video\u2026</p></div>';
  document.body.appendChild(o);
  const close = () => { const v = o.querySelector('video'); if (v) v.pause(); o.remove(); };
  o.addEventListener('click', e => { if (e.target === o || e.target.classList.contains('vid-x')) close(); });
  familyPhoto('video/how-it-works.mp4').then(url => {
    const v = document.createElement('video'); v.src = url; v.controls = true; v.autoplay = true; v.playsInline = true;
    o.querySelector('.vid-msg').replaceWith(v);
  }).catch(() => { o.querySelector('.vid-msg').textContent = 'The video needs the internet the first time. Connect to Wi-Fi and try again.'; });
}
function hydratePhotos(){ app.querySelectorAll('img[data-photo]').forEach(im => familyPhoto(im.dataset.photo).then(u => { im.src = u; }).catch(() => {})); }

/* ---------- reward games (games.js) ---------- */
let gameTimer = null, gameInst = null;
function audioCtx(){ actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; }
function gameQuestion(){
  const pool = weakPairs(S.prog, 24), [a, b] = pool[Math.floor(Math.random() * pool.length)];
  const [x, y] = Math.random() < .5 ? [a, b] : [b, a], ans = x * y, opts = new Set([ans]);
  for (const d of [x, -x, y, -y, 1, -1, 10, -10, 2].sort(() => Math.random() - .5)) { if (opts.size >= 3) break; if (ans + d > 0) opts.add(ans + d); }
  return {text:`${x} × ${y}`, ans, choices:[...opts].sort(() => Math.random() - .5)};
}
function scrGame(){
  return `<header class="top"><div class="brand">${logo()}<span>${gameName()}</span></div>
    <div class="top-right"><span class="sync" id="game-clock">${S.demo ? 'Demo: nothing is saved' : Math.ceil((GAME_MS - gameUsed(S.prog)) / 60000) + ' min left'}</span><button class="btn ghost small" data-act="go" data-to="home">${S.demo ? 'Back to the Grown-ups area' : 'Finish for now'}</button></div></header>
    <div id="game-host" class="game-host"></div>`;
}
function startGame(){
  const p = S.prog, demo = !!S.demo;
  if (!window.TTCGames || (!demo && !gameOpen(p))) { go('home'); return; }
  if (!demo && p.gameTrail !== trailStart(p)) { p.gameTrail = trailStart(p); p.gameMs = 0; }
  p.game = p.game || {};
  S.screen = 'game'; render(); scrollTo(0, 0);
  const api = {ask: gameQuestion, sound, audio: audioCtx, photo: photoOk(S.me.photo) ? S.me.photo : null, picture: familyPhoto, dressSvg, eras: ERAS, state: demo ? {} : p.game, save: () => { if (!demo) saveProg().catch(saveFail); }};
  gameInst = (skinId() === 'eras' ? window.TTCGames.stage : window.TTCGames.jungle)(document.getElementById('game-host'), api);
  if (demo) return;   // a grown-up's demo: no 30-minute clock, nothing saved
  let ticks = 0;
  gameTimer = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    p.gameMs = (p.gameMs || 0) + 1000; ticks++;
    const left = GAME_MS - p.gameMs, el = document.getElementById('game-clock');
    if (el) el.textContent = `${Math.max(1, Math.ceil(left / 60000))} min left`;
    if (left <= 0) {
      stopGame(); p.trailReset = Date.now(); p.gameTrail = trailStart(p); p.gameMs = 0; saveProg().catch(saveFail);
      go('home'); toast("That's your 30 minutes! A new trail starts now: win 7 trophies to play again.");
    } else if (ticks % 15 === 0) saveProg().catch(saveFail);
  }, 1000);
}
function stopGame(){ clearInterval(gameTimer); gameTimer = null; if (gameInst) { try { gameInst.destroy(); } catch {} gameInst = null; } }

/* ---------- render ---------- */
const SCREENS = {game:scrGame, gate:scrGate, loading:scrLoading, login:scrLogin, home:scrHome, setup:scrSetup, play:scrPlay, results:scrResults, progress:scrProgress, explore:scrExplore, parent:scrParent};
let lastScreen = null;
function render(){
  app.innerHTML = SCREENS[S.screen]();
  hydratePhotos();
  if (S.screen !== lastScreen || S.focusNext) {
    const af = app.querySelector('[data-autofocus]'); if (af) af.focus();
    S.focusNext = false;
  }
  lastScreen = S.screen;
}

const A = {
  go: el => go(el.dataset.to),
  google: async () => {
    const c = sbClient();
    if (!c) { toast("The sign-in part of the app didn't load. Connect to Wi-Fi and reopen the app."); return; }
    if (!navigator.onLine) { toast('Connect to Wi-Fi for the first sign-in.'); return; }
    S.gateErr = null;
    const {error} = await c.auth.signInWithOAuth({provider:'google', options:{redirectTo: location.origin + location.pathname, queryParams:{prompt:'select_account'}}});
    if (error) { S.gateErr = error.message; render(); }
  },
  'sync-now': async () => { await Sync.run(); render(); toast(Sync.status === 'ok' ? 'Synced.' : syncText()); },
  'device-out': async () => {
    if (!S.v.confirmOut) { S.v.confirmOut = true; render(); return; }
    S.v.confirmOut = false;
    try { const c = sbClient(); if (c) await c.auth.signOut(); } catch {}
    Device.clear(); S.parentOK = false; S.me = null; S.prog = null; ss.del('me'); applySkin(null);
    S.screen = 'gate'; render();
  },
  setup: el => openSetup(el.dataset.mode),
  item: el => { const i = +el.dataset.i; S.v.item = S.v.item === i ? undefined : i; render(); },
  'pick-player': el => { S.v.loginFor = el.dataset.id; S.v.email = ''; S.err = null; S.focusNext = true; render(); },
  'toggle-table': el => { const t = +el.dataset.t, c = S.v.cfg; c.tables = c.tables.includes(t) ? c.tables.filter(x => x !== t) : [...c.tables, t].sort((a, b) => a - b); render(); },
  'all-tables': () => { S.v.cfg.tables = ALL.slice(); render(); },
  'clear-tables': () => { S.v.cfg.tables = []; render(); },
  'set-count': el => { S.v.cfg.count = +el.dataset.n; render(); },
  'toggle-kind': el => { const k = el.dataset.k; S.v.cfg[k] = !S.v.cfg[k]; render(); },
  start: () => startPlay(S.v.mode, S.v.cfg),
  'start-daily': () => startDaily(),
  howvid: () => showHowVideo(),
  'method-step': el => startMethodStep(el.dataset.mode),
  key: el => { press(el.dataset.k); },
  hint: () => { const P = S.play; if (P) { P.hint = hint(P.q.a, P.q.b); render(); } },
  quit: () => quit(),
  again: () => { const r = S.result; if (r.mode === 'daily') startDaily(); else startPlay(r.mode, r.cfg, r.poolPairs); },
  'practise-mistakes': () => { const r = S.result; const pairs = uniq(r.answers.filter(a => !a.ok).map(a => a.k)).map(k => k.split('x').map(Number)); startPlay('practice', {tables: uniq(pairs.flat()), miss:false, div:false}, pairs); },
  rec: el => {
    const m = el.dataset.mode, t = (el.dataset.tables || '').split(',').filter(Boolean).map(Number);
    if (m === 'explore') go('explore'); else if (m === 'daily') startDaily(); else openSetup(m, t);
  },
  sound: () => { S.sound = !S.sound; ls.set('sound', S.sound); render(); },
  logout: () => { if (S.demo) { go('home'); return; } if (S.play) { clearInterval(S.play.timer); S.play = null; } S.me = null; S.prog = null; S.parentOK = false; ss.del('me'); S.v = {}; applySkin(null); go('login'); },
  'ex-cell': el => { S.v.ex.a = +el.dataset.a; S.v.ex.b = +el.dataset.b; exploreLooked(fkey(S.v.ex.a, S.v.ex.b)); render(); },
  'ex-hl': el => { const v = el.dataset.v === 'sq' ? 'sq' : +el.dataset.v; S.v.ex.hl = S.v.ex.hl === v ? null : v; render(); },
  'parent-lock': () => { S.parentOK = false; go(S.me ? 'home' : 'login'); },
  pp: el => { S.v.pp = el.dataset.id; render(); },
  gtab: el => { S.gtab = el.dataset.t; S.okMsg = null; render(); scrollTo(0, 0); },
  game: () => startGame(),
  demo: el => startDemo(el.dataset.id, el.dataset.what),
  'game-approve': el => setGameApproval(el.dataset.id, 'approved'),
  'game-unapprove': el => setGameApproval(el.dataset.id, 'pending'),
  lightbox: el => { S.v.lightbox = el.dataset.p || null; render(); },
  method: async el => {
    const id = el.dataset.id, status = el.dataset.s, m = allMethods().find(x => x.id === id);
    if (!m || !['approved', 'rejected'].includes(status)) return;
    const doc = Object.assign(m.custom ? {...m} : {}, {status, by: (Device.get() || {}).name || '', at: Date.now()});
    try { await Store.set('methods/' + id, doc); S.methods[id] = doc; toast(status === 'approved' ? `${m.name} approved: it shows in Explore for the children.` : `${m.name} rejected: the children won't see it.`); } catch { saveFail(); }
    render();
  },
  'reset-pin': async el => {
    const id = el.dataset.id;
    if (S.v.confirmReset !== id) { S.v.confirmReset = id; render(); return; }
    const pl = S.players.find(x => x.id === id); delete pl.pinHash; S.v.confirmReset = null;
    try { await savePlayer(pl); S.okMsg = `${pl.name}'s PIN is reset. They will choose a new one at their next sign-in.`; } catch { saveFail(); }
    render();
  }
};
const F = {
  async login(f){
    const p = S.players.find(x => x.id === f.dataset.id); if (!p) return;
    const pin = f.pin.value.trim();
    const fail = m => { S.err = m; S.focusNext = true; render(); };
    if (!/^\d{4}$/.test(pin)) return fail('Your PIN needs exactly 4 numbers.');
    const h = await hashPin(p.id, pin);
    if (!p.pinHash) {
      if (f.pin2.value.trim() !== pin) return fail("The two PINs don't match. Type them again.");
      p.pinHash = h;
      try { await savePlayer(p); } catch { return fail("Couldn't save your PIN on this iPad."); }
    } else if (p.pinHash !== h) {
      return fail("That PIN isn't right. Try again, or ask a grown-up to reset it.");
    }
    S.err = null;
    await signIn(p, true);
  },
  async 'parent-set'(f){
    const pin = f.pin.value.trim();
    if (!/^\d{4,8}$/.test(pin)) { S.err = 'Use 4 to 8 numbers.'; return render(); }
    if (f.pin2.value.trim() !== pin) { S.err = "The two PINs don't match."; return render(); }
    S.family.parentPinHash = await hashPin('parent', pin);
    try { await Store.set('settings/family', S.family); } catch { saveFail(); return; }
    S.err = null; S.parentOK = true; render(); loadParentData();
  },
  async 'parent-in'(f){
    const h = await hashPin('parent', f.pin.value.trim());
    if (h !== S.family.parentPinHash) { S.err = "That PIN isn't right."; return render(); }
    S.err = null; S.parentOK = true; render(); loadParentData();
  },
  async 'parent-change'(f){
    const pin = f.pin.value.trim();
    if (!/^\d{4,8}$/.test(pin) || f.pin2.value.trim() !== pin) { toast('Use 4 to 8 numbers, typed the same twice.'); return; }
    S.family.parentPinHash = await hashPin('parent', pin);
    try { await Store.set('settings/family', S.family); S.okMsg = 'Grown-up PIN changed.'; } catch { saveFail(); }
    render();
  },
  async 'edit-player'(f){
    const pl = S.players.find(x => x.id === f.dataset.id); if (!pl) return;
    const email = f.email.value.trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast("That email doesn't look right."); return; }
    pl.name = f.name.value.trim() || pl.name; pl.age = +f.age.value || null; pl.email = email || null;
    const c = f.querySelector('input[name=color]:checked'); if (c) pl.color = c.value;
    pl.theme = f.theme.value; pl.year = +f.year.value || null;
    try { await savePlayer(pl); S.okMsg = `Saved ${pl.name}.`; } catch { saveFail(); }
    if (S.me && S.me.id === pl.id) { S.me = pl; applySkin(pl); }
    render();
  },
  async 'add-player'(f){
    const name = f.name.value.trim(); if (!name) return;
    const email = f.email.value.trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast("That email doesn't look right."); return; }
    let base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'player', id = base, i = 2;
    while (S.players.some(x => x.id === id)) id = base + '-' + i++;
    const c = f.querySelector('input[name=color]:checked');
    const pl = {id, name, age: +f.age.value || null, email: email || null, color: c ? c.value : 'sky', theme: f.theme.value, created: Date.now()};
    try { await savePlayer(pl); } catch { saveFail(); return; }
    S.players.push(pl); S.players.sort((a, b) => a.name.localeCompare(b.name));
    S.pdata[id] = {prog: defaultProg(id), logs:[], sessions:[], logins:[]};
    S.okMsg = `Added ${name}. They can sign in from the start screen.`; render();
  },
  async 'add-method'(f){
    const name = f.name.value.trim(), kid = f.kid.value.trim(), ex = f.ex.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 5);
    if (!name || !kid) return;
    const who = (Device.get() || {}).name || '', now = Date.now(), id = 'own-' + now.toString(36);
    const doc = {id, custom:true, name, kid, ex, author: who, made: now, status:'approved', by: who, at: now};
    try { await Store.set('methods/' + id, doc); S.methods[id] = doc; toast(`${name} added: it shows in Explore for the children.`); } catch { saveFail(); }
    render();
  },
  async rewards(f){
    S.family.rewards = Object.fromEntries(TIERS.map(t => [t.id, f[t.id].value.trim()]));
    try { await Store.set('settings/family', S.family); S.okMsg = 'Rewards saved.'; } catch { saveFail(); }
    render();
  }
};

app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el || !app.contains(el)) return;
  const fn = A[el.dataset.act]; if (fn) { e.preventDefault(); fn(el, e); }
});
app.addEventListener('submit', e => {
  e.preventDefault();
  const fn = F[e.target.dataset.form]; if (fn) fn(e.target);
});
document.addEventListener('keydown', e => {
  if (S.screen !== 'play' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.matches && e.target.matches('input,textarea,select')) return;
  if (/^[0-9]$/.test(e.key)) { press(e.key); e.preventDefault(); }
  else if (e.key === 'Backspace') { press('back'); e.preventDefault(); }
  else if (e.key === 'Enter') { press('ok'); e.preventDefault(); }
});

async function checkFamily(c, session){
  const email = ((session.user && session.user.email) || '').toLowerCase();
  const {data, error} = await c.from('family_members').select('email,name,role');
  if (error) { S.gateErr = "Couldn't check the family list. Check the internet and try again."; return; }
  const me = (data || []).find(r => r.email === email);
  if (!me) {
    S.gateErr = `${email || 'That account'} isn't one of the family accounts for this app. Sign in with a family Google account.`;
    try { await c.auth.signOut(); } catch {}
    return;
  }
  Device.set({email, name: me.name, role: me.role, at: Date.now()});
}
async function startApp(){
  await loadPlayers();
  const last = ss.get('me'), p = last && S.players.find(x => x.id === last);
  if (p && p.pinHash) { try { await signIn(p, false); } catch { S.screen = 'login'; render(); } }
  else { S.screen = 'login'; preselect(); render(); }
  Sync.run();
}
async function boot(){
  render();
  if ('serviceWorker' in navigator) {
    // A new version installs in the background; the page reloads into it at the next calm moment (not mid-question or
    // mid-game), and the app checks for one whenever it comes back to the front.
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) { S.reloadSoon = true; if (!S.play && !['game', 'setup'].includes(S.screen)) location.reload(); } });
    navigator.serviceWorker.register('sw.js').then(reg => document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); })).catch(() => {});
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}
  const q = new URLSearchParams(location.search);
  if (q.get('error_description')) S.gateErr = q.get('error_description');
  const c = sbClient();
  if (c && !Device.get() && navigator.onLine) {
    try { const {data:{session}} = await withTimeout(c.auth.getSession(), 10000); if (session) await checkFamily(c, session); } catch {}
  }
  if (q.has('code') || q.has('error')) history.replaceState(null, '', location.pathname);
  if (!Device.get()) { S.screen = 'gate'; render(); return; }
  await startApp();
}
addEventListener('online', () => { updateSyncChip(); Sync.run(); });
addEventListener('offline', updateSyncChip);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') Sync.soon(500); });
setInterval(() => { if (document.visibilityState === 'visible') Sync.run(); else updateSyncChip(); }, 60000);
boot();
})();
