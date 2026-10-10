import React from 'react';
import { generateMapUrls } from '@localdepth/shared-utils';

interface MapPreviewProps {
  name: string;
  category: string;
  address?: string | null;
  latitude: number | null;
  longitude: number | null;
  zoom?: number;
  localScore?: number | null;
}

export const MapPreview: React.FC<MapPreviewProps> = ({
  name,
  category,
  address,
  latitude,
  longitude,
  zoom = 15,
  localScore,
}) => {
  const urls =
    latitude !== null && longitude !== null ? generateMapUrls(latitude, longitude, zoom) : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase font-bold tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
          {category || 'Lugar'}
        </span>
        {localScore && (
          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            ★ {localScore}/10 Local Score
          </span>
        )}
      </div>

      <div>
        <h4 className="font-semibold text-slate-900">{name || 'Nombre del lugar'}</h4>
        <p className="text-xs text-slate-500">{address || 'Dirección no especificada'}</p>
      </div>

      {latitude !== null && longitude !== null ? (
        <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Coordenadas:</span>
            <span className="font-mono">{latitude.toFixed(6)}, {longitude.toFixed(6)}</span>
          </div>
          {urls && (
            <div className="pt-2 flex gap-2">
              <a
                href={urls.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-600 hover:underline font-medium"
              >
                Abrir en Google Maps ↗
              </a>
              <span className="text-slate-300">·</span>
              <a
                href={urls.openStreetMapUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-600 hover:underline font-medium"
              >
                Ver en OpenStreetMap ↗
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
          ⚠️ Selecciona un punto en el mapa para activar la navegación geolocalizada.
        </div>
      )}
    </div>
  );
};
