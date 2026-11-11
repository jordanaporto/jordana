"use server";

import { z } from "zod";
import { friendlyError } from "@/lib/actions";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { isAllowedEndpoint, processNotifications } from "@/lib/push";

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  userAgent: z.string().max(300).optional(),
});

type Result = { ok: boolean; error?: string; devices?: number };

export async function savePushSubscription(input: unknown): Promise<Result> {
  const user = await requireUser();
  const p = subSchema.safeParse(input);
  if (!p.success || !isAllowedEndpoint(p.data.endpoint)) return { ok: false, error: "Este navegador não é compatível com avisos." };
  try {
    const devices = await asUser(user.id, async (sql) => {
      await sql`select app.push_subscribe(${p.data.endpoint}, ${p.data.keys.p256dh}, ${p.data.keys.auth}, ${p.data.userAgent ?? null})`;
      await sql`select app.push_test()`;
      const [r] = await sql`select app.push_my_devices() as n`;
      return r.n as number;
    });
    await processNotifications();
    return { ok: true, devices };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  const user = await requireUser();
  try {
    await asUser(user.id, (sql) => sql`select app.push_unsubscribe(${String(endpoint).slice(0, 1000)})`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}

export async function sendTestPush(): Promise<Result> {
  const user = await requireUser();
  try {
    await asUser(user.id, (sql) => sql`select app.push_test()`);
    const r = await processNotifications();
    if ("skipped" in r && r.skipped) return { ok: false, error: "Avisos ainda não configurados no servidor." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
