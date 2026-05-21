// src/hooks/useMention.js
import { useState, useCallback } from 'react';

/**
 * Hook qui gère la logique des mentions @
 * Retourne : isMentioning, mentionQuery, triggerPos, insertMention
 */
export function useMention() {
  const [isMentioning, setIsMentioning] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);

  /**
   * À appeler à chaque changement de valeur du textarea
   * Détecte si le curseur est après un @
   */
  const handleChange = useCallback((value, cursorPos) => {
    // Chercher le dernier @ avant le curseur
    const textBeforeCursor = value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex === -1) {
      setIsMentioning(false);
      return;
    }

    // Vérifier qu'il n'y a pas d'espace entre @ et le curseur
    const afterAt = textBeforeCursor.slice(atIndex + 1);
    if (afterAt.includes(' ') || afterAt.includes('\n')) {
      setIsMentioning(false);
      return;
    }

    // Vérifier que @ est précédé d'un espace ou en début de ligne
    const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
    if (charBefore !== ' ' && charBefore !== '\n') {
      setIsMentioning(false);
      return;
    }

    setIsMentioning(true);
    setMentionQuery(afterAt);
    setMentionStart(atIndex);
  }, []);

  /**
   * Insérer la mention dans le texte
   * Remplace @query par @display_name + espace
   */
  const insertMention = useCallback((currentValue, member) => {
    if (mentionStart === -1) return currentValue;
    const before = currentValue.slice(0, mentionStart);
    const after  = currentValue.slice(mentionStart + 1 + mentionQuery.length);
    const result = `${before}@${member.display_name} ${after}`;
    setIsMentioning(false);
    setMentionQuery('');
    setMentionStart(-1);
    return result;
  }, [mentionStart, mentionQuery]);

  const cancel = useCallback(() => {
    setIsMentioning(false);
    setMentionQuery('');
    setMentionStart(-1);
  }, []);

  return { isMentioning, mentionQuery, handleChange, insertMention, cancel };
}
