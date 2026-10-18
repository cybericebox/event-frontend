import {HardCache} from "./commonPageCache";

/** How long an unknown event host is remembered: long enough to shed a flood of lookups, short enough that a new event shows up quickly. */
export const MISSING_HOST_TTL_MS = 15_000;

/**
 * Event hosts the API said it does not know (a public-info 404, or a 404 for the landing manifest) as seen by an
 * anonymous reader. Process-local and bounded: once a host is here the server asks the API nothing about it until
 * the entry expires, so a crawl of random subdomains costs the API one call per host per window. A signed reader
 * (a staff preview grant) never reads or writes it: an event hidden from the public is not missing for its staff.
 */
export class MissingHosts {
    private hosts: HardCache<true>;
    constructor(now: () => number = Date.now, ttl = MISSING_HOST_TTL_MS) {
        this.hosts = new HardCache<true>({maxEntries: 4096, maxBytes: 512 * 1024, ttl, now});
    }
    has(host: string): boolean {return this.hosts.peek(host) === true;}
    add(host: string) {this.hosts.set(host, true);}
}

/** The one shared by the public-info read and the render manifest read. */
export const missingHosts = new MissingHosts();
