// Telegram's webhook for the Instagram agent.
//
// Why this exists at all: the agent runs on GitHub Actions cron, which fires
// roughly hourly and sometimes skips entirely, so a tap on Approve waited
// between twenty minutes and two hours before anything happened. Telegram
// will instead post the update here the moment it is made, and a Vercel
// function answers in milliseconds.
//
// Why it lives in the website repo rather than the agent's: it has to be a
// public HTTPS endpoint, and this is the only thing already deployed. It is
// CommonJS because every other file in api/ is, and adding "type": "module"
// to this package would break all of them.
//
// What it is allowed to do is deliberately small. Approving or rejecting a
// post is one compare-and-swap against a status, which is safe to do from an
// endpoint the internet can reach. Everything else — drafted replies, typed
// commands — is written to a queue and left for the agent, which has the
// Instagram token. This function never touches Instagram.
//
// IMPORTANT, and the reason this is more than one file: registering a webhook
// disables getUpdates. The agent cannot poll any more, so anything this
// function does not store is lost. That is what ig_telegram_updates is for.
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

const CONNECTION = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const BOT = process.env.TELEGRAM_BOT_TOKEN || '';

// Mirrors TRANSITIONS in the agent's src/lib/schema.js. Only the one move
// this endpoint is allowed to make is listed; anything else belongs to the
// agent, which owns the full machine.
const FROM = 'awaiting_review';

let ready = null;

function connect() {
  if (!CONNECTION) throw new Error('No database configured');
  const db = neon(CONNECTION);
  // The agent owns ig_posts and creates it. This table is the queue for
  // everything the webhook will not handle itself, so it is created here.
  ready = ready || db`
    CREATE TABLE IF NOT EXISTS ig_telegram_updates (
      update_id   BIGINT PRIMARY KEY,
      payload     JSONB NOT NULL,
      handled     BOOLEAN NOT NULL DEFAULT FALSE,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  return ready.then(() => db);
}

/**
 * Is this really Telegram?
 *
 * The secret is set when the webhook is registered and comes back on every
 * request. Compared in constant time, and length-checked first because
 * timingSafeEqual throws on a mismatch rather than returning false.
 */
function authentic(req) {
  const given = String(req.headers['x-telegram-bot-api-secret-token'] || '');
  if (!SECRET || given.length !== SECRET.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(SECRET));
}

/** Telegram's API, for the two calls that close the loop on a tap. */
async function telegram(method, body) {
  if (!BOT) return null;
  const response = await fetch(`https://api.telegram.org/bot${BOT}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json().catch(() => null);
}

/**
 * Apply a tap on Approve or Reject.
 *
 * The UPDATE carries its own expected status, so two taps race safely: the
 * first changes a row, the second changes none and is told why. There are no
 * transactions on a Neon HTTP connection, which is exactly why the condition
 * lives in the statement.
 */
async function decide(db, query, action, postId) {
  const [post] = await db`SELECT id, status, telegram_msg FROM ig_posts WHERE id = ${postId}`;

  const say = async (toast, message) => {
    await telegram('answerCallbackQuery', { callback_query_id: query.id, text: toast });
    // The toast expires in about fifteen seconds and is easy to miss, so
    // anything worth knowing is also said in the chat, where it stays.
    if (message) {
      await telegram('sendMessage', { chat_id: query.message.chat.id, text: message, parse_mode: 'HTML' });
    }
  };

  if (!post) {
    await say('That post is gone.', `<b>Post ${postId} is gone.</b> Nothing on record, so that tap did nothing.`);
    return { postId, outcome: 'missing' };
  }

  if (post.status !== FROM) {
    await say(
      `Already ${post.status}.`,
      `<b>Post ${postId} is ${post.status}.</b> Only a post awaiting review can be answered, so that tap did nothing.`,
    );
    return { postId, outcome: `was-${post.status}` };
  }

  const to = action === 'approve' ? 'approved' : 'vetoed';
  const [moved] = await db`
    UPDATE ig_posts
       SET status = ${to}, reviewed_at = NOW(), reviewed_how = 'telegram', updated_at = NOW()
     WHERE id = ${postId} AND status = ${FROM}
     RETURNING id`;

  if (!moved) {
    await say('Someone got there first.', `<b>Post ${postId} changed while you were tapping.</b> Nothing was applied.`);
    return { postId, outcome: 'raced' };
  }

  await telegram('answerCallbackQuery', {
    callback_query_id: query.id,
    text: to === 'approved' ? 'In the bank' : 'Rejected',
  });

  // Rewriting the original message is the feedback that actually lands: it
  // replaces the buttons, so the post cannot be answered twice, and it is
  // still there when she scrolls back.
  if (post.telegram_msg) {
    await telegram('editMessageText', {
      chat_id: query.message.chat.id,
      message_id: Number(post.telegram_msg),
      parse_mode: 'HTML',
      text: to === 'approved'
        ? `<b>Approved.</b> In the bank, post ${postId}.`
        : `<b>Rejected.</b> Post ${postId} will not go out.`,
    });
  }

  return { postId, outcome: to };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  // An unauthenticated caller is told nothing it can learn from, and the
  // update is not read at all.
  if (!authentic(req)) {
    res.status(401).json({ error: 'no' });
    return;
  }

  const update = req.body && typeof req.body === 'object' ? req.body : {};
  const updateId = Number(update.update_id);
  if (!Number.isFinite(updateId)) {
    // Telegram retries anything that is not a 200, so a malformed update has
    // to be accepted or it comes back forever.
    res.status(200).json({ ok: true, ignored: 'no update_id' });
    return;
  }

  try {
    const db = await connect();

    // Telegram re-delivers an update until it gets a 200, so the same tap can
    // arrive twice. The primary key makes the second one a no-op and tells us
    // it was a repeat, which is cheaper than doing the work again.
    const stored = await db`
      INSERT INTO ig_telegram_updates (update_id, payload)
      VALUES (${updateId}, ${JSON.stringify(update)}::jsonb)
      ON CONFLICT (update_id) DO NOTHING
      RETURNING update_id`;

    if (!stored.length) {
      res.status(200).json({ ok: true, duplicate: updateId });
      return;
    }

    const query = update.callback_query;
    const [action, id] = String(query?.data || '').split(':');
    const postId = Number(id);

    // Only post decisions are settled here. A drafted reply needs the
    // Instagram token, which this function does not have and should not get,
    // so it stays queued for the agent.
    if (query && ['approve', 'reject'].includes(action) && postId) {
      const result = await decide(db, query, action, postId);
      await db`UPDATE ig_telegram_updates SET handled = TRUE WHERE update_id = ${updateId}`;
      res.status(200).json({ ok: true, ...result });
      return;
    }

    res.status(200).json({ ok: true, queued: updateId });
  } catch (error) {
    // Still a 200. A 500 makes Telegram retry the same update for hours, and
    // the row is already stored, so the agent will pick it up regardless.
    console.error('tg-webhook', error.message);
    res.status(200).json({ ok: false, error: 'stored for the agent' });
  }
};
