# CampusApp Production Runbook

## 1. Target topology

- One Ubuntu 22.04+ VPS.
- Docker Compose runs `postgres`, `redis`, `backend`, `bot`, `frontend`.
- Public traffic goes only to `frontend` on `80/443`.
- Bot stays on polling. Telegram webhook is not used in production.
- Frontend uses CSP `frame-ancestors` for Telegram Mini App embedding instead of `X-Frame-Options`.
- Production memory budgets are fixed in compose: `postgres=1g`, `backend=1g`, `bot=512m`, `redis=256m`, `frontend=256m`.
- Redis hardening comes from the repo `redis.conf`, mounted read-only into the container.

## 2. Server bootstrap

Install base packages:

```bash
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin certbot fail2ban ufw unattended-upgrades
sudo systemctl enable --now docker
sudo systemctl enable --now fail2ban
sudo systemctl enable --now unattended-upgrades
```

Create a dedicated deploy user and allow Docker access:

```bash
sudo adduser deploy
sudo usermod -aG docker deploy
```

SSH hardening:

- Put your SSH public key into `/home/deploy/.ssh/authorized_keys`.
- In `/etc/ssh/sshd_config` set:
  - `PermitRootLogin no`
  - `PasswordAuthentication no`
  - `PubkeyAuthentication yes`
  - `AllowUsers deploy`
- Restart SSH:

```bash
sudo systemctl restart ssh
```

Firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## 3. Project checkout and host directories

Clone the repository as `deploy`:

```bash
cd /home/deploy
git clone <YOUR_REPO_URL> CampusApp
cd CampusApp
```

Create persistent host directories:

```bash
sudo mkdir -p /srv/campusapp/{uploads,reports,backups,acme,ssl}
sudo chown -R deploy:deploy /srv/campusapp
chmod 700 /srv/campusapp/ssl
```

## 4. Environment

Create the production env file:

```bash
cp .env.production.example .env
chmod 600 .env
```

Required production rules:

- `APP_ENV=prod`
- `DEV_AUTH_ENABLED=false`
- `COOKIE_SECURE=true`
- `SQL_ECHO=false`
- `CORS_ORIGINS` contains only real `https://` origins
- `API_BASE_URL=http://backend:8000`
- `MINIAPP_URL=https://<your-domain>`
- `SECRET_KEY`, `BOT_SECRET`, `ANALYTICS_SALT`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD` are long random values
- `BOT_TOKEN` is the real token from BotFather
- Do not set `DATABASE_URL` or `REDIS_URL` manually in `.env`; production compose builds them from the component variables above.

## 5. TLS certificates

Place real certificate files into:

- `/srv/campusapp/ssl/fullchain.pem`
- `/srv/campusapp/ssl/privkey.pem`

First issuance with certbot standalone (port 80 must be free; run this before the first deploy, while no containers are running):

```bash
sudo certbot certonly --standalone -d app.example.com
sudo cp /etc/letsencrypt/live/app.example.com/fullchain.pem /srv/campusapp/ssl/fullchain.pem
sudo cp /etc/letsencrypt/live/app.example.com/privkey.pem /srv/campusapp/ssl/privkey.pem
sudo chown deploy:deploy /srv/campusapp/ssl/fullchain.pem /srv/campusapp/ssl/privkey.pem
sudo chmod 644 /srv/campusapp/ssl/fullchain.pem
sudo chmod 600 /srv/campusapp/ssl/privkey.pem
```

### Automated certificate renewal

After the first deploy, port 80 is occupied by the frontend container. Use webroot mode for renewals because nginx already serves `/.well-known/acme-challenge/` from `/var/www/acme`.

Switch certbot to webroot for future renewals:

```bash
sudo certbot certonly --webroot -w /srv/campusapp/acme -d app.example.com --force-renewal
```

Install the repo-managed deploy hook through a thin wrapper in certbot's hook directory:

```bash
sudo install -d /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/campusapp.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exec /home/deploy/CampusApp/scripts/cert-renew-hook.sh
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/campusapp.sh
```

The repo hook copies renewed files into `/srv/campusapp/ssl/`, reloads `frontend` when it is already running, falls back to `docker compose restart frontend` if reload fails, and never calls `deploy-prod.sh` or `git pull`.

Verify that the systemd timer is active (Ubuntu enables it by default after installing certbot):

```bash
sudo systemctl list-timers | grep certbot
```

If it is not listed, enable it:

```bash
sudo systemctl enable --now certbot.timer
```

Smoke-test the deploy hook directly:

```bash
sudo RENEWED_LINEAGE=/etc/letsencrypt/live/app.example.com /home/deploy/CampusApp/scripts/cert-renew-hook.sh
```

Test the full renewal flow with a dry run:

```bash
sudo certbot renew --dry-run
```

## 6. First production deploy

Validate env and certificates:

```bash
./scripts/check-prod-env.sh
```

Run the deployment:

```bash
chmod +x scripts/check-prod-env.sh scripts/backup-prod.sh scripts/deploy-prod.sh scripts/cert-renew-hook.sh
./scripts/deploy-prod.sh
```

What the script does:

- validates `.env`
- creates a manual safety backup
- prunes timestamped backups older than 14 days
- runs `git fetch` + `git pull --ff-only` (skip with `--skip-pull` for rollbacks)
- rebuilds and restarts the production stack
- waits for healthchecks, including the bot heartbeat check
- prints status and recent logs

## 7. Routine production update

For every next release:

```bash
cd /home/deploy/CampusApp
./scripts/deploy-prod.sh
```

## 8. Manual backup and restore

Create a backup:

```bash
./scripts/backup-prod.sh
```

The backup directory contains:

- `postgres.sql`
- `uploads.tar.gz`
- `reports.tar.gz`
- `SHA256SUMS`

Retention:

- `backup-prod.sh` automatically removes timestamped backup directories older than 14 days from `/srv/campusapp/backups`.

Basic restore flow:

1. Stop the stack: `docker compose -f docker-compose.yml -f docker-compose.prod.yml down`
2. Restore uploads: `tar -C /srv/campusapp/uploads -xzf uploads.tar.gz`
3. Restore reports: `tar -C /srv/campusapp/reports -xzf reports.tar.gz`
4. Start only Postgres: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres`
5. Restore DB: `docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres psql -U campus -d campusapp < postgres.sql`
6. Start the full stack again with `./scripts/deploy-prod.sh`

## 9. Verification after deploy

Check public ports:

```bash
ss -tlnp
```

You should only see public listeners on:

- `22`
- `80`
- `443`

Application checks:

```bash
curl -I https://app.example.com/
curl -I https://app.example.com/health
curl -I https://app.example.com/api/health
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 backend frontend bot
```

Security checks (source `.env` first so `$REDIS_PASSWORD` is available in the shell):

```bash
set -a; source .env; set +a

# Redis auth works inside Docker
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T redis redis-cli -a "$REDIS_PASSWORD" INFO replication | grep role

# Redis rejects commands without auth even inside Docker
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T redis sh -lc 'redis-cli PING 2>&1 | grep -q "NOAUTH Authentication required"' && echo "Redis requires auth"

# Internal services are not exposed on the host
if ss -tlnp | grep -E ':(5432|6379|8000|8001)\b'; then
  echo "Unexpected internal listeners are exposed on the host" >&2
  exit 1
fi
```

Expected result:

- Frontend responses include `Content-Security-Policy` with Telegram `frame-ancestors`.
- Frontend responses do not include `X-Frame-Options`.
- Redis requires authentication inside Docker.
- Redis, Postgres, backend, and bot do not expose host listeners on `5432`, `6379`, `8000`, or `8001`.
- `postgres`, `redis`, `backend`, `bot` must not expose host ports.

## 10. Rollback

Rollback is git-based. Use `--skip-pull` so that `deploy-prod.sh` does not pull latest code from the remote and the checkout stays on the target SHA:

```bash
git log --oneline -n 5
git checkout <previous_commit_sha>
./scripts/deploy-prod.sh --skip-pull
```

After confirming the rollback is stable, return to the release branch:

```bash
git checkout main
git pull --ff-only origin main
```

If you need to stay on `main` but revert specific commits, prefer `git revert` instead of detached HEAD:

```bash
git revert --no-edit <bad_commit_sha>
./scripts/deploy-prod.sh
```
