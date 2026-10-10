import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Destination } from '@localdepth/shared-types';

export const DestinationsList: React.FC = () => {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New Dest form
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [description, setDescription] = useState('');
  const [averageDailyBudget, setAverageDailyBudget] = useState(120);
  const [bestTimeToVisit, setBestTimeToVisit] = useState('Primavera / Otoño');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getDestinations();
      setDestinations(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createDestination({
      name,
      country,
      type: 'city',
      description,
      averageDailyBudget,
      bestTimeToVisit,
      status: 'published',
    });
    setName('');
    setCountry('');
    setDescription('');
    setShowModal(false);
    loadData();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Destinos Turísticos</h2>
          <p className="text-xs text-slate-500">Ciudades y regiones disponibles en LocalDepth</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition"
        >
          + Nuevo Destino
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-sm text-slate-400">Cargando destinos...</div>
        ) : (
          destinations.map((d) => (
            <div key={d.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{d.name}</h3>
                  <span className="text-xs text-slate-500">{d.country} · {d.type}</span>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                  {d.status}
                </span>
              </div>
              <p className="text-xs text-slate-600 line-clamp-2">{d.description || 'Sin descripción'}</p>
              <div className="pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                <span>Presupuesto: <strong className="text-slate-800">{d.averageDailyBudget || 100}€/día</strong></span>
                <span>{d.currency || 'EUR'}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Añadir Nuevo Destino</h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre (Ciudad)</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Barcelona, Kioto, Lisboa"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">País</label>
                <input
                  type="text"
                  required
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Ej: España, Japón, Portugal"
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Presupuesto Diario Estimado (€)</label>
                <input
                  type="number"
                  value={averageDailyBudget}
                  onChange={(e) => setAverageDailyBudget(parseInt(e.target.value) || 100)}
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve reseña del destino..."
                  className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white font-semibold rounded-lg text-xs hover:bg-emerald-700"
                >
                  Guardar Destino
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
