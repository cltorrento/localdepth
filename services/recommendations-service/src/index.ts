import http from 'node:http';
import crypto from 'node:crypto';
import { createLogger } from '@localdepth/logger';
import { MemoryStore } from '@localdepth/database';
import { validateTripPlannerInput } from '@localdepth/validation';
import type { TripPlannerResponse, Itinerary, ItineraryDay, ItineraryStop } from '@localdepth/shared-types';

const logger = createLogger('recommendations-service');
const PORT = Number(process.env.RECOMMENDATIONS_SERVICE_PORT) || 4005;
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

export async function handleRecommendationsRequest(req: http.IncomingMessage, res: http.ServerResponse) {
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
    res.end(JSON.stringify({ status: 'ok', service: 'recommendations-service', timestamp: new Date().toISOString() }));
    return;
  }

  // POST /recommendations/plan (The Travel Copilot Engine)
  if (path === '/recommendations/plan' && method === 'POST') {
    const body = await readBody(req);
    const validation = validateTripPlannerInput(body);
    if (!validation.success) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: 'Parámetros inválidos', errors: validation.errors }));
      return;
    }

    const { destination: destQuery, totalDays, budgetPerDay, currency, interests, pace, avoidCrowds } = validation.data!;

    // Find destination in editorial DB
    let targetDest = Array.from(store.destinations.values()).find(
      (d) =>
        d.name.toLowerCase() === destQuery.toLowerCase() ||
        d.slug.toLowerCase() === destQuery.toLowerCase()
    );

    // Default to first destination if not exact match (fallback to Milan)
    if (!targetDest) {
      targetDest = Array.from(store.destinations.values())[0];
    }

    // Retrieve places for this destination
    const destinationPlaces = Array.from(store.places.values()).filter(
      (p) => p.destinationId === targetDest!.id
    );

    // Build itinerary days deterministically from validated editorial places
    const days: ItineraryDay[] = [];
    const placesPerDay = pace === 'relaxed' ? 2 : pace === 'intense' ? 4 : 3;

    for (let dayIdx = 0; dayIdx < totalDays; dayIdx++) {
      const dayNum = dayIdx + 1;
      const dayPlaces = destinationPlaces.slice(
        (dayIdx * placesPerDay) % Math.max(destinationPlaces.length, 1),
        ((dayIdx + 1) * placesPerDay) % Math.max(destinationPlaces.length, 1) + 1
      );

      const stops: ItineraryStop[] = (dayPlaces.length > 0 ? dayPlaces : destinationPlaces).map((p, idx) => ({
        placeId: p.id,
        name: p.name,
        category: p.category,
        timeOfDay: idx === 0 ? 'morning' : idx === 1 ? 'lunch' : 'afternoon',
        estimatedMinutes: 90,
        notes: `Local Score: ${p.localScore || '9.2'} · Mejor hora: ${p.bestTime || '11:00'}`,
        latitude: p.latitude || undefined,
        longitude: p.longitude || undefined,
      }));

      days.push({
        dayNumber: dayNum,
        title: `Día ${dayNum}: ${dayNum === 1 ? 'Llegada y Sabores Locales' : dayNum === 2 ? 'Barrios y Joyas Ocultas' : 'Cultura y Paseos Relajados'}`,
        summary: `Plan adaptado a ritmo ${pace} con enfoque en ${interests.join(', ')}.`,
        theme: interests[dayIdx % interests.length] || 'Gastronomía Local',
        stops,
        estimatedCost: budgetPerDay,
        weatherAlternatives: 'En caso de lluvia: visitar galerías cubiertas, cafeterías de diseño y mercados cerrados.',
        crowdTips: avoidCrowds
          ? 'Visitar las paradas matutinas antes de las 10:30 y reservar restaurantes con 24h de antelación.'
          : 'Horario estándar recomendado.',
      });
    }

    const totalBudget = totalDays * budgetPerDay;

    const generatedItinerary: Itinerary = {
      id: crypto.randomUUID(),
      slug: `itinerario-${targetDest.slug}-${totalDays}-dias-${Date.now()}`,
      title: `${totalDays} Días en ${targetDest.name}: Experiencia Local Personalizada`,
      destinationId: targetDest.id,
      totalDays,
      totalBudget,
      summary: `Itinerario curado por LocalDepth Copilot según presupuesto de ${budgetPerDay}€/día y preferencia por evitar aglomeraciones.`,
      days,
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const response: TripPlannerResponse = {
      itinerary: generatedItinerary,
      destination: {
        id: targetDest.id,
        name: targetDest.name,
        slug: targetDest.slug,
        country: targetDest.country,
        currency: targetDest.currency,
      },
      estimatedBudget: {
        perDay: budgetPerDay,
        total: totalBudget,
        currency,
      },
      highlights: [
        '100% basado en lugares verificados por editores locales',
        'Ruta geolocalizada con mapa Leaflet interactivo',
        'Consejos específicos para evitar colas y trampas para turistas',
      ],
      rainAlternatives: [
        'Mercados gastronómicos cubiertos',
        'Cafés históricos con encanto',
        'Talleres artesanales y librerías de diseño',
      ],
      crowdAvoidanceTips: [
        'Desayuna a las 08:30 y almuerza a las 13:00 en trattorias de barrio',
        'Opta por pasear durante el horario del aperitivo en zonas residenciales',
      ],
      relatedGuides: [],
    };

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: response }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ success: false, error: `Route ${method} ${path} not found` }));
}

const server = http.createServer(handleRecommendationsRequest);

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info(`Recommendations service (Copilot) running on port ${PORT}`);
  });
}
