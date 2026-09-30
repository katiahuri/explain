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
  `).catch((error) => { ready = null; throw error; });
  return ready.then(() => db);
}

// Visitors' IP addresses are only ever stored as a salted hash, for rate limiting.
const hashIp = (ip) => crypto.createHash('sha256').update(`${ip}${process.env.IP_SALT || 'explain'}`).digest('hex').slice(0, 32);

module.exports = { connect, hashIp };
