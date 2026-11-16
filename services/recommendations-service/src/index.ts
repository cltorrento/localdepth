import http from 'node:http';
import crypto from 'node:crypto';
import { createLogger } from '@localdepth/logger';
import { getDbPool, MemoryStore } from '@localdepth/database';
import { validatePersonalizedTripInput, validateTripPlannerInput } from '@localdepth/validation';
import { translateContent } from '@localdepth/shared-utils';
import type {
  Destination,
  TripPlannerPreferences,
  TripPlannerResponse,
  Itinerary,
  ItineraryDay,
  ItineraryStop,
} from '@localdepth/shared-types';

const logger = createLogger('recommendations-service');
const PORT = Number(process.env.RECOMMENDATIONS_SERVICE_PORT) || 4005;
const store = MemoryStore.getInstance();
const acceptedPrivacyNoticeVersion = '2026-10';
let tripLeadTableReady: Promise<void> | undefined;
type ValidatedPlanPreferences = TripPlannerPreferences &
  Required<Pick<TripPlannerPreferences, 'budgetPerDay' | 'currency' | 'avoidCrowds'>>;

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

function generateTripPlan(
  preferences: ValidatedPlanPreferences
): { response: TripPlannerResponse; destination: Destination } | null {
  const {
    destination: destinationQuery,
    totalDays,
    budgetPerDay,
    currency,
    interests,
    pace,
    avoidCrowds,
  } = preferences;
  const destination = Array.from(store.destinations.values()).find(
    (item) =>
      item.status === 'published' &&
      item.type === 'city' &&
      (item.name.toLowerCase() === destinationQuery.toLowerCase() ||
        item.slug.toLowerCase() === destinationQuery.toLowerCase())
  );
  if (!destination) return null;

  const editorialPlaces = Array.from(store.places.values())
    .filter((place) => place.destinationId === destination.id && place.status === 'published')
    .map((place) => ({
      placeId: place.id,
      name: place.name,
      category: place.category,
      estimatedMinutes: 90,
      timeOfDay: 'morning' as const,
      notes: `Local Score: ${place.localScore || '9.2'} · Mejor hora: ${place.bestTime || '11:00'}`,
      latitude: place.latitude || undefined,
      longitude: place.longitude || undefined,
    }));
  const guidePlaces = destination.guide?.placesToVisit || [];
  const placeStops: ItineraryStop[] = editorialPlaces.length > 0
    ? editorialPlaces
    : guidePlaces.map((place) => ({
        placeId: crypto.randomUUID(),
        name: place.name,
        category: 'attraction',
        estimatedMinutes: 90,
        timeOfDay: 'morning',
        notes: place.description,
        latitude: place.latitude ?? undefined,
        longitude: place.longitude ?? undefined,
      }));
  if (placeStops.length === 0) return null;

  const placesPerDay = pace === 'relaxed' ? 2 : pace === 'intense' ? 4 : 3;
  const days: ItineraryDay[] = Array.from({ length: totalDays }, (_, dayIndex) => {
    const dayNumber = dayIndex + 1;
    const stops = Array.from(
      { length: Math.min(placesPerDay, placeStops.length) },
      (_, stopIndex) => {
        const source = placeStops[(dayIndex * placesPerDay + stopIndex) % placeStops.length];
        return {
          ...source,
          timeOfDay: (['morning', 'lunch', 'afternoon', 'evening'] as const)[stopIndex],
        };
      }
    );

    return {
      dayNumber,
      title: `Día ${dayNumber}: ${dayNumber === 1 ? 'Llegada y Sabores Locales' : dayNumber === 2 ? 'Barrios y Joyas Ocultas' : 'Cultura y Paseos Relajados'}`,
      summary: `Plan adaptado a ritmo ${pace} con enfoque en ${interests.join(', ')}.`,
      theme: interests[dayIndex % interests.length],
      stops,
      estimatedCost: budgetPerDay,
      weatherAlternatives: 'En caso de lluvia: visitar galerías cubiertas, cafeterías de diseño y mercados cerrados.',
      crowdTips: avoidCrowds
        ? 'Visitar las paradas matutinas antes de las 10:30 y reservar restaurantes con 24h de antelación.'
        : 'Horario estándar recomendado.',
    };
  });

  const totalBudget = totalDays * budgetPerDay;
  const itinerary: Itinerary = {
    id: crypto.randomUUID(),
    slug: `itinerario-${destination.slug}-${totalDays}-dias-${Date.now()}`,
    title: `${totalDays} Días en ${destination.name}: Experiencia Local Personalizada`,
    destinationId: destination.id,
    totalDays,
    totalBudget,
    summary: `Itinerario curado por LocalDepth Copilot según presupuesto de ${budgetPerDay} ${currency}/día.`,
    days,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    destination,
    response: {
      itinerary,
      destination: {
        id: destination.id,
        name: destination.name,
        slug: destination.slug,
        country: destination.country,
        currency: destination.currency,
      },
      estimatedBudget: { perDay: budgetPerDay, total: totalBudget, currency },
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
    },
  };
}

async function ensureTripLeadTable(pool: NonNullable<Awaited<ReturnType<typeof getDbPool>>>): Promise<void> {
  if (!tripLeadTableReady) {
    tripLeadTableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS trip_leads (
        id UUID PRIMARY KEY,
        email VARCHAR(254) NOT NULL,
        destination_slug VARCHAR(255) NOT NULL,
        travel_date DATE,
        total_days SMALLINT NOT NULL,
        budget_per_day NUMERIC(12, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        interests JSONB NOT NULL,
        pace VARCHAR(16) NOT NULL,
        avoid_crowds BOOLEAN NOT NULL DEFAULT FALSE,
        locale VARCHAR(2) NOT NULL,
        itinerary JSONB NOT NULL,
        itinerary_consent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        privacy_notice_version VARCHAR(20) NOT NULL,
        newsletter_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
        newsletter_consent_at TIMESTAMPTZ,
        email_status VARCHAR(16) NOT NULL DEFAULT 'pending'
          CHECK (email_status IN ('pending', 'sent', 'failed')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '12 months')
      )
    `)
      .then(() => pool.query('CREATE INDEX IF NOT EXISTS idx_trip_leads_expires_at ON trip_leads (expires_at)'))
      .then(() => undefined)
      .catch((error: unknown) => {
        tripLeadTableReady = undefined;
        throw error;
      });
  }
  await tripLeadTableReady;
}

async function removeExpiredTripLeads(): Promise<void> {
  const pool = await getDbPool();
  if (!pool) return;
  await ensureTripLeadTable(pool);
  await pool.query('DELETE FROM trip_leads WHERE expires_at <= CURRENT_TIMESTAMP');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

const emailCopy = {
  es: { subject: 'Tu itinerario personalizado de LocalDepth', greeting: 'Tu viaje a', budget: 'Presupuesto estimado', day: 'Día', stops: 'paradas' },
  en: { subject: 'Your personalized LocalDepth itinerary', greeting: 'Your trip to', budget: 'Estimated budget', day: 'Day', stops: 'stops' },
  it: { subject: 'Il tuo itinerario personalizzato LocalDepth', greeting: 'Il tuo viaggio a', budget: 'Budget stimato', day: 'Giorno', stops: 'tappe' },
  de: { subject: 'Dein persönlicher LocalDepth-Reiseplan', greeting: 'Deine Reise nach', budget: 'Geschätztes Budget', day: 'Tag', stops: 'Stopps' },
};

const emailTimeLabels = {
  es: { morning: 'mañana', lunch: 'comida', afternoon: 'tarde', evening: 'noche' },
  en: { morning: 'morning', lunch: 'lunch', afternoon: 'afternoon', evening: 'evening' },
  it: { morning: 'mattina', lunch: 'pranzo', afternoon: 'pomeriggio', evening: 'sera' },
  de: { morning: 'Morgen', lunch: 'Mittagessen', afternoon: 'Nachmittag', evening: 'Abend' },
};

function createItineraryEmail(response: TripPlannerResponse, locale: keyof typeof emailCopy): string {
  const labels = emailCopy[locale];
  const daySections = response.itinerary.days.map((day) => `
    <section style="margin:24px 0;padding:20px;border:1px solid #e3e3dc;border-radius:8px">
      <h2 style="margin:0 0 8px;font-size:20px">${escapeHtml(day.title)}</h2>
      <p style="color:#60635a">${escapeHtml(labels.day)} ${day.dayNumber} · ${day.stops.length} ${escapeHtml(labels.stops)}</p>
      <p style="color:#60635a">${escapeHtml(day.summary)}</p>
      <ol>${day.stops.map((stop) => `
        <li style="margin:12px 0">
          <strong>${escapeHtml(stop.name)}</strong>
          <span> · ${escapeHtml(emailTimeLabels[locale][stop.timeOfDay])}</span>
          ${stop.notes ? `<p style="margin:4px 0;color:#60635a">${escapeHtml(stop.notes)}</p>` : ''}
        </li>`).join('')}
      </ol>
      ${day.crowdTips ? `<p style="font-size:13px"><strong>${escapeHtml(day.crowdTips)}</strong></p>` : ''}
    </section>`).join('');

  return `<!doctype html><html><body style="margin:0;padding:32px;background:#f5f3ec;color:#20231f;font-family:Arial,sans-serif">
    <main style="max-width:680px;margin:auto;padding:32px;background:#fffefa;border-radius:12px">
      <p style="color:#244f3d;font-weight:bold">LOCALDEPTH</p>
      <h1 style="font-size:30px">${escapeHtml(labels.greeting)} ${escapeHtml(response.destination.name)}</h1>
      <p>${escapeHtml(response.itinerary.summary)}</p>
      <p><strong>${escapeHtml(labels.budget)}:</strong> ${response.estimatedBudget.total.toLocaleString(locale)} ${escapeHtml(response.estimatedBudget.currency)}</p>
      ${daySections}
      <p style="color:#686b62;font-size:12px">LocalDepth · ${escapeHtml(response.destination.country || '')}</p>
    </main>
  </body></html>`;
}

async function sendItineraryEmail(
  email: string,
  response: TripPlannerResponse,
  locale: keyof typeof emailCopy
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error('Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.');
  }

  const result = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: emailCopy[locale].subject,
      html: createItineraryEmail(response, locale),
    }),
  });
  if (!result.ok) {
    throw new Error(`Resend rejected the itinerary email (HTTP ${result.status}).`);
  }
}

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

    const generated = generateTripPlan(validation.data);
    if (!generated) {
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, error: 'Ese destino no tiene una guía publicada con lugares para planificar.' }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: generated.response }));
    return;
  }

  if (path === '/recommendations/plan-and-send' && method === 'POST') {
    const validation = validatePersonalizedTripInput(await readBody(req));
    if (!validation.success || !validation.data) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: 'Revisa la información del viaje y el consentimiento requerido.', errors: validation.errors }));
      return;
    }

    const preferences = validation.data;
    const generated = generateTripPlan(preferences);
    if (!generated) {
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, error: 'Ese destino no tiene una guía publicada con lugares para planificar.' }));
      return;
    }

    let response = generated.response;
    try {
      if (preferences.locale !== 'es') {
        response = await translateContent(response, preferences.locale);
      }
    } catch (error) {
      logger.error('Could not translate a personalized itinerary', {
        locale: preferences.locale,
        error: error instanceof Error ? error.message : String(error),
      });
      res.writeHead(503);
      res.end(JSON.stringify({ success: false, error: 'No se pudo traducir el itinerario. Inténtalo de nuevo.' }));
      return;
    }

    let pool;
    try {
      pool = await getDbPool();
      if (!pool) throw new Error('PostgreSQL is unavailable.');
      await ensureTripLeadTable(pool);
      await pool.query('DELETE FROM trip_leads WHERE expires_at <= CURRENT_TIMESTAMP');
    } catch (error) {
      logger.error('Could not prepare persistent trip request storage', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.writeHead(503);
      res.end(JSON.stringify({ success: false, error: 'No se pudo guardar la solicitud. Comprueba que PostgreSQL esté disponible e inténtalo de nuevo.' }));
      return;
    }

    const leadId = crypto.randomUUID();
    const newsletterConsentAt = preferences.newsletterOptIn ? new Date().toISOString() : null;
    try {
      await pool.query(
        `INSERT INTO trip_leads (
          id, email, destination_slug, travel_date, total_days, budget_per_day, currency,
          interests, pace, avoid_crowds, locale, itinerary, itinerary_consent_at,
          privacy_notice_version, newsletter_opt_in, newsletter_consent_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12::jsonb,
          CURRENT_TIMESTAMP, $13, $14, $15
        )`,
        [
          leadId,
          preferences.email,
          generated.destination.slug,
          preferences.travelDate,
          preferences.totalDays,
          preferences.budgetPerDay,
          preferences.currency,
          JSON.stringify(preferences.interests),
          preferences.pace,
          Boolean(preferences.avoidCrowds),
          preferences.locale,
          JSON.stringify(response),
          acceptedPrivacyNoticeVersion,
          preferences.newsletterOptIn,
          newsletterConsentAt,
        ]
      );
    } catch (error) {
      logger.error('Could not persist a personalized trip request', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.writeHead(503);
      res.end(JSON.stringify({ success: false, error: 'No se pudo guardar la solicitud. Inténtalo de nuevo más tarde.' }));
      return;
    }

    try {
      await sendItineraryEmail(preferences.email, response, preferences.locale);
    } catch (error) {
      logger.error('Could not send a personalized itinerary email', {
        leadId,
        error: error instanceof Error ? error.message : String(error),
      });
      try {
        await pool.query('UPDATE trip_leads SET email_status = $1 WHERE id = $2', ['failed', leadId]);
      } catch (statusError) {
        logger.error('Could not persist failed itinerary email status', {
          leadId,
          error: statusError instanceof Error ? statusError.message : String(statusError),
        });
      }
      res.writeHead(502);
      res.end(JSON.stringify({
        success: false,
        error: 'Guardamos tu solicitud, pero no pudimos enviar el correo. Comprueba la configuración del email o inténtalo más tarde.',
        data: { leadId, itinerary: response },
      }));
      return;
    }

    try {
      await pool.query('UPDATE trip_leads SET email_status = $1 WHERE id = $2', ['sent', leadId]);
    } catch (error) {
      logger.error('Itinerary email was sent, but its delivery status could not be persisted', {
        leadId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.writeHead(503);
      res.end(JSON.stringify({
        success: false,
        error: 'El correo fue enviado, pero no pudimos actualizar el estado de la solicitud.',
        data: { leadId, itinerary: response, emailSent: true },
      }));
      return;
    }

    res.writeHead(201);
    res.end(JSON.stringify({
      success: true,
      data: { leadId, itinerary: response, emailSent: true, newsletterOptIn: preferences.newsletterOptIn },
    }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ success: false, error: `Route ${method} ${path} not found` }));
}

const server = http.createServer(handleRecommendationsRequest);

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  server.listen(PORT, () => {
    logger.info(`Recommendations service (Copilot) running on port ${PORT}`);
  });
  const leadCleanupTimer = setInterval(() => {
    removeExpiredTripLeads().catch((error: unknown) => {
      logger.error('Could not remove expired trip requests', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, 24 * 60 * 60 * 1000);
  leadCleanupTimer.unref();
}
