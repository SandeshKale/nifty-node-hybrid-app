/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ajcwzwccjhcvjavcqbyj.supabase.co' },
    ],
  },
};

module.exports = nextConfig;
