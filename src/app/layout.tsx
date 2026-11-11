import type { Metadata, Viewport } from "next";
import { brand, PRODUCT_NAME } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${PRODUCT_NAME} · ${brand.shortName}`, template: `%s · ${brand.shortName}` },
  description: `${PRODUCT_NAME} — ${brand.name}`,
  applicationName: PRODUCT_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: brand.shortName, statusBarStyle: "black-translucent" },
  icons: { icon: brand.icon192, apple: brand.appleIcon },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* cor principal da oficina configurada */}
        <style>{`:root{--color-brand:${brand.primary};--color-brand-dark:${brand.primaryDark}}`}</style>
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
