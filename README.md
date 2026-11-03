# CAP-EPAC Téléphonie — Guide de déploiement

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│  MACHINE DE DEV (ton PC Kali Linux)                             │
│  → git pull / git push                                          │
│  → bash deploy.sh <IP> <domaine> --apk-only  (build APK)       │
│  → bash deploy.sh <IP> <domaine> --no-docker (config seulement)│
└──────────────────────┬──────────────────────────────────────────┘
                       │ git push → GitHub → git pull
┌──────────────────────▼──────────────────────────────────────────┐
│  SERVEUR UBUNTU (192.168.10.139)                                │
│  → git pull                                                     │
│  → bash deploy.sh <IP> <domaine> --no-apk  (déploiement)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Déploiement en une commande

### Sur le serveur Ubuntu
```bash
cd /mnt/CAP_Data/telephonie_cap_epac
git pull
bash deploy.sh 192.168.10.139 telephonie-cap-epac.bj --no-apk
```

### Sur ta machine de dev (pour l'APK mobile)
```bash
cd /home/houndokinnou/Documents/projets/telephonie-cap-epac
git pull
bash deploy.sh 192.168.10.139 telephonie-cap-epac.bj --apk-only
```

### Options disponibles
| Commande | Description |
|---|---|
| `bash deploy.sh <IP>` | Déploiement complet (sans domaine) |
| `bash deploy.sh <IP> <domaine>` | Déploiement avec DNS local |
| `bash deploy.sh <IP> <domaine> --no-apk` | Sans rebuild APK (serveur) |
| `bash deploy.sh <IP> <domaine> --apk-only` | APK uniquement (machine dev) |
| `bash deploy.sh <IP> <domaine> --no-docker` | Config seulement, sans Docker |

---

## Ports utilisés (plage 13000-19999, non-conflictuels)

| Service | Port externe | Usage |
|---|---|---|
| **HTTPS web** | **19443** | Navigateur → `https://IP:19443` |
| **HTTP web** | **19080** | Redirection vers HTTPS |
| **API mobile** | **18282** | APK → `http://IP:18282` |
| **MySQL externe** | **13307** | DBeaver, outils DB |
| **Jitsi visioconf** | **19444** | Si Jitsi installé localement |

---

## Fichiers NON suivis par git (générés automatiquement)

Ces fichiers sont créés par `deploy.sh` — **ne jamais les éditer manuellement** :

| Fichier | Généré par |
|---|---|
| `.env` | `deploy.sh` — secrets et config |
| `nginx/ssl/cert.pem` + `key.pem` | `deploy.sh` — certificats SSL |
| `nginx/coturn.conf` | `deploy.sh` — config TURN/STUN |
| `frontend/.env` | `deploy.sh` — URLs API frontend |
| `frontend/.env.production` | `deploy.sh` |
| `mobile/src/config.ts` | `deploy.sh` — IP API mobile |
| `mobile/android/local.properties` | `deploy.sh` — chemin SDK Android |
| `mobile/android/app/.../network_security_config.xml` | `deploy.sh` |

> **Si tu clones le projet sur un nouveau serveur**, ces fichiers n'existent pas.  
> Lance simplement `bash deploy.sh <IP> <domaine> --no-apk` — ils seront créés automatiquement.

---

## Résolution des erreurs courantes

### 502 Bad Gateway
Le backend ne répond pas. Causes et solutions :

```bash
cd /mnt/CAP_Data/telephonie_cap_epac

# 1. Voir l'erreur exacte
docker compose logs backend --tail=20

# 2. Si "ETIMEDOUT MySQL" → règles iptables bloquent les conteneurs
sudo iptables -t raw -F PREROUTING
docker compose restart backend
sleep 20 && curl -sk https://192.168.10.139:19443/health

# 3. Si Redis corrompu (Bad file format AOF)
docker compose run --rm --no-deps redis sh -c \
  'for f in /data/appendonlydir/*.incr.aof; do redis-check-aof --fix "$f" < /dev/null; done'
docker compose restart redis

# 4. Vérifier l'état de tous les conteneurs
docker compose ps
```

### Impossible de se connecter depuis le navigateur
```bash
# Vérifier que les ports sont ouverts
sudo iptables -I INPUT -p tcp --dport 19443 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 19080 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 18282 -j ACCEPT

# Tester depuis le serveur lui-même
curl -sk https://192.168.10.139:19443/health
```

### Application mobile "Impossible de joindre le serveur"
```bash
# 1. Vérifier que le conteneur nginx expose le port 18282
docker ps | grep nginx

# 2. Tester depuis le téléphone (via navigateur mobile)
http://192.168.10.139:18282/api/health

# 3. Si hors réseau → activer le VPN WireGuard sur le téléphone
```

### Conflit git (divergent branches)
```bash
# Sur le serveur — NE JAMAIS faire git add/commit sur le serveur
git fetch origin
git reset --hard origin/main
```

### Build APK échoue
```bash
# Vérifier l'erreur exacte
cd mobile/android
./gradlew assembleRelease --no-daemon 2>&1 | grep "What went wrong" -A 5

# Problème NDK → utiliser NDK 28
# Dans mobile/android/build.gradle : ndkVersion = "28.2.13676358"

# Problème network_security_config.xml (doublons)
# → le deploy.sh régénère proprement ce fichier à chaque fois

# Augmenter inotify watches
sudo sysctl -w fs.inotify.max_user_watches=524288
```

---

## Accès DNS local (domaine personnalisé)

Pour accéder via `https://telephonie-cap-epac.bj` au lieu de l'IP :

### 1. Le serveur configure dnsmasq automatiquement
`deploy.sh` installe et configure dnsmasq sur le serveur Ubuntu.

### 2. Configurer le routeur (recommandé — automatique pour tous les appareils)
Dans l'interface admin du routeur (`192.168.100.1`) :
- **DHCP** → **DNS primaire** → `192.168.10.139`

### 3. Configurer manuellement chaque appareil (alternative)
- **Android/iOS** : WiFi → Modifier → DNS manuel → `192.168.10.139`
- **Windows** : Propriétés WiFi → IPv4 → DNS préféré → `192.168.10.139`
- **Linux** : `/etc/resolv.conf` → `nameserver 192.168.10.139`

---

## Accès hors réseau (VPN WireGuard)

L'application mobile fonctionne hors réseau via WireGuard :

```
Téléphone hors réseau
       ↓ WireGuard activé
dondiegue.dynu.net:51820 (port forwarding sur le routeur)
       ↓ tunnel chiffré
Serveur 192.168.10.139
       ↓
API http://192.168.10.139:18282 → accessible comme si on était dans le LAN
```

### Ajouter un nouveau client VPN
```bash
# Sur le serveur Ubuntu
cd /mnt/CAP_Data/telephonie_cap_epac/vpn
sudo bash add-client.sh nom-utilisateur
# Scanner le QR code avec l'app WireGuard (Android/iOS)
```

### Si l'IP publique change après coupure de courant
```bash
# Sur le serveur Ubuntu — Dynu DDNS se met à jour automatiquement (cron toutes les 5min)
# Vérifier les logs :
tail -f /var/log/dynu-ddns.log
```

---

## Architecture des ports et services

```
Internet / VPN
      ↓ UDP 51820
Routeur 192.168.100.1
      ↓ port forwarding
Serveur Ubuntu 192.168.10.139
      │
      ├── :19443 (HTTPS) ──→ nginx Docker ──→ frontend React
      ├── :19080 (HTTP)  ──→ nginx Docker ──→ redirect HTTPS
      ├── :18282 (HTTP)  ──→ nginx Docker ──→ API mobile
      │                                  ──→ Socket.IO
      │                                  ──→ Uploads médias
      ├── :13307 (MySQL) ──→ Docker MySQL (accès externe DBeaver)
      └── :3478  (UDP)   ──→ Coturn TURN/STUN (WebRTC appels)
```

---

## Workflow de développement

### Modifier le code et déployer

```bash
# 1. Modifier le code sur ta machine de dev
# 2. Committer et pousser
git add -A && git commit -m "feat: ma modification"
git push

# 3. Sur le serveur
git pull
bash deploy.sh 192.168.10.139 telephonie-cap-epac.bj --no-apk

# 4. Si modification mobile
# Sur ta machine de dev :
bash deploy.sh 192.168.10.139 telephonie-cap-epac.bj --apk-only
# Puis installer l'APK : mobile/android/app/build/outputs/apk/release/app-release.apk
```

### Ne JAMAIS faire sur le serveur
```bash
# ❌ INTERDIT sur le serveur
git add
git commit
npm install
# Ces actions causent des conflits git et sont inutiles
```

### Toujours faire sur le serveur
```bash
# ✅ Sur le serveur uniquement
git pull
bash deploy.sh <IP> <domaine> --no-apk
docker compose logs -f
docker compose down
```

---

## Identifiants par défaut

| Service | Identifiant | Mot de passe |
|---|---|---|
| Application | `admin` | `Admin@CapEpac2025` |
| MySQL | `cap_epac_user` | `CapEpac@2025` |
| MySQL root | `root` | `CapEpac@Root2025` |
| Redis | — | `CapEpacRedis2025` |
| Webhook secret | — | `CapEpacWebhook@Secret2025` |
| WireGuard | — | voir `/etc/wireguard/` |
