import type { MetadataRoute } from "next";
import { brand, PRODUCT_NAME } from "@/lib/brand";

/** Manifesto do app instalável (nome e ícones da oficina configurada). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.shortName} · ${PRODUCT_NAME}`,
    short_name: brand.shortName,
    description: `${PRODUCT_NAME} — ${brand.name}`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d0d0d",
    theme_color: "#0d0d0d",
    lang: "pt-BR",
    icons: [
      { src: brand.icon192, sizes: "192x192", type: "image/png" },
      { src: brand.icon512, sizes: "512x512", type: "image/png" },
      { src: brand.icon512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
