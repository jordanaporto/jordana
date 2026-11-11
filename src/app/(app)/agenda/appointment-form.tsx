"use client";

import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { saveAppointmentAction } from "./actions";

const SERVICES = [
  "Revisão",
  "Troca de óleo e filtros",
  "Alinhamento e balanceamento",
  "Freios",
  "Suspensão",
  "Diagnóstico / scanner",
  "Injeção eletrônica",
  "Ar-condicionado",
  "Arrefecimento",
  "Elétrica / bateria",
];

const DURATIONS = [
  [30, "30 min"],
  [60, "1 hora"],
  [90, "1h30"],
  [120, "2 horas"],
  [180, "3 horas"],
  [240, "4 horas"],
  [480, "Dia inteiro"],
] as const;

export function AppointmentForm({
  values,
  vehicles,
  optIn,
  submitLabel,
}: {
  values: { appointment_id?: string; customer_id: string; vehicle_id?: string | null; date: string; time: string; duration: number; service?: string; notes?: string | null };
  vehicles: { id: string; label: string }[];
  optIn: boolean;
  submitLabel: string;
}) {
  return (
    <ActionForm action={saveAppointmentAction}>
      {values.appointment_id && <input type="hidden" name="appointment_id" value={values.appointment_id} />}
      <input type="hidden" name="customer_id" value={values.customer_id} />
      <Field label="Veículo" name="vehicle_id">
        <Select name="vehicle_id" defaultValue={values.vehicle_id ?? ""}>
          <option value="">Sem veículo definido</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data" name="date">
          <Input name="date" type="date" defaultValue={values.date} />
        </Field>
        <Field label="Horário" name="time">
          <Input name="time" type="time" step={900} defaultValue={values.time} />
        </Field>
      </div>
      <Field label="Duração prevista" name="duration">
        <Select name="duration" defaultValue={String(values.duration)}>
          {DURATIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Serviço" name="service">
        <Input name="service" list="servicos" defaultValue={values.service} placeholder="Ex.: Revisão de 60 mil km" />
        <datalist id="servicos">
          {SERVICES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </Field>
      <Field label="Observações" name="notes">
        <Textarea name="notes" rows={2} defaultValue={values.notes ?? ""} />
      </Field>
      <p className="rounded-xl bg-green-50 p-3 text-sm text-green-900">
        {optIn
          ? "Ao salvar, o cliente recebe a confirmação pelo WhatsApp, um lembrete 1 dia antes e outro 2 horas antes."
          : "Este cliente não autorizou mensagens pelo WhatsApp: o horário será agendado sem confirmação nem lembretes."}
      </p>
      <SubmitButton className="w-full">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
