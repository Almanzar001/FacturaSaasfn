const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
        },
      },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'fubdratmgsjigdeacjqf.supabase.co'],
    formats: ['image/webp', 'image/avif'],
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react', 
      '@radix-ui/react-select', 
      '@radix-ui/react-tabs', 
      '@supabase/supabase-js'
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  poweredByHeader: false,
  compress: true,
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    return config
  },
}

module.exports = withPWA(nextConfig)
