import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Use Turbopack (default in Next.js 16)
  turbopack: {},

  // Headers for Socket.io CORS during dev
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
        ],
      },
    ]
  },
}

export default nextConfig
