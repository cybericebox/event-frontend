// One base domain: every host that is not set is derived from NEXT_PUBLIC_DOMAIN (the rule of deploy/base-domain.sh, the same file in every
// frontend). The Docker build bakes placeholders for the hosts and has no DOMAIN, so nothing is derived there.
const HOSTS = [
    ["NEXT_PUBLIC_MAIN_HOST", ""],
    ["NEXT_PUBLIC_API_HOST", "api."],
    ["NEXT_PUBLIC_ID_HOST", "id."],
    ["NEXT_PUBLIC_ADMIN_HOST", "admin."],
    ["NEXT_PUBLIC_EXERCISES_HOST", "exercises."],
    ["NEXT_PUBLIC_EVENT_DOMAIN", ""],
    ["NEXT_PUBLIC_COOKIE_DOMAIN", ""],
]
const domain = process.env.NEXT_PUBLIC_DOMAIN ?? ""
if (domain && (domain.length > 253 || !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/.test(domain))) {
    throw new Error(`NEXT_PUBLIC_DOMAIN must be a bare lower case host name (no scheme, port or path), got: ${domain}`)
}
for (const [name, prefix] of HOSTS) {
    if (process.env[name]?.trim()) continue
    if (!domain) throw new Error(`${name} is required (set it, or set NEXT_PUBLIC_DOMAIN and it is derived)`)
    process.env[name] = prefix + domain
}

// Every other operator value is required from the env (no fallbacks): a missing one fails the build.
const REQUIRED = [
    "NEXT_PUBLIC_SUPPORT_EMAIL", "NEXT_PUBLIC_PARTNER_ICE_NURE_URL", "NEXT_PUBLIC_PARTNER_NURE_URL", "NEXT_PUBLIC_WIREGUARD_INSTALL_URL",
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
        output: 'standalone',
        // images.unoptimized is set, so the image optimizer never loads sharp: keep its native libvips
        // (~45 MB, an optional dependency of next) out of the standalone trace.
        outputFileTracingExcludes: {'*': ['node_modules/sharp/**', 'node_modules/@img/**']},
        allowedDevOrigins: [...new Set(devOrigins)],
    };
};

export default nextConfig;
