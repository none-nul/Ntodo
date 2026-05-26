const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://ntodo:ntodo_password@postgres:5432/ntodo';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

const pool = new Pool({ connectionString: DATABASE_URL });
const app = express();

app.use(express.json({ limit: '1mb' }));

function uuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function badRequest(res, code, message, details) {
  return res.status(400).json({ error: { code, message, details } });
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

app.post('/auth/register', async (req, res, next) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const name = String(req.body.name || '').trim() || null;
  if (!email || !email.includes('@')) return badRequest(res, 'INVALID_EMAIL', 'Valid email is required');
  if (password.length < 8) return badRequest(res, 'WEAK_PASSWORD', 'Password must be at least 8 characters');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
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

app.post('/auth/login', async (req, res, next) => {
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
      const existing = await client.query(
        'SELECT server_version FROM sync_changes WHERE user_id = $1 AND client_change_id = $2',
        [req.userId, change.client_change_id]
      );
      if (existing.rowCount) {
        await client.query('COMMIT');
        accepted.push({
          client_change_id: change.client_change_id,
          entity_id: change.entity_id,
          server_version: Number(existing.rows[0].server_version),
          status: 'duplicate'
        });
        continue;
      }

      const versionResult = await client.query("SELECT nextval('global_server_version_seq')::bigint AS server_version");
      const serverVersion = Number(versionResult.rows[0].server_version);
      const payload = change.payload || {};
      const current = await client.query('SELECT * FROM todos WHERE user_id = $1 AND id = $2 FOR UPDATE', [req.userId, change.entity_id]);
      const incomingDeletedAt = payload.deleted_at || null;

      if (!current.rowCount) {
        await client.query(
          `INSERT INTO todos
           (id, user_id, title, note, completed, due_at, priority, list_id, sort_order, created_at, updated_at, deleted_at, version, device_id, server_version)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
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
            payload.created_at || new Date().toISOString(),
            payload.updated_at || new Date().toISOString(),
            incomingDeletedAt,
            Number(payload.version) || 1,
            deviceId,
            serverVersion
          ]
        );
      } else {
        const currentDeletedAt = current.rows[0].deleted_at;
        const deletedAt = currentDeletedAt || incomingDeletedAt;
        const deleteWins = Boolean(deletedAt);
        await client.query(
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
           WHERE user_id = $1 AND id = $2`,
          [
            req.userId,
            change.entity_id,
            deleteWins ? current.rows[0].title : String(payload.title || '').slice(0, 260),
            deleteWins ? current.rows[0].note : payload.note || '',
            deleteWins ? current.rows[0].completed : Boolean(payload.completed),
            deleteWins ? current.rows[0].due_at : payload.due_at || null,
            deleteWins ? current.rows[0].priority : Number(payload.priority) || 0,
            deleteWins ? current.rows[0].list_id : uuid(payload.list_id) ? payload.list_id : null,
            deleteWins ? current.rows[0].sort_order : Number(payload.sort_order) || 0,
            payload.updated_at || new Date().toISOString(),
            deletedAt,
            deviceId,
            serverVersion
          ]
        );
      }

      await client.query(
        `INSERT INTO sync_changes (user_id, device_id, entity_type, entity_id, operation, payload, client_change_id, server_version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [req.userId, deviceId, change.entity_type, change.entity_id, change.operation || 'update', payload, change.client_change_id, serverVersion]
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
