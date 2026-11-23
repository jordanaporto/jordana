"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { friendlyError } from "@/lib/actions";
import { asSystem } from "@/lib/db";
import { processNotifications } from "@/lib/push";
import { TOKEN_RE } from "@/lib/tracking";

const schema = z.object({
  token: z.string().regex(TOKEN_RE),
  itemId: z.uuid(),
  decision: z.enum(["aprovado", "recusado"]),
  note: z.string().max(500).optional(),
});

/** Cliente aprova ou recusa um serviço pelo link de acompanhamento. */
export async function decideByLink(input: z.input<typeof schema>): Promise<{ ok: boolean; error?: string }> {
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: "Dados inválidos" };
  try {
    await asSystem((sql) => sql`select app.tracking_decide(${p.data.token}, ${p.data.itemId}, ${p.data.decision}::approval_status, ${p.data.note ?? null})`);
    after(() => processNotifications().catch(() => {}));
    revalidatePath(`/acompanhar/${p.data.token}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
