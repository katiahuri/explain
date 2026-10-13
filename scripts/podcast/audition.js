// Auditions candidate voices for a guest, using that guest's own lines.
//
// Renders a single labelled comparison file: each candidate is announced in the
// host's voice, then speaks the longest guest turns from the real episode, so
// you are judging the voice on the writing it will actually have to carry.
//
//   course/podcast/dist/audition-NN.mp3
//
// Usage: node scripts/podcast/audition.js 01                 the shortlist for that guest
//        node scripts/podcast/audition.js 01 --male           shortlist by gender
//        node scripts/podcast/audition.js 01 en-US-CoraMultilingualNeural,en-US-LolaMultilingualNeural
//
// Nothing is written to cast.json. Once you have picked one, set that guest's
// voice there and re-render the episode.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
try { process.loadEnvFile(path.join(ROOT, '.env.local')); } catch { /* no local env, fine */ }
const CAST = JSON.parse(fs.readFileSync(path.join(__dirname, 'cast.json'), 'utf8'));
const KEY = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION;
const SCRATCH = path.join(ROOT, 'course/podcast/audio/_audition');

// The multilingual voices only; the older generation is audibly flatter.
const SHORTLIST = {
  female: ['en-US-CoraMultilingualNeural', 'en-US-LolaMultilingualNeural', 'en-US-NovaMultilingualNeural',
    'en-US-ShimmerMultilingualNeural', 'en-US-AmandaMultilingualNeural', 'en-US-PhoebeMultilingualNeural'],
  male: ['en-US-AdamMultilingualNeural', 'en-US-DerekMultilingualNeural', 'en-US-LewisMultilingualNeural',
    'en-US-OnyxMultilingualNeural', 'en-US-ChristopherMultilingualNeural', 'en-US-RyanMultilingualNeural'],
};

const args = process.argv.slice(2);
const number = args.find((a) => !a.startsWith('--') && !a.includes(','));
const explicit = args.find((a) => a.includes(','));
const die = (m) => { console.error(`\n${m}\n`); process.exit(1); };

if (!KEY || !REGION) die('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env.local');
const episode = CAST.episodes.find((e) => e.number === number);
if (!episode) die(`No episode ${number}. Numbers: ${CAST.episodes.map((e) => e.number).join(', ')}`);

const voices = explicit ? explicit.split(',').map((v) => v.trim())
  : SHORTLIST[args.includes('--male') ? 'male' : 'female'];

function ffmpeg() {
  const winget = path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages');
  const candidates = [process.env.FFMPEG, 'ffmpeg'].filter(Boolean);
  if (fs.existsSync(winget)) {
    for (const pkg of fs.readdirSync(winget).filter((d) => /ffmpeg/i.test(d))) {
      for (const build of fs.readdirSync(path.join(winget, pkg))) {
        candidates.push(path.join(winget, pkg, build, 'bin/ffmpeg.exe'));
      }
    }
  }
  for (const exe of candidates) {
    if (spawnSync(exe, ['-version'], { stdio: 'ignore' }).status === 0) return exe;
  }
  return die('ffmpeg not found:\n  winget install Gyan.FFmpeg');
}

// The three longest guest turns: enough to hear sustained delivery, not just a greeting.
function guestLines(file) {
  const body = fs.readFileSync(file, 'utf8').replace(/^---[\s\S]*?---\r?\n/, '');
  return body.split(/\r?\n\s*\r?\n/)
    .map((b) => b.split(/\r?\n/).filter((l) => !l.trim().startsWith('#')).join(' ').trim())
    .filter((b) => b.startsWith('GUEST:'))
    .map((b) => b.replace(/^GUEST:\s*/, '').replace(/\s+/g, ' '))
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

async function speak(text, voice, file) {
  const ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">'
    + `<voice name="${voice}">${esc(text)}</voice></speak>`;
  const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': KEY,
      'Content-Type': 'application/ssml+xml; charset=utf-8',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'explain-podcast',
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`${voice}: Azure ${res.status} ${(await res.text()).slice(0, 160)}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

(async () => {
  const script = path.join(ROOT, 'course/podcast/scripts', `${episode.number}-${episode.slug}.md`);
  if (!fs.existsSync(script)) die(`No script for episode ${episode.number} yet.`);
  const lines = guestLines(script);
  if (!lines.length) die('No guest turns found in that script.');

  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'course/podcast/dist'), { recursive: true });
  const FF = ffmpeg();
  const silence = path.join(SCRATCH, 'silence.mp3');
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono',
    '-t', '0.7', '-c:a', 'libmp3lame', '-b:a', '48k', silence]);

  console.log(`\nAuditioning ${voices.length} voices for ${episode.guest.name} (episode ${episode.number})`);
  const parts = [];
  let n = 0;
  for (const voice of voices) {
    const short = voice.replace('en-US-', '').replace('MultilingualNeural', '').replace('Neural', '');
    const label = path.join(SCRATCH, `label-${n}.mp3`);
    await speak(`Option ${n + 1}. ${short}.`, CAST.host.voice.azure, label);
    parts.push(label, silence);
    for (const [i, line] of lines.entries()) {
      const clip = path.join(SCRATCH, `clip-${n}-${i}.mp3`);
      await speak(line, voice, clip);
      parts.push(clip, silence);
    }
    console.log(`  ${n + 1}. ${short}`);
    n++;
  }

  const list = path.join(SCRATCH, 'list.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p.split(path.sep).join('/')}'`).join('\n'));
  const out = path.join(ROOT, 'course/podcast/dist', `audition-${episode.number}.mp3`);
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'libmp3lame', '-b:a', '128k', out]);
  const chars = voices.length * lines.join(' ').length;
  console.log(`\n  ${path.relative(ROOT, out)}  about ${(chars / 1000).toFixed(0)} thousand characters used`);
})().catch((e) => die(e.stack || String(e)));
