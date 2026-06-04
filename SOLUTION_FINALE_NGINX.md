# Solution finale : Configurer nginx pour accepter HTTP

## Le problème
Nginx redirige automatiquement HTTP → HTTPS, et Android rejette le certificat SSL auto-signé.
Résultat : **Aucune image ne peut se charger dans l'app mobile.**

## Solution : Ajouter un port HTTP (8080) sans redirection HTTPS

### Étape 1 : Trouver le fichier de configuration nginx

```bash
# Chercher les fichiers de configuration
sudo find /etc/nginx -name "*.conf" -type f | grep -v modules

# OU
sudo ls /etc/nginx/sites-available/
sudo ls /etc/nginx/conf.d/
```

Le fichier est probablement :
- `/etc/nginx/sites-available/default`
- `/etc/nginx/sites-available/cap-epac`
- `/etc/nginx/conf.d/cap-epac.conf`

### Étape 2 : Éditer le fichier nginx

```bash
# Ouvrir avec votre éditeur préféré
sudo nano /etc/nginx/sites-available/default
# OU
sudo vim /etc/nginx/sites-available/default
```

### Étape 3 : Ajouter cette configuration à la FIN du fichier

```nginx
# Port HTTP pour l'application mobile (sans redirection HTTPS)
server {
    listen 8080;
    server_name 10.73.47.159;
    
    client_max_body_size 100M;
    
    # Headers CORS pour mobile
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, X-Requested-With' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    
    # Répondre aux OPTIONS (preflight CORS)
    if ($request_method = 'OPTIONS') {
        return 204;
    }
    
    # Proxy vers le backend Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # WebSocket pour Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
    
    # Fichiers statiques (images, vidéos, etc.)
    location /uploads/ {
        proxy_pass http://localhost:3000/uploads/;
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header Cache-Control "public, max-age=31536000";
    }
}
```

### Étape 4 : Vérifier la configuration

```bash
sudo nginx -t
```

Si vous voyez `syntax is ok` et `test is successful`, continuez.

### Étape 5 : Recharger nginx

```bash
sudo systemctl reload nginx
```

### Étape 6 : Ouvrir le port dans le firewall (si activé)

```bash
# Vérifier si ufw est actif
sudo ufw status

# Si actif, ouvrir le port 8080
sudo ufw allow 8080/tcp
```

### Étape 7 : Tester depuis votre PC

```bash
curl -I http://10.73.47.159:8080/api/health
```

Vous devriez voir `HTTP/1.1 200 OK` ou `HTTP/1.1 404 Not Found` (pas de redirection HTTPS).

### Étape 8 : Modifier l'app mobile

```bash
cd ~/Projets/telephonie_cap_epac/cap-epac-mobile
```

Modifier `src/services/api.ts` et `src/services/socket.ts` pour utiliser le port 8080 :

```typescript
// api.ts
export const SERVER_BASE = 'http://10.73.47.159:8080';

// socket.ts
const SOCKET_URL = 'http://10.73.47.159:8080';
```

### Étape 9 : Rebuild et installer

```bash
cd android && ./gradlew assembleRelease
cd ..
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

---

## Alternative si vous ne pouvez pas modifier nginx

Si vous n'avez pas accès au serveur ou ne pouvez pas modifier nginx, la seule autre solution est :

1. **Installer le certificat SSL sur Android** (mais c'est compliqué et vous avez dit que ça demande une clé privée)
2. **Utiliser un reverse proxy comme ngrok** pour tunneler le trafic
3. **Reconstruire le backend pour écouter sur un autre port** (ex: 3001) directement accessible

---

## Commandes rapides

```bash
# 1. Éditer nginx
sudo nano /etc/nginx/sites-available/default

# 2. Ajouter le bloc server{} pour le port 8080 (voir ci-dessus)

# 3. Vérifier
sudo nginx -t

# 4. Reload
sudo systemctl reload nginx

# 5. Tester
curl http://10.73.47.159:8080/api/health
```

---

**Vous DEVEZ faire cette modification nginx pour que les images fonctionnent.** Il n'y a pas d'autre solution sans accès au serveur. 🔧
