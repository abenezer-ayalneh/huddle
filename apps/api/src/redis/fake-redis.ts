// Minimal in-memory stand-in for ioredis, for unit tests. Implements only the
// commands RoomStateService uses (string get/set + per-room index sets). TTLs
// are accepted but not enforced — expiry isn't what the unit tests exercise.
// Excluded from the build (see tsconfig.build.json); cast to `Redis` in specs.
export class FakeRedis {
  private strings = new Map<string, string>();
  private sets = new Map<string, Set<string>>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.strings.get(key) ?? null);
  }

  // Mirrors ioredis `set(key, value, 'EX', seconds)`; the TTL args are ignored.
  set(key: string, value: string, ..._rest: unknown[]): Promise<'OK'> {
    this.strings.set(key, value);
    return Promise.resolve('OK');
  }

  mget(keys: string[]): Promise<(string | null)[]> {
    return Promise.resolve(keys.map((k) => this.strings.get(k) ?? null));
  }

  sadd(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    let added = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        added++;
      }
    }
    this.sets.set(key, set);
    return Promise.resolve(added);
  }

  srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return Promise.resolve(0);
    let removed = 0;
    for (const m of members) if (set.delete(m)) removed++;
    return Promise.resolve(removed);
  }

  smembers(key: string): Promise<string[]> {
    return Promise.resolve([...(this.sets.get(key) ?? [])]);
  }

  del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const k of keys) {
      if (this.strings.delete(k)) removed++;
      if (this.sets.delete(k)) removed++;
    }
    return Promise.resolve(removed);
  }

  expire(_key: string, _seconds: number): Promise<number> {
    return Promise.resolve(1);
  }
}
