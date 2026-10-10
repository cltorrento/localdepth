import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Itinerary } from '@localdepth/shared-types';

export const ItinerariesList: React.FC = () => {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getItineraries()
      .then((res) => setItineraries(res.data || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Itinerarios y Planes Curados</h2>
          <p className="text-xs text-slate-500">Planes día por día generados por editores y por el Travel Copilot</p>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-sm text-slate-400">Cargando itinerarios...</div>
        ) : (
          itineraries.map((it) => (
            <div key={it.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{it.title}</h3>
                  <span className="text-xs text-slate-500">
                    Duración: <strong>{it.totalDays} días</strong> · Presupuesto: <strong>{it.totalBudget || 100}€</strong>
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                  {it.status}
                </span>
              </div>

              <p className="text-sm text-slate-600">{it.summary}</p>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Desglose de Días:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {it.days?.map((d) => (
                    <div key={d.dayNumber} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                      <div className="flex justify-between font-semibold text-slate-800">
                        <span>{d.title}</span>
                        <span className="text-emerald-700">{d.estimatedCost || 50}€</span>
                      </div>
                      <p className="text-slate-500 text-[11px]">{d.summary}</p>
                      <div className="text-[10px] text-slate-600 pt-1">
                        📍 {d.stops?.length || 0} paradas geolocalizadas
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
