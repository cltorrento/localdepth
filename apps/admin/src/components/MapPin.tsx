import React from 'react';
import { PlaceCategory } from '@localdepth/shared-types';

interface MapPinProps {
  category?: PlaceCategory;
  name?: string;
}

export const MapPin: React.FC<MapPinProps> = ({ category = 'attraction', name }) => {
  const getBadgeColor = () => {
    switch (category) {
      case 'restaurant':
        return 'bg-amber-500 text-white';
      case 'hotel':
        return 'bg-indigo-500 text-white';
      case 'experience':
        return 'bg-purple-500 text-white';
      case 'neighborhood':
        return 'bg-emerald-500 text-white';
      default:
        return 'bg-rose-500 text-white';
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      <div
        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md uppercase tracking-wider mb-0.5 ${getBadgeColor()}`}
      >
        {category}
      </div>
      <div className="w-6 h-6 rounded-full bg-slate-900 border-2 border-white shadow-lg flex items-center justify-center">
        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
      </div>
      {name && <span className="text-xs font-semibold text-slate-800 bg-white/90 px-1.5 rounded mt-0.5">{name}</span>}
    </div>
  );
};
