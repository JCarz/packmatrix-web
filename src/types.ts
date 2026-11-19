export const TRIP_TYPES = ['weekend', 'international', 'domestic', 'beach', 'work', 'familyVisit'] as const;
export type TripType = (typeof TRIP_TYPES)[number];
export const TRIP_LABEL: Record<TripType, string> = {
  weekend: 'Weekend', international: 'International', domestic: 'Domestic',
  beach: 'Beach', work: 'Work', familyVisit: 'Family Visit',
};
export interface Category { id: string; name: string; sortOrder: number }
export interface Item {
  id: string; name: string; categoryId: string; quantity: number; notes: string;
  isAlwaysPacked: boolean; isOptional: boolean; tripTypes: TripType[]; destinations: string[];
}
export interface Trip {
  id: string; name: string; destination: string; startDate: string; endDate: string;
  tripType: TripType; isArchived: boolean;
}
export interface TripItem {
  id: string; tripId: string; itemId: string; isPacked: boolean; quantity: number; notes: string; wasManuallyAdded: boolean;
}
export interface Template {
  id: string; name: string; createdAt: string; items: { itemId: string; quantity: number; notes: string }[];
}
export interface State {
  categories: Category[]; items: Item[]; trips: Trip[]; checklist: TripItem[]; templates: Template[];
  lastBackupAt?: string;
}
