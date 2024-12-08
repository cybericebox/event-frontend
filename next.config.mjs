/** @type {import('next').NextConfig} */
const nextConfig = () => {
    return {
        images: {
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
    };
};

export default nextConfig();