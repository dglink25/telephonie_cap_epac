// src/App.jsx
import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore   from './store/authStore';
import useSocketStore from './store/socketStore';
import api            from './services/api';

import LoginPage     from './pages/LoginPage';
import RegisterPage  from './pages/RegisterPage';
import MainLayout    from './components/layout/MainLayout';
import ChatPage      from './pages/ChatPage';
import CallsPage     from './pages/CallsPage';
import DirectoryPage from './pages/DirectoryPage';
import ProfilePage   from './pages/ProfilePage';
import AdminPage     from './pages/AdminPage';

import IncomingCallModal from './components/calls/IncomingCallModal';
import OutgoingCallModal from './components/calls/OutgoingCallModal';
import ActiveCallBar     from './components/calls/ActiveCallBar';
import PermissionsModal  from './components/ui/PermissionsModal';
import { usePermissions }from './hooks/usePermissions';

const PrivateRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};
const PublicRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <Navigate to="/" replace /> : children;
};
const AdminRoute = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  return user?.role === 'admin' ? children : <Navigate to="/" replace />;
};

export default function App() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const { connect, disconnect }          = useSocketStore();
  const { showModal, closeModal, handleAllGranted } = usePermissions();

  useEffect(() => {
    if (accessToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    }
  }, [accessToken]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connect(accessToken);
    } else {
      disconnect();
    }
  }, [isAuthenticated, accessToken]);

  return (
    <>
      <Routes>
        <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

        <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
          <Route index element={<Navigate to="/chat" replace />} />
          <Route path="chat"                 element={<ChatPage />} />
          <Route path="chat/:conversationId" element={<ChatPage />} />
          <Route path="calls"                element={<CallsPage />} />
          <Route path="directory"            element={<DirectoryPage />} />
          <Route path="profile"              element={<ProfilePage />} />
          <Route path="admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Modals globaux d'appel */}
      <IncomingCallModal />
      <OutgoingCallModal />
      <ActiveCallBar />

      {/* Modal permissions — s'affiche uniquement si connecté et permissions manquantes */}
      {isAuthenticated && showModal && (
        <PermissionsModal
          onClose={closeModal}
          onAllGranted={handleAllGranted}
        />
      )}
    </>
  );
}
