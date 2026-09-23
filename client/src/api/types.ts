// Types mirroring the API responses (the DTOs built on the server).
// In a bigger project these would be shared from a common package or
// generated from an OpenAPI spec; for two apps, mirroring by hand is fine.

export type Role = 'seller' | 'buyer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface WeeklyRule {
  dayOfWeek: number; // 0 = Sunday
  startTime: string; // HH:MM
  endTime: string;
}

export interface BlackoutDate {
  date: string; // YYYY-MM-DD
  reason?: string;
}

export interface Availability {
  rules: WeeklyRule[];
  blackoutDates: BlackoutDate[];
}

export interface Listing {
  id: string;
  sellerId: string;
  sellerName?: string;
  title: string;
  description: string;
  address: string;
  city: string;
  priceCents: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  photoUrl: string | null;
  timezone: string;
  showingDurationMin: number;
  bufferMin: number;
  availableFrom: string;
  availableUntil: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface ListingWithAvailability extends Listing {
  availability: Availability;
}

export interface MyListing extends Listing {
  upcomingShowings: number;
}

export interface Slot {
  start: string; // ISO instant
  end: string;
}

export interface SearchResult {
  listing: Listing;
  totalSlots: number;
  slots: Slot[];
}

export interface Showing {
  id: string;
  startsAt: string;
  endsAt: string;
  status: 'confirmed' | 'cancelled';
  notes: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancelledBy: Role | null;
  listing: { id: string; title: string; address: string; city: string; timezone: string; sellerName: string };
  buyer: { id: string; name: string; email: string };
}
