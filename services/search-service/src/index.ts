import http from 'node:http';
import { createLogger } from '@localdepth/logger';
import { MemoryStore } from '@localdepth/database';

const logger = createLogger('search-service');
const PORT = Number(process.env.SEARCH_SERVICE_PORT) || 4004;
const store = MemoryStore.getInstance();

export function handleSearchRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const method = req.method || 'GET';
  const path = url.pathname;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (path === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', service: 'search-service', timestamp: new Date().toISOString() }));
    return;
  }

  if (path === '/search' && method === 'GET') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const type = url.searchParams.get('type'); // 'place' | 'destination' | 'itinerary' | null

    const results: any[] = [];

    // Search Destinations
    if (!type || type === 'destination') {
      for (const d of store.destinations.values()) {
        if (!q || d.name.toLowerCase().includes(q) || d.country.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q)) {
          results.push({
            type: 'destination',
            id: d.id,
            slug: d.slug,
            title: d.name,
            subtitle: d.country,
            url: `/destinations/${d.slug}`,
            data: d,
          });
        }
      }
    }

    // Search Places
    if (!type || type === 'place') {
      for (const p of store.places.values()) {
        const descText = typeof p.description === 'string' ? p.description : '';
        const tags = Array.isArray(p.tags) ? p.tags.join(' ') : '';
        if (
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          descText.toLowerCase().includes(q) ||
          tags.toLowerCase().includes(q)
        ) {
          results.push({
            type: 'place',
            id: p.id,
            slug: p.slug,
            title: p.name,
            subtitle: `${p.category} · Score local: ${p.localScore || '9.0'}`,
            url: `/places/${p.slug}`,
            data: p,
          });
        }
      }
    }

    // Search Itineraries
    if (!type || type === 'itinerary') {
      for (const it of store.itineraries.values()) {
        if (!q || it.title.toLowerCase().includes(q) || it.summary?.toLowerCase().includes(q)) {
          results.push({
            type: 'itinerary',
            id: it.id,
            slug: it.slug,
            title: it.title,
            subtitle: `${it.totalDays} días · Presupuesto: ${it.totalBudget || 100}€`,
            url: `/itineraries/${it.slug}`,
            data: it,
          });
        }
      }
    }

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: results, meta: { total: results.length, query: q } }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ success: false, error: `Route ${method} ${path} not found` }));
}

const server = http.createServer(handleSearchRequest);

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info(`Search service running on port ${PORT}`);
  });
}
