import React, { useEffect, useState } from 'react';
import { api } from '../api/client';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    placesCount: 0,
    destinationsCount: 0,
    itinerariesCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getPlaces(), api.getDestinations(), api.getItineraries()])
      .then(([places, dests, itin]) => {
        setStats({
          placesCount: places.data?.length || 0,
          destinationsCount: dests.data?.length || 0,
          itinerariesCount: itin.data?.length || 0,
        });
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Bienvenido a LocalDepth Studio</h2>
          <p className="text-emerald-200 text-sm max-w-xl">
            Gestiona el conocimiento local, georreferencia paradas con Leaflet y alimenta el motor de itinerarios de nuestro Travel Copilot.
          </p>
        </div>
        <button
          onClick={() => onNavigate('places')}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-sm transition shadow-lg shrink-0"
        >
          + Crear Nuevo Lugar
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => onNavigate('places')}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-500 transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl">📍</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Activos</span>
          </div>
          <span className="text-3xl font-bold text-slate-900">{loading ? '...' : stats.placesCount}</span>
          <span className="block text-xs font-medium text-slate-500 mt-1">Lugares geolocalizados</span>
        </div>

        <div
          onClick={() => onNavigate('destinations')}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-500 transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl">🌍</span>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">Catálogo</span>
          </div>
          <span className="text-3xl font-bold text-slate-900">{loading ? '...' : stats.destinationsCount}</span>
          <span className="block text-xs font-medium text-slate-500 mt-1">Destinos publicados</span>
        </div>

        <div
          onClick={() => onNavigate('itineraries')}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-500 transition cursor-pointer"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-3xl">🗓️</span>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">Copilot Ready</span>
          </div>
          <span className="text-3xl font-bold text-slate-900">{loading ? '...' : stats.itinerariesCount}</span>
          <span className="block text-xs font-medium text-slate-500 mt-1">Itinerarios estructurados</span>
        </div>
      </div>

      {/* Direct actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h3 className="font-bold text-slate-800 text-base">Acciones recomendadas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => onNavigate('places')}
            className="p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer flex items-start gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold shrink-0">
              🗺️
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 text-sm">Gestionar Mapa de Lugares</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Ubica restaurantes, atracciones y rincones auténticos con coordenadas exactas en Leaflet.
              </p>
            </div>
          </div>

          <div
            onClick={() => onNavigate('media')}
            className="p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition cursor-pointer flex items-start gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-800 font-bold shrink-0">
              🖼️
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 text-sm">Biblioteca de Fotos</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Sube imágenes para los lugares y destinos a MinIO / S3.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
