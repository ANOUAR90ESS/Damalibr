import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, PlaySquare, Compass, Bookmark, User, Wand2 } from 'lucide-react';

export const BottomNavBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', label: 'Inicio', icon: Home },
    { path: '/feed', label: 'Para Ti', icon: PlaySquare, badge: '9:16' },
    { path: '/categories', label: 'Explorar', icon: Compass },
    { path: '/library', label: 'Biblioteca', icon: Bookmark },
    { path: '/studio', label: 'Estudio IA', icon: Wand2, isSpecial: true },
    { path: '/profile', label: 'Perfil', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c0e14]/95 backdrop-blur-lg border-t border-slate-800/80 pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-6 items-center h-15 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
            (item.path !== '/' && location.pathname.startsWith(item.path));

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center h-full min-h-[44px] min-w-[44px] py-1 transition-colors relative ${
                isActive 
                  ? item.isSpecial 
                    ? 'text-amber-400 font-semibold' 
                    : 'text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-3.5 px-1 py-0.2 bg-gradient-to-r from-rose-500 to-amber-500 text-[8px] font-black text-white rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight truncate max-w-[54px]">
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
