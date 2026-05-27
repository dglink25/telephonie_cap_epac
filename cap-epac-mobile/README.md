# 📱 CAP-EPAC Mobile — Guide d'installation et démarrage

## Table des matières
1. [Prérequis](#prérequis)
2. [Structure du projet](#structure)
3. [Configuration](#configuration)
4. [Installation Android](#android)
5. [Certificat SSL LAN](#ssl)
6. [Démarrage développement](#dev)
7. [Build production APK](#apk)
8. [Fonctionnalités](#fonctionnalités)
9. [Dépannage](#dépannage)

---

## 1. Prérequis

### Sur le PC de développement

| Outil | Version min | Installation |
|-------|-------------|--------------|
| Node.js | 18+ | https://nodejs.org |
| JDK | 17 | `sudo apt install openjdk-17-jdk` |
| Android Studio | Hedgehog+ | https://developer.android.com/studio |
| Android SDK | API 33+ | Via Android Studio SDK Manager |
| React Native CLI | latest | `npm install -g react-native-cli` |

### Variables d'environnement à ajouter dans `~/.bashrc` ou `~/.zshrc`

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
```

Puis recharger : `source ~/.bashrc`

### Vérification de l'environnement

```bash
npx react-native doctor
```

---

## 2. Structure du projet

```
cap-epac-mobile/
├── App.tsx                          # Racine de l'app
├── index.js                         # Point d'entrée React Native
├── app.json                         # Config app (nom, version)
├── package.json                     # Dépendances npm
├── babel.config.js                  # Config Babel
├── tsconfig.json                    # Config TypeScript
│
├── android/                         # Projet Android natif
│   └── app/src/main/
│       ├── AndroidManifest.xml      # Permissions Android
│       └── res/xml/
│           └── network_security_config.xml  # Config SSL LAN
│
├── src/
│   ├── navigation/
│   │   └── AppNavigator.tsx         # Navigation principale (Stack + Tabs)
│   │
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx      # Connexion
│   │   │   └── RegisterScreen.tsx   # Inscription
│   │   ├── main/
│   │   │   ├── ConversationsScreen.tsx  # Liste des conversations
│   │   │   ├── ChatScreen.tsx           # Chat (messages, réactions, édition)
│   │   │   ├── ContactsScreen.tsx       # Annuaire + présence
│   │   │   ├── ProfileScreen.tsx        # Profil + préférences
│   │   │   └── NewConversationScreen.tsx # Créer conv / groupe
│   │   ├── calls/
│   │   │   ├── IncomingCallScreen.tsx   # Appel entrant (sonnerie)
│   │   │   ├── OutgoingCallScreen.tsx   # Appel sortant
│   │   │   ├── ActiveCallScreen.tsx     # Appel en cours + WebRTC
│   │   │   └── CallHistoryScreen.tsx    # Historique appels
│   │   ├── groups/
│   │   │   └── GroupInfoScreen.tsx      # Infos + gestion membres groupe
│   │   └── admin/
│   │       └── AdminScreen.tsx          # Panneau administrateur
│   │
│   ├── services/
│   │   ├── api.ts                   # Client Axios + tous les endpoints
│   │   └── socket.ts                # Client Socket.IO temps réel
│   │
│   ├── store/
│   │   ├── authStore.ts             # État authentification (Zustand)
│   │   ├── chatStore.ts             # État conversations + messages
│   │   └── callStore.ts             # État appels WebRTC
│   │
│   ├── hooks/
│   │   └── useSocket.ts             # Hook événements Socket.IO
│   │
│   ├── components/
│   │   └── common/
│   │       └── index.tsx            # Avatar, Button, Input, Badge, etc.
│   │
│   └── utils/
│       └── constants.ts             # Couleurs, tailles, constantes
```

---

## 3. Configuration

### 3.1 Adresse IP du serveur

Ouvrir **`src/services/api.ts`** et **`src/services/socket.ts`**, modifier :

```typescript
// src/services/api.ts
const BASE_URL = 'https://192.168.100.195/api';  // ← Votre IP LAN

// src/services/socket.ts
const SOCKET_URL = 'https://192.168.100.195';     // ← Votre IP LAN
```

Pour trouver l'IP du serveur sur Ubuntu :
```bash
hostname -I | awk '{print $1}'
# ou
ip route get 1.1.1.1 | grep -oP 'src \K\S+'
```

### 3.2 Android — config réseau

Dans `android/app/src/main/res/xml/network_security_config.xml`, remplacer l'IP :

```xml
<domain includeSubdomains="true">192.168.100.195</domain>
<!-- Mettre votre IP LAN ici -->
```

---

## 4. Installation Android

### 4.1 Cloner et installer les dépendances

```bash
# Cloner le projet (ou copier le dossier)
cd cap-epac-mobile

# Installer les dépendances Node
npm install

# Lier les packages natifs Android (automatique avec React Native 0.73+)
# Rien à faire si autolink est activé
```

### 4.2 Configurer Android Studio

1. Ouvrir Android Studio
2. `File → Open` → sélectionner le dossier `android/` du projet
3. Laisser Gradle synchroniser (peut prendre 3-5 min la première fois)
4. Créer un émulateur : `Tools → Device Manager → Create Device`
   - Recommandé : **Pixel 7**, Android **API 33** (Android 13)

### 4.3 Installer les packages natifs spécifiques

Certains packages nécessitent une configuration native manuelle :

#### react-native-vector-icons
```bash
# Dans android/app/build.gradle, ajouter :
apply from: "../../node_modules/react-native-vector-icons/fonts.gradle"
```

#### react-native-webrtc
Déjà configuré via autolink. Vérifier que les permissions sont dans AndroidManifest.xml ✅

#### react-native-permissions
```bash
# Dans android/app/build.gradle → android → defaultConfig :
# Les permissions sont déclarées dans AndroidManifest.xml ✅
```

---

## 5. Certificat SSL LAN (CRITIQUE)

Le serveur utilise un certificat mkcert auto-signé. Il faut l'importer sur l'appareil Android.

### 5.1 Récupérer le certificat CA

```bash
# Sur le serveur CAP-EPAC
cat nginx/ssl/rootCA.pem
# ou télécharger via :
# http://192.168.100.195:8080/rootCA.pem
```

### 5.2 Importer dans l'app (recommandé)

Copier le fichier `rootCA.pem` en :
```
android/app/src/main/res/raw/cap_epac_ca.pem
```

> Le fichier doit s'appeler `cap_epac_ca.pem` (sans tirets dans le nom).

### 5.3 Importer sur l'appareil Android physique

1. Télécharger le certificat : `http://192.168.100.195:8080/rootCA.pem`
2. `Paramètres → Sécurité → Chiffrement et accréditations → Installer un certificat`
3. Sélectionner `Certificat CA`
4. Choisir le fichier téléchargé

### 5.4 Émulateur Android

Sur l'émulateur, désactiver temporairement la vérification SSL en dev :

Dans `src/services/api.ts`, ajouter dans la config axios :
```typescript
// DEV UNIQUEMENT — à retirer en production
import { Platform } from 'react-native';
// L'émulateur passe par 10.0.2.2 pour atteindre localhost
const BASE_URL = Platform.OS === 'android'
  ? 'https://10.0.2.2/api'   // émulateur
  : 'https://192.168.100.195/api'; // appareil physique
```

---

## 6. Démarrage développement

### 6.1 Démarrer le serveur Metro (bundler)

```bash
cd cap-epac-mobile
npx react-native start
# Ou : npm start
```

### 6.2 Lancer sur émulateur Android

```bash
# Dans un second terminal
npx react-native run-android
# Ou : npm run android
```

### 6.3 Lancer sur appareil physique

1. Activer le **mode développeur** sur l'Android :
   `Paramètres → À propos → Numéro de build (tapper 7 fois)`

2. Activer le **débogage USB** :
   `Paramètres → Options développeur → Débogage USB`

3. Brancher l'appareil en USB, puis :
```bash
# Vérifier que l'appareil est détecté
adb devices

# Lancer l'app
npx react-native run-android
```

### 6.4 Rechargement à chaud

- **Secouer l'appareil** → Menu développeur → `Enable Fast Refresh`
- Ou appuyer **R+R** dans le terminal Metro pour recharger manuellement

---

## 7. Build production APK

### 7.1 Générer une clé de signature

```bash
cd android/app
keytool -genkey -v \
  -keystore cap-epac-release.keystore \
  -alias cap-epac \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### 7.2 Configurer la signature dans Gradle

Dans `android/gradle.properties` :
```properties
MYAPP_RELEASE_STORE_FILE=cap-epac-release.keystore
MYAPP_RELEASE_KEY_ALIAS=cap-epac
MYAPP_RELEASE_STORE_PASSWORD=VotreMotDePasse
MYAPP_RELEASE_KEY_PASSWORD=VotreMotDePasse
```

Dans `android/app/build.gradle` → section `android → signingConfigs` :
```groovy
release {
    storeFile file(MYAPP_RELEASE_STORE_FILE)
    storePassword MYAPP_RELEASE_STORE_PASSWORD
    keyAlias MYAPP_RELEASE_KEY_ALIAS
    keyPassword MYAPP_RELEASE_KEY_PASSWORD
}
```

### 7.3 Builder l'APK

```bash
cd android
./gradlew assembleRelease

# L'APK se trouve dans :
# android/app/build/outputs/apk/release/app-release.apk
```

### 7.4 Installer l'APK sur un appareil

```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

### 7.5 Builder un AAB (pour déploiement Play Store)

```bash
cd android
./gradlew bundleRelease
# Output : android/app/build/outputs/bundle/release/app-release.aab
```

---

## 8. Fonctionnalités

### ✅ Authentification
- Connexion par identifiant ou email
- Inscription avec validation (service obligatoire, mot de passe fort)
- Refresh token automatique (session persistante)
- Changement de mot de passe
- Déconnexion simple et de toutes les sessions

### ✅ Messagerie temps réel (Socket.IO)
- Conversations directes et groupes
- Messages texte, images, fichiers, audio, vidéo
- Réponses à un message (reply)
- Modification de message (15 minutes)
- Suppression de message
- Réactions emoji (👍 ❤️ 😂 😮 😢 🙏)
- Indicateur de frappe en temps réel
- Compteur messages non lus
- Marquage lu automatique
- Groupe Général (tous les membres)

### ✅ Appels WebRTC
- Appels audio et vidéo 1-1
- Appels de groupe
- Sonnerie entrante avec vibration
- Contrôles : micro, haut-parleur, vidéo, raccrocher
- Historique des appels avec filtres
- Rappel rapide depuis l'historique

### ✅ Contacts & Présence
- Annuaire par département
- Statuts de présence temps réel (En ligne / Absent / Ne pas déranger / Hors ligne)
- Changement de son propre statut
- Appel direct depuis la fiche contact

### ✅ Groupes
- Création de groupes
- Gestion des membres (ajouter, retirer, promouvoir admin)
- Modification nom et description
- Quitter un groupe
- Messages système automatiques

### ✅ Profil
- Photo de profil
- Informations personnelles
- Changement de statut de présence

### ✅ Administration (admin uniquement)
- Liste de tous les utilisateurs (actifs + inactifs)
- Modifier un utilisateur (rôle, département, extension)
- Activer / désactiver un compte
- Statistiques des appels

---

## 9. Dépannage

### ❌ Erreur de connexion SSL

```
Network Error: unable to verify the first certificate
```

**Solution** : Importer la CA racine du serveur (voir §5).

Pour le développement rapide, dans `src/services/api.ts` ajouter :
```typescript
// TEMPORAIRE DEV UNIQUEMENT
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```

---

### ❌ Metro bundler ne démarre pas

```bash
# Vider le cache
npx react-native start --reset-cache
```

---

### ❌ `adb: command not found`

```bash
# Ajouter au PATH
export PATH=$PATH:$HOME/Android/Sdk/platform-tools
source ~/.bashrc
```

---

### ❌ Gradle build échoue

```bash
cd android
./gradlew clean
cd ..
npm install
npx react-native run-android
```

---

### ❌ Socket.IO ne se connecte pas

1. Vérifier que le backend est démarré : `docker compose ps`
2. Vérifier l'IP dans `src/services/socket.ts`
3. Vérifier que le port 443/80 est accessible depuis l'appareil
4. Tester depuis le navigateur de l'appareil : `https://192.168.100.195/health`


---

### ❌ Appels WebRTC sans audio/vidéo

1. Accepter les permissions micro/caméra quand l'app le demande
2. Vérifier dans `Paramètres → Apps → CAP-EPAC → Permissions`
3. Sur Android 12+ : activer Bluetooth pour l'oreillette

---

### ❌ `Could not find com.android.tools.build:gradle`

Dans `android/build.gradle`, vérifier la version Gradle :
```groovy
classpath("com.android.tools.build:gradle:8.1.4")
```

---

## Comptes par défaut

| Identifiant | Mot de passe | Rôle |
|-------------|--------------|------|
| admin | Admin@CapEpac2025 | Administrateur |

---

## Notes de déploiement LAN

- L'application est conçue pour un **réseau LAN interne** uniquement
- Aucune donnée ne sort du réseau local
- Le certificat SSL est généré par **mkcert** (CA de confiance locale)
- Pour distribuer l'APK en interne : copier `app-release.apk` sur un serveur de fichiers interne ou envoyer par email

---

*CAP-EPAC Téléphonie Mobile — v1.0.0 — Réseau LAN interne*
