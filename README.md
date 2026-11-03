# CAP-EPAC Téléphonie — Guide complet de déploiement

## Architecture générale

```
┌──────────────────────────────────────────────────────────────────┐
│  MACHINE DE DEV  (ton PC Kali Linux)                             │
│  /home/houndokinnou/Documents/projets/telephonie-cap-epac/       │
│                                                                  │
│  → git add / git commit / git push                              │
│  → bash deploy.sh <IP> <domaine> --apk-only   (build APK)       │
│  → bash deploy.sh <IP> <domaine> --no-docker  (config only)     │
└──────────────────────────┬───────────────────────────────────────┘
                           │ git push → GitHub/GitLab → git pull
┌──────────────────────────▼───────────────────────────────────────┐
│  SERVEUR UBUNTU  (192.168.10.139)                                │
│  /mnt/CAP_Data/telephonie_cap_epac/                              │
│                                                                  │
│  → git pull                                                      │
│  → bash deploy.sh <IP> <domaine> --no-apk   (déploiement)       │
└──────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────────┐
│  TÉLÉPHONE ANDROID                                               │
│  → Installer app-release.apk (buildé sur la machine de dev)     │
│  → Dans le réseau LAN : http://192.168.10.139:18282              │
│  → Hors réseau : activer WireGuard VPN                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Déploiement — en une commande

### Sur le serveur Ubuntu
```bash
cd /mnt/CAP_Data/telephonie_cap_epac
git pull
bash deploy.sh 192.168.10.139 telephonie-cap-epac.bj --no-apk
```

### Sur ta machine de dev (build APK uniquement)
```bash
cd /home/houndokinnou/Documents/projets/telephonie-cap-epac
git pull
bash deploy.sh 192.168.10.139 telephonie-cap-epac.bj --apk-only
```
L'APK se trouve ensuite dans :
`mobile/android/app/build/outputs/apk/release/app-release.apk`

### Options disponibles
| Commande | Description | Où l'utiliser |
|---|---|---|
| `bash deploy.sh <IP>` | Déploiement complet sans domaine | Serveur |
| `bash deploy.sh <IP> <domaine> --no-apk` | Déploiement complet sans build APK | Serveur |
| `bash deploy.sh <IP> <domaine> --apk-only` | Build APK uniquement | Machine de dev |
| `bash deploy.sh <IP> <domaine> --no-docker` | Config fichiers seulement, sans Docker | Machine de dev |

---

## Ports utilisés (plage 13000–19999)

| Service | Port externe | URL d'accès |
|---|---|---|
| HTTPS web | **19443** | `https://192.168.10.139:19443` ou `https://telephonie-cap-epac.bj` |
| HTTP web | **19080** | Redirige automatiquement vers HTTPS |
| API mobile | **18282** | `http://192.168.10.139:18282/api` |
| MySQL externe | **13307** | DBeaver, outils DB |
| TURN/STUN WebRTC | **3478 UDP** | Géré par Coturn (réseau host) |

---

## Fichiers NON suivis par git

Ces fichiers sont **générés automatiquement** par `deploy.sh` à chaque déploiement.  
Ils n'existent pas dans le dépôt git. **Ne jamais les éditer manuellement.**

| Fichier | Ce qu'il contient |
|---|---|
| `.env` | Secrets, IPs, ports, mots de passe |
| `nginx/ssl/cert.pem` + `key.pem` | Certificats SSL auto-signés |
| `nginx/ssl/rootCA.pem` | CA racine mkcert (si disponible) |
| `nginx/coturn.conf` | Config TURN/STUN avec IP du serveur |
| `frontend/.env` | URL API pour le build Vite |
| `frontend/.env.production` | Idem (build prod) |
| `mobile/src/config.ts` | IP du serveur pour l'APK |
| `mobile/android/local.properties` | Chemin du SDK Android |
| `mobile/android/app/src/main/res/xml/network_security_config.xml` | Domaines autorisés (HTTP clair) |
| `frontend/dist/` | Build frontend compilé |

> **Sur un nouveau serveur ou après `git clone`** : ces fichiers n'existent pas.
> Lance simplement `bash deploy.sh <IP> <domaine> --no-apk` — tout est créé automatiquement.

---

## Accès DNS local (domaine personnalisé)

Le but : accéder via `https://telephonie-cap-epac.bj` au lieu de l'IP.

### Ce que fait `deploy.sh` automatiquement
1. Installe et configure **dnsmasq** sur le serveur Ubuntu :
   - `telephonie-cap-epac.bj` → `192.168.10.139` (résolution locale)
2. Ajoute l'entrée dans `/etc/hosts` du serveur et de la machine de dev

### Ce que tu dois faire sur chaque appareil client

**Option A — Routeur (recommandée, une seule fois pour tout le réseau)**  
Dans l'interface admin du routeur (ex: `192.168.100.1`) :
- DHCP → DNS primaire → `192.168.10.139`
- Tous les appareils du réseau résoudront automatiquement `telephonie-cap-epac.bj`

**Option B — Manuellement sur chaque appareil**
- **Android/iOS** : Paramètres WiFi → Modifier réseau → DNS manuel → `192.168.10.139`
- **Windows** : Panneau de config → Centre réseau → IPv4 → DNS préféré → `192.168.10.139`
- **Linux** : `echo "nameserver 192.168.10.139" | sudo tee /etc/resolv.conf`
- **macOS** : Préférences réseau → DNS → `+` → `192.168.10.139`

> **Mobile** : l'APK utilise directement l'IP (`http://192.168.10.139:18282`), pas besoin du DNS.

---

## Accès hors réseau (VPN WireGuard)

L'application mobile fonctionne hors réseau via WireGuard :

```
Téléphone (réseau mobile 4G/5G)
       ↓ WireGuard activé
[IP publique ou DDNS]:51820  ← port forwarding sur le routeur
       ↓ tunnel VPN chiffré
Serveur 192.168.10.139
       ↓
http://192.168.10.139:18282  ← API mobile accessible comme en LAN
```

### Installer WireGuard sur le serveur
```bash
sudo apt install wireguard -y
# Générer les clés
wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
```

### Ajouter un client VPN
```bash
# Sur le serveur
cd /mnt/CAP_Data/telephonie_cap_epac/vpn
sudo bash add-client.sh nom-utilisateur
# Scanner le QR code affiché avec l'app WireGuard (Android/iOS)
```

### Port forwarding sur le routeur
- Ouvrir le port **UDP 51820** → `192.168.10.139`

### Si l'IP publique change (coupure courant, reboot routeur)
Configurer un DDNS (ex: Dynu) avec renouvellement automatique :
```bash
# Vérifier les logs du script DDNS
tail -f /var/log/dynu-ddns.log
```

---

## Résolution des erreurs 502 Bad Gateway

### Diagnostic rapide
```bash
cd /mnt/CAP_Data/telephonie_cap_epac

# 1. Voir l'état de tous les conteneurs
docker compose ps

# 2. Voir les logs du backend
docker compose logs backend --tail=30

# 3. Tester le backend directement
curl -sk https://192.168.10.139:19443/health
# Réponse attendue : {"status":"ok","service":"Téléphonie CAP-EPAC",...}
```

### Cause 1 : Règles iptables bloquent les conteneurs (ETIMEDOUT MySQL)
C'est la cause la plus fréquente. Symptôme dans les logs : `ETIMEDOUT`, `connect ETIMEDOUT 172.18.0.x`.

```bash
# Vérifier les règles bloquantes
sudo iptables -t raw -L PREROUTING -n --line-numbers | head -20
# Si tu vois des lignes DROP vers 172.18.0.x → les supprimer

# Solution rapide (remet tout à zéro)
sudo iptables -t raw -F PREROUTING

# Vérifier que MySQL est maintenant accessible depuis le backend
docker exec cap-epac-backend nc -zv mysql 3306 2>&1
# Résultat attendu : "mysql (172.18.0.x:3306) open"

# Redémarrer le backend
docker compose restart backend
sleep 20 && curl -sk https://192.168.10.139:19443/health
```

> **Pourquoi ces règles apparaissent ?**
> Certains outils de sécurité (fail2ban, ufw, docker-rootless) ajoutent des règles DROP
> sur les IPs internes Docker (172.18.x.x). `deploy.sh` les nettoie automatiquement
> à chaque déploiement via `iptables -t raw -F PREROUTING`.

### Cause 2 : Redis corrompu (AOF file)
Symptôme dans les logs : `Bad file format reading the append only file`.

```bash
# Réparer le fichier AOF
docker compose run --rm --no-deps redis sh -c \
  'for f in /data/appendonlydir/*.incr.aof; do redis-check-aof --fix "$f" < /dev/null; done'
docker compose restart redis
```

### Cause 3 : Backend en cours de démarrage
Attendre 30 secondes après `docker compose up -d`, puis retester.

```bash
docker compose ps
# La colonne STATUS doit afficher "(healthy)" pour backend
```

### Cause 4 : Ports firewall fermés
```bash
sudo iptables -I INPUT -p tcp --dport 19443 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 19080 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 18282 -j ACCEPT
```

---

## Résolution erreurs APK mobile

### Build APK échoue — "SDK Android non trouvé"
Le build APK doit se faire sur la **machine de dev**, pas sur le serveur.
```bash
# Sur ta machine de dev (Kali Linux)
bash deploy.sh 192.168.10.139 telephonie-cap-epac.bj --apk-only
```

Le SDK Android est détecté automatiquement dans :
`/home/houndokinnou/snap/android-studio/common/Android/Sdk`

### Build APK échoue — lintVitalRelease FAILED (doublons XML)
Le fichier `network_security_config.xml` contient des doublons.
```bash
# Sur ta machine de dev — régénérer proprement
bash deploy.sh 192.168.10.139 telephonie-cap-epac.bj --apk-only
# deploy.sh réécrit entièrement le fichier XML à chaque fois
```

### Build APK échoue — NDK introuvable
```bash
# Vérifier la version NDK dans mobile/android/build.gradle
# Doit être : ndkVersion = "28.2.13676358"
grep ndkVersion mobile/android/build.gradle
```

### Permission denied sur inotify
Message normal sur Linux, le script gère automatiquement avec `sudo sysctl`.
N'affecte pas le build de l'APK.

---

## Workflow de développement

### Modifier le code et déployer

```bash
# ── Machine de dev ──────────────────────────────────────────
# 1. Modifier le code
# 2. Committer et pousser
git add src/...            # Ne pas faire git add -A (évite .env, dist/, etc.)
git commit -m "feat: description du changement"
git push

# ── Serveur Ubuntu ──────────────────────────────────────────
# 3. Récupérer et déployer
cd /mnt/CAP_Data/telephonie_cap_epac
git pull
bash deploy.sh 192.168.10.139 telephonie-cap-epac.bj --no-apk

# ── Machine de dev (si modif mobile) ────────────────────────
# 4. Rebuilder et installer l'APK
bash deploy.sh 192.168.10.139 telephonie-cap-epac.bj --apk-only
# Installer : mobile/android/app/build/outputs/apk/release/app-release.apk
```

### Règles importantes

| ✅ À faire sur le serveur | ❌ À ne JAMAIS faire sur le serveur |
|---|---|
| `git pull` | `git add` |
| `bash deploy.sh ... --no-apk` | `git commit` |
| `docker compose logs -f` | `git push` |
| `docker compose down` | `npm install` |
| `docker compose ps` | Éditer `.env` manuellement |

---

## Commandes utiles sur le serveur

```bash
# État des conteneurs
docker compose ps

# Logs en direct
docker compose logs -f
docker compose logs backend -f
docker compose logs nginx -f

# Redémarrer un service
docker compose restart backend
docker compose restart nginx

# Arrêter tout
docker compose down

# Redémarrer tout
docker compose down && docker compose up -d

# Voir l'utilisation mémoire/CPU
docker stats

# Accéder au shell du backend
docker exec -it cap-epac-backend sh

# Accéder à MySQL
docker exec -it cap-epac-mysql mysql -u cap_epac_user -pCapEpac@2025 db_telephonie_cap_epac
```

---

## Conflit git sur le serveur

```bash
# Le serveur ne doit JAMAIS avoir de commits locaux
# Si divergence :
git fetch origin
git reset --hard origin/main
```

---

## Identifiants par défaut

| Service | Identifiant | Mot de passe |
|---|---|---|
| Application web | `admin` | `Admin@CapEpac2025` |
| MySQL utilisateur | `cap_epac_user` | `CapEpac@2025` |
| MySQL root | `root` | `CapEpac@Root2025` |
| Redis | *(pas d'utilisateur)* | `CapEpacRedis2025` |
| Webhook | *(secret header)* | `CapEpacWebhook@Secret2025` |

---

## Visioconférence (Jitsi)

Configuré pour utiliser `https://meet.jit.si` par défaut (aucune installation requise).

Pour changer vers un serveur Jitsi local :
```bash
# Dans .env (généré par deploy.sh)
JITSI_URL=https://mon-jitsi-local.bj:8443
```

---

## Structure des ports et services

```
Appareils LAN / VPN WireGuard
      │
      ├── :19443 HTTPS ──→ nginx ──→ frontend React (SPA)
      │                         ──→ /api/* → backend Node.js
      │                         ──→ /socket.io → WebSocket
      │                         ──→ /uploads → fichiers médias
      │
      ├── :19080 HTTP  ──→ nginx ──→ redirect 301 vers HTTPS
      │
      ├── :18282 HTTP  ──→ nginx ──→ API mobile (même backend)
      │                              (port fixe dans l'APK)
      │
      ├── :13307 MySQL ──→ container MySQL (accès DBeaver)
      │
      └── :3478 UDP    ──→ Coturn TURN/STUN (appels WebRTC)
```
