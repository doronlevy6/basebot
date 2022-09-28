import { ConvKey, generateKey, IConvStore } from './conv-store';

export class InMemoryConvStore implements IConvStore {
  private store: Map<string, string>;
  constructor() {
    this.store = new Map();
  }
  get(convKey: ConvKey): Promise<string | undefined> {
    const key = generateKey(convKey);
    return Promise.resolve(this.store.get(key));
  }
  set(convKey: ConvKey, value: string): Promise<void> {
    const key = generateKey(convKey);
    this.store.set(key, value);
    return Promise.resolve();
  }
}
