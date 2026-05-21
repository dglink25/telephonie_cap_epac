# 🧪 Guide de Test - Responsivité Cap EPAC

## 🚀 Accès à l'Application

**URL** : https://192.168.10.116

**Identifiants par défaut** :
- Utilisateur : `admin`
- Mot de passe : `Admin@CapEpac2025`

## 📱 Comment Tester sur Différents Appareils

### Option 1 : Outils de Développement du Navigateur (Recommandé)

#### Google Chrome / Edge
1. Ouvrir https://192.168.10.116
2. Appuyer sur **F12** ou **Ctrl+Shift+I**
3. Cliquer sur l'icône **📱 Toggle device toolbar** (ou **Ctrl+Shift+M**)
4. Sélectionner un appareil dans la liste déroulante :
   - iPhone SE (375x667)
   - iPhone 12 Pro (390x844)
   - iPad (768x1024)
   - iPad Pro (1024x1366)
   - Ou personnaliser la taille

#### Firefox
1. Ouvrir https://192.168.10.116
2. Appuyer sur **F12** ou **Ctrl+Shift+I**
3. Cliquer sur l'icône **📱 Responsive Design Mode** (ou **Ctrl+Shift+M**)
4. Choisir une taille d'écran prédéfinie ou personnalisée

### Option 2 : Tester sur un Vrai Appareil Mobile

#### Prérequis
- Votre téléphone/tablette doit être sur le **même réseau WiFi** que le serveur
- L'IP du serveur est **192.168.10.116**

#### Étapes
1. Sur votre mobile, ouvrir le navigateur (Chrome, Safari, Firefox...)
2. Aller à : **https://192.168.10.116**
3. Accepter l'avertissement de certificat SSL (normal pour un certificat auto-signé)
4. Se connecter avec les identifiants

## ✅ Checklist de Test

### 📱 Mobile (< 768px)

#### Page de Connexion
- [ ] Logo bien dimensionné
- [ ] Formulaire lisible et utilisable
- [ ] Boutons suffisamment grands pour le doigt
- [ ] Pas de débordement horizontal

#### Menu & Navigation
- [ ] **Bouton hamburger visible** en haut à gauche
- [ ] Clic sur hamburger **ouvre le menu latéral**
- [ ] Menu coulisse depuis la gauche avec animation
- [ ] **Overlay sombre** apparaît derrière le menu
- [ ] Clic sur overlay **ferme le menu**
- [ ] Clic sur un lien de navigation **ferme le menu** et navigue
- [ ] Bouton X en haut à droite du menu fonctionne

#### Page Chat
- [ ] **Liste des conversations** visible par défaut
- [ ] Clic sur une conversation **affiche le chat** et masque la liste
- [ ] **Bouton retour (←)** visible dans le header du chat
- [ ] Clic sur retour **revient à la liste** des conversations
- [ ] Bulles de messages **ne débordent pas** (max 85% de largeur)
- [ ] Images dans les messages **bien dimensionnées**
- [ ] Zone de saisie **accessible et utilisable**
- [ ] Boutons d'action (micro, emoji, pièce jointe) **bien espacés**

#### Page Annuaire
- [ ] Champ de recherche **pleine largeur**
- [ ] Select "Services" **pleine largeur** (en dessous de la recherche)
- [ ] Cartes utilisateurs **1 par ligne**
- [ ] Boutons d'action dans les cartes **utilisables au doigt**

#### Page Appels
- [ ] Onglets de filtres **défilent horizontalement** si nécessaire
- [ ] Lignes d'appels **lisibles et compactes**
- [ ] Icônes et textes **bien proportionnés**

### 📱 Tablette (768px - 1024px)

#### Menu & Navigation
- [ ] **Sidebar compacte** visible (icônes seulement, ~80px)
- [ ] Pas de texte à côté des icônes
- [ ] Avatar utilisateur centré en bas
- [ ] Hover sur les icônes montre un effet visuel

#### Page Chat
- [ ] Liste conversations **visible** (320px)
- [ ] Zone de chat **visible** en même temps
- [ ] Pas besoin de bouton retour

#### Page Annuaire
- [ ] Recherche et select **sur la même ligne**
- [ ] Grille **2 colonnes**

### 💻 Desktop (> 1024px)

#### Menu & Navigation
- [ ] **Sidebar complète** visible (256px)
- [ ] Texte visible à côté des icônes
- [ ] Sections "Communication", "Annuaire", "Compte" visibles
- [ ] Statut de connexion avec texte

#### Page Chat
- [ ] Liste + chat **côte à côte**
- [ ] Proportions équilibrées

#### Page Annuaire
- [ ] Grille **3 colonnes** sur écrans XL (> 1280px)

## 🎨 Points d'Attention Visuels

### Espacement
- [ ] Pas d'éléments trop serrés sur mobile
- [ ] Padding cohérent sur tous les écrans
- [ ] Marges adaptées à la taille d'écran

### Typographie
- [ ] Texte lisible sur mobile (pas trop petit)
- [ ] Hiérarchie visuelle claire
- [ ] Pas de texte coupé ou tronqué

### Interactions
- [ ] Zones tactiles **minimum 44x44px** sur mobile
- [ ] Feedback visuel au clic/tap
- [ ] Animations fluides (pas de saccades)

### Modals
- [ ] Centrées sur tous les écrans
- [ ] Scrollables si contenu trop long
- [ ] Bouton fermer accessible
- [ ] Pas de débordement

## 🐛 Problèmes Courants à Vérifier

### Mobile
- ❌ Scroll horizontal indésirable
- ❌ Texte trop petit pour être lu
- ❌ Boutons trop petits pour être cliqués
- ❌ Images qui débordent
- ❌ Menu qui ne s'ouvre pas
- ❌ Impossible de revenir en arrière

### Tablette
- ❌ Sidebar qui prend trop de place
- ❌ Contenu mal centré
- ❌ Grille mal alignée

### Tous appareils
- ❌ Éléments qui se chevauchent
- ❌ Contenu coupé
- ❌ Animations saccadées
- ❌ Modals qui débordent

## 📊 Tailles d'Écran Recommandées pour les Tests

| Appareil | Largeur | Hauteur | Orientation |
|----------|---------|---------|-------------|
| iPhone SE | 375px | 667px | Portrait |
| iPhone 12 Pro | 390px | 844px | Portrait |
| iPhone 12 Pro | 844px | 390px | Paysage |
| iPad | 768px | 1024px | Portrait |
| iPad | 1024px | 768px | Paysage |
| iPad Pro | 1024px | 1366px | Portrait |
| Desktop HD | 1920px | 1080px | - |
| Desktop 4K | 3840px | 2160px | - |

## 🔍 Outils de Test Supplémentaires

### Extensions Navigateur
- **Responsive Viewer** (Chrome) : Teste plusieurs tailles simultanément
- **Window Resizer** (Chrome/Firefox) : Redimensionne rapidement
- **Mobile Simulator** : Simule des appareils réels

### Services en Ligne
- **BrowserStack** : Teste sur de vrais appareils
- **LambdaTest** : Tests multi-navigateurs
- **Responsinator** : Vue rapide sur plusieurs tailles

## ✨ Résultat Attendu

Sur **tous les appareils**, l'application doit :
- ✅ S'afficher correctement sans débordement
- ✅ Être entièrement utilisable au doigt (mobile/tablette)
- ✅ Avoir une navigation intuitive
- ✅ Charger rapidement
- ✅ Offrir une expérience fluide

## 📞 Support

Si vous rencontrez des problèmes :
1. Vérifier la console du navigateur (F12 → Console)
2. Vérifier les logs Docker : `sudo docker compose logs -f frontend`
3. Redémarrer le conteneur : `sudo docker compose restart frontend`

---

**Bon test ! 🚀**
