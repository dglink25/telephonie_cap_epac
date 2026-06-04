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
 * Télécharge une image et la sauvegarde localement pour contourner les problèmes SSL
 * @param imageUrl URL complète de l'image
 * @returns file:// URI local de l'image
 */
export async function getImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    // Vérifier le cache
    const cached = cache.get(imageUrl);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      // Vérifier que le fichier existe toujours
      const exists = await RNFS.exists(cached.localPath);
      if (exists) {
        console.log('[ImageCache] ✅ Image trouvée dans le cache local');
        return `file://${cached.localPath}`;
      }
    }

    console.log('[ImageCache] 🔄 Téléchargement via RNFS...');
    console.log('[ImageCache] URL:', imageUrl);

    // Nom de fichier basé sur l'URL
    const filename = imageUrl.split('/').pop() || `image_${Date.now()}`;
    const localPath = `${CACHE_DIR}/${filename}`;

    // Télécharger directement dans le filesystem
    const downloadResult = await RNFS.downloadFile({
      fromUrl: imageUrl,
      toFile: localPath,
      background: false,
      discretionary: false,
    }).promise;

    if (downloadResult.statusCode !== 200) {
      throw new Error(`HTTP ${downloadResult.statusCode}`);
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
