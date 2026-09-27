import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { TopNavBar } from '../navigation/TopNavBar';

// With Supabase accounts only admins may open the studio (the API enforces it too).
// In local demo mode it stays open.
export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { authMode, authReady, isAuthenticated, role } = useAuthStore();

  if (authMode === 'local' || role === 'admin') return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 pb-28">
      <TopNavBar />
      <div className="px-4 pt-10 max-w-md mx-auto text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto" />
        <h1 className="font-display text-lg font-bold">Acceso restringido</h1>
        <p className="text-xs text-slate-400">
          {!authReady
            ? 'Comprobando tu sesión…'
            : isAuthenticated
              ? 'El Estudio IA solo está disponible para administradores.'
              : 'Inicia sesión con una cuenta de administrador para usar el Estudio IA.'}
        </p>
        {authReady && !isAuthenticated && (
          <button onClick={() => navigate('/profile')} className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold">
            Iniciar sesión
          </button>
        )}
      </div>
    </div>
  );
};
