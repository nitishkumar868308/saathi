/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    // AVIF/WebP — same dikhne wali image me 40-70% kam bytes. Purane browsers ko
    // Next apne aap PNG/JPEG hi bhejta hai.
    formats: ["image/avif", "image/webp"],
    // Phone-first list. Default me 3840px tak ke sizes hote hain jinki yahan
    // kabhi zaroorat nahi — hata dene se build tez aur image cache saaf rehta hai.
    deviceSizes: [360, 414, 640, 828, 1080, 1200, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  // Bade icon packs se sirf wahi icons bundle me jaayein jo sach me import hue.
  // Iske bina lucide-react ka poora set client bundle me chala jaata hai.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  // Static assets par lamba cache — inke naam kabhi badalte nahi, isliye safe.
  async headers() {
    return [
      {
        source: "/:file(.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|woff2))",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

  // SEO: purane/andaaze wale URL se sahi page par bhejo, taaki koi link 404 na
  // de aur us link ka weight sahi page ko mile.
  async redirects() {
    return [
      { source: "/blogs", destination: "/blog", permanent: true },
      { source: "/help", destination: "/support", permanent: true },
      { source: "/faq", destination: "/#faq", permanent: true },
      { source: "/download", destination: "/#download", permanent: true },
    ];
  },
};

export default nextConfig;
