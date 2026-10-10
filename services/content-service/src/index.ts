import http from 'node:http';
import crypto from 'node:crypto';
import { createLogger } from '@localdepth/logger';
import { MemoryStore } from '@localdepth/database';
import { generateMapUrls, slugify } from '@localdepth/shared-utils';
import { validateDestination, validatePlace } from '@localdepth/validation';
import type { Destination, Place, Guide, Itinerary } from '@localdepth/shared-types';

const logger = createLogger('content-service');
const PORT = Number(process.env.CONTENT_SERVICE_PORT) || 4002;
const store = MemoryStore.getInstance();

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

      let items = Array.from(store.destinations.values());
      if (type) items = items.filter((d) => d.type === type);
      if (status) items = items.filter((d) => d.status === status);
      if (queryText) {
        items = items.filter(
          (d) => d.name.toLowerCase().includes(queryText) || d.country.toLowerCase().includes(queryText)
        );
      }

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: items, meta: { total: items.length } }));
      return;
    }

    if (path.startsWith('/content/destinations/') && method === 'GET') {
      const idOrSlug = path.replace('/content/destinations/', '');
      let dest = store.destinations.get(idOrSlug);
      if (!dest) {
        dest = Array.from(store.destinations.values()).find((d) => d.slug === idOrSlug);
      }

      if (!dest) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Destination not found' }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: dest }));
      return;
    }

    if (path === '/content/destinations' && method === 'POST') {
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
        averageDailyBudget: d.averageDailyBudget || null,
        latitude: d.latitude || null,
        longitude: d.longitude || null,
        status: d.status || 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.destinations.set(id, destination);
      res.writeHead(201);
      res.end(JSON.stringify({ success: true, data: destination }));
      return;
    }

    if (path.startsWith('/content/destinations/') && method === 'PUT') {
      const id = path.replace('/content/destinations/', '');
      const existing = store.destinations.get(id);
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

      store.destinations.set(id, updated);
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, data: updated }));
      return;
    }

    if (path.startsWith('/content/destinations/') && method === 'DELETE') {
      const id = path.replace('/content/destinations/', '');
      const deleted = store.destinations.delete(id);
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
    res.writeHead(500);
    res.end(JSON.stringify({ success: false, error: 'Internal Server Error' }));
  }
}

const server = http.createServer(handleContentRequest);

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info(`Content service running on port ${PORT}`);
  });
}
