/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable server components since we're using client-side authentication
  reactStrictMode: true,
  
  // Configure images to be optimized
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
