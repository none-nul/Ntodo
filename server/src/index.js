const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const { accountPageHandler } = require('./account-page');
const { marketingPageHandler, windowsDownloadsPageHandler } = require('./marketing-pages');

function envNumber(name, fallback, min = Number.NEGATIVE_INFINITY) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.max(min, value) : fallback;
}

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://ntodo:ntodo_password@postgres:5432/ntodo';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ORIGINS || 'https://account.nonenull.top,https://ntodo.nonenull.top,https://www.nonenull.top')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 20);
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '';
const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY || '';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = envNumber('SMTP_PORT', 587, 1);
const SMTP_SECURE = /^true$/i.test(String(process.env.SMTP_SECURE || 'false'));
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'verify@nonenull.top';
const SMTP_TIMEOUT_MS = envNumber('SMTP_TIMEOUT_MS', 10 * 1000, 1000);
const SMTP_TLS_REJECT_UNAUTHORIZED = !/^false$/i.test(String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || 'true'));
const REGISTER_CODE_TTL_MINUTES = envNumber('REGISTER_CODE_TTL_MINUTES', 10, 1);
const REGISTER_CODE_MAX_ATTEMPTS = envNumber('REGISTER_CODE_MAX_ATTEMPTS', 5, 1);
const REGISTER_CODE_EMAIL_COOLDOWN_MS = envNumber('REGISTER_CODE_EMAIL_COOLDOWN_MS', 60 * 1000, 0);
const REGISTER_CODE_EMAIL_HOURLY_MAX = envNumber('REGISTER_CODE_EMAIL_HOURLY_MAX', 5, 1);
const DOWNLOAD_ROOT = process.env.DOWNLOAD_ROOT || path.join(__dirname, '..', 'downloads');

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();
app.set('trust proxy', 1);
const authRateBuckets = new Map();
let mailTransporter;

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '1mb' }));
app.get('/downloads/windows', windowsDownloadsPageHandler);
app.get('/downloads/windows/', windowsDownloadsPageHandler);
app.use(
  '/downloads',
  express.static(DOWNLOAD_ROOT, {
    fallthrough: false,
    setHeaders(res) {
      res.setHeader('Content-Disposition', 'attachment');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  })
);
app.get('/', marketingPageHandler, accountPageHandler, (_req, res) => {
  res.json({ ok: true, service: 'ntodo-sync', sites: ['www.nonenull.top', 'ntodo.nonenull.top', 'account.nonenull.top'] });
});

function uuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function badRequest(res, code, message, details) {
  return res.status(400).json({ error: { code, message, details } });
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function publicIp(req) {
  return String(req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '') || 'unknown';
}

function hashEmailCode(email, code) {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${normalizeEmail(email)}:${String(code || '').trim()}`)
    .digest('hex');
}

function mailer() {
  if (!SMTP_HOST) {
    const error = new Error('SMTP_HOST is not configured');
    error.code = 'MAIL_NOT_CONFIGURED';
    throw error;
  }
  if (!mailTransporter) {
    const transport = {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
      tls: {
        rejectUnauthorized: SMTP_TLS_REJECT_UNAUTHORIZED
      }
    };
    if (SMTP_USER || SMTP_PASS) {
      transport.auth = { user: SMTP_USER, pass: SMTP_PASS };
    }
    mailTransporter = nodemailer.createTransport(transport);
  }
  return mailTransporter;
}

function registerCodeMessage(code) {
  const text = [
    `Your Ntodo verification code is ${code}.`,
    '',
    `This code expires in ${REGISTER_CODE_TTL_MINUTES} minutes.`,
    'If you did not request this code, you can ignore this email.'
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17202a">
      <h2 style="margin:0 0 12px">Ntodo verification code</h2>
      <p>Your verification code is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${code}</p>
      <p>This code expires in ${REGISTER_CODE_TTL_MINUTES} minutes.</p>
      <p style="color:#667085">If you did not request this code, you can ignore this email.</p>
    </div>`;
  return { text, html };
}

async function sendRegisterCodeEmail(email, code) {
  const message = registerCodeMessage(code);
  await mailer().sendMail({
    from: SMTP_FROM,
    to: email,
    subject: 'Ntodo verification code',
    text: message.text,
    html: message.html
  });
}

async function verifyTurnstile(token, remoteIp) {
  if (!TURNSTILE_SECRET_KEY) {
    const error = new Error('TURNSTILE_SECRET_KEY is not configured');
    error.code = 'TURNSTILE_NOT_CONFIGURED';
    throw error;
  }
  if (!token) return { ok: false, details: ['missing-input-response'] };

  const body = new URLSearchParams({
    secret: TURNSTILE_SECRET_KEY,
    response: token
  });
  if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body
  });
  const data = await response.json().catch(() => null);
  return {
    ok: Boolean(response.ok && data?.success),
    details: data?.['error-codes'] || []
  };
}

function challengePageHtml() {
  const siteKey = TURNSTILE_SITE_KEY;
  const body = siteKey
    ? `<div class="cf-turnstile" data-sitekey="${escapeHtml(siteKey)}" data-callback="onTurnstileToken" data-theme="light"></div>`
    : '<p class="error">Turnstile site key is not configured.</p>';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ntodo Verification</title>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <style>
    body{margin:0;min-height:120px;display:grid;place-items:center;background:#fff;color:#111827;font-family:Arial,sans-serif}
    .error{margin:0;padding:12px;color:#b42318;font-size:13px}
  </style>
</head>
<body>
  ${body}
  <script>
    function onTurnstileToken(token) {
      try { window.parent && window.parent.postMessage({ type: 'NTODO_TURNSTILE_TOKEN', token: token }, '*'); } catch {}
      try { window.NtodoTurnstile && window.NtodoTurnstile.onToken(token); } catch {}
    }
  </script>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function enforceRegisterCodeEmailLimit(client, email) {
  const recent = await client.query(
    `SELECT created_at
     FROM email_verification_codes
     WHERE email = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [email]
  );
  if (recent.rowCount && Date.now() - new Date(recent.rows[0].created_at).getTime() < REGISTER_CODE_EMAIL_COOLDOWN_MS) {
    return { ok: false, code: 'CODE_RECENTLY_SENT', message: 'Please wait before requesting another code.' };
  }

  const hourly = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM email_verification_codes
     WHERE email = $1 AND created_at > now() - interval '1 hour'`,
    [email]
  );
  if (Number(hourly.rows[0]?.count || 0) >= REGISTER_CODE_EMAIL_HOURLY_MAX) {
    return { ok: false, code: 'CODE_RATE_LIMITED', message: 'Too many verification codes requested. Please try again later.' };
  }
  return { ok: true };
}

async function consumeRegisterCode(client, email, code) {
  const result = await client.query(
    `SELECT id, code_hash, attempts, expires_at
     FROM email_verification_codes
     WHERE email = $1 AND consumed_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE`,
    [email]
  );
  if (!result.rowCount) {
    return { ok: false, status: 400, code: 'INVALID_CODE', message: 'Invalid or expired verification code' };
  }

  const row = result.rows[0];
  const expired = new Date(row.expires_at).getTime() <= Date.now();
  if (expired) {
    await client.query('UPDATE email_verification_codes SET consumed_at = now() WHERE id = $1', [row.id]);
    return { ok: false, status: 400, code: 'CODE_EXPIRED', message: 'Verification code has expired' };
  }

  if (Number(row.attempts) >= REGISTER_CODE_MAX_ATTEMPTS) {
    await client.query('UPDATE email_verification_codes SET consumed_at = now() WHERE id = $1', [row.id]);
    return { ok: false, status: 429, code: 'CODE_ATTEMPTS_EXCEEDED', message: 'Too many verification attempts. Request a new code.' };
  }

  const expected = Buffer.from(row.code_hash, 'hex');
  const actual = Buffer.from(hashEmailCode(email, code), 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    const nextAttempts = Number(row.attempts) + 1;
    await client.query(
      `UPDATE email_verification_codes
       SET attempts = attempts + 1,
           consumed_at = CASE WHEN $2 >= $3 THEN now() ELSE consumed_at END
       WHERE id = $1`,
      [row.id, nextAttempts, REGISTER_CODE_MAX_ATTEMPTS]
    );
    return { ok: false, status: 400, code: 'INVALID_CODE', message: 'Invalid or expired verification code' };
  }

  await client.query('UPDATE email_verification_codes SET consumed_at = now() WHERE id = $1', [row.id]);
  return { ok: true };
}

function base64url(input) {
  return Buffer.from(JSON.stringify(input)).toString('base64url');
}

function signToken(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 };
  const unsigned = `${base64url(header)}.${base64url(body)}`;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(unsigned).digest('base64url');
  return `${unsigned}.${sig}`;
}

function verifyToken(token) {
  const [header, body, sig] = String(token || '').split('.');
  if (!header || !body || !sig) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, 'sha256').toString('hex');
  return `pbkdf2$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const [, salt, hash] = String(stored || '').split('$');
  if (!salt || !hash) return false;
  return crypto.timingSafeEqual(Buffer.from(hashPassword(password, salt).split('$')[2]), Buffer.from(hash));
}

async function auth(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const payload = verifyToken(token);
  if (!payload?.userId) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  req.userId = payload.userId;
  next();
}

function rateLimitAuth(req, res, next) {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const key = `${ip}:${req.path}`;
  const bucket = authRateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    authRateBuckets.set(key, { count: 1, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > AUTH_RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Please wait before trying again.'
      }
    });
  }
  return next();
}

async function upsertDevice(client, userId, device = {}) {
  const deviceId = uuid(device.device_id) ? device.device_id : crypto.randomUUID();
  await client.query(
    `INSERT INTO devices (id, user_id, device_name, platform, push_token, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (id) DO UPDATE SET
       device_name = EXCLUDED.device_name,
       platform = EXCLUDED.platform,
       push_token = EXCLUDED.push_token,
       last_seen_at = now()`,
    [deviceId, userId, device.device_name || null, device.platform || null, device.push_token || null]
  );
  return deviceId;
}

function timeValue(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function normalizeIncomingTime(value) {
  const time = timeValue(value);
  return time ? new Date(time).toISOString() : new Date().toISOString();
}

function rowToTodoPayload(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    note: row.note || '',
    completed: Boolean(row.completed),
    due_at: row.due_at,
    priority: Number(row.priority) || 0,
    list_id: row.list_id || null,
    sort_order: Number(row.sort_order) || 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at || null,
    version: Number(row.version) || 1,
    device_id: row.device_id,
    server_version: Number(row.server_version) || 0
  };
}
async function latestServerVersion(client, userId) {
  const result = await client.query('SELECT COALESCE(MAX(server_version), 0)::bigint AS version FROM sync_changes WHERE user_id = $1', [userId]);
  return Number(result.rows[0].version);
}

async function ensureDeviceBelongsToUser(client, userId, deviceId) {
  if (!uuid(deviceId)) return false;
  const result = await client.query('SELECT 1 FROM devices WHERE user_id = $1 AND id = $2', [userId, deviceId]);
  return result.rowCount > 0;
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'ntodo-sync' });
});

app.get('/auth/register/challenge', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(challengePageHtml());
});

app.post('/auth/register/code', rateLimitAuth, async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  const token = String(req.body.cf_turnstile_token || req.body.turnstile_token || '').trim();
  const ip = publicIp(req);

  if (!validEmail(email)) return badRequest(res, 'INVALID_EMAIL', 'Valid email is required');

  try {
    const turnstile = await verifyTurnstile(token, ip);
    if (!turnstile.ok) {
      return res.status(400).json({
        error: {
          code: 'TURNSTILE_FAILED',
          message: 'Human verification failed. Please try again.',
          details: turnstile.details
        }
      });
    }
  } catch (error) {
    if (error.code === 'TURNSTILE_NOT_CONFIGURED') {
      return res.status(500).json({ error: { code: 'TURNSTILE_NOT_CONFIGURED', message: 'Turnstile is not configured' } });
    }
    return next(error);
  }

  const client = await pool.connect();
  try {
    const limit = await enforceRegisterCodeEmailLimit(client, email);
    if (!limit.ok) {
      return res.status(429).json({ error: { code: limit.code, message: limit.message } });
    }

    const existing = await client.query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (existing.rowCount) {
      return res.json({
        ok: true,
        message: 'If this email can be registered, a verification code will be sent.'
      });
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const inserted = await client.query(
      `INSERT INTO email_verification_codes (email, code_hash, sent_ip, expires_at)
       VALUES ($1, $2, $3, now() + ($4::text || ' minutes')::interval)
       RETURNING id`,
      [email, hashEmailCode(email, code), ip, REGISTER_CODE_TTL_MINUTES]
    );

    try {
      await sendRegisterCodeEmail(email, code);
    } catch (error) {
      await client.query('UPDATE email_verification_codes SET consumed_at = now() WHERE id = $1', [inserted.rows[0].id]).catch(() => {});
      console.error('Verification email send failed', {
        code: error.code,
        command: error.command,
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        message: error.message
      });
      if (error.code === 'MAIL_NOT_CONFIGURED') {
        return res.status(500).json({ error: { code: 'MAIL_NOT_CONFIGURED', message: 'SMTP is not configured' } });
      }
      return res.status(502).json({ error: { code: 'MAIL_SEND_FAILED', message: 'Verification email could not be sent', details: { reason: error.code || 'SMTP_ERROR' } } });
    }

    res.json({
      ok: true,
      expires_in_seconds: REGISTER_CODE_TTL_MINUTES * 60,
      message: 'Verification code sent.'
    });
  } catch (error) {
    next(error);
  } finally {
    client.release();
  }
});

app.post('/auth/register', rateLimitAuth, async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const name = String(req.body.name || '').trim() || null;
  const code = String(req.body.code || '').trim();
  if (!validEmail(email)) return badRequest(res, 'INVALID_EMAIL', 'Valid email is required');
  if (password.length < 8) return badRequest(res, 'WEAK_PASSWORD', 'Password must be at least 8 characters');
  if (!/^\d{6}$/.test(code)) return badRequest(res, 'INVALID_CODE', 'Verification code is required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const verification = await consumeRegisterCode(client, email, code);
    if (!verification.ok) {
      await client.query('COMMIT');
      return res.status(verification.status).json({
        error: { code: verification.code, message: verification.message }
      });
    }
    const user = await client.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashPassword(password), name]
    );
    const deviceId = await upsertDevice(client, user.rows[0].id, req.body.device || {});
    await client.query('COMMIT');
    res.json({
      user: user.rows[0],
      device_id: deviceId,
      access_token: signToken({ userId: user.rows[0].id }),
      last_server_version: 0
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } });
    next(error);
  } finally {
    client.release();
  }
});

app.post('/auth/login', rateLimitAuth, async (req, res, next) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const client = await pool.connect();
  try {
    const user = await client.query('SELECT id, email, name, password_hash FROM users WHERE email = $1', [email]);
    if (!user.rowCount || !verifyPassword(password, user.rows[0].password_hash)) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    const deviceId = await upsertDevice(client, user.rows[0].id, req.body.device || {});
    const version = await latestServerVersion(client, user.rows[0].id);
    res.json({
      user: { id: user.rows[0].id, email: user.rows[0].email, name: user.rows[0].name },
      device_id: deviceId,
      access_token: signToken({ userId: user.rows[0].id }),
      last_server_version: version
    });
  } catch (error) {
    next(error);
  } finally {
    client.release();
  }
});

app.get('/auth/me', auth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [req.userId]);
    if (!result.rowCount) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    res.json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

app.get('/user/settings', auth, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT payload, updated_at FROM user_settings WHERE user_id = $1', [req.userId]);
    if (!result.rowCount) return res.json({ settings: {}, updated_at: null });
    res.json({ settings: result.rows[0].payload || {}, updated_at: result.rows[0].updated_at });
  } catch (error) {
    next(error);
  }
});

app.put('/user/settings', auth, async (req, res, next) => {
  const payload = req.body?.settings;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return badRequest(res, 'INVALID_SETTINGS', 'Settings payload must be an object');
  }
  const updatedAt = normalizeIncomingTime(req.body.updated_at || new Date().toISOString());
  try {
    const result = await pool.query(
      `INSERT INTO user_settings (user_id, payload, updated_at)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         payload = EXCLUDED.payload,
         updated_at = EXCLUDED.updated_at
       WHERE user_settings.updated_at IS NULL OR user_settings.updated_at <= EXCLUDED.updated_at
       RETURNING payload, updated_at`,
      [req.userId, JSON.stringify(payload), updatedAt]
    );
    if (!result.rowCount) {
      const current = await pool.query('SELECT payload, updated_at FROM user_settings WHERE user_id = $1', [req.userId]);
      return res.json({ settings: current.rows[0]?.payload || {}, updated_at: current.rows[0]?.updated_at || null, skipped: true });
    }
    res.json({ settings: result.rows[0].payload || {}, updated_at: result.rows[0].updated_at });
  } catch (error) {
    next(error);
  }
});

app.get('/account/summary', auth, async (req, res, next) => {
  try {
    const [devicesResult, todoResult, versionResult, recentResult] = await Promise.all([
      pool.query(
        `SELECT id, device_name, platform, last_seen_at, created_at
         FROM devices
         WHERE user_id = $1
         ORDER BY COALESCE(last_seen_at, created_at) DESC
         LIMIT 12`,
        [req.userId]
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS total_todos,
           COUNT(*) FILTER (WHERE deleted_at IS NULL AND completed = false)::int AS active_todos,
           COUNT(*) FILTER (WHERE deleted_at IS NULL AND completed = true)::int AS completed_todos,
           COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS deleted_todos
         FROM todos
         WHERE user_id = $1`,
        [req.userId]
      ),
      pool.query(
        `SELECT COALESCE(MAX(server_version), 0)::bigint AS latest_server_version,
                MAX(created_at) AS last_change_at
         FROM sync_changes
         WHERE user_id = $1`,
        [req.userId]
      ),
      pool.query(
        `SELECT id, title, completed, priority, updated_at, server_version
         FROM todos
         WHERE user_id = $1 AND deleted_at IS NULL
         ORDER BY updated_at DESC
         LIMIT 6`,
        [req.userId]
      )
    ]);

    const counts = todoResult.rows[0] || {};
    const version = versionResult.rows[0] || {};
    res.json({
      summary: {
        device_count: devicesResult.rowCount,
        total_todos: Number(counts.total_todos || 0),
        active_todos: Number(counts.active_todos || 0),
        completed_todos: Number(counts.completed_todos || 0),
        deleted_todos: Number(counts.deleted_todos || 0),
        latest_server_version: Number(version.latest_server_version || 0),
        last_change_at: version.last_change_at || null
      },
      devices: devicesResult.rows,
      recent_todos: recentResult.rows
    });
  } catch (error) {
    next(error);
  }
});
app.post('/sync/push', auth, async (req, res, next) => {
  const deviceId = req.body.device_id;
  const changes = Array.isArray(req.body.changes) ? req.body.changes.slice(0, 100) : [];
  const accepted = [];
  const rejected = [];
  const client = await pool.connect();

  try {
    if (!(await ensureDeviceBelongsToUser(client, req.userId, deviceId))) {
      return res.status(403).json({ error: { code: 'INVALID_DEVICE', message: 'Device is not registered for this user' } });
    }

    for (const change of changes) {
      if (!uuid(change.client_change_id) || !uuid(change.entity_id) || change.entity_type !== 'todo') {
        rejected.push({ client_change_id: change.client_change_id, code: 'INVALID_CHANGE' });
        continue;
      }

      await client.query('BEGIN');
      const existingChange = await client.query(
        'SELECT server_version FROM sync_changes WHERE user_id = $1 AND client_change_id = $2',
        [req.userId, change.client_change_id]
      );
      if (existingChange.rowCount) {
        await client.query('COMMIT');
        accepted.push({
          client_change_id: change.client_change_id,
          entity_id: change.entity_id,
          server_version: Number(existingChange.rows[0].server_version),
          status: 'duplicate'
        });
        continue;
      }

      const payload = change.payload || {};
      const incomingUpdatedAt = normalizeIncomingTime(payload.updated_at || payload.deleted_at);
      const incomingDeletedAt = payload.deleted_at || null;
      const current = await client.query('SELECT * FROM todos WHERE user_id = $1 AND id = $2 FOR UPDATE', [req.userId, change.entity_id]);

      if (current.rowCount && timeValue(incomingUpdatedAt) < timeValue(current.rows[0].updated_at)) {
        await client.query('COMMIT');
        accepted.push({
          client_change_id: change.client_change_id,
          entity_id: change.entity_id,
          server_version: Number(current.rows[0].server_version) || 0,
          status: 'stale'
        });
        continue;
      }

      const versionResult = await client.query("SELECT nextval('global_server_version_seq')::bigint AS server_version");
      const serverVersion = Number(versionResult.rows[0].server_version);
      let storedPayload;

      if (!current.rowCount) {
        const inserted = await client.query(
          `INSERT INTO todos
           (id, user_id, title, note, completed, due_at, priority, list_id, sort_order, created_at, updated_at, deleted_at, version, device_id, server_version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           RETURNING *`,
          [
            change.entity_id,
            req.userId,
            String(payload.title || '').slice(0, 260),
            payload.note || '',
            Boolean(payload.completed),
            payload.due_at || null,
            Number(payload.priority) || 0,
            uuid(payload.list_id) ? payload.list_id : null,
            Number(payload.sort_order) || 0,
            payload.created_at || incomingUpdatedAt,
            incomingUpdatedAt,
            incomingDeletedAt,
            Number(payload.version) || 1,
            deviceId,
            serverVersion
          ]
        );
        storedPayload = rowToTodoPayload(inserted.rows[0]);
      } else {
        const updated = await client.query(
          `UPDATE todos SET
             title = $3,
             note = $4,
             completed = $5,
             due_at = $6,
             priority = $7,
             list_id = $8,
             sort_order = $9,
             updated_at = $10,
             deleted_at = $11,
             version = version + 1,
             device_id = $12,
             server_version = $13
           WHERE user_id = $1 AND id = $2
           RETURNING *`,
          [
            req.userId,
            change.entity_id,
            String(payload.title || '').slice(0, 260),
            payload.note || '',
            Boolean(payload.completed),
            payload.due_at || null,
            Number(payload.priority) || 0,
            uuid(payload.list_id) ? payload.list_id : null,
            Number(payload.sort_order) || 0,
            incomingUpdatedAt,
            incomingDeletedAt,
            deviceId,
            serverVersion
          ]
        );
        storedPayload = rowToTodoPayload(updated.rows[0]);
      }

      await client.query(
        `INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, payload, client_change_id, server_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [req.userId, deviceId, change.entity_type, change.entity_id, incomingDeletedAt ? 'delete' : change.operation || 'update', storedPayload, change.client_change_id, serverVersion]
      );
      await client.query('COMMIT');
      accepted.push({ client_change_id: change.client_change_id, entity_id: change.entity_id, server_version: serverVersion, status: 'applied' });
    }

    res.json({ accepted, rejected, latest_server_version: await latestServerVersion(client, req.userId) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});
app.get('/sync/pull', auth, async (req, res, next) => {
  const since = Math.max(0, Number(req.query.since_version) || 0);
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  try {
    const result = await pool.query(
      `SELECT id AS change_id, server_version, device_id, entity_type, entity_id, operation, payload, created_at
       FROM sync_changes
       WHERE user_id = $1 AND server_version > $2
       ORDER BY server_version ASC
       LIMIT $3`,
      [req.userId, since, limit + 1]
    );
    const rows = result.rows.slice(0, limit);
    const latest = rows.length ? Number(rows[rows.length - 1].server_version) : since;
    res.json({
      changes: rows,
      latest_server_version: await latestServerVersion(pool, req.userId),
      has_more: result.rows.length > limit,
      next_since_version: latest
    });
  } catch (error) {
    next(error);
  }
});

app.post('/sync/ack', auth, async (req, res, next) => {
  const deviceId = req.body.device_id;
  const version = Math.max(0, Number(req.body.last_acked_server_version) || 0);
  try {
    if (!(await ensureDeviceBelongsToUser(pool, req.userId, deviceId))) {
      return res.status(403).json({ error: { code: 'INVALID_DEVICE', message: 'Device is not registered for this user' } });
    }
    await pool.query(
      `INSERT INTO sync_acks (user_id, device_id, last_acked_server_version, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, device_id) DO UPDATE SET
         last_acked_server_version = GREATEST(sync_acks.last_acked_server_version, EXCLUDED.last_acked_server_version),
         updated_at = now()`,
      [req.userId, deviceId, version]
    );
    res.json({ ok: true, last_acked_server_version: version });
  } catch (error) {
    next(error);
  }
});

app.get('/sync/status', auth, async (req, res, next) => {
  const deviceId = req.query.device_id;
  try {
    const latest = await latestServerVersion(pool, req.userId);
    const ack = uuid(deviceId)
      ? await pool.query('SELECT last_acked_server_version, updated_at FROM sync_acks WHERE user_id = $1 AND device_id = $2', [req.userId, deviceId])
      : { rows: [] };
    res.json({
      server_time: new Date().toISOString(),
      latest_server_version: latest,
      device: {
        device_id: deviceId || null,
        last_acked_server_version: Number(ack.rows[0]?.last_acked_server_version || 0),
        last_seen_at: ack.rows[0]?.updated_at || null
      }
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } });
  }
  if (error.status === 404 || error.statusCode === 404 || error.code === 'ENOENT') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  }
  res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Internal server error' } });
});

async function start() {
  const schema = await fs.readFile(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
  await pool.query(schema);
  app.listen(PORT, () => {
    console.log(`Ntodo sync server listening on ${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
