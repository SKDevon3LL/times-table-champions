// The weekly report for the 52-week challenge (Sam, 24 Oct 2026). Run by pg_cron every Sunday evening.
// 1. Reads each child's week from the docs table (sessions, trophies, facts, school year, last week's plan).
// 2. Asks Claude for next week's plan for each child, a step harder when they met this week's targets, and the email words.
// 3. Writes plans/<id> for next week (the app reads it), keeps reports/w<week>, and emails the grown-ups through Resend.
// The numbers in the email are counted here, never by the model; the model writes the words and proposes the plan,
// which is then held to the school year's question types and to sensible limits.
// POST with x-weekly-key (the vault key). ?dry=1 builds everything and returns it without writing or sending;
// ?to=a@b.c sends only to that address and writes nothing.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const APP = "https://kirkwoodfamilytimestablechampionsapp.com/";
const FROM = "Kirkwood Family Times Table Champions <coach@kirkwoodfamilytimestablechampionsapp.com>";
const DEFAULT_TO = ["sam@myfirstjobinfilm.com", "abbey@myfirstjobinfilm.com"];
const START = Date.UTC(2026, 9, 19);   // Monday 19 October 2026, week 1
const YEAR_KINDS: Record<number, string[]> = {3: [], 4: ["miss"], 5: ["miss", "div"], 6: ["miss", "div", "scale"], 7: ["miss", "div", "scale", "scale100"], 8: ["miss", "div", "scale", "scale100"]};
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const fkey = (a: number, b: number) => a < b ? `${a}x${b}` : `${b}x${a}`;

// London calendar: the week runs Monday to Sunday on UK clocks.
function londonParts(t: number) {
  const f = new Intl.DateTimeFormat("en-GB", {timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", timeZoneName: "shortOffset"});
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map(x => [x.type, x.value]));
  const off = /GMT([+-]\d+)?/.exec(p.timeZoneName)?.[1];
  return {y: +p.year, m: +p.month - 1, d: +p.day, dow: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday), off: off ? +off : 0};
}
function weekInfo(now: number) {
  const lp = londonParts(now);
  const mondayUtc = Date.UTC(lp.y, lp.m, lp.d - lp.dow);
  const week = Math.round((mondayUtc - START) / (7 * 864e5)) + 1;
  return {week, start: mondayUtc - lp.off * 3600e3};
}
function level(f: any) {
  if (!f || !f.n) return 0;
  const acc = f.c / f.n;
  if (f.s >= 5 && f.ms && f.ms <= 3000 && acc >= .85) return 4;
  if (f.s >= 3 && f.ms && f.ms <= 5000) return 3;
  if (acc >= .6) return 2;
  return 1;
}
const strongCount = (facts: any, t: number) => ALL.filter(k => level(facts[fkey(t, k)]) >= 3).length;
const yearOf = (pl: any) => pl.year || Math.min(8, Math.max(3, (pl.age || 9) - 4));

function weekStats(pl: any, prog: any, sessions: any[], plan: any, start: number) {
  const wk = sessions.filter(s => s.t >= start);
  const q = wk.reduce((s, x) => s + (x.n || 0), 0), c = wk.reduce((s, x) => s + (x.c || 0), 0);
  const days = new Set(wk.map(s => new Date(s.t + 3600e3).toISOString().slice(0, 10))).size;
  const tests = wk.filter(s => s.mode === "test" && !s.ab).map(s => ({pct: s.pct, tables: s.tables}));
  const trophies = (prog.prizeLog || []).filter((x: any) => x.t >= start);
  const facts = prog.facts || {};
  const tried = Object.entries(facts).filter(([, f]: any) => f.n >= 2);
  const weakest = tried.map(([k, f]: any) => ({k, acc: Math.round(f.c / f.n * 100), sec: Math.round((f.ms || 0) / 100) / 10}))
    .sort((a, b) => a.acc - b.acc || b.sec - a.sec).slice(0, 6);
  const tables = ALL.map(t => ({t, strong: strongCount(facts, t)}));
  const mastered = Object.values(facts).filter((f: any) => level(f) >= 3).length;
  return {
    name: pl.name, age: pl.age, year: yearOf(pl), sessions: wk.length, questions: q, accuracy: q ? Math.round(c / q * 100) : null, days,
    dailyDone: new Set(wk.filter(s => s.mode === "daily" && s.pct >= 80).map(s => new Date(s.t + 3600e3).toISOString().slice(0, 10))).size,
    tests, trophies: trophies.length, trailDone: trophies.length >= 7,
    gameMinutes: prog.gameTrail >= start ? Math.round((prog.gameMs || 0) / 60000) : 0,
    bonusRounds: Object.values(prog.bonus || {}).filter((v: any) => v.done >= start).length,
    mastered, of: 78, tables, weakest,
    lastPlan: plan ? {focus: plan.focus, questions: plan.questions, days: plan.days, mix: plan.mix} : null,
    metTargets: plan ? q >= (plan.questions || 0) && days >= (plan.days || 0) : null,
    game: prog.game || {},
  };
}

const PLAN_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["subject", "intro", "children", "signoff"],
  properties: {
    subject: {type: "string"},
    intro: {type: "string"},
    signoff: {type: "string"},
    children: {type: "array", items: {
      type: "object", additionalProperties: false,
      required: ["id", "headline", "summary", "wins", "watch", "tutor", "plan"],
      properties: {
        id: {type: "string"}, headline: {type: "string"}, summary: {type: "string"},
        wins: {type: "array", items: {type: "string"}}, watch: {type: "array", items: {type: "string"}}, tutor: {type: "array", items: {type: "string"}},
        plan: {type: "object", additionalProperties: false, required: ["focus", "mix", "questions", "days", "note", "why"], properties: {
          focus: {type: "array", items: {type: "integer"}},
          mix: {type: "object", additionalProperties: false, required: ["miss", "div", "scale", "scale100"], properties: {miss: {type: "boolean"}, div: {type: "boolean"}, scale: {type: "boolean"}, scale100: {type: "boolean"}}},
          questions: {type: "integer"}, days: {type: "integer"}, note: {type: "string"}, why: {type: "string"},
        }},
      },
    }},
  },
};

const SYSTEM = `You are Taylor, the children's Times Table Coach, for a family's 52-week times-tables challenge in the UK. Two children, Hughie (about 9) and Jessica (about 11), use an iPad app: each day the Daily Challenge on their trickiest facts is today's work, then the Bonus Round, Beat the Clock, Explore and a test in that order, for double points; Practise and Tests (Bronze 70%, Silver 80%, Gold 90%, Diamond 100%) are always open. Seven trophies in a week complete their weekly trail and unlock 30 minutes of a reward game (Hughie: a jungle gold run; Jessica: a stadium show where she can win an MTV Award).

Each Sunday you read each child's week and do two things.

1. Set next week's plan, matched to what they actually did. Make it a step harder when they met this week's targets with good accuracy (85% or more): more questions, the next table that is not yet strong, or the next question type their school year allows. Hold it, or ease it slightly, when they missed the targets, so the challenge stays reachable. Over 52 weeks every table should become strong and quick (the national Multiplication Tables Check allows 6 seconds a question). Focus on two or three tables at most. Question types: miss = missing numbers (6 × ? = 42), div = division, scale = ×10 facts (70 × 8), scale100 = ×100 facts; only use the ones their school year allows (given). questions = the week's question target (100 to 600), days = days to play (3 to 7).
The note is for the child: one or two short, encouraging sentences, no more than 25 words. The why is one sentence for the grown-ups.

2. Write the weekly email to the grown-ups it is going to, who are named in the message: Sam and Abbey are the parents; Hayley is the children's maths tutor and is only among them when named. Greet only the people it goes to. Write as Taylor in the first person: the intro opens as Taylor, your Times Table Coach, and the signoff is signed "Taylor, your Times Table Coach". British English. Warm, plain and specific; use the numbers given, never invent any. The summary is three to five sentences per child. Wins and watch are short points (up to three each). Tutor is one to three concrete suggestions Hayley could use in a session, such as a method or a game for a specific fact. No markdown, no dashes as punctuation.`;

function clampPlan(p: any, year: number, prev: any, stats: any) {
  const allowed = YEAR_KINDS[year] || [];
  const focus = [...new Set((p.focus || []).filter((t: number) => ALL.includes(t)))].slice(0, 3) as number[];
  let questions = Math.max(100, Math.min(600, Math.round(p.questions || 150)));
  let days = Math.max(3, Math.min(7, Math.round(p.days || 5)));
  if (prev && prev.questions) {   // never more than a quarter harder in one week, and never harder after a missed week
    const cap = stats.metTargets ? Math.round(prev.questions * 1.25) : prev.questions;
    questions = Math.min(questions, cap);
    if (!stats.metTargets) days = Math.min(days, prev.days || days);
  }
  const mix: any = {};
  for (const k of ["miss", "div", "scale", "scale100"]) mix[k] = allowed.includes(k) && !!(p.mix || {})[k];
  return {focus, mix, questions, days, note: String(p.note || "").slice(0, 200), why: String(p.why || "").slice(0, 300)};
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]!));
function emailHtml(week: number, ai: any, rows: any[]) {
  const li = (a: string[]) => a.length ? `<ul style="margin:6px 0 0;padding-left:20px">${a.map(x => `<li style="margin:3px 0">${esc(x)}</li>`).join("")}</ul>` : "";
  const kids = rows.map(({id, stats, plan}) => {
    const c = (ai.children || []).find((x: any) => x.id === id) || {};
    const strong = stats.tables.filter((t: any) => t.strong === 12).map((t: any) => t.t);
    const facts = [["Played", `${stats.days} day${stats.days === 1 ? "" : "s"}, ${stats.sessions} activities`], ["Questions", `${stats.questions}${stats.accuracy !== null ? `, ${stats.accuracy}% right` : ""}`],
      ["Daily Challenges done", stats.dailyDone], ["Bonus Rounds done", stats.bonusRounds], ["Trophies this week", `${stats.trophies} of 7${stats.trailDone ? " (trail complete)" : ""}`],
      ["Tests", stats.tests.length ? stats.tests.map((t: any) => t.pct + "%").join(", ") : "none"], ["Facts strong", `${stats.mastered} of 78`],
      ["Tables fully strong", strong.length ? strong.map((t: number) => "×" + t).join(" ") : "none yet"], ["School year", `Year ${stats.year}`]];
    return `<div style="border:2px solid #1B2140;border-radius:14px;padding:16px 18px;margin:18px 0;background:#FFFFFF">
      <h2 style="margin:0 0 4px;font-size:20px">${esc(stats.name)}</h2><p style="margin:0 0 10px;font-weight:700">${esc(c.headline)}</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">${facts.map(([k, v]) => `<tr><td style="padding:4px 8px 4px 0;color:#555">${esc(k)}</td><td style="padding:4px 0;font-weight:700">${esc(v)}</td></tr>`).join("")}</table>
      <p style="margin:12px 0 0">${esc(c.summary)}</p>
      ${(c.wins || []).length ? `<p style="margin:12px 0 0;font-weight:700">Going well</p>${li(c.wins)}` : ""}
      ${(c.watch || []).length ? `<p style="margin:12px 0 0;font-weight:700">To watch</p>${li(c.watch)}` : ""}
      ${(c.tutor || []).length ? `<p style="margin:12px 0 0;font-weight:700">Ideas for Hayley's sessions</p>${li(c.tutor)}` : ""}
      <div style="margin-top:14px;padding:10px 12px;border-radius:10px;background:#FFF4CC"><b>Next week's plan.</b> ${plan.focus.length ? `Focus on the ${plan.focus.join("s, ")}s. ` : ""}${plan.questions} questions over ${plan.days} days. ${esc(plan.why)}<br><i>${esc(stats.name)} will see: "${esc(plan.note)}"</i></div>
    </div>`;
  }).join("");
  return `<!doctype html><html><body style="margin:0;background:#F4F1EA;font-family:Helvetica,Arial,sans-serif;color:#1B2140">
    <div style="max-width:620px;margin:0 auto;padding:20px 16px">
      <p style="margin:0;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#555">Kirkwood Family Times Table Champions · Week ${week} of 52</p>
      <p style="margin:12px 0 0;font-size:16px;line-height:1.5">${esc(ai.intro)}</p>${kids}
      <p style="font-size:16px;line-height:1.5">${esc(ai.signoff)}</p>
      <p style="font-size:13px;color:#555">The full reports are in the Grown-ups area of the app: <a href="${APP}">${APP}</a></p>
    </div></body></html>`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url), dry = url.searchParams.get("dry") === "1", to = url.searchParams.get("to");
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {auth: {persistSession: false}});
  const {data: ok} = await db.rpc("weekly_report_key_ok", {p_key: req.headers.get("x-weekly-key") || ""});
  if (ok !== true) return new Response("not allowed", {status: 401});

  const {week, start} = weekInfo(Date.now());
  const {data: docs, error} = await db.from("docs").select("path,data").or("path.like.players/*,path.like.progress/*,path.like.logs/*,path.like.plans/*,path.like.methods/*,path.eq.settings/report");
  if (error) return new Response("read failed: " + error.message, {status: 500});
  const by = (pre: string) => docs!.filter(d => d.path.startsWith(pre)).map(d => ({id: d.path.slice(pre.length), ...d.data}));
  const players = by("players/"), progress = Object.fromEntries(by("progress/").map(p => [p.id, p])), plans = Object.fromEntries(by("plans/").map(p => [p.id, p]));
  const methods = by("methods/").filter((m: any) => m.status === "approved").map((m: any) => m.id);
  const rows = players.map((pl: any) => {
    const sessions = by("logs/").filter((l: any) => l.player === pl.id).flatMap((l: any) => l.sessions || []);
    const plan = plans[pl.id] && plans[pl.id].week === week ? plans[pl.id] : null;
    return {id: pl.id, pl, stats: weekStats(pl, progress[pl.id] || {}, sessions, plan, start), prevPlan: plan};
  });

  const settings = docs!.find(d => d.path === "settings/report")?.data || {};
  const recipients: string[] = to ? [to] : (settings.to && settings.to.length ? settings.to : DEFAULT_TO);
  const NAMES: Record<string, string> = {"sam@myfirstjobinfilm.com": "Sam", "abbey@myfirstjobinfilm.com": "Abbey", "hayleybac@gmail.com": "Hayley"};
  const toNames = recipients.map(e => NAMES[e.toLowerCase()] || e.split("@")[0]).join(", ");
  const client = new Anthropic({apiKey: Deno.env.get("ANTHROPIC_API_KEY")});
  const res: any = await client.beta.messages.create({
    model: "claude-opus-5-5", max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    output_config: {effort: "medium", format: {type: "json_schema", schema: PLAN_SCHEMA}},
    system: SYSTEM,
    messages: [{role: "user", content: `Week ${week} of 52 has just ended. This email goes to: ${toNames}. Methods the grown-ups approved for the children: ${methods.join(", ") || "none yet"}.\n` +
      rows.map(r => `Child id ${r.id}, allowed question types for Year ${r.stats.year}: ${(YEAR_KINDS[r.stats.year] || []).join(", ") || "multiplication only"}.\n${JSON.stringify(r.stats)}`).join("\n\n")}],
  } as any);
  if (res.stop_reason === "refusal") return new Response("Claude declined: " + JSON.stringify(res.stop_details), {status: 502});
  const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  let ai: any;
  try { ai = JSON.parse(text); } catch { return new Response("Claude's answer was not JSON (stop_reason " + res.stop_reason + ")", {status: 502}); }

  const plansOut = rows.map(r => {
    const c = (ai.children || []).find((x: any) => x.id === r.id) || {plan: {}};
    return {id: r.id, stats: r.stats, plan: {...clampPlan(c.plan, r.stats.year, r.prevPlan, r.stats), week: week + 1, set: Date.now()}};
  });
  const html = emailHtml(week, ai, plansOut), subject = String(ai.subject || `Kirkwood Family Times Table Champions: week ${week} of 52`);
  if (dry) return Response.json({week, subject, html, plans: plansOut.map(p => ({id: p.id, plan: p.plan})), stats: rows.map(r => r.stats)});

  if (!to) {
    const now = Date.now();
    const writes = [...plansOut.map(p => ({path: `plans/${p.id}`, data: {...p.plan, _t: now}})),
      {path: `reports/w${week}`, data: {week, subject, intro: ai.intro, children: ai.children, sent: now, _t: now}}];
    const {error: e2} = await db.from("docs").upsert(writes);
    if (e2) return new Response("write failed: " + e2.message, {status: 500});
  }
  const send = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: {Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json"},
    body: JSON.stringify({from: FROM, to: recipients, subject, html, reply_to: "sam@myfirstjobinfilm.com"}),
  });
  const sent = await send.json().catch(() => ({}));
  if (!send.ok) return new Response("send failed: " + JSON.stringify(sent), {status: 502});
  return Response.json({week, subject, to: recipients, resend: sent.id, plans: plansOut.map(p => ({id: p.id, plan: p.plan}))});
});
