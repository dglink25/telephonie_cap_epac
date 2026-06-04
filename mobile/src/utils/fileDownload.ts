// src/utils/fileDownload.ts
import RNFS from 'react-native-fs';
import FileViewer from 'react-native-file-viewer';
import { Platform, PermissionsAndroid } from 'react-native';

/**
 * Demander la permission de stockage sur Android
 */
const requestStoragePermission = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    return true; // iOS n'a pas besoin de permission pour écrire dans le dossier Documents
  }

  try {
    if (Platform.Version >= 33) {
      // Android 13+ n'a plus besoin de permission pour écrire dans le dossier Downloads
      return true;
    }

    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        title: 'Permission de stockage',
        message: 'L\'application a besoin d\'accéder au stockage pour télécharger les fichiers',
        buttonNeutral: 'Plus tard',
        buttonNegative: 'Refuser',
        buttonPositive: 'Autoriser',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('[FileDownload] Permission error:', err);
    return false;
  }
};

/**
 * Télécharger un fichier et l'ouvrir
 */
export const downloadAndOpenFile = async (
  url: string,
  fileName: string,
  onProgress?: (progress: number) => void
): Promise<void> => {
  try {
    console.log('[FileDownload] Starting download:', url);

    // Demander la permission
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      throw new Error('Permission de stockage refusée');
    }

    // Déterminer le dossier de destination
    const downloadDir = Platform.OS === 'ios' 
      ? RNFS.DocumentDirectoryPath 
      : RNFS.DownloadDirectoryPath;

    // Nettoyer le nom de fichier (enlever les caractères spéciaux)
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localPath = `${downloadDir}/${cleanFileName}`;

    console.log('[FileDownload] Downloading to:', localPath);

    // Télécharger le fichier
    const downloadResult = await RNFS.downloadFile({
      fromUrl: url,
      toFile: localPath,
      background: true,
      discretionary: true,
      progress: (res) => {
        const progress = (res.bytesWritten / res.contentLength) * 100;
        onProgress?.(progress);
        console.log(`[FileDownload] Progress: ${progress.toFixed(0)}%`);
      },
    }).promise;

    if (downloadResult.statusCode !== 200) {
      throw new Error(`Échec du téléchargement (HTTP ${downloadResult.statusCode})`);
    }

    console.log('[FileDownload] Download complete, opening file');

    // Ouvrir le fichier avec l'application par défaut
    await FileViewer.open(localPath, {
      showOpenWithDialog: true,
      showAppsSuggestions: true,
    });

    console.log('[FileDownload] File opened successfully');
  } catch (error: any) {
    console.error('[FileDownload] Error:', error);
    
    // Messages d'erreur plus explicites
    if (error.message.includes('No app')) {
      throw new Error('Aucune application trouvée pour ouvrir ce type de fichier');
    } else if (error.message.includes('Permission')) {
      throw new Error('Permission refusée pour télécharger le fichier');
    } else {
      throw new Error(`Erreur de téléchargement: ${error.message}`);
    }
  }
};

/**
 * Obtenir la taille lisible d'un fichier
 */
export const getFileSize = async (path: string): Promise<string> => {
  try {
    const stat = await RNFS.stat(path);
    const bytes = parseInt(stat.size);
    
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } catch {
    return 'Inconnu';
  }
};
