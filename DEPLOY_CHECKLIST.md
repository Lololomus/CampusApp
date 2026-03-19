# CampusApp Deployment Runbook

## 1. Choose ingress mode first

Choose one of these modes before doing anything else:

- **Beta via Tuna tunnel**
  - Use this when you do not want to buy a domain yet.
  - Public HTTPS ends on Tuna, not on your VPS.
  - Deploy with `docker-compose.tuna.yml`.
  - Do **not** use `certbot`, `check-prod-env.sh`, or `deploy-prod.sh` in this mode.
- **Production via your own domain**
  - Use this when you have your own domain or subdomain.
  - Public HTTPS ends on your VPS with local Nginx and Let's Encrypt.
  - Deploy with `docker-compose.prod.yml`, `check-prod-env.sh`, and `deploy-prod.sh`.

The rest of this runbook is split by mode. Follow only one path.

## 2. Shared server bootstrap

These steps are common for both Tuna beta and full production.

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
sudo usermod -aG sudo deploy
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

## 3. Shared project checkout and host directories

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

## 4. Shared environment

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
- `API_BASE_URL=http://backend:8000`
- `SECRET_KEY`, `BOT_SECRET`, `ANALYTICS_SALT`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD` are long random values
- `BOT_TOKEN` is the real token from BotFather
- Do not set `DATABASE_URL` or `REDIS_URL` manually in `.env`; compose builds them from the component variables

Mode-specific env:

- For **Tuna beta**:
  - `CORS_ORIGINS=https://<your-tuna-domain>`
  - `MINIAPP_URL=https://<your-tuna-domain>`
- For **own domain production**:
  - `CORS_ORIGINS=https://<your-domain>`
  - `MINIAPP_URL=https://<your-domain>`

## 5. Path A: Beta via Tuna

### 5.1. Deploy the HTTP-only stack

Tuna terminates HTTPS for you. The VPS serves plain HTTP only on loopback `127.0.0.1:80`, and Tuna connects to that local listener.

Build and start the beta stack:

```bash
chmod +x scripts/deploy-tuna.sh
./scripts/deploy-tuna.sh
```

This mode uses:

- `nginx/nginx.tuna.conf`
- `docker-compose.tuna.yml`
- `scripts/deploy-tuna.sh`

Do **not** run:

- `./scripts/check-prod-env.sh`
- `./scripts/deploy-prod.sh`

Those scripts are for the own-domain TLS path only.

`deploy-tuna.sh` does:

- `git fetch` + `git pull --ff-only`
- `docker compose -f docker-compose.yml -f docker-compose.tuna.yml up -d --build`
- `docker compose ... up -d --force-recreate --no-deps frontend` so the bind-mounted `nginx.tuna.conf` is always refreshed after `git pull`
- waits for `postgres`, `redis`, `backend`, `frontend`, `bot`
- verifies `http://127.0.0.1/health` and `http://127.0.0.1/api/health`

### 5.2. Verify the local HTTP stack on the VPS

```bash
docker compose -f docker-compose.yml -f docker-compose.tuna.yml ps
docker compose -f docker-compose.yml -f docker-compose.tuna.yml logs --tail=100 backend frontend bot
curl -I http://127.0.0.1/health
curl -I http://127.0.0.1/api/health
```

Expected result:

- `frontend`, `backend`, `bot`, `postgres`, `redis` are up
- `http://127.0.0.1/health` returns `200`
- `http://127.0.0.1/api/health` returns `200`
- frontend serves plain HTTP only on loopback and is not exposed directly on the public interface

### 5.3. Run Tuna on the VPS

Install the official Tuna CLI on the VPS and log in to your account.

Start the tunnel manually first:

```bash
tuna http 80 --subdomain=<your-subdomain>
```

Then open the Tuna HTTPS domain in your browser and confirm that:

- the frontend opens
- `/api` works through the tunnel
- Mini App opens on the Tuna HTTPS URL

### 5.4. Make Tuna persistent with systemd

After you confirm the manual tunnel works, create a systemd service for Tuna.

Example unit file:

```ini
[Unit]
Description=Tuna tunnel for CampusApp beta
After=network-online.target docker.service
Wants=network-online.target

[Service]
User=deploy
WorkingDirectory=/home/deploy/CampusApp
ExecStart=/usr/local/bin/tuna http 80 --subdomain=<your-subdomain>
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tuna-campusapp.service
sudo systemctl status tuna-campusapp.service --no-pager
```

### 5.5. Routine beta update

```bash
cd /home/deploy/CampusApp
./scripts/deploy-tuna.sh
```

## 6. Path B: Production via your own domain

### 6.1. TLS certificates

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

### 6.2. Automated certificate renewal

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

### 6.3. First production deploy

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

### 6.4. Routine production update

```bash
cd /home/deploy/CampusApp
./scripts/deploy-prod.sh
```

## 7. Shared backup and restore

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

1. Stop the stack with the compose files for your chosen mode
2. Restore uploads: `tar -C /srv/campusapp/uploads -xzf uploads.tar.gz`
3. Restore reports: `tar -C /srv/campusapp/reports -xzf reports.tar.gz`
4. Start only Postgres: `docker compose -f docker-compose.yml -f <mode-file> up -d postgres`
5. Restore DB: `docker compose -f docker-compose.yml -f <mode-file> exec -T postgres psql -U campus -d campusapp < postgres.sql`
6. Start the full stack again for the same mode

## 8. Shared verification after deploy

Check public ports:

```bash
ss -tlnp
```

For Tuna beta you should normally see:

- `22`
- `127.0.0.1:80`

For own-domain production you should normally see:

- `22`
- `80`
- `443`

Application checks:

```bash
docker compose -f docker-compose.yml -f <mode-file> ps
docker compose -f docker-compose.yml -f <mode-file> logs --tail=100 backend frontend bot
```

Security checks (source `.env` first so `$REDIS_PASSWORD` is available in the shell):

```bash
set -a; source .env; set +a

# Redis auth works inside Docker
docker compose -f docker-compose.yml -f <mode-file> exec -T redis redis-cli -a "$REDIS_PASSWORD" INFO replication | grep role

# Redis rejects commands without auth even inside Docker
docker compose -f docker-compose.yml -f <mode-file> exec -T redis sh -lc 'redis-cli PING 2>&1 | grep -q "NOAUTH Authentication required"' && echo "Redis requires auth"

# Internal services are not exposed on the host
if ss -tlnp | grep -E ':(5432|6379|8000|8001)\b'; then
  echo "Unexpected internal listeners are exposed on the host" >&2
  exit 1
fi
```

Mode files:

- Tuna beta: `docker-compose.tuna.yml`
- Own domain production: `docker-compose.prod.yml`

## 9. Production rollback

Rollback applies to the own-domain production path with `deploy-prod.sh`.

Use `--skip-pull` so that `deploy-prod.sh` does not pull latest code from the remote and the checkout stays on the target SHA:

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
