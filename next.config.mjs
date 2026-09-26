/** @type {import('next').NextConfig} */
// Dev-only: served through the nginx edge on the real domain (event tags are
// arbitrary subdomains), so Next's dev resources are cross-origin and blocked
// by default. Allow the domain + subdomains, derived from NEXT_PUBLIC_DOMAIN.
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN;
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
        allowedDevOrigins: DOMAIN ? [DOMAIN, `*.${DOMAIN}`] : [],
    };
};

export default nextConfig;