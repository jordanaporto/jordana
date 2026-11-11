"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runForm, type ActionState } from "@/lib/actions";
import { requireUser } from "@/lib/auth/session";
import { generateReport } from "@/lib/report/generate";
import { STAFF } from "@/lib/roles";

export async function generateReportAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser(STAFF);
  return runForm(z.object({ order_id: z.uuid() }), fd, async ({ order_id }) => {
    const r = await generateReport(user, order_id);
    revalidatePath(`/os/${order_id}/relatorio`);
    return { ok: true, message: `Relatório versão ${r.version} gerado (${Math.round(r.size / 1024)} KB)` };
  });
}
