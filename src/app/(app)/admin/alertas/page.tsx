import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { ADMIN } from "@/lib/roles";
import { Card, PageHeader } from "@/components/ui";
import { AlertSettingsForm } from "../forms";

export const metadata = { title: "Alertas" };

export default async function AlertsSettingsPage() {
  const user = await requireUser(ADMIN);
  const rows = await asUser(user.id, (sql) => sql`select key, value from settings where key like 'alert.%'`);
  const v = Object.fromEntries(rows.map((r) => [String(r.key).replace("alert.", ""), Number(r.value)]));
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Alertas internos" subtitle="Aparecem no dashboard e no pátio quando o limite é ultrapassado" back="/admin/config" />
      <Card>
        <AlertSettingsForm v={v} />
      </Card>
    </div>
  );
}
