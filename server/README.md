# Ntodo Sync Server

Docker deployment for the Ntodo account and sync backend.

## Local run

```bash
cp .env.example .env
docker compose up -d --build
curl http://127.0.0.1:3000/health
```

## Production notes

- Change `POSTGRES_PASSWORD` and `JWT_SECRET` before deploying.
- Set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` for Cloudflare Turnstile.
- Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` for verification-code email.
- Put Nginx or Caddy in front of the API and enable HTTPS.
- Keep PostgreSQL private; only expose the API port publicly.
- Back up the `ntodo_postgres_data` Docker volume regularly.
