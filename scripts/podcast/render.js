// Renders a written episode into a finished MP3:
//   course/podcast/scripts/NN-slug.md     in   (two-voice dialogue)
//   course/podcast/audio/NN/<hash>.mp3    cache, one file per spoken turn
//   course/podcast/dist/NN-slug.mp3       out  (stitched, loudness-normalised)
//   course/podcast/dist/NN-slug.txt       out  (transcript for the show notes)
//
// Turns are cached by the hash of their text and voice, so re-rendering after an
// edit only pays for the turns that changed.
//
// Usage: node scripts/podcast/render.js 01             render episode 01
//        node scripts/podcast/render.js all            every written episode
//        node scripts/podcast/render.js 01 --check     validate only, no API calls
//        node scripts/podcast/render.js --voices       list the provider's voices
//        node scripts/podcast/render.js 01 --force     ignore the cache
//
// Keys live in .env.local (gitignored):
//   TTS_PROVIDER=azure            or openai
//   AZURE_SPEECH_KEY=...          AZURE_SPEECH_REGION=westeurope
//   OPENAI_API_KEY=...            OPENAI_TTS_MODEL=gpt-4o-mini-tts
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
try { process.loadEnvFile(path.join(ROOT, '.env.local')); } catch { /* no local env, fine */ }

const CAST = JSON.parse(fs.readFileSync(path.join(__dirname, 'cast.json'), 'utf8'));
const DIR = {
  scripts: path.join(ROOT, 'course/podcast/scripts'),
  audio: path.join(ROOT, 'course/podcast/audio'),
  dist: path.join(ROOT, 'course/podcast/dist'),
};
const PROVIDER = (process.env.TTS_PROVIDER || 'azure').toLowerCase();
// Rough, and it moves: check your provider's current price before trusting it.
const PRICE_PER_MILLION_CHARS = 15;
const WORDS_PER_MINUTE = 150;
const GAP_MS = 420; // silence between turns; a real conversation breathes

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const targets = args.filter((a) => !a.startsWith('--'));
const die = (msg) => { console.error(`\n${msg}\n`); process.exit(1); };

// ---------- script parsing ----------

function parseScript(file) {
  const text = fs.readFileSync(file, 'utf8');
  const meta = {};
  let body = text;
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (fm) {
    for (const line of fm[1].split(/\r?\n/)) {
      const m = line.match(/^(\w+):\s*"?(.*?)"?\s*$/);
      if (m) meta[m[1]] = m[2];
    }
    body = text.slice(fm[0].length);
  }
  const turns = [];
  const problems = [];
  for (const raw of body.split(/\r?\n\s*\r?\n/)) {
    const block = raw.split(/\r?\n/).filter((l) => !l.trim().startsWith('#')).join(' ').trim();
    if (!block) continue;
    const pause = block.match(/^\[\[pause\s+(\d+)\]\]$/i);
    if (pause) { turns.push({ kind: 'pause', ms: Number(pause[1]) }); continue; }
    const speech = block.match(/^(HOST|GUEST):\s*([\s\S]+)$/);
    if (!speech) { problems.push(`not a turn: ${block.slice(0, 70)}`); continue; }
    const line = speech[2].replace(/\s+/g, ' ').trim();
    if (/\bslides?\b/i.test(line)) problems.push(`mentions a slide: ${line.slice(0, 70)}`);
    turns.push({ kind: 'speech', speaker: speech[1], text: line });
  }
  return { meta, turns, problems };
}

function voiceFor(episode, speaker) {
  const who = speaker === 'HOST' ? CAST.host : episode.guest;
  const id = who.voice[PROVIDER];
  if (!id) die(`No ${PROVIDER} voice set for ${who.name} in cast.json.`);
  return { id, rate: who.rate || '+0%', name: who.name };
}

// ---------- text to speech ----------

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

async function speakAzure(text, voice) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) die('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env.local');
  const ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">'
    + `<voice name="${voice.id}"><prosody rate="${voice.rate}">${esc(text)}</prosody></voice></speak>`;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml; charset=utf-8',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'explain-podcast',
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`Azure ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function speakOpenAI(text, voice) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) die('Set OPENAI_API_KEY in .env.local');
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voice: voice.id,
      input: text,
      response_format: 'mp3',
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function speak(text, voice) {
  const fn = PROVIDER === 'openai' ? speakOpenAI : speakAzure;
  let wait = 1500;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(text, voice);
    } catch (err) {
      if (attempt >= 4) throw err;
      process.stdout.write(` retry(${attempt}) `);
      await new Promise((r) => setTimeout(r, wait));
      wait *= 2;
    }
  }
}

async function listVoices() {
  if (PROVIDER !== 'azure') {
    console.log('OpenAI voice ids are listed in its text-to-speech docs. The ones cast.json uses:');
    const used = new Set([CAST.host.voice.openai, ...CAST.episodes.map((e) => e.guest.voice.openai)]);
    console.log([...used].join(', '));
    return;
  }
  const region = process.env.AZURE_SPEECH_REGION;
  const key = process.env.AZURE_SPEECH_KEY;
  if (!key || !region) die('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env.local');
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
    { headers: { 'Ocp-Apim-Subscription-Key': key } });
  if (!res.ok) die(`Azure ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const voices = (await res.json()).filter((v) => v.Locale.startsWith('en-'));
  for (const v of voices) console.log(`${v.ShortName.padEnd(34)} ${v.Gender.padEnd(7)} ${v.Locale}`);
  console.log(`\n${voices.length} English voices. Put the ShortName in cast.json.`);
}

// ---------- stitching ----------

// ffmpeg is often installed but not on PATH on Windows, so look where winget
// puts it before giving up. Set FFMPEG in .env.local to override.
let FFMPEG = null;
function findFfmpeg() {
  if (FFMPEG) return FFMPEG;
  const candidates = [process.env.FFMPEG, 'ffmpeg'].filter(Boolean);
  const winget = path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages');
  if (fs.existsSync(winget)) {
    for (const pkg of fs.readdirSync(winget).filter((d) => /ffmpeg/i.test(d))) {
      for (const build of fs.readdirSync(path.join(winget, pkg))) {
        candidates.push(path.join(winget, pkg, build, 'bin/ffmpeg.exe'));
      }
    }
  }
  for (const exe of candidates) {
    if (spawnSync(exe, ['-version'], { stdio: 'ignore' }).status === 0) {
      FFMPEG = exe;
      return exe;
    }
  }
  return null;
}

function silenceFile(ms) {
  const file = path.join(DIR.audio, `_silence-${ms}.mp3`);
  if (!fs.existsSync(file)) {
    execFileSync(findFfmpeg(), ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono',
      '-t', String(ms / 1000), '-c:a', 'libmp3lame', '-b:a', '48k', file], { stdio: 'ignore' });
  }
  return file;
}

function stitch(parts, out) {
  const list = path.join(DIR.audio, `_concat-${path.basename(out, '.mp3')}.txt`);
  fs.writeFileSync(list, parts.map((p) => `file '${p.split(path.sep).join('/')}'`).join('\n'));
  execFileSync(findFfmpeg(), ['-y', '-loglevel', 'error', '-nostats', '-f', 'concat', '-safe', '0', '-i', list,
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'libmp3lame', '-b:a', '128k', out],
    { stdio: ['ignore', 'ignore', 'inherit'] });
  fs.unlinkSync(list);
}

// ---------- per episode ----------

async function renderEpisode(episode) {
  const file = path.join(DIR.scripts, `${episode.number}-${episode.slug}.md`);
  if (!fs.existsSync(file)) {
    console.log(`${episode.number}  no script yet - write it with /podcast-write ${episode.number}`);
    return;
  }
  const { turns, problems } = parseScript(file);
  const speech = turns.filter((t) => t.kind === 'speech');
  const words = speech.reduce((n, t) => n + t.text.split(' ').length, 0);
  const chars = speech.reduce((n, t) => n + t.text.length, 0);
  const hostTurns = speech.filter((t) => t.speaker === 'HOST').length;

  console.log(`\n${episode.number}  ${episode.title}`);
  console.log(`    guest ${episode.guest.name}, ${speech.length} turns`
    + ` (${hostTurns} host, ${speech.length - hostTurns} guest)`);
  console.log(`    ${words} words, about ${(words / WORDS_PER_MINUTE).toFixed(0)} minutes,`
    + ` ${chars} characters, about $${(chars / 1e6 * PRICE_PER_MILLION_CHARS).toFixed(2)} on ${PROVIDER}`);
  for (const p of problems) console.log(`    PROBLEM  ${p}`);
  if (problems.length) die(`Episode ${episode.number} has ${problems.length} problem(s). Fix the script first.`);
  if (flag('check')) return;
  if (!findFfmpeg()) die('ffmpeg is needed for stitching and was not found:\n  winget install Gyan.FFmpeg');

  const cacheDir = path.join(DIR.audio, episode.number);
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(DIR.dist, { recursive: true });

  const parts = [];
  let fresh = 0;
  for (const turn of turns) {
    if (turn.kind === 'pause') { parts.push(silenceFile(turn.ms)); continue; }
    const voice = voiceFor(episode, turn.speaker);
    const key = crypto.createHash('sha256')
      .update([PROVIDER, voice.id, voice.rate, turn.text].join('|')).digest('hex').slice(0, 16);
    const part = path.join(cacheDir, `${key}.mp3`);
    if (flag('force') || !fs.existsSync(part)) {
      fs.writeFileSync(part, await speak(turn.text, voice));
      fresh++;
      process.stdout.write('.');
    }
    parts.push(part, silenceFile(GAP_MS));
  }
  parts.pop();
  console.log(`\n    ${fresh} turns rendered, ${speech.length - fresh} from cache`);

  const out = path.join(DIR.dist, `${episode.number}-${episode.slug}.mp3`);
  stitch(parts, out);

  const transcript = [
    `${CAST.show.title} - Episode ${episode.number}: ${episode.title}`,
    episode.one_line,
    `Host ${CAST.host.name}. Guest ${episode.guest.name}.`,
    CAST.show.disclosure,
    '',
    ...speech.map((t) => `${t.speaker === 'HOST' ? CAST.host.name : episode.guest.name}: ${t.text}`),
  ].join('\n\n');
  fs.writeFileSync(path.join(DIR.dist, `${episode.number}-${episode.slug}.txt`), `${transcript}\n`);
  console.log(`    ${path.relative(ROOT, out)}  ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`);
}

(async () => {
  if (flag('voices')) return listVoices();
  const wanted = targets.includes('all') || !targets.length
    ? CAST.episodes
    : CAST.episodes.filter((e) => targets.includes(e.number));
  if (!wanted.length) die(`No episode matches ${targets.join(' ')}. Numbers run 01 to 10.`);
  for (const episode of wanted) await renderEpisode(episode);
})().catch((err) => die(err.stack || String(err)));
