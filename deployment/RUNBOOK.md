# AETHER-IT Deployment Runbook

## Prerequisites

- Ubuntu VPS with Docker Engine and Compose plugin
- DNS `A` record pointed at the VPS IP
- A generated `AETHER_SECRET_KEY`
- Optional `GEMINI_API_KEY`

## First deployment

```bash
git clone <repository-url> /opt/aether-it
cd /opt/aether-it
cp .env.example .env
chmod 600 .env
nano .env
docker compose up -d --build
docker compose ps
curl -f http://127.0.0.1/health
```

Set `AETHER_CORS_ORIGINS` to the public HTTPS origin before exposing the service. The container Nginx listens on host port `8080` because this VPS already has a host Nginx on port `80`; configure the host Nginx to reverse proxy the public domain to `127.0.0.1:8080` before production traffic.

## Upgrade

```bash
cd /opt/aether-it
git pull --ff-only
docker compose build
docker compose up -d
docker compose ps
curl -f http://127.0.0.1/health
```

## Rollback

```bash
git log --oneline -5
git checkout <known-good-commit>
docker compose up -d --build
curl -f http://127.0.0.1/health
```

Do not delete the `mongo_data` or `mongo_backups` volumes during rollback. Verify a recent archive exists before destructive maintenance.

## Backup verification

```bash
docker compose exec mongo-backup sh -c 'ls -lh /backups | tail'
docker compose logs --tail=100 mongo-backup
```

Copy archives to separate storage on a schedule. The local backup volume is not a disaster-recovery copy.

## Smoke checks

1. Open `http://<vps-ip>:8080` during staging and register a test organization.
2. Create a project and device.
3. Upload a floorplan and move a marker.
4. Import a CSV fixture.
5. Generate a Safe Mode config preview.
6. Run an AI query and confirm the `AI SUGGESTED` label.
7. Download JSON and PDF exports.
8. Confirm a viewer cannot create or modify data.
