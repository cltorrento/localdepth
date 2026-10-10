import React from 'react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  title: string;
}

export const Navbar: React.FC<NavbarProps> = ({ title }) => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
      <h2 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h2>

      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="block text-sm font-semibold text-slate-900 leading-tight">{user.name}</span>
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 rounded">
                {user.role}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-600 text-xs">
              {user.name.charAt(0)}
            </div>
          </div>
        )}

        <button
          onClick={logout}
          className="text-xs font-semibold text-slate-500 hover:text-rose-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
        >
          Cerrar Sesión
        </button>
      </div>
    </header>
  );
};
