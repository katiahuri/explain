// Builds every ExplAIn course material from course/content/module-XX.json:
//   course/module-XX/*.pptx   slide deck (with speaker notes)
//   course/module-XX/*.docx   facilitator script
//   module-XX.html            public module page on the site
//   course/index.html         materials hub linking everything
// Usage: node build.js   (run validate-content.js first)
const fs = require('fs');
const path = require('path');
// Decks and .docx scripts need these. A `--pages` run does not, so the site can
// be rebuilt on a machine where they were never installed.
const optional = (id) => { try { return require(id); } catch (e) { return null; } };
const pptxgen = optional('pptxgenjs');
const docx = optional('docx') || {};

const ROOT = path.resolve(__dirname, '..', '..');
const { buildWebDeck } = require('./web-deck');
const { guestSection, GUEST_CSS } = require('./cast-card');
const { deckSection, DECK_CSS, DECK_JS } = require('./deck-widget');
const { checkSection, CHECK_CSS, CHECK_JS } = require('./check-block');
const COURSE = path.join(ROOT, 'course');
const CONTENT = path.join(COURSE, 'content');
const ASSETS = path.join(__dirname, 'assets');
const LOGO_WHITE = path.join(ROOT, 'assets', 'logo-white.png');
const LOGO_NAVY = path.join(ROOT, 'assets', 'logo.png');

const C = {
  navy: '0B1026', navy2: '121A3A', edge: '2A3566', violet: '7C3AED', violetL: 'A78BFA', violetD: '4C1D95',
  blue: '3B82F6', lav: 'EDE9FE', lavLine: 'DDD6FE', off: 'F8FAFC', white: 'FFFFFF', body: '4A5568',
  muted: '8A93A6', onDark: 'BFC7DC', line: 'E4E8F1', mapModel: '6D4AF0',
  // Panels on dark slides. panelAlt marks the emphasised side of a two-column layout.
  panel: '121A3A', panelAlt: '1B1248', panelLine: '26315C', rowAlt: '0E1534', onPanel: 'E6E9F3',
};
const FONT = 'Arial';

const MAP_BOXES = [
  ['Context', 'What the model sees right now'], ['Knowledge', 'Documents and retrieval'], ['Memory and state', 'What persists between turns'],
  ['Tools and actions', 'What it can do in the world'], ['Model', 'Generates the next tokens'], ['Orchestration', 'Steps and loops around calls'],
  ['Guardrails', 'What it may see and do'], ['Evaluation', 'How we know it works'], ['Interface', 'Where people meet it'],
];

// Translations live in course/content/<lang>/<same-filename>.json and carry the fields the
// facilitator script uses. Anything a translation leaves out falls back to the English.
const TRANSLATIONS = ['he'];
const modules = fs.readdirSync(CONTENT).filter((f) => /^module-\d\d(-part-\d)?\.json$/.test(f))
  .map((f) => {
    const m = JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8'));
    m.translations = {};
    for (const lang of TRANSLATIONS) {
      const tf = path.join(CONTENT, lang, f);
      if (fs.existsSync(tf)) m.translations[lang] = JSON.parse(fs.readFileSync(tf, 'utf8'));
    }
    return m;
  })
  .sort((a, b) => a.num.localeCompare(b.num) || (a.part || 0) - (b.part || 0));
const slugify = (s) => s.replace(/[’'“”?]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
// A module is identified by its number plus an optional part, so Module 00 can ship
// as two halves: Part 1 (free) and Part 2. Modules without a part are unaffected.
const noDot = (t) => String(t).replace(/\.\s*$/, '');
const partSlug = (m) => `module-${m.num}${m.part > 1 ? `-part-${m.part}` : ''}`;
const partName = (m) => `Module ${m.num}${m.part ? ` · Part ${m.part}` : ''}`;
const partCaps = (m) => `MODULE ${m.num}${m.part ? ` · PART ${m.part}` : ''}`;
const partFile = (m) => `Module-${m.num}${m.part ? `-Part-${m.part}` : ''}`;
const anchorOf = (m) => `m${m.num}${m.part > 1 ? `p${m.part}` : ''}`;
const deckName = (m) => `ExplAIn-${partFile(m)}-${slugify(m.title)}.pptx`;
const scriptName = (m, lang) => `ExplAIn-${partFile(m)}-Facilitator-Script${lang ? `-${lang.toUpperCase()}` : ''}.docx`;

// Fixed wording in the facilitator script. RTL languages set rtl: true.
const SCRIPT_TEXT = {
  en: {
    rtl: false, kicker: 'FACILITATOR SCRIPT', docTitle: 'facilitator script',
    caps: (m) => partCaps(m), name: (m) => partName(m),
    atAGlance: 'At a glance', format: 'Format: ', session: (h) => `one ${h}-hour live session.`,
    materials: 'Materials:', runOfShow: ['Time', 'Block', 'Goal'],
    goal: 'Goal: ', slides: 'Slides: ', notes: 'Facilitator notes', min: 'min',
    answerKey: 'Applied exercise: answer key', exercise: 'Exercise: ',
    answersTable: ['Part', 'What strong answers include'],
    checkQ: 'Check question', mythsH: 'Myths this module breaks',
    mythsTable: ['Myth', 'What’s actually true'],
    parkingH: 'Parking lot', parkingLead: 'Write deep questions on a visible parking lot and name where they are answered.',
    parkingTable: ['Question people ask', 'Answered in'],
    homework: 'Homework', closing: 'Closing call to action',
    cheatH: 'Cheat sheet (participants keep this)', ask: 'Ask on every project', rules: 'Rules of thumb',
    redFlags: 'Red flags', keyTerms: 'Key terms', termsTable: ['Term', 'Meaning'], page: ' facilitator script · Page ',
  },
  he: {
    rtl: true, kicker: 'מערך למנחה', docTitle: 'מערך למנחה',
    caps: (m) => `מודול ${m.num}${m.part ? ` · חלק ${m.part}` : ''}`,
    name: (m) => `מודול ${m.num}${m.part ? ` · חלק ${m.part}` : ''}`,
    atAGlance: 'מבט על', format: 'פורמט: ',
    session: (h) => `מפגש חי אחד של ${h === 1 ? 'שעה' : `${h} שעות`}.`,
    materials: 'חומרים:', runOfShow: ['זמן', 'בלוק', 'מטרה'],
    goal: 'מטרה: ', slides: 'שקפים: ', notes: 'הערות למנחה', min: 'דקות',
    answerKey: 'תרגיל יישומי: מפתח תשובות', exercise: 'תרגיל: ',
    answersTable: ['חלק', 'מה כוללת תשובה חזקה'],
    checkQ: 'שאלת בדיקה', mythsH: 'מיתוסים שהמודול שובר',
    mythsTable: ['מיתוס', 'מה נכון באמת'],
    parkingH: 'חניה', parkingLead: 'רשום שאלות עמוקות במקום גלוי ונקוב במקום שבו הן נענות.',
    parkingTable: ['שאלה שנשאלת', 'נענית ב'],
    homework: 'שיעורי בית', closing: 'קריאה לפעולה לסיום',
    cheatH: 'דף מרוכז (המשתתפים שומרים אותו)',
    ask: 'לשאול בכל פרויקט', rules: 'כללי אצבע',
    redFlags: 'נורות אדומות', keyTerms: 'מונחים מרכזיים',
    termsTable: ['מונח', 'משמעות'], page: ' מערך למנחה · עמוד ',
  },
};
const moduleDir = (m) => path.join(COURSE, partSlug(m));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Meta descriptions are cut off in search results past about 160 characters.
const clip = (text, limit = 155) => (text.length <= limit ? text : `${text.slice(0, text.lastIndexOf(' ', limit)).replace(/[,;:.]$/, '')}\u2026`);

// ---------------------------------------------------------------- PowerPoint
const W = 13.333, MX = 0.65, CW = W - 2 * MX;
const shadow = () => ({ type: 'outer', color: '000000', opacity: 0.35, blur: 12, offset: 2, angle: 90 });

function buildDeck(m, index) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = 'Katia Stainfeld Huri';
  pres.company = 'ExplAIn';
  pres.title = `ExplAIn ${partName(m)} — ${m.title}`;
  const next = modules[index + 1];
  // The closing slide is generated, so drop content slides that duplicate it.
  const slides = m.slides.filter((s) => !(s.type === 'statement' && (/^next\b/i.test(s.title || '') || /own it\.?$/i.test(s.title || ''))));
  // The cheat sheet slide goes right before the check question.
  if (m.cheatsheet) {
    const at = slides.findIndex((s) => s.type === 'check');
    slides.splice(at < 0 ? slides.length : at, 0, { type: 'cheatsheet', eyebrow: 'Cheat sheet · take it with you', notes: 'Point people to the printable cheat sheet in their workbook. Walk the questions quickly: these are what to ask on their own projects, starting tomorrow.' });
  }
  const total = slides.length + 2;
  let page = 0;

  const text = (slide, value, o) => slide.addText(value, { fontFace: FONT, margin: 0, isTextBox: true, valign: 'top', ...o });
  const footer = (slide, tone) => {
    page += 1;
    const color = tone === 'accent' ? 'DDD6FE' : C.muted;
    text(slide, `ExplAIn · ${partName(m)} · ${m.title}`, { x: MX, y: 6.95, w: 9, h: 0.3, fontSize: 10, color });
    text(slide, `${page} / ${total}`, { x: W - MX - 2, y: 6.95, w: 2, h: 0.3, fontSize: 10, color, align: 'right' });
  };
  // Rough Arial bold width (~0.5 em per character) so statement blocks stay together and vertically centered.
  const lineCount = (str, pt, width) => Math.max(1, Math.ceil((str.length * 0.5 * pt) / 72 / width));
  const statementBlock = (slide, { eyebrow, eyebrowColor, title, titleColor, titlePt, sub, subColor, pill }) => {
    const sw = CW * 0.9;
    const titleH = lineCount(title, titlePt, CW) * titlePt * 1.2 / 72 + 0.1;
    const subH = sub ? lineCount(sub, 20, sw) * 20 * 1.35 / 72 + 0.1 : 0;
    const blockH = 0.55 + titleH + (sub ? 0.35 + subH : 0) + (pill ? 1.0 : 0);
    let y = Math.max(0.9, (7.5 - blockH) / 2 - 0.1);
    text(slide, eyebrow.toUpperCase(), { x: MX, y, w: CW, h: 0.35, fontSize: 13, bold: true, charSpacing: 3, color: eyebrowColor });
    y += 0.55;
    text(slide, title, { x: MX, y, w: CW, h: titleH, fontSize: titlePt, bold: true, color: titleColor });
    y += titleH;
    if (sub) { y += 0.35; text(slide, sub, { x: MX, y, w: sw, h: subH, fontSize: 20, color: subColor }); y += subH; }
    if (pill) {
      y += 0.45;
      const pw = Math.min(6, 0.6 + pill.length * 0.13);
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y, w: pw, h: 0.55, rectRadius: 0.27, fill: { color: C.lav }, line: { color: C.lav, width: 0 } });
      text(slide, pill, { x: MX, y, w: pw, h: 0.55, fontSize: 14, bold: true, color: C.violetD, align: 'center', valign: 'middle' });
    }
  };
  const header = (slide, s) => {
    text(slide, (s.eyebrow || '').toUpperCase(), { x: MX, y: 0.5, w: CW, h: 0.3, fontSize: 12, bold: true, charSpacing: 2, color: C.violetL });
    const t = s.title || '';
    text(slide, t, { x: MX, y: 0.85, w: CW, h: 1.1, fontSize: t.length > 42 ? 28 : 32, bold: true, color: C.white, fit: 'shrink' });
  };
  // Every slide is dark. Accent keeps the violet gradient for rhythm; everything else,
  // including statements the JSON still calls "light", gets the navy background.
  const bg = (slide, kind) => {
    slide.background = { path: path.join(ASSETS, kind === 'accent' ? 'bg-accent.png' : 'bg-dark.png') };
  };
  const numberDot = (slide, x, y, d, label, fill = C.violet) => {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 } });
    text(slide, label, { x, y, w: d, h: d, fontSize: 12, bold: true, color: C.white, align: 'center', valign: 'middle' });
  };
  const tableRows = (columns, rows, firstBold) => [
    columns.map((c) => ({ text: c, options: { bold: true, color: C.lavLine, fill: { color: C.violetD } } })),
    ...rows.map((r, i) => r.map((c, j) => ({ text: c, options: { bold: firstBold && j === 0, color: firstBold && j === 0 ? C.white : C.onPanel, fill: { color: i % 2 ? C.rowAlt : C.panel } } }))),
  ];
  const addTable = (slide, columns, rows, { firstBold = false, y = 2.2 } = {}) => {
    const widths = columns.length === 3 ? [0.26, 0.37, 0.37] : [0.42, 0.58];
    slide.addTable(tableRows(columns, rows, firstBold), {
      x: MX, y, w: CW, colW: widths.map((f) => f * CW), fontFace: FONT, fontSize: rows.length > 5 ? 15 : 16,
      rowH: 0.56, valign: 'middle', border: { type: 'solid', pt: 0.75, color: C.panelLine },
    });
  };

  // Cover
  {
    const slide = pres.addSlide();
    bg(slide, 'dark');
    slide.addImage({ path: path.join(ASSETS, 'orbit.png'), x: 8.75, y: 0.45, w: 3.95, h: 3.95 });
    slide.addImage({ path: LOGO_WHITE, x: MX, y: 0.6, w: 1.9, h: 0.7 });
    text(slide, `${partCaps(m)} · ${m.label.toUpperCase()}`, { x: MX, y: 4.1, w: CW, h: 0.35, fontSize: 14, bold: true, charSpacing: 3, color: C.violetL });
    text(slide, m.title, { x: MX, y: 4.5, w: CW, h: 1.45, fontSize: m.title.length > 34 ? 38 : 44, bold: true, color: C.white, fit: 'shrink' });
    text(slide, m.quote, { x: MX, y: 6.05, w: CW, h: 0.5, fontSize: 20, color: C.onDark });
    page += 1;
    slide.addNotes(`${m.summary}\n\nSession plan (${m.minutes || 120} min): ${m.blocks.map((b) => `${b.name} ${b.minutes}`).join(' · ')}.`);
  }

  for (const s of slides) {
    const slide = pres.addSlide();
    let dark = false;
    let notes = s.notes || '';

    if (s.type === 'statement') {
      dark = s.style === 'accent' ? 'accent' : true;
      bg(slide, s.style);
      statementBlock(slide, {
        eyebrow: s.eyebrow || '', eyebrowColor: s.style === 'accent' ? C.lav : C.violetL,
        title: s.title, titleColor: C.white, titlePt: s.title.length > 48 ? 36 : 40,
        sub: s.sub, subColor: s.style === 'accent' ? 'F1EDFF' : C.onDark, pill: s.pill,
      });
    } else if (s.type === 'cards') {
      dark = true; bg(slide, 'dark'); header(slide, s);
      const n = s.cards.length, gap = 0.3, cw = (CW - gap * (n - 1)) / n;
      s.cards.forEach((c, i) => {
        const x = MX + i * (cw + gap);
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.3, w: cw, h: n > 3 ? 3.5 : 3.7, rectRadius: 0.12, fill: { color: C.panel }, line: { color: C.panelLine, width: 0.75 }, shadow: shadow() });
        numberDot(slide, x + 0.35, 2.65, 0.55, String(i + 1).padStart(2, '0'));
        text(slide, c.title, { x: x + 0.35, y: 3.45, w: cw - 0.7, h: 0.8, fontSize: n > 3 ? 17 : 19, bold: true, color: C.white });
        text(slide, c.text, { x: x + 0.35, y: 4.3, w: cw - 0.7, h: 1.4, fontSize: n > 3 ? 14 : 16, color: C.onDark });
      });
    } else if (s.type === 'steps') {
      dark = true; bg(slide, 'dark'); header(slide, s);
      const n = s.steps.length, colW = CW / n, d = 0.7;
      slide.addShape(pres.shapes.LINE, { x: MX + d / 2, y: 2.65 + d / 2, w: colW * (n - 1), h: 0, line: { color: 'C4B5FD', width: 2 } });
      s.steps.forEach((st, i) => {
        const x = MX + i * colW;
        numberDot(slide, x, 2.65, d, String(i + 1));
        text(slide, st.title, { x, y: 3.65, w: colW - 0.4, h: 0.75, fontSize: 18, bold: true, color: C.white });
        text(slide, st.text, { x, y: 4.45, w: colW - 0.4, h: 1.8, fontSize: 14, color: C.onDark });
      });
    } else if (s.type === 'table') {
      dark = true; bg(slide, 'dark'); header(slide, s);
      addTable(slide, s.columns, s.rows, { firstBold: s.columns.length === 3 || s.columns[0] === '' });
    } else if (s.type === 'compare') {
      dark = true; bg(slide, 'dark'); header(slide, s);
      const pw = (CW - 0.4) / 2;
      // The left panel carries the emphasis, as it did before the decks went dark.
      [['left', MX, true], ['right', MX + pw + 0.4, false]].forEach(([side, x, isAlt]) => {
        const p = s[side];
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.2, w: pw, h: 4.35, rectRadius: 0.15, fill: { color: isAlt ? C.panelAlt : C.panel }, line: { color: isAlt ? C.violetD : C.panelLine, width: 1 } });
        text(slide, p.title, { x: x + 0.45, y: 2.55, w: pw - 0.9, h: 0.6, fontSize: 24, bold: true, color: C.white });
        text(slide, p.sub, { x: x + 0.45, y: 3.2, w: pw - 0.9, h: 0.55, fontSize: 15, color: isAlt ? C.lavLine : C.onDark });
        text(slide, p.points.map((pt, i) => ({ text: pt, options: { bullet: true, breakLine: i < p.points.length - 1, paraSpaceAfter: 8 } })),
          { x: x + 0.45, y: 3.9, w: pw - 0.9, h: 2.4, fontSize: 17, color: C.onPanel });
      });
    } else if (s.type === 'rings') {
      dark = true; bg(slide, 'dark'); header(slide, s);
      const fills = ['121A3A', '1B1248', '2A1A6B', '4C1D95', C.violet];
      let [x, y, w, h] = [MX, 2.15, 7.0, 4.5];
      s.rings.forEach((label, i) => {
        const last = i === s.rings.length - 1;
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.18, fill: { color: fills[i] }, line: { color: i === 0 ? C.panelLine : fills[i], width: 1 } });
        text(slide, label, { x: x + 0.25, y: last ? y : y + 0.14, w: w - 0.5, h: last ? h : 0.4, fontSize: 14, bold: true, color: last ? C.white : C.lavLine, valign: last ? 'middle' : 'top' });
        x += 0.3; y += 0.6; w -= 0.6; h -= 0.9;
      });
      text(slide, s.points[0], { x: 8.1, y: 2.4, w: 4.6, h: 1.3, fontSize: 22, bold: true, color: C.white });
      text(slide, s.points.slice(1).map((pt, i, a) => ({ text: pt, options: { breakLine: i < a.length - 1, paraSpaceAfter: 14 } })), { x: 8.1, y: 3.9, w: 4.6, h: 2.6, fontSize: 16, color: C.onDark });
    } else if (s.type === 'map') {
      dark = true; bg(slide, 'dark'); header(slide, s);
      const gap = 0.2, cw = (CW - 2 * gap) / 3, ch = 1.38;
      MAP_BOXES.forEach(([title, hint], i) => {
        const x = MX + (i % 3) * (cw + gap), y = 2.15 + Math.floor(i / 3) * (ch + gap), model = title === 'Model';
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: ch, rectRadius: 0.12, fill: { color: model ? C.mapModel : C.panel }, line: { color: model ? C.mapModel : C.panelLine, width: 1 } });
        text(slide, title, { x: x + 0.3, y: y + 0.28, w: cw - 0.6, h: 0.45, fontSize: model ? 22 : 17, bold: true, color: C.white });
        text(slide, hint, { x: x + 0.3, y: y + 0.78, w: cw - 0.6, h: 0.4, fontSize: 13, color: model ? 'F1EDFF' : C.onDark });
      });
    } else if (s.type === 'exercise') {
      dark = true; bg(slide, 'dark'); header(slide, { eyebrow: s.eyebrow, title: m.exercise.title });
      const items = m.exercise.items, n = items.length, gap = 0.3, cw = (CW - gap * (n - 1)) / n;
      items.forEach((it, i) => {
        const x = MX + i * (cw + gap);
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.25, w: cw, h: 1.75, rectRadius: 0.12, fill: { color: C.navy2 }, line: { color: C.edge, width: 1 } });
        numberDot(slide, x + 0.3, 2.5, 0.5, String.fromCharCode(65 + i));
        text(slide, it, { x: x + 0.3, y: 3.15, w: cw - 0.6, h: 0.75, fontSize: n > 3 ? 17 : 20, bold: true, color: C.white });
      });
      const sw = (CW - 0.6) / 3;
      m.exercise.steps.forEach((st, i) => {
        const x = MX + i * (sw + 0.3);
        text(slide, `${i + 1}`, { x, y: 4.4, w: 0.4, h: 0.5, fontSize: 24, bold: true, color: C.violetL });
        text(slide, st, { x: x + 0.45, y: 4.45, w: sw - 0.5, h: 0.8, fontSize: 16, color: 'E6E9F3' });
      });
      text(slide, m.exercise.prompt, { x: MX, y: 5.55, w: CW, h: 0.9, fontSize: 14, italic: true, color: C.onDark });
      notes += `\n\nWhat strong answers include:\n${m.exercise.good_answers.map((g) => `- ${g.item}: ${g.answer}`).join('\n')}`;
    } else if (s.type === 'myths') {
      dark = true; bg(slide, 'dark'); header(slide, { eyebrow: s.eyebrow, title: s.title || 'Five myths to leave at the door' });
      addTable(slide, ['Myth', 'What’s actually true'], m.myths.map((x) => [x.myth, x.truth]));
    } else if (s.type === 'cheatsheet') {
      const cs = m.cheatsheet;
      dark = true; bg(slide, 'dark');
      text(slide, s.eyebrow.toUpperCase(), { x: MX, y: 0.5, w: CW, h: 0.3, fontSize: 12, bold: true, charSpacing: 2, color: C.violetL });
      text(slide, cs.big_idea, { x: MX, y: 0.85, w: CW, h: 1.1, fontSize: cs.big_idea.length > 60 ? 26 : 30, bold: true, color: C.white });
      const pw = (CW - 0.4) / 2;
      [['Ask on every project', cs.ask, true, MX], ['Rules of thumb', cs.rules, false, MX + pw + 0.4]].forEach(([label, items, isAlt, x]) => {
        slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.2, w: pw, h: 4.45, rectRadius: 0.15, fill: { color: isAlt ? C.panelAlt : C.panel }, line: { color: isAlt ? C.violetD : C.panelLine, width: 1 } });
        text(slide, label, { x: x + 0.4, y: 2.45, w: pw - 0.8, h: 0.45, fontSize: 20, bold: true, color: C.white });
        text(slide, items.map((it, i) => ({ text: it, options: { bullet: isAlt ? { type: 'number' } : true, breakLine: i < items.length - 1, paraSpaceAfter: 9 } })),
          { x: x + 0.4, y: 3.05, w: pw - 0.8, h: 3.45, fontSize: 14, color: C.onPanel });
      });
    } else if (s.type === 'check') {
      dark = 'accent'; bg(slide, 'accent');
      statementBlock(slide, { eyebrow: s.eyebrow || 'Check your map', eyebrowColor: C.lav, title: m.check.question, titleColor: C.white, titlePt: 36, sub: m.check.prompt, subColor: 'F1EDFF' });
      notes += `\n\nAnswer key:\n${m.check.answers.map((a) => `- ${a}`).join('\n')}`;
    }
    footer(slide, dark);
    slide.addNotes(notes.trim());
  }

  // Closing slide
  {
    const slide = pres.addSlide();
    bg(slide, 'dark');
    slide.addImage({ path: LOGO_WHITE, x: MX, y: 0.6, w: 1.9, h: 0.7 });
    const done = !next;
    text(slide, done ? 'COURSE COMPLETE' : `NEXT · ${partCaps(next)}`, { x: MX, y: 2.35, w: CW, h: 0.35, fontSize: 14, bold: true, charSpacing: 3, color: C.violetL });
    text(slide, done ? 'Don’t just use AI. Own it.' : next.title, { x: MX, y: 2.75, w: CW, h: 1.4, fontSize: 44, bold: true, color: C.white, fit: 'shrink' });
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: 4.85, w: CW, h: 1.2, rectRadius: 0.12, fill: { color: C.navy2 }, line: { color: C.edge, width: 1 } });
    text(slide, [{ text: done ? 'Keep going: ' : 'Before next session: ', options: { bold: true, color: C.white } }, { text: m.homework, options: { color: 'E6E9F3' } }],
      { x: MX + 0.4, y: 4.85, w: CW - 0.8, h: 1.2, fontSize: 17, valign: 'middle' });
    page += 1;
    slide.addNotes(done ? 'Close the course: thank the group, point everyone to their workbook summary, and repeat the line — the model generates, the system does.' : `Close by pointing to the workbook: ${m.homework}`);
  }

  return pres.writeFile({ fileName: path.join(moduleDir(m), deckName(m)) });
}

// ---------------------------------------------------------------- Word facilitator script
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, LevelFormat, BorderStyle, Footer, PageNumber, ImageRun } = docx;
const PAGE_W = 9638; // A4 width minus 2 cm margins, in DXA

function buildScript(m, lang) {
  // The translation supplies the content; the English module supplies anything it omits.
  const c = lang ? { ...m, ...m.translations[lang] } : m;
  const T = SCRIPT_TEXT[lang || 'en'];
  const rtl = T.rtl;
  const dir = rtl ? { bidirectional: true } : {};
  const run = (o) => (rtl ? { ...o, rightToLeft: true } : o);
  const P = (children, o = {}) => new Paragraph({ spacing: { after: 120 }, ...dir, ...o, children: Array.isArray(children) ? children : [new TextRun(run({ text: children }))] });
  const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, ...dir, children: [new TextRun(run({ text: t }))] });
  const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, ...dir, children: [new TextRun(run({ text: t }))] });
  const bullet = (t, ref = 'bullets') => new Paragraph({ numbering: { reference: rtl ? `${ref}-rtl` : ref, level: 0 }, spacing: { after: 80 }, ...dir, children: [new TextRun(run({ text: t }))] });
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'D9DEEA' };
  const borders = { top: border, bottom: border, left: border, right: border };
  const table = (headers, rows, fractions) => {
    const widths = fractions.map((f) => Math.round(f * PAGE_W));
    const cell = (t, i, head) => new TableCell({
      borders, width: { size: widths[i], type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 120, right: 120 },
      shading: head ? { type: ShadingType.CLEAR, fill: 'EDE9FE', color: 'auto' } : undefined,
      children: [new Paragraph({ ...dir, children: [new TextRun(run({ text: t, bold: head, color: head ? '4C1D95' : undefined }))] })],
    });
    return new Table({
      width: { size: PAGE_W, type: WidthType.DXA }, columnWidths: widths, visuallyRightToLeft: rtl,
      rows: [new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, i, true)) }), ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, i, false)) }))],
    });
  };
  const spacer = () => new Paragraph({ spacing: { after: 60 }, children: [] });

  let t = 0;
  const clock = (mins) => `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
  const runOfShow = c.blocks.map((b) => { const row = [`${clock(t)}–${clock(t + b.minutes)}`, b.name, b.goal]; t += b.minutes; return row; });

  const children = [
    new Paragraph({ spacing: { after: 240 }, children: [new ImageRun({ type: 'png', data: fs.readFileSync(LOGO_NAVY), transformation: { width: 130, height: 48 } })] }),
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `${T.caps(m)} · ${c.label.toUpperCase()} · ${T.kicker}`, bold: true, color: '7C3AED', size: 18, characterSpacing: 40 })] }),
    new Paragraph({ heading: HeadingLevel.TITLE, ...dir, children: [new TextRun(run({ text: c.title }))] }),
    P([new TextRun(run({ text: `“${c.quote}”`, italics: true, color: '4C1D95', size: 26 }))], { spacing: { after: 160 } }),
    P(c.summary),
    H1(T.atAGlance),
    P([new TextRun(run({ text: T.format, bold: true })), new TextRun(run({ text: T.session((m.minutes || 120) / 60) }))]),
    P([new TextRun(run({ text: T.materials, bold: true }))], { spacing: { after: 60 } }),
    ...c.materials.map((x) => bullet(x)),
    spacer(),
    table(T.runOfShow, runOfShow, [0.14, 0.24, 0.62]),
  ];

  c.blocks.forEach((b, bi) => {
    children.push(H1(`${b.name} (${b.minutes} ${T.min})`));
    children.push(P([new TextRun(run({ text: T.goal, bold: true })), new TextRun(run({ text: b.goal }))]));
    if (b.slides) children.push(P([new TextRun(run({ text: T.slides, bold: true, color: '667085' })), new TextRun(run({ text: b.slides, color: '667085' }))]));
    b.steps.forEach((st) => children.push(new Paragraph({ numbering: { reference: rtl ? 'steps-rtl' : 'steps', level: 0, instance: bi + 1 }, spacing: { after: 100 }, ...dir, children: [new TextRun(run({ text: st }))] })));
    if (b.tips && b.tips.length) {
      children.push(P([new TextRun(run({ text: T.notes, bold: true, color: '4C1D95' }))], { spacing: { before: 120, after: 60 } }));
      b.tips.forEach((tip) => children.push(bullet(tip)));
    }
  });

  children.push(
    H1(T.answerKey),
    P([new TextRun(run({ text: T.exercise, bold: true })), new TextRun(run({ text: c.exercise.prompt }))]),
    table(T.answersTable, c.exercise.good_answers.map((g) => [g.item, g.answer]), [0.26, 0.74]),
    H1(T.checkQ),
    P([new TextRun(run({ text: c.check.question, bold: true })), new TextRun(run({ text: ` ${c.check.prompt}` }))]),
    ...c.check.answers.map((a) => bullet(a)),
    H1(T.mythsH),
    table(T.mythsTable, c.myths.map((x) => [x.myth, x.truth]), [0.45, 0.55]),
    H1(T.parkingH),
    P(T.parkingLead),
    table(T.parkingTable, c.parking.map((x) => [x.question, x.where]), [0.62, 0.38]),
    H1(modules.indexOf(m) === modules.length - 1 ? T.closing : T.homework),
    P(c.homework),
  );

  if (c.cheatsheet) {
    const cs = c.cheatsheet;
    children.push(
      H1(T.cheatH),
      P([new TextRun(run({ text: cs.big_idea, bold: true, color: '4C1D95' }))]),
      H2(T.ask), ...cs.ask.map((a) => bullet(a)),
      H2(T.rules), ...cs.rules.map((a) => bullet(a)),
      H2(T.redFlags), ...cs.red_flags.map((a) => bullet(a)),
      H2(T.keyTerms),
      table(T.termsTable, cs.terms.map((t) => [t.term, t.def]), [0.28, 0.72]),
      H2(cs.tool.title), ...cs.tool.items.map((a) => bullet(cs.tool.kind === 'checklist' ? `☐  ${a}` : a)),
    );
  }

  const doc = new Document({
    creator: 'Katia Stainfeld Huri', title: `ExplAIn ${partName(m)} ${T.docTitle}`,
    styles: {
      default: { document: { run: { font: FONT, size: 21, color: '3F4859' }, paragraph: { spacing: { line: 276 } } } },
      paragraphStyles: [
        { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: FONT, size: 44, bold: true, color: '0B1026' }, paragraph: { spacing: { after: 120 } } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true, color: '0B1026' }, paragraph: { spacing: { before: 320, after: 140 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, color: '7C3AED' }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
        { reference: 'steps', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
        { reference: 'bullets-rtl', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.RIGHT, style: { paragraph: { indent: { start: 540, hanging: 300 } } } }] },
        { reference: 'steps-rtl', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.RIGHT, style: { paragraph: { indent: { start: 540, hanging: 360 } } } }] },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, bidirectional: rtl, children: [new TextRun(run({ size: 16, color: '8A93A6', children: [`ExplAIn · ${T.name(m)}${T.page}`, PageNumber.CURRENT] }))] })] }) },
      children,
    }],
  });
  return Packer.toBuffer(doc).then((buf) => fs.writeFileSync(path.join(moduleDir(m), scriptName(m, lang)), buf));
}

// ---------------------------------------------------------------- Module web page
const PAGE_CSS = fs.readFileSync(path.join(__dirname, 'module-page.css'), 'utf8');

const toolItem = (kind, item) => {
  if (kind === 'decision' && item.includes('→')) {
    const [when, then] = item.split('→');
    return `<li><span>${esc(when.trim())}</span><b>→ ${esc(then.trim())}</b></li>`;
  }
  return `<li>${esc(item)}</li>`;
};

function cheatSection(m) {
  // The free module links its public web deck here, beside the cheat sheet takeaways.
  const webDeck = m.web_deck ? ` <a class="btn btn-outline" href="course/${partSlug(m)}/deck.html">Read the deck <span aria-hidden="true">→</span></a>` : '';
  const cs = m.cheatsheet;
  return `
    <section class="section white" id="cheat-sheet">
      <div class="shell">
        <div class="section-head"><p class="eyebrow">Cheat sheet</p><h2>${esc(noDot(cs.big_idea))}</h2></div>
        <p style="max-width:640px;color:var(--muted);font-size:17px;line-height:1.65">One page you keep: the questions to ask on every project, the rules of thumb, and ${esc(cs.tool.kind === 'decision' ? 'a decision guide' : cs.tool.kind === 'template' ? 'a template' : 'a checklist')} you can use on your own product. All nine come with The Book.</p>
        <div class="actions" style="margin-top:22px"><a class="btn btn-primary" href="digital-course.html#pricing">Get the cheat sheets</a>${webDeck}</div>
      </div>
    </section>`;
}

function buildPage(m, index) {
  const prev = modules[index - 1], next = modules[index + 1];
  const mapSection = m.slides.some((s) => s.type === 'map') ? `
    <section class="section white">
      <div class="shell">
        <div class="section-head"><p class="eyebrow">The system map</p><h2>Eight boxes around <span class="grad-text">one model</span></h2></div>
        <div class="map">${MAP_BOXES.map(([t, h]) => `<div class="box${t === 'Model' ? ' model' : ''}"><h3>${esc(t)}</h3><p>${esc(h)}</p></div>`).join('')}</div>
        <p class="map-note">Every later module zooms into one box.</p>
      </div>
    </section>` : '';
  const worksheet = fs.existsSync(path.join(moduleDir(m), 'worksheet.html')) ? ` <a class="btn btn-ghost" href="course/${partSlug(m)}/worksheet.html">Printable worksheet</a>` : '';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(m.title)} — ExplAIn ${partName(m)}</title>
  <meta name="description" content="${esc(clip(`ExplAIn ${partName(m)}: ${m.summary}`))}">
  <meta name="theme-color" content="#0B1026">
  <link rel="icon" type="image/png" href="assets/icon.png">
  <link rel="apple-touch-icon" href="assets/icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <!-- Generated by course/_build/build.js from course/content/${partSlug(m)}.json — edit the JSON, not this file. -->
  <style>
${PAGE_CSS}
${GUEST_CSS}
${CHECK_CSS}
${m.web_deck ? DECK_CSS : ''}
  </style>
</head>
<body>
  <nav class="site-nav" aria-label="Primary">
    <div class="shell nav-inner">
      <a class="logo" href="index.html" aria-label="ExplAIn home"><img src="assets/logo-white.png" alt="ExplAIn" width="545" height="201"></a>
      <div class="nav-links">
        <a href="digital-course.html">Digital course</a>
        <a href="syllabus.html">Full course syllabus</a>
        <a href="articles.html">Articles</a>
        <a href="about.html">About</a>
        <a class="btn btn-primary" href="digital-course.html#join">Join the waitlist</a>
      </div>
    </div>
  </nav>

  <header class="hero">
    <div class="shell hero-inner">
      <a class="back" href="digital-course.html#curriculum">← All modules</a>
      <p class="eyebrow">${esc(partName(m))} · ${esc(m.label)}</p>
      <h1>${esc(m.title)}</h1>
      <p class="hero-lead">${esc(m.quote)}</p>${m.web_deck ? `
      <div class="actions" style="margin-top:28px"><a class="btn btn-primary" href="#deck">Read the free deck <span aria-hidden="true">↓</span></a> <a class="btn btn-ghost" href="digital-course.html#pricing">Get the workbook</a></div>` : ''}
    </div>
  </header>

  <main>
${m.web_deck ? deckSection(m, { esc, mapBoxes: MAP_BOXES, partName }) : ''}
    <section class="section">
      <div class="shell">
        <div class="section-head"><p class="eyebrow">What you’ll learn</p><h2>Four ideas, one module</h2></div>
        <div class="learn">${m.learn.map((l, i) => `
          <article><span>${String(i + 1).padStart(2, '0')}</span><h3>${esc(l.title)}</h3><p>${esc(l.text)}</p></article>`).join('')}
        </div>
      </div>
    </section>
${mapSection}
    <section class="section">
      <div class="shell">
        <div class="exercise">
          <div>
            <p class="eyebrow">Applied exercise</p>
            <h2>${esc(noDot(m.exercise.title))}</h2>
            <p>${esc(m.exercise.prompt)}</p>
            <div class="actions"><a class="btn btn-primary" href="digital-course.html#pricing">Get the workbook <span aria-hidden="true">→</span></a>${worksheet}</div>
          </div>
          <ul class="products">${m.exercise.items.map((it) => `<li>${esc(it)}</li>`).join('')}</ul>
        </div>
      </div>
    </section>

${m.cheatsheet ? cheatSection(m) : ''}
    <section class="section">
      <div class="shell">
        <div class="section-head"><p class="eyebrow">Leave at the door</p><h2>Five myths this module breaks</h2></div>
        <table class="myths">
          <tr><th scope="col">Myth</th><th scope="col">What’s actually true</th></tr>${m.myths.map((x) => `
          <tr><td>${esc(x.myth)}</td><td>${esc(x.truth)}</td></tr>`).join('')}
        </table>
      </div>
    </section>

${checkSection(m, { esc })}
${guestSection(partSlug(m))}
    <section class="section">
      <div class="shell">
        <div class="next">
          ${next ? `<div><small>Next · ${esc(partName(next))}</small><h3>${esc(next.title)}</h3></div>` : `<div><small>Course complete</small><h3>Don’t just use AI. Own it</h3></div>`}
          <div class="next-actions">
            ${prev ? `<a class="btn btn-outline" href="${partSlug(prev)}.html">← ${esc(partName(prev))}</a>` : `<a class="btn btn-outline" href="syllabus.html">Full syllabus</a>`}
            ${next ? `<a class="btn btn-primary" href="${partSlug(next)}.html">${esc(partName(next))} <span aria-hidden="true">→</span></a>` : `<a class="btn btn-primary" href="digital-course.html#pricing">Get the workbook <span aria-hidden="true">→</span></a>`}
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="shell footer-inner">
      <a href="index.html" aria-label="ExplAIn home"><img src="assets/logo-white.png" alt="ExplAIn" width="545" height="201"></a>
      <span>Know more. Build better. Go further.</span>
      <span>Don’t just use AI. <b>Own it.</b></span>
    </div>
  </footer>
  <script>${CHECK_JS}
  </script>
${m.web_deck ? `  <script>${DECK_JS}
  </script>` : ''}
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, `${partSlug(m)}.html`), html);
}

// ---------------------------------------------------------------- Printable cheat sheets
const SHEETS = path.join(COURSE, 'cheatsheets');
const SHEET_CSS = `
  :root { color-scheme: light; }
  :root { --navy: #0b1026; --violet: #7c3aed; --blue: #3b82f6; --lav: #ede9fe; --muted: #5d6679; --line: #e2e6ef; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #eef0f6; color: #2b3345; font-family: Poppins, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  .toolbar { display: flex; justify-content: center; gap: 10px; padding: 18px 16px 0; }
  .toolbar a, .toolbar button { min-height: 42px; padding: 0 20px; border: 0; border-radius: 999px; color: #fff; background: linear-gradient(115deg, var(--violet), var(--blue)); font: 600 14px Poppins, Arial, sans-serif; text-decoration: none; display: inline-flex; align-items: center; cursor: pointer; }
  .toolbar a.ghost { color: var(--navy); background: #fff; border: 1px solid var(--line); }
  .sheet { width: 210mm; min-height: 297mm; margin: 18px auto 36px; padding: 11mm 12mm 9mm; background: #fff; box-shadow: 0 18px 44px rgba(11,16,38,.12); display: flex; flex-direction: column; gap: 3.4mm; }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
  header img { height: 34px; display: block; }
  .kicker { margin: 0; color: var(--violet); font-size: 8.5pt; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; text-align: right; }
  h1 { margin: 2px 0 0; color: var(--navy); font-size: 17pt; letter-spacing: -.02em; text-align: right; }
  .idea { padding: 3.5mm 5.5mm; border-radius: 10px; color: #fff; background: linear-gradient(115deg, #6d28d9, #3b82f6); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .idea p { margin: 0; font-size: 12pt; font-weight: 600; line-height: 1.35; }
  .idea small { display: block; margin-top: 3px; color: #ede9fe; font-size: 8.5pt; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3.4mm; }
  .box { padding: 3.5mm 4.5mm; border: 1px solid var(--line); border-radius: 10px; }
  .box.dark { border: 0; color: #e6e9f3; background: #121a3a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h2 { margin: 0 0 2.5mm; color: var(--navy); font-size: 10.5pt; }
  .dark h2 { color: #fff; }
  ol, ul { margin: 0; padding-left: 5mm; display: grid; gap: 1.4mm; font-size: 8.6pt; line-height: 1.38; }
  .dark li::marker { color: #a78bfa; font-weight: 700; }
  li::marker { color: var(--violet); }
  .flags li::marker { content: "⚠  "; color: #c2410c; }
  dl { display: grid; grid-template-columns: 27mm 1fr; gap: 1.4mm 3mm; margin: 0; font-size: 8.4pt; line-height: 1.32; }
  dt { color: var(--navy); font-weight: 600; }
  dd { margin: 0; color: #4a5568; }
  .tool { padding: 3.5mm 4.5mm; border-radius: 10px; background: var(--lav); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .tool small { color: #6d28d9; font-size: 8pt; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; }
  .tool h2 { margin-top: 1mm; }
  .tool ul { padding: 0; list-style: none; gap: 1.6mm; color: #2e1065; grid-template-columns: 1fr 1fr; }
  .tool ul.tool-decision { grid-template-columns: 1fr; }
  .tool li { padding: 1.8mm 3mm; border-radius: 7px; background: #fff; }
  .tool-checklist li::before { content: "☐"; margin-right: 3mm; color: var(--violet); }
  .tool-decision li { display: grid; grid-template-columns: 1fr auto; gap: 1mm 5mm; }
  .tool-decision li b { color: #6d28d9; font-weight: 600; }
  .tool-template li i { display: block; height: 5mm; border-bottom: 1px solid #c4b5fd; }
  footer { display: flex; justify-content: space-between; margin-top: auto; padding-top: 2mm; color: #8a93a6; font-size: 7.5pt; letter-spacing: .12em; text-transform: uppercase; }
  footer b { color: var(--violet); }
  @page { size: A4; margin: 0; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .sheet { margin: 0; box-shadow: none; height: 297mm; page-break-after: always; break-after: page; }
    .sheet:last-of-type { page-break-after: auto; break-after: auto; }
  }
  @media screen and (max-width: 820px) {
    .sheet { width: auto; min-height: 0; margin: 16px; padding: 20px 16px; gap: 14px; }
    .grid { grid-template-columns: 1fr; }
    header { flex-direction: column; align-items: flex-start; }
    .kicker, h1 { text-align: left; }
  }`;

function sheetArticle(m) {
  const cs = m.cheatsheet;
  const templateItem = (it) => `<li><span>${esc(it)}</span><i></i></li>`;
  const items = cs.tool.items.map((it) => (cs.tool.kind === 'template' ? templateItem(it) : toolItem(cs.tool.kind, it))).join('');
  return `
  <article class="sheet">
    <header>
      <img src="../../assets/logo.png" alt="ExplAIn">
      <div><p class="kicker">${esc(partName(m))} · ${esc(m.label)} · Cheat sheet</p><h1>${esc(m.title)}</h1></div>
    </header>
    <div class="idea"><p>${esc(cs.big_idea)}</p><small>“${esc(m.quote)}”</small></div>
    <div class="grid">
      <section class="box dark"><h2>Ask on every project</h2><ol>${cs.ask.map((a) => `<li>${esc(a)}</li>`).join('')}</ol></section>
      <section class="box"><h2>Rules of thumb</h2><ul>${cs.rules.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>
    </div>
    <div class="grid">
      <section class="box flags"><h2>Red flags</h2><ul>${cs.red_flags.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>
      <section class="box"><h2>Key terms</h2><dl>${cs.terms.map((t) => `<dt>${esc(t.term)}</dt><dd>${esc(t.def)}</dd>`).join('')}</dl></section>
    </div>
    <section class="tool">
      <small>${cs.tool.kind === 'decision' ? 'Decision guide' : cs.tool.kind === 'template' ? 'Template' : 'Checklist'}</small>
      <h2>${esc(noDot(cs.tool.title))}</h2>
      <ul class="tool-${cs.tool.kind}">${items}</ul>
    </section>
    <footer><span>ExplAIn · ${esc(partName(m))}</span><span>Don’t just use AI. <b>Own it.</b></span></footer>
  </article>`;
}

function sheetPage(title, description, articles, toolbarLinks) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(clip(description))}">
  <link rel="icon" type="image/png" href="../../assets/icon.png">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <!-- Generated by course/_build/build.js — edit course/content/*.json, not this file. -->
  <style>${SHEET_CSS}
  </style>
</head>
<body>
  <div class="toolbar"><button type="button" onclick="window.print()">Print or save as PDF</button>${toolbarLinks}</div>
${articles}
</body>
</html>
`;
}

function buildCheatsheets() {
  fs.mkdirSync(SHEETS, { recursive: true });
  const withSheets = modules.filter((m) => m.cheatsheet);
  withSheets.forEach((m) => {
    fs.writeFileSync(path.join(SHEETS, `${partSlug(m)}.html`),
      sheetPage(`ExplAIn ${partName(m)} Cheat Sheet`,
        `The one-page ExplAIn cheat sheet for ${partName(m)}, ${m.title}: the questions to ask, the rules of thumb, the red flags and one tool to use on your own project.`,
        sheetArticle(m), `<a class="ghost" href="index.html">All cheat sheets</a>`));
  });
  fs.writeFileSync(path.join(SHEETS, 'index.html'),
    sheetPage('ExplAIn Course Cheat Sheets',
      `All ${withSheets.length} ExplAIn cheat sheets on one page: the questions, the rules of thumb, the red flags and the tool for every module, ready to print or save as a PDF.`,
      withSheets.map(sheetArticle).join('\n'), ''));
  // Workbook reads this to show each module's cheat sheet.
  const data = Object.fromEntries(withSheets.map((m) => [m.id, m.cheatsheet]));
  fs.writeFileSync(path.join(SHEETS, 'data.js'), `// Generated by course/_build/build.js\nwindow.EXPLAIN_CHEATSHEETS = ${JSON.stringify(data, null, 1)};\n`);
  return withSheets.length;
}

// ---------------------------------------------------------------- Certificate template (editable PowerPoint, A4 landscape)
function buildCertificateTemplate() {
  const pres = new pptxgen();
  pres.defineLayout({ name: 'A4_LANDSCAPE', width: 11.69, height: 8.27 });
  pres.layout = 'A4_LANDSCAPE';
  pres.author = 'Katia Stainfeld Huri';
  pres.title = 'ExplAIn Certificate of Completion';
  const slide = pres.addSlide();
  slide.background = { color: C.white };
  const t = (value, o) => slide.addText(value, { fontFace: FONT, margin: 0, isTextBox: true, align: 'center', valign: 'middle', x: 0.9, w: 9.89, ...o });

  // Corner diamonds and frame
  slide.addShape(pres.shapes.RECTANGLE, { x: -1.25, y: 6.45, w: 2.45, h: 2.45, rotate: 45, fill: { type: 'none' }, line: { color: C.blue, width: 26, transparency: 87 } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 10.49, y: 6.45, w: 2.45, h: 2.45, rotate: 45, fill: { type: 'none' }, line: { color: C.violet, width: 26, transparency: 87 } });
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.35, y: 0.35, w: 10.99, h: 7.57, rectRadius: 0.22, fill: { type: 'none' }, line: { color: 'D9DEEA', width: 1 } });
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.44, y: 0.44, w: 10.81, h: 7.39, rectRadius: 0.17, fill: { type: 'none' }, line: { color: 'EBE7FD', width: 1 } });

  slide.addImage({ path: LOGO_NAVY, x: 11.69 / 2 - 0.8, y: 0.8, w: 1.6, h: 0.59 });
  t('CERTIFICATE', { y: 1.65, h: 0.7, fontSize: 36, bold: true, charSpacing: 8, color: '5B3FD9' });
  t('OF COMPLETION', { y: 2.35, h: 0.3, fontSize: 11, bold: true, charSpacing: 6, color: '3B4A8A' });
  t('This certifies that', { y: 2.95, h: 0.3, fontSize: 11, color: '667085' });
  t('Participant Name', { y: 3.3, h: 0.75, fontSize: 32, fontFace: 'Georgia', color: C.navy });
  slide.addShape(pres.shapes.LINE, { x: 11.69 / 2 - 3, y: 4.1, w: 6, h: 0, line: { color: '7E8798', width: 0.75 } });
  t('has successfully completed the professional course', { y: 4.3, h: 0.3, fontSize: 11, color: '667085' });
  t('ExplAIn — Understanding and Building AI Systems', { y: 4.62, h: 0.45, fontSize: 17, bold: true, color: C.navy });
  t('20 LEARNING HOURS · 8 LIVE SESSIONS · CAPSTONE COMPLETED', { y: 5.12, h: 0.3, fontSize: 9, bold: true, charSpacing: 1.5, color: C.violet });
  t('Organization · Cohort', { y: 5.45, h: 0.3, fontSize: 10, color: '667085' });

  const sig = (x, value, label) => {
    slide.addText(value, { fontFace: FONT, margin: 0, isTextBox: true, align: 'center', x, y: 6.3, w: 2.9, h: 0.3, fontSize: 11, color: C.navy });
    slide.addShape(pres.shapes.LINE, { x, y: 6.66, w: 2.9, h: 0, line: { color: '7E8798', width: 0.75 } });
    slide.addText(label, { fontFace: FONT, margin: 0, isTextBox: true, align: 'center', x, y: 6.72, w: 2.9, h: 0.3, fontSize: 10, bold: true, color: C.navy });
  };
  sig(1.6, 'DD Month YYYY', 'Date');
  sig(7.19, 'Katia Stainfeld Huri', 'Course creator & instructor');
  slide.addImage({ path: path.join(ROOT, 'assets', 'icon.png'), x: 11.69 / 2 - 0.45, y: 6.15, w: 0.9, h: 0.9 });
  t('CERTIFICATE ID  EXP-0000-000', { y: 7.45, h: 0.25, fontSize: 7, charSpacing: 3, color: '9AA3B5' });
  slide.addNotes('Replace the participant name, organization, date and certificate ID. For many certificates at once, use course/certificate/index.html instead.');

  fs.mkdirSync(path.join(COURSE, 'certificate'), { recursive: true });
  return pres.writeFile({ fileName: path.join(COURSE, 'certificate', 'ExplAIn-Certificate-Template.pptx') });
}

// ---------------------------------------------------------------- Materials hub
function buildHub() {
  const rows = modules.map((m) => `
      <tr>
        <td><span class="num">${m.num}</span></td>
        <td><b>${m.part ? `Part ${m.part} · ` : ''}${esc(m.title)}</b><small>${esc(m.quote)}</small></td>
        <td><a href="${partSlug(m)}/${deckName(m)}">Slides (.pptx)</a></td>
        <td><a href="${partSlug(m)}/${scriptName(m)}">Facilitator script (.docx)</a></td>
        <td><a href="../${partSlug(m)}.html">Module page</a> · <a href="workbook.html#${anchorOf(m)}">Workbook</a></td>
      </tr>`).join('');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ExplAIn Course Materials</title>
  <meta name="robots" content="noindex">
  <link rel="icon" type="image/png" href="../assets/icon.png">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <!-- Generated by course/_build/build.js — do not edit by hand. -->
  <style>
    :root { color-scheme: light; }
    body { margin: 0; color: #3f4859; background: #f8fafc; font-family: Poppins, ui-sans-serif, system-ui, sans-serif; }
    header { color: #fff; background: #0b1026; }
    .shell { width: min(1120px, calc(100% - 32px)); margin: auto; }
    header .shell { display: flex; align-items: center; gap: 16px; min-height: 72px; }
    header img { height: 42px; }
    header span { padding-left: 16px; border-left: 1px solid rgba(255,255,255,.2); color: #c9d0e4; font-size: 14px; }
    h1 { margin: 40px 0 6px; color: #0b1026; font-size: 34px; letter-spacing: -.03em; }
    p.lead { margin: 0 0 26px; color: #667085; }
    .wrap { overflow-x: auto; border: 1px solid #e4e8f1; border-radius: 18px; background: #fff; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 14px 16px; text-align: left; vertical-align: middle; border-top: 1px solid #e4e8f1; }
    th { border-top: 0; color: #4c1d95; background: #ede9fe; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
    td small { display: block; color: #7c3aed; }
    td b { color: #0b1026; }
    .num { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; color: #fff; background: #121a3a; font-weight: 600; font-size: 12px; }
    a { color: #6d28d9; font-weight: 500; }
    .extras { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin: 22px 0 60px; }
    .extras a { display: block; padding: 20px; border: 1px solid #e4e8f1; border-radius: 16px; background: #fff; text-decoration: none; }
    .extras a span { display: block; color: #667085; font-weight: 400; font-size: 13px; }
  </style>
</head>
<body>
  <header><div class="shell"><img src="../assets/logo-white.png" alt="ExplAIn"><span>Course materials · instructor</span></div></header>
  <main class="shell">
    <h1>Course materials</h1>
    <p class="lead">Ten modules. Modules 00 and 01 run 1 hour each; the rest run 2 hours. Each has a slide deck with speaker notes, a facilitator script and a public module page.</p>
    <div class="wrap"><table>
      <tr><th></th><th>Module</th><th>Deck</th><th>Script</th><th>Participants</th></tr>${rows}
    </table></div>
    <div class="extras">
      <a href="workbook.html">Course workbook<span>One fillable form for every exercise, the capstone and a printable summary.</span></a>
      <a href="cheatsheets/ExplAIn-Course-Cheat-Sheets.pdf">Cheat sheets (PDF)<span>One page per module: questions, rules of thumb, red flags, terms and a working tool.</span></a>
      <a href="certificate/index.html">Certificates<span>Type the names of participants who completed the course and print their certificates.</span></a>
      <a href="module-00-part-2/worksheet.html">Module 00 Part 2 printable worksheet<span>Paper version of the system map.</span></a>
      <a href="module-00/deck.html">Module 00 Part 1 web deck<span>The free deck, as the public sees it. Published with the site.</span></a>
      <a href="../syllabus.html">Full syllabus<span>The public syllabus page.</span></a>
    </div>
  </main>
</body>
</html>
`;
  fs.writeFileSync(path.join(COURSE, 'index.html'), html);
}

// node build.js                   everything
// node build.js --pages           only the public module pages
// node build.js --pages module-03 only that one page
const argv = process.argv.slice(2);
const PAGES_ONLY = argv.includes('--pages');
const ONLY = argv.find((a) => /^module-/.test(a)) || null;

(async () => {
  for (const [i, m] of modules.entries()) {
    if (ONLY && partSlug(m) !== ONLY) continue;
    if (!PAGES_ONLY) {
      fs.mkdirSync(moduleDir(m), { recursive: true });
      await buildDeck(m, i);
      await buildScript(m);
      for (const lang of Object.keys(m.translations)) {
        await buildScript(m, lang);
        console.log(`✓ ${partName(m)}: ${scriptName(m, lang)}`);
      }
    }
    buildPage(m, i);
    if (m.web_deck) {
      fs.writeFileSync(path.join(moduleDir(m), 'deck.html'), buildWebDeck(m, { esc, mapBoxes: MAP_BOXES, partName, partSlug, clip }));
      console.log(`✓ ${partName(m)}: free web deck at course/${partSlug(m)}/deck.html`);
    }
    console.log(PAGES_ONLY ? `✓ ${partSlug(m)}.html` : `✓ ${partName(m)}: ${deckName(m)}, ${scriptName(m)}, ${partSlug(m)}.html`);
  }
  if (!PAGES_ONLY) {
    console.log(`✓ ${buildCheatsheets()} cheat sheets in course/cheatsheets/`);
    await buildCertificateTemplate();
    console.log('✓ course/certificate/ExplAIn-Certificate-Template.pptx');
    buildHub();
    console.log('✓ course/index.html');
  }
})().catch((e) => { console.error(e); process.exit(1); });
