import { NextResponse } from "next/server";
import { brand } from "@/lib/brand";
import { TOKEN_RE } from "@/lib/tracking";

export const dynamic = "force-dynamic";

/**
 * Manifesto próprio da página do cliente: ao adicionar à tela inicial (necessário no
 * iPhone para receber avisos), o ícone abre direto no acompanhamento do veículo.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) return new NextResponse("inválido", { status: 400 });
  return NextResponse.json(
    {
      name: `Meu veículo · ${brand.shortName}`,
      short_name: brand.shortName,
      start_url: `/acompanhar/${token}`,
      scope: `/acompanhar/${token}`,
      display: "standalone",
      background_color: "#0d0d0d",
      theme_color: "#0d0d0d",
      lang: "pt-BR",
      icons: [
        { src: brand.icon192, sizes: "192x192", type: "image/png" },
        { src: brand.icon512, sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "private, no-store" } },
  );
}
