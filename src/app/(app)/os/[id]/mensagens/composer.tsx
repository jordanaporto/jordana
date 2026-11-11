"use client";

import { ActionForm, Field, Select, SubmitButton, Textarea } from "@/components/form";
import { customMessageAction, templateMessageAction } from "@/app/(app)/mensagens/actions";

export function MessageComposer({ orderId, templates }: { orderId: string; templates: { id: string; name: string }[] }) {
  return (
    <div className="space-y-6">
      <ActionForm action={templateMessageAction}>
        <input type="hidden" name="order_id" value={orderId} />
        <Field label="Usar um modelo" name="template_id">
          <Select name="template_id" defaultValue="">
            <option value="">Escolha…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton size="md" variant="dark">
          Preparar mensagem do modelo
        </SubmitButton>
      </ActionForm>
      <ActionForm action={customMessageAction} resetOnSuccess>
        <input type="hidden" name="order_id" value={orderId} />
        <Field label="Ou escreva uma mensagem" name="body" hint="Mensagens livres são enviadas manualmente pelo WhatsApp oficial (wa.me).">
          <Textarea name="body" rows={3} />
        </Field>
        <SubmitButton size="md" variant="outline">
          Preparar mensagem
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
