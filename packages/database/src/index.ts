import crypto from 'node:crypto';
import { createLogger } from '@localdepth/logger';
import { getPostImage, posts } from './sample-destinations.ts';
import type { Destination } from '@localdepth/shared-types';

const logger = createLogger('database');

export interface DatabaseConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

let pool: any = null;

export async function getDbPool(config?: DatabaseConfig): Promise<any> {
  if (pool) return pool;

  try {
    // Supabase (PostgreSQL): la conexión se define solo con DATABASE_URL.
    // Sin ella se trabaja con el almacenamiento en memoria.
    const connectionString = config?.connectionString || process.env.DATABASE_URL;
    if (!connectionString) {
      logger.warn('DATABASE_URL no definida; se usa el almacenamiento en memoria');
      return null;
    }

    const { Pool } = await import('pg');
    const isLocalDb = /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
    const serverless = Boolean(process.env.VERCEL);

    pool = new Pool({
      connectionString,
      // Supabase exige TLS; el pooler (puerto 6543) no usa certificado verificable por defecto.
      ssl: isLocalDb ? undefined : { rejectUnauthorized: false },
      // En serverless cada instancia abre pocas conexiones; el pooler de Supabase multiplexa.
      max: serverless ? 3 : 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err: any) => {
      logger.error('Unexpected error on idle PostgreSQL client', { error: err.message });
    });

    return pool;
  } catch (err: any) {
    logger.warn('PostgreSQL client (pg) not available, operating in memory-store mode', { error: err.message });
    return null;
  }
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const p = await getDbPool();
  if (!p) {
    logger.warn('Postgres query skipped, pg driver not loaded');
    return [];
  }
  try {
    const res = await p.query(text, params);
    return res.rows;
  } catch (err: any) {
    logger.error('Database query execution error', { query: text, error: err.message });
    throw err;
  }
}

interface DestinationRow {
  id: string;
  slug: string;
  name: string;
  type: Destination['type'];
  parent_id: string | null;
  country: string;
  description: string;
  hero_image_id: string | null;
  hero_image_url: string | null;
  best_time_to_visit: string | null;
  currency: string | null;
  language: string | null;
  average_daily_budget: string | number | null;
  latitude: string | number | null;
  longitude: string | number | null;
  guide: Destination['guide'];
  translations: Destination['translations'];
  status: Destination['status'];
  created_at: Date | string;
  updated_at: Date | string;
}

function toDestination(row: DestinationRow): Destination {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    parentId: row.parent_id,
    country: row.country,
    description: row.description,
    heroImageId: row.hero_image_id,
    heroImageUrl: row.hero_image_url,
    bestTimeToVisit: row.best_time_to_visit,
    currency: row.currency,
    language: row.language,
    averageDailyBudget: row.average_daily_budget === null ? null : Number(row.average_daily_budget),
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    guide: row.guide,
    translations: row.translations || {},
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function ensureDestinationSchema(pool: NonNullable<Awaited<ReturnType<typeof getDbPool>>>) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS destinations (
      id UUID PRIMARY KEY,
      slug VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      parent_id UUID REFERENCES destinations(id) ON DELETE SET NULL,
      country VARCHAR(255) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      hero_image_id UUID,
      hero_image_url TEXT,
      best_time_to_visit VARCHAR(255),
      currency VARCHAR(10) DEFAULT 'EUR',
      language VARCHAR(50),
      average_daily_budget NUMERIC(10, 2),
      latitude NUMERIC(10, 6),
      longitude NUMERIC(10, 6),
      guide JSONB,
      translations JSONB NOT NULL DEFAULT '{}'::jsonb,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query('ALTER TABLE destinations ADD COLUMN IF NOT EXISTS guide JSONB');
  await pool.query("ALTER TABLE destinations ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb");
  await pool.query('CREATE INDEX IF NOT EXISTS idx_destinations_slug ON destinations (slug)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_destinations_status ON destinations (status)');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS destination_comments (
      id UUID PRIMARY KEY,
      destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
      author_name VARCHAR(50) NOT NULL,
      body VARCHAR(1000) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS destination_ratings (
      destination_id UUID NOT NULL REFERENCES destinations(id) ON DELETE CASCADE,
      voter_key UUID NOT NULL,
      score SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (destination_id, voter_key)
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_destination_comments_recent ON destination_comments (destination_id, created_at DESC)');
}

async function writeDestination(pool: NonNullable<Awaited<ReturnType<typeof getDbPool>>>, destination: Destination) {
  await pool.query(
    `INSERT INTO destinations (
      id, slug, name, type, parent_id, country, description, hero_image_id, hero_image_url,
      best_time_to_visit, currency, language, average_daily_budget, latitude, longitude,
      guide, translations, status, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
      $16::jsonb, $17::jsonb, $18, $19, $20
    )
    ON CONFLICT (id) DO UPDATE SET
      slug = EXCLUDED.slug,
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      parent_id = EXCLUDED.parent_id,
      country = EXCLUDED.country,
      description = EXCLUDED.description,
      hero_image_id = EXCLUDED.hero_image_id,
      hero_image_url = EXCLUDED.hero_image_url,
      best_time_to_visit = EXCLUDED.best_time_to_visit,
      currency = EXCLUDED.currency,
      language = EXCLUDED.language,
      average_daily_budget = EXCLUDED.average_daily_budget,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      guide = EXCLUDED.guide,
      translations = EXCLUDED.translations,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at`,
    [
      destination.id,
      destination.slug,
      destination.name,
      destination.type,
      destination.parentId || null,
      destination.country,
      destination.description,
      destination.heroImageId || null,
      destination.heroImageUrl || null,
      destination.bestTimeToVisit || null,
      destination.currency || 'EUR',
      destination.language || null,
      destination.averageDailyBudget ?? null,
      destination.latitude ?? null,
      destination.longitude ?? null,
      JSON.stringify(destination.guide ?? null),
      JSON.stringify(destination.translations || {}),
      destination.status,
      destination.createdAt,
      destination.updatedAt,
    ],
  );
}

const destinationSelect = `
  SELECT id, slug, name, type, parent_id, country, description, hero_image_id, hero_image_url,
    best_time_to_visit, currency, language, average_daily_budget, latitude, longitude,
    guide, translations, status, created_at, updated_at
  FROM destinations`;

export async function initializeDestinationStorage(seeds: Destination[]): Promise<Destination[] | null> {
  const pool = await getDbPool();
  if (!pool) return null;
  await ensureDestinationSchema(pool);

  for (const destination of seeds) {
    await pool.query(
      `INSERT INTO destinations (
        id, slug, name, type, parent_id, country, description, hero_image_id, hero_image_url,
        best_time_to_visit, currency, language, average_daily_budget, latitude, longitude,
        guide, translations, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16::jsonb, $17::jsonb, $18, $19, $20
      ) ON CONFLICT (slug) DO NOTHING`,
      [
        destination.id,
        destination.slug,
        destination.name,
        destination.type,
        destination.parentId || null,
        destination.country,
        destination.description,
        destination.heroImageId || null,
        destination.heroImageUrl || null,
        destination.bestTimeToVisit || null,
        destination.currency || 'EUR',
        destination.language || null,
        destination.averageDailyBudget ?? null,
        destination.latitude ?? null,
        destination.longitude ?? null,
        JSON.stringify(destination.guide ?? null),
        JSON.stringify(destination.translations || {}),
        destination.status,
        destination.createdAt,
        destination.updatedAt,
      ],
    );
  }

  const result = await pool.query(destinationSelect);
  return (result.rows as DestinationRow[]).map(toDestination);
}

export async function getStoredDestination(idOrSlug: string): Promise<Destination | null> {
  const pool = await getDbPool();
  if (!pool) return null;
  const result = await pool.query(`${destinationSelect} WHERE id::text = $1 OR slug = $1 LIMIT 1`, [idOrSlug]);
  return result.rows[0] ? toDestination(result.rows[0] as DestinationRow) : null;
}

export async function getStoredDestinations(): Promise<Destination[]> {
  const pool = await getDbPool();
  if (!pool) throw new Error('PostgreSQL is unavailable.');
  const result = await pool.query(destinationSelect);
  return (result.rows as DestinationRow[]).map(toDestination);
}

export async function saveStoredDestination(destination: Destination): Promise<void> {
  const pool = await getDbPool();
  if (!pool) throw new Error('PostgreSQL is unavailable; destination changes were not saved.');
  await writeDestination(pool, destination);
}

export async function deleteStoredDestination(id: string): Promise<boolean> {
  const pool = await getDbPool();
  if (!pool) throw new Error('PostgreSQL is unavailable; destination changes were not saved.');
  const result = await pool.query('DELETE FROM destinations WHERE id = $1 RETURNING id', [id]);
  return result.rowCount > 0;
}

export interface DestinationComment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface DestinationEngagement {
  averageRating: number;
  ratingCount: number;
  commentCount: number;
  comments: DestinationComment[];
}

export interface TopRatedDestination {
  slug: string;
  name: string;
  country: string;
  heroImageUrl: string | null;
  averageRating: number;
  ratingCount: number;
}

export async function getStoredDestinationEngagement(destinationId: string): Promise<DestinationEngagement> {
  const p = await getDbPool();
  if (!p) throw new Error('PostgreSQL is unavailable.');
  const [summary, comments] = await Promise.all([
    p.query(
      `SELECT COALESCE(AVG(score), 0)::numeric(3, 2) AS average_rating,
        COUNT(*)::int AS rating_count
       FROM destination_ratings WHERE destination_id = $1`,
      [destinationId],
    ),
    p.query(
      `SELECT id, author_name, body, created_at
       FROM destination_comments WHERE destination_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [destinationId],
    ),
  ]);
  const counts = await p.query(
    'SELECT COUNT(*)::int AS comment_count FROM destination_comments WHERE destination_id = $1',
    [destinationId],
  );
  return {
    averageRating: Number(summary.rows[0]?.average_rating || 0),
    ratingCount: Number(summary.rows[0]?.rating_count || 0),
    commentCount: Number(counts.rows[0]?.comment_count || 0),
    comments: comments.rows.map((row: any) => ({
      id: row.id,
      authorName: row.author_name,
      body: row.body,
      createdAt: new Date(row.created_at).toISOString(),
    })),
  };
}

export async function getStoredTopRatedDestinations(limit = 5): Promise<TopRatedDestination[]> {
  const p = await getDbPool();
  if (!p) throw new Error('PostgreSQL is unavailable.');
  const result = await p.query(
    `SELECT d.slug, d.name, d.country, d.hero_image_url,
      COALESCE(AVG(r.score), 0)::numeric(3, 2) AS average_rating,
      COUNT(r.score)::int AS rating_count
     FROM destinations d
     LEFT JOIN destination_ratings r ON r.destination_id = d.id
     WHERE d.status = 'published'
     GROUP BY d.id
     ORDER BY average_rating DESC, rating_count DESC, d.name ASC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map((row: any) => ({
    slug: row.slug,
    name: row.name,
    country: row.country,
    heroImageUrl: row.hero_image_url,
    averageRating: Number(row.average_rating || 0),
    ratingCount: Number(row.rating_count || 0),
  }));
}

export async function insertStoredDestinationComment(
  destinationId: string,
  authorName: string,
  body: string,
): Promise<DestinationComment> {
  const p = await getDbPool();
  if (!p) throw new Error('PostgreSQL is unavailable.');
  const result = await p.query(
    `INSERT INTO destination_comments (id, destination_id, author_name, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, author_name, body, created_at`,
    [crypto.randomUUID(), destinationId, authorName, body],
  );
  const row = result.rows[0];
  return {
    id: row.id,
    authorName: row.author_name,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function upsertStoredDestinationRating(
  destinationId: string,
  voterKey: string,
  score: number,
): Promise<Pick<DestinationEngagement, 'averageRating' | 'ratingCount'>> {
  const p = await getDbPool();
  if (!p) throw new Error('PostgreSQL is unavailable.');
  await p.query(
    `INSERT INTO destination_ratings (destination_id, voter_key, score)
     VALUES ($1, $2, $3)
     ON CONFLICT (destination_id, voter_key)
     DO UPDATE SET score = EXCLUDED.score, updated_at = CURRENT_TIMESTAMP`,
    [destinationId, voterKey, score],
  );
  const result = await p.query(
    `SELECT COALESCE(AVG(score), 0)::numeric(3, 2) AS average_rating,
      COUNT(*)::int AS rating_count
     FROM destination_ratings WHERE destination_id = $1`,
    [destinationId],
  );
  return {
    averageRating: Number(result.rows[0]?.average_rating || 0),
    ratingCount: Number(result.rows[0]?.rating_count || 0),
  };
}

// -------------------------------------------------------------
// In-Memory Fallback & Fast Prototyping Store
// Ensures all services operate reliably in any environment
// -------------------------------------------------------------
export class MemoryStore {
  private static instance: MemoryStore;
  public users: Map<string, any> = new Map();
  public destinations: Map<string, any> = new Map();
  public comments: Map<string, any> = new Map();
  public ratings: Map<string, any> = new Map();
  public places: Map<string, any> = new Map();
  public guides: Map<string, any> = new Map();
  public itineraries: Map<string, any> = new Map();
  public media: Map<string, any> = new Map();

  private constructor() {
    this.seedDefaults();
  }

  public static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }

  private seedDefaults() {
    // 1. Initial Admin User
    const adminUser = {
      id: '11111111-1111-4111-a111-111111111111',
      email: 'admin@localdepth.com',
      passwordHash: '$2b$10$epAumYlT7f9V86X4G27nxeN4r8aG83/g5yH7a45tO7oF2W1Kk.8Q2', // admin123456
      name: 'LocalDepth Admin',
      role: 'admin',
      isActive: true,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(adminUser.id, adminUser);

    // 2. Default Destination: Milán
    const milan = {
      id: '22222222-2222-4222-a222-222222222222',
      slug: 'milan',
      name: 'Milán',
      type: 'city',
      country: 'Italia',
      description: 'Capital de la moda y diseño, con una vibrante escena de gastronomía local y joyas ocultas.',
      heroImageUrl: 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?auto=format&fit=crop&w=1200&q=80',
      bestTimeToVisit: 'Abril a Junio, Septiembre a Octubre',
      currency: 'EUR',
      language: 'Italiano',
      averageDailyBudget: 120,
      latitude: 45.464204,
      longitude: 9.189982,
      guide: {
        headline: 'Qué ver en Milán: rincones locales para descubrir la ciudad',
        introduction:
          'Milán combina arquitectura histórica, diseño contemporáneo y una cultura de barrio que se descubre mejor sin prisas. Reserva tiempo para sus grandes iconos, pero deja espacio para los mercados, los cafés y los paseos junto a los canales.',
        gettingAround:
          'El centro se puede recorrer a pie y la red de metro, tranvías y autobuses conecta los barrios principales. Compra el billete antes de subir y valida el título según las indicaciones locales; desde los aeropuertos, compara trenes y autobuses con antelación.',
        suggestedDays: 3,
        placesToVisit: [
          {
            name: 'Duomo y Piazza del Duomo',
            description:
              'La catedral gótica y la plaza forman el corazón monumental de la ciudad. Comprueba los horarios y reserva la subida a las terrazas con antelación.',
            imageUrl: 'https://images.unsplash.com/photo-1513581166391-887a96ddeafd?auto=format&fit=crop&w=900&q=85',
            latitude: 45.4642,
            longitude: 9.19,
          },
          {
            name: 'Fondazione Prada y Bar Luce',
            description:
              'Un complejo de arte contemporáneo en una antigua destilería; el café diseñado por Wes Anderson añade una pausa con personalidad al recorrido.',
            imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=900&q=85',
            latitude: 45.4413,
            longitude: 9.2027,
          },
          {
            name: 'Navigli al atardecer',
            description:
              'Los canales y sus calles cercanas invitan a un paseo al final del día. Llega temprano si quieres elegir con calma dónde tomar el aperitivo.',
            imageUrl: 'https://images.unsplash.com/photo-1514896856000-91cb6de818e0?auto=format&fit=crop&w=900&q=85',
            latitude: 45.4515,
            longitude: 9.1795,
          },
          {
            name: 'La Última Cena en Santa Maria delle Grazie',
            description: 'El mural de Leonardo da Vinci es una de las visitas más solicitadas de Milán y requiere reservar entrada con antelación.',
            latitude: 45.466,
            longitude: 9.17,
          },
          {
            name: 'Galleria Vittorio Emanuele II',
            description: 'Una galería histórica cubierta de vidrio y hierro que conecta la Piazza del Duomo con la Piazza della Scala.',
            latitude: 45.4659,
            longitude: 9.19,
          },
          {
            name: 'Teatro alla Scala',
            description: 'El célebre teatro de ópera ofrece visitas a su museo y funciones durante la temporada.',
            latitude: 45.4674,
            longitude: 9.1896,
          },
          {
            name: 'Castello Sforzesco',
            description: 'Una fortaleza renacentista que alberga museos y se abre al parque Sempione.',
            latitude: 45.4705,
            longitude: 9.1794,
          },
          {
            name: 'Parco Sempione y Arco della Pace',
            description: 'Un parque urbano para pasear entre el castillo y el arco monumental al final de la avenida.',
            latitude: 45.473,
            longitude: 9.1728,
          },
          {
            name: 'Pinacoteca di Brera',
            description: 'Una colección de pintura italiana dentro del barrio de Brera, rodeada de calles y cafés.',
            latitude: 45.4719,
            longitude: 9.1881,
          },
          {
            name: 'Cimitero Monumentale',
            description: 'Un cementerio-museo al aire libre conocido por su arquitectura y esculturas funerarias.',
            latitude: 45.4863,
            longitude: 9.1735,
          },
        ],
        typicalFoods: [
          {
            name: 'Risotto alla milanese',
            imageUrl: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=900&q=85',
            ingredients: ['arroz', 'azafrán', 'caldo', 'mantequilla', 'queso parmesano'],
          },
          {
            name: 'Cotoletta alla milanese',
            imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=85',
            ingredients: ['ternera', 'huevo', 'pan rallado', 'mantequilla'],
          },
          {
            name: 'Panettone',
            imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=85',
            ingredients: ['harina', 'mantequilla', 'huevo', 'fruta confitada', 'pasas'],
          },
          {
            name: 'Ossobuco',
            imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85',
            ingredients: ['jarrete de ternera', 'zanahoria', 'apio', 'vino blanco', 'caldo'],
          },
          {
            name: 'Cassoeula',
            imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85',
            ingredients: ['cerdo', 'col', 'zanahoria', 'cebolla', 'caldo'],
          },
          {
            name: 'Michetta',
            imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=85',
            ingredients: ['harina', 'agua', 'levadura', 'malta', 'sal'],
          },
        ],
        travelTips: [
          'Reserva con antelación la visita a La Última Cena: las entradas suelen tener disponibilidad limitada.',
          'Combina los trayectos a pie con metro o tranvía y consulta los horarios vigentes antes de viajar.',
        ],
        faqs: [
          {
            question: '¿Cuántos días se recomiendan para visitar Milán?',
            answer: 'Tres días permiten combinar los principales monumentos con barrios, museos y una excursión opcional.',
          },
          {
            question: '¿Cuál es la mejor época para viajar a Milán?',
            answer: 'La primavera y el otoño suelen ser agradables para recorrer la ciudad; comprueba el tiempo y los eventos antes de reservar.',
          },
        ],
      },
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.destinations.set(milan.id, milan);

    const mexicoCity = {
      id: '55555555-5555-4555-a555-555555555555',
      slug: 'ciudad-de-mexico',
      name: 'Ciudad de México',
      type: 'city',
      country: 'México',
      description: 'Una capital inmensa donde conviven historia prehispánica, arquitectura, museos y una de las escenas gastronómicas más ricas del mundo.',
      heroImageUrl: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?auto=format&fit=crop&w=1200&q=85',
      bestTimeToVisit: 'Marzo a mayo y octubre a noviembre',
      currency: 'MXN',
      language: 'Español',
      averageDailyBudget: 1800,
      latitude: 19.4326,
      longitude: -99.1332,
      guide: {
        headline: 'Qué ver en Ciudad de México: guía para descubrir la capital',
        introduction: 'Ciudad de México reúne capas de historia, barrios creativos, museos de primer nivel y una cultura culinaria que se disfruta en mercados y pequeñas fondas. Para conocerla con calma, combina las visitas del centro con varios barrios y deja tiempo para desplazarte entre zonas.',
        gettingAround: 'El Metro y el Metrobús conectan muchos puntos de interés; usa una tarjeta de movilidad integrada y revisa los horarios antes de salir. Para trayectos nocturnos o zonas menos conectadas, utiliza servicios de transporte autorizados y considera el tráfico al planificar.',
        suggestedDays: 4,
        placesToVisit: [
          { name: 'Zócalo y Centro Histórico', description: 'La gran plaza central está rodeada por edificios históricos, calles peatonales y varios de los principales sitios culturales de la capital.', latitude: 19.4326, longitude: -99.1332 },
          { name: 'Templo Mayor', description: 'El recinto arqueológico y su museo muestran vestigios de la antigua Tenochtitlan junto a la plaza principal.', latitude: 19.4352, longitude: -99.1312 },
          { name: 'Palacio de Bellas Artes', description: 'Un emblemático recinto cultural con arquitectura monumental, murales y programación de música, danza y exposiciones.', latitude: 19.4352, longitude: -99.1412 },
          { name: 'Bosque de Chapultepec', description: 'Un extenso parque urbano con lagos, senderos, museos y espacios para descansar entre visitas.', latitude: 19.4204, longitude: -99.1819 },
          { name: 'Museo Nacional de Antropología', description: 'Sus salas recorren las culturas de México y resguardan importantes piezas arqueológicas; consulta horarios y acceso con antelación.', latitude: 19.426, longitude: -99.186 },
          { name: 'Coyoacán', description: 'Un barrio de plazas arboladas, mercados y calles históricas, ideal para dedicarle una mañana sin prisas.', latitude: 19.3497, longitude: -99.1617 },
          { name: 'Museo Frida Kahlo', description: 'La Casa Azul conserva objetos y espacios vinculados con Frida Kahlo; reserva la entrada con suficiente anticipación.', latitude: 19.3551, longitude: -99.162 },
          { name: 'Xochimilco', description: 'Sus canales y embarcaderos permiten conocer una parte singular del paisaje lacustre de la ciudad; acuerda el recorrido y la tarifa antes de embarcar.', latitude: 19.257, longitude: -99.103 },
          { name: 'Roma y Condesa', description: 'Dos barrios para caminar entre parques, arquitectura, librerías, cafeterías y restaurantes de distintas cocinas.', latitude: 19.411, longitude: -99.171 },
          { name: 'Basílica de Guadalupe', description: 'Uno de los principales santuarios del país, con varios recintos y espacios abiertos en el norte de la ciudad.', latitude: 19.4848, longitude: -99.1176 },
        ],
        typicalFoods: [
          { name: 'Tacos al pastor', imageUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=900&q=85', ingredients: ['carne de cerdo adobada', 'tortilla de maíz', 'piña', 'cebolla', 'cilantro'] },
          { name: 'Tlacoyos', imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=85', ingredients: ['masa de maíz azul', 'frijoles', 'nopales', 'queso fresco', 'salsa'] },
          { name: 'Quesadillas', imageUrl: 'https://images.unsplash.com/photo-1618040996337-56904b7850b9?auto=format&fit=crop&w=900&q=85', ingredients: ['tortilla de maíz', 'quesillo', 'flor de calabaza', 'epazote'] },
          { name: 'Pozole rojo', imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85', ingredients: ['maíz cacahuazintle', 'cerdo', 'chile guajillo', 'lechuga', 'rábano'] },
          { name: 'Torta de tamal', imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=85', ingredients: ['bolillo', 'tamal de maíz', 'salsa verde o roja'] },
          { name: 'Churros con chocolate', imageUrl: 'https://images.unsplash.com/photo-1624371414361-e670edf4898d?auto=format&fit=crop&w=900&q=85', ingredients: ['harina', 'agua', 'azúcar', 'canela', 'chocolate'] },
        ],
        travelTips: ['Reserva con antelación museos y casas-museo con aforo limitado, especialmente los fines de semana.', 'La ciudad es extensa: agrupa visitas por barrio y deja margen adicional para el tráfico y los traslados.'],
        faqs: [
          { question: '¿Cuántos días se recomiendan para Ciudad de México?', answer: 'Cuatro días permiten combinar el Centro Histórico, Chapultepec, varios barrios y una visita a Xochimilco.' },
          { question: '¿Cómo conviene moverse por la ciudad?', answer: 'El Metro y el Metrobús son útiles en muchas rutas; revisa las condiciones del servicio y elige transporte autorizado para los trayectos que lo requieran.' },
        ],
      },
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const sanSalvador = {
      id: '66666666-6666-4666-a666-666666666666',
      slug: 'san-salvador',
      name: 'San Salvador',
      type: 'city',
      country: 'El Salvador',
      description: 'La capital salvadoreña combina plazas históricas, mercados, museos y una animada vida urbana a los pies del volcán de San Salvador.',
      heroImageUrl: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=1200&q=85',
      bestTimeToVisit: 'Noviembre a abril',
      currency: 'USD',
      language: 'Español',
      averageDailyBudget: 75,
      latitude: 13.6929,
      longitude: -89.2182,
      guide: {
        headline: 'Qué ver en San Salvador: lugares, sabores y consejos',
        introduction: 'San Salvador ofrece una mezcla de plazas históricas, arte, mercados y cocina tradicional. La ciudad se disfruta mejor organizando las visitas por zonas, reservando tiempo para probar pupusas y consultando las recomendaciones locales de transporte y seguridad antes de cada recorrido.',
        gettingAround: 'Los autobuses cubren numerosas rutas, aunque los recorridos pueden resultar difíciles de interpretar para quien visita por primera vez. Confirma las opciones y horarios con fuentes locales, utiliza taxis o aplicaciones autorizadas cuando convenga y evita caminar por zonas desconocidas de noche.',
        suggestedDays: 3,
        placesToVisit: [
          { name: 'Centro Histórico', description: 'Un conjunto de plazas, edificios restaurados, mercados y calles comerciales que permite acercarse a la historia de la capital.', latitude: 13.6989, longitude: -89.1914 },
          { name: 'Catedral Metropolitana', description: 'El principal templo de la ciudad se encuentra frente a la Plaza Gerardo Barrios y forma parte del recorrido por el centro.', latitude: 13.6987, longitude: -89.1913 },
          { name: 'Palacio Nacional', description: 'Un edificio histórico con patios y salones representativos; verifica los horarios de visita antes de acudir.', latitude: 13.6985, longitude: -89.1919 },
          { name: 'Teatro Nacional', description: 'Uno de los recintos culturales más destacados del país, con visitas y espectáculos sujetos a programación.', latitude: 13.6982, longitude: -89.191 },
          { name: 'Plaza Gerardo Barrios', description: 'Una plaza céntrica rodeada de arquitectura histórica y un buen punto para iniciar el paseo por el casco antiguo.', latitude: 13.6988, longitude: -89.1915 },
          { name: 'Museo de Arte de El Salvador', description: 'Sus exposiciones presentan distintas etapas del arte salvadoreño en un espacio cultural del área metropolitana.', latitude: 13.6847, longitude: -89.238 },
          { name: 'Museo Nacional de Antropología Dr. David J. Guzmán', description: 'Una visita para conocer la arqueología y la historia cultural de El Salvador mediante colecciones y exposiciones.', latitude: 13.6857, longitude: -89.2374 },
          { name: 'Monumento al Divino Salvador del Mundo', description: 'Un monumento emblemático situado en una plaza abierta y conectado con varias avenidas principales.', latitude: 13.7017, longitude: -89.2243 },
          { name: 'Parque Cuscatlán', description: 'Un parque urbano con áreas verdes y espacios culturales para hacer una pausa durante el recorrido.', latitude: 13.6988, longitude: -89.2044 },
          { name: 'Mercado Central', description: 'Un mercado concurrido donde se encuentran productos locales y puestos de comida; visita con atención a tus pertenencias.', latitude: 13.6973, longitude: -89.1947 },
        ],
        typicalFoods: [
          { name: 'Pupusas', imageUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=900&q=85', ingredients: ['masa de maíz o arroz', 'quesillo', 'frijoles', 'chicharrón'] },
          { name: 'Yuca frita con curtido', imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=85', ingredients: ['yuca', 'repollo', 'zanahoria', 'vinagre', 'salsa de tomate'] },
          { name: 'Pan con pavo', imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=85', ingredients: ['pan', 'pavo', 'tomate', 'rábano', 'berro', 'salsa'] },
          { name: 'Tamales pisques', imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85', ingredients: ['masa de maíz', 'frijoles', 'hoja de plátano', 'sal'] },
          { name: 'Riguas', imageUrl: 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?auto=format&fit=crop&w=900&q=85', ingredients: ['maíz tierno', 'azúcar', 'sal', 'hoja de plátano'] },
          { name: 'Atol de elote', imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=900&q=85', ingredients: ['maíz tierno', 'leche', 'azúcar', 'canela'] },
        ],
        travelTips: ['Consulta recomendaciones locales actualizadas sobre transporte y zonas antes de recorrer la ciudad.', 'Pregunta por ingredientes y nivel de picante al probar platos nuevos; los mercados y pupuserías pueden tener horarios distintos.'],
        faqs: [
          { question: '¿Cuántos días dedicar a San Salvador?', answer: 'Dos o tres días permiten conocer el centro, visitar museos y probar la gastronomía local con tiempo.' },
          { question: '¿Qué moneda se utiliza en El Salvador?', answer: 'La moneda de uso oficial es el dólar estadounidense (USD); confirma los métodos de pago aceptados antes de viajar.' },
        ],
      },
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.destinations.set(mexicoCity.id, mexicoCity);
    this.destinations.set(sanSalvador.id, sanSalvador);

    posts.forEach((post, index) => {
      const [name, ...countryParts] = post.destination.split(',');
      const country = countryParts.join(',').trim() || name.trim();
      const normalizedName = name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const normalizedCountry = country.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const existing = Array.from(this.destinations.values()).some((destination) => {
        const existingName = destination.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const existingCountry = destination.country.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        return existingName === normalizedName && existingCountry === normalizedCountry;
      });
      if (existing) return;

      const id = `66666666-6666-4666-8666-${String(index + 1).padStart(12, '0')}`;
      this.destinations.set(id, {
        id,
        slug: post.slug,
        name: name.trim(),
        type: countryParts.length ? 'city' : 'country',
        country,
        description: post.excerpt,
        heroImageUrl: getPostImage(post.image),
        bestTimeToVisit: post.bestTime,
        currency: post.currency,
        language: post.language,
        averageDailyBudget: post.averageDailyBudget,
        latitude: post.coordinates.latitude,
        longitude: post.coordinates.longitude,
        guide: post.guide,
        status: 'published',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    // 3. Default Places in Milan with Leaflet coordinates
    const placesList = [
      {
        id: '33333333-3333-4333-a333-333333333331',
        slug: 'trattoria-madonnina-milan',
        name: 'Trattoria Madonnina',
        destinationId: milan.id,
        category: 'restaurant',
        description: 'Auténtica trattoria milanesa con manteles de cuadros, risotto alla milanese y cotoletta casera.',
        address: 'Via Gentilino 9, 20136 Milano',
        latitude: 45.449764,
        longitude: 9.180211,
        zoom: 16,
        googleMapsUrl: 'https://www.google.com/maps?q=45.449764,9.180211',
        appleMapsUrl: 'https://maps.apple.com/?q=45.449764,9.180211',
        openStreetMapUrl: 'https://www.openstreetmap.org/?mlat=45.449764&mlon=9.180211#map=16/45.449764/9.180211',
        priceLevel: 2,
        openingHours: { mon_sat: '12:30-14:30, 20:00-23:00', sun: 'closed' },
        images: [],
        imageUrls: ['https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80'],
        tags: ['comida local', 'tradicional', 'sin turistas', 'barato'],
        status: 'published',
        localScore: 9.5,
        valueScore: 9.0,
        crowdLevel: 'low',
        bestTime: '13:00 o 20:30 con reserva previa',
        walkability: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '33333333-3333-4333-a333-333333333332',
        slug: 'fondazione-prada-bar-luce',
        name: 'Bar Luce (Fondazione Prada)',
        destinationId: milan.id,
        category: 'experience',
        description: 'Diseñado por Wes Anderson, recrea la atmósfera de un café milanés clásico de los años 50 con toques pop.',
        address: 'Largo Isarco 2, 20139 Milano',
        latitude: 45.444318,
        longitude: 9.204899,
        zoom: 16,
        googleMapsUrl: 'https://www.google.com/maps?q=45.444318,9.204899',
        appleMapsUrl: 'https://maps.apple.com/?q=45.444318,9.204899',
        openStreetMapUrl: 'https://www.openstreetmap.org/?mlat=45.444318&mlon=9.204899#map=16/45.444318/9.204899',
        priceLevel: 2,
        openingHours: { wed_mon: '09:00-20:00', tue: 'closed' },
        images: [],
        imageUrls: ['https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80'],
        tags: ['cafe', 'diseño', 'fotogenico', 'arte'],
        status: 'published',
        localScore: 8.8,
        valueScore: 8.5,
        crowdLevel: 'moderate',
        bestTime: 'Mañanas de 10:00 a 11:30',
        walkability: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '33333333-3333-4333-a333-333333333333',
        slug: 'parco-sempione-arco-della-pace',
        name: 'Arco della Pace & Parco Sempione',
        destinationId: milan.id,
        category: 'attraction',
        description: 'El pulmón verde de Milán para un paseo relajado al atardecer lejos del bullicio del Duomo.',
        address: 'Piazza Sempione, 20154 Milano',
        latitude: 45.475878,
        longitude: 9.172426,
        zoom: 15,
        googleMapsUrl: 'https://www.google.com/maps?q=45.475878,9.172426',
        appleMapsUrl: 'https://maps.apple.com/?q=45.475878,9.172426',
        openStreetMapUrl: 'https://www.openstreetmap.org/?mlat=45.475878&mlon=9.172426#map=15/45.475878/9.172426',
        priceLevel: 1,
        openingHours: { daily: '06:30-21:00' },
        images: [],
        imageUrls: ['https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80'],
        tags: ['parque', 'vistas', 'gratis', 'atardecer'],
        status: 'published',
        localScore: 9.0,
        valueScore: 10.0,
        crowdLevel: 'low',
        bestTime: 'Atardecer para el aperitivo cercano',
        walkability: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    for (const p of placesList) {
      this.places.set(p.id, p);
    }

    // 4. Default Itinerary: 2 Días en Milán Alternativo
    const itinerary = {
      id: '44444444-4444-4444-a444-444444444444',
      slug: '2-dias-en-milan-local-y-sin-multitudes',
      title: '2 Días en Milán: Sabores Locales y Cero Multitudes',
      destinationId: milan.id,
      totalDays: 2,
      totalBudget: 240,
      summary: 'Una inmersión en barrios con encanto, trattorias con sabor auténtico y rincones de diseño.',
      days: [
        {
          dayNumber: 1,
          title: 'Día 1: Navigli alternativo y cocina tradicional',
          summary: 'Callejear lejos de los canales principales y saborear la gastronomía lombarda.',
          theme: 'Gastronomía y Rincones Ocultos',
          estimatedCost: 110,
          weatherAlternatives: 'Si llueve, pasar la tarde en la librería de diseño Corso Como 10.',
          crowdTips: 'Evita la orilla principal de Navigli a las 19:00; camina por Via Gentilino.',
          stops: [
            {
              placeId: placesList[0].id,
              name: placesList[0].name,
              category: placesList[0].category,
              timeOfDay: 'lunch',
              estimatedMinutes: 90,
              latitude: placesList[0].latitude,
              longitude: placesList[0].longitude,
              notes: 'Pide risotto al salto y vino de la casa.',
            },
            {
              placeId: placesList[1].id,
              name: placesList[1].name,
              category: placesList[1].category,
              timeOfDay: 'afternoon',
              estimatedMinutes: 60,
              latitude: placesList[1].latitude,
              longitude: placesList[1].longitude,
              notes: 'Café de especialidad y pastelito típico.',
            }
          ]
        },
        {
          dayNumber: 2,
          title: 'Día 2: Diseño, parques y aperitivo de barrio',
          summary: 'Arquitectura sobria, aire libre y atardecer con vistas.',
          theme: 'Cultura Local y Relax',
          estimatedCost: 90,
          weatherAlternatives: 'Visitar las galerías de arte contemporáneo de Fondazione Prada.',
          crowdTips: 'El Parco Sempione se disfruta mejor a primera hora de la mañana.',
          stops: [
            {
              placeId: placesList[2].id,
              name: placesList[2].name,
              category: placesList[2].category,
              timeOfDay: 'afternoon',
              estimatedMinutes: 120,
              latitude: placesList[2].latitude,
              longitude: placesList[2].longitude,
              notes: 'Paseo relajado y fotos frente al arco neoclásico.',
            }
          ]
        }
      ],
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.itineraries.set(itinerary.id, itinerary);
  }
}
