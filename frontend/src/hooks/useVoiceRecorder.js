// src/hooks/useVoiceRecorder.js
import { useState, useRef, useCallback } from 'react';

export function useVoiceRecorder({ onComplete } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const durationRef = useRef(0);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      durationRef.current = 0;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          onComplete?.(blob, durationRef.current);
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration((d) => d + 1);
        if (durationRef.current >= 300) stopRecording();
      }, 1000);
    } catch (err) {
      console.error('[VoiceRecorder] erreur micro:', err);
      throw err;
    }
  }, [onComplete]);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const cancel = useCallback(() => {
    chunksRef.current = []; // vider pour ne pas envoyer
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setDuration(0);
    durationRef.current = 0;
  }, []);

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return { isRecording, duration, start, stop: stopRecording, cancel, formatDuration };
}
