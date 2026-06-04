// src/utils/imageCache.ts
import RNFS from 'react-native-fs';

interface CachedImage {
  localPath: string;
  timestamp: number;
}

const cache = new Map<string, CachedImage>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const CACHE_DIR = `${RNFS.CachesDirectoryPath}/images`;

// Créer le dossier de cache au démarrage
RNFS.mkdir(CACHE_DIR).catch(() => {});

/**
 * Génère un nom de fichier unique basé sur l'URL pour éviter les collisions
 */
function urlToFilename(url: string): string {
  try {
    const urlPath = url.replace(/^https?:\/\/[^/]+/, '');
    return urlPath.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 200);
  } catch {
    return `img_${Date.now()}`;
  }
}

/**
 * Télécharge une image et la sauvegarde localement pour contourner les problèmes SSL
 * @param imageUrl URL complète de l'image
 * @returns file:// URI local de l'image
 */
export async function getImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    if (!imageUrl) {
      console.warn('[ImageCache] URL vide');
      return null;
    }

    // Vérifier le cache
    const cached = cache.get(imageUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      const exists = await RNFS.exists(cached.localPath);
      if (exists) {
        console.log('[ImageCache] ✅ Cache hit:', imageUrl);
        return `file://${cached.localPath}`;
      }
    }

    console.log('[ImageCache] 🔄 Téléchargement:', imageUrl);

    // Nom de fichier unique basé sur l'URL complète (pas juste le basename)
    const filename = urlToFilename(imageUrl);
    const localPath = `${CACHE_DIR}/${filename}`;

    // S'assurer que le dossier existe
    await RNFS.mkdir(CACHE_DIR).catch(() => {});

    // Télécharger directement dans le filesystem
    const downloadResult = await RNFS.downloadFile({
      fromUrl: imageUrl,
      toFile: localPath,
      background: false,
      discretionary: false,
      readTimeout: 15000,
      connectionTimeout: 10000,
    }).promise;

    if (downloadResult.statusCode !== 200) {
      console.error('[ImageCache] ❌ HTTP', downloadResult.statusCode, 'pour', imageUrl);
      throw new Error(`HTTP ${downloadResult.statusCode}`);
    }

    // Vérifier que le fichier n'est pas vide
    const stat = await RNFS.stat(localPath);
    if (stat.size === 0) {
      await RNFS.unlink(localPath).catch(() => {});
      throw new Error('Fichier vide téléchargé');
    }

    // Mettre en cache
    cache.set(imageUrl, {
      localPath,
      timestamp: Date.now(),
    });

    console.log('[ImageCache] ✅ Image téléchargée et sauvegardée localement');
    return `file://${localPath}`;
  } catch (error: any) {
    console.error('[ImageCache] ❌ Erreur:', error.message);
    return null;
  }
}

/**
 * Vide le cache des images
 */
export async function clearImageCache(): Promise<void> {
  try {
    await RNFS.unlink(CACHE_DIR);
    await RNFS.mkdir(CACHE_DIR);
    cache.clear();
    console.log('[ImageCache] Cache vidé');
  } catch (error) {
    console.error('[ImageCache] Erreur vidage cache:', error);
  }
}

/**
 * Nettoie les entrées expirées du cache
 */
export async function cleanExpiredCache(): Promise<void> {
  const now = Date.now();
  const toDelete: string[] = [];
  
  cache.forEach((value, key) => {
    if (now - value.timestamp >= CACHE_DURATION) {
      toDelete.push(key);
    }
  });
  
  for (const key of toDelete) {
    const cached = cache.get(key);
    if (cached) {
      try {
        await RNFS.unlink(cached.localPath);
      } catch {}
      cache.delete(key);
    }
  }
  
  if (toDelete.length > 0) {
    console.log(`[ImageCache] ${toDelete.length} entrées expirées nettoyées`);
  }
}

// Nettoyer le cache automatiquement toutes les 10 minutes
setInterval(() => cleanExpiredCache(), 10 * 60 * 1000);
