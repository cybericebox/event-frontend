type Loaded<T> = {value: T; validUntil?: number};
type Options = {maxEntries: number; maxBytes: number; ttl: number; maxInflight?: number; now?: () => number};

/** Process-local, bounded LRU with hard expiry. Failed revalidation can never serve stale success. */
export class HardCache<T> {
    private entries = new Map<string, {value: T; until: number; bytes: number}>();
    private inflight = new Map<string, Promise<T>>();
    private used = 0;
    constructor(private options: Options) {}
    get size() {return this.entries.size;}
    get bytes() {return this.used;}
    delete(key: string) {
        const old = this.entries.get(key);
        if (old) this.used -= old.bytes;
        this.entries.delete(key);
    }
    /** The fresh value of a key, or undefined; never loads. */
    peek(key: string): T | undefined {
        const entry = this.entries.get(key);
        return entry && entry.until > (this.options.now ?? Date.now)() ? entry.value : undefined;
    }
    /** Remember a value for the cache's ttl without a loader. */
    set(key: string, value: T) {
        const now = this.options.now ?? Date.now;
        this.delete(key);
        this.insert(key, value, now() + this.options.ttl, now);
    }
    private insert(key: string, value: T, until: number, now: () => number) {
        const bytes = Buffer.byteLength(JSON.stringify(value), "utf8");
        if (until > now() && bytes <= this.options.maxBytes) {
            for (const [id, entry] of this.entries) if (entry.until <= now()) this.delete(id);
            while (this.entries.size >= this.options.maxEntries || this.used + bytes > this.options.maxBytes) this.delete(this.entries.keys().next().value!);
            this.entries.set(key, {value, until, bytes}); this.used += bytes;
        }
    }
    async get(key: string, load: () => Promise<Loaded<T>>): Promise<T> {
        const now = this.options.now ?? Date.now;
        const old = this.entries.get(key);
        if (old && old.until > now()) {
            this.entries.delete(key); this.entries.set(key, old);
            return old.value;
        }
        this.delete(key);
        const pending = this.inflight.get(key);
        if (pending) return pending;
        if (this.inflight.size >= (this.options.maxInflight ?? 64)) throw new Error("Common page cache busy");
        const started = now();
        const request = Promise.resolve().then(load).then(({value, validUntil}) => {
            this.insert(key, value, Math.min(started + this.options.ttl, validUntil ?? Infinity), now);
            return value;
        }).finally(() => {this.inflight.delete(key);});
        this.inflight.set(key, request);
        return request;
    }
}
