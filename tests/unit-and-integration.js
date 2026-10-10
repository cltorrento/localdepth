import assert from 'node:assert/strict';
import { generateMapUrls, slugify, calculateDistanceKm, formatCoordinates } from '@localdepth/shared-utils';
import { validateAuthLogin, validateAuthRegister, validateDestination, validatePlace, validateTripPlannerInput } from '@localdepth/validation';
import { MemoryStore } from '@localdepth/database';
import { signJwt, verifyJwt } from '../services/auth-service/src/index.ts';

console.log('🧪 Running LocalDepth Core & Microservices Automated Test Suite...\n');

// -------------------------------------------------------------
// 1. Shared Utilities Test
// -------------------------------------------------------------
console.log('Test 1: Map URLs Generation (Leaflet & External Providers)');
const mapUrls = generateMapUrls(45.464204, 9.189982, 16);
assert.equal(mapUrls.googleMapsUrl, 'https://www.google.com/maps?q=45.464204,9.189982');
assert.equal(mapUrls.appleMapsUrl, 'https://maps.apple.com/?q=45.464204,9.189982');
assert.equal(
  mapUrls.openStreetMapUrl,
  'https://www.openstreetmap.org/?mlat=45.464204&mlon=9.189982#map=16/45.464204/9.189982'
);
assert.equal(formatCoordinates(45.464204, 9.189982), '45.464204, 9.189982');
console.log('  ✅ Map URLs generated strictly matching section 21.2 & Leaflet specs');

console.log('Test 2: Slugify & Distance Calculation');
assert.equal(slugify('Café & Trattoria de Milán!'), 'cafe-trattoria-de-milan');
const dist = calculateDistanceKm(45.464204, 9.189982, 45.449764, 9.180211);
assert.ok(dist > 1.5 && dist < 2.0, `Expected distance ~1.7km, got ${dist}km`);
console.log('  ✅ Slugify and Haversine distance calculations verified');

// -------------------------------------------------------------
// 2. Validation Test
// -------------------------------------------------------------
console.log('Test 3: Schema Validations');
const invalidPlace = validatePlace({ name: '', destinationId: null, category: 'unknown' });
assert.equal(invalidPlace.success, false);
assert.ok(invalidPlace.errors?.name);
assert.ok(invalidPlace.errors?.destinationId);
assert.ok(invalidPlace.errors?.category);

const validPlace = validatePlace({
  name: 'Trattoria Madonnina',
  destinationId: '22222222-2222-4222-a222-222222222222',
  category: 'restaurant',
  latitude: 45.449764,
  longitude: 9.180211,
  zoom: 16,
});
assert.equal(validPlace.success, true);
assert.equal(validPlace.data?.zoom, 16);
console.log('  ✅ Place validation correctly enforces fields and coordinates');

const validPlanInput = validateTripPlannerInput({
  destination: 'Milán',
  totalDays: 3,
  budgetPerDay: 120,
  interests: ['food', 'culture'],
  pace: 'balanced',
  avoidCrowds: true,
});
assert.equal(validPlanInput.success, true);
assert.equal(validPlanInput.data?.totalDays, 3);
assert.equal(validPlanInput.data?.avoidCrowds, true);
console.log('  ✅ Travel Copilot input validation verified');

// -------------------------------------------------------------
// 3. Database & MemoryStore Test
// -------------------------------------------------------------
console.log('Test 4: Seed Data & Database Store');
const store = MemoryStore.getInstance();
assert.ok(store.destinations.size >= 1, 'Milán destination must be seeded');
assert.ok(store.places.size >= 3, 'Default places in Milán must be seeded');
const milan = Array.from(store.destinations.values()).find((d) => d.slug === 'milan');
assert.ok(milan);
assert.equal(milan.name, 'Milán');

const placesInMilan = Array.from(store.places.values()).filter((p) => p.destinationId === milan.id);
assert.equal(placesInMilan.length, 3);
for (const p of placesInMilan) {
  assert.ok(p.latitude !== null && p.longitude !== null, 'Places must have Leaflet coordinates');
  assert.ok(p.googleMapsUrl && p.openStreetMapUrl, 'Places must have computed map links');
}
console.log(`  ✅ Verified ${placesInMilan.length} places in Milán with full Leaflet metadata`);

// -------------------------------------------------------------
// 4. Security & JWT Auth Test
// -------------------------------------------------------------
console.log('Test 5: Auth Token Issuance & Verification');
const token = signJwt({ id: 'user-1', email: 'admin@localdepth.com', role: 'admin' });
assert.ok(typeof token === 'string' && token.split('.').length === 3);
const decoded = verifyJwt(token);
assert.equal(decoded.email, 'admin@localdepth.com');
assert.equal(decoded.role, 'admin');

const forgedToken = token.slice(0, -4) + 'abcd';
assert.equal(verifyJwt(forgedToken), null, 'Tampered token must be rejected');
console.log('  ✅ JWT generation and cryptographic signature verification working');

console.log('\n🎉 ALL 5 TEST SUITES PASSED! Phase 1 and Phase 2 implementations are verified.\n');
process.exit(0);
