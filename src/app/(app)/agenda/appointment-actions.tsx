"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm, Field, Input, Select, SubmitButton } from "@/components/form";
import { buttonClass, cx } from "@/components/ui";
import { convertAppointmentAction, setAppointmentStatusAction } from "./actions";

type Panel = null | "chegou" | "cancelar" | "mais";

export function AppointmentActions({
  appointment,
  mechanics,
}: {
  appointment: { id: string; status: string; service: string; hasVehicle: boolean; customerId: string };
  mechanics: { id: string; name: string }[];
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const a = appointment;

  const quick = (status: "confirmado" | "faltou", label: string, variant: "outline" | "ghost") => (
    <ActionForm action={setAppointmentStatusAction} showSuccess={false} className="space-y-0">
      <input type="hidden" name="appointment_id" value={a.id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton size="md" variant={variant} pendingText="…" className="w-full">
        {label}
      </SubmitButton>
    </ActionForm>
  );

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button type="button" onClick={() => setPanel(panel === "chegou" ? null : "chegou")} className={cx(buttonClass("primary", "md"), "col-span-2 sm:col-span-1")}>
          Chegou → abrir OS
        </button>
        {a.status === "agendado" ? quick("confirmado", "Cliente confirmou", "outline") : <span className="hidden sm:block" />}
        <Link href={`/agenda/${a.id}/editar`} className={buttonClass("outline", "md")}>
          Reagendar
        </Link>
        <button type="button" onClick={() => setPanel(panel === "mais" ? null : "mais")} className={buttonClass("ghost", "md")}>
          Mais
        </button>
      </div>

      {panel === "chegou" &&
        (a.hasVehicle ? (
          <ActionForm action={convertAppointmentAction} className="mt-3 rounded-xl bg-zinc-50 p-3">
            <input type="hidden" name="appointment_id" value={a.id} />
            <Field label="Quilometragem de entrada" name="entry_km">
              <Input name="entry_km" inputMode="numeric" className="text-xl font-bold" />
            </Field>
            <Field label="O que o cliente relatou" name="complaint">
              <Input name="complaint" defaultValue={a.service} />
            </Field>
            <Field label="Mecânico responsável" name="mechanic_id">
              <Select name="mechanic_id" defaultValue="">
                <option value="">Definir depois</option>
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <SubmitButton className="w-full" pendingText="Abrindo OS…">
              Abrir ordem de serviço
            </SubmitButton>
          </ActionForm>
        ) : (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            Este agendamento não tem veículo. <Link href={`/agenda/${a.id}/editar`} className="font-semibold underline">Escolha o veículo</Link> ou{" "}
            <Link href={`/veiculos/novo?cliente=${a.customerId}`} className="font-semibold underline">cadastre um</Link>.
          </p>
        ))}

      {panel === "mais" && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {quick("faltou", "Cliente faltou", "outline")}
          <button type="button" onClick={() => setPanel("cancelar")} className={buttonClass("danger", "md")}>
            Cancelar horário
          </button>
        </div>
      )}

      {panel === "cancelar" && (
        <ActionForm action={setAppointmentStatusAction} className="mt-3 rounded-xl bg-zinc-50 p-3">
          <input type="hidden" name="appointment_id" value={a.id} />
          <input type="hidden" name="status" value="cancelado" />
          <Field label="Motivo do cancelamento" name="reason">
            <Input name="reason" placeholder="Ex.: cliente pediu para remarcar" />
          </Field>
          <SubmitButton size="md" variant="danger" className="w-full">
            Cancelar horário (lembretes não serão enviados)
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
