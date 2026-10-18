/** @type {import('next').NextConfig} */
const BACKEND_URL = process.env.BACKEND_URL ?? 'http://127.0.0.1:8000';

const nextConfig = {
  // Proxy /api/* to the FastAPI Kronos service so the browser never deals with CORS.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }];
  },
  // Kronos runs on CPU; a forecast or accuracy check can take a minute.
  experimental: { proxyTimeout: 5 * 60 * 1000 },
};

module.exports = nextConfig;
