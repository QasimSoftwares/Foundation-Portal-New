/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost'],
  },
  webpack: (config, { isServer }) => {
    return config;
  },
  experimental: {
    appDir: true,
  },
};

export default nextConfig;
