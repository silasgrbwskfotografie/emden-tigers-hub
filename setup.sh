#!/usr/bin/env bash
# Emden Tigers Hub: Einrichtung auf einem Linux-VServer (Debian/Ubuntu)
# Aufruf im Projektordner:  sudo bash setup.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "== Emden Tigers Hub: Einrichtung =="

if [ "$(id -u)" -ne 0 ]; then
  echo "Bitte mit sudo ausführen: sudo bash setup.sh"; exit 1
fi

# 0. Git (für Updates) sicherstellen
if ! command -v git >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq git
fi

# 1. Docker installieren, falls nicht vorhanden
if ! command -v docker >/dev/null 2>&1; then
  echo "-> Docker wird installiert ..."
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose fehlt. Bitte das Paket docker-compose-plugin installieren."; exit 1
fi

# 2. .env anlegen
if [ ! -f .env ]; then
  cp .env.example .env
  read -rp "Domain für den Hub (z. B. hub.deinedomain.de): " DOMAIN
  read -rp "E-Mail für das HTTPS-Zertifikat: " MAIL
  read -rp "Admin-Benutzername [silas]: " ADMIN; ADMIN=${ADMIN:-silas}
  while true; do
    read -rsp "Admin-Passwort (mind. 10 Zeichen): " PW; echo
    read -rsp "Passwort wiederholen: " PW2; echo
    if [ "$PW" != "$PW2" ]; then echo "Stimmt nicht überein."; continue; fi
    if [ ${#PW} -lt 10 ]; then echo "Zu kurz."; continue; fi
    case "$PW" in *\'*) echo "Bitte ohne Apostroph ('), das stört die Konfigurationsdatei."; continue;; esac
    break
  done
  sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|; s|^ACME_EMAIL=.*|ACME_EMAIL=${MAIL}|; s|^TMH_ADMIN_USER=.*|TMH_ADMIN_USER=${ADMIN}|" .env
  # Passwort in einfachen Anführungszeichen speichern, damit Sonderzeichen wie $ oder # erhalten bleiben
  grep -v '^TMH_ADMIN_PASSWORD=' .env > .env.tmp
  printf "TMH_ADMIN_PASSWORD='%s'\n" "$PW" >> .env.tmp
  mv .env.tmp .env
  chmod 600 .env
  echo "-> .env angelegt."
else
  echo "-> .env ist schon vorhanden, wird nicht verändert."
fi

# 3. Datenordner mit passenden Rechten (Container läuft als Benutzer 1000)
mkdir -p data
chown -R 1000:1000 data

# 4. Starten
docker compose up -d --build
echo
echo "Fertig. Der Hub startet jetzt. Das HTTPS-Zertifikat wird beim ersten Aufruf automatisch geholt."
echo "Adresse: https://$(grep '^DOMAIN=' .env | cut -d= -f2)"
echo "Status:  docker compose ps    |    Logs: docker compose logs -f hub"
echo "Updates: sudo bash update.sh"
