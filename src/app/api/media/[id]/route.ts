import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrega a mídia somente para quem tem sessão válida e permissão de ver a OS
 * (RLS no banco). Suporta Range para reprodução de vídeo no celular.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new NextResponse("não autenticado", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("inválido", { status: 400 });

  const url = new URL(req.url);
  const wantThumb = url.searchParams.has("thumb");
  const [m] = await asUser(user.id, (sql) => sql`
    select storage_path, thumb_path, mime_type, kind, deleted_at from media where id = ${id}`);
  if (!m || (m.deleted_at && user.role !== "admin")) return new NextResponse("não encontrado", { status: 404 });

  const key: string = wantThumb && m.thumb_path ? m.thumb_path : m.storage_path;
  const type = wantThumb && m.thumb_path && m.thumb_path !== m.storage_path ? "image/jpeg" : m.mime_type;
  if (wantThumb && !m.thumb_path) {
    // vídeo sem miniatura: ícone genérico
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#27272a"/><path d="M15 12l14 8-14 8z" fill="#fff"/></svg>`;
    return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=600" } });
  }

  const rangeHeader = req.headers.get("range");
  let range: { start: number; end?: number } | undefined;
  const rm = rangeHeader?.match(/^bytes=(\d+)-(\d*)$/);
  if (rm) range = { start: Number(rm[1]), end: rm[2] ? Number(rm[2]) : undefined };

  const obj = await storage().get(key, range);
  if (!obj) return new NextResponse("arquivo ausente", { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": type,
    "Content-Length": String(obj.contentLength),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=600",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  };
  if (obj.range) {
    headers["Content-Range"] = `bytes ${obj.range.start}-${obj.range.end}/${obj.size}`;
    return new NextResponse(obj.body, { status: 206, headers });
  }
  return new NextResponse(obj.body, { status: 200, headers });
}
