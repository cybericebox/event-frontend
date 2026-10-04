/** @type {import('next').NextConfig} */
// Every host is required from the env (no fallbacks): a missing one fails the build.
const REQUIRED = [
    "NEXT_PUBLIC_MAIN_HOST", "NEXT_PUBLIC_API_HOST", "NEXT_PUBLIC_ID_HOST", "NEXT_PUBLIC_ADMIN_HOST",
    "NEXT_PUBLIC_EXERCISES_HOST", "NEXT_PUBLIC_EVENT_DOMAIN", "NEXT_PUBLIC_COOKIE_DOMAIN", "NEXT_PUBLIC_SUPPORT_EMAIL",
    "NEXT_PUBLIC_PARTNER_ICE_NURE_URL", "NEXT_PUBLIC_PARTNER_NURE_URL", "NEXT_PUBLIC_WIREGUARD_INSTALL_URL",
];
const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
if (missing.length) throw new Error(`Missing required env: ${missing.join(", ")}`);

// Dev-only: served through the nginx edge on the real domain (event tags are
// arbitrary subdomains), so Next's dev resources are cross-origin and blocked
// by default. DEV_ALLOWED_ORIGINS (comma list) overrides; otherwise the configured
// hosts and event subdomains are allowed.
const devOrigins = process.env.DEV_ALLOWED_ORIGINS?.trim()
    ? process.env.DEV_ALLOWED_ORIGINS.split(",").map((d) => d.trim()).filter(Boolean)
    : [process.env.NEXT_PUBLIC_EVENT_DOMAIN, `*.${process.env.NEXT_PUBLIC_EVENT_DOMAIN}`,
        ...["MAIN", "API", "ID", "ADMIN", "EXERCISES"].map((k) => process.env[`NEXT_PUBLIC_${k}_HOST`])];
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
        output: 'standalone',
        // images.unoptimized is set, so the image optimizer never loads sharp: keep its native libvips
        // (~45 MB, an optional dependency of next) out of the standalone trace.
        outputFileTracingExcludes: {'*': ['node_modules/sharp/**', 'node_modules/@img/**']},
        allowedDevOrigins: [...new Set(devOrigins)],
    };
};

export default nextConfig;
