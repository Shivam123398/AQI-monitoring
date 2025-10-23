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
  // Proxy API calls to backend service; configurable for dev or Docker
  async rewrites() {
    // Prefer explicit BACKEND_URL; otherwise use localhost:4000 in dev, backend:3000 in production (Docker)
    const backendBase = process.env.BACKEND_URL;
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendBase}/api/v1/:path*`,
      },
      {
        source: '/health',
        destination: `${backendBase}/health`,
      },
    ];
  },
};

module.exports = nextConfig;
