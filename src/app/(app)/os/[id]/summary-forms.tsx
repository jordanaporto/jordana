"use client";

import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { addNoteAction, assignMechanicAction, updateOrderAction } from "../actions";

export function NoteForm({ orderId }: { orderId: string }) {
  return (
    <ActionForm action={addNoteAction} resetOnSuccess showSuccess={false}>
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Nova observação" name="body">
        <Textarea name="body" rows={2} placeholder="O que você observou?" />
      </Field>
      <SubmitButton size="md" variant="dark">
        Registrar observação
      </SubmitButton>
    </ActionForm>
  );
}

export function AssignMechanicForm({ orderId, current, mechanics }: { orderId: string; current: string | null; mechanics: { id: string; name: string }[] }) {
  return (
    <ActionForm action={assignMechanicAction} className="flex flex-wrap items-end gap-2 space-y-0">
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Mecânico" name="mechanic_id" className="min-w-48 flex-1">
        <Select name="mechanic_id" defaultValue={current ?? ""}>
          <option value="">Sem mecânico</option>
          {mechanics.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton size="md" variant="dark">
        Atribuir
      </SubmitButton>
    </ActionForm>
  );
}

export function EditOrderForm({
  orderId,
  values,
}: {
  orderId: string;
  values: { entry_km: number; complaint: string; intake_notes: string | null; final_notes: string | null };
}) {
  return (
    <ActionForm action={updateOrderAction}>
      <input type="hidden" name="order_id" value={orderId} />
      <Field label="Quilometragem de entrada" name="entry_km">
        <Input name="entry_km" inputMode="numeric" defaultValue={String(values.entry_km)} />
      </Field>
      <Field label="Reclamação do cliente" name="complaint">
        <Textarea name="complaint" defaultValue={values.complaint} />
      </Field>
      <Field label="Observações do atendimento" name="intake_notes">
        <Textarea name="intake_notes" defaultValue={values.intake_notes ?? ""} />
      </Field>
      <Field label="Observações finais (vão no relatório)" name="final_notes">
        <Textarea name="final_notes" defaultValue={values.final_notes ?? ""} />
      </Field>
      <SubmitButton size="md">Salvar</SubmitButton>
    </ActionForm>
  );
}
