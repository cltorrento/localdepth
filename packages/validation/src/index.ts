import type {
  DestinationCreateInput,
  DestinationGuideContent,
  DestinationType,
  PlaceCategory,
  PersonalizedTripRequest,
  PublishStatus,
  SiteLocale,
  TripPlannerPreferences,
  UserRole,
} from '@localdepth/shared-types';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

// -------------------------------------------------------------
// Auth Validations
// -------------------------------------------------------------
export function validateAuthRegister(input: any): ValidationResult<{
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}> {
  const errors: Record<string, string> = {};
  if (!input.email || typeof input.email !== 'string' || !/^\S+@\S+\.\S+$/.test(input.email)) {
    errors.email = 'Valid email is required';
  }
  if (!input.password || typeof input.password !== 'string' || input.password.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }
  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    errors.name = 'Name is required';
  }
  const allowedRoles: UserRole[] = ['admin', 'editor', 'author', 'brand'];
  if (input.role && !allowedRoles.includes(input.role)) {
    errors.role = `Role must be one of: ${allowedRoles.join(', ')}`;
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      email: input.email.trim().toLowerCase(),
      password: input.password,
      name: input.name.trim(),
      role: input.role || 'editor',
    },
  };
}

export function validateAuthLogin(input: any): ValidationResult<{ email: string; password: string }> {
  const errors: Record<string, string> = {};
  if (!input.email || typeof input.email !== 'string') {
    errors.email = 'Email is required';
  }
  if (!input.password || typeof input.password !== 'string') {
    errors.password = 'Password is required';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      email: input.email.trim().toLowerCase(),
      password: input.password,
    },
  };
}

// -------------------------------------------------------------
// Destination Validations
// -------------------------------------------------------------
export function validateDestination(input: any): ValidationResult<DestinationCreateInput> {
  const errors: Record<string, string> = {};
  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    errors.name = 'Destination name is required';
  }
  const validTypes: DestinationType[] = ['country', 'region', 'city'];
  if (!input.type || !validTypes.includes(input.type)) {
    errors.type = 'Type must be country, region, or city';
  }
  if (!input.country || typeof input.country !== 'string') {
    errors.country = 'Country is required';
  }

  let guide: DestinationGuideContent | undefined;
  if (input.guide !== undefined && input.guide !== null) {
    const candidate = input.guide;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      errors.guide = 'Guide content must be an object';
    } else {
      if (typeof candidate.headline !== 'string' || candidate.headline.trim().length === 0) {
        errors['guide.headline'] = 'Guide headline is required';
      }
      if (typeof candidate.introduction !== 'string' || candidate.introduction.trim().length < 40) {
        errors['guide.introduction'] = 'Introduction must contain at least 40 characters';
      }
      if (typeof candidate.gettingAround !== 'string' || candidate.gettingAround.trim().length < 20) {
        errors['guide.gettingAround'] = 'Getting around information must contain at least 20 characters';
      }
      const suggestedDays = Number(candidate.suggestedDays);
      if (!Number.isInteger(suggestedDays) || suggestedDays < 1 || suggestedDays > 30) {
        errors['guide.suggestedDays'] = 'Suggested duration must be between 1 and 30 days';
      }
      if (!Array.isArray(candidate.placesToVisit) || candidate.placesToVisit.length < 10) {
        errors['guide.placesToVisit'] = 'Add at least ten places to visit';
      } else {
        candidate.placesToVisit.forEach((place: any, index: number) => {
          if (!place || typeof place.name !== 'string' || place.name.trim().length === 0) {
            errors[`guide.placesToVisit.${index}.name`] = 'Place name is required';
          }
          if (!place || typeof place.description !== 'string' || place.description.trim().length < 20) {
            errors[`guide.placesToVisit.${index}.description`] = 'Place description must contain at least 20 characters';
          }
          for (const coordinate of ['latitude', 'longitude'] as const) {
            const value = Number(place?.[coordinate]);
            const minimum = coordinate === 'latitude' ? -90 : -180;
            const maximum = coordinate === 'latitude' ? 90 : 180;
            if (place?.[coordinate] === '' || !Number.isFinite(value) || value < minimum || value > maximum) {
              errors[`guide.placesToVisit.${index}.${coordinate}`] =
                `${coordinate} must be between ${minimum} and ${maximum}`;
            }
          }
          if (place?.imageUrl && !isHttpUrl(place.imageUrl)) {
            errors[`guide.placesToVisit.${index}.imageUrl`] = 'Place image must be an HTTP or HTTPS URL';
          }
        });
      }
      if (!Array.isArray(candidate.typicalFoods) || candidate.typicalFoods.length < 6) {
        errors['guide.typicalFoods'] = 'Add at least six typical foods with photos and ingredients';
      } else {
        candidate.typicalFoods.forEach((food: any, index: number) => {
          if (!food || !isNonEmptyString(food.name)) {
            errors[`guide.typicalFoods.${index}.name`] = 'Food name is required';
          }
          if (!food || !isHttpUrl(food.imageUrl)) {
            errors[`guide.typicalFoods.${index}.imageUrl`] = 'Food photo must be an HTTP or HTTPS URL';
          }
          if (
            !food ||
            !Array.isArray(food.ingredients) ||
            food.ingredients.filter(isNonEmptyString).length < 2 ||
            !food.ingredients.every(isNonEmptyString)
          ) {
            errors[`guide.typicalFoods.${index}.ingredients`] = 'Add at least two ingredients';
          }
        });
      }
      if (!Array.isArray(candidate.travelTips) || candidate.travelTips.filter(isNonEmptyString).length < 2) {
        errors['guide.travelTips'] = 'Add at least two practical travel tips';
      }
      if (!Array.isArray(candidate.faqs) || candidate.faqs.length < 2) {
        errors['guide.faqs'] = 'Add at least two frequently asked questions';
      } else {
        candidate.faqs.forEach((faq: any, index: number) => {
          if (!faq || !isNonEmptyString(faq.question)) {
            errors[`guide.faqs.${index}.question`] = 'FAQ question is required';
          }
          if (!faq || !isNonEmptyString(faq.answer)) {
            errors[`guide.faqs.${index}.answer`] = 'FAQ answer is required';
          }
        });
      }

      if (
        typeof candidate.headline === 'string' &&
        candidate.headline.trim() &&
        typeof candidate.introduction === 'string' &&
        candidate.introduction.trim().length >= 40 &&
        typeof candidate.gettingAround === 'string' &&
        candidate.gettingAround.trim().length >= 20 &&
        Number.isInteger(Number(candidate.suggestedDays)) &&
        Number(candidate.suggestedDays) >= 1 &&
        Number(candidate.suggestedDays) <= 30 &&
        Array.isArray(candidate.placesToVisit) &&
        candidate.placesToVisit.length >= 10 &&
        candidate.placesToVisit.every(
          (place: any) =>
            place &&
            isNonEmptyString(place.name) &&
            isNonEmptyString(place.description) &&
            Number.isFinite(Number(place.latitude)) &&
            Number.isFinite(Number(place.longitude)) &&
            (!place.imageUrl || isHttpUrl(place.imageUrl))
        ) &&
        Array.isArray(candidate.typicalFoods) &&
        candidate.typicalFoods.length >= 6 &&
        candidate.typicalFoods.every(
          (food: any) =>
            food &&
            isNonEmptyString(food.name) &&
            isHttpUrl(food.imageUrl) &&
            Array.isArray(food.ingredients) &&
            food.ingredients.filter(isNonEmptyString).length >= 2 &&
            food.ingredients.every(isNonEmptyString)
        ) &&
        Array.isArray(candidate.travelTips) &&
        candidate.travelTips.filter(isNonEmptyString).length >= 2 &&
        candidate.travelTips.every(isNonEmptyString) &&
        Array.isArray(candidate.faqs) &&
        candidate.faqs.length >= 2 &&
        candidate.faqs.every(
          (faq: any) => faq && isNonEmptyString(faq.question) && isNonEmptyString(faq.answer)
        )
      ) {
        guide = {
          headline: candidate.headline.trim(),
          introduction: candidate.introduction.trim(),
          gettingAround: candidate.gettingAround.trim(),
          suggestedDays: Number(candidate.suggestedDays),
          placesToVisit: candidate.placesToVisit.map((place: any) => ({
            name: place.name.trim(),
            description: place.description.trim(),
            imageUrl: typeof place.imageUrl === 'string' && place.imageUrl.trim() ? place.imageUrl.trim() : null,
            latitude: Number(place.latitude),
            longitude: Number(place.longitude),
          })),
          typicalFoods: candidate.typicalFoods.map(
            (food: { name: string; imageUrl: string; ingredients: string[] }) => ({
              name: food.name.trim(),
              imageUrl: food.imageUrl.trim(),
              ingredients: food.ingredients.map((ingredient) => ingredient.trim()),
            })
          ),
          travelTips: candidate.travelTips.map((tip: string) => tip.trim()).filter(Boolean),
          faqs: candidate.faqs.map((faq: { question: string; answer: string }) => ({
            question: faq.question.trim(),
            answer: faq.answer.trim(),
          })),
        };
      }
    }
  }

  if (input.type === 'city' && input.status === 'published') {
    if (!guide) errors.guide = 'A complete travel guide is required to publish a city';
    if (!isHttpUrl(input.heroImageUrl)) errors.heroImageUrl = 'A valid cover image URL is required';
    if (!isNonEmptyString(input.description) || input.description.trim().length < 20) {
      errors.description = 'A city summary must contain at least 20 characters';
    }
    if (!isNonEmptyString(input.bestTimeToVisit)) errors.bestTimeToVisit = 'Best time to visit is required';
    if (!isNonEmptyString(input.currency) || !/^[A-Z]{3}$/i.test(input.currency.trim())) {
      errors.currency = 'Currency must be a three-letter ISO code';
    }
    if (!isNonEmptyString(input.language)) errors.language = 'Language is required';
    if (!Number.isFinite(Number(input.averageDailyBudget)) || Number(input.averageDailyBudget) <= 0) {
      errors.averageDailyBudget = 'Daily budget must be greater than zero';
    }
    for (const coordinate of ['latitude', 'longitude'] as const) {
      const value = Number(input[coordinate]);
      const minimum = coordinate === 'latitude' ? -90 : -180;
      const maximum = coordinate === 'latitude' ? 90 : 180;
      if (input[coordinate] === '' || !Number.isFinite(value) || value < minimum || value > maximum) {
        errors[coordinate] = `${coordinate} must be between ${minimum} and ${maximum}`;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      ...input,
      name: input.name.trim(),
      country: input.country.trim(),
      currency: typeof input.currency === 'string' ? input.currency.trim().toUpperCase() : input.currency,
      description: typeof input.description === 'string' ? input.description.trim() : '',
      averageDailyBudget:
        input.averageDailyBudget === '' || input.averageDailyBudget === undefined
          ? null
          : Number(input.averageDailyBudget),
      latitude:
        input.latitude === '' || input.latitude === undefined ? null : Number(input.latitude),
      longitude:
        input.longitude === '' || input.longitude === undefined ? null : Number(input.longitude),
      guide,
      status: (input.status === 'published' ? 'published' : 'draft') as PublishStatus,
    },
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttpUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// Place Validations
// -------------------------------------------------------------
export function validatePlace(input: any): ValidationResult<any> {
  const errors: Record<string, string> = {};
  if (!input.name || typeof input.name !== 'string' || input.name.trim().length === 0) {
    errors.name = 'Place name is required';
  }
  if (!input.destinationId || typeof input.destinationId !== 'string') {
    errors.destinationId = 'Associated destinationId is required';
  }
  const validCategories: PlaceCategory[] = [
    'attraction',
    'restaurant',
    'hotel',
    'transport',
    'neighborhood',
    'experience',
  ];
  if (!input.category || !validCategories.includes(input.category)) {
    errors.category = `Category must be one of: ${validCategories.join(', ')}`;
  }

  if (input.latitude !== undefined && input.latitude !== null) {
    const lat = Number(input.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.latitude = 'Latitude must be between -90 and 90';
    }
  }

  if (input.longitude !== undefined && input.longitude !== null) {
    const lng = Number(input.longitude);
    if (isNaN(lng) || lng < -180 || lng > 180) {
      errors.longitude = 'Longitude must be between -180 and 180';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      ...input,
      name: input.name.trim(),
      latitude: input.latitude ? Number(input.latitude) : null,
      longitude: input.longitude ? Number(input.longitude) : null,
      zoom: input.zoom ? Number(input.zoom) : 15,
      status: (input.status === 'published' ? 'published' : 'draft') as PublishStatus,
    },
  };
}

// -------------------------------------------------------------
// Travel Copilot Query Validation
// -------------------------------------------------------------
type ValidatedTripPlannerPreferences = Omit<
  TripPlannerPreferences,
  'budgetPerDay' | 'currency' | 'avoidCrowds'
> & Required<Pick<TripPlannerPreferences, 'budgetPerDay' | 'currency' | 'avoidCrowds'>>;

export function validateTripPlannerInput(input: any): ValidationResult<ValidatedTripPlannerPreferences> {
  const errors: Record<string, string> = {};
  if (!input.destination || typeof input.destination !== 'string' || input.destination.trim().length === 0) {
    errors.destination = 'Destination is required';
  }
  const totalDays = Number(input.totalDays);
  if (!totalDays || totalDays < 1 || totalDays > 30) {
    errors.totalDays = 'Total days must be between 1 and 30';
  }
  const interests = Array.isArray(input.interests) ? input.interests : ['food', 'culture'];
  const allowedInterests = ['food', 'culture', 'nature', 'architecture', 'nightlife', 'hidden_gems'];
  if (interests.length === 0 || interests.some((interest) => !allowedInterests.includes(interest))) {
    errors.interests = 'Choose at least one valid travel interest';
  }
  const budgetPerDay = input.budgetPerDay === undefined ? 100 : Number(input.budgetPerDay);
  if (!Number.isFinite(budgetPerDay) || budgetPerDay < 1 || budgetPerDay > 1000000) {
    errors.budgetPerDay = 'Daily budget must be between 1 and 1,000,000';
  }
  const currency = input.currency === undefined ? 'EUR' : input.currency;
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
    errors.currency = 'Currency must be a three-letter code';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      destination: input.destination.trim(),
      totalDays: Math.round(totalDays),
      budgetPerDay,
      currency,
      interests,
      pace: ['relaxed', 'balanced', 'intense'].includes(input.pace) ? input.pace : 'balanced',
      avoidCrowds: Boolean(input.avoidCrowds),
    },
  };
}

export function validatePersonalizedTripInput(input: any): ValidationResult<PersonalizedTripRequest> {
  const errors: Record<string, string> = {};
  const base = validateTripPlannerInput(input);
  Object.assign(errors, base.errors || {});

  if (!input.email || typeof input.email !== 'string' || input.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.email = 'Enter a valid email address';
  }
  if (input.itineraryConsent !== true) {
    errors.itineraryConsent = 'Consent is required to save and email the itinerary';
  }
  if (input.newsletterOptIn !== undefined && typeof input.newsletterOptIn !== 'boolean') {
    errors.newsletterOptIn = 'Newsletter preference must be boolean';
  }
  if (
    !Array.isArray(input.interests) ||
    input.interests.length === 0 ||
    input.interests.some((interest) => !['food', 'culture', 'nature', 'architecture', 'nightlife', 'hidden_gems'].includes(interest))
  ) {
    errors.interests = 'Choose at least one valid travel interest';
  }
  if (input.company && typeof input.company === 'string' && input.company.trim()) {
    errors.company = 'Invalid request';
  }

  if (!['relaxed', 'balanced', 'intense'].includes(input.pace)) {
    errors.pace = 'Choose a valid travel pace';
  }

  let travelDate: string | null = null;
  if (input.travelDate) {
    const parsedDate = new Date(`${input.travelDate}T00:00:00.000Z`);
    if (
      typeof input.travelDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.travelDate) ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== input.travelDate
    ) {
      errors.travelDate = 'Enter a valid travel date';
    } else if (input.travelDate < new Date().toISOString().slice(0, 10)) {
      errors.travelDate = 'Travel date cannot be in the past';
    } else {
      travelDate = input.travelDate;
    }
  }

  const locale = (['es', 'en', 'it', 'de'].includes(input.locale) ? input.locale : 'es') as SiteLocale;
  if (input.locale !== undefined && locale !== input.locale) {
    errors.locale = 'Choose a supported language';
  }
  if (Object.keys(errors).length > 0 || !base.success || !base.data) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      ...base.data,
      email: input.email.trim().toLowerCase(),
      travelDate,
      itineraryConsent: true,
      newsletterOptIn: input.newsletterOptIn === true,
      locale,
    },
  };
}
