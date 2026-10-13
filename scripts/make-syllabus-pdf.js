// Renders the syllabus page to ExplAIn-Syllabus.pdf, certificate included.
//
//   npm run pdf
//
// Starts the site server on a spare port, prints the page with headless Edge
// (or Chrome), then shuts the server down again.
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'ExplAIn-Syllabus.pdf');

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = (message) => { console.error(message); process.exit(1); };

const browser = BROWSERS.find((p) => fs.existsSync(p));
if (!browser) fail('Could not find Edge or Chrome. Install one, or add its path to BROWSERS.');

// A free port each run, so a previous run still letting go of one cannot clash.
const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.on('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

let server = null;
let running = false;
// Killing a child that has already exited can trip a libuv assertion, so only
// kill one we know is alive.
const stop = () => { if (running && server) { running = false; try { server.kill(); } catch {} } };

async function waitForServer(PORT) {
  for (let i = 0; i < 40; i += 1) {
    try {
      if ((await fetch(`http://localhost:${PORT}/api/health`)).ok) return true;
    } catch {}
    await sleep(250);
  }
  return false;
}

// Edge returns before the file is fully on disk, so wait for its size to settle.
async function waitForFile(file) {
  let last = -1;
  for (let i = 0; i < 40; i += 1) {
    await sleep(250);
    const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    if (size > 50_000 && size === last) return size;
    last = size;
  }
  return 0;
}

(async () => {
  const PORT = await freePort();
  server = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js'), `--port=${PORT}`], { stdio: 'ignore' });
  running = true;
  server.on('exit', () => { running = false; });

  if (!(await waitForServer(PORT))) { stop(); fail(`The site server did not come up on port ${PORT}.`); }

  fs.rmSync(OUT, { force: true });
  // Its own profile directory: without one, Edge hands the request to an
  // already-running instance and exits 0 without printing anything.
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'explain-pdf-'));
  const result = spawnSync(browser, [
    '--headless', '--disable-gpu', '--no-pdf-header-footer',
    `--user-data-dir=${profile}`,
    '--virtual-time-budget=15000',
    // Edge ignores a forward-slash target without reporting an error.
    `--print-to-pdf=${OUT.split('/').join(path.sep)}`,
    `http://localhost:${PORT}/syllabus.html?print=1`,
  ], { stdio: 'ignore' });

  const size = result.error ? 0 : await waitForFile(OUT);
  stop();
  fs.rmSync(profile, { recursive: true, force: true });

  if (!size) fail(`Could not create the PDF. ${result.error || `(${path.basename(browser)} exited ${result.status})`}`);
  console.log(`Wrote ${path.relative(ROOT, OUT)} - ${(size / 1024 / 1024).toFixed(1)} MB`);
})();
