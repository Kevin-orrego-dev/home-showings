import { api } from './client';
import type {
  Availability,
  ListingWithAvailability,
  MyListing,
  Role,
  SearchResult,
  Showing,
  Slot,
  User,
} from './types';

// Every API call lives here, typed. Components call `authApi.login(...)`,
// never raw URLs, so if an endpoint changes there's exactly one place to update.

export const authApi = {
  me: () => api.get<{ user: User }>('/auth/me').then((r) => r.data.user),
  login: (email: string, password: string) =>
    api.post<{ user: User }>('/auth/login', { email, password }).then((r) => r.data.user),
  register: (data: { name: string; email: string; password: string; role: Role }) =>
    api.post<{ user: User }>('/auth/register', data).then((r) => r.data.user),
  logout: () => api.post('/auth/logout'),
};

export type ListingInput = Omit<
  ListingWithAvailability,
  'id' | 'sellerId' | 'sellerName' | 'createdAt' | 'availability'
> & { availability?: Availability };

export const listingsApi = {
  mine: () => api.get<{ listings: MyListing[] }>('/listings/mine').then((r) => r.data.listings),
  get: (id: string) => api.get<{ listing: ListingWithAvailability }>(`/listings/${id}`).then((r) => r.data.listing),
  create: (data: ListingInput) =>
    api.post<{ listing: ListingWithAvailability }>('/listings', data).then((r) => r.data.listing),
  update: (id: string, data: Partial<ListingInput>) =>
    api.patch<{ listing: ListingWithAvailability }>(`/listings/${id}`, data).then((r) => r.data.listing),
  setAvailability: (id: string, data: Availability) =>
    api.put<{ availability: Availability }>(`/listings/${id}/availability`, data).then((r) => r.data.availability),
  remove: (id: string) => api.delete(`/listings/${id}`),
  slots: (id: string, range?: { from: string; to: string }) =>
    api.get<{ slots: Slot[] }>(`/listings/${id}/slots`, { params: range }).then((r) => r.data.slots),
};

export interface SearchInput {
  windows: { start: string; end: string }[];
  city?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  minBedrooms?: number;
}

export const searchApi = {
  search: (input: SearchInput) =>
    api.post<{ results: SearchResult[] }>('/search', input).then((r) => r.data.results),
};

export const showingsApi = {
  list: (scope: 'upcoming' | 'past' | 'all' = 'upcoming') =>
    api.get<{ showings: Showing[] }>('/showings', { params: { scope } }).then((r) => r.data.showings),
  book: (listingId: string, startsAt: string, notes?: string) =>
    api.post<{ showing: Showing }>('/showings', { listingId, startsAt, notes }).then((r) => r.data.showing),
  cancel: (id: string) => api.post<{ showing: Showing }>(`/showings/${id}/cancel`).then((r) => r.data.showing),
};
