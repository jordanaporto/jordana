import type { NextConfig } from "next";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "font-src 'self' data:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // imagem Docker usa o modo standalone (BUILD_STANDALONE=true)
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  poweredByHeader: false,
  serverExternalPackages: ["@react-pdf/renderer", "postgres"],
  // fontes padrão do gerador de PDF são carregadas dinamicamente: incluir no build standalone
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfkit/js/**/*", "./node_modules/@react-pdf/**/*", "./public/brand/**/*"],
    "/api/tasks/setup": ["./db/migrations/*.sql"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    // uploads de vídeo (até 100 MB) passam pelo middleware de autenticação
    middlewareClientMaxBodySize: "110mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
