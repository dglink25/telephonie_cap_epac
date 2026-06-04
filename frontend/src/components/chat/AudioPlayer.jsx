// src/components/chat/AudioPlayer.jsx
import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

export default function AudioPlayer({ src, isOwn }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Construire l'URL complète si src est relatif
  const getFullUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // Utiliser l'origine actuelle pour les URLs relatives
    return `${window.location.origin}${url.startsWith('/') ? url : '/' + url}`;
  };

  const audioSrc = getFullUrl(src);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded  = () => setDuration(audio.duration);
    const onUpdate  = () => { setCurrentTime(audio.currentTime); setProgress((audio.currentTime / audio.duration) * 100 || 0); };
    const onEnded   = () => { setPlaying(false); setProgress(0); setCurrentTime(0); };
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onUpdate);
    audio.addEventListener('ended', onEnded);
    return () => { audio.removeEventListener('loadedmetadata', onLoaded); audio.removeEventListener('timeupdate', onUpdate); audio.removeEventListener('ended', onEnded); };
  }, [audioSrc]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else audio.play().then(() => setPlaying(true)).catch(console.warn);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  const fmt = (s) => { 
    if (!s || isNaN(s) || !isFinite(s)) return '0:00'; 
    return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; 
  };

  return (
    <div className="flex items-center gap-2.5 min-w-[180px] max-w-[260px]">
      <audio ref={audioRef} src={audioSrc} preload="metadata" crossOrigin="anonymous" />
      <button onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors
          ${isOwn ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-primary-100 hover:bg-primary-200 text-primary-700'}`}>
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div className={`h-1.5 rounded-full cursor-pointer ${isOwn ? 'bg-white/30' : 'bg-slate-200'}`} onClick={handleSeek}>
          <div className={`h-full rounded-full transition-all ${isOwn ? 'bg-white' : 'bg-primary-500'}`} style={{ width: `${progress}%` }} />
        </div>
        <div className={`flex justify-between text-[10px] ${isOwn ? 'text-primary-100' : 'text-slate-400'}`}>
          <span>{fmt(currentTime)}</span><span>{fmt(duration)}</span>
        </div>
      </div>
    </div>
  );
}
