// src/hooks/usePermissions.js
import { useState, useEffect } from 'react';

/**
 * Hook qui vérifie si les permissions micro/caméra sont accordées
 * et décide si le modal doit s'afficher
 */
export function usePermissions() {
  const [showModal, setShowModal]       = useState(false);
  const [permissionsOk, setPermissionsOk] = useState(false);
  const [checked, setChecked]           = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        // Vérifier micro (obligatoire)
        if (navigator.permissions) {
          const mic = await navigator.permissions.query({ name: 'microphone' });
          if (mic.state === 'granted') {
            setPermissionsOk(true);
            setChecked(true);
            return;
          }
          // Si refusé ou en attente → afficher le modal
          if (mic.state === 'denied' || mic.state === 'prompt') {
            setShowModal(true);
            setChecked(true);
            return;
          }
        }
        // Si permissions API non dispo → afficher le modal quand même
        setShowModal(true);
        setChecked(true);
      } catch {
        setShowModal(true);
        setChecked(true);
      }
    };

    // Délai court pour ne pas bloquer le chargement
    const timer = setTimeout(check, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleAllGranted = () => {
    setPermissionsOk(true);
    setShowModal(false);
  };

  const openModal  = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  return { showModal, permissionsOk, checked, openModal, closeModal, handleAllGranted };
}
