#  Téléphonie CAP-EPAC

> Système de téléphonie IP, messagerie instantanée et communication en temps réel 100% local (LAN), sans dépendance Internet.

**Couleurs officielles :** Vert (#16a34a) & Blanc — Interface épurée et professionnelle.

---

## Table des matières

1. [Architecture du projet](#architecture)
2. [Prérequis système](#prérequis)
3. [Installation complète](#installation)
4. [Configuration](#configuration)
5. [Démarrage du projet](#démarrage)
6. [Phases de développement](#phases)
7. [Tests](#tests)
8. [Comptes par défaut](#comptes)
9. [URLs et ports](#urls)
10. [Dépannage](#dépannage)

---

## Architecture du projet <a name="architecture"></a>

```
telephonie-cap-epac/
│
├── backend/                    # API REST + Socket.IO (Node.js 20)
│   ├── src/
│   │   ├── config/             # Database (MySQL/Sequelize) + Redis
│   │   ├── controllers/        # Logique métier (auth, users, conv, calls)
│   │   ├── middleware/         # Auth JWT, validation, rate limiting
│   │   ├── models/             # Modèles Sequelize (User, Message, CallLog…)
│   │   ├── routes/             # Routes Express (auth, users, conversations, calls)
│   │   ├── services/           # JWT service, WebRTC signaling
│   │   ├── socket/             # Handler Socket.IO (temps réel)
│   │   ├── tests/              # Tests Jest
│   │   └── server.js           # Point d'entrée
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                   # Application React 18 + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── calls/          # IncomingCallModal, ActiveCallBar
│   │   │   └── layout/         # MainLayout, Sidebar
│   │   ├── pages/              # LoginPage, ChatPage, CallsPage, DirectoryPage…
│   │   ├── services/           # api.js (Axios), webrtcService.js
│   │   ├── store/              # Zustand (authStore, socketStore, callStore)
│   │   └── styles/             # globals.css (Tailwind + variables CSS)
│   ├── Dockerfile
│   └── package.json
│
├── nginx/
│   ├── nginx.conf              # Reverse proxy HTTPS + WebSocket
│   ├── coturn.conf             # Serveur STUN/TURN WebRTC
│   └── ssl/                    # Certificats auto-générés (gitignored)
│
├── scripts/
│   ├── init.sql                # Initialisation BDD MySQL
│   ├── gen-ssl.sh              # Génération certificats SSL LAN
│   ├── start.sh                # Démarrage complet du projet
│   ├── reset.sh                # Réinitialisation complète
│   └── test-api.sh             # Tests d'intégration API (curl)
│
├── .env                        # Variables d'environnement (à personnaliser)
└── docker-compose.yml          # Orchestration de tous les services
```

### Stack technique

| Couche | Technologie |
|---|---|
| Backend | Node.js 20, Express 4, Socket.IO 4 |
| Base de données | MySQL 8.0 + Sequelize ORM |
| Cache / Présence | Redis 7 |
| Temps réel | Socket.IO (WebSocket) |
| Appels P2P | WebRTC + STUN/TURN (Coturn) |
| Frontend | React 18, Vite, TailwindCSS 3 |
| État | Zustand + TanStack Query |
| Reverse Proxy | Nginx 1.26 (HTTPS/2) |
| Conteneurs | Docker + Docker Compose |

---

## 💻 Prérequis système <a name="prérequis"></a>

### Serveur (machine hébergeant le système)

| Composant | Version minimale | Vérification |
|---|---|---|
| **Système d'exploitation** | Ubuntu 22.04+ / Debian 12+ | `lsb_release -a` |
| **Docker Engine** | 24.0+ | `docker --version` |
| **Docker Compose** | v2.20+ | `docker compose version` |
| **OpenSSL** | 1.1+ | `openssl version` |
| **RAM** | 2 Go minimum (4 Go recommandé) | `free -h` |
| **Disque** | 10 Go minimum | `df -h` |
| **Ports libres** | 80, 443, 3478 (TURN), 5349 | `ss -tlnp` |

### Clients (postes des utilisateurs)

| Composant | Requis |
|---|---|
| Navigateur | Chrome 100+, Firefox 100+, Edge 100+, Safari 16+ |
| Accès réseau LAN | Même sous-réseau que le serveur |
| Micro | Pour les appels audio |
| Caméra | Optionnel (appels vidéo) |

### Installation de Docker (si absent)

```bash
# Ubuntu / Debian
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
newgrp docker

# Vérifier
docker --version
docker compose version
```

---

## 🚀 Installation complète <a name="installation"></a>

### Étape 1 — Récupérer le projet

```bash
# Cloner ou décompresser le projet
# Option A : depuis une archive
unzip telephonie-cap-epac.zip
cd telephonie-cap-epac

# Option B : depuis Git (si dépôt disponible)
git clone <URL_DU_DEPOT> telephonie-cap-epac
cd telephonie-cap-epac
```

### Étape 2 — Identifier l'IP du serveur LAN

```bash
# Trouver l'IP LAN de la machine
ip addr show | grep "inet " | grep -v "127.0.0.1"
# ou
hostname -I | awk '{print $1}'
```

Notez cette IP, par exemple `192.168.1.10`.

### Étape 3 — Configurer le fichier .env

```bash
# Copier et éditer le fichier de configuration
nano .env
```

**Variables à adapter obligatoirement :**

```dotenv
# ── Réseau ────────────────────────────────────────────────────
SERVER_LAN_IP=192.168.1.10          # ← Remplacer par votre IP LAN
CORS_ORIGIN=https://192.168.1.10    # ← Même IP

# ── Mots de passe (à changer en production) ──────────────────
MYSQL_ROOT_PASSWORD=CapEpac@Root2025    # ← Changer
MYSQL_PASSWORD=CapEpac@2025             # ← Changer
REDIS_PASSWORD=CapEpacRedis2025         # ← Changer

# ── Secrets JWT (OBLIGATOIRE à changer) ──────────────────────
JWT_SECRET=CapEpacJWT_SuperSecret_2025_LAN_ChangeMe     # ← Générer un secret fort
JWT_REFRESH_SECRET=CapEpacRefresh_SuperSecret_2025_LAN_ChangeMe

# ── Frontend ──────────────────────────────────────────────────
VITE_API_URL=https://192.168.1.10/api  # ← Même IP
VITE_SOCKET_URL=https://192.168.1.10   # ← Même IP
```

**Générer des secrets JWT forts :**

```bash
# Générer JWT_SECRET
openssl rand -base64 64 | tr -d '\n'

# Générer JWT_REFRESH_SECRET
openssl rand -base64 64 | tr -d '\n'
```

### Étape 4 — Adapter la configuration Coturn

```bash
nano nginx/coturn.conf
```

Modifier la ligne `relay-ip` et `external-ip` avec votre IP LAN :

```
relay-ip=192.168.1.10       # ← Votre IP LAN
external-ip=192.168.1.10    # ← Votre IP LAN
```

Et pour le sous-réseau autorisé :

```
allowed-peer-ip=192.168.1.0-192.168.1.255   # ← Adapter à votre plage LAN
```

---

## ⚙️ Configuration <a name="configuration"></a>

### Toutes les variables d'environnement

| Variable | Description | Valeur par défaut |
|---|---|---|
| `NODE_ENV` | Environnement | `production` |
| `SERVER_LAN_IP` | IP LAN du serveur | `192.168.1.10` |
| `MYSQL_ROOT_PASSWORD` | Mot de passe root MySQL | `CapEpac@Root2025` |
| `MYSQL_DATABASE` | Nom de la base | `cap_epac_telephonie` |
| `MYSQL_USER` | Utilisateur MySQL | `cap_epac_user` |
| `MYSQL_PASSWORD` | Mot de passe MySQL | `CapEpac@2025` |
| `REDIS_PASSWORD` | Mot de passe Redis | `CapEpacRedis2025` |
| `JWT_SECRET` | Secret JWT access | *(à changer)* |
| `JWT_REFRESH_SECRET` | Secret JWT refresh | *(à changer)* |
| `JWT_EXPIRES_IN` | Durée access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Durée refresh token | `7d` |
| `VITE_API_URL` | URL de l'API | `https://192.168.1.10/api` |
| `VITE_SOCKET_URL` | URL Socket.IO | `https://192.168.1.10` |

---


# Installer mkcert (certificat de confiance)
bash scripts/install-mkcert.sh

# 3. Regénérer les certificats SSL avec mkcert
bash scripts/gen-ssl.sh 192.168.100.195

### Démarrage automatique (recommandé)

```bash
# Le script fait tout : SSL, détection IP, build, démarrage
bash scripts/start.sh
```

Ce script :
1. Vérifie les prérequis (Docker, OpenSSL)
2. Détecte automatiquement l'IP LAN
3. Met à jour le `.env` si nécessaire
4. Génère les certificats SSL auto-signés
5. Lance `docker compose up -d --build`
6. Attend la disponibilité du service
7. Affiche l'URL d'accès

### Démarrage manuel étape par étape

```bash
# 1. Générer les certificats SSL
bash scripts/gen-ssl.sh 192.168.1.10

# 2. Construire et démarrer tous les services
docker compose up -d --build

# 3. Vérifier que tout est démarré
docker compose ps

# 4. Consulter les logs
docker compose logs -f

# 5. Tester la disponibilité
curl -sk https://localhost/health | python3 -m json.tool
```

### Commandes de gestion

```bash
# Voir les conteneurs
docker compose ps

# Logs en temps réel (tous les services)
docker compose logs -f

# Logs d'un service spécifique
docker compose logs -f backend
docker compose logs -f mysql
docker compose logs -f nginx

# Redémarrer un service
docker compose restart backend

# Arrêter tous les services (sans supprimer les données)
docker compose stop

# Arrêter et supprimer les conteneurs (données conservées dans volumes)
docker compose down

# Réinitialisation complète (SUPPRIME TOUTES LES DONNÉES)
bash scripts/reset.sh

# Rebuild complet
docker compose down && docker compose up -d --build
```

### Mode développement (sans Docker)

Si vous voulez développer en local sans Docker :

```bash
# ── Backend ───────────────────────────────────────────────────

# Prérequis : Node.js 20, MySQL 8, Redis 7 installés localement

cd backend
npm install

# Configurer le .env local (adapter les hôtes)
cp ../.env .env
# Editer .env : DB_HOST=localhost, REDIS_HOST=localhost

# Démarrer en mode dev (hot-reload)
npm run dev

# ── Frontend ──────────────────────────────────────────────────

cd ../frontend
npm install

# Démarrer Vite dev server
npm run dev

# Accéder à : http://localhost:5173
```

---

## 📐 Phases de développement <a name="phases"></a>

### Phase 1 — Infrastructure & Authentification 

**Objectif :** Mise en place de l'infrastructure complète et du système d'authentification sécurisé.

**Composants livrés :**
- Base de données MySQL avec 9 tables (users, messages, conversations, call_logs…)
- API REST Express avec Helmet, CORS, Rate Limiting
- Authentification JWT (access token 15min + refresh token 7j avec rotation)
- Compte verrouillé après 5 tentatives échouées (30 min)
- Redis pour cache de présence et blacklist de tokens
- Docker Compose orchestrant MySQL, Redis, Backend, Frontend, Nginx, Coturn

**Endpoints Phase 1 :**
```
POST   /api/auth/register       Créer un compte
POST   /api/auth/login          Connexion
POST   /api/auth/refresh        Renouveler le token
POST   /api/auth/logout         Déconnexion
POST   /api/auth/logout-all     Déconnecter toutes les sessions
GET    /api/auth/me             Profil connecté
POST   /api/auth/change-password  Changer le mot de passe
```

---

### Phase 2 — Messagerie temps réel ✅

**Objectif :** Messagerie instantanée complète avec Socket.IO.

**Fonctionnalités livrées :**
- Conversations directes (1-à-1) et de groupe
- Messages texte, fichiers, images (jusqu'à 100 Mo)
- Réponse à un message (reply)
- Édition et suppression de messages
- Réactions emoji (toggle)
- Indicateur de saisie en temps réel (typing…)
- Accusés de lecture (last_read_at)
- Compteur de messages non lus
- Synchronisation multi-onglets via Socket.IO rooms

**Endpoints Phase 2 :**
```
GET    /api/conversations                           Liste des conversations
POST   /api/conversations                           Créer une conversation
GET    /api/conversations/:id/messages              Messages (pagination)
POST   /api/conversations/:id/messages              Envoyer un message
PUT    /api/conversations/:convId/messages/:msgId   Éditer un message
DELETE /api/conversations/:convId/messages/:msgId   Supprimer un message
POST   /api/conversations/:convId/messages/:msgId/reactions  Réaction emoji
POST   /api/conversations/:id/read                  Marquer comme lu
```

**Événements Socket.IO Phase 2 :**
```
message:new          Nouveau message reçu
message:edited       Message modifié
message:deleted      Message supprimé
message:typing       Indicateur de saisie
message:reaction_added    Réaction ajoutée
message:reaction_removed  Réaction retirée
conversation:new     Nouvelle conversation créée
conversation:read    Conversation lue
```

---

### Phase 3 — Téléphonie WebRTC ✅

**Objectif :** Appels audio/vidéo en temps réel en P2P sur le LAN.

**Fonctionnalités livrées :**
- Appels audio et vidéo 1-à-1 via WebRTC
- Signalisation complète (SDP offer/answer + ICE candidates)
- Serveur STUN/TURN Coturn (100% local)
- Notification d'appel entrant avec sonnerie
- Modal d'appel entrant (accepter / refuser)
- Barre d'appel actif (micro, vidéo, attente, raccrocher)
- Compteur de durée d'appel
- Journal des appels (completed, missed, rejected)
- Rotation des médias (mute/unmute, vidéo on/off)

**Endpoints Phase 3 :**
```
GET    /api/calls               Journal des appels
POST   /api/calls               Créer une entrée de journal
GET    /api/calls/stats         Statistiques (admin)
GET    /api/calls/:id           Détail d'un appel
PATCH  /api/calls/:id           Mettre à jour le statut
```

**Événements Socket.IO Phase 3 :**
```
call:initiate        Initier un appel
call:incoming        Appel entrant reçu
call:initiated       Confirmation appel initié
call:accept          Accepter un appel
call:accepted        Appel accepté
call:reject          Rejeter un appel
call:rejected        Appel rejeté
call:end             Terminer un appel
call:ended           Appel terminé
webrtc:offer         Offre SDP WebRTC
webrtc:answer        Réponse SDP WebRTC
webrtc:ice-candidate Candidat ICE WebRTC
call:toggle-mute     Couper/activer micro
call:toggle-video    Couper/activer caméra
call:mute-changed    Changement état micro (distant)
call:video-changed   Changement état vidéo (distant)
```

---

### Phase 4 — Administration & Présence ✅

**Objectif :** Panel d'administration et système de présence.

**Fonctionnalités livrées :**
- Tableau de bord administrateur (gestion des utilisateurs)
- Créer / modifier / désactiver des comptes
- Attribution des rôles (user / admin)
- Annuaire des utilisateurs avec filtres (service, statut)
- Gestion de la présence (en ligne, absent, ne pas déranger, hors ligne)
- Mise à jour de la présence en temps réel via Socket.IO
- Gestion du profil (nom, service, poste téléphonique)
- Upload d'avatar
- Documentation API Swagger automatique

**Endpoints Phase 4 :**
```
GET    /api/users               Annuaire (pagination + recherche)
GET    /api/users/:id           Profil utilisateur
PUT    /api/users/me            Mettre à jour son profil
POST   /api/users/me/avatar     Upload avatar
GET    /api/users/me/presence   Obtenir son statut
PUT    /api/users/me/presence   Changer son statut
POST   /api/users/admin         Créer utilisateur (admin)
PUT    /api/users/admin/:id     Modifier utilisateur (admin)
DELETE /api/users/admin/:id     Désactiver utilisateur (admin)
```

**Événements Socket.IO Phase 4 :**
```
user:presence        Changement de présence d'un utilisateur
user:set-status      Définir son statut de présence
```

---

## 🧪 Tests <a name="tests"></a>

### Tests unitaires Jest (backend)

```bash
# Se connecter au conteneur backend
docker compose exec backend sh

# Lancer tous les tests
npm test

# Avec rapport de couverture
npm run test:coverage

# En mode watch (développement)
npx jest --watch
```

**Tests inclus :**
- `auth.test.js` — 12 tests : inscription, connexion, sécurité JWT, verrouillage compte
- `conversations.test.js` — 11 tests : création conversations, envoi/édition/suppression messages, réactions

**Résultat attendu :**
```
✓ devrait créer un compte avec des données valides
✓ devrait rejeter un nom d'utilisateur déjà pris
✓ devrait rejeter un mot de passe faible
✓ devrait connecter avec des identifiants valides
✓ devrait refuser un mot de passe incorrect
✓ devrait refuser si le compte est verrouillé
... (23 tests au total)
```

### Tests d'intégration API (curl)

```bash
# Depuis la machine serveur ou toute machine du LAN
# Remplacer https://192.168.1.10 par l'URL réelle
bash scripts/test-api.sh https://192.168.1.10
```

**Ce script teste automatiquement :**
- Phase 1 : Healthcheck, inscription, connexion, profil
- Phase 2 : Annuaire, création conversation, envoi message, réaction, édition, suppression
- Phase 3 : Journal des appels
- Phase 4 : Sécurité (401/403/404)

**Résultat attendu :**
```
✓ GET /health (HTTP 200)
✓ POST /api/auth/register (HTTP 201)
✓ POST /api/auth/login (HTTP 200)
✓ Token JWT reçu (xxx chars)
✓ GET /api/auth/me (HTTP 200)
... etc.

══════════════════════════════════════════════════════
  Résultats : 22 passés / 0 échoués / 22 total
══════════════════════════════════════════════════════
```

### Tests manuels de l'interface (navigateur)

#### Test de messagerie temps réel

1. Ouvrir deux navigateurs ou onglets en navigation privée
2. Se connecter avec deux comptes différents
3. Depuis le compte A → Annuaire → cliquer "Message" sur le compte B
4. Envoyer un message depuis A → il doit apparaître instantanément chez B
5. Vérifier l'indicateur de saisie (typing…)
6. Tester la réponse (reply), l'édition et la suppression

#### Test d'appel audio

1. Deux navigateurs connectés avec deux comptes
2. Depuis le compte A → Annuaire → cliquer le bouton 📞 sur le compte B
3. Sur le compte B → la modal "Appel entrant" doit s'afficher avec la sonnerie
4. Cliquer "Accepter" → la communication doit s'établir
5. Vérifier le compteur de durée
6. Tester le mute (🎤) puis raccrocher (📵)
7. Vérifier que l'appel apparaît dans le journal des appels

#### Test d'appel vidéo

1. Même procédure qu'audio, utiliser le bouton 📹
2. Autoriser l'accès caméra dans le navigateur
3. Vérifier les flux vidéo local (miniature) et distant (plein écran)

#### Test de présence

1. Modifier son statut (Profil → Statut de présence)
2. Chez l'autre utilisateur → l'annuaire et la sidebar doivent se mettre à jour en temps réel

### Tests de charge (optionnel)

```bash
# Installer Apache Bench
sudo apt install apache2-utils

# Test de charge sur l'API
ab -n 1000 -c 50 -H "Authorization: Bearer TOKEN" https://192.168.1.10/api/users

# Test WebSocket avec wscat
npm install -g wscat
wscat -c "wss://192.168.1.10/socket.io/?EIO=4&transport=websocket"
```

---

## 👤 Comptes par défaut <a name="comptes"></a>

| Rôle | Identifiant | Mot de passe | Notes |
|---|---|---|---|
| Administrateur | `admin` | `Admin@CapEpac2025` | **Changer impérativement en production** |

Pour changer le mot de passe admin :

```bash
# Via l'interface : Se connecter → Profil → Changer le mot de passe
# Via MySQL directement :
docker compose exec mysql mysql -u root -pCapEpac@Root2025 cap_epac_telephonie
UPDATE users SET password_hash = '$2b$12$NOUVEAU_HASH' WHERE username = 'admin';
```

Générer un hash bcrypt :
```bash
node -e "const b=require('bcrypt');b.hash('VotreNouveauMotDePasse',12).then(console.log)"
```

---

## 🌐 URLs et ports <a name="urls"></a>

| Service | URL / Port | Description |
|---|---|---|
| **Application** | `https://192.168.1.10` | Interface principale |
| **API REST** | `https://192.168.1.10/api` | Backend |
| **Documentation API** | `https://192.168.1.10/api/docs` | Swagger UI |
| **Socket.IO** | `wss://192.168.1.10/socket.io` | Temps réel |
| **MySQL** | `192.168.1.10:3306` | Base de données (interne) |
| **Redis** | Interne seulement | Cache |
| **STUN/TURN** | `192.168.1.10:3478` (UDP/TCP) | WebRTC |
| **TURN TLS** | `192.168.1.10:5349` | WebRTC sécurisé |

### Certificats SSL dans le navigateur

Comme les certificats sont auto-signés, les navigateurs afficheront un avertissement de sécurité. Pour l'accepter :

- **Chrome/Edge** : Cliquer "Paramètres avancés" → "Continuer vers le site (non sécurisé)"
- **Firefox** : Cliquer "Avancé" → "Accepter le risque"

Pour éviter cet avertissement, importer le certificat dans les navigateurs :

```bash
# Chemin du certificat
cat nginx/ssl/cert.pem
```

- **Windows** : Double-clic sur `cert.pem` → "Installer le certificat" → "Autorités de certification racines de confiance"
- **Ubuntu** : `sudo cp nginx/ssl/cert.pem /usr/local/share/ca-certificates/cap-epac.crt && sudo update-ca-certificates`
- **macOS** : "Trousseau d'accès" → Importer → Faire confiance

---

## 🔧 Dépannage <a name="dépannage"></a>

### Les conteneurs ne démarrent pas

```bash
# Vérifier les logs d'erreur
docker compose logs mysql
docker compose logs backend
docker compose logs nginx

# Vérifier l'espace disque
df -h

# Vérifier les ports occupés
sudo ss -tlnp | grep -E '80|443|3306|3478'
```

### Erreur de connexion à MySQL

```bash
# Vérifier que MySQL est healthy
docker compose ps

# Se connecter directement à MySQL
docker compose exec mysql mysql -u cap_epac_user -pCapEpac@2025 cap_epac_telephonie

# Vérifier les tables
SHOW TABLES;
SELECT COUNT(*) FROM users;
```

### Le WebRTC ne fonctionne pas (appels impossibles)

```bash
# Vérifier que Coturn tourne
docker compose ps coturn
docker compose logs coturn

# Tester le serveur STUN
# Installer stun client
sudo apt install stun
stun 192.168.1.10:3478

# Vérifier les ports UDP ouverts (pare-feu)
sudo ufw status
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
sudo ufw allow 49152:65535/udp
```

### Le Socket.IO se déconnecte fréquemment

```bash
# Vérifier les logs Nginx
docker compose logs nginx | grep "socket"

# Vérifier le timeout Nginx (déjà configuré à 3600s dans nginx.conf)
# Si le problème persiste, redémarrer le backend
docker compose restart backend
```

### Réinitialiser la base de données

```bash
# ATTENTION : efface toutes les données
bash scripts/reset.sh

# Ou uniquement les données MySQL
docker compose exec mysql mysql -u root -pCapEpac@Root2025 -e "DROP DATABASE cap_epac_telephonie; CREATE DATABASE cap_epac_telephonie CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
docker compose restart backend
```

### Rebuild complet après modification du code

```bash
# Backend seulement
docker compose up -d --build backend

# Frontend seulement
docker compose up -d --build frontend

# Tout reconstruire
docker compose down
docker compose up -d --build
```

### Voir les utilisateurs connectés en temps réel

```bash
# Via Redis
docker compose exec redis redis-cli -a CapEpacRedis2025
KEYS presence:*
HGETALL presence:USER_ID
```

---

## 📊 Monitoring de base

```bash
# Utilisation des ressources
docker stats

# Espace disque des volumes
docker system df

# Logs des 100 dernières lignes
docker compose logs --tail=100 backend

# Nettoyage des anciens logs
docker system prune --volumes  # ATTENTION : supprime les volumes non utilisés
```

---

## 🔐 Sécurité en production

1. **Changer tous les mots de passe** dans `.env`
2. **Générer des secrets JWT forts** : `openssl rand -base64 64`
3. **Configurer le pare-feu** :
   ```bash
   sudo ufw default deny incoming
   sudo ufw allow ssh
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw allow 3478/udp  # STUN/TURN
   sudo ufw allow 49152:65535/udp  # Flux médias WebRTC
   sudo ufw enable
   ```
4. **Sauvegardes MySQL régulières** :
   ```bash
   docker compose exec mysql mysqldump -u root -pCAP_EPAC_ROOT_PASSWORD cap_epac_telephonie > backup_$(date +%Y%m%d).sql
   ```

---

## 📁 Gitignore recommandé

```gitignore
# Environnement
.env
.env.local

# Certificats SSL
nginx/ssl/

# Données
backend/uploads/
backend/logs/

# Node.js
node_modules/
dist/

# Couverture de tests
coverage/
```

---

**Téléphonie CAP-EPAC** — Développé pour une communication LAN sécurisée, instantanée et 100% locale.
