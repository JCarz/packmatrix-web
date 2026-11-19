import { describe, expect, it } from 'vitest';
import { applyTemplate, copyChecklist, generateChecklist, manuallyAdd } from './engine';
import type { Item, Template, Trip, TripItem } from './types';

const trip: Trip = {
  id: 'trip-1', name: 'Test trip', destination: '', startDate: '2026-11-16', endDate: '2026-11-17',
  tripType: 'weekend', isArchived: false,
};

const item = (id: string, overrides: Partial<Item> = {}): Item => ({
  id, name: id, categoryId: 'category-1', quantity: 1, notes: '', isOptional: false,
  isAlwaysPacked: false, tripTypes: [], destinations: [], ...overrides,
});

const row = (itemId: string, overrides: Partial<TripItem> = {}): TripItem => ({
  id: `row-${itemId}`, tripId: trip.id, itemId, isPacked: false, quantity: 1, notes: '', wasManuallyAdded: false,
  ...overrides,
});

describe('packing rule engine', () => {
  it('generates rows only for always-packed or matching trip-type items', () => {
    const rows = generateChecklist(trip, [
      item('always', { isAlwaysPacked: true }),
      item('matching-type', { tripTypes: ['weekend'] }),
      item('other-type', { tripTypes: ['work'] }),
      item('manual-only'),
    ], []);

    expect(rows.map((r) => r.itemId)).toEqual(['always', 'matching-type']);
  });

  it('does not duplicate rows when regenerated', () => {
    const items = [item('always', { isAlwaysPacked: true }), item('matching-type', { tripTypes: ['weekend'] })];
    const initial = generateChecklist(trip, items, []);

    expect(generateChecklist(trip, items, initial)).toEqual([]);
  });

  it('manually adds only absent items and marks the new row as manual', () => {
    const packingItem = item('manual');
    const added = manuallyAdd(packingItem, trip.id, []);

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ itemId: packingItem.id, tripId: trip.id, wasManuallyAdded: true });
    expect(manuallyAdd(packingItem, trip.id, added)).toEqual([]);
  });

  it('copies packed state only when keepPacked is true', () => {
    const source = [row('packed', { isPacked: true }), row('unpacked')];

    expect(copyChecklist(source, 'trip-2', true).map((r) => r.isPacked)).toEqual([true, false]);
    expect(copyChecklist(source, 'trip-3', false).map((r) => r.isPacked)).toEqual([false, false]);
  });

  it('applies template items once and skips items already on the trip', () => {
    const template: Template = {
      id: 'template-1', name: 'Template', createdAt: '2026-11-16T00:00:00.000Z',
      items: [
        { itemId: 'existing', quantity: 1, notes: '' },
        { itemId: 'new', quantity: 2, notes: 'Bring two' },
        { itemId: 'new', quantity: 3, notes: 'Duplicate entry' },
      ],
    };

    const rows = applyTemplate(template, trip.id, [row('existing')]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ itemId: 'new', quantity: 2, notes: 'Bring two' });
  });
});
