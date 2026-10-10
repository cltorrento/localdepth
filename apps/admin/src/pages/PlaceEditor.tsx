import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Place, Destination, PlaceCategory, PublishStatus } from '@localdepth/shared-types';
import { LeafletMapPicker } from '../components/LeafletMapPicker';
import { CoordinatesInput } from '../components/CoordinatesInput';
import { MapPreview } from '../components/MapPreview';

interface PlaceEditorProps {
  place: Place | null;
  onSave: () => void;
  onCancel: () => void;
}

export const PlaceEditor: React.FC<PlaceEditorProps> = ({ place, onSave, onCancel }) => {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState(place?.name || '');
  const [slug, setSlug] = useState(place?.slug || '');
  const [destinationId, setDestinationId] = useState(place?.destinationId || '');
  const [category, setCategory] = useState<PlaceCategory>(place?.category || 'restaurant');
  const [description, setDescription] = useState(
    typeof place?.description === 'string' ? place.description : ''
  );
  const [address, setAddress] = useState(place?.address || '');
  const [latitude, setLatitude] = useState<number | null>(place?.latitude ?? 45.449764);
  const [longitude, setLongitude] = useState<number | null>(place?.longitude ?? 9.180211);
  const [zoom, setZoom] = useState<number>(place?.zoom ?? 16);
  const [priceLevel, setPriceLevel] = useState<number>(place?.priceLevel || 2);
  const [status, setStatus] = useState<PublishStatus>(place?.status || 'published');
  const [localScore, setLocalScore] = useState<number>(place?.localScore || 9.2);
  const [crowdLevel, setCrowdLevel] = useState<'low' | 'moderate' | 'high'>(place?.crowdLevel || 'low');
  const [bestTime, setBestTime] = useState<string>(place?.bestTime || '13:00 o con reserva previa');
  const [walkability, setWalkability] = useState<boolean>(place?.walkability ?? true);

  useEffect(() => {
    api.getDestinations().then((res) => {
      const dests = res.data || [];
      setDestinations(dests);
      if (!destinationId && dests.length > 0) {
        setDestinationId(dests[0].id);
      }
    });
  }, []);

  const handleCoordsChange = (coords: { latitude: number; longitude: number; zoom: number }) => {
    setLatitude(coords.latitude);
    setLongitude(coords.longitude);
    setZoom(coords.zoom);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload = {
        name,
        slug: slug || undefined,
        destinationId,
        category,
        description,
        address: address || null,
        latitude,
        longitude,
        zoom,
        priceLevel,
        status,
        localScore,
        crowdLevel,
        bestTime,
        walkability,
      };

      if (place?.id) {
        await api.updatePlace(place.id, payload);
      } else {
        await api.createPlace(payload);
      }

      onSave();
    } catch (err: any) {
      setError(err.message || 'Error guardando lugar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-800 mb-1 flex items-center gap-1 font-semibold">
            ← Volver al listado
          </button>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {place ? `Editar Lugar: ${place.name}` : 'Crear Nuevo Lugar con Leaflet'}
          </h2>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancelar
          </button>
          <button
            form="place-form"
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar y Publicar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form id="place-form" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Place Details Form */}
        <div className="lg:col-span-7 space-y-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">Información del Lugar</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre del Lugar *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Trattoria Madonnina"
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Destino Asociado *</label>
              <select
                required
                value={destinationId}
                onChange={(e) => setDestinationId(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.country})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Categoría *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PlaceCategory)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="restaurant">Restaurante / Comida local</option>
                <option value="attraction">Atracción cultural / Monumento</option>
                <option value="experience">Experiencia / Café</option>
                <option value="neighborhood">Barrio con encanto</option>
                <option value="hotel">Alojamiento boutique</option>
                <option value="transport">Transporte / Mirador</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección Física</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej: Via Gentilino 9, 20136 Milano"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Descripción Editorial</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿Qué hace especial a este lugar? ¿Por qué es auténtico y local?"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Local Score (1-10)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="10"
                value={localScore}
                onChange={(e) => setLocalScore(parseFloat(e.target.value) || 9.0)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Aglomeración</label>
              <select
                value={crowdLevel}
                onChange={(e) => setCrowdLevel(e.target.value as any)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="low">Baja (Sin turistas)</option>
                <option value="moderate">Moderada</option>
                <option value="high">Alta</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nivel de Precio</label>
              <select
                value={priceLevel}
                onChange={(e) => setPriceLevel(parseInt(e.target.value) || 2)}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="1">€ (Barato)</option>
                <option value="2">€€ (Medio)</option>
                <option value="3">€€€ (Alto)</option>
                <option value="4">€€€€ (Exclusivo)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mejor Momento / Consejo</label>
            <input
              type="text"
              value={bestTime}
              onChange={(e) => setBestTime(e.target.value)}
              placeholder="Ej: 13:00 o 20:30 con reserva previa"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Right Column: Leaflet Interactive Map Picker & Coordinates */}
        <div className="lg:col-span-5 space-y-5">
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>📍 Selector de Mapa Leaflet</span>
              <span className="text-[11px] font-normal text-slate-500">Haz clic para mover el pin</span>
            </h3>

            {/* Interactive Leaflet Map */}
            <LeafletMapPicker
              latitude={latitude}
              longitude={longitude}
              zoom={zoom}
              onChange={handleCoordsChange}
              height="300px"
            />

            {/* Coordinate inputs with auto-URL generation */}
            <CoordinatesInput
              latitude={latitude}
              longitude={longitude}
              zoom={zoom}
              onChange={handleCoordsChange}
            />

            {/* Preview Card */}
            <MapPreview
              name={name}
              category={category}
              address={address}
              latitude={latitude}
              longitude={longitude}
              zoom={zoom}
              localScore={localScore}
            />
          </div>
        </div>
      </form>
    </div>
  );
};
