// Shared database access for the waitlist endpoints.
// Vercel's Neon Postgres integration provides the connection string.
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

const CONNECTION = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

let ready = null;

function sql() {
  if (!CONNECTION) throw new Error('No database configured. Connect a Postgres store in the Vercel dashboard.');
  return neon(CONNECTION);
}

// Creates the tables on first use, then remembers that it did.
function connect() {
  const db = sql();
  ready = ready || db`
    CREATE TABLE IF NOT EXISTS signups (
      email       TEXT PRIMARY KEY,
      first_name  TEXT NOT NULL DEFAULT '',
      interest    TEXT NOT NULL DEFAULT 'individual',
      source      TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.then(() => db`
    CREATE TABLE IF NOT EXISTS signup_attempts (
      ip_hash TEXT NOT NULL,
      at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).then(() => db`
    CREATE TABLE IF NOT EXISTS pageviews (
      id            BIGSERIAL PRIMARY KEY,
      at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      path          TEXT NOT NULL,
      visit_id      TEXT NOT NULL DEFAULT '',
      is_landing    BOOLEAN NOT NULL DEFAULT FALSE,
      referrer_host TEXT NOT NULL DEFAULT '',
      source        TEXT NOT NULL DEFAULT '',
      medium        TEXT NOT NULL DEFAULT '',
      campaign      TEXT NOT NULL DEFAULT '',
      device        TEXT NOT NULL DEFAULT '',
      country       TEXT NOT NULL DEFAULT '',
      visitor_hash  TEXT NOT NULL DEFAULT ''
    )
  `).then(() => db`
    CREATE TABLE IF NOT EXISTS events (
      id       BIGSERIAL PRIMARY KEY,
      at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      name     TEXT NOT NULL,
      path     TEXT NOT NULL DEFAULT '',
      visit_id TEXT NOT NULL DEFAULT '',
      detail   TEXT NOT NULL DEFAULT ''
    )
  `).then(() => db`CREATE INDEX IF NOT EXISTS pageviews_at_idx ON pageviews (at)`)
    .then(() => db`CREATE INDEX IF NOT EXISTS pageviews_landing_idx ON pageviews (is_landing, at)`)
    .then(() => db`CREATE INDEX IF NOT EXISTS events_at_idx ON events (at)`)
    .catch((error) => { ready = null; throw error; });
  return ready.then(() => db);
}

// Visitors' IP addresses are only ever stored as a salted hash, for rate limiting.
const hashIp = (ip) => crypto.createHash('sha256').update(`${ip}${process.env.IP_SALT || 'explain'}`).digest('hex').slice(0, 32);

// Analytics counts people without identifying them: the hash includes the date,
// so it cannot be used to follow anyone from one day to the next.
const hashVisitor = (ip, agent, day) =>
  crypto.createHash('sha256').update(`${ip}|${agent}|${day}|${process.env.IP_SALT || 'explain'}`).digest('hex').slice(0, 32);

module.exports = { connect, hashIp, hashVisitor };
