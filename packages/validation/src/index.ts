import type { DestinationType, PlaceCategory, PublishStatus, UserRole } from '@localdepth/shared-types';

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
export function validateDestination(input: any): ValidationResult<any> {
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

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      ...input,
      name: input.name.trim(),
      status: (input.status === 'published' ? 'published' : 'draft') as PublishStatus,
    },
  };
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
export function validateTripPlannerInput(input: any): ValidationResult<any> {
  const errors: Record<string, string> = {};
  if (!input.destination || typeof input.destination !== 'string' || input.destination.trim().length === 0) {
    errors.destination = 'Destination is required';
  }
  const totalDays = Number(input.totalDays);
  if (!totalDays || totalDays < 1 || totalDays > 30) {
    errors.totalDays = 'Total days must be between 1 and 30';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      destination: input.destination.trim(),
      totalDays: Math.round(totalDays),
      budgetPerDay: input.budgetPerDay ? Number(input.budgetPerDay) : 100,
      currency: input.currency || 'EUR',
      interests: Array.isArray(input.interests) ? input.interests : ['food', 'culture'],
      pace: ['relaxed', 'balanced', 'intense'].includes(input.pace) ? input.pace : 'balanced',
      avoidCrowds: Boolean(input.avoidCrowds),
    },
  };
}
