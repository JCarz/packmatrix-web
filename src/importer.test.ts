import fixture from './fixtures/ios-export.json';
import { describe, expect, it } from 'vitest';
import { importState } from './importer';

describe('importState', () => {
  it('imports the iOS export fixture', () => {
    const result = importState(fixture);

    expect(result.skipped).toEqual({ items: 0, checklist: 0, templateItems: 0 });
    expect(result.state.trips.map((trip) => trip.tripType)).toEqual([
      'weekend', 'international', 'domestic', 'beach', 'work', 'familyVisit',
    ]);
    expect(result.state.checklist).toHaveLength(1);
  });

  it('fills optional fields and drops dangling links', () => {
    const backup = structuredClone(fixture);
    delete (backup.items[0] as Record<string, unknown>).notes;
    delete (backup.items[0] as Record<string, unknown>).destinations;
    backup.items.push({ id: 'bad-item', name: 'Lost item', categoryId: 'missing-category' } as never);
    backup.checklist.push({ id: 'bad-row', tripId: 'missing-trip', itemId: backup.items[0].id } as never);
    backup.templates[0].items.push({ itemId: 'missing-item', quantity: 1, notes: '' });

    const result = importState(backup);

    expect(result.state.items[0]).toMatchObject({ notes: '', destinations: [], quantity: 2 });
    expect(result.skipped).toEqual({ items: 1, checklist: 1, templateItems: 1 });
    expect(result.state.templates[0].items).toHaveLength(1);
  });
});
