import { NextResponse } from "next/server";
import { asSystem } from "@/lib/db";
import { storage } from "@/lib/storage";
import { TOKEN_RE } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Foto/vídeo da OS para o cliente: só entrega se o arquivo pertence à OS do link. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  if (!TOKEN_RE.test(token) || !/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("inválido", { status: 400 });
  const [m] = await asSystem((sql) => sql`select * from app.tracking_media(${token}, ${id})`);
  if (!m) return new NextResponse("não encontrado", { status: 404 });

  const wantThumb = new URL(req.url).searchParams.has("thumb");
  if (wantThumb && !m.thumb_path) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#27272a"/><path d="M15 12l14 8-14 8z" fill="#fff"/></svg>`;
    return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=600" } });
  }
  const key: string = wantThumb ? m.thumb_path : m.storage_path;
  const type = wantThumb && m.thumb_path !== m.storage_path ? "image/jpeg" : m.mime_type;

  const rm = req.headers.get("range")?.match(/^bytes=(\d+)-(\d*)$/);
  const range = rm ? { start: Number(rm[1]), end: rm[2] ? Number(rm[2]) : undefined } : undefined;
  const obj = await storage().get(key, range);
  if (!obj) return new NextResponse("arquivo ausente", { status: 404 });
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Content-Length": String(obj.contentLength),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=600",
    "X-Content-Type-Options": "nosniff",
  };
  if (obj.range) {
    headers["Content-Range"] = `bytes ${obj.range.start}-${obj.range.end}/${obj.size}`;
    return new NextResponse(obj.body, { status: 206, headers });
  }
  return new NextResponse(obj.body, { headers });
}
