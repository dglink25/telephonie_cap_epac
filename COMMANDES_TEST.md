# 🚀 Commandes pour Redémarrer et Tester

## 📦 Reconstruire et Redémarrer le Frontend

```bash
# Option 1 : Reconstruire UNIQUEMENT le frontend (plus rapide)
sudo docker compose up -d --build frontend

# Option 2 : Reconstruire TOUT (si vous avez des doutes)
sudo docker compose up -d --build

# Option 3 : Redémarrer sans reconstruire (si déjà construit)
sudo docker compose restart frontend
```

## 🔍 Vérifier l'État des Services

```bash
# Voir tous les conteneurs
sudo docker compose ps

# Voir uniquement le frontend
sudo docker compose ps frontend

# Vérifier que tous les services sont "Up" et "healthy"
```

## 📋 Voir les Logs

```bash
# Logs du frontend en temps réel (Ctrl+C pour arrêter)
sudo docker compose logs -f frontend

# Logs de tous les services
sudo docker compose logs -f

# Dernières 50 lignes des logs frontend
sudo docker compose logs --tail=50 frontend

# Logs avec timestamps
sudo docker compose logs -f --timestamps frontend
```

## 🌐 Tester l'Application

### Sur PC
```bash
# 1. Ouvrir le navigateur
firefox https://192.168.10.116
# ou
google-chrome https://192.168.10.116

# 2. Accepter le certificat SSL auto-signé

# 3. Tester la responsivité
# - Appuyer sur F12 (ouvrir DevTools)
# - Appuyer sur Ctrl+Shift+M (mode responsive)
# - Sélectionner différentes tailles d'écran
```

### Sur Mobile/Tablette
```bash
# 1. Connecter votre appareil au même réseau WiFi
# 2. Ouvrir le navigateur mobile
# 3. Aller sur : https://192.168.10.116
# 4. Accepter le certificat
# 5. Tester la navigation
```

## 🔧 Commandes de Dépannage

### Si le frontend ne démarre pas
```bash
# 1. Arrêter tous les services
sudo docker compose down

# 2. Supprimer les conteneurs et images
sudo docker compose down --rmi local

# 3. Reconstruire tout
sudo docker compose up -d --build

# 4. Vérifier les logs
sudo docker compose logs -f
```

### Si vous voyez des erreurs
```bash
# Voir les erreurs du frontend
sudo docker compose logs frontend | grep -i error

# Voir les erreurs de build
sudo docker compose build frontend

# Entrer dans le conteneur pour débugger
sudo docker compose exec frontend sh
```

### Nettoyer complètement Docker (ATTENTION : supprime tout)
```bash
# Arrêter tous les conteneurs
sudo docker compose down

# Supprimer les volumes (ATTENTION : perte de données)
sudo docker compose down -v

# Nettoyer Docker complètement
sudo docker system prune -a --volumes

# Redémarrer
sudo docker compose up -d --build
```

## 📊 Vérifier les Modifications

### Fichiers Modifiés
```bash
# Voir les fichiers modifiés
git status

# Voir les différences
git diff frontend/src/

# Liste des fichiers frontend modifiés
git diff --name-only | grep frontend
```

### Tester les Breakpoints
```bash
# Dans le navigateur (F12 → Console), tester :
window.innerWidth  # Largeur actuelle
window.innerHeight # Hauteur actuelle

# Tester différentes tailles :
# - 375px (mobile)
# - 768px (tablette)
# - 1024px (desktop)
# - 1920px (grand écran)
```

## 🎯 Checklist Rapide

```bash
# 1. Reconstruire
sudo docker compose up -d --build frontend

# 2. Attendre 30 secondes

# 3. Vérifier l'état
sudo docker compose ps

# 4. Voir les logs (vérifier qu'il n'y a pas d'erreurs)
sudo docker compose logs --tail=20 frontend

# 5. Tester dans le navigateur
# https://192.168.10.116

# 6. Tester le mode responsive (F12 → Ctrl+Shift+M)
```

## 📱 Tests Responsivité Rapides

### Test Mobile
```bash
# Dans DevTools (F12), sélectionner :
# - iPhone SE (375x667)
# - Vérifier le menu hamburger
# - Tester la navigation
# - Vérifier les bulles de messages
```

### Test Tablette
```bash
# Dans DevTools (F12), sélectionner :
# - iPad (768x1024)
# - Vérifier la sidebar compacte
# - Tester la grille (2 colonnes)
```

### Test Desktop
```bash
# Dans DevTools (F12), sélectionner :
# - Responsive (1920x1080)
# - Vérifier la sidebar complète
# - Tester la grille (3 colonnes)
```

## 🆘 En Cas de Problème

### Le site ne charge pas
```bash
# 1. Vérifier que nginx est démarré
sudo docker compose ps nginx

# 2. Redémarrer nginx
sudo docker compose restart nginx

# 3. Vérifier les logs nginx
sudo docker compose logs nginx
```

### Erreur 502 Bad Gateway
```bash
# Le backend n'est pas accessible
sudo docker compose restart backend
sudo docker compose logs backend
```

### Erreur de certificat SSL
```bash
# C'est normal ! Cliquer sur "Avancé" puis "Accepter le risque"
# Le certificat est auto-signé pour le développement local
```

### Les modifications ne s'affichent pas
```bash
# 1. Vider le cache du navigateur (Ctrl+Shift+Delete)
# 2. Recharger la page (Ctrl+F5)
# 3. Reconstruire le frontend
sudo docker compose up -d --build frontend
```

## 📞 Commandes Utiles Supplémentaires

```bash
# Voir l'utilisation des ressources
sudo docker stats

# Voir les images Docker
sudo docker images

# Voir les volumes
sudo docker volume ls

# Arrêter tous les services
sudo docker compose stop

# Démarrer tous les services
sudo docker compose start

# Redémarrer tous les services
sudo docker compose restart

# Voir la configuration Docker Compose
sudo docker compose config
```

---

## ✅ Commande Complète pour Tout Tester

```bash
# Copier-coller cette commande complète :
cd ~/Projets/telephonie_cap_epac && \
sudo docker compose up -d --build frontend && \
echo "⏳ Attente du démarrage (30s)..." && \
sleep 30 && \
echo "✅ État des services :" && \
sudo docker compose ps && \
echo "" && \
echo "📋 Derniers logs frontend :" && \
sudo docker compose logs --tail=20 frontend && \
echo "" && \
echo "🌐 Ouvrir dans le navigateur : https://192.168.10.116" && \
echo "📱 Tester la responsivité : F12 → Ctrl+Shift+M"
```

Cette commande va :
1. ✅ Aller dans le bon répertoire
2. ✅ Reconstruire et redémarrer le frontend
3. ✅ Attendre 30 secondes
4. ✅ Afficher l'état des services
5. ✅ Afficher les derniers logs
6. ✅ Vous donner l'URL pour tester

**Bon test ! 🚀**
