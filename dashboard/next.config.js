/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['api.aeroguard.ai'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_MAP_CENTER_LAT: process.env.NEXT_PUBLIC_MAP_CENTER_LAT || '28.6139',
    NEXT_PUBLIC_MAP_CENTER_LNG: process.env.NEXT_PUBLIC_MAP_CENTER_LNG || '77.2090',
  },
  experimental: {
    appDir: true,
  },
  // PWA config
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;