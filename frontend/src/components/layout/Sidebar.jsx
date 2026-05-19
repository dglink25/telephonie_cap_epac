// src/components/layout/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Phone, MessageSquare, BookUser, User, LogOut,
  Settings, Shield, Wifi, WifiOff,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useSocketStore from '../../store/socketStore';
import toast from 'react-hot-toast';

const NavItem = ({ to, icon: Icon, label, badge }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `nav-item ${isActive ? 'active' : ''}`
    }
  >
    <Icon className="w-5 h-5 flex-shrink-0" />
    <span className="flex-1">{label}</span>
    {badge > 0 && (
      <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </NavLink>
);

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const { isConnected } = useSocketStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Déconnecté');
    navigate('/login');
  };

  const avatarLetter = user?.display_name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <aside className="w-64 flex flex-col bg-primary-700 text-white flex-shrink-0">
      {/* En-tête */}
      <div className="px-4 py-5 border-b border-primary-600">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-sm leading-tight">CAP-EPAC</h1>
            <p className="text-primary-200 text-xs">Téléphonie LAN</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="text-primary-300 text-xs font-medium uppercase tracking-wider px-3 mb-2">
          Communication
        </p>
        <NavItem to="/chat"      icon={MessageSquare} label="Messagerie" />
        <NavItem to="/calls"     icon={Phone}         label="Appels" />

        <p className="text-primary-300 text-xs font-medium uppercase tracking-wider px-3 mb-2 mt-4">
          Annuaire
        </p>
        <NavItem to="/directory" icon={BookUser}  label="Annuaire" />

        <p className="text-primary-300 text-xs font-medium uppercase tracking-wider px-3 mb-2 mt-4">
          Compte
        </p>
        <NavItem to="/profile"   icon={User}     label="Mon profil" />

        {user?.role === 'admin' && (
          <NavItem to="/admin" icon={Shield} label="Administration" />
        )}
      </nav>

      {/* Footer utilisateur */}
      <div className="border-t border-primary-600 p-3">
        {/* Indicateur de connexion */}
        <div className="flex items-center gap-2 px-3 py-1.5 mb-2">
          {isConnected
            ? <><Wifi className="w-3.5 h-3.5 text-green-400" /><span className="text-xs text-green-300">Connecté au LAN</span></>
            : <><WifiOff className="w-3.5 h-3.5 text-red-400" /><span className="text-xs text-red-300">Hors ligne</span></>
          }
        </div>

        {/* Infos utilisateur */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary-800 mb-2">
          <div className="relative">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.display_name}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center font-semibold text-white">
                {avatarLetter}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-primary-800" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.display_name}</p>
            <p className="text-xs text-primary-300 truncate">@{user?.username}</p>
          </div>
        </div>

        {/* Déconnexion */}
        <button
          onClick={handleLogout}
          className="nav-item w-full text-red-300 hover:text-red-100 hover:bg-red-900/30"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}
