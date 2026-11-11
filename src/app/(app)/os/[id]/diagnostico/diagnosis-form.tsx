"use client";

import { ActionForm, Field, SubmitButton, Textarea } from "@/components/form";
import { saveDiagnosisAction } from "../../actions";

export function DiagnosisForm({
  orderId,
  values,
  fields,
}: {
  orderId: string;
  values: Record<string, string>;
  fields: { name: string; label: string }[];
}) {
  return (
    <ActionForm action={saveDiagnosisAction}>
      <input type="hidden" name="order_id" value={orderId} />
      {fields.map((f) => (
        <Field key={f.name} label={f.label} name={f.name}>
          <Textarea name={f.name} defaultValue={values[f.name]} rows={f.name === "technical_notes" || f.name === "tests_performed" ? 3 : 2} />
        </Field>
      ))}
      <SubmitButton className="w-full">Salvar diagnóstico</SubmitButton>
    </ActionForm>
  );
}
