// Port of PackingRuleEngine.swift + ViewHelpers.swift. Pure functions, no UI.
import type { Category, Item, Template, Trip, TripItem } from './types';

export const uid = () => crypto.randomUUID();
export const norm = (s: string) => s.trim().toLowerCase();
export const splitList = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
export const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

const mk = (tripId: string, itemId: string, o: Partial<TripItem> = {}): TripItem => ({
  id: uid(), tripId, itemId, isPacked: false, quantity: 1, notes: '', wasManuallyAdded: false, ...o,
});
const seenIds = (rows: TripItem[], tripId: string) => new Set(rows.filter((r) => r.tripId === tripId).map((r) => r.itemId));

export const matches = (item: Item, trip: Trip) => item.isAlwaysPacked || item.tripTypes.includes(trip.tripType);

/** Rows to ADD for items whose rules match the trip (skips ones already on the trip). */
export function generateChecklist(trip: Trip, items: Item[], existing: TripItem[]): TripItem[] {
  const seen = seenIds(existing, trip.id);
  const out: TripItem[] = [];
  for (const i of items) {
    if (!matches(i, trip) || seen.has(i.id)) continue;
    seen.add(i.id);
    out.push(mk(trip.id, i.id, { quantity: i.quantity, notes: i.notes }));
  }
  return out;
}

export function manuallyAdd(item: Item, tripId: string, existing: TripItem[]): TripItem[] {
  if (seenIds(existing, tripId).has(item.id)) return [];
  return [mk(tripId, item.id, { quantity: item.quantity, notes: item.notes, wasManuallyAdded: true })];
}

/** Copy rows from another trip. keepPacked=true is "Duplicate Trip"; false is "start from previous trip". */
export function copyChecklist(source: TripItem[], tripId: string, keepPacked: boolean, existing: TripItem[] = []): TripItem[] {
  const seen = seenIds(existing, tripId);
  const out: TripItem[] = [];
  for (const r of source) {
    if (seen.has(r.itemId)) continue;
    seen.add(r.itemId);
    out.push(mk(tripId, r.itemId, { isPacked: keepPacked && r.isPacked, quantity: r.quantity, notes: r.notes, wasManuallyAdded: r.wasManuallyAdded }));
  }
  return out;
}

export function applyTemplate(t: Template, tripId: string, existing: TripItem[] = []): TripItem[] {
  const seen = seenIds(existing, tripId);
  const out: TripItem[] = [];
  for (const x of t.items) {
    if (seen.has(x.itemId)) continue;
    seen.add(x.itemId);
    out.push(mk(tripId, x.itemId, { quantity: x.quantity, notes: x.notes }));
  }
  return out;
}

export function byCategory<T>(rows: T[], catOf: (r: T) => string | undefined, nameOf: (r: T) => string, cats: Category[]): [Category, T[]][] {
  return cats
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || cmp(a.name, b.name))
    .map((c) => [c, rows.filter((r) => catOf(r) === c.id).sort((a, b) => cmp(nameOf(a), nameOf(b)))] as [Category, T[]])
    .filter(([, r]) => r.length > 0);
}

export const ruleSummary = (i: Item, label: (t: Item['tripTypes'][number]) => string) => {
  if (i.isAlwaysPacked) return 'Always packed';
  const parts: string[] = [];
  if (i.tripTypes.length) parts.push('Trips: ' + i.tripTypes.map(label).join(', '));
  if (i.destinations.length) parts.push('Destinations: ' + i.destinations.join(', '));
  return parts.length ? parts.join(' • ') : 'Manual only';
};

export function quickMsg(added: number, skipped: number) {
  const iw = added === 1 ? 'item' : 'items', dw = skipped === 1 ? 'duplicate' : 'duplicates';
  if (added && skipped) return `Added ${added} ${iw}, skipped ${skipped} ${dw}`;
  return added ? `Added ${added} ${iw}` : `Skipped ${skipped} ${dw}`;
}

export const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
