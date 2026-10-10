import React from 'react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'places', label: 'Lugares (Places)', icon: '📍' },
    { id: 'destinations', label: 'Destinos', icon: '🌍' },
    { id: 'itineraries', label: 'Itinerarios', icon: '🗓️' },
    { id: 'media', label: 'Biblioteca Multimedia', icon: '🖼️' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-screen">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/20">
            L
          </div>
          <div>
            <h1 className="font-bold text-white tracking-tight leading-none text-base">LocalDepth</h1>
            <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Admin Panel</span>
          </div>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="p-3 space-y-1 flex-1">
        <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Gestión Editorial
        </div>
        {menuItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-xs text-slate-500 space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>API Gateway: 4000 (Online)</span>
        </div>
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noreferrer"
          className="block text-emerald-400 hover:text-emerald-300 transition text-[11px]"
        >
          Ir al Sitio Público (Frontend) ↗
        </a>
      </div>
    </aside>
  );
};
