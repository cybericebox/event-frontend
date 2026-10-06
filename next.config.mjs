import {readFileSync} from "node:fs"

// One base domain: NEXT_PUBLIC_DOMAIN is the only host input and every host derives from it (src/**/hosts.ts, deploy/base-domain.sh; the daemon and
// the infrastructure renderer share the rule and tests/base-domain-vectors.json). The Docker build bakes a placeholder for it.
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN ?? ""
if (!DOMAIN) throw new Error("NEXT_PUBLIC_DOMAIN is required")
if (DOMAIN !== "__NEXT_PUBLIC_DOMAIN__" && (DOMAIN.length > 253 || !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/.test(DOMAIN))) {
    throw new Error(`NEXT_PUBLIC_DOMAIN must be a bare lowercase host name (no scheme, port or path), got: ${DOMAIN}`)
}
const PLATFORM_HOSTS = [DOMAIN, `api.${DOMAIN}`, `id.${DOMAIN}`, `admin.${DOMAIN}`, `exercises.${DOMAIN}`]

// Every other operator value is required from the env (no fallbacks): a missing one fails the build.
const REQUIRED = ["NEXT_PUBLIC_SUPPORT_EMAIL"];
const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
if (missing.length) throw new Error(`Missing required env: ${missing.join(", ")}`);

// Dev-only: served through the nginx edge on the real domain (event tags are
// arbitrary subdomains), so Next's dev resources are cross-origin and blocked
// by default. DEV_ALLOWED_ORIGINS (comma list) overrides; otherwise the configured
// hosts and event subdomains are allowed.
const devOrigins = process.env.DEV_ALLOWED_ORIGINS?.trim()
    ? process.env.DEV_ALLOWED_ORIGINS.split(",").map((d) => d.trim()).filter(Boolean)
    : [`*.${DOMAIN}`, ...PLATFORM_HOSTS];
/** @type {import('next').NextConfig} */
const nextConfig = () => {
    return {
        images: {
            unoptimized: true,
            remotePatterns: [
                {
                    protocol: 'https',
                    hostname: '**',
                    port: '',
                },
            ],
            minimumCacheTTL: 24 * 60 * 60,// 24 hours
        },
        env: {NEXT_PUBLIC_APP_VERSION: JSON.parse(readFileSync("package.json", "utf8")).version},
        output: 'standalone',
        // images.unoptimized is set, so the image optimizer never loads sharp: keep its native libvips
        // (~45 MB, an optional dependency of next) out of the standalone trace.
        outputFileTracingExcludes: {'*': ['node_modules/sharp/**', 'node_modules/@img/**']},
        allowedDevOrigins: [...new Set(devOrigins)],
    };
};

export default nextConfig;
