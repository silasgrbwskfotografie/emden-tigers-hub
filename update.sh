#!/usr/bin/env bash
# Emden Tigers Hub: Update auf dem Server über Git
# Aufruf im Projektordner:  sudo bash update.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "== Emden Tigers Hub: Update =="

if [ ! -d .git ]; then
  echo "Dieser Ordner ist kein Git-Repository. Bitte nach INSTALLATION.md mit 'git clone' einrichten."; exit 1
fi
if [ ! -f .env ]; then
  echo ".env fehlt. Bitte zuerst 'sudo bash setup.sh' ausführen."; exit 1
fi

# 1. Sicherung der Datenbank vor dem Update
if [ -f data/tigers.db ]; then
  mkdir -p data/backups
  STAMP=$(date +%Y-%m-%d_%H%M%S)
  if docker compose ps --status running hub 2>/dev/null | grep -q hub; then
    docker compose exec -T hub python -c "import sqlite3; s=sqlite3.connect('/data/tigers.db'); d=sqlite3.connect('/data/backups/vor-update-${STAMP}.db'); s.backup(d); d.close(); s.close()"
  else
    cp data/tigers.db "data/backups/vor-update-${STAMP}.db"
  fi
  chown 1000:1000 "data/backups/vor-update-${STAMP}.db" 2>/dev/null || true
  echo "-> Sicherung angelegt: data/backups/vor-update-${STAMP}.db"
fi

# 2. Neuen Stand holen
OLD=$(git rev-parse --short HEAD)
git fetch --quiet
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Achtung: Im Server-Ordner wurden Dateien von Hand geändert:"
  git status --short --untracked-files=no
  echo "Bitte diese Änderungen ins Repository übernehmen oder mit 'git checkout -- <datei>' verwerfen. Update abgebrochen."
  exit 1
fi
git pull --ff-only
NEW=$(git rev-parse --short HEAD)

if [ "$OLD" = "$NEW" ]; then
  echo "-> Bereits aktuell ($NEW). Starte trotzdem neu, falls nötig."
else
  echo "-> Neue Version: $OLD -> $NEW"
  git --no-pager log --oneline "$OLD..$NEW"
fi

# 3. Neu bauen und starten
docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true

# 4. Kurz prüfen, ob der Hub antwortet
echo -n "-> Warte auf den Hub "
for i in $(seq 1 30); do
  if docker compose exec -T hub python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8765/healthz', timeout=2).status == 200 else 1)" >/dev/null 2>&1; then
    VERSION=$(docker compose exec -T hub python -c "import json,urllib.request; print(json.load(urllib.request.urlopen('http://127.0.0.1:8765/healthz'))['version'])" 2>/dev/null | tr -d '\r')
    echo; echo "Fertig. Emden Tigers Hub $VERSION läuft."
    exit 0
  fi
  echo -n "."; sleep 2
done
echo; echo "Der Hub antwortet nicht. Logs: docker compose logs --tail 50 hub"
exit 1
