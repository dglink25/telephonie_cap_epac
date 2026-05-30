// src/components/layout/Sidebar.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Phone, MessageSquare, BookUser, User, LogOut,
  Shield, Wifi, WifiOff,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import useSocketStore from '../../store/socketStore';
import toast from 'react-hot-toast';

const NavItem = ({ to, icon: Icon, label, badge, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      `nav-item ${isActive ? 'active' : ''}`
    }
  >
    <Icon className="w-5 h-5 flex-shrink-0" />
    <span className="flex-1 md:hidden lg:inline">{label}</span>
    {badge > 0 && (
      <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center md:hidden lg:inline">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </NavLink>
);

export default function Sidebar({ isMobile = false, onNavigate }) {
  const { user, logout } = useAuthStore();
  const { isConnected } = useSocketStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Déconnecté');
    navigate('/login');
    if (onNavigate) onNavigate();
  };

  const handleNavClick = () => {
    if (onNavigate) onNavigate();
  };

  const avatarLetter = user?.display_name?.charAt(0)?.toUpperCase() || 'U';

  const sidebarClasses = isMobile 
    ? "flex-1 flex flex-col bg-primary-700 text-white"
    : "w-64 md:w-20 lg:w-64 flex flex-col bg-primary-700 text-white flex-shrink-0 hidden md:flex";

  return (
    <aside className={sidebarClasses}>
      {/* En-tête - masqué en mobile car déjà dans MainLayout */}
      {!isMobile && (
        <div className="px-4 py-5 border-b border-primary-600 md:px-2 lg:px-4">
          <div className="flex items-center gap-3 md:justify-center lg:justify-start">
            <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <div className="md:hidden lg:block">
              <h1 className="font-bold text-white text-sm leading-tight">CAP-EPAC</h1>
              <p className="text-primary-200 text-xs">Téléphonie LAN</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex-1 p-3 space-y-1 overflow-y-auto ${isMobile ? '' : 'md:p-2 lg:p-3'}`}>
        <p className={`text-primary-300 text-xs font-medium uppercase tracking-wider px-3 mb-2 ${isMobile ? '' : 'md:hidden lg:block'}`}>
          Communication
        </p>
        <NavItem to="/chat" icon={MessageSquare} label="Messagerie" onClick={handleNavClick} />
        <NavItem to="/calls" icon={Phone} label="Appels" onClick={handleNavClick} />

        <p className={`text-primary-300 text-xs font-medium uppercase tracking-wider px-3 mb-2 mt-4 ${isMobile ? '' : 'md:hidden lg:block'}`}>
          Annuaire
        </p>
        <NavItem to="/directory" icon={BookUser} label="Annuaire" onClick={handleNavClick} />

        <p className={`text-primary-300 text-xs font-medium uppercase tracking-wider px-3 mb-2 mt-4 ${isMobile ? '' : 'md:hidden lg:block'}`}>
          Compte
        </p>
        <NavItem to="/profile" icon={User} label="Mon profil" onClick={handleNavClick} />

        {user?.role === 'admin' && (
          <NavItem to="/admin" icon={Shield} label="Administration" onClick={handleNavClick} />
        )}
      </nav>

      {/* Footer utilisateur */}
      <div className={`border-t border-primary-600 p-3 ${isMobile ? '' : 'md:p-2 lg:p-3'}`}>
        {/* Indicateur de connexion */}
        <div className={`flex items-center gap-2 px-3 py-1.5 mb-2 ${isMobile ? '' : 'md:justify-center lg:justify-start md:px-0 lg:px-3'}`}>
          {isConnected
            ? <><Wifi className="w-3.5 h-3.5 text-primary-400" /><span className={`text-xs text-primary-300 ${isMobile ? '' : 'md:hidden lg:inline'}`}>Connecté au LAN</span></>
            : <><WifiOff className="w-3.5 h-3.5 text-red-400" /><span className={`text-xs text-red-300 ${isMobile ? '' : 'md:hidden lg:inline'}`}>Hors ligne</span></>
          }
        </div>

        {/* Infos utilisateur */}
        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg bg-primary-800 mb-2 ${isMobile ? '' : 'md:flex-col md:px-2 lg:flex-row lg:px-3'}`}>
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
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary-400 rounded-full border-2 border-primary-800" />
          </div>
          <div className={`flex-1 min-w-0 ${isMobile ? '' : 'md:hidden lg:block'}`}>
            <p className="text-sm font-medium text-white truncate">{user?.display_name}</p>
            <p className="text-xs text-primary-300 truncate">@{user?.username}</p>
          </div>
        </div>

        {/* Déconnexion */}
        <button
          onClick={handleLogout}
          className={`nav-item w-full text-red-300 hover:text-red-100 hover:bg-red-900/30 ${isMobile ? '' : 'md:justify-center lg:justify-start'}`}
          title="Se déconnecter"
        >
          <LogOut className="w-4 h-4" />
          <span className={isMobile ? '' : 'md:hidden lg:inline'}>Se déconnecter</span>
        </button>
      </div>
    </aside>
  );
}
