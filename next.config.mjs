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
        },
        output: 'standalone',
    };
};

export default nextConfig;
