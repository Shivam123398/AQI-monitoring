/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['api.aeroguard.ai'],
  },
  output: 'standalone',
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
  // Proxy API calls to backend service (Docker network)
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://backend:3000/api/v1/:path*',
      },
      {
        source: '/health',
        destination: 'http://backend:3000/health',
      },
    ];
  },
};

module.exports = nextConfig;
