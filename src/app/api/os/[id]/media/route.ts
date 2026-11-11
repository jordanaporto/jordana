import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { friendlyError } from "@/lib/actions";
import { getSessionUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { EXT, sniffMime, storage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTO = 15 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;
const UUID = /^[0-9a-f-]{36}$/;

/** Recebe foto/vídeo da OS, confere permissão no banco e grava no armazenamento privado. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  const { id: orderId } = await params;
  if (!UUID.test(orderId)) return NextResponse.json({ error: "OS inválida" }, { status: 400 });

  // confere permissão antes de receber o arquivo inteiro
  const [{ can_edit }] = await asUser(user.id, (sql) => sql`select app.can_edit_order(${orderId}) as can_edit`);
  if (!can_edit) return NextResponse.json({ error: "Você não pode adicionar arquivos nesta OS" }, { status: 403 });

  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_VIDEO + 2 * 1024 * 1024) return NextResponse.json({ error: "Arquivo grande demais (máx. 100 MB)" }, { status: 413 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Envio incompleto. Tente novamente." }, { status: 400 });
  }
  const file = form.get("file");
  const thumb = form.get("thumb");
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime) return NextResponse.json({ error: "Formato não suportado (use JPG, PNG, WEBP, MP4, MOV ou WEBM)" }, { status: 415 });
  const kind = mime.startsWith("video/") ? "video" : "foto";
  if (buf.length > (kind === "video" ? MAX_VIDEO : MAX_PHOTO)) {
    return NextResponse.json({ error: kind === "video" ? "Vídeo maior que 100 MB" : "Foto grande demais" }, { status: 413 });
  }
  let thumbBuf: Buffer | null = null;
  if (thumb instanceof File && thumb.size > 0 && thumb.size < 2 * 1024 * 1024) {
    const tb = Buffer.from(await thumb.arrayBuffer());
    if (sniffMime(tb) === "image/jpeg") thumbBuf = tb;
  }

  const link = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && UUID.test(v) ? v : null;
  };
  const durationRaw = Number(form.get("duration"));
  const duration = kind === "video" && Number.isFinite(durationRaw) ? Math.min(600, Math.max(0, Math.round(durationRaw))) : null;
  const caption = typeof form.get("caption") === "string" ? String(form.get("caption")).slice(0, 500) || null : null;

  const fileId = randomUUID();
  const key = `os/${orderId}/${fileId}.${EXT[mime]}`;
  const thumbKey = thumbBuf ? `os/${orderId}/${fileId}_thumb.jpg` : kind === "foto" ? key : null;

  const st = storage();
  await st.put(key, buf, mime);
  if (thumbBuf && thumbKey) await st.put(thumbKey, thumbBuf, "image/jpeg");

  try {
    const [row] = await asUser(user.id, (sql) => sql`
      insert into media (service_order_id, checklist_entry_id, diagnosis_id, service_item_id, kind, storage_path,
                         thumb_path, mime_type, size_bytes, duration_seconds, caption)
      values (${orderId}, ${link("checklist_entry_id")}, ${link("diagnosis_id")}, ${link("service_item_id")},
              ${kind}::media_kind, ${key}, ${thumbKey}, ${mime}, ${buf.length}, ${duration}, ${caption})
      returning id`);
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (e) {
    // banco recusou (permissão / vínculo inválido): não deixa arquivo órfão
    await st.remove(key).catch(() => {});
    if (thumbBuf && thumbKey) await st.remove(thumbKey).catch(() => {});
    return NextResponse.json({ error: friendlyError(e) }, { status: 403 });
  }
}
