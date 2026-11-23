import { NextResponse } from "next/server";
import { z } from "zod";
import { friendlyError } from "@/lib/actions";
import { asSystem } from "@/lib/db";
import { isAllowedEndpoint, processNotifications } from "@/lib/push";
import { TOKEN_RE } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Cliente ativa avisos no celular para acompanhar o próprio veículo. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) return NextResponse.json({ error: "Link inválido" }, { status: 400 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success || !isAllowedEndpoint(p.data.endpoint)) {
    return NextResponse.json({ error: "Este navegador não é compatível com avisos." }, { status: 400 });
  }
  try {
    await asSystem((sql) => sql`
      select app.tracking_subscribe(${token}, ${p.data.endpoint}, ${p.data.keys.p256dh}, ${p.data.keys.auth},
                                    ${req.headers.get("user-agent") ?? null})`);
    await processNotifications();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: friendlyError(e) }, { status: 400 });
  }
}
