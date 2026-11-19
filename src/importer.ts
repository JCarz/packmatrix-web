import { TRIP_TYPES, type Category, type Item, type State, type Template, type Trip, type TripItem, type TripType } from './types';

export interface SkippedImportRows {
  items: number;
  checklist: number;
  templateItems: number;
}

export interface ImportResult { state: State; skipped: SkippedImportRows }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const string = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const number = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const bool = (value: unknown, fallback = false) => typeof value === 'boolean' ? value : fallback;
const id = (value: unknown) => typeof value === 'string' && value.trim() ? value : null;
const quantity = (value: unknown) => Math.max(1, Math.round(number(value, 1)));
const tripType = (value: unknown): TripType => TRIP_TYPES.includes(value as TripType) ? value as TripType : 'weekend';
const tripTypes = (value: unknown): TripType[] => Array.isArray(value)
  ? value.filter((type): type is TripType => TRIP_TYPES.includes(type as TripType)) : [];
const strings = (value: unknown) => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

function arrays(value: unknown): Record<string, unknown[]> {
  if (!isRecord(value) || !['categories', 'items', 'trips', 'checklist', 'templates'].every((key) => Array.isArray(value[key]))) {
    throw new Error('Invalid backup shape');
  }
  return value as Record<string, unknown[]>;
}

export function importState(value: unknown): ImportResult {
  const source = arrays(value);
  const categories: Category[] = source.categories.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    const categoryId = id(entry.id), name = id(entry.name);
    if (!categoryId || !name) return [];
    return [{ id: categoryId, name, sortOrder: number(entry.sortOrder, index) }];
  });
  const categoryIds = new Set(categories.map((category) => category.id));
  const skipped: SkippedImportRows = { items: 0, checklist: 0, templateItems: 0 };
  const items: Item[] = [];
  for (const entry of source.items) {
    if (!isRecord(entry)) {
      skipped.items++;
      continue;
    }
    const itemId = id(entry.id), name = id(entry.name), categoryId = id(entry.categoryId);
    if (!itemId || !name || !categoryId || !categoryIds.has(categoryId)) { skipped.items++; continue; }
    items.push({
      id: itemId, name, categoryId, quantity: quantity(entry.quantity), notes: string(entry.notes),
      isAlwaysPacked: bool(entry.isAlwaysPacked), isOptional: bool(entry.isOptional), tripTypes: tripTypes(entry.tripTypes), destinations: strings(entry.destinations),
    });
  }
  const itemIds = new Set(items.map((item) => item.id));
  const trips: Trip[] = source.trips.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const tripId = id(entry.id), name = id(entry.name), startDate = id(entry.startDate), endDate = id(entry.endDate);
    if (!tripId || !name || !startDate || !endDate) return [];
    return [{
      id: tripId, name, destination: string(entry.destination), startDate, endDate,
      tripType: tripType(entry.tripType), isArchived: bool(entry.isArchived),
    }];
  });
  const tripIds = new Set(trips.map((trip) => trip.id));
  const checklist: TripItem[] = [];
  for (const entry of source.checklist) {
    if (!isRecord(entry)) {
      skipped.checklist++;
      continue;
    }
    const rowId = id(entry.id), rowTripId = id(entry.tripId), rowItemId = id(entry.itemId);
    if (!rowId || !rowTripId || !rowItemId || !tripIds.has(rowTripId) || !itemIds.has(rowItemId)) { skipped.checklist++; continue; }
    checklist.push({
      id: rowId, tripId: rowTripId, itemId: rowItemId, isPacked: bool(entry.isPacked), quantity: quantity(entry.quantity),
      notes: string(entry.notes), wasManuallyAdded: bool(entry.wasManuallyAdded),
    });
  }
  const templates: Template[] = source.templates.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const templateId = id(entry.id), name = id(entry.name);
    if (!templateId || !name) return [];
    const templateItems: Template['items'] = [];
    for (const row of Array.isArray(entry.items) ? entry.items : []) {
      if (!isRecord(row)) {
        skipped.templateItems++;
        continue;
      }
      const itemId = id(row.itemId);
      if (!itemId || !itemIds.has(itemId)) { skipped.templateItems++; continue; }
      templateItems.push({ itemId, quantity: quantity(row.quantity), notes: string(row.notes) });
    }
    return [{ id: templateId, name, createdAt: string(entry.createdAt, new Date(0).toISOString()), items: templateItems }];
  });
  return { state: { categories, items, trips, checklist, templates }, skipped };
}
