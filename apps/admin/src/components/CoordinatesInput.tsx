import React from 'react';
import { generateMapUrls, formatCoordinates } from '@localdepth/shared-utils';

interface CoordinatesInputProps {
  latitude: number | null;
  longitude: number | null;
  zoom: number;
  onChange: (coords: { latitude: number; longitude: number; zoom: number }) => void;
  onAddressSearch?: (query: string) => void;
}

export const CoordinatesInput: React.FC<CoordinatesInputProps> = ({
  latitude,
  longitude,
  zoom,
  onChange,
  onAddressSearch,
}) => {
  const [addressQuery, setAddressQuery] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const urls =
    latitude !== null && longitude !== null
      ? generateMapUrls(latitude, longitude, zoom)
      : null;

  const handleCopy = () => {
    if (latitude !== null && longitude !== null) {
      navigator.clipboard.writeText(formatCoordinates(latitude, longitude));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (addressQuery.trim() && onAddressSearch) {
      onAddressSearch(addressQuery.trim());
    }
  };

  return (
    <div className="space-y-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Coordenadas y Georreferenciación
        </h4>
        {latitude !== null && longitude !== null && (
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs text-slate-500 hover:text-emerald-600 flex items-center gap-1 font-medium transition"
          >
            {copied ? '✓ ¡Copiadas!' : '📋 Copiar coordenadas'}
          </button>
        )}
      </div>

      {/* Address Search */}
      {onAddressSearch && (
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            placeholder="Buscar por dirección o punto de interés..."
            className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
          >
            Buscar
          </button>
        </form>
      )}

      {/* Coordinate Inputs */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Latitud</label>
          <input
            type="number"
            step="any"
            value={latitude ?? ''}
            onChange={(e) =>
              onChange({
                latitude: parseFloat(e.target.value) || 0,
                longitude: longitude ?? 0,
                zoom,
              })
            }
            placeholder="Ej: 45.464204"
            className="w-full text-xs font-mono border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Longitud</label>
          <input
            type="number"
            step="any"
            value={longitude ?? ''}
            onChange={(e) =>
              onChange({
                latitude: latitude ?? 0,
                longitude: parseFloat(e.target.value) || 0,
                zoom,
              })
            }
            placeholder="Ej: 9.189982"
            className="w-full text-xs font-mono border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Zoom</label>
          <input
            type="number"
            min="1"
            max="19"
            value={zoom}
            onChange={(e) =>
              onChange({
                latitude: latitude ?? 0,
                longitude: longitude ?? 0,
                zoom: parseInt(e.target.value, 10) || 15,
              })
            }
            className="w-full text-xs font-mono border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Generated External Links */}
      {urls && (
        <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 text-xs">
          <a
            href={urls.googleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 px-2.5 py-1 rounded-md transition"
          >
            Google Maps ↗
          </a>
          <a
            href={urls.appleMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 px-2.5 py-1 rounded-md transition"
          >
            Apple Maps ↗
          </a>
          <a
            href={urls.openStreetMapUrl}
            target="_blank"
            rel="noreferrer"
            className="text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 border border-slate-200 px-2.5 py-1 rounded-md transition"
          >
            OpenStreetMap ↗
          </a>
        </div>
      )}
    </div>
  );
};
