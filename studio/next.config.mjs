/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Ye workspace packages source TypeScript me rehte hain (koi build step nahi),
  // isliye Next inhe khud compile kare.
  transpilePackages: ["@reel/core", "@reel/remotion", "@reel/storage"],
};

export default nextConfig;
