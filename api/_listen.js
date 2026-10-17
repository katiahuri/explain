// The episode pass: a signed cookie that records one thing — this browser gave
// us an email. Nothing identifying travels in it, so a stolen cookie reveals
// no one; it only lets that browser stream the free episode.
const crypto = require('crypto');

const COOKIE = 'explain_listen';
const DAYS = 180;

// Set LISTEN_SECRET in the Vercel project. Without it the pass is still signed,
// but with a value an attacker could guess, so anyone could forge one.
const SECRET = process.env.LISTEN_SECRET || process.env.IP_SALT || 'explain-listen';

const sign = (body) => crypto.createHmac('sha256', SECRET).update(body).digest('base64url');

function issue() {
  const body = Buffer.from(JSON.stringify({ v: 1, x: Date.now() + DAYS * 86400000 })).toString('base64url');
  return `${body}.${sign(body)}`;
}

function valid(token) {
  const [body, mac] = String(token || '').split('.');
  if (!body || !mac) return false;
  const expected = sign(body);
  // timingSafeEqual throws when the lengths differ, so rule that out first.
  if (mac.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
  try {
    const { x } = JSON.parse(Buffer.from(body, 'base64url').toString());
    return typeof x === 'number' && x > Date.now();
  } catch {
    return false;
  }
}

function jar(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

const unlocked = (req) => valid(jar(req.headers.cookie)[COOKIE]);

// Secure is left off on plain http so the pass still works on localhost.
const passCookie = (req) => {
  const https = (req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https';
  return `${COOKIE}=${issue()}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; SameSite=Lax${https ? '; Secure' : ''}`;
};

module.exports = { COOKIE, unlocked, passCookie };
