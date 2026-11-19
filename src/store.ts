import type { Item, State, TripType } from './types';
import { norm, uid } from './engine';

const KEY = 'packmatrix:v1';
const VERSION = 1;

export interface LoadResult { state: State; recoveryMessage?: string }

export const isState = (value: unknown): value is State => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ['categories', 'items', 'trips', 'checklist', 'templates'].every((key) => Array.isArray(record[key]));
};

export function seed(): State {
  const names = ['Fucked Without It', 'Bedroom', 'Bathroom', 'Clothing', 'Electronics', 'Documents', 'Medication', 'Travel Gear'];
  const categories = names.map((name, sortOrder) => ({ id: uid(), name, sortOrder }));
  const cat = (n: string) => categories.find((c) => norm(c.name) === norm(n))!.id;
  const add = (name: string, category: string, o: { always?: boolean; types?: TripType[]; dest?: string[] } = {}): Item => ({
    id: uid(), name, categoryId: cat(category), quantity: 1, notes: '', isOptional: false,
    isAlwaysPacked: !!o.always, tripTypes: o.types ?? [], destinations: o.dest ?? [],
  });
  const items = [
    add('Toothbrush', 'Bathroom', { always: true }),
    add('Underwear', 'Clothing', { always: true }),
    add('Phone charger', 'Electronics', { always: true }),
    add('Contact lenses', 'Bathroom', { types: ['international'] }),
    add('Passport', 'Documents', { types: ['international'] }),
    add('Sunscreen', 'Bathroom', { types: ['beach'], dest: ['Beach', 'Hot Weather'] }),
    add('Pajamas', 'Bedroom', { always: true }),
  ];
  return { categories, items, trips: [], checklist: [], templates: [] };
}

export function migrate(value: unknown): State {
  if (!isState(value)) throw new Error('Invalid PackMatrix state');
  const { categories, items, trips, checklist, templates, lastBackupAt } = value;
  return {
    categories, items, trips, checklist, templates,
    ...(typeof lastBackupAt === 'string' ? { lastBackupAt } : {}),
  };
}

export function load(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch { return { state: seed() }; }
  if (raw === null) return { state: seed() };
  try {
    return { state: migrate(JSON.parse(raw)) };
  } catch {
    try {
      const base = `packmatrix:corrupt-${Date.now()}`;
      let backupKey = base, suffix = 1;
      while (localStorage.getItem(backupKey) !== null) backupKey = `${base}-${suffix++}`;
      localStorage.setItem(backupKey, raw);
    } catch { /* preserve what storage allows */ }
    return { state: seed(), recoveryMessage: 'Your saved PackMatrix data could not be read. A copy was preserved before it can be replaced.' };
  }
}

export function save(s: State) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, version: VERSION })); } catch { /* storage full or blocked */ }
}
