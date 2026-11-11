"use client";

import { ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import type { ActionState } from "@/lib/actions";
import { FUEL } from "@/lib/status";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export type CustomerValues = {
  id?: string;
  name?: string;
  phone?: string | null;
  whatsapp?: string | null;
  cpf?: string | null;
  notes?: string | null;
  whatsapp_opt_in?: boolean;
};

export function CustomerForm({
  action,
  values = {},
  next,
  submitLabel = "Salvar cliente",
}: {
  action: Action;
  values?: CustomerValues;
  next?: string;
  submitLabel?: string;
}) {
  return (
    <ActionForm action={action}>
      {values.id && <input type="hidden" name="customer_id" value={values.id} />}
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Nome" name="name">
        <Input name="name" defaultValue={values.name} autoComplete="off" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="WhatsApp" name="whatsapp" hint="Com DDD. Ex.: (91) 98888-7777">
          <Input name="whatsapp" inputMode="tel" defaultValue={values.whatsapp ?? ""} />
        </Field>
        <Field label="Telefone (se diferente)" name="phone">
          <Input name="phone" inputMode="tel" defaultValue={values.phone ?? ""} />
        </Field>
      </div>
      <Field label="CPF (opcional)" name="cpf">
        <Input name="cpf" inputMode="numeric" defaultValue={values.cpf ?? ""} />
      </Field>
      <Checkbox
        name="whatsapp_opt_in"
        defaultChecked={values.whatsapp_opt_in}
        label="Cliente aceita receber atualizações pelo WhatsApp"
        hint="Obrigatório para enviar mensagens (LGPD). Pergunte ao cliente e registre a resposta."
      />
      <Field label="Observações" name="notes">
        <Textarea name="notes" defaultValue={values.notes ?? ""} />
      </Field>
      <SubmitButton className="w-full sm:w-auto">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}

export type VehicleValues = {
  id?: string;
  customer_id: string;
  plate?: string;
  brand?: string;
  model?: string;
  version?: string | null;
  year?: number | null;
  engine?: string | null;
  fuel?: string | null;
  current_km?: number | null;
  color?: string | null;
  notes?: string | null;
};

export function VehicleForm({
  action,
  values,
  next,
  submitLabel = "Salvar veículo",
  customers,
}: {
  action: Action;
  values: VehicleValues;
  next?: string;
  submitLabel?: string;
  customers?: { id: string; name: string }[];
}) {
  return (
    <ActionForm action={action}>
      {values.id && <input type="hidden" name="vehicle_id" value={values.id} />}
      {next && <input type="hidden" name="next" value={next} />}
      {customers ? (
        <Field label="Proprietário" name="customer_id">
          <Select name="customer_id" defaultValue={values.customer_id}>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="customer_id" value={values.customer_id} />
      )}
      <Field label="Placa" name="plate">
        <Input
          name="plate"
          defaultValue={values.plate}
          autoCapitalize="characters"
          autoCorrect="off"
          className="plate text-xl font-bold uppercase"
          placeholder="ABC1D23"
          maxLength={8}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marca" name="brand">
          <Input name="brand" defaultValue={values.brand} placeholder="Chevrolet" />
        </Field>
        <Field label="Modelo" name="model">
          <Input name="model" defaultValue={values.model} placeholder="Onix" />
        </Field>
        <Field label="Versão" name="version">
          <Input name="version" defaultValue={values.version ?? ""} placeholder="LT 1.0 Turbo" />
        </Field>
        <Field label="Ano" name="year">
          <Input name="year" inputMode="numeric" defaultValue={values.year ?? ""} placeholder="2021" />
        </Field>
        <Field label="Motor" name="engine">
          <Input name="engine" defaultValue={values.engine ?? ""} placeholder="1.0 12V" />
        </Field>
        <Field label="Combustível" name="fuel">
          <Select name="fuel" defaultValue={values.fuel ?? ""}>
            <option value="">—</option>
            {Object.entries(FUEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quilometragem atual" name="current_km">
          <Input name="current_km" inputMode="numeric" defaultValue={values.current_km ?? ""} />
        </Field>
        <Field label="Cor" name="color">
          <Input name="color" defaultValue={values.color ?? ""} />
        </Field>
      </div>
      <Field label="Observações" name="notes">
        <Textarea name="notes" defaultValue={values.notes ?? ""} />
      </Field>
      <SubmitButton className="w-full sm:w-auto">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
