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
- Put Nginx or Caddy in front of the API and enable HTTPS.
- Keep PostgreSQL private; only expose the API port publicly.
- Back up the `ntodo_postgres_data` Docker volume regularly.
