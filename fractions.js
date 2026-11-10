// Fractions, decimals and percentages (Sam, 10 Nov 2026: decimals and fractions, then "add percentages"; first ask: "add decimals and fractions work too. make it age appropriate"). A tab on the
// times-tables side with the same shape as the tables: Practise (a worked explanation when stuck), Take a test (Bronze to
// Diamond, on the same weekly trail) and Beat the Clock (60 seconds, personal bests).
// Age appropriate: each skill belongs to the school year the National Curriculum teaches it in (Years 3 to 7). A child
// sees this year's skills ("New this year") and last year's ("Keep it sharp"), set by the school-year slider in Grown-ups.
// Answers are typed on a number pad that only shows the keys the answer needs: a point for decimals, a fraction line for
// fractions, and a gap for mixed numbers. A right amount in the wrong form (3/6 when the simplest form was asked) is not
// marked wrong: the child is told what form to use and tries again.
(function(){
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const R = (n, d = 1) => { const g = gcd(n, d), s = d < 0 ? -1 : 1; return {n: s * n / g, d: s * d / g}; };
const eq = (x, y) => x.n === y.n && x.d === y.d;
const add = (x, y) => R(x.n * y.d + y.n * x.d, x.d * y.d), sub = (x, y) => R(x.n * y.d - y.n * x.d, x.d * y.d), mul = (x, y) => R(x.n * y.n, x.d * y.d);
const lcm = (a, b) => a / gcd(a, b) * b;
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
// A rational as a decimal string, when it ends (every decimal answer here does).
const dec = r => { let n = r.n, d = r.d; const neg = n < 0; n = Math.abs(n); const w = Math.floor(n / d); let rem = n % d, s = '';
  for (let i = 0; rem && i < 8; i++) { rem *= 10; s += Math.floor(rem / d); rem %= d; } return (neg ? '-' : '') + w + (s ? '.' + s : ''); };
// A decimal written with k places, from the whole number n: D(347, 2) is 3.47.
const D = (n, k) => R(n, 10 ** k);
const ds = (n, k) => dec(D(n, k));

/* ---------- how a number looks on screen ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
const FR = (n, d) => `<span class="fr"><i>${esc(n)}</i><i>${esc(d)}</i></span>`;
const ft = r => r.d === 1 ? String(r.n) : `${r.n}/${r.d}`;          // the same, as plain text
const mt = r => { const w = Math.floor(r.n / r.d), p = r.n % r.d; return !p ? String(w) : w ? `${w} ${p}/${r.d}` : `${p}/${r.d}`; };
const gap = '<span class="slot" id="slot">?</span>';
// A bar cut into d equal parts with k shaded, for the youngest skills.
const bar = (d, k) => `<svg class="fd-bar" viewBox="0 0 ${d * 30} 34" role="img" aria-label="${k} of ${d} equal parts shaded">${Array.from({length: d}, (_, i) => `<rect x="${i * 30 + 1.5}" y="1.5" width="27" height="31" rx="4" fill="${i < k ? 'var(--me)' : 'var(--card)'}" stroke="var(--line)" stroke-width="2.5"/>`).join('')}</svg>`;

// A 10 by 10 grid with k of its 100 squares shaded, for the first percentages.
const grid = k => `<svg class="fd-grid" viewBox="0 0 102 102" role="img" aria-label="${k} of 100 squares shaded">${Array.from({length: 100}, (_, i) => `<rect x="${(i % 10) * 10 + 1}" y="${Math.floor(i / 10) * 10 + 1}" width="10" height="10" fill="${i < k ? 'var(--me)' : 'var(--card)'}" stroke="var(--line)" stroke-width=".8"/>`).join('')}</svg>`;

/* ---------- the answer: what was typed, and whether it is the right amount in the right form ---------- */
function parse(s){
  s = String(s).trim().replace(/\s+/g, ' ');
  let m;
  if ((m = s.match(/^(\d+) (\d+)\/(\d+)$/))) return +m[3] ? {form: 'mixed', v: R(+m[1] * +m[3] + +m[2], +m[3]), proper: +m[2] < +m[3], low: gcd(+m[2], +m[3]) === 1} : null;
  if ((m = s.match(/^(\d+)\/(\d+)$/))) return +m[2] ? {form: 'frac', v: R(+m[1], +m[2]), low: gcd(+m[1], +m[2]) === 1} : null;
  if ((m = s.match(/^(\d*)\.(\d+)$|^(\d+)\.?$/))) { const w = m[3] !== undefined ? m[3] : (m[1] || '0'), f = m[2] || ''; return {form: f ? 'dec' : 'int', v: R(+(w + f), 10 ** f.length)}; }
  return null;
}
// ok: right; form: the right amount written another way (say how, ask again); else wrong.
function check(input, a){
  const g = parse(input); if (!g) return {bad: true};
  if (!eq(g.v, a.v)) return {ok: false};
  const whole = a.v.d === 1;
  if (a.kind === 'num' || a.kind === 'dec') return g.form === 'int' || g.form === 'dec' ? {ok: true} : {form: 'Write it as a decimal, with a point, not as a fraction.'};
  if (g.form === 'dec' && !whole) return {form: 'Write it as a fraction, with the fraction line.'};
  if (a.kind === 'mixed' && !whole && g.form !== 'mixed') return {form: 'Write it as a mixed number: the whole number, then the gap key, then the fraction.'};
  if (a.kind === 'improper' && g.form !== 'frac') return {form: 'Write it as one fraction, top-heavy, with no whole number.'};
  if (g.form === 'mixed' && !g.proper) return {form: 'In a mixed number the fraction part has to be less than 1.'};
  if (a.simplest && g.form !== 'int' && !g.low) return {form: 'Right amount! Now simplify it: divide the top and bottom by the same number.'};
  return {ok: true};
}
const A = {
  num: v => ({kind: 'num', v: typeof v === 'number' ? R(v) : v}),
  dec: v => ({kind: 'dec', v}),
  frac: (v, simplest) => ({kind: 'frac', v, simplest: !!simplest}),
  mixed: v => ({kind: 'mixed', v}),
  improper: v => ({kind: 'improper', v}),
};
const showAns = a => a.kind === 'num' || a.kind === 'dec' ? dec(a.v) : a.kind === 'improper' ? ft(a.v) : a.kind === 'mixed' ? mt(a.v)
  : a.v.n > a.v.d && a.v.d !== 1 ? `${ft(a.v)} or ${mt(a.v)}` : ft(a.v);
const keysFor = a => a.kind === 'num' ? [] : a.kind === 'dec' ? ['.'] : a.kind === 'mixed' ? ['/', ' '] : a.kind === 'improper' ? ['/'] : a.v.n > a.v.d ? ['/', ' '] : ['/'];

/* ---------- the skills, year by year (National Curriculum, England) ----------
   Each makes one question: lead (a line of words, if needed), q (the sum, with the gap), ans, how (the worked way, shown
   when a practice answer is wrong), pic (a bar, for the youngest). */
const PROPER = [[1,2],[1,3],[2,3],[1,4],[3,4],[1,5],[2,5],[3,5],[4,5],[1,6],[5,6],[1,8],[3,8],[5,8],[7,8],[1,10],[3,10],[7,10],[9,10]];
const SKILLS = [
  {id: 'unit-of', y: 3, name: 'Unit fractions of amounts', kid: 'Find ½, ⅓, ¼ or ⅕ of a number.', glyph: '¼ of 12', gen(){
    const d = pick([2, 3, 4, 5, 8, 10]), k = ri(2, 10), n = d * k;
    return {q: `${FR(1, d)} of ${n} = ${gap}`, t: `1/${d} of ${n}`, ans: A.num(k), pic: bar(d, 1), how: `Share ${n} into ${d} equal groups. ${n} ÷ ${d} = ${k}.`}; }},
  {id: 'add-same', y: 3, name: 'Add fractions', kid: 'Same bottom number? Add the tops.', glyph: '⅖+⅕', gen(){
    const d = ri(3, 10), a = ri(1, d - 2), b = ri(1, d - 1 - a);
    return {q: `${FR(a, d)} + ${FR(b, d)} = ${gap}`, t: `${a}/${d} + ${b}/${d}`, ans: A.frac(R(a + b, d)), pic: bar(d, a + b), how: `The bottoms are the same, so add the tops: ${a} + ${b} = ${a + b}. The bottom stays ${d}: ${a + b}/${d}.`}; }},
  {id: 'sub-same', y: 3, name: 'Take away fractions', kid: 'Same bottom number? Take away the tops.', glyph: '⅚−⅙', gen(){
    const d = ri(3, 10), a = ri(2, d - 1), b = ri(1, a - 1);
    return {q: `${FR(a, d)} − ${FR(b, d)} = ${gap}`, t: `${a}/${d} − ${b}/${d}`, ans: A.frac(R(a - b, d)), pic: bar(d, a - b), how: `The bottoms are the same, so take away the tops: ${a} − ${b} = ${a - b}. The bottom stays ${d}: ${a - b}/${d}.`}; }},
  {id: 'halves', y: 3, name: 'Fractions that match', kid: 'How many quarters, sixths, eighths make a half?', glyph: '½=?', gen(){
    const [a, b] = pick([[1, 2], [1, 2], [1, 3], [1, 4]]), m = ri(2, 5), d = b * m;
    return {q: `${FR(a, b)} = ${FR('?', d).replace('<i>?</i>', `<i>${gap}</i>`)}`, t: `${a}/${b} = ?/${d}`, ans: A.num(a * m), pic: bar(d, a * m), how: `The bottom went from ${b} to ${d}: that is × ${m}. Do the same to the top: ${a} × ${m} = ${a * m}.`}; }},

  {id: 'of', y: 4, name: 'Fractions of amounts', kid: 'Find ¾ or ⅖ of a number.', glyph: '¾ of 20', gen(){
    const d = pick([3, 4, 5, 6, 8, 10]), a = ri(2, d - 1), k = ri(2, 12), n = d * k;
    return {q: `${FR(a, d)} of ${n} = ${gap}`, t: `${a}/${d} of ${n}`, ans: A.num(a * k), pic: bar(d, a), how: `First find 1/${d}: ${n} ÷ ${d} = ${k}. You want ${a} of those: ${a} × ${k} = ${a * k}.`}; }},
  {id: 'equiv', y: 4, name: 'Equivalent fractions', kid: 'Same amount, different numbers.', glyph: '⅔=⁸⁄?', gen(){
    const [a, b] = pick(PROPER.filter(([, b]) => b <= 6)), m = ri(2, 6), top = Math.random() < .5;
    return top ? {q: `${FR(a, b)} = ${FR('?', b * m).replace('<i>?</i>', `<i>${gap}</i>`)}`, t: `${a}/${b} = ?/${b * m}`, ans: A.num(a * m), how: `${b} × ${m} = ${b * m}, so times the top by ${m} too: ${a} × ${m} = ${a * m}.`}
      : {q: `${FR(a, b)} = ${FR(a * m, '?').replace('<i>?</i>', `<i>${gap}</i>`)}`, t: `${a}/${b} = ${a * m}/?`, ans: A.num(b * m), how: `${a} × ${m} = ${a * m}, so times the bottom by ${m} too: ${b} × ${m} = ${b * m}.`}; }},
  {id: 'add-over', y: 4, name: 'Add fractions past 1', kid: 'Add the tops. Over 1? You can write a mixed number.', glyph: '⅘+⅗', gen(){
    const d = ri(3, 10), a = ri(1, d - 1), b = ri(d - a, d - 1);
    return {q: `${FR(a, d)} + ${FR(b, d)} = ${gap}`, t: `${a}/${d} + ${b}/${d}`, ans: A.frac(R(a + b, d)), how: `Add the tops: ${a} + ${b} = ${a + b}, so ${a + b}/${d}.${a + b > d ? ` That is more than 1: ${d}/${d} makes 1 whole, so it is also ${mt(R(a + b, d))}.` : ''}`}; }},
  {id: 'tenths', y: 4, name: 'Tenths, hundredths and decimals', kid: 'Turn fractions into decimals and back.', glyph: '⁷⁄₁₀=0.7', gen(){
    const k = ri(0, 5);
    if (k === 0) { const n = ri(1, 9); return {q: `${FR(n, 10)} = ${gap}`, t: `${n}/10 = ?`, ans: A.dec(R(n, 10)), how: `${n} tenths is 0.${n}: the first place after the point is tenths.`}; }
    if (k === 1) { const n = ri(1, 9); return {q: `0.${n} = ${FR('?', 10).replace('<i>?</i>', `<i>${gap}</i>`)}`, t: `0.${n} = ?/10`, ans: A.num(n), how: `The ${n} is in the tenths place, so 0.${n} is ${n} tenths: ${n}/10.`}; }
    if (k === 2) { const n = ri(11, 99); return {q: `${FR(n, 100)} = ${gap}`, t: `${n}/100 = ?`, ans: A.dec(R(n, 100)), how: `${n} hundredths is ${ds(n, 2)}: two places after the point are hundredths.`}; }
    if (k === 3) { const n = ri(11, 99); return {q: `${ds(n, 2)} = ${FR('?', 100).replace('<i>?</i>', `<i>${gap}</i>`)}`, t: `${ds(n, 2)} = ?/100`, ans: A.num(n), how: `${ds(n, 2)} is ${n} hundredths: ${n}/100.`}; }
    const [a, b, v] = pick([[1, 2, '0.5'], [1, 4, '0.25'], [3, 4, '0.75']]);
    return k === 4 ? {q: `${FR(a, b)} = ${gap}`, t: `${a}/${b} = ?`, ans: A.dec(R(a, b)), how: `${a}/${b} is the same as ${a * 100 / b}/100, which is ${v}.`}
      : {q: `${v} = ${gap}`, lead: 'Write it as a fraction', t: `${v} as a fraction`, ans: A.frac(R(a, b)), how: `${v} is ${a * 100 / b}/100, and that is the same as ${a}/${b}.`}; }},
  {id: 'div10', y: 4, name: 'Divide by 10 and 100', kid: 'The digits move right. The point stays still.', glyph: '34÷10', gen(){
    const by = pick([10, 10, 100]), n = by === 10 ? ri(2, 99) : ri(2, 99);
    return {q: `${n} ÷ ${by} = ${gap}`, t: `${n} ÷ ${by}`, ans: A.dec(R(n, by)), how: `Dividing by ${by} moves every digit ${by === 10 ? 'one place' : 'two places'} to the right: ${n} ÷ ${by} = ${dec(R(n, by))}.`}; }},
  {id: 'pct-grid', y: 4, name: 'Per cent: out of 100', kid: 'Per cent means out of 100. Count the shaded squares.', glyph: '35%', gen(){
    const k = ri(1, 99);
    return {lead: 'What percentage of the grid is shaded?', q: `${gap} %`, t: `${k} of 100 squares shaded = ?%`, ans: A.num(k), pic: grid(k), always: true, how: `The grid has 100 squares and ${k} are shaded. ${k} out of 100 is ${k}%.`}; }},
  {id: 'round', y: 4, name: 'Round decimals', kid: 'To the nearest whole number.', glyph: '6.7≈7', gen(){
    const n = ri(11, 199), x = ds(n, 1), r = Math.floor((n + 5) / 10);
    return {lead: 'Round to the nearest whole number', q: `${x} → ${gap}`, t: `${x} to the nearest whole number`, ans: A.num(r), how: `Look at the tenths digit: ${n % 10}. ${n % 10 >= 5 ? '5 or more rounds up' : 'Less than 5 rounds down'}, so ${x} rounds to ${r}.`}; }},

  {id: 'to-mixed', y: 5, name: 'Mixed numbers', kid: 'Turn top-heavy fractions into mixed numbers.', glyph: '¹¹⁄₄=2¾', gen(){
    const d = ri(2, 9), w = ri(1, 4), p = ri(1, d - 1), n = w * d + p;
    return {lead: 'Write it as a mixed number', q: `${FR(n, d)} = ${gap}`, t: `${n}/${d} as a mixed number`, ans: A.mixed(R(n, d)), how: `How many ${d}s go into ${n}? ${w}, because ${w} × ${d} = ${w * d}, with ${p} left over. So ${w} ${p}/${d}.`}; }},
  {id: 'to-improper', y: 5, name: 'Top-heavy fractions', kid: 'Turn mixed numbers into top-heavy fractions.', glyph: '2¾=¹¹⁄₄', gen(){
    const d = ri(2, 9), w = ri(1, 4), p = ri(1, d - 1), n = w * d + p;
    return {lead: 'Write it as a top-heavy fraction', q: `${w}${FR(p, d)} = ${gap}`, t: `${w} ${p}/${d} as a top-heavy fraction`, ans: A.improper(R(n, d)), how: `${w} whole is ${w * d}/${d}. Add the ${p}/${d}: ${w * d} + ${p} = ${n}, so ${n}/${d}.`}; }},
  {id: 'add-related', y: 5, name: 'Add with different bottoms', kid: 'When one bottom fits into the other.', glyph: '½+⅛', gen(){
    const b = pick([2, 3, 4, 5]), m = pick([2, 3, 4].filter(x => b * x <= 12)), B = b * m, a = ri(1, b - 1), c = ri(1, B - 1), minus = Math.random() < .4 && a * m > c;
    const r = minus ? R(a * m - c, B) : R(a * m + c, B);
    return {q: `${FR(a, b)} ${minus ? '−' : '+'} ${FR(c, B)} = ${gap}`, t: `${a}/${b} ${minus ? '−' : '+'} ${c}/${B}`, ans: A.frac(r), how: `Make the bottoms match: ${a}/${b} = ${a * m}/${B}. Then ${a * m} ${minus ? '−' : '+'} ${c} = ${minus ? a * m - c : a * m + c}, so ${minus ? a * m - c : a * m + c}/${B}${(minus ? a * m - c : a * m + c) / B >= 1 || gcd(minus ? a * m - c : a * m + c, B) > 1 ? ` (which is ${r.n > r.d ? mt(r) : ft(r)})` : ''}.`}; }},
  {id: 'frac-x-whole', y: 5, name: 'Fraction times a whole number', kid: 'Times the top. The bottom stays the same.', glyph: '⅖×3', gen(){
    const d = ri(3, 10), a = ri(1, d - 1), w = ri(2, 6);
    return {q: `${FR(a, d)} × ${w} = ${gap}`, t: `${a}/${d} × ${w}`, ans: A.frac(R(a * w, d)), how: `Times the top by ${w}: ${a} × ${w} = ${a * w}. The bottom stays ${d}: ${a * w}/${d}${a * w >= d ? `, which is ${mt(R(a * w, d))}` : ''}.`}; }},
  {id: 'x10', y: 5, name: '× and ÷ by 10, 100, 1000', kid: 'Move the digits, not the point.', glyph: '0.45×100', gen(){
    const p = pick([10, 100, 1000]), times = Math.random() < .5, k = !times && p === 1000 ? 1 : ri(1, 2), n = ri(11, 999);
    const x = D(n, k), r = times ? mul(x, R(p)) : mul(x, R(1, p));
    return {q: `${dec(x)} ${times ? '×' : '÷'} ${p} = ${gap}`, t: `${dec(x)} ${times ? '×' : '÷'} ${p}`, ans: A.dec(r), how: `${times ? '×' : '÷'} ${p} moves every digit ${String(p).length - 1} place${p > 10 ? 's' : ''} to the ${times ? 'left' : 'right'}: ${dec(r)}.`}; }},
  {id: 'make-one', y: 5, name: 'Decimals that make 1', kid: 'What goes with it to make 1 whole?', glyph: '0.36+?=1', gen(){
    const k = pick([1, 2, 2]), n = k === 1 ? ri(1, 9) : ri(1, 99), x = D(n, k), r = sub(R(1), x);
    return {q: `${dec(x)} + ${gap} = 1`, t: `${dec(x)} + ? = 1`, ans: A.dec(r), how: `${k === 1 ? `${n} tenths and ${10 - n} tenths make 10 tenths` : `${n} hundredths and ${100 - n} hundredths make 100 hundredths`}, which is 1. So ${dec(r)}.`}; }},
  {id: 'percent', y: 5, name: 'Fractions and decimals as percentages', kid: 'Per cent means out of 100.', glyph: '¼=25%', gen(){
    const k = ri(0, 2);
    if (k === 0) { const [a, b] = pick([[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 10], [3, 10], [7, 10], [9, 10], [1, 20], [1, 25]]), p = a * 100 / b;
      return {q: `${FR(a, b)} = ${gap} %`, t: `${a}/${b} = ?%`, ans: A.num(p), how: `Make the bottom 100: ${a}/${b} = ${p}/100, and that is ${p}%.`}; }
    if (k === 1) { const n = ri(1, 99), x = ds(n, 2); return {q: `${x} = ${gap} %`, t: `${x} = ?%`, ans: A.num(n), how: `${x} is ${n} hundredths, and per cent means hundredths: ${n}%.`}; }
    const n = ri(1, 99); return {q: `${n}% = ${gap}`, lead: 'Write it as a decimal', t: `${n}% as a decimal`, ans: A.dec(R(n, 100)), how: `${n}% is ${n}/100, which is ${ds(n, 2)}.`}; }},
  {id: 'pct-rest', y: 5, name: 'Percentages make 100', kid: 'The whole thing is 100%. What is left?', glyph: '100%', gen(){
    const p = pick([ri(1, 19) * 5, ri(1, 99)]), [what, rest] = pick([['of the class walk to school', 'do not walk'], ['of the pizza has been eaten', 'is left'], ['of the film has been watched', 'is still to watch'], ['of the crew are on set', 'are not on set'], ['of the tickets are sold', 'are not sold yet']]);
    return {lead: `${p}% ${what}. What percentage ${rest}?`, q: `${gap} %`, t: `${p}% ${what}: what % ${rest}`, ans: A.num(100 - p), how: `The whole lot is 100%. 100 − ${p} = ${100 - p}, so ${100 - p}%.`}; }},
  {id: 'pct-easy', y: 5, name: 'Easy percentages of amounts', kid: '50% is half, 25% is a quarter, 10% is a tenth.', glyph: '10% of 70', gen(){
    const p = pick([50, 25, 10]), n = p === 50 ? 2 * ri(2, 50) : p === 25 ? 4 * ri(2, 25) : 10 * ri(2, 40);
    return {q: `${p}% of ${n} = ${gap}`, t: `${p}% of ${n}`, ans: A.num(n * p / 100), how: p === 50 ? `50% is a half: ${n} ÷ 2 = ${n / 2}.` : p === 25 ? `25% is a quarter: ${n} ÷ 4 = ${n / 4}.` : `10% is a tenth: ${n} ÷ 10 = ${n / 10}.`}; }},
  {id: 'round1', y: 5, name: 'Round to 1 decimal place', kid: 'Keep one digit after the point.', glyph: '3.47≈3.5', gen(){
    const n = ri(101, 999), x = ds(n, 2), r = Math.floor((n + 5) / 10);
    return {lead: 'Round to 1 decimal place', q: `${x} → ${gap}`, t: `${x} to 1 decimal place`, ans: A.dec(R(r, 10)), how: `Look at the hundredths digit: ${n % 10}. ${n % 10 >= 5 ? '5 or more rounds up' : 'Less than 5 rounds down'}, so ${x} becomes ${dec(R(r, 10))}.`}; }},

  {id: 'simplify', y: 6, name: 'Simplify fractions', kid: 'Divide the top and bottom by the same number.', glyph: '¹²⁄₁₆=¾', gen(){
    let a, b; do { b = ri(2, 12); a = ri(1, b - 1); } while (gcd(a, b) > 1); const m = ri(2, 6);
    return {lead: 'Simplify it as far as it goes', q: `${FR(a * m, b * m)} = ${gap}`, t: `simplify ${a * m}/${b * m}`, ans: A.frac(R(a, b), true), how: `${m} goes into both ${a * m} and ${b * m}: ${a * m} ÷ ${m} = ${a}, ${b * m} ÷ ${m} = ${b}. So ${a}/${b}.`}; }},
  {id: 'add-any', y: 6, name: 'Add and take away any fractions', kid: 'Find a bottom number they both go into.', glyph: '⅓+¼', gen(){
    let b1, b2; do { b1 = ri(2, 8); b2 = ri(2, 8); } while (b1 === b2 || b1 % b2 === 0 || b2 % b1 === 0);
    const a1 = ri(1, b1 - 1), a2 = ri(1, b2 - 1), L = lcm(b1, b2), x = a1 * L / b1, y = a2 * L / b2, minus = Math.random() < .45 && x !== y;
    const [p, q, P, Q] = minus && x < y ? [a2, b2, y, x] : [a1, b1, x, y], [p2, q2] = minus && x < y ? [a1, b1] : [a2, b2];
    const r = minus ? R(P - Q, L) : R(P + Q, L);
    return {q: `${FR(p, q)} ${minus ? '−' : '+'} ${FR(p2, q2)} = ${gap}`, t: `${p}/${q} ${minus ? '−' : '+'} ${p2}/${q2}`, ans: A.frac(r), how: `${q} and ${q2} both go into ${L}. ${p}/${q} = ${P}/${L} and ${p2}/${q2} = ${Q}/${L}. ${P} ${minus ? '−' : '+'} ${Q} = ${minus ? P - Q : P + Q}, so ${minus ? P - Q : P + Q}/${L}${r.d !== L || r.n > r.d ? ` (= ${r.n > r.d ? mt(r) : ft(r)})` : ''}.`}; }},
  {id: 'mul-frac', y: 6, name: 'Multiply fractions', kid: 'Tops times tops, bottoms times bottoms.', glyph: '⅔×¾', gen(){
    const [a, b] = pick(PROPER.filter(([, b]) => b <= 6)), [c, d] = pick(PROPER.filter(([, b]) => b <= 6)), r = R(a * c, b * d);
    return {q: `${FR(a, b)} × ${FR(c, d)} = ${gap}`, t: `${a}/${b} × ${c}/${d}`, ans: A.frac(r), how: `Tops: ${a} × ${c} = ${a * c}. Bottoms: ${b} × ${d} = ${b * d}. So ${a * c}/${b * d}${r.d !== b * d ? `, which simplifies to ${ft(r)}` : ''}.`}; }},
  {id: 'div-whole', y: 6, name: 'Divide a fraction by a whole number', kid: 'Share it into more pieces: times the bottom.', glyph: '½÷3', gen(){
    const [a, b] = pick(PROPER.filter(([, b]) => b <= 6)), w = ri(2, 5), r = R(a, b * w);
    return {q: `${FR(a, b)} ÷ ${w} = ${gap}`, t: `${a}/${b} ÷ ${w}`, ans: A.frac(r), how: `Splitting into ${w} makes each piece ${w} times smaller: times the bottom by ${w}. ${b} × ${w} = ${b * w}, so ${a}/${b * w}${r.d !== b * w ? ` (= ${ft(r)})` : ''}.`}; }},
  {id: 'frac-dec', y: 6, name: 'Fractions to decimals', kid: 'Eighths, fifths, twentieths and more.', glyph: '⅜=0.375', gen(){
    const [a, b] = pick([[1, 8], [3, 8], [5, 8], [7, 8], [1, 5], [2, 5], [3, 5], [4, 5], [1, 20], [3, 20], [7, 20], [1, 25], [2, 25], [1, 50], [3, 4], [1, 4]]);
    return {q: `${FR(a, b)} = ${gap}`, t: `${a}/${b} = ?`, ans: A.dec(R(a, b)), how: (T => `Make the bottom ${T}: ${b} × ${T / b} = ${T}, so ${a}/${b} = ${a * T / b}/${T}, which is ${dec(R(a, b))}.`)([10, 100, 1000].find(t => t % b === 0))}; }},
  {id: 'dec-tables', y: 6, name: 'Decimal times tables', kid: 'Use your times tables: 0.7 × 8 is ten times smaller than 7 × 8.', glyph: '0.7×8', gen(){
    const a = ri(2, 9), b = ri(2, 12), k = pick([1, 1, 2]), x = D(a, k), r = mul(x, R(b));
    return {q: `${dec(x)} × ${b} = ${gap}`, t: `${dec(x)} × ${b}`, ans: A.dec(r), how: `${a} × ${b} = ${a * b}. ${dec(x)} is ${k === 1 ? 'ten' : 'a hundred'} times smaller than ${a}, so the answer is too: ${dec(r)}.`}; }},
  {id: 'percent-of', y: 6, name: 'Percentages of amounts', kid: 'Find 10% first, then build up.', glyph: '15% of 60', gen(){
    const p = pick([10, 20, 25, 50, 75, 5, 15, 30, 40, 60, 70]), base = p % 25 === 0 ? 4 : 20, n = base * ri(1, 12);
    return {q: `${p}% of ${n} = ${gap}`, t: `${p}% of ${n}`, ans: A.num(R(p * n, 100)), how: p === 50 ? `50% is a half: ${n} ÷ 2 = ${n / 2}.` : p % 25 === 0 ? `25% is a quarter: ${n} ÷ 4 = ${n / 4}. ${p}% is ${p / 25} of those: ${p * n / 100}.` : `10% is ${n} ÷ 10 = ${n / 10}.${p === 5 ? ` 5% is half of that: ${n / 20}.` : p === 15 ? ` 5% is half of that: ${n / 20}. 10% + 5% = ${p * n / 100}.` : ` ${p}% is ${p / 10} lots of that: ${p * n / 100}.`}`}; }},

  {id: 'pct-out-of', y: 6, name: 'Scores as percentages', kid: 'Turn a score into a percentage, like your tests.', glyph: '18/20=90%', gen(){
    const t = pick([4, 5, 10, 20, 25, 50]), s = ri(1, t), m = 100 / t;
    return {lead: `You scored ${s} out of ${t}. What percentage is that?`, q: `${FR(s, t)} = ${gap} %`, t: `${s} out of ${t} = ?%`, ans: A.num(s * m), how: `Make it out of 100: ${t} × ${m} = 100, so times the score by ${m} too. ${s} × ${m} = ${s * m}, so ${s * m}%.`}; }},
  {id: 'pct-change', y: 7, name: 'Percentage increase and decrease', kid: 'Find the percentage, then add it on or take it off.', glyph: '+25%', gen(){
    const p = pick([5, 10, 15, 20, 25, 30, 50, 75]), n = 20 * ri(2, 15), part = n * p / 100, up = Math.random() < .5;
    return {lead: `${up ? 'Increase' : 'Decrease'} ${n} by ${p}%`, q: `${n} ${up ? '+' : '−'} ${p}% = ${gap}`, t: `${n} ${up ? 'increased' : 'decreased'} by ${p}%`, ans: A.num(up ? n + part : n - part), how: `${p}% of ${n} is ${part}. ${up ? `Add it on: ${n} + ${part} = ${n + part}` : `Take it off: ${n} − ${part} = ${n - part}`}.`}; }},
  {id: 'dec-x-dec', y: 7, name: 'Multiply two decimals', kid: 'Times the digits, then count the decimal places.', glyph: '0.3×0.4', gen(){
    const a = ri(2, 9), b = ri(2, 9), k1 = pick([1, 1, 0]), k2 = 1, x = D(a, k1), y = D(b, k2), r = mul(x, y);
    return {q: `${dec(x)} × ${dec(y)} = ${gap}`, t: `${dec(x)} × ${dec(y)}`, ans: A.dec(r), how: `${a} × ${b} = ${a * b}. There ${k1 + k2 === 1 ? 'is 1 decimal place' : `are ${k1 + k2} decimal places`} in the question, so ${k1 + k2 === 1 ? 'there is 1' : `there are ${k1 + k2}`} in the answer: ${dec(r)}.`}; }},
  {id: 'div-frac', y: 7, name: 'Divide by a fraction', kid: 'Keep, change, flip.', glyph: '¾÷½', gen(){
    const [a, b] = pick(PROPER.filter(([, b]) => b <= 8)), [c, d] = pick(PROPER.filter(([, b]) => b <= 6)), r = R(a * d, b * c);
    return {q: `${FR(a, b)} ÷ ${FR(c, d)} = ${gap}`, t: `${a}/${b} ÷ ${c}/${d}`, ans: A.frac(r), how: `Keep ${a}/${b}, change ÷ to ×, flip ${c}/${d} to ${d}/${c}. ${a}/${b} × ${d}/${c} = ${a * d}/${b * c}${r.d !== b * c ? ` = ${ft(r)}` : ''}${r.n > r.d && r.d !== 1 ? ` (= ${mt(r)})` : ''}.`}; }},
];
const BY = Object.fromEntries(SKILLS.map(s => [s.id, s]));

// Two copies of a child's decimals and fractions, merged by the app's sync.
window.TTCFracMerge = (a, b) => {
  if (!a) return b; if (!b) return a;
  const r = Object.assign({}, b, a); r.skills = {};
  for (const k of new Set([...Object.keys(a.skills || {}), ...Object.keys(b.skills || {})])) { const x = (a.skills || {})[k], y = (b.skills || {})[k]; r.skills[k] = !x ? y : !y ? x : x.n >= y.n ? x : y; }
  r.bests = Object.assign({}, b.bests); for (const [k, v] of Object.entries(a.bests || {})) { const o = r.bests[k]; if (!o || (v.score || 0) > (o.score || 0) || (v.pct || 0) > (o.pct || 0) || ((v.pct || 0) === (o.pct || 0) && v.ms < o.ms)) r.bests[k] = v; }
  r.won = (a.won || '') > (b.won || '') ? a.won : b.won;
  return r;
};

window.TTCFrac = function(X){
  const st = () => { const p = X.S.prog; p.fd = p.fd || {}; p.fd.skills = p.fd.skills || {}; p.fd.bests = p.fd.bests || {}; return p.fd; };
  // Age appropriate: this school year's skills and last year's. Year 3 has no year before it here; Year 8 works on Year 7's.
  const year = () => Math.min(7, Math.max(3, X.yearOf(X.S.me)));
  const mine = () => SKILLS.filter(s => s.y === year() || s.y === year() - 1);
  const rec = id => st().skills[id];
  const last10 = id => ((rec(id) || {}).r || '').slice(-10);
  const lvl = id => { const r = last10(id), right = r.split('').filter(x => x === '1').length; return !r ? 0 : r.length >= 10 && right >= 9 ? 3 : r.length >= 6 && right >= Math.ceil(r.length * .7) ? 2 : 1; };
  const LV = ['Not tried yet', 'Learning', 'Getting there', 'Strong'];
  const strong = () => mine().filter(s => lvl(s.id) === 3).length;
  const pts = s => 10 + (s.y >= 5 ? 5 : 0);
  const NAME = {practice: 'Practise', test: 'Test', clock: 'Beat the Clock'};

  /* ---------- playing ---------- */
  function start(kind, skillId){
    const pool = skillId ? [BY[skillId]] : mine();
    const total = kind === 'practice' ? 12 : kind === 'test' ? 20 : null;
    const P = X.S.fd = {kind, skillId: skillId || null, pool, total, answers: [], correct: 0, streak: 0, best: 0, input: '', start: Date.now(), fb: null, retry: false, locked: false, done: false,
      ends: kind === 'clock' ? Date.now() + 60000 : 0, bestKey: kind + ':' + (skillId || 'y' + year())};
    P.trophyOK = kind === 'test' && pool.some(s => lvl(s.id) < 3);
    P.timer = setInterval(() => tick(P), 250);
    next(P); X.go('fdplay');
  }
  function next(P){
    P.fb = null; P.input = ''; P.retry = false; P.formMsg = null;
    if (P.total && P.answers.length >= P.total) { finish(false); return; }
    // Weaker skills come up more; never the same question twice running.
    const w = P.pool.map(s => [4, 3, 2, 1][lvl(s.id)]); let r = Math.random() * w.reduce((a, b) => a + b, 0), s = P.pool[0];
    for (let i = 0; i < P.pool.length; i++) { r -= w[i]; if (r <= 0) { s = P.pool[i]; break; } }
    let q, tries = 0; do { q = s.gen(); } while (P.q && q.t === P.q.t && tries++ < 8);
    P.q = Object.assign(q, {skill: s.id}); P.qStart = Date.now();
    X.render();
  }
  function tick(P){
    if (X.S.fd !== P || P.done) { clearInterval(P.timer); return; }
    const el = document.getElementById('fd-time');
    if (P.kind === 'clock') { const left = P.ends - Date.now(); if (left <= 0) { finish(false); return; }
      if (el) el.textContent = Math.ceil(left / 1000) + 's'; const f = document.getElementById('pbar-fill'); if (f) f.style.width = (left / 600).toFixed(1) + '%'; }
    else if (el) el.textContent = X.fmtClock(Date.now() - P.start);
  }
  const lock = (P, ms, fn) => { P.locked = true; X.render(); setTimeout(() => { if (X.S.fd !== P || P.done) return; P.locked = false; fn(); }, ms); };
  function press(k){
    const P = X.S.fd; if (!P || P.locked || P.done) return;
    if (k === 'back') P.input = P.input.slice(0, -1);
    else if (k === 'ok') { submit(P); return; }
    else if (P.input.length < 9) {
      if (k === '.' && (/\./.test(P.input) || /\//.test(P.input))) return;
      if (k === '/' && (/[\/.]/.test(P.input) || !/\d$/.test(P.input))) return;
      if (k === ' ' && (/[ \/.]/.test(P.input) || !P.input)) return;
      P.input += k;
    }
    P.formMsg = null;
    const slot = document.getElementById('slot'); if (slot) slot.innerHTML = typed(P.input); else X.render();
  }
  function submit(P){
    const q = P.q; if (!P.input) return;
    const res = check(P.input, q.ans), ms = Date.now() - P.qStart;
    if (res.bad) { P.formMsg = 'Finish typing the number first.'; X.render(); return; }
    if (res.form) { P.formMsg = res.form; X.render(); return; }   // the right amount, written another way: try again, no mark
    if (P.retry) {
      if (res.ok) { P.fb = {ok: true, text: 'That’s it. Now you know how!'}; X.sound('ok'); lock(P, 800, () => next(P)); }
      else { P.fb = {ok: false, text: `Not quite. Type ${showAns(q.ans)} to carry on.`}; P.input = ''; X.sound('bad'); X.render(); }
      return;
    }
    const s = st(), r = s.skills[q.skill] = s.skills[q.skill] || {n: 0, c: 0, r: ''};
    r.n++; if (res.ok) r.c++; r.r = (r.r + (res.ok ? '1' : '0')).slice(-20); r.t = Date.now();
    P.answers.push({skill: q.skill, t: q.t, a: showAns(q.ans), g: P.input, ok: !!res.ok, ms, pts: res.ok ? pts(BY[q.skill]) : 0});
    if (res.ok) {
      P.correct++; P.streak++; P.best = Math.max(P.best, P.streak); X.sound('ok');
      const sk = X.skin(); P.fb = {ok: true, text: P.streak >= 5 && P.streak % 5 === 0 ? sk.streak(P.streak) : sk.praise[Math.floor(Math.random() * sk.praise.length)]};
      lock(P, P.kind === 'clock' ? 250 : 650, () => next(P));
    } else {
      P.streak = 0; X.sound('bad');
      if (P.kind === 'practice') { P.retry = true; P.fb = {ok: false, text: `Not quite. It's ${showAns(q.ans)}.`, how: q.how}; P.input = ''; X.render(); }
      else if (P.kind === 'test') { P.fb = {ok: false, text: 'Not this time. Keep going!'}; lock(P, 900, () => next(P)); }
      else { P.fb = {ok: false, text: `It's ${showAns(q.ans)}.`}; lock(P, 1300, () => next(P)); }
    }
  }
  function finish(stopped){
    const P = X.S.fd; if (!P || P.done) return; P.done = true; clearInterval(P.timer);
    const n = P.answers.length, c = P.correct; if (!n) { X.S.fd = null; X.go('fd'); return; }
    const p = X.S.prog, s = st(), pct = Math.round(c / n * 100), ms = Date.now() - P.start, today = X.dayStr();
    let xp = P.answers.reduce((t, a) => t + a.pts, 0), prize = null, pb = null; const extra = [];
    if (!stopped && P.kind === 'test') { prize = P.trophyOK ? X.tierFor(pct) : null; }
    // one decimals-and-fractions trophy a day, so the weekly trail is earned, not farmed
    if (prize && s.won === today) prize = null; else if (prize) s.won = today;
    if (!stopped && P.kind !== 'practice') {
      const old = s.bests[P.bestKey], v = P.kind === 'clock' ? {score: c, t: Date.now()} : {pct, ms, t: Date.now()};
      const better = !old || (P.kind === 'clock' ? c > old.score : pct > old.pct || (pct === old.pct && ms < old.ms));
      if (!old) { s.bests[P.bestKey] = v; pb = {first: true}; }
      else if (better) { s.bests[P.bestKey] = v; pb = {old, x: 30}; xp += 30; extra.push(`30 for a new personal best`); }
      else pb = {old};
    }
    const itemsBefore = X.itemsOwned(p);
    if (prize) xp += prize.xp || 0;
    p.xp += xp; p.totals = p.totals || {q: 0, c: 0};
    if (!p.days.includes(today)) { p.days.push(today); if (p.days.length > 400) p.days.shift(); }
    if (prize) { p.prizes[prize.id] = (p.prizes[prize.id] || 0) + 1; p.prizeLog.unshift({t: Date.now(), tier: prize.id, pct, mode: 'fd-test'}); p.prizeLog = p.prizeLog.slice(0, 80); }
    const newItems = []; for (let k = itemsBefore; k < X.itemsOwned(p); k++) newItems.push(k);
    const unlocked = X.skinId() !== 'classic' && itemsBefore < X.TRAIL_STOPS && X.itemsOwned(p) >= X.TRAIL_STOPS;
    const label = P.skillId ? BY[P.skillId].name : `Year ${year()} mix`;
    const entry = {t: P.start, mode: 'fd-' + P.kind, tables: [], n, c, pct, ms, xp, label, skills: [...new Set(P.answers.map(a => a.skill))], wrong: [...new Set(P.answers.filter(a => !a.ok).map(a => a.t))].slice(0, 12)};
    if (prize) entry.prize = prize.id;
    if (stopped) entry.ab = true;
    X.S.sessions.push(entry); X.ensureLogCur(); X.S.logCur.sessions.push(entry);
    if (!X.S.demo) Promise.all([X.saveProg(), X.saveLog()]).catch(X.saveFail);
    X.S.fdr = Object.assign({}, entry, {kind: P.kind, skillId: P.skillId, prize, pb, extra, newItems, unlocked, answers: P.answers, noTrophy: !stopped && P.kind === 'test' && !P.trophyOK && !!X.tierFor(pct), best: P.best});
    X.S.fd = null; X.go('fdres');
    if (prize) { X.confetti(prize.id); X.sound('win'); } else if (pb && pb.x) X.confetti('gold');
  }

  /* ---------- screens ---------- */
  // What has been typed so far, drawn as it will read: 2 3/4 as a 2 and a stacked fraction.
  const typed = s => { if (!s) return '?'; const m = s.match(/^(\d*)( ?)(\d*)(\/?)(\d*)$/);
    if (!m) return esc(s);
    if (!m[4] && !m[2]) return esc(s);
    if (m[2] && !m[4]) return `${esc(m[1])}<span class="fd-gap"></span>${esc(m[3]) || ''}`;
    return `${m[2] ? esc(m[1]) : ''}${FR(m[2] ? m[3] || '\u2007' : m[1], m[5] || '\u2007')}`; };
  function scrPlay(){
    const P = X.S.fd; if (!P) return scrHub();
    const q = P.q, cls = P.fb ? (P.fb.ok ? 'is-ok' : 'is-bad') : '';
    const left = P.kind === 'clock' ? Math.max(0, P.ends - Date.now()) : 0;
    const frac = P.kind === 'clock' ? left / 60000 : P.total ? P.answers.length / P.total : 0;
    const label = P.kind === 'clock' ? `${P.correct} right` : `${Math.max(0, P.total - P.answers.length)} to go`;
    const best = st().bests[P.bestKey], bestTxt = !best ? '' : P.kind === 'clock' ? `Best ${best.score}` : `Best ${best.pct}% in ${X.fmtClock(best.ms)}`;
    const qh = q.q.replace('<span class="slot" id="slot">?</span>', `<span class="slot" id="slot">${typed(P.input)}</span>`);
    const extra = keysFor(q.ans), K = k => k === ' ' ? `<button data-act="fd-key" data-k=" " aria-label="Gap before the fraction" class="fd-sp">␣ gap</button>` : `<button data-act="fd-key" data-k="${k}" aria-label="${k === '.' ? 'Decimal point' : 'Fraction line'}">${k === '/' ? '⁄' : k}</button>`;
    const digits = [1,2,3,4,5,6,7,8,9].map(n => `<button data-act="fd-key" data-k="${n}">${n}</button>`).join('');
    const pad = !extra.length ? `${digits}<button class="del" data-act="fd-key" data-k="back" aria-label="Delete">⌫</button><button data-act="fd-key" data-k="0">0</button><button class="ok" data-act="fd-key" data-k="ok" aria-label="Check my answer">✓</button>`
      : `${digits}${K(extra[0])}<button data-act="fd-key" data-k="0">0</button><button class="del" data-act="fd-key" data-k="back" aria-label="Delete">⌫</button>${extra[1] ? K(extra[1]) + `<button class="ok fd-ok2" data-act="fd-key" data-k="ok" aria-label="Check my answer">✓</button>` : `<button class="ok fd-ok3" data-act="fd-key" data-k="ok" aria-label="Check my answer">✓</button>`}`;
    const s = BY[q.skill];
    return `<header class="top"><div class="brand">${X.logo()}<span>Fractions, Decimals &amp; Percentages</span></div><div class="top-right"><span class="me-chip">${X.avatar(X.S.me, 34)}<span>${esc(X.S.me.name)}</span></span></div></header>
    <section class="play ${cls}">
      <div class="play-main">
        <div class="play-top"><div class="info"><span>${NAME[P.kind]}${P.skillId ? ' · ' + esc(s.name) : ''}</span><span class="num muted" id="fd-time">${P.kind === 'clock' ? Math.ceil(left / 1000) + 's' : X.fmtClock(Date.now() - P.start)}</span>${bestTxt ? `<span class="muted num">${bestTxt}</span>` : ''}${P.streak >= 3 ? `<span class="chip">${P.streak} in a row</span>` : ''}</div><button class="btn ghost small" data-act="fd-quit">Stop</button></div>
        <div class="pbar-wrap"><div class="pbar" role="progressbar" aria-label="How much is left"><span id="pbar-fill" style="width:${(frac * 100).toFixed(1)}%"></span></div><b class="num">${label}</b></div>
        <div class="qcard sticker">
          ${!P.skillId ? `<p class="eyebrow">${esc(s.name)}</p>` : ''}${q.lead ? `<p class="fd-lead">${esc(q.lead)}</p>` : ''}
          ${q.pic && (q.always || X.yearOf(X.S.me) <= 4) ? `<div class="fd-pic">${q.pic}</div>` : ''}
          <div class="q fd-q" aria-label="${esc(q.t)}">${qh}</div>
          <div class="fb" role="status">${P.formMsg ? esc(P.formMsg) : P.fb ? esc(P.fb.text) : ''}</div>
          ${P.fb && P.fb.how ? `<p class="hint">${esc(P.fb.how)} Type ${esc(showAns(q.ans))} to carry on.</p>` : ''}
        </div>
      </div>
      <div class="pad fd-pad" role="group" aria-label="Number pad">${pad}</div>
    </section>`;
  }
  function scrRes(){
    const r = X.S.fdr; if (!r) return scrHub();
    const head = r.ab ? 'Stopped early' : r.kind === 'clock' ? (r.pb && r.pb.x ? 'New personal best!' : "Time's up!") : r.prize ? `You won a ${esc(r.prize.name)}!` : r.kind === 'test' ? 'Test finished' : 'Practice finished';
    const big = r.kind === 'clock' ? `${r.c}` : r.kind === 'test' ? `${r.pct}%` : `${r.c}/${r.n}`;
    const sub = r.kind === 'clock' ? `right in ${r.ab ? X.fmtClock(r.ms) : '60 seconds'}` : `${r.kind === 'test' ? `${r.c} out of ${r.n} ` : ''}right in ${X.fmtClock(r.ms)} · best run ${r.best} in a row`;
    const was = o => r.kind === 'clock' ? o.score : `${o.pct}% in ${X.fmtClock(o.ms)}`;
    const pbLine = !r.pb ? '' : r.pb.first ? `<p class="muted">That sets your mark. Beat it next time for 30 bonus ${X.ptsName()}!</p>` : r.pb.x ? `<p class="callout mint">New personal best! It was ${was(r.pb.old)}.</p>` : `<p class="muted">Your best is ${was(r.pb.old)}.</p>`;
    const wrong = r.answers.filter(a => !a.ok);
    return `${X.topbar('fd')}<section class="results"><div class="res-body">
      <p class="eyebrow">Fractions, decimals &amp; percentages · ${NAME[r.kind]} · ${esc(r.label)}</p><h1 class="mega sm">${head}</h1>
      ${r.prize ? `<div class="res-medal pop">${X.medal(r.prize.id, 130)}</div>` : ''}
      <div><span class="score num">${big}</span> <span class="muted" style="font-weight:800">${sub}</span></div>
      ${pbLine}
      <p class="callout mint">+${r.xp} ${X.ptsName()}${r.extra.length ? ` (including ${r.extra.join(' and ')})` : ''}</p>
      ${r.noTrophy ? `<p class="callout">No trophy: ${r.skillId ? 'this one is already strong' : 'these are all strong already'}. Pick something that is not green yet to win one.</p>` : ''}
      ${r.kind === 'test' && !r.prize && !r.noTrophy && !r.ab && X.S.prog.fd && X.S.prog.fd.won === X.dayStr() && X.tierFor(r.pct) ? `<p class="muted">You already won today's fractions, decimals and percentages trophy. Come back tomorrow for another.</p>` : ''}
      ${X.resultItems(r)}
      ${wrong.length ? `<div><h3 style="margin-bottom:8px">To practise</h3><div class="mistakes">${wrong.slice(0, 12).map(a => `<span>${esc(a.t.includes('?') ? a.t.replace('?', a.a) : `${a.t} = ${a.a}`)} <small>you said ${esc(a.g)}</small></span>`).join('')}</div></div>` : r.n >= 5 ? '<p class="callout mint">Every answer right. Amazing!</p>' : ''}
      <div class="row" style="margin-top:14px"><button class="btn big" data-act="fd-start" data-k="${r.kind}" data-s="${esc(r.skillId || '')}">Play again</button><button class="btn ghost" data-act="go" data-to="fd">Fractions, decimals &amp; %</button></div>
    </div></section>`;
  }
  function scrHub(){
    const y = year(), list = mine(), s = st();
    const card = sk => { const l = lvl(sk.id), r = rec(sk.id), r10 = last10(sk.id), right = r10.split('').filter(x => x === '1').length;
      return `<div class="fd-skill sticker lv${l}"><div class="fd-glyph" aria-hidden="true">${esc(sk.glyph)}</div><div class="fd-sk-body"><b>${esc(sk.name)}</b><small>${esc(sk.kid)}</small>
        <small class="fd-lv">${LV[l]}${r10 ? ` · ${right} of the last ${r10.length} right` : ''}</small></div>
        <div class="fd-sk-btns"><button class="btn small" data-act="fd-start" data-k="practice" data-s="${sk.id}">Practise</button><button class="btn small ghost" data-act="fd-start" data-k="test" data-s="${sk.id}">Test</button></div></div>`; };
    const now = list.filter(x => x.y === y), before = list.filter(x => x.y < y);
    const cb = s.bests['clock:y' + y], tb = s.bests['test:y' + y];
    return `${X.topbar('fd')}
    <div class="parent-head"><div><p class="eyebrow">Year ${y} · ${strong()} of ${list.length} strong</p><h1 class="mega sm">Fractions, decimals &amp; percentages</h1>
      <p class="lede">Practise one skill with help when you are stuck, or test yourself on the lot. Tests win trophies for your trail.</p></div></div>
    <div class="modes fd-modes">
      <button class="mode" style="--c:var(--sun)" data-act="fd-start" data-k="test"><span class="glyph">90%</span><b>Year ${y} test</b><span>20 questions on everything below.${tb ? ` Best ${tb.pct}%.` : ''}</span></button>
      <button class="mode" style="--c:var(--tomato)" data-act="fd-start" data-k="clock"><span class="glyph">60s</span><b>Beat the Clock</b><span>${cb ? `Your best: ${cb.score}. Beat it!` : 'As many as you can in 60 seconds.'}</span></button>
    </div>
    <h2 class="sec">New this year</h2><div class="fd-skills">${now.map(card).join('')}</div>
    ${before.length ? `<h2 class="sec">Keep it sharp: Year ${y - 1}</h2><div class="fd-skills">${before.map(card).join('')}</div>` : ''}
    <p class="muted small" style="margin-top:16px">Green means strong: 9 of your last 10 right. The skills follow the school year a grown-up sets in Grown-ups.</p>`;
  }

  const actions = {
    'fd-start': el => start(el.dataset.k, el.dataset.s || null),
    'fd-key': el => press(el.dataset.k),
    'fd-quit': () => { const P = X.S.fd; if (P) finish(P.kind !== 'practice'); },
  };
  const keydown = e => {
    if (X.S.screen !== 'fdplay' || e.metaKey || e.ctrlKey || e.altKey) return false;
    if (e.target.matches && e.target.matches('input,textarea,select')) return false;
    const P = X.S.fd; if (!P) return false; const extra = keysFor(P.q.ans);
    if (/^[0-9]$/.test(e.key)) press(e.key);
    else if ((e.key === '.' || e.key === '/' || e.key === ' ') && extra.includes(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('back');
    else if (e.key === 'Enter') press('ok');
    else return false;
    return true;
  };
  return {screens: {fd: scrHub, fdplay: scrPlay, fdres: scrRes}, actions, keydown, stop: () => { const P = X.S.fd; if (P) { clearInterval(P.timer); } }, _test: {SKILLS, check, parse, dec, showAns}};
};
window.TTCFracSkills = SKILLS;   // for the tests
window.TTCFracCheck = check;
})();
