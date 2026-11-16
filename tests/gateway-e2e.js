process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { handleGatewayRequest } from '../services/api-gateway/src/index.ts';
import { handleAuthRequest } from '../services/auth-service/src/index.ts';
import { handleContentRequest } from '../services/content-service/src/index.ts';
import { handleMediaRequest } from '../services/media-service/src/index.ts';
import { handleSearchRequest } from '../services/search-service/src/index.ts';
import { handleRecommendationsRequest } from '../services/recommendations-service/src/index.ts';

const serviceHandlers = {
  auth: handleAuthRequest,
  content: handleContentRequest,
  media: handleMediaRequest,
  search: handleSearchRequest,
  recommendations: handleRecommendationsRequest,
};

// Lightweight HTTP Mock Engine
function simulateRequest(options, postBody = null) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = options.method || 'GET';
    req.url = options.url || '/';
    req.headers = {
      host: 'localhost:4000',
      'content-type': 'application/json',
      ...(options.headers || {}),
    };

    let statusCode = 200;
    let headers = {};
    let responseBody = '';

    const res = {
      setHeader(name, value) {
        headers[name.toLowerCase()] = value;
      },
      writeHead(code, h) {
        statusCode = code;
        if (h) Object.assign(headers, h);
      },
      write(chunk) {
        responseBody += chunk;
      },
      end(chunk) {
        if (chunk) responseBody += chunk;
        let parsed = responseBody;
        try {
          parsed = JSON.parse(responseBody);
        } catch {}
        resolve({ statusCode, headers, body: parsed });
      },
    };

    // Invoke Gateway Handler
    handleGatewayRequest(req, res, serviceHandlers);

    // Deliver the body after async handlers have had a chance to attach listeners.
    setImmediate(() => {
      if (postBody) {
        const data = typeof postBody === 'string' ? postBody : JSON.stringify(postBody);
        req.emit('data', data);
      }
      req.emit('end');
    });
  });
}

async function runE2ETests() {
  console.log('\n🚀 Starting LocalDepth Gateway & Microservices End-to-End Test Run...\n');

  // 1. Healthcheck
  console.log('1. [API GATEWAY] GET /health');
  const healthRes = await simulateRequest({ url: '/health' });
  assert.equal(healthRes.statusCode, 200);
  assert.equal(healthRes.body.status, 'healthy');
  console.log('   ✅ Gateway is healthy. Services registered:', Object.keys(healthRes.body.services).join(', '));

  // 2. Auth - Admin Login
  console.log('\n2. [AUTH-SERVICE via Gateway] POST /api/auth/login');
  const loginRes = await simulateRequest(
    { method: 'POST', url: '/api/auth/login' },
    { email: 'admin@localdepth.com', password: 'admin123456' }
  );
  assert.equal(loginRes.statusCode, 200);
  assert.equal(loginRes.body.success, true);
  const token = loginRes.body.data.tokens.accessToken;
  const adminUser = loginRes.body.data.user;
  assert.ok(token);
  assert.equal(adminUser.role, 'admin');
  console.log(`   ✅ Login successful for "${adminUser.name}" <${adminUser.email}> with role: ${adminUser.role}`);
  console.log(`   ✅ JWT Bearer Token generated: ${token.substring(0, 30)}...`);

  // 3. Auth - GET /api/auth/me (Protected Route with JWT)
  console.log('\n3. [AUTH-SERVICE via Gateway] GET /api/auth/me (Protected)');
  const meRes = await simulateRequest({
    method: 'GET',
    url: '/api/auth/me',
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(meRes.statusCode, 200);
  assert.equal(meRes.body.data.id, adminUser.id);
  console.log('   ✅ Bearer token successfully verified by Gateway and Auth Service');

  // 4. Content - Destinations List
  console.log('\n4. [CONTENT-SERVICE via Gateway] GET /api/content/destinations');
  const destRes = await simulateRequest({ url: '/api/content/destinations' });
  assert.equal(destRes.statusCode, 200);
  assert.ok(destRes.body.data.length >= 22);
  const milan = destRes.body.data.find((d) => d.slug === 'milan');
  assert.ok(milan);
  const manchester = destRes.body.data.find((d) => d.slug === 'manchester-musica-y-barrios');
  assert.ok(manchester, 'Manchester must be available for editing in the admin');
  assert.ok(manchester.heroImageUrl);
  const updatedCoverImage = 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1200&q=85';
  const updateDestinationRes = await simulateRequest(
    { method: 'PUT', url: `/api/content/destinations/${manchester.id}` },
    { heroImageUrl: updatedCoverImage }
  );
  assert.equal(updateDestinationRes.statusCode, 200);
  assert.equal(updateDestinationRes.body.data.heroImageUrl, updatedCoverImage);
  for (const slug of ['ciudad-de-mexico', 'san-salvador']) {
    const destination = destRes.body.data.find((item) => item.slug === slug);
    assert.ok(destination, `${slug} must be available through the content API`);
    assert.equal(destination.status, 'published');
    assert.equal(destination.guide.placesToVisit.length, 10);
    assert.equal(destination.guide.typicalFoods.length, 6);
  }
  const commentRes = await simulateRequest(
    { method: 'POST', url: `/api/content/destinations/${manchester.slug}/comments` },
    { authorName: 'Viajeros', body: 'Un destino estupendo para descubrir a pie.' }
  );
  assert.equal(commentRes.statusCode, 201);
  assert.equal(commentRes.body.data.body, 'Un destino estupendo para descubrir a pie.');
  const voterKey = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const firstRatingRes = await simulateRequest(
    { method: 'POST', url: `/api/content/destinations/${manchester.slug}/ratings` },
    { voterKey, score: 5 }
  );
  assert.equal(firstRatingRes.statusCode, 200);
  assert.equal(firstRatingRes.body.data.ratingCount, 1);
  const updatedRatingRes = await simulateRequest(
    { method: 'POST', url: `/api/content/destinations/${manchester.slug}/ratings` },
    { voterKey, score: 3 }
  );
  assert.equal(updatedRatingRes.statusCode, 200);
  assert.equal(updatedRatingRes.body.data.ratingCount, 1, 'A browser can update its rating without creating duplicates');
  assert.equal(updatedRatingRes.body.data.averageRating, 3);
  const engagementRes = await simulateRequest({ url: `/api/content/destinations/${manchester.slug}/engagement` });
  assert.equal(engagementRes.statusCode, 200);
  assert.equal(engagementRes.body.data.commentCount, 1);
  assert.equal(engagementRes.body.data.comments[0].authorName, 'Viajeros');
  const topRatedRes = await simulateRequest({ url: '/api/content/destinations/top-rated' });
  assert.equal(topRatedRes.statusCode, 200);
  assert.equal(topRatedRes.body.data.length, 5);
  assert.equal(topRatedRes.body.data[0].slug, manchester.slug);
  const allRatingsRes = await simulateRequest({ url: '/api/content/destinations/top-rated?limit=100' });
  assert.equal(allRatingsRes.statusCode, 200);
  assert.ok(allRatingsRes.body.data.length >= 22, 'The homepage can request ratings for all published destinations');
  assert.equal(allRatingsRes.body.data[0].slug, manchester.slug);
  assert.ok(
    allRatingsRes.body.data.every((destination, index, destinations) =>
      index === 0 || destinations[index - 1].averageRating >= destination.averageRating
    ),
    'The destination rating list must be ordered from the highest average to the lowest',
  );
  const invalidRankingLimitRes = await simulateRequest({ url: '/api/content/destinations/top-rated?limit=101' });
  assert.equal(invalidRankingLimitRes.statusCode, 400);
  const invalidRatingRes = await simulateRequest(
    { method: 'POST', url: `/api/content/destinations/${manchester.slug}/ratings` },
    { voterKey, score: 6 }
  );
  assert.equal(invalidRatingRes.statusCode, 400);
  console.log('   ✅ Destination comments, editable one-per-browser ratings, and rating-sorted destination lists work');
  console.log(`   ✅ Retrieved ${destRes.body.data.length} destination(s): ${milan.name} (${milan.country})`);
  console.log(`   📌 Daily budget: ${milan.averageDailyBudget}€, Best time: ${milan.bestTimeToVisit}`);

  // 5. Content - Create a city with a complete travel guide
  console.log('\n5. [CONTENT-SERVICE via Gateway] POST /api/content/destinations (Create travel guide)');
  const invalidDestinationRes = await simulateRequest(
    { method: 'POST', url: '/api/content/destinations' },
    { name: 'Copenhague', country: 'Dinamarca', type: 'city', status: 'published' }
  );
  assert.equal(invalidDestinationRes.statusCode, 400);
  assert.ok(invalidDestinationRes.body.errors.guide);
  assert.ok(invalidDestinationRes.body.errors.heroImageUrl);

  const createDestinationRes = await simulateRequest(
    { method: 'POST', url: '/api/content/destinations' },
    {
      name: 'Copenhague',
      country: 'Dinamarca',
      type: 'city',
      description: 'Canales, diseño escandinavo y barrios llenos de vida.',
      heroImageUrl: 'https://images.unsplash.com/photo-1513622470522-26c3c8a854bc',
      bestTimeToVisit: 'Mayo a septiembre',
      currency: 'DKK',
      language: 'Danés e inglés',
      averageDailyBudget: 1200,
      latitude: 55.6761,
      longitude: 12.5683,
      status: 'published',
      guide: {
        headline: 'Qué ver en Copenhague: guía de viaje',
        introduction: 'Copenhague combina canales históricos, arquitectura contemporánea y barrios con personalidad para explorar a pie.',
        gettingAround: 'Metro, autobuses, trenes y bicicletas conectan los distintos barrios de la ciudad.',
        suggestedDays: 3,
        placesToVisit: [
          { name: 'Nyhavn', description: 'El antiguo puerto conserva casas de colores y una animada zona junto al canal.', latitude: 55.6798, longitude: 12.5901 },
          { name: 'Jardines de Tivoli', description: 'Un parque histórico con jardines, atracciones y restaurantes en el centro.', latitude: 55.6736, longitude: 12.5681 },
          { name: 'Castillo de Rosenborg', description: 'Un castillo renacentista rodeado por los jardines del Rey.', latitude: 55.6851, longitude: 12.5773 },
          { name: 'Palacio de Christiansborg', description: 'Sede de instituciones danesas con salas históricas y torre panorámica.', latitude: 55.6763, longitude: 12.5793 },
          { name: 'La Sirenita', description: 'Escultura junto al puerto, accesible mediante un paseo por el frente marítimo.', latitude: 55.6929, longitude: 12.5993 },
          { name: 'Palacio de Amalienborg', description: 'Residencia real formada por cuatro palacios alrededor de una plaza octogonal.', latitude: 55.6841, longitude: 12.5933 },
          { name: 'Iglesia de Mármol', description: 'Iglesia de cúpula monumental situada junto al conjunto de Amalienborg.', latitude: 55.6846, longitude: 12.5896 },
          { name: 'Torre Redonda', description: 'Torre histórica con rampa interior y vistas sobre los tejados del centro.', latitude: 55.6814, longitude: 12.5755 },
          { name: 'Christiania', description: 'Barrio autogestionado conocido por su historia y sus espacios culturales.', latitude: 55.6737, longitude: 12.5985 },
          { name: 'Jardín Botánico', description: 'Jardín y colección botánica junto al centro, con un invernadero histórico.', latitude: 55.6867, longitude: 12.5729 },
        ],
        typicalFoods: [
          { name: 'Smørrebrød', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836', ingredients: ['pan de centeno', 'pescado', 'mantequilla'] },
          { name: 'Frikadeller', imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1', ingredients: ['cerdo', 'cebolla', 'huevo'] },
          { name: 'Wienerbrød', imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb', ingredients: ['harina', 'mantequilla', 'azúcar'] },
          { name: 'Stegt flæsk', imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947', ingredients: ['cerdo', 'patata', 'perejil'] },
          { name: 'Rødgrød med fløde', imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777', ingredients: ['frutos rojos', 'azúcar', 'nata'] },
          { name: 'Flæskesteg', imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554', ingredients: ['cerdo', 'laurel', 'clavo'] },
        ],
        travelTips: ['Reserva las atracciones más populares con antelación.', 'Comprueba horarios y transporte antes de salir.'],
        faqs: [
          { question: '¿Cuántos días necesito?', answer: 'Tres días permiten conocer los barrios y principales atractivos.' },
          { question: '¿Cuál es la mejor época?', answer: 'De mayo a septiembre suele haber días más largos y templados.' },
        ],
      },
    }
  );
  assert.equal(createDestinationRes.statusCode, 201);
  assert.equal(createDestinationRes.body.data.slug, 'copenhague');
  assert.equal(createDestinationRes.body.data.guide.placesToVisit.length, 10);
  assert.equal(createDestinationRes.body.data.guide.typicalFoods.length, 6);
  assert.ok(createDestinationRes.body.data.guide.typicalFoods.every((food) => food.imageUrl && food.ingredients.length >= 2));
  const createdGuideRes = await simulateRequest({ url: '/api/content/destinations/copenhague' });
  assert.equal(createdGuideRes.statusCode, 200);
  assert.equal(createdGuideRes.body.data.guide.faqs.length, 2);
  console.log('   ✅ City guide saved and returned with practical data, geolocated places and FAQs');

  // 5. Content - Places List (Verifying Leaflet Data)
  console.log('\n6. [CONTENT-SERVICE via Gateway] GET /api/content/places?destinationId=' + milan.id);
  const placesRes = await simulateRequest({ url: `/api/content/places?destinationId=${milan.id}` });
  assert.equal(placesRes.statusCode, 200);
  assert.ok(placesRes.body.data.length >= 3);
  const firstPlace = placesRes.body.data[0];
  assert.ok(firstPlace.latitude && firstPlace.longitude);
  assert.ok(firstPlace.googleMapsUrl);
  assert.ok(firstPlace.openStreetMapUrl);
  console.log(`   ✅ Found ${placesRes.body.data.length} places with Leaflet geolocation data`);
  console.log(`   📍 Sample: "${firstPlace.name}" [lat: ${firstPlace.latitude}, lng: ${firstPlace.longitude}]`);
  console.log(`      OSM Tile URL: ${firstPlace.openStreetMapUrl}`);
  console.log(`      Google Maps:  ${firstPlace.googleMapsUrl}`);
  console.log(`      Local Score:  ${firstPlace.localScore}/10 (Crowd Level: ${firstPlace.crowdLevel})`);

  // 6. Content - Create New Place via Admin (Leaflet Map Picker Flow)
  console.log('\n7. [CONTENT-SERVICE via Gateway] POST /api/content/places (Admin creates new place)');
  const createPlaceRes = await simulateRequest(
    {
      method: 'POST',
      url: '/api/content/places',
      headers: { authorization: `Bearer ${token}` },
    },
    {
      name: 'Pasticceria Marchesi 1824',
      destinationId: milan.id,
      category: 'restaurant',
      description: 'Emblemática pastelería en Galleria Vittorio Emanuele II.',
      address: 'Galleria Vittorio Emanuele II, Milano',
      latitude: 45.465812,
      longitude: 9.189945,
      zoom: 16,
      tags: ['cafe', 'dulces', 'historico'],
      localScore: 9.4,
      status: 'published',
    }
  );
  assert.equal(createPlaceRes.statusCode, 201);
  const createdPlace = createPlaceRes.body.data;
  assert.equal(createdPlace.slug, 'pasticceria-marchesi-1824');
  assert.equal(
    createdPlace.openStreetMapUrl,
    'https://www.openstreetmap.org/?mlat=45.465812&mlon=9.189945#map=16/45.465812/9.189945'
  );
  console.log(`   ✅ Place created: "${createdPlace.name}" (slug: ${createdPlace.slug})`);
  console.log(`   🗺️ Canonical OpenStreetMap URL auto-generated: ${createdPlace.openStreetMapUrl}`);

  // 7. Media Service - Upload Asset Metadata
  console.log('\n8. [MEDIA-SERVICE via Gateway] POST /api/media/upload');
  const mediaRes = await simulateRequest(
    {
      method: 'POST',
      url: '/api/media/upload',
      headers: { authorization: `Bearer ${token}` },
    },
    {
      originalName: 'duomo-sunset.jpg',
      mimeType: 'image/jpeg',
      size: 450000,
      altText: 'Atardecer sobre los tejados del Duomo de Milán',
    }
  );
  assert.equal(mediaRes.statusCode, 201);
  console.log(`   ✅ Image metadata saved to MinIO S3 bucket: ${mediaRes.body.data.url}`);

  // 8. Search Service - Multi-Entity Search
  console.log('\n9. [SEARCH-SERVICE via Gateway] GET /api/search?q=milan');
  const searchRes = await simulateRequest({ url: '/api/search?q=milan' });
  assert.equal(searchRes.statusCode, 200);
  assert.ok(searchRes.body.data.length > 0);
  console.log(`   ✅ Instant search found ${searchRes.body.data.length} matches:`);
  searchRes.body.data.forEach((item) => {
    console.log(`      - [${item.type.toUpperCase()}] "${item.title}" -> ${item.url}`);
  });

  // 9. Recommendations Service - Travel Copilot Engine
  console.log('\n10. [TRAVEL COPILOT via Gateway] POST /api/recommendations/plan');
  console.log('   Input prompt: "Quiero 2 días en Milán, presupuesto 120€/día, me gusta la comida local y evitar multitudes."');
  const copilotRes = await simulateRequest(
    { method: 'POST', url: '/api/recommendations/plan' },
    {
      destination: 'milan',
      totalDays: 2,
      budgetPerDay: 120,
      currency: 'EUR',
      interests: ['food', 'culture'],
      pace: 'balanced',
      avoidCrowds: true,
    }
  );
  assert.equal(copilotRes.statusCode, 200);
  const planData = copilotRes.body.data;
  assert.equal(planData.itinerary.totalDays, 2);
  assert.equal(planData.estimatedBudget.total, 240);
  assert.equal(planData.itinerary.days.length, 2);

  console.log(`   ✅ Plan generated: "${planData.itinerary.title}"`);
  console.log(`   💰 Presupuesto total calculado: ${planData.estimatedBudget.total}€ (${planData.estimatedBudget.perDay}€/día)`);
  planData.itinerary.days.forEach((day) => {
    console.log(`   📅 ${day.title} (${day.stops.length} paradas geolocalizadas):`);
    day.stops.forEach((stop) => {
      console.log(`      * [${stop.timeOfDay}] ${stop.name} (${stop.category}) - ${stop.notes}`);
    });
    console.log(`      ⚠️  Consejo anti-multitudes: ${day.crowdTips}`);
    console.log(`      ☔  Alternativa si llueve: ${day.weatherAlternatives}`);
  });

  const missingConsentRes = await simulateRequest(
    { method: 'POST', url: '/api/recommendations/plan-and-send' },
    {
      destination: 'milan',
      totalDays: 2,
      budgetPerDay: 120,
      currency: 'EUR',
      interests: ['food'],
      pace: 'balanced',
      email: 'traveler@example.com',
      itineraryConsent: false,
      newsletterOptIn: false,
      locale: 'es',
    }
  );
  assert.equal(missingConsentRes.statusCode, 400);
  assert.ok(missingConsentRes.body.errors.itineraryConsent);
  console.log('   ✅ Personalized itinerary requests require consent before storage or email');

  console.log('\n=============================================================');
  console.log('🎉 TODOS LOS TESTS END-TO-END HAN PASADO CON ÉXITO (100%)');
  console.log('=============================================================\n');
  process.exit(0);
}

runE2ETests().catch((err) => {
  console.error('❌ E2E Test Run Failed:', err);
  process.exit(1);
});
