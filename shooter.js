// Spell Strike (Sam, 27 Oct 2026): Hughie's reward game on the spelling side, the first-person robot shooter first drawn as
// mock-ups on 26 Oct ("like call of duty"; blocky 3D; robots that spark and fall apart, no blood). Six zones of robots, five
// waves each, a boss at the end of every zone, and spelling powers it all (Sam: "he progresses when he spells words
// correctly...he gets extra ammo and lives, new guns, with lots of cool bad guys to shoot"):
//  - Supply drop: tap SPELL at any time. The robots freeze while he builds a word from his own spelling list out of letter
//    tiles. Right first time: 2 ammo packs, a grenade and full health. Put right after a mistake: 1 ammo pack and full
//    health. 3 right in a row: +1 life. Game over: spell 3 words to carry on from the same wave.
//  - New guns: every word he has ever spelled right in the app counts towards the next of nine guns.
//  - This week's spelling: every 5 words right this week is an extra ammo pack at the start, every 10 an extra life (up to 3).
// It draws with three.js (vendor/three.min.js), loaded only when the game opens; sw.js keeps both files for offline play.
// window.TTCGames.strike(host, api) returns {destroy}, like the other reward games in games.js.
(() => {
'use strict';
const T = window.THREE;
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = n => Math.floor(Math.random() * n);
const pick = a => a[rint(a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rint(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const num = n => Math.round(n).toLocaleString('en-GB');

/* ---------- looks ---------- */
const CSS = `
.ss{position:fixed;inset:0;z-index:60;background:#06080c;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;color:#fff;font-family:'Nunito',Verdana,sans-serif;line-height:1.2;cursor:default}
.ss *{box-sizing:border-box}
.ss button{font-family:inherit;color:inherit;cursor:pointer}
.ss-gl{position:absolute;inset:0;width:100%;height:100%;display:block}
.ss-hud{position:absolute;inset:0;pointer-events:none;text-shadow:0 2px 4px rgba(0,0,0,.8)}
.ss [hidden]{display:none!important}
.ss-tl{position:absolute;left:calc(12px + env(safe-area-inset-left));top:calc(10px + env(safe-area-inset-top))}
.ss-radar{display:block;width:118px;height:118px}
.ss-hp{width:118px;height:13px;margin-top:8px;border:2px solid rgba(255,255,255,.8);border-radius:8px;background:rgba(0,0,0,.5);overflow:hidden}
.ss-hp i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff3d3d,#ffb03d);transition:width .12s}
.ss-hp.low i{background:#ff3d3d;animation:ss-blink .45s infinite alternate}
.ss-lives{margin-top:6px;font-size:17px;letter-spacing:1px;white-space:nowrap}
.ss-nades{font-weight:900;font-size:14px;margin-top:2px}
.ss-tc{position:absolute;left:50%;top:calc(8px + env(safe-area-inset-top));transform:translateX(-50%);text-align:center;width:min(560px,56vw)}
.ss-wave{font-family:'Lilita One',sans-serif;font-size:28px;letter-spacing:.03em}
.ss-sub{font-weight:900;font-size:14px;opacity:.95}
.ss-bossname{font-weight:900;font-size:13px;letter-spacing:.14em;color:#ffb3c6;margin-top:4px}
.ss-bossbar{margin:4px auto 0;height:14px;border:2px solid #fff;border-radius:8px;background:rgba(0,0,0,.55);overflow:hidden}
.ss-bossbar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff2e63,#ffb000);transition:width .15s}
.ss-tr{position:absolute;right:calc(74px + env(safe-area-inset-right));top:calc(10px + env(safe-area-inset-top));text-align:right}
.ss-gunname{font-weight:900;font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.92}
.ss-ammo{font-family:'Lilita One',sans-serif;font-size:38px;line-height:1.05}
.ss-ammo small{font-size:19px;opacity:.8}
.ss-ammo.empty{color:#ff5a4a}
.ss-score{font-weight:900;font-size:17px;color:#ffd23f}
.ss-clock{font-weight:900;font-size:13px;opacity:.9}
.ss-cross{position:absolute;left:50%;top:50%;width:0;height:0}
.ss-cross i{position:absolute;background:#fff;box-shadow:0 0 2px rgba(0,0,0,.9);border-radius:1px}
.ss-cross.hot i{background:#ff4a3d}
.ss-cross.ads{opacity:.35}
.ss-hit{position:absolute;left:50%;top:50%;width:0;height:0;opacity:0}
.ss-hit i{position:absolute;left:-1.5px;top:-11px;width:3px;height:9px;background:#fff;box-shadow:0 0 3px #000;transform-origin:1.5px 11px}
.ss-hit.kill i{background:#ff4a3d}
.ss-vig{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(170,0,0,0) 45%,rgba(170,0,0,.75) 100%)}
.ss-heal{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(ellipse at center,rgba(60,255,140,0) 50%,rgba(60,255,140,.45) 100%)}
.ss-dmg{position:absolute;left:50%;top:50%;width:0;height:0;opacity:0}
.ss-dmg i{position:absolute;left:-46px;top:-150px;width:92px;height:22px;border-top:9px solid rgba(255,45,30,.9);border-radius:50% 50% 0 0/100% 100% 0 0}
.ss-pops{position:absolute;inset:0;pointer-events:none}
.ss-pop{position:absolute;font-family:'Lilita One',sans-serif;font-size:24px;color:#ffd23f;white-space:nowrap;transform:translate(-50%,-50%)}
.ss-pop.big{font-size:30px;color:#ff6a3d}
.ss-bar{position:absolute;width:56px;height:7px;margin-left:-28px;border:1.5px solid rgba(0,0,0,.7);background:rgba(0,0,0,.5);border-radius:4px;overflow:hidden}
.ss-bar i{display:block;height:100%;background:#ff4a3d}
.ss-banner{position:absolute;left:50%;top:24%;transform:translate(-50%,-50%);text-align:center;font-family:'Lilita One',sans-serif;font-size:clamp(34px,6vw,64px);letter-spacing:.03em;color:#fff;-webkit-text-stroke:2px #000;paint-order:stroke;white-space:nowrap;opacity:0}
.ss-banner small{display:block;font-family:'Nunito',sans-serif;font-weight:900;font-size:clamp(15px,2vw,22px);-webkit-text-stroke:0;letter-spacing:.06em;color:#ffd23f}
.ss-banner.show{animation:ss-banner 2.4s ease-out forwards}
.ss-toast{position:absolute;left:50%;top:38%;transform:translateX(-50%);font-weight:900;font-size:clamp(16px,2.2vw,24px);color:#fff;background:rgba(0,0,0,.6);border:2px solid #ffd23f;border-radius:14px;padding:8px 18px;white-space:nowrap;opacity:0}
.ss-toast.show{animation:ss-toast 2.6s ease-out forwards}
.ss-scope{position:absolute;inset:0;pointer-events:none;opacity:0;background:radial-gradient(circle at center,rgba(0,0,0,0) 0,rgba(0,0,0,0) 34vmin,#000 34.4vmin)}
.ss-scope::before,.ss-scope::after{content:'';position:absolute;background:rgba(0,0,0,.85)}
.ss-scope::before{left:50%;top:16vmin;bottom:16vmin;width:2px;margin-left:-1px}
.ss-scope::after{top:50%;left:calc(50% - 34vmin);right:calc(50% - 34vmin);height:2px;margin-top:-1px}
.ss-ctl{position:absolute;inset:0;pointer-events:none}
.ss-btn{position:absolute;pointer-events:auto;border-radius:50%;border:3px solid rgba(255,255,255,.75);background:rgba(0,0,0,.38);color:#fff;font-weight:900;font-size:14px;letter-spacing:.04em;display:grid;place-items:center;text-align:center;line-height:1.05;padding:0;text-shadow:0 1px 3px #000;touch-action:none}
.ss-btn small{display:block;font-size:11px;opacity:.9}
.ss-btn.on,.ss-btn.press{background:rgba(255,200,60,.45);border-color:#ffd25a}
.ss-fire{width:118px;height:118px;right:calc(24px + env(safe-area-inset-right));bottom:calc(30px + env(safe-area-inset-bottom));font-size:22px;border-color:#ffd25a;background:rgba(255,190,40,.2)}
.ss-aim{width:76px;height:76px;right:calc(156px + env(safe-area-inset-right));bottom:calc(22px + env(safe-area-inset-bottom))}
.ss-reload{width:68px;height:68px;right:calc(30px + env(safe-area-inset-right));bottom:calc(164px + env(safe-area-inset-bottom))}
.ss-nade{width:68px;height:68px;right:calc(114px + env(safe-area-inset-right));bottom:calc(132px + env(safe-area-inset-bottom))}
.ss-spellbtn{width:86px;height:86px;right:calc(196px + env(safe-area-inset-right));bottom:calc(112px + env(safe-area-inset-bottom));border-color:#7dffb0;background:rgba(40,190,110,.35);font-size:13px}
.ss-spellbtn b{font-size:24px;line-height:1}
.ss-spellbtn.want{animation:ss-pulse .8s infinite alternate}
.ss-pausebtn{width:50px;height:50px;right:calc(12px + env(safe-area-inset-right));top:calc(10px + env(safe-area-inset-top));font-size:18px}
.ss-guns{position:absolute;left:50%;bottom:calc(8px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:5px;pointer-events:auto}
.ss-gunbtn{width:52px;height:38px;border-radius:10px;border:2px solid rgba(255,255,255,.55);background:rgba(0,0,0,.42);display:grid;place-items:center;padding:0;touch-action:none}
.ss-gunbtn.on{border-color:#ffd25a;background:rgba(255,200,60,.35)}
.ss-gunbtn svg{width:42px;height:21px}
.ss-joy{position:absolute;width:150px;height:150px;margin:-75px 0 0 -75px;border-radius:50%;border:3px solid rgba(255,255,255,.35);background:rgba(255,255,255,.07);pointer-events:none}
.ss-joy i{position:absolute;left:50%;top:50%;width:62px;height:62px;margin:-31px 0 0 -31px;border-radius:50%;background:rgba(255,255,255,.33);border:2px solid rgba(255,255,255,.75)}
.ss-joy.idle{opacity:.55}
.ss-joy b{position:absolute;left:0;right:0;top:100%;margin-top:6px;text-align:center;font-weight:900;font-size:12px;letter-spacing:.1em;opacity:.8}
.ss-ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(4,6,10,.62);pointer-events:auto;overflow:auto;padding:calc(14px + env(safe-area-inset-top)) calc(14px + env(safe-area-inset-right)) calc(14px + env(safe-area-inset-bottom)) calc(14px + env(safe-area-inset-left));touch-action:pan-y}
.ss-ov.clear{background:transparent;pointer-events:none}
.ss-panel{width:min(1000px,100%);margin:auto;pointer-events:auto}
.ss-title{font-family:'Lilita One',sans-serif;font-size:clamp(40px,7vw,78px);line-height:.95;letter-spacing:.02em;color:#ffd23f;-webkit-text-stroke:3px #1b1208;paint-order:stroke;text-shadow:0 6px 0 #7a2a0a,0 10px 18px rgba(0,0,0,.6);margin:0}
.ss-tag{font-weight:900;font-size:clamp(14px,1.8vw,19px);margin:8px 0 14px;opacity:.95}
.ss-cols{display:grid;grid-template-columns:1.1fr 1fr;gap:14px}
@media (max-width:760px){.ss-cols{grid-template-columns:1fr}}
.ss-card{background:rgba(12,16,24,.82);border:2px solid rgba(255,255,255,.18);border-radius:18px;padding:14px}
.ss-card h3{margin:0 0 10px;font-family:'Lilita One',sans-serif;font-weight:400;font-size:22px;letter-spacing:.02em}
.ss-zones{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.ss-zone{position:relative;text-align:left;border:2.5px solid rgba(255,255,255,.25);border-radius:14px;padding:10px 10px 8px;background:linear-gradient(160deg,var(--z1),var(--z2));min-height:86px;color:#fff;text-shadow:0 1px 3px #000}
.ss-zone b{display:block;font-family:'Lilita One',sans-serif;font-weight:400;font-size:18px;line-height:1.05}
.ss-zone span{display:block;font-weight:800;font-size:12px;margin-top:4px;opacity:.95}
.ss-zone.on{border-color:#ffd23f;box-shadow:0 0 0 3px rgba(255,210,63,.45)}
.ss-zone.lock{filter:grayscale(1) brightness(.55);cursor:not-allowed}
.ss-zone .n{position:absolute;right:8px;top:6px;font-family:'Lilita One',sans-serif;font-size:15px;opacity:.85}
.ss-arsenal{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.ss-gun{border:2px solid rgba(255,255,255,.22);border-radius:12px;padding:6px 6px 5px;text-align:center;background:rgba(255,255,255,.05)}
.ss-gun svg{width:100%;height:30px}
.ss-gun b{display:block;font-size:11.5px;font-weight:900;line-height:1.1}
.ss-gun small{display:block;font-size:11px;font-weight:800;opacity:.85}
.ss-gun.lock{opacity:.5}
.ss-gun.next{border-color:#7dffb0;opacity:1}
.ss-meter{height:12px;border-radius:7px;background:rgba(255,255,255,.12);overflow:hidden;margin:8px 0 4px}
.ss-meter i{display:block;height:100%;background:linear-gradient(90deg,#3ddc84,#b6ff5c)}
.ss-note{font-weight:800;font-size:13.5px;opacity:.95}
.ss-week{margin-top:10px;padding:9px 11px;border-radius:12px;background:rgba(61,220,132,.16);border:2px solid rgba(61,220,132,.5);font-weight:900;font-size:14px}
.ss-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:14px}
.ss-go{border:0;border-radius:16px;padding:14px 26px;font-family:'Lilita One',sans-serif;font-size:26px;letter-spacing:.03em;background:linear-gradient(180deg,#ffe05a,#ffb21a);color:#2a1600;box-shadow:0 5px 0 #a35b00,0 10px 20px rgba(0,0,0,.4)}
.ss-go:active{transform:translateY(3px);box-shadow:0 2px 0 #a35b00}
.ss-ghost{border:2px solid rgba(255,255,255,.55);border-radius:14px;padding:11px 16px;background:rgba(0,0,0,.35);font-weight:900;font-size:15px}
.ss-small{font-size:12.5px;font-weight:800;opacity:.85}
.ss-best{font-weight:900;color:#ffd23f}
.ss-help{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:6px}
.ss-help div{background:rgba(255,255,255,.07);border-radius:12px;padding:10px;font-weight:800;font-size:14.5px}
.ss-help b{display:block;font-family:'Lilita One',sans-serif;font-weight:400;font-size:19px;margin-bottom:3px;color:#ffd23f}
.ss-foe{display:flex;gap:10px;align-items:center;background:rgba(255,255,255,.07);border-radius:12px;padding:8px 10px;margin-top:8px}
.ss-foe b{font-family:'Lilita One',sans-serif;font-weight:400;font-size:19px}
.ss-foes{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.ss-foes span{border:1.5px solid rgba(255,255,255,.3);border-radius:99px;padding:3px 9px;font-size:12px;font-weight:900}
.ss-foes span.new{border-color:#ff6a3d;color:#ffb39a}
.ss-spell{width:min(700px,100%);margin:auto;background:#FFF8E7;color:#1B2140;border:4px solid #1B2140;border-radius:22px;padding:16px 16px 14px;text-align:center;box-shadow:0 8px 0 rgba(0,0,0,.35);text-shadow:none;pointer-events:auto}
.ss-spell .eb{font-weight:900;font-size:13px;letter-spacing:.16em;color:#2f7a4a;margin:0}
.ss-spell h2{margin:4px 0 8px;font-family:'Lilita One',sans-serif;font-weight:400;font-size:clamp(24px,3.6vw,34px);color:#1B2140}
.ss-spell .say{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:10px}
.ss-spell .say button{border:2.5px solid #1B2140;border-radius:12px;background:#fff;padding:9px 14px;font-weight:900;font-size:16px;color:#1B2140;box-shadow:3px 3px 0 #1B2140}
.ss-spell .word{font-family:'Nunito',Verdana,sans-serif;font-weight:800;font-size:clamp(30px,5vw,46px);letter-spacing:.14em;margin:2px 0 8px;color:#1B2140}
.ss-spell .slots{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:6px 0 12px}
.ss-spell .slots span{width:44px;height:54px;border:2.5px solid #1B2140;border-radius:9px;background:#fff;display:grid;place-items:center;font:800 32px 'Nunito',Verdana,sans-serif;color:#1B2140}
.ss-spell .slots span.next{border-color:#2f7a4a;box-shadow:0 0 0 3px rgba(47,122,74,.35)}
.ss-spell .tiles{display:flex;gap:9px;justify-content:center;flex-wrap:wrap}
.ss-spell .tile{min-width:60px;height:64px;border:2.5px solid #1B2140;border-radius:12px;background:#fff;font:800 32px 'Nunito',Verdana,sans-serif;color:#1B2140;box-shadow:3px 3px 0 #1B2140;padding:0 10px}
.ss-spell .tile:disabled{opacity:.2;box-shadow:none}
.ss-spell .tools{display:flex;gap:10px;justify-content:center;margin-top:12px;flex-wrap:wrap}
.ss-spell .tools button{border:2px solid #1B2140;border-radius:12px;background:transparent;padding:8px 14px;font-weight:900;font-size:15px;color:#1B2140}
.ss-spell .fb{font-weight:900;font-size:17px;margin:2px 0 8px;min-height:22px}
.ss-spell .fb mark{background:#ffd23f;color:#1B2140;border-radius:4px;padding:0 2px}
.ss-spell .fb.ok{color:#2f7a4a}
.ss-spell .fb.no{color:#b3261e}
.ss-spell .tip{font-weight:800;font-size:14px;color:#56608A;margin:-2px 0 8px}
.ss-spell .prog{font-weight:900;font-size:14px;color:#56608A;margin-top:8px}
.ss-reward{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:6px 0 2px}
.ss-reward span{background:#1B2140;color:#fff;border-radius:99px;padding:6px 12px;font-weight:900;font-size:15px}
.ss-streak{font-weight:900;font-size:15px;color:#b35a00;margin-top:6px}
.ss-break{position:absolute;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%);text-align:center;pointer-events:auto;text-shadow:0 2px 4px #000}
.ss-breakt{font-family:'Lilita One',sans-serif;font-size:28px}
.ss-break .ss-row{justify-content:center;margin-top:8px}
.ss-turn{position:absolute;inset:0;display:none;place-items:center;background:rgba(0,0,0,.85);text-align:center;font-weight:900;font-size:20px;padding:30px;pointer-events:auto}
.ss-load{position:absolute;inset:0;display:grid;place-items:center;font-family:'Lilita One',sans-serif;font-size:28px;letter-spacing:.04em;color:#ffd23f}
@keyframes ss-blink{to{opacity:.45}}
@keyframes ss-pulse{to{box-shadow:0 0 0 10px rgba(125,255,176,.25);transform:scale(1.06)}}
@keyframes ss-banner{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}12%{opacity:1;transform:translate(-50%,-50%) scale(1.06)}20%{transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-62%) scale(1)}}
@keyframes ss-toast{0%{opacity:0;transform:translate(-50%,10px)}10%{opacity:1;transform:translate(-50%,0)}80%{opacity:1}100%{opacity:0}}
@media (max-width:900px){.ss-fire{width:100px;height:100px}.ss-spellbtn{right:calc(176px + env(safe-area-inset-right))}.ss-gunbtn{width:44px;height:34px}.ss-gunbtn svg{width:36px;height:18px}.ss-radar{width:96px;height:96px}.ss-hp{width:96px}}
`;
function injectCss(){ if (document.getElementById('ss-css')) return; const s = document.createElement('style'); s.id = 'ss-css'; s.textContent = CSS; document.head.appendChild(s); }

/* ---------- canvas textures ---------- */
let ANISO = 4;
function canvasTex(w, h, draw, opt = {}){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = ANISO; t.encoding = T.sRGBEncoding;
  if (opt.repeat) t.repeat.set(opt.repeat[0], opt.repeat[1]);
  return t;
}
function speckle(x, w, h, n, a, sz = 2){
  for (let i = 0; i < n; i++) { const v = Math.random() * 255 | 0; x.fillStyle = `rgba(${v},${v},${v},${a})`; x.fillRect(Math.random() * w, Math.random() * h, sz, sz); }
}
function blotches(x, w, h, n, col, a){ for (let i = 0; i < n; i++) { x.fillStyle = col; x.globalAlpha = Math.random() * a; x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 60, 8 + Math.random() * 40, Math.random() * 3, 0, 7); x.fill(); } x.globalAlpha = 1; }
// Floors: 512px is 8 metres.
const FLOORS = {
  asphalt: (x, w, h) => { x.fillStyle = '#4c4946'; x.fillRect(0, 0, w, h); speckle(x, w, h, 9000, .12); blotches(x, w, h, 14, '#2a2826', .35);
    x.strokeStyle = 'rgba(25,24,22,.55)'; x.lineWidth = 2; for (let i = 0; i < 6; i++) { x.beginPath(); let px = Math.random() * w, py = Math.random() * h; x.moveTo(px, py); for (let j = 0; j < 6; j++) { px += (Math.random() - .5) * 60; py += Math.random() * 40; x.lineTo(px, py); } x.stroke(); }
    x.fillStyle = 'rgba(214,180,70,.85)'; x.fillRect(w / 2 - 5, 30, 10, 150); x.fillRect(w / 2 - 5, 290, 10, 150); },
  dock: (x, w, h) => { x.fillStyle = '#7b7972'; x.fillRect(0, 0, w, h); speckle(x, w, h, 8000, .1); blotches(x, w, h, 18, '#4a4840', .25);
    x.strokeStyle = 'rgba(40,38,34,.55)'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 128, 0); x.lineTo(i * 128, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 128); x.lineTo(w, i * 128); x.stroke(); }
    x.fillStyle = 'rgba(230,190,40,.8)'; x.fillRect(0, 250, w, 10); },
  metal: (x, w, h) => { x.fillStyle = '#4d535b'; x.fillRect(0, 0, w, h);
    for (let yy = 0; yy < h; yy += 32) for (let xx = (yy / 32 % 2) * 16; xx < w; xx += 32) { x.fillStyle = 'rgba(255,255,255,.09)'; x.save(); x.translate(xx, yy); x.rotate(.7); x.fillRect(-9, -2, 18, 4); x.restore(); }
    speckle(x, w, h, 5000, .08); blotches(x, w, h, 10, '#22262c', .3);
    x.strokeStyle = 'rgba(20,22,26,.8)'; x.lineWidth = 4; x.strokeRect(2, 2, w - 4, h - 4); x.strokeRect(2, 2, w / 2 - 2, h / 2 - 2); x.strokeRect(w / 2, h / 2, w / 2 - 2, h / 2 - 2); },
  sand: (x, w, h) => { x.fillStyle = '#d4b07a'; x.fillRect(0, 0, w, h); speckle(x, w, h, 12000, .1);
    x.strokeStyle = 'rgba(150,110,60,.25)'; x.lineWidth = 3; for (let i = 0; i < 26; i++) { x.beginPath(); const y0 = Math.random() * h; x.moveTo(0, y0); for (let xx = 0; xx <= w; xx += 32) x.lineTo(xx, y0 + Math.sin(xx / 40 + i) * 8); x.stroke(); }
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(110,85,55,${Math.random() * .6})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, 7); x.fill(); } },
  wet: (x, w, h) => { x.fillStyle = '#1b2030'; x.fillRect(0, 0, w, h); speckle(x, w, h, 9000, .1);
    for (let i = 0; i < 22; i++) { const g = x.createLinearGradient(0, 0, 0, h); const c = pick(['255,47,214', '25,242,255', '255,190,60']); g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(.5, `rgba(${c},.18)`); g.addColorStop(1, `rgba(${c},0)`); x.fillStyle = g; x.fillRect(Math.random() * w, 0, 3 + Math.random() * 10, h); }
    x.fillStyle = 'rgba(230,230,240,.35)'; x.fillRect(w / 2 - 4, 40, 8, 120); x.fillRect(w / 2 - 4, 300, 8, 120); },
  moon: (x, w, h) => { x.fillStyle = '#8b8b92'; x.fillRect(0, 0, w, h); speckle(x, w, h, 14000, .14);
    for (let i = 0; i < 16; i++) { const cx = Math.random() * w, cy = Math.random() * h, r = 8 + Math.random() * 40; const g = x.createRadialGradient(cx, cy, r * .2, cx, cy, r); g.addColorStop(0, 'rgba(60,60,66,.45)'); g.addColorStop(.85, 'rgba(70,70,76,.2)'); g.addColorStop(1, 'rgba(220,220,230,.35)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); } },
};
// Building fronts: 512px is 6 metres (two storeys, two windows).
const WALLS = {
  office: (x, w, h) => { x.fillStyle = '#8d8780'; x.fillRect(0, 0, w, h); speckle(x, w, h, 7000, .1);
    for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(60,50,40,${Math.random() * .12})`; x.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 80, 60 + Math.random() * 120); }
    x.strokeStyle = 'rgba(40,36,32,.6)'; x.lineWidth = 3; x.strokeRect(0, 0, w, h); x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
    for (const [wx, wy] of [[70, 80], [300, 80], [70, 330], [300, 330]]) { x.fillStyle = '#5b554e'; x.fillRect(wx - 8, wy - 8, 156, 116); x.fillStyle = '#1d2228'; x.fillRect(wx, wy, 140, 100); x.fillStyle = 'rgba(140,170,200,.15)'; x.fillRect(wx, wy, 140, 40); x.fillStyle = '#5b554e'; x.fillRect(wx + 66, wy, 8, 100); }
    const g = x.createLinearGradient(0, h - 60, 0, h); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = g; x.fillRect(0, h - 60, w, 60); },
  shed: (x, w, h) => { x.fillStyle = '#6f7f8c'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 16) { const g = x.createLinearGradient(i, 0, i + 16, 0); g.addColorStop(0, 'rgba(255,255,255,.13)'); g.addColorStop(.5, 'rgba(0,0,0,.2)'); g.addColorStop(1, 'rgba(255,255,255,.08)'); x.fillStyle = g; x.fillRect(i, 0, 16, h); }
    blotches(x, w, h, 26, '#7a4a22', .3); x.fillStyle = '#c9a63a'; x.fillRect(0, 236, w, 22); x.fillStyle = 'rgba(0,0,0,.6)'; x.font = 'bold 22px Arial'; x.fillText('DOCK 7', 40, 254); },
  factory: (x, w, h) => { x.fillStyle = '#3b3f46'; x.fillRect(0, 0, w, h); speckle(x, w, h, 6000, .08);
    x.strokeStyle = 'rgba(15,16,18,.9)'; x.lineWidth = 4; for (let i = 0; i <= 2; i++) { x.strokeRect(i * 170 + 2, 2, 168, h / 2 - 4); x.strokeRect(i * 170 + 2, h / 2 + 2, 168, h / 2 - 4); }
    x.fillStyle = 'rgba(200,200,210,.25)'; for (let i = 0; i < 60; i++) { x.beginPath(); x.arc(10 + (i % 15) * 34, (i < 30 ? 14 : h / 2 + 14), 3, 0, 7); x.fill(); }
    for (let i = 0; i < 6; i++) { x.fillStyle = '#ff8a1a'; x.fillRect(40 + i * 80, 200, 34, 14); }
    x.fillStyle = '#16181c'; for (let i = 0; i < 6; i++) x.fillRect(30 + i * 80, 330, 50, 6);
    for (let i = 0; i < w; i += 40) { x.fillStyle = '#e8b21a'; x.fillRect(i, h - 26, 20, 26); x.fillStyle = '#111'; x.fillRect(i + 20, h - 26, 20, 26); } },
  adobe: (x, w, h) => { x.fillStyle = '#c49a64'; x.fillRect(0, 0, w, h); speckle(x, w, h, 9000, .12); blotches(x, w, h, 20, '#8a6438', .25);
    x.strokeStyle = 'rgba(110,80,45,.35)'; x.lineWidth = 2; for (let yy = 20; yy < h; yy += 34) { x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke(); }
    for (const [wx, wy] of [[90, 110], [330, 110], [90, 350], [330, 350]]) { x.fillStyle = '#3a2614'; x.fillRect(wx, wy, 90, 80); x.fillStyle = '#6b4a2a'; x.fillRect(wx - 8, wy + 80, 106, 10); }
    x.fillStyle = '#5a3d22'; for (let i = 0; i < 6; i++) x.fillRect(20 + i * 90, 236, 16, 16); },
  tower: (x, w, h) => { x.fillStyle = '#20242f'; x.fillRect(0, 0, w, h); speckle(x, w, h, 4000, .06);
    for (let yy = 16; yy < h; yy += 64) for (let xx = 14; xx < w; xx += 50) { const lit = Math.random() < .55; x.fillStyle = lit ? pick(['#ffd27a', '#ffe7b0', '#7af6ff', '#ff7ae6', '#fff3c9']) : '#0d0f15'; x.fillRect(xx, yy, 30, 38); }
    x.fillStyle = pick(['#ff2fd6', '#19f2ff']); x.fillRect(0, 252, w, 8); },
  base: (x, w, h) => { x.fillStyle = '#d7dbe2'; x.fillRect(0, 0, w, h); speckle(x, w, h, 5000, .07);
    x.strokeStyle = 'rgba(80,86,96,.7)'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 128, 0); x.lineTo(i * 128, h); x.stroke(); } x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
    for (const [cx, cy] of [[128, 120], [384, 120], [128, 376], [384, 376]]) { x.fillStyle = '#5b6170'; x.beginPath(); x.arc(cx, cy, 46, 0, 7); x.fill(); x.fillStyle = '#123a5a'; x.beginPath(); x.arc(cx, cy, 36, 0, 7); x.fill(); x.fillStyle = 'rgba(120,220,255,.6)'; x.beginPath(); x.arc(cx - 10, cy - 10, 10, 0, 7); x.fill(); }
    x.fillStyle = '#ff7a1a'; x.fillRect(0, 238, w, 16); },
};
const PROPS = {
  crate: (x, w, h) => { x.fillStyle = '#9a7244'; x.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 42) { x.fillStyle = `rgba(0,0,0,${.05 + Math.random() * .1})`; x.fillRect(0, y, w, 40); x.fillStyle = 'rgba(40,25,10,.6)'; x.fillRect(0, y + 40, w, 2); }
    speckle(x, w, h, 2500, .08); x.strokeStyle = '#6a4a26'; x.lineWidth = 26; x.strokeRect(13, 13, w - 26, h - 26);
    x.beginPath(); x.moveTo(20, 20); x.lineTo(w - 20, h - 20); x.stroke(); x.fillStyle = 'rgba(30,20,10,.7)'; x.font = 'bold 26px Arial'; x.fillText('AMMO', 88, 140); },
  // greyscale, tinted per container by vertex colour; 512px is 2.6 metres
  box: (x, w, h) => { x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 18) { const g = x.createLinearGradient(i, 0, i + 18, 0); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(.5, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(255,255,255,.2)'); x.fillStyle = g; x.fillRect(i, 0, 18, h); }
    blotches(x, w, h, 30, '#5a3010', .35); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, w, 14); x.fillRect(0, h - 14, w, 14);
    x.fillStyle = 'rgba(255,255,255,.85)'; x.font = 'bold 34px Arial'; x.fillText('SQDU 482917', 30, 70); },
  sandbag: (x, w, h) => { x.fillStyle = '#7c6e51'; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 4; r++) for (let c = -1; c < 5; c++) { const bx = c * 64 + (r % 2) * 32, by = r * 32; const g = x.createRadialGradient(bx + 32, by + 12, 4, bx + 32, by + 16, 40); g.addColorStop(0, '#b3a27a'); g.addColorStop(1, '#5d523b'); x.fillStyle = g; x.beginPath(); x.ellipse(bx + 32, by + 16, 31, 15, 0, 0, 7); x.fill(); } },
  concrete: (x, w, h) => { x.fillStyle = '#9a958d'; x.fillRect(0, 0, w, h); speckle(x, w, h, 5000, .12); blotches(x, w, h, 10, '#5a564f', .25); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, h - 20, w, 20);
    for (let i = 0; i < w; i += 64) { x.fillStyle = '#d9b01e'; x.save(); x.translate(i, 0); x.transform(1, 0, -.5, 1, 0, 0); x.fillRect(0, 10, 28, 40); x.restore(); } },
  hazard: (x, w, h) => { x.fillStyle = '#5a6068'; x.fillRect(0, 0, w, h); speckle(x, w, h, 3000, .1);
    x.save(); x.beginPath(); x.rect(0, 0, w, 60); x.clip(); for (let i = -60; i < w; i += 40) { x.fillStyle = '#e8b21a'; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 20, 0); x.lineTo(i + 80, 60); x.lineTo(i + 60, 60); x.fill(); } x.restore();
    x.fillStyle = '#20242a'; x.fillRect(30, 100, w - 60, 90); x.fillStyle = '#39e6ff'; for (let i = 0; i < 5; i++) x.fillRect(46 + i * 42, 120, 26, 10 + rint(40));
    x.fillStyle = '#ff3b2f'; x.beginPath(); x.arc(w - 60, 145, 14, 0, 7); x.fill(); x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 4; x.strokeRect(2, 2, w - 4, h - 4); },
  belt: (x, w, h) => { x.fillStyle = '#2a2d31'; x.fillRect(0, 0, w, h); for (let i = 0; i < w; i += 24) { x.fillStyle = '#4a4f57'; x.fillRect(i, 0, 12, h); } x.fillStyle = '#e8b21a'; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10); },
  rock: (x, w, h) => { x.fillStyle = '#9b8466'; x.fillRect(0, 0, w, h); speckle(x, w, h, 6000, .2, 3); blotches(x, w, h, 20, '#5e4a33', .4); },
  barrel: (x, w, h) => { x.fillStyle = '#d0d0d0'; x.fillRect(0, 0, w, h); speckle(x, w, h, 2000, .12); x.fillStyle = 'rgba(0,0,0,.35)'; for (const y of [18, h / 2 - 6, h - 30]) x.fillRect(0, y, w, 12); x.fillStyle = 'rgba(255,255,255,.7)'; x.font = 'bold 26px Arial'; x.fillText('FUEL', 20, h / 2 - 20); },
  car: (x, w, h) => { x.fillStyle = '#cfcfcf'; x.fillRect(0, 0, w, h); speckle(x, w, h, 1500, .08); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, h * .55, w, 6); x.fillStyle = '#1a1d24'; x.fillRect(w * .08, h * .12, w * .84, h * .3); },
  dome: (x, w, h) => { x.fillStyle = '#e4e7ec'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(80,86,96,.6)'; x.lineWidth = 3; for (let i = 0; i < w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); } for (let i = 0; i < h; i += 32) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } x.fillStyle = '#ff7a1a'; x.fillRect(0, h - 22, w, 10); },
  water: (x, w, h) => { x.fillStyle = '#1d4a63'; x.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { x.strokeStyle = `rgba(160,220,255,${Math.random() * .35})`; x.lineWidth = 2; x.beginPath(); const yy = Math.random() * h, xx = Math.random() * w; x.moveTo(xx, yy); x.quadraticCurveTo(xx + 14, yy - 6, xx + 28, yy); x.stroke(); } },
  panel: (x, w, h) => { x.fillStyle = '#c8c8c8'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 3; x.strokeRect(6, 6, w - 12, h - 12); x.fillStyle = 'rgba(0,0,0,.3)'; for (const [a, b] of [[14, 14], [w - 14, 14], [14, h - 14], [w - 14, h - 14]]) { x.beginPath(); x.arc(a, b, 3, 0, 7); x.fill(); } x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(8, 8, w - 16, 10); },
};
const skyTex = sky => canvasTex(8, 512, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h); sky.forEach(([at, c]) => g.addColorStop(at, c)); x.fillStyle = g; x.fillRect(0, 0, w, h);
});
const STARS = () => canvasTex(1024, 512, (x, w, h) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,255,${Math.random()})`; x.fillRect(Math.random() * w, Math.random() * h * .55, 1.5, 1.5); } });
const glowTex = (inner = 'rgba(255,255,230,1)', mid = 'rgba(255,210,90,.9)', outer = 'rgba(255,120,20,.35)') => canvasTex(128, 128, (x, w, h) => {
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, inner); g.addColorStop(.25, mid); g.addColorStop(.6, outer); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
});
const ringTex = () => canvasTex(128, 128, (x) => { x.strokeStyle = '#fff'; x.lineWidth = 10; x.beginPath(); x.arc(64, 64, 52, 0, 7); x.stroke(); x.lineWidth = 3; x.beginPath(); x.arc(64, 64, 38, 0, 7); x.stroke(); });
const blobTex = () => canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
const panelTex = () => canvasTex(128, 128, PROPS.panel);

/* ---------- geometry: boxes merged into one mesh per material ---------- */
const FACES = [
  {n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0]}, {n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0]},
  {n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1]}, {n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1]},
  {n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0]}, {n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0]},
];
const WHITE = [1, 1, 1];
const _m4 = () => new T.Matrix4(), _eu = () => new T.Euler();
const lin = hex => { const c = new T.Color(hex).convertSRGBToLinear(); return [c.r, c.g, c.b]; };
class Geo {
  constructor(){ this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; this.k = 0; }
  // A box centred on x, y, z. o: rx/ry/rz (radians), col (linear rgb), uv 'unit' (one picture per face) or 'world'
  // (tiled every s metres, storeys lined up on walls), bottom (draw the underside).
  box(x, y, z, w, h, d, o = {}){
    const col = o.col || WHITE, s = o.s || 1, unit = o.uv === 'unit';
    let e = null;
    if (o.rx || o.ry || o.rz) e = _m4().makeRotationFromEuler(_eu().set(o.rx || 0, o.ry || 0, o.rz || 0)).elements;
    const rot = (a, b, c) => e ? [e[0] * a + e[4] * b + e[8] * c, e[1] * a + e[5] * b + e[9] * c, e[2] * a + e[6] * b + e[10] * c] : [a, b, c];
    const size = a => Math.abs(a[0]) * w + Math.abs(a[1]) * h + Math.abs(a[2]) * d;
    for (let f = 0; f < 6; f++) {
      if (f === 3 && !o.bottom) continue;
      if (f === 2 && o.top === false) continue;
      const F = FACES[f], su = size(F.u), sv = size(F.v);
      const cx = F.n[0] * w / 2, cy = F.n[1] * h / 2, cz = F.n[2] * d / 2;
      const nn = rot(F.n[0], F.n[1], F.n[2]);
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const l = rot(cx + (F.u[0] * a * su + F.v[0] * b * sv) / 2, cy + (F.u[1] * a * su + F.v[1] * b * sv) / 2, cz + (F.u[2] * a * su + F.v[2] * b * sv) / 2);
        this.p.push(x + l[0], y + l[1], z + l[2]); this.n.push(nn[0], nn[1], nn[2]);
        if (unit) this.uv.push((a + 1) / 2 * (o.ru || 1), (b + 1) / 2 * (o.rv || 1));
        else this.uv.push((a + 1) / 2 * su / s + (o.uo || 0), F.n[1] === 0 ? (y + l[1]) / s : (b + 1) / 2 * sv / s);
        this.c.push(col[0], col[1], col[2]);
      }
      const k = this.k; this.i.push(k, k + 1, k + 2, k, k + 2, k + 3); this.k += 4;
    }
    return this;
  }
  get empty(){ return !this.k; }
  geometry(){
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i); g.computeBoundingSphere();
    return g;
  }
}

/* ---------- the nine guns, earned by words spelled right ---------- */
// Parts are boxes in the gun's own space (barrel along -z): [x, y, z, w, h, d, material, extra].
// Materials: k black, m metal, l light metal, t tan, o olive, w wood, c copper, n navy, r red, and glowing e orange,
// b blue, g green, p pink.
const HANDS = [[-.025, -.05, -.34, .09, .07, .13, 'v'], [-.07, -.09, -.18, .1, .09, .2, 's', {ry: .4}], [.02, -.07, .07, .08, .1, .1, 'v'], [.05, -.13, .22, .11, .11, .25, 's', {ry: -.3}]];
const GUNS = [
  {id: 'pistol', name: 'Blaster Pistol', words: 0, dmg: 26, rate: 3.6, mag: 12, pack: Infinity, spread: .012, ads: .004, range: 70, reload: 1.0, recoil: .02, zoom: .82, kind: 'hit', tracer: 0xffc04a, sfx: 'pistol', sight: .067, muzzle: [0, .03, -.26],
    hands: [[0, -.08, .05, .08, .1, .1, 'v'], [.04, -.14, .2, .11, .11, .25, 's', {ry: -.3}], [-.035, -.09, .0, .08, .08, .1, 'v'], [-.09, -.13, .16, .1, .1, .22, 's', {ry: .4}]],
    parts: [[0, .03, -.08, .05, .06, .26, 'l'], [0, -.015, -.06, .045, .04, .2, 'k'], [0, -.09, .03, .045, .13, .07, 'k', {rx: -.25}], [0, .03, -.225, .02, .02, .03, 'm'], [0, .045, -.07, .053, .012, .18, 'e'], [0, .067, .03, .04, .015, .015, 'k'], [0, .067, -.2, .008, .015, .01, 'k']]},
  {id: 'smg', name: 'Rapid SMG', words: 15, dmg: 15, rate: 11, mag: 32, pack: 32, spread: .036, ads: .016, range: 45, reload: 1.4, recoil: .01, zoom: .8, kind: 'hit', tracer: 0x7af6ff, sfx: 'smg', sight: .075, muzzle: [0, .01, -.43],
    parts: [[0, 0, -.05, .06, .09, .3, 'k'], [0, .01, -.28, .045, .05, .16, 'm'], [0, .01, -.39, .02, .02, .06, 'm'], [0, -.14, -.12, .04, .2, .06, 'm'], [0, -.09, .06, .04, .12, .06, 'k', {rx: -.25}], [0, -.01, .2, .03, .04, .2, 'm'], [0, .055, -.05, .03, .02, .18, 'm'], [0, .075, -.18, .006, .03, .01, 'm'], [0, .07, .02, .03, .02, .01, 'm'], [0, 0, -.1, .062, .02, .08, 'b']]},
  {id: 'shotgun', name: 'Scatter Shotgun', words: 35, dmg: 13, pellets: 9, rate: 1.3, mag: 6, pack: 6, spread: .09, ads: .065, range: 24, reload: 1.9, recoil: .07, zoom: .85, kind: 'hit', tracer: 0xffd27a, sfx: 'shotgun', sight: .05, muzzle: [0, .02, -.78],
    parts: [[0, .02, -.42, .05, .05, .7, 'm'], [0, -.035, -.36, .04, .04, .55, 'k'], [0, -.035, -.34, .07, .06, .2, 'w'], [0, 0, 0, .065, .09, .24, 'k'], [0, -.04, .27, .06, .11, .34, 'w'], [0, -.08, .08, .045, .1, .06, 'k', {rx: -.3}], [0, .05, -.76, .012, .012, .012, 'l'], [.04, 0, -.02, .012, .03, .03, 'r'], [.04, 0, .03, .012, .03, .03, 'r'], [.04, 0, .08, .012, .03, .03, 'r']]},
  {id: 'rifle', name: 'Assault Rifle', words: 60, dmg: 24, rate: 8.5, mag: 30, pack: 30, spread: .022, ads: .005, range: 90, reload: 1.6, recoil: .013, zoom: .62, kind: 'hit', tracer: 0xffe08a, sfx: 'rifle', sight: .09, muzzle: [0, .012, -.78],
    parts: [[0, 0, 0, .07, .1, .42, 't'], [0, .005, -.33, .06, .085, .3, 't'], [0, .057, -.12, .05, .015, .55, 'm'], [0, .012, -.6, .024, .024, .26, 'm'], [0, .012, -.74, .03, .03, .06, 'm'], [0, -.12, -.06, .05, .17, .08, 'm', {rx: .25}], [0, -.09, .14, .04, .12, .06, 'm', {rx: -.3}], [0, -.01, .32, .06, .09, .24, 't'],
      [0, .068, -.06, .03, .022, .06, 'm'], [0, .116, -.09, .052, .006, .03, 'm'], [0, .064, -.09, .052, .006, .03, 'm'], [-.023, .09, -.09, .006, .052, .03, 'm'], [.023, .09, -.09, .006, .052, .03, 'm'], [0, .09, -.09, .007, .007, .002, 'r2']]},
  {id: 'rail', name: 'Rail Sniper', words: 100, dmg: 150, rate: .9, mag: 5, pack: 5, spread: .03, ads: 0, range: 160, reload: 2.0, recoil: .07, zoom: .28, kind: 'rail', pierce: 3, tracer: 0x6ad8ff, sfx: 'rail', scope: true, sight: .085, muzzle: [0, .01, -.93],
    parts: [[0, 0, -.1, .06, .09, .5, 'l'], [0, .01, -.62, .03, .03, .6, 'm'], [.025, .035, -.55, .012, .012, .55, 'b'], [-.025, .035, -.55, .012, .012, .55, 'b'], [0, .085, -.08, .05, .05, .32, 'k'], [0, .085, -.24, .04, .04, .005, 'b'], [0, .055, 0, .03, .04, .03, 'k'], [0, .055, -.16, .03, .04, .03, 'k'],
      [0, -.09, -.08, .05, .1, .08, 'm'], [0, -.09, .09, .04, .12, .06, 'k', {rx: -.3}], [0, -.02, .3, .06, .12, .26, 'l'], [0, .04, .3, .05, .03, .12, 'k']]},
  {id: 'plasma', name: 'Plasma Rifle', words: 150, dmg: 34, rate: 6, mag: 40, pack: 40, spread: .02, ads: .008, speed: 45, splash: 1.4, reload: 1.6, recoil: .012, zoom: .7, kind: 'proj', color: 0x7cff3a, sfx: 'plasma', sight: .095, muzzle: [0, 0, -.46],
    parts: [[0, 0, -.02, .09, .12, .38, 'n'], [0, 0, -.3, .1, .1, .18, 'k'], [0, 0, -.24, .11, .02, .02, 'g'], [0, 0, -.3, .11, .02, .02, 'g'], [0, 0, -.36, .11, .02, .02, 'g'], [0, 0, -.42, .05, .05, .06, 'g'], [0, .085, -.05, .03, .04, .2, 'k'], [0, .095, -.15, .01, .01, .004, 'g'], [0, -.1, .06, .045, .12, .06, 'k', {rx: -.25}], [0, -.08, -.1, .05, .08, .1, 'g'], [0, -.01, .28, .07, .1, .22, 'n']]},
  {id: 'rocket', name: 'Rocket Launcher', words: 220, dmg: 170, rate: .8, mag: 4, pack: 4, spread: .01, ads: .004, speed: 26, splash: 4.2, reload: 2.2, recoil: .09, zoom: .75, kind: 'rocket', color: 0xff9a2f, sfx: 'rocket', sight: .09, muzzle: [0, .02, -.64],
    parts: [[0, .02, -.15, .14, .14, .9, 'o'], [0, .02, -.6, .16, .16, .04, 'k'], [0, .02, .3, .16, .16, .04, 'k'], [0, .02, -.62, .08, .08, .06, 'r'], [.09, .09, -.15, .05, .06, .08, 'k'], [.09, .1, -.19, .03, .02, .004, 'e'], [0, -.11, -.05, .045, .12, .06, 'k', {rx: -.25}], [0, -.1, -.35, .04, .1, .05, 'k']]},
  {id: 'minigun', name: 'Mega Minigun', words: 300, dmg: 13, rate: 22, mag: 150, pack: 150, spread: .04, ads: .026, range: 70, reload: 3.0, recoil: .005, zoom: .85, kind: 'hit', tracer: 0xffb44a, sfx: 'minigun', spin: .45, sight: .1, muzzle: [0, 0, -.7],
    spinParts: [0, 1, 2, 3, 4, 5].map(k => [Math.cos(k * Math.PI / 3) * .035, Math.sin(k * Math.PI / 3) * .035, -.38, .02, .02, .56, 'm']),
    parts: [[0, 0, -.02, .12, .12, .3, 'k'], [0, 0, -.66, .11, .11, .03, 'm'], [0, 0, -.42, .1, .1, .03, 'm'], [-.11, -.06, 0, .1, .12, .16, 'o'], [0, .1, -.02, .03, .03, .22, 'k'], [0, .07, .06, .02, .06, .02, 'k'], [0, .07, -.1, .02, .06, .02, 'k'], [0, -.12, .06, .045, .12, .06, 'k', {rx: -.25}], [0, -.065, -.1, .08, .01, .1, 'e']]},
  {id: 'tesla', name: 'Lightning Cannon', words: 400, dmg: 60, rate: 2.2, mag: 16, pack: 16, range: 36, chain: 4, reload: 1.8, recoil: .035, zoom: .8, kind: 'tesla', sfx: 'tesla', sight: .12, muzzle: [0, 0, -.5],
    parts: [[0, 0, -.02, .1, .12, .32, 'c'], [.04, 0, -.32, .025, .025, .3, 'l'], [-.04, 0, -.32, .025, .025, .3, 'l'], [.04, 0, -.48, .035, .035, .035, 'b'], [-.04, 0, -.48, .035, .035, .035, 'b'], [0, 0, -.08, .11, .02, .04, 'b'], [0, 0, -.14, .11, .02, .04, 'b'], [0, 0, -.2, .11, .02, .04, 'b'], [0, .09, -.02, .06, .06, .18, 'k'], [0, -.1, .08, .045, .12, .06, 'k', {rx: -.25}], [0, -.01, .26, .07, .09, .18, 'c']]},
];
// A small side-on picture of each gun for the buttons, drawn from its own parts.
function gunIcon(g, col = '#fff'){
  const ps = [...g.parts, ...(g.spinParts || [])], minZ = Math.min(...ps.map(p => p[2] - p[5] / 2)), maxZ = Math.max(...ps.map(p => p[2] + p[5] / 2));
  const minY = Math.min(...ps.map(p => p[1] - p[4] / 2)), maxY = Math.max(...ps.map(p => p[1] + p[4] / 2)), sc = Math.min(96 / (maxZ - minZ), 44 / (maxY - minY));
  const rects = ps.map(([, y, z, , h, d]) => `<rect x="${((maxZ - (z + d / 2)) * sc + 2).toFixed(1)}" y="${((maxY - (y + h / 2)) * sc + 2).toFixed(1)}" width="${Math.max(1.5, d * sc).toFixed(1)}" height="${Math.max(1.5, h * sc).toFixed(1)}" rx="1"/>`).join('');
  return `<svg viewBox="0 0 100 48" fill="${col}" aria-hidden="true">${rects}</svg>`;
}

/* ---------- the bad guys ---------- */
// Each robot is boxes on bones: parts are [bone, x, y, z, w, h, d, colour key, extra] in the robot's own space (feet at 0,
// facing +z); bones are pivots in the same space, a child's listed after its parent (tree). glow keys shine in the dark,
// trans keys are see-through energy. spheres are where it can be hit: [x, y, z, radius, 'head'|'core'|'shield'].
const sides = (f) => [-1, 1].flatMap(s => f(s));
const BIPED = {legL: 'root', legR: 'root', body: 'root', head: 'body', armL: 'body', armR: 'body'};
const BOTS = {
  scout: {name: 'Zapper', tip: 'Fast. Zaps you up close.', hp: 40, speed: 4.3, r: .38, eye: 1.15, ai: 'melee', reach: 1.7, dmg: 8, cd: .9, score: 75, anim: 'biped', step: 11,
    pal: {a: '#cfd5de', d: '#2b3240', j: '#20242b', e: '#3ff0ff'}, glow: 'e',
    bones: {body: [0, .62, 0], legL: [-.12, .62, 0], legR: [.12, .62, 0], head: [0, 1.0, 0], armL: [-.26, .9, 0], armR: [.26, .9, 0]}, tree: BIPED,
    parts: [...sides(s => [[s < 0 ? 'legL' : 'legR', s * .12, .4, 0, .1, .42, .12, 'j'], [s < 0 ? 'legL' : 'legR', s * .12, .05, .05, .16, .1, .24, 'a'],
      [s < 0 ? 'armL' : 'armR', s * .26, .78, 0, .08, .28, .1, 'j'], [s < 0 ? 'armL' : 'armR', s * .26, .6, .06, .1, .1, .1, 'a'], [s < 0 ? 'armL' : 'armR', s * .26, .54, .1, .05, .05, .12, 'e'],
      ['head', s * .27, 1.15, 0, .06, .18, .18, 'd']]),
      ['body', 0, .66, 0, .32, .12, .22, 'j'], ['body', 0, .82, 0, .38, .3, .28, 'a'], ['body', 0, .84, .15, .12, .12, .02, 'e'],
      ['head', 0, 1.15, 0, .5, .38, .44, 'a'], ['head', 0, 1.13, .2, .38, .26, .06, 'd'], ['head', 0, 1.15, .24, .2, .2, .02, 'e'], ['head', 0, 1.42, -.05, .03, .2, .03, 'j'], ['head', 0, 1.54, -.05, .07, .07, .07, 'e']],
    spheres: [[0, .8, 0, .3], [0, 1.15, 0, .3, 'head'], [0, .35, 0, .25]]},
  trooper: {name: 'Trooper', tip: 'Shoots laser bolts. Dodge them!', hp: 70, speed: 2.4, r: .45, eye: 1.98, ai: 'gunner', range: [7, 17], score: 100, anim: 'biped', step: 7,
    gun: {dmg: 7, speed: 15, cd: 1.6, burst: 1, spread: .05, color: 0xff3b2f, size: .5}, muzzle: [[.12, 1.27, 1.02]],
    pal: {a: '#55603f', d: '#343a2c', j: '#1c1d1e', e: '#ff2a1a', g: '#151617'}, glow: 'e',
    bones: {body: [0, .95, 0], legL: [-.17, .95, 0], legR: [.17, .95, 0], head: [0, 1.76, 0], armL: [-.43, 1.62, 0], armR: [.43, 1.62, 0]}, tree: BIPED,
    parts: [...sides(s => { const L = s < 0 ? 'legL' : 'legR', A = s < 0 ? 'armL' : 'armR'; return [[L, s * .17, .71, 0, .2, .48, .22, 'd'], [L, s * .17, .27, .02, .17, .48, .19, 'j'], [L, s * .17, .05, .06, .22, .14, .32, 'd'], [L, s * .17, .48, .12, .21, .14, .1, 'a'],
      [A, s * .43, 1.62, 0, .28, .2, .36, 'a'], [A, s * .43, 1.3, .08, .15, .5, .17, 'j']]; }),
      ['body', 0, 1.0, 0, .5, .2, .3, 'j'], ['body', 0, 1.38, 0, .66, .62, .38, 'a'], ['body', 0, 1.42, .21, .5, .4, .1, 'd'], ['body', -.12, 1.55, .27, .12, .06, .02, 'e'],
      ['head', 0, 1.76, 0, .12, .16, .14, 'j'], ['head', 0, 1.98, 0, .4, .34, .38, 'a'], ['head', 0, 2.15, -.01, .46, .08, .44, 'd'], ['head', 0, 1.98, .2, .32, .07, .03, 'e'], ['head', .14, 2.3, -.1, .02, .3, .02, 'j'],
      ['armR', .12, 1.25, .35, .09, .13, .75, 'g'], ['armR', .12, 1.11, .4, .06, .2, .1, 'g'], ['armR', .12, 1.27, .85, .04, .04, .3, 'g']],
    spheres: [[0, 1.35, 0, .42], [0, 1.98, 0, .26, 'head'], [0, .6, 0, .35]]},
  spider: {name: 'Skitter', tip: 'Jumps at you!', hp: 35, speed: 5.0, r: .6, eye: .6, ai: 'pounce', reach: 1.6, dmg: 9, cd: 1.6, score: 80, anim: 'spider', step: 16,
    pal: {a: '#3d4249', d: '#262a30', j: '#15171a', e: '#7cff3a'}, glow: 'e',
    bones: {body: [0, .55, 0], legA: [-.45, .55, .35], legB: [.45, .55, .35], legC: [-.45, .55, -.35], legD: [.45, .55, -.35]}, tree: {body: 'root', legA: 'root', legB: 'root', legC: 'root', legD: 'root'},
    parts: [['body', 0, .55, 0, .9, .32, 1.0, 'a'], ['body', 0, .75, -.05, .7, .14, .8, 'd'], ['body', 0, .55, .58, .5, .26, .24, 'd'],
      ...sides(s => [['body', s * .08, .6, .71, .06, .06, .02, 'e'], ['body', s * .18, .55, .71, .05, .05, .02, 'e'], ['body', s * .1, .4, .68, .05, .12, .05, 'j']]),
      ...[['legA', -1, 1], ['legB', 1, 1], ['legC', -1, -1], ['legD', 1, -1]].flatMap(([b, sx, sz]) => [[b, sx * .75, .75, sz * .45, .5, .08, .08, 'j'], [b, sx * 1.0, .38, sz * .5, .08, .75, .08, 'a'], [b, sx * 1.0, .02, sz * .5, .1, .05, .1, 'j']])],
    spheres: [[0, .6, 0, .55], [0, .55, .55, .25, 'head']]},
  drone: {name: 'Hornet', tip: 'Flies. Look up!', hp: 50, speed: 3.6, r: .7, eye: 0, ai: 'gunner', fly: 3.8, range: [6, 14], score: 120, anim: 'hover',
    gun: {dmg: 6, speed: 14, cd: 1.3, burst: 2, gap: .18, spread: .06, color: 0xffd84a, size: .45}, muzzle: [[0, -.2, .5]],
    pal: {a: '#1c1d21', d: '#2f3238', j: '#111111', y: '#ffc21a', e: '#ffd84a', g: '#222222', r: '#555a63'}, glow: 'e',
    bones: {body: [0, 0, 0], rA: [-.6, .12, .6], rB: [.6, .12, .6], rC: [-.6, .12, -.6], rD: [.6, .12, -.6]}, tree: {body: 'root', rA: 'body', rB: 'body', rC: 'body', rD: 'body'},
    parts: [['body', 0, 0, 0, .8, .28, .8, 'a'], ['body', 0, .2, 0, .5, .16, .5, 'd'], ['body', 0, .02, .41, .7, .08, .02, 'y'], ['body', 0, -.02, .42, .22, .12, .02, 'e'],
      ['body', 0, .06, 0, 1.6, .06, .08, 'j', {ry: Math.PI / 4}], ['body', 0, .06, 0, 1.6, .06, .08, 'j', {ry: -Math.PI / 4}], ['body', 0, -.2, .2, .1, .1, .5, 'g'], ['body', 0, -.15, 0, .3, .02, .3, 'e'],
      ...['rA', 'rB', 'rC', 'rD'].flatMap(b => { const p = {rA: [-.6, .6], rB: [.6, .6], rC: [-.6, -.6], rD: [.6, -.6]}[b]; return [[b, p[0], .12, p[1], .62, .02, .08, 'r'], [b, p[0], .12, p[1], .08, .02, .62, 'r'], [b, p[0], .08, p[1], .1, .08, .1, 'j']]; })],
    spheres: [[0, 0, 0, .55], [0, 0, .4, .16, 'head']]},
  brute: {name: 'Crusher', tip: 'Tough. Hit the glowing core!', hp: 320, speed: 1.5, r: .95, eye: 2.68, ai: 'gunner', range: [5, 15], score: 300, anim: 'biped', step: 4.5, heavy: true,
    gun: {dmg: 8, speed: 13, cd: 2.6, burst: 3, gap: .16, spread: .06, color: 0xff7a1a, size: .6}, muzzle: [[-1.0, 1.95, 1.15], [1.0, 1.95, 1.15]],
    pal: {a: '#59606b', d: '#33373e', j: '#1d2024', e: '#ff7a1a', g: '#2a2d33'}, glow: 'e',
    bones: {body: [0, 1.35, 0], legL: [-.38, 1.35, 0], legR: [.38, 1.35, 0], head: [0, 2.55, .05], armL: [-.95, 2.35, 0], armR: [.95, 2.35, 0]}, tree: BIPED,
    parts: [...sides(s => { const L = s < 0 ? 'legL' : 'legR', A = s < 0 ? 'armL' : 'armR'; return [[L, s * .38, 1.0, 0, .42, .7, .5, 'd'], [L, s * .38, .45, .05, .38, .55, .46, 'a'], [L, s * .38, .1, .12, .5, .2, .7, 'd'],
      [A, s * .95, 2.45, 0, .55, .4, .7, 'a'], [A, s * 1.0, 1.95, .35, .36, .36, 1.1, 'g'], [A, s * 1.0, 1.95, .95, .2, .2, .3, 'j'], [A, s * 1.0, 1.95, 1.11, .14, .14, .02, 'e'], [A, s * .98, 2.2, .1, .22, .4, .22, 'j'], ['body', s * .35, 2.6, -.6, .14, .3, .14, 'j']]; }),
      ['body', 0, 1.4, 0, .9, .3, .55, 'j'], ['body', 0, 2.0, 0, 1.5, 1.0, .9, 'a'], ['body', 0, 1.6, .05, 1.1, .3, .7, 'd'], ['body', 0, 2.05, .47, .5, .5, .06, 'd'], ['body', 0, 2.05, .5, .3, .3, .04, 'e'], ['body', 0, 2.1, -.55, 1.0, .8, .3, 'd'],
      ['head', 0, 2.68, .1, .5, .36, .5, 'a'], ['head', 0, 2.7, .36, .4, .08, .02, 'e']],
    spheres: [[0, 2.0, 0, .9], [0, 2.05, .5, .3, 'core'], [0, .8, 0, .6], [0, 2.68, .1, .32, 'head']]},
  roller: {name: 'Boomer', tip: 'Rolls in and explodes. Shoot it far away!', hp: 30, speed: 5.4, r: .45, eye: .5, ai: 'roller', reach: 1.9, dmg: 24, score: 90, anim: 'roll',
    pal: {a: '#b3261e', d: '#7a1912', j: '#1a1a1a', e: '#ffdf3a'}, glow: 'e',
    bones: {body: [0, .5, 0]}, tree: {body: 'root'},
    parts: [['body', 0, .5, 0, .8, .8, .8, 'a'], ['body', 0, .5, 0, .78, .78, .78, 'd', {ry: .785}], ['body', 0, .5, 0, .86, .16, .86, 'j'], ['body', 0, .5, 0, .16, .86, .86, 'j'], ['body', 0, .92, 0, .2, .1, .2, 'e'], ['body', 0, .55, .42, .18, .18, .02, 'e']],
    spheres: [[0, .5, 0, .5]]},
  shield: {name: 'Riot Bot', tip: 'Shield in front. Hit it from the side!', hp: 140, speed: 2.2, r: .5, eye: 1.98, ai: 'shield', reach: 2.1, dmg: 12, cd: 1.6, score: 200, anim: 'biped', step: 6.5,
    pal: {a: '#2f6fd6', d: '#1d3f7a', j: '#151a24', e: '#e8f6ff', g: '#222222', h: '#58c8ff'}, glow: 'e', trans: 'h',
    bones: {body: [0, .95, 0], legL: [-.17, .95, 0], legR: [.17, .95, 0], head: [0, 1.76, 0], armL: [-.43, 1.62, 0], armR: [.43, 1.62, 0]}, tree: BIPED,
    parts: [...sides(s => { const L = s < 0 ? 'legL' : 'legR', A = s < 0 ? 'armL' : 'armR'; return [[L, s * .17, .71, 0, .22, .48, .24, 'd'], [L, s * .17, .27, .02, .19, .48, .2, 'j'], [L, s * .17, .05, .06, .24, .14, .34, 'd'], [A, s * .43, 1.62, 0, .3, .22, .38, 'a'], [A, s * .43, 1.3, .08, .16, .5, .18, 'j']]; }),
      ['body', 0, 1.0, 0, .52, .2, .3, 'j'], ['body', 0, 1.38, 0, .7, .62, .4, 'a'], ['body', 0, 1.42, .22, .5, .4, .06, 'd'],
      ['head', 0, 1.76, 0, .12, .16, .14, 'j'], ['head', 0, 1.98, 0, .42, .36, .4, 'a'], ['head', 0, 1.98, .21, .34, .1, .02, 'e'], ['head', 0, 2.18, 0, .1, .1, .36, 'd'],
      ['armR', .45, 1.0, .25, .06, .06, .7, 'g'], ['armR', .45, 1.0, .62, .07, .07, .1, 'e'],
      ['armL', -.1, 1.3, .62, 1.3, 1.8, .06, 'h'], ['armL', -.1, 2.22, .62, 1.32, .06, .1, 'j'], ['armL', -.1, .42, .62, 1.32, .06, .1, 'j'], ['armL', -.75, 1.3, .62, .06, 1.8, .1, 'j'], ['armL', .55, 1.3, .62, .06, 1.8, .1, 'j']],
    spheres: [[0, 1.0, .68, .6, 'shield'], [0, 1.8, .68, .6, 'shield'], [0, 1.35, 0, .44], [0, 1.98, 0, .26, 'head'], [0, .6, 0, .36]]},
  sniper: {name: 'Longshot', tip: 'Red laser? Move!', hp: 60, speed: 2.0, r: .4, eye: 2.35, ai: 'sniper', range: [13, 30], score: 180, anim: 'biped', step: 6,
    gun: {dmg: 24, speed: 46, cd: 4.2, color: 0xff3bd4, size: .55, aim: 1.2, lock: .45}, muzzle: [[.2, 1.62, 1.82]],
    pal: {a: '#6b4bb3', d: '#3a2a66', j: '#1a1726', e: '#ff3bd4', g: '#23202b'}, glow: 'e',
    bones: {body: [0, 1.25, 0], legL: [-.14, 1.25, 0], legR: [.14, 1.25, 0], head: [0, 2.2, 0], armL: [-.35, 2.0, 0], armR: [.35, 2.0, 0]}, tree: BIPED,
    parts: [...sides(s => { const L = s < 0 ? 'legL' : 'legR'; return [[L, s * .14, .95, 0, .14, .6, .16, 'd'], [L, s * .14, .4, .02, .12, .55, .14, 'j'], [L, s * .14, .05, .08, .18, .1, .3, 'a']]; }),
      ['body', 0, 1.3, 0, .36, .16, .24, 'j'], ['body', 0, 1.7, 0, .48, .7, .3, 'a'], ['body', 0, 1.7, -.18, .5, .8, .06, 'd'],
      ['head', 0, 2.35, 0, .3, .3, .32, 'a'], ['head', 0, 2.37, .16, .26, .05, .02, 'e'], ['head', 0, 2.55, -.05, .04, .16, .26, 'd'],
      ['armR', .35, 1.75, .1, .1, .5, .12, 'j'], ['armR', .2, 1.6, .5, .1, .14, .9, 'g'], ['armR', .2, 1.62, 1.35, .05, .05, .9, 'g'], ['armR', .2, 1.74, .45, .07, .07, .35, 'j'], ['armR', .2, 1.74, .63, .06, .06, .02, 'e'],
      ['armL', -.35, 1.75, .15, .1, .5, .12, 'j']],
    spheres: [[0, 1.7, 0, .36], [0, 2.35, 0, .22, 'head'], [0, .8, 0, .3]]},
  blink: {name: 'Phantom', tip: 'Teleports next to you!', hp: 70, speed: 3.4, r: .4, eye: 1.85, ai: 'blink', reach: 2.2, dmg: 12, cd: 1.3, score: 220, anim: 'biped', step: 9,
    pal: {a: '#1b1d22', d: '#2e3138', j: '#0e0f12', e: '#ff2fd6'}, glow: 'e',
    bones: {body: [0, .9, 0], legL: [-.15, .9, 0], legR: [.15, .9, 0], head: [0, 1.65, 0], armL: [-.33, 1.6, 0], armR: [.33, 1.6, 0]}, tree: BIPED,
    parts: [...sides(s => { const L = s < 0 ? 'legL' : 'legR', A = s < 0 ? 'armL' : 'armR'; return [[L, s * .15, .7, 0, .14, .5, .16, 'a'], [L, s * .15, .25, .03, .12, .45, .14, 'j'], [L, s * .15, .04, .07, .16, .08, .26, 'a'], [A, s * .33, 1.4, 0, .1, .5, .12, 'j'], [A, s * .33, 1.1, .03, .12, .12, .12, 'a'], ['head', s * .12, 2.05, -.02, .04, .14, .04, 'd']]; }),
      ['body', 0, 1.0, 0, .36, .16, .22, 'j'], ['body', 0, 1.35, 0, .52, .55, .3, 'a'], ['body', 0, 1.4, .16, .06, .4, .02, 'e'], ['body', 0, 1.5, -.17, .4, .3, .04, 'd'],
      ['head', 0, 1.85, 0, .32, .3, .32, 'a'], ['head', 0, 1.86, .17, .28, .06, .02, 'e'], ['armR', .33, 1.1, .45, .04, .1, .8, 'e']],
    spheres: [[0, 1.3, 0, .36], [0, 1.85, 0, .22, 'head'], [0, .55, 0, .3]]},
  gunship: {name: 'Vulture', tip: 'Fires rockets from the sky.', hp: 260, speed: 2.8, r: 1.3, eye: 0, ai: 'gunner', fly: 5.6, range: [8, 18], score: 400, anim: 'hover', heavy: true,
    gun: {dmg: 16, speed: 11, cd: 3.0, burst: 2, gap: .35, spread: .04, color: 0xff9a2f, size: .9, splash: 2.6}, muzzle: [[-1.25, -.25, .85], [1.25, -.25, .85]],
    pal: {a: '#4b5a3c', d: '#2b3324', j: '#141414', e: '#ff3b2f', g: '#2a2a2a', o: '#ff9a2f', r: '#6a6f78', b: '#5fd0ff'}, glow: 'eob',
    bones: {body: [0, 0, 0], rA: [-1.1, .35, 1.0], rB: [1.1, .35, 1.0], rC: [-1.1, .35, -1.0], rD: [1.1, .35, -1.0]}, tree: {body: 'root', rA: 'body', rB: 'body', rC: 'body', rD: 'body'},
    parts: [['body', 0, 0, 0, 1.8, .6, 2.4, 'a'], ['body', 0, .25, .6, 1.0, .4, 1.0, 'd'], ['body', 0, .1, 1.21, .5, .14, .02, 'e'], ['body', 0, .15, -1.4, .5, .4, .8, 'd'], ['body', 0, .5, -1.6, .08, .5, .5, 'a'],
      ...sides(s => [['body', s * 1.1, 0, 0, .6, .12, 1.0, 'a'], ['body', s * 1.25, -.25, .3, .35, .35, 1.0, 'g'], ['body', s * 1.25, -.25, .81, .25, .25, .02, 'o'], ['body', s * .5, -.33, -.4, .4, .04, .4, 'b'], ['body', s * .8, .2, 0, .5, .08, .1, 'j']]),
      ...['rA', 'rB', 'rC', 'rD'].flatMap(b => { const p = {rA: [-1.1, 1.0], rB: [1.1, 1.0], rC: [-1.1, -1.0], rD: [1.1, -1.0]}[b]; return [[b, p[0], .35, p[1], 1.1, .03, .12, 'r'], [b, p[0], .35, p[1], .12, .03, 1.1, 'r'], [b, p[0], .3, p[1], .14, .1, .14, 'j']]; })],
    spheres: [[0, 0, 0, 1.25], [0, .25, .6, .5, 'head']]},
};
// The six bosses, one at the end of each zone. Their attacks are all shown first (a red ring, a warning line, a glow) so
// he can get out of the way.
const BOSSES = {
  tank: {name: 'Mega Tank', hp: 1400, speed: 1.1, r: 2.4, eye: 2.2, score: 3000, anim: 'tank', range: [9, 20],
    attacks: [{k: 'shell', w: 3, n: 1, dmg: 26, radius: 3.4, cd: 2.4}, {k: 'burst', w: 3, n: 8, dmg: 6, speed: 16, color: 0xffb03d, cd: 2.2, from: 1}, {k: 'summon', w: 1, type: 'scout', n: 2, cd: 2}],
    muzzle: [[0, 1.95, 3.45], [-.7, 2.45, 1.1]], pal: {a: '#6b6f45', d: '#45482c', j: '#1a1a17', e: '#ff3020', g: '#262626'}, glow: 'e',
    bones: {body: [0, 0, 0], turret: [0, 1.55, -.2]}, tree: {body: 'root', turret: 'body'},
    parts: [...sides(s => [['body', s * 1.55, .55, 0, .7, 1.1, 5.2, 'j'], ...[-2, -1, 0, 1, 2].map(z => ['body', s * 1.92, .45, z, .04, .5, .5, 'd']), ['body', s * .8, 1.05, 2.33, .3, .15, .02, 'e']]),
      ['body', 0, 1.0, 0, 2.5, .9, 4.6, 'a'], ['body', 0, .85, 2.45, 2.4, .6, .4, 'd'], ['body', 0, 1.48, -.3, 2.2, .1, 3.0, 'd'],
      ['turret', 0, 1.95, -.2, 2.2, .8, 2.4, 'a'], ['turret', 0, 2.4, -.3, 1.6, .15, 1.8, 'd'], ['turret', 0, 1.95, 1.9, .34, .34, 2.6, 'g'], ['turret', 0, 1.95, 3.25, .5, .5, .3, 'j'],
      ['turret', .7, 2.25, .9, .3, .2, .02, 'e'], ['turret', -.7, 2.45, .6, .12, .12, .9, 'g'], ['turret', .3, 2.5, -.7, .6, .1, .6, 'j']],
    spheres: [[0, 1.0, 0, 1.6], [0, 1.0, 1.6, 1.3], [0, 1.0, -1.6, 1.3], [0, 2.1, -.2, 1.2, 'head']]},
  crab: {name: 'Crab Crusher', hp: 2000, speed: 1.6, r: 2.6, eye: 3.3, score: 4000, anim: 'crab', range: [6, 16],
    attacks: [{k: 'volley', w: 3, n: 7, arc: .9, dmg: 8, speed: 13, color: 0xffe14a, cd: 2}, {k: 'shell', w: 2, n: 3, dmg: 22, radius: 3, cd: 2.6}, {k: 'stomp', w: 2, radius: 6.5, dmg: 22, cd: 2.2}, {k: 'summon', w: 1, type: 'spider', n: 2, cd: 2}],
    muzzle: [[0, 2.0, 1.4]], pal: {a: '#c44a2c', d: '#7a2a18', j: '#2a1d1a', e: '#ffe14a', g: '#303030', o: '#ff6a1a'}, glow: 'eo',
    bones: {body: [0, 2.2, 0], L1: [-1.6, 2.2, 1], L2: [-1.6, 2.2, 0], L3: [-1.6, 2.2, -1], R1: [1.6, 2.2, 1], R2: [1.6, 2.2, 0], R3: [1.6, 2.2, -1], clawL: [-1.3, 2.0, 1.6], clawR: [1.3, 2.0, 1.6]},
    tree: {body: 'root', L1: 'root', L2: 'root', L3: 'root', R1: 'root', R2: 'root', R3: 'root', clawL: 'body', clawR: 'body'},
    parts: [['body', 0, 2.3, 0, 3.4, 1.0, 2.6, 'a'], ['body', 0, 2.9, -.1, 2.6, .3, 2.0, 'd'], ['body', 0, 2.0, 1.32, 1.2, .3, .04, 'd'], ['body', 0, 3.15, -.8, 1.4, .4, .8, 'g'], ['body', 0, 3.36, -.8, 1.0, .02, .5, 'o'],
      ...sides(s => [['body', s * 1.0, 3.15, .6, .2, .3, .2, 'j'], ['body', s * 1.0, 3.15, -.6, .2, .3, .2, 'j'], ['body', s * .5, 3.1, 1.2, .12, .5, .12, 'j'], ['body', s * .5, 3.4, 1.2, .26, .26, .26, 'e'],
        [s < 0 ? 'clawL' : 'clawR', s * 1.6, 1.9, 2.2, .4, .4, 1.4, 'a'], [s < 0 ? 'clawL' : 'clawR', s * 1.6, 2.15, 3.1, .5, .25, .9, 'd'], [s < 0 ? 'clawL' : 'clawR', s * 1.6, 1.65, 3.05, .5, .2, .8, 'd']]),
      ...[['L1', -1, 1], ['L2', -1, 0], ['L3', -1, -1], ['R1', 1, 1], ['R2', 1, 0], ['R3', 1, -1]].flatMap(([b, s, z]) => [[b, s * 2.2, 2.6, z, 1.2, .2, .22, 'a'], [b, s * 2.8, 1.3, z, .22, 2.6, .22, 'd'], [b, s * 2.8, .05, z, .3, .1, .3, 'j']])],
    spheres: [[0, 2.4, 0, 1.7], [0, 3.3, 1.2, .5, 'head'], [-1.6, 2.0, 2.7, .7], [1.6, 2.0, 2.7, .7]]},
  foreman: {name: 'The Foreman', hp: 2600, speed: 1.4, r: 2.0, eye: 4.8, score: 5000, anim: 'biped', step: 3, range: [5, 14],
    attacks: [{k: 'stomp', w: 3, radius: 7, dmg: 24, cd: 2.2}, {k: 'volley', w: 3, n: 5, arc: .6, dmg: 9, speed: 12, color: 0xc9ccd1, size: .8, cd: 2.2, from: 1}, {k: 'summon', w: 1, type: 'scout', n: 3, cd: 2}],
    muzzle: [[0, 3.8, 1.0], [-1.6, 2.3, 1.2], [1.6, 2.3, 1.2]], pal: {a: '#8a8f96', d: '#4a4e55', j: '#24262a', y: '#ffc21a', e: '#ff8a1a', o: '#ff5a1a', s: '#c9ccd1'}, glow: 'eo',
    bones: {body: [0, 2.4, 0], legL: [-.6, 2.4, 0], legR: [.6, 2.4, 0], head: [0, 4.5, 0], armL: [-1.5, 4.2, 0], armR: [1.5, 4.2, 0], sawL: [-1.6, 2.3, .55], sawR: [1.6, 2.3, .55]},
    tree: {legL: 'root', legR: 'root', body: 'root', head: 'body', armL: 'body', armR: 'body', sawL: 'armL', sawR: 'armR'},
    parts: [...sides(s => { const L = s < 0 ? 'legL' : 'legR', A = s < 0 ? 'armL' : 'armR', W = s < 0 ? 'sawL' : 'sawR'; return [[L, s * .6, 1.85, 0, .7, 1.2, .8, 'd'], [L, s * .6, .85, .1, .62, 1.2, .75, 'a'], [L, s * .6, .15, .3, .9, .3, 1.3, 'd'], [L, s * .6, 1.3, .48, .5, .3, .04, 'y'],
      [A, s * 1.5, 4.3, 0, .8, .7, .9, 'a'], [A, s * 1.55, 3.6, 0, .45, 1.2, .5, 'j'], [A, s * 1.6, 2.8, .25, .55, .8, .6, 'a'],
      [W, s * 1.6, 2.3, .55, .08, 1.4, 1.4, 's'], [W, s * 1.6, 2.3, .55, .08, 1.4, 1.4, 's', {rx: Math.PI / 4}], [W, s * 1.6, 2.3, .55, .2, .3, .3, 'j'],
      ['body', s * .6, 4.9, -.5, .3, 1.0, .3, 'j'], ['body', s * .6, 5.42, -.5, .32, .05, .32, 'o']]; }),
      ['body', 0, 2.5, 0, 1.6, .5, .9, 'j'], ['body', 0, 3.6, 0, 2.6, 1.8, 1.4, 'a'], ['body', 0, 2.95, .71, 2.4, .3, .02, 'y'], ['body', 0, 3.8, .71, 1.0, .4, .02, 'e'],
      ['head', 0, 4.85, .1, .9, .6, .8, 'y'], ['head', 0, 5.12, .2, 1.1, .1, 1.0, 'y'], ['head', 0, 4.75, .48, .7, .35, .04, 'd'], ['head', 0, 4.78, .5, .6, .12, .02, 'e']],
    spheres: [[0, 3.6, 0, 1.4], [0, 4.85, .1, .55, 'head'], [0, 1.4, 0, 1.0]]},
  scorpion: {name: 'Scorpion King', hp: 3000, speed: 1.9, r: 2.2, eye: 1.5, score: 6000, anim: 'crab', range: [7, 18],
    attacks: [{k: 'laser', w: 3, dmg: 22, cd: 2.6, from: 0}, {k: 'volley', w: 3, n: 6, arc: .8, dmg: 8, speed: 14, color: 0x3dff8a, cd: 2}, {k: 'summon', w: 1, type: 'spider', n: 3, cd: 2}],
    muzzle: [[0, 3.7, -.5], [0, 1.4, 2.4]], pal: {a: '#c2a15a', d: '#7d6533', j: '#2e2617', e: '#3dff8a', g: '#3a3a3a'}, glow: 'e',
    bones: {body: [0, 1.2, 0], L1: [-1.1, 1.3, 1], L2: [-1.1, 1.3, 0], L3: [-1.1, 1.3, -1], R1: [1.1, 1.3, 1], R2: [1.1, 1.3, 0], R3: [1.1, 1.3, -1], clawL: [-1, 1.2, 2.2], clawR: [1, 1.2, 2.2], tail: [0, 1.6, -1.5]},
    tree: {body: 'root', L1: 'root', L2: 'root', L3: 'root', R1: 'root', R2: 'root', R3: 'root', clawL: 'body', clawR: 'body', tail: 'body'},
    parts: [['body', 0, 1.3, 0, 2.2, .8, 3.2, 'a'], ['body', 0, 1.3, 1.9, 1.4, .6, .8, 'd'], ...[.8, 0, -.8].map(z => ['body', 0, 1.75, z, 2.0, .12, .6, 'd']),
      ...sides(s => [['body', s * .35, 1.5, 2.31, .2, .14, .02, 'e'], ['body', s * .15, 1.62, 2.31, .12, .1, .02, 'e'], [s < 0 ? 'clawL' : 'clawR', s * 1.0, 1.2, 2.6, .4, .3, 1.0, 'a'], [s < 0 ? 'clawL' : 'clawR', s * 1.0, 1.25, 3.3, .5, .35, .6, 'd']]),
      ...[['L1', -1, 1], ['L2', -1, 0], ['L3', -1, -1], ['R1', 1, 1], ['R2', 1, 0], ['R3', 1, -1]].flatMap(([b, s, z]) => [[b, s * 1.6, 1.5, z, 1.0, .16, .16, 'j'], [b, s * 2.1, .75, z, .16, 1.4, .16, 'a']]),
      ['tail', 0, 2.0, -1.9, .7, .8, 1.0, 'a'], ['tail', 0, 3.0, -2.3, .6, 1.0, .6, 'a'], ['tail', 0, 3.8, -1.8, .55, .5, .9, 'a'], ['tail', 0, 3.7, -1.0, .3, .3, .8, 'g'], ['tail', 0, 3.7, -.58, .2, .2, .04, 'e']],
    spheres: [[0, 1.3, 0, 1.6], [0, 1.4, 1.9, .7, 'head'], [0, 3.2, -2.0, .8]]},
  titan: {name: 'Neon Titan', hp: 3600, speed: 1.5, r: 2.0, eye: 5.3, score: 7000, anim: 'biped', step: 3, range: [6, 16],
    attacks: [{k: 'stomp', w: 2, radius: 7.5, dmg: 24, cd: 2.2}, {k: 'burst', w: 3, n: 12, dmg: 6, speed: 17, color: 0x19f2ff, cd: 2, from: 1}, {k: 'laser', w: 2, dmg: 22, cd: 2.6, from: 0}, {k: 'summon', w: 1, type: 'blink', n: 2, cd: 2}],
    muzzle: [[0, 5.3, .5], [-1.7, 2.7, 1.0], [1.7, 2.7, 1.0]], pal: {a: '#15171f', d: '#262a36', c: '#19f2ff', m: '#ff2fd6'}, glow: 'cm',
    bones: {body: [0, 2.6, 0], legL: [-.65, 2.6, 0], legR: [.65, 2.6, 0], head: [0, 4.9, 0], armL: [-1.6, 4.5, 0], armR: [1.6, 4.5, 0]}, tree: BIPED,
    parts: [...sides(s => { const L = s < 0 ? 'legL' : 'legR', A = s < 0 ? 'armL' : 'armR'; return [[L, s * .65, 2.0, 0, .7, 1.2, .7, 'a'], [L, s * .65, .95, .05, .6, 1.2, .65, 'd'], [L, s * .65, 1.6, .37, .1, 1.8, .02, 'c'], [L, s * .65, .15, .25, .9, .3, 1.2, 'a'],
      [A, s * 1.6, 4.4, 0, .7, .6, .8, 'a'], [A, s * 1.65, 3.5, .1, .45, 1.4, .5, 'd'], [A, s * 1.7, 2.7, .4, .5, .5, 1.0, 'a'], [A, s * 1.7, 2.7, .91, .3, .3, .02, 'c'],
      ['body', s * .5, 3.9, .61, .1, 1.5, .02, 'm', {rz: s * .35}], ['body', s * 1.0, 5.2, -.4, .3, 1.2, .3, 'd'], ['body', s * 1.0, 5.85, -.4, .32, .1, .32, 'm']]; }),
      ['body', 0, 2.75, 0, 1.5, .5, .8, 'd'], ['body', 0, 3.9, 0, 2.4, 1.8, 1.2, 'a'], ['body', 0, 4.1, .62, .5, .5, .02, 'c'],
      ['head', 0, 5.25, .05, .8, .65, .8, 'a'], ['head', 0, 5.3, .46, .7, .14, .02, 'c'], ['head', 0, 5.7, 0, .08, .3, .7, 'm']],
    spheres: [[0, 3.9, 0, 1.3], [0, 5.25, .05, .5, 'head'], [0, 1.5, 0, 1.0]]},
  overlord: {name: 'The Overlord', hp: 5000, speed: 1.3, r: 2.6, eye: 0, fly: 6.2, score: 10000, anim: 'float', range: [8, 20],
    attacks: [{k: 'laser', w: 3, dmg: 24, cd: 2.4, from: 0}, {k: 'ring', w: 2, n: 16, dmg: 8, speed: 11, color: 0xff2e2e, cd: 2.2}, {k: 'shell', w: 2, n: 4, dmg: 20, radius: 3, cd: 2.6}, {k: 'summon', w: 1, type: 'drone', n: 2, cd: 2}],
    muzzle: [[0, .1, 1.9]], pal: {a: '#3a2e5c', d: '#241c3d', j: '#120e1f', e: '#ff2e2e', w: '#f4f4f4'}, glow: 'e',
    bones: {body: [0, 0, 0], jaw: [0, -1.3, .2], ring: [0, 0, 0]}, tree: {body: 'root', jaw: 'body', ring: 'body'},
    parts: [['body', 0, 0, 0, 3.6, 3.0, 3.4, 'a'], ['body', 0, 1.0, 1.65, 3.4, .5, .4, 'd'], ['body', 0, 2.2, -.8, .15, 1.4, .15, 'j'], ['body', 0, 2.95, -.8, .3, .3, .3, 'e'], ['body', 0, .1, 1.71, 1.6, 1.1, .04, 'j'],
      ['body', 0, .1, 1.76, 1.0, .8, .06, 'e'], ['body', 0, .1, 1.8, .35, .35, .04, 'w'],
      ...sides(s => [['body', s * 1.6, -.4, 1.2, .5, 1.6, 1.4, 'd'], ['body', s * .9, 1.9, -.3, .2, 1.0, 2.2, 'j'], ['ring', s * 2.7, 0, 0, .34, .34, .34, 'e'], ['ring', 0, 0, s * 2.7, .34, .34, .34, 'e']]),
      ['jaw', 0, -1.75, .3, 3.0, .7, 2.6, 'a'], ...[-1.0, -.6, -.2, .2, .6, 1.0].map(x => ['jaw', x, -1.35, 1.55, .2, .25, .1, 'w'])],
    spheres: [[0, 0, 0, 2.1], [0, .1, 1.8, .6, 'core'], [0, -1.7, .3, 1.4]]},
};

/* ---------- the six zones ---------- */
// 24 x 24 squares of 2 metres. # building, w low wall, s sandbags, c crate, C crate stack, K container, H two containers,
// b barrels, p pillar, M machine, v conveyor, r rock, x car, l lamp, T mast, D dome (2 x 2), ~ water, S robot door,
// P start. Every robot door can reach the start (checked when the zone is built).
const ZONES = [
  {name: 'Street Compound', floor: 'asphalt', wall: 'office', boss: 'tank', mix: {scout: 2, trooper: 3}, music: [0, 118],
    sky: [[0, '#3f5a86'], [.55, '#a6a6b4'], [.8, '#e9b98d'], [1, '#d99a6c']], fog: [0xd8b493, 22, 80], hemi: [0xbfd4ff, 0x6b5a46, .8], sun: [0xffd9b0, 1.5, [-18, 22, 10]], card: ['#c98a4b', '#5a3b1c'],
    map: ['########################', '#S........#####.......S#', '#.........#####........#', '#..c..s...........ww...#', '#..c..s.....b..........#', '#.......K..............#',
      '####....K.....###...####', '####....K.....###...####', '#...........ss.........#', '#...ww.................#', '#..........c....KKK....#', '#S...b.....c..........S#',
      '#.............b.....w..#', '#...KKK................#', '#.........###.....s....#', '####......###.....s.####', '####...c..###..........#', '#......c...........C...#',
      '#..ss..........w.......#', '#.............www......#', '#.....b................#', '#..........P...........#', '#......................#', '########################']},
  {name: 'Shipping Docks', floor: 'dock', wall: 'shed', boss: 'crab', mix: {scout: 1, trooper: 2, spider: 2, drone: 2}, music: [3, 122],
    sky: [[0, '#2b2d5c'], [.5, '#a8578b'], [.78, '#ff9a5a'], [1, '#ffcf7a']], fog: [0xc4747a, 20, 78], hemi: [0xffc0d0, 0x4a3a40, .75], sun: [0xffb07a, 1.4, [20, 14, -16]], card: ['#a8578b', '#2b2d5c'],
    map: ['########################', '#S...................~~#', '#..KKK....HHH....KKK.~~#', '#....................~~#', '#..b...........c.....~~#', '#.....HHH...KKK......~~#',
      '#S...................~~#', '#....c....s.....b....~~#', '#..KKK.........HHH...~~#', '#..........KKK.......~~#', '#.....s..............~~#', '#..HHH.......c.......~~#',
      '#.........b......KKK.~~#', '#S...................~~#', '#.....KKK....HHH.....~~#', '#..c.................~~#', '#.........s......c...~~#', '#..KKK.......KKK.....~~#',
      '#....................~~#', '#.....b.....c....HHH.~~#', '#..HHH...............~~#', '#..........P.........~~#', '#S...................~~#', '########################']},
  {name: 'Robot Factory', floor: 'metal', wall: 'factory', boss: 'foreman', mix: {scout: 2, trooper: 2, spider: 1, drone: 1, brute: 1, roller: 2}, music: [5, 126],
    sky: [[0, '#1a1410'], [.5, '#4a2f1c'], [.8, '#a2532a'], [1, '#d77a3a']], fog: [0x5a3a26, 16, 64], hemi: [0xffc49a, 0x2a2622, .85], sun: [0xffb070, 1.2, [-12, 24, -14]], card: ['#8a5a2a', '#2a1a10'],
    map: ['########################', '#S.......p.....p......S#', '#..MMM...........MMM...#', '#......vvvvvvvv........#', '#..p.......c.......p...#', '#.......MM....MM.......#',
      '#..c...............c...#', '#......p.....p.........#', '#S..vvvvvv.....vvvvvv..#', '#..........MM..........#', '#..p...c.........c..p..#', '#.......p.....p........#',
      '#..MMM......s......MMM.#', '#..........ss..........#', '#..p..vvvvv....vvvvv.p.#', '#......................#', '#....c...MM....MM...c..#', '#..p.................p.#',
      '#......b..........b....#', '#..MMM....p...p....MMM.#', '#......................#', '#..........P...........#', '#S....................S#', '########################']},
  {name: 'Desert Outpost', floor: 'sand', wall: 'adobe', boss: 'scorpion', mix: {scout: 1, trooper: 2, spider: 1, brute: 1, roller: 1, sniper: 2, shield: 2}, music: [7, 120],
    sky: [[0, '#2f6fb3'], [.5, '#7fb2df'], [.8, '#f1d7a6'], [1, '#f6c27a']], fog: [0xe8cf9c, 26, 90], hemi: [0xdfefff, 0x9a7a4a, .85], sun: [0xfff0d0, 1.7, [16, 30, 12]], card: ['#d4a256', '#7a5226'],
    map: ['########################', '#S.......r......r.....S#', '#...rr.......ss........#', '#.........###......rr..#', '#..s......###..........#', '#..s...r........w......#',
      '#.........ww....w...s..#', '#...rr..............s..#', '#S.........r.....rr....#', '#.....###..............#', '#.....###....ss....r...#', '#..r.........ss........#',
      '#.........r........###.#', '#..ww..............###.#', '#........rr...s........#', '#..s..........s...r....#', '#..s....###............#', '#.......###.....ww..r..#',
      '#..r...........ww......#', '#.......s..r...........#', '#....rr.s..........rr..#', '#..........P...........#', '#S....................S#', '########################']},
  {name: 'Neon City', floor: 'wet', wall: 'tower', boss: 'titan', mix: {scout: 1, trooper: 2, drone: 1, brute: 1, roller: 1, sniper: 1, shield: 1, blink: 2, gunship: 1}, music: [10, 128],
    sky: [[0, '#05060f'], [.55, '#141a3a'], [.82, '#3a1f5c'], [1, '#7a2a7a']], fog: [0x1a1638, 14, 70], hemi: [0x6a7aff, 0x2a1030, .9], sun: [0x9ab0ff, .65, [-10, 26, 14]], night: true, card: ['#3a1f5c', '#05060f'],
    map: ['########################', '#S........####........S#', '#.....x...####...x.....#', '#..x...............w...#', '#.........l....l.......#', '####...x......x.....####',
      '####................####', '#.....www.....x........#', '#S.........x.........x.#', '#....l.........l.......#', '#..x.....####......x...#', '#........####..........#',
      '#...w....####...w......#', '#.....x.........x...l..#', '####...........l....####', '####...x....x.......####', '#..........ww..........#', '#..l...x...........x...#',
      '#...........l..........#', '#....x...........x.....#', '#.........w....w.......#', '#..........P...........#', '#S....................S#', '########################']},
  {name: 'Moon Base', floor: 'moon', wall: 'base', boss: 'overlord', mix: {scout: 1, trooper: 1, spider: 1, drone: 1, brute: 1, roller: 1, sniper: 1, shield: 1, blink: 1, gunship: 1}, music: [8, 132],
    sky: 'stars', fog: [0x10101a, 30, 110], hemi: [0xc8d0ff, 0x3a3a46, .8], sun: [0xffffff, 1.5, [24, 18, -8]], card: ['#4a4a6a', '#0a0a14'],
    map: ['########################', '#S.........r..........S#', '#....DD.........DD.....#', '#....DD....M....DD.....#', '#..........M...........#', '#..r....T.......r..T...#',
      '#.........DD...........#', '#S..MM....DD.....MM...S#', '#......................#', '#...r.....r.......r....#', '#.......MMM....DD......#', '#..DD..........DD...r..#',
      '#..DD....r.............#', '#..........T...MMM.....#', '#...r..................#', '#.......DD.....r...DD..#', '#..MM...DD.........DD..#', '#...........r..........#',
      '#..r....M..........r...#', '#.......M...DD.........#', '#...........DD.........#', '#..........P...........#', '#S....................S#', '########################']},
];
const ENDLESS = 6;   // the zone number after the sixth: endless waves, every robot, a boss every fifth wave
const PER_ZONE = 5;  // waves in a zone; the fifth is the boss

/* ---------- sound: every effect and the music are made on the spot, so nothing extra to download ---------- */
function makeSound(api){
  let ac = null, out = null, fx = null, mus = null, noise = null, on = api.soundOn ? !!api.soundOn() : true;
  function init(){
    if (ac || !on) return !!ac;
    try {
      ac = api.audio(); out = ac.createGain(); out.gain.value = 1; out.connect(ac.destination);
      fx = ac.createGain(); fx.gain.value = .5; fx.connect(out); mus = ac.createGain(); mus.gain.value = 0; mus.connect(out);
      const len = ac.sampleRate; noise = ac.createBuffer(1, len, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch { ac = null; }
    return !!ac;
  }
  function nz(t, dur, f0, f1, q, vol, dest, type = 'bandpass'){
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f0, t); if (f1 !== f0) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
  }
  function osc(t, dur, type, f0, f1, vol, dest, attack = .005){
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + .02);
  }
  const SFX = {
    pistol: (t, d) => { nz(t, .12, 2400, 600, .8, .5, d); osc(t, .1, 'square', 900, 180, .12, d); osc(t, .08, 'sine', 140, 60, .4, d); },
    smg: (t, d) => { nz(t, .07, 3000, 900, .9, .32, d); osc(t, .06, 'sine', 160, 70, .3, d); },
    shotgun: (t, d) => { nz(t, .35, 1400, 120, .6, .9, d, 'lowpass'); osc(t, .25, 'sine', 110, 40, .8, d); },
    rifle: (t, d) => { nz(t, .11, 2600, 500, .7, .5, d); osc(t, .09, 'sine', 150, 55, .5, d); },
    rail: (t, d) => { osc(t, .5, 'sawtooth', 2200, 140, .18, d); osc(t, .5, 'sine', 3200, 400, .15, d); nz(t, .25, 4000, 800, .8, .4, d); },
    plasma: (t, d) => { osc(t, .18, 'sawtooth', 640, 160, .2, d); osc(t, .18, 'square', 320, 90, .1, d); },
    rocket: (t, d) => { nz(t, .7, 600, 2400, .7, .45, d); osc(t, .3, 'sine', 90, 50, .5, d); },
    minigun: (t, d) => { nz(t, .05, 3200, 1200, 1, .26, d); osc(t, .04, 'sine', 170, 90, .22, d); },
    tesla: (t, d) => { for (let i = 0; i < 6; i++) osc(t + i * .025, .05, 'square', rnd(400, 1800), rnd(200, 900), .07, d); nz(t, .3, 5000, 2000, 2, .25, d, 'highpass'); },
    enemy: (t, d) => { osc(t, .16, 'square', 1200, 260, .07, d); },
    snipe: (t, d) => { osc(t, .3, 'sawtooth', 1800, 300, .14, d); nz(t, .2, 3000, 900, 1, .3, d); },
    hit: (t, d) => { osc(t, .05, 'square', 1800, 1600, .05, d); },
    head: (t, d) => { osc(t, .09, 'sine', 2400, 2600, .14, d); },
    shield: (t, d) => { osc(t, .12, 'triangle', 700, 900, .1, d); nz(t, .08, 3000, 3000, 4, .14, d); },
    break: (t, d) => { [523, 742, 1046, 1311].forEach((f, i) => osc(t, .5 + i * .1, 'sine', f * rnd(.95, 1.05), f * .8, .08, d)); nz(t, .35, 2000, 300, .8, .4, d); },
    boom: (t, d) => { nz(t, 1.1, 900, 60, .7, 1, d, 'lowpass'); osc(t, .6, 'sine', 80, 30, .9, d); },
    hurt: (t, d) => { osc(t, .2, 'sine', 160, 80, .5, d); nz(t, .15, 800, 300, 1, .25, d, 'lowpass'); },
    reload: (t, d) => { nz(t, .04, 3000, 3000, 3, .25, d); nz(t + .28, .05, 2200, 2200, 3, .3, d); },
    empty: (t, d) => { nz(t, .03, 4000, 4000, 4, .2, d); },
    click: (t, d) => { osc(t, .04, 'square', 1400, 1400, .05, d); },
    portal: (t, d) => { osc(t, .7, 'sine', 200, 900, .12, d); osc(t, .7, 'triangle', 300, 1350, .06, d); },
    beep: (t, d) => { osc(t, .08, 'square', 1500, 1500, .07, d); },
    zap: (t, d) => { for (let i = 0; i < 4; i++) osc(t + i * .03, .05, 'square', rnd(700, 1600), 300, .09, d); },
    slash: (t, d) => { nz(t, .25, 1200, 6000, 2, .35, d); },
    pickup: (t, d) => { [660, 880, 1320].forEach((f, i) => osc(t + i * .07, .18, 'sine', f, f, .2, d)); },
    life: (t, d) => { [523, 659, 784, 1046, 1318].forEach((f, i) => osc(t + i * .08, .25, 'triangle', f, f, .22, d)); },
    unlock: (t, d) => { [392, 523, 659, 784, 1046].forEach((f, i) => osc(t + i * .1, .4, 'square', f, f, .09, d)); },
    wave: (t, d) => { osc(t, .9, 'sawtooth', 110, 110, .12, d); osc(t, .9, 'sawtooth', 165, 165, .08, d); },
    roar: (t, d) => { osc(t, 1.4, 'sawtooth', 70, 45, .3, d); nz(t, 1.2, 400, 150, 1, .4, d, 'lowpass'); },
    warn: (t, d) => { osc(t, .22, 'square', 880, 880, .08, d); osc(t + .3, .22, 'square', 880, 880, .08, d); },
    stomp: (t, d) => { osc(t, .5, 'sine', 60, 25, 1, d); nz(t, .6, 500, 80, .7, .7, d, 'lowpass'); },
    throw: (t, d) => { nz(t, .2, 800, 1600, 1, .25, d); },
    laser: (t, d) => { osc(t, .6, 'sawtooth', 300, 300, .14, d); osc(t, .6, 'square', 603, 600, .07, d); },
    ok: (t, d) => { osc(t, .12, 'sine', 660, 660, .2, d); osc(t + .1, .18, 'sine', 990, 990, .2, d); },
    bad: (t, d) => { osc(t, .2, 'triangle', 240, 190, .2, d); },
  };
  const last = {};
  function play(k, vol = 1){
    if (!on || vol <= .02 || !init()) return;
    const now = ac.currentTime; if (last[k] && now - last[k] < .035) return; last[k] = now;
    try { const g = ac.createGain(); g.gain.value = Math.min(1, vol); g.connect(fx); SFX[k](now + .005, g); setTimeout(() => { try { g.disconnect(); } catch {} }, 2500); } catch {}
  }
  /* music: a driving loop in each zone's own key and speed, heavier for a boss */
  let mTimer = null, step = 0, nextT = 0, bpm = 120, key = 0, boss = false, mLevel = .14;
  const BASS = [0, 0, 12, 0, 0, 0, 10, 0, 0, 0, 12, 0, 7, 5, 3, 2];
  const MOVE = [0, 0, -4, -2];
  function note(semi){ return 55 * Math.pow(2, (semi + key) / 12); }
  function bassNote(t, f, len){
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(boss ? 900 : 650, t); fl.frequency.exponentialRampToValueAtTime(200, t + len); fl.Q.value = 6;
    const g = ac.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.32, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + len);
    o.connect(fl); fl.connect(g); g.connect(mus); o.start(t); o.stop(t + len + .02);
  }
  function tick(){
    if (!ac) return;
    const spb = 60 / bpm / 4;
    if (nextT < ac.currentTime) nextT = ac.currentTime + .05;
    while (nextT < ac.currentTime + .25) {
      const s = step % 16, bar = Math.floor(step / 16) % 4, t = nextT;
      if (s % 4 === 0 || (boss && s === 10)) osc(t, .25, 'sine', 150, 42, .55, mus);
      if (s === 4 || s === 12) { nz(t, .16, 1800, 1200, .8, .35, mus); osc(t, .08, 'triangle', 220, 160, .15, mus); }
      if (s % 2 === 1) nz(t, .04, 9000, 9000, 1, boss ? .14 : .09, mus, 'highpass');
      if (s % 2 === 0) bassNote(t, note(BASS[s] + MOVE[bar]), spb * 1.8);
      if ((boss || bar >= 2) && s % 4 === 2) osc(t, spb * 1.6, 'square', note(BASS[(s + 4) % 16] + MOVE[bar] + 24), note(BASS[(s + 4) % 16] + MOVE[bar] + 24), .05, mus);
      step++; nextT += spb;
    }
  }
  function music(play, opt = {}){
    if (!on) return;
    if (opt.bpm) bpm = opt.bpm; if (opt.key !== undefined) key = opt.key; if (opt.boss !== undefined) boss = opt.boss;
    if (!play) { if (mTimer) { clearInterval(mTimer); mTimer = null; } if (ac) mus.gain.setTargetAtTime(0, ac.currentTime, .2); return; }
    if (!init()) return;
    if (!mTimer) { nextT = ac.currentTime + .1; mTimer = setInterval(tick, 60); }
    mus.gain.setTargetAtTime(mLevel, ac.currentTime, .3);
  }
  function duck(down){ mLevel = down ? .035 : .14; if (ac && mTimer) mus.gain.setTargetAtTime(mLevel, ac.currentTime, .2); }
  function setOn(v){ on = v; if (!v) { if (mTimer) { clearInterval(mTimer); mTimer = null; } if (ac) { mus.gain.value = 0; fx.gain.value = 0; } } else if (ac) fx.gain.value = .5; }
  function stop(){ if (mTimer) clearInterval(mTimer); mTimer = null; if (out) { try { out.gain.setTargetAtTime(0, ac.currentTime, .05); setTimeout(() => { try { out.disconnect(); } catch {} }, 400); } catch {} } }
  return {play, music, duck, stop, setOn, get on(){ return on; }};
}

/* ---------- the game ---------- */
const NW = 48, CELLS = NW * NW;   // the robots' route-finding grid: 1 metre squares over the 48 metre arena
const FALLBACK_WORDS = ['because', 'friend', 'thought', 'enough', 'machine', 'answer', 'different', 'earth', 'heart', 'island', 'minute', 'promise'];
function strike(host, api){
  injectCss();
  const root = document.createElement('div'); root.className = 'ss'; host.appendChild(root);
  if (!T) { root.innerHTML = '<div class="ss-load">The game needs the internet the first time. Connect to Wi-Fi and try again.</div>'; return {destroy(){ root.remove(); }}; }
  const demo = !!api.demo, spell = api.spell || null;
  const st = api.state || {};
  const save = st.strike = Object.assign({zone: 1, best: {}, kills: 0, seen: [], games: 0}, st.strike || {});
  if (demo) save.zone = ENDLESS + 1;

  root.innerHTML = `<canvas class="ss-gl"></canvas>
    <div class="ss-vig"></div><div class="ss-heal"></div><div class="ss-scope"></div>
    <div class="ss-hud" hidden>
      <div class="ss-tl"><canvas class="ss-radar" width="236" height="236"></canvas><div class="ss-hp"><i></i></div><div class="ss-lives"></div><div class="ss-nades"></div></div>
      <div class="ss-tc"><div class="ss-wave"></div><div class="ss-sub"></div><div class="ss-bossname" hidden></div><div class="ss-bossbar" hidden><i></i></div></div>
      <div class="ss-tr"><div class="ss-gunname"></div><div class="ss-ammo"></div><div class="ss-score"></div><div class="ss-clock"></div></div>
      <div class="ss-cross"><i></i><i></i><i></i><i></i></div><div class="ss-hit"><i></i><i></i><i></i><i></i></div>
      <div class="ss-pops"></div>${'<div class="ss-dmg"><i></i></div>'.repeat(4)}
      <div class="ss-banner"></div><div class="ss-toast"></div>
    </div>
    <div class="ss-ctl" hidden>
      <div class="ss-joy idle"><i></i><b>MOVE</b></div>
      <button class="ss-btn ss-fire" data-b="fire">FIRE</button><button class="ss-btn ss-aim" data-b="aim">AIM</button>
      <button class="ss-btn ss-reload" data-b="reload">RELOAD</button><button class="ss-btn ss-nade" data-b="nade">NADE<small></small></button>
      <button class="ss-btn ss-spellbtn" data-b="spell"><span><b>📦</b>SPELL<small>for ammo</small></span></button>
      <button class="ss-btn ss-pausebtn" data-b="pause" aria-label="Pause">❚❚</button>
      <div class="ss-guns"></div>
    </div>
    <div class="ss-ov" data-ov="menu" hidden></div><div class="ss-ov" data-ov="spell" hidden></div>
    <div class="ss-turn">Turn your iPad sideways to play.<br><br><button class="ss-ghost" data-a="turn-ok">Play this way anyway</button></div>`;
  const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
  const canvas = $('.ss-gl'), hud = $('.ss-hud'), ctl = $('.ss-ctl'), ovMenu = $('[data-ov="menu"]'), ovSpell = $('[data-ov="spell"]');

  /* ---------- three.js ---------- */
  const DPR = window.devicePixelRatio || 1;
  let renderer;
  try { renderer = new T.WebGLRenderer({canvas, antialias: DPR < 1.8, powerPreference: 'high-performance'}); }
  catch { root.innerHTML = '<div class="ss-load">This iPad could not start the 3D game.</div>'; return {destroy(){ root.remove(); }}; }
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  ANISO = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const PR_MAX = Math.min(DPR, 2); let pr = Math.min(PR_MAX, 1.5); renderer.setPixelRatio(pr);
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(70, 1, .05, 260); cam.rotation.order = 'YXZ'; scene.add(cam);
  const hemi = new T.HemisphereLight(0xffffff, 0x444444, .8); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffffff, 1.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 150}); sun.shadow.bias = -.0007; sun.shadow.camera.updateProjectionMatrix(); scene.add(sun); scene.add(sun.target);
  const flashLight = new T.PointLight(0xffa040, 0, 14); scene.add(flashLight);
  const muzzleLight = new T.PointLight(0xffb060, 0, 6); cam.add(muzzleLight); muzzleLight.position.set(.2, -.1, -1.2);
  const TX = {crate: canvasTex(256, 256, PROPS.crate), box: canvasTex(512, 512, PROPS.box), sandbag: canvasTex(256, 128, PROPS.sandbag), concrete: canvasTex(256, 256, PROPS.concrete),
    hazard: canvasTex(256, 256, PROPS.hazard), belt: canvasTex(128, 128, PROPS.belt), rock: canvasTex(256, 256, PROPS.rock), barrel: canvasTex(128, 128, PROPS.barrel), car: canvasTex(128, 128, PROPS.car),
    dome: canvasTex(256, 256, PROPS.dome), water: canvasTex(256, 256, PROPS.water), panel: panelTex(), glow: glowTex(), blue: glowTex('rgba(230,250,255,1)', 'rgba(110,210,255,.9)', 'rgba(40,120,255,.35)'),
    ring: ringTex(), blob: blobTex()};
  const MAT = {
    lit: new T.MeshLambertMaterial({vertexColors: true, map: TX.panel}), glow: new T.MeshBasicMaterial({vertexColors: true}),
    trans: new T.MeshBasicMaterial({vertexColors: true, transparent: true, opacity: .42, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide}),
    flash: new T.MeshBasicMaterial({color: 0xffffff}), blob: new T.MeshBasicMaterial({map: TX.blob, transparent: true, depthWrite: false}),
  };
  const blobGeo = new T.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);

  /* ---------- robots: built once per kind, shared by every copy ---------- */
  const robotGeos = {};
  function robotGeo(type){
    if (robotGeos[type]) return robotGeos[type];
    const def = BOTS[type] || BOSSES[type], parts = {};
    for (const [bone, x, y, z, w, h, d, key, o] of def.parts) {
      const p = def.bones[bone], kind = (def.glow || '').includes(key) ? 'glow' : (def.trans || '').includes(key) ? 'trans' : 'lit';
      const b = parts[bone] = parts[bone] || {}; b[kind] = b[kind] || new Geo();
      b[kind].box(x - p[0], y - p[1], z - p[2], w, h, d, Object.assign({uv: 'unit', bottom: true, col: lin(def.pal[key])}, o || {}));
    }
    const out = {}; for (const [bone, kinds] of Object.entries(parts)) { out[bone] = {}; for (const [k, g] of Object.entries(kinds)) out[bone][k] = g.geometry(); }
    return robotGeos[type] = out;
  }
  function robotMesh(type){
    const def = BOTS[type] || BOSSES[type], geos = robotGeo(type), rootG = new T.Group(), bones = {}, meshes = [];
    for (const name of Object.keys(def.bones)) {
      const par = def.tree[name], p = def.bones[name], pp = par && par !== 'root' ? def.bones[par] : [0, 0, 0];
      const g = new T.Group(); g.position.set(p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]); (par && par !== 'root' ? bones[par] : rootG).add(g); bones[name] = g;
      for (const k of ['lit', 'glow', 'trans']) { const gg = (geos[name] || {})[k]; if (!gg) continue; const m = new T.Mesh(gg, MAT[k]); m.receiveShadow = k === 'lit'; m.userData.mat = MAT[k]; g.add(m); meshes.push(m); }
    }
    return {root: rootG, bones, meshes};
  }

  /* ---------- the arena ---------- */
  let W = null;   // the built zone: {group, obs, spawns, start, hgt, nav, dispose}
  const ix = x => clamp(Math.floor(x + 24), 0, NW - 1), cell = (x, z) => ix(z) * NW + ix(x);
  function buildZone(zi){
    if (W) W.dispose();
    const Z = ZONES[zi], group = new T.Group(), dispose = [], mats = [];
    scene.add(group);
    const cx = c => -24 + c * 2 + 1, at = (r, c) => (Z.map[r] || '')[c] || '#';
    const obs = [], spawns = []; let start = {x: 0, z: 18};
    const addObs = (x0, x1, z0, z1, h, kind) => obs.push({x0, x1, z0, z1, h, kind});
    const tFloor = canvasTex(512, 512, FLOORS[Z.floor], {repeat: [6, 6]}), tWall = canvasTex(512, 512, WALLS[Z.wall]); dispose.push(tFloor, tWall);
    const B = {wall: new Geo(), dark: new Geo(), crate: new Geo(), box: new Geo(), sand: new Geo(), conc: new Geo(), haz: new Geo(), belt: new Geo(), car: new Geo(), glow: new Geo(), water: new Geo(), metal: new Geo()};
    const used = new Set();
    function runs(ch, f){   // squares of one kind joined into long boxes: rows first, then what is left by columns
      for (let r = 0; r < 24; r++) for (let c = 0; c < 24; c++) {
        if (at(r, c) !== ch || used.has(r * 24 + c)) continue; let e = c; while (e + 1 < 24 && at(r, e + 1) === ch && !used.has(r * 24 + e + 1)) e++;
        if (e > c) { for (let k = c; k <= e; k++) used.add(r * 24 + k); f(cx(c) - 1, cx(e) + 1, cx(r) - 1, cx(r) + 1); } c = e;
      }
      for (let c = 0; c < 24; c++) for (let r = 0; r < 24; r++) {
        if (at(r, c) !== ch || used.has(r * 24 + c)) continue; let e = r; while (e + 1 < 24 && at(e + 1, c) === ch && !used.has((e + 1) * 24 + c)) e++;
        for (let k = r; k <= e; k++) used.add(k * 24 + c); f(cx(c) - 1, cx(c) + 1, cx(r) - 1, cx(e) + 1); r = e;
      }
    }
    const neon = ['#ff2fd6', '#19f2ff', '#ffd23f', '#7cff3a'], boxCols = ['#b8432c', '#2f6a9e', '#3d7a4f', '#c98a2a', '#7a7f86', '#8a3a6a'];
    runs('#', (x0, x1, z0, z1) => { const h = rnd(7, 13), w = x1 - x0, d = z1 - z0, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      B.wall.box(mx, h / 2, mz, w, h, d, {s: 6, uo: rnd(0, 1)}); B.dark.box(mx, h + .2, mz, w + .3, .4, d + .3, {col: lin(Z.night ? '#11131a' : '#5d5850')}); addObs(x0, x1, z0, z1, h);
      if (Z.night && Math.random() < .7) { const c = lin(pick(neon)), y = rnd(3.2, 5.5); if (w > d) B.glow.box(mx, y, Math.random() < .5 ? z0 - .06 : z1 + .06, Math.min(w - 1, rnd(2.5, 5)), .35, .1, {col: c}); else B.glow.box(Math.random() < .5 ? x0 - .06 : x1 + .06, y, mz, .1, .35, Math.min(d - 1, rnd(2.5, 5)), {col: c}); } });
    runs('w', (x0, x1, z0, z1) => { B.conc.box((x0 + x1) / 2, .55, (z0 + z1) / 2, x1 - x0 - .2, 1.1, z1 - z0 - .9, {s: 2.2}); addObs(x0 + .1, x1 - .1, z0 + .45, z1 - .45, 1.1); });
    runs('s', (x0, x1, z0, z1) => { B.sand.box((x0 + x1) / 2, .5, (z0 + z1) / 2, x1 - x0 - .2, 1.0, z1 - z0 - .6, {s: 2}); addObs(x0 + .1, x1 - .1, z0 + .3, z1 - .3, 1.0); });
    runs('K', (x0, x1, z0, z1) => { B.box.box((x0 + x1) / 2, 1.3, (z0 + z1) / 2, x1 - x0, 2.6, z1 - z0, {s: 2.6, col: lin(pick(boxCols))}); addObs(x0, x1, z0, z1, 2.6); });
    runs('H', (x0, x1, z0, z1) => { B.box.box((x0 + x1) / 2, 1.3, (z0 + z1) / 2, x1 - x0, 2.6, z1 - z0, {s: 2.6, col: lin(pick(boxCols))}); B.box.box((x0 + x1) / 2 + rnd(-.15, .15), 3.9, (z0 + z1) / 2, x1 - x0, 2.6, z1 - z0, {s: 2.6, col: lin(pick(boxCols))}); addObs(x0, x1, z0, z1, 5.2); });
    runs('M', (x0, x1, z0, z1) => { B.haz.box((x0 + x1) / 2, 1.1, (z0 + z1) / 2, x1 - x0 - .3, 2.2, z1 - z0 - .3, {s: 2.2}); B.glow.box((x0 + x1) / 2, 2.25, (z0 + z1) / 2, x1 - x0 - .8, .08, .2, {col: lin('#39e6ff')}); addObs(x0 + .15, x1 - .15, z0 + .15, z1 - .15, 2.2); });
    runs('v', (x0, x1, z0, z1) => { B.belt.box((x0 + x1) / 2, .45, (z0 + z1) / 2, x1 - x0, .9, z1 - z0 - .5, {s: 1.2}); addObs(x0, x1, z0 + .25, z1 - .25, .9); });
    runs('~', (x0, x1, z0, z1) => { B.water.box((x0 + x1) / 2, .015, (z0 + z1) / 2, x1 - x0, .03, z1 - z0, {s: 4}); addObs(x0, x1, z0, z1, .01, 'water'); });
    const barrels = [], rocks = [], domes = [];
    for (let r = 0; r < 24; r++) for (let c = 0; c < 24; c++) {
      const ch = at(r, c), x = cx(c), z = cx(r);
      if (ch === 'S') spawns.push({x, z});
      else if (ch === 'P') start = {x, z};
      else if (ch === 'c') { const ox = rnd(-.25, .25), oz = rnd(-.25, .25); B.crate.box(x + ox, .65, z + oz, 1.3, 1.3, 1.3, {uv: 'unit'}); addObs(x + ox - .65, x + ox + .65, z + oz - .65, z + oz + .65, 1.3); }
      else if (ch === 'C') { B.crate.box(x, .65, z, 1.3, 1.3, 1.3, {uv: 'unit'}); B.crate.box(x + .1, 1.9, z - .05, 1.2, 1.2, 1.2, {uv: 'unit', ry: .35}); addObs(x - .65, x + .65, z - .65, z + .65, 2.5); }
      else if (ch === 'b') { for (const [ox, oz] of [[-.45, -.3], [.45, -.25], [0, .45]]) barrels.push([x + ox, z + oz]); addObs(x - .85, x + .85, z - .7, z + .85, 1.15); }
      else if (ch === 'p') { B.metal.box(x, 4, z, .9, 8, .9, {s: 2, col: lin('#8a8f96')}); B.metal.box(x, .2, z, 1.3, .4, 1.3, {s: 2, col: lin('#e8b21a')}); addObs(x - .65, x + .65, z - .65, z + .65, 8); }
      else if (ch === 'r') { const s = rnd(.9, 1.25), h = rnd(.8, 1.3); rocks.push([x + rnd(-.2, .2), z + rnd(-.2, .2), s, h]); addObs(x - s * .85, x + s * .85, z - s * .85, z + s * .85, h * 1.5); }
      else if (ch === 'x') { const along = Math.random() < .5, w = along ? 1.9 : 4, d = along ? 4 : 1.9, c1 = lin(pick(['#c8322a', '#2a62c8', '#e8e8e8', '#2a2a2a', '#e8b21a', '#3aa86a']));
        B.car.box(x, .6, z, w, .8, d, {uv: 'unit', col: c1}); B.dark.box(x, 1.25, z, along ? 1.6 : 2.1, .55, along ? 2.1 : 1.6, {col: lin('#141820')});
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.dark.box(x + a * (w / 2 - .35), .3, z + b * (d / 2 - .55), along ? .25 : .6, .6, along ? .6 : .25, {col: lin('#0b0b0b')});
        if (along) for (const a of [-.6, .6]) { B.glow.box(x + a, .7, z + d / 2 + .02, .35, .15, .04, {col: lin('#fff6d0')}); B.glow.box(x + a, .7, z - d / 2 - .02, .35, .12, .04, {col: lin('#ff2a1a')}); }
        else for (const a of [-.6, .6]) { B.glow.box(x + w / 2 + .02, .7, z + a, .04, .15, .35, {col: lin('#fff6d0')}); B.glow.box(x - w / 2 - .02, .7, z + a, .04, .12, .35, {col: lin('#ff2a1a')}); }
        addObs(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 1.55); }
      else if (ch === 'l') { B.dark.box(x, 2.3, z, .16, 4.6, .16, {col: lin('#2a2d36')}); B.dark.box(x + .4, 4.55, z, .9, .1, .12, {col: lin('#2a2d36')}); B.glow.box(x + .8, 4.45, z, .45, .12, .3, {col: lin(pick(['#fff1c0', '#ff9ef0', '#9ef6ff']))}); addObs(x - .2, x + .2, z - .2, z + .2, 4.6); }
      else if (ch === 'T') { B.metal.box(x, 3.5, z, .3, 7, .3, {s: 2, col: lin('#c8ccd4')}); B.metal.box(x, 6.4, z + .3, 1.6, 1.6, .12, {s: 2, col: lin('#e4e7ec'), rx: -.5}); B.glow.box(x, 7.1, z, .2, .2, .2, {col: lin('#ff3b2f')}); addObs(x - .35, x + .35, z - .35, z + .35, 7); }
      else if (ch === 'D' && at(r, c + 1) === 'D' && at(r + 1, c) === 'D' && !used.has(r * 24 + c)) { used.add(r * 24 + c + 1); used.add((r + 1) * 24 + c); used.add((r + 1) * 24 + c + 1); domes.push([x + 1, z + 1]); addObs(x + 1 - 1.6, x + 1 + 1.6, z + 1 - 1.6, z + 1 + 1.6, 1.9); }
    }
    // the dock's edge along the water
    for (let r = 0; r < 24; r++) for (let c = 1; c < 24; c++) if (at(r, c) === '~' && at(r, c - 1) !== '~' && at(r, c - 1) !== '#') B.conc.box(cx(c) - .9, .12, cx(r), .2, .24, 2, {s: 2});
    const mat = (o) => { const m = new T.MeshLambertMaterial(o); mats.push(m); return m; };
    const wallMat = mat(Z.night ? {map: tWall, emissive: 0xffffff, emissiveMap: tWall, emissiveIntensity: .85} : {map: tWall});
    const add = (geo, m, shadow = true) => { if (geo.empty) return; const g = geo.geometry(); dispose.push(g); const ms = new T.Mesh(g, m); ms.castShadow = shadow; ms.receiveShadow = true; group.add(ms); return ms; };
    add(B.wall, wallMat); add(B.dark, mat({vertexColors: true})); add(B.crate, mat({map: TX.crate})); add(B.box, mat({map: TX.box, vertexColors: true})); add(B.sand, mat({map: TX.sandbag}));
    add(B.conc, mat({map: TX.concrete, vertexColors: true})); add(B.haz, mat({map: TX.hazard})); add(B.belt, mat({map: TX.belt})); add(B.car, mat({map: TX.car, vertexColors: true}));
    add(B.metal, mat({map: TX.panel, vertexColors: true})); add(B.water, mat({map: TX.water, emissive: 0x0a2a3a}), false);
    const glowMat = new T.MeshBasicMaterial({vertexColors: true}); mats.push(glowMat); add(B.glow, glowMat, false);
    const floor = new T.Mesh(new T.PlaneGeometry(48, 48), mat({map: tFloor})); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor); dispose.push(floor.geometry);
    if (barrels.length) { const g = new T.CylinderGeometry(.38, .38, 1.15, 14), m = new T.InstancedMesh(g, mat({map: TX.barrel}), barrels.length), o = new T.Object3D(), cl = new T.Color();
      barrels.forEach(([x, z], i) => { o.position.set(x, .575, z); o.rotation.y = rnd(0, 6); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, cl.set(pick(['#b3261e', '#2f6fd6', '#3d7a4f', '#e8b21a', '#5a5f66'])).convertSRGBToLinear()); });
      m.castShadow = m.receiveShadow = true; group.add(m); dispose.push(g); }
    if (rocks.length) { const g = new T.DodecahedronGeometry(1, 0), m = new T.InstancedMesh(g, mat({map: TX.rock}), rocks.length), o = new T.Object3D();
      rocks.forEach(([x, z, s, h], i) => { o.position.set(x, h * .55, z); o.rotation.set(rnd(0, 3), rnd(0, 6), rnd(0, 3)); o.scale.set(s, h, s * rnd(.85, 1.15)); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
      m.castShadow = m.receiveShadow = true; group.add(m); dispose.push(g); }
    if (domes.length) { const g = new T.SphereGeometry(1.9, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), dm = mat({map: TX.dome});
      for (const [x, z] of domes) { const m = new T.Mesh(g, dm); m.position.set(x, 0, z); m.castShadow = m.receiveShadow = true; group.add(m); } dispose.push(g); }
    for (const s of spawns) { const m = new T.Mesh(new T.CircleGeometry(.95, 24), new T.MeshBasicMaterial({map: TX.ring, color: 0xff3b2f, transparent: true, opacity: .55, blending: T.AdditiveBlending, depthWrite: false})); m.rotation.x = -Math.PI / 2; m.position.set(s.x, .03, s.z); group.add(m); dispose.push(m.geometry); mats.push(m.material); }
    // sky, light and fog
    const sky = new T.Mesh(new T.SphereGeometry(200, 24, 16), new T.MeshBasicMaterial({map: Z.sky === 'stars' ? STARS() : skyTex(Z.sky), side: T.BackSide, fog: false, depthWrite: false}));
    sky.renderOrder = -1; group.add(sky); dispose.push(sky.geometry, sky.material.map); mats.push(sky.material);
    if (Z.sky === 'stars') { const earth = new T.Mesh(new T.SphereGeometry(14, 24, 16), new T.MeshBasicMaterial({map: canvasTex(256, 128, (x, w, h) => { x.fillStyle = '#1f5fbf'; x.fillRect(0, 0, w, h); x.fillStyle = '#3aa35a'; for (let i = 0; i < 14; i++) { x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 30, 6 + Math.random() * 16, Math.random() * 3, 0, 7); x.fill(); } x.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 20; i++) x.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 40, 3); }), fog: false}));
      earth.position.set(-60, 70, -150); group.add(earth); dispose.push(earth.geometry, earth.material.map); mats.push(earth.material); }
    scene.fog = new T.Fog(Z.fog[0], Z.fog[1], Z.fog[2]);
    hemi.color.set(Z.hemi[0]); hemi.groundColor.set(Z.hemi[1]); hemi.intensity = Z.hemi[2];
    sun.color.set(Z.sun[0]); sun.intensity = Z.sun[1]; sun.position.set(...Z.sun[2]).normalize().multiplyScalar(60); sun.target.position.set(0, 0, 0);
    renderer.shadowMap.needsUpdate = true;
    // route-finding: blocked squares for walkers, fliers and the big bosses, and how tall the world is in each square
    const hgt = new Float32Array(CELLS), nav = {g: new Uint8Array(CELLS), a: new Uint8Array(CELLS), b: new Uint8Array(CELLS)};
    for (let i = 0; i < CELLS; i++) {
      const x = (i % NW) - 24 + .5, z = Math.floor(i / NW) - 24 + .5;
      if (x < -22.5 || x > 22.5 || z < -22.5 || z > 22.5) { nav.g[i] = nav.a[i] = nav.b[i] = 1; hgt[i] = 20; continue; }
      for (const o of obs) {
        const inside = pad => x > o.x0 - pad && x < o.x1 + pad && z > o.z0 - pad && z < o.z1 + pad;
        if (inside(0)) hgt[i] = Math.max(hgt[i], o.h);
        if (inside(.45)) nav.g[i] = 1;
        if (o.h > 3.2 && inside(1.1)) nav.a[i] = 1;
        if (inside(1.7)) nav.b[i] = 1;
      }
    }
    W = {zone: zi, Z, group, obs, spawns, start, hgt, nav, water: TX.water,
      dispose(){ scene.remove(group); dispose.forEach(d => d.dispose && d.dispose()); mats.forEach(m => m.dispose()); }};
  }
  // How far each 1 metre square is from the player, for the robots to follow downhill (recomputed as he moves).
  const dist = {g: new Int16Array(CELLS), a: new Int16Array(CELLS), b: new Int16Array(CELLS)}, from = {g: -1, a: -1, b: -1}, queue = new Int32Array(CELLS);
  function flood(k, px, pz){
    const blocked = W.nav[k], d = dist[k]; let s = cell(px, pz);
    if (blocked[s]) { let best = -1, bd = 1e9; const sx = s % NW, sz = Math.floor(s / NW); for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const x = sx + dx, z = sz + dz; if (x < 0 || z < 0 || x >= NW || z >= NW) continue; const j = z * NW + x; if (!blocked[j] && dx * dx + dz * dz < bd) { bd = dx * dx + dz * dz; best = j; } } if (best < 0) return; s = best; }
    if (from[k] === s) return; from[k] = s;
    d.fill(-1); d[s] = 0; let h = 0, t = 0; queue[t++] = s;
    while (h < t) { const i = queue[h++], x = i % NW, z = (i - x) / NW, n = d[i] + 1;
      if (x > 0 && !blocked[i - 1] && d[i - 1] < 0) { d[i - 1] = n; queue[t++] = i - 1; } if (x < NW - 1 && !blocked[i + 1] && d[i + 1] < 0) { d[i + 1] = n; queue[t++] = i + 1; }
      if (z > 0 && !blocked[i - NW] && d[i - NW] < 0) { d[i - NW] = n; queue[t++] = i - NW; } if (z < NW - 1 && !blocked[i + NW] && d[i + NW] < 0) { d[i + NW] = n; queue[t++] = i + NW; } }
  }
  // The way to go from x, z towards the player: the neighbouring square that is nearest to him (corners not cut).
  function flowDir(k, x, z){
    const blocked = W.nav[k], d = dist[k], i = cell(x, z), gx = i % NW, gz = (i - gx) / NW;
    let best = d[i] >= 0 && !blocked[i] ? d[i] : 9999, bx = 0, bz = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const x2 = gx + dx, z2 = gz + dz; if (x2 < 0 || z2 < 0 || x2 >= NW || z2 >= NW) continue;
      const j = z2 * NW + x2; if (blocked[j] || d[j] < 0) continue; if (dx && dz && (blocked[gz * NW + x2] || blocked[z2 * NW + gx])) continue;
      const v = d[j] + (dx && dz ? .41 : 0); if (v < best) { best = v; bx = dx; bz = dz; }
    }
    if (!bx && !bz) return null;
    const tx = gx + bx - 24 + .5, tz = gz + bz - 24 + .5, l = Math.hypot(tx - x, tz - z) || 1; return [(tx - x) / l, (tz - z) / l];
  }
  // Is anything solid between two points? (buildings, containers, walls; robots never block)
  function rayWorld(ox, oy, oz, dx, dy, dz, max){
    let best = max;
    if (dy < -1e-9) { const t = -oy / dy; if (t > 0 && t < best) best = t; }
    const kx = 1 / dx, ky = 1 / dy, kz = 1 / dz;
    for (const o of W.obs) {
      if (o.kind === 'water') continue;
      let t0 = (o.x0 - ox) * kx, t1 = (o.x1 - ox) * kx; if (t0 > t1) { const q = t0; t0 = t1; t1 = q; }
      let u0 = -oy * ky, u1 = (o.h - oy) * ky; if (u0 > u1) { const q = u0; u0 = u1; u1 = q; }
      if (u0 > t0) t0 = u0; if (u1 < t1) t1 = u1;
      let w0 = (o.z0 - oz) * kz, w1 = (o.z1 - oz) * kz; if (w0 > w1) { const q = w0; w0 = w1; w1 = q; }
      if (w0 > t0) t0 = w0; if (w1 < t1) t1 = w1;
      if (t0 <= t1 && t0 > 0 && t0 < best) best = t0;
    }
    return best;
  }
  const clear = (x1, y1, z1, x2, y2, z2) => { const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1, l = Math.hypot(dx, dy, dz) || 1; return rayWorld(x1, y1, z1, dx / l, dy / l, dz / l, l) >= l - .05; };
  const solidAt = (x, y, z) => y <= 0 || y < W.hgt[cell(x, z)] || Math.abs(x) > 23.2 || Math.abs(z) > 23.2;
  // Keep a circle (a robot or the player) out of the boxes.
  function push(o, r){
    for (const b of W.obs) {
      const nx = clamp(o.x, b.x0, b.x1), nz = clamp(o.z, b.z0, b.z1), dx = o.x - nx, dz = o.z - nz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; o.x += dx * k; o.z += dz * k; }
      else { const l = o.x - b.x0, rr = b.x1 - o.x, u = o.z - b.z0, dd = b.z1 - o.z, m = Math.min(l, rr, u, dd); if (m === l) o.x = b.x0 - r; else if (m === rr) o.x = b.x1 + r; else if (m === u) o.z = b.z0 - r; else o.z = b.z1 + r; }
    }
    o.x = clamp(o.x, -22.6 + r, 22.6 - r); o.z = clamp(o.z, -22.6 + r, 22.6 - r);
  }

  /* ---------- effects: sparks, bolts, flashes, beams, falling robot parts ---------- */
  function pointCloud(n, size, tex, blend = T.AdditiveBlending){
    const g = new T.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
    const m = new T.PointsMaterial({size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: blend, sizeAttenuation: true});
    const p = new T.Points(g, m); p.frustumCulled = false; scene.add(p);
    return {g, pos, col, n, p};
  }
  const SPK = pointCloud(700, .16, TX.glow), BOLT = pointCloud(160, .7, TX.glow);
  const sparks = [];
  function spark(x, y, z, n, color = 0xffc060, speed = 5, life = .45){
    const c = new T.Color(color);
    for (let i = 0; i < n && sparks.length < SPK.n; i++) {
      const a = rnd(0, 6.283), e = rnd(-.6, 1.2), s = speed * rnd(.3, 1);
      sparks.push({x, y, z, vx: Math.cos(a) * Math.cos(e) * s, vy: Math.sin(e) * s + 1, vz: Math.sin(a) * Math.cos(e) * s, life: life * rnd(.6, 1.2), max: life, r: c.r, g: c.g, b: c.b});
    }
  }
  function drawPoints(cloud, list, getCol){
    for (let i = 0; i < cloud.n; i++) {
      const o = list[i], k = i * 3;
      if (!o) { cloud.pos[k + 1] = -999; cloud.col[k] = cloud.col[k + 1] = cloud.col[k + 2] = 0; continue; }
      cloud.pos[k] = o.x; cloud.pos[k + 1] = o.y; cloud.pos[k + 2] = o.z; const f = getCol(o); cloud.col[k] = o.r * f; cloud.col[k + 1] = o.g * f; cloud.col[k + 2] = o.b * f;
    }
    cloud.g.attributes.position.needsUpdate = true; cloud.g.attributes.color.needsUpdate = true;
  }
  const fireballs = Array.from({length: 14}, () => { const s = new T.Sprite(new T.SpriteMaterial({map: TX.glow, blending: T.AdditiveBlending, depthWrite: false, transparent: true})); s.visible = false; scene.add(s); return {s, t: 0, max: 0, size: 1}; });
  function fireball(x, y, z, size, life = .5, color = 0xffffff){ const f = fireballs.find(o => !o.s.visible) || fireballs[0]; f.s.visible = true; f.s.position.set(x, y, z); f.t = 0; f.max = life; f.size = size; f.s.material.color.set(color); f.s.material.rotation = rnd(0, 6); }
  const beams = Array.from({length: 34}, () => { const m = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({color: 0xffffff, transparent: true, blending: T.AdditiveBlending, depthWrite: false})); m.visible = false; scene.add(m); return {m, t: 0, max: 0, w: .05, keep: false}; });
  const _a = new T.Vector3(), _b = new T.Vector3(), _c = new T.Vector3();
  function beam(x1, y1, z1, x2, y2, z2, color, width, life, keep = false){
    const b = beams.find(o => !o.m.visible) || beams[0], len = Math.hypot(x2 - x1, y2 - y1, z2 - z1);
    b.m.visible = true; b.t = 0; b.max = life; b.w = width; b.keep = keep; b.m.material.color.set(color); b.m.material.opacity = 1;
    b.m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2); b.m.scale.set(width, width, Math.max(.01, len)); b.m.lookAt(x2, y2, z2);
    return b;
  }
  // An aiming laser stops short of the player, or its last metre fills his whole view.
  function short(x1, y1, z1, x2, y2, z2, by = 1.3){ const l = Math.hypot(x2 - x1, y2 - y1, z2 - z1), k = l > by ? (l - by) / l : .05; return [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, z1 + (z2 - z1) * k]; }
  function setBeam(b, x1, y1, z1, x2, y2, z2){ const len = Math.hypot(x2 - x1, y2 - y1, z2 - z1); b.m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2); b.m.scale.set(b.w, b.w, Math.max(.01, len)); b.m.lookAt(x2, y2, z2); }
  const rings = Array.from({length: 10}, () => { const m = new T.Mesh(new T.RingGeometry(.86, 1, 40), new T.MeshBasicMaterial({color: 0xff3b2f, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide})); m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return {m, t: 0, max: 0, r: 1, grow: false}; });
  function ring(x, z, radius, life, color = 0xff3b2f, grow = false){ const o = rings.find(q => !q.m.visible) || rings[0]; o.m.visible = true; o.m.position.set(x, .06, z); o.t = 0; o.max = life; o.r = radius; o.grow = grow; o.m.material.color.set(color); o.m.scale.setScalar(grow ? .1 : radius); return o; }
  const debris = [];
  function breakApart(r){
    const names = Object.keys(r.def.bones).reverse();
    for (const n of names) { const b = r.mesh.bones[n]; if (!b.children.length) continue; scene.attach(b);
      const dx = b.getWorldPosition(_a).x - r.x, dz = _a.z - r.z, l = Math.hypot(dx, dz) || 1, sp = rnd(2, 5) * (r.boss ? 1.6 : 1);
      debris.push({o: b, vx: dx / l * sp + rnd(-1, 1), vy: rnd(3, 7), vz: dz / l * sp + rnd(-1, 1), wx: rnd(-6, 6), wy: rnd(-6, 6), wz: rnd(-6, 6), t: 0, life: r.boss ? 3 : 2.2, s: b.scale.x}); }
    scene.remove(r.mesh.root);
  }
  let shake = 0;
  function explode(x, y, z, R, dmg, byPlayer, hurtsPlayer){
    fireball(x, y + .3, z, R * 1.5, .55, 0xffd29a); fireball(x + rnd(-.5, .5), y + .8, z + rnd(-.5, .5), R, .7, 0xff7a2a);
    spark(x, y + .3, z, 34, 0xffa040, 9, .7); spark(x, y + .3, z, 10, 0xffffff, 5, .3);
    flashLight.position.set(x, y + 1.2, z); flashLight.intensity = 5;
    const d = Math.hypot(P.x - x, P.z - z); shake = Math.max(shake, clamp(1.2 - d / 18, 0, 1) * .5); snd.play('boom', clamp(1.3 - d / 30, .2, 1));
    for (const r of [...bots]) { const rd = Math.hypot(r.x - x, r.z - z) - r.def.r * .6; if (rd < R) hitBot(r, dmg * (1 - .6 * Math.max(0, rd) / R), 'splash', r.x, (r.y || 0) + 1, r.z, byPlayer); }
    if (hurtsPlayer && d < R) hurt(hurtsPlayer * (1 - .5 * d / R), x, z);
  }

  /* ---------- the player and his guns ---------- */
  const snd = makeSound(api);
  const P = {x: 0, z: 18, yaw: 0, pitch: 0, hp: 100, lives: 3, regen: 0, inv: 0, vx: 0, vz: 0, bob: 0, dead: 0, nades: 2};
  const G = {mode: 'menu', menu: 'lobby', sel: Math.min(save.zone, ENDLESS + 1), zone: 1, wave: 0, score: 0, kills: 0, queue: [], pending: [], spawnT: 0, breakT: 0, streak: 0,
    maxAlive: 6, hpK: 1, dmgK: 1, endless: false, loop: 0, weekPacks: 0, weekLives: 0, hot: false, ammoHint: 0, prev: 'play', time: 0, lastHit: 0};
  const bots = [], bolts = [], nades = [], lobbyBots = [];
  const ARM = {cur: 'pistol', have: ['pistol'], ammo: {}, cool: 0, reload: 0, rmax: 1, swap: 0, ads: false, adsK: 0, spin: 0, kick: 0, flash: 0};
  const gun = () => GUNS.find(g => g.id === ARM.cur);
  const wordsTotal = () => demo ? 9999 : spell && spell.total ? spell.total() : (save.words || 0);
  const haveGuns = () => GUNS.filter(g => g.words <= wordsTotal()).map(g => g.id);
  const zoneDef = () => ZONES[G.endless ? G.loopZone : G.zone - 1];
  // The gun is drawn in its own little scene on top, so it never pokes into walls.
  const gunScene = new T.Scene(), gunCam = new T.PerspectiveCamera(62, 1, .01, 10); gunScene.add(gunCam);
  const gunHemi = new T.HemisphereLight(0xffffff, 0x404040, .9); gunScene.add(gunHemi); const gunSun = new T.DirectionalLight(0xffffff, 1.1); gunSun.position.set(-1, 2, 1); gunScene.add(gunSun);
  const held = new T.Group(); gunCam.add(held);
  const std = (hex, rough, metal) => new T.MeshStandardMaterial({color: new T.Color(hex).convertSRGBToLinear(), roughness: rough, metalness: metal});
  const basic = hex => new T.MeshBasicMaterial({color: new T.Color(hex)});
  const FPM = {k: std('#1d1f22', .45, .6), m: std('#3a3d42', .4, .7), l: std('#b8bdc6', .35, .6), t: std('#6f6347', .7, .2), o: std('#4f5a3c', .7, .3), w: std('#6b4423', .7, .1), c: std('#b06a3b', .4, .6),
    n: std('#24324a', .5, .5), r: std('#b3261e', .5, .3), v: std('#2c2f25', .9, 0), s: std('#4f5a3c', 1, 0), e: basic('#ff8a1a'), b: basic('#5fd0ff'), g: basic('#7cff3a'), p: basic('#ff2fd6'), r2: basic('#ff2020')};
  const gunModels = {};
  function gunModel(id){
    if (gunModels[id]) return gunModels[id];
    const g = GUNS.find(x => x.id === id), grp = new T.Group(), byMat = {};
    for (const [x, y, z, w, h, d, m, o] of [...g.parts, ...(g.hands || HANDS)]) (byMat[m] = byMat[m] || new Geo()).box(x, y, z, w, h, d, Object.assign({uv: 'unit', bottom: true}, o || {}));
    for (const [m, geo] of Object.entries(byMat)) grp.add(new T.Mesh(geo.geometry(), FPM[m]));
    let spin = null;
    if (g.spinParts) { spin = new T.Group(); const geo = new Geo(); for (const [x, y, z, w, h, d] of g.spinParts) geo.box(x, y, z, w, h, d, {uv: 'unit', bottom: true}); spin.add(new T.Mesh(geo.geometry(), FPM.m)); grp.add(spin); }
    const flash = new T.Sprite(new T.SpriteMaterial({map: TX.glow, blending: T.AdditiveBlending, depthWrite: false, transparent: true}));
    flash.position.set(...g.muzzle); flash.position.z -= .05; flash.scale.setScalar(.38); flash.visible = false; grp.add(flash);
    return gunModels[id] = {grp, spin, flash, g};
  }
  let model = null;
  function equip(id, quiet){
    if (!ARM.have.includes(id)) return;
    if (model) held.remove(model.grp);
    ARM.cur = id; ARM.swap = quiet ? 0 : .35; ARM.reload = 0; ARM.spin = 0; model = gunModel(id); held.add(model.grp);
    if (!quiet) snd.play('click'); save.gun = id; drawGunBar();
  }
  function resetAmmo(){ const packs = 2 + G.weekPacks; for (const g of GUNS) ARM.ammo[g.id] = {mag: g.mag, res: g.pack === Infinity ? Infinity : Math.min(g.pack * 8, g.pack * packs)}; }
  function addPacks(n){ for (const g of GUNS) { if (g.pack === Infinity) continue; const a = ARM.ammo[g.id]; a.res = Math.min(g.pack * 8, a.res + g.pack * n); } }
  const _m = new T.Vector3();
  function muzzleWorld(){ const g = gun(); _m.set(...g.muzzle); held.localToWorld(_m); return cam.localToWorld(_m); }
  function aimDir(spread){
    const a = rnd(0, 6.283), r = spread ? Math.sqrt(Math.random()) * spread : 0;
    _a.set(Math.cos(a) * r, Math.sin(a) * r, -1).normalize().applyQuaternion(cam.quaternion); return [_a.x, _a.y, _a.z];
  }
  function sph(r, s){ const c = Math.cos(r.face), sn = Math.sin(r.face), k = r.sc || 1; return [r.x + (s[0] * c + s[2] * sn) * k, (r.y || 0) + s[1] * k, r.z + (-s[0] * sn + s[2] * c) * k]; }
  function raySph(ox, oy, oz, dx, dy, dz, cx, cy, cz, rad){ const lx = cx - ox, ly = cy - oy, lz = cz - oz, tc = lx * dx + ly * dy + lz * dz; if (tc < 0) return -1; const d2 = lx * lx + ly * ly + lz * lz - tc * tc; if (d2 > rad * rad) return -1; return tc - Math.sqrt(rad * rad - d2); }
  function trace(ox, oy, oz, dx, dy, dz, range, pierce = 1){
    const hits = [];
    for (const r of bots) {
      if (r.sc < .5) continue; let bt = Infinity, tag = 'body';
      for (const s of r.def.spheres) { if (s[4] === 'shield' && r.shieldDown > 0) continue; const c = sph(r, s), t = raySph(ox, oy, oz, dx, dy, dz, c[0], c[1], c[2], s[3] * (r.sc || 1)); if (t >= 0 && t < bt) { bt = t; tag = s[4] || 'body'; } }
      if (bt < range) hits.push({r, t: bt, tag});
    }
    hits.sort((a, b) => a.t - b.t);
    const wall = rayWorld(ox, oy, oz, dx, dy, dz, range), out = [];
    for (const h of hits) { if (h.t > wall) break; out.push(h); if (h.tag === 'shield' || out.length >= pierce) break; }
    return {hits: out, wall};
  }
  // A little help aiming on a touch screen: a shot that only just misses goes to the robot.
  function assist(ox, oy, oz, dx, dy, dz, maxAng){
    let best = null, bestA = maxAng;
    for (const r of bots) {
      if (r.sc < .5) continue; const s = r.def.spheres[0], c = sph(r, s), vx = c[0] - ox, vy = c[1] - oy, vz = c[2] - oz, l = Math.hypot(vx, vy, vz); if (l > 70) continue;
      const a = Math.acos(clamp((vx * dx + vy * dy + vz * dz) / l, -1, 1)) - Math.atan(s[3] * .9 / l);
      if (a < bestA && clear(ox, oy, oz, c[0], c[1], c[2])) { bestA = a; best = [vx / l, vy / l, vz / l]; }
    }
    return best;
  }
  function fire(){
    const g = gun(), a = ARM.ammo[g.id];
    a.mag--; ARM.kick = 1; ARM.flash = .05; muzzleLight.intensity = 2.2; snd.play(g.sfx, .9);
    P.pitch = clamp(P.pitch + g.recoil * (1 - .45 * ARM.adsK), -1.35, 1.35); P.yaw += rnd(-1, 1) * g.recoil * .2;
    cam.updateMatrixWorld(); gunCam.updateMatrixWorld();
    const ox = cam.position.x, oy = cam.position.y, oz = cam.position.z, mz = muzzleWorld().clone();
    const spread = lerp(g.spread || 0, g.ads || 0, ARM.adsK) * (Math.hypot(P.vx, P.vz) > .8 ? 1.35 : 1), help = ARM.adsK > .5 ? .025 : .045;
    if (g.kind === 'hit') {
      for (let i = 0; i < (g.pellets || 1); i++) {
        let d = aimDir(spread), tr = trace(ox, oy, oz, d[0], d[1], d[2], g.range);
        if (!g.pellets && !tr.hits.length) { const as = assist(ox, oy, oz, d[0], d[1], d[2], help); if (as) { d = as; tr = trace(ox, oy, oz, d[0], d[1], d[2], g.range); } }
        const h = tr.hits[0], t = h ? h.t : tr.wall, hx = ox + d[0] * t, hy = oy + d[1] * t, hz = oz + d[2] * t;
        if (h) hitBot(h.r, g.dmg, h.tag, hx, hy, hz, true); else if (t < g.range) spark(hx, hy, hz, 3, 0xffd27a, 3, .22);
        if (i < 3) beam(mz.x, mz.y, mz.z, hx, hy, hz, g.tracer, .022, .05);
      }
    } else if (g.kind === 'rail') {
      let d = aimDir(spread), tr = trace(ox, oy, oz, d[0], d[1], d[2], g.range, g.pierce);
      if (!tr.hits.length) { const as = assist(ox, oy, oz, d[0], d[1], d[2], help * .6); if (as) { d = as; tr = trace(ox, oy, oz, d[0], d[1], d[2], g.range, g.pierce); } }
      const end = tr.hits.length && tr.hits[tr.hits.length - 1].tag === 'shield' ? tr.hits[tr.hits.length - 1].t : tr.wall;
      for (const h of tr.hits) hitBot(h.r, g.dmg, h.tag, ox + d[0] * h.t, oy + d[1] * h.t, oz + d[2] * h.t, true);
      beam(mz.x, mz.y, mz.z, ox + d[0] * end, oy + d[1] * end, oz + d[2] * end, g.tracer, .07, .35); spark(ox + d[0] * end, oy + d[1] * end, oz + d[2] * end, 8, g.tracer, 4, .4);
    } else if (g.kind === 'proj' || g.kind === 'rocket') {
      const d = aimDir(spread), tr = trace(ox, oy, oz, d[0], d[1], d[2], 120), t = tr.hits[0] ? tr.hits[0].t : tr.wall;
      fireBolt(mz.x, mz.y, mz.z, ox + d[0] * t, oy + d[1] * t, oz + d[2] * t, {speed: g.speed, dmg: g.dmg, splash: g.splash, color: g.color, rocket: g.kind === 'rocket'}, true);
    } else if (g.kind === 'tesla') {
      const d = aimDir(0); let target = trace(ox, oy, oz, d[0], d[1], d[2], g.range).hits[0];
      if (!target) { const as = assist(ox, oy, oz, d[0], d[1], d[2], .14); if (as) target = trace(ox, oy, oz, as[0], as[1], as[2], g.range).hits[0]; }
      if (!target) { const t = rayWorld(ox, oy, oz, d[0], d[1], d[2], g.range); bolt3(mz.x, mz.y, mz.z, ox + d[0] * t, oy + d[1] * t, oz + d[2] * t); }
      else {
        let from = [mz.x, mz.y, mz.z], cur = target.r; const done = new Set();
        for (let k = 0; k < g.chain && cur; k++) {
          done.add(cur); const c = sph(cur, cur.def.spheres[0]); bolt3(from[0], from[1], from[2], c[0], c[1], c[2]); hitBot(cur, g.dmg * (k ? .8 : 1), k ? 'body' : target.tag, c[0], c[1], c[2], true); from = c;
          let next = null, nd = 8; for (const r of bots) { if (done.has(r) || r.sc < .5) continue; const q = Math.hypot(r.x - c[0], r.z - c[2]); if (q < nd && clear(c[0], c[1], c[2], r.x, (r.y || 0) + 1, r.z)) { nd = q; next = r; } } cur = next;
        }
      }
    }
    if (a.mag <= 0) { if (a.res > 0) ARM.autoT = .14; else outOfAmmo(); }
  }
  function bolt3(x1, y1, z1, x2, y2, z2){   // a jagged lightning arc
    let px = x1, py = y1, pz = z1; const n = 6;
    for (let i = 1; i <= n; i++) { const k = i / n, j = i < n ? .35 : 0, nx = lerp(x1, x2, k) + rnd(-j, j), ny = lerp(y1, y2, k) + rnd(-j, j), nz = lerp(z1, z2, k) + rnd(-j, j); beam(px, py, pz, nx, ny, nz, 0x9fe8ff, .05, .16); px = nx; py = ny; pz = nz; }
    spark(x2, y2, z2, 10, 0x9fe8ff, 4, .35);
  }
  function reload(){ const g = gun(), a = ARM.ammo[g.id]; if (ARM.reload > 0 || ARM.swap > 0 || a.mag >= g.mag || a.res <= 0) return; ARM.reload = ARM.rmax = g.reload; snd.play('reload'); }
  function outOfAmmo(){
    snd.play('empty'); want.spell = true;
    if (G.time - G.ammoHint > 5) { G.ammoHint = G.time; toast(ARM.cur === 'pistol' ? 'Tap SPELL for a supply drop!' : 'Out of ammo! Tap SPELL for a supply drop.'); }
    if (ARM.cur !== 'pistol') ARM.toPistol = .5;
  }
  function throwNade(){
    if (P.nades <= 0) { snd.play('empty'); toast('No grenades. Spell for more!'); want.spell = true; return; }
    P.nades--; const d = aimDir(0), m = new T.Mesh(nadeGeo, nadeMat); scene.add(m);
    nades.push({x: cam.position.x + d[0] * .6, y: cam.position.y - .25, z: cam.position.z + d[2] * .6, vx: d[0] * 14, vy: d[1] * 14 + 4, vz: d[2] * 14, t: 1.7, m}); snd.play('throw');
  }
  const nadeGeo = new T.SphereGeometry(.12, 10, 8), nadeMat = new T.MeshLambertMaterial({color: 0x2a3a22, emissive: 0x330000});
  function fireBolt(x, y, z, tx, ty, tz, spec, mine){
    let dx = tx - x, dy = ty - y, dz = tz - z; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    const s = spec.spread || 0; if (s) { dx += rnd(-s, s); dy += rnd(-s, s) * .5; dz += rnd(-s, s); const q = Math.hypot(dx, dy, dz); dx /= q; dy /= q; dz /= q; }
    const c = new T.Color(spec.color || 0xff3b2f);
    bolts.push({x, y, z, vx: dx * spec.speed, vy: dy * spec.speed, vz: dz * spec.speed, dmg: spec.dmg, splash: spec.splash || 0, life: 4, mine, r: c.r, g: c.g, b: c.b, rocket: spec.rocket, src: spec.src});
  }
  function lob(x, y, z, tx, tz, dmg, radius, time = 1.35){
    const g = 9.8; bolts.push({x, y, z, vx: (tx - x) / time, vy: (.1 - y + .5 * g * time * time) / time, vz: (tz - z) / time, dmg, splash: radius, life: time + 1, lob: true, r: 1, g: .55, b: .2});
    ring(tx, tz, radius, time, 0xff3b2f);
  }

  /* ---------- hits and hurts ---------- */
  function hitBot(r, dmg, tag, hx, hy, hz, byPlayer){
    if (r.dead || dmg <= 0) return;
    if (tag === 'shield') { spark(hx, hy, hz, 8, 0x7fdcff, 4, .3); if (byPlayer) snd.play('shield', .6); return; }
    const k = tag === 'head' ? 1.5 : tag === 'core' ? 2 : 1;
    r.hp -= dmg * k; r.flash = .08; r.hurtT = 2.5;
    if (tag !== 'splash') spark(hx, hy, hz, k > 1 ? 9 : 5, k > 1 ? 0xffb03a : 0xffe0a0, 4, .3);
    if (byPlayer) { hitMark(r.hp <= 0); snd.play(k > 1 ? 'head' : 'hit', .8); }
    if (r.hp <= 0) killBot(r, tag, byPlayer);
    else if (!r.boss && !r.def.heavy && tag !== 'splash') { const dx = r.x - P.x, dz = r.z - P.z, l = Math.hypot(dx, dz) || 1; r.vx += dx / l * 1.2; r.vz += dz / l * 1.2; }
  }
  function killBot(r, tag, byPlayer){
    if (r.dead) return; r.dead = true;
    const i = bots.indexOf(r); if (i >= 0) bots.splice(i, 1);
    if (r.laser) { r.laser.m.visible = false; r.laser = null; }
    const top = (r.y || 0) + (r.def.fly ? .6 : (r.def.eye || 1.5) + .4);
    if (byPlayer !== false) { const pts = Math.round(r.def.score * (tag === 'head' ? 1.5 : 1)); G.score += pts; G.kills++; save.kills = (save.kills || 0) + 1; pop(r.x, top, r.z, '+' + num(pts) + (tag === 'head' ? ' HEADSHOT' : ''), tag === 'head' || r.boss); G.lastHit = G.time; }
    spark(r.x, (r.y || 0) + (r.def.fly ? 0 : 1), r.z, r.boss ? 80 : 24, 0xffc060, r.boss ? 12 : 7, .7); fireball(r.x, (r.y || 0) + (r.def.fly ? 0 : 1), r.z, r.boss ? 7 : 2.2, .45, 0xffe0b0);
    snd.play('break', 1); breakApart(r); scene.remove(r.blob);
    if (r.type === 'roller') explode(r.x, .5, r.z, 3.4, 120, byPlayer !== false, Math.hypot(P.x - r.x, P.z - r.z) < 3.4 ? r.def.dmg : 0);
    if (r.boss) { for (let k = 0; k < 5; k++) setTimeout(() => { if (!gone) explode(r.x + rnd(-2, 2), rnd(.5, 3), r.z + rnd(-2, 2), 3, 0, true, 0); }, 150 + k * 260); shake = 1; banner(r.def.name.toUpperCase() + ' DESTROYED!', '+' + num(r.def.score)); }
  }
  const dmgEls = $$('.ss-dmg');
  let dmgI = 0;
  function hurt(dmg, fx, fz){
    if (P.inv > 0 || P.dead > 0 || !(G.mode === 'play' || G.mode === 'break')) return;
    P.hp -= dmg * G.dmgK; P.regen = 3.5; G.lastHurt = G.time; snd.play('hurt', .8); shake = Math.max(shake, .25);
    const v = $('.ss-vig'); v.style.transition = 'none'; v.style.opacity = clamp(.35 + dmg / 30, .35, .9); void v.offsetWidth; v.style.transition = 'opacity .7s'; v.style.opacity = 0;
    if (fx !== undefined) { const rel = wrap(Math.atan2(fx - P.x, fz - P.z) - Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw))), el = dmgEls[dmgI++ % dmgEls.length];
      el.style.transform = `rotate(${-rel}rad)`; el.style.transition = 'none'; el.style.opacity = 1; void el.offsetWidth; el.style.transition = 'opacity 1s'; el.style.opacity = 0; }
    if (P.hp <= 0) die();
  }
  function die(){
    P.hp = 0; P.lives = Math.max(0, P.lives - 1); P.dead = 2.4; ARM.ads = false; IN.fire = false; snd.play('hurt', 1); $('.ss-vig').style.opacity = .9;
  }
  function respawn(){
    let best = W.start, far = -1;
    for (let k = 0; k < 40; k++) { const x = rnd(-21, 21), z = rnd(-21, 21); if (W.nav.g[cell(x, z)]) continue; const d = Math.min(99, ...bots.map(r => Math.hypot(r.x - x, r.z - z))); if (d > far) { far = d; best = {x, z}; } }
    P.x = best.x; P.z = best.z; P.hp = 100; P.inv = 3; P.dead = 0; P.regen = 0; $('.ss-vig').style.opacity = 0; from.g = from.a = from.b = -1;
  }

  /* ---------- the robots ---------- */
  function addBot(type, x, z){
    const def = BOTS[type] || BOSSES[type], boss = !!BOSSES[type], mesh = robotMesh(type);
    const r = {type, def, boss, mesh, x, z, y: def.fly || 0, face: Math.atan2(P.x - x, P.z - z), hp: def.hp * (boss ? 1 + G.loop * .35 : G.hpK), t: 0, sc: .05, cd: rnd(.8, 1.8), ph: rnd(0, 6), strafe: pick([-1, 1]), strafeT: rnd(1.5, 3),
      los: false, losT: 0, flash: 0, vx: 0, vz: 0, hurtT: 0, shieldDown: 0, atk: 0, burst: 0, mi: 0, tp: rnd(2, 4), stuck: 0, sx: x, sz: z, base: {}};
    r.max = r.hp;
    for (const [n, b] of Object.entries(mesh.bones)) r.base[n] = b.position.y;
    mesh.root.position.set(x, r.y, z); mesh.root.scale.setScalar(.05); scene.add(mesh.root);
    r.blob = new T.Mesh(blobGeo, MAT.blob); r.blob.scale.setScalar(def.r * 2.6); r.blob.position.set(x, .025, z); scene.add(r.blob);
    bots.push(r);
    if (boss) { G.boss = r; snd.play('roar'); }
    else if (!demo && !save.seen.includes(type)) { save.seen.push(type); toast(`NEW BAD GUY: ${def.name}. ${def.tip}`, 3.6); }
    return r;
  }
  function openSpot(grid, minD, maxD, eye){
    for (let k = 0; k < 90; k++) { const a = rnd(0, 6.283), d = rnd(minD, maxD), x = P.x + Math.sin(a) * d, z = P.z + Math.cos(a) * d;
      if (Math.abs(x) > 21 || Math.abs(z) > 21 || grid[cell(x, z)]) continue; if (clear(x, eye, z, P.x, 1.5, P.z)) return {x, z}; }
    return null;
  }
  const gridOf = def => def.fly ? W.nav.a : def.attacks ? W.nav.b : W.nav.g;
  function spawnFrom(type){
    const boss = !!BOSSES[type], def = BOTS[type] || BOSSES[type];
    const far = W.spawns.filter(s => Math.hypot(s.x - P.x, s.z - P.z) > 13), s = (boss && openSpot(gridOf(def), 11, 19, def.fly || def.eye)) || pick(far.length ? far : W.spawns);
    ring(s.x, s.z, boss ? 4 : 1.5, .9, boss ? 0xff2e63 : 0x3ff0ff, true); spark(s.x, 1, s.z, boss ? 50 : 16, boss ? 0xff2e63 : 0x3ff0ff, 3, .9);
    snd.play('portal', clamp(1.2 - Math.hypot(s.x - P.x, s.z - P.z) / 40, .15, 1));
    G.pending.push({type, x: s.x + rnd(-.4, .4), z: s.z + rnd(-.4, .4), t: boss ? 1.2 : .75});
  }
  function muzzleOf(r, i){
    const list = r.def.muzzle || [[0, r.def.eye || 1.4, .6]], m = list[i % list.length], f = r.face + (r.tur || 0), c = Math.cos(f), s = Math.sin(f);
    return [r.x + m[0] * c + m[2] * s, (r.y || 0) + m[1], r.z - m[0] * s + m[2] * c];
  }
  function shoot(r, spec, i){ const m = muzzleOf(r, i ?? r.mi++); fireBolt(m[0], m[1], m[2], P.x, 1.25, P.z, Object.assign({}, spec, {dmg: spec.dmg}), false); snd.play('enemy', clamp(1.1 - Math.hypot(r.x - P.x, r.z - P.z) / 30, .15, .9)); }
  // Can a robot walk in a straight line to here? (sight is not enough: sandbags and low walls can be seen over)
  function walkable(x1, z1, x2, z2, grid){ const n = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / .5); for (let i = 1; i < n; i++) { const t = i / n; if (grid[cell(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)]) return false; } return true; }
  function turnTo(r, ang, dt, rate = 7){ r.face += clamp(wrap(ang - r.face), -rate * dt, rate * dt); }
  function blinkSpot(){
    const fa = Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw));
    for (let k = 0; k < 16; k++) { const a = fa + rnd(-1.2, 1.2), d = rnd(3, 4.6), x = P.x + Math.sin(a) * d, z = P.z + Math.cos(a) * d; if (Math.abs(x) > 22 || Math.abs(z) > 22 || W.nav.g[cell(x, z)]) continue; if (clear(P.x, 1.5, P.z, x, 1.5, z)) return {x, z}; }
    return null;
  }
  function think(r, dt){
    const d = r.def, dx = P.x - r.x, dz = P.z - r.z, dist = Math.hypot(dx, dz) || .01, ang = Math.atan2(dx, dz), alive = P.dead <= 0;
    r.losT -= dt; if (r.losT <= 0) { r.losT = .16 + Math.random() * .12; r.los = clear(r.x, (r.y || 0) + (d.fly ? 0 : d.eye * .9), r.z, P.x, 1.45, P.z); }
    r.cd -= dt; if (r.shieldDown > 0) r.shieldDown -= dt; r.tp -= dt;
    let mx = 0, mz = 0, speed = d.speed, look = null;
    const field = d.fly ? 'a' : r.boss ? 'b' : 'g';
    const toward = () => { if (r.los && dist < 9 && !r.boss && walkable(r.x, r.z, P.x, P.z, W.nav[field])) { mx = dx / dist; mz = dz / dist; } else { const f = flowDir(field, r.x, r.z); if (f) { mx = f[0]; mz = f[1]; } else { mx = dx / dist; mz = dz / dist; } } };
    const ranged = () => { const [lo, hi] = d.range;
      if (!r.los || dist > hi) toward();
      else if (dist < lo) { mx = -dx / dist; mz = -dz / dist; speed *= .7; }
      else { r.strafeT -= dt; if (r.strafeT <= 0) { r.strafe *= -1; r.strafeT = rnd(1.4, 3); } mx = -dz / dist * r.strafe; mz = dx / dist * r.strafe; speed *= .45; }
      if (r.los) look = ang; };
    const strike_ = (reach) => { if (dist < reach + .5 && alive) return true; return false; };
    switch (d.ai) {
      case 'melee':
        if (r.atk > 0) { r.atk -= dt; speed *= .2; toward(); if (r.atk <= 0) { if (strike_(d.reach)) { hurt(d.dmg, r.x, r.z); snd.play('zap'); const m = muzzleOf(r, 0); bolt3(m[0], m[1] - .4, m[2], P.x, 1.2, P.z); } r.cd = d.cd; } }
        else if (dist < d.reach && r.cd <= 0 && alive) { r.atk = .3; snd.play('beep', .5); r.flash = .05; }
        else toward();
        look = r.los ? ang : null; break;
      case 'pounce':
        if (r.leap) { const L = r.leap; L.t += dt; const k = Math.min(1, L.t / L.dur); r.x = lerp(L.x0, L.x1, k); r.z = lerp(L.z0, L.z1, k); r.y = Math.sin(Math.PI * k) * 1.3;
          if (k >= 1) { r.leap = null; r.y = 0; push(r, d.r * .9); if (Math.hypot(P.x - r.x, P.z - r.z) < d.reach && alive) { hurt(d.dmg, r.x, r.z); snd.play('slash', .8); } r.cd = d.cd; }
          turnTo(r, ang, dt, 12); return; }
        if (dist < 5.5 && r.los && r.cd <= 0 && alive) { r.leap = {x0: r.x, z0: r.z, x1: P.x - dx / dist * .9, z1: P.z - dz / dist * .9, t: 0, dur: .55}; snd.play('throw', .6); }
        else toward();
        look = r.los ? ang : null; break;
      case 'gunner':
        ranged();
        if (r.burst > 0) { r.burstT -= dt; if (r.burstT <= 0) { shoot(r, d.gun); r.burst--; r.burstT = d.gun.gap || .15; if (!r.burst) r.cd = d.gun.cd * rnd(.8, 1.25); } }
        else if (r.los && dist < d.range[1] + 5 && r.cd <= 0 && alive) { r.burst = d.gun.burst || 1; r.burstT = 0; }
        break;
      case 'sniper': {
        const gg = d.gun;
        if (r.aim > 0) { speed = 0; look = ang; r.aim -= dt; const m = muzzleOf(r, 0);
          if (!r.los || !alive) { r.aim = 0; r.cd = 1; if (r.laser) { r.laser.m.visible = false; r.laser = null; } }
          else { setBeam(r.laser, m[0], m[1], m[2], ...short(m[0], m[1], m[2], P.x, 1.3, P.z)); if (r.aim <= 0) { r.lock = gg.lock; r.lx = P.x; r.lz = P.z; snd.play('warn', .8); r.laser.m.material.color.set(0xff6060); } } }
        else if (r.lock > 0) { speed = 0; r.lock -= dt; const m = muzzleOf(r, 0); setBeam(r.laser, m[0], m[1], m[2], ...short(m[0], m[1], m[2], r.lx, 1.3, r.lz)); r.laser.m.visible = Math.floor(G.time * 16) % 2 === 0;
          if (r.lock <= 0) { r.laser.m.visible = false; r.laser = null; fireBolt(m[0], m[1], m[2], r.lx, 1.3, r.lz, {speed: gg.speed, dmg: gg.dmg, color: gg.color}, false); snd.play('snipe', clamp(1.2 - dist / 40, .3, 1)); r.cd = gg.cd * rnd(.85, 1.2); } }
        else { ranged(); if (r.los && dist < d.range[1] + 4 && r.cd <= 0 && alive) { r.aim = gg.aim; const m = muzzleOf(r, 0); r.laser = beam(m[0], m[1], m[2], ...short(m[0], m[1], m[2], P.x, 1.3, P.z), 0xff2020, .03, 99, true); snd.play('beep', .6); } }
        break; }
      case 'shield':
        if (r.atk > 0) { r.atk -= dt; speed *= .1; if (r.atk <= 0) { if (strike_(d.reach)) { hurt(d.dmg, r.x, r.z); snd.play('slash', .8); } r.cd = d.cd; } }
        else if (dist < d.reach && r.cd <= 0 && alive) { r.atk = .55; r.shieldDown = 1.5; }
        else toward();
        if (r.shieldDown > 0) speed *= .3; look = r.los ? ang : null; break;
      case 'roller':
        if (r.fuse > 0) { r.fuse -= dt; speed *= .35; r.beepT = (r.beepT || 0) - dt; if (r.beepT <= 0) { r.beepT = .14; snd.play('beep', .7); r.flash = .06; } toward(); if (r.fuse <= 0) { killBot(r, null, false); return; } }
        else if (dist < d.reach && alive) { r.fuse = .75; }
        else toward();
        break;
      case 'blink':
        if (r.atk > 0) { r.atk -= dt; speed *= .15; if (r.atk <= 0) { if (strike_(d.reach)) { hurt(d.dmg, r.x, r.z); snd.play('slash'); } r.cd = d.cd; } }
        else if (dist > 7 && r.tp <= 0 && r.los && alive) { const s = blinkSpot(); if (s) { spark(r.x, 1, r.z, 20, 0xff2fd6, 4, .5); r.x = s.x; r.z = s.z; r.vx = r.vz = 0; spark(r.x, 1, r.z, 20, 0xff2fd6, 4, .5); snd.play('portal', .8); r.tp = 6; r.atk = .65; r.face = Math.atan2(P.x - r.x, P.z - r.z); } else r.tp = 1; }
        else if (dist < d.reach && r.cd <= 0 && alive) { r.atk = .45; }
        else toward();
        look = r.los ? ang : null; break;
      case undefined:   // a boss
        if (r.act) runAttack(r, dt, dist);
        else if (r.cd <= 0 && alive) startAttack(r, dist);
        ranged(); speed *= r.act ? (r.act.a.k === 'stomp' || r.act.a.k === 'laser' ? 0 : .4) : 1;
        if (d.anim === 'tank') { r.tur = (r.tur || 0) + clamp(wrap(ang - r.face - (r.tur || 0)), -2 * dt, 2 * dt); look = null; } else look = ang;
        break;
    }
    // move
    const k = 1 - Math.exp(-8 * dt);
    r.vx = lerp(r.vx, mx * speed, k); r.vz = lerp(r.vz, mz * speed, k);
    r.x += r.vx * dt; r.z += r.vz * dt;
    if (d.fly) { for (const o of W.obs) if (o.h > r.y - 1) { const nx = clamp(r.x, o.x0, o.x1), nz = clamp(r.z, o.z0, o.z1), qx = r.x - nx, qz = r.z - nz, q = Math.hypot(qx, qz); if (q < d.r && q > .001) { r.x = nx + qx / q * d.r; r.z = nz + qz / q * d.r; } }
      r.x = clamp(r.x, -21.5, 21.5); r.z = clamp(r.z, -21.5, 21.5); r.y = d.fly + Math.sin(r.t * 1.4 + r.ph) * .35; }
    else if (!r.leap) push(r, d.r * (r.boss ? .7 : .9));
    const moving = Math.hypot(r.vx, r.vz);
    turnTo(r, look ?? (moving > .3 ? Math.atan2(r.vx, r.vz) : r.face), dt, r.boss ? 2.2 : 7);
    // a robot he has not been able to see for a while (a boss after 5 seconds) comes through a portal where he can
    r.noSee = r.los || r.act || r.sc < 1 ? 0 : (r.noSee || 0) + dt;
    if (r.noSee > (r.boss ? 5 : 12)) { const s = openSpot(gridOf(d), r.boss ? 10 : 7, r.boss ? 18 : 14, d.fly || d.eye); r.noSee = 0;
      if (s) { spark(r.x, 1.5, r.z, 20, 0x3ff0ff, 3, .6); r.x = s.x; r.z = s.z; r.vx = r.vz = 0; ring(s.x, s.z, r.boss ? 4 : 1.5, .8, r.boss ? 0xff2e63 : 0x3ff0ff, true); spark(s.x, 1.5, s.z, 24, 0x3ff0ff, 3, .7); snd.play('portal', .7); return; } }
    // a robot that has not moved for a long time goes back through a door
    r.stuck = moving < .15 && !r.los && !r.act ? r.stuck + dt : 0;
    if (r.stuck > 7 && !r.boss) { const s = pick(W.spawns); r.x = s.x; r.z = s.z; r.stuck = 0; }
  }
  /* boss attacks: each is shown first, then lands */
  function startAttack(r, dist){
    const opts = r.def.attacks.filter(a => (a.k !== 'stomp' || dist < a.radius + 1) && (a.k !== 'summon' || (bots.length + G.pending.length < 6 && (r.summons || 0) < 4)) && (a.k !== 'laser' && a.k !== 'volley' && a.k !== 'burst' && a.k !== 'ring' || r.los));
    if (!opts.length) { r.cd = .6; return; }
    let w = opts.reduce((s, a) => s + a.w, 0) * Math.random(), a = opts[0]; for (const o of opts) { w -= o.w; if (w <= 0) { a = o; break; } }
    r.act = {a, t: 0, n: 0, next: 0};
    if (a.k === 'stomp') { r.act.ring = ring(r.x, r.z, a.radius, 1.0, 0xff3b2f, true); snd.play('warn', 1); }
    if (a.k === 'laser') { const m = muzzleOf(r, a.from || 0); r.act.tx = P.x; r.act.tz = P.z; r.act.beam = beam(m[0], m[1], m[2], ...short(m[0], m[1], m[2], P.x, 1.3, P.z), 0xff2020, .05, 99, true); snd.play('warn', 1); }
    if (a.k === 'summon') snd.play('roar', .8);
    if (a.k === 'volley' || a.k === 'ring') r.flash = .1;
  }
  function runAttack(r, dt, dist){
    const A = r.act, a = A.a; A.t += dt;
    const end = () => { if (A.beam) A.beam.m.visible = false; r.act = null; r.cd = a.cd * rnd(.85, 1.15) * (r.hp < r.max * .5 ? .7 : 1); };
    switch (a.k) {
      case 'shell': if (A.t >= A.next && A.n < a.n) { const m = muzzleOf(r, 0), tx = A.n ? P.x + rnd(-3.5, 3.5) : P.x, tz = A.n ? P.z + rnd(-3.5, 3.5) : P.z; lob(m[0], m[1], m[2], tx, tz, a.dmg, a.radius); A.n++; A.next += .32; snd.play('rocket', .7); fireball(m[0], m[1], m[2], 1.2, .2); } if (A.n >= a.n && A.t > A.next + .2) end(); break;
      case 'burst': if (A.t >= A.next && A.n < a.n) { shoot(r, {dmg: a.dmg, speed: a.speed, color: a.color, spread: .05}, a.from || 0); A.n++; A.next += .09; } if (A.n >= a.n) end(); break;
      case 'volley': if (A.t > .45) { const m = muzzleOf(r, a.from || 0), base = Math.atan2(P.x - m[0], P.z - m[2]); for (let i = 0; i < a.n; i++) { const an = base + (i / (a.n - 1) - .5) * a.arc; fireBolt(m[0], m[1], m[2], m[0] + Math.sin(an) * 10, 1.2, m[2] + Math.cos(an) * 10, {dmg: a.dmg, speed: a.speed, color: a.color}, false); } snd.play('enemy', 1); end(); } break;
      case 'ring': if (A.t > .45) { for (let i = 0; i < a.n; i++) { const an = i / a.n * Math.PI * 2; fireBolt(r.x, r.y - .5, r.z, r.x + Math.sin(an) * 10, 1.2, r.z + Math.cos(an) * 10, {dmg: a.dmg, speed: a.speed, color: a.color}, false); } snd.play('enemy', 1); end(); } break;
      case 'stomp': { const k = Math.min(1, A.t / 1.0); if (r.mesh.bones.body) r.mesh.bones.body.position.y = r.base.body + Math.sin(k * Math.PI) * .5; if (A.ring) A.ring.m.scale.setScalar(Math.max(.1, k * a.radius));
        if (A.t >= 1.0) { snd.play('stomp', 1); shake = Math.max(shake, .8); spark(r.x, .3, r.z, 50, 0xffa040, 10, .6); ring(r.x, r.z, a.radius, .5, 0xffa040); if (Math.hypot(P.x - r.x, P.z - r.z) < a.radius) hurt(a.dmg, r.x, r.z); end(); } break; }
      case 'laser': { const m = muzzleOf(r, a.from || 0);
        if (A.t < 1.0) { A.tx = lerp(A.tx, P.x, Math.min(1, dt * 1.6)); A.tz = lerp(A.tz, P.z, Math.min(1, dt * 1.6)); setBeam(A.beam, m[0], m[1], m[2], ...short(m[0], m[1], m[2], A.tx, 1.2, A.tz)); A.beam.m.visible = Math.floor(A.t * 14) % 2 === 0; }
        else if (!A.fired) { A.fired = true; const dx = A.tx - m[0], dy = 1.2 - m[1], dz = A.tz - m[2], l = Math.hypot(dx, dy, dz), t = rayWorld(m[0], m[1], m[2], dx / l, dy / l, dz / l, 45);
          A.ex = m[0] + dx / l * t; A.ey = m[1] + dy / l * t; A.ez = m[2] + dz / l * t; A.beam.m.visible = false; { const tp = clamp(((P.x - m[0]) * (A.ex - m[0]) + (P.z - m[2]) * (A.ez - m[2])) / (((A.ex - m[0]) ** 2 + (A.ez - m[2]) ** 2) || 1), 0, 1), cx = m[0] + (A.ex - m[0]) * tp, cz = m[2] + (A.ez - m[2]) * tp, e = Math.hypot(P.x - cx, P.z - cz) < 1.6 ? short(m[0], m[1], m[2], cx, m[1] + (A.ey - m[1]) * tp, cz, 1.6) : [A.ex, A.ey, A.ez]; A.hot = beam(m[0], m[1], m[2], e[0], e[1], e[2], 0xff4040, .35, .55); } spark(A.ex, A.ey, A.ez, 30, 0xff6040, 8, .5); snd.play('laser', 1);
          // hit if he is close to the line
          const px = P.x - m[0], pz = P.z - m[2], L2 = (A.ex - m[0]) ** 2 + (A.ez - m[2]) ** 2, u = clamp((px * (A.ex - m[0]) + pz * (A.ez - m[2])) / (L2 || 1), 0, 1), cxp = m[0] + (A.ex - m[0]) * u, czp = m[2] + (A.ez - m[2]) * u;
          if (Math.hypot(P.x - cxp, P.z - czp) < 1.0) hurt(a.dmg, m[0], m[2]); }
        else if (A.t > 1.5) end(); break; }
      case 'summon': if (A.t > .6) { for (let i = 0; i < a.n; i++) spawnFrom(a.type); r.summons = (r.summons || 0) + 1; end(); } break;
      default: end();
    }
  }
  function animBot(r, dt){
    const b = r.mesh.bones, d = r.def, sp = Math.hypot(r.vx, r.vz), amt = clamp(sp / (d.speed || 2), 0, 1.2);
    r.ph += dt * (d.step || 8) * Math.max(amt, .05);
    switch (d.anim) {
      case 'biped': { const a = Math.sin(r.ph) * .55 * amt;
        if (b.legL) { b.legL.rotation.x = a; b.legR.rotation.x = -a; }
        if (b.armL && !(r.type === 'shield')) b.armL.rotation.x = -a * .5;
        if (b.armR && r.def.ai !== 'gunner' && r.def.ai !== 'sniper') b.armR.rotation.x = r.atk > 0 ? -1.2 : a * .5;
        if (b.body && !(r.act && r.act.a.k === 'stomp')) b.body.position.y = r.base.body + Math.abs(Math.sin(r.ph)) * .05 * (r.boss ? 3 : 1) * amt;
        if (b.head) b.head.rotation.y = clamp(wrap(Math.atan2(P.x - r.x, P.z - r.z) - r.face), -.9, .9);
        if (r.type === 'shield' && b.armL) b.armL.rotation.z = lerp(b.armL.rotation.z, r.shieldDown > 0 ? 1.1 : 0, Math.min(1, dt * 10));
        if (b.sawL) { b.sawL.rotation.x += dt * 18; b.sawR.rotation.x += dt * 18; }
        break; }
      case 'spider': { const a = Math.sin(r.ph) * .35 * Math.max(amt, r.leap ? 1 : 0);
        for (const [n, s] of [['legA', 1], ['legD', 1], ['legB', -1], ['legC', -1]]) if (b[n]) { b[n].rotation.z = a * s; b[n].rotation.x = Math.cos(r.ph) * .2 * s * amt; }
        b.body.position.y = r.base.body + Math.abs(Math.sin(r.ph * 2)) * .04; break; }
      case 'hover': for (const n of ['rA', 'rB', 'rC', 'rD']) if (b[n]) b[n].rotation.y += dt * 38;
        b.body.rotation.x = lerp(b.body.rotation.x, clamp(sp * .07, -.3, .3), Math.min(1, dt * 4)); break;
      case 'roll': b.body.rotation.x += sp * dt / .45; break;
      case 'tank': if (b.turret) b.turret.rotation.y = r.tur || 0; break;
      case 'crab': { let i = 0; for (const n of ['L1', 'L2', 'L3', 'R1', 'R2', 'R3']) if (b[n]) { b[n].rotation.x = Math.sin(r.ph + i * 1.7) * .25 * Math.max(amt, .15); i++; }
        if (b.clawL) { b.clawL.rotation.y = Math.sin(r.t * 3) * .15; b.clawR.rotation.y = -Math.sin(r.t * 3) * .15; }
        if (b.tail) b.tail.rotation.x = Math.sin(r.t * 2) * .12; break; }
      case 'float': b.body.position.y = Math.sin(r.t * 1.2) * .3; if (b.ring) b.ring.rotation.y += dt * 1.6; if (b.jaw) b.jaw.rotation.x = r.act ? .35 : .05; break;
    }
    const fl = r.flash > 0; if (fl !== r.fl) { r.fl = fl; for (const m of r.mesh.meshes) if (m.userData.mat === MAT.lit) m.material = fl ? MAT.flash : MAT.lit; }
    r.flash -= dt;
    r.mesh.root.position.set(r.x, r.y, r.z); r.mesh.root.rotation.y = r.face; r.mesh.root.scale.setScalar(r.sc);
    r.blob.position.set(r.x, .025, r.z); r.blob.material.opacity = 1; r.blob.scale.setScalar(d.r * 2.6 * (d.fly ? clamp(1.4 - r.y / 8, .4, 1) : 1));
  }

  /* ---------- waves ---------- */
  function startZone(z){
    G.endless = z > ENDLESS; G.zone = z; G.loop = 0; G.loopZone = G.endless ? rint(ZONES.length) : z - 1;
    buildZone(G.endless ? G.loopZone : z - 1); clearLobbyBots();
    const zi = G.endless ? 6 : z - 1;
    G.hpK = 1 + zi * .12; G.dmgK = [.7, .8, .9, 1, 1.05, 1.1, 1.15][zi]; G.maxAlive = [5, 6, 7, 8, 9, 9, 10][zi];
    for (const r of [...bots]) { scene.remove(r.mesh.root); scene.remove(r.blob); if (r.laser) r.laser.m.visible = false; } bots.length = 0; bolts.length = 0; G.pending.length = 0; G.boss = null;
    for (const n of nades) scene.remove(n.m); nades.length = 0;
    const week = demo ? 30 : spell && spell.week ? spell.week() : 0; G.weekPacks = Math.min(6, Math.floor(week / 5)); G.weekLives = Math.min(3, Math.floor(week / 10));
    P.x = W.start.x; P.z = W.start.z; P.yaw = 0; P.pitch = 0; P.hp = 100; P.lives = 3 + G.weekLives; P.nades = 2; P.inv = 2; P.dead = 0; P.vx = P.vz = 0; from.g = from.a = from.b = -1;
    ARM.have = haveGuns(); resetAmmo(); equip(ARM.have.includes(save.gun) ? save.gun : ARM.have[ARM.have.length - 1], true);
    G.wave = 0; G.score = 0; G.kills = 0; G.streak = 0; G.queue = []; G.mode = 'play'; G.runStart = G.time; save.games = (save.games || 0) + 1;
    showPlay(true); const Z = zoneDef(); snd.music(true, {key: Z.music[0], bpm: Z.music[1], boss: false});
    banner(G.endless ? 'ENDLESS ATTACK' : `ZONE ${z}: ${Z.name.toUpperCase()}`, G.weekPacks || G.weekLives ? `This week's spelling: +${G.weekPacks} ammo packs, +${G.weekLives} lives` : 'Get ready!');
    G.breakT = 3; G.mode = 'break'; G.firstBreak = true; showBreak(true);
  }
  const isBossWave = () => G.wave % PER_ZONE === 0;
  const bossType = () => G.endless ? ZONES[(G.wave / PER_ZONE - 1) % ZONES.length].boss : zoneDef().boss;
  function startWave(){
    G.wave++; G.firstBreak = false; hideBreak();
    const boss = isBossWave(), Z = zoneDef(), zi = G.endless ? 6 : G.zone - 1;
    const mix = G.endless ? Object.fromEntries(Object.keys(BOTS).map(k => [k, 1])) : Z.mix, keys = Object.keys(mix), tot = keys.reduce((s, k) => s + mix[k], 0);
    const n = boss ? 2 + Math.floor(zi / 2) : 5 + G.wave * 2 + zi + (G.endless ? G.wave : 0);
    G.queue = []; for (let i = 0; i < n; i++) { let w = Math.random() * tot; for (const k of keys) { w -= mix[k]; if (w <= 0) { G.queue.push(k); break; } } }
    if (boss) G.queue.unshift(bossType());
    G.spawnT = 1; snd.play('wave');
    if (boss) { banner('BOSS WAVE', BOSSES[bossType()].name); snd.music(true, {boss: true}); }
    else banner(G.endless ? `WAVE ${G.wave}` : `WAVE ${G.wave} OF ${PER_ZONE}`, G.wave === 1 ? zoneDef().name : `${n} robots`);
  }
  function waveDone(){
    G.score += 250 * G.wave; persist();
    if (isBossWave() && !G.endless) { zoneDone(); return; }
    if (isBossWave()) { G.loop++; snd.music(true, {boss: false}); G.hpK += .15; }
    banner('WAVE CLEARED!', `+${num(250 * G.wave)}`); snd.play('pickup');
    G.mode = 'break'; G.breakT = 9; showBreak();
  }
  function zoneDone(){
    G.mode = 'won'; IN.fire = false; snd.play('unlock'); snd.music(false);
    const before = save.zone; save.zone = Math.max(save.zone, G.zone + 1); G.unlockedZone = save.zone > before ? G.zone + 1 : 0;
    G.newBest = recordBest(); persist();
    G.wonT = 2.6;
  }
  function recordBest(){ const k = G.endless ? 'endless' : 'z' + G.zone, b = save.best[k] || {score: 0, wave: 0}; const nb = G.score > b.score; save.best[k] = {score: Math.max(b.score, G.score), wave: Math.max(b.wave || 0, G.wave)}; return nb && G.score > 0; }
  function persist(){ try { if (api.save) api.save(); } catch {} }
  function aliveCount(){ return bots.filter(r => !r.boss).length + G.pending.length; }
  function updateWaves(dt){
    if (G.mode === 'break') { if (!SP.open) G.breakT -= dt; const el = $('.ss-breakt'); if (el) el.textContent = G.breakT > 0 ? `Next wave in ${Math.ceil(G.breakT)}` : ''; if (G.breakT <= 0) { G.mode = 'play'; startWave(); } return; }
    if (G.mode !== 'play') return;
    G.spawnT -= dt;
    if (G.queue.length && G.spawnT <= 0 && (BOSSES[G.queue[0]] || aliveCount() < G.maxAlive)) { spawnFrom(G.queue.shift()); G.spawnT = rnd(.7, 1.5); }
    if (!G.queue.length && !bots.length && !G.pending.length) waveDone();
  }

  /* ---------- one step of the world ---------- */
  function update(dt){
    G.time += dt;
    const live = G.mode === 'play' || G.mode === 'break';
    if (live) {
      // the player
      if (P.dead > 0) { P.dead -= dt; P.vx = P.vz = 0; if (P.dead <= 0) { if (P.lives > 0) respawn(); else { G.mode = 'over'; IN.fire = false; menu('over'); return; } } }
      else {
        let ix = IN.mx, iz = IN.my; if (IN.keys.has('KeyW') || IN.keys.has('ArrowUp')) iz -= 1; if (IN.keys.has('KeyS') || IN.keys.has('ArrowDown')) iz += 1; if (IN.keys.has('KeyA')) ix -= 1; if (IN.keys.has('KeyD')) ix += 1;
        if (IN.keys.has('ArrowLeft')) P.yaw += dt * 2.4; if (IN.keys.has('ArrowRight')) P.yaw -= dt * 2.4;
        const l = Math.hypot(ix, iz); if (l > 1) { ix /= l; iz /= l; }
        const sp = ARM.adsK > .5 ? 2.7 : 4.6, fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw), k = 1 - Math.exp(-12 * dt);
        P.vx = lerp(P.vx, (rx * ix - fx * iz) * sp, k); P.vz = lerp(P.vz, (rz * ix - fz * iz) * sp, k);
        P.x += P.vx * dt; P.z += P.vz * dt;
        for (const r of bots) { if (r.def.fly || r.leap) continue; const dx = P.x - r.x, dz = P.z - r.z, d = Math.hypot(dx, dz), m = r.def.r + .35; if (d < m && d > .001) { P.x = r.x + dx / d * m; P.z = r.z + dz / d * m; } }
        push(P, .35);
        P.bob += Math.hypot(P.vx, P.vz) * dt * 2.3;
        if (P.regen > 0) P.regen -= dt; else if (P.hp < 100) P.hp = Math.min(100, P.hp + 25 * dt);
        if (P.inv > 0) P.inv -= dt;
      }
      // the robots' routes
      flood('g', P.x, P.z); flood('a', P.x, P.z); flood('b', P.x, P.z);
      for (let i = G.pending.length - 1; i >= 0; i--) { const q = G.pending[i]; q.t -= dt; if (q.t <= 0) { G.pending.splice(i, 1); addBot(q.type, q.x, q.z); } }
      for (const r of [...bots]) {
        r.t += dt;
        if (r.sc < 1) { r.sc = Math.min(1, r.sc + dt * 3); animBot(r, dt); continue; }
        think(r, dt); if (!r.dead) animBot(r, dt);
      }
      // robots keep apart
      for (let i = 0; i < bots.length; i++) for (let j = i + 1; j < bots.length; j++) {
        const a = bots[i], b = bots[j]; if (!!a.def.fly !== !!b.def.fly) continue; const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = (a.def.r + b.def.r) * .85;
        if (d < m && d > .001) { const p = (m - d) / d, wa = a.boss ? 0 : b.boss ? 1 : .5; a.x -= dx * p * wa; a.z -= dz * p * wa; b.x += dx * p * (1 - wa); b.z += dz * p * (1 - wa); }
      }
      updateArms(dt);
      updateBolts(dt);
      updateNades(dt);
      updateWaves(dt);
    }
    if (G.mode === 'won' && G.wonT > 0 && (G.wonT -= dt) <= 0) menu('won');
    updateFx(dt, live);
  }
  function updateArms(dt){
    const g = gun(), a = ARM.ammo[g.id];
    ARM.adsK = clamp(ARM.adsK + (ARM.ads && P.dead <= 0 ? dt : -dt) * 7, 0, 1);
    if (ARM.swap > 0) ARM.swap -= dt;
    if (ARM.reload > 0) { ARM.reload -= dt; if (ARM.reload <= 0) { const take = Math.min(g.mag - a.mag, a.res); a.mag += take; if (a.res !== Infinity) a.res -= take; } }
    ARM.cool -= dt;
    if (ARM.autoT > 0 && (ARM.autoT -= dt) <= 0) reload();
    if (ARM.toPistol > 0 && (ARM.toPistol -= dt) <= 0 && a.mag <= 0 && a.res <= 0) { equip('pistol'); return; }
    if (g.spin) ARM.spin = IN.fire ? Math.min(1, ARM.spin + dt / g.spin) : Math.max(0, ARM.spin - dt * 1.5);
    if (IN.fire && P.dead <= 0 && ARM.swap <= 0 && ARM.reload <= 0 && ARM.cool <= 0 && (!g.spin || ARM.spin >= 1)) {
      if (a.mag > 0) { fire(); ARM.cool = Math.max(ARM.cool, -.05) + 1 / g.rate; }
      else if (a.res > 0) reload(); else { outOfAmmo(); ARM.cool = .4; }
    }
    if (model && model.spin) model.spin.rotation.z += dt * 32 * ARM.spin;
  }
  function updateBolts(dt){
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i]; b.life -= dt; if (b.lob) b.vy -= 9.8 * dt;
      const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy, b.vz) * dt / .4)); let hit = false;
      for (let s = 0; s < steps && !hit; s++) {
        b.x += b.vx * dt / steps; b.y += b.vy * dt / steps; b.z += b.vz * dt / steps;
        if (b.mine) {
          for (const r of bots) { if (r.sc < .5) continue; for (const q of r.def.spheres) { if (q[4] === 'shield' && r.shieldDown > 0) continue; const c = sph(r, q); if ((b.x - c[0]) ** 2 + (b.y - c[1]) ** 2 + (b.z - c[2]) ** 2 < (q[3] + .1) ** 2) {
            if (b.splash) explode(b.x, b.y, b.z, b.splash, b.dmg, true, 0); else hitBot(r, b.dmg, q[4] || 'body', b.x, b.y, b.z, true); hit = true; break; } } if (hit) break; }
        } else if (!b.lob && P.dead <= 0 && Math.hypot(b.x - P.x, b.z - P.z) < .45 && b.y > .1 && b.y < 1.9) {
          if (b.splash) explode(b.x, b.y, b.z, b.splash, 0, false, b.dmg); else hurt(b.dmg, b.x - b.vx, b.z - b.vz); hit = true;
        }
        if (!hit && solidAt(b.x, b.y, b.z)) { if (b.splash) explode(b.x, Math.max(b.y, .2), b.z, b.splash, b.mine ? b.dmg : 0, !!b.mine, b.mine ? 0 : b.dmg); else spark(b.x, b.y, b.z, 4, 0xffffff, 2, .2); hit = true; }
      }
      if ((b.rocket || b.lob) && Math.random() < .7) spark(b.x, b.y, b.z, 1, 0xff9a3a, .6, .35);
      if (hit || b.life <= 0) bolts.splice(i, 1);
    }
  }
  function updateNades(dt){
    for (let i = nades.length - 1; i >= 0; i--) {
      const n = nades[i]; n.t -= dt; n.vy -= 14 * dt;
      const nx = n.x + n.vx * dt, ny = n.y + n.vy * dt, nz = n.z + n.vz * dt;
      if (ny <= .12) { n.y = .12; n.vy = -n.vy * .35; n.vx *= .7; n.vz *= .7; n.x = nx; n.z = nz; }
      else if (solidAt(nx, ny, nz)) { n.vx *= -.4; n.vz *= -.4; n.vy *= .5; }
      else { n.x = nx; n.y = ny; n.z = nz; }
      if (bots.some(r => r.sc > .5 && Math.hypot(r.x - n.x, r.z - n.z) < r.def.r + .3 && Math.abs(((r.y || 0) + (r.def.fly ? 0 : 1)) - n.y) < 1.5)) n.t = 0;
      n.m.position.set(n.x, n.y, n.z); n.m.material = nadeMat; n.m.visible = n.t > .5 || Math.floor(n.t * 12) % 2 === 0;
      if (n.t <= 0) { explode(n.x, n.y, n.z, 5, 160, true, 0); scene.remove(n.m); nades.splice(i, 1); }
    }
  }
  function updateFx(dt, live){
    const step = live ? dt : 0;
    for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.life -= dt; if (s.life <= 0) { sparks.splice(i, 1); continue; } s.vy -= 9 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; if (s.y < .02) { s.y = .02; s.vy *= -.3; s.vx *= .6; s.vz *= .6; } }
    drawPoints(SPK, sparks, s => clamp(s.life / s.max, 0, 1));
    drawPoints(BOLT, bolts, () => 1);
    for (const f of fireballs) if (f.s.visible) { f.t += dt; const k = f.t / f.max; if (k >= 1) { f.s.visible = false; continue; } f.s.scale.setScalar(f.size * (.4 + k)); f.s.material.opacity = 1 - k; }
    for (const b of beams) if (b.m.visible && !b.keep) { b.t += dt; const k = b.t / b.max; if (k >= 1) { b.m.visible = false; continue; } b.m.material.opacity = 1 - k; }
    for (const o of rings) if (o.m.visible) { o.t += dt; const k = o.t / o.max; if (k >= 1) { o.m.visible = false; continue; } if (o.grow) { if (!(G.boss && G.boss.act && G.boss.act.ring === o)) o.m.scale.setScalar(Math.max(.1, o.r * Math.min(1, k * 1.6))); } o.m.material.opacity = o.grow ? 1 - k * .6 : .45 + .45 * Math.sin(o.t * 18); }
    for (let i = debris.length - 1; i >= 0; i--) { const p = debris[i]; p.t += dt; p.vy -= 12 * dt; p.o.position.x += p.vx * dt; p.o.position.y += p.vy * dt; p.o.position.z += p.vz * dt;
      p.o.rotation.x += p.wx * dt; p.o.rotation.y += p.wy * dt; p.o.rotation.z += p.wz * dt;
      if (p.o.position.y < .15) { p.o.position.y = .15; p.vy = Math.abs(p.vy) * .3; p.vx *= .6; p.vz *= .6; p.wx *= .6; p.wz *= .6; }
      const left = p.life - p.t; if (left < .5) p.o.scale.setScalar(Math.max(.001, p.s * left / .5)); if (left <= 0) { scene.remove(p.o); debris.splice(i, 1); } }
    flashLight.intensity = Math.max(0, flashLight.intensity - dt * 18); muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 40);
    if (ARM.flash > 0) ARM.flash -= dt; if (model) { model.flash.visible = ARM.flash > 0; if (model.flash.visible) { model.flash.material.rotation = rnd(0, 6); model.flash.scale.setScalar(rnd(.28, .42)); } }
    ARM.kick = Math.max(0, ARM.kick - dt * 9);
    shake = Math.max(0, shake - dt * 1.6);
    if (W) TX.water.offset.x = (TX.water.offset.x + step * .03) % 1;
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += dt; if (p.t > 1.1) { p.el.remove(); pops.splice(i, 1); } }
  }

  /* ---------- touch, mouse and keyboard ---------- */
  const IN = {mx: 0, my: 0, keys: new Set(), joy: null, jo: [0, 0], look: null, ll: [0, 0], fire: false, firePtr: null, locked: false, releasing: false};
  const want = {spell: false};
  const playing = () => G.mode === 'play' || G.mode === 'break';
  const joyEl = $('.ss-joy'), joyKnob = joyEl.querySelector('i'), fireBtn = $('.ss-fire');
  function joyHome(){ joyEl.classList.add('idle'); joyEl.style.left = 'calc(110px + env(safe-area-inset-left))'; joyEl.style.top = 'calc(100% - 118px - env(safe-area-inset-bottom))'; joyKnob.style.transform = ''; }
  joyHome();
  function look(dx, dy){ const f = cam.fov / baseV * (G.hot && IN.look !== null ? .55 : 1); P.yaw -= dx * f; P.pitch = clamp(P.pitch - dy * f, -1.35, 1.35); }
  function releaseLock(){ IN.fire = false; ARM.ads = false; if (document.pointerLockElement === canvas) { IN.releasing = true; try { document.exitPointerLock(); } catch {} } }
  function button(k, e, el){
    if (k === 'fire') { IN.fire = true; IN.firePtr = e.pointerId; el.classList.add('press'); if (IN.look === null) { IN.look = e.pointerId; IN.ll = [e.clientX, e.clientY]; } return; }
    if (k === 'aim') ARM.ads = !ARM.ads;
    else if (k === 'reload') reload();
    else if (k === 'nade') throwNade();
    else if (k === 'pause') pause();
    else if (k.startsWith('gun:')) equip(k.slice(4));
    // SPELL opens on the click that follows, so the iPad lets the word be spoken
  }
  const onDown = e => {
    if (!playing() || SP.open) return;
    const b = e.target.closest('[data-b]');
    if (b) { if (b.dataset.b !== 'spell') e.preventDefault(); button(b.dataset.b, e, b); return; }
    if (e.target.closest('.ss-ov, .ss-break, .ss-turn')) return;
    if (e.pointerType === 'mouse') {
      if (!IN.locked && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch {} return; }
      if (e.button === 0) IN.fire = true; else if (e.button === 2) ARM.ads = true; return;
    }
    if (e.clientX < root.clientWidth * .45 && IN.joy === null) { IN.joy = e.pointerId; IN.jo = [e.clientX, e.clientY]; joyEl.classList.remove('idle'); joyEl.style.left = e.clientX + 'px'; joyEl.style.top = e.clientY + 'px'; }
    else if (IN.look === null) { IN.look = e.pointerId; IN.ll = [e.clientX, e.clientY]; }
  };
  const onMove = e => {
    if (e.pointerId === IN.joy) { let dx = e.clientX - IN.jo[0], dy = e.clientY - IN.jo[1]; const l = Math.hypot(dx, dy), max = 60; if (l > max) { dx *= max / l; dy *= max / l; } IN.mx = dx / max; IN.my = dy / max; joyKnob.style.transform = `translate(${dx}px,${dy}px)`; }
    else if (e.pointerId === IN.look && playing()) { const dx = e.clientX - IN.ll[0], dy = e.clientY - IN.ll[1]; IN.ll = [e.clientX, e.clientY]; look(dx * .0062, dy * .0052); }
  };
  const onUp = e => {
    if (e.pointerId === IN.joy) { IN.joy = null; IN.mx = IN.my = 0; joyHome(); }
    if (e.pointerId === IN.look) IN.look = null;
    if (e.pointerId === IN.firePtr) { IN.fire = false; IN.firePtr = null; fireBtn.classList.remove('press'); }
    if (e.pointerType === 'mouse' && IN.locked) { if (e.button === 0) IN.fire = false; else if (e.button === 2) ARM.ads = false; }
  };
  const onMouse = e => { if (IN.locked && playing()) look(e.movementX * .0023, e.movementY * .0023); };
  const onLock = () => { IN.locked = document.pointerLockElement === canvas; if (!IN.locked) { IN.fire = false; ARM.ads = false; if (!IN.releasing && playing()) pause(); } IN.releasing = false; };
  const onKey = e => {
    if (SP.open) { if (e.type === 'keydown') spellKey(e); return; }
    if (e.type === 'keyup') { IN.keys.delete(e.code); if (e.code === 'Space') IN.fire = false; return; }
    if (!playing() || e.metaKey || e.ctrlKey || e.altKey) return;
    IN.keys.add(e.code);
    if (e.code === 'KeyR') reload(); else if (e.code === 'KeyG') throwNade(); else if (e.code === 'KeyE' || e.code === 'KeyF') openSpell('supply');
    else if (e.code === 'KeyP' || e.code === 'Escape') pause(); else if (e.code === 'KeyQ') nextGun(1); else if (e.code === 'Space') IN.fire = true;
    else if (/^Digit[1-9]$/.test(e.code)) { const id = ARM.have[+e.code.slice(5) - 1]; if (id) equip(id); }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  };
  const onWheel = e => { if (playing() && !SP.open) { nextGun(e.deltaY > 0 ? 1 : -1); e.preventDefault(); } };
  const onTouch = e => { if (!e.target.closest('.ss-ov')) e.preventDefault(); };
  const noMenu = e => e.preventDefault();
  const onVis = () => { if (document.hidden && playing() && !SP.open) pause(); };
  function nextGun(s){ const i = ARM.have.indexOf(ARM.cur); equip(ARM.have[(i + s + ARM.have.length) % ARM.have.length]); }
  root.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
  document.addEventListener('mousemove', onMouse); document.addEventListener('pointerlockchange', onLock); window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
  root.addEventListener('wheel', onWheel, {passive: false}); root.addEventListener('touchmove', onTouch, {passive: false}); root.addEventListener('contextmenu', noMenu); document.addEventListener('visibilitychange', onVis);

  /* ---------- what is on the screen ---------- */
  const H = {hp: $('.ss-hp i'), hpBox: $('.ss-hp'), lives: $('.ss-lives'), nades: $('.ss-nades'), wave: $('.ss-wave'), sub: $('.ss-sub'), bossname: $('.ss-bossname'), bossbar: $('.ss-bossbar'), bossI: $('.ss-bossbar i'),
    gunname: $('.ss-gunname'), ammo: $('.ss-ammo'), score: $('.ss-score'), clock: $('.ss-clock'), cross: $('.ss-cross'), hit: $('.ss-hit'), pops: $('.ss-pops'), scope: $('.ss-scope'), nadeN: $('.ss-nade small'),
    spellBtn: $('.ss-spellbtn'), aimBtn: $('.ss-aim'), radar: $('.ss-radar').getContext('2d')};
  $$('.ss-hit i').forEach((el, i) => { el.style.transform = `rotate(${45 + i * 90}deg)`; });
  const crossI = $$('.ss-cross i');
  const shown = {};
  const put = (k, v, f) => { if (shown[k] !== v) { shown[k] = v; f(v); } };
  const pops = [], bars = Array.from({length: 8}, () => { const el = document.createElement('div'); el.className = 'ss-bar'; el.innerHTML = '<i></i>'; el.style.display = 'none'; H.pops.appendChild(el); return el; });
  function pop(x, y, z, text, big){ const el = document.createElement('div'); el.className = 'ss-pop' + (big ? ' big' : ''); el.textContent = text; H.pops.appendChild(el); pops.push({el, x, y, z, t: 0}); }
  let hitT = 0;
  function hitMark(kill){ hitT = kill ? .22 : .12; H.hit.classList.toggle('kill', !!kill); H.hit.style.opacity = 1; }
  function restart(el){ el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
  function banner(t, sub){ const b = $('.ss-banner'); b.innerHTML = esc(t) + (sub ? `<small>${esc(sub)}</small>` : ''); restart(b); }
  function toast(t, secs){ const b = $('.ss-toast'); b.textContent = t; b.style.animationDuration = (secs || 2.6) + 's'; restart(b); }
  function drawGunBar(){ $('.ss-guns').innerHTML = ARM.have.map(id => { const g = GUNS.find(x => x.id === id); return `<button class="ss-gunbtn ${id === ARM.cur ? 'on' : ''}" data-b="gun:${id}" aria-label="${esc(g.name)}">${gunIcon(g)}</button>`; }).join(''); }
  function showPlay(on){ hud.hidden = !on; ctl.hidden = !on; if (on) drawGunBar(); }
  const _p = new T.Vector3();
  function screenOf(x, y, z){ _p.set(x, y, z).project(cam); if (_p.z > 1 || _p.z < -1) return null; return [(_p.x + 1) / 2 * root.clientWidth, (1 - _p.y) / 2 * root.clientHeight]; }
  let radarT = 0;
  function drawHud(dt){
    if (hud.hidden) return;
    const g = gun(), a = ARM.ammo[g.id] || {mag: 0, res: 0};
    put('hp', Math.max(0, Math.round(P.hp)), v => { H.hp.style.width = v + '%'; H.hpBox.classList.toggle('low', v < 35); });
    put('lives', P.lives, v => { H.lives.textContent = v > 6 ? `❤️ × ${v}` : '❤️'.repeat(Math.max(0, v)); });
    put('nades', P.nades, v => { H.nades.textContent = `💣 ${v}`; H.nadeN.textContent = '×' + v; });
    const left = G.queue.length + bots.length + G.pending.length;
    put('wave', G.firstBreak ? 'GET READY' : isBossWave() && G.wave ? 'BOSS WAVE' : G.endless ? `WAVE ${G.wave}` : `WAVE ${G.wave} / ${PER_ZONE}`, v => { H.wave.textContent = v; });
    put('sub', G.mode === 'break' ? (G.firstBreak ? zoneDef().name : 'Wave cleared!') : `${left} robot${left === 1 ? '' : 's'} left`, v => { H.sub.textContent = v; });
    const boss = G.boss && !G.boss.dead ? G.boss : null;
    put('boss', boss ? boss.def.name : '', v => { H.bossname.hidden = H.bossbar.hidden = !v; H.bossname.textContent = v.toUpperCase(); });
    if (boss) put('bossHp', Math.round(boss.hp / boss.max * 200), v => { H.bossI.style.width = Math.max(0, v / 2) + '%'; });
    put('gun', g.name, v => { H.gunname.textContent = v; });
    put('ammo', `${a.mag}|${a.res}|${ARM.reload > 0}`, () => { H.ammo.innerHTML = ARM.reload > 0 ? '<small>RELOADING</small>' : `${a.mag}<small> / ${a.res === Infinity ? '∞' : a.res}</small>`; H.ammo.classList.toggle('empty', a.mag === 0 && ARM.reload <= 0); });
    put('score', G.score, v => { H.score.textContent = 'SCORE ' + num(v); });
    const ms = api.timeLeft ? api.timeLeft() : null;
    put('clock', ms == null ? (demo ? 'Demo' : '') : `${Math.max(1, Math.ceil(ms / 60000))} min left`, v => { H.clock.textContent = v; });
    // the crosshair opens up with spread, and turns red over a robot
    const spread = lerp(g.spread || 0, g.ads || 0, ARM.adsK) * (Math.hypot(P.vx, P.vz) > .8 ? 1.35 : 1), focal = root.clientHeight / 2 / Math.tan(cam.fov * Math.PI / 360);
    put('cross', Math.round(7 + Math.tan(spread) * focal), v => { crossI[0].style.cssText = `left:${v}px;top:-1px;width:10px;height:2px`; crossI[1].style.cssText = `left:${-v - 10}px;top:-1px;width:10px;height:2px`; crossI[2].style.cssText = `left:-1px;top:${v}px;width:2px;height:10px`; crossI[3].style.cssText = `left:-1px;top:${-v - 10}px;width:2px;height:10px`; });
    const d = aimDir(0); G.hot = playing() && trace(cam.position.x, cam.position.y, cam.position.z, d[0], d[1], d[2], g.range || 80).hits.length > 0;
    put('hot', G.hot, v => H.cross.classList.toggle('hot', v)); put('ads', ARM.adsK > .5, v => { H.cross.classList.toggle('ads', v); H.aimBtn.classList.toggle('on', v); });
    put('scope', !!(g.scope && ARM.adsK > .85), v => { H.scope.style.opacity = v ? 1 : 0; H.cross.style.visibility = v ? 'hidden' : ''; });
    const lowAmmo = want.spell || (a.res !== Infinity && a.res + a.mag < g.mag * .5) || (P.nades === 0 && G.mode === 'break');
    put('want', lowAmmo, v => H.spellBtn.classList.toggle('want', v));
    if (hitT > 0) { hitT -= dt; if (hitT <= 0) H.hit.style.opacity = 0; }
    for (const p of pops) { const s = screenOf(p.x, p.y + p.t * 1.3, p.z); if (!s) { p.el.style.display = 'none'; continue; } p.el.style.display = ''; p.el.style.left = s[0] + 'px'; p.el.style.top = s[1] + 'px'; p.el.style.opacity = clamp(1.4 - p.t * 1.3, 0, 1); }
    // health bars over hurt robots
    const hurtBots = bots.filter(r => r.hurtT > 0 && !r.boss && r.sc >= 1).sort((p, q) => Math.hypot(p.x - P.x, p.z - P.z) - Math.hypot(q.x - P.x, q.z - P.z));
    bars.forEach((el, i) => { const r = hurtBots[i]; if (!r) { el.style.display = 'none'; return; } r.hurtT -= dt / Math.max(1, hurtBots.length / 8); const s = screenOf(r.x, (r.y || 0) + (r.def.fly ? .9 : (r.def.eye || 1.5) + .55), r.z); if (!s) { el.style.display = 'none'; return; } el.style.display = ''; el.style.left = s[0] + 'px'; el.style.top = s[1] + 'px'; el.firstChild.style.width = clamp(r.hp / r.max * 100, 0, 100) + '%'; });
    radarT -= dt; if (radarT <= 0) { radarT = .06; drawRadar(); }
  }
  function drawRadar(){
    const c = H.radar, S = 236, R = 118, sc = R / 26;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, S, S); c.save();
    c.beginPath(); c.arc(R, R, R - 3, 0, 7); c.fillStyle = 'rgba(8,18,14,.6)'; c.fill(); c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke(); c.clip();
    c.translate(R, R); c.rotate(P.yaw); c.scale(sc, sc);
    c.fillStyle = 'rgba(190,210,200,.32)';
    for (const o of W.obs) if (o.h > 1.4 && Math.abs(o.x0 - P.x) < 40 && Math.abs(o.z0 - P.z) < 40) c.fillRect(o.x0 - P.x, o.z0 - P.z, o.x1 - o.x0, o.z1 - o.z0);
    for (const r of bots) { c.fillStyle = r.boss ? '#ff2e63' : r.def.fly ? '#ffd23f' : '#ff3b2f'; c.beginPath(); c.arc(r.x - P.x, r.z - P.z, r.boss ? 1.6 : .9, 0, 7); c.fill(); }
    for (const q of G.pending) { c.strokeStyle = '#3ff0ff'; c.lineWidth = .4; c.beginPath(); c.arc(q.x - P.x, q.z - P.z, 1, 0, 7); c.stroke(); }
    c.restore();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(R, R - 10); c.lineTo(R + 7, R + 8); c.lineTo(R, R + 4); c.lineTo(R - 7, R + 8); c.closePath(); c.fill();
  }
  function showBreak(first){
    hideBreak(); const el = document.createElement('div'); el.className = 'ss-break';
    el.innerHTML = `<div class="ss-breakt"></div><div class="ss-row">${first ? '' : '<button class="ss-ghost" data-a="bonus">📦 Bonus crate: spell a word</button>'}<button class="ss-ghost" data-a="nextwave">${first ? 'Start now ▶' : 'Next wave ▶'}</button></div>`;
    root.insertBefore(el, ovMenu);
  }
  function hideBreak(){ const el = $('.ss-break'); if (el) el.remove(); }

  /* ---------- the spelling: a word from his own list, built from letter tiles ---------- */
  const SP = {open: false};
  function pickWord(){
    if (spell && spell.word) { try { const o = spell.word(); if (o && o.w) return o; } catch (e) { console.warn('spell word', e); } }
    const w = pick(FALLBACK_WORDS); return {w, s: '', mode: 'tiles', tiles: shuffle(w.split(''))};
  }
  function say(parts){
    const w = SP.item && SP.item.w; if (!w) return;
    try { if (parts && spell && spell.parts) spell.parts(w); else if (spell && spell.say) spell.say(w); else if (window.speechSynthesis) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(w); u.lang = 'en-GB'; u.rate = .8; speechSynthesis.speak(u); } } catch {}
  }
  function openSpell(reason, need = 1){
    if (SP.open || (!playing() && reason !== 'continue')) return;
    Object.assign(SP, {open: true, reason, need, done: 0, prevMode: G.mode});
    G.mode = 'spell'; IN.fire = false; IN.joy = IN.look = IN.firePtr = null; IN.mx = IN.my = 0; IN.keys.clear(); joyHome(); fireBtn.classList.remove('press'); want.spell = false;
    releaseLock(); snd.duck(true); ovSpell.hidden = false; nextWord();
  }
  function nextWord(){
    const it = SP.item = pickWord();
    Object.assign(SP, {input: '', used: [], copy: it.mode === 'copy', fix: false, got1: null, won: null, msg: '', newGuns: [], tiles: it.tiles && it.tiles.length ? it.tiles.slice() : shuffle(it.w.toLowerCase().split(''))});
    drawSpell(); say();
  }
  // which letters match, lined up properly, so one missing letter is one mark
  function diff(got, w, side = 'got'){
    const a = got.toLowerCase(), b = w.toLowerCase(), L = Array.from({length: a.length + 1}, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const inA = new Set(), inB = new Set(); let i = 0, j = 0;
    while (i < a.length && j < b.length) { if (a[i] === b[j]) { inA.add(i); inB.add(j); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
    const src = side === 'got' ? a : b, keep = side === 'got' ? inA : inB;
    return src.split('').map((c, k) => keep.has(k) ? esc(c) : `<mark>${esc(c)}</mark>`).join('');
  }
  function streakLine(){
    if (SP.reason === 'continue') return `${SP.done} of ${SP.need} done`;
    const s = G.streak % 3; return G.streak ? `🔥 ${G.streak} right in a row! ${3 - s} more for an extra life.` : 'Get 3 right in a row for an extra life!';
  }
  function drawSpell(){
    const it = SP.item, w = it.w, head = SP.reason === 'continue' ? `KEEP GOING: WORD ${Math.min(SP.done + 1, SP.need)} OF ${SP.need}` : SP.reason === 'bonus' ? 'BONUS CRATE' : 'SUPPLY DROP';
    if (SP.won) {
      const g = SP.got || {}, chips = [g.packs ? `+${g.packs} ammo pack${g.packs > 1 ? 's' : ''}` : '', g.nades ? `+${g.nades} grenade` : '', g.heal ? 'Health full' : '', g.lives ? '+1 life ❤️' : ''].filter(Boolean);
      const more = SP.reason === 'continue' ? (SP.done < SP.need ? '<button class="ss-go" data-a="next">Next word ▶</button>' : '<button class="ss-go" data-a="close">Keep fighting ▶</button>')
        : '<button class="ss-go" data-a="close">Back to the fight ▶</button><button data-a="more">Spell another</button>';
      ovSpell.innerHTML = `<div class="ss-spell"><p class="eb">${head}</p><h2>${SP.won === 'right' ? '✓ Right! Crate open!' : '✓ Crate open!'}</h2><div class="word">${esc(w)}</div>
        ${chips.length ? `<div class="ss-reward">${chips.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : ''}
        ${SP.newGuns.length ? `<p class="ss-streak">NEW GUN UNLOCKED: ${esc(SP.newGuns.map(id => GUNS.find(x => x.id === id).name).join(', '))}!</p>` : ''}
        <p class="ss-streak">${esc(streakLine())}</p><div class="tools">${more}</div></div>`;
      return;
    }
    const show = SP.copy || SP.fix;
    const fb = SP.got1 ? `<div class="fb no">Nearly! You built <b>${diff(SP.got1, w)}</b>. It is <b>${diff(SP.got1, w, 'w')}</b>. Now build it.</div>` : SP.msg ? `<div class="fb no">${esc(SP.msg)}</div>` : SP.copy ? '<div class="fb">A new word! Build it.</div>' : '<div class="fb"></div>';
    ovSpell.innerHTML = `<div class="ss-spell"><p class="eb">${head}</p><h2>${show ? 'Build the word' : 'Spell the word to open the crate'}</h2>
      <div class="say"><button data-a="say">🔊 Hear it again</button>${it.syl && it.syl.includes('-') ? '<button data-a="parts">Say it in parts</button>' : ''}</div>
      ${show ? `<div class="word">${esc(w)}</div>` : ''}${show && it.hook ? `<p class="tip">Tip: ${esc(it.hook)}</p>` : ''}${fb}
      <div class="slots">${[...w].map((_, i) => `<span class="${i === SP.input.length ? 'next' : ''}">${esc(SP.input[i] || '')}</span>`).join('')}</div>
      <div class="tiles">${SP.tiles.map((c, i) => `<button class="tile" data-a="tile" data-i="${i}" ${SP.used.includes(i) ? 'disabled' : ''}>${esc(c)}</button>`).join('')}</div>
      <div class="tools"><button data-a="undo">⌫ Undo</button>${SP.reason === 'continue' ? '<button data-a="base">Back to base</button>' : '<button data-a="skip">Back to the fight</button>'}</div>
      <p class="prog">${esc(streakLine())}</p></div>`;
  }
  function tile(i){ if (SP.won || SP.used.includes(i)) return; SP.used.push(i); SP.input += SP.tiles[i]; SP.msg = ''; snd.play('click', .5); if (SP.input.length >= SP.item.w.length) spellCheck(); else drawSpell(); }
  function undo(){ if (SP.won || !SP.used.length) return; SP.used.pop(); SP.input = SP.input.slice(0, -1); drawSpell(); }
  function spellKey(e){
    if (SP.won) { if (e.key === 'Enter') { e.preventDefault(); const b = ovSpell.querySelector('.ss-go'); if (b) b.click(); } return; }
    if (/^[a-zA-Z'-]$/.test(e.key)) { const i = SP.tiles.findIndex((c, j) => c === e.key.toLowerCase() && !SP.used.includes(j)); if (i >= 0) tile(i); e.preventDefault(); }
    else if (e.key === 'Backspace') { undo(); e.preventDefault(); }
  }
  function spellCheck(){
    const it = SP.item, ok = SP.input.toLowerCase() === it.w.toLowerCase();
    if (SP.copy || SP.fix) { if (ok) win(SP.copy ? 'copy' : 'fixed'); else { snd.play('bad'); SP.input = ''; SP.used = []; SP.msg = 'Not quite. Copy it letter by letter.'; drawSpell(); } return; }
    try { if (spell && spell.result) spell.result(it.w, ok); else if (ok) save.words = (save.words || 0) + 1; } catch (e) { console.warn('spell result', e); }
    if (ok) { win('right'); return; }
    snd.play('bad'); G.streak = 0; SP.got1 = SP.input; SP.fix = true; SP.input = ''; SP.used = []; drawSpell(); say();
  }
  function win(how){
    SP.done++; SP.won = how;
    const g = SP.got = {packs: 0, nades: 0, lives: 0, heal: false};
    if (SP.reason !== 'continue') {
      g.packs = how === 'fixed' ? 1 : 2; g.nades = how === 'fixed' ? 0 : 1; g.heal = true;
      if (how === 'right') { G.streak++; if (G.streak % 3 === 0 && P.lives < 9) g.lives = 1; }
      addPacks(g.packs); P.nades = Math.min(6, P.nades + g.nades); P.hp = 100; P.lives += g.lives;
    }
    snd.play(g.lives ? 'life' : 'ok');
    const now = haveGuns(); SP.newGuns = now.filter(id => !ARM.have.includes(id));
    if (SP.newGuns.length) { ARM.have = now; snd.play('unlock'); drawGunBar(); }
    drawSpell();
  }
  function closeSpell(back){
    if (!SP.open) return; SP.open = false; ovSpell.hidden = true; ovSpell.innerHTML = ''; snd.duck(false); try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch {}
    if (SP.reason === 'continue') { if (!back && SP.done >= SP.need) keepGoing(); else { G.mode = 'over'; menu(back ? 'lobby' : 'over'); } return; }
    G.mode = SP.prevMode;
    if (SP.done) { dropCrate(); const ng = SP.newGuns || []; if (ng.length) { const g = GUNS.find(x => x.id === ng[ng.length - 1]); banner('NEW GUN!', g.name); equip(g.id); } else if (SP.got && SP.got.lives) toast('+1 LIFE!'); }
  }
  function keepGoing(){
    P.lives = 3; closeMenu(); showPlay(true); respawn(); G.mode = 'play'; snd.music(true, {boss: isBossWave()});
    for (const r of bots) if (Math.hypot(r.x - P.x, r.z - P.z) < 8 && !r.boss) { const s = pick(W.spawns); r.x = s.x; r.z = s.z; }
    banner('KEEP GOING!', `Wave ${G.wave}`);
  }
  const crateMesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({map: TX.crate})); crateMesh.visible = false; scene.add(crateMesh);
  let crate = null;
  function dropCrate(){ const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let x = P.x + fx * 2.4, z = P.z + fz * 2.4; if (W.nav.g[cell(x, z)]) { x = P.x + fx * .8; z = P.z + fz * .8; } crate = {x, z, y: 10, vy: 0, t: 0}; crateMesh.visible = true; }
  function updateCrate(dt){
    if (!crate) return; crate.vy -= 22 * dt; crate.y = Math.max(.5, crate.y + crate.vy * dt);
    if (crate.y <= .5) { if (!crate.landed) { crate.landed = true; spark(crate.x, .6, crate.z, 30, 0x7dffb0, 5, .6); snd.play('pickup'); pop(crate.x, 1.4, crate.z, '+AMMO'); } crate.t += dt; if (crate.t > 1.1) { crateMesh.visible = false; crate = null; return; } crateMesh.scale.setScalar(Math.max(.01, 1 - Math.max(0, crate.t - .7) / .4)); } else crateMesh.scale.setScalar(1);
    crateMesh.position.set(crate.x, crate.y, crate.z); crateMesh.rotation.y += dt * 1.5;
  }

  /* ---------- menus ---------- */
  function clearRun(){
    for (const r of bots) { scene.remove(r.mesh.root); scene.remove(r.blob); } bots.length = 0; bolts.length = 0; G.pending.length = 0; G.queue = []; G.boss = null;
    for (const n of nades) scene.remove(n.m); nades.length = 0; for (const b of beams) { b.m.visible = false; b.keep = false; } for (const o of rings) o.m.visible = false;
    for (const p of debris) scene.remove(p.o); debris.length = 0; hideBreak();
  }
  function clearLobbyBots(){ for (const o of lobbyBots) scene.remove(o.m.root); lobbyBots.length = 0; }
  function freeNear(x, z, grid){ for (let r = 0; r < 12; r++) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (!grid[cell(px, pz)]) return [px, pz]; } return [x, z]; }
  function prepLobby(){
    clearRun(); snd.music(false);
    const zi = G.sel > ENDLESS ? (W ? W.zone : 0) : G.sel - 1;
    if (!W || W.zone !== zi) buildZone(zi);
    clearLobbyBots();
    const Z = ZONES[zi], kinds = Object.keys(Z.mix), types = [kinds[kinds.length - 1], kinds[Math.max(0, kinds.length - 2)], Z.boss];
    types.forEach((t, i) => { const m = robotMesh(t), big = !!BOSSES[t], [x, z] = freeNear([-3.5, 3.5, 0][i], [2.5, 2.5, -4][i], big ? W.nav.b : W.nav.g); m.root.position.set(x, (BOTS[t] || BOSSES[t]).fly || 0, z); scene.add(m.root); lobbyBots.push({m, t, base: m.root.position.y}); });
  }
  function menu(kind){
    G.menu = kind;
    if (kind === 'lobby') { G.mode = 'menu'; showPlay(false); prepLobby(); }
    if (kind === 'over' || kind === 'won') { showPlay(false); if (kind === 'over') G.newBest = recordBest(); persist(); }
    releaseLock(); ovMenu.hidden = false; ovMenu.innerHTML = MENUS[kind](); ovMenu.scrollTop = 0;
  }
  function closeMenu(){ ovMenu.hidden = true; ovMenu.innerHTML = ''; }
  function pause(){ if (!playing()) return; G.prev = G.mode; G.mode = 'pause'; IN.fire = false; IN.joy = IN.look = IN.firePtr = null; IN.mx = IN.my = 0; IN.keys.clear(); joyHome(); menu('pause'); }
  function resume(){ G.mode = G.prev || 'play'; closeMenu(); }
  const mins = ms => `${Math.floor(ms / 60)}:${String(Math.floor(ms % 60)).padStart(2, '0')}`;
  const MENUS = {
    lobby: () => {
      const total = wordsTotal(), have = haveGuns(), next = GUNS.find(g => g.words > total), prev = [...GUNS].reverse().find(g => g.words <= total) || GUNS[0];
      const pct = next ? clamp((total - prev.words) / (next.words - prev.words), 0, 1) * 100 : 100;
      const week = demo ? 30 : spell && spell.week ? spell.week() : 0, wp = Math.min(6, Math.floor(week / 5)), wl = Math.min(3, Math.floor(week / 10));
      const card = (n, name, sub, cols, lock, label) => `<button class="ss-zone ${G.sel === n ? 'on' : ''} ${lock ? 'lock' : ''}" data-a="zone" data-z="${n}" style="--z1:${cols[0]};--z2:${cols[1]}"><span class="n">${label}</span><b>${esc(name)}</b><span>${esc(sub)}</span></button>`;
      const zones = ZONES.map((Z, i) => { const n = i + 1, b = save.best['z' + n]; return card(n, Z.name, n > save.zone ? `Clear zone ${n - 1} to unlock` : b && b.score ? `Best ${num(b.score)}` : `Boss: ${BOSSES[Z.boss].name}`, Z.card, n > save.zone, n); }).join('')
        + card(ENDLESS + 1, 'Endless Attack', save.zone <= ENDLESS ? 'Clear all 6 zones to unlock' : save.best.endless ? `Best: wave ${save.best.endless.wave}` : 'Every robot. Every boss.', ['#ff2e63', '#2a0a14'], save.zone <= ENDLESS, '∞');
      const sel = G.sel > ENDLESS ? null : ZONES[G.sel - 1];
      const foes = sel ? Object.keys(sel.mix).map(k => `<span class="${save.seen.includes(k) ? '' : 'new'}">${esc(BOTS[k].name)}</span>`).join('') + `<span class="new">Boss: ${esc(BOSSES[sel.boss].name)}</span>` : '<span class="new">Every bad guy and every boss</span>';
      const guns = GUNS.map(g => { const ok = have.includes(g.id); return `<div class="ss-gun ${ok ? '' : 'lock'} ${next && g.id === next.id ? 'next' : ''}">${gunIcon(g, ok ? '#fff' : '#8a9496')}<b>${esc(g.name)}</b><small>${ok ? 'Unlocked' : `${g.words} words`}</small></div>`; }).join('');
      const ms = api.timeLeft ? api.timeLeft() : null, left = next ? next.words - total : 0;
      return `<div class="ss-panel"><h1 class="ss-title">SPELL STRIKE</h1><p class="ss-tag">Robots have invaded! Spell words to power up.${demo ? ' <span class="ss-small">(Grown-ups demo: everything unlocked.)</span>' : ''}</p>
        <div class="ss-cols"><div class="ss-card"><h3>Choose a zone</h3><div class="ss-zones">${zones}</div><div class="ss-foes">${foes}</div></div>
          <div class="ss-card"><h3>Your guns</h3><div class="ss-arsenal">${guns}</div><div class="ss-meter"><i style="width:${pct.toFixed(1)}%"></i></div>
            <p class="ss-note">${next ? `Spell ${left} more word${left === 1 ? '' : 's'} right to unlock the ${esc(next.name)}.` : 'Every gun unlocked!'} <span class="ss-small">(${num(Math.min(total, 9999))} so far)</span></p>
            <div class="ss-week">This week: ${week} word${week === 1 ? '' : 's'} spelled right = +${wp} ammo pack${wp === 1 ? '' : 's'} and +${wl} ${wl === 1 ? 'life' : 'lives'} at the start.</div></div></div>
        <div class="ss-row"><button class="ss-go" data-a="play">PLAY ▶</button><button class="ss-ghost" data-a="help">How to play</button><button class="ss-ghost" data-a="exit">Finish for now</button>
          ${ms != null ? `<span class="ss-small">${Math.max(1, Math.ceil(ms / 60000))} min of play left</span>` : ''}${save.kills ? `<span class="ss-small">Robots destroyed: ${num(save.kills)}</span>` : ''}</div></div>`;
    },
    help: () => `<div class="ss-panel"><h1 class="ss-title" style="font-size:clamp(34px,6vw,54px)">HOW TO PLAY</h1><div class="ss-help">
      <div><b>Move</b>Left thumb, anywhere on the left.</div><div><b>Look and aim</b>Drag on the right. Hold FIRE and drag to aim while you shoot.</div>
      <div><b>📦 Spell for ammo</b>Tap SPELL. Spell the word right: 2 ammo packs, a grenade and full health.</div><div><b>❤️ Extra lives</b>Spell 3 words right in a row.</div>
      <div><b>New guns</b>Every word you spell right, here or in your spelling, unlocks the next gun.</div><div><b>Bosses</b>Red ring or red laser? Get out of the way!</div>
      <div><b>Keyboard</b>WASD move, mouse look, click fire, right-click aim, R reload, G grenade, E spell, Q swap gun.</div></div>
      <div class="ss-row"><button class="ss-go" data-a="back">Back</button></div></div>`,
    pause: () => `<div class="ss-panel" style="max-width:440px;text-align:center"><h1 class="ss-title" style="font-size:52px">PAUSED</h1>
      <div class="ss-row" style="flex-direction:column;align-items:stretch"><button class="ss-go" data-a="resume">Resume ▶</button><button class="ss-ghost" data-a="help">How to play</button>
      <button class="ss-ghost" data-a="sound">Sound: ${snd.on ? 'on' : 'off'}</button><button class="ss-ghost" data-a="base">Back to base</button><button class="ss-ghost" data-a="exit">Finish for now</button></div></div>`,
    won: () => { const b = save.best[G.endless ? 'endless' : 'z' + G.zone] || {}, nz = G.unlockedZone;
      return `<div class="ss-panel" style="text-align:center"><h1 class="ss-title">ZONE CLEARED!</h1><p class="ss-tag">${esc(zoneDef().name)}</p>
        <div class="ss-card" style="max-width:520px;margin:0 auto">${G.newBest ? '<p class="ss-best" style="font-size:22px">NEW BEST SCORE!</p>' : ''}
          <p class="ss-note">Score <b>${num(G.score)}</b> · Best ${num(b.score || G.score)}</p><p class="ss-note">Robots destroyed: ${G.kills} · Time: ${mins(G.time - G.runStart)}</p>
          ${nz ? `<p class="ss-best">${nz > ENDLESS ? 'Endless Attack unlocked!' : `Zone ${nz} unlocked: ${esc(ZONES[nz - 1].name)}!`}</p>` : ''}</div>
        <div class="ss-row" style="justify-content:center">${G.zone < ENDLESS ? '<button class="ss-go" data-a="next-zone">Next zone ▶</button>' : '<button class="ss-go" data-a="endless">Endless Attack ▶</button>'}<button class="ss-ghost" data-a="base">Back to base</button></div></div>`; },
    over: () => { const b = save.best[G.endless ? 'endless' : 'z' + G.zone] || {};
      return `<div class="ss-panel" style="text-align:center"><h1 class="ss-title">KNOCKED OUT!</h1><p class="ss-tag">You reached wave ${G.wave}${G.endless ? '' : ' of ' + PER_ZONE}.</p>
        <div class="ss-card" style="max-width:520px;margin:0 auto">${G.newBest ? '<p class="ss-best" style="font-size:22px">NEW BEST SCORE!</p>' : ''}<p class="ss-note">Score <b>${num(G.score)}</b> · Best ${num(b.score || G.score)}</p><p class="ss-note">Robots destroyed: ${G.kills}</p></div>
        <div class="ss-row" style="justify-content:center"><button class="ss-go" data-a="continue">📦 Spell 3 words to keep going</button><button class="ss-ghost" data-a="again">Start the zone again</button><button class="ss-ghost" data-a="base">Back to base</button></div></div>`; },
  };
  const onClick = e => {
    const sb = e.target.closest('[data-b="spell"]'); if (sb) { if (playing()) openSpell('supply'); return; }
    const b = e.target.closest('[data-a]'); if (!b || !root.contains(b)) return;
    switch (b.dataset.a) {
      case 'play': snd.play('click'); closeMenu(); startZone(G.sel); break;
      case 'zone': { const z = +b.dataset.z; if (z <= save.zone) { G.sel = z; menu('lobby'); } else snd.play('empty'); break; }
      case 'help': G.helpFrom = G.menu; menu('help'); break;
      case 'back': if (G.helpFrom === 'pause') menu('pause'); else menu('lobby'); break;
      case 'exit': persist(); if (api.exit) api.exit(); break;
      case 'resume': resume(); break;
      case 'sound': snd.setOn(!snd.on); if (snd.on) snd.music(true); menu('pause'); break;
      case 'base': if (SP.open) closeSpell(true); else menu('lobby'); break;
      case 'next-zone': G.sel = Math.min(G.zone + 1, save.zone); closeMenu(); startZone(G.sel); break;
      case 'endless': G.sel = ENDLESS + 1; closeMenu(); startZone(G.sel); break;
      case 'again': closeMenu(); startZone(G.zone); break;
      case 'continue': closeMenu(); openSpell('continue', 3); break;
      case 'say': say(); break;
      case 'parts': say(true); break;
      case 'tile': tile(+b.dataset.i); break;
      case 'undo': undo(); break;
      case 'skip': case 'close': closeSpell(); break;
      case 'more': if (SP.open) nextWord(); break;
      case 'next': nextWord(); break;
      case 'bonus': openSpell('bonus'); break;
      case 'nextwave': G.breakT = 0; break;
      case 'turn-ok': G.turnOk = true; turnCheck(); break;
    }
  };
  root.addEventListener('click', onClick);

  /* ---------- size, drawing and the loop ---------- */
  let baseV = 62;
  const touchDev = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  function turnCheck(){ const show = touchDev && !G.turnOk && root.clientHeight > root.clientWidth * 1.05; $('.ss-turn').style.display = show ? 'grid' : 'none'; if (show) pause(); }
  function resize(){
    const w = root.clientWidth || innerWidth, h = root.clientHeight || innerHeight; renderer.setSize(w, h, false);
    cam.aspect = gunCam.aspect = w / h; baseV = clamp(2 * Math.atan(Math.tan(78 * Math.PI / 360) / cam.aspect) * 180 / Math.PI, 50, 80);
    cam.fov = baseV; cam.updateProjectionMatrix(); gunCam.fov = clamp(baseV, 55, 72); gunCam.updateProjectionMatrix(); turnCheck();
  }
  window.addEventListener('resize', resize);
  renderer.autoClear = false;
  function setCamera(dt){
    if (G.mode === 'menu') {
      const t = G.time * .1 + .6; cam.position.set(Math.sin(t) * 17, 6.5, Math.cos(t) * 17); cam.lookAt(0, 1.8, 0);
      for (const o of lobbyBots) { o.m.root.rotation.y = Math.atan2(cam.position.x - o.m.root.position.x, cam.position.z - o.m.root.position.z); o.m.root.position.y = o.base + (BOSSES[o.t] && BOSSES[o.t].fly ? Math.sin(G.time) * .3 : 0);
        for (const n of ['rA', 'rB', 'rC', 'rD', 'ring']) if (o.m.bones[n]) o.m.bones[n].rotation.y += dt * (n === 'ring' ? 1.5 : 30); if (o.m.bones.sawL) { o.m.bones.sawL.rotation.x += dt * 12; o.m.bones.sawR.rotation.x += dt * 12; } }
      return;
    }
    const g = gun(), deadK = P.dead > 0 ? clamp(1 - P.dead / 2.4, 0, 1) * 1.6 : 0, mv = clamp(Math.hypot(P.vx, P.vz) / 4.6, 0, 1);
    cam.position.set(P.x, 1.6 - Math.min(1.1, deadK) + Math.sin(P.bob * 2) * .035 * mv, P.z);
    const sh = shake * shake * .07; cam.rotation.set(P.pitch + rnd(-sh, sh), P.yaw + rnd(-sh, sh), Math.min(.5, deadK * .4));
    const target = baseV * lerp(1, g.zoom, ARM.adsK); if (Math.abs(cam.fov - target) > .05) { cam.fov = lerp(cam.fov, target, Math.min(1, dt * 14)); cam.updateProjectionMatrix(); }
    const k = ARM.adsK, m2 = mv * (1 - k * .8), rel = ARM.reload > 0 ? Math.sin((1 - ARM.reload / ARM.rmax) * Math.PI) : 0, sw = ARM.swap > 0 ? ARM.swap / .35 : 0;
    held.position.set(lerp(.22, 0, k) + Math.sin(P.bob) * .012 * m2, lerp(-.22, -g.sight, k) - Math.abs(Math.cos(P.bob)) * .012 * m2 - rel * .12 - sw * .3, lerp(-.42, -.32, k) + ARM.kick * .045);
    held.rotation.set(ARM.kick * .07 - rel * .6, lerp(.05, 0, k), lerp(-.04, 0, k) + rel * .3);
    held.visible = !(g.scope && k > .85);
    gunHemi.color.copy(hemi.color); gunHemi.groundColor.copy(hemi.groundColor); gunHemi.intensity = Math.max(.7, hemi.intensity);
  }
  let raf = 0, lastT = 0, gone = false, frames = 0, ft = 0, prT = 0;
  function loop(now){
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, lastT ? (now - lastT) / 1000 : .016); lastT = now;
    try {
      if (G.mode !== 'pause' && G.mode !== 'spell') { for (let i = 0; i < (api.debug && G.speed || 1); i++) { if (i) { setCamera(dt); if (G.auto) G.auto(); } update(dt); } } else updateFx(dt, false);
      updateCrate(dt);
      setCamera(dt);
      renderer.clear(); renderer.render(scene, cam);
      if (G.mode !== 'menu' && hud.hidden === false && P.dead <= 0 && held.visible) { renderer.clearDepth(); renderer.render(gunScene, gunCam); }
      drawHud(dt);
    } catch (err) { console.error('Spell Strike', err); }
    ft += dt; frames++;
    if (ft > 2) { const avg = ft / frames; if (avg > .027 && pr > .75) { pr = Math.max(.75, pr - .25); renderer.setPixelRatio(pr); resize(); prT = G.time; } else if (avg < .0175 && pr < PR_MAX && G.time - prT > 8) { pr = Math.min(PR_MAX, pr + .25); renderer.setPixelRatio(pr); resize(); prT = G.time; } ft = 0; frames = 0; }
  }
  resize(); menu('lobby'); raf = requestAnimationFrame(loop);

  function destroy(){
    if (gone) return; gone = true; cancelAnimationFrame(raf);
    root.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
    document.removeEventListener('mousemove', onMouse); document.removeEventListener('pointerlockchange', onLock); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
    document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', resize);
    try { if (document.pointerLockElement === canvas) document.exitPointerLock(); } catch {}
    snd.stop(); try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch {}
    persist();
    try { renderer.dispose(); renderer.forceContextLoss(); } catch {}
    root.remove();
  }
  const out = {destroy};
  if (api.debug) out._t = {G, P, ARM, bots, bolts, save, SP, get W(){ return W; }, startZone, startWave, openSpell, closeSpell, menu, update, updateFx, addBot, spawnFrom, equip, hitBot, gun, tile, spellCheck, render: () => { setCamera(.016); renderer.clear(); renderer.render(scene, cam); renderer.clearDepth(); renderer.render(gunScene, gunCam); drawHud(.016); }, renderer, cam, IN, clear, pr: () => pr,
    sim: (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) { setCamera(dt); if (G.auto) G.auto(); if (G.mode !== 'pause' && G.mode !== 'spell') update(dt); updateCrate(dt); } }};
  return out;
}
window.TTCGames = Object.assign(window.TTCGames || {}, {strike});
})();
