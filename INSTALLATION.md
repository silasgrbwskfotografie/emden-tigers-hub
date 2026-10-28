# Emden Tigers Hub auf dem VServer

Der Hub läuft in Docker. Davor sitzt **Caddy**, der automatisch ein HTTPS-Zertifikat von Let's Encrypt holt und erneuert. Alle Seiten, Daten und Bilder sind nur nach dem Login erreichbar.

## So läuft es

```
Dein PC (Claude Code)  --git push-->  GitHub (privates Repo)  --git pull-->  VServer (Docker)
```

Du entwickelst auf deinem PC, schiebst Änderungen nach GitHub, und auf dem Server holt `update.sh` den neuen Stand und startet den Hub neu. Die Daten (`data/`) und die Zugangsdaten (`.env`) liegen nur auf dem Server und sind nie im Repository.

## Voraussetzungen

- VServer mit **Debian 12** oder **Ubuntu 22.04/24.04**, ab 1 GB RAM
- Eine **Domain oder Subdomain**, z. B. `hub.deinedomain.de`, mit einem **A-Eintrag** auf die IP des Servers (bei IPv6 zusätzlich AAAA)
- Ports **80** und **443** offen (Firewall des Anbieters prüfen)
- Ein **GitHub-Konto** (kostenlos reicht)

## 1. Repository auf GitHub anlegen (einmalig, am PC)

1. Auf github.com ein **neues, privates Repository** anlegen, z. B. `emden-tigers-hub`. **Ohne** README, .gitignore oder Lizenz (das Repo muss leer sein).
2. Den Ordner `EmdenTigersHub` an einen festen Platz legen, z. B. `C:\Projekte\EmdenTigersHub`, und dort in PowerShell:
   ```
   git remote add origin https://github.com/DEIN-NAME/emden-tigers-hub.git
   git push -u origin main
   ```
   (Git für Windows: https://git-scm.com/download/win. Beim ersten Push fragt Git nach der GitHub-Anmeldung.)

Ab jetzt arbeitest du in diesem Ordner, z. B. mit Claude Code.

## 2. Server einrichten (einmalig)

Auf dem Server anmelden (`ssh root@DEINE-SERVER-IP`), dann:

1. Git installieren und einen **Deploy Key** erzeugen (ein Schlüssel, mit dem nur dieser Server dieses eine Repo lesen darf):
   ```
   apt update && apt install -y git
   ssh-keygen -t ed25519 -f ~/.ssh/tigers_deploy -N "" -C "tigers-hub-server"
   cat ~/.ssh/tigers_deploy.pub
   ```
2. Den angezeigten Schlüssel auf GitHub eintragen: im Repo **Settings > Deploy keys > Add deploy key**, Titel z. B. `VServer`, Haken bei *Allow write access* **nicht** setzen.
3. Dem Server sagen, dass er den Schlüssel für GitHub nutzen soll:
   ```
   cat >> ~/.ssh/config <<'CFG'
   Host github.com
     IdentityFile ~/.ssh/tigers_deploy
     IdentitiesOnly yes
   CFG
   ```
4. Repository holen und einrichten:
   ```
   git clone git@github.com:DEIN-NAME/emden-tigers-hub.git /opt/EmdenTigersHub
   cd /opt/EmdenTigersHub
   sudo bash setup.sh
   ```
   `setup.sh` installiert Docker (falls nötig), fragt Domain, E-Mail, Benutzername und Passwort ab und startet den Hub.
5. `https://hub.deinedomain.de` im Browser öffnen und anmelden. Beim allerersten Aufruf kann das Zertifikat ein paar Sekunden dauern.

## 3. Updates

Am PC: Änderungen committen und pushen (`git push`). Dann auf dem Server:
```
cd /opt/EmdenTigersHub
sudo bash update.sh
```
`update.sh` legt vorher eine Sicherung der Datenbank an (`data/backups/vor-update-...db`), holt den neuen Stand, baut den Container neu und prüft, ob der Hub wieder antwortet.

**Zurück auf eine ältere Version**, falls ein Update Probleme macht:
```
git log --oneline            # gewünschten Stand suchen
git checkout <commit>        # dorthin wechseln
docker compose up -d --build
git checkout main            # später wieder auf den aktuellen Stand
```
Auf dem Server bitte keine Dateien von Hand ändern. `update.sh` bricht sonst ab, damit nichts überschrieben wird.

## Daten aus der lokalen Version übernehmen

1. In der lokalen Version: **Einstellungen > Backup herunterladen (ZIP)**
2. Im Hub auf dem Server: **Einstellungen > Backup einspielen** und das ZIP auswählen

Alle Vereinsdaten und Bilder werden übernommen. Konten, Gruppen und Rechte des Servers bleiben erhalten.

## Konten, Gruppen und Rechte

Der Hub hat vier Bereiche: **Medien**, **Verein**, **Mitglieder** und **Finanzen**. Pro Bereich gibt es drei Stufen: *kein Zugriff*, *Lesen*, *Bearbeiten*.

- **Gruppen** (Vorstand, Trainer, Media Team, Fotografen, Helfer, Spieler) legen fest, was ihre Mitglieder dürfen: **Verwaltung > Gruppen & Rechte**. Wer in mehreren Gruppen ist, bekommt pro Bereich das höchste Recht.
- **Ausnahmen** für einzelne Personen setzt du beim Konto: **Verwaltung > Konten > Bearbeiten**.
- **Admins** dürfen alles, auch Konten, Einstellungen und Backups.

**Neuen Zugang anlegen:** Unter **Mitglieder** bei der Person auf **Zugang anlegen** klicken (oder unter **Konten > + Zugang**). Der Hub erzeugt einen **Einladungslink** (14 Tage gültig), den du z. B. per WhatsApp schickst. Damit legt die Person ihr Passwort selbst fest und kann danach ihr eigenes Profil pflegen.

Passwort vergessen: Admin klickt beim Konto auf **Neuer Einladungslink**.

Notfall (Admin-Passwort vergessen): in der `.env` `TMH_RESET_PASSWORD=1` und ein neues `TMH_ADMIN_PASSWORD` setzen, `docker compose up -d`, danach wieder auf `0` stellen. Oder auf der Kommandozeile:
```
docker compose exec hub python server.py users
docker compose exec hub python server.py passwd NAME
docker compose exec hub python server.py adduser NAME admin
```

## Sicherung

- Der Hub legt jede Nacht eine Sicherung der Datenbank in `data/backups/` an (Standard: 14 Tage).
- Bilder liegen in `data/media/`.
- Komplette Sicherung vom Server holen (von Windows aus):
  ```
  scp -r root@DEINE-SERVER-IP:/opt/EmdenTigersHub/data ./TigersHub-Sicherung
  ```
- Zusätzlich jederzeit über **Einstellungen > Backup herunterladen**.

Tipp: Viele VServer-Anbieter bieten zusätzlich Snapshots an. Die sind eine gute zweite Absicherung.

## Wartung

| Was | Befehl (im Ordner `/opt/EmdenTigersHub`) |
|---|---|
| Status | `docker compose ps` |
| Logs ansehen | `docker compose logs -f hub` |
| Neu starten | `docker compose restart hub` |
| Stoppen | `docker compose down` |
| Update einspielen | `sudo bash update.sh` |
| Aktuelle Version | `git log -1 --oneline` |
| Server-Updates | `apt update && apt upgrade` und gelegentlich `docker compose pull && docker compose up -d` |

Beim Update bleiben `data/` und `.env` unverändert.

## Google-Tabelle

Der Server liest die Tabelle **Social Media Spieler** alle 5 Minuten ein. Die Tabelle muss dafür auf **Jeder mit dem Link: Betrachter** stehen. Link und Intervall stehen unter **Einstellungen**.

## Facebook und Instagram (Auto-Posting)

Unter **Medien > Auto-Posting** verbindet ein Admin die Facebook-Seite. Dafür braucht es ein **Seiten-Token**, die Schritte stehen dort direkt auf der Seite (Meta-App anlegen, Token im Graph API Explorer erzeugen und verlängern, Seiten-Token aus `me/accounts` kopieren).

- Facebook-Posts und -Storys funktionieren überall, auch auf einem Test-PC.
- **Instagram** braucht ein Business- oder Creator-Konto, das mit der Facebook-Seite verknüpft ist, und die **öffentliche Adresse** des Hubs (z. B. `https://hub.deinedomain.de`), weil Instagram die Bilder selbst abholt.
- Der Hub muss zur geplanten Zeit laufen. Storys werden bis zu 3 Stunden nachgeholt, freigegebene Posts bis zu 24 Stunden.
- Das Token liegt nur in der Datenbank des Servers und ist nicht im Backup-Download enthalten.
- Für **Statistik** und die Ansicht **Online** braucht das Token zusätzlich die Berechtigungen `read_insights` und `instagram_manage_insights`. Ein älteres Token dafür neu erzeugen und unter Einrichtung eintragen.

## E-Mail-Benachrichtigungen

Unter **Verwaltung > Einstellungen > E-Mail-Versand** trägt ein Admin das Postfach ein, über das der Hub Mails verschickt (Mailserver, Port, Benutzer, Passwort, Absender, Adresse des Hubs). Bei Gmail ein **App-Passwort** verwenden. Mit „Test-Mail senden“ prüfen.
Danach wählt jeder unter **Mein Profil** selbst, welche Benachrichtigungen er bekommt.

## Hub als App aufs Handy

Auf dem Server mit Domain (https) den Hub im Handy-Browser öffnen und **Zum Startbildschirm hinzufügen** wählen (Android: Menü ⋮, iPhone: Teilen-Symbol). Der Hub öffnet sich dann wie eine App ohne Browserleiste.

## Lokal testen (am PC)

`Start.bat` startet den Hub lokal zum Ausprobieren (braucht Python 3). Beim ersten Start legst du im Browser einen Zugang an. Die lokalen Daten liegen im Ordner `data/` und werden nicht ins Repository übernommen.
