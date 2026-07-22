// Minimal in-memory stand-in for ioredis, for unit tests. Implements only the
// commands room state services use (string get/set/getdel + per-room index
// sets). TTL and NX/XX are enforced so consent and one-time-token tests exercise
// the same semantics the real Redis client provides.
// Excluded from the build (see tsconfig.build.json); cast to `Redis` in specs.
export class FakeRedis {
  private strings = new Map<string, { value: string; expiresAt?: number }>();
  private sets = new Map<string, Set<string>>();
  private setExpiresAt = new Map<string, number>();

  get(key: string): Promise<string | null> {
    this.cleanupString(key);
    return Promise.resolve(this.strings.get(key)?.value ?? null);
  }

  // Mirrors the ioredis forms used by the app:
  // `set(key, value, 'EX', seconds, 'NX' | 'XX')`.
  set(key: string, value: string, ...rest: (string | number)[]): Promise<'OK' | null> {
    this.cleanupString(key);
    const options = rest.map((value) => String(value).toUpperCase());
    const exists = this.strings.has(key);
    if (options.includes('NX') && exists) return Promise.resolve(null);
    if (options.includes('XX') && !exists) return Promise.resolve(null);

    const exIndex = options.indexOf('EX');
    const ttlSeconds = exIndex >= 0 ? Number(rest[exIndex + 1]) : undefined;
    this.strings.set(key, {
      value,
      ...(ttlSeconds != null && Number.isFinite(ttlSeconds) ? { expiresAt: Date.now() + ttlSeconds * 1000 } : {}),
    });
    return Promise.resolve('OK');
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map((key) => this.get(key)));
  }

  // Atomic read-and-delete (Redis >=6.2), used by one-time token flows.
  async getdel(key: string): Promise<string | null> {
    const value = await this.get(key);
    this.strings.delete(key);
    return value;
  }

  sadd(key: string, ...members: string[]): Promise<number> {
    this.cleanupSet(key);
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
    this.cleanupSet(key);
    const set = this.sets.get(key);
    if (!set) return Promise.resolve(0);
    let removed = 0;
    for (const m of members) if (set.delete(m)) removed++;
    return Promise.resolve(removed);
  }

  smembers(key: string): Promise<string[]> {
    this.cleanupSet(key);
    return Promise.resolve([...(this.sets.get(key) ?? [])]);
  }

  del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const k of keys) {
      if (this.strings.delete(k)) removed++;
      if (this.sets.delete(k)) {
        this.setExpiresAt.delete(k);
        removed++;
      }
    }
    return Promise.resolve(removed);
  }

  expire(key: string, seconds: number): Promise<number> {
    this.cleanupString(key);
    this.cleanupSet(key);
    const string = this.strings.get(key);
    if (string) {
      string.expiresAt = Date.now() + seconds * 1000;
      return Promise.resolve(1);
    }
    if (this.sets.has(key)) {
      this.setExpiresAt.set(key, Date.now() + seconds * 1000);
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  }

  private cleanupString(key: string): void {
    const value = this.strings.get(key);
    if (value?.expiresAt != null && value.expiresAt <= Date.now()) {
      this.strings.delete(key);
    }
  }

  private cleanupSet(key: string): void {
    const expiresAt = this.setExpiresAt.get(key);
    if (expiresAt != null && expiresAt <= Date.now()) {
      this.sets.delete(key);
      this.setExpiresAt.delete(key);
    }
  }
}
