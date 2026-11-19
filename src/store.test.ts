import { afterEach, describe, expect, it } from 'vitest';
import { load, save, seed } from './store';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const originalStorage = globalThis.localStorage;
const useStorage = (storage: Storage) => Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

afterEach(() => useStorage(originalStorage));

describe('store loading', () => {
  it('loads a valid versioned state', () => {
    const storage = new MemoryStorage();
    const state = seed();
    storage.setItem('packmatrix:v1', JSON.stringify({ ...state, version: 1 }));
    useStorage(storage);

    expect(load()).toEqual({ state });
  });

  it('migrates a legacy state without a version', () => {
    const storage = new MemoryStorage();
    const state = seed();
    storage.setItem('packmatrix:v1', JSON.stringify(state));
    useStorage(storage);

    const result = load();
    expect(result).toEqual({ state });
    save(result.state);
    expect(JSON.parse(storage.getItem('packmatrix:v1')!)).toMatchObject({ version: 1 });
  });

  it('preserves corrupt data and leaves the original untouched', () => {
    const storage = new MemoryStorage();
    const corrupt = '{ definitely not json';
    storage.setItem('packmatrix:v1', corrupt);
    useStorage(storage);

    const result = load();
    const backupKey = storage.key(1)!;
    expect(result.recoveryMessage).toContain('could not be read');
    expect(storage.getItem('packmatrix:v1')).toBe(corrupt);
    expect(backupKey).toMatch(/^packmatrix:corrupt-\d+$/);
    expect(storage.getItem(backupKey)).toBe(corrupt);
  });
});
