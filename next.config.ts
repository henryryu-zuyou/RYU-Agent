import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /daiguan 這種好記的網址，實際指向 public/ 底下的靜態頁（公開，免登入）
  // （/faq 不在這裡：它要看有沒有登入來決定顯示內容，改由 app/faq/route.ts 提供）
  async rewrites() {
    return [
      { source: "/daiguan", destination: "/daiguan-vs-shezhai.html" },
      { source: "/faq-diagrams", destination: "/landlord-faq-diagrams.html" },
      { source: "/sign-form", destination: "/landlord-sign-form.html" },
    ];
  },
};

export default nextConfig;
