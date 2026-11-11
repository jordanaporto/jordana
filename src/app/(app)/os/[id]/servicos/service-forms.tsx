"use client";

import { useState } from "react";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { centsToInput } from "@/lib/format";
import { cx } from "@/components/ui";
import { recordDecisionAction, removeServiceItemAction, saveServiceItemAction, setExecutionAction } from "../../actions";

type Values = {
  item_id?: string;
  title?: string;
  description?: string | null;
  part_name?: string | null;
  quantity?: string;
  part_unit_price_cents?: number;
  labor_price_cents?: number;
  priority?: string;
};

export function ServiceItemForm({ orderId, values = {}, editPrices }: { orderId: string; values?: Values; editPrices: boolean }) {
  return (
    <ActionForm action={saveServiceItemAction} resetOnSuccess={!values.item_id}>
      <input type="hidden" name="order_id" value={orderId} />
      {values.item_id && <input type="hidden" name="item_id" value={values.item_id} />}
      <Field label="Serviço" name="title">
        <Input name="title" defaultValue={values.title} placeholder="Ex.: Troca das pastilhas dianteiras" />
      </Field>
      <Field label="Descrição" name="description">
        <Textarea name="description" rows={2} defaultValue={values.description ?? ""} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Peça" name="part_name" className="col-span-2">
          <Input name="part_name" defaultValue={values.part_name ?? ""} />
        </Field>
        <Field label="Qtd" name="quantity">
          <Input name="quantity" inputMode="decimal" defaultValue={values.quantity ?? "1"} />
        </Field>
      </div>
      {editPrices ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor da peça (unit.)" name="part_unit_price">
            <Input name="part_unit_price" inputMode="decimal" placeholder="0,00" defaultValue={values.part_unit_price_cents ? centsToInput(values.part_unit_price_cents) : ""} />
          </Field>
          <Field label="Mão de obra" name="labor_price">
            <Input name="labor_price" inputMode="decimal" placeholder="0,00" defaultValue={values.labor_price_cents ? centsToInput(values.labor_price_cents) : ""} />
          </Field>
        </div>
      ) : (
        <>
          <input type="hidden" name="part_unit_price" value="0" />
          <input type="hidden" name="labor_price" value="0" />
        </>
      )}
      <PriorityPicker defaultValue={values.priority ?? "recomendado"} />
      <SubmitButton size="md" className="w-full sm:w-auto">
        {values.item_id ? "Salvar serviço" : "Adicionar serviço"}
      </SubmitButton>
    </ActionForm>
  );
}

function PriorityPicker({ defaultValue }: { defaultValue: string }) {
  const [v, setV] = useState(defaultValue);
  const opts = [
    { value: "urgente", label: "Urgente", cls: "border-brand bg-brand text-white" },
    { value: "recomendado", label: "Recomendado", cls: "border-amber-500 bg-amber-500 text-black" },
    { value: "pode_acompanhar", label: "Pode acompanhar", cls: "border-zinc-700 bg-zinc-700 text-white" },
  ];
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold text-zinc-700">Prioridade</legend>
      <input type="hidden" name="priority" value={v} />
      <div className="grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setV(o.value)}
            className={cx("min-h-12 rounded-xl border-2 px-2 text-sm font-semibold", v === o.value ? o.cls : "border-zinc-300 bg-white")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function DecisionForm({ itemId, current }: { itemId: string; current: string }) {
  const [decision, setDecision] = useState<"aprovado" | "recusado" | null>(null);
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setDecision("aprovado")}
          className={cx("tap rounded-xl border-2 font-bold", decision === "aprovado" ? "border-green-700 bg-green-700 text-white" : "border-green-700 text-green-800")}
        >
          {current === "aprovado" ? "✓ Aprovado" : "Cliente aprovou"}
        </button>
        <button
          type="button"
          onClick={() => setDecision("recusado")}
          className={cx("tap rounded-xl border-2 font-bold", decision === "recusado" ? "border-brand bg-brand text-white" : "border-brand text-brand")}
        >
          {current === "recusado" ? "✗ Recusado" : "Cliente recusou"}
        </button>
      </div>
      {decision && (
        <ActionForm action={recordDecisionAction} onSuccess={() => setDecision(null)} className="mt-3 rounded-xl bg-zinc-50 p-3">
          <input type="hidden" name="item_id" value={itemId} />
          <input type="hidden" name="decision" value={decision} />
          <Field label="Como o cliente respondeu?" name="method">
            <Select name="method" defaultValue="whatsapp">
              <option value="whatsapp">WhatsApp</option>
              <option value="telefone">Telefone</option>
              <option value="presencial">Presencial</option>
            </Select>
          </Field>
          <Field label="Observação (opcional)" name="note">
            <Input name="note" placeholder="Ex.: pediu para fazer só depois do dia 10" />
          </Field>
          <SubmitButton size="md" variant={decision === "aprovado" ? "dark" : "danger"} className="w-full">
            Registrar {decision === "aprovado" ? "aprovação" : "recusa"}
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

export function ExecutionForm({ itemId, current }: { itemId: string; current: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const opts = [
    { value: "em_execucao", label: "Em execução" },
    { value: "executado", label: "✓ Executado" },
    { value: "nao_executado", label: "Não executado" },
  ];
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setStatus(o.value)}
            className={cx(
              "min-h-12 rounded-xl border-2 px-1 text-sm font-semibold",
              (status ?? current) === o.value ? "border-ink bg-ink text-white" : "border-zinc-300 bg-white",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {status && status !== current && (
        <ActionForm action={setExecutionAction} onSuccess={() => setStatus(null)} className="mt-2">
          <input type="hidden" name="item_id" value={itemId} />
          <input type="hidden" name="status" value={status} />
          <Field label="Observação do serviço (opcional)" name="notes">
            <Input name="notes" />
          </Field>
          <SubmitButton size="md" className="w-full">
            Confirmar
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

export function RemoveItemForm({ itemId }: { itemId: string }) {
  return (
    <ActionForm action={removeServiceItemAction} className="mt-4 border-t border-zinc-100 pt-4">
      <input type="hidden" name="item_id" value={itemId} />
      <Field label="Remover do orçamento — motivo" name="reason">
        <Input name="reason" />
      </Field>
      <SubmitButton size="sm" variant="danger">
        Remover serviço
      </SubmitButton>
    </ActionForm>
  );
}
