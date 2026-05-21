
import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';


export function FeedbackModal({ type, message, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 250);
  }, [onClose]);

  const isSuccess = type === 'success';

  const colors = isSuccess
    ? {
        overlay:  'rgba(16, 185, 129, 0.08)',
        bg:       'bg-white',
        border:   'border-emerald-200',
        iconRing: 'bg-emerald-50',
        icon:     'text-emerald-500',
        title:    'text-slate-800',
        btn:      'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-200 shadow-lg',
      }
    : {
        overlay:  'rgba(239, 68, 68, 0.08)',
        bg:       'bg-white',
        border:   'border-red-200',
        iconRing: 'bg-red-50',
        icon:     'text-red-500',
        title:    'text-slate-800',
        btn:      'bg-red-500 hover:bg-red-600 text-white shadow-red-200 shadow-lg',
      };

  const Icon = isSuccess ? CheckCircle : XCircle;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{
        background: `rgba(15, 23, 42, ${visible ? 0.5 : 0})`,
        backdropFilter: visible ? 'blur(4px)' : 'blur(0px)',
        transition: 'background 0.25s ease, backdrop-filter 0.25s ease',
      }}
      onClick={handleClose}
    >
      <div
        className={`relative w-full max-w-sm rounded-3xl border shadow-2xl overflow-hidden ${colors.bg} ${colors.border}`}
        style={{
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.88) translateY(24px)',
          opacity:   visible ? 1 : 0,
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.22s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bande colorée en haut */}
        <div
          className={`h-1.5 w-full ${isSuccess ? 'bg-emerald-400' : 'bg-red-400'}`}
          style={{ opacity: 0.7 }}
        />

        <div className="px-6 pt-6 pb-6 flex flex-col items-center text-center gap-4">
          {/* Icône avec halo */}
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${colors.iconRing}`}
            style={{
              boxShadow: isSuccess
                ? '0 0 0 8px rgba(16,185,129,0.08)'
                : '0 0 0 8px rgba(239,68,68,0.08)',
            }}
          >
            <Icon className={`w-8 h-8 ${colors.icon}`} strokeWidth={1.75} />
          </div>

          {/* Titre */}
          <p className={`text-sm font-semibold leading-relaxed ${colors.title}`}>{message}</p>

          {/* Bouton OK */}
          <button
            onClick={handleClose}
            className={`w-full py-2.5 rounded-2xl text-sm font-semibold transition-all duration-150 ${colors.btn}`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}


export function useFeedback() {
  const [feedback, setFeedback] = useState(null); // { type, message }
  const show  = useCallback((type, message) => setFeedback({ type, message }), []);
  const close = useCallback(() => setFeedback(null), []);
  const node  = feedback
    ? <FeedbackModal type={feedback.type} message={feedback.message} onClose={close} />
    : null;
  return { show, node };
}