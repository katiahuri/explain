// Checks course/content/module-XX.json against the shape and length limits the generators rely on.
// Usage: node course/_build/validate-content.js [module-01.json ...]   (no args = all modules)
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'content');
const files = process.argv.slice(2).length
  ? process.argv.slice(2).map((f) => path.resolve(f))
  : fs.readdirSync(dir).filter((f) => /^module-\d\d(-part-\d)?\.json$/.test(f)).map((f) => path.join(dir, f));

const SLIDE_TYPES = ['statement', 'cards', 'table', 'compare', 'steps', 'rings', 'map', 'exercise', 'myths', 'check'];
let failures = 0;

for (const file of files) {
  const errors = [];
  const err = (msg) => errors.push(msg);
  const max = (value, n, where) => { if (typeof value !== 'string' || !value.trim()) err(`${where}: missing text`); else if (value.length > n) err(`${where}: ${value.length} chars, max ${n} — "${value.slice(0, 60)}…"`); };
  const count = (arr, lo, hi, where) => { if (!Array.isArray(arr)) err(`${where}: must be an array`); else if (arr.length < lo || arr.length > hi) err(`${where}: ${arr.length} items, need ${lo}–${hi}`); };

  let m;
  try { m = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log(`✗ ${path.basename(file)}: invalid JSON — ${e.message}`); failures++; continue; }

  max(m.title, 48, 'title'); max(m.label, 22, 'label'); max(m.quote, 60, 'quote'); max(m.summary, 200, 'summary');
  const wantId = `m${m.num}${m.part > 1 ? `p${m.part}` : ''}`;
  if (!/^\d\d$/.test(m.num || '') || m.id !== wantId) err(`id/num: expected num "NN" and id "${wantId}"`);
  if (m.part !== undefined && ![1, 2].includes(m.part)) err('part: 1 or 2 when present');
  count(m.learn, 4, 4, 'learn'); (m.learn || []).forEach((l, i) => { max(l.title, 28, `learn[${i}].title`); max(l.text, 80, `learn[${i}].text`); });
  count(m.materials, 2, 6, 'materials');
  count(m.blocks, 5, 8, 'blocks');
  const want = m.minutes === undefined ? 120 : m.minutes;
  if (![60, 120].includes(want)) err('minutes: 60 or 120');
  const minutes = (m.blocks || []).reduce((s, b) => s + (b.minutes || 0), 0);
  if (minutes !== want) err(`blocks: minutes add up to ${minutes}, need ${want}`);
  (m.blocks || []).forEach((b, i) => { max(b.name, 30, `blocks[${i}].name`); max(b.goal, 140, `blocks[${i}].goal`); count(b.steps, 2, 6, `blocks[${i}].steps`); if (!Array.isArray(b.tips)) err(`blocks[${i}].tips: must be an array`); });

  const ex = m.exercise || {};
  max(ex.title, 40, 'exercise.title'); max(ex.prompt, 220, 'exercise.prompt');
  count(ex.items, 3, 4, 'exercise.items'); (ex.items || []).forEach((t, i) => max(t, 28, `exercise.items[${i}]`));
  count(ex.steps, 3, 3, 'exercise.steps'); (ex.steps || []).forEach((t, i) => max(t, 40, `exercise.steps[${i}]`));
  count(ex.good_answers, 2, 5, 'exercise.good_answers');

  count(m.myths, 5, 5, 'myths'); (m.myths || []).forEach((x, i) => { max(x.myth, 44, `myths[${i}].myth`); max(x.truth, 52, `myths[${i}].truth`); });
  const ch = m.check || {}; max(ch.question, 70, 'check.question'); max(ch.prompt, 90, 'check.prompt'); count(ch.answers, 2, 6, 'check.answers');
  count(m.parking, 3, 8, 'parking'); max(m.homework, 160, 'homework');

  const cs = m.cheatsheet;
  if (!cs) err('cheatsheet: missing');
  else {
    max(cs.big_idea, 90, 'cheatsheet.big_idea');
    count(cs.ask, 5, 5, 'cheatsheet.ask'); (cs.ask || []).forEach((t, i) => max(t, 90, `cheatsheet.ask[${i}]`));
    count(cs.rules, 4, 4, 'cheatsheet.rules'); (cs.rules || []).forEach((t, i) => max(t, 90, `cheatsheet.rules[${i}]`));
    count(cs.red_flags, 4, 4, 'cheatsheet.red_flags'); (cs.red_flags || []).forEach((t, i) => max(t, 80, `cheatsheet.red_flags[${i}]`));
    count(cs.terms, 5, 5, 'cheatsheet.terms'); (cs.terms || []).forEach((t, i) => { max(t.term, 24, `cheatsheet.terms[${i}].term`); max(t.def, 90, `cheatsheet.terms[${i}].def`); });
    const tool = cs.tool || {};
    max(tool.title, 40, 'cheatsheet.tool.title');
    if (!['checklist', 'template', 'decision'].includes(tool.kind)) err('cheatsheet.tool.kind: checklist | template | decision');
    count(tool.items, 4, 6, 'cheatsheet.tool.items'); (tool.items || []).forEach((t, i) => max(t, 100, `cheatsheet.tool.items[${i}]`));
  }

  count(m.slides, 10, 20, 'slides');
  (m.slides || []).forEach((s, i) => {
    const w = `slides[${i}] (${s.type})`;
    if (!SLIDE_TYPES.includes(s.type)) { err(`${w}: unknown type`); return; }
    max(s.eyebrow, 40, `${w}.eyebrow`);
    if (typeof s.notes !== 'string' || !s.notes.trim()) err(`${w}.notes: missing`);
    if (['exercise', 'myths', 'check', 'map'].includes(s.type)) { if (s.type === 'myths' || s.type === 'map') max(s.title, 48, `${w}.title`); return; }
    if (s.type === 'statement') { max(s.title, 64, `${w}.title`); if (s.sub) max(s.sub, 110, `${w}.sub`); if (!['light', 'dark', 'accent'].includes(s.style)) err(`${w}.style: light | dark | accent`); if (s.pill) max(s.pill, 30, `${w}.pill`); return; }
    max(s.title, 52, `${w}.title`);
    if (s.type === 'cards') { count(s.cards, 2, 4, `${w}.cards`); (s.cards || []).forEach((c, j) => { max(c.title, 28, `${w}.cards[${j}].title`); max(c.text, 90, `${w}.cards[${j}].text`); }); }
    if (s.type === 'steps') { count(s.steps, 3, 4, `${w}.steps`); (s.steps || []).forEach((c, j) => { max(c.title, 26, `${w}.steps[${j}].title`); max(c.text, 80, `${w}.steps[${j}].text`); }); }
    if (s.type === 'table') { count(s.columns, 2, 3, `${w}.columns`); count(s.rows, 2, 6, `${w}.rows`); (s.rows || []).forEach((r, j) => { if (!Array.isArray(r) || r.length !== (s.columns || []).length) err(`${w}.rows[${j}]: needs ${(s.columns || []).length} cells`); (r || []).forEach((c, k) => max(c, 48, `${w}.rows[${j}][${k}]`)); }); }
    if (s.type === 'compare') { for (const side of ['left', 'right']) { const x = s[side] || {}; max(x.title, 26, `${w}.${side}.title`); max(x.sub, 50, `${w}.${side}.sub`); count(x.points, 2, 4, `${w}.${side}.points`); (x.points || []).forEach((p, j) => max(p, 38, `${w}.${side}.points[${j}]`)); } }
    if (s.type === 'rings') { count(s.rings, 3, 5, `${w}.rings`); count(s.points, 2, 3, `${w}.points`); }
  });
  for (const t of ['exercise', 'myths', 'check']) if (!(m.slides || []).some((s) => s.type === t)) err(`slides: needs one "${t}" slide`);

  if (errors.length) { failures++; console.log(`✗ ${path.basename(file)}`); errors.forEach((e) => console.log(`   - ${e}`)); }
  else console.log(`✓ ${path.basename(file)}`);
}
process.exit(failures ? 1 : 0);
