import { createLogger } from '@localdepth/logger';

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
    const { Pool } = await import('pg');
    const connectionString =
      config?.connectionString ||
      process.env.DATABASE_URL ||
      `postgresql://${process.env.DATABASE_USER || 'postgres'}:${process.env.DATABASE_PASSWORD || 'postgres'}@${
        process.env.DATABASE_HOST || 'localhost'
      }:${process.env.DATABASE_PORT || '5432'}/${process.env.DATABASE_NAME || 'localdepth'}`;

    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
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

// -------------------------------------------------------------
// In-Memory Fallback & Fast Prototyping Store
// Ensures all services operate reliably in any environment
// -------------------------------------------------------------
export class MemoryStore {
  private static instance: MemoryStore;
  public users: Map<string, any> = new Map();
  public destinations: Map<string, any> = new Map();
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
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.destinations.set(milan.id, milan);

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
