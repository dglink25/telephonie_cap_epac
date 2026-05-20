// src/pages/ProfilePage.jsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Camera, Save, Lock, Loader2, Check, X, Eye, EyeOff,
  ShieldCheck, AlertTriangle, CheckCircle, User, Mail,
  Phone, Briefcase,
} from 'lucide-react';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import useSocketStore from '../store/socketStore';

const PRESENCE_OPTIONS = [
  { value: 'online',  label: 'En ligne',           color: '#22c55e' },
  { value: 'away',    label: 'Absent',               color: '#facc15' },
  { value: 'dnd',     label: 'Ne pas déranger',      color: '#ef4444' },
  { value: 'offline', label: 'Hors ligne',            color: '#94a3b8' },
];

function generateCode() {
  return Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join('');
}

function ScrambledCode({ code }) {
  const [display, setDisplay] = useState(Array(5).fill('?'));
  const [revealed, setRevealed] = useState(Array(5).fill(false));
  useEffect(() => {
    setDisplay(Array(5).fill('?'));
    setRevealed(Array(5).fill(false));
    const timers = [];
    code.split('').forEach((digit, i) => {
      const t = setTimeout(() => {
        let count = 0;
        const iv = setInterval(() => {
          setDisplay(p => { const n=[...p]; n[i]=Math.floor(Math.random()*10).toString(); return n; });
          if (++count > 8) {
            clearInterval(iv);
            setDisplay(p => { const n=[...p]; n[i]=digit; return n; });
            setRevealed(p => { const n=[...p]; n[i]=true; return n; });
          }
        }, 60);
        timers.push(iv);
      }, i * 200);
      timers.push(t);
    });
    return () => timers.forEach(t => { clearTimeout(t); clearInterval(t); });
  }, [code]);

  return (
    <div style={{ display:'flex', gap:'0.5rem', justifyContent:'center', margin:'1rem 0' }}>
      {display.map((d, i) => (
        <div key={i} style={{
          width:'3rem', height:'3.5rem', borderRadius:'0.75rem',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'1.5rem', fontWeight:700, fontFamily:'monospace',
          border: `2px solid ${revealed[i] ? '#818cf8' : '#334155'}`,
          background: revealed[i] ? '#4f46e5' : '#1e293b',
          color: revealed[i] ? 'white' : '#64748b',
          boxShadow: revealed[i] ? '0 4px 16px rgba(99,102,241,0.4)' : 'none',
          transition: 'all 0.3s', userSelect:'none',
        }}>
          {d}
        </div>
      ))}
    </div>
  );
}

function CodeInput({ value, onChange, index, inputRefs }) {
  const block = e => e.preventDefault();
  return (
    <input
      ref={el => (inputRefs.current[index] = el)}
      type="text" inputMode="numeric" maxLength={1} value={value}
      onChange={e => {
        const v = e.target.value.replace(/\D/g,'').slice(-1);
        onChange(v, index);
        if (v && index < 4) inputRefs.current[index+1]?.focus();
      }}
      onKeyDown={e => { if (e.key==='Backspace' && !value && index>0) inputRefs.current[index-1]?.focus(); }}
      onCopy={block} onCut={block} onPaste={block} onContextMenu={block}
      style={{
        width:'3rem', height:'3.5rem', textAlign:'center',
        fontSize:'1.25rem', fontWeight:700, fontFamily:'monospace',
        borderRadius:'0.75rem', border:`2px solid ${value?'#6366f1':'#334155'}`,
        outline:'none', background:'#0f172a', color:'white',
        boxShadow: value?'0 2px 12px rgba(99,102,241,0.3)':'none',
        transition:'all 0.2s',
      }}
    />
  );
}

function FeedbackModal({ type, title, message, onClose }) {
  const ok = type === 'success';
  useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:100,
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem',
      background:'rgba(2,6,23,0.82)', backdropFilter:'blur(8px)',
    }}>
      <div onClick={e=>e.stopPropagation()} style={{
        width:'100%', maxWidth:'22rem', borderRadius:'1.25rem',
        overflow:'hidden', boxShadow:'0 25px 60px rgba(0,0,0,0.65)',
        animation:'feedbackPop 0.45s cubic-bezier(.34,1.56,.64,1) both',
      }}>
        <div style={{ height:'4px', background: ok?'linear-gradient(90deg,#34d399,#10b981)':'linear-gradient(90deg,#f87171,#ef4444)' }} />
        <div style={{ background:'#0f172a', padding:'2rem 1.5rem', textAlign:'center' }}>
          <div style={{
            width:'4rem', height:'4rem', borderRadius:'50%', margin:'0 auto 1rem',
            display:'flex', alignItems:'center', justifyContent:'center',
            background: ok?'rgba(52,211,153,0.12)':'rgba(239,68,68,0.12)',
            animation:'iconBounce 0.5s 0.2s cubic-bezier(.34,1.56,.64,1) both',
          }}>
            {ok
              ? <CheckCircle style={{ width:'2rem', height:'2rem', color:'#34d399' }} />
              : <AlertTriangle style={{ width:'2rem', height:'2rem', color:'#f87171' }} />}
          </div>
          <h3 style={{ fontSize:'1.05rem', fontWeight:700, color: ok?'#6ee7b7':'#fca5a5', marginBottom:'0.4rem' }}>{title}</h3>
          <p style={{ fontSize:'0.83rem', color:'#94a3b8', lineHeight:1.6 }}>{message}</p>
          <div style={{ marginTop:'1.25rem', height:'3px', background:'#1e293b', borderRadius:'9999px', overflow:'hidden' }}>
            <div style={{
              height:'100%', borderRadius:'9999px',
              background: ok?'#34d399':'#f87171',
              animation:'progressShrink 4.5s linear forwards',
            }} />
          </div>
          <button onClick={onClose} style={{
            marginTop:'1rem', padding:'0.5rem 1.5rem', borderRadius:'0.65rem',
            background: ok?'#059669':'#dc2626', color:'white',
            fontWeight:600, fontSize:'0.85rem', border:'none', cursor:'pointer',
          }}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

function PasswordModal({ onClose, onSuccess, onError }) {
  const [step, setStep] = useState(1);
  const [secretCode] = useState(generateCode);
  const [userCode, setUserCode] = useState(['','','','','']);
  const [codeError, setCodeError] = useState('');
  const [show, setShow] = useState({ current:false, newPass:false, confirm:false });
  const [passwords, setPasswords] = useState({ current:'', newPass:'', confirm:'' });
  const [pwErrors, setPwErrors] = useState({});
  const inputRefs = useRef([]);
  const block = e => e.preventDefault();

  const validateCode = () => {
    const entered = userCode.join('');
    if (entered.length < 5) { setCodeError('Veuillez saisir les 5 chiffres.'); return; }
    if (entered !== secretCode) {
      setCodeError('Code incorrect. Réessayez.');
      setUserCode(['','','','','']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
      return;
    }
    setStep(2);
  };

  const validatePasswords = () => {
    const errs = {};
    if (!passwords.current) errs.current = 'Requis';
    if (!passwords.newPass) errs.newPass = 'Requis';
    else if (passwords.newPass.length < 8) errs.newPass = 'Minimum 8 caractères';
    else if (!/[A-Z]/.test(passwords.newPass)) errs.newPass = 'Au moins une majuscule';
    else if (!/[0-9]/.test(passwords.newPass)) errs.newPass = 'Au moins un chiffre';
    if (!passwords.confirm) errs.confirm = 'Requis';
    else if (passwords.confirm !== passwords.newPass) errs.confirm = 'Ne correspond pas';
    setPwErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const pwMutation = useMutation({
    mutationFn: data => api.post('/auth/change-password', data),
    onSuccess: () => { onClose(); onSuccess(); },
    onError: err => onError(err.response?.data?.message || 'Erreur lors du changement.'),
  });

  const iStyle = hasErr => ({
    width:'100%', background:'#1e293b',
    border:`1px solid ${hasErr?'#ef4444':'#334155'}`,
    borderRadius:'0.75rem', padding:'0.6rem 2.5rem 0.6rem 1rem',
    fontSize:'0.875rem', color:'#e2e8f0', outline:'none',
    boxSizing:'border-box', fontFamily:'inherit',
    boxShadow: hasErr?'0 0 0 2px rgba(239,68,68,0.2)':'none',
    transition:'all 0.2s',
  });

  const fields = [
    { key:'current', label:'Mot de passe actuel' },
    { key:'newPass', label:'Nouveau mot de passe' },
    { key:'confirm', label:'Confirmer le nouveau' },
  ];

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:50,
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem',
      background:'rgba(2,6,23,0.88)', backdropFilter:'blur(10px)',
    }}>
      <div style={{
        width:'100%', maxWidth:'26rem', borderRadius:'1.25rem',
        overflow:'hidden', boxShadow:'0 25px 70px rgba(0,0,0,0.75)',
        animation:'feedbackPop 0.4s cubic-bezier(.34,1.56,.64,1) both',
      }}>
        {/* Header */}
        <div style={{
          background:'linear-gradient(135deg,#0f172a,#1e1b4b)',
          padding:'1.25rem 1.5rem',
          borderBottom:'1px solid rgba(99,102,241,0.2)',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
              <div style={{
                width:'2.25rem', height:'2.25rem', borderRadius:'0.6rem',
                background:'rgba(99,102,241,0.18)', display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Lock style={{ width:'1rem', height:'1rem', color:'#a5b4fc' }} />
              </div>
              <div>
                <p style={{ fontWeight:700, color:'white', fontSize:'0.95rem', margin:0 }}>Changer le mot de passe</p>
                <p style={{ fontSize:'0.7rem', color:'#64748b', margin:0 }}>
                  {step===1 ? 'Étape 1/2 — Vérification sécurité' : 'Étape 2/2 — Nouveau mot de passe'}
                </p>
              </div>
            </div>
            <button onClick={onClose} style={{
              width:'2rem', height:'2rem', borderRadius:'0.5rem',
              background:'rgba(51,65,85,0.6)', border:'none', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <X style={{ width:'1rem', height:'1rem', color:'#94a3b8' }} />
            </button>
          </div>
          <div style={{ display:'flex', gap:'0.5rem', marginTop:'1rem' }}>
            {[1,2].map(s => (
              <div key={s} style={{
                flex:1, height:'3px', borderRadius:'9999px',
                background: s<=step?'#6366f1':'#1e293b', transition:'background 0.5s',
              }} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ background:'#0f172a', padding:'1.5rem' }}>
          {step===1 ? (
            <div style={{ animation:'slideIn 0.3s ease both' }}>
              <p style={{ textAlign:'center', fontSize:'0.85rem', color:'#cbd5e1', marginBottom:'0.2rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.4rem' }}>
                <ShieldCheck style={{ width:'1rem', height:'1rem', color:'#818cf8' }} />
                Recopiez exactement ce code
              </p>
              <p style={{ textAlign:'center', fontSize:'0.7rem', color:'#475569', margin:'0 0 0.5rem' }}>Les copier/coller sont désactivés</p>
              <ScrambledCode code={secretCode} />
              <div style={{ display:'flex', gap:'0.5rem', justifyContent:'center', marginBottom:'0.75rem' }}>
                {userCode.map((v,i) => (
                  <CodeInput key={i} value={v} onChange={(val,idx) => {
                    setUserCode(p => { const n=[...p]; n[idx]=val; return n; });
                    setCodeError('');
                  }} index={i} inputRefs={inputRefs} />
                ))}
              </div>
              {codeError && (
                <p style={{
                  textAlign:'center', fontSize:'0.75rem', color:'#f87171',
                  marginBottom:'0.75rem', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.3rem',
                  animation:'shake 0.4s ease',
                }}>
                  <AlertTriangle style={{ width:'0.85rem', height:'0.85rem' }} /> {codeError}
                </p>
              )}
              <button onClick={validateCode} style={{
                width:'100%', padding:'0.65rem', borderRadius:'0.75rem',
                background:'linear-gradient(135deg,#4f46e5,#6366f1)',
                color:'white', fontWeight:600, fontSize:'0.875rem',
                border:'none', cursor:'pointer',
                boxShadow:'0 4px 15px rgba(99,102,241,0.4)', fontFamily:'inherit',
              }}>
                Valider le code →
              </button>
            </div>
          ) : (
            <div style={{ animation:'slideIn 0.3s ease both', display:'flex', flexDirection:'column', gap:'1rem' }}>
              {fields.map(({ key, label }) => (
                <div key={key}>
                  <label style={{ display:'block', fontSize:'0.7rem', fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.4rem' }}>
                    {label}
                  </label>
                  <div style={{ position:'relative' }}>
                    <input
                      type={show[key]?'text':'password'}
                      value={passwords[key]}
                      onChange={e => {
                        setPasswords(p => ({ ...p, [key]:e.target.value }));
                        if (pwErrors[key]) setPwErrors(p => ({ ...p, [key]:'' }));
                      }}
                      onCopy={block} onCut={block} onPaste={block}
                      placeholder="••••••••"
                      style={iStyle(!!pwErrors[key])}
                    />
                    <button type="button" onClick={() => setShow(s=>({...s,[key]:!s[key]}))} style={{
                      position:'absolute', right:'0.75rem', top:'50%', transform:'translateY(-50%)',
                      background:'none', border:'none', cursor:'pointer', color:'#64748b',
                      display:'flex', padding:0,
                    }}>
                      {show[key]
                        ? <EyeOff style={{ width:'1rem', height:'1rem' }} />
                        : <Eye style={{ width:'1rem', height:'1rem' }} />}
                    </button>
                  </div>
                  {pwErrors[key] && (
                    <p style={{ fontSize:'0.7rem', color:'#f87171', marginTop:'0.25rem', display:'flex', alignItems:'center', gap:'0.25rem' }}>
                      <AlertTriangle style={{ width:'0.75rem', height:'0.75rem' }} /> {pwErrors[key]}
                    </p>
                  )}
                </div>
              ))}
              <div style={{ display:'flex', gap:'0.75rem', paddingTop:'0.25rem' }}>
                <button onClick={()=>setStep(1)} style={{
                  flex:1, padding:'0.6rem', borderRadius:'0.75rem',
                  background:'transparent', border:'1px solid #334155',
                  color:'#94a3b8', fontWeight:600, fontSize:'0.85rem', cursor:'pointer', fontFamily:'inherit',
                }}>
                  ← Retour
                </button>
                <button onClick={()=>{if(!validatePasswords())return; pwMutation.mutate({current_password:passwords.current,new_password:passwords.newPass});}}
                  disabled={pwMutation.isPending}
                  style={{
                    flex:1, padding:'0.6rem', borderRadius:'0.75rem',
                    background:'linear-gradient(135deg,#4f46e5,#6366f1)',
                    color:'white', fontWeight:600, fontSize:'0.85rem',
                    border:'none', cursor:pwMutation.isPending?'not-allowed':'pointer',
                    opacity:pwMutation.isPending?0.6:1,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', fontFamily:'inherit',
                  }}>
                  {pwMutation.isPending
                    ? <><Loader2 style={{ width:'1rem', height:'1rem', animation:'spin 1s linear infinite' }}/> Envoi…</>
                    : 'Confirmer'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const { emit } = useSocketStore();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState({
    display_name: user?.display_name || '',
    department: user?.department || '',
    phone_extension: user?.phone_extension || '',
  });
  const [presence, setPresence] = useState(user?.presence_status || 'online');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const showFeedback = useCallback((type, title, message) => setFeedback({type,title,message}), []);

  const profileMutation = useMutation({
    mutationFn: data => api.put('/users/me', data),
    onSuccess: ({data}) => { updateUser(data.data.user); showFeedback('success','Profil mis à jour','Vos informations ont bien été enregistrées.'); },
    onError: () => showFeedback('error','Erreur','Impossible de mettre à jour le profil.'),
  });

  const avatarMutation = useMutation({
    mutationFn: fd => api.post('/users/me/avatar', fd, { headers:{'Content-Type':'multipart/form-data'} }),
    onSuccess: ({data}) => { updateUser({avatar_url:data.data.avatar_url}); showFeedback('success','Avatar mis à jour','Votre photo de profil a été modifiée.'); },
    onError: () => showFeedback('error','Erreur upload','Format non supporté ou fichier trop lourd (max 5 Mo).'),
  });

  const presenceMutation = useMutation({
    mutationFn: status => api.put('/users/me/presence', {status}),
    onSuccess: (_,status) => { updateUser({presence_status:status}); emit('user:set-status',{status}); },
  });

  const letter = user?.display_name?.charAt(0)?.toUpperCase() || 'U';
  const currentPresence = PRESENCE_OPTIONS.find(o=>o.value===presence);

  const cardStyle = {
    background:'rgba(15,23,42,0.65)',
    border:'1px solid rgba(99,102,241,0.15)',
    backdropFilter:'blur(12px)',
    borderRadius:'1.25rem',
    padding:'1.5rem',
    animation:'cardReveal 0.5s ease both',
  };

  const labelSt = {
    display:'flex', alignItems:'center', gap:'0.4rem',
    fontSize:'0.7rem', fontWeight:600, letterSpacing:'0.06em',
    color:'#94a3b8', textTransform:'uppercase', marginBottom:'0.4rem',
  };

  const inputSt = {
    width:'100%', background:'rgba(30,41,59,0.8)',
    border:'1px solid rgba(71,85,105,0.7)', borderRadius:'0.75rem',
    padding:'0.6rem 1rem', fontSize:'0.875rem', color:'#e2e8f0',
    outline:'none', boxSizing:'border-box', fontFamily:'inherit',
    transition:'border-color 0.2s, box-shadow 0.2s',
  };

  const readonlySt = {
    ...inputSt,
    background:'rgba(15,23,42,0.5)', color:'#475569',
    cursor:'not-allowed', borderColor:'rgba(51,65,85,0.4)',
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
        @keyframes feedbackPop { from{opacity:0;transform:scale(0.82) translateY(24px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes iconBounce  { from{opacity:0;transform:scale(0.2)} to{opacity:1;transform:scale(1)} }
        @keyframes progressShrink { from{width:100%} to{width:0%} }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
        @keyframes slideIn { from{opacity:0;transform:translateX(18px)} to{opacity:1;transform:translateX(0)} }
        @keyframes cardReveal { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes avatarGlow { 0%,100%{box-shadow:0 0 0 3px rgba(99,102,241,0.35)} 50%{box-shadow:0 0 0 8px rgba(99,102,241,0.08)} }
        .profile-page { font-family:'DM Sans',sans-serif; }
        .profile-card:nth-child(1){animation-delay:0.05s}
        .profile-card:nth-child(2){animation-delay:0.13s}
        .profile-card:nth-child(3){animation-delay:0.21s}
        .edit-input:focus { border-color:#6366f1 !important; box-shadow:0 0 0 3px rgba(99,102,241,0.2) !important; }
        .presence-btn { transition:all 0.2s; }
        .presence-btn:hover { transform:scale(1.02); }
        .btn-save:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 22px rgba(99,102,241,0.5) !important; }
        .btn-save:disabled { opacity:0.6; cursor:not-allowed; }
        .btn-pw:hover { background:rgba(99,102,241,0.15) !important; border-color:#6366f1 !important; color:white !important; }
      `}</style>

      <div className="profile-page" style={{
        flex:1, overflowY:'auto', padding:'1.5rem 1rem',
        background:'linear-gradient(140deg,#020617 0%,#0f172a 55%,#1e1b4b 100%)',
        minHeight:'100vh',
      }}>
        <div style={{ maxWidth:'38rem', margin:'0 auto', display:'flex', flexDirection:'column', gap:'1rem' }}>

          {/* ── Hero ─────────────────────────────────────────────── */}
          <div className="profile-card" style={{...cardStyle, animationDelay:'0.05s'}}>
            <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'1.25rem' }}>
              <div style={{ position:'relative', flexShrink:0 }}>
                <input ref={fileInputRef} type="file" style={{ display:'none' }} accept="image/*"
                  onChange={e => { const f=e.target.files[0]; if(!f)return; const fd=new FormData(); fd.append('avatar',f); avatarMutation.mutate(fd); }} />
                <div style={{ borderRadius:'50%', padding:'3px', animation:'avatarGlow 3s ease-in-out infinite', display:'inline-block' }}>
                  {user?.avatar_url
                    ? <img src={user.avatar_url} alt={user.display_name} style={{ width:'5.5rem', height:'5.5rem', borderRadius:'50%', objectFit:'cover', display:'block' }} />
                    : <div style={{
                        width:'5.5rem', height:'5.5rem', borderRadius:'50%',
                        background:'linear-gradient(135deg,#4f46e5,#7c3aed)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:'2.25rem', fontWeight:700, color:'white',
                        fontFamily:'Playfair Display,serif',
                      }}>{letter}</div>}
                </div>
                <button onClick={()=>fileInputRef.current?.click()} disabled={avatarMutation.isPending}
                  style={{
                    position:'absolute', bottom:'-2px', right:'-2px',
                    width:'2.25rem', height:'2.25rem', borderRadius:'50%',
                    background:'linear-gradient(135deg,#4f46e5,#6366f1)',
                    border:'2px solid #0f172a', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 4px 12px rgba(99,102,241,0.4)',
                  }}>
                  {avatarMutation.isPending
                    ? <Loader2 style={{ width:'0.9rem', height:'0.9rem', color:'white', animation:'spin 1s linear infinite' }} />
                    : <Camera style={{ width:'0.9rem', height:'0.9rem', color:'white' }} />}
                </button>
              </div>
              <div style={{ flex:1, minWidth:'10rem' }}>
                <h2 style={{ fontSize:'1.35rem', fontWeight:700, color:'white', fontFamily:'Playfair Display,serif', margin:'0 0 0.1rem' }}>
                  {user?.display_name}
                </h2>
                <p style={{ fontSize:'0.8rem', color:'#64748b', margin:'0 0 0.6rem' }}>@{user?.username}</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem' }}>
                  <span style={{ padding:'0.25rem 0.75rem', borderRadius:'9999px', fontSize:'0.72rem', fontWeight:600, background:'rgba(99,102,241,0.15)', color:'#a5b4fc', border:'1px solid rgba(99,102,241,0.3)' }}>
                    {user?.role==='admin' ? '⚡ Admin' : '👤 Utilisateur'}
                  </span>
                  {user?.department && (
                    <span style={{ padding:'0.25rem 0.75rem', borderRadius:'9999px', fontSize:'0.72rem', fontWeight:600, background:'rgba(15,23,42,0.8)', color:'#64748b', border:'1px solid rgba(51,65,85,0.5)', display:'flex', alignItems:'center', gap:'0.3rem' }}>
                      <Briefcase style={{ width:'0.7rem', height:'0.7rem' }} /> {user.department}
                    </span>
                  )}
                  <span style={{ padding:'0.25rem 0.75rem', borderRadius:'9999px', fontSize:'0.72rem', fontWeight:600, background:'rgba(15,23,42,0.8)', color:'#94a3b8', border:'1px solid rgba(51,65,85,0.5)', display:'flex', alignItems:'center', gap:'0.4rem' }}>
                    <span style={{ width:'0.5rem', height:'0.5rem', borderRadius:'50%', background:currentPresence?.color, display:'inline-block' }} />
                    {currentPresence?.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Présence ─────────────────────────────────────────── */}
          <div className="profile-card" style={{...cardStyle, animationDelay:'0.13s'}}>
            <p style={{ fontSize:'0.9rem', fontWeight:700, color:'#e2e8f0', margin:'0 0 1rem', fontFamily:'Playfair Display,serif', display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <span style={{ width:'3px', height:'1.1rem', borderRadius:'9999px', background:'linear-gradient(to bottom,#6366f1,#8b5cf6)', display:'inline-block' }} />
              Statut de présence
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
              {PRESENCE_OPTIONS.map(opt => {
                const active = presence===opt.value;
                return (
                  <button key={opt.value} onClick={()=>{ setPresence(opt.value); presenceMutation.mutate(opt.value); }}
                    className="presence-btn"
                    style={{
                      display:'flex', alignItems:'center', gap:'0.6rem',
                      padding:'0.75rem 1rem', borderRadius:'0.85rem', textAlign:'left',
                      background: active?'rgba(99,102,241,0.14)':'rgba(30,41,59,0.5)',
                      border:`1px solid ${active?'rgba(99,102,241,0.5)':'rgba(51,65,85,0.5)'}`,
                      cursor:'pointer', transform:active?'scale(1.02)':'scale(1)',
                    }}>
                    <span style={{ width:'0.7rem', height:'0.7rem', borderRadius:'50%', flexShrink:0, background:opt.color, boxShadow:active?`0 0 8px ${opt.color}`:'none' }} />
                    <span style={{ fontSize:'0.8rem', fontWeight:500, color:active?'#e2e8f0':'#94a3b8', flex:1 }}>{opt.label}</span>
                    {active && <Check style={{ width:'0.85rem', height:'0.85rem', color:'#6366f1', flexShrink:0 }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Infos ────────────────────────────────────────────── */}
          <div className="profile-card" style={{...cardStyle, animationDelay:'0.21s'}}>
            <p style={{ fontSize:'0.9rem', fontWeight:700, color:'#e2e8f0', margin:'0 0 1.25rem', fontFamily:'Playfair Display,serif', display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <span style={{ width:'3px', height:'1.1rem', borderRadius:'9999px', background:'linear-gradient(to bottom,#6366f1,#8b5cf6)', display:'inline-block' }} />
              Informations personnelles
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

              {/* Identifiant readonly */}
              <div>
                <label style={labelSt}>
                  <User style={{ width:'0.8rem', height:'0.8rem' }} /> Identifiant
                  <span style={{ marginLeft:'auto', color:'#334155', display:'flex', alignItems:'center', gap:'0.25rem', textTransform:'none', letterSpacing:0, fontSize:'0.7rem', fontWeight:400 }}>
                    <Lock style={{ width:'0.65rem', height:'0.65rem' }} /> Non modifiable
                  </span>
                </label>
                <input style={readonlySt} value={user?.username||''} readOnly />
              </div>

              {/* Email readonly */}
              <div>
                <label style={labelSt}>
                  <Mail style={{ width:'0.8rem', height:'0.8rem' }} /> Email
                  <span style={{ marginLeft:'auto', color:'#334155', display:'flex', alignItems:'center', gap:'0.25rem', textTransform:'none', letterSpacing:0, fontSize:'0.7rem', fontWeight:400 }}>
                    <Lock style={{ width:'0.65rem', height:'0.65rem' }} /> Non modifiable
                  </span>
                </label>
                <input style={readonlySt} value={user?.email||''} readOnly />
              </div>

              {/* Nom */}
              <div>
                <label style={labelSt}><User style={{ width:'0.8rem', height:'0.8rem' }} /> Nom affiché</label>
                <input className="edit-input" style={inputSt} value={profile.display_name}
                  onChange={e=>setProfile({...profile,display_name:e.target.value})} placeholder="Votre nom complet" />
              </div>

              {/* Service + Poste */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                <div>
                  <label style={labelSt}><Briefcase style={{ width:'0.8rem', height:'0.8rem' }} /> Service</label>
                  <input className="edit-input" style={inputSt} value={profile.department}
                    onChange={e=>setProfile({...profile,department:e.target.value})} placeholder="Ex: Direction" />
                </div>
                <div>
                  <label style={labelSt}><Phone style={{ width:'0.8rem', height:'0.8rem' }} /> Poste tél.</label>
                  <input className="edit-input" style={inputSt} value={profile.phone_extension}
                    onChange={e=>setProfile({...profile,phone_extension:e.target.value})} placeholder="Ex: 1234" />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:'0.75rem', paddingTop:'0.25rem', flexWrap:'wrap' }}>
                <button className="btn-save" onClick={()=>profileMutation.mutate(profile)} disabled={profileMutation.isPending}
                  style={{
                    display:'inline-flex', alignItems:'center', gap:'0.5rem',
                    padding:'0.6rem 1.4rem', background:'linear-gradient(135deg,#4f46e5,#6366f1)',
                    borderRadius:'0.75rem', color:'white', fontWeight:600, fontSize:'0.875rem',
                    border:'none', cursor:'pointer', boxShadow:'0 4px 15px rgba(218, 219, 255, 0.98)',
                    transition:'all 0.2s', fontFamily:'inherit',
                  }}>
                  {profileMutation.isPending
                    ? <><Loader2 style={{ width:'1rem', height:'1rem', animation:'spin 1s linear infinite'


                      
                     }}/> Enregistrement…</>
                    : <><Save style={{ width:'1rem', height:'1rem' }}/> Enregistrer</>}
                </button>
                <button className="btn-pw" onClick={()=>setShowPasswordModal(true)}
                  style={{
                    display:'inline-flex', alignItems:'center', gap:'0.5rem',
                    padding:'0.6rem 1.4rem', background:'white',
                    border:'1px solid rgba(99, 241, 120, 0.35)', borderRadius:'0.75rem',
                    color:'#b6fca5ff', fontWeight:600, fontSize:'0.875rem',
                    cursor:'pointer', transition:'all 0.2s', fontFamily:'inherit',
                  }}>
                  <Lock style={{ width:'1rem', height:'1rem' }}/> Mot de passe
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {showPasswordModal && (
        <PasswordModal
          onClose={()=>setShowPasswordModal(false)}
          onSuccess={()=>showFeedback('success','Mot de passe modifié','Votre mot de passe a été mis à jour. Veuillez vous reconnecter.')}
          onError={msg=>showFeedback('error','Échec de la modification',msg)}
        />
      )}
      {feedback && (
        <FeedbackModal type={feedback.type} title={feedback.title} message={feedback.message} onClose={()=>setFeedback(null)} />
      )}
    </>
  );
}