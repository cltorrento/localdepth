import http from 'node:http';
import crypto from 'node:crypto';
import { createLogger } from '@localdepth/logger';
import {
  deleteStoredDestination,
  getStoredDestinationEngagement,
  getStoredDestination,
  getStoredDestinations,
  getStoredTopRatedDestinations,
  insertStoredDestinationComment,
  initializeDestinationStorage,
  MemoryStore,
  saveStoredDestination,
  upsertStoredDestinationRating,
} from '@localdepth/database';
import { generateMapUrls, slugify, translateContent } from '@localdepth/shared-utils';
import { validateDestination, validatePlace } from '@localdepth/validation';
import type {
  Destination,
  DestinationLocale,
  LocalizedDestinationContent,
  Place,
  Guide,
  Itinerary,
} from '@localdepth/shared-types';
import type { DestinationComment, DestinationEngagement, TopRatedDestination } from '@localdepth/database';

const logger = createLogger('content-service');
const PORT = Number(process.env.CONTENT_SERVICE_PORT) || 4002;
const store = MemoryStore.getInstance();
const supportedDestinationLocales: DestinationLocale[] = ['en', 'it', 'de'];
const voterKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getMemoryEngagement(destinationId: string): DestinationEngagement {
  const comments = Array.from(store.comments.values())
    .filter((comment) => comment.destinationId === destinationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ratings = Array.from(store.ratings.values()).filter((rating) => rating.destinationId === destinationId);
  return {
    averageRating: ratings.length
      ? ratings.reduce((total, rating) => total + rating.score, 0) / ratings.length
      : 0,
    ratingCount: ratings.length,
    commentCount: comments.length,
    comments: comments.slice(0, 50).map(({ id, authorName, body, createdAt }) => ({
      id,
      authorName,
      body,
      createdAt,
    })),
  };
}

function getMemoryTopRatedDestinations(limit = 5): TopRatedDestination[] {
  return Array.from(store.destinations.values())
    .filter((destination) => destination.status === 'published')
    .map((destination) => ({
      slug: destination.slug,
      name: destination.name,
      country: destination.country,
      heroImageUrl: destination.heroImageUrl || null,
      ...getMemoryEngagement(destination.id),
    }))
    .map(({ comments: _comments, commentCount: _commentCount, ...destination }) => destination)
    .sort((a, b) =>
      b.averageRating - a.averageRating ||
      b.ratingCount - a.ratingCount ||
      a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

async function initializePersistentDestinations(): Promise<boolean> {
  const retries = 10;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const destinations = await initializeDestinationStorage(Array.from(store.destinations.values()));
      if (!destinations) {
        logger.warn('PostgreSQL is unavailable; destination edits will be disabled and memory data will be used.');
        return false;
      }
      store.destinations.clear();
      for (const destination of destinations) store.destinations.set(destination.id, destination);
      logger.info('Persistent destination storage is ready', { destinations: destinations.length });
      return true;
    } catch (error) {
      if (attempt === retries) {
        logger.error('Could not initialize persistent destination storage; destination edits will be disabled.', {
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return false;
}

const persistentDestinationsReady =
  process.env.NODE_ENV === 'test'
    ? Promise.resolve(false)
    : initializePersistentDestinations();

async function createDestinationTranslation(
  destination: Destination,
  locale: DestinationLocale
): Promise<LocalizedDestinationContent> {
  return translateContent(
    {
      name: destination.name,
      country: destination.country,
      description: destination.description,
      language: destination.language,
      bestTimeToVisit: destination.bestTimeToVisit,
      guide: destination.guide,
    },
    locale
  );
}

const readBody = (req: http.IncomingMessage): Promise<any> => {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
};

export async function handleContentRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const method = req.method || 'GET';
  const path = url.pathname;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, x-user-role');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (path === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', service: 'content-service', timestamp: new Date().toISOString() }));
    return;
  }

  try {
    // =============================================================
    // DESTINATIONS
    // =============================================================
    if (path === '/content/destinations' && method === 'GET') {
      const type = url.searchParams.get('type');
      const status = url.searchParams.get('status');
      const queryText = url.searchParams.get('q')?.toLowerCase();

      const persistentStorageAvailable = await persistentDestinationsReady;
      let items = persistentStorageAvailable
        ? await getStoredDestinations()
        : Array.from(store.destinations.values());
      if (type) items = items.filter((d) => d.type === type);
      if (status) items = items.filter((d) => d.status === status);
      if (queryText) {
        items = items.filter(
          (d) => d.name.toLowerCase().includes(queryText) || d.country.toLowerCase().includes(queryText)
        );
      }

      const requestedLocale = url.searchParams.get('lang') as DestinationLocale | null;
      if (requestedLocale && supportedDestinationLocales.includes(requestedLocale)) {
        items = await Promise.all(items.map(async (destination) => {
          if (destination.translations?.[requestedLocale]) return destination;
          const translation = await createDestinationTranslation(destination, requestedLocale);
          const localized = {
            ...destination,
            translations: { ...destination.translations, [requestedLocale]: translation },
          };
          if (persistentStorageAvailable) await saveStoredDestination(localized);
          store.destinations.set(destination.id, localized);
          return localized;
        }));
      }

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: items, meta: { total: items.length } }));
      return;
    }

    if (path === '/content/destinations/top-rated' && method === 'GET') {
      const persistentStorageAvailable = await persistentDestinationsReady;
      if (!persistentStorageAvailable && process.env.NODE_ENV !== 'test') {
        res.writeHead(503);
        res.end(JSON.stringify({ success: false, error: 'PostgreSQL no está disponible; no se pudo cargar el ranking.' }));
        return;
      }
      const requestedLimit = Number(url.searchParams.get('limit') || 5);
      if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'El límite debe ser un número entre 1 y 100.' }));
        return;
      }
      const items = persistentStorageAvailable
        ? await getStoredTopRatedDestinations(requestedLimit)
        : getMemoryTopRatedDestinations(requestedLimit);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: items, meta: { total: items.length } }));
      return;
    }

    const communityRoute = path.match(/^\/content\/destinations\/([^/]+)\/(engagement|comments|ratings)$/);
    if (communityRoute) {
      const [, encodedIdOrSlug, resource] = communityRoute;
      const idOrSlug = decodeURIComponent(encodedIdOrSlug);
      const persistentStorageAvailable = await persistentDestinationsReady;
      if (!persistentStorageAvailable && process.env.NODE_ENV !== 'test') {
        res.writeHead(503);
        res.end(JSON.stringify({ success: false, error: 'PostgreSQL no está disponible; la comunidad no está disponible temporalmente.' }));
        return;
      }
      const destination = persistentStorageAvailable
        ? await getStoredDestination(idOrSlug)
        : store.destinations.get(idOrSlug) ||
          Array.from(store.destinations.values()).find((item) => item.slug === idOrSlug);
      if (!destination || destination.status !== 'published') {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Destination not found' }));
        return;
      }

      if ((resource === 'engagement' || resource === 'comments') && method === 'GET') {
        const engagement = persistentStorageAvailable
          ? await getStoredDestinationEngagement(destination.id)
          : getMemoryEngagement(destination.id);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          data: resource === 'comments' ? engagement.comments : engagement,
        }));
        return;
      }

      if (resource === 'comments' && method === 'POST') {
        const body = await readBody(req);
        const authorName = typeof body?.authorName === 'string' ? body.authorName.trim() : '';
        const commentBody = typeof body?.body === 'string' ? body.body.trim() : '';
        if (authorName.length < 1 || authorName.length > 50 || commentBody.length < 1 || commentBody.length > 1000) {
          res.writeHead(400);
          res.end(JSON.stringify({
            success: false,
            error: 'Escribe un nombre de hasta 50 caracteres y un comentario de hasta 1000 caracteres.',
          }));
          return;
        }
        const comment: DestinationComment = persistentStorageAvailable
          ? await insertStoredDestinationComment(destination.id, authorName, commentBody)
          : {
              id: crypto.randomUUID(),
              authorName,
              body: commentBody,
              createdAt: new Date().toISOString(),
            };
        if (!persistentStorageAvailable) store.comments.set(comment.id, { ...comment, destinationId: destination.id });
        res.writeHead(201);
        res.end(JSON.stringify({ success: true, data: comment }));
        return;
      }

      if (resource === 'ratings' && method === 'POST') {
        const body = await readBody(req);
        const score = Number(body?.score);
        const voterKey = typeof body?.voterKey === 'string' ? body.voterKey : '';
        if (!Number.isInteger(score) || score < 1 || score > 5 || !voterKeyPattern.test(voterKey)) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: 'Selecciona una valoración de 1 a 5 estrellas.' }));
          return;
        }
        const result = persistentStorageAvailable
          ? await upsertStoredDestinationRating(destination.id, voterKey, score)
          : (() => {
              store.ratings.set(`${destination.id}:${voterKey}`, {
                destinationId: destination.id,
                voterKey,
                score,
              });
              const engagement = getMemoryEngagement(destination.id);
              return { averageRating: engagement.averageRating, ratingCount: engagement.ratingCount };
            })();
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, data: result }));
        return;
      }

      res.writeHead(405);
      res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
      return;
    }

    if (path.startsWith('/content/destinations/') && method === 'GET') {
      const idOrSlug = path.replace('/content/destinations/', '');
      const persistentStorageAvailable = await persistentDestinationsReady;
      let dest = persistentStorageAvailable
        ? await getStoredDestination(idOrSlug)
        : store.destinations.get(idOrSlug) || Array.from(store.destinations.values()).find((d) => d.slug === idOrSlug);

      if (!dest) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Destination not found' }));
        return;
      }

      const requestedLocale = url.searchParams.get('lang') as DestinationLocale | null;
      if (requestedLocale && supportedDestinationLocales.includes(requestedLocale) && !dest.translations?.[requestedLocale]) {
        const translation = await createDestinationTranslation(dest, requestedLocale);
        dest = {
          ...dest,
          translations: { ...dest.translations, [requestedLocale]: translation },
        };
        if (persistentStorageAvailable) await saveStoredDestination(dest);
        store.destinations.set(dest.id, dest);
      }

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: dest }));
      return;
    }

    if (path === '/content/destinations' && method === 'POST') {
      const persistentStorageAvailable = await persistentDestinationsReady;
      if (!persistentStorageAvailable && process.env.NODE_ENV !== 'test') {
        res.writeHead(503);
        res.end(JSON.stringify({ success: false, error: 'PostgreSQL no está disponible; no se guardó el destino.' }));
        return;
      }
      const body = await readBody(req);
      const validation = validateDestination(body);
      if (!validation.success) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Validation error', errors: validation.errors }));
        return;
      }

      const d = validation.data;
      const id = crypto.randomUUID();
      const slug = d.slug ? slugify(d.slug) : slugify(d.name);

      const destination: Destination = {
        id,
        slug,
        name: d.name,
        type: d.type,
        parentId: d.parentId || null,
        country: d.country,
        description: d.description || '',
        heroImageId: d.heroImageId || null,
        heroImageUrl: d.heroImageUrl || null,
        bestTimeToVisit: d.bestTimeToVisit || null,
        currency: d.currency || 'EUR',
        language: d.language || null,
        averageDailyBudget: d.averageDailyBudget ?? null,
        latitude: d.latitude ?? null,
        longitude: d.longitude ?? null,
        guide: d.guide || null,
        status: d.status || 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (process.env.DEEPL_API_KEY) {
        const translations = await Promise.all(
          supportedDestinationLocales.map(async (locale) => [
            locale,
            await createDestinationTranslation(destination, locale),
          ] as const)
        );
        destination.translations = Object.fromEntries(translations);
      }

      if (persistentStorageAvailable) await saveStoredDestination(destination);
      store.destinations.set(id, destination);
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, data: destination }));
      return;
    }

    if (path.startsWith('/content/destinations/') && method === 'PUT') {
      const persistentStorageAvailable = await persistentDestinationsReady;
      if (!persistentStorageAvailable && process.env.NODE_ENV !== 'test') {
        res.writeHead(503);
        res.end(JSON.stringify({ success: false, error: 'PostgreSQL no está disponible; no se guardaron los cambios.' }));
        return;
      }
      const id = path.replace('/content/destinations/', '');
      const existing = persistentStorageAvailable
        ? await getStoredDestination(id)
        : store.destinations.get(id);
      if (!existing) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Destination not found' }));
        return;
      }

      const body = await readBody(req);
      const updated = {
        ...existing,
        ...body,
        slug: body.slug ? slugify(body.slug) : existing.slug,
        updatedAt: new Date().toISOString(),
      };

      if (persistentStorageAvailable) await saveStoredDestination(updated);
      store.destinations.set(id, updated);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: updated }));
      return;
    }

    if (path.startsWith('/content/destinations/') && method === 'DELETE') {
      const persistentStorageAvailable = await persistentDestinationsReady;
      if (!persistentStorageAvailable && process.env.NODE_ENV !== 'test') {
        res.writeHead(503);
        res.end(JSON.stringify({ success: false, error: 'PostgreSQL no está disponible; no se eliminó el destino.' }));
        return;
      }
      const id = path.replace('/content/destinations/', '');
      const deleted = persistentStorageAvailable
        ? await deleteStoredDestination(id)
        : store.destinations.delete(id);
      if (persistentStorageAvailable && deleted) store.destinations.delete(id);
      res.writeHead(deleted ? 200 : 404);
      res.end(JSON.stringify({ success: deleted, message: deleted ? 'Deleted' : 'Not found' }));
      return;
    }

    // =============================================================
    // PLACES (Lugares con geolocalización y Leaflet)
    // =============================================================
    if (path === '/content/places' && method === 'GET') {
      const destinationId = url.searchParams.get('destinationId');
      const category = url.searchParams.get('category');
      const status = url.searchParams.get('status');

      let items = Array.from(store.places.values());
      if (destinationId) items = items.filter((p) => p.destinationId === destinationId);
      if (category) items = items.filter((p) => p.category === category);
      if (status) items = items.filter((p) => p.status === status);

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: items, meta: { total: items.length } }));
      return;
    }

    if (path.startsWith('/content/places/') && method === 'GET') {
      const idOrSlug = path.replace('/content/places/', '');
      let place = store.places.get(idOrSlug);
      if (!place) {
        place = Array.from(store.places.values()).find((p) => p.slug === idOrSlug);
      }

      if (!place) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Place not found' }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: place }));
      return;
    }

    if (path === '/content/places' && method === 'POST') {
      const body = await readBody(req);
      const validation = validatePlace(body);
      if (!validation.success) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: 'Validation error', errors: validation.errors }));
        return;
      }

      const p = validation.data;
      const id = crypto.randomUUID();
      const slug = p.slug ? slugify(p.slug) : slugify(p.name);

      // Auto-generate map URLs if lat and lng provided
      const mapUrls =
        p.latitude && p.longitude
          ? generateMapUrls(p.latitude, p.longitude, p.zoom || 15)
          : { googleMapsUrl: null, appleMapsUrl: null, openStreetMapUrl: null };

      const place: Place = {
        id,
        slug,
        name: p.name,
        destinationId: p.destinationId,
        category: p.category,
        description: p.description || '',
        address: p.address || null,
        latitude: p.latitude || null,
        longitude: p.longitude || null,
        zoom: p.zoom || 15,
        googleMapsUrl: mapUrls.googleMapsUrl,
        appleMapsUrl: mapUrls.appleMapsUrl,
        openStreetMapUrl: mapUrls.openStreetMapUrl,
        priceLevel: p.priceLevel || null,
        openingHours: p.openingHours || null,
        images: Array.isArray(p.images) ? p.images : [],
        imageUrls: Array.isArray(p.imageUrls) ? p.imageUrls : [],
        tags: Array.isArray(p.tags) ? p.tags : [],
        affiliateId: p.affiliateId || null,
        affiliateUrl: p.affiliateUrl || null,
        status: p.status || 'draft',
        seoTitle: p.seoTitle || null,
        seoDescription: p.seoDescription || null,
        localScore: p.localScore || null,
        valueScore: p.valueScore || null,
        crowdLevel: p.crowdLevel || null,
        bestTime: p.bestTime || null,
        walkability: p.walkability !== undefined ? Boolean(p.walkability) : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.places.set(id, place);
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, data: place }));
      return;
    }

    if (path.startsWith('/content/places/') && method === 'PUT') {
      const id = path.replace('/content/places/', '');
      const existing = store.places.get(id);
      if (!existing) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Place not found' }));
        return;
      }

      const body = await readBody(req);
      const lat = body.latitude !== undefined ? Number(body.latitude) : existing.latitude;
      const lng = body.longitude !== undefined ? Number(body.longitude) : existing.longitude;
      const zoom = body.zoom !== undefined ? Number(body.zoom) : existing.zoom;

      const mapUrls =
        lat && lng
          ? generateMapUrls(lat, lng, zoom || 15)
          : {
              googleMapsUrl: existing.googleMapsUrl,
              appleMapsUrl: existing.appleMapsUrl,
              openStreetMapUrl: existing.openStreetMapUrl,
            };

      const updated: Place = {
        ...existing,
        ...body,
        latitude: lat,
        longitude: lng,
        zoom,
        googleMapsUrl: mapUrls.googleMapsUrl,
        appleMapsUrl: mapUrls.appleMapsUrl,
        openStreetMapUrl: mapUrls.openStreetMapUrl,
        slug: body.slug ? slugify(body.slug) : existing.slug,
        updatedAt: new Date().toISOString(),
      };

      store.places.set(id, updated);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: updated }));
      return;
    }

    if (path.startsWith('/content/places/') && method === 'DELETE') {
      const id = path.replace('/content/places/', '');
      const deleted = store.places.delete(id);
      res.writeHead(deleted ? 200 : 404);
      res.end(JSON.stringify({ success: deleted, message: deleted ? 'Deleted' : 'Not found' }));
      return;
    }

    // =============================================================
    // ITINERARIES
    // =============================================================
    if (path === '/content/itineraries' && method === 'GET') {
      const destinationId = url.searchParams.get('destinationId');
      let items = Array.from(store.itineraries.values());
      if (destinationId) items = items.filter((it) => it.destinationId === destinationId);

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: items, meta: { total: items.length } }));
      return;
    }

    if (path.startsWith('/content/itineraries/') && method === 'GET') {
      const idOrSlug = path.replace('/content/itineraries/', '');
      let it = store.itineraries.get(idOrSlug);
      if (!it) {
        it = Array.from(store.itineraries.values()).find((item) => item.slug === idOrSlug);
      }

      if (!it) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Itinerary not found' }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: it }));
      return;
    }

    if (path === '/content/itineraries' && method === 'POST') {
      const body = await readBody(req);
      const id = crypto.randomUUID();
      const slug = body.slug ? slugify(body.slug) : slugify(body.title || 'nuevo-itinerario');

      const itinerary: Itinerary = {
        id,
        slug,
        title: body.title || 'Itinerario LocalDepth',
        destinationId: body.destinationId,
        totalDays: Number(body.totalDays) || 1,
        totalBudget: body.totalBudget ? Number(body.totalBudget) : null,
        summary: body.summary || '',
        days: Array.isArray(body.days) ? body.days : [],
        guideId: body.guideId || null,
        status: body.status || 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.itineraries.set(id, itinerary);
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, data: itinerary }));
      return;
    }

    // Not found
    res.writeHead(404);
    res.end(JSON.stringify({ success: false, error: `Route ${method} ${path} not found` }));
  } catch (err: any) {
    logger.error('Error in content-service', { error: err.message });
    const translationFailure = err instanceof Error && /DEEPL_API_KEY|DeepL/i.test(err.message);
    res.writeHead(translationFailure ? 503 : 500);
    res.end(
      JSON.stringify({
        success: false,
        error: translationFailure ? err.message : 'Internal Server Error',
      })
    );
  }
}

const server = http.createServer(handleContentRequest);

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  server.listen(PORT, () => {
    logger.info(`Content service running on port ${PORT}`);
  });
}
