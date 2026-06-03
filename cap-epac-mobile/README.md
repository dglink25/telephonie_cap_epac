# 📱 CapEPAC Mobile

Application mobile React Native pour le système de messagerie et d'appels CapEPAC.

---

## 🚀 Démarrage Rapide

```bash
# Installation
npm install

# iOS - Pods
cd ios && pod install && cd ..

# Démarrer Metro
npm start

# Lancer Android
npm run android

# Lancer iOS
npm run ios
```

---

## ✨ Fonctionnalités

### ✅ Implémentées

- 🔐 **Authentification** - Login/Register avec JWT + refresh token
- 💬 **Messagerie** 
  - Messages texte en temps réel
  - Réactions emoji (6 presets)
  - Édition messages (15 min window)
  - Suppression messages
  - Répondre à un message
  - Indicateurs de lecture (✓ envoyé, ✓✓ délivré, ✓✓ lu)
  - Typing indicators
  
- 📎 **Fichiers** (NOUVEAU ✨)
  - Upload photos/vidéos depuis galerie
  - Upload documents (PDF, DOCX, etc.)
  - Validation 100 MB max
  - Preview images inline
  
- 🔔 **Notifications** (NOUVEAU ✨)
  - Réception temps réel via Socket.IO
  - Badge compteur non-lues
  - Marquer comme lu/supprimer
  - Navigation vers contenu lié
  
- 👥 **Groupes**
  - Créer/rejoindre groupes
  - Gestion membres et rôles (admin/member)
  - Avatar de groupe
  - Quitter groupe
  
- 📞 **Appels** (UI seulement)
  - Écrans incoming/outgoing/active
  - Événements Socket.IO configurés
  - ⚠️ WebRTC pas encore intégré

### 🔜 À Venir

- 📞 WebRTC complet (audio/vidéo réel)
- 🛡️ Admin panel
- 🔍 Recherche dans messages
- 📥 Download fichiers
- 🖼️ Image viewer full-screen
- 🔊 Push notifications (FCM)

---

## 📁 Structure du Projet

```
cap-epac-mobile/
├── src/
│   ├── components/       # Composants réutilisables
│   ├── screens/          # Écrans de l'app
│   │   ├── auth/         # Login, Register
│   │   ├── main/         # Chat, Conversations, Notifications
│   │   ├── calls/        # IncomingCall, ActiveCall
│   │   └── groups/       # GroupInfo
│   ├── services/         # API, Socket.IO
│   ├── store/            # Zustand stores (chat, auth, call, notification)
│   ├── hooks/            # Custom hooks (useSocket)
│   ├── utils/            # Constantes, helpers
│   └── navigation/       # React Navigation setup
├── android/              # Code natif Android
├── ios/                  # Code natif iOS
├── INSTALLATION_GUIDE.md # Guide installation complet
├── PERMISSIONS_SETUP.md  # Configuration permissions
└── package.json
```

---

## 🛠️ Technologies

- **React Native** 0.76.5
- **TypeScript** 5.0.4
- **React Navigation** 7.x (Stack + Bottom Tabs)
- **Socket.IO Client** 4.7.5
- **Zustand** 4.5.5 (State management)
- **Axios** 1.7.9
- **date-fns** 3.0.0 (Date formatting)
- **react-native-image-picker** 7.1.2
- **react-native-document-picker** 9.3.1
- **react-native-permissions** 4.1.5

---

## 📝 Configuration

### 1. Backend URL

Modifier dans `src/services/api.ts` :
```typescript
export const SERVER_BASE = 'http://VOTRE_IP:3000';
```

Et dans `src/services/socket.ts` :
```typescript
const SOCKET_URL = 'https://VOTRE_IP:3000';
```

### 2. Permissions

Voir **[PERMISSIONS_SETUP.md](./PERMISSIONS_SETUP.md)** pour la configuration complète.

---

## 📦 Build Production

### Android APK

```bash
cd android
./gradlew assembleRelease

# APK généré dans :
# android/app/build/outputs/apk/release/app-release.apk
```

### Android AAB (Google Play)

```bash
cd android
./gradlew bundleRelease

# AAB généré dans :
# android/app/build/outputs/bundle/release/app-release.aab
```

### iOS

1. Ouvrir `ios/CapEpacMobile.xcworkspace` dans Xcode
2. Sélectionner "Any iOS Device"
3. Product > Archive
4. Distribute App

---

## 🐛 Dépannage

### Cache issues
```bash
npm start -- --reset-cache
```

### Android build fails
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### iOS pods issues
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

Voir **[INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md)** pour plus de détails.

---

## 📊 État du Projet

| Feature | Status |
|---------|--------|
| Auth | 🟢 Complet |
| Messages | 🟢 Complet |
| Fichiers | 🟢 Complet (NOUVEAU) |
| Notifications | 🟢 Complet (NOUVEAU) |
| Groupes | 🟡 Partiel |
| Appels | 🔴 UI seulement |
| Admin | 🔴 À faire |

Voir **[../IMPLEMENTATION_PROGRESS.md](../IMPLEMENTATION_PROGRESS.md)** pour le détail complet.

---

## 📚 Documentation

- **[Installation](./INSTALLATION_GUIDE.md)** - Guide d'installation complet
- **[Permissions](./PERMISSIONS_SETUP.md)** - Configuration des permissions
- **[API Backend](../backend/README.md)** - Documentation API

---

## 🤝 Contribution

1. Créer une branche feature : `git checkout -b feature/ma-feature`
2. Commit : `git commit -m 'Add feature'`
3. Push : `git push origin feature/ma-feature`
4. Ouvrir une Pull Request

---

## 📄 Licence

Propriétaire - CapEPAC 2026

---

**Dernière mise à jour :** 2 Juin 2026  
**Version :** 1.0.0  
**Nouvelles fonctionnalités :** Notifications + Upload fichiers ✨
