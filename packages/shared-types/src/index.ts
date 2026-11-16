export type UUID = string;

// -------------------------------------------------------------
// Common & API Response Types
// -------------------------------------------------------------
export type PublishStatus = 'draft' | 'published';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    [key: string]: any;
  };
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// -------------------------------------------------------------
// Destination Entity
// -------------------------------------------------------------
export type DestinationType = 'country' | 'region' | 'city';

export interface DestinationHighlight {
  name: string;
  description: string;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DestinationFood {
  name: string;
  imageUrl: string;
  ingredients: string[];
}

export interface DestinationGuideContent {
  headline?: string;
  introduction: string;
  gettingAround: string;
  suggestedDays: number;
  placesToVisit: DestinationHighlight[];
  typicalFoods: DestinationFood[];
  travelTips: string[];
  faqs: FAQ[];
}

export type SiteLocale = 'es' | 'en' | 'it' | 'de';
export type DestinationLocale = Exclude<SiteLocale, 'es'>;

export interface LocalizedDestinationContent {
  name: string;
  country: string;
  description: string;
  language?: string | null;
  bestTimeToVisit?: string | null;
  guide?: DestinationGuideContent | null;
}

export interface Destination {
  id: UUID;
  slug: string;
  name: string;
  type: DestinationType;
  parentId?: UUID | null;
  country: string;
  description: string;
  heroImageId?: UUID | null;
  heroImageUrl?: string | null;
  bestTimeToVisit?: string | null;
  currency?: string | null;
  language?: string | null;
  averageDailyBudget?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  guide?: DestinationGuideContent | null;
  translations?: Partial<Record<DestinationLocale, LocalizedDestinationContent>>;
  status: PublishStatus;
  createdAt: string;
  updatedAt: string;
}

export type DestinationCreateInput = Pick<Destination, 'name' | 'type' | 'country'> &
  Partial<Omit<Destination, 'id' | 'name' | 'type' | 'country' | 'createdAt' | 'updatedAt'>>;

// -------------------------------------------------------------
// Place Entity & Geolocation
// -------------------------------------------------------------
export type PlaceCategory =
  | 'attraction'
  | 'restaurant'
  | 'hotel'
  | 'transport'
  | 'neighborhood'
  | 'experience';

export interface PlaceLocation {
  latitude: number;
  longitude: number;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  googleMapsUrl: string;
  appleMapsUrl: string;
  openStreetMapUrl: string;
  zoom: number; // default: 15
}

export interface Place {
  id: UUID;
  slug: string;
  name: string;
  destinationId: UUID;
  category: PlaceCategory;
  description: string | Record<string, any>;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  zoom?: number | null;
  googleMapsUrl?: string | null;
  appleMapsUrl?: string | null;
  openStreetMapUrl?: string | null;
  priceLevel?: 1 | 2 | 3 | 4 | null;
  openingHours?: Record<string, any> | null;
  images: UUID[];
  imageUrls?: string[];
  tags: string[];
  affiliateId?: UUID | null;
  affiliateUrl?: string | null;
  status: PublishStatus;
  seoTitle?: string | null;
  seoDescription?: string | null;
  
  // LocalDepth Metrics
  localScore?: number | null; // 1-10
  valueScore?: number | null; // 1-10
  crowdLevel?: 'low' | 'moderate' | 'high' | null;
  bestTime?: string | null; // e.g. "early morning", "sunset"
  walkability?: boolean | null;

  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Guide Entity
// -------------------------------------------------------------
export type GuideType =
  | 'itinerary'
  | 'day-trip'
  | 'food'
  | 'budget'
  | 'transport'
  | 'general';

export interface FAQ {
  question: string;
  answer: string;
}

export interface Guide {
  id: UUID;
  slug: string;
  title: string;
  excerpt: string;
  content: string | Record<string, any>;
  destinationId: UUID;
  guideType: GuideType;
  durationDays?: number | null;
  estimatedBudget?: number | null;
  difficulty?: 'easy' | 'moderate' | 'hard' | null;
  heroImageId?: UUID | null;
  heroImageUrl?: string | null;
  images: UUID[];
  places: UUID[];
  faqs: FAQ[];
  related: UUID[];
  status: PublishStatus;
  seoTitle?: string | null;
  seoDescription?: string | null;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Itinerary & Day Plan Entities
// -------------------------------------------------------------
export interface ItineraryStop {
  placeId: UUID;
  name: string;
  category: PlaceCategory;
  estimatedMinutes?: number;
  timeOfDay: 'morning' | 'lunch' | 'afternoon' | 'evening' | 'night';
  notes?: string;
  latitude?: number;
  longitude?: number;
}

export interface ItineraryDay {
  dayNumber: number;
  title: string;
  summary: string;
  theme?: string;
  stops: ItineraryStop[];
  estimatedCost?: number;
  weatherAlternatives?: string;
  crowdTips?: string;
}

export interface Itinerary {
  id: UUID;
  slug: string;
  title: string;
  destinationId: UUID;
  totalDays: number;
  totalBudget?: number | null;
  summary: string;
  days: ItineraryDay[];
  guideId?: UUID | null;
  status: PublishStatus;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// Travel Copilot & Recommendations
// -------------------------------------------------------------
export interface TripPlannerPreferences {
  destination: string; // Destination name or slug
  totalDays: number;
  budgetPerDay?: number;
  currency?: string;
  interests: ('food' | 'culture' | 'nature' | 'architecture' | 'nightlife' | 'hidden_gems')[];
  pace: 'relaxed' | 'balanced' | 'intense';
  restrictions?: string[];
  avoidCrowds?: boolean;
}

export interface PersonalizedTripRequest extends TripPlannerPreferences {
  email: string;
  travelDate?: string | null;
  itineraryConsent: boolean;
  newsletterOptIn: boolean;
  locale: SiteLocale;
  company?: string;
}

export interface TripPlannerResponse {
  itinerary: Itinerary;
  destination: Partial<Destination>;
  estimatedBudget: {
    perDay: number;
    total: number;
    currency: string;
  };
  highlights: string[];
  rainAlternatives: string[];
  crowdAvoidanceTips: string[];
  relatedGuides: Partial<Guide>[];
}

export interface Recommendation {
  id: UUID;
  userId?: string | null;
  type: 'place' | 'guide' | 'itinerary';
  itemId: UUID;
  score: number;
  reason: string;
  item?: Place | Guide | Itinerary;
}

// -------------------------------------------------------------
// User & Auth
// -------------------------------------------------------------
export type UserRole = 'admin' | 'editor' | 'author' | 'brand';

export interface User {
  id: UUID;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: string | number;
}

export interface AuthSession {
  user: User;
  tokens: AuthTokens;
}

// -------------------------------------------------------------
// Media & Storage
// -------------------------------------------------------------
export interface MediaFile {
  id: UUID;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
  createdAt: string;
}
