import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Place, Destination } from '@localdepth/shared-types';

interface PlacesListProps {
  onEditPlace: (place: Place | null) => void;
}

export const PlacesList: React.FC<PlacesListProps> = ({ onEditPlace }) => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedDest, setSelectedDest] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [placesRes, destRes] = await Promise.all([
        api.getPlaces(selectedDest ? { destinationId: selectedDest } : undefined),
        api.getDestinations(),
      ]);
      setPlaces(placesRes.data || []);
      setDestinations(destRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDest]);

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Eliminar lugar "${name}"?`)) {
      await api.deletePlace(id);
      loadData();
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Lugares y Puntos de Interés</h2>
          <p className="text-xs text-slate-500">Listado de lugares con geolocalización y métricas locales</p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedDest}
            onChange={(e) => setSelectedDest(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todos los destinos</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.country})
              </option>
            ))}
          </select>

          <button
            onClick={() => onEditPlace(null)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <span>+</span> Nuevo Lugar
          </button>
        </div>
      </div>

      {/* Places Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Cargando lugares...</div>
        ) : places.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No hay lugares registrados. Haz clic en "Nuevo Lugar" para añadir uno.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Lugar</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Coordenadas (Leaflet)</th>
                <th className="py-3 px-4">Score Local</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {places.map((place) => (
                <tr key={place.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 block">{place.name}</span>
                    <span className="text-[11px] text-slate-500">{place.address || 'Sin dirección'}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                      {place.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                    {place.latitude !== null && place.longitude !== null ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-emerald-600">📍</span>
                        <span>{place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}</span>
                      </div>
                    ) : (
                      <span className="text-amber-500">⚠️ Sin coordenadas</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-800">
                      ★ {place.localScore ?? '9.0'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        place.status === 'published'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {place.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => onEditPlace(place)}
                      className="text-emerald-600 hover:text-emerald-800 font-semibold"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(place.id, place.name)}
                      className="text-rose-500 hover:text-rose-700 font-semibold"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
