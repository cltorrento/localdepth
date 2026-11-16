import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type {
  Destination,
  DestinationCreateInput,
  DestinationFood,
  DestinationGuideContent,
  DestinationHighlight,
  FAQ,
} from '@localdepth/shared-types';

interface DestinationDraft extends DestinationCreateInput {
  latitude: number | null;
  longitude: number | null;
  averageDailyBudget: number | null;
  guide: DestinationGuideContent;
}

const emptyHighlight = (): DestinationHighlight => ({
  name: '',
  description: '',
  imageUrl: '',
  latitude: null,
  longitude: null,
});

const emptyFaq = (): FAQ => ({ question: '', answer: '' });
const emptyFood = (): DestinationFood => ({ name: '', imageUrl: '', ingredients: [] });

const emptyDraft = (): DestinationDraft => ({
  name: '',
  country: '',
  type: 'city',
  description: '',
  heroImageUrl: '',
  bestTimeToVisit: '',
  currency: 'EUR',
  language: '',
  averageDailyBudget: 120,
  latitude: null,
  longitude: null,
  status: 'published',
  guide: {
    headline: '',
    introduction: '',
    gettingAround: '',
    suggestedDays: 3,
    placesToVisit: Array.from({ length: 10 }, emptyHighlight),
    typicalFoods: Array.from({ length: 6 }, emptyFood),
    travelTips: [],
    faqs: [emptyFaq(), emptyFaq()],
  },
});

const inputClassName =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100';
const labelClassName = 'mb-1 block text-xs font-semibold text-slate-700';
const frontendBaseUrl = 'http://localhost:3000';
const destinationLocales = ['en', 'it', 'de'] as const;

export const DestinationsList: React.FC = () => {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingDestinationId, setEditingDestinationId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DestinationDraft>(emptyDraft);
  const [travelTipsText, setTravelTipsText] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getDestinations();
      setDestinations(res.data || []);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los destinos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateHighlight = (index: number, key: keyof DestinationHighlight, value: string) => {
    setDraft((current) => {
      const placesToVisit = [...current.guide.placesToVisit];
      const place = { ...placesToVisit[index] };
      if (key === 'latitude' || key === 'longitude') {
        place[key] = value === '' ? null : Number(value);
      } else {
        place[key] = value;
      }
      placesToVisit[index] = place;
      return { ...current, guide: { ...current.guide, placesToVisit } };
    });
  };

  const updateFaq = (index: number, key: keyof FAQ, value: string) => {
    setDraft((current) => {
      const faqs = [...current.guide.faqs];
      faqs[index] = { ...faqs[index], [key]: value };
      return { ...current, guide: { ...current.guide, faqs } };
    });
  };

  const updateFood = (index: number, key: keyof DestinationFood, value: string) => {
    setDraft((current) => {
      const typicalFoods = [...current.guide.typicalFoods];
      typicalFoods[index] = {
        ...typicalFoods[index],
        [key]: key === 'ingredients'
          ? value.split(',').map((ingredient) => ingredient.trim()).filter(Boolean)
          : value,
      };
      return { ...current, guide: { ...current.guide, typicalFoods } };
    });
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const destinationInput = {
        ...draft,
        guide: {
          ...draft.guide,
          travelTips: travelTipsText.split('\n').map((tip) => tip.trim()).filter(Boolean),
        },
      };
      if (editingDestinationId) {
        await api.updateDestination(editingDestinationId, destinationInput);
      } else {
        await api.createDestination(destinationInput);
      }
      setDraft(emptyDraft());
      setTravelTipsText('');
      setEditingDestinationId(null);
      setShowModal(false);
      await loadData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo guardar el destino.');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (destination: Destination) => {
    setError('');
    setEditingDestinationId(destination.id);
    setDraft({
      name: destination.name,
      country: destination.country,
      type: destination.type,
      slug: destination.slug,
      parentId: destination.parentId ?? null,
      description: destination.description,
      heroImageId: destination.heroImageId ?? null,
      heroImageUrl: destination.heroImageUrl ?? '',
      bestTimeToVisit: destination.bestTimeToVisit ?? '',
      currency: destination.currency ?? 'EUR',
      language: destination.language ?? '',
      averageDailyBudget: destination.averageDailyBudget ?? null,
      latitude: destination.latitude ?? null,
      longitude: destination.longitude ?? null,
      guide: destination.guide || emptyDraft().guide,
      status: destination.status,
    });
    setTravelTipsText(destination.guide?.travelTips.join('\n') || '');
    setShowModal(true);
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Destinos Turísticos</h2>
          <p className="text-xs text-slate-500">Ciudades y guías prácticas para viajeros</p>
        </div>
        <button
          onClick={() => {
            setError('');
            setShowModal(true);
          }}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
        >
          + Nueva Ciudad
        </button>
      </div>

      {error && !showModal && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {loading ? (
          <div className="col-span-3 py-12 text-center text-sm text-slate-400">Cargando destinos...</div>
        ) : (
          destinations.map((destination) => (
            <article key={destination.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{destination.name}</h3>
                  <span className="text-xs text-slate-500">{destination.country} · {destination.type}</span>
                </div>
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  {destination.status}
                </span>
              </div>
              <p className="line-clamp-2 text-xs text-slate-600">{destination.description || 'Sin descripción'}</p>
              {destination.heroImageUrl && (
                <img
                  src={destination.heroImageUrl}
                  alt={`Portada de ${destination.name}`}
                  className="h-40 w-full rounded-xl object-cover"
                  loading="lazy"
                />
              )}
              <div className="flex items-center gap-1" aria-label="Idiomas disponibles">
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700" title="Español disponible">
                  ES
                </span>
                {destinationLocales.map((locale) => {
                  const available = Boolean(destination.translations?.[locale]);
                  return (
                    <span
                      key={locale}
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}
                      title={available ? `Traducción ${locale.toUpperCase()} disponible` : `Falta traducción ${locale.toUpperCase()}`}
                    >
                      {locale.toUpperCase()}
                    </span>
                  );
                })}
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>Presupuesto: <strong className="text-slate-800">{destination.averageDailyBudget ?? '—'} {destination.currency || ''}/día</strong></span>
                <span>{destination.guide?.placesToVisit.length ?? 0} lugares</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => startEditing(destination)}
                  className="inline-flex rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Editar destino
                </button>
                {destination.status === 'published' && (
                  <a
                    href={`${frontendBaseUrl.replace(/\/$/, '')}/viajes/${encodeURIComponent(destination.slug)}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50"
                  >
                    Ver guía pública ↗
                  </a>
                )}
              </div>
            </article>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-4xl space-y-5 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div>
              <h3 className="text-base font-bold text-slate-900">{editingDestinationId ? 'Editar destino' : 'Crear guía de ciudad'}</h3>
              <p className="mt-1 text-xs text-slate-500">
                Completa la información práctica, los lugares y las coordenadas que verán los viajeros.
              </p>
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-6">
              <section className="space-y-3">
                <h4 className="border-b pb-2 text-sm font-bold text-slate-800">Destino y datos prácticos</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className={labelClassName}>Tipo de destino *</span>
                    <select
                      className={inputClassName}
                      required
                      value={draft.type}
                      onChange={(event) => setDraft({ ...draft, type: event.target.value as DestinationCreateInput['type'] })}
                    >
                      <option value="city">Ciudad</option>
                      <option value="region">Región</option>
                      <option value="country">País</option>
                    </select>
                  </label>
                  <label>
                    <span className={labelClassName}>Nombre de la ciudad *</span>
                    <input className={inputClassName} required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ej.: Copenhague" />
                  </label>
                  <label>
                    <span className={labelClassName}>País *</span>
                    <input className={inputClassName} required value={draft.country} onChange={(event) => setDraft({ ...draft, country: event.target.value })} placeholder="Ej.: Dinamarca" />
                  </label>
                  <label className="sm:col-span-2">
                    <span className={labelClassName}>Resumen para la tarjeta *</span>
                    <textarea className={inputClassName} required minLength={20} rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Presentación corta que aparecerá junto a la imagen." />
                  </label>
                  <label className="sm:col-span-2">
                    <span className={labelClassName}>URL de imagen de portada *</span>
                    <input className={inputClassName} type="url" required value={draft.heroImageUrl || ''} onChange={(event) => setDraft({ ...draft, heroImageUrl: event.target.value })} placeholder="https://..." />
                  </label>
                  <label>
                    <span className={labelClassName}>Coordenadas de la ciudad · latitud *</span>
                    <input className={inputClassName} type="number" required min={-90} max={90} step="any" value={draft.latitude ?? ''} onChange={(event) => setDraft({ ...draft, latitude: event.target.value === '' ? null : Number(event.target.value) })} />
                  </label>
                  <label>
                    <span className={labelClassName}>Coordenadas de la ciudad · longitud *</span>
                    <input className={inputClassName} type="number" required min={-180} max={180} step="any" value={draft.longitude ?? ''} onChange={(event) => setDraft({ ...draft, longitude: event.target.value === '' ? null : Number(event.target.value) })} />
                  </label>
                  <label>
                    <span className={labelClassName}>Mejor época para visitar *</span>
                    <input className={inputClassName} required value={draft.bestTimeToVisit || ''} onChange={(event) => setDraft({ ...draft, bestTimeToVisit: event.target.value })} placeholder="Ej.: mayo a septiembre" />
                  </label>
                  <label>
                    <span className={labelClassName}>Días recomendados *</span>
                    <input className={inputClassName} required type="number" min={1} max={30} value={draft.guide.suggestedDays ?? 3} onChange={(event) => setDraft({ ...draft, guide: { ...draft.guide, suggestedDays: Number(event.target.value) } })} />
                  </label>
                  <label>
                    <span className={labelClassName}>Presupuesto diario *</span>
                    <input className={inputClassName} required type="number" min={1} value={draft.averageDailyBudget ?? ''} onChange={(event) => setDraft({ ...draft, averageDailyBudget: event.target.value === '' ? null : Number(event.target.value) })} />
                  </label>
                  <label>
                    <span className={labelClassName}>Moneda *</span>
                    <input className={inputClassName} required value={draft.currency || ''} onChange={(event) => setDraft({ ...draft, currency: event.target.value.toUpperCase() })} placeholder="EUR" />
                  </label>
                  <label className="sm:col-span-2">
                    <span className={labelClassName}>Idioma(s) *</span>
                    <input className={inputClassName} required value={draft.language || ''} onChange={(event) => setDraft({ ...draft, language: event.target.value })} placeholder="Danés, inglés" />
                  </label>
                </div>
              </section>

              <section className="space-y-3">
                <h4 className="border-b pb-2 text-sm font-bold text-slate-800">Guía de viaje</h4>
                <label className="block">
                  <span className={labelClassName}>Título de la guía *</span>
                  <input className={inputClassName} required value={draft.guide.headline || ''} onChange={(event) => setDraft({ ...draft, guide: { ...draft.guide, headline: event.target.value } })} placeholder="Ej.: 10 lugares que ver en Copenhague" />
                </label>
                <label className="block">
                  <span className={labelClassName}>Introducción para el viajero *</span>
                  <textarea className={inputClassName} required minLength={40} rows={4} value={draft.guide.introduction} onChange={(event) => setDraft({ ...draft, guide: { ...draft.guide, introduction: event.target.value } })} placeholder="Qué ofrece la ciudad, por qué visitarla y cuántos días dedicarle." />
                </label>
                <label className="block">
                  <span className={labelClassName}>Cómo moverse por la ciudad *</span>
                  <textarea className={inputClassName} required minLength={20} rows={3} value={draft.guide.gettingAround} onChange={(event) => setDraft({ ...draft, guide: { ...draft.guide, gettingAround: event.target.value } })} placeholder="Transporte público, abonos, bicicleta, desplazamientos desde el aeropuerto..." />
                </label>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="text-sm font-bold text-slate-800">Lugares que visitar (mínimo 10)</h4>
                  <button type="button" onClick={() => setDraft({ ...draft, guide: { ...draft.guide, placesToVisit: [...draft.guide.placesToVisit, emptyHighlight()] } })} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">
                    + Añadir lugar
                  </button>
                </div>
                {draft.guide.placesToVisit.map((place, index) => (
                  <fieldset key={index} className="space-y-3 rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <legend className="text-xs font-bold text-slate-700">Lugar {index + 1}</legend>
                      {draft.guide.placesToVisit.length > 10 && (
                        <button type="button" onClick={() => setDraft({ ...draft, guide: { ...draft.guide, placesToVisit: draft.guide.placesToVisit.filter((_, placeIndex) => placeIndex !== index) } })} className="text-xs text-rose-600 hover:text-rose-800">
                          Eliminar
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label>
                        <span className={labelClassName}>Nombre *</span>
                        <input className={inputClassName} required value={place.name} onChange={(event) => updateHighlight(index, 'name', event.target.value)} placeholder="Ej.: Nyhavn" />
                      </label>
                      <label>
                        <span className={labelClassName}>URL de imagen</span>
                        <input className={inputClassName} type="url" value={place.imageUrl || ''} onChange={(event) => updateHighlight(index, 'imageUrl', event.target.value)} placeholder="https://..." />
                      </label>
                      <label className="sm:col-span-2">
                        <span className={labelClassName}>Qué verá o hará el viajero *</span>
                        <textarea className={inputClassName} required minLength={20} rows={2} value={place.description} onChange={(event) => updateHighlight(index, 'description', event.target.value)} placeholder="Descripción, contexto o consejo local del lugar." />
                      </label>
                      <label>
                        <span className={labelClassName}>Latitud *</span>
                        <input className={inputClassName} type="number" required min={-90} max={90} step="any" value={place.latitude ?? ''} onChange={(event) => updateHighlight(index, 'latitude', event.target.value)} />
                      </label>
                      <label>
                        <span className={labelClassName}>Longitud *</span>
                        <input className={inputClassName} type="number" required min={-180} max={180} step="any" value={place.longitude ?? ''} onChange={(event) => updateHighlight(index, 'longitude', event.target.value)} />
                      </label>
                    </div>
                  </fieldset>
                ))}
              </section>

              <section className="space-y-3">
                <h4 className="border-b pb-2 text-sm font-bold text-slate-800">Comida típica, consejos y preguntas frecuentes</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={labelClassName}>Platos típicos con foto (mínimo 6) *</span>
                    <button type="button" onClick={() => setDraft({ ...draft, guide: { ...draft.guide, typicalFoods: [...draft.guide.typicalFoods, emptyFood()] } })} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">
                      + Añadir plato
                    </button>
                  </div>
                  {draft.guide.typicalFoods.map((food, index) => (
                    <fieldset key={index} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
                      <legend className="text-xs font-bold text-slate-700">Plato típico {index + 1}</legend>
                      <label>
                        <span className={labelClassName}>Nombre del plato *</span>
                        <input className={inputClassName} required value={food.name} onChange={(event) => updateFood(index, 'name', event.target.value)} placeholder="Ej.: smørrebrød" />
                      </label>
                      <label>
                        <span className={labelClassName}>URL de la foto del plato *</span>
                        <input className={inputClassName} type="url" required value={food.imageUrl} onChange={(event) => updateFood(index, 'imageUrl', event.target.value)} placeholder="https://..." />
                      </label>
                      <label className="sm:col-span-2">
                        <span className={labelClassName}>Ingredientes · separados por comas (mínimo 2) *</span>
                        <input className={inputClassName} required value={food.ingredients.join(', ')} onChange={(event) => updateFood(index, 'ingredients', event.target.value)} placeholder="Ej.: pan, tomate, aceite de oliva" />
                      </label>
                      {draft.guide.typicalFoods.length > 6 && (
                        <button type="button" onClick={() => setDraft({ ...draft, guide: { ...draft.guide, typicalFoods: draft.guide.typicalFoods.filter((_, foodIndex) => foodIndex !== index) } })} className="text-left text-xs text-rose-600 hover:text-rose-800">
                          Eliminar plato
                        </button>
                      )}
                    </fieldset>
                  ))}
                </div>
                <label className="block">
                  <span className={labelClassName}>Consejos prácticos · uno por línea (mínimo 2) *</span>
                  <textarea className={inputClassName} required rows={4} value={travelTipsText} onChange={(event) => setTravelTipsText(event.target.value)} placeholder={'Reserva las visitas populares con antelación.\nComprueba horarios y transporte antes de salir.'} />
                </label>
                {draft.guide.faqs.map((faq, index) => (
                  <fieldset key={index} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
                    <legend className="text-xs font-bold text-slate-700">Pregunta frecuente {index + 1}</legend>
                    <label>
                      <span className={labelClassName}>Pregunta *</span>
                      <input className={inputClassName} required value={faq.question} onChange={(event) => updateFaq(index, 'question', event.target.value)} placeholder="¿Cuántos días necesito?" />
                    </label>
                    <label>
                      <span className={labelClassName}>Respuesta *</span>
                      <textarea className={inputClassName} required rows={2} value={faq.answer} onChange={(event) => updateFaq(index, 'answer', event.target.value)} placeholder="Respuesta práctica para quien prepara el viaje." />
                    </label>
                  </fieldset>
                ))}
                <button type="button" onClick={() => setDraft({ ...draft, guide: { ...draft.guide, faqs: [...draft.guide.faqs, emptyFaq()] } })} className="text-xs font-semibold text-emerald-700 hover:text-emerald-900">
                  + Añadir pregunta frecuente
                </button>
              </section>

              <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white py-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingDestinationId(null);
                    setDraft(emptyDraft());
                    setTravelTipsText('');
                    setError('');
                  }}
                  className="rounded-lg border px-4 py-2 text-xs font-semibold"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                  {saving ? 'Guardando...' : editingDestinationId ? 'Guardar cambios' : 'Publicar guía de ciudad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
