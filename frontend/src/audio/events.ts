/** A tiny typed event emitter; enough for the engine, no dependency. */
export class Emitter<Events extends Record<string, unknown[]>> {
  private listeners: { [K in keyof Events]?: Set<(...args: Events[K]) => void> } = {};

  on<K extends keyof Events>(event: K, fn: (...args: Events[K]) => void): () => void {
    const set = (this.listeners[event] ??= new Set());
    set.add(fn);
    return () => set.delete(fn);
  }

  emit<K extends keyof Events>(event: K, ...args: Events[K]): void {
    this.listeners[event]?.forEach((fn) => fn(...args));
  }

  clear(): void {
    this.listeners = {};
  }
}
