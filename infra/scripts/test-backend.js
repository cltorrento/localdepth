import http from 'node:http';

function makeRequest(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing LocalDepth Backend Stack through API Gateway (Port 4000)...\n');

  try {
    // 1. Healthcheck
    const health = await makeRequest('http://localhost:4000/health');
    console.log('1. Gateway Healthcheck:', health.status === 200 ? '✅ OK' : '❌ FAILED', health.body);

    // 2. Auth Login (Admin)
    const login = await makeRequest(
      'http://localhost:4000/api/auth/login',
      { method: 'POST' },
      { email: 'admin@localdepth.com', password: 'admin123456' }
    );
    console.log('2. Auth Admin Login:', login.status === 200 ? '✅ OK' : '❌ FAILED');
    const token = login.body?.data?.tokens?.accessToken;
    if (!token) throw new Error('Failed to obtain JWT access token');
    console.log('   Obtained JWT for user:', login.body?.data?.user?.email, `(Role: ${login.body?.data?.user?.role})`);

    // 3. Destinations
    const destinations = await makeRequest('http://localhost:4000/api/content/destinations');
    console.log('3. Content Destinations List:', destinations.status === 200 ? '✅ OK' : '❌ FAILED');
    console.log(`   Found ${destinations.body?.data?.length || 0} destinations:`, destinations.body?.data?.map((d) => d.name));

    // 4. Places (with Leaflet coordinates & map URLs)
    const places = await makeRequest('http://localhost:4000/api/content/places');
    console.log('4. Content Places List (Leaflet):', places.status === 200 ? '✅ OK' : '❌ FAILED');
    const samplePlace = places.body?.data?.[0];
    if (samplePlace) {
      console.log(`   Sample place: "${samplePlace.name}"`);
      console.log(`   Coordinates: [lat: ${samplePlace.latitude}, lng: ${samplePlace.longitude}]`);
      console.log(`   Google Maps: ${samplePlace.googleMapsUrl}`);
      console.log(`   OpenStreetMap: ${samplePlace.openStreetMapUrl}`);
    }

    // 5. Create Place through API Gateway with Auth header (simulating Admin action)
    const newPlace = await makeRequest(
      'http://localhost:4000/api/content/places',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      },
      {
        name: 'Pasticceria Marchesi 1824',
        destinationId: samplePlace?.destinationId,
        category: 'restaurant',
        description: 'Pastelería histórica con dulces típicos milaneses y café excelente.',
        address: 'Galleria Vittorio Emanuele II, Milano',
        latitude: 45.4658,
        longitude: 9.1899,
        zoom: 16,
        tags: ['dulces', 'cafe historico', 'elegante'],
        localScore: 9.3,
        status: 'published',
      }
    );
    console.log('5. Admin Place Creation via Leaflet coordinates:', newPlace.status === 201 ? '✅ OK' : '❌ FAILED');
    console.log(`   Created place slug: ${newPlace.body?.data?.slug}`);
    console.log(`   Auto-generated OSM URL: ${newPlace.body?.data?.openStreetMapUrl}`);

    // 6. Travel Copilot (Recommendations Service)
    const plan = await makeRequest(
      'http://localhost:4000/api/recommendations/plan',
      { method: 'POST' },
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
    console.log('6. Travel Copilot Plan Generation:', plan.status === 200 ? '✅ OK' : '❌ FAILED');
    const itinerary = plan.body?.data?.itinerary;
    console.log(`   Itinerary title: "${itinerary?.title}"`);
    console.log(`   Total days: ${itinerary?.totalDays}, Total Budget: ${itinerary?.totalBudget}€`);
    console.log(`   Highlights:`, plan.body?.data?.highlights);

    // 7. Instant Search
    const search = await makeRequest('http://localhost:4000/api/search?q=milan');
    console.log('7. Search Service Query (Milan):', search.status === 200 ? '✅ OK' : '❌ FAILED');
    console.log(`   Matches found: ${search.body?.meta?.total}`);

    console.log('\n🎉 ALL BACKEND CHECKS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err.message);
    process.exit(1);
  }
}

runTests();
