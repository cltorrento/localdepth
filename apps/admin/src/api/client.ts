const API_BASE = 'http://localhost:4000/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('localdepth_admin_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('localdepth_admin_token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('localdepth_admin_token');
}

async function request(path: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Error ${response.status}: ${response.statusText}`);
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getMe: () => request('/auth/me'),

  // Destinations
  getDestinations: () => request('/content/destinations'),
  getDestination: (idOrSlug: string) => request(`/content/destinations/${idOrSlug}`),
  createDestination: (data: any) => request('/content/destinations', { method: 'POST', body: JSON.stringify(data) }),
  updateDestination: (id: string, data: any) =>
    request(`/content/destinations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDestination: (id: string) => request(`/content/destinations/${id}`, { method: 'DELETE' }),

  // Places
  getPlaces: (params?: { destinationId?: string; category?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request(`/content/places${q ? `?${q}` : ''}`);
  },
  getPlace: (idOrSlug: string) => request(`/content/places/${idOrSlug}`),
  createPlace: (data: any) => request('/content/places', { method: 'POST', body: JSON.stringify(data) }),
  updatePlace: (id: string, data: any) =>
    request(`/content/places/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlace: (id: string) => request(`/content/places/${id}`, { method: 'DELETE' }),

  // Itineraries
  getItineraries: () => request('/content/itineraries'),
  createItinerary: (data: any) => request('/content/itineraries', { method: 'POST', body: JSON.stringify(data) }),

  // Media
  getMedia: () => request('/media'),
  uploadMedia: (data: any) => request('/media/upload', { method: 'POST', body: JSON.stringify(data) }),
};
