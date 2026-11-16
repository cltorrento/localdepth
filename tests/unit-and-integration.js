import assert from 'node:assert/strict';
import { generateMapUrls, slugify, calculateDistanceKm, formatCoordinates, translateContent } from '@localdepth/shared-utils';
import {
  validateAuthLogin,
  validateAuthRegister,
  validateDestination,
  validatePersonalizedTripInput,
  validatePlace,
  validateTripPlannerInput,
} from '@localdepth/validation';
import { MemoryStore } from '@localdepth/database';
import { posts } from '../apps/frontend/src/data/posts.ts';
import { getLocale, localizedUrl } from '../apps/frontend/src/i18n.ts';
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

console.log('Test 2: DeepL translation and protected content fields');
const previousDeepLKey = process.env.DEEPL_API_KEY;
const previousFetch = globalThis.fetch;
let deepLRequestCount = 0;
let simulateIncompleteBatch = false;
try {
  process.env.DEEPL_API_KEY = 'test-key';
  globalThis.fetch = async (url, options) => {
    deepLRequestCount += 1;
    assert.equal(url, 'https://api-free.deepl.com/v2/translate');
    assert.equal(options.headers.Authorization, 'DeepL-Auth-Key test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.target_lang, 'EN-US');
    if (simulateIncompleteBatch && body.text.length > 1) {
      return new Response(
        JSON.stringify({ translations: body.text.slice(0, 1).map((text) => ({ text: `translated:${text}` })) }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ translations: body.text.map((text) => ({ text: `translated:${text}` })) }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };
  const localized = await translateContent(
    {
      title: 'Hola',
      slug: 'hola',
      currency: 'EUR',
      imageUrl: 'https://example.com/photo.jpg',
      placeId: '123e4567-e89b-12d3-a456-426614174000',
      destinationId: '123e4567-e89b-12d3-a456-426614174001',
    },
    'en'
  );
  assert.equal(localized.title, 'translated:Hola');
  assert.equal(localized.slug, 'hola');
  assert.equal(localized.currency, 'EUR');
  assert.equal(localized.imageUrl, 'https://example.com/photo.jpg');
  assert.equal(localized.placeId, '123e4567-e89b-12d3-a456-426614174000');
  assert.equal(localized.destinationId, '123e4567-e89b-12d3-a456-426614174001');
  await translateContent({ title: 'Hola' }, 'en');
  assert.equal(deepLRequestCount, 1, 'Cached strings should not generate repeated API requests');
  simulateIncompleteBatch = true;
  const requestsBeforeIncompleteBatch = deepLRequestCount;
  const recoveredTranslation = await translateContent(
    { first: 'Texto uno', second: 'Texto dos', whitespace: '   ' },
    'en'
  );
  assert.equal(recoveredTranslation.first, 'translated:Texto uno');
  assert.equal(recoveredTranslation.second, 'translated:Texto dos');
  assert.equal(recoveredTranslation.whitespace, '   ');
  assert.equal(deepLRequestCount - requestsBeforeIncompleteBatch, 3, 'Incomplete batches should be retried as smaller batches');
  simulateIncompleteBatch = false;
  delete process.env.DEEPL_API_KEY;
  await assert.rejects(
    translateContent({ title: 'Texto aún no traducido' }, 'it'),
    /DEEPL_API_KEY/
  );
} finally {
  globalThis.fetch = previousFetch;
  if (previousDeepLKey === undefined) delete process.env.DEEPL_API_KEY;
  else process.env.DEEPL_API_KEY = previousDeepLKey;
}
console.log('  ✅ DeepL translations are cached and URLs, slugs, and currency codes are preserved');

console.log('Test 3: Language selection URLs');
assert.equal(getLocale('it'), 'it');
assert.equal(getLocale('fr'), 'es');
assert.equal(localizedUrl('/#cuaderno', 'en'), '/?lang=en#cuaderno');
assert.equal(localizedUrl('/viajes/milan/?lang=it', 'de'), '/viajes/milan/?lang=de');
assert.equal(localizedUrl('/viajes/milan/?lang=de', 'es'), '/viajes/milan/');
console.log('  ✅ Language links preserve page anchors and replace old locale parameters');

console.log('Test 4: Slugify & Distance Calculation');
assert.equal(slugify('Café & Trattoria de Milán!'), 'cafe-trattoria-de-milan');
const dist = calculateDistanceKm(45.464204, 9.189982, 45.449764, 9.180211);
assert.ok(dist > 1.5 && dist < 2.0, `Expected distance ~1.7km, got ${dist}km`);
console.log('  ✅ Slugify and Haversine distance calculations verified');

// -------------------------------------------------------------
// 2. Validation Test
// -------------------------------------------------------------
console.log('Test 5: Schema Validations');
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

const invalidPublishedCity = validateDestination({
  name: 'Copenhague',
  country: 'Dinamarca',
  type: 'city',
  status: 'published',
});
assert.equal(invalidPublishedCity.success, false);
assert.ok(invalidPublishedCity.errors?.guide);

const completeCityInput = {
  name: 'Copenhague',
  country: 'Dinamarca',
  type: 'city',
  description: 'Canales, diseño escandinavo y barrios llenos de vida.',
  heroImageUrl: 'https://images.unsplash.com/copenhague',
  bestTimeToVisit: 'Mayo a septiembre',
  currency: 'dkk',
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
    placesToVisit: Array.from({ length: 10 }, (_, index) => ({
      name: `Lugar ${index + 1}`,
      description: 'Un lugar destacado para conocer durante el viaje.',
      latitude: 55.6761,
      longitude: 12.5683,
    })),
    typicalFoods: [
      { name: 'Smørrebrød', imageUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836', ingredients: ['pan de centeno', 'pescado', 'mantequilla'] },
      { name: 'Frikadeller', imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1', ingredients: ['cerdo', 'cebolla', 'huevo'] },
      { name: 'Wienerbrød', imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb', ingredients: ['harina', 'mantequilla', 'azúcar'] },
      { name: 'Stegt flæsk', imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947', ingredients: ['cerdo', 'patata', 'perejil'] },
      { name: 'Rødgrød med fløde', imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777', ingredients: ['frutos rojos', 'azúcar', 'nata'] },
      { name: 'Flæskesteg', imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554', ingredients: ['cerdo', 'laurel', 'clavo'] },
    ],
    travelTips: ['Reserva con antelación.', 'Comprueba horarios antes de salir.'],
    faqs: [
      { question: '¿Cuántos días necesito?', answer: 'Tres días permiten conocer los principales barrios.' },
      { question: '¿Cuál es la mejor época?', answer: 'De mayo a septiembre suele haber días más largos.' },
    ],
  },
};
const ninePlaceCity = validateDestination({
  ...completeCityInput,
  guide: { ...completeCityInput.guide, placesToVisit: completeCityInput.guide.placesToVisit.slice(0, 9) },
});
assert.equal(ninePlaceCity.success, false);
assert.ok(ninePlaceCity.errors?.['guide.placesToVisit']);
const tenPlaceCity = validateDestination(completeCityInput);
assert.equal(tenPlaceCity.success, true);
assert.equal(tenPlaceCity.data?.currency, 'DKK');
const foodWithoutPhoto = validateDestination({
  ...completeCityInput,
  guide: {
    ...completeCityInput.guide,
    typicalFoods: [{ ...completeCityInput.guide.typicalFoods[0], imageUrl: '' }, ...completeCityInput.guide.typicalFoods.slice(1)],
  },
});
assert.equal(foodWithoutPhoto.success, false);
assert.ok(foodWithoutPhoto.errors?.['guide.typicalFoods.0.imageUrl']);
const foodWithoutIngredients = validateDestination({
  ...completeCityInput,
  guide: {
    ...completeCityInput.guide,
    typicalFoods: [{ ...completeCityInput.guide.typicalFoods[0], ingredients: [] }, ...completeCityInput.guide.typicalFoods.slice(1)],
  },
});
assert.equal(foodWithoutIngredients.success, false);
assert.ok(foodWithoutIngredients.errors?.['guide.typicalFoods.0.ingredients']);

assert.equal(posts.length, 20, 'All example city guides must have a matching homepage post');
for (const post of posts) {
  assert.ok(post.guide.introduction.length >= 40, `${post.slug} needs a travel introduction`);
  assert.ok(post.guide.gettingAround.length >= 20, `${post.slug} needs transport information`);
  assert.ok(post.guide.placesToVisit.length >= 10, `${post.slug} needs at least ten places`);
  assert.ok(post.guide.typicalFoods.length >= 6, `${post.slug} needs six typical foods`);
  assert.ok(post.guide.typicalFoods.every((food) => /^https?:\/\//.test(food.imageUrl)), `${post.slug} needs food photos`);
  assert.ok(post.guide.typicalFoods.every((food) => food.ingredients.length >= 2), `${post.slug} needs ingredients for every food`);
  assert.ok(post.guide.travelTips.length >= 2, `${post.slug} needs practical travel tips`);
  assert.ok(post.guide.faqs.length >= 2, `${post.slug} needs FAQs`);
}
console.log('  ✅ Published city guides require traveler information; all 20 examples are complete');

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
const personalizedTrip = validatePersonalizedTripInput({
  destination: 'milan',
  totalDays: 3,
  budgetPerDay: 120,
  currency: 'EUR',
  interests: ['food', 'culture'],
  pace: 'balanced',
  avoidCrowds: true,
  email: 'traveler@example.com',
  itineraryConsent: true,
  newsletterOptIn: false,
  locale: 'en',
});
assert.equal(personalizedTrip.success, true);
assert.equal(personalizedTrip.data?.newsletterOptIn, false);
assert.equal(personalizedTrip.data?.locale, 'en');
const missingTripConsent = validatePersonalizedTripInput({
  destination: 'milan',
  totalDays: 3,
  budgetPerDay: 120,
  interests: ['food'],
  pace: 'balanced',
  email: 'traveler@example.com',
  itineraryConsent: false,
});
assert.equal(missingTripConsent.success, false);
assert.ok(missingTripConsent.errors?.itineraryConsent);
assert.ok(missingTripConsent.errors?.newsletterOptIn === undefined);
const noTripInterest = validatePersonalizedTripInput({
  destination: 'milan',
  totalDays: 3,
  budgetPerDay: 120,
  interests: [],
  pace: 'balanced',
  email: 'traveler@example.com',
  itineraryConsent: true,
});
assert.equal(noTripInterest.success, false);
assert.ok(noTripInterest.errors?.interests);
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const pastTripDate = validatePersonalizedTripInput({
  destination: 'milan',
  totalDays: 3,
  budgetPerDay: 120,
  interests: ['food'],
  pace: 'balanced',
  email: 'traveler@example.com',
  itineraryConsent: true,
  travelDate: yesterday,
});
assert.equal(pastTripDate.success, false);
assert.ok(pastTripDate.errors?.travelDate);
console.log('  ✅ Travel Copilot input validation verified');

// -------------------------------------------------------------
// 3. Database & MemoryStore Test
// -------------------------------------------------------------
console.log('Test 6: Seed Data & Database Store');
const store = MemoryStore.getInstance();
assert.ok(store.destinations.size >= 1, 'Milán destination must be seeded');
assert.ok(store.places.size >= 3, 'Default places in Milán must be seeded');
const milan = Array.from(store.destinations.values()).find((d) => d.slug === 'milan');
assert.ok(milan);
assert.equal(milan.name, 'Milán');
assert.ok(milan.guide?.placesToVisit.length >= 10, 'Seed destination must have ten places to visit');
assert.ok(milan.guide?.typicalFoods.length >= 6, 'Seed destination must include six typical foods');
assert.ok(milan.guide?.typicalFoods.every((food) => /^https?:\/\//.test(food.imageUrl)), 'Seed food must include photos');
assert.ok(milan.guide?.typicalFoods.every((food) => food.ingredients.length >= 2), 'Seed food must include ingredients');

for (const slug of ['ciudad-de-mexico', 'san-salvador']) {
  const destination = Array.from(store.destinations.values()).find((item) => item.slug === slug);
  assert.ok(destination, `${slug} must be seeded as a published destination`);
  assert.equal(destination.status, 'published');
  assert.equal(destination.type, 'city');
  assert.ok(destination.guide?.placesToVisit.length >= 10, `${slug} must include at least ten places`);
  assert.ok(destination.guide?.typicalFoods.length >= 6, `${slug} must include six typical foods`);
  assert.ok(destination.guide?.typicalFoods.every((food) => food.ingredients.length >= 2), `${slug} foods must include ingredients`);
}

for (const post of posts) {
  const name = post.destination.split(',')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const managedDestination = Array.from(store.destinations.values()).find(
    (destination) => destination.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === name,
  );
  assert.ok(managedDestination, `${post.destination} must be editable through the content API`);
  assert.ok(managedDestination.heroImageUrl, `${post.destination} must have an editable cover image`);
}

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
console.log('Test 7: Auth Token Issuance & Verification');
const token = signJwt({ id: 'user-1', email: 'admin@localdepth.com', role: 'admin' });
assert.ok(typeof token === 'string' && token.split('.').length === 3);
const decoded = verifyJwt(token);
assert.equal(decoded.email, 'admin@localdepth.com');
assert.equal(decoded.role, 'admin');

const forgedToken = token.slice(0, -4) + 'abcd';
assert.equal(verifyJwt(forgedToken), null, 'Tampered token must be rejected');
console.log('  ✅ JWT generation and cryptographic signature verification working');

console.log('\n🎉 ALL 7 TEST SUITES PASSED! Phase 1 and Phase 2 implementations are verified.\n');
process.exit(0);
