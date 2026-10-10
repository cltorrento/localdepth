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

    // Push Body
    if (postBody) {
      const data = typeof postBody === 'string' ? postBody : JSON.stringify(postBody);
      req.emit('data', data);
    }
    req.emit('end');
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
  assert.ok(destRes.body.data.length >= 1);
  const milan = destRes.body.data.find((d) => d.slug === 'milan');
  assert.ok(milan);
  console.log(`   ✅ Retrieved ${destRes.body.data.length} destination(s): ${milan.name} (${milan.country})`);
  console.log(`   📌 Daily budget: ${milan.averageDailyBudget}€, Best time: ${milan.bestTimeToVisit}`);

  // 5. Content - Places List (Verifying Leaflet Data)
  console.log('\n5. [CONTENT-SERVICE via Gateway] GET /api/content/places?destinationId=' + milan.id);
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
  console.log('\n6. [CONTENT-SERVICE via Gateway] POST /api/content/places (Admin creates new place)');
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
  console.log('\n7. [MEDIA-SERVICE via Gateway] POST /api/media/upload');
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
  console.log('\n8. [SEARCH-SERVICE via Gateway] GET /api/search?q=milan');
  const searchRes = await simulateRequest({ url: '/api/search?q=milan' });
  assert.equal(searchRes.statusCode, 200);
  assert.ok(searchRes.body.data.length > 0);
  console.log(`   ✅ Instant search found ${searchRes.body.data.length} matches:`);
  searchRes.body.data.forEach((item) => {
    console.log(`      - [${item.type.toUpperCase()}] "${item.title}" -> ${item.url}`);
  });

  // 9. Recommendations Service - Travel Copilot Engine
  console.log('\n9. [TRAVEL COPILOT via Gateway] POST /api/recommendations/plan');
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

  console.log('\n=============================================================');
  console.log('🎉 TODOS LOS TESTS END-TO-END HAN PASADO CON ÉXITO (100%)');
  console.log('=============================================================\n');
  process.exit(0);
}

runE2ETests().catch((err) => {
  console.error('❌ E2E Test Run Failed:', err);
  process.exit(1);
});
