/**
 * Generates map URLs for Google Maps, Apple Maps, and OpenStreetMap
 * as strictly defined in LocalDepth platform specification.
 */
export function generateMapUrls(latitude: number, longitude: number, zoom: number = 15) {
  return {
    googleMapsUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
    appleMapsUrl: `https://maps.apple.com/?q=${latitude},${longitude}`,
    openStreetMapUrl: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=${zoom}/${latitude}/${longitude}`,
  };
}

/**
 * Normalizes text to a clean URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // separate accents from characters
    .replace(/[\u0300-\u036f]/g, '') // remove accent diacritics
    .replace(/[^a-z0-9 -]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by -
    .replace(/-+/g, '-') // collapse dashes
    .replace(/^-+/, '') // trim - from start
    .replace(/-+$/, ''); // trim - from end
}

/**
 * Formats coordinates for display or copying
 */
export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

/**
 * Calculates distance between two coordinates in kilometers (Haversine formula)
 * Essential for proximity routing in LocalDepth Travel Copilot & nearby places.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export type TranslationLocale = 'en' | 'it' | 'de';

const translationCache = new Map<string, string>();
const untranslatedKeys = new Set([
  'slug',
  'currency',
  'image',
  'imageUrl',
  'heroImageUrl',
  'latitude',
  'longitude',
  'placeId',
  'destinationId',
  'guideId',
  'timeOfDay',
  'status',
  'id',
  'createdAt',
  'updatedAt',
]);

async function translateBatch(texts: string[], locale: TranslationLocale): Promise<string[]> {
  if (texts.length === 0) return [];
  const key = process.env.DEEPL_API_KEY;
  if (!key) {
    throw new Error('Falta configurar DEEPL_API_KEY para mostrar el sitio en otro idioma.');
  }

  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: texts,
      source_lang: 'ES',
      target_lang: locale === 'en' ? 'EN-US' : locale.toUpperCase(),
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepL no pudo traducir el contenido (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as { translations?: Array<{ text?: string }> };
  const translations = payload.translations?.map((item) => item.text);
  if (
    translations &&
    translations.length === texts.length &&
    translations.every((text) => typeof text === 'string' && text.length > 0)
  ) {
    return translations as string[];
  }

  if (texts.length > 1) {
    const midpoint = Math.ceil(texts.length / 2);
    const firstHalf = await translateBatch(texts.slice(0, midpoint), locale);
    const secondHalf = await translateBatch(texts.slice(midpoint), locale);
    return [...firstHalf, ...secondHalf];
  }

  throw new Error('DeepL devolvió una traducción vacía o incompleta para un texto.');
}

export async function translateContent<T>(source: T, locale: TranslationLocale): Promise<T> {
  const sourceStrings = new Set<string>();
  const collect = (value: unknown, key?: string): void => {
    if (typeof value === 'string') {
      if (!untranslatedKeys.has(key || '') && !/^https?:\/\//i.test(value)) sourceStrings.add(value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => collect(item));
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([childKey, child]) => collect(child, childKey));
    }
  };
  collect(source);

  const missing = [...sourceStrings].filter(
    (text) => text.trim().length > 0 && !translationCache.has(`${locale}\u0000${text}`)
  );
  let batch: string[] = [];
  let batchBytes = 0;
  const flushBatch = async () => {
    if (batch.length === 0) return;
    const translations = await translateBatch(batch, locale);
    batch.forEach((text, translationIndex) => {
      translationCache.set(`${locale}\u0000${text}`, translations[translationIndex]);
    });
    batch = [];
    batchBytes = 0;
  };
  for (const text of missing) {
    const textBytes = new TextEncoder().encode(JSON.stringify(text)).length;
    if (batch.length >= 40 || (batch.length > 0 && batchBytes + textBytes > 90_000)) {
      await flushBatch();
    }
    batch.push(text);
    batchBytes += textBytes;
  }
  await flushBatch();

  const apply = (value: unknown, key?: string): unknown => {
    if (typeof value === 'string') {
      if (untranslatedKeys.has(key || '') || /^https?:\/\//i.test(value)) return value;
      return translationCache.get(`${locale}\u0000${value}`) ?? value;
    }
    if (Array.isArray(value)) return value.map((item) => apply(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([childKey, child]) => [childKey, apply(child, childKey)])
      );
    }
    return value;
  };

  return apply(source) as T;
}
